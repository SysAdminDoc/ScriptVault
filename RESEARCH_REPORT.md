# Research Report

Status: consolidated docs index plus 2026-06-03 deep research pass.

2026-06-04 Cycle 8 comprehensive feature-plan refresh: root-level
`RESEARCH_FEATURE_PLAN.md` now holds the current implementation-oriented
research plan for ScriptVault v3.11.0. It preserves `ROADMAP.md` as the open
queue while consolidating product map, feature inventory, competitive research,
highest-value new features, improvement themes, security/privacy/data-safety
risks, UX/accessibility/trust items, maintainability themes, prioritized
checkbox roadmap entries, quick wins, larger bets, non-goals, and open
questions.

2026-06-04 build-lane sync-endpoint update: WebDAV and S3 sync endpoints now
share the internal-host preflight and redirect guard. `ROADMAP.md` remains the
only active checkbox queue; `RESEARCH_FEATURE_PLAN.md` is a companion synthesis
without an independent checklist.

2026-06-04 build-lane credential-export update: vault JSON/cloud exports and
managed backup ZIPs now redact sync credentials by default, expose separate
credential opt-ins with risk copy, stamp settings credential metadata, and keep
restore/import from overwriting live WebDAV/OAuth/S3 credentials unless archive
metadata and user confirmation both opt in.

2026-06-04 build-lane archive-intake update: JSON imports, ZIP imports, backup
import, inspect, verify, and restore now use bounded archive intake before text
decode, JSON parse, or registration. The helper rejects oversized compressed
payloads, excessive file counts, aggregate expanded data, oversized entries,
nested archives, and high compression ratios; JSON imports also enforce the
5 MB per-script code cap plus a total import budget.

2026-06-04 build-lane sync-settings update: CloudSync and EasyCloud now
partition per-script settings before sync. Upload envelopes include only
allowlisted user-facing preferences, while local-only state such as
`userModified`, `mergeConflict`, failed dependency diagnostics, registration
errors, and source-identity warnings remains on the originating device and is
ignored when found in legacy remote envelopes.

2026-06-04 build-lane sync-encryption update: CloudSync and EasyCloud now read
plaintext v1 sync envelopes and encrypted v2 envelopes, then upload sanitized
`AES-256-GCM` v2 envelopes when the user enables sync encryption with a local
passphrase. The dashboard exposes the opt-in, and
`syncEncryptionPassphrase` is handled as a redacted sync credential in exports
and backups.

2026-06-04 build-lane Firefox Android update: the unverified Android
compatibility claim is deferred until a real device/emulator smoke exists.
`manifest-firefox.json` no longer declares `gecko_android`, and the generated
support matrix now labels Firefox for Android as deferred instead of an AMO
compatibility target.

2026-06-04 build-lane AMO vendored-library provenance update: the Firefox
package now has reviewer-reproducible provenance for packaged minified
third-party libraries. `acorn@8.16.0` and `diff@9.0.0` are exact npm dev pins,
`lib/acorn.min.js` is regenerated from official npm Acorn source with esbuild,
`lib/diff.min.js` is copied from the official npm jsdiff package, and
`docs/amo-vendored-libraries.md` plus `npm run vendored:provenance:check` gate
the package URLs, tarball integrity, source hashes, packaged hashes, licenses,
and Firefox package includes.

2026-06-04 build-lane Help-link update: dashboard, popup, side panel, and
install now expose a consistent `[data-help]` control with accessible name
`Help`. Popup and side-panel actions route through the existing dashboard
runtime opener with `tab: 'help'`, while every surface has a
`pages/dashboard.html#tab=help` fallback.

2026-06-04 build-lane readability update: H-2 is closed for the high-impact
setup/install/trust strings called out by the archived plan. New
`scripts/check-readability.mjs` computes Flesch Reading Ease, verifies the
audited strings still exist in source, reports offending IDs/files, and is
wired into CI, `npm run test:a11y`, and `npm run check`.

2026-06-04 implementation refresh: the 2026-06-03 findings still stand, but the
currently-breaking dependency item is now closed. `web-ext` was bumped to
`^10.3.0`, `npm ls tmp` resolves `tmp@0.2.6`, and
`npm audit --audit-level=high --omit=optional` exits 0. Firefox validation also
advanced: `npm run firefox:package` passes with 0 errors, 0 notices, and 139
warnings; `npm run smoke:firefox` passes with Firefox Developer Edition
151.0b10; and `npm run support:matrix:check` passes after regenerating the
browser support matrix. Current external anchors: GitHub
Advisory GHSA-ph9p-34f9-6g65 (`https://github.com/advisories/GHSA-ph9p-34f9-6g65`),
the `web-ext` npm package (`https://www.npmjs.com/package/web-ext`), and the
Chrome `userScripts` API reference
(`https://developer.chrome.com/docs/extensions/reference/api/userScripts`).

