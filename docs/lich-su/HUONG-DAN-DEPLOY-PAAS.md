# CNCT HCM Portal - Hướng dẫn deploy hosting hiện tại

## Vì sao bản này khác bản trước?

Log của hosting cho biết Stage 4 chạy:

    docker compose ... build
    Image ...-backend Building
    /build/v1/backend/Dockerfile: no such file or directory

Nghĩa là hosting đang dùng `docker-compose.yml` và yêu cầu service `backend` phải build từ `./backend/Dockerfile`.

Bản này đã khớp chính xác với cơ chế đó.

## Cấu trúc deploy

- `docker-compose.yml` -> service `backend`
- `backend/Dockerfile` -> Dockerfile được build
- FastAPI + Uvicorn nghe `0.0.0.0:8000`
- Không có Nginx trong container
- Không có frontend container riêng
- Giao diện đã build sẵn trong `backend/static`
- SQLite được dùng mặc định nếu không khai báo `DATABASE_URL`

## Cấu hình hosting

Nếu hosting cho chọn Compose file: chọn `docker-compose.yml` ở thư mục gốc.

Port: `8000`.

Không chọn `frontend/Dockerfile`.
Không cần nhập Start Command riêng nếu hosting chạy Docker Compose.

## Sau deploy

Kiểm tra:

`https://vcchcm.com/api/health`

Kết quả mong muốn là HTTP 200 và JSON có `status: ok`.
