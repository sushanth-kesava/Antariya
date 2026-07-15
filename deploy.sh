#!/usr/bin/env bash
set -euo pipefail

# Antariya frontend deploy helper
# Builds the Next.js static export and prepares it for upload to Hostinger.
#
# Usage:
#   1) Set your Render backend URL in frontend/public/runtime-config.js
#   2) ./deploy.sh
#   3) Upload the contents of frontend/out/ to Hostinger's public_html/

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
OUT_DIR="$FRONTEND_DIR/out"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Antariya Production Build & Deploy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "[1/5] Installing frontend dependencies..."
cd "$FRONTEND_DIR"
npm ci --prefer-offline

echo ""
echo "[2/5] Building frontend (static export)..."
NODE_ENV=production npm run build

if [[ ! -d "$OUT_DIR" ]]; then
  echo "❌ Build output not found at $OUT_DIR"
  echo "   Check for TypeScript errors above."
  exit 1
fi

echo ""
echo "[3/5] Verifying .htaccess is in build output..."
if [[ ! -f "$OUT_DIR/.htaccess" ]]; then
  echo "   ⚠️  .htaccess not found in out/ — copying from public/"
  cp "$FRONTEND_DIR/public/.htaccess" "$OUT_DIR/.htaccess" 2>/dev/null || true
fi

echo ""
echo "[4/5] Verifying runtime-config.js..."
if grep -q 'apiBaseUrl.*""' "$OUT_DIR/runtime-config.js" 2>/dev/null; then
  echo "   ⚠️  WARNING: runtime-config.js has empty apiBaseUrl!"
  echo "   Edit frontend/public/runtime-config.js with your Render URL before deploying."
fi

echo ""
echo "[5/5] Creating deployment archive..."
cd "$OUT_DIR"
zip -rq "$ROOT_DIR/antariya-deploy.zip" . -x "*.txt"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Build complete!"
echo ""
echo "  Deploy archive: $ROOT_DIR/antariya-deploy.zip"
echo ""
echo "  To deploy to Hostinger:"
echo "    1. Go to Hostinger File Manager → public_html/"
echo "    2. Delete all existing files (except .htaccess if unchanged)"
echo "    3. Upload antariya-deploy.zip"
echo "    4. Extract the zip in-place"
echo "    5. Delete the .zip file"
echo ""
echo "  Or manually upload everything in: $OUT_DIR"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
