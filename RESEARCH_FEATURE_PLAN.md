# Project Research and Feature Plan

Status: current companion research plan for ScriptVault v3.11.0.

Date: 2026-06-04.

Scope: research and planning only. This document does not replace
`ROADMAP.md`; it summarizes the current product surface, verified evidence, and
highest-value implementation work so future changes can be pulled from the
active roadmap with clearer context.

## Executive Summary

ScriptVault is now a mature Manifest V3 userscript manager with a large
feature surface: install and update flows, `chrome.userScripts` execution,
Greasemonkey/Tampermonkey-compatible APIs, dashboard management, Monaco editing
on Chromium, a Firefox package path with a textarea fallback, cloud sync,
scheduled backups, trust/provenance tooling, DevTools surfaces, release
attestation, and store-submission copy.

The strongest product direction is already visible in the repo: privacy-first,
local-first userscript management with reviewer-friendly release artifacts and
strong cross-browser validation. The highest-value next work is not another
large feature area. It is hardening the paths that can move data across trust
boundaries: sync endpoints, backup/export credentials, archive intake,
per-script settings sync, and per-script network scope. Those items protect the
product promise and reduce store-review risk.

Current top priorities:

1. Guard user-configured WebDAV/S3 sync endpoints with the same internal-host
   policy used for GM_xhr and script-resource fetches, while preserving an
   explicit opt-in for local/self-hosted endpoints.
2. Redact credential-bearing settings from manual exports and scheduled backups
   by default, then add a separate explicit credential-export path.
3. Replace raw ZIP/JSON backup intake with a bounded archive helper that
   enforces decompressed-size, entry-count, entry-size, and script-code caps.
4. Partition sync-safe script settings from device-local state before cloud
   upload and merge.
5. Add a real coverage gate for source/runtime code and automate dependency
   freshness so CI catches drift before advisories or store-review failures.
6. Finish AMO readiness gaps: source-review provenance for packaged minified
   libraries and a clear decision on Firefox for Android claims versus smoke
   coverage.
7. Clean up dashboard reachability and stale affordances so documented features
   match what a user can actually reach.

## Evidence Reviewed

Local repository evidence:

- `git status --short --branch` on `main...origin/main`: clean before this
  research document was added.
- `rtk git log -10 --oneline --decorate`: current HEAD before this pass was
  `793ac51 docs: add amo library provenance research`.
- `gh issue list --limit 20` and `gh pr list --limit 20`: no open issues or
  pull requests returned.
- `README.md`: v3.11.0 product overview, planning links, support matrix,
  omnibox documentation, keyboard shortcut table, Firefox package notes.
- `ROADMAP.md`: active SSOT for planned work, including P1/P2 research-driven
  additions for sync endpoint guards, credential export, archive intake,
  settings partitioning, coverage, dependency automation, action pinning,
  AMO provenance, and Firefox Android validation.
- `RESEARCH_REPORT.md`: current research map with 2026-06-04 cycles covering
  dependency, sync, backup, Firefox Android, and AMO library provenance.
- `FIREFOX-PORT.md`: Firefox 140+ desktop target, Firefox for Android 142+
  manifest validation target, Phase 5 AMO submission state, and manual AMO
  account blocker.
- `CHANGELOG.md` and `COMPLETED.md`: shipped Firefox smoke, AMO prep,
  high-severity audit fix, module-mode service worker, Monaco fallback, and
  release-trust work.
- `package.json`: Node engine `>=21.2.0`, version `3.11.0`, major gates such
  as `build`, `firefox:package`, `smoke:firefox`, `store-copy:check`,
  `support:matrix:check`, `release:trust`, and `check`.
- `manifest.json` and `manifest-firefox.json`: MV3 background shape, broad
  host permissions, `sv` omnibox keyword, commands, Firefox desktop and Android
  compatibility declarations.
- `vitest.config.mjs`: coverage uses V8, `all:false`, no threshold.
- `.github/workflows/ci.yml`: audit gate, Firefox package, support matrix,
  attestations, artifact upload, and floating action tags such as `@v4` and
  `@v1`.
- `src/modules/sync-providers.ts`: WebDAV and S3 providers build request URLs
  from user settings and call `fetch`/`fetchWithTimeout`; no
  `InternalHostGuard` use was found in that provider file.
- `src/background/core.ts`: existing `InternalHostGuard` use in update,
  dependency, provenance, GM_loadScript, GM_xhr, install, and resource-loader
  paths; cloud-sync and export/import paths serialize script/settings data.
- `src/modules/backup-scheduler.ts`: scheduled backup, restore, inspect, and
  import paths decode ZIP data and include global settings.
- `src/types/settings.ts`: sync credentials and provider secrets, including
  WebDAV, OAuth, and S3 fields.
- `src/types/script.ts`: open-ended per-script `settings` shape, including
  future/local keys that need sync classification.
- `build-firefox.sh`, `AMO-SOURCE-README.md`, and `lib/*.min.js`: Firefox
  package includes minified Acorn and Diff libraries; source-review docs do
  not yet provide an exact reviewer provenance inventory tying packaged bytes
  to official sources and hashes.
