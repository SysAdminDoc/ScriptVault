# ScriptVault Open Work — Consolidated TODO

> **Generated 2026-05-24** as a single source of next-action items. Combines unfinished rows from:
> - [ROADMAP.md](ROADMAP.md) Round 14 (Now / Next / Later / Quick Wins / Larger Bets)
> - [RESEARCH_FEATURE_PLAN.md](RESEARCH_FEATURE_PLAN.md) Phases 0-4
> - [RESEARCH_FEATURE_PLAN_PASS2.md](RESEARCH_FEATURE_PLAN_PASS2.md) net-new findings NF-1 through NF-25
> - [docs/wcag3-gap-analysis.md](docs/wcag3-gap-analysis.md) net-new rows
> - [FIREFOX-PORT.md](FIREFOX-PORT.md) Phase 1+
> - [RESEARCH_REPORT.md](RESEARCH_REPORT.md) canonical research/planning map
>
> **Shipped items are pruned** — check those source files for completion history. Items here are the open queue only. Update the box when work lands and keep the per-row evidence pointer so reviewers can audit without re-deriving context.

---

## Phase A — README and trust copy (P0, highest user-visibility)

- [x] **A-1** Delete or correct README "v2.0" deleted-module claims (AI Assistant, Performance Dashboard, Script Analytics, Onboarding Wizard, "AI-powered" Smart Recommendations, "Browser Sync", "10 Theme Presets")
  - Evidence: PASS2 NF-3, NF-6 + verified inaccuracies table; CLAUDE.md lines 597-604 confirm deleted modules.
  - Touches: `README.md` lines 105, 186, 190-191, 197, 198, 212, 215.
  - Acceptance: every README claim maps to a present module / shipped feature; no marketing reference to a deleted file.
- [x] **A-2** Add `scripts/check-readme-claims.mjs` CI gate
  - Evidence: PASS2 NF-3 → Phase A.
  - Touches: `scripts/`, `.github/workflows/ci.yml`, `package.json`.
  - Acceptance: CI fails when README mentions a `pages/dashboard-*.js` that doesn't exist or a sync provider not in `CloudSyncProviders`.

## Phase B — Install-time trust completion (P0)

- [x] **B-1** Install-page optional permission request for `@grant GM_cookie` / clipboard (2026-05-24)
  - Evidence: PASS2 NF-2; CWS_COOKIES_JUSTIFICATION.md line 27 claim does not match code.
  - Touches: `pages/install.js` save handler, `src/background/install-handler.ts`, trust receipt schema, `tests/install-source.test.js` (or new).
  - Acceptance: install of `@grant GM_cookie` triggers Chrome optional-permission prompt before install page closes; receipt records `optionalPermissions.cookies = granted|denied`.
- [x] **B-2** Diagnostics support snapshot redaction preview (2026-05-24)
  - Evidence: PASS2 NF-4; `pages/dashboard.js:3525-3680`.
  - Touches: `pages/dashboard.js`, new `pages/dashboard-support.js`, snapshot schema.
  - Acceptance: clicking "Export support snapshot" opens a modal listing each data category with a default-off checkbox for sensitive categories; preview shows what each category contains.

## Phase C — Pending update inbox queue (P0)

- [x] **C-1** Build global pending-update inbox queue UI (2026-06-03)
  - Evidence: RESEARCH_FEATURE_PLAN.md New Feature 2 (partial); PASS2 NF-8.
  - Touches: `background.core.js` `_recentUpdates` ring + new `_pendingUpdates`; `pages/dashboard.js` Updates tab; `pages/popup.js` chip; `pages/sidepanel.js` chip.
  - Acceptance: auto-update default is "notify only" (settings change); bulk update applies to safe categories only; all other updates land in a queue with diff/permissions/source/rollback button.
  - Verification: `npm run check` (89 files / 1127 tests), `npm run ts-runtime:check`, `npm run ts-source:check`, `npm run store-copy:check`, `node --check background.js pages/dashboard.js pages/popup.js pages/sidepanel.js`.

## Phase D — Code-level small parity / drift items

