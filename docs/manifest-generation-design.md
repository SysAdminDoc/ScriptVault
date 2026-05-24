# Manifest generation — design evaluation

Last reviewed: 2026-05-24. Decision: **status quo with a thin generator
helper** (option B below). WXT is rejected for this codebase; see the
trade-off table.

## 1. Problem statement

ScriptVault ships from a single source tree to two stores today
(Chrome Web Store, AMO) and a third in the near future (Edge Add-ons). The
two manifests we already maintain — `manifest.json` (Chrome MV3) and
`manifest-firefox.json` (Firefox MV3) — diverge in 108 lines per
`diff manifest.json manifest-firefox.json` (2026-05-24). Drift between the
two surfaces has historically caused release defects:

- Version-number mismatches between Chrome and Firefox manifests (caught
  by `npm run release:check`, but not before a few releases shipped
  mismatched build numbers — see CLAUDE.md Bug Fix History Round 4).
- Permission renames (`contextMenus` → `menus` on Firefox), missing
  Firefox-specific declarations (`browser_specific_settings`, gecko data
  collection categories) added by hand each time.
- Unsupported permissions (`sidePanel`, `offscreen`, several optional
  permissions like `identity`/`cookies`) silently dropped by `build-firefox.sh`
  without a structured reason.

The roadmap acceptance is:
> Design document chooses WXT, custom generator, or status quo with
> measured migration cost.

## 2. Measured drift cost (today)

`diff manifest.json manifest-firefox.json` produces 108 changed lines
across 8 sections. The breakdown:

| Section                                | Lines | Why it differs                                                                |
| -------------------------------------- | ----: | ----------------------------------------------------------------------------- |
| `minimum_chrome_version` / Gecko block |    19 | Chrome wants `minimum_chrome_version`; Firefox wants `browser_specific_settings`. |
| Permissions reordering + renames       |    18 | `contextMenus` → `menus`, dropped `sidePanel`/`offscreen`, dropped optional permissions. |
| `host_permissions`                     |     2 | Identical sets, ordering differs.                                              |
| `content_scripts` glob differences      |    4 | Firefox does not honor `world: 'MAIN'` for some scenarios.                     |
| `background.service_worker` shape       |     6 | Firefox accepts the same shape, but our Firefox manifest pins `type: 'module'`. |
| `web_accessible_resources` paths       |     8 | Firefox lacks `use_dynamic_url`.                                               |
| `commands` block                        |     2 | Firefox needs ASCII-only descriptions.                                         |
| `incognito` + miscellaneous             |     4 | Firefox does not support `incognito: 'split'`.                                  |

Maintenance cost per release: one engineer pass of ~10 minutes to verify
the diff stayed minimal, plus the standing risk of forgetting one of the
above. The release-checker (`scripts/check-release-artifacts.mjs`)
catches the version number, but not the permission/structural drift.

## 3. Options considered

### Option A: Adopt WXT (`wxt.dev`)

WXT is a feature-rich MV3 build framework. It auto-generates manifests
per browser target from a single TypeScript config, supports HMR, has
opinionated file-system routing, and ships a CLI for `wxt build` /
`wxt zip` per target.

**Pros**
- One config produces Chrome, Firefox, and (with the right targets) Edge
  manifests. Drift collapses to zero.
- Active community, good docs, used in production by other MV3
  extensions.
- Built-in HMR + dev mode improves iteration speed.

**Cons (the dealbreakers for this codebase)**
- WXT expects a specific source layout (entrypoints under `entrypoints/`,
  pages under `pages/`, etc.) that doesn't match ScriptVault's existing
  layout (`pages/`, `bg/`, `modules/`, `shared/`, plus the build-time
  concatenation pipeline in `esbuild.config.mjs`). Migrating would touch
  every file path and every test fixture.
