# ScriptVault Roadmap

> Single source of truth for planned work. Tiered by execution priority.
> Completion history lives in [`COMPLETED.md`](COMPLETED.md); the research and
> planning map lives in [`RESEARCH_REPORT.md`](RESEARCH_REPORT.md). Legacy
> planning passes (Rounds 1-14, Cycles 1-20) are archived under `docs/archive/`.
>
> **Roadmap version:** Round 92 - GM value sync support unchecked-state wording coverage 2026-06-07.
> **Shipped baseline:** v3.11.0 (2026-05-19, tag pushed). `main` has additional unreleased hardening, TS promotion, Firefox validation, and release-trust commits through 2026-06-06.
> **Test suite:** 1547 Vitest cases green; `npm audit --audit-level=high --omit=optional` clean; 28/28 TS-promoted runtime entries; 0 mirrored; 0 divergent.
> **Source floor:** 400+ external URLs across Rounds 1-40. Every Now/Next item carries source IDs from the Appendix.
>
> Last researched: Round 92 - 2026-06-07.

---

## Market Context

Tampermonkey was removed from the Chrome Web Store in mid-2025 after failing MV3 compliance [S01]. Violentmonkey remains MV2-only and is dead on Chrome 133+ (delisted, cannot be installed or re-enabled) [S02, S03]. ScriptCat (4.5K stars) is MV3-native but niche, with privacy concerns and stability complaints [S04]. Greasemonkey and FireMonkey are Firefox-only MV2 extensions [S05, S06].

**ScriptVault is one of the only MV3-native, open-source, full-featured userscript managers available on the Chrome Web Store.** This is a once-in-a-decade adoption window. The roadmap prioritises capitalising on it: polish the CWS listing, ship Firefox AMO, land Edge, and close the remaining GM API parity gaps that would prevent Tampermonkey/Violentmonkey refugees from switching.

---

## How to Read This Roadmap

| Tier | Meaning | Timeframe |
|------|---------|-----------|
| **Now** | Active queue. Ship in v3.12.0. | Days to weeks |
| **Next** | Planned for v3.13.0-v3.14.0 after Now clears. | Weeks to months |
| **Later** | Validated direction, not yet scheduled. | Months to quarters |
| **Under Consideration** | Promising but needs more research or user signal. | Unscheduled |
| **Rejected** | Evaluated and declined, with reasoning. | N/A |

Priority labels within tiers: **P0** safety/security/data-loss, **P1** core workflow gaps, **P2** polish, **P3** nice-to-have.

## Now (v3.12.0)

### N-1. Settings Schema Parity and Accessible Validation
- **Priority:** P1 | **Effort:** L | **Source:** [S07, S08, S09]
- **Problem:** `settings-defaults.json` has 72 keys, dashboard exposes 91 controls, and 51 saveable keys are missing from defaults/types. Invalid security-sensitive values can be saved without field-level validation.
- **Deliverable:** Schema-driven defaults, type/range constraints, accessible text errors (WCAG 2.1 SC 3.3.1), and a parity gate in CI.
- **Status:** Shipped 2026-06-06.
- **Progress:** Schema classification and `npm run settings:schema:check` shipped 2026-06-06. Cycle 62 added S3 sync field validation metadata, native dashboard constraints, accessible error nodes, and blur/save validation for endpoint, region, bucket, and object key. Cycle 63 added sync credential validation metadata, native limits, accessible error nodes, and save-blocking validation for WebDAV URL/username/password, sync encryption passphrase, and S3 access/secret keys; WebDAV URL is required only for WebDAV, S3 access and secret keys are required only for S3, and sync encryption cannot be enabled without a passphrase. Cycle 64 added validation metadata, error nodes, and save-blocking allowed-option checks for editor font size, indentation width, and tab size. Cycle 65 added the same allowed-option validation for update check, notification hide delay, and externals update interval selects, and fixed `0`/"Never" values so they no longer collapse to fallback values. Cycle 66 added validation metadata, error nodes, and save-blocking allowed-option checks for content script API, sandbox mode, CSP modification mode, and HTTP header modification mode. Cycle 67 added the same allowed-option validation for default tab type, local file, cookie, communication, SRI, include, @connect, incognito, page filter, block severity, strict mode, and top-level await selects; block severity now persists only after option validation converts the selected value to a number. Cycle 68 added validation metadata, error nodes, and save-blocking allowed-option checks for the remaining schema-backed selects: badge info, blacklist source, config mode, download mode, editor theme, highlight matches, indent style, key mapping, logging level, popup columns, script order, search integration, tab mode, and trash mode; popup columns now persists only after option validation converts the selected value to a number. Cycle 69 added validation metadata, native length limits, accessible error text, and save-blocking validation for dashboard custom CSS, preserving whitespace while rejecting unsafe control characters and overlarge CSS. Cycle 70 added a durable acceptance rule: every dashboard-backed schema metadata control that can accept malformed input (`select`, text, textarea, number, password, URL) must declare validation metadata, while checkboxes and readonly fields stay exempt. The repository schema passes that gate, so N-1 is complete.
- **Acceptance:** Every visible setting has schema-backed validation; invalid fields show inline errors and do not persist; `npm run test:a11y` covers malformed-input fixtures.

### N-2. GM.* Namespace Parity and Guarded GM.fetch
- **Priority:** P2 | **Effort:** M | **Source:** [S10, S11, S12]
- **Problem:** Wrapper exports many `GM_*` callbacks but fewer `GM.*` promise aliases. Missing: `GM.addElement`, `GM.audio`, `GM.cookie`, `GM.focusTab`, `GM.getMenuCommands`, `GM.head`, `GM.log`, `GM.webRequest`. No `GM.fetch`. Scripts written for Tampermonkey/Violentmonkey's GM.* style fail silently.
- **Deliverable:** Generated alias parity table with drift test. `GM.fetch` only if it reuses existing `GM_xmlhttpRequest` host-scope, `@connect`, abort, redirect, and internal-host policy.
- **Status:** Shipped 2026-06-06.
- **Progress:** Cycle 32 added the direct `GM.*` aliases and the drift test while deferring `GM.fetch` until its network contract could reuse `GM_xmlhttpRequest`. Cycle 71 shipped `GM.fetch` and `GM_fetch` as a guarded compatibility surface over the existing XHR bridge, preserving `@connect`, host-scope, abort, redirect, no-cache, and internal-host checks without adding a new background `GM_fetch` action. Ambient declarations and the generated runtime artifacts now include the fetch surface, and the parity test asserts that future changes keep it on the guarded XHR path.
- **Acceptance:** `GM.fetch` returns a Fetch `Response`, supports abort signals and RequestInit headers/body/credentials/cache/redirect inputs, can be granted as `GM.fetch` without widening direct `GM_xmlhttpRequest`, and remains covered by GM namespace/type/runtime generation checks.

### N-3. GM_addValueChangeListener Cross-Tab `remote` Semantics
- **Priority:** P2 | **Effort:** S | **Source:** [S10, S11]
- **Problem:** TM and VM document that the `remote` argument to value-change listeners is `true` when the change originated in another tab. ScriptVault implements the listener but has no browser-level proof.
- **Deliverable:** Two-tab Playwright E2E test that writes in tab A and observes `remote: true` in tab B.
- **Progress:** Cycle 33 added deterministic coverage for the background fan-out contract (`remote: !isOriginTab`) and wrapper callback boundary (`msg.remote !== false`) plus a Playwright two-tab spec. The live spec self-skips in unattended Chromium profiles where `getExtensionStatus` reports `setupState: allow-user-scripts-disabled` / `chrome.userScripts is unavailable`.

### N-4. Firefox Phase 5: AMO Submission
- **Priority:** P2 | **Effort:** M (external dependency) | **Source:** [S13, S14, S15]
- **Problem:** Firefox package is AMO-validation-ready (0 lint errors, full sideload smoke), but not published.
- **Deliverable:** AMO developer account, unlisted upload with source ZIP, signed XPI smoke, reviewer feedback loop, listed publication.
- **Remaining blocker:** Maintainer AMO credentials and account setup.

### N-5. CWS API v2 Migration
- **Priority:** P1 | **Effort:** S | **Source:** [S16]
- **Problem:** Chrome Web Store API v1 sunsets October 15, 2026. Current publish tooling may use v1 patterns.
- **Deliverable:** Verify and migrate all CWS publish tooling to API v2 (service account auth, programmatic rollout). Update `docs/release-runbook.md`.
- **Status:** Shipped 2026-06-06. `publish.sh` uses `chrome-webstore-upload-cli@4` with `PUBLISHER_ID`, v2 upload/publish calls, and optional `CWS_DEPLOY_PERCENTAGE` rollout control. `npm run cws:check` now pins the active v2 upload, publish, rollout, and fetchStatus endpoint contract, fails on active v1.1 endpoint regressions, and records the service-account/OIDC target with OAuth as the current local fallback.

### N-6. Monaco Editor ESM Migration Planning
- **Priority:** P2 | **Effort:** S (research) | **Source:** [S17]
- **Problem:** Monaco v0.53.0 deprecated AMD loading. ScriptVault bundles v0.52.2 with AMD.
- **Deliverable:** Research note documenting ESM migration path for the sandboxed editor iframe, CSP compatibility, and Firefox fallback implications.
- **Status:** Shipped 2026-06-06 in `docs/monaco-esm-migration-plan.md`. Decision: keep AMD for v3.12.0, migrate Chromium to a bundled local ESM editor in X-4, keep Firefox textarea-first until AMO lint and smoke evidence prove chunked Monaco workers are acceptable, and reject CDN/direct-unbundled ESM loading.

### N-7. UserScripts Setup Doctor and Rehydration Audit
- **Priority:** P1 | **Effort:** M | **Source:** [S47, S48, S74]
- **Local evidence:** `pages/dashboard.js` and `pages/popup.js` already detect `allow-user-scripts-disabled`, `developer-mode-disabled`, Firefox optional `userScripts`, and host-permission setup states; `README.md` documents Chrome 138+ and Firefox setup; MDN confirms Firefox MV3 requires optional-only `userScripts`; Chrome docs confirm extension updates clear user-script registrations.
- **Problem:** ScriptVault's core value disappears when `chrome.userScripts` is disabled, when Firefox's optional permission is missing, or when an extension update clears registrations. Existing banners explain the issue, but the release gate does not yet prove every setup state, permission recovery action, and update re-registration path stays working across Chrome/Edge/Firefox.
- **Deliverable:** Browser setup doctor that is test-backed as a product surface, not only ad hoc banners: one consistent dashboard/popup state model, a copy-safe "open extension details" action where the browser permits it, Firefox permission request retry, host-grant retry, and explicit post-update registration rehydration evidence.
- **Progress:** Cycle 53 records the last registration sweep as aggregate support-safe evidence in the local health report. `registerAllScripts()` now reports unavailable setup, global-disable skips, already-current diffs, stale cleanup, diff registration, forced/full registration, and error states without script names, script IDs, source, or URLs; support snapshots include that data through the existing local health payload.
- **Acceptance:** Playwright or smoke fixtures cover Chrome 138+ with Allow User Scripts off/on, Chrome 120-137 developer-mode fallback copy, Firefox optional permission missing/granted, host-permission-needed recovery, and extension-update re-registration. Support snapshots include setup state and last registration sweep result without script names, script source, or URLs.
- **Remaining:** Browser-profile fixtures still need to prove Chrome 138+ toggle behavior, pre-138 developer-mode fallback, Firefox optional permission retry, and host-permission recovery in a live browser. The support-snapshot aggregate evidence path is now implemented and pinned.
- **Risk:** Browser extension UIs cannot programmatically flip Chrome's Allow User Scripts toggle; keep all copy honest and avoid promising one-click enablement when the browser requires user action.

