# Research — ScriptVault

## Executive Summary

ScriptVault v3.11.0 is the only MV3-native, open-source, full-featured userscript manager on the Chrome Web Store with zero telemetry. The project is in strong shape: 1738 passing tests (1 stale test file from a recent Dependabot removal), `npm audit` clean at all severity levels, 28/28 TypeScript-promoted runtime modules, SHA-pinned CI actions, SLSA attestation for Chrome/Firefox/Edge packages, and a reproducible build pipeline.

The competitive window is wide open. Violentmonkey is dead on Chrome (MV2 fully removed June 30, 2026 in Chrome 150) with 8.4K GitHub stars of stranded users. Tampermonkey returned but remains closed-source with trust concerns. ScriptCat v1.4.0 shipped today (June 25, 2026) with an AI Agent preview and MCP protocol support, but carries GPL-3.0, stability concerns, and Chinese-language documentation. No other MV3-native open-source manager exists at feature parity.

Highest-value direction: fix the broken test, raise coverage gates to prevent regression, add linter rules for emerging web platform changes (Sanitizer API, Mutation Events deprecation), evaluate CodeMirror 6 as the Firefox editor (replacing textarea), and differentiate with execution tracing that no competitor offers. Store publication (Firefox AMO, Edge) remains credential-blocked.

Top 8 new opportunities (priority order):
1. P1 — Remove stale `dependabot-config.test.js` (breaks CI)
2. P2 — Raise coverage thresholds from 10% baseline to prevent regression
3. P2 — Add Sanitizer API (`setHTML`) linter hint for MAIN-world scripts
4. P3 — Add Mutation Events deprecation linter warning
5. P3 — Evaluate CodeMirror 6 for Firefox editor (replace textarea fallback)
6. P3 — Script execution trace export for DevTools panel
7. P3 — Ambient toolbar badge error states
8. P3 — Puppeteer-core major version upgrade (24 to 25)

## Product Map

- **Core workflows**: Install/import userscripts from URL/file/clipboard/Greasy Fork, parse metadata, register via `chrome.userScripts` with per-script worldId isolation, execute with 35+ GM API functions, edit in Monaco (tabbed, IntelliSense), review update diffs, backup/restore (local + cloud), sync across 7 providers with 3-way merge, publish handoff to Greasy Fork with receipts.
- **User personas**: Privacy-conscious userscript users migrating from Tampermonkey/Violentmonkey, script authors needing a modern editor with debugging tools, enterprise IT operators deploying managed script policies, Firefox/Edge early adopters, and power users wanting workspaces/script chaining/scheduling.
- **Platforms**: Chrome (published, MV3, minimum Chrome 130), Firefox (AMO-ready, 0 lint errors, sideload verified), Edge (sideload-ready, smoke verified), Safari (intentionally out of scope — lacks `userScripts` API).
- **Key data flows**: IndexedDB v3 engine (scripts, values, stats, backups, local workspace bindings, publication receipts), `chrome.storage.local` (settings, folders, recent updates, trust receipts), `chrome.storage.session` (sync credentials, in-memory fallback), offscreen document (AST analysis via Acorn, 3-way merge, ZIP processing), Monaco sandbox iframe.

## Competitive Landscape

