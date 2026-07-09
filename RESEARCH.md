# Research — ScriptVault

Date: 2026-07-09 — replaces all prior research.

## Executive Summary

ScriptVault is a mature, local-first, zero-telemetry Manifest V3 userscript manager at v3.18.0. Its strongest shape is no longer basic Tampermonkey parity: it already has a published Chrome package, Firefox/Edge package paths, a hardened install/update review loop, Monaco editing, sync providers, local workspace binding, managed-policy provisioning, signing/provenance scaffolding, and broad GM API coverage. The highest-value direction is release-trust hardening and developer-loop polish: make browser support evidence impossible to misread, remove remaining "not-yet-implemented" trust states, prove Chromium-derivative behavior, deepen catalog/source interoperability, and use platform advances like `documentId`, File System Observer, and Vitest browser traces where they close concrete gaps.

Top opportunities, in priority order:
1. P1 - Make support-matrix evidence failure-aware so a failed Edge smoke cannot be rendered as "no current evidence".
2. P1 - Retire the `not-yet-implemented` trust receipt state or surface it as an explicit unsupported verification result.
3. P1 - Add local smoke evidence for Brave, Vivaldi, Opera, and Arc before calling Chromium derivatives compatible.
4. P2 - Add configurable Find Scripts source templates instead of hardcoding Greasy Fork/OpenUserJS/GitHub.
5. P2 - Add a local shared-library / `@require-local` workflow on top of the existing local workspace binding.
6. P2 - Group diagnostics by `documentId` so SPA/frame navigation can be traced without stale-frame ambiguity.
7. P2 - Add Vitest/Playwright trace artifacts for browser-mode visual failures.
8. P2 - Turn Firefox lint warnings into a budgeted release gate.
9. P3 - Evaluate Monaco native LSP support for userscript metadata, GM APIs, and type-aware completions.

## Product Map

- Core workflows: install/import scripts; review metadata, permissions, risk, SRI, and provenance; edit in dashboard/Monaco; register through `chrome.userScripts`; expose GM APIs and runtime diagnostics; update with diff/rollback; sync and back up scripts, values, folders, workspaces, and settings.
- User personas: privacy-conscious userscript users, MV2-era migrants, script authors, enterprise operators using managed policy, extension reviewers, and multi-browser power users.
- Platforms and distribution: Chrome MV3 published target; Firefox Desktop AMO-validation package; Microsoft Edge-compatible ZIP with publication blocked by store credentials; Firefox Android, Safari/Orion, and some Firefox 153 APIs are deferred or blocked in `Roadmap_Blocked.md`.
- Key integrations and data flows: IndexedDB and Storage Buckets for scripts/values/backups; `chrome.storage.local`, `session`, and `managed`; WebDAV/Drive/Dropbox/OneDrive/S3/Gist/EasyCloud sync; local folder handles/File System Observer; Greasy Fork/OpenUserJS/GitHub search/install; Monaco, Acorn, diff, fflate, Sigstore verification modules; public API and local MCP prototype gated by trusted origins.

## Competitive Landscape

- Tampermonkey: strongest incumbent for broad browser/store presence, update handling, local-file editing, OS policy provisioning, and its new MCP companion. ScriptVault should learn from its rapid-development and managed-deployment polish, but avoid closed-source opacity, notification noise, and cloud/tool coupling that weakens the local-first story.
- Violentmonkey: best OSS signal for unmet power-user demand. Open issues show users asking for customizable Find Scripts sources, `@require-local`, easier site scoping, ESM loader work, and catalog publishing handoffs. ScriptVault already covers some publish/site-scope work; the remaining actionable gaps are catalog source customization and local shared libraries.
- ScriptCat: demonstrates demand for background/scheduled scripts, script subscriptions, cloud sync, AI agent/MCP features, and richer editor/debugging. ScriptVault should keep the secure/local version of these ideas and avoid hosted AI/provider sponsorship paths that conflict with zero telemetry.
- Greasy Fork/OpenUserJS ecosystem: still the main install/update catalog surface; community scripts also implement "find scripts for this site" across multiple catalogs. ScriptVault should treat catalog search and install provenance as product infrastructure, not just a convenience overlay.
- quoid/userscripts and Stay: Safari/iOS managers show the value of a directory-backed workflow and mobile demand, but ScriptVault's current WebExtension stack makes Safari/iOS a separate product-level port rather than a near-term roadmap item.
- WXT, Extension.js, and Plasmo: adjacent extension frameworks prove cross-browser build/smoke automation is table-stakes for extension products. ScriptVault should not rewrite into a framework now, but it should copy the release-matrix discipline.
- Tweeks and PageGuide-style research: natural-language page customization and DOM-grounded assistance are real market signals. ScriptVault already has on-device AI and Prompt API scaffolding; future AI work should stay opt-in, local, reviewable, and tied to generated code diffs.

