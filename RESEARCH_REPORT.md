# Research Report

Status: consolidated docs index refreshed on 2026-06-03.

ScriptVault keeps a broad roadmap plus a focused open-work extract. As of
2026-06-03 the active queue lives in `ROADMAP.md` (single source of truth); the
former `TODO.md` extract and the three research-feature passes have been folded
into the canonical trio and archived under `docs/archive/`.

## Canonical Research Map

- `ROADMAP.md` - single source of truth for planned work. `## Existing Planned
  Work` holds the active queue folded from the former `TODO.md`; `## Research-
  Driven Additions` holds the net-new findings from the third-pass deep audit;
  the Round 14 body below is the broad historical planning appendix.
- `COMPLETED.md` - completed-work navigator with the shipped-feature roll-up.
- `CHANGELOG.md` - canonical shipped-release ledger.
- `FIREFOX-PORT.md` - active Firefox-port session ledger.

## Archived Planning Sources (docs/archive/)

- `docs/archive/TODO.md` - former consolidated open-work queue (folded into
  `ROADMAP.md` Existing Planned Work + `COMPLETED.md` Shipped Features).
- `docs/archive/RESEARCH_FEATURE_PLAN.md` - first 2026-05-24 research refresh.
- `docs/archive/RESEARCH_FEATURE_PLAN_PASS2.md` - second-pass companion and
  net-new findings (NF-1 through NF-25).
- `docs/archive/RESEARCH_FEATURE_PLAN_PASS3.md` - third-pass companion
  (2026-06-03 deep re-audit of the live runtime): GM_xhr SSRF asymmetry,
  unmounted dashboard modules, plaintext cloud sync, stale What's New, and the
  `@crontab` parser fallback bug. Source for `ROADMAP.md` Research-Driven
  Additions.
- `docs/archive/iter-1-l1-claude-led.md`, `docs/archive/iter-1-l3-claude-smoke.md`
  - dated research-iteration logs.

## Maintenance Rule

`ROADMAP.md` is the open queue. When a research pass becomes historical-only,
move it under `docs/archive/` and update this map.