- `npm audit --audit-level=high --omit=optional`: high-level audit gate is
  currently clear.
- `npm ls tmp`: `web-ext@10.3.0` resolves `tmp@0.2.6`.
- `npm outdated --json`: dev dependency drift remains for Vitest coverage,
  Chrome types, Chrome Web Store upload CLI, esbuild, jsdom, Monaco,
  Puppeteer, TypeScript, and Vitest.

External sources reviewed:

- Chrome extension userScripts API:
  https://developer.chrome.com/docs/extensions/reference/api/userScripts
- Chrome extension cross-origin network requests:
  https://developer.chrome.com/docs/extensions/develop/concepts/network-requests
- Mozilla Firefox for Android extension development:
  https://extensionworkshop.com/documentation/develop/developing-extensions-for-firefox-for-android/
- Mozilla web-ext workflow, including Android run guidance:
  https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/
- Mozilla source-code submission:
  https://extensionworkshop.com/documentation/publish/source-code-submission/
- Mozilla third-party library usage:
  https://extensionworkshop.com/documentation/publish/third-party-library-usage/
- Mozilla add-on policies:
  https://extensionworkshop.com/documentation/publish/add-on-policies/
- MDN Firefox userScripts API:
  https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/userScripts
- OWASP Secrets Management Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html
- OWASP SSRF Prevention Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html
- OWASP File Upload Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
- MITRE CWE-409:
  https://cwe.mitre.org/data/definitions/409.html
- GitHub advisory GHSA-ph9p-34f9-6g65:
  https://github.com/advisories/GHSA-ph9p-34f9-6g65
- GitHub Actions secure use reference:
  https://docs.github.com/en/actions/reference/security/secure-use
- GitHub Dependabot version updates:
  https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/configuring-dependabot-version-updates
- Tampermonkey documentation:
  https://www.tampermonkey.net/documentation.php
- Violentmonkey project page:
  https://violentmonkey.github.io/
- ScriptCat changelog:
  https://docs.scriptcat.org/docs/change/
- ScriptCat PR #1309:
  https://github.com/scriptscat/scriptcat/pull/1309

Evidence labels used below:

- Verified: confirmed from live source, repo docs, command output, or official
  documentation during this pass.
- Likely: supported by static evidence, but should be confirmed by a targeted
  runtime or browser test before implementation is closed.
- Needs live validation: depends on store portal, manual AMO account access,
  real browser/device behavior, or external service credentials.

## Current Product Map

Core product:

- Browser extension: MV3 userscript manager for Chrome 130+ with a Firefox
  package path.
- Execution: `chrome.userScripts` registration plus wrapper-provided GM/TM API
  compatibility.
- Install/update: URL install, pasted code, file/drop imports, subscription and
  store/discovery surfaces, update checks, metadata parsing, dependency
  handling, SRI, provenance, and signing.
- Management: dashboard, popup, side panel on supported Chromium browsers,
  collections/folders, search, trash, settings, editor, snippets, templates,
  profiles, import/export, backup restore, runtime diagnostics, DevTools panel.
- Sync and data portability: WebDAV, browser sync, EasyCloud, Gist surfaces,
  plus deferred/limited OAuth providers depending on browser support.
- Backup: manual export/import and scheduled backup with ZIP/JSON handling and
  restore workflows.
- Trust posture: privacy copy, no telemetry posture, reviewer rationale, AMO
  source-review bundle, SLSA/SBOM/release-trust scripts, store-copy checks.

Primary personas:

- Power users running and auditing many scripts.
- Script authors editing locally, testing metadata, and managing `@require`,
  `@resource`, `@connect`, signing, and provenance.
- Privacy-sensitive users who want local-first backup and controlled sync.
- Store reviewers who need reproducible build, permission, data collection,
  minified-library, and browser-compatibility evidence.
- Maintainers who need reproducible gates and roadmap traceability.

Platform state:

- Chrome/Chromium: primary package, module service worker, Monaco editor,
  side-panel support where available.
- Firefox desktop: package and smoke path exist; Monaco is omitted from AMO
  package with textarea fallback; WebDAV-only sync validation exists.
- Firefox for Android: manifest compatibility is declared, but docs currently
  state no Android device smoke exists.
- Edge: generated package and support matrix references exist; live store state
  is a separate validation surface.

## Feature Inventory

