# Research — ScriptVault

Date: 2026-07-02 — replaces all prior research (previous pass 2026-07-01, v3.12.0).

## Executive Summary

ScriptVault is a mature, trust-first, local-first, zero-telemetry Chrome MV3 userscript manager (now v3.16.0). Since the last research pass it shipped a per-tab run diagnostic, a functional 3-way cloud-sync merge, a full editor redesign, removal of the Script Store, and a deep security/data-safety audit (GM handler caller-authentication, attribute-injection XSS fixes, sync tombstone-resurrection fix, Chrome-as-Firefox misdetection fix). The prior pass's headline opportunities are now shipped. The product is past feature-catching-up; the field has moved and the highest-value direction for 2026 is **(a) turning its existing Ed25519/AST/trust story into enforced guarantees, and (b) a single, identity-consistent leapfrog: on-device AI via Chrome's built-in Prompt API (Gemini Nano), which is stable for extensions since Chrome 138 and runs fully locally with no network egress — exactly the precondition UC-3 was waiting for.** ScriptCat is racing to a cloud AI agent; a keyless, telemetry-free local one wins on the axis ScriptVault already owns.

Top opportunities in priority order:
1. Enforce/warn on un-pinned `@require`/`@resource` (SRI is currently optional — `verifySRI` returns true when no hash is declared). Complements existing signing; directly counters 2026 scam-script campaigns.
2. On-device AI module (Prompt API / Gemini Nano): explain-this-script, plain-language AST risk summary, draft-a-script — strictly opt-in, feature-detected, local-only. Promotes UC-3 (its precondition is now met).
3. `GM.fetch` — a `Response`/`ReadableStream`-shaped fetch API (streaming, real headers). Absent today; the modern shape every competitor still lacks.
4. Per-script isolated cookie jars (`isolationCookie`) — a novel privacy differentiator a local-first manager can offer with no backend.
5. One-click "restrict this script to the current site" + inline domain editor with validation — cheap, high-satisfaction match-management UX users repeatedly ask for.
6. Scam/crypto-drain AST detector category + install-time warning — extends the existing 31-detector analyzer against an active 2026 threat.
7. Local-folder sync + plain git-remote sync, and File System Observer event-driven hot-reload (upgrades the existing poll-based local-file binding, X-8).

## Product Map

- Core workflows: install/import userscripts → review metadata + AST risk → edit in Monaco → register via `chrome.userScripts` (USER_SCRIPT world, per-script `worldId` on Chrome 133+) → expose 35+ GM APIs → review updates with diff/rollback → sync/backup scripts + GM values → inspect per-tab run diagnostics and network/execution → package Chrome/Firefox/Edge.
- Personas: privacy-conscious userscript users, MV2-era migrants, script authors, extension reviewers, enterprise operators (managed policy), multi-device sync users.
- Platforms/distribution: Chrome MV3 (published), Firefox AMO (Phase 5, `FIREFOX-PORT.md`), Edge (package path); Safari and Firefox-Android deferred (API/effort).
- Integrations/data: IndexedDB + Storage Buckets (scripts, GM values, stats, backups, local bindings); `chrome.storage.local` (settings, receipts, managed policy); `chrome.storage.session` (session-only sync secrets); WebDAV/Drive/Dropbox/OneDrive/S3/Gist/EasyCloud sync; offscreen/Firefox fallbacks for AST + merge.

## Competitive Landscape

