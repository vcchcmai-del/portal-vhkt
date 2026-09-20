"""
Lấy dữ liệu từ Google Sheet đã publish dạng CSV.

Vì sao chọn cách này thay vì Google API:
  - Không cần tạo project, không cần khoá API, không cần OAuth.
  - Người phụ trách nội dung chỉ cần bấm Tệp > Chia sẻ > Đăng lên web > CSV,
    sao chép đường dẫn rồi dán vào màn hình quản trị.
  - Sửa số liệu trên Google Sheet là cổng thông tin cập nhật theo.

Ba loại sheet được hỗ trợ:

1) home_stats — sáu ô chỉ số trên trang chủ
   Cột: ma, nhan, gia_tri, don_vi, muc_tieu, ghi_chu, mau, tien_do

2) dashboard — số liệu các bảng điều khiển
   Cột: bang, ky, chi_tieu, don_vi, gia_tri
   bang nhận: KPI, WO, PAKH, FUEL, HIRE, OUTPUT, NETWORK

3) schedule — lịch công tác theo tuần
   Cột: ngay, gio, noi_dung, dia_diem, chu_tri
"""
import csv
import datetime as dt
import io
import json
import re
import urllib.error
import urllib.request

from .models import now as _gio_hien_tai

TIMEOUT = 12
CACHE_MINUTES = 10          # sau ngần này phút thì tự lấy lại từ Google Sheet
MAX_BYTES = 3 * 1024 * 1024  # chặn tệp quá lớn


class SheetError(Exception):
    """Lỗi có thể hiển thị thẳng cho người dùng."""


# --------------------------------------------------------------- Đường dẫn

def normalize_url(url: str) -> str:
    """
    Nhận nhiều kiểu đường dẫn Google Sheet và đổi về dạng tải CSV.

    Chấp nhận:
      - Đường dẫn publish CSV sẵn (.../pub?output=csv)
      - Đường dẫn sheet thường (.../edit#gid=0)  -> tự đổi sang export CSV
      - Bất kỳ đường dẫn nào trả về CSV
    """
    url = (url or "").strip()
    if not url:
        raise SheetError("Chưa nhập đường dẫn Google Sheet.")
    if not url.startswith(("http://", "https://")):
        raise SheetError("Đường dẫn phải bắt đầu bằng https://")

    # Đã là CSV thì giữ nguyên — gồm cả cổng gviz (tải một tab theo tên)
    if "output=csv" in url or "format=csv" in url or "gviz/tq" in url:
        return url

    # Dạng .../spreadsheets/d/<ID>/edit#gid=<GID>
    m = re.search(r"/spreadsheets/d/([a-zA-Z0-9-_]+)", url)
    if m:
        sheet_id = m.group(1)
        gid_match = re.search(r"[#&?]gid=(\d+)", url)
        gid = gid_match.group(1) if gid_match else "0"
        return f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv&gid={gid}"

    return url


# ------------------------------------------------------------------ Tải về

def fetch_csv(url: str) -> str:
    return _tai_text(normalize_url(url), csv_thoi=True)


def _tai_text(url: str, csv_thoi: bool = False) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "CongThongTinNoiBo/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as res:
            raw = res.read(MAX_BYTES + 1)
    except urllib.error.HTTPError as e:
        if e.code in (401, 403):
            raise SheetError(
                "Google từ chối truy cập bảng tính này (401/403) — nghĩa là bảng tính "
                "chưa mở cho người ngoài xem. Trên Google Sheet: Chia sẻ > Người có quyền "
                "truy cập chung > “Bất kỳ ai có đường liên kết” (vai trò Người xem), "
                "hoặc Tệp > Chia sẻ > Đăng lên web > CSV. Xong rồi dán lại đường dẫn."
            )
        if e.code == 404:
            raise SheetError("Không tìm thấy bảng tính. Kiểm tra lại đường dẫn.")
        raise SheetError(f"Google trả lỗi {e.code}.")
    except urllib.error.URLError as e:
        raise SheetError(f"Không kết nối được tới Google: {e.reason}")
    except Exception as e:  # noqa: BLE001
        raise SheetError(f"Lỗi khi tải bảng tính: {e}")

    if len(raw) > MAX_BYTES:
        raise SheetError("Bảng tính quá lớn (trên 3 MB). Hãy tách bớt dữ liệu.")

    text = raw.decode("utf-8-sig", errors="replace")
    if csv_thoi and (text.lstrip()[:15].lower().startswith("<!doctype") or "<html" in text[:200].lower()):
        raise SheetError(
            "Đường dẫn trả về trang web chứ không phải dữ liệu CSV. "
            "Nhiều khả năng bảng tính chưa được đăng lên web."
        )
    return text


