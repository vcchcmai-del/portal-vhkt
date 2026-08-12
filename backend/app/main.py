"""
Cổng thông tin nội bộ — Chi nhánh Công trình Viettel
API backend viết bằng FastAPI.

Chạy thử:  uvicorn app.main:app --reload
Tài liệu API tự sinh:  http://localhost:8000/docs
"""
import datetime as dt
import os
import unicodedata
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy import func, or_, text
from sqlalchemy.orm import Session

from . import models
from .admin import router as admin_router
from .dutyroster import admin_router as dutyroster_admin_router, public_router as dutyroster_router
from .operations import admin_router as operations_admin_router, public_router as operations_router
from .recruitment import admin_router as recruitment_admin_router, public_router as recruitment_router
from .auditlog import log_action
from .auth import create_token, current_user, current_user_optional, verify_password
from .database import Base, engine, get_db
from .permissions import effective_permission_matrix, effective_permissions_list, require_module

# Số hiệu phiên bản API. Tăng lên mỗi khi bổ sung đường dẫn mới.
# Giao diện đối chiếu số này để phát hiện trường hợp giao diện mới hơn máy chủ.
API_VERSION = 9

# Dấu hiệu bản dựng. Phải trùng với BUILD_ID trong frontend/src/build.js
#
# CỐ Ý không cho biến môi trường ghi đè giá trị này. Mục đích của nó là cho biết
# ĐANG CHẠY MÃ NGUỒN NÀO. Nếu để môi trường ghi đè, một biến cũ còn sót trên nền
# tảng triển khai sẽ khiến máy chủ báo sai, và cơ chế phát hiện lệch bản mất tác dụng.
PORTAL_BUILD = "2026-08-12.v28"

# Nhãn môi trường do người triển khai đặt, ví dụ "thử nghiệm", "chính thức".
# Chỉ để ghi chú, không thay thế dấu hiệu bản dựng.
DEPLOY_LABEL = os.getenv("PORTAL_BUILD", "") or os.getenv("DEPLOY_LABEL", "")

# Các tính năng máy chủ này có. Giao diện dựa vào đây để biết cái gì dùng được.
API_FEATURES = [
    "thread_detail",      # xem nội dung chủ đề và trả lời
    "meeting_info",       # thành phần tham gia và hình thức họp
    "news_body",          # đọc nội dung bản tin
    "idea_body",          # xem chi tiết sáng kiến
    "bulk_import",        # nhập dữ liệu hàng loạt
    "sheet_source",       # nối Google Sheet
    "diagnostics",        # kiểm tra hệ thống
    "media_album",        # album ảnh và video
    "doc_categories",     # danh mục tài liệu mở rộng
    "technical_operations", # sự cố, WO, bàn giao ca và lịch trực
    "recruitment",         # hồ sơ ứng viên tuyển dụng
]

app = FastAPI(
    title="Cổng thông tin nội bộ CNCT",
    description="API phục vụ trang chủ, truyền thông, tài liệu, dashboard và danh bạ của chi nhánh.",
    version="1.0.0",
)

# Cho phép frontend gọi API. Khi chạy thật, thay "*" bằng tên miền nội bộ.
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def no_cache_html(request: Request, call_next):
    """
    Hai việc:

    1. Không cho trình duyệt lưu index.html. Cần thiết vì tên tệp giao diện có
       kèm mã băm; giữ lại index.html cũ sẽ trỏ tới tệp không còn tồn tại và
       trang mất hết tương tác.

    2. Gắn dấu hiệu bản dựng vào tiêu đề mọi phản hồi. Nhờ vậy kiểm tra được
       đang chạy bản nào mà không cần mở trang, và phát hiện được trường hợp
       nền tảng chạy song song nhiều bản khác nhau.
    """
    response = await call_next(request)
    response.headers["X-Portal-Build"] = PORTAL_BUILD
    if request.url.path == "/" or request.url.path.endswith("/index.html"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
    return response


app.include_router(admin_router)
app.include_router(operations_router)
app.include_router(operations_admin_router)
app.include_router(recruitment_router)
app.include_router(recruitment_admin_router)
app.include_router(dutyroster_router)
app.include_router(dutyroster_admin_router)


@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_error_handler(request: Request, exc: SQLAlchemyError):
    """Không để lỗi CSDL chưa bắt được làm request rơi thành lỗi proxy khó hiểu."""
    return JSONResponse(
        status_code=503,
        content={"detail": "Cơ sở dữ liệu đang bận hoặc chưa sẵn sàng. Vui lòng thử lại sau vài giây."},
    )


def _uploads_dir():
    base = os.getenv("DATA_DIR") or os.path.join(os.getcwd(), "data")
    path = os.path.join(base, "uploads")
    os.makedirs(path, exist_ok=True)
    return path


# Ảnh do người dùng tải lên được phục vụ tại /uploads/<tên tệp>
app.mount("/uploads", StaticFiles(directory=_uploads_dir()), name="uploads")


# Ghi lại lỗi phát sinh lúc khởi động để xem được qua /api/health,
# thay vì phải mò trong nhật ký máy chủ.
STARTUP_ERRORS: list = []
STARTUP_STEPS: list = []


@app.on_event("startup")
def on_startup():
    """
    Chuẩn bị cơ sở dữ liệu khi khởi động.

    QUAN TRỌNG: mọi bước ở đây đều bọc trong try/except.
    Nếu một bước lỗi mà để văng ra ngoài, tiến trình sẽ không khởi động được,
    nền tảng triển khai trả về lỗi 502 và không ai biết vì sao. Bọc lại thì
    ứng dụng vẫn lên, phần nào hỏng thì báo rõ ở /api/health và màn hình
    Kiểm tra hệ thống.
    """
    import logging
    log = logging.getLogger("portal.startup")

    def chay(ten, ham, bat_buoc=False):
        try:
            ham()
            STARTUP_STEPS.append({"buoc": ten, "trang_thai": "ok"})
            log.info("Khởi động — %s: xong", ten)
        except Exception as exc:  # noqa: BLE001
            loi = f"{type(exc).__name__}: {exc}"
            STARTUP_ERRORS.append({"buoc": ten, "loi": loi[:500], "bat_buoc": bat_buoc})
            STARTUP_STEPS.append({"buoc": ten, "trang_thai": "loi"})
            log.error("Khởi động — %s THẤT BẠI: %s", ten, loi, exc_info=True)

    # Bổ sung bảng và cột còn thiếu. Không có bước này thì các truy vấn chạm
    # cột mới sẽ hỏng, nhưng phần còn lại của hệ thống vẫn dùng được.
    def buoc_cau_truc():
        from .migrate import sync_schema
        sync_schema()
    chay("Cập nhật cấu trúc cơ sở dữ liệu", buoc_cau_truc, bat_buoc=True)

    # Nạp dữ liệu mẫu, chỉ chạy khi cơ sở dữ liệu còn trống.
    def buoc_seed():
        from .seed import seed_if_empty
        seed_if_empty()
    chay("Nạp dữ liệu mẫu", buoc_seed)

    # Tạo tài khoản quản trị. Đây là bước quan trọng nhất: hỏng thì không ai
    # đăng nhập được, nên ghi rõ vào danh sách lỗi.
    def buoc_tai_khoan():
        from .bootstrap import ensure_accounts
        ensure_accounts()
    chay("Kiểm tra tài khoản quản trị", buoc_tai_khoan, bat_buoc=True)

    # Chạy nền: mỗi giờ dọn thùng rác, xoá vĩnh viễn mục đã quá 30 ngày.
    def buoc_thung_rac():
        from .trash import start_trash_purge_thread
        start_trash_purge_thread()
    chay("Khởi động dọn thùng rác tự động", buoc_thung_rac)

    if STARTUP_ERRORS:
        log.error("Khởi động xong nhưng có %d bước lỗi. Xem /api/health để biết chi tiết.",
                  len(STARTUP_ERRORS))
    else:
        log.info("Khởi động hoàn tất, không có lỗi.")


# ------------------------------------------------- Tiện ích tìm kiếm tiếng Việt

def strip_accents(text: Optional[str]) -> str:
    """Bỏ dấu tiếng Việt để gõ 'xang dau' vẫn tìm ra 'xăng dầu'."""
    if not text:
        return ""
    text = unicodedata.normalize("NFD", text.lower())
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    return text.replace("\u0111", "d")


def matches(needle: str, *fields: Optional[str]) -> bool:
    n = strip_accents(needle).strip()
    return bool(n) and n in strip_accents(" ".join(f or "" for f in fields))


# ----------------------------------------------------------------- Đăng nhập

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    full_name: str
    role: str
    permissions: List[str] = []
    permission_actions: dict = {}
    must_change_password: bool = False


@app.post("/api/auth/login", response_model=TokenOut, tags=["Đăng nhập"])
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db), request: Request = None):
    user = db.query(models.User).filter(models.User.username == form.username).first()
    if not user or not verify_password(form.password, user.password_hash):
        log_action(db, user, "login_failed", "auth", None, form.username, request=request)
        raise HTTPException(status_code=401, detail="Sai tài khoản hoặc mật khẩu.")
    log_action(db, user, "login", "auth", user.id, user.username, request=request)
    return TokenOut(access_token=create_token(user), full_name=user.full_name, role=user.role,
                    permissions=effective_permissions_list(user),
                    permission_actions=effective_permission_matrix(user),
                    must_change_password=bool(user.must_change_password))


