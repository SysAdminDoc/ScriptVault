# Monaco ESM Migration Plan

Last reviewed: 2026-06-06.

## Decision

ScriptVault now loads Monaco from the packaged ESM bundle for the Chromium
editor sandbox. Do not load Monaco from a CDN, do not import Monaco ESM
directly from privileged extension pages, and do not reintroduce Monaco into
the Firefox AMO package until the ESM worker chunks pass AMO lint.

## Current State

- `package.json` currently depends on `monaco-editor@^0.52.0`.
- `esbuild.config.mjs` builds `src/editor/monaco-esm-entry.ts` into
  `lib/monaco-esm/editor.js`.
- `pages/editor-sandbox.html` loads `../lib/monaco-esm/editor.css` and
  dynamically imports `../lib/monaco-esm/editor.js` inside the
  manifest-declared sandbox iframe.
- `pages/monaco-adapter.js` keeps the dashboard on a CodeMirror-compatible
  adapter surface and falls back to the textarea editor when Monaco fails.
- `build-firefox.sh` intentionally omits `lib/monaco/` and `lib/monaco-esm/`;
  Firefox keeps the textarea fallback for AMO package validation.
- `npm run monaco:package:check` pins this packaging contract so Chromium
  remains on the local ESM bundle, Firefox remains Monaco-free, and remote/CDN
  editor assets stay rejected.
- `npm run build:monaco:esm` builds ignored ESM assets under
  `lib/monaco-esm/`. `npm run monaco:esm:check` validates the post-build
  editor, CSS, font, and worker outputs.

## Source Findings

- Monaco 0.53.0 deprecated AMD support, stopped supporting the old unbundled
  browser-script-editor scenario, and directs browser users to ESM with a
  bundler such as Vite or webpack.
- Monaco 0.55.0 moved nested language namespaces to top-level namespaces and
  added the `lsp` namespace, so the migration should include type/API drift
  checks rather than only swapping files.
- The Monaco browser-extension discussion confirms direct browser ESM import
  is not a reliable no-bundler path because Monaco imports CSS and worker
  assets; the extension build should bundle.
- Firefox AMO lint remains a packaging constraint: large Monaco worker files
  can be accepted by the runtime but fail reviewer/linter parsing limits.

Primary sources:

- https://github.com/microsoft/monaco-editor/blob/main/CHANGELOG.md
- https://github.com/microsoft/monaco-editor/discussions/3908

## Target Architecture

1. Add a dedicated Monaco ESM bundle entrypoint for the sandbox iframe, for
   example `src/editor/monaco-esm-entry.ts`.
2. Bundle that entrypoint with esbuild into `lib/monaco-esm/editor.js`.
3. Emit Monaco worker chunks under `lib/monaco-esm/workers/` with deterministic
   filenames.
4. Replace the AMD loader block in `pages/editor-sandbox.html` with a local
   dynamic import of the packaged ESM bundle.
5. Configure `self.MonacoEnvironment.getWorkerUrl` or equivalent worker mapping
   to extension-local worker files; no blob workers and no remote URLs.
6. Keep `pages/monaco-adapter.js` as the dashboard contract so the dashboard
   does not depend on Monaco internals.

## CSP and Sandbox Requirements

- Keep Monaco inside `pages/editor-sandbox.html`, not an extension page with
  privileged APIs.
- Keep `extension_pages` CSP at `script-src 'self'`.
- Keep sandbox CSP self-contained. The ESM bundle must not require remote script
  URLs, remote CSS, dynamic CDN fetches, or runtime `eval`.
- If Monaco still needs worker blob URLs after bundling, stop and keep AMD for
  Chromium until a file-backed worker path is available.
- Continue treating the iframe channel as private to the dashboard and preserve
  the adapter-side `event.source === frame.contentWindow` check.

## Firefox and AMO

Firefox remains textarea-first until a separate package proof shows:

- `npm run firefox:package` exits with 0 errors and 0 notices.
- No packaged Monaco worker JS file exceeds the AMO linter's practical parsing
  limits.
- `npm run smoke:firefox` opens the editor, edits a script, saves it, and
  confirms fallback behavior when Monaco is unavailable.
