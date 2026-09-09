"""
Mô hình dữ liệu của Cổng thông tin nội bộ.
Mỗi class ở đây tương ứng với một bảng trong PostgreSQL.
"""
import datetime as dt

from sqlalchemy import (
    Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String, Text,
)
from sqlalchemy.orm import relationship

from .database import Base


# Việt Nam dùng một múi giờ cố định UTC+7, không có giờ mùa hè — nên lấy giờ
# theo lệch cố định là đủ, không cần cơ sở dữ liệu múi giờ (tzdata) vốn có thể
# thiếu trên ảnh Docker rút gọn.
VN_TZ = dt.timezone(dt.timedelta(hours=7))


def now():
    """
    Giờ hiện tại theo múi giờ Việt Nam, dạng "naive" (không kèm tzinfo).

    Máy chủ triển khai (container) thường chạy hệ thống theo giờ UTC, nên nếu
    lấy giờ hệ thống trực tiếp thì mọi dấu thời gian lưu trong CSDL (nhật ký
    hệ thống, ngày tạo bản tin, hạn xử lý sự cố...) sẽ lệch 7 tiếng so với
    thực tế. Cố ý trả về "naive" (không tzinfo) để khớp với kiểu cột DateTime
    hiện có và cách trình duyệt tự hiểu chuỗi ISO không hậu tố "Z" là giờ địa
    phương — nhờ vậy không cần sửa gì ở phía giao diện.
    """
    return dt.datetime.now(VN_TZ).replace(tzinfo=None)


def today():
    """Ngày hôm nay theo giờ Việt Nam — dùng thay cho dt.date.today() (giờ hệ
    thống, thường là UTC) ở mọi chỗ cần "hôm nay" đúng nghĩa nghiệp vụ (lịch
    công tác hôm nay, sinh nhật trong tháng, mã tự sinh theo ngày...). Khác
    biệt lộ rõ nhất vào khung 00:00–07:00 giờ Việt Nam, khi giờ UTC vẫn còn ở
    NGÀY HÔM TRƯỚC."""
    return now().date()


