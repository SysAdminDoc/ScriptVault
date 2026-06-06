# GM Value Sync Data Model

ScriptVault can already back up GM storage values through explicit local
backup/export flows. Cross-device cloud sync needs a stricter contract because
GM values may contain tokens, preferences, or site data written by scripts.

Cycle 96 adds the first opt-in data model slice:

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

The next implementation slice can wire `buildGmValueSyncBundle()` into provider
envelopes, then apply downloaded bundles only for scripts with the opt-in flag.
Conflict handling should stay conservative until the value store records per-key
timestamps or another durable last-write signal.
