# ScriptVault Roadmap

> Single source of truth for planned work. Tiered by execution priority.
> Completion history lives in git history and `CHANGELOG.md`; consolidated
> research conclusions live in `RESEARCH.md`. Legacy planning passes are
> reference-only under `docs/archive/`.
>
> **Roadmap version:** Round 99 - Greasy Fork handoff cleanup hardening 2026-06-11.
> **Shipped baseline:** v3.11.0 (2026-05-19, tag pushed). `main` has additional unreleased hardening, TS promotion, Firefox validation, and release-trust commits through 2026-06-11.
> **Test suite:** 1582 Vitest cases green; `npm audit --audit-level=high --omit=optional` clean; 28/28 TS-promoted runtime entries; 0 mirrored; 0 divergent.
> **Source floor:** 400+ external URLs across Rounds 1-40. Every Now/Next item carries source IDs from the Appendix.
>
> Last researched: Round 92 - 2026-06-07.

---

## Market Context

Tampermonkey was briefly removed from CWS in July 2025 [S01] but returned and now sits at v5.5.0 with 12M users — the dominant incumbent. Violentmonkey remains MV2-only (v2.41.0, actively developed) but permanently blocked on Chrome 133+ (MV2 fully removed in Chrome 139) [S02, S03]. ScriptCat (4.5K stars) is MV3-native but niche [S04]. New entrants include Tweeks (YC W25, AI-native) and lightweight MV3 managers (OrangeMonkey, Vanilla Pudding, BareScript). Greasemonkey and FireMonkey remain Firefox-only MV2 [S05, S06].

**ScriptVault is the only MV3-native, open-source, full-featured userscript manager with zero telemetry on the Chrome Web Store.** Tampermonkey's return narrows the MV3 exclusivity window, but its closed-source and freemium model remain trust liabilities. The roadmap prioritises differentiation: ship Firefox AMO, land Edge, close GM API parity gaps, and capitalize on trust advantages (Ed25519 signing, AST analysis, update review, MIT license).

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

_(All Now-tier items are credential/compliance blocked — see `Roadmap_Blocked.md`.)_


## Later

### L-6. Sigstore Keyless Signing for Script Authors
- **Priority:** P3 | **Effort:** L | **Source:** [S33, S34, S35]
- **Problem:** Ed25519 signing requires manual key management. Sigstore's keyless model eliminates key custody.
- **Progress:** Sigstore bundle parser, verifier, and Fulcio root checks already shipped for `@require-provenance`.

### L-7. Visual Regression Testing (Vitest Browser Mode)
- **Priority:** P3 | **Effort:** M | **Source:** [S36]
- **Problem:** UI changes lack automated visual verification. Vitest 4.0 graduated Browser Mode with `toMatchScreenshot`.

### L-9. WebSocket Support in GM API
- **Priority:** P3 | **Effort:** M | **Source:** [S38]
- **Problem:** TM #1483 requests WebSocket support.
- **Deliverable:** `GM_webSocket` with `@connect` enforcement and abort support.


## Under Consideration

- **UC-1. Safari via Native App Container** [S40, S41] — Safari lacks `userScripts` API. Requires separate Swift project. Reconsider when user demand justifies it.
- **UC-2. Script Marketplace** [S42] — ScriptVault is a manager, not a platform. GreasyFork integration serves the same need.
- **UC-3. AI-Assisted Script Editing** [S43] — Must be opt-in, local-first. Reconsider when on-device LLMs are practical.
- **UC-4. Collaborative/Team Sharing** — Small user base. Existing sync covers the 90% case.

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
| 127 | GM value-sync last-result timestamp sanitizer coverage | `pages/dashboard.js`, `tests/support-snapshot-redaction.test.js` | Support exports should normalize last-result timestamps through the reviewed helper [S47, S98] | Routed last-result timestamp export through `sanitizeSupportSnapshotTimestamp()` and pinned the shared-helper path |
| 128 | GM value-sync retry-age unknown bucket coverage | `src/background/core.ts`, `background.core.js`, `tests/local-health-report.test.js` | Retry-ready diagnostics with missing timestamps should not be labeled fresh [S47, S98] | Classified null/undefined retry ages as `unknown` and pinned the local-health last-result gating path |
| 129 | GM value-sync support nested-field coverage | `tests/support-snapshot-redaction.test.js` | Pre-export support summaries should read only reviewed nested sanitized fields [S47, S98] | Pinned nested last-result, retry-resolution, retry-resolution-history, and retry-history field allowlists |
| 130 | GM value-sync retry-history timestamp retention coverage | `tests/support-snapshot-redaction.test.js` | Support exports should not retain retry-history timestamps when retained history is empty [S47, S98] | Pinned retained-history timestamp helper use for retry and retry-resolution histories |
| 131 | GM value-sync retry-resolution timestamp range coverage | `pages/dashboard.js`, `tests/support-snapshot-redaction.test.js` | Support exports should not expose impossible retry-resolution timestamp ranges [S47, S98] | Clamped retry-resolution latest retry timestamp to the resolution timestamp before export |
| 132 | GM value-sync retry-resolution age-bucket gating | `pages/dashboard.js`, `tests/support-snapshot-redaction.test.js` | Support exports should not retain retry-resolution age buckets without age minutes [S47, S98] | Gated retry-resolution age bucket export on retained age minutes and defaulted missing evidence to `unknown` |