@app.get("/api/auth/me", tags=["Đăng nhập"])
def me(user: models.User = Depends(current_user)):
    return {"id": user.id, "username": user.username, "full_name": user.full_name, "role": user.role,
            "permissions": effective_permissions_list(user),
            "permission_actions": effective_permission_matrix(user),
            "must_change_password": bool(user.must_change_password)}


# ------------------------------------------------------------------ Trang chủ

@app.get("/api/home", tags=["Trang chủ"])
def home(db: Session = Depends(get_db)):
    """Gom mọi thứ trang chủ cần vào một lần gọi, để trang mở nhanh."""
    today = dt.date.today()
    notice = (
        db.query(models.Notice)
        .filter(models.Notice.active.is_(True))
        .order_by(models.Notice.starts_at.desc())
        .first()
    )
    featured = (
        db.query(models.News)
        .filter(models.News.visible.is_(True), models.News.deleted_at.is_(None))
        .order_by(models.News.pinned.desc(), models.News.featured.desc(),
                  models.News.published_at.desc())
        .limit(3).all()
    )
    banners = (
        db.query(models.Banner)
        .filter(models.Banner.active.is_(True))
        .order_by(models.Banner.order_no).all()
    )
    config = {c.key: c.value for c in db.query(models.SiteConfig).all()}
    schedule = (
        db.query(models.Event)
        .filter(models.Event.kind == "work", func.date(models.Event.start_at) == today)
        .order_by(models.Event.start_at)
        .all()
    )

    # Lịch công tác lấy từ Google Sheet nếu đã cấu hình, lọc đúng ngày hôm nay
    from .sheets import get_data
    sheet_schedule = [
        {"time": r.get("gio", ""), "title": r.get("noi_dung", ""),
         "place": r.get("dia_diem", ""), "host": r.get("chu_tri", ""),
         "participants": r.get("thanh_phan", ""),
         "meeting_type": r.get("hinh_thuc", ""),
         "meeting_info": r.get("thong_tin_hop", "")}
        for r in get_data(db, "schedule", models)
        if r.get("ngay") == today.isoformat()
    ]

    # Sáu ô chỉ số trang chủ.
    # Ưu tiên Google Sheet; chưa có thì tính từ bảng số liệu trong cơ sở dữ liệu.
    home_stats = get_data(db, "home_stats", models)
    if not home_stats:
        home_stats = tinh_chi_so_trang_chu(db)
    birthdays = (
        db.query(models.Person)
        .filter(
            models.Person.birthday.isnot(None),
            func.extract("month", models.Person.birthday) == today.month,
        )
        .order_by(func.extract("day", models.Person.birthday))
        .limit(8).all()
    )
    return {
        "notice": {"id": notice.id, "content": notice.content, "level": notice.level} if notice else None,
        "news": [
            {"id": n.id, "title": n.title, "excerpt": n.excerpt, "tag": n.tag,
             "author": n.author, "cover_url": n.cover_url, "pinned": n.pinned,
             "published_at": n.published_at}
            for n in featured
        ],
        "banners": [
            {"id": b.id, "title": b.title, "image_url": b.image_url,
             "link_url": b.link_url, "color": b.color} for b in banners
        ],
        "config": config,
        "schedule": sheet_schedule if sheet_schedule else [
            {"time": e.start_at.strftime("%H:%M"), "title": e.title,
             "place": e.place, "host": e.host,
             "participants": e.participants,
             "meeting_type": e.meeting_type or "truc_tiep",
             "meeting_info": e.meeting_info,
             "meeting_id": e.meeting_id,
             "meeting_pass": e.meeting_pass}
            for e in schedule
        ],
        "schedule_from_sheet": bool(sheet_schedule),
        "home_stats": home_stats,
        "home_stats_source": ("sheet" if get_data(db, "home_stats", models)
                              else ("database" if home_stats else "none")),
        "birthdays": [
            {"name": p.full_name, "dept": p.dept, "color": p.color,
             "day": p.birthday.strftime("%d/%m") if p.birthday else None}
            for p in birthdays
        ],
        "kpi": kpi_summary(db),
    }


