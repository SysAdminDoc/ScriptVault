# ScriptVault

## Overview
Modern userscript manager built with Chrome Manifest V3. Tampermonkey-inspired functionality with cloud sync, auto-updates, and a full dashboard.

## Version
v1.6.0

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
- `background.core.js` - Main service worker logic (~4850 lines)
- `bg/analyzer.js` - Static analysis engine (28 pattern detectors, risk scoring)
- `bg/netlog.js` - Network request logger (GM_xmlhttpRequest interception)
- `bg/workspaces.js` - Workspace manager (named script state snapshots)
- `modules/storage.js` - SettingsManager, ScriptStorage, ScriptValues, TabStorage, FolderStorage
- `modules/sync-providers.js` - CloudSyncProviders (WebDAV, Google Drive, Dropbox, OneDrive)
- `modules/resources.js` - ResourceCache for @resource/@require
- `modules/xhr.js` - XhrManager for GM_xmlhttpRequest abort tracking
- `modules/i18n.js` - I18n module with inline translations
- `shared/utils.js` - escapeHtml, generateId, sanitizeUrl, formatBytes
- `content.js` - Content script bridge (ISOLATED world <-> USER_SCRIPT world)
- `pages/popup.js` - Browser action popup (~710 lines)
- `pages/dashboard.js` - Full dashboard (~4900 lines)
- `pages/install.js` - Userscript install confirmation page (~790 lines)
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
- Script templates: 6 templates in `SCRIPT_TEMPLATES` object in dashboard.js (blank, page modifier, CSS injector, API interceptor, SPA script, cross-site request)
- Version history: `script.versionHistory` array (max 3 entries), auto-saved on `UpdateSystem.applyUpdate()`. Rollback via `rollbackScript` message handler
- Storage quota monitor: `updateStats()` renders quota bar + warning toast at 85% of 10MB Chrome limit
- `getVersionHistory` and `rollbackScript` message handlers in background.core.js
- Tag filtering: dynamic `@tag` options in filter dropdown, `getFilteredScripts()` supports `tag:` prefix filters
- Drag-and-drop file install: drop .user.js or .zip files onto dashboard body to install. `showDropOverlay()` for visual feedback
- Shift+click multi-select: checkbox click handler supports Shift key for range selection via `state._lastCheckedId`
- @require library browser: cdnjs API search in Externals panel. Inserts `@require` before `==/UserScript==` in editor
- GM_audio.addStateChangeListener/removeStateChangeListener: background watches via `chrome.tabs.onUpdated` for `audible`/`mutedInfo` changes, forwards via `audioStateChanged` message through content script bridge
- Linter enhancements: duplicate @match, duplicate @grant, duplicate @require detection; broad match pattern warnings; missing @version/@description info hints
- Autocomplete snippets: GM_xmlhttpRequest, GM_notification, GM_download insert full code templates with [snippet] suffix; added missing grant values (window.close/focus/onurlchange, GM_audio, GM_addElement, etc.)
- Force-update: right-click update button bypasses HTTP cache (Cache-Control: no-cache). `forceUpdate` message handler in background.core.js
- Script stats export: `exportStatsCSV()` function, Export CSV button in Utilities panel
- Popup enhancements: description tooltip on script items, not-running opacity indicator for disabled scripts
- Dashboard keyboard shortcuts: Ctrl+N (new), Ctrl+I (import), Alt+1-5 (tab switch), Ctrl+W (close tab), Ctrl+Tab (cycle tabs), Ctrl+/ (focus search)
- Advanced search filters: filter by errors, update URL, grant type (xhr/storage/style/none), scope (broad/single-site), plus tag filters
- Editor toolbar: comment toggle (//) button, word wrap toggle, snippet insert dropdown (7 snippets)
- OpenUserJS embedded search: API-based in-dashboard results (falls back to external if API unavailable)
- Help panel: Getting Started guide, Dashboard Shortcuts section, GM API Quick Reference (4 categories)
- Batch URL install: paste multiple URLs (one per line) to install in sequence, with progress
- Script notes: personal notes textarea per-script, saved in script.settings.notes
- Script diff view: line-by-line diff modal comparing version history entries vs current code, with add/delete/context coloring
- Author display: shows @author under script name in table rows
- Description tooltip: hovering script name in table shows @description
- Editor Ctrl+/ shortcut mapped to comment toggle button
- Version diff button: "Diff" button alongside "Rollback" in version history
- Script pinning: star button in action icons, pinned scripts sort to top via stable sort. Persisted as settings.pinned
- @match pattern tester: test any URL against all installed scripts, shows matching + disabled state, in Help panel
- Activity log: all toast messages logged to Activity Log section in Utilities, timestamped, capped at 50 entries
- Script health indicators: rows with errors get red left border, stale scripts (>180 days) get yellow border
- Tampermonkey backup import: `importTampermonkeyBackup` message handler parses .txt format with multiple scripts separated by blank lines
- Full-text code search: prefix search with `code:` to search inside script source code, also searches author field
- Duplicate detection in Find Scripts: installed badge + green border on already-installed scripts, Install button shows "Reinstall"
- Column visibility toggle: modal with checkboxes for 8 toggleable columns, persisted in settings._hiddenColumns, applied via applyColumnVisibility()
- Copy install URL: clipboard copy button in script row actions (only shown when downloadURL/updateURL exists)
- Install page audit (16 fixes): script size/line count display, @connect domains section, @antifeature warnings, @run-at/noframes display, version downgrade warning, inline install errors (no more alert()), large script warning (>500KB), success page shows "Open in Dashboard" button with 5s auto-close, proper extension icon instead of emoji, entrance animation, keyboard shortcuts (Enter=install, Escape=cancel), CodeMirror theme matches catppuccin/oled, @tag display, resource tooltips, show 8 URL patterns (was 5)
- Popup audit (12 fixes): ScriptVault branding in header, URL bar showing current hostname, total script count in footer, contextual empty state with GreasyFork link, error dots on scripts with errors, stagger animation on script items, click name opens editor (not toggle), dropdown adds Copy URL + Pin/Unpin actions
- Command Palette: Ctrl+K opens fuzzy-search command palette. Actions, navigation, settings, and all installed scripts searchable. Arrow keys + Enter navigation. Grouped by category.
- Static Analysis Engine: bg/analyzer.js with 28 pattern detectors across 7 categories (execution, data, network, fingerprint, obfuscation, mining, hijack). Risk score 0-100. Runs on install page with color-coded results. High-entropy string detection.
- Script Folders: FolderStorage module in storage.js. CRUD operations. Drag scripts into folders. Collapsible folder headers in table. Folder color dots. "New Folder" button in toolbar. "Move to Folder" in script actions. Folder delete with confirmation.
- Build system: bg/ directory auto-included in build-background.sh
- Network Request Log (Phase 3C): bg/netlog.js logs all GM_xmlhttpRequest calls. Stores method, URL, status, duration, response size, script name. getNetworkLog/clearNetworkLog message handlers. Dashboard UI with stats bar + scrollable log. HAR export.
- Workspaces (Phase 4B): bg/workspaces.js manages named snapshots of enabled/disabled script states. Create/activate/save/delete. Dashboard UI with workspace list + switch/save/delete buttons. Activating a workspace re-registers all scripts.
- Performance Budgets (Phase 5B): configurable default budget (ms) in settings. Per-script budget override. Scripts exceeding budget get purple right border (row-over-budget). Budget setting UI in Utilities panel.

## Bug Audit (2026-03-21)
- Fixed: NetworkLog duration calculation used `_netLogEntry.timestamp` which was undefined; replaced with dedicated `_netLogStartTime` variable
- Fixed: `state.folders`, `state._collapsedFolders`, `state._lastCheckedId`, `state._quotaWarned` not initialized in dashboard state object
- Fixed: `switchTab('help')` in command palette failed because help tab is a header icon, not a `.tm-tab`; added special case handling
- Verified: All version strings match (v1.6.0 across manifest, manifest-firefox, content.js, popup.js, dashboard.js)
- Verified: All bg/ modules load before background.core.js in build output
- Verified: `escapeHtml` available in popup.js (shared/utils.js loaded first)
- Verified: Column index mapping still correct after pin button addition (pin is inside actions TD, not a new column)
