"""
Nhập dữ liệu hàng loạt từ tệp CSV, Excel, hoặc dán trực tiếp từ Excel.

Các nhóm dữ liệu:
  users            — tài khoản đăng nhập
  people           — hồ sơ nhân viên
  schedule         — lịch công tác tuần
  metrics          — số liệu Dashboard
  candidates       — ứng viên tuyển dụng
  center_staffing  — định biên thiếu trung tâm
  incidents        — sự cố kỹ thuật
  work_orders      — WO chi tiết
  handovers        — bàn giao ca

Nguyên tắc thiết kế:
  1. Luôn xem trước rồi mới ghi. Người dùng thấy từng dòng sẽ thêm mới hay cập nhật,
     dòng nào lỗi và lỗi vì sao, trước khi bấm xác nhận.
  2. Một dòng lỗi không làm hỏng cả tệp. Các dòng đúng vẫn nhập được.
  3. Cập nhật theo khoá định danh, nhập lại tệp cũ không tạo bản ghi trùng.
"""
import datetime as dt
import io
import json

from .sheets import _clean, _key, _parse_date, _to_number
from .operations import _next_code

# ------------------------------------------------------------ Khai báo nhóm

KINDS = {
    "users": {
        "label": "Tài khoản đăng nhập",
        "key_col": "tai_khoan",
        "columns": [
            ("tai_khoan", "Tên đăng nhập", True, "luongdv"),
            ("ho_ten", "Họ và tên hiển thị", True, "Đoàn Văn Lương"),
            ("quyen", "Quyền: admin / editor / staff", True, "editor"),
            ("mat_khau", "Mật khẩu (bỏ trống khi cập nhật)", False, "VhktHcm2026"),
        ],
        "note": "Cập nhật theo cột tai_khoan. Bỏ trống mat_khau khi cập nhật để giữ mật khẩu cũ.",
    },
    "people": {
        "label": "Hồ sơ nhân viên",
        "key_col": "email",
        "columns": [
            ("ho_ten", "Họ và tên", True, "Phạm Minh Tuấn"),
            ("chuc_vu", "Chức vụ", False, "Tổ trưởng Ứng cứu thông tin"),
            ("don_vi", "Phòng ban / đơn vị", False, "Phòng Vận hành khai thác"),
            ("dien_thoai", "Số điện thoại", False, "0982111011"),
            ("email", "Thư điện tử — dùng làm khoá nhận diện", True, "tuanpm@viettel.com.vn"),
            ("ngay_sinh", "Ngày sinh (dd/mm/yyyy)", False, "08/08/1992"),
            ("dang_lam", "Đang công tác: co / khong", False, "co"),
        ],
        "note": "Cập nhật theo cột email. Ngày sinh nhập ở đây sẽ tự hiện ở mục Sinh nhật.",
    },
    "schedule": {
        "label": "Lịch công tác tuần",
        "key_col": None,
        "columns": [
            ("ngay", "Ngày (dd/mm/yyyy)", True, "08/08/2026"),
            ("gio", "Giờ (hh:mm)", False, "07:30"),
            ("noi_dung", "Nội dung công việc", True, "Giao ban tuần Phòng VHKT"),
            ("dia_diem", "Địa điểm", False, "Phòng họp 301"),
            ("chu_tri", "Đơn vị chủ trì", False, "Ban Giám đốc"),
            ("thanh_phan", "Thành phần tham gia", False, "Ban Giám đốc, Trưởng các phòng, Tổ trưởng"),
            ("hinh_thuc", "Hình thức: truc_tiep / cau_truyen_hinh / zoom / google_meet / teams", False, "cau_truyen_hinh"),
            ("thong_tin_hop", "IP điểm cầu, hoặc đường dẫn phòng họp trực tuyến", False, "10.255.58.3"),
            ("ma_hop", "Mã phòng họp (nếu có)", False, "812 3456 7890"),
            ("mat_khau_hop", "Mật khẩu phòng họp (nếu có)", False, "vhkt2026"),
        ],
        "note": "Trùng cả ngày, giờ và nội dung thì cập nhật, không tạo thêm bản ghi mới. "
                "Họp cầu truyền hình thì điền IP điểm cầu vào cột thong_tin_hop; "
                "họp Zoom, Google Meet, Teams thì dán đường dẫn phòng họp.",
        # Cột nào có ở đây thì tệp mẫu Excel sẽ có ô thả xuống, tránh gõ sai giá trị.
        "dropdowns": {
            "hinh_thuc": ["truc_tiep", "cau_truyen_hinh", "zoom", "google_meet", "teams", "khac"],
        },
    },
    "metrics": {
        "label": "Số liệu Dashboard",
        "key_col": None,
        "columns": [
            ("bang", "Bảng: KPI(=Tiền phạt & Doanh thu) / WO(=Rời mạng CĐBR) / PAKH / FUEL / OUTPUT / NETWORK / VHKT / VHKT_TARGET", True, "WO"),
            ("ky", "Kỳ số liệu", True, "2026-08"),
            ("chi_tieu", "Tên chỉ tiêu", True, "Hoàn thành"),
            ("don_vi", "Đơn vị / tổ (nếu có)", False, "Tổ KV1"),
            ("gia_tri", "Giá trị", True, "1.284"),
        ],
        "note": "Trùng cả bảng, kỳ, chỉ tiêu và đơn vị thì ghi đè giá trị cũ. "
                "Với KPI vận hành khai thác: nhập số thật vào bảng VHKT, nhập chỉ tiêu/target "
                "(cùng đúng tên chỉ tiêu, cùng kỳ) vào bảng VHKT_TARGET — hệ thống tự đối chiếu hai bảng này.",
    },
    "candidates": {
        "label": "Ứng viên tuyển dụng",
        "key_col": None,
        "columns": [
            ("ho_ten", "Họ và tên", True, "Nguyễn Văn A"),
            ("vi_tri", "Vị trí ứng tuyển", True, "Nhân viên Kỹ thuật nhà trạm"),
            ("loai_vi_tri", "Loại vị trí: OFT / FT", False, "OFT"),
            ("khu_vuc", "Khu vực mong muốn làm việc", False, "Trung tâm Thới Hòa"),
            ("nam_sinh", "Năm sinh", False, "1998"),
            ("trinh_do", "Trình độ", False, "Cao đẳng"),
            ("chuyen_mon", "Chuyên môn", False, "Điện - Điện tử"),
            ("nguoi_gioi_thieu", "Người giới thiệu", False, "Trần Thị B"),
            ("trang_thai", "Trạng thái: new/reviewing/interview/negotiating/hired/probation/left/rejected", False, "new"),
            ("ghi_chu", "Ghi chú", False, ""),
        ],
        "note": "Mỗi dòng luôn tạo một hồ sơ ứng viên mới (không cập nhật hồ sơ cũ trùng tên), "
                "vì danh sách ứng viên không có khoá định danh riêng.",
        "dropdowns": {
            "loai_vi_tri": ["OFT", "FT"],
            "trang_thai": ["new", "reviewing", "interview", "negotiating", "hired", "probation", "left", "rejected"],
        },
    },
    "center_staffing": {
        "label": "Định biên thiếu trung tâm",
        "key_col": None,
        "columns": [
            ("ngay_chot", "Ngày chốt số liệu (dd/mm/yyyy)", True, "08/08/2026"),
            ("trung_tam", "Trung tâm", True, "Trung tâm Thới Hòa"),
            ("thieu_oft", "Thiếu OFT", False, "2"),
            ("thieu_ft", "Thiếu FT", False, "1"),
            ("da_dang_kenh", "Đã đăng Zalo/FB/Hội nhóm (luỹ kế)", False, "3"),
            ("tiep_xuc_truong", "Tiếp xúc trường/BCHQS (luỹ kế)", False, "1"),
            ("bang_ron", "Dán băng rôn tuyển dụng (luỹ kế)", False, "2"),
            ("vi_tri_bang_ron", "Vị trí treo băng rôn", False, "Cổng trung tâm"),
            ("ghi_chu", "Ghi chú", False, ""),
        ],
        "note": "Trùng cả ngày chốt số liệu và trung tâm thì cập nhật, không tạo thêm bản ghi mới. "
                "Cột hồ sơ nhận trong tháng không cần nhập — hệ thống tự đếm từ danh sách Ứng viên.",
    },
    "incidents": {
        "label": "Sự cố kỹ thuật",
        "key_col": "ma_su_co",
        "columns": [
            ("ma_su_co", "Mã sự cố (để trống sẽ tự sinh)", False, ""),
            ("tieu_de", "Tiêu đề sự cố", True, "Mất sóng trạm ABC"),
            ("vi_tri", "Vị trí / trạm", False, "Trạm ABC"),
            ("muc_do", "Mức độ: critical/high/medium/low", False, "medium"),
            ("trang_thai", "Trạng thái: open/processing/resolved/closed", False, "open"),
            ("nguoi_xu_ly", "Người xử lý", False, "Phạm Minh Tuấn"),
            ("mo_ta", "Mô tả", False, ""),
            ("han_xu_ly", "Hạn xử lý (dd/mm/yyyy hoặc dd/mm/yyyy hh:mm)", False, "10/08/2026 17:00"),
        ],
        "note": "Có mã sự cố thì cập nhật đúng sự cố đó; để trống mã thì luôn tạo sự cố mới, mã tự sinh dạng SC-yymmdd-NNN.",
        "dropdowns": {
            "muc_do": ["critical", "high", "medium", "low"],
            "trang_thai": ["open", "processing", "resolved", "closed"],
        },
    },
    "work_orders": {
        "label": "WO chi tiết",
        "key_col": "ma_wo",
        "columns": [
            ("ma_wo", "Mã WO (để trống sẽ tự sinh)", False, ""),
            ("noi_dung", "Nội dung WO", True, "Bảo dưỡng máy phát điện"),
            ("nhom_cong_viec", "Nhóm công việc", False, "Vận hành"),
            ("dia_diem", "Địa điểm", False, "Trạm ABC"),
            ("nguoi_xu_ly", "Người xử lý", False, "Phạm Minh Tuấn"),
            ("trang_thai", "Trạng thái: new/assigned/processing/done/overdue", False, "new"),
            ("mo_ta", "Mô tả", False, ""),
            ("han_xu_ly", "Hạn xử lý (dd/mm/yyyy hoặc dd/mm/yyyy hh:mm)", False, "10/08/2026 17:00"),
        ],
        "note": "Có mã WO thì cập nhật đúng WO đó; để trống mã thì luôn tạo WO mới, mã tự sinh dạng WO-yymmdd-NNN.",
        "dropdowns": {
            "trang_thai": ["new", "assigned", "processing", "done", "overdue"],
        },
    },
    "handovers": {
        "label": "Bàn giao ca",
        "key_col": None,
        "columns": [
            ("ngay_truc", "Ngày trực (dd/mm/yyyy)", True, "08/08/2026"),
            ("ca_truc", "Ca trực", False, "Ca ngày"),
            ("nguoi_ban_giao", "Người bàn giao", True, "Phạm Minh Tuấn"),
            ("nguoi_tiep_nhan", "Người tiếp nhận", False, "Trần Văn Nam"),
            ("noi_dung", "Nội dung bàn giao", True, "Hệ thống hoạt động bình thường"),
            ("ton_dong", "Việc còn tồn đọng", False, ""),
            ("rui_ro", "Rủi ro cần lưu ý", False, ""),
            ("da_xac_nhan", "Đã xác nhận: co / khong", False, "khong"),
        ],
        "note": "Trùng cả ngày trực, ca trực và người bàn giao thì cập nhật, không tạo thêm bản ghi mới.",
    },
}

