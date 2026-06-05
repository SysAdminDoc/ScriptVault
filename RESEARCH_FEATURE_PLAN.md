# Project Research and Feature Plan

Status: current companion research plan for ScriptVault v3.11.0.

Date: 2026-06-05.

Scope: research and planning only. `ROADMAP.md` remains the active checkbox
queue. This report updates the earlier plan to match the current repository,
where many trust and Firefox-readiness items have already shipped.

## Executive Summary

ScriptVault is a mature, local-first Manifest V3 userscript manager for Chrome
and compatible Chromium browsers, with a Firefox desktop package path in AMO
validation, an Edge package builder, a broad Greasemonkey/Tampermonkey runtime
surface, Monaco editing on Chromium, a Firefox textarea fallback, sync and
backup systems, source/runtime drift gates, release-trust artifacts, and
store-review evidence. The project's strongest current shape is no longer raw
feature breadth; it is reviewer-friendly, privacy-forward script management
with unusually strong import, sync, provenance, and release guardrails. The
highest-value direction is to close the remaining correctness and supply-chain
gaps that can undermine that trust: coverage blind spots, toolchain drift,
settings schema drift, action/dependency freshness, manual store-publication
evidence, and the last userscript API parity gaps.

Top opportunities in priority order:

1. Add a coverage gate aligned to the TypeScript promotion map, including
   `src/background/**`.
2. Align Node/npm/toolchain enforcement across `package.json`, CI, contributors,
   and CWS tooling.
3. Add Dependabot or Renovate for npm and GitHub Actions updates with controlled
   grouping.
4. Pin workflow actions to full commit SHAs and add a static workflow lint.
5. Build a settings schema and accessible validation layer for dashboard
   settings.
6. Add an optional-dependency reach gate to justify the `--omit=optional` audit
   policy.
7. Finish `GM.*` namespace parity, including a guarded `GM.fetch` decision.
8. Prove `GM_addValueChangeListener` cross-tab `remote` semantics in a real
   browser.
9. Complete AMO unlisted/listed submission and record reviewer feedback.
10. Plan the next cross-browser step: Edge browser smoke, Firefox OAuth decision,
    and eventual WXT migration only after the manual targets stabilize.

## Evidence Reviewed

Local files and directories inspected:

- `AGENTS.md` and `CLAUDE.md` for repo rules, build commands, architecture,
  version state, Firefox port state, and gotchas.
- `README.md`, `ROADMAP.md`, `RESEARCH_REPORT.md`, `FIREFOX-PORT.md`,
  `CHANGELOG.md`, `COMPLETED.md`, `CONTRIBUTING.md`, `PRIVACY.md`, and
  `AMO-SOURCE-README.md`.
- `docs/amo-vendored-libraries.md`, `docs/cross-browser-pipeline.md`,
  `docs/cws-remote-code-compliance.md`, `docs/dependency-audit-policy.md`,
  `docs/edge-submission.md`, `docs/release-runbook.md`,
  `docs/readme-feature-claim-checklist.md`, `docs/store-listing-copy.md`,
  `docs/ts-authoritative-source-design.md`, and
  `docs/research-cycle-18-2026-06-04.md`.
- `manifest.json`, `manifest-firefox.json`,
  `manifest-firefox.transformations.json`, `package.json`,
  `package-lock.json`, `tsconfig.json`, `vitest.config.mjs`,
  `playwright.config.mjs`, `.github/workflows/ci.yml`, `.gitignore`, and
  `.gitattributes`.
- Source areas under `src/`, generated runtime modules under `modules/`,
  `bg/`, `shared/`, `background.core.js`, `background.js`, extension pages
  under `pages/`, packaging/check scripts under `scripts/`, and tests under
  `tests/`.

Git history reviewed:

- `rtk git log -10 --oneline --decorate` showed current `HEAD` on `main` at
  `2ad4acd docs: refresh research feature plan`, preceded by GM namespace
  parity research, host permission recovery, import quarantine, npm resolver,
  dependency/action/settings research, optional dependency research, and
  user-config work.
- `rtk git status --short --branch` showed `main...origin/main` clean before
  this document was rewritten.

Build, test, docs, and release artifacts inspected:

- `package.json` scripts for `check`, `test`, `test:cov`, `smoke:dashboard`,
  `smoke:firefox`, `firefox:package`, `build:edge:check`,
  `store-copy:check`, `readme:check`, `dashboard:modules:check`,
  `release:trust`, `release:store-status`, and related gates.
- `.github/workflows/ci.yml`: typecheck, tests, dashboard smoke, Playwright
  E2E, Chrome package, CWS remote-code package scan, Firefox package, Edge
  package, support matrix, release-trust gate, artifact attestations, and
  uploads.
- `vitest.config.mjs`: V8 coverage is enabled, but `all:false`, no thresholds,
  and no `src/background/**` include.
- `ts-source-promotion.json`: 27 promoted runtime entries, including
  `background.core.js` generated from `src/background/core.ts`.
- `tests/`: 117 test files present; a source grep found 1672 `describe`/`it`/
  `test` declarations. This is a static count, not a Vitest case count.
- `firefox-artifacts/`, `release-artifacts/`, and `edge-artifacts/` are local
  generated artifact directories and are intentionally not treated as source.

Commands run during this pass:

- `rtk git log -10 --oneline --decorate`
- `rtk git status --short --branch`
- `npm outdated --json`
- `npm audit --audit-level=high --omit=optional`
- `npm run ts-source:check`
- `npm run readme:check`
- `npm run dashboard:modules:check`
- `npm config get engine-strict`
- Static PowerShell/Node inspections of settings counts, optional dependency
  records, source/test file counts, workflow action references, and missing
  dependency update configuration.

External sources reviewed:

- Chrome `userScripts` API:
  https://developer.chrome.com/docs/extensions/reference/api/userScripts
