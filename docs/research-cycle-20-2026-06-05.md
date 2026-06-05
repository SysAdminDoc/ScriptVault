# ScriptVault Research Cycle 20 - Companion Plan Reconciliation

Date: 2026-06-05.

Scope: research and planning only. The active implementation queue remains
`ROADMAP.md`; this note reconciles the current `RESEARCH_FEATURE_PLAN.md`
against that queue.

## Live Repository State

- Branch: `main`.
- Starting HEAD: `2ad4acd docs: refresh research feature plan`.
- Worktree before edits: clean.
- Current product version in package metadata: `scriptvault@3.11.0`.
- Current source-promotion state from `npm run ts-source:check`: 27 promoted
  entries, 0 mirrored entries, 0 intentionally divergent entries, and no
  promoted JS-only drift.

## Commands Run

- `rtk git status --short --branch` - clean at start.
- `rtk git log -10 --oneline --decorate` - confirmed the current post-research
  head and the recent GM namespace, host-permission, import-quarantine,
  dependency, action, Settings, and optional-dependency research commits.
- `npm audit --audit-level=high --omit=optional` - passed with 0
  vulnerabilities.
- `npm run ts-source:check` - passed; 27 promoted entries.
- `npm run readme:check` - passed.
- `npm run dashboard:modules:check` - passed for 28 dashboard modules.
- `npm config get engine-strict` - returned `false`.
- `npm outdated --json` - exited nonzero because direct devDependencies are
  stale; the same nine packages remain behind: `@vitest/coverage-v8`,
  `vitest`, `chrome-types`, `chrome-webstore-upload-cli`, `esbuild`, `jsdom`,
  `monaco-editor`, `puppeteer-core`, and `typescript`.

## Companion Plan To Roadmap Mapping

The June 5 companion plan's top opportunities are mostly already active in
`ROADMAP.md`:

| Companion-plan opportunity | Roadmap status |
| --- | --- |
| Source-aligned coverage gate | Open Cycle 13 / P1 coverage gate row |
| Node/npm/toolchain enforcement | Open Cycle 11 / P2 Node toolchain row |
| Dependency freshness automation | Open Cycle 16 / P1 dependency automation row |
| GitHub Actions SHA pinning | Open Cycle 15 / P1 action pinning row |
| Settings schema and validation | Open Cycle 17 / P2 Settings validation row |
| Optional dependency reach gate | Open Cycle 14 / P2 optional-dependency row |
| GM namespace parity and guarded fetch decision | Open Cycle 19 / P3 GM namespace row |
| GM value-change cross-tab remote semantics | Open P2 GM value-change row |
| AMO unlisted/listed publication | Open Firefox Phase 5 carry-over row |
| Edge browser smoke before elevated support | Newly promoted by this cycle |

## Net-New Handoff

The existing Edge release-quality row is closed because it tied support claims
to the generated Edge package, CI artifact upload, and readiness report. It
also explicitly records that there is no dedicated live Edge browser smoke in
CI. That is a separate risk from package generation, so Cycle 20 promotes a new
P2 row:

- Add a dedicated Edge browser smoke before raising Edge support beyond
  package-ready.

Acceptance should prove that Microsoft Edge can sideload the generated package,
open dashboard and popup surfaces, save/toggle/run a local smoke userscript,
and record console/runtime evidence tied to the Edge package report. Until that
passes, documentation should continue to distinguish package readiness from live
runtime support.

## External Sources

- Microsoft Edge Chrome-port guidance:
  https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/port-chrome-extension
- Microsoft Edge Add-ons publish flow:
  https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension
- Microsoft Edge supported extension APIs:
  https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/api-support

## Files Updated

- `ROADMAP.md`
- `RESEARCH_REPORT.md`
- `RESEARCH_FEATURE_PLAN.md`
- `docs/research-cycle-20-2026-06-05.md`

No source, tests, build outputs, package metadata, generated runtime artifacts,
or assets were changed.