| Area | Current capability | Evidence | Maturity | Main opportunity |
| --- | --- | --- | --- | --- |
| Script install | URL, paste, file, metadata parsing, update handling, SRI and provenance paths | `README.md`, `src/background/core.ts`, install tests | Mature | Keep install-size and internal-host policies aligned with backup import |
| Script execution | `chrome.userScripts`, GM/TM wrapper, commands, omnibox, popup run surfaces | `manifest.json`, `src/background/core.ts` | Mature | Complete GM namespace parity and cross-tab listener semantics |
| Editor | Monaco on Chromium, textarea fallback for Firefox AMO package | `CHANGELOG.md`, editor adapter files | Mature | Improve author config and metadata-assisted editing |
| Dashboard | Scripts, updates, settings, utilities, trash, store, help, many module files | `pages/dashboard.js`, dashboard modules | Mixed | Triage unreachable/duplicated modules and stale tabs |
| Popup/side panel | Quick control, Firefox permission onboarding, side-panel feature detection | popup/side-panel files, Firefox tests | Mature | Help links and settings discoverability |
| Sync | WebDAV, EasyCloud, browser/Gist surfaces, deferred OAuth in Firefox | `src/modules/sync-providers.ts`, `FIREFOX-PORT.md` | Strong but high risk | Endpoint egress guard, E2E encryption, settings partition |
| Backup/export | Manual and scheduled ZIP/JSON, selective restore, settings restore | `src/modules/backup-scheduler.ts` | Useful but high risk | Credential redaction and bounded intake |
| Trust/provenance | Signing, analyzer, SRI, source-review ZIP, store-copy gates | AMO docs, trust scripts | Strong | Reviewer-facing minified-library provenance gate |
| Release/CI | Build, web-ext lint, Firefox smoke, support matrix, attestations, SBOM | `.github/workflows/ci.yml`, scripts | Strong | Coverage floor, dependency automation, action SHA pinning |
| Cross-browser | Chrome primary, Firefox package/smoke, Edge artifact path | `FIREFOX-PORT.md`, manifests | Strong desktop | Android claim requires device smoke or deferral |
| Docs/help | README, ROADMAP, CHANGELOG, completed work, privacy/store copy | root docs | Strong | Reconcile in-app help and stale roadmap doc rows |
| Accessibility | WCAG planning, help consistency item, command docs | `docs/wcag3-gap-analysis.md`, README | Developing | Plain-language audit and per-page help affordances |

## Competitive and Ecosystem Research

Tampermonkey:

- Strength: broad compatibility expectations, mature docs, sync, granular
  userscript controls, and strong user familiarity.
- Relevant takeaway: ScriptVault should treat per-script network scope,
  metadata-driven settings, and clear permission displays as core trust
  features, not optional polish.
- Source: https://www.tampermonkey.net/documentation.php

Violentmonkey:

- Strength: simple open-source experience, browser-to-browser sync through
  Dropbox, OneDrive, Google Drive, or WebDAV, and low-friction external editor
  communication.
- Relevant takeaway: sync must stay simple for users, but provider endpoints and
  credentials need stricter safety defaults than a generic preferences blob.
- Source: https://violentmonkey.github.io/

ScriptCat:

- Strength: active MV3 work, WebDAV/S3 storage, script runtime options,
  Playwright E2E tests, and aggressive GM API/runtime improvements.
- Relevant takeaway: ScriptCat's 2026 changelog records moving device-related
  sync config to `chrome.storage.local` to avoid cross-device sync leakage.
  ScriptVault has the same class of risk because per-script settings are synced
  wholesale today.
- Sources: https://docs.scriptcat.org/docs/change/ and
  https://github.com/scriptscat/scriptcat/pull/1309

Firefox extension ecosystem:

- Mozilla requires clear source-review material for packaged/minified
  third-party libraries and distinguishes desktop from Android compatibility
  evidence.
- Relevant takeaway: ScriptVault's Firefox path is strong for desktop, but AMO
  submission should not rely on generic source ZIP statements when packaged
  minified libraries and Android claims are present.
- Sources:
  https://extensionworkshop.com/documentation/publish/source-code-submission/,
  https://extensionworkshop.com/documentation/publish/third-party-library-usage/,
  https://extensionworkshop.com/documentation/develop/developing-extensions-for-firefox-for-android/

GitHub supply-chain guidance:

- GitHub documents full-length commit SHA pinning as the immutable action
  option and Dependabot configuration as the standard version-update path.
- Relevant takeaway: ScriptVault already invests in attestations and SBOMs, so
  floating action tags and manual dependency freshness are the weak links in the
  same trusted-release story.
- Sources: https://docs.github.com/en/actions/reference/security/secure-use and
  https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/configuring-dependabot-version-updates

## Highest-Value New Features

### 1. Sync Endpoint Egress Guard

Priority: P1.

Problem: WebDAV and S3 endpoints are user-configured URLs that can point at
loopback, link-local, private network, metadata service, or redirected internal
hosts. GM_xhr and install/resource paths already have `InternalHostGuard`, but
sync providers do not.

Feature: route all sync-provider request URLs through the shared internal-host
policy before request and after final response URL resolution. Preserve an
explicit opt-in for self-hosted local/private WebDAV, Nextcloud, MinIO, or
R2-compatible endpoints.

Implementation areas:

- `src/modules/sync-providers.ts`
- Generated provider runtime after the established build flow
- Settings UI copy for local/private endpoint opt-in
- Provider tests for WebDAV/S3 preflight, redirect, opt-in, and denial

Success criteria:

- Internal/private host requests are blocked by default for sync providers.
- Explicit local/private endpoint opt-in is required and audit-visible.
- Redirects to internal hosts fail before body read.
- Existing public WebDAV/S3 providers keep working.

### 2. Credential-Safe Export And Backup

Priority: P1.

