"""Đưa số liệu Dashboard vào kho mã nguồn, để Git mang theo được cả dữ liệu.

Cơ sở dữ liệu (data/*.db, hoặc Postgres của bản chạy thật) KHÔNG nằm trong Git —
đúng như vậy, vì nó chứa danh bạ nhân viên, tài khoản đăng nhập và nhật ký thao
tác. Nhưng như thế thì clone repo về lại ra một cổng thông tin trắng trơn, và
mọi thay đổi số liệu không để lại dấu vết nào trong lịch sử Git.

Nên tách đôi: phần số liệu Dashboard — không có tên, số điện thoại hay email của
ai — thì kết xuất ra CSV trong backend/dong-bo/ và commit; phần dữ liệu cá nhân vẫn
nằm ngoài Git. Repo hiện ở chế độ công khai, nên ranh giới này là bắt buộc, đừng
thêm bảng mới vào đây mà chưa soát lại từng cột.

    python scripts/xuat_so_lieu.py     # CSDL -> backend/dong-bo/*.csv
    python scripts/nap_so_lieu.py      # backend/dong-bo/*.csv -> CSDL

Lúc khởi động, nếu bảng số liệu còn trống thì tự nạp (xem main.py) — máy mới
clone về là có sẵn số liệu, còn máy đã có dữ liệu thì không bị đụng vào.
"""
import csv
import os

from . import models
from .database import SessionLocal

# Nằm trong backend/ chứ không phải gốc repo: nền tảng triển khai dựng image từ
# ĐÚNG thư mục backend/ (xem backend/Dockerfile), nên tệp nào ở ngoài đó sẽ không
# có mặt trên máy chủ thật. Đường dẫn này ra backend/dong-bo ở cả hai nơi —
# chạy cục bộ lẫn trong container (/app/dong-bo).
THU_MUC = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dong-bo")


class Bang:
    """Một bảng được đồng bộ: tệp, model, các cột giữ lại, và khoá nhận diện."""

    def __init__(self, tep, model, cot, khoa):
        self.tep, self.model, self.cot, self.khoa = tep, model, cot, khoa


# CỐ Ý không có: people, users, duty_roster_shifts, duty_schedules, audit_logs,
# threads, replies, ideas, uploads — đều chứa thông tin cá nhân.
#
# ProgressEntry cũng không có, dù thoạt nhìn chỉ là số kế hoạch/thực hiện: một
# trung tâm có thể có nhiều dòng cùng đầu việc, cùng kỳ, phân biệt nhau bằng
# ft_name (người phụ trách). Bỏ cột đó đi thì khoá nhận diện hết phân biệt được,
# nạp lại sẽ dồn nhiều giá trị vào một dòng — đã xảy ra thật, mất số 21/4 của
# THA. Mà giữ lại cột đó thì đưa tên người lên repo công khai. Nên để cả bảng
# ngoài ảnh chụp.
CAC_BANG = [
    Bang("so-lieu-dashboard.csv", models.Metric,
         ["board", "period", "label", "unit_name", "value"],
         ["board", "period", "label", "unit_name"]),
    Bang("dinh-bien-trung-tam.csv", models.CenterStaffing,
         ["report_date", "center", "nt_ft_dinh_bien", "nt_ft_hien_tai",
          "dm_ft_dinh_bien", "dm_ft_hien_tai", "dm_oft_dinh_bien", "dm_oft_hien_tai",
          "oft_gap", "ft_gap", "applications_received", "posted_channels",
          "school_contacts", "banners_posted", "banner_location", "note"],
         ["report_date", "center"]),
    Bang("danh-muc-trung-tam.csv", models.InfraCenterCode,
         ["code", "name", "old_code", "old_name"], ["code"]),
    Bang("danh-muc-dau-viec.csv", models.TechCategory,
         ["code", "label", "hint", "order_no", "active"], ["code"]),
    Bang("danh-muc-hang-muc.csv", models.TechProgressItem,
         ["code", "label", "category_code", "order_no", "active"], ["code"]),
    Bang("csdl-ha-tang.csv", models.InfraStat,
         ["period", "section", "center", "label", "value", "value_text"],
         ["period", "section", "center", "label"]),
]


def _chuoi(v):
    if v is None:
        return ""
    if isinstance(v, bool):
        return "1" if v else "0"
    return str(v)


def _doc_lai(model, ten_cot, chuoi):
    """Đưa chuỗi trong CSV về đúng kiểu của cột."""
    kieu = getattr(model.__table__.c, ten_cot).type.python_type
    if chuoi == "":
        return None
    if kieu is bool:
        return chuoi not in ("0", "", "False", "false")
    if kieu is int:
        return int(float(chuoi))
    if kieu is float:
        return float(chuoi)
    import datetime as dt
    if kieu is dt.date:
        return dt.date.fromisoformat(chuoi)
    if kieu is dt.datetime:
        return dt.datetime.fromisoformat(chuoi)
    return chuoi


