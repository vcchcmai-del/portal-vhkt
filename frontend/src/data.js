/**
 * Dữ liệu dự phòng: dùng khi backend chưa chạy, để trang không bị trắng.
 * Khi backend hoạt động, toàn bộ dữ liệu dưới đây bị thay bằng dữ liệu thật.
 */

export const RED = "#C8102E";
export const RED_DARK = "#9E0C24";
export const RED_DEEP = "#78091B";
export const AMBER = "#F2A007";
export const TEAL = "#0E9C99";
export const SLATE = "#64748B";

export const CONFIG_FB = {
  site_title: "Cổng thông tin nội bộ của Phòng Vận hành khai thác - Chi nhánh Công trình Viettel Hồ Chí Minh",
  site_short: "Cổng thông tin nội bộ",
  site_dept: "Phòng Vận hành khai thác",
  site_branch: "CNCT Viettel Hồ Chí Minh",
  director_name: "Trần Quốc Bảo",
  director_title: "Giám đốc Chi nhánh Công trình Viettel Hồ Chí Minh",
  director_message:
    "Tháng 8 là tháng cao điểm mưa bão. Mỗi trạm giữ được sóng là một gia đình vẫn liên lạc được với nhau. Mong toàn thể anh em giữ vững kỷ luật ca trực và tuyệt đối an toàn khi lên cao.",
  support_name: "Đoàn Văn Lương",
  support_role: "Phòng Vận hành khai thác",
  support_phone: "0974505447",
};

export const BANNERS_FB = [
  { id: 1, title: "Thi đua 90 ngày đêm nước rút quý III/2026", color: RED, link_url: "#" },
  { id: 2, title: "An toàn là số một — kiểm tra dây đai trước khi lên cao", color: RED_DARK, link_url: "#" },
  { id: 3, title: "Mùa mưa bão 2026: chủ động phương án dự phòng nguồn", color: RED_DEEP, link_url: "#" },
];

export const APPS_FB = [
  { id: 1, name: "GNOC", description: "Giám sát và điều hành mạng lưới", cat: "Vận hành", color: RED, url: "#" },
  { id: 2, name: "NIMS", description: "Quản lý hạ tầng, tài sản trạm", cat: "Vận hành", color: RED_DARK, url: "#" },
  { id: 3, name: "AppSheet", description: "Ứng dụng nghiệp vụ hiện trường", cat: "Vận hành", color: TEAL, url: "https://www.appsheet.com" },
  { id: 4, name: "Portal Viettel", description: "Cổng nội bộ Tập đoàn", cat: "Điều hành", color: "#15181F", url: "#" },
  { id: 5, name: "Outlook", description: "Thư điện tử công việc", cat: "Văn phòng", color: "#0F6CBD", url: "https://outlook.office.com" },
  { id: 6, name: "Teams", description: "Họp và trao đổi nhóm", cat: "Văn phòng", color: "#5B5FC7", url: "https://teams.microsoft.com" },
  { id: 7, name: "Google Drive", description: "Lưu trữ tài liệu dùng chung", cat: "Văn phòng", color: AMBER, url: "https://drive.google.com" },
  { id: 8, name: "Google Sheets", description: "Bảng theo dõi số liệu", cat: "Văn phòng", color: "#0A7A50", url: "https://sheets.google.com" },
  { id: 9, name: "Quản lý xăng dầu", description: "Phần mềm tự phát triển của đơn vị", cat: "Đơn vị", color: "#7C3AED", url: "#" },
  { id: 10, name: "Chấm công đội", description: "Phần mềm tự phát triển của đơn vị", cat: "Đơn vị", color: "#DB2777", url: "#" },
  { id: 11, name: "Theo dõi WO", description: "Phần mềm tự phát triển của đơn vị", cat: "Đơn vị", color: "#0284C7", url: "#" },
  { id: 12, name: "Kho vật tư", description: "Phần mềm tự phát triển của đơn vị", cat: "Đơn vị", color: "#65A30D", url: "#" },
];

