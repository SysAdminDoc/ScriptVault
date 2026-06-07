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

Cycle 127 adds source-side unavailable simulation coverage:

- A source CloudSync preview fixture now covers the case where a remote value
  bundle targets an existing local script but no local value bundle exists.
- The fixture pins the unavailable gate, unavailable simulation label,
  local-bundle-unavailable reason, zero candidate result totals, and value/key
  redaction for that branch.
- This is regression coverage only. It does not enable non-empty local/remote
  merge writes or change the empty-local-only apply rule.

Cycle 128 hardens preserved-result log rendering:

- The dashboard real-sync log now floors preserved candidate counts to
  non-negative integers before rendering.
- Preserved auto-selected, review, and accepted-ready result-key totals are
  clamped to the aggregate preserved candidate result-key budget.
- This is a dashboard rendering integrity guard only. It does not enable
  non-empty local/remote merge writes or change the empty-local-only apply rule.

Cycle 129 adds source-side preserved candidate invariants:

- The source CloudSync non-empty and user-modified preserve fixtures now assert
  that preserved candidate gate totals match preserved bundle totals.
- The same fixtures assert that preserved auto-selected/review result
  partitions match aggregate preserved result totals, and that accepted-ready
  totals cannot exceed result or auto-selected totals.
- This is regression coverage only. It does not enable non-empty local/remote
  merge writes or change the empty-local-only apply rule.

Cycle 130 adds unavailable preserved-candidate coverage:

- A source CloudSync sync fixture now covers a value-storage failure after a
  remote opt-in value bundle merges onto a local script without a local value
  bundle.
- The fixture pins preserved unavailable gate counts, local-bundle-unavailable
  reason counts, zero candidate result totals, unknown timestamp evidence,
  remote-bundle preservation, and no value write.
- This is regression coverage only. It does not enable non-empty local/remote
  merge writes or change the empty-local-only apply rule.

Cycle 131 adds unavailable preserved-candidate log coverage:

- A sync cockpit formatter fixture now renders the unavailable preserved
  candidate path as aggregate-only real-sync log evidence.
- The fixture pins preserved/failure counts, unknown timestamp evidence,
  unavailable candidate gate counts, zero candidate result totals, and the
  unavailable local snapshot review reason.
- Injected script IDs, script names, value keys, values, and raw key metadata
  remain ignored by the formatter.
- This is dashboard rendering coverage only. It does not enable non-empty
  local/remote merge writes or change the empty-local-only apply rule.

Cycle 132 adds failure-only sync log safeguards:

- A sync cockpit formatter fixture now pins failure-only real-sync log
  sanitization for GM value sync summaries.
- Fractional unavailable/failure counts are floored, negative activity counts
  are dropped, blocked sub-reasons stay hidden when no blocked bundles exist,
  and injected script IDs, value keys, and values remain ignored.
- This is dashboard rendering coverage only. It does not enable non-empty
  local/remote merge writes or change the empty-local-only apply rule.

Cycle 133 adds unavailable preserved-candidate result invariants:

- A source CloudSync assertion helper now pins that unavailable preserved
  candidates map to the unavailable block reason.
- The same helper proves unavailable preserved candidates carry zero result,
  auto-selected, review, and accepted-ready key totals.
- This is regression coverage only. It does not enable non-empty local/remote
  merge writes or change the empty-local-only apply rule.

Cycle 134 adds empty-local write-failure coverage:

- A source CloudSync fixture now fails `ScriptValues.setAll()` after a remote
  GM value bundle is otherwise eligible for empty-local apply.
- The fixture pins aggregate failure reporting, remote-bundle preservation for
  retry, ready candidate result evidence, unchanged local values, and merged
  remote script code.
- This is regression coverage only. It does not enable non-empty local/remote
  merge writes or change the empty-local-only apply rule.

Cycle 135 adds write-failure dashboard log coverage:

- A sync cockpit formatter fixture now renders preserved-plus-failed write
  failure results as aggregate-only real-sync log evidence.
- The fixture pins ready candidate gates, accepted-ready result counts, unknown
  timestamp evidence, and redaction of injected identifiers, value keys, values,
  and raw key metadata.
- This is dashboard rendering coverage only. It does not enable non-empty
  local/remote merge writes or change the empty-local-only apply rule.

Cycle 136 adds ready result parity guards:

- A source CloudSync assertion helper now pins ready preserved-candidate result
  parity on the write-failure fixture.
- Ready preserved candidates must keep auto-selected and accepted-ready totals
  equal to the result-key budget with zero review keys.