2026-06-04 Cycle 2 sync-state refresh: a static read of
`src/background/cloud-sync.ts`, `src/background/core.ts`,
`src/modules/sync-easycloud.ts`, and `src/types/script.ts` found that
per-script `settings` are serialized wholesale into cloud-sync envelopes even
though `ScriptSettings` includes device-local/conflict/error keys and arbitrary
future keys. This is now a P1 roadmap item to partition sync-safe settings from
device-local state. External anchor: ScriptCat PR #1309
(`https://github.com/scriptscat/scriptcat/pull/1309`) and the v0.16.14
changelog entry (`https://docs.scriptcat.org/docs/change/`), where
device-related sync config was moved to `chrome.storage.local` after OneDrive
state/OAuth prompts leaked across devices.

2026-06-04 Cycle 3 sync-endpoint egress refresh: after the GM_xhr
internal-host guard landed, the remaining network-egress gap is WebDAV/S3 sync.
`src/modules/sync-providers.ts` still derives WebDAV fetch URLs from
`webdavUrl` and S3 fetch URLs from `s3Endpoint` without `InternalHostGuard`
pre/post checks. `ROADMAP.md` now promotes a P1 item to guard those
user-configured sync endpoints while preserving an explicit local/private
endpoint opt-in for self-hosted Nextcloud, WebDAV, MinIO, or R2-compatible
deployments. External anchors: OWASP SSRF Prevention
(`https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html`),
AWS IMDS guidance
(`https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-instance-metadata-service.html`),
and Chrome extension cross-origin network request behavior
(`https://developer.chrome.com/docs/extensions/develop/concepts/network-requests`).

2026-06-04 Cycle 4 backup-settings credential refresh: manual export and
scheduled backup paths still serialize global settings as a single blob, while
provider settings include OAuth tokens, WebDAV passwords, and S3 access keys.
`ROADMAP.md` now promotes a P1 item to redact credential-bearing settings by
default, add a separate explicit credential-export opt-in with archive metadata,
and keep restore/import from overwriting live credentials unless both metadata
and user confirmation allow it. External anchors: OWASP Secrets Management
(`https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html`),
Google OAuth token storage best practices
(`https://developers.google.com/identity/protocols/oauth2/resources/best-practices`),
and AWS IAM access-key guidance
(`https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html`).

2026-06-04 Cycle 5 backup archive intake refresh: ZIP/JSON import, stored-backup
import, inspect, verify, and restore paths decode and decompress archives before
enforcing decompressed-size, file-count, per-entry, or per-script code caps.
`ROADMAP.md` now promotes a P1 item to replace raw archive intake with a shared
bounded helper and to apply the existing 5 MB script-size policy to backup
imports. External anchors: OWASP File Upload guidance
(`https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html`)
and MITRE CWE-409
(`https://cwe.mitre.org/data/definitions/409.html`).

2026-06-04 Cycle 6 Firefox Android smoke refresh: the desktop Firefox package
and sideload smoke now have strong coverage, but `manifest-firefox.json` also
declares `gecko_android.strict_min_version: 142.0` and the generated support
matrix lists Firefox for Android as a manifest validation target while explicitly
stating no Android device smoke exists. `ROADMAP.md` now promotes a P2
hardware-gated item to either add an ADB/web-ext Firefox Android smoke for the
critical userscript, permission, UI, WebDAV, and import paths, or remove/defer
the Android compatibility claim before AMO listing. External anchors: Mozilla's
Android compatibility/listing guidance
(`https://extensionworkshop.com/documentation/publish/version-compatibility/`),
Firefox-for-Android extension development checklist and MV3 caveats
(`https://extensionworkshop.com/documentation/develop/developing-extensions-for-firefox-for-android/`),
web-ext Android run workflow
(`https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/`),
Firefox `userScripts` optional-permission docs
(`https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/userScripts`),
and Android desktop-difference guidance
(`https://extensionworkshop.com/documentation/develop/differences-between-desktop-and-android-extensions/`).

2026-06-04 Cycle 7 AMO vendored-library provenance refresh: the Firefox
package ships `lib/acorn.min.js` and `lib/diff.min.js`, while
`AMO-SOURCE-README.md` only names those paths and says the source ZIP includes
the repo plus lockfiles. Mozilla source-code and third-party-library guidance
requires reviewer-readable source/build material, links to original included
files, and official release or package-manager provenance; local Acorn identifies
itself as jsDelivr-minified `acorn@8.14.1` while the lockfile resolves npm
`acorn@8.16.0`. `ROADMAP.md` now promotes a P2 item to add a reviewer-facing
library provenance inventory and gate packaged Firefox library hashes before AMO
upload. External anchors: Mozilla source-code submission
(`https://extensionworkshop.com/documentation/publish/source-code-submission/`),
third-party library usage
(`https://extensionworkshop.com/documentation/publish/third-party-library-usage/`),
add-on policies
(`https://extensionworkshop.com/documentation/publish/add-on-policies/`), and
MDN publishing notes
(`https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/What_next`).

