# Nhập dữ liệu hàng loạt

Vào **Quản trị → Nhập dữ liệu hàng loạt**. Dùng khi cần thêm hoặc sửa nhiều dòng cùng lúc thay vì gõ tay từng bản ghi.

Bốn nhóm dữ liệu nhập được:

| Nhóm | Dùng để | Ai được nhập |
|---|---|---|
| Tài khoản đăng nhập | Cấp tài khoản cho cả phòng cùng lúc | Chỉ quản trị viên |
| Hồ sơ nhân viên | Danh sách nhân sự, ngày sinh | Biên tập viên trở lên |
| Lịch công tác tuần | Lịch cả tuần trong một lần | Biên tập viên trở lên |
| Số liệu Dashboard | Chỉ số KPI, WO, tiền phạt, nhiên liệu | Biên tập viên trở lên |

---

## Cách nhanh nhất: sao chép từ Excel

1. Mở bảng tính Excel hoặc Google Sheets.
2. Bôi đen cả vùng dữ liệu **kèm dòng tiêu đề**.
3. Nhấn Ctrl+C.
4. Vào màn hình nhập, chọn nhóm dữ liệu, dán vào ô lớn bằng Ctrl+V.
5. Bấm **Xem trước kết quả**.
6. Kiểm tra bảng kết quả, thấy đúng thì bấm **Xác nhận ghi**.

Không cần lưu tệp, không cần đổi định dạng.

Cách khác: bấm **Chọn tệp CSV hoặc Excel** để tải tệp `.csv`, `.xlsx` lên.

### Tệp mẫu Excel

Chưa biết bắt đầu từ đâu thì bấm **Tải tệp mẫu Excel**. Tệp gồm hai trang:

- **Du lieu** — dòng tiêu đề đúng chuẩn, một dòng ví dụ, cột bắt buộc tô đỏ, dòng tiêu đề được khoá nên cuộn xuống vẫn nhìn thấy.
- **Huong dan** — giải thích từng cột và bảy bước sử dụng.

Điền dữ liệu từ dòng 2, xoá dòng ví dụ, rồi tải ngược lên. Vẫn có nút tải tệp mẫu CSV cho ai quen dùng.

---

## Nguyên tắc quan trọng

**Luôn xem trước rồi mới ghi.** Bấm Xem trước không thay đổi gì trong hệ thống. Bảng kết quả cho biết từng dòng sẽ:

| Trạng thái | Nghĩa là |
|---|---|
| Thêm mới | Chưa có, sẽ tạo bản ghi mới |
| Cập nhật | Đã có, sẽ ghi đè thông tin cũ |
| Bỏ qua | Đã có nhưng đang chọn chế độ chỉ thêm mới |
| Lỗi | Dữ liệu sai, sẽ không ghi. Có ghi rõ lý do |

**Một dòng lỗi không làm hỏng cả tệp.** Các dòng đúng vẫn nhập được bình thường.

**Nhập lại cùng một tệp không tạo bản trùng.** Hệ thống nhận ra bản ghi cũ theo khoá:

| Nhóm | Nhận ra bản cũ theo |
|---|---|
| Tài khoản | cột `tai_khoan` |
| Nhân viên | cột `email` |
| Lịch công tác | trùng cả ngày, giờ và nội dung |
| Số liệu | trùng cả bảng, kỳ, chỉ tiêu và đơn vị |

---

## Cấu trúc từng nhóm

Tên cột phải viết đúng như bên dưới ở dòng đầu tiên. Cột đánh dấu **bắt buộc** không được bỏ trống.

### Tài khoản đăng nhập

| Cột | Ý nghĩa | Ví dụ |
|---|---|---|
| `tai_khoan` **bắt buộc** | Tên đăng nhập | luongdv |
| `ho_ten` **bắt buộc** | Họ tên hiển thị | Đoàn Văn Lương |
| `quyen` **bắt buộc** | admin / editor / staff | editor |
| `mat_khau` | Ít nhất 8 ký tự. Bỏ trống khi cập nhật để giữ mật khẩu cũ | VhktHcm2026 |

### Hồ sơ nhân viên

| Cột | Ý nghĩa | Ví dụ |
|---|---|---|
| `ho_ten` **bắt buộc** | Họ và tên | Phạm Minh Tuấn |
| `email` **bắt buộc** | Dùng làm khoá nhận diện | tuanpm@viettel.com.vn |
| `chuc_vu` | Chức vụ | Tổ trưởng Ứng cứu thông tin |
| `don_vi` | Phòng ban | Phòng Vận hành khai thác |
| `dien_thoai` | Số điện thoại | 0982111011 |
| `ngay_sinh` | dd/mm/yyyy | 08/08/1992 |
| `dang_lam` | co / khong | co |

Ngày sinh nhập ở đây sẽ tự hiện ở mục Sinh nhật trên trang chủ và Góc văn hoá.

### Lịch công tác tuần

