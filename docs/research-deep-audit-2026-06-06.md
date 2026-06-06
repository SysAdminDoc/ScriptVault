# Project Research and Feature Plan — Deep Audit Round

> Companion research file for ScriptVault v3.11.0.
> Date: 2026-06-06.
> Scope: Multi-agent deep audit covering architecture, UX/accessibility,
> security, testing/performance, and build/CI/ecosystem. This supplements
> `RESEARCH_FEATURE_PLAN.md` (2026-06-05) and `ROADMAP.md` (Round 15,
> 2026-06-05) with findings those passes did not cover.

---

## Executive Summary

ScriptVault is a mature MV3 userscript manager with exceptional breadth — 35+
GM APIs, 7 cloud sync providers, Monaco editor, DevTools panel, side panel,
Ed25519 signing, AST analysis, import quarantine, and a 1400+ test suite with
30+ CI gate scripts. Its competitive position is uniquely strong: Tampermonkey
was removed from CWS, Violentmonkey is dead on Chrome (MV2-only), and ScriptCat
is the only comparable MV3 alternative (4.5K stars, privacy concerns).

This deep audit uncovered **42 actionable findings** across 5 dimensions that
the existing Round 15 ROADMAP and companion research plan did not cover:

**Top 10 highest-value opportunities (priority order):**

1. **P0/Security**: `GM_addElement` `srcdoc` attribute bypass allows iframe
   script injection (CWE-79, High severity)
2. **P0/Security**: `@crontab` scripts execute in ISOLATED world with extension
   API access instead of USER_SCRIPT world (CWE-269, High severity)
3. **P0/Security**: `PublicAPI.isInternalHost` is out of sync with
   `InternalHostGuard` — missing `.localhost` TLD, TEST-NET ranges, IPv6 hex
   (CWE-918, Medium severity)
4. **P1/Architecture**: `core.ts` has `@ts-nocheck` — the largest file (12,748
   lines, 20+ responsibilities) entirely opts out of type checking
5. **P1/Architecture**: 7+ copies of `escapeHtml`, 4+ copies of `formatBytes`
   across dashboard modules — duplication accumulates because the concatenation
   build has no import enforcement
6. **P1/UX**: Catppuccin and OLED themes are completely missing from sidepanel
   and DevTools panel — users on those themes see a jarring mismatch
7. **P1/Testing**: `offscreen.js` (27KB, AST analysis + merge) and
   `sidepanel.js` (37KB) have zero test coverage
8. **P1/Build**: No `workflow_dispatch` release workflow — publishing is entirely
   manual via `bash publish.sh`, inconsistent with the CI/CD standard
9. **P2/UX**: All font sizes in px (zero rem usage) — extension ignores browser
   font-size preferences entirely
10. **P2/Performance**: `background.js` at 1.1MB — typed modules ship as dead
    weight alongside inlined copies in core.ts, inflating the service worker
    parse cost

---

## Evidence Reviewed

**Local files inspected by 5 parallel research agents:**

- `src/background/core.ts` (12,748 lines — sampled at start, middle, end;
  grepped for responsibilities, duplication, error handling, concurrency)
- `src/background/wrapper-builder.ts` (1,470 lines — GM_addElement sanitizer,
  wrapper code generation, @connect enforcement)
- `src/types/messages.ts` (1,559 lines — 130+ typed actions vs 263 runtime
  cases)
- `esbuild.config.mjs` (full read — concatenation pipeline, Monaco copy,
  production minification)
- `content.js` (215 lines — full read, bridge security, message forwarding)
- `offscreen.js` (27KB — AST analysis, merge operations)
- `modules/public-api.js` (full read — rate limiting, origin validation,
  isInternalHost)
- `modules/sync-providers.js` (sync envelope handling, token lifecycle)
- `modules/storage.js` (1,225 lines — IndexedDB patterns, transaction handling)
- `pages/dashboard.js` (5,190 lines — empty states, loading, error handling)
- `pages/popup.js` (773 lines — script list, empty state, i18n)
- `pages/sidepanel.js` (387+ lines — theme handling, search, accessibility)
- `pages/install.js` (875 lines — trust card, permissions, ARIA)
- `pages/devtools-panel.js` (DevTools panel, theme definitions)
- `pages/dashboard-a11y.js` (WCAG module, skip links, live regions)
- `pages/dashboard-lazy-loader.js` (lazy loading effectiveness)
- `pages/dashboard-heatmap.js`, `dashboard-debugger.js` (innerHTML usage)
- All 27 `pages/dashboard-*.js` modules (escapeHtml duplication scan)
- `_locales/en/messages.json` + `ja`, `de`, `fr` locale files
- All CSS in `dashboard.html`, `popup.html`, `sidepanel.html`, `install.html`,
  `devtools-panel.html` (theme variables, px vs rem, focus indicators)
- `tests/setup.js`, `vitest.config.mjs`, `playwright.config.mjs`
- `tests/core-flows.test.js`, `tests/storage.test.js` (quality assessment)
- All 128 test files (coverage matrix against src/ modules)
- `.github/workflows/ci.yml` (30 CI steps)
- `build.sh`, `build-firefox.sh`, `publish.sh` (packaging/release)
- All 30 scripts in `scripts/`
- `manifest.json`, `manifest-firefox.json`,
  `manifest-firefox.transformations.json`
- `package.json`, `.gitignore`, `.gitattributes`, `CONTRIBUTING.md`
- `README.md`, `CHANGELOG.md`, `docs/` (37 files)

