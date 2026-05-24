# ScriptVault — Research-Backed Feature & Improvement Plan

**Companion to [ROADMAP.md](ROADMAP.md).** Where ROADMAP is the chronological,
multi-round research log (Rounds 1–13, Phases 0–40, >294 cited sources), this
file is the **prioritized, implementation-ready punch list** that an
incoming coding agent can pick up without re-running the research. Every item
here cross-references a Phase / sub-item or names the file + symbol it
touches.

- **Inspected baseline:** v3.11.0 tagged at commit `180aab3` (2026-05-19);
  HEAD at `af5e2f4` carries an unreleased iter-2 hardening batch (LR-001,
  LR-002, LR-003, CSP-RULEID, ERRLOG-PERF, WORKSPACES-INIT, D-phase). Tests
  769/769 green. `background.js` 19,598 lines. `pages/dashboard.js` 10,657
  lines.
- **Authoritative docs read in full:** `README.md`, `CLAUDE.md` (945 lines),
  `AGENTS.md`, `ROADMAP.md` (4,575 lines), `CHANGELOG.md`, `FIREFOX-PORT.md`,
  `PRIVACY.md`, `CWS_COOKIES_JUSTIFICATION.md`, `docs/extension-interop.md`,
  `docs/cross-browser-pipeline.md`, `docs/release-runbook.md`,
  `docs/require-provenance-design.md`, `docs/mcp-2026-compliance.md`,
  `docs/wcag3-gap-analysis.md`, `docs/research/iter-1-l1-claude-led.md`.
- **Code audit sampled:** `manifest.json`, `manifest-firefox.json`,
  `esbuild.config.mjs`, `package.json`, `background.core.js` (8,515 lines —
  spot-read), `modules/storage.js`, `modules/sync-providers.js`,
  `bg/analyzer.js`, `bg/signing.js`, `pages/dashboard.js` head,
  `pages/sidepanel.js` head, `src/background/*.ts` (14 files), `src/bg/*.ts`,
  `src/modules/*.ts` (14 files), `src/types/messages.ts` (1,260 lines),
  `src/storage/*.ts`, `tests/setup.js`, `tests/storage.test.js`,
  `tests/xhr.test.js`, plus a sweep of all `tests/*.test.js` names + sizes.
- **CI inspected:** `.github/workflows/ci.yml` (Node 20, npm ci → audit →
  typecheck → vitest → build → smoke-dashboard → package → upload artifact).
- **Git history:** last 50 commits via `git log --oneline`. v3.11.0 tag at
  `180aab3` (2026-05-19); HEAD `af5e2f4` includes the iter-2 batch.

---

## Executive Summary

ScriptVault is a mature, production-grade Manifest V3 userscript manager
(v3.11.0) that has already shipped well past Tampermonkey / Violentmonkey /
ScriptCat parity on most user-visible features (Monaco editor, DevTools
panel, side panel, Ed25519 signing, AST analyzer with 31 detectors, 5 sync
providers, 8 locales, IndexedDB storage, command palette, workspaces,
folders, gist sync, the lot). The project's strongest current shape is
**a security-hardened, defensively-coded extension with an extensive
roadmap (Phases 0–40), comprehensive test suite (45 files / 769 cases), and
an unusual culture of rolling adversarial audit passes that produce
documented "verified", "shipped", "deferred", or "rejected with reasoning"
outcomes per item.** It is, by code line count and feature breadth, the
most capable open-source userscript manager in 2026.

The highest-value direction for improvement is **closing the Phase-1
TypeScript migration so the TS mirror becomes the build source, then
unlocking everything that depends on it** (Phase 4.3 cross-context matcher
sharing, Phase 18.1 SW module splitting, Phase 36.1 structured-clone
messaging). The TS mirror has drifted from runtime JS multiple times
already (Round 10 audit found 22 such drift bugs); promoting it to the
build source closes that bug class permanently. The next-highest-leverage
work is **shipping the long-deferred user-facing items the project's own
roadmap has stalled on**: decoupled update consent (Phase 17.3 / 38.3 / 38.9),
virtual scrolling for the script list (Phase 7.1), the unified pattern
sidebar editor with hit counts (Phase 39.15 needs analytics from Phase 20.5),
and the Phase 12.13 trash bin with deferred-undo. Almost everything below
exists somewhere in `ROADMAP.md` as a sub-item; this file ranks them by
**leverage × tractability** and surfaces the bug fixes the audit rounds
have deferred.

### Top 10 opportunities, priority order

1. **P0 — Close the TypeScript migration loop (Phase 1.5 / 1.4).** Make the
   `src/` tree the canonical build source via esbuild bundling; delete
   `bash`-style concatenation in `esbuild.config.mjs`. The TS mirror has
   drifted ≥3 times in audit history (Round 10: 22 drift bugs). [LR1]
2. **P0 — Decoupled update consent (Phase 17.3 / 38.3 / 38.9 promotion).**
   TM 5.5.0 (May 8 2026) and VM v2.37.1 both ship a force-update guard with
   tri-state `Check only / Check + install / Manual review per script`.
   ScriptVault has partial fixes (Phase 38.9 modal on per-row click) but no
   global setting yet — most painful retention gap vs TM stable. [LR2]
3. **P0 — Virtual scrolling for the script list (Phase 7.1).** Users with
   100+ scripts hit visible jank during sort/filter; existing benchmarks
   bear this out. `@tanstack/virtual-core` is 3 KB and zero-framework. [LR3]