Problem: manual export and scheduled backups can include global settings, while
global settings include WebDAV passwords, OAuth tokens, refresh tokens, S3 keys,
and signing-related trust material.

Feature: split settings into ordinary preferences and credential-bearing fields.
Exports and backups redact credentials by default. A separate explicit
credential-export mode requires user confirmation, archive metadata, and restore
confirmation before overwriting live credentials.

Implementation areas:

- Settings schema redaction helper
- `src/background/core.ts` export/import paths
- `src/modules/backup-scheduler.ts`
- Dashboard copy and metadata display
- Tests for backup, manual export, import, restore, and rollback

Success criteria:

- Default exports/backups do not contain provider passwords or OAuth/S3 tokens.
- Credential-inclusive archives are visibly marked.
- Restore cannot overwrite live credentials without explicit user action.
- Existing preference restore continues to work.

### 3. Bounded Backup Archive Intake

Priority: P1.

Problem: ZIP and JSON backup intake currently decodes/decompresses archives
before strong decompressed-size, file-count, entry-size, and per-script-code
limits are enforced.

Feature: introduce a shared archive intake helper that validates compressed
size, decompressed size, file count, entry name/path, per-entry byte size,
supported extensions, nested archive policy, and per-script code length before
registration or restore.

Implementation areas:

- `src/modules/backup-scheduler.ts`
- `src/background/core.ts` import paths
- Backup inspect/verify/restore helpers
- Tests with oversized JSON, decompression amplification, many entries,
  oversized `.user.js`, and malformed metadata

Success criteria:

- Oversized archives fail with specific user-facing errors.
- The install path's script-size policy applies to backup imports too.
- Inspect/verify paths cannot allocate unbounded archive contents.
- Valid existing fixtures still import and restore.

### 4. Sync-Safe Script Settings Partition

Priority: P1.

Problem: per-script settings are serialized wholesale into cloud-sync envelopes.
The type shape is open-ended and includes local/conflict/error state that should
not necessarily roam across devices.

Feature: define an explicit sync-safe settings projection. Keep device-local
keys in local storage, mark sync-excluded keys, and add migration/audit output
so users can understand what sync carries.

Implementation areas:

- `src/types/script.ts`
- `src/background/cloud-sync.ts`
- `src/background/core.ts`
- EasyCloud and provider merge paths
- Tests for local-only keys, conflict markers, future unknown keys, and merge
  behavior

Success criteria:

- Only allowlisted script settings enter sync envelopes.
- Device-local fields remain local through upload/download cycles.
- Unknown future keys do not sync by default.
- Existing synced script behavior remains compatible after migration.

### 5. Optional Client-Side Sync Encryption

Priority: P1.

Problem: privacy-first sync should not require provider trust for script code,
settings, and metadata.

Feature: add optional client-side encryption for cloud sync payloads with local
key derivation, clear recovery-key UX, versioned envelopes, and provider-agnostic
storage.

Implementation areas:

- Sync envelope format
- Key setup and recovery UI
- Provider upload/download merge path
- Import/export metadata
- Tests for decrypt failure, wrong key, rotation, and mixed encrypted/plain
  migration

Success criteria:

- Users can enable encrypted sync without changing providers.
- Wrong-key and missing-key states are recoverable and clear.
- Unencrypted sync continues to work for existing users.

### 6. Per-Script Host Scope For Network/Cookie/DNR Primitives

Priority: P1.

Problem: extension-level host permission is broad, while userscript trust is
per-script. GM network/cookie/DNR primitives need a user-visible per-script
scope model beyond raw `@connect` checks.

Feature: add a per-script host-scope policy that summarizes requested hosts,
flags broad hosts, stores user approvals, and gates GM_xhr, GM_cookie, dynamic
DNR, and future network-capable primitives.

Implementation areas:

- Metadata parser and policy model
- Install/update preview
- Script details/settings UI
- Runtime guard checks
- Regression tests for broad, exact, wildcard, redirect, and revoked scope

Success criteria:

- Users can see and approve high-risk script network scope.
- Runtime network/cookie/DNR operations fail closed when scope is revoked.
- Updates that expand scope require review.

### 7. Script Author Configuration UI

Priority: P1.

Problem: competing userscript managers expose author-defined configuration such
as `@var`, `GM_config`, or ScriptCat-style runtime options. ScriptVault has rich
settings surfaces, but author-defined script settings are not yet a first-class
workflow.

Feature: parse structured script configuration metadata, render validated
controls in script details, persist values per script, and expose them to the
wrapper runtime.

Implementation areas:

- Metadata parser
- Settings type model
- Dashboard details UI
- Wrapper runtime
- Import/export/sync classification
- Tests for defaults, invalid values, migration, and sync-safe behavior

Success criteria:

- Script authors can define user-facing settings without custom UI code.
- Users can reset, edit, import, export, and sync allowed config values.
- Config values are validated before runtime exposure.

### 8. Structured Antifeature Parsing And Labels

Priority: P1.

Problem: userscript metadata can signal ads, tracking, miner behavior, or other
antifeatures. ScriptVault should turn those signals into install and dashboard
trust affordances.

