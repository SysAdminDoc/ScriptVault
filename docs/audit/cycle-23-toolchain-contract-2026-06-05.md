# Cycle 23 Audit - Node/npm Toolchain Contract

Date: 2026-06-05

## Scope

- Audited the open Node/npm/toolchain row against `package.json`,
  `package-lock.json`, `.github/workflows/ci.yml`, contributor docs, release
  runbook notes, and CWS tooling checks.
- Checked current local toolchain evidence: Node `v24.16.0`, npm `11.13.0`,
  and `npm config get engine-strict=false` before adding a project `.npmrc`.
- Checked primary docs: npm package metadata for `engines` and
  `packageManager`, npm `engine-strict`, and `actions/setup-node`
  `node-version-file`.

## Finding

The repo declared `engines.node >=21.2.0`, CI still set up Node 20, local npm
treated engines as advisory, there was no version file/package-manager pin, and
the CWS tooling check enforced a separate Node 20 floor.

## Fix

- Standardized ScriptVault on Node 24.16.0+ and npm 11.13.0+.
- Added `.node-version`, `.nvmrc`, and `.npmrc` with `engine-strict=true`.
- Added `packageManager`, `engines.node`, and `engines.npm` to `package.json`
  and refreshed `package-lock.json`.
- Updated CI to consume `.node-version` and run `npm run toolchain:check`.
- Added `scripts/check-toolchain-contract.mjs` plus focused regression tests.
- Updated the CWS tooling check to compare current Node against the project
  engine instead of a hard-coded Node 20 floor.
- Updated contributor and release docs.

## Verification

- `npm install --package-lock-only` - pass, 0 vulnerabilities.
- `npm run toolchain:check` - pass.
- `npx vitest run tests/toolchain-contract.test.js --environment=node
  --reporter=verbose` - 4 tests passed.
- `npm audit --audit-level=high --omit=optional` - 0 vulnerabilities.
- `npm run cws:check` - pass.
- `npm run check` - pass.
