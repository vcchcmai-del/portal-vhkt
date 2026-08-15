"""
Các đường dẫn dành riêng cho màn hình Quản trị.

Nguyên tắc phân quyền:
- Mỗi module (Tin tức, Tài liệu, Thông báo...) có quyền riêng, xem permissions.py.
  Xem/Thêm/Sửa/Xoá trong một module đều cần tài khoản được cấp quyền module đó.
- Cấu hình website, quản lý tài khoản, kiểm tra hệ thống và nhật ký: chỉ quản trị viên (admin).
- Mọi thao tác thêm/sửa/xoá/cấu hình đều được ghi vào nhật ký (audit_logs) qua log_action().
"""
import datetime as dt
import os
from typing import Dict, List, Optional, Union

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.responses import FileResponse, PlainTextResponse
from pydantic import BaseModel
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from . import models
from . import trash as trash_module
from .alerts import (
    ALERT_RULES, get_notify_settings, notify_alert, send_telegram_message,
    smtp_configured, telegram_configured,
)
from .auditlog import log_action
from .auth import current_user
from .database import engine, get_db
from .permissions import (
    ADMIN_ONLY_MODULES, ALL_MODULE_LABELS, IMPORT_KIND_MODULE, MODULES, MODULE_LABELS,
    ROLE_DEFAULT_PERMISSIONS, check_import_kind_permission, dump_permissions,
    effective_permission_matrix, effective_permissions_list, get_permissions,
    parse_permissions, require_module,
)

router = APIRouter(prefix="/api/admin", tags=["Quản trị"])


def require_admin(user: models.User = Depends(current_user)) -> models.User:
    if user.role != "admin":
        raise HTTPException(403, "Chức năng này chỉ dành cho quản trị viên.")
    return user


def get_or_404(db: Session, model, obj_id: int):
    row = db.get(model, obj_id)
    if not row:
        raise HTTPException(404, "Không tìm thấy bản ghi.")
    return row


def apply(row, data: dict):
    """Chỉ cập nhật những trường người dùng thực sự gửi lên."""
    for k, v in data.items():
        if v is not None and hasattr(row, k):
            setattr(row, k, v)
    return row


# ============================================================ Quản lý bản tin

class NewsAdminIn(BaseModel):
    title: Optional[str] = None
    excerpt: Optional[str] = None
    body: Optional[str] = None
    category: Optional[str] = None
    tag: Optional[str] = None
    author: Optional[str] = None
    cover_url: Optional[str] = None
    gallery: Optional[list] = None
    featured: Optional[bool] = None
    pinned: Optional[bool] = None
    visible: Optional[bool] = None
    published_at: Optional[dt.datetime] = None


def _read_gallery(raw):
    if not raw:
        return []
    try:
        import json
        data = json.loads(raw)
        return data if isinstance(data, list) else []
    except (ValueError, TypeError):
        return []


def news_out(n: models.News):
    return {
        "id": n.id, "title": n.title, "excerpt": n.excerpt, "body": n.body,
        "category": n.category, "tag": n.tag, "author": n.author,
        "cover_url": n.cover_url, "gallery": _read_gallery(n.gallery),
        "featured": n.featured, "pinned": n.pinned,
        "visible": n.visible, "published_at": n.published_at,
    }


@router.get("/news")
def admin_list_news(db: Session = Depends(get_db), _=Depends(require_module("news", "view"))):
    rows = (db.query(models.News)
            .filter(models.News.deleted_at.is_(None))
            .order_by(models.News.pinned.desc(), models.News.published_at.desc()).all())
    return [news_out(n) for n in rows]


@router.post("/news")
def admin_create_news(data: NewsAdminIn, db: Session = Depends(get_db), user=Depends(require_module("news", "create")),
                      request: Request = None):
    row = models.News(
        title=data.title or "Bản tin chưa đặt tiêu đề",
        excerpt=data.excerpt or "", body=data.body or "",
        category=data.category or "Hoạt động", tag=data.tag or "Tin tức",
        author=data.author or user.full_name, cover_url=data.cover_url,
        gallery=__import__("json").dumps(data.gallery or [], ensure_ascii=False),
        featured=bool(data.featured), pinned=bool(data.pinned),
        visible=True if data.visible is None else data.visible,
        published_at=data.published_at or models.now(),
    )
    db.add(row); db.commit(); db.refresh(row)
    log_action(db, user, "create", "news", row.id, row.title, request=request)
    return news_out(row)


@router.put("/news/{news_id}")
def admin_update_news(news_id: int, data: NewsAdminIn, db: Session = Depends(get_db),
                      user=Depends(require_module("news", "update")), request: Request = None,
                      background_tasks: BackgroundTasks = None):
    row = get_or_404(db, models.News, news_id)
    if row.deleted_at is not None:
        raise HTTPException(400, "Bản tin đang ở thùng rác. Khôi phục trước khi sửa.")
    payload = data.model_dump()
    if payload.get("gallery") is not None:
        row.gallery = __import__("json").dumps(payload.pop("gallery"), ensure_ascii=False)
    else:
        payload.pop("gallery", None)
    # Ba trường đúng/sai phải cho phép gán về False nên xử lý riêng
    for flag in ("featured", "pinned", "visible"):
        if payload.get(flag) is not None:
            setattr(row, flag, payload.pop(flag))
        else:
            payload.pop(flag, None)
    apply(row, payload)
    db.commit(); db.refresh(row)
    log_action(db, user, "update", "news", row.id, row.title, request=request)
    if background_tasks is not None:
        background_tasks.add_task(notify_alert, user, "update", "news", row.title)
    return news_out(row)


@router.delete("/news/{news_id}")
def admin_delete_news(news_id: int, db: Session = Depends(get_db), user=Depends(require_module("news", "delete")),
                      request: Request = None, background_tasks: BackgroundTasks = None):
    """Không xoá thật — chuyển vào thùng rác, quản trị viên duyệt xoá hẳn hoặc tự xoá sau 30 ngày."""
    row = get_or_404(db, models.News, news_id)
    if row.deleted_at is not None:
        raise HTTPException(400, "Bản tin này đã ở trong thùng rác.")
    label = row.title
    row.deleted_at = models.now()
    row.deleted_by = user.full_name
    db.commit()
    log_action(db, user, "delete", "news", news_id, label, detail="Chuyển vào thùng rác", request=request)
    if background_tasks is not None:
        background_tasks.add_task(notify_alert, user, "delete", "news", label)
    return {"deleted": news_id, "trashed": True}


# ========================================================== Quản lý thông báo

class NoticeIn(BaseModel):
    content: Optional[str] = None
    level: Optional[str] = None
    active: Optional[bool] = None


@router.get("/notices")
def admin_list_notices(db: Session = Depends(get_db), _=Depends(require_module("notices", "view"))):
    rows = db.query(models.Notice).order_by(models.Notice.starts_at.desc()).all()
    return [{"id": n.id, "content": n.content, "level": n.level,
             "active": n.active, "starts_at": n.starts_at} for n in rows]


@router.post("/notices")
def admin_create_notice(data: NoticeIn, db: Session = Depends(get_db), user=Depends(require_module("notices", "create")),
                        request: Request = None):
    row = models.Notice(content=data.content or "", level=data.level or "urgent",
                        active=True if data.active is None else data.active)
    db.add(row); db.commit(); db.refresh(row)
    log_action(db, user, "create", "notices", row.id, row.content, request=request)
    return {"id": row.id}


@router.put("/notices/{nid}")
def admin_update_notice(nid: int, data: NoticeIn, db: Session = Depends(get_db), user=Depends(require_module("notices", "update")),
                        request: Request = None):
    row = get_or_404(db, models.Notice, nid)
    if data.active is not None:
        row.active = data.active
    apply(row, {"content": data.content, "level": data.level})
    db.commit()
    log_action(db, user, "update", "notices", row.id, row.content, request=request)
    return {"id": row.id}


@router.delete("/notices/{nid}")
def admin_delete_notice(nid: int, db: Session = Depends(get_db), user=Depends(require_module("notices", "delete")),
                        request: Request = None):
    row = get_or_404(db, models.Notice, nid)
    label = row.content
    db.delete(row); db.commit()
    log_action(db, user, "delete", "notices", nid, label, request=request)
    return {"deleted": nid}


# =========================================================== Quản lý banner

class BannerIn(BaseModel):
    title: Optional[str] = None
    image_url: Optional[str] = None
    link_url: Optional[str] = None
    color: Optional[str] = None
    order_no: Optional[int] = None
    active: Optional[bool] = None


@router.get("/banners")
def admin_list_banners(db: Session = Depends(get_db), _=Depends(require_module("banners", "view"))):
    rows = db.query(models.Banner).order_by(models.Banner.order_no).all()
    return [{"id": b.id, "title": b.title, "image_url": b.image_url,
             "link_url": b.link_url, "color": b.color, "order_no": b.order_no,
             "active": b.active} for b in rows]


@router.post("/banners")
def admin_create_banner(data: BannerIn, db: Session = Depends(get_db), user=Depends(require_module("banners", "create")),
                        request: Request = None):
    row = models.Banner(title=data.title or "Banner mới", image_url=data.image_url,
                        link_url=data.link_url, color=data.color or "#EA0A2A",
                        order_no=data.order_no or 0,
                        active=True if data.active is None else data.active)
    db.add(row); db.commit(); db.refresh(row)
    log_action(db, user, "create", "banners", row.id, row.title, request=request)
    return {"id": row.id}


@router.put("/banners/{bid}")
def admin_update_banner(bid: int, data: BannerIn, db: Session = Depends(get_db), user=Depends(require_module("banners", "update")),
                        request: Request = None):
    row = get_or_404(db, models.Banner, bid)
    if data.active is not None:
        row.active = data.active
    apply(row, {k: v for k, v in data.model_dump().items() if k != "active"})
    db.commit()
    log_action(db, user, "update", "banners", row.id, row.title, request=request)
    return {"id": row.id}


@router.delete("/banners/{bid}")
def admin_delete_banner(bid: int, db: Session = Depends(get_db), user=Depends(require_module("banners", "delete")),
                        request: Request = None):
    row = get_or_404(db, models.Banner, bid)
    label = row.title
    db.delete(row); db.commit()
    log_action(db, user, "delete", "banners", bid, label, request=request)
    return {"deleted": bid}


