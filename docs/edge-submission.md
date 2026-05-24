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
```

Each invocation rebuilds `background.js` + the Monaco bundle via
`esbuild.config.mjs`, stages the package under `build-edge/`, applies a
small set of declarative manifest transformations (today: strip
`update_url`), runs a missing-file audit, and writes
`edge-artifacts/scriptvault-edge-v<version>.zip` plus a sidecar
`edge-build-<version>.json` report.

`build-edge/` and `edge-artifacts/` are gitignored.

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
- [ ] Loaded the staged `build-edge/` directory via
      `edge://extensions` → "Load unpacked" and exercised the dashboard +
      popup + side panel + install flow.
- [ ] Verified `chrome.userScripts` registration works (Edge 132+ ships
      the API; 131 or earlier silently no-ops).
- [ ] Confirmed offscreen document creation works for AST analysis +
      3-way merge.
- [ ] Edge submission listing has up-to-date screenshots (re-capture if
      UI changed since the last release per the screenshots gate).
- [ ] Privacy notice references the same shipping permissions as Chrome.
- [ ] Store listing reuses the canonical short description and matches
      the Chrome listing (CWS 132-character cap also keeps Edge safe).
- [ ] Categorize as "Productivity → Tools" to match the Chrome listing.
- [ ] Upload the produced ZIP and the matching `edge-build-<version>.json`
      report for traceability (Partner Center accepts arbitrary attachments
      in the support notes).

## Post-publish

- Update `docs/cross-browser-pipeline.md` and the README "Supported
  browsers" matrix to mark the Edge listing as live.
- Re-run `npm run support:matrix:check` so the README + cross-browser
  doc matrix encodes the new Edge release timestamp.
- The Edge Add-ons store performs its own automated review (anti-malware,
  permissions audit); response time is usually 24–72 hours. If the review
  flags a permission, document it in the table above and ship a follow-up
  with the matching transform.
