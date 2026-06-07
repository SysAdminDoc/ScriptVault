# GM Value Sync Data Model

ScriptVault can already back up GM storage values through explicit local
backup/export flows. Cross-device cloud sync needs a stricter contract because
GM values may contain tokens, preferences, or site data written by scripts.

Cycle 96 added the first opt-in data model slice:

- Per-script opt-in is represented by `script.settings.syncValues === true`.
- The opt-in marker is allowed through CloudSync and EasyCloud script-settings
  envelopes so the user's choice can follow the script.
- Actual stored values are not uploaded by providers in this slice.
- Future value bundles use schema `scriptvault-gm-value-sync/v1`.
- A single script's synced value bundle is capped at 64 KiB, 128 keys, and 256
  bytes per key name.
- Values must be JSON-serializable before they can enter a sync bundle.
- Bundles include only the script ID, counts, byte size, and value bag. They do
  not include script source, script metadata, local workspace handles, local
  paths, sync credentials, or provider account data.

Cycle 97 adds the support diagnostics prerequisite before provider writes:

- Local health reports include a `gmValueSync` aggregate readiness block.
- The block counts opt-in scripts, ready bundles, empty bundles, aggregate
  warning IDs, value-read failures, total syncable keys, total estimated bytes,
  and the active caps.
- The block explicitly reports `providerWritesEnabled: false`.
- Diagnostics do not include GM values, value key names, script IDs, script
  names, URLs, local workspace handles, local paths, sync credentials, or
  provider account data.
- Support snapshots carry that aggregate block through the existing local-health
  path without requiring script inventory.

Cycle 98 wires the first provider-write path for CloudSync:

- CloudSync local envelopes can include a top-level `valueBundles` object keyed
  by script ID.
- Bundles are built only for scripts with `script.settings.syncValues === true`.
- The upload sanitizer rebuilds each bundle through the capped
  `buildGmValueSyncBundle()` contract before provider writes.
- Values still stay out of per-script records, `settings`, `storage`, local
  workspace metadata, support snapshots, and non-opted scripts.
- Dry-run previews report local opt-in count, local bundle count, remote bundle
  count, bundle warning count, and whether value bundles would upload.
- Downloaded remote value bundles are not applied to local GM storage yet.

Cycle 99 adds the downloaded-bundle apply gate without enabling local writes:

- Remote `valueBundles` are validated against the post-merge script set so
  remote-only scripts can be recognized only after their script records are
  present in the merged sync view.
- A remote bundle is eligible only when the schema is
  `scriptvault-gm-value-sync/v1`, the bundle key matches `bundle.scriptId`, the
  target script still has `script.settings.syncValues === true`, `values` is a
  plain object, and the capped bundle builder can rebuild the payload.
- Dry-run previews report eligible, ignored, and warning bundle counts and set
  `valueBundleApplyEnabled: false` plus `wouldApplyValues: false`.
- The dashboard preview displays only aggregate value-bundle counts. It does
  not display script IDs, value keys, or values.
- Real sync runs check remote bundle eligibility for aggregate diagnostics but
  still do not call a local GM value write path.

Cycle 100 enables the first downloaded-bundle write path:

- A valid remote bundle can be applied only after the script merge has completed
  and the current script still has `script.settings.syncValues === true`.
- The apply path reads local GM storage first and calls `ScriptValues.setAll()`
  only when the local value bag is empty.
- If local values are non-empty, the script is locally user-modified, value
  storage is unavailable, or a value write fails, the remote bundle is preserved
  in the upload envelope instead of being overwritten by the local bundle.
- Dry-run previews report empty-local apply-ready and conflict-blocked bundle
  counts. They do not expose script IDs, value keys, or values.

Cycle 101 adds aggregate real-sync outcome evidence:

- Successful `syncNow` responses can include a `valueBundleSync` summary.
- The summary reports only applied, preserved, conflict-blocked, unavailable,
  and failed bundle counts.
- The dashboard sync log appends those aggregate counts after real sync runs so
  empty-local applies and blocked non-empty merges are visible to the user.
- The result evidence does not include script IDs, script names, value key
  names, values, URLs, local workspace handles, local paths, sync credentials,
  or provider account data.

Cycle 102 adds blocked-merge dry-run preview evidence:

- Dry-run previews can include `valueBundleConflicts` entries when a remote GM
  value bundle is valid but cannot be applied because the local value bag is
  non-empty or the local value-bundle snapshot is unavailable.
- Each preview entry contains only a reason plus local/remote key counts and
  local/remote byte counts.
- Preview entries do not include script IDs, script names, value key names,
  values, URLs, local workspace handles, local paths, sync credentials, or
  provider account data.