class User(Base):
    """Tài khoản đăng nhập. Mật khẩu luôn lưu dạng băm, không lưu bản rõ."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String(80), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(120), nullable=False)
    role = Column(String(40), default="staff")          # staff | editor | admin
    # Danh sách module được phép, lưu dạng JSON, ví dụ ["news","documents"].
    # NULL nghĩa là dùng bộ quyền mặc định theo role (xem permissions.py).
    permissions = Column(Text, nullable=True)
    person_id = Column(Integer, ForeignKey("people.id"), nullable=True)
    created_at = Column(DateTime, default=now)
    # True cho tài khoản mới tạo hoặc vừa bị đặt lại mật khẩu — buộc người dùng
    # tự đặt mật khẩu riêng trước khi được dùng các chức năng khác.
    must_change_password = Column(Boolean, default=True)

    person = relationship("Person", back_populates="user")


class Person(Base):
    """Danh bạ nội bộ."""
    __tablename__ = "people"

    id = Column(Integer, primary_key=True)
    full_name = Column(String(120), nullable=False, index=True)
    role = Column(String(120))                           # chức vụ
    dept = Column(String(120), index=True)               # phòng ban
    phone = Column(String(40))
    email = Column(String(120))
    photo_url = Column(String(300))
    birthday = Column(Date, nullable=True)
    color = Column(String(10), default="#EA0A2A")        # màu nền avatar khi chưa có ảnh
    active = Column(Boolean, default=True)

    user = relationship("User", back_populates="person", uselist=False)


class Notice(Base):
    """Thông báo khẩn hiện trên đầu trang chủ."""
    __tablename__ = "notices"

    id = Column(Integer, primary_key=True)
    content = Column(Text, nullable=False)
    level = Column(String(20), default="urgent")         # urgent | info
    active = Column(Boolean, default=True)
    starts_at = Column(DateTime, default=now)
    ends_at = Column(DateTime, nullable=True)


class News(Base):
    """Tin tức, bài truyền thông nội bộ."""
    __tablename__ = "news"

    id = Column(Integer, primary_key=True)
    title = Column(String(300), nullable=False, index=True)
    excerpt = Column(Text)
    body = Column(Text)
    category = Column(String(60), index=True)            # Hoạt động, Phong trào, Gương điển hình...
    tag = Column(String(60))
    author = Column(String(120))
    cover_url = Column(String(500))       # ảnh đại diện bản tin
    gallery = Column(Text)                # danh sách ảnh đính kèm, lưu dạng JSON
    featured = Column(Boolean, default=False)   # tin nổi bật
    pinned = Column(Boolean, default=False)     # ghim lên trang chủ
    visible = Column(Boolean, default=True)     # trạng thái hiển thị
    published_at = Column(DateTime, default=now)

    # Thùng rác: khác NULL nghĩa là đã xoá mềm, chờ quản trị duyệt xoá hẳn
    # hoặc tự động xoá hẳn sau 30 ngày (xem trash.py).
    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(String(120), nullable=True)


class Document(Base):
    """Kho tài liệu: quy trình, hướng dẫn, biểu mẫu, văn bản."""
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True)
    title = Column(String(300), nullable=False, index=True)
    code = Column(String(60))                            # số hiệu văn bản
    category = Column(String(60), index=True)
    file_url = Column(String(500))                       # link Google Drive hoặc đường dẫn nội bộ
    size_label = Column(String(30))
    content_text = Column(Text)                          # dùng cho tìm kiếm toàn văn
    updated_on = Column(Date, default=dt.date.today)
    downloads = Column(Integer, default=0)

    # Thùng rác: khác NULL nghĩa là đã xoá mềm, chờ quản trị duyệt xoá hẳn
    # hoặc tự động xoá hẳn sau 30 ngày (xem trash.py).
    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(String(120), nullable=True)


class AppLink(Base):
    """Trung tâm ứng dụng: đường dẫn tới phần mềm dùng hằng ngày."""
    __tablename__ = "app_links"

    id = Column(Integer, primary_key=True)
    name = Column(String(80), nullable=False)
    description = Column(String(300))
    url = Column(String(500))
    category = Column(String(60))                        # Vận hành | Điều hành | Văn phòng | Chi nhánh
    color = Column(String(10), default="#EA0A2A")
    icon_url = Column(String(300))
    order_no = Column(Integer, default=0)


class Metric(Base):
    """
    Bảng số liệu chung cho Dashboard.
    Một dòng = một điểm dữ liệu, ví dụ: board='WO', period='2026-07',
    label='Hoàn thành', value=1284.
    """
    __tablename__ = "metrics"

    id = Column(Integer, primary_key=True)
    board = Column(String(40), index=True)               # KPI | WO | PAKH | FUEL | HIRE | OUTPUT | NETWORK
    period = Column(String(20), index=True)              # 2026-07 hoặc 2026-08-05
    label = Column(String(80))                           # Kế hoạch | Thực hiện | Định mức...
    unit_name = Column(String(80))                       # tên đơn vị/đội (nếu có)
    value = Column(Float, nullable=False)


class Idea(Base):
    """Góc sáng kiến."""
    __tablename__ = "ideas"

    id = Column(Integer, primary_key=True)
    title = Column(String(300), nullable=False)
    body = Column(Text)
    benefit = Column(String(300))                        # lợi ích ước tính
    author_id = Column(Integer, ForeignKey("people.id"))
    dept = Column(String(120))
    status = Column(String(40), default="Chờ duyệt")     # Chờ duyệt | Đang triển khai | Đã áp dụng
    votes = Column(Integer, default=0)
    created_at = Column(DateTime, default=now)

    author = relationship("Person")


class IdeaVote(Base):
    """Mỗi người chỉ bình chọn một lần cho một sáng kiến."""
    __tablename__ = "idea_votes"

    id = Column(Integer, primary_key=True)
    idea_id = Column(Integer, ForeignKey("ideas.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)


class Channel(Base):
    """Kênh trao đổi theo phòng ban / chủ đề."""
    __tablename__ = "channels"

    id = Column(Integer, primary_key=True)
    slug = Column(String(40), unique=True, nullable=False)
    name = Column(String(120), nullable=False)
    description = Column(String(300))


class Thread(Base):
    """Chủ đề thảo luận. Phải được quản trị viên duyệt mới hiển thị công khai."""
    __tablename__ = "threads"

    id = Column(Integer, primary_key=True)
    channel_id = Column(Integer, ForeignKey("channels.id"), nullable=False)
    title = Column(Text, nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"))
    author_name = Column(String(120))
    tag = Column(String(60))
    # Mặc định "approved" — áp dụng khi thêm cột này vào CSDL đã có dữ liệu cũ
    # (nội dung cũ vẫn hiển thị bình thường). Bài MỚI luôn được code đặt rõ
    # "pending" khi tạo, xem create_thread() trong main.py.
    status = Column(String(20), default="approved", index=True)   # pending | approved
    created_at = Column(DateTime, default=now)

    channel = relationship("Channel")
    replies = relationship("Reply", back_populates="thread", cascade="all, delete-orphan")


class Reply(Base):
    """Trả lời trong chủ đề. Phải được quản trị viên duyệt mới hiển thị công khai."""
    __tablename__ = "replies"

    id = Column(Integer, primary_key=True)
    thread_id = Column(Integer, ForeignKey("threads.id"), nullable=False)
    body = Column(Text, nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"))
    author_name = Column(String(120))
    # Mặc định "approved" — áp dụng khi thêm cột này vào CSDL đã có dữ liệu cũ
    # (nội dung cũ vẫn hiển thị bình thường). Trả lời MỚI luôn được code đặt rõ
    # "pending" khi tạo, xem add_reply() trong main.py.
    status = Column(String(20), default="approved", index=True)   # pending | approved
    created_at = Column(DateTime, default=now)

    thread = relationship("Thread", back_populates="replies")


class Event(Base):
    """Lịch công tác và sự kiện văn hoá."""
    __tablename__ = "events"

    id = Column(Integer, primary_key=True)
    title = Column(String(300), nullable=False)
    start_at = Column(DateTime, nullable=False)
    place = Column(String(200))
    host = Column(String(200))
    kind = Column(String(30), default="work")            # work | culture

    # Thành phần tham gia: ghi tự do, ví dụ "Ban Giám đốc, Trưởng các phòng"
    participants = Column(Text)

    # Hình thức họp:
    #   truc_tiep   — họp trực tiếp tại phòng họp
    #   cau_truyen_hinh — qua cầu truyền hình, cần địa chỉ IP điểm cầu
    #   zoom / google_meet / teams — họp trực tuyến, cần đường dẫn phòng họp
    meeting_type = Column(String(30), default="truc_tiep")

    # Thông tin kết nối: địa chỉ IP điểm cầu, hoặc đường dẫn phòng họp trực tuyến
    meeting_info = Column(String(500))

    # Mã và mật khẩu phòng họp trực tuyến, nếu có
    meeting_id = Column(String(120))
    meeting_pass = Column(String(80))


class Banner(Base):
    """Ảnh băng-rôn hiển thị trên trang chủ."""
    __tablename__ = "banners"

    id = Column(Integer, primary_key=True)
    title = Column(String(200), nullable=False)
    image_url = Column(String(500))
    link_url = Column(String(500))
    color = Column(String(10), default="#EA0A2A")   # màu nền khi chưa có ảnh
    order_no = Column(Integer, default=0)
    active = Column(Boolean, default=True)


class SiteConfig(Base):
    """
    Cấu hình chung của website, lưu theo cặp khoá - giá trị.
    Ví dụ: site_title, director_name, director_message, hotline.
    """
    __tablename__ = "site_config"

    id = Column(Integer, primary_key=True)
    key = Column(String(60), unique=True, nullable=False, index=True)
    value = Column(Text)
    label = Column(String(200))      # tên hiển thị trong màn hình quản trị
    kind = Column(String(20), default="text")   # text | textarea | color


class SheetSource(Base):
    """
    Nguồn dữ liệu lấy từ Google Sheet đã đăng lên web dạng CSV.

    Mỗi loại (kind) chỉ nên có một nguồn đang bật:
      home_stats — sáu ô chỉ số trang chủ
      dashboard  — số liệu các bảng điều khiển
      schedule   — lịch công tác theo tuần
    """
    __tablename__ = "sheet_sources"

    id = Column(Integer, primary_key=True)
    kind = Column(String(30), nullable=False, index=True)
    name = Column(String(200))
    csv_url = Column(String(1000))
    active = Column(Boolean, default=True)

    cache = Column(Text)                       # dữ liệu đã đọc, lưu dạng JSON
    row_count = Column(Integer, default=0)
    last_sync_at = Column(DateTime, nullable=True)
    last_status = Column(String(20), default="")   # ok | error
    last_error = Column(Text, default="")


class Upload(Base):
    """Tệp ảnh do người dùng tải lên từ màn hình quản trị."""
    __tablename__ = "uploads"

    id = Column(Integer, primary_key=True)
    filename = Column(String(300), nullable=False)
    original_name = Column(String(300))
    content_type = Column(String(80))
    size_bytes = Column(Integer, default=0)
    uploaded_by = Column(String(120))
    created_at = Column(DateTime, default=now)


class AuditLog(Base):
    """
    Nhật ký thao tác của toàn hệ thống: đăng nhập, thêm/sửa/xoá, cấu hình...

    Chỉ ghi lại các hành động có tác động (không ghi các lượt xem/đọc dữ liệu),
    để nhật ký gọn và dễ tra cứu khi cần truy vết.
    """
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True)
    created_at = Column(DateTime, default=now, index=True)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    username = Column(String(80), index=True)
    full_name = Column(String(120))
    role = Column(String(40))

    # login | login_failed | logout | create | update | delete | config | sync | import
    action = Column(String(30), index=True)
    # auth | news | notices | banners | apps | documents | people | events |
    # media | sheets | import | uploads | users | config
    module = Column(String(40), index=True)

    target_id = Column(String(40))
    target_label = Column(String(300))
    detail = Column(Text)
    ip_address = Column(String(64))


class MediaItem(Base):
    """
    Album ảnh và video của đơn vị.

    kind = "image": url trỏ tới ảnh, hiện phóng to ngay trên trang.
    kind = "video": url trỏ tới video (YouTube, Drive, tệp mp4), bấm mở tab mới.
    """
    __tablename__ = "media_items"

    id = Column(Integer, primary_key=True)
    title = Column(String(300), nullable=False)
    kind = Column(String(20), default="image")      # image | video
    url = Column(String(500))
    thumb_url = Column(String(500))                 # ảnh đại diện, dùng cho video
    author = Column(String(160))                    # đơn vị hoặc người chụp
    album = Column(String(120))                     # gom nhóm theo sự kiện
    color = Column(String(10), default="#C8102E")   # màu nền khi chưa có ảnh
    order_no = Column(Integer, default=0)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=now)


# ======================================== Điều hành kỹ thuật / hiện trường

class Incident(Base):
    """Sự cố kỹ thuật theo từng vụ việc, độc lập với các số KPI tổng hợp."""
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True)
    code = Column(String(40), unique=True, nullable=False, index=True)
    title = Column(String(300), nullable=False)
    site = Column(String(160), index=True)
    severity = Column(String(20), default="medium")       # critical | high | medium | low
    status = Column(String(30), default="open")           # open | processing | resolved | closed
    assignee = Column(String(120))
    description = Column(Text)
    resolution = Column(Text)
    reported_at = Column(DateTime, default=now)
    due_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)


class WorkOrder(Base):
    """WO chi tiết: theo dõi vòng đời, hạn xử lý và kết quả nghiệm thu."""
    __tablename__ = "work_orders"

    id = Column(Integer, primary_key=True)
    code = Column(String(40), unique=True, nullable=False, index=True)
    title = Column(String(300), nullable=False)
    category = Column(String(100))
    location = Column(String(160), index=True)
    priority = Column(String(20), default="normal")
    status = Column(String(30), default="new")            # new | assigned | processing | done | overdue
    assignee = Column(String(120))
    description = Column(Text)
    result = Column(Text)
    created_at = Column(DateTime, default=now)
    due_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)


class ShiftHandover(Base):
    """Nhật ký giao nhận ca: việc tồn, rủi ro và xác nhận tiếp nhận."""
    __tablename__ = "shift_handovers"

    id = Column(Integer, primary_key=True)
    shift_date = Column(Date, nullable=False, index=True)
    shift_name = Column(String(40), default="Ca ngày")
    outgoing = Column(String(120), nullable=False)
    incoming = Column(String(120))
    summary = Column(Text, nullable=False)
    open_items = Column(Text)
    risks = Column(Text)
    confirmed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=now)


class DutySchedule(Base):
    """Lịch trực kỹ thuật, xe, chỉ huy và trực ban Phòng VHKT."""
    __tablename__ = "duty_schedules"

    id = Column(Integer, primary_key=True)
    duty_date = Column(Date, nullable=False, index=True)
    duty_type = Column(String(30), nullable=False, index=True)  # technical | vehicle | command | office
    shift_name = Column(String(40), default="Cả ngày")
    person_name = Column(String(120), nullable=False)
    phone = Column(String(40))
    backup_name = Column(String(120))
    note = Column(Text)


class DutyRosterShift(Base):
    """
    Lịch trực toàn chi nhánh theo tháng — đội xe, chỉ huy, PVHKT và từng trung
    tâm, nhập theo đợt từ file Excel "Tổng hợp" (mỗi dòng: một người, một ngày).

    Nhập lại cho cùng khoảng ngày sẽ thay thế dữ liệu cũ của đúng khoảng đó,
    dữ liệu tháng khác vẫn giữ nguyên để tra cứu lại khi cần.
    """
    __tablename__ = "duty_roster_shifts"

    id = Column(Integer, primary_key=True)
    block = Column(String(120), nullable=False, index=True)   # "PVHKT" | "Lái xe" | "Chỉ Huy" | tên trung tâm
    duty_date = Column(Date, nullable=False, index=True)
    employee_code = Column(String(40))
    person_name = Column(String(120), nullable=False)
    phone = Column(String(40))
    group_name = Column(String(120))
    title = Column(String(160))
    shift_code = Column(String(10))            # TB | CH | LX | KT | rỗng (không trực hôm đó)
    event = Column(String(300))                # hỗ trợ đột xuất, nếu có
    location = Column(String(200))
    created_at = Column(DateTime, default=now)


class Candidate(Base):
    """Ứng viên tuyển dụng — nhân viên giới thiệu hoặc bộ phận nhân sự nhập vào."""
    __tablename__ = "candidates"

    id = Column(Integer, primary_key=True)
    full_name = Column(String(120), nullable=False)
    position = Column(String(120), nullable=False)          # vị trí ứng tuyển
    position_type = Column(String(10))                      # OFT | FT
    desired_location = Column(String(120))                  # khu vực mong muốn làm việc
    birth_year = Column(Integer, nullable=True)
    education_level = Column(String(80))                    # trình độ
    major = Column(String(160))                              # chuyên môn
    referrer = Column(String(120))                           # người giới thiệu
    status = Column(String(20), default="new", index=True)   # new|reviewing|interview|negotiating|hired|probation|left|rejected
    note = Column(Text)
    created_at = Column(DateTime, default=now, index=True)


class CenterStaffing(Base):
    """
    Báo cáo nhanh định biên thiếu và hoạt động tuyển dụng theo từng trung tâm.
    Mỗi dòng là một lần chốt số liệu (report_date) cho một trung tâm — trung tâm
    có thể được cập nhật nhiều lần, số mới nhất theo report_date là số hiện hành.
    """
    __tablename__ = "center_staffing"

    id = Column(Integer, primary_key=True)
    report_date = Column(Date, nullable=False, index=True)
    center = Column(String(120), nullable=False, index=True)
    oft_gap = Column(Integer, default=0)                  # thiếu OFT
    ft_gap = Column(Integer, default=0)                   # thiếu FT
    applications_received = Column(Integer, default=0)    # hồ sơ nhận trong tháng
    posted_channels = Column(Integer, default=0)          # đã đăng Zalo/FB/Hội nhóm (luỹ kế)
    school_contacts = Column(Integer, default=0)          # tiếp xúc trường/BCHQS (luỹ kế)
    banners_posted = Column(Integer, default=0)           # dán băng rôn tuyển dụng (luỹ kế)
    banner_location = Column(String(200))                 # vị trí treo băng rôn
    note = Column(Text)
    created_at = Column(DateTime, default=now)


class TechTask(Base):
    """Công việc giao trong 10 đầu việc mảng kỹ thuật (Tuyển dụng, WO, 5G...)."""
    __tablename__ = "tech_tasks"

    id = Column(Integer, primary_key=True)
    category = Column(String(40), nullable=False, index=True)   # mã đầu việc, xem CATEGORIES
    title = Column(String(300), nullable=False)
    description = Column(Text)
    assignee = Column(String(160))          # Tổ trưởng/Đội trưởng/FT phụ trách — nhập tự do
    target = Column(String(300))            # mục tiêu/chỉ tiêu, vd "Line/NS < 1350"
    due_at = Column(Date, nullable=True)
    status = Column(String(20), default="todo", index=True)  # todo|doing|done|overdue
    link_url = Column(String(500))          # tool ngoài liên quan, vd manage-wo.pages.dev
    note = Column(Text)                     # ghi chú tiến độ
    created_at = Column(DateTime, default=now)
    updated_at = Column(DateTime, default=now, onupdate=now)


class InfraCenterCode(Base):
    """Tra Mã cụm ↔ Tên trung tâm — nhập từ sheet "DM Mã cụm" của CSDL hạ tầng."""
    __tablename__ = "infra_center_codes"

    id = Column(Integer, primary_key=True)
    code = Column(String(20), unique=True, nullable=False, index=True)   # THA, TUN...
    name = Column(String(160), nullable=False)                          # Trung tâm Thới Hòa
    old_code = Column(String(60))
    old_name = Column(String(160))


class InfraStat(Base):
    """1 dòng = 1 chỉ tiêu hạ tầng của 1 trung tâm trong 1 kỳ — flatten từ các
    bảng con của sheet "TỔNG HỢP" trong file CSDL hạ tầng mạng lưới."""
    __tablename__ = "infra_stats"

    id = Column(Integer, primary_key=True)
    period = Column(String(20), nullable=False, index=True)     # "2026-08"
    section = Column(String(160), nullable=False, index=True)   # "I. Vô tuyến", "V. Cơ điện — Ắc quy"...
    center = Column(String(20), nullable=False, index=True)     # mã cụm, hoặc "Tổng"
    label = Column(String(300), nullable=False, index=True)     # tên chỉ tiêu, đọc thẳng từ Excel
    value = Column(Float, nullable=True)
    value_text = Column(String(300), nullable=True)             # dự phòng nếu ô không phải số


class TechCategory(Base):
    """Đầu việc mảng kỹ thuật. Trước đây là danh sách cứng trong mã nguồn nên
    thêm đầu việc mới phải sửa code ở cả hai phía; nay lưu trong cơ sở dữ liệu
    để quản trị viên tự thêm, và để hạng mục tiến độ tham chiếu đúng một nguồn."""
    __tablename__ = "tech_categories"

    id = Column(Integer, primary_key=True)
    code = Column(String(40), unique=True, nullable=False, index=True)  # vd ke_hoach_5g
    label = Column(String(160), nullable=False)                         # vd "3. Kế hoạch 5G"
    hint = Column(Text)                     # gợi ý phạm vi, hiện trên form giao việc
    order_no = Column(Integer, default=0)
    active = Column(Boolean, default=True)


class TechProgressItem(Base):
    """Hạng mục định lượng (Kế hoạch/Thực hiện) thuộc một đầu việc."""
    __tablename__ = "tech_progress_items"

    id = Column(Integer, primary_key=True)
    code = Column(String(60), unique=True, nullable=False, index=True)  # vd 5g_srt5g
    label = Column(String(200), nullable=False)                         # vd "Tích hợp SRT5G"
    category_code = Column(String(40), nullable=False, index=True)      # khoá về TechCategory.code
    order_no = Column(Integer, default=0)
    active = Column(Boolean, default=True)


class ProgressEntry(Base):
    """Kế hoạch/Thực hiện theo hạng mục con của từng đầu việc kỹ thuật.
    ft_name rỗng = dòng tổng theo Trung tâm (nhập Excel); có tên = dòng chi
    tiết theo FT trong trung tâm đó (nhập tay trên web)."""
    __tablename__ = "progress_entries"

    id = Column(Integer, primary_key=True)
    category = Column(String(40), nullable=False, index=True)   # đầu việc, vd ke_hoach_5g
    item = Column(String(60), nullable=False, index=True)       # hạng mục con, vd srt5g
    period = Column(String(20), nullable=False, index=True)     # kỳ báo cáo, vd 2026-09
    center = Column(String(120), nullable=False, index=True)
    ft_name = Column(String(160), nullable=True)
    plan_qty = Column(Float, default=0)     # Kế hoạch
    done_qty = Column(Float, default=0)     # Thực hiện
    note = Column(Text)
    created_at = Column(DateTime, default=now)
    updated_at = Column(DateTime, default=now, onupdate=now)