- WXT does not have a first-class story for ScriptVault's service-worker
  concatenation pattern (single `background.js` built from 30+ source
  files via `esbuild.config.mjs`). The existing pipeline is the result of
  Chrome MV3 service workers not reliably supporting `importScripts`
  (CLAUDE.md gotcha #1); moving away would require either accepting
  HMR-style entrypoints (which fundamentally can't reproduce the
  inlining contract) or maintaining a custom esbuild plugin inside WXT
  that re-implements the existing build. Both options trade today's
  drift surface for a larger build-system surface.
- WXT adds a runtime polyfill layer (`webextension-polyfill`) that
  ScriptVault has explicitly avoided — every MV3 promise/callback
  handling concern is already handled in `dashboard-firefox-compat.js`
  and Chrome 131+ promise-returning APIs work natively.
- Migration cost is conservatively 2–3 weeks of focused engineering plus
  a hot CI period where ScriptVault has no Chrome **or** Firefox build
  while we sort out the inlining + offscreen-document story.

### Option B: Status quo + thin generator helper (**chosen**)

Keep `manifest.json` as the source of truth. Add a Node script
`scripts/generate-manifest-firefox.mjs` that produces
`manifest-firefox.json` by applying a small, declarative set of
transformations (rename `contextMenus` → `menus`, drop unsupported
permissions, inject the gecko block, strip `incognito: 'split'`). The
script becomes the single record of "what Firefox needs different from
Chrome" — today's diff stops being implicit.

**Pros**
- Drop drift surface by 80%+ without touching the existing build,
  source layout, or tests.
- The generator is one file (≤ 200 lines) and reads like a config — easy
  for contributors to understand. It can be re-run from `npm run
  build:firefox` so the Firefox manifest is never edited by hand.
- Trivial Edge add-on extension: same generator, different transformation
  set (drop `browser_specific_settings`, etc.).
- Migration cost: <1 day. Zero risk of breaking either Chrome or Firefox
  builds — the generator's first commit can simply round-trip the
  current Firefox manifest so we know it produces the same bytes.

**Cons**
- Still two output files in the repo (until we decide whether to gitignore
  the generated one). Today's plan: keep the generated `manifest-firefox.json`
  committed so AMO source review can diff it against the previous release.
- Doesn't bring HMR or other quality-of-life upgrades a true framework
  would.

### Option C: Stay at status quo

No new tooling. Keep updating both manifests by hand.

**Pros**
- Zero migration cost.

**Cons**
- 10-minute manual diff per release continues. Drift defects continue.
- Edge launch (next item on the roadmap, P2) doubles the surface — three
  hand-maintained manifests.

## 4. Decision matrix

| Dimension                     | A — WXT          | **B — Generator** | C — Status quo |
| ----------------------------- | ---------------- | ----------------- | -------------- |
| Drift surface                  | None             | Minimal           | High            |
| Migration cost                 | 2–3 weeks         | <1 day            | 0               |
| Build complexity introduced    | High              | Low               | None            |
| Loss of inline background.js   | Likely           | None              | None            |
| Edge add-on path               | Easy             | Easy              | Manual          |
| Contributor onboarding         | New framework     | One Node script   | None            |
| HMR / quality-of-life          | Yes              | No                | No              |
| Risk to existing tests/CI      | Significant      | Trivial           | None            |

## 5. Decision: Option B

Adopt option B. Concrete next steps (separate roadmap items):

1. Write `scripts/generate-manifest-firefox.mjs` that produces the
   current Firefox manifest byte-for-byte from `manifest.json` plus a
   declarative `manifest-firefox.transformations.json` file.
2. Wire `build-firefox.sh` to run the generator and assert the produced
   file matches `manifest-firefox.json`. Initially fail loudly on drift;
   later move to "generate fresh each build."
3. Repeat for Edge (next P2 roadmap item) — same generator, fewer
   transformations.
4. Once both targets ship from generated manifests, gitignore
   `manifest-firefox.json` and `manifest-edge.json` and revoke direct
   edits.

WXT remains a viable choice if ScriptVault ever needs HMR or a fundamentally
different source layout (e.g., a major refactor that moves dashboard
pages into a routed app). At that point this design doc should be
revisited, not before.

## 6. Proof-of-concept

`build-firefox.sh` already demonstrates that Chrome + Firefox builds come
from a single source tree (one esbuild invocation, one source set, one
test suite). The piece that's missing is the manifest transformation,
which option B addresses with a single Node script. No new
proof-of-concept code is needed to validate the design — the existing
pipeline is the proof.

## 7. References

- ScriptVault `manifest.json` and `manifest-firefox.json` (current source).
- `build-firefox.sh` for the existing two-target build pipeline.
- WXT docs: https://wxt.dev
- Chrome MV3 manifest reference: https://developer.chrome.com/docs/extensions/reference/manifest
- Firefox MV3 manifest reference: https://extensionworkshop.com/documentation/develop/manifest-v3-migration-guide/
- Edge Add-ons publish guide: https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/publish/publish-extension