BOARDS = {
    "KPI", "WO", "PAKH", "FUEL", "HIRE", "OUTPUT", "NETWORK",
    # KPI vận hành khai thác: Cell*h, sự cố truyền dẫn, ksubmin, TKM 3h/10h/24h, XLSC 3h/10h/24h...
    "VHKT", "VHKT_TARGET",
    # Target cho Tiền phạt & Doanh thu (KPI) và Rời mạng CĐBR (WO) — để trống
    # cột đơn vị trong bảng target thì áp dụng chung cho mọi trung tâm.
    "KPI_TARGET", "WO_TARGET",
    # Chi tiết nguyên nhân phạt theo nhóm VTT / VTNet — mỗi dòng là một nguyên
    # nhân (chi_tieu), giá trị đơn vị triệu đồng.
    "KPI_VTT", "KPI_VTNET",
    # Rời mạng CĐBR theo địa bàn: số lượng theo tỉnh, số lượng+tỷ lệ theo huyện
    # (Bình Dương, Bà Rịa - Vũng Tàu) — đơn vị (unit_name) = tên tỉnh/huyện.
    "WO_TINH", "WO_HUYEN_BD", "WO_HUYEN_BRVT",
}
ROLES = {"admin", "editor", "staff"}
MAX_ROWS = 2000


