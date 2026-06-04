# ScriptVault — Firefox Port Roadmap

Living document. Tracks the Chrome → Firefox MV3 port across sessions. **Update after every session** so the next session picks up exactly where this one left off.

## Target

- **Firefox 140+ desktop** — matches the `strict_min_version` declared in `manifest-firefox.json`; this is the first supported baseline for the current AMO data-collection declaration plus Firefox MV3 `userScripts` optional-permission model.
- **Firefox for Android 142+** — declared only as a manifest compatibility floor. Android UI/runtime smoke is not yet part of the release gate.
- **Manifest V3** — Firefox's MV3 is persistent background scripts, not service workers
- **Distribution**: eventual AMO listing, interim self-signed XPI via `about:debugging` for dev

## Guiding principles

- **One codebase, runtime-forked.** The Chrome build must not regress. All Firefox-specific code paths gated behind a feature detect, not an environment variable or separate source tree.
- **Feature detect, never UA-sniff** where possible (`typeof chrome.offscreen`, `typeof chrome.sidePanel`, etc.). Fall back to `navigator.userAgent.includes('Firefox')` only for decisions that can't be expressed as API presence.
- **Degrade gracefully.** If a feature isn't available on Firefox, hide its UI entry points rather than showing a broken button.
- **Ship both artifacts from the same tag.** Every release produces `ScriptVault-vX.Y.Z.crx`, `...zip`, and `...firefox.xpi` attached to the same GitHub release.

## Phases

### Phase 0 — Baseline (DONE)

- [x] `manifest-firefox.json` exists with `browser_specific_settings.gecko`, MV3, id `ScriptVault@sysadmindoc.dev`
- [x] `build-firefox.sh` + equivalent Python packer can produce a `.xpi`
- [x] Compatibility gotchas catalogued (see "Known porting issues" below)

### Phase 1 — Clean temporary sideload (`about:debugging`)

**Goal:** installs without manifest errors, opens the dashboard, basic userscripts register and run.

- [x] **Strip `manifest.sandbox` from `manifest-firefox.json`.** Firefox MV3 doesn't support sandboxed manifest pages. Verify the build script doesn't copy the Chrome `content_security_policy` block either.
- [x] **Feature-flag `chrome.offscreen`.** `bg/analyzer.js` and `background.core.js` call `chrome.offscreen.createDocument(...)`. On Firefox this throws. Under Firefox's persistent background script you can run Acorn inline. Plan:
  - Guard all `chrome.offscreen.*` call sites with `if (typeof chrome.offscreen !== 'undefined')`
  - Provide a `loadAcornInline()` fallback that imports `lib/acorn.min.js` via `importScripts` (bg script) or a dynamic `<script>` inject (Firefox bg is a full document, not a worker)
  - Same treatment for `lib/diff.min.js` 3-way merge
  - **Shipped 2026-06-04:** `ScriptAnalyzer` now feature-detects offscreen support, keeps Chrome on the offscreen document path, and uses inline local Acorn/Diff for Firefox AST analysis, ESM import parsing, and sync merge. The Firefox package copies `lib/acorn.min.js` and `lib/diff.min.js` without copying the full Monaco `lib/` tree.
- [x] **Feature-flag `chrome.sidePanel`.** Dashboard has side-panel hooks. Firefox has no equivalent. Hide the toggle in `pages/dashboard.js` when `typeof chrome.sidePanel === 'undefined'`.
  - **Shipped 2026-06-04:** `dashboard-firefox-compat.js` no longer creates a no-op `chrome.sidePanel` on unsupported browsers. Firefox leaves the API absent so dashboard feature gates can hide side-panel entry points; native Chromium support is unchanged.
- [x] **Strip `worldId` on Firefox.** `src/background/registration.ts` / `bg/*` may set `worldId` on `chrome.userScripts.register()`. Chrome 133+ only. Firefox rejects unknown fields. Guard with `if (USERSCRIPT_API_SUPPORTS_WORLD_ID)` after a runtime probe.
- [x] **Monaco editor loading path.** Firefox MV3 `extension_pages` CSP allows `'unsafe-eval'` by default, so Monaco can load directly in the dashboard extension origin with *no* sandboxed iframe at all. Two options:
  - **A (minimal):** keep the iframe, drop the manifest `sandbox` declaration, switch CSP to allow eval. `monaco-adapter.js` already posts with `'*'` targetOrigin.
  - **B (cleaner):** inline the Monaco container directly in the dashboard, delete the iframe on Firefox. More invasive.
  - **Decision:** Phase 1 keeps the existing iframe adapter for Chromium/local builds and ships Firefox AMO builds with a deterministic textarea fallback. Direct Monaco packaging remains a Phase 4 polish path after a pruned bundle can satisfy AMO lint.
  - **Shipped 2026-06-04:** `editor-sandbox.html` posts `monaco-load-error` when `lib/monaco/` is absent, and `monaco-adapter.js` immediately hides the iframe, preserves pending code, binds textarea input events, focuses the fallback, and reports `isMonaco: false`.
  - **Current gate:** `build-firefox.sh` intentionally omits `lib/monaco/` because AMO's linter rejects the bundled TypeScript worker as too large to parse. The dashboard now falls back immediately to the textarea adapter in Firefox AMO builds.