export const NEWS_FB = [
  { id: 1, tag: "Tin nổi bật", title: "Đơn vị hoàn thành 106% kế hoạch sản lượng tháng 7", excerpt: "Toàn đơn vị về đích sớm 4 ngày, tổ vận hành khu vực 2 dẫn đầu với 118% kế hoạch.", date: "05/08/2026", cat: "Hoạt động", author: "Ban Truyền thông", pinned: true },
  { id: 2, tag: "Thi đua", title: "Phát động thi đua 90 ngày đêm nước rút quý III", excerpt: "Mục tiêu rút ngắn thời gian xử lý sự cố xuống dưới 90 phút và không để phát sinh sự cố lặp lại.", date: "03/08/2026", cat: "Phong trào", author: "Công đoàn" },
  { id: 3, tag: "Gương điển hình", title: "Ca trực 41 đêm mùa mưa bão của tổ ứng cứu thông tin", excerpt: "Câu chuyện của anh em trực đêm khu vực Cần Giờ trong đợt mưa bão cuối tháng 7.", date: "01/08/2026", cat: "Gương điển hình", author: "Ban Truyền thông" },
  { id: 4, tag: "Văn hoá Viettel", title: "Đọc lại 8 giá trị cốt lõi của văn hoá Viettel", excerpt: "Chuỗi bài sinh hoạt văn hoá tháng 8 dành cho toàn thể cán bộ, nhân viên.", date: "29/07/2026", cat: "Văn hoá", author: "Phòng TCLĐ" },
  { id: 5, tag: "Thành tích", title: "Tổ Ứng cứu thông tin nhận Bằng khen của Tổng Công ty", excerpt: "Khắc phục sự cố tuyến cáp trục trong 6 giờ, sớm hơn định mức 4 giờ.", date: "26/07/2026", cat: "Hoạt động", author: "Ban Thi đua" },
  { id: 6, tag: "Bản tin tuần", title: "Bản tin nội bộ số 31/2026", excerpt: "Điểm lại toàn bộ hoạt động tuần 31, số liệu và lịch công tác tuần 32.", date: "25/07/2026", cat: "Bản tin", author: "Ban Truyền thông" },
];

export const DOCS_FB = [
  { id: 1, title: "Quy trình xử lý sự cố mạng truyền dẫn cấp 1", cat: "Quy trình", code: "QT-VHKT-01", size: "2,4 MB", date: "12/06/2026", body: "ứng cứu thông tin sự cố cáp quang truyền dẫn khắc phục sla" },
  { id: 2, title: "Hướng dẫn kỹ thuật lắp đặt và căn chỉnh anten 5G", cat: "Hướng dẫn kỹ thuật", code: "HD-KT-14", size: "8,1 MB", date: "02/07/2026", body: "anten tilt azimuth 5g lắp đặt trạm bts an toàn" },
  { id: 3, title: "Biểu mẫu nghiệm thu công trình hạ tầng", cat: "Biểu mẫu", code: "BM-NT-03", size: "310 KB", date: "18/05/2026", body: "nghiệm thu biên bản hoàn công thanh toán khối lượng" },
  { id: 4, title: "Quy định định mức nhiên liệu xe công tác 2026", cat: "Văn bản", code: "QĐ-1187/VCC", size: "1,1 MB", date: "20/01/2026", body: "xăng dầu định mức nhiên liệu xe công tác thanh toán" },
  { id: 5, title: "Quy trình tiếp nhận và xử lý phản ánh khách hàng", cat: "Quy trình", code: "QT-CSKH-07", size: "1,8 MB", date: "09/04/2026", body: "pakh phản ánh khách hàng tiếp nhận xử lý hài lòng" },
  { id: 6, title: "Hướng dẫn an toàn lao động khi thi công trên cao", cat: "Hướng dẫn kỹ thuật", code: "HD-ATLĐ-02", size: "4,6 MB", date: "15/03/2026", body: "an toàn lao động dây đai leo cao cột trạm bảo hộ" },
  { id: 7, title: "Biểu mẫu đề xuất sáng kiến cải tiến", cat: "Biểu mẫu", code: "BM-SK-01", size: "180 KB", date: "10/02/2026", body: "sáng kiến cải tiến đề xuất hội đồng chấm điểm" },
  { id: 8, title: "Quy chế chi tiêu nội bộ năm 2026", cat: "Văn bản", code: "QC-TC-2026", size: "2,0 MB", date: "05/01/2026", body: "chi tiêu tài chính công tác phí định mức thanh toán" },
];