| Cột | Ý nghĩa | Ví dụ |
|---|---|---|
| `ngay` **bắt buộc** | dd/mm/yyyy | 08/08/2026 |
| `noi_dung` **bắt buộc** | Nội dung công việc | Giao ban tuần Phòng VHKT |
| `gio` | hh:mm, bỏ trống thì mặc định 08:00 | 07:30 |
| `dia_diem` | Địa điểm | Phòng họp 301 |
| `chu_tri` | Đơn vị chủ trì | Ban Giám đốc |
| `thanh_phan` | Thành phần tham gia | Ban Giám đốc, Trưởng các phòng |
| `hinh_thuc` | Hình thức họp | cau_truyen_hinh |
| `thong_tin_hop` | IP điểm cầu hoặc đường dẫn phòng họp | 10.255.58.3 |
| `ma_hop` | Mã phòng họp | 812 3456 7890 |
| `mat_khau_hop` | Mật khẩu phòng họp | vhkt2026 |

Nhập lịch cả tuần một lần, trang chủ tự lọc ra việc của ngày hôm nay.

#### Hình thức họp

Cột `hinh_thuc` nhận sáu giá trị:

| Giá trị | Nghĩa | Cột `thong_tin_hop` cần điền gì |
|---|---|---|
| `truc_tiep` | Họp trực tiếp | Để trống, ghi phòng họp ở cột `dia_diem` |
| `cau_truyen_hinh` | Cầu truyền hình | **Bắt buộc** — địa chỉ IP điểm cầu, ví dụ `10.255.58.3`. Kèm cổng cũng được: `10.255.58.3:5060` |
| `zoom` | Zoom | **Bắt buộc** — đường dẫn phòng họp, bắt đầu bằng `https://` |
| `google_meet` | Google Meet | **Bắt buộc** — đường dẫn phòng họp |
| `teams` | Microsoft Teams | **Bắt buộc** — đường dẫn phòng họp |
| `khac` | Hình thức khác | Tuỳ, ghi gì cũng được |

Viết tiếng Việt có dấu cũng được: `cầu truyền hình`, `trực tiếp`, `Google Meet` đều nhận ra.

Hệ thống kiểm tra ngay khi nhập: cầu truyền hình mà IP sai định dạng, hoặc Zoom mà
dán IP thay vì đường dẫn, đều bị báo lỗi kèm lý do.

Trên trang chủ, họp trực tuyến hiện nút **Vào phòng họp** bấm là mở thẳng;
cầu truyền hình hiện địa chỉ IP bấm một cái là sao chép.

### Số liệu Dashboard

| Cột | Ý nghĩa | Ví dụ |
|---|---|---|
| `bang` **bắt buộc** | KPI / WO / PAKH / FUEL / HIRE / OUTPUT / NETWORK | WO |
| `ky` **bắt buộc** | Kỳ số liệu | 2026-08 |
| `chi_tieu` **bắt buộc** | Tên chỉ tiêu | Hoàn thành |
| `gia_tri` **bắt buộc** | Giá trị | 1.284 |
| `don_vi` | Tên tổ hoặc đơn vị | Tổ KV1 |

Số viết theo cách Việt Nam: `1.284` hiểu là 1284, `94,2` hiểu là 94,2.

---

## Nhập hàng loạt hay nối Google Sheet

Hai cách này bổ sung cho nhau, không thay thế nhau:

| | Nhập hàng loạt | Nối Google Sheet |
|---|---|---|
| Dữ liệu nằm ở | Trong hệ thống | Trên Google Sheet |
| Cập nhật | Khi nào nhập thì đổi | Tự động, chậm nhất 10 phút |
| Hợp với | Nhân viên, tài khoản — ít thay đổi | KPI, lịch tuần — đổi thường xuyên |
| Cần gì | Không cần gì thêm | Phải giữ bảng tính luôn đúng cấu trúc |

Gợi ý: nhân viên và tài khoản dùng nhập hàng loạt. Số liệu Dashboard và lịch tuần nối Google Sheet để khỏi phải nhập lại mỗi tuần.

---

## Khi gặp lỗi

| Báo lỗi | Xử lý |
|---|---|
| Thiếu cột bắt buộc | Tải tệp mẫu, chép đúng dòng tiêu đề |
| Ngày sinh không đọc được | Đổi ô ngày trong Excel sang dạng chữ, viết 08/08/1992 |
| Tài khoản mới cần mật khẩu ít nhất 8 ký tự | Đặt mật khẩu dài hơn |
| Quyền không hợp lệ | Chỉ dùng admin, editor hoặc staff |
| Bảng không hợp lệ | Chỉ dùng bảy giá trị đã liệt kê |
| Trùng với một dòng phía trên | Trong tệp có hai dòng cùng khoá, xoá bớt một |
| Máy chủ chưa cài thư viện đọc Excel | Lưu tệp sang CSV, hoặc dán trực tiếp từ Excel |

Giới hạn: 2000 dòng và 6 MB mỗi lần. Nhiều hơn thì chia ra nhập nhiều lần.
