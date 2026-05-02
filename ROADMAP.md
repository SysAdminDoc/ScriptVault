# ScriptVault Roadmap

> From v2.0.1 (bash-concatenated JS prototype) to production-grade TypeScript extension.
> Each phase is independently shippable. Later phases depend on earlier ones.

---

## Phase 0 — Foundation (Prerequisite for Everything)

**Goal:** Get the development environment working so changes can be validated.

### 0.1 Install Node.js & Bootstrap
- Install Node.js LTS (20.x+)
- Run `npm install` to pull esbuild, vitest, monaco-editor
- Run `npm test` — fix any failures in the 7 existing test suites (204 cases)
- Run `node esbuild.config.mjs` — verify it produces identical `background.js` to `bash build-background.sh`

### 0.2 Bundle Monaco Locally
- Run `node esbuild.config.mjs --monaco-only` to copy Monaco from node_modules to `lib/monaco/`
- Update `editor-sandbox.html` to load from `lib/monaco/` instead of `cdn.jsdelivr.net`
- Remove the jsdelivr CSP entry from `manifest.json` sandbox policy
- Verify editor loads and all 8 themes work

### 0.3 CI Pipeline
- [x] Add GitHub Actions workflow: `npm test` on push/PR
- [x] Add build step: verify `node esbuild.config.mjs` succeeds
- [x] Add artifact: upload built extension ZIP

**2026-04-26 note:** Added `.github/workflows/ci.yml` to run `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, package with `bash build.sh`, and upload the Chrome ZIP artifact on push/PR.

### 0.4 Smoke Test Harness
- [x] Install Puppeteer Core
- [x] Write a minimal E2E test: load extension → open dashboard → verify scripts tab renders
- [x] Wire into CI

**2026-04-26 note:** Added `npm run smoke:dashboard`, which loads the unpacked extension in Chrome, opens the dashboard, and verifies the installed-scripts surface. CI now provisions Chrome and runs the smoke check after the build.

**Exit criteria:** `npm test` passes, Monaco loads locally, CI is green, one E2E test exists.

---

## Phase 1 — TypeScript Migration

**Goal:** Replace global-scope IIFEs and bash concatenation with a typed module system.

### 1.1 TypeScript Setup
- Add `typescript` to devDependencies
- Create `tsconfig.json` with:
  - `strict: true`, `noUncheckedIndexedAccess: true`
  - `module: "esnext"`, `target: "es2022"`
  - `rootDir: "src/"`, `outDir: "dist/"`
  - Path aliases: `@modules/*`, `@shared/*`, `@bg/*`, `@pages/*`
- Update esbuild config to handle `.ts` files

### 1.2 Shared Types
Create `src/types/` with:
- `script.ts` — `Script`, `ScriptMetadata`, `ScriptSettings`, `ScriptStats`, `VersionHistoryEntry`
- `messages.ts` — Discriminated union of all message types (`{ action: 'getScripts' } | { action: 'toggleScript', scriptId: string, enabled: boolean } | ...`)
- `storage.ts` — `StorageSchema`, `SettingsSchema`
- `chrome.ts` — Augmented Chrome API types for `chrome.userScripts`
- `gm-api.ts` — GM API function signatures

### 1.3 Incremental Module Migration
Migrate one module at a time, keeping the build working after each:

**Wave 1 — Leaf modules (no internal dependencies):**
1. `shared/utils.js` → `src/shared/utils.ts`
2. `modules/i18n.js` → `src/modules/i18n.ts`
3. `modules/error-log.js` → `src/modules/error-log.ts`
4. `modules/quota-manager.js` → `src/modules/quota-manager.ts`
5. `modules/npm-resolve.js` → `src/modules/npm-resolve.ts`

**Wave 2 — Core modules:**
6. `modules/storage.js` → `src/modules/storage.ts` (biggest win — types catch the `onInstall`/`onInstalled` class of bugs)
7. `modules/xhr.js` → `src/modules/xhr.ts`
8. `modules/resources.js` → `src/modules/resources.ts`
9. `modules/notifications.js` → `src/modules/notifications.ts`
10. `modules/migration.js` → `src/modules/migration.ts`

**Wave 3 — Complex modules:**
11. `modules/sync-providers.js` → `src/modules/sync-providers.ts`
12. `modules/sync-easycloud.js` → `src/modules/sync-easycloud.ts`
13. `modules/backup-scheduler.js` → `src/modules/backup-scheduler.ts`
14. `modules/userstyles.js` → `src/modules/userstyles.ts`
15. `modules/public-api.js` → `src/modules/public-api.ts`

**Wave 4 — Background service worker:**
16. `bg/analyzer.js` → `src/bg/analyzer.ts`
17. `bg/netlog.js` → `src/bg/netlog.ts`
18. `bg/signing.js` → `src/bg/signing.ts`
19. `bg/workspaces.js` → `src/bg/workspaces.ts`
20. `background.core.js` → `src/background/index.ts` (split into sub-modules, see 1.4)

**Wave 5 — Extension pages:**
21. `pages/popup.js` → `src/pages/popup.ts`
22. `pages/sidepanel.js` → `src/pages/sidepanel.ts`
23. `pages/install.js` → `src/pages/install.ts`
24. `pages/dashboard.js` → `src/pages/dashboard/index.ts` (split into sub-modules)
25. All 27 `dashboard-*.js` → `src/pages/dashboard/modules/*.ts`

### 1.4 Break Up background.core.js (~6,100 lines)
Split into focused modules under `src/background/`:
- `index.ts` — Entry point, event listener registration
- `parser.ts` — Userscript metadata parser
- `registration.ts` — `chrome.userScripts` registration/unregistration
- `url-matcher.ts` — `@match`/`@include`/`@exclude` matching (shared with sidepanel/popup)
- `update-checker.ts` — Auto-update polling and application
- `gm-api-handler.ts` — GM_* API message handlers
- `context-menu.ts` — Context menu setup and handlers
- `badge.ts` — Badge count management
- `wrapper-builder.ts` — `buildWrappedScript()` code generation
- `tab-reload.ts` — `autoReloadMatchingTabs()` debounce logic
- `dnr-rules.ts` — DeclarativeNetRequest rule management
- `install-handler.ts` — Script install/uninstall logic

### 1.5 Update Build System
- esbuild config produces multiple bundles:
  - `background.js` — service worker (tree-shaken, single file)
  - `popup.js` — popup bundle
  - `dashboard.js` — dashboard bundle (code-split by tab/module)
  - `sidepanel.js` — sidepanel bundle
  - `install.js` — install page bundle
  - `content.js` — content script (minimal, no bundling needed)
- Remove `build-background.sh` (replaced by esbuild)
- Source maps in dev mode, minified in prod

### 1.6 Typed Message Passing
Replace stringly-typed `chrome.runtime.sendMessage({ action: '...' })` with:
```typescript
// src/types/messages.ts
type BackgroundMessage =
  | { action: 'getScripts' }
  | { action: 'toggleScript'; scriptId: string; enabled: boolean }
  | { action: 'saveScript'; scriptId: string; code: string }
  // ... all ~50 message types

// src/shared/messaging.ts
function sendToBackground<T extends BackgroundMessage>(msg: T): Promise<ResponseFor<T>>
```
This catches message shape mismatches at compile time (the exact bug class that caused `onInstall`/`onInstalled`, `type`/`action`, and `scripts`/`userscripts` issues).

**Exit criteria:** All source is TypeScript, `tsc --noEmit` passes with strict mode, esbuild produces working bundles, all existing tests pass.

---

## Phase 2 — Storage Layer Rewrite

**Goal:** Replace the single-blob `chrome.storage.local` approach with a scalable, crash-safe storage layer.

### 2.1 IndexedDB for Script Code
- Create `src/storage/script-db.ts` using IndexedDB:
  - Object store: `scripts` — keyed by scriptId, stores `{ id, code, resources, versionHistory }`
  - Object store: `values` — keyed by `${scriptId}:${key}`, stores GM_getValue data
  - Object store: `backups` — keyed by backupId, stores ZIP blobs (not base64 in chrome.storage)
- Keep `chrome.storage.local` for:
  - `settings` — small, needs sync-friendly access
  - `scriptIndex` — lightweight metadata array (id, name, enabled, version, matchPatterns) for fast badge/popup lookups without opening IndexedDB
- Migration: on first load, move script code from `userscripts` blob to IndexedDB per-script entries

### 2.2 Transactional Write Operations
```typescript
// src/storage/transaction.ts
async function withTransaction<T>(
  stores: string[],
  mode: 'readwrite',
  fn: (tx: IDBTransaction) => Promise<T>
): Promise<T>
```
- All multi-step operations (toggle, save, update, delete) wrapped in a transaction
- No more "cache rollback on failure" pattern — either the whole transaction commits or nothing does
- Concurrent writes to different scripts don't block each other (separate object store entries)

### 2.3 Per-Script Storage Keys
- Each script is its own IndexedDB entry — no more serializing/deserializing every script on every read/write
- `getAll()` returns the lightweight index from `chrome.storage.local`, not full script objects
- `get(id)` reads a single IndexedDB entry
- `set(id, script)` writes a single IndexedDB entry + updates the index

### 2.4 Stats Write Coalescing
- Replace the current "mutate cache reference + debounced save()" pattern
- New approach: `ScriptStats` is a separate IndexedDB object store
- Stats writes are fire-and-forget IndexedDB puts (no impact on script save operations)
- Eliminates the "stats lost if script saved within 5s" bug by design

### 2.5 Backup Storage Migration
- Move backup ZIP blobs from `chrome.storage.local` (base64 strings) to IndexedDB (raw ArrayBuffer)
- `getBackupList()` returns metadata only (no blob deserialization)
- `getBackupData(id)` streams the blob on demand
- Selective restore reads individual scripts from the ZIP, not the whole blob

**Exit criteria:** All data in IndexedDB (except settings/index), transactions protect multi-step operations, backup blobs are raw ArrayBuffer, existing tests updated and passing.

---

## Phase 3 — Service Worker Resilience

**Goal:** Every in-memory timer and Map survives service worker termination.

### 3.1 Replace All setTimeout with chrome.alarms
Audit and replace:
- `_debouncedStatsSave` (5s debounce) → `chrome.alarms.create('statsSave', { delayInMinutes: 0.1 })`
- `autoReloadMatchingTabs` (500ms debounce) → Keep as setTimeout (sub-second, acceptable to lose)
- `_debouncedSync` in sync-easycloud.js → `chrome.alarms.create('syncDebounce', { delayInMinutes: 0.5 })`
- Notification context cleanup (5min) → `chrome.alarms.create('notifCleanup_${id}', { delayInMinutes: 5 })`
- All other `setTimeout` calls > 1 second → `chrome.alarms`

### 3.2 Persist Runtime State to chrome.storage.session
- `self._toggleLocks` → Not needed with transactional storage (Phase 2 eliminates the race)
- `_openTabTrackers` → `chrome.storage.session.set({ openTabTrackers: [...] })`
- `_notifCallbacks` → Store callback metadata in `chrome.storage.session`; re-hydrate on wake
- `_registeredTabs` (userstyles) → Query active tabs on wake instead of tracking in memory

### 3.3 Cold-Start Handler Pattern
```typescript
// src/background/lifecycle.ts
let _initialized = false;
const _initPromise: Promise<void> | null = null;

async function ensureInitialized(): Promise<void> {
  if (_initialized) return;
  if (_initPromise) return _initPromise;
  _initPromise = doInit();
  await _initPromise;
  _initialized = true;
}

// Every message handler wraps with:
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  ensureInitialized().then(() => handleMessage(msg, sender, sendResponse));
  return true; // async response
});
```

### 3.4 Declarative Script Registration
- Call `chrome.userScripts.register()` once per script, let Chrome persist registrations
- On service worker wake, diff current registrations against storage and only update changes
- Use `chrome.userScripts.getScripts()` to check what's already registered before re-registering

**Exit criteria:** Extension survives Chrome killing and restarting the service worker mid-operation, no data loss, no orphaned state.

---

## Phase 4 — URL Matching Engine Rewrite

**Goal:** One correct, shared, fast URL matcher used everywhere.

### 4.1 Unified Matcher Module
Create `src/shared/url-matcher.ts`:
- Full Tampermonkey-compatible `@match` (Chrome match pattern spec)
- Full `@include` (glob with `*` and `?`, plus regex patterns)
- `@exclude` and `@exclude-match` support
- `<all_urls>` special pattern
- Proper handling: path matching uses pathname only (not query string), aligning with Chrome's native behavior

### 4.2 Precompiled Match Sets
```typescript
class MatchSet {
  private trie: URLTrie; // trie on scheme+host for O(log n) lookups
  private regexPatterns: CompiledRegex[]; // for @include regex patterns

  constructor(patterns: ScriptPattern[]) { /* build trie */ }
  test(url: string): boolean { /* fast lookup */ }
  getMatchingScripts(url: string): Script[] { /* returns all matches */ }
}
```
- Build the `MatchSet` once when scripts change, reuse for every URL test
- O(log n) host lookup via trie instead of O(n) linear scan over all scripts
- Regex patterns validated at parse time (reject pathological backtracking)

### 4.3 Share Across All Contexts
- Background uses `MatchSet` for registration, badge counts, tab reload
- Popup imports `url-matcher.ts` (bundled into popup.js)
- Sidepanel imports `url-matcher.ts` (bundled into sidepanel.js)
- All three produce identical results (eliminates the current divergence bugs)

### 4.4 @include Glob-to-Match Conversion
- Improve `convertIncludeToMatch` to handle query strings correctly
- For patterns that can't be expressed as match patterns, use broad match + runtime filter
- `isRegexPattern` requires metacharacters (already fixed, formalize in the new module)

### 4.5 Comprehensive Matcher Tests
- Port Tampermonkey's known test cases
- Edge cases: query strings, fragments, IDN domains, IPv6, data: URLs, about:blank
- Fuzz testing with random URLs against random patterns
- Benchmark: measure lookup time with 500+ scripts

**Exit criteria:** Single `url-matcher.ts` used in background, popup, and sidepanel. All three agree on every URL. Trie-based lookup. 100+ matcher test cases.

---

## Phase 5 — Security Hardening

**Goal:** Defense-in-depth for script injection, install flow, and external APIs.

### 5.1 Per-Script World Isolation
- Each script gets a unique `worldId` in `chrome.userScripts.register()`
- Scripts with `@grant none` get a world with no GM API bridge
- `@connect` enforcement: the service worker validates `GM_xmlhttpRequest` target URLs against the script's `@connect` whitelist (currently advisory)

### 5.2 @require Security
- Fetch `@require` dependencies at install/update time, not at injection time
- Store fetched code in IndexedDB with a SHA-256 hash
- On injection, verify hash matches before including in the wrapper
- SRI (`@require url#sha256=...`) enforced when present
- Log a warning if a `@require` URL changes content between fetches

