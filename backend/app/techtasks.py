"""Phân hệ quản lý công việc mảng kỹ thuật: 10 đầu việc lớn giao cho Tổ
trưởng/Đội trưởng/FT theo dõi tiến độ (Tuyển dụng, Kiểm soát WO, Kế hoạch 5G...)."""
import datetime as dt
import re
import unicodedata
from collections import defaultdict
from typing import Optional

from urllib.parse import quote

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import PlainTextResponse, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from . import models
from .auditlog import log_action
from .auth import current_user
from .database import get_db
from .permissions import effective_permission_matrix, require_module

admin_router = APIRouter(prefix="/api/admin", tags=["Quản lý công việc kỹ thuật"])

# (mã đầu việc, tên hiển thị) — 10 đầu việc mảng kỹ thuật ban đầu. Đây chỉ còn
# là DỮ LIỆU MỒI: nguồn thật là bảng tech_categories, nạp lần đầu từ danh sách
# này (xem ensure_seeded). Quản trị viên thêm/sửa đầu việc trên web, không phải
# sửa mã nguồn ở cả hai phía như trước.
DEFAULT_CATEGORIES = [
    ("tuyen_dung", "1. Tuyển dụng"),
    ("kiem_soat_wo", "2. Kiểm soát WO"),
    ("ke_hoach_5g", "3. Kế hoạch 5G"),
    ("giam_phat_sla", "4. Giảm phạt SLA"),
    ("di_doi_ngam_hoa", "5. Di dời – ngầm hóa"),
    ("cung_co", "6. Củng cố"),
    ("ban_hang", "7. Bán hàng"),
    ("cldv_co_dinh", "8. Cải thiện CLDV cố định"),
    ("ql_tai_san", "9. QL Tài sản"),
    ("xang_dau", "10. Xăng dầu"),
]
DEFAULT_CATEGORY_LABELS = dict(DEFAULT_CATEGORIES)

# Gợi ý nội dung công việc theo từng đầu việc — hiển thị trên form để người
# giao việc không phải nhớ lại phạm vi công việc của từng đầu việc.
CATEGORY_HINTS = {
    "tuyen_dung": "Giao nhiệm vụ tuyển dụng bổ sung nhân sự cho tổ trưởng, mục tiêu Tổng số "
                  "line/Số nhân sự < 1350. NS mới giao Tổ trưởng có trách nhiệm kèm cặp, hướng "
                  "dẫn làm cùng (FT dây máy); Đội trưởng kèm FT nhà trạm.",
    "kiem_soat_wo": "Sử dụng tool kiểm soát: https://manage-wo.pages.dev/login — kiểm soát từng "
                    "nhóm WO theo từng FT.",
    "ke_hoach_5g": "Sửa sợi, tích hợp SRT5G, lắp tủ nguồn, Minishelter, tích hợp phát sóng trạm 5G.",
    "giam_phat_sla": "Tiếp xúc KH rời mạng, thu hồi thiết bị, ưu tiên xử lý các WO quá hạn có "
                      "nguy cơ phạt SLA.",
    "di_doi_ngam_hoa": "Báo cáo lại đề xuất di dời Trạm/Cáp, phối hợp chính quyền bó cáp cần "
                        "triển khai trong tháng.",
    "cung_co": "Bó cáp, thay tủ ong/tủ bay, sơn lại tủ, củng cố trạm đạt chuẩn.",
    "ban_hang": "Thống nhất kế hoạch bán hàng trong tháng: Năng lượng, Xây dựng, FTTH, 8 dự án "
                "Chung cư được giao quản lý toàn diện.",
    "cldv_co_dinh": "Cài Tammi, Port kém, Home-wifi kém, Swap ONT 2BT, sự cố lặp, đề xuất kéo "
                     "tủ, củng cố TB nhà trọ.",
    "ql_tai_san": "Tổ chức kiểm kê kết hợp WO MR, xử lý chênh lệch tài sản, trạm hủy/di dời.",
    "xang_dau": "Kiểm soát đề xuất - phê duyệt xăng dầu qua app cBusiness360, tổ chức đổ dầu dự "
                "phòng UCTT đủ định mức cho các trạm cố định.",
}

STATUS_LABELS = {
    "todo": "Chưa bắt đầu", "doing": "Đang thực hiện", "done": "Hoàn thành", "overdue": "Quá hạn",
}


def _ds_ten(v) -> list:
    """Danh sách tên người phối hợp: nhận cả mảng lẫn chuỗi "A; B, C"."""
    if not v:
        return []
    if isinstance(v, str):
        v = re.split(r"[;,\n]", v)
    ra, da_co = [], set()
    for ten in v:
        ten = re.sub(r"\s+", " ", str(ten or "")).strip()
        if ten and ten.casefold() not in da_co:
            da_co.add(ten.casefold())
            ra.append(ten)
    return ra


def _nguoi_cua_viec(row) -> set:
    """Tên (đã casefold) của mọi người gắn với việc: phụ trách, báo cáo, phối hợp."""
    return {t.casefold() for t in [row.assignee or "", row.reporter or "", *_ds_ten(row.coordinators)]
            if t.strip()}


def _out_attachment(a):
    return {"id": a.id, "kind": a.kind, "title": a.title or a.filename or a.url,
            "url": a.url if a.kind == "link" else None, "filename": a.filename,
            "content_type": a.content_type, "size_kb": round((a.size_bytes or 0) / 1024),
            "uploaded_by": a.uploaded_by, "created_at": a.created_at}


def _out(row, labels: Optional[dict] = None, it_labels: Optional[dict] = None,
         tien_do: Optional[dict] = None, user=None):
    labels = labels if labels is not None else {}
    it_labels = it_labels if it_labels is not None else {}
    nguoi = _nguoi_cua_viec(row)
    return {
        "id": row.id, "category": row.category,
        "category_label": labels.get(row.category, row.category),
        "title": row.title, "description": row.description, "assignee": row.assignee,
        "coordinators": _ds_ten(row.coordinators), "reporter": row.reporter or "",
        "target": row.target, "due_at": row.due_at,
        "status": row.status, "status_label": STATUS_LABELS.get(row.status, row.status),
        "link_url": row.link_url, "note": row.note,
        "progress_item": row.progress_item or "",
        "progress_item_label": it_labels.get(row.progress_item, row.progress_item or ""),
        # Kế hoạch/Thực hiện mới nhất của hạng mục liên kết, lấy từ tab Tiến độ.
        "progress": (tien_do or {}).get(row.progress_item) if row.progress_item else None,
        "attachments": [_out_attachment(a) for a in row.attachments],
        # Người được gắn tên trong việc (làm/phối hợp/báo cáo) tự báo cáo được
        # tiến độ và đính kèm, kể cả khi tài khoản chỉ có quyền xem.
        "cua_toi": bool(user and (user.full_name or "").strip().casefold() in nguoi),
        "created_at": row.created_at, "updated_at": row.updated_at,
    }


