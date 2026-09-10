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
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy import func, or_, text
from sqlalchemy.orm import Session

from . import models, province_codes
from .admin import router as admin_router
from .dutyroster import admin_router as dutyroster_admin_router, public_router as dutyroster_router
from .operations import admin_router as operations_admin_router, public_router as operations_router
from .recruitment import admin_router as recruitment_admin_router, public_router as recruitment_router
from .techtasks import admin_router as techtasks_admin_router
from .csdlht import admin_router as csdlht_admin_router
from .auditlog import log_action
from .auth import create_token, current_user, current_user_optional, verify_password
from .database import Base, engine, get_db
from .permissions import effective_permission_matrix, effective_permissions_list, require_module

# Số hiệu phiên bản API. Tăng lên mỗi khi bổ sung đường dẫn mới.
# Giao diện đối chiếu số này để phát hiện trường hợp giao diện mới hơn máy chủ.
API_VERSION = 12

# Dấu hiệu bản dựng. Phải trùng với BUILD_ID trong frontend/src/build.js
#
# CỐ Ý không cho biến môi trường ghi đè giá trị này. Mục đích của nó là cho biết
# ĐANG CHẠY MÃ NGUỒN NÀO. Nếu để môi trường ghi đè, một biến cũ còn sót trên nền
# tảng triển khai sẽ khiến máy chủ báo sai, và cơ chế phát hiện lệch bản mất tác dụng.
PORTAL_BUILD = "2026-09-08.v61"

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
    "tech_tasks",          # công việc 10 đầu việc mảng kỹ thuật
    "csdl_ht",             # tra cứu CSDL hạ tầng mạng lưới
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
    Ba việc:

    1. Không cho trình duyệt lưu index.html. Cần thiết vì tên tệp giao diện có
       kèm mã băm; giữ lại index.html cũ sẽ trỏ tới tệp không còn tồn tại và
       trang mất hết tương tác.

    2. Không cho lưu bất kỳ phản hồi /api/* nào. Nhiều API trả nội dung khác
       nhau tuỳ đã đăng nhập hay chưa (ví dụ /api/home — lịch họp bị khoá với
       người chưa đăng nhập, xem current_user_optional). Nếu trình duyệt lưu
       tạm phản hồi lúc còn đăng nhập, người dùng bấm tải lại sau khi đăng
       xuất vẫn có thể thấy lại đúng nội dung cũ đã lưu — không phải gọi lại
       máy chủ. Chặn lưu ở đây để loại hẳn khả năng đó, không lệ thuộc từng
       route có nhớ đặt header hay không.

    3. Gắn dấu hiệu bản dựng vào tiêu đề mọi phản hồi. Nhờ vậy kiểm tra được
       đang chạy bản nào mà không cần mở trang, và phát hiện được trường hợp
       nền tảng chạy song song nhiều bản khác nhau.
    """
    response = await call_next(request)
    response.headers["X-Portal-Build"] = PORTAL_BUILD
    if request.url.path == "/" or request.url.path.endswith("/index.html") or request.url.path.startswith("/api/"):
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
app.include_router(techtasks_admin_router)
app.include_router(csdlht_admin_router)


@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_error_handler(request: Request, exc: SQLAlchemyError):
    """Không để lỗi CSDL chưa bắt được làm request rơi thành lỗi proxy khó hiểu."""
    # Vi phạm ràng buộc là lỗi của yêu cầu, không phải máy chủ bận: xoá một
    # người còn đứng tên ở sáng kiến hay tài khoản thì báo "CSDL đang bận" khiến
    # người dùng thử đi thử lại mãi không ra — đã mất hai phiên mới tìm ra.
    if isinstance(exc, IntegrityError):
        return JSONResponse(
            status_code=409,
            content={"detail": "Không xoá/sửa được vì bản ghi này đang được nơi khác "
                               "tham chiếu tới (sáng kiến, tài khoản, bài viết…). "
                               "Gỡ liên kết ở đó trước rồi thử lại."},
        )
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

    # Máy mới clone repo về thì CSDL trắng trơn — nạp số liệu Dashboard đi kèm
    # mã nguồn (data/dong-bo). Phải chạy TRƯỚC các bước một-lần bên dưới: số
    # liệu trong tệp đã là kết quả sau khi chạy chúng, nên bước này đóng luôn
    # dấu mốc để chúng không chạy lại và dựng lại những dòng đã bỏ. Máy đã có
    # dữ liệu thì bước này tự bỏ qua, không đụng gì.
    def buoc_so_lieu_kem_ma_nguon():
        from .dongbo import nap_neu_trong
        print(nap_neu_trong())
    chay("Nạp số liệu kèm mã nguồn", buoc_so_lieu_kem_ma_nguon)

    # Nạp dữ liệu mẫu, chỉ chạy khi cơ sở dữ liệu còn trống.
    def buoc_seed():
        from .seed import seed_if_empty
        seed_if_empty()
    chay("Nạp dữ liệu mẫu", buoc_seed)

    # Nạp số liệu KPI báo cáo T8/2026 đúng một lần. Dấu mốc lưu trong cơ sở dữ
    # liệu để lần khởi động sau không ghi đè số quản trị viên đã tự sửa.
    def buoc_kpi_t8_2026():
        from .dashboard_kpi_2026_08 import apply_once
        apply_once()
    chay("Cập nhật KPI báo cáo T8/2026", buoc_kpi_t8_2026)

    # Chuẩn hoá tên trung tâm về mã viết tắt, chạy một lần sau khi đã có danh mục.
    def buoc_ma_trung_tam():
        from .center_codes import apply_once
        apply_once()
    chay("Chuẩn hoá mã trung tâm", buoc_ma_trung_tam)

    # Chuẩn hoá tên đơn vị trong bảng số liệu về VCC HCM / BDG / VTU.
    def buoc_ma_don_vi():
        from .province_codes import apply_once
        apply_once()
    chay("Chuẩn hoá mã đơn vị số liệu", buoc_ma_don_vi)

    # Nạp danh mục đầu việc/hạng mục tiến độ mảng kỹ thuật nếu bảng còn trống.
    def buoc_dau_viec():
        from .database import SessionLocal
        from .techtasks import ensure_seeded
        db = SessionLocal()
        try:
            ensure_seeded(db)
        finally:
            db.close()
    chay("Nạp danh mục đầu việc kỹ thuật", buoc_dau_viec)

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

def _lich_cong_tac(db: Session, ngay: dt.date):
    """Lịch công tác của đúng một ngày — dùng chung cho trang chủ (hôm nay) và
    khi người dùng bấm chuyển ngày để xem lịch ngày khác."""
    schedule = (
        db.query(models.Event)
        .filter(models.Event.kind == "work", func.date(models.Event.start_at) == ngay)
        .order_by(models.Event.start_at)
        .all()
    )

    from .sheets import get_data
    sheet_schedule = [
        {"time": r.get("gio", ""), "title": r.get("noi_dung", ""),
         "place": r.get("dia_diem", ""), "host": r.get("chu_tri", ""),
         "participants": r.get("thanh_phan", ""),
         "meeting_type": r.get("hinh_thuc", ""),
         "meeting_info": r.get("thong_tin_hop", "")}
        for r in get_data(db, "schedule", models)
        if r.get("ngay") == ngay.isoformat()
    ]

    return {
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
    }


def _lich_cong_tac_theo_quyen(db: Session, ngay: dt.date, user: "models.User | None"):
    """Che thông tin lịch họp (thành phần, hình thức, link/mã/mật khẩu Zoom...)
    với người chưa đăng nhập — chỉ tài khoản đã đăng nhập mới xem được lịch họp,
    tránh lộ link họp ra bên ngoài."""
    lich = _lich_cong_tac(db, ngay)
    if user is not None:
        return {**lich, "schedule_locked": False}
    return {"schedule": [], "schedule_from_sheet": lich["schedule_from_sheet"], "schedule_locked": True}


@app.get("/api/schedule-of-day", tags=["Trang chủ"])
def schedule_of_day(ngay: str, db: Session = Depends(get_db),
                     user: Optional[models.User] = Depends(current_user_optional)):
    """Lịch công tác của một ngày bất kỳ (dd dạng YYYY-MM-DD) — cho phép người
    dùng chuyển ngày trên khung "Lịch công tác" ở trang chủ. Chỉ trả nội dung
    đầy đủ cho tài khoản đã đăng nhập."""
    try:
        ngay_dt = dt.date.fromisoformat(ngay)
    except ValueError:
        raise HTTPException(400, "Ngày không hợp lệ, cần dạng YYYY-MM-DD.")
    return {"ngay": ngay_dt.isoformat(), **_lich_cong_tac_theo_quyen(db, ngay_dt, user)}


@app.get("/api/home", tags=["Trang chủ"])
def home(db: Session = Depends(get_db),
         user: Optional[models.User] = Depends(current_user_optional)):
    """Gom mọi thứ trang chủ cần vào một lần gọi, để trang mở nhanh."""
    today = models.today()
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
    lich_hom_nay = _lich_cong_tac_theo_quyen(db, today, user)

    from .sheets import get_data

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
        "schedule": lich_hom_nay["schedule"],
        "schedule_from_sheet": lich_hom_nay["schedule_from_sheet"],
        "schedule_locked": lich_hom_nay["schedule_locked"],
        "home_stats": home_stats,
        "home_stats_source": ("sheet" if get_data(db, "home_stats", models)
                              else ("database" if home_stats else "none")),
        "birthdays": [
            {"name": p.full_name, "dept": p.dept, "color": p.color,
             "day": p.birthday.strftime("%d/%m") if p.birthday else None}
            for p in birthdays
        ],
    }


def _so_lieu_moi_nhat(db: Session, board: str, label: str):
    """Lấy giá trị mới nhất của một chỉ tiêu trong bảng số liệu (chỉ tiêu chung,
    đúng một dòng mỗi kỳ)."""
    row = (
        db.query(models.Metric)
        .filter(models.Metric.board == board, models.Metric.label == label)
        .order_by(models.Metric.period.desc())
        .first()
    )
    return row.value if row else None


# Nhãn đơn vị dành cho dòng TỔNG toàn chi nhánh, nhập song song với các dòng
# theo tỉnh của cùng chỉ tiêu (Cell*h tổng, Số sự cố truyền dẫn, Ksub*min...).
DON_VI_TOAN_CHI_NHANH = province_codes.TOAN_CHI_NHANH


def _cong_duoc_theo_tinh(rows) -> bool:
    """Chỉ tiêu này cộng các tỉnh lại có ra số toàn chi nhánh không?

    Không phải chỉ tiêu nào cũng cộng được. Cell*h và số sự cố là phép cộng thật
    (T07/2026: 60,40 + 23,46 = 83,86 đúng bằng dòng tổng). Ksub*min thì không —
    nó là bình quân có trọng số theo thuê bao, cộng hai tỉnh của T01/2026 ra
    67,36 trong khi báo cáo ghi 40,36. Các chỉ tiêu %  (XLCS, TKM) lại càng không.

    Nên lấy chính những kỳ đã có đủ cả dòng tổng lẫn dòng tỉnh làm bằng chứng,
    thay vì đoán theo tên chỉ tiêu. Chưa có bằng chứng thì cho là cộng được, giữ
    nguyên nếp cũ với các chỉ tiêu đếm được vốn chỉ nhập theo tỉnh.
    """
    theo_ky = {}
    for r in rows:
        theo_ky.setdefault(r.period, []).append(r)
    for nhom in theo_ky.values():
        tong = [r for r in nhom if province_codes.la_toan_chi_nhanh(r.unit_name)]
        le = [r for r in nhom if (r.unit_name or "").strip()
              and not province_codes.la_toan_chi_nhanh(r.unit_name)]
        if not tong or not le:
            continue
        cong = sum(r.value or 0 for r in le)
        moc = sum(r.value or 0 for r in tong)
        if not moc or abs(cong - moc) / abs(moc) > 0.01:
            return False
    return True


def _gia_tri_toan_chi_nhanh(rows):
    """Dựng hàm tra "kỳ -> số của toàn chi nhánh" từ TẤT CẢ dòng của một chỉ tiêu.

    Một kỳ có thể có: dòng tổng đã ghi sẵn, dòng chung không kèm đơn vị (nếp cũ
    của các bảng tính chung toàn chi nhánh), hoặc chỉ có các dòng theo tỉnh. Cộng
    tuốt thì kỳ nào có nhiều kiểu dòng sẽ bị tính chồng — đây từng làm ô XLCS 3H
    ngoài trang chủ hiện 216,40% (cộng Bình Dương + Vũng Tàu + dòng chung).

    Trả None khi kỳ đó chỉ có số theo tỉnh mà chỉ tiêu lại không cộng được — thà
    thiếu số còn hơn hiện số sai.
    """
    theo_ky = {}
    for r in rows:
        theo_ky.setdefault(r.period, []).append(r)
    cong_duoc = _cong_duoc_theo_tinh(rows)

    def _cua_ky(ky):
        nhom = theo_ky.get(ky)
        if not nhom:
            return None
        tong = [r for r in nhom if province_codes.la_toan_chi_nhanh(r.unit_name)]
        if tong:
            return sum(r.value or 0 for r in tong)
        chung = [r for r in nhom if not (r.unit_name or "").strip()]
        if chung:
            return sum(r.value or 0 for r in chung)
        if len(nhom) == 1:
            return nhom[0].value
        return sum(r.value or 0 for r in nhom) if cong_duoc else None

    return _cua_ky


def _tong_ky_gan_nhat(db: Session, board: str, label: str):
    """Giá trị toàn chi nhánh của một chỉ tiêu tại kỳ gần nhất — dùng khi chỉ
    tiêu có nhiều dòng theo tỉnh/đơn vị trong cùng một kỳ (khác _so_lieu_moi_nhat,
    vốn chỉ đúng khi mỗi kỳ có đúng một dòng)."""
    rows = (
        db.query(models.Metric)
        .filter(models.Metric.board == board, models.Metric.label == label)
        .all()
    )
    if not rows:
        return None
    return _gia_tri_toan_chi_nhanh(rows)(max(r.period for r in rows))


def _so_viet(v, le=0):
    """Định dạng số theo cách viết Việt Nam: 1.284 và 94,2."""
    if v is None:
        return None
    s = f"{v:,.{le}f}"
    return s.replace(",", "\u0000").replace(".", ",").replace("\u0000", ".")


def _ky_hien_thi(ky):
    """"2026-06" -> "T06/2026"."""
    try:
        nam, thang = ky.split("-")
        return f"T{thang}/{nam}"
    except (ValueError, AttributeError):
        return ky


def _chi_so_home(db: Session, board: str, chi_tieu: str, huong_tot: str = "thap"):
    """
    Một chỉ số trang chủ đầy đủ: giá trị + kỳ mới nhất (cộng dồn nếu chỉ tiêu
    có nhiều dòng theo tỉnh/đơn vị cùng kỳ), có đạt target hay không (đối
    chiếu bảng "{board}_TARGET" cùng chỉ tiêu, cùng kỳ) và so với cùng kỳ năm
    trước là cải thiện hay suy giảm — dùng chung đúng quy ước huong_tot
    ("thap"/"cao" càng tốt) đã áp dụng cho bảng đối chiếu chỉ tiêu ở Dashboard.
    """
    rows = (
        db.query(models.Metric)
        .filter(models.Metric.board == board, models.Metric.label == chi_tieu)
        .all()
    )
    if not rows:
        return None
    tra = _gia_tri_toan_chi_nhanh(rows)
    # Kỳ mới nhất có thể chưa có số ở mức toàn chi nhánh (mới nhập theo tỉnh, mà
    # chỉ tiêu lại không cộng được). Lùi dần về kỳ gần nhất còn số dùng được, để
    # ô chỉ số vẫn hiện chứ không biến mất.
    ky = gia_tri = None
    for k in sorted({r.period for r in rows}, reverse=True):
        gia_tri = tra(k)
        if gia_tri is not None:
            ky = k
            break
    if ky is None:
        return None

    target_rows = (
        db.query(models.Metric)
        .filter(models.Metric.board == f"{board}_TARGET", models.Metric.label == chi_tieu)
        .all()
    )
    target = _gia_tri_toan_chi_nhanh(target_rows)(ky) if target_rows else None
    so_target = ((gia_tri - target) / target * 100) if target else None
    dat = None if so_target is None else (so_target <= 0 if huong_tot == "thap" else so_target >= 0)

    ky_truoc = _ky_cung_ky_truoc(ky)
    cung_ky_gt = tra(ky_truoc) if ky_truoc else None
    chenh_ck = ((gia_tri - cung_ky_gt) / cung_ky_gt * 100) if cung_ky_gt else None
    cai_thien = None if chenh_ck is None else (chenh_ck <= 0 if huong_tot == "thap" else chenh_ck >= 0)

    return {"gia_tri": gia_tri, "ky": ky, "target": target, "dat": dat, "cai_thien": cai_thien}


def tinh_chi_so_trang_chu(db: Session):
    """
    Dựng sáu ô chỉ số trang chủ từ bảng số liệu trong cơ sở dữ liệu — lấy đúng
    tên chỉ tiêu thật đang dùng ở các tab Dashboard (không còn tham chiếu nhãn
    "Kế hoạch/Thực hiện", "Được giao/Hoàn thành"... kiểu cũ, đã bị dọn khỏi CSDL
    khi các tab đổi sang số liệu thật).

    Dùng khi chưa nối Google Sheet. Chỉ tiêu nào không có số thì bỏ qua ô đó,
    không bịa số. Không có ô nào thì trả về danh sách rỗng, giao diện sẽ hiện
    số liệu mẫu kèm ghi chú rõ ràng.
    """
    out = []

    def _them(ma, nhan, board, chi_tieu, don_vi, mau, huong_tot="thap", le=2):
        kq = _chi_so_home(db, board, chi_tieu, huong_tot)
        if kq is None:
            return
        out.append({
            "ma": ma, "nhan": nhan,
            "gia_tri": _so_viet(kq["gia_tri"], le), "don_vi": don_vi, "mau": mau,
            "ky": kq["ky"], "ky_nhan": _ky_hien_thi(kq["ky"]),
            "dat": kq["dat"], "cai_thien": kq["cai_thien"],
        })

    # Doanh thu: chưa có nguồn số liệu — nhập bảng KPI, chỉ tiêu "Doanh thu kế
    # hoạch" / "Doanh thu thực hiện" (Quản trị → Quản lý dashboard) thì ô này
    # tự xuất hiện, không cần sửa code thêm.
    dt_kh = _so_lieu_moi_nhat(db, "KPI", "Doanh thu kế hoạch")
    dt_th = _so_lieu_moi_nhat(db, "KPI", "Doanh thu thực hiện")
    if dt_kh and dt_th is not None:
        ty = round(dt_th / dt_kh * 100, 1)
        out.append({
            "ma": "kpi", "nhan": "HOÀN THÀNH DOANH THU THÁNG",
            "gia_tri": _so_viet(ty, 1), "don_vi": "%",
            "muc_tieu": "Mục tiêu: 100%", "mau": "green", "tien_do": min(ty, 100),
        })

    _them("wo_dung_han", "TỶ LỆ PHẠT/DOANH THU", "KPI", "Tiền phạt/Doanh thu", "%", "orange")

    nhom_phat = _nhom_phat_vtt_vtnet(db)
    if nhom_phat and nhom_phat["xu_huong"]:
        ky_gan_nhat = nhom_phat["xu_huong"][-1]
        tong_phat = round((ky_gan_nhat.get("VTT") or 0) + (ky_gan_nhat.get("VTNet") or 0), 1)
        out.append({
            "ma": "tien_phat", "nhan": "TIỀN PHẠT THÁNG",
            "gia_tri": _so_viet(tong_phat), "don_vi": "triệu đ",
            "muc_tieu": "Tổng VTT + VTNet", "mau": "blue",
            "ky_nhan": _ky_hien_thi(ky_gan_nhat["name"]),
        })

    # Thứ tự các ô còn lại theo đúng yêu cầu: Cell*h tổng, Sự cố truyền dẫn,
    # Ksub*min, Rời mạng CĐBR, rồi XLCS 3h/10h/24h, rồi TKM 3h/10h/24h.
    _them("cell_h_tong", "CELL*H TỔNG", "OUTPUT", "Cell*h tổng", "", "purple", le=1)
    _them("su_co_ngay", "SỰ CỐ TRUYỀN DẪN", "PAKH", "Số sự cố truyền dẫn", "", "purple", le=0)
    _them("ksub_min", "KSUB*MIN", "FUEL", "Ksub*min", "", "orange", le=1)
    _them("wo_qua_han", "KH RỜI MẠNG CĐBR", "WO_TINH", "Số lượng KH rời mạng", "", "orange", le=0)
    _them("xlcs_3h", "XLCS 3H", "NETWORK", "XLCS 3h", "%", "teal", huong_tot="cao")
    _them("xlcs_10h", "XLCS 10H", "NETWORK", "XLCS 10h", "%", "teal", huong_tot="cao")
    _them("an_toan", "XLCS 24H", "NETWORK", "XLCS 24h", "%", "teal", huong_tot="cao")
    _them("kpi_tkm_3h", "KPI TKM 3H", "VHKT", "KPI TKM 3H", "%", "blue", huong_tot="cao")
    _them("kpi_tkm_10h", "KPI TKM 10H", "VHKT", "KPI TKM 10H", "%", "blue", huong_tot="cao")
    _them("kpi_tkm_24h", "KPI TKM 24H", "VHKT", "KPI TKM 24H", "%", "blue", huong_tot="cao")

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


def _bu_dong_tong_chi_nhanh(rows):
    """Bù dòng tổng chi nhánh cho những kỳ mới chỉ có số theo tỉnh.

    Báo cáo nguồn có dòng tổng (VCC HCM) nhưng chỉ từ 2026 trở đi, trong khi các
    kỳ 2025 vẫn thuần số theo tỉnh. Thiếu dòng tổng của năm trước thì chính dòng
    tổng năm nay không tra được "cùng kỳ năm trước", nên bảng đối chiếu bỏ trống
    đúng cái dòng người đọc quan tâm nhất.

    Cộng hai tỉnh lại để bù — nhưng chỉ với chỉ tiêu thật sự cộng được (xem
    _cong_duoc_theo_tinh) và chỉ với chỉ tiêu vốn đã có dòng tổng, để không tự
    dựng mức tổng cho bảng rời mạng theo huyện. Các dòng theo tỉnh vẫn giữ
    nguyên: người đọc cần thấy cả hai mức.
    """
    labels_tong = {r["chi_tieu"] for r in rows
                   if province_codes.la_toan_chi_nhanh(r.get("don_vi"))}
    if not labels_tong:
        return rows

    them = []
    for label in labels_tong:
        cua_label = [r for r in rows if r["chi_tieu"] == label]
        if not _cong_duoc_theo_tinh([_NhuMetric(r) for r in cua_label]):
            continue
        theo_ky = {}
        for r in cua_label:
            theo_ky.setdefault(r["ky"], []).append(r)
        for ky, nhom in theo_ky.items():
            if any(province_codes.la_toan_chi_nhanh(r.get("don_vi")) for r in nhom):
                continue
            gia_tri = [r.get("gia_tri") for r in nhom
                       if r.get("gia_tri") is not None and r.get("don_vi")]
            if gia_tri:
                them.append({"ky": ky, "chi_tieu": label,
                             "don_vi": DON_VI_TOAN_CHI_NHANH, "gia_tri": sum(gia_tri)})
    return rows + them


class _NhuMetric:
    """Bọc dict đã làm phẳng cho giống bản ghi Metric, để _cong_duoc_theo_tinh
    dùng chung được cho cả hai đường dữ liệu."""

    __slots__ = ("period", "unit_name", "value")

    def __init__(self, r):
        self.period = r["ky"]
        self.unit_name = r.get("don_vi")
        self.value = r.get("gia_tri")


_khoa_don_vi = province_codes.khoa_sap_xep


def _sap_xep_doi_chieu(compare):
    """Kỳ mới nhất trước, trong mỗi kỳ thì theo chỉ tiêu rồi đến thứ tự đơn vị.

    Sắp hai lượt vì Python sắp xếp ổn định: lượt sau giữ nguyên thứ tự lượt
    trước với các dòng bằng nhau, nên không cần nghĩ cách đảo chiều chuỗi kỳ.
    """
    ra = sorted(compare, key=lambda r: ((r["chi_tieu"] or ""), _khoa_don_vi(r["don_vi"])))
    ra.sort(key=lambda r: r["ky"] or "", reverse=True)
    return ra


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
    và cơ cấu nguyên nhân phạt theo TỪNG kỳ + luỹ kế 6 tháng gần nhất của mỗi
    nhóm — dùng cho biểu đồ xu thế 2 đường và 2 biểu đồ tròn (có bộ lọc theo
    tháng/luỹ kế) trên tab Tiền phạt & Doanh thu.
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

    def _co_cau_theo_ky(rows):
        theo_ky: dict = {}
        for r in rows:
            if not r["gia_tri"]:
                continue
            nhom = theo_ky.setdefault(r["ky"], {})
            nhom[r["chi_tieu"]] = nhom.get(r["chi_tieu"], 0) + r["gia_tri"]
        ky_list = sorted(theo_ky)
        theo_ky_out = {k: [{"name": n, "value": v} for n, v in theo_ky[k].items()] for k in ky_list}
        # Luỹ kế 6 kỳ gần nhất — cộng dồn theo đúng nguyên nhân (chi_tieu)
        luy_ke: dict = {}
        for k in ky_list[-6:]:
            for n, v in theo_ky[k].items():
                luy_ke[n] = luy_ke.get(n, 0) + v
        return {
            "theo_ky": theo_ky_out,
            "ky_list": ky_list,
            "luy_ke_6_thang": [{"name": n, "value": v} for n, v in luy_ke.items()],
        }

    return {
        "xu_huong": xu_huong,
        "vtt": _co_cau_theo_ky(vtt_rows),
        "vtnet": _co_cau_theo_ky(vtnet_rows),
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
        "huyen": (_theo_huyen(huyen_bd_rows, province_codes.BINH_DUONG)
                  + _theo_huyen(huyen_brvt_rows, province_codes.VUNG_TAU)),
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
    rows = _bu_dong_tong_chi_nhanh(rows)
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
    target_rows = _bu_dong_tong_chi_nhanh(target_rows)
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
    # chỉ tiêu (Cell*h, SCTD, TKM, XLCS...) càng thấp càng tốt, vượt target là chưa đạt.
    canh_bao_trung_tam = []
    if board == "VHKT" and compare:
        ky_moi_nhat = max(r["ky"] for r in compare if r["ky"])
        theo_trung_tam: dict = {}
        for r in compare:
            if r["ky"] != ky_moi_nhat or not r["don_vi"] or r["target"] is None:
                continue
            # KPI TKM là loại "càng cao càng tốt" (xem huong_tot="cao" của các ô
            # trang chủ), nên chưa đạt là khi THẤP HƠN chỉ tiêu. Trước đây so
            # ngược dấu, nhưng bảng VHKT chưa có dòng nào theo đơn vị nên danh
            # sách luôn rỗng và lỗi không lộ ra.
            if r["thuc_hien"] is not None and r["thuc_hien"] < r["target"]:
                theo_trung_tam.setdefault(r["don_vi"], []).append(r["chi_tieu"])
        canh_bao_trung_tam = [
            {"trung_tam": tt, "chi_tieu_khong_dat": chi_tieu_list, "ky": ky_moi_nhat}
            for tt, chi_tieu_list in sorted(theo_trung_tam.items())
        ]

    return {
        "board": board,
        "series": sorted(buckets.values(), key=lambda b: _khoa_don_vi(b["name"])),
        "source": nguon,
        "compare": _sap_xep_doi_chieu(compare),
        "canh_bao_trung_tam": canh_bao_trung_tam,
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
def public_events(kind: str = "culture", db: Session = Depends(get_db),
                   user: Optional[models.User] = Depends(current_user_optional)):
    """Sự kiện góc văn hoá — công khai. Lịch công tác (kind="work") chứa thông
    tin họp/Zoom nên chỉ trả cho tài khoản đã đăng nhập, chặn việc dùng
    ?kind=work để lách qua khoá đã áp dụng ở /api/home, /api/schedule-of-day."""
    if kind == "work" and user is None:
        return []
    rows = (db.query(models.Event).filter(models.Event.kind == kind)
            .order_by(models.Event.start_at).all())
    return [{"id": e.id, "title": e.title, "start_at": e.start_at,
             "place": e.place, "host": e.host,
             "participants": e.participants,
             "meeting_type": e.meeting_type or "truc_tiep",
             "meeting_info": e.meeting_info,
             "meeting_id": e.meeting_id,
             "meeting_pass": e.meeting_pass} for e in rows]


@app.get("/api/centers", tags=["Hệ thống"])
def public_centers(db: Session = Depends(get_db)):
    """Danh mục trung tâm: mã viết tắt + tên đầy đủ.

    Dữ liệu lưu theo mã (THA, CHP...) cho gọn và để đối chiếu được giữa các phân
    hệ; giao diện dùng danh mục này hiển thị "THA — Thới Hòa" cho người đọc.
    """
    rows = (db.query(models.InfraCenterCode)
            .order_by(models.InfraCenterCode.code).all())
    return [{"code": c.code, "name": c.name,
             "short": c.name.replace("Trung tâm", "").strip(" -") or c.name}
            for c in rows]


@app.get("/api/birthdays", tags=["Góc văn hoá"])
def public_birthdays(month: Optional[int] = None, db: Session = Depends(get_db)):
    m = month or models.today().month
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
        "time": models.now().isoformat(),
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
        return {"status": "ready", "database": "ok", "time": models.now().isoformat()}
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