- [x] **Build + temporary install test.**
  - `npm run firefox:lint` (builds a lintable `build-firefox/`, runs `web-ext lint`, and writes `firefox-artifacts/web-ext-lint.json`)
  - `npm run firefox:package` (builds, lints, writes `firefox-artifacts/scriptvault-firefox-v<version>.zip`, and writes `firefox-artifacts/scriptvault-firefox-source-v<version>.zip`)
  - `npm run smoke:firefox` (geckodriver temporary sideload; opens dashboard/popup; saves, toggles, and runs a smoke userscript on a local HTTP target)
  - **Shipped 2026-06-04:** Firefox Developer Edition 151.0b10 installed `firefox-artifacts/scriptvault-firefox-v3.11.0.zip`, opened dashboard and popup, saved/toggled `ScriptVault Firefox Smoke`, and verified `document.documentElement.dataset.scriptvaultFirefoxSmoke === 'ok'` on a local `http://127.0.0.1` target page. The smoke asserts the Firefox optional `userScripts` permission setup path; headless WebDriver grants the optional permission through Firefox chrome context after confirming the ScriptVault setup button is present.

**Done-criteria:** dashboard opens, popup opens, a test userscript can be created, saved, toggled on, and runs on a target page. Cloud sync and side panel can be broken.

### Phase 2 — Data safety + storage

**Goal:** existing-Chrome-user data import path + Firefox-specific storage behavior validated.

- [x] **`unlimitedStorage` + `storage.local` quota.** Firefox has different IDB quotas than Chrome. Validate the 26-script test fixture still fits.
  - **Shipped 2026-06-04:** `npm run smoke:firefox` imports a 26-script Firefox quota fixture, confirms every `script_firefox_quota_*` ID is restored, and verifies `getStorageUsage` returns level `ok` after import.
- [x] **Import JSON/ZIP backups** from a Chrome export into the Firefox build. No data loss, metadata preserved, `updatedAt` intact.
  - **Shipped 2026-06-04:** `npm run smoke:firefox` now imports Chrome-shaped ScriptVault JSON and ZIP fixtures into the Firefox package and verifies metadata, disabled state, GM storage values, `createdAt`, and `updatedAt`.
- [x] **Cross-browser ID strategy.** Script IDs are generated via `generateId()` — confirm they're opaque and won't collide with Chrome IDs on re-import.
  - **Shipped 2026-06-04:** ScriptVault ZIP exports include safe `scriptId` metadata plus `scriptVault` timestamp/position metadata. Import preserves safe `script_*` IDs and allocates generated IDs for unsafe/reserved IDs; source and runtime tests cover both paths.
- [x] **Migration logic** — `modules/migration.js` runs v1.x → v2.0 migration. Confirm it's idempotent so re-importing a migrated file doesn't double-migrate.
  - **Shipped 2026-06-04:** `tests/migration.test.js` now seeds a legacy `userscripts` record, runs migration twice, and asserts the second run does not call `chrome.storage.local.set/remove` or alter migrated state.
- [x] **Trash recovery + undo** still works after a Firefox restart (persistent background means state survives, unlike Chrome SW).
  - **Shipped 2026-06-04:** the Firefox smoke uses a persistent temporary Firefox profile, deletes the WebDriver session, starts Firefox again with the same profile, reinstalls the temporary add-on, and verifies trash still contains the deleted script before `restoreFromTrash` restores it.

### Phase 3 — Integrations that need per-provider work

**Goal:** decide which of these ship on Firefox v1 and which are explicitly out-of-scope.

- [ ] **Cloud sync providers** (`modules/sync-providers.js` + `sync-easycloud.js`):
  - Google Drive PKCE — needs `moz-extension://<uuid>/` redirect URI registered in Google Cloud Console
  - Dropbox PKCE — same
  - OneDrive PKCE — same
  - WebDAV — should work as-is (no OAuth)
  - Easy Cloud (`chrome.identity` + `chrome.storage.managed`) — may not work on Firefox depending on identity flow support
  - **Current gate:** Firefox does not accept `identity` in `optional_permissions`; the validation manifest omits it. Treat Firefox v1 as WebDAV-only until OAuth providers get a dedicated permission/UI pass or `identity` becomes an install-time Firefox permission.