**Codebase-wide greps:**

- `escapeHtml` (7+ definitions), `formatBytes` (4 definitions),
  `sanitizeUrl` (1 definition — properly centralized)
- `chrome.storage.local.get` (232 occurrences across 72 files)
- `catch\s*\{` (84 empty catch blocks in src/)
- `innerHTML` (XSS surface scan), `eval(`, `new Function`, `postMessage`
- `aria-` (555 occurrences), `role=` (128), `tabindex` (29)
- `setTimeout`, `setInterval`, `JSON.stringify`, `objectStore`, `transaction`
- `TODO`, `FIXME`, `HACK` (zero in own code; 3 in vendored fflate.js)
- `test.skip`, `test.todo` (zero — no deferred tests)
- `rem` font sizes (zero across all pages)

**External sources:**

- Tampermonkey v5.5.0 changelog (MCP, enterprise provisioning)
- Violentmonkey v2.41.0 (MV2-only, 8.3K stars)
- ScriptCat (4.5K stars, background scripts, cloud sync)
- chrome.userScripts API Chrome 138+ (toggle change, no new methods)
- Navigation API (87.95% global coverage, Baseline Jan 2026)
- Monaco v0.53+ AMD deprecation

---

## Feature Inventory Updates

### Features with duplication or quality issues not previously documented:

| Feature | Maturity | Issue Found |
|---------|----------|-------------|
| Theme system | **Partial** | Catppuccin + OLED missing from sidepanel and DevTools |
| i18n | **Partial** | Popup, sidepanel, install, DevTools all hardcoded English |
| escapeHtml | **Fragmented** | 7+ copies across dashboard modules |
| formatBytes | **Fragmented** | 4 copies with behavioral differences |
| Settings access | **Fragmented** | 232 direct chrome.storage.local calls bypass SettingsManager |
| Install page a11y | **Weak** | Only 1 aria-label; decisionHero not aria-live |
| DevTools empty states | **Missing** | No empty state for zero network/console entries |
| Offscreen document tests | **Missing** | Zero test coverage for 27KB AST/merge module |
| Sidepanel tests | **Missing** | Zero test coverage for 37KB module |

---

## Competitive and Ecosystem Research

### Tampermonkey v5.5.0 (2026-05-08)
- **MCP Integration**: Model Context Protocol for AI tool integration via
  companion "Tampermonkey Editors" extension + npm package. ScriptVault has this
  as L-3 on the roadmap.
- **Enterprise Provisioning**: OS policy-based script distribution via
  `chrome.storage.managed`. ScriptVault has this as L-1.
- **What to learn**: MCP and enterprise provisioning are real differentiators
  for corporate adoption. ScriptVault should prioritize L-1 and L-3 if
  targeting enterprise/power-user segments.
- **What to avoid**: Tampermonkey is closed-source and was removed from CWS.
  ScriptVault's open-source MIT license and CWS presence are its strongest
  competitive advantages.

### Violentmonkey v2.41.0 (2026-05-31)
- Still MV2-only. 8.3K GitHub stars.
- MV3 PR #2399 status unclear — no MV3 release.
- **Dead on Chrome** (MV2 delisted, cannot install on Chrome 133+).
- **What to learn**: VM has strong community goodwill. ScriptVault should
  capture VM refugees with a migration/import path that handles VM export
  format.

### ScriptCat (4.5K stars)
- MV3 native, published on CWS and AMO.
- Killer feature: background/cron scripts without open tabs.
- Cloud sync, scheduled tasks, built-in editor with ESLint.
- **What to learn**: Background scripts are the one feature where ScriptCat
  leads. ScriptVault's X-2 roadmap item (DOM-less @background scripts) is
  the right response, but the CWS remote-code compliance blocker is real.
- **What to avoid**: ScriptCat has privacy concerns and stability complaints.
  ScriptVault's trust-first approach (quarantine, signing, provenance) is a
  stronger positioning.

### Platform Capabilities (June 2026)
- **chrome.userScripts Chrome 138+**: Toggle moved from Developer Mode to
  dedicated per-extension toggle. No new API methods.
- **Navigation API**: 87.95% global coverage, Baseline Jan 2026. Chrome 102+,
  Edge 102+, Firefox 147+, Safari 26.2+. ScriptVault's X-3 roadmap item is
  well-timed.
- **Monaco v0.53+**: AMD deprecated. ESM migration documented in
  `docs/monaco-esm-migration-plan.md`. Decision to keep AMD for v3.12.0 is
  sound.

---

## Highest-Value New Features

### NF-1. Sync Envelope Integrity Verification
- **User problem**: Unencrypted sync data (the default) has no integrity
  verification. A compromised cloud storage account can inject malicious
  scripts that auto-execute on next sync.
- **Evidence**: Security agent Finding 4 (CWE-345). `_performSync` downloads
  JSON, parses scripts, saves to ScriptStorage, and registers for execution
  without any HMAC/signature/checksum.
- **Proposed behavior**: Compute HMAC-SHA256 over the sync envelope body using
  a key derived from the user's signing keypair. Verify on download before
  import. Show a warning if verification fails with option to proceed.
- **Implementation areas**: `src/background/cloud-sync.ts` (envelope write/read),
  `src/modules/sync-crypto.ts` (HMAC computation), dashboard sync status UI.
- **Risks**: Key rotation; first sync from a new device; migration from
  unsigned envelopes.
- **Verification**: Unit test with tampered envelope → rejection; E2E test
  with WebDAV sync round-trip.
