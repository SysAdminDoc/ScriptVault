# Changelog

All notable changes to ScriptVault will be documented in this file.

## Unreleased

### 2026-06-04 — GM_xmlhttpRequest internal-host guard

- **Blocked GM_xmlhttpRequest internal-host SSRF by default.** GM_xhr now runs
  the shared `InternalHostGuard` before fetching and again on the final response
  URL before reading the body, so IMDS, loopback, RFC1918, link-local, and IPv6
  internal redirects are rejected even when `@connect` is empty or `*`.
- **Preserved explicit localhost development opt-ins.** Loopback GM_xhr remains
  available when a script explicitly declares `@connect localhost`, and the new
  advanced `allowInternalXhr` setting is a global escape hatch for users who
  intentionally allow internal XHR.

### 2026-06-04 — Firefox sideload smoke and web-ext audit fix

- **Firefox Phase 1 now has an automated temporary sideload smoke.**
  `npm run smoke:firefox` packages the Firefox build, installs it temporarily
  through geckodriver, opens the dashboard and popup, and saves/toggles a smoke
  userscript through the extension message path before verifying it runs on a
  local target page. Headless Firefox permission prompts are still surfaced in
  the UI and then granted through Firefox chrome context for automation.
- **Fixed a Firefox background boot error exposed by the smoke.**
  `MAX_SCRIPT_SIZE` is initialized before `SubscriptionSystem` reads it, so the
  Firefox event-page background no longer throws during add-on startup.
- **Fixed Firefox runtime compatibility exposed by sideloading.** Native
  Windows Git Bash is preferred over WSL for Firefox packaging, Firefox `menus`
  is aliased to the shared `contextMenus` path, and own `moz-extension://`
  dashboard/popup senders are trusted for extension-page messages.
- **Added Firefox userScripts permission onboarding.** Popup and dashboard setup
  banners request the optional Firefox `userScripts` permission, then re-run the
  live runtime probe and registration repair path.
- **Validated Chrome-style backups in the Firefox build.** `npm run
  smoke:firefox` now imports JSON and ZIP backup fixtures into Firefox and
  checks stable script IDs, metadata, disabled state, GM storage, and timestamps.
  ScriptVault ZIP exports now include `scriptVault` timestamp metadata so
  `createdAt`, `updatedAt`, and position survive cross-browser restore.
- **Closed Firefox Phase 2 data-safety validation.** The Firefox smoke now
  imports a 26-script quota fixture, verifies storage usage, restarts Firefox
  with the same temporary profile, reinstalls the temporary package, confirms
  trash survived the restart, and restores the deleted script. The migration
  suite also proves the v1.x -> v2.0 migration is idempotent across repeated
  runs.
- **Validated Firefox WebDAV-only sync for v1.** The Firefox smoke now runs a
  local WebDAV fixture, saves WebDAV settings through the runtime, checks
  provider health, runs a no-write dry-run preview, performs `syncNow`, verifies
  the uploaded JSON backup, and confirms Basic Auth reached the configured
  endpoint. OAuth sync providers remain deferred because the Firefox package
  omits `identity`.
- **Cleared the high-severity `web-ext` audit path.** `web-ext` now resolves to
  the `10.3.0` line with fixed `tmp@0.2.6`, restoring the high-level npm audit
  gate.

### 2026-06-04 — Firefox Monaco fallback path

- **Firefox AMO builds now fall back to an editable textarea immediately when
  Monaco is omitted.** `editor-sandbox.html` reports missing local Monaco
  bundles to the parent, and `monaco-adapter.js` hides the iframe without
  waiting for the timeout.
- **The fallback editor now preserves dashboard editing semantics.** Pending
  code is copied into the textarea, textarea input fires the adapter change
  listeners, focus works, and `isMonaco` reports `false` while the fallback is
  active.

### 2026-06-04 — Firefox side-panel feature flag

- **Firefox no longer receives a fake `chrome.sidePanel`.**
  `dashboard-firefox-compat.js` preserves native Chromium side-panel support
  but leaves the API undefined on unsupported browsers, so dashboard
  feature-detects can hide side-panel entry points.
- **The side-panel gate is covered by executable compatibility tests.**
  `tests/dashboard-firefox-compat.test.js` evaluates the dashboard
  compatibility layer in Firefox-like and Chromium-like contexts.

### 2026-06-04 — Firefox offscreen fallback

- **Firefox no longer calls `chrome.offscreen`.** `ScriptAnalyzer` now
  feature-detects offscreen support before creating a document. Chrome keeps
  the offscreen document path, while Firefox uses inline local Acorn for AST
  analysis and ESM import parsing.
- **3-way sync merge has a Firefox fallback.** Cloud sync merge paths now route
  through `ScriptAnalyzer.mergeText()`, which uses the offscreen Diff worker on
  Chrome and inline local `lib/diff.min.js` when `chrome.offscreen` is absent.
- **Firefox packaging includes the parser libraries only.** `build-firefox.sh`
  copies `lib/acorn.min.js` and `lib/diff.min.js` without copying the full
  Monaco `lib/` tree.

### 2026-06-04 — Module-mode service worker

- **Chrome now loads the MV3 background as a module service worker.**
  `manifest.json` declares `"background.type": "module"` for the existing
  single-file `background.js` bundle, while Firefox remains on its generated
  event-page background shape.
- **Module compatibility is pinned in tests.** The new manifest gate verifies
  the Chrome floor, the Firefox transform, the absence of global
  `importScripts()` loader calls / static imports / exports in `background.js`,
  and Edge manifest preservation.

### 2026-06-04 — Require provenance install preview

- **Install review now previews `@require` provenance.** The dependency card
  shows a Sigstore provenance status, per-`@require` labels, and a
  verified-author badge when declared bundles verify against the dependency
  bytes, Fulcio root, and expected OIDC identity.
- **Opted-in provenance now fails closed on save/update.** Direct install,
  reinstall, downgrade, and update receipts use the hardened background
  `fetchRequireScript()` and `fetchProvenanceBundle()` paths; a declared
  provenance failure returns a clear install/update error before script state is
  saved.

### 2026-06-04 — Require provenance author guide

- **Added `docs/provenance-author-guide.md`.** The guide documents Cosign
  blob signing, ordered `@require-provenance` / `@require-identity`
  declarations, GitHub Actions OIDC identity shape, verification statuses,
  common failure modes, and dependency rotation.

### 2026-06-04 — Require provenance review UI

- **Pending updates now treat provenance failures as review-required.**
  Failed signatures, failed Fulcio roots, unavailable bundles, unsupported
  bundles, and incomplete declarations add a review reason instead of leaving
  the update in the safe-to-apply bucket.
- **Dashboard trust surfaces show per-dependency provenance.** Recent-update
  review modals and script trust receipts now list declared `@require`
  provenance with status, identity, certificate identity, root state, and
  verification errors.

### 2026-06-04 — Fulcio root verification for require provenance

- **Sigstore verifier now checks the certificate chain.** The verifier bundles
  the official Fulcio v1 root certificate, supports injected roots for tests,
  and verifies leaf/intermediate ECDSA certificate signatures through the
  trusted root.
- **Trust receipts now distinguish root failures.** Provenance receipts can
  record `root-verification-failed`, `rootVerified: verified|failed`, and the
  leaf certificate validity window. RFC3161/Rekor timestamp proof remains the
  later defense-in-depth phase.

### 2026-06-04 — Sigstore message-signature verifier

- **Sigstore message-signature verification now feeds trust receipts.**
  Added `src/modules/sigstore-bundle-verifier.ts` with generated
  `modules/sigstore-bundle-verifier.js`, plus a bounded
  `fetchProvenanceBundle()` path for update and pending-update receipts.
- **Receipts now record real provenance outcomes when verification can run.**
  For declared `@require-provenance` entries, receipts can now store
  `signature-verified`, `signature-failed`, `bundle-unavailable`, or
  `unsupported-bundle` alongside certificate identity, issuer, digest, and
  signature flags. Fulcio root/expiry checks are covered by the later root
  verification entry.

### 2026-06-04 — Sigstore bundle parser

- **Sigstore bundle parsing is now generated from TypeScript.**
  Added `src/modules/sigstore-bundle-parser.ts` with generated
  `modules/sigstore-bundle-parser.js` and promotion-gate coverage.
- **The parser validates Sigstore v0.3 bundle shape before verification.**
  It accepts message-signature and DSSE content, extracts certificate or
  public-key verification material, transparency-log entries, and RFC3161
  timestamps, and rejects unsupported media types or ambiguous key material.

### 2026-06-04 — Require provenance metadata foundation

- **`@require-provenance` metadata now persists.** The main userscript parser,
  public API install parser, and generated background runtime now store
  ordered `requireProvenance[]` and `requireIdentity[]` arrays.
- **Trust receipts record declaration-only provenance.** Each `@require`
  dependency can now carry its declared Sigstore bundle URL and expected OIDC
  identity with `verification: not-yet-implemented`; message-signature
  verification is covered by the later Sigstore verifier entry.

### 2026-06-04 — Local health diagnostics

- **Support snapshots now include local health diagnostics.** Added
  `getLocalHealthReport` to summarize runtime setup, storage pressure,
  pending update queues, callback-map pressure, and script health warnings.
- **Diagnostics remain local and aggregate-only.** The report explicitly
  excludes script source, script names, URLs, and external usage beacons.

### 2026-06-04 — Release store status gate

- **Release trust now includes store-status evidence.** Added
  `npm run release:store-status` to verify rollback/trust/status wiring,
  Firefox AMO lint/package artifacts, and optional credentialed CWS API v2
  `fetchStatus` results before release publication.

### 2026-06-04 — Background core TypeScript bridge promotion

- **The main background core is now generated from TypeScript.**
  `background.core.js` is produced from `src/background/core.ts` as a raw
  bridge source, preserving top-level runtime helpers while closing the final
  TS promotion gap. `ts-source:check` now reports 23 promoted entries, 0
  mirrored entries, and 0 intentionally divergent runtime files.

### 2026-06-04 — Cloud sync providers TypeScript promotion

- **Cloud sync providers runtime is now generated from TypeScript.**
  `modules/sync-providers.js` is produced from `src/modules/sync-providers.ts`,
  including WebDAV, Google Drive, Dropbox, OneDrive, and S3-compatible SigV4
  providers plus the OAuth timeout helper and `self.CloudSyncProviders`
  compatibility export.

### 2026-06-04 — EasyCloud sync TypeScript promotion

- **EasyCloud sync runtime is now generated from TypeScript.**
  `modules/sync-easycloud.js` is produced from
  `src/modules/sync-easycloud.ts`, with the source updated to rely on runtime
  storage globals while preserving alarm-backed debounce sync, Drive request
  timeouts, offline queue handling, runtime script refresh hooks, and
  chrome.identity token-cache behavior.

### 2026-06-04 — Backup scheduler TypeScript promotion

- **Backup scheduler runtime is now generated from TypeScript.**
  `modules/backup-scheduler.js` is produced from
  `src/modules/backup-scheduler.ts`, with the source updated for restore
  receipts, rollback receipts, backup verification, receipt retention caps,
  and runtime-global storage contracts.

### 2026-06-03 — Public API TypeScript promotion

- **Public API runtime is now generated from TypeScript.** `modules/public-api.js`
  is produced from `src/modules/public-api.ts`, with the source mirror updated
  for generated script IDs, permissions access, bounded web installs, and
  webhook defense-in-depth.

### 2026-06-03 — ESM bundler TypeScript promotion

- **ESM bundler runtime is now generated from TypeScript.** `bg/esm-bundler.js`
  is produced from `src/bg/esm-bundler.ts`, preserving the runtime
  `fetchRequireScript` dependency and `self.ESMUserscriptBundler` worker alias.

### 2026-06-03 — Signing runtime TypeScript promotion

- **Signing runtime is now generated from TypeScript.** `bg/signing.js` is
  produced from `src/bg/signing.ts`, preserving the null signature guard,
  trust-store own-property check, and runtime `SettingsManager` global contract.

### 2026-06-03 — Workspace manager TypeScript promotion

- **Workspace runtime is now generated from TypeScript.** `bg/workspaces.js`
  is produced from `src/bg/workspaces.ts`, reducing the remaining mirrored
  runtime surface while preserving the cold-start `_initPromise` guard.

### 2026-06-03 — Storage persistence prompt

- **Persistent storage is requested before meaningful script writes.** The
  background worker now asks `navigator.storage.persist()` once before script
  installs, saves, imports, and updates.
- **Writes remain non-blocking.** The persistence request records granted,
  denied, unsupported, or error outcomes in `chrome.storage.local` and never
  prevents the script write from continuing.

### 2026-06-03 — Script subscriptions

- **Subscription feeds can queue curated script installs.** The Utilities panel
  now accepts a JSON feed URL, stores subscribed feeds, and refreshes them on
  demand.
- **New feed members require review.** Subscription scripts land in the
  existing Updates inbox as review-only installs, so "apply safe" cannot
  auto-install new scripts.
- **Feed and script fetches use the hardened path.** Subscription fetches reuse
  the internal-host guard plus stream-bounded body reader before queueing any
  script source.

### 2026-06-03 — ESM dashboard badge

- **ESM scripts are visible in the dashboard row.** Scripts parsed from
  `@module 1`, `@inject-into module`, or stored ESM bundle metadata now show an
  `ESM` badge beside the existing source and health badges.
- **Badge styling is theme-aware.** The new badge uses the existing square
  health-badge shape in both dark and light themes.

### 2026-06-03 — Playwright E2E critical flows

- **Added Playwright E2E coverage for four critical flows.** New specs cover
  install review, update review with rollback history, backup restore plus
  restore-receipt rollback, and WebDAV sync preview/upload against a real local
  HTTP endpoint.
- **CI now runs the browser flow suite.** `npm run test:e2e` runs after the
  dashboard smoke test; CI installs Playwright Chromium explicitly while
  keeping dependency install from downloading unused browsers.