Feature: parse `@antifeature` metadata, show install warnings and dashboard
chips, and include antifeature data in trust/provenance exports.

Implementation areas:

- Metadata parser
- Install preview
- Dashboard row/card UI
- Trust/provenance data
- Store/search filters

Success criteria:

- Known antifeatures are visible before install.
- Installed scripts display searchable/filterable antifeature chips.
- Unknown antifeatures are preserved rather than dropped.

### 9. Firefox Android Smoke Or Claim Deferral

Priority: P2.

Problem: the Firefox manifest declares Android compatibility and generated docs
list Android as a validation target, but the repo states no Android device
smoke exists.

Feature: either add an ADB/web-ext Firefox Android smoke for critical workflows
or remove/defer Android compatibility claims until hardware coverage exists.

Implementation areas:

- `manifest-firefox.json`
- `scripts/smoke-firefox-sideload.mjs` or a new Android smoke script
- `docs/cross-browser-pipeline.md`
- Browser support matrix generator
- AMO copy

Success criteria:

- Android claims are backed by device/emulator evidence, or the claim is
  removed from package/docs before listing.
- AMO reviewer notes distinguish desktop support from Android support.

### 10. AMO Vendored-Library Provenance Gate

Priority: P2.

Problem: the Firefox package ships minified Acorn and Diff files, but the
source-review docs do not yet map each packaged file to official source,
version, hash, and reviewer-readable build/provenance evidence.

Feature: generate a vendored-library provenance inventory and gate Firefox
package hashes against it before AMO upload.

Implementation areas:

- `AMO-SOURCE-README.md`
- `build-firefox.sh`
- Store-copy/source-review check scripts
- Tests for included library paths, versions, hashes, and source URLs

Success criteria:

- Every packaged minified library has official source URL, package/release
  version, source hash, packaged hash, and reviewer instruction.
- The gate fails if packaged bytes drift without updating provenance.

## Existing Feature Improvements

Coverage gate:

- `vitest.config.mjs` has `all:false` and no threshold, so CI cannot enforce
  meaningful source/runtime coverage.
- Add source include lists, generated-runtime smoke coverage where feasible,
  and a realistic floor that starts from measured current coverage.

Dependency freshness:

- `npm outdated --json` still reports multiple dev dependencies behind current
  versions.
- Add Dependabot or Renovate for npm and GitHub Actions, then tune grouping to
  avoid one oversized maintenance PR.

GitHub Actions supply-chain:

- CI currently uses floating action tags while also creating trusted artifacts.
- Pin third-party actions to full-length SHAs and add a maintenance path for
  refreshing pins.

Optional dependency audit exemption:

- The high audit gate uses `--omit=optional`; this is defensible only when no
  optional dependency code ships into the extension packages.
- Add a reachability/package-content check for optional dependencies.

Dashboard reachability:

- The dashboard contains many module files and previous research identified
  unreachable or duplicated UI modules.
- Build a route/tab/module inventory, delete dead code or mount intentionally,
  and keep tests tied to reachable user flows.

Crontab next-fire:

- The current parser is simplified and defaults unknown patterns to a fixed
  interval.
- Replace with a real parser or documented subset, then show next-fire preview
  in script details.

What's New:

- Existing research flags v3.x users as unable to see current "What's New"
  content.
- Tie the panel to release metadata and ensure post-upgrade behavior is tested.

i18n-v2:

- Existing research flags the v2 i18n table as eager-loaded and effectively
  dead.
- Either wire it into actual localization or remove it and keep current string
  handling simpler.

Help consistency and plain language:

- README documents the `sv` omnibox and keyboard shortcuts, but roadmap items
  still mention documentation gaps. In-app help may still be incomplete.
- Reconcile roadmap wording, add help links to popup/side-panel/install pages,
  and run the planned plain-language pass.

Settings discoverability:

- Advanced settings such as internal network opt-ins, sync options, backup
  limits, and experimental flags need a consolidated defaults/validation table.
- Add a single settings schema reference and generate UI/default checks from it
  where possible.

## Reliability, Security, Privacy, and Data Safety

Security:

- Treat every user-configured URL as network egress until it passes the same
  internal-host policy as script-source and GM_xhr paths.
- Treat every backup/export as a data-exfiltration surface until credentials
  are explicitly separated and redacted.
- Treat every archive import as untrusted file upload until compressed and
  decompressed limits are enforced before parse/write.
- Treat every GitHub Actions tag in release-producing workflows as mutable until
  pinned to a full-length SHA.

Privacy:

- Preserve the local-first/no-telemetry product posture.
- Add sync encryption and settings partitioning before expanding provider
  claims.
- Ensure backup metadata tells users when credentials or local-only state are
  included.

Data safety:

- Keep existing backup identity and selective restore guarantees.
- Add import previews for settings and credentials before overwriting local
  state.
- Keep rollback paths compatible with redacted backups.
- Add "restore dry run" coverage for invalid archive limits, missing
  credentials, and encrypted sync envelopes.

Reviewer trust:

- Keep AMO/CWS copy tied to evidence-producing scripts.
- Avoid claims such as Android support, OAuth-provider support in Firefox, or
  full library provenance unless the corresponding gate exists.

