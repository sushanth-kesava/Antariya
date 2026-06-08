#!/usr/bin/env bash
set -euo pipefail

# Antariya frontend deploy helper
# Usage:
#   1) Edit HOSTINGER_* values below
#   2) ./deploy.sh

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
OUT_DIR="$FRONTEND_DIR/out"

# Hostinger SFTP details (replace these)
HOSTINGER_HOST="your-sftp-host"       # e.g. sftp.hostinger.com
HOSTINGER_USER="your-username"
HOSTINGER_PATH="public_html"

echo "[1/3] Building frontend..."
cd "$ROOT_DIR"
npm run build:frontend

if [[ ! -d "$OUT_DIR" ]]; then
  echo "Build output not found at $OUT_DIR"
  exit 1
fi

echo "[2/3] Preparing deployment archive..."
cd "$OUT_DIR"
zip -rq "$ROOT_DIR/frontend-out.zip" .

if [[ "$HOSTINGER_HOST" == "your-sftp-host" || "$HOSTINGER_USER" == "your-username" ]]; then
  echo "[3/3] Skipped upload: configure HOSTINGER_HOST and HOSTINGER_USER in deploy.sh"
  echo "Manual option: upload frontend/out/* to Hostinger $HOSTINGER_PATH"
  exit 0
fi

echo "[3/3] Uploading to Hostinger via SFTP..."
sftp "$HOSTINGER_USER@$HOSTINGER_HOST" <<EOF
cd $HOSTINGER_PATH
put $ROOT_DIR/frontend-out.zip
bye
EOF

echo "Upload complete. Now extract frontend-out.zip inside Hostinger File Manager into $HOSTINGER_PATH and remove old files first."