2026-06-04 Cycle 9 CWS remote-code review refresh: Chrome Web Store MV3
policy permits remote logic only through documented APIs such as User Scripts
and treats the exemption as scoped to the covered code. ScriptVault has the
right architecture markers (`manifest.json` uses `userScripts`, extension pages
forbid `unsafe-eval`, and the editor uses a sandboxed page), and `PRIVACY.md`
explains externally sourced userscript execution. The build lane closed the
remaining release-review gap with `docs/cws-remote-code-compliance.md`,
`scripts/check-cws-remote-code.mjs`, release/store-copy references, and a CI
step that scans the packaged Chrome artifact for remote script tags, remote
workers/imports, and fetched strings executed outside `chrome.userScripts` and
sandboxed-page paths.
External anchors: Chrome Web Store program policies
(`https://developer.chrome.com/docs/webstore/program-policies/policies`), Chrome
remote-hosted-code violation guidance
(`https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code`),
and the Chrome `userScripts` API reference
(`https://developer.chrome.com/docs/extensions/reference/api/userScripts`).

2026-06-04 Cycle 10 Edge artifact/support-matrix refresh: the Edge package
builder is present (`npm run build:edge`, `npm run build:edge:check`, and
`tests/edge-build.test.js`), and `docs/edge-submission.md` documents the manual
Partner Center path. The remaining release-evidence gap is that CI does not
run or upload the Edge artifact, while the generated support matrix still says
Edge uses the same ZIP as Chrome and that the Edge package path is not
automated. `ROADMAP.md` now promotes a P2 item to tie Edge claims to the
generated `edge-artifacts/edge-build-<version>.json` report, distinguish
manual initial publication from optional update API automation, and keep Edge
privacy/remote-code declarations aligned with the current store forms.
External anchors: Microsoft Edge Chrome-port guidance
(`https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/port-chrome-extension`),
Microsoft Edge Add-ons publish flow
(`https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension`),
Microsoft Edge supported extension APIs
(`https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/api-support`),
and Microsoft Edge Add-ons update REST API
(`https://learn.microsoft.com/en-us/microsoft-edge/extensions/update/api/using-addons-api`).

2026-06-04 build-lane Edge evidence update: CI now runs
`npm run build:edge:check`, uploads `edge-artifacts/*`, and keeps
`npm run support:matrix:check` behind the generated Edge ZIP/report. The
support matrix no longer describes Edge as the Chrome ZIP; it reads
`edge-build-<version>.json` and records manual Partner Center publication,
deferred REST update automation, and no dedicated Edge browser smoke in CI.

2026-06-04 Cycle 11 Node toolchain-contract refresh: the repo now declares
`engines.node >=21.2.0`, and tests use Node ESM `import.meta.dirname`, but CI
still pins setup-node to `node-version: 20`, no `.nvmrc` / `.node-version` /
`.npmrc` / `packageManager` companion exists, and local npm reports
`engine-strict=false`. The existing `packageManager` / `.nvmrc` quick win is
therefore promoted into a P2 release-quality item: make CI, contributor shells,
npm engine enforcement, package-manager metadata, CWS tooling checks, and the
release runbook all consume the same Node floor.
External anchors: Node ESM `import.meta.dirname`
(`https://nodejs.org/api/esm.html#importmetadirname`), Node v21
`packageManager` / Corepack docs
(`https://nodejs.org/download/release/v21.1.0/docs/api/packages.html#packagemanager`),
npm `engines` / `engine-strict` docs
(`https://docs.npmjs.com/files/package.json/#engines`,
`https://docs.npmjs.com/cli/using-npm/config#engine-strict`), and setup-node
`node-version-file` docs (`https://github.com/actions/setup-node#usage`).

## Executive Summary

ScriptVault is a Manifest V3 Chrome userscript manager (Chrome 130+, with a parallel
Firefox 140+ port) built as an ordered concatenation of `shared/`, `modules/`, `bg/`,
and `background.core.js`, mirrored by a `src/**` TypeScript tree that is type-checked but
not yet the build authority. The product surface is large and mature: install from many
sources, `chrome.userScripts` execution with a Greasemonkey/Tampermonkey API wrapper,
a Monaco editor, cloud sync across five providers, signing/provenance primitives, and an
extensive CI/release-trust pipeline (SLSA attestation, SBOM, source ZIP, web-ext lint).
The dominant constraint remains runtime/TS mirror drift, already tracked under F-1.