## UX, Accessibility, and Trust

Trust-facing UX:

- Install previews should show network scope, antifeatures, dependency
  provenance, signing status, and whether an update expands risk.
- Backup/export dialogs should distinguish ordinary settings from credentials.
- Sync settings should explain public versus local/private endpoint behavior.

Accessibility:

- Extend help-link consistency to popup, side panel, install, and dashboard
  views.
- Run the planned plain-language pass and keep user-facing warnings short,
  direct, and specific.
- Ensure keyboard commands and omnibox discovery are present in both docs and
  in-app help, not just README.

Usability:

- Do not require users to understand provider internals to make safe sync
  decisions.
- For high-risk actions, prefer progressive disclosure: default-safe path,
  visible risk summary, explicit advanced opt-in, and reversible settings.
- Make store-review and security states visible in maintenance dashboards so
  release readiness is not hidden in CI logs only.

## Architecture and Maintainability

Build architecture:

- The repo uses TypeScript source promotion plus generated runtime artifacts.
  Continue editing source under `src/**` and regenerating runtime artifacts
  through established scripts.
- Do not hand-edit generated `background.js` or generated runtime files.

Testing architecture:

- Current test coverage is broad but does not enforce all source/runtime files.
- Add coverage inclusion and thresholds incrementally, starting with
  security-critical modules.
- Browser smoke tests are valuable evidence; add Android only when hardware or
  emulator setup is reliable enough to avoid noisy CI.

Data architecture:

- Define explicit projections for exported, synced, redacted, local-only, and
  credential-bearing data.
- Keep projections near shared types so backup, sync, import, and UI copy use
  the same classification.

Release architecture:

- Pin action SHAs, automate dependency updates, and keep attestation/SBOM/source
  review gates aligned.
- Add generated provenance artifacts for vendored libraries instead of relying
  on reviewer prose alone.

## Prioritized Roadmap

- [ ] **P1 - Apply internal-host guard to sync provider endpoints**
  - Priority: P1.
  - Why: WebDAV/S3 sync URLs are user-controlled network egress and can target
    internal/private hosts or redirect there.
  - Evidence: `src/modules/sync-providers.ts` provider fetches; existing
    `InternalHostGuard` use in `src/background/core.ts`; OWASP SSRF and Chrome
    network-request guidance.
  - Touches: sync providers, settings UI, provider tests, generated runtime.
  - Acceptance: sync requests block internal/private hosts by default and allow
    local/private endpoints only through explicit advanced opt-in.
  - Verify: provider unit tests plus WebDAV/S3 redirect fixtures and a public
    endpoint regression test.

- [ ] **P1 - Redact credential-bearing settings from exports and backups**
  - Priority: P1.
  - Why: current settings export/backup can include provider secrets and tokens.
  - Evidence: `src/types/settings.ts`, `src/background/core.ts`,
    `src/modules/backup-scheduler.ts`, OWASP Secrets guidance.
  - Touches: settings schema, manual export/import, scheduled backups, restore
    UI, tests.
  - Acceptance: default archives contain no OAuth, WebDAV, S3, or password-like
    credential fields; credential-inclusive archives are explicitly marked.
  - Verify: fixture tests inspect archive JSON and restore behavior.

- [ ] **P1 - Bound backup ZIP/JSON intake before decompression and parse**
  - Priority: P1.
  - Why: untrusted backup data can currently be decompressed and parsed before
    shared caps are enforced.
  - Evidence: `fflate.unzipSync` paths in backup/import code; OWASP File Upload
    guidance; CWE-409.
  - Touches: backup scheduler, import helpers, error messages, tests.
  - Acceptance: compressed-size, decompressed-size, entry-count, entry-size,
    nested archive, and script-code limits are enforced.
  - Verify: malicious archive fixtures and valid backup regression fixtures.

- [ ] **P1 - Partition sync-safe and device-local per-script settings**
  - Priority: P1.
  - Why: open-ended script settings currently roam wholesale through sync.
  - Evidence: `src/types/script.ts` and cloud-sync serialization paths;
    ScriptCat PR #1309 and changelog.
  - Touches: script types, sync envelope, EasyCloud/provider merge, migration,
    tests.
  - Acceptance: only allowlisted settings sync; unknown/local-only keys stay
    local.
  - Verify: upload/download merge tests with local-only, conflict, and unknown
    keys.

- [ ] **P1 - Add coverage inclusion and threshold gate**
  - Priority: P1.
  - Why: CI can pass without measuring many important files.
  - Evidence: `vitest.config.mjs` has `all:false` and no threshold.
  - Touches: coverage config, test include lists, CI, docs.
  - Acceptance: coverage report includes source files and enforces an initial
    measured floor.
  - Verify: `npm run check` or focused coverage script in CI with failure on
    reduced coverage.

- [ ] **P1 - Automate dependency freshness**
  - Priority: P1.
  - Why: manual updates are reactive and dependency drift remains.
  - Evidence: `npm outdated --json`; previous `web-ext`/`tmp` advisory path;
    GitHub Dependabot docs.
  - Touches: `.github/dependabot.yml` or Renovate config, CI, docs.
  - Acceptance: npm and GitHub Actions updates open scheduled PRs with sane
    grouping.
  - Verify: config validation and first update PR behavior.