## Competitive Position Summary

| Capability | ScriptVault | Tampermonkey | Violentmonkey | ScriptCat |
|---|---|---|---|---|
| MV3 native | Yes | Yes | **No (dead on Chrome)** | Yes |
| Open source | MIT | **No** | MIT | GPL-3.0 |
| Chrome Web Store | **Published** | **Published (12M)** | **Blocked (MV2)** | Published |
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

## Research-Driven Additions (2026-06-09)

> Items below were identified by exhaustive repo walk + 35+ external sources.
> Duplicates against existing Now/Next/Later/UC/Rejected tiers were filtered.
> Each item carries impact (1-5), effort (S/M/L/XL), and tier recommendation.

### RD-2. Dashboard i18n DOM Translation Pass
- **Tier:** Next | **Priority:** P2 | **Impact:** 4 | **Effort:** L
- **Source:** README ("dashboard interface is currently English-only"), locale:check:strict failure (~70 keys/locale missing)
- **Problem:** Manifest and extension messages are localized in 8 languages, but the dashboard UI (~5,190 lines) is entirely English. This blocks international adoption during the once-in-a-decade MV3 window.
- **Deliverable:** Wire `dashboard-i18n-v2.js` (already has 600 keys in 8 languages) into dashboard DOM. Add missing ~70 keys per locale. Gate with `npm run locale:check:strict` passing in CI.
- **Acceptance:** Dashboard renders translated strings for all 8 locales. `locale:check:strict` exits 0. No untranslated hardcoded English strings in UI-visible dashboard elements.

### RD-6. background.core.ts Extraction Roadmap
- **Tier:** Later | **Priority:** P2 | **Impact:** 4 | **Effort:** XL
- **Source:** CLAUDE.md "TypeScript Source" section, ts-source-promotion.json (0 mirrored remaining but core.ts is the 12K-line bridge)
- **Problem:** `src/background/core.ts` is a 12,002-line monolith that generates `background.core.js`. It contains install, update, sync, registration, toggle, save, cron, GM handler, and message routing logic interleaved. New feature work requires careful cross-reference navigation, and type coverage remains incomplete (ResponseMap covers ~25 of 135+ actions).
- **Deliverable:** Multi-phase extraction: (1) Complete ResponseMap type coverage for all 135+ actions; (2) Extract GM handler dispatch into typed per-API modules; (3) Extract sync orchestration into a standalone module; (4) Extract the message router into a typed dispatcher with exhaustive action matching. Each phase is independently shippable and testable.
- **Risk:** Very large refactor. Each phase must maintain byte-for-byte runtime parity with the generated JS output. Use the existing ts-runtime drift gate to prevent regressions.

### RD-7. IndexedDB Storage Bucket Partitioning
- **Tier:** Later | **Priority:** P3 | **Impact:** 3 | **Effort:** L
- **Source:** Chrome IndexedDB storage improvements blog, RxDB performance research
- **Problem:** All IndexedDB data (scripts, values, stats, backups) lives in a single database. Chrome now supports storage buckets that allow separate IndexedDB instances on separate threads, with documented 28-43% read/write improvements.
- **Deliverable:** Partition ScriptStorage, ScriptValues, and BackupScheduler into separate storage buckets. Measure write throughput for libraries >500 scripts. Fall back to single-bucket on browsers that don't support the Storage Buckets API.
- **Acceptance:** `navigator.storageBuckets` feature-detected. Backup restore and sync merge still work after partitioning. Large-library perf harness shows improvement.

### RD-11. Monaco v0.55+ Upgrade for LSP Namespace
- **Tier:** Under Consideration | **Priority:** P3 | **Impact:** 3 | **Effort:** M
- **Source:** Monaco ESM migration plan, Monaco v0.55 changelog (LSP namespace)
- **Problem:** ScriptVault ships Monaco v0.52.2. v0.55+ adds a native LSP namespace that could improve userscript IntelliSense beyond the current autocomplete (GM API completions, @metadata directive completions). v0.55 also renamed `EditorAutoClosingOvertypeStrategy` to `EditorAutoClosingEditStrategy`.
- **Deliverable:** Evaluate: does the LSP namespace enable richer userscript editing (e.g., type-aware GM API completions from `lib/scriptvault.d.ts`)? If yes, upgrade Monaco, update ESM build budget, and verify sandbox CSP compatibility. If no, defer until a compelling reason appears.
- **Risk:** Breaking API changes in v0.55. ESM bundle size may grow. Requires separate dependency-budget and browser-proof cycle.

### Appendix: Research-Driven Sources

