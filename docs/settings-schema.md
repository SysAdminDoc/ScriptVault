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
a classification, when the schema keeps a stale key that no longer appears in
any checked surface, or when a visible/dashboard credential control lacks
metadata. It is wired into `npm run check` and CI so future settings UI or
storage edits cannot add unclassified persisted state or unmodeled visible
controls.

Visible and dashboard credential controls are described under the `metadata`
object. Each entry declares a storage type, control shape, label, help text,
default or runtime default source, select options where applicable, and
validation descriptors for the high-risk fields. The current schema has 106
metadata entries covering all classified visible settings plus credential
fields saved from the dashboard.

Field-level validation has started on the highest-risk settings. Badge color,
lint maximum size, WebDAV/S3 endpoint URLs, denied hosts, and linter JSON now
have native constraints where applicable, text error nodes wired through
`aria-describedby`, `aria-invalid`, `setCustomValidity()`, and a shared
save-blocking validator in `pages/dashboard.js`.

Remaining work: have the Settings UI consume this metadata directly and extend
field-specific validation beyond the targeted high-risk fields to the
allowlist/pattern text areas.