def _tien_do_moi_nhat(db: Session) -> dict:
    """{mã hạng mục: {period, plan, done, rate}} theo kỳ gần nhất có số liệu —
    chỉ cộng dòng tổng Trung tâm (ft_name rỗng), giống progress_summary."""
    rows = db.query(models.ProgressEntry).filter(models.ProgressEntry.ft_name.is_(None)).all()
    ky_moi = {}
    for r in rows:
        if r.period and r.period > ky_moi.get(r.item, ""):
            ky_moi[r.item] = r.period
    ra = {}
    for r in rows:
        if r.period != ky_moi.get(r.item):
            continue
        b = ra.setdefault(r.item, {"period": r.period, "plan": 0.0, "done": 0.0})
        b["plan"] += r.plan_qty or 0
        b["done"] += r.done_qty or 0
    for b in ra.values():
        b["rate"] = (b["done"] / b["plan"]) if b["plan"] else None
    return ra


class TechTaskIn(BaseModel):
    category: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    assignee: Optional[str] = None
    coordinators: Optional[list[str]] = None
    reporter: Optional[str] = None
    target: Optional[str] = None
    due_at: Optional[dt.date] = None
    status: Optional[str] = None
    link_url: Optional[str] = None
    progress_item: Optional[str] = None
    note: Optional[str] = None


def _get(db, item_id, ca_thung_rac: bool = False):
    row = db.get(models.TechTask, item_id)
    if not row or (row.deleted_at is not None and not ca_thung_rac):
        raise HTTPException(404, "Không tìm thấy công việc.")
    return row


def _apply(row, values):
    for key, value in values.items():
        if key == "coordinators":
            if value is not None:
                row.coordinators = "; ".join(_ds_ten(value))
            continue
        if key == "progress_item":
            row.progress_item = (value or "").strip() or None
            continue
        if value is not None and hasattr(row, key):
            setattr(row, key, value.strip() if isinstance(value, str) else value)


def _validate(data: TechTaskIn, db: Session, row=None):
    if data.category is not None and data.category not in category_ids(db):
        raise HTTPException(400, "Đầu việc không hợp lệ.")
    if data.status is not None and data.status not in STATUS_LABELS:
        raise HTTPException(400, "Trạng thái không hợp lệ.")
    if data.progress_item:
        dau_viec = data.category or (row.category if row else None)
        thuoc = item_category(db).get(data.progress_item)
        if thuoc is None:
            raise HTTPException(400, "Hạng mục tiến độ không hợp lệ.")
        if dau_viec and thuoc != dau_viec:
            raise HTTPException(400, "Hạng mục tiến độ không thuộc đầu việc đã chọn.")


def _duoc_sua(user) -> bool:
    return "update" in effective_permission_matrix(user).get("tech_tasks", [])


def _duoc_bao_cao(user, row) -> bool:
    """Có quyền sửa module, hoặc là người được gắn tên trong chính việc này."""
    return _duoc_sua(user) or (user.full_name or "").strip().casefold() in _nguoi_cua_viec(row)


class CategoryIn(BaseModel):
    label: Optional[str] = None
    hint: Optional[str] = None
    order_no: Optional[int] = None
    active: Optional[bool] = None


@admin_router.get("/tech-tasks/categories")
def list_categories(db: Session = Depends(get_db), _=Depends(require_module("tech_tasks", "view"))):
    ensure_seeded(db)
    return [{"id": c.code, "label": c.label, "hint": c.hint or ""} for c in categories(db)]


@admin_router.post("/tech-tasks/categories")
def create_category(data: CategoryIn, db: Session = Depends(get_db),
                    user=Depends(require_module("tech_tasks", "create")), request: Request = None):
    """Thêm đầu việc mới ngay từ form giao việc — không phải sửa mã nguồn."""
    label = (data.label or "").strip()
    if not label:
        raise HTTPException(400, "Chưa nhập tên đầu việc.")
    ensure_seeded(db)
    if db.query(models.TechCategory).filter(models.TechCategory.label == label).first():
        raise HTTPException(400, f"Đầu việc “{label}” đã có.")
    last = (db.query(models.TechCategory)
            .order_by(models.TechCategory.order_no.desc()).first())
    row = models.TechCategory(
        code=_ma_chua_dung(db, models.TechCategory, _slug(label)),
        label=label, hint=(data.hint or "").strip(),
        order_no=(last.order_no + 1) if last else 0, active=True,
    )
    db.add(row); db.commit(); db.refresh(row)
    log_action(db, user, "create", "tech_tasks", row.id, f"Đầu việc: {row.label}", request=request)
    return {"id": row.code, "label": row.label, "hint": row.hint or ""}


@admin_router.put("/tech-tasks/categories/{code}")
def update_category(code: str, data: CategoryIn, db: Session = Depends(get_db),
                    user=Depends(require_module("tech_tasks", "update")), request: Request = None):
    row = db.query(models.TechCategory).filter(models.TechCategory.code == code).first()
    if not row:
        raise HTTPException(404, "Không tìm thấy đầu việc.")
    if data.label is not None and data.label.strip():
        row.label = data.label.strip()
    if data.hint is not None:
        row.hint = data.hint.strip()
    if data.order_no is not None:
        row.order_no = data.order_no
    if data.active is not None:
        row.active = data.active
    db.commit()
    log_action(db, user, "update", "tech_tasks", row.id, f"Đầu việc: {row.label}", request=request)
    return {"id": row.code, "label": row.label, "hint": row.hint or ""}