class ImportError_(Exception):
    """Lỗi hiển thị được cho người dùng."""


# --------------------------------------------------------------- Đọc tệp

def read_table(content: bytes, filename: str = ""):
    """Đọc CSV hoặc Excel thành (danh sách cột, danh sách dòng)."""
    name = (filename or "").lower()

    if name.endswith((".xlsx", ".xlsm")):
        return _read_excel(content)

    text = content.decode("utf-8-sig", errors="replace")
    return read_text_table(text)


def read_text_table(text: str):
    """
    Đọc dữ liệu dạng văn bản. Tự nhận biết dấu phân cách:
    dấu tab khi dán trực tiếp từ Excel, dấu phẩy hoặc chấm phẩy khi là tệp CSV.
    """
    import csv

    text = (text or "").strip("\ufeff\n\r ")
    if not text:
        raise ImportError_("Chưa có dữ liệu.")

    first = text.splitlines()[0]
    if "\t" in first:
        delim = "\t"
    elif first.count(";") > first.count(","):
        delim = ";"
    else:
        delim = ","

    rows = [r for r in csv.reader(io.StringIO(text), delimiter=delim) if any(_clean(c) for c in r)]
    if len(rows) < 2:
        raise ImportError_("Cần ít nhất một dòng tiêu đề và một dòng dữ liệu.")
    return _to_dicts(rows)


def _read_excel(content: bytes):
    try:
        from openpyxl import load_workbook
    except ImportError:
        raise ImportError_(
            "Máy chủ chưa cài thư viện đọc Excel. Hãy lưu tệp sang định dạng CSV, "
            "hoặc mở Excel chọn toàn bộ bảng rồi dán vào ô bên dưới."
        )
    try:
        wb = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
        ws = wb[wb.sheetnames[0]]
        rows = []
        for r in ws.iter_rows(values_only=True):
            vals = ["" if v is None else str(v) for v in r]
            if any(_clean(v) for v in vals):
                rows.append(vals)
    except ImportError_:
        raise
    except Exception as e:  # noqa: BLE001
        raise ImportError_(f"Không đọc được tệp Excel: {e}")

    if len(rows) < 2:
        raise ImportError_("Tệp Excel cần ít nhất một dòng tiêu đề và một dòng dữ liệu.")
    return _to_dicts(rows)


def _to_dicts(rows):
    header = [_key(c) for c in rows[0]]
    if len(rows) - 1 > MAX_ROWS:
        raise ImportError_(f"Tệp có quá {MAX_ROWS} dòng. Hãy chia nhỏ rồi nhập nhiều lần.")
    out = []
    for r in rows[1:]:
        item = {header[i]: _clean(v) for i, v in enumerate(r) if i < len(header) and header[i]}
        if any(item.values()):
            out.append(item)
    return header, out


def check_columns(kind: str, header):
    spec = KINDS[kind]
    required = [c for c, _l, req, _ex in spec["columns"] if req]
    missing = [c for c in required if c not in header]
    if missing:
        raise ImportError_(
            f"Thiếu cột bắt buộc: {', '.join(missing)}. "
            f"Tải tệp mẫu ở nút bên cạnh để lấy đúng dòng tiêu đề."
        )


def build_template(kind: str) -> str:
    """Sinh nội dung tệp mẫu CSV: dòng tiêu đề kèm một dòng ví dụ."""
    spec = KINDS[kind]
    cols = [c for c, _l, _r, _e in spec["columns"]]
    example = [e for _c, _l, _r, e in spec["columns"]]
    lines = [",".join(cols), ",".join(f'"{v}"' for v in example)]
    return "\ufeff" + "\n".join(lines) + "\n"


