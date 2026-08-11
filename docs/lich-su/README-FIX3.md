# CNCT HCM Portal - FIX3

## Lỗi đã sửa
Bản trước chỉ tạo tài khoản khi bảng `people` rỗng. Nếu database đã có dữ liệu nhưng thiếu `users`, tài khoản `admin` không được tạo và giao diện báo "Sai tài khoản hoặc mật khẩu".

FIX3 tách bước bootstrap tài khoản khỏi seed dữ liệu mẫu. Mỗi lần khởi động sẽ:
- tạo `admin` nếu chưa tồn tại;
- tạo `luongdv` và `linhbn` nếu chưa tồn tại;
- không ghi đè mật khẩu các tài khoản đã tồn tại.

## Đăng nhập lần đầu
- Tài khoản: `admin`
- Mật khẩu: `viettel@2026`

## Nếu admin đã tồn tại nhưng quên mật khẩu
Trong container chạy:
`python reset_password.py admin MatKhauMoi`

Hoặc nếu nền tảng cho phép exec shell:
`python /app/reset_password.py admin MatKhauMoi`

## Kiểm tra API
Mở `/api/health`.
Sau khi login, mở `/api/auth/me` với Bearer token.