export const PEOPLE_FB = [
  { id: 1, full_name: "Trần Quốc Bảo", role: "Giám đốc Chi nhánh", dept: "Ban Giám đốc", phone: "0982111001", email: "baotq@viettel.com.vn", color: RED, birthday: "1985-03-14" },
  { id: 2, full_name: "Lê Thị Mai Hương", role: "Phó Giám đốc Kỹ thuật", dept: "Ban Giám đốc", phone: "0982111002", email: "huongltm@viettel.com.vn", color: RED_DARK, birthday: "1987-08-21" },
  { id: 3, full_name: "Đoàn Văn Lương", role: "Phụ trách Cổng thông tin", dept: "Phòng Vận hành khai thác", phone: "0974505447", email: "luongdv@viettel.com.vn", color: RED, birthday: "1989-11-02" },
  { id: 4, full_name: "Phạm Minh Tuấn", role: "Tổ trưởng Ứng cứu thông tin", dept: "Phòng Vận hành khai thác", phone: "0982111011", email: "tuanpm@viettel.com.vn", color: "#0284C7", birthday: "1992-08-08" },
  { id: 5, full_name: "Đỗ Thanh Hằng", role: "Trưởng phòng Tổ chức Lao động", dept: "Phòng TCLĐ", phone: "0982111020", email: "hangdt@viettel.com.vn", color: "#7C3AED", birthday: "1990-05-30" },
  { id: 6, full_name: "Vũ Đình Khoa", role: "Chuyên viên Tài chính", dept: "Phòng Tài chính", phone: "0982111030", email: "khoavd@viettel.com.vn", color: AMBER, birthday: "1994-08-09" },
  { id: 7, full_name: "Ngô Bích Ngọc", role: "Chuyên viên Truyền thông", dept: "Phòng Tổng hợp", phone: "0982111040", email: "ngocnb@viettel.com.vn", color: "#DB2777", birthday: "1996-08-08" },
  { id: 8, full_name: "Hoàng Trung Kiên", role: "Tổ trưởng Vận hành KV1", dept: "Phòng Vận hành khai thác", phone: "0982111050", email: "kienht@viettel.com.vn", color: "#65A30D", birthday: "1986-08-10" },
  { id: 9, full_name: "Bùi Nhật Linh", role: "Kỹ sư vận hành khai thác", dept: "Phòng Vận hành khai thác", phone: "0982111051", email: "linhbn@viettel.com.vn", color: "#0F6CBD", birthday: "1995-08-08" },
  { id: 10, full_name: "Trịnh Anh Dũng", role: "Nhân viên Kho vật tư", dept: "Phòng Tổng hợp", phone: "0982111060", email: "dungta@viettel.com.vn", color: SLATE, birthday: "1993-02-17" },
];

export const SCHEDULE_FB = [
  { time: "07:30", title: "Giao ban trực tuyến toàn đơn vị", place: "Phòng họp 301 và Teams", host: "Ban Giám đốc" },
  { time: "09:00", title: "Kiểm tra an toàn thi công trạm HCM-1042", place: "Quận 12", host: "Phòng VHKT" },
  { time: "13:30", title: "Nghiệm thu hạng mục cáp ngầm tuyến Bình Chánh", place: "Hiện trường", host: "Tổ KV2" },
  { time: "15:00", title: "Đào tạo nội bộ quy trình phản ánh khách hàng", place: "Hội trường tầng 2", host: "Phòng TCLĐ" },
  { time: "16:30", title: "Rà soát tiến độ work order tuần 32", place: "Teams", host: "Phòng VHKT" },
];

export const EVENTS_FB = [
  { id: 1, title: "Sinh hoạt văn hoá Viettel tháng 8", start_at: "2026-08-12T08:00:00", place: "Hội trường tầng 2" },
  { id: 2, title: "Giải chạy nội bộ Kết nối bước chân", start_at: "2026-08-19T06:00:00", place: "Công viên Gia Định" },
  { id: 3, title: "Tổng kết thi đua quý III và trao thưởng sáng kiến", start_at: "2026-08-26T08:00:00", place: "Hội trường tầng 2" },
];