### N-8. Editor Local-Save Trust Receipt Contract
- **Priority:** P1 | **Effort:** S | **Source:** [S47, S75, S81, S89, S90]
- **Local evidence:** `pages/dashboard.js` now routes editor manual saves and autosaves through `buildEditorSaveTrustOptions()`, sending `operation: 'local-save'`, `sourceKind: 'local-editor'`, a dashboard source label, and `suppressMetadataSourceFallback: true`; autosaves also use an ephemeral `localSaveSessionId` stored only in open tab state. `src/background/core.ts`, `src/background/trust-receipt.ts`, `src/types/messages.ts`, and `src/types/script.ts` preserve local receipt source metadata while keeping update/download/homepage URLs available for review; the background save path keeps autosave coalescing in an in-memory `_localSaveReceiptCoalescing` map, not script records. `src/storage/script-db.ts` keeps File System Access handles in a separate `localWorkspaceBindings` IndexedDB store and returns display-safe summaries by default. `pages/dashboard.html` and `pages/dashboard.js` now add feature-detected `Bind File`, `Refresh File`, and `Unbind` editor-toolbar actions. Refresh requests permission only from the user action, reads a bound file into a review diff, applies through `saveScript` with a `local-file` receipt only after Apply, and keeps no-change/cancel/error paths out of save history. `tests/local-save-trust-receipt.test.js`, `tests/trust-receipt.test.js`, `tests/storage.test.js`, `tests/local-workspace-dashboard.test.js`, and export/sync/support snapshot tests pin the source/coalescing/redaction/binding/refresh contract.
- **Problem:** X-8 local workspace edits and X-9 publish handoffs need a consistent "what did I just save?" audit trail. Today normal editor saves mark the script as locally modified but can keep the previous trust receipt, which weakens rollback explanation, support snapshots, and future local-file binding review.
- **Deliverable:** Route editor/manual/local-file saves through an explicit local-save receipt path: `trust: { recordReceipt: true, operation: 'local-save', sourceKind: 'local-editor', sourceLabel: 'Dashboard editor' }`, a receipt/source schema that can suppress metadata URL fallback for local saves, coalescing rules for autosave bursts, and a dashboard badge that distinguishes "Local edit" from "Bound local workspace" without storing absolute paths or serialized file handles in script records, exports, sync payloads, or support snapshots.
- **Cycle 51 implementation slices:** (1) extend `SaveScript.trust` and `createScriptTrustReceipt()` with a reviewed `sourceKind/sourceLabel` or `forceLocalSource` field so `local-save` receipts render as local even when the userscript still declares `@downloadURL`; (2) add a small dashboard helper, e.g. `buildEditorSaveTrustOptions({ autosave })`, and use it from `saveCurrentScript()` instead of duplicating literal payloads; (3) add an autosave coalescing token stored outside exported script data so repeated two-second autosaves update the active local-save receipt/window rather than creating noisy rollback history; (4) add `localWorkspace`/file-handle future keys to local-only settings or, preferably, a separate non-exported local workspace store before X-8 starts; (5) keep drag/drop and install-page saves on install/update receipts unless they are explicitly local-file refreshes; (6) teach `renderTrustReceiptInfo()` and the provenance badge to render `local-save` as local editing activity while preserving remote update/download URLs in normal metadata fields.
- **Progress:** Cycle 54 shipped the local editor save receipt path: typed save trust payloads accept `sourceKind`, `sourceLabel`, `suppressMetadataSourceFallback`, and optional permission outcomes; both receipt builders suppress metadata URL fallback for local sources; dashboard manual saves and autosaves request local receipts; the receipt panel shows the local source label; and focused tests cover dashboard wiring plus local receipt source behavior. Cycle 55 added autosave coalescing: dashboard autosaves send an ephemeral coalesce key/window, the background save path reuses the original rollback history entry during that window, manual/non-coalesced saves clear the in-memory state, the key is absent from script types, and the path still calls `reregisterScript(script)`. Cycle 56 added the local-only binding-store skeleton, deletes bindings with their script, returns summaries without handles/paths, strips future local workspace settings from JSON exports, and pins CloudSync, EasyCloud, and support snapshot redaction. Cycle 57 added the first dashboard `Bind File` action: it is hidden/disabled without `showOpenFilePicker`, calls the picker directly from the click handler, stores the handle only in local IndexedDB, renders display-name/permission summaries, and does not read/apply code or write save history. Cycle 58 added `Refresh File` and `Unbind`: refresh retrieves the stored handle, requests read permission only from the user action, updates stale/error/no-change summaries, shows a review diff for changed files, and applies through a `local-save`/`local-file` receipt only after user acceptance.
- **Acceptance:** Focused tests prove dashboard manual save sends the local-save trust payload, `saveScript` local-save writes a new receipt when code changes, `receipt.source.installHost` is `local` or blank rather than the script's `@downloadURL` host, rollback metadata points to the previous version, the five-entry cap remains enforced, no-code saves do not churn history, autosave bursts coalesce, future file-handle/local-path metadata is excluded from JSON export, cloud export, EasyCloud sync, and support snapshots, and the path still uses `reregisterScript()` rather than a full registration sweep. Manual editor save, autosave, drag/drop install, install-page update, and future File System Access refresh tests must prove which receipt operation each path records.
- **Risk:** Autosave can create noisy receipts and version history churn. Coalesce repeated autosaves for the same script until the user closes the editor, manually saves, or applies a local-file diff.

### N-9. Deep Audit Security Closures
- **Priority:** P0 | **Effort:** S-M | **Source:** Local deep audit (`docs/research-deep-audit-2026-06-06.md`)
- **Local evidence:** The deep audit identified three immediate security closures: `GM_addElement` `srcdoc` bypass, `@crontab` isolated-world escalation, and `PublicAPI.isInternalHost` drift from `InternalHostGuard`.
- **Problem:** These findings can affect script/page isolation or trusted-origin install safety, so they outrank polish/evidence work until closed.
- **Status:** Shipped 2026-06-06. All three closures are complete.
- **Progress:** Cycle 59 closed EI-1 by blocking `srcdoc` in `GM_addElement` direct attributes and sanitized `innerHTML`, updating both `src/background/wrapper-builder.ts` and `src/background/core.ts`, regenerating runtime artifacts, and adding a DOM security regression. Cycle 60 closed EI-2 by moving scheduled `@crontab` execution to `chrome.userScripts.execute` in `USER_SCRIPT` world when available, falling back only to `chrome.scripting.executeScript` in `MAIN` world, removing the scheduled `ISOLATED`/`new Function` path, and pinning the scheduler regression. Cycle 61 closed EI-3 by making `src/modules/public-api.ts` import the canonical `isInternalHost` from `src/background/internal-host-guard.ts`, regenerating `modules/public-api.js` and `background.js`, and adding trusted-origin, webhook, install URL, and source-parity regressions for `.localhost`, TEST-NET, benchmarking, Class E, and IPv4-mapped IPv6 hex hosts.
- **Remaining:** None.
- **Acceptance:** Each closure has source and generated runtime coverage, focused regression tests, full `npm run check`, `npm run build`, and `npm run cws:remote-code:check`.

## Next (v3.13.0 - v3.14.0)

### X-1. Edge Add-ons Publication
- **Priority:** P2 | **Effort:** M | **Source:** [S18, S19]
- **Problem:** Edge package and report exist, but no Partner Center listing or Edge browser smoke.
- **Deliverable:** Edge sideload smoke, Partner Center upload, Edge Add-ons REST API v1.1 CI/CD integration.
- **Progress:** Cycle 36 ran `npm run smoke:edge` on Microsoft Edge 146.0.3856.97, enabled the temporary profile's Allow User Scripts toggle, loaded the staged package, verified dashboard/popup rendering, saved/toggled a smoke userscript, and confirmed it executed on a local target page. Committed sanitized evidence in `docs/audit/edge-smoke-3.11.0.json` and updated the support matrix generator to surface live smoke evidence. Partner Center upload and Edge Add-ons REST automation remain credential/listing gated.

### X-2. DOM-less @background Scripts
- **Priority:** P2 | **Effort:** XL | **Source:** [S04, S20, S21, S82, S83, S84]
- **Problem:** ScriptCat's killer feature is background/cron scripts without an open tab. ScriptVault's `@crontab` is tied to page lifecycle.
- **Deliverable:** Default-off `experimentalBackgroundScripts`, parser support for `@background`, DOM-less wrapper variant, offscreen document runner, resource/time budget controls.
- **Progress:** Cycle 37 added parser/type support for `@background`, the internal default-off `experimentalBackgroundScripts` setting, a dormant page-registration guard so `@background` scripts do not run as normal userscripts before the DOM-less runner exists, and `docs/background-scripts-design.md` to pin runner/API/safety gates. Cycle 38 added `src/background/background-runner.ts` as a pure planner for gate status, supported triggers, restricted GM grants, and reviewed budget limits; no code execution is enabled yet. Cycle 39 wired planner status into registration logging and local-health diagnostics so dormant background scripts are explainable without exposing script names, source, or URLs. Cycle 40 added `src/background/background-wrapper.ts`, a non-wired DOM-less wrapper scaffold that exposes only reviewed GM value/XHR/notification/log/info APIs and fails closed for DOM/page globals. Cycle 41 added `src/background/background-runner-bridge.ts` to assemble eligible plans plus wrapper payloads while still reporting `executionEnabled: false`. Cycle 42 added the runtime `prepareBackgroundRunnerDryRun` action, which reports planner/wrapper eligibility without returning wrapper code or executing scripts. Cycle 43 surfaces sanitized dry-run results in support snapshots only when the user opts into script inventory. Cycle 44 added the CWS remote-code guard that blocks any future offscreen `@background` eval/new Function runner until a compliant execution architecture is approved.
- **Execution blocker:** Actual offscreen/service-worker execution of user script bodies is blocked by the current Chrome Web Store compliance contract: extension service workers/pages/offscreen documents must not execute user code directly. Continue only after a compliant execution architecture is selected and documented.
- **Cycle 49 architecture decision:** Do not wire `offscreen_background_run` or any service-worker/offscreen eval path. The only viable local prototype candidate is a dedicated manifest sandbox runner page with no extension API access, `allow-scripts` only, a strict postMessage capability protocol, and GM calls proxied back through the service worker after scriptId/grant/host/budget checks. Chrome's remote-hosted-code guidance explicitly calls sandboxed iframes a possible string-evaluation environment, while Chrome offscreen docs say offscreen documents are limited to `chrome.runtime` and should not become replacement background pages. This candidate still needs a CWS reviewer memo and a source scanner allowlist that permits eval only in the declared sandbox runner, not in extension pages, service worker, or offscreen document.
- **Rejected Cycle 49 alternatives:** (1) `chrome.userScripts.execute` cannot satisfy no-open-tab cron because it needs a target document; keep it for "Run now" only. (2) `chrome.debugger` is too broad, user-visible, and explicitly not a substitute execution environment. (3) native messaging or cloud execution would add install friction and push ScriptVault away from local-first userscript management.
- **Acceptance for first executable prototype:** A sandbox page is declared in `manifest.json` with no extension APIs; payloads never include remote-fetched unreviewed code; the runner requires a per-run nonce and scriptId; service-worker GM proxy handlers enforce the existing `@connect`, internal-host, notification, and storage policies; timeout/queue clamps match `planBackgroundScript()`; support snapshots report status without wrapper code; `npm run cws:remote-code:check` fails every eval/new Function path except the named sandbox runner; a Chrome smoke proves a scheduled `@background` script can write GM storage and show a notification without a matching tab.
- **Risk:** Extension review scrutiny. Require review-only install (reuse quarantine flow).

### X-3. Navigation API Integration for SPA Support
- **Priority:** P2 | **Effort:** S | **Source:** [S22, S23, S85, S86, S87, S88]
- **Local evidence:** `src/background/wrapper-builder.ts` already installs a page-scoped `__svUrlChangeBound__` dispatcher when a userscript grants `window.onurlchange`. It listens to `window.navigation.navigate` when present, then falls back to `history.pushState`, `history.replaceState`, `popstate`, and `hashchange`. `tests/wrapper-dom-security.test.js` pins the no-stacked-history-patches contract, but no focused test simulates Navigation API events, route-timing delay, or duplicate suppression when `navigate` and history APIs both observe the same transition.
- **Problem:** "Scripts don't fire on SPA navigation" remains a userscript-manager switching complaint, and Navigation API support is now current enough to use in Chromium-first code. The existing listener is an undocumented incidental path rather than an implementation-ready compatibility contract. Chrome's extension `webNavigation` API is tab/document-level and permissioned, while page-level `window.navigation` is same-origin/current-context scoped, so X-3 should keep the wrapper-owned URL-change contract instead of adding a new extension permission.
- **Deliverable:** Make SPA URL changes a tested `window.onurlchange` contract: a shared `__scheduleUrlChangeCheck(reason)` path for `navigate`, history, popstate, and hashchange; same-turn dedupe by `(oldUrl, newUrl)` so Navigation API plus history shims emit once; a microtask check plus one frame-level recheck for routers that update the URL before rendering; preserved `{ url, oldUrl }` detail shape; and README/dashboard examples that recommend idempotent `window.addEventListener('urlchange', ...)` rebinding.
- **Status:** Shipped 2026-06-06.
- **Progress:** Cycle 72 added the shared `__scheduleUrlChangeCheck(reason)` path for Navigation API, history, popstate, and hashchange, plus same-transition dedupe and a frame-level recheck. `tests/urlchange-wrapper.test.js` now executes the real wrapper in isolated jsdom frames, covers fake Navigation API notifications, duplicate listener suppression, remove-listener behavior, popstate/hashchange fallback, preserved `{ url, oldUrl }` details, and source-level history scheduling. README now documents the `window.onurlchange` grant and idempotent SPA rebinding pattern.
- **Acceptance:** Source-level and jsdom tests cover fake `window.navigation.addEventListener('navigate')`, no-Navigation-API history fallback, `popstate`, `hashchange`, add/remove listener dedupe, no stacked `pushState`/`replaceState` proxies after repeated wrapper builds, one event for combined `navigate` plus `pushState` same-url transitions, and preserved detail shape `{ url, oldUrl }`. A browser smoke against a simple history-router fixture proves a userscript granted `window.onurlchange` reruns after soft navigation without hard refresh.
- **Risk:** `navigate` can fire before an SPA finishes DOM rendering. Do not promise post-render DOM stability; provide the frame-level recheck and keep docs clear that app-specific DOM readiness still needs idempotent observers or selectors.

### X-4. Monaco ESM Build Implementation
- **Priority:** P2 | **Effort:** L | **Source:** [S17, S24]
- **Problem:** Monaco AMD is deprecated. Staying on v0.52.x blocks LSP namespace (v0.55), new features, and security patches.
- **Deliverable:** Migrate `lib/monaco/` to ESM build. Consider Monaco v0.55's LSP namespace for userscript IntelliSense.
- **Status:** Shipped 2026-06-06 for the current ESM migration. A future Monaco version bump needs a separate dependency-budget and browser-proof cycle.
- **Progress:** Cycle 73 added `npm run monaco:package:check`, a static packaging contract for the current pre-migration state. The gate pins Chromium to the packaged local AMD bundle in `lib/monaco/`, keeps `pages/editor-sandbox.html` off remote/CDN editor assets, keeps Firefox packaging on the textarea-first Monaco-free path until AMO lint proof exists, and documents that the same gate must be updated when the X-4 ESM bundle switch lands. Cycle 74 added the first ESM prototype: `src/editor/monaco-esm-entry.ts`, `npm run build:monaco:esm`, ignored `lib/monaco-esm/` output, `npm run monaco:esm:check`, and committed size/layout evidence in `docs/audit/monaco-esm-prototype-2026-06-06.json`. The prototype emits `editor.js`, `editor.css`, a codicon font asset, and five workers. Cycle 75 selected the full-worker Chromium strategy and added explicit budgets to the ESM checker: total <= 26,000,000 bytes, total gzip <= 5,000,000 bytes, `editor.js` <= 9,000,000 bytes, and `ts.worker.js` <= 13,000,000 bytes. Current evidence is 25,186,387 bytes / 4,279,263 gzip bytes, with `ts.worker.js` at 12,156,466 bytes. Cycle 76 switched `pages/editor-sandbox.html` from AMD `vs/loader.js` to local `lib/monaco-esm/editor.css` plus dynamic import of `lib/monaco-esm/editor.js`, removed AMD copying from `esbuild.config.mjs`, and updated `npm run monaco:package:check` to reject AMD loader/copy regressions while keeping `monaco-load-error` fallback behavior. Cycle 77 added `tests/monaco-esm-sandbox-loader.test.js`, a deterministic VM harness that loads the real sandbox script with a fake DOM, proves the ESM CSS/module paths are requested, posts `ready` on a mock Monaco import, and posts `monaco-load-error` when the ESM module is missing. Cycle 78 added `tests/e2e/monaco-esm-sandbox.spec.js`, a Chromium extension-page smoke that opens the packaged sandbox URL, waits for a real Monaco `.monaco-editor`, verifies the local ESM stylesheet/API, and routes `lib/monaco-esm/editor.js` to prove the missing-bundle fallback posts `monaco-load-error`.
- **Progress addendum:** Cycle 79 added `tests/e2e/monaco-adapter-dashboard.spec.js`, a dashboard-level smoke that seeds a script, opens it through the edit icon, proves the Monaco adapter is active, saves changed code through `#btnEditorSave`, reloads, and confirms the saved code returns through the adapter.
- **Acceptance:** Complete: packaged ESM build/layout, size budget, AMD regression gate, CWS scan, deterministic fallback harness, Chromium sandbox smoke, and dashboard adapter save/reload smoke are all covered.

