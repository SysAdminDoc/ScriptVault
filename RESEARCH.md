# Research — ScriptVault

## Executive Summary

ScriptVault is a trust-first Manifest V3 userscript manager for Chrome-family browsers, with an active Firefox port and a large local-first feature set: Monaco editing, GM API coverage, sync/backup providers, update review, script signing, risk analysis, UserCSS support, and release-trust tooling. Verified current state is stronger than the previous research snapshot: `npm audit --audit-level=high --omit=optional` is clean, Popover API has landed for the popup dropdown and dashboard command palette, and the repo is on ScriptVault 3.11.0 with Node >=24.16.0/npm >=11.13.0. Highest-value direction: reduce reviewer/security friction before store expansion, keep privacy-preserving AI integration bounded by the existing MCP/public-API plan, and make the existing dashboard/i18n/testing roadmap implementable from current files. Top opportunities: P1 reduce the Firefox AMO lint warning budget from the checked-in 148 warnings; P1 keep coverage instrumentation alignment on the board; P2 correct the stale dashboard i18n implementation path away from removed `dashboard-i18n-v2.js`; P2 harden any Vitest Browser Mode work against exposed dev servers; P2 add a TypeScript 7 preview gate; P2 continue MCP only with NSA/CSA threat controls; P3 add draft-only UserCSS live preview after reviewer-risk work is lower.

## Product Map

- Core workflows: install/import userscripts, parse metadata, register via `chrome.userScripts`, execute GM APIs, edit in Monaco, review updates/diffs, backup/restore, sync, publish or export support evidence.
- User personas: privacy-sensitive userscript users, Tampermonkey/Violentmonkey migrators, script authors, enterprise operators, Firefox/Edge validators, and AI-tool users who need local control rather than built-in script generation.
- Platforms and distribution: Chrome MV3 package from `manifest.json` with minimum Chrome 130; generated Firefox package flow with `web-ext` lint artifacts; Edge sideload/package path; Safari/Orion intentionally lower priority.
- Key integrations and data flows: IndexedDB for script/value/UserCSS storage; `chrome.storage.local/session` for settings/runtime state; cloud sync providers; Monaco sandbox in `pages/editor-sandbox.html`; background/runtime logic generated from `src/`; release checks, SBOM, and store-copy gates under `scripts/` and `.github/`.

## Competitive Landscape

- Tampermonkey: closed-source incumbent whose 5.5.0 changelog added MCP, local userscript file tracking, OS policy provisioning, regex search, and editor touch commands. Learn from the local editor workflow and MCP enablement model. Avoid closed-source opacity, freemium trust tradeoffs, and built-in AI flows that blur provenance.
- Violentmonkey: open-source userscript manager with sync and external-editor strengths, but Chrome MV3 remains unresolved in public issues. Learn from low-friction sync/editor UX. Avoid depending on MV2 assumptions or copying architecture that cannot clear current Chrome store policy.
- ScriptCat: MV3-native, TypeScript-heavy competitor with background and scheduled scripts plus a script subscription model. Learn from its background/scheduled-script UX vocabulary. Avoid its GPL-3.0 licensing constraints and any DOM-less background execution model that conflicts with Chrome Web Store remote-code policy.
- Tweeks: AI-first site customization product that validates demand for natural-language script authoring. Learn that users want AI-assisted script workflows. Avoid sending page context or script contents to hosted AI by default; ScriptVault's safer lane is user-controlled MCP/public API.
- OrangeMonkey: high-install Chrome Web Store userscript manager with ZIP backup, gallery search, one-click toggles, and no-data-collection disclosure. Learn that lightweight import/gallery paths matter. Avoid relying on closed-source trust signals as a substitute for reviewable release provenance.
- User JS and CSS: adjacent style/script manager with Prettier, SASS/SCSS, live CSS, and themeable editor UX. Learn from draft CSS feedback loops. Avoid adding formatter/preprocessor bloat before store-review and lint warning debt is lower.
- Awesome Userscripts / Awesome WebExtensions: discovery ecosystems rather than direct competitors. Learn where migration docs and trust messaging should surface after Firefox/Edge distribution is ready. Avoid outreach automation while publication credentials and store listings remain human-blocked.

