# Research Report

Status: consolidated docs index plus 2026-06-03 deep research pass.

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
plaintext cloud sync, `@crontab` engine, unmounted dashboard modules, dead What's New /
i18n-v2). This 2026-06-03 pass therefore concentrated on the layers PASS3 did **not**
touch — dependency health, CI/supply-chain, coverage gating, settings/UX, and competitive
parity — and surfaced one then-breaking issue: a real CVE in a CI dependency.
That P0 dependency item is now closed in the build lane.

Top opportunities (one line each):

1. **[Closed 2026-06-04] CI was red on a real CVE** — `web-ext@10.2.0` → `tmp@0.2.5` → GHSA-ph9p-34f9-6g65 / CVE-2026-44705 (CVSS 7.7). `web-ext@^10.3.0` now resolves fixed `tmp@0.2.6`, and the high audit gate exits 0. (P0)
2. **[Verified] Coverage is blind** — `vitest.config.mjs` sets `all:false` with no thresholds, so the largest runtime files report no real coverage and CI has no floor. (P1)
3. **[Verified] No dependency-update automation** — 10 devDeps behind latest; the audit gate is reactive only, which is exactly how the `tmp` CVE slipped in. Add Dependabot/Renovate. (P1)
4. **[Likely] Floating Action tags in a signing/attestation pipeline** — `ci.yml` uses `@v4`/`@v1` tags while also doing SLSA attestation + SBOM; SHA-pin to protect the trusted artifact. (P1)
5. **[Verified] Sync envelopes mix shared script data with device-local state** — per-script `settings` are uploaded wholesale despite open-ended local/conflict/error keys; partition sync-safe settings before upload/import. (P1)
6. **[Verified] User-configured sync endpoints lack the internal-host guard** — WebDAV/S3 provider URLs are arbitrary settings and should share the same internal/private-host policy now used by GM_xhr and script-resource fetches, with explicit local endpoint opt-in. (P1)
7. **[Verified] Undocumented `sv` omnibox + keyboard commands** — shipped in `background.core.js`/`manifest.json`, surfaced nowhere in docs/help; pure discoverability loss. (P3)
8. **[Likely] No consolidated, validated Settings surface** — operator knobs (`allowInternalXhr`, `maxBackups`, sync config, experimental flags) are scattered with no defaults table or input validation. (P2)
9. **[Likely] `--omit=optional` audit exemption is unguarded** — safe only if no optional dep ships; add a reach check so the exemption can't mask a shipped-code CVE. (P2)

## Evidence Reviewed

- **Manifests / build**: `package.json`, `package-lock.json`, `manifest.json`, `manifest-firefox.json`, `esbuild.config.mjs`, `vitest.config.mjs`, `tsconfig.json`, `playwright.config.mjs`.
- **CI / release**: `.github/workflows/ci.yml` (full read), `scripts/*` (16 gate/generator scripts), `docs/dependency-audit-policy.md`, `docs/release-runbook.md`.
- **Runtime**: `background.core.js` (omnibox handler ~L5682, GM_xhr path), `modules/` (15 files incl. `internal-host-guard.js`, `storage.js`, `sync-providers.js`, `error-log.js`, `npm-resolve.js`, `quota-manager.js`), `content.js`, `pages/dashboard-*.js` (29 modules).
- **Git range**: `git log -30 --oneline` from `8526792` (planning consolidation) back through the TS-promotion and hardening waves; HEAD advanced to `4db9624 feat: show ESM dashboard badges` during this pass via concurrent work in the same tree.
- **Dependency state**: original research found `npm outdated` (10 behind), `npm audit --audit-level=moderate --omit=optional` (2 high — both `tmp` via `web-ext`), and `npm ls tmp` (→ `tmp@0.2.5`). The 2026-06-04 build-lane fix now resolves `tmp@0.2.6` through `web-ext@^10.3.0` and the high audit gate exits 0.
- **Sync state**: `src/types/script.ts` defines open-ended per-script `settings`; `src/background/cloud-sync.ts`, `src/background/core.ts`, and `src/modules/sync-easycloud.ts` serialize those settings wholesale into cloud-sync data and merge remote settings back into local scripts.
- **Sync endpoint egress**: WebDAV `test`/`upload`/`download` and S3 `test`/`upload`/`download` build URLs from `webdavUrl`/`s3Endpoint` and call `fetch`/`fetchWithTimeout`; existing `InternalHostGuard` pre/post checks are present in script-source, `@require`, provenance, GM_loadScript, and GM_xhr paths but not these provider endpoints.
- **External sources**:
  - tmp advisory GHSA-ph9p-34f9-6g65 / CVE-2026-44705 (fixed in `tmp@0.2.6`, CVSS 7.7): https://github.com/advisories/GHSA-ph9p-34f9-6g65
  - web-ext 10.3.0 bundles `tmp@0.2.6` (verified via `npm view web-ext@10.3.0 dependencies.tmp`).
  - ScriptCat PR #1309 + v0.16.14 changelog moved device-related sync config to `chrome.storage.local` after cross-device sync leaked OneDrive state and OAuth prompts: https://github.com/scriptscat/scriptcat/pull/1309 and https://docs.scriptcat.org/docs/change/
  - OWASP SSRF Prevention, AWS IMDS, and Chrome extension network-request docs anchor the sync-endpoint egress guard: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html, https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-instance-metadata-service.html, https://developer.chrome.com/docs/extensions/develop/concepts/network-requests
  - Userscript-manager landscape (Tampermonkey / Violentmonkey / ScriptCat sync, MV3, GitHub-Gist sync, granular execution control): comparison sources at extensionfixes.com and addons.mozilla.org Violentmonkey listing.
