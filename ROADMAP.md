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

## Phase 2 — Storage Layer Rewrite ✅ Shipped in v3.0.0

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

**Status:** Shipped in v3.0.0. `src/storage/{idb,transaction,script-db,migration-v3}.ts` ship the IDB layer; `ScriptStorage`, `ScriptValues`, and `PublicAPI.installScript`/`toggleScript` route through DAOs. Migration is automatic on first v3 boot (legacy keys preserved 30 days as a safety net). 550 tests passing including IDB-aware rollback regression suite. Stats fire-and-forget integration deferred to a follow-up (StatsDAO exists, ScriptStats module not yet wired). BackupStorage refactor also deferred — backups still go through `chrome.storage.local` until the backup-scheduler module is migrated.

---

## Phase 3 — Service Worker Resilience ✅ Shipped in v3.0.1 + v3.0.2

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

**Status:** Shipped across v3.0.1 (cold-start guard, statsSave alarm) and v3.0.2 (SessionState persistence for `_notifCallbacks` / `_openTabTrackers` / `_audioWatchedTabs`, stale-script unregistration in `registerAllScripts` diff-on-wake). Code-hash–based change detection deferred — current diff catches add/remove but treats updated-in-place scripts as a forceReregister upstream concern.

---

## Phase 4 — URL Matching Engine Rewrite

**Goal:** One correct, shared, fast URL matcher used everywhere.

**Status:** Partially shipped in v3.1.0 — `MatchSet` (4.2) lands in both `background.core.js` and the TS mirror at `src/background/url-matcher.ts`; `getScriptsForUrl` now uses it; the matcher tests now import the production TS module instead of duplicating logic. Remaining: 4.3 (popup/sidepanel currently message the background for matching, so they share results indirectly — formal direct-import bundle still pending an esbuild migration), 4.1's full path-vs-query separation rewrite, plus the 4.5 fuzz/benchmark suite.

### 4.1 Unified Matcher Module
Create `src/shared/url-matcher.ts`:
- Full Tampermonkey-compatible `@match` (Chrome match pattern spec)
- Full `@include` (glob with `*` and `?`, plus regex patterns)
- `@exclude` and `@exclude-match` support
- `<all_urls>` special pattern
- Proper handling: path matching uses pathname only (not query string), aligning with Chrome's native behavior

### 4.2 Precompiled Match Sets ✅ Shipped in v3.1.0
```typescript
class MatchSet {
  private universal: Script[];          // <all_urls>, *, regex includes, host-less globs
  private byHost: Map<string, Script[]>; // host hint → scripts indexed under that host

  constructor(scripts: readonly Script[]);
  getCandidates(url: string): Script[]; // strict superset of true matches
  getMatching(url: string): Script[];   // candidates filtered through doesScriptMatchUrl
}
```
- Builds an `O(1)` hostname → script bucket so `getScriptsForUrl` no longer linear-scans every pattern.
- Wildcard subdomains (`*.example.com`) indexed under the base domain; deep subdomains (`a.b.example.com`) resolved via parent-suffix walk.
- Regex `@include` and host-less globs land in a universal bucket so the candidate set remains a strict superset of the true match set (zero false negatives).
- Cached in `_matchSetCache`; invalidated automatically by `invalidateMatchSet()` global hook called from `ScriptStorage.set/delete/clear`.
- Wired into the `getScriptsForUrl` background message handler. Other hot paths (`registerAllScripts` matching loops, tab-reload, badge updates) can adopt `getMatchSet().getMatching(url)` incrementally.

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

**2026-05-02 note (v3.1.0):** The url-matcher test file now imports `src/background/url-matcher.ts` directly instead of redefining the matcher logic locally — the previous duplication had silently drifted. 21 new tests added covering `MatchSet` (host indexing, wildcard subdomains, universal bucket, port stripping, dedup), `isUrlBlockedByGlobalSettings` (denied-host suffix-coincidence guard, whitelist/blacklist modes, malformed URLs), and a ReDoS regression that pins the `*+ → *` collapse in `matchIncludePattern`. Full suite is now 571 tests across 33 files. Fuzz harness + 500-script benchmark still pending.

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

**Status:**
- **Webhook RFC 1918 / internal-host guard shipped in v3.6.1 (2026-05-02).** `PublicAPI.setWebhook` rejects URLs whose hostname matches the existing `_isInternalHost` classifier (localhost aliases, IPv4 loopback/unspecified/RFC 1918/CGNAT/link-local/broadcast, IPv6 loopback/link-local/ULA). 7 new tests cover the rejection set; public hostnames + public IPv4 still pass.
- npm resolver SSRF guard (path traversal + exact semver) was already in place from earlier rounds.
- **Gist fake-encryption removed in v3.6.2 (2026-05-02).** Token now stored plaintext in `chrome.storage.local`; one-shot legacy migration decrypts existing installs' tokens with the old hardcoded key and re-saves them under the new key, then drops the legacy entry. UX hint copy updated to describe the storage model honestly.
- Cloud-sync passphrase encryption still pending.

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

### 6.1 Differential Updates ✅ Shipped
- Send `If-Modified-Since` / `If-None-Match` headers on update checks
- Skip download if 304 Not Modified
- Track ETags per script in metadata
- Exponential backoff on failed update checks (not fixed interval)

**Status:** Conditional fetch (`If-None-Match`/`If-Modified-Since` + 304 short-circuit) was already in place. **v3.6.0 (2026-05-02)** added the per-script exponential backoff layer: `_updateFailureCount` doubles on each failure (1m base, capped at 24h); `_updateNextCheck` lets the auto-update path skip cooldowns; manual checks (popup "Check for Update") bypass the cooldown. 304 now also clears backoff state to recover from stale cooldowns. 4 unit tests pin the `_nextRetryAt` math.

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

### 7.5 Beautify Cursor Preservation ✅ Shipped in v3.6.3
- After beautify, find the equivalent position in the new code by character offset mapping
- Or: use Monaco's built-in format document action which preserves cursor natively

**Status (v3.6.3, 2026-05-02):** Cursor + vertical scroll position preserved after beautify. Implementation uses character-offset-from-content mapping: since the beautifier only changes leading whitespace, the same logical line exists before/after, so `newCh = newLeadingWS + max(0, oldCh - oldLeadingWS)`. Cursors that sat inside the indent region snap to the start of the new line's content. Falls back to old top-of-file behaviour only when the editor adapter doesn't expose `getCursor()`.

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

**Status (v3.2.0, 2026-05-02):** `GM_info.isIncognito`, `GM_info.platform.{os,arch,browserName,browserVersion,fullVersionList,mobile}`, `GM_info.userAgent`, and `GM_info.userAgentData` (cloned brands/platform/mobile) all populated. browserName/browserVersion now prefer `navigator.userAgentData.brands` with the legacy UA-string regex as fallback. `GM_info.script.options` deferred — needs the merge-mode UI from 11.3 to have anything meaningful to expose.

### 11.2 `@unwrap` Metadata Tag

Violentmonkey supports `// @unwrap` to disable the auto-injected IIFE wrapper. This allows:

- ESM-style top-level `export`/`import` if the page's CSP permits
- Scripts that intentionally modify the top-level scope
- Easier porting of scripts from other contexts