## Security, Privacy, and Reliability

- Verified - Edge support evidence can be misleading. `scripts/generate-browser-support-matrix.mjs` treats Edge smoke as passed only when `status === "passed"` and otherwise renders "no current evidence"; `README.md` then hides whether an attempted smoke failed. This is a release-trust bug, not just documentation.
- Verified - trust receipt verification still has an explicit incomplete status. `src/background/trust-receipt.ts:129` and `src/background/core.ts:1361` can emit `verification: 'not-yet-implemented'` even though `src/modules/sigstore-bundle-verifier.ts` exists. The install/update UI should never make this look equivalent to verified provenance.
- Verified - Chromium derivatives are unverified. `README.md` lists Brave/Vivaldi/Opera/Arc as a watchlist with no local smoke or store package evidence, while direct competitors and frameworks position derivative-browser coverage as expected.
- Verified - Firefox lint has a warning debt. The support matrix reports web-ext lint with 0 errors / 0 notices / 53 warnings; a warning budget would prevent release drift while keeping AMO submission work separate from credential blockers.
- Verified - MCP/local agent bridges remain high risk if exposed as localhost services. CSA, NSA, and CVE-2025-49596 evidence all point to authentication, origin checks, loopback-only binding, and disabled-by-default posture. ScriptVault's current public-API-based prototype direction matches that constraint; do not add a raw inbound WebSocket listener.
- Likely - catalog search is too rigid for the ecosystem. `pages/dashboard.js` hardcodes Greasy Fork/OpenUserJS plus external GitHub search, while Violentmonkey users explicitly request customizable source lists and community scripts aggregate multiple catalogs.
- Likely - local dev loop can be stronger without broad file permissions. ScriptVault already uses local workspace handles and File System Observer, so a reviewed local shared-library workflow is safer than browser-wide file URL access.

## Architecture Assessment

- `src/background/core.ts` remains the generated-runtime bridge hot spot. It is large and contains live copies of security, registration, managed policy, local workspace, and trust receipt logic. New work should prefer promoted TypeScript modules and update drift gates when touching copied runtime logic.
- `pages/dashboard.js` is still a large UI composition root. Find Scripts, local workspace, Greasy Fork publishing, support snapshots, and settings wiring are all in one file; new feature work should isolate source registry, local-library, and diagnostics logic into existing module patterns where practical.
- `scripts/generate-browser-support-matrix.mjs` is a good release anchor but needs richer evidence states: passed, failed, unreadable, stale, and not-run should produce distinct matrix output and check behavior.
- `tests/e2e/local-workspace.spec.js` proves local workspace flows, but there are no tests for `@require-local`-style library reuse. `tests/visual/**` has screenshot failure capture, but `vitest.visual.config.mjs` does not use the new Vitest browser trace tooling.
- Type declarations lag Chrome API usage. `package.json` pins `chrome-types` at `^0.1.431`, `npm outdated` reports `0.1.433`, and `src/background/registration.ts` still casts around `messaging` and Chrome 133+ `worldId` shape. This is a small maintenance item, not a product feature.
- Documentation status is mostly honest, but `ROADMAP.md` still has old v3.11/v3.12 section labels while manifests are v3.18.0. Because this pass is append-only for the roadmap, do not rewrite headings here; future cleanup should happen only when it does not disturb task-tracking history.

