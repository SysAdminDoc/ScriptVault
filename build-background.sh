#!/bin/bash
# ScriptVault - Background Service Worker Builder
# Concatenates source modules into a single background.js file
# Chrome MV3 service workers don't support importScripts reliably,
# so we inline everything into one file.

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUT="$SCRIPT_DIR/background.js"
VERSION=$(grep -o '"version": "[^"]*"' "$SCRIPT_DIR/manifest.json" | cut -d'"' -f4)

echo "Building background.js v$VERSION..."

{
  echo "// ScriptVault v$VERSION - Background Service Worker"
  echo "// Comprehensive userscript manager with cloud sync and auto-updates"
  echo "// NOTE: This file is built from source modules. Edit the individual files in"
  echo "// shared/, modules/, and lib/, then run build-background.sh to regenerate."
  echo ""
  cat "$SCRIPT_DIR/shared/utils.js"
  echo ""
  cat "$SCRIPT_DIR/lib/fflate.js"
  echo ""
  cat "$SCRIPT_DIR/modules/sync-providers.js"
  echo ""
  cat "$SCRIPT_DIR/modules/i18n.js"
  echo ""
  echo "// ============================================================================"
  echo "// END INLINED MODULES"
  echo "// ============================================================================"
  echo ""
  cat "$SCRIPT_DIR/modules/storage.js"
  echo ""
  cat "$SCRIPT_DIR/modules/xhr.js"
  echo ""
  cat "$SCRIPT_DIR/modules/resources.js"
  echo ""
  cat "$SCRIPT_DIR/background.core.js"
} > "$OUT"

LINES=$(wc -l < "$OUT")
echo "Done: background.js ($LINES lines)"
