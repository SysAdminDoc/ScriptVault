# Project Research and Feature Plan

> **Pass 3** — Companion to `RESEARCH_FEATURE_PLAN.md` and `RESEARCH_FEATURE_PLAN_PASS2.md` (mostly shipped) and the open `TODO.md` queue (E-2…I-3, F-1…G-7, N-*). This pass focuses on (a) sharpened specs for OPEN queue items, (b) genuinely net-new features grounded in six domain-finder investigations of the live v3.11.0 tree, and (c) competitive gaps. Claims preserve finder `file:line` citations and Verified / Likely / Assumption labels. Shipped content from prior passes is not re-listed. Where a finding sharpens an existing TODO item the item ID is cross-referenced; everything else is marked **NET-NEW**.

---

## Executive Summary

ScriptVault is a mature, heavily-audited Chrome MV3 userscript manager (v3.11.0, ~22.9k-line built `background.js`, 89 test files, 14/22 TS modules promoted). The product is at or above Tampermonkey/Violentmonkey/ScriptCat on raw GM-API breadth, sync-provider count, trust receipts, and Chrome-138 graceful degradation. The remaining gaps are concentrated and high-value: a **security asymmetry where `GM_xmlhttpRequest` performs no internal-host/SSRF guard** (while `GM_loadScript` 50 lines above does both pre- and post-fetch checks), a **large tranche of dashboard feature modules that ship to every user but are never mounted** (~760 KB of unreachable/duplicated UI JS), **cloud sync that is not end-to-end encrypted and silently re-executes attacker-influenced remote code on apply**, and several advertised features (i18n, What's New, `@crontab`, `@antifeature` labels) that are quietly broken or stubbed. None of these are novelty problems — they are trust, reliability, data-safety, and product-integrity problems, which is exactly where this pass concentrates.

**Top opportunities in priority order:**

1. **P0 — Wire `InternalHostGuard` into `GM_xmlhttpRequest` + re-classify followed redirects** (SSRF to IMDS/localhost/RFC1918; the single highest-severity remaining issue).
2. **P0 — Danger-style destructive confirmations** (Factory Reset / Empty Trash get a green, auto-focused "Confirm"; a stray Enter wipes the entire vault with no undo).
3. **P1 — `navigator.storage.persist()` on first write** (since v3.0.0 all scripts/values/backups live in IndexedDB, which Chrome can evict under pressure → silent total data loss; ~10-line fix).
4. **P1 — Module-reachability triage + CI gate** (19 dashboard modules + the 39 KB i18n table are dead code; either wire or delete, then gate so it can't regress).
5. **P1 — Optional E2E encryption + signed-only enforcement on cloud sync** (providers see all script source in cleartext; sync is an unauthenticated remote-code-push channel into the runtime).
6. **P1 — Playwright E2E for install/update-queue/restore-undo** (zero end-to-end coverage today; the `dashboard-chains` wrong-storage-key bug lived silently from v2.0.0 to Round 10).
7. **P1 — Fix the `@crontab` parser correctness bug** (everything except `*/N`, hourly, daily silently falls back to 60 min — an advertised automation feature quietly diverges from real cron).
8. **P1 — Per-script host scope for GM_xhr/GM_cookie/GM_download/GM_webRequest** (every enabled script effectively wields the extension's full `<all_urls>` reach; least-privilege is the umbrella fix for the SSRF/cookie/DNR class).
9. **P1 — Refresh stale What's New + structured `@antifeature` parsing** (What's New shows nothing on any v3.x update; antifeature descriptions are swallowed so the install consent label lookup fails).
10. **P1 — Light-theme muted-text contrast (current WCAG 2.2 AA failure) + cross-surface Help + readability gate** (closes open H-1/H-2 with CI guards).

---

## Evidence Reviewed

- **Runtime / GM bridge:** `background.core.js` (9,965 lines per architecture finder; CLAUDE.md's "~6,146" is stale) — GM_xhr case (`:3832-4090`), GM_loadScript (`:3790-3819`, **confirmed read**: pre-flight `classifyFetchUrl` `:3797` + post-fetch `classifyResponseUrl` `:3808`), `evaluateConnectPolicy` (`:2271-2298`, `*`/empty == allow-all at `:2280`), GM_cookie (`:4617-4668`), GM_download (`:4178-4237`), `parseCronToMinutes` (`:5849-5871`), `handleMessage` 247-case switch (`:2317-4979`).
- **Dashboard mount/reachability:** `pages/dashboard.js` (11,774 lines), `pages/dashboard-lazy-loader.js`, 28 `dashboard-*.js` modules. `safeInit` called 7× (`:1797-1878`); `initOnDemandModule` defined (`:1935`) but never called; inline snippets (`:9114`), inline templates (`:7337`), inline diff (`:6489`).
- **Dead/stale surfaces (confirmed read):** `pages/dashboard-whatsnew.js:11` — `CHANGELOG` tops out at `2.0.2`/`2.0.0` against manifest `3.11.0` → `show()` resolves `undefined` and silently returns; `pages/dashboard-i18n-v2.js` (`I18nV2` referenced nowhere; 0 `data-i18n` attributes in `dashboard.html`).
- **Storage engine:** `src/storage/{idb,transaction,script-db,migration-v3}.ts`, `src/modules/storage.ts`. `BackupsDAO`/`StatsDAO` exported, zero callers. No direct unit tests for idb/transaction/script-db.
- **Sync/crypto:** `modules/sync-providers.js` (`:48` disclosure "does not add a second encryption layer"; `:82-95` WebDAV plaintext `JSON.stringify`), `src/background/cloud-sync.ts` (`:214-237` envelope, `:459-477` apply/re-register, `:404-536` merge/tombstones), `modules/sync-easycloud.js:142`.
- **Trust/provenance:** `src/background/resource-loader.ts:139-151` (SRI pass-when-absent), `src/background/trust-receipt.ts:76-136` (per-`@require` SHA-256 already computed + diffed, display-only), `bg/signing.js:70-124` (verify advisory), `src/background/dnr-rules.ts:154-259` (GM_webRequest header rules, unscoped urlFilter).
- **Parser/competitive:** `src/background/parser.ts` (`:84,110,216` antifeature swallow; `:342` `meta.esm`), `pages/install.js:1037-1042` (`afLabels` 3 of 6), UserStyles variable editor (`src/modules/userstyles.ts`), `modules/npm-resolve.js` (built, unwired per CLAUDE.md 2026-06-02).
- **UX/A11y:** `pages/dashboard.js` (`showConfirmModal` `:8516`, `showModal` auto-focus `.btn-primary` `:8490`, `showToast` double-announce `:8283-8317`, factory reset `:9682`, empty state `:5098`), `pages/dashboard-a11y.js` (`announce` `:551`, skip link `:183`), `pages/dashboard-theme-editor.js` (`:85` light `--text-muted:#999`, `:163` solarized), `pages/sidepanel.js` (`:194,395-531`), `pages/popup.js:386-409`, `pages/install.js:284-383`.
- **Open-queue/Firefox:** `TODO.md`, `ROADMAP.md`, `FIREFOX-PORT.md`, `manifest-firefox.json`, `ts-source-promotion.json` (14 promoted / 6 mirrored / 2 divergent), `package.json` (no `engines`), `bg/analyzer.js:52-53` (hard-throw on missing offscreen), `modules/quota-manager.js:50-52` (`estimate()` only, no `persist()`).
- **External:** chrome.userScripts API + "Enabling chrome.userScripts is changing" + MV2 deprecation timeline (developer.chrome.com); Violentmonkey GM API + Gist sync; ScriptCat dev docs (cron/background/subscriptions); GreasyFork antifeatures spec; Tampermonkey docs; quoid/userscripts #650 (`@include` deprecation).

---

## Current Product Map

| Surface | Entry point | State |
| --- | --- | --- |
| Popup | `pages/popup.{html,js}` | Mature; per-site toggle, context-menu section, userScripts setup gate (`:421-441`) |
| Side panel | `pages/sidepanel.{html,js}` | Mature; empty/error states lack live regions |
| Dashboard | `pages/dashboard.{html,js}` + 28 `dashboard-*.js` | Core mature; ~19 feature modules orphaned |
| Install | `pages/install.{html,js}` | Mature trust card; antifeature labels partly broken |
| DevTools panel | `pages/devtools-panel.{html,js}` | Independent, wired |
| Editor | `pages/editor-sandbox.html` + `monaco-adapter.js` | Sandboxed Monaco; postMessage source-check gap |
| Background SW | `background.js` (built from `bg/`, `modules/`, `shared/`, `background.core.js`, generated `src/` artifacts) | One concatenated file, 13 top-level listeners, 247-case dispatch |
| Storage | IndexedDB (`src/storage/*`) + `chrome.storage.local` (settings/folders) | v3 engine; 2 DAOs dead, no direct tests |
| Sync | WebDAV / Drive / Dropbox / OneDrive / S3 / EasyCloud | Wired; plaintext, not E2E |
| TS source | `src/` (37 files) → generated runtime via `ts-source-promotion.json` | 14/22 promoted |

---

## Feature Inventory

Per feature: **user value · entry point · code locations · maturity · tests/docs · improvement ops.**

### Wired & mature (do not re-audit)
- **Userscripts setup onboarding** — detects Chrome "Allow User Scripts" off, shows actionable banner. `pages/popup.js:421-441`, dashboard gate `dashboard.js:2310`. Verified mature. *Improve:* readability of the 30-word banner (see H2-1).
- **Cloud sync cockpit (5 providers + S3 SigV4)** — `modules/sync-providers.js`, `src/background/cloud-sync.ts`. Mature. *Improve:* E2E encryption (C-1), signed-only enforcement (E-2/H), tombstone TTL (G-1).
- **Per-script GM values storage editor** — `dashboard.js:6659 getScriptValues` → `6679 createStorageItem`. Matches TM/VM. Mature.
- **Updates inbox / pending-update queue** — `switchTab` → `loadPendingUpdates` (`dashboard.js:11738`). Shipped C-1. *Improve:* route sync-introduced + subscription scripts here (C-3, B3/E-7).
- **Trash + restore receipts + Undo** — `loadTrash` (`:11739`), restore receipts ledger, 15s Undo toast. Shipped D-5. *Improve:* danger styling (A11Y-D1), full-vault overwrite counts (A11Y-D3).
- **Install-source trust badges + per-update trust-receipt diffs** — `classifyInstallSource`, `trust-receipt.ts`. Mature. *Improve:* surface antifeature + post-grant permission outcome on the row (B4/TRUST-1).
- **Store / CardView / table virtualization** — `dashboard-store.js`, `dashboard-cardview.js`, `dashboard-virtual-rows.js`. Mature.
- **Ed25519 signing** — `bg/signing.js`. Mature but advisory-only (see E-2/H §security).

### Orphaned / duplicated (shipped but unreachable — triage target O-1)
Verified: `safeInit(...)` runs only 7 times; `initOnDemandModule` (`dashboard.js:1935`) and `LazyLoader.loadForEditor()` (`:5857`, result discarded) never mount their modules. The following expose `.init()` referenced only inside their own file + tests:

| Module | Size | Overlaps / inline equivalent |
| --- | --- | --- |
| `dashboard-snippets.js` ("30+") | 59K | inline 6-snippet list `dashboard.js:9114` |
| `dashboard-templates.js` | 57K | inline `SCRIPT_TEMPLATES` `:7337` |
| `dashboard-theme-editor.js` | 52K | *(wired via toast path; preset UI reachable)* |
| `dashboard-gist.js` | 52K | competitor flagship (VM Gist sync) |
| `dashboard-collections.js` | 50K | overlaps profiles/chains |
| `dashboard-sharing.js` | 43K | overlaps gist/standalone + inline `exportSingleScript` `:7656` |
| `dashboard-scheduler.js` | 43K | `@crontab` UI |
| `dashboard-depgraph.js` | 42K | — |
| `dashboard-profiles.js` | 42K | overlaps collections |
| `dashboard-i18n-v2.js` | 39K | **dead**, eager-loaded, 0 `data-i18n` |
| `dashboard-linter.js` | 39K | inline CodeMirror `userscript-lint.js` |
| `dashboard-csp.js` | 37K | — |
| `dashboard-debugger.js` | 37K | — |
| `dashboard-standalone.js` | 36K | overlaps gist/sharing |
| `dashboard-gamification.js` | 35K | anti-feature bloat class |
| `dashboard-diff.js` | 29K | inline `showDiffView` LCS `:6489` |
| `dashboard-recommendations.js` | 26K | anti-feature bloat class |
| `dashboard-pattern-builder.js` | 22K | — |
| `dashboard-heatmap.js` | 21K | anti-feature bloat class |

Estimated **~760 KB unreachable/duplicated** UI JS in the CWS package (Likely). Maturity: code is tested in CI but **not reachable by any user**. *Improvement op:* triage each into wire-or-delete + add a CI reachability gate (see Roadmap P1).

---

## Competitive and Ecosystem Research

- **Violentmonkey** ([violentmonkey.github.io](https://violentmonkey.github.io/), [GM API](https://violentmonkey.github.io/api/gm/)) — **Learn:** GitHub Gist as flagship sync; `GM_addValueChangeListener` 5th `remote` arg distinguishing this-tab vs other-tab/device writes; full `GM.*` async namespace; strict `@connect` enforcement. **Avoid:** none material. ScriptVault has a *dead* Gist module (52K) and a *working* multi-provider sync that already beats VM's breadth — fold Gist into the cockpit rather than ship a separate share surface.
- **Tampermonkey** ([tampermonkey.net](https://www.tampermonkey.net/documentation.php)) — **Learn:** `GM_cookie` gated behind `cookies` permission **and** `@connect` domain matching; IMDS/SSRF blocking after the metadata class was reported; external-editor editing; `@sandbox raw` warned, not default. **Avoid:** closed first-party "Tampermonkey sync" lock-in — ScriptVault's provider-agnostic model is a competitive advantage; do **not** add a proprietary backend.
- **ScriptCat** ([docs.scriptcat.org](https://docs.scriptcat.org/en/docs/dev/), [github](https://github.com/scriptscat/scriptcat)) — **Learn:** genuine cron + true `@background` (DOM-less) scripts; `CAT_userConfig`/`GM_config` author-configuration UI; URL→list **subscriptions** with per-subscription enable/trust; native `@require` ESM via esm.sh. **Avoid:** feature sprawl — adopt the configuration + subscription wedges, not the full surface.
- **GreasyFork** ([antifeatures help](https://greasyfork.org/en/help/antifeatures)) — **Learn:** `@antifeature <type> <localized description>`; antifeature chips shown permanently on every listing. ScriptVault swallows the description and labels only 3 of 6 types.
- **quoid/userscripts (Safari)** ([github](https://github.com/quoid/userscripts), [#650](https://github.com/quoid/userscripts/issues/650)) — **Learn:** deprecating `@include`/`@exclude` toward `@match`/`@exclude-match`; treats `@grant none` MAIN-world injection as a CSP footgun. **Avoid:** promoting `@include` as first-class for new scripts; steer the pattern builder to `@match`.
- **Platform** ([chrome.userScripts](https://developer.chrome.com/docs/extensions/reference/api/userScripts), [userscript blog](https://developer.chrome.com/blog/chrome-userscript), [MV2 timeline](https://developer.chrome.com/docs/extensions/develop/migrate/mv2-deprecation-timeline)) — ScriptVault is correctly MV3-only; keep MV2 polyfills scoped to Firefox.

---

## Highest-Value New Features

### NF-1 — `GM_xmlhttpRequest` internal-host / SSRF guard *(P0, M)*  **NET-NEW (sharpens factory-deferred "DNS-rebind on web-install")**
- **User problem:** A script with `@grant GM_xmlhttpRequest` and no/`@connect *` (the ecosystem norm) can fetch `http://169.254.169.254/` (cloud IMDS), `http://localhost:<port>` admin panels, or RFC1918 routers, with `credentials:'include'` default — a session-hijack/SSRF primitive.
- **Evidence (Verified, confirmed read):** GM_xhr case `background.core.js:3832-4090` gates only on `evaluateConnectPolicy` (`:3847`); the raw `fetch` (`:3965`) is never wrapped by `InternalHostGuard`. GM_loadScript 50 lines above does both pre-flight `classifyFetchUrl` (`:3797`) and post-fetch `classifyResponseUrl` (`:3808`). `evaluateConnectPolicy` returns allow when `@connect` is empty or `*` (`:2280`).
- **Proposed behavior:** After `@connect` passes, run `InternalHostGuard.classifyFetchUrl(data.url, ['http:','https:'])` pre-flight; default GM_xhr to `redirect:'manual'` (or re-`classifyResponseUrl` on the final `response.url` before reading the body). Block IMDS/localhost/RFC1918 unconditionally; allow an explicit opt-in (`allowInternalXhr` setting or per-script `@connect localhost`) so localhost-dev scripts aren't broken.
- **Implementation areas:** `background.core.js:3832` (+ `modules/internal-host-guard.js` classifier already exported); `modules/xhr.js:129-131` redirect default.
- **Data/API/UI:** new optional setting `allowInternalXhr`; surface effective network reach on install card.
- **Risks/edge cases:** localhost dev servers (mitigate via opt-in); IPv6 bracketed/link-local; DNS-rebind requires the post-fetch check, not just pre-flight.
- **Verification:** `tests/internal-host-guard.test.js` + new GM_xhr test asserting `{url:'http://169.254.169.254/'}` and a redirect-to-private-IP both reject; manual against a localhost server.

### NF-2 — Optional client-side E2E encryption for cloud sync *(P1, L)*  **NET-NEW**
- **User problem:** Synced script source (often embedding API keys/tokens) is uploaded as plaintext `JSON.stringify` to every provider; a WebDAV operator or compromised Drive/Dropbox account reads the entire library. Sync is marketed as a trust feature.
- **Evidence (Verified):** WebDAV `upload()` `modules/sync-providers.js:82-95`; disclosure `:48` "does not add a second encryption layer"; envelope `cloud-sync.ts:214-237`.
- **Proposed behavior:** Passphrase → PBKDF2-SHA256 (high iterations, Web Crypto `deriveKey`) → AES-256-GCM over the `scripts[]` payload before `provider.upload`, decrypt after `download`. Store only a local verifier. Mark envelope `version:2, encrypted:true`; a device without the passphrase refuses to merge rather than corrupting. Reuses Web Crypto patterns from `bg/signing.js` + S3 SigV4.
- **Implementation areas:** new `modules/sync-crypto.js` (+ `src/modules/`), `cloud-sync.ts:_performSync` (`:400,495,498`), each provider `upload/download`.
- **Risks:** mixed v1/v2 envelopes across devices; lost passphrase = unrecoverable (document); refresh-token wrapping (C-2).
- **Verification:** round-trip encrypt→mock-upload→download→decrypt identity; wrong-passphrase rejection; mixed-version handling.

### NF-3 — Script-author configuration UI (`@var` / GM_config / CAT_userConfig) *(P1, L)*  **NET-NEW (biggest field gap)**
- **User problem:** No userscript settings surface exists; the `GM_config`/`CAT_userConfig` pattern (typed text/select/checkbox/number options the manager renders) is the most-requested author ergonomic and a ScriptCat wedge.
- **Evidence (Verified):** every `userConfig|GM_config|@var` hit is UserCSS-only (`src/modules/userstyles.ts`, `docs/userstyle-compat.md`) — the variable editor already exists for `.user.css`.
- **Proposed behavior:** Support a `@var <type> <key> "<label>" <default> [options]` block for userscripts; render via the existing UserStyles variable-editor widgets in a per-script "Settings" modal (dashboard + popup); back values with `GM_getValue`. Ship a `GM_config`-compatible shim as a bundled `@require`.
- **Implementation areas:** new `modules/script-config.js` (reuse `userstyles.ts` widgets), `parser.ts` (`@var` for userscripts), `dashboard.js` per-script config modal, wrapper injection of config values.
- **Verification:** Playwright — declare `@var`, open settings, change value, confirm `GM_getValue` reflects it post-reload.

### NF-4 — Per-script host scope for GM network/cookie/DNR primitives *(P1, L)*  **NET-NEW (umbrella for NF-1/B-1/H-1)**
- **User problem:** Script injection is `@match`-scoped, but background GM_xhr/GM_cookie/GM_download/GM_webRequest run with the extension's ambient `<all_urls>`, so a script matched only to `example.com` can fetch/cookie/DNR-modify any origin.
- **Evidence (Verified):** `manifest.json:37-39` `<all_urls>`; GM_cookie unscoped (`:4617-4668`); GM_download unvalidated (`:4178-4237`); `dnr-rules.ts:154` urlFilter straight from script.
- **Proposed behavior:** Tie GM network/cookie/download/DNR target hosts to the union of `@match`+`@connect` by default, with an explicit per-script "allow this script to access any site" toggle; surface effective reach on the install card. Block security-header-stripping DNR rules (`content-security-policy`, `x-frame-options`, `strict-transport-security`) unless a high-privilege toggle is set.
- **Implementation areas:** GM_xhr/GM_cookie/GM_download cases, `dnr-rules.ts:_translateWebRequestRule`/`applyWebRequestRules`, install card.
- **Verification:** a `@match example.com`-only script is blocked from `other.com` fetch/cookie/DNR unless overridden; CSP-strip rule rejected without toggle.

### NF-5 — TOFU SRI for unpinned `@require` *(P1, M)*  **NET-NEW (interim for F-4 Sigstore)**
- **User problem:** SRI is enforced only when an author hand-pins `#sha256=` (almost never), so a compromised CDN silently swaps `@require` bytes with no detection — the supply-chain attack surface.
- **Evidence (Verified):** `resource-loader.ts:139-151` passes when no hash present. **Key lever:** `trust-receipt.ts:84-91` already computes per-`@require` SHA-256 and diffs them across updates (`buildDependencyChanges` `:109-136`) — it's *displayed* ("Review changes") but not *enforced*.
- **Proposed behavior:** "Auto-pin SRI on install" mode (trust-on-first-use): hash the fetched body, store expected hash in the script record, fail-closed if the body changes on update. Add an "unverified @require source" badge on the install card when no pin exists.
- **Implementation areas:** `resource-loader.ts`, wire the existing trust-receipt diff to fail-closed on the update path.
- **Verification:** install a script with `@require`, change the remote body, confirm the update is flagged/blocked.

### NF-6 — Script subscriptions (URL → JSON list) *(P2, L)*  sharpens **E-7**
- **User problem:** No curated-collection / auto-updating bundle install (ScriptCat differentiator).
- **Evidence (Verified):** no `modules/subscriptions.js`; E-7 open (`TODO.md:97-99`).
- **Proposed behavior:** Subscription `{url,name,scriptUrls[],lastChecked,trusted}` in settings, off by default; poll on the existing update alarm; route each member through `installFromUrl` (reusing `InternalHostGuard` SSRF + `_fetchTextBounded` + install-source classification); **new/changed members land in the pending-update inbox (C-1), not auto-installed**; orphaned (removed-from-manifest) scripts surfaced, not auto-deleted; honor `@antifeature` before offering. Author as `src/modules/subscriptions.ts` so it lands promoted, not as new mirror debt.
- **Verification:** `tests/subscriptions.test.js` — manifest parse, SSRF rejection of internal URLs, orphan detection, off-by-default gate; new members appear in the inbox.

### NF-7 — Wire the built npm/ESM `@require` resolver *(P2, M)*  sharpens **E-6**
- **User problem:** `modules/npm-resolve.js` (SRI + 5 MB cap, hardened) is built but **unwired** — `npmResolve`/`npmResolveAll` handlers exist but nothing calls them (CLAUDE.md 2026-06-02). ScriptCat resolves `@require` via esm.sh natively.
- **Proposed behavior:** Connect `NpmResolver` to the `@require` fetch path (`resource-loader.ts`) for `npm:`/esm.sh specs, reusing SRI + host guard; fix the documented computed-integrity TOCTOU *before* wiring; surface an "ESM"/"npm" badge (folds into E-6). Alternatively delete if the decision is to drop it (shrinks attack surface + bundle).
- **Verification:** install a script with `@require npm:lodash@4`, confirm resolved + SRI-pinned require body injected.

### NF-8 — True `@background` (DOM-less) scripts *(P2, XL)*  **NET-NEW (ScriptCat parity)**
- **User problem:** `@crontab` requires an open matching tab and injects into it (`background.core.js:5910-5920`); there is no headless scheduled-job context (scraping, notifications, sync pings with zero tabs open).
- **Proposed behavior:** `@background` (DOM-less; GM_xhr/GM_value/GM_notification only) routed through the existing offscreen document with a restricted GM surface, scheduled via the NF-9-fixed cron engine; gated behind default-off `experimentalBackgroundScripts` (mirrors the ESM gate).
- **Implementation areas:** `offscreen.{js,html}` runner + restricted GM bridge, `background.core.js` dispatch, `wrapper-builder.ts` DOM-less variant, parser `@background`.
- **Verification:** scheduled `@background` script fires `GM_notification` with no matching tab open.

### NF-9 — Correct `@crontab` next-fire engine *(P1, M)*  **NET-NEW (verified bug in an advertised feature)**
- **User problem:** Everything except `*/N * * * *`, `0 */N * * *`, `0 * * * *`, `0 0 * * *` silently falls back to 60 min — `30 9 * * 1` ("9:30am Mondays") runs hourly. A correctness/trust failure in advertised automation.
- **Evidence (Verified):** `parseCronToMinutes` `background.core.js:5849-5871`; fallback `:5868-5870`.
- **Proposed behavior:** Replace the period approximation with a real 5-field next-fire calculator (lists `1,15`, ranges `9-17`, steps `*/5`, DOW) → `chrome.alarms.create(when)`, re-arm on fire. **Reject/flag unparseable expressions visibly** in the editor linter + scheduler instead of silently defaulting.
- **Implementation areas:** `background.core.js` (`parseCronToMinutes`→`nextCronFire`), `src/background/*` mirror, `dashboard-scheduler.js` (validate/preview next-run — only relevant once the module is wired per O-1).
- **Verification:** unit table of cron expr → next-fire times vs a reference; regression that an unsupported expr is surfaced, not silenced.

---

## Existing Feature Improvements

### EI-1 — What's New is dead for all v3.x users *(P1, S)*  **NET-NEW**
- **Current behavior (Verified, confirmed read):** `dashboard-whatsnew.js:11` `CHANGELOG` keys top out at `2.0.2`/`2.0.0`; `CURRENT_VERSION` = `3.11.0`; `show()` resolves `CHANGELOG[CURRENT_VERSION]` → `undefined` → silently sets `lastSeenVersion` and returns. The one wired module that should fire on update shows nothing.
- **Recommended change:** Add `CHANGELOG['3.11.0']` (key on major.minor per the `:103` gate); add a CHANGELOG-freshness CI check tied to manifest version.
- **Backward-compat:** none affected. **Verification:** lower `lastSeenVersion`, reload, confirm a v3.x entry renders.

### EI-2 — i18n-v2 table is 100% dead, eager-loaded *(P1, L implement / S remove)*  **NET-NEW**
- **Current behavior (Verified):** `dashboard-i18n-v2.js` (`I18nV2`, 600 keys / 8 langs, 39 KB) referenced nowhere; `dashboard.html` has 0 `data-i18n`; eager-loaded for nothing; includes orphaned keys for the deleted onboarding wizard. `npm run locale:check` audits a table no user sees.
- **Recommended change:** Either implement a real `applyTranslations()` over `data-i18n`-tagged DOM + a language selector, or remove from eager load and stop advertising multi-language UI. Note the gate's scope.
- **Verification:** switch UI language → observe whether any string changes (currently none).

### EI-3 — Structured `@antifeature` parsing + install label + row chip *(P1, S-M)*  **NET-NEW**
- **Current behavior (Verified):** `parser.ts:84,110,216` push the whole directive value (`"referral-link Earns the author a commission"`) as one array element; `install.js:1038-1042` `afLabels` has only `ads/tracking/miner` so descriptioned antifeatures miss the label and print run-on raw text. Antifeatures vanish after install.
- **Recommended change:** Parse into `{type, description, locale}` (split on first whitespace; honor `@antifeature:fr`); expand `afLabels` to all 6 GreasyFork types; render type-as-badge + description-as-text on install **and** as an amber chip in `renderScriptRow` (reuse `.script-health-badge .alert`).
- **Code locations:** `parser.ts`, `src/types/script.ts`, `install.js:1037-1044`, `dashboard.js renderScriptRow`.
- **Verification:** parser test (type/description/localized split) + install source-of-truth test asserting all 6 labels.

### EI-4 — Snippets/templates/diff/linter: collapse inline-vs-module duplication *(P1-P2, S delete / M wire)*
- **Current behavior (Verified):** inline 6-snippet list (`:9114`) vs dead `SnippetLibrary` (59K); inline `SCRIPT_TEMPLATES` (`:7337`) vs dead `TemplateManager` (57K); inline `showDiffView` LCS (`:6489`) vs dead `DiffTool` (29K); CodeMirror lint addon vs dead `AdvancedLinter` (39K).
- **Recommended change:** Pick one canonical path per concern — wire the richer module or delete it from the lazy-loader registry + README. Recommend deleting gamification/heatmap/recommendations outright (same bloat class as the already-removed analytics/AI modules).
- **Backward-compat:** removing dead modules has no user impact; verify README claims drop too.

### EI-5 — ESM badge (10-line add) *(P3, S)*  sharpens **E-6**
- **Current behavior (Verified):** `parser.ts:342` already sets `meta.esm`; `dashboard.js:5384-5443` already renders a badge cluster.
- **Recommended change:** add `const esmHtml = script.metadata?.esm ? '<span class="script-health-badge neutral" title="ES module userscript">ESM</span>' : '';` and insert near `:5440` (reuse existing `.script-health-badge.neutral`, no new CSS).
- **Verification:** `node --check pages/dashboard.js`; new `tests/dashboard-modules.test.js` case.

### EI-6 — `GM_addValueChangeListener` `remote` flag + cross-tab fan-out *(P2, M)*  **NET-NEW (Likely — needs-live-validation)**
- **Current behavior (Likely):** listener exists (`background.core.js:8721-8723`); unclear whether it fires across tabs and sets VM's 5th `remote` arg, and whether sync-applied changes re-fire.
- **Recommended change:** broadcast value-change to all USER_SCRIPT worlds of the same script across tabs; set `remote=true` for writes not originating in the listening world and for sync-applied changes; document the contract.
- **Verification:** two-tab test — write in A, listener in B fires with `remote=true`.

### EI-7 — `GM.*` namespace completeness + `GM.fetch` *(P3, M)*  **NET-NEW (Likely)**
- **Recommended change:** generate the `GM.*` promise namespace mechanically from the `GM_*` table so coverage can't drift; add `GM.fetch` alias to `GM.xmlHttpRequest` behind `@connect`+NF-1 enforcement.
- **Verification:** wrapper test enumerates `GM.* == GM_*`; `GM.fetch` honors `@connect`.

---

## Reliability, Security, Privacy, and Data Safety

**Highest-severity, ordered:**

- **(P0) GM_xhr SSRF — NF-1** and its **redirect re-classification** half. The single most load-bearing fact this pass: GM_xhr never calls `InternalHostGuard` while GM_loadScript does (confirmed read of `:3797/:3808` vs `:3847/:3965`).
- **(P1) Cloud sync is an unauthenticated remote-code-push channel.** `cloud-sync.ts:459-477` parses + `ScriptStorage.set` + `refreshSyncedScriptRuntime` re-registers any remote script newer than local, with the injected metadata's `@grant` set, **no install prompt / SRI / signature check**. Combined with plaintext + writable remote (NF-2) this is RCE-on-sync. *Fix:* require NF-2 E2E so only the passphrase-holder writes valid envelopes; route sync-introduced scripts (especially with expanded `@grant`) into the pending-update inbox; optionally enforce `@signature`.
- **(P1) `navigator.storage.persist()` missing (E-8).** `quota-manager.js:50-52` only `estimate()`s; nothing requests persistence. Chrome can evict the IndexedDB store (all scripts/values/backups since v3.0.0) under pressure → silent total data loss. ~10-line `ensurePersisted()` on first write, gated once via `_persistRequested`. *Caveat (needs-live-validation):* extension SW contexts usually get `persist()` without a prompt on Chrome; verify on Firefox.
- **(P1) GM_cookie cross-domain scope (B-1).** `:4617-4668` validates only `isHttpCookieUrl`; a script matched to `example.com` with `@grant GM_cookie` can read `accounts.google.com` session cookies. *Fix via NF-4* + cookie host must intersect `@connect`.
- **(P1) GM_webRequest can strip CSP/X-Frame-Options site-wide (H-1).** `dnr-rules.ts:154-197` urlFilter unscoped; can remove security headers for any site. *Fix via NF-4* + refuse security-header stripping without a toggle.
- **(P1) TOFU SRI for unpinned @require — NF-5** (CDN-swap supply-chain).
- **(P1) DNR rule orphaning + in-memory map durability (N-3/N-4).** `_webRequestRuleMap` in-memory; SW death + map eviction leaks live DNR rules with no owner. *Fix:* persist to `chrome.storage.session` (ROADMAP 13.11) + namespace SV rule IDs so a reconcile can enumerate-and-purge by ID range even when the owner map is lost.
- **(P2) Token at-rest (C-2):** refresh tokens plaintext in `chrome.storage.local`; add a "Forget tokens on browser close" option using `chrome.storage.session`; wrap under NF-2 KEK if present.
- **(P2) GM_download (B-2):** no scheme/internal-host/filename-traversal validation before `chrome.downloads.download`. Sanitize filename (strip `/`, `..`, drive letters, reserved Windows names), classify http(s) URLs.
- **(P2) Editor sandbox postMessage (D-1):** `editor-sandbox.html:364-436` doesn't check `event.source === window.parent`. Low exploitability (sandbox not in `web_accessible_resources`) but a defense-in-depth gap; the adapter side was hardened in v2.0.4, the sandbox side wasn't.
- **(P2) Signed-only enforcement (E-2):** `bg/signing.js:70-124` verify is advisory. Add `requireSignedScripts: 'off'|'warn'|'block'` consulted in install + sync-apply.
- **(P2) Tombstone GC resurrection + cap (G-1/G-2):** `cloud-sync.ts` `syncTombstones` has no TTL/GC and no size cap; remote tombstones merged wholesale (`:404`). Add a GC horizon longer than the max offline-device window (~180 days), a count/byte cap (reuse the `_pushReceipt` 5 MB budget pattern), validate remote keys look like script IDs, and add the missing multi-device-GC drill test.
- **(P2) `migration-v3` double full-store read (SC-E):** `migration-v3.ts:124,153` `get(undefined)` loads the entire legacy store twice on cold-start migration → OOM risk; use `chrome.storage.local.getKeys?.()` (Chrome 130+) for the wipe pass.
- **(P3) `txComplete` masks quota errors (SC-D):** `transaction.ts:23-32` / `idb.ts:143-149` — commit-abort rejects with `tx.error` (often null) so QuotaExceeded surfaces as opaque "transaction aborted", flattening the v2.0.4 quota-aware rollback UX. Prefer the first request-level error.
- **(P3) Receipts not tamper-evident (I-4):** HMAC-seal trust/restore receipts with a per-install key (the PatientImage keyed audit-seal pattern).

**Storage atomicity (P2):**
- **SC-A — `BackupsDAO`/`StatsDAO` dead but solve documented issues.** Zero callers; stats still race-able on `chrome.storage`, backups still ZIP-blob into `chrome.storage.local`. Wire `StatsDAO.recordRun()` (atomic read-modify-write) into the run-stat path and migrate backup persistence to the IDB `backups` store, or mark `@deprecated`/remove.
- **SC-B/SC-C — DAO transactions per-call, cache coherence.** `ScriptStorage.reorder()` (`storage.ts:367-383`) is one txn per record with a "tolerate partial failure" comment; `set()` updates cache after await with no per-id write lock (only toggles are mutex-guarded). Use `ScriptsDAO.bulkPut` in `reorder` (single txn), add a generic `_writeLocks` per-id mutex used by `set`/`delete`/`applyUpdate`, and a `setWithValues` wrapping both stores in one `withTransaction`.

---

## UX, Accessibility, and Trust

- **(P0) A11Y-D1 — Danger confirmations.** `showConfirmModal` (`dashboard.js:8516`) hard-codes confirm as `btn-primary` (green) and `showModal` (`:8490`) auto-focuses `.btn-primary`, so the most dangerous button (Factory Reset `:9682`, Empty Trash `:9927`, Delete Forever `:4369`, bulk delete `:5068`, Revoke sync `:9577`, Restore Full Vault `:11258`) is green, default-focused, and a stray Enter executes irreversible loss. *Fix:* `danger` option → red `btn-danger`, **Cancel** as auto-focus, specific verb labels.
- **(P1) A11Y-D2 — Factory-reset friction.** Upgrade Factory Reset to a typed-`RESET` (or count) confirmation echoing exact at-risk counts; factory reset bypasses Trash so there is no undo.
- **(P1) A11Y-L1 — Toasts double-announce.** `showToast` (`:8283-8317`) sets the toast's own `role`/`aria-live` **and** calls `A11y.announce` into the dedicated region → screen readers read every toast twice. *Fix:* one channel (toast `aria-hidden` + single announce path), and make `A11y.announce` lazily create its region if `_liveRegion` is null (`dashboard-a11y.js:551`) so early-failure toasts still announce.
- **(P1) THEME-1 — Light-theme muted text below WCAG 2.2 AA (current regression).** `theme-editor.js:85` light `--text-muted:#999` on `#fff` ≈ 2.85:1; Solarized-Light `:163` `#93a1a1` on `#fdf6e3` ≈ 2.0:1. Used heavily for secondary metadata. *Fix:* darken to ≥4.5:1; add a contrast unit test iterating presets × text vars (the repo already does color math in `colorToHex`).
- **(P1) H1-1 — Help only on dashboard (closes H-1).** Popup, sidepanel, install have no Help affordance. Add a consistently-placed Help control deep-linking the dashboard Help tab (`#tab=help`) on all four surfaces; extend `tests/accessibility-surface-pass.test.js`.
- **(P2) H2-1 — Readability gate (closes H-2).** Setup banner (`popup.js:388`, one 30-word sentence), install terminal copy (`install.js:383`, 45 words), trust strings are below Flesch 60. Split into steps; add `scripts/check-readability.mjs` gating user-facing strings at Flesch ≥ 60 (mirrors the locale/readme gate).
- **(P2) A11Y-L3 — Sidepanel empty/error not in a live region** (`sidepanel.js:194,395-531`); wrap the list/status mount in `role="status" aria-live="polite"`.
- **(P2) TRUST-1 — Post-grant permission outcome.** After the optional-permission prompt, render "Cookie access: granted/denied" on the install card + dashboard row tooltip (the trust receipt already records `optionalPermissions.cookies`).
- **(P2) TRUST-2 — First-run privacy reassurance.** One-time dismissible strip: "Scripts run locally. Nothing is uploaded unless you turn on cloud sync." in dashboard + popup empty states (the deleted onboarding wizard removed this; keep it lightweight, not a wizard).
- **(P2) DISC-1 — Discoverability of per-site mode / signing / API origins** via inline `?` help; surface whitelist/blacklist mode state in the popup label.
- **(P2) KBD-1 — Grid vs `.kn-focused` mismatch.** `dashboard-a11y.js:213-219` sets `role="grid"` but `dashboard-keyboard.js` drives a CSS-class focus with no roving tabindex/activedescendant. Demote to a labeled list with real focusable row controls (lower-risk than full APG grid).
- **(P3)** H1-2 (Help external link + literal-backtick `<code>` fix), H2-2 ("vault" jargon gloss), THEME-2 (preset-change announce), KBD-2/3 (keyboard-nav focus return, duplicate skip-link target `#mainContent` vs `#scriptsPanel`), LABEL-1 (broaden icon-button aria-label back-fill to dynamically-rendered rows).
- **(P3, informational) THEME-3:** no pill/999-radius backdrops found in the theme editor — compliance check passed.

---

## Architecture and Maintainability

- **(P1, XL) GO-A — `handleMessage` 247-case / 2,662-line switch** (`background.core.js:2317-4979`) is the central blocker for incremental `background.core.js` promotion. Extract a handler-registry (`handlers/{scripts,sync,backup,gm-bridge,trust}.js`); `handleMessage` becomes a lookup + `ensureInitialized` guard. **This gates F-1b.**
- **(P1) F-1 re-scope.** `ts-source-promotion.json` is **14 promoted / 6 mirrored / 2 intentionally-divergent**, not "14/20, 6 mirrored". Split F-1 into **F-1a** (promote the 6 mirrors: workspaces → signing → esm-bundler → public-api → backup-scheduler → sync-easycloud, lowest-risk first) and **F-1b** (collapse the 2 divergent). Acceptance: "0 mirrored **AND** 0 intentionally-divergent".
- **(P1) F1-B/C — registration.ts / context-menu.ts lack @crontab/forceReregister.** `grep crontab src/background/registration.ts` → 0 vs 28 in runtime. Promoting today regresses @crontab (zombie alarms + dup registrations — the exact Wave-2 bug). Port the crontab diff path + parity test **before** promotion; treat the two as one unit.
- **(P1) F1-D — `buildWrappedScript` duplicated** (`background.core.js:7937` AND `wrapper-builder.ts`, 74 KB). The highest-churn, security-critical drift surface (every wrapper fix is a 2-file edit). Promote it as the next target after the 6 mirrors.
- **(P2) F1-F / BR-C — generator collision + `node --check` gate.** `generate-ts-runtime-modules.mjs:121-172` concatenates IIFE-wrapped modules into one script scope with no duplicate-top-level-`const` guard; a future promotion can SyntaxError only at SW boot. Add `node --check background.js pages/dashboard.js` + a global-identifier-collision check as CI steps right after the build (CLAUDE.md already runs `node --check` manually).
- **(P2) GO-B/GO-C — `dashboard.js` 11,774-line IIFE (stamped `v2.3.0` — version drift, fix to v3.11.0 as a P3 one-liner + version-sync gate) and `dashboard.html` 70% inline `<style>` (5,568/7,951 lines).** Split along existing section banners; extract CSS to `dashboard.css`/`themes.css` so the catppuccin/oled missing-`--panel-*` bug class becomes lintable (every theme defines every referenced var).
- **(P1) BR-A — no direct unit tests for the IDB engine** (`idb`/`transaction`/`script-db`/`migration-v3` only exercised via the `ScriptStorage` facade). Add `tests/storage-engine.test.js` (fake-indexeddb: `withTransaction` commit/abort, multi-store atomic delete, cursor iteration, `versionchange` reconnect, `txComplete` error propagation).
- **(P1) BR-B/SC-F — @connect policy evaluator is runtime-only, untested security logic.** Extract `evaluateConnectPolicy` + host normalizers (`background.core.js:2223-2298`) into `src/background/connect-policy.ts`, promote, add `tests/connect-policy.test.js` (self/wildcard/subdomain/IDN/port/bracketed-IPv6).
- **(P2) F-5 module-mode SW is LOW-RISK and feasible.** Built `background.js` is a single concatenated file with **no** `importScripts`/`import`/`export`, 13 top-level synchronous listeners, no top-level `await`, `minimum_chrome_version:130`. Flipping `"type":"module"` keeps all declarations in one module scope. Real (small) blockers to verify-live: top-level `this===undefined` (only explicit `self.*` found), strict-mode duplicate decls (same as F1-F), no TLA from esbuild. **Sequence F-5 AFTER GO-A/F-1b** so it lands on split files — it does not itself reduce the god-object.
- **(P2) N-5 — ResponseMap completeness.** `src/types/messages.ts` covers ~25 of 135+ actions; a hard exit criterion for F-1.

**Correct sequencing:** GO-A (registry) → F1-B/C + F1-D (worst drift surfaces) → F-1a/E/F + BR-A/B (mirrors + storage/connect tests + collision gate) → F-5 (module mode) last.

---

## Prioritized Roadmap

- [ ] P0 - Wire InternalHostGuard into GM_xmlhttpRequest + re-classify followed redirects
  - Why: GM_xhr is an SSRF primitive to IMDS/localhost/RFC1918 with default-open @connect; the single highest-severity remaining gap
  - Evidence: background.core.js:3832-4090 (GM_xhr, only evaluateConnectPolicy) vs :3797/:3808 (GM_loadScript pre+post host checks); modules/xhr.js:129-131 redirect default
  - Touches: background.core.js GM_xhr case, modules/internal-host-guard.js (classifier), modules/xhr.js, tests/internal-host-guard.test.js
  - Acceptance: GM_xmlhttpRequest to 169.254.169.254 / localhost / a redirect-to-private-IP returns an internal-host error; localhost dev allowed only via opt-in
  - Verify: new GM_xhr unit tests + manual fetch against a localhost server with the extension loaded
- [ ] P0 - Danger-style destructive confirmations (Cancel-default, red, specific verb)
  - Why: Factory Reset / Empty Trash get a green auto-focused Confirm; a stray Enter wipes the whole vault with no undo
  - Evidence: dashboard.js:8516 (btn-primary hardcoded), :8490 (auto-focus .btn-primary), call sites :9682,:9927,:4369,:5068,:9577,:11258
  - Touches: pages/dashboard.js showConfirmModal/showModal + the ~8 destructive call sites
  - Acceptance: destructive modals render btn-danger, focus Cancel, use specific labels; pressing Enter immediately deletes nothing
  - Verify: tests/dashboard-confirm-danger.test.js (btn-danger + Cancel-focused) + manual Factory-Reset Enter test
- [ ] P1 - navigator.storage.persist() on first write (E-8)
  - Why: all scripts/values/backups live in IndexedDB since v3.0.0; eviction = silent total data loss
  - Evidence: modules/quota-manager.js:50-52 (estimate() only, no persist())
  - Touches: modules/quota-manager.js (ensurePersisted), background.core.js first-write call, settings._persistRequested
  - Acceptance: persist() requested exactly once on first install/IDB write; extension origin shows persistent storage
  - Verify: tests/quota-manager.test.js mock + chrome://settings/content/all live check (also verify Firefox behavior)
- [ ] P1 - Module-reachability triage (wire-or-delete) + CI gate
  - Why: ~19 dashboard modules + the 39KB i18n table ship to every user but never mount (~760KB unreachable/duplicated)
  - Evidence: dashboard.js safeInit ×7 (:1797-1878), initOnDemandModule :1935 uncalled, loadForEditor :5857 discards result; dashboard-i18n-v2.js dead; whatsnew CHANGELOG stale
  - Touches: pages/dashboard.js (mount wiring), pages/dashboard.html (triggers), dashboard-lazy-loader.js, new scripts/check-module-reachability.mjs, tests/module-reachability.test.js
  - Acceptance: every TAB_MODULES/ON_DEMAND_MODULES/EDITOR_MODULES entry has a matching init call site or is removed; gate fails on a registered-but-unmounted module
  - Verify: load unpacked, exercise every tab+editor, instrument window.<Global>._initialized; new reachability test
- [ ] P1 - Optional client-side E2E encryption for cloud sync
  - Why: providers see all script source (often embedded secrets) in cleartext; sync is marketed as a trust feature
  - Evidence: sync-providers.js:48 disclosure, :82-95 plaintext JSON.stringify; cloud-sync.ts:214-237 envelope
  - Touches: new modules/sync-crypto.js (+src/modules/), cloud-sync.ts:_performSync, each provider upload/download
  - Acceptance: passphrase-encrypted envelope (version:2,encrypted:true) round-trips; wrong passphrase rejected; device without passphrase refuses to merge
  - Verify: encrypt→mock-upload→download→decrypt identity test + wrong-passphrase + mixed-version tests
- [ ] P1 - Route sync-introduced / signature-mismatched scripts into the pending-update inbox
  - Why: sync currently parses+set+re-registers attacker-influenced remote code silently (RCE-on-sync) with the injected @grant set
  - Evidence: cloud-sync.ts:459-477 (apply + refreshSyncedScriptRuntime, no prompt/SRI/signature)
  - Touches: cloud-sync.ts:_performSync, pending-update inbox (dashboard.js:11738), bg/signing.js
  - Acceptance: a new/expanded-grant/unsigned remote script lands in the review queue, not auto-registered
  - Verify: test that a tampered/unsigned remote script with expanded grants is queued, not applied
- [ ] P1 - Correct @crontab next-fire engine (replace 60-min fallback)
  - Why: any expr beyond */N|hourly|daily silently runs hourly; an advertised automation feature quietly diverges from cron
  - Evidence: background.core.js:5849-5871 parseCronToMinutes, fallback :5868-5870
  - Touches: background.core.js (nextCronFire + alarms), src/background/* mirror, dashboard-scheduler.js (validate/preview, post-O-1)
  - Acceptance: 5-field cron (lists/ranges/steps/DOW) computes correct next-fire; unparseable exprs are flagged, not silenced
  - Verify: unit table of expr→next-fire vs reference + a surfaced-error regression
- [ ] P1 - Per-script host scope for GM_xhr/GM_cookie/GM_download/GM_webRequest (umbrella)
  - Why: every enabled script wields the extension's full <all_urls> reach regardless of @match; root cause of the SSRF/cookie/DNR class
  - Evidence: manifest.json:37-39; GM_cookie :4617-4668; GM_download :4178-4237; dnr-rules.ts:154
  - Touches: GM_xhr/GM_cookie/GM_download cases, dnr-rules.ts, install card
  - Acceptance: a @match example.com-only script is blocked from other.com fetch/cookie/DNR unless an explicit per-script override is set; CSP/X-Frame-Options-strip DNR rules rejected without a high-privilege toggle
  - Verify: scope-enforcement tests per primitive + install-card reach display
- [ ] P1 - TOFU SRI for unpinned @require (interim before Sigstore F-4)
  - Why: SRI enforced only on hand-pinned hashes (almost never); compromised CDN silently swaps @require bytes
  - Evidence: resource-loader.ts:139-151 (pass-when-absent); trust-receipt.ts:84-91/:109-136 already compute+diff per-require SHA-256 (display-only)
  - Touches: resource-loader.ts, wire trust-receipt diff to fail-closed on update; install-card unverified-source badge
  - Acceptance: auto-pin-on-install stores expected hash; an update whose @require body changed unexpectedly is flagged/blocked
  - Verify: install with @require, mutate remote body, confirm update flagged
- [ ] P1 - Refresh What's New CHANGELOG to v3.x + freshness gate
  - Why: show() resolves CHANGELOG[3.11.0]→undefined and silently returns; update-discovery is dead for all v3.x users
  - Evidence: dashboard-whatsnew.js:11 (keys top out at 2.0.2/2.0.0), :103 major.minor gate, :111-114 silent return
  - Touches: pages/dashboard-whatsnew.js + a CHANGELOG-vs-manifest CI check
  - Acceptance: lowering lastSeenVersion renders a v3.x modal; CI fails if CHANGELOG lacks the manifest major.minor
  - Verify: lower lastSeenVersion, reload dashboard
- [ ] P1 - Structured @antifeature parsing + 6 install labels + dashboard row chip
  - Why: descriptioned antifeatures are swallowed into one string so the consent-label lookup fails; antifeatures vanish post-install
  - Evidence: parser.ts:84,110,216 (whole-value push); install.js:1038-1042 (afLabels = 3 of 6)
  - Touches: parser.ts, src/types/script.ts, install.js:1037-1044, dashboard.js renderScriptRow
  - Acceptance: {type,description,locale} parsed; all 6 GreasyFork types labeled; amber chip on the script row with tooltip
  - Verify: parser split test + install source-of-truth label test + row-render chip test
- [ ] P1 - Light/Solarized-Light muted-text contrast to WCAG 2.2 AA
  - Why: current AA failure (not a future APCA nuance); secondary metadata renders sub-4.5:1
  - Evidence: theme-editor.js:85 (#999 on #fff ≈ 2.85:1), :163 (#93a1a1 on #fdf6e3 ≈ 2.0:1)
  - Touches: pages/dashboard-theme-editor.js PRESETS, mirror light vars in dashboard.css
  - Acceptance: every preset muted/secondary var ≥ 4.5:1 against its bg-content
  - Verify: contrast unit test iterating presets × text vars (reuse colorToHex)
- [ ] P1 - Cross-surface Help control (closes H-1)
  - Why: Help exists only on the dashboard; WCAG3 "Help is consistent across pages"
  - Evidence: dashboard.html:5598/7119-7238 Help tab; popup/sidepanel/install have no Help affordance
  - Touches: popup.{html,js}, sidepanel.{html,js}, install.{html,js}, dashboard #tab=help hash routing
  - Acceptance: each of the 4 pages exposes a [data-help] control with accessible name "Help" deep-linking the dashboard Help tab
  - Verify: extend tests/accessibility-surface-pass.test.js
- [ ] P1 - Toast double-announce + early-toast announce gap (A11Y-L1/L2)
  - Why: every dashboard toast is read twice by screen readers; early-failure toasts may not announce at all
  - Evidence: dashboard.js:8283-8284 (toast role/aria-live) + :8316-8317 (A11y.announce); dashboard-a11y.js:551-559 (returns if _liveRegion null)
  - Touches: pages/dashboard.js showToast, pages/dashboard-a11y.js announce
  - Acceptance: exactly one live announcement per toast; announce lazily creates its region if null
  - Verify: unit assert single announcement + announce-before-init writes a region; manual NVDA single utterance
- [ ] P1 - Playwright E2E for install / update-queue / restore-undo (E-5)
  - Why: zero end-to-end coverage of the real chrome.userScripts path; the dashboard-chains wrong-key bug lived v2.0.0→Round 10
  - Touches: add @playwright/test, tests/e2e/ + playwright.config.ts (launchPersistentContext --load-extension)
  - Acceptance: install-from-fixture appears; bumped-@version lands in the pending queue (not auto-applied); trash→restore→Undo rolls back
  - Verify: npx playwright test tests/e2e/install.spec.ts against a built extension (nightly/continue-on-error CI to avoid shared-drive flakiness)
- [ ] P1 - handler-registry split of handleMessage (GO-A, gates F-1b)
  - Why: a 247-case/2,662-line switch is the central blocker for incremental background.core.js promotion
  - Evidence: background.core.js:2317-4979 (247 case labels), funnels from :2207/:2301
  - Touches: new modules/handlers/{scripts,sync,backup,gm-bridge,trust}.js, background.core.js dispatch
  - Acceptance: handleMessage is a lookup + ensureInitialized guard; every action has exactly one handler
  - Verify: tests/core-flows.test.js + a dispatch-table test
- [ ] P1 - registration.ts/context-menu.ts @crontab+forceReregister port (F1-B/C, blocks promotion)
  - Why: promoting these mirrors today regresses @crontab (zombie alarms + dup registrations)
  - Evidence: grep crontab src/background/registration.ts → 0 vs 28 runtime; CLAUDE.md Wave-2 follow-up
  - Touches: src/background/registration.ts, src/background/context-menu.ts, parity test
  - Acceptance: @crontab add creates alarm + removes page-load reg; @crontab remove clears alarm + restores page-load reg
  - Verify: tests/source-registration-crontab.test.js; grep count ≈ runtime
- [ ] P1 - Direct IDB storage-engine unit tests (BR-A)
  - Why: the v3 data foundation (idb/transaction/script-db/migration-v3) is only tested via the facade
  - Touches: tests/storage-engine.test.js, fake-indexeddb devDep
  - Acceptance: withTransaction commit/abort, multi-store atomic delete, cursor iteration, versionchange reconnect, txComplete error propagation covered
  - Verify: new suite green; coverage hits src/storage/*
- [ ] P1 - Extract+test @connect policy evaluator (BR-B/SC-F)
  - Why: the exfiltration guard is runtime-only, untested security logic in the god-file
  - Evidence: background.core.js:2223-2298 (normalizeConnectHost/evaluateConnectPolicy, no TS mirror/test)
  - Touches: new src/background/connect-policy.ts, generator entry, tests/connect-policy.test.js
  - Acceptance: self/wildcard/subdomain/IDN/port/bracketed-IPv6 covered; runtime delegates to the generated artifact
  - Verify: new suite green
- [ ] P1 - DNR rule durability via chrome.storage.session + namespaced IDs (N-3/N-4)
  - Why: in-memory _webRequestRuleMap leaks live DNR rules across SW death + map eviction
  - Evidence: ROADMAP 40.10/13.11; dnr-rules.ts:308-377 reconcile keyed by owner map
  - Touches: dnr-rules.ts persistence, chrome.storage.session backing
  - Acceptance: SV DNR rules are enumerable+purgeable by ID-range even when the owner map is lost
  - Verify: simulate map loss + assert orphan SV-range rules are reclaimable
- [ ] P1 - node --check + global-collision CI gate (F1-F/BR-C)
  - Why: a future promotion's duplicate top-level const passes every gate and dies only at user SW boot
  - Evidence: generate-ts-runtime-modules.mjs:121-172 (no collision guard); CI lacks node --check on assembled artifact
  - Touches: .github/workflows/ci.yml, scripts/check-global-collisions.mjs, package.json
  - Acceptance: a deliberate duplicate top-level const fails CI before package
  - Verify: inject a redeclaration → CI fails
- [ ] P2 - Script-author configuration UI (@var / GM_config / CAT_userConfig)
  - Why: biggest userscript-author ergonomic gap vs ScriptCat; reuses the existing UserCSS variable editor
  - Evidence: userConfig/@var hits are UserCSS-only (src/modules/userstyles.ts)
  - Touches: new modules/script-config.js, parser.ts (@var), dashboard.js per-script settings modal, wrapper injection, GM_config shim @require
  - Acceptance: declared @var renders a settings dialog; changes persist via GM_getValue across reload
  - Verify: Playwright declare→open settings→change→confirm GM_getValue
- [ ] P2 - Wire (or delete) the built npm/ESM @require resolver (NF-7, sharpens E-6)
  - Why: NpmResolver is built+hardened but unwired (dead code + bundle), with an unfixed TOCTOU because there is no live path
  - Evidence: CLAUDE.md 2026-06-02 (npmResolve handlers nothing calls)
  - Touches: resource-loader.ts, background.core.js require resolution, ESM badge (E-6)
  - Acceptance: @require npm:lodash@4 resolves + SRI-pins (TOCTOU fixed first), or the module is deleted
  - Verify: install a npm:@require script; or confirm removal shrinks the bundle
- [ ] P2 - Script subscriptions (URL→JSON list) (sharpens E-7)
  - Why: ScriptCat-style curated/auto-updating bundles reusing existing SSRF/SRI/install-source machinery
  - Touches: src/modules/subscriptions.ts, background.core.js poll→pending inbox, dashboard.js import UI
  - Acceptance: adding a subscription imports listed scripts via the SSRF-guarded path; new/orphaned members surface in the inbox, off by default
  - Verify: tests/subscriptions.test.js (manifest parse, internal-URL rejection, orphan detection, off-by-default)
- [ ] P2 - Signed-only enforcement mode (E-2)
  - Why: @signature verification is advisory; users can't enforce a signed-only policy (missing sync-RCE hook)
  - Evidence: bg/signing.js:70-124 (verify advisory, no block)
  - Touches: settings requireSignedScripts off|warn|block, install handler, sync-apply path
  - Acceptance: with 'block', an unsigned/untrusted-key install is refused
  - Verify: unsigned-install-refused test
- [ ] P2 - Tombstone TTL/GC + size cap + multi-device drill (G-1/G-2)
  - Why: unbounded, uncapped tombstones; GC/eviction enables classic distributed-delete resurrection; remote tombstones merged wholesale
  - Evidence: cloud-sync.ts:404/485 (no TTL/cap), :505-536 mergeData
  - Touches: cloud-sync.ts tombstone handling, tests/source-cloud-sync.test.js
  - Acceptance: GC horizon > max offline-device window; count+byte cap (reuse _pushReceipt budget); remote keys validated; multi-device-GC drill passes
  - Verify: new drill test (delete on dev1, GC, sync dev2 → stays deleted)
- [ ] P2 - GM_download scheme/internal-host/filename-traversal validation (B-2)
  - Why: unvalidated download URL + filename reaching chrome.downloads.download (SSRF probe + path write)
  - Evidence: background.core.js:4178-4237
  - Touches: background.core.js GM_download case
  - Acceptance: scheme allow-list + internal-host classify on http(s) + filename sanitized (no /, .., drive letters, reserved names)
  - Verify: traversal-filename + internal-host rejection tests
- [ ] P2 - Editor sandbox postMessage source check (D-1)
  - Why: defense-in-depth; sandbox runs eval/unsafe-inline and accepts messages without event.source check
  - Evidence: editor-sandbox.html:364-436
  - Touches: pages/editor-sandbox.html message handler
  - Acceptance: messages accepted only from window.parent; editor still functions
  - Verify: non-parent source ignored test + manual editor smoke
- [ ] P2 - Wire StatsDAO/BackupsDAO or deprecate (SC-A)
  - Why: two transactional DAOs solve the documented stats race + backup-blob bloat but have zero callers
  - Evidence: grep StatsDAO|BackupsDAO → 0 outside script-db.ts
  - Touches: background.core.js stats path, backup-scheduler persistence, src/storage/script-db.ts
  - Acceptance: StatsDAO.recordRun atomic path wired (no lost update) + backups in IDB store; or DAOs marked @deprecated/removed
  - Verify: tests/stats-dao.test.js concurrent recordRun + backup IDB round-trip
- [ ] P2 - Storage write-lock + batch-atomic reorder/setWithValues (SC-B/SC-C)
  - Why: reorder is one txn per record ("tolerate partial failure"); set() has no per-id lock so save/applyUpdate can race cache vs IDB
  - Evidence: storage.ts:367-383 reorder loop, :295-308 set
  - Touches: src/modules/storage.ts (_writeLocks), src/storage/script-db.ts (bulkPut)
  - Acceptance: reorder is single-txn all-or-nothing; concurrent set on one id → cache equals final IDB row
  - Verify: extend storage-rollback-drill with a mid-reorder abort + 5-concurrent-set test
- [ ] P2 - Readability CI gate (closes H-2)
  - Why: setup/install/trust copy is below Flesch 60; the first blocked-first-run text is dense
  - Evidence: popup.js:386-409, install.js:284-302/:383
  - Touches: scripts/check-readability.mjs, the user-facing string table, popup/install copy
  - Acceptance: user-facing strings score Flesch ≥ 60; gate reports offenders
  - Verify: node scripts/check-readability.mjs --report
- [ ] P2 - Token at-rest "forget on close" + GM_cookie scope (C-2/B-1)
  - Why: refresh tokens plaintext in chrome.storage.local; GM_cookie reads any domain's cookies
  - Evidence: sync-easycloud.js:142; background.core.js:4617-4668
  - Touches: sync token persistence (chrome.storage.session option), GM_cookie cases (intersect @connect)
  - Acceptance: access tokens cleared on session end when enabled; GM_cookie host must be covered by @connect
  - Verify: token-cleared-on-session test + out-of-@connect cookie rejection test
- [ ] P2 - GM_webRequest security-header-strip guard (H-1, via NF-4)
  - Why: a script can strip CSP/X-Frame-Options site-wide via unscoped DNR
  - Evidence: dnr-rules.ts:154-197
  - Touches: dnr-rules.ts _translateWebRequestRule/applyWebRequestRules
  - Acceptance: rules scoped to @match+@connect; CSP/XFO/HSTS strip rejected without a high-privilege toggle
  - Verify: example.com-only script can't affect bank.com; CSP-strip rejected without toggle
- [ ] P2 - migration-v3 getKeys() wipe pass (SC-E)
  - Why: get(undefined) reads the whole legacy store twice on cold-start migration → OOM risk on large installs
  - Evidence: migration-v3.ts:124,153
  - Touches: src/storage/migration-v3.ts
  - Acceptance: wipe pass enumerates keys via chrome.storage.local.getKeys?.() (Chrome 130+), no full get(undefined)
  - Verify: mock N keys → assert no full get(undefined) in wipe path
- [ ] P2 - Firefox MVP: offscreen Acorn fallback + hide side-panel/OAuth + textarea editor + sideload smoke (G-1..G-6)
  - Why: analyzer hard-throws on Firefox (the polyfill is dashboard-only + a no-op stub); this converts the port from lint-clean to actually-runs
  - Evidence: bg/analyzer.js:52-53 (hard throw); dashboard-firefox-compat.js:115-160 (SW-absent stub); FIREFOX-PORT.md Phase 1
  - Touches: bg/analyzer.js (regex/inline-Acorn fallback), popup/dashboard (hide sidePanel + OAuth entries), manifest-firefox (already WebDAV-only), build-firefox sideload
  - Acceptance: install a script with eval() on Firefox returns analyzer findings (no throw); no side-panel/OAuth UI shown; textarea editor works; Phase-1 sideload smoke (create/save/toggle/run) passes
  - Verify: web-ext run / manual sideload smoke
- [ ] P2 - ResponseMap completeness in messages.ts (N-5, F-1 exit)
  - Why: ~25 of 135+ actions typed; F-1 can't reach done until message types are complete
  - Touches: src/types/messages.ts
  - Acceptance: ResponseMap covers all dispatched actions
  - Verify: typecheck + a coverage assertion over the action list
- [ ] P2 - Verify N-1 (fflate 0.8.3) / N-2 (minimum_chrome_version 130) actually landed
  - Why: ROADMAP marks shipped; Zip64 over-read on 500+ script export + CVE wave need confirmation
  - Evidence: lib/fflate.js version banner; manifest.json minimum_chrome_version
  - Touches: lib/fflate.js, manifest.json (if not landed)
  - Acceptance: fflate ≥ 0.8.3 + min_chrome 130 confirmed or bumped
  - Verify: grep version banners; tests/runtime-import-export.test.js
- [ ] P3 - dashboard.js v2.3.0→v3.11.0 version stamp + version-sync gate (GO-B)
  - Why: header comment drift violates the all-version-strings-match rule
  - Evidence: pages/dashboard.js header // ScriptVault Dashboard v2.3.0
  - Touches: pages/dashboard.js, a version-sync gate
  - Acceptance: stamp matches manifest; gate fails on drift
  - Verify: grep version stamps across files
- [ ] P3 - ESM badge branch (EI-5, sharpens E-6)
  - Why: meta.esm + badge slot already exist; ~10-line add
  - Evidence: parser.ts:342, dashboard.js:5384-5443
  - Touches: pages/dashboard.js renderScriptRow
  - Acceptance: @module/@inject-into module scripts show an ESM chip
  - Verify: node --check + tests/dashboard-modules.test.js case
- [ ] P3 - Generate gm-api.d.ts from wrapper-builder (E-4)
  - Why: developer-ecosystem lever; ship typed GM surface in the CWS ZIP
  - Touches: scripts/generate-gm-types.mjs → lib/scriptvault.d.ts, build.sh, package.json gm-types:generate/check
  - Acceptance: a sample TS userscript referencing the .d.ts typechecks; a drift gate fails when wrapper-builder exposes a GM symbol absent from the .d.ts
  - Verify: node scripts/generate-gm-types.mjs --check; tsc --noEmit on a fixture
- [ ] P3 - engines node>=20 + CONTRIBUTING decision (I-3/I-1)
  - Why: trivial engines field; CONTRIBUTING must not surface .factory/ AI-workflow state (no-AI-refs rule)
  - Evidence: package.json engines undefined; .factory/ present, .claude gitignored
  - Touches: package.json, .gitignore/.gitattributes (export-ignore .factory) or a generic CONTRIBUTING
  - Acceptance: engines:{node:'>=20'}; .factory excluded from the public archive OR a generic CONTRIBUTING with no .factory mention
  - Verify: node -e print engines; git archive HEAD inspection
- [ ] P3 - Tamper-evident receipts + txComplete quota-error fidelity (I-4/SC-D)
  - Why: receipts forgeable via storage edit; QuotaExceeded surfaces as opaque "transaction aborted"
  - Evidence: trust-receipt.ts:184-256; transaction.ts:23-32 / idb.ts:143-149
  - Touches: trust-receipt sealing (per-install HMAC), src/storage/transaction.ts/idb.ts
  - Acceptance: edited receipt fails verification; QuotaExceededError name preserved through rejection
  - Verify: forged-receipt rejection + forced-QuotaExceeded name test
- [ ] P3 - True @background DOM-less scripts (NF-8)
  - Why: ScriptCat parity; scheduled jobs with zero matching tabs
  - Touches: offscreen.{js,html} restricted GM runner, background.core.js dispatch, wrapper-builder DOM-less variant, parser @background
  - Acceptance: a scheduled @background script fires GM_notification with no matching tab open; off by default
  - Verify: offscreen background-runner test
- [ ] P3 - dashboard.html CSS extraction + theme-var coverage test (GO-C)
  - Why: 70% inline <style>; the catppuccin/oled missing --panel-* bug class is currently invisible
  - Touches: pages/dashboard.html, new pages/dashboard.css/themes.css
  - Acceptance: every theme defines every referenced var; CSS lintable separately
  - Verify: visual smoke + a var-coverage test across the 4 themes
- [ ] P3 - GM.* namespace completeness + GM.fetch (EI-7); GM_addValueChangeListener remote flag (EI-6)
  - Why: GM4/modern scripts assume full GM.* async + remote semantics
  - Touches: wrapper-builder.ts (GM.* generation + listener dispatch)
  - Acceptance: GM.* == GM_* set; GM.fetch honors @connect; cross-tab listener fires with remote=true
  - Verify: wrapper enumeration test + two-tab listener test

---

## Quick Wins

- EI-1 What's New v3.x entry (~10 lines) + freshness gate.
- EI-5 ESM badge branch (~10 lines).
- I-3 `engines: {node: '>=20'}`.
- GO-B dashboard.js `v2.3.0`→`v3.11.0` version stamp.
- BR-C `node --check background.js pages/dashboard.js` CI step (~50 ms).
- S-1 close stale I-2 (all six rows already in `docs/readme-feature-claim-checklist.md:62,82-87`).
- A11Y-L1 toast double-announce fix.
- H1-2 wrap literal-backtick help text in `<code>`.
- SC-E `getKeys()` wipe pass.
- Delete gamification/heatmap/recommendations (anti-feature bloat class) — shrinks bundle, removes README claims.

## Larger Bets

- NF-2 E2E sync encryption + C-2 token wrapping.
- NF-3 script-author configuration UI.
- NF-4 per-script host scope (umbrella over NF-1/B-1/H-1).
- GO-A handler-registry + F-1b divergent collapse + F1-D wrapper-builder promotion (the TS-authoritative endgame).
- E-5 Playwright E2E harness (and a real `chrome.userScripts` integration layer).
- NF-8 true `@background` scripts.
- F-4 Sigstore `@require-provenance` (after NF-5 TOFU interim).
- F-5 module-mode SW (after GO-A/F-1b).

## Explicit Non-Goals

- A proprietary first-party sync backend (keep provider-agnostic; it's a competitive advantage over Tampermonkey).
- Wiring gamification / heatmap / recommendations / depgraph as features — same bloat class as the already-deleted analytics/AI modules; prefer deletion.
- A full onboarding wizard (intentionally removed in v2.0.0); keep first-run guidance to a lightweight dismissible strip.
- Default-on MAIN-world `@grant none` raw injection (CSP footgun); keep gated + warned.
- Promoting `@include`/`@exclude` as first-class for new scripts (quoid is deprecating them); steer the pattern builder to `@match`.
- Runtime `import()` for ESM userscripts (permanently rejected in `docs/esm-userscript-research.md`); pre-bundle only.
- Module-mode SW (F-5) as a god-object fix — it does not reduce the monolith; sequence it last, purely to enable later ESM splitting.

## Open Questions (blockers only)

- **NF-2 / C-2:** Confirm the acceptable UX for lost-passphrase (E2E is unrecoverable by design). Block on a product decision: warn-and-proceed vs require a recovery export.
- **F5 / E-8 Firefox:** `navigator.storage.persist()` may prompt on Firefox and behave as a silent grant on Chrome — live-validate before claiming the durability fix covers the Firefox MVP.
- **I-1 CONTRIBUTING:** `.factory/` is AI-workflow state under the no-AI-refs rule. Block on the user choosing (a) gitignore/export-ignore `.factory` and drop the CONTRIBUTING note, or (b) a generic CONTRIBUTING that never names `.factory`.
- **O-1 triage policy:** For each orphaned module the user must confirm wire-vs-delete; the default recommendation is delete for gamification/heatmap/recommendations/depgraph and wire for gist (fold into sync cockpit), scheduler (after NF-9), and one canonical grouping primitive among collections/profiles/chains.
