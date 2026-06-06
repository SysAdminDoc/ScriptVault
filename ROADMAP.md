# ScriptVault Roadmap

> Single source of truth for planned work. Tiered by execution priority.
> Completion history lives in [`COMPLETED.md`](COMPLETED.md); the research and
> planning map lives in [`RESEARCH_REPORT.md`](RESEARCH_REPORT.md). Legacy
> planning passes (Rounds 1-14, Cycles 1-20) are archived under `docs/archive/`.
>
> **Roadmap version:** Round 25 - dashboard local file binding 2026-06-06.
> **Shipped baseline:** v3.11.0 (2026-05-19, tag pushed). `main` has additional unreleased hardening, TS promotion, Firefox validation, and release-trust commits through 2026-06-05.
> **Test suite:** 1430 Vitest cases green; `npm audit --audit-level=high --omit=optional` clean; 27/27 TS-promoted runtime entries; 0 mirrored; 0 divergent.
> **Source floor:** 400+ external URLs across Rounds 1-25. Every Now/Next item carries source IDs from the Appendix.
>
> Last researched: Round 25 - 2026-06-06.

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
- **Progress:** Schema classification and `npm run settings:schema:check` shipped 2026-06-06. Remaining: UI constraints and field-specific error text.
- **Acceptance:** Every visible setting has schema-backed validation; invalid fields show inline errors and do not persist; `npm run test:a11y` covers malformed-input fixtures.

