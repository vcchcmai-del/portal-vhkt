#!/usr/bin/env bash
#
# Cài đặt Cổng thông tin nội bộ Chi nhánh Công trình Viettel.
#
# Cách dùng: chép cả thư mục portal-cnct lên máy chủ, rồi chạy:
#     cd portal-cnct
#     bash deploy.sh
#
# Script tự kiểm tra Docker, tự sinh mật khẩu và khoá bí mật, tự khởi chạy.

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
say()  { echo -e "${GREEN}==>${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
die()  { echo -e "${RED}[LỖI]${NC} $1"; exit 1; }

echo
echo "  CỔNG THÔNG TIN NỘI BỘ — CHI NHÁNH CÔNG TRÌNH VIETTEL"
echo "  Cài đặt tự động"
echo

# --------------------------------------------------- 1. Kiểm tra điều kiện
say "Bước 1/5: Kiểm tra Docker"

if ! command -v docker >/dev/null 2>&1; then
  die "Chưa cài Docker. Chạy lần lượt:
       sudo apt update
       sudo apt install -y docker.io docker-compose-plugin
       sudo usermod -aG docker \$USER
     Sau đó đăng xuất, đăng nhập lại rồi chạy lại script này."
fi

if ! docker compose version >/dev/null 2>&1; then
  die "Thiếu docker compose. Chạy: sudo apt install -y docker-compose-plugin"
fi

if ! docker info >/dev/null 2>&1; then
  die "Không chạy được Docker. Thường do tài khoản chưa thuộc nhóm docker.
     Chạy: sudo usermod -aG docker \$USER  rồi đăng xuất và đăng nhập lại."
fi

echo "    Docker: $(docker --version | cut -d, -f1)"

# --------------------------------------------------- 2. Cấu hình
say "Bước 2/5: Chuẩn bị file cấu hình"

if [ -f .env ]; then
  warn "Đã có file .env, giữ nguyên cấu hình cũ."
else
  DB_PASS=$(openssl rand -hex 16 2>/dev/null || head -c 32 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 32)
  SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 64)

  cat > .env <<EOF
# Sinh tự động lúc $(date '+%d/%m/%Y %H:%M')
POSTGRES_USER=portal
POSTGRES_PASSWORD=${DB_PASS}
POSTGRES_DB=portal
SECRET_KEY=${SECRET}
CORS_ORIGINS=*
EOF
  chmod 600 .env
  echo "    Đã sinh mật khẩu cơ sở dữ liệu và khoá bí mật ngẫu nhiên."
  echo "    Hai giá trị này nằm trong file .env — giữ kín, không đưa lên Git."
fi

# --------------------------------------------------- 3. Kiểm tra cổng
say "Bước 3/5: Kiểm tra cổng mạng"

port_busy() { (command -v ss >/dev/null && ss -ltn 2>/dev/null | grep -q ":$1 ") || \
              (command -v netstat >/dev/null && netstat -ltn 2>/dev/null | grep -q ":$1 "); }

if port_busy 80; then
  warn "Cổng 80 đang được dùng bởi dịch vụ khác."
  warn "Cổng thông tin sẽ chạy ở cổng 8080 thay thế."
  sed -i 's|- "80:80"|- "8080:80"|' docker-compose.yml
  WEB_PORT=8080
else
  WEB_PORT=80
fi

# --------------------------------------------------- 4. Dựng và chạy
say "Bước 4/5: Dựng và khởi chạy (lần đầu mất 3-5 phút)"

docker compose up -d --build

# --------------------------------------------------- 5. Chờ và kiểm tra
say "Bước 5/5: Kiểm tra hệ thống"

echo -n "    Đang chờ backend sẵn sàng"
for i in $(seq 1 60); do
  if curl -fsS http://localhost:8000/api/health >/dev/null 2>&1; then
    echo " — xong."
    break
  fi
  echo -n "."
  sleep 2
  [ "$i" = 60 ] && { echo; die "Backend không phản hồi. Xem lỗi: docker compose logs backend"; }
done

FAIL=0
for ep in health people documents apps news; do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:8000/api/$ep" || echo 000)
  if [ "$CODE" = "200" ]; then
    printf "    [ OK ] /api/%s\n" "$ep"
  else
    printf "    [LỖI] /api/%s (HTTP %s)\n" "$ep" "$CODE"; FAIL=1
  fi
done

WEB_CODE=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:${WEB_PORT}/" || echo 000)
if [ "$WEB_CODE" = "200" ]; then
  echo "    [ OK ] Giao diện web"
else
  echo "    [LỖI] Giao diện web (HTTP $WEB_CODE)"; FAIL=1
fi

IP=$(hostname -I 2>/dev/null | awk '{print $1}')
[ -z "$IP" ] && IP="địa-chỉ-máy-chủ"

echo
if [ "$FAIL" = "0" ]; then
  echo -e "${GREEN}  CÀI ĐẶT THÀNH CÔNG${NC}"
else
  echo -e "${YELLOW}  CÀI ĐẶT XONG NHƯNG CÓ LỖI — xem: docker compose logs backend${NC}"
fi
echo
echo "  Cổng thông tin:  http://${IP}:${WEB_PORT}"
echo "  Tài liệu API:    http://${IP}:8000/docs"
echo
echo "  Tài khoản mẫu (ĐỔI MẬT KHẨU NGAY):"
echo "    admin  / viettel@2026   — quản trị"
echo "    hainv  / viettel@2026   — biên tập"
echo "    linhbn / viettel@2026   — nhân viên"
echo
echo "  Việc cần làm tiếp:"
echo "    1. Đổi mật khẩu ba tài khoản trên"
echo "    2. Thay dữ liệu mẫu bằng dữ liệu thật (backend/app/seed.py)"
echo "    3. Điền đường dẫn thật cho GNOC, NIMS, Portal Viettel"
echo "    4. Bật sao lưu hằng ngày: bash backup.sh"
echo
echo "  Lệnh hay dùng:"
echo "    docker compose ps              xem trạng thái"
echo "    docker compose logs -f backend xem lỗi"
echo "    docker compose restart         khởi động lại"
echo