export const IDEAS_FB = [
  { id: 1, title: "Gắn mã QR trên tủ nguồn để tra cứu nhanh lý lịch thiết bị", author: "Phạm Minh Tuấn", dept: "Phòng VHKT", status: "Đang triển khai", votes: 87, saved: "Rút ngắn 15 phút mỗi lượt kiểm tra", date: "22/07/2026" },
  { id: 2, title: "Tự động tổng hợp báo cáo WO hằng ngày từ Google Sheets", author: "Bùi Nhật Linh", dept: "Phòng VHKT", status: "Đã áp dụng", votes: 132, saved: "Tiết kiệm 6 giờ công mỗi tuần", date: "10/07/2026" },
  { id: 3, title: "Bộ dụng cụ chuẩn hoá cho xe ứng cứu thông tin", author: "Hoàng Trung Kiên", dept: "Phòng VHKT", status: "Chờ duyệt", votes: 45, saved: "Giảm 20% thời gian chuẩn bị", date: "01/08/2026" },
  { id: 4, title: "Cảnh báo sớm tiêu hao nhiên liệu bất thường theo tuyến", author: "Vũ Đình Khoa", dept: "Phòng Tài chính", status: "Chờ duyệt", votes: 29, saved: "Ước giảm 4% chi phí xăng dầu", date: "04/08/2026" },
];

export const CHANNELS_FB = [
  { id: "kt", name: "Kỹ thuật – Vận hành khai thác", count: 46 },
  { id: "ht", name: "Hạ tầng và xây lắp", count: 28 },
  { id: "hc", name: "Hành chính – Nhân sự", count: 17 },
  { id: "tc", name: "Tài chính – Kế toán", count: 9 },
  { id: "cd", name: "Hỏi đáp chung", count: 62 },
];

export const THREADS_FB = {
  kt: [
    { id: 1, title: "Trạm HCM-2210 mất nguồn AC lặp lại 3 lần trong tuần, ai từng gặp?", author: "Bùi Nhật Linh", time: "1 giờ trước", replies: 7, tag: "Hỏi đáp kỹ thuật" },
    { id: 2, title: "Chia sẻ cách đo suy hao nhanh khi không có OTDR tại hiện trường", author: "Phạm Minh Tuấn", time: "Hôm qua", replies: 12, tag: "Chia sẻ kinh nghiệm" },
    { id: 3, title: "Mẫu checklist kiểm tra trạm trước mùa mưa bão 2026", author: "Đoàn Văn Lương", time: "2 ngày trước", replies: 5, tag: "Tài liệu" },
  ],
  ht: [{ id: 4, title: "Vướng mặt bằng tuyến cáp ngầm Bình Chánh — kinh nghiệm làm việc với địa phương", author: "Hoàng Trung Kiên", time: "3 giờ trước", replies: 4, tag: "Chia sẻ kinh nghiệm" }],
  hc: [{ id: 5, title: "Hồ sơ thanh toán công tác phí cần những gì sau quy chế mới?", author: "Trịnh Anh Dũng", time: "5 giờ trước", replies: 9, tag: "Hỏi đáp" }],
  tc: [{ id: 6, title: "Thời hạn nộp chứng từ xăng dầu tháng 8", author: "Vũ Đình Khoa", time: "Hôm qua", replies: 2, tag: "Thông báo" }],
  cd: [{ id: 7, title: "Đề xuất mở lớp tiếng Anh buổi tối cho cán bộ, nhân viên", author: "Ngô Bích Ngọc", time: "2 giờ trước", replies: 15, tag: "Góp ý" }],
};

export const NOTICE_FB = {
  content: "Cắt điện lưới khu vực Hóc Môn từ 22:00 hôm nay đến 04:00 ngày mai — các đội bố trí máy phát cho 14 trạm trọng điểm.",
};