@admin_router.delete("/tech-tasks/categories/{code}")
def delete_category(code: str, db: Session = Depends(get_db),
                    user=Depends(require_module("tech_tasks", "delete")), request: Request = None):
    """Chỉ xoá được đầu việc chưa dùng — còn công việc, hạng mục hoặc dòng tiến
    độ tham chiếu thì từ chối, tránh để lại dữ liệu mồ côi không tra ngược được."""
    row = db.query(models.TechCategory).filter(models.TechCategory.code == code).first()
    if not row:
        raise HTTPException(404, "Không tìm thấy đầu việc.")
    dang_dung = [
        (db.query(models.TechTask).filter(models.TechTask.category == code).count(), "công việc"),
        (db.query(models.TechProgressItem).filter(models.TechProgressItem.category_code == code).count(), "hạng mục tiến độ"),
        (db.query(models.ProgressEntry).filter(models.ProgressEntry.category == code).count(), "dòng tiến độ"),
    ]
    vuong = [f"{n} {ten}" for n, ten in dang_dung if n]
    if vuong:
        raise HTTPException(400, "Đầu việc đang được dùng (" + ", ".join(vuong)
                            + "). Hãy xoá hoặc chuyển các mục đó trước.")
    label = row.label
    db.delete(row); db.commit()
    log_action(db, user, "delete", "tech_tasks", None, f"Đầu việc: {label}", request=request)
    return {"deleted": code}


@admin_router.get("/tech-tasks/assignees")
def list_assignees(db: Session = Depends(get_db), _=Depends(require_module("tech_tasks", "view"))):
    """Danh sách người phụ trách chọn được: lấy từ hồ sơ nhân viên và tài khoản
    đăng nhập, gộp trùng theo tên. Form vẫn cho gõ tay tên tổ/đội chưa có hồ sơ."""
    ds = {}
    for p in (db.query(models.Person)
              .filter(models.Person.active.is_(True))
              .order_by(models.Person.full_name).all()):
        ten = (p.full_name or "").strip()
        if ten:
            ds[ten.casefold()] = {"name": ten, "role": p.role or "", "dept": p.dept or "",
                                  "nguon": "Nhân viên"}
    for u in db.query(models.User).order_by(models.User.full_name).all():
        ten = (u.full_name or "").strip()
        if not ten:
            continue
        cu = ds.get(ten.casefold())
        if cu:
            cu["nguon"] = "Nhân viên + tài khoản"
        else:
            ds[ten.casefold()] = {"name": ten, "role": "", "dept": "", "nguon": "Tài khoản"}
    return sorted(ds.values(), key=lambda x: x["name"])


@admin_router.get("/tech-tasks")
def admin_list_tasks(category: Optional[str] = None, status: Optional[str] = None,
                     mine: bool = False, db: Session = Depends(get_db),
                     user=Depends(require_module("tech_tasks", "view"))):
    q = db.query(models.TechTask).filter(models.TechTask.deleted_at.is_(None))
    if category:
        q = q.filter(models.TechTask.category == category)
    if status:
        q = q.filter(models.TechTask.status == status)
    rows = q.order_by(models.TechTask.due_at.is_(None), models.TechTask.due_at,
                       models.TechTask.created_at.desc()).limit(1000).all()
    labels, it_labels, tien_do = category_labels(db), item_labels(db), _tien_do_moi_nhat(db)
    ra = [_out(x, labels, it_labels, tien_do, user) for x in rows]
    return [x for x in ra if x["cua_toi"]] if mine else ra


@admin_router.get("/tech-tasks/summary")
def admin_tasks_summary(db: Session = Depends(get_db), _=Depends(require_module("tech_tasks", "view"))):
    """Đếm số việc theo từng đầu việc x trạng thái, cho khối thống kê đầu trang."""
    rows = db.query(models.TechTask).filter(models.TechTask.deleted_at.is_(None)).all()
    by_category = defaultdict(lambda: {"total": 0, "todo": 0, "doing": 0, "done": 0, "overdue": 0})
    today = models.today()
    for r in rows:
        bucket = by_category[r.category]
        bucket["total"] += 1
        status = r.status
        if status != "done" and r.due_at and r.due_at < today:
            status = "overdue"
        bucket[status] = bucket.get(status, 0) + 1
    ensure_seeded(db)
    return [
        {"category": c.code, "label": c.label,
         **by_category.get(c.code, {"total": 0, "todo": 0, "doing": 0, "done": 0, "overdue": 0})}
        for c in categories(db)
    ]


@admin_router.post("/tech-tasks")
def admin_create_task(data: TechTaskIn, db: Session = Depends(get_db),
                      user=Depends(require_module("tech_tasks", "create")), request: Request = None):
    if not (data.category or "").strip():
        raise HTTPException(400, "Chưa chọn đầu việc.")
    if not (data.title or "").strip():
        raise HTTPException(400, "Chưa nhập nội dung công việc.")
    _validate(data, db)
    row = models.TechTask(
        category=data.category, title=data.title.strip(),
        description=(data.description or "").strip(), assignee=(data.assignee or "").strip(),
        coordinators="; ".join(_ds_ten(data.coordinators)), reporter=(data.reporter or "").strip(),
        target=(data.target or "").strip(), due_at=data.due_at,
        status=data.status or "todo", link_url=(data.link_url or "").strip(),
        progress_item=(data.progress_item or "").strip() or None,
        note=(data.note or "").strip(),
    )
    db.add(row); db.commit(); db.refresh(row)
    log_action(db, user, "create", "tech_tasks", row.id, row.title, request=request)
    return _out(row, category_labels(db), item_labels(db), _tien_do_moi_nhat(db), user)


@admin_router.put("/tech-tasks/{item_id}")
def admin_update_task(item_id: int, data: TechTaskIn, db: Session = Depends(get_db),
                      user=Depends(require_module("tech_tasks", "update")), request: Request = None):
    row = _get(db, item_id)
    _validate(data, db, row)
    vals = data.model_dump(exclude_unset=True)
    # Đổi đầu việc mà hạng mục liên kết cũ không thuộc đầu việc mới thì gỡ liên
    # kết, tránh việc của "Củng cố" lại hiện số liệu hạng mục của "Kế hoạch 5G".
    if (vals.get("category") and "progress_item" not in vals and row.progress_item
            and item_category(db).get(row.progress_item) != vals["category"]):
        vals["progress_item"] = None
    _apply(row, vals)
    db.commit(); db.refresh(row)
    log_action(db, user, "update", "tech_tasks", row.id, row.title, request=request)
    return _out(row, category_labels(db), item_labels(db), _tien_do_moi_nhat(db), user)


