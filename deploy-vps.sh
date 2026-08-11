#!/usr/bin/env bash
#
# Cài Cổng thông tin nội bộ lên máy chủ ảo (VPS) kèm HTTPS tự động.
#
# Trước khi chạy:
#   1. Đã có VPS Ubuntu 22.04 trở lên, biết địa chỉ IP.
#   2. Tên miền đã trỏ bản ghi A về địa chỉ IP đó (chờ 5-30 phút cho lan truyền).
#   3. Đã chép cả thư mục portal-cnct lên máy chủ.
#
# Chạy:  cd portal-cnct && bash deploy-vps.sh

set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
say()  { echo -e "${GREEN}==>${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
die()  { echo -e "${RED}[LỖI]${NC} $1"; exit 1; }

echo
echo "  CỔNG THÔNG TIN NỘI BỘ — CÀI ĐẶT TRÊN MÁY CHỦ ẢO"
echo

# ------------------------------------------------------- 1. Kiểm tra Docker
say "Bước 1/7: Kiểm tra Docker"

if ! command -v docker >/dev/null 2>&1; then
  warn "Chưa có Docker. Đang cài tự động…"
  sudo apt-get update -qq
  sudo apt-get install -y -qq ca-certificates curl gnupg
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update -qq
  sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  sudo usermod -aG docker "$USER"
  warn "Đã cài Docker. Hãy ĐĂNG XUẤT, ĐĂNG NHẬP LẠI rồi chạy lại script này."
  exit 0
fi

docker info >/dev/null 2>&1 || die "Không chạy được Docker. Chạy: sudo usermod -aG docker \$USER, rồi đăng xuất và đăng nhập lại."
echo "    $(docker --version | cut -d, -f1)"

# ------------------------------------------------------------ 2. Cấu hình
say "Bước 2/7: Thông tin cài đặt"

if [ -f .env ]; then
  # shellcheck disable=SC1091
  set -a; . ./.env; set +a
  echo "    Đã có file .env — dùng lại cấu hình cũ."
  echo "    Tên miền: ${SITE_DOMAIN:-chưa đặt}"
else
  read -rp "  Tên miền (ví dụ vcchcm.com, không kèm https://): " SITE_DOMAIN
  [ -n "$SITE_DOMAIN" ] || die "Chưa nhập tên miền."
  read -rp "  Email quản trị (để Let's Encrypt báo khi chứng chỉ sắp hết hạn): " ADMIN_EMAIL
  [ -n "$ADMIN_EMAIL" ] || die "Chưa nhập email."

  DB_PASS=$(openssl rand -hex 16)
  SECRET=$(openssl rand -hex 32)

  cat > .env <<EOF
# Sinh tự động lúc $(date '+%d/%m/%Y %H:%M')
SITE_DOMAIN=${SITE_DOMAIN}
ADMIN_EMAIL=${ADMIN_EMAIL}

POSTGRES_USER=portal
POSTGRES_PASSWORD=${DB_PASS}
POSTGRES_DB=portal

SECRET_KEY=${SECRET}
EOF
  chmod 600 .env
  echo "    Đã tạo .env với mật khẩu và khoá ngẫu nhiên."
fi

# ---------------------------------------------------- 3. Kiểm tra tên miền
say "Bước 3/7: Kiểm tra tên miền đã trỏ đúng chưa"

SERVER_IP=$(curl -fsS --max-time 8 https://api.ipify.org 2>/dev/null || echo "")
DOMAIN_IP=$(getent hosts "$SITE_DOMAIN" 2>/dev/null | awk '{print $1}' | head -1 || echo "")

echo "    IP máy chủ này : ${SERVER_IP:-không xác định được}"
echo "    IP tên miền    : ${DOMAIN_IP:-chưa phân giải được}"

if [ -n "$SERVER_IP" ] && [ -n "$DOMAIN_IP" ] && [ "$SERVER_IP" != "$DOMAIN_IP" ]; then
  warn "Tên miền chưa trỏ về máy chủ này. Chứng chỉ HTTPS sẽ xin không thành công."
  warn "Vào trang quản lý tên miền, tạo bản ghi A trỏ $SITE_DOMAIN về $SERVER_IP."
  read -rp "  Vẫn tiếp tục? (g/k): " ok
  [ "$ok" = "g" ] || exit 0
elif [ -z "$DOMAIN_IP" ]; then
  warn "Chưa phân giải được tên miền. Có thể do bản ghi mới tạo, cần chờ thêm."
  read -rp "  Vẫn tiếp tục? (g/k): " ok
  [ "$ok" = "g" ] || exit 0
else
  echo "    Tên miền đã trỏ đúng."
fi

# --------------------------------------------------------- 4. Tường lửa
say "Bước 4/7: Mở cổng 80 và 443"

if command -v ufw >/dev/null 2>&1; then
  sudo ufw allow 22/tcp  >/dev/null 2>&1 || true
  sudo ufw allow 80/tcp  >/dev/null 2>&1 || true
  sudo ufw allow 443/tcp >/dev/null 2>&1 || true
  echo "    Đã mở 22 (SSH), 80 (HTTP), 443 (HTTPS)."
  warn "Nhà cung cấp VPS có thể có tường lửa riêng — kiểm tra thêm trên trang quản trị của họ."
else
  warn "Không thấy ufw. Tự kiểm tra tường lửa của nhà cung cấp, mở cổng 80 và 443."
fi

# ------------------------------------------------------- 5. Dựng và chạy
say "Bước 5/7: Dựng và khởi chạy (lần đầu mất 4-8 phút)"

docker compose -f docker-compose.vps.yml up -d --build

# ---------------------------------------------------------- 6. Chờ sẵn sàng
say "Bước 6/7: Chờ hệ thống sẵn sàng"

echo -n "    Backend"
for i in $(seq 1 60); do
  if docker compose -f docker-compose.vps.yml exec -T backend python -c "import urllib.request;urllib.request.urlopen('http://localhost:8000/api/health')" >/dev/null 2>&1; then
    echo " — sẵn sàng."; break
  fi
  echo -n "."; sleep 2
  [ "$i" = 60 ] && { echo; die "Backend không phản hồi. Xem: docker compose -f docker-compose.vps.yml logs backend"; }
done

echo -n "    Chứng chỉ HTTPS (Let's Encrypt cần 20-60 giây)"
for i in $(seq 1 40); do
  if curl -fsS --max-time 5 "https://$SITE_DOMAIN/api/health" >/dev/null 2>&1; then
    echo " — đã cấp."; HTTPS_OK=1; break
  fi
  echo -n "."; sleep 3
done
echo

# -------------------------------------------------------------- 7. Kết quả
say "Bước 7/7: Kiểm tra"

FAIL=0
for ep in health apps documents news; do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "https://$SITE_DOMAIN/api/$ep" 2>/dev/null || echo 000)
  if [ "$CODE" = "200" ]; then printf "    [ OK ] /api/%s\n" "$ep"
  else printf "    [LỖI] /api/%s (HTTP %s)\n" "$ep" "$CODE"; FAIL=1; fi
done

WEB=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "https://$SITE_DOMAIN/" 2>/dev/null || echo 000)
[ "$WEB" = "200" ] && echo "    [ OK ] Giao diện web" || { echo "    [LỖI] Giao diện web (HTTP $WEB)"; FAIL=1; }

