# Research — ScriptVault

_Last pass: 2026-07-16. Baseline: v3.20.0 (Chrome MV3 min 130 + Firefox MV3 140+), 2257 Vitest cases, `npm audit` 0, zero runtime dependencies, TypeScript 7.0.2._

## Executive Summary

ScriptVault is a mature, local-first, zero-telemetry userscript manager whose previous research cycle (the v3.20.0 pass: authenticated page telemetry, vendor-import quarantine, execution-URL minimization, typed action dispatch, source maps, WCAG 2.2 gate, unified locale/plural catalogs, fail-closed release smokes, TS7) has **fully shipped**. A fresh competitive sweep confirms the important result: the 2026-H2 feature deltas competitors introduced — Tampermonkey's `GM_audio`, request-scoped cookie partitioning and `anonymous` downloads; ScriptCat's `@unwrap`, Navigation-API `onurlchange`, `CAT_userConfig`; on-disk auto-reload watching — are **already implemented** in ScriptVault (verified in `wrapper-builder.ts`, `parser`, `core.ts`, and the `FileSystemObserver` local-workspace binding). ScriptVault is at or ahead of GM-API parity. The remaining leverage is therefore not new features but **finishing and hardening what already exists**: one shipped-but-unreachable subsystem (persistent UserCSS), the update path's missing risk re-scan, a handful of preview-lifecycle leaks, and low-cost supply-chain/trust hygiene that the project's own philosophy implies but hasn't yet formalized.

Top opportunities, in priority order:

1. Wire (or honestly gate off) the persistent UserCSS engine — it is exported, documented as shipped, and unreachable; only the ephemeral editor preview works.
2. Bump the `esbuild` devDependency floor to `^0.28.1` (GHSA-G7R4-M6W7-QQQR, Windows dev-server path traversal, CVSS 7.5).
3. Add `SECURITY.md` and enable GitHub private vulnerability reporting — currently absent; the CRA reporting era begins 2026-09-11 and downstreams expect a disclosure channel.
4. Re-run the 31-detector AST on every update body and diff the risk delta — the current update path gates `@require` SRI/provenance and flags cross-registry source changes, but a same-author/same-registry malicious update (the dominant GreasyFork account-takeover kill chain) ships unscanned.
5. Fix the UserCSS preview lifecycle: dashboard-close leaks injected CSS onto the target page, `onTabUpdated` re-injects duplicates, and active-tab-switch orphans the prior tab's sheet.
6. Add a manifest permission-drift gate to the test suite — fail the build if `permissions`/`host_permissions` grow beyond a pinned allowlist (ownership-transfer/permission-creep defense).
7. Harden the build chain against npm-worm lifecycle payloads (`.npmrc` `ignore-scripts` with a build-step allowlist; publish token discipline).
8. Sanitize page-controlled template tokens (tab title → new-script source) by stripping CR/LF and clamping length.
9. Compress backup blobs with the Baseline Compression Streams API to relieve the known `chrome.storage.local` ZIP-blob footprint.
10. Verify PRIVACY.md and the CWS listing disclosures against zero-telemetry reality before CWS Limited-Use/Disclosure enforcement (2026-08-01).

Confidence: repository claims are **Verified** against source unless labeled otherwise. External platform/date claims are **Likely** where they depend on a not-yet-shipped release (e.g. Firefox 153, expected 2026-07-21).

## Product Map

Core workflows:

- Install/import userscripts and `.user.css` (editor preview), review metadata/permissions/provenance, approve or quarantine.
- Edit in Monaco, bind to local File System Access workspaces (with `FileSystemObserver` auto-reload), register via the browser `userScripts` API.
- Execute a broad GM API surface (incl. `GM.fetch`, `GM_audio`, request-scoped cookie partitioning, `CAT_userConfig`), collect local diagnostics/stats, debug via DevTools panel, update through reviewed diffs with 5-deep rollback.
- Organize scripts, collections, subscriptions, schedules, chains, backups, trash; sync via WebDAV/Google Drive/Dropbox/OneDrive/S3/Gist/Easy Cloud with optional encryption; remain fully usable offline.

