# Research — ScriptVault
Date: 2026-07-22 — replaces all prior research. (Includes a same-day focused re-pass: AST-analyzer parse-version, update-queue storage bound, cookie-handler scope fallback.)

_Baseline: v3.22.0 (Chrome MV3 min 130 + Firefox MV3 140+), zero runtime dependencies, TypeScript 7.0.2, esbuild ^0.28.1, monaco-editor ^0.55.1, acorn 8.17.0, dompurify override 3.4.11. `npm audit` 0._

## Executive Summary

ScriptVault is a mature, local-first, zero-telemetry MV3 userscript manager that is at or ahead of GM-API parity with every competitor. The prior research cycle (2026-07-16, baseline v3.20.0) has **fully shipped**: persistent UserCSS install/management, the esbuild CVE bump, `SECURITY.md`, the permission-drift gate, npm-worm `.npmrc` hardening, template-token sanitization, backup gzip compression, and — verified this pass — the update-path AST risk-delta re-scan. A fresh competitive + platform sweep confirms there is **no missing table-stakes feature**: the competitor's headline 2026 additions (Tampermonkey `GM_audio`/cookie-partitioning/MCP-editor, ScriptCat `@background`/AI-Agent, Stylus `@var` config UI) are either already implemented, already tracked-and-blocked, or deliberately rejected on philosophy grounds. ScriptVault's UserCSS engine already renders typed `@var` controls (`renderUserCssVariableControl`), so the biggest apparent parity gap is a non-gap.

The real leverage this cycle is **(a) a wave of Firefox 153 unblocks** — FF153 shipped 2026-07-21 and cleared four items that sat in `Roadmap_Blocked.md` (`publicSuffix`, `file://` opt-in, `adoptedStyleSheets`, `userScripts.execute()`) — and **(b) finishing/hardening what already exists**: SPA re-matching for the new UserCSS engine, consolidating the update security gate at its apply choke point, honoring the parsed-but-unused UserCSS `@preprocessor` field, and a small set of cheap supply-chain/trust hygiene items keyed to imminent policy dates (CWS Limited-Use 2026-08-01, EU CRA 2026-09-11).

Top opportunities, in priority order:

1. Re-match persistent UserCSS on SPA in-page navigations — only `webNavigation.onCommitted` is wired; History-API route changes leave styles stale (`core.ts:9938`).
2. Consolidate update security gating at the `applyUpdate` choke point so direct-apply callers cannot bypass the 31-detector risk-delta re-scan (`core.ts:1980-2101` vs `core.ts:2185-2260`).
3. FF153 unblock — `publicSuffix` API for accurate eTLD+1 domain grouping (replaces the `getDomainRoot()` multi-level-TLD fallback).
4. FF153 unblock — real `file://` capability gating via `isAllowedFileSchemeAccess()` (now returns `true` when granted).
5. FF153 unblock — `adoptedStyleSheets` constructable-stylesheet injection for `GM_addStyle`/UserCSS into Shadow DOM.
6. Bump `monaco-editor` 0.55.1 → 0.56.0 so its bundled DOMPurify (3.4.5) clears CVE-2026-0540 natively instead of relying on the transitive override.
7. Honor the parsed-but-ignored UserCSS `@preprocessor` field (dep-free USO token substitution; explicit "unsupported" for Less/Stylus rather than silently applying raw source).
8. CI floor-pins for dompurify (≥3.3.2) and vitest (≥4.1.0) so a lockfile regression cannot reintroduce a fixed CVE.
9. CWS Limited-Use disclosure assertion (2026-08-01) — a repo check that no telemetry/analytics endpoint exists, plus an in-repo Limited-Use statement.
10. Housekeeping: stale `SECURITY.md` supported-versions table; legacy uncompressed backup-blob purge; a misleading rollback-depth comment.

Confidence: repository claims are **Verified** against source unless labeled. FF153 API claims are **Verified** (shipped 2026-07-21). Policy-date scope (CRA applicability to a free MIT extension) is **Likely/ambiguous**.