- Chrome remote-hosted-code guidance:
  https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code
- MDN Firefox `userScripts` API:
  https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/userScripts
- Mozilla source-code submission:
  https://extensionworkshop.com/documentation/publish/source-code-submission/
- Mozilla third-party library usage:
  https://extensionworkshop.com/documentation/publish/third-party-library-usage/
- GitHub Actions security hardening:
  https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions
- GitHub Dependabot options:
  https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference
- npm `package.json` `engines` documentation:
  https://docs.npmjs.com/files/package.json/
- Vitest coverage documentation:
  https://main.vitest.dev/guide/coverage
- MDN constraint validation:
  https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Constraint_validation
- W3C WCAG 2.1 error identification:
  https://www.w3.org/WAI/WCAG21/Understanding/error-identification.html
- Tampermonkey documentation:
  https://www.tampermonkey.net/documentation.php
- Violentmonkey GM API documentation:
  https://violentmonkey.github.io/api/gm/
- ScriptCat changelog:
  https://docs.scriptcat.org/docs/change/
- ScriptCat product docs:
  https://docs.scriptcat.org/en/

Areas that could not be verified:

- Live Chrome Web Store developer dashboard state, uploaded draft state, store
  metadata, review warnings, and approval timing.
- AMO developer account existence, unlisted upload result, signature status,
  reviewer comments, and listed publication state.
- Microsoft Partner Center live listing state and Edge Add-ons REST update
  credentials.
- Real Firefox for Android behavior; the current package intentionally omits
  `gecko_android`.
- Dedicated Edge, Brave, Vivaldi, Opera, Arc, Orion, or Safari browser smoke.
- Full visual walkthrough of every dashboard theme and advanced tab in a live
  browser during this research pass.

## Current Product Map

Core workflows:

- Install scripts from `.user.js` URLs, direct code, files, ZIP/JSON imports,
  subscriptions, store/discovery surfaces, and public API paths.
- Review install metadata, risk analysis, signatures, provenance, dependency
  hashes, antifeatures, permission deltas, and trust receipts.
- Register and execute userscripts through `chrome.userScripts` with wrapper
  GM/Tampermonkey compatibility in the `USER_SCRIPT` world and feature-gated
  per-script world IDs on supported Chrome.
- Edit scripts in the dashboard with Monaco on Chromium and textarea fallback
  in Firefox AMO packages.
- Manage scripts through dashboard, popup, side panel, DevTools panel, omnibox
  keyword, settings, workspaces, folders, collections, templates, snippets,
  filters, schedules, trash, backups, sync, and health/report views.
- Sync scripts through provider modules and encrypted v2 sync envelopes when
  enabled; Firefox v1 validation is WebDAV-only.
- Export/import/restore vault data with bounded archive intake, credential
  redaction/gating, restore receipts, rollback, and import quarantine.
- Build and package Chrome, Firefox, and Edge artifacts with store-copy,
  remote-code, support-matrix, source-provenance, rollback, and release-trust
  evidence.

Existing features:

- GM API surface with storage, network, UI, tabs, cookies, downloads, resources,
  notifications, menu commands, web request/DNR, script config, userstyles, and
  signing support.
- Static analyzer using Acorn, source/provenance checks for dependencies, SRI,
  Sigstore bundle parser/verifier modules, and trust receipt diffs.
- Cloud sync providers and EasyCloud/Gist adjacent flows, with sync-safe
  setting partitioning and optional encryption now present.
- Backup scheduler with bounded JSON/ZIP import, credential metadata, receipts,
  verify/inspect/rollback, and dashboard restore UI.
- Cross-browser packaging: Chrome primary, Firefox desktop validation package,
  Edge package/report, derivative-browser watchlist.
- Release evidence: CWS remote-code compliance scan, AMO vendored-library
  provenance, SBOM/provenance/checksum output, optional strict maintainer
  signature, GitHub artifact attestations on `main`.

User personas:

- Power users with many scripts who need search, grouping, safe bulk actions,
  reliable backups, and fast dashboard rendering.
- Script authors who need editor tooling, `@require` handling, metadata
  validation, live config variables, provenance, and debugging.
- Privacy-sensitive users who want local-first storage and explicit control of
  sync credentials, cloud endpoints, and imported code activation.
- Cross-browser users who want Chrome/Firefox/Edge parity without losing data.
- Store reviewers and maintainers who need reproducible source, package,
  permission, data collection, and release evidence.

Platforms and distribution channels:

- Chrome/Chromium: Tier 1 published target, `manifest.json`, Chrome 130+,
  Chrome 138+ userScripts toggle onboarding.
- Firefox desktop: AMO validation target, `manifest-firefox.json`, Firefox 140+
  desktop, optional `userScripts`, WebDAV-only sync validation, no Monaco in AMO
  package.
- Microsoft Edge: generated Chromium package/report, Partner Center publication
  manual, no dedicated Edge browser smoke in CI.
- Firefox for Android: deferred, no `gecko_android` claim.
- Brave/Vivaldi/Opera/Arc: Chromium derivative watchlist, no release smoke.
- Orion/Safari: not current targets.

Important integrations, permissions, storage, and data flows:

- `chrome.userScripts`, `chrome.scripting`, `chrome.declarativeNetRequest`,
  `chrome.cookies`, `chrome.downloads`, `chrome.notifications`,
  `chrome.contextMenus`/Firefox `menus`, `chrome.alarms`, `chrome.storage`,
  `chrome.offscreen`, `chrome.sidePanel`, `chrome.webNavigation`, and optional
  clipboard/identity/cookie flows.
- `IndexedDB` is the script/value/storage backbone; `chrome.storage.local`
  carries settings and some runtime state.
- Sync providers carry script envelopes, tombstones, settings subsets,
  optional encrypted payloads, and provider credentials.
- Import/export and backup flows cross the highest trust boundary: archive
  bytes into executable script bodies and settings.