### X-5. `browser` Namespace Cross-Browser Alias
- **Priority:** P3 | **Effort:** S | **Source:** [S25]
- **Problem:** Chrome 148 exposes `browser` namespace alongside `chrome`. Reduces cross-browser divergence.
- **Deliverable:** Evaluate adopting `browser.*` with thin polyfill for Chrome <148.
- **Status:** Shipped 2026-06-06.
- **Progress:** Cycle 80 added `installBrowserNamespaceAlias()` to the promoted shared utilities and runtime generator so extension-owned globals with `chrome.runtime` get a non-enumerable `browser` alias when no native namespace exists. The dashboard compatibility layer now treats Chromium `browser.runtime` as Chrome unless Firefox user-agent or Gecko manifest metadata is present. Tests pin native-browser preservation, inert page globals, generated auto-install, Chromium detection, Gecko detection, and the userscript-wrapper boundary.
- **Acceptance:** Complete: alias installs only where `chrome.runtime` already exists, native `browser` is preserved, Chromium with `browser.runtime` stays classified as Chrome, Firefox is still detected by UA/manifest, and generated userscript wrappers do not install or assign `window.browser`.

### X-6. Trusted Types Documentation
- **Priority:** P3 | **Effort:** S | **Source:** [S26]
- **Problem:** Sites using Trusted Types CSP reject raw `innerHTML` in MAIN-world scripts. USER_SCRIPT world is exempt.
- **Deliverable:** Documentation in README and Help tab. Optional `TrustedTypes` wrapper helper.
- **Status:** Shipped 2026-06-06 as documentation-only guidance.
- **Progress:** Cycle 81 added README and dashboard Help guidance explaining that the default `USER_SCRIPT` world is separate from page Trusted Types policy, while MAIN/page-context scripts and `unsafeWindow` must obey the target page policy for raw `innerHTML`, script URLs, and inline handlers. The docs recommend `textContent`, `append`, `createElement`, and `GM_addElement` with attributes, and warn against broad passthrough TrustedHTML policies. `tests/trusted-types-docs.test.js` pins the README, Help tab, and no-runtime-policy-shim boundary.
- **Acceptance:** Complete: author-facing README guidance, in-app Help guidance, and static tests are present; no runtime Trusted Types wrapper was added.

### X-7. Script Subscription Feed Improvements
- **Priority:** P3 | **Effort:** M | **Source:** [S04, S27, S93]
- **Problem:** Script subscriptions shipped but are basic JSON feeds.
- **Deliverable:** Feed auto-refresh via `chrome.alarms`, feed health indicators, configurable refresh interval.
- **Status:** Shipped 2026-06-06.
- **Progress:** Cycle 82 added default-on subscription feed refresh scheduling through a managed `subscriptionRefresh` alarm, gated by `subscriptionAutoRefresh`, a visible refresh interval select, and at least one enabled saved feed. The alarm routes through the existing background task mutex and reuses `SubscriptionSystem.refreshSubscriptions()` instead of adding a parallel fetch path. The Utilities subscription list now shows Healthy, Needs attention, Not checked, or Disabled status from existing refresh timestamps/errors, and focused tests pin scheduler settings, alarm dispatch, rescheduling triggers, dashboard controls, and health labels.
- **Acceptance:** Complete: feeds can auto-refresh on a configurable interval, disabled/empty feed sets do not keep a needless alarm, add/remove/settings changes reschedule the alarm, and dashboard feed rows expose health state.

### X-8. Developer Workspace and Local File Watch Mode
- **Priority:** P2 | **Effort:** L | **Source:** [S29, S30, S77, S78, S79, S81, S89, S90, S91, S92]
- **Local evidence:** ScriptVault already has Monaco, `lib/scriptvault.d.ts`, `Open in vscode.dev`, Gist import/export, install-source provenance, and `local-save` receipts. Cycle 57 adds the first File System Access workspace entry point: `pages/dashboard.html` exposes an editor-toolbar `Bind File` control and local workspace status chip, while `pages/dashboard.js` feature-detects `showOpenFilePicker`, calls it directly from the user click handler, writes handles only to local IndexedDB, and renders display-safe permission summaries. `pages/dashboard.js` still imports via file input/drag/drop and sends `.user.js` files through `createScript`, while JSON/ZIP imports use quarantine/receipt paths. `src/background/core.ts` JSON/cloud export can include script settings and `versionHistory`; `src/background/cloud-sync.ts` and `src/modules/sync-easycloud.ts` strip only allowlisted settings, so file handles, absolute paths, or local binding metadata must not be stored in `Script.settings` or `Script.versionHistory`. The existing Settings row "Allow scripts to access local files" is an execution/security preference and should not be reused as the developer workspace binding control.
- **Problem:** Power users repeatedly want to edit in VS Code or another IDE without copy-save-reload loops. Tampermonkey documents local `@require` and a separate Editors extension for vscode.dev, but those flows are awkward, browser-specific, and easy to confuse with unsafe local-file access.
- **Deliverable:** Opt-in developer workspace mode: bind a script to a user-picked local `.user.js` file or folder through the File System Access API on Chromium, show a clear local-source badge, import metadata and code on demand, queue changed files as review-only updates, preserve ScriptVault rollback/trust receipts, and keep Firefox on manual file import until a secure equivalent exists.
- **Progress:** Cycle 56 added `LocalWorkspaceBindings` as a local-only IndexedDB-backed store in `modules/storage.js`. It can persist `FileSystemHandle` objects separately from `ScriptStorage`, returns display-safe summaries that omit handles and absolute paths, and is cleaned up when scripts are deleted or storage is cleared. Cycle 57 wired the first dashboard binding action: it stores a picked `FileSystemFileHandle` in the same local-only store from the extension page, surfaces display-name/permission summaries, and deliberately avoids refresh/apply execution until a review modal exists. Cycle 58 wired `Refresh File` and `Unbind`; refresh is review-only, handles permission reconnect/stale-file/no-change/error summaries, and applies changed local files through normal `saveScript` receipt/registration behavior only after Apply.
- **Progress addendum:** Cycle 83 added explicit local workspace refresh status summaries. Binding records now carry `lastStatusKind` alongside `lastErrorKind`, the editor status chip distinguishes bound, unchanged, applied, review-cancelled, missing-handle/file-missing, read/apply failure, and permission-denied states, and focused tests pin that summaries still omit handles and absolute paths. Cycle 84 added aggregate local-workspace health evidence: local health reports count bindings, bound scripts, permission states, refresh statuses, error states, and refresh age without handles, local paths, names, URLs, source, binding IDs, or script IDs; support snapshots strip the local-workspace block unless script inventory is selected. Cycle 85 tightened local refresh acceptance by rejecting oversized files before text reads, classifying parse failures separately from apply failures, and pinning that accepted local applies still route through `saveScript` and normal re-registration.
- **Acceptance:** Chromium smoke can bind a local script, detect a file change after a user-triggered refresh or supported watcher, show a diff before applying, save a rollback point, and execute the updated script after normal userScripts registration. Firefox package omits unsupported File System Access UI or shows a manual-import fallback. No implementation grants blanket `file://` access and no watched file is executed without the normal review/save path.
- **Cycle 48 implementation slices:** (1) land N-8 first so every local apply records a receipt; (2) add an editor-toolbar "Bind local file" action gated by `showOpenFilePicker` feature detection and user gesture rules; (3) store any `FileSystemFileHandle` only in a non-exported local workspace store, with display-name-only metadata on the script; (4) implement "Refresh from local file" as review-only diff apply, not background auto-execution; (5) leave Firefox on the existing file input/drag-drop install path with explicit copy that watch mode is Chromium-only until a safe equivalent exists; (6) add tests around permission denied, file removed, changed metadata, oversized file, parse error, and successful re-registration.
- **Cycle 52 data-model/UI slices:** (1) create a local-only binding store, e.g. `localWorkspaceBindings`, separate from `ScriptStorage`, with `{ bindingId, scriptId, handle, displayName, lastKnownSha256, lastKnownSize, lastKnownModified, permissionState, createdAt, updatedAt, lastRefreshAt, lastErrorKind }`; (2) store `FileSystemFileHandle` in IndexedDB/chrome local data only and expose only display-name/status summaries to script rows, support snapshots, and health reports; (3) add editor actions `Bind local file`, `Refresh from local`, and `Unbind` in the toolbar or Info panel, all hidden/disabled when `showOpenFilePicker` is absent; (4) call `showOpenFilePicker()` only inside the user click handler, then use `queryPermission()` to render status and `requestPermission()` only from an explicit reconnect/refresh action; (5) read changed files into a diff/review modal and apply through N-8 `saveScript` with `operation: 'local-save'`, `sourceKind: 'local-file'`, and `sourceLabel: handle.name`; (6) keep any "watch" copy conservative until there is real polling or file-change evidence, naming the first release "Refresh from local file"; (7) update support snapshots with aggregate counts/permission states only when script inventory is opted in, never absolute paths or serialized handles.
- **Cycle 52 acceptance gates:** Source tests prove `showOpenFilePicker` is feature-detected, called only from a click-bound handler, and never used in Firefox fallback UI; export/cloud-sync tests prove binding records, file handles, and absolute paths are absent from JSON export, ZIP export, EasyCloud uploads, generic cloud sync envelopes, and support snapshots; dashboard tests prove bound/local/reconnect/error states have accessible labels and do not conflate with the existing "Allow scripts to access local files" setting; refresh tests cover permission denied, stale handle, deleted file, oversized file, parse error, no-change hash, changed metadata, diff preview cancel, successful apply, rollback receipt, five-entry history cap, and `reregisterScript()` rather than full registration sweep.
- **Risks:** File System Access support varies by browser; local files can bypass remote-source reputation; CWS review may scrutinize any feature that appears to run arbitrary local code. Treat local workspace as a developer feature with explicit consent and release-runbook reviewer notes.

### X-9. Store-Safe Greasy Fork Publish Handoff
- **Priority:** P3 | **Effort:** M | **Source:** [S39, S76]
- **Local evidence:** `pages/dashboard-store.js` searches and installs from Greasy Fork/OpenUserJS; install provenance already labels Greasy Fork and OpenUserJS; `L-10` currently says "GreasyFork API" but Greasy Fork's documented update path is a prefilled form, not a normal write API.
- **Problem:** A direct "publish to Greasy Fork" integration could accidentally imply credential storage, session-cookie capture, or background POSTs against a user account. Greasy Fork documents read-only JSON/JSONP plus a prefill form that requires the user's session cookie and review/submit step.
- **Deliverable:** Replace direct API assumptions with a browser-mediated publish handoff: generate the correct prefill payload from the current editor buffer, open Greasy Fork's new-version/update form, let the user review and submit in their logged-in browser session, and record only a local publication receipt after the user confirms.
- **Acceptance:** No Greasy Fork credentials, cookies, or CSRF/session values are stored by ScriptVault. The flow distinguishes new script vs existing script ID, validates metadata before handoff, shows exactly what code will be posted, and falls back to copy/download when Greasy Fork is unreachable. Tests pin that the feature does not call Greasy Fork publish endpoints from the service worker without a user-initiated form handoff.
- **Cycle 48 implementation slices:** (1) add a non-credentialed "Publish handoff" command in the editor actions or Info provenance panel; (2) preflight metadata for `@name`, `@namespace`, `@version`, update/download URLs, license, and Greasy Fork script ID; (3) build a local preview modal that shows the exact code and target form URL; (4) run a live manual proof that a user-initiated top-level form POST to Greasy Fork includes the user's session cookie under current SameSite behavior; (5) if the cookie proof fails, ship only copy/download plus "Open Greasy Fork update form" fallback; (6) record a local publication receipt only after the user confirms they submitted on Greasy Fork, never after background network success.
- **Progress addendum:** Cycle 86 shipped the first implementation slice: an editor `Publish` action now builds a Greasy Fork preflight from the current editor buffer, validates `@name`, `@namespace`, and `@version`, warns on missing license/update/download URLs, distinguishes new-script vs existing-script IDs from Greasy Fork URLs, shows the exact code and target prefill URL locally, and opens only a user-initiated multipart form handoff with copy/download fallbacks. Focused tests pin that the handoff path has no dashboard background publish endpoint, no Greasy Fork API write call, no XHR/fetch publish path, and no stored account/session material. Cycle 87 added the post-handoff confirmation step: after opening the Greasy Fork form, the dashboard asks whether the user submitted it, then records a local-only publication receipt with target URL, mode, Greasy Fork script ID, metadata, code length, and optional SHA-256 hash, while omitting the submitted source body and account/session material. The Info panel now reloads and displays the latest local publication receipt. Cycle 88 hardened the fallback path for sessions without a logged-in Greasy Fork proof: the Info panel now renders recent local publication receipt history, keeps the stored-source/account/session redaction boundary visible, and lets the user clear only the local receipt history for the current script. Cycle 89 added a copyable local receipt summary that includes target, version, size, timestamp, and SHA-256 evidence while continuing to omit submitted source and account/session data. Cycle 90 added a local text-download export for the same sanitized receipt summary, using a Blob URL plus download filename and revoking the object URL after dispatch. Cycle 91 added an `Open Greasy Fork` action in the preflight modal so users can check their session before posting the prefilled form; it opens only the Greasy Fork base URL with noopener/noreferrer and no script payload.
- **Risk:** Prefill still uses a POST that depends on the user's Greasy Fork session; keep this feature behind an explicit user action and document that final publication happens on Greasy Fork, not inside ScriptVault.