## Product Map

Core workflows:

- Install/import userscripts and `.user.css`, review metadata/permissions/provenance, approve or quarantine.
- Edit in Monaco; bind to local File System Access workspaces with `FileSystemObserver` auto-reload; register via the browser `userScripts` API.
- Execute a broad GM API surface (`GM.fetch`, `GM_audio`, request-scoped cookie partitioning, `CAT_userConfig`, `onurlchange`, `@unwrap`); collect local diagnostics; debug via DevTools panel; update through reviewed diffs with 5-deep rollback and AST risk-delta gating.
- Manage persistent UserCSS styles with typed `@var` controls; organize scripts/collections/subscriptions/schedules/chains/backups/trash; sync via WebDAV/Google Drive/Dropbox/OneDrive/S3/Gist/Easy Cloud with optional encryption; remain fully usable offline.

- Personas: privacy-conscious script users, script authors, MV2-refugee migrants (Chrome 150/151 remove the last MV2 paths, 2026-06-30 / 2026-07-28), multi-browser power users, managed-deployment operators, extension reviewers.
- Platforms/distribution: MIT; Chrome 130+ and Firefox 140+ MV3; Edge package built but store-blocked; AMO submission credential-blocked. Dev/release tooling on Node 24.16+/npm 11.13+.
- Integrations/data flows: `chrome.userScripts`/Firefox `userScripts`; IndexedDB + Storage Buckets (gzip); `chrome.storage.local`/`session`/`managed`; Monaco; cloud/Gist APIs; File System Access + observers; GreasyFork/OpenUserJS/GitHub discovery; SRI, Ed25519 + Sigstore provenance, SBOM/CRA release-trust tooling.

## Competitive Landscape

