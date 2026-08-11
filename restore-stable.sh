#!/usr/bin/env bash
set -euo pipefail
[ $# -eq 1 ] || { echo "Cach dung: bash restore-stable.sh data/backups/portal-....sql.gz"; exit 1; }
[ -f "$1" ] || { echo "Khong tim thay file: $1"; exit 1; }
if [ -f .env ]; then set -a; . ./.env; set +a; fi
echo "CANH BAO: phuc hoi se ghi de du lieu PostgreSQL hien tai."
read -rp "Go DONG Y de tiep tuc: " ok
[ "$ok" = "DONG Y" ] || exit 0
gunzip -c "$1" | docker exec -i portal-db psql -U "${POSTGRES_USER:-portal}" -d "${POSTGRES_DB:-portal}"
echo "Phuc hoi xong."
