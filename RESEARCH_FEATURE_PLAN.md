# Project Research and Feature Plan

## Executive Summary

ScriptVault is a Chrome Manifest V3 userscript manager at local version 3.11.0 with a broad, security-oriented feature set: `.user.js` install interception, a Monaco editor, dashboard and side panel management, cloud sync, update checks, static analysis, DevTools visibility, trash recovery, localization, and a TypeScript mirror that is not yet the canonical runtime source. The strongest current shape is a mature local-first power-user extension with unusually deep hardening notes and tests. The highest-value direction is to reduce trust and release risk before adding novelty: reconcile public release drift, close runtime JavaScript and TypeScript drift, finish consent-first update handling, harden remote fetch/install paths, make large libraries fast, and complete the first verified Firefox sideload path.

Top opportunities, in priority order:

1. **P0 - Reconcile release state and publishing automation.** Verified local tags reach `v3.11.0`, `manifest.json` and `package.json` are 3.11.0, but the latest GitHub release is still `v2.3.4`.
2. **P0 - Close TypeScript/runtime drift before making TS canonical.** Verified drift remains in `src/background/install-handler.ts`, and recent runtime stream-bounded fetch hardening has not been ported to the background TS mirror.
3. **P0 - Finish stream-bounded remote script and update fetch parity.** Verified commit `053c1a5` closes the runtime DoS class with tests; remaining work is background TS mirror parity and release verification.
4. **P0 - Add a global pending-update inbox and consent mode.** Per-script interactive updates exist, while `UpdateSystem.autoUpdate()` still auto-applies when `settings.autoUpdate` is true.
5. **P0 - Move userscript messaging/XHR off the page `postMessage` bridge where Chrome supports `runtime.onUserScriptMessage`.** Chrome's official docs now describe dedicated user-script message handlers for less-trusted user-script contexts.
6. **P1 - Virtualize dashboard, card, and side-panel script lists.** `pages/dashboard.js::renderScriptTable()` still renders the list directly and is repeatedly called after search, sort, restore, update, and settings actions.
7. **P1 - Complete Firefox Phase 1 temporary sideload.** `FIREFOX-PORT.md` still has clean sideload unchecked despite `manifest-firefox.json` being version-synced.
8. **P1 - Align trash storage with the product promise.** Runtime trash exists, but it is stored in `chrome.storage.local` rather than the IndexedDB-backed store described by roadmap history.
9. **P1 - Refresh privacy, sync, and store disclosures.** `PRIVACY.md` says data never leaves the device unless exported, while README and code expose cloud sync providers.
10. **P2 - Add provenance and supply-chain checks for `@require`.** The design exists in `docs/require-provenance-design.md`; implementation is still deferred.

## Evidence Reviewed

Local files and directories inspected:

- `CLAUDE.md`, `README.md`, `ROADMAP.md`, `CHANGELOG.md`, `FIREFOX-PORT.md`, `PRIVACY.md`, `CWS_COOKIES_JUSTIFICATION.md`, `RESEARCH_FEATURE_PLAN.md`.
- `manifest.json`, `manifest-firefox.json`, `package.json`, `package-lock.json`, `esbuild.config.mjs`, `build.sh`, `publish.sh`, `.gitignore`.
- `.github/workflows/ci.yml`, `.factory/state.yaml`, `.factory/large-repo-state.yaml`.
- `background.core.js`, generated/runtime `background.js` policy from repo notes, `modules/*.js`, `shared/*.js`, `bg/*.js`, `pages/*.js`, `src/**/*.ts`, `tests/*.test.js`, `docs/*.md`.
- No dirty files outside this report at verification time.

Git, build, and release evidence:

- Current branch: `main`, tracking `origin/main`, ahead by 1 commit before this report change.
- Current recent HEAD before this report: `428b718 Hardening pass round 2: gist token promise hang fix + TS @grant none drift`.
- `rtk git log -10` reviewed commits from `428b718` through recent Phase 39/40 and repo-hygiene work.
- `gh issue list --limit 50 --state all`: no issues returned.
- `git tag --sort=-v:refname`: latest local tag `v3.11.0`.
- `gh release list --limit 10`: latest GitHub release `v2.3.4` from 2026-04-29.
- `npm audit --audit-level=high --omit=optional`: 0 high-severity vulnerabilities found.
- `npm outdated --json`: dev dependency drift in `@vitest/coverage-v8`, `chrome-types`, `esbuild`, `jsdom`, `monaco-editor`, `puppeteer-core`, `typescript`, and `vitest`.
- `.github/workflows/ci.yml`: Node 20 CI runs audit, typecheck, tests, build, dashboard smoke, package artifact upload; audit is currently `continue-on-error: true`; there is no release publishing workflow.

External sources reviewed:

- [Chrome userScripts API](https://developer.chrome.com/docs/extensions/reference/api/userScripts): availability, user-script toggle behavior, dedicated `runtime.onUserScriptMessage`, and update re-registration requirements.
- [Chrome structured clone messaging](https://developer.chrome.com/blog/structured-clone-messaging): ecosystem direction for extension messaging payload fidelity.
- [Chrome Web Store API v2](https://developer.chrome.com/blog/cws-api-v2): release automation and OAuth/OIDC direction.
- [WXT browser targeting guide](https://wxt.dev/guide/essentials/target-different-browsers.html): cross-browser build targeting patterns.
- [MDN Chrome incompatibilities](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Chrome_incompatibilities): Firefox incompatibilities relevant to Chrome MV3 APIs.
- [MDN `browser_specific_settings`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings): Firefox manifest expectations.
- [Tampermonkey changelog](https://www.tampermonkey.net/changelog.php): current competitor behavior and update-policy direction.
- [Violentmonkey v2.37.0 release](https://github.com/violentmonkey/violentmonkey/releases/tag/v2.37.0): current open-source competitor feature movement.
- Project-local `docs/cross-browser-pipeline.md`, which already cites WXT, MDN, Edge Add-ons, Orion, and Safari extension-converter sources.

Areas that could not be verified in this pass:

- Live Chrome extension runtime behavior in an installed browser profile.
- Live Firefox temporary sideload result.
- Chrome Web Store dashboard state, publish queue, privacy disclosure form, and OAuth project ownership.
- Real cloud sync credentials and provider-specific token refresh behavior.
- Live installed-browser behavior for the newly committed hardening passes `053c1a5` and `428b718`.

## Current Product Map

Core workflows:

- Install scripts from `.user.js` navigation, URL entry, manual code, or import.
- Review an install page, parse userscript metadata, and persist scripts.
- Manage scripts in a dashboard: enable or disable, search, sort, tag or folder, edit, update, export, restore, delete, and open diagnostics.
- Edit scripts in Monaco with linting, snippets, formatting, metadata helpers, and command palette actions.
- Register scripts through `chrome.userScripts`, re-register after settings or extension lifecycle events, and expose GM/TM-compatible APIs through runtime modules.
- Check upstream updates with ETag/Last-Modified support and optional auto-update.
- Sync or back up scripts through Google Drive, Dropbox, OneDrive, WebDAV, Easy Cloud, Gist, and local export flows.
- Analyze scripts for risky patterns, signing, trust, and permissions.
- Inspect runtime behavior through DevTools, error logs, network logs, and dashboard diagnostics.
- Use popup, side panel, context menus, omnibox keyword `sv`, and keyboard commands to reach common actions.

Project type, stack, and build:

- Browser extension: Chrome MV3 primary, Firefox WebExtension port in progress.
- Runtime source: JavaScript modules and concatenated service worker; repo guidance says edit `background.core.js`, `bg/`, `modules/`, `shared/`, and page JS, not generated `background.js`.
- Type system: TypeScript mirror under `src/`, used for typecheck and parity migration but not yet the runtime build source.
- Package manager: npm with `package-lock.json`.
- Build system: `npm run build`, `npm run build:bg`, `npm run build:prod`, `bash build.sh`, esbuild config, Chrome ZIP packaging.
- Test system: Vitest, dashboard smoke tests, typecheck, and Chrome-headless smoke in CI.
- Release process: local tags and packaging scripts exist; GitHub Releases lag local tags and no GitHub release workflow is present.

Major modules and entry points:

- Service worker/runtime core: `background.core.js`, generated `background.js`, `src/background/*.ts`.
- Userscript APIs: `modules/*.js`, `src/modules/*.ts`, especially XHR, storage, sync, grants, public API, error log.
- Storage: `modules/storage.js`, `src/storage/*`, IndexedDB for scripts/settings and `chrome.storage.local` for smaller state.
- UI surfaces: `pages/dashboard.html/js/css`, `pages/editor.html/js/css`, `pages/install.html/js/css`, `pages/sidepanel.html/js/css`, popup files, DevTools panel files.
- Static analysis and trust: `bg/analyzer.js`, `bg/signing.js`, `docs/require-provenance-design.md`.
- Config and defaults: `src/config/settings-defaults.json`, manifests, locale files under `_locales/`.
- Release and CI: `.github/workflows/ci.yml`, `build.sh`, `publish.sh`, `docs/release-runbook.md`.

User personas:

- Power users with dozens or hundreds of installed userscripts who need fast search, bulk management, and reliable updates.
- Security-sensitive users who inspect permissions, signatures, remote code, and update diffs.
- Script authors who need a capable editor, metadata validation, debugging, and test/install loops.
- Cross-browser users who expect Firefox/Edge parity and portable backups.
- Maintainers who need reproducible release artifacts, privacy/store disclosure consistency, and low-risk migration paths.

Platforms and distribution channels:

- Verified primary: Chrome MV3, minimum Chrome 130 in `manifest.json`.
- In progress: Firefox via `manifest-firefox.json`, minimum Firefox 128.
- Planned or researched: Edge Add-ons, other Chromium browsers, WXT pipeline, Orion/Safari considerations in docs.
- Public distribution state is inconsistent: Chrome Web Store link exists in README, local tags are 3.x, GitHub Releases stop at 2.3.4.

Important permissions, integrations, and data flows:

- Required permissions include `storage`, `tabs`, `notifications`, `contextMenus`, `scripting`, `userScripts`, `webNavigation`, `unlimitedStorage`, `alarms`, `downloads`, `declarativeNetRequest`, `declarativeNetRequestWithHostAccess`, `sidePanel`, and `offscreen`.
- Optional permissions include `clipboardWrite`, `clipboardRead`, `identity`, and `cookies`.
- Host permission is `<all_urls>`, expected for a userscript manager but high-trust.
- Remote network flows include userscript install/update URLs, `@require` fetches, GM XHR/fetch, update checks, catalog/script-source access, and cloud sync provider APIs.
- User data includes scripts, metadata, settings, folders, workspaces, trash, sync tokens/config, logs, cached requires, update metadata, and backups.

## Feature Inventory

### Script Install and Import

- **User value:** Quickly install scripts from `.user.js` URLs, pasted code, local import, or programmatic URL actions.
- **Entry point:** `.user.js` navigation interception, dashboard install/import controls, `installFromUrl`, install page.
- **Main code locations:** `background.core.js::_fetchPendingUserscript`, `background.core.js::installFromUrl`, `pages/install.*`, `src/background/install-handler.ts`, tests around install/update flows.
- **Current maturity:** Partial. Core behavior exists, and commit `053c1a5` adds runtime bounded-fetch protection, but background TS mirror files still show the older buffered pattern.
- **Tests/docs coverage:** Covered by install docs and tests, but stream-bounded fetch behavior needs explicit JS and TS tests.
- **Improvement opportunities:** Finish `_fetchTextBounded` in both runtime and TS mirror; add fake `ReadableStream` tests; add storage quota failure tests for `pendingInstall`; add DNS rebinding post-fetch verification for remote install.

### Script Dashboard Management

- **User value:** Manage installed scripts through search, sort, table/card views, folders, workspaces, enable/disable, delete, restore, and bulk operations.
- **Entry point:** `pages/dashboard.html`, extension action, side panel/dashboard links.
- **Main code locations:** `pages/dashboard.js`, `pages/dashboard.css`, `src/types/messages.ts`, background message handler cases.
- **Current maturity:** Complete for normal-sized libraries, performance-risk for large libraries.
- **Tests/docs coverage:** Dashboard accessibility/module tests exist; roadmap references large-library performance work.
- **Improvement opportunities:** Add virtual list rendering; preserve selection/focus/scroll across filter and restore; add performance tests around 500 and 2,000 script fixtures.

### Trash and Recovery

- **User value:** Recover accidentally deleted scripts and empty trash intentionally.
- **Entry point:** Dashboard trash tab, delete/restore/empty actions.
- **Main code locations:** `background.core.js` cases `getTrash`, `restoreFromTrash`, `emptyTrash`, `permanentlyDelete`; `pages/dashboard.js` trash UI; `src/types/messages.ts` trash message types; `src/config/settings-defaults.json`.
- **Current maturity:** Complete UI/runtime behavior, but storage design is inconsistent with roadmap history.
- **Tests/docs coverage:** Dashboard tests reference trash actions; roadmap says Phase 12.13 should use an IndexedDB `scripts_trash` store with retention semantics.
- **Improvement opportunities:** Either migrate trash to IDB with retention indexes or update roadmap/docs to declare the `chrome.storage.local` array intentional; add quota and many-deleted-script tests; expose per-item expiry metadata in the UI.

### Monaco Script Editor

- **User value:** Author and edit scripts with syntax highlighting, metadata support, snippets, and safer save behavior.
- **Entry point:** `pages/editor.html`, dashboard edit buttons, install/edit flows.
- **Main code locations:** `pages/editor.js`, `pages/editor.css`, Monaco assets, parser modules, tests around metadata/editor if present.
- **Current maturity:** Complete and differentiated.
- **Tests/docs coverage:** README and roadmap document editor capabilities.
- **Improvement opportunities:** Add metadata grant advisor; add update-diff editor merge UX; add autosave conflict recovery for edits made while an upstream update is pending.

### Update Checking and Applying

- **User value:** Keep scripts current while avoiding silent takeover or overwriting local edits.
- **Entry point:** Auto-update alarm, dashboard update controls, per-row update icon, settings.
- **Main code locations:** `background.core.js::UpdateSystem`, `pages/dashboard.js::interactiveCheckAndConfirmUpdate`, `src/background/update-checker.ts`, settings defaults.
- **Current maturity:** Partial. Per-script interactive diff exists; global auto-update still installs when `settings.autoUpdate` is true.
- **Tests/docs coverage:** Roadmap references Phase 17.3, 38.3, and 38.9; update tests exist.
- **Improvement opportunities:** Split check scheduling from apply policy; add pending update inbox; add defaults that do not silently overwrite scripts; expose batch approve/reject; test local-edited and `@nodownload` cases.

### GM/TM API Compatibility and XHR

- **User value:** Run existing userscripts from Tampermonkey/Violentmonkey/Greasemonkey with minimal changes.
- **Entry point:** Registered userscripts call GM APIs.
- **Main code locations:** `modules/*.js`, `modules/xhr.js`, `src/modules/*.ts`, `background.core.js` message handling, `src/types/messages.ts`.
- **Current maturity:** Broad but still advancing.
- **Tests/docs coverage:** XHR tests, roadmap compatibility phases, extension-interop doc.
- **Improvement opportunities:** Implement `GM_fetch`; support AbortSignal for `GM_xmlhttpRequest`; support cookie partition controls; migrate user-script messaging to `runtime.onUserScriptMessage` where available; keep structured-clone compatibility gated by Chrome version.

### Cloud Sync and Backup

- **User value:** Preserve scripts and settings across devices and recover from data loss.
- **Entry point:** Dashboard/settings sync panels, backup/export/import actions.
- **Main code locations:** `modules/sync-providers.js`, sync settings modules, backup scheduler, cloud provider auth flows.
- **Current maturity:** Feature-rich but disclosure-sensitive.
- **Tests/docs coverage:** README advertises providers; privacy policy is stale; release docs mention disclosure work.
- **Improvement opportunities:** Update privacy text and store disclosures; add token refresh diagnostics; add encrypted export/import option; add provider capability matrix; add conflict previews before overwrite.
- **Additional evidence:** Commit `428b718` replaces legacy callback-wrapped Gist token `chrome.storage.local` writes with Promise API calls so quota/disk failures do not hang the UI.

### Static Analyzer, Signing, and Trust

- **User value:** Understand risky script capabilities before install or update.
- **Entry point:** Install page, dashboard analyzer/trust panels, signing tools.
- **Main code locations:** `bg/analyzer.js`, `bg/signing.js`, trust UI, `docs/require-provenance-design.md`.
- **Current maturity:** Advanced for local analysis, incomplete for supply-chain provenance.
- **Tests/docs coverage:** Roadmap and docs cover analyzer detectors and provenance design.
- **Improvement opportunities:** Add `@require` provenance verification; show remote dependency diff on update; detect minified remote dependency changes; add trusted-source policy profiles.

### DevTools, Error Log, and Diagnostics

- **User value:** Debug script failures, inspect network/activity logs, and export diagnostic data.
- **Entry point:** DevTools panel, dashboard logs, export buttons.
- **Main code locations:** `pages/devtools-*`, `modules/error-log.js`, `modules/public-api.js`, TS mirrors, background log handlers.
- **Current maturity:** Useful but fragmented.
- **Tests/docs coverage:** Tests exist for modules; commit `053c1a5` adds CSV injection mitigation and public API error hardening.
- **Improvement opportunities:** Add public API fuzz tests and a unified diagnostics bundle; include extension version, manifest version, Chrome version, permissions state, failed registrations, sync status, and recent errors.

### Public API and Web Page Bridge

- **User value:** Let approved external pages or tooling interact with ScriptVault.
- **Entry point:** `window.postMessage` bridge and public API handlers.
- **Main code locations:** `modules/public-api.js`, `src/modules/public-api.ts`.
- **Current maturity:** Partial and security-sensitive.
- **Tests/docs coverage:** Commit `053c1a5` adds type guards and removes internal error detail from external responses; targeted public API fuzz tests are still recommended.
- **Improvement opportunities:** Add origin allowlist UI/audit review; add fuzz tests for structured-clone payloads; commit generic-error behavior; document external API stability and versioning.

### Side Panel, Popup, Context Menus, Omnibox

- **User value:** Quick access without opening the full dashboard.
- **Entry point:** Chrome side panel, popup, context menus, omnibox keyword `sv`, commands.
- **Main code locations:** `pages/sidepanel.*`, popup files, manifest `omnibox` and `commands`, background command/context menu handlers.
- **Current maturity:** Complete for Chrome; Firefox compatibility not complete.
- **Tests/docs coverage:** README now documents omnibox; smoke tests cover dashboard more than side panel.
- **Improvement opportunities:** Add side-panel smoke tests; virtualize side-panel script lists; add command availability diagnostics when optional permissions are missing.

### Localization, Themes, and Accessibility

- **User value:** Use the extension across languages, themes, and accessibility modes.
- **Entry point:** Settings, UI surfaces, `_locales/`.
- **Main code locations:** `_locales/*`, dashboard/editor/install CSS and JS, `docs/wcag3-gap-analysis.md`.
- **Current maturity:** Strong baseline with known gaps.
- **Tests/docs coverage:** Accessibility tests exist; WCAG 3 gap doc lists next work.
- **Improvement opportunities:** Add skip-to-main links, APCA/forced-colors audit, combobox/grid APG checks, live-region review, and mixed-language `lang` annotations.

### Firefox Port

- **User value:** Use ScriptVault outside Chrome without switching products.
- **Entry point:** `manifest-firefox.json`, Firefox build/sideload flow.
- **Main code locations:** `FIREFOX-PORT.md`, `manifest-firefox.json`, build scripts, registration/offscreen/sidePanel/Monaco code paths.
- **Current maturity:** Partial. Manifest version is synced, but clean temporary sideload is unchecked.
- **Tests/docs coverage:** Port plan is detailed; runtime validation is not complete.
- **Improvement opportunities:** Strip/guard unsupported Chrome-only APIs, validate Monaco loading, choose provider scope for first Firefox release, produce a clean XPI artifact only through build output.

## Competitive and Ecosystem Research

### Tampermonkey

- **Product/source:** [Tampermonkey changelog](https://www.tampermonkey.net/changelog.php).
- **Notable capabilities:** Mature cross-browser distribution, stable update behavior, install/update UX expectations, policy-driven behavior for enterprise/browser stores.
- **What ScriptVault should learn:** Update consent must be a first-class setting, not only a per-row dashboard interaction; store disclosure and release polish matter as much as feature breadth.
- **What to avoid:** Avoid opaque proprietary-only behavior and avoid copying UI density that hides trust decisions.

### Violentmonkey

- **Product/source:** [Violentmonkey releases](https://github.com/violentmonkey/violentmonkey/releases), especially v2.37.x.
- **Notable capabilities:** Open-source userscript manager with active compatibility improvements, compact UX, and frequent release cadence.
- **What ScriptVault should learn:** Public releases should track code tags closely; compatibility work should be shipped incrementally and visibly.
- **What to avoid:** Do not sacrifice ScriptVault's trust/audit identity for a minimal manager clone.

### ScriptCat

- **Product/source:** Ecosystem comparator from project roadmap and common userscript-manager landscape.
- **Notable capabilities:** Script scheduling and advanced script organization patterns.
- **What ScriptVault should learn:** Power users value automation, grouping, and durable script status history.
- **What to avoid:** Avoid expanding into a general automation platform before core install/update/release trust is tight.

### Greasemonkey and Firefox WebExtensions

- **Product/source:** [MDN WebExtensions docs](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Chrome_incompatibilities).
- **Notable capabilities:** Firefox-native extension expectations differ from Chrome, especially around manifest keys, APIs, and review constraints.
- **What ScriptVault should learn:** A Chrome-first MV3 codebase needs explicit feature gates, not scattered runtime `if` guards.
- **What to avoid:** Avoid treating Firefox as a manifest copy; unsupported `sidePanel`, offscreen, sandbox, and `worldId` behavior need deliberate fallbacks.

### Chrome Extension Platform

- **Product/source:** [Chrome userScripts API](https://developer.chrome.com/docs/extensions/reference/api/userScripts) and [structured clone messaging](https://developer.chrome.com/blog/structured-clone-messaging).
- **Notable capabilities:** Chrome 120+ `userScripts`, Chrome 138+ user-facing Allow User Scripts toggle, dedicated user-script message events, and structured clone direction.
- **What ScriptVault should learn:** Onboarding must detect the current user-script toggle state; messaging should use dedicated user-script handlers where available; update re-registration after extension updates is required.
- **What to avoid:** Avoid assuming `chrome.userScripts` presence means calls will keep succeeding if the user revokes the toggle mid-session.

### WXT

- **Product/source:** [WXT browser targeting](https://wxt.dev/guide/essentials/target-different-browsers.html).
- **Notable capabilities:** Browser-specific manifest generation, entry-point organization, and cross-browser build ergonomics.
- **What ScriptVault should learn:** WXT or WXT-like staging can reduce duplicated manifest/build logic once TS is canonical.
- **What to avoid:** Avoid starting a framework migration while runtime JS and TS still drift.

### Chrome Web Store and Edge Add-ons

- **Product/source:** [Chrome Web Store API v2](https://developer.chrome.com/blog/cws-api-v2), project `docs/release-runbook.md`, and Edge Add-ons docs referenced by `docs/cross-browser-pipeline.md`.
- **Notable capabilities:** API-driven upload/publish, store listing metadata, privacy disclosures, and artifact provenance.
- **What ScriptVault should learn:** Release automation should publish artifacts and disclosures from source-controlled manifests/checklists.
- **What to avoid:** Avoid manual-only releases when local tags and public releases can drift by major versions.

### Bitwarden and Other Trust-Critical Extensions

- **Product/source:** Analogous extension category, not a direct userscript competitor.
- **Notable capabilities:** Diagnostics exports, clear vault/sync status, explicit destructive action confirmations, and release provenance.
- **What ScriptVault should learn:** Users need to see what is local, what is synced, what is pending, and what can be recovered.
- **What to avoid:** Avoid telemetry or cloud account concepts that weaken ScriptVault's local-first identity.

## Highest-Value New Features

### P0 - Pending Update Inbox and Consent Modes

- **User problem solved:** Users need update safety without disabling update checks entirely. Silent upstream script replacement is the highest-trust risk for a userscript manager.
- **Evidence:** `pages/dashboard.js::interactiveCheckAndConfirmUpdate()` supports per-script review; `background.core.js::UpdateSystem.autoUpdate()` still applies updates when `settings.autoUpdate` is true; roadmap references Phase 17.3/38.3/38.9; Tampermonkey and Violentmonkey emphasize update policy and review flows.
- **Proposed behavior:** Replace binary `autoUpdate` with `updateCheckEnabled` and `updateInstallMode`: `manual`, `checkOnly`, `review`, `autoInstallTrusted`. Store pending update records with script id, version, source URL, diff summary, risk delta, fetched timestamp, ETag/Last-Modified, and user decision.
- **Implementation areas:** `background.core.js::UpdateSystem`, `src/background/update-checker.ts`, settings defaults, dashboard settings/update UI, `src/types/messages.ts`, storage migration, tests.
- **Data model/API/UI implications:** Add `pending_updates` IDB store or equivalent; add dashboard tab/badge; add message actions for list/apply/reject updates; migrate old `autoUpdate` values.
- **Risks and edge cases:** Update sources that disappear; local user edits; scripts with `@nodownload`; malicious version downgrades; bulk approve with failed registration; user confusion if checks happen but install does not.
- **Verification plan:** Unit tests for each mode; integration test for local-edited skip; manual flow installing a fixture script, changing fixture version, checking, reviewing diff, applying, rejecting, and restoring previous version.
- **Estimated complexity:** L.
- **Priority:** P0.

### P0 - Dedicated User-Script Messaging Path

- **User problem solved:** The current bridge surface is larger than necessary for less-trusted script contexts and external page messages.
- **Evidence:** Chrome docs describe `runtime.onUserScriptMessage` and `runtime.onUserScriptConnect` as dedicated handlers that help identify less-trusted user-script messages; `background.core.js` already has an `onUserScriptMessage` listener; `.factory/large-repo-state.yaml` keeps `XHR-PRIVACY` as a remaining large task; commit `053c1a5` hardened arbitrary `postMessage` payload handling in the public API.
- **Proposed behavior:** Route user-script GM API messages through `chrome.runtime.onUserScriptMessage` when available, with a compatibility fallback for older Chrome or disabled messaging. Keep web-page public API messages on a separate explicitly permissioned bridge.
- **Implementation areas:** `background.core.js`, `modules/xhr.js`, GM API wrappers, registration `configureWorld({ messaging: true })`, `src/background/registration.ts`, `src/types/messages.ts`, tests.
- **Data model/API/UI implications:** Add capability detection status and diagnostics; no user data format change expected.
- **Risks and edge cases:** Chrome version gates; userScripts toggle revocation; Firefox incompatibility; scripts running in MAIN vs USER_SCRIPT worlds; structured-clone payload differences.
- **Verification plan:** Chrome fixture userscript sends XHR/GM messages; fallback path test; fuzz arbitrary web `postMessage` payloads; regression test that external public API cannot reach GM internals.
- **Estimated complexity:** L.
- **Priority:** P0.

### P0 - Stream-Bounded Remote Fetch Guardrail

- **User problem solved:** A hostile update/install/require server can omit or lie about `Content-Length` and force the service worker to buffer an oversized response before rejection.
- **Evidence:** Commit `053c1a5` adds `_fetchTextBounded()` to `background.core.js`, replaces `response.text()` in update, install, URL fetch, and `@require` code paths, and adds `tests/fetch-bounded.test.js`; `src/background/update-checker.ts` and `src/background/install-handler.ts` still use buffered `response.text()`.
- **Proposed behavior:** Ship a shared bounded text fetch helper across runtime and TS source, with tests using a stream that exceeds the cap after multiple chunks.
- **Implementation areas:** `background.core.js`, `src/background/update-checker.ts`, `src/background/install-handler.ts`, require loader code, tests.
- **Data model/API/UI implications:** Error strings should stay user-readable and compatible with current install/update UI.
- **Risks and edge cases:** Test mocks without `Response.body`; multibyte UTF-8 chunk boundaries; abort cleanup; inconsistent labels in error messages.
- **Verification plan:** Vitest unit tests for honest oversized `Content-Length`, missing length with oversized stream, fallback non-stream response, aborted fetch, and multibyte text below cap.
- **Estimated complexity:** M.
- **Priority:** P0.

### P1 - Large Library Performance Mode

- **User problem solved:** Users with hundreds or thousands of scripts need instant search/sort/filter without dashboard jank.
- **Evidence:** `pages/dashboard.js::renderScriptTable()` directly re-renders lists and is called from many actions; roadmap already identifies Phase 7.1 virtual scrolling; no virtualization package or implementation was found.
- **Proposed behavior:** Add a shared virtual list renderer for dashboard table/card views and side panel, preserving keyboard focus, selection, scroll offset, and ARIA row semantics.
- **Implementation areas:** `pages/dashboard.js`, `pages/dashboard.css`, `pages/sidepanel.js`, tests, optional `@tanstack/virtual-core` dependency.
- **Data model/API/UI implications:** No storage migration; UI must keep existing views and filters.
- **Risks and edge cases:** Screen reader row counts; keyboard navigation; row height changes from localization; restoring focus after updates/trash restore.
- **Verification plan:** Fixture with 2,000 scripts; measure render time before/after; Playwright or smoke test for search, sort, delete, restore, and keyboard navigation.
- **Estimated complexity:** L.
- **Priority:** P1.

### P1 - Firefox Sideload Beta

- **User problem solved:** Users need a credible non-Chrome path and maintainers need real compatibility evidence before public AMO decisions.
- **Evidence:** `FIREFOX-PORT.md` Phase 1 clean temporary sideload is unchecked; `manifest-firefox.json` is version-synced to 3.11.0; MDN documents Chrome incompatibilities and Firefox manifest expectations.
- **Proposed behavior:** Produce a temporary Firefox sideload build that loads cleanly, disables unsupported Chrome-only surfaces, and validates install/edit/run/update for a small fixture script.
- **Implementation areas:** `manifest-firefox.json`, build scripts, sidePanel/offscreen/sandbox guards, `src/background/registration.ts`, Monaco asset loading, docs.
- **Data model/API/UI implications:** Provider scope decision for Firefox sync; Firefox-specific settings compatibility notes.
- **Risks and edge cases:** `worldId`, offscreen documents, side panel, sandbox pages, Monaco worker loading, sync providers needing `identity`, API namespace differences.
- **Verification plan:** `npm run build`; Firefox temporary install; manual fixture script install/run/edit/update; capture errors; update `FIREFOX-PORT.md`.
- **Estimated complexity:** L.
- **Priority:** P1.

### P1 - IDB-Backed Trash and Recovery Timeline

- **User problem solved:** Users need reliable recovery without risking `chrome.storage.local` quota or losing restore metadata for large deleted scripts.
- **Evidence:** Runtime trash actions exist in `background.core.js`; dashboard trash UI exists; roadmap history describes an IndexedDB `scripts_trash` store with retention, while current implementation uses `chrome.storage.local`.
- **Proposed behavior:** Store deleted scripts in IDB with deleted timestamp, expiry timestamp, original folder/workspace, size, source, and restore state. Keep current UI but add expiry and size details.
- **Implementation areas:** `modules/storage.js`, storage migrations, background trash handlers, dashboard trash UI, `src/types/messages.ts`, tests.
- **Data model/API/UI implications:** Add IDB object store and migration from existing `chrome.storage.local.trash`; preserve existing settings values.
- **Risks and edge cases:** Migration failures; restoring over existing script ids; old backups containing trash; empty trash performance.
- **Verification plan:** Migration test from storage.local trash; restore/delete/empty tests; quota simulation; manual delete/restore flow.
- **Estimated complexity:** M.
- **Priority:** P1.

### P1 - Install Trust Center

- **User problem solved:** Before installing or updating, users need one consolidated view of what a script can do and what changed.
- **Evidence:** Analyzer/signing/update diff pieces exist; install/update flows are separate; permissions and host access are broad by design.
- **Proposed behavior:** Install/update screen shows metadata, requested grants, host matches, external dependencies, analyzer findings, source reputation, signature/provenance status, update diff, and recovery option.
- **Implementation areas:** `pages/install.*`, analyzer modules, signing modules, update diff UI, dashboard update inbox.
- **Data model/API/UI implications:** Store last trust summary and accepted risk state per script.
- **Risks and edge cases:** False positives; too much text; localized microcopy; remote dependency fetch failures.
- **Verification plan:** Fixture scripts for each detector class; install/update screenshots; accessibility tests for warnings and actions.
- **Estimated complexity:** L.
- **Priority:** P1.

### P2 - `@require` Provenance Verification

- **User problem solved:** Remote dependencies are a high-risk supply-chain path that can change independently of the userscript itself.
- **Evidence:** `docs/require-provenance-design.md` exists; `fetchWithRetry()` fetches remote require code; commit `053c1a5` adds bounded fetch but not provenance.
- **Proposed behavior:** Support optional `@require-provenance` metadata with hashes/signatures, show provenance status, and block or warn on mismatch depending on policy.
- **Implementation areas:** parser, require loader, install/update UI, analyzer, settings, docs.
- **Data model/API/UI implications:** Store dependency hash/provenance metadata and policy decision.
- **Risks and edge cases:** Ecosystem adoption; hash mismatches from legitimate CDN rebuilds; offline updates; UX complexity.
- **Verification plan:** Fixtures with matching hash, mismatch, missing provenance, and changed dependency; tests for policy modes.
- **Estimated complexity:** XL.
- **Priority:** P2.

### P2 - Unified Diagnostics Bundle

- **User problem solved:** Users and maintainers need one exportable evidence package when scripts fail, sync breaks, or registration disappears.
- **Evidence:** Error log, DevTools panel, netlog, settings, registration and sync diagnostics exist as separate surfaces; commit `053c1a5` hardens CSV export, dashboard stats CSV export, and public API errors.
- **Proposed behavior:** Add a "Create diagnostics bundle" action that exports sanitized JSON plus optional CSV logs, including version, manifest, permissions, userScripts toggle result, registered script count, failed registrations, sync provider status, recent errors, and storage usage.
- **Implementation areas:** dashboard diagnostics UI, error log module, registration diagnostics, sync providers, privacy redaction utilities.
- **Data model/API/UI implications:** No persistent data required; add redaction rules.
- **Risks and edge cases:** Token leakage; script code leakage; large logs; localized timestamps.
- **Verification plan:** Snapshot tests for redaction; manual export with fake token/script; import into issue template or support doc.
- **Estimated complexity:** M.
- **Priority:** P2.

### P2 - Metadata Grant Advisor

- **User problem solved:** Script authors often miss or over-grant metadata permissions.
- **Evidence:** Monaco editor and analyzer exist; GM API modules are broad; install trust already parses grants.
- **Proposed behavior:** In editor, detect GM API usage and suggest missing `@grant`, unused grants, and risky grants with quick fixes.
- **Implementation areas:** `pages/editor.js`, parser/analyzer, snippets, metadata editor helpers, tests.
- **Data model/API/UI implications:** No migration; per-script suggestions only.
- **Risks and edge cases:** Dynamic property access; compatibility with `GM.*` and legacy `GM_` names; false positives for strings/comments.
- **Verification plan:** Fixture scripts for each GM API; editor action tests; save and reparse metadata.
- **Estimated complexity:** M.
- **Priority:** P2.

## Existing Feature Improvements

### Release State and Public Artifact Drift

- **Current behavior:** Local source, manifests, package, and tags are at 3.11.0; GitHub Releases latest is 2.3.4; no release workflow exists.
- **Problem or missed opportunity:** Users and maintainers cannot tell what the current public artifact is. This weakens trust and makes regression reports ambiguous.
- **Recommended change:** Create a release reconciliation checklist and workflow that packages artifacts, verifies versions, creates or updates GitHub Releases, and links Chrome Web Store status.
- **Code locations likely affected:** `.github/workflows/ci.yml`, `docs/release-runbook.md`, `publish.sh`, `build.sh`, `CHANGELOG.md`, `README.md`.
- **Backward compatibility concerns:** Do not republish old version numbers with different artifacts; choose patch/minor version intentionally.
- **Verification plan:** `gh release list --limit 5`, `git tag --sort=-v:refname`, `npm run check`, `npm run smoke:dashboard`, `bash build.sh`.
- **Estimated complexity:** M.
- **Priority:** P0.

### TypeScript Mirror Drift

- **Current behavior:** Runtime JS remains canonical while TS mirror is typechecked. `src/background/install-handler.ts` still uses `Set<string>` duplicate handling and buffered `response.text()`, while recent runtime work and changelog indicate Map/promise caps and bounded fetch hardening.
- **Problem or missed opportunity:** Typecheck can pass while future TS build would reintroduce fixed runtime bugs.
- **Recommended change:** Add parity tests or source-generation guards before flipping to TS canonical; port current runtime hardening to TS mirror; stop accepting runtime-only fixes.
- **Code locations likely affected:** `background.core.js`, `src/background/*.ts`, `src/modules/*.ts`, `esbuild.config.mjs`, tests.
- **Backward compatibility concerns:** The generated `background.js` contract and Chrome MV3 service worker behavior must stay stable.
- **Verification plan:** `npm run typecheck`; targeted parity tests; `npm run build`; compare registered behavior on fixture scripts.
- **Estimated complexity:** L.
- **Priority:** P0.

### Auto-Update Still Overloads Check and Install

- **Current behavior:** `settings.autoUpdate` controls scheduled update application; per-row update review exists separately.
- **Problem or missed opportunity:** A user cannot safely keep update checks on while requiring review for install.
- **Recommended change:** Split scheduler from installation policy and default new installs to review/check-only unless user explicitly chooses auto-install.
- **Code locations likely affected:** `background.core.js::UpdateSystem`, settings defaults, dashboard settings, update UI, tests.
- **Backward compatibility concerns:** Migrate existing `autoUpdate: true` users with a clear prompt or one-time default policy.
- **Verification plan:** Simulate settings migration; scheduled alarm should create pending updates but not apply in review mode.
- **Estimated complexity:** L.
- **Priority:** P0.

### Privacy Policy Does Not Match Cloud Sync Feature Surface

- **Current behavior:** `PRIVACY.md` says data never leaves the device unless exported, while README and code expose cloud sync providers.
- **Problem or missed opportunity:** Store review and user trust can fail because disclosures are incomplete.
- **Recommended change:** Update privacy policy and store-disclosure checklist to describe each provider, OAuth/token storage, script data uploaded, optional nature, and revocation/deletion path.
- **Code locations likely affected:** `PRIVACY.md`, `README.md`, `docs/release-runbook.md`, CWS disclosure docs.
- **Backward compatibility concerns:** No behavior change; disclosure-only.
- **Verification plan:** Compare README sync provider list to privacy table; review CWS privacy fields manually.
- **Estimated complexity:** S.
- **Priority:** P1.

### Release Runbook Is Stale About CWS Upload CLI

- **Current behavior:** `docs/release-runbook.md` still discusses moving from `chrome-webstore-upload-cli` 3.5.0 to 4.0.0, but `package.json` already uses `^4.0.0` and `npm view` confirms 4.0.0 current.
- **Problem or missed opportunity:** Maintainers may follow obsolete release instructions.
- **Recommended change:** Update runbook to current package state, Node requirements, CWS API v2 decisions, and exact release commands.
- **Code locations likely affected:** `docs/release-runbook.md`, `package.json`, `.github/workflows/ci.yml`.
- **Backward compatibility concerns:** None.
- **Verification plan:** `npm view chrome-webstore-upload-cli version`; dry-run package build; review docs.
- **Estimated complexity:** S.
- **Priority:** P1.

### CI Audit Is Non-Blocking

- **Current behavior:** CI runs `npm audit --audit-level=high --omit=optional` with `continue-on-error: true`.
- **Problem or missed opportunity:** The project can upload artifacts despite high-severity advisories.
- **Recommended change:** Make audit blocking once current zero-vulnerability baseline is confirmed; if transient registry noise is a concern, isolate it to scheduled advisory review rather than PR packaging.
- **Code locations likely affected:** `.github/workflows/ci.yml`.
- **Backward compatibility concerns:** CI may fail on new advisories; that is intended for release safety.
- **Verification plan:** `npm audit --audit-level=high --omit=optional`; CI PR run.
- **Estimated complexity:** S.
- **Priority:** P1.

### Stale Root XPI Artifact

- **Current behavior:** `ScriptVault-firefox-v2.1.7.xpi` exists in the repo root locally while manifests are 3.11.0 and `.gitignore` ignores XPI artifacts.
- **Problem or missed opportunity:** Local artifact drift can confuse manual sideload and release work.
- **Recommended change:** Move generated artifacts to a build output folder only, add a release-clean check that refuses stale root ZIP/XPI files, and document artifact naming.
- **Code locations likely affected:** `.gitignore`, `build.sh`, release docs, optional cleanup script.
- **Backward compatibility concerns:** Do not delete user-needed artifacts without confirmation if they are not tracked.
- **Verification plan:** `git status --ignored --short`; build artifact path check.
- **Estimated complexity:** S.
- **Priority:** P1.

### Public API Error Detail and Message Type Guard

- **Current behavior:** Commit `053c1a5` removes internal error detail from external API responses and guards `data.type` before calling `.startsWith()`.
- **Problem or missed opportunity:** The behavior is improved, but a targeted public API fuzz test was not observed in the same way error-log CSV tests were.
- **Recommended change:** Backfill tests for arbitrary structured-clone `postMessage` payloads and generic external exception responses.
- **Code locations likely affected:** `modules/public-api.js`, `src/modules/public-api.ts`, tests.
- **Backward compatibility concerns:** External callers lose the `detail` field on internal exceptions; this is a security-positive breaking change for undocumented internals.
- **Verification plan:** Fuzz `postMessage` payloads with non-string `type`; handler exception fixture should return `{ error: "Internal error" }` only.
- **Estimated complexity:** S.
- **Priority:** P1.

### CSV Formula Injection in Error Export

- **Current behavior:** Commit `053c1a5` prefixes dangerous CSV cells in error log export, dashboard CSP export, and dashboard stats export.
- **Problem or missed opportunity:** User-controlled error text, script names, URLs, tags, and match patterns can become spreadsheet formulas when exported and opened.
- **Recommended change:** Keep the mitigation; add or confirm dashboard CSV export tests in addition to the committed error-log tests.
- **Code locations likely affected:** `modules/error-log.js`, `src/modules/error-log.ts`, tests.
- **Backward compatibility concerns:** CSV values starting with formula characters gain a visible apostrophe in spreadsheet tools.
- **Verification plan:** Export errors beginning with `=`, `+`, `-`, `@`, tab, and carriage return; verify CSV opens as literal text.
- **Estimated complexity:** S.
- **Priority:** P1.

### Gist Token Storage Failure Handling

- **Current behavior:** Commit `428b718` updates `pages/dashboard-gist.js` so token save/clear/autosync persistence uses the MV3 Promise API and no longer hangs if `chrome.storage.local.set()` or `.remove()` rejects.
- **Problem or missed opportunity:** The failure mode is fixed in code, but no focused test was found for quota/disk-write rejection paths.
- **Recommended change:** Add a dashboard-gist storage failure test that mocks rejected Promise API calls and verifies the UI reports or logs the failure without leaving buttons/spinners stuck.
- **Code locations likely affected:** `pages/dashboard-gist.js`, `tests/gui-secondary-audit.test.js` or a new focused gist test.
- **Backward compatibility concerns:** None expected; failed persistence should now surface rather than hanging silently.
- **Verification plan:** Mock `chrome.storage.local.set` rejection for token save and autosync; confirm the Promise settles and UI state recovers.
- **Estimated complexity:** S.
- **Priority:** P1.

### TS Wrapper `@grant none` Drift

- **Current behavior:** Commit `428b718` updates `src/background/wrapper-builder.ts` so empty grant arrays deny GM APIs like `@grant none` instead of granting all APIs.
- **Problem or missed opportunity:** The parser usually defaults missing grants to `['none']`, so the bug was latent; a future caller bypassing the parser could still regress without a direct wrapper test.
- **Recommended change:** Add a direct `buildWrappedScript()` test for `grant: []` and `grant: ['none']` that asserts GM APIs are unavailable except `GM_info`.
- **Code locations likely affected:** `src/background/wrapper-builder.ts`, `tests/wrapper-gm-tabs-39-13.test.js` or a new wrapper grant test.
- **Backward compatibility concerns:** Scripts relying on missing metadata granting all APIs were already outside the documented contract.
- **Verification plan:** Vitest fixture builds wrappers with empty grants and asserts `GM_xmlhttpRequest`, `GM_setValue`, and other GM APIs are not exposed.
- **Estimated complexity:** S.
- **Priority:** P1.

### Dependency Refresh Batch

- **Current behavior:** Several dev dependencies are behind wanted/latest versions; Monaco is pinned below latest major/minor.
- **Problem or missed opportunity:** Tooling bugs and browser type gaps accumulate.
- **Recommended change:** Batch-update low-risk test/build dependencies first; treat Monaco as a separate UI verification pass.
- **Code locations likely affected:** `package.json`, `package-lock.json`, editor smoke tests, CI.
- **Backward compatibility concerns:** Monaco upgrades can change worker loading, CSS, and editor APIs.
- **Verification plan:** `npm outdated`, `npm update` targeted packages, `npm run check`, `npm run smoke:dashboard`, editor manual load.
- **Estimated complexity:** M.
- **Priority:** P3.

## Reliability, Security, Privacy, and Data Safety

- Verified release drift is the largest trust issue: current public GitHub Releases do not represent the local 3.x product state.
- Verified high-trust permissions are necessary for a userscript manager, but they increase the need for onboarding, disclosure, and diagnostics.
- Verified remote fetch paths now have runtime bounded-fetch tests, but still need background TS mirror parity.
- Verified Gist token persistence no longer uses callback-wrapped storage writes after `428b718`, but focused rejection-path tests are still missing.
- Verified TS wrapper empty-grant behavior now denies GM APIs after `428b718`, but direct grant-empty wrapper tests are still missing.
- Verified `XHR-PRIVACY` remains an open factory task; migrate user-script messages away from broad page bridge paths where possible.
- Verified `DNS-REBIND` remains open; remote install/update trust should include post-fetch IP verification or equivalent host/IP consistency checks where APIs allow.
- Verified cloud sync disclosures are stale relative to shipped providers.
- Verified CI audit currently cannot fail the build despite a zero-vulnerability baseline today.
- Verified public API hardening should be backed by focused fuzz tests because it prevents internal error detail leaks and message listener type crashes.
- Verified CSV export hardening should be kept and expanded with dashboard export coverage because exported logs and dashboard stats exports include user-controlled strings.
- Recovery needs: IDB-backed trash or an explicit storage.local quota policy, update rollback from pending-update records, backup conflict preview, and diagnostics bundles that redact tokens and script bodies by default.

## UX, Accessibility, and Trust

- Onboarding should explicitly detect and explain Chrome's current userScripts toggle state. Chrome 138+ uses an extension-specific "Allow User Scripts" toggle, while earlier Chrome uses Developer Mode.
- Empty states should distinguish "no scripts installed", "filtered to zero", "sync unavailable", "userScripts disabled", "permission missing", and "registration failed".
- Loading states should be added around update checks, cloud sync provider auth, backup import, analyzer scans, and trash restore for large scripts.
- Error states should preserve next actions: retry fetch, open source URL, copy diagnostics, disable script, restore previous version, or review permissions.
- Destructive actions should consistently show what is recoverable through trash and what is permanent.
- Settings need clearer separation among update checking, update installing, sync uploading, cloud provider authorization, and optional permissions.
- Accessibility gaps from `docs/wcag3-gap-analysis.md` should become implementation items: skip-to-main, APCA/forced-colors checks, live-region audit, APG combobox/grid semantics, and mixed-language `lang`.
- Trust signals should be visible at install and update time: source URL, update URL, diff, grants, host matches, external dependencies, analyzer results, signature/provenance, and recovery route.

## Architecture and Maintainability

- The runtime/TS split is now the central maintainability risk. A TS mirror that passes typecheck but is not build-canonical can silently reintroduce bugs when promoted.
- Commit `428b718` fixes a latent TS mirror grant-check drift where an empty grants array could grant all APIs; this reinforces the need for runtime/TS parity tests.
- `background.core.js` remains a large shared surface. The current roadmap already points toward service-worker module splitting; do it after parity tests, not before.
- `pages/dashboard.js` is a large UI controller with repeated `renderScriptTable()` calls. Virtualization and state separation should happen before additional dashboard features.
- Message action typing has improved, but runtime dispatch and `src/types/messages.ts::ResponseMap` need an automated coverage guard.
- Storage responsibilities are split across IndexedDB and `chrome.storage.local`; trash, pending installs, pending updates, and backup metadata should have explicit storage ownership.
- Release automation is incomplete. CI packages artifacts but does not publish releases, reconcile tags, or enforce store disclosure freshness.
- Documentation is extensive but stale in places. `ROADMAP.md`, `docs/release-runbook.md`, `PRIVACY.md`, and this report should be updated as part of feature work, not after.

## Prioritized Roadmap

- [ ] P0 - Reconcile release state and publish current 3.x artifacts
  - Why: Users and maintainers need public artifacts that match source, tags, and docs.
  - Evidence: Local tags reach `v3.11.0`; `package.json` and manifests are 3.11.0; `gh release list` latest is `v2.3.4`; `.github/workflows/ci.yml` has no release job.
  - Touches: `.github/workflows/ci.yml`, `docs/release-runbook.md`, `publish.sh`, `build.sh`, `CHANGELOG.md`, `README.md`.
  - Acceptance: A current GitHub release exists with matching versioned artifacts and documented CWS/Chrome status; old release drift is explained or closed.
  - Verify: `gh release list --limit 5`; `npm run check`; `npm run smoke:dashboard`; `bash build.sh`.

- [ ] P0 - Port current remote-fetch hardening to TS mirror and tests
  - Why: Oversized remote bodies can DoS the service worker if size checks happen after buffering.
  - Evidence: Commit `053c1a5` adds `_fetchTextBounded()` and `tests/fetch-bounded.test.js`; `src/background/update-checker.ts` and `src/background/install-handler.ts` still use `response.text()`.
  - Touches: `background.core.js`, `src/background/update-checker.ts`, `src/background/install-handler.ts`, require loader code, tests.
  - Acceptance: Install, update, direct URL fetch, and `@require` paths all use bounded stream reads in runtime and TS; oversized stream fixtures fail before full buffering.
  - Verify: `npm run typecheck`; targeted Vitest bounded-fetch tests; `npm run build`.

- [ ] P0 - Add runtime/TS parity guard before canonical TS build
  - Why: Future TS build promotion must not reintroduce fixed runtime behavior.
  - Evidence: `src/background/install-handler.ts` still has `Set<string>` duplicate handling and buffered fetch; recent changelog records drift cleanup work.
  - Touches: `src/background/*.ts`, `src/modules/*.ts`, `background.core.js`, `esbuild.config.mjs`, tests.
  - Acceptance: CI fails when a runtime message/action/security helper changes without a matching TS mirror update or explicit waiver.
  - Verify: `npm run typecheck`; parity test command added to `npm run check`; intentional mismatch fixture fails.

- [ ] P0 - Split update check from update install
  - Why: Users need safety from silent upstream code replacement while still getting update awareness.
  - Evidence: `pages/dashboard.js::interactiveCheckAndConfirmUpdate()` exists for per-script review; `background.core.js::UpdateSystem.autoUpdate()` still installs automatically when enabled.
  - Touches: `background.core.js::UpdateSystem`, `src/background/update-checker.ts`, settings defaults, dashboard settings/update UI, storage migration, tests.
  - Acceptance: Users can choose manual, check-only, review-before-install, or trusted auto-install modes; scheduled checks do not install in review/check-only modes.
  - Verify: Vitest settings migration tests; manual fixture update flow; dashboard pending update inbox smoke test.

- [ ] P0 - Migrate GM/XHR messaging to dedicated user-script handlers
  - Why: Chrome provides `runtime.onUserScriptMessage` for less-trusted user-script contexts, reducing reliance on page bridge patterns.
  - Evidence: Chrome userScripts docs; `.factory/large-repo-state.yaml` `XHR-PRIVACY`; existing `background.core.js` listener; committed public API hardening.
  - Touches: `background.core.js`, `modules/xhr.js`, GM API wrappers, `src/background/registration.ts`, `src/types/messages.ts`, tests.
  - Acceptance: Supported Chrome versions route GM/XHR messages through dedicated user-script events; fallback remains tested; web public API cannot reach GM internals.
  - Verify: Fixture userscript XHR test; fallback compatibility test; postMessage fuzz test.

- [ ] P1 - Add DNS rebinding protection for remote install/update fetches
  - Why: Remote install/update URLs are trust boundaries and should not be able to redirect or resolve into unexpected private/local targets after validation.
  - Evidence: `.factory/large-repo-state.yaml` lists `DNS-REBIND` as remaining; remote install/update fetches are core workflows.
  - Touches: install/update fetch helpers, URL validation, network policy docs, tests.
  - Acceptance: Remote installs/updates reject local/private rebinding cases where detectable and log a clear diagnostic.
  - Verify: Unit tests with mocked DNS/IP policy; manual install from allowed and blocked fixture URLs.

- [ ] P1 - Virtualize dashboard and side-panel script lists
  - Why: Large libraries should remain responsive during search, sort, restore, and update workflows.
  - Evidence: `pages/dashboard.js::renderScriptTable()` directly renders and is called repeatedly; no virtualization implementation found; roadmap Phase 7.1 remains relevant.
  - Touches: `pages/dashboard.js`, `pages/dashboard.css`, `pages/sidepanel.js`, tests, optional virtual-core dependency.
  - Acceptance: 2,000-script fixture remains responsive, keeps keyboard/focus behavior, and preserves existing table/card/side-panel UX.
  - Verify: Performance fixture test; dashboard smoke; manual search/sort/delete/restore with 2,000 scripts.

- [ ] P1 - Move trash to IDB-backed recovery or document storage.local as intentional
  - Why: Deleted scripts can be large and recovery metadata should not depend on small-key storage assumptions.
  - Evidence: Runtime trash actions exist; roadmap history expects an IDB `scripts_trash` store; current implementation uses `chrome.storage.local`.
  - Touches: `modules/storage.js`, storage migrations, background trash handlers, dashboard trash UI, `src/types/messages.ts`, tests.
  - Acceptance: Trash storage architecture is explicit, tested under large deleted scripts, and documented.
  - Verify: Migration test; delete/restore/empty tests; manual trash flow.

- [ ] P1 - Complete Firefox Phase 1 temporary sideload
  - Why: Cross-browser support is a major product promise and a release-risk reducer.
  - Evidence: `FIREFOX-PORT.md` Phase 1 clean sideload unchecked; `manifest-firefox.json` is version-synced but unsupported APIs remain to validate.
  - Touches: `manifest-firefox.json`, build scripts, registration guards, offscreen/sidePanel/sandbox fallbacks, Monaco loading, docs.
  - Acceptance: Firefox temporary install loads with no startup errors and fixture install/edit/run/update works.
  - Verify: `npm run build`; Firefox temporary install; documented manual fixture run.

- [ ] P1 - Refresh privacy policy and store disclosure matrix
  - Why: Cloud sync and broad host permissions require clear user and store-review disclosures.
  - Evidence: `PRIVACY.md` says data never leaves device unless exported; README/code advertise cloud sync providers.
  - Touches: `PRIVACY.md`, `README.md`, `docs/release-runbook.md`, CWS disclosure docs.
  - Acceptance: Privacy text lists each provider, uploaded data, token storage, opt-in nature, revocation, and deletion.
  - Verify: Provider list in README matches privacy table; manual CWS disclosure checklist review.

- [ ] P1 - Make high-severity audit blocking in CI
  - Why: Current zero-vulnerability baseline should be protected for release artifacts.
  - Evidence: `npm audit --audit-level=high --omit=optional` returned 0; CI has `continue-on-error: true`.
  - Touches: `.github/workflows/ci.yml`.
  - Acceptance: CI fails on high+ advisories while preserving optional-dependency noise handling.
  - Verify: `npm audit --audit-level=high --omit=optional`; CI run.

- [ ] P1 - Backfill public API and dashboard CSV hardening tests
  - Why: Commit `053c1a5` fixes concrete external-input risks; remaining value is preventing regressions across every export and bridge path.
  - Evidence: Commit `053c1a5` modifies `modules/public-api.js`, `src/modules/public-api.ts`, `modules/error-log.js`, `src/modules/error-log.ts`, `pages/dashboard.js`, `pages/dashboard-csp.js`, and `tests/error-log.test.js`.
  - Touches: Those modules/pages and tests.
  - Acceptance: External handler exceptions return no internal detail; non-string `postMessage.type` is ignored; CSV dangerous cells are defanged in error-log and dashboard stats exports, all with tests.
  - Verify: Targeted Vitest tests for public API fuzz and CSV formula prefixes; manual dashboard stats CSV export.

- [ ] P1 - Backfill tests for Gist storage failure and empty-grant wrapper behavior
  - Why: Commit `428b718` closes two real hardening gaps, but the most direct rejection and empty-grant cases should be pinned before the next TS/runtime migration wave.
  - Evidence: `pages/dashboard-gist.js` now uses Promise API writes for token/autosync persistence; `src/background/wrapper-builder.ts` now denies GM APIs when `grants.length === 0`.
  - Touches: `pages/dashboard-gist.js`, `src/background/wrapper-builder.ts`, `tests/gui-secondary-audit.test.js` or new focused tests.
  - Acceptance: Rejected Gist storage writes settle without hanging UI state; wrappers built with `grant: []` deny GM APIs except `GM_info`.
  - Verify: Targeted Vitest tests for mocked `chrome.storage.local.set/remove` rejection and `buildWrappedScript(makeScript([]))`.

- [ ] P2 - Add unified diagnostics bundle
  - Why: Debugging registration, sync, and update failures currently requires several disconnected surfaces.
  - Evidence: Error log, DevTools, netlog, sync, and registration diagnostics exist separately.
  - Touches: dashboard diagnostics UI, error log, sync providers, registration diagnostics, redaction utilities.
  - Acceptance: User can export a sanitized diagnostics JSON bundle without tokens or script bodies by default.
  - Verify: Snapshot redaction tests; manual export with fake tokens and scripts.

- [ ] P2 - Add `GM_fetch`, AbortSignal, and cookie partition controls
  - Why: Compatibility with modern scripts and privacy controls is still advancing.
  - Evidence: Roadmap references `GM_fetch`, AbortSignal, CHIPS/cookie partition work; `modules/xhr.js` supports several XHR options already.
  - Touches: `modules/xhr.js`, `src/modules/xhr.ts`, background request handlers, tests, docs.
  - Acceptance: `GM_fetch` behaves predictably, XHR aborts through AbortSignal, and cookie partition options are explicit and tested.
  - Verify: XHR/GM_fetch fixture tests; manual cross-origin request script.

- [ ] P2 - Implement optional `@require` provenance policy
  - Why: Remote dependencies are a high-value supply-chain attack path.
  - Evidence: `docs/require-provenance-design.md`; require loader fetch path; analyzer/signing features already exist.
  - Touches: parser, require loader, analyzer, install/update UI, settings, docs.
  - Acceptance: Matching/mismatched/missing provenance is visible and policy-controlled.
  - Verify: Fixture scripts with matching hash, mismatch, and missing provenance.

- [ ] P2 - Complete accessibility trust pass from WCAG 3 gap analysis
  - Why: The app has dense controls and trust warnings that must be navigable and perceivable.
  - Evidence: `docs/wcag3-gap-analysis.md`; dashboard/editor/install UI surfaces.
  - Touches: `pages/*.html`, `pages/*.css`, `pages/*.js`, tests.
  - Acceptance: Skip links, forced-colors, live-region behavior, combobox/grid semantics, and mixed-language handling are covered.
  - Verify: Accessibility tests; manual keyboard and screen-reader smoke.

- [ ] P3 - Refresh dependency/tooling batch
  - Why: Toolchain drift increases future upgrade cost.
  - Evidence: `npm outdated --json` shows newer versions for Vitest, esbuild, jsdom, Puppeteer, TypeScript, chrome-types, and Monaco.
  - Touches: `package.json`, `package-lock.json`, editor smoke, CI.
  - Acceptance: Low-risk tooling updates land with green checks; Monaco upgrade is isolated with UI verification.
  - Verify: `npm outdated`; `npm run check`; `npm run smoke:dashboard`; editor manual smoke.

- [ ] P3 - Add stale artifact guard for root ZIP/XPI files
  - Why: Local ignored artifacts can mislead manual testing and release work.
  - Evidence: Local root `ScriptVault-firefox-v2.1.7.xpi` exists while project version is 3.11.0.
  - Touches: release scripts, `.gitignore`, docs.
  - Acceptance: Build outputs go only to the expected artifact folder and release checks warn about stale root packages.
  - Verify: `git status --ignored --short`; build artifact path check.

## Quick Wins

- Update `docs/release-runbook.md` to reflect actual `chrome-webstore-upload-cli` 4.0.0 state and current Node/CI requirements.
- Update `PRIVACY.md` with cloud sync provider disclosures and token/data handling.
- Make CI high-severity audit blocking now that the current audit is clean.
- Add a release checklist command block that includes `gh release list --limit 5` and `git tag --sort=-v:refname`.
- Add dashboard stats and CSP CSV export tests to complement the committed error-log CSV formula-defanging tests.
- Add a test for `modules/public-api.js` non-string `postMessage.type` handling and generic external exception responses.
- Add a focused Gist token storage rejection test for the `428b718` Promise API change.
- Add a focused wrapper grant test for `grant: []` so the `428b718` TS mirror fix cannot regress.
- Add a parity test that fails if `src/background/install-handler.ts` keeps `Set<string>` duplicate handling while runtime uses promise-based dedupe.
- Add a docs note to `FIREFOX-PORT.md` that root `ScriptVault-firefox-v2.1.7.xpi` is stale local artifact, not current release output.
- Add dashboard performance fixture generation for 500, 1,000, and 2,000 scripts before virtual list implementation.

## Larger Bets

- Promote TypeScript to canonical runtime build after parity gates and service-worker module boundaries are stable.
- Move to WXT or a WXT-like cross-browser build after TS canonicalization and Firefox Phase 1 validation.
- Implement a consent-first update system with pending-update inbox, trust summaries, rollback, and batch review.
- Build a first-class Firefox/AMO release path with documented provider scope and store-review disclosures.
- Add `@require` provenance and dependency diffing as ScriptVault's distinctive supply-chain trust feature.
- Build a unified diagnostics/export system with redaction and support-ready evidence bundles.

## Explicit Non-Goals

- Do not add script-generation chat or cloud code suggestions. It would dilute the local-first trust identity and create new disclosure risks.
- Do not make telemetry, popularity ranking, or community script hosting a core feature. ScriptVault should remain a manager, not a script marketplace.
- Do not start Safari/Orion work before Firefox temporary sideload and build abstractions are stable.
- Do not replace Monaco or redesign the entire dashboard before solving performance and trust workflows.
- Do not publish a new root XPI/ZIP artifact manually without release automation and version checks.
- Do not weaken `<all_urls>` or core userscript permissions in a way that breaks existing scripts; instead improve disclosure, diagnostics, and optional permission handling.
- Do not migrate to WXT before TS/runtime parity is under control.

## Open Questions

- Should the next public release be `v3.11.1` as a release-drift fix or `v3.12.0` now that commits `053c1a5` and `428b718` added security and reliability hardening after 3.11.0?
- For the first Firefox beta, should cloud sync be WebDAV-only or should Google/Dropbox/OneDrive/Easy Cloud be carried forward immediately?
- For trash, is the intended product contract IDB-backed recovery for large deleted scripts, or is the current `chrome.storage.local` implementation acceptable if documented and quota-tested?
- For update consent, should existing users with `autoUpdate: true` be migrated to `review` by default, or preserved as `autoInstallTrusted` with an in-app notice?
- Who owns the Chrome Web Store API v2/OIDC credentials and publisher account needed for release automation?
