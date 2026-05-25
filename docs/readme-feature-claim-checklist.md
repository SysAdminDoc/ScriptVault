# README feature-claim validation checklist

The ScriptVault `README.md` describes a long list of capabilities. This
checklist maps every claim to a code entry point so a maintainer can
verify the README is current after major changes. Run through the list
on each `Release vX.Y.Z` per the runbook.

Format: each row is the claim text, the file/function that backs it,
and the regression test that pins it.

## Core engine

| Claim                                                | Entry point                                                                       | Pinned by                                          |
| ---------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------- |
| Manifest V3 with `chrome.userScripts`                | `background.core.js` → `registerScript`, `src/background/registration.ts`         | `tests/url-matcher.test.js`, smoke build           |
| Per-script worldId isolation (Chrome 133+)           | `background.core.js` → `_supportsUserScriptsWorldId`, `configureWorld`            | `tests/core-flows.test.js`                         |
| GM_* API surface (135+ actions)                      | `background.core.js` → `buildWrappedScript`, `src/background/wrapper-builder.ts`  | `tests/wrapper-dom-security.test.js`, `wrapper-gm-tabs-39-13.test.js` |
| Static AST analyzer (31 detectors)                   | `bg/analyzer.js`, `offscreen.js`                                                  | `tests/analyzer.test.js`, `analyzer-ast-detectors.test.js` |
| Ed25519 script signing                               | `bg/signing.js`                                                                   | `tests/signing.test.js`                            |

## Storage + persistence

| Claim                                                | Entry point                                                                       | Pinned by                                          |
| ---------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------- |
| IndexedDB-backed scripts/values/stats                | `modules/storage.js`, `src/storage/*`                                             | `tests/storage.test.js`, `storage-roundtrip.test.js` |
| Per-script `versionHistory` (max 5)                  | `background.core.js` → `applyUpdate`, `installFromCode`                           | `tests/core-flows.test.js`                         |
| Trash mode (`disabled` / `1` / `7` / `30` days)      | `background.core.js` `deleteScript` / `getTrash` / `restoreFromTrash`             | `tests/storage.test.js`                            |
| Restore receipts + rollback                          | `modules/backup-scheduler.js`, `background.core.js`                               | `tests/backup-receipts.test.js`                    |
| Backup verification                                  | `BackupScheduler.verifyBackup`                                                    | `tests/backup-receipts.test.js`                    |

## Sync providers

| Claim                                                | Entry point                                                                       | Pinned by                                          |
| ---------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------- |
| WebDAV                                               | `modules/sync-providers.js` `CloudSyncProviders.webdav`                           | `tests/source-sync-providers.test.js`              |
| Google Drive (PKCE)                                  | `modules/sync-providers.js` `CloudSyncProviders.googledrive`                      | `tests/oauth-refresh-timeout.test.js`              |
| Dropbox (PKCE)                                       | `modules/sync-providers.js` `CloudSyncProviders.dropbox`                          | `tests/oauth-refresh-timeout.test.js`              |
| OneDrive (PKCE)                                      | `modules/sync-providers.js` `CloudSyncProviders.onedrive`                         | `tests/oauth-refresh-timeout.test.js`              |
| Easy Cloud (chrome.identity)                         | `modules/sync-easycloud.js`                                                       | `tests/source-sync-easycloud.test.js`              |
| S3-compatible (AWS / R2 / MinIO / B2)                | `modules/sync-providers.js` `CloudSyncProviders.s3`                               | `tests/s3-sync-provider.test.js`                   |
| Health, dry-run preview, revoke / clear              | `CloudSync.preview`, `getStatus`, `disconnect` across all providers               | `tests/sync-cockpit.test.js`                       |

## Cross-browser

| Claim                                                | Entry point                                                                       | Pinned by                                          |
| ---------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------- |
| Chrome MV3 build (`npm run build`)                   | `esbuild.config.mjs`, `build.sh`                                                  | `tests/firefox-package.test.js` (build only)       |
| Firefox MV3 build (`npm run firefox:package`)        | `build-firefox.sh`, `manifest-firefox.json`                                       | CI `firefox:package` step                          |
| Edge Add-ons build (`npm run build:edge`)            | `scripts/build-edge.mjs`                                                          | `tests/edge-build.test.js`                         |
| Browser support matrix                                | `scripts/generate-browser-support-matrix.mjs`                                     | `npm run support:matrix:check`                     |

## UX surfaces