## Feature Inventory

| Name | User value | Entry point | Main code locations | Maturity | Tests/docs coverage | Improvement opportunities |
| --- | --- | --- | --- | --- | --- | --- |
| Script install and update review | Install scripts without silently trusting source changes | `.user.js` interception, dashboard import, update checks | `src/background/install-handler.ts`, `src/background/import-export.ts`, `src/background/update-checker.ts`, `pages/install.js`, `pages/dashboard.js` | Complete and actively hardened | `runtime-import-export`, `install-source`, `pending-update-queue`, trust receipt tests, README | Keep pending-update review and quarantine semantics visible in help and release notes |
| Script execution engine | Runs user-provided code in browser pages with GM APIs | `chrome.userScripts.register`, popup/dashboard toggles | `src/background/registration.ts`, `src/background/wrapper-builder.ts`, `content.js`, `src/background/core.ts` | Mature | wrapper, registration, content bridge, host-scope tests | Finish `GM.*` namespace parity and `GM.fetch` decision |
| GM storage and cross-tab values | Per-script persistent values and listener callbacks | Userscript `GM_getValue`, `GM_setValue`, listener APIs | `src/modules/storage.ts`, `src/background/wrapper-builder.ts`, generated `modules/storage.js` | Mostly complete | storage and wrapper tests | Browser-level two-tab remote-flag proof |
| GM network/download/cookie/DNR scope | Cross-origin user requests with per-script policy | `GM_xmlhttpRequest`, `GM_download`, `GM_cookie`, `GM_webRequest` | `src/background/core.ts`, `src/modules/xhr.ts`, `src/background/internal-host-guard.ts`, DNR code | Strong after 2026-06 hardening | content bridge security, internal-host, parser-webrequest tests | Add `GM.fetch` only by reusing this policy |
| Editor | Full script editing and metadata workflow | Dashboard editor tab | `pages/dashboard.js`, `pages/editor-sandbox.html`, `pages/monaco-adapter.js`, `lib/monaco/` | Mature on Chromium, degraded on Firefox AMO | Monaco fallback, search history, editor tests | Decide later whether Firefox gets pruned Monaco or keeps textarea |
| Dashboard management | Central control surface for scripts, settings, sync, backup, trust | `pages/dashboard.html` | `pages/dashboard.js`, `pages/dashboard-*.js`, lazy loader | Large and functional | dashboard module reachability gate passes for 28 modules | Settings schema validation and live visual audits remain highest value |
| Popup and side panel | Fast current-page control | extension action popup, side panel | `pages/popup.*`, `pages/sidepanel.*` | Mature | popup a11y, host permission recovery tests | Continue keeping Firefox unsupported surfaces hidden |
| DevTools panel | Inspect script network/execution behavior | DevTools page | `pages/devtools*`, `bg/netlog`, wrapper proxies | Useful | netlog and devtools-adjacent tests | Add source-map/error-stack improvements later |
| Cloud sync | Multi-device script portability | Settings sync panel, background sync | `src/background/cloud-sync.ts`, `src/modules/sync-providers.ts`, `src/modules/sync-easycloud.ts`, `src/modules/sync-crypto.ts` | Strong but complex | source cloud sync, sync crypto, sync providers tests | Firefox OAuth decision, presigned S3 flow, conflict UX refinements |
| Backups and restore | Recover from data loss with reviewable archives | Utilities/backup dashboard | `src/modules/backup-scheduler.ts`, `src/background/import-export.ts`, `pages/dashboard.js` | Strong after archive bounds, redaction, quarantine | backup scheduler, receipts, import snapshot tests | More visible restore review workflow and storage-persistence warning |
| Import quarantine | Prevent restored executable scripts from running before review | Import/restore flows | `src/background/import-export.ts`, `src/modules/backup-scheduler.ts`, `src/types/script.ts`, dashboard restore copy | Complete | import/backup tests and Cycle 18 research | Add dashboard filtering for quarantined scripts if not already prominent |
| Script author configuration | User-facing runtime options from `@var` | per-script Settings tab | `src/modules/script-config.ts`, `pages/dashboard.js`, wrapper | Complete | script-config and wrapper-script-config tests | Improve docs/examples for authors |
| Antifeature metadata | Trust signal for ads, tracking, miners, etc. | install card, dashboard rows | parser, install page, dashboard row rendering | Complete | script-antifeature/parser tests | Add filtering/sorting by antifeature later |
| Static analysis and provenance | Detect risky patterns and dependency integrity changes | install/update review | `src/bg/analyzer.ts`, `src/background/trust-receipt.ts`, Sigstore modules | Strong | analyzer, provenance, Sigstore, trust receipt tests | Add annual security disclosure/report surfaces later |
| Firefox package | AMO-ready desktop package and smoke | `npm run firefox:package`, `npm run smoke:firefox` | `manifest-firefox.json`, `build-firefox.sh`, Firefox compat files | Validation-ready, not published | Firefox package/smoke docs, package tests | AMO account/upload/review loop |
| Edge package | Edge Add-ons artifact and evidence report | `npm run build:edge:check` | `scripts/build-edge.mjs`, Edge docs, manifest transform | Package-ready, no live listing | edge-build tests, support matrix | Dedicated Edge browser smoke and Partner Center publication |
| Release trust | Verify artifact/source/SBOM/provenance/signing evidence | CI and release runbook | `scripts/release-trust-gate.mjs`, CI, release docs | Strong | release-trust/runbook/store-status checks | Pin actions, automate dependency freshness, durable signing key custody |
| Settings | User control of behavior, sync, editor, security, backup | Dashboard Settings tab | `pages/dashboard.html`, `pages/dashboard.js`, `src/config/settings-defaults.json`, `src/types/settings.ts` | Functional but not schema-driven | dashboard/a11y tests | Schema parity, validation, accessible errors |

## Competitive and Ecosystem Research