| ID | Source | URL |
|---|---|---|
| R01 | ScriptCat HN thread (2026) | https://news.ycombinator.com/item?id=45938449 |
| R02 | ScriptCat DeepWiki | https://deepwiki.com/scriptscat/scriptcat |
| R03 | Chrome IndexedDB storage buckets | https://developer.chrome.com/blog/maximum-idb-performance-with-storage-buckets |
| R04 | Chrome IndexedDB compression | https://developer.chrome.com/docs/chromium/indexeddb-storage-improvements |
| R05 | EU CRA SBOM timeline | https://www.herodevs.com/blog-posts/cra-reporting-obligations-start-september-2026 |
| R06 | Cyberhaven supply chain | https://www.cyberhaven.com/engineering-blog/final-analysis-chrome-extension-security-incident |
| R07 | Trust Wallet supply chain | https://thehackernews.com/2025/12/trust-wallet-chrome-extension-hack.html |
| R08 | Chrome SW lifecycle | https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle |
| R09 | Monaco v0.55 LSP | https://github.com/microsoft/monaco-editor/blob/main/CHANGELOG.md |
| R10 | TypeScript 6 features | https://pooyagolchian.com/blog/typescript-6-features-2026/ |
| R11 | Playwright extension testing | https://playwright.dev/docs/chrome-extensions |
| R12 | WCAG 2.2 resize text | https://www.w3.org/TR/WCAG22/ |
| R13 | Chrome ext supply chain (2026) | https://securityboulevard.com/2026/03/the-chrome-extension-backdoor-how-productivity-tools-became-enterprise-attack-vectors/ |

### Appendix: Research-Driven Sources (2026-06-12)

| ID | Source | URL |
|---|---|---|
| RD12-01 | Tampermonkey MCP server | https://github.com/Tampermonkey/tampermonkey-mcp |
| RD12-02 | VM MV3 status (dead on Chrome) | https://github.com/violentmonkey/violentmonkey/issues/2340 |
| RD12-03 | ScriptCat background scripts | https://docs.scriptcat.org/en/docs/dev/background/ |
| RD12-04 | Chrome userScripts.execute (135+) | https://developer.chrome.com/docs/extensions/reference/api/userScripts |
| RD12-05 | Chrome 138 per-extension toggle | https://developer.chrome.com/blog/chrome-userscript |
| RD12-06 | Chrome structured-clone messaging | https://developer.chrome.com/blog/structured-clone-messaging |
| RD12-07 | Ed25519 native browser support | https://blogs.igalia.com/nicolo/2025/05/21/ed25519-in-all-browsers/ |
| RD12-08 | Trust Wallet supply chain attack | https://thehackernews.com/2025/12/trust-wallet-chrome-extension-hack.html |
| RD12-09 | 36-extension compromise (2025) | https://blog.sekoia.io/targeted-supply-chain-attack-against-chrome-browser-extensions/ |
| RD12-10 | Trusted Types API baseline | https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API |
| RD12-11 | Chrome sidePanel.getLayout (140+) | https://developer.chrome.com/docs/extensions/reference/api/sidePanel |
| RD12-12 | OWASP Extension Cheat Sheet | https://cheatsheetseries.owasp.org/cheatsheets/Browser_Extension_Vulnerabilities_Cheat_Sheet.html |
| RD12-13 | Chrome SW lifecycle improvements | https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle |
| RD12-14 | SemVer 2.0.0 pre-release ordering | https://semver.org/#spec-item-11 |
| RD12-15 | Monaco v0.55 breaking changes | https://github.com/microsoft/monaco-editor/blob/main/CHANGELOG.md |
| RD12-16 | CWS policy updates 2025 | https://developer.chrome.com/blog/cws-policy-updates-2025 |
| RD12-17 | Firefox AMO policies (Aug 2025) | https://blog.mozilla.org/addons/2025/06/23/updated-add-on-policies-simplified-clarified/ |
| RD12-18 | MV2 deprecation timeline | https://developer.chrome.com/docs/extensions/develop/migrate/mv2-deprecation-timeline |

### Appendix: Research-Driven Sources (2026-06-13)

| ID | Source | URL |
|---|---|---|
| RD13-01 | Chrome 141 Signature-Based SRI | https://developer.chrome.com/release-notes/141 |
| RD13-02 | WICG Signature-Based SRI spec | https://wicg.github.io/signature-based-sri/ |
| RD13-03 | Popover API baseline | https://developer.chrome.com/blog/introducing-popover-api |
| RD13-04 | CSS Anchor Positioning baseline | https://developer.chrome.com/blog/anchor-positioning-api |
| RD13-05 | Firefox 149-152 API changes | https://blog.mozilla.org/addons/2026/04/23/webextensions-api-changes-firefox-149-152/ |
| RD13-06 | CVE-2026-0628 Gemini panel hijack | https://unit42.paloaltonetworks.com/gemini-live-in-chrome-hijacking/ |
| RD13-07 | Group-IB 2026 supply chain report | https://www.group-ib.com/blog/supply-chain-attack-groups-2026/ |
| RD13-08 | PackageGate npm zero-days | https://www.securityweek.com/packagegate-flaws-open-javascript-ecosystem-to-supply-chain-attacks/ |
| RD13-09 | Chrome 139 MV2 final removal | https://developer.chrome.com/docs/extensions/develop/migrate/mv2-deprecation-timeline |
| RD13-10 | Chrome I/O 2026 extensions recap | https://developer.chrome.com/blog/extensions-io-2026 |
| RD13-11 | LayerX extension security 2026 | https://go.layerxsecurity.com/browser-extension-security-report-2026 |
| RD13-12 | EU CRA draft guidance (Mar 2026) | https://digital-strategy.ec.europa.eu/en/news/commission-publishes-feedback-draft-guidance-assist-companies-applying-cyber-resilience-act |
| RD13-13 | Chrome IndexedDB Snappy compression | https://developer.chrome.com/docs/chromium/indexeddb-storage-improvements |
| RD13-14 | W3C WebExtensions WG draft charter | https://w3c.github.io/charter-drafts/2025/webextensions-wg.html |
| RD13-15 | Chrome DevTools for Agents v1 | https://developer.chrome.com/blog/devtools-for-agents-v1 |

