# Triển khai sạch — làm một lần cho ổn định

Đọc trước khi bấm Deploy. Mất 10 phút, đổi lại hết cảnh mỗi lần đẩy bản mới lại
phát sinh lỗi lạ.

---

## Vì sao đang không ổn định

Nhìn bảng triển khai: 10 phiên bản, có bản thất bại, nhiều bản cùng ghi "Trực tuyến".
Cộng với giao diện đang chạy là bố cục cũ. Ba dấu hiệu này chỉ về cùng một điều:

**Không ai biết chắc bản nào đang thực sự phục vụ.**

Nguyên nhân không nằm ở nền tảng. Nó nằm ở cách làm: mỗi lần phát hiện lỗi lại đẩy
một bản vá mới, chồng lên bản chưa kịp kiểm tra. Càng nhiều phiên bản càng khó biết
mình đang sửa cái gì trên nền cái gì.

Từ bản này có hai thứ giúp cắt vòng lặp đó:

1. **Chân trang hiện dấu hiệu bản dựng của cả hai phía.** Ví dụ:
   `Giao diện 2026-08-09.v8 · Máy chủ 2026-08-09.v8`. Lệch nhau thì chữ chuyển đỏ
   kèm chữ **LỆCH BẢN**. Nhìn một cái là biết.
2. **`/api/health` báo `build`, `api_version`, `startup_ok`.** Không phải đoán nữa.

---

## Khi thấy "bấm không có phản hồi gì"

Đây là triệu chứng thường gặp nhất và trước đây khó tìm nhất, vì trang vẫn hiện
nội dung nên nhìn như bình thường.

Nguyên nhân gần như luôn là một trong ba:

1. **Giao diện đã chết ngầm.** Một lỗi JavaScript làm React ngừng xử lý sự kiện.
   Nội dung đã vẽ vẫn nằm đó nhưng không còn phản ứng với thao tác nào.
2. **Trình duyệt giữ bản cũ.** Đang chạy tệp giao diện của bản trước, gọi tới
   đường dẫn máy chủ không còn tồn tại.
3. **Máy chủ không phản hồi.** Mọi lời gọi dữ liệu đều thất bại trong im lặng.

### Cách xử lý, theo thứ tự

**Bước 1.** Nhấn `Ctrl + F5` để tải lại bỏ qua bộ nhớ đệm. Riêng cách này giải quyết
được phần lớn trường hợp thứ hai.

**Bước 2.** Kéo xuống chân trang, bấm **Kiểm tra tình trạng hệ thống**. Bảng hiện ra
kiểm tra sáu mục và đánh dấu rõ mục nào hỏng:

- Kết nối tới máy chủ
- Cơ sở dữ liệu
- Khởi động máy chủ
- Phiên bản giao diện và máy chủ có khớp không
- Phiên bản API
- Lỗi giao diện đã ghi nhận

**Bước 3.** Bấm **Sao chép để gửi người phụ trách**, dán vào tin nhắn. Nội dung sao
chép gồm cả phiên bản hai phía, tình trạng cơ sở dữ liệu và năm lỗi gần nhất — đủ để
tìm nguyên nhân mà không cần hỏi lại.

Bảng này ai cũng mở được, không cần đăng nhập. Chính vì lúc hỏng thì thường không
đăng nhập được.

### Nếu giao diện hỏng nặng

Trước đây gặp lỗi khi vẽ giao diện thì trang trắng hoặc đứng im. Từ bản này sẽ hiện
một màn hình báo lỗi có nội dung lỗi cụ thể, kèm hai nút: **Tải lại trang** và
**Xoá dữ liệu tạm rồi tải lại**. Nút thứ hai xử lý trường hợp phiên đăng nhập cũ
gây xung đột với bản mới.

---

## Quy trình triển khai sạch

### Bước 1 — Sao lưu dữ liệu đang có

Nếu cổng thông tin đã có dữ liệu thật (tin bài, nhân viên, tài liệu), sao lưu trước.

Đăng nhập quản trị → **Cấu hình website** → **Tải tệp cơ sở dữ liệu**.