- This is regression coverage only. It does not enable non-empty local/remote
  merge writes or change the empty-local-only apply rule.

Cycle 137 adds unknown timestamp parity guards:

- A source CloudSync assertion helper now pins no-timestamp preserved paths.
- Every preserved bundle in those fixtures must count as unknown timestamp
  evidence, while remote-newer, local-newer, same, remote-only, and local-only
  timestamp buckets remain zero.
- This is regression coverage only. It does not enable non-empty local/remote
  merge writes or change the empty-local-only apply rule.

Cycle 138 adds timestamp dashboard log clamping:

- The dashboard real-sync formatter now clamps preserved timestamp buckets to
  the aggregate preserved bundle total before rendering.
- A sync cockpit fixture proves injected remote-newer, local-newer, same,
  one-sided, and unknown timestamp counts cannot overstate aggregate evidence or
  expose script IDs, script names, value keys, values, or raw key metadata.
- This is dashboard rendering hardening only. It does not enable non-empty
  local/remote merge writes or change the empty-local-only apply rule.

Cycle 139 adds write retry-ready diagnostics:

- Real sync results now include aggregate `writeFailureRetryReady` evidence only
  when a remote bundle reached the empty-local write path and `ScriptValues.setAll`
  failed.
- Read failures remain generic failures and do not count as write retry-ready.
- The dashboard sync log renders the aggregate retry-ready count, clamps injected
  values to preserved/failure budgets, and still omits script IDs, script names,
  value keys, values, and raw key metadata.
- This is diagnostic hardening only. It does not enable non-empty local/remote
  merge writes or change the empty-local-only apply rule.

Cycle 140 adds retry preview evidence:

- The write-failure source fixture now runs a follow-up dry-run preview after
  the failed empty-local write preserves the remote value bundle.
- That preview must report the preserved remote bundle as applicable and
  apply-ready, keep `wouldApplyValues: true`, avoid provider uploads and value
  writes, and omit script IDs, value keys, and values from preview output.
- This is regression coverage only. It does not enable non-empty local/remote
  merge writes or change the empty-local-only apply rule.

Cycle 141 adds retry-ready support diagnostics:

- Last sync result persistence now stores sanitized aggregate `valueBundleSync`
  counts, including clamped `writeFailureRetryReady` evidence.
- Local health and the always-on support snapshot path expose only aggregate
  last-result counts and a retry-ready warning. They do not expose provider
  error text, script IDs, script names, value keys, values, URLs, file handles,
  local paths, or raw key metadata.
- This is diagnostic hardening only. It does not enable non-empty local/remote
  merge writes or change the empty-local-only apply rule.

Cycle 142 adds support snapshot allowlist hardening:

- The dashboard support snapshot sanitizer now rebuilds the `gmValueSync`
  local-health block from documented aggregate fields instead of copying the
  report object through unchanged.
- Last-result retry evidence is clamped to the preserved/failure budgets, and
  warning counts are limited to known GM value-sync warning IDs.
- The sanitized block forces the privacy envelope to exclude values, value key
  names, script IDs, script names, URLs, file handles, and local paths even if an
  injected or stale report contains additional fields.
- This is diagnostic hardening only. It does not enable non-empty local/remote
  merge writes or change the empty-local-only apply rule.

Cycle 143 adds support summary polish:

- Utilities diagnostics now cache the local-health report so the Support
  Snapshot card can summarize the same sanitized GM value-sync evidence before
  export.
- The summary reports only aggregate opt-in script counts, ready bundle counts,
  total key/byte counts, capped/excluded value warning totals, and
  retry-ready preserved-write counts.
- The UI summary relies on the support snapshot sanitizer and omits identifiers,
  value key names, values, provider account data, credentials, provider error
  text, URLs, file handles, local paths, and raw key metadata.
- This is diagnostic hardening only. It does not enable non-empty local/remote
  merge writes or change the empty-local-only apply rule.

Cycle 144 adds retry-age diagnostics:

- Local health last-result summaries now include aggregate retry-age minutes and
  a coarse retry-age bucket for retry-ready preserved writes.
- The only bucket values are `none`, `fresh`, `recent`, `stale`, `old`, and
  `unknown`; support snapshots force `none` whenever no write retry is ready.
- The Support Snapshot card labels retry-ready preserved writes with that safe
  age bucket while still omitting identifiers, value key names, values, provider
  account data, credentials, provider error text, URLs, file handles, local
  paths, and raw key metadata.