### Appendix: Research-Driven Sources (2026-06-14)

| ID | Source | URL |
|---|---|---|
| RD14-01 | Tampermonkey changelog | https://www.tampermonkey.net/changelog.php |
| RD14-02 | Tampermonkey MCP server | https://github.com/Tampermonkey/tampermonkey-mcp |
| RD14-03 | Violentmonkey MV3 issue | https://github.com/violentmonkey/violentmonkey/issues/1934 |
| RD14-04 | ScriptCat repository | https://github.com/scriptscat/scriptcat |
| RD14-05 | ScriptCat documentation | https://docs.scriptcat.org/en/ |
| RD14-06 | Chrome userScripts API | https://developer.chrome.com/docs/extensions/reference/api/userScripts |
| RD14-07 | Chrome userScripts toggle change | https://developer.chrome.com/blog/chrome-userscript |
| RD14-08 | Chrome structured-clone messaging | https://developer.chrome.com/blog/structured-clone-messaging |
| RD14-09 | Firefox userScripts API | https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/userScripts |
| RD14-10 | Firefox WebExtensions API changes 149-152 | https://blog.mozilla.org/addons/2026/04/23/webextensions-api-changes-firefox-149-152/ |
| RD14-11 | Chrome remote-hosted-code guidance | https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code |
| RD14-12 | OWASP Browser Extension Vulnerabilities Cheat Sheet | https://cheatsheetseries.owasp.org/cheatsheets/Browser_Extension_Vulnerabilities_Cheat_Sheet.html |
| RD14-13 | Sekoia extension supply-chain report | https://blog.sekoia.io/targeted-supply-chain-attack-against-chrome-browser-extensions/ |
| RD14-14 | LayerX GhostPoster extension campaign | https://layerxsecurity.com/blog/browser-extensions-gone-rogue-the-full-scope-of-the-ghostposter-campaign/ |
| RD14-15 | Palant remote-code-ban bypass analysis | https://palant.info/2025/01/20/malicious-extensions-circumvent-googles-remote-code-ban/ |

## Research-Driven Additions (2026-06-15)

> Items below identified by exhaustive repo walk + 40+ external sources across
> competitors (Tampermonkey v5.5.0, Violentmonkey MV3 status, ScriptCat v1.4.0-beta.4),
> Chrome 140-148 APIs, Firefox 149-153, security landscape (NSA MCP guidance, EU CRA
> Sep 2026, Trusted Types Baseline), and dependency changelogs. Deduplicated against
> all existing tiers (Now through Rejected) and all prior RD-1..RD-14 additions.

### Appendix: Research-Driven Sources (2026-06-15)

| ID | Source | URL |
|---|---|---|
| RD15-01 | NSA MCP security guidance | https://media.defense.gov/2026/Jun/02/2003943289/-1/-1/0/CSI_MCP_SECURITY.PDF |
| RD15-02 | Trusted Types Baseline (Feb 2026) | https://web.dev/blog/baseline-digest-feb-2026 |
| RD15-03 | esbuild security advisory | https://security.snyk.io/package/npm/esbuild |
| RD15-04 | EU CRA Sep 2026 reporting | https://anchore.com/sbom/eu-cra/ |
| RD15-05 | EU CRA EOL obligations | https://www.herodevs.com/blog-posts/cra-reporting-obligations-start-september-2026 |
| RD15-06 | Violentmonkey MV3 closure | https://github.com/violentmonkey/violentmonkey/issues/1934 |
| RD15-07 | VM community MV3 PR closed | https://github.com/violentmonkey/violentmonkey/pull/2493 |
| RD15-08 | ScriptCat v1.4.0-beta.4 | https://github.com/scriptscat/scriptcat |
| RD15-09 | Acorn 8.17.0 strict mode | https://github.com/acornjs/acorn |
| RD15-10 | Chrome 148 browser namespace | https://developer.chrome.com/docs/extensions/whats-new |
| RD15-11 | Monaco v0.55 LSP namespace | https://github.com/microsoft/monaco-editor/blob/main/CHANGELOG.md |
| RD15-12 | Vitest 4.1 Browser Mode stable | https://vitest.dev/blog/vitest-4 |
| RD15-13 | CVE-2025-49596 MCP Inspector | https://github.com/advisories/GHSA-9crc-q9x8-hgqq |
| RD15-14 | Tampermonkey MCP server | https://github.com/Tampermonkey/tampermonkey-mcp |
| RD15-15 | Chrome MV2 final removal | https://developer.chrome.com/docs/extensions/develop/migrate/mv2-deprecation-timeline |