## Later

### L-1. Enterprise/Policy-Based Script Provisioning
- **Priority:** P3 | **Effort:** L | **Source:** [S28]
- **Problem:** Tampermonkey v5.5.0 added OS policy provisioning. No open-source manager offers this.
- **Deliverable:** Read `chrome.storage.managed` policy keys for script URLs, auto-install on load, managed-script indicator.
- **Progress:** Cycle 92 made the existing provisioning hook loadable through a Chrome/Edge `storage.managed_schema`, restricted managed storage to trusted extension contexts when supported, tags managed installs by returned script ID plus URL/hash origin key, adds the dashboard `Managed` indicator, and documents the administrator policy payload.
- **Progress:** Cycle 93 added aggregate managed-policy local health evidence: managed storage support, access-level control availability, policy read status, configured URL/inline/invalid entry counts, cleanup toggle state, installed managed script count, and warning-only mismatch signals without policy URLs, inline source, origin keys, script names, or script IDs.
- **Progress:** Cycle 94 added local-only managed-policy apply feedback: the service worker records the last apply run's aggregate attempt, install, failure, skip, prune, and cleanup counts, local health surfaces those counts as support-safe warning evidence, and managed apply logs no longer include policy URLs, raw errors, script names, or script IDs.

### L-2. Local Filesystem Script Loading (Watch Mode)
- **Priority:** P3 | **Effort:** M | **Source:** [S29, S30]
- **Problem:** Copy-paste workflow between IDE and extension editor is universally hated.
- **Deliverable:** File System Access API integration for Chrome/Edge. Watch a local `.user.js` and auto-reload.
- **Round 16 status:** Promoted into X-8 with a safer review-only workspace model, explicit Chromium/Firefox split, and CWS reviewer constraints.

### L-3. MCP (Model Context Protocol) Integration
- **Priority:** P3 | **Effort:** L | **Source:** [S28]
- **Problem:** Tampermonkey v5.5.0 added MCP for AI tool integration.
- **Deliverable:** MCP server exposing script CRUD via the existing Public API foundation.
- **Risk:** Must prevent MCP clients from installing without user review.

### L-4. DNR Response Header Matching
- **Priority:** P3 | **Effort:** M | **Source:** [S31]
- **Problem:** Chrome 128+ added `responseHeaders` conditions to DNR.
- **Deliverable:** Expose response-header-based DNR rules through `@webRequest` or dashboard UI.
- **Status:** Shipped 2026-06-06 through `@webRequest`.
- **Progress:** Cycle 95 added Chrome 128+ DNR `responseHeaders` and `excludedResponseHeaders` selector support for `@webRequest`/`GM_webRequest`, parser validation for HeaderInfo arrays and header mutation maps, type coverage, source/runtime parity checks, and docs. Runtime callbacks remain unsupported by MV3 DNR.

### L-5. Firefox for Android Validation
- **Priority:** P3 | **Effort:** M | **Source:** [S32]
- **Problem:** Firefox manifest omits `gecko_android`. The userScripts API is enabled on mobile.
- **Deliverable:** Android emulator/device smoke, adapted layout, manifest `gecko_android` claim.

### L-6. Sigstore Keyless Signing for Script Authors
- **Priority:** P3 | **Effort:** L | **Source:** [S33, S34, S35]
- **Problem:** Ed25519 signing requires manual key management. Sigstore's keyless model eliminates key custody.
- **Progress:** Sigstore bundle parser, verifier, and Fulcio root checks already shipped for `@require-provenance`.

### L-7. Visual Regression Testing (Vitest Browser Mode)
- **Priority:** P3 | **Effort:** M | **Source:** [S36]
- **Problem:** UI changes lack automated visual verification. Vitest 4.0 graduated Browser Mode with `toMatchScreenshot`.

### L-8. Sync GM_setValue/getValue Data Across Devices
- **Priority:** P3 | **Effort:** L | **Source:** [S37]
- **Problem:** VM's most-requested sync feature (#48) is syncing per-script GM storage values.
- **Deliverable:** Optional per-script "sync values" toggle with size caps.
- **Progress:** Cycle 96 added the first opt-in data-model slice: `script.settings.syncValues === true` is now a sync-safe per-script marker, the new `scriptvault-gm-value-sync/v1` bundle builder enforces JSON-only values plus 64 KiB per-script, 128-key, and 256-byte key caps, CloudSync/EasyCloud tests prove the marker can sync while actual GM values stay out of provider envelopes, and `docs/gm-value-sync-data-model.md` records the remaining provider-wiring and conflict rules. Cycle 97 added local support diagnostics for that path before provider writes: the local health report now counts opt-in scripts, ready/empty bundles, aggregate warning IDs, value-read failures, syncable key totals, estimated bytes, and active caps while explicitly reporting `providerWritesEnabled: false` and excluding values, value key names, script IDs, script names, URLs, local workspace handles, local paths, sync credentials, and provider account data. Cycle 98 wired CloudSync preview/upload for opt-in GM value bundles: local envelopes can include a top-level `valueBundles` object built only through the capped bundle builder, upload sanitization rebuilds bundles before provider writes, dry-run previews count local/remote value bundles, and downloaded remote value bundles remain unapplied until conflict handling is ready. Cycle 99 added the conservative downloaded-bundle apply gate: remote `valueBundles` are validated against the post-merge script set, schema/scriptId/value shape, and `syncValues === true`; dry-run previews and the dashboard count eligible, ignored, and warning bundles while keeping `valueBundleApplyEnabled: false` and `wouldApplyValues: false`. Cycle 100 enabled the first write path only for empty local value bags: valid remote bundles are applied with `ScriptValues.setAll()` after script merge, while non-empty local bags, user-modified scripts, unavailable storage, or write failures preserve the remote bundle in the next upload instead of overwriting it. Cycle 101 added aggregate sync-result evidence for value bundles: `syncNow` responses and the dashboard log now report applied, preserved, conflict-blocked, unavailable, and failed bundle counts without exposing script IDs, value keys, or values. Cycle 102 added preview-only blocked-merge evidence: dry-run previews now include value-bundle conflict entries with only reason plus local/remote key counts and byte counts, and the dashboard renders that aggregate preview without script IDs, script names, value keys, or values. Cycle 103 added a dashboard Download Preview action that exports the sanitized dry-run summary plus value-bundle conflict counts using schema `scriptvault-sync-preview/v1`, while deliberately omitting script conflict IDs/names, value keys, and values from the JSON payload. Cycle 104 added key-overlap metadata to blocked value-bundle previews and exports: entries now report overlapping, local-only, and remote-only key counts while still omitting the key names and values. Cycle 105 added real-sync blocked-reason breakdowns so `syncNow` responses and the dashboard log distinguish non-empty local value bags from user-modified scripts while keeping the aggregate privacy boundary. Cycle 106 added aggregate last-write metadata for opt-in value bundles: future GM value writes store row-level `updatedAt` values, bundle builders can carry an optional `lastValueUpdatedAt` timestamp through capped upload/download rebuilds, and the signal remains legacy-safe without exposing value key names or changing non-empty merge behavior. Cycle 107 surfaced that signal in blocked dry-run previews and sanitized preview exports with local/remote aggregate timestamps plus a coarse last-write hint, still omitting script IDs, script names, value key names, and values. Cycle 108 added aggregate real-sync timestamp summaries for preserved remote value bundles, counting remote-newer, local-newer, same, one-sided, and unknown timestamp hints in `syncNow` responses and the dashboard log without identifying scripts or values. Cycle 109 added optional per-key `keyMetadata.updatedAt` entries to opted-in GM value bundles, sourced from IndexedDB row timestamps and preserved through capped CloudSync rebuilds for future key-level conflict handling. Cycle 110 added per-key timestamp overlap summaries to blocked value-bundle previews and sanitized preview exports, counting overlapping keys by remote-newer, local-newer, same, one-sided, and unknown timestamp hints without exposing key names or values. Cycle 111 added aggregate stale-bundle diagnostics to dry-run summaries and the dashboard preview, counting timestamped/missing local and remote bundles plus older/newer-than-last-sync bundles without exposing IDs, key names, or values. Cycle 112 added non-writing candidate merge plans to blocked value-bundle previews and sanitized preview exports, counting remote-candidate, local-candidate, same-timestamp, and manual-review keys while leaving non-empty writes disabled and omitting key names and values. Cycle 113 added an advisory candidate merge acceptance gate: dry-run summaries now count ready, manual-review, and unavailable candidate merges, and blocked preview/export entries expose only gate status, block reason, and one-sided timestamp counts while non-empty writes remain disabled. Cycle 114 added manual-review reason diagnostics to dry-run summaries and sanitized preview exports, counting same-timestamp, unknown-timestamp, one-sided-timestamp, unavailable-snapshot, and no-candidate blocked reasons while keeping non-empty writes disabled and omitting key names and values. Cycle 115 added candidate result dry-run evidence: preview summaries and exports now count hypothetical result keys, auto-selected keys, and review keys for blocked value-bundle candidate merges without exposing key names or values. Cycle 116 added aggregate preserved-bundle candidate summaries to real sync results and the dashboard sync log, reporting ready/manual/unavailable preserved candidates plus result, auto-selected, and review key totals without enabling non-empty writes. Cycle 117 added real-sync preserved candidate manual-review reason summaries, reporting same-timestamp, unknown-timestamp, one-sided-timestamp, unavailable-snapshot, and no-candidate counts in aggregate sync results and logs. Cycle 118 hardened sanitized preview/export counts so fractional or negative summary and value-bundle conflict metrics are floored to non-negative integers before Download Preview output or dashboard preview rendering can carry them. Cycle 119 added a merge-acceptance invariant guard so candidate merges can report `ready` only when auto-selected keys cover the whole hypothetical result and review-key count is zero. Cycle 120 added an exact-key schema drift guard for sanitized sync preview exports so the top-level payload, summary object, and value-bundle conflict entries cannot silently add or drop fields. Cycle 121 added accepted-result evidence for candidate merges: dry-run summaries and real sync result logs now count ready-only accepted result keys separately from total, auto-selected, and review key totals. Cycle 122 added a preview-only candidate merge simulation marker, with ready candidates labeled `ready-preview-only`, manual cases labeled `manual-review`, and unavailable snapshots labeled `unavailable`. Cycle 123 added aggregate simulation totals to dry-run summaries and exports for ready-preview-only, manual-review, and unavailable candidate merge states. Cycle 124 added simulation result-key totals to dry-run summaries and exports, grouping hypothetical result keys by ready-preview-only, manual-review, and unavailable states while keeping the evidence aggregate only. Cycle 125 hardened sanitized preview exports so accepted-ready, auto-selected, review, and simulation result-key totals are clamped to the aggregate candidate result budget before export or dashboard rendering. Cycle 126 added source-side invariant assertions proving generated preview summaries keep gate counts aligned with simulation counts, accepted-ready result totals aligned with ready simulation result totals, and auto-selected/review/simulation result partitions aligned with aggregate candidate result totals. Cycle 127 added source-side unavailable simulation coverage for remote value bundles whose local script exists but has no local value bundle, pinning the unavailable gate, unavailable simulation label, unavailable block reason, zero result totals, and value/key redaction. Cycle 128 hardened the real-sync dashboard log so preserved candidate auto-selected, review, and accepted-ready result totals are floored to non-negative integers and clamped to the aggregate preserved candidate result budget before rendering. Cycle 129 added source-side preserved candidate invariants proving real-sync preserved candidate gate counts match preserved bundle totals, auto-selected/review result partitions match aggregate preserved candidate result totals, and accepted-ready totals cannot exceed result or auto-selected totals. Cycle 130 added source-side unavailable preserved-candidate coverage for a value-storage failure path, pinning preserved unavailable gate counts, unavailable block reason, zero result totals, unknown timestamp evidence, remote-bundle preservation, and no value write.
- **Cycle 131 update:** Added dashboard real-sync log coverage for the
  unavailable preserved-candidate path, proving the formatter renders only
  aggregate preserved, failure, timestamp, candidate-gate, zero result-key, and
  unavailable-local-snapshot counts while ignoring injected script IDs, script
  names, value keys, values, and raw key metadata.
- **Cycle 132 update:** Added failure-only dashboard log sanitization coverage,
  proving GM value sync logs floor fractional unavailable/failure counts, drop
  negative activity, suppress blocked sub-reasons when no blocked bundles exist,
  and ignore injected identifiers, value keys, and values.
- **Cycle 133 update:** Added source-side unavailable preserved-candidate result
  invariants, proving unavailable preserves map to the unavailable block reason
  and carry zero result, auto-selected, review, or accepted-ready key totals.
- **Cycle 134 update:** Added source-side empty-local write-failure coverage,
  proving failed GM value writes preserve the remote bundle for retry, report
  aggregate failure plus ready-candidate result evidence, leave local values
  unchanged, and still merge the remote script code.
- **Cycle 135 update:** Added dashboard write-failure log coverage, proving
  preserved-plus-failed GM value sync results render aggregate ready-candidate
  gate and accepted-ready result evidence without exposing injected identifiers,
  value keys, values, or raw key metadata.
- **Cycle 136 update:** Added source-side ready preserved-candidate result parity
  guards, proving ready write-failure preserves keep auto-selected and
  accepted-ready totals equal to the result-key budget with zero review keys.
- **Cycle 137 update:** Added source-side unknown timestamp parity guards,
  proving no-timestamp preserved paths count every preserved bundle as unknown
  while keeping remote-newer, local-newer, same, and one-sided timestamp buckets
  at zero.
- **Cycle 138 update:** Hardened dashboard real-sync timestamp logs so
  preserved timestamp buckets spend the aggregate preserved count budget and
  cannot render impossible remote-newer, local-newer, same, one-sided, or
  unknown evidence from injected summary counts.
- **Cycle 139 update:** Added aggregate write retry-ready diagnostics for
  failed empty-local GM value writes, separating read failures from write
  failures and rendering clamped dashboard retry evidence without exposing
  identifiers, value keys, values, or raw key metadata.
- **Cycle 140 update:** Added source-side retry preview evidence after a failed
  empty-local write, proving the preserved remote bundle is still advertised as
  apply-ready on the next dry run while preview output omits identifiers, value
  keys, and values.