def build_template_xlsx(kind: str) -> bytes:
    """
    Sinh tệp mẫu Excel có hướng dẫn ngay trong tệp:
      - Trang 1 "Du lieu": dòng tiêu đề đúng chuẩn, một dòng ví dụ, cột đã canh rộng,
        khoá dòng tiêu đề để cuộn vẫn thấy, cột bắt buộc tô đỏ.
      - Trang 2 "Huong dan": giải thích từng cột và cách nhập.
    """
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font, PatternFill
    from openpyxl.utils import get_column_letter
    from openpyxl.worksheet.datavalidation import DataValidation

    spec = KINDS[kind]
    cols = spec["columns"]
    dropdowns = spec.get("dropdowns", {})

    wb = Workbook()
    ws = wb.active
    ws.title = "Du lieu"

    do_bat_buoc = PatternFill("solid", fgColor="C8102E")
    xam_nhat = PatternFill("solid", fgColor="6B7280")
    chu_trang = Font(bold=True, color="FFFFFF", size=11)
    chu_vi_du = Font(italic=True, color="8A8A8A")

    for i, (name, label, required, example) in enumerate(cols, start=1):
        cell = ws.cell(row=1, column=i, value=name)
        cell.fill = do_bat_buoc if required else xam_nhat
        cell.font = chu_trang
        cell.alignment = Alignment(horizontal="center", vertical="center")

        ws.cell(row=2, column=i, value=example).font = chu_vi_du
        ws.column_dimensions[get_column_letter(i)].width = max(len(name), len(example), 14) + 4

        # Cột có sẵn danh sách lựa chọn thì gắn ô thả xuống thật trong Excel,
        # tránh người nhập gõ sai chính tả giá trị.
        if name in dropdowns:
            options = dropdowns[name]
            dv = DataValidation(type="list", formula1='"{}"'.format(",".join(options)),
                                 allow_blank=True, showDropDown=False)
            dv.error = "Chọn một giá trị trong danh sách thả xuống."
            dv.errorTitle = "Giá trị không hợp lệ"
            ws.add_data_validation(dv)
            col_letter = get_column_letter(i)
            dv.add(f"{col_letter}2:{col_letter}1000")

    ws.row_dimensions[1].height = 24
    ws.freeze_panes = "A3"

    hd = wb.create_sheet("Huong dan")
    hd.column_dimensions["A"].width = 20
    hd.column_dimensions["B"].width = 58
    hd.column_dimensions["C"].width = 14
    hd.column_dimensions["D"].width = 30

    hd["A1"] = f"TỆP MẪU: {spec['label']}"
    hd["A1"].font = Font(bold=True, size=14, color="C8102E")
    hd["A2"] = spec["note"]
    hd["A2"].alignment = Alignment(wrap_text=True)
    hd.merge_cells("A2:D2")

    for i, h in enumerate(["Tên cột", "Ý nghĩa", "Bắt buộc", "Ví dụ"], start=1):
        c = hd.cell(row=4, column=i, value=h)
        c.fill = do_bat_buoc
        c.font = chu_trang

    for r, (name, label, required, example) in enumerate(cols, start=5):
        hd.cell(row=r, column=1, value=name).font = Font(bold=True)
        hd.cell(row=r, column=2, value=label).alignment = Alignment(wrap_text=True)
        hd.cell(row=r, column=3, value="Bắt buộc" if required else "Không")
        hd.cell(row=r, column=4, value=example)

    r = len(cols) + 7
    hd.cell(row=r, column=1, value="CÁCH DÙNG").font = Font(bold=True, size=12, color="C8102E")
    for i, line in enumerate([
        "1. Điền dữ liệu vào trang 'Du lieu', bắt đầu từ dòng 2. Xoá dòng ví dụ trước khi nhập thật.",
        "2. KHÔNG đổi tên, không xoá và không đảo thứ tự các cột ở dòng 1.",
        "3. Cột tô đỏ là bắt buộc, không được để trống.",
        "4. Lưu tệp rồi vào Quản trị > Nhập dữ liệu hàng loạt, chọn tệp này.",
        "5. Hoặc nhanh hơn: bôi đen cả bảng kèm dòng tiêu đề, Ctrl+C, dán thẳng vào ô nhập.",
        "6. Bấm Xem trước để kiểm tra, thấy đúng rồi mới bấm Xác nhận ghi.",
        "7. Nhập lại cùng tệp sẽ cập nhật bản ghi cũ, không tạo bản trùng.",
    ], start=1):
        hd.cell(row=r + i, column=1, value=line)
        hd.merge_cells(start_row=r + i, start_column=1, end_row=r + i, end_column=4)

    import io as _io
    buf = _io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


# --------------------------------------------------- Kiểm tra và áp dụng

def _yes(v) -> bool:
    return _clean(v).lower() in ("co", "có", "x", "1", "true", "yes", "dang lam", "đang làm")


def analyze(kind: str, rows, db, models, auth, mode="upsert"):
    """
    Duyệt từng dòng, quyết định sẽ thêm mới hay cập nhật, và bắt lỗi.
    Trả về danh sách kết quả từng dòng. Chưa ghi gì vào cơ sở dữ liệu.
    """
    handler = HANDLERS[kind]
    seen = set()
    results = []

    for i, row in enumerate(rows, start=2):   # dòng 1 là tiêu đề
        try:
            item = handler["check"](row, db, models, auth)
        except ImportError_ as e:
            results.append({"dong": i, "trang_thai": "loi", "thong_bao": str(e), "du_lieu": row})
            continue

        dup_key = item.get("_key")
        if dup_key is not None:
            if dup_key in seen:
                results.append({"dong": i, "trang_thai": "loi",
                                "thong_bao": "Trùng với một dòng phía trên trong cùng tệp.",
                                "du_lieu": row})
                continue
            seen.add(dup_key)

        action = item["_action"]
        if action == "update" and mode == "create_only":
            results.append({"dong": i, "trang_thai": "bo_qua",
                            "thong_bao": "Đã tồn tại, chế độ hiện tại chỉ thêm mới.",
                            "du_lieu": row})
            continue

        results.append({
            "dong": i,
            "trang_thai": "them_moi" if action == "create" else "cap_nhat",
            "thong_bao": item.get("_note", ""),
            "du_lieu": row,
            "_item": item,
        })

    return results