## Rejected Ideas

- Full WXT/Extension.js/Plasmo migration: useful patterns, but a framework rewrite would churn a mature build pipeline. Source: WXT/Extension.js docs; local `esbuild.config.mjs`.
- New hosted AI script generator: market demand is real, but hosted generation conflicts with zero telemetry. Keep AI local, opt-in, and reviewable. Source: Tweeks; Chrome Prompt API; `settingsOnDeviceAiEnabled`.
- Raw localhost MCP/WebSocket server: directly conflicts with current MCP security evidence. Keep using a disabled-by-default public-API bridge with strict origins and tokening. Source: CSA MCP guide, NSA MCP guidance, CVE-2025-49596.
- Direct automated publishing to Greasy Fork/OpenUserJS: already covered by existing Greasy Fork handoff/receipt behavior and can require external account/session state. Source: `pages/dashboard.js` Greasy Fork handoff code; Violentmonkey #2425.
- Safari/iOS port in this roadmap pass: demand exists, but WebKit/App Store packaging makes this a separate native/Safari extension project, not an incremental Chrome/Firefox/Edge task. Source: quoid/userscripts, Stay.
- Generic "more sync providers": ScriptVault already has many sync providers; remaining sync risks are merge correctness and blocked plain-git work, not provider count. Source: README; `Roadmap_Blocked.md`.
- Mandatory hard-fail on every unpinned remote library by default: good security direction, but too disruptive for existing scripts. Prefer warning/budget/enforce modes already aligned with prior SRI roadmap work.

## Sources

Competitors and ecosystem:

- https://www.tampermonkey.net/changelog.php
- https://github.com/Tampermonkey/tampermonkey-mcp
- https://github.com/violentmonkey/violentmonkey/issues
- https://github.com/violentmonkey/violentmonkey/issues/2425
- https://violentmonkey.github.io/posts/how-to-edit-scripts-with-your-favorite-editor/
- https://violentmonkey.github.io/api/metadata-block/
- https://github.com/scriptscat/scriptcat
- https://docs.scriptcat.org/en/
- https://github.com/quoid/userscripts
- https://github.com/erosman/firemonkey
- https://github.com/awesome-scripts/awesome-userscripts
- https://www.tweeks.io/about
- https://news.ycombinator.com/item?id=45916525
- https://marketplace.visualstudio.com/items?itemName=brunoais.tampermonkey-fs

Platform and standards:

- https://developer.chrome.com/docs/extensions/reference/api/userScripts
- https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code
- https://developer.chrome.com/blog/file-system-observer
- https://developer.chrome.com/docs/ai/prompt-api
- https://developer.chrome.com/blog/ai-webmcp-origin-trial
- https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/153
- https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Build_a_cross_browser_extension
- https://wxt.dev/
- https://extension.js.org/
- https://www.plasmo.com/

Security and dependencies:

- https://labs.cloudsecurityalliance.org/agentic/agentic-mcp-security-best-practices-v1/
- https://www.nsa.gov/Press-Room/Press-Releases-Statements/Press-Release-View/Article/4496698/nsa-releases-security-design-considerations-for-ai-driven-automation-leveraging/
- https://www.oligo.security/blog/critical-rce-vulnerability-in-anthropic-mcp-inspector-cve-2025-49596
- https://www.rescana.com/post/operation-reddirection-over-2-million-users-compromised-by-malicious-chrome-and-edge-extensions-in
- https://vitest.dev/blog/vitest-4-1.html
- https://github.com/microsoft/monaco-editor/blob/main/CHANGELOG.md

## Open Questions

- Which Chromium derivatives are installed on the maintainer machine and should be first-class local smoke targets: Brave, Vivaldi, Opera, Arc, or only those found automatically?
- Should custom Find Scripts sources allow only URL-template handoff, or should they support JSON result mapping for one-click install after an allowlisted schema review?
- Should local shared libraries be script-scoped, workspace-scoped, or global, and how strict should portability warnings be when exporting/importing those scripts?