def goc_bang_tinh(url: str) -> str:
    """Phần đường dẫn chung của một bảng tính, bỏ đuôi /edit, /htmlview, /export."""
    url = (url or "").strip()
    m = re.match(r"(https?://[^?#]*?/spreadsheets/d/[^/?#]+)", url)
    if m:
        return m.group(1)
    # Đường dẫn khác (máy chủ nội bộ khi thử nghiệm): cắt phần tệp cuối cùng.
    return re.sub(r"/(htmlview|edit|export|pub)[^/]*$", "", url.split("?")[0]).rstrip("/")


def liet_ke_tab(url: str) -> list:
    """[(tên tab, gid)] của bảng tính — để một link nhiều tab đồng bộ được cả loạt.

    Google không có API công khai cho việc này, nhưng trang /htmlview của chính
    bảng tính có sẵn danh sách tab; đọc từ đó thì không cần khoá API.
    """
    goc = goc_bang_tinh(url)
    try:
        html = _tai_text(f"{goc}/htmlview")
    except SheetError:
        html = _tai_text(f"{goc}/pubhtml")
    ra = []
    for gid, ten in re.findall(r'id="sheet-button-(\d+)"[^>]*>([^<]+)<', html):
        ra.append((ten.strip(), gid))
    if not ra:
        for ten, gid in re.findall(r'\{"name":"(.*?)".*?"gid":"?(\d+)', html):
            ra.append((ten.strip(), gid))
    if not ra:
        raise SheetError("Không đọc được danh sách tab của bảng tính. "
                         "Hãy chắc bảng tính đã chia sẻ công khai (Đăng lên web).")
    # Bỏ trùng, giữ thứ tự tab trong bảng tính.
    thay, kq = set(), []
    for ten, gid in ra:
        if gid in thay:
            continue
        thay.add(gid)
        kq.append((ten, gid))
    return kq


def kiem_tra(url: str, ten_tab: str = "") -> dict:
    """Thử từng cửa của Google rồi kể lại đúng từng cửa một.

    Người dùng dán link vào mà không đọc được thì phải biết vì sao: bảng tính
    chưa mở, tên tab sai, hay thiếu cột. Mỗi cửa thử độc lập, cửa nào đi được
    thì báo luôn kích thước và dòng đầu để đối chiếu.
    """
    goc = goc_bang_tinh(url)
    cua = []

    def thu(ten, duong, la_csv=True):
        o = {"ten": ten, "duong_dan": duong, "duoc": False, "chi_tiet": ""}
        try:
            t = _tai_text(duong, csv_thoi=la_csv)
            dong = [d for d in t.splitlines() if d.strip()]
            o["duoc"] = True
            o["chi_tiet"] = f"{len(dong)} dòng" + (f" · cột: {dong[0][:120]}" if dong else "")
        except SheetError as e:
            o["chi_tiet"] = str(e)
        cua.append(o)
        return o

    thu("Tải CSV theo đường dẫn bạn dán", normalize_url(url))
    if ten_tab:
        thu(f"Tải CSV tab “{ten_tab}” theo tên", url_tab_theo_ten(url, ten_tab))
    o = thu("Đọc danh sách tab (trang htmlview)", f"{goc}/htmlview", la_csv=False)
    tabs = []
    if o["duoc"]:
        try:
            tabs = [t for t, _g in liet_ke_tab(url)]
            o["chi_tiet"] = f"{len(tabs)} tab: " + ", ".join(tabs[:12])
        except SheetError as e:
            o["duoc"] = False
            o["chi_tiet"] = str(e)

    duoc = [c for c in cua if c["duoc"]]
    if duoc:
        ket = "Đọc được. " + "; ".join(c["ten"] for c in duoc) + "."
    elif any("401" in c["chi_tiet"] or "403" in c["chi_tiet"] for c in cua):
        ket = ("Bảng tính chưa mở cho người ngoài xem nên Google từ chối (401/403). "
               "Mở Google Sheet > Chia sẻ > Người có quyền truy cập chung > "
               "“Bất kỳ ai có đường liên kết”, vai trò Người xem. Hoặc Tệp > Chia sẻ > "
               "Đăng lên web > chọn CSV rồi dán đường dẫn vừa tạo vào đây.")
    else:
        ket = "Không đọc được bảng tính. Xem chi tiết từng cách bên dưới."
    return {"goc": goc, "ket_luan": ket, "cua": cua, "tabs": tabs}


