"""Chuẩn hoá tên trung tâm về mã viết tắt (THA, CHP, DTG...).

Danh mục mã nằm ở bảng infra_center_codes, nạp từ sheet "DM Mã cụm" của báo cáo
CSDL hạ tầng. Trước đây mỗi phân hệ lưu một kiểu tên khác nhau — "Trung tâm Thới
Hòa", "Thới Hòa", tên cũ "Bến Cát-Bàu Bàng" — nên không đối chiếu chéo được giữa
tiến độ, định biên và số liệu dashboard. Nay tất cả lưu mã, giao diện tra ngược
ra tên đầy đủ để người đọc vẫn hiểu.
"""

from . import models
from .database import SessionLocal

RELEASE_KEY = "_system_center_codes_v1"

# Các cột đang chứa tên trung tâm ở dạng tự do.
#
# CỐ Ý không đụng tới Metric.unit_name: cột đó chứa tên TỈNH và HUYỆN (bảng rời
# mạng theo huyện), mà nhiều huyện trùng tên trung tâm — Dầu Tiếng, Phú Giáo,
# Tân Uyên, Châu Đức, Phú Mỹ, Côn Đảo, Bà Rịa, Vũng Tàu. Đổi theo tên sẽ biến
# huyện thành mã trung tâm và làm hỏng biểu đồ rời mạng theo địa bàn.
CAC_COT = [
    (models.CenterStaffing, "center"),
    (models.ProgressEntry, "center"),
]


def bang_tra_ma(db) -> dict:
    """Mọi cách viết đã gặp -> mã trung tâm. Khoá đã casefold để so không phân biệt hoa thường."""
    tra = {}
    for c in db.query(models.InfraCenterCode).all():
        for ten in (c.code, c.name, c.old_code, c.old_name):
            if not ten or not ten.strip():
                continue
            goc = ten.strip()
            tra[goc.casefold()] = c.code
            # "Trung tâm Thới Hòa" và "Thới Hòa" là cùng một nơi.
            khong_tien_to = goc.replace("Trung tâm", "").strip(" -")
            if khong_tien_to:
                tra[khong_tien_to.casefold()] = c.code
    return tra


def ten_day_du(db) -> dict:
    """Mã -> tên đầy đủ, dùng cho hiển thị."""
    return {c.code: c.name for c in db.query(models.InfraCenterCode).all()}


def apply_once() -> None:
    db = SessionLocal()
    try:
        da_chay = (db.query(models.SiteConfig)
                   .filter(models.SiteConfig.key == RELEASE_KEY).first())
        if da_chay:
            return
        tra = bang_tra_ma(db)
        if not tra:
            return          # chưa nhập danh mục mã cụm thì chưa chuyển được

        for model, cot in CAC_COT:
            for row in db.query(model).all():
                gia_tri = (getattr(row, cot) or "").strip()
                if not gia_tri:
                    continue
                ma = tra.get(gia_tri.casefold())
                if ma and ma != gia_tri:
                    setattr(row, cot, ma)

        db.add(models.SiteConfig(key=RELEASE_KEY, value="applied",
                                 label="System center code migration"))
        db.commit()
    finally:
        db.close()