- Personas: privacy-conscious script users, script authors, MV2-refugee migrants (Chrome 150/151 remove the last MV2 escape hatches: 2026-06-30 and 2026-07-28), multi-browser power users, managed-deployment operators, extension reviewers.
- Platforms/distribution: MIT; Chrome 130+ and Firefox 140+ MV3; Edge package built but store-blocked; AMO submission credential-blocked. Dev/release tooling on Node 24.16+/npm 11.13+.
- Integrations/data flows: `chrome.userScripts`/Firefox `userScripts`; IndexedDB + Storage Buckets; `chrome.storage.local`/`session`/`managed`; Monaco; cloud/Gist APIs; File System Access + observers; GreasyFork/OpenUserJS/GitHub discovery; SRI, Ed25519 + Sigstore provenance, SBOM/CRA release-trust tooling.

## Competitive Landscape

- **Tampermonkey 5.5.0** — Verified: the operational/compatibility bar (12M users, broad browser coverage). Its 2026 additions (`GM_audio`, request-scoped cookie partitioning, `anonymous`/initiator-cookie downloads, local-file disk-change watch, MCP via a separate opt-in editor extension) are matched by ScriptVault except the MCP surface. Learn from its compatibility discipline; avoid its closed-source opacity and any always-on MCP/agent control surface.
- **ScriptCat v1.4.0+** — Verified: the automation-primitive leader (`@background`, `@crontab`, `CAT_fileStorage`, `@storageName`, `@early-start`, `@definition`, AI Agent + MCP). ScriptVault already matches `@unwrap`, `onurlchange`, `CAT_userConfig`; DOM-less `@background`/`@crontab` remain the credential/architecture-blocked X-2. `CAT_fileStorage`/`@storageName`/`@definition` are genuine but niche gaps. Avoid the AI-Agent/MCP path that expands the trusted computing base.
- **Violentmonkey** — Verified: effectively stalled (stable 2.43 = 2024-07; MV3 still beta/unpublished). No 2026 revival; its ~600K Chrome users are the migration prize once MV2 hard-stops. Learn from its metadata/compat corpus; the opportunity is truthful migration + community outreach, not feature copying.
- **Tweeks (YC W25)** — Verified commercial signal: natural-language → sandboxed userscript proves demand for guided page modification, but generation is cloud-processed. Learn from its approachable review loop; avoid hosted generation that breaks zero-telemetry.
- **Userscripts for Safari** — Verified: directory-backed editing = ScriptVault's existing File System Access workspace binding; no `@resource`, so no gap. Safari/iOS remains a separate Swift/native-container platform effort, not a packaging task.
- **Stylus / FireMonkey** — Verified analogous: richer userstyle variable UIs and live preview. Directly relevant because ScriptVault's own UserCSS engine is shipped-but-unreachable (below); finish that before chasing Stylus-depth style ergonomics.

## Security, Privacy, and Reliability

