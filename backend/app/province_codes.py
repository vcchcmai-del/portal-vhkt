"""Chuẩn hoá tên đơn vị trong bảng số liệu về mã viết tắt: VCC HCM, BDG, VTU.

Báo cáo nguồn của Tổng công ty đã dùng cột "Mã tỉnh" với đúng ba giá trị này —
HCM là mức toàn chi nhánh, BDG là Bình Dương, VTU là Bà Rịa - Vũng Tàu. Trước
đây mỗi lần nhập lại ghi một kiểu ("Toàn chi nhánh", "TP.HCM", tên tỉnh đầy đủ)
nên cùng một đơn vị nằm ở hai ba dòng khác nhau, không đối chiếu được với nhau.

Cùng ý đồ với center_codes (mã trung tâm), nhưng danh mục ở đây cố định và chỉ
áp cho cột đơn vị của bảng số liệu.
"""

from . import models
from .database import SessionLocal

RELEASE_KEY = "_system_province_codes_v1"

TOAN_CHI_NHANH = "VCC HCM"
BINH_DUONG = "BDG"
VUNG_TAU = "VTU"

TEN_DAY_DU = {
    TOAN_CHI_NHANH: "Toàn chi nhánh",
    BINH_DUONG: "Bình Dương",
    VUNG_TAU: "Bà Rịa - Vũng Tàu",
}

# Mọi cách viết đã gặp trong dữ liệu cũ -> mã. Khoá đã casefold.
BANG_TRA = {
    "toàn chi nhánh": TOAN_CHI_NHANH,
    "tp.hcm": TOAN_CHI_NHANH,
    "tp hcm": TOAN_CHI_NHANH,
    "hcm": TOAN_CHI_NHANH,
    "vcc hcm": TOAN_CHI_NHANH,
    "bình dương": BINH_DUONG,
    "bdg": BINH_DUONG,
    "bà rịa - vũng tàu": VUNG_TAU,
    "bà rịa-vũng tàu": VUNG_TAU,
    "brvt": VUNG_TAU,
    "vtu": VUNG_TAU,
}

# CỐ Ý bỏ qua hai bảng rời mạng theo huyện: cột đơn vị ở đó chứa TÊN HUYỆN, mà
# huyện Vũng Tàu là một địa bàn khác hẳn tỉnh Bà Rịa - Vũng Tàu. Đổi theo bảng
# tra sẽ biến huyện thành mã tỉnh và làm hỏng biểu đồ rời mạng theo địa bàn.
BANG_THEO_HUYEN = {"WO_HUYEN_BD", "WO_HUYEN_BRVT"}


def ma_don_vi(ten: str):
    """Tên đơn vị bất kỳ -> mã, hoặc None nếu không phải đơn vị theo tỉnh."""
    return BANG_TRA.get((ten or "").strip().casefold())


def apply_once() -> None:
    db = SessionLocal()
    try:
        da_chay = (db.query(models.SiteConfig)
                   .filter(models.SiteConfig.key == RELEASE_KEY).first())
        if da_chay:
            return
        for row in db.query(models.Metric).all():
            if row.board in BANG_THEO_HUYEN:
                continue
            ma = ma_don_vi(row.unit_name)
            if ma and ma != row.unit_name:
                row.unit_name = ma
        db.add(models.SiteConfig(key=RELEASE_KEY, value="applied",
                                 label="System province code migration"))
        db.commit()
    finally:
        db.close()
