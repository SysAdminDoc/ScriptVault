# Changelog

All notable changes to ScriptVault will be documented in this file.

## [v3.18.0] — Release hardening audit (2026-07-09)

- **Encrypted manual cloud sync transfers.** Manual Easy Cloud export/import now
  uses the same encrypted sync envelope helpers as scheduled sync, and imports
  mark encryption established after a valid encrypted envelope is read.
- **Public API page transport is reachable through the content-script bridge.**
  Trusted web-page and Local MCP messages are relayed to the background Public
  API handler with origin/token checks, while response echoes are ignored to
  avoid message loops.
- **Bounded network/runtime state.** GM_xmlhttpRequest now caps active requests
  globally and per script; the TypeScript resource-loader mirror caps the
  in-memory @require cache like the runtime worker.
- **Release packaging and smoke tests are stricter.** Chrome Web Store publish
  packaging uses explicit assets instead of copying all of `lib/`, Firefox
  smoke tests refuse stale ZIPs, and installed Firefox package version is
  checked against `package.json`.
- **Browser support evidence is failure-aware.** The generated support matrix
  now distinguishes failed, stale, unreadable, missing, and passed Edge sideload
  smoke evidence instead of flattening every non-passing artifact to "no current
  evidence."
- **Dashboard reliability polish.** Collection deletes use the dashboard modal
  confirmation flow, repeated command-palette opens refocus the existing modal,
  sidepanel launch buttons fall back cleanly, DevTools filtered clear preserves
  captured data, and large inline diffs switch by matrix size instead of line
  count.
- **Smoke cleanup is harder to wedge.** Dashboard/editor/browser capture smokes
  now share crash-aware cleanup helpers so interrupted launches do not leave
  browser processes or temp profiles behind, and the Edge sideload smoke now
  has a top-level timeout with temporary-profile process cleanup.

## [v3.17.0] — Trust enforcement, sync data-safety, and backup slimming (2026-07-02)

### Added
- **Sync can hold userscript execution until first sync completes.** A new
  opt-in sync setting prevents userscript registration on fresh devices until
  the first successful sync, then releases automatically; a 90 second timeout
  warns and falls back to normal registration.
- **Bound local files can auto-refresh through File System Observer.** Browsers
  with `FileSystemObserver` watch granted local file handles, debounce external
  edits, and route them through the existing review/apply gate; unsupported
  browsers keep the manual Refresh File flow.
- **Local MCP bridge prototype is guarded in Trust Center.** The bridge is
  disabled by default, accepts only configured loopback origins with a bearer
  token, and limits the first capability set to script list/read/write actions.
- **`@crontab once(...)` schedules now fire one time.** One-time crontab
  metadata schedules the next matching alarm, records a local fired marker, and
  refuses to re-arm that same expression after it runs.
- **Local-folder sync can round-trip scripts and GM values through a selected
  browser folder.** The dashboard stores a File System Access directory handle,
  writes `scriptvault-backup.json`, and reuses the existing 3-way sync merge and
  preview engine.
- **Per-script isolated cookie jars can be enabled with `@isolationCookie`.**
  Opted-in scripts use a deterministic CHIPS partition for `GM_cookie`,
  `GM_xmlhttpRequest`, and `GM_download` cookie routing unless they pass an
  explicit partition.
- **GM.fetch now streams through a Fetch-shaped response.** Granted scripts can
  read `res.body.getReader()` chunks under the existing `@connect` and
  internal-host guards, with a buffered XHR fallback where streaming is absent.
- **On-device AI assistance is opt-in and local-only.** Settings now gate Chrome
  Prompt API install summaries plus editor Explain/Draft buttons, with all model
  prompts routed through the background and no remote AI transport path.

### Fixed
- **Dashboard view switches now use reduced-motion-safe same-document View Transitions.**
  Script-list/editor entry and dashboard/editor tab switches fade the active
  work surface when supported, fall back instantly under reduced motion or
  unsupported browsers, and keep editor smoke hit-testing aligned with the live
  DOM after the entry transition settles.
- **Firefox sideload smoke now waits out the What's New overlay.** The harness
  watches the asynchronous dashboard overlay before clicking setup controls, so
  Firefox permission smoke checks are no longer blocked by the release notes
  dialog.
- **Firefox packaging now guards against forced container identity enablement.**
  The Firefox manifest and generated package tests forbid `contextualIdentities`,
  and the sideload smoke verifies `privacy.userContext.enabled` stays false in a
  fresh profile after ScriptVault installs.
- **Snippet insertion now preserves placeholder navigation.** Custom snippets
  can use `$1`, `$2`, `${1:name}`, `$0`, and `$CURSOR$` markers; inserted
  snippets select the first placeholder, move through later fields, adjust after
  edited placeholder text, and land on the final cursor marker.
- **Dynamic dashboard controls are easier to operate with assistive tech.**
  Card-view action menus now expose menuitem roles and arrow-key navigation,
  while script-chain cards and pipeline steps use labeled lists, action groups,
  and native move up/down buttons alongside drag-and-drop.
- **Cookie-routed GM network requests no longer risk DNR header clobbering.**
  `GM_xmlhttpRequest` and `GM_download` cookie-routing rules now run
  concurrently for different URLs while serializing exact same-URL requests
  so overlapping Cookie header rules cannot affect each other.
- **Remote result descriptions now use native HTML sanitization when
  available.** Find Scripts and cdnjs library descriptions render through
  `Element.setHTML()` on supporting browsers, with the previous escaped
  fragment path kept as the fallback.
- **Advanced Linter fix previews now collapse unchanged hunks.** The preview
  keeps nearby context, renders gap separators, and Fix All continues past five
  mutations while re-linting after each applied fix.
- **External Public API installs now enter review safely.** External and trusted
  web-page install requests store scripts disabled with import-quarantine
  metadata and no longer fill missing `@match` directives with universal access.
- **SRI require enforcement is aligned across source copies.** The
  `resource-loader` extraction target now reads the Security SRI setting like
  the live background path, while install/update trust-receipt probes remain
  allowed to inspect unpinned dependencies for review.
- **SRI Require now reports blocked unpinned dependencies clearly.** Unpinned
  remote `@require` dependencies blocked by Require mode store a distinct
  `blocked: unpinned @require under SRI Require` failure instead of the generic
  `empty response` message.
- **Update extraction applies script updates serially.** The `update-checker`
  source module now mirrors the live per-script update lock so concurrent update
  applications preserve intermediate version history.
- **Popup site restriction preserves custom match lists.** "Only on This Site"
  now appends the current host pattern to existing user `@match` overrides
  instead of replacing curated per-script scope lists.
- **Ported match patterns no longer break native registration.** Existing
  port-specific `@match` entries register with portless Chrome patterns plus an
  exact runtime URL guard, while the dashboard rejects new ported match inputs.
- **Scheduler modals no longer close over a freshly reopened dialog.** The close
  timeout now captures the closing overlay and only clears scheduler modal state
  for that same element.
- **Scheduler alarm sync now preserves interval phase.** Opening the dashboard
  no longer clears and recreates unchanged `sv_sched_*` alarms, and date-range
  previews format date inputs as local calendar days.
- **Pattern Builder previews now use Chrome-style match semantics.** Wildcard
  subdomain badges match bare hosts correctly, long patterns warn instead of
  truncating mid-segment, and URL parse failures show an explicit toast.
- **CSP report cleanup and bypass toggles now fail safely.** Clear All offers an
  undo action, and bypass switches only persist ON after the DNR rule update
  succeeds.
- **Built-in collection installs now survive dashboard reloads.** Script links
  installed from curated packs persist in a dedicated local map so built-in
  rows render as installed instead of re-offering Install.
- **Chain execution logs now render only in the matching chain editor.** Running
  one chain no longer appends output into a different chain's open log panel.
- **Script sharing batch export no longer clobbers duplicate names.** ZIP
  entries now get deterministic `-2` suffixes after sanitization, and oversized
  email shares copy concise instructions instead of opening a broken mailto URL.
- **Activity heatmap stats now match rendered activity.** Error-only days count
  toward streaks, repeated init reuses one tooltip, and script filters can show
  readable script names.
- **Gist token setup now defaults new PATs to session-only storage.**
  Fine-grained tokens are accepted without a false missing-scope warning when
  GitHub omits the classic OAuth scope header.
- **Template card icons no longer render raw HTML entities.** Built-in template
  icons now use runtime Unicode values, while saved/imported legacy entity icons
  migrate once and remain escaped in card markup.
- **Sandboxed editor Escape and cursor restore now respect Monaco state.** Escape
  no longer closes the editor while find/suggest/rename widgets are active, and
  cursor position restores only for the same script id.
- **Monaco editor tabs now preserve undo stacks across tab switches.** The
  sandbox keeps one Monaco model per open script and swaps models instead of
  resetting the active model value on every editor-tab activation.
- **JSON vault exports now round-trip stored values, folders, and workspaces.**
  JSON export/import uses the existing transfer options to preserve GM values
  plus vault organization state instead of behaving like a scripts-only dump.
- **v3 storage migration retries no longer clobber newer GM values.** Legacy
  `values_*` bags now skip any value keys already present in IndexedDB when the
  migration is retried before the schema marker is stamped.
- **Backup blob storage now cleans up unreferenced IndexedDB records.** Startup
  migration sweeps blobs missing from the `autoBackups` list, and failed
  metadata writes delete the newly stored blob before returning an error.
- **Install review is no longer exposed as a web-accessible resource.** Chrome
  and Firefox manifests now open `pages/install.html` only through extension
  navigation instead of a broad `<all_urls>` WAR match.
- **Chain URL, schedule, DOM event, and after-script triggers now execute.** The
  dashboard exposes trigger-specific inputs, saves refresh background alarms and
  content listeners, and the background runs matching chains through the
  `runScriptNow` path.
- **Large script bodies now store compressed in IndexedDB.** Script records over
  the storage threshold use gzip with per-record metadata, while reads still
  return plain `script.code` and existing raw rows remain compatible.
- **Install provenance review now binds declarations to explicit dependency
  URLs.** Interleaved `@require-provenance` and `@require-identity` directives
  map to the matching `@require` URL before legacy index fallback is considered.
- **Dashboard script reorder is keyboard-accessible and respects filtered views.**
  Script rows now expose Move up/down controls, and drag or button reorders are
  persisted from the visible table order instead of the unsorted backing array.
- **Dashboard fallback and generated UI snippets now follow the active theme.**
  The Monaco fallback textarea, snippet modal/toast/floating-panel helpers, and
  template download controls no longer force dark backgrounds in light mode.