4. **P0 — Trash / soft-delete with undo (Phase 12.13).** Single most-cited
   user complaint across managers (VM #2144). Schema work already pencilled
   in `src/storage/`; needs the dashboard surface and 30-day retention. [LR4]
5. **P1 — Per-script execution observability surface (Phase 20).**
   Per-script execution-time chart, error timeline, network waterfall.
   Data plumbing (`netlog.js`, `error-log.js`, per-script stats) all exists;
   missing piece is the unified DevTools/dashboard panel. [LR5]
6. **P1 — Auto-grant inference live in the editor (Phase 15.2).** Acorn
   already shipped in `offscreen.js`; reuse via a Web Worker to detect
   GM_* identifiers in the editor buffer and offer a one-click "Add to
   `@grant`" toolbar action. No competitor does this live. [LR6]
7. **P1 — `GM_fetch` (Phase 16.1) + AbortSignal in `GM_xmlhttpRequest`
   (Phase 16.2).** Two high-demand, low-effort GM API additions. ScriptVault
   would be the first Chrome MV3 manager with native `GM_fetch`. [LR7]
8. **P1 — Diff-view before update (Phase 15.4).** VM #500 is the
   single most-reacted enhancement (80+ upvotes) in the entire userscript
   manager community. Monaco `createDiffEditor()` and existing
   `dashboard-diff.js` LCS already cover it; needs wiring into the
   update flow. [LR8]
9. **P1 — Firefox port Phase 1 (clean sideload).** `FIREFOX-PORT.md` Phase
   1 has been "not yet started" for months. The build is 90% there;
   `manifest-firefox.json` exists but is stale (v2.1.8 vs Chrome v3.11.0)
   and the offscreen/sandbox/userScripts shims need wiring. [LR9]
10. **P1 — Phase 1 dashboard TypeScript migration (1.5 wave 5).** The
    10,657-line `pages/dashboard.js` is the largest unmigrated surface and
    the second-densest bug source after `background.core.js`. Even partial
    migration of the highest-touch modules (`dashboard.js`, `popup.js`,
    `sidepanel.js`, `install.js`) would yield outsized refactor safety. [LR10]

Tags (LR1–LR10) are reused below in the Prioritized Roadmap section.

---

## Evidence Reviewed

### Local files & directories inspected (representative; not exhaustive)

| Surface | Files / Notes |
|---|---|
| Top-level docs | `README.md`, `CLAUDE.md`, `AGENTS.md`, `ROADMAP.md`, `CHANGELOG.md`, `FIREFOX-PORT.md`, `PRIVACY.md`, `LICENSE`, `CWS_COOKIES_JUSTIFICATION.md` |
| Manifests | `manifest.json` (Chrome MV3, min Chrome 130), `manifest-firefox.json` (MV3, Firefox 128+, stale at v2.1.8) |
| Build | `esbuild.config.mjs`, `build.sh`, `build-background.sh` (deprecated), `build-firefox.sh`, `pack-crx.mjs`, `publish.sh`, `cws-setup.sh`, `package.json`, `tsconfig.json`, `vitest.config.mjs` |
| Runtime JS (source of truth today) | `background.core.js` (8,515 lines), `content.js`, `offscreen.{html,js}`, `modules/*.js` (14 files), `bg/*.js` (4), `shared/utils.js`, `pages/*.{html,js,css}` (27 dashboard modules, popup, sidepanel, install, devtools panel) |
| Typed mirror (`src/`) | 39 `.ts` files spanning `src/background/` (14), `src/bg/` (4), `src/modules/` (14), `src/types/` (5), `src/storage/` (4), `src/shared/` (1), `src/pages/` and `src/config/` — type-check only; not yet the build source |
| Tests | `tests/` 45 `.test.js` files (counted: 769 cases). Vitest + fake-indexeddb + jsdom |
| Docs | `docs/cross-browser-pipeline.md`, `docs/extension-interop.md`, `docs/mcp-2026-compliance.md`, `docs/release-runbook.md`, `docs/require-provenance-design.md`, `docs/wcag3-gap-analysis.md`, `docs/research/iter-1-l1-claude-led.md`, `docs/research/iter-1-l3-claude-smoke.md` |
| CI | `.github/workflows/ci.yml` (Node 20, full check + Chrome smoke test + artifact upload) |
| Release artifacts | `ScriptVault-firefox-v2.1.7.xpi` (stale exploratory build per FIREFOX-PORT.md decision #5) |

### Git history range reviewed

`git log --oneline -50` from current HEAD `af5e2f4` (2026-05-19 iter-2 CHANGELOG)
back to `d35fce7` ("Preserve script IDs in runtime ZIP restores", v3.10.1 era).
The iter-2 batch (`24374b8`, `183c98b`, `e3973e7`, `fcc442b`, `21c5373`,
`f9dc4bd`, `eb99805`, `d98fb7d`, `af5e2f4`) is the most recent shipped work
and is documented in `CHANGELOG.md` § Unreleased plus `CLAUDE.md` § Bug Fix
History "Factory iter 1" + iter-2 commits.

### Build / test / docs / release artifacts inspected

- `package.json` scripts: `build`, `build:bg`, `build:prod`, `build:monaco`,
  `dev`, `watch`, `typecheck`, `test`, `test:a11y`, `smoke:dashboard`,
  `test:cov`, `check`, `clean`, `publish`, `publish:draft`, `cws:setup`.
- `esbuild.config.mjs`: still concatenation-based; emits one
  `background.js` from `shared/` + `modules/` + `bg/` + `background.core.js`.
  `--prod` minifies via esbuild but doesn't tree-shake (concatenation precludes
  it).
- CI: full pipeline runs on every PR + main push. Chrome installed via
  `browser-actions/setup-chrome@v1`; smoke test launches the unpacked
  extension and asserts the dashboard renders.
- Release artifacts: latest Chrome ZIP shipped 2026-05-19 via `publish.sh`
  (v3.11.0). Firefox `.xpi` is stale at v2.1.7 (pre-tag).

### External sources reviewed

The project's own `ROADMAP.md` cites 294+ external sources across Rounds 1–13.
This research pass re-verified the meta-claims (e.g., "TM 5.5.0 shipped
decoupled update consent", "URLPattern is Baseline Newly Available",
"chrome-webstore-upload-cli 4.0.0 is the latest published version") by
inspecting the referenced files and recent commits rather than re-fetching
URLs. Where the existing source index suffices, this file references it
rather than duplicating; new claims below are footnoted with `→` to the
canonical Phase or sub-item where the original citation lives.

### Areas that could not be verified in this pass

- **Runtime behavior in Chrome 138+**: no Chrome runtime is available in this
  research environment; claims about Chrome 138's per-extension toggle UX
  rely on the existing `ROADMAP.md` § Phase 13.3 + § 39.10 documentation.
- **Real Firefox behavior**: no Firefox runtime available; `FIREFOX-PORT.md`
  Phase 1 has not yet been started, so the porting claims are derived from
  the catalogued porting issues in that file, not live runtime checks.
- **CWS submission status**: not visible from the repo. Inferred from
  `publish.sh` exit codes and `cws-setup.sh` requirements.
- **Per-script analytics data shape at scale**: `dashboard-debugger.js`,
  `dashboard-heatmap.js`, `dashboard-performance.js`-class modules render
  data structures that I sampled but did not exercise with seeded data.
  Claims about virtual-scrolling pain point at 100+ scripts are based on
  the project's own anti-claim ("at script count ≥ 100, activate virtual
  scrolling" in Phase 18.5) — not re-benchmarked.

---

## Current Product Map

### Core user workflows (verified against shipped code)

1. **Install a userscript** — three entry points:
   - Direct URL: `chrome.webNavigation.onCommitted` listener in
     `background.core.js` intercepts `*.user.js` navigation, fetches via
     `_fetchPendingUserscript()`, redirects tab to `pages/install.html`.
     Phase 40.3 fixed the double-tab race; Phase 39.27 covers the
     incognito short-circuit (still deferred).
   - "Find Scripts" in dashboard: GreasyFork + OpenUserJS catalog search
     in `pages/dashboard-store.js`, install via `installFromUrl` background
     message. Phase 40.9 defanged XSS via `safeExternalUrl()`.
   - Drag-and-drop / file picker: `pages/dashboard.js` import section
     calls `installFromCode` background message (Phase 12.9 shipped v3.8.0).
2. **Edit a script** — open in dashboard, edit in Monaco (sandboxed iframe
   at `pages/editor-sandbox.html`), Ctrl+S to save. Auto-saves draft to
   `chrome.storage.local`. Phase 7.3 editor undo persistence shipped.
3. **Toggle on/off** — popup, sidepanel, or dashboard. Per-script chained
   mutex (`self._toggleLocks`) serializes rapid toggles; tabs reload
   debounced 500 ms; matching scripts re-register via `chrome.userScripts`.
4. **Update scripts** — auto-update via `chrome.alarms` (per-script
   exponential backoff shipped v3.6.0; per-row update icon shows confirm
   modal per Phase 38.9).
5. **Sync** — 5 providers; orchestrator in `background.core.js`. 3-way
   merge via offscreen document + `diff.min.js`. AbortController plumbing
   shipped at Phase 40.12.
6. **Backup / restore** — JSON or ZIP via `modules/backup-scheduler.js`
   (alarm-scheduled) or manual via dashboard.

### Existing features (high-level inventory)

The full feature list lives in `README.md`. ScriptVault's competitive
matrix (README.md "Comparison") claims roughly **30+ features no other
manager has**, plus full parity on the GM API surface (35+ functions). The
feature inventory below picks the ones that materially affect this plan;
the rest are tracked exhaustively in `README.md` and `ROADMAP.md` and not
re-listed here.

| Feature surface | State | Code location |
|---|---|---|
| GM API (35+ functions) | Complete; Phase 38.12 added `tag` getter back-compat | `background.core.js buildWrappedScript`, `src/background/wrapper-builder.ts` |
| `chrome.userScripts` registration | Diff-on-wake; per-script worldId on Chrome 133+ | `background.core.js registerAllScripts`, `src/background/registration.ts` |
| URL matcher + MatchSet | Production; tests import the TS source | `src/background/url-matcher.ts` (588 lines) |
| Storage layer | IndexedDB primary (v3.0.0); rollback contract pinned (v3.11.0) | `src/storage/*.ts`, `modules/storage.js` |
| Monaco editor | v0.52.2 bundled locally; sandboxed iframe; 4 themes + Claude theme (Phase 39.9) | `pages/editor-sandbox.html`, `pages/monaco-adapter.js`, `lib/monaco/` |
| AST analyzer | 31 detectors via Acorn (offscreen); regex fallback; 3 new obfuscation detectors in iter-1 | `bg/analyzer.js`, `src/bg/analyzer.ts`, `offscreen.js` |
| Ed25519 signing | Trust store + `@signature` header; CRLF tolerance | `bg/signing.js`, `src/bg/signing.ts` |
| Cloud sync | WebDAV, Google Drive, Dropbox, OneDrive PKCE, Easy Cloud (`chrome.identity`) | `modules/sync-providers.js`, `modules/sync-easycloud.js` |
| Public API + webhooks | Deny-by-default origins, RFC 1918 SSRF guard, capability tokens partial | `modules/public-api.js`, `src/modules/public-api.ts` |
| DevTools panel | Network + execution + console tabs | `pages/devtools-panel.{html,js}` |
| Side panel | Per-tab matched-scripts view, sort modes, search | `pages/sidepanel.{html,js}` |
| Dashboard modules | 27 lazy-loaded modules in `pages/dashboard-*.js`; lazy-loader at `pages/dashboard-lazy-loader.js` | `pages/` |
| Tests | 45 files, 769 cases, vitest + fake-indexeddb + jsdom | `tests/` |
| CI | GitHub Actions, full check + Chrome smoke + ZIP artifact upload | `.github/workflows/ci.yml` |

### User personas (inferred from feature concentration)

1. **Power user** — 50–200 installed scripts, daily editing, uses
   workspaces / folders / profiles / command palette. Cares most about
   list performance, search, undo, and update review.
2. **Script author** — writes new userscripts in-app. Cares most about
   editor capabilities (IntelliSense, auto-grant, diff, beautify),
   linter, and live reload.
3. **Security-conscious user** — installs scripts from less-trusted
   sources. Cares most about AST analyzer, signature trust store, install
   permission review, audit log, integrity hash.
4. **Casual user** — 5–20 scripts, mostly Greasy Fork installs, rarely
   opens the dashboard. Cares most about popup ergonomics, update
   notifications, and "it just works" reliability.

### Platforms & distribution

- **Chrome Web Store** — primary. `publish.sh` uses
  `chrome-webstore-upload-cli` v4.0.0 (Phase 40.18). CWS API v1 sunsets
  2026-10-15 (Phase 39.2).
- **Edge Add-ons** — not yet listed; same ZIP works (Phase 19.1 / 33.4
  scoped but unstarted).
- **Firefox** — `manifest-firefox.json` exists, Phase 1 of port not
  started; stale `.xpi` artifact at v2.1.7.
- **Self-hosted CRX** — not yet supported (Phase 19.3).

### Important integrations / permissions / data flows

- **Permissions** (`manifest.json`): `storage`, `tabs`, `notifications`,
  `contextMenus`, `scripting`, `userScripts`, `webNavigation`,
  `unlimitedStorage`, `alarms`, `downloads`, `declarativeNetRequest`,
  `declarativeNetRequestWithHostAccess`, `sidePanel`, `offscreen`.
  Optional: `clipboardWrite`, `clipboardRead`, `identity`, `cookies`. Host
  perms: `<all_urls>`.
- **External catalogs**: Greasy Fork (`greasyfork.org/scripts.json`),
  OpenUserJS (URL pattern), GitHub (script search), cdnjs (library
  browser), npm (via `unpkg.com` / `cdn.jsdelivr.net`).
- **Cloud APIs**: Google Drive, Dropbox, OneDrive (all PKCE). Token storage
  in `chrome.storage.local`. Gist PAT plaintext post-v3.6.2.

---

## Feature Inventory (delta from README.md)

Rather than duplicate `README.md`'s exhaustive feature list, this section
documents features that are **partial, hidden, stale, undocumented, or
have unmet improvement opportunities** — the entry points an incoming agent
needs to find quickly.

### Partial / unfinished features

| Name | Maturity | Location | Gap |
|---|---|---|---|
| TypeScript migration (Phase 1) | Partial — `src/` exists, type-checks clean, but build still concatenates `.js` | `esbuild.config.mjs` lines 60-135; `src/**/*.ts` (39 files) | Build is not the TS source. Drift between JS runtime and TS mirror has been fixed three times (Round 10 was 22 bugs). |
| Phase 7.1 virtual scrolling | Not yet shipped | `pages/dashboard.js renderScriptTable` (≥10K lines) | Renders all rows; jank above ~100 scripts. |
| Phase 12.13 trash bin | Not shipped despite IDB ready | `src/storage/script-db.ts`, `pages/dashboard.js` | No `scripts_trash` store, no UI tab. |
| Phase 17.3 update consent decoupling | Phase 38.9 modal shipped per-row only | `background.core.js` `applyUpdate`, `pages/dashboard.js interactiveCheckAndConfirmUpdate` | No global `Check only / Check + install / Manual review` setting. |
| Phase 14.6 RTL layout | Strings deferred on Hebrew translation (Phase 38.7) | `pages/dashboard.css` | No `inset-inline-start` rewrite; one-off `dir="rtl"` test missing. |
| Phase 15.2 auto-grant inference | Acorn is loaded only in offscreen; live editor parse not wired | Would need Worker bridging Monaco buffer → Acorn | High-value, low-effort given Acorn shipped. |
| Phase 15.3 unlimited version history | Capped at 5 (`script.versionHistory.slice(-5)`) | `background.core.js applyUpdate`, `rollbackScript`; `src/storage/script-db.ts` | No `script_versions` IDB store. |
| Phase 15.4 diff view on update | LCS algorithm exists in `dashboard-diff.js`; update flow doesn't surface it | `pages/dashboard-diff.js`, update apply path | Phase 38.9 already wires `showDiffView` from the per-row click; needs same hook in bulk flow + sync conflict path. |
| Phase 16.1 `GM_fetch` | Not implemented | Would go in `background.core.js GM_* dispatch` + `modules/xhr.js` | FireMonkey-only feature; no Chrome MV3 manager has it. |
| Phase 16.2 AbortSignal in `GM_xmlhttpRequest` | Not implemented | `modules/xhr.js XhrManager.create`, `buildFetchOptions` | No manager supports `signal?`. |
| Phase 20 observability dashboard | Data plumbing in place (`netlog`, `error-log`, `script.stats`); no unified view | `pages/devtools-panel.js` has the closest analog | Phase 20.1–20.6 all "not yet shipped". |
| Phase 33 cross-browser pipeline | Design doc only (`docs/cross-browser-pipeline.md`) | Future: WXT migration; current esbuild is single-target | Firefox port Phase 1 in `FIREFOX-PORT.md` is gating. |
| Phase 36.1 structured-clone messaging | Design ready (Phase 37.4 interop matrix shipped); not opted in | `manifest.json` would need `"message_serialization": "structured_clone"` | One-line manifest change + 30-min audit. |
| Phase 36.2 Prompt API (Gemini Nano) | Not implemented | Would go in install confirm dialog + dashboard "Explain" button | Opt-in, hardware-gated; safe to ship behind feature flag. |
| Phase 40.13 `messages.ts` ResponseMap completeness | ~25 of 135+ actions typed | `src/types/messages.ts` (1,260 lines) | Long-tail typing task. |
| Phase 40.10 DNR rule orphan reconciliation | Shipped in autonomous session per ROADMAP — verify reconcile pass runs on every SW wake | `background.core.js _reconcileWebRequestRules` | If shipped, add a regression test pinning the reconciliation contract. |

### Hidden / undocumented features

| Name | Location | Why it matters |
|---|---|---|
| Omnibox keyword `sv` | `manifest.json:43-45` + `background.core.js` ~line 4569 | Not surfaced in README quick-start; many users won't find it. Phase 39.29 shipped but discoverability is zero. |
| Per-script `@signature` trust store | `bg/signing.js`, dashboard signing UI | Few users will know they can sign their own scripts; the install dialog could surface this when a signed script is detected. |
| OS-policy script provisioning | `background.core.js` ~line 5279 (Phase 39.8) | Enterprise feature; no admin docs published. |
| Public API (external message API) | `modules/public-api.js` | Capability tokens, webhooks, rate limiting — none of this is documented for third-party integrators. |
| Workspaces (named state snapshots) | `bg/workspaces.js`, `src/bg/workspaces.ts` | Mentioned in README but feature discoverability inside the dashboard is low. |
| Profiles (separate from workspaces) | `pages/dashboard-profiles.js` | Two overlapping features ("workspaces" vs "profiles") with subtly different semantics — risk of user confusion. |

### Known-stale / cleanup candidates

| Name | Why stale | Location |
|---|---|---|
| `dashboard-firefox-compat.js` | Polyfills MV2/MV3 detection; will become canonical once Firefox port lands; until then it's load-bearing for a phantom code path | `pages/dashboard-firefox-compat.js` (~27 KB) |
| `manifest-firefox.json` version drift | Pinned at v2.1.8 while Chrome is v3.11.0 | Top-level |
| `ScriptVault-firefox-v2.1.7.xpi` | Exploratory artifact per FIREFOX-PORT.md decision #5 | Repo root (3.9 MB) |
| `build-background.sh` (legacy bash builder) | Deprecated per CLAUDE.md "Bug Fix History" round 10; now execs the Node builder. Can be deleted outright. | Top-level |
| `pages/devtools-panel-v2.js` (58 KB) | Suggests a v2 spike that didn't replace `devtools-panel.js`. Either rename, merge, or delete. | `pages/` |
| `coverage/` directory | From an old vitest run; not in `.gitignore` (likely tracked artifact). | Top-level |
| `-p` directory at repo root | Stray directory; likely created by mistaken `mkdir -p` invocation. Verify it's safe to delete. | Top-level (`ls -la` shows `drwxr-xr-x ... -p`) |

---

## Competitive & Ecosystem Research

The detailed competitor index lives in `ROADMAP.md` § Open-Source Research
through External Research (Round 12), with sources 1–272 plus Round-13
deltas. This section names only **specific features the competitors have
shipped that ScriptVault hasn't yet**, with the source phase to consult.

### Tampermonkey (TM 5.5.6237 + 5.5.0, May 2026)

| TM feature | ScriptVault gap | Where it's tracked |
|---|---|---|
| Decoupled update check vs install with tri-state setting | Per-row modal shipped (38.9); no global Settings → Updates control | Phase 17.3 + Phase 38.3 |
| TM-style watch-local-file on disk | Not implemented; design depends on File System Access API persistence | Phase 38.5 |
| Hebrew locale + RTL groundwork | 8 locales today; no RTL pass yet | Phase 38.7 + Phase 14.6 |
| OS-policy script provisioning | Phase 39.8 shipped per ROADMAP — needs admin docs and dashboard "managed" pill | Phase 39.8 |
| Claude editor theme | Shipped Phase 39.9 | (parity reached) |
| Built-in Gemini Nano AI helpers | Not implemented (intentionally opt-in only per anti-bloat) | Phase 36.2 |
| `Tampermonkey Editors` companion (vscode.dev) | Not implemented; design at Phase 12.14 | Phase 12.14 |
| Verified CRX signing in CWS | Not yet adopted | Phase 13.10 |
| First-run "Allow Userscript Injection" prompt | Deferred (Phase 39.6 — judged redundant with Chrome 138 toggle) | Phase 39.6 |

### Violentmonkey (VM v2.37.3-beta, May 2026)

| VM feature | ScriptVault gap | Source |
|---|---|---|
| Per-frame popup menu commands | Shipped Phase 36.8 — verify against current popup wiring | Phase 36.8 |
| Per-script author notes | Not implemented | Phase 36.9 |
| Storage vacuum on trash empty | Not implemented; trash itself not implemented | Phase 36.13 |
| `+ Domain` quick-add in popup | Not implemented | Phase 36.14 |
| `@require-id` local module resolution | Not implemented; security/cycle audit needed | Phase 36.5 |
| In-page context-menu integration | Deferred (Phase 39.7) | Phase 39.7 |

### ScriptCat (v1.4.0-beta.2, May 2026)

| SC feature | ScriptVault gap | Source |
|---|---|---|
| S3-compatible sync backend | Promoted to **Next** (Phase 21 / 40.15) | Phase 40.15 |
| `@run-at context-menu` | Already shipped per Round 13 audit (40.16) | (parity reached) |
| Popup "C" world-context badge | Shipped Phase 40.17 | (parity reached) |
| MCP-as-client (agent integration) | Design only (`docs/mcp-2026-compliance.md`); deferred under 38.10 | Phase 38.10 |
| `@storageName` cross-script storage | Not implemented | Phase 12.15 |
| `@unwrap` directive | Shipped v3.2.1 | (parity reached) |
| `window.onurlchange` via Navigation API | Shipped v3.11.0 (Phase 38.6) | (parity reached) |
| `GM_setValues`/`GM_getValues`/`GM_deleteValues` bulk APIs | Already in `README.md` feature list (GM API table) — verify backend handler | `background.core.js GM_setValues` |

### Userscripts (Safari, v5.0.0-beta.22)

Maintenance-mode TestFlight builds only; no feature deltas to harvest in
Round 11–13. Safari port is gated at Phase 33.7 decision gate.

### Greasemonkey (revival, May 12–15 2026)

- `confirm()` → `<menuitem>` audit complete (Phase 39.18); ScriptVault clean.
- `sourceURL` injection removed; ScriptVault doesn't emit `sourceURL` so
  already aligned (Phase 39.19).
- `@icon` download-failure tolerance already shipped (Phase 39.20).

### Adjacent tools to learn from

- **Stylus** (`openstyles/stylus`) — minimal-payload `document-start` style
  injection FOUC avoidance pattern. Applies when ScriptVault scripts at
  `@run-at document-start` add inline CSS. Phase 40.25 references.
- **uBO Lite** (`uBlockOrigin/uBOL-home`) — clean `userScripts.execute()`
  for MAIN-world routing. Phase 40.25 references.
- **Bitwarden Browser Clients** — single-source per-target build matrix
  for Chrome / Edge / Firefox / Safari. Mirrors what Phase 33 wants from
  WXT. Phase 40.25 references.
- **Vimium** — link-hint overlay for a hypothetical "Run script on this
  element" UI. Phase 40.25 references.

### Patterns to intentionally avoid

- **Cloud-LLM agent UIs** (ScriptCat v1.4) — contradicts ScriptVault's
  local-first / zero-telemetry stance per Phase 38.10. Already rejected
  multiple times in ROADMAP; don't re-derive.
- **Script subscription / feed systems** (ScriptCat) — duplicates Greasy
  Fork's function; rejected in Round 8.
- **Skill marketplaces / sub-agent generators** — moderation + hosting
  burden disguised as a feature. Rejected Round 12.
- **AI script generation** (Tweeks / ClickRemix HN pattern) — explicitly
  contradicts ScriptVault's anti-bloat doctrine. Rejected since Round 8.
- **Notification Triggers API** — discontinued upstream per Phase 11.11
  Round 12 update; do not plan against it.
- **WASM Component Model in-browser** — server-side only in 2026 per
  Phase 32.1 deprio.

---

## Highest-Value New Features

The full enumeration of new features is in `ROADMAP.md`. This section
profiles the **top 10 net-new feature proposals that should be picked up
next**, in the format requested by the research brief. Items here are a
prioritized subset — pure parity wins (e.g., "@require-id") are covered in
the Existing Feature Improvements section.

### NF-1 — Global Update Consent (tri-state Settings control)

- **User problem solved:** silent auto-installs overwrite local edits;
  this is the most-cited retention gap vs Tampermonkey 5.5.0 stable.
- **Evidence:** `ROADMAP.md` Phase 17.3 (promoted **Now-priority-1** in
  Round 11), `CHANGELOG.md` v3.11.0 Phase 38.9 (per-row only). VM #1023
  documents it as the #2 most-painful VM behavior. TM 5.5.0 changelog
  shipped same.
- **Proposed behavior:** Settings → Updates → tri-state radio: **Check
  only** / **Check + install** (default, for backwards compatibility) /
  **Manual review per script**. In **Manual review** mode every update
  surfaces an inline "⬆ Update available" badge on the script row;
  clicking opens the diff view (NF-2). Bulk update path keeps its
  progress-modal confirmation per Phase 38.9; auto-update alarms respect
  the per-script preference.
- **Implementation areas:** `pages/dashboard.html` Settings → Updates
  block; `pages/dashboard.js` settings render + setter; `background.core.js
  applyUpdate` (already has the Phase 38.9 path) gates auto-install on
  `settings.updateMode`. Migration: existing users with `notifyOnUpdate`
  off keep "Check + install".
- **Data model:** `settings.updateMode: 'check' | 'install' | 'review'`,
  default `'install'`. Schema bump in `src/config/settings-defaults.json`.
- **Risks & edge cases:**
  - The migration banner must explain the change so users on
    `'install'` aren't surprised when a future opt-in switch flips them
    to `'review'`.
  - "Check only" mode must still surface the update badge somewhere
    (popup count? omnibox suggestion?) or it's invisible.
- **Verification:** new test in `tests/core-flows.test.js` pinning the
  three modes' behavior on `applyUpdate`; UI smoke test in
  `tests/dashboard-modules.test.js`.
- **Complexity:** **S** (settings UI + 3-branch dispatch).
- **Priority:** **P0**. [LR2]

### NF-2 — Diff View Before Update (wire existing LCS into apply flow)

- **User problem solved:** VM #500 (80+ upvotes, the most-reacted
  enhancement request in the entire userscript-manager community) — see
  what's about to overwrite your script before it does.