- **Install review bootstrap fixed.** The install page now relies on the shared
  `formatBytes` helper instead of redeclaring it after `shared/utils.js`, which
  previously caused a page-level SyntaxError and left the install review stuck
  on its loading state.

### 2026-06-03 — GM API ambient declarations

- **Generated TypeScript declarations for userscripts.** `scripts/generate-gm-types.mjs`
  now writes `lib/scriptvault.d.ts` with ambient GM/GM_* declarations for the
  built ScriptVault runtime, including notification handles, cookie/audio APIs,
  resource helpers, tab state, `GM_webRequest`, and `window.onurlchange`.
- **Build and package paths keep declarations current.** The background build
  regenerates the declaration file, `npm run gm-types:check` fails on drift,
  and the Chrome package include list ships `lib/scriptvault.d.ts`.
- **Typecheck coverage added.** `tests/gm-types.test.js` compiles a temporary
  TypeScript userscript against the generated declarations and verifies the CWS
  include path.

### 2026-06-03 — Sync tombstone resurrection drill

- **Added a deletion-resurrection regression drill.** The cloud-sync source
  test now covers install A, upload, delete A with a tombstone, upload the
  tombstone, wipe local state, and resync from the remote tombstone without
  resurrecting A.

### 2026-06-03 — Trash retention visibility

- **Trash policy is now explicit in the recovery panel.** The Trash tab shows a
  live retention banner that summarizes the configured cleanup policy and the
  next automatic purge time when deleted scripts are waiting.
- **Deleted script rows show purge dates.** Each recoverable row now includes a
  "Will auto-delete on ..." label derived from the current `trashMode` retention
  setting, or a no-automatic-deletion label when trash cleanup is disabled.

### 2026-06-03 — Pending update inbox queue

- **Auto-update now defaults to notify-only review.** Scheduled checks queue
  available updates instead of applying them by default. A new
  `autoUpdateMode` setting lets users opt into applying safe updates without
  review.
- **Updates tab added to the dashboard.** The queue shows pending update counts,
  safe/review buckets, source host, line-diff summary, trust receipt changes,
  install, remove, diff, and rollback actions.
- **Popup and side panel surface queued updates.** Both entry points show a
  queued-update badge/chip and open the dashboard Updates tab for review.
- **Safe bulk updates are separated from review-required updates.** Bulk update
  flows apply only safe queued updates when requested; updates that add
  permissions, change source identity, or alter external dependencies stay in
  the queue.
- **Regression coverage added.** `tests/pending-update-queue.test.js` covers
  notify-only default behavior, safe-only application, and review classification
  for permission-expanding updates. The full suite is 1127 tests.

### 2026-06-02 — Deep audit hardening pass (wave 2)

- **`@match` ReDoS fixed.** The `@match` path-glob → regex conversion did not
  collapse consecutive `*` (unlike `@include`), so a crafted pattern such as
  `*://site/****…****a` produced a catastrophically-backtracking regex that
  could freeze the service worker for ~a minute *per evaluated tab URL*. Now
  collapses runs of `*` first (semantically identical glob), in both the
  runtime and the TS matcher. Added a timing regression test.
- **Cloud token-validity probes now time out.** Google Drive / Dropbox /
  OneDrive `getValidToken()` issued a raw `fetch` with no timeout on the hot
  upload/download path; a hung probe blocked every caller indefinitely (the
  prior timeout only covered the refresh path). All three now use the existing
  15s timeout wrapper and fall through to refresh on a failed/timed-out probe.
- **`@crontab` schedule reconciliation on in-place update.** On the Chrome
  138+ `userScripts.update` path, editing a script to add `@crontab` left the
  old page-load registration in place (script ran on load *and* on schedule),
  and removing `@crontab` left a zombie alarm firing forever. Registration now
  drops the prior page-load registration when switching to crontab and clears
  any stale crontab alarm when a script is no longer scheduled.
- **`ScriptValues.deleteAll` cache/IDB race fixed.** A concurrent
  `GM_getValue`/`GM_setValue`-triggered `init()` could write pre-delete values
  back into the cache after `deleteAll` cleared it, leaving the cache serving
  deleted values while IndexedDB was empty. `deleteAll` now serializes on
  `init()` before clearing.
- **Backup retention hardening.** Restore-receipt retention was capped only by
  count (10); since each receipt snapshots every script's code + values, a few
  full-library restores could balloon `chrome.storage.local`. Added a ~5 MB byte
  budget that drops the oldest receipts (always keeping the newest). Also clamped
  `pruneOldBackups`'s `maxBackups` so a negative/NaN value can't keep the oldest
  backups or wipe them all.
- **Release hygiene.** Added `.gitattributes export-ignore` for internal
  planning/research docs so the `git archive` source ZIP shipped to add-on
  reviewers no longer carries development working notes; closed `.gitignore`
  gaps; removed stray working-notes references from two build-tooling comments.

### 2026-06-01 — Deep audit hardening pass

- **@require SRI now fails closed.** Subresource-integrity verification for
  `@require`/npm dependencies previously returned "valid" when the digest
  computation threw, silently accepting unverified bytes on a correctly-pinned
  `sha256` hash. It now rejects on any verification error. SRI hashes are also
  compared after normalizing base64url and missing padding, so a correctly
  pinned require can no longer silently fail and fall through to a fallback CDN.
- **Stored-XSS fixes.** The collection card icon and the collection editor's
  icon input interpolated an imported/shared `icon` value into HTML without
  escaping; both are now escaped. The multi-profile header indicator and
  switcher dropdown interpolated an imported profile's `color` (into a style
  attribute) and `emoji` without validation; color is now validated against a
  hex/named-color allowlist and emoji is HTML-escaped, matching the profile bar.
- **Install-page dependency probe hardened.** The `@require` reachability
  preview auto-fetched every dependency URL from untrusted userscript metadata
  before any user action, with no scheme or host check — usable to probe
  loopback/private/cloud-metadata hosts. It now only probes external `http(s)`
  URLs and marks internal or non-http(s) URLs as unverified without fetching.
- **Cross-device deletes now propagate.** Cloud sync recorded remote deletions
  but never removed the already-installed local copy, so a script deleted on
  another device kept running locally. Sync now applies remote tombstone
  deletions locally (skipping user-modified scripts), and the 3-way merge base
  handles an empty-string sync base correctly.
- **UX/robustness.** Schedule and theme-editor save/clear/error toasts were
  bound to an out-of-scope `showToast` and never appeared; they now route
  through the exposed dashboard toast. The activity heatmap clears its global
  recording hook on teardown, and the side panel's all-scripts render degrades
  instead of throwing if its list element is missing.
- Hardened the Vitest crypto mock so the signing source suite runs in all
  worker pools (was the one persistently failing case). Full suite: 1114 green.

### 2026-06-01 — Planning and research index consolidation

- Added root-level `COMPLETED.md` and `RESEARCH_REPORT.md` indexes so active
  roadmap, TODO, Firefox-port, research, and shipped-ledger files have a
  single navigation map without moving active planning inputs.

### 2026-05-24 — Support snapshot redaction preview

- The dashboard's "Export Snapshot" button used to dump script names,
  URLs, error log, recent network log, denied hosts, and the public API
  audit to a JSON file with no opt-out. Replaced the one-click export
  with a redaction-preview modal that lists 13 data categories, defaults
  the 7 sensitive ones to OFF, and shows a per-category description so
  users can see exactly what each checkbox unlocks before anything
  reaches disk.
- Runtime status and counts are always-on because the bundle is useless
  for support without them and neither contains personal data. Backup
  inventory, sync provider summary, recovery schedule, and trusted
  signing key names default to ON. Script inventory, activity log,
  error log, network log, denied hosts, public API audit, and public
  API trusted-origins/permissions default to OFF and carry a
  `sensitive` visual flag in the modal.
- The exported JSON is now schema v2 with a top-level `redactionProfile`
  block listing both `includedCategories` and `excludedCategories` so a
  reviewer can see at a glance what data was redacted versus what
  simply didn't exist.
- The builder skips the matching `chrome.runtime.sendMessage` round-trip
  for any opted-out category, so a snapshot with everything sensitive
  unticked never even fetches the error log or network log.
- Added `pages/dashboard.css` styles for `.snapshot-redaction`,
  `.snapshot-category`, and the sensitive variant; the support-section
  copy in `pages/dashboard.html` now describes the opt-in model.
- Regression coverage in `tests/support-snapshot-redaction.test.js`
  (13 cases — category inventory, sensitive/always-on/default-on
  classifications, modal flow, always-on forcing, conditional fetch
  wiring per category, schema v2 redactionProfile fields, conditional
  attachment of every snapshot block, HTML and CSS surface checks).

### 2026-05-24 — Chrome 138 chrome.userScripts.update adoption

- Added `reregisterScript(script)` plus `_supportsUserScriptsUpdate()` in
  both the runtime (`background.core.js`) and the TypeScript mirror
  (`src/background/registration.ts`). The helper feature-detects Chrome
  138's `chrome.userScripts.update` and swaps a single script's
  registration in place when available, avoiding the brief unregistered
  window where a tab navigation could miss the script. Falls back to
  the existing unregister + register cycle for Chrome 130-137.
- `registerScript` now accepts a `{ useUpdate: true }` option that routes
  the underlying `chrome.userScripts.register([...])` call through the
  new `update([...])` path when supported. On "no matching script" the
  branch falls back to `register` so the first save after a service
  worker restart still registers cleanly.
- Migrated the two highest-frequency call sites (`saveScript` and the
  `setScriptSettings` toggle path) to call `reregisterScript` instead of
  the manual unregister + register pair. Other call sites (bulk reload,
  install, factory reset) keep the explicit pair; their cadence makes
  the flicker risk small and migration is a follow-up.
- Regression coverage in `tests/reregister-script.test.js` (9 cases —
  runtime helper presence, TS mirror presence, both call-site migrations
  pinned, runtime + TS useUpdate option, branch behavior for the three
  routes: disabled / Chrome 138 enabled / older Chrome enabled).
- Rebuilt `background.js` (22,657 lines).

### 2026-05-24 — Install-time optional permission gating

- Installing a script with `@grant GM_cookie` previously left the script
  silently broken because the optional `cookies` permission declared in
  manifest.json was never requested at install. Same for `GM_setClipboard`
  and the `clipboardWrite` permission. The install page now requests the
  matching Chrome optional permission inside the install button's
  user-gesture window via `chrome.permissions.contains` + `request` before
  the save round-trips to the background worker.
- Grant tags for `GM_cookie` / `GM.cookie` / `GM_setClipboard` /
  `GM.setClipboard` get a `*` hint badge and a tooltip noting the
  follow-up Chrome prompt; the section grows a one-line caption when any
  of those grants are present so reviewers can predict the flow.
- The trust receipt schema (`src/types/script.ts`) and both the runtime
  builder (`background.core.js`) and the TS mirror
  (`src/background/trust-receipt.ts`) now persist
  `optionalPermissions: { requested, granted, denied, unavailable }` so
  users can see later which prompts they accepted. `null` for receipts
  that didn't surface a prompt (sync, internal saves, legacy entries).
- Switched `vitest.config.mjs` from the removed `poolOptions.vmThreads`
  shape to the Vitest 4 top-level `maxWorkers`/`minWorkers` keys; the
  default pool stays `vmThreads` with single-worker concurrency.
- Added `chrome.permissions.contains` + `remove` mocks to `tests/setup.js`
  so jsdom tests can exercise the new install-page flow.
- Regression coverage in `tests/install-optional-permissions.test.js`
  (11 cases — grant-to-permission map, dedup across snake_case/dot
  variants, no-op for safe-grant-only scripts, no-op for empty grant
  arrays, contains() short-circuit when already granted, denied path
  recorded, contains() rejection falls back to request, plus source-pin
  tests that handleInstall wires the result into saveScript trust data).

### 2026-05-24 — Wrapper parity wave + per-site control docs

- Added `GM_head` to the TypeScript wrapper mirror at
  `src/background/wrapper-builder.ts` so a future TS-runtime promotion
  cannot drop the convenience HEAD helper that the install page already
  advertises and the runtime already implements.
- Added `requireInteraction` passthrough across the four notification code
  paths (runtime wrapper send + update, TS wrapper send, runtime background
  create + update handlers). Scripts that need pinned notifications now
  match Tampermonkey/Violentmonkey behavior. Regression coverage in
  `tests/notification-require-interaction.test.js` (6 cases).
- Tightened the `@webRequest` parser in both runtime `background.core.js`
  and the `src/background/parser.ts` mirror to validate selector + action
  shape before handing the rule to the DNR rule builder. Malformed entries
  are dropped instead of silently propagating through to the DNR API.
  Regression coverage in `tests/parser-webrequest.test.js` (8 cases).
- Baked `pool: "vmThreads"` with single-worker concurrency into
  `vitest.config.mjs` as the default so contributors and CI no longer need
  to pass `--pool=vmThreads --maxWorkers=1` to dodge the recurring
  `@exodus/bytes` and shared-drive access-violation crashes.
- Added a "Per-Site Control" section to the README documenting the three
  independent layers (`deniedHosts`, blacklist mode, whitelist mode) that
  were already shipped but invisible in the public listing.
- Rebuilt `background.js` (22,584 lines).

### 2026-05-24 — README marketing parity with shipped runtime

- Reconciled the README marketing copy with the actual runtime: removed
  references to four modules that were deleted in v2.0.0 (AI Assistant,
  Performance Dashboard, Script Analytics, Onboarding Wizard) and rewrote
  the Smart Recommendations line to drop the "AI-powered" claim because the
  current module is heuristic only.
- Replaced the "Browser Sync" entry in the sync provider table with the
  shipped S3-compatible provider, and called out Easy Cloud + GitHub Gist
  as separate-module sync flows.
- Updated the Chrome/Tampermonkey/Violentmonkey comparison table to list
  the actual five providers instead of the legacy "Cloud Sync (4 providers)".