- **GM_webRequest dynamic-rule IDs no longer depend on scriptId hashes.**
  New rules use a monotonic DNR ID pool seeded from persisted and live rule
  ownership, preventing colliding scripts from overwriting each other's ranges.
- **Popup and install review dynamic text now routes through runtime i18n.**
  Popup toasts, script action labels, site-lock feedback, install review
  sections, terminal states, dependency/provenance checks, and local AI review
  copy now use shared translation keys with safe English fallbacks.
- **Dashboard now has a premium workbench shell.** The scripts view adds a
  persistent navigation rail, refined command surfaces, a responsive
  table-and-inspector layout, and selection-aware trust/access details.
- **Dashboard mockup parity is tighter.** The scripts workbench now carries the
  premium rail, command bar, update queue, inspector metadata, and fixed status
  bar through the live dashboard and visual regression fixture.
- **Chrome host permissions are now scoped and optional.** The Chrome manifest
  uses optional HTTP(S) host grants, install review requests per-script run,
  dependency, update, and `@connect` origins from the install click, and
  universal host rules require explicit broad-access approval.
- **Light-theme status labels now keep readable contrast.** Dirty/error editor
  save states, Trash eyebrow text, info tags, and script health badges now have
  light-mode-specific ink and border colors instead of dark-surface literals.
- **Open editor tabs are reachable inside the full-screen editor.** The editor
  nav mirrors open script tabs with active and unsaved state so multi-tab users
  can switch scripts without leaving the overlay.
- **Install page startup now fails visibly instead of blanking.** Theme settings
  load failures fall back to dark mode, top-level init errors render the install
  error screen, missing-UI install errors are inserted into the page, and version
  comparison handles non-string metadata safely.
- **Side panel settings startup now degrades visibly.** A failed settings fetch
  falls back to default settings and shows an inline error notice, while fatal
  init failures surface through the existing restart/error affordances.
- **Popup run diagnostics now sort nameless scripts safely.** Diagnostics rows
  use the script ID fallback before `localeCompare`, matching the renderer and
  avoiding a misleading background-service error.
- **Non-dashboard surfaces now share theme-aware overlays.** Popup, side panel,
  install, and DevTools inline styles use shared overlay tokens plus current
  theme accent/info colors instead of dark-theme white/green/blue literals.
- **Import and error toasts are less noisy and more specific.** Multi-file imports
  now produce one aggregate result toast with shared Undo, and generic
  Failed/Deleted/Empty messages in nearby flows now name the action or input.
- **Editor panel failures no longer leave stale values visible.** GM storage
  load failures now replace the value list with an inline error, and autosave
  buffers flush when switching away from a dirty editor tab.
- **Optimistic dashboard actions now reconcile with backend failures.** Pin
  changes revert and show the backend error when settings persistence fails, and
  Duplicate saves dirty editor content before duplicating the source script.
- **Update checks no longer report failures as up to date.** The noninteractive
  update path now handles `{ error }` and malformed responses before the empty
  result branch, and surfaces update-apply failures.
- **Single-script deletes now use Trash-aware copy and recovery affordances.**
  Row, card, and editor deletes no longer claim Trash-enabled deletes are
  irreversible, and successful moves to Trash include an Open Trash action.
- **Dropped ZIP imports now match the import button safety path.** Dropping a ZIP
  prompts before overwriting matching scripts, records the archive source label,
  and exposes Undo when the background returns a restore receipt.
- **Script list load failures no longer look like an empty vault.** Dashboard
  startup now records `getScripts` failures, shows a retryable "Scripts
  unavailable" empty state, and toasts the background error.
- **Plain userscript file imports now show background rejection errors.**
  Importing a `.user.js` that fails validation, quota, or metadata checks now
  reports the filename and background error instead of silently continuing.
- **Autosave follows the latest Settings toggle.** The persistent editor change
  handler now reads `state.settings.autoSave` at edit time, so restore/import/sync
  reloads that replace the settings object no longer freeze autosave on or off.
- **Editor tabs recover when scripts vanish during reloads.** Backup restore,
  rollback, sync, and bulk import reloads now prune stale editor tabs and warn
  instead of leaving dead tabs in the editor overlay.
- **Stacked dashboard modals no longer leak focus traps.** Replacing content in
  an already-open modal shell now keeps the original trap and focus target
  instead of pushing another keydown handler.
- **Gamification streaks use local calendar days consistently.** Yesterday is
  now computed from local date components instead of UTC midnight math, so daily
  streaks do not reset for users west of UTC.
- **Dashboard inline status colors use defined theme tokens.** Sync health,
  cloud status, and Greasy Fork preflight errors now use
  `--accent-primary`/`--accent-error` instead of undefined aliases.
- **Monaco word-wrap toolbar state is accurate.** The adapter now tracks
  CodeMirror-compatible editor options locally, so word-wrap toggles and active
  indicators reflect the current Monaco setting.
- **Monaco Find and Replace toolbar actions now reach the editor.** The Monaco
  adapter forwards raw action IDs through `execCommand` while preserving the
  CodeMirror command aliases used by existing editor wiring.
- **Collection share links can be imported directly.** Collection import now
  accepts the `data:application/json;base64,...` links produced by Share and
  decodes them before manifest validation.
- **Gist import and sync no longer use truncated script content.** When GitHub
  marks a `.user.js` Gist file as truncated, import and linked sync now fetch
  the file's `raw_url` before parsing or updating local script code.
- **Chain editor step edits survive row rebuilds.** Script selections and delay
  edits now sync into the in-memory step model before Add, Remove, drag reorder,
  or Save rebuilds the pipeline rows.
- **ZIP storage imports sanitize GM value maps.** Imported `.storage.json`
  payloads now accept only object-shaped value maps and strip `__proto__`,
  `constructor`, and `prototype` before writing GM values.
- **Settings reset now participates in the serialized settings write chain.**
  `SettingsManager.reset()` queues behind in-flight `set()` calls and rolls
  back through the same chain, preventing a delayed write from resurrecting
  pre-reset settings after factory reset.
- **Encrypted cloud backups preserve the extension version string.** Sync
  encryption normalization now keeps non-empty string envelope versions, so
  E2EE cloud-backup payloads retain manifest-style versions like `3.17.0`
  instead of being rewritten to sync envelope version `1`.
- **Cloud backup remote object routing no longer masquerades as a setting.**
  Providers now accept an explicit per-call `objectName` for upload/download,
  cloud backup uses that option for `scriptvault-cloud-backup.json`, the stale
  `syncFilename` pseudo-setting is gone, and S3 path-style URL selection no
  longer carries an always-false branch.
- **Storage Bucket script deletes and clears preserve the recoverable side on
  cleanup failure.** Bucketed script deletion and bulk clears now remove
  script/stat/binding rows before best-effort GM value cleanup, so a
  values-bucket failure can leave orphaned values but no longer leaves
  surviving scripts with their values lost.
- **Sync tombstone cleanup now waits for deletion propagation.** Quota cleanup
  prunes aged tombstones only after their deletion timestamp is older than the
  last successful sync, so rarely synced devices cannot resurrect deleted
  scripts after another device performs storage cleanup.
- **DevTools HAR exports preserve response MIME types case-insensitively.**
  The network export now reads `Content-Type`, `content-type`, and equivalent
  header casing before falling back to `text/plain`.
- **Sandboxed Monaco language workers now start without origin errors.** The
  editor sandbox supplies same-origin blob bootstrap workers that import the
  packaged Monaco worker files, and the editor smoke now fails if those worker
  construction errors return.
- **Script storage reads no longer expose live cache records.** `ScriptStorage`
  now clones script records at init, read, search, namespace, and set
  boundaries, and reorder persists cloned updates before touching cache, so
  caller-side mutations cannot leave cache serving unpersisted script state
  after a failed write.
- **EasyCloud sync now runs through one sync engine at a time.** Cloud Sync now
  delegates `syncProvider='easycloud'` to EasyCloud's native sync path instead
  of calling its provider `download()` and `upload()` shims, and both engines
  share a runtime sync lock so scheduled EasyCloud work cannot overlap a
  provider-backed Cloud Sync write.
- **Cloud sync uploads use remote write preconditions.** WebDAV, Google Drive,
  Dropbox, OneDrive, and S3 uploads now carry provider validators
  (`If-Match`/`If-None-Match`, Dropbox rev update/add modes, or signed S3
  conditions) so simultaneous devices cannot silently overwrite a newer remote
  sync envelope.
- **Sync timeouts now cancel provider I/O.** WebDAV, Google Drive, Dropbox,
  OneDrive, and S3 sync upload/download paths now honor the Cloud Sync abort
  signal, and Cloud Sync re-checks the signal before locked local writes so a
  timed-out sync cannot keep mutating storage after `_syncInProgress` clears.
- **Sync apply loops share the per-script operation lock.** Cloud Sync and Easy
  Cloud now acquire the same per-script lock used by save/toggle/delete before
  applying remote script writes or sync tombstone deletes, preventing a sync
  merge computed from stale state from overwriting a concurrent editor change.
- **Easy Cloud sync now reacts to real script changes.** Core script save,
  create, update, delete, restore, toggle, import, duplicate, rollback, and
  per-script settings paths now notify Easy Cloud after successful persistence,
  so debounced sync and the offline queue are driven from IndexedDB-backed
  mutations instead of the obsolete `userscripts` storage key.
- **Easy Cloud establishes the E2EE downgrade latch.** Easy Cloud now marks
  sync encryption as established after successfully reading or uploading an
  encrypted envelope, matching Cloud Sync's plaintext-downgrade protection.
- **Cloud sync preserves newer local GM value bundles.** When remote value
  bundles are skipped because local values already exist, upload now keeps a
  non-empty local bundle if its `lastValueUpdatedAt` is newer than the remote
  bundle instead of pinning the cloud copy to stale remote values.
- **Update confirmation View diff now stays open.** The update confirmation
  loop now waits for the version diff modal to close before re-asking whether
  to install, so the diff view is no longer overwritten in the same tick.
- **Sync no longer lets metadata-only changes overwrite one-sided code edits.**
  Cloud Sync and Easy Cloud now compare each side against the recorded
  `syncBaseCode` before falling back to timestamp freshness, so a newer toggle,
  position, or settings-only change on one device cannot revert the only code
  edit from another device.
- **Easy Cloud sync received the merge fixes.** The Easy Cloud provider now has
  the same protections as the WebDAV/Drive/etc. sync path: a restored-from-trash
  script newer than its tombstone is no longer re-deleted, clean 3-way merges
  are no longer discarded when the local timestamp wins, the 3-way base uses the
  local device's ancestor (not the remote's), and tombstone removals persist
  locally instead of only tombstone additions.