def url_tab(url: str, gid: str) -> str:
    """Đường dẫn tải CSV của đúng một tab theo gid."""
    return f"{goc_bang_tinh(url)}/export?format=csv&gid={gid}"


def url_tab_theo_ten(url: str, ten: str) -> str:
    """Đường dẫn tải CSV của một tab theo TÊN — khỏi phải biết gid.

    Dùng cổng gviz của chính Google: nhập tên tab như trên bảng tính là đủ.
    """
    from urllib.parse import quote
    return f"{goc_bang_tinh(url)}/gviz/tq?tqx=out:csv&sheet={quote(ten)}"


# ------------------------------------------------------------- Đọc bảng

def _clean(s) -> str:
    return str(s or "").strip()


def _key(s) -> str:
    """Chuẩn hoá tên cột: bỏ dấu, thường hoá, bỏ khoảng trắng."""
    import unicodedata
    s = unicodedata.normalize("NFD", _clean(s).lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s.replace("đ", "d").replace(" ", "_").replace("-", "_")


def _to_number(v):
    """Đổi '1.284', '94,2', '1,28%', '12.500 đ' thành số."""
    s = _clean(v)
    if not s:
        return None
    s = re.sub(r"[^\d,.\-]", "", s)
    if not s:
        return None
    # Cách viết số của Việt Nam: dấu chấm ngăn nghìn, dấu phẩy ngăn thập phân.
    if "," in s and "." in s:
        # 1.284,5  ->  1284.5
        s = s.replace(".", "").replace(",", ".")
    elif "," in s:
        # 94,2  ->  94.2
        s = s.replace(",", ".")
    elif s.count(".") > 1:
        # 1.284.000  ->  1284000
        s = s.replace(".", "")
    elif s.count(".") == 1:
        # Chỉ có một dấu chấm thì phải đoán: ngăn nghìn hay thập phân.
        # Đúng 3 chữ số sau dấu chấm  ->  ngăn nghìn  (1.402 = 1402)
        # Khác 3 chữ số               ->  thập phân   (1.28 = 1.28)
        phan_le = s.split(".")[1]
        if len(phan_le) == 3 and phan_le.isdigit():
            s = s.replace(".", "")
    try:
        return float(s)
    except ValueError:
        return None


def read_rows(text: str):
    """Đọc CSV thành danh sách từ điển, tên cột đã chuẩn hoá."""
    rows = list(csv.reader(io.StringIO(text)))
    rows = [r for r in rows if any(_clean(c) for c in r)]
    if not rows:
        raise SheetError("Bảng tính rỗng.")
    header = [_key(c) for c in rows[0]]
    out = []
    for r in rows[1:]:
        item = {header[i]: _clean(v) for i, v in enumerate(r) if i < len(header) and header[i]}
        if any(item.values()):
            out.append(item)
    return header, out


def need(header, required, kind):
    missing = [c for c in required if c not in header]
    if missing:
        raise SheetError(
            f"Sheet loại “{kind}” thiếu cột: {', '.join(missing)}. "
            f"Các cột bắt buộc: {', '.join(required)}."
        )


# ------------------------------------------------- Chuyển đổi theo từng loại

def parse_home_stats(text: str):
    header, rows = read_rows(text)
    need(header, ["ma", "nhan", "gia_tri"], "home_stats")
    out = []
    for r in rows:
        out.append({
            "ma": r.get("ma", ""),
            "nhan": r.get("nhan", ""),
            "gia_tri": r.get("gia_tri", ""),
            "don_vi": r.get("don_vi", ""),
            "muc_tieu": r.get("muc_tieu", ""),
            "ghi_chu": r.get("ghi_chu", ""),
            "mau": r.get("mau", "") or "grey",
            "tien_do": _to_number(r.get("tien_do")),
        })
    return out


BOARDS = {"KPI", "WO", "PAKH", "FUEL", "HIRE", "OUTPUT", "NETWORK"}


def parse_dashboard(text: str):
    header, rows = read_rows(text)
    need(header, ["bang", "ky", "chi_tieu", "gia_tri"], "dashboard")
    out = []
    bad = set()
    for r in rows:
        board = r.get("bang", "").upper().strip()
        if board not in BOARDS:
            bad.add(board or "(trống)")
            continue
        value = _to_number(r.get("gia_tri"))
        if value is None:
            continue
        out.append({
            "bang": board,
            "ky": r.get("ky", ""),
            "chi_tieu": r.get("chi_tieu", ""),
            "don_vi": r.get("don_vi", ""),
            "gia_tri": value,
        })
    if not out:
        raise SheetError(
            "Không đọc được dòng nào hợp lệ. Cột 'bang' phải là một trong: "
            + ", ".join(sorted(BOARDS))
        )
    return out


def _parse_date(s):
    s = _clean(s)
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%y"):
        try:
            return dt.datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def parse_schedule(text: str):
    header, rows = read_rows(text)
    need(header, ["ngay", "noi_dung"], "schedule")
    out = []
    for r in rows:
        d = _parse_date(r.get("ngay"))
        if not d:
            continue
        out.append({
            "ngay": d.isoformat(),
            "gio": r.get("gio", ""),
            "noi_dung": r.get("noi_dung", ""),
            "dia_diem": r.get("dia_diem", ""),
            "chu_tri": r.get("chu_tri", ""),
        })
    out.sort(key=lambda x: (x["ngay"], x["gio"]))
    if not out:
        raise SheetError(
            "Không đọc được ngày nào. Cột 'ngay' cần theo dạng ngày/tháng/năm, ví dụ 08/08/2026."
        )
    return out


PARSERS = {
    "home_stats": parse_home_stats,
    "dashboard": parse_dashboard,
    "schedule": parse_schedule,
}

KIND_LABELS = {
    "home_stats": "Chỉ số trang chủ",
    "dashboard": "Số liệu Dashboard",
    "schedule": "Lịch công tác",
}


# ------------------------------------------------------------ Đồng bộ

def sync_source(source, db, force=False):
    """
    Tải lại dữ liệu cho một nguồn. Trả về (thành_công, thông_báo).
    Kết quả lưu vào cột cache của chính bản ghi đó.
    """
    if not source.active and not force:
        return False, "Nguồn đang tắt."

    if not force and source.last_sync_at:
        tuoi = (_gio_hien_tai() - source.last_sync_at).total_seconds() / 60
        if tuoi < CACHE_MINUTES and source.last_status == "ok":
            return True, "Dùng dữ liệu đã lưu."

    try:
        text = fetch_csv(source.csv_url)
        parser = PARSERS.get(source.kind)
        if not parser:
            raise SheetError(f"Chưa hỗ trợ loại sheet “{source.kind}”.")
        data = parser(text)
    except SheetError as e:
        source.last_status = "error"
        source.last_error = str(e)
        source.last_sync_at = _gio_hien_tai()
        db.commit()
        return False, str(e)

    source.cache = json.dumps(data, ensure_ascii=False)
    source.row_count = len(data)
    source.last_status = "ok"
    source.last_error = ""
    source.last_sync_at = _gio_hien_tai()
    db.commit()
    return True, f"Đã đồng bộ {len(data)} dòng."


def get_data(db, kind, models):
    """
    Lấy dữ liệu của một loại sheet. Tự làm mới nếu quá hạn lưu tạm.
    Trả về danh sách rỗng nếu chưa cấu hình nguồn nào.
    """
    src = (
        db.query(models.SheetSource)
        .filter(models.SheetSource.kind == kind, models.SheetSource.active.is_(True))
        .first()
    )
    if not src or not src.csv_url:
        return []

    # Trang chủ/Dashboard không chặn request người dùng để chờ Google.
    # Nếu đã có cache, trả cache ngay; việc đồng bộ được thực hiện từ màn hình
    # quản trị hoặc chỉ khi nguồn chưa từng có cache. Điều này loại bỏ một
    # nguyên nhân gây treo/502 khi Google Sheet chậm hoặc tạm thời lỗi.
    if src.cache:
        try:
            return json.loads(src.cache)
        except (ValueError, TypeError):
            pass

    sync_source(src, db)
    if not src.cache:
        return []
    try:
        return json.loads(src.cache)
    except (ValueError, TypeError):
        return []
