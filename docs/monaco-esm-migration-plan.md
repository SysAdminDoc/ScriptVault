# Monaco ESM Migration Plan

Last reviewed: 2026-06-06.

## Decision

Keep ScriptVault on the packaged Monaco AMD bundle for v3.12.0, and migrate
the Chromium editor to a bundled ESM build in a later X-4 implementation pass.
Do not load Monaco from a CDN, do not import Monaco ESM directly from browser
extension pages, and do not reintroduce Monaco into the Firefox AMO package
until the ESM worker chunks pass AMO lint.

## Current State

- `package.json` currently depends on `monaco-editor@^0.52.0`.
- `esbuild.config.mjs` copies `node_modules/monaco-editor/min` into
  `lib/monaco/`.
- `pages/editor-sandbox.html` loads `../lib/monaco/vs/loader.js` inside the
  manifest-declared sandbox iframe, then calls `require(['vs/editor/editor.main'])`.
- `pages/monaco-adapter.js` keeps the dashboard on a CodeMirror-compatible
  adapter surface and falls back to the textarea editor when Monaco fails.
- `build-firefox.sh` intentionally omits `lib/monaco/`; Firefox keeps the
  textarea fallback for AMO package validation.

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
   module script that imports the packaged ESM bundle.
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

- `npm run build` writes `lib/monaco-esm/editor.js` and deterministic worker
  chunks, and no longer copies the AMD `min/` tree for Chromium packages.
- `npm run build:prod` packages only local Monaco ESM assets.
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

## Non-Goals

- No CDN Monaco loading.
- No direct unbundled browser ESM import path.
- No dashboard dependency on Monaco internals.
- No Firefox Monaco packaging until AMO lint evidence is clean.