- **Tampermonkey 5.5.x** — Verified: the operational/compatibility bar (12M users). 2026 additions (`GM_audio`, cookie partitioning, `anonymous` downloads, disk-change watch, regex script search, MCP via a separate opt-in editor extension) are matched by ScriptVault except MCP. Reported to be entering maintenance mode (2026). Learn from its compatibility discipline; avoid its closed-source opacity and any always-on MCP/agent surface.
- **ScriptCat v1.4.0+** — Verified: the automation-primitive + AI leader (`@background`/`@crontab`, `CAT_fileStorage`, `@storageName`, `@definition`, AI Agent + MCP; 1.5.0-beta rebuilt a mobile UI). ScriptVault already matches `@unwrap`/`onurlchange`/`CAT_userConfig`; `@background`/`@crontab` remain the CWS-remote-code-blocked X-2. `CAT_fileStorage`/`@storageName`/`@definition` are genuine but niche gaps. Avoid the AI-Agent/MCP path that expands the trusted computing base.
- **Violentmonkey** — Verified: effectively stalled — MV3 is still only a CI/beta build in mid-2026 and never shipped stable; its highest-engagement open issues (notify-only updates #1023, script-data sync #48, streaming XHR #1328, GM mutex #1799) are the best-quality feature signal in the space. The opportunity is truthful migration + harvesting those requests, not copying VM's code.
- **Stylus** — Verified analogous, now directly relevant since ScriptVault ships UserCSS. ScriptVault already renders typed `@var` controls, so the remaining Stylus deltas are narrower: `@preprocessor` compilation (Less/Stylus/USO) and external-IDE live-reload for styles. Adopt only the dep-free subset (USO tokens, FSA reuse); a Less/Stylus compiler would add a runtime dependency ScriptVault deliberately avoids.
- **Tweeks (YC W25)** — Verified commercial signal: natural-language → sandboxed userscript. Proves demand for guided page modification, but generation is cloud-processed. Learn from its approachable review loop; avoid hosted generation that breaks zero-telemetry.
- **quoid/userscripts (Safari)** — Verified: folder-as-source-of-truth editing = ScriptVault's existing FSA workspace binding; a full "folder-primary" mode is the only marginal delta. Safari/iOS remains a separate Swift native-container effort, not a packaging task.

## Security, Privacy, and Reliability

- Verified — **The AST analyzer pins `ecmaVersion: 2022`, so modern-syntax scripts evade the 31-detector scan.** All six parse sites (`src/bg/analyzer.ts:713,715,790` and `offscreen.js:302,305,372`) call `acorn.parse(code, { ecmaVersion: 2022, ... })`. Any userscript using ES2023–2025 syntax — notably `using`/`await using` (Explicit Resource Management, parseable by acorn since 8.15) — throws on parse, hits the `parseError`/catch path, and degrades to the weaker regex fallback (`analyzeAsync` → `analyze(code)`, `analyzer.ts:144`). The full detector suite is silently skipped for exactly the kind of novel-syntax code most worth scanning. The vendored parser (`lib/acorn.min.js`, Acorn v8.17.0) already supports `ecmaVersion: 'latest'`, so the pin is the only limiter. Fail mode is degraded (regex still runs), not fail-open, but detection coverage is materially reduced.
- Verified — **Persistent UserCSS does not re-match on SPA navigations.** The engine wires only `webNavigation.onCommitted` (`src/background/core.ts:9938-9948`) plus `tabs.onRemoved`; `onHistoryStateUpdated`/`onReferenceFragmentUpdated` are not listened for. A UserStyle that should apply/unapply on a client-side route change won't update until a full document commit — styles bleed onto or miss non-matching SPA routes. Userscripts get `window.onurlchange` (`wrapper-builder.ts:2274`); UserCSS has no equivalent. (Editor-preview lifecycle leaks flagged last pass are **fixed** — `_draftPreviewTabs` clears on nav/close, `userstyles.ts:1511-1565`.)
- Verified — **Update security gating is split across two owners.** The 31-detector AST risk-delta now runs (`_computeUpdateRiskDelta`, `core.ts:2185-2219`; feeds `safeToApply`) — the prior "update skips body re-analysis" finding is **fixed** for the queue path. But the `applyUpdate` primitive (`core.ts:1980-2101`) independently re-gates only TOFU-SRI + provenance + source-identity; direct callers `forceUpdateScript` (`core.ts:6050`) and the `applyUpdate` message action (`core.ts:6453`) bypass the risk-delta. No current regression, but a future direct-apply caller could silently skip the AST re-scan — the gate belongs at the choke point.
- Verified — **`@preprocessor` is parsed but never applied.** `parseUserCSS` stores `preprocessor` (`userstyles.ts:507,1452`) but no code compiles `less`/`stylus`/`uso` — a style declaring `@preprocessor less` has its raw, uncompiled source applied. Silent wrong-behavior for imported Stylus/USO styles.
- Verified — **One real transitive CVE path.** `monaco-editor@0.55.1` still declares a DOMPurify range vulnerable to CVE-2026-0540 (GHSA-v2wj-7wpq-c8vv, mXSS, fixed in DOMPurify 3.3.2). The repo override `dompurify@3.4.11` covers the resolved tree today, but the fix is override-dependent; monaco 0.56.0 bundles DOMPurify 3.4.5 natively. No open advisory affects the shipped extension bundle (`npm audit` 0).
- Verified — **No lockfile floor-pins on fixed CVEs.** Nothing asserts `dompurify>=3.3.2` (incl. monaco's transitive copy) or `vitest>=4.1.0` (CVE-2026-47429, CVSS 9.8, fixed 4.1.0). A lockfile regression could silently reintroduce a fixed CVE.
- Verified — **`SECURITY.md` supported-versions table is stale** (`SECURITY.md:14-15` lists `3.20.x`; current is `3.22.0`). All other version strings are correct — SECURITY.md is the lone drift.
- Verified — **Legacy uncompressed backup blobs persist.** `backup-scheduler.ts:123` marks the inline `data` field `@deprecated` "pending migration"; old entries still carry uncompressed payloads that the gzip path (`_storeBackupBlob`, `backup-scheduler.ts:922-953`) does not retroactively purge.
- Verified — **Rollback-depth comment is wrong.** `core.ts:2015` comment says "keep last 3" while the trim keeps 5 (`core.ts:2024-2025`) — misleads maintainers reasoning about rollback depth.
- Likely — **GM_webRequest MV3 listener is a silent no-op** (`wrapper-builder.ts:2257`): it accepts a `listener` arg and only `console.info`s (DNR has no MV3 runtime callback). Scripts relying on the callback misbehave without a surfaced warning.
- Verified — **`pendingUpdates` is count-bounded but not size-bounded.** `_MAX_PENDING_UPDATES: 50` (`core.ts:1789`) caps entry count, but each entry carries the full new script `code` plus trust receipt, diff, and risk-delta blobs in a single `chrome.storage.local` key; 50 large scripts can approach storage pressure with no per-entry byte cap.
- Verified — **Cookie handler accepts a caller-supplied script id fallback.** `getCookieScript` uses `sender.userScriptId || data.scriptId` (`gm-cookie-handler.ts:108`). Host-scope policy is still enforced against the target URL, so this is not exploitable for cross-origin cookie theft, but a userscript can name a different script's id to have that script's host-scope evaluated; tighten to reject when `sender.userScriptId` is expected but missing.

## Architecture Assessment

- `src/background/core.ts` is a 15.5k-line `@ts-nocheck` bridge owning the message listener, GM_* background halves, update system, UserCSS wiring, cookie/network delegation, alarms, and init. Handler extraction has *started* (`gm-network-handler.ts`, `gm-cookie-handler.ts`, `message-router.ts` are split out and wired) but the bulk remains untyped. The update-gate split (above) is a concrete symptom: security gates should converge on one choke point. Highest-value long-term refactor; not a single roadmap item.
- `pages/dashboard.js` (~19.7k lines, plain hand-written JS, LF-pinned, no type checking) is the second god-file. No injection sinks found (UserCSS modals use `escapeHtml` consistently; `#usercss=` deep-links re-parse before install), but zero type safety over ~20k lines.
- Release-trust tooling is strong (`check-cra-sbom.mjs`, `release-trust-gate.mjs` already produce SBOM + provenance). SBOM is not a gap. The remaining trust work is policy-assertion (CWS Limited-Use, CRA incident runbook) and CI floor-pins, not new machinery.
- UI is adopting Baseline primitives (Popover) file-by-file; a broad modernization pass is unwarranted. FF153's `adoptedStyleSheets` is the one net-new platform primitive with a concrete correctness payoff (revertible Shadow-DOM style injection).

## Rejected Ideas

- **UserCSS `@var` typed-variable config UI** (Stylus) — NOT a gap; already implemented (`renderUserCssVariableControl`, `pages/dashboard.js:13584`; parser at `userstyles.ts:356-401`). Do not re-add. Source: openstyles/stylus wiki.
- **Less/Stylus preprocessor compilation** — requires a runtime compiler dependency, contradicting the zero-runtime-dep differentiator. Only the dep-free USO token subset is in-scope. Source: openstyles/stylus wiki/Usercss.
- **GM script-data sync (`GM_setValue` across devices)** — already tracked and blocked: `Roadmap_Blocked.md` L-8 (needs a merge-conflict-UX human decision). Not re-added. Source: violentmonkey#48.
- **Structured-clone messaging opt-in (Chrome 148)** — already in `Roadmap_Blocked.md` (public-extension-API compatibility decision + live-profile validation). Not re-added. Source: developer.chrome.com/blog/structured-clone-messaging.
- **MCP endpoint / in-app AI agent / NL→script generation** (Tampermonkey, ScriptCat, Tweeks) — expands the trusted computing base and/or ships an inference dependency, breaking zero-telemetry. Defensible only as strictly opt-in, off-by-default, loopback-only, user-supplied endpoint — and even then credential/architecture-blocked (L-3). Source: TM changelog; ScriptCat 1.4.0; tweeks.io.
- **`@background`/`@crontab` DOM-less scheduled scripts** — genuine ScriptCat differentiator, already tracked and CWS-remote-code-blocked (X-2). Not re-added. Source: docs.scriptcat.org/docs/dev/meta.
- **On-device Prompt API "explain this script"** — Chrome-148-desktop-only, extension surface still origin-trial-gated, 16GB-RAM/22GB-disk floor, plus the new CWS AI-safety clause; already parked in ROADMAP "Under Consideration (2026-07-16)". Keep experimental; do not schedule. Source: developer.chrome.com/docs/ai/prompt-api.
- **Signature-Based SRI for `@require`** — still no CDN emits RFC 9421 `Signature` headers; already in `Roadmap_Blocked.md`. Source: wicg.github.io/signature-based-sri.
- **Broad UI framework/modernization pass** — Popover/anchor/container-query adoption is already incremental; a rewrite adds churn without a verified problem.

## Sources

Competitors and ecosystem:
- https://www.tampermonkey.net/changelog.php
- https://github.com/scriptscat/scriptcat/releases
- https://docs.scriptcat.org/docs/dev/meta/
- https://github.com/violentmonkey/violentmonkey/issues/1023
- https://github.com/violentmonkey/violentmonkey/issues/48
- https://github.com/violentmonkey/violentmonkey/issues/1328
- https://github.com/violentmonkey/violentmonkey/issues/2340
- https://github.com/openstyles/stylus/wiki/Usercss
- https://github.com/quoid/userscripts
- https://www.tweeks.io/

Platforms, standards, releases:
- https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/153
- https://developer.chrome.com/blog/chrome-userscript
- https://developer.chrome.com/docs/extensions/reference/api/userScripts
- https://developer.chrome.com/blog/structured-clone-messaging
- https://developer.chrome.com/release-notes/150
- https://developer.mozilla.org/en-US/docs/Web/API/HTML_Sanitizer_API
- https://developer.chrome.com/docs/ai/prompt-api
- https://github.com/microsoft/monaco-editor/releases

Security, supply chain, compliance:
- https://github.com/advisories/GHSA-v2wj-7wpq-c8vv
- https://advisories.gitlab.com/npm/dompurify/CVE-2026-0540/
- https://github.com/advisories/GHSA-5xrq-8626-4rwp
- https://github.com/advisories/GHSA-67mh-4wv8-2f99
- https://github.com/advisories/GHSA-gv7w-rqvm-qjhr
- https://github.com/microsoft/monaco-editor/issues/5248
- https://developer.chrome.com/blog/cws-policy-updates-2026
- https://digital-strategy.ec.europa.eu/en/policies/cra-reporting
- https://extensionworkshop.com/documentation/publish/source-code-submission/
- https://github.com/acornjs/acorn/blob/master/acorn/CHANGELOG.md
- https://github.com/tc39/proposal-explicit-resource-management

## Open Questions

- **Needs live validation** — Firefox target bump: adopting `publicSuffix`/`isAllowedFileSchemeAccess`/`adoptedStyleSheets` cleanly requires min Firefox 153. Is the maintainer willing to raise the Firefox floor from 140 to 153 (with feature-detection fallbacks for 140-152), or must all four ship behind runtime detection only?
- **Needs live validation** — Is ScriptVault operated in any commercial capacity? Determines whether EU CRA "manufacturer/steward" duties (24h incident reporting from 2026-09-11) apply beyond the voluntary `SECURITY.md` channel already in place.
- **Needs live validation** — For UserCSS `@preprocessor`: is silently applying raw source for `less`/`stylus` an acceptable interim, or should such styles be rejected at import until (dep-free) compilation exists? Affects whether item is a warning or a hard block.
