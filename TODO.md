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
- [ ] **E-2** Sync tombstone resurrection drill test
  - Evidence: PASS2 NF-20.
  - Touches: `tests/sync-tombstone-resurrection.test.js`.
  - Acceptance: install A, delete A, sync (tombstone), wipe local, re-sync from remote → A is NOT resurrected.
- [ ] **E-3** Implement or remove README "Browser Sync" provider claim *(folded into A-1)*
- [ ] **E-4** Generate `gm-api.d.ts` ambient declarations
  - Evidence: PASS2 NF-13.
  - Touches: `scripts/generate-gm-types.mjs`, `lib/scriptvault.d.ts`, `build.sh`.
  - Acceptance: generated `.d.ts` is built into CWS ZIP; sample TS userscript typechecks.
- [ ] **E-5** Playwright E2E for install + update + restore + sync flows
  - Evidence: PASS2 NF-16; ROADMAP 10.3.
  - Touches: `tests/e2e/`, `package.json`, `.github/workflows/ci.yml`.
  - Acceptance: one Playwright spec per critical flow runs locally.
- [ ] **E-6** ESM badge in script row (R-2 from ESM roadmap)
  - Evidence: PASS2 NF-14.
  - Touches: `pages/dashboard.js` `renderScriptRow`, `pages/dashboard.css`.
- [ ] **E-7** ScriptCat-style script subscriptions (URL → JSON list)
  - Evidence: PASS2 ecosystem item 14.
  - Touches: `background.core.js`, new `modules/subscriptions.js`, dashboard import UI.
- [ ] **E-8** `navigator.storage.persist()` prompt on first non-trivial write
  - Evidence: PASS2 ecosystem item 17.
  - Touches: `modules/quota-manager.js`, `background.core.js`.

## Phase F — Larger Bets carried over

- [ ] **F-1** Continue TypeScript authoritative-source promotion until `background.core.js` is generated from TS
  - Evidence: ROADMAP Larger Bets; CLAUDE.md "TS Source Promotion" entries; 14/20 modules promoted, 6 still mirrored.
  - Acceptance: `ts-source-promotion.json` reaches 0 mirrored; `background.core.js` is generated from TS source.
- [ ] **F-2** Complete release trust pipeline (rollback rehearsal automation, CWS/AMO status checks)
  - Evidence: ROADMAP Larger Bets; partial — signatures/SBOM/source ZIP/package diff are done.
- [ ] **F-3** Local health diagnostics (other half of large-library bet)
  - Evidence: ROADMAP Larger Bets; perf harness + virtualization shipped, diagnostics half remains.
- [ ] **F-4** Sigstore `@require-provenance` implementation
  - Evidence: `docs/require-provenance-design.md`; design-complete.
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

(Append a row each time work lands.)