echo
if [ "$FAIL" = "0" ]; then
  echo -e "${GREEN}  CÀI ĐẶT THÀNH CÔNG${NC}"
  echo
  echo "  Cổng thông tin: https://$SITE_DOMAIN"
  echo "  Tài liệu API  : https://$SITE_DOMAIN/docs"
else
  echo -e "${YELLOW}  CÓ LỖI — xem nhật ký:${NC}"
  echo "  docker compose -f docker-compose.vps.yml logs caddy"
  echo "  docker compose -f docker-compose.vps.yml logs backend"
fi

echo
echo "  Tài khoản mặc định — ĐỔI MẬT KHẨU NGAY:"
echo "    admin / viettel@2026"
echo
echo "  Việc cần làm tiếp:"
echo "    1. Đăng nhập, vào Quản trị > Quản lý tài khoản, đổi mật khẩu cả 3 tài khoản"
echo "    2. Đặt lịch sao lưu:  crontab -e   rồi thêm:"
echo "       0 2 * * * cd $(pwd) && bash backup.sh >> backup.log 2>&1"
echo "    3. Thay dữ liệu mẫu bằng dữ liệu thật qua khu Quản trị"
echo
echo "  Lệnh hay dùng (nhớ kèm -f docker-compose.vps.yml):"
echo "    docker compose -f docker-compose.vps.yml ps"
echo "    docker compose -f docker-compose.vps.yml logs -f backend"
echo "    docker compose -f docker-compose.vps.yml restart"
echo
