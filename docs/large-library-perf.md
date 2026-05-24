# Large-library performance harness

ScriptVault is positioned for users with hundreds-to-thousands of scripts.
Two harnesses keep that claim honest:

- `npm run smoke:large-library` — Node script that generates **1k and 10k**
  synthetic scripts, exercises the authoritative `MatchSet` from
  `src/background/url-matcher.ts`, and reports build / lookup / search /
  sort latency plus dashboard virtual-row render latency.
- `npm run smoke:large-library:check` — same harness, exits non-zero if any
  measurement exceeds the documented threshold below.
- `tests/large-library-perf.test.js` — vitest spec that runs the 1k pass with
  CI-safe thresholds. The 10k pass stays in the standalone smoke script to
  keep the test suite quick.

The synthetic dataset is deterministic (seeded LCG): ~90% site-scoped scripts
across 15 hostnames, ~5% `<all_urls>`, ~5% regex `@include`. Each URL lookup
basket has 12–20 representative URLs (HTTPS, subdomains, opaque schemes,
unmatched hosts) repeated to gather ≥100 samples per metric.

## Thresholds

These thresholds run on Node 24 on the maintainer's VMware Windows guest
backed by a shared drive. They are generous on purpose so the harness can
also run in CI on cloud runners. Tighten only with measurement evidence.

| Operation                            | 1k limit | 10k limit |
| ------------------------------------ | -------: | --------: |
| `new MatchSet(scripts)` build        |    60 ms |    600 ms |
| `getCandidates(url)` p99             |     5 ms |     25 ms |
| `getMatching(url)` p99               |     8 ms |     50 ms |
| substring search over all names      |    25 ms |    250 ms |
| `localeCompare` sort over all names  |    20 ms |    200 ms |
| dashboard virtual render p99         |    50 ms |    100 ms |

The thresholds intentionally cover an order of magnitude headroom over the
typical observed runs (build 10k ≈ 8 ms, `getMatching` 10k p99 ≈ 2 ms on
maintainer hardware). The headroom protects against regressions like an
O(N²) loop being reintroduced into the hot path, while still allowing
high-variance shared-drive environments to pass.

The dashboard render gate loads `pages/dashboard-virtual-rows.js` in JSDOM,
computes 120 scroll windows over the synthetic library, and asserts each
window can replace the table body with spacer rows plus the visible slice
within the p99 limits above. The dashboard uses the same virtualizer for flat
libraries once `state.scripts.length` exceeds
`dashboardVirtualizationThreshold` (default 500); folder-grouped and small
libraries keep the direct-render path.

## When to regenerate

Run the harness whenever the URL-matcher hot path, MatchSet structure, or
dashboard list rendering changes. Update both this doc and the script's
`THRESHOLDS` table together. The vitest spec mirrors a subset of the same
thresholds and should be updated in lockstep.

## How the smoke script is wired

The Node smoke script imports `MatchSet` directly from
`src/background/url-matcher.ts` via a small `scripts/ts-loader.mjs` Node
loader that transpiles the TS module on the fly with `esbuild` (already a
dev dep). This avoids a separate build step and keeps the harness on the
authoritative implementation.
