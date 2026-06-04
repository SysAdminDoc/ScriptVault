# WCAG 3.0 Readiness Gap Analysis

**Phase:** 39.43 (extends Phases 14 + 34).
**Status:** Initial gap matrix — March 2026 Working Draft baseline; H-1/H-2 implementation refresh.
**Owner:** Phase 34 (Deep Accessibility) follow-up.
**Last reviewed:** 2026-06-04.

---

## Why this document exists

W3C published the [WCAG 3.0 March 2026 Working Draft](https://www.w3.org/WAI/news/2026-03-03/wcag3/). It introduces 174 requirements (the term "outcomes" was retired) and a three-tier conformance model: Bronze / Silver / Gold. Candidate Recommendation is targeted for Q4 2027; Recommendation in 2028+.

ScriptVault's current accessibility planning targets **WCAG 2.2 AA** (Phase 14 + Phase 34). WCAG 3 is not a strict superset — some 2.x criteria are restructured, decomposed, or moved between requirements — so a coverage map is needed before the spec finalizes. This document is a **gap matrix**, not an implementation plan.

Re-run this analysis on each WCAG 3 Working Draft update.

## Methodology

Three-bucket classification per WCAG 3 requirement, where the requirement crosses a ScriptVault surface:

- **🟢 Covered** — A current Phase 14 / Phase 34 item already addresses the requirement at the WCAG 2.2 AA level, and the WCAG 3 wording does not raise the bar.
- **🟡 Partial** — Some surfaces covered, others not. Specific gap is named.
- **🔴 Net-new** — No current Phase 14 / Phase 34 item maps. Requires net-new work.
- **N/A** — Requirement is about content not under ScriptVault's control (e.g., it applies to userscripts injected into pages, which ScriptVault doesn't author).

## Gap matrix

### Category 1: Perceivable

