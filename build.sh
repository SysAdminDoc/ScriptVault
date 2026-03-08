#!/bin/bash
# ScriptVault - Chrome Web Store Build Script
# Packages the extension into a .zip ready for CWS upload

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"
ZIP_NAME="ScriptVault-v$(grep -o '"version": "[^"]*"' "$SCRIPT_DIR/manifest.json" | cut -d'"' -f4).zip"

echo "Building ScriptVault..."

# Clean previous build
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Files/folders to include in the CWS package
INCLUDE=(
  manifest.json
  background.js
  content.js
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
else
  # Fallback for Windows (PowerShell)
  powershell.exe -NoProfile -Command "Compress-Archive -Path '$BUILD_DIR\*' -DestinationPath '$SCRIPT_DIR\\$ZIP_NAME' -Force"
fi

echo ""
echo "Build complete: $ZIP_NAME"
echo "Size: $(du -h "$SCRIPT_DIR/$ZIP_NAME" | cut -f1)"
echo ""
echo "Ready for Chrome Web Store upload."

# Cleanup
rm -rf "$BUILD_DIR"