### Appendix: Research-Driven Sources (2026-06-20)

| ID | Source | URL |
|---|---|---|
| RD20-01 | VM MV3 death (Chrome 150 flag removal) | https://developer.chrome.com/docs/extensions/develop/migrate/mv2-deprecation-timeline |
| RD20-02 | VM community MV3 PR closed | https://github.com/violentmonkey/violentmonkey/pull/2493 |
| RD20-03 | VM stranded user base | https://github.com/violentmonkey/violentmonkey/issues/1934 |
| RD20-04 | Vitest coverage v8 provider | https://vitest.dev/guide/coverage |
| RD20-05 | WCAG 2.1 SC 2.1.1 keyboard | https://www.w3.org/WAI/WCAG21/Understanding/keyboard.html |
| RD20-06 | AMO reproducible builds | https://extensionworkshop.com/documentation/publish/source-code-submission/ |
| RD20-07 | CSS logical properties | https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_logical_properties_and_values |
| RD20-08 | ScriptCat export format | https://docs.scriptcat.org/en/ |
| RD20-09 | Chrome 150 release schedule | https://chromiumdash.appspot.com/schedule |
| RD20-10 | CWS screenshot requirements | https://developer.chrome.com/docs/webstore/images |
| RD20-11 | Trusted Types MDN | https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API |
| RD20-12 | NSA MCP security guidance | https://media.defense.gov/2026/Jun/02/2003943289/-1/-1/0/CSI_MCP_SECURITY.PDF |




### Appendix: Research-Driven Sources (2026-06-21)

| ID | Source | URL |
|---|---|---|
| RD21-01 | CSS logical properties MDN | https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_logical_properties_and_values |
| RD21-02 | chrome.i18n API | https://developer.chrome.com/docs/extensions/reference/api/i18n |
| RD21-03 | scripts/check-readme-claims.mjs | Local: `scripts/check-readme-claims.mjs` |
| RD21-04 | WCAG 2.2 SC 2.5.8 Target Size | https://www.w3.org/TR/WCAG22/#target-size-minimum |
| RD21-05 | MCPMonkey (VM MCP fork) | https://github.com/kstrikis/mcpmonkey |
| RD21-06 | MCP spec 2026-07-28 RC | https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/ |
| RD21-07 | Firefox 153 userScripts.execute | https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/153 |
| RD21-08 | Axios npm compromise (2026) | https://www.microsoft.com/en-us/security/blog/2026/04/01/mitigating-the-axios-npm-supply-chain-compromise/ |
| RD21-09 | Red Hat npm worm (2026) | https://www.wiz.io/blog/miasma-supply-chain-attack-targeting-redhat-npm-packages |
| RD21-10 | Mastra npm scope takeover (2026) | https://www.microsoft.com/en-us/security/blog/2026/06/17/postinstall-payload-inside-mastra-npm-supply-chain-compromise/ |





### Appendix: Research-Driven Sources (2026-06-20 deep pass 2)

