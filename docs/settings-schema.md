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

Field-level validation has started on the highest-risk settings. Badge color,
lint maximum size, WebDAV/S3 endpoint URLs, denied hosts, and linter JSON now
have native constraints where applicable, text error nodes wired through
`aria-describedby`, `aria-invalid`, `setCustomValidity()`, and a shared
save-blocking validator in `pages/dashboard.js`.

Remaining work: extend the schema from classification-only metadata into
type/range/options/default/help metadata that can drive every visible Settings
control, not just the targeted high-risk fields.
