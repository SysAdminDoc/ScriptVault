# ScriptVault

## Overview
Modern userscript manager built with Chrome Manifest V3. Tampermonkey-inspired functionality with cloud sync, auto-updates, a full dashboard, Monaco editor, DevTools panel, and a persistent side panel.

## Version
v2.0.0

## Tech Stack
- Chrome MV3 extension (JavaScript with JSDoc types)
- Background service worker (built from source modules via `build-background.sh` or `esbuild.config.mjs`)
- `chrome.userScripts` API for script injection (USER_SCRIPT world)
- `chrome.storage.local` for persistence
- **Monaco Editor** (v0.52.2, CDN-loaded in sandboxed iframe; local bundling via esbuild planned)
- Cloud sync: WebDAV, Google Drive (PKCE), Dropbox (PKCE), OneDrive (PKCE), Easy Cloud (chrome.identity)
- Vitest test suite for unit testing (159 test cases)
- background.js: 13,912 lines (built from 12+ source modules)

## v2.0.0 New Modules

### Dashboard Modules (pages/)
- `dashboard-store.js` — Built-in Greasy Fork script store
- `dashboard-onboarding.js` — 5-step welcome wizard
- `dashboard-performance.js` — Performance dashboard with impact scores
- `dashboard-pattern-builder.js` — Visual @match pattern builder
- `dashboard-debugger.js` — Console capture, live reload, variable inspector
- `dashboard-cardview.js` — Card view with favicons
- `dashboard-keyboard.js` — Keyboard navigation with vim mode
- `dashboard-a11y.js` — WCAG 2.1 AA accessibility
- `dashboard-ai.js` — AI assistant (generate, explain, security, fix)
- `dashboard-whatsnew.js` — Changelog modal per version
- `dashboard-scheduler.js` — Time/day/date-based script scheduling
- `dashboard-theme-editor.js` — Custom theme editor with 10 presets
- `dashboard-depgraph.js` — Force-directed dependency graph
- `dashboard-sharing.js` — QR code/data URL script sharing
- `dashboard-i18n-v2.js` — i18n for all v2 modules (8 languages, 600 keys)
- `dashboard-gist.js` — GitHub Gist import/export
- `dashboard-templates.js` — Custom script template manager
- `dashboard-profiles.js` — Multi-profile support
- `dashboard-collections.js` — Script collections/bundles
- `dashboard-csp.js` — CSP compatibility reporter
- `dashboard-analytics.js` — Detailed script analytics with charts
- `dashboard-snippets.js` — 30+ code snippet library
- `dashboard-standalone.js` — Standalone HTML/bookmarklet export
- `dashboard-firefox-compat.js` — Firefox compatibility polyfills
- `devtools-panel-v2.js` — Waterfall timeline, console, body inspector

### Background Modules (modules/)
- `modules/npm-resolve.js` — npm package resolution via CDN
- `modules/error-log.js` — Structured error log with export
- `modules/notifications.js` — Smart notification system
- `modules/sync-easycloud.js` — Zero-config Google Drive sync
- `modules/backup-scheduler.js` — Automated backup scheduling

### Tests (tests/)
- `tests/utils.test.js` — 40 tests for shared utilities
- `tests/parser.test.js` — 23 tests for userscript parser
- `tests/versions.test.js` — 23 tests for version comparison
- `tests/analyzer.test.js` — 45 tests for risk pattern detection
- `tests/netlog.test.js` — 28 tests for network log
- fflate for ZIP import/export
- Acorn.js (v8.14.1) for AST-based static analysis (via offscreen document)
- diff.js (v7.0.0) for 3-way text merge in sync conflict resolution
- i18n: 8 languages (en, es, fr, de, zh, ja, pt, ru)
- `chrome.sidePanel` API (Chrome 114+) for persistent side panel
- `chrome.devtools.panels` for DevTools integration
- `chrome.offscreen` API for heavy computation off the service worker
- Web Crypto Ed25519 (Chrome 113+) for script signing

## Build
- `bash build-background.sh` — Concatenates source modules into `background.js` (currently ~10,634 lines)
- `bash build.sh` — Packages extension into CWS-ready ZIP
- **Never edit `background.js` directly** — edit source files in `bg/`, `modules/`, `shared/`, then rebuild

