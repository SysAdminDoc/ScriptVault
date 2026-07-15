# Research — ScriptVault

## Executive Summary

ScriptVault is a mature, local-first, zero-telemetry userscript manager for Chrome MV3 and Firefox MV3, with a strong current shape: reviewed install/update flows, Monaco editing, broad GM API coverage, IndexedDB/Storage Buckets persistence, local workspaces, multiple sync paths with optional encryption, diagnostics, backups, and reproducible release tooling. The highest-value direction is to make those trust claims true at the remaining boundaries: separate forgeable page telemetry from privileged completion events, quarantine every import path, minimize retained browsing context, fail closed when release smokes cannot exercise userscripts, and make rollback evidence operational. After those fixes, the best leverage comes from behavior-first tests, typed background dispatch, real-surface accessibility, plural/RTL-correct localization, exact runtime source attribution, and one coherent release preflight.

Top opportunities, in priority order:

1. Close the page-to-extension telemetry boundary so forged or replayed page messages cannot mutate trusted script state or trigger chains.
2. Route Tampermonkey, Violentmonkey, and Greasemonkey backups through the same quarantine and trust review as generic imports.
3. Default execution URL retention to origin-level or less, scrub already-stored URLs on downgrade, and correct the privacy disclosures.
4. Make release-mode E2E fail when the browser cannot exercise the four userscript-dependent execution paths.
5. Replace the obsolete uninstall/reinstall incident advice with Chrome and AMO store rollback decision trees and drills.
6. Replace security-critical source-string assertions with executable contracts before decomposing the background dispatcher.
7. Test the real extension pages, states, themes, and viewports against WCAG 2.2 rather than relying on synthetic DOM fixtures.
8. Generate one runtime/manifest localization catalog with plural rules, runtime language/direction, and an honest coverage ratchet.
9. Add deterministic source URLs and source maps so wrapper and `@require` failures resolve to original script lines.
10. Unify credential-free release checks and active-documentation drift checks into machine-readable preflight evidence.

Confidence: all repository and external claims below are **Verified** unless explicitly labeled **Likely**, **Assumption**, or **Needs live validation**.

## Product Map

Core workflows:

- Install or import userscripts and userstyles, inspect metadata/permissions/provenance, then approve or quarantine them.
- Edit scripts in Monaco, bind them to local workspaces or libraries, and register them through the browser `userScripts` API.
- Execute GM APIs, collect local diagnostics/statistics, debug failures, and update scripts through reviewed diffs with rollback.
- Organize scripts, collections, subscriptions, schedules, chains, backups, trash, and recovery flows.
- Sync scripts/settings/values through WebDAV, Google Drive, Dropbox, OneDrive, S3, Gist, or Easy Cloud while remaining usable offline.

- User personas: privacy-conscious userscript users, script authors, MV2-era migrants, multi-browser power users, managed-deployment operators, and extension reviewers.
- Platforms and distribution: MIT-licensed; Chrome 130+ MV3 and Firefox 140+ desktop packages; Edge packaging exists but store credentials are blocked; Safari/iOS and further mobile validation are separate platform efforts. Development/release tooling requires Node 24.16+ and npm 11.13+.
- Key integrations and data flows: `chrome.userScripts`/Firefox `userScripts`; IndexedDB and Storage Buckets; `chrome.storage.local`, `session`, and `managed`; Monaco; cloud and Gist APIs; local File System Access handles; Greasy Fork/OpenUserJS/GitHub discovery; SRI, signatures, SBOM, and release-provenance tooling.

## Competitive Landscape

- Tampermonkey — Verified: broad browser coverage, import/export compatibility, editor/debugger depth, and frequent update fixes remain the parity bar. Learn from its operational polish and compatibility discipline; avoid closed-source opacity and product coupling that weakens ScriptVault's local-first position.
- Violentmonkey — Verified: a mature OSS metadata/GM compatibility reference whose current MV3 transition makes migration truthfulness and failure visibility especially important. Learn from its public compatibility corpus; avoid inheriting legacy assumptions that cannot survive Chrome's MV3 constraints.
- ScriptCat — Verified: scheduled/background scripts, subscriptions, per-script update isolation, and current AI/MCP work expose power-user demand. Learn from its timeout isolation and workflow ergonomics; avoid remote-agent features that expand ScriptVault's trusted computing base.
- Greasemonkey — Verified: its long-running wrapper/`@require` line-offset issue is direct evidence that script debugging needs source maps, not wrapper-relative line numbers. Learn from the issue corpus; avoid Firefox-only architectural coupling.
- FireMonkey and Stylus — Verified analogous projects: unified userscript/userstyle handling and richer configurable style variables/live preview are valuable. Learn from their userstyle ergonomics; avoid turning ScriptVault into a general CSS authoring suite before trust and recovery work is closed.
- Userscripts for Safari — Verified: directory-backed editing and mobile distribution are useful signals. Learn from its external-editor workflow; avoid treating Safari/iOS as a small WebExtension packaging task.
- Tweeks — Verified commercial signal: paid natural-language customization proves demand for guided page modification. Learn from its approachable review loop; avoid hosted code generation or collection inconsistent with zero telemetry.