| Product/source | Notable capabilities | What ScriptVault should learn | What ScriptVault should avoid |
| --- | --- | --- | --- |
| Tampermonkey documentation, https://www.tampermonkey.net/documentation.php | Large API surface, `GM.xmlHttpRequest` promise form, `@connect`, `GM_cookie`, `GM_audio`, listener `remote` argument, mature user expectations | Treat API parity as a compatibility contract; document callback vs promise forms and grant requirements | Do not copy broad network power without ScriptVault's host-scope and internal-host guards |
| Violentmonkey GM API, https://violentmonkey.github.io/api/gm/ | Greasemonkey v4-style `GM.*` aliases and documented `GM_addValueChangeListener(..., remote)` cross-tab semantics | Generate/test namespace parity so shipped callback APIs do not drift from promise aliases | Do not rely on manual alias lists without a drift test |
| ScriptCat docs/changelog, https://docs.scriptcat.org/en/ and https://docs.scriptcat.org/docs/change/ | Background scripts, WebDAV/S3 storage, script runtime options, active MV3 work, device-local sync fixes | `@background` and runtime options are real differentiators, but they need explicit security boundaries | Do not add background execution without DOM-less API restrictions and scheduling/resource controls |
| Greasemonkey, https://www.greasespot.net/ | Original userscript manager model and install-dialog expectation | Keep install review simple and explicit; do not let advanced provenance UI hide the basic "what will run where" question | Do not chase legacy API quirks where current TM/VM compatibility has moved on |
| Chrome `userScripts` API | Official path for user-provided arbitrary code in MV3; requires permission plus host permissions and user toggle | Store-review evidence should show ScriptVault confines user-provided code to the userScripts model | Do not execute fetched code through extension pages or workers outside approved user-script paths |
| Firefox `userScripts` API | Optional-only `userScripts` permission and different enablement model | Keep Firefox first-run permission onboarding and hidden unsupported UI paths | Do not claim parity for APIs that are deferred in Firefox package evidence |
| Mozilla AMO source-review docs | Reviewers need readable source/build steps and third-party library links/checksums | The current vendored-library provenance gate is the right model; extend it when more libraries enter Firefox package | Do not ship minified or generated files without a reviewer-rebuild path |
| GitHub Actions secure-use docs | Full-length commit SHA is the immutable action pin | Pin action refs and automate refreshes | Do not rely on mutable major tags in the attestation/release job |
| Dependabot docs | Supports separate npm and `github-actions` ecosystems with grouped version updates | Use scheduled grouped update PRs to reduce drift and noise | Do not let major Monaco/Puppeteer/esbuild jumps merge in broad low-review batches |

## Highest-Value New Features

### 1. Coverage Gate Aligned To Promoted Sources

- Title: Coverage gate aligned to TypeScript-authoritative sources.
- User problem solved: prevents critical source paths from silently losing test
  coverage while CI still reports green.
- Evidence: `vitest.config.mjs` has `coverage.all: false`, no thresholds, and
  includes `src/shared`, `src/modules`, and `src/bg`, but not
  `src/background`; `ts-source-promotion.json` marks `background.core.js` as
  generated from `src/background/core.ts`; ROADMAP Cycle 13 documents a coverage
  smoke that reported 0% for exercised `src/background/wrapper-builder.ts`.
- Proposed behavior: `npm run test:cov` should include every authoritative
  TypeScript source that can generate shipped runtime behavior, enforce an
  initial measured floor, and fail if promoted `src/background/**` files are
  absent from `coverage-summary.json`.
- Implementation areas: `vitest.config.mjs`, `package.json`, CI, coverage docs,
  and a coverage-summary guard test or script.
- Data model/API/UI implications: none.
- Risks and edge cases: generated raw bridge code can depress coverage; set a
  measured realistic floor and exclude pure types/config intentionally.
- Verification plan: run `npm run test:cov`; inspect `coverage-summary.json`
  for `src/background/core.ts` and `src/background/wrapper-builder.ts`; add a
  fixture that fails when a promoted source glob is missing.
- Estimated complexity: M.
- Priority: P1.

### 2. Toolchain Contract Enforcement

- Title: Enforce the Node/npm toolchain contract.
- User problem solved: avoids CI, contributor, and release machines silently
  running different Node versions than the repo requires.
- Evidence: `package.json` declares `engines.node >=21.2.0`, CI uses
  `actions/setup-node` with `node-version: 20`, there is no `.nvmrc`,
  `.node-version`, `.npmrc`, or `packageManager`, and `npm config get
  engine-strict` returned `false`. npm documents `engines` as advisory unless
  `engine-strict` is set.
- Proposed behavior: CI and local setup should consume the same version file or
  explicit semver; npm/package-manager metadata should be pinned; CWS tooling
  checks should compare against the repo floor.
- Implementation areas: `package.json`, `.node-version` or `.nvmrc`, `.npmrc`
  or preflight script, `.github/workflows/ci.yml`,
  `scripts/check-cws-publish-tooling.mjs`, `CONTRIBUTING.md`, and
  `docs/release-runbook.md`.
- Data model/API/UI implications: none.
- Risks and edge cases: GitHub-hosted runner availability for very new Node
  versions; use a supported current Node that satisfies the floor.
- Verification plan: CI run; local `node -v`; `npm run cws:check`; mocked
  too-old Node preflight failure.
- Estimated complexity: S.
- Priority: P1.

### 3. Dependency Freshness Automation

- Title: Add Dependabot or Renovate for npm and GitHub Actions.
- User problem solved: catches dependency and action drift before advisories or
  store-review blockers accumulate.
- Evidence: `npm outdated --json` currently lists nine stale direct
  devDependencies; `.github/` contains only `workflows/ci.yml`; no
  `.github/dependabot.yml` or `renovate.json` exists.