## Key Files

### Background (service worker)
- `manifest.json` — Extension manifest (version source of truth)
- `background.core.js` — Main service worker logic (~5000 lines)
- `bg/analyzer.js` — AST-based static analysis engine (31 detectors, Acorn via offscreen document, regex fallback)
- `bg/netlog.js` — Network request logger (GM_xmlhttpRequest + full proxy capture: fetch/XHR/WebSocket/sendBeacon, 2000 entry cap)
- `bg/workspaces.js` — Workspace manager (named script state snapshots)
- `bg/signing.js` — Ed25519 script signing/verification (Web Crypto API)

### Modules (inlined into background.js)
- `modules/storage.js` — SettingsManager, ScriptStorage, ScriptValues, TabStorage, FolderStorage
- `modules/sync-providers.js` — CloudSyncProviders (WebDAV, Google Drive, Dropbox, OneDrive)
- `modules/resources.js` — ResourceCache for @resource/@require
- `modules/xhr.js` — XhrManager for GM_xmlhttpRequest abort tracking
- `modules/i18n.js` — I18n module with inline translations
- `shared/utils.js` — escapeHtml, generateId, sanitizeUrl, formatBytes

### Extension Pages
- `content.js` — Content script bridge (ISOLATED world <-> USER_SCRIPT world)
- `pages/popup.html/js` — Browser action popup (~710 lines)
- `pages/dashboard.html/js` — Full dashboard (~4900 lines)
- `pages/install.html/js` — Userscript install confirmation page (~790 lines)
- `pages/sidepanel.html/js` — Persistent side panel (chrome.sidePanel, Chrome 114+)
- `pages/devtools.html` — DevTools panel registration page
- `pages/devtools-panel.html/js` — DevTools panel UI (Network/Execution/Console tabs)
- `pages/editor-sandbox.html` — Sandboxed iframe hosting Monaco editor (loads from CDN)
- `pages/monaco-adapter.js` — Bridges dashboard.js CodeMirror API to Monaco iframe via postMessage

### Offscreen / Libraries
- `offscreen.html` + `offscreen.js` — Offscreen document: AST analysis, 3-way merge, diff generation
- `lib/fflate.js` — ZIP compression library
- `lib/acorn.min.js` — Acorn JS parser (UMD, 114KB) — used in offscreen.js
- `lib/diff.min.js` — diff.js (UMD, 24KB) — used in offscreen.js for 3-way text merge