- **Complexity**: M | **Priority**: P1

### NF-2. Release Workflow (workflow_dispatch)
- **User problem**: Publishing is entirely manual (`bash publish.sh`). No CI/CD
  automation for tagging, building, and publishing to CWS/AMO/Edge.
- **Evidence**: Build/CI agent. The project's own `CLAUDE.md` CI/CD standard
  says "Trigger: `on: workflow_dispatch` (manual)" but no such workflow exists.
- **Proposed behavior**: `.github/workflows/release.yml` with
  `workflow_dispatch` trigger, version input, automated: version bump, tag,
  build all 3 browser packages, run all gates, publish to CWS (with rollout %),
  create GitHub Release with artifacts.
- **Implementation areas**: `.github/workflows/release.yml` (new), `publish.sh`
  (refactor for CI invocation), `build-firefox.sh`, `scripts/build-edge.mjs`.
- **Risks**: Credential management in GitHub Secrets; CWS review delays.
- **Verification**: Dry-run workflow dispatch that builds and uploads artifacts
  without publishing.
- **Complexity**: L | **Priority**: P1

### NF-3. Shared Include List for Build Scripts
- **User problem**: Adding a new file to the extension requires editing 4
  separate include lists (`build.sh`, `publish.sh`, `build-firefox.sh`,
  `scripts/build-edge.mjs`). A missed update silently drops the file from
  one browser's package.
- **Evidence**: Build/CI agent. All 4 scripts maintain near-identical INCLUDE
  arrays independently.
- **Proposed behavior**: Single `build-includes.json` file listing all
  extension files. All build scripts read from it. CI gate verifies the list
  matches the actual file tree.
- **Implementation areas**: New `build-includes.json`, modifications to all 4
  build scripts, new `scripts/check-build-includes.mjs`.
- **Risks**: Firefox and Edge intentionally exclude some files (offscreen,
  Monaco, sandbox). The JSON should support per-browser overrides.
- **Verification**: `npm run build-includes:check` gate in CI.
- **Complexity**: M | **Priority**: P2

---

## Existing Feature Improvements

### EI-1. Fix `GM_addElement` `srcdoc` Bypass (SECURITY)
- **Current behavior**: `_isUnsafeElementAttribute` checks `_urlAttrs` (href,
  src, action, etc.) and `on*` event handlers. `srcdoc` is not in either list.
- **Problem**: `srcdoc` on `<iframe>` accepts raw HTML that executes in the
  parent's origin. A script can inject `<iframe srcdoc="<script>...</script>">`
  to run arbitrary code in the page context.
- **Recommended change**: Add `srcdoc` to `_urlAttrs` in
  `src/background/wrapper-builder.ts` (line ~1124) and its runtime counterpart
  `background.core.js` (line ~11836). Block or sanitize the value.
- **Code locations**: `src/background/wrapper-builder.ts:1124-1131`,
  `background.core.js:11836-11841`
- **Backward compatibility**: Scripts using `GM_addElement('iframe', {srcdoc})`
  will break. This is acceptable for a security fix. Document in CHANGELOG.
- **Verification**: Unit test: `GM_addElement('iframe', {srcdoc: '<script>...'})` →
  `srcdoc` attribute blocked or sanitized.
- **Complexity**: S | **Priority**: P0

### EI-2. Fix `@crontab` World Escalation (SECURITY)
- **Current behavior**: `@crontab` execution uses `chrome.scripting.executeScript`
  with `world: 'ISOLATED'`, giving userscript code access to Chrome extension
  APIs.
- **Problem**: Scripts with `@crontab` metadata can read `chrome.storage.local`
  (including OAuth tokens, signing keys) and call other privileged APIs.
- **Recommended change**: Use `chrome.userScripts.register()` for crontab
  scripts instead of `chrome.scripting.executeScript`, matching the USER_SCRIPT
  world used for normal page-load execution.
- **Code locations**: `background.core.js:8216-8221`,
  `src/background/core.ts` (crontab alarm handler)
- **Backward compatibility**: Crontab scripts that accidentally depend on
  `chrome.*` APIs will break. This is the correct behavior.
- **Verification**: Test: crontab script calling `chrome.storage.local.get` →
  throws (undefined).
- **Complexity**: M | **Priority**: P0

### EI-3. Sync `PublicAPI.isInternalHost` with `InternalHostGuard`
- **Current behavior**: `public-api.js` has its own `isInternalHost` copy
  missing `.localhost` TLD, TEST-NET ranges, IPv6 hex form, and Class E
  blocking that `InternalHostGuard` already implements.
- **Problem**: `evil.localhost` bypasses the PublicAPI check, enabling SSRF
  from a trusted origin's web install URL.
- **Recommended change**: Import `InternalHostGuard` instead of maintaining a
  separate copy. Or replicate all Wave 3 additions.
- **Code locations**: `modules/public-api.js:61-97`,
  `src/modules/public-api.ts` (if promoted),
  `modules/internal-host-guard.js` (reference)
- **Verification**: Unit test: `isInternalHost('evil.localhost')` → `true`.
- **Complexity**: S | **Priority**: P0

### EI-4. Add Catppuccin + OLED Themes to Sidepanel and DevTools
- **Current behavior**: Sidepanel and DevTools panel only define `dark` and
  `light` themes. Users on Catppuccin or OLED see the `:root` dark fallback,
  creating a jarring mismatch with the dashboard and popup.
- **Problem**: Real users who pick Catppuccin or OLED see inconsistent colors
  between surfaces.