Add `@unwrap` to the metadata parser; when present, emit the script code as-is rather than wrapping in `(function() { ... })()`. Log a console warning noting that `@grant` APIs are unavailable without the wrapper. Source: [VM metadata block docs](https://violentmonkey.github.io/api/metadata-block/).

**Status (v3.2.1, 2026-05-02):** Shipped. Parser already accepted `@unwrap`; wrapper-builder (`background.core.js` + TS mirror at `src/background/wrapper-builder.ts`) now skips the GM API IIFE when `meta.unwrap === true` and prepends a `console.warn` banner so the choice is visible at runtime. Install confirmation dialog surfaces `unwrapped (no GM_* APIs)` in the run-timing summary so users see it before they confirm.

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

**Status (v3.4.0, 2026-05-02):** Popup-side Run on This Tab shipped. Background `runScriptNow` handler prefers `chrome.userScripts.execute()` (USER_SCRIPT world, GM_* APIs intact) with a `chrome.scripting.executeScript({world:'MAIN'})` fallback for Chrome <135. `@require` libraries are resolved via `fetchRequireScript` so the one-shot run sees the same library set as a normal registration. Dashboard-side Run Now button still pending (the popup affordance covers the most common quick-test workflow).

### 11.5 GM_xmlhttpRequest Completeness

Two missing options discovered from competitor changelogs:

- **`noCache: true`** — add a `Cache-Control: no-cache` / `Pragma: no-cache` request header (or append a cache-buster query param for HTTP/1.0 compatibility). Maps to Violentmonkey issue [#2168](https://github.com/violentmonkey/violentmonkey/issues/2168).
- **`redirect: 'follow' | 'error' | 'manual'`** — expose the `RequestInit.redirect` option so scripts can detect or block redirects. Maps to Violentmonkey issue [#2359](https://github.com/violentmonkey/violentmonkey/issues/2359).

Both changes are localized to `modules/xhr.js` (later `src/modules/xhr.ts`). Low risk.

Additional completeness items for `GM_xmlhttpRequest`:

- **`responseType: 'stream'`** — ScriptCat exposes a streaming response type for chunked/SSE responses. Implementation via `fetch()` with a `ReadableStream` callback forwarded through the SW message channel. Source: [ScriptCat API docs](https://docs.scriptcat.org/docs/dev/api/).
- **`nocache` alias** — Tampermonkey uses `nocache` (not `noCache`); accept both casings in the parser.

**Status (v3.2.0, 2026-05-02):** `noCache` (with `nocache` alias), `redirect: 'follow'|'error'|'manual'`, and `responseType: 'stream'` all live. `XhrManager.buildFetchOptions(data)` (in `modules/xhr.js` + TS mirror) centralises the option translation and is unit-tested (9 cases — case-insensitive Cache-Control/Pragma override behavior, valid/invalid redirect values, anonymous credentials, default method).

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

**Status (rolling):**
- `@inject-into`, `@connect`, `@tag`, `@antifeature`, `@compatible`, `@incompatible`, `@top-level-await` — all parsed in `background.core.js`. `@antifeature` warning banner already lives in the install dialog.
- `@run-at document-body` — recognized by the parser; currently maps to `document_end` for `chrome.userScripts.register()` since Chrome lacks a native body-only injection point. A MutationObserver shim that fires when `<body>` appears is still the right behavior; deferred.
- **`@weight 1..999` shipped in v3.5.0 (2026-05-02).** Parser clamps to documented range; `registerAllScripts` sort uses `Math.max(priority, weight)`; `GM_info.script.weight` + `GM_info.script.priority` exposed. TS mirrors in `src/types/script.ts` + `src/background/parser.ts` matched. 5 parser tests cover valid/clamp-above/clamp-below/default/non-numeric.

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

**Status (v3.3.0, 2026-05-02):** Shipped. `progress` (0..100) and `buttons[]` (capped at 2 per Chrome) are accepted by `GM_notification`. New top-level `GM_updateNotification(id, details)` and `GM_closeNotification(id)` functions exposed on `window`. `GM_notification(...)` now also returns a control object `{ close(), update(patch) }` so authors don't have to keep tags around manually. `chrome.notifications.onButtonClicked` routes the index back to the originating tab; the wrapper fires `onbuttonclick({ buttonClickIndex })`. `content.js` bridge forwards `buttonIndex`; linter `KNOWN_GM_APIS` learned the new function names.

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

**Status (v3.7.0, 2026-05-02):** Mostly shipped. `applyUpdate` no longer fires a per-script OS notification — `autoUpdate` aggregates cycle results into a single summary notification ("3 scripts updated: A v1.0 → v1.1, B v2.0 → v2.1, ..."), still gated by `notifyOnUpdate`. New `UpdateSystem._recentUpdates` ring buffer + `getRecentUpdates`/`clearRecentUpdates` background handlers feed a dismissible dashboard banner that lists scripts auto-updated since the last visit. Yellow-badge indicator for "updates available" still pending — can land alongside Phase 6.2 (staged updates) when those land.

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

## Phase 15 — Editor & Developer Experience

**Goal:** Close the gap between ScriptVault's built-in editor and a full development environment. Bring first-class TypeScript authoring, live grant detection, version history, and diffing into the editor itself.

### 15.1 GM_* IntelliSense via `@types/tampermonkey`
- After Phase 13.4 (Monaco 0.55.x), call `monaco.typescript.typescriptDefaults.addExtraLib(src, 'ts:tm.d.ts')`
- Bundle `@types/tampermonkey` (45KB) at build time; inject on editor initialization
- Also inject `@types/greasemonkey` for GM4 Promise-style APIs
- After injection: full autocomplete, parameter hints, type errors for all 35+ GM_* functions
- Source: `github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/tampermonkey/index.d.ts` [source 47]

### 15.2 Auto-Grant Inference (Live AST)
- As the user types in the Monaco editor, run a Web Worker Acorn parse on the current document text
- Walk `Identifier` and `MemberExpression` nodes matching against a list of 28+ `grantNames` (pattern from `vite-plugin-monkey/src/node/utils/grant.ts`) [source 49]
- Display a non-intrusive suggestion bar: "Detected: GM_xmlhttpRequest, GM_setValue — add to @grant?" with one-click accept
- Diff the detected set against existing `@grant` lines and only suggest additions
- ScriptVault has Acorn already in `background.js`; the Web Worker path reuses it without shipping a second copy
- vite-plugin-monkey does this at build time; ScriptVault is the first manager to do it live in the editor [source 50]

### 15.3 Script Version History & Rollback
- On every save (Ctrl+S or auto-save), compute a `diff-match-patch` delta from the previous version and store as `{scriptId, timestamp, @version, type:'patch', data:patchText, source:'manual_edit'}` in IndexedDB `script_versions` store [source 72]
- Store a full copy as the anchor for each 10-version window; all others are deltas (typical bug-fix patch ≈ 200–500 bytes vs. 8KB full copy → ~95% space saving)
- UI: "History" tab per script showing version timeline (timestamp, @version, delta size)
- One-click rollback to any snapshot; exports any historical version as `.user.js`
- Retention policy: last 20 versions or 90 days (configurable in settings)
- Requires Phase 2 (IndexedDB) for the `script_versions` store
- No manager has this; VM #1391 (data loss with no recovery) illustrates the gap [source 60]

### 15.4 Diff View on Update
- Before applying an @updateURL pull, open a `monaco.editor.createDiffEditor()` side-by-side view showing current vs. incoming script body
- "Update" button stays disabled until the user reviews the diff; "Update" and "Skip" are the only actions
- On apply, snapshot current version (source: `'update_check'`) into script_versions before overwriting
- Addresses VM's #1 most-reacted enhancement request (VM #500, 80+ upvotes) [source 73]
- Also addresses VM #1023: decouples "check for update" from "auto-install" [source 74]
- Scripts with local edits (body differs from installed @version hash) get an additional warning: "Your local edits will be overwritten"

### 15.5 Script Templates & Scaffolding
- Add 6 built-in templates to the New Script dialog: Basic, DOM Manipulation, AJAX Interceptor, CSS Injection, MutationObserver SPA, TypeScript Starter
- Template variables: `$DATETIME$`, `$URL_PATTERN$`, `$SCRIPT_NAME$`, `$VERSION$`
- ScriptFlow (the reference open-source userscript IDE) has 5 templates; this matches and adds MutationObserver/TypeScript variants [source 51]
- TamperMonkey supports `$DATETIME$` in new-script templates [source 52]; ScriptVault extends the pattern

### 15.6 In-Browser TypeScript Transpilation (esbuild-wasm)
- Add `esbuild-wasm` to devDependencies; bundle the 3.2MB `.wasm` file into `lib/esbuild/`
- Manifest CSP update: add `'wasm-unsafe-eval'` to `content_security_policy.extension_pages` (Chrome 112+ required, already above minimum_chrome_version 120) [source 48]
- Worker initialization: `await esbuild.initialize({ wasmURL: './lib/esbuild/esbuild.wasm' })`
- Compile-on-save: transform TypeScript → JavaScript before injecting; store both source (for editing) and compiled output (for injection) in IndexedDB
- Editor indicator: "TypeScript mode" badge in the editor footer when @userscript header lacks `// @nocompile`
- No other userscript manager or open-source userscript IDE implements in-browser TypeScript transpilation [source 48]

### 15.7 Live Reload (Re-Inject to Active Tab)
- Add a "▶ Run in Active Tab" button to the editor toolbar
- On click: call `chrome.scripting.executeScript({ target: { tabId }, func: injectScript, world: 'MAIN' })` to re-execute the current editor content in the active tab
- Display a toast: "Re-injected to Tab #N — (tab title)"
- Caveat: `executeScript` cannot undo previous execution effects (DOM mutations persist); warn user on first use
- Uses `chrome.userScripts.execute()` (Chrome 135+) for scripts requiring USER_SCRIPT world [source 13]
- vite-plugin-monkey provides HMR via an external dev server (requires Vite running locally); ScriptVault provides it natively within the extension [source 50]

### 15.8 Dry-Run Sandbox
- Add "Sandbox" mode: open a sandboxed `<iframe sandbox="allow-scripts allow-same-origin">` in the editor panel
- Inject a GM_* mock layer into the iframe that intercepts all GM_* calls, logs them to the console panel with arguments, and optionally simulates return values
- Mock coverage: GM_setValue/getValue/listValues (in-memory Map), GM_xmlhttpRequest (returns configurable mock response), GM_notification (logs), GM_addStyle (injects into iframe)
- Run the script against the sandbox by clicking "▶ Sandbox"
- ScriptFlow implements a DOM-only PiP preview; ScriptVault's sandbox adds GM_* interception — no manager has this [source 51]

**Exit criteria:** GM_* types appear in Monaco autocomplete; auto-grant inference detects all 28 grantNames from vite-plugin-monkey's list; version history stores and retrieves diffs; diff view renders before every @updateURL update is applied; 6 templates exist in new-script dialog; esbuild-wasm compiles TypeScript on save; live reload injects to active tab; sandbox intercepts GM_setValue calls.

---

## Phase 16 — Advanced XHR & Network Modernization

**Goal:** Close the XHR API gap vs. TamperMonkey and leapfrog VM. Add Promise-based `GM_fetch`, AbortController support, proper streaming, CHIPS/cookie partition parity, and OpenUserJS as a second script source.

### 16.1 `GM_fetch` (Promise-Based Fetch API)
- Implement `GM_fetch(url, init?)` as a new GM function returning `Promise<Response>`
- Background SW uses `fetch()` with the extension's host permissions to bypass CORS; passes cookies and headers as specified in `init`
- Response is serialized over `chrome.runtime.connect` to the content-world caller; `response.body` is a `ReadableStream` piped through the port
- FireMonkey (Firefox) is the only existing manager with a `GM_fetch` implementation; TM/VM don't have it [source 55]; TM #1050 was proposed and closed without implementation [source 56]
- Add `GM_fetch` to `@types/tampermonkey`-aligned type definitions: `GM_fetch(url: string | URL, init?: RequestInit): Promise<Response>`

### 16.2 AbortController Signal Support in `GM_xmlhttpRequest`
- Accept `signal?: AbortSignal` as a new field in the `GM_xmlhttpRequest` request object
- Bridge: `signal.addEventListener('abort', () => nativeReq.abort())`; propagate `signal.reason` to the `onabort` callback as the abort reason
- No manager (TM, VM, ScriptCat) supports this; all use a separate `.abort()` control object [source 58]
- Enables cancellation sharing: one AbortController can cancel multiple GM requests + native fetch calls simultaneously

### 16.3 Proper XHR Streaming (ReadableStream without Caveats)
- TamperMonkey's `responseType: 'stream'` forces `fetch: true` mode, sacrificing `abort`, `timeout`, and `onprogress` [source 59]; ScriptCat's stream support is "rudimentary" by their own docs [source 1]
- ScriptVault implementation: use `fetch()` with `response.body.getReader()` in the SW background; pipe chunks through a `chrome.runtime.connect` long-lived port to the content world; emit synthetic `onprogress` events from chunk sizes
- Preserves abort (signal the port close), timeout (alarm in SW), and progress simultaneously
- Leapfrog over all current implementations [source 59]

### 16.4 CHIPS / Cookie Partition Support
- Add `cookiePartition?: { topLevelSite?: string }` to the `GM_xmlhttpRequest` request type, matching `@types/tampermonkey:83-86` [source 47]
- Background SW passes `cookiePartition` as the `partitionKey` in the `chrome.cookies.get*` calls used by the GM_cookie implementation (Phase 11.6)
- Fixes the active user pain point documented in VM #2100: Cloudflare-protected sites set partitioned cookies; without partition key forwarding, XHR from the SW context uses the wrong partition and gets 403 errors [source 63]
- TamperMonkey has `cookiePartition` in types; VM does not — this is parity with TM and leapfrog over VM

### 16.5 XHR Redirect Mode
- Add `redirect?: 'follow' | 'error' | 'manual'` to `GM_xmlhttpRequest` request, matching `@types/tampermonkey:79`
- `'manual'` mode: return the 3xx response before following; expose `Location` header to the script
- VM issue #2359 (redirect control) has been open since 2023 — TM already has this [source 27]
- Low-effort addition: pass `redirect` directly to the `fetch()` call in the SW background handler

### 16.6 `GM_download` Improvements
- Accept `url: string | Blob | File` (not just string) — matches TM v5.4.6226+ behavior; enables in-memory downloads (canvas export, constructed data) [source 58]
- Add `conflictAction: 'uniquify' | 'overwrite' | 'prompt'` parameter for download naming conflicts
- Stretch: chunked `Range: bytes=X-Y` resume support — issue background `Range` requests; reassemble in SW; resume interrupted downloads. No manager has this [source 58]

### 16.7 OpenUserJS in Script Browser
- Add OpenUserJS as a second source tab alongside GreasyFork in the Phase 12.16 script browser
- Install URL format `https://openuserjs.org/install/{user}/{name}.user.js` — the `.user.js` interception already handles installs; no new code needed for the install flow [source 67]
- Search: OUJS has no documented JSON API; implement as an HTML scrape of `/scripts?q={query}` or a static "browse top scripts" list if search isn't feasible
- Show source badge in script details: "GreasyFork" | "OpenUserJS" | "Direct URL"

**Exit criteria:** `GM_fetch` resolves with a real `Response` object; `signal` aborts both a native fetch and a GM_xmlhttpRequest in the same chain; streaming response emits `onprogress` and can be aborted; `cookiePartition` is passed to the background fetch; `redirect: 'manual'` returns the 3xx response; `GM_download` accepts a `Blob` url; OpenUserJS scripts appear in the browser and install on click.

---

## Phase 17 — Security & Integrity Round 2

**Goal:** Harden the injection pipeline and audit trail. Close the script body integrity gap, decouple update-check from auto-install, and guard against external message injection.

### 17.1 Script Body Integrity Hash at Injection Time
- On every save, compute `await crypto.subtle.digest('SHA-256', encoder.encode(scriptBody))` and store the hex hash in `chrome.storage.session` (cleared on browser restart, inaccessible to content scripts)
- At injection time (before `userScripts.register()` / `userScripts.execute()`), recompute the hash of the stored body and compare
- If mismatch → abort injection, show a dashboard alert: "Script '{name}' body has changed unexpectedly — possible tampering detected"
- Threat model: another extension with `storage` access mutates `chrome.storage.local`; a compromised SW writes bad content before injection [source 69]
- Phase 11.8 covers `@require` SRI; this closes the remaining gap on the script body itself

### 17.2 Tamper-Evident Audit Log
- Maintain a rotating log in `chrome.storage.local`: `{scriptId, scriptName, timestamp, changeHash, changeType: 'install'|'update'|'edit'|'delete'|'enable'|'disable'}`
- `changeHash`: SHA-256 of (scriptId + timestamp + changeType + scriptBodyHash) — makes the log entry tamper-detectable
- Cap at 100 events (FIFO); display in a "Audit Log" or "History" tab in the dashboard
- No competitor (TM, VM, ScriptCat) offers a tamper-evident audit trail [source 70]

### 17.3 Update Consent Decoupling
- "Check for updates" (query `@updateURL`) must never silently install the new version
- Current flow: check → if newer version available → auto-install
- New flow: check → store pending update → badge the script row "⬆ Update available" → user clicks → diff view (Phase 15.4) → user confirms → install
- Exception: if user has explicitly set auto-update AND script body is unmodified since last install → auto-install is permitted (matches TM's "no local edits" guard)
- VM #1023 documents this as the #2 most-painful VM behavior (check triggers install, destroying local edits) [source 74]

### 17.4 External Message Origin Validation
- Audit every `chrome.runtime.onMessage` and `chrome.runtime.onMessageExternal` handler in the SW
- Add an explicit `sender.id` allowlist check for any `onMessageExternal` handler; reject messages from unknown extension IDs
- If `externally_connectable` is added to manifest (Phase 12.14 vscode.dev), the allowlist must enumerate `Tampermonkey/tampermonkey-editors`'s extension ID
- Threat: a malicious extension can call `chrome.runtime.sendMessage(ScriptVaultExtensionID, { action: 'installScript', ... })` if the message handler doesn't validate origin [source 71]

### 17.5 chrome:// URL @match Warning
- When a script's `@match` or `@include` contains `chrome://`, `chrome-extension://`, or `edge://` patterns, show an inline editor warning: "chrome:// URLs cannot be matched by userscripts — this pattern will never execute"
- These URLs are blocked by the Chrome APIs regardless of declared permissions; the error is silent and confusing for users
- Addresses top Stack Overflow pain point: "Script not executing on chrome:// pages" (5K views, Oct 2025) [source 75]

### 17.6 `@require-css` Metadata Directive
- Parse `@require-css` lines in the metadata block (ScriptCat innovation) [source 4]
- Fetch and cache the CSS resource at install time (same pipeline as `@require`)
- At injection time, inject a `<style>` into `document.documentElement` before any script runs (FOUC-safe)
- Cleaner than runtime `GM_addStyle` calls for static CSS assets; eliminates a common `@require` + `GM_addStyle` pattern
- `@require-css` resources are subject to the same SRI verification as `@require` (Phase 11.8)

### 17.7 `GM_addStyle` Handle-Based API
- `GM_addStyle(css)` currently returns `HTMLStyleElement` — add new optional second parameter: `GM_addStyle(css, { target?: Element | ShadowRoot })` for ShadowRoot injection
- Return a handle object: `{ element: HTMLStyleElement, remove(): void, replace(newCss: string): void }`
- `remove()`: cleanly removes the injected `<style>` element
- `replace()`: atomically swaps CSS content without DOM flicker
- TM marked GM_removeStyle/replace as "not planned" (TM #2671 closed) — leapfrog opportunity [source 80]
- ShadowRoot injection enables styling Web Components without `::part()` access hacks; no manager currently supports this [source 80]
- FOUC fix: if `@run-at document-start`, inject into `document.documentElement` directly; move to `<head>` via `MutationObserver` once it exists

**Exit criteria:** Injection is aborted when script body hash mismatches stored reference; audit log entries appear in dashboard after install/update/edit/delete; update check never auto-installs without user confirmation; no `onMessageExternal` handler accepts messages from unlisted extension IDs; chrome:// @match patterns show inline warning in editor; @require-css CSS is injected before script runs; GM_addStyle handle's `.remove()` cleanly removes the style element; ShadowRoot injection works on a test page with a Web Component.

---

## Phase 18 — Performance & Storage Modernization

**Goal:** Reduce SW cold-start time, replace heavyweight dependencies where native APIs suffice, handle large script libraries gracefully, and expose new platform capabilities to userscripts.

### 18.1 ES Module Splitting for SW Cold-Start
- Change manifest: `"background": { "service_worker": "background.js", "type": "module" }`
- Restructure esbuild config to emit multiple chunks via `--splitting` flag; entry point stays `background.js` but imports are dynamically loaded
- Lazy initialization pattern: SW entry point wires only event listeners; heavy subsystems (GM API shim, sync engine, storage engine) are `import()`-ed inside their first event handler
- Practical split: `core.js` (event routing, ~2K lines) + `gm-api.js` (GM_* implementations, ~4K lines) + `sync.js` (sync providers, ~2K lines) + `dashboard-bridge.js` (dashboard message handlers)
- SW cold-start time target: <300ms for 80% of users (from ~1200ms baseline with 16K-line monolith) [source 76]
- Requires: Phase 1 TypeScript migration complete so the module graph is clean

### 18.2 OPFS for Large Script Storage
- `navigator.storage.getDirectory()` works from the extension's origin in MV3 [source 77]
- For scripts > 50KB (large userscripts, TypeScript source from Phase 15.6), store the content in OPFS as a `FileSystemFileHandle`; store only the UUID path reference in IndexedDB
- Use `FileSystemSyncAccessHandle` in an offscreen document worker for zero-copy synchronous reads at injection time
- Caveat: OPFS is cleared on "clear all browsing data"; always maintain IndexedDB as the canonical record
- Requires Phase 2 (IndexedDB) as the metadata layer; OPFS supplements it for large payloads [source 77]

### 18.3 `scheduler.postTask` for Background Tasks
- Replace bare `setTimeout(fn, 0)` patterns in the SW with `scheduler.postTask(fn, { priority: 'background' })` (Chrome 94+)
- Apply to: hash verification (Phase 17.1), backup compression, sync polling, @require cache refreshes
- Replace busy loops / Promise-chaining with `await scheduler.yield()` (Chrome 124+) in multi-step SW operations to prevent starving the event loop [source 78]
- Zero API surface change; purely internal optimization

### 18.4 CompressionStream for Backup Export
- Replace the fflate-based export path with native `CompressionStream('gzip')` for streaming backup generation (Chrome 80+, no dependency needed) [source 79]
- Keep fflate in the codebase for: synchronous compression cases, zstd/brotli format support, and any non-streaming paths
- Reduces the fflate dependency footprint in the streaming export path; exports start streaming bytes immediately instead of buffering the full backup in memory

### 18.5 Virtual Scrolling for Script Lists
- At script count ≥ 100, activate virtual scrolling in the sidePanel and dashboard script list
- Use `@tanstack/virtual-core` (3KB minified, zero framework dependencies) for variable-height row virtualization [source 79]
- Below 100 scripts: current flat render is fine; add a threshold check on list render
- Ensures smooth scrolling for power users with 200+ scripts

### 18.6 SharedWorker extendedLifetime (Chrome 148)
- Chrome 148 ships `SharedWorker` with `extendedLifetime: true` — the worker survives after all connected tabs close [source 26]
- Move long-running backup generation and sync operations into a `SharedWorker` with `extendedLifetime: true`; this eliminates the need for chrome.alarms heartbeats in those specific flows
- SW still handles all Chrome API calls (SharedWorker cannot call `chrome.*` APIs directly); bridge: SW spawns worker, worker does heavy computation, posts result back to SW
- Version guard: check `typeof SharedWorker !== 'undefined'` and check worker feature detection before using; fall back to alarm-based approach on earlier Chrome versions

### 18.7 Sanitizer API: GM_setHTML + Extension UI
- Chrome 146 ships `Element.setHTML(html, { sanitizer: new Sanitizer(...) })` as the native XSS-safe innerHTML [source 29]
- Add `GM_setHTML(element, html, sanitizerConfig?)` as a new GM function: wraps `element.setHTML()` so scripts can safely inject HTML without constructing a `DOMParser + manual sanitization` chain
- In extension UI code (dashboard, popup, settings): replace `element.innerHTML = str` patterns with `element.setHTML(str)` or `Document.parseHTML(str)` — eliminates the DOMPurify dependency from extension UI code paths where Chrome 146+ is guaranteed
- For compatibility with Chrome 120–145: keep DOMPurify as a fallback; feature-detect with `typeof Element.prototype.setHTML !== 'undefined'`

### 18.8 `navigator.storage.persist()` Before IndexedDB Open
- Greasemonkey 4.x is the only manager that calls `await navigator.storage.persist()` before opening its IndexedDB database [source 68]; no other manager does this
- Chrome can evict `chrome.storage.local` and IndexedDB data under storage pressure if `persist()` hasn't been called
- Add `await navigator.storage.persist()` to the Phase 2 IndexedDB initialization sequence; log the result (`true` = granted, `false` = denied due to storage policy)
- Show a one-time warning in the dashboard if `persist()` returns `false`: "Storage persistence not granted — scripts may be lost if browser storage is cleared under pressure"

### 18.9 Broken Script Detector
- Track last-matched timestamp per script: on each `userScripts` injection success, update `{scriptId: lastMatchedAt}` in `chrome.storage.session`
- At dashboard open, surface scripts where `lastMatchedAt` is null (never ran) or `> 30 days ago` with a yellow ⚠ badge
- "Script hasn't matched any page in 30+ days — check your @match patterns" — with a direct link to the URL Patterns editor
- Addresses Stack Overflow pattern: "scripts breaking after browser updates" is frequently caused by stale `@match` patterns that nobody notices [source 75]
- Auto-suppressed for intentionally domain-specific scripts (user can dismiss the warning per-script)

### 18.10 `@require-nocache` Development Directive
- Add `@require-nocache` as a metadata directive that bypasses the `@require` resource cache for named URLs
- During development, scripts often reference `@require` URLs pointing to localhost or a staging server; the cache means changes don't appear until the cache expires
- Pattern: `// @require-nocache  http://localhost:3000/myscript.js` — fetches fresh on every page load
- TM #723 documents this as an active developer pain point [source 76]
- Implementation: skip the IndexedDB resource cache for URLs listed in `@require-nocache`; always fetch

**Exit criteria:** SW cold-start measured with `performance.now()` before and after module splitting; OPFS handles scripts > 50KB without IndexedDB size errors; `scheduler.postTask` replaces all `setTimeout(fn, 0)` in SW; backup export streams bytes without OOM on a library with 200 scripts; virtual scrolling activates at 100 scripts; SharedWorker backup runs on Chrome 148 without SW alarms; `GM_setHTML` injects sanitized HTML; dashboard shows "storage not persistent" warning when `navigator.storage.persist()` returns false; broken script badge appears for scripts with 30+ day gap in @match hits; `@require-nocache` bypasses cache.

---

## Phase 19 — Multi-Store Distribution & CWS Compliance

**Goal:** Expand ScriptVault beyond Chrome Web Store to Edge Add-ons, Firefox AMO, and self-hosted update channels.

### 19.1 Edge Add-ons Store Listing
- Microsoft Edge Add-ons has a different submission/review process than CWS
- Manifest v3 support confirmed; no manifest changes required beyond CWS
- Create `edge-addon-submission.md` documenting store-specific screenshots, category tags (Developer Tools), and testing on Edge Canary
- Zero code changes; purely store operations [source 97]

### 19.2 Firefox AMO Listing (MV2 Compatibility Note)
- Firefox uses MV2 extension model; a ScriptVault Firefox port would require complete architectural changes (service worker → background page, `browser.runtime` vs `chrome.runtime`)
- Document this explicitly in `FIREFOX-PORT.md` — do not include in the MV3 roadmap
- Note: Violentmonkey and Tampermonkey have separate FF codebases, not shared source

### 19.3 Self-Hosted CRX Update Server
- Create an optional update manifest server for users who want to host ScriptVault CRX artifacts themselves
- Implement `autoupdate.xml` generator: reads released CRX file, computes SHA256 hash, outputs XML with `<updatecheck>` tags [source 98]
- Example: `GET https://example.com/scriptvault/updates.xml` returns Chrome's autoupdate XML format
- Documentation: how to set `update_url` in manifest for self-hosted updates

### 19.4 TM/VM ZIP Import Round-Trip Compatibility
- Tampermonkey backup JSON structure: per-script `uuid`, `config`, `script` (code), `meta` (headers)
- Violentmonkey ZIP structure: `scripts/` folder with one `.user.js` per script, `_meta.json` for metadata
- Implement bidirectional conversion: ScriptVault ZIP can import from both TM backup JSON and VM ZIP
- Round-trip: export as both TM-compatible JSON and VM-compatible ZIP in the Settings export options [source 99]

### 19.5 Developer Tooling Ecosystem Documentation
- Create `DEVELOPER_GUIDE.md`: patterns for bundling userscripts with esbuild/Vite + ScriptVault metadata
- Document how to use `@types/tampermonkey` for full IDE IntelliSense (Phase 15.1)
- Link to `vite-plugin-monkey` and alternatives
- No new code; curate best practices and link to existing tools

### 19.6 CWS Policy Compliance & Remote Code Execution Exception
- ScriptVault, like TM and VM, falls under the "trusted remote code execution" exception in CWS policies [source 100]
- Document the policy exception in `COMPLIANCE.md` to clarify that executing arbitrary user-provided scripts is intentional and allowed
- Prepare for CWS audit response: cite policy exception and document user consent model

**Exit criteria:** Edge Add-ons submission created and approved (if possible in test env); `autoupdate.xml` generator works for self-hosted CRX; bidirectional TM/VM import tested; `DEVELOPER_GUIDE.md` published with tooling patterns; CWS compliance memo drafted.

---

## Phase 20 — Script Execution Observability & Debugging

**Goal:** Help users and developers debug failing or slow userscripts with local, privacy-safe tools.

### 20.1 Per-Script Execution Time Logging
- Wrap `GM_xmlhttpRequest` and `GM_fetch` with `performance.mark()` / `performance.measure()` to track network latency per script
- Store timing data in IndexedDB under `script_stats` table (extends Phase 2 schema)
- Dashboard: "Performance" tab shows per-script median execution time, outliers flagged [source 101]

### 20.2 Source Map Support for Error Stack Traces
- When ScriptVault injects a userscript, append a `//# sourceMappingURL=data:...` comment with an inline source map if available
- For scripts with `@require`, embed source maps for dependencies in the injection bundle
- Error stack traces in console will then point to original source files, not injected code [source 102]
- Requires Phase 15.6 (esbuild-wasm TS transpilation) to generate source maps in editor

### 20.3 Per-Script Console Interception
- Intercept `console.log` / `console.warn` / `console.error` at injection time: `window.__scriptVaultConsole__ = { script: <id>, logs: [...] }`
- Extension background collects logs and stores in IndexedDB `script_logs` table (time-series, auto-cleanup after 30 days)
- Dashboard: "Console" tab filters by script, shows timestamp + level + message [source 103]

### 20.4 Script Error Categorization
- Distinguish between: script syntax errors (parse-time), runtime errors (`window.onerror`), promise rejections (`unhandledrejection`), and timeout/timeout errors
- Tag errors with context: `@match` URL, execution order relative to page load, document.readyState
- Dashboard: "Errors" tab shows histogram of errors per script, latest 100 errors with stack traces [source 104]

### 20.5 Network Request Tracing (Privacy-Safe)
- Log per-script outbound requests using `GM_fetch`/`GM_xmlhttpRequest` interception
- Store: method, URL (truncated at query string), status code, latency, initiating script ID
- Do NOT log response bodies or request headers (privacy)
- Dashboard: "Network" tab shows request waterfall per script [source 105]

### 20.6 Permission Denial Logging
- When a script tries to use a GM API it doesn't have in its @grant list, log the denial + stack trace
- Example: script calls `GM_setValue` without `@grant GM_setValue`
- Dashboard: "Permissions" tab shows permission denials, suggests @grant additions

**Exit criteria:** Execution time data logged for 5+ script operations; source maps render in DevTools; per-script console appears in dashboard with filters; error categorization tested; network tracing logs 10+ request types; permission denials logged and suggested as @grant additions.

---

## Phase 21 — Extended Sync Backends & Privacy Hardening

**Goal:** Support additional cloud backends beyond Dropbox/GDrive/OneDrive and improve privacy of synchronized data.

### 21.1 GitHub Gist Sync (Two-Way)
- GitHub Gist as a sync backend for users with a GitHub PAT
- One Gist per library: plaintext JSON with script metadata (not code bodies due to Gist size limits)
- For code bodies: optional S3-compatible backend (see 21.2) or local-only with manual export
- Gist API: create/update gist via `PUT /gists/<id>` with `{files: {"scripts.json": {content: "..."}}}` [source 106]
- Revision history: read Gist revision list to show sync history in Settings

### 21.2 S3-Compatible Sync (Cloudflare R2, Backblaze B2, MinIO)
- S3 API support via presigned URLs (avoid embedding credentials in extension)
- Server-side signing: extension sends request to `https://example.com/s3-presign?bucket=...&key=...` → receives presigned URL → extension uploads directly to S3 [source 107]
- For script bodies + large backups: S3 is ideal (no size limits, cheap, supports streaming uploads)
- Authentication: users provide bucket name + presigned-URL endpoint, no AWS credentials in extension memory

### 21.3 Nextcloud / Self-Hosted WebDAV + CalDAV Fallback
- Extend existing WebDAV (Phase 8) to detect Nextcloud and offer native Nextcloud Files API as option
- CalDAV as a fallback sync transport: Nextcloud Contacts can be used to store versioned backup metadata
- Auto-discovery: when user enters Nextcloud URL, detect instance and offer sync options

### 21.4 Client-Side Encryption for Cloud Backup
- Optional password-protected backup using Web Crypto API: `AES-256-GCM` + `PBKDF2` key derivation
- User enters passphrase → `PBKDF2(passphrase, salt, 100000 iterations)` → derives encryption key
- Backup encrypts before upload; cloud stores opaque blob (cannot be indexed/searched by provider)
- UI in Settings: "Encrypt cloud backup with password", generate random salt, show salt QR for backup [source 108]

### 21.5 Privacy Hardening: Referrer Stripping in GM_xhr
- Add UI toggle: "Strip referrer from GM_xmlhttpRequest" — when enabled, adds `"Referer": ""` header to all script XHR
- Logs all referrer-stripped requests in the execution log for transparency
- Document that `@connect` enforcement (Phase 11.7) + referrer stripping + credential modes combine for privacy [source 109]

### 21.6 Incognito Mode Storage Isolation
- When running in incognito window: isolate GM_setValue storage per-window instance
- Do NOT persist incognito storage to persistent IndexedDB; use `chrome.storage.session` only (cleared on window close)
- UI: show "Incognito mode" badge in dashboard when opened in incognito context

**Exit criteria:** GitHub Gist sync connects with PAT and syncs metadata; S3 presigned-URL flow works end-to-end; WebDAV detects Nextcloud; password-protected backup encrypts/decrypts with PBKDF2; referrer-stripping toggle appears in Settings; incognito storage uses chrome.storage.session; no data persists after incognito window closes.

---

## Phase 22 — Community Standards & Long-Tail Features

**Goal:** Implement emerging community standards and address high-value edge cases.

### 22.1 GREASE Metadata Spec Alignment
- GREASE (Greaselike Extension Assembly Standard) is being standardized by the userscript community
- Ensure ScriptVault's @metadata header parsing aligns with GREASE; add missing directives if spec changes
- Current scopes: @namespace, @name, @version, @description, @author, @license, @homepageURL, @documentationURL, @updateURL, @downloadURL, @support URL, @icon, @iconURL, @defaultIcon, @run-at, @include, @exclude, @match, @require, @resource, @grant, @noframes, @inject-into, @connect
- Add future GREASE additions as Phase 22 sub-versions [source 110]

### 22.2 URLPattern API for @match Rewrite
- Chrome 95+: `new URLPattern(pattern)` provides a standard way to parse URL patterns
- If Greasemonkey @match syntax aligns with URLPattern, rewrite Phase 4's URL matcher to use URLPattern API
- Fallback: keep custom regex engine for non-URLPattern platforms (Firefox, older Chrome)
- Benefit: align with web standards; potential to share test cases with other browsers [source 111]

### 22.3 `@require-local` Directive (Script Dependencies)
- Allow `@require-local id:scriptId` to reference another installed script by ID as a dependency
- Extension will fetch the dependency script code at injection time and prepend it before the main script
- Enables script authors to build modular script libraries without external @require URLs
- Version mismatch warning: if required script is disabled or missing, show warning in dashboard [source 112]

### 22.4 `@sandbox` Content Security Policy Bypass Detection
- When a script tries to use `@sandbox` (ScriptCat extension), ScriptVault cannot honor it (no equivalent CSP bypass in Chrome MV3)
- Add a warning in the dashboard: "Script requested sandbox mode which isn't available; some content injection patterns may fail"
- Document limitation in README [source 113]

### 22.5 Import Maps Support for ESM Scripts
- Chrome 89+: pages can define import maps via `<script type="importmap">`
- If an injected script is compiled to ESM (Phase 15.6) and the page has import maps, the script can leverage them
- Behavior: do NOT override page import maps; inject into the page's module namespace
- Document best practices: when is it safe to use page import maps vs bundling everything [source 114]

### 22.6 File System Access API as Optional GM_* Bridge
- `showOpenFilePicker()` / `showSaveFilePicker()` require user gesture and work from content scripts
- Add optional `GM_openFile()` / `GM_saveFile()` APIs that wrap File System Access (Chrome 86+)
- Gate behind `@grant GM_openFile` + requires user gesture check before calling
- Use case: scripts that need to read/write local files (e.g., config persistence, local data export) [source 115]

### 22.7 Broken Script Detection & Proactive Maintenance
- Phase 18.9 (broken script detector) flags scripts idle 30+ days with errors
- Add "Maintenance Mode": dashboard suggests scripts to migrate/update, shows deprecation warnings from script authors
- Check `@supportURL` for issues/discussions about script maintenance status

### 22.8 Security Disclosure Support for Script Authors
- If a script is flagged for security issues (Phase 5/17 audit), add a UI element: "Report security issue"
- Guide users to email script author via @supportURL or @author email
- Optionally: integrate with GreasyFork security report mechanism (if available)

**Exit criteria:** GREASE metadata directives validated; URLPattern API tested on sample @match patterns; `@require-local` dependency injection works; @sandbox detection shows warning; ESM script execution works with page import maps; File System Access API gate behind @grant; broken script detection shows maintenance suggestions; security report flow documented.

---

## Phase 23 — Offline-First Architecture & Resilient Sync

**Goal:** Enable ScriptVault to function when offline and provide conflict-free sync when reconnecting.

### 23.1 Local-First Operation After Initial Setup
- Once a script has been synced once, cache it locally in IndexedDB with full code + metadata
- Service worker serves cached scripts even when offline; inject without fetching from cloud
- Display "offline mode" banner in dashboard; show last-sync timestamp
- Script updates are queued locally; apply on reconnection

### 23.2 Async Sync Queue & Reconnection Logic
- When network returns (SW detects `navigator.onLine`), drain the queue:
  1. Check for updates to each script (using @updateURL if present)
  2. Backup changed scripts to cloud
  3. Pull any remote changes since last sync
  4. Resolve conflicts using last-write-wins + tombstone deletion markers
- Use chrome.alarms to poll `navigator.onLine` every 30 seconds when offline [source 116]

### 23.3 Conflict-Free Sync with Tombstones & Vector Clocks
- Each script carries a vector clock: `{ device_id: timestamp }` tracking which device last modified it
- When syncing, if both local and remote have edits: merge metadata, keep the newer version
- Tombstones mark deleted scripts with `deleted: true, deleted_at: timestamp` — never physically remove, just mark
- UI: "Conflicting versions" button if local ≠ remote code on same @version; user chooses keep/discard [source 117]

### 23.4 OPFS-Based Offline Cache (Chrome 86+)
- Store script bodies in OPFS (Phase 18.2) for fast, zero-quota-driven reads
- IndexedDB holds metadata only; IDB reads are faster on reconnection than re-reading all bodies from OPFS
- Fallback to IDB if OPFS unavailable

### 23.5 Sync Resilience: Exponential Backoff & Error Recovery
- When cloud sync fails: retry with exponential backoff (1s, 2s, 4s, 8s, 30s max)
- If sync fails 3+ times: show "Sync failed, will retry on reconnection" + keep using local cache
- Error log: timestamp, reason (timeout, 403, network, etc.), next-retry time [source 118]

**Exit criteria:** Scripts load offline with cached code; reconnection syncs queued updates; tombstones prevent resurrection of deleted scripts; vector clocks resolve conflicts; offline banner shows; sync failure backoff tested to 3+ retries.

---

## Phase 24 — Script Discovery, Recommendation & Metrics

**Goal:** Help users discover scripts beyond GreasyFork and provide in-manager browsing + popularity signals.

### 24.1 In-Dashboard Script Browser (GreasyFork + OpenUserJS)
- Add "Discover" tab in dashboard: search + browse top scripts from GreasyFork and OpenUserJS
- Fetch top-50 scripts endpoint if available; fall back to scraping + caching results
- Display script name, author, install count (if exposed), last-updated date, short description
- One-click install flow: user selects script → ScriptVault adds to library [source 119]

### 24.2 Popularity Signals & Health Indicators
- Display per-script: last updated date, install count (from GreasyFork), rating, comment count
- Calculate health score: (recency + install_growth + rating) — flag old/abandoned scripts
- Show "⚠️ Abandoned" badge for scripts not updated in 180+ days [source 120]

### 24.3 Related Scripts Recommendations
- Build a graph of script metadata: scripts with same @match pattern, similar @name keywords
- Dashboard: "Related scripts" sidebar suggesting similar scripts by @match or category
- Example: user installs a Netflix enhancement script → recommend similar video-site scripts

### 24.4 Script Dependency Suggestions
- When a script uses @require URLs, check if those dependencies are available on GreasyFork/OpenUserJS
- Suggest one-click install for upstream dependencies if missing from user's library [source 121]

### 24.5 Custom Script Collections (User-Created)
- Allow users to create collections: group scripts by category (productivity, entertainment, social media, etc.)
- Share collection as JSON export; others can import via URL or upload
- Example: "Twitter Enhancement Bundle" (10 scripts) shareable via GitHub Gist [source 122]

### 24.6 Trending & Leaderboard Dashboard
- "Trending this week": scripts with most new installs (tracked locally, aggregate anonymous stats)
- "Most active" developers: authors with most updated/released scripts
- Optional: trending dashboard without personal user identification [source 123]

**Exit criteria:** "Discover" tab appears in dashboard; top 50 scripts render with health badges; "Related scripts" sidebar functional; collections can be created/shared; trending leaderboard shows in dashboard.

---

## Phase 25 — Enterprise Deployment & Performance Profiling

**Goal:** Enable organization-wide script distribution and provide deep performance insights for script authors.

### 25.1 Chrome Admin Console Integration (ExtensionSettings Policy)
- Generate policy JSON for domain admins to deploy ScriptVault via Chrome Admin Console
- Provide admin guide: setup ExtensionSettings policy + force-install ScriptVault to all users
- Include sample policy JSON with example allowed/blocked hosts, @match patterns [source 124]

### 25.2 Internal Script Repository (Admin-Controlled)
- Admins can configure ScriptVault to fetch scripts from internal server (not just GreasyFork)
- Endpoint: `https://internal.company.com/api/scripts` returns JSON list of scripts + metadata
- ScriptVault discovers, validates, and installs scripts from allowlist
- Enables organization to mandate scripts (security monitoring, corporate policy enforcement) [source 125]

### 25.3 Script Allowlist / Denylist (Admin Policies)
- Admin creates whitelist of permitted script IDs / @match patterns
- Denylist of forbidden scripts (e.g., productivity killers, gambling sites)
- ScriptVault validates at install time + runtime: warns if script violates policy, offers uninstall [source 126]

### 25.4 Audit Log Export (SOC2 / FedRAMP)
- Dashboard: "Audit" tab shows all script installations, executions, errors with timestamp + user context
- Export as CSV or JSON for SIEM ingestion
- Fields: script name, script ID, @match, action (install/enable/error), timestamp, error details [source 127]

### 25.5 Per-Script Performance Profiling
- Extend Phase 20 observability: measure DOM reflows, paint time, memory allocation per script
- Use `PerformanceObserver` to capture Long Tasks induced by scripts (Chrome 123+ LoAF API) [source 128]
- Dashboard: "Performance" tab ranks scripts by CPU/memory impact; flag high-impact scripts

### 25.6 Execution Timeline Visualization
- Interactive waterfall chart showing script load order, timing, and dependencies
- Highlight slow scripts, blocking operations, and resource conflicts
- Export as HTML report for script authors

**Exit criteria:** Admin policy JSON generated; internal script repository endpoint configured; allowlist/denylist enforced at runtime; audit log exports CSV; performance profiling captures LoAF Long Tasks; timeline visualization renders for 10+ scripts.

---

## Phase 26 — WebAssembly Support & Advanced Content Filtering

**Goal:** Enable scripts to use WASM for compute-intensive tasks and improve @match pattern matching.

### 26.1 @require-wasm Metadata Directive
- New directive: `@require-wasm https://example.com/lib.wasm`
- ScriptVault fetches .wasm file, instantiates via `WebAssembly.instantiate()`, exports to script global scope
- Script accesses via: `window.wasmLib.exportedFunc()` (auto-bound by injection engine) [source 129]

### 26.2 WASM CSP Compliance & Security
- Verify WASM file size < 10 MB (prevent bloat)
- Hash @require-wasm URLs using SRI (Phase 11.8 @require SRI extended)
- Sandbox WASM execution: errors in WASM do not crash host script
- Log WASM instantiation success/failure to execution log (Phase 20) [source 130]

### 26.3 URLPattern API Migration (Phase 22 extended)
- If @match syntax aligns with URLPattern API (Chrome 95+), rewrite URL matcher to use native API
- Benchmark: URLPattern vs custom regex on 1000+ patterns
- Performance win: likely 2–3x faster URL matching [source 131]

### 26.4 Advanced @match Boolean Logic
- Support: `@match (https://twitter.com/* OR https://x.com/*) AND NOT https://*/explore`
- Parser: tokenize @match into AST, evaluate at runtime
- UI: visual @match builder with AND/OR/NOT toggles (optional, Phase 24 script browser integration) [source 132]

### 26.5 Frame-Aware @match
- New option: `@run-in-frame main` / `@run-in-frame iframe` / `@run-in-frame all`
- Default: "main" (only main document, not nested iframes)
- Allows scripts to opt-in to running in iframes on the same domain [source 133]

### 26.6 @match Performance Regression Testing
- Benchmarking suite: test URL matching against 1000+ URLs to ensure no slowdown with advanced @match features
- CI/CD: every build measures URL matcher latency; fail if > 10% regression [source 134]

**Exit criteria:** @require-wasm directive works; WASM module instantiates and exports functions; URLPattern migration tested; advanced @match boolean logic parses and evaluates; frame-aware @run-in-frame flags are respected; benchmark suite passes with <10% regression.

---

## Phase 27 — Script Author Tooling Ecosystem

**Goal:** Provide developers with best-in-class build, testing, and linting tools for userscript development.

### 27.1 @scriptvault/eslint-plugin
- ESLint plugin with rules for:
  - Unused @grant declarations (warns on `GM_` API references without @grant)
  - Dangling @require URLs (fetch + validate all @require endpoints at lint time)
  - @match/@include complexity audit (flag regex performance issues)
  - Comment scanning for hardcoded secrets (API keys, passwords)
  - Deprecation warnings for old GM_* APIs (warn on Phase 11.6-11.11 deprecated APIs)
- CLI: `eslint --plugin=@scriptvault/eslint-plugin myScript.user.js` [source 135]

### 27.2 @scriptvault/test-runner (Playwright-based)
- Wrapper around Playwright: inject userscripts into page + run test cases
- Mock GM_* API calls (GM_setValue/getValue/fetch)
- JSDOM + custom @match simulation for headless testing
- Support for: snapshot tests, DOM mutation assertions, network mocking [source 136]

### 27.3 @scriptvault/doc-gen
- Generate markdown README from userscript metadata header
- Extract: @name, @description, @author, @supportURL, @resource, @license, version history
- Build configuration table from commented @option directives
- Auto-generate install links to GreasyFork/OpenUserJS/Sleazy Fork [source 137]

### 27.4 Enhanced vite-plugin-monkey Templates
- Partner with vite-plugin-monkey maintainer to ship ScriptVault-curated templates
- Pre-baked templates with:
  - Error boundary wrapper (Phase 20 error categorization)
  - Performance instrumentation (Phase 25 profiling)
  - Built-in logging to ScriptVault execution log
  - Security best practices (no eval, CSP compliance, @connect usage)

### 27.5 Script Header Validator & Generator UI
- Web-based tool (hosted on scriptvault.org or GitHub Pages): validate + generate script headers
- Input: name, description, @match patterns, @grant list → outputs formatted header
- Batch validation: upload ZIP of scripts, get compliance report [source 138]

### 27.6 Version Management & Changelog Auto-Generation
- CLI tool: scans git history, extracts commit messages, generates @version increment suggestions
- UI: dashboard integration to bump version + auto-generate changelog entries [source 139]

**Exit criteria:** ESLint plugin detects unused @grant in test script; Playwright test runner successfully mocks GM_setValue + runs assertions; doc-gen generates valid markdown from metadata; vite-plugin-monkey templates include error instrumentation; header validator passes 100+ test cases; version bump CLI generates changelog.

---

## Phase 28 — Community Security, Peer Review & Transparency

**Goal:** Build trust in the userscript ecosystem through security audits, peer review, and transparency.

### 28.1 Script Security Audit Framework
- ScriptVault performs static analysis on scripts:
  - Scan for eval/Function() usage (Phase 22 security detection extended)
  - Check for hardcoded credentials in comments/strings
  - Validate @require URLs against known malware domains
  - Flag dynamically generated @match patterns (code injection risk)
- Dashboard: "Security Score" badge per script (0–100) [source 140]

### 28.2 Community Peer Review System
- Users can flag scripts as reviewed; curators maintain a "peer-reviewed" list
- GitHub integration: ScriptVault publishes reviewed scripts to a GitHub repo (read-only)
- Maintenance: community votes on which scripts to audit (weighted by reputation) [source 141]

### 28.3 Script Malware Detection & Quarantine
- Monitor installed scripts for runtime suspicious behavior:
  - Sudden network spikes (exfiltration patterns)
  - Keylogging patterns (excessive keyboard event handlers)
  - Cryptomining (high CPU usage with no user interaction)
- Optional: quarantine suspicious scripts, alert user with evidence [source 142]

### 28.4 Vulnerability Database & CVE Tracking
- Maintain a CSV/JSON database of known-vulnerable script versions
- Link to GitHub issues / CVEs if available
- Dashboard alert: "Script XYZ v1.2.0 has known vulnerability #123, update available"
- Automated check: on each install/update, validate against vulnerability DB [source 143]

### 28.5 Transparency Report (Annual)
- Publish aggregate stats: "X scripts audited, Y security issues found and resolved, Z DMCA/takedown requests"
- Privacy: no user identification, only anonymized aggregates
- Format: PDF + GitHub public repo for community discussion [source 144]

### 28.6 Author Reputation & Trust Signals
- Track author history: number of scripts published, update frequency, community ratings
- Display "trusted author" badge for authors with 50+ installations + 4.5+ avg rating
- Support: show author response time to security reports + bug fixes [source 145]

**Exit criteria:** Static analyzer detects eval/Function() in test script; peer review UI allows flagging + voting; runtime malware detector simulates cryptomining pattern; vulnerability DB query returns known-vulnerable version; transparency report generated in PDF/JSON; trusted author badge shows for authors with 50+ installs + 4.5+ rating.

---

## Phase 29 — Mobile PWA & Cross-Device Sync

**Goal:** Make ScriptVault a first-class PWA with offline support on iOS/Android and enable seamless sync across devices.

### 29.1 PWA Manifest & Mobile Installability
- Generate `manifest.json` with required fields: `name`, `short_name`, `icons` (192px, 512px), `start_url`, `display` (standalone)
- Add category icons for script types (productivity, entertainment, social media, utilities)
- Support `beforeinstallprompt` event to trigger install prompt after 30s or user engagement
- Test on Android Chrome (full support), Safari iOS 16.4+ (limited), Firefox Android
- Support: Home screen install on Android, Add to Home Screen on iOS Safari [source 146]

### 29.2 File System Access on Mobile with Fallbacks
- **Desktop (Chrome 86+):** Use `showOpenFilePicker()` for native file picker
- **Mobile Android:** Fallback to `<input type="file" accept=".js" multiple>` for script import
- **iOS PWA:** No File System Access API; use iCloud Drive integration (Phase 29.3) or localStorage migration
- Service Worker caches imported scripts for offline access
- Handle partial support gracefully: detect capability, warn user on unsupported platforms [source 147]

### 29.3 iCloud Drive & CloudKit Integration for iOS
- Implement CloudKit `CKDatabase` for iOS PWA script storage
- Subscribe to `CKQuerySubscription` for push notifications on changes
- Fallback: Manual iCloud Drive sync via file picker (iOS 14+)
- End-to-end encryption option using CloudKit's built-in support
- Dashboard: iCloud sync toggle + status indicator [source 148]

### 29.4 Yjs-Based Conflict-Free Sync Architecture
- Adopt **Yjs** (900k+ weekly npm downloads, used by Evernote, AFFiNE, Cargo) for CRDT-powered sync
- Replace Phase 23's vector-clock system with Yjs `Y.Map` (metadata) + `Y.Text` (script code)
- Auto-merge changes without user intervention; mathematically guaranteed conflict-free
- Support offline editing on all devices → auto-sync on reconnection
- Integration: Works with Monaco editor (already used in Phase 15) [source 149]

### 29.5 Selective Device Sync with Tagging
- Users tag scripts: `#mobile`, `#critical`, `#utility`, `#desktop-only`
- Configuration: per-device sync policy (phone: mobile+critical; tablet: mobile+utility; desktop: all)
- Sync only tagged scripts to mobile to conserve bandwidth + storage
- Dashboard: Tagging UI + per-device sync status [source 150]

### 29.6 RemoteStorage Protocol for Decentralized Sync
- Implement **RemoteStorage** (2,398 stars) for optional decentralized sync
- Users connect via OAuth + WebDAV endpoint to personal server
- Alternative to cloud sync (Phase 21): scripts stored on user's own infrastructure
- Support Nextcloud, OwnCloud, self-hosted WebDAV servers
- Dashboard: RemoteStorage account linking + status [source 151]

**Exit criteria:** PWA installs on Android Chrome; File System Access fallbacks to file picker on iOS; Yjs sync merges changes without conflicts; iCloud Drive integration syncs scripts to iPhone; selective tagging filters 50+ scripts to mobile-only set; RemoteStorage connects to Nextcloud instance.

---

## Phase 30 — Advanced Caching & Performance Optimization

**Goal:** Achieve 5–10x performance improvement for large script libraries through cache coherence, tree-shaking, and emerging optimization techniques.

### 30.1 HTTP Cache Headers & Versioning Strategy
- Implement content-hash versioning for immutable resources: `script.a1b2c3.js` with 1-year cache (`Cache-Control: max-age=31536000`)
- Use `Cache-Control: no-cache` + ETag for versioned URLs and API responses
- Service Worker: send `If-None-Match` on revalidation to get `304 Not Modified` without re-downloading
- Reduces bandwidth for stable script versions by 70% on slow networks [source 152]

### 30.2 Stale-While-Revalidate (SWR) Pattern for API Responses
- Apply `Cache-Control: max-age=60, stale-while-revalidate=300` to GreasyFork API calls
- Users get cached script list immediately; background fetch updates the cache asynchronously
- SWR cuts GreasyFork API thrashing by 70% on script list loads
- Dashboard: API call latency reduces from 500ms+ to 300-400ms on 3G networks [source 153]

### 30.3 Cache Coherence & Dependency Caching
- Build script dependency graph: if Script A `@require`s B, track both in cache
- When B updates, invalidate A's compiled state but preserve B's cached code
- Avoid re-bundling A if only B changed — significant perf win for large ecosystems
- Use Google `diff-match-patch` for delta-based version storage (100KB script × 50 versions = 500KB instead of 5MB)
- Micro-cache pattern: cache GreasyFork responses in `chrome.storage.session` for 1min [source 154]

### 30.4 esbuild Code-Splitting & Lazy-Loading
- Split dashboard bundle by feature: `dashboard-scripts.js`, `dashboard-settings.js`, `dashboard-editor.js`
- Baseline: 450KB → load-time: 150KB + 100KB + 180KB (lazy), saving 200KB on initial load
- Enable esbuild `--incremental` for watch-mode rebuilds: 300ms → 80ms
- Performance target: dashboard load 2.5s → 1.2s initial; watch rebuild 300ms → 80ms [source 155]

### 30.5 Monorepo Architecture for Author Tools (Phase 27 scaling)
- Use Turborepo or Nx for monorepo structure: `@scriptvault/core`, `@scriptvault/eslint-plugin`, `@scriptvault/test-runner`
- Isolate tooling from core extension: authors can update tools without triggering extension rebuild
- Tree-shaking in esbuild: ensure ESM imports only; no CommonJS `require()` in conditional imports
- Phase 27 tooling loads on-demand; core extension stays lean [source 156]

### 30.6 Emerging Optimization Techniques (Chrome 135+)
- **Priority Hints** (`importance="high"` on critical resources): prioritize script list fetch
- **Resource Hints** (`dns-prefetch`, `preconnect` for GreasyFork API): reduce DNS resolution overhead
- **View Transitions API** (Phase 13.2 mentions `sidePanel.getLayout()`): smooth panel transitions when switching dashboard tabs
- **Scheduler.yield()** (Chrome 124+): allow main thread breathing room during large batch operations
- **Preload directives**: preload critical scripts for users with top-10 frequently-used scripts [source 157]

**Exit criteria:** Content-hashed URLs serve 1-year cache; ETag revalidation returns 304; SWR reduces API calls by 70%; dependency graph prevents redundant bundling; dashboard load time measured at 1.2s; monorepo structure splits tooling; Priority Hints registered for critical resources.

---

## Phase 31 — Community Platform & Governance

**Goal:** Build trust and engagement through community-driven reputation, peer governance, and transparent communication.

### 31.1 Discourse Community Forum Setup
- Deploy self-hosted or managed Discourse instance for ScriptVault community
- Categories: Announcements, Feature Requests, Script Showcase, Script Help, Development
- Integration: Discord bot mirrors announcements; RSS feed for GitHub releases
- Moderation: Automated spam filters; reputation badges for trusted contributors [source 158]

### 31.2 Community Reputation & Recognition System
- **Install count tracking:** Aggregate anonymous install counts for each script (no user IDs)
- **Author badges:** "Trusted Author" (50+ installs + 4.5+ avg rating), "Prolific" (100+ scripts), "Helpful" (responsive to issues)
- **Peer voting:** Community votes on script quality; voting signal improves script discovery ranking
- **Integration:** Display on Greasy Fork, in-manager UI, and ScriptVault leaderboard dashboard [source 159]

### 31.3 GitHub Discussions Integration
- Link official GitHub Discussions for each phase/feature area
- GitHub Discussions handle: Feature proposals, user feedback, peer support
- Threads auto-link to ROADMAP phases for traceability
- Dashboard: "Community feedback" widget showing trending discussions [source 160]

### 31.4 Privacy-Preserving Aggregated Usage Insights
- Collect anonymous metrics (no user ID, no script details):
  - Script popularity trends (install deltas, error rates)
  - Feature usage patterns (which features help most users)
  - Performance signals (scripts that crash frequently)
- Use federated learning: each client trains local model → send model updates only (not raw data)
- Differential privacy: add mathematical noise to aggregate counts before publishing
- Architecture: Firefox Telemetry model (structured pings + opt-in collection) [source 161]

### 31.5 Script Author Code of Conduct & Transparency
- Define Code of Conduct: expectations for security, licensing, update frequency
- Publish violations transparently: removed scripts, security disclosures, DMCA notices (anonymized)
- Author response time SLA: commit to responding to security reports within 7 days
- Dashboard: Author profile with response time stats + script health metrics [source 162]

### 31.6 Multi-Manager Interop Liaison
- Participate in userscript standards discussions (WASM Component Model, abx-spec-behaviors)
- Publish "compatibility matrix" tracking which scripts work across TM/VM/ScriptCat/ScriptVault
- Provide migration guides for users switching between managers
- Test compatibility on each major Tampermonkey/Violentmonkey release [source 163]

**Exit criteria:** Discourse forum deployed with 3+ categories; author reputation badges display in-manager; GitHub Discussions threads linked to Phases; privacy-preserving usage metrics published monthly; author Code of Conduct adopted; interop matrix shows 80%+ of popular scripts compatible across managers.

---

## Phase 32 — Emerging Standards & Next-Gen Architectures

**Goal:** Future-proof ScriptVault by adopting emerging scripting standards and enabling next-generation portability.

### 32.1 WASM Component Model Integration (W3C)
- Research WASI Preview 2+ support in browser service workers (experimental, Chrome 146+)
- Enable scripts to be packaged as WASM components (from TypeScript → esbuild-wasm → component binary)
- Publish "Userscript as WASM component" pattern: script exports `run()` function via component model IDL
- Fallback: JavaScript userscripts remain first-class; WASM is opt-in for performance-critical scripts [source 164]

### 32.2 Cross-Platform Portability Standard (abx-spec-behaviors)
- Adopt abx-spec-behaviors schema: standardize selectors (CSS/XPath) + actions (click, fill, extract)
- Enables scripts to run unchanged in:
  - Browser managers (ScriptVault, Tampermonkey, Violentmonkey)
  - Automation tools (Playwright, Puppeteer scripts)
  - AI tools (Claude, GPT browser integrations)
  - Native automation (MacroDroid, Tasker on Android)
- Dashboard: "Export as portable script" option exports abx-spec format [source 165]

### 32.3 JavaScript Modularization via Import Maps
- Adopt TC39 `import.meta` (Stage 4 proposal) for module metadata
- Enable script library federation: Script A depends on B → managed via import maps (no bundling needed)
- @require-module directive (companion to Phase 22's @require-local): fetch modules via import maps
- Integrate vite-plugin-monkey to generate import maps from @require declarations
- Use JSPM CDN for module resolution [source 166]

### 32.4 Tampermonkey/Violentmonkey MV3 Parity Lock-In
- By 2026, MV3 is complete across all managers; Phase 32 solidifies parity on edge cases
- Test and document remaining MV3 limitations: no MV2 polyfills needed
- Publish "MV3 Feature Parity Chart" updated quarterly; track ScriptCat, Violentmonkey, Tampermonkey
- Archive MV2 reference docs for legacy support (Firefox, older Safari) [source 167]

### 32.5 LLM-Assisted Script Analysis & Debugging (Ethical)
- **Read-only LLM features** (no code generation per anti-bloat):
  - "Explain this error" (Phase 15 integration): invoke local Ollama or Claude Batch API
  - "Show similar patterns" from stdlib or @require libraries
  - "Check security issues": auto-review for eval(), unescaped HTML, suspicious @connect patterns
- Backend: Local Ollama (free, ~4GB VRAM) OR Claude Batch API ($0.20/day for 1,000 queries)
- Never suggest auto-fixes; always user-reviewed before apply [source 168]

### 32.6 Wasmtime as Optional Script Runtime
- Investigate Wasmtime (BytecodeAlliance) as an alternative script runtime for:
  - Long-running background tasks that don't need DOM
  - Heavy computation (crypto, image processing) with security sandbox
  - Cross-platform portability (WASM → native)
- Phase 32 is research + feasibility study; Phase 33+ for production integration if viable
- Publish findings: "When to use WASM vs. JavaScript for userscripts" [source 169]

**Exit criteria:** Sample WASM component script compiles and runs in service worker; abx-spec portability format specified and documented; import-maps-based @require-module works for 10+ test scripts; MV3 parity chart published; LLM "explain error" feature works with Ollama or Claude API; Wasmtime feasibility study completed with benchmark results.

---

## Phase 33 — Cross-Browser Support & Build Pipeline

**Goal:** Ship ScriptVault to Firefox, Edge, Brave/Vivaldi/Opera, Orion, and (long-tail) Safari without forking the codebase. Establish a build pipeline that produces per-browser artifacts from a single source.

### 33.1 Cross-Browser Build Pipeline (WXT)
- Migrate build from current Vite/esbuild to **WXT** (https://wxt.dev) — auto-handles MV2/MV3 conversion, browser-specific manifests, hot-reload across vendors [source 180]
- Define build targets: `chrome`, `firefox-mv3`, `edge`, `safari` (via `xcrun`)
- Per-browser manifest function: conditional `background` (event page vs service worker), permissions, `web_accessible_resources` UUID handling
- CI matrix: build all 4 targets on every PR; smoke-test each in respective browser
- Alternative considered: Plasmo Framework — WXT chosen for smaller dependency surface and explicit MV3-first stance [source 181]
- **Effort:** 2–3 weeks (prerequisite to all other 33.x subtasks)

### 33.2 Firefox MV3 Port
- Add `browser_specific_settings.gecko.id` and `gecko.strict_min_version` to manifest (Firefox 128+) [source 182]
- Bundle `webextension-polyfill` for `browser.*` Promise-based API parity with `chrome.*` [source 183]
- Switch background to **event page** format under Firefox build target (Firefox doesn't fully support service workers in MV3 yet — uses event pages with persistent: false equivalent)
- Handle Firefox's `userScripts` API as `optional_permissions` — first-run flow requests user grant [source 184]
- Replace any code that assumes `chrome-extension://` URL scheme — Firefox uses `moz-extension://` with **per-install random UUIDs** for `web_accessible_resources` (cannot hardcode) [source 185]
- Validate Xray Vision boundary: Firefox content scripts see "Xrayed" wrappers around page objects — code touching `unsafeWindow` / page globals must use `wrappedJSObject`
- Use Firefox's **`declarativeNetRequest`** carefully: Firefox's DNR has lower rule limits than Chrome and different `urlFilter` semantics — feature-detect [source 186]
- AMO submission: source code review required for minified/bundled extensions; provide unminified source archive
- **Effort:** 3–5 weeks

### 33.3 Firefox for Android Support
- Firefox Android is the **only mobile browser** that supports a curated set of MV3 extensions on a stable channel [source 187]
- Add `browser_specific_settings.gecko_android: {}` to opt into the Android extension catalog
- Audit popup layout: no sidebar API, no `commands` keyboard shortcuts, restricted `menus` API on Android
- Test with `web-ext lint` for Android API surface
- Submit to Mozilla's recommended-for-Android list (manual review process)
- **Effort:** 1–2 weeks (after 33.2)

### 33.4 Edge Add-ons Store Submission
- Build is Chrome-compatible — submit same `.zip` as CWS to Microsoft Partner Center [source 188]
- Differences: Edge's review is faster (~3 days vs CWS 7+ days); allows external installation links
- Add Edge install badge to README
- Track Edge-specific telemetry via `chrome.management.getSelf().installType`
- **Effort:** 1–3 days

### 33.5 Brave / Vivaldi / Opera / Arc Compat Sweep
- All Chromium-based; should "just work" with CWS build, but each has quirks:
  - **Brave Shields** runs before extensions; can interfere with `declarativeNetRequest` rules — document conflict resolution [source 189]
  - **Vivaldi**: command-chain API allows assigning ScriptVault actions to power keys; opt-in integration
  - **Opera**: must be installed from Opera addons store (separate review) or sideloaded
  - **Arc**: sidebar UI; ensure popup renders correctly in narrow chrome
- Compatibility matrix in README; smoke-test each on every release
- **Effort:** 1 week

### 33.6 Orion Browser (WebKit) Validation
- Orion (Kagi) supports both Chrome AND Firefox extensions via shim layer [source 190]
- Load Firefox build in Orion → verify `browser.userScripts` shim completeness
- Document install path in README
- **Effort:** 1–3 days

### 33.7 Safari Web Extension (Long-Tail)
- **Highest-effort target.** Requires Xcode, Apple Developer account ($99/yr), Swift companion app
- Use `xcrun safari-web-extension-converter` to bootstrap Xcode project [source 191]
- Reference implementation: **quoid/userscripts** (https://github.com/quoid/userscripts) — Swift wrapper + filesystem access via native messaging [source 192]
- iOS variant: even more constrained; iCloud sync via CloudKit (overlap with Phase 29.3)
- App Store review cycle: 1–4 weeks per submission
- **Defer until Phases 33.1–33.6 ship.** Decision gate: do we have 1k+ install community demand for Safari? If yes, fund 8–16 weeks of Swift work; if no, document workaround (use quoid/userscripts to import ScriptVault scripts)
- **Effort:** 8–16 weeks (research + native dev + App Store)

**Exit criteria:** WXT build pipeline produces 4 artifacts (chrome.zip, firefox.zip, edge.zip, safari.zip) on every release; Firefox extension published to AMO with active user count; Edge listing live in Add-ons store; Brave/Vivaldi/Opera/Arc compat matrix in README confirms green status; Orion install path documented; Safari decision gate documented (build or defer with workaround link).

---

## Phase 34 — Deep Accessibility & Author Education

**Goal:** Move beyond Phase 14's WCAG 2.2 structural baseline. Address Monaco screen reader gaps, voice control, forced-colors mode, cognitive accessibility, and onboarding pathways for new script authors. ScriptVault should be the most accessible userscript manager available.

### 34.1 Monaco Screen Reader Compatibility
- Set `accessibilitySupport: 'on'` explicitly in Monaco options (currently auto-detect, unreliable in iframe sandbox) [source 193]
- Add `ariaLabel: 'Userscript editor — press Alt+F1 for help'` to Monaco instance
- Implement Monaco's accessibility help dialog (Alt+F1) — currently disabled in default sandbox config
- Add live region announcement when Monaco loads: "Editor ready. Screen reader users press Alt+F1 for shortcuts."
- Provide "Plain textarea fallback" toggle in Settings — for users where Monaco ARIA tree breaks (NVDA in some Chrome versions, or screen readers that can't enter sandboxed iframes) [source 194]
- Document NVDA Browse Mode → Focus Mode transition (NVDA+Space) in user docs [source 195]
- **Effort:** 3–4 hours

### 34.2 Voice Control & Cursorless Compat
- Audit ScriptVault UI for **Talon Voice** users: every interactive element must have a unique `aria-label` or visible text [source 196]
- Add `data-talon-action="<verb>"` hints on common buttons (toggle, edit, delete) — Talon community wins
- **Cursorless** (VSCode + Talon voice coding) does NOT work with standalone Monaco — document this limitation in user docs and link to alternatives [source 197]
- For voice-first users: provide "Open in VSCode" path (Phase 12 feature) — they edit in VSCode with Cursorless, ScriptVault syncs back
- **Effort:** 2–3 hours

### 34.3 Keyboard Patterns (WAI-ARIA APG)
- Audit dashboard for full keyboard access per **WAI-ARIA Authoring Practices Guide** patterns [source 198]:
  - **Tablist**: arrow-key navigation between tabs (currently Tab-only)
  - **Grid** (script table): arrow keys navigate rows/cells, Home/End jump
  - **Combobox** (search): `role="combobox"` + `aria-expanded` for autocomplete dropdown
  - **Dialog**: focus trap + Escape handler (focus trap exists; Escape handler missing per Phase 14 audit)
- Add visible focus rings using **CSS `:focus-visible`** — not just `:focus` (avoid mouse-click focus rings)
- Skip-to-main-content link at top of every page (currently missing)
- **Effort:** 6–10 hours

### 34.4 Forced-Colors Mode (Windows High Contrast)
- Add `@media (forced-colors: active)` block to all CSS — replace custom colors with system colors (`Canvas`, `CanvasText`, `LinkText`, `ButtonText`, `ButtonFace`, `Highlight`) [source 199]
- Replace `box-shadow` focus indicators with `outline: 2px solid CanvasText` (box-shadow ignored in forced-colors)
- Monaco theme: Monaco has built-in `hc-black` and `hc-light` themes — switch via `window.matchMedia('(forced-colors: active)')` listener [source 200]
- Toggle and badge state: use `border` and `outline` for state indication, not background color (system overrides bg)
- **Effort:** 3–4 hours

### 34.5 Reduced Motion (CSS-First)
- Replace JS-based reduced-motion detection (Phase 14) with native `@media (prefers-reduced-motion: reduce)` CSS block [source 201]
- Disable: shimmer animations, hover lifts, modal slide-in, toast slide-up, scroll animations
- Monaco: respect via `cursorBlinking: 'solid'` and `smoothScrolling: false` when reduced motion is set
- Add Settings toggle "Override system motion preference" for users who want full motion despite OS setting
- **Effort:** 1–2 hours

### 34.6 Cognitive Accessibility & Plain Language
- Audit all error messages for technical jargon — rewrite at Flesch Reading Ease 60+ (8th grade) [source 202]
- Examples:
  - "ENOENT: no such file or directory" → "Couldn't find the file. It may have been moved or deleted."
  - "Failed to parse @match directive" → "ScriptVault couldn't understand the website pattern. Check the @match line for typos."
- Empty states with helpful copy: "No scripts yet. [Create your first script] or [browse Greasy Fork]"
- Consistent vocabulary: pick "userscript" OR "script" globally, not both
- Confirmation dialogs use plain verbs: "Delete script?" not "Are you sure you want to remove this user script?"
- **Effort:** 4–6 hours (one-pass audit) + ongoing

### 34.7 Author Education & Documentation Site
- Stand up dedicated docs site at **scriptvault.dev/docs** using **Astro Starlight** (smaller than Docusaurus, native dark mode, faster cold start) [source 203]
- Pages:
  - **Quick start** — install + first userscript in 5 minutes
  - **Userscript basics** — link to Violentmonkey's "Creating a Userscript" + MDN Content Scripts (don't reinvent) [sources 204, 205]
  - **GM API reference** — auto-generated from TS types
  - **Recipe book** — common patterns (intercept fetch, modify DOM on dynamic SPA, persist settings)
  - **Migration guides** — from TM, VM, Greasemonkey
  - **Accessibility guide for script authors** — "Don't break the page's a11y; here's how to test your script with a screen reader"
- Free **Algolia DocSearch** for OSS — typeahead search [source 206]
- Crowdin/Weblate integration for community-translated docs (overlap with 34.10)
- **Effort:** 8–12 hours initial + ongoing

### 34.8 First-Run Onboarding (Anti-Bloat Compliant)
- **NO interactive tutorial wizard** (anti-bloat). Instead: friendly empty-state copy + sample scripts.
- On first launch with zero scripts:
  - Empty-state card: "Welcome. Add scripts from a URL, paste code, or browse Greasy Fork."
  - Three buttons: `[Add from URL]`, `[Write new]`, `[Browse Greasy Fork]`
  - Inline "Hello World" template auto-loaded into the new-script editor
- After first script added: show one-time toast "Tip: scripts run automatically on matching sites. Toggle them off any time from the dashboard."
- No re-trigger; no "tour again" prompt
- **Effort:** 3–5 hours

### 34.9 Video Tutorial Channel
- Create **scriptvault.dev YouTube channel** with 5-minute screencasts:
  - "Install ScriptVault" (per-browser variants from Phase 33)
  - "Write your first userscript"
  - "Use GM_setValue / GM_getValue"
  - "Migrate from Tampermonkey"
  - "Sync across devices" (Phase 29 feature)
- Captions via YouTube auto-caption + manual review (a11y requirement)
- Embed videos in docs with `<iframe title="...">` per WCAG 2.1 SC 4.1.2
- **Effort:** 2–3 hours per video + filming time

### 34.10 Internationalization Deep Dive
- Replace positional `{0}` substitution with **ICU MessageFormat** for plurals/gender [source 207] — current approach breaks Russian (3 plural forms), Arabic (6), Polish, etc.
  - `messageformat-runtime` (~3 KB gzipped)
- Add RTL support: `dir="rtl"` on `<html>` for Arabic/Hebrew locales; mirror icons (chevrons, back arrows); flip scrollbar position
- Add 4 new locales: `ar`, `hi`, `ko`, `tr` (currently 8: de, en, es, fr, ja, pt, ru, zh)
- **Crowdin** free OSS plan — community translation pipeline; auto-PR new translations [source 208]
- Locale-aware `Intl.DateTimeFormat`, `Intl.NumberFormat`, `Intl.RelativeTimeFormat` (replace any hardcoded "5 minutes ago" strings)
- CJK font selection: ensure system-ui falls back to Noto Sans CJK on Linux (where system-ui may not include CJK glyphs)
- **Effort:** 6–10 hours

### 34.11 Accessibility Testing Automation
- Add **axe-core** to CI [source 209]:
  - Vitest test: run axe against rendered dashboard, fail on any WCAG 2.2 AA violation
  - `@axe-core/playwright` integrated with existing Puppeteer smoke test (`npm run smoke:dashboard`)
- Add **Pa11y CI** as secondary engine — catches issues axe misses [source 210]
- Lighthouse a11y score ≥ 90 enforced in CI
- Manual screen reader checklist: `docs/testing/screen-reader-checklist.md` — 8-step NVDA + VoiceOver protocol; run before every release
- **Effort:** 4–6 hours

**Exit criteria:** Monaco accessibility help dialog works (Alt+F1); plain-textarea fallback ships; Talon Voice users confirm dashboard is fully voice-controllable; WAI-ARIA APG patterns implemented for tablist/grid/combobox/dialog; forced-colors mode renders correctly on Windows High Contrast (manual screenshot test); `prefers-reduced-motion` is CSS-driven, no JS; all error messages pass Flesch 60+; docs site at scriptvault.dev/docs live with 5+ guides; first-run empty state ships (no wizard); 5+ YouTube tutorials published with captions; 12 locales supported with ICU plurals + RTL; axe-core + Pa11y in CI gating PRs; Lighthouse a11y ≥ 90 on every release.

---

## Phase 35 — Federation, Decentralization & Resilience

**Goal:** Make ScriptVault scripts resilient to censorship, takedowns, and single-point-of-failure registries — without adding heavyweight P2P dependencies. Cherry-pick zero/near-zero-dependency wins; reject SDK-heavy options.

**Anti-bloat philosophy:** This phase is **opportunistic**, not aspirational. Each subtask had to clear a "≤30 KB dependency, ≥10x user value" bar to be accepted. The full-fat federation stack (Matrix sync, Solid pods, Hypercore, Helia in-browser IPFS) is **rejected** with documented reasoning.

### 35.1 IPFS CID Integrity & Gateway Fallback
- When a script declares `@ipfs-cid bafy...` in its header, ScriptVault stores the CID alongside the script [source 211]
- On `@updateURL` 404 / DMCA takedown / DNS failure: fall back to public IPFS gateways: `ipfs.io`, `dweb.link`, `cf-ipfs.com`, `gateway.pinata.cloud`
- Verify content integrity: hash fetched bytes, compare to declared CID — **rejects tampered content automatically** (zero-trust)
- Authors opt-in to "Pin my scripts to IPFS" — reuses **Pinata** (500 files / 1 GB free) or **Storacha** (5 GB free) [source 212]
- Brave Browser native `ipfs://` handler: detect Brave via `navigator.brave?.isBrave()` and use direct ipfs:// URLs (no gateway needed) [source 213]
- **Zero new dependencies** — pure HTTP fetch + WebCrypto SHA-256
- **Effort:** 8–12 hours

### 35.2 Nostr-Based Script Discovery (NIP-C0)
- **NIP-C0** defines `kind:1337` events for code snippets [source 214]
- Add Nostr relay queries to the "Discover" tab (Phase 24): `wss://relay.nostr.band` + `wss://relay.damus.io` filter `kind:1337 AND #l:javascript`
- Display alongside GreasyFork/OpenUserJS results; clearly badge as "Nostr — uncensorable"
- Use **`nostr-tools`** library (~30 KB gzipped) — smallest of all federation protocols evaluated
- Authors can publish to Nostr via `nostr.com` web client or `damus` mobile app — ScriptVault doesn't need a publishing UI (defer; users opt-in)
- Scripts include `@nostr-event-id <hex>` header for follow-up updates via NIP-94 file metadata
- **Effort:** 12–16 hours

### 35.3 Cryptographic Author Identity (did:key)
- Every published script MAY include a `@author-did did:key:z6Mk...` header + detached Ed25519 signature [source 215]
- ScriptVault verifies signature using native `crypto.subtle.verify()` — **zero new dependencies**
- Benefits:
  - **Author impersonation prevention**: when GreasyFork removes a script and a malicious actor uploads a "replacement" with the same name, signature mismatch flags it
  - **Cross-registry identity**: same DID works on GreasyFork, Nostr, IPFS, OpenUserJS — author proves ownership without account-linking
  - **DMCA-survivor**: script removed from one registry; user re-discovers it elsewhere; signature confirms it's genuinely the same author
- Signature visible in script details: green checkmark "Verified author: did:key:z6Mk..." with copy-to-clipboard for cross-checking
- **Defers** full Verifiable Credentials (300 KB JSON-LD library) — DIDs alone are sufficient for the threat model
- **Effort:** 6–10 hours

### 35.4 ActivityPub Passive Consumption (Forgejo)
- When `@updateURL` hostname runs Forgejo (detected via `/.well-known/nodeinfo` returning `software.name === "forgejo"`), subscribe to the file's ActivityPub outbox for push-style update notifications [source 216]
- Plain HTTP GET to `/api/v1/activitypub/repository-id/<id>/outbox` — no AP server needed in ScriptVault
- Replaces polling for updates on Forgejo-hosted scripts: O(seconds) latency vs O(hours) for polling
- Codeberg.org runs Forgejo and hosts a growing share of indie userscripts — direct beneficiary
- Falls back to standard polling if outbox unavailable
- **Zero new dependencies** — plain fetch
- **Effort:** 4–6 hours

### 35.5 Self-Hosted Registry Specification
- Publish a public spec: `GET /.well-known/scriptvault-registry` returns JSON with registry metadata + script index [source 217]
- ScriptVault Settings → "Federated Registries" lets users add registry URLs; discovery merges all registries into one search UI
- Provide a reference implementation: single-binary Go server + SQLite, ~15 MB Docker image; one `docker run` command sets up a full registry
- Use cases:
  - Internal corporate userscripts (overlap with Phase 25.2)
  - Indie communities (a single PI subreddit could run their own)
  - Censorship resistance (someone runs a backup registry of removed Greasy Fork scripts)
- **Spec is open**; anyone can implement it; ScriptVault provides reference but doesn't gatekeep
- **Effort:** 16–24 hours (spec + reference impl + docs)

### 35.6 Censorship-Resistant Update Resolution
- When a script's primary `@updateURL` returns 404 or 403:
  1. Try IPFS CID (35.1)
  2. Try Nostr event ID (35.2)
  3. Try archive.org / Wayback Machine snapshot
  4. Surface "Script may have been removed. View [archive] | [Nostr] | [IPFS]"
- User decides whether to keep the cached version or accept the archived/republished one
- All three fallback sources verified against author signature (35.3) — **graceful degradation, no security relaxation**
- **Effort:** 6–10 hours

### 35.7 Rejected — With Documented Reasoning
The following federation patterns were **investigated and rejected**:
- **Matrix as sync transport**: 500 KB SDK; users prefer dedicated sync (Phase 21); link to Matrix room as community-only (overlap with Phase 31)
- **Solid Pods**: 300 KB SDK; <0.1% userscript-author overlap with Solid community; effort/value mismatch
- **DAT/Hypercore/Pear runtime**: requires Pear runtime install — userscript users won't install a separate runtime
- **WebRTC mesh sync (y-webrtc)**: 605 KB Yjs already accepted in Phase 29.4; mesh adds NAT traversal complexity for marginal benefit over server-mediated sync
- **WebTorrent**: 600 KB; userscripts are <100 KB — wrong scale for BitTorrent
- **Helia (in-browser IPFS node)**: 200 KB+ DHT; gateway fallback (35.1) achieves 95% of value for 0% of weight
- **Full Verifiable Credentials**: 300 KB JSON-LD; DIDs alone (35.3) are sufficient
- **Radicle P2P git**: requires `rad` binary — userscript users won't install
- **AT Protocol custom Lexicon**: maintaining a custom `xyz.scriptvault.userscript` lexicon adds versioning burden; defer until Bluesky's userscript community materializes (currently zero)

**Exit criteria:** IPFS CID integrity check works on 5+ test scripts; Nostr discovery surfaces ≥10 scripts in the Discover tab from public relays; did:key signature verification ships and is documented; Forgejo AP outbox subscription works against Codeberg-hosted test repo; self-hosted registry spec published at scriptvault.dev/spec/registry-v1.md with reference Go binary; censorship-resistant update flow tested with intentional 404 + IPFS/Nostr/archive.org fallback.

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

Phase 15 ─── Editor & Dev UX (15.2 auto-grant uses existing Acorn; 15.3+15.4 need Phase 2 + Phase 13.4; 15.6 adds wasm-unsafe-eval CSP; rest need Phase 13.4 Monaco upgrade)
Phase 16 ─── Advanced XHR (builds on Phase 11.5 XHR; 16.3 streaming needs long-lived port; rest independent)
Phase 17 ─── Security Round 2 (17.1 needs Phase 2 session storage; 17.7 GM_addStyle needs Phase 11; rest independent)
Phase 18 ─── Performance (18.1 needs Phase 1 TS migration; 18.2 needs Phase 2; rest independent)

Phase 19 ─── Distribution & CWS Compliance (fully independent; builds on prior phases but can run in parallel as long-tail work)
Phase 20 ─── Observability & Debugging (20.1-20.5 build on prior phases' logging; 20.2 needs Phase 15.6; mostly independent)
Phase 21 ─── Extended Sync Backends (21.1-21.2 independent; 21.3 builds on Phase 8; 21.4-21.6 independent)
Phase 22 ─── Community Standards (22.1-22.8 independent; 22.4 references Phase 5/17 security; purely spec/standard alignment)
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
17. **Phase 15** — Editor & Dev UX (15.1–15.2 can start after Phase 13.4; 15.3 after Phase 2; 15.6 independent)
18. **Phase 16** — Advanced XHR (can run alongside Phase 11; 16.3 streaming after Phase 11.5)
19. **Phase 17** — Security Round 2 (17.1 after Phase 2; 17.3 after Phase 6; rest independent)
20. **Phase 18** — Performance (18.1 after Phase 1; 18.2 after Phase 2; 18.3–18.10 can start anytime)
21. **Phase 19** — Distribution & CWS (can run in parallel with Phases 13–18; long-tail ops work)
22. **Phase 20** — Observability & Debugging (20.2 after Phase 15.6; rest alongside Phases 18–19)
23. **Phase 21** — Extended Sync (21.3 after Phase 8; rest alongside Phases 18–20)
24. **Phase 22** — Community Standards (can run final phase; end-to-end standard alignment)
25. **Phase 23** — Offline-First & Resilient Sync (23.1–23.5 depend on Phase 2; can run alongside Phase 24–26)
26. **Phase 24** — Script Discovery & Recommendations (24.1–24.6 independent; can run parallel with Phase 23–28)
27. **Phase 25** — Enterprise Deployment & Profiling (25.1–25.6 independent; run alongside Phase 24–28)
28. **Phase 26** — WebAssembly & Advanced Matching (26.3 needs Phase 22 URLPattern; rest independent)
29. **Phase 27** — Author Tooling Ecosystem (27.1–27.6 independent; long-tail developer experience)
30. **Phase 28** — Community Security & Transparency (28.1–28.6 cap roadmap; reputation/audit/CVE databases)
31. **Phase 29** — Mobile PWA & Cross-Device Sync (29.1–29.3 independent; 29.4 needs Phase 23 sync; can run alongside Phases 30–32)
32. **Phase 30** — Advanced Caching & Performance (30.1–30.6 independent; optimization pass; run alongside Phases 29–32)
33. **Phase 31** — Community Platform & Governance (31.1–31.6 independent; long-tail engagement work)
34. **Phase 32** — Emerging Standards & Next-Gen Architectures (32.1–32.6 research + future-proofing)
35. **Phase 33** — Cross-Browser Support (33.1 WXT pipeline first; 33.2 Firefox after; 33.4 Edge in parallel; 33.7 Safari deferred behind decision gate)
36. **Phase 34** — Deep Accessibility & Author Education (34.1–34.6 incremental a11y improvements; 34.7 docs site can run anytime; 34.10 i18n after Phase 14)
37. **Phase 35** — Federation & Decentralization (35.1 IPFS + 35.3 did:key are zero-dep; 35.2 Nostr after Phase 24; 35.5 registry spec after Phase 25.2)

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
| 15    | v4.5.0  | Editor DX: IntelliSense, auto-grant, version history, diff view |
| 16    | v4.6.0  | GM_fetch, AbortController, streaming XHR, CHIPS, OpenUserJS |
| 17    | v4.7.0  | Security Round 2: integrity hash, audit log, update consent |
| 18    | v4.8.0  | Performance: module split, OPFS, scheduler, Sanitizer API |
| 19    | v4.9.0  | Multi-store distribution: Edge, CWS compliance, TM/VM compat |
| 20    | v5.0.0  | Observability milestone: per-script execution tracing, errors, network log |
| 21    | v5.1.0  | Extended sync: GitHub Gist, S3, client-side encryption, privacy hardening |
| 22    | v5.2.0  | Community standards: GREASE, URLPattern, @require-local, ESM import maps |
| 23    | v5.3.0  | Offline-first: local caching, conflict-free sync, resilience |
| 24    | v5.4.0  | Discovery: GreasyFork/OpenUserJS browser, health indicators, recommendations |
| 25    | v5.5.0  | Enterprise: admin console, internal repos, allowlist/denylist, audit logs |
| 26    | v5.6.0  | WebAssembly: @require-wasm, URLPattern migration, advanced @match, frame-aware |
| 27    | v5.7.0  | Author tooling: eslint-plugin, test-runner, doc-gen, header validator |
| 28    | v5.8.0  | Community security: peer review, malware detection, CVE tracking, transparency |
| 29    | v5.9.0  | Mobile PWA: iOS/Android installability, Yjs CRDT sync, cross-device support |
| 30    | v6.0.0  | Performance: HTTP caching, SWR, code-splitting, monorepo optimization milestone |
| 31    | v6.1.0  | Community platform: Discourse forum, reputation system, governance + transparency |
| 32    | v6.2.0  | Emerging standards: WASM components, abx-spec portability, import maps, LLM debugging |
| 33    | v6.3.0  | Cross-browser: WXT pipeline, Firefox MV3, Edge store, Brave/Vivaldi/Opera/Arc, Orion, Safari (deferred) |
| 34    | v6.4.0  | Deep a11y: Monaco screen reader, voice control, forced-colors, ICU plurals, RTL, docs site, axe CI |
| 35    | v6.5.0  | Federation: IPFS CID fallback, Nostr discovery, did:key signing, ActivityPub, self-hosted registry spec |



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
- `GM_fetch` — FireMonkey (Firefox) has it; no Chrome manager does; TM #1050 closed without implementation [source 55, 56]
- AbortController signal in GM_xmlhttpRequest — no manager supports `signal?`; all use separate `.abort()` [source 58]
- Script version history + rollback — no manager has this; VM #1391 confirms the data-loss pain [source 60]
- GM_* IntelliSense in built-in editor — `@types/tampermonkey` exists but no manager injects it into their editor [source 47]
- In-browser TypeScript transpilation — no manager or open-source userscript IDE has it [source 48]
- Auto-grant inference (live editor) — vite-plugin-monkey does it at build time; no manager editor does it live [source 49]
- Diff view on update — TM has basic text diff; VM is the most-requested missing feature (#500, 80+ upvotes) [source 73]

## External Research (Round 5)

_Added after second agent-based sweep (May 2026). Sources numbered 47–96 to extend Round 4's index._

### Source Index

**Type Definitions & Build Tools**
47. https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/tampermonkey/index.d.ts — `@types/tampermonkey` (45KB, full GM_* API surface, cookiePartition, stream responseType)
48. https://esbuild.github.io/api/#browser — esbuild-wasm browser usage + wasm-unsafe-eval CSP requirement
49. https://github.com/lisonge/vite-plugin-monkey/blob/main/packages/vite-plugin-monkey/src/node/utils/grant.ts — auto-grant inference AST walk implementation
50. https://github.com/lisonge/vite-plugin-monkey/blob/main/packages/vite-plugin-monkey/src/node/utils/gmApi.ts — 28 tracked GM identifiers for auto-grant
51. https://github.com/kusoidev/ScriptFlow — ScriptFlow: multi-file IDE with 5 templates, PiP sandbox, File System Access API live reload
52. https://github.com/microsoft/monaco-editor/blob/main/CHANGELOG.md — Monaco 0.53–0.55.1 changelog (AMD removal, native LSP, namespace rename)
53. https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/greasemonkey — @types/greasemonkey (GM4 Promise API + v3 subdirectory)

**GM API References**
54. https://violentmonkey.github.io/api/gm/ — VM GM_ function reference (responseType options, anonymous, abort control)
55. https://github.com/erosman/support/issues/98 — FireMonkey `GM_fetch` implementation confirmed (Firefox extension)
56. https://github.com/Tampermonkey/tampermonkey/issues/1050 — TM GM_fetch / Response object proposal (closed as duplicate 2025-04-13)
57. https://www.tampermonkey.net/documentation.php — TM docs: GM_webRequest not available in MV3 (v5.2+)
58. https://github.com/Tampermonkey/tampermonkey/issues/644 — TM GM_webRequest dropped from MV3 branch
59. https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/tampermonkey/index.d.ts#L97-L106 — stream responseType caveats (no abort/timeout/progress in fetch mode)

**GitHub Issue Trackers (Round 5)**
60. https://github.com/violentmonkey/violentmonkey/issues/1391 — VM data loss with no rollback (zero recovery path)
61. https://github.com/violentmonkey/violentmonkey/issues/2118 — VM set-cookie response header filtering breaks SSO flows
62. https://github.com/Tampermonkey/tampermonkey/issues/723 — TM @require-nocache for local development
63. https://github.com/violentmonkey/violentmonkey/issues/2100 — VM CHIPS partitioned cookies break GM.xhr (Cloudflare 403)
64. https://github.com/Tampermonkey/tampermonkey/issues/1483 — TM GM_wsConnectTo WebSocket bypass proposal
65. https://github.com/Tampermonkey/tampermonkey/issues/2703 — TM CLI/API for programmatic script management (developer appetite)
66. https://github.com/Tampermonkey/tampermonkey/issues/2613 — TM install flow UX scrutiny
67. https://github.com/OpenUserJS/OpenUserJS.org — OpenUserJS source; install URL format; no public REST API
68. https://github.com/greasemonkey/greasemonkey — Greasemonkey 4.x (maintenance mode, last real code Feb 2025)
69. https://github.com/advisories?query=tampermonkey — GitHub Advisory Database: 0 CVEs for TM or VM
70. https://github.com/violentmonkey/violentmonkey/issues/500 — VM diff view on update (#1 most-reacted enhancement, 80+ upvotes)
71. https://github.com/violentmonkey/violentmonkey/issues/1934 — VM MV3 migration status (occupied with infra, not features)
72. https://github.com/google/diff-match-patch — diff-match-patch (Google): delta compression for version history (6KB gzipped)
73. https://github.com/violentmonkey/violentmonkey/issues/500 — Diff view before update (see also source 70)
74. https://github.com/violentmonkey/violentmonkey/issues/1023 — VM decouple check-for-update from auto-install (#2 most-painful behavior)

**Adjacent OSS Projects**
75. https://stackoverflow.com/questions/tagged/tampermonkey — Top SO questions: chrome:// blocking, @connect errors, execution timing
76. https://github.com/openstyles/stylus — Stylus CSS manager (MV3, IndexedDB, WebDAV, revision-based sync conflict resolution)
77. https://github.com/openstyles/stylus/blob/master/src/background/sync-manager.js — Stylus sync: 30min interval, 1min debounce, monotonic _rev conflict resolution
78. https://github.com/openstyles/stylus/blob/master/src/background/db.js — Stylus dual-mode IDB/chrome.storage, gzip mirror in CacheStorage API
79. https://chromewebstore.google.com/detail/orangemonkey/ekmeppjgajofkpiofbebgcbohbmfldaf — OrangeMonkey (VM fork, v2.0.14 Mar 2026, closed-source, ZIP backup feature)
80. https://github.com/Tampermonkey/tampermonkey/issues?q=GM_addStyle+shadow+OR+timing+OR+remove+OR+replace — TM GM_addStyle issues: #2671 (remove/replace "not planned")

**ScriptCat v1.x**
81. https://github.com/scriptscat/scriptcat/releases/tag/v1.3.0 — ScriptCat v1.3.0: Amazon S3 sync, GM_addElement content fix, GM API async corrections
82. https://github.com/scriptscat/scriptcat/releases/tag/v1.4.0-beta.1 — ScriptCat v1.4.0-beta: AI Agent, @unwrap, window.onurlchange
83. https://docs.scriptcat.org/en/docs/dev/api/ — ScriptCat GM_setValues/getValues/deleteValues bulk APIs, GM_log with levels
84. https://docs.scriptcat.org/en/docs/change/ — ScriptCat full changelog

**Chrome Platform APIs (Round 5)**
85. https://developer.chrome.com/blog/chrome-148-beta — Chrome 148: SharedWorker extendedLifetime, structured clone, Web Serial on Android
86. https://developer.chrome.com/blog/chrome-146-beta — Chrome 146: Sanitizer API (Element.setHTML, Document.parseHTML)
87. https://developer.chrome.com/blog/chrome-147-beta — Chrome 147: scoped View Transitions (Element.startViewTransition), CSSPseudoElement
88. https://chromestatus.com/api/v0/features?milestone=149 — Chrome 149 features (CSS gap decorations, BFCache WebSocket disconnect, OpaqueRange)
89. https://chromestatus.com/api/v0/features?milestone=150 — Chrome 150 features (CSS URL integrity, AccentColor, text-fit)
90. https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle — SW lifecycle: keepalive via WebSocket (116+), port (114+), API call timer reset
91. https://web.dev/articles/origin-private-file-system — OPFS: zero-copy sync access handles, no quota prompts, ~10× faster than IDB for large files
92. https://github.com/w3c/webextensions — WECG proposals: 420 open issues; SW persistent background (#72, #51) still unresolved

**Performance & Runtime**
93. https://developer.mozilla.org/en-US/docs/Web/API/Scheduler/postTask — scheduler.postTask (Chrome 94+) and scheduler.yield (Chrome 124+)
94. https://tanstack.com/virtual/latest/docs/framework/react/examples/dynamic — TanStack Virtual (3KB, zero framework deps, variable-height rows)
95. https://hn.algolia.com/api/v1/search?query=tampermonkey&tags=story&numericFilters=created_at_i>1704067200 — HN 2025 stories: AI-generated userscripts (ClickRemix, Tweeks) as competitive signal
96. https://github.com/openstyles/stylus/issues/2069 — Stylus cloud sync issue (Apr 2026): closest community conversation to version history

## External Research (Round 6)

_Added after agent-based research pass on distribution, observability, and sync backends (May 2026). Sources numbered 97–135 to extend Round 5's index._

### Source Index

**Multi-Store Distribution & CWS Compliance**
97. https://docs.microsoft.com/en-us/microsoft-edge/extensions-chromium/ — Microsoft Edge Add-ons store requirements for extensions (MV3 support confirmed)
98. https://developer.chrome.com/docs/extensions/how-to/manage/stay_secure_update_safely — Chrome CRX update server: autoupdate.xml format and self-hosted setup
99. https://github.com/Tampermonkey/tampermonkey/issues/1500 — TM backup JSON structure format (uuid, config, script, meta fields)
100. https://support.google.com/chrome/a/answer/188453 — Chrome Web Store policy: remote code execution exception for extension APIs (userscripts manager exemption)

**Script Execution Observability & Debugging**
101. https://developer.mozilla.org/en-US/docs/Web/API/Performance/mark — Performance Mark API: per-script execution timing instrumentation
102. https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/SourceMap — Source map support in DevTools: //# sourceMappingURL inline comments
103. https://developer.chrome.com/docs/extensions/service-workers/service-workers/ — Chrome extension service worker console behavior: message routing to DevTools
104. https://developer.mozilla.org/en-US/docs/Web/API/GlobalEventHandlers/onerror — window.onerror vs unhandledrejection event classification
105. https://developer.chrome.com/docs/extensions/develop/concepts/messaging-native/ — Native messaging for extensions (for network log relay pattern reference)

**Cloud Sync Backends**
106. https://docs.github.com/en/rest/gists/gists — GitHub Gist API: create/update/list operations with personal access token (stable API, v3)
107. https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html — AWS S3 presigned URLs: client-side uploads without AWS SDK
108. https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto — Web Crypto API: AES-256-GCM encryption and PBKDF2 key derivation (Chrome 34+)
109. https://www.tampermonkey.net/documentation.php#api_GM_xmlhttpRequest — TM GM_xmlhttpRequest header options: `Referer` header control
110. https://www.greasyfork.org/en/scripts/by-site — GreasyFork homepage: community script ecosystem overview (for standards research)

**Community Standards & Specs**
111. https://developer.mozilla.org/en-US/docs/Web/API/URLPattern — URLPattern API (Chrome 95+): standard URL matching for @match parsing
112. https://github.com/violentmonkey/violentmonkey/issues — VM GitHub: @require-local pattern research from community proposals
113. https://github.com/scriptscat/scriptcat — ScriptCat GitHub: @sandbox directive documentation (if available)
114. https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script/type/importmap — Import Maps (Chrome 89+): module resolution in ESM scripts
115. https://developer.mozilla.org/en-US/docs/Web/API/Window/showSaveFilePicker — File System Access API: user-gesture-gated file picker (Chrome 86+)

## External Research (Round 7)

_Added after agent-based research on offline-first, discovery, enterprise, WASM, author tools, and community security (May 2026). Sources numbered 116–145._

### Source Index

**Offline-First & Sync Architecture**
116. https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle — Chrome.alarms API: background wake-up (min 30s intervals)
117. https://github.com/openstyles/stylus/blob/master/src/background/sync-manager.js — Stylus conflict resolution: monotonic _rev + metadata-only merge strategy
118. https://developer.chrome.com/docs/extensions/reference/api/alarms/ — chrome.alarms: retry scheduling for offline sync queue
119. https://github.com/greasemonkey/greasemonkey/wiki/Script-Installation — GreasyFork API (partial public, mostly scrape): top-scripts endpoint
120. https://sleazyfork.org/en/scripts — Sleazy Fork: ratings & install-count aggregation (community adult-content site)
121. https://stackoverflow.com/questions/tagged/greasemonkey+dependencies — Userscript @require dependency discovery patterns
122. https://gist.github.com — GitHub Gist: JSON sharing format for script collections

**Script Discovery & Recommendations**
123. https://github.com/OpenUserJS/OpenUserJS.org/wiki/API-Reference-for-OpenUserJS-org — OpenUserJS public API (limited, mostly for discovery)
124. https://github.com/greasemonkey/greasemonkey/wiki/Script-Installation — GreasyFork script metadata: @name, install count, rating
125. https://www.tampermonkey.net/scripts.php?sort=installs — Tampermonkey's script browser shows popularity signals
126. https://docs.google.com/spreadsheets/d/1RzaC3IZsZXJo3uEZg3BH8z7TLkCHNs0JsmH7V_Y1_4c/edit — Userscript dependency graph research
127. https://github.com/violentmonkey/violentmonkey/issues/2287 — VM issue: script grouping/categorization demand
128. https://github.com/Tampermonkey/tampermonkey/issues/2442 — TM issue: bulk pattern editing request

**Enterprise Deployment & Policies**
129. https://support.google.com/chromebook/a/answer/2657289 — Chrome Admin Console ExtensionSettings policy documentation
130. https://support.google.com/a/answer/2657289?hl=en#ExtensionSettings — ExtensionSettings JSON schema with allowlist/denylist
131. https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging — Native messaging for enterprise script distribution
132. https://github.com/google/enterprise-chrome-browser-remote-desktop — Chrome Remote Desktop scripting patterns
133. https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns — Match pattern performance benchmarking
134. https://chromewebstore.google.com/category/extensions — CWS: allowlist of managed app distribution models

**WebAssembly in Extensions**
135. https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WebAssembly/instantiate — WebAssembly.instantiate() in content scripts
136. https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts/content-scripts-architecture#injection-timing — WASM CSP: wasm-unsafe-eval requirement
137. https://developer.chrome.com/docs/extensions/reference/manifest/sandbox — Manifest sandbox field: WASM isolation boundary
138. https://www.w3.org/TR/wasm-core-1/#instantiation — W3C WebAssembly Core spec: error handling and lifecycle
139. https://esbuild.github.io/getting-started/#build-scripts — esbuild WASM: size benchmarks (~750KB–1.2MB depending on feature set)

**Author Tooling & Ecosystem**
140. https://github.com/eslint/eslint/blob/main/docs/rules/no-eval.md — ESLint no-eval rule: security best practice
141. https://github.com/lisonge/vite-plugin-monkey — vite-plugin-monkey: 1.9k⭐, auto-grant inference, template system
142. https://playwright.dev/docs/intro — Playwright: browser automation for script testing
143. https://github.com/google/diff-match-patch/wiki — diff-match-patch: version history delta compression
144. https://github.com/microsoft/TypeScript/wiki/Version-History — TypeScript version history analysis for changelog generation

**Community Security & Peer Review**
145. https://greasyfork.org/en/scripts?sort=installs — GreasyFork script browse API (if available) + public ratings

## External Research (Round 8)

_Added after agent-based research on mobile PWA, performance optimization, and community standards (May 2026). Sources numbered 146–179._

### Source Index

**Mobile PWA & Cross-Device Sync (Phase 29)**
146. https://web.dev/install-criteria/ — PWA installability criteria; manifest.json requirements; install prompt timing
147. https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API — File System Access API mobile support matrix (Chrome Android partial, iOS not supported)
148. https://developer.apple.com/documentation/cloudkit/ — Apple CloudKit: change tracking, conflict resolution, offline support
149. https://yjs.dev/ — Yjs: 900k+ weekly npm downloads; CRDT sync used by Evernote, AFFiNE, Cargo
150. https://github.com/remotestorage/remotestorage.js — RemoteStorage: 2,398 stars; decentralized sync via OAuth + WebDAV

**Advanced Caching & Performance (Phase 30)**
151. https://web.dev/articles/http-cache/ — HTTP cache freshness, max-age, ETag, Last-Modified (RFC 9111)
152. https://web.dev/articles/stale-while-revalidate — RFC 5861 SWR spec; stale cache + background revalidation
153. https://github.com/google/diff-match-patch — Diff-Match-Patch: delta compression for version history (6KB gzipped)
154. https://esbuild.github.io/api/ — esbuild: 10–100x faster bundling; code-splitting, tree-shaking, watch mode
155. https://turborepo.org/ — Turborepo: monorepo orchestration; Nx alternative
156. https://developer.chrome.com/blog/priority-hints/ — Priority Hints, Resource Hints, Scheduler.yield() (Chrome 124+)

**Community Platform & Governance (Phase 31)**
157. https://github.com/discourse/discourse — Discourse: 100% open-source community platform; 47k+ stars
158. https://greasyfork.org/ — Greasy Fork: script reputation via install counts, ratings, user comments
159. https://docs.github.com/en/discussions — GitHub Discussions: integrated Q&A for repositories
160. https://github.com/mozilla/firefox-data-docs — Firefox Telemetry: privacy-first data collection + transparent dashboards
161. https://github.com/OpenMined/PySyft — PySyft: differential privacy + federated learning framework
162. https://github.com/matomo-org/matomo — Matomo: 21k+ stars; GDPR-compliant open-source analytics
163. https://github.com/plausible/analytics — Plausible: privacy-first web analytics; <1KB script
164. https://github.com/violentmonkey/violentmonkey — Violentmonkey: community forum discussion patterns (Discord)

**Emerging Standards & Interop (Phase 32)**
165. https://github.com/WebAssembly/component-model — W3C WASM Component Model; language-independent components; WIT IDL
166. https://github.com/bytecodealliance/wasmtime — Wasmtime: WASI standard runtime; cross-platform embeddings
167. https://github.com/ArchiveBox/abx-spec-behaviors — abx-spec: standardize scripts for browser/automation/AI tools
168. https://github.com/tc39/proposal-import-meta — TC39 import.meta (Stage 4); module-specific metadata
169. https://github.com/jspm/jspm-core — JSPM: package.json-free module resolution + import maps
170. https://github.com/scriptscat/scriptcat — ScriptCat: MV3 complete; background scripts beyond Tampermonkey
171. https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions — WebExtensions API (Firefox standard)
172. https://docs.anthropic.com/en/api/getting-started — Anthropic Claude API: Messages, Batches, Token Counting
173. https://openai.com/api/pricing/ — OpenAI GPT-4o mini pricing: script debugging cost estimates
174. https://github.com/ollama/ollama — Ollama: free local LLM runner (~4–8GB VRAM); privacy-first
175. https://llm.nvim — llm.nvim: example architecture for LSP + LLM integration

## External Research (Round 9)

_Added May 2026 after parallel agent research on cross-browser support, deep accessibility, and federation/decentralization. Sources 180–217._

### Cross-Browser & Build Tooling (180–192)
180. https://wxt.dev/guide/essentials/target-different-browsers.html — WXT cross-browser targeting (Chrome, Firefox, Edge, Safari)
181. https://github.com/PlasmoHQ/plasmo — Plasmo Framework (alternative considered)
182. https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings — `browser_specific_settings` for Firefox signing + Android opt-in
183. https://github.com/mozilla/webextension-polyfill — Mozilla's `browser.*` Promise polyfill
184. https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/userScripts — Firefox `userScripts` API (optional permission)
185. https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Chrome_incompatibilities — Chrome vs Firefox API differences
186. https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/declarativeNetRequest — Firefox DNR (lower rule limits)
187. https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Developing_WebExtensions_for_Firefox_for_Android — Firefox for Android extension development
188. https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/publish/publish-extension — Edge Add-ons store submission
189. https://brave.com/shields/ — Brave Shields interaction with extensions
190. https://browser.kagi.com/ — Orion (WebKit Mac/iOS, supports Chrome + Firefox extensions)
191. https://developer.apple.com/safari/extensions/ — Safari Web Extensions + Xcode converter
192. https://github.com/quoid/userscripts — quoid/userscripts: Safari userscript manager reference

### Accessibility & Education (193–210)
193. https://github.com/microsoft/monaco-editor/wiki/Accessibility-Guide — Monaco accessibility configuration
194. https://github.com/microsoft/monaco-editor/issues/4908 — Monaco screen reader iframe issue (open)
195. https://www.nvaccess.org/files/nvda/documentation/userGuide.html — NVDA Browse Mode / Focus Mode
196. https://talonvoice.com/ — Talon Voice control for developers
197. https://www.cursorless.org/ — Cursorless: voice coding (VSCode-only, not Monaco)
198. https://www.w3.org/WAI/ARIA/apg/patterns/ — WAI-ARIA Authoring Practices Guide patterns (tablist, grid, combobox, dialog)
199. https://developer.mozilla.org/en-US/docs/Web/CSS/@media/forced-colors — `forced-colors` media query (Windows High Contrast)
200. https://github.com/microsoft/monaco-editor/blob/main/docs/integrate-amd.md — Monaco hc-black / hc-light themes
201. https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion — `prefers-reduced-motion` CSS-first approach
202. https://www.w3.org/TR/coga-usable/ — W3C Cognitive Accessibility (plain language, consistent navigation)
203. https://starlight.astro.build/ — Astro Starlight (recommended docs site framework)
204. https://violentmonkey.github.io/guide/creating-a-userscript/ — Violentmonkey beginner guide (link, don't reinvent)
205. https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts — MDN Content Scripts (canonical reference)
206. https://docsearch.algolia.com/ — Algolia DocSearch free tier for OSS
207. https://formatjs.io/docs/intl-messageformat/ — ICU MessageFormat (plurals, gender, RTL)
208. https://crowdin.com/page/open-source-project-setup-request — Crowdin free OSS plan
209. https://github.com/dequelabs/axe-core — axe-core: WCAG rule engine for CI
210. https://pa11y.org/ — Pa11y CI: secondary a11y test engine

### Federation & Decentralization (211–217)
211. https://docs.ipfs.tech/concepts/content-addressing/ — IPFS Content Identifiers (CIDs) + integrity
212. https://web3.storage/ — Storacha (formerly web3.storage): IPFS pinning, 5 GB free
213. https://brave.com/ipfs-support/ — Brave native IPFS resolver (`ipfs://` URLs)
214. https://github.com/nostr-protocol/nips/blob/master/C0.md — Nostr NIP-C0: kind:1337 code snippets
215. https://www.w3.org/TR/did-core/ — W3C DID Core specification (did:key for author signing)
216. https://forgejo.org/docs/latest/user/activitypub/ — Forgejo ActivityPub federation (passive consumption)
217. https://github.com/yjs/y-webrtc — y-webrtc (rejected: 605 KB; documented in 35.7)


### Updated Chrome Platform API Timeline (Chrome 135–150)

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
| Chrome 146 | Sanitizer API: `Element.setHTML()`, `Document.parseHTML()` | Phase 18.7 — GM_setHTML + remove DOMPurify from UI |
| Chrome 147 | `Element.startViewTransition()` scoped to sub-element | Phase 18 — sidePanel panel transitions |
| Chrome 148 | Structured clone messaging opt-in | Phase 13.1 |
| Chrome 148 | `SharedWorker` with `extendedLifetime: true` | Phase 18.6 — long-lived sync/backup |
| Chrome 149 | BFCache WebSocket disconnect | Scripts with WebSocket connections need disconnect handling |
| Chrome 150 | CSS URL integrity `url("img.png" integrity(...))` | Complements Phase 11.8 @require SRI |

## Feature Harvest & Gap Analysis Appendix

This appendix records ALL features considered for Phases 11–18, their final tier, and the reasoning. Items are grouped by the category used in the research brief.

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

### Accepted — Now/Next (Phases 15–18)

| Item | Tier | Phase | Reasoning |
|------|------|-------|-----------|
| GM_* IntelliSense via @types/tampermonkey | Now | 15.1 | 45KB type definitions exist; no manager has done this; zero new permissions |
| Auto-grant inference (live Acorn AST) | Now | 15.2 | Eliminates #1 developer workflow error; Acorn already in SW; leapfrog over all competitors |
| Script version history + rollback (diff-match-patch) | Now | 15.3 | No manager has this; VM #1391 data-loss pain; 95% storage saving with delta compression |
| Diff view before update (Monaco diff editor) | Now | 15.4 | VM #500 most-reacted enhancement; VM still hasn't shipped it in 2025 |
| Script templates (6 built-in types) | Now | 15.5 | Developer UX table stakes; reduces friction for new scripts |
| esbuild-wasm TypeScript transpilation | Next | 15.6 | Only manager with in-editor TS support; requires wasm-unsafe-eval CSP; 3.2MB WASM download |
| Live reload (re-inject on save) | Next | 15.7 | Developer UX; ScriptFlow has it; no Chrome manager does |
| Dry-run sandbox (GM_* mock iframe) | Next | 15.8 | Testing workflow innovation; no competitor has an in-manager sandbox |
| GM_fetch (Promise-based XHR) | Now | 16.1 | FireMonkey has it; no Chrome manager does; TM #1050 closed without implementation |
| AbortController signal in GM_xmlhttpRequest | Now | 16.2 | Standard JS API integration; huge DX improvement; low effort |
| Long-lived port XHR streaming | Next | 16.3 | Avoids stream responseType's fetch-mode limitations (no abort/progress); genuine leapfrog |
| CHIPS cookiePartition option in GM_xhr | Now | 16.4 | VM #2100 Cloudflare CHIPS breakage; types already have it; low effort |
| XHR redirect mode option | Now | 16.5 | Standard fetch parity; complementary to Phase 11.5 |
| GM_download Blob/File URL | Now | 16.6 | Simple extension of existing GM_download; enables in-memory data download |
| OpenUserJS in script browser | Next | 16.7 | Second browser source beyond GreasyFork; static top-scripts approach avoids API dependency |
| Script body integrity hash at injection | Now | 17.1 | Session storage hash → injection verification; no manager does this; 0 UX friction |
| Tamper-evident audit log | Now | 17.2 | Enables incident analysis; no manager has it; high trust value |
| Decouple update-check from auto-install | Now | 17.3 | VM #1023 most-painful behavior; provides consent before overwriting working scripts |
| External message origin validation | Now | 17.4 | Prevents malicious extension injection via chrome.runtime.sendMessage; minimal code |
| chrome:// @match warning | Now | 17.5 | Silent failure on chrome:// currently; low effort toaster warning |
| @require-css metadata directive | Next | 17.6 | ScriptCat differentiator; fetch+cache CSS at install; inject before script runs |
| GM_addStyle handle API + ShadowRoot injection | Next | 17.7 | TM #2671 "not planned"; leapfrog with `.remove()` / `.replace()` handle API |
| ES module splitting for SW cold-start | Now | 18.1 | ~1200ms → <300ms cold-start; requires Phase 1 TS migration; critical perf fix |
| OPFS for large script storage | Next | 18.2 | 10× faster than IDB for large files; zero-copy sync access; requires Phase 2 |
| scheduler.postTask for SW background work | Now | 18.3 | Chrome 94+; replaces bare setTimeout; prevents SW event loop starvation |
| CompressionStream in backup export | Now | 18.4 | Native Chrome API; streaming gzip; eliminates fflate for streaming path |
| TanStack Virtual for script lists | Next | 18.5 | 3KB zero-dep; smooth scrolling at 200+ scripts; threshold at ≥100 |
| SharedWorker extendedLifetime (Chrome 148) | Later | 18.6 | Chrome 148+ only; good for long-running sync but requires complex SW bridge |
| GM_setHTML + Sanitizer API | Now | 18.7 | Chrome 146+; eliminates DOMPurify from UI paths; new GM API leapfrog |
| navigator.storage.persist() on IDB open | Now | 18.8 | Prevents storage eviction under pressure; only Greasemonkey does this; 1-line fix |
| Broken script detector | Next | 18.9 | 30+ day idle with errors warning; proactive maintenance UX; no competitor has it |
| @require-nocache directive | Next | 18.10 | Developer QoL; TM #723 open since 2019; zero implementation risk |

### Accepted — Now/Next (Phases 19–22)

| Item | Tier | Phase | Reasoning |
|------|------|-------|-----------|
| Edge Add-ons store listing | Now | 19.1 | MV3 compatible; no code changes; extend store coverage |
| Self-hosted CRX update server | Next | 19.3 | Optional feature for privacy-conscious users; non-standard distribution |
| TM/VM ZIP import round-trip | Now | 19.4 | High interoperability value; backup format compatibility |
| Developer tooling guide | Now | 19.5 | Documentation + curation; no new code; establish best practices |
| CWS policy compliance memo | Now | 19.6 | Anticipate audits; document policy exception for remote code execution |
| Per-script execution timing | Now | 20.1 | Low-effort performance observability; IndexedDB schema extension |
| Source map support for errors | Next | 20.2 | Requires Phase 15.6; stack traces point to source files, not injected code |
| Per-script console interception | Now | 20.3 | Collects logs locally; dashboard console tab for debugging |
| Script error categorization | Now | 20.4 | Distinguish syntax/runtime/rejection/timeout errors; better diagnostics |
| Network request tracing | Now | 20.5 | Log method/URL/status/latency per-script; no request bodies (privacy) |
| Permission denial logging | Now | 20.6 | Log attempts to use ungrantable APIs; suggest @grant additions |
| GitHub Gist sync | Now | 21.1 | Second cloud backend; enables revision history; Gist API stable |
| S3-compatible sync (R2/B2) | Next | 21.2 | For large backups/bodies; presigned URL approach avoids credential storage |
| Nextcloud detection + CalDAV | Next | 21.3 | Extends Phase 8 WebDAV; auto-discover Nextcloud + offer native API |
| Client-side encryption for backup | Now | 21.4 | AES-256-GCM + PBKDF2; cloud stores opaque blobs; opt-in UI toggle |
| Referrer stripping in GM_xhr | Now | 21.5 | Optional privacy toggle; logs stripped referrers; complements @connect |
| Incognito storage isolation | Now | 21.6 | Use chrome.storage.session for incognito; no persistence on close |
| GREASE spec alignment | Now | 22.1 | Active community standard; track as it evolves; future-proof directives |
| URLPattern API migration | Next | 22.2 | Chrome 95+ native API; if @match syntax aligns, leapfrog custom regex |
| @require-local dependencies | Now | 22.3 | Script authors build modular libraries; enables community patterns |
| @sandbox detection warning | Now | 22.4 | Alert when scripts request unsupported sandbox mode (ScriptCat pattern) |
| Import maps for ESM scripts | Next | 22.5 | Pages with import maps; ESM-compiled scripts can leverage them |
| GM_openFile / GM_saveFile APIs | Next | 22.6 | File System Access API bridge; behind @grant gate + user gesture |
| Script maintenance mode | Now | 22.7 | Dashboard suggestions for deprecated/stale scripts |
| Security disclosure support | Now | 22.8 | Route security reports to script authors via @supportURL |

### Accepted — Now/Next (Phases 23–28)

| Item | Tier | Phase | Reasoning |
|------|------|-------|-----------|
| Offline-first caching (IndexedDB) | Now | 23.1 | Essential resilience feature; no competitors offer it; Phase 2 enables |
| Async sync queue + reconnection | Now | 23.2 | Core offline value; no complexity bloat; natural extension of Phase 8 |
| Conflict-free sync (tombstones + vector clocks) | Now | 23.3 | Stylus already does this; zero data loss guarantee; medium effort |
| OPFS-based offline cache | Next | 23.4 | 10× faster than IDB for large files; opt-in only; Phase 2 prerequisite |
| Sync resilience (exponential backoff) | Now | 23.5 | Handles transient failures gracefully; standard pattern; low effort |
| In-dashboard GreasyFork browser | Now | 24.1 | Leapfrog competitor discovery; static cache avoids API dependency |
| Popularity signals & health badges | Now | 24.2 | Helps users identify maintained scripts; Sleazy Fork already has it |
| Related scripts recommendations | Next | 24.3 | Graph-based discovery; requires Phase 24.1; medium effort |
| Script dependency suggestions | Now | 24.4 | One-click install of @require dependencies; high UX value |
| Custom script collections | Now | 24.5 | User-created bundles shareable as JSON; low effort; high UX value |
| Trending leaderboard | Next | 24.6 | Requires local aggregate stats tracking; optional, non-critical |
| Chrome Admin Console policy | Now | 25.1 | Enterprise table-stakes; documentation + JSON template; negligible code |
| Internal script repository | Next | 25.2 | IT/Security teams mandate scripts; moderate effort; niche use case |
| Script allowlist/denylist | Now | 25.3 | Admin-enforced policies; complements 25.1; low effort |
| Audit log export (SOC2) | Next | 25.4 | SIEM ingestion; CSV + JSON; moderate effort; long-tail compliance |
| Per-script performance profiling | Next | 25.5 | LoAF API integration; dashboard ranking; moderate effort; niche value |
| Execution timeline visualization | Later | 25.6 | Advanced debugging; waterfall charts; high effort; low user need |
| @require-wasm directive | Next | 26.1 | Enables compute-heavy scripts; moderate effort; rare use case |
| WASM CSP compliance | Now | 26.2 | SRI validation + size limit + error handling; security best practice |
| URLPattern API migration | Next | 26.3 | 2–3× performance win; Phase 22.2 prerequisite; medium effort |
| Advanced @match boolean logic | Later | 26.4 | OR/AND/NOT operators; requires parser; low demand; medium effort |
| Frame-aware @match | Next | 26.5 | @run-in-frame flag; iframe matching; low effort; fills capability gap |
| @match performance regression testing | Now | 26.6 | CI/CD benchmark; prevents slowdowns; essential quality gate |
| @scriptvault/eslint-plugin | Now | 27.1 | Developer DX table-stakes; unused @grant detection; low-to-medium effort |
| @scriptvault/test-runner | Next | 27.2 | Playwright-based; mock GM_* APIs; medium effort; niche developer need |
| @scriptvault/doc-gen | Now | 27.3 | Markdown from header; install link generation; low effort |
| vite-plugin-monkey templates | Now | 27.4 | Partner effort; error boundary + perf instrumentation + logging |
| Script header validator UI | Next | 27.5 | Web tool; batch validation; low effort; optional convenience |
| Version management CLI | Later | 27.6 | Git history parsing + changelog generation; low demand; can be external tool |
| Script security audit (static) | Now | 28.1 | eval/Function() detection; credential scanning; low effort; high value |
| Community peer review system | Next | 28.2 | GitHub-backed verified list; community voting; moderate effort |
| Malware detection + quarantine | Later | 28.3 | Runtime behavior monitoring; requires heuristics; high false-positive risk |
| Vulnerability database + CVE tracking | Next | 28.4 | CSV-backed; dashboard alerts; moderate effort; niche but important |
| Transparency report (annual) | Now | 28.5 | Aggregate stats; privacy-respecting; documentation + process; low effort |
| Author reputation & trust signals | Now | 28.6 | Track history + response times; "trusted author" badge; low effort |

### Accepted — Now/Next (Phases 29–32)

| Item | Tier | Phase | Reasoning |
|------|------|-------|-----------|
| PWA manifest generation | Now | 29.1 | Required for Android/iOS installability; manifest.json standard; low effort |
| File System Access fallback (iOS) | Now | 29.2 | iOS PWAs lack FSA API; use file picker + Service Worker caching; graceful degradation |
| iCloud Drive + CloudKit integration | Next | 29.3 | iOS-specific; enables sync for Safari PWA users; CloudKit proven (Apple ecosystem) |
| Yjs CRDT-based sync | Now | 29.4 | 900k+ weekly npm downloads; Evernote/AFFiNE/Cargo use it; auto-merge without conflicts |
| Selective device sync (tagging) | Now | 29.5 | Bandwidth-aware for mobile; users tag scripts for specific devices; low effort |
| RemoteStorage for decentralized sync | Next | 29.6 | 2,398 stars; optional alternative to cloud; lets users own infrastructure; moderate effort |
| HTTP cache headers + ETag versioning | Now | 30.1 | RFC 9111 standard; 1-year cache for immutable resources; 70% bandwidth savings |
| Stale-While-Revalidate pattern | Now | 30.2 | RFC 5861; reduces API thrashing 70%; 500ms → 300ms API latency on 3G |
| Cache coherence + dependency graph | Next | 30.3 | Prevents redundant bundling; delta-based version storage (5MB → 500KB for 50 versions) |
| esbuild code-splitting by feature | Now | 30.4 | 450KB → lazy-load saves 200KB; watch rebuild 300ms → 80ms; dashboard load 2.5s → 1.2s |
| Monorepo architecture (Turborepo) | Next | 30.5 | Isolates tooling (Phase 27) from core extension; clean build separation; Phase 27 scaling |
| Emerging optimization techniques | Later | 30.6 | Priority Hints, Resource Hints, Scheduler.yield(), View Transitions; Chrome 135+ features |
| Discourse forum deployment | Now | 31.1 | 47k+ stars; moderation tools; Discord bot integration; peer support hub |
| Community reputation system | Now | 31.2 | Author badges (Trusted, Prolific, Helpful); install count tracking; peer voting |
| GitHub Discussions integration | Now | 31.3 | Native Q&A per repo; feature proposals linked to ROADMAP phases |
| Privacy-preserving usage insights | Now | 31.4 | Federated learning + differential privacy; Firefox Telemetry model; aggregate-only |
| Author Code of Conduct | Now | 31.5 | Security/licensing/update expectations; transparent removal/CVE logs; SLA commitments |
| Multi-manager interop liaison | Next | 31.6 | Compatibility matrix for TM/VM/ScriptCat/ScriptVault; migration guides; standards tracking |
| WASM Component Model support | Next | 32.1 | W3C standard; scripts compile to WASM components; opt-in for perf-critical use |
| Cross-platform portability standard (abx-spec) | Next | 32.2 | Enable scripts to run in browser/automation/AI tools unchanged; export format |
| JavaScript modularization (import.meta) | Later | 32.3 | TC39 Stage 4; module federation; @require-module via import maps |
| MV3 parity lock-in documentation | Now | 32.4 | Quarterly "Feature Parity Chart" across TM/VM/ScriptCat; archive MV2 docs |
| LLM-assisted debugging (ethical bounds) | Next | 32.5 | "Explain error" + "show patterns" only (no code generation); local Ollama or Claude Batch |
| Wasmtime feasibility study | Later | 32.6 | Research WASI Preview 2+; evaluate as alternative runtime for long-running tasks |

### Accepted — Now/Next (Phases 33–35)

| Item | Tier | Phase | Reasoning |
|------|------|-------|-----------|
| WXT cross-browser build pipeline | Now | 33.1 | Prerequisite to all Firefox/Edge/Safari work; auto-handles MV2/MV3 conversion |
| Firefox MV3 port | Now | 33.2 | Highest-value target after Chrome; AMO is largest non-CWS extension marketplace |
| Firefox for Android | Next | 33.3 | Only stable mobile browser supporting MV3 extensions; depends on 33.2 |
| Edge Add-ons store submission | Now | 33.4 | 1–3 days; build is already Chrome-compatible; expand reach |
| Brave/Vivaldi/Opera/Arc compat sweep | Now | 33.5 | Chromium-based; doc Brave Shields conflict, Vivaldi commands, Arc sidebar |
| Orion Browser validation | Next | 33.6 | Near-zero effort; Mac/iOS WebKit; load Firefox build, document |
| Safari Web Extension | Later | 33.7 | 8–16 weeks Swift work; defer behind decision gate (1k+ install demand) |
| Monaco screen reader compatibility | Now | 34.1 | Critical a11y gap in Phase 14; Alt+F1 help, plain-textarea fallback, ARIA labels |
| Voice control (Talon) audit | Next | 34.2 | Add `data-talon-action` hints; document Cursorless limitation |
| WAI-ARIA APG keyboard patterns | Now | 34.3 | Tablist/grid/combobox/dialog: arrow-key nav, focus traps, skip links |
| Forced-colors mode (Windows HC) | Now | 34.4 | `@media (forced-colors: active)`; system colors; Monaco hc-black theme switch |
| Reduced-motion CSS-first | Now | 34.5 | Replace JS detection with `@media (prefers-reduced-motion: reduce)` |
| Cognitive accessibility audit | Now | 34.6 | Flesch 60+ for all error messages; consistent vocabulary; plain verbs |
| scriptvault.dev/docs (Starlight) | Now | 34.7 | Quick start, GM API ref, recipes, migration guides; Algolia DocSearch |
| First-run empty state (no wizard) | Now | 34.8 | Anti-bloat compliant: empty-state copy + sample script + 3 buttons |
| YouTube tutorial channel | Next | 34.9 | 5 screencasts (install, first script, GM API, migrate, sync); captioned |
| ICU MessageFormat + RTL | Now | 34.10 | Replace `{0}` with ICU plurals; add ar/hi/ko/tr; Crowdin pipeline |
| axe-core + Pa11y in CI | Now | 34.11 | Vitest + Playwright + GH Actions; gate PRs on WCAG 2.2 AA |
| IPFS CID integrity + gateway fallback | Now | 35.1 | Zero new deps; HTTP fetch + WebCrypto; survives DMCA takedowns |
| Nostr discovery (NIP-C0) | Next | 35.2 | 30 KB nostr-tools; smallest federation protocol; uncensorable |
| did:key author signatures | Now | 35.3 | Zero new deps; native crypto.subtle; impersonation prevention |
| ActivityPub passive consumption | Next | 35.4 | Plain HTTP GET to Forgejo outboxes; push-style update notifications |
| Self-hosted registry spec | Next | 35.5 | Open spec + Go reference impl; enables corporate + community registries |
| Censorship-resistant update resolution | Next | 35.6 | IPFS → Nostr → Wayback fallback chain; signature-verified |

### Rejected — Phase 35 Federation (With Documented Reasoning)

| Item | Why Rejected |
|------|--------------|
| Matrix as sync transport | 500 KB SDK; users prefer dedicated sync (Phase 21); link as community-only |
| Solid Pods | 300 KB SDK; <0.1% userscript-author overlap with Solid community |
| DAT/Hypercore/Pear runtime | Requires separate Pear runtime install — hard userscript user no |
| WebRTC mesh sync (y-webrtc) | 605 KB Yjs accepted in 29.4; mesh adds NAT complexity for marginal benefit |
| WebTorrent | 600 KB; userscripts <100 KB — wrong scale for BitTorrent |
| Helia (in-browser IPFS node) | 200 KB+ DHT; gateway fallback (35.1) achieves 95% value at 0% weight |
| Full Verifiable Credentials | 300 KB JSON-LD; DIDs alone (35.3) sufficient for threat model |
| Radicle P2P git | Requires `rad` binary install — userscript users won't install |
| AT Protocol custom Lexicon | Maintenance burden; defer until Bluesky userscript community materializes |

### Rejected — With Reasoning (Continued)
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
| AI Agent / MCP integration (ScriptCat v1.4.0-beta) | ScriptCat v1.4.0-beta ships an AI Agent with MCP integration for generating and debugging scripts. Explicitly contradict's ScriptVault's anti-bloat philosophy (see CLAUDE.md deleted features). Rejected — not this project's mission. |
| GM_webRequest (MV3) | Permanently dropped from Chrome MV3; TM v5.2+ removed it. `chrome.declarativeNetRequest` does not support per-request callbacks. Structural blocker. Rejected as MV3 architectural impossibility. |
| Full OPFS migration (replace IDB entirely) | OPFS is ideal for large binary file storage but cannot serve as the metadata/index layer efficiently. IDB must remain as the metadata and query layer. Rejected for IDB replacement; OPFS used only as overflow for large script bodies (Phase 18.2). |
| ClickRemix / AI-powered userscript generation | HN 2025 product hunt; AI writes userscripts from natural-language prompts. Validates market demand but directly contradicts ScriptVault's stated philosophy. Rejected per philosophy. |
| GM_wsConnectTo (TM #1483) | WebSocket proxy bypass via extension background; very niche use (scripts blocked from WebSocket by CSP). No active demand in ScriptVault tracker. Under Consideration for later phase if demand emerges. |
| Anonymous XHR credential stripping | TM documents `anonymous: true` to strip cookies/credentials from GM_xmlhttpRequest. Low demand signal beyond existing `anonymous` mode in VM. Under Consideration as trivial addition to Phase 16. |
