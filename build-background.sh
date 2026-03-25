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
  # v2.0 modules (skip if not present yet)
  [ -f "$SCRIPT_DIR/modules/npm-resolve.js" ] && { echo ""; cat "$SCRIPT_DIR/modules/npm-resolve.js"; }
  [ -f "$SCRIPT_DIR/modules/error-log.js" ] && { echo ""; cat "$SCRIPT_DIR/modules/error-log.js"; }
  [ -f "$SCRIPT_DIR/modules/notifications.js" ] && { echo ""; cat "$SCRIPT_DIR/modules/notifications.js"; }
  [ -f "$SCRIPT_DIR/modules/sync-easycloud.js" ] && { echo ""; cat "$SCRIPT_DIR/modules/sync-easycloud.js"; }
  [ -f "$SCRIPT_DIR/modules/backup-scheduler.js" ] && { echo ""; cat "$SCRIPT_DIR/modules/backup-scheduler.js"; }
  [ -f "$SCRIPT_DIR/modules/userstyles.js" ] && { echo ""; cat "$SCRIPT_DIR/modules/userstyles.js"; }
  [ -f "$SCRIPT_DIR/modules/public-api.js" ] && { echo ""; cat "$SCRIPT_DIR/modules/public-api.js"; }
  [ -f "$SCRIPT_DIR/modules/migration.js" ] && { echo ""; cat "$SCRIPT_DIR/modules/migration.js"; }
  [ -f "$SCRIPT_DIR/modules/quota-manager.js" ] && { echo ""; cat "$SCRIPT_DIR/modules/quota-manager.js"; }
  echo ""
  # New bg/ modules
  if [ -d "$SCRIPT_DIR/bg" ]; then
    for f in "$SCRIPT_DIR/bg"/*.js; do
      [ -f "$f" ] && { echo ""; cat "$f"; }
    done
  fi
  echo ""
  cat "$SCRIPT_DIR/background.core.js"
} > "$OUT"

LINES=$(wc -l < "$OUT")
echo "Done: background.js ($LINES lines)"