- [x] **D-1** Resolve `GM_head` drift — added to TS wrapper-builder mirror (2026-05-24)
  - Evidence: PASS2 NF-5; runtime has it ([background.core.js:8397](background.core.js#L8397)); TS mirror lacks it.
  - Touches: `src/background/wrapper-builder.ts` (~50 lines).
  - Acceptance: TS mirror exposes `GM_head` matching runtime; OR `GM_head` removed from runtime + linter known-globals + install.js GRANT_DESCRIPTIONS.
- [x] **D-2** Validate `@webRequest` JSON shape in parser (2026-05-24)
  - Evidence: PASS2 NF-18; [src/background/parser.ts:258-263](src/background/parser.ts#L258-L263).
  - Touches: `src/background/parser.ts`, `tests/parser.test.js`.
  - Acceptance: malformed `@webRequest` JSON is rejected (returns `null`) with one regression test per rejection shape.
- [x] **D-3** Bake `--pool=vmThreads` into `vitest.config.mjs` as default (2026-05-24)
  - Evidence: PASS2 NF-22; every CLAUDE.md 2026-05-24 verification block uses this flag.
  - Touches: `vitest.config.mjs`.
  - Acceptance: `npm test` runs with vmThreads pool by default; CI passes without per-test pool override.
- [x] **D-4** Pass through `requireInteraction` in GM_notification wrapper (2026-05-24)
  - Evidence: PASS2 NF-23; [background.core.js GM_notification](background.core.js#L877).
  - Touches: `background.core.js`, `src/background/wrapper-builder.ts`, `tests/wrapper-dom-security.test.js` or notifications test.
  - Acceptance: `GM_notification({title, text, requireInteraction:true})` results in `chrome.notifications.create` receiving `requireInteraction:true`.
- [x] **D-5** Add Trash retention banner showing auto-purge date (2026-06-03)
  - Evidence: PASS2 NF-10; [background.core.js:6399-6404](background.core.js#L6399-L6404).
  - Touches: `pages/dashboard.js` Trash panel, dashboard CSS in `pages/dashboard.html`.
  - Acceptance: each trash row shows "Will auto-delete on <date>"; panel header has a banner summarising the policy.
  - Verification: `npm run check` (89 files / 1127 tests), `npm test -- tests/dashboard-a11y.test.js tests/dashboard-modules.test.js`, `npm run readme:check`, `node --check pages/dashboard.js`.
- [x] **D-6** Document `pageFilterMode` (whitelist / blacklist) in README (2026-05-24)
  - Evidence: PASS2 NF-21.
  - Touches: `README.md` near line 88-94.
  - Acceptance: README "Advanced URL Matching" section has a "Per-site control" subsection explaining whitelist / blacklist / deniedHosts.

## Phase E — Ecosystem and modernization

- [x] **E-1** Adopt `chrome.userScripts.update()` (Chrome 138+) with fallback (2026-05-24, saveScript + toggle migrated; other paths remain on the explicit cycle)
  - Evidence: PASS2 NF-1; [background.core.js:6647](background.core.js#L6647) and 7560.
  - Touches: `background.core.js`, `src/background/registration.ts`.
  - Acceptance: feature-detected; per-script edits use `update()` on Chrome 138+; fallback for Chrome 130-137 preserved.
- [x] **E-2** Sync tombstone resurrection drill test (2026-06-03)
  - Evidence: PASS2 NF-20.
  - Touches: `tests/source-cloud-sync.test.js`.
  - Acceptance: install A, delete A, sync (tombstone), wipe local, re-sync from remote → A is NOT resurrected.
  - Verification: `npm run check` (89 files / 1128 tests), `npm test -- tests/source-cloud-sync.test.js`, `npm run readme:check`.
- [x] **E-3** Implement or remove README "Browser Sync" provider claim *(folded into A-1; verified 2026-06-03)*
  - Verification: `rg -n "Browser Sync|browser sync" README.md` returns no README hits; `npm run readme:check`.
- [x] **E-4** Generate `gm-api.d.ts` ambient declarations (2026-06-03)
  - Evidence: PASS2 NF-13.
  - Touches: `scripts/generate-gm-types.mjs`, `lib/scriptvault.d.ts`, `build.sh`.
  - Acceptance: generated `.d.ts` is built into CWS ZIP; sample TS userscript typechecks.
  - Verification: `npm run gm-types:check`, `npm test -- tests/gm-types.test.js`, `npm run build:bg`, `npm run build`, `BASH_PATH="C:\Program Files\Git\bin\bash.exe" node scripts/run-bash.mjs build.sh`; `tar -tf ScriptVault-v3.11.0.zip` confirms `lib/scriptvault.d.ts`.
- [x] **E-5** Playwright E2E for install + update + restore + sync flows (2026-06-03)
  - Evidence: PASS2 NF-16; ROADMAP 10.3.
  - Touches: `tests/e2e/`, `package.json`, `.github/workflows/ci.yml`.
  - Acceptance: one Playwright spec per critical flow runs locally.
  - Verification: `npm run test:e2e` (4 specs passed: install, update, restore/rollback, WebDAV sync preview/upload).
- [x] **E-6** ESM badge in script row (R-2 from ESM roadmap) (2026-06-03)
  - Evidence: PASS2 NF-14.
  - Touches: `pages/dashboard.js` `renderScriptRow`, dashboard CSS in `pages/dashboard.html`.
  - Verification: `npm test -- tests/esm-dashboard-badge.test.js tests/esm-bundler.test.js`, `node --check pages/dashboard.js`, `npm run check`.
- [x] **E-7** ScriptCat-style script subscriptions (URL → JSON list) (2026-06-03)
  - Evidence: PASS2 ecosystem item 14.
  - Touches: `background.core.js`, new `modules/subscriptions.js`, dashboard import UI.
  - Verification: `npm test -- tests/subscriptions.test.js tests/pending-update-queue.test.js tests/subscriptions-dashboard.test.js tests/ts-runtime-modules.test.js`, `node --check background.core.js`, `node --check pages/dashboard.js`, `npm run build:bg`, `npm run check` (93 files / 1140 tests), `npm run readme:check`, `npm run gm-types:check`, `npm run ts-runtime:check`, `npm run ts-source:check`, `npm run store-copy:check`, `git diff --check`.
- [x] **E-8** `navigator.storage.persist()` prompt on first non-trivial write (2026-06-03)
  - Evidence: PASS2 ecosystem item 17.
  - Touches: `modules/quota-manager.js`, `background.core.js`.
  - Verification: `npm test -- tests/import-snapshot.test.js tests/runtime-import-export.test.js tests/quota-manager.test.js tests/source-ops-modules.test.js tests/storage-persistence-prompt.test.js`, `npm run build:bg`, `npm run check` (94 files / 1146 tests), `npm run readme:check`, `npm run gm-types:check`, `npm run ts-runtime:check`, `npm run ts-source:check`, `npm run store-copy:check`, `git diff --check`.

## Phase F — Larger Bets carried over

- [x] **F-1** Continue TypeScript authoritative-source promotion until `background.core.js` is generated from TS
  - Evidence: ROADMAP Larger Bets; CLAUDE.md "TS Source Promotion" entries; 23 promoted entries, 0 still mirrored, and 0 intentionally divergent runtime files.
  - Acceptance: `ts-source-promotion.json` reaches 0 mirrored; `background.core.js` is generated from TS source.
  - Progress: 2026-06-03 promoted `bg/workspaces.js` from `src/bg/workspaces.ts`; focused verification `npm test -- tests/workspaces.test.js tests/source-bg-modules.test.js tests/ts-runtime-modules.test.js tests/ts-source-drift-gate.test.js`, `node --check bg/workspaces.js`, `node --check background.js`. Promoted `bg/signing.js` from `src/bg/signing.ts`; focused verification `npm test -- tests/signing.test.js tests/source-bg-modules.test.js tests/ts-runtime-modules.test.js tests/ts-source-drift-gate.test.js`, `node --check bg/signing.js`, `node --check background.js`. Promoted `bg/esm-bundler.js` from `src/bg/esm-bundler.ts`; focused verification `npm test -- tests/esm-bundler.test.js tests/esm-csp.test.js tests/esm-bundler-generated.test.js tests/ts-runtime-modules.test.js tests/ts-source-drift-gate.test.js`, `node --check bg/esm-bundler.js`, `node --check background.js`. Promoted `modules/public-api.js` from `src/modules/public-api.ts`; focused verification `npm test -- tests/public-api.test.js tests/source-modules.test.js tests/ts-runtime-modules.test.js tests/ts-source-drift-gate.test.js`, `node --check modules/public-api.js`, `node --check background.js`. Promoted `modules/backup-scheduler.js` from `src/modules/backup-scheduler.ts`; focused verification `npm test -- tests/backup-receipts.test.js tests/backup-scheduler.test.js tests/source-backup-modules.test.js tests/ts-runtime-modules.test.js tests/ts-source-drift-gate.test.js`, `node --check modules/backup-scheduler.js`, `node --check background.js`. Promoted `modules/sync-easycloud.js` from `src/modules/sync-easycloud.ts`; focused verification `npm test -- tests/source-sync-easycloud.test.js tests/source-sync-providers.test.js tests/source-hardening-parity.test.js tests/ts-runtime-modules.test.js tests/ts-source-drift-gate.test.js`, `node --check modules/sync-easycloud.js`, `node --check background.js`. Promoted `modules/sync-providers.js` from `src/modules/sync-providers.ts`; focused verification `npm test -- tests/s3-sync-provider.test.js tests/oauth-refresh-timeout.test.js tests/source-sync-providers.test.js tests/ts-runtime-modules.test.js tests/ts-source-drift-gate.test.js`, `node --check modules/sync-providers.js`, `node --check background.js`. Promoted `background.core.js` from `src/background/core.ts`; focused verification `npm test -- tests/ts-runtime-modules.test.js tests/ts-source-drift-gate.test.js tests/fetch-bounded.test.js tests/background-cookie-url.test.js tests/background-factory-reset.test.js tests/content-bridge-security.test.js tests/import-snapshot.test.js tests/runtime-import-export.test.js tests/install-source.test.js tests/audit-hardening-2026-06.test.js tests/notification-require-interaction.test.js tests/reregister-script.test.js tests/site-frame-invert.test.js tests/storage-persistence-prompt.test.js tests/sync-cockpit.test.js tests/trust-receipt-diff.test.js tests/user-scripts-onboarding.test.js`, `node --check background.core.js`, `node --check background.js`, `npm run ts-runtime:check`, `npm run ts-source:check`.
- [x] **F-2** Complete release trust pipeline (rollback rehearsal automation, CWS/AMO status checks)
  - Evidence: ROADMAP Larger Bets; rollback drill, signatures/SBOM/source ZIP/package diff, Firefox AMO artifact checks, and optional credentialed CWS API v2 `fetchStatus` checks are wired.
  - Verification: `npm test -- tests/store-status-check.test.js tests/firefox-package.test.js`; `BASH_PATH="C:\Program Files\Git\bin\bash.exe" npm run firefox:package`; `npm run release:store-status`.
- [x] **F-3** Local health diagnostics (other half of large-library bet)
  - Evidence: ROADMAP Larger Bets; perf harness + virtualization shipped; local diagnostics now report aggregate runtime, storage, update queue, callback, and script-health warnings without script source, script names, URLs, or external beacons.
  - Verification: `npm test -- tests/local-health-report.test.js tests/support-snapshot-redaction.test.js tests/user-scripts-onboarding.test.js tests/ts-runtime-modules.test.js tests/ts-source-drift-gate.test.js`.
- [ ] **F-4** Sigstore `@require-provenance` implementation
  - Evidence: `docs/require-provenance-design.md`; design-complete.
  - Progress: 2026-06-04 Phase A parser/storage foundation shipped. `@require-provenance` and `@require-identity` persist through the main parser and public API install path; trust receipts record declaration-only provenance metadata. Bundle parser, cryptographic verification, UI, and author guide remain open.
- [ ] **F-5** Module-mode service worker (Chrome 124+ `"type":"module"` background)
  - Evidence: PASS2 NF-17.

## Phase G — Firefox port carry-over

- [ ] **G-1** Feature-flag `chrome.offscreen` for Firefox MV3
  - Evidence: FIREFOX-PORT.md Phase 1, third checkbox; `bg/analyzer.js` + `background.core.js` call `chrome.offscreen.createDocument(...)`.
- [ ] **G-2** Feature-flag `chrome.sidePanel` for Firefox MV3
  - Evidence: FIREFOX-PORT.md Phase 1, fourth checkbox.
- [ ] **G-3** Monaco editor loading path on Firefox (decide A vs B)
  - Evidence: FIREFOX-PORT.md Phase 1.
- [ ] **G-4** Build + Firefox sideload smoke (Phase 1 completion)
- [ ] **G-5** Phase 2: import-from-Chrome backup round-trip
- [ ] **G-6** Phase 3: per-provider WebDAV-only baseline + later OAuth/identity decision
- [ ] **G-7** Phase 5: AMO submission (unlisted then listed)

## Phase H — Accessibility delta (WCAG3 gap matrix open rows)

- [ ] **H-1** Help link consistency across pages
  - Evidence: `docs/wcag3-gap-analysis.md` net-new row "Help is consistent across pages".
  - Acceptance: centralized Help entry in dashboard header, consistent link from popup / sidepanel / install.
- [ ] **H-2** Plain-language audit (Flesch ≥ 60) per Phase 34.6
  - Evidence: same doc.

## Phase I — Documentation hygiene

- [ ] **I-1** Add CONTRIBUTING.md note explaining `.factory/` directory purpose
  - Evidence: PASS2 Architecture #8.
- [ ] **I-2** Expand `docs/readme-feature-claim-checklist.md` rows for ESM bundler, trust receipts, install-source badges, internal-host guard, sync cockpit, virtualized dashboard
  - Evidence: PASS2 quick-win 13.
- [ ] **I-3** Add `"engines": {"node": ">=20"}` to `package.json`
  - Evidence: PASS2 quick-win 14.

---

## Execution log

| Date | Batch | Items closed | Commit(s) |
|---|---|---|---|
| 2026-05-24 | A | A-1, A-2 | 090afa4 |
| 2026-05-24 | D | D-1, D-2, D-3, D-4, D-6 | 6a95dde |
| 2026-05-24 | B | B-1 | cc59980 |
| 2026-05-24 | E | E-1 | 4560ff9 |
| 2026-05-24 | B | B-2 | 38a6b8f |
| 2026-06-03 | C | C-1 | feat: queue script updates for review |
| 2026-06-03 | D | D-5 | feat: show trash auto-purge dates |
| 2026-06-03 | E | E-2 | test: cover sync tombstone resurrection |
| 2026-06-03 | E | E-3 | docs: close folded browser sync TODO |
| 2026-06-03 | E | E-4 | feat: generate GM ambient declarations |
| 2026-06-03 | E | E-5 | test: add Playwright E2E flows |
| 2026-06-03 | E | E-6 | feat: show ESM dashboard badges |
| 2026-06-03 | E | E-7 | feat: queue script subscriptions for review |
| 2026-06-03 | E | E-8 | feat: request persistent storage before script writes |
| 2026-06-03 | F | F-1 partial: `bg/workspaces.js` TS promotion | feat: promote workspace manager runtime |
| 2026-06-03 | F | F-1 partial: `bg/signing.js` TS promotion | feat: promote signing runtime |
| 2026-06-03 | F | F-1 partial: `bg/esm-bundler.js` TS promotion | feat: promote esm bundler runtime |
| 2026-06-03 | F | F-1 partial: `modules/public-api.js` TS promotion | feat: promote public api runtime |
| 2026-06-04 | F | F-1 partial: `modules/backup-scheduler.js` TS promotion | feat: promote backup scheduler runtime |
| 2026-06-04 | F | F-1 partial: `modules/sync-easycloud.js` TS promotion | feat: promote easycloud sync runtime |
| 2026-06-04 | F | F-1 partial: `modules/sync-providers.js` TS promotion | feat: promote cloud sync providers runtime |
| 2026-06-04 | F | F-1 complete: `background.core.js` TS bridge promotion | feat: promote background core runtime |
| 2026-06-04 | F | F-2 release trust store-status gate | feat: add release store status gate |
| 2026-06-04 | F | F-3 local health diagnostics | feat: add local health diagnostics |

(Append a row each time work lands.)