@admin_router.delete("/tech-tasks/{item_id}")
def admin_delete_task(item_id: int, db: Session = Depends(get_db),
                      user=Depends(require_module("tech_tasks", "delete")), request: Request = None):
    """Xoá mềm: chuyển vào Thùng rác cùng đính kèm, quản trị viên khôi phục được
    trong 30 ngày — việc thường có tệp số liệu, xoá nhầm là mất hẳn."""
    row = _get(db, item_id)
    row.deleted_at = models.now()
    row.deleted_by = user.full_name
    db.commit()
    log_action(db, user, "delete", "tech_tasks", item_id, row.title,
               detail="Chuyển vào thùng rác", request=request)
    return {"deleted": item_id, "trashed": True}


class BaoCaoIn(BaseModel):
    status: Optional[str] = None
    note: Optional[str] = None


@admin_router.post("/tech-tasks/{item_id}/report")
def report_task(item_id: int, data: BaoCaoIn, db: Session = Depends(get_db),
                user=Depends(current_user), request: Request = None):
    """Người làm/phối hợp/báo cáo cập nhật trạng thái và ghi chú tiến độ của
    chính việc mình — không cần quyền sửa cả module."""
    row = _get(db, item_id)
    if not _duoc_bao_cao(user, row):
        raise HTTPException(403, "Chỉ người phụ trách, phối hợp, báo cáo của việc này "
                                 "hoặc người có quyền sửa mới cập nhật được tiến độ.")
    if data.status is not None:
        if data.status not in STATUS_LABELS or data.status == "overdue":
            raise HTTPException(400, "Trạng thái không hợp lệ.")
        row.status = data.status
    if data.note is not None:
        row.note = data.note.strip()
    db.commit(); db.refresh(row)
    log_action(db, user, "update", "tech_tasks", row.id, row.title,
               detail="Báo cáo tiến độ", request=request)
    return _out(row, category_labels(db), item_labels(db), _tien_do_moi_nhat(db), user)


# ------------------------------------------------------------------ Đính kèm

MAX_DINH_KEM_MB = 15
# Chặn tệp chạy được; còn lại (PDF, Office, ảnh, CSV, ZIP...) đều nhận.
DUOI_BI_CHAN = {".exe", ".bat", ".cmd", ".com", ".msi", ".scr", ".ps1", ".vbs", ".js",
                ".jar", ".sh", ".dll", ".html", ".htm", ".svg"}


class LinkIn(BaseModel):
    title: Optional[str] = None
    url: str


@admin_router.post("/tech-tasks/{item_id}/attachments/link")
def add_attachment_link(item_id: int, data: LinkIn, db: Session = Depends(get_db),
                        user=Depends(current_user), request: Request = None):
    row = _get(db, item_id)
    if not _duoc_bao_cao(user, row):
        raise HTTPException(403, "Chỉ người được gắn tên trong việc hoặc người có quyền sửa mới đính kèm được.")
    url = (data.url or "").strip()
    if not re.match(r"^https?://\S+$", url):
        raise HTTPException(400, "Link cần bắt đầu bằng http:// hoặc https://")
    a = models.TechTaskAttachment(task_id=row.id, kind="link", url=url,
                                  title=(data.title or "").strip() or url,
                                  uploaded_by=user.full_name)
    db.add(a); db.commit(); db.refresh(a)
    log_action(db, user, "create", "tech_tasks", row.id, row.title,
               detail=f"Đính kèm link: {a.title}", request=request)
    return _out_attachment(a)


@admin_router.post("/tech-tasks/{item_id}/attachments/file")
async def add_attachment_file(item_id: int, file: UploadFile = File(...), db: Session = Depends(get_db),
                              user=Depends(current_user), request: Request = None):
    row = _get(db, item_id)
    if not _duoc_bao_cao(user, row):
        raise HTTPException(403, "Chỉ người được gắn tên trong việc hoặc người có quyền sửa mới đính kèm được.")
    ten = (file.filename or "tep").replace("\\", "/").split("/")[-1][:300]
    duoi = ("." + ten.rsplit(".", 1)[-1].lower()) if "." in ten else ""
    if duoi in DUOI_BI_CHAN:
        raise HTTPException(400, f"Không nhận tệp {duoi}. Hãy nén thành .zip hoặc gửi dạng PDF.")
    gioi_han = MAX_DINH_KEM_MB * 1024 * 1024
    phan, co = [], 0
    while chunk := await file.read(1024 * 256):
        co += len(chunk)
        if co > gioi_han:
            raise HTTPException(400, f"Tệp vượt quá {MAX_DINH_KEM_MB} MB. Hãy nén bớt "
                                     "hoặc đưa lên Drive rồi đính kèm link.")
        phan.append(chunk)
    if not co:
        raise HTTPException(400, "Tệp rỗng.")
    a = models.TechTaskAttachment(task_id=row.id, kind="file", filename=ten, title=ten,
                                  content_type=(file.content_type or "application/octet-stream")[:120],
                                  size_bytes=co, data=b"".join(phan), uploaded_by=user.full_name)
    db.add(a); db.commit(); db.refresh(a)
    log_action(db, user, "create", "tech_tasks", row.id, row.title,
               detail=f"Đính kèm tệp: {ten}", request=request)
    return _out_attachment(a)


def _get_attachment(db, aid):
    a = db.get(models.TechTaskAttachment, aid)
    if not a or a.task is None or a.task.deleted_at is not None:
        raise HTTPException(404, "Không tìm thấy đính kèm.")
    return a


@admin_router.get("/tech-tasks/attachments/{aid}/download")
def download_attachment(aid: int, db: Session = Depends(get_db),
                        _=Depends(require_module("tech_tasks", "view"))):
    """Tải tệp — luôn qua đăng nhập, không để link công khai như /uploads, vì
    tệp đính kèm thường là số liệu nội bộ."""
    a = _get_attachment(db, aid)
    if a.kind != "file":
        raise HTTPException(400, "Đính kèm này là link, không phải tệp.")
    ten = a.filename or f"dinh-kem-{a.id}"
    ascii_ten = unicodedata.normalize("NFD", ten).encode("ascii", "ignore").decode() or "tep"
    ascii_ten = ascii_ten.replace('"', "")
    return Response(
        a.data or b"", media_type=a.content_type or "application/octet-stream",
        headers={"Content-Disposition":
                 f"attachment; filename=\"{ascii_ten}\"; filename*=UTF-8''{quote(ten)}",
                 "X-Content-Type-Options": "nosniff"},
    )