## Security, Privacy, and Reliability

- Verified: `npm audit --audit-level=high --omit=optional` reports 0 vulnerabilities; the previous research claim of 5 high-severity dev dependency vulnerabilities is stale.
- Verified: `firefox-artifacts/web-ext-lint.json` has 0 errors, 0 notices, and 148 warnings: 126 `UNSAFE_VAR_ASSIGNMENT`, 17 `UNSUPPORTED_API`, 3 `DANGEROUS_EVAL`, 1 `INLINE_SCRIPT`, and 1 Firefox Android minimum-version warning. This does not block local lint success, but it is the clearest AMO reviewer-risk reducer.
- Verified: raw `innerHTML` remains concentrated in dashboard/install/devtools surfaces: `pages/dashboard-linter.js` 6, `pages/dashboard-scheduler.js` 5, `pages/dashboard-snippets.js` 4, `pages/dashboard-theme-editor.js` 3, plus lower counts across 20+ dashboard modules, `pages/install.js`, `pages/devtools-panel.js`, and `pages/popup.js`.
- Verified: OWASP browser extension guidance specifically flags `innerHTML`, code injection, permissions overreach, insecure message passing, and dependency hygiene as extension risk classes; ScriptVault already has strong dependency and provenance gates, so reducing dynamic HTML warnings is the next concrete trust step.
- Verified: `Roadmap_Blocked.md` still correctly blocks DOM-less `@background` execution on Chrome Web Store remote-code/compliance boundaries. Background-runner dry-run diagnostics and support snapshots are safe; arbitrary DOM-less execution is not roadmap-ready.
- Likely: Firefox package review will be smoother if unsupported API probes and dynamic HTML warning volume are either eliminated or machine-allowlisted with rationale. Needs live validation because AMO reviewer feedback is not available without submission credentials.
- Verified: Vitest 4.1.3 is current, but Browser Mode or UI-server work should be loopback-only because the public Vitest advisory covers file read/execution risk when a UI server is exposed to a network.

## Architecture Assessment

- `src/background/core.ts` remains the largest review surface at roughly 15K lines; existing RD-6 background extraction and the current P1 coverage-instrumentation item should stay ahead of novelty work.
- `pages/dashboard.js` is still a large coordinator, but recent Popover API adoption changed live code: roadmap text that says Popover is unused is now stale for popup and command palette.
- Existing RD-2 dashboard i18n text is stale: `pages/dashboard-i18n-v2.js` no longer exists, and `tests/dashboard-i18n-removal.test.js` asserts it must remain removed. Any i18n continuation should use the current `src/modules/i18n.ts` / `modules/i18n.js` path and visible `data-i18n` coverage, not resurrect the removed file.
- i18n is partial: `pages/dashboard.html` has 71 `data-i18n` attributes; popup, sidepanel, install, and devtools HTML have none; JS surfaces still have many English strings. Because `Roadmap_Blocked.md` already blocks non-dashboard i18n on a dashboard pass, the roadmap should fix dashboard first.
- UserCSS support is real and tested in `src/modules/userstyles.ts`, `modules/userstyles.js`, `tests/source-userstyles.test.js`, and `tests/userstyles.test.js`; tests cover reinjection after stored variable/raw CSS changes. What is missing is a draft-only editor preview that cleans itself up before save/cancel.
- Test infrastructure is broad: 179 files under `tests/`, Playwright config, many release/check scripts, and promoted TypeScript runtime entries. The remaining gap is less "add tests" and more "make coverage and visual evidence measure the code paths already under test."
- Distribution docs and release gates are mature, but actual Firefox AMO/Edge publication remains credential-blocked. Research should not keep re-adding publication tasks as implementable code work.
- Category audit: security, i18n, testing, distribution, plugin ecosystem, offline/resilience, migration paths, and upgrade strategy produced active recommendations or existing roadmap references; accessibility, observability, docs, mobile, and multi-user were considered but did not produce new implementation-ready items beyond existing support snapshots, live-region patterns, credential-blocked publication docs, platform blockers, or rejected collaboration scope.

