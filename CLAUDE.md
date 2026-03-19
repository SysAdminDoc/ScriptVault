# ScriptVault

## Overview
Modern userscript manager built with Chrome Manifest V3. Tampermonkey-inspired functionality with cloud sync, auto-updates, and a full dashboard.

## Version
v1.5.2

## Tech Stack
- Chrome MV3 extension (JavaScript)
- Background service worker (built from source modules via `build-background.sh`)
- `chrome.userScripts` API for script injection (USER_SCRIPT world)
- `chrome.storage.local` for persistence
- CodeMirror editor in dashboard
- Cloud sync: WebDAV, Google Drive (PKCE), Dropbox (PKCE), OneDrive (PKCE)
- fflate for ZIP import/export
- i18n: 8 languages (en, es, fr, de, zh, ja, pt, ru)

## Build
- `bash build-background.sh` - Concatenates source modules into `background.js`
- `bash build.sh` - Packages extension into CWS-ready ZIP
- **Never edit `background.js` directly** - edit source files, then rebuild

## Key Files
- `manifest.json` - Extension manifest (version source of truth)
- `background.core.js` - Main service worker logic (~4220 lines)
- `modules/storage.js` - SettingsManager, ScriptStorage, ScriptValues, TabStorage
- `modules/sync-providers.js` - CloudSyncProviders (WebDAV, Google Drive, Dropbox, OneDrive)
- `modules/resources.js` - ResourceCache for @resource/@require
- `modules/xhr.js` - XhrManager for GM_xmlhttpRequest abort tracking
- `modules/i18n.js` - I18n module with inline translations
- `shared/utils.js` - escapeHtml, generateId, sanitizeUrl, formatBytes
- `content.js` - Content script bridge (ISOLATED world <-> USER_SCRIPT world)
- `pages/popup.js` - Browser action popup
- `pages/dashboard.js` - Full dashboard (scripts list, editor, settings, values editor, help)
- `pages/install.js` - Userscript install confirmation page
- `lib/fflate.js` - ZIP compression library

## Architecture
- Source modules are inlined into `background.js` at build time (Chrome MV3 service workers don't reliably support importScripts)
- Scripts registered via `chrome.userScripts.register()` with wrapped GM API code
- Content script bridge forwards messages between USER_SCRIPT world and background
- `chrome.runtime.onUserScriptMessage` used for direct USER_SCRIPT -> background messaging (Chrome 131+)
- Regex @include patterns: extracted into broad match patterns for registration, fine-filtered at runtime

## Gotchas
- Version strings: manifest.json is source of truth; comment headers in content.js/popup.js/dashboard.js must match; dashboard reads dynamically from manifest via `chrome.runtime.getManifest().version`
- `ResourceCache.fetchResource()` (not `.fetch()`) to avoid shadowing global fetch
- `self._notifCallbacks` initialized in storage.js, used in background.core.js GM_notification handler
- Dropbox uses PKCE auth code flow (not implicit grant) with state validation + refresh token
- `postMessage` uses `'/'` targetOrigin (same-origin only) in both content.js and the wrapped script builder — never `'*'`
- Bridge init key uses extension ID + `Object.defineProperty` to prevent page-level spoofing
- Dashboard DOM access: always null-check `elements.*` before `.textContent`/`.classList` assignment — many elements are optional
- `exportToZip` deduplicates filenames with `_2`, `_3` suffix counters
- `autoReloadMatchingTabs` is debounced (500ms) to prevent mass tab reloads
- `cleanupStaleCaches()` runs on init to prune expired `require_cache_*` and `res_cache_*` entries
- Lint: `@grant none` + GM API usage shows `info` severity (not `error`) since some managers still expose APIs
- `GM_info` has full Tampermonkey parity: uuid, scriptMetaStr, scriptWillUpdate, isIncognito, platform, downloadMode
- `GM.xmlHttpRequest` returns a Promise with `.abort()` method attached (not just a plain Promise)
- `window.onurlchange` intercepts pushState/replaceState/popstate/hashchange for SPA detection
- `GM_audio` provides tab mute control (setMute, getState) via chrome.tabs API
- `@top-level-await` wraps user script in async IIFE
- `@run-in` injects runtime guard for incognito/normal tab filtering
- `@tag` parsed as array, `@license`/`@copyright` as strings
- SRI hash verification: @require URLs with #sha256=base64 fragment are verified after fetch
- `GM_info.script.resources` populated from actual `meta.resource` object, not empty `{}`
- All GM_* functions enforce `@grant` checks: `GM_unregisterMenuCommand`, `GM_getMenuCommands`, `GM_focusTab`, `GM_addElement`, `GM_loadScript`
- Install page parser uses same regex as background parser (`(?:\s+(.*))?` for optional values) — supports `@noframes`, `@unwrap`
- Install page `@resource` stored as `{name: url}` object (not array of raw strings) — consistent with background parser
- `@priority` metadata: integer, higher values execute first. `registerAllScripts` sorts by priority then position
- Per-script execution profiling: `performance.now()` wraps script runner, stats stored as `script.stats` object
- Script conflict detection: `findConflictingScripts()` compares @match/@include patterns across all scripts
- Info panel shows full perf stats (runs, avg/total time, errors, last URL) with Reset Stats button
- Popup shows color-coded execution time badges (green <50ms, yellow <200ms, red 200ms+)