- **Cycle 141 update:** Added support-safe retry-ready diagnostics by persisting
  sanitized aggregate `valueBundleSync` counts in the last sync result and
  surfacing `lastResult.writeFailureRetryReady` through local health/support
  snapshots without provider error text, identifiers, value keys, or values.
- **Cycle 142 update:** Hardened the dashboard support snapshot path with an
  explicit GM value-sync allowlist. Support exports now rebuild the
  `gmValueSync` block from documented aggregate counts, clamped last-result
  retry evidence, known warning IDs, and a forced privacy envelope instead of
  copying injected raw fields through the local-health payload.
- **Cycle 143 update:** Added support-dashboard polish for the sanitized
  last-result diagnostics. The utilities diagnostics refresh now caches local
  health, and the support snapshot summary shows aggregate GM value-sync opt-in,
  ready-bundle, total-key/byte, warning, and retry-ready preserved-write counts
  before export without exposing identifiers, value key names, values, provider
  account data, credentials, or raw key metadata.
- **Cycle 144 update:** Added retry-age diagnostics for write-retry evidence.
  Local health now buckets retry-ready preserved writes by sanitized age
  (`fresh`, `recent`, `stale`, `old`, or `unknown`), the support snapshot
  sanitizer preserves only that aggregate age metadata, and the dashboard
  summary labels retry-ready writes with the safe age bucket.
- **Cycle 145 update:** Added bounded write-retry history diagnostics. Sync
  persistence now stores a five-entry aggregate retry history, local health and
  support snapshots expose only summary counts/timestamps from that history,
  and the dashboard summary reports recent retry-history event counts without
  script IDs, value key names, values, provider account data, credentials, or
  raw key metadata.
- **Cycle 146 update:** Added stale retry-history cleanup evidence. Retry
  history now has a seven-day retention window; sync result persistence prunes
  older retry entries, local health/support snapshots expose only retained
  counts plus the stale-entry count excluded from the summary, and the support
  card reports stale retry-history events without exposing script IDs, value
  key names, values, provider account data, credentials, or raw key metadata.
- **Cycle 147 update:** Added a write-retry resolution drill. The source
  CloudSync fixture now follows a failed empty-local GM value write, verifies the
  preserved remote bundle remains previewable, runs a second sync after the
  transient failure clears, and proves the retry applies the remote bundle
  without reporting `writeFailureRetryReady` or exposing script IDs, value key
  names, values, provider account data, credentials, or raw key metadata.
- **Cycle 148 update:** Added retry-resolution health summaries. Sync result
  persistence now records an aggregate local `gmValueSyncRetryResolution` only
  when a clean retry applies a preserved bundle after recent retry-ready history;
  local health/support snapshots expose only applied counts, prior retry-ready
  counts, timestamps, age buckets, and privacy flags; and the Support Snapshot
  card reports resolution evidence without exposing script IDs, value key names,
  values, provider account data, credentials, or raw key metadata.
- **Cycle 149 update:** Added stale retry-resolution cleanup. Sync result
  persistence now removes stale or malformed `gmValueSyncRetryResolution`
  records when no new clean retry-resolution record is written, so hidden local
  diagnostics cannot retain old resolution evidence indefinitely while the
  health/support export path remains aggregate-only.
- **Cycle 150 update:** Added bounded retry-resolution history evidence. Sync
  result persistence now maintains a five-entry aggregate
  `gmValueSyncRetryResolutionHistory`, local health/support snapshots expose only
  total applied/prior retry-ready counts, retained/stale counts, timestamps, and
  privacy flags, and the Support Snapshot card can report recent retry
  resolution events without exposing script IDs, value key names, values,
  provider account data, credentials, or raw key metadata.
- **Cycle 151 update:** Hardened retry-resolution support snapshot export.
  Dashboard sanitization now rejects malformed resolution records without prior
  retry-ready evidence, zeros retained-history totals when the retained entry
  count sanitizes to zero, and normalizes impossible oldest/latest timestamp
  ranges before export while keeping the support payload aggregate-only.
- **Cycle 152 update:** Added retry-resolution source invariant coverage. The
  local-health regression suite now pins that clean retry-resolution records are
  created only after a successful apply with prior retry-ready history, that
  failures or retry-ready writes cannot create resolution evidence, and that
  retry-resolution history is sanitized/pruned through the persistence path.
- **Cycle 153 update:** Polished retry-resolution support summary output. The
  Support Snapshot card now reports aggregate retry-resolution history applies
  and stale retry-resolution history exclusions before export, while continuing
  to omit script IDs, value key names, values, provider account data,
  credentials, and raw key metadata.
- **Cycle 154 update:** Hardened support-summary display clamps. The GM
  value-sync support summary now re-clamps every displayed opt-in, ready-bundle,
  key, byte, retry-ready, retry-resolution, retry-history, and stale-exclusion
  count before formatting so injected local-health counts cannot leak fractional
  or negative values into the pre-export card.
- **Cycle 155 update:** Added retry-resolution stale-history evidence coverage.
  Local-health tests now pin that retry-resolution history is read with stale
  entries included, reports the stale-entry exclusion count, filters retained
  entries before totals, and keeps the typed response plus privacy envelope free
  of identifiers, value keys, values, provider account data, and raw metadata.
- **Cycle 156 update:** Added support-summary schema drift coverage. The support
  snapshot redaction suite now pins that the GM value support summary reads only
  reviewed, sanitized `gmValueSync` fields after `sanitizeLocalHealthForSupportSnapshot()`
  and never reaches back into raw local-health input for diagnostics.
- **Cycle 157 update:** Added support export schema drift coverage. The support
  snapshot redaction suite now extracts returned sanitizer object keys and pins
  the exact top-level GM value sync, last-result, retry-resolution,
  retry-resolution-history, and retry-history export schemas, so new diagnostic
  fields cannot enter support exports without review.
- **Cycle 158 update:** Added support privacy schema drift coverage. The support
  snapshot redaction suite now pins the nested GM value sync privacy blocks for
  the main export plus retry-resolution, retry-resolution-history, and
  retry-history summaries, requiring the reviewed privacy keys to remain present
  and false.
- **Cycle 159 update:** Added support warning-count schema drift coverage. The
  support snapshot redaction suite now pins the exact reviewed GM value warning
  IDs and rejects raw warning-count key iteration, so unknown warning IDs cannot
  enter support exports without review.
- **Cycle 160 update:** Added retry-age bucket schema drift coverage. The support
  snapshot redaction suite now pins the exact GM value retry-age buckets and the
  `unknown` fallback used by both retry-ready and retry-resolution support
  export paths.
- **Cycle 161 update:** Added retry-resolution cleanup guard coverage. The
  local-health source-contract suite now pins stale/malformed single
  retry-resolution removal, requires cleanup only when no fresh resolution is
  written, and rejects persistence of null or undefined retry-resolution values.
- **Cycle 162 update:** Added retry-resolution history storage contract
  coverage. The local-health source-contract suite now pins stored
  retry-resolution history entries to schema, timestamp, applied count, prior
  retry-ready counts, and latest retry timestamp only, rejecting privacy blocks
  or raw identifiers in local diagnostic history.
- **Cycle 163 update:** Added support summary phrase drift coverage. The support
  snapshot redaction suite now pins the reviewed aggregate GM value summary
  phrases, including fallback, opt-in, ready-bundle, retry, resolution-history,
  stale-history, and capped-value wording, while rejecting raw identifier labels.
- **Cycle 164 update:** Added support summary count-order coverage. The support
  snapshot redaction suite now pins the GM value summary order from baseline
  opt-in/ready/key counts through retry, retry-resolution, history, stale
  exclusions, warning total, and final joined output.
- **Cycle 165 update:** Added support summary warning-total coverage. The
  support snapshot redaction suite now pins warning totals to sanitized
  `gmValueSync.warningCounts` values, shared count clamping, and capped/excluded
  aggregate wording, while rejecting raw local-health warning iteration.
- **Cycle 166 update:** Added retry-resolution history type/schema coverage.
  The local-health source-contract suite now pins the TypeScript
  retry-resolution-history response schema fields, privacy keys, and raw
  identifier exclusions for typed support-safe diagnostics.
- **Cycle 167 update:** Added support summary fallback-state coverage. The
  support snapshot redaction suite now pins fallback order so the summary
  sanitizes local health first, returns unchecked/unavailable states before
  count formatting, and only then formats aggregate GM value counts.
- **Cycle 168 update:** Added retry-resolution typed privacy coverage. The
  local-health source-contract suite now pins the typed retry-resolution response
  fields, privacy keys, and raw identifier exclusions so the single-resolution
  typed support-safe diagnostic cannot widen unnoticed.
- **Cycle 169 update:** Added retry-history typed privacy coverage. The
  local-health source-contract suite now pins the typed retry-history response
  fields, privacy keys, and raw identifier exclusions so retry-ready history
  diagnostics cannot widen unnoticed.
- **Cycle 170 update:** Added GM value typed privacy coverage. The local-health
  source-contract suite now pins the top-level typed GM value sync response
  fields, privacy keys, and raw identifier exclusions so the main diagnostic
  envelope cannot widen unnoticed.
- **Cycle 171 update:** Added last-result typed schema coverage. The local-health
  source-contract suite now pins the typed last-result response fields,
  retry-age fields, and raw identifier/privacy exclusions so persisted sync
  result diagnostics stay aggregate-only.
- **Cycle 172 update:** Added support unavailable-state wording coverage. The
  support snapshot redaction suite now pins the unavailable GM value summary
  fallback to the generic `GM value diagnostics unavailable` wording and rejects
  provider/account/credential/script/key/error detail in that label.
- **Cycle 173 update:** Added last-result support export clamp coverage. The
  support snapshot redaction suite now pins support-export last-result retry-ready
  evidence to sanitized applied/preserved/failure counts and requires retry-age
  metadata to appear only when retry-ready evidence remains.
- **Cycle 174 update:** Added support unchecked-state wording coverage. The
  support snapshot redaction suite now pins the unchecked GM value summary
  fallback to the generic `GM values unchecked` wording and rejects
  provider/account/credential/script/key/error detail in that label.

### L-9. WebSocket Support in GM API
- **Priority:** P3 | **Effort:** M | **Source:** [S38]
- **Problem:** TM #1483 requests WebSocket support.
- **Deliverable:** `GM_webSocket` with `@connect` enforcement and abort support.

### L-10. Publish-to-GreasyFork Integration
- **Priority:** P3 | **Effort:** S | **Source:** [S39, S76]
- **Problem:** Script authors copy-paste between editor and hosting platforms.
- **Deliverable:** Dashboard action to publish/update through Greasy Fork's documented prefilled update form, not a credentialed background API. See X-9 for the implementation-ready safer handoff.

## Under Consideration

- **UC-1. Safari via Native App Container** [S40, S41] — Safari lacks `userScripts` API. Requires separate Swift project. Reconsider when user demand justifies it.
- **UC-2. Script Marketplace** [S42] — ScriptVault is a manager, not a platform. GreasyFork integration serves the same need.
- **UC-3. AI-Assisted Script Editing** [S43] — Must be opt-in, local-first. Reconsider when on-device LLMs are practical.
- **UC-4. Collaborative/Team Sharing** — Small user base. Existing sync covers the 90% case.
- **UC-5. Firefox Container Tabs** [S44] — Blocked by Firefox API (Bugzilla 1764572).

## Rejected

- **R-1. WXT Migration** [S45] — Conflicts with concatenated service worker architecture. Revisit only if codebase moves to multi-file workers.
- **R-2. GM3 API Compatibility** [S05] — Synchronous APIs conflict with MV3 isolation. TM/VM have moved on.
- **R-3. Safari via Polyfill** [S40] — Safari lacks `userScripts` API. A polyfill cannot bridge this.
- **R-4. Chrome Sync Provider** [S46] — 100KB quota unsuitable for scripts. Seven other providers exist.
- **R-5. Built-in Ad Blocking** — uBlock Origin's domain. `@webRequest` DNR rules cover per-script blocking.

## Round 16-34 Research Log