- Proposed behavior: schedule grouped patch/minor npm tooling PRs, separate
  major updates for high-risk tooling, and include `github-actions` updates so
  action SHA pins remain refreshable.
- Implementation areas: `.github/dependabot.yml` or `renovate.json`,
  dependency policy docs, CI labels/review process.
- Data model/API/UI implications: none.
- Risks and edge cases: update noise; group patch/minor updates and isolate
  major toolchain moves.
- Verification plan: config validation; Dependabot tab shows npm and
  GitHub Actions ecosystems; first scheduled or manual run opens expected PRs.
- Estimated complexity: S.
- Priority: P1.

### 4. Workflow Action SHA Pinning

- Title: Pin GitHub Actions to full commit SHAs.
- User problem solved: reduces release-pipeline supply-chain exposure in the
  job that builds, attests, and uploads artifacts.
- Evidence: `.github/workflows/ci.yml` uses tag references for checkout,
  setup-node, setup-chrome, attest, and upload-artifact; the same job has
  `id-token: write` and `attestations: write`. GitHub's secure-use reference
  recommends full-length commit SHA pinning for immutability.
- Proposed behavior: every external `uses:` reference points at a full
  40-character SHA with a nearby version comment, and a static check rejects
  tag/branch/short-SHA refs.
- Implementation areas: `.github/workflows/ci.yml`, new workflow lint script or
  test, dependency updater config for action pin refresh.
- Data model/API/UI implications: none.
- Risks and edge cases: pin refresh maintenance; solve through Dependabot or
  Renovate.
- Verification plan: grep/lint fails on `@v*`; CI passes; action update bot can
  propose refreshed SHAs.
- Estimated complexity: S.
- Priority: P1.

### 5. Settings Schema And Validation Layer

- Title: Schema-driven settings defaults, classification, and validation.
- User problem solved: prevents silent invalid settings, hidden drift, and
  inconsistent advanced/security controls.
- Evidence: `src/config/settings-defaults.json` has 71 keys; dashboard has 91
  `settings*` controls; ROADMAP Cycle 17 found 51 saveable keys missing from
  defaults/types and 42 default keys with no UI save path; dashboard raw inputs
  save on blur without a shared validation layer. MDN constraint validation and
  WCAG 2.1 SC 3.3.1 both support field-specific text errors.
- Proposed behavior: classify each setting as visible, internal, credential,
  timestamp, derived, or deprecated; drive UI defaults and constraints from the
  schema; block invalid values with accessible text errors.
- Implementation areas: `src/config/settings-defaults.json`,
  `src/types/settings.ts`, `src/modules/storage.ts`, `pages/dashboard.html`,
  `pages/dashboard.js`, settings tests, a schema report doc.
- Data model/API/UI implications: schema metadata for type, range/options,
  redaction class, sync/export class, and visible help text.
- Risks and edge cases: legacy unknown settings; preserve them through a
  migration/allowlist path rather than deleting user data.
- Verification plan: schema parity tests; malformed badge color, lint size,
  WebDAV/S3 URL, denied-host, and JSON config fixtures; `npm run test:a11y`;
  manual Settings walk-through.
- Estimated complexity: L.
- Priority: P1.

### 6. Optional Dependency Reach Gate

- Title: Prove omitted optional dependencies do not ship.
- User problem solved: keeps the high-severity audit exemption defensible.
- Evidence: CI runs `npm audit --audit-level=high --omit=optional`;
  `package-lock.json` contains 60 optional package records and 43 peer-optional
  edges; no static enforcement currently proves shipped source does not import
  them.
- Proposed behavior: scan lockfile optional/peer-optional package specifiers
  against shipped source, generated runtime inputs, and package staging inputs;
  fail if any optional package enters shipped behavior without policy update.
- Implementation areas: new `scripts/check-optional-dep-reach.mjs`, CI,
  `docs/dependency-audit-policy.md`, tests/fixtures.
- Data model/API/UI implications: none.
- Risks and edge cases: false positives on words such as `canvas`; scan import,
  dynamic import, and require specifiers rather than arbitrary text.
- Verification plan: run gate; add a fixture import of an optional package and
  confirm failure; keep `npm audit --audit-level=high --omit=optional` green.
- Estimated complexity: M.
- Priority: P2.

### 7. GM Namespace Parity And Guarded GM.fetch

- Title: Complete generated/tested `GM.*` namespace parity.
- User problem solved: improves compatibility for scripts written for
  Tampermonkey, Violentmonkey, and Greasemonkey v4-style APIs.
- Evidence: `src/background/wrapper-builder.ts` defines many `window.GM_*`
  exports but fewer `GM.*` aliases; missing aliases include `GM.addElement`,
  `GM.audio`, `GM.cookie`, `GM.focusTab`, `GM.getMenuCommands`, `GM.head`,
  `GM.log`, and `GM.webRequest`; no `GM.fetch`/`GM_fetch` path exists. TM and VM
  document promise-style namespace APIs and remote listener semantics.
- Proposed behavior: derive aliases from an explicit compatibility table, fail
  on drift, add singular/plural cookie compatibility intentionally, and add
  `GM.fetch` only if it reuses the existing `GM_xmlhttpRequest` host-scope,
  `@connect`, abort, redirect, and internal-host policy.
- Implementation areas: `src/background/wrapper-builder.ts`, generated
  `background.core.js`, `src/types/messages.ts`, GM type declarations,
  optional-permission grant mapping, README/API docs, network-policy tests.
- Data model/API/UI implications: GM type definitions and docs change.
- Risks and edge cases: fetch-like streaming semantics are hard in a service
  worker; document any non-streaming limitations.
- Verification plan: alias parity tests; grant mapping tests; denied
  `@connect`, internal-host, and redirect-to-internal-host tests for any fetch
  alias; `npm run gm-types:check`; `npm run readme:check`.
- Estimated complexity: M.
- Priority: P2.

### 8. DOM-less `@background` Scripts