The active queue (`ROADMAP.md` → Existing Planned Work) plus the PASS3 deep-audit block
(`## Research-Driven Additions`) already cover the deepest *runtime* findings (GM_xhr SSRF,
now-closed plaintext cloud sync, `@crontab` engine, unmounted dashboard modules,
dead What's New / i18n-v2). This 2026-06-03 pass therefore concentrated on the layers PASS3 did **not**
touch — dependency health, CI/supply-chain, coverage gating, settings/UX, and competitive
parity — and surfaced one then-breaking issue: a real CVE in a CI dependency.
That P0 dependency item is now closed in the build lane.

Top opportunities (one line each):

1. **[Closed 2026-06-04] CI was red on a real CVE** — `web-ext@10.2.0` → `tmp@0.2.5` → GHSA-ph9p-34f9-6g65 / CVE-2026-44705 (CVSS 7.7). `web-ext@^10.3.0` now resolves fixed `tmp@0.2.6`, and the high audit gate exits 0. (P0)
2. **[Verified] Coverage is blind** — `vitest.config.mjs` sets `all:false` with no thresholds, so the largest runtime files report no real coverage and CI has no floor. (P1)
3. **[Verified] No dependency-update automation** — 10 devDeps behind latest; the audit gate is reactive only, which is exactly how the `tmp` CVE slipped in. Add Dependabot/Renovate. (P1)
4. **[Likely] Floating Action tags in a signing/attestation pipeline** — `ci.yml` uses `@v4`/`@v1` tags while also doing SLSA attestation + SBOM; SHA-pin to protect the trusted artifact. (P1)
5. **[Closed 2026-06-04] Sync envelopes mixed shared script data with device-local state** — CloudSync/EasyCloud now upload only allowlisted user-facing per-script settings and ignore legacy local-only remote keys. (P1)
6. **[Closed 2026-06-04] Cloud sync uploaded plaintext script source** — CloudSync/EasyCloud now support optional local-passphrase v2 sync-envelope encryption while still reading legacy v1 plaintext envelopes. (P1)
7. **[Closed 2026-06-04] User-configured sync endpoints lacked the internal-host guard** — WebDAV/S3 now share preflight and post-fetch redirect guards with explicit local/private endpoint opt-in. (P1)
8. **[Closed 2026-06-04] Backup/export settings could include sync credentials** — exports/backups now redact provider credentials by default and require separate credential opt-ins. (P1)
9. **[Closed 2026-06-04] Backup ZIP/JSON intake was not resource-bounded** — import/inspect/verify/restore now use bounded archive intake before decode, parse, or registration. (P1)
10. **[Closed 2026-06-04] Firefox for Android was claimed but not smoke-tested** — `gecko_android` and Android support-matrix claims are deferred until a real device/emulator smoke exists. (P2)
11. **[Closed 2026-06-04] AMO vendored-library provenance was incomplete** — Firefox package libraries now have exact npm pins, official source/package hashes, and a provenance check. (P2)
12. **[Closed 2026-06-04] CWS remote-hosted-code review packet was missing** — `docs/cws-remote-code-compliance.md` and `npm run cws:remote-code:check` now separate allowed User Scripts/sandbox flows from forbidden extension remote logic and scan source/package inputs plus the built Chrome ZIP in CI. (P1)
13. **[Closed 2026-06-04] Edge artifact evidence was not wired into CI or support claims** — CI now builds/uploads `edge-artifacts/*`, and the support matrix validates the current Edge ZIP/report instead of claiming the Chrome ZIP is the Edge package. (P2)
14. **[Verified] Node toolchain contract drift** — `package.json` declares `engines.node >=21.2.0`, CI still runs setup-node `20`, there is no Node version file / package-manager pin / engine-strict gate, and npm treats `engines` as advisory by default. (P2)
15. **[Verified] Undocumented `sv` omnibox + keyboard commands** — shipped in `background.core.js`/`manifest.json`, surfaced nowhere in docs/help; pure discoverability loss. (P3)
16. **[Likely] No consolidated, validated Settings surface** — operator knobs (`allowInternalXhr`, `maxBackups`, sync config, experimental flags) are scattered with no defaults table or input validation. (P2)
17. **[Likely] `--omit=optional` audit exemption is unguarded** — safe only if no optional dep ships; add a reach check so the exemption can't mask a shipped-code CVE. (P2)

## Evidence Reviewed

- **Manifests / build**: `package.json`, `package-lock.json`, `manifest.json`, `manifest-firefox.json`, `esbuild.config.mjs`, `vitest.config.mjs`, `tsconfig.json`, `playwright.config.mjs`.
- **CI / release**: `.github/workflows/ci.yml` (full read), `scripts/*` (16 gate/generator scripts), `docs/dependency-audit-policy.md`, `docs/release-runbook.md`.
- **Runtime**: `background.core.js` (omnibox handler ~L5682, GM_xhr path), `modules/` (15 files incl. `internal-host-guard.js`, `storage.js`, `sync-providers.js`, `error-log.js`, `npm-resolve.js`, `quota-manager.js`), `content.js`, `pages/dashboard-*.js` (29 modules).
- **Git range**: `git log -30 --oneline` from `8526792` (planning consolidation) back through the TS-promotion and hardening waves; HEAD advanced to `4db9624 feat: show ESM dashboard badges` during this pass via concurrent work in the same tree.
- **Dependency state**: original research found `npm outdated` (10 behind), `npm audit --audit-level=moderate --omit=optional` (2 high — both `tmp` via `web-ext`), and `npm ls tmp` (→ `tmp@0.2.5`). The 2026-06-04 build-lane fix now resolves `tmp@0.2.6` through `web-ext@^10.3.0` and the high audit gate exits 0.
- **Sync state**: `src/types/script.ts` defines open-ended per-script `settings`; `src/background/cloud-sync.ts`, `src/background/core.ts`, and `src/modules/sync-easycloud.ts` serialize those settings wholesale into cloud-sync data and merge remote settings back into local scripts.
- **Sync endpoint egress**: WebDAV `test`/`upload`/`download` and S3 `test`/`upload`/`download` build URLs from `webdavUrl`/`s3Endpoint` and call `fetch`/`fetchWithTimeout`; existing `InternalHostGuard` pre/post checks are present in script-source, `@require`, provenance, GM_loadScript, and GM_xhr paths but not these provider endpoints.
- **Backup/export settings**: `exportAllScripts()` reads `SettingsManager.get()` into export data; `BackupScheduler.createBackup()` writes `global-settings.json` from `SettingsManager.get()`; backup restore and import paths call `SettingsManager.set(...)`; dashboard copy exposes an "Include ScriptVault settings" checkbox and says cloud backups can restore settings when enabled, but credential-bearing settings are not split from ordinary preferences.
- **Backup archive intake**: `importFromZip`, `BackupScheduler.importBackup`, `BackupScheduler.inspectBackup`, `BackupScheduler.verifyBackup`, and restore paths call `fflate.unzipSync(...)` on decoded archive bytes; code then converts `.user.js`, options, storage, settings, folders, and workspace entries with `strFromU8`/`JSON.parse`. Existing tests cover identity, selective restore, and metadata preservation, but not decompression amplification, file-count limits, oversized per-entry JSON, nested archives, or the install path's 5 MB code cap on backup imports.
- **Firefox Android target**: `manifest-firefox.json` declares `gecko_android.strict_min_version: 142.0`; `FIREFOX-PORT.md`, `README.md`, `docs/cross-browser-pipeline.md`, and `scripts/generate-browser-support-matrix.mjs` state Android is only a manifest validation target and that no Android device smoke is wired; `scripts/smoke-firefox-sideload.mjs` targets desktop Firefox/geckodriver only.
- **AMO vendored libraries**: `build-firefox.sh` includes `lib/acorn.min.js` and `lib/diff.min.js`; `AMO-SOURCE-README.md` describes only local library paths and generic source ZIP contents; tests pin those library inclusions but not reviewer provenance; `lib/acorn.min.js` says it was minified by jsDelivr from `acorn@8.14.1`, while `package-lock.json` currently resolves npm `acorn@8.16.0`.
- **CWS remote-code review**: `manifest.json` declares `userScripts` and limits extension-page CSP to `script-src 'self'` while sandboxing `pages/editor-sandbox.html`; `PRIVACY.md` explains externally sourced userscript execution; `docs/cws-remote-code-compliance.md` maps policy buckets; `scripts/check-cws-remote-code.mjs` scans source/package inputs and the built Chrome ZIP for forbidden remote-code execution patterns.
- **Edge artifact/support claims**: `scripts/build-edge.mjs` stages `build-edge/`, writes `edge-artifacts/scriptvault-edge-v<version>.zip`, and emits an `edge-build-<version>.json` release-readiness report; `tests/edge-build.test.js` covers the builder/report; CI now builds and uploads `edge-artifacts/*`; `scripts/generate-browser-support-matrix.mjs`, `README.md`, and `docs/cross-browser-pipeline.md` validate the current Edge report and state that Partner Center publication remains manual while REST update automation is deferred.
- **Node/toolchain contract**: `package.json:6-8` declares `engines.node >=21.2.0`, `.github/workflows/ci.yml:25-29` still uses setup-node `node-version: 20`, `.nvmrc` / `.node-version` / `.npmrc` are absent, local `npm config get engine-strict` returns `false`, `tests/audit-hardening-2026-06-04*.test.js:12` uses `import.meta.dirname`, and `scripts/check-cws-publish-tooling.mjs:40-58` still checks CWS tooling against a hard-coded Node 20 lower bound.
- **External sources**:
  - tmp advisory GHSA-ph9p-34f9-6g65 / CVE-2026-44705 (fixed in `tmp@0.2.6`, CVSS 7.7): https://github.com/advisories/GHSA-ph9p-34f9-6g65
  - web-ext 10.3.0 bundles `tmp@0.2.6` (verified via `npm view web-ext@10.3.0 dependencies.tmp`).
  - ScriptCat PR #1309 + v0.16.14 changelog moved device-related sync config to `chrome.storage.local` after cross-device sync leaked OneDrive state and OAuth prompts: https://github.com/scriptscat/scriptcat/pull/1309 and https://docs.scriptcat.org/docs/change/
  - OWASP SSRF Prevention, AWS IMDS, and Chrome extension network-request docs anchor the sync-endpoint egress guard: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html, https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-instance-metadata-service.html, https://developer.chrome.com/docs/extensions/develop/concepts/network-requests
  - OWASP Secrets Management, Google OAuth token storage best practices, and AWS IAM access-key guidance anchor the backup/export credential redaction item: https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html, https://developers.google.com/identity/protocols/oauth2/resources/best-practices, https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html
  - OWASP File Upload guidance and MITRE CWE-409 anchor the backup ZIP/JSON intake bounds item: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html and https://cwe.mitre.org/data/definitions/409.html
  - Mozilla Android compatibility/listing guidance, Firefox-for-Android development checklist/MV3 caveats, web-ext Android run workflow, Firefox `userScripts` optional-permission docs, and Android desktop-difference guidance anchor the Firefox Android smoke item: https://extensionworkshop.com/documentation/publish/version-compatibility/, https://extensionworkshop.com/documentation/develop/developing-extensions-for-firefox-for-android/, https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/, https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/userScripts, https://extensionworkshop.com/documentation/develop/differences-between-desktop-and-android-extensions/
  - Mozilla source-code submission, third-party library usage, add-on policies, and MDN publishing notes anchor the AMO vendored-library provenance item: https://extensionworkshop.com/documentation/publish/source-code-submission/, https://extensionworkshop.com/documentation/publish/third-party-library-usage/, https://extensionworkshop.com/documentation/publish/add-on-policies/, https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/What_next
  - Chrome Web Store program policies, Chrome remote-hosted-code violation guidance, and the Chrome `userScripts` API reference anchor the CWS remote-code review packet item: https://developer.chrome.com/docs/webstore/program-policies/policies, https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code, https://developer.chrome.com/docs/extensions/reference/api/userScripts
  - Microsoft Edge Chrome-port guidance, Add-ons publish flow, supported API table, and update REST API docs anchor the Edge artifact/support-matrix item: https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/port-chrome-extension, https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension, https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/api-support, https://learn.microsoft.com/en-us/microsoft-edge/extensions/update/api/using-addons-api
  - Node ESM, Node v21 package metadata/Corepack, npm engines/engine-strict, and setup-node version-file docs anchor the Node toolchain contract item: https://nodejs.org/api/esm.html#importmetadirname, https://nodejs.org/download/release/v21.1.0/docs/api/packages.html#packagemanager, https://docs.npmjs.com/files/package.json/#engines, https://docs.npmjs.com/cli/using-npm/config#engine-strict, https://github.com/actions/setup-node#usage
  - Userscript-manager landscape (Tampermonkey / Violentmonkey / ScriptCat sync, MV3, GitHub-Gist sync, granular execution control): comparison sources at extensionfixes.com and addons.mozilla.org Violentmonkey listing.
- **Unverifiable here** [Needs validation]: live MV3 runtime behavior (cross-tab GM listener fan-out, omnibox UX, settings round-trips) — no browser run performed this pass; all runtime claims are static-read [Verified] or [Likely].

## Canonical Research Map

- `ROADMAP.md` — single source of truth for planned work. `## Existing Planned Work`
  holds the active queue folded from the former `TODO.md`; `## Research-Driven Additions`
  holds the PASS3 net-new findings plus this 2026-06-03 dependency/CI/release/UX block;
  the Round 14 body below is the broad historical planning appendix.
- `RESEARCH_FEATURE_PLAN.md` — current comprehensive research-backed feature
  plan for v3.11.0; it is a companion synthesis, not the active queue.
- `COMPLETED.md` — completed-work navigator with the shipped-feature roll-up.
- `CHANGELOG.md` — canonical shipped-release ledger.
- `FIREFOX-PORT.md` — active Firefox-port session ledger (open items extracted as G-* in ROADMAP).

### Archived Planning Sources (docs/archive/)

- `docs/archive/TODO.md` — former consolidated open-work queue (folded into ROADMAP Existing Planned Work + COMPLETED Shipped Features).
- `docs/archive/RESEARCH_FEATURE_PLAN.md` — first 2026-05-24 research refresh.
- `docs/archive/RESEARCH_FEATURE_PLAN_PASS2.md` — second-pass companion (NF-1..NF-25).
- `docs/archive/RESEARCH_FEATURE_PLAN_PASS3.md` — third-pass live-runtime re-audit; source for the first Research-Driven Additions block.
- `docs/archive/iter-1-l1-*.md`, `docs/archive/iter-1-l3-*.md` — dated research-iteration logs.

## Current Product Map

- **Install**: URL, pasted code, dropped files, ZIP/JSON backup, store/discovery pages, import formats (`pages/install.*`, install-source classification, `InternalHostGuard`, bounded fetch).
- **Run**: `chrome.userScripts` + wrapper-built GM/TM API, `@match`/`@include`/regex, metadata directives, in-place `userScripts.update`, popup/context-menu one-shot, `sv` omnibox search.
- **Manage**: dashboard + popup — search, cards/table, collections, snippets, profiles, templates, scheduler, theme editor, dependency graph, heatmap, CSP/DNR helper, linter, debugger, Gist surface, side panel (note O-1: many of these dashboard modules are tested but not user-mounted).
- **Sync/backup**: WebDAV, Google Drive, Dropbox, OneDrive, EasyCloud, browser sync, Gist, scheduled backups, manual import/export (`modules/sync-providers.js`, `modules/backup-scheduler.js`).
- **Safety**: analyzer, signing/trust receipts, netlog/HAR, error log, DevTools panel, PRIVACY/CWS docs.
- **Release**: `esbuild` concat build, `build.sh`/`publish.sh`/`cws-setup.sh`, `ci.yml` with audit + 12 custom gate scripts + SLSA attestation + SBOM + Firefox/Edge packaging.

## Feature Inventory (delta from PASS3)

| Feature | Accessed via | Code | Maturity | Test/doc |
| --- | --- | --- | --- | --- |
| `sv` omnibox search | address bar `sv ` | `background.core.js:5682` | shipped | code only — **undocumented** |
| Keyboard commands | `Alt+Shift+S/D/E` | `manifest.json` commands | shipped | **undocumented**, no rebind note |
| CI audit gate | CI | `ci.yml` `npm audit --audit-level=high` | shipped | clean after `web-ext@^10.3.0` |
| Firefox Android compatibility claim | AMO / Android listing via `gecko_android` | `manifest-firefox.json`, generated support matrix | deferred | no Android claim until ADB/device smoke exists |
| AMO vendored library provenance | AMO source review | `AMO-SOURCE-README.md`, `docs/amo-vendored-libraries.md`, `build-firefox.sh`, `lib/acorn.min.js`, `lib/diff.min.js` | shipped | exact package/source/hash inventory gated |
| CWS remote-code review packet | Chrome Web Store review | `PRIVACY.md`, `docs/store-listing-copy.md`, `docs/cws-remote-code-compliance.md`, `manifest.json`, package ZIP | shipped 2026-06-04 | reviewer memo plus source/package and built-artifact remote-code scan |
| Edge package evidence | Edge Add-ons package/release | `scripts/build-edge.mjs`, `edge-artifacts/edge-build-<version>.json`, support matrix | shipped | CI builds/uploads Edge artifacts; support matrix validates the Edge report |
| Node toolchain contract | CI/contributor bootstrap/release scripts | `package.json`, `.github/workflows/ci.yml`, missing `.nvmrc` / `.node-version` / `.npmrc`, CWS tooling script | partial | `engines.node` exists, but CI/version files/package-manager pin/engine enforcement drift |
| Coverage report | `npm run test:cov` | `vitest.config.mjs` | shipped | `all:false`, **no threshold** |
| Dependency audit policy | manual | `docs/dependency-audit-policy.md` | doc only | **no bot automation** |
| Release attestation/SBOM | CI on push | `ci.yml` `actions/attest@v4` | shipped | actions **tag-pinned, not SHA** |

## Competitive Landscape

- **Tampermonkey** — polished UI, granular execution control (priority, domain blocking, per-script permissions), cloud sync, broad browser support (Chrome/FF/Edge/Safari/Opera). *Lesson*: the granular per-script execution/permission surface is the bar; ScriptVault's NF-4 per-script host scope and a real Settings panel close part of this gap. *Avoid*: closed-source telemetry posture (ScriptVault's local-first stance is a differentiator — keep it).
- **Violentmonkey** — fully open-source, minimal, low CPU/memory, GitHub-Gist + Dropbox/OneDrive/Drive/WebDAV sync, zip import/export. *Lesson*: lightweight + open is a real wedge; ScriptVault already matches sync breadth but carries far more dashboard surface (O-1) — pruning unmounted modules also wins on the "lightweight" axis. *Avoid*: lagging MV3 support (a Violentmonkey pain point) — ScriptVault is MV3-native, a clear advantage to keep advertising accurately.
- **ScriptCat** — script subscriptions (URL→JSON list), DOM-less `@background` scripts, `GM_config`/`CAT_userConfig` author config. *Lesson*: these are exactly the PASS3 NF-3/NF-6/NF-8 differentiators already on the roadmap — confirms their priority.
- **Greasemonkey / FireMonkey** — Firefox-first, simpler API. *Lesson*: the ScriptVault Firefox port (G-* group) is the relevant parity track.
- **Standards baseline** — Chrome `userScripts` MV3 API, WCAG 2.2 AA for the dashboard UI (gap matrix tracked in `docs/wcag3-gap-analysis.md`; H-1/H-2 open), CycloneDX SBOM + SLSA provenance for release trust (already implemented; SHA-pin gap noted).

