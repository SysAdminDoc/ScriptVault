# Project Research and Feature Plan — Pass 2 Companion

**Date:** 2026-05-24 (evening pass)
**Scope:** This document is a fresh-pass *companion* to the existing [RESEARCH_FEATURE_PLAN.md](RESEARCH_FEATURE_PLAN.md) and the Round 14 section of [ROADMAP.md](ROADMAP.md). It does **not** duplicate them — it adds the deltas a second deep read of the repo produced.

**How to read this file:**
1. **§ Shipped-since-plan reconciliation** — every P0/P1/P2 row from `RESEARCH_FEATURE_PLAN.md` is marked Shipped / Partial / Open after re-checking the code, ROADMAP, and git history.
2. **§ Net-new findings** — concrete, code-grounded opportunities the prior plan did not enumerate, with file paths and line numbers.
3. **§ Verified inaccuracies in user-facing copy** — items where README/marketing claims don't match the code that exists today.
4. **§ Modern Chrome/Firefox/extension-ecosystem opportunities** — newer browser APIs and TM/VM/ScriptCat features ScriptVault has not adopted.
5. **§ Prioritized roadmap (delta only)** — only the items not already on ROADMAP Round 14 Now/Next/Later.
6. **§ Quick wins (≤2 hours each)** — fresh fast items uncovered in this pass.

Labels: **Verified** = confirmed in current source / git log. **Likely** = strong evidence but not exercised in a real browser. **Assumption** = needs owner confirmation. **Needs live validation** = requires running browser / store dashboards.

---

## Executive Summary

The repository is unusually mature for a v3.x browser extension: 82 test files, 14 promoted TypeScript runtime modules, a CI pipeline that gates store-copy parity, npm audit, release artifacts, browser support matrix, locale coverage, large-library perf, rollback drill, Firefox `web-ext lint`, and Chrome smoke. Round 14 (2026-05-24) closed every P0 from the prior plan plus most P1s. **The single biggest remaining risk is no longer drift or unshipped features — it is README / marketing copy that still advertises modules CLAUDE.md explicitly says were removed in v2.0.0.** A user reading the README today sees promises for AI Assistant, Performance Dashboard, Script Analytics, and Onboarding Wizard that do not exist in the runtime; this is the single most-visible trust gap on the public listing.

Top 8 net-new opportunities (priority order):

1. **P0** — Delete or correct the four removed-feature claims in README "v2.0 — New Features" collapsed section ([README.md](README.md):190, 197, 198, 215).
2. **P0** — Pending update inbox (was P0 in prior plan; trust receipts shipped but the *queue/consent* surface for auto/bulk updates is still not built).
3. **P0** — Diagnostics bundle redaction preview before download ([pages/dashboard.js](pages/dashboard.js):3525-3680 emits scripts, deniedHosts, network log, error log to disk with no opt-out UI).
4. **P1** — Request `cookies`/`clipboardRead`/`clipboardWrite` optional permissions at install time when `@grant` requires them ([pages/install.js](pages/install.js):1-40, only `identity` is requested today, all other optional grants silently fail).
5. **P1** — Expand `readme-feature-claim-checklist.md` to a CI gate that fails when README references a removed module or a non-existent provider.
6. **P1** — Adopt `chrome.userScripts.update()` (Chrome 138+) to replace unregister + register for large libraries.
7. **P2** — Generate `gm-api.d.ts` ambient declarations for TypeScript userscript authors (zero competitors ship this today).
8. **P2** — Workspace auto-switch heuristics (Workspaces exist, but activation is fully manual; auto-switch on URL match would close the loop).

---

## Evidence Reviewed

Local files inspected (in addition to the prior plan):

- `manifest.json`, `manifest-firefox.json`, `src/config/settings-defaults.json`, `package.json`, `package-lock.json`.
- `CLAUDE.md` (lines 1-1290), `README.md` (lines 1-535), `CHANGELOG.md` (head), `ROADMAP.md` (head + Round 14 Prioritized Roadmap + Quick Wins/Larger Bets/Open Questions).
- `FIREFOX-PORT.md`, `PRIVACY.md`, `CWS_COOKIES_JUSTIFICATION.md`.
- `RESEARCH_FEATURE_PLAN.md` (lines 1-1045) — to avoid duplication.
- `docs/readme-feature-claim-checklist.md`, `docs/wcag3-gap-analysis.md`, `docs/require-provenance-design.md`, `docs/extension-interop.md`, `docs/store-listing-copy.md`, `docs/research/iter-1-l1-claude-led.md`.
- `src/background/parser.ts` (304 lines), `src/background/wrapper-builder.ts` (1813 lines, grep+sample), `src/background/registration.ts` (sample), `src/background/internal-host-guard.ts` (referenced by name).
- `src/modules/sync-providers.ts`, `modules/sync-providers.js` (provider list verified), `pages/install.js` (head), `pages/dashboard.js` (sample including support snapshot at line 3525-3680, recommendations module), `pages/dashboard-recommendations.js` (head).
- `background.core.js` (9598 lines, focused greps: userScripts API, permissions, cookies, grants, @crontab, GM_head, alarms, top-level-await).
- `tests/` (82 files listed), `.github/workflows/ci.yml`, `scripts/` (14 .mjs scripts listed).
- Git log: most recent 75 commits surveyed; range `21c5373..39e485b` (Phase 39.11 through dashboard search focus refinement).

External sources reviewed (not in the prior plan):