## Security, Privacy, and Reliability

- Verified — Page-forgeable completion events: `content.js:17-25,100-132,318-322` forwards public `window.postMessage` traffic for `reportExecTime`, `reportExecError`, and `netlog_record`. In `src/background/core.ts:8260-8291`, a content-script sender lacks `userScriptId`, so caller-controlled `data.scriptId` can update another script's stats and `reportExecTime` can reach `triggerChainsForAfterScript`. `tests/content-bridge-security.test.js:225-244` and `tests/user-script-message-policy.test.js:114-117` currently pin the unsafe fallback.
- Verified — Import quarantine bypass: the Tampermonkey, Violentmonkey, and Greasemonkey import branches in `src/background/core.ts:7321-7664` enable/register imported scripts without the shared `applyImportedScriptTrust()` path at `src/background/core.ts:5167-5182`. Existing vendor-import tests assert immediate registration instead of reviewed trust.
- Verified — Browsing-context retention mismatch: `src/config/settings-defaults.json:80` defaults `statsUrlRetention` to `full`; `src/background/core.ts:8273-8278` stores URL, timestamp, tab, document, and frame context. Changing the setting masks later display/export but does not erase `stats.lastUrl` already in IndexedDB. `PRIVACY.md:16-30` says browsing activity is not recorded and describes only local Chrome storage, omitting Storage Buckets and opt-in sync/backup egress.
- Verified — False-green execution evidence: the isolated headless E2E run passed 10 tests and skipped four core execution tests because `userScriptsAvailable` was false: local-workspace apply, service-worker rehydration, cross-tab GM value change, and GM XHR FormData. `vitest.config.mjs:19-20` excludes E2E/visual suites, and the release runbook does not invoke them.
- Verified — Recovery advice is obsolete: `docs/release-runbook.md:218-221` prescribes uninstall/reinstall and roll-forward only. Chrome Web Store supports rapid previous-version rollback, and AMO added version rollback in 2025; storage compatibility and partial rollout state still require an explicit decision tree and drill.
- Verified — No confidential vulnerability intake is currently available: the live GitHub private-vulnerability-reporting setting returned `enabled: false`, and the repository has no `SECURITY.md`. The runbook also states Cyber Resilience Act duties unconditionally even though EU guidance makes commercial/manufacturer scope a maintainer-specific determination.
- Verified current snapshot — `npm audit --json` reports zero advisories. No dependency-CVE roadmap item is justified today; continue gating the lockfile instead of adding speculative security upgrades.

## Architecture Assessment

- `src/background/core.ts` is 15,824 lines and the only TypeScript source under `src/` with `@ts-nocheck`. Its roughly 2,304-line `handleMessage` switch owns 227 actions, while `src/background/message-router.ts` enumerates those actions without becoming the dispatcher. Incremental typed domain routing should start with telemetry and import trust, not a wholesale rewrite.
- The test suite is broad but structurally weak at the highest-risk seams: 150 test files read source text, 155 use `.toContain`, and page code is excluded from coverage. Executable message/import/migration/sync contracts and a changed-risk coverage ratchet should precede dispatcher extraction.
- `pages/dashboard.js` is about 19,000 lines and a recurring churn hotspot. `tests/visual/dashboard-shell.visual.test.js` builds a hand-authored DOM instead of loading `pages/dashboard.html`; extract import-review, settings persistence, and diagnostic rendering controllers only after real-page headless coverage exists.
- `src/modules/i18n.ts` duplicates 1,685 keys across nine inline dictionaries while `_locales/*/messages.json` is a second surface. The strict checker passes despite non-English locales having only 1-46 translated runtime strings; binary English plural suffixes and hardcoded `lang="en" dir="ltr"` cannot represent Russian, Hebrew, or Japanese correctly.
- Runtime wrappers in `src/background/wrapper-builder.ts` have no deterministic `//# sourceURL` or source map, and error reporting truncates the message without an original source location. Generated mapping must account for wrappers, `@require`, top-level await, delays, and bundled code, while neutralizing user-provided trailing source directives.
- Release validation is fragmented. `npm run check` passed 2,257 tests, but omits audit, locale, E2E, visual, store-copy, and release-artifact gates; `npm run release:check` independently found a stale v3.19.2 ZIP and a missing v3.20.0 tag. Active docs also drift from manifests and tooling, including module counts, Monaco/CWS CLI versions, CI claims, and the current MV2/Violentmonkey state.
- TypeScript 7.0.2 is a low-risk upgrade candidate: an isolated `tsc --noEmit` passed and was about 39% faster than the pinned compiler in a three-run local sample. Treat that measurement as local, not universal; retain a TypeScript 6 alias only if a real compiler-API consumer remains.