- **Recommended change**: Copy the `[data-theme="catppuccin"]` and
  `[data-theme="oled"]` CSS variable blocks from `popup.html` into
  `sidepanel.html` and `devtools-panel.html`.
- **Code locations**: `pages/sidepanel.html` (CSS section),
  `pages/devtools-panel.html` (CSS section), reference: `pages/popup.html`
  theme definitions
- **Verification**: Sideload extension, set theme to Catppuccin, open sidepanel
  → colors match popup/dashboard.
- **Complexity**: S | **Priority**: P1

### EI-5. Add `aria-live` to Install Page Trust Card
- **Current behavior**: The install page's `decisionHero` element shows
  real-time trust evaluation results (scanning → ready/needs review) but has
  no `aria-live` attribute.
- **Problem**: Screen readers do not announce when analysis results change.
  The install page has only 1 `aria-label` total — weakest accessibility of
  all surfaces.
- **Recommended change**: Add `aria-live="polite"` and `role="status"` to the
  `decisionHero` element. Add `aria-label` to trust card sections and the
  permission grid.
- **Code locations**: `pages/install.html` (template), `pages/install.js`
  (lines 304-403, decision hero rendering)
- **Verification**: `npm run test:a11y` with install page fixtures.
- **Complexity**: S | **Priority**: P1

### EI-6. Centralize `escapeHtml` Across Dashboard Modules
- **Current behavior**: 7+ copies of `escapeHtml` across dashboard modules,
  each re-declaring the same function inside their IIFE despite
  `shared/utils.js` already being loaded in the same page scope.
- **Problem**: `dashboard-csp.js` uses a subtly different DOM-based
  implementation. Duplication makes security fixes hard to propagate.
- **Recommended change**: Remove local `escapeHtml` declarations from all
  dashboard modules. Use the global `escapeHtml` from `shared/utils.js`
  (already loaded via `dashboard.html`). Unify the CSP module's DOM-based
  variant.
- **Code locations**: `pages/dashboard-collections.js:617`,
  `pages/dashboard-cardview.js:669`, `pages/dashboard-depgraph.js:943`,
  `pages/dashboard-csp.js:464`, `pages/dashboard-sharing.js:1111`,
  `pages/dashboard-store.js:938`, `pages/dashboard-gist.js:45`,
  `pages/devtools-panel.js:571`
- **Verification**: `npm run build && npm run test` — no regressions.
  Manual: open each dashboard tab, verify rendering.
- **Complexity**: S | **Priority**: P1

### EI-7. Centralize `formatBytes`
- **Current behavior**: 4+ copies with behavioral differences. The
  `backup-scheduler.ts` variant truncates at MB — backups exceeding 1GB show
  incorrectly formatted sizes.
- **Recommended change**: Import from `src/shared/utils.ts` in all locations.
  Remove the `_formatBytes` copy from `backup-scheduler.ts:390`.
- **Code locations**: `src/shared/utils.ts:107` (canonical),
  `src/background/fetch-bounded.ts:10`, `src/modules/backup-scheduler.ts:390`,
  `pages/dashboard.js:9126`, `pages/devtools-panel.js:564`,
  `pages/dashboard-collections.js:633`
- **Verification**: Unit test: `formatBytes(1.5 * 1024**3)` → `"1.50 GB"`
  (not truncated to MB).
- **Complexity**: S | **Priority**: P2

### EI-8. Raise Coverage Thresholds
- **Current behavior**: `vitest.config.mjs` sets thresholds at
  `lines: 10%, functions: 10%, branches: 5%`. With 1416 tests, actual
  coverage is far higher.
- **Problem**: These thresholds are meaningless as quality gates — they
  prevent zero-coverage but not coverage backsliding.
- **Recommended change**: Run `npm run test:cov` to measure actual coverage,
  then set thresholds to ~80% of current values (ratchet pattern).
- **Code locations**: `vitest.config.mjs` (coverage section)
- **Verification**: `npm run test:cov` passes with new thresholds.
- **Complexity**: S | **Priority**: P2

### EI-9. Fix `publish.sh` `--draft` Flag Parsing
- **Current behavior**: Line 140 checks only `$1` for `--draft`. Running
  `bash publish.sh --some-flag --draft` silently publishes live.
- **Recommended change**: Check all positional args or use a proper getopts
  loop.
- **Code locations**: `publish.sh:140`
- **Verification**: `bash publish.sh --verbose --draft` triggers draft mode.
- **Complexity**: S | **Priority**: P2

### EI-10. Add `set -euo pipefail` to `build.sh`
- **Current behavior**: `build.sh` uses only `set -e`. `build-firefox.sh`
  uses `set -euo pipefail`.
- **Problem**: A piped command failure in `build.sh` could be silently
  swallowed.
- **Recommended change**: Add `set -euo pipefail` to `build.sh:5`.
- **Complexity**: S | **Priority**: P3

### EI-11. Pin `monaco-editor` Version Exactly
- **Current behavior**: `package.json` uses `^0.52.0` (range) for
  `monaco-editor`, but the package is bundled into `lib/monaco-esm/`.
- **Problem**: A fresh `npm ci` with a new lockfile could pull 0.53.x, which
  ships different editor code. `acorn` and `diff` are correctly pinned exact.
- **Recommended change**: Change to exact pin: `"monaco-editor": "0.52.2"`.
- **Code locations**: `package.json` line 80
- **Verification**: `npm ls monaco-editor` shows exact version.
- **Complexity**: S | **Priority**: P3

---