- Added `scripts/check-readme-claims.mjs` plus `npm run readme:check` as
  a CI gate that fails when README marketing copy resurrects deleted module
  names, claims a sync provider that is not in `CloudSyncProviders`, or
  references a `pages/dashboard-*.js` file that no longer exists. Wired
  into `.github/workflows/ci.yml` after the existing store-copy gate.
- Regression coverage in `tests/check-readme-claims.test.js` (4 cases —
  live-README pass, JSON shape, intentional deleted-module regression,
  intentional missing-module regression).

### 2026-05-24 — Dashboard search focus refinement

- Removed the double focus treatment on the installed-userscripts search field
  by excluding it from the broad accessibility-module blue outline rule.
- Kept keyboard focus visible with the polished green input ring in normal mode
  and restored the stronger blue outline only for the explicit high-contrast
  accessibility class.
- Added regressions so the accessibility layer cannot double-paint the script
  search focus state again.

### 2026-05-24 — Dashboard search field polish

- Shortened the installed-userscripts search placeholder so it no longer clips
  inside the dense toolbar while preserving the full search grammar in the
  tooltip and accessible label.
- Widened the dashboard search flex target and restored icon-safe left/right
  input padding after scaled-control CSS runs.
- Added regressions for the compact search copy and final CSS padding cascade.

### 2026-05-24 — Dashboard table header anchoring

- Fixed the installed-userscripts table header overlapping the third/fourth
  visible row by restoring `overflow: clip` on the final table-shell CSS
  cascade, preserving rounded-corner clipping without trapping sticky headers.
- Added a dashboard accessibility-surface regression so future polish layers
  cannot silently switch the script table container back to `overflow: hidden`.
- Verified the rendered dashboard geometry in headless Chrome: the header stays
  at the table top and above the first row with no page errors.

### 2026-05-24 — Bounded fetch UTF-8 fallback

- Tightened the shared bounded text reader so its non-stream fallback measures
  UTF-8 bytes instead of JavaScript string length before accepting a response.
- Updated the runtime `background.core.js` helper, TypeScript mirror, and
  rebuilt `background.js` from the corrected guard.
- Added regressions for multibyte fallback bodies in both the extracted
  runtime helper and TypeScript parity suite.

### 2026-05-24 — NPM resolver response-size hardening

- Added bounded streamed response reads to the `npm:` package resolver so CDN
  and registry responses without `Content-Length` cannot buffer beyond the
  5 MB cap before rejection.
- Regenerated the promoted `modules/npm-resolve.js` runtime artifact and
  rebuilt `background.js` from the updated TypeScript source.
- Added regressions for declared oversized responses and chunked oversized
  responses, including reader cancellation and no `response.text()` fallback.

### 2026-05-24 — Resource cache streamed-body hardening

- Replaced `@resource`/resource-cache `arrayBuffer()` reads with a bounded
  stream reader so responses without `Content-Length` are cancelled once they
  exceed the 5 MB cache cap.
- Preserved the generated runtime/TypeScript source path for `ResourceCache`
  and rebuilt `background.js` from the promoted source module.
- Added a streamed oversized-resource regression that verifies the reader is
  cancelled, `arrayBuffer()` is not called, and no oversized entry is cached.

### 2026-05-24 — Public API web-install hardening

- Hardened trusted web origins by normalizing entries to exact HTTPS origins,
  deduplicating them, rejecting wildcard/insecure/internal origins, and
  filtering legacy malformed entries on load.
- Rechecked the final response URL after web-install redirects and bounded
  chunked response reads without relying on `Content-Length`, preventing
  internal redirect fetches and oversized streamed installs from being read.
- Added Public API regressions for trusted-origin normalization, redirect
  refusal, and chunked size enforcement, plus made the content-bridge security
  suite independent from jsdom's static import path in Vitest workers.

### 2026-05-24 — Premium UX polish pass

- Added a dashboard cohesion layer for search, table focus, empty states,
  toast tones, disabled controls, and scaled-radius clamping so dense
  workspace views feel steadier across themes, density, and UI scale.
- Refined popup, side panel, and install-review feedback states with calmer
  microcopy, stronger focus/disabled affordances, better compact empty states,
  semantic toast roles, and skeleton-style loading treatment.
- Extended UX/a11y regression coverage for explicit dashboard search/empty
  semantics, toast tone contracts, cross-surface polish markers, and runtime
  radius guardrails.

### 2026-05-24 — Shared utilities TypeScript promotion

- Promoted `shared/utils.js` to a generated runtime artifact from
  `src/shared/utils.ts` using multi-global output for `escapeHtml`,
  `generateId`, `sanitizeUrl`, `classifyInstallSource`, and `formatBytes`.
- Ported `classifyInstallSource` into the TypeScript shared source so install
  and update source-trust classification is no longer JS-only.
- Added generated-runtime shared utility coverage for global bindings, URL
  sanitization, install-source classification, ID generation, and byte
  formatting.

### 2026-05-24 — I18n TypeScript promotion

- Promoted `modules/i18n.js` to a generated runtime artifact from
  `src/modules/i18n.ts`, moving another early service-worker module under the
  TypeScript authoritative-source generator.
- Updated the locale coverage extractor to accept generated CommonJS
  `var translations = ...` declarations as well as handwritten `const`
  dictionaries, keeping `npm run locale:check` compatible with generated
  runtime output.
- Added generated-runtime i18n coverage for regional locale normalization,
  placeholder substitution, and DOM translation attributes.

### 2026-05-24 — Analyzer TypeScript promotion

- Promoted `bg/analyzer.js` to a generated runtime artifact from
  `src/bg/analyzer.ts`, continuing the background-helper tranche after
  NetworkLog.
- Reconciled analyzer fallback drift before promotion: the TS source now keeps
  URL schemes intact while stripping comments and scans every long string for
  high entropy instead of only the first one.
- Added generated-runtime and source regressions for URL comment stripping and
  multi-string entropy detection, then rebuilt `background.js` from the
  generated analyzer artifact.

### 2026-05-24 — NetworkLog TypeScript promotion

- Promoted `bg/netlog.js` to a generated runtime artifact from
  `src/bg/netlog.ts`, starting the background-helper tranche of the
  TypeScript authoritative-source migration.
- Added `NetworkLog` to the TS runtime generator and promotion map so runtime
  network-log edits are now gated by `npm run ts-runtime:check` and
  `npm run ts-source:check`.
- Rebuilt `background.js` from the generated artifact and verified the
  existing runtime/source network-log behavior around newest-first reads,
  filters, stats, max-entry trimming, and targeted clears.

### 2026-05-24 — Migration TypeScript promotion

- Promoted `modules/migration.js` to a generated runtime artifact from
  `src/modules/migration.ts`, starting the sync/import tranche of the
  TypeScript authoritative-source migration.
- Extended the TS runtime generator and drift gate inventory for the
  migration module, plus added generated-runtime coverage for shape,
  quiet-hours migration, stamp idempotency, and legacy script normalization.
- Kept `Migration.CURRENT_VERSION` aligned with the current `2.3.0` runtime
  stamp so generated migration code does not downgrade existing installs'
  `sv_lastMigratedVersion` marker.

### 2026-05-24 — Storage TypeScript promotion

- Promoted `modules/storage.js` to a generated runtime artifact from
  `src/modules/storage.ts`, making the v3 IndexedDB-backed storage engine
  production-authoritative for scripts and GM value bags.
- Extended the TS runtime generator with multi-global exports so generated
  modules can expose `SettingsManager`, `ScriptStorage`, `ScriptValues`,
  `FolderStorage`, `TabStorage`, and the script-change hook expected by the
  concatenated service worker.
- Rewired MatchSet invalidation through `setScriptChangeListener`, removed
  duplicate notification click/close listener registration from the TS storage
  source, and refreshed runtime storage tests around migration, IDB deletes,
  value isolation, folder rollback, and generated-artifact shape.

### 2026-05-24 — Resource cache TypeScript promotion

- Promoted `modules/resources.js` to a generated runtime artifact from
  `src/modules/resources.ts`, continuing the storage/resource-layer
  TypeScript authoritative-source tranche.
- Reconciled ResourceCache TS drift before promotion: restored LR-002
  in-flight fetch deduplication and `chrome.storage.local.get(null)` cache-key
  enumeration behavior.
- Added source coverage for concurrent resource fetch deduplication and
  extended generator/drift coverage to eight promoted modules.

### 2026-05-24 — Internal host guard TypeScript promotion

- Promoted `modules/internal-host-guard.js` to a generated runtime artifact
  from `src/background/internal-host-guard.ts`, keeping the SSRF pre-flight
  and post-flight classifiers TypeScript-authoritative.
- Extended the TS runtime generator and drift-gate coverage to seven promoted
  modules, including the generated namespace-wrapper shape used by
  `InternalHostGuard`.
- Rebuilt `background.js` so resource, install, update, and local-script
  fetch paths consume the generated guard artifact.

### 2026-05-24 — XHR TypeScript promotion

- Promoted `modules/xhr.js` to a generated runtime artifact from
  `src/modules/xhr.ts`, starting the storage/resource-layer tranche of the
  TypeScript authoritative-source migration.
- Extended TS runtime generator and drift-gate coverage to six promoted
  modules, including `XhrManager`.
- Added source-side coverage for `XhrManager.buildFetchOptions()` cache,
  redirect, and anonymous credential translation.

### 2026-05-24 — UserStyles TypeScript promotion

- Promoted `modules/userstyles.js` to a TS-derived runtime artifact from
  `src/modules/userstyles.ts`, completing the current low-dependency module
  tranche in the TypeScript authoritative-source migration.
- Added `tests/userstyles.test.js` to exercise the generated runtime artifact
  for prior-CSS removal, scoped `@match` conversion, and full UserCSS metadata
  edit handling.
- Tightened `scripts/check-ts-source-drift.mjs` so first-time promotion commits
  are allowed when the promotion map changes from mirrored to promoted, while
  later promoted JS-only edits still fail the gate.

### 2026-05-24 — Quota manager TypeScript promotion

- Promoted `modules/quota-manager.js` to a generated runtime artifact from
  `src/modules/quota-manager.ts`, preserving the background concatenation
  contract while making the stronger TS implementation authoritative.
- Added `tests/quota-manager.test.js` to exercise the generated runtime
  artifact against object-map script breakdowns, cleanup actions, and
  aggressive critical-storage cleanup merging.
- Extended TS runtime artifact and drift-gate coverage to four promoted
  modules: ErrorLog, NotificationSystem, NpmResolver, and QuotaManager.

### 2026-05-24 — NPM resolver TypeScript promotion

- Promoted `modules/npm-resolve.js` to a TS-derived runtime artifact from
  `src/modules/npm-resolve.ts`, making the TS source authoritative for npm
  package resolution.
- Reconciled explicit `npm:pkg@latest` handling so the TS source resolves the
  current registry version before building CDN URLs, matching the runtime
  behavior.
- Extended runtime/source/generator/drift tests for three promoted modules and
  added regression coverage for explicit `@latest` resolution.

### 2026-05-24 — Notification TypeScript promotion

- Promoted `modules/notifications.js` to the same TS-derived runtime artifact
  path as ErrorLog, generated from `src/modules/notifications.ts` before
  `background.js` is built.
- Reconciled notification TS drift for fallback local click-context cleanup
  alarms and post-threshold error-count reset behavior.
- Extended TS runtime artifact checks and drift-gate expectations to cover two
  promoted modules, and added runtime/source tests for local-context cleanup
  plus error-count reset after notifications.

### 2026-05-24 — ErrorLog TypeScript promotion pilot

- Promoted `modules/error-log.js` to a generated runtime artifact from
  `src/modules/error-log.ts`, preserving the single-file background build
  while making the TypeScript source authoritative for the module.
- Added `scripts/generate-ts-runtime-modules.mjs`, `npm run
  ts-runtime:generate`, and `npm run ts-runtime:check`; CI now verifies the
  committed ErrorLog runtime artifact is in sync with its TS source.
- Reconciled the TS ErrorLog implementation with runtime debounce/flush
  behavior, including `SAVE_DEBOUNCE_MS`, `flush()`, `_save()`, cache reset
  hooks, and mutable `MAX_ENTRIES` compatibility for existing tests.
- Added `tests/ts-runtime-modules.test.js` and updated the source drift gate
  so `modules/error-log.js` is the first `promoted` TS-authoritative module.

### 2026-05-24 — TypeScript source drift gate

- Added `ts-source-promotion.json` to inventory each runtime JS surface, its
  TypeScript source counterpart, and whether it is mirrored, a promotion
  candidate, promoted, or intentionally divergent.
- Added `scripts/check-ts-source-drift.mjs` plus `npm run ts-source:check`
  and `npm run ts-source:report`; the default gate fails when promoted
  runtime JS changes without the matching TS source or generated artifact.
- Wired the TS source drift gate into CI and added
  `tests/ts-source-drift-gate.test.js` for map validation, report output,
  promoted-module violations, and candidate/divergent exemptions.

### 2026-05-24 — TypeScript authoritative-source design

- Added `docs/ts-authoritative-source-design.md`, choosing a staged
  promotion path where individual runtime JS modules are replaced by
  TS-derived runtime artifacts without changing the single-file service
  worker contract.
- Inventoried the current JS/TS split, documented known drift examples, and
  selected `modules/error-log.js` as the first pilot because it is isolated,
  already tested, and has concrete debounce/flush drift to reconcile.
- Proposed a promotion map plus drift gate that blocks future JS-only edits
  after a module is marked as TS-authoritative.

### 2026-05-24 — Per-script trust receipt diffs

- `createScriptTrustReceipt` now records `@require` body hashes, byte counts,
  and added/removed/changed/unverified dependency changes when an update is
  applied.
- Update receipts now diff `@grant`, `@connect`, and `@match` permissions
  against the previous script version, while preserving rollback-point receipt
  behavior for version history entries.
- The dashboard recent-update banner includes a `Review changes` action when
  auto-updated scripts carry dependency or permission deltas, opening a modal
  that lists each changed dependency and permission addition/removal.
