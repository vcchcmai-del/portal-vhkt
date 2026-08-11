# Nối cổng thông tin với Google Sheet

Mục đích: người phụ trách số liệu chỉ cần sửa bảng tính quen thuộc, cổng thông tin tự cập nhật theo. Không phải vào phần quản trị gõ lại từng con số.

Cổng thông tin lấy lại số liệu chậm nhất **10 phút** một lần. Muốn cập nhật ngay thì bấm nút **Đồng bộ** trong màn hình quản trị.

---

## 1. Lấy đường dẫn từ Google Sheets

1. Mở bảng tính trên Google Sheets.
2. Vào **Tệp → Chia sẻ → Đăng lên web**.
3. Ô thứ nhất chọn trang tính cần dùng. Ô thứ hai chọn **Giá trị được phân tách bằng dấu phẩy (.csv)**.
4. Bấm **Đăng**, sao chép đường dẫn hiện ra.
5. Vào cổng thông tin: **Quản trị → Nguồn dữ liệu Sheet → Thêm nguồn**, dán vào, bấm **Kiểm tra đường dẫn** để xem thử rồi **Lưu lại**.

Dán đường dẫn bảng tính thông thường cũng được, hệ thống tự chuyển đổi.

---

## 2. Ba loại bảng tính

### 2.1. Chỉ số trang chủ

Sáu ô số liệu lớn trên trang chủ. Dòng 1 và 2 là hai ô lớn, bốn dòng sau là bốn ô nhỏ.

| ma | nhan | gia_tri | don_vi | muc_tieu | ghi_chu | mau | tien_do |
|---|---|---|---|---|---|---|---|
| kpi | HOÀN THÀNH KPI THÁNG | 94 | % | Mục tiêu: 100% | | green | 94 |
| wo_dung_han | WO ĐÚNG HẠN | 2,15 | % | Mục tiêu: ≤ 3% | Đạt | orange | |
| tien_phat | TIỀN PHẠT THÁNG | 1.500.000 | đ | Mục tiêu: 0 đ | | blue | |
| su_co_ngay | SỰ CỐ NGÀY | 7 | | | Hôm nay | purple | |
| wo_qua_han | WO QUÁ HẠN | 15 | | | Quá hạn | orange | |
| an_toan | AN TOÀN | 100 | % | | Không sự cố | teal | |

- **ma**: mã cố định, quyết định biểu tượng hiển thị. Giữ nguyên sáu mã trên.
- **mau**: `green`, `orange`, `blue`, `purple`, `teal`.
- **tien_do**: số từ 0 đến 100, có thì hiện thanh tiến độ. Để trống thì hiện dấu tích kèm nội dung ô `ghi_chu`.

### 2.2. Số liệu Dashboard

| bang | ky | chi_tieu | don_vi | gia_tri |
|---|---|---|---|---|
| WO | 2026-07 | Được giao | | 1.402 |
| WO | 2026-07 | Hoàn thành | | 1.284 |
| KPI | 2026-07 | Kế hoạch | | 100 |
| KPI | 2026-07 | Thực hiện | | 106 |
| FUEL | 2026-07 | Định mức | Tổ KV1 | 4.200 |
| FUEL | 2026-07 | Thực chi | Tổ KV1 | 3.980 |

- **bang** nhận đúng bảy giá trị: `KPI`, `WO`, `PAKH`, `FUEL`, `HIRE`, `OUTPUT`, `NETWORK`.
- **ky**: kỳ số liệu, ví dụ `2026-07`.
- **don_vi**: tên đơn vị hoặc tổ. Dùng cho các bảng so sánh giữa các đơn vị như nhiên liệu.
- Bảng nào chưa có trong sheet thì vẫn lấy số liệu trong hệ thống.

### 2.3. Lịch công tác

| ngay | gio | noi_dung | dia_diem | chu_tri |
|---|---|---|---|---|
| 08/08/2026 | 07:30 | Giao ban tuần Phòng VHKT | Phòng họp 301 | Ban Giám đốc |
| 08/08/2026 | 14:00 | Kiểm tra trạm HCM-1042 | Quận 12 | Tổ KV1 |
| 09/08/2026 | 08:00 | Nghiệm thu cáp ngầm | Bình Chánh | Tổ KV2 |

Nhập lịch cả tuần vào một bảng. Trang chủ tự lọc ra đúng việc của ngày hôm nay.

Ngày viết theo dạng `08/08/2026` hoặc `2026-08-08`.

---

## 3. Cách viết số

Hệ thống hiểu cách viết số của Việt Nam:

| Viết trong sheet | Hiểu thành |
|---|---|
| `1.402` | 1402 |
| `1.500.000` | 1500000 |
| `94,2` | 94,2 |
| `1,28` | 1,28 |
| `12.500 đ` | 12500 |

Quy tắc: dấu chấm đứng trước đúng ba chữ số được hiểu là ngăn nghìn. Các trường hợp còn lại hiểu là dấu thập phân.

---

## 4. Khi có lỗi

Màn hình **Nguồn dữ liệu Sheet** hiện rõ trạng thái từng nguồn. Nguồn lỗi có nhãn đỏ kèm lý do.

| Báo lỗi | Nguyên nhân | Xử lý |
|---|---|---|
| Google từ chối truy cập | Bảng tính chưa đăng lên web | Làm lại mục 1 |
| Không tìm thấy bảng tính | Đường dẫn sai | Sao chép lại đường dẫn |
| Thiếu cột … | Tên cột không đúng | Sửa dòng tiêu đề trong sheet cho khớp |
| Không đọc được dòng nào hợp lệ | Cột `bang` viết sai | Chỉ dùng bảy giá trị đã nêu |
| Trả về trang web chứ không phải CSV | Chọn nhầm định dạng khi đăng | Chọn lại định dạng .csv |

---

## 5. Lưu ý khi giao việc

Người sửa bảng tính không cần tài khoản cổng thông tin. Nhưng cần dặn họ:

- Không đổi tên các cột ở dòng đầu.
- Không xoá cột, kể cả cột đang để trống.
- Thêm dòng mới thì thêm xuống dưới, không chèn vào giữa phần tiêu đề.
- Ai sửa được bảng tính là sửa được số liệu hiện trên cổng thông tin. Chỉ chia sẻ quyền sửa cho người có trách nhiệm.
