# Research — ScriptVault

Date: 2026-07-01 — replaces all prior research.

## Executive Summary

ScriptVault is a mature, trust-first Chrome MV3 userscript manager (v3.12.0): open-source, local-first, zero-telemetry, with Monaco editing, a 35+ function GM API, static AST risk analysis, update review with diff+rollback, Ed25519 signing + Sigstore provenance, seven cloud sync providers, IndexedDB Storage Buckets, enterprise managed-policy provisioning, and a 182-file local test suite. The prior research pass's headline opportunities are now **resolved** (the resurrected GitHub Actions workflow is gone and gated by `scripts/check-no-github-actions.mjs`; `npm audit` is clean; the Firefox lint budget is formalized at 80). The product is past broad feature-catching-up; the highest-value direction is **reliability and trust depth on the paths users actually hit**: a per-tab "why didn't my script run?" diagnostic (the single strongest, most-corroborated community pain), storage/backup compression, and optionally narrowing the `<all_urls>` blast radius — all implementable client-side with no backend.

Top opportunities in priority order:
1. Per-tab, per-script run diagnostic ("matched / enabled / injected / why-not") — turns the #1 support burden into a feature.
2. Compress backups and stored script bodies (CompressionStream) to cut Storage Buckets quota and fix the known oversized-backup-blob issue.
3. Optional per-site host permissions to shrink the `<all_urls>` grant for privacy-conscious users (large, must stay user-controlled).
4. Adopt `Element.setHTML()` (feature-detected) for real sanitization of GreasyFork/API-fetched HTML rendered in the manager UI.
5. `@crontab once(...)` one-time schedules (small parity extension).
6. Spike a local MCP bridge exposing script CRUD to a user's own agent (zero-inference, differentiator) — validate before committing.
7. Continue the already-scoped dev-workflow work (external-editor file binding X-8; add localhost dev-server hot-reload as an X-8 extension).

## Product Map

- Core workflows: install/import userscripts, review metadata + AST risk, edit in Monaco, register via `chrome.userScripts` (USER_SCRIPT world, per-script `worldId`), expose GM APIs, review updates with diff/rollback, sync/backup scripts + GM values, inspect network/execution diagnostics, package Chrome/Firefox/Edge.
- Personas: privacy-conscious userscript users, MV2-era migrants, script authors, extension reviewers, enterprise operators (managed policy), multi-device sync users.
- Platforms/distribution: Chrome MV3 (published), Firefox AMO (validation, Phase 5), Edge (package path), local release artifacts; Firefox Android and Safari deferred (API gaps).
- Integrations/data: IndexedDB + Storage Buckets (scripts, GM values, stats, backups, bindings); `chrome.storage.local` (settings, receipts, managed policy); `chrome.storage.session` (session-only sync secrets); offscreen/Firefox fallbacks for AST + merge; WebDAV/Drive/Dropbox/OneDrive/S3/Gist/EasyCloud sync; CWS/AMO reviewer-evidence tooling.

## Competitive Landscape