export const PHOTOS = [
  { t: "Diễn tập ứng cứu thông tin mùa mưa bão", by: "Tổ KV1", votes: 64, c: RED },
  { t: "Ca đêm trên đỉnh cột 42m", by: "Phạm Minh Tuấn", votes: 91, c: "#15181F" },
  { t: "Ngày hội hiến máu", by: "Công đoàn", votes: 58, c: RED_DARK },
  { t: "Giải bóng đá truyền thống 2026", by: "Đoàn Thanh niên", votes: 73, c: AMBER },
];

export const VALUES_8 = [
  "Thực tiễn là tiêu chuẩn kiểm nghiệm chân lý",
  "Trưởng thành qua những thách thức và thất bại",
  "Thích ứng nhanh là sức mạnh cạnh tranh",
  "Sáng tạo là sức sống",
  "Tư duy hệ thống",
  "Kết hợp Đông – Tây",
  "Truyền thống và cách làm người lính",
  "Viettel là ngôi nhà chung",
];

/* ------------------------------- Số liệu Dashboard ------------------------ */

export const D_KPI = [
  { m: "T1", kh: 100, th: 92 }, { m: "T2", kh: 100, th: 88 }, { m: "T3", kh: 100, th: 96 },
  { m: "T4", kh: 100, th: 101 }, { m: "T5", kh: 100, th: 97 }, { m: "T6", kh: 100, th: 99 },
  { m: "T7", kh: 100, th: 106 }, { m: "T8", kh: 100, th: 94 },
];

export const D_WO = [
  { m: "T3", giao: 1120, xong: 1002 }, { m: "T4", giao: 1210, xong: 1145 },
  { m: "T5", giao: 1305, xong: 1189 }, { m: "T6", giao: 1288, xong: 1210 },
  { m: "T7", giao: 1402, xong: 1284 }, { m: "T8", giao: 640, xong: 588 },
].map((d) => ({ ...d, ty: Math.round((d.xong / d.giao) * 1000) / 10 }));

export const D_PAKH = [
  { m: "T3", nhan: 210, xuly: 198 }, { m: "T4", nhan: 245, xuly: 240 },
  { m: "T5", nhan: 268, xuly: 255 }, { m: "T6", nhan: 231, xuly: 228 },
  { m: "T7", nhan: 254, xuly: 251 }, { m: "T8", nhan: 118, xuly: 106 },
];

export const D_FUEL = [
  { t: "Tổ KV1", dm: 4200, tt: 3980 }, { t: "Tổ KV2", dm: 3800, tt: 4110 },
  { t: "Tổ KV3", dm: 3500, tt: 3320 }, { t: "Đội cơ động", dm: 2600, tt: 2540 },
  { t: "Khối VP", dm: 900, tt: 720 },
];

export const D_HIRE = [
  { b: "Nhu cầu", v: 48 }, { b: "Ứng tuyển", v: 214 }, { b: "Phỏng vấn", v: 96 },
  { b: "Đạt", v: 41 }, { b: "Đã nhận việc", v: 33 },
];

export const D_OUT = [
  { m: "T3", v: 18.2 }, { m: "T4", v: 20.5 }, { m: "T5", v: 22.1 },
  { m: "T6", v: 21.4 }, { m: "T7", v: 25.8 }, { m: "T8", v: 12.3 },
];

export const D_NET = [
  { m: "01/08", av: 99.82, sc: 14 }, { m: "02/08", av: 99.9, sc: 9 },
  { m: "03/08", av: 99.76, sc: 18 }, { m: "04/08", av: 99.88, sc: 11 },
  { m: "05/08", av: 99.94, sc: 6 }, { m: "06/08", av: 99.91, sc: 8 },
  { m: "07/08", av: 99.87, sc: 10 },
];

export const KPI_CARDS = [
  { label: "Hoàn thành KPI tháng", value: "94,2", unit: "%", delta: 3.1, sub: "Kế hoạch 90%" },
  { label: "WO đúng hạn", value: "1.284", unit: "/1.402", delta: 5.4, sub: "Tỷ lệ 91,6%" },
  { label: "PAKH tồn quá hạn", value: "12", unit: "phiếu", delta: -38.0, sub: "Giảm so với tháng 6" },
  { label: "Chất lượng mạng", value: "99,87", unit: "%", delta: 0.12, sub: "Availability trung bình" },
];