- Title: True scheduled/background userscripts.
- User problem solved: lets users run maintenance or automation scripts without
  an already-open matching tab.
- Evidence: `ROADMAP.md` open P2 row; ScriptCat advertises background script
  runtime; current `@crontab` behavior is tied to page/runtime availability.
- Proposed behavior: default-off `experimentalBackgroundScripts`, parser support
  for `@background`, a DOM-less wrapper variant, restricted GM API bridge, and
  explicit resource/time controls.
- Implementation areas: parser, wrapper builder, background scheduler,
  offscreen/background runner, dashboard warnings, tests.
- Data model/API/UI implications: script metadata, settings, scheduling UI, and
  trust receipts need a background capability field.
- Risks and edge cases: extension review scrutiny, resource abuse, APIs that
  require DOM/window, cross-browser differences.
- Verification plan: scheduler tests, DOM-less wrapper tests, disabled-by-default
  setting, permission/trust copy, Chrome and Firefox smoke.
- Estimated complexity: XL.
- Priority: P2.

### 9. Store Publication Evidence Loop

- Title: Complete AMO and Edge publication evidence after packages are ready.
- User problem solved: turns package readiness into actual installable channels
  with recorded review feedback.
- Evidence: `FIREFOX-PORT.md` Phase 5 still has AMO developer account, unlisted
  upload, review loop, and listed publication open; Edge docs state Partner
  Center upload remains manual; README says Edge has no separate browser smoke.
- Proposed behavior: upload Firefox unlisted first with source ZIP, smoke the
  signed XPI, record reviewer feedback, then list; upload Edge package with
  generated report and add a dedicated Edge browser smoke before promoting
  support beyond package compatibility.
- Implementation areas: `FIREFOX-PORT.md`, `docs/release-runbook.md`,
  `docs/edge-submission.md`, support matrix, release notes, smoke scripts.
- Data model/API/UI implications: none.
- Risks and edge cases: requires account credentials and reviewer interaction.
- Verification plan: AMO dashboard proof, signed XPI smoke, public listing link,
  Edge Partner Center proof, Edge sideload smoke.
- Estimated complexity: M, with external dependency.
- Priority: P2.

## Existing Feature Improvements

### Settings Validation

- Current behavior: settings are functional and searchable, but persistence is
  split across direct handlers, listener maps, defaults, and types.
- Problem or missed opportunity: invalid security-sensitive values can be saved
  without a shared constraint path, and schema drift is already measurable.
- Recommended change: implement the schema/validation layer described above.
- Code locations likely affected: `src/config/settings-defaults.json`,
  `src/types/settings.ts`, `src/modules/storage.ts`, `pages/dashboard.html`,
  `pages/dashboard.js`.
- Backward compatibility concerns: preserve unknown legacy keys unless
  classified as deprecated and migrated.
- Verification plan: schema parity and field-validation tests.
- Estimated complexity: L.
- Priority: P1.

### Coverage Configuration

- Current behavior: tests are broad, but coverage is not a release gate and
  omits key promoted source directories.
- Problem or missed opportunity: a heavily tested codebase can still miss
  source/runtime regressions in `src/background/**`.
- Recommended change: include promoted source globs and enforce a floor.
- Code locations likely affected: `vitest.config.mjs`, CI, package scripts.
- Backward compatibility concerns: none.
- Verification plan: `npm run test:cov`, coverage-summary presence tests.
- Estimated complexity: M.
- Priority: P1.

### Workflow Supply Chain

- Current behavior: release CI has attestations and release-trust gates, but
  action refs are tag-pinned.
- Problem or missed opportunity: mutable tags remain in the same job that has
  OIDC/attestation permissions.
- Recommended change: full-SHA pin actions and automate updates.
- Code locations likely affected: `.github/workflows/ci.yml`,
  `.github/dependabot.yml` or `renovate.json`, workflow lint script.
- Backward compatibility concerns: none.
- Verification plan: CI and workflow lint.
- Estimated complexity: S.
- Priority: P1.

### Dependency Audit Policy

- Current behavior: high-severity audit gate passes with `--omit=optional`.
- Problem or missed opportunity: optional dependency exclusion is plausible but
  not enforced against package/source reachability.
- Recommended change: add optional dependency reach gate.
- Code locations likely affected: `package-lock.json` reader script, CI,
  dependency policy docs.
- Backward compatibility concerns: tool-only optional packages remain allowed.
- Verification plan: positive and negative fixture tests.
- Estimated complexity: M.
- Priority: P2.

### GM API Compatibility

- Current behavior: ScriptVault has broad GM API support and generated GM types,
  but namespace aliases lag callback exports.
- Problem or missed opportunity: scripts using VM/TM `GM.*` aliases may fail
  even when the underlying callback API exists.
- Recommended change: generated alias map plus `GM.fetch` decision.
- Code locations likely affected: wrapper builder, generated core, GM types,
  docs, tests.
- Backward compatibility concerns: do not break existing callback forms.
- Verification plan: alias map tests and runtime network policy tests.
- Estimated complexity: M.
- Priority: P2.

### Cross-browser Release Claims

- Current behavior: Chrome is published, Firefox desktop package is validation
  ready, Edge package exists, Android is deferred, derivatives are watchlist.
- Problem or missed opportunity: package readiness and actual store/live-browser
  support are different states.
- Recommended change: keep support matrix evidence-driven and add live smoke
  only when support level increases.
- Code locations likely affected: support matrix generator, docs, smoke scripts.
- Backward compatibility concerns: none.
- Verification plan: AMO/Edge/derivative browser evidence before changing
  support labels.
- Estimated complexity: M.
- Priority: P2.

## Reliability, Security, Privacy, and Data Safety

- Verified: import/restore quarantine exists in source and generated backup
  flows; earlier research text that listed this as open is stale.
