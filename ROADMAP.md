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
```

### Suggested Execution Order
1. **Phase 0** — Unblocks everything
2. **Phase 1** (waves 1-3) — TypeScript for modules and background
3. **Phase 4** — URL matcher (high bug density, self-contained)
4. **Phase 2** — Storage rewrite (enables phases 3, 8, 9)
5. **Phase 5** — Security (can run partially in parallel with 2)
6. **Phase 3** — Service worker resilience (depends on Phase 2)
7. **Phase 1** (waves 4-5) — TypeScript for pages/dashboard
8. **Phase 7** — Dashboard UX (depends on TypeScript pages)
9. **Phase 6** — Update system (depends on storage rewrite)
10. **Phase 8** — Sync rewrite (depends on storage rewrite)
11. **Phase 9** — Migration system (depends on storage rewrite)
12. **Phase 10** — Testing (continuous, ramps up each phase)

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