def apply_rows(kind: str, results, db, models, auth):
    """Ghi các dòng hợp lệ vào cơ sở dữ liệu."""
    handler = HANDLERS[kind]
    created = updated = 0
    for r in results:
        if r["trang_thai"] not in ("them_moi", "cap_nhat"):
            continue
        handler["apply"](r["_item"], db, models, auth)
        if r["trang_thai"] == "them_moi":
            created += 1
        else:
            updated += 1
    db.commit()
    return created, updated


# ------------------------------------------------------------ users

def _check_user(row, db, models, auth):
    username = _clean(row.get("tai_khoan")).lower()
    if not username:
        raise ImportError_("Thiếu tên đăng nhập.")
    if not all(c.isalnum() or c in "._-" for c in username) or len(username) < 3:
        raise ImportError_("Tên đăng nhập chỉ gồm chữ, số, dấu chấm, gạch ngang, gạch dưới; ít nhất 3 ký tự.")

    role = _clean(row.get("quyen")).lower() or "staff"
    role_map = {"quan tri": "admin", "quản trị": "admin", "quản trị viên": "admin",
                "bien tap": "editor", "biên tập": "editor", "biên tập viên": "editor",
                "nhan vien": "staff", "nhân viên": "staff"}
    role = role_map.get(role, role)
    if role not in ROLES:
        raise ImportError_(f"Quyền “{row.get('quyen')}” không hợp lệ. Chỉ nhận admin, editor hoặc staff.")

    full_name = _clean(row.get("ho_ten"))
    if not full_name:
        raise ImportError_("Thiếu họ và tên hiển thị.")

    password = _clean(row.get("mat_khau"))
    existing = db.query(models.User).filter(models.User.username == username).first()

    if not existing and len(password) < 8:
        raise ImportError_("Tài khoản mới cần mật khẩu ít nhất 8 ký tự.")
    if existing and password and len(password) < 8:
        raise ImportError_("Mật khẩu mới phải có ít nhất 8 ký tự, hoặc để trống để giữ mật khẩu cũ.")

    return {
        "_key": username, "_action": "update" if existing else "create",
        "_note": "Giữ mật khẩu cũ." if existing and not password else "",
        "username": username, "full_name": full_name, "role": role,
        "password": password, "id": existing.id if existing else None,
    }


def _apply_user(item, db, models, auth):
    if item["id"]:
        u = db.get(models.User, item["id"])
        u.full_name = item["full_name"]
        u.role = item["role"]
        if item["password"]:
            u.password_hash = auth.hash_password(item["password"])
    else:
        db.add(models.User(
            username=item["username"], full_name=item["full_name"], role=item["role"],
            password_hash=auth.hash_password(item["password"]),
        ))


# ------------------------------------------------------------ people

def _check_person(row, db, models, auth):
    full_name = _clean(row.get("ho_ten"))
    email = _clean(row.get("email")).lower()
    if not full_name:
        raise ImportError_("Thiếu họ và tên.")
    if not email:
        raise ImportError_("Thiếu thư điện tử. Cột này dùng để nhận ra người đã có trong danh sách.")
    if "@" not in email:
        raise ImportError_(f"Thư điện tử “{email}” không hợp lệ.")

    birthday = None
    raw_bd = _clean(row.get("ngay_sinh"))
    if raw_bd:
        birthday = _parse_date(raw_bd)
        if not birthday:
            raise ImportError_(f"Ngày sinh “{raw_bd}” không đọc được. Dùng dạng 08/08/1992.")

    existing = db.query(models.Person).filter(models.Person.email == email).first()
    return {
        "_key": email, "_action": "update" if existing else "create",
        "id": existing.id if existing else None,
        "full_name": full_name, "role": _clean(row.get("chuc_vu")),
        "dept": _clean(row.get("don_vi")), "phone": _clean(row.get("dien_thoai")),
        "email": email, "birthday": birthday,
        "active": _yes(row.get("dang_lam")) if _clean(row.get("dang_lam")) else True,
    }


def _apply_person(item, db, models, auth):
    p = db.get(models.Person, item["id"]) if item["id"] else models.Person(color="#C8102E")
    for f in ("full_name", "role", "dept", "phone", "email", "active"):
        setattr(p, f, item[f])
    if item["birthday"]:
        p.birthday = item["birthday"]
    if not item["id"]:
        db.add(p)


# ------------------------------------------------------------ schedule

MEETING_ALIASES = {
    "truc tiep": "truc_tiep", "trực tiếp": "truc_tiep", "tt": "truc_tiep",
    "offline": "truc_tiep", "phong hop": "truc_tiep",
    "cau truyen hinh": "cau_truyen_hinh", "cầu truyền hình": "cau_truyen_hinh",
    "cau": "cau_truyen_hinh", "cth": "cau_truyen_hinh", "video conference": "cau_truyen_hinh",
    "zoom": "zoom",
    "google meet": "google_meet", "meet": "google_meet", "gmeet": "google_meet",
    "teams": "teams", "ms teams": "teams", "microsoft teams": "teams",
    "khac": "khac", "khác": "khac",
}
MEETING_VALUES = {"truc_tiep", "cau_truyen_hinh", "zoom", "google_meet", "teams", "khac"}
MEETING_ONLINE = {"zoom", "google_meet", "teams"}