- **Tampermonkey** (closed-source incumbent): 2026 issue tracker shows loud demand for per-script cookie isolation (#2815), a network request-modification API (#2398/#2215), a streaming `GM.fetch` (#1278), and SR-accessible dashboard controls (#2813); it also can't install scripts when its own domain is down (#2675). Learn from its dev-workflow polish; ScriptVault's zero-phone-home posture already beats its offline-install and telemetry weaknesses — market that.
- **ScriptCat** (v1.4.0, 2026): shipping a cloud-leaning AI Agent + MCP + Skills (#1324), `@unwrap` (already in ScriptVault), `window.onurlchange` via Navigation API (already in ScriptVault), and `cron once(...)`. Learn the AI-copilot direction; avoid the hosted-inference dependency — do it on-device instead. Patched a prototype-pollution-via-user-config bug (beta.4); ScriptVault already guards `POLLUTED_KEYS` in `src/modules/script-config.ts:25`.
- **Violentmonkey** (2026 issues): ESM/module userscripts (#2528), cross-userscript `@require-local` (#2419), one-click "only for {site}" (#2410/#2403/#2559), one-click publish (#2425), hold-execution-until-sync (#2067), git-remote (#2176) and local-directory (#2125) sync. A concentrated backlog of match-management and sync UX ScriptVault can pick off cheaply.
- **GreasyFork** (catalog): still lacks enforced SRI on remote code (#1070) and documents a real cross-script/account-takeover propagation risk (#682). ScriptVault's signing + Storage Buckets isolation + *enforced* SRI would make it the clear security leader.
- **quoid/Userscripts (Safari)** + **vite-plugin-monkey**: directory-of-files model and localhost HMR — the pattern behind File System Observer hot-reload; learn the dev-loop, avoid the Safari platform dependency.

## Security, Privacy, and Reliability

- **SRI is optional, not enforced.** `src/background/resource-loader.ts:190` — `verifySRI` returns `true` when no hash is declared. A userscript with an un-pinned `@require https://cdn/...` silently trusts whatever the CDN serves. TOFU receipts exist but there is no warn/enforce mode. This is the single highest-leverage hardening given 2026 scam-script campaigns (Tampermonkey #2783) and GreasyFork's own unresolved SRI gap (#1070). Verified.
- **`<all_urls>` static host permission** (`manifest.json`) remains the largest privacy surface; `src/background/host-permission-patterns.ts` already computes per-URL patterns. Moving to `optional_host_permissions` with per-script grants is real but large and behavior-risky — already tracked (Research-Driven P2). Keep default-scoped with explicit broad-access opt-in.
- **GM networking concurrency** (Needs live validation): Tampermonkey (#2215) and ScriptCat (#1377) both hit MV3's "one header-modifying `GM_xmlhttpRequest` at a time via a global DNR rule" wall and moved to request-scoped rules. ScriptVault's cookie-routing uses session DNR rules (`withCookieHeaderSessionRule`); verify it does not serialize concurrent header-modifying requests, and prefer request-scoped rules.
- **Dependency posture** stays clean (prior pass: 0 `npm audit` vulnerabilities; `esbuild` 0.28.1, `dompurify` 3.4.11, `vitest` 4.1.9 with the CVE-2026-47429 backport — do not chase 5.0-beta). No dependency roadmap action.
- **Proto-pollution** in user-config is already guarded (`src/modules/script-config.ts:25`); the ScriptCat beta.4 class of bug does not apply here.

## Architecture Assessment

- Source ownership is clear and correct: TypeScript-authoritative `src/**` → generated runtime (`modules/*.js`, `background.core.js`, `background.js`) → dashboard modules in `pages/**`. **`src/background/core.ts` is a raw bridge** whose function bodies are copied verbatim by the runtime generator — no TS-only syntax (`as`, `: type`) inside those bodies (2026-07-02 finding). Several functions have live copies inlined in `core.ts` and dead extraction copies in `src/background/*.ts` (import/register/firefox-detect); fix the live `core.ts` version.
- An on-device AI feature must be a **new lazy-loaded module** (feature-detected via `LanguageModel.availability()`), never a hard dependency — the Gemini Nano model is a 2.7–4 GB download needing ~16 GB RAM / 4 GB VRAM. It degrades to "unavailable" cleanly.
- `BackupScheduler` still stores full ZIP blobs uncompressed (CompressionStream fix already tracked P2). `pages/dashboard.js` (~16.7k lines) is large but lazy-loaded; new features should be focused modules, not dashboard bulk.
- Test/doc gaps: no per-script-cookie-isolation, SRI-enforcement, or AI-availability coverage exists yet (those features would need it); the stale "editor cursor stuck at Ln 1, Col 1" roadmap item in the Next tier was fixed in v3.16.0 and should be treated as resolved.

## Rejected Ideas

- Cloud/hosted AI agent (ScriptCat #1324, Tweeks.io): conflicts with zero-telemetry. Only the on-device Prompt API path is acceptable. Source: github.com/scriptscat/scriptcat/pull/1324.
- Mandatory (hard-fail) SRI on every `@require`: would break the large body of existing un-pinned scripts on install; ship as warn-by-default + opt-in enforce instead. Source: greasyfork #1070, resource-loader.ts:190.
- `@unwrap`, `@run-at context-menu`, `window.onurlchange`, `cron once(...)`-parsing, proto-pollution guard: already implemented/guarded in ScriptVault — do not re-add. Source: parser.ts:313, context-menu.ts, wrapper-builder.ts, script-config.ts:25.
- Full ESM module-world userscripts with top-level `import` (VM #2528): interesting but niche and large; keep in Under Consideration until demand is concrete. Source: violentmonkey #2528.
- Safari port / MV2 shims: Safari lacks the `userScripts` shape; MV2 is dead by ~Chrome 150. ScriptVault is already MV3-native. Source: MV2 deprecation timeline.
- vitest 5.0-beta upgrade: still beta; CVE-2026-47429 already backported to 4.1.x. Source: GHSA-5xrq-8626-4rwp.

## Sources

Competitors / issue trackers:
- https://github.com/Tampermonkey/tampermonkey/issues/2815
- https://github.com/Tampermonkey/tampermonkey/issues/2398
- https://github.com/Tampermonkey/tampermonkey/issues/2215
- https://github.com/Tampermonkey/tampermonkey/issues/1278
- https://github.com/Tampermonkey/tampermonkey/issues/2783
- https://github.com/Tampermonkey/tampermonkey/issues/2675
- https://github.com/Tampermonkey/tampermonkey/issues/2813
- https://github.com/scriptscat/scriptcat/releases/tag/v1.4.0
- https://github.com/scriptscat/scriptcat/pull/1324
- https://github.com/scriptscat/scriptcat/pull/1377
- https://github.com/violentmonkey/violentmonkey/issues/2528
- https://github.com/violentmonkey/violentmonkey/issues/2410
- https://github.com/violentmonkey/violentmonkey/issues/2425
- https://github.com/violentmonkey/violentmonkey/issues/2067
- https://github.com/violentmonkey/violentmonkey/issues/2176
- https://github.com/violentmonkey/violentmonkey/issues/2125
- https://github.com/JasonBarnabe/greasyfork/issues/1070
- https://github.com/JasonBarnabe/greasyfork/issues/682

Platform / specs / APIs:
- https://developer.chrome.com/docs/ai/prompt-api
- https://developer.chrome.com/docs/ai/built-in
- https://developer.chrome.com/blog/file-system-observer
- https://developer.chrome.com/docs/extensions/reference/api/userScripts
- https://developer.chrome.com/blog/chrome-userscript
- https://developer.chrome.com/docs/extensions/develop/migrate/mv2-deprecation-timeline
- https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/userScripts
- https://developer.mozilla.org/en-US/docs/Web/API/FileSystemObserver
- https://web.dev/blog/same-document-view-transitions-are-now-baseline-newly-available
- https://web.dev/baseline

## Open Questions

- Does ScriptVault's cookie-routing session-DNR path serialize concurrent header-modifying `GM_xmlhttpRequest` calls (the #2215 class), or already run them request-scoped? Needs live validation before scoping the concurrency item.
- Would gating the on-device AI module behind `LanguageModel.availability()` reach a meaningful share of the user base, given the ~16 GB RAM / model-download requirement? Needs install-base/hardware data only the maintainer has.
- Is enforced-SRI warn-by-default acceptable UX, or will it flag too many legitimate un-pinned CDN `@require`s to be useful? Needs a corpus check against common installed scripts.
