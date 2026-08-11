#!/usr/bin/env bash
# Sao lưu cơ sở dữ liệu. Chạy tay hoặc đặt lịch tự động bằng cron.
#
# Đặt lịch chạy 2 giờ sáng hằng ngày:
#     crontab -e
#     0 2 * * * cd /đường/dẫn/portal-cnct && bash backup.sh >> backup.log 2>&1

set -euo pipefail
DIR="${BACKUP_DIR:-./backups}"
KEEP_DAYS=30

mkdir -p "$DIR"
FILE="$DIR/portal-$(date +%F-%H%M).sql.gz"

# Lấy tài khoản CSDL từ .env nếu có
if [ -f .env ]; then set -a; . ./.env; set +a; fi
docker exec portal-db pg_dump -U "${POSTGRES_USER:-portal}" "${POSTGRES_DB:-portal}" | gzip > "$FILE"
echo "$(date '+%d/%m/%Y %H:%M')  Đã sao lưu: $FILE ($(du -h "$FILE" | cut -f1))"

# Xoá bản sao lưu cũ hơn 30 ngày
find "$DIR" -name 'portal-*.sql.gz' -mtime +$KEEP_DAYS -delete