def _chuan_hoa_hinh_thuc(raw):
    """Nhận nhiều cách viết của cùng một hình thức họp, đưa về giá trị chuẩn."""
    v = _clean(raw).lower().replace("-", "_")
    if not v:
        return "truc_tiep"
    if v in MEETING_VALUES:
        return v
    from .sheets import _key
    khong_dau = _key(v).replace("_", " ")
    return MEETING_ALIASES.get(v) or MEETING_ALIASES.get(khong_dau)


def _check_event(row, db, models, auth):
    d = _parse_date(row.get("ngay"))
    if not d:
        raise ImportError_(f"Ngày “{row.get('ngay')}” không đọc được. Dùng dạng 08/08/2026.")

    title = _clean(row.get("noi_dung"))
    if not title:
        raise ImportError_("Thiếu nội dung công việc.")

    raw_time = _clean(row.get("gio")) or "08:00"
    try:
        parts = raw_time.replace("h", ":").split(":")
        hh = int(parts[0]); mm = int(parts[1]) if len(parts) > 1 and parts[1] else 0
        start = dt.datetime.combine(d, dt.time(hh, mm))
    except (ValueError, IndexError):
        raise ImportError_(f"Giờ “{raw_time}” không đọc được. Dùng dạng 07:30.")

    # --- Hình thức họp và thông tin kết nối ---
    hinh_thuc_raw = row.get("hinh_thuc")
    hinh_thuc = _chuan_hoa_hinh_thuc(hinh_thuc_raw)
    if hinh_thuc is None:
        raise ImportError_(
            f"Hình thức họp “{_clean(hinh_thuc_raw)}” không nhận ra. "
            "Dùng một trong: truc_tiep, cau_truyen_hinh, zoom, google_meet, teams, khac."
        )

    thong_tin = _clean(row.get("thong_tin_hop"))
    ghi_chu = ""

    if hinh_thuc == "cau_truyen_hinh":
        if not thong_tin:
            raise ImportError_("Họp cầu truyền hình phải có địa chỉ IP điểm cầu ở cột thong_tin_hop.")
    elif hinh_thuc in MEETING_ONLINE:
        if not thong_tin:
            raise ImportError_("Họp trực tuyến phải có đường dẫn phòng họp ở cột thong_tin_hop.")
        if not thong_tin.lower().startswith(("http://", "https://")):
            raise ImportError_(
                f"Đường dẫn phòng họp phải bắt đầu bằng https:// — đang nhập “{thong_tin[:60]}”."
            )
    elif hinh_thuc == "truc_tiep" and thong_tin:
        ghi_chu = "Họp trực tiếp nhưng có thông tin kết nối, vẫn lưu lại."

    existing = (db.query(models.Event)
                .filter(models.Event.kind == "work",
                        models.Event.start_at == start,
                        models.Event.title == title).first())
    return {
        "_key": f"{start.isoformat()}|{title}",
        "_action": "update" if existing else "create",
        "_note": ghi_chu,
        "id": existing.id if existing else None,
        "title": title, "start_at": start,
        "place": _clean(row.get("dia_diem")), "host": _clean(row.get("chu_tri")),
        "participants": _clean(row.get("thanh_phan")),
        "meeting_type": hinh_thuc,
        "meeting_info": thong_tin,
        "meeting_id": _clean(row.get("ma_hop")),
        "meeting_pass": _clean(row.get("mat_khau_hop")),
    }


def _apply_event(item, db, models, auth):
    e = db.get(models.Event, item["id"]) if item["id"] else models.Event(kind="work")
    e.title = item["title"]; e.start_at = item["start_at"]
    e.place = item["place"]; e.host = item["host"]
    e.participants = item["participants"]
    e.meeting_type = item["meeting_type"]
    e.meeting_info = item["meeting_info"]
    e.meeting_id = item["meeting_id"]
    e.meeting_pass = item["meeting_pass"]
    if not item["id"]:
        db.add(e)


# ------------------------------------------------------------ metrics

def _check_metric(row, db, models, auth):
    board = _clean(row.get("bang")).upper()
    if board not in BOARDS:
        raise ImportError_(f"Bảng “{row.get('bang')}” không hợp lệ. Chỉ nhận: {', '.join(sorted(BOARDS))}.")

    period = _clean(row.get("ky"))
    label = _clean(row.get("chi_tieu"))
    if not period:
        raise ImportError_("Thiếu kỳ số liệu.")
    if not label:
        raise ImportError_("Thiếu tên chỉ tiêu.")

    value = _to_number(row.get("gia_tri"))
    if value is None:
        raise ImportError_(f"Giá trị “{row.get('gia_tri')}” không phải là số.")

    unit = _clean(row.get("don_vi"))
    existing = (db.query(models.Metric)
                .filter(models.Metric.board == board, models.Metric.period == period,
                        models.Metric.label == label,
                        models.Metric.unit_name == (unit or None)).first())
    return {
        "_key": f"{board}|{period}|{label}|{unit}",
        "_action": "update" if existing else "create",
        "id": existing.id if existing else None,
        "board": board, "period": period, "label": label,
        "unit_name": unit or None, "value": value,
    }


def _apply_metric(item, db, models, auth):
    m = db.get(models.Metric, item["id"]) if item["id"] else models.Metric()
    m.board = item["board"]; m.period = item["period"]; m.label = item["label"]
    m.unit_name = item["unit_name"]; m.value = item["value"]
    if not item["id"]:
        db.add(m)