- [ ] **P1 - Pin GitHub Actions to full-length SHAs**
  - Priority: P1.
  - Why: release-trust workflows currently use mutable tags.
  - Evidence: `.github/workflows/ci.yml`; GitHub secure-use reference.
  - Touches: workflows, action pin maintenance docs.
  - Acceptance: third-party actions are pinned to full SHAs and refresh process
    is documented.
  - Verify: static workflow check rejects tag-only action refs.

- [ ] **P1 - Add optional client-side E2E encryption for cloud sync**
  - Priority: P1.
  - Why: provider-hosted sync should not require provider trust.
  - Evidence: current sync providers and privacy posture in docs.
  - Touches: sync envelope, key setup, settings UI, import/export, tests.
  - Acceptance: encrypted sync works provider-agnostically with recovery and
    wrong-key states.
  - Verify: encrypted/plain migration, wrong-key, rotation, and provider tests.

- [ ] **P1 - Add per-script host scope for GM network/cookie/DNR primitives**
  - Priority: P1.
  - Why: extension host permissions are broad while script trust is per-script.
  - Evidence: manifest host permissions, GM_xhr/internal-host work,
    `@connect` behavior, Tampermonkey ecosystem expectations.
  - Touches: metadata parser, install preview, runtime guards, dashboard.
  - Acceptance: scripts cannot use expanded network/cookie/DNR scope without
    user-visible approval.
  - Verify: install/update/runtime tests for broad, narrow, revoked, and
    redirected hosts.

- [ ] **P1 - Triage unreachable and duplicated dashboard modules**
  - Priority: P1.
  - Why: tested-but-unmounted modules create false confidence and maintenance
    drag.
  - Evidence: existing research in `RESEARCH_REPORT.md`; dashboard module map.
  - Touches: dashboard routes/tabs, lazy loader, tests, docs.
  - Acceptance: every dashboard module is reachable, intentionally lazy, or
    removed.
  - Verify: static route inventory and browser navigation smoke.

- [ ] **P1 - Correct crontab next-fire engine**
  - Priority: P1.
  - Why: simplified parsing can schedule incorrectly and hide errors.
  - Evidence: roadmap item and current parser behavior in background code.
  - Touches: scheduler parser, UI preview, tests.
  - Acceptance: supported cron expressions produce correct next-fire times;
    unsupported expressions fail clearly.
  - Verify: table-driven parser tests across edge cases.

- [ ] **P1 - Fix stale What's New behavior for v3.x users**
  - Priority: P1.
  - Why: release communication is part of trust and upgrade safety.
  - Evidence: existing research and roadmap item.
  - Touches: release metadata, dashboard panel, upgrade state, tests.
  - Acceptance: upgraded users see current release notes once and can reopen
    them from help/settings.
  - Verify: simulated upgrade tests for old and current versions.

- [ ] **P1 - Add script-author configuration UI**
  - Priority: P1.
  - Why: userscript authors and users expect first-class runtime options.
  - Evidence: ScriptCat runtime options and Tampermonkey-style ecosystem
    expectations; existing settings and metadata surfaces.
  - Touches: metadata parser, script settings, dashboard UI, wrapper runtime,
    backup/sync projections.
  - Acceptance: author-defined settings render, validate, persist, export, and
    expose to script runtime.
  - Verify: metadata fixture tests and dashboard interaction tests.

- [ ] **P1 - Parse and display structured antifeatures**
  - Priority: P1.
  - Why: antifeature metadata is high-signal trust information at install time.
  - Evidence: roadmap item and userscript metadata ecosystem.
  - Touches: metadata parser, install preview, dashboard cards/table, store
    filters.
  - Acceptance: known and unknown antifeatures are preserved and visible.
  - Verify: install/update/dashboard tests with multiple antifeatures.

- [ ] **P2 - Add Firefox Android smoke or remove Android compatibility claim**
  - Priority: P2.
  - Why: manifest/docs claim Android compatibility without device smoke.
  - Evidence: `manifest-firefox.json`, `FIREFOX-PORT.md`, README support
    matrix, Mozilla Android docs.
  - Touches: Firefox manifest, smoke scripts, support matrix, AMO copy.
  - Acceptance: Android support is backed by device/emulator evidence or
    explicitly deferred.
  - Verify: ADB/web-ext smoke output or docs/package diff removing the claim.

- [ ] **P2 - Add reviewer-reproducible provenance for packaged minified libraries**
  - Priority: P2.
  - Why: AMO source review needs exact source and provenance for packaged
    minified third-party files.
  - Evidence: `build-firefox.sh`, `AMO-SOURCE-README.md`, `lib/acorn.min.js`,
    Mozilla source-code and third-party-library docs.
  - Touches: AMO source README, library inventory, package gate tests.
  - Acceptance: every packaged minified library has source URL, version, hash,
    packaged hash, and reviewer instructions.
  - Verify: store-copy/source-review gate fails on hash drift.