### N-2. GM.* Namespace Parity and Guarded GM.fetch
- **Priority:** P2 | **Effort:** M | **Source:** [S10, S11, S12]
- **Problem:** Wrapper exports many `GM_*` callbacks but fewer `GM.*` promise aliases. Missing: `GM.addElement`, `GM.audio`, `GM.cookie`, `GM.focusTab`, `GM.getMenuCommands`, `GM.head`, `GM.log`, `GM.webRequest`. No `GM.fetch`. Scripts written for Tampermonkey/Violentmonkey's GM.* style fail silently.
- **Deliverable:** Generated alias parity table with drift test. `GM.fetch` only if it reuses existing `GM_xmlhttpRequest` host-scope, `@connect`, abort, redirect, and internal-host policy.

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
- **Local evidence:** `pages/dashboard.js` now routes editor manual saves and autosaves through `buildEditorSaveTrustOptions()`, sending `operation: 'local-save'`, `sourceKind: 'local-editor'`, a dashboard source label, and `suppressMetadataSourceFallback: true`; autosaves also use an ephemeral `localSaveSessionId` stored only in open tab state. `src/background/core.ts`, `src/background/trust-receipt.ts`, `src/types/messages.ts`, and `src/types/script.ts` preserve local receipt source metadata while keeping update/download/homepage URLs available for review; the background save path keeps autosave coalescing in an in-memory `_localSaveReceiptCoalescing` map, not script records. `src/storage/script-db.ts` keeps File System Access handles in a separate `localWorkspaceBindings` IndexedDB store and returns display-safe summaries by default. `pages/dashboard.html` and `pages/dashboard.js` now add a feature-detected `Bind File` editor-toolbar action and a local workspace status chip that reads display-name/permission summaries from the same local-only store without calling `saveScript`. `tests/local-save-trust-receipt.test.js`, `tests/trust-receipt.test.js`, `tests/storage.test.js`, `tests/local-workspace-dashboard.test.js`, and export/sync/support snapshot tests pin the source/coalescing/redaction/binding contract.
- **Problem:** X-8 local workspace edits and X-9 publish handoffs need a consistent "what did I just save?" audit trail. Today normal editor saves mark the script as locally modified but can keep the previous trust receipt, which weakens rollback explanation, support snapshots, and future local-file binding review.
- **Deliverable:** Route editor/manual/local-file saves through an explicit local-save receipt path: `trust: { recordReceipt: true, operation: 'local-save', sourceKind: 'local-editor', sourceLabel: 'Dashboard editor' }`, a receipt/source schema that can suppress metadata URL fallback for local saves, coalescing rules for autosave bursts, and a dashboard badge that distinguishes "Local edit" from "Bound local workspace" without storing absolute paths or serialized file handles in script records, exports, sync payloads, or support snapshots.
- **Cycle 51 implementation slices:** (1) extend `SaveScript.trust` and `createScriptTrustReceipt()` with a reviewed `sourceKind/sourceLabel` or `forceLocalSource` field so `local-save` receipts render as local even when the userscript still declares `@downloadURL`; (2) add a small dashboard helper, e.g. `buildEditorSaveTrustOptions({ autosave })`, and use it from `saveCurrentScript()` instead of duplicating literal payloads; (3) add an autosave coalescing token stored outside exported script data so repeated two-second autosaves update the active local-save receipt/window rather than creating noisy rollback history; (4) add `localWorkspace`/file-handle future keys to local-only settings or, preferably, a separate non-exported local workspace store before X-8 starts; (5) keep drag/drop and install-page saves on install/update receipts unless they are explicitly local-file refreshes; (6) teach `renderTrustReceiptInfo()` and the provenance badge to render `local-save` as local editing activity while preserving remote update/download URLs in normal metadata fields.
- **Progress:** Cycle 54 shipped the local editor save receipt path: typed save trust payloads accept `sourceKind`, `sourceLabel`, `suppressMetadataSourceFallback`, and optional permission outcomes; both receipt builders suppress metadata URL fallback for local sources; dashboard manual saves and autosaves request local receipts; the receipt panel shows the local source label; and focused tests cover dashboard wiring plus local receipt source behavior. Cycle 55 added autosave coalescing: dashboard autosaves send an ephemeral coalesce key/window, the background save path reuses the original rollback history entry during that window, manual/non-coalesced saves clear the in-memory state, the key is absent from script types, and the path still calls `reregisterScript(script)`. Cycle 56 added the local-only binding-store skeleton, deletes bindings with their script, returns summaries without handles/paths, strips future local workspace settings from JSON exports, and pins CloudSync, EasyCloud, and support snapshot redaction. Cycle 57 added the first dashboard `Bind File` action: it is hidden/disabled without `showOpenFilePicker`, calls the picker directly from the click handler, stores the handle only in local IndexedDB, renders display-name/permission summaries, and does not read/apply code or write save history.
- **Acceptance:** Focused tests prove dashboard manual save sends the local-save trust payload, `saveScript` local-save writes a new receipt when code changes, `receipt.source.installHost` is `local` or blank rather than the script's `@downloadURL` host, rollback metadata points to the previous version, the five-entry cap remains enforced, no-code saves do not churn history, autosave bursts coalesce, future file-handle/local-path metadata is excluded from JSON export, cloud export, EasyCloud sync, and support snapshots, and the path still uses `reregisterScript()` rather than a full registration sweep. Manual editor save, autosave, drag/drop install, install-page update, and future File System Access refresh tests must prove which receipt operation each path records.
- **Risk:** Autosave can create noisy receipts and version history churn. Coalesce repeated autosaves for the same script until the user closes the editor, manually saves, or applies a local-file diff.

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
- **Acceptance:** Source-level and jsdom tests cover fake `window.navigation.addEventListener('navigate')`, no-Navigation-API history fallback, `popstate`, `hashchange`, add/remove listener dedupe, no stacked `pushState`/`replaceState` proxies after repeated wrapper builds, one event for combined `navigate` plus `pushState` same-url transitions, and preserved detail shape `{ url, oldUrl }`. A browser smoke against a simple history-router fixture proves a userscript granted `window.onurlchange` reruns after soft navigation without hard refresh.
- **Risk:** `navigate` can fire before an SPA finishes DOM rendering. Do not promise post-render DOM stability; provide the frame-level recheck and keep docs clear that app-specific DOM readiness still needs idempotent observers or selectors.

### X-4. Monaco ESM Build Implementation
- **Priority:** P2 | **Effort:** L | **Source:** [S17, S24]
- **Problem:** Monaco AMD is deprecated. Staying on v0.52.x blocks LSP namespace (v0.55), new features, and security patches.
- **Deliverable:** Migrate `lib/monaco/` to ESM build. Consider Monaco v0.55's LSP namespace for userscript IntelliSense.

### X-5. `browser` Namespace Cross-Browser Alias
- **Priority:** P3 | **Effort:** S | **Source:** [S25]
- **Problem:** Chrome 148 exposes `browser` namespace alongside `chrome`. Reduces cross-browser divergence.
- **Deliverable:** Evaluate adopting `browser.*` with thin polyfill for Chrome <148.

### X-6. Trusted Types Documentation
- **Priority:** P3 | **Effort:** S | **Source:** [S26]
- **Problem:** Sites using Trusted Types CSP reject raw `innerHTML` in MAIN-world scripts. USER_SCRIPT world is exempt.
- **Deliverable:** Documentation in README and Help tab. Optional `TrustedTypes` wrapper helper.

