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
#   bash publish.sh --draft   # Upload only (review before publish)
#   npm run cws:check         # Validate local CWS API v2 tooling without credentials

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# ── Load credentials ─────────────────────────────────────────────────────────
ENV_FILE="$SCRIPT_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: .env file not found. Run 'bash cws-setup.sh' first."
  exit 1
fi
set -a
source "$ENV_FILE"
set +a

if [ -z "$EXTENSION_ID" ] || [ -z "$CLIENT_ID" ] || [ -z "$CLIENT_SECRET" ] || [ -z "$REFRESH_TOKEN" ]; then
  echo "ERROR: Missing credentials in .env. Run 'bash cws-setup.sh' to reconfigure."
  exit 1
fi

# chrome-webstore-upload-cli v4 (CWS API v2) requires PUBLISHER_ID in addition
# to the legacy four fields. Fall back gracefully so an older .env (without
# PUBLISHER_ID) prints a clear instruction instead of a cryptic CLI error.
if [ -z "$PUBLISHER_ID" ]; then
  echo "ERROR: PUBLISHER_ID is missing from .env."
  echo "       chrome-webstore-upload-cli v4 (CWS API v2) requires it."
  echo "       Re-run 'bash cws-setup.sh' to add it, or fetch it from the CWS"
  echo "       Developer Dashboard (Account / Settings)."
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
# Full build: concatenates background.js AND copies Monaco to lib/monaco.
# Publishing with a stale/empty lib/monaco would ship a broken editor because
# the sandbox CSP blocks the CDN fallback (no external script-src allowed).
npm run build --silent

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
elif [ -x "/c/Windows/System32/tar.exe" ]; then
  # bsdtar writes POSIX-style entries (forward slashes); PowerShell
  # Compress-Archive writes Windows-style backslash entries that Chrome
  # cannot match against manifest paths — never use it.
  /c/Windows/System32/tar.exe -a -c -f "$SCRIPT_DIR/$ZIP_NAME" *
else
  echo "ERROR: no zip or bsdtar available"
  exit 1
fi
cd "$SCRIPT_DIR"
rm -rf "$BUILD_DIR"

SIZE=$(du -h "$ZIP_NAME" | cut -f1)
echo "  Built: $ZIP_NAME ($SIZE)"

# ── Upload ───────────────────────────────────────────────────────────────────
# Keep $ZIP_NAME on disk through upload + publish so a transient CWS failure
# (rate limit, expired refresh token, etc.) doesn't force a full rebuild. Only
# remove the artifact on a clean success path.
#
# chrome-webstore-upload-cli v4 reads CLIENT_ID / CLIENT_SECRET / REFRESH_TOKEN
# from env (CLI flags for secrets were removed). EXTENSION_ID and PUBLISHER_ID
# are still passed via flags. `--source` is only valid on the upload subcommand
# (forbidden on publish in v4).
echo ""
echo "[2/3] Uploading to Chrome Web Store..."
npx chrome-webstore-upload upload \
  --source "$ZIP_NAME" \
  --extension-id "$EXTENSION_ID" \
  --publisher-id "$PUBLISHER_ID"

# ── Publish (unless --draft) ─────────────────────────────────────────────────
if [ "$1" = "--draft" ]; then
  echo ""
  echo "[3/3] Skipped publish (--draft mode). Review at:"
  echo "  https://chrome.google.com/webstore/devconsole"
  echo "  Build kept at: $ZIP_NAME"
  echo ""
  echo "========================================"
  echo "  ScriptVault v${VERSION} uploaded (draft)"
  echo "========================================"
  exit 0
fi

echo ""
echo "[3/3] Publishing..."
npx chrome-webstore-upload publish \
  --extension-id "$EXTENSION_ID" \
  --publisher-id "$PUBLISHER_ID"

# ── Cleanup ──────────────────────────────────────────────────────────────────
rm -f "$ZIP_NAME"

echo ""
echo "========================================"
echo "  ScriptVault v${VERSION} published!"
echo "========================================"