### 5.3 Install Flow Hardening
- Replace regex-based static analysis with real AST parsing (Acorn, already available in offscreen document)
- Permissions dialog: show what GM APIs the script requests with risk explanations
- On update: diff against previous version, highlight new permissions, new `@connect` domains, new `@require` URLs
- Code signing verification: if `@signature` is present and a trusted key is configured, verify before install

### 5.4 Public API Lockdown
- Deny all web origins by default (already fixed, formalize)
- Capability tokens: `requestAccess({ origin, permissions: ['list', 'install'] })` → user approves → token issued
- Per-origin rate limiting (not just global)
- Remove the SSRF vector: `scriptvault:install` must not fetch until user approves
- Audit all `postMessage` handlers for origin validation

### 5.5 Webhook & Sync Security
- Webhook URLs: validate `https://` only, no internal IPs (RFC 1918 check)
- Gist encryption: remove the fake PBKDF2 (hardcoded key), rely on `chrome.storage.local` sandbox
- Cloud sync: encrypt with a user-provided passphrase (or remove encryption claim entirely)
- npm resolver: only use resolved exact semver versions in CDN URLs (no ranges, no path traversal chars)

### 5.6 CSP Tightening
- Remove `https://cdn.jsdelivr.net` from sandbox CSP after Monaco is bundled locally (Phase 0.2)
- Extension pages CSP: keep `script-src 'self'` (already correct)
- Audit all `innerHTML` assignments in dashboard modules for XSS
  - `dashboard-gamification.js` — escape `a.icon`
  - `dashboard-whatsnew.js` — escape changelog content
  - Any future dynamic data source must use `textContent` or explicit escaping

**Exit criteria:** Per-script worlds, @require hashed and verified, AST-based install analysis, public API deny-by-default with capability tokens, no innerHTML XSS vectors, no SSRF.

---

## Phase 6 — Update System Overhaul

**Goal:** Reliable, efficient, user-friendly script updates.

### 6.1 Differential Updates
- Send `If-Modified-Since` / `If-None-Match` headers on update checks
- Skip download if 304 Not Modified
- Track ETags per script in metadata
- Exponential backoff on failed update checks (not fixed interval)

