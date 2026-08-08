# Research — ScriptVault
Date: 2026-08-06 — replaces all prior research.

## Executive Summary

ScriptVault v3.24.0 is a mature, local-first, zero-telemetry MV3 userscript and UserCSS manager for Chromium and Firefox, with a safety envelope (SRI/TOFU provenance, Ed25519 signing, AST risk analysis, reviewable updates with diffs, trash/rollback/restore receipts, generated-from-TypeScript runtime boundaries) that no competitor matches. Its engineering hygiene is unusually strong: 228 Vitest files, 16 Playwright E2E specs, an axe-core WCAG 2.2 AA gate across four themes with an empty exception list, `ignore-scripts=true`, a CVE floor gate, a permission-drift gate, and a no-telemetry gate. `npm audit --omit=optional --audit-level=high` is now clean; the P0 from the 2026-08-02 pass shipped in `68d2001`.

The problem has moved from code quality to **delivery and claim integrity**. Four months of security fixes sit unreleased, the shipped package is a development build, the extension's public differentiation rests on a competitor fact that flipped three weeks ago, and a working Firefox API was deleted as "nonexistent" because the probe omitted its required permission. The highest-value direction is to close the gap between what the repository has built and what a user actually receives.

### Top opportunities, in priority order

| # | Opportunity | Confidence | Impact | Effort |
|---|---|---|---:|---|
| 1 | Tag and release v3.23.0/v3.23.1/v3.24.0 — four months of security fixes reach nobody; make the missing-tag warning a hard gate failure | Verified | 5 | S |
| 2 | Unpin `dompurify` from `3.4.11` (exactly the top of GHSA-c2j3-45gr-mqc4's range) and raise the stale `3.3.2` CVE floor | Verified | 4 | S |
| 3 | Restore `browser.publicSuffix` — it exists in Firefox 153+, requires a `"publicSuffix"` permission the Firefox manifest never declared; a test now forbids reintroducing it | Verified | 4 | S |
| 4 | Prove the AMO source ZIP rebuilds byte-identically on a clean Linux clone — AMO began building submissions from source and comparing on 2026-07-23 | Verified | 5 | M |
| 5 | Ship a production build — `build.sh` and `publish.sh` both discard `--prod`, so every store package carries a 1.8 MB unminified service worker and 27.7 MB unminified Monaco | Verified | 4 | S |
| 6 | Refresh the README comparison table — "ViolentMonkey · Manifest V3 · Beta/test builds" has been false since VM v2.43.0 stable (2026-07-14) | Verified | 4 | S |
| 7 | Tree-shake Monaco — the full barrel import ships 79 language tokenizers and 5 workers for an editor that only ever opens `javascript` models; this is the stated blocker for Monaco on Firefox | Verified | 4 | M |
| 8 | Give UserCSS a CSS editor model — the v3.22.0 headline feature is edited in a JavaScript language model | Verified | 3 | S |
| 9 | Measure service-worker cold start — nothing in the repo does, and MV3 boot latency is the #1 performance complaint across the ecosystem | Verified | 4 | M |
| 10 | Defend against Greasy Fork infrastructure failure — its API certs expired and `update.greasyfork.org` sits behind a Cloudflare challenge as of 2026-08-06 | Verified | 3 | M |
| 11 | Add `min-release-age` to `.npmrc` — the control that would have blocked the 2026-08-04 keyv/cacheable compromise | Verified | 3 | S |

## Product Map

**Core workflows**
- Install a `.user.js` or `.user.css` from a URL, file, drag-drop, Gist, collection, or the Find Scripts discovery panel; review metadata, permissions, provenance, SRI state and AST risk before approving.
- Author and debug in a Monaco-backed dashboard editor with GM API typings, linting, a userscript language service, local-file binding, DevTools panel and side panel.
- Register through `chrome.userScripts` / `browser.userScripts` with per-script `worldId`, exposing 35+ GM-compatible APIs plus `@var` config, chains, schedules, folders, workspaces and profiles.
- Review updates as diffs with permission and dependency deltas, apply or roll back, recover from trash, undo a restore via receipts.
- Back up and sync across WebDAV, Google Drive, Dropbox, OneDrive, S3, Easy Cloud and Gist, with optional passphrase encryption and a 3-way merge.

**Personas** — privacy-conscious power users wanting an auditable alternative to closed-source managers; script and UserCSS authors needing a real editor and a local dev loop; migrants from Tampermonkey/Violentmonkey/ScriptCat/Greasemonkey/Stylus; maintainers needing provenance, diagnostics and redacted support evidence.

**Platforms and distribution** — Chrome MV3 (`minimum_chrome_version: 130`, published at `chromewebstore.google.com/detail/scriptvault/jlhdbkeijcbgnonpfkfkkkhfmbeejkgh`); Firefox MV3 (`strict_min_version: 140.0`, AMO-ready packaging but no listing); Edge Tier 1 local package, no Partner Center listing; Chromium derivatives smoke-only. Safari and Firefox Android are out of scope. Toolchain: Node 24.16+ (Active LTS to 2028-04-30), npm 11.13+, TypeScript 7.0.2, esbuild 0.28.1, Vitest 4.1.10, Playwright 1.61.1, Monaco 0.56.0, `ignore-scripts=true`, zero runtime npm dependencies.

**Key integrations and data flows** — `userScripts`, `storage`, `scripting`, `downloads`, `permissions`, `declarativeNetRequest`, `sidePanel`, `offscreen`, `webNavigation`, `identity` (Chrome only); IndexedDB plus Storage Buckets where available; File System Access for local binding; Greasy Fork / OpenUserJS / GitHub for discovery; remote `@require`/`@resource` behind SRI, TOFU pinning, bounded fetch and an internal-host guard. `scripts/check-no-telemetry.mjs` and `scripts/check-cws-remote-code.mjs` enforce the local-first boundary.

## Competitive Landscape

### Violentmonkey — v2.47.0, 2026-08-06 (the position has changed)
Shipped MV3 stable in **v2.43.0 on 2026-07-14** (first beta v2.41.2, 2026-07-07), ending ScriptVault's MV3 exclusivity against the leading open-source competitor. Since then: an opt-in **Alternative page mode** for true `document-start` timing (authors concede it is inefficient above ~1 MB of combined script/storage/resource per page), **Bypass CSP in Firefox**, S3 sync, `GM_download` via the downloads API, and script commands in the page context menu. ~25 releases in six months, effectively one maintainer.
**Learn:** their MV3 launch produced ~45 bug reports in three weeks (#2584, #2582, #2592, #2608 microfreezes) — a released-but-unproven MV3 path is where users get hurt, which argues for ScriptVault's real-browser smoke gates.
**Avoid:** their "Alternative page mode" tradeoff. ScriptVault registers natively through `chrome.userScripts` with `runAt: document_start`, so it does not need the workaround — but it also has no test proving a document-start script beats the page's own inline scripts.
**Still theirs to lose:** #1023 (separate check from apply, +37) and #500 (show a diff on update, +30) remain open since 2020/2019. ScriptVault shipped both in v3.11.0. #1558 (cryptographic verification, +10) is answered by ScriptVault's Ed25519 signing, which no competitor has.

### Tampermonkey — 5.5.5, closed source
5.5.0 (2026-05-08) added an **MCP bridge for AI tools**, OS-policy script provisioning, local-file development with disk change tracking, `@run-at context-menu` from the popup, and regex script search. The GitHub repo is an issue tracker only; no code pushed since 2025-03-30. No paid tier could be verified — the moat is opacity, not price, and "closed source with analytics" is the single most-repeated trust complaint in the ecosystem.
**Learn:** OS-policy provisioning is a real enterprise wedge that ScriptVault's `managed-storage-schema.json` foundation could reach.
**Avoid:** an ungated MCP surface. ScriptCat's design is strictly better.

### ScriptCat — v1.4.0 stable / v1.5.0-beta.1
The most feature-aggressive: `@background`/`@crontab` scripts with `CAT_fileStorage`/`CAT_userConfig`, an **MCP bridge with tiered authorization, a human confirmation page and a full audit log**, a recycle bin with configurable retention, Firefox MV3, and Monaco quick-fix that **warns on undefined metadata tags**.
**Learn:** the gated MCP model, and the undefined-metadata-tag warning — a cheap, high-value editor feature.
**Avoid:** they shipped a prototype-pollution vulnerability through untrusted user-config keys (#1494). ScriptVault's `src/modules/script-config.ts:25` already guards `__proto__`/`constructor`/`prototype` — verified safe, do not regress it.

### Stylus — v2.4.9, 2026-08-02
The UserCSS reference implementation: live preview via `@preprocessor` section extraction, instant inject in same-origin iframes, per-tab toggle from the popup. Top request is **#739 apply styles to ShadowDOM (+19)**.
**Learn:** UserCSS-first affordances and same-origin-iframe injection timing.
**Avoid:** bundling a Less compiler. ScriptVault's explicit unsupported-preprocessor warning is the honest position for a zero-runtime-dependency product.

### FireMonkey — v3.6, 2026-07-30 (revived)
Dormant for 18 months, then v3.0 (2026-07-04) landed Monaco with IntelliSense, `@connect`, `@group`, `@origin`, `@unwrap`, `@upload` (WebDAV), GM cookie, **Convert to UserCSS**, **CSP Exclude**, a diff viewer for manual updates, and a wrapper permitting top-level `await`/`return`. Firefox-only, 170 stars.
**Learn:** "Convert to UserCSS" is a genuinely useful one-way bridge ScriptVault could offer from the userstyle manager.

### Tweeks (YC W25)
A full MV3 manager whose entry point is a natural-language prompt that generates deterministic CSS/DOM/JS transforms, with a public shareable library and SOC 2 claims. It runs comparison marketing against Tampermonkey.
**Learn:** the discovery and onboarding story — laypeople cannot find scripts, and that is a named ecosystem complaint.
**Avoid:** its architecture requires sending page structure to a remote AI service, the exact inverse of ScriptVault's boundary. ScriptVault's on-device `LanguageModel` integration (`src/modules/on-device-ai.ts`) is the correct answer to the same demand.

### Greasy Fork — infrastructure is now a dependency risk
Actively developed, but as of **2026-08-06** `api.greasyfork.org` and `api.sleazyfork.org` had expired SSL certificates (#1561) and `update.greasyfork.org` sits behind a Cloudflare challenge that breaks manager update checks (#1553). Governance friction is visible (#1537, #1538). ScriptVault hardcodes `https://api.greasyfork.org/en/scripts.json` for discovery and its scripts' `@updateURL`s point at the same infrastructure.

## Security, Privacy, and Reliability

- **Open advisory, self-inflicted.** `package.json` `overrides.dompurify: "3.4.11"` pins exactly the top of GHSA-c2j3-45gr-mqc4's affected range (`<=3.4.11`, fixed 3.4.12, latest 3.4.13, published 2026-08-03). `scripts/check-cve-floors.mjs:14` carries `dompurify: { floor: '3.3.2' }` — the gate authorizes the vulnerable version, and `--audit-level=high` cannot see a low-severity finding. This is the "check wired to pass" failure mode the repo has already been bitten by once.
- **Supply chain.** `.npmrc` sets `ignore-scripts=true` with a documented rationale, and the lockfile carries none of the versions from the **2026-08-04 keyv/cacheable compromise** (`keyv@4.5.4`, `flat-cache@4.0.1`, `file-entry-cache@8.0.0` are all pre-compromise). Exposure: none. The missing control is `min-release-age`, supported by the npm 11.13+ the repo already requires.
- **Delivery is the largest live risk.** `git tag | sort -V` tops out at **v3.22.0**; `gh release list` shows the same. `manifest.json`, `package.json` and `CHANGELOG.md` all say v3.24.0. Ten changelogged versions have no tag. Unreleased security work includes on-demand execution isolation (`6dddb3c`), `@connect` re-check against the post-redirect URL (`5134fb2`), per-script GM tab-storage scoping (`8b38415`), `@require` cache keying by integrity (`1b54a96`), the restored dependency-audit gate (`68d2001`) and the Firefox per-script world fix (`af0bfb3`). `scripts/check-release-artifacts.mjs` emits "git tag v3.24.0 is missing" as a **warning** and exits 0.
- **A working platform API was removed on a false negative.** `5c868d4` deleted the `browser.publicSuffix.getDomain()` branch after probing Firefox 154.0b1 and finding the namespace absent. MDN states verbatim: *"To use this API, you must have the `"publicSuffix"` permission."* `manifest-firefox.json` declares it in neither `permissions` nor `optional_permissions`, so the namespace is correctly `undefined` — the probe measured a missing permission, not a missing API. The API shipped in Firefox 153 (2026-07-23). `tests/domain-root-public-suffix.test.js:43,49` now asserts the string `publicSuffix` must not appear in the source, locking the feature out. The commit's diagnosis of the *original* defect (a test that injected its own mock proved nothing) was correct and the shared-helper de-duplication is good work; only the "does not exist" conclusion is wrong.
- **Store compliance moved on 2026-08-01.** CWS now enforces Limited Use ("strictly necessary to the disclosed single purpose") and Disclosure Requirements, and added a Malicious/Prohibited Products clause banning **circumvention of AI service safety guardrails or usage restrictions**. The repo's `eac6294` zero-telemetry gate covers the first two; the third is new and touches a manager whose Find Scripts panel installs arbitrary third-party code.
- **AMO's newest gate is a build gate.** Since Firefox 153 (2026-07-23), *"AMO now attempts to build your extensions from the submitted source code and compares the result."* ScriptVault's `scripts/check-reproducible-build.mjs` compares **normalized** zip-entry SHA-256, and the only artifact on disk is `scriptvault-firefox-v3.20.0.reproducible-build.json` (2026-07-14). Neither the current version nor an AMO-shaped run — clean Linux clone, source ZIP only, `npm ci` under `ignore-scripts=true` — has been exercised.
- **Recovery remains a genuine strength** (pending-update review, version history, rollback, trash, restore receipts with undo, backup verification) and the accessibility gate is real: axe-core across `wcag2a/2aa/21a/21aa/22aa` on every surface × 4 themes × viewports with an **empty** exception list, plus geometry checks for 24 px targets, focus indicators and `elementFromPoint` focus-obscured detection (WCAG 2.4.11), and keyboard move-up/down alongside the drag handle (WCAG 2.5.7). These are marketable and should not be re-audited.
- **Not defects, verified:** `@var` config parsing guards prototype-pollution keys; `@run-in incognito-tabs` is supported; `file://` access is probed via `extension.isAllowedFileSchemeAccess()` with per-browser guidance; the Chrome 138+ "Allow User Scripts" setup doctor (`src/modules/user-scripts-setup.ts`) is the best onboarding recovery in the field for the ecosystem's single largest source of "it just stopped working".

## Architecture Assessment

- **The packaging path contradicts its own documentation.** `build.sh:21` runs `node esbuild.config.mjs` with no `--prod`; `publish.sh:66` runs `npm run build`; `scripts/build-edge.mjs:135` does the same. The generated support matrix in `README.md:382` claims the Chrome path is "`npm run build:prod` then `bash build.sh`" — but `build.sh` re-runs the non-production build and overwrites any minified output. `build:prod` is reachable from no packaging, release or test path. Consequence: `background.js` ships at 44,365 lines / 1.81 MB and Monaco at 27.7 MB uncompressed, and `scripts/check-monaco-package-contract.mjs` has budgeted for the unminified figures (28 MB), so the budget cannot catch the regression.
- **Monaco is imported as a barrel.** `src/editor/monaco-esm-entry.ts:1` is `import * as monaco from 'monaco-editor'`, which pulls **79** basic-language tokenizers into `editor.js` (9.78 MB) and five workers (`ts` 13.36 MB, `css` 1.96 MB, `html` 1.34 MB, `json` 0.94 MB, `editor` 0.63 MB). The editor creates models with exactly one language — `pages/editor-sandbox.html:255,681` both pass `'javascript'` — so the css, html and json workers (4.24 MB) are unreachable and the html/handlebars/razor/scss/less label mappings are dead. Monaco 0.56.0 added tree-shakeable ESM entry points. `FIREFOX-PORT.md:45` records that Monaco is omitted from the Firefox package because "AMO's linter rejects the bundled TypeScript worker as too large to parse" — pruning the bundle is the direct unblock for Firefox editor parity, not a separate effort.
- **UserCSS has no editor language.** `pages/editor-sandbox.html` never sets a `css` model despite `css.worker.js` being bundled, so userstyles — the v3.22.0 headline feature — are authored under JavaScript tokenization and JavaScript diagnostics.
- **No cold-start instrumentation.** `scripts/smoke-large-library.mjs` gates MatchSet build/lookup and dashboard virtual-row render p50/p99, and `tests/large-library-perf.test.js` mirrors it in CI. Nothing measures service-worker boot — the parse and execute cost of a 1.81 MB script that Chrome pays on every wake. This is the ecosystem's most-reported MV3 performance symptom (Violentmonkey #2608, Tampermonkey #2456/#2731 and discussion #2347: 50–500 ms per navigation, hundreds of restarts per day).
- **Two policy owners remain oversized:** `src/background/core.ts` at 15,826 lines and `pages/dashboard.js` at 19,768 lines. The existing roadmap's fetch-intent/freshness item is the right first extraction; nothing new is proposed here.
- **Documentation drift beyond what is already tracked:** `CLAUDE.md` states version v3.19.2 (actual 3.24.0), Monaco 0.55.1 (actual 0.56.0), vendored acorn 8.14.1 and diff 7.0.0 — both wrong; `lib/acorn.min.js` is 8.17.0 and `lib/diff.min.js` is 9.0.0, correctly recorded in `docs/amo-vendored-libraries.md`. `README.md:591` still shows `--version 3.22.0` in the preflight example. The tracked, published `README.md` carries a false competitor claim (see below). `scripts/check-readme-claims.mjs` validates ScriptVault's own feature claims but not comparison rows or generated version references.
- **Category coverage.** Security: strong, one open low advisory, one stale floor. Accessibility: strong and genuinely gated. i18n: generated and drift-checked, honestly labelled partial (8 locales at 2.2–6.1% of 1,914 runtime keys) with an RTL ratchet already queued. Observability: local error log, health and support snapshots exist; SW boot is the blind spot. Testing: 228 unit files + 16 E2E specs + visual baselines; live cloud providers and real-host install/DevTools remain queued as unaudited. Distribution: the weakest axis — Chrome listing is four versions stale, Firefox and Edge unlisted. Upgrade strategy: conditional-request validators, re-registration on update, version history and rollback all exist, but the delivery gap means users are not receiving upgrades at all, which is the failure that matters. Plugin ecosystem: deliberately none. Mobile: out of scope. Offline/resilience: covered. Multi-user: out of scope. Migration: importers for all major managers exist.

## Platform Capabilities Newly Available

Shipped since the last research pass and not yet used anywhere in the repository. Each is feature-detectable, so none requires raising a minimum-version floor.

- **`userScripts.execute()` returns synchronous syntax diagnostics on failure — Chrome 149.** `src/background/core.ts:7327,9376` already branch on `execute()` availability and fail with a generic message; the browser can now name the syntax error. Firefox got `execute()` at all in 153, so one feature-detected path serves both. Sources: https://developer.chrome.com/docs/extensions/whats-new, https://blog.mozilla.org/addons/2026/07/23/firefox-153-webextensions-api-updates/
- **`runtime.getDocumentId()` — Firefox 153.** A stable per-document identifier. The open UserCSS SPA-orphan and navigation-coalescing items key injection state per tab, which cannot tell a reloaded document from a live one; this closes that gap on Firefox without changing the Chrome path.
- **Content scripts can read `document.adoptedStyleSheets` / `ShadowRoot.adoptedStyleSheets` directly — Firefox 153.** Relevant to the Stylus community's top request (#739, apply styles to ShadowDOM, +19) and to `GM_addStyle` shadow reach, which `28b043a` already began.
- **`browser` namespace alias for all extension APIs — Chrome 148.** Could simplify `pages/dashboard-firefox-compat.js`, but `minimum_chrome_version` is 130, so it stays a detection branch rather than a simplification. Not worth an item yet.
- **Ed25519 in Web Crypto is unflagged in every engine** (Firefox 129, Safari 17, Chrome 137) — the signing feature needs no polyfill and no caveat in its documentation. Source: https://blogs.igalia.com/jfernandez/2025/08/25/ed25519-support-lands-in-chrome-what-it-means-for-developers-and-the-web/
- **Test tooling the repo already depends on but does not use:** Vitest 4's Playwright trace integration (browser-mode config exists), Playwright 1.61's `page.localStorage`/`page.sessionStorage` (extension state is currently asserted through `page.evaluate()`), and 1.62's `retryStrategy: 'isolated'` for the extension-load specs that have historically flaked. Dev-dependency gaps as of 2026-08-06: `@playwright/test` 1.61.1 → 1.62.1, `jsdom` 29.1.1 → 30.0.1, `puppeteer-core` 25.2.1 → 25.5.0, `acorn` 8.17.0 → 8.18.0, `chrome-types` 0.1.431 → 0.1.436. None is security-driven.

## Rejected Ideas

- **Violentmonkey-style "Alternative page mode" — Rejected as not applicable.** ScriptVault registers natively via `chrome.userScripts` with `runAt: document_start`; VM needed the workaround because of its own injection strategy, and its authors cap it at ~1 MB per page. Source: https://github.com/violentmonkey/violentmonkey/releases/tag/v2.46.0
- **`@require` pointing at another userscript (Tampermonkey #853, +17) — Rejected for this cycle.** A userscript-as-library carries its own `@grant`, `@connect` and `@match` metadata, so composing them would require merging permission sets at install time and would defeat the per-script provenance and grant model the product is built on. Source: https://github.com/Tampermonkey/tampermonkey/issues/853
- **Tampermonkey-style ungated MCP bridge — Rejected.** Their companion-extension model has no confirmation surface or audit log; ScriptCat's tiered-authorization design is the correct reference, and an MCP server is already tracked in `Roadmap_Blocked.md`. Sources: https://github.com/Tampermonkey/tampermonkey-mcp, https://github.com/scriptscat/scriptcat/pull/1573
- **Remote AI script generation (Tweeks model) — Rejected.** It requires sending page structure to a third-party service, contradicting the zero-telemetry boundary that `scripts/check-no-telemetry.mjs` enforces. The on-device `LanguageModel` path already in `src/modules/on-device-ai.ts` serves the same demand locally. Source: https://www.tweeks.io/blog/best-tampermonkey-alternatives
- **ScriptCat `CAT_fileStorage` / `@storageName` / `@definition` / `@early-start` — Rejected as duplicate.** Already recorded Under Consideration in `ROADMAP.md` (2026-07-16) with the same reasoning; no new demand signal appeared. Source: https://docs.scriptcat.org/en/docs/dev/meta/
- **Storage Buckets as a portable design — Rejected.** Chromium-only, still a WICG draft with no Firefox or Safari implementation; the existing single-DB fallback is the correct default. Source: https://github.com/WICG/storage-buckets/blob/main/explainer.md
- **Designing to WCAG 3.0 — Rejected.** Still a Working Draft (updated 2026-03-03); Candidate Recommendation is not anticipated before Q4 2027. `docs/wcag3-gap-analysis.md` already exists as reference. Source: https://www.w3.org/WAI/news/2026-03-03/wcag3
- **Depending on `FileSystemObserver` — Rejected as a primary mechanism.** MDN states it is non-standard and should not be used in production; Chrome 133 desktop only, no Firefox/Safari/Android. This strengthens rather than replaces the existing polling-fallback roadmap item. Source: https://developer.mozilla.org/en-US/docs/Web/API/FileSystemObserver
- **Migrating to `typescript-6` only, or dropping it — Rejected.** TypeScript 7.0.2 (the Go-native port) ships without a stable programmatic API until 7.1; keeping `typescript-6@6.0.3` as a parallel checker is correct, not redundant. Source: https://www.infoq.com/news/2026/08/typescript-7-released/

## Sources

### Competitors and ecosystem
https://github.com/violentmonkey/violentmonkey/releases
https://github.com/violentmonkey/violentmonkey/releases/tag/v2.46.0
https://github.com/violentmonkey/violentmonkey/issues/1023
https://github.com/violentmonkey/violentmonkey/issues/500
https://github.com/violentmonkey/violentmonkey/issues/1558
https://github.com/violentmonkey/violentmonkey/issues/2608
https://github.com/violentmonkey/violentmonkey/issues/2584
https://www.tampermonkey.net/changelog.php
https://github.com/Tampermonkey/tampermonkey/issues/2607
https://github.com/Tampermonkey/tampermonkey/issues/2456
https://github.com/Tampermonkey/tampermonkey/discussions/2347
https://github.com/Tampermonkey/tampermonkey/issues/211
https://github.com/Tampermonkey/tampermonkey/issues/2771
https://github.com/Tampermonkey/tampermonkey/issues/2785
https://github.com/Tampermonkey/tampermonkey-mcp
https://github.com/scriptscat/scriptcat/releases
https://docs.scriptcat.org/en/docs/change/
https://github.com/scriptscat/scriptcat/pull/1573
https://github.com/scriptscat/scriptcat/pull/1494
https://github.com/scriptscat/scriptcat/pull/1608
https://github.com/openstyles/stylus/releases
https://github.com/openstyles/stylus/issues/739
https://github.com/erosman/firemonkey/releases/tag/v3.0
https://github.com/quoid/userscripts/releases
https://www.tweeks.io/blog/best-tampermonkey-alternatives
https://github.com/greasyfork-org/greasyfork/issues/1553
https://github.com/greasyfork-org/greasyfork/issues/1561
https://github.com/greasyfork-org/greasyfork/issues/1240
https://greasyfork.org/en/help/antifeatures
https://github.com/lisonge/vite-plugin-monkey/releases
https://www.waze.com/discuss/t/urgent-two-scripts-were-compromised-on-feb-1-please-read-if-you-use-scripts/365499
https://news.ycombinator.com/item?id=45929125
https://news.ycombinator.com/item?id=47911735

### Platform, standards and store policy
https://developer.chrome.com/docs/extensions/reference/api/userScripts
https://developer.chrome.com/blog/chrome-userscript
https://developer.chrome.com/docs/extensions/whats-new
https://developer.chrome.com/blog/cws-policy-updates-2026
https://developer.chrome.com/docs/webstore/review-process
https://developer.chrome.com/docs/extensions/develop/migrate/mv2-deprecation-timeline
https://developer.chrome.com/docs/extensions/reference/manifest/minimum-chrome-version
https://blog.mozilla.org/addons/2026/07/23/firefox-153-webextensions-api-updates/
https://blog.mozilla.org/addons/2026/04/23/webextensions-api-changes-firefox-149-152/
https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/publicSuffix
https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/userScripts
https://extensionworkshop.com/documentation/publish/source-code-submission/
https://github.com/w3c/webextensions/issues/279
https://github.com/w3c/webextensions/issues/477
https://developer.mozilla.org/en-US/docs/Web/API/FileSystemObserver
https://web.dev/blog/baseline-navigation-api
https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/
https://cheatsheetseries.owasp.org/cheatsheets/Browser_Extension_Vulnerabilities_Cheat_Sheet.html

### Dependencies and advisories
https://github.com/advisories/GHSA-c2j3-45gr-mqc4
https://www.npmjs.com/package/dompurify
https://github.com/microsoft/monaco-editor/blob/main/CHANGELOG.md
https://github.com/microsoft/playwright/releases
https://github.com/jsdom/jsdom/releases
https://github.com/acornjs/acorn/blob/master/acorn/CHANGELOG.md
https://github.com/mozilla/web-ext/releases
https://voidzero.dev/posts/announcing-vitest-4
https://www.infoq.com/news/2026/08/typescript-7-released/
https://socket.dev/blog/popular-npm-packages-in-the-keyv-and-cacheable-namespaces-compromised-in-active-supply-chain
https://docs.npmjs.com/cli/v11/using-npm/config/
https://nodejs.org/en/blog/announcements/evolving-the-nodejs-release-schedule
https://blogs.igalia.com/jfernandez/2025/08/25/ed25519-support-lands-in-chrome-what-it-means-for-developers-and-the-web/

## Open Questions

- Should the untagged versions be released individually (v3.23.0, v3.23.1, v3.24.0) to preserve the CHANGELOG's per-version narrative, or consolidated into a single v3.24.0 release with the intermediate CHANGELOG entries retained? This determines whether `scripts/check-release-artifacts.mjs` must accept historical tag gaps or fail on any changelogged-but-untagged version.
- Does AMO's source-build validator honor a repository `.npmrc` (and therefore `ignore-scripts=true`)? If it does not, esbuild's `postinstall` will run in the reviewer's environment and the build must still be byte-identical. This cannot be answered from the repository and gates the Firefox submission plan.
- Is the unminified shipped build a deliberate transparency choice? If so it should be stated in `AMO-SOURCE-README.md` and the Monaco budget comment, and `build:prod` plus the README's `npm run build:prod` claim should be removed rather than wired up.