- **Cloud backup no longer clobbers the sync envelope.** The scheduled cloud
  backup and cloud sync both wrote to `scriptvault-backup.json`, so each
  overwrote the other and the next sync download read a backup envelope (and,
  under E2EE, hard-failed on the plaintext). Cloud backups now upload to a
  distinct `scriptvault-cloud-backup.json` on every provider, and the backup
  envelope is encrypted with the sync passphrase when E2EE is enabled so it
  can't leak plaintext script code/GM values to the cloud.
- **SettingsManager.set lost-update race.** Concurrent settings writes (e.g. a
  sync-end `lastSync` write racing an OAuth-token persist or a dashboard save)
  each snapshotted the cache at call time and then awaited storage, so the
  second write silently erased the first — capable of dropping a freshly
  refreshed OAuth token. Writes are now serialized through a chain so each
  derives from the previous committed state.

### Added
- **Dashboard telemetry now feeds secondary surfaces.** Dashboard actions and
  background execution data now publish into a shared event bus that updates the
  debugger console/error timeline, CSP reports, activity heatmap, achievements,
  and Gist auto-sync hooks.
- **Backup blobs are gzip-compressed.** Scheduled/manual backup ZIP blobs stored
  in IndexedDB are now transparently gzip-compressed (Compression Streams API),
  cutting the storage footprint of large backups. Reads are backward-compatible:
  pre-compression records are read as-is, new records are decompressed
  transparently.
- **"Only on This Site" one-click scope.** The popup script menu can now
  restrict a script to the current site in one click (replaces its `@match`
  with a single `*://host/*` pattern and re-registers). The dashboard's
  per-script User Matches editor now validates `@match`/`@exclude` patterns and
  rejects malformed ones instead of silently storing a pattern that never
  matches.
- **Scam / crypto-drain detection.** The static analyzer now has a `scam`
  category that flags wallet seed/private-key access, wallet-drainer keywords,
  and wallet transaction/signature requests, and raises a high-severity
  "possible credential/wallet exfiltration" finding when a script both
  references wallet secrets (or drainer operations) and sends data off-page.
  Benign wallet-adjacent scripts (reading `window.ethereum`, requesting
  accounts) are not flagged. Runs in both the AST and regex analysis paths.

### Security
- **Page-visible bridge events no longer carry GM response bodies.**
  `GM_xmlhttpRequest`, `GM_webSocket`, and GM value-change listeners now keep
  sensitive payloads on the direct extension messaging path and redact the
  `window.postMessage` bridge that is visible to the host page's MAIN world.
- **Subresource Integrity "Require" mode is now enforced.** The Security →
  Subresource Integrity setting always had a "Require" option, but it was never
  wired to anything. It now refuses to run any remote `@require`/`@resource`
  that carries no verifiable SRI hash (`#sha256=`/`sha384`/`sha512`); npm specs
  (computed SRI) and hash/TOFU-pinned requires are unaffected. The install/update
  review flags every un-pinned dependency as "unverified remote code" regardless
  of mode, so the risk is visible before install. Enforcement applies to
  execution only — install/update provenance previews still inspect the
  dependency via an `allowUnpinned` probe path.

## [v3.16.0] — Deep audit: security, data-safety, and correctness (2026-07-02)

### Security
- **GM network/resource/menu/notification handlers now bind to the authenticated
  caller.** GM_xmlhttpRequest/GM_webSocket/GM_download, GM_getResourceText/URL,
  GM_loadScript, and menu register/unregister keyed their @connect / @resource
  authorization off the caller-supplied `data.scriptId`. A userscript could forge
  another installed script's id to borrow its @connect allowlist or read its
  @resource bodies, defeating the install-time @connect disclosure. All now use
  Chrome's unspoofable `sender.userScriptId` when present (matching the GM
  value/cookie/webRequest handlers); notification update/close reject
  cross-script ids.
- **Attribute-injection XSS in dashboard modules.** The depgraph/snippets/
  templates/csp/sharing/gamification escapers used `textContent`→`innerHTML`,
  which does not escape quotes, so a `@require` value like `x" onmouseover=...`
  broke out of the dependency-graph `title=""` and ran in the privileged
  extension page. All local escapers now escape `"` and `'`.

### Fixed — data safety
- **Cloud sync permanently re-deleted restored-from-trash scripts.** The
  tombstone-resurrection guard checked `merged.scripts`, but `mergeData()` had
  already filtered every tombstoned id out of it, so the guard was dead code and
  a restored script (newer than its tombstone) was re-deleted on the next sync.
  Now looks the candidate up in the unfiltered local/remote union, drops the
  tombstone, and re-includes the script; also persists the local tombstone set
  on any change, not only growth.
- **Trash restore could lose a script on a service-worker crash** — it emptied
  the trash entry before persisting the script. Persist first now (worst case is
  a harmless idempotent duplicate).
- **Backup restore wiped per-script settings.** The ZIP import path (used by
  restore) built records from an empty settings base, discarding userMatches/
  userIncludes/userExcludes, notes, tags, pinned, runAt override, and syncValues
  of installed scripts. It now bases on the existing settings; JSON overwrite
  also preserves the original createdAt/position.

### Fixed — correctness
- **Chrome misdetected as Firefox.** `_isFirefoxRuntime()` treated the
  `browser`→`chrome` MV3-compat alias as Firefox, so Chrome showed Firefox
  userScripts setup instructions AND disabled per-script worldId isolation on
  Chrome 133+. Now detects Firefox by user agent only.
- **Editor swallowed a keystroke** after re-activating a same-content tab (the
  change-suppression latch was armed for a no-op `setValue`).
- **Editor cursor readout was frozen at "Ln 1, Col 1"** under Monaco
  (`getCursor()` returned a hardcoded stub); it now reports the real position.
- **New Script / Duplicate / New Folder** now surface the background's resolved
  `{ error }` instead of silently doing nothing.
- **Storage stat and quota bar** measure usage and quota from the same
  `navigator.storage.estimate()` (scripts live in IndexedDB), so the bar no
  longer reads ~0% and the >85% warning works.
- **Find Scripts pagination** ("Next") never appeared because it required 50
  results but pages are 25; it now tracks the real per-source page size.
- **Doubled/space-prefixed toolbar labels** from the i18n text-target map, and a
  deep link to a since-deleted script now clears the stale hash with a toast.
- **Debounced autosave** no longer writes the wrong script after a tab switch.

### Notes
- Editor undo-history methods are now explicit adapter stubs (per-tab Monaco
  undo is a roadmap item) instead of throwing and being silently swallowed.
- ~13 additional verified findings (Easy Cloud merge parity, cloud-backup
  envelope collision, SettingsManager write race, provenance-pairing, migration
  and backup-blob edge cases) are tracked in ROADMAP.md under Deep Audit Findings.

## [v3.15.1] — Editor screen repair and redesign (2026-07-02)

### Fixed
- **Editor was unusable in v3.15.0.** The full-screen overlay shipped at
  `z-index: 50` while the sticky dashboard header is `z-index: 100` — the
  inert header painted over the editor's Save/Close row and tabs, so nothing
  in the top band was visible or clickable. The overlay now stacks at 200
  (above all sticky page chrome, below modals at 300). A new
  `npm run smoke:editor` harness opens the real editor in headless Chromium,
  hit-tests all 14 controls with `document.elementFromPoint`, verifies the
  code pane share of the viewport, screenshots it, and clicks Close.
- **`hidden` editor buttons never hid.** `display: inline-flex` /
  `display: flex` author rules on editor action and toolbar buttons defeat
  the UA `[hidden]` style — Preview CSS showed on JS scripts and the
  bind-file buttons always rendered. Explicit `[hidden] { display: none; }`
  rules restore the contract.

### Changed
- **Editor nav redesigned into a single band.** Panel tabs (Code/Settings/
  Externals/Storage/Info) sit left; the editor tools are icon-only (labels
  stay in the accessibility tree, tooltips on hover) on the right. A legacy
  `dashboard.css` rule that right-aligned the tabs is gone. With the header
  row, editor chrome is now 2 slim rows; the code pane takes ~91% of the
  viewport at 1440x900.

## [v3.15.0] — Script Store removal, full-screen editor, UX pass (2026-07-02)

### Removed
- **Script Store tab removed entirely.** The multi-source discovery tab
  (`pages/dashboard-store.js`, ~2,100 lines, eagerly loaded on every dashboard
  open) is gone: tab button, panel, lazy-loader wiring, command-palette entry,
  i18n keys (`tabStore`, `loadingScriptStore` across 9 locales), and its test
  surface. Script discovery remains available through the lighter Find Scripts
  dialog (GreasyFork/OpenUserJS search from the toolbar, popup, and side
  panel), Collections, and Gist import.

### Changed
- **Full-screen script editor.** The editor overlay now covers the entire
  viewport (the dashboard header is inert behind the modal anyway), the hero
  header collapses to a slim single row (eyebrow chip and subtitle hidden;
  the metadata summary moves to the title tooltip), and the panel-tab and
  toolbar rows are tightened — the code pane gains roughly 150-200px.
- **New Script opens the editor directly.** The template-picker modal is
  removed; New Script creates a blank script and jumps straight into the
  editor. Starter templates remain in the editor's template manager.

### Fixed
- **Dashboard storage quota bar uses the real quota.** `updateStats()` divided
  usage by a hardcoded 10 MB `chrome.storage.local` cap even though the
  manifest declares `unlimitedStorage`, falsely toasting "Storage at 100%
  capacity" on installs with backup blobs present. The quota bar and warning
  now use the background QuotaManager's `navigator.storage.estimate()` quota
  via `getStorageUsage`, with 10 MB kept only as a messaging fallback.
- **Doubled navigation labels.** The dashboard tab buttons rendered their
  label twice ("Installed UserscriptsInstalled Userscripts") because the
  i18n text-target pass appended a second text node to buttons whose label
  lives in a `data-i18n` span. `setLabelPreservingDecor` now skips elements
  with a `[data-i18n]` child, and the redundant tab entries were dropped.
- **Theme switches no longer show a success toast** (theme editor apply and
  the Layout/editor-theme settings) — the visible change is the feedback.
- **Stray empty pill in the header.** The open-script-editors tab group kept
  its padded, bordered shell when no editors were open; it is now hidden
  until a tab exists.