- Verified: archive intake bounds, credential redaction/gating, sync-safe
  settings partition, optional sync encryption, internal-host sync endpoint
  guards, and per-script host-scope controls have current source/test evidence.
- Verified: release trust produces checksums, source ZIP, SBOM, provenance, and
  optional maintainer signature material; CI adds GitHub artifact attestations.
- Verified risk: workflow actions remain tag-pinned in a privileged release job.
- Verified risk: coverage reporting can omit promoted runtime sources.
- Verified risk: optional dependency audit omission lacks a reachability gate.
- Verified risk: no dependency freshness automation exists despite stale direct
  devDependencies.
- Needs live validation: CWS/AMO/Edge store dashboards and review state.
- Needs live validation: Firefox for Android and derivative-browser behavior.
- Recommended guardrails: action SHA pinning, dependency updater, optional dep
  reach scan, coverage gate, store-status live checks on release machines, and
  durable release signing key custody outside the repo.

## UX, Accessibility, and Trust

- Onboarding: Chrome userScripts toggle onboarding and Firefox optional
  permission onboarding are documented and tested; store listing/account steps
  remain manual.
- Empty/loading/error/disabled states: dashboard module reachability now has a
  gate, and help controls are present across main surfaces; settings validation
  needs field-level text errors.
- Destructive actions: trash, restore receipts, rollback, backup verification,
  import quarantine, and credential restore confirmations are strong.
- Settings clarity: the Settings tab is extensive and searchable, but not yet
  schema-driven; this is the largest UX/trust improvement.
- Accessibility: existing a11y/readability gates are useful; settings invalid
  input handling should follow text-error expectations from WCAG 2.1 SC 3.3.1.
- Microcopy and trust signals: keep source/provenance, antifeature, quarantine,
  credential, and host-scope language plain and consistent in dashboard help,
  install cards, and release/store copy.

## Architecture and Maintainability

- Module boundaries: source/runtime promotion has advanced substantially; 27
  runtime entries are promoted with no mirrored or divergent entries.
- Refactor candidates: settings schema, GM alias generation, coverage map,
  optional dependency reach scanner, and eventual WXT migration.
- Test gaps: coverage thresholds, `src/background/**` visibility, two-tab
  `GM_addValueChangeListener` remote behavior, Edge browser smoke, Firefox
  Android smoke, and live store state.
- Documentation gaps: README already documents many support states, but in-app
  help should continue to match omnibox/commands and advanced settings.
- Release/build gaps: CI Node mismatch, mutable action refs, dependency update
  automation, manual AMO/Edge publication, and signing key custody.

## Prioritized Roadmap

- [x] P1 - Add source-aligned coverage gate
  - Why: promoted runtime sources can be invisible to current coverage.
  - Evidence: `vitest.config.mjs`, `ts-source-promotion.json`, ROADMAP Cycle 13.
  - Touches: `vitest.config.mjs`, `package.json`, `.github/workflows/ci.yml`,
    coverage guard script/tests.
  - Acceptance: coverage includes promoted `src/background/**`, enforces a
    measured floor, and fails when promoted source files are absent.
  - Verify: `npm run test:cov`; inspect `coverage/coverage-summary.json`.
  - Closed 2026-06-05: coverage now includes authoritative runtime TypeScript
    roots, CI runs `npm run test:cov`, and `scripts/check-coverage-sources.mjs`
    verifies promoted/source-root presence in `coverage-summary.json`.

- [ ] P1 - Align Node/npm/toolchain contract
  - Why: package floor is Node >=21.2.0 while CI uses Node 20 and npm engines
    are advisory locally.
  - Evidence: `package.json`, `.github/workflows/ci.yml`, missing version files,
    `npm config get engine-strict=false`.
  - Touches: `package.json`, `.node-version` or `.nvmrc`, `.npmrc` or preflight,
    CI, CWS tooling check, docs.
  - Acceptance: CI and contributors use the same supported Node/npm contract and
    fail fast below the floor.
  - Verify: `npm run cws:check`; CI setup-node uses version file or matching
    semver.

- [x] P1 - Add dependency freshness automation
  - Why: direct devDependencies are stale and no updater watches npm or actions.
  - Evidence: `npm outdated --json`, missing `.github/dependabot.yml` and
    `renovate.json`.
  - Touches: `.github/dependabot.yml` or `renovate.json`,
    `docs/dependency-audit-policy.md`.
  - Acceptance: scheduled npm and GitHub Actions update PRs open with grouped
    patch/minor tooling updates and isolated major changes.
  - Verify: Dependabot/Renovate config validation and first scheduled/manual
    update run.
  - Closed 2026-06-05: `.github/dependabot.yml` now watches npm and GitHub
    Actions weekly, groups minor/patch tooling updates, leaves majors as
    separate PRs, and is pinned by `tests/dependabot-config.test.js`.

- [ ] P1 - Pin release workflow actions to full SHAs
  - Why: current release job uses mutable action tags while granting
    attestation/OIDC permissions.
  - Evidence: `.github/workflows/ci.yml`; GitHub Actions secure-use reference.
  - Touches: workflow YAML, workflow lint script/test, updater config.
  - Acceptance: every `uses:` ref is a full 40-character SHA with version
    comment and update path.
  - Verify: workflow lint rejects `@v*`, branches, and short SHAs; CI passes.

- [ ] P1 - Add settings schema parity and accessible validation
  - Why: settings defaults, types, controls, and save handlers drift.
  - Evidence: `settings-defaults.json` count, dashboard control/save-handler
    scan, ROADMAP Cycle 17.
  - Touches: settings defaults/types/storage, dashboard HTML/JS, tests, docs.
  - Acceptance: every persisted setting is classified; visible controls get
    schema-backed type/default/validation/help; invalid fields show text errors
    and do not persist.
  - Verify: schema parity tests, malformed-input tests, `npm run test:a11y`.