## Rejected Ideas

- Built-in hosted AI userscript generation: Tweeks validates demand, but page/script exfiltration risk conflicts with ScriptVault's zero-telemetry posture; MCP/public API is the safer path.
- DOM-less `@background` execution now: ScriptCat makes this attractive, but existing memory and `Roadmap_Blocked.md` show it remains blocked by Chrome Web Store remote-code architecture constraints.
- Duplicate structured-clone migration item: Chrome 148 structured clone is real, but `Roadmap_Blocked.md` already tracks opt-in gating and compatibility validation.
- Duplicate Popover API item: popup and command palette now use Popover API; any remaining menu/modal work should be handled by the existing item or closed after verification, not re-added.
- Duplicate dashboard i18n item as written: existing RD-2 covers intent but points to removed `dashboard-i18n-v2.js`; fix the implementation path instead of creating a second i18n row.
- Full SASS/SCSS pipeline now: User JS and CSS has it, but adding a preprocessor increases dependency and package-surface cost before store-review warning debt is reduced.
- Safari/Orion packaging: lower fit than Chrome/Firefox/Edge because core MV3/userScripts distribution gaps remain.
- Community listing/outreach automation: awesome-lists are useful after store distribution is public; credential-blocked publication and human outreach are not code-agent tasks.
- Multi-user collaboration features: ScriptCat subscriptions are interesting, but ScriptVault's current trust model is local-first single-user vault management; sync safety, restore previews, and provenance are higher priority.
- Mobile expansion beyond tracked blockers: Firefox for Android and platform-specific APIs are already blocked or version-gated; no implementation-ready mobile item emerged from current evidence.

## Sources

Competitors:
- https://www.tampermonkey.net/changelog.php
- https://violentmonkey.github.io/
- https://github.com/violentmonkey/violentmonkey/issues/1934
- https://github.com/scriptscat/scriptcat
- https://docs.scriptcat.org/en/docs/use/use/
- https://www.tweeks.io/about
- https://chromewebstore.google.com/detail/orangemonkey/ekmeppjgajofkpiofbebgcbohbmfldaf
- https://tenrabbits.github.io/user-js-css-docs/

Ecosystem:
- https://github.com/awesome-scripts/awesome-userscripts
- https://github.com/fregante/Awesome-WebExtensions
- https://developer.chrome.com/docs/extensions/develop/migrate/mv2-deprecation-timeline
- https://developer.chrome.com/docs/extensions/reference/api/userScripts
- https://developer.chrome.com/blog/structured-clone-messaging
- https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/153
- https://w3c.github.io/webextensions/specification/

Security:
- https://cheatsheetseries.owasp.org/cheatsheets/Browser_Extension_Vulnerabilities_Cheat_Sheet.html
- https://extensionworkshop.com/documentation/publish/source-code-submission/
- https://github.com/advisories/GHSA-5xrq-8626-4rwp
- https://labs.cloudsecurityalliance.org/agentic/agentic-mcp-security-best-practices-v1/
- https://media.defense.gov/2026/Jun/02/2003943289/-1/-1/0/CSI_MCP_SECURITY.PDF
- https://groups.google.com/a/chromium.org/g/chromium-extensions/c/hQeJzPbG-js
- https://blog.sekoia.io/targeted-supply-chain-attack-against-chrome-browser-extensions/
- https://www.koi.ai/blog/4-million-browsers-infected-inside-shadypanda-7-year-malware-campaign

Dependencies:
- https://vitest.dev/blog/vitest-4-1.html
- https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/
- https://github.com/microsoft/monaco-editor/blob/main/CHANGELOG.md
- https://github.com/evanw/esbuild/blob/main/CHANGELOG.md

## Open Questions

- Needs live validation: exact AMO reviewer feedback after submission; current evidence can only prioritize warning reduction and source-submission readiness.
- Needs credentials: Firefox AMO and Edge publication status cannot be advanced by code without store accounts.