def xuat(thu_muc=THU_MUC) -> dict:
    """CSDL -> CSV. Trả về {tệp: số dòng}."""
    os.makedirs(thu_muc, exist_ok=True)
    db = SessionLocal()
    ket_qua = {}
    try:
        for b in CAC_BANG:
            hang = db.query(b.model).all()
            # Sắp xếp theo TOÀN BỘ cột, không chỉ khoá: nếu còn dòng trùng khoá
            # thì sắp theo khoá thôi sẽ để chúng đảo chỗ nhau mỗi lần xuất, sinh
            # ra khác biệt giả trong Git tuy dữ liệu chẳng đổi gì.
            hang.sort(key=lambda r: [_chuoi(getattr(r, c)) for c in b.cot])
            with open(os.path.join(thu_muc, b.tep), "w",
                      encoding="utf-8-sig", newline="") as f:
                w = csv.writer(f)
                w.writerow(b.cot)
                for r in hang:
                    w.writerow([_chuoi(getattr(r, c)) for c in b.cot])
            ket_qua[b.tep] = len(hang)
    finally:
        db.close()
    return ket_qua


def nap(thu_muc=THU_MUC) -> dict:
    """CSV -> CSDL, ghi đè theo khoá nhận diện. Trả về {tệp: (thêm, cập nhật)}."""
    db = SessionLocal()
    ket_qua = {}
    bo_qua = []
    try:
        for b in CAC_BANG:
            duong_dan = os.path.join(thu_muc, b.tep)
            if not os.path.exists(duong_dan):
                continue
            them = sua = 0
            with open(duong_dan, encoding="utf-8-sig", newline="") as f:
                for dong in csv.DictReader(f):
                    gia_tri = {c: _doc_lai(b.model, c, dong.get(c, "") or "")
                               for c in b.cot}
                    loc = [getattr(b.model, k) == gia_tri[k] for k in b.khoa]
                    trung = db.query(b.model).filter(*loc).all()
                    if len(trung) > 1:
                        # Khoá không còn phân biệt được thì mọi dòng trong tệp sẽ
                        # cùng ghi đè lên một bản ghi, làm mất số của các bản ghi
                        # kia. Thà bỏ qua và báo ra còn hơn.
                        bo_qua.append({c: gia_tri[c] for c in b.khoa})
                        continue
                    row = trung[0] if trung else None
                    if row is None:
                        db.add(b.model(**gia_tri))
                        them += 1
                    else:
                        for c, v in gia_tri.items():
                            setattr(row, c, v)
                        sua += 1
            db.commit()
            ket_qua[b.tep] = (them, sua)
    finally:
        db.close()
    if bo_qua:
        print(f"CẢNH BÁO: bỏ qua {len(bo_qua)} dòng vì khoá khớp nhiều bản ghi "
              f"trong CSDL — {bo_qua[:3]}")
    return ket_qua


def _dong_dau_moc(db) -> None:
    """Đánh dấu các bước một-lần là đã chạy.

    Số liệu trong dong-bo đã là KẾT QUẢ sau khi các bước ấy chạy: tên đơn vị
    đã là mã, tên trung tâm đã là mã, KPI T8/2026 đã cập nhật. Để chúng chạy lại
    trên bộ số liệu này thì chúng sẽ ghi đè, thậm chí dựng lại những dòng đã cố ý
    bỏ đi (dòng tổng Ksub*min T08/2026 là một ví dụ đã xảy ra).
    """
    from .center_codes import RELEASE_KEY as MOC_TRUNG_TAM
    from .dashboard_kpi_2026_08 import RELEASE_KEY as MOC_KPI_T8
    from .province_codes import RELEASE_KEY as MOC_DON_VI

    for khoa in (MOC_KPI_T8, MOC_TRUNG_TAM, MOC_DON_VI):
        if not db.query(models.SiteConfig).filter(models.SiteConfig.key == khoa).first():
            db.add(models.SiteConfig(key=khoa, value="applied",
                                     label="Đã có sẵn trong số liệu kèm mã nguồn"))
    db.commit()


def nap_neu_trong() -> str:
    """Nạp số liệu kèm theo mã nguồn khi CSDL còn trắng — dùng lúc khởi động.

    Chỉ chạy khi bảng số liệu Dashboard chưa có dòng nào, nên máy đang có dữ
    liệu thật không bao giờ bị ghi đè.
    """
    db = SessionLocal()
    try:
        if db.query(models.Metric).first() is not None:
            return "Đã có số liệu, bỏ qua."
    finally:
        db.close()
    if not os.path.isdir(THU_MUC):
        return "Chưa có thư mục dong-bo, bỏ qua."
    kq = nap()
    db = SessionLocal()
    try:
        _dong_dau_moc(db)
    finally:
        db.close()
    tong = sum(t + s for t, s in kq.values())
    return f"Đã nạp {tong} dòng số liệu kèm theo mã nguồn."