| ID | Source | URL |
|---|---|---|
| RD22-01 | Chrome sidePanel API (close/onOpened/onClosed) | https://developer.chrome.com/docs/extensions/reference/api/sidePanel |
| RD22-02 | Popover API Baseline | https://developer.chrome.com/blog/introducing-popover-api |
| RD22-03 | CSS Container Queries guide | https://developer.chrome.com/docs/devtools/css/container-queries |
| RD22-04 | Navigation API Baseline | https://web.dev/blog/baseline-navigation-api |
| RD22-05 | IndexedDB Snappy compression | https://developer.chrome.com/docs/chromium/indexeddb-storage-improvements |
| RD22-06 | VM MV3 death issue | https://github.com/violentmonkey/violentmonkey/issues/2340 |
| RD22-07 | VM fork proposal | https://github.com/violentmonkey/violentmonkey/issues/2341 |
| RD22-08 | TM closed-source concerns | https://github.com/Tampermonkey/tampermonkey/issues/1515 |
| RD22-09 | Privacy Guides TM discussion | https://discuss.privacyguides.net/t/does-tampermonkey-extension-affect-privacy-and-security/16728 |
| RD22-10 | OrangeMonkey Chrome Stats | https://chrome-stats.com/d/ekmeppjgajofkpiofbebgcbohbmfldaf |
| RD22-11 | Cyberhaven supply chain attack | https://www.cyberhaven.com/engineering-blog/final-analysis-chrome-extension-security-incident |
| RD22-12 | DarkSpectre/GhostPoster 8.8M users | https://thehackernews.com/2025/12/darkspectre-browser-extension-campaigns.html |
| RD22-13 | Stanley MaaS guaranteed CWS publication | https://www.bleepingcomputer.com/news/security/new-malware-service-guarantees-phishing-extensions-on-chrome-web-store/ |
| RD22-14 | LayerX Extension Security Report 2026 | https://go.layerxsecurity.com/browser-extension-security-report-2026 |
| RD22-15 | OWASP Browser Extension Cheat Sheet | https://cheatsheetseries.owasp.org/cheatsheets/Browser_Extension_Vulnerabilities_Cheat_Sheet.html |
| RD22-16 | Chrome DevTools for Agents v1 | https://developer.chrome.com/blog/devtools-for-agents-v1 |
| RD22-17 | TM alternatives roundup (absent) | https://rigorousthemes.com/blog/best-tampermonkey-alternatives/ |
| RD22-18 | Chrome MV2 final removal June 30 | https://developer.chrome.com/docs/extensions/develop/migrate/mv2-deprecation-timeline |
| RD22-19 | EU CRA reporting timeline | https://anchore.com/sbom/eu-cra/ |
| RD22-20 | NSA MCP security guidance | https://media.defense.gov/2026/Jun/02/2003943289/-1/-1/0/CSI_MCP_SECURITY.PDF |
| RD22-21 | Trusted Types on YouTube | https://developer.chrome.com/blog/trusted-types-on-youtube |
| RD22-22 | Monaco v0.55 breaking changes | https://github.com/microsoft/monaco-editor/blob/main/CHANGELOG.md |
| RD22-23 | Vitest 4.1 test tags | https://vitest.dev/blog/vitest-4-1.html |
| RD22-24 | TypeScript 6.0 announcement | https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/ |
| RD22-25 | Chrome I/O 2026 extensions recap | https://developer.chrome.com/blog/extensions-io-2026 |




### Appendix: Research-Driven Sources (2026-06-25)

| ID | Source | URL |
|---|---|---|
| RD25-01 | Chrome 148 release notes (browser namespace, structured clone) | https://developer.chrome.com/release-notes/148 |
| RD25-02 | Chrome 149 release notes (WebMCP origin trial) | https://developer.chrome.com/release-notes/149 |
| RD25-03 | Chrome I/O 2026 extensions recap | https://developer.chrome.com/blog/extensions-io-2026 |
| RD25-04 | Chrome MV2 final deprecation timeline | https://developer.chrome.com/docs/extensions/develop/migrate/mv2-deprecation-timeline |
| RD25-05 | Firefox 149-152 WebExtensions API changes | https://blog.mozilla.org/addons/2026/04/23/webextensions-api-changes-firefox-149-152/ |
| RD25-06 | Firefox 153 release notes | https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/153 |
| RD25-07 | CSS Anchor Positioning Baseline | https://developer.chrome.com/blog/anchor-positioning-api |
| RD25-08 | CSS Container Queries style queries Baseline (May 2026) | https://web.dev/blog/baseline-digest-may-2026 |
| RD25-09 | Popover API Baseline Widely Available | https://developer.chrome.com/blog/introducing-popover-api |
| RD25-10 | CycloneDX 1.7 (ECMA-424 2nd Ed) | https://docs.sbom.observer/release-notes/2026-03-25-cyclonedx-1.7 |
| RD25-11 | Vitest CVE-2026-47429 (arbitrary file read) | https://github.com/advisories/GHSA-5xrq-8626-4rwp |
| RD25-12 | npm audit: tmp path traversal | https://github.com/advisories/GHSA-7c78-jf6q-g5cm |
| RD25-13 | npm audit: undici TLS bypass | https://github.com/advisories/GHSA-vmh5-mc38-953g |
| RD25-14 | npm audit: vite NTLMv2 disclosure | https://github.com/advisories/GHSA-v6wh-96g9-6wx3 |
| RD25-15 | npm audit: ws memory exhaustion | https://github.com/advisories/GHSA-96hv-2xvq-fx4p |
| RD25-16 | QuickLens extension supply chain attack | https://www.rescana.com/post/quicklens-chrome-extension-supply-chain-attack-cryptocurrency-theft-and-clickfix-malware-campaign-a/ |
| RD25-17 | Ownership-transfer permission creep attack class | https://pluto.security/blog/chrome-extension-supply-chain-attacks-permission-creep/ |
| RD25-18 | CSA MCP Security Best Practices v1 | https://labs.cloudsecurityalliance.org/agentic/agentic-mcp-security-best-practices-v1/ |
| RD25-19 | MCP-38 threat taxonomy (arxiv) | https://arxiv.org/pdf/2603.18063 |
| RD25-20 | Tweeks (YC W25) AI userscript generator | https://www.tweeks.io/ |
| RD25-21 | Tampermonkey MCP server (17 GH stars) | https://github.com/Tampermonkey/tampermonkey-mcp |
| RD25-22 | Violentmonkey confirmed dead on Chrome | https://github.com/violentmonkey/violentmonkey/issues/1934 |
| RD25-23 | OrangeMonkey (2M+ users, VM fork) | https://chrome-stats.com/d/ekmeppjgajofkpiofbebgcbohbmfldaf |
| RD25-24 | Cosign v3 Sigstore bundle format | https://blog.sigstore.dev/cosign-3-0-available/ |
| RD25-25 | WCAG 2.2 SC 2.5.8 Target Size Minimum | https://www.w3.org/TR/WCAG22/#target-size-minimum |
| RD25-26 | Firefox adopted stylesheets content script access | https://bugzilla.mozilla.org/show_bug.cgi?id=1751346 |
| RD25-27 | EU CRA open-source carve-out | https://digital-strategy.ec.europa.eu/en/policies/cra-open-source |
| RD25-28 | W3C WebExtensions spec draft (June 5, 2026) | https://w3c.github.io/webextensions/specification/ |

