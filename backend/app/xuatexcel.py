"""Xuất toàn bộ dữ liệu ra MỘT tệp Excel, mỗi mục một trang.

Trước đây mỗi mục một tệp CSV riêng, mà riêng số liệu Dashboard thì dồn cả bảy
tab vào chung một sheet: mở ra là hơn nghìn dòng lẫn lộn KPI, rời mạng, sự cố,
Ksub*min... phải tự lọc cột "bang" mới đọc được. Còn dữ liệu chi tiết mức trung
tâm (định biên, tiến độ, CSDL hạ tầng) thì nằm ở màn hình khác nên nhiều người
không biết là xuất được.

Nay một tệp, mỗi tab Dashboard một trang, mỗi mục dữ liệu một trang, kèm trang
mục lục cho biết trong tệp có gì và bao nhiêu dòng.

Cột của các trang số liệu giữ đúng thứ tự của tệp mẫu nhập (bang, ky, chi_tieu,
don_vi, gia_tri) để xuất ra sửa rồi nhập ngược lên được ngay, không phải xếp lại.
"""
import io

from . import models
from .permissions import effective_permission_matrix

# Mỗi tab Dashboard một trang, đúng cách chia người dùng đang thấy trên giao diện.
TAB_DASHBOARD = [
    ("Tiền phạt & Doanh thu", ["KPI", "KPI_TARGET", "KPI_VTNET", "KPI_VTT"]),
    ("Rời mạng CĐBR", ["WO", "WO_TARGET", "WO_TINH", "WO_HUYEN_BD", "WO_HUYEN_BRVT"]),
    ("Sự cố truyền dẫn", ["PAKH", "PAKH_TARGET"]),
    ("Ksub-min", ["FUEL", "FUEL_TARGET"]),
    ("GĐTT & Cell-h", ["OUTPUT", "OUTPUT_TARGET"]),
    ("XLCS CĐBR", ["NETWORK", "NETWORK_TARGET"]),
    ("TKM CĐBR", ["VHKT", "VHKT_TARGET"]),
    ("PAKH & CSKH", ["CSKH", "CSKH_TARGET"]),
    ("Tuyển dụng (số liệu)", ["HIRE"]),
]

COT_SO_LIEU = ["bang", "ten_bang", "ky", "chi_tieu", "don_vi", "gia_tri"]


def _ngay(v):
    return v.strftime("%d/%m/%Y") if v else ""


def _so_lieu_theo_tab(db, ma_bang):
    from .bulkimport import BOARD_LABELS
    rows = (db.query(models.Metric)
            .filter(models.Metric.board.in_(ma_bang))
            .order_by(models.Metric.board, models.Metric.period,
                      models.Metric.label, models.Metric.unit_name)
            .all())
    return [[r.board, BOARD_LABELS.get(r.board, r.board), r.period, r.label,
             r.unit_name or "", r.value] for r in rows]


def _dinh_bien(db):
    rows = (db.query(models.CenterStaffing)
            .order_by(models.CenterStaffing.report_date.desc(),
                      models.CenterStaffing.center).all())
    return [[_ngay(r.report_date), r.center or "",
             r.nt_ft_dinh_bien, r.nt_ft_hien_tai,
             r.dm_ft_dinh_bien, r.dm_ft_hien_tai,
             r.dm_oft_dinh_bien, r.dm_oft_hien_tai,
             r.oft_gap, r.ft_gap, (r.oft_gap or 0) + (r.ft_gap or 0),
             r.posted_channels, r.school_contacts, r.banners_posted,
             r.banner_location or "", r.note or ""] for r in rows]


def _tien_do(db):
    from .techtasks import category_labels, item_labels
    nhan_dv = category_labels(db)
    nhan_hm = item_labels(db)
    rows = (db.query(models.ProgressEntry)
            .order_by(models.ProgressEntry.period.desc(), models.ProgressEntry.category,
                      models.ProgressEntry.item, models.ProgressEntry.center).all())
    return [[r.period or "", nhan_dv.get(r.category, r.category or ""),
             nhan_hm.get(r.item, r.item or ""), r.center or "", r.ft_name or "",
             r.plan_qty, r.done_qty,
             (r.plan_qty or 0) - (r.done_qty or 0), r.note or ""] for r in rows]


def _csdl_ha_tang(db):
    rows = (db.query(models.InfraStat)
            .order_by(models.InfraStat.period.desc(), models.InfraStat.section,
                      models.InfraStat.center, models.InfraStat.label).all())
    return [[r.period or "", r.section or "", r.center or "", r.label or "",
             r.value, r.value_text or ""] for r in rows]


def _ung_vien(db):
    rows = db.query(models.Candidate).order_by(models.Candidate.id.desc()).all()
    return [[r.full_name or "", r.position or "", r.position_type or "",
             r.desired_location or "", r.birth_year, r.education_level or "",
             r.major or "", r.referrer or "", r.status or "", r.note or ""]
            for r in rows]


def _nhan_su(db):
    rows = db.query(models.Person).order_by(models.Person.full_name).all()
    return [[r.full_name or "", r.role or "", r.dept or "", r.phone or "",
             r.email or "", _ngay(r.birthday), "co" if r.active else "khong"]
            for r in rows]