### Tampermonkey (v5.5.0, 10M+ users, closed-source)
- **Strengths**: Dominant installed base, full MV3 compatibility, script update diff viewer, multiple injection modes (UserScripts API Dynamic, Content Script API Dynamic), enterprise policy provisioning, MCP server for AI agent integration.
- **Learn from**: MCP server as a standalone npm package (17 GH stars) is the right architecture — external process, not embedded AI. Local file tracking and VS Code integration via third-party extension validate developer workflow demand.
- **Avoid**: Closed-source opacity (open privacy concerns — GitHub issue #1515 has ongoing discussion), tampermonkey.net as installation intermediary (single point of failure, blocked in some regions), freemium model that erodes trust.

### Violentmonkey (v2.41.0, 8.4K stars, MIT, dead on Chrome)
- **Strengths**: Most-starred open-source userscript manager, clean lightweight codebase, strong community trust, S3-compatible sync, script search grouping by match location.
- **Learn from**: The "separate check-for-updates from auto-update" feature request (24 comments) is the most-demanded VM feature — ScriptVault's update inbox already handles this. Search result grouping by match location (name > tags > description > code) is good UX to study.
- **Avoid**: Failure to address MV3 is an existential risk — VM's Chrome users are stranded after June 30, 2026. Sync doesn't include GM_getValue data (10-comment request).

### ScriptCat (v1.4.0, 4.6K stars, GPL-3.0, MV3-native)
- **Strengths**: Background/scheduled scripts (@crontab in service worker), AI Agent preview with MCP protocol (dev/beta only), script subscriptions/bundles, VSCode Connect integration, Monaco editor, OPFS for temp storage.
- **Learn from**: Background script UX vocabulary is well-defined (resource/time budgets, persistent vs scheduled). AI Agent preview behind `SC_ENABLE_AGENT` build flag is the right rollout strategy. OPFS for temp install storage is a modern approach.
- **Avoid**: GPL-3.0 licensing (more restrictive than MIT), stability concerns in reviews (memory leaks, white screens fixed in v1.4.0), privacy concerns flagged by users, documentation primarily in Chinese.

### Tweeks (YC W25, AI-native)
- **Strengths**: Validates demand for natural-language "describe what you want" script authoring. Well-funded (Y Combinator backing).
- **Learn from**: Users want AI-assisted script workflows. The demand signal is clear across the ecosystem.
- **Avoid**: Sending page context or script contents to hosted AI by default. ScriptVault's safer lane is user-controlled MCP/public API with local-first principles.

### OrangeMonkey (2M+ users, VM fork)
- **Strengths**: High install count, ZIP backup, gallery search, one-click toggles, no-data-collection disclosure.
- **Learn from**: Lightweight import/gallery paths matter for casual users. Clean no-data-collection positioning resonates.
- **Avoid**: Closed-source trust signals as a substitute for reviewable release provenance.

## Security, Privacy, and Reliability

### Verified Clean
- `npm audit --audit-level=high --omit=optional`: **0 vulnerabilities** (also clean at moderate level).
- `npm audit --audit-level=moderate --omit=optional`: **0 vulnerabilities**.
- All `innerHTML` usage eliminated from extension pages via Trusted Types migration (commits `93a9a62`, `43366a6`, `ceaf919`). Dashboard, install, devtools, popup, and sidepanel use safe DOM construction.
- Internal host guard covers 127.0.0.1, ::1, TEST-NET, benchmarking, Class E, IPv4-mapped IPv6, `.localhost`. Source parity pinned by `tests/source-hardening-parity.test.js`.
- Content script bridge uses channel-ID auth to prevent page-level spoofing. Wildcard `targetOrigin` (`'*'`) is a documented design choice for opaque-origin compatibility.

### Active Risks
- **Stale test file**: `tests/dependabot-config.test.js` references deleted `.github/dependabot.yml` (removed in `c81cc05`). Causes 1 test failure. Trivial fix but blocks clean CI.
- **Coverage thresholds are no-op**: 10% lines / 5% branches / 10% functions. With 1738 tests, actual coverage is likely much higher. These thresholds do not prevent regression.
- **Outdated dev dependencies**: Playwright 1.60.0 (1.61.1 available), Vitest 4.1.3 (4.1.9), TypeScript 6.0.2 (6.0.3), jsdom 29.0.1 (29.1.1), puppeteer-core 24.42.0 (25.2.1 — major version jump). Monaco 0.52.2 (0.55.1 — tracked in RD-11).
- **Firefox AMO lint warnings**: 148 warnings (126 UNSAFE_VAR_ASSIGNMENT, 17 UNSUPPORTED_API, 3 DANGEROUS_EVAL, 1 INLINE_SCRIPT, 1 Android min-version). Does not block lint gate (0 errors, 0 notices) but is the clearest reviewer-risk reducer.

### Missing Guardrails
- **Sanitizer API not referenced**: Chrome 146+ and Firefox 148+ ship `Element.setHTML()` for native XSS-safe DOM insertion. The existing Trusted Types linter warns about innerHTML in MAIN-world scripts but does not suggest `setHTML` as the modern alternative.
- **Mutation Events not flagged**: Chrome removed Mutation Events (DOMNodeInserted, DOMSubtreeModified, etc.); Firefox 140 removing them. The linter's 31 detectors don't flag scripts using these deprecated APIs.

## Architecture Assessment

### Module Boundaries
- `src/background/core.ts` (15,173 lines) remains the largest file. Existing RD-6 tracks extraction into typed per-API modules. `ResponseMap` covers ~25 of 135+ message actions — completing type coverage is the enabling first step.
- `pages/dashboard.js` (16,445 lines) is well-decomposed with 27 lazy-loaded submodules (27,828 lines total). The module boundary is clean; the coordinator file handles initialization and inter-module messaging.
- Generated `background.js` (33,694 lines) is the concatenated service worker output — intentional architecture, not technical debt.

### Refactor Candidates
- **`tests/dependabot-config.test.js`**: Dead test referencing deleted config. Remove entirely.
- **Coverage thresholds in `vitest.config.mjs`**: Lines 31-36 set 10%/5%/10% thresholds. Raise to measured baseline after running `npm run test:cov`.
- **Firefox editor**: Textarea fallback (`pages/editor-sandbox.html` Firefox path) is functional but bare. CodeMirror 6 at ~50KB would provide syntax highlighting, folding, and search without Monaco's 14MB footprint. Evaluate before committing to Monaco ESM for Firefox.

### Test and Documentation Gaps
- Test suite: 1738 passing, 1 failing (stale config reference). 177 test files. Playwright E2E covers 12+ flows. Coverage instrumentation exists but thresholds are not meaningful.
- Documentation: README, PRIVACY.md, store listing copy, CWS cookie justification, Firefox port guide, enterprise policy docs, contributing guide all present and maintained. CLAUDE.md is 1467 lines of living project notes.
- i18n: Dashboard has 71 `data-i18n` attributes. Popup, sidepanel, install, and devtools pages have zero i18n wiring. RD-2 tracks this but references the removed `dashboard-i18n-v2.js` file — implementation path needs correction to use `src/modules/i18n.ts`.

## Rejected Ideas

- **Built-in AI script generation**: Tweeks and ScriptCat validate demand, but page/script exfiltration conflicts with zero-telemetry posture. MCP/public API is the safer architecture (already blocked in Roadmap_Blocked.md on transport decision). Source: Tweeks.io, ScriptCat v1.4.0 AI Agent preview.
- **DOM-less @background execution now**: ScriptCat v1.4.0 shows it's possible, but CWS remote-code policy constraints remain. Already blocked in Roadmap_Blocked.md. Source: ScriptCat docs, CWS remote-code guidance.
- **CodeMirror 6 to replace Monaco on Chrome**: Monaco provides VS Code-level editing (IntelliSense, multi-cursor, go-to-definition). Downgrading Chrome's editor to save bundle size would lose the flagship differentiator. CodeMirror 6 is right for Firefox only. Source: CodeMirror 6 changelog, bundle size comparison.
- **Record-and-playback script authoring (Selenium IDE style)**: Too far from core userscript manager scope. Users who want automation should use Playwright/Selenium directly. Source: Selenium IDE architecture.
- **Full SASS/SCSS pipeline**: User JS and CSS has it, but preprocessor support increases dependency surface and package size before store-review warning debt is reduced. Source: User JS and CSS docs.
- **Safari/Orion packaging**: Safari lacks `userScripts` API. Already rejected (R-3) and under consideration (UC-1) in ROADMAP.md. Source: Apple Safari Web Extensions docs.
- **Dependency patch-level updates as roadmap items**: Playwright (1.60→1.61), Vitest (4.1.3→4.1.9), TypeScript (6.0.2→6.0.3), jsdom (29.0→29.1), chrome-types (0.1.425→0.1.430) are routine maintenance, not features. Puppeteer-core major version (24→25) warranted as a roadmap item due to potential breaking changes.

## Sources

Competitors:
- https://www.tampermonkey.net/changelog.php
- https://github.com/Tampermonkey/tampermonkey
- https://github.com/Tampermonkey/tampermonkey-mcp
- https://github.com/violentmonkey/violentmonkey
- https://github.com/violentmonkey/violentmonkey/issues/1934
- https://github.com/scriptscat/scriptcat
- https://docs.scriptcat.org/en/
- https://github.com/greasemonkey/greasemonkey
- https://github.com/quoid/userscripts
- https://github.com/erosman/firemonkey
- https://www.tweeks.io/
- https://chrome-stats.com/d/ekmeppjgajofkpiofbebgcbohbmfldaf

Browser Platform:
- https://developer.chrome.com/docs/extensions/reference/api/userScripts
- https://developer.chrome.com/blog/chrome-userscript
- https://developer.chrome.com/docs/extensions/whats-new
- https://developer.chrome.com/blog/extensions-io-2026
- https://developer.chrome.com/docs/extensions/develop/migrate/mv2-deprecation-timeline
- https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/153
- https://developer.chrome.com/blog/mutation-events-deprecation
- https://web.dev/articles/sanitizer
- https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle

Security:
- https://cheatsheetseries.owasp.org/cheatsheets/Browser_Extension_Vulnerabilities_Cheat_Sheet.html
- https://labs.cloudsecurityalliance.org/agentic/agentic-mcp-security-best-practices-v1/
- https://blog.sekoia.io/targeted-supply-chain-attack-against-chrome-browser-extensions/
- https://www.cyberhaven.com/engineering-blog/final-analysis-chrome-extension-security-incident
- https://pluto.security/blog/chrome-extension-supply-chain-attacks-permission-creep/

Community Signal:
- https://discuss.privacyguides.net/t/does-tampermonkey-extension-affect-privacy-and-security/16728
- https://github.com/Tampermonkey/tampermonkey/issues/1515
- https://news.ycombinator.com/item?id=26053547
- https://dev.to/john_phillips/which-free-userscript-managers-support-organizing-scripts-into-folders-or-profiles-3hid
- https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/reviews/

Adjacent Tools:
- https://www.requestly.com/
- https://playwright.dev/docs/chrome-extensions
- https://codemirror.net/docs/changelog/
- https://github.com/lisonge/vite-plugin-monkey

## Open Questions

- **AMO reviewer feedback**: Exact reviewer response to the 148-warning lint profile can only be validated by submitting. Blocked on credentials.
- **Coverage baseline**: Actual line/branch/function coverage is unknown until `npm run test:cov` is run and measured. Thresholds should be set to the measured floor minus a small margin.
- **Puppeteer-core 25 breaking changes**: Major version bump (24→25) may affect E2E test infrastructure. Needs changelog review before upgrade.