### 6.2 Staged Updates
- Download update → store as pending in IndexedDB (don't apply)
- Show "Update available" badge in dashboard/popup
- User reviews diff (using the improved diff viewer from Phase 7)
- One-click apply or dismiss
- Option for auto-apply (trusted authors / scripts with no new permissions)

### 6.3 Unlimited Version History
- Move `versionHistory` from the script metadata object to a separate IndexedDB object store
- No arbitrary cap (currently 5) — keep all versions, with optional auto-prune by age
- Each history entry: `{ version, code, timestamp, source: 'update' | 'manual' | 'rollback' }`
- Rollback to any version, not just the previous one

### 6.4 Update Queue
- Background queue with priority (manual check > auto-check)
- Concurrency limit (max 3 simultaneous update checks)
- Retry with backoff on network failure
- Progress reporting to dashboard/popup

**Exit criteria:** Conditional HTTP requests, staged update review, unlimited version history, queued updates with retry.

---

## Phase 7 — Dashboard UX Overhaul

**Goal:** Professional, performant dashboard UI.

### 7.1 Virtual Scrolling for Script List
- Replace "render all rows to DOM" with a virtual list
- Only render visible rows + buffer (typically 20-30 rows visible)
- Smooth scrolling with correct scroll bar sizing
- Handles 1000+ scripts without janking

### 7.2 Proper Diff Viewer
- Replace naive line-by-line positional comparison with Myers diff algorithm
- Use the `diff.min.js` library already in `lib/` (currently only used in offscreen document)
- Syntax-highlighted side-by-side view
- Inline conflict resolution for three-way merge during sync conflicts
- Collapsible unchanged sections (fix the one-way collapse bug)

### 7.3 Editor Undo/Redo Persistence
- Save `editor.getModel().getAlternativeVersionId()` and undo stack per tab
- Restore on tab switch instead of calling `clearHistory()`
- Global undo for destructive operations (delete, bulk actions) with toast + undo button

### 7.4 Bulk Action Safety
- [x] Confirmation dialog for bulk delete, with Trash-aware recovery copy when retention is enabled and permanent-delete copy when Trash is disabled
- "Undo" toast for 5 seconds after bulk delete (deferred actual deletion)
- Select-all checkbox in table header
- Shift-click range selection: handle filtered-out `lastCheckedId` gracefully (fall back to single-select)

**2026-04-26 note:** Bulk delete now says "Move to Trash" when recovery is available, keeps destructive copy only when Trash is disabled, and offers an "Open Trash" toast action after successful recovery-backed deletes. Deferred true undo remains open.

### 7.5 Beautify Cursor Preservation
- After beautify, find the equivalent position in the new code by character offset mapping
- Or: use Monaco's built-in format document action which preserves cursor natively

### 7.6 Web Worker for Heavy Operations
- Move filtering, sorting, and search to a Web Worker
- Script metadata indexing in the worker
- Keeps the main thread responsive during large-collection operations

### 7.7 Command Palette Polish
- `switchTab` → make async, await `lazyInitTab` (already fixed, verify)
- Stable command index (no stale-index race on fast typing)
- Recent commands section
- Fuzzy matching

**Exit criteria:** Virtual scrolling handles 1000+ scripts, Myers diff, persistent undo, bulk delete confirmation, responsive filtering via Worker.

---

## Phase 8 — Sync & Backup Rewrite

**Goal:** Reliable cross-device sync with conflict resolution.

### 8.1 CRDT-Based Merge
- Replace last-write-wins with operation-based CRDT for script metadata
- Track per-field timestamps: `{ enabled: { value: true, timestamp: 1234 } }`
- Last-writer-wins per field, not per script (enabling on device A doesn't clobber a code edit on device B)
- For code: three-way merge using the `diff.min.js` library (already in the project)

### 8.2 Conflict UI
- When three-way merge fails (conflicting edits to the same lines):
  - Show both versions in the diff viewer
  - Let user pick per-hunk (accept left / accept right / edit manually)
  - "Accept all remote" / "Accept all local" shortcuts
- Queue conflicts for later resolution (don't block sync)

### 8.3 Sync Reliability
- Replace `setTimeout` debounce with `chrome.alarms` (survives worker termination)
- Sync state machine: `idle → checking → downloading → merging → uploading → idle`
- Persistent sync queue in `chrome.storage.session`
- Retry with exponential backoff on failure
- Sync log visible in settings (last 50 operations with timestamps and outcomes)

### 8.4 Backup Overhaul
- Store backups in IndexedDB as raw ArrayBuffer (not base64 in chrome.storage.local)
- Metadata index in `chrome.storage.local` (just id, timestamp, size, scriptCount)
- Selective restore actually works (fix the current bug where it restores everything)
- Export to File System Access API (user picks download location)
- Import from file picker

### 8.5 Token Security
- Remove fake encryption from `dashboard-gist.js` (hardcoded PBKDF2)
- Cloud tokens stored in `chrome.storage.local` (already sandboxed by Chrome)
- Document security model honestly: "tokens protected by Chrome's extension sandbox"
- Optional user passphrase for sync encryption (real key derivation from user input)

**Exit criteria:** Per-field CRDT merge, conflict UI, alarm-based sync, IndexedDB backups, honest token storage.

---

## Phase 9 — Migration System Rewrite

**Goal:** Reliable, tested data migration between versions.

### 9.1 Fix Current Migration
- Read from `userscripts` key (not `script_*` keys)
- Write back to `userscripts` key (not `script_*` keys)
- After Phase 2: migrate from `userscripts` blob to per-script IndexedDB entries

### 9.2 Migration Framework
```typescript
// src/modules/migration.ts
interface Migration {
  version: string;           // target version
  description: string;
  migrate(data: unknown): Promise<void>;
  rollback(data: unknown): Promise<void>;
  validate(data: unknown): boolean;
}

const MIGRATIONS: Migration[] = [
  { version: '2.0.0', ... },
  { version: '3.0.0', ... }, // Phase 2 IndexedDB migration
];
```
- Run migrations sequentially on version upgrade
- Each migration is independently testable
- Dry-run mode: log what would change without committing
- Rollback capability: store pre-migration snapshot
- Validation step: verify migrated data matches expected schema

### 9.3 Migration Tests
- Unit test each migration with known input → expected output
- Test migration from every historical version to current
- Test interrupted migration (simulate crash mid-migration)
- Test rollback path

**Exit criteria:** Migrations read/write correct keys, framework supports dry-run and rollback, every migration has unit tests.

---

## Phase 10 — Testing & Quality

**Goal:** Comprehensive automated testing at every level.

### 10.1 Unit Test Coverage
- Target: 80%+ line coverage for all `src/` modules
- Priority modules (by bug density):
  1. `url-matcher.ts` — every pattern type, every edge case
  2. `storage.ts` — CRUD operations, concurrent access, quota handling
  3. `parser.ts` — malformed metadata, encoding edge cases
  4. `registration.ts` — enable/disable/update flows
  5. `wrapper-builder.ts` — GM API injection correctness
  6. `migration.ts` — every migration path

### 10.2 Integration Tests
- Background + storage: full script lifecycle (install → enable → update → rollback → delete)
- Background + sync: sync round-trip (local change → upload → download on fresh profile)
- Dashboard + background: message passing contract tests (send message, verify response shape)

### 10.3 E2E Tests (Puppeteer/Playwright)
- Load extension in Chrome
- Install a script from URL
- Verify it runs on a test page
- Toggle it off, verify it stops running
- Open dashboard, verify script appears
- Edit script, save, verify changes take effect
- Store search → install → verify in scripts list
- Popup: verify badge count, quick toggle
- Side panel: verify script list matches current tab

### 10.4 Mutation Testing
- Use Stryker or similar to verify test quality
- Focus on url-matcher and storage modules
- Target: 70%+ mutation score on critical modules

### 10.5 Fuzzing
- Fuzz the userscript metadata parser with random input
- Fuzz the URL matcher with random URLs × random patterns
- Fuzz the `@require` URL resolver with adversarial inputs
- Integrate with CI as a nightly job

**Exit criteria:** 80%+ unit coverage, integration tests for critical flows, E2E suite in CI, mutation testing on critical modules.

---

## Phase 11 — GM API Parity & Platform API Catch-up

**Goal:** Close the gap between ScriptVault and Tampermonkey/Violentmonkey on GM API coverage and expose newly-available Chrome platform APIs.

### 11.1 GM_info Enrichment

Violentmonkey exposes substantially more metadata in `GM_info` than ScriptVault does. Parity targets:

- `GM_info.isIncognito` — `true` when the script is executing in an incognito context. Incognito-aware scripts currently have no portable way to detect this. Source: [VM GM_info docs](https://violentmonkey.github.io/api/gm/#gm_info).
- `GM_info.platform` — object with `arch`, `browserName`, `browserVersion`, `fullVersionList`, `mobile`, `os` sourced from `navigator.userAgentData` (available from the background SW context, not spoofable by the page). Source: [VM GM_info docs](https://violentmonkey.github.io/api/gm/#gm_info).
- `GM_info.userAgent` / `GM_info.userAgentData` — expose the SW-context strings. Pages can spoof `navigator.userAgent`; injecting from the background avoids that.
- `GM_info.script.options` — expose per-script override settings so scripts can read their own configuration.

Implementation: expose these from the background's `buildGmInfo()` function; no new permissions required.

### 11.2 `@unwrap` Metadata Tag

Violentmonkey supports `// @unwrap` to disable the auto-injected IIFE wrapper. This allows:

- ESM-style top-level `export`/`import` if the page's CSP permits
- Scripts that intentionally modify the top-level scope
- Easier porting of scripts from other contexts

Add `@unwrap` to the metadata parser; when present, emit the script code as-is rather than wrapping in `(function() { ... })()`. Log a console warning noting that `@grant` APIs are unavailable without the wrapper. Source: [VM metadata block docs](https://violentmonkey.github.io/api/metadata-block/).

### 11.3 Per-Script User-Override Merge Flags

Violentmonkey supports `// @merge_matches`, `// @merge_excludes`, `// @merge_includes`, `// @merge_connect` to let users toggle whether their local additions to those fields _replace_ or _merge with_ the script's authored values. ScriptVault already allows user overrides to match/exclude; it needs the merge/replace toggle.

- Add `userOverrideMergeMode: 'merge' | 'replace'` per field to `ScriptSettings`
- UI: dropdown per overrideable field in the script settings panel
- Default: `merge` (matches current undocumented behavior)

### 11.4 `userScripts.execute()` — One-Shot Execution

Chrome 135 added `chrome.userScripts.execute()` — inject a script into a specific tab once, on demand, without registering it for future page loads. Enables:

- "Run now" button in the dashboard (execute once without toggling the script on)
- Quick-test workflow: modify → inject into current tab without a full save
- Popup action to run a specific script against the active tab immediately

Guard with `typeof chrome.userScripts.execute === 'function'` (Chrome 135+ only). Source: [Chrome Extensions What's New](https://developer.chrome.com/docs/extensions/whats-new), [userScripts.execute() reference](https://developer.chrome.com/docs/extensions/reference/api/userScripts#method-execute).

### 11.5 GM_xmlhttpRequest Completeness

Two missing options discovered from competitor changelogs:

- **`noCache: true`** — add a `Cache-Control: no-cache` / `Pragma: no-cache` request header (or append a cache-buster query param for HTTP/1.0 compatibility). Maps to Violentmonkey issue [#2168](https://github.com/violentmonkey/violentmonkey/issues/2168).
- **`redirect: 'follow' | 'error' | 'manual'`** — expose the `RequestInit.redirect` option so scripts can detect or block redirects. Maps to Violentmonkey issue [#2359](https://github.com/violentmonkey/violentmonkey/issues/2359).

Both changes are localized to `modules/xhr.js` (later `src/modules/xhr.ts`). Low risk.

Additional completeness items for `GM_xmlhttpRequest`:

- **`responseType: 'stream'`** — ScriptCat exposes a streaming response type for chunked/SSE responses. Implementation via `fetch()` with a `ReadableStream` callback forwarded through the SW message channel. Source: [ScriptCat API docs](https://docs.scriptcat.org/docs/dev/api/).
- **`nocache` alias** — Tampermonkey uses `nocache` (not `noCache`); accept both casings in the parser.

### 11.6 `GM_cookie` API

Both Tampermonkey and ScriptCat expose `GM_cookie` for reading, writing, and deleting cookies — including HttpOnly cookies inaccessible via `document.cookie`. This is one of the highest-demand missing APIs for scripts targeting sites with strict cookie policies.

```js
// Signature to implement (Tampermonkey-compatible):
GM_cookie("list", { url, domain, name }, (cookies, error) => {});
GM_cookie("set",  { url, name, value, domain, path, secure, httpOnly, sameSite, expirationDate }, (error) => {});
GM_cookie("delete", { url, name }, (error) => {});
```

Implementation path: the background service worker has `cookies` permission; proxy calls through the SW using `chrome.cookies.getAll/set/remove`. Source: [ScriptCat GM_cookie docs](https://docs.scriptcat.org/docs/dev/api/#gm_cookie), [TM changelog](https://www.tampermonkey.net/changelog.php).

Requires adding `"cookies"` to `manifest.json` permissions and auditing whether CWS review requires additional justification.

### 11.7 Extended Metadata Directives

Several metadata directives parsed by Violentmonkey and Tampermonkey are not yet handled by ScriptVault's parser. Add parsing and behavior for:

| Directive | Manager | Behavior |
|-----------|---------|----------|
| `@inject-into page\|content\|auto` | VM | Selects `USER_SCRIPT` world (`page`) vs. `ISOLATED` world (`content`) vs. automatic fallback (`auto`). Maps directly to `world:` in `chrome.userScripts.register()`. Source: [VM metadata](https://violentmonkey.github.io/api/metadata-block/#inject-into). |
| `@connect domain` | TM | Whitelist domains that `GM_xmlhttpRequest` may contact. Parse into the script record; enforce at request time in `xhr.js`. Source: [TM docs via ScriptCat comparison](https://docs.scriptcat.org/docs/dev/api/). |
| `@tag label` | VM | Categorical labels assigned by the script author (distinct from user-assigned tags). Expose in `GM_info.script.options.tags` and in the dashboard filter sidebar. Source: [VM metadata — @tag](https://violentmonkey.github.io/api/metadata-block/). |
| `@antifeature ads\|tracking\|miner "note"` | TM, VM | Declare monetization or data collection. Show a warning banner in the install confirmation dialog when present. Source: [VM GM_info](https://violentmonkey.github.io/api/gm/#gm_info). |
| `@compatible chrome\|firefox\|...` | TM, VM | Browser compatibility hints. Display in script info panel; no enforcement needed. |
| `@top-level-await` | VM | When present, wrap the script in an async IIFE (`(async () => { ... })()`). Required for scripts using `await` at the top level. Source: [VM metadata](https://violentmonkey.github.io/api/metadata-block/#top-level-await). |
| `@run-at document-body` | VM | Fire after the `<body>` element appears (via `MutationObserver`), before `DOMContentLoaded`. Source: [VM metadata](https://violentmonkey.github.io/api/metadata-block/). |
| `@weight 1–999` | Userscripts (Safari) | Integer injection priority (higher = earlier within same `@run-at`). Useful when two scripts both run `document-start` and one must come first. Source: [Userscripts README](https://github.com/quoid/userscripts). |

Priority order: `@inject-into` and `@connect` are HIGH (security-relevant and broadly compatible); the rest are MEDIUM parity items.

### 11.8 `@require` Subresource Integrity

Tampermonkey supports SRI hashes appended to `@require` URLs:

```
// @require https://cdn.example.com/lib.js#sha256-BASE64HASH=
```

If the downloaded content's hash does not match, the `@require` resource must be rejected and an error surfaced in the install dialog. This closes a supply-chain attack vector where a CDN serves silently-modified code.

Implementation: after fetching the `@require` URL, extract the fragment (`#sha256-` / `#sha384-` / `#sha512-`), compute the hash of the downloaded bytes via `crypto.subtle.digest()`, and compare. Source: [GitHub Advisory Database — userscript supply chain risk](https://github.com/advisories?query=userscript), [TM docs](https://www.tampermonkey.net/changelog.php).

### 11.9 `GM_getTab` / `GM_saveTab` / `GM_getTabs`

Tab-scoped transient storage: attach arbitrary data to the current tab's lifetime. `GM_getTabs` returns data from all tabs running scripts from this extension. Present in Tampermonkey, ScriptCat, and Userscripts (Safari).

Implementation: store in `chrome.storage.session` keyed by `tabId` (in-memory, cleared on tab close/browser restart). Source: [ScriptCat API](https://docs.scriptcat.org/docs/dev/api/#gm_getsavetabgm_gettabs), [Userscripts README](https://github.com/quoid/userscripts).

### 11.10 `@run-at navigation` — SPA Re-execution

Single-page applications that use `history.pushState` do not trigger standard document lifecycle events, so `document-start`/`document-end` scripts run only on the initial page load. This is the most persistent user complaint in community threads.

Implementation options:
1. Background SW listens for `chrome.webNavigation.onHistoryStateUpdated` and calls `userScripts.execute()` (Chrome 135+) to re-inject the script.
2. Or: inject a lightweight `popstate`/Navigation-API observer shim alongside the script that calls back to the SW on each navigation event.

Parse `// @run-at navigation` in the metadata block as a trigger mode distinct from the existing `run-at` values. Scripts with this directive still run on `document-end` for the initial page load; the navigation trigger handles subsequent client-side navigations.

Source: VM issue [#2048](https://github.com/violentmonkey/violentmonkey/issues/2048), Chrome Navigation API (shipped Chrome 102).

### 11.11 `GM_notification` Enhancements

ScriptCat's `GM_notification` implementation extends the standard:

- `progress: 0–100` — show a progress bar within the notification (useful for download scripts).
- `buttons: [{title, iconUrl}]` up to 2 — clickable action buttons in the notification; `onclick(e)` receives `e.buttonClickIndex`.
- `GM_updateNotification(notificationId, details)` — update the text/progress of an existing notification without closing it.
- `GM_closeNotification(notificationId)` — programmatically close a notification.

Chrome's `chrome.notifications` API supports all of these natively via `progressType: 'progressbar'`, `buttons[]`, `update()`, and `clear()`. Source: [ScriptCat notification API](https://docs.scriptcat.org/docs/dev/api/#gm_notification-).

**Exit criteria:** `GM_info.isIncognito` and `GM_info.platform` populated; `@unwrap` parses and emits correctly; merge-mode UI exists; "Run now" button uses `userScripts.execute()` on Chrome 135+; `GM_xmlhttpRequest` accepts `noCache`/`nocache`, `redirect`, and `responseType: 'stream'`; `GM_cookie` proxied through SW; `@inject-into`, `@connect`, `@tag`, `@antifeature`, `@top-level-await`, `@run-at document-body`, `@weight` all parsed; `@require` SRI validated; `GM_getTab`/`GM_saveTab`/`GM_getTabs` stored in `storage.session`; `@run-at navigation` fires on SPA route changes; `GM_notification` supports progress, buttons, update, close.

---

## Phase 12 — UX Polish & High-Signal Community Requests

**Goal:** Address the most-upvoted feature requests from Tampermonkey and Violentmonkey issue trackers that apply cleanly to ScriptVault's design philosophy.

Sources: TM issues [#2748](https://github.com/Tampermonkey/tampermonkey/issues/2748), [#2722](https://github.com/Tampermonkey/tampermonkey/issues/2722), [#2624](https://github.com/Tampermonkey/tampermonkey/issues/2624), [#2458](https://github.com/Tampermonkey/tampermonkey/issues/2458), [#2442](https://github.com/Tampermonkey/tampermonkey/issues/2442), [#2579](https://github.com/Tampermonkey/tampermonkey/issues/2579); VM issues [#2464](https://github.com/violentmonkey/violentmonkey/issues/2464), [#2287](https://github.com/violentmonkey/violentmonkey/issues/2287), [#2219](https://github.com/violentmonkey/violentmonkey/issues/2219), [#2169](https://github.com/violentmonkey/violentmonkey/issues/2169).

### 12.1 Script Profiles (Groups)

A **profile** is a named set of scripts with independent per-script enable/disable state. Toggling a profile enables or disables all its members in one action without losing the per-script state within the profile.

- Data model: `Profile { id, name, scriptStates: Map<scriptId, enabled> }`; stored in `chrome.storage.local` alongside the script index
- UI: profile selector in the popup toolbar and dashboard header; "Active profile" shown in the extension badge tooltip
- Profile edit modal: add/remove scripts, rename, duplicate, delete
- "Global" is the default profile (current behavior)

This supersedes simple tag-based enable/disable without touching the tag system.

### 12.2 Improved Script Search

Current search is substring-based. Users with 100+ scripts struggle to find scripts by partial or out-of-order words (VM issue [#2464](https://github.com/violentmonkey/violentmonkey/issues/2464)).

- Replace exact-match with fuzzy match (Levenshtein distance or prefix-weighted scoring)
- Search fields: name, namespace, description, `@match` patterns
- Highlight matched substrings in results
- Sort by relevance score when a search query is active, not alphabetical
- The Web Worker from Phase 7.6 hosts the search index; no main-thread blocking

### 12.3 Enabled-But-Not-Executed Visual Distinction

Tampermonkey distinguishes between scripts that are **enabled** vs. scripts that **executed on the current page**. ScriptVault's sidepanel shows active scripts but doesn't make this distinction.

- In the sidepanel and popup list: green dot = executed on this tab, grey dot = enabled but not matching/ran
- Add an "executed" counter to the badge (separate from "installed") or use the existing badge just for executed count
- Helps users diagnose why a script "isn't running" without opening the dashboard

### 12.4 Script List Grouping and Folding

VM issue [#2287](https://github.com/violentmonkey/violentmonkey/issues/2287). Group scripts in the dashboard list by tag (or profile, once 12.1 lands) with collapsible sections:

- Collapsible tag-groups in the installed scripts table
- Collapsed state persisted per session
- Drag-sort still works within and across groups (drop on a group header to assign tag)
- "Ungroup" view available

### 12.5 Popup Menu Command Collapse

VM issue [#2219](https://github.com/violentmonkey/violentmonkey/issues/2219). When many scripts register menu commands via `GM_registerMenuCommand`, the popup becomes unwieldy. Fix:

- Scripts with multiple registered commands collapse into a sub-section in the popup
- Expand on click
- Single-command scripts stay flat (no nesting needed)

### 12.6 Mass Export / Selective Export

VM issue [#2169](https://github.com/violentmonkey/violentmonkey/issues/2169). Current backup exports all scripts or one script. Add:

- Checkbox multi-select in the dashboard script list
- "Export selected" button: generates a ZIP containing only selected scripts
- Individual-script export (already partially exists — make it consistent and discoverable)
- Round-trip format compatibility with Tampermonkey's ZIP export

### 12.7 Bulk Pattern Editing

TM issue [#2442](https://github.com/Tampermonkey/tampermonkey/issues/2442). Allow multi-selecting scripts and adding a shared `@exclude` or `@exclude-match` pattern to all of them at once:

- "Add exclude" action in the multi-select toolbar
- Text input for the new pattern
- Preview which scripts already match the exclude before committing
- Undo via the standard 5-second deferred-commit toast (from Phase 7.4)

### 12.8 Tag Preservation on Reinstall + "Untagged" Filter

TM issue [#2624](https://github.com/Tampermonkey/tampermonkey/issues/2624). Currently reinstalling a script via its install page resets all user-assigned tags.

- On reinstall: detect existing script by namespace+name match; merge user-side fields (tags, enabled state, settings) with new code/metadata from the update
- "Untagged" as a virtual filter option in the tag sidebar (shows all scripts with no tags assigned)

### 12.9 Install from Local File

TM issue [#2722](https://github.com/Tampermonkey/tampermonkey/issues/2722). Allow drag-and-drop or file-picker install of a `.user.js` file without going through a URL:

- File input in the dashboard toolbar (`<input type="file" accept=".user.js,.js">`)
- Parse the file as a userscript; show the normal install confirmation dialog
- Drag-and-drop `.user.js` onto the dashboard also triggers install
- Does not require any new permissions (`chrome.userScripts` registration is already handled)

### 12.10 In-App Update Notifications

TM issue [#2748](https://github.com/Tampermonkey/tampermonkey/issues/2748) and [#2458](https://github.com/Tampermonkey/tampermonkey/issues/2458). Users find OS notification spam for update checks annoying. Replace:

- Remove all `chrome.notifications.create()` calls for routine update check results (no-update, pending)
- Instead: badge a yellow indicator on the extension icon when updates are available
- Dashboard shows an "Updates available" banner that lists pending updates
- Only use OS notifications for: install errors, sync failures, and security warnings (new `@connect` domain added)

### 12.11 Per-Site Enable/Disable Toggle

VM issue [#2410](https://github.com/violentmonkey/violentmonkey/issues/2410). Allow enabling or disabling a script for only the current domain without globally disabling it or editing `@match`. No other manager has this; it fills the gap between "script off everywhere" and "script on everywhere."

- Data model: `ScriptSettings.siteOverrides: { [origin: string]: boolean }` — values override the script's global enabled state for that origin only
- UI: in the popup script list, long-press or right-click on a script row shows "Disable only for this site" / "Enable only for this site"
- Badge shows site-specific count separately from global count
- Does not affect `@match` rules — purely a runtime override at injection decision time

### 12.12 Runtime Permission Diagnostics

VM issue [#2263](https://github.com/violentmonkey/violentmonkey/issues/2263). When `GM_download` or `GM_xmlhttpRequest` fails silently (Chrome blocks the request due to missing host permissions), the user sees an empty error object. Fix:

- On `GM_xmlhttpRequest` error: check whether the target URL's origin has host permission (`chrome.permissions.contains`)
- If no permission: surface a diagnostic toast: _"Request to example.com was blocked. ScriptVault does not have host permission for this domain. [Grant permission]"_
- The "Grant permission" button triggers `chrome.permissions.request({origins: ['https://example.com/*']})` via `chrome.permissions.addHostAccessRequest()` (Chrome 132+) or a fallback dialog
- Log the diagnostic to the script's execution log (Phase 7.5 log panel)

Source: VM issue [#2263](https://github.com/violentmonkey/violentmonkey/issues/2263), [chrome.permissions.addHostAccessRequest() — Chrome 132](https://developer.chrome.com/docs/extensions/whats-new).

### 12.13 Script Recycle Bin (Undo Delete)

VM issue [#2144](https://github.com/violentmonkey/violentmonkey/issues/2144). When a script is deleted or overwritten via reinstall, save the previous version to a soft-delete bin before permanent removal.

- Soft-delete: move to `scripts_trash` IndexedDB store (Phase 2) with a `deletedAt` timestamp; keep for 30 days or until manually purged
- Dashboard "Trash" section (collapsible, greyed out): shows deleted scripts with "Restore" and "Permanently delete" actions
- On script update/reinstall: write the old version to trash before writing the new version
- "Undo" toast after delete: 8-second window; clicking Undo restores from trash immediately

### 12.14 vscode.dev Integration

TM has a companion extension ([Tampermonkey Editors](https://github.com/Tampermonkey/tampermonkey-editors)) that exposes a `chrome.runtime.onMessageExternal` interface so vscode.dev can open and save scripts directly. Implement the same pattern:

- Add a `"externally_connectable"` manifest entry listing vscode.dev as a permitted external connection
- Expose: `getScript(id)`, `listScripts()`, `saveScript(id, code)`, `createScript(metadata, code)` via `onMessageExternal`
- Publish a companion VS Code extension that: connects to ScriptVault, opens scripts as virtual workspace files, auto-saves on `onDidSaveTextDocument`
- VS Code extension ID registered in `externally_connectable.ids`

Source: [Tampermonkey/tampermonkey-editors](https://github.com/Tampermonkey/tampermonkey-editors), VM issue [#1994](https://github.com/violentmonkey/violentmonkey/issues/1994).

### 12.15 `@storageName` — Cross-Script Storage Sharing

ScriptCat allows multiple scripts to share a `GM_setValue`/`GM_getValue` storage namespace by declaring the same `@storageName` in their metadata. Useful for utility scripts that expose a shared data layer.

- Parse `// @storageName <name>` in the metadata block
- When present, use `storageName` as the storage key prefix instead of the script's internal ID
- Security: only scripts with the same `@storageName` can share the bucket; no cross-namespace leakage

Source: [ScriptCat API docs — @storageName](https://docs.scriptcat.org/docs/dev/meta/#storagename).

### 12.16 Script Browser (GreasyFork/OpenUserJS)

VM issue [#2425](https://github.com/violentmonkey/violentmonkey/issues/2425). Complement the existing "Publish to GreasyFork" button (Phase 13.8) with an in-manager script discovery view:

- New "Browse" tab in the dashboard using the GreasyFork JSON API (`greasyfork.org/scripts.json?q=&sort=daily_installs`)
- Display: script name, description, install count, last updated, compatibility badges
- "Install" button: fetches the `.user.js` URL and runs through the normal install dialog
- Search: proxied through `GM_xmlhttpRequest` → background SW to avoid CORS restrictions
- Paginated; no caching needed (network request on open)

Source: [GreasyFork API docs](https://greasyfork.org/en/help/api), VM issue [#2425](https://github.com/violentmonkey/violentmonkey/issues/2425).

**Exit criteria:** Profiles work end-to-end; fuzzy search live in dashboard; executed/enabled distinction visible; list groups collapse; popup commands fold; mass export works; bulk exclude add works; tags preserved on reinstall; local file install works; no OS notifications for routine update checks; per-site enable/disable toggle works; runtime permission diagnostics surface actionable hints; trash bin restores deleted scripts; vscode.dev companion extension connects and saves; `@storageName` storage sharing works; GreasyFork script browser loads and installs scripts.

---

## Phase 13 — Platform Modernization

**Goal:** Adopt Chrome APIs that have matured since v2.x, upgrade key dependencies, and prepare the extension for the next two years of the Chrome platform.

### 13.1 Chrome 148 Structured Clone Messaging

Chrome 148 adds opt-in structured clone serialization for extension messaging, replacing JSON. This enables passing `Map`, `Set`, `BigInt`, `Date`, `Error`, `File`, and `Blob` objects without manual serialization. Source: [Chrome Extensions blog, April 2026](https://developer.chrome.com/blog/structured-clone-messaging).

- Add `"message_serialization": "structured_clone"` to `manifest.json` (requires Chrome 148)
- Guard with version check: only opt in if `Number(navigator.userAgent.match(/Chrome\/(\d+)/)?.[1]) >= 148`
- After TypeScript migration (Phase 1.6): replace `Map<k,v>` → JSON-array workarounds in message passing with direct `Map` usage
- Test: verify backward-compat with Chrome < 148 (falls back to JSON automatically)
- Note: native messaging channels are unaffected (always JSON)

### 13.2 `sidePanel.getLayout()` for RTL Support

Chrome 140 added `chrome.sidePanel.getLayout()` to detect whether the panel is docked left or right. Source: [Chrome Extensions What's New](https://developer.chrome.com/docs/extensions/whats-new).

- Use the panel position to flip the content's internal layout for better visual alignment
- Necessary groundwork for RTL locale support (Phase 14.6)

### 13.3 Chrome 138 "Allow User Scripts" Onboarding Update

Chrome 138 replaced the global Developer Mode requirement with a per-extension "Allow User Scripts" toggle. This changes the onboarding experience for new users. Source: [Chrome blog: chrome.userScripts is changing](https://developer.chrome.com/blog/chrome-userscript).

- Update `onboarding.html` (if it exists) and the install README instructions
- The `isUserScriptsAvailable()` detection function already handles both versions (try/catch approach)
- Ensure `background.js` has the Chrome 138 version-gated check:
  ```js
  const ver = Number(navigator.userAgent.match(/Chrome\/(\d+)/)?.[1]);
  if (ver >= 138) { /* link to per-extension toggle */ }
  else { /* link to developer mode */ }
  ```
- Update CWS description to reference the new toggle path

### 13.4 Monaco Upgrade: 0.52 → 0.55.x

Monaco 0.52 is the pinned version. Monaco 0.55.x adds:
- **Native LSP support** (`lsp` namespace) — enables real-time type-checking, go-to-definition, and hover docs for the userscript editor if a language server is available
- **AMD build deprecated** (0.53.0) — the AMD module format is no longer supported; ScriptVault must verify it does not load Monaco via AMD. The ESM/bundled path (via esbuild) is fine.
- **Namespace refactoring** (0.55.0 breaking) — `languages.css/html/json/typescript` moved to top-level `css/html/json/typescript` — update any import paths if used.

Source: [Monaco Editor CHANGELOG](https://github.com/microsoft/monaco-editor/blob/main/CHANGELOG.md).

Steps:
1. Run `npm install monaco-editor@0.55.x`
2. Verify esbuild bundle still produces working editor
3. Update any `languages.*` namespace references
4. Test all 8 themes and editor keyboard shortcuts

### 13.5 Acorn Upgrade: 8.12 → 8.16

The AST parser used for security analysis. New in 8.14-8.16:
- **ES2025 import attributes** (`with { type: "json" }`)
- **ES2025 RegExp modifiers** (`/foo(?i:bar)/`)
- **`using` / `await using`** explicit resource management (8.15)
- **CommonJS source type** (8.16) — useful for analyzing `require()`-style @require dependencies

Source: [Acorn CHANGELOG](https://github.com/acornjs/acorn/blob/master/acorn/CHANGELOG.md).

Steps: `npm install acorn@latest`; verify AST-based security detector still passes all test cases.

### 13.6 CI: Adapt to `--load-extension` Removal (Chrome 137)

Chrome 137 removes the `--load-extension` CLI flag. Puppeteer has contributed fixes upstream for loading extensions without this flag. Source: [Chrome Extensions June 2025 news](https://developer.chrome.com/blog/extension-news-june-2025).

- Update `npm run smoke:dashboard` to use Puppeteer's new extension-loading API
- Verify CI pipeline still provisions Chrome and loads the unpacked extension
- Test locally: `npx puppeteer browsers install chrome@stable` then run smoke test

### 13.7 Git Repository Sync

VM issue [#2176](https://github.com/violentmonkey/violentmonkey/issues/2176). Allow backing up/restoring scripts to a GitHub/GitLab/Bitbucket repository:

- New sync provider: `GitSync` — uses the GitHub Contents API (or GitLab equivalent) to commit script files to a repo
- Each script = one `.user.js` file in the repo; metadata stored in a `manifest.json` at the repo root
- Commit messages auto-generated: `"Update <ScriptName> to v<version>"` 
- Pull: fetch all `.user.js` files from repo, install/update scripts matching namespace
- Two-way: local changes push upstream; remote changes pull down on sync
- Auth: GitHub personal access token, stored in `chrome.storage.local`
- This slots into Phase 8's sync provider architecture; add `GitHubSyncProvider` implementing the `SyncProvider` interface

### 13.8 Publish to GreasyFork/OpenUserJS

VM issue [#2425](https://github.com/violentmonkey/violentmonkey/issues/2425). One-click publish from the editor:

- Add "Publish…" button in the Monaco editor toolbar
- Dialog: pick target (GreasyFork / OpenUserJS), enter session cookie or API token
- GreasyFork: use the prefill URL API (`/en/script_versions/prefill` POST) to open the submission form pre-populated with the current code
- OpenUserJS: equivalent API endpoint
- Notify via toast when the browser tab opens with the prefill form
- Note: does not require ScriptVault to handle auth; the user's existing browser session is used for GreasyFork's cookie-based submission

### 13.9 `chrome.permissions.addHostAccessRequest()` (Chrome 132)

Chrome 132 added `chrome.permissions.addHostAccessRequest()` to proactively surface host permission requests in the Extensions menu (the puzzle-piece icon) without requiring an immediate dialog. This is especially important for ScriptVault since scripts routinely need permissions for sites not anticipated at install time.

- Call `addHostAccessRequest({tabId, documentId, url})` when a script encounters a permission denial on the current tab
- The Extensions menu will show a "ScriptVault wants access to this site" badge that the user can click to grant
- Gracefully degrades on Chrome < 132 (condition already needed for runtime permission diagnostics in Phase 12.12)

Source: [Chrome Extensions What's New — Chrome 132](https://developer.chrome.com/docs/extensions/whats-new).

### 13.10 CWS Verified CRX Signing (June 2025)

The Chrome Web Store now supports developer-registered signing keys: once a public key is registered in the developer dashboard, all future CRX uploads must be signed with the corresponding private key. An account-takeover attack can no longer push an unsigned update.

- Generate a dedicated signing keypair for ScriptVault (separate from the `.pem` used for local testing)
- Register the public key in the CWS developer dashboard
- Integrate signing into the release workflow (`.github/workflows/release.yml`)
- Store the private key as a GitHub Actions secret (`CWS_SIGNING_KEY`)

Source: [Chrome extension news — June 2025](https://developer.chrome.com/blog/extension-news-june-2025).

### 13.11 `chrome.storage.session` Optimization (Chrome 130)

Chrome 130 added `StorageArea.getKeys()` across all storage areas, reducing overhead for frequent "list what's in storage" operations in the service worker. The session storage area (10 MB quota, in-memory, cleared on restart) is ideal for per-tab volatile state like currently-executing script IDs and per-tab injection results.

- Migrate volatile runtime state (currently stored in in-memory JS objects that die with the SW) into `chrome.storage.session`
- Use `getKeys()` in hotpaths where a full `get()` is unnecessary
- Set `setAccessLevel({accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS'})` if content scripts need to read session state

Source: [chrome.storage API reference](https://developer.chrome.com/docs/extensions/reference/api/storage).

**Exit criteria:** Structured clone opt-in on Chrome 148; panel layout aware; onboarding docs reflect Chrome 138 toggle; Monaco 0.55.x with AMD migration verified; Acorn 8.16; smoke tests pass without `--load-extension`; git sync provider works end-to-end; GreasyFork prefill flow works; `addHostAccessRequest()` used for permission denials on Chrome 132+; CWS signing key registered and wired into release workflow; volatile SW state migrated to `storage.session`.

---

## Phase 14 — Accessibility & Internationalization

**Goal:** Meet WCAG 2.2 AA compliance for ScriptVault's own UI and broaden locale support.

These items address structural accessibility debt and do not affect script execution. They are independently shippable.

### 14.1 Font Sizes: px → rem

All font sizes are currently in `px`, which ignores user browser font-size preferences (see `CLAUDE.md` Known Remaining Issues).

- Audit every CSS file: `grep -n 'font-size:.*px' **/*.{css,html,js}`
- Replace all `px` values with `rem` equivalents (base 16px assumed)
- Test: set Chrome's base font to 20px and verify dashboard text scales correctly
- Also convert `line-height` and spacing tied to font size

### 14.2 WCAG 2.2 Focus Visibility (2.4.11 AA)

WCAG 2.2 criterion 2.4.11 (published October 2023) requires that when a component receives keyboard focus, it is not entirely hidden by author-created content. Source: [W3C WCAG 2.2 new criteria](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/).

- Audit sticky/fixed elements (sidepanel toolbar, dashboard header, toast stack) to verify they do not obscure focused elements
- Add `scroll-margin-top` / `scroll-padding-top` to ensure focused rows scroll into view above sticky headers

### 14.3 WCAG 2.2 Target Sizes (2.5.8 AA)

Criterion 2.5.8 requires touch targets to be at least 24×24 CSS pixels (with spacing accounting for smaller sizes). Source: [W3C WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/).

- Audit all interactive controls: script enable/disable toggles, action buttons, checkboxes, dropdown items
- Apply `min-height: 24px; min-width: 24px` or ensure adequate spacing via `padding` around smaller controls
- Note: most dashboard controls are already ≥ 32px; this primarily affects the popup's compact list

### 14.4 Screen Reader Support for Script Toggles

TM issue [#2676](https://github.com/Tampermonkey/tampermonkey/issues/2676). The script enable/disable toggle is not announced correctly by screen readers.

- Ensure toggle elements use `<button role="switch" aria-checked="true|false">` pattern
- Add `aria-label` with script name: `aria-label="Enable {scriptName}"`
- Announce state change via `aria-live="polite"` region (or `role="status"`)
- Test with NVDA (Chrome) and VoiceOver (macOS)

### 14.5 Drag-Sort Keyboard Alternative

WCAG 2.5.7 (AA) requires that any drag movement have a single-pointer alternative. The script list drag-sort and folder reordering have no keyboard fallback. Source: [W3C WCAG 2.2 dragging movements](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/).

- When a drag-handle is focused (keyboard Tab), pressing Enter enters "move mode"
- Arrow keys move the item up/down in the list
- Enter confirms placement; Escape cancels
- Visual indicator shows which item is being moved and its target position

### 14.6 RTL Layout Support

Groundwork for right-to-left locales (Arabic, Hebrew, Farsi). Uses the `sidePanel.getLayout()` API from Phase 13.2.

- Switch all directional CSS from `left`/`right` to `inset-inline-start`/`inset-inline-end`
- Test by setting `<html dir="rtl">` and verifying layout does not break
- `chrome.sidePanel.getLayout()` result feeds `data-panel-side` attribute on `<body>` for per-side styling

### 14.7 i18n: `_messages.json` Coverage Audit

The extension's `_locales/` directory has en-US strings but coverage is incomplete (many UI strings are hardcoded in JS/HTML).

- Enumerate all user-visible strings via `grep -rn "textContent\|innerHTML\|innerText\|placeholder\|title\|aria-label" pages/ dashboard-*.js`
- Move all found strings to `_messages.json` entries
- Add `getMessage()` calls in JS; `data-i18n` attributes in HTML with a lightweight init-time substitution pass
- Start with en-US only; structure enables future community translations
- Add a CI lint step: strings not in `_messages.json` are a build warning

**Exit criteria:** All font sizes in rem; WCAG 2.2 focus and target criteria pass; toggle announced correctly by screen reader; drag-sort has keyboard alternative; RTL layout does not break; all visible strings in `_messages.json`.

---

## Phase Summary & Dependencies

```
Phase 0 ─── Foundation (Node.js, Monaco, CI)
  │
Phase 1 ─── TypeScript Migration
  │
  ├── Phase 2 ─── Storage Rewrite (IndexedDB)
  │     │
  │     ├── Phase 3 ─── Service Worker Resilience
  │     │
  │     └── Phase 8 ─── Sync & Backup Rewrite
  │           │
  │           └── Phase 9 ─── Migration System
  │
  ├── Phase 4 ─── URL Matcher Rewrite
  │
  ├── Phase 5 ─── Security Hardening
  │
  ├── Phase 6 ─── Update System Overhaul
  │
  └── Phase 7 ─── Dashboard UX

Phase 10 ─── Testing (runs in parallel, grows with each phase)

Phase 11 ─── GM API Parity (Phase 11.9 needs Phase 2 for storage.session; rest independent)
Phase 12 ─── UX Polish (12.13 Trash needs Phase 2; 12.14 vscode.dev needs Phase 1; rest independent)
Phase 13 ─── Platform Modernization (13.7 Git sync needs Phase 8; rest can start now)
Phase 14 ─── Accessibility & i18n (fully independent, can start now)
```

### Suggested Execution Order
1. **Phase 0** — Unblocks everything
2. **Phase 1** (waves 1-3) — TypeScript for modules and background
3. **Phase 4** — URL matcher (high bug density, self-contained)
4. **Phase 2** — Storage rewrite (enables phases 3, 8, 9, and parts of 11/12)
5. **Phase 5** — Security (can run partially in parallel with 2)
6. **Phase 3** — Service worker resilience (depends on Phase 2)
7. **Phase 1** (waves 4-5) — TypeScript for pages/dashboard
8. **Phase 7** — Dashboard UX (depends on TypeScript pages)
9. **Phase 6** — Update system (depends on storage rewrite)
10. **Phase 8** — Sync rewrite (depends on storage rewrite)
11. **Phase 9** — Migration system (depends on storage rewrite)
12. **Phase 10** — Testing (continuous, ramps up each phase)
13. **Phase 11** — GM API Parity (can run alongside phases 4–10 for self-contained items)
14. **Phase 12** — UX Polish (can run alongside phases 7–10; 12.13 after Phase 2)
15. **Phase 13** — Platform Modernization (13.9–13.11 can start now; 13.7 after Phase 8)
16. **Phase 14** — Accessibility & i18n (can start anytime; fully independent)

### Version Mapping
| Phase | Version | Milestone |
|-------|---------|-----------|
| 0     | v2.1.0  | Dev environment, Monaco local, CI |
| 1.1-1.3 | v2.2.0 | TypeScript modules |
| 4     | v2.3.0  | Unified URL matcher |
| 2     | v3.0.0  | IndexedDB storage (breaking migration) |
| 5     | v3.1.0  | Security hardening |
| 3     | v3.2.0  | Service worker resilience |
| 1.4-1.5 | v3.3.0 | TypeScript pages + new build |
| 7     | v3.4.0  | Dashboard UX |
| 6     | v3.5.0  | Update system |
| 8     | v3.6.0  | Sync rewrite |
| 9     | v3.7.0  | Migration framework |
| 10    | v4.0.0  | Full test suite, production-ready |
| 11    | v4.1.0  | GM API parity + metadata directives |
| 12    | v4.2.0  | UX polish + vscode.dev + per-site toggles |
| 13    | v4.3.0  | Platform modernization + CWS signing |
| 14    | v4.4.0  | WCAG 2.2 + i18n groundwork |

## Open-Source Research (Round 2)

### Related OSS Projects
- **Violentmonkey** — https://github.com/violentmonkey/violentmonkey — GPLv3 userscript manager; automatic updates, execute-in-order, GM functions, zip import/export, cloud sync (Dropbox/OneDrive/GDrive/WebDAV); strong MV2-era reference (MV3 not yet shipped)
- **ScriptCat** — https://github.com/scriptscat/scriptcat — GPLv3 userscript manager with full MV3 support; background script engine, subscription system
- **Tampermonkey** — https://github.com/Tampermonkey/tampermonkey — GPLv3-published source; widest API coverage (GM_webRequest, GM_cookie) — useful as a compatibility reference
- **Userscripts (Safari)** — https://github.com/quoid/userscripts — Safari/iOS open-source manager; very minimal, good pattern for lean UIs
- **GreasyFork** — https://github.com/JasonBarnabe/greasyfork — script-hosting platform source; useful for integrating a "Browse GreasyFork" tab inside ScriptVault
- **vite-plugin-monkey** — https://github.com/lisonge/vite-plugin-monkey — Vite plugin for building userscripts compatible with all managers; inspiration for an in-editor build step
- **awesome-userscripts** — https://github.com/awesome-scripts/awesome-userscripts — curated index; integrate as a discovery catalog

### Features to Borrow
- Cloud sync across Dropbox/OneDrive/GDrive/WebDAV with conflict resolution (Violentmonkey)
- Script subscription/feed: follow a URL that publishes a list of scripts and auto-pull updates (ScriptCat)
- GM_webRequest / GM_cookie / GM_xmlHttpRequest anonymous mode parity checklist (Tampermonkey API surface)
- "Execute in specified order" with drag-sortable priority per @match pattern (Violentmonkey)
- Zip import/export that round-trips with Tampermonkey's native format (Violentmonkey)
- Storage editor: edit values.* GM_setValue store directly with JSON tree view (Violentmonkey)
- CSP-page injection fallback that uses declarativeNetRequest rule to strip CSP for matched domains (Violentmonkey)
- Per-script resource/cache tab so users can inspect @resource downloads and their hashes (Tampermonkey)
- Browse GreasyFork / OpenUserJS from inside the manager with one-click install (Tampermonkey has it)
- Vite-plugin-monkey-style bundler integrated into the Monaco editor: type TypeScript, compile on save (vite-plugin-monkey)
- "Dry-run" script execution in an isolated test page with network-mock to debug without side effects

### Patterns & Architectures Worth Studying
- MV3 service-worker + offscreen-document pattern for long-lived GM_xmlHttpRequest handlers without losing state on SW termination (ScriptCat)
- Compilation-step architecture: write modern TS, transpile to IIFE userscript at install time (ScriptCat, vite-plugin-monkey)
- Sync-conflict resolver pattern: last-modified per field rather than per document, so cloud edits don't clobber local toggle flips (Violentmonkey)
- Subscription/feed model: userscripts as RSS-like feeds, manager polls for updates (ScriptCat) — cleaner than the Tampermonkey @updateURL-per-script approach
- Isolated-world MAIN-world dual-injection with a typed postMessage bridge (Violentmonkey source has a clean implementation to mirror)

## Implementation Deep Dive (Round 3)

### Reference Implementations to Study
- **Tampermonkey/tampermonkey / src/background.js** — https://github.com/Tampermonkey/tampermonkey — reference for the GM_* API surface, `@match` compilation, and cross-context message routing; ground truth for compatibility.
- **Tampermonkey/tampermonkey-editors** — https://github.com/Tampermonkey/tampermonkey-editors — Monaco-on-vscode.dev integration pattern via `externalExtensionIds` + `chrome.runtime.onMessageExternal`; useful for a future "edit in vscode.dev" feature.
- **violentmonkey/violentmonkey / src/background/** — https://github.com/violentmonkey/violentmonkey — MV3-first userscript manager; cleanest example of `chrome.userScripts` API (Chrome 120+) vs. our `chrome.scripting.executeScript` fallback.
- **microsoft/monaco-editor / samples/browser-esm-webpack/** — https://github.com/microsoft/monaco-editor/tree/main/samples — correct web-worker config for MV3 (workers must be bundled, not fetched from CDN).
- **openuserjs/OpenUserJS.org** — https://github.com/OpenUserJS/OpenUserJS.org — script hosting metadata schema; informs our manifest parser.
- **greasemonkey/greasemonkey / src/bg/api-provider-source.js** — historical GM_* polyfill reference if we need to cover pre-WebExtensions APIs.
- **orangishcat/page-proxy (DEV writeup)** — https://dev.to/orangishcat/i-built-a-gui-powered-userscript-manager-for-faster-userscript-creation-ebb — lessons learned bundling Monaco into an MV3 extension, including the ~few-MB size tradeoff and IntelliSense type-stub injection.

### Known Pitfalls from Similar Projects
- **SW lifecycle kills long-running scripts** — MV3 service worker idles after 30s; Tampermonkey works around with `chrome.alarms` heartbeats. See: https://github.com/Tampermonkey/tampermonkey/issues (SW lifecycle threads).
- **`eval`/`Function()` banned under MV3 CSP** — userscripts using `unsafeWindow` or evaluating strings need `world:"MAIN"` content scripts, not extension-world eval. Reference: https://github.com/violentmonkey/violentmonkey
- **Monaco web-worker CSP** — loading Monaco's workers from a blob URL fails on CSP-strict hosts; workers must be declared in manifest's `web_accessible_resources` and loaded by relative URL.
- **`@require` external fetch under MV3** — remotely fetched JS can't be `eval`'d; cache and inject via `chrome.scripting.executeScript({ files:[...] })` into `world:"MAIN"`.
- **`GM_xmlhttpRequest` cross-origin** — extension has host perms but script's origin doesn't; must proxy via background. TM implements this; we should match that shape to stay drop-in compatible.
- **Persistence of editor state** — Monaco models > 5MB blow past `chrome.storage.local`; use IndexedDB. See: https://github.com/microsoft/monaco-editor/issues
- **Unsandboxed `eval` risk** — if we ever run user scripts in the extension world, a malicious script can call `chrome.*`. Always `world:"MAIN"`.

### Library Integration Checklist
- **monaco-editor** pin `>=0.48.0`; entrypoint `monaco.editor.create`; gotcha: ship workers bundled (editor, ts, json, css, html) via `MonacoEnvironment.getWorkerUrl`, not CDN.
- **chrome.userScripts API** (Chrome 120+); entrypoint `chrome.userScripts.register`; gotcha: requires `"userScripts"` permission + user-enabled developer mode (Chrome 138 dialog).
- **chrome.scripting.executeScript** fallback; entrypoint standard; gotcha: `world:"MAIN"` needed for `@match`-style scripts; `"ISOLATED"` for extension-API bridges.
- **vitest** pin `>=2.0`; entrypoint `vitest run`; gotcha: needs `@vitest/web-worker` for Monaco worker mocks.
- **esbuild** pin `>=0.25.0`; gotcha: set `target:"chrome120"` to match MV3 baseline so class fields/top-level-await ship unshimmed.
- **idb** (IndexedDB wrapper) pin `>=8.x`; entrypoint `openDB`; gotcha: SW can't hold DB handles across restarts — reopen per operation.
- **@types/greasemonkey** pin latest; provides GM_* typings for the editor's IntelliSense.

## External Research (Round 4)

_Added after agent-based competitive and platform research sweep (June 2025). Sources are numbered to facilitate the gap analysis appendix below._

### Source Index

**Competitor APIs and Documentation**
1. https://docs.scriptcat.org/docs/dev/api/ — ScriptCat full GM API reference (v0.17.x)
2. https://docs.scriptcat.org/docs/dev/background/ — ScriptCat background script architecture
3. https://docs.scriptcat.org/docs/dev/cat-api/ — ScriptCat CAT_ unique API extensions
4. https://docs.scriptcat.org/docs/dev/meta/#storagename — ScriptCat `@storageName` metadata
5. https://violentmonkey.github.io/api/gm/ — Violentmonkey GM_ function reference
6. https://violentmonkey.github.io/api/metadata-block/ — Violentmonkey metadata block spec
7. https://www.tampermonkey.net/changelog.php — Tampermonkey changelog (recent releases)
8. https://github.com/quoid/userscripts — Userscripts (Safari) README and metadata docs
9. https://github.com/Tampermonkey/tampermonkey-editors — TM vscode.dev companion extension
10. https://github.com/lisonge/vite-plugin-monkey — vite-plugin-monkey README (auto-grant, ESM, HMR)
11. https://github.com/kusoidev/ScriptFlow — ScriptFlow multi-file userscript IDE (community)

**Chrome Extension Platform**
12. https://developer.chrome.com/docs/extensions/whats-new — Chrome Extensions What's New (Chrome 120–148)
13. https://developer.chrome.com/docs/extensions/reference/api/userScripts — userScripts API reference
14. https://developer.chrome.com/docs/extensions/reference/api/storage — chrome.storage API reference
15. https://developer.chrome.com/docs/extensions/reference/api/offscreen — chrome.offscreen API reference
16. https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle — SW lifecycle
17. https://developer.chrome.com/blog/extension-news-june-2025 — CWS signing, --load-extension removal
18. https://developer.chrome.com/blog/structured-clone-messaging — Chrome 148 structured clone opt-in
19. https://developer.chrome.com/blog/chrome-userscript — Chrome 138 Allow User Scripts toggle
20. https://developer.chrome.com/docs/webstore/program-policies/ — CWS developer program policies
21. https://extensionworkshop.com/documentation/develop/manifest-v3-migration-guide/ — Firefox MV3 guide

**GitHub Issue Trackers**
22. https://github.com/violentmonkey/violentmonkey/issues/2464 — Fuzzy/ranked search
23. https://github.com/violentmonkey/violentmonkey/issues/2425 — Direct GF publish + browser
24. https://github.com/violentmonkey/violentmonkey/issues/2419 — `@require-local` local dependencies
25. https://github.com/violentmonkey/violentmonkey/issues/2410 — Per-site enable/disable toggle
26. https://github.com/violentmonkey/violentmonkey/issues/2365 — Enterprise policy deployment
27. https://github.com/violentmonkey/violentmonkey/issues/2359 — GM_xmlhttpRequest redirect control
28. https://github.com/violentmonkey/violentmonkey/issues/2342 — `@top-level-await` as default
29. https://github.com/violentmonkey/violentmonkey/issues/2287 — Script list grouping/folding
30. https://github.com/violentmonkey/violentmonkey/issues/2263 — Runtime permission diagnostics
31. https://github.com/violentmonkey/violentmonkey/issues/2219 — Collapsible popup command groups
32. https://github.com/violentmonkey/violentmonkey/issues/2176 — Local filesystem sync
33. https://github.com/violentmonkey/violentmonkey/issues/2168 — GM_xmlhttpRequest nocache
34. https://github.com/violentmonkey/violentmonkey/issues/2144 — Recycle bin / undo delete
35. https://github.com/violentmonkey/violentmonkey/issues/2125 — Local filesystem directory sync
36. https://github.com/violentmonkey/violentmonkey/issues/2100 — CHIPS cookie partition in XHR
37. https://github.com/violentmonkey/violentmonkey/issues/2048 — SPA-aware popup / `@match-active`
38. https://github.com/violentmonkey/violentmonkey/issues/1994 — vscode.dev integration (17 comments)
39. https://github.com/violentmonkey/violentmonkey/issues/1982 — GM_registerMenuCommand accessKey

**Standards and Specifications**
40. https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/ — WCAG 2.2 new criteria
41. https://wiki.greasespot.net/Metadata_Block — Greasemonkey metadata spec (canonical)
42. https://greasyfork.org/en/help/api — GreasyFork JSON API + prefill endpoint
43. https://github.com/WICG/navigation-api — Navigation API spec (Chrome 102)

**Community Signal**
44. https://news.ycombinator.com/item?id=42337605 — Launch HN: Tweeks (YC W25) — 351pts/213 comments
45. https://github.com/advisories?query=userscript — GitHub Advisory Database (4 advisories)
46. https://github.com/awesome-scripts/awesome-userscripts — Awesome Userscripts landscape index

### Chrome Platform API Timeline (Chrome 120–148)

| Version | API Change | ScriptVault Impact |
|---------|-----------|-------------------|
| Chrome 120 | `userScripts` API launched; `chrome.alarms` min interval 30s | Baseline; alarms can now cover 30–60s tasks |
| Chrome 130 | `StorageArea.getKeys()` across all storage areas | Phase 13.11 |
| Chrome 132 | `tabs.Tab.frozen` boolean; `permissions.addHostAccessRequest()` | Phase 12.12, 13.9 |
| Chrome 133 | `worldId` on `RegisteredUserScript` for per-script isolation | Phase 13 architecture note |
| Chrome 135 | `userScripts.execute()` one-shot injection | Phase 11.4 |
| Chrome 137 | `--load-extension` CLI flag removed | Phase 13.6 |
| Chrome 138 | "Allow User Scripts" per-extension toggle | Phase 13.3 |
| Chrome 140 | `sidePanel.getLayout()` | Phase 13.2 |
| Chrome 148 | Structured clone messaging opt-in | Phase 13.1 |

### Key Competitive Feature Gaps (Summary)

Confirmed absent from ScriptVault based on API docs and issue tracker analysis:

- `GM_cookie` — present in TM and ScriptCat; absent from VM intentionally; high demand [sources 1, 7]
- `GM_getTab/saveTab/getTabs` — present in TM, ScriptCat, Userscripts Safari [sources 1, 8]
- `@inject-into` — present in VM and Userscripts Safari; affects world selection [source 6]
- `@connect` enforcement — TM parses; VM does not; affects XHR sandboxing [source 41]
- `@require` SRI — TM supports; others do not; supply-chain security gap [source 7]
- `@run-at navigation` — nobody has it; highest SPA pain point in community [sources 37, 43]
- Per-site enable/disable — nobody has it; VM issue open since 2024 [source 25]
- vscode.dev integration — TM has companion extension; nobody else [source 9]
- Runtime permission diagnostics — VM issue open; major usability gap [source 30]
- CWS verified CRX signing — new June 2025; no manager has adopted yet [source 17]

## Feature Harvest & Gap Analysis Appendix

This appendix records ALL features considered for Phases 11–14, their final tier, and the reasoning. Items are grouped by the category used in the research brief.

### Accepted — Now/Next (Phases 11–14)

| Item | Tier | Phase | Reasoning |
|------|------|-------|-----------|
| `GM_info` enrichment (isIncognito, platform) | Now | 11.1 | Direct parity gap; 0 new permissions; low risk |
| `@unwrap` metadata | Now | 11.2 | High compatibility value for VM scripts |
| Per-script merge-mode flags | Now | 11.3 | Addresses documented override behavior gap |
| `userScripts.execute()` Run Now button | Now | 11.4 | Requires Chrome 135; high dev-UX value |
| GM_xmlhttpRequest `noCache`/`redirect` | Now | 11.5 | Low-effort, high parity value |
| GM_xmlhttpRequest `stream` responseType | Next | 11.5 | Moderate effort; ScriptCat differentiator |
| `GM_cookie` API | Now | 11.6 | Power-user necessity; TM/ScriptCat have it |
| `@inject-into` directive | Now | 11.7 | Security-relevant world selection |
| `@connect` enforcement | Now | 11.7 | XHR sandboxing; security-relevant |
| `@tag`, `@antifeature`, `@compatible` | Now | 11.7 | Low-effort metadata parity |
| `@top-level-await` | Now | 11.7 | Needed for async script patterns |
| `@run-at document-body` | Now | 11.7 | VM parity; fills lifecycle gap |
| `@weight` | Next | 11.7 | Low priority; rare need |
| `@require` SRI verification | Now | 11.8 | Supply-chain security; high value |
| `GM_getTab/saveTab/getTabs` | Next | 11.9 | Medium effort; tab-scoped state common in TM scripts |
| `@run-at navigation` | Now | 11.10 | Highest SPA pain point; no competitor has it yet |
| `GM_notification` progress/buttons/update | Next | 11.11 | Moderate; chrome.notifications supports it natively |
| Script profiles (groups) | Now | 12.1 | High demand; enables bulk enable/disable |
| Fuzzy search | Now | 12.2 | Quality of life; <1 day with existing Web Worker |
| Enabled-but-not-executed distinction | Now | 12.3 | TM differentiator; directly addresses user confusion |
| Script list grouping/folding | Now | 12.4 | VM issue #2287; low effort |
| Popup command collapse | Now | 12.5 | VM issue #2219; trivial |
| Mass export | Now | 12.6 | VM issue #2169; extends existing backup system |
| Bulk pattern editing | Next | 12.7 | TM issue #2442; moderate effort |
| Tag preservation on reinstall | Now | 12.8 | TM issue #2624; low effort |
| Install from local file | Now | 12.9 | TM issue #2722; file picker trivial |
| In-app update notifications | Now | 12.10 | TM issue #2748; removes OS notification spam |
| Per-site enable/disable toggle | Now | 12.11 | VM issue #2410; no competitor has it — leapfrog |
| Runtime permission diagnostics | Now | 12.12 | VM issue #2263; actionable fix for silent failures |
| Recycle bin / undo delete | Next | 12.13 | VM issue #2144; needs Phase 2 IndexedDB |
| vscode.dev integration | Next | 12.14 | TM companion extension is the reference; high dev value |
| `@storageName` cross-script storage | Next | 12.15 | ScriptCat feature; moderate effort |
| GreasyFork script browser | Next | 12.16 | Complement to 13.8; improves discovery |
| Structured clone messaging (Chrome 148) | Now | 13.1 | Manifest opt-in + version guard; low effort |
| `sidePanel.getLayout()` | Now | 13.2 | Groundwork for RTL support |
| Chrome 138 onboarding update | Now | 13.3 | Docs + detection code; <1 day |
| Monaco 0.52 → 0.55.x | Now | 13.4 | AMD deprecation is a time-sensitive migration |
| Acorn 8.12 → 8.16 | Now | 13.5 | ES2025 features for AST analysis |
| CI: adapt to `--load-extension` removal | Now | 13.6 | Chrome 137 already shipped; CI will break |
| Git repository sync | Next | 13.7 | Substantial effort; needs Phase 8 sync architecture |
| GreasyFork publish button | Next | 13.8 | VM issue #2425; moderate effort |
| `chrome.permissions.addHostAccessRequest()` | Now | 13.9 | Chrome 132; enhances permission diagnostics |
| CWS verified CRX signing | Now | 13.10 | June 2025 CWS change; security-critical |
| `chrome.storage.session` optimization | Now | 13.11 | Chrome 130 `getKeys()` + volatile state migration |
| Font sizes px → rem | Now | 14.1 | CLAUDE.md known issue; accessibility debt |
| WCAG 2.2 focus visibility | Now | 14.2 | AA compliance |
| WCAG 2.2 target sizes | Now | 14.3 | AA compliance |
| Screen reader toggle support | Now | 14.4 | TM issue #2676 |
| Drag-sort keyboard alternative | Now | 14.5 | WCAG 2.5.7 AA |
| RTL layout groundwork | Next | 14.6 | Requires Phase 13.2; enables Arabic/Hebrew |
| i18n `_messages.json` audit | Next | 14.7 | Prerequisite for any future translations |

### Rejected — With Reasoning

| Item | Reason |
|------|--------|
| `@background` persistent scripts (ScriptCat) | Fundamentally incompatible with MV3 SW model. ScriptCat achieves this via a non-standard SW keepalive mechanism that violates CWS policies. Architecture would require a complete rewrite. Rejected as architectural mismatch. |
| AI script generation (Tweeks pattern) | Explicitly deleted from ScriptVault as bloat (see CLAUDE.md). The Tweeks HN launch validates market demand but contradicts the project's stated design philosophy. Rejected — not this project's mission. |
| Script subscription/feed system (ScriptCat) | Explicitly removed from ScriptVault as "over-engineered". Would duplicate GreasyFork's function. Rejected as feature creep. |
| `CAT_fileStorage` binary cloud storage | ScriptCat-unique architecture requiring a dedicated cloud backend. Maintenance burden too high; no clear user base for ScriptVault. Rejected as disproportionate effort. |
| `CAT_proxy` per-script proxy | Conflicts with Proxy SwitchyOmega and similar extensions. Requires elevated permissions. ScriptCat acknowledges conflict risk. Rejected as too invasive. |
| Multi-file ES module project IDE (ScriptFlow) | ScriptFlow is a standalone application for this exact use case. Implementing it in ScriptVault would duplicate ScriptFlow and require a bundler pipeline inside the extension. Rejected as out of scope for a manager. |
| Live HTML/CSS/JS preview window (ScriptFlow) | Same rationale as multi-file IDE. Rejected. |
| Git repo integration (clone/commit in browser) | 13.7 covers script-file sync to git. Full clone/commit/push of arbitrary repos is a different product category. Rejected as scope creep beyond script management. |
| `GM_openInTab` `useOpen` / `incognito` | ScriptCat-specific; very niche use cases (special-protocol URLs, incognito automation). Low demand signal. Deferred: Under Consideration. |
| `GM_registerMenuCommand` `accessKey` keyboard shortcut | Specification explicitly prohibits keyboard shortcuts (CLAUDE.md universal rule). Rejected. |
| `GM_registerMenuCommand` `nested` context-menu level | ScriptCat-specific UI pattern; does not translate cleanly to Chrome extension popup model. Rejected as UX mismatch. |
| `GM_audio.getState()` | TM experimental with no published documentation. No use case beyond very niche audio-control scripts. Rejected as too experimental. |
| `GM_log` with levels | The extension already has an execution log panel. This would add an API surface for something the log panel already provides. Deferred: Under Consideration for Phase 7 log panel expansion. |
| Script-to-standalone-extension compiler | Distribution tooling for non-technical users. Not a script manager feature. Community tool (`hrussellzfac023.github.io`) already exists. Rejected. |
| Enterprise MDM/registry policy deployment | VM issue #2365 with 6 comments — low demand relative to effort. Requires Chrome policy infrastructure. Deferred: Under Consideration for a future enterprise-focused phase if demand grows. |
| Script subscription/collectible collections | Same as script subscription/feed above. Rejected. |
| Toolbar badge display options (TM) | Low-value cosmetic option. Deferred: Under Consideration as a minor preference in a settings cleanup pass. |
| `$DATETIME$` template variable | Trivial to add but not in any user-facing issue tracker. Under Consideration as part of a future "editor quality of life" micro-release. |
| Storage editor `Ctrl+S` save | TM changelog item. Dashboard already has storage viewer; Ctrl+S save is a minor UX improvement. Under Consideration alongside the storage editor work in Phase 7. |
| SPA-aware `@match-active` metadata (VM proposal) | Phase 11.10 covers the behavioral fix (`@run-at navigation`). The `@match-active` metadata proposal is speculative. Deferred: evaluate after `@run-at navigation` ships. |
| Firefox port (all phases) | Tracked separately in `FIREFOX-PORT.md`. Excluded from this roadmap to prevent scope bleed. |
| Mobile support | Desktop-only Chrome extension. No mobile Chrome extension runtime for injecting userscripts. Rejected as platform limitation. |
| CHIPS cookie partition in XHR | Nobody has implemented this yet; Chrome's cookie partitioning API is still evolving. Under Consideration once the Chrome API stabilizes. |
| `@require-local` / local script as dependency | This is Phase 11 item 11.7's `@require` work extended. The `@require-local` pattern (referencing another installed script by ID as a dependency) is a valid extension of the `@require` SRI work. Under Consideration as Phase 11 follow-up. |
