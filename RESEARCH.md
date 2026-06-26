# Research — ScriptVault

## Executive Summary

ScriptVault v3.11.0 is the only MV3-native, open-source, full-featured userscript manager on the Chrome Web Store with zero telemetry. The codebase is in excellent shape: 1738 passing tests (1 stale test file from Dependabot removal — already tracked as P1 in ROADMAP), `npm audit` clean at all severity levels, 28/28 TypeScript-promoted runtime modules with 0 drift, typecheck clean, and reproducible build pipeline with SLSA attestation.

The competitive window is at maximum width. Chrome 150 removed the final MV2 flag on June 30, 2026; Chrome 151 (July 28) strips all remaining workarounds. Violentmonkey is dead on Chrome with 8.4K GitHub stars of stranded users. Tampermonkey v5.5.0 remains the only competitor with full MV3 parity but stays closed-source with trust concerns. ScriptCat v1.4.0 shipped stable on June 26, 2026 with AI Agent and MCP protocol, but carries GPL-3.0 and stability history. Firefox 153 (July 21) ships `userScripts.execute()`, `publicSuffix` API, `documentId`, and constructed stylesheet access — all of which improve ScriptVault's Firefox parity (tracked in Roadmap_Blocked.md awaiting the stable release).

Recent unreleased improvements (session-only credential storage, UserCSS draft preview, Popover API adoption, vm.compileFunction test migration, Firefox lint warning budget gate) strengthen the competitive position but are not yet reflected in the README's feature list or comparison table.

Highest-value direction: fix the 1 broken test (P1), raise coverage gates (P2), update README to document new differentiators, and wait for Firefox 153 stable to unblock 5 items in Roadmap_Blocked.md. The 8 existing research-driven items in ROADMAP.md from the June 25 deep pass remain correctly prioritized and actionable.

## Product Map

- **Core workflows**: Install/import userscripts from URL/file/clipboard/Greasy Fork/bookmarklet, parse metadata, register via `chrome.userScripts` with per-script worldId isolation, execute with 35+ GM API functions, edit in Monaco (tabbed, IntelliSense), review update diffs, backup/restore (local + cloud), sync across 7 providers with 3-way merge and session-only credentials, publish handoff to Greasy Fork with receipts, preview UserCSS drafts live.
- **User personas**: Privacy-conscious userscript users migrating from Tampermonkey/Violentmonkey, script authors needing a modern editor with debugging tools, enterprise IT operators deploying managed script policies, Firefox/Edge early adopters, and power users wanting workspaces/script chaining/scheduling.
- **Platforms**: Chrome (published, MV3, minimum Chrome 130), Firefox (AMO-ready, 0 lint errors, sideload verified), Edge (sideload-ready, smoke verified), Safari (intentionally out of scope — lacks `userScripts` API).
- **Key data flows**: IndexedDB v3 engine (scripts, values, stats, backups, local workspace bindings, publication receipts), `chrome.storage.local` (settings, folders, recent updates, trust receipts), `chrome.storage.session` (sync credentials with in-memory fallback), offscreen document (AST analysis via Acorn, 3-way merge, ZIP processing), Monaco sandbox iframe.

## Competitive Landscape

