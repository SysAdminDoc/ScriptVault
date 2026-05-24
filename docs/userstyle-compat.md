# Userstyle compatibility baseline

ScriptVault supports the UserCSS spec via `modules/userstyles.js` (and its
TS mirror at `src/modules/userstyles.ts`). This doc captures the
Chrome/Firefox compatibility baseline before any "advanced color
variables" work lands, so a regression doesn't silently break a feature
that already worked.

## Spec compliance

ScriptVault parses:

- The `==UserStyle==` / `==/UserStyle==` metadata block (standard Stylus
  shape).
- All six `@var` types: `color`, `text`, `number`, `select`, `checkbox`,
  `range`.
- Two variable substitution shapes:
  - `/*[[varName]]*/` placeholder (Stylus convention).
  - `var(--varName)` custom property (CSS-native).
- Multiple `@-moz-document` blocks (`domain(...)`, `regexp(...)`,
  `url-prefix(...)`).

## Chrome / Firefox runtime parity

| Surface                              | Chrome MV3                                   | Firefox MV3 (140+)                          |
| ------------------------------------ | -------------------------------------------- | ------------------------------------------- |
| `parseUserCSS` (metadata + @var)     | Identical (pure JS)                          | Identical (pure JS)                         |
| Variable substitution                | Identical (regex replace on installed CSS)   | Identical                                   |
| Injection — `chrome.scripting.insertCSS` | Supported                                | Supported                                   |
| Removal — `chrome.scripting.removeCSS`   | Supported                                | Supported                                   |
| Per-tab tracking                     | `_registeredTabs` Map keyed on `tabId`       | Same                                        |
| `@-moz-document` parsing             | Preserved verbatim in injected CSS           | Preserved verbatim (Firefox also honors)    |
| Stylus backup import                 | Supported                                    | Supported                                   |

Firefox honors `@-moz-document` natively; Chrome ignores it but the
selector rules underneath still match against the current tab URL.
ScriptVault matches the patterns ahead of injection on both engines so
the user-visible behavior is the same.

## Regression-fixture coverage

`tests/userstyle-compat-fixtures.test.js` exercises the parser against
seven representative UserCSS samples:

| Fixture                       | What it pins                                         |
| ----------------------------- | ---------------------------------------------------- |
| `basic`                       | No-variable baseline + missing-metadata error path   |
| `colorVar`                    | Multiple `@var color` entries                        |
| `selectVar`                   | `@var select` with pipe-separated options            |
| `rangeNumberCheckboxText`     | The other four `@var` types                          |
| `mozDocument`                 | `@-moz-document` blocks preserved verbatim           |
| `multiSection`                | Same variable referenced from multiple selectors     |
| `bilingualLabels`             | Non-ASCII labels + Japanese default values           |

Every fixture parses without error and produces the documented shape
(see `tests/userstyle-compat-fixtures.test.js`).

## What is intentionally NOT here

The roadmap explicitly defers "advanced color variables" until this
baseline is verified. The deferred capabilities include:

- HSL / OKLCH / OKLab color spaces (Stylus-2 spec).
- Linked color palettes (e.g. `@var color #group` collapsing to a
  single picker).
- Conditional `@var` directives based on `prefers-color-scheme`.
- Live preview while the user drags a color picker.

When that work begins, every new shape must add a fixture to
`tests/userstyle-compat-fixtures.test.js` and a row to the table above
before the parser code changes.

## Manual Firefox verification

The vitest fixtures run pure-JS parsing — no DOM, no chrome.scripting.
The runtime injection path uses `chrome.scripting.insertCSS`, which is
identical across Chrome MV3 and Firefox MV3 140+. A manual verification
pass is still required when:

- A new `@var` type lands (regression test must accompany).
- The `_substituteVariables` regex changes.
- `_buildCSS` changes its ordering or scoping behavior.

Manual steps:

1. `npm run firefox:lint` (must end with 0 errors / 0 notices).
2. Load the staged `build-firefox/` directory in Firefox via
   `about:debugging` → "Load Temporary Add-on".
3. Install a representative userstyle from
   `tests/userstyle-compat-fixtures.test.js` via the dashboard.
4. Confirm:
   - The Variables editor enumerates every `@var`.
   - Changing a color writes through to the rendered page.
   - Toggle off → the CSS removes cleanly.
   - Toggle on → it returns to the latest variable values.

Append the verification timestamp + Firefox version to this doc's
"Last verified" trailer when the manual pass completes.

**Last verified:** 2026-05-24 (parser fixtures only — manual Firefox pass
pending and tracked as a separate follow-up).