- **Evidence:** `ROADMAP.md` Phase 15.4; `pages/dashboard-diff.js` already
  implements LCS; Phase 38.9's per-row modal calls `showDiffView` —
  consolidate into a reusable component.
- **Proposed behavior:** every update apply path (`applyUpdate` background
  handler, sync 3-way merge conflict, bulk update batch in review mode)
  passes through a single `showUpdateDiff(scriptId, oldCode, newCode,
  reason)` that opens a side-by-side Monaco `createDiffEditor` (or the
  LCS fallback). Buttons: **Apply** / **Apply & dismiss future** /
  **Skip this version** / **Cancel**.
- **Implementation areas:** lift the existing `dashboard-diff.js` logic
  into `pages/dashboard-update-review.js`; replace inline modal in Phase
  38.9 with the unified component; add the same hook to bulk update +
  sync merge conflict paths in `background.core.js _performSync` and
  `mergeData`.
- **Data model:** add `dismissedUpdateVersions: string[]` to
  `script.settings` so "Skip this version" persists.
- **Risks & edge cases:**
  - Monaco `createDiffEditor` requires the editor sandbox iframe to load
    a second instance; verify memory cost on a 200 KB script.
  - 3-way merge UI is complex; for v1, "sync conflict" falls back to the
    existing modal and just shows two-way diff (local vs remote).
