# Locale coverage and forced language checks

ScriptVault ships three independent translation surfaces:

| Source                              | Type                          | Used by                                     |
| ----------------------------------- | ----------------------------- | ------------------------------------------- |
| `_locales/<code>/messages.json`     | Chrome MV3 `__MSG_*` strings  | manifest name/description, install warnings |
| `modules/i18n.js` `translations`    | Runtime inline dict           | service worker + UI when chrome.i18n is off |
| `pages/dashboard-i18n-v2.js`        | Dashboard inline dict         | dashboard v2 surfaces                        |

`scripts/check-locales.mjs` is the CI gate that keeps the three surfaces
honest. It enforces three checks:

1. **`_locales/` key parity** — every locale carries the same key set as
   `en`. Drift fails `--check` immediately because Chrome rejects the
   manifest upload when a `__MSG_*` lookup misses.
2. **Inline-dict key drift** — `modules/i18n.js` and
   `pages/dashboard-i18n-v2.js` should keep their non-`en` locales aligned
   with `en`. Informational by default (so the existing key drift in
   `modules/i18n.js` doesn't block unrelated work); fatal under `--strict`
   once the backfill PR lands.
3. **Cross-source locale-set agreement** — the locales listed under
   `_locales/`, in `modules/i18n.js`, and in `pages/dashboard-i18n-v2.js`
   should be the same set. A directory without runtime support, or a
   runtime locale missing from `_locales/`, surfaces as a "missing from"
   drift entry.

Translation-coverage shortfalls (a value equal to its English source) are
always **informational** — they tell us where translators still have work,
but they're never a CI failure.

## Commands

```
npm run locale:check         # report only
npm run locale:check:gate    # fail on _locales/ + cross-source drift
npm run locale:check:strict  # also fail on inline-dict drift
```

The JSON shape is stable so other tooling can consume it:

```
node scripts/check-locales.mjs --json
```

## What the report contains

- `sources.localesDir` — array of locale codes discovered under `_locales/`.
- `sources.runtimeI18n` — locale codes in `modules/i18n.js`.
- `sources.dashboardI18nV2` — locale codes in `pages/dashboard-i18n-v2.js`.
- `drifts[]` — per-drift entry, with `kind` ∈ {
  `locale-json-error`, `locale-key-drift`, `runtime-key-drift`,
  `dashboard-key-drift`, `cross-source-locale-mismatch` }, locale, plus
  `missing` / `orphaned` / `missingFrom` arrays.
- `warnings[]` — informational translation-coverage counts per non-`en`
  locale (`translated`, `untranslatedCount`, `total`).

## Adding a new language

1. Create `_locales/<code>/messages.json` cloned from `_locales/en` and
   translate every entry. `locale:check:gate` will fail until the key set
   matches.
2. Add the locale to the `translations` dictionary in both
   `modules/i18n.js` and `pages/dashboard-i18n-v2.js`.
3. Run `npm run locale:check` and resolve any drift entries.
4. Add the locale to the user-visible language picker.
5. Add a row to `tests/manifest-locales.test.js` if any new locale-specific
   length constraint needs pinning.

## Why not enforce inline-dict parity by default?

`modules/i18n.js` and `pages/dashboard-i18n-v2.js` predate the
`_locales/` directory and have historically been the second-class i18n
surface — runtime dictionaries serve features that don't live in the
manifest. The current dictionaries are missing ~70 keys per locale that
exist in `en`. Strict mode is opt-in until that backfill ships so this
gate doesn't block unrelated PRs; flip the CI workflow to
`locale:check:strict` once the dicts are aligned.