def _so_lieu_moi_nhat(db: Session, board: str, label: str):
    """Lấy giá trị mới nhất của một chỉ tiêu trong bảng số liệu."""
    row = (
        db.query(models.Metric)
        .filter(models.Metric.board == board, models.Metric.label == label)
        .order_by(models.Metric.period.desc())
        .first()
    )
    return row.value if row else None


def _so_viet(v, le=0):
    """Định dạng số theo cách viết Việt Nam: 1.284 và 94,2."""
    if v is None:
        return None
    s = f"{v:,.{le}f}"
    return s.replace(",", "\u0000").replace(".", ",").replace("\u0000", ".")


def tinh_chi_so_trang_chu(db: Session):
    """
    Dựng sáu ô chỉ số trang chủ từ bảng số liệu trong cơ sở dữ liệu.

    Dùng khi chưa nối Google Sheet. Chỉ tiêu nào không có số thì bỏ qua ô đó,
    không bịa số. Không có ô nào thì trả về danh sách rỗng, giao diện sẽ hiện
    số liệu mẫu kèm ghi chú rõ ràng.
    """
    out = []

    kh = _so_lieu_moi_nhat(db, "KPI", "Kế hoạch")
    th = _so_lieu_moi_nhat(db, "KPI", "Thực hiện")
    if th is not None:
        out.append({
            "ma": "kpi", "nhan": "HOÀN THÀNH KPI THÁNG",
            "gia_tri": _so_viet(th, 1), "don_vi": "%",
            "muc_tieu": f"Mục tiêu: {_so_viet(kh or 100)}%",
            "mau": "green", "tien_do": min(th, 100),
        })

    giao = _so_lieu_moi_nhat(db, "WO", "Được giao")
    xong = _so_lieu_moi_nhat(db, "WO", "Hoàn thành")
    if giao and xong is not None:
        ty = round(xong / giao * 100, 2)
        out.append({
            "ma": "wo_dung_han", "nhan": "WO ĐÚNG HẠN",
            "gia_tri": _so_viet(ty, 2), "don_vi": "%",
            "muc_tieu": f"{_so_viet(xong)}/{_so_viet(giao)} phiếu",
            "ghi_chu": "Đạt" if ty >= 90 else "Chưa đạt",
            "mau": "orange",
        })

    phat = _so_lieu_moi_nhat(db, "FUEL", "Tiền phạt")
    if phat is not None:
        out.append({
            "ma": "tien_phat", "nhan": "TIỀN PHẠT THÁNG",
            "gia_tri": _so_viet(phat), "don_vi": "đ",
            "muc_tieu": "Mục tiêu: 0 đ", "mau": "blue",
        })

    sc = _so_lieu_moi_nhat(db, "NETWORK", "Số sự cố")
    if sc is not None:
        out.append({
            "ma": "su_co_ngay", "nhan": "SỰ CỐ NGÀY",
            "gia_tri": _so_viet(sc), "don_vi": "",
            "ghi_chu": "Ngày gần nhất", "mau": "purple",
        })

    if giao and xong is not None:
        out.append({
            "ma": "wo_qua_han", "nhan": "WO QUÁ HẠN",
            "gia_tri": _so_viet(giao - xong), "don_vi": "",
            "ghi_chu": "Chưa hoàn thành", "mau": "orange",
        })

    av = _so_lieu_moi_nhat(db, "NETWORK", "Availability")
    if av is not None:
        out.append({
            "ma": "an_toan", "nhan": "CHẤT LƯỢNG MẠNG",
            "gia_tri": _so_viet(av, 2), "don_vi": "%",
            "ghi_chu": "Availability", "mau": "teal",
        })

    return out


def kpi_summary(db: Session):
    """Bốn ô số liệu tóm tắt trên trang chủ."""
    out = []
    for board, label in [("KPI", "Hoàn thành KPI tháng"), ("WO", "WO hoàn thành"),
                         ("PAKH", "PAKH đã xử lý"), ("NETWORK", "Chất lượng mạng")]:
        rows = (
            db.query(models.Metric)
            .filter(models.Metric.board == board, models.Metric.label.in_(["Thực hiện", "Hoàn thành", "Đã xử lý", "Availability"]))
            .order_by(models.Metric.period.desc())
            .limit(2).all()
        )
        if not rows:
            continue
        latest = rows[0].value
        prev = rows[1].value if len(rows) > 1 else latest
        delta = round((latest - prev) / prev * 100, 1) if prev else 0.0
        out.append({"board": board, "label": label, "value": latest, "delta": delta})
    return out


# ------------------------------------------------------- Truyền thông nội bộ

def _gallery(raw):
    """Đọc danh sách ảnh đính kèm lưu dạng JSON, hỏng thì trả danh sách rỗng."""
    if not raw:
        return []
    try:
        import json
        data = json.loads(raw)
        return data if isinstance(data, list) else []
    except (ValueError, TypeError):
        return []


