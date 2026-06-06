# Settings Schema Contract

Status: active guard for ScriptVault settings drift.

`src/config/settings-schema.json` classifies every persisted setting key that is
present in one of these surfaces:

- `src/config/settings-defaults.json`
- `src/types/settings.ts`
- dashboard settings save handlers in `pages/dashboard.js`

The classification buckets are:

- `visible` - user-facing settings, including values currently surfaced in the
  dashboard and user-facing settings stored by background flows.
- `credential` - secrets, tokens, passphrases, account identifiers, and trust
  material that must stay redacted by backup/export flows unless explicitly
  requested.
- `timestamp` - last-run or last-check bookkeeping.
- `internal` - implementation state not meant for direct editing.
- `derived` - account/status objects derived from provider state.
- `deprecated` - intentionally retained legacy keys.

Run:

```bash
npm run settings:schema:check
```

The checker fails when a default, TypeScript field, or dashboard-saved key lacks
a classification, or when the schema keeps a stale key that no longer appears in
any checked surface. It is wired into `npm run check` and CI so future settings
UI or storage edits cannot add unclassified persisted state.

This is the schema-parity foundation for the next settings validation pass. The
field-level UI work should build on this inventory by adding native constraints,
custom text errors, and save-blocking validation for badge colors, numeric
limits, provider URLs, host lists, and JSON fields.
