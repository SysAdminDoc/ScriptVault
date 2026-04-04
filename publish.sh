#!/bin/bash
# ScriptVault — Chrome Web Store Publish Script
# Builds the extension ZIP and uploads it to the Chrome Web Store.
#
# Prerequisites:
#   1. Run `bash cws-setup.sh` once to generate your .env file
#   2. npm install (chrome-webstore-upload-cli is a devDependency)
#
# Usage:
#   bash publish.sh           # Upload + publish
#   bash publish.sh --draft   # Upload only (no auto-publish)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# ── Load credentials ─────────────────────────────────────────────────────────
ENV_FILE="$SCRIPT_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: .env file not found. Run 'bash cws-setup.sh' first."
  exit 1
fi
source "$ENV_FILE"

if [ -z "$EXTENSION_ID" ] || [ -z "$CLIENT_ID" ] || [ -z "$CLIENT_SECRET" ] || [ -z "$REFRESH_TOKEN" ]; then
  echo "ERROR: Missing credentials in .env. Run 'bash cws-setup.sh' to reconfigure."
  exit 1
fi

# ── Read version ─────────────────────────────────────────────────────────────
VERSION=$(grep -o '"version": "[^"]*"' manifest.json | head -1 | cut -d'"' -f4)
ZIP_NAME="ScriptVault-v${VERSION}.zip"

echo "========================================"
echo "  ScriptVault CWS Publish — v${VERSION}"
echo "========================================"
echo ""

# ── Build ────────────────────────────────────────────────────────────────────
echo "[1/3] Building extension ZIP..."
npm run build:bg --silent

BUILD_DIR="$SCRIPT_DIR/_cws_build"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

INCLUDE=(
  manifest.json
  background.js
  content.js
  offscreen.html
  offscreen.js
  shared
  pages
  images/icon16.png
  images/icon32.png
  images/icon48.png
  images/icon128.png
  lib
  _locales
)

for item in "${INCLUDE[@]}"; do
  src="$SCRIPT_DIR/$item"
  dest="$BUILD_DIR/$item"
  if [ -d "$src" ]; then
    mkdir -p "$dest"
    cp -r "$src"/* "$dest"/
  elif [ -f "$src" ]; then
    mkdir -p "$(dirname "$dest")"
    cp "$src" "$dest"
  else
    echo "  Warning: $item not found, skipping"
  fi
done

# Create ZIP
cd "$BUILD_DIR"
rm -f "$SCRIPT_DIR/$ZIP_NAME"
if command -v zip &> /dev/null; then
  zip -r "$SCRIPT_DIR/$ZIP_NAME" . -x "*.DS_Store" "*Thumbs.db" > /dev/null
else
  powershell.exe -NoProfile -Command "Compress-Archive -Path '$(pwd -W)\\*' -DestinationPath '$(cd "$SCRIPT_DIR" && pwd -W)\\${ZIP_NAME}' -Force"
fi
cd "$SCRIPT_DIR"
rm -rf "$BUILD_DIR"

SIZE=$(du -h "$ZIP_NAME" | cut -f1)
echo "  Built: $ZIP_NAME ($SIZE)"

# ── Upload ───────────────────────────────────────────────────────────────────
echo ""
echo "[2/3] Uploading to Chrome Web Store..."
npx chrome-webstore-upload upload \
  --source "$ZIP_NAME" \
  --extension-id "$EXTENSION_ID" \
  --client-id "$CLIENT_ID" \
  --client-secret "$CLIENT_SECRET" \
  --refresh-token "$REFRESH_TOKEN"

# ── Publish (unless --draft) ─────────────────────────────────────────────────
if [ "$1" = "--draft" ]; then
  echo ""
  echo "[3/3] Skipped publish (--draft mode). Review at:"
  echo "  https://chrome.google.com/webstore/devconsole"
else
  echo ""
  echo "[3/3] Publishing..."
  npx chrome-webstore-upload publish \
    --extension-id "$EXTENSION_ID" \
    --client-id "$CLIENT_ID" \
    --client-secret "$CLIENT_SECRET" \
    --refresh-token "$REFRESH_TOKEN"
fi

# ── Cleanup ──────────────────────────────────────────────────────────────────
rm -f "$ZIP_NAME"

echo ""
echo "========================================"
echo "  ScriptVault v${VERSION} published!"
echo "========================================"
