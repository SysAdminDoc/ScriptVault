# TypeScript authoritative source — design evaluation

Last reviewed: 2026-05-24. Decision: **stage TypeScript as the
authoritative source one runtime module at a time**. Do not replace the
whole concatenated service-worker pipeline in one commit.

Status update, 2026-05-24: the promotion map and first CI drift gate now
ship as `ts-source-promotion.json` and
`scripts/check-ts-source-drift.mjs`. The first pilot also shipped:
`modules/error-log.js` is generated from `src/modules/error-log.ts` via
`scripts/generate-ts-runtime-modules.mjs`. `modules/notifications.js` was
promoted next after reconciling notification cleanup-alarm and error-count
reset drift in the TS source. `modules/npm-resolve.js` was then promoted
after reconciling explicit `npm:pkg@latest` registry resolution. The
`modules/quota-manager.js` runtime artifact now also comes from the TS
source, with runtime tests covering the stronger TS cleanup semantics.
`modules/userstyles.js` is now generated from `src/modules/userstyles.ts`,
completing the current low-dependency tranche and carrying over the TS
implementation's prior-CSS removal tracking plus scoped `@match` conversion.
The storage/resource-layer tranche has started with `modules/xhr.js`,
`modules/internal-host-guard.js`, and `modules/resources.js`, whose generated
runtimes now come from TypeScript sources. `modules/storage.js` was promoted
next using the same generator with multi-global output, so the production
runtime now consumes the v3 IndexedDB-backed `src/modules/storage.ts`
implementation while preserving the script-mode globals expected by
`background.core.js`. The sync/import tranche has also started with
`modules/migration.js`, generated from `src/modules/migration.ts` after
aligning the migration version stamp with the current v2.3.0 runtime marker.

## 1. Problem statement

ScriptVault currently maintains two implementation surfaces:

- Runtime JavaScript in `shared/`, `modules/`, `bg/`, and
  `background.core.js`. This is what `esbuild.config.mjs` concatenates
  into `background.js`.
- TypeScript mirrors in `src/modules/`, `src/bg/`, and
  `src/background/`. These are type-checked and increasingly tested, but
  most production code still comes from the JavaScript files.

That split was useful while the TS migration was de-risking the codebase,
but it now creates two costs:

- Engineers must remember to update both surfaces for every behavior
  change.
- Source tests catch only the drift they explicitly know about. Any new
  JS-only logic can still land unless a reviewer notices.

The Larger Bet asks to collapse the mirror into one authoritative source,
but this cannot be done safely with a single `background.core.js` rewrite.
The service-worker output must stay one file, the current build order must
remain deterministic, and extension APIs are still global/callback-shaped
in several modules.

## 2. Current inventory

### Runtime build surface

`esbuild.config.mjs` currently concatenates these runtime groups:

| Group | Runtime files | TS mirror state |
| ----- | ------------- | --------------- |
| Shared utility prelude | `shared/utils.js` + generated settings defaults | `src/shared/utils.ts`, `src/config/settings-defaults.json` |
| Library shim | `lib/fflate.js` | Third-party vendored JS; not a TS migration target |
| Early modules | `modules/sync-providers.js`, `modules/i18n.js` | TS mirrors exist, but sync providers intentionally diverge in structure |
| Storage/resource modules | `modules/storage.js`, `modules/xhr.js`, `modules/internal-host-guard.js`, `modules/resources.js` | TS mirrors exist; `internal-host-guard` lives under `src/background/` |
| Optional modules | `modules/npm-resolve.js`, `error-log.js`, `notifications.js`, `sync-easycloud.js`, `backup-scheduler.js`, `userstyles.js`, `public-api.js`, `migration.js`, `quota-manager.js` | TS mirrors exist for all |
| Background helpers | `bg/*.js` | TS mirrors exist for analyzer, ESM bundler, netlog, signing, workspaces |
| Main service worker | `background.core.js` | Split across `src/background/*`; no one-file TS source exists |

### Drift found during this review

The existing source suites are valuable, but they are not yet a complete
drift gate. Current examples:

- `modules/error-log.js` has debounced persistence, `flush()`, and a
  legacy `_save()` alias. `src/modules/error-log.ts` still persists on
  each log call and lacks the same debounce contract.
- `background.core.js` keeps the recent auto-update ring used by the
  dashboard banner; `src/background/update-checker.ts` currently runs
  auto-update without that in-memory recent-update surface.
- `modules/sync-providers.js` contains the full runtime provider
  implementations, including S3 SigV4. `src/modules/sync-providers.ts`
  is intentionally a typed facade/validator, not a line-for-line runtime
  implementation.
- Some old tests still reimplement runtime functions instead of importing
  the source (`tests/parser.test.js`, `tests/versions.test.js`). Newer
  tests such as `tests/url-matcher.test.js` and
  `tests/trust-receipt-diff.test.js` import TS directly and are the better
  pattern.

The conclusion: direct text diffs between JS and TS are not useful because
the TS files use exports, types, and different module boundaries. The gate
must be contract-based and promotion-aware.

## 3. Options considered

### Option A: Rewrite the build around TS entrypoints immediately

Replace `background.core.js` and all runtime modules with an esbuild TS
entrypoint, then bundle from `src/background/index.ts`.

**Pros**
- Fastest route to "one source".
- Native tree-shaking and module boundaries.

**Cons**
- Highest risk. `background.core.js` still owns message dispatch,
  install/update wiring, runtime globals, and many compatibility shims.
- Any missed global ordering dependency bricks the service worker.
- Too many unrelated behavior changes would land in one commit.

### Option B: Promote one runtime module at a time (**chosen**)

Keep the existing `background.js` concatenation contract. Add a small build
adapter that can compile selected TS modules into runtime-compatible JS
artifacts, then substitute those artifacts into the existing build order.

Each promoted module gets:

1. A manifest entry in a promotion map (`runtime path`, `TS source`,
   `global name`, `status`).
2. A focused parity test that imports the TS source and exercises the same
   behavior as the runtime test.
3. A build substitution in `esbuild.config.mjs`.
4. A drift gate preventing new edits to the old JS runtime file after the
   TS source is authoritative.

**Pros**
- Preserves the single-file service-worker output and current ordering.
- Lets each module ship with focused tests and a small rollback surface.
- Allows known intentional divergences to stay documented until they are
  ready.

**Cons**
- Requires temporary generated JS artifacts or build-time transforms.
- The migration lasts longer than a one-shot rewrite.

### Option C: Keep mirrors forever, add more parity tests

Continue requiring engineers to patch both JS and TS, with broader tests.

**Pros**
- No build-system change.
- Lowest immediate risk.

**Cons**
- Does not solve the root problem. Every future feature still pays the
  double-edit cost.
- Tests can only catch known contracts.

## 4. Decision

Choose option B.

The migration should be promotion-based, not repo-wide. A module is
"promoted" only when production `background.js` is built from the TS source
or from a generated artifact produced from that TS source. After promotion,
the old JS file becomes either generated output or a compatibility wrapper,
not a human-edited source.

## 5. First migration target

Pilot: `modules/error-log.js` → `src/modules/error-log.ts`.

Why this file first:

- It is self-contained: one global object, one `chrome.storage.local`
  dependency, optional `ScriptStorage` lookup, no cross-module imports.
- Existing runtime coverage is strong in `tests/error-log.test.js`.
- Existing source coverage is present in `tests/source-ops-modules.test.js`.
- It has real known drift (`SAVE_DEBOUNCE_MS`, `flush()`, `_save()` alias),
  so the pilot exercises behavior reconciliation rather than just a build
  mechanism.

Pilot exit criteria:

- `src/modules/error-log.ts` exposes the same debounce/flush behavior as
  `modules/error-log.js`.
- Runtime build uses the TS-derived artifact for the error log section.
- `tests/error-log.test.js` and `tests/source-ops-modules.test.js` both
  pass.
- A drift gate fails if `modules/error-log.js` is manually edited after
  promotion without updating the TS source/build artifact.

## 6. Phased migration order

1. **Design + inventory.** This document.
2. **Promotion gate.** Add a small script that reads a promotion map and
   fails on JS-only edits for promoted modules.
