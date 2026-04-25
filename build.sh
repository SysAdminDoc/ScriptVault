#!/bin/bash
# ScriptVault - Chrome Web Store Build Script
# Packages the extension into a .zip ready for CWS upload

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"
ZIP_NAME="ScriptVault-v$(grep -o '"version": "[^"]*"' "$SCRIPT_DIR/manifest.json" | cut -d'"' -f4).zip"

echo "Building ScriptVault..."

# Build background.js + ensure lib/monaco is populated before packaging.
# Without this, edits to source modules wouldn't propagate to the shipped
# background.js, and a fresh checkout would ship with an empty lib/monaco.
if [ -f "$SCRIPT_DIR/esbuild.config.mjs" ]; then
  node "$SCRIPT_DIR/esbuild.config.mjs"
fi

# Clean previous build
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Files/folders to include in the CWS package
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

# Copy included files
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
    echo "Warning: $item not found, skipping"
  fi
done

# Build the zip
cd "$BUILD_DIR"
rm -f "$SCRIPT_DIR/$ZIP_NAME"

if command -v zip &> /dev/null; then
  zip -r "$SCRIPT_DIR/$ZIP_NAME" . -x "*.DS_Store" "*Thumbs.db"
elif [ -x "/c/Windows/System32/tar.exe" ]; then
  # Windows 10/11 ships bsdtar as tar.exe — produces POSIX-style entries
  # (forward slashes). PowerShell Compress-Archive writes Windows-style
  # backslash entries which Chrome cannot match against manifest paths.
  /c/Windows/System32/tar.exe -a -c -f "$SCRIPT_DIR/$ZIP_NAME" *
else
  echo "ERROR: no zip or bsdtar available"
  exit 1
fi

echo ""
echo "Build complete: $ZIP_NAME"
echo "Size: $(du -h "$SCRIPT_DIR/$ZIP_NAME" | cut -f1)"
echo ""
echo "Ready for Chrome Web Store upload."

# Cleanup
rm -rf "$BUILD_DIR"
