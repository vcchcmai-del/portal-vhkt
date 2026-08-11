# Bản cập nhật — sửa lỗi tạo tài khoản và hoàn thiện thiết kế

## 1. Lỗi "Không kết nối được máy chủ" khi tạo tài khoản

### Nguyên nhân
Thông báo lỗi cũ hiện chung chung mỗi khi máy chủ trả về thứ không phải JSON đúng dạng.
Nó che mất nguyên nhân thật.

Hai nguyên nhân thường gặp khi gặp thông báo này:

1. **Mật khẩu dưới 8 ký tự.** Máy chủ từ chối, nhưng giao diện cũ không hiện lý do.
   Trong ảnh bạn gửi, mật khẩu nhập là `123456` — chỉ 6 ký tự.
2. **Máy chủ đang chạy bản cũ hơn**, chưa có đường dẫn quản lý tài khoản.

### Đã sửa
- Giao diện kiểm tra ngay tại chỗ trước khi gửi: tên tài khoản, độ dài mật khẩu, họ tên.
- Ô mật khẩu hiện bộ đếm `n / 8 ký tự`, xanh khi đủ, đỏ khi thiếu.
- Thông báo lỗi từ máy chủ được diễn giải đúng: phân biệt 404, 405, 500, lỗi kiểm tra dữ liệu,
  và trường hợp máy chủ trả về trang HTML thay vì dữ liệu.

### Nếu vẫn gặp lỗi sau khi cập nhật
Thông báo mới sẽ nói rõ mã lỗi. Đối chiếu bảng sau:

| Thông báo | Nghĩa là | Xử lý |
|---|---|---|
| Mật khẩu phải có ít nhất 8 ký tự | Nhập mật khẩu dài hơn | Nhập lại |
| Tài khoản "x" đã tồn tại | Trùng tên đăng nhập | Đổi tên khác |
| Máy chủ không có đường dẫn này (404) | Máy chủ chạy bản cũ | Deploy lại bằng bộ mã nguồn mới |
| Máy chủ từ chối kiểu yêu cầu này (405) | Trang đang chạy dạng tệp tĩnh | Chạy cả phần xử lý dữ liệu |
| Chức năng này chỉ dành cho quản trị viên | Tài khoản là biên tập viên | Đăng nhập bằng `admin` |

## 2. Thiết kế trang chủ

Đã trả lại đúng bản thiết kế được duyệt:

- Sáu ô chỉ số dùng biểu tượng đồ hoạ thật thay cho ký tự lắp ghép.
- Phần Lịch công tác và Tin nổi bật phía dưới dùng chung ngôn ngữ thiết kế với phần trên:
  cùng bo góc 18px, cùng đổ bóng, cùng kiểu tiêu đề chữ hoa.
- Banner tự chuyển 6 giây một lần, chấm tròn bấm được để chuyển tay.

## 3. Tài khoản mặc định

| Tài khoản | Mật khẩu | Quyền |
|---|---|---|
| admin | viettel@2026 | Quản trị viên |
| luongdv | viettel@2026 | Biên tập viên |
| linhbn | viettel@2026 | Nhân viên |

Quên mật khẩu: `python reset_password.py admin MatKhauMoi`.