def _parse_datetime_optional(raw):
    """Nhận dd/mm/yyyy hoặc dd/mm/yyyy hh:mm. Trả về datetime hoặc None nếu để trống."""
    raw = _clean(raw)
    if not raw:
        return None
    phan = raw.split(" ")
    d = _parse_date(phan[0])
    if not d:
        raise ImportError_(f"Ngày “{raw}” không đọc được. Dùng dạng 10/08/2026 hoặc 10/08/2026 17:00.")
    hh, mm = 0, 0
    if len(phan) > 1 and phan[1]:
        try:
            gio = phan[1].replace("h", ":").split(":")
            hh = int(gio[0]); mm = int(gio[1]) if len(gio) > 1 and gio[1] else 0
        except (ValueError, IndexError):
            raise ImportError_(f"Giờ trong “{raw}” không đọc được. Dùng dạng 17:00.")
    return dt.datetime.combine(d, dt.time(hh, mm))


CANDIDATE_STATUSES = {"new", "reviewing", "interview", "negotiating", "hired", "probation", "left", "rejected"}
INCIDENT_SEVERITIES = {"critical", "high", "medium", "low"}
INCIDENT_STATUSES = {"open", "processing", "resolved", "closed"}
WO_STATUSES = {"new", "assigned", "processing", "done", "overdue"}


def _check_candidate(row, db, models, auth):
    full_name = _clean(row.get("ho_ten"))
    if not full_name:
        raise ImportError_("Thiếu họ và tên ứng viên.")
    position = _clean(row.get("vi_tri"))
    if not position:
        raise ImportError_("Thiếu vị trí ứng tuyển.")

    position_type = _clean(row.get("loai_vi_tri")).upper()
    if position_type and position_type not in {"OFT", "FT"}:
        raise ImportError_(f"Loại vị trí “{position_type}” không hợp lệ. Chỉ nhận OFT hoặc FT.")

    status = _clean(row.get("trang_thai")).lower() or "new"
    if status not in CANDIDATE_STATUSES:
        raise ImportError_(f"Trạng thái “{row.get('trang_thai')}” không hợp lệ. "
                            f"Chỉ nhận: {', '.join(sorted(CANDIDATE_STATUSES))}.")

    birth_year = None
    raw_year = _clean(row.get("nam_sinh"))
    if raw_year:
        n = _to_number(raw_year)
        if n is None:
            raise ImportError_(f"Năm sinh “{raw_year}” không phải là số.")
        birth_year = int(n)

    return {
        "_key": f"{_key(full_name)}|{_key(position)}", "_action": "create", "id": None,
        "full_name": full_name, "position": position, "position_type": position_type or None,
        "desired_location": _clean(row.get("khu_vuc")), "birth_year": birth_year,
        "education_level": _clean(row.get("trinh_do")), "major": _clean(row.get("chuyen_mon")),
        "referrer": _clean(row.get("nguoi_gioi_thieu")), "status": status,
        "note": _clean(row.get("ghi_chu")),
    }


def _apply_candidate(item, db, models, auth):
    db.add(models.Candidate(
        full_name=item["full_name"], position=item["position"], position_type=item["position_type"],
        desired_location=item["desired_location"], birth_year=item["birth_year"],
        education_level=item["education_level"], major=item["major"], referrer=item["referrer"],
        status=item["status"], note=item["note"],
    ))


def _check_staffing(row, db, models, auth):
    report_date = _parse_date(row.get("ngay_chot"))
    if not report_date:
        raise ImportError_(f"Ngày chốt số liệu “{row.get('ngay_chot')}” không đọc được. Dùng dạng 08/08/2026.")
    center = _clean(row.get("trung_tam"))
    if not center:
        raise ImportError_("Thiếu tên trung tâm.")

    def num(col, default=0):
        raw = _clean(row.get(col))
        if not raw:
            return default
        n = _to_number(raw)
        if n is None:
            raise ImportError_(f"Giá trị cột {col} “{raw}” không phải là số.")
        return int(n)

    existing = (db.query(models.CenterStaffing)
                .filter(models.CenterStaffing.report_date == report_date,
                        models.CenterStaffing.center == center).first())
    return {
        "_key": f"{report_date.isoformat()}|{_key(center)}", "_action": "update" if existing else "create",
        "id": existing.id if existing else None,
        "report_date": report_date, "center": center,
        "oft_gap": num("thieu_oft"), "ft_gap": num("thieu_ft"),
        "posted_channels": num("da_dang_kenh"),
        "school_contacts": num("tiep_xuc_truong"), "banners_posted": num("bang_ron"),
        "banner_location": _clean(row.get("vi_tri_bang_ron")), "note": _clean(row.get("ghi_chu")),
    }


def _apply_staffing(item, db, models, auth):
    s = db.get(models.CenterStaffing, item["id"]) if item["id"] else models.CenterStaffing()
    for f in ("report_date", "center", "oft_gap", "ft_gap",
              "posted_channels", "school_contacts", "banners_posted", "banner_location", "note"):
        setattr(s, f, item[f])
    if not item["id"]:
        db.add(s)


