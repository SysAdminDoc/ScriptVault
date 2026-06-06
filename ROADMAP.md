# ScriptVault Roadmap

> Single source of truth for planned work. Tiered by execution priority.
> Completion history lives in [`COMPLETED.md`](COMPLETED.md); the research and
> planning map lives in [`RESEARCH_REPORT.md`](RESEARCH_REPORT.md). Legacy
> planning passes (Rounds 1-14, Cycles 1-20) are archived under `docs/archive/`.
>
> **Roadmap version:** Round 15 - OSINT deep refresh 2026-06-05.
> **Shipped baseline:** v3.11.0 (2026-05-19, tag pushed). `main` has additional unreleased hardening, TS promotion, Firefox validation, and release-trust commits through 2026-06-05.
> **Test suite:** 1414 Vitest cases green; `npm audit --audit-level=high --omit=optional` clean; 27/27 TS-promoted runtime entries; 0 mirrored; 0 divergent.
> **Source floor:** 400+ external URLs across Rounds 1-15. Every Now/Next item carries source IDs from the Appendix.
>
> Last researched: Round 15 - 2026-06-05.

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

## Next (v3.13.0 - v3.14.0)

### X-1. Edge Add-ons Publication
- **Priority:** P2 | **Effort:** M | **Source:** [S18, S19]
- **Problem:** Edge package and report exist, but no Partner Center listing or Edge browser smoke.
- **Deliverable:** Edge sideload smoke, Partner Center upload, Edge Add-ons REST API v1.1 CI/CD integration.
- **Progress:** Cycle 36 ran `npm run smoke:edge` on Microsoft Edge 146.0.3856.97, enabled the temporary profile's Allow User Scripts toggle, loaded the staged package, verified dashboard/popup rendering, saved/toggled a smoke userscript, and confirmed it executed on a local target page. Committed sanitized evidence in `docs/audit/edge-smoke-3.11.0.json` and updated the support matrix generator to surface live smoke evidence. Partner Center upload and Edge Add-ons REST automation remain credential/listing gated.

### X-2. DOM-less @background Scripts
- **Priority:** P2 | **Effort:** XL | **Source:** [S04, S20, S21]
- **Problem:** ScriptCat's killer feature is background/cron scripts without an open tab. ScriptVault's `@crontab` is tied to page lifecycle.
- **Deliverable:** Default-off `experimentalBackgroundScripts`, parser support for `@background`, DOM-less wrapper variant, offscreen document runner, resource/time budget controls.
- **Progress:** Cycle 37 added parser/type support for `@background`, the internal default-off `experimentalBackgroundScripts` setting, a dormant page-registration guard so `@background` scripts do not run as normal userscripts before the DOM-less runner exists, and `docs/background-scripts-design.md` to pin runner/API/safety gates. Cycle 38 added `src/background/background-runner.ts` as a pure planner for gate status, supported triggers, restricted GM grants, and reviewed budget limits; no code execution is enabled yet. Cycle 39 wired planner status into registration logging and local-health diagnostics so dormant background scripts are explainable without exposing script names, source, or URLs. Cycle 40 added `src/background/background-wrapper.ts`, a non-wired DOM-less wrapper scaffold that exposes only reviewed GM value/XHR/notification/log/info APIs and fails closed for DOM/page globals. Cycle 41 added `src/background/background-runner-bridge.ts` to assemble eligible plans plus wrapper payloads while still reporting `executionEnabled: false`. Cycle 42 added the runtime `prepareBackgroundRunnerDryRun` action, which reports planner/wrapper eligibility without returning wrapper code or executing scripts.
- **Risk:** Extension review scrutiny. Require review-only install (reuse quarantine flow).

### X-3. Navigation API Integration for SPA Support
- **Priority:** P2 | **Effort:** S | **Source:** [S22, S23]
- **Problem:** "Scripts don't fire on SPA navigation" is a perennial complaint. The Navigation API reached Baseline in January 2026.
- **Deliverable:** Subscribe to `navigation.navigate` events inside the page-scoped `window.onurlchange` setup. Keep pushState/replaceState/popstate shim as fallback.

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

## Later

### L-1. Enterprise/Policy-Based Script Provisioning
- **Priority:** P3 | **Effort:** L | **Source:** [S28]
- **Problem:** Tampermonkey v5.5.0 added OS policy provisioning. No open-source manager offers this.
- **Deliverable:** Read `chrome.storage.managed` policy keys for script URLs, auto-install on load, managed-script indicator.

### L-2. Local Filesystem Script Loading (Watch Mode)
- **Priority:** P3 | **Effort:** M | **Source:** [S29, S30]
- **Problem:** Copy-paste workflow between IDE and extension editor is universally hated.
- **Deliverable:** File System Access API integration for Chrome/Edge. Watch a local `.user.js` and auto-reload.

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
- **Priority:** P3 | **Effort:** S | **Source:** [S39]
- **Problem:** Script authors copy-paste between editor and hosting platforms.
- **Deliverable:** Dashboard action to publish/update via GreasyFork API.

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