- The preview remains non-writing. It does not change the empty-local-only apply
  rule and does not merge non-empty local and remote value bags.

Cycle 103 adds a sanitized preview export:

- The dashboard stores only a sanitized copy of the latest successful sync
  preview for the Download Preview action.
- The exported JSON uses schema `scriptvault-sync-preview/v1` and includes the
  provider label, dry-run/no-writes flags, safe summary counts, and sanitized
  `valueBundleConflicts` entries.
- The export omits normal script conflict IDs/names, script IDs, script names,
  value key names, values, URLs, local workspace handles, local paths, sync
  credentials, and provider account data.

Cycle 104 adds key-overlap counts for blocked merges:

- Blocked value-bundle preview entries now include overlapping, local-only, and
  remote-only key counts.
- The counts are computed from local and remote value bags only inside the
  preview path; the exposed preview and export still omit the key names and
  values.
- The extra counts are advisory metadata only. They do not enable non-empty
  merge writes or change the empty-local-only apply rule.

Cycle 105 adds real-sync blocked-reason summaries:

- Successful `syncNow` responses can report `skippedNonEmpty` and
  `skippedUserModified` alongside the aggregate `conflictBlocked` count.
- The dashboard sync log displays those two blocked reasons after real syncs.
- These are aggregate counts only. They do not include script IDs, script names,
  value key names, values, URLs, local workspace handles, local paths, sync
  credentials, or provider account data.

Cycle 106 adds aggregate last-write metadata:

- Future local GM value writes record row-level `updatedAt` values on
  `GM_setValue`/`ScriptValues.set` and `ScriptValues.setAll()`.
- `ScriptValues.getAllMetadata()` exposes only aggregate value count and the
  latest positive timestamp for a script's local value bag.
- `scriptvault-gm-value-sync/v1` bundles may carry optional
  `lastValueUpdatedAt`; upload and download sanitization rebuilds preserve the
  normalized timestamp while legacy bundles without the field remain valid.
- The timestamp is an advisory last-write signal only. It does not expose value
  key names or values and does not change the empty-local-only apply rule.

Cycle 107 surfaces aggregate timestamp evidence in previews:

- Blocked value-bundle dry-run preview entries can include
  `localLastValueUpdatedAt`, `remoteLastValueUpdatedAt`, and a coarse
  `lastWriteHint`.
- The dashboard renders the hint in the blocked merge preview and the Download
  Preview JSON export preserves only the sanitized timestamp fields and hint.
- The preview/export still omit script IDs, script names, value key names,
  values, URLs, local workspace handles, local paths, sync credentials, and
  provider account data.
- These fields are advisory conflict evidence only. They do not enable
  non-empty merge writes.

Cycle 108 adds aggregate timestamp evidence to real sync results:

- Successful `syncNow` responses can include preserved-bundle timestamp hint
  counts in `valueBundleSync`.
- The counters classify preserved remote bundles as remote-newer, local-newer,
  same timestamp, remote timestamp only, local timestamp only, or unknown.
- The dashboard sync log displays those counts only as aggregate totals.
- The response and log still omit script IDs, script names, value key names,
  values, URLs, local workspace handles, local paths, sync credentials, and
  provider account data.
- These counters are advisory evidence only. They do not enable non-empty merge
  writes.

Cycle 109 adds per-key timestamp metadata inside opt-in bundles:

- Value rows keep their existing `updatedAt` timestamp, and
  `ScriptValues.getAllKeyMetadata()` can return a `{ key: { updatedAt } }` map
  for the local value bag.
- `scriptvault-gm-value-sync/v1` bundles may include optional `keyMetadata`
  entries for keys that are actually included in `values`.
- `keyMetadata` is normalized and counted in the same per-script byte cap as the
  values, so oversized metadata cannot bypass the bundle budget.
- CloudSync upload and downloaded-bundle sanitization rebuild bundles through
  the capped builder and preserve only valid per-key timestamps for included
  keys.
- Sanitized previews, preview exports, real-sync summaries, support-safe logs,
  and dashboard text still omit value key names and values.
- These fields are advisory merge inputs only. They do not enable non-empty
  merge writes.

Cycle 110 adds per-key timestamp summaries to blocked previews:

- Blocked value-bundle preview entries count overlapping keys by timestamp
  relationship: remote-newer, local-newer, same timestamp, remote timestamp
  only, local timestamp only, or unknown.
- The dashboard renders those counts and the Download Preview JSON export keeps
  only the sanitized counts.
- The preview/export still omit script IDs, script names, value key names,
  values, URLs, local workspace handles, local paths, sync credentials, provider
  account data, and raw `keyMetadata` maps.
- These counts are advisory conflict evidence only. They do not enable
  non-empty merge writes.