- `AMO-SOURCE-README.md` and `docs/amo-vendored-libraries.md` explain the ESM
  bundle inputs, generated outputs, and reviewer rebuild command.

If any of those fail, keep omitting Monaco from Firefox packages and retain the
textarea fallback as the supported Firefox editor.

## Validation Plan

The X-4 implementation pass should add or update these gates:

- `npm run build` writes `lib/monaco-esm/editor.js`,
  `editor.css`, a codicon font asset, and deterministic worker chunks while
  no longer copying the AMD `min/` tree for the Chromium sandbox.
- `npm run build:prod` packages only local Monaco ESM assets.
- `npm run monaco:package:check` rejects `vs/loader.js`, `require.config`,
  `require(['vs/editor/editor.main'])`, remote/CDN editor URLs, and AMD copy
  steps in the Chromium build.
- `npm run monaco:esm:check` should stay green after `npm run build` or
  `npm run build:monaco:esm` and should be refreshed with
  `--write docs/audit/monaco-esm-prototype-2026-06-06.json` when the prototype
  output shape changes.
- A static test fails if `pages/editor-sandbox.html` references
  `vs/loader.js`, `require.config`, or CDN Monaco URLs.
- A browser smoke opens the dashboard editor, waits for `editor.isMonaco === true`,
  edits a script, saves it, reloads, and confirms the edit persisted.
- A fallback test removes or renames the ESM bundle and proves
  `pages/monaco-adapter.js` still activates the textarea path.
- `npm run cws:remote-code:check` continues to allow only packaged Monaco
  assets and rejects remote editor scripts.
- `npm run firefox:package` remains green; Firefox can stay textarea-only until
  the AMO proof above passes.

## Implementation Sequence

1. Prototype the ESM bundle without changing `pages/editor-sandbox.html`.
2. Measure bundle and worker file sizes for Chromium and Firefox packages.
3. Add the static AMD-removal and local-asset tests.
4. Switch Chromium sandbox loading from AMD to the ESM bundle.
5. Run dashboard editor smoke on Chromium.
6. Re-run Firefox package/smoke and decide whether Firefox keeps fallback or
   includes the chunked ESM bundle.
7. Only after those gates pass, update `package.json` to Monaco 0.55.x+ and
   handle the namespace/API drift in adapter or editor configuration tests.

Cycle 74 completed steps 1 and 2 for the installed Monaco 0.52.2 package.
`docs/audit/monaco-esm-prototype-2026-06-06.json` records the selected
full-worker Chromium strategy:

| Output | Bytes | Gzip bytes |
| --- | ---: | ---: |
| `lib/monaco-esm/editor.js` | 8,231,464 | 1,433,472 |
| `lib/monaco-esm/editor.css` | 158,378 | 23,224 |
| `lib/monaco-esm/assets/codicon-37A3DWZT.ttf` | 80,340 | 44,393 |
| `lib/monaco-esm/workers/editor.worker.js` | 555,624 | 116,865 |
| `lib/monaco-esm/workers/json.worker.js` | 856,164 | 170,016 |
| `lib/monaco-esm/workers/css.worker.js` | 1,883,186 | 303,112 |
| `lib/monaco-esm/workers/html.worker.js` | 1,264,765 | 242,013 |
| `lib/monaco-esm/workers/ts.worker.js` | 12,156,466 | 1,946,168 |
| **Total** | **25,186,387** | **4,279,263** |

The active budget is `maxTotalBytes: 26000000`, `maxTotalGzipBytes: 5000000`,
`editor.js <= 9000000`, and `ts.worker.js <= 13000000`. Cycle 76 switched the
Chromium sandbox to the ESM bundle while preserving the adapter fallback path.
The next slice should add a browser smoke that opens the dashboard editor,
waits for `editor.isMonaco === true`, edits a script, saves it, reloads, and
confirms the edit persisted.

## Non-Goals

- No CDN Monaco loading.
- No direct unbundled browser ESM import path.
- No dashboard dependency on Monaco internals.
- No Firefox Monaco packaging until AMO lint evidence is clean.