## Reliability, Security, Privacy, and Data Safety

### Security Findings (Wave 4)

| # | Severity | CWE | Finding | Status |
|---|----------|-----|---------|--------|
| S1 | **High** | CWE-79 | `srcdoc` bypass in `GM_addElement` | New — fix in EI-1 |
| S2 | **High** | CWE-269 | `@crontab` ISOLATED world escalation | Known (CLAUDE.md) — fix in EI-2 |
| S3 | **Medium** | CWE-918 | PublicAPI `isInternalHost` parity gap | New — fix in EI-3 |
| S4 | **Medium** | CWE-345 | Unencrypted sync no integrity verification | New — fix in NF-1 |
| S5 | **Medium** | CWE-200 | XHR response broadcast via `postMessage('*')` | Architectural |
| S6 | **Low** | CWE-79 | `dashboard-heatmap.js`, `dashboard-debugger.js` missing `escapeHtml` | New |
| S7 | **Low** | CWE-770 | Rate limiter `_rateLimitMap` unbounded under distributed attack | New |
| S8 | **Low** | CWE-79 | `<style>` injection via `GM_addElement` innerHTML | New |

**S5 detail**: Content script forwards XHR events from background to
userscript world via `window.postMessage({...}, '*')`. Any page script can
observe these messages by listening for `message` events and filtering for the
known channel format (`ScriptVault_<extension-id>`). This exposes cross-origin
API responses (the entire purpose of `GM_xmlhttpRequest`) to malicious scripts
on the same page. Mitigation: use `chrome.runtime` messaging to USER_SCRIPT
world instead of `postMessage`, or encrypt the channel. This is an
architectural concern that requires careful design.

**S6 detail**: `dashboard-heatmap.js` and `dashboard-debugger.js` use
`.innerHTML` without importing or defining `escapeHtml`. The debugger's `el()`
helper accepts `html` as a key for raw innerHTML. Current risk is low (data is
mostly internal) but this is a latent XSS vector.

### Known Follow-ups from Prior Audits (still open)

From CLAUDE.md Wave 3 follow-ups (2026-06-04):
- Cloud sync uploads stale pre-merge data (BUG-2)
- Cloud sync omits `syncBaseCode` from upload envelope (BUG-3)
- `compareVersions` treats pre-releases as equal
- Toggle/save race: no cross-operation mutex

---

## UX, Accessibility, and Trust

### Theme Consistency
- **Sidepanel** and **DevTools panel** define only `dark` and `light`. All 4
  themes are defined in popup, install, and dashboard. Fix in EI-4.

### Font Accessibility
- **Zero rem usage** across all pages. Every font-size is hardcoded in `px`.
  The extension ignores browser font-size preferences. The dashboard's zoom
  control (85%-150%) partially compensates, but popup and sidepanel have no
  zoom control. CLAUDE.md already notes this as known.
- **Recommendation**: Convert body/text sizes to `rem`. At minimum: popup body
  (`14px` → `0.875rem`), sidepanel body (`13px` → `0.8125rem`).
- **Complexity**: M | **Priority**: P2

### i18n Coverage
- `_locales/en/messages.json` contains only ~25 keys (manifest minimum).
- The `dashboard-i18n-v2.js` module covers 600 keys for 8 languages.
- **Popup, sidepanel, install page, and DevTools panel are not wired to the
  i18n system.** All user-facing strings are hardcoded English.
- Examples: popup.js:301 `'Find trusted scripts...'`, popup.js:725
  `'Delete'`/`'Confirm Delete'`, install.js:637 `'Update Script'`, etc.
- **Impact**: The extension is functionally English-only outside the
  dashboard's v2 module surface.
- **Complexity**: L | **Priority**: P2

### Empty/Loading/Error States
- **Dashboard**: Well-implemented — 3 contextual empty states with actions.
- **Popup**: Good — context-aware hint with current hostname.
- **Sidepanel**: Good — distinct search-no-results vs. no-scripts states.
- **DevTools panel**: **Missing** — shows raw empty containers when zero
  network requests or console entries have been captured.
- **Dashboard main table**: No loading skeleton during initial load.

### Install Page Accessibility
- Only 1 `aria-label` and 3 `aria-*` attributes in the HTML template.
- The `decisionHero` and its children lack `role="status"` and `aria-live`.
- Screen readers don't announce when analysis changes from "Scanning" to
  "Ready" or "Needs review". Fix in EI-5.

### Confirmation Dialogs
- Well-implemented across dashboard (bulk delete, folder delete, disconnect,
  settings reset, key removal, trash empty all use `showConfirmModal`).
- Popup uses two-tap delete pattern (first tap → "Confirm Delete", second
  executes). Functional but unconventional.

---

## Architecture and Maintainability

### core.ts — The Monolith

`src/background/core.ts` is 12,748 lines with **`@ts-nocheck` on line 1** — the
only file in `src/` with this directive. It carries 20+ responsibilities
including a 2,852-line `handleMessage` switch with 263 cases.

**The typed modules paradox**: Typed modules in `src/background/` (parser.ts,
url-matcher.ts, wrapper-builder.ts, cloud-sync.ts, etc.) are a parallel
modernization effort. They are compiled to JS, concatenated into `background.js`
alongside core.ts's copies of the same logic, and **both copies ship**. This
means:

1. The typed modules add ~4,000+ lines to the bundle without replacing
   anything.
2. The types in `messages.ts` are never enforced at the point where messages
   are actually handled (core.ts opts out of type checking).
