# Research Report

Status: consolidated docs index refreshed on 2026-06-01.

ScriptVault keeps a broad roadmap plus a focused open-work extract. The active
queue remains `TODO.md`; `ROADMAP.md` is the broad Round 14 planning source.

## Canonical Research Map

- `TODO.md` - consolidated open-work queue generated from active planning
  sources.
- `ROADMAP.md` - broad Round 14 roadmap and historical planning appendix.
- `RESEARCH_FEATURE_PLAN.md` - first 2026-05-24 research refresh.
- `RESEARCH_FEATURE_PLAN_PASS2.md` - second-pass companion and net-new
  findings.
- `RESEARCH_FEATURE_PLAN_PASS3.md` - third-pass companion (2026-06-03 deep
  re-audit of the live runtime): sharpens the open TODO queue and adds net-new
  trust/security/data-safety/reachability findings (GM_xhr SSRF asymmetry vs
  GM_loadScript, unmounted dashboard modules, plaintext cloud sync + sync-RCE,
  stale What's New, `@crontab` parser fallback bug).
- `FIREFOX-PORT.md` - active Firefox-port session ledger.
- `COMPLETED.md` and `CHANGELOG.md` - completed-work navigation and shipped
  release ledger.

## Maintenance Rule

Keep `TODO.md` as the open queue while it remains the active working extract.
When a research pass becomes historical-only, move it under `docs/research/`
and update this map.
