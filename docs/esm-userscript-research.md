# ESM userscript + local-dev mode research

Last reviewed: 2026-05-24. **Decision: do not enable ESM userscripts by
default. Phase R-1 shipped as a disabled-by-default install-time bundler.**

## 1. Problem statement

Existing ScriptVault userscripts are classic IIFE/script bodies that
mutate the host page synchronously. The userscript community is asking
for two related capabilities:

1. **ESM userscripts** — author scripts as ES modules with
   `import` / `export`, including remote ESM dependencies fetched at
   runtime (`@require` against `https://esm.sh/...`, `https://unpkg.com/.../+esm`).
2. **Local-dev mode** — point ScriptVault at a watched local file (or
   `localhost` dev server) so userscript authors get sub-second iteration
   without an Install → Reload cycle.

Neither maps cleanly to the existing Chrome MV3 `chrome.userScripts.register`
contract or to ScriptVault's wrapper builder, but both have working
references in adjacent projects (Violentmonkey ESM via `@require`,
Tampermonkey's dev port). This doc identifies the compatibility model,
CSP constraints, security implications, and a phased migration strategy.

## 2. Compatibility model

`chrome.userScripts.register` only accepts plain scripts as
`js: [{ code }]`. ES modules are not a first-class injection target — the
runtime has no `js: [{ module: true, code }]` option. Two viable
shapes:

### Shape A: Bundle on install

When a script declares `@inject-into module` (Violentmonkey convention)
or `@module 1` (a new ScriptVault directive), the install handler
detects an ESM body and rewrites it into a non-ESM wrapper at install
time:

```js
const __exports = {};
(function (exports, require) {
  // user code, with `import x from 'url'` rewritten to `const x = require('url')`.
  ...
})(__exports, __require);
```

This pre-bundling step needs to:
- Recursively fetch transitive `import` URLs (e.g. `https://esm.sh/lodash`)
  with the same SRI verification ScriptVault already applies to
  `@require`.
- Inline the bundle into the registered script body so the runtime
  registration stays single-file.
- Refuse to bundle dynamic `import()` calls — those can only work at
  runtime (and pages forbid them under MV3 unless the source is hosted
  inside the extension, which is not the case here).

### Shape B: Inject a `<script type="module">` from a content script

A content script can call
`chrome.scripting.executeScript({ world: 'MAIN', files: [...] })`, but
that injects classic scripts. The only way to run page-context ESM is to
inject a `<script type="module">` element with `src=` pointing at an
extension-internal URL. This bypasses `userScripts` entirely and trades
the per-script worldId isolation for `MAIN` world execution. **Rejected**
for security reasons (no isolation between scripts, no GM_* sandboxing).

**Choose Shape A** as the only sustainable path.

## 3. CSP constraints

The CSP gate is the biggest hard wall:

| CSP scenario                          | Bundle install   | Runtime fetch (dynamic `import()`) |
| ------------------------------------- | ---------------- | ---------------------------------- |
| Site CSP allows `connect-src`         | Works            | Works                              |
| Site CSP `connect-src 'self'`         | Works (fetch happens from service worker, not page) | **Blocked** |
| Site CSP `script-src 'none'`          | Works (we don't add `<script>`) | N/A                          |
| Site CSP `script-src 'self'`          | Works (wrapper runs in USER_SCRIPT world)            | N/A                          |
| Site CSP `worker-src 'self'`          | N/A — we don't spawn workers                         | N/A                          |
| MV3 extension CSP `default-src 'self'`| Bundle stored in chrome.storage, not fetched live   | Blocked                      |

Net: pre-bundling at install time sidesteps both the page CSP and the
extension CSP because the wrapped code is stored as a plain JS string in
`chrome.storage.local`. Dynamic `import()` is permanently off the table.

## 4. Security implications

- Each transitive ESM dependency must pass the existing `@require` /
  `@resource` audit gates: SRI hash verification, host allowlist,
  bounded fetch (`_fetchTextBounded`). Removing any of these for ESM
  would create an unbounded supply-chain vector.
- The bundler must not execute remote code during install. Static
  rewriting only (regex-based or via Acorn AST already shipped in
  `offscreen.js`).
- Versioning: stash each bundled snapshot inside `script.versionHistory`
  with `source: 'esm-bundle'` so a re-bundle on update is rollback-able
  by the receipts mechanism that just shipped.
- A new "ESM bundle ratio" diagnostic should land alongside the feature
  so authors can see how many bytes of bundled dependencies are stored
  per script.

## 5. Local-dev mode

A second use case shares plumbing with ESM but is conceptually distinct:
authors want a local source of truth (a file under
`%USERPROFILE%\repos\my-script\index.user.js`) and a dev signal that
reloads the script when the source changes.

### Option 1: Watch via filesystem (not viable in MV3)

`chrome.fileSystem` does not exist in MV3 (only in Chrome Apps), and
`File System Access` requires explicit per-session user activation.
Polling a `file://` URL is blocked by MV3 host permissions.

### Option 2: `localhost` dev server (viable)

A userscript author runs `npx scriptvault-dev` on `http://localhost:35729`.
The dev server:
- Exposes the current source at `http://localhost:35729/<script-id>.user.js`.
- Sends a `?manifest` endpoint that lists installed scripts pointing at it.
- Fires server-sent events on file change.

ScriptVault listens for the SSE stream (only when the user explicitly
adds `http://localhost:35729` to a new "Dev sources" allowlist) and
re-fetches + re-registers the script when notified. The user grants
host permission once.

### Option 3: Bookmarklet-style dev URL paste

Userscript authors can already paste a `https://raw.githubusercontent.com/...`
URL via the dashboard. Local dev mode is a thinner version of the same:
paste a localhost URL, click "Install", and ScriptVault hot-reloads on
SSE.

**Choose Option 2 (SSE) + reuse Option 3's install path.** Implementation
fits the existing install/update plumbing.

## 6. Migration strategy

Phased, all gated behind off-by-default settings:

| Phase | Deliverable                                                                                 | Risk |
| ----- | ------------------------------------------------------------------------------------------- | ---- |
| R-1   | **Shipped 2026-05-24.** Disabled-by-default install-time bundler (Shape A) with Acorn-based rewrite. | Med  |
| R-2   | New `@module 1` parser directive + dashboard "ESM" badge.                                   | Low  |
| R-3   | Receipts integration so an ESM bundle is rollback-able via the existing rollbackRestore path. | Low  |
| R-4   | Dev-mode SSE listener — opt-in per host under a new "Developer mode" panel.                 | Med  |
| R-5   | Enable by default after at least one extension release cycle of dogfooding.                 | High |

Every phase ships **with the feature flag default-off** so the broader
extension keeps the current security posture even if the bundler has a
bug.

## 7. Open questions

- Does Violentmonkey's ESM convention (`@inject-into module`) win as the
  community standard, or do we need a ScriptVault-specific `@module 1`?
- Should the bundler accept HTTP imports without SRI when the import
  comes from a curated registry (esm.sh, jsdelivr) and reject everything
  else? Plays into the install-source badge work that just shipped.
- For dev mode: should we require both `http://localhost` AND a
  per-session token in the URL (`http://localhost:35729/<token>/...`)
  to prevent another extension on the same machine from MITM-ing a dev
  reload?

## 8. Disabled proof-of-concept tests

Two test files were added with the phase-R-1 implementation:

- `tests/esm-bundler.test.js` — asserts that `import x from 'esm.sh/foo'`
  is rewritten into a local `const x = __require(...)` wrapper and that
  the transitive set is bundled.
- `tests/esm-csp.test.js` — asserts that the bundler refuses dynamic
  `import()` and emits a parse error so an author sees the gap at
  install time.

## 9. Decision

- **ESM userscripts:** approved as a phased, off-by-default feature.
  R-1 is implemented; reject the runtime injection shape (Shape B).
- **Local-dev mode:** approved as the SSE + localhost host-permission
  shape, gated on a separate Developer Mode panel.
- **Dynamic `import()`:** rejected permanently — pre-bundling is the
  only sustainable model under MV3 CSP.

R-1 still preserves the default runtime posture: ESM scripts are rejected
unless `experimentalESMUserscripts` is explicitly enabled. The follow-up
checkpoint is R-2 (dashboard "ESM" badge), then R-3 receipt/rollback
detailing for bundled snapshots.