3. `url-matcher.ts` exports 9 functions; all 9 are also defined inline in
   core.ts at lines 7296-12737.

**Recommendation**: The path forward is to make the typed modules the actual
runtime (not parallel copies) and reduce core.ts to a thin dispatch layer. This
requires migrating the build from concatenation to ESM bundling. This is the
single highest-impact architectural improvement but is also the highest-risk
refactor in the codebase.

**Complexity**: XL | **Priority**: P1 (but should be staged across multiple
releases)

### handleMessage Decomposition

The 263-case switch could be split into domain handlers:

| Domain | Estimated Cases | Handler |
|--------|----------------|---------|
| Script CRUD | ~40 | `handleScriptMessage` |
| GM_* APIs | ~50 | `handleGmApiMessage` |
| Sync/cloud | ~20 | `handleSyncMessage` |
| Settings | ~15 | `handleSettingsMessage` |
| Backup/restore | ~10 | `handleBackupMessage` |
| UI/navigation | ~30 | `handleUiMessage` |
| Update/install | ~15 | `handleUpdateMessage` |
| Debug/diagnostic | ~20 | `handleDebugMessage` |
| Telemetry | ~10 | `handleTelemetryMessage` |
| Remaining | ~53 | core handler |

This can be done incrementally without changing the build system.

**Complexity**: L | **Priority**: P2

### Direct Storage Access (232 calls across 72 files)

Dashboard modules bypass `chrome.runtime.sendMessage` and read/write
`chrome.storage.local` directly. This creates a dual data-access pattern:
settings can be read from both the `SettingsManager` cache (via background
message) and raw storage (via direct access), with no cache invalidation
coordination.

**Impact**: Stale reads are possible when settings change — the background
updates its cache, but a dashboard module reading storage directly sees the
old value until Chrome flushes the write.

**Recommendation**: Dashboard modules should use `chrome.runtime.sendMessage`
for settings access. Direct storage access should be limited to the background
service worker.

**Complexity**: L | **Priority**: P3

### Error Handling

84 empty catch blocks in `src/`. Most are intentional cleanup suppressions
(reader.cancel, tx.abort, db.close), but ~15 are on data-path logic in core.ts
where failures could leave state inconsistent. 11 catch-and-log-only blocks
in init paths mean the extension can start in a degraded state without
surfacing the issue.

**Recommendation**: Add a degraded-mode indicator (e.g., a warning badge or
dashboard banner) when any init-path subsystem fails to load.

**Complexity**: M | **Priority**: P3

### Test Infrastructure Issues

1. **core-flows.test.js re-implements source functions** (parseUserscript,
   formatBytes) locally instead of importing the actual modules. If production
   code drifts from the re-implementation, tests still pass.
2. **Coverage thresholds** at 10/10/5 are meaningless. See EI-8.
3. **Coverage scope** only covers `src/` — the generated JS runtime
   (`background.core.js`, `pages/*.js`) is excluded.
4. **E2E coverage**: Only 5 Playwright specs (install, restore, sync, update,
   value-change). No E2E for dashboard interaction, popup flows, sidepanel,
   or DevTools.

---

## Prioritized Roadmap

### Phase 1: Security Fixes (P0)

- [ ] P0 - EI-1: Block `srcdoc` attribute in `GM_addElement`
  - Why: High-severity XSS bypass allowing iframe script injection
  - Evidence: Security agent Finding 2 (CWE-79)
  - Touches: `src/background/wrapper-builder.ts:1124-1131`,
    `background.core.js:11836-11841`
  - Acceptance: `GM_addElement('iframe', {srcdoc: '...'})` → srcdoc blocked
  - Verify: `npm test` with new unit test for srcdoc rejection

- [ ] P0 - EI-2: Fix `@crontab` world escalation
  - Why: High-severity privilege escalation — userscripts get extension API access
  - Evidence: Security agent Finding 3 (CWE-269), CLAUDE.md known follow-up
  - Touches: `background.core.js:8216-8221`, `src/background/core.ts` crontab handler
  - Acceptance: `@crontab` scripts run in USER_SCRIPT world, `chrome.*` APIs
    are undefined
  - Verify: Unit test: crontab wrapper does not expose chrome.storage

- [ ] P0 - EI-3: Sync `PublicAPI.isInternalHost` with `InternalHostGuard`
  - Why: SSRF via `evil.localhost` bypassing the PublicAPI check
  - Evidence: Security agent Finding 1 (CWE-918)
  - Touches: `modules/public-api.js:61-97`, `src/modules/public-api.ts`
  - Acceptance: `isInternalHost('evil.localhost')` → `true`
  - Verify: `npm test` with tests for `.localhost`, TEST-NET, IPv6 hex

### Phase 2: Trust & Data Safety (P1)

- [ ] P1 - NF-1: Sync envelope integrity verification
  - Why: Compromised cloud storage can inject auto-executing malicious scripts
  - Evidence: Security agent Finding 4 (CWE-345)
  - Touches: `src/background/cloud-sync.ts`, `src/modules/sync-crypto.ts`,
    dashboard sync UI
  - Acceptance: Tampered sync envelope → rejection with user warning
  - Verify: Unit test with modified envelope bytes → HMAC mismatch

- [ ] P1 - EI-4: Add Catppuccin + OLED themes to sidepanel and DevTools
  - Why: Users on non-default themes see jarring color mismatches
  - Evidence: UX agent Finding 1
  - Touches: `pages/sidepanel.html`, `pages/devtools-panel.html`
  - Acceptance: Catppuccin/OLED theme selected → all surfaces match
  - Verify: Manual: set theme to Catppuccin, open sidepanel

