# Research - ScriptVault

## Executive Summary
ScriptVault is a Chrome MV3 userscript manager with a strong trust-first position: open source, local-first storage, no telemetry, Chrome Web Store publication, Firefox/Edge validation paths, Monaco editing, static analysis, update review, cloud sync, script signing, and a large local regression suite. The highest-value direction is not another broad feature wave; it is tightening release/process trust around the current product: remove the resurrected GitHub Actions workflow, make public release verification deterministic without GitHub CLI auth, reduce Firefox AMO warning noise before submission, keep dev dependencies current, and keep public documentation aligned with the no-remote-build/local-release policy.

Top opportunities in priority order: remove `.github/workflows/ci.yml` and the local GitHub Actions pin gate; harden `release:check:public` so public artifact checks do not fail only because `gh` auth is invalid or GitHub API quota is exhausted; burn down Firefox lint warnings from 148 toward a reviewer-friendlier budget; refresh patch-level dev dependencies found by `npm outdated`; align Firefox/release docs away from remote CI language; keep session-only credentials and Storage Buckets prominent in store-facing copy.

## Product Map
- Core workflows: install/import userscripts, review metadata and risk, edit in Monaco, register through `chrome.userScripts`, expose GM APIs, review updates with diff/rollback context, sync/backup scripts and GM values, inspect network/execution diagnostics, and package Chrome/Firefox/Edge artifacts.
- User personas: privacy-conscious userscript users, users migrating from MV2-era managers, script authors, extension reviewers, enterprise operators using managed policies, and power users with multi-device sync needs.
- Platforms and distribution: Chrome MV3 published package, Firefox AMO validation package, Edge package path, local release artifacts, and deferred Firefox Android/Safari paths because validation or platform APIs are missing.
- Key integrations and data flows: IndexedDB/Storage Buckets for script records, GM values, stats, backups, and local bindings; `chrome.storage.local` for settings and receipts; `chrome.storage.session` for optional session-only sync secrets; offscreen/Firefox fallbacks for analysis and merge work; WebDAV/Drive/Dropbox/OneDrive/S3/Gist sync; CWS/AMO reviewer evidence tooling.

## Competitive Landscape
- Tampermonkey: strongest incumbent with MV3 parity, enterprise provisioning, external editor tracking, and a large installed base. Learn from its file-tracking and policy-provisioning maturity; avoid closed-source trust opacity and freemium trust tradeoffs.
- Violentmonkey: strongest open-source brand but Chrome MV3 support remains unresolved. Learn from its lightweight UX and community trust; avoid leaving a platform migration until browser removal forces users to move.
- ScriptCat: MV3-native and active, with scheduled/background scripts, cloud sync, `@unwrap`, and modern storage choices. Learn from its background-script vocabulary and schedule UX; avoid stability regressions and documentation fragmentation.
- OrangeMonkey: high-install-count lightweight manager. Learn from casual-user migration simplicity and low-friction import paths; avoid weak provenance signals.
- FireMonkey and Greasemonkey: Firefox-only userscript/userstyle references. Learn from userstyle parity and Firefox-first constraints; avoid Chrome-incompatible architecture.
- Userscripts for Safari: proves Safari demand but requires a different extension platform. Keep as a watch item, not a near-term implementation target.
- Requestly and Automa: adjacent browser automation/request tools. Learn from rule testing, replayable workflows, and inspectable execution logs; avoid turning ScriptVault into a general automation suite.
- Greasy Fork/OpenUserJS/awesome-userscripts: discovery ecosystems remain valuable. Keep ScriptVault's built-in search, install-source trust receipts, and migration messaging focused on these ecosystems.

## Security, Privacy, and Reliability
- `npm audit --audit-level=moderate --omit=optional` is currently clean.
- `gh auth status` fails for the configured account, and `npm run release:check:public` hit GitHub API rate limiting plus an unsigned `v3.11.0` tag. Public release checks need a deterministic unauthenticated/public-source path and clearer signed-tag handling.
- `.github/workflows/ci.yml` exists even though repo/global policy says builds, tests, audits, and deploys are local-only. It also revives a remote build surface that the repo recently removed in commit `cef8dec`.
- Firefox lint warning inventory is 148 warnings: 126 `UNSAFE_VAR_ASSIGNMENT`, 17 `UNSUPPORTED_API`, 3 `DANGEROUS_EVAL`, 1 `KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION`, and 1 `INLINE_SCRIPT`. The warnings are reviewed, but lowering the count before AMO submission reduces reviewer friction.
- Broad `<all_urls>` host access, user script execution, optional cookies/downloads/clipboard/identity permissions, and remote `@require` support are inherent to the product; the project offsets them with install review, internal-host guards, SRI/provenance checks, trust receipts, and local-only disclosure.
- Current dependency drift is patch-level: `@playwright/test` 1.60.0 -> 1.61.1, `chrome-types` 0.1.425 -> 0.1.431, `chrome-webstore-upload-cli` 4.0.0 -> 4.0.1, `jsdom` 29.0.1 -> 29.1.1, and `typescript` 6.0.2 -> 6.0.3. `monaco-editor` 0.55.1 and `vitest` 4.1.9 are current.