| Cycle | Angle | Local evidence | External signal | Roadmap changes |
|---|---|---|---|---|
| 45 | Setup/onboarding reliability | `pages/dashboard.js`, `pages/popup.js`, `src/background/registration.ts`, `README.md` support matrix | Chrome 138+ per-extension Allow User Scripts; Firefox MV3 optional-only `userScripts`; user-script registrations are cleared on extension update [S48, S74] | Added N-7 setup doctor and rehydration audit |
| 46 | Developer workflow | Monaco editor, generated GM typings, install provenance, local-save receipts | Tampermonkey external-editor FAQ, Tampermonkey Editors vscode.dev extension, current user complaints about copy-save-reload loops [S77, S78, S79] | Promoted local file/watch work into X-8 |
| 47 | Distribution and publishing | Greasy Fork/OpenUserJS discovery and install provenance in dashboard/install UI | Greasy Fork documents read-only API plus prefilled update form requiring user session cookie [S76] | Added X-9 and corrected L-10 from direct API to publish handoff |
| 48 | Implementation decomposition | `pages/dashboard.js` editor save/install paths, `pages/dashboard.html` editor toolbar, `pages/dashboard-store.js`, `src/background/core.ts`, `docs/release-runbook.md`, trust receipt tests | Chrome File System Access user-gesture/support constraints, Greasy Fork prefill form rules, Chrome/Firefox userScripts update clearing, CWS remote-code policy [S47, S74, S75, S76, S81] | Added N-8 and expanded X-8/X-9 into implementation slices |
| 49 | Compliant background execution architecture | `src/background/background-runner*.ts`, `src/background/background-wrapper.ts`, `offscreen.js`, `scripts/check-cws-remote-code.mjs`, `docs/background-scripts-design.md`, `docs/cws-remote-code-compliance.md` | Chrome offscreen limits, remote-hosted-code sandbox guidance, ScriptCat background/cron docs [S82, S83, S84] | Expanded X-2 with sandbox-runner candidate, rejected alternatives, and prototype acceptance gates |
| 50 | SPA navigation support | `src/background/wrapper-builder.ts`, `src/background/registration.ts`, `content.js`, `tests/wrapper-dom-security.test.js`, `tests/match-top-39-11.test.js`, README/dashboard examples | Navigation API route events, same-origin scope, and extension `webNavigation` permission tradeoffs [S85, S86, S87, S88] | Expanded X-3 from feature note into implementation-ready URL-change contract and verification gates |
| 51 | Local-save trust receipts | `pages/dashboard.js`, `src/background/core.ts`, `src/background/trust-receipt.ts`, `src/types/messages.ts`, `src/types/script.ts`, `src/modules/sync-easycloud.ts`, `tests/trust-receipt*.test.js`, `tests/install-source.test.js`, `tests/support-snapshot-redaction.test.js`, `tests/reregister-script.test.js` | File System Access user-gesture/handle-storage limits and CWS user-data/privacy disclosure expectations [S75, S81, S89, S90] | Expanded N-8 with local-source override, autosave coalescing, export/sync redaction, and receipt-operation test gates |
| 52 | Developer workspace/local file binding | `pages/dashboard.js`, `pages/dashboard.html`, `pages/dashboard.css`, `src/types/script.ts`, `src/background/core.ts`, `src/background/import-export.ts`, `src/background/cloud-sync.ts`, `src/modules/sync-easycloud.ts`, `src/storage/script-db.ts`, cloud-sync/export tests | File System Access stored-handle, permission-persistence, user-gesture, secure-context, and CWS user-data disclosure constraints [S81, S89, S90, S91, S92] | Expanded X-8 with local-only binding store, permission-state UI, refresh-only first release, and export/sync redaction gates |
| 53 | Setup rehydration evidence | `src/background/core.ts`, `background.core.js`, `background.js`, `src/types/messages.ts`, `tests/local-health-report.test.js`, dashboard support snapshot export | Chrome userScripts docs, Chrome 138+ Allow User Scripts, Firefox optional-only `userScripts`, and update-time registration clearing [S47, S48, S74] | Implemented aggregate last-registration-sweep evidence in local health reports and support snapshots |
| 54 | Local-save receipt implementation | `pages/dashboard.js`, `src/background/core.ts`, `src/background/trust-receipt.ts`, `src/types/messages.ts`, `src/types/script.ts`, `tests/trust-receipt.test.js`, `tests/local-save-trust-receipt.test.js` | CWS user-data disclosure and File System Access user-gesture/stored-handle constraints [S81, S89, S91] | Shipped explicit local editor receipt payloads and metadata-fallback suppression for manual saves/autosaves |
| 55 | Autosave receipt coalescing | `pages/dashboard.js`, `src/background/core.ts`, `src/types/messages.ts`, `tests/local-save-trust-receipt.test.js`, `tests/reregister-script.test.js` | CWS local-storage disclosure plus File System Access handle permission recheck and persistent-permission behavior [S81, S89, S91] | Added ephemeral autosave coalescing keys, in-memory rollback-history reuse, and reregister/export-safety source guards |
| 56 | Local workspace binding store | `src/storage/idb.ts`, `src/storage/script-db.ts`, `src/modules/storage.ts`, `src/background/core.ts`, `modules/storage.js`, `tests/storage.test.js`, export/sync/support tests | File handles are serializable to IndexedDB; permission must be rechecked with `queryPermission()`/`requestPermission()`; local sensitive data remains disclosure-relevant [S81, S89, S91] | Added local-only binding storage plus JSON export, CloudSync, EasyCloud, and support-snapshot redaction fixtures |
| 57 | Dashboard local file binding | `pages/dashboard.html`, `pages/dashboard.js`, `tests/local-workspace-dashboard.test.js` | File picker support must be feature-detected and invoked from a user gesture; stored handles require permission-state rechecks; local sensitive data still needs clear disclosure [S81, S89, S91] | Added the feature-detected `Bind File` control, local IndexedDB handle persistence, permission summary chip, and no-save/no-code binding tests |
| 58 | Local file refresh review | `pages/dashboard.html`, `pages/dashboard.js`, `tests/local-workspace-dashboard.test.js` | Stored handles may need `requestPermission()` from a user gesture before reads; local files should be reviewed before applying executable code [S81, S89, S91] | Added `Refresh File` and `Unbind`, review-diff apply, permission reconnect/error summaries, no-change handling, and `local-file` receipt tests |
| 59 | Deep audit security | `src/background/wrapper-builder.ts`, `src/background/core.ts`, generated runtime artifacts, `tests/wrapper-dom-security.test.js`, `docs/research-deep-audit-2026-06-06.md` | Local audit found `srcdoc` bypass in `GM_addElement`; iframe `srcdoc` is raw HTML rather than a normal URL attribute | Blocked `srcdoc` for direct attrs and sanitized `innerHTML`, regenerated runtime artifacts, and pinned the bypass regression |
| 60 | Crontab execution isolation | `src/background/core.ts`, generated runtime artifacts, `tests/crontab-next-fire.test.js`, `docs/research-deep-audit-2026-06-06.md` | Local audit found scheduled scripts running through `chrome.scripting.executeScript` in `ISOLATED` world, which can expose extension APIs to userscript code | Moved scheduled execution to `chrome.userScripts.execute` in `USER_SCRIPT` world with a `MAIN`-world fallback only, removed the scheduled `new Function` path, and pinned the isolation regression |
| 61 | PublicAPI internal-host parity | `src/modules/public-api.ts`, `modules/public-api.js`, `background.js`, `tests/public-api.test.js`, `tests/source-hardening-parity.test.js` | Local audit found PublicAPI's private internal-host copy missing `.localhost`, TEST-NET, benchmarking, Class E, and IPv4-mapped IPv6 hex cases already enforced by `InternalHostGuard` | Reused the canonical `isInternalHost` guard for trusted origins, web install URLs, and webhook URLs, regenerated runtime artifacts, and pinned behavior/source parity regressions |
| 62 | S3 settings validation | `src/config/settings-schema.json`, `pages/dashboard.html`, `pages/dashboard.js`, `scripts/check-settings-schema.mjs`, `tests/dashboard-a11y.test.js` | WCAG 2.1 SC 3.3.1 error identification, MDN constraint validation, and `aria-invalid` guidance still favor field-specific text errors and custom validity [S07, S08] | Added S3 endpoint/region/bucket/object-key validation metadata, native hints, accessible error nodes, blur hooks, and focused a11y/schema coverage |
| 63 | Sync credential validation | `src/config/settings-schema.json`, `pages/dashboard.html`, `pages/dashboard.js`, `scripts/check-settings-schema.mjs`, `tests/dashboard-a11y.test.js` | WCAG 2.1 SC 3.3.1, MDN constraint validation, and MDN `aria-invalid` guidance still support custom validity plus field-specific error messages [S07, S08] | Added WebDAV, sync passphrase, and S3 credential validation metadata, error nodes, native length limits, blur hooks, and an encryption toggle guard |
| 64 | Editor select validation | `src/config/settings-schema.json`, `pages/dashboard.html`, `pages/dashboard.js`, `scripts/check-settings-schema.mjs`, `tests/dashboard-a11y.test.js` | MDN documents `HTMLSelectElement.setCustomValidity()` and option values as the select contract; WCAG error identification still requires text errors for invalid choices [S07, S08] | Added validation metadata, error nodes, and save-blocking allowed-option checks for editor font size, indentation width, and tab size |
| 65 | Interval select validation | `pages/dashboard.html`, `pages/dashboard.js`, `src/config/settings-schema.json`, `scripts/check-settings-schema.mjs`, `tests/dashboard-a11y.test.js` | MDN select option values plus `HTMLSelectElement.setCustomValidity()` support the same allowed-option validation contract [S07, S08] | Added validation metadata/error nodes for update check, notification delay, and externals intervals; preserved `0`/"Never" with nullish fallbacks and validator conversion |
| 66 | Security select validation | `pages/dashboard.html`, `pages/dashboard.js`, `src/config/settings-schema.json`, `scripts/check-settings-schema.mjs`, `tests/dashboard-a11y.test.js` | MDN select option values plus `HTMLSelectElement.setCustomValidity()` support the same allowed-option validation contract, and WCAG error identification expects text feedback for invalid choices [S07, S08] | Added validation metadata, error nodes, and save-blocking allowed-option checks for content script API, sandbox mode, CSP modification mode, and HTTP header modification mode |
| 67 | Action behavior select validation | `pages/dashboard.html`, `pages/dashboard.js`, `src/config/settings-schema.json`, `scripts/check-settings-schema.mjs`, `tests/dashboard-a11y.test.js` | MDN select option values plus `HTMLSelectElement.setCustomValidity()` support the same allowed-option validation contract, and WCAG error identification expects text feedback for invalid choices [S07, S08] | Added validation metadata, error nodes, and save-blocking allowed-option checks for default tab type, local file, cookie, communication, SRI, include, @connect, incognito, page filter, block severity, strict mode, and top-level await selects |
| 68 | Remaining select validation | `pages/dashboard.html`, `pages/dashboard.js`, `src/config/settings-schema.json`, `scripts/check-settings-schema.mjs`, `tests/dashboard-a11y.test.js` | MDN select option values plus `HTMLSelectElement.setCustomValidity()` support the same allowed-option validation contract, and WCAG error identification expects text feedback for invalid choices [S07, S08] | Added validation metadata, error nodes, and save-blocking allowed-option checks for all remaining schema-backed selects; popup columns now validates before numeric conversion |
| 69 | Custom CSS validation | `pages/dashboard.html`, `pages/dashboard.js`, `src/config/settings-schema.json`, `scripts/check-settings-schema.mjs`, `tests/dashboard-a11y.test.js` | WCAG error identification and MDN constraint validation support text errors, native length constraints, and custom validity for malformed free-form text [S07, S08] | Added validation metadata, maxlength, accessible error text, and save-blocking validation for custom CSS; whitespace is preserved while unsafe control characters and overlarge CSS are rejected |
| 70 | Settings validation acceptance gate | `scripts/check-settings-schema.mjs`, `tests/settings-schema.test.js`, `src/config/settings-schema.json`, `pages/dashboard.html`, `pages/dashboard.js` | WCAG error identification and MDN constraint validation still require user-facing errors for malformed input controls [S07, S08] | Added the durable dashboard-backed validation-metadata requirement and closed N-1 after the repository schema passed it |
| 71 | Guarded GM.fetch | `src/background/core.ts`, `src/background/wrapper-builder.ts`, `background.core.js`, `background.js`, `scripts/generate-gm-types.mjs`, `lib/scriptvault.d.ts`, `tests/gm-namespace-parity.test.js`, `tests/gm-types.test.js`, `docs/gm-namespace-parity.md` | Tampermonkey/Violentmonkey GM API parity still depends on promise-style network helpers, but ScriptVault must keep network access behind `GM_xmlhttpRequest` policy [S10, S11, S12] | Added `GM.fetch`/`GM_fetch` over the existing XHR bridge, pinned that no background `GM_fetch` action exists, and closed N-2 |
| 72 | SPA URL-change proof | `src/background/core.ts`, `src/background/wrapper-builder.ts`, generated runtime artifacts, `tests/urlchange-wrapper.test.js`, `README.md` | Navigation API route events plus history/popstate/hashchange fallbacks remain the least-permission page-level path for SPA userscript reruns [S85, S86, S87, S88] | Added a shared URL-change scheduler, microtask/frame rechecks, duplicate suppression, jsdom coverage, and README author examples for `window.onurlchange` |
| 73 | Monaco package guard | `scripts/check-monaco-package-contract.mjs`, `tests/monaco-package-contract.test.js`, `package.json`, `docs/monaco-esm-migration-plan.md` | Monaco AMD remains deprecated, but the current v3.12 packaging contract must stay local and Firefox-safe until the ESM bundle is deliberately switched [S17, S24] | Added a static gate for local AMD Chromium packaging, remote/CDN sandbox rejection, Firefox Monaco exclusion, npm-check wiring, and plan drift |
| 74 | Monaco ESM prototype | `src/editor/monaco-esm-entry.ts`, `esbuild.config.mjs`, `scripts/check-monaco-esm-prototype.mjs`, `tests/monaco-esm-build.test.js`, `docs/audit/monaco-esm-prototype-2026-06-06.json` | Monaco ESM needs a local bundled editor plus file-backed workers before the sandbox can leave AMD [S17, S24] | Added an ignored `lib/monaco-esm/` prototype build, deterministic worker outputs, font loader handling, post-build evidence checks, and size/layout evidence |
| 75 | Monaco ESM size budget | `scripts/check-monaco-esm-prototype.mjs`, `tests/monaco-esm-prototype-check.test.js`, `docs/audit/monaco-esm-prototype-2026-06-06.json`, `docs/monaco-esm-migration-plan.md` | The full JavaScript/TypeScript worker preserves userscript language features, but package growth must be explicit before switching from AMD [S17, S24] | Selected the full-worker Chromium strategy, added total/compressed/per-file budgets, recorded gzip evidence, and pinned budget regressions |
| 76 | Monaco ESM sandbox switch | `pages/editor-sandbox.html`, `esbuild.config.mjs`, `scripts/check-monaco-package-contract.mjs`, `tests/monaco-esm-plan.test.js`, `docs/cws-remote-code-compliance.md` | The sandbox can leave deprecated AMD only if it imports packaged ESM assets and keeps fallback behavior [S17, S24] | Switched the sandbox to local ESM CSS/import loading, removed AMD copy steps, rejected AMD loader regressions, and added sandbox script parsing coverage |
| 77 | Monaco ESM fallback harness | `tests/monaco-esm-sandbox-loader.test.js`, `pages/editor-sandbox.html` | Browser-profile proof can be blocked, but the loader/fallback contract still needs deterministic coverage [S17, S24] | Added a VM/DOM harness that executes the sandbox script, validates ESM path requests, `ready` posting, and missing-bundle fallback routing |
| 78 | Monaco ESM Chromium sandbox smoke | `tests/e2e/monaco-esm-sandbox.spec.js`, `tests/e2e/helpers/extension-fixture.js` | The ESM sandbox switch must run in a real Chromium extension page, not only jsdom/VM harnesses [S17, S24] | Added a Playwright extension-page smoke for the packaged sandbox ready path and routed missing-bundle fallback path |
| 79 | Monaco adapter dashboard smoke | `tests/e2e/monaco-adapter-dashboard.spec.js` | The ESM editor must persist real dashboard edits through the CodeMirror-compatible Monaco adapter [S17, S24] | Added a Playwright dashboard smoke for edit-open, adapter readiness, toolbar save, reload, and adapter value persistence |
| 80 | `browser` namespace alias | `src/shared/utils.ts`, `shared/utils.js`, `scripts/generate-ts-runtime-modules.mjs`, `pages/dashboard-firefox-compat.js`, focused tests | Chrome 148 exposes `browser`, so Chrome/Firefox code should converge without exposing extension APIs to userscript/page worlds [S25] | Added a generated extension-context alias, fixed Chromium-vs-Firefox detection when `browser.runtime` exists, and pinned wrapper boundary coverage |
| 81 | Trusted Types author docs | `README.md`, `pages/dashboard.html`, `tests/trusted-types-docs.test.js` | MAIN-world scripts on Trusted Types pages need explicit author guidance, while ScriptVault's default USER_SCRIPT path should stay documented as the safer default [S26] | Added README and Help guidance plus a static test that pins the docs and confirms no runtime policy shim was introduced |
| 82 | Subscription refresh scheduling | `src/background/core.ts`, settings defaults/schema/types, dashboard subscription controls, generated runtime artifacts, focused tests | Chrome alarms remain the MV3-safe periodic work primitive, with same-name replacement and a 30-second minimum interval in current Chrome [S93] | Added a managed subscription refresh alarm, visible auto-refresh/interval controls, feed health labels, scheduler resync on add/remove/settings changes, and static contract coverage |
| 83 | Local workspace refresh status | `pages/dashboard.js`, `src/storage/script-db.ts`, `modules/storage.js`, focused dashboard/storage tests | File System Access handles can persist in IndexedDB, but permission/read state must be visible because access can revert to prompt or fail between sessions [S81, S91, S92] | Added explicit bound/unchanged/applied/cancelled/error refresh state summaries for the editor local-file chip without exposing handles or absolute paths |
| 84 | Local workspace health evidence | `src/background/core.ts`, `pages/dashboard.js`, focused health/support tests | Support snapshots need aggregate local-workspace evidence without file handles, paths, or local names [S81, S91, S92] | Added local workspace health counts, refresh-age buckets, and support-snapshot sanitization unless script inventory is opted in |
| 85 | Local refresh acceptance hardening | `pages/dashboard.js`, `src/background/core.ts`, focused local-workspace/local-health tests | File System Access reads must reject oversized executable files before loading text, and parse/apply failures need distinct operator feedback [S81, S91, S92] | Added the 5 MB bound-file read cap, `too-large` and `parse-failed` status paths, and regression coverage for normal local apply registration |
| 86 | Greasy Fork publish preflight | `pages/dashboard.html`, `pages/dashboard.js`, `tests/greasyfork-publish-handoff.test.js` | Greasy Fork documents read-only APIs plus multipart prefilled update forms, not a credentialed write API [S76] | Added editor publish preflight, metadata validation, new/update target detection, exact code preview, copy/download fallback, and static guards against background publish endpoints |
| 87 | Greasy Fork publication receipt | `pages/dashboard.html`, `pages/dashboard.js`, `tests/greasyfork-publish-handoff.test.js` | Store-safe handoff needs a local receipt only after user-confirmed submission, without storing submitted code or account/session material [S76] | Added post-handoff confirmation, local-only publication receipt storage, Info-panel reload display, receipt trimming, and Chromium dashboard smoke coverage |
| 88 | Greasy Fork receipt history | `pages/dashboard.js`, `tests/greasyfork-publish-handoff.test.js` | Greasy Fork still documents read-only APIs plus session-cookie prefilled form POSTs, so local fallback handling must not claim a credentialed publish API [S76] | Added per-script publication receipt history display, local-only clear-history management, source/account redaction copy, focused static coverage, and Chromium extension smoke coverage |
| 89 | Greasy Fork receipt summary fallback | `pages/dashboard.js`, `tests/greasyfork-publish-handoff.test.js` | Clipboard writes are a user-initiated local action, while Greasy Fork publication still happens only through the user-reviewed prefilled form [S76, S94] | Added copyable sanitized receipt summaries for local publication history and Chromium smoke coverage that proves copied text omits source/account/session data |
| 90 | Greasy Fork receipt export fallback | `pages/dashboard.js`, `tests/greasyfork-publish-handoff.test.js` | Local Blob URLs plus anchor `download` preserve a browser-native export path for sanitized local receipt text [S76, S95, S96] | Added downloadable sanitized receipt summaries, safe receipt filenames, object URL revocation, focused static coverage, and Chromium smoke coverage for exported text redaction |
| 91 | Greasy Fork session-check polish | `pages/dashboard.js`, `tests/greasyfork-publish-handoff.test.js` | Greasy Fork publication still depends on the user's browser session, so the preflight modal should let users open Greasy Fork without posting script data [S76] | Added a user-initiated `Open Greasy Fork` modal action that opens only the base URL with noopener/noreferrer, plus focused static coverage and Chromium smoke proof |
| 92 | Enterprise policy provisioning | `manifest.json`, `managed-storage-schema.json`, `src/background/core.ts`, `pages/dashboard.js`, `docs/enterprise-policy-provisioning.md`, focused manifest/runtime tests | Chrome managed storage requires a manifest-declared schema; managed storage is read-only policy data and can be restricted to trusted contexts [S28, S97, S98] | Added schema wiring, trusted-context access narrowing, deterministic managed install tags, a dashboard Managed badge, and administrator docs |
| 93 | Enterprise policy diagnostics | `src/background/core.ts`, `src/types/messages.ts`, local health/support snapshot tests | Chrome policy deployment is normally inspected at `chrome://policy`, but ScriptVault support snapshots need only aggregate extension-side evidence [S97, S98, S99] | Added managed policy support/read/configuration/install counts and warning signals to local health without exposing policy values |
| 94 | GM value-sync support snapshot allowlist | `pages/dashboard.js`, `tests/support-snapshot-redaction.test.js` | Chrome extension diagnostics should keep privileged userscript/storage state behind extension-controlled messaging and export only support-safe aggregates [S47, S98] | Added an explicit dashboard-side allowlist for GM value-sync local-health export data, including clamped retry-ready last-result evidence and known warning IDs only |
| 95 | GM value-sync support summary polish | `pages/dashboard.js`, `tests/support-snapshot-redaction.test.js` | Support operators need pre-export visibility into aggregate local-health diagnostics while the privacy envelope keeps script/value data out of the UI and export path [S47, S98] | Cached local health during utilities refresh/export and added aggregate GM value-sync retry readiness to the support snapshot summary |
| 96 | GM value-sync retry-age diagnostics | `src/background/core.ts`, `src/types/messages.ts`, generated runtime artifacts, `pages/dashboard.js`, focused local-health/support tests | Support diagnostics should distinguish fresh retry-ready write failures from stale ones while still exporting only aggregate local-health evidence [S47, S98] | Added sanitized retry-age minutes/buckets to last-result health and support-summary output |
| 97 | GM value-sync bounded retry history | `src/background/core.ts`, `src/types/messages.ts`, generated runtime artifacts, `pages/dashboard.js`, focused local-health/support tests | Chrome storage quota guidance favors small JSON-serializable local state, and CWS user-data policy favors aggregate/anonymized operational diagnostics [S47, S98] | Added a five-entry aggregate retry-history store, local-health summary counts, support-snapshot allowlisting, and clear-all cleanup |
| 98 | GM value-sync stale retry cleanup | `src/background/core.ts`, `src/types/messages.ts`, generated runtime artifacts, `pages/dashboard.js`, focused local-health/support tests | Chrome storage APIs support extension-local JSON state, and CWS user-data guidance favors minimal aggregate diagnostics for support exports [S89, S97] | Added seven-day retry-history retention, stale-entry pruning on sync persistence, local-health retained/stale counts, and support-snapshot allowlisting |
| 99 | GM value-sync retry resolution drill | `tests/source-cloud-sync.test.js` | Empty-local-only retries should prove a transient write failure resolves on a later sync without widening stored or exported diagnostics [S89, S97] | Extended the write-failure fixture through a second sync that applies the preserved remote bundle and keeps retry result output identifier/value-free |
| 100 | GM value-sync retry-resolution health summaries | `src/background/core.ts`, `src/types/messages.ts`, generated runtime artifacts, `pages/dashboard.js`, focused local-health/support tests | Support diagnostics need aggregate proof that retry-ready failures later cleared without exporting scripts, values, account data, or provider errors [S89, S97] | Added local retry-resolution records, support-safe health/export summaries, age buckets, and clear-all cleanup for resolution evidence |
| 101 | GM value-sync retry-resolution stale cleanup | `src/background/core.ts`, generated runtime artifacts, `tests/local-health-report.test.js` | Local diagnostic records should keep the same retention boundary as support-safe history evidence [S89, S97] | Removed stale or malformed retry-resolution records during sync result persistence when no fresh resolution is written |
| 102 | GM value-sync resolution-history support evidence | `src/background/core.ts`, `src/types/messages.ts`, generated runtime artifacts, `pages/dashboard.js`, focused local-health/support tests | Support diagnostics need bounded recent recovery evidence without exporting script/value/provider details [S89, S97] | Added a five-entry aggregate retry-resolution history, local-health/support summaries, stale-count reporting, and clear-all cleanup |
| 103 | GM value-sync retry-resolution export hardening | `pages/dashboard.js`, `tests/support-snapshot-redaction.test.js` | Support exports should not overstate retry-resolution evidence from malformed local-health input [S47, S98] | Rejected malformed resolution records without prior retry-ready evidence, zeroed retained-history totals when entries sanitize to zero, and normalized history timestamp ranges |
| 104 | GM value-sync retry-resolution source invariants | `tests/local-health-report.test.js` | Retry-resolution evidence must remain tied to successful clean retries after prior retry-ready history [S89, S97] | Added source-contract coverage for resolution record gates and persistence-time stale pruning of retry-resolution history |
| 105 | GM value-sync retry-resolution support summary polish | `pages/dashboard.js`, `tests/support-snapshot-redaction.test.js` | Operators should see aggregate stale/excluded recovery evidence before exporting support snapshots [S47, S98] | Added support-card labels for historical retry-resolution applies and stale retry-resolution-history events excluded |
| 106 | GM value-sync support-summary clamp hardening | `pages/dashboard.js`, `tests/support-snapshot-redaction.test.js` | Pre-export support summaries should format only non-negative integer aggregate counts [S47, S98] | Re-clamped all displayed GM value-sync support-summary counts before formatting |
| 107 | GM value-sync retry-resolution stale-history evidence | `tests/local-health-report.test.js` | Stale retry-resolution history should stay visible only as aggregate exclusion evidence [S89, S97] | Added local-health source coverage for include-stale reads, stale exclusion counts, retained-entry filtering, typed output, and privacy flags |
| 108 | GM value-sync support-summary schema drift coverage | `tests/support-snapshot-redaction.test.js` | Pre-export summaries should read only reviewed sanitized fields, not raw local-health input [S47, S98] | Pinned the exact sanitized GM value fields read by the support summary and rejected raw local-health field access |
| 109 | GM value-sync support export schema drift coverage | `tests/support-snapshot-redaction.test.js` | Support exports should expose only reviewed aggregate diagnostic fields at every nested level [S47, S98] | Pinned the exact returned sanitizer keys for GM value sync, last-result, retry-resolution, retry-resolution-history, and retry-history exports |
| 110 | GM value-sync support privacy schema drift coverage | `tests/support-snapshot-redaction.test.js` | Support export privacy metadata should stay explicit and false for sensitive data classes [S47, S98] | Pinned the exact nested privacy keys and false values for GM value sync support exports |
| 111 | GM value-sync support warning-count schema drift coverage | `tests/support-snapshot-redaction.test.js` | Support exports should allow only reviewed GM value warning identifiers [S47, S98] | Pinned the exact warning-count allowlist and rejected raw warning-count key iteration |
| 112 | GM value-sync retry-age bucket schema drift coverage | `tests/support-snapshot-redaction.test.js` | Retry-ready and retry-resolution support exports should share reviewed age buckets [S47, S98] | Pinned the exact retry-age bucket allowlist and unknown fallback for support exports |
| 113 | GM value-sync retry-resolution cleanup guard | `tests/local-health-report.test.js` | Stale or malformed local retry-resolution records should be removed without writing null diagnostics [S89, S97] | Pinned the single-record cleanup helper and persistence-time remove path |
| 114 | GM value-sync retry-resolution history storage contract | `tests/local-health-report.test.js` | Local retry-resolution history should retain only aggregate recovery evidence [S89, S97] | Pinned the exact stored retry-resolution history entry keys and rejected privacy/raw identifier fields |
| 115 | GM value-sync support summary phrase drift coverage | `tests/support-snapshot-redaction.test.js` | Pre-export summaries should use only reviewed aggregate diagnostic wording [S47, S98] | Pinned fallback, opt-in, retry, history, stale, and capped-value summary phrases while rejecting raw identifier labels |
| 116 | GM value-sync support summary count-order coverage | `tests/support-snapshot-redaction.test.js` | Pre-export summaries should present aggregate diagnostics in reviewed order [S47, S98] | Pinned baseline, retry, resolution, history, stale, warning, and final join order |
| 117 | GM value-sync support summary warning-total coverage | `tests/support-snapshot-redaction.test.js` | Warning totals should be computed only from sanitized support-export warning counts [S47, S98] | Pinned sanitized warning-count reduction, shared count clamping, and capped/excluded aggregate wording |
| 118 | GM value-sync retry-resolution history type schema coverage | `tests/local-health-report.test.js` | Typed local-health responses should expose only reviewed aggregate retry-resolution history fields [S89, S97] | Pinned retry-resolution-history response fields, privacy keys, and raw identifier exclusions |
| 119 | GM value-sync support summary fallback-state coverage | `tests/support-snapshot-redaction.test.js` | Pre-export summaries should return reviewed fallback states before formatting counts [S47, S98] | Pinned sanitize-first unchecked/unavailable fallback order before aggregate count formatting |
| 120 | GM value-sync retry-resolution typed privacy coverage | `tests/local-health-report.test.js` | Typed local-health responses should expose only reviewed aggregate retry-resolution fields and privacy keys [S89, S97] | Pinned single retry-resolution response fields, privacy keys, and raw identifier exclusions |
| 121 | GM value-sync retry-history typed privacy coverage | `tests/local-health-report.test.js` | Typed local-health responses should expose only reviewed aggregate retry-history fields and privacy keys [S89, S97] | Pinned retry-history response fields, privacy keys, and raw identifier exclusions |
| 122 | GM value-sync typed privacy coverage | `tests/local-health-report.test.js` | Typed local-health responses should keep the top-level GM value sync diagnostic envelope reviewed [S89, S97] | Pinned top-level GM value sync response fields, privacy keys, and raw identifier exclusions |
| 123 | GM value-sync last-result typed schema coverage | `tests/local-health-report.test.js` | Typed local-health responses should keep persisted sync result diagnostics aggregate-only [S89, S97] | Pinned last-result response fields, retry-age fields, and raw identifier/privacy exclusions |
| 124 | GM value-sync support unavailable-state wording coverage | `tests/support-snapshot-redaction.test.js` | Unavailable pre-export summaries should stay generic and support-safe [S47, S98] | Pinned generic unavailable wording and rejected provider/account/credential/script/key/error detail |
| 125 | GM value-sync last-result support export clamp coverage | `tests/support-snapshot-redaction.test.js` | Support exports should not overstate retry-ready last-result evidence [S47, S98] | Pinned retry-ready clamping to sanitized failure/preserved counts and retry-age gating |
| 126 | GM value-sync support unchecked-state wording coverage | `tests/support-snapshot-redaction.test.js` | Unchecked pre-export summaries should stay generic and support-safe [S47, S98] | Pinned generic unchecked wording and rejected provider/account/credential/script/key/error detail |

