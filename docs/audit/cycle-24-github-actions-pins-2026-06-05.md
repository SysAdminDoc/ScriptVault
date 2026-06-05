# Cycle 24 Audit - GitHub Actions SHA Pins

Date: 2026-06-05

## Scope

- Audited `.github/workflows/ci.yml` action references in the trusted release
  workflow.
- Checked GitHub's secure-use guidance that full-length commit SHAs are the
  immutable action reference.
- Checked GitHub Dependabot documentation for GitHub Actions version updates
  and same-line version comments on pinned action refs.

## Finding

The CI workflow still used mutable tag refs for eight action invocations while
the job grants `id-token: write` and `attestations: write`, builds release
artifacts, attests the Chrome ZIP/SBOM, and uploads Chrome/Firefox/Edge
packages.

## Fix

- Resolved current trusted tags with `git ls-remote`:
  - `actions/checkout@v4` -> `34e114876b0b11c390a56381ad16ebd13914f8d5`
  - `actions/setup-node@v4` -> `49933ea5288caeca8642d1e84afbd3f7d6820020`
  - `browser-actions/setup-chrome@v1` -> `19ae4b339ee18925ab85cf12c1041150ea4a44c8`
  - `actions/attest@v4` -> `281a49d4cbb0a72c9575a50d18f6deb515a11deb`
  - `actions/upload-artifact@v4` -> `ea165f8d65b6e75b540449e92b4886f43607fa02`
- Replaced workflow `uses:` refs with full SHAs and same-line `# vN` comments.
- Added `scripts/check-github-actions-pins.mjs`, `npm run actions:pins:check`,
  and regression tests for mutable tags, missing comments, local actions, and
  docker actions.
- Added the pin gate to CI before browser-support and release-trust checks.

## Verification

- `npm run actions:pins:check` - 8 refs pinned.
- `npx vitest run tests/github-actions-pins.test.js --environment=node
  --reporter=verbose` - 5 tests passed.
- `npm run check` - pass.
