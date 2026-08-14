"""
Thùng rác cho Tin tức và Tài liệu.

Xoá ở đây là xoá mềm: đặt deleted_at thay vì xoá bản ghi thật, để quản trị
viên xem lại và khôi phục nếu xoá nhầm. Mục nào nằm trong thùng rác quá
TRASH_RETENTION_DAYS ngày sẽ tự động bị xoá vĩnh viễn bởi vòng lặp chạy nền
start_trash_purge_thread().
"""
import datetime as dt
import logging
import threading
import time

from sqlalchemy.orm import Session

from . import models
from .auditlog import log_action
from .database import SessionLocal

log = logging.getLogger("portal.trash")

TRASH_RETENTION_DAYS = 30

# Các module hỗ trợ thùng rác. Mở rộng thêm module khác thì thêm vào đây,
# miễn model đó có sẵn deleted_at/deleted_by và trường "title".
TRASH_MODELS = {"news": models.News, "documents": models.Document}


def list_trash(db: Session) -> list:
    now = models.now()
    items = []
    for module, model in TRASH_MODELS.items():
        rows = db.query(model).filter(model.deleted_at.isnot(None)).all()
        for r in rows:
            expires_at = r.deleted_at + dt.timedelta(days=TRASH_RETENTION_DAYS)
            items.append({
                "module": module,
                "id": r.id,
                "title": r.title,
                "deleted_at": r.deleted_at,
                "deleted_by": r.deleted_by,
                "expires_at": expires_at,
                "days_left": max(0, (expires_at - now).days),
            })
    items.sort(key=lambda x: x["deleted_at"], reverse=True)
    return items


def purge_expired(db: Session) -> int:
    """Xoá vĩnh viễn mọi mục trong thùng rác đã quá hạn. Trả về số mục đã xoá."""
    cutoff = models.now() - dt.timedelta(days=TRASH_RETENTION_DAYS)
    purged = 0
    for module, model in TRASH_MODELS.items():
        rows = (db.query(model)
                .filter(model.deleted_at.isnot(None), model.deleted_at <= cutoff)
                .all())
        for row in rows:
            label, rid = row.title, row.id
            db.delete(row)
            db.commit()
            log_action(db, None, "purge", module, rid, label,
                      detail=f"Tự động xoá vĩnh viễn sau {TRASH_RETENTION_DAYS} ngày trong thùng rác.")
            purged += 1
    return purged


def _purge_loop(interval_seconds: int):
    while True:
        try:
            db = SessionLocal()
            try:
                n = purge_expired(db)
                if n:
                    log.info("Đã tự động xoá vĩnh viễn %d mục quá hạn trong thùng rác.", n)
            finally:
                db.close()
        except Exception as e:  # noqa: BLE001
            log.error("Lỗi khi dọn thùng rác tự động: %s", e)
        time.sleep(interval_seconds)


def start_trash_purge_thread(interval_seconds: int = 3600):
    """Chạy nền suốt vòng đời tiến trình, mỗi giờ kiểm tra và dọn thùng rác quá hạn."""
    threading.Thread(target=_purge_loop, args=(interval_seconds,), daemon=True).start()
