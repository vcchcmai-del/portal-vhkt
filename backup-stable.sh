#!/usr/bin/env bash
set -euo pipefail
DIR="${BACKUP_DIR:-./data/backups}"
mkdir -p "$DIR"
if [ -f .env ]; then set -a; . ./.env; set +a; fi
STAMP=$(date +%F-%H%M%S)
FILE="$DIR/portal-$STAMP.sql.gz"
docker exec portal-db pg_dump -U "${POSTGRES_USER:-portal}" -d "${POSTGRES_DB:-portal}" --no-owner --no-privileges | gzip > "$FILE"
find "$DIR" -name 'portal-*.sql.gz' -mtime +30 -delete
printf 'Da sao luu: %s\n' "$FILE"