### Appendix: Research-Driven Sources (2026-06-25 deep pass)

| ID | Source | URL |
|---|---|---|
| RD25D-01 | Tampermonkey v5.5.0 changelog | https://www.tampermonkey.net/changelog.php |
| RD25D-02 | Tampermonkey MCP server | https://github.com/Tampermonkey/tampermonkey-mcp |
| RD25D-03 | Violentmonkey MV3 death (confirmed) | https://github.com/violentmonkey/violentmonkey/issues/1934 |
| RD25D-04 | ScriptCat v1.4.0 AI Agent + MCP | https://github.com/scriptscat/scriptcat/releases/tag/v1.4.0 |
| RD25D-05 | ScriptCat documentation | https://docs.scriptcat.org/en/ |
| RD25D-06 | Tweeks (YC W25) AI userscript | https://www.tweeks.io/ |
| RD25D-07 | OrangeMonkey (2M+ users) | https://chrome-stats.com/d/ekmeppjgajofkpiofbebgcbohbmfldaf |
| RD25D-08 | Greasemonkey v4.14 | https://github.com/greasemonkey/greasemonkey |
| RD25D-09 | FireMonkey (userscript+userstyle) | https://github.com/erosman/firemonkey |
| RD25D-10 | Userscripts Safari v5.0.0-beta.23 | https://github.com/quoid/userscripts |
| RD25D-11 | Chrome MV2 final removal (Chrome 150) | https://developer.chrome.com/docs/extensions/develop/migrate/mv2-deprecation-timeline |
| RD25D-12 | Chrome Mutation Events deprecation | https://developer.chrome.com/blog/mutation-events-deprecation |
| RD25D-13 | Sanitizer API (setHTML) | https://web.dev/articles/sanitizer |
| RD25D-14 | Playwright Trace Viewer | https://playwright.dev/docs/trace-viewer |
| RD25D-15 | CodeMirror 6 changelog | https://codemirror.net/docs/changelog/ |
| RD25D-16 | vite-plugin-monkey (2K stars) | https://github.com/lisonge/vite-plugin-monkey |
| RD25D-17 | Chrome userScripts API | https://developer.chrome.com/docs/extensions/reference/api/userScripts |
| RD25D-18 | Chrome service worker lifecycle | https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle |
| RD25D-19 | Chrome I/O 2026 extensions recap | https://developer.chrome.com/blog/extensions-io-2026 |
| RD25D-20 | Firefox 153 release notes | https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/153 |
| RD25D-21 | OWASP Extension Cheat Sheet | https://cheatsheetseries.owasp.org/cheatsheets/Browser_Extension_Vulnerabilities_Cheat_Sheet.html |
| RD25D-22 | CSA MCP Security Best Practices v1 | https://labs.cloudsecurityalliance.org/agentic/agentic-mcp-security-best-practices-v1/ |
| RD25D-23 | Extension supply chain attacks (Sekoia) | https://blog.sekoia.io/targeted-supply-chain-attack-against-chrome-browser-extensions/ |
| RD25D-24 | Cyberhaven supply chain attack | https://www.cyberhaven.com/engineering-blog/final-analysis-chrome-extension-security-incident |
| RD25D-25 | Ownership-transfer permission creep | https://pluto.security/blog/chrome-extension-supply-chain-attacks-permission-creep/ |
| RD25D-26 | Requestly (HTTP interception + scripts) | https://www.requestly.com/ |
| RD25D-27 | Automa browser automation | https://www.automa.site/ |
| RD25D-28 | n8n workflow automation | https://n8n.io/ |
| RD25D-29 | awesome-userscripts | https://github.com/awesome-scripts/awesome-userscripts |
| RD25D-30 | Monaco v0.55 changelog | https://github.com/microsoft/monaco-editor/blob/main/CHANGELOG.md |

### Appendix: Research-Driven Sources (2026-06-26)

