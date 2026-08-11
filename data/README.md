# DATA — Cổng thông tin nội bộ CNCT HCM

Thư mục này là vùng dữ liệu **không được xoá khi cập nhật code**.

- `postgres/`: dữ liệu PostgreSQL production khi dùng `docker-compose.stable.yml`.
- `uploads/`: ảnh/icon/bài viết tải lên.
- `backups/`: các bản sao lưu database.
- SQLite cũ (nếu còn dùng) nằm trong `portal.db` ở đây.

Khi update code: chỉ thay source/code/container, **không xoá thư mục `data/`**.

Khuyến nghị production: PostgreSQL + sao lưu định kỳ. Không đưa dữ liệu thật vào Git.
