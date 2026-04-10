# ScriptVault

## Overview
Modern userscript manager built with Chrome Manifest V3. Tampermonkey-inspired functionality with cloud sync, auto-updates, a full dashboard, Monaco editor, DevTools panel, and a persistent side panel.

## Version
v2.1.3

## Tech Stack
- Chrome MV3 extension (JavaScript runtime + TypeScript source in `src/`)
- **TypeScript** (strict mode, `noUncheckedIndexedAccess`) with esbuild for bundling
- Background service worker (built from source modules via `esbuild.config.mjs`)
- `chrome.userScripts` API for script injection (USER_SCRIPT world, per-script worldId on Chrome 133+)
- `chrome.storage.local` for persistence (`unlimitedStorage` permission)
- **Monaco Editor** (v0.52.2, bundled locally in `lib/monaco/`, CDN fallback in sandboxed iframe)
- Cloud sync: WebDAV, Google Drive (PKCE), Dropbox (PKCE), OneDrive (PKCE), Easy Cloud (chrome.identity)
- Vitest test suite (15 test files, 370 test cases)
- background.js: ~16,333 lines (built from 19+ source modules)
- 37 TypeScript source files in `src/` (type-checked via `npm run typecheck`)

## Build
- `npm run build` — Concatenates source modules into `background.js` + copies Monaco
- `npm run build:bg` — Background.js only
- `npm run build:prod` — Minified production build
- `npm run build:monaco` — Copy Monaco to lib/monaco/ only
- `npm run dev` — Watch mode (rebuilds on source changes)
- `npm run typecheck` — Run TypeScript type-checker (`tsc --noEmit`)
- `npm run check` — Type-check + run tests
- `npm test` — Run Vitest test suite
- `npm run test:cov` — Run tests with coverage
- `bash build.sh` — Packages extension into CWS-ready ZIP
- **Never edit `background.js` directly** — edit source files in `bg/`, `modules/`, `shared/`, then rebuild
- Build order: shared/utils.js → lib/fflate.js → modules/sync-providers.js → modules/i18n.js → modules/storage.js → modules/xhr.js → modules/resources.js → v2.0 modules → bg/*.js → background.core.js

## TypeScript Source (`src/`)
The `src/` directory contains the TypeScript-typed mirror of the runtime JS modules. Currently used for type-checking only — the production build still concatenates the original JS files. The TS source will eventually replace the JS source.

### Type Definitions (`src/types/`)
- `script.ts` — `Script`, `ScriptMeta`, `ScriptSettings`, `ScriptStats`, `VersionHistoryEntry`
- `settings.ts` — `Settings`, `SyncProvider` (includes all sync provider fields: Google, Dropbox, OneDrive, plus `trustedSigningKeys`)
- `messages.ts` — Discriminated union of all 135+ background message types with `ResponseFor<T>` type mapping

### Typed Modules (`src/modules/`)
All 14 modules migrated: storage, xhr, resources, i18n, error-log, npm-resolve, notifications, sync-providers, sync-easycloud, backup-scheduler, userstyles, public-api, migration, quota-manager

### Background Sub-modules (`src/background/`)
The 6,100-line `background.core.js` split into 13 focused TypeScript modules:
- `parser.ts` — Userscript metadata parser
- `url-matcher.ts` — @match/@include/@exclude URL matching (9 exported functions)
- `registration.ts` — chrome.userScripts registration/unregistration
- `wrapper-builder.ts` — GM API wrapper code generation (~1,470 lines)
- `update-checker.ts` — Auto-update polling and application
- `cloud-sync.ts` — Cloud sync orchestration and merge
- `import-export.ts` — JSON/ZIP import and export
- `install-handler.ts` — Script install from URL + .user.js interception
- `resource-loader.ts` — @require fetching with SRI verification and CDN fallbacks
- `dnr-rules.ts` — DeclarativeNetRequest rule management
- `badge.ts` — Badge count management
- `tab-reload.ts` — Debounced tab reload after script changes
- `context-menu.ts` — Context menu and keyboard shortcut handlers
- `index.ts` — Barrel export re-exporting all sub-modules

### Background Service Modules (`src/bg/`)
All 4 bg/ modules migrated:
- `analyzer.ts` — AST-based static analysis (31 detectors, offscreen dispatch)
- `netlog.ts` — Network request logger
- `signing.ts` — Ed25519 script signing/verification (Web Crypto API)
- `workspaces.ts` — Workspace manager (named script state snapshots)

### Shared (`src/shared/`)
- `utils.ts` — escapeHtml, generateId, sanitizeUrl, formatBytes

## Key Files

### Background (service worker)
- `manifest.json` — Extension manifest (version source of truth)
- `background.core.js` — Main service worker logic (~6,146 lines)
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
- `modules/npm-resolve.js` — npm package resolution via CDN with SRI verification
- `modules/error-log.js` — 500-entry structured error log with JSON/CSV/text export
- `modules/notifications.js` — Smart notification system (update/error/digest)
- `modules/sync-easycloud.js` — Zero-config Google Drive sync via chrome.identity
- `modules/backup-scheduler.js` — Automated backup scheduling via chrome.alarms
- `modules/userstyles.js` — .user.css support with variable editor
- `modules/public-api.js` — External message API with rate limiting (deny-by-default origins)
- `modules/migration.js` — v1.x → v2.0 data migration
- `modules/quota-manager.js` — Dynamic quota management (uses navigator.storage.estimate)
- `shared/utils.js` — escapeHtml, generateId, sanitizeUrl, formatBytes

### Extension Pages
- `content.js` — Content script bridge (ISOLATED world ↔ USER_SCRIPT world, uses `'*'` targetOrigin for opaque-origin compatibility)
- `pages/popup.html/js` — Browser action popup (~773 lines, 360px wide)
- `pages/dashboard.html/js` — Full dashboard (~5,190 lines) with View Settings (zoom/density controls)
- `pages/install.html/js` — Userscript install confirmation page (~875 lines)
- `pages/sidepanel.html/js` — Persistent side panel (chrome.sidePanel, Chrome 114+)
- `pages/devtools.html` — DevTools panel registration page
- `pages/devtools-panel.html/js` — DevTools panel UI (Network/Execution/Console tabs)
- `pages/editor-sandbox.html` — Sandboxed iframe hosting Monaco editor (loads from lib/monaco/, CDN fallback)
- `pages/monaco-adapter.js` — Bridges dashboard.js CodeMirror API to Monaco iframe via postMessage

### Dashboard Modules (27 files in pages/)
- `dashboard-store.js` — Multi-source script store (Greasy Fork, OpenUserJS, GitHub)
- `dashboard-debugger.js` — Console capture, live reload, variable inspector, error timeline
- `dashboard-cardview.js` — Card view with favicons and status indicators
- `dashboard-keyboard.js` — Keyboard navigation with vim mode
- `dashboard-a11y.js` — WCAG 2.1 AA accessibility
- `dashboard-whatsnew.js` — Changelog modal per version (reads version from manifest)
- `dashboard-scheduler.js` — Time/day/date-based script scheduling
- `dashboard-theme-editor.js` — Custom theme editor with presets
- `dashboard-depgraph.js` — Force-directed dependency graph (DPR-aware, O(E) edge lookups via Map)
- `dashboard-sharing.js` — QR code/data URL script sharing
- `dashboard-i18n-v2.js` — i18n for all v2 modules (8 languages, 600 keys)
- `dashboard-gist.js` — GitHub Gist import/export (escapeHtml on all user/API data)
- `dashboard-templates.js` — Custom script template manager (icon field escaped)
- `dashboard-profiles.js` — Multi-profile support (listener cleanup in destroy, ReDoS-safe URL rules)
- `dashboard-collections.js` — Script collections/bundles
- `dashboard-csp.js` — CSP compatibility reporter (sequential rule IDs, no hash collisions)
- `dashboard-snippets.js` — 30+ code snippet library
- `dashboard-standalone.js` — Standalone HTML/bookmarklet export (safe minifier, no semicolon injection)
- `dashboard-firefox-compat.js` — Firefox compatibility polyfills (MV2/MV3 detection)
- `dashboard-pattern-builder.js` — Visual @match pattern builder
- `dashboard-diff.js` — Side-by-side diff with LCS algorithm
- `dashboard-chains.js` — Script chain execution
- `dashboard-gamification.js` — Achievements and activity tracking (icon field escaped)
- `dashboard-heatmap.js` — Activity heatmap visualization
- `dashboard-linter.js` — Script linting with auto-fix
- `dashboard-recommendations.js` — Script recommendations
- `dashboard-lazy-loader.js` — Module lazy loading system

### Offscreen / Libraries
- `offscreen.html` + `offscreen.js` — Offscreen document: AST analysis (with `locations: true`), 3-way merge, diff generation
- `lib/fflate.js` — ZIP compression library
- `lib/acorn.min.js` — Acorn JS parser (v8.14.1, 114KB UMD) — used in offscreen.js
- `lib/diff.min.js` — diff.js (v7.0.0, 24KB UMD) — used in offscreen.js for 3-way text merge
- `lib/monaco/` — Monaco Editor v0.52.2 (bundled locally, built via `npm run build:monaco`)

### Tests (tests/)
- `tests/utils.test.js` — 51 tests for shared utilities (includes TB overflow, clamping)
- `tests/parser.test.js` — 38 tests for userscript parser (includes locales, duplicates, CRLF)
- `tests/versions.test.js` — 26 tests for version comparison
- `tests/analyzer.test.js` — 62 tests for risk pattern detection + analyze() + entropy + comment stripping
- `tests/storage.test.js` — 21 tests for SettingsManager, ScriptStorage, FolderStorage (rollback, init idempotency, bulk set)
- `tests/error-log.test.js` — 11 tests for ErrorLog (FIFO cap, filters, grouping, JSON/text export)
- `tests/public-api.test.js` — 16 tests for PublicAPI (ping, permissions, rate limiting, webhooks, trusted origins, audit)
- `tests/signing.test.js` — 8 tests for ScriptSigning (trust store, extraction, verify guards)
- `tests/workspaces.test.js` — 11 tests for WorkspaceManager (create, activate, snapshot, delete)
- `tests/resources.test.js` — 8 tests for ResourceCache (get/set, expiration, persistence, clear, prefetch)
- `tests/xhr.test.js` — 11 tests for XhrManager (create, abort, controller, bulk abort, count)
- `tests/npm-resolve.test.js` — 15 tests for NpmResolver (parseSpec, CDN URLs, sanitize, popular packages)
- `tests/netlog.test.js` — 31 tests for network log
- `tests/core-flows.test.js` — 20 tests for install/toggle/update/rollback/save flows
- `tests/url-matcher.test.js` — 77 tests for URL matching (match patterns, includes, excludes, regex, globs, IDN)
- `tests/setup.js` — Chrome API mocks for Vitest

## Architecture
- Source modules are inlined into `background.js` at build time (Chrome MV3 service workers don't reliably support importScripts)
- Scripts registered via `chrome.userScripts.register()` with wrapped GM API code
- Content script bridge forwards messages between USER_SCRIPT world and background (uses `'*'` targetOrigin for opaque origins like `data:`, `blob:`, `about:blank`)
- `chrome.runtime.onUserScriptMessage` used for direct USER_SCRIPT → background messaging (Chrome 131+)
- Regex @include patterns: extracted into broad match patterns for registration, fine-filtered at runtime
- **Monaco editor**: runs in a sandboxed iframe (`pages/editor-sandbox.html`) to allow `eval` (required by Monaco's tokenizer); loads from `lib/monaco/` with CDN fallback; `monaco-adapter.js` intercepts `CodeMirror.fromTextArea` to return a compatible adapter (uses `new URL(frame.src, location.href).origin` with fallback to `'*'`)
- **Offscreen document**: created on-demand by `ScriptAnalyzer._ensureOffscreen()` or sync logic; handles AST analysis and merge operations so the service worker stays lean; communicates via `chrome.runtime.sendMessage` with types prefixed `offscreen_`
- **Network proxy**: `buildWrappedScript` injects fetch/XHR/WebSocket/sendBeacon proxies into every user script; all captured traffic flows to `NetworkLog` via `netlog_record` message
- **3-way sync merge**: `_performSync()` detects concurrent edits via `script.syncBaseCode`; routes to offscreen `offscreen_merge`; falls back to last-write-wins on failure
- **Ed25519 signing**: keypair stored in `chrome.storage.local`; signature embedded as `@signature` metadata tag; trust store in `settings.trustedSigningKeys`
- **Lazy loading**: `dashboard-lazy-loader.js` manages EAGER_MODULES (loaded at startup), TAB_MODULES (loaded on tab switch), EDITOR_MODULES (loaded on editor open), ON_DEMAND_MODULES (loaded on user action)
- **Per-script chained mutex**: `toggleScript` uses `self._toggleLocks` Map with `.then()` chaining to serialize 3+ rapid toggles per script
- **Cache rollback**: `ScriptStorage.set()` rolls back cache on persist failure (e.g., quota exceeded)
- **View Settings**: Dashboard has zoom (85%-150%) and density (compact/comfortable/spacious) controls, persisted to localStorage

## UX/UI
- **Zoom control**: Dashboard View Settings bar with 6 scale levels (85%-150%) via `--ui-scale` / `--base-font` CSS variables
- **Density control**: Compact, Comfortable (default), Spacious — adjusts table/tab padding via `data-density` attribute
- **Responsive breakpoints**: 4 breakpoints (1280px, 1024px, 768px, 600px) progressively hide table columns and adapt layout
- **Max-width container**: All `.tm-panel` content areas capped at `1600px` to prevent ultra-wide stretch
- **Focus-visible**: All pages (dashboard, popup, sidepanel, install) have `:focus-visible` styles on every interactive element (WCAG 2.1 AA 2.4.7)
- **Firefox scrollbar**: `scrollbar-width: thin; scrollbar-color` applied globally alongside WebKit scrollbar styling
- **4 themes**: dark, light, catppuccin, oled — all define 10 accent variables (`--accent-green/red/yellow/blue/orange/purple`, `--toggle-on/off`, `--bg-row/selected`)
- **Accessibility**: Popup submenu items have `role="button"` + `tabindex="0"`; sidepanel buttons have `aria-label`; all pages have `<meta name="viewport">`

## Gotchas
- Version strings: manifest.json is source of truth; `chrome.runtime.getManifest().version` used dynamically
- **Never edit `background.js` directly** — it is regenerated by `esbuild.config.mjs` from the source files
- `ResourceCache.fetchResource()` (not `.fetch()`) to avoid shadowing global fetch
- `self._notifCallbacks` lazily initialized in background.core.js GM_notification handler (`if (!self._notifCallbacks) self._notifCallbacks = new Map()`)
- `self._openTabTrackers` lazily initialized in background.core.js GM_openInTab handler
- Dropbox uses PKCE auth code flow (not implicit grant) with state validation + refresh token
- `postMessage` in content.js uses `'*'` targetOrigin (safe because channel-ID authentication is in place)
- Monaco adapter uses `new URL(frame.src, location.href).origin` with fallback to `'*'` to avoid crash on relative src
- Bridge init key uses extension ID + `Object.defineProperty` to prevent page-level spoofing
- Dashboard DOM access: always null-check `elements.*` before `.textContent`/`.classList` assignment — many elements are optional
- `autoReloadMatchingTabs` is debounced (500ms) to prevent mass tab reloads
- Toggle always reloads matching tabs (not gated by autoReload setting)
- **Side panel / DevTools / all modules must use `action:` key** (not `type:`) for background messages
- Background returns `{ scripts: [...] }` — callers need `res?.scripts`
- `setScriptSettings` expects `scriptId` not `id`, with `settings: { enabled }` sub-object
- `state.editor.isMonaco === true` — use this flag in dashboard.js to branch Monaco-specific behavior
- `ScriptStorage.get()` returns a reference to the cached object (not a copy) — mutations affect the cache directly
- `isRegexPattern` requires regex metacharacters to avoid false positives on URL paths like `/path/to/file/`
- Version history: `script.versionHistory` array (max 5 entries), consistent across `applyUpdate` and `rollbackScript`
- `public-api.js` denies all web origins by default when `_trustedOrigins` is empty
- Webhook URLs must be `https://` (validated in `setWebhook`)
- `quota-manager.js` uses `navigator.storage.estimate()` for dynamic quota, not hardcoded 10MB
- `dashboard-firefox-compat.js` detects MV3 promise-returning APIs to avoid double-resolve with callback
- `lazyInitTab()` must be awaited — the `_tabInited` guard is set BEFORE the await to prevent race conditions, rolled back on failure
- Context menu and keyboard shortcut toggle-all calls `registerAllScripts()` after changing the enabled setting
- Sidepanel checks `@exclude`/`@exclude-match` patterns and handles `<all_urls>`; rejects URLs > 2048 chars entirely (ReDoS guard)
- Sidepanel reads `settings.theme || settings.layout || 'dark'` to support both setting keys
- Install page Enter key only triggers install when install button is focused (`document.activeElement === btn`)
- Install page icon URLs validated with `sanitizeUrl()` before rendering in `<img src>`
- Linter fix-all processes one fix per pass with re-lint (max 5 passes) to prevent index corruption
- `parseUserscript` localized metadata uses `indexOf(':')` + `slice()` to preserve multi-segment locales like `@name:zh-Hans`
- `formatBytes` includes TB unit and `Math.min` clamp to prevent `sizes[i]` overflow
- Dashboard diff view uses LCS-based algorithm (not naive positional comparison)
- Editor undo history saved/restored per tab via `getHistory()`/`setHistory()`
- Bulk delete requires confirmation dialog (unlike single delete)
- `#settingsPanel` (not `#settingsTab`) is the correct selector for config mode filtering
- Dashboard `--header-height` fallback is `35px` everywhere (was inconsistent at 90px in some places)
- DevTools panel `refreshTimer` is stored and cleared on re-init to prevent interval leaks
- `dashboard-profiles.js` stores listener refs for `onActivated`/`onUpdated` and removes them in `destroy()`
- `dashboard-profiles.js` rejects regex URL rules > 200 chars to prevent ReDoS
- `dashboard-gist.js` has `escapeHtml()` and uses it on all user/API data in innerHTML
- `dashboard-csp.js` uses sequential per-hostname rule IDs (not hash-based) to avoid DNR collisions
- `dashboard-depgraph.js` applies DPR scale per render frame and uses Map for O(1) edge endpoint lookups

## Known Remaining Issues (lower priority)
- Stats mutations (reportExecTime/reportExecError) theoretically race-able if a handler constructs a new stats object (safe in practice due to reference semantics)
- `dashboard-gist.js` encryption uses hardcoded key derivation (security theater — chrome.storage.local is already sandboxed)
- Canvas `roundRect` used natively (safe: minimum_chrome_version is 120)
- `BackupScheduler` stores full ZIP blobs in chrome.storage.local (inefficient for large collections)
- `setTimeout` used in MV3 service worker for sync debounce (5s, acceptable given 30s worker lifetime)
- `dashboard-pattern-builder.js` regex construction is fragile for edge-case patterns
- `dashboard-diff.js` LCS uses Uint16Array (safe under current 5M guard but fragile if threshold raised)
- All font sizes in px (ignores user browser font-size preferences; should migrate to rem)
- ResponseMap in `src/types/messages.ts` only covers ~25 of 135+ actions (rest return `unknown`)

## Deleted Modules (removed in v2.0.0 as bloat)
- `dashboard-ai.js` — AI assistant (removed: no value)
- `dashboard-analytics.js` — Analytics with charts (removed: bloat)
- `dashboard-performance.js` — Performance dashboard (removed: bloat)
- `dashboard-onboarding.js` — Welcome wizard (removed: bloat)
- `dashboard-openuserjs.js` — Standalone OpenUserJS tab (replaced by unified store search)
- `lib/yjs.*.js` — Yjs collaborative editing libraries (removed: unused, 605KB)
- Various unused CodeMirror addons (dialog, edit, fold, hint, search)

## Deleted Files (cleanup)
- `jsconfig.json` — Redundant with tsconfig.json (removed)
- 20 old release artifacts (ScriptVault-v1.7.x and v2.0.1 .crx/.zip files, ~14MB — removed)

## Bug Fix History

### v2.0.1 Round 1 — Critical Structural Bugs (2026-03-24)
- `initV2Modules` empty body — stray `}` from Edit tool caused all module inits to float outside function
- Store `safeInit` missing closure — incomplete edit nested all subsequent modules
- `install.js` escaped backticks — template literals had `\`` instead of backticks
- `esbuild.config.mjs` missing v2.0 modules

### v2.0.1 Round 2 — Core Flow Hardening
- `setScriptSettings` didn't persist `enabled` — field set AFTER `ScriptStorage.set()`, now set before
- CardView `onToggle` called nonexistent `toggleScript` → fixed to `toggleScriptEnabled`
- Save order: `unsavedChanges = false` moved AFTER `loadScripts()` succeeds
- Trash table CSS class: `script-table` → `scripts-table`
- Toggle race condition: added per-script mutex via `self._toggleLocks` Map
- `ScriptStorage.set()` cache rollback on persist failure
- `lazyInitTab` guard moved before await to prevent duplicate inits
- Sidepanel ReDoS: URL length capped at 2048 before regex test
- What's New version now from `chrome.runtime.getManifest().version`, only shows on major.minor changes
- Trusted author input validation (200 char limit, control char stripping, 100 author cap)
- Store made eager-loaded (was lazy, appeared empty)
- Toggle always reloads matching tabs

### v2.0.1 Round 3 — Deep Audit (67 bugs found, 22 fixed)
- Migration reads/writes wrong storage keys → now uses `userscripts` key
- Public API reads wrong key / accepts all origins / SSRF → fixed all three
- Webhook URL validation, context menu toggle, isRegexPattern, debugger, chains, collections fixes
- Version history limits, What's New listener leak, heatmap, linter, sidepanel, install, quota, backup, firefox-compat fixes

### v2.0.1 Round 4 — Runtime Bugs + TypeScript Migration (2026-03-25)
- Popup toggle/delete don't update `allScripts` or footer count → both arrays updated + `updateFooterCount()` called
- Popup error state innerHTML XSS pattern → replaced with safe DOM construction
- Content.js postMessage fails on opaque origins → switched to `'*'` (channel-ID auth in place)
- Offscreen.js AST parse missing `locations: true` → line numbers now appear in risk findings
- Offscreen.js only first long string checked for entropy → now checks ALL and reports highest
- Netlog.js error counting inconsistent → unified `isError` check across total/byScript/byDomain
- Store pagination threshold too high for multi-source → lowered to 10
- formatBytes TB overflow → added `'TB'` unit + `Math.min` clamp
- parseUserscript locale truncation → `indexOf`/`slice` preserves `@name:zh-Hans`
- core-flows.test.js wrong version history assertion → fixed to match actual `slice(-5)` behavior

### v2.0.1 Round 5 — Background + Dashboard Deep Fixes
**Background (6 fixes):**
- `self._notifCallbacks` crash → lazy-init Map
- `self._openTabTrackers` crash → lazy-init Map on self
- Toggle mutex race for 3+ toggles → `.then()` chaining with conditional cleanup
- DNR rule ID hash collisions → expanded from 10M to 2B range (21-bit hash + 10-bit index)
- `updateBadge(tabId)` was a no-op → added branch for specific tab via `chrome.tabs.get()`
- `parseUserscript` locale truncation (also in Round 4)

**Dashboard (8 fixes):**
- Bulk delete no confirmation → added `showConfirmModal`
- Editor undo history lost on tab switch → save/restore `getHistory()`/`setHistory()`
- Diff view naive positional comparison → LCS-based algorithm
- beautifyCode cursor jump → cursor to top after reformat
- Double `LazyLoader.loadForTab` calls → removed redundant duplicate calls
- `#settingsTab` wrong selector → `#settingsPanel`
- Keyboard Shift+Arrow selection did nothing → `change` event instead of `click`
- Standalone minifyJS broke bookmarklets → safe line-trimming instead of newline→semicolon

**Security (4 fixes):**
- Gist module XSS → added `escapeHtml()` helper, sanitized all innerHTML injection points
- Templates XSS via icon field → escaped with `escHtml()`
- Gamification XSS via `a.icon` → escaped with `esc()`
- Install.js icon URL → validated with `sanitizeUrl()` before `<img src>`

**Module fixes (6):**
- Profiles listener leak → stored refs, removed in `destroy()`
- Profiles ReDoS → reject regex patterns > 200 chars
- CSP hash collisions → sequential per-hostname rule IDs
- Depgraph blurry on HiDPI → DPR scale per render frame
- Depgraph O(N*E) per frame → Map for O(1) edge endpoint lookups
- DevTools interval leaks → both panel.js and panel-v2.js now clear previous timers

**Other (5 fixes):**
- Monaco adapter URL crash → `new URL(frame.src, location.href)` with `'*'` fallback
- Install Enter key fires immediately → restricted to focused install button
- Install auto-close removed → user closes manually
- Sidepanel URL truncation → reject URLs > 2048 instead of truncate
- Removed 20 old release artifacts (~14MB)

### v2.0.1 Round 6 — UX/UI Overhaul
**Dashboard:**
- Added View Settings bar with zoom (85%-150%) and density (compact/comfortable/spacious) controls
- Added 4 responsive breakpoints (1280px, 1024px, 768px, 600px) that progressively hide columns and adapt layout
- Added max-width container (1600px) to prevent ultra-wide stretch
- Added 10 missing CSS variables to all 4 themes (`--accent-green/red/yellow/blue/orange/purple`, `--toggle-on/off`, `--bg-row/selected`)
- Fixed toolbar gap asymmetry (5px vs 6px → both 6px)
- Fixed new-script tab vertical misalignment (padding matched to siblings)
- Fixed `--header-height` CSS variable fallback inconsistency (unified to 35px)
- Added Firefox scrollbar styling (`scrollbar-width: thin`)

**Accessibility (all pages):**
- Added `:focus-visible` styles to dashboard, popup, sidepanel, and install page
- Popup: added `role="button"` + `tabindex="0"` to Utilities and all submenu items
- Sidepanel: added `aria-label` to Unicode-only buttons, added `<meta name="viewport">`
- Install: added focus-visible for buttons and inputs

**DX:**
- Removed jsconfig.json (redundant with tsconfig.json)
- Added npm scripts: `dev`, `build:prod`, `test:cov`
- Moved jsdom to devDependencies

### v2.0.2 — Bug Fixes & Quality (2026-03-27)
**Critical:**
- Dashboard `state.activeScriptId` → `state.currentScriptId` — editor undo history was never saved on tab switch (history lost every time)
- `toggleScriptEnabled` null check on `btnEditorToggle` — TypeError if button not in DOM

**Download race fix (18 sites):**
- All `URL.revokeObjectURL()` calls now use `setTimeout(() => ..., 1000)` instead of revoking immediately after `a.click()` — prevents download failures on slow systems
- Fixed in: dashboard.js (7), popup.js (1), devtools-panel.js (1), dashboard-csp.js (1), dashboard-collections.js (1), dashboard-depgraph.js (1), dashboard-sharing.js (2), dashboard-theme-editor.js (1), dashboard-templates.js (1)

**QR code generator (dashboard-sharing.js):**
- Masking now uses `isFunction` array instead of broken `isDataModule()` check — alignment patterns were getting corrupted by mask, making QR codes unscannable
- Removed inaccurate `isDataModule()` function

**Service worker alarm safety:**
- Notification auto-close uses `chrome.alarms` for timeouts >= 30s (survives service worker shutdown)
- Added `notif_clear_*` alarm handler in `onAlarm` listener

**UI fixes:**
- `dashboard-scheduler.js`: Wrapping time range slider now shows both segments (10PM→midnight + midnight→6AM) instead of only the end portion
- `dashboard-snippets.js`: Search cursor position preserved when typing mid-string (was jumping to end)
- `dashboard-standalone.js`: Syntax highlighting uses token extraction to prevent double-wrapping keywords inside strings/comments
- `dashboard.js`: `lazyInitTab` failure now shows toast error instead of silently leaving blank tab
- `dashboard.js`: Command palette input has `aria-label` for screen readers
- `dashboard.js`: `createStorageItem` handles null values (was producing `"null"` string)

**Security:**
- CDN URL in library search validates `lib.name`/`lib.version`/`lib.filename` against path traversal (`../`, backslashes) and uses `encodeURIComponent`

**Dead code cleanup:**
- `syncWithProvider` now passes `provider` parameter to background (was dead param)
- Removed ESLint from npm scripts (not installed, `npm run lint` was broken)
- `package.json` version synced to 2.0.2

**GM API callback fixes (background.core.js):**
- Added `chrome.notifications.onClicked` listener — GM_notification `onclick` callbacks now fire
- Added `chrome.notifications.onClosed` listener — GM_notification `ondone` callbacks now fire, `_notifCallbacks` cleaned up
- Added `chrome.tabs.onRemoved` listener — GM_openInTab `onclose` callbacks now fire, `_openTabTrackers` cleaned up

**Backup restore fix (backup-scheduler.js):**
- `restoreBackup()` was calling `ScriptStorage.save()` with wrong signature (save takes no args) — scripts were silently not restored
- Now uses `ScriptStorage.set(scriptId, script)` with proper ID generation (existing match or new ID)
- `ScriptValues.setAll()` now receives `scriptId` instead of script name

**Notification context cleanup (notifications.js):**
- `_setClickContext` replaced 5-minute `setTimeout` with `chrome.alarms` (survives SW shutdown)
- Added `notifCtx_clean_*` alarm handler in background.core.js

**Popup improvements:**
- Per-script menu commands in dropdown (fetches from chrome.storage.session, executes via tab message)
- Blacklist domain toggle — shows "Remove from blacklist" if domain already blacklisted, one-click remove
- Last-updated relative time in script tooltip (timeAgo helper)

**Performance & data safety:**
- `NetworkLog.add()`: O(1) push instead of O(N) unshift, reversed on read
- `FolderStorage.addScript/removeScript`: cache rollback on persist failure

**Misc:**
- `content.js`: bridgeReady postMessage uses `'*'` consistently (was `'/'` which fails on opaque origins)

**New APIs & editor features:**
- `GM_head(url, callback)` — convenience wrapper for HEAD requests (requires `@grant GM_xmlhttpRequest`)
- Ctrl+G Go to Line in editor (CodeMirror + Monaco) + command palette entry
- Added `GM_head` to linter known globals

**Crash fix:**
- `dashboard-collections.js` line 681: called undefined `_renderCollectionDetail` → fixed to `renderExpandedScripts(card, coll, installed)`

**Install page UX:**
- Enter key now works from anywhere (was restricted to focused install button only)
- Code preview toggle has `aria-expanded` + `aria-controls`
- Downgrade button: improved font-weight for OLED readability

**Sidepanel UX:**
- Sort options deduplicated: "default" is now install order, added "Recently Updated" option
- Perf/errors sort has secondary tiebreaker by name
- Timing badge colors and toggle slider use CSS variables (theme-aware)
- `aria-label` on search input and sort select

**Popup accessibility:**
- Header toggle has `aria-pressed` for screen readers

**GM API wrapper fixes (background.core.js):**
- `sendToBackground` postMessage targetOrigin `'/'` → `'*'` (messages failed on opaque origins)
- `GM_getTab/saveTab/getTabs`: added missing grant checks (security)
- `GM_notification` highlight: clean up `_notifCallbacks` on early return (memory leak)
- `GM_getMenuCommands`: returns `caption` field (was returning `id` twice)
- `GM_registerMenuCommand`: stores `{callback, caption}` tuple
- `GM_download`: delete callback entry after error (leak on failure)

**Cloud sync token safety (sync-providers.js):**
- Google Drive, Dropbox, OneDrive: clear stale tokens on 400/401 refresh failure (prevents infinite retry loops)
- Merge conflict flag now set even when 3-way merge fails (was silent last-write-wins)

**Tests:**
- New `storage.test.js`: 21 tests (SettingsManager, ScriptStorage, FolderStorage + rollback)
- New `error-log.test.js`: 11 tests (FIFO cap, filters, grouping, exports)
- Fixed `chrome.storage.local.get()` mock to match real Chrome behavior
- Added `__resetStorageMock()` helper, fixed notification mock return value
- 307 total tests (was 275)

**New metadata directives:**
- `@nodownload` — prevents automatic updates for the script
- `@delay <ms>` — postpones script execution by N milliseconds (wraps in setTimeout)

**Additional tests:**
- `signing.test.js`: 8 tests (trust store, signature extraction)
- `workspaces.test.js`: 11 tests (create, activate, snapshot, delete)
- `public-api.test.js`: 16 tests (ping, permissions, rate limiting, webhooks)
- Netlog tests rewritten to import actual source (was stale copy with unshift)
- @nodownload and @delay parser tests added
- 370 total tests across 15 files

**Bug fixes (round 4 continued):**
- Public API `getScripts()` returned object not array — `.find()` was broken
- Gist `loadToken()` race: callback-wrapped Promise → direct await
- Pattern builder ReDoS: 500-char length cap + bounded wildcard
- Firefox build now uses esbuild pipeline

### v2.0.2 Round 2 — Full Audit & Repair (2026-03-29)
**Security (5 fixes):**
- `GM_addElement` innerHTML XSS — sanitizes script tags, event handlers, javascript: URIs
- `@connect self` was unconditional allow — now checks script @match domains
- `GM_loadScript` had no @connect enforcement — now applies same rules as GM_xmlhttpRequest
- Public API web install SSRF — validates HTTPS-only, rejects internal/private IPs
- OneDrive OAuth missing CSRF `state` parameter — added state validation

**Logic bugs (9 fixes):**
- `setupAlarms` `clearAll()` wiped notification/backup alarms — now only clears autoUpdate/autoSync
- `_toggleLocks` Map leaked entries — cleanup moved to `.finally()` block
- `rollbackScript` left duplicate entries in version history — now removes target before push
- `mergeData` returned object without tombstones — remote sync lost deletion info
- `pendingInstall` left stale on non-userscript early return — now cleared
- Public API `toggleScript`/`installScript` used array format — fixed for object storage format
- Public API `getInstalledScripts` returned `s.name` instead of `s.meta?.name`
- Notification error counts never reset after dispatch — now reset to 0
- Digest alarm skipped recreation if existing — now clears and recreates
- Notification context cleanup alarms (`notifCtx_clean_*`) were silently ignored — now handled
- Quota manager `userscripts` key misattributed to `other` — now in `scripts` category
- Backup selective restore matched by name only — now uses `name::namespace` composite key

**Race condition fixes (2):**
- `_ensureOffscreen()` concurrent calls created duplicate documents — serialized via promise
- EasyCloud debounce used `setTimeout` (lost on SW shutdown) — now uses `chrome.alarms`

**Dashboard fixes (5):**
- `dashboard-linter.js` `api.replace('.', '\\.')` only escaped first dot — now uses `/\./g`
- `dashboard-csp.js` rule IDs were non-persistent counters — now uses deterministic hash
- `dashboard-whatsnew.js` version mismatch caused infinite re-check — marks seen even without entry
- `dashboard-debugger.js` double-init leaked interval timers — now clears on re-init
- `dashboard-profiles.js` `_startUrlWatcher` could register duplicate listeners — added guard

**Other fixes (4):**
- Dropbox upload used stale token — now calls `getValidToken()` before upload
- `content.js` bridge globals (`__ScriptVault_ChannelID__`) were writable — now `Object.defineProperty` non-writable
- `bg/signing.js` regex mismatch between sign and verify — aligned to `\n?` (optional trailing newline)
- `bg/analyzer.js` `_ensureOffscreen` race — serialized with cached promise
- `pages/install.js` `@resource` name prototype pollution — rejects `__proto__`/`constructor`/`prototype`

**Test infrastructure (2 fixes):**
- Vitest worker timeouts on VMware FS — `fileParallelism: false` fixes all 15 test files
- `tests/setup.js` missing mocks — added `tabs.sendMessage/get`, `action`, `webNavigation`, `cookies`, `sidePanel`, `commands`, `scripting.executeScript`

**Totals:** 27 fixes across 14 files. 370/370 tests green.
- background.js: 16,333 lines

### v2.0.4 — Comprehensive Audit (2026-04-01)
**Security (5 fixes):**
- Empty `@grant` array now correctly denies all permissions (was granting ALL — critical)
- `@connect` enforcement: URL parse failure in catch block now returns error instead of silently allowing request
- `GM_addElement` innerHTML sanitization: case-insensitive check for `javascript:`/`vbscript:` URIs + attr names
- `signing.js` `trustKey()`: rejects `__proto__`/`constructor`/`prototype` keys (prototype pollution)
- Monaco adapter: postMessage listener now validates `e.source === frame.contentWindow`

**Crash/logic bugs (10 fixes):**
- `ScriptStorage.search()` crashed on scripts with missing `meta.name` — added null-safe access
- `ScriptStorage.getByNamespace()` crashed on missing `meta` — added optional chaining
- `ScriptStorage.duplicate()` crashed on missing `meta.name` — added fallback
- `toggleScript` accepted `undefined` for `enabled` — now coerces to boolean or toggles
- Context menu `new URL(tab.url)` crashed on chrome:// tabs — wrapped in try/catch with guard
- `GM_cookie.list/set/delete` crashed on undefined result from bridge timeout — added `?.` null checks
- `_makeRuleId` returned 1 for zero-hash causing DNR rule ID collisions — changed `|| 1` to `+ 1`
- `requireCache.set(url, ...)` used wrong key (with SRI fragment) — now uses `fetchUrl`
- Signing: Windows `\r\n` line endings caused signature verification failure — regex updated to `[^\r\n]+\r?\n?`
- Signing: signature insertion failed with non-standard `==/UserScript==` whitespace — now uses regex

**Performance (5 fixes):**
- Backup import handlers (TM/VM/GM) called `getAll()` inside loops (O(N*M)) — cached before loop
- `resources.js` O(N^2) string concatenation for binary resources — chunked `String.fromCharCode.apply`
- `_urlChangeHandlers` array grew unboundedly (no dedup) — added `includes()` guard before push
- `console capture` unbounded spread of `data.entries` — capped incoming to 200 before spread
- `_audioWatchedTabs` Set never cleaned on tab close — added cleanup in `tabs.onRemoved` listener

**Robustness (5 fixes):**
- Workspaces `activate()` bypassed `ScriptStorage.set()` rollback safety — now uses `set()` per script
- Background task mutex deadlock on hung sync/update — added 5-minute safety timeout
- `matchIncludePattern` ReDoS via crafted glob patterns — collapse consecutive `*` before conversion
- `GM_getResourceURL` defaulted to blob URLs (leak) when callers omitted arg — now defaults to data URI
- Notification `_errorCounts` not persisted after reset — now saved alongside `_rateLimits`

**Dashboard (7 fixes):**
- `dashboard-heatmap.js`: `innerHTML +=` destroyed previously-appended DOM children — use `appendChild`
- `dashboard-standalone.js`: 5 `revokeObjectURL` calls too early (100ms or sync) — all delayed to 1000ms
- `dashboard-profiles.js`: `_urlWatcherStarted` not reset on `destroy()` — blocks re-init; fixed
- `dashboard-chains.js`: shallow step copy let editor mutations bypass cancel — deep copy with `map(s => ({...s}))`
- `dashboard-diff.js`: LCS `Uint16Array` overflows at 65535 — upgraded to `Uint32Array`
- `dashboard-linter.js`: same `Uint16Array` overflow — upgraded to `Uint32Array`
- `devtools-panel.js`: HAR export hardcoded version `1.7.8` — now reads from manifest

**Other (4 fixes):**
- Monaco adapter `'null'` origin string is truthy, `'*'` fallback never triggered for sandbox — added check
- `offscreen.js` AST walker created circular `parent` refs preventing GC — now uses `_parent` + cleanup
- `offscreen.js` `resolveWithMarkers` had dead `localDiff`/`remoteDiff` variables — removed
- `i18n.js` regex injection via placeholder keys — now escapes special regex chars
- `signing.js` extract regex aligned to handle `\r\n` consistently

**Totals:** 36 fixes across 16 files. 374/374 tests green.
- background.js: 16,673 lines

### v2.0.4 Round 2 — Deep Audit (2026-04-04)
**6 bugs found and fixed across 4 files:**
- `offscreen.js` `handleMerge()` rejected empty string code — `!base` is falsy for `""` which is valid code; changed to `== null` check
- `public-api.js` `installScript` handler had `Array.isArray(data) ? data : data` no-op — removed dead variable, code below already handles both formats
- `public-api.js` `toggleScript` handler had unused `scripts` variable (dead code from format normalization) — removed
- `public-api.js` web install handler (`scriptvault:install`) assumed array storage format but `userscripts` is object → `.findIndex()` crash on object — now handles both array and object formats
- `dashboard-heatmap.js` `destroy()` didn't clear `_dayMap` — stale pixel-to-date mappings leaked across re-inits
- `quota-manager.js` `getUsage()` division by zero if `quotaLimit` resolved to 0 — added `> 0` guard

**Totals:** 6 fixes across 4 files. 486/486 tests green.
- background.js: 16,679 lines

### v2.0.4 Round 3 — Deep Audit (2026-04-04)
**8 bugs found and fixed across 5 files (8 parallel agents, full codebase scan):**

**Cloud sync data integrity (4 fixes):**
- `sync-providers.js` Dropbox `upload()` used null token from `getValidToken()` → `Bearer null` header silently failed — added null check + throw
- `sync-easycloud.js` 3-way merge rejected empty string base code (`if (base && ...)` falsy for `""`) — changed to `base != null`
- `sync-easycloud.js` merge failure fell back to last-write-wins without setting `mergeConflict` flag — user had no idea changes were lost; now flags conflict
- `background.core.js` `mergeData()` iterated `local.scripts`/`remote.scripts` without null guard — malformed backup crashes sync; added `|| []`

**Sync ghost scripts (1 fix):**
- `background.core.js` `mergeData()` returned tombstoned scripts in output — deleted scripts reappeared after re-upload; now filters tombstoned entries from merged result

**Badge + memory (2 fixes):**
- `background.core.js` `importScripts()` called `registerAllScripts()` but not `updateBadge()` — badge count stale after JSON import; added
- `background.core.js` `GM_notification` callback map entry leaked when `sendToBackground` failed (`.catch(() => {})` had no cleanup) — now deletes entry on failure

**Defense-in-depth (1 fix):**
- `dashboard-gamification.js` `a.icon` not escaped in badge `innerHTML` while `a.name`/`a.desc` were — inconsistent; now uses `esc(a.icon)`

**Totals:** 14 fixes across 8 files (Rounds 2+3). 486/486 tests green.
- background.js: 16,683 lines

### v2.0.4 Round 4 — Protocol & Security Audit (2026-04-04)
**6 agents: cross-file message protocol, HTML security, build system, URL matcher, GM wrapper injection, OAuth/PKCE**

**Missing message handlers (5 fixes):**
- `openDashboard` — sidepanel sent this action but no handler existed; dashboard never opened from sidepanel buttons — added handler
- `factoryReset` — dashboard sent this but no handler existed; factory reset button was completely non-functional — added handler
- `resetScriptSettings` — dashboard bulk action sent this but no handler existed; "Reset Settings" did nothing — added handler
- `liveReloadEnabled`/`liveReloadDisabled` — debugger module sent wrong action names; background has `setLiveReload` handler — fixed callers to use correct action with `enabled` param

**OAuth security (1 fix):**
- `sync-providers.js` Google Drive token revocation passed token in URL query param (`/revoke?token=...`) exposing it in logs — changed to POST body

**Build & manifest fixes (2 fixes):**
- `manifest-firefox.json` version was `2.0.3` while Chrome manifest is `2.0.4` — synced to `2.0.4`
- `package.json` `clean` script used `require()` in ESM context — crashes with `ReferenceError`; added `--input-type=commonjs` flag

**Clean passes (no bugs found):**
- HTML files: proper CSP, no inline handlers, all local resources, correct script load order
- GM wrapper: all user data interpolated via JSON.stringify (safe), meta.delay pre-validated as integer
- URL matcher: tested edge cases covered, no ReDoS found; `isRegexPattern` intentionally excludes `*`/`.` to prevent false positives on URL paths
- OAuth/PKCE: PKCE correct (256-bit verifier, S256 challenge), state validated on Dropbox/OneDrive, scopes minimal

**Totals:** 22 fixes across 12 files (Rounds 2-4). 486/486 tests green.
- background.js: 16,717 lines

### v2.0.4 Round 5 — Data Model & CSS Audit (2026-04-04)
**5 agents: i18n consistency, build pipeline, CSS, storage data model, grep sweep**

**Data model fixes (3 fixes in public-api.js):**
- `getScriptStatus` read flat `script.name`/`script.version` instead of canonical `script.meta?.name`/`script.meta?.version` — returned undefined for all fields
- `installScript` handler wrote flat structure (`name`, `version`, `matches` at top level) instead of canonical `meta: { name, version, match }` — scripts installed via API were corrupted, invisible to dashboard
- `scriptvault:install` web handler had same flat structure bug — web-installed scripts corrupted

**CSS fixes (3 fixes in dashboard.css):**
- `.btn-danger:hover` used undefined `--accent-error` variable — hover had no background color; changed to `--accent-red`
- Duplicate `.btn-danger` definition at line 546 overrode first definition's `border-color` and `filter: brightness` — removed duplicate
- Missing `prefers-reduced-motion` support — added global media query to disable animations/transitions for users who request reduced motion

**Clean passes:**
- i18n: All 8 locales have identical 25-key sets, no orphaned/missing keys, no placeholder mismatches
- Build pipeline: correct concatenation order, no forward references, all files present
- TypeScript: `tsc --noEmit` passes clean
- Grep sweep: no uncaught promises, no innerHTML XSS, no insecure HTTP loads, all `parseInt` safe

**Totals:** 28 fixes across 14 files (Rounds 2-5). 486/486 tests green.
- background.js: 16,723 lines

### v2.0.4 Round 6 — Deep Targeted Audit (2026-04-04)
**4 agents: popup+install, devtools+sidepanel, modules deep, registration flow**

**Security (1 fix):**
- `devtools-panel.js` HTTP header names unescaped in network detail innerHTML — XSS via malicious server response headers; both request and response header keys now use `escapeHtml(k)`

**Robustness (1 fix):**
- `background.core.js` `registerScript` catch block accessed `script.meta.name` without optional chaining — error handler itself would crash on malformed scripts; now uses `script.meta?.name || script.id`

**Clean passes:**
- popup.js: all DOM access null-safe, all innerHTML escaped, toggle/delete update state correctly
- install.js: all user data escaped, downgrade detection correct, Enter key properly scoped
- sidepanel.js: all innerHTML safe, toggle operations correct, URL validation present
- error-log.js: FIFO cap correct, CSV fields are extension-controlled numbers (not injectable)
- userstyles.js: variable substitution is UserCSS spec behavior (raw replacement intentional)
- migration.js: reads correct storage key, idempotent via `if (!data.key)` guards
- Registration flow: toggle→unregister→register→reload order correct, mutex prevents rapid-toggle races

**Totals:** 30 fixes across 15 files (Rounds 2-6). 486/486 tests green.
- background.js: 16,723 lines

### v2.0.4 Round 7 — Coverage-Driven Audit (2026-04-04)
**Coverage analysis + 3 targeted agents on <50% branch coverage modules**

**Critical (1 fix):**
- `backup-scheduler.js` selective restore was broken — `options.scriptIds` from dashboard contains UUIDs but comparison only checked script names/namespaces; scripts never matched, selective restore silently restored nothing. Now also checks `optionsMeta.id`

**Data integrity (1 fix):**
- `storage.js` `FolderStorage.moveScript()` had no rollback on save failure unlike `addScript`/`removeScript` — cache corrupted on quota exceeded; added try/catch with rollback

**Robustness (2 fixes):**
- `userstyles.js` range variable parsing used `??` on `parseFloat()` results — NaN bypasses nullish coalescing, producing `NaN` in CSS; now converts NaN→undefined before `??`
- `bg/signing.js` `parseInt(parts[2])` missing radix parameter — added `, 10`

**Totals:** 34 fixes across 18 files (Rounds 2-7). 486/486 tests green.
- background.js: 16,728 lines

### v2.0.4 Round 8 — Comprehensive QA Audit (2026-04-04)
**6 parallel audit agents covering entire codebase: background.core.js, dashboard.js, modules/, dashboard modules, popup/sidepanel/install/content/offscreen, bg/shared/CSS**

**Unhandled promise rejections (4 fixes in background.core.js):**
- All 4 `chrome.tabs.reload(tab.id)` call sites lacked `.catch()` — if tab closed between query and reload, promise rejection was unhandled; added `.catch(() => {})` to all

**CSS (1 fix):**
- `dashboard.css` `--scrollbar-thumb-hover` variable referenced but never defined in `:root` — always fell back to hardcoded `#555`; added to `:root` variables

**Crash prevention (2 fixes):**
- `dashboard-gamification.js` `canvas.getContext('2d')` result not null-checked — subsequent calls crash if context unavailable; added early return guard
- `dashboard-debugger.js` `renderVariableTable()` called via `setTimeout(..., 0)` could fire after `destroy()` nulled `_container` — added `if (!_container) return` guard

**UX (2 fixes):**
- `dashboard-diff.js` collapse toggle was expand-only — hidden lines inserted but `display:none` on container made re-collapse impossible; refactored to track expanded elements and toggle both directions
- `popup-timeline.js` `insertBeforeEl.parentNode` not null-checked — crash if element detached from DOM; added `?.parentNode` guard

**Dead code (1 fix):**
- `quota-manager.js` `autoCleanup()` passed `analytics: true, perfHistory: true` to `cleanup()` but no handler existed for those options — aggressive cleanup was silently no-op; added handler that finds and removes matching storage keys

**Totals:** 41 fixes across 24 files (Rounds 2-8). 499/499 tests green.
- background.js: 16,744 lines

### v2.0.4 Round 9 — Performance & Memory Leak Audit (2026-04-04)
**5 parallel perf agents covering entire codebase**

**O(N^2) sequential await elimination (2 fixes in background.core.js):**
- `getAllScriptsValues` fetched each script's values sequentially with `await` in loop — O(N) serial storage reads; refactored to `Promise.all()` for parallel fetches
- `switchProfile` wrote each script state sequentially with `await ScriptStorage.set()` in loop — O(N) serial writes; collected promises and used `Promise.all()`

**Unbounded memory growth prevention (4 fixes):**
- `background.core.js` `_notifCallbacks` Map grew without limit for long-running sessions — added 500-entry cap with oldest-first eviction
- `background.core.js` `_openTabTrackers` Map grew without limit if tabs orphaned — added 1000-entry cap with oldest-first eviction
- `resources.js` in-memory cache object grew without limit as URLs fetched — added 200-entry cap with oldest-timestamp eviction
- `public-api.js` `_rateLimitMap` never evicted senders with expired/empty timestamp arrays — added periodic eviction when map exceeds 200 entries

**Performance optimizations (3 fixes):**
- `background.core.js` CSP reports used `splice(0, N)` (O(N) head-removal) — changed to `slice(-500)` with threshold buffer
- `background.core.js` `_autoReloadScripts` array accumulated duplicates on rapid saves — replaced with `Map` keyed by scriptId for O(1) dedup
- `error-log.js` FIFO trim used `splice(0, N)` (O(N) head-removal) — changed to `slice(-MAX_ENTRIES)` reassignment

**Totals:** 50 fixes across 28 files (Rounds 2-9). 499/499 tests green.
- background.js: 16,775 lines
