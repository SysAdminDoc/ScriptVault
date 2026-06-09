# ScriptVault -- Research Archive

**Consolidated**: 2026-06-09
**Sources**: RESEARCH_REPORT.md, RESEARCH_FEATURE_PLAN.md

> Actionable items live in ROADMAP.md. Legacy planning passes archived
> under docs/archive/.

---

## Product Summary

ScriptVault is a mature, local-first Manifest V3 userscript manager for Chrome
and compatible Chromium browsers, with Firefox AMO and Edge package paths.
Implements broad Greasemonkey/Tampermonkey runtime surface, Monaco editing on
Chromium, sync and backup systems, and source/runtime drift gates.

Shipped baseline: v3.11.0 (2026-05-19).
Test suite: 1553 Vitest cases, 28/28 TS-promoted runtime entries.

---

## Market Context

Tampermonkey removed from Chrome Web Store mid-2025 (MV3 compliance failure).
Violentmonkey remains MV2-only and dead on Chrome 133+. ScriptVault is one of
the only MV3-native, open-source, full-featured userscript managers available.

---

## Research Findings (June 2026)

Key opportunities addressed:
- Coverage gate aligned to TypeScript promotion map (shipped)
- Node/npm toolchain enforcement (shipped)
- GitHub Actions SHA pins (shipped)
- Settings schema classification gate (shipped)
- Dependency reach gate (shipped)

Remaining gaps tracked in ROADMAP.md Now/Next tiers.

Detailed research cycles preserved in docs/archive/ and .ai/research/.