- Verified — **Persistent UserCSS is unreachable dead code.** `src/modules/userstyles.ts` exports `registerStyle`/`toggleStyle`/`updateCSS`/`importUserCSS`/`importStylusBackup`/`onTabUpdated`/`onTabRemoved`/`isUserCSSUrl`, but none is wired to a message-router action or a `tabs`/`webNavigation` listener in the generated background. Only `userStylePreviewDraft`/`userStyleClearPreview` are reachable (`background.js:11843-11883`, `pages/dashboard.js:13364/13392`). A documented feature (README `.user.css` support) is non-functional beyond ephemeral preview.
- Verified — **Update path skips body re-analysis.** `applyUpdate` (`src/background/core.ts:1980-2094`) gates `@require` TOFU-SRI (`_getRequireTofuSriFailure`) and provenance, and flags cross-registry source changes (`sourceIdentityChanged`, `core.ts:2063-2067`), but never calls `ScriptAnalyzer.analyzeAsync` on `newCode`. A malicious update from the *same* author/registry (account-takeover propagation) applies without a risk-delta review.
- Verified — **UserCSS preview leaks.** Closing/navigating the dashboard leaves injected preview CSS on the target page: the only teardown is a `beforeunload` unsaved-changes guard (`pages/dashboard.js:18152-18155`); no `pagehide`/`visibilitychange` clears the preview (the DevTools panel does — `devtools-panel.js:376`). `onTabUpdated` (`userstyles.ts:1453-1474`) re-runs `insertCSS` even when the CSS is unchanged (duplicate stacking). Active-tab switch during preview (`dashboard.js:13373-13417`) orphans the prior tab's sheet.
- Verified — **Template tokens carry unsanitized page data.** `resolveTemplateTokens` (`pages/dashboard.js:13644-13676`) substitutes `activeTab.title` (page-controlled) into new-script source via `split/join` with no CR/LF stripping; a crafted multi-line `document.title` can append lines past the `@name` directive. Low impact (user reviews before save) but untrusted data reaches executable source.
- Verified — **One real dependency CVE.** `esbuild ^0.28.0` is below the `0.28.1` fix for GHSA-G7R4-M6W7-QQQR (Windows dev-server path traversal / arbitrary file read, CVSS 7.5). All other deps are ahead of their vulnerable bands (`npm audit` 0); the `dompurify@3.4.11` override is correctly above the active 3.x mXSS series.
- Verified — **No confidential disclosure path.** No `SECURITY.md`; GitHub private vulnerability reporting was previously observed disabled. CRA vulnerability/incident reporting begins 2026-09-11; an individual MIT maintainer is outside manufacturer obligations (OSS carve-out) but the disclosure channel is now baseline expectation and cheap.
- Verified — **No permission-drift gate.** `store-copy:check` verifies disclosure coverage, not growth. Nothing fails the build if `host_permissions`/`permissions` expand — the exact vector abused by 2026 CWS ownership-transfer/permission-creep attacks (QuickLens, ShotBird).

## Architecture Assessment

- `src/background/core.ts` remains the ~15.8k-line `@ts-nocheck` bridge with a large `handleMessage` switch; typed domain routing has landed for most action families but the UserStyles domain was never given router entries — the cleanest place to either complete or retire that subsystem.
- `pages/dashboard.js` (~19k lines) concentrates the preview-lifecycle bugs above; its preview teardown is scattered across ~6 call sites with no single owner, which is why the dashboard-close path was missed. A small `userCssPreview` controller with one teardown entry would close all three leaks.
- Release trust tooling is strong (`check-cra-sbom.mjs`, `release-trust-gate.mjs` already produce an SBOM + provenance) — SBOM is *not* a gap. The gap is a build-chain execution-guard (`.npmrc ignore-scripts`) against lifecycle-script npm worms (Shai-Hulud/Mini-Shai-Hulud, 2026 H2), which zero *runtime* deps does not defend against at install time.
- Backups still store full ZIP blobs in `chrome.storage.local` (noted in CLAUDE.md). The Baseline Compression Streams API (gzip/brotli) can shrink that footprint with no new dependency.
- UI has begun adopting Baseline primitives (Popover in `dashboard-workbench.css`/`popup.html`); a broad UI-modernization item is unwarranted — the primitives are already entering the codebase incrementally.

## Rejected Ideas

