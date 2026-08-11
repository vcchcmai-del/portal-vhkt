# Cập nhật an toàn

1. Sao lưu: `bash backup-stable.sh`
2. **Không xoá `data/`**.
3. Build/deploy code mới: `docker compose -f docker-compose.stable.yml up -d --build`
4. Kiểm tra: `curl http://localhost:8000/api/health`
5. Phải thấy `status=ok`, `database=ok`.

PostgreSQL nằm ở `data/postgres`; ảnh/icon ở `data/uploads`; backup ở `data/backups`.

Nếu hosting PaaS chỉ cho một container, hãy tạo PostgreSQL bên ngoài và đặt biến `DATABASE_URL`. Không nên dùng SQLite cho production nhiều người dùng.
