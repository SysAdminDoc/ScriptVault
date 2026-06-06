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

The next implementation slice can apply downloaded bundles only for scripts with
the opt-in flag and a conflict-safe value state. A first apply pass should stay
limited to an empty-local-store case, or wait for per-key timestamps or another
durable last-write signal before merging non-empty local and remote values.