| Claim                                                | Entry point                                                                       | Pinned by                                          |
| ---------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------- |
| Monaco editor (v0.52.2, sandboxed iframe)            | `pages/editor-sandbox.html`, `pages/monaco-adapter.js`                            | `tests/search-corpus-history.test.js`              |
| Editor find-widget search history (FIFO 20)          | `pages/monaco-adapter.js` `FIND_HISTORY_KEY`                                      | `tests/search-corpus-history.test.js`              |
| Dashboard search corpus (URL/tags/grants/source/date) | `pages/dashboard.js` `buildScriptSearchCorpus`                                    | `tests/search-corpus-history.test.js`              |
| Search invert (`!`, `not:`)                          | `pages/dashboard.js` `getFilteredScripts`                                         | `tests/site-frame-invert.test.js`                  |
| Site-scoped controls (popup whitelist toggle)         | `pages/popup.js` `btnWhitelistDomain`                                             | `tests/site-frame-invert.test.js`                  |
| Per-script frame-mode override                       | `background.core.js` `script.settings?.frameMode`                                 | `tests/site-frame-invert.test.js`                  |
| Install-source trust badges                          | `shared/utils.js` `classifyInstallSource`                                         | `tests/install-source.test.js`                     |
| WCAG 2.1 AA accessibility surface                    | `pages/dashboard.html`, `pages/dashboard-a11y.js`                                 | `tests/accessibility-surface-pass.test.js`         |

## Testing + CI gates

| Claim                                                | Entry point                                                                       | Pinned by                                          |
| ---------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------- |
| Large-library perf gate (1k vitest + 10k smoke)      | `scripts/smoke-large-library.mjs`, `tests/large-library-perf.test.js`             | `npm run smoke:large-library:check`                |
| Locale coverage gate                                  | `scripts/check-locales.mjs`                                                       | `npm run locale:check:gate`                        |
| Release artifact parity gate                          | `scripts/check-release-artifacts.mjs`                                             | `npm run release:check` / `:public`                |
| Storage rollback drill                                | `tests/storage-rollback-drill.test.js`                                            | `npm run release:rollback-drill`                   |
| CWS publish tooling gate                              | `scripts/check-cws-publish-tooling.mjs`                                           | `npm run cws:check`                                |
| Store permission-copy parity                          | `scripts/check-permission-copy.mjs`                                               | `npm run store-copy:check`                         |
| README claim parity (no deleted modules, no missing providers/files) | `scripts/check-readme-claims.mjs`                                | `npm run readme:check`                             |
| Userstyle parser baseline                             | `modules/userstyles.js` `parseUserCSS`                                            | `tests/userstyle-compat-fixtures.test.js`          |

## Recent shipped features

| Claim                                                | Entry point                                                                       | Pinned by                                          |
| ---------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------- |
| ESM userscript bundler (off-by-default, R-1)         | `bg/esm-bundler.js`, `src/bg/esm-bundler.ts`                                      | `tests/esm-bundler.test.js`, `tests/esm-csp.test.js` |
| Per-install/update trust receipts with diff          | `background.core.js` `createScriptTrustReceipt`, `src/background/trust-receipt.ts` | `tests/trust-receipt.test.js`, `tests/trust-receipt-diff.test.js` |
| Internal-host fetch guard (loopback/RFC1918/CGNAT/IPv6 ULA) | `modules/internal-host-guard.js`, `src/background/internal-host-guard.ts`  | `tests/internal-host-guard.test.js`                |
| Sync cockpit (health, preview, revoke)                | `CloudSync.preview`, per-provider `getStatus`/`getStorageDisclosure`/`disconnect` | `tests/sync-cockpit.test.js`                       |
| Dashboard table virtualization                        | `pages/dashboard-virtual-rows.js`, `dashboardVirtualizationThreshold` setting     | `tests/dashboard-virtual-rows.test.js`             |
| Bounded streaming reads (5 MB cap) for install/update/`@require`/`@resource`/npm CDN | `src/background/fetch-bounded.ts`, `modules/internal-host-guard.js`, `modules/resources.js`, `modules/npm-resolve.js` | `tests/fetch-bounded.test.js`, `tests/source-hardening-parity.test.js`, `tests/resources.test.js`, `tests/npm-resolve.test.js` |
| CSV export formula-injection defang                   | `pages/dashboard.js buildStatsCSV`, `pages/dashboard-csp.js`, `modules/error-log.js` | `tests/csv-export-formula.test.js`                 |
| Restore receipts + undoable imports                   | `BackupScheduler.restoreBackup`/`rollbackRestoreReceipt`/`recordReceipt`          | `tests/backup-receipts.test.js`, `tests/import-snapshot.test.js` |

## How to use this checklist

1. On every Release vX.Y.Z pass: open `README.md`, read each top-level
   feature claim, and confirm the matching row above still points at
   live code. If the README claims something that isn't in this table,
   either add the row or remove the claim.
2. When a feature is removed from the runtime, also remove its row here
   AND its README mention in the same PR. Stale claims mislead users.
3. When a new feature ships, add a row before merging. The CI gate is
   informal today; the table is the source of truth.