## Continuation State

- **Current cycle:** Round 92 Cycle 174 added GM value sync support unchecked-state wording coverage.
- **Next implementation angle:** Cycle 175 should continue L-8 with last-result timestamp sanitization coverage, support summary sanitized-field drift coverage, or the next non-credential-gated safeguard before enabling non-empty bidirectional value merges.
- **Follow-up source checks:** Re-check Greasy Fork prefilled update behavior and browser SameSite/top-level form behavior before changing the form submission path or making stronger claims about live submission success.
- **Suggested verification before implementation:** Run focused tests for enterprise provisioning, local health reports, install-source/trust receipts, support snapshot redaction, export/sync local-metadata redaction, and `reregisterScript()` behavior after code changes touching L-1, N-7, N-8, X-8, or X-9.

## Competitive Position Summary

| Capability | ScriptVault | Tampermonkey | Violentmonkey | ScriptCat |
|---|---|---|---|---|
| MV3 native | Yes | Yes | **No (dead on Chrome)** | Yes |
| Open source | MIT | **No** | MIT | GPL-3.0 |
| Chrome Web Store | **Published** | **Removed** | **Delisted** | Published |
| GM API (35+) | Yes | Yes | Yes | Yes |
| Monaco editor | **Yes** | No | Yes (MV2) | No |
| DevTools panel | **Yes** | No | No | No |
| Side panel | **Yes** | No | No | No |
| Script signing (Ed25519) | **Yes** | No | No | No |
| AST analysis (31 detectors) | **Yes** | No | No | No |
| Cloud sync providers | **7** | 6 | 4 | Built-in |
| Update diff + review inbox | **Yes** | No | **No** (most-requested) | No |
| Version rollback | **Yes** (3) | No | No | No |
| Import quarantine | **Yes** | No | No | No |
| Sigstore provenance | **Yes** | No | No | No |
| Workspaces | **Yes** | No | No | No |
| Command palette | **Yes** | No | No | No |
| Performance budgets | **Yes** | No | No | No |
| Background/cron scripts | Partial | No | No | **Yes** |
| Enterprise provisioning | **Yes** (Chrome/Edge) | **Yes** (v5.5) | No | No |
| MCP/AI integration | No | **Yes** (v5.5) | No | No |
| Firefox published | **No (AMO-ready)** | Yes | Yes | Yes |
| Edge published | **No (pkg-ready)** | Yes | No | Yes |