- This is diagnostic hardening only. It does not enable non-empty local/remote
  merge writes or change the empty-local-only apply rule.

Cycle 145 adds bounded retry-history diagnostics:

- Sync result persistence now maintains a five-entry `gmValueSyncRetryHistory`
  array in local extension storage.
- Each stored entry contains only aggregate timestamp, status, preserved count,
  failure count, and retry-ready write count; script IDs, script names, value key
  names, values, provider account data, credentials, provider error text, URLs,
  file handles, local paths, and raw key metadata are not stored.
- Local health and support snapshots expose only a summarized history block with
  entry counts, retry-ready event counts, failed-no-retry event counts, total
  retry-ready writes, and oldest/latest timestamps.
- The support dashboard summary reports recent retry-history event counts, and
  clear-all cleanup removes the retry-history key with the rest of local
  diagnostics state.
- This is diagnostic hardening only. It does not enable non-empty local/remote
  merge writes or change the empty-local-only apply rule.

Cycle 146 adds stale retry-history cleanup evidence:

- Retry history now has a seven-day retention window.
- Sync result persistence excludes stale retry entries when updating
  `gmValueSyncRetryHistory`, so old retry evidence cannot remain in the bounded
  local history indefinitely.
- Local health and support snapshots summarize only retained history entries and
  a stale-entry exclusion count. They do not include script IDs, script names,
  value key names, values, provider account data, credentials, provider error
  text, URLs, file handles, local paths, or raw `keyMetadata` maps.
- The Support Snapshot card reports stale retry-history events as aggregate
  excluded counts.
- This is diagnostic hardening only. It does not enable non-empty local/remote
  merge writes or change the empty-local-only apply rule.

Cycle 147 adds a write-retry resolution drill:

- The source CloudSync fixture now follows a transient failed empty-local value
  write through the preserved remote bundle preview and a second sync retry.
- The retry succeeds by applying the preserved remote bundle once local values
  are still empty and the transient `ScriptValues.setAll()` failure has cleared.
- The successful retry result omits `writeFailureRetryReady` and its serialized
  result does not include script IDs, value key names, values, provider account
  data, credentials, provider error text, URLs, file handles, local paths, or raw
  `keyMetadata` maps.
- This is verification hardening only. It does not enable non-empty local/remote
  merge writes or change the empty-local-only apply rule.

Cycle 148 adds retry-resolution health summaries:

- Sync result persistence now records a local `gmValueSyncRetryResolution`
  summary only when a clean retry applies a preserved remote bundle after recent
  retry-ready history.
- The record contains only aggregate applied count, prior retry-ready entry and
  write counts, timestamps, age bucket evidence, and privacy flags.
- Local health and support snapshots allowlist this resolution block and omit
  script IDs, script names, value key names, values, provider account data,
  credentials, provider error text, URLs, file handles, local paths, and raw
  `keyMetadata` maps.
- Clear-all cleanup removes `gmValueSyncRetryResolution` with the other local
  diagnostics keys.
- This is diagnostic hardening only. It does not enable non-empty local/remote
  merge writes or change the empty-local-only apply rule.

Cycle 149 adds stale retry-resolution cleanup:

- When sync result persistence does not write a fresh retry-resolution record, it
  removes stale or malformed `gmValueSyncRetryResolution` records from local
  extension storage.
- This keeps retry-resolution evidence on the same seven-day retention boundary
  as retry history and prevents hidden local diagnostics from retaining old
  aggregate resolution evidence indefinitely.
- This is diagnostic hardening only. It does not enable non-empty local/remote
  merge writes or change the empty-local-only apply rule.

Cycle 150 adds bounded resolution-history support evidence:

- Sync result persistence now maintains a five-entry
  `gmValueSyncRetryResolutionHistory` array in local extension storage.
- Each retained history entry contains only aggregate timestamp, applied count,
  prior retry-ready entry count, prior retry-ready write count, and latest retry
  timestamp evidence.
- Local health and support snapshots expose only a summarized resolution-history
  block with retained count, total applied count, total prior retry-ready counts,
  stale-entry exclusion count, oldest/latest timestamps, and privacy flags.
- Clear-all cleanup removes `gmValueSyncRetryResolutionHistory` with the other
  local diagnostics keys.
- This is diagnostic hardening only. It does not enable non-empty local/remote
  merge writes or change the empty-local-only apply rule.

The next implementation slice should add retry-resolution export hardening,
resolution-history stale cleanup, or another durable safeguard before non-empty
local and remote value bags can be merged bidirectionally.