## Rejected Ideas

- Generic executable plugin system — scripts, subscriptions, local libraries, and the public API already provide extensibility; another code-loading tier increases review and supply-chain risk. Source: local architecture; FireMonkey/ScriptCat.
- Hosted AI or raw MCP control — conflicts with local-first/zero-telemetry design and expands the highest-risk control surface; keep any assistance on-device, opt-in, and diff-reviewed. Source: Tweeks; ScriptCat v1.4.0; local `Roadmap_Blocked.md`.
- Multi-user collaboration — introduces identity, authorization, conflict, and server requirements for a personal browser tool without verified demand. Source: competitor and community review.
- Safari/iOS or Android expansion in this pass — requires separate platform packaging, API, store, and device evidence and is already blocked or out of scope. Source: Userscripts for Safari; local `Roadmap_Blocked.md`.
- WXT/Plasmo/framework rewrite — the generated TypeScript/esbuild pipeline is mature; typed dispatcher and test seams solve the observed problems with less churn. Source: local build and promotion map.
- More sync providers — seven paths already exist; correctness, recovery, and disclosure are higher-value than provider count. Source: `README.md`; `src/background/cloud-sync.ts`.
- Full browser-resident Git client or multi-file IDE — duplicates local workspace/libraries and adds credential/storage risk. Source: Violentmonkey local-editor workflow; local workspace tests.
- Bulk machine translation — would turn the coverage metric green without trustworthy safety/error copy. Build plural/RTL/catalog infrastructure and accept reviewed translations instead. Source: Chrome i18n; ECMA-402; Unicode CLDR.
- Separate offline mode — core editing, execution, backup, and restore are already local-first; the verified gaps are recovery evidence and opt-in network disclosure, not offline availability. Source: local storage and backup architecture.
- Browser-profile/IndexedDB recovery scraper — browser-internal layouts are unstable and probing them would create corruption and privacy risk. Prefer supported exports, backups, trash, and migration tests. Source: local recovery flows.

## Sources

Competitors and ecosystem:

- https://www.tampermonkey.net/changelog.php?locale=en&show=dhdg
- https://violentmonkey.github.io/
- https://github.com/scriptscat/scriptcat/releases/tag/v1.4.0
- https://github.com/greasemonkey/greasemonkey/issues/3233
- https://github.com/erosman/firemonkey
- https://github.com/quoid/userscripts
- https://github.com/openstyles/stylus/issues/2065
- https://github.com/openstyles/stylus/issues/2006
- https://www.tweeks.io/privacy
- https://github.com/awesome-scripts/awesome-userscripts

Platforms, standards, and release operations:

- https://developer.chrome.com/docs/extensions/reference/api/userScripts
- https://developer.chrome.com/docs/extensions/reference/api/i18n
- https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/userScripts
- https://developer.chrome.com/docs/extensions/develop/migrate/mv2-deprecation-timeline
- https://developer.chrome.com/docs/webstore/program-policies/policies
- https://developer.chrome.com/docs/webstore/rollback
- https://extensionworkshop.com/documentation/publish/version-rollback/
- https://blog.mozilla.org/addons/2025/09/19/now-you-can-roll-back-to-a-previous-version-of-your-extension/
- https://tc39.es/ecma426/
- https://tc39.es/ecma402/
- https://unicode.org/reports/tr35/tr35-numbers.html
- https://www.w3.org/TR/WCAG22/
- https://playwright.dev/docs/next/accessibility-testing

Security, dependencies, research, and community:

- https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository?apiVersion=2022-11-28
- https://digital-strategy.ec.europa.eu/en/policies/cra-open-source
- https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
- https://github.com/dequelabs/axe-core
- https://arxiv.org/abs/2505.19456
- https://www.reddit.com/r/ViolentMonkey/comments/1umiy3p/violentmonkey_mv3/
- https://stackoverflow.com/questions/29592068/debug-tampermonkey-script

## Open Questions

- **Needs live validation** — Will the maintainer enable GitHub private vulnerability reporting (currently disabled) and provide a confidential contact route? This blocks a truthful `SECURITY.md` acceptance path.
- **Needs live validation** — Is ScriptVault distributed in a commercial activity or otherwise operated as an EU Cyber Resilience Act manufacturer/open-source steward? Public repository evidence cannot determine the operator's legal/economic scope, so the runbook must remain conditional until the maintainer records that decision.