- Tampermonkey (5.5.0, closed-source): strongest incumbent — external-editor file tracking, MCP server, OS/policy provisioning, badge/execution-state display modes. Learn from its dev-workflow polish and execution-state visibility; avoid closed-source trust opacity. Most of its GM/directive surface (GM_getValues, @tag, @run-in, GM_audio, GM_download, GM_getTab) ScriptVault already matches.
- ScriptCat (v1.4.0, MV3-native): background/scheduled scripts, `crontab once(...)`, `@early-start`, an AI Agent + MCP, multi-engine discovery. Learn from schedule vocabulary and one-time cron; avoid the built-in hosted-AI dependency (conflicts with zero-telemetry).
- Violentmonkey (open-source, no Chrome MV3): its issue tracker is a goldmine of unmet needs — blank-state sync overwrite (#590), OAuth rot (#2254/#389), fused check-and-apply update (#1023), no update diff (#500), GM value data sync (#48). ScriptVault already answers most of these; use them to validate the reliability focus.
- Userscripts for Safari: directory-of-files model (whole library as `.user.js` on disk, edited by any external editor). Learn the directory-store idea for the dev-workflow track; avoid the Safari platform dependency itself.
- vite-plugin-monkey: userscript dev tooling with a localhost dev server + `.meta.js` HMR. Learn the hot-reload-from-localhost pattern (fits the external-editor track); nothing to avoid.
- Tweeks.io (AI-native, YC W25): natural-language → DOM transforms. Learn the demand signal; avoid the hosted-inference architecture — only viable here as bring-your-own-endpoint.

## Security, Privacy, and Reliability

- `npm audit --audit-level=moderate --omit=optional`: **0 vulnerabilities** (2026-07-01). Dependency stack fully patched: `esbuild` resolves to 0.28.1 (0.28.0's GHSA-gv7w-rqvm-qjhr / GHSA-g7r4-m6w7-qqqr avoided), `dompurify` pinned at 3.4.11 (covers the June 2026 IN_PLACE/cross-realm advisory cluster), `vitest` 4.1.9 (CVE-2026-47429 backport-patched — do NOT chase 5.0-beta), `fflate` vendored as `lib/fflate.js` under the provenance gate. No dependency roadmap action needed.
- `<all_urls>` static `host_permissions` (`manifest.json:37-38`) is the largest privacy surface. `src/background/host-permission-patterns.ts` already computes per-URL patterns; moving to `optional_host_permissions` with per-script grants is a real differentiator but large and behavior-risky (breaks update/GM_xmlhttpRequest scoping if done naively). Must stay default-scoped with explicit, plain-language broad-access opt-in.
- Reliability wins already shipped this cycle: cloud-sync 3-way merge no longer dead-gates to last-write-wins, restore-from-trash survives remote tombstones, and GM values are isolated per authenticated `userScriptId` (see 2026-07-01 CHANGELOG). Community's top sync data-loss classes (blank-state overwrite, tombstone resurrection) are now addressed; OAuth-rot resilience (Violentmonkey #2254) is partially covered by PKCE/refresh-token flows.
- Chrome 138+ "Allow User Scripts" is a per-extension toggle that defaults OFF on new installs and makes `chrome.userScripts` `undefined` when off — a silent first-run break. The setup-doctor work (N-7) covers rehydration; new-user onboarding should deep-link the toggle, and the proposed run-diagnostic should name this as a cause.
- The `safeSetHtml` helpers (fixed 2026-07-01 to anchor the parse range) still rely on a Trusted-Types passthrough, not real sanitization. `Element.setHTML()` (Chrome ~146 / Firefox 148) would add genuine sanitization for GreasyFork/API-fetched HTML — feature-detect, too new to rely on unconditionally.

## Architecture Assessment

- Source ownership is clear: TypeScript-authoritative `src/**`, generated runtime artifacts (`modules/*.js`, `background.core.js`, `background.js`), dashboard modules in `pages/**`. Generated files stay generated.
- `src/background/core.ts` remains the largest boundary; continue shrinking via typed handler extraction, not rewrites.
- `pages/dashboard.js` (~16.7k lines) is large but lazy-loaded and tested; a run-diagnostic should be a new focused module, not more dashboard bulk.
- `BackupScheduler` stores full ZIP blobs in `chrome.storage.local` (CLAUDE.md Known Issues) — CompressionStream + Storage-Bucket relocation is the direct fix.
- Test/doc gaps: no per-tab injection-state coverage exists (the run-diagnostic would need it); dependency-drift and Firefox-warning items from prior research are now stale and should not be re-raised.

## Rejected Ideas

- Built-in hosted AI script generation (Tweeks, ScriptCat AI Agent): sending page/script context to a hosted model conflicts with zero-telemetry. Only viable as bring-your-own local/OpenAI-compatible endpoint. Source: tweeks.io, docs.scriptcat.org.
- In-app conversational AI editing now: viable only BYO-key; revisit when on-device LLMs are practical (matches existing UC-3). Source: docs.scriptcat.org.
- Safari port / MV2 shims: Safari lacks the `userScripts` shape; MV2 is terminally removed at Chrome 139. Source: quoid/userscripts, Chrome MV2 timeline.
- vitest 5.0-beta upgrade: still beta; CVE-2026-47429 already backported to 4.1.x. Source: GHSA-5xrq-8626-4rwp.
- `@early-start` "earlier than document-start": MV3 injection floor is document_start (`injectImmediately`); nothing earlier is exposed. Source: chrome.userScripts docs.
- Re-adding remote CI / dependency-drift / Firefox-148-warning burndown: all resolved since the prior pass. Source: repo state (`scripts/check-no-github-actions.mjs`, clean `npm audit`, WARNING_BUDGET=80).

## Sources

Competitors:
- https://www.tampermonkey.net/changelog.php
- https://www.tampermonkey.net/documentation.php
- https://github.com/Tampermonkey/tampermonkey-mcp
- https://docs.scriptcat.org/en/docs/change/
- https://github.com/quoid/userscripts
- https://github.com/lisonge/vite-plugin-monkey
- https://news.ycombinator.com/item?id=45916525

Community pain (Verified issues):
- https://github.com/violentmonkey/violentmonkey/issues/590
- https://github.com/violentmonkey/violentmonkey/issues/2254
- https://github.com/violentmonkey/violentmonkey/issues/1023
- https://github.com/violentmonkey/violentmonkey/issues/500
- https://github.com/violentmonkey/violentmonkey/issues/48
- https://github.com/Tampermonkey/tampermonkey/issues/2536
- https://github.com/Tampermonkey/tampermonkey/issues/2086
- https://github.com/Tampermonkey/tampermonkey/issues/1265
- https://greasyfork.org/en/discussions/development/247083

Platform / specs:
- https://developer.chrome.com/docs/extensions/reference/api/userScripts
- https://developer.chrome.com/blog/chrome-userscript
- https://developer.chrome.com/docs/extensions/whats-new
- https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code
- https://developer.mozilla.org/en-US/docs/Web/API/HTML_Sanitizer_API
- https://developer.mozilla.org/en-US/docs/Web/API/Compression_Streams_API
- https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/userScripts
- https://extensionworkshop.com/documentation/publish/source-code-submission/
- https://w3c.github.io/charter-drafts/2025/webextensions-wg.html

Security / dependencies:
- https://github.com/advisories/GHSA-5xrq-8626-4rwp
- https://github.com/advisories/GHSA-hpcv-96wg-7vj8
- https://github.com/evanw/esbuild/releases
- https://cheatsheetseries.owasp.org/cheatsheets/Browser_Extension_Vulnerabilities_Cheat_Sheet.html

## Open Questions

- Would raising `minimum_chrome_version` from 130 to 138 (clean "Allow User Scripts" toggle semantics + structured-clone messaging) cut off a meaningful user share? Needs install-base data only the maintainer has.
- Is per-site optional host permissions worth the update/GM_xmlhttpRequest scoping complexity, or does the install-review + trust-receipt model already satisfy the privacy wedge? Needs a user-demand signal.
- AMO submission feedback remains unknowable until maintainer credentials exist and the package is submitted.