- **RTL direction bootstrap actually runs.** Five extension pages set
  `document.documentElement.dir` from an inline script that MV3 CSP has
  always blocked (dead code + console errors on every page load). Moved to
  the external `pages/page-dir.js`; the dashboard smoke is console-clean.

## [v3.14.0] — Merge-engine restore + deep audit pass (2026-07-02)

### Fixed
- **Cloud-sync 3-way merge is functional again.** The merge engine called
  `Diff.merge(...)`, an API jsdiff removed in v7 — so every concurrent-edit
  merge threw, fell back to conflict markers, was discarded, and sync silently
  dropped to last-write-wins (defeating the merge-gate fix landed on
  2026-07-01). Reimplemented the 3-way merge on jsdiff v7 primitives
  (`structuredPatch` + `applyPatch`): remote's base-relative changes are applied
  onto the local text, non-overlapping edits merge, and overlapping edits
  surface conflict markers. Fixed in both the Chrome offscreen path
  (`offscreen.js`) and the Firefox inline path (`src/bg/analyzer.ts`, whose
  `getDiff` guard also required the removed `merge`). Added a behavioral test
  that runs the real diff bundle and asserts both sides' edits survive.
- **Backup storage-full warning restored.** `_estimateBackupSize` summed the
  `data` field, which has been stripped since v3.12 moved backup blobs to
  IndexedDB, so the 8 MB warning could never fire; it now sums the recorded
  byte `size`.
- **Dependency graph no longer repaints while idle.** The canvas animation loop
  called `render()` every frame (~60fps) even after the force layout settled,
  wasting CPU/GPU/battery whenever the graph was open; it now repaints only
  while animating or when an interaction changes the view.
- **Removed a dead debugger live-reload message.** The debugger sent a
  `type: 'ScriptDebugger'`/`reloadTabs` message with no router handler on save;
  live-reload is already handled by the background save path, so the dead
  message is removed and the toggle's `sendMessage` now swallows rejections.
- **Bounded the notification error-count map.** Scripts that errored once or
  twice and were then deleted left keys in `notifErrorCounts` forever; the map
  is now capped (below-threshold entries pruned past 500 keys).
- **Removed dead lint fix-preview code.** The `_computeDiff` "collapse
  unchanged regions" loop copied every op without eliding anything; removed
  (real hunk collapsing tracked on the roadmap).

- **Large-file diff no longer produces all-delete garbage.** The hash-based
  diff fallback used for very large scripts (LCS-guarded above ~5M line pairs)
  never resynchronized after a divergence, so one inserted line rendered every
  following line as delete+add — and fed a corrupt merge in the diff viewer. It
  now resyncs on the next matching line (dashboard-diff and dashboard-linter).
- **Standalone install-page export polish.** Replaced the exported page's fake,
  non-scannable "QR code" (an admitted hash-pattern) with a working "Copy Page
  Link" button, and made the bookmarklet minifier string/regex-safe (it now
  strips only whole-line comments instead of regex-stripping `//` and `/* */`
  sequences, which could corrupt code containing those inside strings/regex).

### Security
- **Event-log CSV export defangs formula injection.** `EventLog.exportCSV` now
  prefixes cells beginning with `= + - @` or control chars with `'` (matching
  the error-log export), so a script `@name` like `=HYPERLINK(...)` can't
  execute when the exported CSV is opened in a spreadsheet (CWE-1236).

## [v3.12.0] — Deep audit hardening pass (2026-07-01)

### Fixed
- **Table cells no longer stripped (regression from the Firefox-lint pass).**
  `safeSetHtml`/`htmlToFragment` used a bare `document.createRange()`, which
  parses in document context and silently drops `<td>`/`<tr>`/`<option>`
  fragments. This broke the DevTools network and execution tables and the
  dashboard script table. All 26 helper copies now anchor the parse range in
  the target element via `selectNodeContents`.
- **GM value isolation.** `GM_getValue`/`setValue`/`deleteValue`/`getValues`/
  `setValues`/`deleteValues` now bind to the authenticated `sender.userScriptId`
  when present, so a script can no longer read or overwrite another script's
  stored values by passing a forged `scriptId`.
- **Script chains executed nothing.** Steps sent a non-existent `executeScript`
  action and the step dropdowns read a legacy pre-IndexedDB storage key. Steps
  now run via `runScriptNow`, the list loads via `getScripts`, and failed steps
  reject so the retry error-mode engages.
- **Context-menu scripts ran in the extension ISOLATED world.** `@run-at
  context-menu` execution now goes through the shared USER_SCRIPT-world helper,
  matching page-load, `@crontab`, and run-now injection.
- **Cloud sync 3-way merge was dead-gated to last-write-wins.** The concurrent-
  edit check compared the pre-sync snapshot against `existing` (always equal),
  so genuine concurrent edits silently overwrote. The gate now compares against
  the recorded sync base and uses `existing.code` as the local merge side; a
  clean merge is saved even when the local timestamp wins.
- **Restored scripts were re-deleted by remote tombstones.** A script saved
  after its tombstone (restore-from-trash, ID-preserving import) now wins over
  the tombstone during sync.
- **Theme Editor section headers rendered blank** (`el()` `html` key went to
  `setAttribute`; corrected to `innerHTML`).
- **Collections search lost focus after each keystroke** and force-lowercased
  the field; per-row Install targeted the wrong script when entries lacked a
  Greasy Fork ID; URL-based imported entries could not install.
- **Card view Select button could not unselect** (stale build-time closure).
- **Activity heatmap and achievement streaks used UTC date keys**, zeroing the
  current streak in most timezones; both now key on the local date.
- **High-contrast mode was unreadable on the light theme** (light text on light
  background); the light theme now gets dark-on-light high-contrast tokens.
- **DevTools panel ignored the user's theme** (locked to dark) and always
  appended an ellipsis to the detail title even for short URLs.
- **Shipped `ui-floating-panel` snippet was a SyntaxError** (duplicate `const
  header`); also detaches its drag listeners on close.
- **Popup toggle-failure path threw a ReferenceError** (`updateLocalScriptState`
  was undefined in the popup), leaving the checkbox in the wrong state.
- **Store card rating was interpolated unescaped** (GitHub `stargazers_count`
  path); now escaped.
- **"Don't show again" in the What's New dialog now persists.**
- **Packaged builds omitted page-loaded modules.** `build.sh`, `build-firefox.sh`,
  and `build-edge.mjs` now ship `modules/i18n.js`, `modules/script-config.js`,
  and `modules/user-scripts-setup.js` (loaded by popup/dashboard/install/etc.);
  the Edge include list also ships `managed-storage-schema.json`.
- **Sync KDF iteration count is now capped on decrypt** so a crafted envelope
  can't stall the service worker in PBKDF2.
- Script Chains header/empty-state icon corrected from ⚾ to ⛓.

### Changed
- `tests/utils.test.js`, `versions.test.js`, and `parser.test.js` now import the
  production TypeScript sources instead of re-implementing `escapeHtml`,
  `compareVersions`, and `parseUserscript` (they had drifted).

## [v3.13.0] — Roadmap drain: scheduler, diagnostics, and hardening (2026-07-02)

### Added
- **"Why aren't my scripts running?" per-tab diagnostic.** A new popup panel
  reports, for every installed script against the current page, whether it runs
  and a plain-language reason if not — disabled, no @match, page excluded, user
  scripts turned off (Chrome 138+ toggle), ScriptVault paused, registration
  error, not registered, or a non-page run mode (context-menu/@crontab/
  @background). Turns the top userscript-manager support question into an
  inspectable answer.

### Security
- **Sync encryption downgrade guard.** Once a profile has completed an encrypted
  sync round-trip, a plaintext remote envelope is now rejected instead of loaded,
  closing a hole where an attacker with write access to the storage backend could
  replace the encrypted blob with attacker-authored plaintext scripts. The
  one-time plaintext→encrypted migration is still allowed before encryption is
  established, and disabling encryption resets the latch.

### Changed
- **Install page theme is now driven by the shared token file.** The install
  page defined its own parallel per-theme CSS variable blocks; it now aliases
  the canonical `--sv-*` tokens from `theme-tokens.css` (with `color-mix` for
  derived tints), so a theme change lives in one place instead of two.
- **Script chain editor only offers the Manual trigger.** URL Match / Schedule /
  DOM Event / After Script triggers were selectable but no engine ran them, so
  chains configured with them silently never fired. The editor now offers only
  the working Manual trigger (a trigger engine is tracked on the roadmap);
  existing chains still show their saved trigger badge.

### Fixed
- **Removed dead/misadvertised keyboard shortcuts.** The README listed a
  Ctrl+Tab "cycle tabs" shortcut that Chrome reserves (the handler never fired),
  and the dashboard's toolbar Tab-cycling queried selectors that matched no
  element. Both the dead handlers and the misleading README/help entries are
  removed.
- **Install page now parses `@require-provenance` / `@require-identity`.** The
  install review's Sigstore provenance row always showed "Not declared" because
  the page's local metadata parser dropped the hyphenated directives; it now
  maps them to the camelCase fields the preview reads, so declared provenance
  bundles are actually verified before install.
- **The "Key Mapping: Vim" setting now works.** Choosing Vim persisted the
  setting but nothing consumed it; it now enables KeyboardNav's vim keybindings
  on load and on change.
- **QR share codes are no longer corrupt for payloads of 107-271 bytes.** The
  QR encoder's version table stored per-block data codewords instead of the
  total for multi-block versions (V6-V10), truncating the bit stream and leaving
  most of the symbol blank — and it never emitted the version-information
  modules that V7+ requires. Both are fixed, so shared scripts (typically base64
  data URLs in this size range) now produce scannable codes.
- **Keyboard navigation no longer hijacks focused row controls.** Pressing
  Enter/Space/Delete (or the vim action keys) while a row's action button,
  toggle, or link had focus triggered the row-level action instead of the
  focused control; the control now activates natively, and list navigation is
  suppressed while a modal is open (WCAG 2.1.1).
- **Theme Editor "Apply Theme" now persists across reloads and no longer
  corrupts the layout setting.** Applied custom themes and the extra presets
  (Nord/Dracula/Solarized/Monokai/Gruvbox) are stored as a CSS-variable
  override that the dashboard re-applies on load, instead of reverting to the
  base theme. Only the four real layouts (dark/light/catppuccin/oled) are
  written to `settings.layout`; the extra preset keys — which have no CSS block
  and previously fell back to dark and blanked the Layout select — are no longer
  stored as layouts, and the layout setting is now validated.
