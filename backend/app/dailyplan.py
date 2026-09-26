"""
Đăng ký kế hoạch ngày của các cụm kỹ thuật, nằm trong module Công việc.

Ba phần gắn với nhau:

1. Quân số cụm (dữ liệu cứng, bảng cum_nhan_su) — mốc để đối chiếu số nhân sự
   các mảng huy động trong ngày có vượt quân số thật hay không.

2. Bản đăng ký ngày: mỗi cụm mỗi ngày một bản, chia theo mảng công việc (cơ
   điện, truyền dẫn, kiểm soát, bảo dưỡng, ứng cứu thông tin, tích hợp 4G/5G,
   việc phát sinh nóng). Mỗi mảng ghi: số nhân sự thực hiện, trạm thực hiện,
   công việc thực hiện, ghi chú; cuối ngày cập nhật thêm trạng thái và số trạm
   đã xong để bảng đánh giá nói được kết quả chứ không chỉ nói có đăng ký.

3. Đề xuất việc nóng: đọc khối lượng còn tồn theo từng trung tâm (bảng tiến độ
   của module Công việc) và các nhiệm vụ đã quá hạn, xếp trung tâm nào đang
   nóng nhất lên đầu để cụm biết nên ưu tiên gì khi đăng ký.

Đánh giá và cảnh báo: không có bảng riêng, tất cả tính lại từ bản đăng ký —
thêm bảng tổng hợp sẵn là tự chuốc lấy hai nguồn số liệu lệch nhau.
"""
import datetime as dt
import re
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session, selectinload

from . import models
from .auditlog import log_action
from .database import get_db
from .permissions import require_module

admin_router = APIRouter(prefix="/api/admin", tags=["Kế hoạch ngày của cụm"])

# Danh mục mảng công việc. Khai báo một nơi duy nhất ở đây, giao diện đọc qua
# /ke-hoach-ngay/meta — chép sang phía web là kiểu lỗi đã gặp với danh sách đầu
# việc: sửa một bên, bên kia lệch, không ai biết.
MANG = [
    ("co_dien", "Cơ điện"),
    ("truyen_dan", "Truyền dẫn"),
    ("kiem_soat", "Kiểm soát"),
    ("bao_duong", "Bảo dưỡng"),
    ("ung_cuu", "Ứng cứu thông tin"),
    ("tich_hop_4g", "Tích hợp 4G"),
    ("tich_hop_5g", "Tích hợp 5G"),
    ("phat_sinh", "Phát sinh nóng / khác"),
]
MA_MANG = [m[0] for m in MANG]

# Mã mảng đã bỏ, giữ lại CHỈ để hiển thị: bản đăng ký cũ ghi "tich_hop_45g"
# (4G và 5G gộp làm một). Bỏ hẳn khỏi bảng tra thì những bản ghi đó hiện ra mã
# thô, người đọc không hiểu đó là gì. Đăng ký mới không chọn được mã này nữa.
TEN_MANG_CU = {"tich_hop_45g": "Tích hợp 4G/5G (gộp, bản cũ)"}
TEN_MANG = {**dict(MANG), **TEN_MANG_CU}

# Ba mảng mở sẵn trong màn hình đăng ký và là phạm vi của phần khuyến nghị
# việc nóng. Bốn mảng còn lại vẫn đăng ký được, nhưng phải bấm thêm — mở sẵn
# cả bảy làm màn hình dài gấp đôi trong khi phần lớn ngày chỉ dùng ba mảng này.
MANG_CHINH = ["co_dien", "truyen_dan", "kiem_soat"]

# Mảng đăng ký <-> nhóm đầu việc trong module Công việc. Dùng nhóm THẬT
# (bảng tech_groups) chứ không đoán theo tên đầu việc: danh mục có hơn 80 đầu
# việc như "Home kết nối LAN 100M", "SWAP 1BT đổi UCTT Mesh" — đoán theo chữ
# thì gán bừa vào mảng và khuyến nghị sai ngay từ dòng đầu.
NHOM_CUA_MANG = {
    "co_dien": ["co_dien"],
    "truyen_dan": ["truyen_dan"],
    "kiem_soat": ["kiem_soat_vhkt", "kiem_soat"],
    # Nhóm "Kế hoạch 5G" trong danh mục đầu việc chính là mảng tích hợp 5G.
    # 4G chưa có nhóm riêng: khi phòng lập nhóm cho nó thì thêm mã nhóm vào
    # đây, còn trước mắt nhận theo tên đầu việc (xem TU_KHOA_45G).
    "tich_hop_5g": ["ke_hoach_5g", "tich_hop_5g"],
    "tich_hop_4g": ["ke_hoach_4g", "tich_hop_4g"],
}

# Nhận mảng 4G/5G theo tên đầu việc, chỉ dùng cho đầu việc mà NHÓM không nói
# lên mảng nào. Nhóm luôn thắng: "Triển khai đấu nối 5G năm 2026" thuộc nhóm
# Truyền dẫn thì vẫn là truyền dẫn, không kéo sang tích hợp 5G.
TU_KHOA_45G = [("tich_hop_5g", "5G"), ("tich_hop_4g", "4G")]

# Gợi ý loại công việc cho ô "Công việc thực hiện". Chỉ là gợi ý bấm nhanh,
# người đăng ký vẫn gõ tự do được.
LOAI_CONG_VIEC = ["Bảo dưỡng", "Ứng cứu", "Lắp đặt", "Xử lý sự cố",
                  "Tối ưu", "Kiểm tra", "Thu hồi", "Khác"]

TRANG_THAI = [("chua_lam", "Chưa làm"), ("dang_lam", "Đang làm"), ("xong", "Hoàn thành")]
MA_TRANG_THAI = [t[0] for t in TRANG_THAI]

# Quá bao nhiêu ngày liên tiếp không đăng ký thì chuyển từ nhắc nhở sang phê
# bình. Theo yêu cầu điều hành: quá 3 ngày.
NGAY_PHE_BINH = 3

def _mang_cua_dau_viec(db: Session) -> dict:
    """Mã đầu việc -> mảng đăng ký, tra qua nhóm đầu việc đã khai trong CSDL.

    Quản trị viên đổi tên nhóm được, nên ngoài mã nhóm còn so cả nhãn nhóm với
    tên mảng ("Kiểm soát VHKT" khớp mảng "Kiểm soát"). Nhóm không khớp mảng nào
    thì đầu việc của nhóm đó không vào phần khuyến nghị — thà thiếu còn hơn xếp
    nhầm mảng rồi cử người đi làm sai việc.
    """
    nhom_ra_mang = {}
    for ma_mang, ds_nhom in NHOM_CUA_MANG.items():
        for ma_nhom in ds_nhom:
            nhom_ra_mang[ma_nhom] = ma_mang
    for g in db.query(models.TechGroup).all():
        if g.code in nhom_ra_mang:
            continue
        nhan = (g.label or "").casefold().strip()
        for ma_mang in MANG_CHINH:
            ten = TEN_MANG[ma_mang].casefold()
            if nhan.startswith(ten) or ten in nhan:
                nhom_ra_mang[g.code] = ma_mang
                break
    ra = {}
    for c in db.query(models.TechCategory).all():
        m = nhom_ra_mang.get(c.group_code or "", "")
        if not m:
            nhan = (c.label or "").upper()
            for ma_mang, tu in TU_KHOA_45G:
                if tu in nhan:
                    m = ma_mang
                    break
        ra[c.code] = m
    return ra


def _chuoi(v) -> str:
    return (v or "").strip()


def _so(v, mac_dinh: int = 0) -> int:
    try:
        return max(int(v), 0)
    except (TypeError, ValueError):
        return mac_dinh


def _dem_tram(tram: str) -> int:
    """Đếm số trạm trong ô "trạm thực hiện" — ngăn nhau bởi ; , hoặc xuống dòng."""
    if not tram:
        return 0
    tach = tram.replace("\n", ";").replace(",", ";").split(";")
    return len([t for t in tach if t.strip()])


def _tach_tram(v: str) -> list:
    """Tách ô "trạm thực hiện" thành danh sách mã trạm đã chuẩn hoá.

    Người nhập gõ tay nên cùng một trạm có thể thành "hcm0123", "HCM 0123",
    " HCM0123 ". Chuẩn về CHỮ HOA, bỏ khoảng trắng bên trong, thì thống kê mới
    gom đúng một trạm thành một dòng thay vì ba dòng khác nhau.
    """
    if not v:
        return []
    ra = []
    for phan in re.split(r"[;,\n]", str(v)):
        ma = "".join(phan.split()).upper()
        if ma:
            ra.append(ma)
    return ra


def _dem_user(ds: str) -> int:
    """Đếm mã user trong ô "FT thực hiện" — cùng cách tách với ô trạm."""
    return _dem_tram(ds)


def _ten_trung_tam(db: Session) -> dict:
    return {c.code: c.name for c in db.query(models.InfraCenterCode).all()}


def _ds_cum(db: Session) -> List[str]:
    return [c.code for c in db.query(models.InfraCenterCode).order_by(models.InfraCenterCode.code).all()]


