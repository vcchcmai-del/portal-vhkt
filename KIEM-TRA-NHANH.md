# Kiểm tra nhanh: máy chủ có đang chạy đúng bản không

Mỗi lần triển khai xong, mở đường dẫn này trên trình duyệt:

```
https://<tên-miền>/api/health
```

Kết quả đúng phải như sau:

```json
{
  "status": "ok",
  "database": "ok",
  "api_version": 5,
  "features": ["thread_detail", "meeting_info", "news_body",
               "idea_body", "bulk_import", "sheet_source", "diagnostics"],
  "build": "..."
}
```

## Đọc kết quả

| Nhìn thấy | Nghĩa là | Làm gì |
|---|---|---|
| `api_version: 5` và `database: ok` | Đúng bản, mọi thứ bình thường | Không phải làm gì |
| `api_version` nhỏ hơn 5, hoặc không có trường này | **Máy chủ chạy bản cũ** | Triển khai lại phần máy chủ |
| `database: "error"` | Ứng dụng sống nhưng chưa nối được cơ sở dữ liệu | Kiểm tra `DATABASE_URL` |
| Trang lỗi 404 hoặc trang trắng | Phần xử lý dữ liệu chưa chạy | Xem lại cấu hình triển khai |
| `startup_ok: false` | Có bước khởi động lỗi | Đọc `startup_errors` để biết bước nào |
| Lỗi **502** ở mọi thao tác | Tiến trình ứng dụng chết | Xem mục dưới |

## Lỗi 502 nghĩa là gì

502 là lỗi cổng: nền tảng không nhận được phản hồi từ ứng dụng. Khác hẳn 404
(sai đường dẫn) hay 503 (cơ sở dữ liệu bận). Ba nguyên nhân thường gặp:

1. **Ứng dụng chết ngay khi khởi động.** Trước đây chỉ cần một bước chuẩn bị cơ sở
   dữ liệu lỗi là cả tiến trình không lên được. Từ bản này, mọi bước khởi động đều
   bọc chống lỗi: hỏng bước nào thì báo bước đó ở `startup_errors`, ứng dụng vẫn chạy.
2. **Hết bộ nhớ.** Kiểm tra mức sử dụng RAM trên bảng điều khiển nền tảng.
3. **Khởi động quá lâu nên bị nền tảng cắt.** Xem nhật ký có dòng timeout không.

## Vì sao cần kiểm tra

Cổng thông tin gồm hai phần triển khai riêng: **giao diện** (thư mục `backend/static`)
và **phần xử lý** (thư mục `backend/app`). Nếu chỉ một phần được cập nhật, giao diện
sẽ có nút bấm cho chức năng mà máy chủ chưa có, bấm vào báo **"Not Found"**.

Từ bản này, hệ thống tự phát hiện: giao diện đối chiếu `api_version` với phiên bản
nó cần, lệch thì hiện dải vàng ngay đầu trang thay vì để người dùng tự đoán.

## Nếu máy chủ chạy bản cũ

Nguyên nhân thường gặp trên nền tảng hosting:

1. **Triển khai thất bại nhưng bản cũ vẫn chạy.** Xem lại nhật ký triển khai, tìm
   dòng đỏ báo lỗi.
2. **Nền tảng dùng lại ảnh đã dựng trước đó.** Tìm tuỳ chọn dựng lại không dùng bộ
   nhớ đệm, hoặc đổi một dòng bất kỳ trong `backend/Dockerfile` để buộc dựng mới.
3. **Chỉ tải lên thư mục giao diện.** Phải tải lên cả bộ mã nguồn, không chỉ `static`.

## Sau khi triển khai lại

Đăng nhập tài khoản quản trị, vào **Quản trị → Kiểm tra hệ thống**. Màn hình hiện
phiên bản API và chạy thử 16 phần của hệ thống. Cả ba con số ở đầu bằng 0 lỗi là đạt.