- **Monaco editor Ctrl+S / Escape now work.** The editor sandbox's save/close
  keybindings posted to handlers that were out of scope (and a dead
  `[data-action="save"]` selector), so the advertised "Press Ctrl+S to save"
  did nothing. Save/close now route through the exposed dashboard UI bridge
  with the real `#btnEditorSave` / `#btnEditorClose` buttons as fallback.
- **Script scheduler now actually enforces schedules.** The dashboard scheduler
  saved schedules and created `sv_sched_` alarms, but the background never
  fired them and no guard gated execution. The background now: fires
  interval/one-time schedules on their alarm (running the script on matching
  open tabs, with one-time schedules disabling themselves after), skips
  page-load registration for interval/one-time schedules (alarm-only, like
  `@crontab`), and injects a runtime guard so time/day/date-range schedules
  only execute inside their window. Date-range comparisons now use the local
  calendar date instead of UTC. Saving a schedule reregisters the script so the
  guard/alarm applies immediately.

### 2026-07-01 - Deep engineering audit

- **Fixed resetScriptSettings not re-registering scripts.** Clearing
  execution-affecting settings (runAt, frameMode, userMatches, etc.) now
  triggers re-registration, matching the setScriptSettings behavior.
- **Fixed rollbackScript race condition.** The handler now wraps in
  `_runExclusiveScriptOperation` to prevent concurrent toggle/save
  operations from corrupting version history.
- **Fixed setScriptSettings registration gap.** Uses `reregisterScript`
  instead of the two-step unregister+register, eliminating the brief
  unregistered window on Chrome 138+ where `userScripts.update()` is
  available.
- **Added createScript size validation.** The handler now enforces the
  5 MB `MAX_SCRIPT_SIZE` limit matching saveScript and importScript.
- **Fixed switchProfile cache mutation.** Profile switches now clone
  scripts before persisting to avoid corrupting ScriptStorage cache
  when the IDB write fails.
- **Added WebSocket connection cap.** The GM_webSocket map is now
  capped at 500 entries, matching other GM API map limits.
- **Fixed Chrome build missing managed-storage-schema.json.** The
  managed storage schema for enterprise policy provisioning was
  referenced by `manifest.json` but missing from the CWS package.
- **Fixed dependency graph theme hardcoding.** Canvas rendering now
  resolves colors from CSS custom properties instead of hardcoded hex
  values, so the graph renders correctly across all four themes.
- **Fixed card view badge theme colors.** Remote and local badges now
  use theme-aware CSS variables instead of hardcoded light-blue/gray.
- **Added regex pattern length guard.** Dashboard URL pattern testing
  now rejects regex patterns longer than 1000 characters to mitigate
  ReDoS from user-authored patterns with catastrophic backtracking.
- **Fixed test mocks.** `chrome.alarms.create/clear` and
  `chrome.contextMenus.removeAll` mocks now return Promises matching
  real MV3 API behavior.

### 2026-06-28 - Patch dependency refresh

- **Refreshed routine dev-tool patch drift.** Updated Playwright Test,
  Chrome extension types, the exact-pinned Chrome Web Store upload CLI, jsdom,
  and TypeScript to the current patch releases.
- **Kept release-trust guardrails aligned.** The CWS publish-tooling gate now
  pins the reviewed `chrome-webstore-upload-cli` 4.0.1 tarball and integrity.
- **Closed the P2 dependency-drift roadmap row.**

### 2026-06-28 - Firefox AMO lint warning reduction

- **Reduced Firefox AMO lint noise from 148 reviewed warnings to 59.**
  Dashboard, popup, install, devtools, and module HTML sinks now route through
  fragment replacement helpers instead of raw `innerHTML` assignment.
- **Ratcheted the Firefox warning gate.** `npm run firefox:warnings` now fails
  above 80 reviewed warnings and records reviewer-ready rationale for the
  remaining `web-ext` warning classes.
- **Closed the P1 Firefox lint-warning roadmap row.**

### 2026-06-28 - Public release check hardening

- **Removed the GitHub CLI dependency from public release verification.**
  `npm run release:check:public` now checks the public GitHub release page,
  latest-release redirect, and Chrome ZIP download URL with `fetch` instead
  of `gh release view/list`.
- **Separated network and signing failures.** The public checker now reports
  missing assets, latest-release drift, and public network failures separately
  from local tag-signature failures; the current public failure is only the
  known unsigned legacy `v3.11.0` tag.
- **Closed the P1 public-release verification roadmap row.**

### 2026-06-28 - Local-only release gate

- **Removed the resurrected GitHub Actions workflow surface.** The checked-in
  workflow and action-pin gate are gone; `npm run check` now runs
  `local-build-policy:check`, which fails if `.github/workflows/` files return.
- **Retargeted release checks to local evidence.** CWS tooling, remote-code,
  store-status, toolchain, CRA, Firefox, and accessibility tests now assert
  package/runbook wiring instead of reading workflow YAML.
- **Aligned release documentation with local artifacts.** README support
  matrix copy now describes local Chrome, Firefox, and Edge artifact creation;
  ignored internal runbooks were updated with the same local-only release path.
- **Closed the P0 remote-CI roadmap row and the related P2 docs row.**

### 2026-06-28 - IndexedDB storage bucket partitioning

- **Partitioned persistence by storage family.** Script records/stats/local
  bindings, GM value bags, and backup blobs now route through separate
  Storage Bucket-backed IndexedDB factories when `navigator.storageBuckets`
  is available, while browsers without the API keep the legacy single-DB
  fallback.
- **Exposed backup blob persistence in the runtime bundle.** `BackupsDAO` is
  now exported from the generated storage runtime so the backup scheduler can
  use the backup partition instead of silently falling back to
  `chrome.storage.local` blob storage.
- **Extended performance and regression coverage.** Storage bucket tests pin
  bucket feature detection, fallback schema creation, delete cleanup, backup
  restore-style overwrites, and sync merge-style value writes. The large
  library harness now measures concurrent 1k-script script/value/backup write
  throughput and reported a 1.03x bucketed improvement on the final local run.
- **Closed the RD-7 roadmap row.** README and large-library performance docs
  now describe the bucketed IndexedDB behavior and fallback contract.

### 2026-06-28 - Monaco 0.55.1 upgrade

- **Upgraded the packaged Monaco ESM editor to 0.55.1.** The local ESM bundle
  now pins the top-level `lsp` and `typescript` namespace contract, uses the
  renamed `EditorAutoClosingEditStrategy` type surface, and keeps Firefox
  textarea-first packaging unchanged.
- **Added local GM API declaration loading.** The editor sandbox fetches
  packaged `lib/scriptvault.d.ts` and registers it through
  `typescript.javascriptDefaults.addExtraLib()` so GM API completions can use
  generated ScriptVault declarations without remote assets.
- **Refreshed bundle evidence and budgets.** The Monaco ESM audit now records
  27.7 MB uncompressed / 4.70 MB gzip output, raises only the reviewed
  uncompressed limits, and keeps the 5 MB gzip ceiling. Monaco's DOMPurify
  dependency is overridden to 3.4.11 so npm audit remains clean.
- **Closed the RD-11 roadmap row.** README and migration-plan docs now describe
  the declaration-backed IntelliSense path and 0.55.1 packaging constraints.

### 2026-06-28 - Roadmap blocked hygiene

- **Moved L-6 Sigstore keyless author signing to blocked.** The verifier/parser
  groundwork remains shipped, but author keyless signing needs an OIDC
  issuer/client strategy, browser auth flow, signer-identity policy, and CWS
  review copy before Fulcio/Rekor signing can be implemented safely.

### 2026-06-28 - Browser visual regression gate

- **Added a Vitest Browser Mode screenshot gate.** `npm run test:visual`
  now launches Chromium through the Playwright provider, renders a stable
  dashboard list-view shell with shipped theme/dashboard CSS, and compares it
  against a checked-in screenshot baseline.
- **Kept visual regression separate from the unit suite.** The default Vitest
  config excludes `tests/visual/**`, while a normal-suite contract test pins
  the visual command, loopback browser server binding, Chromium provider, and
  baseline coverage.
- **Closed the L-7 roadmap row.** Visual regression testing is now actionable
  through local tooling and documented in the README quality/project-structure
  sections.

### 2026-06-27 - CloudSync runtime extraction

- **Promoted CloudSync orchestration into a generated runtime module.**
  `modules/cloud-sync.js` is now generated from `src/background/cloud-sync.ts`
  and loaded before the raw core bridge. Sync download/upload calls now carry
  an abort signal through the 90-second alarm timeout path, the runtime drift
  gate tracks 41 promoted artifacts, and sync cockpit/source parity tests now
  pin the new module boundary.
- **Fixed a slow chain test harness.** The dashboard chains unit test now
  supports callback-style `chrome.runtime.sendMessage`, matching the runtime
  API and avoiding a 30-second timeout path in the full suite.
- **Closed the RD-6 extraction roadmap row.** ResponseMap coverage, the typed
  router action table, extracted GM handler dispatch, and standalone CloudSync
  orchestration are now all pinned by tests and generated artifacts.

### 2026-06-26 — GM_webSocket bridge

- **Added `GM_webSocket` for userscripts.** Connections are owned by the
  background service worker, enforce script grants, `@connect`, and
  internal-host guards before dialing, expose a WebSocket-like handle with
  send/close/abort and event listeners, and are documented in install
  permission copy plus generated TypeScript declarations.

### 2026-06-26 — Coverage threshold ratchet

- **Raised the Vitest coverage gate to the v3.12 Phase 1 thresholds.**
  Coverage now requires 45% lines, 48% functions, 32% branches, and 42%
  statements. Runtime/source parity tests now cover shipped XHR,
  script-config, subscription, and sync-crypto modules with V8-visible
  filenames, and the ts-runtime generator contract runs in Node so esbuild
  remains stable under coverage.

### 2026-06-26 — Dashboard setup i18n coverage

- **Extended runtime dashboard translations to first-run setup and Settings General controls.**
  The skip link, Chrome userScripts setup warning, setup action buttons, and
  dismiss control now use the shared `modules/i18n.js` DOM translation path.
  General, appearance, menu, search, update, externals, sync, editor, security,
  runtime-host-permission, BlackCheck, downloads, experimental, reset,
  empty-state settings, and Utilities export/cloud/backup schedule labels,
  select options, checkbox text, placeholders, aria labels, helper tooltips,
  status text, and action buttons are also wired through the same runtime
  dictionary. Utilities backup browser, import, subscription, workspace,
  diagnostics, support snapshot, Public API trust, signing trust, and activity
  log surfaces now share the same coverage. Trash recovery and Script Store
  loading states now use the same runtime dictionary path, and the Help panel
  hero, filters, quick actions, operational notes, shortcuts, reference copy,
  pattern tester, about stats, and empty state are keyed as well. The dashboard
  title, scripts toolbar filters and counters, editor overlay, editor info,
  storage, per-script settings, external resources, Find Userscripts modal,
  progress modal, and editor runtime feedback now use the shared runtime
  dictionary too. Strict locale key drift remains clean.