- [ ] P1 - EI-5: Add `aria-live` to install page trust card
  - Why: Screen readers don't announce trust evaluation changes
  - Evidence: UX agent Finding 8
  - Touches: `pages/install.html`, `pages/install.js:304-403`
  - Acceptance: Screen reader announces "Ready" / "Needs review" state changes
  - Verify: `npm run test:a11y`

- [ ] P1 - EI-6: Centralize `escapeHtml`
  - Why: 7+ copies, one with different behavior; security fix propagation risk
  - Evidence: Architecture agent Finding 3
  - Touches: 8 dashboard module files, `pages/devtools-panel.js`
  - Acceptance: Zero local `escapeHtml` definitions in dashboard modules
  - Verify: `npm run build && npm test`; grep for `function escapeHtml` in pages/

- [ ] P1 - NF-2: Release workflow (workflow_dispatch)
  - Why: Publishing is entirely manual; inconsistent with CI/CD standard
  - Evidence: Build/CI agent
  - Touches: `.github/workflows/release.yml` (new), `publish.sh`
  - Acceptance: `workflow_dispatch` with version input builds + publishes
  - Verify: Dry-run dispatch that builds artifacts without publishing

- [ ] P1 - Add tests for `offscreen.js` (27KB)
  - Why: AST analysis + merge module has zero test coverage
  - Evidence: Test agent coverage matrix
  - Touches: `tests/offscreen.test.js` (new), `offscreen.js`
  - Acceptance: Message interface contract tests for all `offscreen_*` types
  - Verify: `npm test`

- [ ] P1 - Add tests for `sidepanel.js` (37KB)
  - Why: Full UI module with zero unit or E2E tests
  - Evidence: Test agent coverage matrix
  - Touches: `tests/sidepanel.test.js` (new), `pages/sidepanel.js`
  - Acceptance: Script list rendering, search, theme application tests
  - Verify: `npm test`

### Phase 3: Polish & Correctness (P2)

- [ ] P2 - EI-7: Centralize `formatBytes`
  - Why: backup-scheduler variant truncates at MB; 4 inconsistent copies
  - Evidence: Architecture agent Finding 3
  - Touches: `src/modules/backup-scheduler.ts:390`,
    `src/background/fetch-bounded.ts:10`, dashboard/devtools pages
  - Acceptance: All `formatBytes` calls use `shared/utils.ts` canonical version
  - Verify: `npm test`; unit test: `formatBytes(1.5 * 1024**3)` → `"1.50 GB"`

- [ ] P2 - EI-8: Raise coverage thresholds
  - Why: Current 10/10/5 thresholds are meaningless as quality gates
  - Evidence: Test agent
  - Touches: `vitest.config.mjs`
  - Acceptance: Thresholds set to ~80% of measured coverage (ratchet)
  - Verify: `npm run test:cov`

- [ ] P2 - EI-9: Fix `publish.sh` `--draft` flag parsing
  - Why: `bash publish.sh --verbose --draft` silently publishes live
  - Evidence: Build/CI agent
  - Touches: `publish.sh:140`
  - Acceptance: `--draft` detected in any position
  - Verify: Manual: `bash publish.sh --verbose --draft` → draft mode

- [ ] P2 - NF-3: Shared build include list
  - Why: 4 separate include lists; missing a file silently drops it
  - Evidence: Build/CI agent
  - Touches: `build-includes.json` (new), `build.sh`, `publish.sh`,
    `build-firefox.sh`, `scripts/build-edge.mjs`
  - Acceptance: Single JSON drives all build scripts
  - Verify: `npm run build-includes:check`

- [ ] P2 - Migrate font sizes from px to rem
  - Why: Extension ignores browser font-size preferences
  - Evidence: UX agent Finding 2; CLAUDE.md known issue
  - Touches: All `.html` files in `pages/`
  - Acceptance: Body/text sizes use rem; zoom control still works
  - Verify: Manual: set browser font to 20px → popup text enlarges

- [ ] P2 - Add `escapeHtml` to dashboard-heatmap and dashboard-debugger
  - Why: Latent XSS vectors via innerHTML without sanitization
  - Evidence: Security agent Finding 6
  - Touches: `pages/dashboard-heatmap.js`, `pages/dashboard-debugger.js`
  - Acceptance: All innerHTML assignments use escaped content
  - Verify: `npm test`

- [ ] P2 - handleMessage decomposition (incremental)
  - Why: 263-case switch spanning 2,852 lines is hard to maintain
  - Evidence: Architecture agent
  - Touches: `src/background/core.ts` (message handler section)
  - Acceptance: Top-level switch delegates to domain handlers
  - Verify: `npm run check`

- [ ] P2 - Add DevTools panel empty states
  - Why: Network/Console tabs show raw empty containers when no data
  - Evidence: UX agent Finding 4
  - Touches: `pages/devtools-panel.js`
  - Acceptance: Empty state message when zero entries
  - Verify: Manual: open DevTools panel on fresh install

### Phase 4: Hardening & Cleanup (P3)

- [ ] P3 - EI-10: Add `set -euo pipefail` to `build.sh`
  - Why: Piped command failures can be silently swallowed
  - Evidence: Build/CI agent
  - Touches: `build.sh:5`
  - Acceptance: `set -euo pipefail` on line 5
  - Verify: `bash build.sh` succeeds

