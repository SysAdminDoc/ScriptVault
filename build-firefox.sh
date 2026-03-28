#!/bin/bash
# ScriptVault - Firefox Add-on Build Script
# Packages the extension into an .xpi/.zip ready for AMO upload or sideloading

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/build-firefox"
VERSION=$(grep -o '"version": "[^"]*"' "$SCRIPT_DIR/manifest-firefox.json" | cut -d'"' -f4)
ZIP_NAME="ScriptVault-firefox-v${VERSION}.zip"

echo "Building ScriptVault for Firefox v$VERSION..."

# Build background.js using the same esbuild pipeline as Chrome
if [ -f "$SCRIPT_DIR/esbuild.config.mjs" ]; then
  echo "Building background.js via esbuild..."
  node "$SCRIPT_DIR/esbuild.config.mjs" --bg-only
elif [ -f "$SCRIPT_DIR/build-background.sh" ]; then
  echo "Building background.js from source modules..."
  bash "$SCRIPT_DIR/build-background.sh"
fi

# Clean previous build
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Files/folders to include
INCLUDE=(
  background.js
  content.js
  shared
  pages
  images/icon16.png
  images/icon32.png
  images/icon48.png
  images/icon128.png
  lib
  _locales
)

# Copy Firefox manifest as manifest.json
cp "$SCRIPT_DIR/manifest-firefox.json" "$BUILD_DIR/manifest.json"

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

# Build the zip/xpi
cd "$BUILD_DIR"
rm -f "$SCRIPT_DIR/$ZIP_NAME"

if command -v zip &> /dev/null; then
  zip -r "$SCRIPT_DIR/$ZIP_NAME" . -x "*.DS_Store" "*Thumbs.db"
else
  powershell.exe -NoProfile -Command "Compress-Archive -Path '$BUILD_DIR\*' -DestinationPath '$SCRIPT_DIR\\$ZIP_NAME' -Force"
fi

echo ""
echo "Build complete: $ZIP_NAME"
echo "Size: $(du -h "$SCRIPT_DIR/$ZIP_NAME" | cut -f1)"
echo ""
echo "Ready for Firefox Add-ons (AMO) upload or sideloading."

# Cleanup
rm -rf "$BUILD_DIR"