3. **Pilot module.** Promote `modules/error-log.js`.
4. **Low-dependency modules.** Promote `modules/notifications.js`,
   `modules/npm-resolve.js`, `modules/userstyles.js`, and
   `modules/quota-manager.js`. Shipped 2026-05-24.
5. **Storage/resource layer.** Promote `modules/storage.js`,
   `modules/xhr.js`, `modules/resources.js`, and the internal-host guard.
   Started 2026-05-24 with `modules/xhr.js`,
   `modules/internal-host-guard.js`, and `modules/resources.js`; completed
   the storage module promotion later the same day.
6. **Sync/import modules.** Promote `sync-easycloud`, `backup-scheduler`,
   `public-api`, `migration`, and then `sync-providers` after the TS source
   owns the full runtime implementation. Started 2026-05-24 with
   `modules/migration.js`.
7. **Background helpers.** Promote `bg/*.js`.
8. **Main worker leaves.** Promote parser, matcher, registration,
   wrapper-builder, update/install/import, cloud sync, DNR, badge, tab
   reload, and context menu modules.
9. **Final orchestrator.** Replace `background.core.js` only after message
   dispatch and initialization are the last remaining JS-owned surfaces.

## 7. Proposed CI gate

Add a promotion map, for example:

```json
{
  "modules/error-log.js": {
    "source": "src/modules/error-log.ts",
    "status": "promoted"
  }
}
```

Then add `scripts/check-ts-source-drift.mjs` with two modes:

- Default mode: fail if a promoted runtime JS file is modified without its
  TS source or generated artifact changing in the same diff.
- `--report`: list promoted, mirrored, and intentionally-divergent files
  without failing.

The first CI version can use `git diff --name-only` against `HEAD~1` or the
merge base supplied by GitHub Actions. It does not need semantic AST
comparison; the goal is to stop new JS-only changes after a module is
promoted.

Later, after one or two pilot modules, add a stronger check:

- Generate the promoted runtime artifact from TS.
- Compare it to the committed runtime JS wrapper.
- Fail on drift.

## 8. Generated runtime shape

The compiled artifact should preserve the global object names that
`background.core.js` and tests already expect. For `ErrorLog`, the adapter
can compile `src/modules/error-log.ts` and wrap its default export:

```js
// generated from src/modules/error-log.ts
const ErrorLog = (() => {
  // compiled module body
  return defaultExport;
})();
```

This keeps the surrounding concatenation pipeline stable. A future final
phase can replace that wrapper with an actual bundled TS entrypoint, but the
pilot should avoid that broader build-system change.

## 9. Non-goals

- Do not switch the whole extension to an ES module service worker in this
  phase.
- Do not remove `background.core.js` until the leaf modules are promoted.
- Do not rewrite tests solely for naming/style. Change tests only where they
  currently duplicate runtime logic or need to assert the promoted source.

## 10. Next steps

1. Add the promotion map and drift script. Shipped 2026-05-24 via
   `ts-source-promotion.json` and `scripts/check-ts-source-drift.mjs`.
2. Reconcile `src/modules/error-log.ts` with the runtime debounce/flush
   behavior. Shipped 2026-05-24.
3. Teach `esbuild.config.mjs` to use the TS-derived error-log artifact.
   Shipped 2026-05-24.
4. Mark `modules/error-log.js` as generated or compatibility-only. Shipped
   2026-05-24.
5. Promote the next low-dependency module (`modules/userstyles.js`). Shipped
   2026-05-24.
6. Start the storage/resource-layer tranche with `modules/xhr.js` or
   `modules/internal-host-guard.js`. Started 2026-05-24 with
   `modules/xhr.js`, `modules/internal-host-guard.js`, and
   `modules/resources.js`.
7. Promote `modules/storage.js` or move to the sync/import tranche if storage
   needs a separate design pass. Shipped 2026-05-24 with `modules/storage.js`,
   followed by the sync/import tranche starting with `modules/migration.js`.
8. Continue the sync/import tranche with `backup-scheduler`,
   `sync-easycloud`, or `public-api`, leaving `sync-providers` until the TS
   source owns the full runtime implementation.