- Added `tests/trust-receipt-diff.test.js` for dependency hashes, permission
  diffs, `applyUpdate` persistence, and dashboard/banner wiring.

### 2026-05-24 — Dashboard large-library virtualization

- Added `pages/dashboard-virtual-rows.js`, a small table virtualizer that
  renders only the visible script rows plus before/after spacer rows for large
  flat dashboard libraries.
- Dashboard table rendering now switches to the virtual path when
  `state.scripts.length` exceeds the tunable
  `dashboardVirtualizationThreshold` setting, while preserving the direct
  render path for smaller libraries and folder-grouped views.
- Extended `scripts/smoke-large-library.mjs` with 1k and 10k dashboard render
  p99 checks, and added `tests/dashboard-virtual-rows.test.js` for spacer
  math plus visible-window rendering.

### 2026-05-24 — Disabled ESM userscript bundler R-1

- Added the off-by-default `experimentalESMUserscripts` setting and parser
  detection for `@module 1` plus Violentmonkey's `@inject-into module`.
- Added `bg/esm-bundler.js` and `src/bg/esm-bundler.ts`. The bundler uses
  the offscreen Acorn parser to discover static imports/exports, rewrites
  imports to a local `__require(...)` module table, recursively fetches
  dependencies through the existing `fetchRequireScript` path, and rejects
  dynamic `import()` with an author-visible error.
- Install and update paths now bundle ESM scripts only when the experimental
  flag is enabled; with the default setting they reject ESM scripts without
  changing the classic userscript path.
- Added `tests/esm-bundler.test.js` and `tests/esm-csp.test.js` covering
  metadata detection, default-off gating, static import rewrite, transitive
  dependency expansion, dynamic-import rejection, and failed dependency/SRI
  fetch rejection.

### 2026-05-24 — Manifest generator implementation

- Added `scripts/generate-manifest-firefox.mjs` plus
  `manifest-firefox.transformations.json`. The Firefox profile now
  regenerates the committed `manifest-firefox.json` byte-for-byte from
  `manifest.json`, and the Edge profile produces the staged
  `build-edge/manifest.json`.
- `build-firefox.sh` now fails early on generated-manifest drift before
  packaging, while `scripts/build-edge.mjs` uses the same generator instead
  of an inline `EDGE_TRANSFORMS` object.
- Added `tests/manifest-generator.test.js` for round-trip parity,
  idempotent transformations, parseability, and Firefox/Edge schema shape.
  Refreshed the Firefox package gate to assert the generator check.

### 2026-05-24 — Quick Wins consolidation pass

- Closed every roadmap "Quick Win" bullet by either implementing it,
  pinning the existing implementation with a documented reference, or
  ticking the work as part of the active session.
- Added `docs/readme-feature-claim-checklist.md` mapping every README
  feature claim to its code entry point and regression test, so a
  maintainer can verify the README is current on each release.
- Added `docs/dependency-audit-policy.md` codifying the existing
  `npm audit --audit-level=high --omit=optional` blocking gate with an
  explicit exception process and rejection of the "advisory-only"
  alternative.

### 2026-05-24 — Userstyle compatibility baseline

- Added `tests/userstyle-compat-fixtures.test.js` (18 cases) — seven
  representative UserCSS fixtures covering every `@var` type, both
  variable substitution shapes, `@-moz-document` blocks, multi-section
  bodies, and Japanese labels/defaults.