Cycle 111 adds stale-bundle diagnostics to dry-run previews:

- Dry-run summaries count local and remote value bundles with aggregate
  timestamps versus missing timestamps.
- When `lastSync` is known, dry-run summaries also count local and remote value
  bundles older than last sync and newer than last sync.
- The dashboard preview renders those counts as aggregate timestamp diagnostics.
- The preview/export still omit script IDs, script names, value key names,
  values, URLs, local workspace handles, local paths, sync credentials, and
  provider account data.
- These counts are advisory evidence only. They do not enable non-empty merge
  writes.

Cycle 112 adds non-writing candidate merge plans to blocked previews:

- Blocked value-bundle preview entries include `candidateMergePlan` plus
  `candidateRemoteKeyCount`, `candidateLocalKeyCount`,
  `candidateSameTimestampKeyCount`, and `candidateManualKeyCount`.
- Candidate counts are derived from the existing local-only, remote-only, and
  per-key timestamp overlap counts. They are advisory only.
- The dashboard preview and Download Preview export keep only the plan label and
  aggregate counts. They still omit script IDs, script names, value key names,
  values, URLs, local workspace handles, local paths, sync credentials, provider
  account data, and raw `keyMetadata` maps.
- The preview remains non-writing. It does not enable non-empty local/remote
  merge writes or change the empty-local-only apply rule.

Cycle 113 adds an advisory candidate merge acceptance gate:

- Dry-run summaries count blocked candidate merges as ready, manual-review, or
  unavailable.
- A candidate is ready only when there are candidate keys and no same-timestamp,
  unknown-timestamp, or one-sided-timestamp overlap cases.
- Blocked value-bundle preview entries and Download Preview exports include
  only `candidateMergeGate`, `candidateMergeBlockReason`, and
  `candidateOneSidedTimestampKeyCount` in addition to the existing aggregate
  candidate counts.
- The preview/export still omit script IDs, script names, value key names,
  values, URLs, local workspace handles, local paths, sync credentials, provider
  account data, and raw `keyMetadata` maps.
- The gate is advisory only. It does not enable non-empty local/remote merge
  writes or change the empty-local-only apply rule.

Cycle 114 adds manual-review reason diagnostics:

- Dry-run summaries count candidate merge block reasons for same timestamps,
  unknown timestamps, one-sided timestamps, unavailable local snapshots, and
  no-candidate cases.
- The dashboard preview and Download Preview export carry only those aggregate
  reason counts.
- A focused manual-review fixture pins that unknown per-key timestamp overlaps
  are counted without exposing script IDs, script names, value key names,
  values, URLs, local workspace handles, local paths, sync credentials, provider
  account data, or raw `keyMetadata` maps.
- These diagnostics are advisory only. They do not enable non-empty
  local/remote merge writes or change the empty-local-only apply rule.

Cycle 115 adds candidate merge result dry-run evidence:

- Dry-run summaries count total hypothetical result keys, auto-selected keys,
  and review keys across blocked candidate merges.
- Blocked value-bundle preview entries and Download Preview exports include
  only `candidateResultKeyCount`, `candidateAutoSelectedKeyCount`, and
  `candidateReviewKeyCount` alongside the existing aggregate candidate evidence.
- Result counts are derived from local-only, remote-only, and overlap counts;
  they do not expose script IDs, script names, value key names, values, URLs,
  local workspace handles, local paths, sync credentials, provider account data,
  or raw `keyMetadata` maps.
- The result preview is advisory only. It does not enable non-empty local/remote
  merge writes or change the empty-local-only apply rule.

Cycle 116 adds preserved-bundle candidate summaries to real sync results:

- Successful `syncNow` responses can include preserved candidate merge readiness
  counts for ready, manual-review, and unavailable preserved remote bundles.
- The summary also includes preserved candidate result key totals, auto-selected
  key totals, and review key totals.
- The dashboard sync log renders those counts only as aggregate totals.
- The response and log still omit script IDs, script names, value key names,
  values, URLs, local workspace handles, local paths, sync credentials, provider
  account data, and raw `keyMetadata` maps.
- These summaries are advisory only. They do not enable non-empty local/remote
  merge writes or change the empty-local-only apply rule.

Cycle 117 adds preserved-bundle manual-review reason summaries:

- Successful `syncNow` responses can include preserved candidate block reason
  counts for same timestamps, unknown timestamps, one-sided timestamps,
  unavailable local snapshots, and no-candidate cases.
- The dashboard sync log renders those reason counts only as aggregate totals.
- The response and log still omit script IDs, script names, value key names,
  values, URLs, local workspace handles, local paths, sync credentials, provider
  account data, and raw `keyMetadata` maps.
- These summaries are advisory only. They do not enable non-empty local/remote
  merge writes or change the empty-local-only apply rule.