### Tampermonkey (v5.5.0, 10M+ users, closed-source)
- **Strengths**: Dominant installed base, full MV3 compatibility, MCP server for AI agents (standalone npm package, 17 GH stars), enterprise policy provisioning, local file tracking for dev workflow.
- **Learn from**: MCP server architecture (external process, not embedded AI). Local file tracking validates developer workflow demand. "Claude" editor theme suggests AI-tool audience targeting.
- **Avoid**: Closed-source opacity (GitHub #1515 ongoing), tampermonkey.net as installation intermediary (SPOF, blocked in some regions), freemium model that erodes trust.

### Violentmonkey (v2.41.0, 8.4K stars, MIT, dead on Chrome)
- **Strengths**: Most-starred open-source userscript manager, clean codebase, strong community trust.
- **Learn from**: "Separate check-for-updates from auto-update" (24-comment feature request) — ScriptVault's update inbox already handles this. Search result grouping by match location is good UX.
- **Avoid**: Failure to address MV3. Chrome 150 removed the flag; Chrome 151 removes all workarounds. VM's ~600K Chrome users are fully stranded as of June 30, 2026. A community MV3 PR (#2399) was rejected by the maintainer.

### ScriptCat (v1.4.0 stable, 4.6K stars, GPL-3.0, MV3-native)
- **Strengths**: Background/scheduled scripts (@crontab in service worker), AI Agent with MCP protocol (shipped in v1.4.0 stable), `@unwrap` metadata tag, `window.onurlchange` event, cloud sync improvements. First stable release since v1.3.2.
- **Learn from**: Background script UX vocabulary is well-defined (resource/time budgets). AI Agent behind build flag is the right rollout strategy. OPFS for temp storage is modern.
- **Avoid**: GPL-3.0 licensing, stability history (memory leaks, white screens in earlier versions), documentation primarily in Chinese.

### Tweeks (YC W25, AI-native)
- **Strengths**: Validates demand for natural-language "describe what you want" script authoring. Well-funded.
- **Learn from**: Users want AI-assisted script workflows. The demand signal is clear.
- **Avoid**: Sending page context or script contents to hosted AI by default. ScriptVault's safer lane is user-controlled MCP/public API with local-first principles.

### OrangeMonkey (2M+ users, VM fork)
- **Strengths**: High install count, lightweight UX, no-data-collection disclosure.
- **Learn from**: Lightweight import/gallery paths matter for casual users.
- **Avoid**: Closed-source trust signals without reviewable provenance.

## Security, Privacy, and Reliability

### Verified Clean
- `npm audit --audit-level=moderate --omit=optional`: **0 vulnerabilities** (verified June 26, 2026).
- All `innerHTML` usage routed through Trusted Types policy (`_svPolicy.createHTML()`) across dashboard, popup, sidepanel, install, and devtools pages. Dashboard modules use scoped `_safeInnerHTML` wrappers.
- Internal host guard covers 127.0.0.1, ::1, TEST-NET, benchmarking, Class E, IPv4-mapped IPv6, `.localhost`. Source parity pinned by `tests/source-hardening-parity.test.js`.
- Content script bridge uses channel-ID auth to prevent page-level spoofing.
- Vitest CVE-2026-47429 (CVSS 9.8) mitigated by loopback-only Vitest dev-server guard (commit `5009a5c`).
- Session-only credential storage for sync providers reduces at-rest credential exposure.

### Active Risks
- **Stale test file**: `tests/dependabot-config.test.js` references deleted `.github/dependabot.yml` (removed in `c81cc05`). 1 test failure. Already tracked as P1 in ROADMAP.
- **Coverage thresholds are no-op**: 10% lines / 5% branches / 10% functions. Already tracked as P2 in ROADMAP.
- **Outdated dev dependencies**: Playwright 1.60.0→1.61.1, Vitest 4.1.3→4.1.9, TypeScript 6.0.2→6.0.3, jsdom 29.0.1→29.1.1, puppeteer-core 24.42.0→25.2.1 (major). Monaco 0.52.2→0.55.1 (tracked in RD-11).
- **Firefox AMO lint warnings**: 148 warnings (budget ceiling 160). Does not block lint gate (0 errors, 0 notices) but is the clearest reviewer-risk reducer for AMO submission.

### Missing Guardrails
- **Sanitizer API (`setHTML`) not referenced** in linter hints. Already tracked as P2 in ROADMAP.
- **Mutation Events not flagged** by the AST analyzer's 31 detectors. Already tracked as P3 in ROADMAP.

### Supply Chain Landscape (2026)
- 108 malicious extensions campaign (Socket, April 2026) — credential harvesting via C2.
- QuickLens ownership-transfer attack (February 2026) — silent permission creep.
- DLL side-loading via Chrome enterprise policies (June 2026) — validates ScriptVault's enterprise provisioning security model.
- ScriptVault's existing Ed25519 signing, Sigstore provenance, SRI verification, and import quarantine are strong differentiators against this threat landscape.

## Architecture Assessment

### Module Boundaries
- `src/background/core.ts` (15,173 lines) remains the largest file. Existing RD-6 tracks extraction into typed per-API modules. `ResponseMap` covers ~25 of 135+ message actions.
- `pages/dashboard.js` (16,445 lines) is well-decomposed with 27 lazy-loaded submodules. The module boundary is clean.
- Generated `background.js` (33,694 lines) is the concatenated service worker output — intentional architecture.
- 166 test files, 1738 test cases (165 files pass, 1 stale file fails).

### Refactor Candidates
- **`tests/dependabot-config.test.js`**: Dead test referencing deleted config. Delete entirely. (P1)
- **Coverage thresholds in `vitest.config.mjs`**: Lines 31-36. Raise to measured baseline. (P2)
- **RD-2 stale reference**: Existing roadmap item RD-2 references deleted `dashboard-i18n-v2.js`. The i18n module lives at `src/modules/i18n.ts` → `modules/i18n.js`. A test (`tests/dashboard-i18n-removal.test.js`) actively prevents the dead file from being shipped. The RD-2 deliverable path needs correction to use the promoted i18n module.
- **Firefox editor**: Textarea fallback in `pages/editor-sandbox.html` is functional but bare. CodeMirror 6 at ~50KB would provide syntax highlighting without Monaco's 14MB. Already tracked as P3.

### Test and Documentation Gaps
- **README feature list**: Session-only credential storage and UserCSS draft preview shipped but not documented in README. The competitive comparison table is missing these differentiators.
- **i18n coverage**: Dashboard has 63 `data-i18n` attributes. Popup, sidepanel, install, and devtools pages have zero. Blocked on RD-2 landing first (per Roadmap_Blocked.md).

## Rejected Ideas

- **Built-in AI script generation**: Tweeks and ScriptCat v1.4.0 validate demand, but page/script exfiltration conflicts with zero-telemetry posture. MCP/public API is the safer architecture (blocked in Roadmap_Blocked.md on transport decision). Source: Tweeks.io, ScriptCat v1.4.0 AI Agent.
- **DOM-less @background execution now**: ScriptCat v1.4.0 stable ships it, but CWS remote-code policy constraints remain. Already blocked in Roadmap_Blocked.md. Source: ScriptCat docs, CWS remote-code guidance.
- **CodeMirror 6 to replace Monaco on Chrome**: Monaco provides VS Code-level editing (IntelliSense, multi-cursor, go-to-definition). Downgrading Chrome's editor would lose the flagship differentiator. CM6 is right for Firefox only. Source: CodeMirror 6 changelog.
- **Record-and-playback script authoring**: Too far from core userscript manager scope. Source: Selenium IDE architecture.
- **Full SASS/SCSS pipeline**: Preprocessor support increases dependency surface before store-review warning debt is reduced. Source: User JS and CSS docs.
- **Safari/Orion packaging**: Safari lacks `userScripts` API. Already rejected (R-3) and under consideration (UC-1) in ROADMAP.md.
- **Dependency patch-level updates as roadmap items**: Playwright, Vitest, TypeScript, jsdom, chrome-types patch updates are routine maintenance. Only puppeteer-core major version (24→25) warranted as roadmap item due to breaking API potential.
- **Firefox 153 `documentId` as separate item**: Already used in Chrome path (`src/background/core.ts:6148`). Firefox gaining it improves parity automatically — no new feature work needed.

## Sources

Competitors:
- https://www.tampermonkey.net/changelog.php
- https://github.com/Tampermonkey/tampermonkey-mcp
- https://github.com/violentmonkey/violentmonkey/issues/1934
- https://github.com/violentmonkey/violentmonkey/issues/2340
- https://github.com/scriptscat/scriptcat/releases
- https://docs.scriptcat.org/en/
- https://www.tweeks.io/
- https://chrome-stats.com/d/ekmeppjgajofkpiofbebgcbohbmfldaf

Browser Platform:
- https://developer.chrome.com/docs/extensions/whats-new
- https://developer.chrome.com/blog/extensions-io-2026
- https://developer.chrome.com/docs/extensions/reference/api/userScripts
- https://developer.chrome.com/blog/chrome-userscript
- https://developer.chrome.com/docs/extensions/develop/migrate/mv2-deprecation-timeline
- https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/153
- https://developer.chrome.com/blog/mutation-events-deprecation
- https://web.dev/articles/sanitizer

Security:
- https://cheatsheetseries.owasp.org/cheatsheets/Browser_Extension_Vulnerabilities_Cheat_Sheet.html
- https://pluto.security/blog/chrome-extension-supply-chain-attacks-permission-creep/
- https://cybersecuritynews.com/malicious-chrome-extension-uses-native-messaging-host/
- https://techretry.com/malicious-chrome-extensions-2026/
- https://github.com/advisories/GHSA-5xrq-8626-4rwp

Community:
- https://discuss.privacyguides.net/t/does-tampermonkey-extension-affect-privacy-and-security/16728
- https://github.com/Tampermonkey/tampermonkey/issues/1515
- https://www.techtimes.com/articles/318370/20260615/google-kills-ublock-origin-chrome-june-30-dynamic-filtering-ends-no-workaround-remains.htm

Tooling:
- https://codemirror.net/docs/changelog/
- https://github.com/microsoft/monaco-editor/releases
- https://github.com/vitest-dev/vitest/releases
- https://w3c.github.io/charter-drafts/2025/webextensions-wg.html

## Open Questions

- **AMO reviewer feedback**: Exact reviewer response to the 148-warning lint profile can only be validated by submitting. Blocked on credentials.
- **Coverage baseline**: Actual line/branch/function coverage unknown until `npm run test:cov` is run. Thresholds should be set to measured floor minus 5% margin.
- **Puppeteer-core 25 breaking changes**: Major version changelog needs review before upgrade to assess smoke test compatibility.
- **RD-2 deliverable path**: The existing RD-2 item references deleted `dashboard-i18n-v2.js`. Needs correction to use `src/modules/i18n.ts` → `modules/i18n.js` pipeline. The `tests/dashboard-i18n-removal.test.js` file actively prevents resurrection of the dead module.