- Documented Chrome/Firefox parity, deferred items ("advanced color
  variables"), and a manual Firefox verification checklist in
  `docs/userstyle-compat.md`.

### 2026-05-24 — S3-compatible sync provider

- Added an `s3` provider to `CloudSyncProviders` with a full AWS Signature
  v4 implementation using Web Crypto SubtleCrypto (HMAC-SHA256 + SHA-256;
  no SDK). Works against AWS S3, Cloudflare R2, MinIO, Backblaze B2, and
  any other S3-compatible endpoint.
- URL construction automatically handles virtual-host style for AWS hosts
  and path-style for everything else. `s3PathStyle: true` forces
  path-style on AWS endpoints.
- Structured `validate()` returns `{ valid, errors[] }` for per-field UI
  feedback covering endpoint URL scheme/path, region, bucket name, and
  credential presence.
- Settings UI: new "S3-compatible (AWS / R2 / MinIO / B2)" option in the
  Userscript Sync provider picker, with a six-field settings block
  (endpoint, region, bucket, access key ID, secret key, object key
  override). Saved and loaded alongside other providers.
- Added `s3*` fields to the `Settings` type, the `SyncProvider` union,
  and `src/config/settings-defaults.json`.
- Added `tests/s3-sync-provider.test.js` (21 cases — validation, URL
  construction, SigV4 signing, upload/download/test round-trip against a
  mock server, disclosure + status + disconnect).

### 2026-05-24 — ESM userscript + local-dev research

- Added `docs/esm-userscript-research.md`. Identifies the install-time
  pre-bundling shape as the only viable ESM path under MV3 (`<script
  type="module">` page injection is rejected on isolation grounds),
  documents the CSP envelope, requires reuse of existing SRI / host /
  bounded-fetch audit gates, and rejects runtime `import()` permanently.
- Local-dev mode chooses an SSE-from-localhost loop under a future
  Developer Mode panel; filesystem watchers are not viable in MV3.
- Phased migration R-1 → R-5, all gated off-by-default. Reserved
  `tests/esm-bundler.test.js` + `tests/esm-csp.test.js` as the bundler
  verification gate.

### 2026-05-24 — Microsoft Edge Add-ons package path

- Added `scripts/build-edge.mjs` that runs the standard esbuild pipeline,
  stages a Chrome-derived package under `build-edge/`, applies a small
  declarative manifest transform set (today: strip `update_url`), runs a
  missing-file audit, and produces
  `edge-artifacts/scriptvault-edge-vX.Y.Z.zip` plus a sidecar build report.
- npm scripts wired: `build:edge`, `build:edge:check`, `build:edge:stage`.
- Submission checklist + manifest-difference table + unsupported-permissions
  slot at `docs/edge-submission.md`.
- `build-edge/` and `edge-artifacts/` added to `.gitignore`.
- Added `tests/edge-build.test.js` (5 cases) verifying the staged build
  contents, manifest transform, summary JSON shape, and --check exit
  code.

### 2026-05-24 — Manifest generation design doc

- Added `docs/manifest-generation-design.md`. Measured the current Chrome
  vs Firefox manifest drift (108 diff lines across 8 sections), evaluated
  WXT vs a thin generator script vs status quo, and chose Option B
  (generator) with documented next steps. WXT was rejected because it
  conflicts with the inlined service-worker build pipeline that Chrome
  MV3 requires.

### 2026-05-24 — Locale coverage CI gate

- Added `scripts/check-locales.mjs` which audits `_locales/*/messages.json`,
  `modules/i18n.js` runtime dict, and `pages/dashboard-i18n-v2.js`
  dashboard dict for key-set parity, cross-source locale-set agreement,
  and translation-coverage shortfalls.
- Wired three npm scripts with documented severity tiers:
  `npm run locale:check` (report only),
  `npm run locale:check:gate` (fails on `_locales/` drift + cross-source
  mismatches — the manifest-shipping surfaces), and
  `npm run locale:check:strict` (also fails on inline-dict drift; opt-in
  until the runtime-dict backfill lands).
- Added `tests/check-locales-report.test.js` so the JSON contract + exit
  codes are pinned in CI.
- Documented the gate, surfaces, and follow-up backfill in
  `docs/locale-coverage.md`.

### 2026-05-24 — Install-source trust badges + source-change warning

- Added shared `classifyInstallSource(url)` helper in `shared/utils.js` that
  maps install/update URLs to known registries (Greasy Fork, Sleazy Fork
  warn-tier, OpenUserJS, GitHub Gist / raw / repo / release with release
  promoted to good-tier, GitLab, Codeberg, Bitbucket, Tampermonkey site,
  and `other` for unknown hosts). Empty input returns the `local` shape.
- `installFromCode` persists `script.installSource` on install; `applyUpdate`
  reclassifies on update and sets `settings.sourceIdentityChanged = true`
  plus `previousInstallSource` when the registry id changes.
- Dashboard script rows render a tone-coded source badge near the name
  (`script-health-badge .good`, `.neutral`, or `.alert`) and a "Source
  changed" warning badge whenever `settings.sourceIdentityChanged` is true.
- Install confirmation page's trust card surfaces a "Source registry
  changed" review row when re-installing from a different registry than
  the original install.
- New `.script-health-badge.good` and `.neutral` CSS variants reuse the
  existing 8px corner radius (never pill backdrops).

### 2026-05-24 — Dashboard search corpus widened + editor find history

- Dashboard search now matches against a single flattened corpus per
  script: name/description/author/namespace/version plus every URL pattern
  field (`match`, `include`, `exclude`, `userMatches`, `userIncludes`,
  `userExcludes`), tags (`meta.tag` + `settings.tags`), grants,
  homepage/support/update/download URLs, and ISO yyyy-mm-dd renderings of
  `stats.lastRun` and `updatedAt`. Plain substring, `code:`, regex
  (`re:` / `/.../flags`), and the invert prefixes (`!`, `not:`) all
  benefit. Corpus is memoized per-script keyed on `updatedAt`.
- Monaco find widget now persists its search history to
  `chrome.storage.local.editorFindHistory` (FIFO 20, dedup) and primes
  the widget with the most recent term when the editor opens. Sandbox
  forwards every `findController` searchString change via
  `postMessage({type:'find-search'})`; adapter records and primes via
  `prime-find`.

### 2026-05-24 — Site-scoped controls, invert search, and per-script frame mode

- Added a per-script `settings.frameMode` (`'top'` | `'all'` | `'default'`)
  that overrides `@noframes` when computing `allFrames` for
  `chrome.userScripts.register`. Honored in both runtime `background.core.js`
  and the TS mirror `src/background/registration.ts`. Added to `EXEC_KEYS`
  so a setting change re-registers the script.
- Dashboard per-script Execution panel gains a Frame mode select with the
  three documented options. Serialized in `saveScriptSettings` and
  `resetScriptSettings`.
- Dashboard search bar now recognizes `!term` and `not:term` prefixes as
  inverted matches against name/description/author/code. Honored across
  substring, `code:`, and regex (`re:` / `/.../flags`) shapes. An empty
  payload after the prefix keeps all rows, and the literal `!=` is
  preserved (not stripped as an invert).
- Popup gains a `Run only on this domain` quick-action that flips
  `pageFilterMode` to `whitelist` and adds `https://<host>/*` to
  `whitelistedPages`. Toggles back to `blacklist` on a second click and
  refreshes its label when the utilities menu opens.

### 2026-05-24 — Large-library perf harness and threshold gate

- Added `scripts/smoke-large-library.mjs`, a Node harness that generates 1k
  and 10k synthetic scripts, exercises the authoritative `MatchSet` from
  `src/background/url-matcher.ts`, and measures build / `getCandidates` /
  `getMatching` p50 + p99 / substring search / `localeCompare` sort cost.
- Added `scripts/ts-loader.mjs` so the smoke script can import the TS source
  directly via esbuild (already a dev dep) without a separate build step.
- Added `npm run smoke:large-library` (report only) and
  `npm run smoke:large-library:check` (exit 1 on threshold violation).
- Mirrored a CI-safe 1k pass in `tests/large-library-perf.test.js` so a
  regression fails the standard test suite (5 cases).
- Documented thresholds and harness shape in `docs/large-library-perf.md`.

### 2026-05-24 — Restore receipts, backup verification, and undoable imports

- Added `BackupScheduler.verifyBackup(backupId, { parseUserscript })` which
  walks every userscript in an archive, validates options/storage JSON plus
  `global-settings.json`/`folders.json`/`workspaces.json`, and reports
  per-script parse errors, missing options, structural validity, and
  install-id conflicts without mutating state. Exposed via the new
  `verifyBackup` background action and a **Verify** button in the backup
  review modal.
- `restoreBackup` now snapshots the live script + values state (plus
  settings/folders/workspaces on full restore) before mutation and persists
  a `restoreReceipts` ledger entry (FIFO cap 10). The receipt id is returned
  in the result so the dashboard restore toast can offer a 15-second
  **Undo** action.
- Added `rollbackRestore` background action that re-applies the snapshotted
  state, deletes scripts the restore added (via the receipt's
  `addedScriptIds`), and marks the receipt as rolled back so a second
  rollback responds with `alreadyRolledBack`.
- `importScripts` and `importFromZip` now snapshot every overwritten script
  into `versionHistory` (with `source: 'import'` + caller-supplied label)
  and record an import receipt with the same shape as restore receipts.
  Dashboard ZIP/JSON import toasts now surface the same **Undo** action so
  an overwriting import is reversible end-to-end.
- Added `getRestoreReceipts`, `getRestoreReceipt`, and
  `clearRestoreReceipts` actions so the dashboard can inspect or clear the
  ledger.
- Added regression coverage in `tests/backup-receipts.test.js`
  (verifyBackup, restoreBackup snapshot, rollback, retention) and
  `tests/import-snapshot.test.js` (versionHistory push + receipt recording
  for both `importScripts` and `importFromZip`).

### 2026-05-24 — Sync safety cockpit

- Added shared sync-provider health metadata for WebDAV, Google Drive,
  Dropbox, OneDrive, and EasyCloud, including last-sync reporting,
  manual-sync capability flags, dry-run support flags, and token/credential
  storage disclosure without exposing stored secret values.
- Added dashboard controls to check provider health, run a no-write dry-run
  conflict preview, and revoke or clear saved provider access from the
  Userscript Sync settings panel.
- Added a no-write `CloudSync.preview()` path that compares local and remote
  sync envelopes and reports local-only, remote-only, newer, tombstoned, and
  potential 3-way conflict counts before a real sync mutates local or remote
  data.
- Hardened WebDAV parity with status and local credential clearing, and made
  the Gist panel's token storage copy match the current `chrome.storage.local`
  model.
- Added provider, cloud-sync, and dashboard wiring coverage in
  `tests/source-sync-providers.test.js`, `tests/source-cloud-sync.test.js`,
  and `tests/sync-cockpit.test.js`.

### 2026-05-24 — Browser support matrix generator

- Added `scripts/generate-browser-support-matrix.mjs` plus
  `npm run support:matrix` / `npm run support:matrix:check` to generate the
  README and cross-browser pipeline support matrix from the Chrome and Firefox
  manifests plus the latest Firefox lint artifact.
- CI now checks the generated matrix after Chrome dashboard smoke and Firefox
  package validation, so manifest target or lint-result drift must update the
  support claims.
- Added `scripts/run-bash.mjs` and routed Firefox package scripts through it so
  Windows PowerShell can find Git Bash even when `bash` is not on `PATH`.

### 2026-05-24 — Accessibility surface pass

- Added forced-colors system-color fallbacks for dashboard, popup, side panel,
  and install surfaces so Windows High Contrast mode does not depend on
  decorative shadows, gradients, or custom color-only focus rings.
- Added skip links for popup, side panel, and install pages, and raised compact
  popup/side-panel script toggles to 24px-class touch targets.
- Expanded `npm run test:a11y` to run dashboard, popup, cross-surface UX, and
  the new `tests/accessibility-surface-pass.test.js` forced-colors/live-region
  audit.

### 2026-05-24 — CSV export formula-injection coverage

- Inventory confirmed the current CSV emitters are dashboard stats, CSP
  reports, and error-log exports; there is no current netlog CSV exporter.
- Refactored dashboard stats CSV generation through a small pure builder so the
  production formatter is directly covered by tests.
- Added `tests/csv-export-formula.test.js` covering dashboard stats and CSP
  report formula-control defanging across leading `=`, `+`, `-`, `@`, tab, and
  carriage-return payloads. Existing error-log tests continue covering the
  error-log CSV exporter.

### 2026-05-24 — Install/update trust receipts and rollback points

- Added `src/background/trust-receipt.ts` and runtime receipt helpers that
  record the latest install/update receipt on each script.
- Trust receipts now include install/update source, SHA-256 hashes, grants,
  host scope, `@require`/`@resource` dependency counts, line diff summary, and
  a concrete `rollbackScript` restore target when a previous version exists.
- Install-page saves pass the reviewed source URL and operation (`install`,
  `update`, `reinstall`, or `downgrade`) into `saveScript`; direct
  `installFromUrl`/`installFromCode` and auto/manual `applyUpdate` paths record
  receipts too.
- Update checks now carry `sourceUrl` through dashboard/popup apply-update
  calls so receipts identify the fetched update channel.
- Dashboard script info now shows the latest trust receipt summary beside the
  existing provenance and version-history rollback controls.
- Added `tests/trust-receipt.test.js` covering receipt hashes/source/scope/
  dependencies/diff fields and the update rollback-point receipt contract.

### 2026-05-24 — Shared internal-host / SSRF / redirect fetch policy

- Added `src/background/internal-host-guard.ts` and the runtime mirror
  `modules/internal-host-guard.js` as the canonical IPv4/IPv6
  loopback/private/link-local/CGNAT/unspecified/broadcast/ULA classifier.
  Handles `localhost*` aliases and both textual (`::ffff:10.0.0.1`) and
  WHATWG-normalized (`::ffff:a00:1`) IPv4-mapped IPv6 forms, plus the
  `169.254.169.254` cloud-metadata address.
- Wired pre-flight `classifyFetchUrl` / `assertExternalFetchUrl` and
  post-flight `classifyResponseUrl` (against the response's final URL) into:
  - `installFromUrl`, context-menu link install, and the `webNavigation`
    `.user.js` interceptor (script install paths).
  - `fetchWithRetry`, `fetchRequireScript`, and `GM_loadScript` (dynamic
    script/dependency loaders).
  - `ResourceCache.fetchResource` in both runtime JS and the TypeScript mirror
    (@resource fetcher).
  - `UpdateChecker.fetchUpdateCandidate` in both runtime JS and the TypeScript
    mirror (auto-update fetch).
- Updated `esbuild.config.mjs` to concatenate `modules/internal-host-guard.js`
  before `modules/resources.js` so the runtime mirror is in scope for
  every fetch path that depends on it.
- Added parity and focused end-to-end tests that compare the JS mirror and TS
  module side-by-side across every CIDR block, IPv6 form, and edge case, then
  prove install, update, @require, and @resource paths reject pre-fetch internal
  hosts and post-fetch redirect targets that resolved to private space.

### 2026-05-24 — User-script messaging gate

- Added `USER_SCRIPT_MESSAGING_AVAILABLE` feature detection for
  `chrome.runtime.onUserScriptMessage` (Chrome 131+); the dedicated listener
  remains the primary route for user-script-origin GM_* and telemetry calls.
- Hardened the shared `chrome.runtime.onMessage` listener: tab-origin senders
  (anything that does not originate from a `chrome-extension://<id>/` URL on
  this extension) are now restricted to the same user-script allowlist
  (`GM_*`, `GM.*`, `netlog_record`, `reportExecError`, `reportExecTime`). This
  closes the Chrome 130 / Firefox-without-onUserScriptMessage fallback path
  where a user script using `chrome.runtime.sendMessage` could otherwise reach
  privileged dashboard actions.
- Added six new contract tests in `tests/content-bridge-security.test.js`
  covering allow/deny for tab vs extension-surface senders, spoofed
  `chrome-extension://` origins, and listener registration on supporting and
  non-supporting runtimes.

### 2026-05-24 — Permission and store-copy drift gate

- Added `docs/store-listing-copy.md` as the reviewer-facing permission and
  privacy copy source for Chrome Web Store and AMO submissions.
- Expanded `PRIVACY.md` with a generated-checkable manifest surface inventory
  covering permissions, optional permissions, host matches, content-script
  matches, web-accessible resources, sandbox pages, and Firefox data-collection
  declarations.
- Added `npm run store-copy:check` and wired it into CI/release docs so
  manifest permission changes now fail unless privacy/store copy is updated.
- Added a README permission review section that points maintainers to the
  store-copy source and local validation command.

### 2026-05-24 — Chrome 138+ userScripts onboarding

- Centralized the runtime `chrome.userScripts.getScripts()` availability probe
  behind `getExtensionStatus`, so popup, dashboard diagnostics, support
  snapshots, repair, and registration share the same live setup state.
- Added version-aware setup state/action/url fields for Chrome 138+ **Allow
  User Scripts**, Chrome 120-137 **Developer Mode**, and unsupported browsers.
- Updated runtime repair to stop trusting stale `_userScriptsAvailable`; it
  now re-probes after the user enables the toggle and only re-registers scripts
  when the API is actually available.
- Refreshed popup/dashboard setup banners, README source-install instructions,
  and focused status tests for the Chrome 138+ transition.

### 2026-05-24 — Firefox AMO validation gate

- Added explicit AMO `browser_specific_settings.gecko.data_collection_permissions`
  and moved Firefox `userScripts` to `optional_permissions`, with Firefox
  desktop/Android minimums raised to versions that support those manifest keys.
- Added `web-ext@^10.2.0`, `npm run firefox:lint`, and
  `npm run firefox:package`; the package command emits a Firefox ZIP, AMO
  source-review ZIP, and `web-ext-lint.json` under `firefox-artifacts/`.
- Wired Firefox lint/package validation into CI and uploaded Firefox artifacts
  alongside the existing Chrome package artifacts.
- Guarded Chrome-only per-script `worldId` in both runtime JS and the
  TypeScript registration mirror so Firefox never receives the unsupported
  field.
- Omitted `lib/monaco/` from the Firefox validation package until the dedicated
  Monaco loading-path pass; the existing textarea adapter remains the fallback.

### 2026-05-24 — Release trust gate

- Added `npm run release:trust` to inspect the built Chrome ZIP, generate
  SHA-256 checksums, create a source ZIP from `git archive`, emit a
  CycloneDX 1.6 SBOM from `package-lock.json`, write SLSA-shaped provenance,
  and fail on missing/forbidden package entries.
- Added `npm run release:trust:strict` for maintainer-key signing of the
  checksum manifest with `RELEASE_SIGNING_PRIVATE_KEY_PEM` or
  `RELEASE_SIGNING_PRIVATE_KEY_PATH`.
- Wired the release trust gate into CI after `bash build.sh`, uploaded
  `release-artifacts/*` with the Chrome package, and added GitHub artifact
  attestations for the ZIP and SBOM on `main` pushes.

### 2026-05-24 — Release rollback storage drill

- Added `npm run release:rollback-drill`, a focused Vitest command that seeds
  the previous public `chrome.storage.local` script/value shape, upgrades
  through the current v3 storage migration, verifies current IndexedDB reads,
  verifies rollback-readable legacy keys, and confirms the 30-day legacy wipe
  gate.
- Wired the rollback drill into CI and the release runbook so storage migration
  regressions block release before users depend on browser rollback.
- Extended v3 migration tombstone metadata with migrated script/value counts
  and made `getMigrationStatus()` report those counts instead of returning
  zero migrated values.

### 2026-05-24 — Release runbook and CWS audit gate

- Updated `docs/release-runbook.md` so the documented release path matches the
  current manual `publish.sh` + Chrome Web Store API v2 flow instead of the
  still-pending OIDC release workflow.
- Added `npm run cws:check` to validate the installed CWS upload CLI, Node
  engine, v4-only credential model, removed flag usage, `publish.sh`,
  `cws-setup.sh`, and CI release-gate wiring without requiring store
  credentials.
- Made the CI high-severity npm audit blocking, added CWS tooling and release
  artifact parity checks to CI, and fetched tags in checkout so
  `npm run release:check` can validate the current release tag.
- Locked shell scripts to LF line endings with `.gitattributes` and corrected
  CWS setup/publish copy to avoid stale "auto-publish" wording.

### 2026-05-24 — Release artifact reconciliation

- Published the missing GitHub Release for `v3.11.0` and attached
  `ScriptVault-v3.11.0.zip` built from the `v3.11.0` tag.
- Removed the stale root `ScriptVault-firefox-v2.1.7.xpi` artifact from the
  working tree so root package artifacts no longer contradict the current
  3.11.0 manifests.
- Added `npm run release:check` / `npm run release:check:public` to verify
  package, Chrome manifest, Firefox manifest, README, changelog, local root
  artifacts, Git tag, latest GitHub release, and release asset alignment.

### 2026-05-24 — Engineering hardening pass

- Hardened GM_webRequest declarativeNetRequest cleanup so failed DNR removals
  keep their persisted owner map for retry instead of stranding live rules.
- Rolled back newly added DNR rules when `_webRequestRuleMap` persistence fails,
  avoiding ownerless rules after service-worker restarts.
- Brought the TypeScript DNR mirror up to parity with runtime persistence,
  hydration, removal, and reconciliation behavior, with regression tests for
  restart hydration, persistence rollback, removal retry, and orphan reconcile.
- Brought the TypeScript wrapper mirror up to parity with the runtime
  page-scoped `window.onurlchange` dispatcher so future wrapper builds do not
  restack history patches on script re-injection.
- Added a shared TypeScript `fetchTextBounded` helper and moved the TS install,
  update, @require/resource, and context-menu install paths off raw
  `response.text()` reads so the mirror now matches runtime bounded-fetch
  hardening.
- Added `tests/source-hardening-parity.test.js` to guard bounded TS fetches,
  empty-grant denial in the wrapper mirror, and promise-based Gist token
  storage rejection propagation.
- Updated repo working notes to remove the now-fixed DNR orphaning and
  `window.onurlchange` stacking items from the remaining-issues list.

### 2026-05-24 — Premium UI polish pass

- Normalized dashboard, popup, side panel, install review, DevTools, Script Store,
  card view, collections, profiles, snippets, templates, and keyboard overlay
  surface styling to use rectangular 4-8px radii instead of oversized pill/card
  backdrops.
- Replaced blur-heavy extension-page backdrops with solid/linear layered
  surfaces, tightened focus rings and disabled states, and added calmer loading
  skeletons to the popup and side panel.
- Improved empty/error/status copy in popup, side panel, and DevTools so failed
  background connection, unsupported pages, empty vaults, and empty request
  tables explain the next useful action instead of feeling blank.
- Refined the dashboard Find Userscripts flow with a calmer directory-search
  header, structured empty/error/loading states, source-aware result counts,
  preview-region semantics, install/reinstall label recovery, and explicit
  unavailable-preview/install feedback.
- Guarded more dashboard settings and utility actions with pending button
  states, single section-level save confirmations, and consistent failure
  feedback so repeated clicks do not create duplicate saves or ambiguous
  long-running operations.
- Replaced remaining dashboard utility "Loading..." placeholders and inline
  network-log empties with consistent ellipsis/status language and shared
  empty-state styling.
- Refined install-review terminal states with semantic success/error panels,
  clearer "no script was saved" failure recovery, private-window guidance, and
  a primary dashboard handoff after successful installs.
- Converted the CSP bypass panel to real disclosure/switch controls with
  explicit security-warning copy and keyboard-visible focus treatment.
- Added a GUI audit guard that fails when page UI CSS reintroduces oversized
  rounded backdrops or blur-heavy chrome.

### 2026-05-24 — TS-mirror drift cleanup + repo hygiene

- **Phase 39.11** TS-mirror parity. `@match-top` / `@exclude-top` (TM #2784)
  was shipped in `background.core.js` during the v3.11.0 wave but the
  typed mirror lagged. Added `matchTop` / `excludeTop` to `ScriptMeta`,
  taught the TS parser the hyphenated + camelCase forms via a new
  `ARRAY_ALIASES` map (also extends Phase 36.6 comma-split desugar to
  both keys), and ported the wrapper-side runtime guard block to
  `src/background/wrapper-builder.ts`. New `tests/match-top-39-11.test.js`
  pins 12 cases against the real TS parser + wrapper-builder.
- **Phase 39.13** TS-mirror parity. `GM_openInTab` now routes `blob:`,
  `data:`, and `about:` URLs through `window.open()` in-context in the
  TS wrapper too (was only in runtime JS). The blob registry binding
  survives because the URL never crosses into the background SW.
- **Phase 40.5** TS-mirror parity. `_notifCallbacks` (cap 500),
  `_openedTabs` (cap 200), and `_downloadCallbacks` (cap 200) in
  `src/background/wrapper-builder.ts` now each evict the oldest entry
  on cap. Prevents a misbehaving script that never receives the
  corresponding event from leaking unbounded entries in the
  USER_SCRIPT world.
- **Phase 40.14** TS-mirror parity. Eviction counters
  (`_notifCallbacksEvicted`, `_openedTabsEvicted`,
  `_downloadCallbacksEvicted`) log a one-line warning on the first
  eviction and every 100th thereafter so the DevTools panel can
  surface a "this script is leaking callbacks" hint without any
  telemetry beacon. New `tests/wrapper-gm-tabs-39-13.test.js` pins 8
  cases.
- **Phase 39.22** TS-mirror parity. The `_withTimeout` helper (VM
  #2513 — CSP-strict-page deadlock prevention) is now also in
  `src/background/registration.ts`: 15s per `@require` preload and 5s
  per `registerScript()` call inside `registerAllScripts`.
- **Repo hygiene**:
  - Removed `build-background.sh` (deprecated since CLAUDE.md Round 10;
    `esbuild.config.mjs` has been the canonical builder for months).
    `build-firefox.sh` no longer falls back to the legacy bash builder.
  - Removed `pages/devtools-panel-v2.js` (orphaned — never reached by
    any caller; the active DevTools panel loads via
    `pages/devtools-panel.html` → `devtools-panel.js`). Dropped the
    dead `devtools` entry from `pages/dashboard-lazy-loader.js`
    `ON_DEMAND_MODULES`.
  - Synced `manifest-firefox.json` version 2.1.8 → 3.11.0 to stop the
    Firefox-port branch from drifting further during Phase 1 of the port.
  - Added the omnibox keyword `sv` to the README quick-start so users
    can discover the Phase 39.29 address-bar fuzzy-search affordance.
  - Added `RESEARCH_FEATURE_PLAN.md` (companion to `ROADMAP.md`)
    capturing the prioritized P0–P3 punch list (NF-1..NF-10,
    EI-1..EI-17) from a 2026-05-24 deep audit pass.
  - Added `CLAUDE.md` / `AGENTS.md` / `.factory/` to `.gitignore` as
    local-only autonomous-loop runtime state.

tsc --noEmit clean; focused vitest runs 19/19 green (match-top-39-11 +
wrapper-gm-tabs-39-13); full-suite vitest 663/663 passing with the
known HGFS worker-spawn flake on this VM (6 worker timeouts unrelated
to the changes).

### Earlier iter-2 work (still unreleased)

- **LR-001** OAuth refresh wraps fetch in AbortController + 15s timeout. Google / Dropbox / OneDrive `refreshToken()` paths previously called `fetch()` with no signal — a slow or unresponsive network would hang every `getValidToken()` caller until the OS gave up (minutes). New `_oauthFetchWithTimeout` helper in `modules/sync-providers.js` returns null cleanly on AbortError or any network-level rejection, matching the existing null-return contract. 5 new regression cases in `tests/oauth-refresh-timeout.test.js`.
- **LR-002** ResourceCache concurrent-fetch dedup. Two scripts requesting the same `@require` URL simultaneously used to both miss the cache, both call `fetch()`, and race on `cache.set` — wasting bandwidth and producing last-write-wins on the persisted dataUri. Added `_pendingFetches: Map<url, Promise<text>>` so concurrent callers share the in-flight promise. Failed fetch clears the entry so retries aren't poisoned. 3 new regression cases in `tests/resources.test.js` (dedup, failure-recovery, cache-hit-short-circuit).
- **LR-003** AST analyzer detectors for three obfuscation patterns the literal-`eval` detector misses: indirect-eval (`(0, eval)(x)` SequenceExpression shape, invokes eval in global scope bypassing closure isolation), dynamic-property-call on globals (`window[<computed>](args)`, gated to known global receivers to avoid noise), and Function-constructor via `.apply`/`.call`/`.bind` (catches `Function.apply(null, ['return x'])` which the `new Function()` detector misses). 26 new regression cases in `tests/analyzer-ast-detectors.test.js` (positive + negative + malformed-AST + array integrity).
- **D-phase** `npm audit fix` clears 4 advisories (1 high, 3 moderate) in transitive devDependencies (basic-ftp/ip-address from puppeteer-core; postcss/ws from vitest tooling). None ship in the extension bundle.
- **CSP-RULEID** `pages/dashboard-csp.js` switches DNR rule-ID allocation from hash-mod-100K (birthday-paradox collision at ~373 hostnames in 100K pool, >99% by ~1500) to sequential allocation in a 100M-id pool, derived on load from the max stored ruleId so it survives SW restarts collision-free. Entries persist their assigned ruleId in `chrome.storage.local`. First applyBypassRule per host allocates + persists BEFORE issuing the DNR update. `_reconcileLegacyRules()` one-shot sweep cleans pre-fix hash-allocated orphan rules. Legacy `_legacyHashRuleId` retained only for migration grace on removeBypassRule. 7 new regression cases.
- **ERRLOG-PERF** `modules/error-log.js` debounces save by 200ms. Pre-fix: every `log()` call serialized the full 500-entry log (~150KB) to `chrome.storage.local`; bursty load (100 errors/sec) issued 100 storage writes/sec of largely-identical payloads. Now: `log()` schedules a save and returns; the actual `storage.local.set` fires once per debounce window. `clear()` and new public `flush()` bypass the debounce for caller-initiated immediate persistence. 3 new regression cases pin the contract.
- **WORKSPACES-INIT** `bg/workspaces.js` `_init()` now clears `_initPromise` in a try/finally on both success and failure (mirrors `modules/storage.js` init pattern). Pre-fix: the resolved promise stuck around forever; a subsequent `_cache = null` (factory reset, test isolation) found the stale promise still cached and no-op'd the next `_init()` without re-reading from storage, leaving the cache null and crashing every subsequent caller via `this._cache!.list`. 3 new regression cases.
- Tests: 45 test files, 769/769 green. `tsc --noEmit` strict clean. background.js 19,598 lines.

## [v3.11.0] — Storage & persistence rollback hardening + Phase 38 parity wave (2026-05-19)

- Added: **Phase 38.1** `GM_addElement` returns `null` (never throws) on every failure path — non-string/empty tag, `createElement` throws, falsy parent, parent without `appendChild`, or `appendChild` throws. Matches VM v2.37.0 + TM 5.5.6237 contract. Attribute-application errors no longer abort the call. Both runtime JS and TS mirror updated. 3 regression cases.
- Added: **Phase 38.2** dashboard search bar accepts regex via `re:<pattern>` (case-insensitive) or `/pattern/flags` (flags honored verbatim) prefix. `code:` prefix can be combined with regex (`code:re:fetch\(`). Invalid patterns never throw — short-circuit to no-match and surface via `aria-invalid` + tooltip. 8 regression cases pin the parser. TM 5.5.6234 parity.
- Added: **Phase 38.4** popup gains a dedicated "Context-menu scripts" section above the main list that surfaces `@run-at context-menu` scripts as one-tap launchers. Hidden when none match the active tab. 6px corner-radius count badge. TM 5.5.6234 parity.
- Added: **Phase 38.6** `window.onurlchange` subscribes to `navigation.addEventListener('navigate', ...)` as the primary detector. Catches SPA navigations that bypass pushState/replaceState (direct location assignment, library routers). pushState/replaceState/popstate/hashchange shim preserved as backstop for the Firefox port. ScriptCat v1.4 parity.
- Changed: **Phase 38.8** per-script settings panel section label `Updates` → `Update` (singular) to match VM v2.37.1 / TM split-tab convention.
- Changed: **Phase 38.9** per-script "check for updates" icon click is now check-only with a three-button confirmation modal (`View diff` / `Install update` / `Cancel`). Right-click still triggers the force-update bypass-cache path. Bulk update + popup "update" entries keep auto-installing because they have their own progress-modal confirmation. VM v2.37.1 footgun fix.
- Audited: **Phase 38.11** GM_xmlhttpRequest service-worker event-leak bug class does not translate to ScriptVault — uses AbortController + one-shot tabs.sendMessage, not persistent port.onMessage/onDisconnect subscribers. 3 regression cases pin the no-leak invariant: 1000 sequential create→remove cycles leave the table empty after auto-cleanup window; abortByScript/abortByTab remove matching requests without zombies.
- Added: **Phase 38.12** singular `tag` getter alias on `GM_info.script` (`get tag() { return Array.isArray(this.tags) ? this.tags[0] : undefined; }`) so pre-2026 scripts written against Violentmonkey's singular form keep working. VM v2.37.0 back-compat. 2 regression cases.
- Added: **Phase 38.13** multi-key rollback contract regression suite (`tests/storage.test.js`) — 7 cases pinning the cache↔persisted-state consistency invariant across `ScriptStorage.set` (update + insert), `ScriptStorage.delete` (script + values atomic restore), `ScriptStorage.clear` (all-or-nothing across multiple value bags), `ScriptValues.setAll` (batch atomicity), `FolderStorage.update` (unrelated-field preservation), `SettingsManager.set` (cache revert), and `invalidateMatchSet` suppression on rollback. The contract was already enforced by the v3.10.1 → HEAD storage-hardening commits (aca9e8c → a1e89c9); the suite locks it in.
- Storage hardening commits (folded under this release per Phase 38.13 grouping): `aca9e8c` clone storage write boundaries, `4f1e25e` isolate settings snapshots from cache, `a4c2c02` rollback settings cache on persist failure, `3b576c3` harden script value storage keys, `5d0d479` harden imported script ID handling, `d35fce7` preserve script IDs in runtime ZIP restores, `cdf17ae` harden factory reset storage cleanup, `f5f6640` rollback workspace activation state on save failure, `42e6a10` harden folder and workspace persistence rollback, `bf409f1` harden wrapper DOM and network hooks, `a1e89c9` harden userscript bridge and network fetches.
- Changed: `minimum_chrome_version` 120 → 130 (Phase 40.23). Picks up ~10 versions of cumulative security patches and aligns with the `storage.session.getKeys()` requirement.
- Tests: 42 test files, 712/712 green. `tsc --noEmit` strict clean. background.js 19,405 lines.

## [v3.10.1] — Polish polish: token-clean diff view + feature badges + button refinements

- Changed: `.feature-storage` / `.feature-xhr` / `.feature-style` / `.feature-notify` / `.feature-menu` / `.feature-unsafe` badges no longer hardcode `#22c55e33`/`#60a5fa33`/etc. — they reference `--tint-{green,blue,purple,yellow,orange,red}-soft` so the badges retint correctly in light/catppuccin themes instead of staying dark-mode-only.
- Changed: diff view (`.diff-add`, `.diff-del`, `.diff-add-count`, `.diff-del-count`, `.diff-add .diff-sign`, `.diff-del .diff-sign`) now uses `var(--accent-green)` / `var(--accent-red)` / `var(--tint-*-soft)` instead of literal hex. Light-theme diffs are readable now.
- Changed: `.toolbar-btn` got tokenised transitions, hairline border on hover, and a 0.5px press-down on `:active` for premium tactile feel. Border-radius bumped to `--r-sm`.
- Changed: `.modal-close` is now a 28×28 hit target with rounded-square hover background instead of a bare floating × — matches the rest of the icon-button system, easier to click, focusable.
- Tests: 601/601 green. CSS-only.

## [v3.10.0] — Premium UX polish (design tokens, multi-theme dashboard, refined components)

- Added: design-token layer at the top of `pages/dashboard.css` — `--hairline`, `--hairline-strong`, `--shadow-sm/md/lg`, `--overlay-scrim`, `--r-xs/sm/md/lg/pill`, `--t-fast/base/slow`, `--ease-out`, `--ease-spring`, `--focus-ring`, and per-accent `--tint-*-soft/edge` variants. Theme-aware via `[data-theme="light|catppuccin|oled"]` overrides; `color-scheme` declared so native form controls pick the right palette.
- Changed: dropped the neon-green slabs. `<th>` lost its 2px green bottom-border in favour of a hairline + uppercase 11px label; `.section-label` lost its 3px green right-bar in favour of a 1px hairline divider with refined typography. Active tabs now show a 2px accent indicator strip via `::after` rather than the old margin-overlap trick.
- Changed: table rows render as a calm hairline-shadow stack instead of hard 1px borders; selected rows get an inset 3px accent-blue rail. Empty-state typography tightened (h3 promoted to `--text-primary` / 600 weight); spinner reduced 28→24px and slowed slightly for less mechanical feel.
- Changed: toasts now have variant-tinted backgrounds + accent stripe (success / error / warning each get their own soft tint and inset 3px stripe). Modals get `backdrop-filter: blur(4px)` on the scrim, spring-eased scale-and-translate enter, and `--shadow-lg` elevation. Scrollbars are 10px transparent-track / pill-thumb that adapts to theme.
- Changed: snippet-item hover replaced its `transform: translateX(4px)` with a calmer accent-green inset stripe + 4px padding shift. Toggle switches gained an inner hairline border on OFF and a subtle knob shadow; checked transition uses spring easing.
- Added: global premium-polish layer at end-of-file — system-wide `:focus-visible` ring (2px accent-blue + 4px halo), `::selection` styling, tabular-nums on numeric columns (`.col-version`, `.col-size`, `.col-order`, `.col-updated`), and elevation on `.modal` / `.cmd-dialog`.
- Compatibility: every legacy CSS variable (`--bg-body`, `--bg-row*`, `--border-section`, `--toggle-on/off`, `--accent-*`, etc.) is preserved unchanged so the runtime theme editor (`pages/dashboard-theme-editor.js`), inline `[data-theme]` blocks in `pages/dashboard.html`, and dashboard JS modules continue to work without touch. Pure CSS pass; no HTML or JS changes.
- Tests: 601/601 green (no functional change).

## [v3.9.0] — Round 10 parser & template wins (Phases 36.4, 36.6, 36.11)

- Added: `@tag` round-trip preservation. User-assigned tags now survive script re-install and update — `getMetaArray('tag')` unions source-declared and existing tags (dedupe, first-seen order). VM v2.35.2 parity. Phase 36.4.
- Added: comma-separated convenience syntax for URL pattern arrays. `// @match a.com,b.com,c.com` now expands to three patterns at install time. Same desugaring applies to `@include`, `@exclude`, `@exclude-match`, `@connect`. `@tag` is intentionally left raw so multi-word values like `tools,utility` round-trip intact. Mirrored in `src/background/parser.ts`, `background.core.js`, and `tests/parser.test.js`. VM #2403. Phase 36.6.
- Added: `{{icon}}` template token. The blank-script template now ships with `// @icon {{icon}}` and resolves the active tab's `favIconUrl` at create-time. `{{name}}`, `{{match}}`, and `{{namespace}}` already resolved; this completes the standard set. Unresolvable directive lines are stripped to keep generated headers clean. Phase 36.11.
- Tests: 5 new regressions in `tests/parser.test.js` covering comma-split for `@match`/`@exclude-match`, single-pattern preservation, multi-word `@tag` retention, and the deliberate non-split of comma-bearing tag values. 601/601 green.

## [v3.8.0] — Install from Local File + Drag-and-Drop (Phase 12.9)

- Added: file-picker install in the dashboard Import section. Pick a `.user.js` (or `.js`) file from disk and ScriptVault parses, validates, and installs it the same way URL installs do — same 5MB ceiling, same name+namespace dedupe, same `==UserScript==` requirement.
- Added: drag-and-drop install. Drop one or more `.user.js` files anywhere on the dashboard and the page dims with a "Drop .user.js to install" overlay; on release each file is parsed and installed in sequence with a single end-of-batch toast.
- Added: new background message `installFromCode` (and `installFromCode(code)` helper exported from `src/background/install-handler.ts`). `installFromUrl` is now a thin wrapper that fetches the URL and delegates to `installFromCode`, so both paths share the same parse/dedupe/registration flow.
- Source: TM issue [#2722](https://github.com/Tampermonkey/tampermonkey/issues/2722).

## [v3.7.0] — In-app update notifications + summary OS notifications (Phase 12.10)

- Changed: `applyUpdate` no longer fires a per-script OS notification. Previously a 10-script auto-update cycle would trigger 10 OS-level "Script Updated" toasts back-to-back; now `autoUpdate` aggregates the cycle's successful updates and fires at most one summary notification (`"3 scripts updated: A v1.0 → v1.1, B v2.0 → v2.1, C v0.4 → v0.5"`).
- Added: in-app dashboard banner that lists scripts auto-updated since the last visit. Lands at the top of the Scripts tab on dashboard load. Dismiss button clears the ring on the background side so the banner stays gone next visit.
- Added: `UpdateSystem._recentUpdates` ring buffer (cap 20, newest first) plus `getRecentUpdates` / `clearRecentUpdates` background message handlers.
- Manual single-script flows (popup "Check for Update", dashboard force-update) keep their inline feedback path — they don't push onto the ring or fire a summary notification.

## [v3.6.3] — Beautify preserves cursor + scroll (Phase 7.5)

- Fixed: `beautifyCode` (editor toolbar "Beautify" button) used to slam the cursor to line 0, char 0 after every reformat. On a long file you'd lose your place every time you hit it. The cursor + vertical scroll position now stay where they were.
- Approach: capture cursor + scroll before the reformat, then map the old column to the new one — `newCh = newLeadingWS + max(0, oldCh - oldLeadingWS)` — since beautify only changes leading whitespace, the same logical line exists before/after with the same trimmed content. Cursors that sat inside the indent region snap to the start of the content on the new line.
- Falls back to the old behaviour (cursor at top) only if the editor adapter doesn't expose `getCursor()` (e.g. some Monaco-adapter edge cases on first-paint).

## [v3.6.2] — Drop fake gist token encryption (Phase 5.5)

- Removed: the AES-GCM encryption around the GitHub gist PAT was security theater. The key was derived via PBKDF2 from two string literals (`'ScriptVault-Gist-Key-v1'` + `'sv-gist-salt'`) embedded in the source — anyone with the encrypted blob and access to this file could derive the same key. Tokens now live in `chrome.storage.local` plaintext; that storage is already sandboxed by Chrome at the extension boundary, which is the actual protection.
- Migration: existing installs decrypt their stored token once (using the same legacy hardcoded inputs), re-save it under the new `gist_pat` key, and drop the legacy `gist_pat_encrypted` entry. Best-effort — if the one-shot decryption or write fails, the next dashboard load retries.
- Hardened: `clearToken()` now removes both the new and the legacy storage keys defensively, so a sign-out followed by a downgrade can't leak a token via the legacy key.
- UX: the gist setup hint now describes the storage model honestly ("Stored in `chrome.storage.local`, sandboxed by Chrome — readable only by ScriptVault") instead of claiming local encryption.

## [v3.6.1] — Webhook SSRF guard (Phase 5.5)

- Hardened: `PublicAPI.setWebhook` now rejects URLs that point at internal/loopback hosts. Previously the only validation was `https://` — a malicious web origin with capability-token access could register a webhook at `https://192.168.1.1/admin` or `https://169.254.169.254/latest/meta-data/` (cloud metadata) and exfiltrate or trigger LAN-side actions when the extension fired the webhook.
- Coverage matches the existing `_isInternalHost` SSRF guard already used by the install-from-URL flow: localhost aliases, IPv4 loopback (127/8), unspecified (0/8), RFC 1918 (10/8, 172.16/12, 192.168/16), CGNAT (100.64/10), link-local (169.254/16), broadcast, IPv6 loopback (`::1`), IPv6 link-local (`fe80::/10`), and IPv6 ULA (`fc00::/7`).
- Added: 7 new tests pinning the rejection set (localhost, RFC 1918 sweep, link-local, IPv6 loopback, IPv6 link-local, malformed URL) plus regression tests confirming public hostnames + public IPv4 still work. 596 tests pass total.
- Internal: TS mirror in `src/modules/public-api.ts` matched. The JS source got a small `isInternalWebhookUrl()` wrapper around `_isInternalHost` so the install-flow guard and the webhook guard share classification logic without duplication.

## [v3.6.0] — Update-check exponential backoff (Phase 6.1)

- Added: per-script exponential backoff in `UpdateSystem.checkForUpdates`. A network error or non-2xx response increments `script._updateFailureCount` and stamps `script._updateNextCheck = now + 2^(failures-1) * 1min`, capped at 24 hours. The auto-update path skips scripts whose cooldown hasn't elapsed; manual single-script checks (popup "Check for Update", dashboard force-update) bypass the cooldown so users see fresh failures immediately.
- Fixed: scripts with a permanently broken `updateURL` previously consumed bandwidth on every periodic alarm. The new backoff means a dead URL retries at most ~17 cooldowns/day instead of every check interval.
- Changed: a 304 Not Modified response now also clears the failure count + next-check timestamp (treating it as a successful conditional fetch). Previously 304 just `continue`'d without touching backoff state, so a script that returned 5xx once and then 304 forever would stay in a stale cooldown.
- Added: 4 tests pinning the backoff math (`_nextRetryAt`) — first-failure base interval, doubling progression, 24-hour cap, defensive zero-failures input. 589 tests pass.

The conditional `If-None-Match` / `If-Modified-Since` headers and 304 short-circuit were already implemented; this release adds the resilience layer around them so misbehaving update servers don't waste resources.

## [v3.5.0] — `@weight` injection priority (Phase 11.7)

- Added: `// @weight 1..999` directive (Userscripts/Safari standard). Higher = earlier within the same `@run-at`. Clamped to the documented range so an `@weight 99999` typo can't dominate the sort.
- Changed: `registerAllScripts` sort now uses `Math.max(meta.priority || 0, meta.weight || 0)` so authors who set both don't get surprised by the lower one winning. Existing `@priority` behavior preserved.
- Added: `GM_info.script.weight` and `GM_info.script.priority` so scripts can introspect their own injection ordering hints.
- Added: 5 parser tests covering valid range, clamp-above, clamp-below, default, non-numeric. 585 tests pass.
- Internal: TS mirrors in `src/types/script.ts` and `src/background/parser.ts` now declare the new field; the existing JS-test parser duplicate matched.

## [v3.4.0] — Run on This Tab via chrome.userScripts.execute() (Phase 11.4)

- Added: "Run on This Tab" entry in the popup script-action dropdown. Fires the script once on the active tab without registering it for future page loads — useful for quick-test workflows and for running scripts that aren't enabled or that don't match the current URL.
- Added: `runScriptNow` background message handler. Prefers `chrome.userScripts.execute()` (Chrome 135+) so the script runs in the same `USER_SCRIPT` world as a normal injection — `unsafeWindow` and the GM_* APIs behave identically. Falls back to `chrome.scripting.executeScript({ world: 'MAIN' })` on older Chrome (without GM_* APIs but the script body still runs).
- Internal: `runScriptNow` resolves `@require` dependencies via `fetchRequireScript` exactly like the context-menu run-once path so the one-shot run sees the same library set as a normal injection. Per-require fetch failures are non-fatal.

## [v3.3.0] — GM_notification: progress, buttons, update, close (Phase 11.11)

- Added: `GM_notification({ progress: 0..100 })` — shows a progress bar inside the notification (uses `chrome.notifications.type='progress'`). Useful for download or batch-job scripts.
- Added: `GM_notification({ buttons: [{title, iconUrl}, ...] })` — up to 2 action buttons (Chrome's hard cap; we silently truncate so the platform contract stays explicit). Click events fire the new `onbuttonclick` callback with `{ buttonClickIndex }` (ScriptCat semantics).
- Added: `GM_updateNotification(id, details)` — updates an existing notification by tag without closing it. Fields the caller doesn't pass are left untouched, so partial updates don't blank out the title/message.
- Added: `GM_closeNotification(id)` — programmatically dismisses a notification by tag.
- Added: `GM_notification(...)` now returns a control object `{ close(), update(patch) }` so authors don't have to track tags manually for the common case.
- Internal: new background-side message handlers `GM_updateNotification` and `GM_closeNotification` plus a `chrome.notifications.onButtonClicked` listener that routes button clicks back to the originating tab.
- Internal: `content.js` notification bridge now forwards `buttonIndex` so the wrapper can fire the right callback. Linter `KNOWN_GM_APIS` learned the two new function names.

## [v3.2.1] — @unwrap metadata tag (Phase 11.2)

- Added: `// @unwrap` directive support (Violentmonkey parity). When present, the wrapper builder emits the user code verbatim without the GM API IIFE — useful for ESM-style top-level imports/exports and scripts that intentionally modify the top-level scope. A one-line `console.warn` banner is prepended so authors who set `@unwrap` by mistake can spot it. GM_* APIs are unavailable in this mode.
- Added: install confirmation dialog now displays `unwrapped (no GM_* APIs)` in the run-timing summary so users know what they're agreeing to before installing an `@unwrap`'d script.
- Internal: TS mirror in `src/background/wrapper-builder.ts` updated to match (and now also honours `meta.delay`, which the JS source already did).

## [v3.2.0] — GM_xmlhttpRequest noCache/redirect + GM_info platform parity (Phase 11)

- Added: `GM_xmlhttpRequest({ noCache: true })` (and Tampermonkey's lowercase `nocache` alias) — sets `Cache-Control: no-cache` + `Pragma: no-cache` on the request, but only if the caller didn't already set them (case-insensitive). Closes Violentmonkey issue #2168 / Tampermonkey changelog parity.
- Added: `GM_xmlhttpRequest({ redirect: 'follow' | 'error' | 'manual' })` — forwarded directly to `RequestInit.redirect` so scripts can detect or block redirects. Invalid values are silently dropped (no breakage on typos like `redirect: true`). Closes VM #2359.
- Refactored: extracted the fetch-options translation into `XhrManager.buildFetchOptions(data)` (in `modules/xhr.js` + the TS mirror at `src/modules/xhr.ts`) so the noCache/redirect/credentials rules are unit-testable in isolation. The background `GM_xmlhttpRequest` handler now consumes this helper.
- Added: 9 new tests for `XhrManager.buildFetchOptions` covering case-insensitive Cache-Control/Pragma overrides, valid/invalid redirect values, anonymous credentials, and method default. 580 tests pass across 33 files.
- Added: `GM_info.userAgent`, `GM_info.userAgentData` (clone of `navigator.userAgentData` brands/platform/mobile), and `GM_info.platform.fullVersionList` + `GM_info.platform.mobile` — Phase 11.1 GM_info enrichment for parity with Violentmonkey.
- Hardened: `GM_info.platform.browserName` / `browserVersion` now prefer `navigator.userAgentData.brands` over the legacy `navigator.userAgent` regex, with the regex retained as a fallback for older Chrome.

## [v3.1.0] — MatchSet precompiled URL lookup + tests target production code

- Added: `MatchSet` precompiled host index (`background.core.js` + `src/background/url-matcher.ts`). Builds an `O(1)` hostname → script bucket so `getScriptsForUrl` no longer linear-scans every script's pattern list. Wildcard subdomains (`*.example.com`) are indexed under their base domain and resolved via parent-suffix walk so deep subdomains (`a.b.example.com`) still hit the bucket. Regex `@include` and patterns without a host hint fall into a universal bucket so the candidate set remains a strict superset of the true match set. Phase 4.2 of the roadmap.
- Changed: `chrome.runtime.onMessage` `getScriptsForUrl` handler now uses `MatchSet.getMatching()` instead of filtering all scripts. Cache invalidates automatically on every `ScriptStorage.set`/`delete`/`clear` via the new `invalidateMatchSet()` global hook.
- Changed: `tests/url-matcher.test.js` now imports directly from `src/background/url-matcher.ts` instead of duplicating ~190 lines of matcher logic. The previous duplicate could (and did) drift away from the real implementation; tests now test what ships.
- Added: 21 new tests covering `MatchSet` (host indexing, wildcard subdomains, universal candidates, port stripping, dedup) and `isUrlBlockedByGlobalSettings` (denied-host suffix-coincidence guard, whitelist/blacklist modes). 571 tests pass.
- Hardened: a `ReDoS` regression test in `matchIncludePattern` proves the `*+ → *` collapse keeps a 80-wildcard pathological pattern under 500 ms (without the collapse it spins for seconds).
- Internal: TS mirror in `src/modules/storage.ts` exports `setScriptChangeListener()` so future TS migration of `background.core.js` can wire the same invalidation pattern without a global.

## [v3.0.2] — Persistent runtime state + smarter wake-time registration

- Added: `SessionState` helper persists `_notifCallbacks`, `_openTabTrackers`, and `_audioWatchedTabs` to `chrome.storage.session` on every mutation, and rehydrates on `init()`. GM_notification onclick/ondone, GM_openInTab onclose, and GM_audio_watchState callbacks now survive service-worker termination instead of silently dropping after the SW idles out.
- Changed: `registerAllScripts` diff-on-wake now also unregisters stale scripts (registered but no longer enabled / no longer in storage). Previously the diff only filled in missing scripts, so deleted/disabled scripts could remain injected until the next forced re-registration.
- Hardened: `chrome.tabs.onRemoved`, `chrome.notifications.onClicked`, and `chrome.notifications.onClosed` now await `ensureInitialized()` before reading hydrated state, eliminating the race where a tab close event firing during SW wake would see an empty tracker map.

## [v3.0.1] — Service worker cold-start guard

- Fixed: `init()`'s promise is now stored on `self._initPromise` so the cold-start guard inside `handleMessage` actually awaits it. Previously the guard was a dormant `if (self._initPromise)` check that never matched because `init()` was called bare. Result: messages arriving during SW wake (popup/dashboard opens, badge update races) would hit handlers before `ScriptStorage` / `SettingsManager` had loaded.
- Added: `ensureInitialized()` helper memoising the init promise; wired into `chrome.runtime.onMessage`, `chrome.runtime.onUserScriptMessage`, `chrome.alarms.onAlarm`, `chrome.commands.onCommand`, `chrome.tabs.onActivated`, and `chrome.tabs.onUpdated` so every wake-triggering event waits for init.
- Changed: `_debouncedStatsSave()` now uses `chrome.alarms.create('statsSave', { delayInMinutes: 0.1 })` instead of `setTimeout(5000)` so the debounce survives SW termination. Stats writes that previously vanished when the SW was killed mid-debounce now coalesce into the next alarm fire.
- Internal: `chrome.alarms.onAlarm` handler routes the new `statsSave` alarm to `ScriptStorage.save()`.

## [v3.0.0] — IndexedDB storage rewrite

**BREAKING:** Major version bump. Storage backend migrated from `chrome.storage.local` (single 10 MB blob) to IndexedDB. Userscripts, GM-values, stats, and backups now live in object stores with per-record reads/writes and transactional safety. Settings and folder index stay in `chrome.storage.local`.

- New: `src/storage/` module — `idb.ts` (low-level wrapper), `transaction.ts` (multi-store helper), `script-db.ts` (schema + DAOs for scripts/values/stats/backups), `migration-v3.ts` (one-shot v2→v3 copy with 30-day legacy tombstone).
- Migration: First v3 boot reads the legacy `userscripts` blob and `values_*` keys, copies them into IDB, stamps `_storageSchema=3`, and leaves the legacy keys in place for 30 days as a downgrade safety net. After TTL the legacy keys are wiped on next boot.
- Refactored: `ScriptStorage` and `ScriptValues` (`src/modules/storage.ts`) now route through the IDB DAOs while keeping their public method surface identical — callers don't change.
- Refactored: `PublicAPI.installScript` (both extension-message and URL-install paths) and `PublicAPI.toggleScript` now persist through `ScriptStorage.set()` instead of writing the legacy `userscripts` blob directly. The legacy fallback in `toggleScript` was dropped — post-migration the IDB store is authoritative.
- Hardened: IDB connection caching tracks the active `IDBFactory` so test runners (and any future SW context that swaps factories) get a fresh connection automatically.
- Internal: `withTransaction()` waits for `oncomplete` before resolving so callers see fully-committed state on resolve, not just queued writes.
- Tests: 550 passing. Added IDB-aware rollback tests via `vi.spyOn(ScriptsDAO, 'delete')` and `vi.spyOn(ValuesDAO, 'setAll')`. `fake-indexeddb` wired into the vitest setup with a per-test `IDBFactory` reset.

## [v2.3.4]

- Fixed: Two inline `<script>` blocks violated the `extension_pages` CSP (`script-src 'self'`). `pages/dashboard.html` had a 75-line view-settings controller (zoom + density) and `pages/devtools.html` had a 9-line panel registration call — both blocked at load time, leaving the dashboard's zoom/density toolbar inert and the DevTools panel un-registered. Extracted to `pages/dashboard-viewsettings.js` and `pages/devtools.js`. The remaining inline script in `pages/editor-sandbox.html` is the Monaco bootstrap and is allowed by the sandbox CSP (`'unsafe-inline'`).
- Chore: Moved self-distribution signing keys (`scriptvault.pem`, `scriptvault-selfhost.pem`) out of the repo root to `~/.scriptvault-keys/`. Chrome's "Load unpacked" warned `This extension includes the key file ... You probably don't want to do that` because anything inside the extension dir gets bundled at build/install time. `pack-crx.mjs` already takes the key path as a positional CLI arg, so callers just pass `~/.scriptvault-keys/scriptvault-selfhost.pem` now. Both keys remain gitignored.

## [v2.3.3]

- Fixed: Setup-required warning banner stuck in the popup after the user enabled the "Allow User Scripts" toggle in `chrome://extensions`. `getExtensionStatus` was AND-ing a cached `settings._userScriptsAvailable` flag with the live `chrome.userScripts` check, so once the cache was `false` it dominated even when the API became available; nothing in the request path flipped the cache back. The handler now ignores the cache, probes the API live (presence + a `getScripts()` call to catch the post-138 "Allow User Scripts" gate), refreshes the cache to whatever the live probe returned, and runs `configureUserScriptsWorld()` opportunistically so registrations work on next save without forcing an SW reload. Symptom is now self-healing: enabling the toggle and reopening the popup clears the banner immediately.

## [v2.3.2]

- Fixed: `background.core.js` `parseCronToMinutes()` JSDoc block contained `"*/n * * * *"` — the `*/` inside the string literal terminated the block comment early, so the rest of the doc text was parsed as code. After esbuild concatenation this became a hard `SyntaxError: Unexpected token '*'` at line 14298 of `background.js`, which prevented the service worker from booting. Symptom in the field: opening the popup did nothing — Find New Scripts, Create New Script, Dashboard, Utilities, and the per-script toggles were all dead, because `chrome.runtime.sendMessage` had no live receiver and `popup.js init()` blocked on the un-timed-out `loadAllScripts()` await before `setupEventListeners()` could attach handlers. Replaced the JSDoc with line comments and rephrased the description so it never contains `*/`. Rebuilt `background.js`.

## [v2.3.1]

- Fixed: `manifest.json` referenced `icons/16.png` / `icons/32.png` / `icons/48.png` / `icons/128.png`, but the `icons/` directory was deleted in v2.3.0's branding cleanup — extensions failed to load with `Could not load icon 'icons/16.png' specified in 'icons'`. Repointed manifest, `pages/popup.html`, `modules/public-api.js`, `modules/backup-scheduler.js`, and the TypeScript mirror at `src/modules/public-api.ts` to the surviving `images/icon{16,32,48,128}.png` files. Firefox manifest was already correct.

## [v2.3.0]

- Fixed: Weekly-digest alarm (`scriptvault-weekly-digest`) was never dispatched — `chrome.alarms.onAlarm` in `background.core.js` only routed `autoUpdate`, `autoSync`, and a handful of internal names, so `NotificationSystem.handleAlarm()` was unreachable and users who enabled digest notifications got nothing. The listener now delegates unknown alarms to `NotificationSystem.handleAlarm()` first.
- Fixed: `ScriptSigning.verifyScript()` trust-store lookup used bare `trustedKeys[signatureInfo.publicKey]`, so a malicious signed script whose publicKey collided with an inherited `Object.prototype` property (e.g. `toString`, `hasOwnProperty`, `valueOf`) would resolve to the inherited function and be reported as `trusted: true`. Replaced with `Object.hasOwn()` guard in both `bg/signing.js` and the TypeScript mirror at `src/bg/signing.ts`. Two regression tests added.
- Fixed: `ScriptValues.set()` / `delete()` / `setAll()` / `deleteMultiple()` mutated the in-memory cache before awaiting persistence, with no rollback on failure. If `chrome.storage.local.set` threw (quota exceeded, transient error), callers saw the new value in-memory but storage kept the old — and a bogus change notification fired for the write that never landed. All four methods now snapshot prior state, defer notifications until after the successful write, and roll back the cache + rethrow on persist failure. Five regression tests added in `tests/storage.test.js`.
- Fixed: `ScriptStorage.clear()` had no rollback on `chrome.storage.local.set` failure — cache was wiped in-memory while storage kept the old data, drifting until SW restart. Added try/catch rollback matching the pattern used by `set()`.
- Fixed: `FolderStorage.update()` had no rollback on save failure and used `Object.assign` over the whole folder; if save threw, the folder retained partial updates. Now snapshots only the mutated fields so rollback doesn't clobber concurrent writes to unrelated properties. Regression test added.
- Hardened: `GM_addElement` attribute setter (background.core.js) now applies the same sanitization to the `attrs` object path that the `innerHTML` path already enforces — drops `on*` event handlers and rejects `javascript:` / `vbscript:` URLs regardless of attribute name (href, src, xlink:href, formaction, poster, etc.). Previously the `innerHTML` branch was sanitized but `el.setAttribute('onclick', ...)` via attrs was a free XSS for any userscript that called `GM_addElement`.
- Hardened: `pages/install.js` `renderInstallUI()` now returns early with a user-visible error if `#content` or `#install-type-badge` is missing, instead of crashing on `badge.innerHTML =` and leaving the page blank with no feedback.
- Hardened: `pages/sidepanel.js` `openInEditor()` and the dashboard-open button handlers now `.catch()` the `chrome.runtime.sendMessage()` promise — prevents `Unchecked runtime.lastError` console spam when the background service worker is in the process of waking.
- Fixed: `requireCache` in-memory Map is now capped at 500 entries (LRU eviction) to prevent unbounded service worker memory growth
- Fixed: `QuotaManager.getBreakdown()` now uses `TextEncoder` for accurate UTF-8 byte counts instead of JS string `.length` (affects non-ASCII script content)
- Fixed: `npm-resolve.js` `getPackageInfo()` wraps `JSON.parse` in try/catch — malformed npm registry responses no longer crash the resolver
- Fixed: `verifySRI()` now logs a `console.warn` for unverifiable MD5 hashes and unexpected SubtleCrypto errors instead of failing silently
- Fixed: `backup-scheduler.js` backup IDs now use `crypto.randomUUID()` for collision-proof uniqueness
- Fixed: `sidepanel.js` `$()` helper now returns `null` for missing elements; callers updated with proper null guards (previously returned detached `<div>`, masking missing-element bugs)
- Chore: Updated stale `v2.0.0` version comments in `pages/install.js`, `modules/migration.js`
- Chore: Updated `Migration.CURRENT_VERSION` to `2.3.0` so future migration steps target the right version range

## [v2.2.0]

- Fixed: `GM_addValueChangeListener` `remote` flag — listener callbacks in the tab that called `GM_setValue`/`GM_deleteValue` now correctly receive `remote: false`; all other tabs receive `remote: true` (Tampermonkey spec compliance)
- Fixed: ZIP import in popup used O(n²) string-concatenation `btoa` encoding — replaced with chunked 8 KB approach (matches the dashboard implementation)
- Chore: Removed dead 4th argument from three `showPopupEmptyState()` call sites in popup.js
- Chore: Updated stale `v2.0.0` version comments in popup.js and dashboard.js

## [v2.1.9]

- Added: `@crontab` metadata directive — schedule script execution via cron expressions (`*/5 * * * *`, `0 * * * *`, `0 0 * * *`, etc.)
- Added: `GM_info.injectInto` property — reports the script's `@inject-into` value
- Added: `$DATETIME$` template variable — auto-populates with today's ISO date when creating scripts from templates
- Added: F8 / Shift+F8 Monaco editor keybindings for linter error navigation (next/previous marker)
- Fixed: `GM_xmlhttpRequest` body serialization — `Blob`, `File`, `FormData`, and `URLSearchParams` now correctly cross the extension messaging boundary
- Fixed: `setupAlarms()` missing `SettingsManager.get()` call (was referencing undefined `settings`)

## [v2.1.8] - %Y->- (HEAD -> main, origin/main, origin/HEAD)

- Added: Add Firefox port roadmap + session log scaffolding
- v2.1.7: Fix massive editor text (fontSize percentage treated as pixels)
- v2.1.6: Fix blank Monaco editor when opening a script to edit
- v2.1.5: Center dashboard toast container at bottom
- v2.1.4: Dashboard debloat pass + light theme readability fix
- v2.1.3: Drop provenance origin badges from dashboard script rows
- v2.1.2: Fix dashboard column header rendering in middle of data rows
- v2.1.1: Fix Monaco editor never loading (sandbox CSP missing unsafe-eval)
- v2.1.0: Strip popup search, filters, and script row chrome (-613 lines)
- v2.0.9: Debloat toolbar popup (-629 lines)