Cycle 118 hardens sanitized preview and export counts:

- Dashboard preview and Download Preview sanitization now floors fractional
  summary and value-bundle conflict counts to non-negative integers.
- Negative, missing, non-numeric, or malicious count-like values collapse to
  zero before they can appear in the sanitized export payload.
- The hardening applies only to aggregate count and byte metrics. The export
  still omits script IDs, script names, value key names, values, URLs, local
  workspace handles, local paths, sync credentials, provider account data, and
  raw `keyMetadata` maps.
- This is an export/preview integrity guard only. It does not enable non-empty
  local/remote merge writes or change the empty-local-only apply rule.

Cycle 119 adds a merge-acceptance invariant guard:

- Candidate merges can report `ready` only when auto-selected local/remote keys
  cover the whole hypothetical result key count.
- The same ready gate requires `reviewKeyCount === 0`, so same-timestamp,
  unknown-timestamp, and one-sided timestamp cases remain manual-review.
- The guard is mirrored in `src/background/cloud-sync.ts` and
  `src/background/core.ts` and regenerated into the runtime bundle.
- This is still advisory gating. It does not enable non-empty local/remote merge
  writes or change the empty-local-only apply rule.

Cycle 120 adds an export schema drift guard:

- `tests/sync-cockpit.test.js` now pins the exact top-level
  `scriptvault-sync-preview/v1` export keys.
- The same fixture pins the exact sanitized summary keys and value-bundle
  conflict entry keys.
- Extra top-level, summary, script, value-key, and value fields are still
  rejected by redaction assertions.
- This guard catches accidental export schema expansion or field loss before a
  future merge implementation can depend on preview output.

Cycle 121 adds accepted-result evidence:

- Dry-run summaries now include
  `remoteValueBundleCandidateAcceptedResultKeyTotal`, counting only ready
  candidate result keys.
- Real `syncNow` value-bundle summaries now include
  `preservedCandidateAcceptedResultKeyTotal`, again counting only ready
  preserved candidate result keys.
- Dashboard preview/export rendering and the sync log show the accepted-ready
  count beside total, auto-selected, and review key totals.
- These are aggregate-only evidence fields. They do not enable non-empty
  local/remote merge writes or change the empty-local-only apply rule.

Cycle 122 adds a preview-only merge simulation marker:

- Blocked value-bundle preview entries now include `candidateMergeSimulation`.
- Ready candidates report `ready-preview-only`, manual-review cases report
  `manual-review`, and unavailable local snapshots report `unavailable`.
- The dashboard preview and sanitized Download Preview export carry only that
  coarse simulation label beside aggregate counts.
- The label is advisory and non-writing. It does not enable non-empty
  local/remote merge writes or change the empty-local-only apply rule.

Cycle 123 adds merge simulation aggregate totals:

- Dry-run summaries and sanitized exports now include ready-preview-only,
  manual-review, and unavailable candidate merge simulation counts.
- The dashboard preview renders those totals separately from the existing
  candidate gate counts.
- The totals are aliases of the current advisory gate state; they do not enable
  non-empty local/remote merge writes or change the empty-local-only apply rule.

Cycle 124 adds merge simulation result-key totals:

- Dry-run summaries and sanitized exports now group hypothetical candidate
  result key totals by ready-preview-only, manual-review, and unavailable
  simulation states.
- The dashboard preview renders those result-key totals separately from both
  simulation counts and the existing total/auto-selected/review/accepted key
  totals.
- The totals are aggregate only and remain advisory. They do not enable
  non-empty local/remote merge writes or change the empty-local-only apply rule.

Cycle 125 hardens sanitized export result invariants:

- Dashboard preview and Download Preview sanitization now clamp accepted-ready,
  auto-selected, review, and simulation result-key totals to the aggregate
  candidate result budget.
- Oversized or inconsistent summary totals cannot claim more accepted or
  simulated result keys than the aggregate dry-run result total after
  sanitization.
- This is an export/preview integrity guard only. It does not enable non-empty
  local/remote merge writes or change the empty-local-only apply rule.

Cycle 126 adds source-side simulation invariant coverage:

- The source CloudSync ready and manual-review preview fixtures now assert that
  simulation counts match candidate gate counts.
- The same fixtures assert that accepted-ready result totals match
  ready-preview-only result totals, and that auto-selected/review plus
  simulation result partitions match the aggregate candidate result total.
- This is regression coverage only. It does not enable non-empty local/remote
  merge writes or change the empty-local-only apply rule.

The next implementation slice should add preserved-result export safeguards,
source-side unavailable simulation invariant coverage, or another durable safeguard before non-empty
local and remote value bags can be merged bidirectionally.