## Quality & Friction Findings

- **Closed** — CI audit gate failure on `tmp` CVE-2026-44705 was resolved by the ROADMAP P0 `web-ext@^10.3.0` bump. [Verified]
- **Major** — Coverage blind (`all:false`, no threshold): the largest runtime files have no enforced coverage. → ROADMAP P1 coverage gate. [Verified]
- **Major** — No dependency-update automation; reactive audit only (root cause of the CVE slip). → ROADMAP P1 Dependabot/Renovate. [Verified]
- **Major** — Floating Action tags in an attestation/SBOM pipeline. → ROADMAP P1 SHA-pin. [Likely]
- **Closed** — AMO vendored-library provenance for minified Firefox-package libraries now has official package/source/hash inventory and a gate. [Verified]
- **Closed 2026-06-04** — CWS remote-hosted-code policy evidence is now packaged and scanned for Chrome submissions through `docs/cws-remote-code-compliance.md` and `npm run cws:remote-code:check`.
- **Moderate, closed 2026-06-04** — Edge package evidence is now wired into CI artifacts and generated support claims. → ROADMAP P2 Edge artifact/support-matrix gate. [Closed]
- **Major** — `--omit=optional` audit exemption is unguarded against shipped optional deps. → ROADMAP P2 reach check. [Likely]
- **Major** — No consolidated/validated Settings surface for operator knobs. → ROADMAP P2 settings audit. [Likely]
- **Minor** — `sv` omnibox + keyboard commands undocumented. → ROADMAP P3 doc items. [Verified]
- **Major** — Node/toolchain contract drift: `engines.node >=21.2.0` is advisory under default npm config, CI still sets up Node 20, and the repo lacks a version file/package-manager pin/engine-strict gate. → ROADMAP P2 toolchain alignment. [Verified]