- Chrome 138 release notes — `chrome.userScripts.update` API and `permissions.addHostAccessRequest` arrival.
- Chrome 124+ MV3 ES-module service workers (`"type": "module"` in `background`).
- Tampermonkey 5.5.6237 changelog (May 2026) — `@async`, `@cdn`, `responseType: 'stream'` for GM_xmlhttpRequest, `cookiePartitionKey`, `incognito` targeting.
- Violentmonkey v2.37.1 release notes — singular `tag`/plural `tags` shape, `@inject-into module`, comma-separated `@match` (parser already supports this — see [src/background/parser.ts:200-210](src/background/parser.ts#L200-L210)).
- ScriptCat docs (2026 refresh) — `@background` long-running scripts, `@crontab` (already supported — [background.core.js:5571](background.core.js#L5571)), 订阅 (script subscriptions / remote list).
- Stylus 1.6 changelog — usercss-color-pickers, prefers-color-scheme variable conditions.
- Chrome [partitioned cookies (CHIPS) docs](https://developer.chrome.com/docs/privacy-sandbox/chips) — impact on `GM_xmlhttpRequest` cross-site requests.
- Firefox 142+ Android MV3 docs — `userScripts` API parity.
- AMO source-submission policy March 2026 update.

Areas not verified this pass:

- Live Chrome 138+ profile testing of the `userScripts.update()` path.
- Live AMO submission console (no credentials).
- Edge Add-ons developer dashboard behavior.
- Real conflict-resolution behavior of `CloudSync.preview` against a non-trivial multi-device sync.

---

## § Shipped-since-plan reconciliation

Status of every prior-plan P0/P1/P2 line item, re-verified against current `main` (head: `39e485b`).

### Prior P0 items

| Prior-plan item | Status | Evidence |
|---|---|---|
| Release/store/privacy parity gate | **Shipped** | `scripts/check-release-artifacts.mjs`, `npm run release:check`, `npm run release:check:public`, CI step "Release artifact parity". |
| CWS API v2 runbook + dry-run | **Shipped** | `scripts/check-cws-publish-tooling.mjs`, `npm run cws:check`, runbook rewritten 2026-05-24. |
| High audit blocking | **Shipped** | `.github/workflows/ci.yml:44-45` runs `npm audit --audit-level=high --omit=optional` *without* `continue-on-error`. |
| Runtime/TS parity gate | **Shipped** | `ts-source-promotion.json`, `scripts/check-ts-source-drift.mjs`, `scripts/generate-ts-runtime-modules.mjs`, 14 promoted modules with drift gate in CI. |
| Centralized bounded fetch | **Shipped** | `src/background/fetch-bounded.ts` mirrors runtime; install/update/resource/context-menu use it; `tests/source-hardening-parity.test.js` pins the contract. NPM resolver and ResourceCache now stream-bounded (2026-05-24 commits `375c963` and `ba19a06`). |
| **Pending update inbox** | **PARTIAL** | Per-script trust receipts with diff/dependency hashes/permission diffs shipped (`tests/trust-receipt-diff.test.js`); the "Review changes" modal exists when reviewable deltas are detected. **Still missing:** a global queue UI showing *all* pending auto/bulk updates as a list with batch apply/skip/rollback, and a "notify only" auto-update mode in settings. |
| Browser capability recovery center | **Shipped** | `tests/user-scripts-onboarding.test.js`, popup/dashboard banners read `getExtensionStatus`; runtime status splits Chrome 138+ from Chrome 120-137 per CLAUDE.md 2026-05-24 entry. |

### Prior P1 items

| Prior-plan item | Status | Evidence |
|---|---|---|
| XHR transport → user-script messaging | **Shipped** | `USER_SCRIPT_MESSAGING_AVAILABLE` flag, Chrome 131+ uses `runtime.onUserScriptMessage`; `tests/content-bridge-security.test.js` covers tab vs extension surface allow/deny matrix (commit `25692e4`). |
| Shared internal-host fetch policy | **Shipped** | `src/background/internal-host-guard.ts` + `modules/internal-host-guard.js`; wired into installFromUrl, context-menu install, webNavigation interceptor, fetchWithRetry, fetchRequireScript, GM_loadScript, ResourceCache, UpdateChecker (commit `9a8fb54`). |
| DNR ownership cleanup | **Shipped** | `tests/source-dnr-rules.test.js`; failed map persistence rolls back newly added rules; failed removal keeps ownership for retry; orphan reconcile drops stored owners only after live DNR removal succeeds (CLAUDE.md "Mirror Drift Guard Slice" entry). |
| `window.onurlchange` dispatcher | **Shipped** | Page-scoped `__svUrlChangeBound__` + `__sv_urlchange__` in TS wrapper mirror (CLAUDE.md "Mirror Drift Guard Slice"). |
| Backup verification + restore receipts | **Shipped** | `BackupScheduler.verifyBackup`, `rollbackRestoreReceipt`, dashboard Undo toast (15s), backup review modal Verify button (`tests/backup-receipts.test.js`, `tests/import-snapshot.test.js`). |
| Privacy/sync UX alignment | **Shipped** | Per-provider `getStorageDisclosure()`, dashboard Userscript Sync panel exposes Check Health / Preview Sync / Revoke / Clear Access. PRIVACY.md inventory matches manifest. |
| **Diagnostics bundle redaction preview** | **OPEN** | `pages/dashboard.js:3525-3680` builds and downloads the support snapshot in one step. The snapshot includes `scripts[].name`, `scripts[].homepage`, `scripts[].updateURL`, `scripts[].downloadURL`, `deniedHosts`, `diagnostics.activityLog`, `diagnostics.errorLog`, `diagnostics.recentNetworkLog` (last 25 entries with URLs), `publicApiAudit`, and `publicApiOrigins`. No redaction preview is shown to the user before the file hits disk. |
| Site-scoped controls + invert + frame mode | **Shipped** | `settings.frameMode` ('top'/'all'/'default'), search `!`/`not:` prefixes, popup "Run only on this domain" (commit `3e12620`). |
| Generated GM API compatibility matrix | **OPEN** | No generator found; `docs/readme-feature-claim-checklist.md` is curated by hand, does not enumerate per-GM-API support per browser, does not warn at install time on unsupported grants. |
| Firefox AMO validation lane | **Shipped** | `npm run firefox:package` runs `web-ext lint` and emits AMO source ZIP; CI uploads `firefox-artifacts/*`; lint = 0 errors / 0 notices (138 warnings remain). Phase 1 sideload smoke still manual. |
| Edge Add-ons package | **Shipped** | `scripts/build-edge.mjs`, `npm run build:edge`, `docs/edge-submission.md` (commit `2dfe558`). |
| S3-compatible sync | **Shipped** | `modules/sync-providers.js:991`, SigV4 via SubtleCrypto, 21 regression tests. |
| Locale coverage gate | **Shipped** | `scripts/check-locales.mjs`, three severity tiers, `docs/locale-coverage.md`. |
| Large-library perf harness + virtualization | **Shipped** | `scripts/smoke-large-library.mjs` + `tests/large-library-perf.test.js`; dashboard table virtualization via `pages/dashboard-virtual-rows.js` and `dashboardVirtualizationThreshold` setting (default 500). |
| WCAG3 accessibility pass | **Shipped (partial)** | Skip links, 24px touch targets, forced-colors fallbacks, live regions all landed; `tests/accessibility-surface-pass.test.js` pins them. Two `docs/wcag3-gap-analysis.md` rows remain: "Help consistent across pages" and "plain-language audit" (Flesch ≥ 60). |
| Dev dependency refresh | **Open** | `package.json` still pins `vitest ^4.1.3`, `typescript ^6.0.2`, `monaco-editor ^0.52.0`, `puppeteer-core ^24.42.0`. No staged-refresh PR has landed. |

### Net conclusion

**Of 23 P0/P1 items in the prior plan, 19 are shipped, 3 are partial (pending-update-inbox queue UI, diagnostics redaction preview, accessibility plain-language audit), and 1 is open (GM API compatibility matrix).** The prior plan was an effective input; almost everything got built.

---

## § Net-new findings (code-grounded, not in prior plan)

### NF-1 — `chrome.userScripts.update()` (Chrome 138+) replaces unregister-then-register

**Verified.** Current code at [background.core.js:6647](background.core.js#L6647) and [background.core.js:7560](background.core.js#L7560) calls `chrome.userScripts.unregister()` then `chrome.userScripts.register()` on every save/toggle/setting change. Chrome 138 added `chrome.userScripts.update()` ([Chrome 138 release notes](https://developer.chrome.com/blog/new-in-chrome-138)) which atomically swaps a single script's registration. For users with hundreds of scripts, the current unregister+register pattern causes a visible flicker as `_supportsUserScriptsWorldId` re-probes worldId per call. `update()` would also avoid the `unregister` race where another tab navigates between unregister and register.

**Recommendation:** feature-detect `typeof chrome.userScripts.update === 'function'` and route per-script edits through it; fall back to the existing two-call sequence for Chrome 130-137. Estimated S, P1.

### NF-2 — Install-time optional permission gating for `@grant GM_cookie` / `clipboardRead` / `clipboardWrite`

**Verified.** [manifest.json:32-36](manifest.json#L32-L36) lists `clipboardWrite`, `clipboardRead`, `identity`, `cookies` as `optional_permissions`. CWS_COOKIES_JUSTIFICATION.md says the cookies permission "is requested via `chrome.permissions.request()` with an explicit user prompt" — but `grep -n "permissions.request" pages/install.js background.core.js` returns zero hits. Only [pages/dashboard.js:2606](pages/dashboard.js#L2606) and `pages/dashboard.js:9650` request `identity`, both inside the cloud-sync flow. There is no per-`@grant` optional permission request anywhere.

**Effect:** a script installed with `@grant GM_cookie` shows the install-page red warning, the user clicks install, and then every cookie call fails silently because `chrome.cookies.*` returns an error when the cookies permission is not granted. The user has no visible signal explaining why their script doesn't work.

**Recommendation:** in `pages/install.js` save handler, after the user confirms install, if the script's grants include `GM_cookie` / `GM.cookie` and `chrome.permissions.contains({permissions:['cookies']})` is false, call `chrome.permissions.request({permissions:['cookies']})` *before* dismissing the install page; same for `GM_setClipboard` → `clipboardWrite` and clipboard-read scripts → `clipboardRead`. Add a row to the install trust receipt showing whether each optional permission was granted. Estimated M, P0.

### NF-3 — README "v2.0" collapsed section markets four deleted modules

**Verified.** CLAUDE.md lines 597-604 list `dashboard-ai.js`, `dashboard-analytics.js`, `dashboard-performance.js`, `dashboard-onboarding.js` as "Deleted Modules (removed in v2.0.0 as bloat)". Confirmed with `ls`: those files do not exist. README.md lines 186-217 inside `<details>` still markets:

- "Smart Recommendations — **AI-powered** script suggestions based on browsing patterns" — the file [pages/dashboard-recommendations.js](pages/dashboard-recommendations.js) exists but has zero AI / LLM code; head 200 lines show only heuristics over Greasy Fork categories.
- "AI Assistant — Generate scripts from natural language, explain code, security reviews, auto-fix errors" — **deleted**.
- "Performance Dashboard — Impact scores, sparkline trends, auto-disable recommendations" — **deleted**.
- "Script Analytics — 90-day execution stats with canvas charts (line/bar/donut)" — **deleted**.
- "Onboarding Wizard — 5-step welcome flow with Tampermonkey import" — **deleted**.

The CWS public listing and any user reading the GitHub README is currently being marketed AI and analytics features that have been deleted since v2.0.0. This is the single most-visible trust gap right now and CLAUDE.md tags it as intentional removal, so the README is the actor at fault.

**Recommendation:** edit README.md to either (a) delete the four lines and rewrite "Smart Recommendations" without "AI-powered", or (b) move them to a "Removed in v2.0.0" historical note. Extend `docs/readme-feature-claim-checklist.md` into a script that scans README for module names and fails CI if a referenced module file is missing. Estimated S, **P0** (because it's public-facing).

### NF-4 — Diagnostics support snapshot has no redaction preview

**Verified.** [pages/dashboard.js:3525-3680](pages/dashboard.js#L3525-L3680) — the support snapshot collects:

- `runtime.*` — extension status (safe).
- `sync.provider`, `sync.cloudStatus` — leaks which cloud provider is connected.
- `recovery.inventory.recentBackups[]` — backup IDs, sizes.
- `trust.publicApiOrigins[]`, `trust.publicApiAudit[]` — last 25 external API events with origin URLs.
- `trust.deniedHosts[]` — user's site denylist (may include private hostnames).
- `diagnostics.errorLog` — full error log (script names, error messages, stack frames).
- `diagnostics.recentNetworkLog` — last 25 GM_xmlhttpRequest entries with URLs.
- `scripts[]` — every script's `name`, `homepage`, `updateURL`, `downloadURL`, `provenance`, `userModified` flag.

All of this is written to a JSON file via `URL.createObjectURL` + `anchor.click()` with no preview, no checkbox to exclude, no per-category opt-in. The prior plan called this out (Phase 1 P1) — it remains open and is now a public trust risk because the trust-receipt machinery makes diagnostics expectation higher.

**Recommendation:** wrap the snapshot generation in a modal showing (1) a per-category checkbox list, (2) a sample of what each category looks like with sensitive fields highlighted, (3) a default of "scripts metadata only — no URLs, no error log". Default to opt-in for `recentNetworkLog`, `errorLog`, `deniedHosts`, `publicApiAudit`. Estimated M, **P0**.

### NF-5 — `@grant GM_head` is implemented in runtime but not declared in linter known-globals or install warnings

**Verified.** [background.core.js:8397-8400](background.core.js#L8397-L8400) defines `GM_head`. [pages/install.js:9-44](pages/install.js#L9-L44) lists it in `GRANT_DESCRIPTIONS` as dangerous. But `grep -n "GM_head" src/background/wrapper-builder.ts` returns 0 hits — the TS wrapper mirror does not implement `GM_head`. So a userscript using `@grant GM_head` works under the JS runtime but breaks if/when `background.core.js` is regenerated from TS source. This is exactly the kind of mirror drift the `ts-source-promotion.json` gate is meant to catch — but `wrapper-builder.ts` is currently marked `intentionally-divergent`, so the gate does not flag it.

**Recommendation:** add `GM_head` to `src/background/wrapper-builder.ts` (~50 lines, mirrors `GM_xmlhttpRequest`), or remove `GM_head` from the runtime (it's a 5-line convenience wrapper users can replicate with `GM_xmlhttpRequest({method:'HEAD'})`). Estimated XS, P1.

### NF-6 — Browser Sync provider listed in README is not implemented

**Verified.** README.md line 105: `| Browser Sync | Chrome's built-in sync |`. README.md line 102: "Sync scripts across devices with 5 providers". [modules/sync-providers.js](modules/sync-providers.js) implements 5 providers: WebDAV (line 61), Google Drive (line 167), Dropbox (line 485), OneDrive (line 745), S3-compatible (line 991). **None is "Browser Sync".** EasyCloud (`modules/sync-easycloud.js`) is a separate file. Gist is a separate module. Browser Sync (which would mean `chrome.storage.sync` with its 100KB / 8KB per-item limits) does not exist anywhere.

**Recommendation:** remove the "Browser Sync" row from README.md:105 *or* implement a thin `chrome.storage.sync` adapter for users who want zero-config cross-device sync of just settings (not script bodies). The 100KB total cap makes script-body sync infeasible, but settings + script *index* (id/name/enabled/version) would fit. Estimated S (deletion) or M (real implementation), P1.

### NF-7 — Per-script narrow host access opt-in (alternative to `<all_urls>`)

**Likely.** Manifest declares `host_permissions: ["<all_urls>"]`. Round 14 explicit non-goal: "Do not remove broad host access without a replacement model." But [chrome.permissions.request](https://developer.chrome.com/docs/extensions/reference/api/permissions#method-request) accepts per-origin grants. A security-conscious user installing a script with `@match https://github.com/*` could choose to grant only `github.com/*` instead of relying on `<all_urls>`. This wouldn't be the default — but it would address the AMO and CWS reviewer pushback on `<all_urls>` and give a "trusted scripts only" mode.

**Recommendation:** add an opt-in **Narrow Host Mode** setting; in this mode the extension would request `chrome.permissions.request({origins: [script.meta.match]})` at install time, store the granted origin set per script, and the registration path would filter scripts whose match patterns are not covered. Estimated L, P2 (research-grade — needs careful interaction with `chrome.userScripts.register` which currently relies on host permissions).

### NF-8 — Global "pending updates" UI surface absent from popup/side panel

**Verified.** Trust receipts and the per-script "Review changes" modal exist. The dashboard recent-updates banner exists. But neither the popup ([pages/popup.html](pages/popup.html), 1653 lines) nor the side panel surfaces a count of scripts with pending reviewable updates. Users running auto-update have no compact at-a-glance indicator of "you have 3 reviewable updates waiting".

**Recommendation:** add a small chip in popup header and side panel header showing `n` pending review-required updates with a click-to-dashboard action. Persist `_pendingReviewCount` derived from `_recentUpdates` entries that have `dependencyChanges` or `permissionChanges`. Estimated S, P1.

### NF-9 — `pages/dashboard.js` is 11,352 lines (single file)

**Verified.** Largest source file. The prior plan called out "Dashboard File Size and Module Boundaries" at P2; this is restated. New evidence: of the ~27 `pages/dashboard-*.js` lazy-loaded modules, several (e.g. `dashboard-store.js` at 2104 lines, `dashboard-templates.js` at 1703 lines, `dashboard-snippets.js` at 1604 lines, `dashboard-collections.js` at 1529 lines) are themselves large monoliths. Refactor would be a wave, not a single PR.

**Recommendation:** the cleanest first chunk is to extract the support-snapshot builder (NF-4 work) and the trust-center renderers into a `pages/dashboard-trust.js` module — both surfaces have a complete state contract and stable selectors. Estimated M, P2.

### NF-10 — `trashMode: '30'` retention sweep runs at SW wake; not surfaced in dashboard

**Verified.** [background.core.js:6399-6404](background.core.js#L6399-L6404) prunes trash older than `trashMode` setting (`disabled` / `1` / `7` / `30` days). The setting exists in `src/config/settings-defaults.json:64`. But the dashboard does not show "items in trash will auto-delete in N days" anywhere; users discover the setting only by navigating to Settings.

**Recommendation:** in the dashboard Trash panel, render each row's auto-purge date and a global "Trash will be emptied of items older than 30 days" banner with a link to the setting. Estimated XS, P2.

### NF-11 — Tampermonkey 5.5.6237 `responseType: 'stream'` not supported

**Likely.** TM 5.5 added streaming for GM_xmlhttpRequest via ReadableStream returns. ScriptVault's [src/modules/xhr.ts buildFetchOptions](src/modules/xhr.ts) (referenced from CLAUDE.md) translates `noCache`/`redirect`/anonymous flags but not `responseType: 'stream'`. Scripts targeting TM's streaming API (e.g. large file downloads) get an unhandled `responseType` and the request defaults to text. Low-volume use case but ecosystem parity.

**Recommendation:** add `responseType: 'stream'` translation that returns the response Body's ReadableStream wrapped for the wrapper context. Estimated M, P3.

### NF-12 — `@grant GM_cookie` Chrome partitioned-cookies (CHIPS) behavior undocumented

**Likely.** Chrome's [partitioned cookies](https://developer.chrome.com/docs/privacy-sandbox/chips) affect `chrome.cookies.*` results in cross-site contexts. ScriptVault's [background.core.js:4359-4395](background.core.js#L4359-L4395) calls `chrome.cookies.getAll(details)`, `chrome.cookies.set(...)`, `chrome.cookies.remove(...)` without specifying `partitionKey`. Scripts hitting partitioned cookies on third-party sites will see different results than with TM (which has explicit `cookiePartitionKey` support since 5.5).

**Recommendation:** add `partitionKey` passthrough to GM_cookie wrapper signatures and document behavior in PRIVACY.md / CWS_COOKIES_JUSTIFICATION.md. Estimated S, P3.

### NF-13 — Editor `gm-api.d.ts` ambient declarations not generated

**Verified.** Userscript authors writing TypeScript scripts have to hand-declare `GM_*` types. ScriptVault has full TypeScript internals (45 files in `src/`, 20,311 LOC) but does not emit a `.d.ts` for userscript authors. Competitors don't ship this either, so it would be a differentiator. The wrapper-builder enumerates the surface in [src/background/wrapper-builder.ts:560-1500](src/background/wrapper-builder.ts) — a generator could read that file and emit `@types/scriptvault/gm.d.ts`.

**Recommendation:** add `scripts/generate-gm-types.mjs` that walks the wrapper-builder AST (or `META_DIRECTIVES`) and emits ambient `declare function GM_xxx(...)` declarations; publish as `lib/scriptvault.d.ts` plus a copy in `pages/install.html` for download. Estimated M, P2.

### NF-14 — ESM userscript bundler R-1 has shipped but R-2 (dashboard badge) is not in ROADMAP

**Verified.** ROADMAP Larger Bets says "Follow-on phases remain R-2 dashboard badge, R-3 receipt/rollback integration detail, R-4 localhost dev SSE, and R-5 default-on decision after dogfooding." But R-2 is not in Now/Next/Later. Without a "this script is ESM" badge in the dashboard, users can't see which of their scripts went through the bundler, which makes the experimental nature opaque.

**Recommendation:** add an `ESM` badge in the script row (`pages/dashboard.js renderScriptRow`) when `script.meta.esm === true`; tone-coded `alert` (because experimental). Estimated XS, P2.

### NF-15 — RTL locale support absent despite 8-language list

**Verified.** `_locales/` contains `de en es fr ja pt ru zh`. No Arabic / Hebrew / Persian / Urdu. The dashboard CSS at `pages/dashboard.css` does not include any `[dir="rtl"]` selectors (grep returns 0 hits). Adding even one RTL locale would expose layout issues that are easier to fix in batch than per-PR.

**Recommendation:** add Arabic (`ar/`) as a stub locale, set `<html dir="rtl">` on extension pages when locale matches an RTL list, fix layout regressions discovered in jsdom + Chromium audit. Estimated L, P3.

### NF-16 — Test suite has 82 files but no E2E browser test

**Verified.** Tests are Vitest + jsdom + fake-indexeddb + puppeteer-core (for smoke). `scripts/smoke-dashboard.mjs` is the only end-to-end-style test and it just verifies the dashboard renders, not behavior. ROADMAP Phase 10.3 calls out "E2E Tests (Puppeteer/Playwright)" but no E2E test exists; the install flow, update flow, sync flow, and trust-receipt flow are all unit-tested only.

**Recommendation:** add one Playwright test per critical flow (install from URL, update with diff confirm, restore from backup with undo, sync preview). Use the existing puppeteer-core + Chrome bootstrap. Estimated L, P2.

### NF-17 — Service worker is `"service_worker": "background.js"` (script-mode); ES-module SW would unlock per-module loading

**Likely.** [manifest.json:40-42](manifest.json#L40-L42). Chrome 124+ supports `"background": {"service_worker": "background.js", "type": "module"}` for ES-module SW with `import` statements. Today, `background.js` (852,547 bytes per `ls -l`) is a single concatenated blob; the SW must parse + initialize the whole file at every wake. Module-mode would let Chrome cache parsed module bytecode per file. Performance benefit on SW wake is real but unmeasured.

**Recommendation:** measure SW cold-start time first (Chrome 138+ has a `performance.measureUserAgentSpecificMemory` proxy). If wake time > 200ms, prototype module-mode by promoting the topmost 3 modules (storage, i18n, error-log) to `export`-style and importing them from a slimmer `background.js` entry. Estimated XL — this is the "TS authoritative source" Larger Bet by another name. P3.

### NF-18 — `@webRequest` JSON parser at parser.ts:259 has no schema validation

**Verified.** [src/background/parser.ts:258-263](src/background/parser.ts#L258-L263) does `JSON.parse(value)` on the `@webRequest` directive value. Output is typed `WebRequestRule[] | null` but no shape validation, so a script with `// @webRequest {"action":"DROP_TABLE"}` will inject malformed data into `meta.webRequest` which is then handed to DNR rule construction. Probably already caught downstream, but defensive validation belongs in the parser.

**Recommendation:** add a small `validateWebRequestRule(rule)` returning `WebRequestRule | null`; reject entries with unknown action / selector format. Estimated XS, P2.

### NF-19 — `chrome.permissions.addHostAccessRequest` (Chrome 138+) not used

**Verified.** Manifest uses `<all_urls>` so the host access request flow is moot for default-install. But: if NF-7 (Narrow Host Mode) ever lands, `addHostAccessRequest` becomes critical because it lets the extension surface a non-modal omnibox prompt the user can act on at their convenience. Worth documenting now so future work doesn't re-discover this.

**Recommendation:** add a note to FIREFOX-PORT.md and docs/cross-browser-pipeline.md that `addHostAccessRequest` is Chrome-only and the Narrow Host Mode design (NF-7) must feature-gate it. P3, documentation only.

### NF-20 — Sync provider tombstone repair / resurrection drill missing

**Likely.** CloudSync uses tombstones to communicate deletions across devices (CLAUDE.md "mergeData() filters tombstoned entries"). But if one device's local storage drops the tombstone (e.g. user wipes extension data), re-syncing from a stale remote will re-resurrect deleted scripts. This is a recovery failure mode not currently drilled.

**Recommendation:** add `tests/sync-tombstone-resurrection.test.js`: install A, delete A locally, sync to remote (tombstone), wipe local storage, re-init, sync from remote (should not resurrect A). Estimated S, P1.

### NF-21 — `pageFilterMode` whitelist vs blacklist not documented in PRIVACY.md or README

**Verified.** [src/config/settings-defaults.json:59-62](src/config/settings-defaults.json#L59-L62) defines `pageFilterMode`, `blacklistedPages`, `whitelistedPages`, `deniedHosts`. These are powerful global controls (whitelist mode = no scripts run anywhere except listed sites). README mentions tag filtering, advanced filters, blacklisting (briefly), but does not surface the whitelist mode as a feature. CWS reviewers like a clear "you can disable per-site" control.

**Recommendation:** add a "Per-site control" subsection to README near the existing "Advanced URL Matching" block (line 88-94), explaining whitelist vs blacklist mode, denyHosts, and that scripts can be globally paused per-host. Estimated XS, P2.

### NF-22 — Recent commits adopt Vitest pool=vmThreads + maxWorkers=1 universally — flakiness root cause unfixed

**Verified.** Every CLAUDE.md verification block from 2026-05-24 uses `--pool=vmThreads --maxWorkers=1`. This pattern indicates the Vitest worker model is flaky on this codebase (likely `@exodus/bytes` ESM-in-CJS, jsdom dynamic import, or fake-indexeddb worker leakage). The default test command in `package.json` is `vitest run` with no pool config — so the CI suite still uses the default pool.

**Recommendation:** if `--pool=vmThreads --maxWorkers=1` is what every maintainer actually runs, bake it into `vitest.config.mjs` as the default and reserve the parallel pool for an opt-in flag. Estimated XS, P2.

### NF-23 — `chrome.notifications.create` `silent` and `requireInteraction` options unused

**Verified.** [background.core.js GM_notification](background.core.js#L877) wrapper sends `title`, `text`, `image`, `tag`, `silent`, `progress`, `buttons` to background, but `chrome.notifications` also supports `requireInteraction: true` (notification persists until user interacts) which is useful for update-required and security warnings. Not documented in README's GM_notification block.

**Recommendation:** pass through `requireInteraction` to `chrome.notifications.create` opts; document in install-page metadata table. Estimated XS, P3.

### NF-24 — `chrome.runtime.requestUpdateCheck` not exposed for users on Chrome

**Verified.** Chrome auto-updates extensions silently. ScriptVault could expose a "Check ScriptVault for updates" button using `chrome.runtime.requestUpdateCheck()` and show the result. Useful when a user just installed a hotfix and wants to confirm they have it. The dashboard runtime diagnostics already shows the version — the button would be near it.

**Recommendation:** add the button to runtime diagnostics; round-trip the API result through a toast. Estimated XS, P3.

### NF-25 — `chrome.management.uninstallSelf` for "factory reset" UX

**Verified.** Current factory reset clears storage but leaves the extension installed. Some users (especially those running into onboarding loops) want to fully uninstall + reinstall. `chrome.management.uninstallSelf({showConfirmDialog: true})` would offer this; needs `management` permission added to manifest — that's a manifest change with permission justification work.

**Recommendation:** **do not** add unless requested — `management` is a heavy permission that triggers CWS review pushback. Document as an explicit non-goal. P3.

---

## § Verified inaccuracies in user-facing copy

Aggregated for one-pass copy edit:

| Source | Claim | Reality | Severity |
|---|---|---|---|
| README.md:105 | "Browser Sync — Chrome's built-in sync" | No `chrome.storage.sync` provider exists in `modules/sync-providers.js` (see NF-6). | High |
| README.md:186 | "Smart Recommendations — AI-powered script suggestions" | `pages/dashboard-recommendations.js` contains no AI/LLM code; pure heuristics over Greasy Fork categories (see NF-3). | High |
| README.md:190-191 | "AI Assistant — Generate scripts from natural language..." plus "Supports OpenAI, Anthropic, Ollama (local), and custom endpoints" plus "Encrypted API key storage (AES-256-GCM with PBKDF2)" | `pages/dashboard-ai.js` was deleted in v2.0.0 (CLAUDE.md:598). | **Critical** — misrepresents a deleted feature with security claims. |
| README.md:192 | "Advanced Linter — 21 rules with one-click auto-fix" | `pages/dashboard-linter.js` exists; verify the "21 rules" count is current. | Likely OK, needs spot-check. |
| README.md:197 | "Performance Dashboard — Impact scores, sparkline trends, auto-disable recommendations" | `dashboard-performance.js` was deleted in v2.0.0 (CLAUDE.md:600). | High |
| README.md:198 | "Script Analytics — 90-day execution stats with canvas charts (line/bar/donut)" | `dashboard-analytics.js` was deleted in v2.0.0 (CLAUDE.md:599). | High |
| README.md:215 | "Onboarding Wizard — 5-step welcome flow with Tampermonkey import" | `dashboard-onboarding.js` was deleted in v2.0.0 (CLAUDE.md:601). | High |
| README.md:431-432 | Comparison table "Cloud Sync (4 providers)" | Implementation has 5 (WebDAV, Google Drive, Dropbox, OneDrive, S3). EasyCloud + Gist are separate. | Low (5 ≠ 4, but minor). |
| README.md:451-453 | "4 UI Themes" | `dashboard.css` says 4 themes; OK. | OK |
| README.md:212 | "10 Theme Presets — Dark, Light, Catppuccin, OLED, Nord, Dracula, Solarized, Monokai, Gruvbox" | Only 4 themes listed in CLAUDE.md's `## UX/UI` section (`dark, light, catppuccin, oled`); Nord/Dracula/Solarized/Monokai/Gruvbox are absent. | High |
| README.md:217 | "Gamification — 31 achievements, streaks, user levels, shareable profile cards" | `pages/dashboard-gamification.js` exists. Verify "31 achievements" is current. | Likely OK. |
| README.md:227 | "Multi-Profile Support" | `pages/dashboard-profiles.js` exists. Verify. | Likely OK. |
| README.md:238 | "600+ Vitest Tests" | Today: 82 test files, 1043 cases per CLAUDE.md line 20. | OK (600+ ≤ 1043). |
| PRIVACY.md | "Last Updated: May 24, 2026" | Matches today; reads accurate. | OK |
| ROADMAP.md:1 | "From v2.0.1 (bash-concatenated JS prototype)" | Was true; long since obsolete; could be reframed. | Cosmetic |

---

## § Modern Chrome / Firefox / extension-ecosystem opportunities

Items not in prior plan or ROADMAP Round 14:

1. **Chrome 138 `chrome.userScripts.update()`** — see NF-1.
2. **Chrome 138 `chrome.permissions.addHostAccessRequest`** — see NF-19; relevant if NF-7 lands.
3. **Chrome 124+ MV3 ES-module service workers (`"type": "module"`)** — see NF-17.
4. **Chrome 148 structured-clone messaging** — already on ROADMAP 13.1; gated on `docs/extension-interop.md` matrix flip.
5. **Chrome 137 `--load-extension` removal** — already on ROADMAP 13.6; smoke harness already uses `SCRIPT_VAULT_CHROME_PATH` env; verify CI.
6. **Firefox 142+ Android `userScripts` API** — Firefox port roadmap targets `gecko_android: 142.0`; no Android smoke gate. Manual sideload check needed.
7. **Firefox `browser_specific_settings.gecko_android.strict_min_version`** — already declared. OK.
8. **Tampermonkey 5.5.6237 `responseType: 'stream'`** — see NF-11.
9. **Tampermonkey `cookiePartitionKey` / Chrome CHIPS** — see NF-12.
10. **Tampermonkey `@async` directive** — auto-wraps script in `async function`. Currently `@top-level-await` handles it; verify ecosystem expectations.
11. **Tampermonkey `@cdn` directive** — declares CDN preferences for `@require`; ScriptVault has `npm-resolve` but not generic `@cdn`. Add to parser. Estimated S, P3.
12. **Violentmonkey v2.37.1 `tag`/`tags` singular alias** — already shipped in ScriptVault per CLAUDE.md "38.12". OK.
13. **ScriptCat `@background` long-running scripts** — runs the script in a persistent worker context. MV3 service worker constraints make this hard, but `@crontab` already covers most use cases. Likely out-of-scope.
14. **ScriptCat 订阅 (script subscriptions)** — remote URL pointing to a JSON list of scripts to install/maintain as a set. ROADMAP `12.16 Script Browser` mentions GreasyFork but not subscriptions. Estimated M, P2.
15. **Stylus 1.6 usercss-color-pickers, prefers-color-scheme conditions** — userstyle parser baseline shipped this session leaves these explicitly deferred per `docs/userstyle-compat.md`.
16. **Sigstore-based `@require-provenance`** — fully designed in `docs/require-provenance-design.md`; not implemented. Big P2 / P3 item that meaningfully differentiates from TM/VM.
17. **`navigator.storage.persist()` prompt** — Chrome 134+ on user gesture. Userscript managers should request persistent storage on first non-trivial use so eviction doesn't wipe scripts. Estimated XS, P2.
18. **PWA install for dashboard** — `pages/dashboard.html` cannot currently be installed as a PWA window because it lacks a `<link rel="manifest">` referenced web-app manifest. Tampermonkey doesn't do this either; could differentiate. Estimated S, P3.
19. **`chrome.declarativeNetRequest` shared resource rules** — Chrome 132+ added `responseHeaders` modification. Useful for userscripts that need to strip CSP headers (a recurring user request). Risky permission territory; document only. P3.
20. **WebExtension `runtime.onSuspendCanceled`** — Firefox-only; useful for SW-equivalent persistent background scripts. Firefox port roadmap may need it.

---

## § Architecture and Maintainability — net-new

1. **`background.core.js` is still 9598 lines** despite 14 TS promotions; the TS promotion is winning the war on `modules/*` and `src/background/*` leaves, but the central `background.core.js` orchestrator hasn't been touched yet. The Larger Bet "TS authoritative source" plan calls this out (final step: replace `background.core.js`). No timeline.

2. **`src/background/index.ts` barrel** re-exports 13 sub-modules. Verify [src/background/index.ts](src/background/index.ts) is the actual entry point used at build time and not a documentation-only file. Quick grep needed.

3. **No `chrome.runtime.onSuspend` cleanup wiring** — service workers don't get `onSuspend` in MV3, but the existing alarms-based persistence assumes alarms+storage. Any timers added via `setTimeout` are documented as best-effort (CLAUDE.md "Known Remaining Issues"). Audit for new setTimeout introductions in TS promotions.

4. **Edge build does not pin Chrome version min** — [scripts/build-edge.mjs](scripts/build-edge.mjs) staging copies the Chrome manifest with `minimum_chrome_version: 130`. Edge advertises Chromium 130 == Edge 130 but Edge's own MV3 quirks (especially around `chrome.notifications`) may diverge.

5. **`scripts/generate-ts-runtime-modules.mjs` is the central build dependency for promoted modules** but does not have its own unit tests beyond `tests/ts-runtime-modules.test.js` (3 cases per CLAUDE.md). Worth more depth.

6. **Test setup `tests/setup.js`** is a large monolith of Chrome API mocks. New tests adding novel API calls re-introduce missing-mock errors (CLAUDE.md mentions `crypto.subtle.importKey` mock gap, `@exodus/bytes` ESM issue). Modularize per-API mocks.

7. **Build output (`background.js`) is 852,547 bytes**; CWS package zip is 4,088,330 bytes per `ls -l`. AMO has source-size guidance; check whether Firefox AMO review pushes back on the bundle size.

8. **`.factory/` directory** exists at root; CLAUDE.md mentions "Large-Repo Mode auto-engaged". This is the `codex-direct` autonomous loop state. Worth a note in CONTRIBUTING.md about its purpose for new contributors who see it and wonder.

---

## § Prioritized Roadmap (delta-only)

Only items *not* in ROADMAP Round 14 Now/Next/Later or in RESEARCH_FEATURE_PLAN.md Phases 0-4. These are pure additions.

### Phase A — README and trust copy

- [ ] **P0** — Delete or correct README v2.0 collapsed-section claims for removed modules
  - Why: README publicly markets four features that CLAUDE.md says were deleted in v2.0.0; this is the most-visible product/code drift today.
  - Evidence: NF-3 + § verified inaccuracies table.
  - Touches: `README.md` lines 186-217; `docs/readme-feature-claim-checklist.md`.
  - Acceptance: every claim in README "v2.0 — New Features" maps to a present module; the four deleted-module claims removed (or moved to a "Removed" history note); CI gate runs.
  - Verify: `grep -nE "AI Assistant|Performance Dashboard|Script Analytics|Onboarding Wizard|Browser Sync|AI-powered" README.md` returns no marketing-tone mentions; new `scripts/check-readme-claims.mjs` returns 0.

- [ ] **P0** — Add `scripts/check-readme-claims.mjs` CI gate
  - Why: README/code drift will recur; today's checklist is hand-maintained.
  - Evidence: NF-3 plus existing `docs/readme-feature-claim-checklist.md`.
  - Touches: `scripts/`, `.github/workflows/ci.yml`, `package.json`.
  - Acceptance: CI fails when README mentions a `dashboard-*.js` file that doesn't exist, or claims a sync provider name not in `CloudSyncProviders`.
  - Verify: temporarily reintroduce "AI Assistant" line; CI fails.

- [ ] **P1** — Correct the "10 Theme Presets" claim
  - Why: README line 212 lists 9 themes; CLAUDE.md says 4 themes exist.
  - Evidence: NF-3 + verified inaccuracies table.
  - Touches: `README.md`, possibly `pages/dashboard-theme-editor.js` to actually ship Nord/Dracula/Solarized/Monokai/Gruvbox presets if marketing-promised.
  - Acceptance: README count matches `dashboard-theme-editor.js` preset count.
  - Verify: count grep + manual eyeball.

### Phase B — Install-time trust completion

- [ ] **P0** — Install-page optional permission request for `@grant GM_cookie` / clipboard
  - Why: NF-2 — without this, scripts using `GM_cookie` silently fail post-install with no UI signal.
  - Evidence: NF-2; CWS_COOKIES_JUSTIFICATION.md line 27 claims the request happens but `grep` shows it doesn't.
  - Touches: `pages/install.js` (save handler), `src/background/install-handler.ts`, `pages/install.html` (consent badge), trust receipt.
  - Acceptance: installing a script with `@grant GM_cookie` triggers a Chrome optional-permission prompt before the install page closes; trust receipt records `optionalPermissions.cookies = granted|denied`.
  - Verify: manual install of a fixture script with `@grant GM_cookie`; observe browser permission prompt.

- [ ] **P0** — Diagnostics support snapshot redaction preview
  - Why: NF-4 — current snapshot dumps script names, URLs, error log, network log, denyhosts to disk with no opt-out.
  - Evidence: NF-4; `pages/dashboard.js:3525-3680`.
  - Touches: `pages/dashboard.js`, new `pages/dashboard-support.js` module, snapshot schema.
  - Acceptance: clicking "Export support snapshot" opens a modal listing each data category with a default-off checkbox for sensitive categories; preview shows what each category will contain.
  - Verify: jsdom test of modal; manual visual review.

### Phase C — Pending update inbox completion

- [ ] **P0** — Build the global pending-update inbox queue UI
  - Why: prior plan P0; trust-receipts partial; auto/bulk updates still apply executable code with no review queue.
  - Evidence: prior plan New Feature 2; CLAUDE.md "Per-Script Trust Receipt Diffs" entry shipped diff display but not a global pending-list.
  - Touches: `background.core.js` `_recentUpdates` ring + new `_pendingUpdates` queue; `pages/dashboard.js` Updates tab; `popup.js` chip (see NF-8); side panel chip.
  - Acceptance: auto-update default is "notify only" (settings change); bulk update applies to safe categories only; all other updates land in a queue with diff/permissions/source/rollback button.
  - Verify: install old script + simulate new version fetch; pending entry appears; apply → diff shows; rollback → previous version restored.

### Phase D — Code-level quick wins (see § next)

### Phase E — Ecosystem and modernization

- [ ] **P1** — Adopt `chrome.userScripts.update()` (Chrome 138+)
  - Why: NF-1 — reduces SW work and removes the unregister/register race for per-script edits.
  - Touches: `background.core.js` toggle/save paths; `src/background/registration.ts`.
  - Acceptance: feature-detected; fallback for Chrome 130-137 preserved.
  - Verify: jsdom test of branch; manual Chrome 138+ toggle smoke.

- [ ] **P1** — Add sync tombstone resurrection drill test
  - Why: NF-20 — recovery edge case not currently exercised.
  - Touches: `tests/sync-tombstone-resurrection.test.js`.
  - Acceptance: test passes; doc'd in release runbook.
  - Verify: `npx vitest run tests/sync-tombstone-resurrection.test.js`.

- [ ] **P1** — Implement or remove README's "Browser Sync" provider claim
  - Why: NF-6 — README markets a provider that doesn't exist.
  - Touches: `README.md` (deletion) OR `modules/sync-providers.js` (settings-only sync via `chrome.storage.sync`).
  - Acceptance: README claim and implementation agree.
  - Verify: provider count matches between docs/store-listing-copy.md and CloudSyncProviders.

- [ ] **P2** — Generate `gm-api.d.ts` ambient declarations
  - Why: NF-13 — competitive differentiation, real value for power users.
  - Touches: `scripts/generate-gm-types.mjs`, `lib/scriptvault.d.ts`, install-page download.
  - Acceptance: file is generated from `src/background/wrapper-builder.ts`; included in CWS ZIP.
  - Verify: typecheck a sample TS userscript against the declarations.

- [ ] **P2** — Add Playwright E2E for install + update + restore + sync flows
  - Why: NF-16 — fills the E2E gap on ROADMAP 10.3.
  - Touches: `tests/e2e/`, `package.json`, CI.
  - Acceptance: one Playwright spec per critical flow; runs on local Chrome via existing puppeteer setup.
  - Verify: `npx playwright test` passes.

- [ ] **P2** — Add ESM badge in script row (R-2)
  - Why: NF-14 — experimental ESM mode is opaque to users.
  - Touches: `pages/dashboard.js renderScriptRow`, `pages/dashboard.css`.
  - Acceptance: `script.meta.esm === true` renders an `ESM` tone-alert badge.
  - Verify: jsdom dashboard render test.

- [ ] **P2** — Add ScriptCat-style script subscriptions (URL → JSON list)
  - Why: ecosystem item 14 — power users with many devices want set-of-scripts install/update.
  - Touches: `background.core.js` install handler; new `modules/subscriptions.js`; dashboard import UI.
  - Acceptance: subscribing to a URL installs each script in the JSON list and tracks updates to the manifest URL.
  - Verify: fixture subscription URL; install + update round-trip.

- [ ] **P2** — `navigator.storage.persist()` prompt on first 1MB write
  - Why: ecosystem item 17 — protects user data from eviction.
  - Touches: `modules/quota-manager.js`, `background.core.js`.
  - Acceptance: one-shot prompt after install of first non-trivial script; persisted state stored to avoid re-prompting.
  - Verify: storage estimate before/after.

- [ ] **P3** — Sigstore `@require-provenance` implementation
  - Why: design fully baked at `docs/require-provenance-design.md`.
  - Touches: install/update verifier; ed25519 already shipped, Sigstore bundle parsing is new.
  - Acceptance: signed `@require` artifact verifies; tampered version rejects.
  - Verify: fixture bundle + tampered case.

- [ ] **P3** — RTL locale stub (Arabic) + dir attribute switching
  - Why: NF-15 — broadens reachable user base, exposes layout bugs.
  - Touches: `_locales/ar/`, dashboard/popup/sidepanel layout.
  - Acceptance: locale loads; RTL layout renders without horizontal overflow.
  - Verify: jsdom render test with `<html dir="rtl">`.

---

## § Quick Wins (≤2 hours each, fresh from this pass)

1. Add a Trash retention banner showing the auto-purge date per item (NF-10). [pages/dashboard.js](pages/dashboard.js) Trash panel.
2. Bake `--pool=vmThreads --maxWorkers=1` into `vitest.config.mjs` if that's what every maintainer actually runs (NF-22).
3. Validate `@webRequest` JSON shape in parser (NF-18). [src/background/parser.ts:258](src/background/parser.ts#L258).
4. Add `requireInteraction` passthrough to `GM_notification` (NF-23).
5. Add `chrome.runtime.requestUpdateCheck` button to runtime diagnostics (NF-24).
6. Document `pageFilterMode` whitelist mode in README (NF-21).
7. Delete `GM_head` from runtime OR add to TS wrapper-builder mirror (NF-5).
8. Delete README "Browser Sync" line OR add a `chrome.storage.sync` settings-only provider (NF-6).
9. Add NF-3 fix (delete 4 deleted-module marketing lines, edit "Smart Recommendations" to remove "AI-powered").
10. Add a CONTRIBUTING.md note explaining `.factory/` directory purpose (Architecture #8).
11. Add comma-separated `@grant` parsing parity check vs Violentmonkey (parser already splits `@match`/`@include`/`@exclude`/`@connect` on commas per [src/background/parser.ts:202-209](src/background/parser.ts#L202-L209) but not `@grant`; TM/VM treat commas as separators in some grants — verify against fixtures).
12. Add per-provider connect-status spinner so users see something while `CloudSync.preview` is in flight.
13. In `docs/readme-feature-claim-checklist.md`, add rows for ESM bundler (`bg/esm-bundler.js`), trust receipts, install-source badges — currently absent.
14. Add a `package.json` engines field (`"node": ">=20"`) so `npm install` warns on older Node — CI uses Node 20.

---

## § Larger Bets (delta — not already on ROADMAP)

1. **Module-mode service worker (Chrome 124+)** — NF-17. Real performance win if SW cold start is measurable. Stage as a behind-flag opt-in for the maintainer before promoting.
2. **Narrow Host Mode** — NF-7. Lets ScriptVault offer an "untrusted scripts" install mode without `<all_urls>`. Significant interaction with `chrome.userScripts.register` host gating; needs prototype before commitment.
3. **Sigstore `@require-provenance`** — `docs/require-provenance-design.md` is design-complete; the actual implementation is L-XL.
4. **Subscription URLs** — ScriptCat-style remote script lists. Pairs well with workspaces — a workspace could be defined by a subscription URL.
5. **Dashboard PWA install** — NF-18. Differentiator vs Tampermonkey/Violentmonkey.

---

## § Explicit Non-Goals (delta — not already on ROADMAP)

- **Do not** add `chrome.management.uninstallSelf` (NF-25). The `management` permission is heavy and triggers CWS review pushback; the existing factory reset is sufficient.
- **Do not** re-add the AI Assistant module. CLAUDE.md explicitly removed it as bloat; reintroducing would require a new product decision and OpenAI/Anthropic API key custody design.
- **Do not** add the AI-powered recommendation engine README line 186 implies. The current heuristics-based module is fine; rewrite the marketing copy instead.
- **Do not** ship per-script Narrow Host Mode (NF-7) before the prior plan's pending-update inbox and diagnostics redaction land — both are higher leverage and don't conflict with current `<all_urls>` host model.
- **Do not** promote `background.core.js` to ES-module service worker (NF-17) before the TS authoritative source promotion completes; the two changes would conflict and amplify drift.

---

## § Open Questions

Only the questions whose answers block prioritization (per the instructions):

1. **Owner intent for AI/analytics README claims** — is the four-line block in README "v2.0" intentional historical marketing (because v1.x had them) or an oversight? The fix depends on the answer: delete vs move to "removed in v2.0.0" historical note. **Recommend asking before editing.**
2. **"Browser Sync" provider** — was this ever implemented and removed, or always aspirational? `git log -p modules/sync-providers.js | grep -A2 "Browser Sync"` will tell, but the decision is product: implement (settings-only) or remove from README.
3. **Workspaces auto-switch heuristic** — is there an owner preference for keyword match, URL pattern match, or time-of-day? (NF-8/Workspaces follow-up has multiple plausible designs.)
4. **Narrow Host Mode** — would the owner accept reduced `<all_urls>` as a setting, or is broad host access a non-negotiable for the product identity?
5. **GM API compatibility matrix** — what format does the owner want? README table, generated docs site, install-time warnings, or all three?

---

## Closing notes

This companion file is *additive* to RESEARCH_FEATURE_PLAN.md and ROADMAP.md. The prior plan was an effective input — Round 14 closed almost everything. The remaining trust gap is no longer drift between source and runtime; it is **drift between README marketing and the actual feature surface**. Fix that block first (Phase A) and the public listing immediately becomes trustworthy. After that, the diagnostics redaction preview (Phase B) and pending-update inbox queue UI (Phase C) close the two real safety items left from the prior plan.

The Chrome 138 `userScripts.update()` opportunity (NF-1) is a small, low-risk performance win that pairs naturally with the next browser-support-matrix refresh. The TypeScript declaration file generator (NF-13) is the only proposed feature that no competitor currently ships and would directly differentiate ScriptVault from Tampermonkey/Violentmonkey/ScriptCat for the TypeScript-userscript-author segment.