| ID | Source | URL |
|---|---|---|
| RD26-01 | ScriptCat v1.4.0 stable release | https://github.com/scriptscat/scriptcat/releases |
| RD26-02 | Chrome 150 MV2 flag removal | https://developer.chrome.com/docs/extensions/develop/migrate/mv2-deprecation-timeline |
| RD26-03 | Chrome 151 MV2 final lockdown | https://piunikaweb.com/2026/06/08/chrome-manifest-v2-unpacked-extensions-mac-windows/ |
| RD26-04 | Firefox 153 beta release notes | https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/153 |
| RD26-05 | 108 malicious extensions campaign (Socket) | https://techretry.com/malicious-chrome-extensions-2026/ |
| RD26-06 | DLL side-loading via Chrome enterprise policies | https://cybersecuritynews.com/malicious-chrome-extension-uses-native-messaging-host/ |
| RD26-07 | Vitest 4.1.9 / 5.0.0-beta.5 | https://github.com/vitest-dev/vitest/releases |
| RD26-08 | Monaco v0.55.1 stable / v0.56-dev | https://github.com/microsoft/monaco-editor/releases |
| RD26-09 | Vitest CVE-2026-47429 (CVSS 9.8) | https://github.com/advisories/GHSA-5xrq-8626-4rwp |
| RD26-10 | W3C WebExtensions WG draft charter | https://w3c.github.io/charter-drafts/2025/webextensions-wg.html |

## Improvement Pass (2026-06-26)

> Items below identified by systematic code-level audit of build pipeline,
> test infrastructure, CSS architecture, and accessibility compliance.
> Deduplicated against all existing tiers and prior RD additions.

### Now (v3.12.0)

#### IMP-1. Coverage Reporter Enrichment
- **Priority:** P2 | **Effort:** S
- **Problem:** Vitest coverage only generates `text` + `json-summary` reporters. No HTML report for visual gap inspection, no lcov for CI integrations (Codecov, Coveralls). Developers must read terminal tables to find coverage gaps.
- **Deliverable:** Add `html` and `lcov` reporters to `vitest.config.mjs`. Add `test:cov:report` npm script that opens the HTML report. Add `coverage/` to `.gitignore`.
- **Acceptance:** `npm run test:cov` produces `coverage/index.html` browsable report and `coverage/lcov.info` for CI upload.

#### IMP-2. Production Source Maps
- **Priority:** P2 | **Effort:** S
- **Problem:** `esbuild.config.mjs` production build (`--prod`) minifies without generating source maps. Error stack traces in production are opaque. External source maps don't ship to users but help developers debug CWS reviewer reports.
- **Deliverable:** Add `sourcemap: 'external'` to the esbuild production minify call. Exclude `.map` files from CWS/AMO/Edge packaging scripts.
- **Acceptance:** `npm run build:prod` produces `background.js` + `background.js.map`. Map file is excluded from published packages.

#### IMP-3. Bundle Size Analysis
- **Priority:** P3 | **Effort:** S
- **Problem:** No tooling to track `background.js` composition or detect size regressions. The bundle is ~22K lines (~1.3MB) but there's no breakdown of which modules contribute what.
- **Deliverable:** Add `build:analyze` npm script that builds background.js and reports per-module line counts and total size. Output as JSON for CI comparison.
- **Acceptance:** `npm run build:analyze` outputs module-by-module size breakdown and total. Can be diffed across releases.

#### IMP-4. Watch Mode Type Checking
- **Priority:** P3 | **Effort:** S
- **Problem:** `npm run dev` (watch mode) rebuilds background.js on file changes but doesn't run TypeScript type-checking. Type errors are only caught on explicit `npm run typecheck` or `npm run check`.
- **Deliverable:** Add `--typecheck` flag support to watch mode that spawns `tsc --watch --noEmit` in parallel with the file watcher. Add `dev:tc` npm script alias.
- **Acceptance:** `npm run dev:tc` rebuilds on changes AND reports type errors continuously.

### Next

#### IMP-5. Shared Theme Token System
- **Priority:** P2 | **Effort:** M
- **Problem:** Theme tokens are triplicated across `dashboard.css` (`:root` with `--bg-body`, `--bg-header`), `popup.html` (inline `<style>` with `--popup-*` prefix), and `sidepanel.html` (inline `<style>` with `--bg`, `--bg-raised`). Four themes (dark/light/catppuccin/oled) are maintained independently with divergent names and slightly different values. Any theme change requires editing three files.
- **Deliverable:** Extract canonical theme tokens into `pages/theme-tokens.css` with all four theme variants. Each page `<link>`s the shared file and maps tokens to its local names (or adopts the shared names). Inline `<style>` blocks in popup/sidepanel shrink to layout-only rules.
- **Acceptance:** Theme change in one file propagates to all pages. All four themes render correctly in dashboard, popup, and sidepanel.

#### ~~IMP-6. px → rem Font Size Migration~~ — DONE
- All 75+ font-size declarations already use rem units. No px conversion needed.

#### IMP-7. Coverage Threshold Ratchet
- **Priority:** P2 | **Effort:** L
- **Problem:** Coverage thresholds sit at lines 36%, functions 39%, branches 25%, statements 34% — the measured baseline. Critical service worker code (storage, sync, GM API) should have higher coverage to prevent regressions.
- **Deliverable:** Phase 1 (v3.12.0): raise to 45/48/32/42. Phase 2 (v3.13.0): raise to 55/58/40/52. Phase 3: raise to 65/68/50/62. Each phase requires writing tests to fill gaps before ratcheting.
- **Acceptance:** Each phase's thresholds pass in CI before the next phase begins.