def _ngay(v: Optional[str], mac_dinh: Optional[dt.date] = None) -> dt.date:
    if not v:
        return mac_dinh or models.today()
    try:
        return dt.date.fromisoformat(v)
    except ValueError:
        raise HTTPException(400, f"Ngày “{v}” không đúng dạng YYYY-MM-DD.")


KHOA_TACH_45G = "_system_tach_mang_4g_5g_v1"


def tach_mang_45g_once() -> None:
    """Chuyển bản đăng ký cũ từ mảng gộp "Tích hợp 4G/5G" sang "Tích hợp 5G".

    Toàn bộ đầu việc tích hợp đang có trong danh mục đều là 5G (nhóm "Kế hoạch
    5G"), chưa có đầu việc 4G nào — nên chuyển về 5G là đúng với thực tế, và
    người nhập vẫn sửa lại được từng bản nếu có trường hợp 4G.

    Chạy đúng một lần, đánh dấu bằng site_config để lần khởi động sau không
    đụng lại vào dữ liệu người dùng đã tự sửa.
    """
    from .database import SessionLocal

    db = SessionLocal()
    try:
        if db.query(models.SiteConfig).filter(models.SiteConfig.key == KHOA_TACH_45G).first():
            return
        n = (db.query(models.KeHoachNgayDong)
             .filter(models.KeHoachNgayDong.mang == "tich_hop_45g")
             .update({"mang": "tich_hop_5g"}, synchronize_session=False))
        db.add(models.SiteConfig(key=KHOA_TACH_45G, value=str(n),
                                 label="Tách mảng Tích hợp 4G/5G thành 4G và 5G riêng"))
        db.commit()
    finally:
        db.close()


# ------------------------------------------------------------ Khuôn dữ liệu

class NhanSuIn(BaseModel):
    so_nhan_su: Optional[int] = None        # FT hiện tại
    ft_toi_thieu: Optional[int] = None
    ghi_chu: Optional[str] = None


class DongIn(BaseModel):
    mang: str
    hang_muc: Optional[str] = ""        # mã hạng mục để đẩy số lên báo cáo tháng
    ft_user: Optional[str] = ""
    so_ns: Optional[int] = None             # bỏ trống thì đếm theo ô mã user
    tram: Optional[str] = ""
    so_tram: Optional[int] = None       # bỏ trống thì tự đếm từ ô trạm
    cong_viec: Optional[str] = ""
    ghi_chu: Optional[str] = ""
    trang_thai: Optional[str] = "chua_lam"
    so_tram_xong: Optional[int] = 0


class KeHoachIn(BaseModel):
    ngay: str
    center: str
    ft_truc: Optional[int] = None           # bỏ trống thì lấy FT hiện tại trừ số nghỉ
    ft_nghi_phep: Optional[int] = 0
    ft_nghi_ca: Optional[int] = 0
    ghi_chu_nghi: Optional[str] = ""        # mã user nghỉ phép / nghỉ ca
    ghi_chu: Optional[str] = ""
    dong: List[DongIn] = []


# ------------------------------------------------------------ Quân số cụm

@admin_router.get("/ke-hoach-ngay/meta")
def meta(_=Depends(require_module("daily_plan", "view"))):
    """Danh mục dùng chung cho màn hình đăng ký — mảng, loại công việc, trạng thái."""
    return {
        "mang": [{"ma": m, "ten": t, "chinh": m in MANG_CHINH} for m, t in MANG],
        "mang_chinh": MANG_CHINH,
        "loai_cong_viec": LOAI_CONG_VIEC,
        "trang_thai": [{"ma": m, "ten": t} for m, t in TRANG_THAI],
        "ngay_phe_binh": NGAY_PHE_BINH,
    }


@admin_router.get("/ke-hoach-ngay/hang-muc")
def hang_muc_theo_mang(db: Session = Depends(get_db),
                       _=Depends(require_module("daily_plan", "view"))):
    """Hạng mục định lượng để cụm gắn vào việc làm trong ngày, gom theo mảng.

    Hạng mục thuộc đầu việc nào thì theo mảng của nhóm đầu việc đó, nên ô chọn
    ở mỗi dòng chỉ hiện đúng hạng mục của mảng ấy — 82 hạng mục đổ hết vào một
    ô thì không ai tìm nổi. Hạng mục thuộc nhóm ngoài ba mảng chính vẫn trả về
    dưới khoá "khac" để mảng phụ dùng được.
    """
    from .techtasks import categories, progress_items

    mang_cua = _mang_cua_dau_viec(db)
    nhan_dv = {c.code: c.label for c in categories(db)}
    ra = {m: [] for m in MA_MANG}
    ra["khac"] = []
    for it in progress_items(db):
        dv = it.category_code
        m = mang_cua.get(dv, "")
        khoa = m if m in ra else "khac"
        ra[khoa].append({"ma": it.code, "ten": it.label,
                         "dau_viec": dv, "ten_dau_viec": nhan_dv.get(dv, dv)})
    return ra


@admin_router.get("/ke-hoach-ngay/nhan-su")
def xem_nhan_su(db: Session = Depends(get_db), _=Depends(require_module("daily_plan", "view"))):
    """Quân số từng cụm. Cụm chưa nhập vẫn hiện, số 0 — để nhìn ra chỗ còn thiếu."""
    ten = _ten_trung_tam(db)
    da_co = {r.center: r for r in db.query(models.CumNhanSu).all()}
    ra = []
    for code in _ds_cum(db):
        r = da_co.get(code)
        ra.append({
            "center": code,
            "ten": ten.get(code, code),
            "so_nhan_su": (r.so_nhan_su or 0) if r else 0,
            "ft_toi_thieu": (r.ft_toi_thieu or 0) if r else 0,
            "thieu": max(((r.ft_toi_thieu or 0) - (r.so_nhan_su or 0)) if r else 0, 0),
            "ghi_chu": (r.ghi_chu or "") if r else "",
            "updated_by": (r.updated_by or "") if r else "",
            "updated_at": r.updated_at.isoformat() if r and r.updated_at else None,
        })
    # Cụm đã nhập quân số nhưng không còn trong danh mục mã cụm: vẫn trả về,
    # không giấu dữ liệu đã nhập.
    for code, r in da_co.items():
        if code not in {x["center"] for x in ra}:
            ra.append({"center": code, "ten": ten.get(code, code),
                       "so_nhan_su": r.so_nhan_su or 0,
                       "ft_toi_thieu": r.ft_toi_thieu or 0,
                       "thieu": max((r.ft_toi_thieu or 0) - (r.so_nhan_su or 0), 0),
                       "ghi_chu": r.ghi_chu or "",
                       "updated_by": r.updated_by or "",
                       "updated_at": r.updated_at.isoformat() if r.updated_at else None})
    return ra


@admin_router.put("/ke-hoach-ngay/nhan-su/{center}")
def dat_nhan_su(center: str, data: NhanSuIn, db: Session = Depends(get_db),
                user=Depends(require_module("daily_plan", "update")), request: Request = None):
    code = _chuoi(center).upper()
    if not code:
        raise HTTPException(400, "Chưa chọn cụm.")
    row = db.query(models.CumNhanSu).filter(models.CumNhanSu.center == code).first()
    if row is None:
        row = models.CumNhanSu(center=code)
        db.add(row)
    if data.so_nhan_su is not None:
        row.so_nhan_su = _so(data.so_nhan_su)
    if data.ft_toi_thieu is not None:
        row.ft_toi_thieu = _so(data.ft_toi_thieu)
    if data.ghi_chu is not None:
        row.ghi_chu = _chuoi(data.ghi_chu)
    row.updated_by = getattr(user, "full_name", "") or getattr(user, "username", "")
    db.commit()
    db.refresh(row)
    log_action(db, user, "update", "daily_plan", row.id, f"Quân số cụm {code}", request=request)
    return {"center": row.center, "so_nhan_su": row.so_nhan_su or 0,
            "ft_toi_thieu": row.ft_toi_thieu or 0, "ghi_chu": row.ghi_chu or ""}


# ------------------------------------------------------------ Bản đăng ký

def _out_dong(d: models.KeHoachNgayDong) -> dict:
    return {
        "id": d.id,
        "mang": d.mang,
        "ten_mang": TEN_MANG.get(d.mang, d.mang),
        "hang_muc": d.hang_muc or "",
        "ft_user": d.ft_user or "",
        "so_ns": d.so_ns or 0,
        "tram": d.tram or "",
        "so_tram": d.so_tram or 0,
        "cong_viec": d.cong_viec or "",
        "ghi_chu": d.ghi_chu or "",
        "trang_thai": d.trang_thai or "chua_lam",
        "so_tram_xong": d.so_tram_xong or 0,
        "order_no": d.order_no or 0,
    }


