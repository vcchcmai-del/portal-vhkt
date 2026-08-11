#!/usr/bin/env bash
# Phục hồi dữ liệu từ một bản sao lưu.
#     bash restore.sh backups/portal-2026-08-08-0200.sql.gz

set -euo pipefail
[ $# -eq 1 ] || { echo "Cách dùng: bash restore.sh <file-sao-luu.sql.gz>"; exit 1; }
[ -f "$1" ] || { echo "Không tìm thấy file: $1"; exit 1; }

echo "CẢNH BÁO: thao tác này ghi đè toàn bộ dữ liệu hiện tại."
read -rp "Gõ 'DONG Y' để tiếp tục: " ok
[ "$ok" = "DONG Y" ] || { echo "Đã huỷ."; exit 0; }

gunzip -c "$1" | docker exec -i portal-db psql -U portal portal
echo "Phục hồi xong. Khởi động lại: docker compose restart backend"