## Architecture
- Source modules are inlined into `background.js` at build time (Chrome MV3 service workers don't reliably support importScripts)
- Scripts registered via `chrome.userScripts.register()` with wrapped GM API code
- Content script bridge forwards messages between USER_SCRIPT world and background
- `chrome.runtime.onUserScriptMessage` used for direct USER_SCRIPT -> background messaging (Chrome 131+)
- Regex @include patterns: extracted into broad match patterns for registration, fine-filtered at runtime
- **Monaco editor**: runs in a sandboxed iframe (`pages/editor-sandbox.html`) to allow `eval` (required by Monaco's tokenizer); sandboxed pages bypass extension CSP and can load the Monaco CDN; `monaco-adapter.js` intercepts `CodeMirror.fromTextArea` to return a compatible adapter
- **Offscreen document**: created on-demand by `ScriptAnalyzer._ensureOffscreen()` or sync logic; handles AST analysis and merge operations so the service worker stays lean; communicates via `chrome.runtime.sendMessage` with types prefixed `offscreen_`
- **Network proxy**: `buildWrappedScript` injects fetch/XHR/WebSocket/sendBeacon proxies into every user script; all captured traffic flows to `NetworkLog` via `netlog_record` message
- **3-way sync merge**: `_performSync()` detects concurrent edits via `script.syncBaseCode`; routes to offscreen `offscreen_merge`; falls back to last-write-wins on failure
- **Ed25519 signing**: keypair stored in `chrome.storage.local`; signature embedded as `@signature` metadata tag; trust store in `settings.trustedSigningKeys`

## Gotchas
- Version strings: manifest.json is source of truth; comment headers in content.js/popup.js/dashboard.js must match; dashboard reads dynamically from manifest via `chrome.runtime.getManifest().version`
- **Never edit `background.js` directly** — it is regenerated by `build-background.sh` from the source files
- `ResourceCache.fetchResource()` (not `.fetch()`) to avoid shadowing global fetch
- `self._notifCallbacks` initialized in storage.js, used in background.core.js GM_notification handler
- Dropbox uses PKCE auth code flow (not implicit grant) with state validation + refresh token
- `postMessage` uses `window.location.origin` targetOrigin in content.js (fixed from `'/'` in v1.7.1) — **exception**: the Monaco adapter uses the iframe's origin, and the sandboxed editor uses `'*'` because sandbox pages have null origin
- Bridge init key uses extension ID + `Object.defineProperty` to prevent page-level spoofing
- Dashboard DOM access: always null-check `elements.*` before `.textContent`/`.classList` assignment — many elements are optional
- `exportToZip` deduplicates filenames with `_2`, `_3` suffix counters
- `autoReloadMatchingTabs` is debounced (500ms) to prevent mass tab reloads
- `cleanupStaleCaches()` runs on init to prune expired `require_cache_*`, `res_cache_*`, trash entries, and tombstones >30 days
- Lint: `@grant none` + GM API usage shows `warning` severity (upgraded from `info` in v1.7.2). Unknown `@grant` values and invalid `@sandbox` values are `error` severity.
- **Side panel / DevTools must use `action:` key** (not `type:`) for background messages. Background returns `{ scripts: [...] }` — callers need `res?.scripts`. `setScriptSettings` expects `scriptId` not `id`.
- **GM_cookie_set/GM_cookie_delete** require `url` and `name` parameters (validated in v1.7.8)
- **GM_unregisterMenuCommand** handler added in v1.7.8 — previously calls were silently dropped
- **XHR local request IDs** use sequential counter `_xhrSeqId++` (not `Math.random`) to prevent collision
- **Notification callbacks** cleaned up on auto-timeout (not all platforms fire `onClosed`)
- **Menu commands** cleaned from session storage when a script is deleted
- **Offscreen document** validates `_sender.id === chrome.runtime.id` to reject cross-extension messages
- **Signing** uses base64url encoding for signatures (matching JWK `x` field format); verify converts back via `replace(/-/g, '+').replace(/_/g, '/')`
- `GM_info` has full Tampermonkey parity: uuid, scriptMetaStr, scriptWillUpdate, isIncognito, platform, downloadMode
- `GM.xmlHttpRequest` returns a Promise with `.abort()` method attached (not just a plain Promise)
- `window.onurlchange` intercepts pushState/replaceState/popstate/hashchange for SPA detection
- `GM_audio` provides tab mute control (setMute, getState) via chrome.tabs API
- `@top-level-await` wraps user script in async IIFE
- `@run-in` injects runtime guard for incognito/normal tab filtering
- `@tag` parsed as array, `@license`/`@copyright` as strings, `@contributionURL` as string, `@compatible`/`@incompatible` as arrays, `@webRequest` parsed as JSON
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
- Editor toolbar: comment toggle (//) button, word wrap toggle, snippet insert dropdown (7 snippets) — all route through Monaco adapter
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
- Script Folders: FolderStorage module in storage.js. CRUD operations. Drag scripts into folders. Collapsible folder headers in table. Folder color dots. "New Folder" button in toolbar. "Move to Folder" in script actions. Folder delete with confirmation.
- Build system: bg/ directory auto-included in build-background.sh
- Network Request Log: bg/netlog.js logs ALL network calls (GM_xmlhttpRequest + in-page fetch/XHR/WebSocket/sendBeacon). Dashboard UI with stats bar + scrollable log. HAR export. DevTools panel shows the same log.
- Workspaces: bg/workspaces.js manages named snapshots of enabled/disabled script states. Create/activate/save/delete. Dashboard UI with workspace list + switch/save/delete buttons. Activating a workspace re-registers all scripts.
- Performance Budgets: configurable default budget (ms) in settings. Per-script budget override. Scripts exceeding budget get purple right border (row-over-budget). Budget setting UI in Utilities panel.
- **Monaco editor**: `state.editor.isMonaco === true` — use this flag in dashboard.js to branch Monaco-specific behavior. `setFontSize(pct)` instead of DOM `.CodeMirror` CSS. `lintOnType` setOption is a no-op (Monaco handles its own error display). `clearHistory()` and `setCursor()` are no-ops.
- **Offscreen document**: `ScriptAnalyzer._ensureOffscreen()` creates it on first use with reason `DOM_SCRAPING`. Only one offscreen document can exist at a time; check with `chrome.offscreen.hasDocument()` before creating.
- **getNetworkLog** message handler now returns a flat array (not `{log, stats}`). Use `getNetworkLogStats` for stats separately.
- **syncBaseCode**: stored on each script after a successful sync; used as the 3-way merge ancestor. Cleared/overwritten after each merge. If absent, sync falls back to last-write-wins.
- **Ed25519 signing**: `@signature base64sig|base64pubkey|timestamp` embedded as last line before `==/UserScript==`. Strip the signature line before verifying (it wasn't included when signed). `settings.trustedSigningKeys` is a map of `{publicKey: {name, addedAt}}`.
- **Side panel**: responds to `chrome.tabs.onActivated` and `chrome.tabs.onUpdated` to refresh script list on navigation. Uses same `sendToBackground` pattern as popup.
- **DevTools panel**: auto-refreshes every 3s. `getNetworkLog` returns flat array; `getNetworkLogStats` for totals. HAR export uses `URL.createObjectURL` + programmatic `<a>` click.

## v1.7.0 → v1.7.8 Audit (2026-03-24, 4 rounds)

### v1.7.0 — Major Feature Release
- DevTools panel, Side panel, Script signing (Ed25519), Monaco editor adapter, Offscreen document
- New metadata: @contributionURL, @compatible, @incompatible, @webRequest
- Pre-release version comparison, parallel auto-update, user-modified sync skip
- Yjs + diff libraries for collaborative editing foundation
- background.js: 10,634 lines (up from 9,668)

### v1.7.1 — Security & Critical Bug Fixes
- **Security**: postMessage origin validation in content.js (`'/'` -> `location.origin`), Monaco adapter frame origin, offscreen sender ID validation, signing base64url encoding fix
- **Critical**: Side panel + DevTools were non-functional (`type:` -> `action:` message key), sidepanel `id` -> `scriptId`, duplicate `action:` key in new script button
- Duplicate script installations fixed (installFromUrl deduplicates by name+namespace)
- Popup dropdown click-inside fix, DevTools Promise.allSettled, sidepanel error recovery UI
- WebDAV null URL validation, random multipart boundary, token refresh logging, OneDrive data validation

### v1.7.2 — Linter & Install Page
- Linter severity: unknown @grant -> error, invalid @sandbox -> error, @grant none + API -> warning
- Install page: XSS fix (innerHTML -> textContent), auto-close race (clearTimeout on button click)
- GM_webRequest added to hints + grant values, duplicate hint directives removed
- Dashboard: updated column defaults to desc sort, network log cap 500 -> 2000

### v1.7.8 — Memory Leaks & Validation
- Added missing GM_unregisterMenuCommand handler (calls were silently dropped)
- Menu commands cleaned from session storage on script delete
- Notification callback cleanup on auto-timeout
- XHR local ID: Math.random -> sequential counter (_xhrSeqId)
- GM_cookie_set/delete: url+name validation
- Dashboard bulk enable/disable: try-catch per item, auto-delete .catch()

## Changes (2026-03-23)
- `worldId` per-script isolation: `registerScript` configures and assigns `worldId: script.id` (Chrome 133+); `unregisterScript` calls `resetWorldConfiguration`. Fallback to shared world on Chrome <133.
- `user-modified` sync flag: `saveScript` from editor passes `markModified: true` → sets `settings.userModified = true`. `CloudSync.sync()` skips overwriting scripts with `userModified = true`. Per-script settings panel shows "Lock from cloud sync" toggle.
- `GM_webRequest`: `@webRequest` parsed as JSON from metadata; `applyWebRequestRules`/`removeWebRequestRules` translate to `chrome.declarativeNetRequest.updateDynamicRules`. Runtime `GM_webRequest(rules, listener)` messages background. `declarativeNetRequest`+`declarativeNetRequestWithHostAccess` added to both manifests.
- Key renaming in storage editor: `createStorageItem` has ✏️ rename button + click-on-key-name UX. `renameScriptValue` message handler in background (read old → write new → delete old).
- `@contributionURL`, `@compatible`, `@incompatible` added to parser and info panel HTML/JS. Linter and hint autocomplete updated.
- Chrome 138 detection: `configureUserScriptsWorld` saves `_userScriptsAvailable`/`_chromeVersion` to settings. `getExtensionStatus` message returns version-aware `setupMessage`. Popup `checkUserScriptsAvailability` uses `getExtensionStatus` for accurate per-version guidance.

## Audit Round 3 (2026-03-23)
- `updateBadge()` all-tabs path parallelized: fetches settings+scripts once, passes them to `Promise.allSettled()` over all tabs — eliminates N redundant cache reads; `updateBadgeForTab(tabId, url, settings?, scripts?)` accepts pre-fetched params to avoid re-fetching per call
- GM_download safety timeout (`dlSafetyId`) now stored and cleared via shared `cleanupDlListener()` helper — prevents 5-minute timer from running after download already completed/errored; user timeout also uses `cleanupDlListener()`
- XHR async IIFE `.catch()` added — guards against any exception escaping the try/catch inside the fire-and-forget block; ensures `XhrManager.remove()` is always called
- `popup.js` `updateEmptyStateHint()` converted from `innerHTML` template string to safe DOM API (`createElement` / `textContent` / `appendChild`) — no XSS exposure even if template is later modified
- `bg/analyzer.js` 4 new risk patterns: prototype pollution (`__proto__`/`Object.setPrototypeOf`/`prototype[`), `document.domain` assignment, `postMessage` with wildcard origin (`*`), `Object.defineProperty` on global object — total patterns now 31 (then upgraded to full AST)

## Audit Round 2 (2026-03-23)
- Dropbox `getStatus()` null crash fixed: `user.name?.display_name || user.display_name || ''` (sync-providers.js)
- Workspace `activate()` N storage writes → 1 batch: mutates `ScriptStorage.cache` directly, calls `ScriptStorage.save()` once
- `saveScript` dashboard handler now enforces `MAX_SCRIPT_SIZE` (5MB) same as download handler
- `autoUpdate` `Promise.allSettled` failures now logged to console with error messages
- `CloudSync.sync()` refactored: 90s outer timeout via `Promise.race([_performSync(), timeoutPromise])` prevents indefinite hang; body extracted to `_performSync()`
- Sync tombstones: deleted script IDs stored in `syncTombstones` storage key; `_performSync()` skips tombstoned scripts so deleted scripts don't reappear after sync; tombstones propagate across devices via sync payload; `cleanupStaleCaches()` prunes tombstones >30 days
- Dashboard global `unhandledrejection` handler logs errors to activity log and console

## Performance & Reliability Audit (2026-03-23)
- `registerAllScripts()` parallelised with `Promise.allSettled` — scripts no longer register sequentially on startup
- `UpdateSystem.autoUpdate()` parallelised with `Promise.allSettled` — independent updates applied concurrently
- O(n²) fix in `importFromZip`/`importScripts`: `_importPosition` counter cached once before loop instead of re-querying length per iteration
- `UpdateSystem.applyUpdate` respects `userModified` flag: returns `{ skipped: true, reason: 'user-modified' }` without touching the script
- `compareVersions` handles pre-release suffixes: `1.0.0-beta` < `1.0.0` via `-.*$` strip + post-compare flag
- `CloudSync.sync()` mutex lock via `_syncInProgress` boolean in `finally` block — prevents concurrent sync runs
- `setScriptSettings` only re-registers on execution-affecting key changes (`EXEC_KEYS` allowlist); notes/autoUpdate/userModified changes skip re-registration
- `fetchWithRetry` 5MB response size cap: rejects via Content-Length header check and post-read body length check
- `cleanupStaleCaches()` now also prunes expired trash entries on init using the `trashMode` retention setting

## Bug Audit (2026-03-21)
- Fixed: NetworkLog duration calculation used `_netLogEntry.timestamp` which was undefined; replaced with dedicated `_netLogStartTime` variable
- Fixed: `state.folders`, `state._collapsedFolders`, `state._lastCheckedId`, `state._quotaWarned` not initialized in dashboard state object
- Fixed: `switchTab('help')` in command palette failed because help tab is a header icon, not a `.tm-tab`; added special case handling
- Verified: All version strings match (v1.7.8 across manifest, manifest-firefox, content.js, popup.js, dashboard.js)
- Verified: All bg/ modules load before background.core.js in build output
- Verified: `escapeHtml` available in popup.js (shared/utils.js loaded first)
- Verified: Column index mapping still correct after pin button addition (pin is inside actions TD, not a new column)

## Major Feature Additions (2026-03-23)

### Libraries Added
- `lib/acorn.min.js` — Acorn JS parser (v8.14.1, 114KB UMD) for AST-based static analysis in offscreen.js
- `lib/diff.min.js` — diff.js (v7.0.0, 24KB UMD) for 3-way text merge in offscreen.js

### Side Panel (`chrome.sidePanel`)
- `pages/sidepanel.html` + `pages/sidepanel.js` — persistent companion panel beside pages
- Shows scripts for current page with toggles, timing badges, error dots; live-updates on tab navigation
- `sidePanel` permission + `side_panel.default_path` in manifest

### DevTools Panel (`chrome.devtools`)
- `pages/devtools.html` — devtools registration page (`devtools_page` in manifest)
- `pages/devtools-panel.html` + `pages/devtools-panel.js` — Network/Execution/Console tabs; HAR export; auto-refresh every 3s

### Offscreen Document (`chrome.offscreen`)
- `offscreen.html` + `offscreen.js` — AST analysis (Acorn), 3-way merge (diff.js), diff generation
- `offscreen` permission in manifest; message types: `offscreen_analyze`, `offscreen_merge`, `offscreen_diff`, `offscreen_ping`

### AST-Based Static Analyzer (`bg/analyzer.js` v2)
- `ScriptAnalyzer.analyzeAsync()` routes to offscreen Acorn AST walk; regex fallback if unavailable
- 31 pattern detectors with zero false positives from comments/strings; results include `{line, col}` location

### Full Network Capture (script wrapper)
- `buildWrappedScript` injects fetch/XHR/WebSocket/sendBeacon proxies into every user script
- All traffic routes through `netlog_record` message → `NetworkLog.add()`
- `getNetworkLog` handler returns flat array; `getNetworkLogStats` for stats

### Ed25519 Script Signing (`bg/signing.js`)
- Keypair generated and stored in `chrome.storage.local`; signature embedded as `@signature` metadata tag
- Trust store in `settings.trustedSigningKeys`; Web Crypto Ed25519 requires Chrome 113+
- Message handlers: `signing_sign`, `signing_verify`, `signing_verifyRaw`, `signing_trustKey`, `signing_untrustKey`, `signing_getTrustedKeys`, `signing_generateNewKeypair`, `signing_getPublicKey`

### 3-Way Text Merge in Sync
- `_performSync()` routes concurrent edits through offscreen `offscreen_merge`
- `script.syncBaseCode` tracks last-synced code as merge ancestor; conflict markers are git-style
- `mergeConflict: true` stored in `script.settings` when automatic merge fails

### Monaco Editor (sandboxed iframe)
- `pages/editor-sandbox.html` — sandboxed page (eval allowed); loads Monaco v0.52.2 from jsdelivr CDN
- `pages/monaco-adapter.js` — intercepts `CodeMirror.fromTextArea`, returns Monaco-compatible adapter
- Custom themes: `sv-dark`, `sv-light`, `sv-catppuccin`; completion provider for userscript metadata
- CodeMirror stripped from dashboard; only lint CSS + lint JS kept

### Manifest Changes (manifest.json)
- New permissions: `sidePanel`, `offscreen`
- New keys: `side_panel`, `devtools_page`, `sandbox.pages`, `content_security_policy`
- CSP sandbox entry allows `https://cdn.jsdelivr.net` for Monaco CDN loading

### Build Artifacts
- `*.crx`, `*.zip`, `*.pem` added to `.gitignore` (v1.7.1)
- CRX built with OpenSSL RSA key (`scriptvault.pem`, gitignored)
- ZIP built via `build.sh` + 7-Zip (includes `offscreen.html`/`offscreen.js` added in v1.7.0)
