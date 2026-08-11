"""
Gửi cảnh báo khi có thao tác nhạy cảm: sửa/xoá bản tin, đổi cấu hình website.

Hai kênh gửi:
  - Email qua SMTP, cấu hình bằng biến môi trường (xem .env.example):
    SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, ALERT_EMAIL_TO
  - Telegram qua Bot API, cấu hình ngay trên màn hình quản trị (Cài đặt thông báo),
    lưu trong bảng site_config: telegram_bot_token, telegram_chat_id.

Mỗi kênh có công tắc bật/tắt riêng, cũng lưu trong site_config:
  notify_email_on, notify_telegram_on, notify_bell_on (mặc định bật).

Nếu chưa cấu hình đủ hoặc kênh đang tắt, hệ thống chỉ ghi log và bỏ qua —
không làm hỏng thao tác chính của người dùng.
"""
import json
import logging
import os
import smtplib
import ssl
import urllib.error
import urllib.request
from email.message import EmailMessage
from typing import Optional

from .database import SessionLocal
from .models import SiteConfig, User
from .permissions import ALL_MODULE_LABELS

log = logging.getLogger("portal.alerts")

# (module, action) coi là "nhạy cảm" — sửa/xoá bản tin, đổi cấu hình hệ thống.
ALERT_RULES = {("news", "update"), ("news", "delete"), ("config", "config")}

ALERT_ACTION_LABELS = {"update": "Sửa", "delete": "Xoá", "config": "Đổi cấu hình"}

ALERT_EMAIL_TO = os.getenv("ALERT_EMAIL_TO", "vcchcm.ai@gmail.com")
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587") or "587")
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", "") or SMTP_USER

TELEGRAM_TIMEOUT = 10


def is_alertable(module: str, action: str) -> bool:
    return (module, action) in ALERT_RULES


def smtp_configured() -> bool:
    return bool(SMTP_HOST and SMTP_USER and SMTP_PASSWORD and ALERT_EMAIL_TO)


def send_alert_email(subject: str, body: str) -> bool:
    if not smtp_configured():
        log.warning("Chưa cấu hình SMTP đầy đủ (SMTP_HOST/SMTP_USER/SMTP_PASSWORD) — "
                    "bỏ qua gửi email cảnh báo: %s", subject)
        return False
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = SMTP_FROM
    msg["To"] = ALERT_EMAIL_TO
    msg.set_content(body)
    try:
        context = ssl.create_default_context()
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.starttls(context=context)
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
        log.info("Đã gửi email cảnh báo: %s", subject)
        return True
    except Exception as e:  # noqa: BLE001
        log.error("Gửi email cảnh báo thất bại: %s", e)
        return False


# --------------------------------------------------------------- Cấu hình kênh
# Đọc/ghi qua bảng site_config để quản trị viên tự đổi trên giao diện,
# không cần sửa file trên máy chủ hay khởi động lại như SMTP.

NOTIFY_SETTING_KEYS = (
    "telegram_bot_token", "telegram_chat_id",
    "notify_email_on", "notify_telegram_on", "notify_bell_on",
)


def _read_config(db, keys):
    rows = db.query(SiteConfig).filter(SiteConfig.key.in_(keys)).all()
    return {r.key: r.value or "" for r in rows}


def _bool_setting(raw: Optional[str], default: bool = True) -> bool:
    if raw is None or raw == "":
        return default
    return raw not in ("0", "false", "False")


def get_notify_settings(db=None) -> dict:
    """Đọc trạng thái cấu hình + bật/tắt của từng kênh thông báo."""
    own_db = db is None
    db = db or SessionLocal()
    try:
        raw = _read_config(db, NOTIFY_SETTING_KEYS)
        return {
            "telegram_bot_token": raw.get("telegram_bot_token", ""),
            "telegram_chat_id": raw.get("telegram_chat_id", ""),
            "notify_email_on": _bool_setting(raw.get("notify_email_on")),
            "notify_telegram_on": _bool_setting(raw.get("notify_telegram_on")),
            "notify_bell_on": _bool_setting(raw.get("notify_bell_on")),
        }
    finally:
        if own_db:
            db.close()


def telegram_configured(settings: Optional[dict] = None) -> bool:
    settings = settings or get_notify_settings()
    return bool(settings["telegram_bot_token"] and settings["telegram_chat_id"])


def send_telegram_message(text: str, settings: Optional[dict] = None) -> bool:
    settings = settings or get_notify_settings()
    token = settings["telegram_bot_token"]
    chat_id = settings["telegram_chat_id"]
    if not (token and chat_id):
        log.warning("Chưa cấu hình Telegram (bot token/chat id) — bỏ qua gửi thông báo Telegram.")
        return False
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = json.dumps({"chat_id": chat_id, "text": text}).encode("utf-8")
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=TELEGRAM_TIMEOUT) as res:
            res.read()
        log.info("Đã gửi thông báo Telegram.")
        return True
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "ignore") if e.fp else str(e)
        log.error("Gửi thông báo Telegram thất bại (%s): %s", e.code, detail)
        return False
    except Exception as e:  # noqa: BLE001
        log.error("Gửi thông báo Telegram thất bại: %s", e)
        return False


def notify_alert(user: Optional[User], action: str, module: str,
                 target_label: str = "", detail: str = None):
    """Gọi qua BackgroundTasks sau khi lưu thành công — không làm chậm phản hồi."""
    if not is_alertable(module, action):
        return
    who = f"{user.full_name} ({user.username})" if user else "Không rõ"
    action_label = ALERT_ACTION_LABELS.get(action, action)
    module_label = ALL_MODULE_LABELS.get(module, module)

    subject = f"[Cổng thông tin CNCT] {action_label} — {module_label}: {target_label or ''}".strip()
    body = (
        f"Có thao tác {action_label.lower()} trên Cổng thông tin nội bộ CNCT.\n\n"
        f"Tài khoản thực hiện: {who}\n"
        f"Hành động: {action_label}\n"
        f"Hạng mục: {module_label}\n"
        f"Nội dung: {target_label or '—'}\n"
        + (f"Ghi chú: {detail}\n" if detail else "")
        + "\nXem chi tiết tại mục Nhật ký hệ thống trong khu quản trị."
    )

    settings = get_notify_settings()
    if settings["notify_email_on"]:
        send_alert_email(subject, body)
    if settings["notify_telegram_on"]:
        send_telegram_message(f"{subject}\n\n{body}", settings)
