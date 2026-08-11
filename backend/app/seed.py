"""
Nạp dữ liệu mẫu lần đầu chạy, để mở trang lên là đã có nội dung để xem.
Khi đưa vào dùng thật, xoá dữ liệu mẫu và nhập dữ liệu thật của chi nhánh.
"""
import datetime as dt

from .auth import hash_password
from .database import SessionLocal
from . import models as m

TODAY = dt.date.today()


def seed_if_empty():
    db = SessionLocal()
    try:
        if db.query(m.Person).count() > 0:
            return  # đã có dữ liệu, không nạp lại

        # --- Danh bạ ------------------------------------------------------
        people_raw = [
            ("Trần Quốc Bảo", "Giám đốc Chi nhánh", "Ban Giám đốc", "0982111001", "baotq@viettel.com.vn", "#C8102E", (1985, 3, 14)),
            ("Lê Thị Mai Hương", "Phó Giám đốc Kỹ thuật", "Ban Giám đốc", "0982111002", "huongltm@viettel.com.vn", "#9E0C24", (1987, 8, 21)),
            ("Đoàn Văn Lương", "Phụ trách Cổng thông tin", "Phòng Vận hành khai thác", "0974505447", "luongdv@viettel.com.vn", "#C8102E", (1989, 11, 2)),
            ("Phạm Minh Tuấn", "Tổ trưởng Ứng cứu thông tin", "Phòng Kỹ thuật", "0982111011", "tuanpm@viettel.com.vn", "#0284C7", (1992, 8, 8)),
            ("Đỗ Thanh Hằng", "Trưởng phòng Tổ chức Lao động", "Phòng TCLĐ", "0982111020", "hangdt@viettel.com.vn", "#7C3AED", (1990, 5, 30)),
            ("Vũ Đình Khoa", "Chuyên viên Tài chính", "Phòng Tài chính", "0982111030", "khoavd@viettel.com.vn", "#F2A007", (1994, 8, 9)),
            ("Ngô Bích Ngọc", "Chuyên viên Truyền thông", "Phòng Tổng hợp", "0982111040", "ngocnb@viettel.com.vn", "#DB2777", (1996, 8, 8)),
            ("Hoàng Trung Kiên", "Giám đốc Trung tâm KV1", "Trung tâm KV1", "0982111050", "kienht@viettel.com.vn", "#65A30D", (1986, 8, 10)),
            ("Bùi Nhật Linh", "Kỹ sư vận hành khai thác", "Trung tâm KV2", "0982111051", "linhbn@viettel.com.vn", "#0F6CBD", (1995, 8, 8)),
            ("Trịnh Anh Dũng", "Nhân viên Kho vật tư", "Phòng Tổng hợp", "0982111060", "dungta@viettel.com.vn", "#64748B", (1993, 2, 17)),
        ]
        people = []
        for name, role, dept, phone, mail, color, bd in people_raw:
            p = m.Person(full_name=name, role=role, dept=dept, phone=phone,
                         email=mail, color=color, birthday=dt.date(*bd))
            db.add(p); people.append(p)
        db.flush()

        # --- Tài khoản đăng nhập ------------------------------------------
        # Mật khẩu mặc định: viettel@2026 — đổi ngay sau khi triển khai.
        db.add(m.User(username="admin", password_hash=hash_password("viettel@2026"),
                      full_name="Quản trị hệ thống", role="admin", person_id=people[1].id))
        db.add(m.User(username="luongdv", password_hash=hash_password("viettel@2026"),
                      full_name="Đoàn Văn Lương", role="editor", person_id=people[2].id))
        db.add(m.User(username="linhbn", password_hash=hash_password("viettel@2026"),
                      full_name="Bùi Nhật Linh", role="staff", person_id=people[8].id))

        # --- Thông báo khẩn ------------------------------------------------
        db.add(m.Notice(content=(
            "Cắt điện lưới khu vực Hóc Môn từ 22:00 hôm nay đến 04:00 ngày mai — "
            "các đội bố trí máy phát cho 14 trạm trọng điểm."
        )))

        # --- Tin tức --------------------------------------------------------
        news_raw = [
            ("Chi nhánh hoàn thành 106% kế hoạch sản lượng tháng 7", "Toàn chi nhánh về đích sớm 4 ngày, Trung tâm KV2 dẫn đầu với 118% kế hoạch.", "Hoạt động", "Tin nổi bật", True),
            ("Phát động thi đua 90 ngày đêm nước rút quý III", "Mục tiêu rút ngắn thời gian xử lý sự cố xuống dưới 90 phút.", "Phong trào", "Thi đua", False),
            ("Ca trực 41 đêm mùa mưa bão của tổ ứng cứu thông tin", "Câu chuyện của tổ ứng cứu thông tin khu vực Cần Giờ.", "Gương điển hình", "Gương điển hình", False),
            ("Đọc lại 8 giá trị cốt lõi của văn hoá Viettel", "Chuỗi bài sinh hoạt văn hoá tháng 8 dành cho toàn thể cán bộ, nhân viên.", "Văn hoá", "Văn hoá Viettel", False),
            ("Tổ Ứng cứu thông tin nhận Bằng khen của Tổng Công ty", "Khắc phục sự cố tuyến cáp trục trong 6 giờ, sớm hơn định mức 4 giờ.", "Hoạt động", "Thành tích", False),
            ("Bản tin nội bộ số 31/2026", "Điểm lại hoạt động tuần 31 và lịch công tác tuần 32.", "Bản tin", "Bản tin tuần", False),
        ]
        for i, (title, excerpt, cat, tag, feat) in enumerate(news_raw):
            db.add(m.News(title=title, excerpt=excerpt, category=cat, tag=tag, featured=feat,
                          author="Ban Truyền thông",
                          published_at=dt.datetime.now() - dt.timedelta(days=i * 2)))

        # --- Tài liệu -------------------------------------------------------
        docs_raw = [
            ("Quy trình xử lý sự cố mạng truyền dẫn cấp 1", "QT-VHKT-01", "Quy trình", "2,4 MB", "ứng cứu thông tin sự cố cáp quang truyền dẫn thời gian khắc phục"),
            ("Hướng dẫn kỹ thuật lắp đặt và căn chỉnh anten 5G", "HD-KT-14", "Hướng dẫn kỹ thuật", "8,1 MB", "anten tilt azimuth 5G lắp đặt trạm BTS an toàn"),
            ("Biểu mẫu nghiệm thu công trình hạ tầng", "BM-NT-03", "Biểu mẫu", "310 KB", "nghiệm thu biên bản hồ sơ hoàn công thanh toán khối lượng"),
            ("Quy định định mức nhiên liệu xe công tác 2026", "QĐ-1187/VCC", "Văn bản", "1,1 MB", "xăng dầu định mức nhiên liệu xe công tác thanh toán"),
            ("Quy trình tiếp nhận và xử lý phản ánh khách hàng", "QT-CSKH-07", "Quy trình", "1,8 MB", "PAKH phản ánh khách hàng tiếp nhận xử lý hài lòng"),
            ("Hướng dẫn an toàn lao động khi thi công trên cao", "HD-ATLĐ-02", "Hướng dẫn kỹ thuật", "4,6 MB", "an toàn lao động dây đai leo cao cột trạm bảo hộ"),
            ("Biểu mẫu đề xuất sáng kiến cải tiến", "BM-SK-01", "Biểu mẫu", "180 KB", "sáng kiến cải tiến đề xuất hội đồng chấm điểm"),
            ("Quy chế chi tiêu nội bộ chi nhánh năm 2026", "QC-TC-2026", "Văn bản", "2,0 MB", "chi tiêu tài chính công tác phí định mức thanh toán"),
        ]
        for i, (title, code, cat, size, text) in enumerate(docs_raw):
            db.add(m.Document(title=title, code=code, category=cat, size_label=size,
                              content_text=text, file_url="",
                              updated_on=TODAY - dt.timedelta(days=i * 20)))

        # --- Trung tâm ứng dụng ---------------------------------------------
        apps_raw = [
            ("GNOC", "Giám sát và điều hành mạng lưới", "#", "Vận hành", "#C8102E"),
            ("NIMS", "Quản lý hạ tầng, tài sản trạm", "#", "Vận hành", "#9E0C24"),
            ("AppSheet", "Ứng dụng nghiệp vụ hiện trường", "https://www.appsheet.com", "Vận hành", "#0E9C99"),
            ("Portal Viettel", "Cổng nội bộ Tập đoàn", "#", "Điều hành", "#15181F"),
            ("Outlook", "Thư điện tử công việc", "https://outlook.office.com", "Văn phòng", "#0F6CBD"),
            ("Teams", "Họp và trao đổi nhóm", "https://teams.microsoft.com", "Văn phòng", "#5B5FC7"),
            ("Google Drive", "Lưu trữ tài liệu dùng chung", "https://drive.google.com", "Văn phòng", "#F2A007"),
            ("Google Sheets", "Bảng theo dõi số liệu", "https://sheets.google.com", "Văn phòng", "#0A7A50"),
            ("Quản lý xăng dầu", "Phần mềm tự phát triển của chi nhánh", "#", "Chi nhánh", "#7C3AED"),
            ("Chấm công đội", "Phần mềm tự phát triển của chi nhánh", "#", "Chi nhánh", "#DB2777"),
            ("Theo dõi WO", "Phần mềm tự phát triển của chi nhánh", "#", "Chi nhánh", "#0284C7"),
            ("Kho vật tư", "Phần mềm tự phát triển của chi nhánh", "#", "Chi nhánh", "#65A30D"),
        ]
        for i, (name, desc, url, cat, color) in enumerate(apps_raw):
            db.add(m.AppLink(name=name, description=desc, url=url, category=cat, color=color, order_no=i))

        # --- Banner trang chủ ------------------------------------------------
        for i, (t, color, link) in enumerate([
            ("Thi đua 90 ngày đêm nước rút quý III/2026", "#C8102E", "#"),
            ("An toàn là số một — kiểm tra dây đai trước khi lên cao", "#9E0C24", "#"),
            ("Mùa mưa bão 2026: chủ động phương án dự phòng nguồn", "#78091B", "#"),
        ]):
            db.add(m.Banner(title=t, color=color, link_url=link, order_no=i, active=True))

        # --- Album ảnh và video ------------------------------------------------
        media_raw = [
            ("Diễn tập ứng cứu thông tin mùa mưa bão", "image", "Tổ KV1", "Cuộc thi ảnh Khoảnh khắc người Công trình", "#C8102E"),
            ("Ca đêm trên đỉnh cột 42m", "image", "Phạm Minh Tuấn", "Cuộc thi ảnh Khoảnh khắc người Công trình", "#15181F"),
            ("Ngày hội hiến máu", "image", "Công đoàn", "Cuộc thi ảnh Khoảnh khắc người Công trình", "#9E0C24"),
            ("Giải bóng đá truyền thống 2026", "image", "Đoàn Thanh niên", "Cuộc thi ảnh Khoảnh khắc người Công trình", "#F2A007"),
            ("Hướng dẫn thay module nguồn tủ DC", "video", "Phòng VHKT", "Video kỹ thuật", "#0E9C99"),
            ("Quy trình kiểm tra trạm trước mùa mưa", "video", "Phòng VHKT", "Video kỹ thuật", "#0284C7"),
        ]
        for i, (title, kind, author, album, color) in enumerate(media_raw):
            db.add(m.MediaItem(title=title, kind=kind, author=author, album=album,
                               color=color, order_no=i, active=True,
                               url="" if kind == "image" else "#"))

        # --- Tài liệu bổ sung theo nhóm chuyên môn -----------------------------
        docs_them = [
            ("Hướng dẫn vận hành tủ nguồn DC 48V", "HD-CD-05", "Cơ điện", "1,6 MB",
             "tủ nguồn dc acquy chỉnh lưu ắc quy cơ điện"),
            ("Quy trình đấu nối và hàn nối cáp quang", "QT-TD-02", "Truyền dẫn", "3,2 MB",
             "cáp quang hàn nối măng xông suy hao truyền dẫn"),
            ("Hướng dẫn tối ưu vùng phủ trạm 4G", "HD-VT-08", "Vô tuyến", "5,4 MB",
             "vô tuyến vùng phủ tilt anten 4g tối ưu"),
            ("Quy định quản lý hạ tầng nhà trạm", "QĐ-HT-11", "Hạ tầng", "2,1 MB",
             "nhà trạm hạ tầng cột ăng ten mặt bằng"),
            ("Quy trình bàn giao ca trực vận hành", "QT-VH-04", "Vận hành khai thác", "890 KB",
             "ca trực bàn giao vận hành khai thác nhật ký"),
            ("Hướng dẫn thanh toán chi phí nhiên liệu", "HD-XD-01", "Xăng dầu", "740 KB",
             "xăng dầu nhiên liệu thanh toán chứng từ định mức"),
            ("Quy định quản lý vật tư dự phòng", "QĐ-VT-06", "Vật tư", "1,3 MB",
             "vật tư dự phòng xuất nhập tồn kho"),
        ]
        for i, (title, code, cat, size, text) in enumerate(docs_them):
            db.add(m.Document(title=title, code=code, category=cat, size_label=size,
                              content_text=text, file_url="",
                              updated_on=TODAY - dt.timedelta(days=i * 9)))

        # --- Cấu hình website -------------------------------------------------
        configs = [
            ("site_title", "Cổng thông tin nội bộ của Phòng Vận hành khai thác - Chi nhánh Công trình Viettel Hồ Chí Minh", "Tên đầy đủ của cổng thông tin", "textarea"),
            ("site_short", "Cổng thông tin nội bộ", "Tên rút gọn hiện ở góc trái", "text"),
            ("site_dept", "Phòng Vận hành khai thác", "Tên phòng", "text"),
            ("site_branch", "CNCT Viettel Hồ Chí Minh", "Tên chi nhánh", "text"),
            ("primary_color", "#C8102E", "Màu chủ đạo", "color"),
            ("director_name", "Trần Quốc Bảo", "Họ tên Giám đốc", "text"),
            ("director_title", "Giám đốc Chi nhánh Công trình Viettel Hồ Chí Minh", "Chức danh Giám đốc", "text"),
            ("director_message", "Tháng 8 là tháng cao điểm mưa bão. Mỗi trạm giữ được sóng là một gia đình vẫn liên lạc được với nhau. Mong toàn thể anh em giữ vững kỷ luật ca trực và tuyệt đối an toàn khi lên cao.", "Thông điệp của Giám đốc", "textarea"),
            ("support_name", "Đoàn Văn Lương", "Người phụ trách cổng thông tin", "text"),
            ("support_role", "Phòng Vận hành khai thác", "Đơn vị phụ trách", "text"),
            ("support_phone", "0974505447", "Số điện thoại liên hệ", "text"),
            ("docs_url", "/docs", "Đường dẫn tài liệu API", "text"),
            ("guide_url", "#", "Đường dẫn tài liệu hướng dẫn sử dụng", "text"),
        ]
        for key, value, label, kind in configs:
            db.add(m.SiteConfig(key=key, value=value, label=label, kind=kind))

        # --- Số liệu Dashboard -----------------------------------------------
        months = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08"]
        kpi_th = [92, 88, 96, 101, 97, 99, 106, 94]
        for mo, v in zip(months, kpi_th):
            db.add(m.Metric(board="KPI", period=mo, label="Kế hoạch", value=100))
            db.add(m.Metric(board="KPI", period=mo, label="Thực hiện", value=v))

        wo = [(1120, 1002), (1210, 1145), (1305, 1189), (1288, 1210), (1402, 1284), (640, 588)]
        for mo, (giao, xong) in zip(months[2:], wo):
            db.add(m.Metric(board="WO", period=mo, label="Được giao", value=giao))
            db.add(m.Metric(board="WO", period=mo, label="Hoàn thành", value=xong))

        pakh = [(210, 198), (245, 240), (268, 255), (231, 228), (254, 251), (118, 106)]
        for mo, (nhan, xuly) in zip(months[2:], pakh):
            db.add(m.Metric(board="PAKH", period=mo, label="Tiếp nhận", value=nhan))
            db.add(m.Metric(board="PAKH", period=mo, label="Đã xử lý", value=xuly))

        fuel = [("Trung tâm KV1", 4200, 3980), ("Trung tâm KV2", 3800, 4110),
                ("Trung tâm KV3", 3500, 3320), ("Đội cơ động", 2600, 2540), ("Khối văn phòng", 900, 720)]
        for unit, dm, tt in fuel:
            db.add(m.Metric(board="FUEL", period="2026-07", label="Định mức", unit_name=unit, value=dm))
            db.add(m.Metric(board="FUEL", period="2026-07", label="Thực chi", unit_name=unit, value=tt))

        for stage, v in [("Nhu cầu", 48), ("Ứng tuyển", 214), ("Phỏng vấn", 96), ("Đạt", 41), ("Đã nhận việc", 33)]:
            db.add(m.Metric(board="HIRE", period="2026-Q3", label="Số lượng", unit_name=stage, value=v))

        for mo, v in zip(months[2:], [18.2, 20.5, 22.1, 21.4, 25.8, 12.3]):
            db.add(m.Metric(board="OUTPUT", period=mo, label="Sản lượng", value=v))

        for i, (av, sc) in enumerate([(99.82, 14), (99.90, 9), (99.76, 18), (99.88, 11),
                                      (99.94, 6), (99.91, 8), (99.87, 10)]):
            day = (TODAY - dt.timedelta(days=6 - i)).isoformat()
            db.add(m.Metric(board="NETWORK", period=day, label="Availability", value=av))
            db.add(m.Metric(board="NETWORK", period=day, label="Số sự cố", value=sc))

        # --- Sáng kiến ---------------------------------------------------------
        ideas_raw = [
            ("Gắn mã QR trên tủ nguồn để tra cứu nhanh lý lịch thiết bị", "Rút ngắn 15 phút mỗi lượt kiểm tra", "Đang triển khai", 87, 3),
            ("Tự động tổng hợp báo cáo WO hằng ngày từ Google Sheets", "Tiết kiệm 6 giờ công mỗi tuần", "Đã áp dụng", 132, 8),
            ("Bộ dụng cụ chuẩn hoá cho xe ứng cứu thông tin", "Giảm 20% thời gian chuẩn bị", "Chờ duyệt", 45, 7),
            ("Cảnh báo sớm tiêu hao nhiên liệu bất thường theo tuyến", "Ước giảm 4% chi phí xăng dầu", "Chờ duyệt", 29, 5),
        ]
        idea_bodies = {
            0: "Hiện mỗi lần kiểm tra tủ nguồn, anh em phải mở sổ tra lý lịch thiết bị, "
               "mất trung bình 15 phút. Đề xuất dán mã QR lên mặt tủ, quét bằng điện thoại "
               "là ra ngay chủng loại, năm lắp đặt, lịch sử bảo dưỡng và số lần sự cố.\n\n"
               "Chi phí: in tem chống nước khoảng 3.000 đồng mỗi tủ.",
            1: "Báo cáo WO hằng ngày đang làm thủ công: mở Google Sheets, lọc, cộng tay rồi "
               "gõ lại vào biểu mẫu. Đề xuất viết một kịch bản tự động tổng hợp và gửi vào "
               "nhóm lúc 17h mỗi ngày.\n\nĐã chạy thử một tháng tại tổ KV2, không sai lệch số liệu.",
            2: "Xe ứng cứu thông tin hiện mỗi xe mang một bộ dụng cụ khác nhau, đến hiện trường "
               "hay thiếu. Đề xuất chuẩn hoá một danh mục chung, có sơ đồ vị trí từng món trong "
               "thùng để lấy nhanh và kiểm đếm sau ca.",
            3: "Đề xuất theo dõi tiêu hao nhiên liệu theo từng tuyến, so với định mức trung bình "
               "của chính tuyến đó trong ba tháng gần nhất. Vượt quá 15% thì cảnh báo để rà soát.",
        }
        for i, (title, benefit, status, votes, idx) in enumerate(ideas_raw):
            db.add(m.Idea(title=title, benefit=benefit, status=status, votes=votes,
                          body=idea_bodies.get(i, ""),
                          author_id=people[idx].id, dept=people[idx].dept))

        # --- Kênh trao đổi ------------------------------------------------------
        channels_raw = [
            ("kt", "Kỹ thuật – Vận hành khai thác"),
            ("ht", "Hạ tầng và xây lắp"),
            ("hc", "Hành chính – Nhân sự"),
            ("tc", "Tài chính – Kế toán"),
            ("cd", "Hỏi đáp chung"),
        ]
        chans = {}
        for slug, name in channels_raw:
            c = m.Channel(slug=slug, name=name)
            db.add(c); chans[slug] = c
        db.flush()

        threads_raw = [
            ("kt", "Trạm HCM-2210 mất nguồn AC lặp lại 3 lần trong tuần, ai từng gặp?", "Bùi Nhật Linh", "Hỏi đáp kỹ thuật"),
            ("kt", "Chia sẻ cách đo suy hao nhanh khi không có OTDR tại hiện trường", "Phạm Minh Tuấn", "Chia sẻ kinh nghiệm"),
            ("ht", "Vướng mặt bằng tuyến cáp ngầm Bình Chánh — kinh nghiệm làm việc với địa phương", "Hoàng Trung Kiên", "Chia sẻ kinh nghiệm"),
            ("hc", "Hồ sơ thanh toán công tác phí cần những gì sau quy chế mới?", "Trịnh Anh Dũng", "Hỏi đáp"),
            ("tc", "Thời hạn nộp chứng từ xăng dầu tháng 8", "Vũ Đình Khoa", "Thông báo"),
            ("cd", "Đề xuất mở lớp tiếng Anh buổi tối cho cán bộ, nhân viên", "Ngô Bích Ngọc", "Góp ý"),
        ]
        threads = []
        for slug, title, author, tag in threads_raw:
            th = m.Thread(channel_id=chans[slug].id, title=title, author_name=author, tag=tag)
            db.add(th)
            threads.append(th)
        db.flush()

        def tim_chu_de(tien_to):
            """Tìm chủ đề theo phần đầu tiêu đề, tránh lệch khi cắt chuỗi cứng."""
            for t in threads:
                if t.title.startswith(tien_to):
                    return t
            return None

        # Vài câu trả lời mẫu để thấy ngay cách hiển thị
        replies_raw = [
            ("Trạm HCM-2210", "Bùi Nhật Linh",
             "Trạm này tháng trước cũng bị. Nguyên nhân do aptomat tổng bị nhão, đóng lại được vài hôm rồi nhảy tiếp."),
            ("Trạm HCM-2210", "Phạm Minh Tuấn",
             "Anh em kiểm tra thêm điểm đấu nối đầu vào. Có trường hợp siết không chặt gây phát nhiệt, đến ngưỡng là nhảy."),
            ("Chia sẻ cách đo suy hao", "Hoàng Trung Kiên",
             "Cách này chỉ ước lượng được, sai số khá lớn với tuyến dài trên 20km. Tuyến trục vẫn nên chờ OTDR."),
        ]
        for tien_to, author, body in replies_raw:
            th = tim_chu_de(tien_to)
            if th is not None:
                db.add(m.Reply(thread_id=th.id, author_name=author, body=body))
            else:
                print(f"Bỏ qua câu trả lời mẫu: không tìm thấy chủ đề bắt đầu bằng '{tien_to}'")

        # --- Lịch công tác và sự kiện --------------------------------------------
        # Lịch mẫu có đủ các hình thức họp để thấy ngay cách hiển thị
        schedule_raw = [
            ("07:30", "Giao ban tuần Phòng Vận hành khai thác", "Phòng họp 301", "Ban Giám đốc",
             "Ban Giám đốc, Trưởng các phòng, Tổ trưởng các tổ", "truc_tiep", "", "", ""),
            ("09:00", "Họp trực tuyến với Tổng Công ty", "", "Tổng Công ty",
             "Giám đốc, Phó Giám đốc Kỹ thuật", "cau_truyen_hinh", "10.255.58.3", "", ""),
            ("13:30", "Nghiệm thu hạng mục cáp ngầm tuyến Bình Chánh", "Hiện trường", "Tổ KV2",
             "Tổ KV2, đại diện Phòng Kỹ thuật, nhà thầu", "truc_tiep", "", "", ""),
            ("15:00", "Đào tạo nội bộ quy trình phản ánh khách hàng", "", "Phòng TCLĐ",
             "Toàn thể cán bộ, nhân viên", "zoom",
             "https://zoom.us/j/81234567890", "812 3456 7890", "vhkt2026"),
            ("16:30", "Rà soát tiến độ work order tuần 32", "", "Phòng VHKT",
             "Tổ trưởng các tổ, cán bộ theo dõi WO", "google_meet",
             "https://meet.google.com/abc-defg-hij", "", ""),
        ]
        for hhmm, title, place, host, tp, ht, tt, ma, mk in schedule_raw:
            h, mi = map(int, hhmm.split(":"))
            db.add(m.Event(title=title, place=place, host=host, kind="work",
                           participants=tp, meeting_type=ht, meeting_info=tt,
                           meeting_id=ma, meeting_pass=mk,
                           start_at=dt.datetime.combine(TODAY, dt.time(h, mi))))

        for d, title, place in [(4, "Sinh hoạt văn hoá Viettel tháng 8", "Hội trường tầng 2"),
                                (11, "Giải chạy nội bộ Kết nối bước chân", "Công viên Gia Định"),
                                (18, "Tổng kết thi đua quý III và trao thưởng sáng kiến", "Hội trường tầng 2")]:
            db.add(m.Event(title=title, place=place, kind="culture",
                           start_at=dt.datetime.combine(TODAY + dt.timedelta(days=d), dt.time(8, 0))))

        db.commit()
        print("Đã nạp xong dữ liệu mẫu.")
    finally:
        db.close()