- [ ] **DeclarativeNetRequest rule management** (`src/background/dnr-rules.ts`) — Firefox MV3 DNR is supported but the dynamic rule API may differ. Test rule registration + teardown.
- [ ] **`@require` SRI verification** (`src/background/resource-loader.ts`) — works the same on both (pure crypto).
- [ ] **Ed25519 signing** (`bg/signing.js`) — Web Crypto API, identical.

### Phase 4 — Polish + parity

- [ ] **Hide broken UI.** Any feature not available on Firefox should have its entry point hidden, not just throw on click.
- [ ] **Firefox compat shim** (`pages/dashboard-firefox-compat.js`) already exists — audit what it does today, expand as needed.
- [ ] **Dashboard "About" panel** — show a "Firefox build" or "Chrome build" indicator with the current browser's version string.
- [ ] **Icon adjustments.** Firefox uses the `action` icon slightly differently; make sure it renders in the toolbar at all Firefox zoom levels.
- [ ] **Popup width** — Firefox has a stricter popup sizing model; confirm the 360 px popup doesn't get cut off.
- [ ] **Keyboard shortcuts** — the `commands` block already uses `Alt+Shift+*`, which works on both. Verify no Firefox conflicts.
- [ ] **Dark / light theme** — verify both themes render correctly on `about:addons`-injected chrome.

### Phase 5 — AMO submission

- [ ] **AMO developer account** set up under SysAdminDoc.
- [x] **Lint pass.** Run `web-ext lint` against the XPI; fix every warning Mozilla flags before submission.
- [x] **`web-ext build`** to produce a canonical source-plus-artifact pair.
- [x] **Source submission bundle.** AMO requires source code if the extension uses minified libraries. `npm run firefox:package` now writes a source ZIP alongside the Firefox package.
- [ ] **Privacy policy + permissions rationale** — reuse the Chrome listing as a starting point, adapt for AMO format.
  - **Current gate:** AMO manifest data-collection declarations are explicit; full AMO listing/privacy copy remains for the generated permissions/privacy/store-copy roadmap item.
- [ ] **Initial AMO listing** as *unlisted* for internal smoke testing before going public.
- [ ] **Review feedback loop.** Mozilla reviews typically flag `unsafe-eval`, broad `host_permissions`, and undocumented use of `userScripts`. Be ready to justify each.
- [ ] **Publish as listed** once all feedback resolved.

### Phase 6 — Ongoing maintenance

- [ ] **Dual-target release process.** Every future release builds both Chrome and Firefox artifacts from the same tag and uploads both to the GitHub release.
- [ ] **Regression tests.** Add a Vitest suite that at least sanity-checks the Firefox manifest's JSON shape and the feature-flag branches in shared code.
- [ ] **CI matrix.** GitHub Actions job that produces both `.crx` (Chrome, via `build/pack-release.py`) and `.xpi` (Firefox, via `build/pack-firefox.py`) on every tag push.

## Known porting issues (ScriptVault-specific)

| # | Issue | File(s) | Blocker level |
|---|-------|---------|----|
| 1 | `chrome.offscreen` not in Firefox | `background.core.js`, `bg/analyzer.js`, `offscreen.html` / `.js` | **Mitigated** — offscreen calls are feature-detected; Firefox uses inline local Acorn/Diff fallbacks |
| 2 | `manifest.sandbox.pages` not in Firefox | `manifest-firefox.json`, `pages/editor-sandbox.html` | **Mitigated** — Firefox manifest has no sandbox key; AMO builds use immediate textarea fallback while direct Monaco packaging remains Phase 4 polish |
| 3 | `chrome.sidePanel` not in Firefox | `pages/dashboard.js`, `pages/sidepanel.html` | **Mitigated** — Firefox no longer gets a fake sidePanel object; feature detects see the API as absent |
| 4 | Per-script `worldId` is Chrome 133+ only | `background.core.js`, `src/background/registration.ts` | **Mitigated** — guarded behind Chromium 133+ detection |
| 5 | Google / Dropbox / OneDrive PKCE redirect URI plus `identity` permission | `modules/sync-providers.js`, `modules/sync-easycloud.js`, `manifest-firefox.json` | Medium — deferred; WebDAV-only for validation gate |
| 6 | Chrome CRX3 format irrelevant on Firefox | `build/pack-release.py` | Low — separate build path needed anyway |
| 7 | `navigator.userAgent` / `runtime.getBrowserInfo` detection | shared modules | Low — wrapper helper |

