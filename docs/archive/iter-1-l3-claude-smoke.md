# Iteration 1 — L3 smoke pass (Claude-led, codex-direct timed out)

**Date:** 2026-05-19
**Mode:** large-repo single-session
**Cadence:** smoke (not full debate) per LR-mode rule — full only on the
iteration that closes the last roadmap item.
**Degradation:** codex-direct.sh `review` phase timed out at 240s. Per
recipe: "Never halt the whole factory run on a single audit-phase failure."
Master Claude conducted L3 smoke against the PEC rubrics instead.

## LR-001 — OAuth refresh AbortController/timeout

**Rubric:** [.factory/rubrics/LR-001.yaml](.factory/rubrics/LR-001.yaml)

| AC | Status | Evidence |
|---|---|---|
| All 3 refresh paths use AbortController | ✅ | Helper `_oauthFetchWithTimeout` at modules/sync-providers.js line 6+; Google/Dropbox/OneDrive all routed through it |
| Timeout is 15 seconds | ✅ | Default param `timeoutMs = 15000` |
| setTimeout cleared in finally | ✅ | `finally { clearTimeout(timer); }` |
| On AbortError → returns null | ✅ | `if (e.name === 'AbortError'...) { return null; }` |
| JSON parse failure → returns null | ✅ | Existing handling preserved |
| Existing tests pass | ✅ | All 18 source-sync-providers tests still green |
| ≥1 new regression test | ✅ | 5 new cases in tests/oauth-refresh-timeout.test.js |

**Verdict:** PASS.

## LR-002 — ResourceCache concurrent-fetch dedup

**Rubric:** [.factory/rubrics/LR-002.yaml](.factory/rubrics/LR-002.yaml)

| AC | Status | Evidence |
|---|---|---|
| `_pendingFetches` Map keyed on URL | ✅ | modules/resources.js init at line 8 |
| Map check before issuing fetch | ✅ | `if (pending) return await pending` after cache-miss path |
| Promise stored BEFORE await | ✅ | `this._pendingFetches.set(url, fetchPromise);` is synchronous, before `await fetchPromise` |
| Map cleared in finally (success AND error) | ✅ | `finally { this._pendingFetches.delete(url); }` |
| Failed fetch does NOT poison subsequent | ✅ | Test "a failed concurrent fetch clears the pending map so the next caller can retry" passes |
| Existing 8 tests pass | ✅ | All resources tests still green |
| ≥1 new test | ✅ | 3 new cases (dedup, failure-recovery, cache-hit-short-circuit) |

**Verdict:** PASS.

## LR-003 — AST analyzer detectors

**Rubric:** [.factory/rubrics/LR-003.yaml](.factory/rubrics/LR-003.yaml)

| AC | Status | Evidence |
|---|---|---|
| 3 new RISK_PATTERNS entries | ✅ | offscreen.js indirect-eval (line ~50), dynamic-property-call (~70), function-ctor-apply (~94) |
| Match functions are defensive | ✅ | All three use optional chaining + early-return on missing shape |
| Pre-existing 62 analyzer tests pass | ✅ | analyzer.test.js all green |
| ≥3 new tests | ✅ | 26 new cases in analyzer-ast-detectors.test.js (positive + negative + malformed-AST + array integrity) |
| Total risk scoring unchanged for clean code | ✅ | Detectors are additive; pattern array integrity test pins unique ids |

**Verdict:** PASS.

## Smoke-pass conclusion

3/3 tasks PASS. No escalation to full debate (LR-mode rule satisfied — smoke
pass found no FAIL). All 756 vitest cases green; tsc strict clean; build
clean (background.js 19,542 → 19,548 lines after offscreen detector
additions).

No regression triggers fired (stop-on-regression check):
- Test count: 722 → 756 (+34; intentional additive)
- Build: clean → clean
- Tsc errors: 0 → 0
- background.js lines: 19,467 → 19,548 (+81; expected from `_oauthFetchWithTimeout` helper)
