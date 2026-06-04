# Project Research and Feature Plan

Status: refreshed on 2026-05-24 from the live `main` worktree at `C:\Users\--\repos\ScriptVault`.

Scope: this is a research and planning artifact only. It does not implement feature code. It intentionally treats current tracked files, docs, tests, release artifacts, public listings, and the dirty worktree as separate evidence streams.

Labels used below:

- Verified: confirmed in local source, docs, tests, command output, git history, or public primary sources.
- Likely: strongly suggested by evidence, but not fully exercised in a browser or store console.
- Assumption: reasonable product or implementation assumption that still needs owner confirmation.
- Needs live validation: requires credentials, browser-store dashboard access, a real extension profile, or platform review tooling not completed in this pass.

## Executive Summary

ScriptVault is a public, Manifest V3 userscript manager for Chrome with a broad user-facing surface: dashboard management, install/update flows, Monaco editing, GM API compatibility, side panel and popup controls, cloud sync, import/export, diagnostics, static analysis, signing, DevTools surfaces, localization, and early Firefox packaging. Its strongest current shape is not raw feature count, but the combination of a modern MV3 runtime and unusually rich trust/recovery affordances for a code-execution tool. The highest-value direction is to make the trust story match the feature story: reconcile public release and store metadata with the local 3.11.0 codebase, harden update/install consent and network boundaries, eliminate runtime/source drift, and convert existing recovery, sync, cross-browser, and diagnostics pieces into verifiable workflows.

Top opportunities in priority order:

1. P0 - Reconcile public release and store trust: GitHub Releases are still at v2.3.4 while the repo is 3.11.0, the Chrome Web Store listing still presents v1.7.4-era copy, and a stale Firefox XPI sits in the root.
2. P0 - Add a generated release/store/privacy parity gate: package, manifests, README, changelog, privacy policy, public store copy, artifacts, and release notes must agree before any publish.
3. P0 - Finish the Chrome Web Store API v2 release path: the repo has a v4 publish script, but the release runbook still describes older migration state and CI has no release job.
4. P0 - Stop runtime/source drift: `background.core.js` and `src/background/*` still diverge on bounded fetch and DNR/webRequest behavior; current dirty changes show this remains an active failure mode.
5. P0 - Add an update inbox with consent and rollback receipts: per-script interactive updates exist, but bulk and auto-update still apply executable code without a review queue.
6. P1 - Move sensitive user-script XHR callback plumbing off the page `postMessage` bridge where Chrome's user-script messaging API is available.
7. P1 - Centralize remote fetch policy for installs, updates, `@require`, `@resource`, redirects, private IPs, and DNS-rebind checks.
8. P1 - Turn Firefox from a manifest/build experiment into a validated AMO lane with `web-ext lint`, source-package notes, unsupported-feature gates, and no stale root artifact.
9. P1 - Make sync and backups auditable: token health, revoke, manual sync, conflict dry-run, backup verification, restore receipts, and privacy disclosure alignment.
10. P1 - Add large-library performance gates and virtualization for dashboard, side panel, and search-heavy workflows.

## Evidence Reviewed

Local files and directories inspected:

- Root project instructions: `AGENTS.md`, `CLAUDE.md`.
- User-facing docs: `README.md`, `CHANGELOG.md`, `ROADMAP.md`, `PRIVACY.md`, `FIREFOX-PORT.md`.
- Release docs and scripts: `docs/release-runbook.md`, `docs/cross-browser-pipeline.md`, `build.sh`, `build-firefox.sh`, `publish.sh`, `.github/workflows/ci.yml`.
- Manifests and package files: `manifest.json`, `manifest-firefox.json`, `package.json`, `package-lock.json`.
- Runtime and source mirrors: `background.core.js`, `background.js`, `src/background/*.ts`, `src/types/messages.ts`.
- UI surfaces: `popup.html`, `popup.js`, `sidepanel.html`, `sidepanel.js`, `pages/dashboard.html`, `pages/dashboard.js`, `pages/dashboard.css`, `pages/dashboard-a11y.js`, `pages/dashboard-firefox-compat.js`, `pages/install.html`, `pages/install.js`, `pages/monaco-adapter.js`, `pages/editor-sandbox.html`.
- Sync, public API, and trust modules: `modules/sync-providers.js`, `modules/sync-easycloud.js`, `modules/public-api.js`, `src/modules/public-api.ts`, `bg/analyzer.js`, `bg/signing.js`, `offscreen.js`.
- Tests: `tests/*.test.js`, `tests/*.test.mjs`, especially dashboard, popup, side panel, public API, wrapper, bounded fetch, cookie, XHR, and release-surface tests.
- Local project state: `.factory/large-repo-state.yaml`.
- Root artifacts: `ScriptVault-firefox-v2.1.7.xpi`.

Git history reviewed:

- `rtk git log -10 --oneline --decorate`
- Range reviewed: `740785f` through `3b2a211` on `main`.
- Recent direction: Round 14 roadmap research, release trust polish, dashboard workflow states, extension UI polish, update/install trust states, public API hardening, bounded fetch hardening, CSV injection handling, badge safety, and TS mirror drift cleanup.

Build, test, docs, and release artifacts inspected:

- `npm run check` passed: 49 test files, 807 tests. The run emitted jsdom navigation-not-implemented warnings but exited successfully.
- `npm run smoke:dashboard` passed for ScriptVault 3.11.0.
- `npm audit --audit-level=high --omit=optional` passed with 0 vulnerabilities.
- `npm outdated --json` found update candidates for Vitest, coverage-v8, chrome-types, esbuild, jsdom, monaco-editor, puppeteer-core, and TypeScript.
- Public GitHub release state inspected with `gh release list` and `gh release view`.
- Public GitHub repository metadata inspected with `gh repo view`.
- Public Chrome Web Store listing inspected in browser.

External sources reviewed:

- Chrome userScripts API: [developer.chrome.com docs](https://developer.chrome.com/docs/extensions/reference/api/userScripts)
- Chrome Web Store API v2 announcement: [CWS API v2 blog](https://developer.chrome.com/blog/cws-api-v2)
- Chrome Web Store API reference: [CWS API REST reference](https://developer.chrome.com/docs/webstore/api/reference/rest)
- Chrome Web Store program policies: [program policies](https://developer.chrome.com/docs/webstore/program-policies/)
- Chrome Web Store rollback docs: [rollback documentation](https://developer.chrome.com/docs/webstore/rollback)
- Chrome Web Store update docs: [update documentation](https://developer.chrome.com/docs/webstore/update/)
- Chrome permissions API: [permissions reference](https://developer.chrome.com/docs/extensions/reference/api/permissions)
- Chrome Web Store listing: [ScriptVault listing](https://chromewebstore.google.com/detail/scriptvault/jlhdbkeijcbgnonpfkfkkkhfmbeejkgh)
- MDN userScripts API: [MDN userScripts](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/userScripts)
- MDN Chrome incompatibilities: [Chrome incompatibilities](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Chrome_incompatibilities)
- MDN `browser_specific_settings` and Firefox `data_collection_permissions`: [manifest key docs](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings)
- Firefox Extension Workshop source submission and linting: [source code submission](https://extensionworkshop.com/documentation/publish/source-code-submission/), [web-ext lint](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/#web-ext-lint)
- WXT browser-target and manifest docs: [target browsers](https://wxt.dev/guide/essentials/target-different-browsers.html), [manifest docs](https://wxt.dev/guide/essentials/manifest.html)
- Microsoft Edge Add-ons publish docs: [Edge publish guide](https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/publish/publish-extension)
- Comparable userscript managers: [Tampermonkey](https://www.tampermonkey.net/?browser=chrome), [Violentmonkey](https://violentmonkey.github.io/), [Violentmonkey GM API](https://violentmonkey.github.io/api/gm/), [Violentmonkey source](https://github.com/violentmonkey/violentmonkey), [ScriptCat docs](https://docs.scriptcat.org/), [ScriptCat source](https://github.com/scriptscat/scriptcat), [Greasemonkey](https://www.greasespot.net/), [Greasemonkey source](https://github.com/greasemonkey/greasemonkey), [quoid/userscripts](https://github.com/quoid/userscripts)
- Adjacent trust/release projects: [Stylus](https://github.com/openstyles/stylus), [uBlock Origin Lite FAQ](https://github.com/uBlockOrigin/uBOL-home/wiki/Frequently-asked-questions-%28FAQ%29), [Bitwarden browser client](https://github.com/bitwarden/clients/tree/main/apps/browser)
- Supply-chain references: [npm provenance](https://docs.npmjs.com/generating-provenance-statements), [SLSA provenance](https://slsa.dev/spec/v1.0/provenance)
- Accessibility references: [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [WCAG 3.0 Working Draft](https://www.w3.org/TR/wcag-3.0/)

Areas that could not be fully verified:

- Needs live validation: Chrome Web Store Developer Dashboard metadata, submit status, review status, screenshots, data-use declarations, and current package uploaded to Google.
- Needs live validation: AMO validation and submission behavior, because no AMO dashboard or `web-ext lint` run against a generated package was completed in this pass.
- Needs live validation: real-browser behavior for Chrome 138+ "Allow User Scripts" onboarding, Chrome 133+ host access request prompts, DNR dynamic rule cleanup, and user-script messaging migration.
- Needs live validation: cloud providers requiring credentials: WebDAV, Google Drive, Dropbox, OneDrive, EasyCloud, and GitHub Gist token flows.
- Assumption: the dirty DNR and `window.onurlchange` hardening changes are intended work in progress by another actor; they were not staged or treated as released.

## Current Product Map

Core workflows:

- Install userscripts from `.user.js` URLs, manual URL input, raw code, file import, drag/drop, and likely web navigation interception.
- Review script metadata, grants, match patterns, resources, requirements, trust signals, and install/update diffs.
- Manage scripts in a rich dashboard with list/card views, tags, folders, workspaces, search, filters, sorting, pinning, bulk operations, notes, backups, trash, diagnostics, and activity surfaces.
- Edit scripts in a Monaco-backed editor surface with sandboxing and script metadata support.
- Execute scripts through Chrome MV3 `userScripts` plus wrapper code for GM APIs and compatibility helpers.
- Use extension entry points: action popup, side panel, options/dashboard, context menus, omnibox keyword, install page, DevTools panel, offscreen document, and background service worker.
- Sync, export, import, and back up scripts/settings through local storage, browser sync, cloud providers, EasyCloud/Google Drive, and GitHub Gist integrations.
- Check updates manually, in bulk, or automatically; apply updates and maintain history/rollback data.
- Analyze and sign scripts; inspect CSP issues, network logs, performance budgets, runtime errors, and support diagnostics.

Project type, stack, runtime, package manager, build, and tests:

- Verified project type: browser extension and userscript manager.
- Verified runtime: Chrome Manifest V3 service worker, `chrome.userScripts`, DNR, offscreen documents, side panel, DevTools, sandboxed editor page, content scripts, and extension pages.
- Verified browser target: Chrome minimum version 130 in `manifest.json`; Firefox MV3 experiment in `manifest-firefox.json` with `strict_min_version` 128.
- Verified language stack: JavaScript runtime files plus TypeScript mirror/source modules under `src/`.
- Verified package manager: npm with `package-lock.json`.
- Verified build system: `esbuild.config.mjs`, `build.sh`, `build-firefox.sh`, `publish.sh`, `npm run build`, `npm run build:bg`, `npm run build:prod`, `npm run build:monaco`.
- Verified test system: Vitest plus jsdom, Puppeteer-core smoke tests, a11y tests, release-surface tests, wrapper/runtime tests, and dashboard/popup tests.
- Verified release process: manual Chrome zip build and publish script exist; GitHub Actions CI builds artifacts; no complete release publish workflow was found.

Supported platforms and distribution:

- Verified: Chrome/Chromium MV3 is the primary target.
- Likely: Edge/Brave/other Chromium derivatives should work for most functionality but are not release-gated.
- Partial: Firefox MV3 manifest and build script exist, but `FIREFOX-PORT.md` Phase 1 remains unchecked.
- Not current: Safari would require a native app packaging path and should be treated as a larger bet only.
- Verified public distribution mismatch: local version is 3.11.0, GitHub Releases latest is v2.3.4, Chrome Web Store public listing still exposes stale v1.7.4-era copy, and a root `ScriptVault-firefox-v2.1.7.xpi` artifact remains.

Core user personas:

- Power users migrating from Tampermonkey, Violentmonkey, ScriptCat, or Greasemonkey who expect GM API compatibility, import/export, script updates, match controls, and site-level enable/disable.
- Developers writing and debugging scripts who need Monaco editing, metadata helpers, static analysis, network/CSP/error diagnostics, profiling, and reliable update/rollback history.
- Privacy-conscious users running arbitrary third-party code who need explicit trust signals, update consent, permission clarity, audit trails, backups, and easy recovery.
- Cross-browser users who want Chrome today and Firefox/Edge support without losing data or script compatibility.

Major modules, entry points, UI surfaces, services, storage, integrations, permissions, and config:

- Background runtime: `background.core.js` is the canonical runtime today; `background.js` is generated output; `src/background/*.ts` mirrors many background subsystems but is not fully canonical.
- Script execution and wrapper: `src/background/wrapper-builder.ts`, wrapper tests, `content.js`, `background.core.js`, `src/background/user-script-manager.ts`, and generated `background.js`.
- Install/update/network: `background.core.js`, `src/background/install-handler.ts`, `src/background/update-checker.ts`, `src/background/resource-loader.ts`, `src/background/context-menu.ts`.
- Dashboard: `pages/dashboard.html`, `pages/dashboard.js`, `pages/dashboard.css`, and many dashboard companion modules.
- Editor: `pages/editor-sandbox.html`, `pages/monaco-adapter.js`, dashboard editor tabs and editor-related tests.
- Popup and side panel: `popup.*`, `sidepanel.*`, `tests/popup-*`, `tests/sidepanel-*`.
- Sync: `modules/sync-providers.js`, `modules/sync-easycloud.js`, `pages/dashboard-gist.js`, background sync handlers.
- Public API: `modules/public-api.js`, `src/modules/public-api.ts`, `tests/public-api.test.js`.
- Security/trust: `offscreen.js`, `bg/analyzer.js`, `bg/signing.js`, `docs/require-provenance-design.md`.
- Release and packaging: `build.sh`, `build-firefox.sh`, `publish.sh`, `.github/workflows/ci.yml`, `docs/release-runbook.md`.
- Storage: Chrome `storage.local`, `storage.sync`, IndexedDB surfaces, trash in `storage.local`, provider tokens and sync state, update/history data, settings, and diagnostic logs.
- Permissions: broad host access through `<all_urls>`, `userScripts`, `scripting`, `webNavigation`, `declarativeNetRequest`, `declarativeNetRequestWithHostAccess`, `downloads`, `notifications`, `alarms`, `sidePanel`, `offscreen`, and optional identity/clipboard/cookies permissions.

## Feature Inventory

### 1. Script Install and Import

- Name: Script install, URL/file/manual-code import, and web install capture.
- User value: lets users add scripts from userscript sites, direct URLs, local files, pasted code, or backups.
- Entry point: `.user.js` navigation capture, `pages/install.html`, dashboard import controls, drag/drop, batch URL install, context menus.
- Main code locations: `background.core.js`, `src/background/install-handler.ts`, `pages/install.js`, `pages/dashboard.js`, `pages/dashboard.html`, `content.js`, tests around install, URL capture, and GUI workflows.
- Current maturity: complete for Chrome core flow; partial for shared network safety because source mirrors still contain buffered `response.text()` paths.
- Tests/docs coverage: README documents install/import; tests cover many install/update surfaces; CI exercises dashboard smoke.
- Improvement opportunities: centralize bounded remote fetch policy; add internal-host/redirect/DNS-rebind checks; add install trust receipt; add source provenance display; align privacy/store copy with all install network behavior.

### 2. Script Dashboard Management

- Name: Dashboard script library management.
- User value: gives users a primary control center for search, filters, sort, tags, folders, workspaces, enable/disable, bulk operations, notes, diff, backups, and diagnostics.
- Entry point: options/dashboard page and extension UI links.
- Main code locations: `pages/dashboard.html`, `pages/dashboard.js`, `pages/dashboard.css`, `pages/dashboard-a11y.js`, `dashboard-lazy-loader.js`, dashboard tests.
- Current maturity: feature-rich but high complexity; large direct DOM-rendering files create maintainability and performance risk.
- Tests/docs coverage: README feature list, GUI audit tests, dashboard smoke, dashboard secondary-surface tests, a11y tests.
- Improvement opportunities: add large-library performance fixtures; virtualize script lists/cards; split dashboard state/actions into smaller testable modules; create consistent empty/error/loading contracts per panel.

### 3. Popup Quick Controls

- Name: Action popup.
- User value: gives fast enable/disable, script status, quick edit, diagnostics, and active-tab affordances.
- Entry point: extension action popup.
- Main code locations: `popup.html`, `popup.js`, `popup.css`, popup tests.
- Current maturity: complete for core Chrome surface; recent commits polished UI states.
- Tests/docs coverage: popup a11y and workflow tests; README mentions popup quick-edit.
- Improvement opportunities: surface update inbox count, site-scoped controls, host permission status, userScripts toggle status, and a support snapshot link without overwhelming the compact surface.

### 4. Side Panel

- Name: Chrome side panel.
- User value: keeps script controls near the active page for repeated use.
- Entry point: Chrome side panel permission/API and dashboard/popup links.
- Main code locations: `sidepanel.html`, `sidepanel.js`, `sidepanel.css`, side panel tests.
- Current maturity: complete for Chrome; unavailable in Firefox manifest.
- Tests/docs coverage: side panel tests and README comparison table.
- Improvement opportunities: mirror site-scoped controls, active-page diagnostics, pending update count, and virtualized active script list; feature-gate in Firefox/Edge support matrix.

### 5. Monaco Script Editor

- Name: Monaco editor and sandboxed editing surface.
- User value: lets developers edit scripts with a professional code editor.
- Entry point: dashboard edit buttons, popup quick-edit, editor tabs.
- Main code locations: `pages/editor-sandbox.html`, `pages/monaco-adapter.js`, dashboard editor tab code, build Monaco script.
- Current maturity: complete for Chrome dashboard use; partial for cross-browser and offline/fallback clarity.
- Tests/docs coverage: README and dashboard GUI tests mention editor; no full browser-level Monaco regression found in this pass.
- Improvement opportunities: add generated GM API typings, grant inference warnings, editor search history, plaintext fallback, save-conflict handling, and Firefox strategy.

### 6. Script Execution Runtime

- Name: MV3 userScripts execution and wrapper runtime.
- User value: runs user scripts under MV3 while exposing compatibility APIs.
- Entry point: background registration and Chrome `userScripts` runtime.
- Main code locations: `background.core.js`, `background.js`, `src/background/user-script-manager.ts`, `src/background/wrapper-builder.ts`, `content.js`, wrapper tests.
- Current maturity: advanced but drift-prone; dirty changes show ongoing work on DNR and `window.onurlchange` parity.
- Tests/docs coverage: many wrapper/security/runtime tests; README GM API table.
- Improvement opportunities: make generated runtime/source parity a CI contract; migrate callback transport to user-script messaging; expand grant contract tests against real browser behavior.

### 7. GM API Compatibility

- Name: GM/Tampermonkey-compatible APIs.
- User value: lets users run existing scripts from the wider userscript ecosystem.
- Entry point: metadata grants in installed scripts.
- Main code locations: `background.core.js`, `src/background/wrapper-builder.ts`, `src/background/resource-loader.ts`, `src/background/context-menu.ts`, `modules/public-api.js`, tests for GM APIs, XHR, cookies, downloads, resources, menu, storage, and tabs.
- Current maturity: broad but not fully parity-certified; README claims 35+ GM API functions.
- Tests/docs coverage: README compatibility table and targeted tests.
- Improvement opportunities: publish a generated compatibility matrix from tests; document unsupported semantics; add import warnings when scripts use unsupported grants; add real-browser parity fixtures for top Tampermonkey/Violentmonkey patterns.

### 8. Update Checking and Rollback

- Name: Manual, bulk, and automatic script updates with history/rollback.
- User value: keeps scripts current and recoverable.
- Entry point: dashboard update buttons, bulk actions, background auto-update alarms/settings.
- Main code locations: `background.core.js` `checkForUpdates`, `applyUpdate`, `autoUpdate`; `src/background/update-checker.ts`; dashboard update UI.
- Current maturity: partial for trust-sensitive operation. Interactive per-script confirmation exists, but auto-update and some bulk paths still auto-apply executable changes.
- Tests/docs coverage: update tests and README update claims.
- Improvement opportunities: pending update inbox, trust receipts, diff review for all non-manual updates, update-source reputation, rollback point before apply, and a no-surprise auto-update mode.

### 9. Trash, Restore, and Recovery

- Name: Trash and script recovery.
- User value: prevents accidental destructive loss.
- Entry point: dashboard delete/trash/restore controls.
- Main code locations: `background.core.js` `deleteScript`, `getTrash`, `restoreFromTrash`; dashboard trash panel.
- Current maturity: partial. Trash exists, but current runtime uses `chrome.storage.local` `trash`; roadmap language references IDB `scripts_trash`, which is not what the inspected runtime uses.
- Tests/docs coverage: README mentions trash and rollback; dashboard tests cover related UI states.
- Improvement opportunities: restore receipts, verified backup before permanent delete, storage migration if IDB trash remains desired, empty-trash confirmation with count/source/date, and recovery drill tests.

### 10. Cloud Sync, EasyCloud, Gist Sync, and Backups

- Name: Multi-provider sync and backups.
- User value: moves scripts/settings across devices and gives recovery options.
- Entry point: dashboard sync/settings panels, Gist panel, EasyCloud flows, export/import actions.
- Main code locations: `modules/sync-providers.js`, `modules/sync-easycloud.js`, `pages/dashboard-gist.js`, background sync handlers, dashboard sync UI.
- Current maturity: feature-rich but privacy/trust documentation is stale.
- Tests/docs coverage: README lists WebDAV, Google Drive, Dropbox, OneDrive, Browser Sync, EasyCloud, and Gist; privacy policy does not reflect all cloud flows.
- Improvement opportunities: token health, revoke flow, manual sync, dry-run conflict preview, sync receipt, provider-specific error guidance, backup verification, and privacy/data-use documentation alignment.

### 11. Static Analysis, Signing, and Trust Review

- Name: Script analyzer, signing, install review, and provenance hints.
- User value: helps users decide whether to trust executable scripts.
- Entry point: install page, dashboard details, analyzer controls, signing surfaces.
- Main code locations: `offscreen.js`, `bg/analyzer.js`, `bg/signing.js`, `docs/require-provenance-design.md`, dashboard/install UI.
- Current maturity: partial to complete depending on flow. Analysis exists, but supply-chain provenance and `@require` trust are not yet release-grade.
- Tests/docs coverage: README and security tests.
- Improvement opportunities: `@require` provenance ledger, signed artifact trust, install/update trust receipt, source reputation display, and warnings for high-risk grants.

### 12. Diagnostics, Logs, DevTools, and Support Data

- Name: Runtime diagnostics, logs, CSP reports, netlog, profiling, and support bundle.
- User value: helps users and maintainers debug script and extension failures.
- Entry point: dashboard diagnostics tabs, DevTools panel, support bundle UI, background logs.
- Main code locations: dashboard diagnostics sections, `devtools.html`, `devtools.js`, `pages/devtools-panel.html`, `pages/devtools-panel.js`, background handlers.
- Current maturity: broad but needs end-to-end support package verification.
- Tests/docs coverage: README feature list and diagnostic tests.
- Improvement opportunities: one-click redacted diagnostics bundle, explicit privacy preview before export, update/install failure receipts, and structured log schema tests.

### 13. Permissions and Host Access

- Name: Permission management and host access.
- User value: lets users understand why the extension needs broad access and recover when a permission is missing.
- Entry point: install flow, settings, popup, Chrome extension permissions prompts.
- Main code locations: `manifest.json`, background permission handlers, dashboard settings UI.
- Current maturity: partial. Manifest has broad required host access; Chrome newer host access request API is not yet productized.
- Tests/docs coverage: README and release docs mention permissions; no generated permission/store-copy gate found.
- Improvement opportunities: generated permission justification table, Chrome `permissions.addHostAccessRequest` integration where supported, active-site permission status, and store data-use copy parity.

### 14. Localization and Themes

- Name: Localization, dark/light UI, and accessibility helpers.
- User value: makes the product usable across languages and visual preferences.
- Entry point: extension pages, dashboard settings, browser locale.
- Main code locations: `_locales/*`, dashboard/popup/sidepanel CSS, `pages/dashboard-a11y.js`, tests.
- Current maturity: partial. README claims 8 locales and theme support; coverage and stale-string checks need automation.
- Tests/docs coverage: GUI/a11y tests and locale files.
- Improvement opportunities: locale coverage report, missing-string gate, forced-colors tests, APCA contrast review, and live-region consistency.

### 15. Cross-Browser and Firefox Build

- Name: Firefox MV3 and cross-browser strategy.
- User value: lets users carry ScriptVault to Firefox and eventually Edge/other browsers.
- Entry point: `manifest-firefox.json`, `build-firefox.sh`, `FIREFOX-PORT.md`.
- Main code locations: Firefox manifest, Firefox build script, `pages/dashboard-firefox-compat.js`, cross-browser docs.
- Current maturity: partial/experimental. Phase 1 tasks are not complete, and a stale root XPI can confuse distribution.
- Tests/docs coverage: `FIREFOX-PORT.md`, `docs/cross-browser-pipeline.md`.
- Improvement opportunities: `web-ext lint`, unsupported-feature gates, AMO data collection metadata, source-package instructions, Edge Add-ons lane, WXT migration spike.

### 16. Public API

- Name: Public extension API.
- User value: lets external tools or scripts integrate with ScriptVault predictably.
- Entry point: extension messaging or documented public API surface.
- Main code locations: `modules/public-api.js`, `src/modules/public-api.ts`, `tests/public-api.test.js`.
- Current maturity: recently hardened; likely complete for current documented methods.
- Tests/docs coverage: dedicated public API tests and recent hardening commit.
- Improvement opportunities: generated API docs from tests, schema validation for each action, versioned compatibility policy, and external integration examples.

### 17. Build, CI, and Release

- Name: Build, test, package, publish, and artifact management.
- User value: keeps published extension trustworthy and reproducible.
- Entry point: npm scripts, shell scripts, CI workflow, GitHub Releases, Chrome Web Store.
- Main code locations: `package.json`, `build.sh`, `build-firefox.sh`, `publish.sh`, `.github/workflows/ci.yml`, `docs/release-runbook.md`.
- Current maturity: partial. CI checks builds and smokes, but publication, provenance, store metadata, rollback, and release-artifact parity are not gated.
- Tests/docs coverage: CI and runbook exist; runbook is stale in important places.
- Improvement opportunities: release job, artifact manifest, SBOM/provenance, package diff, store-copy checker, rollback drill, Node version alignment, and stale-artifact cleanup.

## Competitive and Ecosystem Research

### Tampermonkey

- Product/source: [Tampermonkey](https://www.tampermonkey.net/?browser=chrome) and public changelog pages.
- Notable capabilities: mature cross-browser userscript management, import/export, script updates, update URLs, editor support, sync-oriented workflows, broad GM/TM compatibility, and store presence.
- What ScriptVault should learn: update and install trust must feel boring and predictable; compatibility claims need visible contracts; store copy should stay aligned with actual release capabilities; power users expect clear import/migration paths.
- What ScriptVault should avoid: imitating monetization or closed-source trust dynamics that do not fit ScriptVault's current open, security-forward identity.

### Violentmonkey

- Product/source: [Violentmonkey](https://violentmonkey.github.io/), [GM API docs](https://violentmonkey.github.io/api/gm/), [source](https://github.com/violentmonkey/violentmonkey).
- Notable capabilities: open-source userscript manager, documented GM APIs, compact script list, sync concepts, and mature import/export.
- What ScriptVault should learn: generate a compatibility matrix directly from tests and docs; keep advanced features discoverable without hiding core script management.
- What ScriptVault should avoid: letting MV2-era behavior assumptions leak into MV3-specific implementation decisions.

### ScriptCat

- Product/source: [ScriptCat docs](https://docs.scriptcat.org/) and [source](https://github.com/scriptscat/scriptcat).
- Notable capabilities: modern userscript manager with docs, script workflows, and cloud/storage ideas that appeal to power users.
- What ScriptVault should learn: flexible sync and script workflow features can differentiate, but they need strong conflict previews and provider health.
- What ScriptVault should avoid: expanding into hosted/service features before local trust, release parity, and privacy disclosures are stable.

### Greasemonkey

- Product/source: [Greasemonkey](https://www.greasespot.net/) and [source](https://github.com/greasemonkey/greasemonkey).
- Notable capabilities: long-running Firefox userscript lineage with a simpler product shape.
- What ScriptVault should learn: Firefox users value compatibility and predictable browser-specific behavior more than Chrome-only surface area.
- What ScriptVault should avoid: treating Firefox as a copy of Chrome; unsupported APIs need explicit fallbacks and honest UI.

### quoid/userscripts

- Product/source: [quoid/userscripts](https://github.com/quoid/userscripts).
- Notable capabilities: Safari/iOS-oriented userscript manager through a native-app distribution model.
- What ScriptVault should learn: Safari is a different product and release path, not just another manifest target.
- What ScriptVault should avoid: premature Safari commitments before Chrome/Firefox/Edge release foundations are solid.

### Stylus

- Product/source: [Stylus](https://github.com/openstyles/stylus).
- Notable capabilities: high-volume style management with update, editor, import/export, and large-library UX expectations.
- What ScriptVault should learn: large collections need virtualized lists, fast search, safe bulk operations, and clear update states.
- What ScriptVault should avoid: style-manager-specific workflows that do not translate to executable code risk.

### uBlock Origin Lite

- Product/source: [uBO Lite FAQ](https://github.com/uBlockOrigin/uBOL-home/wiki/Frequently-asked-questions-%28FAQ%29).
- Notable capabilities: MV3 constraints explained clearly; DNR behavior is central to the product.
- What ScriptVault should learn: DNR limitations, rule ownership, and browser limitations should be transparent to users and release-gated in tests.
- What ScriptVault should avoid: hiding platform limits until a user's script silently fails.

### Bitwarden Browser Client

- Product/source: [Bitwarden browser client](https://github.com/bitwarden/clients/tree/main/apps/browser).
- Notable capabilities: security-sensitive extension with release discipline, diagnostics, and user-trust expectations.
- What ScriptVault should learn: code-execution tools need auditable release artifacts, careful permission copy, and privacy-first diagnostics.
- What ScriptVault should avoid: one-off release scripts without reproducibility or provenance once the product is public.

### Platform and Store Guidance

- Product/source: Chrome Web Store policies, CWS API v2 docs, rollback docs, MDN Firefox extension docs, Extension Workshop source-submission docs, Edge Add-ons docs, WXT docs.
- Notable capabilities: stores increasingly expect accurate data-use declarations, source review packages, API migrations, and explicit browser compatibility.
- What ScriptVault should learn: release automation is now a product feature because inaccurate metadata and stale artifacts directly affect user trust.
- What ScriptVault should avoid: relying on README claims when public store metadata, release assets, and privacy policy say something different.

## Highest-Value New Features

### 1. Release Trust Ledger

- Title: Release trust ledger for every packaged version.
- User problem solved: users cannot currently reconcile local v3.11.0, GitHub Release v2.3.4, stale Chrome Web Store copy, and stale Firefox XPI artifacts.
- Evidence: `package.json`, `manifest.json`, and README show 3.11.0; `gh release list` shows latest public release v2.3.4; CWS listing shows older v1.7.4/CodeMirror/24+ GM copy; root contains `ScriptVault-firefox-v2.1.7.xpi`.
- Proposed behavior: generate `release-evidence.json` and a human-readable release checklist for each version showing package version, manifest versions, Git tag, GitHub release, CWS package/listing metadata, artifact hashes, permissions, privacy copy, changelog section, and rollback target.
- Implementation areas: `scripts/release-evidence.*`, `.github/workflows/ci.yml`, `publish.sh`, `docs/release-runbook.md`, `CHANGELOG.md`, `README.md`.
- Data model/API/UI implications: no runtime user-data impact; adds release metadata artifacts and CI gates.
- Risks and edge cases: store dashboard data requires credentials; public scraping can be flaky; release artifacts must not leak secrets.
- Verification plan: run evidence generator in CI, compare generated JSON against committed expectations, manually verify public CWS and GitHub release pages.
- Estimated complexity: M.
- Priority: P0.

### 2. Pending Update Inbox

- Title: Pending update inbox with diff, trust receipt, and rollback point.
- User problem solved: a script update is executable code; current auto-update and some bulk flows can apply changes without giving users a durable review and recovery point.
- Evidence: `background.core.js` contains `autoUpdate` and `applyUpdate`; dashboard has `interactiveCheckAndConfirmUpdate`; README advertises auto-update; code history emphasizes install/update trust polish.
- Proposed behavior: all non-manual updates land in a pending inbox by default. Users see script name, old/new version, source URL, fetched hash, changed grants/matches/resources, diff summary, analyzer result, and one-click apply/skip/rollback. Auto-update can be configured as "notify only", "safe metadata-only", or "apply trusted sources".
- Implementation areas: `background.core.js`, `src/background/update-checker.ts`, dashboard update UI, storage schema, analyzer/signing modules, tests.
- Data model/API/UI implications: add pending update records keyed by script id and source URL; add update receipt/history entries; expose count in dashboard, popup, and side panel.
- Risks and edge cases: large diffs, scripts without versions, source URL changes, failed fetches, deleted upstream scripts, backup storage pressure.
- Verification plan: unit tests for pending states; jsdom dashboard inbox tests; browser smoke installing then updating a fixture script; rollback drill with corrupted update.
- Estimated complexity: L.
- Priority: P0.

### 3. Runtime and Source Parity Gate

- Title: Generated parity gate for background runtime and TypeScript mirrors.
- User problem solved: core security fixes can land in `background.core.js` while TypeScript mirrors retain stale behavior, or vice versa.
- Evidence: `background.core.js` has bounded fetch helpers; `src/background/install-handler.ts`, `src/background/update-checker.ts`, `src/background/resource-loader.ts`, and `src/background/context-menu.ts` still contain buffered `response.text()` paths. Current dirty DNR and wrapper changes also demonstrate active drift.
- Proposed behavior: add a test/generator that enumerates critical runtime contracts and fails CI when canonical runtime and source mirrors diverge. Contracts should cover remote fetch policy, DNR ownership cleanup, wrapper dispatcher behavior, message action schemas, update apply semantics, and public API methods.
- Implementation areas: `src/background/*`, `background.core.js`, `tests/source-*.test.js`, `tests/runtime-parity.test.js`, `esbuild.config.mjs`, CI.
- Data model/API/UI implications: none directly; improves build reliability.
- Risks and edge cases: if `background.core.js` remains canonical, parity tests can become brittle. Better long-term fix is to generate runtime from TypeScript.
- Verification plan: add failing fixture for a known divergence, then make CI pass; run `npm run check`.
- Estimated complexity: M to L.
- Priority: P0.

### 4. Chrome UserScripts Onboarding and Recovery Center

- Title: Browser capability and userScripts recovery center.
- User problem solved: Chrome's userScripts developer toggle and host permissions can block script execution in ways users may not understand.
- Evidence: Chrome userScripts docs require users to enable user scripts for unpacked or developer-mode paths; manifest requires `userScripts`; README claims Chrome 138+ support; roadmap already flags this.
- Proposed behavior: a status card in dashboard/popup detects userScripts availability, registration errors, host access gaps, DNR availability, side panel support, offscreen support, and browser version. It provides a repair checklist with exact browser steps and links, plus a copyable diagnostics bundle.
- Implementation areas: `background.core.js`, `pages/dashboard.js`, `popup.js`, `sidepanel.js`, permissions handling, diagnostics tests.
- Data model/API/UI implications: store last capability probe and last failure reason; no script data migration.
- Risks and edge cases: Chrome channels and enterprise policies vary; the UI must not claim it can fix browser settings it cannot change.
- Verification plan: unit tests for probe states; manual browser profiles with userScripts disabled/enabled; regression test for message copy and status rendering.
- Estimated complexity: M.
- Priority: P0.

### 5. Cross-Provider Sync Health and Conflict Preview

- Title: Sync health dashboard and conflict dry-run.
- User problem solved: users syncing executable scripts need to know what will change before overwriting local or remote state.
- Evidence: `modules/sync-providers.js`, `modules/sync-easycloud.js`, and `pages/dashboard-gist.js` support multiple providers; `PRIVACY.md` does not fully disclose these flows; README advertises five providers and EasyCloud/Gist.
- Proposed behavior: add provider health checks, token revoke, last sync receipt, manual sync, dry-run import/export diff, conflict resolution preview, provider-specific error messages, and a privacy preview before sending data to a provider.
- Implementation areas: sync provider modules, dashboard sync UI, background sync handlers, storage schema, privacy docs.
- Data model/API/UI implications: add sync receipts and conflict preview records; expose provider token state without exposing tokens.
- Risks and edge cases: provider APIs differ; offline queue conflicts; storage quota; token revocation may fail; users may have old provider state.
- Verification plan: provider adapter unit tests with mocked APIs; dry-run fixture tests; manual WebDAV/local mock; privacy copy parity test.
- Estimated complexity: L.
- Priority: P1.

### 6. Large-Library Performance Mode

- Title: Virtualized script library and performance harness.
- User problem solved: power users with hundreds or thousands of scripts need dashboard/search/filter/update flows that remain responsive.
- Evidence: `pages/dashboard.js` is large and `renderScriptTable` directly renders script rows; no virtualization package or large-library gate was found; README advertises advanced filters, full-text search, and bulk operations.
- Proposed behavior: add seeded performance fixtures for 0, 10, 100, 1000, and 5000 scripts; virtualize table/card/list views; debounce and index search; measure dashboard first render, filter latency, bulk-selection latency, and memory.
- Implementation areas: dashboard rendering, search/filter modules, side panel active script list, tests, smoke harness.
- Data model/API/UI implications: no storage format change; may require derived search index cache.
- Risks and edge cases: accessibility with virtualized rows; keyboard navigation; screen reader row counts; selection state across filters.
- Verification plan: jsdom unit tests for state; browser smoke timing thresholds; a11y tests for virtualized table roles; manual 1000-script profile.
- Estimated complexity: L.
- Priority: P1.

### 7. Firefox AMO Validation Lane

- Title: Firefox build and AMO readiness lane.
- User problem solved: the repo advertises Firefox direction but current artifacts and docs are not release-ready.
- Evidence: `manifest-firefox.json` exists at 3.11.0, `FIREFOX-PORT.md` Phase 1 is unchecked, `build-firefox.sh` packages Firefox, and root contains stale `ScriptVault-firefox-v2.1.7.xpi`.
- Proposed behavior: add `npm run build:firefox`, `npm run lint:firefox`, generated Firefox support matrix, AMO data-collection metadata, source-package notes for minified code, and a release-blocking stale-artifact check.
- Implementation areas: `manifest-firefox.json`, `build-firefox.sh`, `package.json`, CI, `FIREFOX-PORT.md`, `docs/cross-browser-pipeline.md`.
- Data model/API/UI implications: feature-gated UI for unsupported Chrome-only APIs; no existing Chrome data migration.
- Risks and edge cases: Firefox MV3 support differences, `userScripts` API differences, side panel/offscreen absence, Monaco bundling, AMO review requirements.
- Verification plan: generated Firefox zip, `web-ext lint`, Firefox profile sideload smoke, unsupported feature tests.
- Estimated complexity: L.
- Priority: P1.

### 8. Diagnostics Bundle with Redaction Preview

- Title: Redacted support bundle and failure receipt system.
- User problem solved: when installs, updates, sync, DNR, or script execution fail, users need actionable support data without leaking script secrets or tokens.
- Evidence: dashboard includes diagnostics/support surfaces; sync and Gist can store tokens; runtime has many failure-prone browser APIs.
- Proposed behavior: each critical failure writes a structured receipt with timestamp, browser/version, script id/name, action, source, error code, and recovery advice. Support bundle export shows a redaction preview and excludes tokens, script code by default, and sensitive URLs unless opted in.
- Implementation areas: background error handling, dashboard diagnostics, support bundle UI, sync modules, install/update runtime, tests.
- Data model/API/UI implications: add bounded diagnostic receipt storage with retention policy.
- Risks and edge cases: accidental leakage; too many logs; storage quota; privacy policy alignment.
- Verification plan: unit tests for redaction; simulated failure receipts; manual export review; privacy copy gate.
- Estimated complexity: M.
- Priority: P1.

### 9. Site-Scoped Controls and Host Permission Requests

- Title: Active-site control center with optional host access requests.
- User problem solved: users need to understand which scripts affect the current site and recover when host access blocks execution.
- Evidence: popup and side panel exist; Chrome permissions docs include host access request capabilities in newer Chrome; manifest uses broad host access and scripting/userScripts.
- Proposed behavior: popup/side panel show active scripts for the current tab, blocked scripts, required host permissions, script-specific pause/resume, and a request-host-access action when supported.
- Implementation areas: `popup.js`, `sidepanel.js`, background permission probes, dashboard settings.
- Data model/API/UI implications: store per-site pause/allow overrides and last host permission probe.
- Risks and edge cases: browser-version support, enterprise-managed permissions, confusing interaction with script match patterns.
- Verification plan: browser profile with withheld host access; unit tests for active tab matching; manual prompt tests on supported Chrome.
- Estimated complexity: M.
- Priority: P1.

### 10. Generated GM API Compatibility Matrix

- Title: Test-backed GM API compatibility matrix and import warnings.
- User problem solved: users migrating from other managers need to know whether their scripts will run correctly.
- Evidence: README claims 35+ GM APIs; tests cover many APIs; competitors document GM APIs publicly.
- Proposed behavior: generate a compatibility table from test metadata with status, limitations, browser support, and last test name. Import/install warns on unsupported or partial grants.
- Implementation areas: tests metadata, README docs generation, install parser, dashboard script details.
- Data model/API/UI implications: no storage migration; install warnings become part of trust receipt.
- Risks and edge cases: APIs may have partial semantics that are hard to summarize; docs can become stale if not generated.
- Verification plan: generator test; install fixture using unsupported grants; README diff in CI.
- Estimated complexity: M.
- Priority: P2.

### 11. Edge Add-ons and Chromium Derivative Channel

- Title: Edge/Chromium derivative release matrix.
- User problem solved: users on Edge, Brave, and other Chromium browsers need a supported path and accurate limitations.
- Evidence: extension is MV3 Chrome-focused; docs include WXT/cross-browser planning; Edge Add-ons publish docs are available.
- Proposed behavior: add an Edge manifest/release package gate, browser support matrix, and manual smoke checklist for Chrome, Edge, Brave, and Chromium.
- Implementation areas: build scripts, manifest generation, docs, CI smoke matrix.
- Data model/API/UI implications: browser-specific feature flags; no storage change.
- Risks and edge cases: store-specific metadata and review requirements; browser API differences.
- Verification plan: Edge sideload smoke; Edge Add-ons package lint; generated support matrix.
- Estimated complexity: M.
- Priority: P2.

### 12. Supply-Chain Provenance and SBOM

- Title: Signed artifacts, SBOM, and package diff release gate.
- User problem solved: a code-execution extension needs a reproducible release trail.
- Evidence: release runbook discusses custody/OIDC ambitions; no signed artifact/SBOM/provenance gate found; npm/SLSA provenance guidance is available.
- Proposed behavior: publish a release bundle with artifact hashes, SBOM, generated package file list, source commit, dependency snapshot, GitHub release notes, and optional provenance statement.
- Implementation areas: CI release workflow, `build.sh`, `publish.sh`, docs, GitHub Releases.
- Data model/API/UI implications: no runtime impact.
- Risks and edge cases: secrets handling, reproducibility across OS zip tools, review of minified Monaco/source packages.
- Verification plan: compare package diff to expected allowlist; verify hashes; dry-run release job.
- Estimated complexity: M to L.
- Priority: P2.

## Existing Feature Improvements

### Release Metadata and Public Listing

- Current behavior: local files advertise 3.11.0, but public GitHub Releases remain at v2.3.4 and the Chrome Web Store listing still shows stale v1.7.4-era messaging.
- Problem or missed opportunity: the first public trust signal contradicts the product's current state.
- Recommended change: create a release parity gate and update public store/release metadata as part of a controlled release.
- Code locations likely affected: `README.md`, `CHANGELOG.md`, `docs/release-runbook.md`, `publish.sh`, `.github/workflows/ci.yml`, release scripts.
- Backward compatibility concerns: none for user data; store submission must preserve extension id.
- Verification plan: generated evidence file plus manual public page verification.
- Estimated complexity: M.
- Priority: P0.

### Privacy Policy and Data-Use Copy

- Current behavior: `PRIVACY.md` says data never leaves the device unless export is used, but sync, EasyCloud, provider integrations, Gist token flows, install/update fetches, `@require`, and `@resource` can all send or fetch data.
- Problem or missed opportunity: privacy copy is stale and could conflict with store policy expectations.
- Recommended change: update privacy policy and add a generated data-flow table from code/config for install/update/sync/provider/diagnostics behavior.
- Code locations likely affected: `PRIVACY.md`, README, store copy checklist, sync modules, release evidence generator.
- Backward compatibility concerns: no data migration; copy must be accurate and conservative.
- Verification plan: docs test for provider names and data categories; manual store metadata review.
- Estimated complexity: S to M.
- Priority: P0.

### Chrome Web Store API v2 Runbook

- Current behavior: `publish.sh` already uses v4-style `chrome-webstore-upload` arguments, but `docs/release-runbook.md` still describes older 3.5.0 migration state and OIDC as unimplemented.
- Problem or missed opportunity: release instructions can mislead the next publisher.
- Recommended change: update runbook to current script behavior, add a dry-run release job, confirm Node version requirements for the v4 CLI, and document rollback.
- Code locations likely affected: `docs/release-runbook.md`, `publish.sh`, `.github/workflows/ci.yml`, `package.json`.
- Backward compatibility concerns: avoid breaking manual publish path.
- Verification plan: `npm run build:prod`, release dry run with fake credentials or mocked CLI, CI workflow lint.
- Estimated complexity: M.
- Priority: P0.

### CI Audit Policy

- Current behavior: CI runs `npm audit --audit-level=high --omit=optional` with `continue-on-error: true`.
- Problem or missed opportunity: audit failures are visible but not blocking for a trust-sensitive extension.
- Recommended change: make high/critical audit failures blocking, or produce an explicit checked-in exception file with expiry and owner.
- Code locations likely affected: `.github/workflows/ci.yml`, security docs.
- Backward compatibility concerns: dependency churn can block merges; exceptions need a process.
- Verification plan: workflow run with mocked audit failure or temporary fixture; confirm failure/exception behavior.
- Estimated complexity: S.
- Priority: P0.

### Bounded Fetch Parity

- Current behavior: `background.core.js` has `_fetchTextBounded`, but TS mirrors still include direct `response.text()`.
- Problem or missed opportunity: future builds or refactors can reintroduce unbounded remote reads.
- Recommended change: move bounded fetch into a shared module and forbid raw `response.text()` on remote fetches except allowlisted local/test cases.
- Code locations likely affected: `background.core.js`, `src/background/install-handler.ts`, `src/background/update-checker.ts`, `src/background/resource-loader.ts`, `src/background/context-menu.ts`, tests.
- Backward compatibility concerns: scripts relying on very large resources may now receive explicit size errors.
- Verification plan: size-limit fixture tests for install/update/require/resource/context menu paths; `npm run check`.
- Estimated complexity: M.
- Priority: P0.

### DNR `GM_webRequest` Ownership Cleanup

- Current behavior: dirty worktree changes improve DNR persistence rollback and cleanup retry semantics, but those changes are uncommitted and not verified as released.
- Problem or missed opportunity: stale DNR rules can affect browsing after a script is removed or storage persistence fails.
- Recommended change: complete, review, and release the DNR cleanup changes with source/runtime parity tests and recovery receipts.
- Code locations likely affected: `background.core.js`, `src/background/dnr-rules.ts`, `src/background/index.ts`, `tests/source-dnr-rules.test.js`, wrapper/runtime tests.
- Backward compatibility concerns: cleanup must not remove rules owned by other scripts or extensions.
- Verification plan: source tests, runtime tests, manual dynamic rule inspection after install/delete/restart.
- Estimated complexity: M.
- Priority: P0.

### `window.onurlchange` Dispatcher

- Current behavior: dirty worktree changes modify wrapper generation to use a page-scoped dispatcher and avoid stacked history patches.
- Problem or missed opportunity: duplicate history patching can create confusing script behavior and hard-to-debug page interaction.
- Recommended change: finish source/runtime parity and browser smoke tests for the dispatcher before release.
- Code locations likely affected: `src/background/wrapper-builder.ts`, `background.core.js` or generator source, `tests/wrapper-dom-security.test.js`.
- Backward compatibility concerns: existing scripts expecting Tampermonkey-like `window.onurlchange` behavior must still work.
- Verification plan: fixture script that sets `window.onurlchange`, route changes via pushState/replaceState/popstate, ensure one event per navigation.
- Estimated complexity: S to M.
- Priority: P0.

### XHR Callback Transport

- Current behavior: `content.js` uses `window.postMessage` bridging for many wrapper callbacks; background also has a `chrome.runtime.onUserScriptMessage` listener.
- Problem or missed opportunity: page-message bridges are harder to reason about and increase privacy/confusion risk for XHR-like APIs.
- Recommended change: migrate sensitive GM XHR callback/event traffic to `runtime.onUserScriptMessage` where supported, keeping a capability-gated fallback.
- Code locations likely affected: `content.js`, `background.core.js`, wrapper builder, message schema tests, `.factory/large-repo-state.yaml`.
- Backward compatibility concerns: Chrome version minimum and fallback path must preserve existing scripts.
- Verification plan: real Chrome fixture script using GM_xmlhttpRequest progress/load/error/abort; assert no page-visible sensitive payloads where new path is active.
- Estimated complexity: L.
- Priority: P1.

### Remote Fetch Policy

- Current behavior: fetch safety exists in places, but `.factory/large-repo-state.yaml` still flags DNS rebinding and post-fetch IP verification as remaining.
- Problem or missed opportunity: install/update/resource fetches can traverse redirects or private IP resolution unless all paths share one policy.
- Recommended change: create one remote fetch policy module for script installs, updates, `@require`, `@resource`, catalog/source checks, and provider-safe exceptions.
- Code locations likely affected: background install/update/resource/context-menu handlers, tests, docs.
- Backward compatibility concerns: local development or self-hosted scripts on private networks need an explicit opt-in or clear error.
- Verification plan: mocked DNS/redirect/private-IP fixtures; allowlist/denylist tests; manual local-network script install test.
- Estimated complexity: L.
- Priority: P1.

### Backup and Restore Verification

- Current behavior: export/import and trash/rollback exist, but there is no clear end-to-end backup verification drill in current CI.
- Problem or missed opportunity: recovery features are trust features only if users can prove a backup can be restored.
- Recommended change: add backup verification that exports, validates schema/hash, imports into a clean profile, compares script/settings counts, and produces a receipt.
- Code locations likely affected: dashboard import/export, background storage handlers, tests, release runbook.
- Backward compatibility concerns: old backup formats must continue importing with migration warnings.
- Verification plan: fixture backups for current and older formats; import/export round-trip tests.
- Estimated complexity: M.
- Priority: P1.

### Dashboard File Size and Module Boundaries

- Current behavior: `pages/dashboard.js` and `pages/dashboard.html` are very large, while many feature areas share state and DOM helpers.
- Problem or missed opportunity: changes are risky, tests are broad, and performance regressions are hard to isolate.
- Recommended change: extract update inbox, sync health, backup/trash, search/filter, and diagnostics panels into modules with explicit state contracts.
- Code locations likely affected: dashboard JS/HTML/CSS and tests.
- Backward compatibility concerns: preserve selectors relied on by tests and user workflows.
- Verification plan: existing dashboard tests plus per-module unit tests and smoke test.
- Estimated complexity: L.
- Priority: P2.

### Dependency Refresh

- Current behavior: `npm outdated` reports newer versions for Vitest, coverage-v8, chrome-types, esbuild, jsdom, Monaco, Puppeteer-core, and TypeScript.
- Problem or missed opportunity: stale dev tooling can hide browser API changes and make CI brittle.
- Recommended change: refresh low-risk patch/minor dev dependencies first; isolate Monaco and Puppeteer major/minor behavior changes in separate PRs.
- Code locations likely affected: `package.json`, `package-lock.json`, test snapshots if any.
- Backward compatibility concerns: Monaco 0.55.x may alter bundle size/editor behavior; Puppeteer 25 may change browser handling.
- Verification plan: `npm run check`, `npm run build`, dashboard smoke, package size diff.
- Estimated complexity: S to M.
- Priority: P3.

## Reliability, Security, Privacy, and Data Safety

Bugs or risks found:

- Verified: public release state is inconsistent. Local 3.11.0 does not match GitHub Releases latest v2.3.4 or CWS stale listing copy.
- Verified: root stale artifact `ScriptVault-firefox-v2.1.7.xpi` conflicts with current 3.11.0 source and can confuse distribution.
- Verified: privacy policy is stale relative to sync/cloud/Gist/provider flows.
- Verified: CI audit is non-blocking for high vulnerabilities.
- Verified: source/runtime mirror drift exists for bounded fetch and is visible in current dirty hardening work.
- Verified: TypeScript mirror still contains raw `response.text()` in remote fetch paths.
- Likely: auto-update and bulk-update flows still need a consent-first pending queue.
- Likely: Firefox path is not AMO-ready because Phase 1 tasks are unchecked and no `web-ext lint` gate was found.
- Needs live validation: actual CWS package and store dashboard data-use declarations.
- Needs live validation: DNR cleanup behavior after browser restart and dynamic rule removal failures.

Missing guardrails:

- Release parity gate across package/manifests/README/changelog/store/privacy/artifacts.
- Signed artifact/SBOM/provenance/package-diff gate.
- Generated permission and data-use table.
- Remote fetch shared policy for internal IP, redirect, DNS-rebind, and byte limits.
- Update inbox and rollback receipt for every executable update.
- Token redaction tests for diagnostics bundle and support export.
- Firefox/Edge feature gating and package validation.

Permission/network/file-system concerns:

- `<all_urls>` and broad host access are intrinsic to a userscript manager, but the extension needs generated, user-facing justification and active-site status.
- Sync providers and Gist can move script contents and tokens off-device; privacy copy and UI receipts must be explicit.
- `@require` and `@resource` fetches expand the trust boundary beyond the top-level script source.
- DNR dynamic rules can affect browsing beyond a single script lifecycle if cleanup/persistence fails.
- Build scripts produce ZIP/XPI artifacts; stale root artifacts should be blocked outside a release directory.

Recovery and rollback needs:

- Pre-update rollback points for all update paths.
- Restore receipt after trash recovery and backup import.
- Backup verification drill in CI.
- CWS rollback runbook and tested rollback target.
- DNR cleanup retry and recovery receipt for stuck dynamic rules.

Logging/diagnostics needs:

- Structured failure receipts for install/update/sync/DNR/userScripts/permission failures.
- Redacted support bundle with preview.
- Browser capability snapshot including Chrome version, userScripts availability, DNR support, side panel support, offscreen support, storage quota, and permissions.
- Retention bounds for logs and receipts.

## UX, Accessibility, and Trust

Onboarding gaps:

- Chrome userScripts enablement and browser capability checks should be first-run status cards, not only documentation.
- Users should see why broad permissions are needed and whether the current site is covered.
- Migrators from Tampermonkey/Violentmonkey need compatibility import warnings before install.

Empty/loading/error/disabled states:

- Sync provider panels need provider-specific empty/error states and token-health repair actions.
- Update flows need pending/failed/skipped/applied states with receipts.
- Dashboard large-library loading should avoid full-table jank and preserve keyboard focus.
- Firefox/unsupported browser surfaces should show feature-gated explanations.

Destructive or irreversible actions:

- Permanent trash empty, bulk delete, overwrite import, cloud overwrite, and update apply need count/source/date confirmation and recovery points.
- Auto-update should default to notify/review for untrusted sources.

Settings clarity:

- Distinguish local storage, browser sync, EasyCloud, provider sync, and Gist sync.
- Show where tokens are stored and how to revoke them.
- Explain per-site pauses, global extension disable, script disable, and browser host permissions separately.

Accessibility issues and opportunities:

- Existing a11y helpers/tests are a strong base, but virtualized lists and dense dashboard panels need explicit keyboard and screen-reader contracts.
- Add forced-colors/high-contrast manual tests and automated checks where possible.
- Add live-region consistency for long-running sync/update/import/export operations.
- Use WCAG 2.2 as the baseline and treat WCAG 3/APCA as advisory for future contrast review.
- Monaco needs a fallback or clear warning for assistive technology limitations.

Microcopy and trust-signal improvements:

- Replace vague update/install success messages with source, version, hash, and rollback status.
- Show "review required", "trusted source", "local backup created", and "provider sync dry-run" states.
- Keep public store, README, privacy policy, and in-app copy synchronized through generated checks.

## Architecture and Maintainability

Module or boundary improvements:

- Make TypeScript the canonical source for background subsystems, or explicitly mark `background.core.js` as canonical and generate parity tests. The current mixed model is the root of repeated drift.
- Extract shared remote fetch policy and forbid ad hoc remote `response.text()`.
- Extract dashboard panels into testable modules with state contracts.
- Define message/action schemas in one place and generate runtime validators/tests.
- Isolate browser capability feature flags for Chrome, Firefox, Edge, Brave, and future targets.

Refactor candidates:

- `pages/dashboard.js`: split update, sync, backup/trash, diagnostics, search/filter, and editor state.
- `pages/dashboard.html`: split repeated panel markup into generated or template-driven sections if build tooling supports it.
- `background.core.js`: move install/update/resource/DNR/userScripts/message handling toward source modules with golden tests.
- `content.js`: reduce page `postMessage` bridge surface and isolate fallback transport.
- `build-firefox.sh`: align packaging with `web-ext` and avoid stale artifact placement.

Test gaps:

- Store/release metadata parity.
- Real-browser Chrome userScripts toggle and host permission flows.
- Full pending update queue and rollback drill.
- Cloud sync dry-run and conflict resolution.
- Large-library performance thresholds.
- Firefox `web-ext lint` and sideload smoke.
- Token redaction for diagnostics bundle.
- Generated GM API compatibility matrix.

Documentation gaps:

- Privacy policy and data-use disclosure.
- Release runbook current state for CWS API v2, rollback, artifact custody, and OIDC.
- Firefox AMO readiness and unsupported feature matrix.
- Edge/Chromium derivative support matrix.
- Generated API and GM compatibility docs.

Release/build/deployment gaps:

- No complete release workflow found.
- Public releases lag local version.
- CWS listing copy lags product.
- CI audit is non-blocking.
- No SBOM/provenance/package-diff gate found.
- Stale XPI artifact at repo root.
- Firefox package validation not release-gated.

## Prioritized Roadmap

### Phase 0 - Do Not Lose Trust

- [ ] P0 - Reconcile public release, store, and root artifact state
  - Why: users and reviewers currently see conflicting versions and capability claims.
  - Evidence: `package.json`/manifests/README show 3.11.0; GitHub Releases latest is v2.3.4; CWS listing shows stale v1.7.4-era copy; root has `ScriptVault-firefox-v2.1.7.xpi`.
  - Touches: `README.md`, `CHANGELOG.md`, `docs/release-runbook.md`, GitHub Releases, CWS listing, root artifact policy.
  - Acceptance: public GitHub release, CWS listing, repo docs, artifacts, and privacy/store copy all describe the same version and feature set; stale root XPI is removed or moved to a release archive with metadata.
  - Verify: `gh release list --limit 5`; public CWS listing check; `git status --short`; generated release evidence report.

- [ ] P0 - Add release/store/privacy parity checker
  - Why: public metadata drift is recurring and directly harms trust.
  - Evidence: README, manifests, CWS listing, `PRIVACY.md`, and release state disagree today.
  - Touches: new `scripts/release-evidence.*`, `PRIVACY.md`, `README.md`, `manifest*.json`, `package.json`, `.github/workflows/ci.yml`.
  - Acceptance: CI fails when package/manifests/README/changelog/privacy/release artifacts/store copy expectations diverge.
  - Verify: run parity checker locally with current expected metadata; intentionally change one version string and confirm failure.

- [ ] P0 - Update CWS API v2 runbook and add publish dry-run path
  - Why: `publish.sh` has moved ahead of `docs/release-runbook.md`, and CWS API v1 sunset is dated for 2026-10-15.
  - Evidence: official CWS API v2 docs; `publish.sh`; stale runbook section describing older CLI pin/migration state.
  - Touches: `docs/release-runbook.md`, `publish.sh`, `package.json`, `.github/workflows/ci.yml`.
  - Acceptance: release docs match actual CLI/env vars, include rollback, and CI can perform a non-secret dry run.
  - Verify: `npm run build:prod`; mocked publish dry run; docs link check.

- [ ] P0 - Make high/critical audit failures blocking or exception-gated
  - Why: trust-sensitive extension CI should not silently pass known high vulnerabilities.
  - Evidence: `.github/workflows/ci.yml` uses `continue-on-error: true` for audit.
  - Touches: `.github/workflows/ci.yml`, optional security exception file.
  - Acceptance: high/critical audit failures block CI unless a reviewed expiring exception exists.
  - Verify: workflow test or local audit fixture demonstrating fail/exception behavior.

- [ ] P0 - Add runtime/source parity gate for critical background behavior
  - Why: security fixes are split between `background.core.js` and TypeScript mirrors.
  - Evidence: bounded fetch exists in runtime but TS mirrors still call `response.text()`; dirty DNR/wrapper changes show active drift.
  - Touches: `background.core.js`, `src/background/*.ts`, `tests/source-*.test.js`, CI.
  - Acceptance: CI fails on drift for fetch policy, DNR cleanup, wrapper dispatcher, update apply, and message schemas.
  - Verify: `npm run check`; targeted parity test with a known drift fixture.

- [ ] P0 - Centralize bounded remote fetch policy
  - Why: installs, updates, `@require`, resources, and context-menu flows should share size, redirect, timeout, and private-network rules.
  - Evidence: runtime `_fetchTextBounded`; raw `response.text()` remains in TS install/update/resource/context-menu paths; `.factory/large-repo-state.yaml` flags DNS rebinding.
  - Touches: `background.core.js`, `src/background/install-handler.ts`, `src/background/update-checker.ts`, `src/background/resource-loader.ts`, `src/background/context-menu.ts`.
  - Acceptance: all remote script/resource fetches use one policy module; oversized, private-network, and redirected fixtures return explicit errors.
  - Verify: targeted remote fetch tests plus `npm run check`.

- [ ] P0 - Build pending update inbox with rollback receipt
  - Why: executable updates need review and recovery, especially for auto/bulk paths.
  - Evidence: `background.core.js` auto-update/apply paths; dashboard per-script confirmation exists but no universal pending queue.
  - Touches: `background.core.js`, `src/background/update-checker.ts`, dashboard update UI, storage schema, analyzer/signing modules.
  - Acceptance: auto/bulk updates create pending records with diff/trust/analyzer info and a rollback point before apply.
  - Verify: fixture update flow: install old script, detect new script, review pending item, apply, rollback.

- [ ] P0 - Add Chrome userScripts and browser capability recovery center
  - Why: browser toggles and permissions can prevent script execution with confusing symptoms.
  - Evidence: Chrome userScripts docs; `manifest.json` requires `userScripts`; README targets modern Chrome.
  - Touches: background capability probes, `pages/dashboard.js`, `popup.js`, `sidepanel.js`.
  - Acceptance: dashboard/popup show userScripts, DNR, offscreen, side panel, browser version, and host permission status with repair guidance.
  - Verify: manual Chrome profile with userScripts disabled/enabled; unit tests for status rendering.

### Phase 1 - Runtime Safety and Data Recovery

- [ ] P1 - Migrate sensitive XHR callback transport to user-script messaging
  - Why: page `postMessage` bridges are harder to audit for privacy-sensitive callback payloads.
  - Evidence: `content.js` page bridge; `background.core.js` has `chrome.runtime.onUserScriptMessage`; `.factory/large-repo-state.yaml` flags XHR-PRIVACY.
  - Touches: `content.js`, `background.core.js`, wrapper builder, message schema tests.
  - Acceptance: supported Chrome versions use user-script messaging for GM XHR callbacks; fallback is capability-gated and tested.
  - Verify: real-browser fixture with GM_xmlhttpRequest progress/load/error/abort and assertions about page-visible payloads.

- [ ] P1 - Finish DNR ownership cleanup and retry semantics
  - Why: stale DNR rules can affect browsing after script removal or failed persistence.
  - Evidence: current dirty changes modify DNR rollback, cleanup retry, and reconcile behavior.
  - Touches: `background.core.js`, `src/background/dnr-rules.ts`, `src/background/index.ts`, `tests/source-dnr-rules.test.js`.
  - Acceptance: failed map persistence rolls back newly added rules; failed DNR removal preserves ownership until successful cleanup; reconcile is idempotent.
  - Verify: source/runtime tests and manual dynamic rule inspection after restart.

- [ ] P1 - Finish page-scoped `window.onurlchange` dispatcher parity
  - Why: stacked history patches can break page behavior and duplicate script events.
  - Evidence: current dirty changes in `src/background/wrapper-builder.ts` and wrapper tests.
  - Touches: wrapper builder, generated runtime, wrapper tests.
  - Acceptance: one page-scoped dispatcher is installed per page and scripts receive expected URL-change events exactly once.
  - Verify: fixture page using pushState, replaceState, and popstate under multiple scripts.

- [ ] P1 - Add backup verification and restore receipts
  - Why: export/import/trash/rollback are only trustworthy if recovery is verifiable.
  - Evidence: trash exists in `background.core.js`; README advertises backup/rollback/trash; no end-to-end drill found.
  - Touches: background storage handlers, dashboard import/export/trash UI, tests.
  - Acceptance: backup export validates schema/hash; import dry-run shows changes; restore writes a receipt.
  - Verify: export/import round trip in a clean test profile and fixture import of an older backup.

- [ ] P1 - Align privacy policy and sync/token UX
  - Why: current privacy copy under-describes cloud and token flows.
  - Evidence: `PRIVACY.md`; `modules/sync-providers.js`; `modules/sync-easycloud.js`; `pages/dashboard-gist.js`.
  - Touches: `PRIVACY.md`, dashboard sync UI, provider modules, release parity checker.
  - Acceptance: users can see provider data flows, token storage, revoke controls, last sync status, and dry-run conflicts.
  - Verify: provider mock tests, docs parity check, manual Gist/WebDAV mock flow.

- [ ] P1 - Add redacted diagnostics bundle
  - Why: support data is needed for complex failures but must not leak tokens or script secrets by default.
  - Evidence: diagnostics surfaces exist; provider tokens and script contents can be sensitive.
  - Touches: dashboard diagnostics, background error receipts, sync/install/update handlers.
  - Acceptance: export shows redaction preview and excludes tokens/code by default; failure receipts are structured and bounded.
  - Verify: redaction unit tests with token/script fixtures; manual export review.

### Phase 2 - Workflow Reliability and Scale

- [ ] P1 - Add large-library performance harness and virtualization
  - Why: a power-user script manager must stay responsive with hundreds or thousands of scripts.
  - Evidence: direct dashboard rendering in `renderScriptTable`; very large dashboard files; no virtualization gate found.
  - Touches: dashboard rendering, search/filter modules, side panel active list, performance tests.
  - Acceptance: 1000-script library renders, filters, selects, and bulk-updates within defined thresholds without focus loss.
  - Verify: browser smoke with seeded 0/10/100/1000/5000 script fixtures.

- [ ] P1 - Add site-scoped controls and host permission recovery
  - Why: users need to know which scripts affect the active site and why a script is blocked.
  - Evidence: popup/side panel exist; Chrome permissions API supports newer host access request patterns.
  - Touches: `popup.js`, `sidepanel.js`, background permission probes, settings.
  - Acceptance: active site shows running/blocked scripts, missing host access, pause/resume controls, and request action when supported.
  - Verify: manual Chrome profile with withheld host access; unit tests for match/blocked states.

- [ ] P2 - Generate GM API compatibility matrix
  - Why: migration users need test-backed compatibility claims.
  - Evidence: README claims 35+ APIs; competitors publish API docs; tests cover many API behaviors.
  - Touches: tests, docs generator, README, install warnings.
  - Acceptance: README/API docs table is generated from test metadata and install warns on unsupported grants.
  - Verify: generator test; unsupported grant fixture.

- [ ] P2 - Split dashboard modules around state contracts
  - Why: dashboard scope makes future trust and sync changes risky.
  - Evidence: `pages/dashboard.js` and `pages/dashboard.html` are large and multi-feature.
  - Touches: dashboard JS/HTML/CSS, tests.
  - Acceptance: update, sync, backup/trash, diagnostics, search/filter, and editor concerns have isolated modules and tests.
  - Verify: existing dashboard tests, smoke test, no selector regressions.

- [ ] P2 - Add locale and accessibility coverage gates
  - Why: README advertises localization and polished UI, and dense panels need stronger accessibility contracts.
  - Evidence: `_locales/*`, `pages/dashboard-a11y.js`, existing a11y tests.
  - Touches: locale files, dashboard/popup/sidepanel UI, a11y tests.
  - Acceptance: missing locale keys fail CI; forced-colors/high-contrast and live-region states are covered.
  - Verify: locale coverage script; `npm run test:a11y`; manual forced-colors pass.

### Phase 3 - Browser Channels and Release Scale

- [ ] P1 - Make Firefox AMO validation release-gated
  - Why: Firefox support is visible but not ready for users without validation.
  - Evidence: `manifest-firefox.json`; `build-firefox.sh`; `FIREFOX-PORT.md` Phase 1 unchecked; stale root XPI.
  - Touches: Firefox manifest/build script, CI, `FIREFOX-PORT.md`, `docs/cross-browser-pipeline.md`.
  - Acceptance: Firefox package builds, passes `web-ext lint`, has source submission notes, and gates unsupported APIs.
  - Verify: `npm run build:firefox`; `web-ext lint`; Firefox sideload smoke.

- [ ] P2 - Add Edge/Chromium derivative support matrix
  - Why: users on Edge/Brave/Chromium need clear support expectations.
  - Evidence: Chrome MV3 code likely works in some derivatives, but no matrix/gate was found.
  - Touches: docs, manifest generation, smoke checklist, optional Edge package.
  - Acceptance: Chrome, Edge, Brave, Chromium rows list supported/unsupported APIs and manual smoke status.
  - Verify: Edge sideload smoke and generated docs.

- [ ] P2 - Add SBOM, provenance, artifact hash, and package diff release gate
  - Why: release artifacts for a code-execution extension should be auditable.
  - Evidence: runbook custody ambitions; no complete provenance/SBOM gate found.
  - Touches: CI release workflow, `build.sh`, `publish.sh`, GitHub Releases, release docs.
  - Acceptance: every release has package file list, hashes, dependency snapshot, SBOM/provenance metadata, and allowed diff.
  - Verify: release dry run creates artifacts and verifies hashes.

- [ ] P3 - Refresh dev dependencies in staged batches
  - Why: stale test/build dependencies can mask browser API and build issues.
  - Evidence: `npm outdated --json` results for Vitest, chrome-types, esbuild, jsdom, Monaco, Puppeteer-core, TypeScript.
  - Touches: `package.json`, `package-lock.json`, tests.
  - Acceptance: low-risk patch/minor updates land first; Monaco/Puppeteer behavior changes are isolated.
  - Verify: `npm run check`; `npm run build`; dashboard smoke; package size diff.

### Phase 4 - Larger Bets

- [ ] P2 - Evaluate WXT migration spike
  - Why: current manual cross-browser build complexity will grow with Firefox/Edge/Safari aspirations.
  - Evidence: `docs/cross-browser-pipeline.md` selected WXT for staged exploration; WXT docs support browser-targeted manifests.
  - Touches: build pipeline prototype branch, manifest generation, source layout.
  - Acceptance: spike demonstrates Chrome and Firefox package parity or documents blockers with measured effort.
  - Verify: prototype build artifacts and smoke checklist.

- [ ] P3 - Add S3-compatible sync provider after sync health lands
  - Why: advanced users may want self-hosted object storage, but existing providers need health/conflict foundations first.
  - Evidence: sync provider architecture exists; ScriptCat and adjacent tools show appetite for flexible sync.
  - Touches: `modules/sync-providers.js`, dashboard sync UI, provider docs.
  - Acceptance: S3 provider supports endpoint/bucket/key config, dry-run conflict preview, token redaction, and revoke/disable.
  - Verify: MinIO/local S3 integration test and dry-run import/export.

- [ ] P3 - Publish script developer SDK examples
  - Why: a public API and rich GM surface become more valuable with examples.
  - Evidence: `modules/public-api.js`, `src/modules/public-api.ts`, README feature claims.
  - Touches: docs, examples, public API tests.
  - Acceptance: examples cover install, update query, diagnostics export, and script metadata operations.
  - Verify: example tests run against public API fixtures.

## Quick Wins

- Remove or archive `ScriptVault-firefox-v2.1.7.xpi` from the repo root and add a CI check blocking root ZIP/CRX/XPI artifacts outside release directories.
- Update `PRIVACY.md` to accurately mention cloud sync providers, EasyCloud, GitHub Gist token storage, install/update fetches, `@require`, `@resource`, and diagnostics export.
- Update `docs/release-runbook.md` to match current `publish.sh` v4 arguments and CWS API v2 timing.
- Change CI audit from `continue-on-error: true` to blocking with a documented exception mechanism.
- Add a simple `npm run release:check` script that verifies package/manifests/README/changelog version alignment.
- Add a grep-style guard disallowing raw remote `response.text()` in background source files except explicit allowlisted cases.
- Add a dashboard/popup status item for "pending updates" even before the full inbox is complete.
- Add a token redaction unit test for Gist and provider sync diagnostics.
- Add a stale Firefox artifact note to `FIREFOX-PORT.md` and a `web-ext lint` task placeholder.
- Add a generated list of broad permissions and one-line justifications to the release checklist.

## Larger Bets

- Convert TypeScript source into the single background runtime source of truth and generate `background.core.js`/`background.js` from it.
- Build the full pending update inbox with diff, analyzer, trust receipt, and rollback drill.
- Implement shared remote fetch policy with DNS-rebind and private-network checks across every script/resource path.
- Add real-browser capability testing for Chrome userScripts, host permissions, DNR dynamic rules, and Firefox MV3.
- Virtualize dashboard/side-panel collections and create a large-library performance budget.
- Build cross-browser packages through WXT or an equivalent generated-manifest pipeline.
- Add signed artifacts, SBOM, provenance, and a reproducible package diff release workflow.
- Redesign sync around provider health, conflict previews, data-flow receipts, and privacy-first diagnostics.

## Explicit Non-Goals

- Do not add paid features or monetization just because Tampermonkey has a commercial model. It would dilute ScriptVault's current trust-forward open-source posture.
- Do not pursue Safari before Chrome release parity, Firefox validation, and Edge/Chromium matrix work. Safari requires a native-app distribution model.
- Do not add AI/script-generation features before install/update trust, privacy, and recovery are stable. Generated code would increase risk without addressing current root problems.
- Do not broaden telemetry. Diagnostics should be local/exported with redaction preview unless the user explicitly opts in.
- Do not replace all dashboard UI at once. The current product identity is feature-rich and recognizable; refactor around contracts and performance gates.
- Do not remove broad host access without a replacement model. A userscript manager needs broad reach, but the permission story must be clear and auditable.
- Do not treat Firefox as "Chrome with a different manifest." Browser-specific gaps need explicit feature gates and tests.

## Open Questions

- Needs live validation: what exact package and version are currently uploaded in the Chrome Web Store Developer Dashboard?
- Needs live validation: what data-use declarations, screenshots, and descriptions are currently set in the Chrome Web Store listing console?
- Needs live validation: does the current `chrome-webstore-upload-cli` v4 path require Node 22 in this repo's publish environment, or is CI Node 20 sufficient for install/build while release uses a separate runtime?
- Needs live validation: which cloud sync providers are intended to be publicly supported in the next release versus experimental/hidden?
- Needs live validation: should Firefox target AMO public listing, private/unlisted beta, or developer-only artifact first?
- Product decision: should automatic updates default to "notify only" for all scripts, or "apply trusted sources only" with an explicit trusted-source model?