## Open decisions for the user

1. **Cloud sync scope for v1 Firefox build** — current validation package is WebDAV-only because Firefox doesn't support `identity` as optional. Decide whether to add install-time `identity` later or keep OAuth providers Chrome-only.
2. **Editor approach** — keep the sandboxed iframe architecture on Firefox (simpler code, small perf overhead) or inline Monaco directly in the dashboard (cleaner, more work)?
3. **Source tree strategy** — stay with runtime feature detects in shared files, or split Firefox-specific code into a `firefox/` overlay directory?
4. **AMO listing visibility** — go public on day one, or start unlisted with a private signing for personal testing?
5. **`ScriptVault-firefox-v2.1.7.xpi/.zip`** currently sits in the repo root from the exploratory build. Delete, gitignore, or keep as the "current nightly"?

## Session log

### 2026-04-10 — Roadmap scaffolding

- Assessed existing Firefox skeleton: `manifest-firefox.json` + `build-firefox.sh` already in place.
- Built a current `ScriptVault-firefox-v2.1.7.xpi` via Python packer (not yet tested in actual Firefox).
- Catalogued the 7 known porting issues above.
- This roadmap file created. Next session starts at **Phase 1** checkbox 1.

### 2026-05-24 — AMO validation gate

- Added AMO `browser_specific_settings.gecko.data_collection_permissions` with required `none` and optional data types for opt-in cloud/sync/export flows.
- Moved Firefox `userScripts` to `optional_permissions` and raised the Firefox baseline to 140.0 desktop / 142.0 Android to match current AMO and `userScripts` manifest-key support.
- Reworked `build-firefox.sh` around `web-ext lint` and `web-ext build`; `npm run firefox:lint` leaves a lintable build directory, and `npm run firefox:package` emits both a Firefox package and AMO source-review ZIP under `firefox-artifacts/`.
- Guarded Chrome-only per-script `worldId` in both runtime JS and the TypeScript mirror so Firefox never receives the unsupported field.
- `web-ext lint` now exits with 0 errors and 0 notices. It still reports existing dynamic-HTML warnings; those are recorded in `firefox-artifacts/web-ext-lint.json` and should be handled in a separate AMO hardening pass.

### 2026-06-04 — Research refresh / lint recheck

- Ran `npm run firefox:lint` via UNC-safe `cmd /c pushd`; the Firefox build still lints with 0 errors and 0 notices, now 139 warnings.
- Did not run temporary sideload or browser runtime smoke; Phase 1 Build + temporary install remains open.
- `npm run support:matrix:check` now fails on a stale `README.md` generated matrix; tracked in `ROADMAP.md`.
- The live tree contains active Sigstore provenance-verifier source/test/generated changes; preserve them for the build lane. Package bumps, generated support-matrix updates, and runtime smoke remain build-lane work.

### 2026-06-04 — Offscreen feature flag

- Closed the Phase 1 `chrome.offscreen` checkbox. `ScriptAnalyzer._ensureOffscreen()` now returns `false` when the API is missing instead of dereferencing `chrome.offscreen`, and analyzer/ESM/sync merge callers route through `ScriptAnalyzer` helpers.
- Firefox background runtime now loads local `lib/acorn.min.js` or `lib/diff.min.js` inline only when offscreen is absent. Chrome keeps using `offscreen.html` and `chrome.runtime.sendMessage(...)` for AST, ESM, and merge work.
- `build-firefox.sh` now includes `lib/acorn.min.js` and `lib/diff.min.js`, while continuing to omit the full `lib/` directory and Monaco.
- Focused verification: `npm test -- tests/source-modules.test.js tests/analyzer-generated.test.js tests/esm-bundler-generated.test.js tests/firefox-package.test.js tests/source-cloud-sync.test.js`, `npm run typecheck`, `node --check bg/analyzer.js`, and `node --check background.js`.

### 2026-06-04 — Side panel feature flag

- Closed the Phase 1 `chrome.sidePanel` checkbox. `FirefoxCompat.polyfill()` now preserves native side-panel APIs but leaves `chrome.sidePanel` undefined when unsupported instead of installing a no-op object.
- Added `tests/dashboard-firefox-compat.test.js` to execute the compatibility layer in Firefox-like and Chromium-like VM contexts and pin both behaviors.
- Focused verification: `npm test -- tests/dashboard-firefox-compat.test.js tests/firefox-package.test.js tests/manifest-generator.test.js`, `node --check tests/dashboard-firefox-compat.test.js pages/dashboard-firefox-compat.js`, and `node scripts/generate-manifest-firefox.mjs --profile firefox --check`.

