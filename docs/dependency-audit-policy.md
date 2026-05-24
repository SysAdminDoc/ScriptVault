# Dependency audit policy

## Policy (effective 2026-05-24)

`npm audit --audit-level=high --omit=optional` is a **blocking** CI gate.
A High or Critical advisory anywhere in the production dependency graph
fails the build and blocks the release.

## Why high-only

Low and moderate advisories are noise for an extension that:
- Ships a static `background.js` bundled from source modules — every
  vulnerability surface that matters reaches the runtime through that
  bundle, and the audit narrows to it after `--omit=optional`.
- Has zero web-facing surface beyond `chrome://` and the user's tabs.
  Most "moderate" advisories address server-side denial-of-service vectors
  that don't apply.

Counter-policy: any advisory that *does* affect ScriptVault's runtime
(static analyzer, network proxy, OAuth flows, etc.) gets bumped to "high"
manually by adding a `.audit-policy.md` row and a temporary
`--audit-level=moderate` invocation in the release notes for that
release. The default `high` floor is the resting state.

## Where the gate runs

| Location              | Command                                              | Blocking? |
| --------------------- | ---------------------------------------------------- | --------- |
| CI (`ci.yml`)         | `npm audit --audit-level=high --omit=optional`       | Yes — exit 1 fails the build. |
| `docs/release-runbook.md` step 3 | Same command run locally before release   | Yes — pre-release gate. |
| Engineer workstation  | `npm audit` (any level)                              | Advisory. |

## Exception process

When a High advisory has no upstream fix:

1. Add a row to this doc's exception table below documenting the
   advisory ID, affected package, affected version range, why the
   ScriptVault runtime is not exposed, and the planned remediation date.
2. Bump the next release's PR body with the same explanation.
3. Either pin to a patched fork or temporarily allow the advisory with
   `npm audit --audit-level=critical --omit=optional` (downgrades the
   gate to Critical-only) AND a tracking issue.
4. Re-enable `--audit-level=high` in the same PR that ships the patched
   dependency.

## Current exceptions

_None as of 2026-05-24._

## Why not advisory-only?

A Quick Win in the roadmap asked whether to make this gate advisory.
Rejected. ScriptVault has historically taken several rounds of
hardening from supply-chain advisories that started life as `npm audit`
warnings the team ignored (see the Shai-Hulud 2.0 reference in
`docs/release-runbook.md`). Treating High as blocking is the cheapest
way to keep the muscle memory.

## Verification

- `npm audit --audit-level=high --omit=optional` in this repo currently
  exits 0 (clean) as of 2026-05-24.
- The CI step at `.github/workflows/ci.yml` line 45 enforces the same
  command on every push.