- **Verification:** new test `tests/update-flow-diff.test.js` pinning the
  flow on `'review'` mode. Manual: install a script, upstream version
  bumped, see diff render and apply.
- **Complexity:** **M**.
- **Priority:** **P0**. [LR8]

### NF-3 — Trash / Soft-Delete with 30-Day Recovery and Undo Toast

- **User problem solved:** VM #2144. Single most-cited recovery gap.
  ScriptVault's existing "deferred delete" toast (Phase 7.4) handles
  immediate undo but not "I noticed three days later that I deleted the
  wrong script".
- **Evidence:** `ROADMAP.md` Phase 12.13; `src/storage/script-db.ts` IDB
  scaffolding exists.
- **Proposed behavior:**
  - New IDB object store `scripts_trash` with schema
    `{ id, script: Script, deletedAt: number, source: 'manual' |
    'reinstall' | 'bulk' }`.
  - `ScriptStorage.delete(id)` (the canonical delete path) first copies
    the record to `scripts_trash` with a fresh `deletedAt`, then removes
    from the live store.
  - Dashboard gains a "Trash" tab in the sidebar (sibling to Scripts /
    Settings) listing trashed items with **Restore** / **Permanently
    delete** actions.
  - Auto-purge alarm prunes items older than `settings.trashRetentionDays`
    (default 30; 0 = never auto-purge; max 365).
  - On reinstall (matching `namespace:name`), the previous version goes to
    trash before the new version writes.
- **Implementation areas:** `modules/storage.js ScriptStorage.delete`,
  `src/modules/storage.ts` mirror, new `pages/dashboard-trash.js` module,
  `pages/dashboard.html` sidebar entry, `modules/backup-scheduler.js`
  alarm reuse for trash-purge.
- **Data model:** new IDB store + `settings.trashRetentionDays`.
- **Risks & edge cases:**
  - Trash counts toward storage quota; surface in storage indicator
    (already exists in `dashboard.js updateStats`).
  - On factory reset, trash is included in the wipe (already covered by
    `cdf17ae` "Harden factory reset storage cleanup").
- **Verification:** new `tests/storage-trash.test.js` covering soft-delete
  round-trip, restore, permanent delete, age-based purge alarm, reinstall
  path. Smoke test: delete a script, restore from trash, verify enabled
  state preserved.
- **Complexity:** **M**.
- **Priority:** **P0**. [LR4]

### NF-4 — Virtual Scrolling in Script List

- **User problem solved:** dashboard render jank with 100+ scripts.
- **Evidence:** `ROADMAP.md` Phase 7.1 + Phase 18.5; CLAUDE.md notes
  10,657-line `dashboard.js`. Tampermonkey users with 200+ scripts report
  the same; no manager has shipped this cleanly.
- **Proposed behavior:** at script count `≥ 80` (threshold safely below
  the Phase 18.5 "100" cliff), enable a viewport-based renderer that
  only mounts rows in the visible area plus a configurable buffer (default
  20). Sort/filter operate on the full collection; only visible rows mount.
- **Implementation areas:** `pages/dashboard.js renderScriptTable` —
  replace the all-rows DOM build with a `VirtualList` helper. Use
  `@tanstack/virtual-core` (3 KB, zero deps). Keep current path when
  count `< 80` so small libraries don't pay overhead.
- **Risks & edge cases:**
  - Sticky table header and column-resize behavior need explicit
    handling under virtualization.
  - Card view (`dashboard-cardview.js`) needs the same treatment.
  - Shift-click range selection must work across non-rendered rows
    (selection is logical, not DOM-bound).
- **Verification:** new `tests/dashboard-virtual-scroll.test.js` covers
  threshold activation, scroll offset accuracy, and selection across the
  threshold. Smoke: seed 500 scripts via the smoke harness, verify
  paint < 200 ms at scroll.
- **Complexity:** **M**.
- **Priority:** **P0**. [LR3]

### NF-5 — Auto-Grant Inference Live in Editor (uses existing Acorn)

- **User problem solved:** script authors forget `// @grant GM_xxx` and
  silently miss API access; current linter only flags it after save.
- **Evidence:** `ROADMAP.md` Phase 15.2 — vite-plugin-monkey lists 28
  trackable GM identifiers; no manager does this live in their editor.
- **Proposed behavior:** Web Worker hosts an Acorn parse of the current
  Monaco buffer (debounced 600 ms after typing pause); walks `Identifier`
  and `MemberExpression` nodes against a 28-name allowlist; diffs vs the
  parsed `meta.grant` array; surfaces a non-intrusive editor toolbar
  banner "Detected: GM_setValue, GM_xmlhttpRequest → [Add to @grant]".
- **Implementation areas:** new `pages/dashboard-autograntw.js` Worker
  (Acorn already in `lib/acorn.min.js`); wire to editor `onDidChangeModelContent`;
  banner UI in `pages/dashboard.html` editor pane.
- **Risks & edge cases:**
  - Worker must respect `@require` imports — if `_` or `$` is provided
    by `@require https://cdn/lodash.js`, don't flag.
  - User dismissal must persist per-script (suppression).
- **Verification:** new `tests/dashboard-autograntw.test.js`; sample
  buffer with known GM_* usage parsed in unit test.
- **Complexity:** **M**.
- **Priority:** **P1**. [LR6]

### NF-6 — `GM_fetch` (Promise-based fetch wrapper)

- **User problem solved:** modern userscript authors expect a
  `Promise<Response>` API. Today they're stuck with `GM_xmlhttpRequest`
  callbacks or hand-rolled fetch wrappers.
- **Evidence:** `ROADMAP.md` Phase 16.1; FireMonkey-only feature today;
  TM #1050 closed without implementation; no Chrome MV3 manager has it.
- **Proposed behavior:**
  ```js
  // @grant GM_fetch
  const resp = await GM_fetch(url, init);
  const text = await resp.text();
  ```
  Background SW issues the actual fetch with extension host permissions
  (bypasses CORS); response streams back via a `chrome.runtime.connect`
  long-lived port; `Response` object is reconstructed on the content
  side. Honors existing `@connect` enforcement.
- **Implementation areas:** `background.core.js` GM_* dispatch; new
  `_streamFetchResponse(port, resp)` helper; wrapper-builder injects the
  `GM_fetch` shim in USER_SCRIPT world; `content.js` bridges port
  messages to/from the page.
- **Risks & edge cases:**
  - `Response.body` reconstruction requires careful chunking — start with
    a buffered `text()` / `arrayBuffer()` path; add streaming later.
  - Must integrate with Phase 16.4 CHIPS / `cookiePartition` once added.
  - `@grant GM_fetch` must enroll the script in `@connect` enforcement.
- **Verification:** new `tests/gm-fetch.test.js` mocking the port flow;
  manual: write a userscript that calls `GM_fetch` and reads a JSON body.
- **Complexity:** **M**.
- **Priority:** **P1**. [LR7]

### NF-7 — `signal` (AbortController) on `GM_xmlhttpRequest`

- **User problem solved:** modern AbortController integration; cancel
  multiple GM requests + native fetches with a single controller.
- **Evidence:** `ROADMAP.md` Phase 16.2; no manager supports this; all
  use a `.abort()` control object.
- **Proposed behavior:** accept `signal?: AbortSignal` in the request
  options; bridge `signal.addEventListener('abort', () =>
  nativeReq.abort())`; propagate `signal.reason` to the `onabort`
  callback.
