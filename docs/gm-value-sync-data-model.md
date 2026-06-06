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

The next implementation slice can wire `buildGmValueSyncBundle()` into
CloudSync preview/upload with the same per-script opt-in and caps, then apply
downloaded bundles only for scripts with the opt-in flag. Conflict handling
should stay conservative until the value store records per-key timestamps or
another durable last-write signal.