def _check_incident(row, db, models, auth):
    title = _clean(row.get("tieu_de"))
    if not title:
        raise ImportError_("Thiếu tiêu đề sự cố.")

    severity = _clean(row.get("muc_do")).lower() or "medium"
    if severity not in INCIDENT_SEVERITIES:
        raise ImportError_(f"Mức độ “{row.get('muc_do')}” không hợp lệ. Chỉ nhận: {', '.join(sorted(INCIDENT_SEVERITIES))}.")
    status = _clean(row.get("trang_thai")).lower() or "open"
    if status not in INCIDENT_STATUSES:
        raise ImportError_(f"Trạng thái “{row.get('trang_thai')}” không hợp lệ. Chỉ nhận: {', '.join(sorted(INCIDENT_STATUSES))}.")

    due_at = _parse_datetime_optional(row.get("han_xu_ly"))

    code = _clean(row.get("ma_su_co"))
    existing = db.query(models.Incident).filter(models.Incident.code == code).first() if code else None
    return {
        "_key": code or None, "_action": "update" if existing else "create",
        "id": existing.id if existing else None, "code": code or None,
        "title": title, "site": _clean(row.get("vi_tri")), "severity": severity, "status": status,
        "assignee": _clean(row.get("nguoi_xu_ly")), "description": _clean(row.get("mo_ta")), "due_at": due_at,
    }


def _apply_incident(item, db, models, auth):
    if item["id"]:
        e = db.get(models.Incident, item["id"])
    else:
        e = models.Incident(code=item["code"] or _next_code(db, models.Incident, "SC"))
        db.add(e)
    e.title = item["title"]; e.site = item["site"]; e.severity = item["severity"]; e.status = item["status"]
    e.assignee = item["assignee"]; e.description = item["description"]; e.due_at = item["due_at"]
    if not item["id"]:
        db.flush()   # count() cho mã kế tiếp phải thấy dòng vừa thêm, tránh sinh trùng mã trong cùng đợt nhập


def _check_wo(row, db, models, auth):
    title = _clean(row.get("noi_dung"))
    if not title:
        raise ImportError_("Thiếu nội dung WO.")

    status = _clean(row.get("trang_thai")).lower() or "new"
    if status not in WO_STATUSES:
        raise ImportError_(f"Trạng thái “{row.get('trang_thai')}” không hợp lệ. Chỉ nhận: {', '.join(sorted(WO_STATUSES))}.")

    due_at = _parse_datetime_optional(row.get("han_xu_ly"))

    code = _clean(row.get("ma_wo"))
    existing = db.query(models.WorkOrder).filter(models.WorkOrder.code == code).first() if code else None
    return {
        "_key": code or None, "_action": "update" if existing else "create",
        "id": existing.id if existing else None, "code": code or None,
        "title": title, "category": _clean(row.get("nhom_cong_viec")), "location": _clean(row.get("dia_diem")),
        "status": status, "assignee": _clean(row.get("nguoi_xu_ly")), "description": _clean(row.get("mo_ta")),
        "due_at": due_at,
    }


def _apply_wo(item, db, models, auth):
    if item["id"]:
        w = db.get(models.WorkOrder, item["id"])
    else:
        w = models.WorkOrder(code=item["code"] or _next_code(db, models.WorkOrder, "WO"))
        db.add(w)
    w.title = item["title"]; w.category = item["category"]; w.location = item["location"]
    w.status = item["status"]; w.assignee = item["assignee"]; w.description = item["description"]
    w.due_at = item["due_at"]
    if not item["id"]:
        db.flush()   # count() cho mã kế tiếp phải thấy dòng vừa thêm, tránh sinh trùng mã trong cùng đợt nhập


def _check_handover(row, db, models, auth):
    shift_date = _parse_date(row.get("ngay_truc"))
    if not shift_date:
        raise ImportError_(f"Ngày trực “{row.get('ngay_truc')}” không đọc được. Dùng dạng 08/08/2026.")
    outgoing = _clean(row.get("nguoi_ban_giao"))
    if not outgoing:
        raise ImportError_("Thiếu người bàn giao.")
    summary = _clean(row.get("noi_dung"))
    if not summary:
        raise ImportError_("Thiếu nội dung bàn giao.")
    shift_name = _clean(row.get("ca_truc")) or "Ca ngày"

    existing = (db.query(models.ShiftHandover)
                .filter(models.ShiftHandover.shift_date == shift_date,
                        models.ShiftHandover.shift_name == shift_name,
                        models.ShiftHandover.outgoing == outgoing).first())
    return {
        "_key": f"{shift_date.isoformat()}|{_key(shift_name)}|{_key(outgoing)}",
        "_action": "update" if existing else "create", "id": existing.id if existing else None,
        "shift_date": shift_date, "shift_name": shift_name, "outgoing": outgoing,
        "incoming": _clean(row.get("nguoi_tiep_nhan")), "summary": summary,
        "open_items": _clean(row.get("ton_dong")), "risks": _clean(row.get("rui_ro")),
        "confirmed": _yes(row.get("da_xac_nhan")),
    }


def _apply_handover(item, db, models, auth):
    h = db.get(models.ShiftHandover, item["id"]) if item["id"] else models.ShiftHandover()
    for f in ("shift_date", "shift_name", "outgoing", "incoming", "summary", "open_items", "risks", "confirmed"):
        setattr(h, f, item[f])
    if not item["id"]:
        db.add(h)


HANDLERS = {
    "users": {"check": _check_user, "apply": _apply_user},
    "people": {"check": _check_person, "apply": _apply_person},
    "schedule": {"check": _check_event, "apply": _apply_event},
    "metrics": {"check": _check_metric, "apply": _apply_metric},
    "candidates": {"check": _check_candidate, "apply": _apply_candidate},
    "center_staffing": {"check": _check_staffing, "apply": _apply_staffing},
    "incidents": {"check": _check_incident, "apply": _apply_incident},
    "work_orders": {"check": _check_wo, "apply": _apply_wo},
    "handovers": {"check": _check_handover, "apply": _apply_handover},
}