## Architecture & Technical Findings

- Build authority is still concatenated runtime JS, not `src/**` (F-1 tracks convergence); this pass adds no new architectural item there — it is already the top Larger Bet.
- `vitest` runs `pool: vmThreads, maxWorkers:1` to dodge an `@exodus/bytes` ESM-in-CJS crash under jsdom on the VMware share — a real environment fragility worth noting for contributors (documented in `vitest.config.mjs`, no action needed).
- `error-log.js` and other `modules/*.js` are generated from `src/modules/*.ts` ("do not edit by hand") — confirms the TS-source direction; coverage gate (P1) should target `src/**`, consistent with that generation flow.
- Toolchain authority is split between `package.json` (`>=21.2.0`), CI (`node-version: 20`), the release runbook's Node 20 CWS note, and a CWS helper script that hard-codes Node 20+. The P2 toolchain item should collapse those into one source of truth.
- Dependency health: 10 devDeps were behind at research time. The `web-ext`/`tmp` security issue is closed; esbuild/monaco/puppeteer majors remain low-risk dev-only and should fold into the Dependabot grouped PRs rather than ad-hoc bumps.

## Security / Privacy / Data Safety

- The deepest runtime risks (GM_xhr SSRF NF-1, plaintext cloud sync NF-2, per-script scope NF-4, TOFU SRI NF-5) are already roadmapped — not re-listed.
- New: the **supply-chain/review** layer is the gap this pass surfaces — a CVE reached CI via an unpinned, un-bot-tracked dev dependency, the release pipeline that signs/attests artifacts uses floating action tags, and Chrome submissions needed a remote-hosted-code review packet plus package scan that separates allowed User Scripts/sandbox flows from forbidden extension remote logic. The P0 web-ext bump, AMO library provenance, and CWS remote-code review packet are closed; P1 Dependabot + P1 SHA-pin remain to harden the path from source to reviewed artifact.
- Privacy posture remains local-first with no usage beacon; external telemetry stays a non-goal.