| WCAG 3 Req (paraphrased from March 2026 WD) | Tier | Status | Current Phase | Gap |
|---|---|---|---|---|
| Text contrast (APCA-based, replaces 2.2's 4.5:1 ratio) | Bronze | 🟡 Partial | Phase 14 covers WCAG 2.2 contrast (4.5:1) | APCA is a different metric. The 4 ScriptVault themes (dark, light, catppuccin, oled) plus Phase 39.9 Claude theme need APCA-scored audit. Estimated rework: 2-3 hours per theme. |
| Non-text contrast (icons, focus rings) | Bronze | 🟢 Covered | Phase 14.2 focus visibility, Phase 34.4 forced-colors | — |
| Color is not the only signal | Bronze | 🟢 Covered | Existing dashboard uses icons + text, not color alone, for status | — |
| Distinguishable visual structure (headings, regions) | Bronze | 🟡 Partial | Phase 14 ARIA landmarks | Skip-to-main-content link missing per Phase 34.3 audit. |
| Captions for video | Bronze | 🟢 Covered | Phase 34.9 YouTube captions auto-generated + reviewed | — |
| Audio description for video | Silver | N/A | — | No video content in ScriptVault UI. |
| Sign language alt-track | Gold | N/A | — | Same. |
| Pause/stop motion content | Bronze | 🟢 Covered | Phase 34.5 reduced-motion CSS | — |

### Category 2: Operable

| WCAG 3 Req | Tier | Status | Current Phase | Gap |
|---|---|---|---|---|
| Keyboard accessible (all functions reachable) | Bronze | 🟡 Partial | Phase 14.5 drag-sort keyboard alt, Phase 34.3 APG patterns | Combobox + grid patterns in script table need full implementation per APG. |
| No keyboard trap | Bronze | 🟢 Covered | Modal dialogs use focus trap; tested in popup-a11y.test.js | — |
| Bypass blocks (skip links) | Bronze | 🔴 Net-new | Phase 34.3 audit identified this | Add skip-link at top of dashboard, popup, sidepanel, install pages. ~2 hours. |
| Page titled | Bronze | 🟢 Covered | All extension pages have `<title>` | — |
| Focus order matches reading order | Bronze | 🟡 Partial | Most pages OK; sidepanel needs verification | Sidepanel tab order audit pending. |
| Focus visible | Bronze | 🟢 Covered | Phase 14.2 :focus-visible everywhere | — |
| Sufficient touch target size (≥ 24×24 CSS px) | Bronze | 🟡 Partial | Phase 14.3 covers desktop; popup compact list has some sub-24 targets | Popup script-row toggle is 20×20; needs bump. ~30 min. |
| Pointer cancellation | Bronze | 🟢 Covered | Native browser behavior; no custom drag code overrides it | — |
| Drag movements have keyboard alternative | Bronze | 🟢 Covered | Phase 14.5 | — |
| Timeouts: user is warned & can extend | Silver | 🟢 Covered | No auto-timeouts in ScriptVault UI; sync polling is silent | — |
| No flashing content > 3 Hz | Bronze | 🟢 Covered | No flashing animations | — |
| Help is consistent across pages | Silver | 🟢 Covered | Phase 34.6 follow-up | Dashboard, popup, sidepanel, and install expose a `[data-help]` control named "Help" that links to the dashboard Help tab. |
| Cognitive function tests don't gate access | Silver | 🟢 Covered | No CAPTCHA, no math-puzzle gates | — |

### Category 3: Understandable

| WCAG 3 Req | Tier | Status | Current Phase | Gap |
|---|---|---|---|---|
| Language of page | Bronze | 🟢 Covered | All pages declare `<html lang="...">` per locale | — |
| Language of parts (inline) | Bronze | 🟡 Partial | Most strings flow through i18n | Mixed-language strings (e.g., script names in dashboard) lack `lang=""` on inline spans. Low priority. |
| Consistent navigation | Bronze | 🟢 Covered | Dashboard tabs are stable; popup layout consistent | — |
| Consistent identification (same components labeled same way) | Bronze | 🟢 Covered | Existing terminology audit (Phase 34.6) | — |
| Plain language (Flesch 60+) | Bronze | 🟢 Covered | Phase 34.6 follow-up | `scripts/check-readability.mjs` audits high-impact setup/install/trust copy at Flesch 60+ and reports offending IDs/files. |
| Error identification (errors clearly indicated) | Bronze | 🟢 Covered | Toast system, form error styling | — |
| Error suggestion (offer correction) | Silver | 🟡 Partial | Linter (Phase 11.x) suggests `@grant` additions; many other errors don't | Round 12 / Phase 39.10 banner is a model: identify + suggest CTA. |
| Error prevention for important transactions | Silver | 🟢 Covered | Bulk delete + factory reset gated by confirmation modals | — |
| Predictable: on-input doesn't navigate | Bronze | 🟢 Covered | Search inputs don't navigate on type | — |
| Reading level (Flesch-Kincaid grade ≤ 8) | Silver | 🟡 Partial | Phase 34.6 follow-up | High-impact setup/install/trust copy is gated; expand the catalog as new errors, warnings, and trust states land. |

### Category 4: Robust

| WCAG 3 Req | Tier | Status | Current Phase | Gap |
|---|---|---|---|---|
| Parsing (valid HTML/CSS) | Bronze | 🟢 Covered | CI HTML/CSS lints (assumed; verify) | Add `html-validate` or similar to CI if not present. ~1 hour. |
| Name, role, value programmatically determinable | Bronze | 🟢 Covered | Phase 34.3 APG patterns + existing ARIA labels | — |
| Status messages programmatically determinable | Bronze | 🟡 Partial | Most toasts use `role="alert"` or `aria-live` | Audit: every toast/banner has appropriate live-region role. ~2 hours. |
| Compatible with AT (assistive tech) | Bronze | 🟢 Covered | NVDA + VoiceOver protocol from Phase 34.11 + axe-core CI | — |

## Headline gaps requiring net-new work

In rough effort order:

1. **Skip-to-main-content links** on all 5 extension pages — ~2 hours.
2. **APCA contrast re-audit** on all 5 themes including the new Claude theme — ~12 hours total.
3. **Combobox + grid ARIA APG patterns** for script table + search — ~6 hours per Phase 34.3 estimate.
4. **Status-message live-region audit** — ~2 hours.
5. **Mixed-language inline `lang=""` attributes** for script names — low priority but cheap; ~1 hour.
6. **Readability catalog expansion** for any new high-impact errors, warnings, and trust states — ongoing with the Flesch 60+ gate.

## Roadmap impact

This gap analysis does NOT propose immediate work. It's a calibration check ahead of WCAG 3 Candidate Recommendation in Q4 2027. The headline gaps above should fold into Phase 34 milestones, sequenced after the WCAG 2.2 AA baseline is fully shipped.

Re-evaluate this document when:

- W3C publishes the next WCAG 3 Working Draft.
- W3C reaches Candidate Recommendation status (Q4 2027 target).
- ScriptVault adds a new theme or significant UI surface.

## Source citations

- [WCAG 3 March 2026 Working Draft (W3C WAI)](https://www.w3.org/WAI/news/2026-03-03/wcag3/)
- [WCAG 2.2 (current baseline)](https://www.w3.org/TR/WCAG22/)
- [APCA (Accessible Perceptual Contrast Algorithm)](https://www.w3.org/WAI/GL/task-forces/silver/wiki/Visual_Contrast_of_Text_Subgroup/Whitepaper)
- ROADMAP.md Phase 14 (WCAG 2.2 AA baseline)
- ROADMAP.md Phase 34 (Deep Accessibility & Author Education)
- ROADMAP.md Round 12 source 271
