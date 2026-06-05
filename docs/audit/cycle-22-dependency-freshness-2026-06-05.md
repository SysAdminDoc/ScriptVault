# Cycle 22 Audit - Dependency Freshness Automation

Date: 2026-06-05

## Scope

- Audited the open P1 dependency freshness item against `package.json`,
  `package-lock.json`, `.github/workflows/ci.yml`, and
  `docs/dependency-audit-policy.md`.
- Rechecked current package drift with `npm outdated --json` in the local
  verification mirror.
- Checked GitHub's Dependabot options reference for required keys, supported
  package ecosystems, weekly schedules, PR limits, groups, dependency-type
  filters, and GitHub Actions update support.

## Finding

The high-severity audit gate is clean, but dependency freshness was still
reactive. The current outdated list still includes direct dev tooling packages:
`@vitest/coverage-v8`, `vitest`, `chrome-types`,
`chrome-webstore-upload-cli`, `esbuild`, `jsdom`, `monaco-editor`,
`puppeteer-core`, and `typescript`. GitHub Actions are also tag-referenced in
CI and need an update mechanism before SHA pinning can stay maintainable.

## Fix

- Added `.github/dependabot.yml` with weekly npm and GitHub Actions checks.
- Grouped npm minor/patch dev-tooling updates by purpose:
  `test-tooling`, `browser-test-tooling`, `extension-release-tooling`,
  `build-tooling`, and `editor-runtime`.
- Grouped GitHub Actions minor/patch updates while leaving major updates
  separate for manual review.
- Added `tests/dependabot-config.test.js` to pin the expected ecosystems,
  schedules, PR limits, and grouping policy.
- Updated `docs/dependency-audit-policy.md` with the freshness policy and
  verification hook.

## Verification

- `npm outdated --json` in `C:\tmp\ScriptVault-verify` confirmed the dependency
  drift the roadmap described.
- Focused config test: `npx vitest run tests/dependabot-config.test.js
  --environment=node --reporter=dot`.
- `npm audit --audit-level=high --omit=optional` - 0 vulnerabilities.