- [ ] **P2 - Add optional-dependency reach check for audit exemption**
  - Priority: P2.
  - Why: `--omit=optional` is safe only if optional dependencies do not ship.
  - Evidence: dependency audit policy and CI audit command.
  - Touches: dependency policy, package inspection script, CI.
  - Acceptance: optional dependency code cannot enter extension packages
    without a failing gate or explicit policy update.
  - Verify: package-content fixture and CI check.

- [ ] **P2 - Improve help consistency and plain-language copy**
  - Priority: P2.
  - Why: README documents commands/omnibox, but in-app help and roadmap wording
    need reconciliation.
  - Evidence: README, roadmap P3 doc items, WCAG/help planning docs.
  - Touches: dashboard help, popup, side panel, install page, docs.
  - Acceptance: every primary surface has a help entry and high-risk warnings
    are plain-language.
  - Verify: static link check and plain-language report.

- [ ] **P2 - Consolidate settings defaults and validation**
  - Priority: P2.
  - Why: safety-critical settings are scattered across UI and runtime logic.
  - Evidence: `src/types/settings.ts`, roadmap settings audit item.
  - Touches: settings schema, UI, validation, docs, tests.
  - Acceptance: settings have typed defaults, validation, descriptions, and
    export/sync/credential classifications.
  - Verify: generated settings table and validation tests.

- [ ] **P3 - Add package manager and Node version contributor anchors**
  - Priority: P3.
  - Why: package engines define a lower bound but contributor shells need exact
    install guidance.
  - Evidence: `package.json` has `engines.node >=21.2.0`; roadmap P3 item.
  - Touches: `package.json`, `.nvmrc`, contributor docs.
  - Acceptance: package manager and Node version are explicit and checked.
  - Verify: install command and engine check in CI.

## Quick Wins

- Add `RESEARCH_FEATURE_PLAN.md` to README and `RESEARCH_REPORT.md` planning
  links. This pass includes that documentation sync.
- Reconcile roadmap P3 rows for `sv` omnibox and keyboard commands with README,
  then keep any remaining work scoped to in-app help.
- Add `packageManager` and `.nvmrc` to match the existing Node floor.
- Add a short `CONTRIBUTING.md` note explaining `.factory/` if that directory
  remains part of the workflow.
- Expand `docs/readme-feature-claim-checklist.md` rows for Firefox AMO package,
  source-review bundle, support matrix, and Android claim state.
- Add a static check that lists optional dependencies and confirms none are
  copied into release packages.
- Add AMO library inventory rows for `lib/acorn.min.js` and `lib/diff.min.js`
  before generating a fuller gate.
- Add a route/module inventory for dashboard pages to separate reachable,
  lazy-loaded, and dead modules.
- Add settings classification comments or metadata for credential-bearing
  fields before implementing redaction.
- Add a backup import fixture that fails on oversized script code, matching the
  existing install path policy.

## Larger Bets

- Client-side encrypted cloud sync with recovery UX and provider-agnostic
  envelopes.
- Per-script trust/scope model for GM network, cookie, and DNR privileges.
- Script-author configuration UI with typed metadata, validation, runtime
  exposure, and sync/export classification.
- Dashboard architecture cleanup that removes dead modules and gives each
  advanced tool a reachable user journey.
- Cross-browser CI matrix that treats Chrome, Firefox desktop, Firefox Android,
  and Edge as explicitly different support levels.
- Release-trust hardening that combines SHA-pinned actions, dependency update
  automation, coverage floors, source-review provenance, and package-content
  gates.

## Explicit Non-Goals

- Do not add telemetry to validate feature usage.
- Do not silently include credentials in backups for convenience.
- Do not broaden extension permissions or script network scope without a
  visible per-script trust model.
- Do not claim Firefox for Android support unless a device/emulator smoke exists
  or the claim is intentionally scoped as manifest-only validation.
- Do not bundle full Monaco into the AMO package unless source-review and size
  implications are deliberately accepted.
- Do not replace `ROADMAP.md` as the active queue with this report.
- Do not implement feature code during this research pass.

## Open Questions

1. AMO submission requires manual account access and reviewer interaction. Who
   owns the unlisted upload, and what evidence should be attached in the first
   submission?
2. Should Firefox for Android remain a claimed compatibility target before a
   reliable Android smoke exists, or should it be explicitly deferred?
3. Should credential-inclusive backups be allowed at all, or should users be
   required to re-enter provider credentials after restore?
4. Which sync providers are intended to remain first-class in Firefox v1 after
   OAuth providers are deferred?
5. What is the preferred user-facing name for local/private sync endpoint
   opt-in so self-hosted WebDAV users understand it without weakening the
   default policy?
6. Should per-script author configuration values sync by default, or should
   script authors mark each config key as sync-safe?
7. Which dashboard modules are intentionally future-facing prototypes versus
   accidental dead code?
8. What initial coverage floor is acceptable once all intended source files are
   included in coverage measurement?
9. Should dependency update automation group all dev tooling together, or split
   browser/package tooling from test/build tooling?
10. Should release-readiness require no stale roadmap rows that duplicate
    already documented README features?