## Appendix: Sources

| ID | Source | URL |
|---|---|---|
| S01 | TM CWS removal (#2498) | https://github.com/Tampermonkey/tampermonkey/issues/2498 |
| S02 | VM Chrome compat (#2340) | https://github.com/violentmonkey/violentmonkey/issues/2340 |
| S03 | VM still MV2 (#2284) | https://github.com/violentmonkey/violentmonkey/issues/2284 |
| S04 | ScriptCat MV3 | https://github.com/scriptscat/scriptcat |
| S05 | Greasemonkey | https://github.com/greasemonkey/greasemonkey |
| S06 | FireMonkey | https://github.com/erosman/firemonkey |
| S07 | WCAG 2.1 SC 3.3.1 | https://www.w3.org/WAI/WCAG21/Understanding/error-identification.html |
| S08 | MDN constraint validation | https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Constraint_validation |
| S09 | Settings schema drift | Local: docs/settings-schema.md |
| S10 | TM GM API docs | https://www.tampermonkey.net/documentation.php |
| S11 | VM GM API docs | https://violentmonkey.github.io/api/gm/ |
| S12 | ScriptCat GM docs | https://docs.scriptcat.org/en/ |
| S13 | Mozilla AMO submission | https://extensionworkshop.com/documentation/publish/source-code-submission/ |
| S14 | Mozilla library usage | https://extensionworkshop.com/documentation/publish/third-party-library-usage/ |
| S15 | Mozilla policies (Aug 2025) | https://blog.mozilla.org/addons/2025/06/23/updated-add-on-policies-simplified-clarified/ |
| S16 | CWS API v2 | https://developer.chrome.com/blog/cws-api-v2 |
| S17 | Monaco AMD deprecation | https://github.com/microsoft/monaco-editor/blob/main/CHANGELOG.md |
| S18 | Edge port guide | https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/port-chrome-extension |
| S19 | Edge API v1.1 | https://learn.microsoft.com/en-us/microsoft-edge/extensions/update/api/using-addons-api |
| S20 | ScriptCat background | https://docs.scriptcat.org/docs/change/ |
| S21 | @background research | Local: RESEARCH_FEATURE_PLAN.md |
| S22 | Navigation API Baseline | https://www.infoq.com/news/2026/05/navigation-api-browser/ |
| S23 | Navigation API MDN | https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API |
| S24 | Monaco ESM (#3908) | https://github.com/microsoft/monaco-editor/discussions/3908 |
| S25 | Chrome `browser` namespace | https://developer.chrome.com/blog/extensions-io-2026 |
| S26 | Trusted Types | https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API |
| S27 | Script subscriptions | Local: CHANGELOG.md 2026-06-03 |
| S28 | TM v5.5.0 MCP + policy | https://www.tampermonkey.net/changelog.php?locale=en |
| S29 | IDE workflow pain | https://www.codestudy.net/blog/how-can-i-develop-my-userscript-in-my-favourite-ide-and-avoid-copy-pasting-it-to-the-tampermonkey-s-editor-every-time/ |
| S30 | VM @require-local | https://github.com/violentmonkey/violentmonkey/issues/2419 |
| S31 | DNR response headers | https://developer.chrome.com/docs/extensions/whats-new |
| S32 | Firefox mobile userScripts | https://bugzilla.mozilla.org/show_bug.cgi?id=1875475 |
| S33 | Sigstore keyless | https://docs.sigstore.dev/about/overview/ |
| S34 | npm Trusted Publishing | https://blog.sigstore.dev/npm-provenance-ga/ |
| S35 | Browser Sigstore verifier | https://tinfoil.sh/blog/2025-12-18-browser-native-verification |
| S36 | Vitest 4.0 Browser Mode | https://vitest.dev/blog/vitest-4 |
| S37 | VM GM value sync (#48) | https://github.com/violentmonkey/violentmonkey/issues/48 |
| S38 | TM WebSocket (#1483) | https://github.com/Tampermonkey/tampermonkey/issues/1483 |
| S39 | VM GreasyFork publish | https://github.com/violentmonkey/violentmonkey/issues/2425 |
| S40 | Safari UserScripts | https://github.com/quoid/userscripts |
| S41 | Safari lacks userScripts | https://developer.apple.com/documentation/safariservices/safari-web-extensions |
| S42 | GreasyFork platform | https://github.com/greasyfork-org/greasyfork |
| S43 | CodeTweak AI editor | https://github.com/MrBlankCoding/CodeTweak |
| S44 | TM Firefox containers | https://github.com/Tampermonkey/tampermonkey/issues/2792 |
| S45 | WXT evaluation | Local: docs/manifest-generation-design.md |
| S46 | storage.sync quota | https://developer.chrome.com/docs/extensions/reference/api/storage |
| S47 | userScripts API | https://developer.chrome.com/docs/extensions/reference/api/userScripts |
| S48 | Chrome 138 toggle | https://developer.chrome.com/blog/chrome-userscript |
| S49 | MV2 deprecation | https://developer.chrome.com/docs/extensions/develop/migrate/mv2-deprecation-timeline |
| S50 | VM update diff (#500) | https://github.com/violentmonkey/violentmonkey/issues/500 |
| S51 | VM integrity (#1558) | https://github.com/violentmonkey/violentmonkey/issues/1558 |
| S52 | TM closed-source (#1515) | https://github.com/Tampermonkey/tampermonkey/issues/1515 |
| S53 | Cyberhaven attack | https://www.cyberhaven.com/engineering-blog/final-analysis-chrome-extension-security-incident |
| S54 | Trust Wallet attack | https://www.rescana.com/post/trust-wallet-chrome-extension-supply-chain-attack-7-million-cryptocurrency-theft-via-compromised-v |
| S55 | MV3 extensions study | https://arxiv.org/abs/2503.04292 |
| S56 | Arcanum USENIX 2024 | https://www.gatech.edu/news/2024/09/17/study-finds-thousands-browser-extensions-compromise-user-data |
| S57 | Signature-Based SRI | https://groups.google.com/a/chromium.org/g/blink-dev/c/QSsuBmjlnfk/m/jZA-M5VhAgAJ |
| S58 | OWASP Extension Sheet | https://cheatsheetseries.owasp.org/cheatsheets/Browser_Extension_Vulnerabilities_Cheat_Sheet.html |
| S59 | Mozilla secure ext guide | https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Security_best_practices |
| S60 | GH Actions hardening | https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions |
| S61 | EU CRA SBOM | https://www.darkreading.com/application-security/sboms-in-2026-some-love-some-hate-much-ambivalence |
| S62 | W3C WebExtensions CG | https://www.w3.org/community/webextensions/ |
| S63 | uBOL architecture | https://deepwiki.com/gorhill/uBlock/10.1-mv3-architecture-overview |
| S64 | Stylus MV3 | https://github.com/openstyles/stylus/discussions/1761 |
| S65 | Playwright ext testing | https://playwright.dev/docs/chrome-extensions |
| S66 | Vitest 4.1 | https://vitest.dev/blog/vitest-4-1.html |
| S67 | CWS 2025 policies | https://developer.chrome.com/blog/cws-policy-updates-2025 |
| S68 | Privacy Guides TM | https://discuss.privacyguides.net/t/does-tampermonkey-extension-affect-privacy-and-security/16728 |
| S69 | HN TM trust | https://news.ycombinator.com/item?id=35692540 |
| S70 | awesome-userscripts | https://github.com/awesome-scripts/awesome-userscripts |
| S71 | VM MV3 PR (#2399) | https://github.com/violentmonkey/violentmonkey/pull/2399 |
| S72 | Mozilla MV2 support | https://www.ghacks.net/2025/02/26/firefox-mozilla-confirms-support-for-classic-extensions-and-manifest-v3-add-ons/ |
| S73 | npm worm (Sep 2025) | https://www.sygnia.co/threat-reports-and-advisories/npm-supply-chain-attack-september-2025/ |
| S74 | MDN Firefox MV3 userScripts | https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/userScripts |
| S75 | CWS Program Policies MV3 code requirements | https://developer.chrome.com/docs/webstore/program-policies/policies |
| S76 | Greasy Fork API and prefilled updates | https://greasyfork.org/en/help/api |
| S77 | Tampermonkey external editor FAQ | https://www.tampermonkey.net/faq.php?q=Q402 |
| S78 | Tampermonkey Editors vscode.dev extension | https://chromewebstore.google.com/detail/tampermonkey-editors/lieodnapokbjkkdkhdljlllmgkmdokcm |
| S79 | Local userscript workflow pain | https://www.reddit.com/r/tampermonkey/comments/1qrbdeo/develop_userscript_in_vscode_without_manual/ |
| S80 | Chrome DNR responseHeaders reference | https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest |
| S81 | Chrome File System Access API | https://developer.chrome.com/docs/capabilities/web-apis/file-system-access |
| S82 | Chrome Offscreen API | https://developer.chrome.com/docs/extensions/reference/api/offscreen |
| S83 | Chrome remote-hosted-code guidance | https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code |
| S84 | ScriptCat background script docs | https://docs.scriptcat.org/en/docs/dev/background/ |
| S85 | Chrome Navigation API guide | https://developer.chrome.com/docs/web-platform/navigation-api |
| S86 | MDN Navigation navigate event | https://developer.mozilla.org/en-US/docs/Web/API/Navigation/navigate_event |
| S87 | Chrome webNavigation extension API | https://developer.chrome.com/docs/extensions/reference/api/webNavigation |
| S88 | MDN Navigation API overview | https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API |
| S89 | CWS User Data FAQ | https://developer.chrome.com/docs/webstore/program-policies/user-data-faq/ |
| S90 | MDN File System API overview | https://developer.mozilla.org/en-US/docs/Web/API/File_System_API |
| S91 | Chrome File System Access persistent permissions | https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api |
| S92 | MDN FileSystemFileHandle | https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle |
| S93 | Chrome alarms API | https://developer.chrome.com/docs/extensions/reference/api/alarms |
| S94 | MDN Clipboard writeText | https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText |
| S95 | MDN URL createObjectURL | https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static |
| S96 | MDN anchor download | https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/a#download |
| S97 | Chrome Storage API managed area | https://developer.chrome.com/docs/extensions/reference/api/storage |
| S98 | Chrome managed storage manifest schema | https://developer.chrome.com/docs/extensions/reference/manifest/storage |
| S99 | Chrome extension policy deployment verification | https://support.google.com/chrome/a/answer/7517624 |