@app.get("/api/news", tags=["Truyền thông"])
def list_news(
    category: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = Query(20, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(models.News).filter(models.News.visible.is_(True), models.News.deleted_at.is_(None))
    if category and category != "Tất cả":
        query = query.filter(models.News.category == category)
    rows = query.order_by(models.News.pinned.desc(),
                          models.News.published_at.desc()).limit(limit).all()
    if q:
        rows = [n for n in rows if matches(q, n.title, n.excerpt, n.category)]
    return [
        {"id": n.id, "title": n.title, "excerpt": n.excerpt, "body": n.body,
         "category": n.category, "tag": n.tag, "author": n.author,
         "cover_url": n.cover_url, "gallery": _gallery(n.gallery),
         "featured": n.featured, "pinned": n.pinned,
         "published_at": n.published_at}
        for n in rows
    ]


class NewsIn(BaseModel):
    title: str
    excerpt: str = ""
    body: str = ""
    category: str = "Hoạt động"
    tag: str = "Tin tức"


@app.post("/api/news", tags=["Truyền thông"])
def create_news(data: NewsIn, db: Session = Depends(get_db), user=Depends(require_module("news", "create")),
                request: Request = None):
    row = models.News(**data.model_dump(), author=user.full_name)
    db.add(row); db.commit(); db.refresh(row)
    log_action(db, user, "create", "news", row.id, row.title, request=request)
    return {"id": row.id}


# -------------------------------------------------------------- Kho tài liệu

@app.get("/api/documents", tags=["Kho tài liệu"])
def list_documents(
    q: Optional[str] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Tìm kiếm toàn văn trên tiêu đề, số hiệu và nội dung tài liệu."""
    query = db.query(models.Document).filter(models.Document.deleted_at.is_(None))
    if category and category != "Tất cả":
        query = query.filter(models.Document.category == category)
    rows = query.order_by(models.Document.updated_on.desc()).all()
    if q:
        rows = [d for d in rows if matches(q, d.title, d.code, d.content_text, d.category)]
    return [
        {"id": d.id, "title": d.title, "code": d.code, "category": d.category,
         "size_label": d.size_label, "file_url": d.file_url, "updated_on": d.updated_on,
         "downloads": d.downloads}
        for d in rows
    ]


@app.post("/api/documents/{doc_id}/download", tags=["Kho tài liệu"])
def count_download(doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(models.Document).get(doc_id)
    if not doc or doc.deleted_at is not None:
        raise HTTPException(404, "Không tìm thấy tài liệu.")
    doc.downloads += 1
    db.commit()
    return {"file_url": doc.file_url, "downloads": doc.downloads}


# --------------------------------------------------------- Trung tâm ứng dụng

@app.get("/api/apps", tags=["Ứng dụng"])
def list_apps(db: Session = Depends(get_db)):
    rows = db.query(models.AppLink).order_by(models.AppLink.order_no).all()
    return [
        {"id": a.id, "name": a.name, "description": a.description, "url": a.url,
         "category": a.category, "color": a.color, "icon_url": a.icon_url or ""}
        for a in rows
    ]


# ------------------------------------------------------------------ Danh bạ

@app.get("/api/people", tags=["Danh bạ"])
def list_people(q: Optional[str] = None, dept: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.Person).filter(models.Person.active.is_(True))
    if dept and dept != "Tất cả":
        query = query.filter(models.Person.dept == dept)
    rows = query.order_by(models.Person.id).all()
    if q:
        rows = [p for p in rows if matches(q, p.full_name, p.role, p.dept, p.phone, p.email)]
    return [
        {"id": p.id, "name": p.full_name, "role": p.role, "dept": p.dept,
         "phone": p.phone, "email": p.email, "color": p.color, "photo_url": p.photo_url}
        for p in rows
    ]


# ---------------------------------------------------------------- Dashboard

def _flat_metric_rows(board: str, db: Session):
    """
    Danh sách phẳng {ky, chi_tieu, don_vi, gia_tri} của một bảng, ưu tiên
    Google Sheet nếu đã cấu hình, không thì đọc bảng Metric. Dùng chung cho
    cả phần vẽ biểu đồ (series) lẫn phần đối chiếu target/cùng kỳ (compare).
    """
    from .sheets import get_data
    sheet_rows = [r for r in get_data(db, "dashboard", models) if r.get("bang") == board]
    if sheet_rows:
        return [{"ky": r.get("ky"), "chi_tieu": r.get("chi_tieu"),
                 "don_vi": r.get("don_vi"), "gia_tri": r.get("gia_tri")} for r in sheet_rows], "sheet"

    rows = db.query(models.Metric).filter(models.Metric.board == board).order_by(models.Metric.period).all()
    return [{"ky": r.period, "chi_tieu": r.label, "don_vi": r.unit_name, "gia_tri": r.value} for r in rows], "database"


def _ky_cung_ky_truoc(ky: str):
    """"2026-08" -> "2025-08". Không đúng dạng YYYY-MM thì trả None."""
    try:
        nam, thang = ky.split("-")
        return f"{int(nam) - 1}-{thang}"
    except (ValueError, AttributeError):
        return None


def _hire_series_that(db: Session):
    """
    Bảng "Tuyển dụng" (HIRE) tính thẳng từ dữ liệu Ứng viên/Định biên thật đang
    có trong hệ thống — không cần nhập tay, luôn khớp với khu quản trị Tuyển dụng.
    """
    candidates = db.query(models.Candidate).all()
    staffing_rows = (
        db.query(models.CenterStaffing).order_by(models.CenterStaffing.report_date.desc()).all()
    )
    latest_per_center = {}
    for r in staffing_rows:
        latest_per_center.setdefault(r.center, r)
    nhu_cau = sum((r.oft_gap or 0) + (r.ft_gap or 0) for r in latest_per_center.values())

    da_phong_van = sum(1 for c in candidates if c.status not in ("new", "reviewing"))
    dat = sum(1 for c in candidates if c.status in ("hired", "probation", "left"))
    da_nhan_viec = sum(1 for c in candidates if c.status in ("hired", "probation"))

    return [
        {"name": "Nhu cầu", "Số lượng": nhu_cau},
        {"name": "Ứng tuyển", "Số lượng": len(candidates)},
        {"name": "Phỏng vấn", "Số lượng": da_phong_van},
        {"name": "Đạt", "Số lượng": dat},
        {"name": "Đã nhận việc", "Số lượng": da_nhan_viec},
    ]


def _nhom_phat_vtt_vtnet(db: Session):
    """
    Tổng tiền phạt theo tháng cho 2 nhóm VTT/VTNet (bảng KPI_VTT/KPI_VTNET),
    và cơ cấu nguyên nhân phạt của kỳ gần nhất mỗi nhóm — dùng cho biểu đồ
    xu thế 2 đường và 2 biểu đồ tròn trên tab Tiền phạt & Doanh thu.
    """
    vtt_rows, _ = _flat_metric_rows("KPI_VTT", db)
    vtnet_rows, _ = _flat_metric_rows("KPI_VTNET", db)
    if not vtt_rows and not vtnet_rows:
        return None

    tong_theo_ky: dict = {}
    for r in vtt_rows:
        tong_theo_ky.setdefault(r["ky"], {"name": r["ky"], "VTT": 0.0, "VTNet": 0.0})
        tong_theo_ky[r["ky"]]["VTT"] += r["gia_tri"] or 0
    for r in vtnet_rows:
        tong_theo_ky.setdefault(r["ky"], {"name": r["ky"], "VTT": 0.0, "VTNet": 0.0})
        tong_theo_ky[r["ky"]]["VTNet"] += r["gia_tri"] or 0
    xu_huong = [tong_theo_ky[k] for k in sorted(tong_theo_ky)]

    def _co_cau(rows):
        if not rows:
            return [], None
        ky_gan_nhat = max(r["ky"] for r in rows)
        return (
            [{"name": r["chi_tieu"], "value": r["gia_tri"]} for r in rows if r["ky"] == ky_gan_nhat and r["gia_tri"]],
            ky_gan_nhat,
        )

    co_cau_vtt, ky_vtt = _co_cau(vtt_rows)
    co_cau_vtnet, ky_vtnet = _co_cau(vtnet_rows)

    return {
        "xu_huong": xu_huong,
        "co_cau_vtt": co_cau_vtt, "ky_vtt": ky_vtt,
        "co_cau_vtnet": co_cau_vtnet, "ky_vtnet": ky_vtnet,
    }


def _ro_mang_dia_ban(db: Session):
    """
    Rời mạng CĐBR chi tiết theo địa bàn: số lượng theo tỉnh (WO_TINH), và số
    lượng + tỷ lệ theo huyện cho Bình Dương / Bà Rịa - Vũng Tàu (WO_HUYEN_BD,
    WO_HUYEN_BRVT). Bình quân tính động (không lưu sẵn) để không lệch khi có
    kỳ mới. Chỉ gắn vào bảng WO.
    """
    tinh_rows, _ = _flat_metric_rows("WO_TINH", db)
    huyen_bd_rows, _ = _flat_metric_rows("WO_HUYEN_BD", db)
    huyen_brvt_rows, _ = _flat_metric_rows("WO_HUYEN_BRVT", db)
    if not tinh_rows and not huyen_bd_rows and not huyen_brvt_rows:
        return None

    def _binh_quan(vals):
        vals = [v for v in vals if v is not None]
        return round(sum(vals) / len(vals), 2) if vals else None

    def _theo_tinh(rows):
        theo: dict = {}
        for r in rows:
            theo.setdefault(r["don_vi"], {})[r["ky"]] = r["gia_tri"]
        out = []
        for ten, theo_ky in theo.items():
            out.append({
                "ten": ten,
                "theo_thang": [{"ky": k, "gia_tri": theo_ky[k]} for k in sorted(theo_ky)],
                "binh_quan": _binh_quan(theo_ky.values()),
            })
        return sorted(out, key=lambda x: x["ten"])

    def _theo_huyen(rows, ten_tinh):
        theo: dict = {}
        for r in rows:
            d = theo.setdefault(r["don_vi"], {"sl": {}, "tl": {}, "thue_bao": None})
            if r["chi_tieu"] == "Số lượng rời mạng":
                d["sl"][r["ky"]] = r["gia_tri"]
            elif r["chi_tieu"] == "Tỷ lệ rời mạng":
                d["tl"][r["ky"]] = r["gia_tri"]
            elif r["chi_tieu"] == "Thuê bao FTTH":
                d["thue_bao"] = r["gia_tri"]
        out = []
        for huyen, d in theo.items():
            ky_sap_xep = sorted(d["tl"].keys())
            ky_3_thang_gan_nhat = ky_sap_xep[-3:]
            out.append({
                "tinh": ten_tinh, "huyen": huyen, "thue_bao": d["thue_bao"],
                "sl_theo_thang": [{"ky": k, "gia_tri": d["sl"].get(k)} for k in ky_sap_xep],
                "tl_theo_thang": [{"ky": k, "gia_tri": d["tl"].get(k)} for k in ky_sap_xep],
                "tl_binh_quan": _binh_quan(d["tl"].values()),
                "tl_binh_quan_3_thang": _binh_quan(d["tl"].get(k) for k in ky_3_thang_gan_nhat),
            })
        return sorted(out, key=lambda x: x["huyen"])

    return {
        "tinh": _theo_tinh(tinh_rows),
        "huyen": _theo_huyen(huyen_bd_rows, "Bình Dương") + _theo_huyen(huyen_brvt_rows, "Bà Rịa - Vũng Tàu"),
    }


@app.get("/api/dashboard/{board}", tags=["Dashboard"])
def dashboard(board: str, db: Session = Depends(get_db)):
    """
    Trả về số liệu của một bảng điều khiển.
    board nhận: KPI, WO, PAKH, FUEL, HIRE, OUTPUT, NETWORK, VHKT...

    Nếu có bảng "{board}_TARGET" thì tự đối chiếu thực hiện với chỉ tiêu,
    và tự so sánh với cùng kỳ năm trước (dựa trên đúng chỉ tiêu, kỳ dạng YYYY-MM).
    Kết quả đối chiếu nằm ở trường "compare", không ảnh hưởng "series" cũ
    (vẫn dùng để vẽ biểu đồ như trước).
    """
    board = board.upper()

    # Tuyển dụng luôn lấy thẳng từ dữ liệu Ứng viên/Định biên thật, không đọc
    # bảng Metric cũ (nhập tay rời rạc, dễ lệch với dữ liệu tuyển dụng thật).
    if board == "HIRE":
        return {"board": board, "series": _hire_series_that(db), "source": "database",
                "compare": [], "canh_bao_trung_tam": [], "nhom_phat": None, "dia_ban": None}

    rows, nguon = _flat_metric_rows(board, db)
    if not rows:
        raise HTTPException(404, f"Chưa có số liệu cho bảng {board}.")

    # Gom theo kỳ (hoặc đơn vị) để frontend vẽ biểu đồ ngay — giữ nguyên hành vi cũ
    buckets: dict = {}
    for r in rows:
        key = r["don_vi"] or r["ky"]
        buckets.setdefault(key, {"name": key})
        buckets[key][r["chi_tieu"]] = r["gia_tri"]

    # Đối chiếu target (nếu có) + cùng kỳ năm trước — luôn dựng từ "rows" thật,
    # target chỉ đơn giản là None khi chưa có bảng "{board}_TARGET" hay chưa nhập
    # target cho đúng kỳ/chỉ tiêu đó (trước đây bỏ qua toàn bộ "compare" khi
    # KHÔNG có target_rows, khiến những bảng chưa có target — như tỷ lệ phạt,
    # chất lượng mạng, KPI vận hành — không lên biểu đồ dù đã có số liệu thật).
    # Khoá đối chiếu gồm cả đơn vị/trung tâm — 2 trung tâm nhập cùng chỉ tiêu,
    # cùng kỳ thì KHÔNG được đè lên nhau (đây là lỗi đã sửa so với bản đầu).
    target_rows, _ = _flat_metric_rows(f"{board}_TARGET", db)
    target_map = {(r["ky"], r["chi_tieu"], r["don_vi"]): r["gia_tri"] for r in target_rows}
    # Target không kèm đơn vị (đơn_vi=None) coi là target chung áp cho mọi trung tâm.
    target_chung = {(r["ky"], r["chi_tieu"]): r["gia_tri"] for r in target_rows if not r["don_vi"]}
    actual_map = {(r["ky"], r["chi_tieu"], r["don_vi"]): r["gia_tri"] for r in rows}

    def _target_cua(ky, chi_tieu, don_vi):
        return target_map.get((ky, chi_tieu, don_vi)) or target_chung.get((ky, chi_tieu))

    compare = []
    for r in rows:
        ky, chi_tieu, don_vi, gia_tri = r["ky"], r["chi_tieu"], r["don_vi"], r["gia_tri"]
        target = _target_cua(ky, chi_tieu, don_vi)
        ky_truoc = _ky_cung_ky_truoc(ky)
        gia_tri_ky_truoc = actual_map.get((ky_truoc, chi_tieu, don_vi)) if ky_truoc else None
        compare.append({
            "ky": ky, "chi_tieu": chi_tieu, "don_vi": don_vi, "thuc_hien": gia_tri,
            "target": target,
            "dat_target_phan_tram": round(gia_tri / target * 100, 1) if target else None,
            "cung_ky_truoc": gia_tri_ky_truoc,
            "chenh_lech_cung_ky_phan_tram": (
                round((gia_tri - gia_tri_ky_truoc) / gia_tri_ky_truoc * 100, 1)
                if gia_tri_ky_truoc else None
            ),
        })

    # Cảnh báo trung tâm chưa đạt — chỉ tính cho KPI vận hành (VHKT), nơi các
    # chỉ tiêu (Cell*h, SCTD, TKM, XLSC...) càng thấp càng tốt, vượt target là chưa đạt.
    canh_bao_trung_tam = []
    if board == "VHKT" and compare:
        ky_moi_nhat = max(r["ky"] for r in compare if r["ky"])
        theo_trung_tam: dict = {}
        for r in compare:
            if r["ky"] != ky_moi_nhat or not r["don_vi"] or r["target"] is None:
                continue
            if r["thuc_hien"] is not None and r["thuc_hien"] > r["target"]:
                theo_trung_tam.setdefault(r["don_vi"], []).append(r["chi_tieu"])
        canh_bao_trung_tam = [
            {"trung_tam": tt, "chi_tieu_khong_dat": chi_tieu_list, "ky": ky_moi_nhat}
            for tt, chi_tieu_list in sorted(theo_trung_tam.items())
        ]

    return {
        "board": board, "series": list(buckets.values()), "source": nguon,
        "compare": compare, "canh_bao_trung_tam": canh_bao_trung_tam,
        "nhom_phat": _nhom_phat_vtt_vtnet(db) if board == "KPI" else None,
        "dia_ban": _ro_mang_dia_ban(db) if board == "WO" else None,
    }


# ------------------------------------------------------------- Góc sáng kiến

@app.get("/api/ideas", tags=["Sáng kiến"])
def list_ideas(db: Session = Depends(get_db)):
    rows = db.query(models.Idea).order_by(models.Idea.votes.desc()).all()
    return [
        {"id": i.id, "title": i.title, "body": i.body, "benefit": i.benefit,
         "status": i.status, "votes": i.votes, "dept": i.dept,
         "author": i.author.full_name if i.author else "Ẩn danh",
         "created_at": i.created_at}
        for i in rows
    ]


class IdeaIn(BaseModel):
    title: str
    body: str = ""
    benefit: str = ""


@app.post("/api/ideas", tags=["Sáng kiến"])
def create_idea(data: IdeaIn, db: Session = Depends(get_db), user=Depends(current_user)):
    row = models.Idea(
        title=data.title, body=data.body, benefit=data.benefit,
        author_id=user.person_id, dept=user.person.dept if user.person else None,
    )
    db.add(row); db.commit(); db.refresh(row)
    return {"id": row.id}


@app.post("/api/ideas/{idea_id}/vote", tags=["Sáng kiến"])
def vote_idea(idea_id: int, db: Session = Depends(get_db), user=Depends(current_user)):
    """Mỗi tài khoản bình chọn một lần cho mỗi sáng kiến."""
    idea = db.query(models.Idea).get(idea_id)
    if not idea:
        raise HTTPException(404, "Không tìm thấy sáng kiến.")
    existed = (
        db.query(models.IdeaVote)
        .filter(models.IdeaVote.idea_id == idea_id, models.IdeaVote.user_id == user.id)
        .first()
    )
    if existed:
        raise HTTPException(400, "Bạn đã bình chọn cho sáng kiến này.")
    db.add(models.IdeaVote(idea_id=idea_id, user_id=user.id))
    idea.votes += 1
    db.commit()
    return {"votes": idea.votes}


# ----------------------------------------------------------- Trao đổi nội bộ

@app.get("/api/channels", tags=["Trao đổi"])
def list_channels(db: Session = Depends(get_db)):
    rows = db.query(models.Channel).all()
    out = []
    for c in rows:
        count = db.query(models.Thread).filter(
            models.Thread.channel_id == c.id, models.Thread.status == "approved",
        ).count()
        out.append({"id": c.id, "slug": c.slug, "name": c.name, "threads": count})
    return out


def _visible_thread_filter(query, user):
    """Chỉ trả về chủ đề đã duyệt, cộng thêm chủ đề của chính mình (đang chờ
    duyệt) nếu đã đăng nhập, hoặc mọi chủ đề nếu là quản trị viên."""
    if user and user.role == "admin":
        return query
    if user:
        return query.filter(or_(models.Thread.status == "approved", models.Thread.author_id == user.id))
    return query.filter(models.Thread.status == "approved")


def _visible_replies(replies, user):
    if user and user.role == "admin":
        return replies
    return [r for r in replies if r.status == "approved" or (user and r.author_id == user.id)]


@app.get("/api/channels/{slug}/threads", tags=["Trao đổi"])
def list_threads(slug: str, db: Session = Depends(get_db),
                 user: Optional[models.User] = Depends(current_user_optional)):
    ch = db.query(models.Channel).filter(models.Channel.slug == slug).first()
    if not ch:
        raise HTTPException(404, "Không tìm thấy kênh trao đổi.")
    q = db.query(models.Thread).filter(models.Thread.channel_id == ch.id)
    rows = _visible_thread_filter(q, user).order_by(models.Thread.created_at.desc()).all()
    return [
        {"id": t.id, "title": t.title, "author": t.author_name, "tag": t.tag,
         "status": t.status, "replies": len(_visible_replies(t.replies, user)), "created_at": t.created_at}
        for t in rows
    ]


@app.get("/api/threads/{thread_id}", tags=["Trao đổi"])
def get_thread(thread_id: int, db: Session = Depends(get_db),
               user: Optional[models.User] = Depends(current_user_optional)):
    """Nội dung một chủ đề thảo luận kèm toàn bộ câu trả lời."""
    t = db.get(models.Thread, thread_id)
    if not t:
        raise HTTPException(404, "Không tìm thấy chủ đề.")
    is_owner_or_admin = user and (user.role == "admin" or t.author_id == user.id)
    if t.status != "approved" and not is_owner_or_admin:
        raise HTTPException(404, "Không tìm thấy chủ đề.")
    return {
        "id": t.id, "title": t.title, "author": t.author_name, "tag": t.tag,
        "status": t.status,
        "channel": t.channel.name if t.channel else None,
        "created_at": t.created_at,
        "replies": [
            {"id": r.id, "body": r.body, "author": r.author_name, "status": r.status, "created_at": r.created_at}
            for r in sorted(_visible_replies(t.replies, user), key=lambda x: x.created_at or dt.datetime.min)
        ],
    }


class ReplyIn(BaseModel):
    body: str


@app.post("/api/threads/{thread_id}/replies", tags=["Trao đổi"])
def add_reply(thread_id: int, data: ReplyIn, db: Session = Depends(get_db),
              user: models.User = Depends(current_user)):
    """Trả lời một chủ đề. Phải đăng nhập mới trả lời được. Trả lời cần quản
    trị viên duyệt mới hiển thị công khai."""
    t = db.get(models.Thread, thread_id)
    if not t:
        raise HTTPException(404, "Không tìm thấy chủ đề.")
    if not (data.body or "").strip():
        raise HTTPException(400, "Chưa nhập nội dung trả lời.")

    r = models.Reply(thread_id=t.id, body=data.body.strip(), author_id=user.id,
                     author_name=user.full_name, status="pending")
    db.add(r); db.commit(); db.refresh(r)
    return {"id": r.id, "body": r.body, "author": r.author_name, "status": r.status, "created_at": r.created_at}


class ThreadIn(BaseModel):
    title: str
    tag: str = "Thảo luận"


@app.post("/api/channels/{slug}/threads", tags=["Trao đổi"])
def create_thread(slug: str, data: ThreadIn, db: Session = Depends(get_db), user=Depends(current_user)):
    """Đăng chủ đề mới. Cần quản trị viên duyệt mới hiển thị công khai."""
    ch = db.query(models.Channel).filter(models.Channel.slug == slug).first()
    if not ch:
        raise HTTPException(404, "Không tìm thấy kênh trao đổi.")
    row = models.Thread(channel_id=ch.id, title=data.title, tag=data.tag,
                        author_id=user.id, author_name=user.full_name, status="pending")
    db.add(row); db.commit(); db.refresh(row)
    return {"id": row.id, "status": row.status}


# ------------------------------------------------------------ Tìm kiếm tổng

@app.get("/api/search", tags=["Tìm kiếm"])
def global_search(q: str, db: Session = Depends(get_db)):
    """
    Một ô tìm kiếm cho cả tài liệu, danh bạ, ứng dụng, tin tức và sáng kiến.
    Không phân biệt dấu tiếng Việt và chữ hoa chữ thường.
    """
    if len(q.strip()) < 2:
        return []
    hits: List[dict] = []

    for a in db.query(models.AppLink).all():
        if matches(q, a.name, a.description, a.category):
            hits.append({"kind": "Ứng dụng", "label": a.name, "sub": a.description,
                         "url": a.url, "view": "apps"})

    for d in db.query(models.Document).filter(models.Document.deleted_at.is_(None)).all():
        if matches(q, d.title, d.code, d.content_text, d.category):
            hits.append({"kind": "Tài liệu", "label": d.title,
                         "sub": f"{d.code} · {d.category}", "url": d.file_url, "view": "docs"})

    for p in db.query(models.Person).filter(models.Person.active.is_(True)).all():
        if matches(q, p.full_name, p.role, p.dept, p.phone, p.email):
            hits.append({"kind": "Danh bạ", "label": p.full_name,
                         "sub": f"{p.role} · {p.dept}", "view": "people"})

    return hits[:12]


class ChangeMyPassword(BaseModel):
    old_password: str
    new_password: str


@app.post("/api/auth/change-password", tags=["Đăng nhập"])
def change_my_password(data: ChangeMyPassword, db: Session = Depends(get_db),
                       user: models.User = Depends(current_user), request: Request = None):
    """Người dùng tự đổi mật khẩu của mình."""
    from .auth import hash_password
    if not verify_password(data.old_password, user.password_hash):
        raise HTTPException(400, "Mật khẩu hiện tại không đúng.")
    if len(data.new_password) < 8:
        raise HTTPException(400, "Mật khẩu mới phải có ít nhất 8 ký tự.")
    user.password_hash = hash_password(data.new_password)
    user.must_change_password = False
    db.commit()
    log_action(db, user, "change_password", "auth", user.id, user.username, request=request)
    return {"ok": True}


@app.get("/api/config", tags=["Hệ thống"])
def public_config(db: Session = Depends(get_db)):
    """Cấu hình hiển thị của website. Ai cũng đọc được, chỉ admin sửa được."""
    return {c.key: c.value for c in db.query(models.SiteConfig).all()}


@app.get("/api/events", tags=["Góc văn hoá"])
def public_events(kind: str = "culture", db: Session = Depends(get_db)):
    rows = (db.query(models.Event).filter(models.Event.kind == kind)
            .order_by(models.Event.start_at).all())
    return [{"id": e.id, "title": e.title, "start_at": e.start_at,
             "place": e.place, "host": e.host,
             "participants": e.participants,
             "meeting_type": e.meeting_type or "truc_tiep",
             "meeting_info": e.meeting_info,
             "meeting_id": e.meeting_id,
             "meeting_pass": e.meeting_pass} for e in rows]


@app.get("/api/birthdays", tags=["Góc văn hoá"])
def public_birthdays(month: Optional[int] = None, db: Session = Depends(get_db)):
    m = month or dt.date.today().month
    rows = (db.query(models.Person)
            .filter(models.Person.active.is_(True), models.Person.birthday.isnot(None))
            .all())
    out = [{"name": p.full_name, "dept": p.dept, "color": p.color,
            "day": p.birthday.strftime("%d/%m")}
           for p in rows if p.birthday.month == m]
    return sorted(out, key=lambda x: x["day"])


@app.get("/api/media", tags=["Truyền thông"])
def public_media(kind: Optional[str] = None, limit: int = 40, db: Session = Depends(get_db)):
    """Album ảnh và video đang hiển thị."""
    q = db.query(models.MediaItem).filter(models.MediaItem.active.is_(True))
    if kind in ("image", "video"):
        q = q.filter(models.MediaItem.kind == kind)
    rows = q.order_by(models.MediaItem.order_no, models.MediaItem.id.desc()).limit(limit).all()
    return [{"id": m.id, "title": m.title, "kind": m.kind or "image", "url": m.url,
             "thumb_url": m.thumb_url, "author": m.author, "album": m.album,
             "color": m.color} for m in rows]


@app.get("/api/document-categories", tags=["Kho tài liệu"])
def public_doc_categories(db: Session = Depends(get_db)):
    """
    Danh mục tài liệu: danh sách chuẩn, cộng thêm những nhóm đã có trong dữ liệu
    nhưng chưa nằm trong danh sách chuẩn, để không nhóm nào bị lọt khỏi bộ lọc.
    """
    from .admin import DOC_CATEGORIES
    dang_dung = {c[0] for c in db.query(models.Document.category).distinct() if c[0]}
    them = sorted(dang_dung - set(DOC_CATEGORIES))
    return list(DOC_CATEGORIES) + them


@app.get("/api/health", tags=["Hệ thống"])
def health(db: Session = Depends(get_db)):
    """
    Kiểm tra ứng dụng còn sống (liveness). LUÔN trả 200 nếu tiến trình còn chạy.

    Vì sao không trả 503 khi cơ sở dữ liệu hỏng: các nền tảng triển khai dùng
    đường dẫn này để quyết định có khởi động lại container hay không. Nếu cơ sở
    dữ liệu tạm gián đoạn mà đường dẫn này trả 503, nền tảng sẽ liên tục giết và
    dựng lại container — làm hỏng thêm chứ không giúp gì, vì lỗi nằm ở cơ sở dữ
    liệu chứ không phải ở ứng dụng.

    Tình trạng cơ sở dữ liệu vẫn được báo trong trường "database" để theo dõi.
    Cần kiểm tra sẵn sàng phục vụ thì dùng /api/health/ready.
    """
    db_status, db_error = "ok", None
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001
        db_status = "error"
        db_error = str(exc)[:200]

    return {
        "status": "ok",
        "database": db_status,
        "database_error": db_error,
        "api_version": API_VERSION,
        "features": API_FEATURES,
        "startup_ok": len(STARTUP_ERRORS) == 0,
        "startup_errors": STARTUP_ERRORS,
        "build": PORTAL_BUILD,
        "deploy_label": DEPLOY_LABEL or None,
        "time": dt.datetime.now().isoformat(),
    }


@app.get("/api/health/ready", tags=["Hệ thống"])
def health_ready(db: Session = Depends(get_db)):
    """
    Kiểm tra sẵn sàng phục vụ (readiness): trả 503 khi cơ sở dữ liệu chưa dùng được.

    Dùng cho bộ cân bằng tải để tạm ngừng đưa lưu lượng vào, hoặc để giám sát.
    KHÔNG dùng đường dẫn này làm health check khởi động lại container.
    """
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ready", "database": "ok", "time": dt.datetime.now().isoformat()}
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=f"Cơ sở dữ liệu chưa sẵn sàng: {exc}") from exc


# --------------------------------------------------------------------------
# Phục vụ luôn giao diện web nếu có sẵn thư mục "static".
#
# Nhờ phần này, khi chạy trên máy tính cá nhân chỉ cần một tiến trình duy nhất:
# vừa là máy chủ dữ liệu, vừa là nơi phát trang web. Không cần nginx, không cần
# Docker. Khi chạy trên máy chủ thật bằng Docker thì nginx lo việc này, thư mục
# static không tồn tại nên đoạn dưới tự bỏ qua.
#
# Đặt ở cuối file vì đường dẫn "/" phải được khai báo sau tất cả đường dẫn /api.
# --------------------------------------------------------------------------
_static = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static")
if os.path.isdir(_static):
    app.mount("/", StaticFiles(directory=_static, html=True), name="static")
    print(f"Đang phát giao diện web từ: {_static}")