@admin_router.delete("/tech-tasks/attachments/{aid}")
def delete_attachment(aid: int, db: Session = Depends(get_db),
                      user=Depends(current_user), request: Request = None):
    """Người có quyền sửa xoá được mọi đính kèm; người được gắn tên trong việc
    chỉ xoá được đính kèm do chính mình đưa lên."""
    a = _get_attachment(db, aid)
    cua_minh = (a.uploaded_by or "").strip().casefold() == (user.full_name or "").strip().casefold()
    if not (_duoc_sua(user) or (cua_minh and _duoc_bao_cao(user, a.task))):
        raise HTTPException(403, "Chỉ xoá được đính kèm do chính mình đưa lên.")
    task, ten = a.task, a.title
    db.delete(a); db.commit()
    log_action(db, user, "delete", "tech_tasks", task.id, task.title,
               detail=f"Gỡ đính kèm: {ten}", request=request)
    return {"deleted": aid}


@admin_router.get("/tech-tasks/export")
def export_tasks_csv(db: Session = Depends(get_db),
                     _=Depends(require_module("tech_tasks", "update"))):
    """Xuất toàn bộ công việc ra tệp CSV để báo cáo."""
    rows = (db.query(models.TechTask).filter(models.TechTask.deleted_at.is_(None))
            .order_by(models.TechTask.category, models.TechTask.due_at).all())
    header = ["Đầu việc", "Nội dung công việc", "Mô tả", "Phụ trách", "Phối hợp", "Người báo cáo",
              "Mục tiêu/chỉ tiêu", "Hạn xử lý", "Trạng thái", "Hạng mục tiến độ", "Link công cụ",
              "Đính kèm", "Ghi chú tiến độ", "Ngày tạo"]
    labels, it_labels = category_labels(db), item_labels(db)
    lines = [",".join(header)]
    for r in rows:
        vals = [
            labels.get(r.category, r.category), r.title or "", r.description or "",
            r.assignee or "", "; ".join(_ds_ten(r.coordinators)), r.reporter or "",
            r.target or "",
            r.due_at.strftime("%d/%m/%Y") if r.due_at else "",
            STATUS_LABELS.get(r.status, r.status),
            it_labels.get(r.progress_item, r.progress_item or ""), r.link_url or "",
            " | ".join(a.url if a.kind == "link" else a.filename or "" for a in r.attachments),
            r.note or "",
            r.created_at.strftime("%d/%m/%Y %H:%M") if r.created_at else "",
        ]
        lines.append(",".join('"' + str(v).replace('"', '""') + '"' for v in vals))
    content = "﻿" + "\n".join(lines) + "\n"
    return PlainTextResponse(
        content, media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="cong-viec-ky-thuat-{models.today()}.csv"'},
    )


# Đặt SAU các đường dẫn cố định /tech-tasks/summary, /tech-tasks/export...:
# FastAPI khớp theo thứ tự khai báo, để trước thì "summary" bị hiểu là mã việc.
@admin_router.get("/tech-tasks/{item_id}")
def admin_get_task(item_id: int, db: Session = Depends(get_db),
                   user=Depends(require_module("tech_tasks", "view"))):
    return _out(_get(db, item_id), category_labels(db), item_labels(db),
                _tien_do_moi_nhat(db), user)


# ============================================================ TIẾN ĐỘ HẠNG MỤC

# Hạng mục con định lượng được của từng đầu việc — suy trực tiếp từ nội dung
# CATEGORY_HINTS ở trên. "Tuyển dụng" và "Bán hàng" khó định lượng theo kiểu
# Kế hoạch/Thực hiện nên không có hạng mục, vẫn theo dõi bằng danh sách công
# việc (tech-tasks) như bình thường.
DEFAULT_PROGRESS_ITEMS = {
    "ke_hoach_5g": [
        ("5g_sua_soi", "Sửa sợi"),
        ("5g_srt5g", "Tích hợp SRT5G"),
        ("5g_tu_nguon", "Lắp tủ nguồn"),
        ("5g_minishelter", "Minishelter"),
        ("5g_phat_song", "Tích hợp phát sóng trạm 5G"),
    ],
    "kiem_soat_wo": [
        ("wo_kiem_soat_ft", "Kiểm soát WO theo FT"),
    ],
    "giam_phat_sla": [
        ("sla_tiep_xuc_rm", "Tiếp xúc KH rời mạng"),
        ("sla_thu_hoi_tb", "Thu hồi thiết bị"),
        ("sla_wo_qua_han", "WO quá hạn nguy cơ phạt SLA"),
    ],
    "di_doi_ngam_hoa": [
        ("dd_de_xuat", "Đề xuất di dời Trạm/Cáp"),
        ("dd_bo_cap", "Bó cáp phối hợp chính quyền"),
    ],
    "cung_co": [
        ("cc_bo_cap", "Bó cáp"),
        ("cc_thay_tu", "Thay tủ ong/tủ bay"),
        ("cc_son_tu", "Sơn lại tủ"),
        ("cc_dat_chuan", "Củng cố trạm đạt chuẩn"),
    ],
    "cldv_co_dinh": [
        ("cldv_tammi", "Cài Tammi"),
        ("cldv_port_kem", "Port kém"),
        ("cldv_wifi_kem", "Home-wifi kém"),
        ("cldv_swap_ont", "Swap ONT 2BT"),
        ("cldv_su_co_lap", "Sự cố lặp"),
        ("cldv_keo_tu", "Đề xuất kéo tủ"),
        ("cldv_nha_tro", "Củng cố TB nhà trọ"),
    ],
    "ql_tai_san": [
        ("ts_kiem_ke", "Kiểm kê kết hợp WO MR"),
        ("ts_chenh_lech", "Xử lý chênh lệch tài sản"),
        ("ts_huy_di_doi", "Trạm hủy/di dời"),
    ],
    "xang_dau": [
        ("xd_de_xuat", "Đề xuất - phê duyệt qua cBusiness360"),
        ("xd_du_phong", "Đổ dầu dự phòng UCTT"),
    ],
}

# ---------------------------------------------------------- Đọc từ cơ sở dữ liệu
#
# Mọi nơi cần danh sách đầu việc/hạng mục đều đi qua các hàm dưới đây, không
# đọc thẳng hằng số DEFAULT_* nữa — nhờ vậy đầu việc thêm mới trên web lập tức
# có hiệu lực ở form giao việc, phần tiến độ và cả khi nhập Excel.

