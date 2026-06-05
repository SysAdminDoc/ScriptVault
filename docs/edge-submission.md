# Microsoft Edge Add-ons submission

ScriptVault publishes to the Microsoft Edge Add-ons store from the same
source tree as Chrome Web Store. Edge uses the Chromium codebase and
accepts the unmodified Chrome MV3 manifest in the vast majority of cases,
so the build is intentionally thin.

## Build

```
npm run build:edge          # build, transform, package
npm run build:edge:check    # same, plus fail on missing declared files
npm run build:edge:stage    # stage build-edge/ but skip the ZIP step
npm run smoke:edge          # build, load build-edge/ in Microsoft Edge, run smoke
```

Each invocation rebuilds `background.js` + the Monaco bundle via
`esbuild.config.mjs`, stages the package under `build-edge/`, applies a
small set of declarative manifest transformations (today: strip
`update_url`), runs a missing-file audit, and writes
`edge-artifacts/scriptvault-edge-v<version>.zip` plus a sidecar
`edge-build-<version>.json` report.

CI runs `npm run build:edge:check`, uploads `edge-artifacts/*`, and runs
`npm run support:matrix:check` after the Edge report exists. The browser
support matrix treats that report as the source of truth for Edge package
evidence and fails when the ZIP or report is missing.

`build-edge/` and `edge-artifacts/` are gitignored.

## Local browser smoke

`npm run smoke:edge` is the deterministic maintainer smoke for Microsoft Edge.
It runs `npm run build:edge:check`, loads the staged `build-edge/` directory
into Microsoft Edge through Puppeteer, opens the dashboard and popup extension
pages, enables Edge's per-extension "Allow User Scripts" toggle in the
temporary smoke profile when Edge exposes it, saves and toggles a smoke
userscript, verifies that script runs on a local `http://127.0.0.1` target page,
captures extension page/service-worker console errors, and writes
`edge-artifacts/edge-smoke-<version>.json`.

Set `SCRIPT_VAULT_EDGE_PATH` if Microsoft Edge is installed somewhere other
than the standard OS path. The command intentionally fails if Edge still reports
that `chrome.userScripts` is unavailable after the temporary-profile toggle
step or if the extension raises a runtime/page exception; fix that browser state
before treating the smoke as release evidence. Pass `-- --strict-console` when
you want ordinary `console.error` lines to fail the smoke instead of being
recorded in the evidence packet.

## Report fields

`edge-build-<version>.json` is the release evidence packet for Edge. It records:

- the staged build directory and Edge ZIP path;
- every manifest transform applied to the Chrome manifest;
- missing declared files, if any;
- `edgeReadiness` status for Chrome compatibility review, `update_url`
  removal, unsupported-API review, package automation, manual initial
  Partner Center publication, deferred REST update automation, and the local
  Edge sideload smoke command/evidence path;
- `reviewDeclarations` pointers for `PRIVACY.md`,
  `docs/store-listing-copy.md`, `docs/cws-remote-code-compliance.md`, this
  submission guide, and the Microsoft Edge documentation used for the current
  checklist.

## Manifest differences (current)

| Field                       | Chrome                                | Edge                                  | Action                          |
| --------------------------- | ------------------------------------- | ------------------------------------- | ------------------------------- |
| `manifest_version`          | 3                                     | 3                                     | None                            |
| `minimum_chrome_version`    | 130                                   | Honored — Edge maps to its Chromium    | None                            |
| `update_url`                | omitted                               | injected by Partner Center on publish | Generator strips it defensively |
| `host_permissions`          | identical                             | identical                             | None                            |
| `permissions`               | identical                             | identical                             | None                            |
| `optional_permissions`      | identical                             | identical                             | None                            |
| `service_worker`            | `background.js`                       | `background.js`                       | None                            |
| `browser_specific_settings` | not present (Firefox-only)            | not present                            | None                            |

If Edge ever drops a permission Chrome ships, add it to
`EDGE_TRANSFORMS.removePermissions` (or `removeOptionalPermissions`) in
`scripts/build-edge.mjs`.

## Unsupported permissions / features

As of Edge 130, the following Chrome MV3 permissions behave identically:

- `sidePanel` — Edge supports the side panel API.
- `offscreen` — Edge supports offscreen documents.
- `userScripts` — Edge supports the userScripts API on Edge 132+.
- `declarativeNetRequest{,WithHostAccess}` — supported.
- `chrome.identity` — supported with a separate redirect URL.

If Edge introduces a divergence, document it here and add the matching
transform.

## Submission checklist

The Microsoft Partner Center submission flow is manual. Run through this
checklist before pressing "Submit for review":

- [ ] `npm run release:check` (or `release:check:public`) is green.
- [ ] `npm run build:edge:check` produced a ZIP without missing files.
- [ ] `npm run smoke:edge` passed on Microsoft Edge and wrote
      `edge-artifacts/edge-smoke-<version>.json`.
- [ ] `npm run support:matrix:check` is green after the Edge report exists.
- [ ] Loaded the staged `build-edge/` directory manually via
      `edge://extensions` → "Load unpacked" only if the automated smoke needs
      human follow-up.
- [ ] Verified `chrome.userScripts` registration works through the automated
      smoke evidence (Edge 132+ ships the API; 131 or earlier silently no-ops).
- [ ] Confirmed offscreen document creation works for AST analysis +
      3-way merge.
- [ ] Edge submission listing has up-to-date screenshots (re-capture if
      UI changed since the last release per the screenshots gate).
- [ ] Privacy notice references the same shipping permissions as Chrome.
- [ ] Store listing reuses the canonical short description and matches
      the Chrome listing (CWS 132-character cap also keeps Edge safe).
- [ ] Remote-code declaration says the extension does not execute remote
      code from extension pages/service worker; use
      `docs/cws-remote-code-compliance.md` as the reviewer memo.
- [ ] Permission, data-use, and privacy declarations match
      `docs/store-listing-copy.md` and `PRIVACY.md`.
- [ ] Categorize as "Productivity → Tools" to match the Chrome listing.
- [ ] Upload the produced ZIP and the matching `edge-build-<version>.json`
      and `edge-smoke-<version>.json` reports for traceability (Partner
      Center accepts arbitrary attachments in the support notes).

## Publication and update automation

Initial Edge Add-ons publication still requires a Microsoft Partner Center
developer account and manual ZIP upload. The generated report intentionally
labels this as manual until a live listing exists. Partner Center publication
remains manual even when `npm run smoke:edge` passes locally.

After initial publication, Microsoft's Edge Add-ons REST API can update a
published extension package. ScriptVault defers that automation until listing
identifiers, API credentials, and a safe credential-custody model are available.
Do not add long-lived Edge publisher credentials to CI before that custody
work is designed.

## Post-publish

- Update `docs/cross-browser-pipeline.md` and the README "Supported
  browsers" matrix to mark the Edge listing as live.
- Re-run `npm run support:matrix:check` so the README + cross-browser
  doc matrix encodes the new Edge release timestamp.
- The Edge Add-ons store performs its own automated review (anti-malware,
  permissions audit); response time is usually 24–72 hours. If the review
  flags a permission, document it in the table above and ship a follow-up
  with the matching transform.