## Architecture Assessment
- Source ownership is mostly clear: TypeScript authoritative modules in `src/**`, generated runtime artifacts, and dashboard modules in `pages/**`. `background.js` and Monaco build output should remain generated.
- `src/background/core.ts` remains the largest implementation boundary and should continue shrinking through typed handler extraction rather than broad rewrites.
- `pages/dashboard.js` is large but supported by lazy-loaded modules and focused tests; near-term work should target measured warnings and release/docs drift, not another dashboard split.
- `vitest.config.mjs` coverage thresholds are already ratcheted to 45 lines / 48 functions / 32 branches / 42 statements, so prior research claiming 10/5/10 thresholds is stale.
- `tests/dependabot-config.test.js` no longer exists, so the prior stale-test item is obsolete.
- `.github/workflows/ci.yml` and `scripts/check-github-actions-pins.mjs` now conflict with the local-build policy and should be removed or replaced with a local-only drift check.

## Rejected Ideas
- Built-in hosted script generation: natural-language script tools validate demand, but sending page/script context to a hosted service conflicts with ScriptVault's zero-telemetry posture. Source: Tweeks, ScriptCat.
- Safari port now: Safari lacks the same `userScripts` API shape and would require a separate platform project. Source: Userscripts Safari and WebExtensions platform docs.
- Replace Monaco on Chrome with CodeMirror: Firefox packaging may justify a smaller editor later, but Chrome's Monaco editor is a flagship differentiator. Source: Monaco and CodeMirror changelogs.
- General browser automation builder: Requestly/Automa show useful diagnostics patterns, but full workflow automation would dilute the userscript-manager product.
- New sync provider before AMO/CWS hardening: sync coverage is already broad; release trust and reviewer friction are higher-value.
- More remote CI hardening: project policy is local builds only, so hardening `.github/workflows/ci.yml` is the wrong direction.

## Sources
Competitors:
- https://www.tampermonkey.net/changelog.php
- https://github.com/violentmonkey/violentmonkey/issues/1934
- https://github.com/scriptscat/scriptcat/releases
- https://docs.scriptcat.org/en/
- https://chrome-stats.com/d/ekmeppjgajofkpiofbebgcbohbmfldaf
- https://github.com/erosman/firemonkey
- https://github.com/quoid/userscripts
- https://github.com/awesome-scripts/awesome-userscripts

Platform and policy:
- https://developer.chrome.com/docs/extensions/whats-new
- https://developer.chrome.com/docs/extensions/reference/api/userScripts
- https://developer.chrome.com/docs/extensions/develop/migrate/mv2-deprecation-timeline
- https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code
- https://extensionworkshop.com/documentation/publish/source-code-submission/
- https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/userScripts
- https://w3c.github.io/webextensions/specification/

Security and reliability:
- https://cheatsheetseries.owasp.org/cheatsheets/Browser_Extension_Vulnerabilities_Cheat_Sheet.html
- https://blog.sekoia.io/targeted-supply-chain-attack-against-chrome-browser-extensions/
- https://www.cyberhaven.com/engineering-blog/final-analysis-chrome-extension-security-incident
- https://pluto.security/blog/chrome-extension-supply-chain-attacks-permission-creep/
- https://github.com/advisories/GHSA-5xrq-8626-4rwp

Dependencies and tooling:
- https://github.com/microsoft/monaco-editor/releases
- https://github.com/vitest-dev/vitest/releases
- https://playwright.dev/docs/release-notes
- https://www.typescriptlang.org/docs/
- https://github.com/jsdom/jsdom/releases
- https://github.com/fregante/chrome-webstore-upload-cli/releases

## Open Questions
- AMO submission feedback remains unknowable until maintainer credentials are available and the package is submitted.
- Whether release tags must be signed locally for every historical/public verification path needs a maintainer key decision.
- Firefox Android validation still needs a device or emulator smoke path before claiming support.
