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

## Optional dependency reach guard

`--omit=optional` is allowed only because shipped extension code is separately
checked by `npm run optional-deps:check`. npm still resolves omitted optional
dependencies into `package-lock.json`, and optional dependencies must be safe to
miss at runtime. The ScriptVault policy is therefore:

- Optional packages may exist in the lockfile for toolchain, browser-test, or
  platform-native package reasons.
- Shipped extension/package inputs must not statically import, dynamically
  import, or `require()` package names that are optional or peer-optional in the
  lockfile.
- Non-package DOM text such as `canvas` is not an exception or allowlist entry;
  it is simply outside the import/require reachability scan.

The checker parses `package-lock.json` for `optional: true`,
`optionalDependencies`, and `peerDependenciesMeta.*.optional`, then scans the
source and generated package inputs that can feed Chrome, Firefox, and Edge
extension bundles.

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

_None as of 2026-06-04._ The `web-ext@10.2.0 -> tmp@0.2.5`
GHSA-ph9p-34f9-6g65 / CVE-2026-44705 advisory was cleared by bumping
`web-ext` to `^10.3.0`, which depends on fixed `tmp@0.2.6`.

## Freshness automation

Dependabot version updates are enabled in `.github/dependabot.yml` for:

- npm at `/`, checked weekly on Monday morning America/New_York time.
- GitHub Actions at `/`, checked weekly on Tuesday morning America/New_York
  time.

Low-risk npm dev-tooling updates are grouped by purpose: test tooling, browser
test tooling, extension release tooling, build tooling, and the editor runtime.
Those groups accept only minor and patch updates so major updates stay as
separate PRs for manual review. GitHub Actions minor and patch updates are also
grouped; major action updates remain separate so release-trust workflow changes
are easier to inspect.

Security updates must not be blocked by broad ignore rules. If a dependency
requires a temporary hold, document it in the exception table above instead of
adding a silent Dependabot ignore.

## Why not advisory-only?

A Quick Win in the roadmap asked whether to make this gate advisory.
Rejected. ScriptVault has historically taken several rounds of
hardening from supply-chain advisories that started life as `npm audit`
warnings the team ignored (see the Shai-Hulud 2.0 reference in
`docs/release-runbook.md`). Treating High as blocking is the cheapest
way to keep the muscle memory.

## Verification

- `npm audit --audit-level=high --omit=optional` in this repo currently
  exits 0 (clean) as of 2026-06-05.
- `npm run optional-deps:check` currently scans shipped source inputs and exits
  0 with no optional dependency import/require reachability as of 2026-06-06.
- The CI steps in `.github/workflows/ci.yml` enforce both commands on every
  push.
- `tests/dependabot-config.test.js` pins the required npm and GitHub Actions
  Dependabot update blocks, weekly schedules, bounded PR limits, and grouped
  minor/patch update policy.
- `tests/optional-dep-reach.test.js` pins the optional dependency scanner and
  a fixture that must fail when shipped source imports `canvas`.