- **Extended the active runtime dictionary to non-dashboard extension pages.**
  Popup, side panel, install, DevTools launcher, and DevTools panel shell
  controls now load `modules/i18n.js`; popup, side-panel, and DevTools runtime
  empty states, action labels, status messages, and export feedback are keyed
  through the shared dictionary.

### 2026-06-26 — UI state polish and diagnostic feedback

- **Refined settings, side panel, and DevTools state feedback.** Dashboard
  settings now promote field labels into accessible control labels and mark
  sections with visible invalid-state treatment when a nested field fails
  validation. The side panel uses consistent SVG icon controls in the compact
  header/footer while preserving dynamic labels, and the DevTools panel now
  reports refresh/export success and failure states inline instead of only
  logging them.

### 2026-06-25 — Session-only credential storage

- **Added no-at-rest credential mode for sync providers and Gist tokens.**
  Sync provider secrets, provider metadata, sync encryption passphrases, and
  GitHub Gist PATs can now stay in `chrome.storage.session` with an in-memory
  fallback when the API is unavailable. Persistent settings are scrubbed,
  reconnect state is explicit after restart, and disconnect clears session and
  persistent copies.

### 2026-06-25 — Draft UserCSS live preview

- **Added temporary UserCSS draft preview from the dashboard editor.**
  UserStyle drafts can be previewed on the active eligible tab without saving
  or writing style storage. Preview CSS is replaced as the draft changes and
  cleared on save, disable, tab switch, close, or navigation.

### 2026-06-15 — Redacted trusted-extension evidence in support snapshots

- **Added aggregate trusted-extension evidence to support snapshots.**
  When Public API permissions are included, the snapshot now reports
  `trustedExtensionCount` and `untrustedExtensionDenials` (count +
  last-denied timestamp) without exposing raw extension IDs. Three
  test cases verify the aggregate-only evidence boundary.

### 2026-06-15 — Service worker fetch abort safety

- **Replaced the 5-minute background task safety timer with `chrome.alarms`.**
  The mutual-exclusion safety timer for auto-update/sync/subscription tasks
  previously used `setTimeout`, which is lost if the MV3 service worker
  dies within the 5-minute window. Now uses a named `chrome.alarms` alarm
  (`sv_task_safety_<token>`) that survives service worker restarts and
  releases the mutex even if the worker was killed mid-task.

### 2026-06-15 — Bookmarklet-to-userscript converter

- **Added bookmarklet import in the dashboard URL input.** Pasting a
  `javascript:` URL into the Utilities import field converts it to a
  `@run-at document-end` userscript with `@match <all_urls>` and opens it
  in the editor for review before saving. Percent-encoded and multi-statement
  bookmarklets are handled. Empty bookmarklets (`void(0)`) are rejected.
  Six test cases pin conversion, encoding, multi-statement, empty, and wiring.

### 2026-06-15 — Multi-store release artifact attestation

- **Extended CI artifact attestations to Firefox and Edge packages.** Main-branch
  pushes now attest the Firefox package ZIP, Firefox source ZIP, and Edge
  package ZIP alongside the existing Chrome ZIP and SBOM attestations.
  All 11 action references are SHA-pinned. Actions pins check passes.

### 2026-06-15 — Violentmonkey migration guide and import validation

- **Added a "Migrating from Other Managers" section to README.** Step-by-step
  migration guides for Violentmonkey, Tampermonkey, and Greasemonkey users
  with format-specific notes on what ScriptVault preserves.
- **Added `tests/vm-import.test.js`** (5 cases) with a realistic VM JSON
  export fixture covering enabled scripts, disabled scripts, and empty-code
  skip behavior. Pins the runtime handler's field access, registration, and
  badge update contract.

### 2026-06-15 — Acorn 8.17 strict parsing for analyzer

- **Updated vendored Acorn from 8.16.0 to 8.17.0.** The AST analyzer now
  uses Acorn's new `strict` parsing option for scripts containing
  `'use strict'` directives, enabling detection of sloppy-mode-only
  constructs in scripts that claim strict mode. Module fallback parsing
  remains unchanged. Vendored provenance check updated.

### 2026-06-15 — System theme auto-detection

- **Added `Auto (system)` theme option across all extension pages.** Setting
  `layout` to `auto` resolves to dark or light based on the system's
  `prefers-color-scheme` preference. Theme updates in real time when the OS
  switches between dark and light mode. Dashboard, popup, side panel, and
  install page all respect the setting. Manual theme selection (dark, light,
  catppuccin, oled) still overrides auto-detection. The theme cycle button
  now includes `Auto` as the first option.

### 2026-06-15 — EU CRA vulnerability reporting readiness

- **Documented CRA vulnerability reporting obligations in the release
  runbook.** New §10 covers the 24-hour ENISA notification, 72-hour
  vulnerability notification, and 14-day final report timelines effective
  Sep 11, 2026. References existing CycloneDX SBOM and CRA SBOM gates.
- **Added CRA timeline reference to the dependency audit policy.** The
  blocking `npm audit` gate is now documented as a CRA compliance
  prerequisite.

### 2026-06-15 — Execution realm downgrade gate

- **Blocked silent MAIN-world fallback for run-now and crontab execution.**
  When `chrome.userScripts.execute()` is unavailable (Chrome < 135 or API
  failure), `runScriptNow` and `@crontab` execution no longer silently
  fall back to `chrome.scripting.executeScript({ world: 'MAIN' })`. The
  MAIN-world path is now allowed only when the script explicitly declares
  `@inject-into page` or `@sandbox raw`. All other scripts receive a clear
  error explaining the API requirement. Two new regression tests pin the
  gate in both execution paths.

### 2026-06-15 — Firefox cloud-sync provider claim gate

- **Added Firefox sync scope footnote to the README comparison table.**
  The comparison table now notes that Firefox currently supports WebDAV and
  S3, with OAuth providers (Google Drive, Dropbox, OneDrive) deferred until
  a Firefox `identity` validation pass lands.
- **Added a CI check for Firefox sync scope drift.** `scripts/check-readme-claims.mjs`
  now fails if `manifest-firefox.json` lacks the `identity` permission but
  the README Cloud Sync row has no qualifying footnote.

### 2026-06-15 — Optional-permission inventory drift fix

- **Fixed `downloads` permission classification across all reviewer-facing
  docs.** Both `manifest.json` and `manifest-firefox.json` declare `downloads`
  as an optional permission, but `PRIVACY.md`, `docs/store-listing-copy.md`,
  `AMO-SOURCE-README.md`, and the CI permission-copy checker all classified it
  as required. Now all four files correctly say `optional_permission` with
  runtime-request language. `npm run store-copy:check` catches future
  required/optional drift automatically.

### 2026-06-15 — esbuild security update

- **Updated esbuild from ^0.27.4 to ^0.28.0.** esbuild 0.28.0 fixes a
  dev-server path-traversal vulnerability (Snyk advisory). The dev server
  is used during `npm run dev` watch mode. The extension bundle itself is
  unaffected since esbuild is a devDependency only. All build modes
  (bg-only, prod, Monaco ESM) verified clean on 0.28.1.

### 2026-06-14 — Trusted Types lint rule

- **Added a Trusted Types linter rule for MAIN-world scripts.** The editor lint
  panel now warns when an `@inject-into page` script assigns to
  `innerHTML`/`outerHTML` or calls `document.write`/`document.writeln`/
  `insertAdjacentHTML` — string sinks that throw on sites enforcing
  `require-trusted-types-for 'script'` (Trusted Types reached Baseline in 2026).
  The warning points authors to `textContent`, `append()`, or `GM_addElement()`
  and stays silent for the default USER_SCRIPT/isolated world, so there are no
  false positives on the common case. Five focused tests cover MAIN-world
  detection, each flagged sink, read/comparison exclusions, and rule
  registration.

### 2026-06-13 — Optional downloads permission + trusted extension gate

- **Added trusted extension ID management to Public API.** Extension senders
  are now denied by default for non-handshake actions (getInstalledScripts,
  toggleScript, etc.). Trusted extension IDs are managed separately from
  trusted web origins via a new dashboard textarea in Trust Center. Extension
  IDs are validated (32 lowercase letters), deduplicated, and persisted.
  Handshake actions (ping, getVersion, getAPISchema) remain open. Audit log
  records `untrusted_extension` for denied callers. Support snapshot includes
  trusted extension count. Eight new test cases cover the gate, validation,
  and bypass behavior.
- **Made downloads permission optional.** Fresh installs no longer require
  the `downloads` permission. Scripts declaring `@grant GM_download` are
  prompted at install time via the existing optional permission flow.
  GM_download checks permission at runtime and returns a clear error when
  not granted. Dashboard Downloads section shows permission status with a
  one-click grant button for recovery.
- **Hardened pattern builder regex construction.** Path segment values are
  now percent-encoded for unsafe characters, `matchUrl` properly escapes
  `*` before converting to wildcard regex, protocol wildcard handling uses
  regex replacement instead of fragile slicing, and pattern length is
  capped at 200 characters. Three new functional tests cover sanitization,
  match correctness, and length guard.

### 2026-06-11 — Cloud sync merge upload base

- **Pinned local workspace refresh in Edge.** The browser smoke now binds a
  real File System Access handle, reviews and applies a changed local
  `.user.js` file, records rollback/trust evidence, and proves the updated
  script executes after registration. Shared IndexedDB schema ownership now
  includes the dashboard v3 publication-receipts store so local applies cannot
  trip a service-worker downgrade open.
- **Formalized CRA-style SBOM validation.** Release trust artifacts now include
  CycloneDX 1.6 supplier, product purl, license, component `bom-ref`, and
  dependency graph evidence, with a CI-wired `release:trust:cra` gate.
- **Expanded Playwright E2E release coverage.** Browser tests now cover
  service-worker registration rehydration, WebDAV upload/download round-trip,
  update rollback, import quarantine review, cross-tab value changes,
  FormData XHR, and local workspace apply flows.
- **Migrated shipped UI font sizing to rem.** Dashboard, popup, side panel,
  install, and DevTools page font-size rules now follow browser text-size
  preferences, with dashboard zoom applied through the root font size and a
  source guard preventing px font-size regressions.