- MCP endpoint / in-app AI agent (Tampermonkey 5.5, ScriptCat 1.4) — expands the trusted computing base; hands an external agent read/control over scripts. Only defensible as strictly opt-in, off-by-default, loopback-only, user-supplied endpoint — and even then it is credential/architecture-blocked (see `Roadmap_Blocked.md` L-3). Source: TM changelog; ScriptCat 1.4.0.
- Cloud NL→script generation (Tweeks `TW_inference`) — sends page context to a backend; breaks zero-telemetry. Source: tweeks.io.
- `@background`/`@crontab` DOM-less scheduled scripts — genuine ScriptCat differentiator but already tracked and CWS-remote-code-blocked (X-2). Not re-added.
- `publicSuffix` API / Firefox `file://` opt-in / Signature-Based-SRI `@require` — already in `Roadmap_Blocked.md`; the first two need Firefox 153 (unshipped until ~2026-07-21), the third needs a CDN that actually sends RFC 9421 `Signature` headers (none does yet). Source: FF153 notes; WICG signature-based-SRI.
- Broad UI framework/modernization pass — Popover/anchor/container-query adoption is already happening file-by-file; a sweeping rewrite adds churn without a verified problem. Source: local CSS.
- Adding a runtime dependency for anything above — the zero-runtime-dep posture is a differentiator; every recommended item is achievable dev/CI-side or with Baseline platform APIs.
- CycloneDX SBOM item — already generated by `scripts/check-cra-sbom.mjs` + `release-trust-gate.mjs`. Not a gap.

## Sources

Competitors and ecosystem:
- https://www.tampermonkey.net/changelog.php?version=5.5.0
- https://github.com/scriptscat/scriptcat/releases
- https://docs.scriptcat.org/en/docs/change/
- https://docs.scriptcat.org/docs/dev/meta/
- https://github.com/violentmonkey/violentmonkey/issues/1934
- https://www.tweeks.io/
- https://github.com/quoid/userscripts
- https://github.com/awesome-scripts/awesome-userscripts

Platforms, standards, releases:
- https://developer.chrome.com/blog/chrome-userscript
- https://developer.chrome.com/docs/extensions/reference/api/userScripts
- https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/153
- https://blog.mozilla.org/addons/2026/04/23/webextensions-api-changes-firefox-149-152/
- https://developer.chrome.com/docs/extensions/develop/migrate/mv2-deprecation-timeline
- https://developer.chrome.com/blog/cws-policy-updates-2026
- https://developer.chrome.com/docs/webstore/program-policies/user-data-faq
- https://extensionworkshop.com/documentation/publish/source-code-submission/
- https://developer.mozilla.org/en-US/docs/Web/API/CompressionStream/CompressionStream
- https://developer.mozilla.org/en-US/docs/Web/API/HTML_Sanitizer_API
- https://developer.chrome.com/blog/introducing-popover-api
- https://wicg.github.io/signature-based-sri/

Security, supply chain, compliance:
- https://github.com/advisories/GHSA-g7r4-m6w7-qqqr
- https://github.com/advisories/GHSA-5xrq-8626-4rwp
- https://github.com/cure53/DOMPurify/wiki/Attack-Classes-&-Bypass-History
- https://pluto.security/blog/chrome-extension-supply-chain-attacks-permission-creep/
- https://www.microsoft.com/en-us/security/blog/2025/12/09/shai-hulud-2-0-guidance-for-detecting-investigating-and-defending-against-the-supply-chain-attack/
- https://labs.cloudsecurityalliance.org/research/csa-research-note-shai-hulud-ai-supply-chain-20260517-csa-st/
- https://digital-strategy.ec.europa.eu/en/policies/cra-open-source
- https://www.mend.io/blog/eu-cyber-resilience-act-compliance-guide/
- https://www.waze.com/discuss/t/urgent-two-scripts-were-compromised-on-feb-1-please-read-if-you-use-scripts/365499
- https://anchore.com/sbom/eu-cra/

## Open Questions

- **Needs live validation** — Is persistent UserCSS an in-progress feature that lost its wiring, or intentionally preview-only? The fix (wire it vs. gate it off and correct the README) depends on the maintainer's intent.
- **Needs live validation** — Will the maintainer enable GitHub private vulnerability reporting and commit to a coordinated-disclosure window? Blocks a truthful `SECURITY.md`.
- **Needs live validation** — Is ScriptVault operated in any commercial capacity, or purely as an individual MIT project? Determines whether CRA "manufacturer"/"steward" duties apply beyond the voluntary disclosure channel.