def _out(row: models.KeHoachNgay, ten: dict) -> dict:
    dong = [_out_dong(d) for d in row.dong]
    tong_ns = sum(d["so_ns"] for d in dong)
    tong_tram = sum(d["so_tram"] for d in dong)
    tram_xong = sum(d["so_tram_xong"] for d in dong)
    nghi = (row.ft_nghi_phep or 0) + (row.ft_nghi_ca or 0)
    return {
        "id": row.id,
        "ngay": row.plan_date.isoformat(),
        "center": row.center,
        "ten": ten.get(row.center, row.center),
        "so_nhan_su": row.so_nhan_su or 0,
        "ft_truc": row.ft_truc or 0,
        "ft_nghi_phep": row.ft_nghi_phep or 0,
        "ft_nghi_ca": row.ft_nghi_ca or 0,
        "ft_nghi": nghi,
        "ghi_chu_nghi": row.ghi_chu_nghi or "",
        # Trực + nghỉ nhiều hơn quân số cụm là có chỗ nhập sai; báo chứ không
        # chặn, vì cụm có thể được tăng cường người từ nơi khác.
        "lech_quan_so": bool(row.so_nhan_su and (row.ft_truc or 0) + nghi > row.so_nhan_su),
        "ghi_chu": row.ghi_chu or "",
        "dong": dong,
        "tong_ns": tong_ns,
        "tong_tram": tong_tram,
        "tram_xong": tram_xong,
        # Huy động quá quân số cụm thì báo ngay trên màn hình; không chặn lưu,
        # vì cụm có thể được tăng cường người từ nơi khác.
        "vuot_quan_so": bool(row.so_nhan_su and tong_ns > row.so_nhan_su),
        "created_by": row.created_by or "",
        "updated_by": row.updated_by or "",
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def _truy_van(db: Session):
    return db.query(models.KeHoachNgay).options(selectinload(models.KeHoachNgay.dong))


@admin_router.get("/ke-hoach-ngay")
def danh_sach(ngay: Optional[str] = None, center: Optional[str] = None,
              db: Session = Depends(get_db), _=Depends(require_module("daily_plan", "view"))):
    """Toàn bộ bản đăng ký của một ngày, kèm danh sách cụm chưa đăng ký."""
    d = _ngay(ngay)
    q = _truy_van(db).filter(models.KeHoachNgay.plan_date == d)
    if center:
        q = q.filter(models.KeHoachNgay.center == _chuoi(center).upper())
    rows = q.order_by(models.KeHoachNgay.center).all()
    ten = _ten_trung_tam(db)
    da_dk = {r.center for r in rows}
    cum = _ds_cum(db)
    return {
        "ngay": d.isoformat(),
        "danh_sach": [_out(r, ten) for r in rows],
        "tong_cum": len(cum),
        "da_dang_ky": len(da_dk),
        "chua_dang_ky": [{"center": c, "ten": ten.get(c, c)} for c in cum if c not in da_dk],
    }


@admin_router.get("/ke-hoach-ngay/chi-tiet")
def chi_tiet(center: str, ngay: Optional[str] = None, db: Session = Depends(get_db),
             _=Depends(require_module("daily_plan", "view"))):
    """Bản đăng ký của một cụm trong một ngày.

    Chưa đăng ký thì trả về khuôn trống đủ 7 mảng kèm quân số cụm, để màn hình
    mở ra là điền được ngay, không phải tự dựng khuôn ở phía web.
    """
    code = _chuoi(center).upper()
    d = _ngay(ngay)
    ten = _ten_trung_tam(db)
    row = _truy_van(db).filter(models.KeHoachNgay.plan_date == d,
                               models.KeHoachNgay.center == code).first()
    if row:
        return _out(row, ten)
    ns = db.query(models.CumNhanSu).filter(models.CumNhanSu.center == code).first()
    quan_so = (ns.so_nhan_su or 0) if ns else 0
    return {
        "id": None, "ngay": d.isoformat(), "center": code, "ten": ten.get(code, code),
        "so_nhan_su": quan_so,
        # Mặc định coi như cả cụm đi trực, người nhập chỉ phải sửa số nghỉ.
        "ft_truc": quan_so, "ft_nghi_phep": 0, "ft_nghi_ca": 0, "ft_nghi": 0,
        "ghi_chu_nghi": "", "lech_quan_so": False, "ghi_chu": "",
        "dong": [{"id": None, "mang": m, "ten_mang": t, "hang_muc": "", "ft_user": "", "so_ns": 0,
                  "tram": "", "so_tram": 0, "cong_viec": "", "ghi_chu": "",
                  "trang_thai": "chua_lam", "so_tram_xong": 0, "order_no": i}
                 for i, (m, t) in enumerate(MANG)],
        "tong_ns": 0, "tong_tram": 0, "tram_xong": 0, "vuot_quan_so": False,
        "created_by": "", "updated_by": "", "updated_at": None,
    }


@admin_router.put("/ke-hoach-ngay")
def ghi(data: KeHoachIn, db: Session = Depends(get_db),
        user=Depends(require_module("daily_plan", "create")), request: Request = None):
    """Đăng ký mới hoặc sửa bản đăng ký của cụm trong ngày (ghi đè cả bản).

    Mảng để trống hoàn toàn thì không lưu dòng nào — bản đăng ký chỉ gồm những
    mảng thật sự có việc, nhờ vậy bảng đánh giá không đếm nhầm 7 mảng cho mọi
    cụm.
    """
    code = _chuoi(data.center).upper()
    if not code:
        raise HTTPException(400, "Chưa chọn cụm.")
    d = _ngay(data.ngay)
    ds_cum = set(_ds_cum(db))
    if ds_cum and code not in ds_cum:
        raise HTTPException(400, f"Mã cụm “{code}” không có trong danh mục mã cụm.")

    sach = []
    for i, dg in enumerate(data.dong or []):
        ma = _chuoi(dg.mang)
        if ma not in MA_MANG:
            raise HTTPException(400, f"Mảng công việc “{ma}” không hợp lệ.")
        tram = _chuoi(dg.tram)
        cv = _chuoi(dg.cong_viec)
        ghi_chu = _chuoi(dg.ghi_chu)
        ft_user = _chuoi(dg.ft_user)
        hang_muc = _chuoi(dg.hang_muc)
        # Số người tự đếm theo ô mã user; nhập số tay thì lấy số tay (có người
        # đi cùng mà chưa có tài khoản).
        so_ns = _so(dg.so_ns) if dg.so_ns is not None else _dem_user(ft_user)
        if not (tram or cv or ghi_chu or ft_user or so_ns or hang_muc):
            continue
        tt = _chuoi(dg.trang_thai) or "chua_lam"
        if tt not in MA_TRANG_THAI:
            tt = "chua_lam"
        so_tram = _so(dg.so_tram) if dg.so_tram is not None else _dem_tram(tram)
        sach.append({"mang": ma, "hang_muc": hang_muc, "ft_user": ft_user,
                     "so_ns": so_ns, "tram": tram,
                     "so_tram": so_tram, "cong_viec": cv, "ghi_chu": ghi_chu,
                     "trang_thai": tt,
                     "so_tram_xong": min(_so(dg.so_tram_xong), so_tram) if so_tram else _so(dg.so_tram_xong),
                     "order_no": i})
    if not sach:
        raise HTTPException(400, "Bản đăng ký chưa có mảng nào — nhập ít nhất một mảng công việc.")

    ten_nguoi = getattr(user, "full_name", "") or getattr(user, "username", "")
    row = _truy_van(db).filter(models.KeHoachNgay.plan_date == d,
                               models.KeHoachNgay.center == code).first()
    moi = row is None
    if moi:
        row = models.KeHoachNgay(plan_date=d, center=code, created_by=ten_nguoi)
        db.add(row)
    ns = db.query(models.CumNhanSu).filter(models.CumNhanSu.center == code).first()
    row.so_nhan_su = (ns.so_nhan_su or 0) if ns else 0
    row.ft_nghi_phep = _so(data.ft_nghi_phep)
    row.ft_nghi_ca = _so(data.ft_nghi_ca)
    # Không nhập số trực thì suy ra: quân số cụm trừ số nghỉ. Bắt gõ lại con số
    # máy tự tính được chỉ tạo thêm chỗ để nhập lệch.
    row.ft_truc = (_so(data.ft_truc) if data.ft_truc is not None
                   else max(row.so_nhan_su - row.ft_nghi_phep - row.ft_nghi_ca, 0))
    row.ghi_chu_nghi = _chuoi(data.ghi_chu_nghi)
    row.ghi_chu = _chuoi(data.ghi_chu)
    row.updated_by = ten_nguoi
    row.dong.clear()
    db.flush()
    for d_ in sach:
        row.dong.append(models.KeHoachNgayDong(**d_))
    db.flush()
    # Đẩy số trạm đã xong lên số Thực hiện của tháng ngay trong cùng một lần
    # ghi: tách ra chạy sau thì có lúc ghi được bản đăng ký mà không cộng được
    # số tháng, và không ai biết để chạy lại.
    day_len = _don_lai_so_thang(db, code, d)
    db.commit()
    db.refresh(row)
    log_action(db, user, "create" if moi else "update", "daily_plan", row.id,
               f"Kế hoạch ngày {d.isoformat()} — cụm {code}", request=request)
    ra = _out(row, _ten_trung_tam(db))
    ra["day_len_bao_cao_thang"] = day_len
    return ra


@admin_router.delete("/ke-hoach-ngay/{plan_id}")
def xoa(plan_id: int, db: Session = Depends(get_db),
        user=Depends(require_module("daily_plan", "delete")), request: Request = None):
    row = db.query(models.KeHoachNgay).filter(models.KeHoachNgay.id == plan_id).first()
    if not row:
        raise HTTPException(404, "Không tìm thấy bản đăng ký.")
    ten = f"Kế hoạch ngày {row.plan_date.isoformat()} — cụm {row.center}"
    center, ngay = row.center, row.plan_date
    db.delete(row)
    db.flush()
    # Xoá bản đăng ký thì phải trả lại phần số tháng đã cộng từ nó, nếu không
    # số thực hiện của tháng còn lại phần của một ngày không còn tồn tại.
    _don_lai_so_thang(db, center, ngay)
    db.commit()
    log_action(db, user, "delete", "daily_plan", plan_id, ten, request=request)
    return {"deleted": plan_id}


def _dau_thang(d: dt.date) -> dt.date:
    return d.replace(day=1)


def _cuoi_thang(d: dt.date) -> dt.date:
    return (d.replace(day=28) + dt.timedelta(days=4)).replace(day=1) - dt.timedelta(days=1)


def _don_lai_so_thang(db: Session, center: str, trong_ngay: dt.date) -> list:
    """Cộng số trạm làm xong trong tháng của một cụm lên số Thực hiện của tháng.

    Vì sao phải có: số Thực hiện theo tháng trước nay phải có người ngồi chốt
    tay, nên thực tế không ai chốt — bốn nhóm đầu việc có kế hoạch 24.186 mà
    Thực hiện bằng 0. Nay cụm chỉ nhập một lần lúc chốt kết quả cuối ngày, số
    tháng tự cộng lên từ đó.

    Cách cộng để lưu bao nhiêu lần cũng ra một con số: mỗi dòng số liệu tháng
    ghi riêng ở cột done_ngay phần đã nhận từ kế hoạch ngày. Mỗi lần tính lại,
    chỉ cộng vào done_qty đúng phần CHÊNH so với lần trước. Nhờ vậy sửa đi sửa
    lại bản đăng ký không nhân đôi số, và phần ai đó nhập tay/nhập Excel vẫn
    còn nguyên.

    Trả về danh sách thay đổi để ghi nhật ký và hiện lại cho người nhập.
    """
    from .techtasks import item_category

    ky = trong_ngay.strftime("%Y-%m")
    d1, d2 = _dau_thang(trong_ngay), _cuoi_thang(trong_ngay)
    thuoc = item_category(db)

    # Tổng số trạm đã xong trong tháng, theo từng hạng mục
    tong = {}
    dong = (db.query(models.KeHoachNgayDong)
            .join(models.KeHoachNgay,
                  models.KeHoachNgayDong.ke_hoach_id == models.KeHoachNgay.id)
            .filter(models.KeHoachNgay.center == center,
                    models.KeHoachNgay.plan_date >= d1,
                    models.KeHoachNgay.plan_date <= d2,
                    models.KeHoachNgayDong.hang_muc.isnot(None),
                    models.KeHoachNgayDong.hang_muc != "")
            .all())
    for d in dong:
        tong[d.hang_muc] = tong.get(d.hang_muc, 0.0) + (d.so_tram_xong or 0)

    # Cả những hạng mục THÁNG TRƯỚC ĐÓ đã nhận số từ ngày nhưng nay không còn
    # dòng nào trỏ tới (người nhập đổi hạng mục, hoặc xoá bản đăng ký) — phải
    # trả lại phần đã cộng, nếu không số cũ nằm lại vĩnh viễn.
    da_nhan = (db.query(models.ProgressEntry)
               .filter(models.ProgressEntry.center == center,
                       models.ProgressEntry.period == ky,
                       models.ProgressEntry.ft_name.is_(None),
                       models.ProgressEntry.done_ngay.isnot(None),
                       models.ProgressEntry.done_ngay != 0)
               .all())

    thay_doi = []
    for item in set(tong) | {r.item for r in da_nhan}:
        moi = round(tong.get(item, 0.0), 1)
        row = next((r for r in da_nhan if r.item == item), None)
        if row is None:
            row = (db.query(models.ProgressEntry)
                   .filter(models.ProgressEntry.center == center,
                           models.ProgressEntry.period == ky,
                           models.ProgressEntry.item == item,
                           models.ProgressEntry.ft_name.is_(None))
                   .first())
        if row is None:
            if not moi:
                continue
            cat = thuoc.get(item)
            if not cat:
                continue      # hạng mục không còn thuộc đầu việc nào -> bỏ qua
            row = models.ProgressEntry(category=cat, item=item, period=ky,
                                       center=center, plan_qty=0, done_qty=0,
                                       bkk_qty=0, done_ngay=0,
                                       note="Tự cộng từ kế hoạch ngày của cụm")
            db.add(row)
        # Kẹp phần đã ghi nhận không vượt quá chính số Thực hiện đang có: nếu ai
        # đó sửa tay số tháng xuống thấp hơn phần kế hoạch ngày đã cộng, phần
        # "nhập tay" suy ra sẽ âm và những lần cộng sau ra số vô nghĩa.
        cu = min(row.done_ngay or 0, row.done_qty or 0)
        if abs(moi - cu) < 0.001:
            if (row.done_ngay or 0) != cu:
                row.done_ngay = cu       # ghi lại cho khớp, không đổi số Thực hiện
            continue
        row.done_qty = round(max((row.done_qty or 0) + (moi - cu), 0), 1)
        row.done_ngay = moi
        thay_doi.append({"item": item, "truoc": cu, "sau": moi,
                         "thuc_hien": row.done_qty})
    return thay_doi


# ------------------------------------------------------- Đề xuất việc nóng

def _ton_theo_trung_tam(db: Session) -> dict:
    """Khối lượng còn tồn của kỳ gần nhất, gom theo trung tâm rồi theo đầu việc.

    Đọc đúng cách mà tab Phân tích của module Công việc đang đọc: chỉ lấy dòng
    tổng theo trung tâm (ft_name rỗng), và chỉ lấy kỳ mới nhất của từng đầu
    việc — đầu việc cập nhật chậm hơn không bị hiểu là tồn bằng 0.
    """
    from .techtasks import categories, item_category

    thuoc = item_category(db)
    nhan = {c.code: c.label for c in categories(db)}
    uu_tien = {c.code: (c.uu_tien or "") for c in categories(db)}
    mang_cua = _mang_cua_dau_viec(db)
    dong = db.query(models.ProgressEntry).filter(models.ProgressEntry.ft_name.is_(None)).all()

    ky_moi = {}
    for r in dong:
        dv = thuoc.get(r.item)
        if dv and r.period and r.period > ky_moi.get(dv, ""):
            ky_moi[dv] = r.period

    ra = {}
    for r in dong:
        dv = thuoc.get(r.item)
        if not dv or r.period != ky_moi.get(dv):
            continue
        ton = max((r.plan_qty or 0) - (r.bkk_qty or 0) - (r.done_qty or 0), 0)
        if ton <= 0:
            continue
        mang = mang_cua.get(dv, "")
        # Chỉ khuyến nghị trong phạm vi ba mảng đang theo dõi; đầu việc thuộc
        # nhóm khác (CĐBR, Hoàn công, QL tài sản...) không đưa vào.
        if mang not in MANG_CHINH:
            continue
        o = ra.setdefault(r.center, {})
        m = o.setdefault(dv, {"category": dv, "label": nhan.get(dv, dv), "ton": 0.0,
                              "period": r.period, "mang": mang,
                              "uu_tien": uu_tien.get(dv, ""), "hang_muc": {}})
        m["ton"] += ton
        m["hang_muc"][r.item] = m["hang_muc"].get(r.item, 0.0) + ton
    return ra


def _viec_qua_han(db: Session, hom_nay: dt.date) -> dict:
    """Nhiệm vụ đã quá hạn mà chưa xong, gom theo đơn vị được chia việc.

    Việc không chia cho đơn vị nào gom vào khoá "" (mức chi nhánh) — vẫn phải
    hiện ra, nếu không thì việc quá hạn của cả phòng biến mất khỏi đề xuất.
    """
    q = (db.query(models.TechTask)
         .options(selectinload(models.TechTask.units))
         .filter(models.TechTask.deleted_at.is_(None),
                 models.TechTask.status != "done",
                 models.TechTask.due_at.isnot(None),
                 models.TechTask.due_at < hom_nay))
    mang_cua = _mang_cua_dau_viec(db)
    from .techtasks import categories as _cats
    uu_tien_dv = {c.code: (c.uu_tien or "") for c in _cats(db)}
    ra = {}
    for t in q.all():
        mang = mang_cua.get(t.category, "")
        if mang not in MANG_CHINH:
            continue
        tre = (hom_nay - t.due_at).days
        chung = {"id": t.id, "title": t.title, "category": t.category,
                 "due_at": t.due_at.isoformat(), "tre_ngay": tre,
                 "priority": t.priority or "trung_binh",
                 "assignee": t.assignee or "", "mang": mang,
                 "uu_tien": uu_tien_dv.get(t.category, "")}
        don_vi = [u.unit_name for u in t.units if _chuoi(u.unit_name)]
        for dv in don_vi or [""]:
            ra.setdefault(_chuoi(dv).upper() if dv else "", []).append(chung)
    return ra


@admin_router.get("/ke-hoach-ngay/de-xuat")
def de_xuat(ngay: Optional[str] = None, db: Session = Depends(get_db),
            _=Depends(require_module("daily_plan", "view"))):
    """Trung tâm/khu vực nào nên ưu tiên việc gì trong ngày.

    Căn cứ: khối lượng còn tồn theo trung tâm và các nhiệm vụ đã quá hạn. Trung
    tâm đã đăng ký trong ngày vẫn hiện, có cờ "da_dang_ky" để người điều hành
    biết đề xuất này đã được tiếp nhận hay chưa.
    """
    d = _ngay(ngay)
    ten = _ten_trung_tam(db)
    ton = _ton_theo_trung_tam(db)
    qua_han = _viec_qua_han(db, d)
    da_dk = {r.center for r in db.query(models.KeHoachNgay)
             .filter(models.KeHoachNgay.plan_date == d).all()}

    # Bảng tiến độ có mã "CN" giữ phần kế hoạch chưa chia về cụm nào, và có thể
    # còn mã lạ do nhập tay. Không xếp chúng lẫn vào danh sách trung tâm: nút
    # "Đăng ký" ở dòng đó chắc chắn lỗi vì không phải cụm thật. Gom riêng ở
    # dưới, vẫn hiện ra chứ không giấu khối lượng đi.
    la_cum = set(_ds_cum(db))
    ra, ngoai_cum = [], []
    for code in sorted(set(list(ton.keys()) + [k for k in qua_han if k])):
        dau_viec = sorted(ton.get(code, {}).values(), key=lambda x: -x["ton"])
        viec = sorted(qua_han.get(code, []), key=lambda x: -x["tre_ngay"])
        tong_ton = round(sum(x["ton"] for x in dau_viec), 1)
        if not tong_ton and not viec:
            continue
        if la_cum and code not in la_cum:
            gom = {m: 0.0 for m in MANG_CHINH}
            for x in dau_viec:
                if x["mang"] in gom:
                    gom[x["mang"]] += x["ton"]
            ngoai_cum.append({"center": code, "ton": tong_ton,
                              "so_viec_qua_han": len(viec),
                              "theo_mang": [{"mang": m, "ten_mang": TEN_MANG[m], "ton": round(v, 1)}
                                            for m, v in gom.items() if v],
                              "dau_viec": [{k: v for k, v in x.items() if k != "hang_muc"}
                                           | {"ton": round(x["ton"], 1)} for x in dau_viec[:5]]})
            continue
        # Nóng: còn việc quá hạn, hoặc tồn lớn. Ngưỡng tồn lấy theo mặt bằng
        # chung của chính ngày đó (tính sau), tạm ghi số để xếp hạng.
        # Tồn tách theo ba mảng, để người điều hành thấy ngay nên cử tổ nào đi
        # chứ không phải tự cộng nhẩm từ danh sách đầu việc.
        theo_mang = {m: 0.0 for m in MANG_CHINH}
        for x in dau_viec:
            if x["mang"] in theo_mang:
                theo_mang[x["mang"]] += x["ton"]
        # Hạng mục tồn nhiều nhất của từng mảng: mở form đăng ký từ dòng này
        # thì ô Hạng mục được chọn sẵn, người nhập chỉ còn điền người và trạm.
        # Không có nó thì 82 hạng mục nằm trong ô xổ xuống, không ai chọn, và
        # số ngày lại không đẩy lên được số tháng.
        goi_y = {}
        for x in dau_viec:
            if x["mang"] not in MANG_CHINH or not x.get("hang_muc"):
                continue
            hm, sl = max(x["hang_muc"].items(), key=lambda kv: kv[1])
            if sl > goi_y.get(x["mang"], (None, 0))[1]:
                goi_y[x["mang"]] = (hm, sl)
        # Mức ưu tiên cao nhất trong số đầu việc còn tồn của trung tâm này —
        # dùng để xếp trung tâm nào phải xử lý trước, và để lọc theo mức.
        thu_tu_ut = {"khan_cap": 0, "ut1": 1, "ut2": 2, "ut3": 3, "": 9}
        muc_ut = min((thu_tu_ut.get(x.get("uu_tien", ""), 9) for x in dau_viec), default=9)
        ten_ut = next((k for k, v in thu_tu_ut.items() if v == muc_ut), "")
        ra.append({
            "center": code, "ten": ten.get(code, code),
            "ton": tong_ton,
            "uu_tien": ten_ut,
            "goi_y_hang_muc": {m: hm for m, (hm, _sl) in goi_y.items()},
            "theo_mang": [{"mang": m, "ten_mang": TEN_MANG[m], "ton": round(v, 1)}
                          for m, v in theo_mang.items()],
            "so_viec_qua_han": len(viec),
            "tre_nhat": max((x["tre_ngay"] for x in viec), default=0),
            "dau_viec": [{k: v for k, v in x.items() if k != "hang_muc"}
                         | {"ton": round(x["ton"], 1), "ten_mang": TEN_MANG.get(x["mang"], "")}
                         for x in dau_viec[:5]],
            "viec_qua_han": [{**x, "ten_mang": TEN_MANG.get(x["mang"], "")} for x in viec[:5]],
            "da_dang_ky": code in da_dk,
        })

    # Xếp hạng nóng: việc quá hạn nặng hơn tồn, vì đã trễ hạn cam kết.
    # Ưu tiên điều hành đứng trước, rồi mới tới quá hạn và tồn: việc khẩn cấp
    # của một trung tâm ít tồn vẫn phải làm trước việc thường của nơi tồn nhiều.
    thu_tu = {"khan_cap": 0, "ut1": 1, "ut2": 2, "ut3": 3, "": 9}
    ra.sort(key=lambda x: (thu_tu.get(x.get("uu_tien", ""), 9),
                           -x["so_viec_qua_han"], -x["tre_nhat"], -x["ton"]))
    nguong = 0.0
    if ra:
        ds_ton = sorted((x["ton"] for x in ra), reverse=True)
        nguong = ds_ton[max(len(ds_ton) // 3 - 1, 0)]      # tốp 1/3 tồn cao nhất
    for x in ra:
        x["muc_do"] = ("nong" if x["so_viec_qua_han"] else
                       "canh_bao" if x["ton"] >= nguong > 0 else "binh_thuong")
        phan = []
        if x["so_viec_qua_han"]:
            phan.append(f"{x['so_viec_qua_han']} việc quá hạn (trễ nhất {x['tre_nhat']} ngày)")
        if x["ton"]:
            theo = ", ".join(f"{m['ten_mang']} {m['ton']}" for m in x["theo_mang"] if m["ton"])
            phan.append(f"tồn {x['ton']} ({theo})" if theo else f"tồn {x['ton']}")
        x["de_xuat"] = "Ưu tiên: " + "; ".join(phan) if phan else ""

    chung = sorted(qua_han.get("", []), key=lambda x: -x["tre_ngay"])
    return {
        "ngay": d.isoformat(),
        "trung_tam": ra,
        # Việc quá hạn chưa chia về trung tâm nào — của cả chi nhánh.
        "chua_chia_don_vi": [{**x, "ten_mang": TEN_MANG.get(x["mang"], "")} for x in chung[:10]],
        # Khối lượng mang mã không phải cụm ("CN" — chưa chia cụm, hoặc mã lạ).
        "ngoai_cum": sorted(ngoai_cum, key=lambda x: -x["ton"]),
    }


# --------------------------------------------------- Đánh giá các trung tâm

# ------------------------------------------------------------ Danh mục trạm

class NhapTramIn(BaseModel):
    # Mỗi dòng: mã trạm, mã cụm, tên trạm, loại — ngăn nhau bởi dấu phẩy hoặc TAB.
    noi_dung: str = ""
    ghi_de: bool = True          # trạm đã có thì cập nhật lại cụm/tên


@admin_router.get("/ke-hoach-ngay/danh-muc-tram")
def xem_danh_muc_tram(center: Optional[str] = None, q: Optional[str] = None,
                      db: Session = Depends(get_db),
                      _=Depends(require_module("daily_plan", "view"))):
    """Danh mục trạm, để đối chiếu mã trạm trong bản đăng ký với cụm quản lý."""
    truy = db.query(models.DanhMucTram)
    if center:
        truy = truy.filter(models.DanhMucTram.center == _chuoi(center).upper())
    tim = _chuoi(q).upper()
    if tim:
        truy = truy.filter(models.DanhMucTram.ma_tram.contains(tim))
    rows = truy.order_by(models.DanhMucTram.center, models.DanhMucTram.ma_tram).limit(3000).all()
    ten_tt = _ten_trung_tam(db)
    theo_cum = {}
    for r in db.query(models.DanhMucTram).all():
        theo_cum[r.center or ""] = theo_cum.get(r.center or "", 0) + 1
    return {
        "tong": db.query(models.DanhMucTram).count(),
        "theo_cum": [{"center": k or "(chua gan cum)", "ten": ten_tt.get(k, ""), "so_tram": v}
                     for k, v in sorted(theo_cum.items())],
        "danh_sach": [{"ma_tram": r.ma_tram, "center": r.center or "", "ten": r.ten or "",
                       "loai": r.loai or "", "note": r.note or ""} for r in rows],
    }


@admin_router.post("/ke-hoach-ngay/danh-muc-tram/nhap")
def nhap_danh_muc_tram(data: NhapTramIn, db: Session = Depends(get_db),
                       user=Depends(require_module("daily_plan", "update")),
                       request: Request = None):
    """Nhập danh mục trạm bằng cách dán từ Excel: mỗi dòng một trạm.

    Cột: mã trạm, mã cụm, tên trạm, loại. Chỉ cột đầu bắt buộc. Dòng lỗi được
    trả về kèm số dòng chứ không chặn cả mẻ — dán hai nghìn trạm mà hỏng vì một
    dòng thì không ai nhập nổi.
    """
    ds_cum = set(_ds_cum(db))
    them = sua = 0
    loi = []
    da_thay = set()
    for i, dong in enumerate((data.noi_dung or "").splitlines(), start=1):
        if not dong.strip():
            continue
        phan = [p.strip() for p in dong.replace("\t", ",").split(",")]
        ma = "".join(phan[0].split()).upper() if phan else ""
        if not ma:
            continue
        if ma in da_thay:
            loi.append("Dòng %d: mã trạm “%s” lặp ngay trong nội dung dán." % (i, ma))
            continue
        da_thay.add(ma)
        cum = (phan[1].strip().upper() if len(phan) > 1 else "")
        if cum and ds_cum and cum not in ds_cum:
            loi.append("Dòng %d: mã cụm “%s” không có trong danh mục mã cụm." % (i, cum))
            continue
        row = db.query(models.DanhMucTram).filter(models.DanhMucTram.ma_tram == ma).first()
        if row is not None and not data.ghi_de:
            continue
        if row is None:
            row = models.DanhMucTram(ma_tram=ma)
            db.add(row)
            them += 1
        else:
            sua += 1
        row.center = cum or None
        if len(phan) > 2 and phan[2]:
            row.ten = phan[2][:200]
        if len(phan) > 3 and phan[3]:
            row.loai = phan[3][:60]
        row.updated_by = getattr(user, "full_name", "") or getattr(user, "username", "")
    db.commit()
    log_action(db, user, "update", "daily_plan", None,
               "Nhập danh mục trạm: thêm %d, cập nhật %d" % (them, sua), request=request)
    return {"them": them, "sua": sua, "loi": loi[:50],
            "tong": db.query(models.DanhMucTram).count()}


@admin_router.delete("/ke-hoach-ngay/danh-muc-tram/{ma_tram}")
def xoa_tram(ma_tram: str, db: Session = Depends(get_db),
             user=Depends(require_module("daily_plan", "delete")), request: Request = None):
    ma = "".join(_chuoi(ma_tram).split()).upper()
    row = db.query(models.DanhMucTram).filter(models.DanhMucTram.ma_tram == ma).first()
    if not row:
        raise HTTPException(404, "Không tìm thấy trạm trong danh mục.")
    db.delete(row)
    db.commit()
    log_action(db, user, "delete", "daily_plan", None,
               "Xoá trạm %s khỏi danh mục" % ma, request=request)
    return {"deleted": ma}


# -------------------------------------------------- Trạm thực hiện theo cụm

@admin_router.get("/ke-hoach-ngay/theo-tram")
def theo_tram(tu: Optional[str] = None, den: Optional[str] = None,
              center: Optional[str] = None, q: Optional[str] = None,
              chi_bat_thuong: bool = False,
              db: Session = Depends(get_db),
              _=Depends(require_module("daily_plan", "view"))):
    """Từng trạm đã đăng ký thực hiện: cụm nào làm, mấy lượt, ngày nào, xong chưa.

    Bốn dấu hiệu bất thường đánh ngay trên dòng, vì đó là thứ người điều hành soi:

    - sai_cum: mã trạm có trong danh mục nhưng thuộc cụm khác — làm nhầm địa
      bàn, hoặc gõ nhầm mã.
    - ngoai_danh_muc: mã trạm không có trong danh mục. Chỉ báo khi danh mục đã
      có dữ liệu; danh mục trống thì không kết luận gì.
    - nhieu_cum: từ hai cụm trở lên cùng khai một trạm trong kỳ — chồng chéo.
    - lap_lai: một trạm khai từ ba lượt trở lên mà chưa lần nào xong — làm mãi
      không dứt điểm.
    """
    from .techtasks import item_labels

    d2 = _ngay(den)
    d1 = _ngay(tu, d2 - dt.timedelta(days=6))
    if d1 > d2:
        d1, d2 = d2, d1
    if (d2 - d1).days > 366:
        raise HTTPException(400, "Khoảng ngày quá dài — chọn tối đa 1 năm.")
    loc_cum = _chuoi(center).upper()
    tim = "".join(_chuoi(q).split()).upper()

    truy = (_truy_van(db)
            .filter(models.KeHoachNgay.plan_date >= d1, models.KeHoachNgay.plan_date <= d2))
    if loc_cum:
        truy = truy.filter(models.KeHoachNgay.center == loc_cum)
    rows = truy.all()

    danh_muc = {r.ma_tram: r for r in db.query(models.DanhMucTram).all()}
    co_danh_muc = bool(danh_muc)
    nhan_hm = item_labels(db)
    ten_tt = _ten_trung_tam(db)

    tram = {}
    for r in rows:
        for d in r.dong:
            ds = _tach_tram(d.tram)
            if not ds:
                continue
            # Ô "số trạm xong" chỉ là MỘT CON SỐ, không nói trạm nào xong. Ở đây
            # quy ước tính cho các trạm đầu danh sách, và nói rõ quy ước đó ra
            # giao diện — để không ai đọc dấu tích như một khẳng định chắc chắn.
            so_xong = min(d.so_tram_xong or 0, len(ds))
            for vt, ma in enumerate(ds):
                o = tram.setdefault(ma, {
                    "luot": 0, "luot_xong": 0, "cum": {}, "ngay": set(),
                    "mang": set(), "hang_muc": set(),
                })
                o["luot"] += 1
                if vt < so_xong:
                    o["luot_xong"] += 1
                o["cum"][r.center] = o["cum"].get(r.center, 0) + 1
                o["ngay"].add(r.plan_date)
                o["mang"].add(d.mang)
                if d.hang_muc:
                    o["hang_muc"].add(d.hang_muc)

    ra = []
    for ma, o in tram.items():
        if tim and tim not in ma:
            continue
        dm = danh_muc.get(ma)
        cums = sorted(o["cum"])
        # Sai cụm tính theo từng cặp trạm–cụm, không theo trạm: một trạm của
        # CHP mà THA cũng khai thì THA sai, kể cả khi CHP có khai trạm đó.
        # Tính theo trạm thì cặp sai bị chính cụm đúng che mất.
        cum_sai = [c for c in cums if dm and dm.center and c != dm.center]
        sai_cum = bool(cum_sai)
        ngoai = bool(co_danh_muc and not dm)
        nhieu_cum = len(cums) > 1
        lap_lai = o["luot"] >= 3 and o["luot_xong"] == 0
        if chi_bat_thuong and not (sai_cum or ngoai or nhieu_cum or lap_lai):
            continue
        ra.append({
            "ma_tram": ma,
            "ten": (dm.ten or "") if dm else "",
            "cum_quan_ly": (dm.center or "") if dm else "",
            "cum_thuc_hien": cums,
            "cum_sai": cum_sai,
            "luot": o["luot"], "luot_xong": o["luot_xong"],
            "so_ngay": len(o["ngay"]),
            "ngay_dau": min(o["ngay"]).isoformat(),
            "ngay_cuoi": max(o["ngay"]).isoformat(),
            "ten_mang": [TEN_MANG.get(m, m) for m in sorted(o["mang"])],
            "hang_muc": [nhan_hm.get(h, h) for h in sorted(o["hang_muc"])],
            "sai_cum": sai_cum, "ngoai_danh_muc": ngoai,
            "nhieu_cum": nhieu_cum, "lap_lai": lap_lai,
        })
    ra.sort(key=lambda x: (not (x["sai_cum"] or x["nhieu_cum"] or x["lap_lai"]),
                           -x["luot"], x["ma_tram"]))

    # Gom theo cụm thực hiện: một trạm hai cụm cùng làm thì tính cho cả hai.
    theo_cum = {}
    for x in ra:
        for c in x["cum_thuc_hien"]:
            o = theo_cum.setdefault(c, {"center": c, "ten": ten_tt.get(c, c), "so_tram": 0,
                                        "luot": 0, "xong": 0, "sai_cum": 0,
                                        "ngoai_danh_muc": 0, "lap_lai": 0})
            o["so_tram"] += 1
            o["luot"] += x["luot"]
            o["xong"] += x["luot_xong"]
            # Chỉ tính sai cho đúng cụm đã làm nhầm, không tính cho cụm chủ quản
            # cũng có mặt trên trạm đó.
            o["sai_cum"] += 1 if c in x["cum_sai"] else 0
            o["ngoai_danh_muc"] += 1 if x["ngoai_danh_muc"] else 0
            o["lap_lai"] += 1 if x["lap_lai"] else 0

    return {
        "tu": d1.isoformat(), "den": d2.isoformat(),
        "co_danh_muc": co_danh_muc, "so_tram_danh_muc": len(danh_muc),
        "tong": {
            "so_tram": len(ra),
            "luot": sum(x["luot"] for x in ra),
            "xong": sum(x["luot_xong"] for x in ra),
            "sai_cum": len([x for x in ra if x["sai_cum"]]),
            "ngoai_danh_muc": len([x for x in ra if x["ngoai_danh_muc"]]),
            "nhieu_cum": len([x for x in ra if x["nhieu_cum"]]),
            "lap_lai": len([x for x in ra if x["lap_lai"]]),
        },
        "theo_cum": sorted(theo_cum.values(), key=lambda x: -x["so_tram"]),
        "danh_sach": ra[:1000],
    }


def _dong_theo_cum(ma, o, mt, ten_tt, quan_so, ty_le):
    """Một dòng của bảng "theo cụm": khối lượng đã đăng ký đặt cạnh mục tiêu tháng.

    Hai cờ trả lời thẳng câu "có đúng mục tiêu không":
    - bo_muc_tieu: còn tồn mà kỳ này không đăng ký lượt nào ở mảng đang xét.
    - ngoai_muc_tieu: có đăng ký nhưng mảng đó không có kế hoạch tháng nào cho
      cụm này — làm việc nằm ngoài chỉ tiêu, hoặc kế hoạch chưa được chia về cụm.
    """
    o = o or {"ns": 0, "tram": 0, "xong": 0, "ngay": set()}
    mt = mt or {"ke_hoach": 0.0, "thuc_hien": 0.0, "bkk": 0.0}
    phai_lam = max(mt["ke_hoach"] - mt["bkk"], 0)
    ton = max(phai_lam - mt["thuc_hien"], 0)
    so_ngay_dk = len(o["ngay"])
    return {
        "center": ma, "ten": ten_tt.get(ma, ma),
        "so_ngay_dang_ky": so_ngay_dk,
        "ns": o["ns"], "tram": o["tram"], "xong": o["xong"], "ty_le": ty_le(o),
        "ft": quan_so.get(ma, 0),
        # Năng suất: trạm làm xong trên mỗi FT hiện có của cụm, tính trên số
        # ngày cụm đó có đăng ký — so được giữa cụm 12 người và cụm 3 người,
        # điều mà số trạm tuyệt đối không nói ra.
        "nang_suat": (round(o["xong"] / quan_so[ma] / so_ngay_dk, 2)
                      if quan_so.get(ma) and so_ngay_dk else None),
        "ke_hoach_thang": round(mt["ke_hoach"], 1),
        "thuc_hien_thang": round(mt["thuc_hien"], 1),
        "ton_thang": round(ton, 1),
        "ty_le_thang": round(mt["thuc_hien"] / phai_lam, 4) if phai_lam else None,
        "bo_muc_tieu": bool(ton > 0 and not o["tram"]),
        "ngoai_muc_tieu": bool(o["tram"] and not mt["ke_hoach"]),
    }


@admin_router.get("/ke-hoach-ngay/tong-hop")
def tong_hop_khoi_luong(tu: Optional[str] = None, den: Optional[str] = None,
                        center: Optional[str] = None, mang: Optional[str] = None,
                        db: Session = Depends(get_db),
                        _=Depends(require_module("daily_plan", "view"))):
    """Cộng khối lượng các cụm đã đăng ký trong một khoảng ngày.

    Bốn cách nhìn cùng một số liệu: theo ngày (nhịp làm việc), theo mảng (mảng
    nào đang gánh), theo cụm (ai làm nhiều, năng suất trên đầu FT), theo hạng
    mục (khối lượng thật, đối chiếu ngược lên kế hoạch tháng).

    Bảng theo hạng mục là chỗ đáng xem nhất: nó đặt cạnh nhau số trạm cụm khai
    trong ngày, số đã đẩy lên báo cáo tháng, và kế hoạch tháng của chính hạng
    mục đó — lệch nhau ở đâu là thấy ngay, thay vì tin rằng hai bên khớp.
    """
    from .techtasks import categories, item_labels, item_category

    d2 = _ngay(den)
    d1 = _ngay(tu, d2 - dt.timedelta(days=6))
    if d1 > d2:
        d1, d2 = d2, d1
    if (d2 - d1).days > 366:
        raise HTTPException(400, "Khoảng ngày quá dài — chọn tối đa 1 năm.")
    loc_cum = _chuoi(center).upper()
    loc_mang = _chuoi(mang)
    if loc_mang and loc_mang not in MA_MANG:
        raise HTTPException(400, f"Mảng công việc “{loc_mang}” không hợp lệ.")

    q = (_truy_van(db)
         .filter(models.KeHoachNgay.plan_date >= d1, models.KeHoachNgay.plan_date <= d2))
    if loc_cum:
        q = q.filter(models.KeHoachNgay.center == loc_cum)
    rows = q.all()

    ten_tt = _ten_trung_tam(db)
    quan_so = {r.center: (r.so_nhan_su or 0) for r in db.query(models.CumNhanSu).all()}
    nhan_hm = item_labels(db)
    thuoc = item_category(db)
    nhan_dv = {c.code: c.label for c in categories(db)}

    def khung():
        return {"ns": 0, "tram": 0, "xong": 0, "so_dong": 0}

    tong = {**khung(), "so_ban": 0, "ft_truc": 0, "ft_nghi": 0, "cum": set(), "ngay": set()}
    theo_ngay, theo_mang, theo_cum, theo_hm = {}, {}, {}, {}

    for r in rows:
        dong = [d for d in r.dong if not loc_mang or d.mang == loc_mang]
        if loc_mang and not dong:
            continue                      # bản đăng ký không có mảng đang lọc
        tong["so_ban"] += 1
        tong["cum"].add(r.center)
        tong["ngay"].add(r.plan_date)
        # Quân số trực/nghỉ ghi ở mức cụm nên chỉ cộng khi không lọc theo mảng;
        # lọc mảng mà vẫn cộng thì một người trực bị đếm cho mọi mảng.
        if not loc_mang:
            tong["ft_truc"] += r.ft_truc or 0
            tong["ft_nghi"] += (r.ft_nghi_phep or 0) + (r.ft_nghi_ca or 0)

        n = theo_ngay.setdefault(r.plan_date, {**khung(), "cum": set()})
        c = theo_cum.setdefault(r.center, {**khung(), "ngay": set()})
        n["cum"].add(r.center)
        c["ngay"].add(r.plan_date)

        for d in dong:
            ns, tram, xong = d.so_ns or 0, d.so_tram or 0, d.so_tram_xong or 0
            for o in (tong, n, c):
                o["ns"] += ns; o["tram"] += tram; o["xong"] += xong; o["so_dong"] += 1
            m = theo_mang.setdefault(d.mang, khung())
            m["ns"] += ns; m["tram"] += tram; m["xong"] += xong; m["so_dong"] += 1
            if d.hang_muc:
                h = theo_hm.setdefault(d.hang_muc, {**khung(), "cum": set()})
                h["ns"] += ns; h["tram"] += tram; h["xong"] += xong; h["so_dong"] += 1
                h["cum"].add(r.center)

    def ty_le(o):
        return round(o["xong"] / o["tram"], 4) if o["tram"] else None

    # ---- Mục tiêu tháng của (các) mảng đang xét, theo từng trung tâm ----
    #
    # Chọn mảng Cơ điện rồi nhìn "cụm này đăng ký 12 trạm" vẫn chưa trả lời
    # được câu có đúng mục tiêu không: phải đặt cạnh kế hoạch tháng của chính
    # mảng đó ở chính cụm đó. Kế hoạch lấy từ bảng tiến độ, gom qua nhóm đầu
    # việc ứng với mảng.
    la_cum = set(_ds_cum(db))
    ky_doi_chieu = sorted({d1.strftime("%Y-%m"), d2.strftime("%Y-%m")})
    mang_cua_dv = _mang_cua_dau_viec(db)
    dv_thuoc_mang = {dv for dv, m in mang_cua_dv.items()
                     if m and (not loc_mang or m == loc_mang)}
    muc_tieu = {}
    if dv_thuoc_mang:
        for pe in (db.query(models.ProgressEntry)
                   .filter(models.ProgressEntry.category.in_(list(dv_thuoc_mang)),
                           models.ProgressEntry.period.in_(ky_doi_chieu),
                           models.ProgressEntry.ft_name.is_(None))
                   .all()):
            if loc_cum and pe.center != loc_cum:
                continue
            o = muc_tieu.setdefault(pe.center, {"ke_hoach": 0.0, "thuc_hien": 0.0, "bkk": 0.0})
            o["ke_hoach"] += pe.plan_qty or 0
            o["thuc_hien"] += pe.done_qty or 0
            o["bkk"] += pe.bkk_qty or 0

    # Kế hoạch tháng và phần đã đẩy lên, để đối chiếu với khối lượng khai trong ngày.
    ky = {d.strftime("%Y-%m") for d in (d1, d2)}
    ke_hoach, da_day = {}, {}
    if theo_hm:
        for pe in (db.query(models.ProgressEntry)
                   .filter(models.ProgressEntry.item.in_(list(theo_hm)),
                           models.ProgressEntry.period.in_(list(ky)),
                           models.ProgressEntry.ft_name.is_(None))
                   .all()):
            if loc_cum and pe.center != loc_cum:
                continue
            ke_hoach[pe.item] = ke_hoach.get(pe.item, 0.0) + (pe.plan_qty or 0)
            da_day[pe.item] = da_day.get(pe.item, 0.0) + (pe.done_ngay or 0)

    return {
        "tu": d1.isoformat(), "den": d2.isoformat(),
        "so_ngay": (d2 - d1).days + 1,
        "loc": {"center": loc_cum, "mang": loc_mang},
        "tong": {
            "so_ban": tong["so_ban"], "so_cum": len(tong["cum"]),
            "so_ngay_co_dang_ky": len(tong["ngay"]),
            "ns": tong["ns"], "tram": tong["tram"], "xong": tong["xong"],
            "ty_le": ty_le(tong), "ft_truc": tong["ft_truc"], "ft_nghi": tong["ft_nghi"],
        },
        "theo_ngay": [{"ngay": d.isoformat(), "so_cum": len(o["cum"]), "ns": o["ns"],
                       "tram": o["tram"], "xong": o["xong"], "ty_le": ty_le(o)}
                      for d, o in sorted(theo_ngay.items())],
        "theo_mang": [{"mang": m, "ten_mang": TEN_MANG.get(m, m), "ns": o["ns"],
                       "tram": o["tram"], "xong": o["xong"], "ty_le": ty_le(o),
                       "so_dong": o["so_dong"]}
                      for m, o in sorted(theo_mang.items(),
                                         key=lambda kv: MA_MANG.index(kv[0]) if kv[0] in MA_MANG else 99)],
        "ky_doi_chieu": ky_doi_chieu,
        "theo_cum": sorted(
            [_dong_theo_cum(k, theo_cum.get(k), muc_tieu.get(k), ten_tt, quan_so, ty_le)
             # Cụm có mục tiêu mà KHÔNG đăng ký gì vẫn phải hiện ra: bỏ đi thì
             # bảng chỉ còn người đang làm, đúng chỗ cần soi lại biến mất.
             for k in sorted(set(theo_cum) | set(muc_tieu)) if k in la_cum or not la_cum],
            key=lambda x: (-x["tram"], -x["ton_thang"])),
        # Mục tiêu mang mã không phải cụm — chủ yếu là "CN" (chưa chia cụm).
        # Không xếp lẫn vào bảng trên: CN không đăng ký được nên kết luận "còn
        # tồn mà không đăng ký" cho nó là vô nghĩa, lại đẩy một dòng giả lên
        # đầu bảng. Vẫn trả về để thấy còn bao nhiêu khối lượng chưa chia.
        "ngoai_cum": sorted(
            [{"center": k, "ke_hoach": round(v["ke_hoach"], 1),
              "ton": round(max(max(v["ke_hoach"] - v["bkk"], 0) - v["thuc_hien"], 0), 1)}
             for k, v in muc_tieu.items() if la_cum and k not in la_cum],
            key=lambda x: -x["ton"]),
        "theo_hang_muc": sorted(
            [{"hang_muc": k, "ten": nhan_hm.get(k, k),
              "dau_viec": thuoc.get(k, ""), "ten_dau_viec": nhan_dv.get(thuoc.get(k, ""), ""),
              "so_cum": len(o["cum"]), "ns": o["ns"], "tram": o["tram"], "xong": o["xong"],
              "ty_le": ty_le(o),
              "ke_hoach_thang": round(ke_hoach.get(k, 0), 1),
              "da_day_len_thang": round(da_day.get(k, 0), 1)}
             for k, o in theo_hm.items()],
            key=lambda x: -x["tram"]),
    }


@admin_router.get("/ke-hoach-ngay/danh-gia")
def danh_gia(tu: Optional[str] = None, den: Optional[str] = None,
             db: Session = Depends(get_db), _=Depends(require_module("daily_plan", "view"))):
    """Bảng đánh giá kết quả đăng ký của các trung tâm trong một khoảng ngày.

    Cảnh báo theo đúng quy định điều hành: chưa đăng ký ngày gần nhất thì nhắc
    nhở; quá NGAY_PHE_BINH ngày liên tiếp không đăng ký thì phê bình.

    Số ngày không đăng ký liên tiếp đếm lùi từ ngày cuối khoảng, kể cả khi lần
    đăng ký gần nhất nằm trước khoảng đang xem — nếu chỉ đếm trong khoảng thì
    cụm bỏ bẵng cả tháng lại hiện y như cụm mới nghỉ một hôm.
    """
    d2 = _ngay(den)
    d1 = _ngay(tu, d2 - dt.timedelta(days=6))
    if d1 > d2:
        d1, d2 = d2, d1
    if (d2 - d1).days > 366:
        raise HTTPException(400, "Khoảng ngày quá dài — chọn tối đa 1 năm.")

    ten = _ten_trung_tam(db)
    cum = _ds_cum(db)
    so_ngay = (d2 - d1).days + 1

    rows = (_truy_van(db)
            .filter(models.KeHoachNgay.plan_date >= d1, models.KeHoachNgay.plan_date <= d2)
            .all())
    theo_cum = {}
    for r in rows:
        theo_cum.setdefault(r.center, []).append(r)

    # Ngày đăng ký gần nhất tính tới d2, kể cả trước khoảng đang xem.
    gan_nhat = {}
    for c, ngay_max in (db.query(models.KeHoachNgay.center,
                                 models.KeHoachNgay.plan_date)
                        .filter(models.KeHoachNgay.plan_date <= d2).all()):
        if c not in gan_nhat or ngay_max > gan_nhat[c]:
            gan_nhat[c] = ngay_max

    ra = []
    for code in sorted(set(cum) | set(theo_cum.keys())):
        ds = theo_cum.get(code, [])
        ngay_dk = {r.plan_date for r in ds}
        tong_ns = tong_tram = tram_xong = 0
        tong_truc = tong_nghi = 0
        mang_dung = set()
        for r in ds:
            tong_truc += r.ft_truc or 0
            tong_nghi += (r.ft_nghi_phep or 0) + (r.ft_nghi_ca or 0)
            for d_ in r.dong:
                tong_ns += d_.so_ns or 0
                tong_tram += d_.so_tram or 0
                tram_xong += d_.so_tram_xong or 0
                mang_dung.add(d_.mang)
        lan_cuoi = gan_nhat.get(code)
        khong_dk = (d2 - lan_cuoi).days if lan_cuoi else None
        ty_le_dk = round(len(ngay_dk) / so_ngay, 4) if so_ngay else 0.0
        ty_le_xong = round(tram_xong / tong_tram, 4) if tong_tram else None

        if khong_dk is None or khong_dk > NGAY_PHE_BINH:
            canh_bao = "phe_binh"
        elif khong_dk > 0:
            canh_bao = "nhac_nho"
        else:
            canh_bao = "ok"

        ra.append({
            "center": code, "ten": ten.get(code, code),
            "so_ngay": so_ngay,
            "so_ngay_dang_ky": len(ngay_dk),
            "ty_le_dang_ky": ty_le_dk,
            "khong_dang_ky_ngay": khong_dk,          # None = chưa đăng ký lần nào
            "lan_cuoi": lan_cuoi.isoformat() if lan_cuoi else None,
            "tong_ns": tong_ns,
            "tong_truc": tong_truc,
            "tong_nghi": tong_nghi,
            "tong_tram": tong_tram,
            "tram_xong": tram_xong,
            "ty_le_hoan_thanh": ty_le_xong,
            "so_mang": len(mang_dung),
            "canh_bao": canh_bao,
            "xep_loai": _xep_loai(ty_le_dk, ty_le_xong, canh_bao),
        })

    ra.sort(key=lambda x: (-x["ty_le_dang_ky"], -(x["ty_le_hoan_thanh"] or 0), x["center"]))
    return {
        "tu": d1.isoformat(), "den": d2.isoformat(), "so_ngay": so_ngay,
        "ngay_phe_binh": NGAY_PHE_BINH,
        "trung_tam": ra,
        "tong_hop": {
            "so_cum": len(ra),
            "phe_binh": len([x for x in ra if x["canh_bao"] == "phe_binh"]),
            "nhac_nho": len([x for x in ra if x["canh_bao"] == "nhac_nho"]),
            "du_ngay": len([x for x in ra if x["so_ngay_dang_ky"] >= so_ngay]),
        },
    }


def _xep_loai(ty_le_dk: float, ty_le_xong: Optional[float], canh_bao: str) -> str:
    """Xếp loại gộp: đăng ký đều và làm xong nhiều thì tốt; đang bị phê bình
    thì không xếp trên mức "cần chấn chỉnh" dù các số khác có đẹp."""
    if canh_bao == "phe_binh":
        return "can_chan_chinh"
    diem = ty_le_dk * 0.6 + (ty_le_xong if ty_le_xong is not None else ty_le_dk) * 0.4
    if diem >= 0.9:
        return "tot"
    if diem >= 0.7:
        return "kha"
    if diem >= 0.5:
        return "trung_binh"
    return "can_chan_chinh"
