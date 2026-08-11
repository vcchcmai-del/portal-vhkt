#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/backend"
export DATA_DIR="${DATA_DIR:-$(pwd)/data}"
mkdir -p "$DATA_DIR"
exec python -m app.server