def ensure_seeded(db: Session) -> None:
    """Nạp 10 đầu việc và các hạng mục mặc định nếu bảng còn trống."""
    if not db.query(models.TechCategory).first():
        for i, (code, label) in enumerate(DEFAULT_CATEGORIES):
            db.add(models.TechCategory(code=code, label=label,
                                       hint=CATEGORY_HINTS.get(code, ""), order_no=i))
    if not db.query(models.TechProgressItem).first():
        i = 0
        for cat, items in DEFAULT_PROGRESS_ITEMS.items():
            for code, label in items:
                db.add(models.TechProgressItem(code=code, label=label,
                                               category_code=cat, order_no=i))
                i += 1
    db.commit()


def categories(db: Session):
    return (db.query(models.TechCategory)
            .filter(models.TechCategory.active.is_(True))
            .order_by(models.TechCategory.order_no, models.TechCategory.id).all())


def category_labels(db: Session) -> dict:
    return {c.code: c.label for c in db.query(models.TechCategory).all()}


def category_ids(db: Session) -> set:
    return {c.code for c in db.query(models.TechCategory).all()}


def progress_items(db: Session, category: Optional[str] = None):
    q = db.query(models.TechProgressItem).filter(models.TechProgressItem.active.is_(True))
    if category:
        q = q.filter(models.TechProgressItem.category_code == category)
    return q.order_by(models.TechProgressItem.order_no, models.TechProgressItem.id).all()


def item_labels(db: Session) -> dict:
    return {i.code: i.label for i in db.query(models.TechProgressItem).all()}


def item_category(db: Session) -> dict:
    return {i.code: i.category_code for i in db.query(models.TechProgressItem).all()}


