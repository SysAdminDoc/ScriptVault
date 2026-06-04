# Cross-Browser Build Pipeline — WXT Migration Plan

**Phase:** 33 (Cross-Browser Support).
**Status:** Design — pending engineering decision to start.
**Owner:** Phase 33.1 lead (TBD).
**Last reviewed:** 2026-05-17.

---

## Goal

Migrate ScriptVault from its current esbuild-based single-target build (Chrome MV3) to a per-browser build pipeline that produces working extensions for:

- Chrome / Chromium (current, baseline)
- Firefox MV3 (AMO listing)
- Microsoft Edge (Edge Add-ons store)
- Brave / Vivaldi / Opera / Arc (Chromium derivatives, "free" from CWS build)
- Orion (WebKit, supports both Chrome and Firefox extensions via shim)
- Safari (long-tail, decision-gated per Phase 33.7)

All from a single source tree; no manual fork per browser. This document is the **operational plan** for Phase 33.1 (build pipeline), which is the prerequisite to all other Phase 33 subtasks.

## Why WXT (over Plasmo, manual esbuild, or `web-ext`)

[WXT](https://wxt.dev/) is the recommended tool per the existing Phase 33.1 ROADMAP entry. The choice is reaffirmed here:

| Tool | MV3 Chrome+Firefox dual-build | Hot reload | Manifest abstraction | Auto-imports | Verdict |
|---|---|---|---|---|---|
| **WXT** | yes (native) | yes (cross-browser) | yes (per-browser `manifest` fn) | optional | **Pick.** Smallest dep surface that handles MV2/MV3 + Firefox quirks. |
| Plasmo | yes | yes | yes (overlay model) | yes (React-flavored) | Heavier; opinionated React tooling adds drag. |
| Manual esbuild | yes (with custom plugin) | partial | no | no | What we have. Doesn't scale past 2 browsers. |
| `web-ext` (Mozilla) | Firefox only | Firefox only | no | no | Useful as a Firefox lint complement, not a primary builder. |

WXT also handles:
- Per-browser manifest functions (return a different manifest object for Chrome vs Firefox).
- Firefox `browser_specific_settings.gecko` (`gecko.id`, desktop minimum version, and data-collection declaration).
- Web-accessible resources UUID handling for Firefox's `moz-extension://` random UUIDs.
- Auto-handling of `world_accessible_resources` matches.

## Migration sequence

### Stage 1 — Repo prep (zero behavior change)

1. Add `wxt` to `devDependencies`.
2. Move all source into `entrypoints/`:
   - `background.core.js` → `entrypoints/background.ts` (Phase 1 TS migration prerequisite; can stay as `background.js` if TS migration not yet ready).
   - `pages/popup.html` + `popup.js` → `entrypoints/popup/`.
   - `pages/sidepanel.html` + `sidepanel.js` → `entrypoints/sidepanel/`.
   - `pages/dashboard.html` + `dashboard.js` + `dashboard-*.js` → `entrypoints/options/`.
   - `pages/install.html` + `install.js` → `entrypoints/install/`.
   - `content.js` → `entrypoints/content.ts`.
3. Create `wxt.config.ts` with the manifest factory.
4. Keep the existing `esbuild.config.mjs` working in parallel for a transition period.
5. Verify WXT-built Chrome extension is byte-equivalent (or better) to the current build.

**Exit:** `npm run build:chrome:wxt` produces a working extension; existing `npm run build` still works.

### Stage 2 — Firefox MV3 target

**Current validation gate (2026-05-24):** before the WXT migration, the manual Firefox target now has a repeatable AMO gate:

- `manifest-firefox.json` declares Firefox 140.0+ desktop, `browser_specific_settings.gecko.data_collection_permissions`, and `userScripts` as a Firefox optional permission. It intentionally omits `gecko_android` until an Android smoke gate exists.
- `npm run firefox:lint` builds `build-firefox/`, runs `web-ext lint`, and writes `firefox-artifacts/web-ext-lint.json`.
- `npm run firefox:package` runs the lint gate, packages `firefox-artifacts/scriptvault-firefox-v<version>.zip`, and writes `firefox-artifacts/scriptvault-firefox-source-v<version>.zip` for AMO source review.
- `npm run smoke:firefox` runs a geckodriver-based temporary sideload smoke against Firefox Developer Edition/Nightly 140+, opens the dashboard and popup, saves/toggles a smoke userscript through the extension message path, verifies it runs on a local target page, validates DNR dynamic-rule add/remove, verifies `@require` SRI at packaged-runtime registration, exercises Ed25519 signing/verification, validates WebDAV sync against a local fixture, imports Chrome-shaped JSON/ZIP backup fixtures, imports a 26-script quota fixture, and verifies trash restore after a profile-backed Firefox restart.
- `lib/monaco/` is intentionally omitted from the Firefox package until the Monaco Firefox loading-path item is completed; the editor uses the existing textarea fallback in this validation build.
- OAuth sync providers are deferred in the Firefox validation package because Firefox does not accept `identity` as an optional permission. Treat WebDAV as the only in-scope sync provider until a dedicated Firefox OAuth permission pass lands.

1. Add `firefox` build target in `wxt.config.ts`.
2. Add `browser_specific_settings.gecko` (id + strict_min_version 140 + data collection declaration). Do not add `gecko_android` until Firefox for Android has device/emulator smoke evidence.
3. Bundle `webextension-polyfill` — wrap every `chrome.*` call in `browser.*` where Firefox semantics differ.
4. Switch background to event-page format for Firefox (Firefox MV3 doesn't fully support service workers; it uses event pages with `persistent: false`).
5. Handle Firefox's `userScripts` API as `optional_permissions` — implement first-run grant flow.
6. Replace any `chrome-extension://` URL assumption with build-time resolution (Firefox uses per-install random `moz-extension://` UUIDs).
7. Validate Xray Vision boundary: code touching `unsafeWindow` / page globals must use `wrappedJSObject` on Firefox.
8. Skip features that don't apply (DNR rule limits are lower on Firefox; feature-detect before registering >5000 rules).

**Exit:** `npm run firefox:package` produces an AMO-uploadable ZIP plus source ZIP, `npm run firefox:lint` exits with zero linter errors/notices, and `npm run smoke:firefox` passes on a compatible local Firefox build.

### Stage 3 — Edge target

The pre-WXT Edge target is now a thin package wrapper around the Chrome MV3
build. It stages `build-edge/`, applies the Edge manifest transform profile,
removes `update_url` defensively, writes
`edge-artifacts/scriptvault-edge-v<version>.zip`, and records release evidence
in `edge-artifacts/edge-build-<version>.json`. The generated browser support
matrix reads that report and fails closed when the report or ZIP is missing.

When WXT replaces the current build, keep the same evidence contract:

```typescript
// wxt.config.ts
export default defineConfig({
  manifestVersion: 3,
  manifest: ({ browser }) => ({
    // ...shared fields...
    ...(browser === 'edge' && {
      // Edge-specific niceties (none required today; placeholder)
    }),
  }),
});
```

**Exit:** `npm run build:edge:check` produces the Edge ZIP and report, CI uploads
`edge-artifacts/*`, and `npm run support:matrix:check` validates the report.
Initial Partner Center publication remains manual; Microsoft Edge Add-ons REST
update automation is deferred until a live listing and credential-custody model
exist.

### Stage 4 — Chromium-derivative validation (Brave, Vivaldi, Opera, Arc)

No new build targets needed — they accept the Chrome ZIP. The generated support matrix below is the current README source of truth for Chrome, Edge, Firefox, and derivative-browser claims. Smoke-test derivative browsers on release tags before promoting them beyond the watchlist.

## Current Generated Support Matrix

<!-- SCRIPT_VAULT_BROWSER_SUPPORT_MATRIX:START -->
_Last generated: 2026-06-04 with `npm run support:matrix`. Version source: `manifest.json` / `manifest-firefox.json` 3.11.0._

| Browser | Support level | Tested version / target | Last successful verification | Verification evidence | Unsupported or deferred APIs |
|---|---|---|---|---|---|
| Chrome / Chromium | Tier 1 published target | Chrome 130+ MV3 | 2026-06-04 | `npm run smoke:dashboard`, `npm run cws:check`, Chrome ZIP packaging in CI | Chrome 138+ requires per-extension Allow User Scripts; per-script `worldId` is Chrome 133+ and feature-gated |
| Microsoft Edge | Tier 1 compatible package; Partner Center publication manual | Edge 130+ Chromium MV3 package | 2026-06-04 generated package/report; no separate Edge browser smoke in CI | `npm run build:edge:check`, `edge-artifacts/scriptvault-edge-v3.11.0.zip`, `edge-artifacts/edge-build-3.11.0.json`; CI uploads `edge-artifacts/*` | Manual Partner Center upload remains required until a live Edge Add-ons listing exists; Microsoft Edge Add-ons REST update automation is deferred until listing identifiers and publisher credentials are provisioned; No dedicated Edge browser smoke is wired in CI; release operators sideload build-edge/ manually through edge://extensions |
| Firefox Desktop | AMO validation target, not a published listing | Firefox 140.0+ MV3 | 2026-06-04 | `npm run firefox:package`, `npm run smoke:firefox`; web-ext lint 0 errors / 0 notices / 140 warnings | `sidePanel`, `offscreen`, `identity` OAuth, and some `userScripts.execute` flows are unsupported/deferred; Firefox package omits Monaco until the Firefox editor-loading pass |
| Firefox for Android | Deferred; not an AMO compatibility target | No current `gecko_android` manifest target | 2026-06-04 | `manifest-firefox.json` intentionally omits `gecko_android` until an Android smoke gate exists | Android UI/runtime, extension-action overlay, host-permission, import/export, and WebDAV paths are unverified |
| Brave / Vivaldi / Opera / Arc | Chromium derivative watchlist | Chrome 130+ package may load | Not release-verified | No CI smoke or store package for these browsers | Store policy, shields/sidebar behavior, and extension UI chrome are unverified |
| Orion / Safari | Not supported | Not a current target | Not verified | No build, smoke, or package path | Requires separate WebKit/Orion validation and likely native Safari extension work |
<!-- SCRIPT_VAULT_BROWSER_SUPPORT_MATRIX:END -->

### Stage 5 — Orion validation

Orion supports both Chrome and Firefox extensions via shim. Load the Firefox `.xpi` in Orion; verify `browser.userScripts` shim is complete enough. Document the install path in README.

### Stage 6 — Safari (deferred per Phase 33.7)

Decision gate: do we have 1k+ install community demand for Safari? If yes, fund 8–16 weeks of Swift work using `xcrun safari-web-extension-converter` plus a native shim modeled on [quoid/userscripts](https://github.com/quoid/userscripts). If no, document the workaround (use quoid/userscripts to import ScriptVault scripts).

## API surface differences to abstract

Concrete `chrome.*` / `browser.*` divergences ScriptVault hits:

| API | Chrome | Firefox | Strategy |
|---|---|---|---|
| `chrome.userScripts` | Callback or Promise | Promise (always) + `optional_permissions` | Use `browser.userScripts` via polyfill; gate behind permission request |
| `chrome.scripting.executeScript` | works | works in MV3 | Polyfill handles |
| `chrome.declarativeNetRequest` | high rule limit | lower rule limit | Feature-detect rule cap on init |
| `chrome.alarms` | works | works | Polyfill handles |
| `chrome.storage.session` | works | works (Firefox 115+) | Polyfill handles |
| `chrome.sidePanel` | works | not supported | Feature-detect; hide side panel UI on Firefox |
| `chrome.identity.launchWebAuthFlow` | works | works with install-time `identity` permission | Firefox validation package omits `identity`; OAuth providers deferred, WebDAV remains in scope |
| `chrome.cookies` | works (with `cookies` perm) | works | Polyfill handles |
| `chrome.offscreen` | works | not supported | Fall back to in-SW work for AST analysis on Firefox |
| `unsafeWindow` / page DOM access | content script's MAIN world | requires `wrappedJSObject` | Wrap with a `getPageWindow()` helper that branches per build |

## CI changes

`.github/workflows/ci.yml` will grow a build matrix:

```yaml
strategy:
  matrix:
    target: [chrome, firefox, edge]
```

Each matrix entry:
1. Build target with WXT.
2. Lint (`web-ext lint` for Firefox, no lint for Chrome/Edge today).
3. Smoke test (Puppeteer for Chrome; `npm run smoke:firefox` for Firefox; Edge browser smoke remains manual until a dedicated runner is wired).
4. Upload build artifact per browser.

CI runtime impact: ~2x current runtime if matrix runs in parallel.

## Estimated effort

| Stage | Effort | Risk |
|---|---|---|
| Stage 1 (WXT scaffolding) | 1-2 weeks | Low — purely structural |
| Stage 2 (Firefox MV3) | 3-5 weeks | Medium — Firefox MV3 quirks, AMO source review |
| Stage 3 (Edge target) | 1-3 days | Trivial |
| Stage 4 (Chromium derivatives) | 1 week | Low — mostly documentation + smoke |
| Stage 5 (Orion) | 1-3 days | Low |
| Stage 6 (Safari) | 8-16 weeks | High — Swift, App Store, iOS quirks |

Total: 6-10 weeks for Chrome + Firefox + Edge + derivatives + Orion. Safari adds another 8-16 weeks behind a decision gate.

## Open questions

1. **TS migration prerequisite:** Phase 1 (TypeScript migration) is partially shipped. Some pages (`pages/dashboard.js`, etc.) are still JS. WXT supports both, but auto-imports + type checking work best with TS. Decision: ship Stage 1 with mixed JS/TS, finish Phase 1 in parallel.
2. **Monaco bundling on Firefox:** Monaco's worker scripts require `web_accessible_resources` UUID handling. WXT handles this for the Chrome `chrome-extension://` UUID; Firefox's random UUIDs need build-time resolution. Verify Monaco loads correctly under Firefox before declaring Stage 2 complete.
3. **Cloud sync on Firefox:** OAuth refresh tokens, PKCE flows — should work identically via `browser.identity.launchWebAuthFlow`. Test against Dropbox + Google Drive + OneDrive.
4. **Firefox AMO source review:** AMO requires unminified source for any minified extension. The build pipeline must produce a source archive alongside the `.xpi`. WXT supports this via `build.sourceMap` and an archive step.
5. **Version-string sync:** Chrome and Firefox manifests must declare the same version string. Add a CI lint that fails if `manifest.json` version ≠ `manifest-firefox.json` version (already partially in place).

## Source citations

- [WXT — Target different browsers](https://wxt.dev/guide/essentials/target-different-browsers.html)
- [WXT — Manifest generation](https://wxt.dev/guide/essentials/manifest.html)
- [MDN — browser_specific_settings](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings)
- [Mozilla's webextension-polyfill](https://github.com/mozilla/webextension-polyfill)
- [Firefox userScripts API (optional_permissions)](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/userScripts)
- [Firefox declarativeNetRequest](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/declarativeNetRequest)
- [Chrome vs Firefox API differences](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Chrome_incompatibilities)
- [Edge Chrome-port guide](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/port-chrome-extension)
- [Edge supported extension APIs](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/api-support)
- [Edge Add-ons publish guide](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension)
- [Edge Add-ons REST update API](https://learn.microsoft.com/en-us/microsoft-edge/extensions/update/api/using-addons-api)
- [Brave Shields + extension interactions](https://brave.com/shields/)
- [Orion browser (Kagi)](https://browser.kagi.com/)
- [Safari Web Extensions](https://developer.apple.com/safari/extensions/)
- [quoid/userscripts](https://github.com/quoid/userscripts)
- ROADMAP.md Phase 33 (full subtask listing)
- ROADMAP.md Round 9 sources 180–192