- **Unverifiable here** [Needs validation]: live MV3 runtime behavior (cross-tab GM listener fan-out, omnibox UX, settings round-trips) — no browser run performed this pass; all runtime claims are static-read [Verified] or [Likely].

## Canonical Research Map

- `ROADMAP.md` — single source of truth for planned work. `## Existing Planned Work`
  holds the active queue folded from the former `TODO.md`; `## Research-Driven Additions`
  holds the PASS3 net-new findings plus this 2026-06-03 dependency/CI/release/UX block;
  the Round 14 body below is the broad historical planning appendix.
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
- **Major** — `--omit=optional` audit exemption is unguarded against shipped optional deps. → ROADMAP P2 reach check. [Likely]
- **Major** — No consolidated/validated Settings surface for operator knobs. → ROADMAP P2 settings audit. [Likely]
- **Minor** — `sv` omnibox + keyboard commands undocumented. → ROADMAP P3 doc items. [Verified]
- **Cosmetic** — No `packageManager`/`.nvmrc` companion to the planned `engines.node`. → ROADMAP P3. [Verified]

## Architecture & Technical Findings

- Build authority is still concatenated runtime JS, not `src/**` (F-1 tracks convergence); this pass adds no new architectural item there — it is already the top Larger Bet.
- `vitest` runs `pool: vmThreads, maxWorkers:1` to dodge an `@exodus/bytes` ESM-in-CJS crash under jsdom on the VMware share — a real environment fragility worth noting for contributors (documented in `vitest.config.mjs`, no action needed).
- `error-log.js` and other `modules/*.js` are generated from `src/modules/*.ts` ("do not edit by hand") — confirms the TS-source direction; coverage gate (P1) should target `src/**`, consistent with that generation flow.
- Dependency health: 10 devDeps were behind at research time. The `web-ext`/`tmp` security issue is closed; esbuild/monaco/puppeteer majors remain low-risk dev-only and should fold into the Dependabot grouped PRs rather than ad-hoc bumps.

## Security / Privacy / Data Safety

- The deepest runtime risks (GM_xhr SSRF NF-1, plaintext cloud sync NF-2, per-script scope NF-4, TOFU SRI NF-5) are already roadmapped — not re-listed.
- New: the **supply-chain** layer is the gap this pass surfaces — a CVE reached CI via an unpinned, un-bot-tracked dev dependency, and the release pipeline that signs/attests artifacts uses floating action tags. The P0 web-ext bump is closed; P1 Dependabot + P1 SHA-pin remain to harden the path from source to attested artifact.
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

- Does I-3 (`engines.node`) land independently? If so, the P3 `packageManager`/`.nvmrc` item should be merged into it rather than committed separately. [Needs validation]
- Does any optional/peerOptional dep currently reach shipped `src/**`/`modules/**` code? The P2 reach-check assumes "no" today; this must be confirmed by the new script before relying on the `--omit=optional` exemption. [Needs validation]

## Maintenance Rule

`ROADMAP.md` is the open queue. When a research pass becomes historical-only, move it under
`docs/archive/` and update this map.