### 2026-06-04 — Monaco fallback path

- Closed the Phase 1 Monaco loading-path checkbox with the minimal AMO-safe decision: keep Chromium/local builds on the existing Monaco iframe and keep Firefox packages Monaco-free until a pruned bundle can pass AMO lint.
- `editor-sandbox.html` now posts `monaco-load-error` when the local Monaco loader is missing. `monaco-adapter.js` consumes that message and activates the textarea fallback immediately instead of waiting for the 15-second timeout.
- The textarea fallback now preserves the cached value, binds `input` events back through the dashboard change listeners, supports focus, and reports `isMonaco: false`.
- Focused verification: `npm test -- tests/monaco-firefox-fallback.test.js tests/search-corpus-history.test.js tests/firefox-package.test.js` and `node --check pages/monaco-adapter.js tests/monaco-firefox-fallback.test.js`.

### 2026-06-04 — Phase 1 sideload smoke

- Closed the Phase 1 Build + temporary install checkbox with `npm run smoke:firefox`.
- Added `scripts/smoke-firefox-sideload.mjs`, wired as `npm run smoke:firefox`, to build/package the Firefox artifact, launch geckodriver, temporary-install `scriptvault-firefox-v3.11.0.zip`, resolve `moz-extension://` dashboard/popup URLs, and exercise dashboard, popup, save, toggle, and target-page userscript execution.
- Fixed smoke-discovered Firefox runtime gaps: `MAX_SCRIPT_SIZE` initialization before `SubscriptionSystem`, native Windows Git Bash preference before WSL bash in `scripts/run-bash.mjs`, Firefox `menus` aliasing to the shared `contextMenus` path, trusted own `moz-extension://` dashboard/popup message senders, and optional Firefox `userScripts` permission onboarding in popup/dashboard.
- `web-ext` is now `^10.3.0`, clearing the `web-ext -> tmp` CVE path; the generated support matrix now includes both `npm run firefox:package` and `npm run smoke:firefox`.
- Verification: `npm run firefox:package` (0 errors / 0 notices / 139 warnings), `npm run smoke:firefox` with Firefox Developer Edition 151.0b10, focused Firefox/package/onboarding tests, `npm audit --audit-level=high --omit=optional`, `npm ls tmp`, and `npm run support:matrix:check`.
- Next Firefox-port session starts at **Phase 2 — Data safety + storage**, beginning with storage quota, migration-idempotence, and Firefox restart/trash validation.

### 2026-06-04 — Phase 2 backup import round-trip

- Closed the Phase 2 JSON/ZIP backup import and cross-browser ID strategy rows.
- `exportToZip()` now writes a ScriptVault-specific `scriptVault` metadata object into each `.options.json` file with `schemaVersion`, `createdAt`, `updatedAt`, and `position`. `importFromZip()` reads that metadata, while still accepting older top-level timestamp fields and legacy Tampermonkey-compatible options.
- `npm run smoke:firefox` now imports Chrome-shaped JSON and ZIP backup fixtures into Firefox, checks stable `script_*` IDs, restored metadata, disabled state, GM storage values, and preserved timestamps.
- Focused verification: `npm test -- tests/runtime-import-export.test.js tests/source-backup-modules.test.js tests/firefox-package.test.js`, `node scripts/smoke-firefox-sideload.mjs --skip-package`.

### 2026-06-04 — Phase 2 storage, migration, and restart data safety

- Closed the remaining Phase 2 storage/data-safety rows.
- `npm run smoke:firefox` now imports a 26-script quota fixture, checks storage usage, soft-deletes a trash fixture, restarts Firefox with the same temporary profile, reinstalls the temporary package, verifies the trash entry survived, and restores it.
- `tests/migration.test.js` now proves legacy v1.x script migration is idempotent across repeated runs.
- Focused verification: `node --check scripts/smoke-firefox-sideload.mjs`, `npm test -- tests/firefox-package.test.js tests/migration.test.js`, and `node scripts/smoke-firefox-sideload.mjs --skip-package` with Firefox Developer Edition 151.0b10.
- Next Firefox-port session starts at **Phase 3 — Integrations that need per-provider work**, beginning with the WebDAV-only baseline and explicit OAuth/identity decision.

---

*Update this file at the end of every Firefox-port session. Link to it from the repo's `CLAUDE.md` so any future Claude session resumes from the correct phase without re-deriving the plan.*