- [ ] P3 - EI-11: Pin `monaco-editor` version exactly
  - Why: Range `^0.52.0` could pull different editor code on fresh install
  - Evidence: Build/CI agent
  - Touches: `package.json:80`
  - Acceptance: `"monaco-editor": "0.52.2"`
  - Verify: `npm ls monaco-editor`

- [ ] P3 - Fix silent module skip in `esbuild.config.mjs`
  - Why: Typo in module filename silently drops module from bundle
  - Evidence: Build/CI agent
  - Touches: `esbuild.config.mjs:114-115`
  - Acceptance: Missing module → build error (not silent skip)
  - Verify: Rename a module → build fails with clear error

- [ ] P3 - core-flows.test.js: import actual source instead of re-implementing
  - Why: Tests validate concept, not production code; drift goes undetected
  - Evidence: Test agent quality assessment
  - Touches: `tests/core-flows.test.js`
  - Acceptance: Tests import from actual source modules
  - Verify: `npm test`

- [ ] P3 - Update `content.js` version banner from v2.3.0 to v3.11.0
  - Why: Version string is stale; cosmetic but indicates neglect
  - Evidence: Architecture agent
  - Touches: `content.js:1`
  - Acceptance: Version matches manifest
  - Verify: `grep -n 'v3.11.0' content.js`

- [ ] P3 - Add toggle lock timeout
  - Why: A stuck toggle promise blocks all future toggles for that script
  - Evidence: Architecture agent (concurrency audit)
  - Touches: `src/background/core.ts` (toggleScript lock chain)
  - Acceptance: Lock auto-releases after 30s timeout
  - Verify: Unit test: locked toggle resolves after timeout

- [ ] P3 - Wire popup/sidepanel/install to i18n system
  - Why: Extension is English-only outside dashboard
  - Evidence: UX agent Finding 7
  - Touches: `pages/popup.js`, `pages/sidepanel.js`, `pages/install.js`
  - Acceptance: All user-facing strings extracted to i18n keys
  - Verify: `npm run locale:check`

- [ ] P3 - Rate limiter cap enforcement
  - Why: 200+ distinct origins can grow `_rateLimitMap` unbounded
  - Evidence: Security agent Finding 7
  - Touches: `modules/public-api.js:441-463`
  - Acceptance: Map hard-capped at 200; oldest entries evicted
  - Verify: Unit test with 300 distinct origins → map size ≤ 200

---

## Quick Wins

These can be completed in under an hour each:

1. **EI-3**: Sync PublicAPI `isInternalHost` — copy 5 missing checks from
   `InternalHostGuard` (~20 lines)
2. **EI-4**: Add theme CSS blocks to sidepanel/DevTools (~50 lines of CSS each)
3. **EI-9**: Fix `publish.sh` `--draft` parsing — loop over `$@` instead of
   checking `$1`
4. **EI-10**: Add `pipefail` to `build.sh` — 1 line
5. **EI-11**: Pin monaco-editor version — 1 character change in package.json
6. **Content.js version banner** — change `v2.3.0` to `v3.11.0`
7. **EI-5**: Add `aria-live` to install page — 2-3 attribute additions

---

## Larger Bets

These require planning, staged rollout, or significant design work:

1. **ESM build migration**: Replace concatenation with esbuild ESM bundling.
   Eliminates typed module duplication, enables tree-shaking, allows removing
   `@ts-nocheck` from core.ts. Estimated: 2-3 weeks, high risk.
2. **Sync integrity**: HMAC-SHA256 on sync envelopes with key derivation from
   signing keypair. Requires migration path for existing unverified envelopes.
3. **Full i18n**: Wiring popup, sidepanel, install, and DevTools to the i18n
   system. ~200 strings to extract across 4 surfaces.
4. **XHR response channel security**: Replacing `postMessage('*')` for
   background→userscript XHR events with a secure channel (USER_SCRIPT direct
   messaging or encrypted payloads). Architectural change affecting content.js
   bridge.

---

## Explicit Non-Goals

1. **WXT migration** — Conflicts with concatenated service worker architecture.
   Already rejected in ROADMAP (R-1). Revisit only after ESM build migration.
2. **Safari support** — Safari lacks `userScripts` API. Already under
   consideration (UC-1) with correct assessment.
3. **Eliminating `<all_urls>` host permission** — Required for userscript
   injection on any page. Cannot be narrowed without breaking core
   functionality.
4. **Source map generation for CWS builds** — Low value since CWS review has
   access to source ZIP. Would add complexity for minimal benefit.
5. **Virtualizing popup script list** — At ~48px per item and 300px max-height,
   CSS `content-visibility: auto` already provides containment. Virtualization
   complexity is not justified for typical script counts.

---

## Open Questions

1. **XHR response broadcast (S5)**: Is `chrome.runtime` messaging from
   background to USER_SCRIPT world a viable replacement for `postMessage('*')`
   in the content bridge? The `onUserScriptMessage` API (Chrome 131+) handles
   USER_SCRIPT → background; is there a reverse channel?

2. **Sync integrity migration**: How should existing unverified sync envelopes
   be handled when HMAC verification is enabled? Options: (a) first sync after
   upgrade re-signs the envelope, (b) grace period with warning, (c) manual
   re-sync required.

3. **Typed module deduplication priority**: Should the ~4,000 lines of
   duplicated typed module code be removed from `background.js` now (by
   removing them from the concatenation list) even before the ESM build
   migration? This would require core.ts to import from the typed modules,
   which the concatenation build doesn't support — or the typed modules could
   be deleted from the build and only used for testing.