- **Backfilled runtime locale key parity.** `modules/i18n` now carries the full
  English key set for every shipped locale, so `locale:check:strict` fails on
  future runtime key drift instead of the existing backlog.
- **Started dashboard runtime localization.** The dashboard now loads the
  promoted runtime i18n module and translates core shell tabs, toolbar actions,
  help/new-script labels, and script search copy from the shared locale
  dictionary.
- **Expanded dashboard runtime localization.** Scripts-table headers, toolbar
  accessible labels, empty states, and the update queue now use the promoted
  runtime i18n dictionary, including `aria-label` translation support.
- **Localized the dashboard settings shell.** Settings hero copy, category
  filters, search placeholder, summary counts, and filter status text now use
  the runtime i18n dictionary.
- **Extracted user-script message policy.** The background bridge now delegates
  GM/user-script action gating and extension-surface sender checks to a
  promoted TypeScript runtime module with direct source and generated-policy
  tests.
- **Pinned typed message response coverage.** Every `BackgroundMessage`
  action literal now has a `ResponseMap` entry, with a static guard preventing
  future message actions from falling back to unreviewed response typing.
- **Preserved sync bases in upload envelopes.** Cloud sync now includes
  `syncBaseCode` in first-sync and post-merge upload data so other devices keep
  the 3-way merge base instead of falling back to timestamp-only resolution.
- **Uploaded post-merge state.** After remote merge application, upload payloads
  are rebuilt from current `ScriptStorage` state so merged code and the new base
  are propagated in the same sync round.
- **Pinned the round trip.** Source cloud-sync tests now cover first-sync base
  upload and merged-code/base preservation across a second-device sync.
- **Closed the web-ext audit finding.** The npm graph now overrides
  `web-ext`'s `fx-runner` dependency to the patched `1.5.0` release, pulling in
  `shell-quote@1.8.4` and restoring a clean high-severity audit.
- **Serialized save and toggle operations.** `saveScript` and `toggleScript`
  now share the same per-script operation lock so rapid cross-surface actions
  cannot interleave storage writes and user-script registration swaps.
- **Aligned pre-release version ordering.** Install/update comparisons now order
  SemVer pre-release identifiers consistently across the install page, update
  checker source, and generated background runtime, including numeric,
  non-numeric, and longer-identifier precedence cases.
- **Recovered download callbacks after worker restarts.** `GM_download`
  callback routing now persists pending download metadata in session storage,
  uses a single global download-change listener, reconciles terminal states on
  service-worker wake, and prunes timeout or stale tracking entries.
- **Added GM_cookie partition-key support.** `GM_cookie.list`, `set`, and
  `delete` now accept Chrome CHIPS `partitionKey` details, normalize
  `topLevelSite` to an http(s) origin, reject invalid partition shapes before
  Chrome API calls, and expose the option in generated userscript typings.
- **Expanded GM_download parity.** `GM_download` now accepts Blob/File sources,
  typed data-URL downloads, request headers, `anonymous`, `noCache`, and
  redirect options through a bounded fetch bridge while preserving existing
  `@connect` and internal-host policy checks.
- **Added partition-cookie routing for GM_xmlhttpRequest and GM_download.**
  Partition-aware XHR and download requests now validate `partitionKey` /
  `cookiePartition`, collect only matching cookies through `chrome.cookies`,
  force the fetch bridge to omit the default cookie jar, and attach the scoped
  cookie header with a temporary DNR session rule that is removed after the
  request.
- **Removed the dead anonymous-statistics setting.** The dashboard no longer
  exposes a telemetry-looking control that only persisted local state while
  the privacy policy and README promise zero telemetry.
- **Centralized the userScripts setup doctor.** Dashboard and popup setup
  warnings now use a shared state model for Chrome 138+ Allow User Scripts,
  Chrome 120-137 Developer Mode, Firefox optional `userScripts`, current-site
  host access, runtime repair, and support-snapshot evidence.
- **Hardened cross-tab value-change E2E proof.** The Playwright
  `GM_addValueChangeListener` remote-semantics test now tries the browser's
  Allow User Scripts toggle before skipping, and passes live on the installed
  Edge channel.
- **Pinned GM_xmlhttpRequest FormData parity.** A new Edge-channel Playwright
  fixture posts duplicate FormData keys and a `File` through
  `GM_xmlhttpRequest`, then verifies the local server receives ordered duplicate
  values plus filename and content type metadata.
- **Pinned Firefox textarea-first editor scope.** README and Firefox package
  tests now explicitly position Firefox v1 as textarea-first while Monaco stays
  omitted until a pruned local bundle has AMO lint proof.
- **Hardened release supply-chain gates.** CWS publish tooling now pins
  `chrome-webstore-upload-cli` to exact `4.0.0` and checks the lockfile
  integrity hash; `release:check` verifies existing release tags with
  `git tag --verify` while preserving the legacy unsigned v3.11.0 tag as a
  non-public warning; CI now runs an independently callable reproducible ZIP
  comparison after `build.sh`.
- **Completed one-shot dashboard runs.** The dashboard editor and script table
  now expose a Chromium 135+ "Run on Tab" action that targets the active or most
  recently active injectable tab, uses the existing `runScriptNow` handler, and
  keeps the message contract typed alongside the popup action.
- **Pinned the structured-clone interop blocker.** A new regression test keeps
  the Chrome manifest in JSON message-serialization mode while the external
  Public API listener remains active, preventing a Chrome 148+ structured-clone
  flip from silently breaking JSON-mode extension callers.
- **Initialized Action Menu settings from checked schema metadata.** The
  dashboard now drives the Action Menu settings section from a schema-backed
  model, aligns the badge color fallback with the checked default, and extends
  the settings-schema gate so section metadata drift fails in CI.
- **Hid unsupported local workspace controls by default.** Chromium-only local
  file binding buttons now stay hidden until File System Access support is
  detected, while Firefox and unsupported browsers keep the manual file import
  fallback visible.
- **Cleaned up failed Greasy Fork handoff forms.** The publish handoff now
  removes the hidden source-bearing prefill form immediately if browser form
  submission fails, preserving the no-stored-source boundary.

### 2026-06-05 — Microsoft Edge sideload smoke

- **Added a dedicated Edge browser smoke.** `npm run smoke:edge` now builds the
  Edge package, loads `build-edge/` into Microsoft Edge, opens dashboard and
  popup surfaces, saves/toggles a smoke userscript, verifies it runs on a local
  target page, and captures extension console/runtime errors.
- **Recorded Edge smoke evidence.** The smoke writes
  `edge-artifacts/edge-smoke-<version>.json`, and the Edge readiness report
  now points release operators to that evidence path.
- **Kept Edge support claims conservative.** The generated support matrix still
  labels Edge as a compatible package / manual Partner Center publication path
  until maintainers run the local smoke on a release machine.

### 2026-06-04 — Import and restore quarantine

- **Quarantined restored executable scripts by default.** JSON imports, ZIP
  imports, raw-JS ZIP fallback imports, selected backup restores, cloud restores,
  and full-vault restores now keep archive-enabled scripts disabled until review.
- **Added an explicit trusted restore override.** Backup review shows how many
  archive-enabled scripts will become active immediately when the user selects
  the trusted override; archived-disabled scripts stay disabled either way.
- **Recorded trust posture in restore/import results.** Receipts and toasts now
  count quarantined, preserved-disabled, and trusted-enabled scripts without
  storing script bodies or credentials in the summary.

### 2026-06-04 — Host-permission recovery prompts

- **Added current-site host access diagnostics.** The background now reports the
  active/recent site origin pattern, browser-granted state, and matching enabled
  scripts blocked by withheld site access.
- **Surfaced recovery in popup, side panel, and dashboard.** Users see the
  blocked script names and can queue Chrome `addHostAccessRequest` prompts or
  use the standard `permissions.request({ origins })` fallback from extension
  pages.
- **Gated the optional-host manifest prototype.** `npm run
  host-permissions:prototype` writes a deterministic report for moving
  `http://*/*` and `https://*/*` to `optional_host_permissions` later while the
  shipping manifests and reviewer copy remain unchanged.

### 2026-06-04 — NPM/ESM `@require` resolver wiring

- **Wired `npm:` specs into the real `@require` fetch path.**
  `fetchRequireScript()` now resolves `@require npm:<package>` through the
  promoted NpmResolver and caches the resolved package bytes under both the
  original npm spec and the final CDN URL.
- **Closed the computed-integrity TOCTOU gap.** `NpmResolver.resolveWithCode()`
  returns the exact response body used to compute SRI, so the runtime no longer
  hashes one CDN response and executes a later fetch of the same URL.
- **Applied internal-host checks to npm CDN fetches.** NPM resolver fetches now
  reject non-HTTPS URLs before network I/O and reject redirects into internal
  hosts before reading or caching bytes.

### 2026-06-04 — Remove dead dashboard i18n-v2 table

- **Removed the unused dashboard i18n-v2 dictionary.** The dashboard no longer
  eager-loads the 8-language table that had no `data-i18n` consumers.
- **Stopped advertising translated dashboard UI.** The settings language
  selector was removed, README now scopes localization to manifest/runtime
  messages, and locale docs say the dashboard is English-only until a real DOM
  translation pass exists.
- **Narrowed the locale gate to live surfaces.** `scripts/check-locales.mjs`
  now audits `_locales/` and `modules/i18n.js` instead of a deleted dashboard
  table.

### 2026-06-04 — Restore What's New for v3.x

- **Added the v3.11.0 dashboard What's New entry.** First-run dashboard visits
  after a v3.11.0 upgrade now have a real modal entry instead of silently
  marking the version as seen.
- **Made What's New freshness a checked contract.** `npm run whatsnew:check`
  evaluates the dashboard module against `manifest.json.version` and now runs
  inside `npm run check`.

### 2026-06-04 — Correct @crontab next-fire scheduling

- **Replaced the hourly fallback with real next-fire scheduling.** `@crontab`
  scripts now parse five cron fields with lists, ranges, steps, month/day
  names, and Sunday as `7`, then schedule the exact next local fire time.
- **Re-armed crontab jobs as one-shot alarms.** Crontab alarms now use
  `chrome.alarms.create({ when })` and re-compute after each fire, so complex
  expressions like `30 9 * * 1` no longer run hourly.
- **Surfaced invalid crontab metadata in the editor.** The Advanced Linter now
  flags unsupported `@crontab` expressions instead of letting them silently
  fall back.

### 2026-06-04 — Dashboard module reachability

