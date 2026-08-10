# Deploy Portal VHKT lên TinhGon

## Source
- Docker Compose chính: `docker-compose.yml`
- Service backend: `backend/Dockerfile`
- Port ứng dụng: `8000`
- Frontend đã build sẵn trong `backend/static`

## Biến môi trường tối thiểu
- `DATABASE_URL`: chuỗi PostgreSQL do TinhGon cung cấp
- `REQUIRE_POSTGRES=1`
- `SECRET_KEY`: chuỗi ngẫu nhiên dài
- `CORS_ORIGINS`: domain thật của website
- `ADMIN_INITIAL_PASSWORD`: mật khẩu admin ban đầu nếu CSDL chưa có tài khoản admin

## Lưu ý dữ liệu
Không đưa `data/portal.db`, `data/secret.key`, backup DB, upload và `.env` lên GitHub.
Database production nên dùng PostgreSQL của TinhGon. Các file upload cần lưu ở vùng persistent storage nếu nền tảng hỗ trợ.

## Health check
`/api/health`
