# ScriptVault — Firefox Port Roadmap

Living document. Tracks the Chrome → Firefox MV3 port across sessions. **Update after every session** so the next session picks up exactly where this one left off.

## Target

- **Firefox 128+ (ESR 128+)** — matches the `strict_min_version` already declared in `manifest-firefox.json`
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

- [ ] **Strip `manifest.sandbox` from `manifest-firefox.json`.** Firefox MV3 doesn't support sandboxed manifest pages. Verify the build script doesn't copy the Chrome `content_security_policy` block either.
- [ ] **Feature-flag `chrome.offscreen`.** `bg/analyzer.js` and `background.core.js` call `chrome.offscreen.createDocument(...)`. On Firefox this throws. Under Firefox's persistent background script you can run Acorn inline. Plan:
  - Guard all `chrome.offscreen.*` call sites with `if (typeof chrome.offscreen !== 'undefined')`
  - Provide a `loadAcornInline()` fallback that imports `lib/acorn.min.js` via `importScripts` (bg script) or a dynamic `<script>` inject (Firefox bg is a full document, not a worker)
  - Same treatment for `lib/diff.min.js` 3-way merge
- [ ] **Feature-flag `chrome.sidePanel`.** Dashboard has side-panel hooks. Firefox has no equivalent. Hide the toggle in `pages/dashboard.js` when `typeof chrome.sidePanel === 'undefined'`.
- [ ] **Strip `worldId` on Firefox.** `src/background/registration.ts` / `bg/*` may set `worldId` on `chrome.userScripts.register()`. Chrome 133+ only. Firefox rejects unknown fields. Guard with `if (USERSCRIPT_API_SUPPORTS_WORLD_ID)` after a runtime probe.
- [ ] **Monaco editor loading path.** Firefox MV3 `extension_pages` CSP allows `'unsafe-eval'` by default, so Monaco can load directly in the dashboard extension origin with *no* sandboxed iframe at all. Two options:
  - **A (minimal):** keep the iframe, drop the manifest `sandbox` declaration, switch CSP to allow eval. `monaco-adapter.js` already posts with `'*'` targetOrigin.
  - **B (cleaner):** inline the Monaco container directly in the dashboard, delete the iframe on Firefox. More invasive.
  - **Decision needed:** start with A to prove loading; revisit B in Phase 4 polish.
- [ ] **Build + temporary install test.**
  - `python build/pack-firefox.py` (to be created, mirrors `pack-release.py`)
  - Load in Firefox Nightly: `about:debugging#/runtime/this-firefox → Load Temporary Add-on → select .xpi`
  - Record the error console output. Each error becomes a Phase 1 checkbox.

**Done-criteria:** dashboard opens, popup opens, a test userscript can be created, saved, toggled on, and runs on a target page. Cloud sync and side panel can be broken.

### Phase 2 — Data safety + storage

**Goal:** existing-Chrome-user data import path + Firefox-specific storage behavior validated.

- [ ] **`unlimitedStorage` + `storage.local` quota.** Firefox has different IDB quotas than Chrome. Validate the 26-script test fixture still fits.
- [ ] **Import JSON/ZIP backups** from a Chrome export into the Firefox build. No data loss, metadata preserved, `updatedAt` intact.
- [ ] **Cross-browser ID strategy.** Script IDs are generated via `generateId()` — confirm they're opaque and won't collide with Chrome IDs on re-import.
- [ ] **Migration logic** — `modules/migration.js` runs v1.x → v2.0 migration. Confirm it's idempotent so re-importing a migrated file doesn't double-migrate.
- [ ] **Trash recovery + undo** still works after a Firefox restart (persistent background means state survives, unlike Chrome SW).

### Phase 3 — Integrations that need per-provider work

**Goal:** decide which of these ship on Firefox v1 and which are explicitly out-of-scope.

- [ ] **Cloud sync providers** (`modules/sync-providers.js` + `sync-easycloud.js`):
  - Google Drive PKCE — needs `moz-extension://<uuid>/` redirect URI registered in Google Cloud Console
  - Dropbox PKCE — same
  - OneDrive PKCE — same
  - WebDAV — should work as-is (no OAuth)
  - Easy Cloud (`chrome.identity` + `chrome.storage.managed`) — may not work on Firefox depending on identity flow support
  - **Decision needed:** ship WebDAV only on Firefox v1? Defer OAuth providers to Phase 5?
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
- [ ] **Lint pass.** Run `web-ext lint` against the XPI; fix every warning Mozilla flags before submission.
- [ ] **`web-ext build`** to produce a canonical source-plus-artifact pair.
- [ ] **Source submission bundle.** AMO requires source code if the extension uses minified libraries (Monaco definitely qualifies). Prepare a zip of the source tree + exact build instructions. `build/pack-firefox.py` + `esbuild.config.mjs` source paths must be documented.
- [ ] **Privacy policy + permissions rationale** — reuse the Chrome listing as a starting point, adapt for AMO format.
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
| 1 | `chrome.offscreen` not in Firefox | `background.core.js`, `bg/analyzer.js`, `offscreen.html` / `.js` | **Hard** — AST analysis breaks |
| 2 | `manifest.sandbox.pages` not in Firefox | `manifest-firefox.json`, `pages/editor-sandbox.html` | **Hard** — Monaco won't load |
| 3 | `chrome.sidePanel` not in Firefox | `pages/dashboard.js`, `pages/sidepanel.html` | Medium — UI-only |
| 4 | Per-script `worldId` is Chrome 133+ only | `src/background/registration.ts` | Medium — registration fails if set |
| 5 | Google / Dropbox / OneDrive PKCE redirect URI | `modules/sync-providers.js`, `modules/sync-easycloud.js` | Medium — can defer |
| 6 | Chrome CRX3 format irrelevant on Firefox | `build/pack-release.py` | Low — separate build path needed anyway |
| 7 | `navigator.userAgent` / `runtime.getBrowserInfo` detection | shared modules | Low — wrapper helper |

## Open decisions for the user

1. **Cloud sync scope for v1 Firefox build** — ship WebDAV only (fast path) or all providers (slower, needs per-provider redirect URI registration)?
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

---

*Update this file at the end of every Firefox-port session. Link to it from the repo's `CLAUDE.md` so any future Claude session resumes from the correct phase without re-deriving the plan.*
