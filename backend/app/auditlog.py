"""Ghi nhật ký thao tác.
Gọi log_action() ngay sau khi một hành động có tác động thành công.
"""

from typing import Optional
import logging

from fastapi import Request
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from .models import AuditLog, User


log = logging.getLogger("portal.auditlog")


def client_ip(request: Optional[Request]) -> Optional[str]:
    if not request or not request.client:
        return None

    # Ưu tiên IP thật khi chạy sau proxy/Caddy.
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()

    return request.client.host


def log_action(
    db: Session,
    user: Optional[User],
    action: str,
    module: str,
    target_id=None,
    target_label: str = None,
    detail: str = None,
    request: Request = None,
):
    row = AuditLog(
        user_id=user.id if user else None,
        username=user.username if user else None,
        full_name=user.full_name if user else None,
        role=user.role if user else None,
        action=action,
        module=module,
        target_id=str(target_id) if target_id is not None else None,
        target_label=(target_label or "")[:300],
        detail=detail,
        ip_address=client_ip(request),
    )

    # Audit log là dữ liệu phụ.
    # Không để lỗi ghi nhật ký làm hỏng thao tác chính.
    try:
        db.add(row)
        db.commit()

    except SQLAlchemyError as exc:
        db.rollback()

        log.exception(
            "Không ghi được audit log: "
            "action=%s module=%s target_id=%s: %s",
            action,
            module,
            target_id,
            exc,
        )

    except Exception as exc:
        db.rollback()

        log.exception(
            "Lỗi không xác định khi ghi audit log: "
            "action=%s module=%s target_id=%s: %s",
            action,
            module,
            target_id,
            exc,
        )
