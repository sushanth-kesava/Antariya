#!/usr/bin/env bash
set -euo pipefail

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Antariya — Build & Package for Hostinger
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Usage: ./deploy.sh
# Output: ~/Desktop/antariya-deploy.zip

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
OUT_DIR="$FRONTEND_DIR/out"
OUTPUT_ZIP="$HOME/Desktop/antariya-deploy.zip"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🚀 Antariya Production Build"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Step 1: Temporarily hide .env.local so it doesn't override .env.production
cd "$FRONTEND_DIR"
HIDDEN_ENV=""
if [[ -f ".env.local" ]]; then
  echo ""
  echo "[1/4] Hiding .env.local (prevents localhost override)..."
  mv .env.local .env.local.bak
  HIDDEN_ENV="1"
else
  echo ""
  echo "[1/4] No .env.local found (good — using .env.production)"
fi

# Step 2: Build
echo ""
echo "[2/4] Building frontend (NODE_ENV=production)..."
if ! NODE_ENV=production npm run build; then
  echo ""
  echo "❌ Build FAILED. Restoring .env.local..."
  [[ "$HIDDEN_ENV" == "1" ]] && mv .env.local.bak .env.local
  exit 1
fi

# Step 3: Restore .env.local
if [[ "$HIDDEN_ENV" == "1" ]]; then
  echo ""
  echo "[3/4] Restoring .env.local for local development..."
  mv .env.local.bak .env.local
fi

# Step 4: Verify & zip
if [[ ! -d "$OUT_DIR" ]]; then
  echo "❌ Build output not found at $OUT_DIR"
  exit 1
fi

# Verify .htaccess is in the build
if [[ ! -f "$OUT_DIR/.htaccess" ]]; then
  echo "  ⚠️  Copying .htaccess into build output..."
  cp "$FRONTEND_DIR/public/.htaccess" "$OUT_DIR/.htaccess" 2>/dev/null || true
fi

echo ""
echo "[4/4] Creating deployment zip..."
cd "$OUT_DIR"
rm -f "$OUTPUT_ZIP"
zip -rq "$OUTPUT_ZIP" . -x '*.txt' '*.map'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Ready to deploy!"
echo ""
echo "  📦 File: ~/Desktop/antariya-deploy.zip"
echo "  📏 Size: $(du -h "$OUTPUT_ZIP" | cut -f1)"
echo ""
echo "  Deploy to Hostinger:"
echo "    1. File Manager → public_html/"
echo "    2. Delete all existing files"
echo "    3. Upload antariya-deploy.zip"
echo "    4. Extract in-place"
echo "    5. Delete the zip"
echo ""
echo "  API: https://api.antariyaofficial.com"
echo "  Site: https://antariyaofficial.com"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
