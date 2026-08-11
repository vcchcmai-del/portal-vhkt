# CNCT HCM — Stable PostgreSQL + Icon Applications

## Khuyến nghị production

Dùng `docker-compose.stable.yml`.

- PostgreSQL 16.
- Dữ liệu PostgreSQL: `./data/postgres`.
- Ảnh/icon: `./data/uploads`.
- Backup: `./data/backups`.
- Update code không xoá `data/`.
- Backend dùng connection pool + pre-ping + timeout + keepalive.

## PaaS một container

Nếu nền tảng không cho chạy PostgreSQL cùng compose, tạo PostgreSQL managed/external và đặt `DATABASE_URL` vào Environment. Không nên để production tự rơi về SQLite.

## Icon ứng dụng

Quản trị → Quản lý ứng dụng → Thêm/Sửa ứng dụng → **Biểu tượng ứng dụng**.

Có thể:
- Tải PNG/JPG/WEBP/GIF/SVG tối đa 8 MB.
- Hoặc dán URL ảnh.

Icon được lưu dưới `data/uploads`, còn database chỉ lưu URL. Vì vậy cập nhật code không làm mất icon.