- **Mounted the formerly unreachable dashboard modules.** Scripts, settings,
  utilities, and editor actions now initialize their lazy dashboard modules
  through concrete containers or toolbar triggers instead of discarding loaded
  module results.
- **Added a dashboard module reachability gate.** `npm run
  dashboard:modules:check` verifies triage metadata, lazy-loader and HTML
  references, and UI wiring tokens for every `pages/dashboard-*.js` module, and
  now runs inside `npm run check`.
- **Removed the profile module's hidden Alt+number switcher.** Profile
  switching stays on visible dashboard controls without registering a global
  keyboard shortcut path.

### 2026-06-04 — TOFU SRI for unpinned `@require`

- **Blocked previously trusted unpinned dependency swaps.** Trust receipts now
  fail save/update/install flows when the same unpinned `@require` URL resolves
  to different bytes than the first trusted SHA-256 snapshot, or when those
  bytes cannot be reverified.
- **Made receipt probes cache-safe.** Receipt generation fetches dependency
  bodies with a cache-bypassing, no-store mode so stale cache entries cannot
  hide a CDN change and rejected bytes cannot replace the active cache.
- **Surfaced TOFU review reasons in pending updates.** Queued updates now show
  a specific "previously trusted unpinned @require bytes" reason before apply;
  verifiable SHA-pinned URLs continue through normal SRI validation.

### 2026-06-04 — Per-script privileged host scope

- **Scoped GM network, cookie, download, and DNR primitives to script hosts.**
  `GM_xmlhttpRequest`, `GM_loadScript`, `GM_download`, `GM_cookie`, and
  `GM_webRequest` now check a script's effective run-host scope before using
  ambient extension host permissions; `@connect` explicitly widens
  network/download/DNR targets, while cookie access stays run-host scoped
  unless the advanced cross-scope override is enabled.
- **Hardened DNR rule translation and CSP stripping.** DNR rules now require a
  concrete target host, carry script initiator-domain constraints, support
  accepted `selector.include` and string `cancel` shapes without becoming
  global rules, and reject CSP header mutation unless Modify CSP is explicitly
  set to `yes` or the high-privilege override is enabled.
- **Surfaced the boundary in review/settings UI.** The install review shows a
  privileged host-scope card, `GM_webRequest` is treated as elevated browser
  access, and the dashboard exposes the cross-scope privileged API override as
  an advanced security setting.

### 2026-06-04 — Edge package evidence gate

- **Tied Edge support claims to generated artifacts.** `npm run
  build:edge:check` now writes a release-readiness report with Edge package,
  manifest-transform, manual Partner Center publication, deferred REST update,
  and no-CI-browser-smoke status; the browser support matrix reads that report.
- **Added Edge CI artifact coverage.** CI now builds and uploads
  `edge-artifacts/*`, and release docs distinguish automated package
  generation from manual initial Edge Add-ons publication.

### 2026-06-04 — Cloud sync encryption

- **Added optional client-side encryption for sync payloads.** CloudSync and
  EasyCloud can now upload v2 `AES-256-GCM` envelopes derived with
  `PBKDF2-SHA-256`, while still reading legacy plaintext v1 sync files.
- **Kept the encryption passphrase out of normal exports.** The dashboard
  exposes the sync-encryption opt-in and passphrase field, and JSON/ZIP backup
  credential redaction treats `syncEncryptionPassphrase` as a sync credential.

### 2026-06-04 — Contributor local-state guidance

- **Added a public CONTRIBUTING guide.** The guide covers setup,
  verification, release evidence commands, and generic local-only file hygiene.
- **Excluded local state from source archives.** `.gitattributes` now marks
  `.factory/` as `export-ignore`, matching the existing `.gitignore` rule and
  keeping local workflow state out of release/source-review archives.

### 2026-06-04 — README checklist regression pin

- **Pinned recent shipped-feature checklist rows.** The README claim test now
  asserts that the feature-claim checklist keeps rows for the ESM bundler,
  trust receipts, install-source badges, internal-host guard, sync cockpit, and
  dashboard virtualization.

### 2026-06-04 — CWS remote-code compliance gate

- **Added a Chrome Web Store remote-code compliance packet.**
  `docs/cws-remote-code-compliance.md` maps user-installed scripts,
  `@require`, sandboxed editor, OAuth, script-search, and sync flows to their
  allowed review buckets and states that extension pages/service worker do not
  execute remote logic directly.
- **Added a package scanner for remote-code execution patterns.**
  `npm run cws:remote-code:check` now validates docs, CI wiring, and source
  package inputs, and CI scans the generated `ScriptVault-vX.Y.Z.zip` after
  `bash build.sh` for remote script tags, remote workers, remote imports, and
  fetched-string eval/new Function patterns.

### 2026-06-04 — Plain-language readability gate

- **Added a Flesch 60+ readability gate for high-impact UI copy.**
  `scripts/check-readability.mjs` audits setup, install, and trust strings,
  reports offending IDs and source files, and now runs through CI,
  `npm run test:a11y`, and `npm run check`.
- **Rewrote dense setup and install review copy.** The dashboard/popup setup
  warnings and install trust/review states now use shorter, plain-language
  sentences while preserving the same browser/version guidance.

### 2026-06-04 — Cross-surface Help links

- **Added consistent Help entry points across extension pages.** Dashboard,
  popup, side panel, and install now expose a `[data-help]` control with the
  accessible name `Help`.
- **Deep-linked every Help action to the dashboard Help tab.** Popup and side
  panel use the existing dashboard-opening runtime route with `tab: 'help'`
  and all surfaces retain a `pages/dashboard.html#tab=help` fallback.

### 2026-06-04 — AMO vendored library provenance

- **Added reviewer-reproducible vendored library provenance.** Firefox package
  libraries now come from exact npm dev pins, with Acorn regenerated from
  `acorn@8.16.0` source and jsdiff copied from the official `diff@9.0.0`
  package file.
- **Gated AMO source-review inventory drift.** `npm run vendored:provenance`
  writes packaged bytes plus `docs/amo-vendored-libraries.md`, and
  `npm run firefox:package` now fails if versions, hashes, lockfile integrity,
  or Firefox minified-library includes drift from the reviewer inventory.

### 2026-06-04 — Firefox Android compatibility deferred

- **Removed the unverified Android AMO compatibility claim.** The Firefox
  manifest no longer declares `gecko_android`, so the package does not advertise
  Firefox for Android support before a device/emulator smoke gate exists.
- **Regenerated support docs with Android deferred.** README and
  cross-browser pipeline docs now describe Firefox for Android as deferred, not
  a manifest validation target.

### 2026-06-04 — Sync-safe script settings partition

- **Stopped syncing local-only per-script diagnostics.** CloudSync and
  EasyCloud now strip `userModified`, `mergeConflict`, failed `@require`
  markers, registration errors, and source-identity warnings from upload
  envelopes while preserving them locally.
- **Whitelisted portable per-script preferences.** Remote envelopes can still
  carry user-facing settings such as run timing, injection/frame overrides,
  URL override lists, notes, tags, pinned state, and performance budget.

### 2026-06-04 — Bounded backup archive intake

- **Rejected unsafe backup and import archives before parsing.** JSON imports,
  ZIP imports, backup import, inspect, verify, and restore now share bounded
  archive intake for compressed payload size, file count, expanded size,
  per-entry size, nested archive entries, and compression ratio.
- **Applied the 5 MB script cap to portable JSON/ZIP imports.** Oversized
  script bodies are rejected before parser, storage, or registration work, and
  backup verification reports deterministic non-secret archive errors.

### 2026-06-04 — Export and backup credential gating

- **Redacted sync credentials from portable vault settings by default.** JSON
  exports, cloud backups, and managed backup ZIPs now omit WebDAV credentials,
  OAuth tokens, and S3 access keys unless the user enables a separate credential
  opt-in.
- **Stamped backup metadata for credential restore safety.** Managed backup ZIPs
  now include `global-settings.metadata.json`, and JSON/cloud exports carry
  `settingsCredentialsIncluded` plus redacted key names so restore can prove
  whether credentials were intentionally archived.
- **Kept live credentials local on restore by default.** JSON/cloud imports and
  full backup restores preserve current credential settings unless archive
  metadata and the explicit restore checkbox both opt in.

### 2026-06-04 — Sync endpoint internal-host guard

- **Blocked WebDAV and S3 sync SSRF by default.** User-configured sync
  endpoints now run internal-host preflight checks before request and final-URL
  checks after fetch, before response bodies are read.
- **Added an explicit local/private sync endpoint opt-in.** The advanced
  `allowInternalSyncEndpoints` setting is available from Userscript Sync for
  deliberate self-hosted WebDAV, Nextcloud, MinIO, or S3-compatible endpoints on
  localhost, LAN, link-local, or private IPv6 networks.

### 2026-06-04 — Research feature plan refresh

- **Added the current research-backed feature plan.** `RESEARCH_FEATURE_PLAN.md`
  now consolidates ScriptVault's product map, feature inventory, competitive
  research, security/data-safety priorities, UX/accessibility work,
  maintainability themes, prioritized roadmap entries, quick wins, larger bets,
  non-goals, and open questions while keeping `ROADMAP.md` as the active queue.

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
- **Validated Firefox DNR, `@require` SRI, and Ed25519 parity.** The Firefox
  smoke now adds/removes a dynamic DNR rule, verifies `@require` SRI during
  packaged-runtime registration with a pinned HTTPS dependency, and exercises
  Ed25519 key generation, signing, verification, and tamper rejection. Failed
  dependency registration now records `_failedRequireErrors`, and `@require` /
  provenance fetches no longer force `mode: 'cors'`.
- **Closed Firefox Phase 4 polish validation.** The dashboard now shows a
  Firefox/Chrome build indicator with browser version, hides unsupported
  Firefox sync/cloud providers behind a WebDAV-only gate, and the Firefox smoke
  verifies hidden provider options, popup width, and dashboard/popup dark and
  light theme tokens. Static Firefox package tests also pin command shortcuts
  and action icon dimensions.
- **Prepared AMO source review and reviewer rationale.** The source-review ZIP
  now includes `AMO-SOURCE-README.md` with reproducible Firefox build
  instructions, AMO data-collection copy, permission rationale, Firefox v1
  listing scope, and unlisted-first manual submission steps. The
  `store-copy:check` gate now requires that AMO source-review copy.
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
  - Removed `build-background.sh` (deprecated since the earlier local notes;
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
  - Added local working-note and factory-state paths to `.gitignore` as
    local-only runtime state.

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