- **Implementation areas:** `modules/xhr.js XhrManager.create`; ensure
  AbortController is preserved across the bridge (postMessage `signal`s
  can't cross — encode as an ID, listen for `abort` cross-bridge).
- **Risks & edge cases:**
  - `AbortSignal` is not structured-cloneable; must transport via an ID
    + a parallel `abort` message rather than passing the signal directly.
- **Verification:** new test in `tests/xhr.test.js` covering signal-abort
  and `signal.reason` propagation.
- **Complexity:** **S**.
- **Priority:** **P1**. [LR7]

### NF-8 — Unified Observability Dashboard (Phase 20 — single panel)

- **User problem solved:** users diagnose "why isn't my script working"
  by hunting across the popup, side panel, dashboard, and DevTools panel.
- **Evidence:** `ROADMAP.md` Phase 20; data sources (`netlog.js`,
  `error-log.js`, per-script `stats`) all exist; missing UI.
- **Proposed behavior:** consolidate into a dashboard "Activity" tab with
  three subtabs:
  - **Execution** — per-script run count, avg/median/p95 time, last-run
    timestamp, error count. Sort + filter.
  - **Network** — current `dashboard-debugger.js` waterfall view + HAR
    export, filtered per script.
  - **Errors** — `modules/error-log.js` output, categorized by source
    (syntax / runtime / promise / timeout).
- **Implementation areas:** new `pages/dashboard-activity.js` lazy
  module; reuse existing data from `chrome.runtime` messages
  (`getStats`, `getNetworkLog`, `getErrorLog`).
- **Risks & edge cases:**
  - With virtual scrolling (NF-4), per-script rows in Execution view need
    the same treatment; reuse the helper.
  - Privacy: do not log response bodies (already a Phase 20.5 invariant).
- **Verification:** new `tests/dashboard-activity.test.js` covering each
  subtab's data binding.
- **Complexity:** **M**.
- **Priority:** **P1**. [LR5]

### NF-9 — Pattern Sidebar Hit-Counts (extends Phase 39.15)

- **User problem solved:** "which of my 50 `@exclude` patterns is doing
  nothing?". Phase 39.15 shipped sort + filter for the per-script
  pattern list, but hit-count sort is "deferred — Phase 20.5 analytics
  not yet populated".
- **Evidence:** TM issue #2780, Phase 39.15 status note.
- **Proposed behavior:** per-script matched-tab analytics ring buffer
  (`script._matchHits: Map<patternHash, count>`); on each `userScripts`
  injection success, increment the hit count for the matched pattern;
  surface as a small numeric badge next to each pattern in the editor's
  pattern sidebar; "Sort by hit count" option in the existing sort menu
  flips ascending so unused patterns rise to the top with `(0)` badge.
- **Implementation areas:** `background.core.js` injection success path;
  `pages/dashboard.js` pattern list render.
- **Data model:** counts persisted in `chrome.storage.session` (in-memory
  is fine — these reset cheaply); optional persistence in
  `chrome.storage.local` behind a setting if users want long-term data.
- **Risks & edge cases:**
  - Hit counts must not be exfiltrated via `getStats` to web origins (the
    public API).
- **Verification:** new `tests/pattern-hit-counts.test.js`; manual: install
  a script with 5 patterns, navigate, see hit counts increment.
- **Complexity:** **S**.
- **Priority:** **P2**.

### NF-10 — Structured-Clone Messaging Opt-In (Phase 36.1)

- **User problem solved:** internal dev-experience — drop the
  `Array.from(map.entries())` workaround in dashboard message payloads
  and shed JSON-serialization overhead.
- **Evidence:** `ROADMAP.md` Phase 36.1 + `docs/extension-interop.md`
  (Phase 37.4 matrix shipped; gate is green). ScriptVault is closed-loop
  today; the cutover is zero blast-radius until a vscode.dev companion
  ships.
- **Proposed behavior:** add `"message_serialization": "structured_clone"`
  to `manifest.json`; bump `minimum_chrome_version` to 148 (already 130;
  Phase 40.23 raised it). Audit `chrome.runtime.sendMessage` payloads
  for opportunities to pass `Map` / `Set` / `Date` / `Blob` directly.
- **Implementation areas:** `manifest.json` one-line; `pages/dashboard.js`
  network-log payload simplification; `modules/notifications.js`
  `_recentUpdates` ring.
- **Risks & edge cases:**
  - `minimum_chrome_version` bump cuts off Chrome < 148. Per Phase 40.23,
    we're already at 130. Bumping further is a calendar gate.
  - Existing test mocks may need updates if payload shapes change.
- **Verification:** existing `tests/*.test.js` should pass unchanged;
  add a regression test that round-trips a `Map` through a mock message
  channel.
- **Complexity:** **S**.
- **Priority:** **P2**.

---

## Existing Feature Improvements

This section enumerates **specific defects, weak abstractions, and UX
papercuts** observed during the code audit. Each entry is small and
locally fixable; grouped roughly by surface.

### EI-1 — Promote `src/` to canonical build source (Phase 1.5)

- **Current behavior:** `esbuild.config.mjs` concatenates `.js` files;
  `src/**/*.ts` is type-check only. Drift between the two surfaces has
  caused ≥3 documented bug waves (Round 10 alone: 22 drift bugs in
  `src/modules/storage.ts`, `src/background/*.ts`, etc.).
- **Recommendation:** flip the build to use `src/` as source. esbuild
  bundles `src/background/index.ts` into `background.js` (and one bundle
  per extension page where lazy splitting helps). Delete the
  concatenation logic in `esbuild.config.mjs` and the per-module read
  paths. Run all tests against the new build before deleting the runtime
  JS sources.
- **Code locations:** `esbuild.config.mjs`, `src/background/index.ts`
  (currently a barrel re-export), every `.js` file in `modules/`, `bg/`,
  `shared/`, plus `background.core.js`.
- **Backward compatibility:** none — runtime behavior unchanged, only the
  build pipeline. Existing tests already import from `src/`.
- **Verification:** `npm test` passes; `npm run smoke:dashboard` passes;
  diff the built `background.js` against pre-migration baseline (no
  semantic delta expected, only minification / module ordering shifts).
- **Complexity:** **L** (multi-week; touches every module).
- **Priority:** **P0**. [LR1]

### EI-2 — Migrate `pages/dashboard.js` (10,657 lines) to `src/pages/`

- **Current behavior:** the largest unmigrated source file. Co-resident
  state, render, and event-handler logic.
- **Recommendation:** following EI-1, split `pages/dashboard.js` into the
  `src/pages/dashboard/` modules already enumerated in Phase 1.5
  (Wave 5 #24): `state.ts`, `render.ts`, `events.ts`, `tabs.ts`,
  `editor.ts`, etc. Existing `dashboard-*.js` lazy modules stay as-is
  initially; the giant file is the priority.
- **Code locations:** `pages/dashboard.js` → `src/pages/dashboard/*.ts`.
- **Backward compatibility:** none for users; for contributors, the
  file map changes.
- **Verification:** `npm run typecheck` + `npm test` + Chrome smoke
  test exercise all primary tabs.
- **Complexity:** **XL**.
- **Priority:** **P1**. [LR10]

### EI-3 — Promote `src/types/messages.ts` to cover all 220+ actions

- **Current behavior:** `ResponseMap` covers ~25 of 135+ message actions;
  rest fall back to `unknown` (verified — `background.core.js` has 221
  `case '…':` arms in its dispatch switch).
- **Recommendation:** enumerate every `case` in `background.core.js`,
  add a `ResponseFor<T>` entry per action, fail CI typecheck if a new
  action lands without a mapping (Phase 40.13).
- **Code locations:** `src/types/messages.ts`, `src/types/script.ts`,
  `src/types/settings.ts`.
- **Backward compatibility:** none — typecheck-only change.
- **Verification:** `npm run typecheck` after the work passes; new
  ESLint-equivalent rule (or a custom `tests/messages-coverage.test.js`)
  verifies every action has a typed response.
- **Complexity:** **M** (mechanical but laborious).
- **Priority:** **P1**.

### EI-4 — Replace dual workspaces/profiles with a single concept

- **Current behavior:** `bg/workspaces.js` ("named snapshots of
  enabled/disabled script states for quick context switching") and
  `pages/dashboard-profiles.js` ("Multi-profile support") cover overlapping
  problems with slightly different semantics. README says both;
  CLAUDE.md "Architecture" calls them out separately.
- **Recommendation:** pick one name (workspaces is more common in the
  ecosystem; profiles overlaps with browser profiles), migrate the data
  model, deprecate the other module with a one-time migration prompt.
- **Code locations:** `bg/workspaces.js`, `pages/dashboard-profiles.js`,
  `src/bg/workspaces.ts`, references in `pages/dashboard.html`,
  `pages/popup.js`.
- **Backward compatibility:** users with existing profiles need their
  data migrated into the workspace store. Add a one-shot migration in
  `modules/migration.js` keyed on a version stamp.
- **Verification:** new `tests/profiles-to-workspaces-migration.test.js`;
  manual: create a profile in pre-migration build, upgrade, verify it
  appears as a workspace.
- **Complexity:** **M**.
- **Priority:** **P2**.

### EI-5 — Move `dashboard-firefox-compat.js` behind a runtime detect

- **Current behavior:** the polyfill module loads on every dashboard
  open even on Chrome.
- **Recommendation:** the lazy-loader (`pages/dashboard-lazy-loader.js`)
  already supports on-demand loading. Move `dashboard-firefox-compat`
  into `ON_DEMAND_MODULES` keyed on `typeof browser !== 'undefined' ||
  navigator.userAgent.includes('Firefox')`. Save ~27 KB of cold-load
  cost on Chrome.
- **Code locations:** `pages/dashboard-lazy-loader.js`.
- **Backward compatibility:** none.
- **Verification:** `tests/dashboard-modules.test.js` audit; manual:
  Firefox load (when port lands) still loads the polyfill.
- **Complexity:** **XS**.
- **Priority:** **P2**.

### EI-6 — `bg/analyzer.js` regex fallback overlaps the AST path

- **Current behavior:** `bg/analyzer.js` carries both an AST dispatch via
  offscreen *and* a 31-pattern regex fallback. The regex path strips
  comments / strings imperfectly (verified — note in the source itself
  about URL false positives). The two paths can produce different
  findings for the same script.
- **Recommendation:** make the AST path mandatory (offscreen is always
  available on Chrome 109+, well below Chrome 130 floor); demote the
  regex fallback to a debug-only smoke check. Document the policy in
  CLAUDE.md and `src/bg/analyzer.ts`.
- **Code locations:** `bg/analyzer.js`, `src/bg/analyzer.ts`, `offscreen.js`.
- **Backward compatibility:** install dialog may show fewer findings for
  pathologically large scripts where Acorn parse fails — keep a parse-
  error path that surfaces "AST analysis failed; manual review
  recommended" rather than falling back to regex.
- **Verification:** existing `tests/analyzer.test.js` already covers AST
  path; regex-path tests can be removed once the path is gone.
- **Complexity:** **S**.
- **Priority:** **P2**.

### EI-7 — `pages/devtools-panel-v2.js` is unreferenced

- **Current behavior:** 58 KB file alongside `devtools-panel.js`; no
  manifest entry or script tag references it.
- **Recommendation:** confirm via `grep -r "devtools-panel-v2"` that it
  is dead, then delete. If it was an in-progress redesign, file a tracking
  issue and gitignore the file until restarted.
- **Code locations:** `pages/devtools-panel-v2.js`.
- **Backward compatibility:** none.
- **Verification:** `npm test` + smoke test pass.
- **Complexity:** **XS**.
- **Priority:** **P3**.

### EI-8 — Update `manifest-firefox.json` to track Chrome version on every release

- **Current behavior:** stale at v2.1.8 while Chrome manifest is at
  v3.11.0. Phase 38 status notes ascribe this to "Firefox port deferred
  separately".
- **Recommendation:** even without shipping the port, keep
  `manifest-firefox.json` version in lock-step with `manifest.json`.
  Add to `publish.sh` (or a pre-commit hook) a sync step that writes
  `manifest-firefox.json.version = manifest.json.version`. When the
  port lands, this prevents another v3.11 vs v2.1 mismatch.
- **Code locations:** `publish.sh`, `manifest-firefox.json`,
  `package.json` (the script that bumps `manifest.json`).
- **Backward compatibility:** none.
- **Verification:** run `bash publish.sh --draft`; verify both manifests
  match.
- **Complexity:** **XS**.
- **Priority:** **P3**.

### EI-9 — Delete legacy bash builder (`build-background.sh`)

- **Current behavior:** `build-background.sh` is "marked deprecated; now
  execs the Node builder" per CLAUDE.md Round 10. The file still exists;
  the comment-only wrapper is unused.
- **Recommendation:** delete. Verify `build.sh` is the only entry point.
- **Code locations:** `build-background.sh`.
- **Backward compatibility:** anyone with a CI somewhere still calling
  the bash builder gets a clean failure; document in CONTRIBUTING.
- **Complexity:** **XS**.
- **Priority:** **P3**.

### EI-10 — Move `coverage/` to `.gitignore`

- **Current behavior:** `coverage/` directory committed (presence
  confirmed by `ls -la` listing); generated by `npm run test:cov`.
- **Recommendation:** delete the committed directory; add `coverage/`
  to `.gitignore`.
- **Code locations:** `.gitignore`, `coverage/`.
- **Backward compatibility:** none.
- **Complexity:** **XS**.
- **Priority:** **P3**.

### EI-11 — Stray `-p` directory at repo root

- **Current behavior:** `ls -la` shows a directory named `-p` at the
  repo root, likely created by a typoed `mkdir -p` invocation
  (`mkdir -p some/path` works; `mkdir "-p"` or `mkdir -- -p` literally
  creates a directory named `-p`).
- **Recommendation:** verify it's empty / safe; remove with `rm -rf -- -p`.
  This must be explicitly user-confirmed since the leading-dash invocation
  is the kind of typo that produced it in the first place.
- **Code locations:** `-p/` at repo root.
- **Backward compatibility:** none.
- **Complexity:** **XS**.
- **Priority:** **P3**.

### EI-12 — Promote omnibox keyword to README quick-start

- **Current behavior:** `manifest.json` declares `"omnibox": { "keyword":
  "sv" }`; user docs don't mention it. Phase 39.29 shipped per ROADMAP.
- **Recommendation:** add a line to `README.md` § Quick Start: "Type
  `sv <script-name>` in the address bar to fuzzy-search installed scripts
  and open them in the editor."
- **Code locations:** `README.md` Quick Start.
- **Complexity:** **XS**.
- **Priority:** **P2**.

### EI-13 — Document the Public API for third-party integrators

- **Current behavior:** `modules/public-api.js` implements a capability-
  token + webhook + rate-limited message API. README does not mention it;
  no integration guide exists.
- **Recommendation:** new `docs/public-api.md` documenting message
  shapes, capability flow (`requestAccess({origin, permissions})`),
  webhook contract, rate limits. This unlocks Phase 12.14 (vscode.dev)
  and other ecosystem integrations.
- **Code locations:** `docs/public-api.md`, README link.
- **Complexity:** **S**.
- **Priority:** **P2**.

### EI-14 — Linter false positives on dynamic GM_* references

- **Current behavior:** `pages/dashboard-linter.js` flags missing
  `@grant` for `GM_*` identifiers; auto-grant inference (NF-5) would
  shadow this but the existing linter still reports false positives on
  scripts that use computed property access (`window['GM_' + name]`).
- **Recommendation:** under NF-5's Acorn worker, replace the linter's
  string-based scan with the AST-based scan. Falls out for free if NF-5
  ships first.
- **Code locations:** `pages/dashboard-linter.js`.
- **Complexity:** **S** (subsumed by NF-5).
- **Priority:** **P2**.

### EI-15 — Empty-state copy in the dashboard scripts table

- **Current behavior:** new install with zero scripts shows an empty
  table with no guidance. Phase 34.8 already mandates the "no wizard, but
  add helpful empty-state" pattern.
- **Recommendation:** add a three-button empty state per Phase 34.8 —
  `[Add from URL]` / `[Write new]` / `[Browse Greasy Fork]`. Lives in
  `pages/dashboard.html`.
- **Code locations:** `pages/dashboard.html`, `pages/dashboard.js
  renderScriptTable`.
- **Complexity:** **S**.
- **Priority:** **P2**.

### EI-16 — Surface `@signature` trust in install dialog

- **Current behavior:** Ed25519 signing is shipped (`bg/signing.js`) but
  the install dialog (`pages/install.html`) doesn't surface signature
  status beyond a small badge.
- **Recommendation:** when a signed script's author key is in the trust
  store, prepend a green "✓ Signed by trusted author" banner; when signed
  but key untrusted, show "⚠ Signed by unknown author [Trust this
  author] [Skip]"; when unsigned, show the existing AST risk score
  unchanged.
- **Code locations:** `pages/install.html`, `pages/install.js
  renderSignatureBlock`.
- **Complexity:** **S**.
- **Priority:** **P2**.

### EI-17 — Sidepanel sort dropdown doesn't disable when only 1 script

- **Current behavior:** sort `<select>` is always interactive even when
  the matched-scripts list has one or zero entries.
- **Recommendation:** disable the sort + search controls when matched
  count `≤ 1`; surface a helpful "No scripts run on this page" empty
  state per Phase 34.8.
- **Code locations:** `pages/sidepanel.html`, `pages/sidepanel.js render`.
- **Complexity:** **XS**.
- **Priority:** **P3**.

---

## Reliability, Security, Privacy, and Data Safety

The project's audit history (Rounds 1–13, with documented "shipped" /
"deferred" / "rejected" outcomes per item) covers most attack surfaces.
This section enumerates **bugs and risks that the audits have flagged as
deferred or that I observed during this pass** — i.e., what's still
outstanding.

### Open security / reliability items

| Item | Status | Origin | Recommended next step |
|---|---|---|---|
| `window.onurlchange` listener stack-up across re-injection | Deferred Phase 40.11 | CLAUDE.md "Known Remaining Issues" | Page-scoped `__svUrlChangeBound__` guard + shared dispatcher. Effort 3/5. Risk 3/5. |
| Per-script update consent (auto-install on click) | Per-row modal shipped 38.9; no global setting | Phase 17.3 promoted Now-priority-1 in R11/R12 | NF-1 above. |
| Capability tokens not actually issued (web origins still deny-by-default) | Partial — deny-by-default works; capability-token issuance not implemented | Phase 5.4 | When Phase 12.14 vscode.dev companion lands, also wire capability-token issuance. |
| Cloud-sync passphrase encryption | Pending | Phase 5.5 status note | Honest path: "passphrase-protected" backup encryption via Web Crypto (Phase 21.4 design). Keep the storage model honest in UX. |
| Script body integrity hash at injection time | Not implemented | Phase 17.1 | Stretch P1 item — re-hash before each registration and abort if mismatch. |
| `messages.ts` ResponseMap incomplete | ~25/135 typed | Phase 40.13 | EI-3 above. |
| `BackupScheduler` stores full ZIP blobs in `chrome.storage.local` | Known stale | CLAUDE.md "Known Remaining Issues" | Phase 8.4 IDB raw-ArrayBuffer storage; gated on bigger sync rewrite. |
| `setTimeout` short-lived fetch aborts in MV3 SW | Best-effort cleanup | CLAUDE.md "Known Remaining Issues" | Acceptable — documented; revisit if SW death within 5 min becomes a real complaint. |
| `dashboard-pattern-builder.js` regex fragile for edge-case patterns | Known stale | CLAUDE.md | Replace with `URLPattern` once Phase 22.2 lands. |
| All font sizes in `px` (ignores user browser font-size) | Known stale | CLAUDE.md | Phase 14.1 — mechanical `px → rem` audit. |

### Missing guardrails

- **No CSP report endpoint surfacing** — `dashboard-csp.js` reports CSP
  block events but doesn't surface them to the user as a friendly toast
  when a script silently fails to inject due to CSP. Phase 12.12 plans
  runtime permission diagnostics for `GM_xmlhttpRequest`; a related
  affordance for script-injection CSP blocks would close the
  "why isn't my script running" diagnostic gap.
- **No tamper-evident audit log** — Phase 17.2 plans this; no progress
  yet. P2 item.
- **No update-server signature verification** — `@updateURL` content
  is fetched and parsed but not cryptographically verified. Phase 11.8
  `@require` SRI is in place; an `@updateURL` SRI extension is a natural
  follow-on.

### Permission / network / file-system concerns

- `host_permissions: ['<all_urls>']` is unavoidable for a userscript
  manager; CWS reviewers historically accept this for managers (Phase
  19.6).
- `chrome.cookies` is `optional_permissions` — well-scoped.
- `chrome.identity` is `optional_permissions` — well-scoped (used only
  for Easy Cloud).
- `webRequest` is NOT requested — uses `declarativeNetRequest` instead;
  CWS-friendly.

### Recovery and rollback

- ScriptStorage rollback contract pinned by Phase 38.13's 7 tests.
- Workspace rollback shipped (`f5f6640`).
- Trash bin (NF-3) is the missing piece for soft-recovery.
- Sync conflicts already raise `mergeConflict` flag; UI surface is
  missing (Phase 8.2 conflict UI is not yet shipped).

### Logging and diagnostics

- `modules/error-log.js` is 500-entry FIFO; debounced save shipped in
  iter-2 (ERRLOG-PERF).
- Debug logger is conditional on `settings.debugMode === true`.
- No remote telemetry, by stated policy (PRIVACY.md).
- A "Copy diagnostics to clipboard" affordance for bug reports would
  reduce support load — not in current ROADMAP; suggest adding.

---

## UX, Accessibility, and Trust

### Onboarding gaps

- **First-run empty state** is a stub. Phase 34.8 mandates the three-button
  empty state ([Add from URL] / [Write new] / [Browse Greasy Fork]).
  EI-15 above.
- **No tutorial** is correct per anti-bloat — but the empty state is
  load-bearing for new users.
- **Chrome 138 "Allow User Scripts" toggle** — Phase 39.10 shipped the
  runtime self-diagnosis banner with a direct deep-link. Verify it
  surfaces on Chrome 138+ first-run.

### Empty / loading / error / disabled states

- The script table empty state is covered above (EI-15).
- DevTools panel has an auto-refresh 3 s timer but no "loading" indicator
  during the refresh.
- Cloud sync error states show a toast but no chip persistence; Phase
  39.26 partially shipped the test-connection + plain-language hint
  background handler — dashboard chip still pending.
- Sidepanel empty state when no scripts run on the current page is
  better handled by EI-17.

### Destructive / irreversible actions

- Bulk delete confirmation: shipped (Phase 7.4 + Phase 38.13 contract).
- Single delete is undo-via-toast for 5 seconds (Phase 12.13 / NF-3 is
  the durable trash bin).
- Factory reset: shipped (`cdf17ae`); confirmation dialog warns.
- Workspace activation rollback: shipped (`f5f6640`).
- `clearAllScripts()` from the public API should be re-audited for
  capability-token gating (Phase 5.4) — currently it requires an
  origin-issued token, but the issuance flow is unfinished.

### Settings clarity

- Settings panel is a wall of toggles. Phase 38.8 standardized labels to
  match VM/TM convention (Settings / Update / Sync). Section filters
  (`settingsPanelFilter`) help, but a search box across all settings
  would be a small win — already partially there via the command palette
  (Ctrl+K).
- No "Settings reset to defaults" path that's not a full factory reset;
  consider adding a per-section reset.

### Accessibility (WCAG 2.1 AA today; 2.2 + 3 pending)

- `:focus-visible` shipped across all surfaces (CLAUDE.md UX/UI).
- ARIA: popup submenu items have `role="button"` + `tabindex="0"`;
  sidepanel has `aria-label` on icon-only buttons; install page has
  focus-visible.
- WCAG 2.2 criteria (Phase 14.2 focus-visibility, 14.3 target sizes,
  14.4 toggle screen reader announce, 14.5 drag-sort keyboard
  alternative) are partially shipped or pending — see
  `docs/wcag3-gap-analysis.md` for the per-criterion matrix.
- Forced-colors / Windows High Contrast: Phase 34.4 not yet shipped.
- Reduced motion: Phase 34.5 not yet shipped.
- Drag-and-drop sort: no keyboard alternative yet (Phase 14.5 + 34.3 grid
  APG pattern).

### Microcopy / trust signals

- Install dialog already shows `@grant` permission breakdown, AST risk
  score, signature status (when signed).
- Trust signals would benefit from EI-16 (surface signed-author trust
  more prominently).
- Phase 34.6 (plain-language error messages) is a one-pass audit; not
  yet done.
- The "this script accesses crypto/wallet APIs" heuristic (Phase 39.16)
  was shipped per ROADMAP — verify the keyword allowlist covers the
  current scam-script landscape (annual review).

---

## Architecture and Maintainability

### Module / boundary improvements

- **EI-1 / EI-2 / EI-3** are the major lifts here; they move ScriptVault
  from "two parallel source trees with drift" to "TS is the source".
- **Dashboard module count (27 in `pages/dashboard-*.js`)** is at the
  edge of comprehensibility. After the TS migration (EI-2), consider
  grouping logically: `editor/`, `lists/`, `panels/`, `widgets/`,
  `compat/`. Today they sit in a flat directory.
- **`background.core.js` is 8,515 lines** with a 221-case dispatch
  switch. Phase 1.4 already split the TS mirror into 13 modules; the
  build flip (EI-1) makes the runtime adopt that structure.
- **Lazy-loader audit** (`pages/dashboard-lazy-loader.js`) — verify the
  `EAGER_MODULES` set is minimal (current count: 7 per CLAUDE.md). The
  defer-until-tab-switched pattern is solid.

### Refactor candidates

- **Workspaces vs profiles** (EI-4) — pick one concept.
- **`bg/analyzer.js` AST + regex dual path** (EI-6) — promote AST,
  demote regex.
- **`pages/devtools-panel-v2.js`** (EI-7) — clarify or delete.
- **`monaco-adapter.js` _valueCallbacks` Map** — already confirmed dead
  code per Round 13 audit-only entry; if not yet removed, remove.

### Test gaps

- 45 test files, 769 cases is excellent for a project this size.
- Specific gaps observed:
  - **No E2E tests for the install flow** (Phase 10.3 plans these). The
    `smoke:dashboard` covers dashboard render only. Adding a Puppeteer
    test that fetches a userscript URL → install → enable → verify
    runtime execution would close the largest E2E gap.
  - **No fuzz test for the parser** (Phase 10.5 plans).
  - **No virtual-scroll test** (NF-4 will add).
  - **No trash-bin test** (NF-3 will add).
- Pre-existing test errors documented in CLAUDE.md memory ("spa_mount
  test errors are pre-existing") — verify these are still flagged as
  expected; if not, fix.

### Documentation gaps

- **No `docs/public-api.md`** (EI-13) — Public API is undocumented for
  third-party integrators.
- **No `CONTRIBUTING.md`** — referenced by Phase 37.2 status note but
  doesn't exist at repo root (confirmed by `ls`). Add a minimal one
  describing: build setup, test cadence, commit conventions (no
  `Co-Authored-By: Claude` per `teamstation-commit-style` memory? — verify
  this project's preference; current commits don't show Co-Authored
  trailers either).
- **No release-notes template** beyond what's in `CHANGELOG.md` — fine
  as-is.
- **`docs/enterprise-policy-sample.md`** referenced from Phase 39.8;
  verify it exists, write if not.

### Release / build / deployment gaps

- CWS API v2 cutover (Phase 39.2) gated on Phase 39.1 OIDC plumbing.
  Both are docs-only at present; pre-Oct-15 implementation is the
  schedule pressure.
- `publish.sh --draft` artifact preservation shipped (Phase 40.8).
- Edge Add-ons listing not yet done (Phase 19.1 / 33.4).
- Firefox AMO listing blocked on Phase 1 of port.
- `package.json` `clean` script uses a CommonJS-mode workaround for ESM
  — verify it still works on Node 22+.

---

## Prioritized Roadmap

The full multi-phase roadmap is in `ROADMAP.md`. This section is a flat,
acceptance-criteria-driven punch list filtered to **items a coding agent
can pick up next**. Items are tagged with their `LR<n>` from the Executive
Summary where applicable.

### Phase A — Build pipeline + drift elimination (Weeks 1–4)

- [ ] **P0** — Flip esbuild to use `src/` as build source (EI-1) [LR1]
  - Why: TS-mirror drift has caused 22+ documented bugs; consolidates
    the source tree.
  - Evidence: Round 10 audit; Phase 1.5; `esbuild.config.mjs` still
    concatenates `.js`.
  - Touches: `esbuild.config.mjs`, `src/background/index.ts` (entry),
    delete `background.core.js` after parity verified.
  - Acceptance: `npm run build` produces a `background.js` whose
    behavior is byte-equivalent (post-minify) to the current build;
    `npm test`, `npm run typecheck`, `npm run smoke:dashboard` all pass.
  - Verify: `git diff` the built `background.js` line-count change is
    small (TS adds bundler header but no semantic delta); run smoke
    test against the new build.

- [ ] **P1** — Promote `messages.ts` ResponseMap to cover all 135+
      actions (EI-3 / Phase 40.13)
  - Why: completes Phase 1's typed-messaging guarantee.
  - Evidence: 221 case arms counted in `background.core.js`; Round 13.
  - Touches: `src/types/messages.ts`, all background handlers.
  - Acceptance: typecheck passes with zero `unknown` fallbacks;
    coverage-test asserts every action has a mapping.
  - Verify: `grep -c "^\s*case '" background.core.js` (or
    `src/background/index.ts` post-EI-1) equals count of
    `ResponseMap[...]` entries.

### Phase B — User-facing P0 wins (Weeks 2–6, parallelizable with Phase A)

- [ ] **P0** — Global Update Consent setting (NF-1) [LR2]
  - Why: VM #1023's most-painful documented behavior; TM 5.5.0 shipped
    parity.
  - Evidence: Phase 17.3 promoted Now-priority-1 R11/R12.
  - Touches: `src/config/settings-defaults.json`, `pages/dashboard.html`
    settings panel, `background.core.js` applyUpdate, `modules/migration.js`.
  - Acceptance: setting persists across SW restart; all three modes
    behave correctly; existing per-row Phase 38.9 modal subsumed by
    `'review'` mode.
  - Verify: `tests/core-flows.test.js` adds three-mode coverage; manual:
    flip mode, install update upstream, observe behavior.

- [ ] **P0** — Trash with 30-day recovery (NF-3) [LR4]
  - Why: VM #2144; single most-cited user complaint across managers.
  - Evidence: Phase 12.13.
  - Touches: `src/storage/script-db.ts` (`scripts_trash` store),
    `modules/storage.js ScriptStorage.delete`, new `pages/dashboard-trash.js`,
    `pages/dashboard.html` sidebar.
  - Acceptance: delete → restore round-trips with enabled state intact;
    age-based purge triggers via alarm; storage indicator accounts for
    trash size.
  - Verify: new `tests/storage-trash.test.js`; manual: delete, wait,
    restore.

- [ ] **P0** — Virtual scrolling in script list (NF-4) [LR3]
  - Why: jank above ~100 scripts; ROADMAP Phase 7.1 + 18.5.
  - Evidence: no manager has shipped this cleanly; users with 200+
    scripts complain.
  - Touches: `pages/dashboard.js renderScriptTable`,
    `pages/dashboard-cardview.js`.
  - Acceptance: 500-script seeded library scrolls at native rate; no
    regression in sort/filter/select.
  - Verify: new `tests/dashboard-virtual-scroll.test.js`; smoke test
    seeds 500 scripts.

- [ ] **P0** — Diff view before update (NF-2) [LR8]
  - Why: VM #500, 80+ upvotes — single most-reacted enhancement.
  - Evidence: existing `dashboard-diff.js` LCS already implements; Phase
    38.9 modal wires the per-row click.
  - Touches: lift `dashboard-diff.js` into `pages/dashboard-update-review.js`;
    hook into `background.core.js applyUpdate` review-mode path; sync
    conflict path.
  - Acceptance: every "Manual review" mode update opens the diff; same
    diff offered for sync conflicts.
  - Verify: `tests/update-flow-diff.test.js`; manual: stage an update,
    see diff, apply.

### Phase C — P1 author DX + observability (Weeks 4–10)

- [ ] **P1** — Auto-grant inference live in editor (NF-5) [LR6]
  - Why: ScriptVault would be the first manager to do this live; Phase 15.2.
  - Touches: new `pages/dashboard-autograntw.js` Worker (Acorn), editor
    toolbar UI.
  - Acceptance: typing `GM_setValue` with no `@grant` triggers a
    suggestion within 1 s; click adds to header.
  - Verify: `tests/dashboard-autograntw.test.js`.

- [ ] **P1** — `GM_fetch` (NF-6) [LR7]
  - Why: first Chrome MV3 manager with native promise-fetch.
  - Touches: `background.core.js` GM_* dispatch, `modules/xhr.js`,
    `content.js` bridge, wrapper-builder.
  - Acceptance: a userscript can `await GM_fetch(url).then(r => r.text())`
    against a cross-origin URL.
  - Verify: `tests/gm-fetch.test.js`; manual: write a userscript that
    calls GM_fetch.

- [ ] **P1** — AbortSignal in `GM_xmlhttpRequest` (NF-7) [LR7]
  - Why: modern AbortController integration; Phase 16.2.
  - Touches: `modules/xhr.js XhrManager.create`, wrapper signal bridging.
  - Acceptance: `signal.abort()` cancels the GM_xhr and fires `onabort`.
  - Verify: `tests/xhr.test.js` adds signal-abort + reason cases.

- [ ] **P1** — Unified Observability panel (NF-8) [LR5]
  - Why: consolidates per-script execution / network / error data into
    one tab.
  - Touches: new `pages/dashboard-activity.js`; data sourced from
    existing background messages.
  - Acceptance: each subtab loads + filters per script.
  - Verify: `tests/dashboard-activity.test.js`.

- [ ] **P1** — Firefox port Phase 1 (clean sideload) [LR9]
  - Why: dual-target ships from same tag; AMO listing unlocks long-tail
    users.
  - Evidence: FIREFOX-PORT.md Phase 1 checklist.
  - Touches: `manifest-firefox.json` (sync to v3.11.0), feature-flag
    `chrome.offscreen` / `chrome.sidePanel` / `worldId` /
    sandboxed-iframe Monaco loading per FIREFOX-PORT.md.
  - Acceptance: temporary load in Firefox Nightly opens dashboard, popup
    works, one test userscript installs and runs.
  - Verify: load via `about:debugging`; run the existing smoke checks
    manually.

- [ ] **P1** — `pages/dashboard.js` to `src/pages/dashboard/` (EI-2) [LR10]
  - Why: largest unmigrated file; second-densest bug surface.
  - Touches: `pages/dashboard.js` → `src/pages/dashboard/*.ts`.
  - Acceptance: every existing dashboard test still passes; typecheck clean.
  - Verify: full test suite + smoke test.

### Phase D — P2 polish + ecosystem (Weeks 8–14)

- [ ] **P2** — Pattern sidebar hit-counts (NF-9)
  - Touches: `background.core.js` injection success path, dashboard
    pattern list.
  - Acceptance: each pattern row shows hit count badge; sort by hits
    works.

- [ ] **P2** — Structured-clone messaging opt-in (NF-10)
  - Touches: `manifest.json`, audit message payloads.
  - Acceptance: extension still works on Chrome 148+; `Array.from(...)`
    workarounds removed.

- [ ] **P2** — Trust badge in install dialog (EI-16)
  - Touches: `pages/install.html`, `pages/install.js`.

- [ ] **P2** — Empty-state in dashboard (EI-15)
  - Touches: `pages/dashboard.html`, `pages/dashboard.js`.

- [ ] **P2** — Public API documentation (EI-13)
  - Touches: new `docs/public-api.md`.

- [ ] **P2** — `dashboard-firefox-compat.js` lazy-load (EI-5)
  - Touches: `pages/dashboard-lazy-loader.js`.

- [ ] **P2** — AST-only analyzer (EI-6)
  - Touches: `bg/analyzer.js`, `src/bg/analyzer.ts`.

- [ ] **P2** — Workspaces/profiles unification (EI-4)
  - Touches: `bg/workspaces.js`, `pages/dashboard-profiles.js`,
    `modules/migration.js`.

- [ ] **P2** — Omnibox discoverability in README (EI-12)
  - Touches: `README.md`.

### Phase E — Cleanup (Weeks 12+, low effort)

- [ ] **P3** — Delete `build-background.sh` (EI-9)
- [ ] **P3** — Delete `pages/devtools-panel-v2.js` if unreferenced (EI-7)
- [ ] **P3** — Sync `manifest-firefox.json` version on every release (EI-8)
- [ ] **P3** — `.gitignore` `coverage/` (EI-10)
- [ ] **P3** — Remove `-p` stray directory (EI-11)
- [ ] **P3** — Sidepanel sort disable when empty (EI-17)

---

## Quick Wins (≤ 2 hours each)

- **EI-7** — Delete `pages/devtools-panel-v2.js` after confirming it's
  unreferenced. (`grep -rn devtools-panel-v2 .`)
- **EI-9** — Delete `build-background.sh`.
- **EI-10** — `.gitignore` `coverage/`.
- **EI-11** — `rm -rf -- -p` after user confirmation.
- **EI-12** — Add omnibox keyword `sv` to README quick-start.
- **EI-17** — Disable sidepanel sort+search when matched count ≤ 1.
- Bump `manifest-firefox.json` version to `3.11.0` (one-line, removes
  cross-platform confusion until Firefox port lands).
- Add `CONTRIBUTING.md` stub describing build + test cadence + commit
  conventions.
- Add an empty-state to the dashboard scripts table (EI-15).
- Move `dashboard-firefox-compat.js` into `ON_DEMAND_MODULES` (EI-5).

---

## Larger Bets

- **EI-1 / EI-2** — TypeScript migration completion. Multi-week; touches
  every module. The payoff is permanent: drift bug class is gone, build
  splits become possible, and Phase 18.1 SW cold-start work unblocks.
- **NF-3** — Trash bin with 30-day retention. ~2 weeks if IDB scaffolding
  is reused. UX-defining for power users.
- **NF-4** — Virtual scrolling. ~1 week including selection-across-
  threshold correctness work.
- **NF-1 + NF-2** — Update consent + diff view, as a coordinated wave.
  Together ~2 weeks. Closes the most-cited retention gap vs TM.
- **NF-6 + NF-7** — `GM_fetch` + AbortSignal. ~2 weeks combined; leapfrog
  every existing manager.
- **Firefox port Phase 1 + AMO listing** — 3–5 weeks per FIREFOX-PORT.md
  estimate. Unlocks a meaningful user base; pairs with `docs/cross-
  browser-pipeline.md` WXT migration design.
- **Phase 33 cross-browser WXT pipeline** — 2–3 weeks of build pipeline
  work; the precondition to all of Phase 33.2–33.6.
- **Phase 21.4 client-side encryption for cloud backup** — sized
  conservatively at 1 week; honest UX requires the gist token plain-text
  story to be told consistently.

---

## Explicit Non-Goals

The following ideas were considered during this research pass and
**rejected** with reasoning. They are in ROADMAP.md's Round 8–13 reject
lists; replicated here as a single-page summary.

- **AI script generation in-extension** (Tweeks / ClickRemix / GPT
  browser-extension patterns). Contradicts the anti-bloat doctrine and
  privacy-first positioning. Stays rejected.
- **Cloud-LLM agent UI** (ScriptCat v1.4-style). Requires API key UX,
  telemetry-prone tool calls, and a chat surface. The MCP-as-client
  subset (Phase 38.10) is the only salvageable piece, and only if the
  local-MCP-only constraint holds.
- **Script subscription / feed systems** (ScriptCat). Duplicates Greasy
  Fork's function. Rejected since Round 8.
- **Script-to-standalone-extension compiler.** Distribution tooling, not
  manager scope.
- **Multi-file ES module project IDE** (ScriptFlow). Out of scope for a
  manager.
- **WASM Component Model in-browser host** (Phase 32.1 deprio per R12).
  Server-side only in 2026; no Chromium roadmap.
- **Notification Triggers API** (Phase 11.11 deprecation note per R12).
  Officially discontinued. Don't plan against it.
- **CHIPS / `cookiePartition` in `GM_xmlhttpRequest`** (Phase 16.4) —
  worth doing eventually but the API is still evolving; defer until the
  spec stabilizes.
- **Mobile support** — desktop-only Chrome extension; no mobile Chrome
  runtime supports userscripts. Phase 29 PWA is a separate research item.
- **Yjs-based CRDT sync** (Phase 29.4) — 600+ KB dependency for a
  per-field merge problem that the existing 3-way merge handles. Phase
  29 should ship without Yjs unless and until a clear demand emerges.
- **First-run "Allow Userscript Injection" permission gate** (Phase 39.6)
  — redundant with Chrome 138's per-extension toggle (already surfaced
  by Phase 39.10 self-diagnosis). Stays deferred unless CWS policy
  mandates.
- **In-page context-menu integration for `GM_registerMenuCommand`**
  (Phase 39.7) — needs a per-script settings UI that doesn't exist yet
  in the cleanest form. Bundle with the next dashboard-settings UX pass.
- **Same-origin shortcut in `GM_xmlhttpRequest`** (Phase 39.14) — would
  bypass `@connect` enforcement, network log capture, and `anonymous`
  cookie isolation for a ~5ms saving. Not worth it.

---

## Open Questions

These are decisions that **block prioritization or implementation** and
that the existing codebase / docs / public sources cannot answer.

1. **Is Phase 17.3 Update Consent strictly user-facing parity with TM, or
   does it need to also handle the Phase 8 sync-conflict UI in the same
   review surface?** NF-1 and NF-2 above assume "yes — same surface";
   confirm before the final UX wireframe.
2. **For NF-3 trash, is 30 days the right default retention, or 90?**
   Both are defensible. 30 matches Phase 12.13 spec; 90 reduces user
   surprise on infrequent dashboard openers.
3. **Does the maintainer want to keep `manifest-firefox.json` in lock-step
   with `manifest.json` even before the port lands** (per EI-8), or
   freeze it at the last validated Firefox version?
4. **For NF-10 structured-clone messaging, is bumping `minimum_chrome_
   version` to 148 acceptable now?** Current floor is 130 (Phase 40.23).
   Bumping to 148 is conservative if the user base is "modern Chrome on
   desktop"; aggressive if there's a long-tail Chrome 130–147 user
   population that telemetry would normally surface but the project
   refuses to collect (per PRIVACY.md).
5. **For NF-6 `GM_fetch`, do we add it to the `optional_permissions`
   surface so users opt-in per script, or auto-enroll any script with
   `@grant GM_fetch`?** TM's pattern would auto-enroll; the
   permission-conscious user might want explicit opt-in.
6. **For the Firefox port (Phase 1), is "WebDAV only" or "all 5
   providers" the v1 scope** (FIREFOX-PORT.md Phase 5 open decision #1)?
   Affects the ~2-week effort estimate.
7. **For Phase 32.1 / Phase 38.10, is the MCP-as-client surface
   acceptable to ship before Phase 36.2 Prompt API?** The
   `docs/mcp-2026-compliance.md` design suggests yes, but the design
   doc itself says "gated on Phase 38.10 shipping". Confirm the
   sequencing intent.
8. **Is `pages/devtools-panel-v2.js` (EI-7) an in-progress redesign that
   should be tracked as a Phase 7 sub-item, or dead code?** Need
   maintainer input before deletion.

---

*Document version: 1.0 — 2026-05-24. Author: research-only pass; no code
modified. Companion to ROADMAP.md.*