- [ ] P2 - Add optional dependency reach gate
  - Why: `--omit=optional` audit policy is not enforced against shipped code.
  - Evidence: 60 optional package records and 43 peer-optional edges in lockfile.
  - Touches: new scanner, CI, dependency policy docs.
  - Acceptance: static imports/requires of optional packages in shipped inputs
    fail unless explicitly classified.
  - Verify: scanner pass today; fixture optional import fails.

- [ ] P2 - Complete GM namespace parity and GM.fetch decision
  - Why: callback APIs outnumber `GM.*` aliases and compatibility drift is
    likely for TM/VM scripts.
  - Evidence: `src/background/wrapper-builder.ts` alias/export map; TM/VM docs.
  - Touches: wrapper builder, generated core, GM types, optional permissions,
    docs, network tests.
  - Acceptance: alias parity is generated or table-driven; `GM.cookie` and
    `GM.cookies` are intentional; `GM.fetch` reuses existing guarded network
    policy or is explicitly deferred with docs.
  - Verify: alias/type tests, grant tests, network-policy tests,
    `npm run gm-types:check`, `npm run readme:check`.

- [ ] P2 - Prove GM value-change cross-tab remote semantics
  - Why: source broadcasts value changes, but real two-tab behavior needs live
    validation.
  - Evidence: `src/modules/storage.ts` `notifyChange`, wrapper listener code,
    ROADMAP P2 row.
  - Touches: storage, wrapper, browser smoke/e2e.
  - Acceptance: listener in tab B fires when tab A writes and receives
    `remote=true`; origin tab receives `remote=false`.
  - Verify: Playwright/extension two-tab smoke.

- [ ] P2 - Complete AMO unlisted to listed publication loop
  - Why: Firefox package evidence is ready but publication is not live.
  - Evidence: `FIREFOX-PORT.md` Phase 5 open rows; AMO source README.
  - Touches: AMO upload process, Firefox port log, release runbook, support
    matrix.
  - Acceptance: unlisted upload signed and smoked; reviewer feedback recorded;
    listed publication completed when approved.
  - Verify: AMO dashboard, signed XPI install smoke, public listing link.

- [ ] P2 - Add dedicated Edge browser smoke before elevating support
  - Why: Edge artifact exists but no Edge runtime smoke is wired in CI.
  - Evidence: README/support matrix and `scripts/build-edge.mjs` summary text.
  - Touches: smoke script, CI or release-machine checklist, support matrix.
  - Acceptance: staged Edge package loads in Edge and runs dashboard plus smoke
    userscript flow.
  - Verify: Edge smoke output and support matrix update.

- [ ] P2 - Design true DOM-less `@background` scripts
  - Why: scheduled/background automation remains a competitive gap.
  - Evidence: open ROADMAP P2 row and ScriptCat background-script positioning.
  - Touches: parser, wrapper, scheduler, dashboard, tests, trust copy.
  - Acceptance: default-off background script mode with restricted APIs,
    resource controls, clear UI, and cross-browser behavior defined.
  - Verify: unit tests plus Chrome/Firefox smoke with a fixture background
    script.

## Quick Wins

- Add `.node-version` or `.nvmrc` and update CI to consume it.
- Add `packageManager` and npm/dev-engine metadata to `package.json`.
- Add `.npmrc` `engine-strict=true` or an explicit preflight if strict mode is
  too disruptive.
- Add `.github/dependabot.yml` for npm and GitHub Actions ecosystems.
- Add a static workflow-reference check that fails on tag/branch/short-SHA
  action refs.
- Add an optional dependency reach scanner in report-only mode, then promote it
  to CI.
- Add a coverage-summary guard that fails if `src/background/wrapper-builder.ts`
  is absent.
- Add in-app Help entries for `sv` omnibox and browser command rebinds if not
  already visible in the dashboard Help tab.
- Add a simple schema report listing visible/internal/credential settings before
  refactoring the Settings tab.

## Larger Bets

- Schema-driven Settings architecture with validation, redaction, sync/export
  classification, and accessible errors.
- `GM.*` compatibility generation plus a guarded fetch-shaped API.
- DOM-less background userscripts with resource budgets and cross-browser
  constraints.
- Cross-browser WXT migration after the current manual Chrome/Firefox/Edge
  targets and source-review gates stabilize.
- Edge/derivative browser smoke matrix that treats "package compatible" and
  "live browser verified" as separate support levels.
- Store publication automation after credential custody is solved; until then,
  keep CWS/AMO/Edge uploads manual and evidence-rich.

## Explicit Non-Goals

- Do not replace `ROADMAP.md` as the active queue with this report.
- Do not add telemetry to prove usage or adoption.
- Do not weaken import quarantine, credential redaction, archive bounds, or
  host-scope guards for convenience.
- Do not claim Firefox for Android support before a real Android smoke exists.
- Do not ship fetched code through extension contexts outside the approved
  userScripts path.
- Do not bundle additional minified libraries into Firefox without provenance
  inventory and reviewer rebuild instructions.
- Do not automate store publishing with long-lived credentials in GitHub
  Actions.

## Open Questions

1. Who owns the AMO developer account, unlisted upload, and reviewer response
   loop?
2. What exact Node version should be pinned for contributors and CI: the minimum
   `21.2.0`, the current local version, or a current LTS/current release that
   satisfies all package/tooling needs?
3. Should dependency automation be Dependabot for low maintenance or Renovate
   for stronger grouping/SHA-update control?
4. What initial coverage floor is acceptable after `src/background/**` enters
   the report?
5. Which settings keys are intentionally internal versus missing from the
   Settings UI?
6. Should `GM.fetch` be implemented now with documented limitations, or should
   the project first complete namespace parity for existing APIs only?
7. Should Firefox OAuth providers remain deferred for v1, or should identity
   permission and provider redirect URIs be solved before listed AMO
   publication?
8. What browser/device should be used for the first Edge and Firefox Android
   live smoke gates?