# (tên trang, module cần quyền xem, tiêu đề cột, hàm lấy dữ liệu)
CAC_TRANG_KHAC = [
    ("Định biên trung tâm", "recruitment",
     ["ngay_chot", "trung_tam", "nt_ft_dinh_bien", "nt_ft_hien_tai",
      "dm_ft_dinh_bien", "dm_ft_hien_tai", "dm_oft_dinh_bien", "dm_oft_hien_tai",
      "thieu_oft", "thieu_ft", "tong_thieu", "da_dang_kenh", "tiep_xuc_truong",
      "bang_ron", "vi_tri_bang_ron", "ghi_chu"], _dinh_bien),
    ("Tiến độ theo trung tâm", "tech_tasks",
     ["ky", "dau_viec", "hang_muc", "trung_tam", "nguoi_phu_trach",
      "ke_hoach", "thuc_hien", "con_lai", "ghi_chu"], _tien_do),
    ("CSDL hạ tầng", "csdl_ht",
     ["ky", "nhom", "ma_cum", "chi_tieu", "gia_tri", "gia_tri_chu"], _csdl_ha_tang),
    ("Ứng viên tuyển dụng", "recruitment",
     ["ho_ten", "vi_tri", "loai_vi_tri", "khu_vuc", "nam_sinh", "trinh_do",
      "chuyen_mon", "nguoi_gioi_thieu", "trang_thai", "ghi_chu"], _ung_vien),
    ("Hồ sơ nhân viên", "people",
     ["ho_ten", "chuc_vu", "don_vi", "dien_thoai", "email", "ngay_sinh", "dang_lam"],
     _nhan_su),
]


def build_workbook(db, user) -> bytes:
    """Dựng workbook, chỉ gồm những trang tài khoản này có quyền xem."""
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font, PatternFill
    from openpyxl.utils import get_column_letter

    quyen = effective_permission_matrix(user)

    def duoc_xem(module):
        return user.role == "admin" or "view" in quyen.get(module, [])

    xanh = PatternFill("solid", fgColor="0E6CD6")
    chu_trang = Font(bold=True, color="FFFFFF", size=11)

    wb = Workbook()
    mucluc = wb.active
    mucluc.title = "Muc luc"
    mucluc.column_dimensions["A"].width = 34
    mucluc.column_dimensions["B"].width = 58
    mucluc.column_dimensions["C"].width = 12
    mucluc["A1"] = f"DỮ LIỆU XUẤT NGÀY {models.today().strftime('%d/%m/%Y')}"
    mucluc["A1"].font = Font(bold=True, size=14, color="C8102E")

    def them_trang(ten, tieu_de, du_lieu, mo_ta):
        ws = wb.create_sheet(ten[:31])
        for i, c in enumerate(tieu_de, start=1):
            o = ws.cell(row=1, column=i, value=c)
            o.fill = xanh
            o.font = chu_trang
            o.alignment = Alignment(horizontal="center", vertical="center")
            ws.column_dimensions[get_column_letter(i)].width = max(len(str(c)), 12) + 4
        for j, hang in enumerate(du_lieu, start=2):
            for i, v in enumerate(hang, start=1):
                ws.cell(row=j, column=i, value=v)
        ws.freeze_panes = "A2"
        muc.append((ten, mo_ta, len(du_lieu)))

    muc = []
    if duoc_xem("dashboard"):
        for ten, ma_bang in TAB_DASHBOARD:
            them_trang(ten, COT_SO_LIEU, _so_lieu_theo_tab(db, ma_bang),
                       "Số liệu Dashboard — " + ", ".join(ma_bang))
    for ten, module, tieu_de, lay in CAC_TRANG_KHAC:
        if duoc_xem(module):
            them_trang(ten, tieu_de, lay(db), f"Mục {ten}")

    dong = 3
    mucluc.cell(row=dong, column=1, value="Trang").font = Font(bold=True)
    mucluc.cell(row=dong, column=2, value="Nội dung").font = Font(bold=True)
    mucluc.cell(row=dong, column=3, value="Số dòng").font = Font(bold=True)
    dong += 1
    for ten, mo_ta, so in muc:
        mucluc.cell(row=dong, column=1, value=ten)
        mucluc.cell(row=dong, column=2, value=mo_ta).alignment = Alignment(wrap_text=True)
        mucluc.cell(row=dong, column=3, value=so)
        dong += 1

    dong += 1
    for ghi_chu in [
        "Các trang số liệu Dashboard giữ đúng thứ tự cột của tệp mẫu nhập,",
        "nên sửa trên tệp này rồi nhập ngược lên được ngay (Quản trị › Nhập từ Excel).",
        "",
        "Không có trong tệp: lịch trực toàn chi nhánh — bảng ngang mỗi ngày một cột,",
        "xuất riêng tại màn hình Lịch trực.",
    ]:
        mucluc.cell(row=dong, column=1, value=ghi_chu)
        mucluc.merge_cells(start_row=dong, start_column=1, end_row=dong, end_column=3)
        dong += 1

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