Dùng PostgreSQL thì chạy trên máy chủ: `bash backup.sh`

Bỏ qua bước này nếu mới chỉ có dữ liệu mẫu.

### Bước 2 — Xoá các phiên bản cũ

Trên bảng điều khiển, giữ lại **một phiên bản đang chạy tốt nhất**, xoá hết phần
còn lại. Danh sách 10 phiên bản không giúp gì mà chỉ gây rối.

### Bước 3 — Tải lên bộ mã nguồn mới, dựng lại từ đầu

Dùng **Cập nhật source mới**, tải nguyên gói `portal-cnct.zip` mới nhất.

Quan trọng: tìm tuỳ chọn **dựng lại không dùng bộ nhớ đệm** nếu nền tảng có. Không có
thì sửa một dòng bất kỳ trong `backend/Dockerfile` (thêm một dòng chú thích) để buộc
dựng mới.

### Bước 4 — Chờ dựng xong, KHÔNG đẩy bản khác chồng lên

Đây là chỗ hay hỏng nhất. Đẩy bản mới khi bản trước chưa dựng xong sẽ tạo ra tình
trạng nửa vời.

### Bước 5 — Kiểm tra ba thứ, theo đúng thứ tự

**5.1.** Mở `https://<tên-miền>/api/health`

```json
{
  "status": "ok",
  "database": "ok",
  "api_version": 6,
  "startup_ok": true,
  "build": "2026-08-09.v8"
}
```

Bốn trường đầu phải đúng như trên. Sai một trường thì dừng lại, xử lý xong mới đi tiếp.

**5.2.** Mở trang chủ, kéo xuống chân trang. Phải thấy:

```
Giao diện 2026-08-09.v8 · Máy chủ 2026-08-09.v8
```

Hai chuỗi trùng nhau và không có chữ LỆCH BẢN.

**5.3.** Đăng nhập `admin`, vào **Quản trị → Kiểm tra hệ thống**, bấm Kiểm tra.
Ba con số đầu phải là: 16 mục kiểm tra, **0 mục lỗi**, **0 bảng thiếu cột**.

### Bước 6 — Chỉ khi cả ba bước trên đạt mới báo anh em vào dùng

---

## Nếu một bước không đạt

| Hiện tượng | Nghĩa là | Xử lý |
|---|---|---|
| `/api/health` ra trang 404 | Phần xử lý chưa chạy | Xem nhật ký triển khai |
| `build` khác chuỗi mong đợi | Nền tảng dùng lại ảnh cũ | Dựng lại không dùng bộ nhớ đệm |
| Chân trang báo LỆCH BẢN | Chỉ một phần được cập nhật | Tải lại nguyên gói, không tải lẻ |
| `startup_ok: false` | Có bước khởi động lỗi | Đọc `startup_errors`, gửi tôi nội dung đó |
| `database: error` | Chưa nối được cơ sở dữ liệu | Kiểm tra biến `DATABASE_URL` |
| Bảng thiếu cột > 0 | Cấu trúc chưa cập nhật | Bấm "Bổ sung cột còn thiếu" trong Kiểm tra hệ thống |

---

## Đề nghị về cách làm việc tiếp theo

Trong hai tuần tới nên **dừng thêm tính năng mới**. Lý do: mỗi tính năng mới lại kéo
theo một vòng đẩy bản, mà hiện chưa có một lần triển khai nào được xác nhận đầy đủ
bằng ba bước kiểm tra ở trên.

Thứ tự nên làm:

1. Triển khai sạch một lần theo hướng dẫn này, xác nhận cả ba bước đều đạt.
2. Nhập dữ liệu thật: nhân viên, tài liệu, ứng dụng, lịch tuần.
3. Mở cho một phòng dùng thử một tuần, ghi lại góp ý.
4. Sau đó mới bổ sung tính năng, mỗi lần một thứ, kiểm tra xong mới làm tiếp.

Làm theo thứ tự này thì mỗi khi có lỗi, bạn biết chắc nó đến từ thay đổi nào.
