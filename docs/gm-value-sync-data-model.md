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

The next implementation slice should surface this timestamp safely in blocked
merge previews/results/exports, add per-key timestamp support, or add another
durable last-write signal before non-empty local and remote value bags can be
merged bidirectionally.