def _slug(text: str, prefix: str = "dv") -> str:
    """Sinh mã từ tên tiếng Việt: 'Kế hoạch 5G' -> 'ke_hoach_5g'."""
    s = unicodedata.normalize("NFD", text or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.replace("đ", "d").replace("Đ", "D").lower()
    s = re.sub(r"[^a-z0-9]+", "_", s).strip("_")
    return s[:40] or f"{prefix}_moi"


def _ma_chua_dung(db: Session, model, base: str) -> str:
    """Thêm hậu tố _2, _3... nếu mã đã có, để không đụng dữ liệu cũ."""
    code, n = base, 1
    while db.query(model).filter(model.code == code).first():
        n += 1
        code = f"{base}_{n}"[:60]
    return code


def _out_progress(row, cat_labels: Optional[dict] = None, it_labels: Optional[dict] = None):
    cat_labels = cat_labels if cat_labels is not None else {}
    it_labels = it_labels if it_labels is not None else {}
    plan, done = row.plan_qty or 0, row.done_qty or 0
    return {
        "id": row.id, "category": row.category,
        "category_label": cat_labels.get(row.category, row.category),
        "item": row.item, "item_label": it_labels.get(row.item, row.item),
        "period": row.period, "center": row.center, "ft_name": row.ft_name,
        "plan_qty": plan, "done_qty": done, "remaining": plan - done,
        "rate": (done / plan) if plan else None,
        "note": row.note, "created_at": row.created_at, "updated_at": row.updated_at,
    }


class ProgressIn(BaseModel):
    category: Optional[str] = None
    item: Optional[str] = None
    period: Optional[str] = None
    center: Optional[str] = None
    ft_name: Optional[str] = None
    plan_qty: Optional[float] = None
    done_qty: Optional[float] = None
    note: Optional[str] = None


def _validate_progress(data: ProgressIn, db: Session):
    if data.category is not None and data.category not in category_ids(db):
        raise HTTPException(400, "Đầu việc không hợp lệ.")
    if data.item is not None and data.item not in item_labels(db):
        raise HTTPException(400, "Hạng mục không hợp lệ.")
    if data.item is not None and data.category is not None and item_category(db).get(data.item) != data.category:
        raise HTTPException(400, "Hạng mục không thuộc đầu việc đã chọn.")


def _get_progress(db, item_id):
    row = db.get(models.ProgressEntry, item_id)
    if not row:
        raise HTTPException(404, "Không tìm thấy dòng tiến độ.")
    return row


def upsert_progress_center(db: Session, category: str, item: str, period: str, center: str,
                            plan_qty: float, done_qty: float, note: str = "") -> models.ProgressEntry:
    """Ghi dòng tổng theo Trung tâm — trùng (đầu việc, hạng mục, kỳ, trung tâm)
    thì cập nhật đè, không tạo dòng mới. Dùng chung cho form thủ công và nhập
    Excel hàng loạt (bulkimport.py)."""
    row = (db.query(models.ProgressEntry)
           .filter(models.ProgressEntry.category == category, models.ProgressEntry.item == item,
                   models.ProgressEntry.period == period, models.ProgressEntry.center == center,
                   models.ProgressEntry.ft_name.is_(None))
           .first())
    if row:
        row.plan_qty, row.done_qty = plan_qty, done_qty
        if note:
            row.note = note
    else:
        row = models.ProgressEntry(category=category, item=item, period=period, center=center,
                                    ft_name=None, plan_qty=plan_qty, done_qty=done_qty, note=note or "")
        db.add(row)
    db.flush()
    return row


class ProgressItemIn(BaseModel):
    category: Optional[str] = None
    label: Optional[str] = None
    order_no: Optional[int] = None
    active: Optional[bool] = None


@admin_router.get("/progress/items")
def list_progress_items(category: Optional[str] = None, db: Session = Depends(get_db),
                        _=Depends(require_module("tech_tasks", "view"))):
    ensure_seeded(db)
    if category:
        return [{"id": i.code, "label": i.label} for i in progress_items(db, category)]
    # Trả về ĐỦ mọi đầu việc, kể cả đầu việc chưa khai báo hạng mục nào — để màn
    # hình Tiến độ khớp một-một với danh sách đầu việc bên Giao việc, chỗ trống
    # hiện rõ là "chưa có hạng mục" thay vì biến mất khỏi danh sách như trước.
    theo_dau_viec = defaultdict(list)
    for i in progress_items(db):
        theo_dau_viec[i.category_code].append({"id": i.code, "label": i.label})
    return [
        {"category": c.code, "category_label": c.label, "items": theo_dau_viec.get(c.code, [])}
        for c in categories(db)
    ]


@admin_router.post("/progress/items")
def create_progress_item(data: ProgressItemIn, db: Session = Depends(get_db),
                         user=Depends(require_module("tech_tasks", "create")), request: Request = None):
    """Thêm hạng mục định lượng cho một đầu việc."""
    label = (data.label or "").strip()
    category = (data.category or "").strip()
    if not label:
        raise HTTPException(400, "Chưa nhập tên hạng mục.")
    ensure_seeded(db)
    if category not in category_ids(db):
        raise HTTPException(400, "Đầu việc không hợp lệ.")
    if (db.query(models.TechProgressItem)
            .filter(models.TechProgressItem.category_code == category,
                    models.TechProgressItem.label == label).first()):
        raise HTTPException(400, f"Hạng mục “{label}” đã có trong đầu việc này.")
    last = db.query(models.TechProgressItem).order_by(models.TechProgressItem.order_no.desc()).first()
    row = models.TechProgressItem(
        code=_ma_chua_dung(db, models.TechProgressItem, _slug(label, "hm")),
        label=label, category_code=category,
        order_no=(last.order_no + 1) if last else 0, active=True,
    )
    db.add(row); db.commit(); db.refresh(row)
    log_action(db, user, "create", "tech_tasks", row.id, f"Hạng mục: {row.label}", request=request)
    return {"id": row.code, "label": row.label, "category": row.category_code}


@admin_router.put("/progress/items/{code}")
def update_progress_item(code: str, data: ProgressItemIn, db: Session = Depends(get_db),
                         user=Depends(require_module("tech_tasks", "update")), request: Request = None):
    row = db.query(models.TechProgressItem).filter(models.TechProgressItem.code == code).first()
    if not row:
        raise HTTPException(404, "Không tìm thấy hạng mục.")
    if data.label is not None and data.label.strip():
        row.label = data.label.strip()
    if data.category is not None and data.category.strip():
        if data.category not in category_ids(db):
            raise HTTPException(400, "Đầu việc không hợp lệ.")
        row.category_code = data.category
    if data.order_no is not None:
        row.order_no = data.order_no
    if data.active is not None:
        row.active = data.active
    db.commit()
    log_action(db, user, "update", "tech_tasks", row.id, f"Hạng mục: {row.label}", request=request)
    return {"id": row.code, "label": row.label, "category": row.category_code}


@admin_router.delete("/progress/items/{code}")
def delete_progress_item(code: str, xoa_so_lieu: bool = False, db: Session = Depends(get_db),
                         user=Depends(require_module("tech_tasks", "delete")), request: Request = None):
    """Xoá hạng mục. Còn số liệu thì mặc định từ chối (trả 409 kèm số dòng để
    giao diện hỏi lại); gửi xoa_so_lieu=true thì xoá luôn số liệu các kỳ.
    Công việc đang liên kết hạng mục được gỡ liên kết chứ không bị xoá."""
    row = db.query(models.TechProgressItem).filter(models.TechProgressItem.code == code).first()
    if not row:
        raise HTTPException(404, "Không tìm thấy hạng mục.")
    q_so_lieu = db.query(models.ProgressEntry).filter(models.ProgressEntry.item == code)
    so_dong = q_so_lieu.count()
    if so_dong and not xoa_so_lieu:
        raise HTTPException(409, f"Hạng mục đang có {so_dong} dòng tiến độ (trung tâm/FT).")
    if so_dong:
        q_so_lieu.delete(synchronize_session=False)
    go_lien_ket = (db.query(models.TechTask).filter(models.TechTask.progress_item == code)
                   .update({models.TechTask.progress_item: None}, synchronize_session=False))
    label = row.label
    db.delete(row); db.commit()
    log_action(db, user, "delete", "tech_tasks", None, f"Hạng mục: {label}",
               detail=(f"Xoá kèm {so_dong} dòng tiến độ" if so_dong else "")
                      + (f"; gỡ liên kết {go_lien_ket} công việc" if go_lien_ket else ""),
               request=request)
    return {"deleted": code, "so_dong_da_xoa": so_dong, "go_lien_ket": go_lien_ket}


@admin_router.get("/progress/periods")
def list_progress_periods(db: Session = Depends(get_db), _=Depends(require_module("tech_tasks", "view"))):
    rows = (db.query(models.ProgressEntry.period).distinct()
            .order_by(models.ProgressEntry.period.desc()).all())
    return [r[0] for r in rows]


@admin_router.get("/progress/summary")
def progress_summary(period: Optional[str] = None, db: Session = Depends(get_db),
                     _=Depends(require_module("tech_tasks", "view"))):
    """Tổng Kế hoạch/Thực hiện mỗi hạng mục — chỉ cộng dòng Trung tâm
    (ft_name rỗng) để không đếm trùng với dòng chi tiết FT."""
    q = db.query(models.ProgressEntry).filter(models.ProgressEntry.ft_name.is_(None))
    if period:
        q = q.filter(models.ProgressEntry.period == period)
    agg = defaultdict(lambda: {"plan": 0.0, "done": 0.0})
    for r in q.all():
        b = agg[(r.category, r.item)]
        b["plan"] += r.plan_qty or 0
        b["done"] += r.done_qty or 0
    ensure_seeded(db)
    cat_labels = category_labels(db)
    out = []
    for i in progress_items(db):
        b = agg.get((i.category_code, i.code), {"plan": 0.0, "done": 0.0})
        plan, done = b["plan"], b["done"]
        out.append({
            "category": i.category_code, "category_label": cat_labels.get(i.category_code, i.category_code),
            "item": i.code, "item_label": i.label,
            "plan_qty": plan, "done_qty": done, "remaining": plan - done,
            "rate": (done / plan) if plan else None,
        })
    return out


@admin_router.get("/progress/centers")
def list_progress_centers(category: str, item: str, period: str, db: Session = Depends(get_db),
                          _=Depends(require_module("tech_tasks", "view"))):
    rows = (db.query(models.ProgressEntry)
            .filter(models.ProgressEntry.category == category, models.ProgressEntry.item == item,
                    models.ProgressEntry.period == period, models.ProgressEntry.ft_name.is_(None))
            .order_by(models.ProgressEntry.center).all())
    return [_out_progress(x, category_labels(db), item_labels(db)) for x in rows]


@admin_router.post("/progress/centers")
def create_progress_center(data: ProgressIn, db: Session = Depends(get_db),
                           user=Depends(require_module("tech_tasks", "create")), request: Request = None):
    if not (data.category or "").strip() or not (data.item or "").strip():
        raise HTTPException(400, "Chưa chọn đầu việc / hạng mục.")
    if not (data.period or "").strip():
        raise HTTPException(400, "Chưa nhập kỳ báo cáo.")
    if not (data.center or "").strip():
        raise HTTPException(400, "Chưa nhập trung tâm.")
    _validate_progress(data, db)
    row = upsert_progress_center(db, data.category, data.item, data.period.strip(), data.center.strip(),
                                  data.plan_qty or 0, data.done_qty or 0, data.note or "")
    db.commit(); db.refresh(row)
    log_action(db, user, "create", "tech_tasks", row.id, f"{row.item}/{row.center}/{row.period}", request=request)
    return _out_progress(row, category_labels(db), item_labels(db))


@admin_router.put("/progress/centers/{item_id}")
def update_progress_center(item_id: int, data: ProgressIn, db: Session = Depends(get_db),
                           user=Depends(require_module("tech_tasks", "update")), request: Request = None):
    _validate_progress(data, db)
    row = _get_progress(db, item_id)
    vals = data.model_dump(exclude_unset=True)
    vals.pop("ft_name", None)   # dòng trung tâm luôn giữ ft_name rỗng
    _apply(row, vals)
    db.commit(); db.refresh(row)
    log_action(db, user, "update", "tech_tasks", row.id, f"{row.item}/{row.center}/{row.period}", request=request)
    return _out_progress(row, category_labels(db), item_labels(db))


@admin_router.delete("/progress/centers/{item_id}")
def delete_progress_center(item_id: int, db: Session = Depends(get_db),
                           user=Depends(require_module("tech_tasks", "delete")), request: Request = None):
    row = _get_progress(db, item_id)
    label = f"{row.item}/{row.center}/{row.period}"
    db.delete(row); db.commit()
    log_action(db, user, "delete", "tech_tasks", item_id, label, request=request)
    return {"deleted": item_id}


@admin_router.get("/progress/ft")
def list_progress_ft(category: str, item: str, period: str, center: str, db: Session = Depends(get_db),
                     _=Depends(require_module("tech_tasks", "view"))):
    rows = (db.query(models.ProgressEntry)
            .filter(models.ProgressEntry.category == category, models.ProgressEntry.item == item,
                    models.ProgressEntry.period == period, models.ProgressEntry.center == center,
                    models.ProgressEntry.ft_name.isnot(None))
            .order_by(models.ProgressEntry.ft_name).all())
    return [_out_progress(x, category_labels(db), item_labels(db)) for x in rows]


@admin_router.post("/progress/ft")
def create_progress_ft(data: ProgressIn, db: Session = Depends(get_db),
                       user=Depends(require_module("tech_tasks", "create")), request: Request = None):
    if not (data.category or "").strip() or not (data.item or "").strip():
        raise HTTPException(400, "Chưa chọn đầu việc / hạng mục.")
    if not (data.period or "").strip() or not (data.center or "").strip():
        raise HTTPException(400, "Chưa nhập kỳ báo cáo / trung tâm.")
    if not (data.ft_name or "").strip():
        raise HTTPException(400, "Chưa nhập tên FT.")
    _validate_progress(data, db)
    existing = (db.query(models.ProgressEntry)
                .filter(models.ProgressEntry.category == data.category, models.ProgressEntry.item == data.item,
                        models.ProgressEntry.period == data.period.strip(), models.ProgressEntry.center == data.center.strip(),
                        models.ProgressEntry.ft_name == data.ft_name.strip())
                .first())
    if existing:
        existing.plan_qty, existing.done_qty = data.plan_qty or 0, data.done_qty or 0
        if data.note:
            existing.note = data.note
        row = existing
    else:
        row = models.ProgressEntry(
            category=data.category, item=data.item, period=data.period.strip(), center=data.center.strip(),
            ft_name=data.ft_name.strip(), plan_qty=data.plan_qty or 0, done_qty=data.done_qty or 0,
            note=data.note or "",
        )
        db.add(row)
    db.commit(); db.refresh(row)
    log_action(db, user, "create", "tech_tasks", row.id, f"{row.item}/{row.center}/{row.ft_name}", request=request)
    return _out_progress(row, category_labels(db), item_labels(db))


@admin_router.put("/progress/ft/{item_id}")
def update_progress_ft(item_id: int, data: ProgressIn, db: Session = Depends(get_db),
                       user=Depends(require_module("tech_tasks", "update")), request: Request = None):
    _validate_progress(data, db)
    row = _get_progress(db, item_id)
    _apply(row, data.model_dump(exclude_unset=True))
    db.commit(); db.refresh(row)
    log_action(db, user, "update", "tech_tasks", row.id, f"{row.item}/{row.center}/{row.ft_name}", request=request)
    return _out_progress(row, category_labels(db), item_labels(db))


@admin_router.delete("/progress/ft/{item_id}")
def delete_progress_ft(item_id: int, db: Session = Depends(get_db),
                       user=Depends(require_module("tech_tasks", "delete")), request: Request = None):
    row = _get_progress(db, item_id)
    label = f"{row.item}/{row.center}/{row.ft_name}"
    db.delete(row); db.commit()
    log_action(db, user, "delete", "tech_tasks", item_id, label, request=request)
    return {"deleted": item_id}


@admin_router.get("/progress/export")
def export_progress_csv(period: Optional[str] = None, db: Session = Depends(get_db),
                        _=Depends(require_module("tech_tasks", "update"))):
    """Xuất toàn bộ dòng tiến độ theo Trung tâm (không gồm dòng chi tiết FT)."""
    q = db.query(models.ProgressEntry).filter(models.ProgressEntry.ft_name.is_(None))
    if period:
        q = q.filter(models.ProgressEntry.period == period)
    rows = q.order_by(models.ProgressEntry.category, models.ProgressEntry.item,
                       models.ProgressEntry.period, models.ProgressEntry.center).all()
    header = ["Đầu việc", "Hạng mục", "Kỳ báo cáo", "Trung tâm", "Kế hoạch", "Thực hiện", "Tồn", "Tỷ lệ HT", "Ghi chú"]
    cat_labels, it_labels = category_labels(db), item_labels(db)
    lines = [",".join(header)]
    for r in rows:
        plan, done = r.plan_qty or 0, r.done_qty or 0
        ty_le = f"{done / plan * 100:.0f}%" if plan else "-"
        vals = [
            cat_labels.get(r.category, r.category), it_labels.get(r.item, r.item),
            r.period, r.center, plan, done, plan - done, ty_le, r.note or "",
        ]
        lines.append(",".join('"' + str(v).replace('"', '""') + '"' for v in vals))
    content = "﻿" + "\n".join(lines) + "\n"
    return PlainTextResponse(
        content, media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="tien-do-ky-thuat-{models.today()}.csv"'},
    )