### X-7. Script Subscription Feed Improvements
- **Priority:** P3 | **Effort:** M | **Source:** [S04, S27]
- **Problem:** Script subscriptions shipped but are basic JSON feeds.
- **Deliverable:** Feed auto-refresh via `chrome.alarms`, feed health indicators, configurable refresh interval.

### X-8. Developer Workspace and Local File Watch Mode
- **Priority:** P2 | **Effort:** L | **Source:** [S29, S30, S77, S78, S79, S81, S89, S90, S91, S92]
- **Local evidence:** ScriptVault already has Monaco, `lib/scriptvault.d.ts`, `Open in vscode.dev`, Gist import/export, install-source provenance, and `local-save` receipts. Cycle 57 adds the first File System Access workspace entry point: `pages/dashboard.html` exposes an editor-toolbar `Bind File` control and local workspace status chip, while `pages/dashboard.js` feature-detects `showOpenFilePicker`, calls it directly from the user click handler, writes handles only to local IndexedDB, and renders display-safe permission summaries. `pages/dashboard.js` still imports via file input/drag/drop and sends `.user.js` files through `createScript`, while JSON/ZIP imports use quarantine/receipt paths. `src/background/core.ts` JSON/cloud export can include script settings and `versionHistory`; `src/background/cloud-sync.ts` and `src/modules/sync-easycloud.ts` strip only allowlisted settings, so file handles, absolute paths, or local binding metadata must not be stored in `Script.settings` or `Script.versionHistory`. The existing Settings row "Allow scripts to access local files" is an execution/security preference and should not be reused as the developer workspace binding control.
- **Problem:** Power users repeatedly want to edit in VS Code or another IDE without copy-save-reload loops. Tampermonkey documents local `@require` and a separate Editors extension for vscode.dev, but those flows are awkward, browser-specific, and easy to confuse with unsafe local-file access.
- **Deliverable:** Opt-in developer workspace mode: bind a script to a user-picked local `.user.js` file or folder through the File System Access API on Chromium, show a clear local-source badge, import metadata and code on demand, queue changed files as review-only updates, preserve ScriptVault rollback/trust receipts, and keep Firefox on manual file import until a secure equivalent exists.
- **Progress:** Cycle 56 added `LocalWorkspaceBindings` as a local-only IndexedDB-backed store in `modules/storage.js`. It can persist `FileSystemHandle` objects separately from `ScriptStorage`, returns display-safe summaries that omit handles and absolute paths, and is cleaned up when scripts are deleted or storage is cleared. Cycle 57 wired the first dashboard binding action: it stores a picked `FileSystemFileHandle` in the same local-only store from the extension page, surfaces display-name/permission summaries, and deliberately avoids refresh/apply execution until a review modal exists.
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
- **Risk:** Prefill still uses a POST that depends on the user's Greasy Fork session; keep this feature behind an explicit user action and document that final publication happens on Greasy Fork, not inside ScriptVault.

## Later

### L-1. Enterprise/Policy-Based Script Provisioning
- **Priority:** P3 | **Effort:** L | **Source:** [S28]
- **Problem:** Tampermonkey v5.5.0 added OS policy provisioning. No open-source manager offers this.
- **Deliverable:** Read `chrome.storage.managed` policy keys for script URLs, auto-install on load, managed-script indicator.

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

## Round 16-24 Research Log

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

## Continuation State

- **Current cycle:** Round 25 Cycle 57 implemented the first X-8 dashboard local-file binding control. `Bind File` is feature-detected, calls `showOpenFilePicker()` directly from the user click handler, persists the selected `FileSystemFileHandle` only in local IndexedDB, renders display-name/permission summaries, and has behavior-level tests proving binding does not call `saveScript`, read code text, or churn save history.
- **Next implementation angle:** Cycle 58 should continue X-8 with `Refresh from local` and `Unbind` actions: explicit permission reconnect through `requestPermission()` only from a user action, stale/missing-file/error summaries, a review-only diff modal, no-change detection, and local-file `saveScript` receipts only after the user accepts a changed-file apply.
- **Follow-up source checks:** Re-check CWS user-data/privacy expectations and File System Access handle persistence before editing local-save or local-workspace metadata.
- **Suggested verification before implementation:** Run focused tests for setup-state banners, local health reports, install-source/trust receipts, support snapshot redaction, export/sync local-metadata redaction, and `reregisterScript()` behavior after code changes touching N-7, N-8, X-8, or X-9.

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
| Enterprise provisioning | No | **Yes** (v5.5) | No | No |
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