## UX & Accessibility

- WCAG 2.2 AA tracking lives in `docs/wcag3-gap-analysis.md`; H-1 (help-link consistency) and H-2 (plain-language Flesch ≥60) remain open in Existing Planned Work — not duplicated.
- New UX items are discoverability (omnibox/commands docs, P3) and a validated Settings surface (P2); both complement, not duplicate, the accessibility rows.

## Explicit Non-Goals

- **External usage telemetry / analytics beacon** — rejected; conflicts with the local-first privacy posture in `PRIVACY.md`.
- **Auto-installing subscription members** — rejected; NF-6 deliberately routes new members to the pending-update inbox (consent-first), not silent install.
- **Auto-wiring every unmounted dashboard module** — rejected as a blanket action; O-1 mandates per-module triage (wire *or* delete), and the "lightweight" competitive axis favors deletion where an inline equivalent already shadows the module.
- **Bumping esbuild/monaco/puppeteer majors ad-hoc this pass** — deferred into the Dependabot grouped-PR flow to avoid an unreviewed major-version churn.

## Open Questions (genuine blockers only)

- Does any optional/peerOptional dep currently reach shipped `src/**`/`modules/**` code? The P2 reach-check assumes "no" today; this must be confirmed by the new script before relying on the `--omit=optional` exemption. [Needs validation]

## Maintenance Rule

`ROADMAP.md` is the open queue. When a research pass becomes historical-only, move it under
`docs/archive/` and update this map.
