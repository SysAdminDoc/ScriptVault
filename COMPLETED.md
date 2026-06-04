# Completed Work

Status: consolidated docs index refreshed on 2026-06-01.

Items consolidated from legacy planning documents on 2026-06-03.

`CHANGELOG.md` remains the canonical shipped-release ledger. This file is a
root-level navigator for completed planning work.

## Current Shipped Baseline

- `v3.11.0` is the shipped baseline recorded in `manifest.json` and
  `package.json`.
- `main` contains additional unreleased 2026-05-24 hardening/release commits,
  including release artifact reconciliation, CWS runbook and audit-gate
  alignment, Chrome userScripts diagnostics, Firefox AMO validation packaging,
  and permission/store-copy drift checks.
- Active open work is tracked in `ROADMAP.md` (single source of truth) and the
  Firefox port ledger in `FIREFOX-PORT.md`.

## Completed Research / Planning Closures

- Shipped items are pruned from the open queue; completion history stays in
  `CHANGELOG.md`, `ROADMAP.md`, and the archived research-feature plans under
  `docs/archive/`.
- `RESEARCH_REPORT.md` maps the research and planning files so future sessions
  can find the active queue without flattening historical evidence.

## Shipped Features

Folded from the consolidated open-work queue (formerly `TODO.md`, now
`docs/archive/TODO.md`). Each item was closed and verified per its source
phase.

- [x] A-1 Delete or correct README "v2.0" deleted-module claims (AI Assistant, Performance Dashboard, Script Analytics, Onboarding Wizard, "AI-powered" Smart Recommendations, "Browser Sync", "10 Theme Presets") — *Source: docs/archive/TODO.md Phase A; commit 090afa4*
- [x] A-2 Add `scripts/check-readme-claims.mjs` CI gate (fails when README mentions a missing `pages/dashboard-*.js` or an absent sync provider) — *Source: docs/archive/TODO.md Phase A; commit 090afa4*
- [x] B-1 Install-page optional permission request for `@grant GM_cookie` / clipboard; receipt records `optionalPermissions.cookies` — *Source: docs/archive/TODO.md Phase B; commit cc59980*
- [x] B-2 Diagnostics support snapshot redaction preview (per-category default-off checkboxes) — *Source: docs/archive/TODO.md Phase B; commit 38a6b8f*
- [x] C-1 Global pending-update inbox queue UI (auto-update default "notify only"; bulk update safe categories only; diff/permissions/source/rollback per row) — *Source: docs/archive/TODO.md Phase C; commit 672c28e*
- [x] D-1 Resolve `GM_head` drift — added to TS wrapper-builder mirror — *Source: docs/archive/TODO.md Phase D; commit 6a95dde*
- [x] D-2 Validate `@webRequest` JSON shape in parser (malformed rejected → `null`, one regression test per shape) — *Source: docs/archive/TODO.md Phase D; commit 6a95dde*
- [x] D-3 Bake `--pool=vmThreads` into `vitest.config.mjs` as default — *Source: docs/archive/TODO.md Phase D; commit 6a95dde*
- [x] D-4 Pass through `requireInteraction` in `GM_notification` wrapper — *Source: docs/archive/TODO.md Phase D; commit 6a95dde*
- [x] D-5 Trash retention banner showing auto-purge date per row — *Source: docs/archive/TODO.md Phase D; commit 22e91c2*
- [x] D-6 Document `pageFilterMode` (whitelist / blacklist / deniedHosts) in README — *Source: docs/archive/TODO.md Phase D; commit 6a95dde*
- [x] E-1 Adopt `chrome.userScripts.update()` (Chrome 138+) with fallback for Chrome 130-137 (saveScript + toggle migrated) — *Source: docs/archive/TODO.md Phase E; commit 4560ff9*
- [x] E-2 Sync tombstone resurrection drill test (deleted script not resurrected on re-sync) — *Source: docs/archive/TODO.md Phase E; commit f5bc152*
- [x] E-3 Implement or remove README "Browser Sync" provider claim (folded into A-1; verified) — *Source: docs/archive/TODO.md Phase E; commit b917de8*
- [x] E-4 Generate `gm-api.d.ts` ambient declarations built into the CWS ZIP — *Source: docs/archive/TODO.md Phase E; commit 4bf700e*
- [x] E-5 Playwright E2E for install + update + restore + sync flows (4 specs) — *Source: docs/archive/TODO.md Phase E; commit 793c585*
- [x] E-6 ESM badge in dashboard script rows for `@module 1`, `@inject-into module`, and stored ESM bundle metadata — *Source: docs/archive/TODO.md Phase E + PASS3 EI-5; commit feat: show ESM dashboard badges*
- [x] E-7 Script subscriptions (URL -> JSON list) authored from TypeScript, fetched through InternalHostGuard/_fetchTextBounded, and queued as review-only pending installs — *Source: docs/archive/TODO.md Phase E + PASS3 NF-6; commit feat: queue script subscriptions for review*
- [x] E-8 `navigator.storage.persist()` requested once before meaningful script-data writes, with status recorded and writes left non-blocking — *Source: docs/archive/TODO.md Phase E; commit feat: request persistent storage before script writes*
- [x] F-1 TypeScript authoritative-source promotion complete for runtime artifacts: `background.core.js` is generated from `src/background/core.ts`, and the promotion gate reports 23 promoted entries, 0 mirrored entries, and 0 intentionally divergent runtime files — *Source: docs/archive/TODO.md Phase F; commit feat: promote background core runtime*
- [x] F-2 Release trust pipeline status gate: rollback/trust/status command wiring, Firefox AMO lint/package evidence, and optional credentialed CWS API v2 `fetchStatus` checks now run through `npm run release:store-status` — *Source: docs/archive/TODO.md Phase F; commit feat: add release store status gate*
- [x] F-3 Local health diagnostics summarize runtime setup, storage pressure, pending update queues, callback-map pressure, and script health warnings for support snapshots without script source, script names, URLs, or external beacons — *Source: docs/archive/TODO.md Phase F; commit feat: add local health diagnostics*

## Stale / Obsolete Items

- [STALE] README "v2.0" marketing claims for deleted modules — AI Assistant, Performance Dashboard, Script Analytics, Onboarding Wizard, "AI-powered" Smart Recommendations, "Browser Sync", "10 Theme Presets". Reason: the backing modules were removed from the codebase; the claims were corrected/removed under A-1/E-3 and are pinned by the `check-readme-claims.mjs` CI gate. *Source: docs/archive/RESEARCH_FEATURE_PLAN_PASS2.md NF-3/NF-6; docs/archive/TODO.md Phase A.*
