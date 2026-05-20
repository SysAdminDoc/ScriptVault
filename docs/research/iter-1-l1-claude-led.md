# Iteration 1 — L1 Research (Claude-led, codex-direct timed out)

**Date:** 2026-05-19
**Mode:** single-session, large-repo-mode
**Degradation:** codex-direct.sh `audit` phase timed out at 420s (model was
actively executing tool calls — transcript shows successful rg invocations —
but didn't return final synthesis in time). Per recipe rule, master Claude
conducted L1 in its place using the in-session audit context (12 findings
already shipped this session across 3 hardening commits + 1 P0 prototype
pollution fix).

## Delta since Round 13 (2026-05-18)

External signal window: ~24 hours. Per recipe "Iteration 2+: DELTA scan
only — new releases / CVEs / feature drops since last iter", treating this
as iter-2 since Round 13 just ran one day ago. Net-new public signal in 24h
is bounded; no notable CVE feed entries on monaco-editor, fflate,
chrome-webstore-upload-cli, or vitest. Tampermonkey/Violentmonkey/ScriptCat
have no releases dated 2026-05-19. Skipping the full nine-source scan as
non-productive.

## In-session signal — items uncovered during the audit pass but not yet shipped

Ranked by leverage × tractability. Top 3 selected for LR2 implementation
(Large-Repo Mode cap).

### LR-001 (P1) — OAuth refresh paths have no AbortController/timeout
**Files:** [modules/sync-providers.js:87-118](modules/sync-providers.js) (Google),
~line 444-485 (Dropbox), ~line 678-720 (OneDrive).
**Risk:** `refreshToken()` calls `fetch(oauthEndpoint, {body: ...})` with no
signal. On a slow/dead network, the call hangs until the network layer gives
up (minutes). Any caller pattern `const t = await refreshToken(); ...`
blocks for that duration. The SW death timer (~5min) doesn't help — the
refresh promise stays in flight until either resolution or the SW dies.
**Fix:** Wrap each refresh in `AbortController` + `setTimeout(controller.abort, 15000)` +
`try/finally clearTimeout`. Same pattern already used elsewhere
(`background.core.js` XHR handler, `modules/resources.js`).
**Effort:** 30 min. **Risk of regression:** low — additive guard.

### LR-002 (P1) — ResourceCache concurrent-fetch wastes bandwidth + races
**File:** [modules/resources.js:54-105](modules/resources.js) `fetchResource`.
**Risk:** If two scripts request the same `@require` URL simultaneously,
both pass the `cached = await this.get(url); if (cached) return ...` check
(cache miss), both call `fetch()`, both write to cache. Network bandwidth
doubled; the second write clobbers the first (last-write-wins). For a
popular `@require` URL like a CDN-hosted library, this hits on every
host page load with multiple scripts.
**Fix:** Add `_pendingFetches: Map<url, Promise<text>>`. On entry,
`if (this._pendingFetches.has(url)) return this._pendingFetches.get(url)`.
Otherwise create the promise, store it, await, clear from map in finally.
Pattern already used in `background.core.js` for userscript install dedup.
**Effort:** 20 min. **Risk of regression:** low — same well-tested pattern.

### LR-003 (P1) — AST analyzer misses indirect-eval and dynamic-property sinks
**File:** [offscreen.js:40-200](offscreen.js) RISK_PATTERNS array.
**Risk:** Detector `match: node => node.type === 'CallExpression' && isIdent(node.callee, 'eval')`
only catches direct `eval(x)` calls. Real-world obfuscation uses
`(0,eval)(x)` — a SequenceExpression with `eval` as the second item — to
get indirect eval (which runs in global scope, bypassing the script's
local closure). Also `window['ev'+'al'](x)` and `setTimeout.apply(null, [x])`
with eval-equivalent payloads. Per Round 13 audit notes the AST path has
false-negatives in this category.
**Fix:** Add three detectors:
1. `indirect-eval`: CallExpression where callee is SequenceExpression
   whose last expression is identifier `eval`.
2. `dynamic-property-eval`: MemberExpression with `computed: true` and a
   non-Literal property (e.g. `window[x](y)` where x is non-static).
3. `function-ctor-apply`: CallExpression on `Function.prototype.apply` /
   `.call` / `.bind` (any callee whose .object resolves to Function).
**Effort:** 40 min including AST node-shape tests.
**Risk of regression:** low — additive risk patterns only.

## Items considered but deferred this run

- **DNS rebinding on web-install** — needs post-fetch IP verification
  pipeline. Multi-week effort.
- **xhrEvent privacy via postMessage bridge** — needs migration to
  `chrome.runtime.onUserScriptMessage` (Chrome 131+) and dropping the
  bridge entirely. Multi-day refactor.
- **dashboard-csp.js hash-based ruleId collisions** — typical user has
  <20 bypass hostnames; collision rate ~0.2%. Real but low-impact.
- **chrome-webstore-upload-cli v4 OIDC custody** — needs GCP federation
  credentials; not autonomously achievable.

## Bucketing (Round 13 framework — Fit/Impact/Effort/Risk/Dependencies/Novelty)

| Item | Tier | Fit | Impact | Effort | Risk | Deps | Novelty |
|------|------|-----|--------|--------|------|------|---------|
| LR-001 OAuth abort | Now | 5 | 3 | 1 | 1 | 0 | 1 |
| LR-002 Resource dedup | Now | 5 | 3 | 1 | 1 | 0 | 2 |
| LR-003 AST detectors | Now | 5 | 4 | 2 | 1 | 0 | 3 |
| DNS rebinding | Later | 4 | 4 | 5 | 3 | 1 | 4 |
| xhrEvent privacy | Later | 5 | 5 | 5 | 4 | 2 | 4 |
| CSP ruleId collision | UC | 3 | 1 | 2 | 1 | 0 | 1 |
| OIDC custody | Blocked | 4 | 3 | 4 | 2 | 5 | 2 |