# =========================================================== Quản lý ứng dụng

class AppIn(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    url: Optional[str] = None
    category: Optional[str] = None
    color: Optional[str] = None
    icon_url: Optional[str] = None
    order_no: Optional[int] = None


@router.get("/apps")
def admin_list_apps(db: Session = Depends(get_db), _=Depends(require_module("apps", "view"))):
    """Danh sách ứng dụng dành riêng cho màn hình quản trị.

    Dùng endpoint có xác thực thay vì đọc endpoint công khai để tránh trường hợp
    giao diện quản trị đang nhìn thấy dữ liệu cũ/dự phòng trong khi thao tác ghi
    đã thành công.
    """
    rows = db.query(models.AppLink).order_by(models.AppLink.order_no, models.AppLink.id).all()
    return [app_out(a) for a in rows]


def app_out(a: models.AppLink):
    return {
        "id": a.id,
        "name": a.name,
        "description": a.description or "",
        "url": a.url or "",
        "category": a.category or "Chi nhánh",
        "color": a.color or "#EA0A2A",
        "icon_url": a.icon_url or "",
        "order_no": a.order_no or 0,
    }


@router.post("/apps")
def admin_create_app(data: AppIn, db: Session = Depends(get_db), user=Depends(require_module("apps", "create")),
                     request: Request = None):
    name = (data.name or "").strip()
    if not name:
        raise HTTPException(400, "Chưa nhập tên ứng dụng.")
    try:
        row = models.AppLink(
            name=name,
            description=(data.description or "").strip(),
            url=(data.url or "").strip() or "#",
            category=(data.category or "Chi nhánh").strip(),
            color=data.color or "#EA0A2A",
            icon_url=(data.icon_url or "").strip(),
            order_no=0 if data.order_no is None else data.order_no,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        log_action(db, user, "create", "apps", row.id, row.name, request=request)
        return app_out(row)
    except Exception:
        db.rollback()
        raise


@router.put("/apps/{aid}")
def admin_update_app(aid: int, data: AppIn, db: Session = Depends(get_db), user=Depends(require_module("apps", "update")),
                     request: Request = None):
    row = get_or_404(db, models.AppLink, aid)
    payload = data.model_dump(exclude_unset=True)
    if "name" in payload:
        name = (payload["name"] or "").strip()
        if not name:
            raise HTTPException(400, "Tên ứng dụng không được để trống.")
        payload["name"] = name
    if "description" in payload and payload["description"] is not None:
        payload["description"] = payload["description"].strip()
    if "url" in payload and payload["url"] is not None:
        payload["url"] = payload["url"].strip() or "#"
    if "category" in payload and payload["category"] is not None:
        payload["category"] = payload["category"].strip()
    if "icon_url" in payload and payload["icon_url"] is not None:
        payload["icon_url"] = payload["icon_url"].strip()
    try:
        apply(row, payload)
        db.commit()
        db.refresh(row)
        log_action(db, user, "update", "apps", row.id, row.name, request=request)
        return app_out(row)
    except Exception:
        db.rollback()
        raise


@router.delete("/apps/{aid}")
def admin_delete_app(aid: int, db: Session = Depends(get_db), user=Depends(require_module("apps", "delete")),
                     request: Request = None):
    row = get_or_404(db, models.AppLink, aid)
    label = row.name
    try:
        db.delete(row)
        db.commit()
        log_action(db, user, "delete", "apps", aid, label, request=request)
        return {"deleted": aid}
    except Exception:
        db.rollback()
        raise


# =========================================================== Quản lý tài liệu

# Danh mục tài liệu. Sửa ở đây là cả màn hình quản trị lẫn bộ lọc ngoài trang
# công khai đều đổi theo, không phải sửa hai nơi.
DOC_CATEGORIES = [
    "Quy trình",
    "Quy định",
    "Hướng dẫn kỹ thuật",
    "Biểu mẫu",
    "Văn bản",
    "Cơ điện",
    "Truyền dẫn",
    "Vô tuyến",
    "Hạ tầng",
    "Vận hành khai thác",
    "An toàn lao động",
    "An toàn thông tin",
    "Tài chính",
    "Xăng dầu",
    "Vật tư",
    "Tổ chức - Nhân sự",
    "Đào tạo",
    "Khác",
]


class DocIn(BaseModel):
    title: Optional[str] = None
    code: Optional[str] = None
    category: Optional[str] = None
    file_url: Optional[str] = None
    size_label: Optional[str] = None
    content_text: Optional[str] = None
    updated_on: Optional[dt.date] = None


@router.post("/documents")
def admin_create_doc(data: DocIn, db: Session = Depends(get_db), user=Depends(require_module("documents", "create")),
                     request: Request = None):
    row = models.Document(
        title=data.title or "Tài liệu mới", code=data.code or "",
        category=data.category or "Văn bản", file_url=data.file_url or "",
        size_label=data.size_label or "", content_text=data.content_text or "",
        updated_on=data.updated_on or models.today())
    db.add(row); db.commit(); db.refresh(row)
    log_action(db, user, "create", "documents", row.id, row.title, request=request)
    return {"id": row.id}


@router.put("/documents/{did}")
def admin_update_doc(did: int, data: DocIn, db: Session = Depends(get_db), user=Depends(require_module("documents", "update")),
                     request: Request = None):
    row = get_or_404(db, models.Document, did)
    if row.deleted_at is not None:
        raise HTTPException(400, "Tài liệu đang ở thùng rác. Khôi phục trước khi sửa.")
    apply(row, data.model_dump()); db.commit()
    log_action(db, user, "update", "documents", row.id, row.title, request=request)
    return {"id": row.id}


@router.delete("/documents/{did}")
def admin_delete_doc(did: int, db: Session = Depends(get_db), user=Depends(require_module("documents", "delete")),
                     request: Request = None):
    """Không xoá thật — chuyển vào thùng rác, quản trị viên duyệt xoá hẳn hoặc tự xoá sau 30 ngày."""
    row = get_or_404(db, models.Document, did)
    if row.deleted_at is not None:
        raise HTTPException(400, "Tài liệu này đã ở trong thùng rác.")
    label = row.title
    row.deleted_at = models.now()
    row.deleted_by = user.full_name
    db.commit()
    log_action(db, user, "delete", "documents", did, label, detail="Chuyển vào thùng rác", request=request)
    return {"deleted": did, "trashed": True}


# ========================================================== Quản lý nhân viên

class PersonIn(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    dept: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    photo_url: Optional[str] = None
    birthday: Optional[dt.date] = None
    color: Optional[str] = None
    active: Optional[bool] = None


def _csv_response(header: List[str], rows: List[list], filename: str) -> PlainTextResponse:
    """Xuất CSV chuẩn Excel Việt Nam: BOM UTF-8, ngăn cách bằng dấu phẩy, giá trị trong ngoặc kép."""
    lines = [",".join(header)]
    for vals in rows:
        lines.append(",".join('"' + str(v if v is not None else "").replace('"', '""') + '"' for v in vals))
    content = "﻿" + "\n".join(lines) + "\n"
    return PlainTextResponse(
        content, media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def person_out(p: models.Person):
    return {"id": p.id, "full_name": p.full_name, "role": p.role, "dept": p.dept,
            "phone": p.phone, "email": p.email, "photo_url": p.photo_url,
            "birthday": p.birthday, "color": p.color, "active": p.active}


@router.get("/people")
def admin_list_people(db: Session = Depends(get_db), _=Depends(require_module("people", "view"))):
    return [person_out(p) for p in db.query(models.Person).order_by(models.Person.id).all()]


@router.get("/people/export")
def export_people_csv(db: Session = Depends(get_db), _=Depends(require_module("people", "view"))):
    """Xuất danh sách nhân viên ra tệp CSV."""
    rows = db.query(models.Person).order_by(models.Person.full_name).all()
    header = ["Họ và tên", "Chức vụ", "Phòng ban", "Điện thoại", "Email", "Ngày sinh", "Đang công tác"]
    vals = [
        [p.full_name, p.role, p.dept, p.phone, p.email,
         p.birthday.strftime("%d/%m/%Y") if p.birthday else "",
         "Có" if p.active else "Không"]
        for p in rows
    ]
    return _csv_response(header, vals, f"danh-sach-nhan-vien-{models.today()}.csv")


@router.post("/people")
def admin_create_person(data: PersonIn, db: Session = Depends(get_db), user=Depends(require_module("people", "create")),
                        request: Request = None):
    row = models.Person(
        full_name=data.full_name or "Chưa đặt tên", role=data.role or "",
        dept=data.dept or "", phone=data.phone or "", email=data.email or "",
        photo_url=data.photo_url, birthday=data.birthday,
        color=data.color or "#EA0A2A",
        active=True if data.active is None else data.active)
    db.add(row); db.commit(); db.refresh(row)
    log_action(db, user, "create", "people", row.id, row.full_name, request=request)
    return person_out(row)


@router.put("/people/{pid}")
def admin_update_person(pid: int, data: PersonIn, db: Session = Depends(get_db), user=Depends(require_module("people", "update")),
                        request: Request = None):
    row = get_or_404(db, models.Person, pid)
    payload = data.model_dump(exclude_unset=True)
    if "full_name" in payload and payload["full_name"] is not None:
        payload["full_name"] = str(payload["full_name"]).strip() or row.full_name
    if "active" in payload and payload["active"] is not None:
        row.active = bool(payload.pop("active"))
    apply(row, payload)
    try:
        db.commit()
        db.refresh(row)
    except Exception:
        db.rollback()
        raise
    log_action(db, user, "update", "people", row.id, row.full_name, request=request)
    return person_out(row)


@router.delete("/people/{pid}")
def admin_delete_person(pid: int, db: Session = Depends(get_db), user=Depends(require_module("people", "delete")),
                        request: Request = None):
    row = get_or_404(db, models.Person, pid)
    label = row.full_name
    db.delete(row); db.commit()
    log_action(db, user, "delete", "people", pid, label, request=request)
    return {"deleted": pid}


# ============================================ Quản lý sự kiện (Góc văn hoá)

class EventIn(BaseModel):
    title: Optional[str] = None
    start_at: Optional[dt.datetime] = None
    place: Optional[str] = None
    host: Optional[str] = None
    kind: Optional[str] = None
    participants: Optional[str] = None
    meeting_type: Optional[str] = None
    meeting_info: Optional[str] = None
    meeting_id: Optional[str] = None
    meeting_pass: Optional[str] = None


MEETING_TYPES = {
    "truc_tiep": {"label": "Họp trực tiếp", "can_thong_tin": False,
                  "goi_y": "Ghi phòng họp ở ô Địa điểm"},
    "cau_truyen_hinh": {"label": "Cầu truyền hình", "can_thong_tin": True,
                        "goi_y": "Nhập địa chỉ IP điểm cầu, ví dụ 10.255.58.3"},
    "zoom": {"label": "Zoom", "can_thong_tin": True,
             "goi_y": "Dán đường dẫn phòng họp Zoom"},
    "google_meet": {"label": "Google Meet", "can_thong_tin": True,
                    "goi_y": "Dán đường dẫn Google Meet"},
    "teams": {"label": "Microsoft Teams", "can_thong_tin": True,
              "goi_y": "Dán đường dẫn phòng họp Teams"},
    "khac": {"label": "Hình thức khác", "can_thong_tin": True,
             "goi_y": "Ghi thông tin kết nối nếu có"},
}


def event_out(e: models.Event):
    mt = e.meeting_type or "truc_tiep"
    return {
        "id": e.id, "title": e.title, "start_at": e.start_at,
        "place": e.place, "host": e.host, "kind": e.kind,
        "participants": e.participants,
        "meeting_type": mt,
        "meeting_type_label": MEETING_TYPES.get(mt, {}).get("label", mt),
        "meeting_info": e.meeting_info,
        "meeting_id": e.meeting_id,
        "meeting_pass": e.meeting_pass,
    }


@router.get("/meeting-types")
def list_meeting_types(_=Depends(require_module("events", "view"))):
    """Danh sách hình thức họp, dùng cho ô chọn trong màn hình quản trị."""
    return [{"value": k, **v} for k, v in MEETING_TYPES.items()]


@router.get("/events")
def admin_list_events(kind: Optional[str] = None, db: Session = Depends(get_db), _=Depends(require_module("events", "view"))):
    q = db.query(models.Event)
    if kind:
        q = q.filter(models.Event.kind == kind)
    return [event_out(e) for e in q.order_by(models.Event.start_at).all()]


@router.get("/events/export")
def export_events_csv(kind: Optional[str] = None, db: Session = Depends(get_db),
                      _=Depends(require_module("events", "view"))):
    """Xuất lịch công tác (hoặc sự kiện văn hoá) ra tệp CSV."""
    q = db.query(models.Event)
    if kind:
        q = q.filter(models.Event.kind == kind)
    rows = q.order_by(models.Event.start_at).all()
    header = ["Ngày giờ", "Nội dung", "Địa điểm", "Đơn vị chủ trì", "Thành phần tham gia",
              "Hình thức họp", "Thông tin kết nối"]
    vals = [
        [e.start_at.strftime("%d/%m/%Y %H:%M") if e.start_at else "", e.title, e.place, e.host,
         e.participants, MEETING_TYPES.get(e.meeting_type or "truc_tiep", {}).get("label", e.meeting_type), e.meeting_info]
        for e in rows
    ]
    ten_tep = "lich-cong-tac-tuan" if (kind or "work") == "work" else f"su-kien-{kind}"
    return _csv_response(header, vals, f"{ten_tep}-{models.today()}.csv")


@router.post("/events")
def admin_create_event(data: EventIn, db: Session = Depends(get_db), user=Depends(require_module("events", "create")),
                       request: Request = None):
    row = models.Event(title=data.title or "Sự kiện mới",
                       start_at=data.start_at or models.now(),
                       place=data.place or "", host=data.host or "",
                       kind=data.kind or "culture",
                       participants=data.participants or "",
                       meeting_type=data.meeting_type or "truc_tiep",
                       meeting_info=data.meeting_info or "",
                       meeting_id=data.meeting_id or "",
                       meeting_pass=data.meeting_pass or "")
    db.add(row); db.commit(); db.refresh(row)
    log_action(db, user, "create", "events", row.id, row.title, request=request)
    return event_out(row)


@router.put("/events/{eid}")
def admin_update_event(eid: int, data: EventIn, db: Session = Depends(get_db), user=Depends(require_module("events", "update")),
                       request: Request = None):
    row = get_or_404(db, models.Event, eid)
    apply(row, data.model_dump()); db.commit(); db.refresh(row)
    log_action(db, user, "update", "events", row.id, row.title, request=request)
    return event_out(row)


@router.delete("/events/{eid}")
def admin_delete_event(eid: int, db: Session = Depends(get_db), user=Depends(require_module("events", "delete")),
                       request: Request = None):
    row = get_or_404(db, models.Event, eid)
    label = row.title
    db.delete(row); db.commit()
    log_action(db, user, "delete", "events", eid, label, request=request)
    return {"deleted": eid}


# ======================================================== Cấu hình website

class ConfigIn(BaseModel):
    values: dict


@router.get("/config")
def admin_get_config(db: Session = Depends(get_db), _=Depends(require_admin)):
    rows = db.query(models.SiteConfig).order_by(models.SiteConfig.id).all()
    return [{"key": c.key, "value": c.value, "label": c.label, "kind": c.kind} for c in rows]


@router.put("/config")
def admin_set_config(data: ConfigIn, db: Session = Depends(get_db), user=Depends(require_admin),
                     request: Request = None, background_tasks: BackgroundTasks = None):
    for key, value in data.values.items():
        row = db.query(models.SiteConfig).filter(models.SiteConfig.key == key).first()
        if row:
            row.value = value
        else:
            db.add(models.SiteConfig(key=key, value=value, label=key))
    db.commit()
    changed_keys = ", ".join(data.values.keys())
    log_action(db, user, "config", "config", None, changed_keys, request=request)
    if background_tasks is not None:
        background_tasks.add_task(notify_alert, user, "config", "config", changed_keys)
    return {"saved": len(data.values)}


# ======================================================== Cài đặt thông báo

NOTIFY_TOGGLE_KEYS = ("notify_email_on", "notify_telegram_on", "notify_bell_on")


class NotifySettingsIn(BaseModel):
    telegram_bot_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    notify_email_on: Optional[bool] = None
    notify_telegram_on: Optional[bool] = None
    notify_bell_on: Optional[bool] = None


def _notify_settings_out():
    s = get_notify_settings()
    return {
        **s,
        "email_configured": smtp_configured(),
        "telegram_configured": telegram_configured(s),
    }


@router.get("/notifications/settings")
def admin_get_notify_settings(_=Depends(require_admin)):
    return _notify_settings_out()


@router.put("/notifications/settings")
def admin_set_notify_settings(data: NotifySettingsIn, db: Session = Depends(get_db),
                              user=Depends(require_admin), request: Request = None):
    values = {}
    if data.telegram_bot_token is not None:
        values["telegram_bot_token"] = data.telegram_bot_token.strip()
    if data.telegram_chat_id is not None:
        values["telegram_chat_id"] = data.telegram_chat_id.strip()
    for key in ("notify_email_on", "notify_telegram_on", "notify_bell_on"):
        v = getattr(data, key)
        if v is not None:
            values[key] = "1" if v else "0"

    for key, value in values.items():
        row = db.query(models.SiteConfig).filter(models.SiteConfig.key == key).first()
        if row:
            row.value = value
        else:
            db.add(models.SiteConfig(key=key, value=value, label=key))
    db.commit()
    log_action(db, user, "update", "notifications", None, "Cài đặt thông báo", request=request)
    return _notify_settings_out()


@router.post("/notifications/test-telegram")
def admin_test_telegram(_=Depends(require_admin)):
    settings = get_notify_settings()
    if not telegram_configured(settings):
        raise HTTPException(400, "Chưa nhập đủ Bot token và Chat ID.")
    ok = send_telegram_message(
        "🔔 Tin nhắn thử từ Cổng thông tin nội bộ CNCT — nếu bạn nhận được tin này, "
        "cấu hình Telegram đã đúng.",
        settings,
    )
    if not ok:
        raise HTTPException(400, "Gửi thất bại — kiểm tra lại Bot token/Chat ID, hoặc bot chưa được"
                                  " bắt đầu trò chuyện (bấm Start với bot trên Telegram trước).")
    return {"ok": True}


# ======================================================== Kiểm duyệt Trao đổi nội bộ

def _thread_out(t):
    return {
        "id": t.id, "title": t.title, "author": t.author_name, "tag": t.tag,
        "status": t.status, "channel": t.channel.name if t.channel else None,
        "channel_id": t.channel_id, "reply_count": len(t.replies), "created_at": t.created_at,
    }


def _reply_out(r):
    return {
        "id": r.id, "body": r.body, "author": r.author_name, "status": r.status,
        "thread_id": r.thread_id, "thread_title": r.thread.title if r.thread else None,
        "created_at": r.created_at,
    }


@router.get("/forum/threads")
def admin_list_threads(status: Optional[str] = None, db: Session = Depends(get_db),
                       _=Depends(require_admin)):
    q = db.query(models.Thread)
    if status:
        q = q.filter(models.Thread.status == status)
    rows = q.order_by(models.Thread.created_at.desc()).limit(300).all()
    return [_thread_out(t) for t in rows]


class ThreadModerateIn(BaseModel):
    title: Optional[str] = None
    tag: Optional[str] = None
    status: Optional[str] = None


@router.put("/forum/threads/{thread_id}")
def admin_update_thread(thread_id: int, data: ThreadModerateIn, db: Session = Depends(get_db),
                        user=Depends(require_admin), request: Request = None):
    t = db.get(models.Thread, thread_id)
    if not t:
        raise HTTPException(404, "Không tìm thấy chủ đề.")
    if data.title is not None:
        t.title = data.title
    if data.tag is not None:
        t.tag = data.tag
    if data.status is not None:
        if data.status not in ("pending", "approved"):
            raise HTTPException(400, "Trạng thái không hợp lệ.")
        t.status = data.status
    db.commit()
    log_action(db, user, "update", "forum", thread_id, t.title, request=request)
    return _thread_out(t)


@router.delete("/forum/threads/{thread_id}")
def admin_delete_thread(thread_id: int, db: Session = Depends(get_db),
                        user=Depends(require_admin), request: Request = None):
    t = db.get(models.Thread, thread_id)
    if not t:
        raise HTTPException(404, "Không tìm thấy chủ đề.")
    title = t.title
    db.delete(t); db.commit()
    log_action(db, user, "delete", "forum", thread_id, title, request=request)
    return {"deleted": thread_id}


@router.get("/forum/replies")
def admin_list_replies(status: Optional[str] = None, thread_id: Optional[int] = None,
                       db: Session = Depends(get_db), _=Depends(require_admin)):
    q = db.query(models.Reply)
    if status:
        q = q.filter(models.Reply.status == status)
    if thread_id:
        q = q.filter(models.Reply.thread_id == thread_id)
    rows = q.order_by(models.Reply.created_at.desc()).limit(300).all()
    return [_reply_out(r) for r in rows]


class ReplyModerateIn(BaseModel):
    body: Optional[str] = None
    status: Optional[str] = None


@router.put("/forum/replies/{reply_id}")
def admin_update_reply(reply_id: int, data: ReplyModerateIn, db: Session = Depends(get_db),
                       user=Depends(require_admin), request: Request = None):
    r = db.get(models.Reply, reply_id)
    if not r:
        raise HTTPException(404, "Không tìm thấy trả lời.")
    if data.body is not None:
        r.body = data.body
    if data.status is not None:
        if data.status not in ("pending", "approved"):
            raise HTTPException(400, "Trạng thái không hợp lệ.")
        r.status = data.status
    db.commit()
    log_action(db, user, "update", "forum", reply_id, (r.body or "")[:60], request=request)
    return _reply_out(r)


@router.delete("/forum/replies/{reply_id}")
def admin_delete_reply(reply_id: int, db: Session = Depends(get_db),
                       user=Depends(require_admin), request: Request = None):
    r = db.get(models.Reply, reply_id)
    if not r:
        raise HTTPException(404, "Không tìm thấy trả lời.")
    db.delete(r); db.commit()
    log_action(db, user, "delete", "forum", reply_id, "trả lời", request=request)
    return {"deleted": reply_id}


# ================================================ Tải dữ liệu và tài liệu

@router.get("/database/info")
def database_info(db: Session = Depends(get_db), _=Depends(require_admin)):
    """Cho biết dữ liệu đang nằm ở đâu và có bao nhiêu bản ghi mỗi bảng."""
    from .database import DATABASE_URL as url
    is_sqlite = url.startswith("sqlite")
    path = url.split("///")[-1] if is_sqlite else None
    size = os.path.getsize(path) if path and os.path.exists(path) else None

    counts = {}
    for label, model in [("Bản tin", models.News), ("Thông báo", models.Notice),
                         ("Banner", models.Banner), ("Ứng dụng", models.AppLink),
                         ("Tài liệu", models.Document), ("Nhân viên", models.Person),
                         ("Sự kiện", models.Event), ("Sáng kiến", models.Idea),
                         ("Chủ đề thảo luận", models.Thread), ("Số liệu", models.Metric)]:
        counts[label] = db.query(model).count()

    return {
        "engine": "SQLite" if is_sqlite else "PostgreSQL",
        "path": path,
        "size_kb": round(size / 1024) if size else None,
        "downloadable": bool(is_sqlite and path and os.path.exists(path)),
        "counts": counts,
    }


@router.get("/database/download")
def database_download(_=Depends(require_admin)):
    """Tải toàn bộ cơ sở dữ liệu về máy (chỉ áp dụng khi dùng SQLite)."""
    from .database import DATABASE_URL as url
    if not url.startswith("sqlite"):
        raise HTTPException(400,
            "Đang dùng PostgreSQL. Sao lưu bằng lệnh: bash backup.sh")
    path = url.split("///")[-1]
    if not os.path.exists(path):
        raise HTTPException(404, "Không tìm thấy tệp cơ sở dữ liệu.")
    name = f"portal-{models.today().isoformat()}.db"
    return FileResponse(path, filename=name, media_type="application/octet-stream")


# ========================================================= Quản lý tài khoản

from .auth import hash_password, verify_password  # noqa: E402  (đặt cuối cho gọn)

ROLE_LABELS = {
    "admin": "Quản trị viên",
    "editor": "Biên tập viên",
    "staff": "Nhân viên",
}


class UserIn(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    person_id: Optional[int] = None
    # Quyền thao tác theo module, ví dụ {"people": ["view", "update", "delete"]}.
    # Vẫn nhận danh sách cũ để nâng cấp không làm hỏng các client cũ.
    permissions: Optional[Union[List[str], Dict[str, List[str]]]] = None


class PasswordIn(BaseModel):
    password: str


class ChangePasswordIn(BaseModel):
    old_password: str
    new_password: str


def user_out(u: models.User):
    return {
        "id": u.id, "username": u.username, "full_name": u.full_name,
        "role": u.role, "role_label": ROLE_LABELS.get(u.role, u.role),
        "person_id": u.person_id,
        "person_name": u.person.full_name if u.person else None,
        "created_at": u.created_at,
        "permissions": effective_permissions_list(u),
        "permission_actions": effective_permission_matrix(u),
        "permissions_custom": u.permissions is not None and u.role != "admin",
        "must_change_password": bool(u.must_change_password),
    }


def check_password(pw: str):
    if not pw or len(pw) < 8:
        raise HTTPException(400, "Mật khẩu phải có ít nhất 8 ký tự.")


@router.get("/users")
def admin_list_users(db: Session = Depends(get_db), _=Depends(require_admin)):
    rows = db.query(models.User).order_by(models.User.id).all()
    return [user_out(u) for u in rows]


@router.get("/users/export")
def export_users_csv(db: Session = Depends(get_db), _=Depends(require_admin)):
    """Xuất danh sách tài khoản ra tệp CSV. Không xuất mật khẩu (chỉ lưu dạng băm, không có bản rõ)."""
    rows = db.query(models.User).order_by(models.User.username).all()
    header = ["Tên đăng nhập", "Họ và tên", "Quyền", "Gắn với nhân viên", "Ngày tạo", "Buộc đổi mật khẩu"]
    vals = [
        [u.username, u.full_name, ROLE_LABELS.get(u.role, u.role),
         u.person.full_name if u.person else "",
         u.created_at.strftime("%d/%m/%Y %H:%M") if u.created_at else "",
         "Có" if u.must_change_password else "Không"]
        for u in rows
    ]
    return _csv_response(header, vals, f"danh-sach-tai-khoan-{models.today()}.csv")


@router.get("/roles")
def admin_list_roles(_=Depends(require_admin)):
    """Danh sách quyền kèm mô tả, dùng cho ô chọn trong màn hình quản trị."""
    return [
        {"value": "admin", "label": "Quản trị viên",
         "desc": "Toàn quyền: quản lý nội dung, tài khoản và cấu hình website."},
        {"value": "editor", "label": "Biên tập viên",
         "desc": "Mặc định chỉ đăng bài (Tin tức) và Tài liệu. Quản trị viên có thể mở thêm module khác riêng cho từng tài khoản."},
        {"value": "staff", "label": "Nhân viên",
         "desc": "Mặc định không vào khu quản trị. Chỉ xem, bình chọn sáng kiến và đăng bài thảo luận."},
    ]


@router.get("/permissions/modules")
def admin_permission_modules(_=Depends(require_admin)):
    """Danh sách module có thể cấp riêng cho từng tài khoản, dùng cho ô tick chọn."""
    return {
        "modules": [{"id": m, "label": l} for m, l in MODULES],
        "actions": ["view", "create", "update", "delete"],
        "admin_only_modules": [{"id": m, "label": l} for m, l in ADMIN_ONLY_MODULES],
        "role_defaults": ROLE_DEFAULT_PERMISSIONS,
    }


@router.post("/users")
def admin_create_user(data: UserIn, db: Session = Depends(get_db), me=Depends(require_admin),
                      request: Request = None):
    username = (data.username or "").strip().lower()
    if not username:
        raise HTTPException(400, "Chưa nhập tên tài khoản.")
    if db.query(models.User).filter(models.User.username == username).first():
        raise HTTPException(400, f"Tài khoản “{username}” đã tồn tại.")
    check_password(data.password)
    if data.role not in ROLE_LABELS:
        raise HTTPException(400, "Quyền không hợp lệ.")

    row = models.User(
        username=username,
        password_hash=hash_password(data.password),
        full_name=data.full_name or username,
        role=data.role,
        person_id=data.person_id,
        permissions=dump_permissions(data.permissions) if data.permissions is not None else None,
    )
    db.add(row); db.commit(); db.refresh(row)
    log_action(db, me, "create", "users", row.id, row.username,
              detail=f"Quyền: {row.role}", request=request)
    return user_out(row)


@router.put("/users/{uid}")
def admin_update_user(uid: int, data: UserIn, db: Session = Depends(get_db),
                      me: models.User = Depends(require_admin), request: Request = None):
    row = get_or_404(db, models.User, uid)

    if data.role and data.role != row.role:
        if data.role not in ROLE_LABELS:
            raise HTTPException(400, "Quyền không hợp lệ.")
        # Không để hệ thống mất hết quản trị viên
        if row.role == "admin" and data.role != "admin":
            admins = db.query(models.User).filter(models.User.role == "admin").count()
            if admins <= 1:
                raise HTTPException(400, "Đây là quản trị viên duy nhất. Hãy cấp quyền cho người khác trước khi hạ quyền tài khoản này.")
        if row.id == me.id and data.role != "admin":
            raise HTTPException(400, "Không thể tự hạ quyền của chính mình.")
        row.role = data.role

    if data.permissions is not None:
        row.permissions = dump_permissions(data.permissions)

    apply(row, {"full_name": data.full_name, "person_id": data.person_id})
    db.commit(); db.refresh(row)
    log_action(db, me, "update", "users", row.id, row.username,
              detail=f"Quyền: {row.role}, module: {', '.join(effective_permissions_list(row)) or '—'}",
              request=request)
    return user_out(row)


@router.post("/users/{uid}/password")
def admin_reset_password(uid: int, data: PasswordIn, db: Session = Depends(get_db), me=Depends(require_admin),
                         request: Request = None):
    """Quản trị viên đặt lại mật khẩu khi người dùng quên."""
    row = get_or_404(db, models.User, uid)
    check_password(data.password)
    row.password_hash = hash_password(data.password)
    row.must_change_password = True
    db.commit()
    log_action(db, me, "password_reset", "users", row.id, row.username, request=request)
    return {"ok": True, "username": row.username}


@router.delete("/users/{uid}")
def admin_delete_user(uid: int, db: Session = Depends(get_db), me: models.User = Depends(require_admin),
                      request: Request = None):
    row = get_or_404(db, models.User, uid)
    if row.id == me.id:
        raise HTTPException(400, "Không thể xoá tài khoản bạn đang đăng nhập.")
    if row.role == "admin":
        admins = db.query(models.User).filter(models.User.role == "admin").count()
        if admins <= 1:
            raise HTTPException(400, "Không thể xoá quản trị viên duy nhất của hệ thống.")
    label = row.username
    db.delete(row); db.commit()
    log_action(db, me, "delete", "users", uid, label, request=request)
    return {"deleted": uid}


# =============================================== Tải ảnh lên từ máy tính

import json as _json      # noqa: E402
import secrets            # noqa: E402
import shutil             # noqa: E402
from fastapi import File, UploadFile   # noqa: E402

ALLOWED_IMAGE = {
    "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp",
    "image/gif": ".gif", "image/svg+xml": ".svg",
}
MAX_UPLOAD_MB = 8


def upload_dir() -> str:
    base = os.getenv("DATA_DIR") or os.path.join(os.getcwd(), "data")
    path = os.path.join(base, "uploads")
    os.makedirs(path, exist_ok=True)
    return path


@router.post("/upload")
async def admin_upload(file: UploadFile = File(...), db: Session = Depends(get_db),
                       user=Depends(require_module("uploads", "create")), request: Request = None):
    """Nhận một tệp ảnh, lưu vào thư mục dữ liệu, trả về đường dẫn để dùng."""
    ext = ALLOWED_IMAGE.get((file.content_type or "").lower())
    if not ext:
        raise HTTPException(400, "Chỉ nhận ảnh JPG, PNG, WEBP, GIF hoặc SVG.")

    name = f"{models.today().isoformat()}-{secrets.token_hex(6)}{ext}"
    dest = os.path.join(upload_dir(), name)

    size = 0
    limit = MAX_UPLOAD_MB * 1024 * 1024
    with open(dest, "wb") as out:
        while chunk := await file.read(1024 * 256):
            size += len(chunk)
            if size > limit:
                out.close()
                os.remove(dest)
                raise HTTPException(400, f"Ảnh vượt quá {MAX_UPLOAD_MB} MB. Hãy nén bớt rồi tải lại.")
            out.write(chunk)

    up = models.Upload(
        filename=name, original_name=file.filename, content_type=file.content_type,
        size_bytes=size, uploaded_by=user.full_name,
    )
    db.add(up)
    db.commit()
    log_action(db, user, "create", "uploads", up.id, file.filename, request=request)

    return {"url": f"/uploads/{name}", "filename": name,
            "size_kb": round(size / 1024), "original_name": file.filename}


@router.get("/uploads")
def admin_list_uploads(limit: int = 60, db: Session = Depends(get_db), _=Depends(require_module("uploads", "view"))):
    rows = (db.query(models.Upload)
            .order_by(models.Upload.created_at.desc()).limit(limit).all())
    return [{"id": u.id, "url": f"/uploads/{u.filename}", "original_name": u.original_name,
             "size_kb": round((u.size_bytes or 0) / 1024), "uploaded_by": u.uploaded_by,
             "created_at": u.created_at} for u in rows]


@router.delete("/uploads/{uid}")
def admin_delete_upload(uid: int, db: Session = Depends(get_db), user=Depends(require_module("uploads", "delete")),
                        request: Request = None):
    row = get_or_404(db, models.Upload, uid)
    path = os.path.join(upload_dir(), row.filename)
    if os.path.exists(path):
        os.remove(path)
    label = row.original_name or row.filename
    db.delete(row); db.commit()
    log_action(db, user, "delete", "uploads", uid, label, request=request)
    return {"deleted": uid}


# ==================================== Nguồn dữ liệu từ Google Sheet

from .sheets import (   # noqa: E402
    KIND_LABELS, SheetError, fetch_csv, normalize_url, PARSERS, sync_source,
)


class SheetIn(BaseModel):
    kind: Optional[str] = None
    name: Optional[str] = None
    csv_url: Optional[str] = None
    active: Optional[bool] = None


def sheet_out(s: models.SheetSource):
    return {
        "id": s.id, "kind": s.kind, "kind_label": KIND_LABELS.get(s.kind, s.kind),
        "name": s.name, "csv_url": s.csv_url, "active": s.active,
        "row_count": s.row_count, "last_sync_at": s.last_sync_at,
        "last_status": s.last_status, "last_error": s.last_error,
    }


@router.get("/sheets")
def admin_list_sheets(db: Session = Depends(get_db), _=Depends(require_module("sheets", "view"))):
    rows = db.query(models.SheetSource).order_by(models.SheetSource.id).all()
    return [sheet_out(s) for s in rows]


@router.get("/sheets/kinds")
def admin_sheet_kinds(_=Depends(require_module("sheets", "view"))):
    """Mô tả từng loại sheet kèm các cột bắt buộc, hiển thị trong màn hình quản trị."""
    return [
        {"kind": "home_stats", "label": "Chỉ số trang chủ",
         "desc": "Sáu ô số liệu lớn trên trang chủ: KPI tháng, WO đúng hạn, tiền phạt, sự cố ngày, WO quá hạn, an toàn.",
         "columns": ["ma", "nhan", "gia_tri", "don_vi", "muc_tieu", "ghi_chu", "mau", "tien_do"],
         "required": ["ma", "nhan", "gia_tri"]},
        {"kind": "dashboard", "label": "Số liệu Dashboard",
         "desc": "Số liệu vẽ biểu đồ. Cột 'bang' nhận: KPI, WO, PAKH, FUEL, HIRE, OUTPUT, NETWORK.",
         "columns": ["bang", "ky", "chi_tieu", "don_vi", "gia_tri"],
         "required": ["bang", "ky", "chi_tieu", "gia_tri"]},
        {"kind": "schedule", "label": "Lịch công tác",
         "desc": "Lịch công tác theo tuần. Trang chủ tự lọc ra các việc của ngày hôm nay.",
         "columns": ["ngay", "gio", "noi_dung", "dia_diem", "chu_tri"],
         "required": ["ngay", "noi_dung"]},
    ]


@router.post("/sheets")
def admin_create_sheet(data: SheetIn, db: Session = Depends(get_db), user=Depends(require_module("sheets", "create")),
                       request: Request = None):
    if data.kind not in PARSERS:
        raise HTTPException(400, "Loại nguồn dữ liệu không hợp lệ.")
    row = models.SheetSource(
        kind=data.kind, name=data.name or KIND_LABELS.get(data.kind, data.kind),
        csv_url=(data.csv_url or "").strip(),
        active=True if data.active is None else data.active,
    )
    db.add(row); db.commit(); db.refresh(row)
    sync_source(row, db, force=True)
    log_action(db, user, "create", "sheets", row.id, row.name, request=request)
    return sheet_out(row)


@router.put("/sheets/{sid}")
def admin_update_sheet(sid: int, data: SheetIn, db: Session = Depends(get_db), user=Depends(require_module("sheets", "update")),
                       request: Request = None):
    row = get_or_404(db, models.SheetSource, sid)
    if data.active is not None:
        row.active = data.active
    apply(row, {"name": data.name, "csv_url": (data.csv_url or "").strip() or None})
    db.commit()
    if row.active:
        sync_source(row, db, force=True)
    db.refresh(row)
    log_action(db, user, "update", "sheets", row.id, row.name, request=request)
    return sheet_out(row)


@router.delete("/sheets/{sid}")
def admin_delete_sheet(sid: int, db: Session = Depends(get_db), user=Depends(require_module("sheets", "delete")),
                       request: Request = None):
    row = get_or_404(db, models.SheetSource, sid)
    label = row.name
    db.delete(row); db.commit()
    log_action(db, user, "delete", "sheets", sid, label, request=request)
    return {"deleted": sid}


@router.post("/sheets/{sid}/sync")
def admin_sync_sheet(sid: int, db: Session = Depends(get_db), user=Depends(require_module("sheets", "update")),
                     request: Request = None):
    row = get_or_404(db, models.SheetSource, sid)
    ok, msg = sync_source(row, db, force=True)
    db.refresh(row)
    log_action(db, user, "sync", "sheets", row.id, row.name, detail=msg, request=request)
    return {"ok": ok, "message": msg, "source": sheet_out(row)}


@router.post("/sheets/preview")
def admin_preview_sheet(data: SheetIn, _=Depends(require_module("sheets", "view"))):
    """
    Thử đọc bảng tính mà chưa lưu gì, để người dùng kiểm tra trước.
    Trả về vài dòng đầu và báo lỗi rõ ràng nếu sai định dạng.
    """
    if data.kind not in PARSERS:
        raise HTTPException(400, "Loại nguồn dữ liệu không hợp lệ.")
    try:
        text = fetch_csv(data.csv_url or "")
        rows = PARSERS[data.kind](text)
    except SheetError as e:
        raise HTTPException(400, str(e))
    return {
        "ok": True, "row_count": len(rows), "sample": rows[:5],
        "resolved_url": normalize_url(data.csv_url or ""),
    }


# ========================================= Quản lý dashboard — thêm thủ công

def metric_out(m: models.Metric):
    return {"id": m.id, "board": m.board, "period": m.period, "label": m.label,
            "unit_name": m.unit_name, "value": m.value}


class MetricIn(BaseModel):
    board: Optional[str] = None
    period: Optional[str] = None
    label: Optional[str] = None
    unit_name: Optional[str] = None
    value: Optional[float] = None


@router.get("/metrics")
def admin_list_metrics(board: Optional[str] = None, db: Session = Depends(get_db),
                       _=Depends(require_module("dashboard", "view"))):
    q = db.query(models.Metric)
    if board:
        q = q.filter(models.Metric.board == board.strip().upper())
    rows = q.order_by(models.Metric.board, models.Metric.period.desc()).limit(1000).all()
    return [metric_out(m) for m in rows]


def _slug(text: str) -> str:
    """
    Bỏ dấu, chỉ giữ chữ/số/gạch ngang — dùng đặt tên tệp tải xuống.

    "Đ"/"đ" KHÔNG bỏ dấu được bằng NFD (không phải chữ cái + dấu phụ ghép lại,
    mà là một ký tự Unicode riêng — unicodedata coi nó là chữ cái hợp lệ, isalnum()
    trả True) nên phải đổi tay trước; để sót thì tên tệp còn ký tự ngoài
    ASCII, ghi vào header Content-Disposition sẽ vỡ (UnicodeEncodeError, lỗi
    500) — đã xảy ra thật với "Rời mạng CĐBR"/"XLCS CĐBR" khi xuất báo cáo.
    """
    import unicodedata
    text = text.replace("Đ", "D").replace("đ", "d")
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = "".join(ch if ch.isalnum() else "-" for ch in text)
    while "--" in text:
        text = text.replace("--", "-")
    return text.strip("-") or "hang-muc"


# Tên hiển thị của từng mã bảng — PHẢI khớp với DASHBOARD_BOARDS trong
# frontend/src/admin.jsx (nguồn hiển thị cho khu quản trị). Chỉ dùng để thêm
# cột đọc-hiểu-ngay "ten_bang" khi xuất báo cáo; cột "bang" (mã) vẫn giữ
# nguyên không đổi, để tệp xuất ra nhập ngược lại hệ thống vẫn hoạt động.
BOARD_LABELS = {
    "PAKH": "Sự cố truyền dẫn (theo tỉnh)",
    "PAKH_TARGET": "Chỉ tiêu/Target Sự cố truyền dẫn",
    "FUEL": "Ksub*min (theo tỉnh)",
    "FUEL_TARGET": "Chỉ tiêu/Target Ksub*min",
    "OUTPUT": "GĐTT & Cell*h tổng (theo tỉnh)",
    "OUTPUT_TARGET": "Chỉ tiêu/Target GĐTT & Cell*h",
    "NETWORK": "XLCS CĐBR (Số PA phát sinh, XLCS 3h/10h/24h)",
    "NETWORK_TARGET": "Chỉ tiêu/Target XLCS CĐBR",
    "VHKT": "TKM CĐBR (Triển khai mới, KPI TKM 3h/10h/24h)",
    "VHKT_TARGET": "Chỉ tiêu/Target TKM CĐBR",
    "KPI": "Tiền phạt & Doanh thu",
    "KPI_TARGET": "Chỉ tiêu/Target Tiền phạt & Doanh thu",
    "KPI_VTNET": "Nguyên nhân phạt — nhóm VTNet",
    "KPI_VTT": "Nguyên nhân phạt — nhóm VTT",
    "WO": "Rời mạng CĐBR (tỷ lệ / số lượng KH)",
    "WO_TARGET": "Chỉ tiêu/Target Rời mạng CĐBR",
    "WO_TINH": "Rời mạng CĐBR — số lượng theo tỉnh",
    "WO_HUYEN_BD": "Rời mạng CĐBR — theo huyện (Bình Dương)",
    "WO_HUYEN_BRVT": "Rời mạng CĐBR — theo huyện (Bà Rịa - Vũng Tàu)",
}


@router.get("/metrics/export")
def export_metrics_csv(board: Optional[str] = None, nhom: Optional[str] = None,
                       db: Session = Depends(get_db),
                       _=Depends(require_module("dashboard", "view"))):
    """
    Xuất số liệu Dashboard ra CSV — cột "bang" giữ nguyên mã (dùng đúng tên
    cột của màn "Nhập từ Excel": bang, ky, chi_tieu, don_vi, gia_tri) nên tải
    xuống, sửa/lọc lại trong Excel rồi nhập ngược lên là ghi đè đúng dòng cũ
    (không tạo bản trùng). Thêm cột "ten_bang" (tên bảng đọc-hiểu-ngay, khớp
    đúng tên hiển thị trên Dashboard) để xem trong Excel không cần tra mã —
    cột này bị bỏ qua khi nhập ngược lên, không ảnh hưởng việc ghi đè.

    `board` nhận một hoặc nhiều mã bảng cách nhau bằng dấu phẩy (ví dụ
    "KPI,KPI_TARGET,KPI_VTT,KPI_VTNET") để xuất gộp cả một hạng mục Dashboard
    (một tab) trong một tệp. `nhom` chỉ dùng để đặt tên tệp cho dễ nhận biết.
    """
    q = db.query(models.Metric)
    ten_tep = "so-lieu-dashboard"
    if board:
        ma_bang = [b.strip().upper() for b in board.split(",") if b.strip()]
        q = q.filter(models.Metric.board.in_(ma_bang))
        ten_tep = f"so-lieu-dashboard-{_slug(nhom) if nhom else '-'.join(ma_bang)}"
    rows = q.order_by(models.Metric.board, models.Metric.period).all()
    header = ["bang", "ten_bang", "ky", "chi_tieu", "don_vi", "gia_tri"]
    vals = [[m.board, BOARD_LABELS.get(m.board, m.board), m.period, m.label, m.unit_name or "", m.value] for m in rows]
    return _csv_response(header, vals, f"{ten_tep}-{models.today()}.csv")


@router.post("/metrics")
def admin_create_metric(data: MetricIn, db: Session = Depends(get_db),
                        user=Depends(require_module("dashboard", "create")), request: Request = None):
    if not (data.board or "").strip():
        raise HTTPException(400, "Chưa chọn bảng.")
    if not (data.period or "").strip():
        raise HTTPException(400, "Chưa nhập kỳ.")
    if not (data.label or "").strip():
        raise HTTPException(400, "Chưa nhập tên chỉ tiêu.")
    if data.value is None:
        raise HTTPException(400, "Chưa nhập giá trị.")
    row = models.Metric(
        board=data.board.strip().upper(), period=data.period.strip(), label=data.label.strip(),
        unit_name=(data.unit_name or "").strip() or None, value=data.value,
    )
    db.add(row); db.commit(); db.refresh(row)
    log_action(db, user, "create", "dashboard", row.id, f"{row.board}/{row.period}/{row.label}", request=request)
    return metric_out(row)


@router.put("/metrics/{item_id}")
def admin_update_metric(item_id: int, data: MetricIn, db: Session = Depends(get_db),
                        user=Depends(require_module("dashboard", "update")), request: Request = None):
    row = db.get(models.Metric, item_id)
    if not row:
        raise HTTPException(404, "Không tìm thấy chỉ số.")
    vals = data.model_dump(exclude_unset=True)
    if vals.get("board"):
        vals["board"] = vals["board"].strip().upper()
    for k, v in vals.items():
        if v is not None and hasattr(row, k):
            setattr(row, k, v)
    db.commit(); db.refresh(row)
    log_action(db, user, "update", "dashboard", row.id, f"{row.board}/{row.period}/{row.label}", request=request)
    return metric_out(row)


@router.delete("/metrics/{item_id}")
def admin_delete_metric(item_id: int, db: Session = Depends(get_db),
                        user=Depends(require_module("dashboard", "delete")), request: Request = None):
    row = db.get(models.Metric, item_id)
    if not row:
        raise HTTPException(404, "Không tìm thấy chỉ số.")
    nhan = f"{row.board}/{row.period}/{row.label}"
    db.delete(row); db.commit()
    log_action(db, user, "delete", "dashboard", item_id, nhan, request=request)
    return {"deleted": item_id}


# ========================================= Nhập dữ liệu hàng loạt

from fastapi.responses import PlainTextResponse   # noqa: E402
from . import auth as auth_module                 # noqa: E402
from . import bulkimport as bi                    # noqa: E402


class ImportIn(BaseModel):
    kind: str
    text: Optional[str] = None      # dữ liệu dán trực tiếp từ Excel
    mode: str = "upsert"            # upsert | create_only
    commit: bool = False


@router.get("/import/kinds")
def import_kinds(kind: Optional[str] = None, user: models.User = Depends(current_user)):
    """Danh sách nhóm dữ liệu nhập được, kèm mô tả từng cột. Chỉ thuần mô tả
    cột (không phải dữ liệu thật) nên khi không truyền `kind` chỉ cần đăng
    nhập là xem được; truyền đúng `kind` thì kiểm tra đúng quyền của kind đó."""
    if kind is not None:
        check_import_kind_permission(user, kind, "view")
    return [
        {
            "kind": k,
            "label": v["label"],
            "note": v["note"],
            "columns": [
                {"name": c, "label": l, "required": r, "example": e}
                for c, l, r, e in v["columns"]
            ],
        }
        for k, v in bi.KINDS.items()
    ]


@router.get("/import/template-xlsx/{kind}")
def import_template_xlsx(kind: str, boards: Optional[str] = None, nhom: Optional[str] = None,
                         user: models.User = Depends(current_user)):
    """
    Tải tệp mẫu Excel: có dòng tiêu đề chuẩn, dòng ví dụ và trang hướng dẫn.

    `boards` (tuỳ chọn, cách nhau bằng dấu phẩy) và `nhom`: khi tải từ đúng
    một tab dashboard, giới hạn cột "bang" và tên tệp theo đúng tab đó thay vì
    tệp mẫu chung chung dùng lẫn cho mọi tab.
    """
    if kind not in bi.KINDS:
        raise HTTPException(404, "Không có nhóm dữ liệu này.")
    check_import_kind_permission(user, kind, "view")
    ma_bang = [b.strip().upper() for b in boards.split(",") if b.strip()] if boards else None
    try:
        content = bi.build_template_xlsx(kind, boards=ma_bang, nhom=nhom)
    except ImportError:
        raise HTTPException(
            500,
            "Máy chủ chưa cài thư viện tạo tệp Excel (openpyxl). "
            "Hãy dùng nút tải tệp mẫu CSV thay thế."
        )
    from fastapi.responses import Response
    ten_tep = f"mau-{kind}-{_slug(nhom)}" if nhom else f"mau-{kind}"
    return Response(
        content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{ten_tep}.xlsx"'},
    )


@router.get("/import/template/{kind}")
def import_template(kind: str, boards: Optional[str] = None, nhom: Optional[str] = None,
                    user: models.User = Depends(current_user)):
    """Tải tệp mẫu CSV có sẵn dòng tiêu đề đúng và một dòng ví dụ."""
    if kind not in bi.KINDS:
        raise HTTPException(404, "Không có nhóm dữ liệu này.")
    check_import_kind_permission(user, kind, "view")
    ma_bang = [b.strip().upper() for b in boards.split(",") if b.strip()] if boards else None
    ten_tep = f"mau-{kind}-{_slug(nhom)}" if nhom else f"mau-{kind}"
    return PlainTextResponse(
        bi.build_template(kind, boards=ma_bang),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{ten_tep}.csv"'},
    )


def _run_import(kind, header, rows, mode, commit, db, admin_user, request=None):
    bi.check_columns(kind, header)
    results = bi.analyze(kind, rows, db, models, auth_module, mode=mode)

    created = updated = 0
    if commit:
        created, updated = bi.apply_rows(kind, results, db, models, auth_module)

    tom_tat = {
        "tong_dong": len(results),
        "them_moi": sum(1 for r in results if r["trang_thai"] == "them_moi"),
        "cap_nhat": sum(1 for r in results if r["trang_thai"] == "cap_nhat"),
        "bo_qua": sum(1 for r in results if r["trang_thai"] == "bo_qua"),
        "loi": sum(1 for r in results if r["trang_thai"] == "loi"),
    }
    # Bỏ dữ liệu nội bộ trước khi trả về cho trình duyệt
    for r in results:
        r.pop("_item", None)

    if commit:
        log_action(db, admin_user, "import", IMPORT_KIND_MODULE.get(kind) or "users", None, kind,
                  detail=f"Thêm mới {created}, cập nhật {updated}, tổng {len(results)} dòng.",
                  request=request)

    return {
        "kind": kind, "da_ghi": commit,
        "tom_tat": tom_tat,
        "da_them": created, "da_cap_nhat": updated,
        "chi_tiet": results[:300],
    }


@router.post("/import/text")
def import_from_text(data: ImportIn, db: Session = Depends(get_db), user: models.User = Depends(current_user),
                     request: Request = None):
    """Nhập từ dữ liệu dán trực tiếp (sao chép từ Excel rồi dán vào ô nhập)."""
    if data.kind not in bi.KINDS:
        raise HTTPException(400, "Nhóm dữ liệu không hợp lệ.")
    check_import_kind_permission(user, data.kind, "create")
    try:
        header, rows = bi.read_text_table(data.text or "")
        return _run_import(data.kind, header, rows, data.mode, data.commit, db, user, request)
    except bi.ImportError_ as e:
        raise HTTPException(400, str(e))


@router.post("/import/file")
async def import_from_file(
    kind: str,
    mode: str = "upsert",
    commit: bool = False,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: models.User = Depends(current_user),
    request: Request = None,
):
    """Nhập từ tệp CSV hoặc Excel tải lên."""
    if kind not in bi.KINDS:
        raise HTTPException(400, "Nhóm dữ liệu không hợp lệ.")
    check_import_kind_permission(user, kind, "create")

    content = await file.read(6 * 1024 * 1024 + 1)
    if len(content) > 6 * 1024 * 1024:
        raise HTTPException(400, "Tệp vượt quá 6 MB. Hãy chia nhỏ rồi nhập nhiều lần.")

    try:
        header, rows = bi.read_table(content, file.filename or "")
        return _run_import(kind, header, rows, mode, commit, db, user, request)
    except bi.ImportError_ as e:
        raise HTTPException(400, str(e))


# ==================================== Kiểm tra hệ thống

@router.get("/diagnostics")
def diagnostics(db: Session = Depends(get_db), _=Depends(require_admin)):
    """
    Chạy thử từng phần của hệ thống và báo cáo phần nào hỏng, hỏng vì sao.

    Dùng khi một màn hình quản trị báo lỗi mà không rõ nguyên nhân: thay vì đoán,
    màn hình này chỉ thẳng ra truy vấn nào lỗi và thông báo lỗi thật của Python.
    """
    from .migrate import schema_report

    checks = []

    def thu(ten, ham):
        try:
            ket_qua = ham()
            checks.append({"ten": ten, "trang_thai": "ok", "ghi_chu": str(ket_qua)})
        except Exception as e:  # noqa: BLE001
            checks.append({
                "ten": ten, "trang_thai": "loi",
                "ghi_chu": f"{type(e).__name__}: {e}"[:400],
            })

    thu("Bản tin", lambda: f"{db.query(models.News).count()} bản ghi")
    thu("Thông báo", lambda: f"{db.query(models.Notice).count()} bản ghi")
    thu("Banner", lambda: f"{db.query(models.Banner).count()} bản ghi")
    thu("Tài khoản", lambda: f"{db.query(models.User).count()} bản ghi")
    thu("Nhân viên", lambda: f"{db.query(models.Person).count()} bản ghi")
    thu("Tài liệu", lambda: f"{db.query(models.Document).count()} bản ghi")
    thu("Ứng dụng", lambda: f"{db.query(models.AppLink).count()} bản ghi")
    thu("Sự kiện", lambda: f"{db.query(models.Event).count()} bản ghi")
    thu("Số liệu Dashboard", lambda: f"{db.query(models.Metric).count()} bản ghi")
    thu("Sáng kiến", lambda: f"{db.query(models.Idea).count()} bản ghi")
    thu("Nguồn Google Sheet", lambda: f"{db.query(models.SheetSource).count()} nguồn")
    thu("Tệp đã tải lên", lambda: f"{db.query(models.Upload).count()} tệp")
    thu("Cấu hình website", lambda: f"{db.query(models.SiteConfig).count()} mục")

    # Kiểm tra việc đọc dữ liệu ra ngoài, nơi hay phát sinh lỗi cột thiếu
    thu("Đọc bản tin đầy đủ", lambda: f"{len([news_out(n) for n in db.query(models.News).limit(5)])} bản ghi đọc được")
    thu("Đọc tài khoản đầy đủ", lambda: f"{len([user_out(u) for u in db.query(models.User).limit(5)])} bản ghi đọc được")

    # Thư mục lưu tệp
    def thu_ghi_tep():
        path = os.path.join(upload_dir(), ".kiem_tra")
        with open(path, "w") as f:
            f.write("ok")
        os.remove(path)
        return f"Ghi được vào {upload_dir()}"
    thu("Thư mục lưu ảnh", thu_ghi_tep)

    schema = schema_report()
    thieu = [s for s in schema if s["trang_thai"] != "ok"]

    return {
        "tong_quan": {
            "so_muc_kiem_tra": len(checks),
            "so_muc_loi": sum(1 for c in checks if c["trang_thai"] == "loi"),
            "so_bang_thieu_cot": len(thieu),
        },
        "kiem_tra": checks,
        "cau_truc": schema,
        "he_thong": {
            "api_version": __import__("app.main", fromlist=["API_VERSION"]).API_VERSION,
            "python": os.sys.version.split()[0],
            "csdl": "SQLite" if str(engine.url).startswith("sqlite") else "PostgreSQL",
            "thu_muc_du_lieu": os.getenv("DATA_DIR") or os.getcwd(),
        },
    }


@router.post("/diagnostics/repair-schema")
def repair_schema(_=Depends(require_admin)):
    """Chạy lại việc bổ sung cột còn thiếu. Chỉ thêm, không xoá gì."""
    from .migrate import sync_schema
    actions = sync_schema()
    added = [a for a in actions if a["action"] == "added_column"]
    errors = [a for a in actions if a["action"] == "error"]
    return {
        "da_them_cot": len(added),
        "chi_tiet": added,
        "loi": errors,
        "thong_bao": f"Đã bổ sung {len(added)} cột còn thiếu." if added
                     else "Cấu trúc đã đầy đủ, không cần sửa gì.",
    }



# ==================================== Album ảnh và video

class MediaIn(BaseModel):
    title: Optional[str] = None
    kind: Optional[str] = None
    url: Optional[str] = None
    thumb_url: Optional[str] = None
    author: Optional[str] = None
    album: Optional[str] = None
    color: Optional[str] = None
    order_no: Optional[int] = None
    active: Optional[bool] = None


def media_out(m: models.MediaItem):
    return {
        "id": m.id, "title": m.title, "kind": m.kind or "image",
        "url": m.url, "thumb_url": m.thumb_url, "author": m.author,
        "album": m.album, "color": m.color, "order_no": m.order_no,
        "active": m.active, "created_at": m.created_at,
    }


@router.get("/media")
def admin_list_media(db: Session = Depends(get_db), _=Depends(require_module("media", "view"))):
    rows = (db.query(models.MediaItem)
            .order_by(models.MediaItem.order_no, models.MediaItem.id.desc()).all())
    return [media_out(m) for m in rows]


@router.post("/media")
def admin_create_media(data: MediaIn, db: Session = Depends(get_db), user=Depends(require_module("media", "create")),
                       request: Request = None):
    kind = (data.kind or "image").lower()
    if kind not in ("image", "video"):
        raise HTTPException(400, "Loại chỉ nhận image hoặc video.")
    if kind == "video" and not (data.url or "").strip():
        raise HTTPException(400, "Video phải có đường dẫn.")

    row = models.MediaItem(
        title=data.title or "Chưa đặt tên", kind=kind,
        url=(data.url or "").strip(), thumb_url=(data.thumb_url or "").strip(),
        author=data.author or "", album=data.album or "",
        color=data.color or "#C8102E", order_no=data.order_no or 0,
        active=True if data.active is None else data.active,
    )
    db.add(row); db.commit(); db.refresh(row)
    log_action(db, user, "create", "media", row.id, row.title, request=request)
    return media_out(row)


@router.put("/media/{mid}")
def admin_update_media(mid: int, data: MediaIn, db: Session = Depends(get_db), user=Depends(require_module("media", "update")),
                       request: Request = None):
    row = get_or_404(db, models.MediaItem, mid)
    if data.active is not None:
        row.active = data.active
    apply(row, {k: v for k, v in data.model_dump().items() if k != "active"})
    db.commit(); db.refresh(row)
    log_action(db, user, "update", "media", row.id, row.title, request=request)
    return media_out(row)


@router.delete("/media/{mid}")
def admin_delete_media(mid: int, db: Session = Depends(get_db), user=Depends(require_module("media", "delete")),
                       request: Request = None):
    row = get_or_404(db, models.MediaItem, mid)
    label = row.title
    db.delete(row); db.commit()
    log_action(db, user, "delete", "media", mid, label, request=request)
    return {"deleted": mid}


@router.get("/document-categories")
def admin_doc_categories(_=Depends(require_module("documents", "view"))):
    return DOC_CATEGORIES


# ==================================== Nhật ký hệ thống

ACTION_LABELS = {
    "login": "Đăng nhập",
    "login_failed": "Đăng nhập thất bại",
    "create": "Thêm mới",
    "update": "Cập nhật",
    "delete": "Xoá",
    "config": "Đổi cấu hình",
    "sync": "Đồng bộ dữ liệu",
    "import": "Nhập dữ liệu hàng loạt",
    "password_reset": "Quản trị đặt lại mật khẩu",
    "change_password": "Tự đổi mật khẩu",
    "restore": "Khôi phục từ thùng rác",
    "purge": "Xoá vĩnh viễn",
}

def log_out(l: models.AuditLog):
    return {
        "id": l.id, "created_at": l.created_at,
        "username": l.username, "full_name": l.full_name, "role": l.role,
        "action": l.action, "action_label": ACTION_LABELS.get(l.action, l.action),
        "module": l.module, "module_label": ALL_MODULE_LABELS.get(l.module, l.module),
        "target_id": l.target_id, "target_label": l.target_label,
        "detail": l.detail, "ip_address": l.ip_address,
    }


@router.get("/logs/filters")
def admin_log_filters(_=Depends(require_admin)):
    """Danh sách module và loại hành động, dùng cho bộ lọc màn hình Nhật ký."""
    return {
        "modules": [{"id": k, "label": v} for k, v in ALL_MODULE_LABELS.items()],
        "actions": [{"id": k, "label": v} for k, v in ACTION_LABELS.items()],
    }


@router.get("/logs")
def admin_list_logs(
    module: Optional[str] = None,
    action: Optional[str] = None,
    username: Optional[str] = None,
    q: Optional[str] = None,
    date_from: Optional[dt.date] = None,
    date_to: Optional[dt.date] = None,
    page: int = 1,
    page_size: int = 50,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    """
    Tra cứu nhật ký hệ thống, tinh chỉnh theo từng hạng mục.

    Lọc được theo: module (hạng mục), loại hành động, tài khoản thực hiện,
    khoảng thời gian, và từ khoá tự do (tìm trong nội dung bị tác động).
    """
    query = _filter_logs(db.query(models.AuditLog), module, action, username, q, date_from, date_to)

    total = query.count()
    page = max(page, 1)
    page_size = min(max(page_size, 1), 200)
    rows = (query.order_by(models.AuditLog.created_at.desc())
            .offset((page - 1) * page_size).limit(page_size).all())

    return {
        "total": total, "page": page, "page_size": page_size,
        "rows": [log_out(l) for l in rows],
    }


def _filter_logs(query, module, action, username, q, date_from, date_to):
    if module:
        query = query.filter(models.AuditLog.module == module)
    if action:
        query = query.filter(models.AuditLog.action == action)
    if username:
        like = f"%{username.strip()}%"
        query = query.filter(or_(models.AuditLog.username.ilike(like),
                                 models.AuditLog.full_name.ilike(like)))
    if date_from:
        query = query.filter(models.AuditLog.created_at >= dt.datetime.combine(date_from, dt.time.min))
    if date_to:
        query = query.filter(models.AuditLog.created_at <= dt.datetime.combine(date_to, dt.time.max))
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(or_(models.AuditLog.target_label.ilike(like),
                                 models.AuditLog.detail.ilike(like)))
    return query


@router.delete("/logs/{log_id}")
def admin_delete_log(log_id: int, db: Session = Depends(get_db), me: models.User = Depends(require_admin),
                     request: Request = None):
    """Xoá một dòng nhật ký. Chỉ quản trị viên mới gọi được (đã chặn ở require_admin)."""
    row = get_or_404(db, models.AuditLog, log_id)
    db.delete(row); db.commit()
    log_action(db, me, "delete", "logs", log_id, row.target_label or f"#{log_id}", request=request)
    return {"deleted": log_id}


@router.delete("/logs")
def admin_delete_logs_bulk(
    module: Optional[str] = None,
    action: Optional[str] = None,
    username: Optional[str] = None,
    q: Optional[str] = None,
    date_from: Optional[dt.date] = None,
    date_to: Optional[dt.date] = None,
    confirm_all: bool = False,
    db: Session = Depends(get_db),
    me: models.User = Depends(require_admin),
    request: Request = None,
):
    """
    Xoá hàng loạt nhật ký theo đúng bộ lọc hiện đang áp dụng trên màn hình.
    Bắt buộc phải có ít nhất một điều kiện lọc, trừ khi truyền confirm_all=true (xoá sạch).
    """
    if not confirm_all and not any([module, action, username, q, date_from, date_to]):
        raise HTTPException(400, "Chưa chọn điều kiện lọc. Nếu muốn xoá toàn bộ nhật ký, xác nhận xoá tất cả.")

    query = _filter_logs(db.query(models.AuditLog), module, action, username, q, date_from, date_to)
    count = query.count()
    query.delete(synchronize_session=False)
    db.commit()
    log_action(db, me, "delete", "logs", None,
              f"Xoá hàng loạt {count} dòng nhật ký",
              detail=f"Bộ lọc: module={module or '—'}, action={action or '—'}, "
                     f"username={username or '—'}, q={q or '—'}, "
                     f"{date_from or '—'} → {date_to or '—'}",
              request=request)
    return {"deleted": count}


# ==================================== Chuông cảnh báo

ALERT_MODULE_ACTION_FILTER = list(ALERT_RULES)  # [("news","update"), ("news","delete"), ("config","config")]


@router.get("/alerts")
def admin_list_alerts(
    since: Optional[dt.datetime] = None,
    limit: int = 15,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    """
    Danh sách các thao tác nhạy cảm gần đây (sửa/xoá bản tin, đổi cấu hình),
    dùng cho chuông cảnh báo trên đầu trang. `since` dùng để đếm số cảnh báo mới.
    """
    settings = get_notify_settings()
    if not settings["notify_bell_on"]:
        return {"total_new": 0, "email_configured": smtp_configured(),
                "telegram_configured": telegram_configured(settings), "bell_enabled": False, "rows": []}

    conds = [and_(models.AuditLog.module == m, models.AuditLog.action == a)
             for m, a in ALERT_MODULE_ACTION_FILTER]
    base = db.query(models.AuditLog).filter(or_(*conds))

    total_new = base.filter(models.AuditLog.created_at > since).count() if since else 0
    rows = base.order_by(models.AuditLog.created_at.desc()).limit(min(max(limit, 1), 50)).all()

    return {
        "total_new": total_new,
        "email_configured": smtp_configured(),
        "telegram_configured": telegram_configured(settings),
        "bell_enabled": True,
        "rows": [log_out(l) for l in rows],
    }


# ==================================== Thùng rác (Tin tức, Tài liệu)

def trash_out(item: dict) -> dict:
    return {**item, "module_label": ALL_MODULE_LABELS.get(item["module"], item["module"])}


@router.get("/trash")
def admin_list_trash(db: Session = Depends(get_db), _=Depends(require_admin)):
    """
    Danh sách bản tin/tài liệu đã bị xoá, đang chờ quản trị viên duyệt xoá hẳn
    hoặc tự động xoá sau {TRASH_RETENTION_DAYS} ngày.
    """
    trash_module.purge_expired(db)  # dọn trước những mục đã quá hạn, để danh sách luôn đúng thực tế
    return [trash_out(i) for i in trash_module.list_trash(db)]


@router.post("/trash/{module}/{item_id}/restore")
def admin_restore_trash(module: str, item_id: int, db: Session = Depends(get_db),
                        me: models.User = Depends(require_admin), request: Request = None):
    model = trash_module.TRASH_MODELS.get(module)
    if not model:
        raise HTTPException(400, "Hạng mục không hợp lệ.")
    row = get_or_404(db, model, item_id)
    if row.deleted_at is None:
        raise HTTPException(400, "Mục này không ở trong thùng rác.")
    row.deleted_at = None
    row.deleted_by = None
    db.commit()
    log_action(db, me, "restore", module, item_id, row.title, request=request)
    return {"restored": item_id}


@router.delete("/trash/{module}/{item_id}")
def admin_purge_trash_item(module: str, item_id: int, db: Session = Depends(get_db),
                           me: models.User = Depends(require_admin), request: Request = None):
    """Quản trị viên duyệt xoá hẳn một mục đang ở thùng rác."""
    model = trash_module.TRASH_MODELS.get(module)
    if not model:
        raise HTTPException(400, "Hạng mục không hợp lệ.")
    row = get_or_404(db, model, item_id)
    if row.deleted_at is None:
        raise HTTPException(400, "Mục này chưa ở trong thùng rác.")
    label = row.title
    db.delete(row); db.commit()
    log_action(db, me, "purge", module, item_id, label,
              detail="Quản trị viên duyệt xoá vĩnh viễn từ thùng rác", request=request)
    return {"purged": item_id}
