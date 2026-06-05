# Cycle 21 Audit - Source-Aligned Coverage Gate

Date: 2026-06-05

## Scope

- Audited the open P1 coverage-gate item against `vitest.config.mjs`,
  `ts-source-promotion.json`, CI, and current Vitest coverage behavior.
- Checked current primary docs: Vitest documents that coverage includes only
  imported files unless `coverage.include` selects source files, and that
  positive coverage thresholds are minimum percentages. Chrome extension testing
  docs continue to support the repo's package/smoke strategy for extension
  browser flows, so this cycle kept page/browser smoke coverage separate from
  authored TypeScript unit coverage.

## Finding

`vitest.config.mjs` only covered `src/shared/**`, `src/modules/**`, and
`src/bg/**`, with no threshold and no guard that `src/background/**` or promoted
sources appeared in `coverage-summary.json`. Because `background.core.js` is now
generated from `src/background/core.ts`, a test could exercise background source
without the report showing the file or contributing to a release gate.

## Fix

- Added coverage include globs for `src/background/**`, `src/bg/**`,
  `src/modules/**`, `src/shared/**`, and `src/storage/**`.
- Added an initial measured coverage floor: 10% lines/functions/statements and
  5% branches.
- Added `scripts/check-coverage-sources.mjs` to fail when
  `coverage-summary.json` omits any authoritative TypeScript source-root file
  or promoted source from `ts-source-promotion.json`.
- Updated `npm run test:cov` and CI to run the guard.
- Added regression tests for missing background and promoted-source coverage
  entries.

## Verification

- `npm ci` in `C:\tmp\ScriptVault-verify` - 0 vulnerabilities.
- `npm run typecheck` - pass.
- `npm run test:cov` - 118 test files and 1354 tests passed.
- Coverage summary baseline: 37.94% statements, 27.97% branches, 48.32%
  functions, 40.12% lines.
- Source guard: 48 authoritative source files and 28 promoted source files
  accounted for.
