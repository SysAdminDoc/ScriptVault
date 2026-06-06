# CWS Remote-Code Compliance Memo

**Last reviewed:** 2026-06-04  
**Applies to:** Chrome Web Store MV3 package built from `manifest.json`.

This memo separates ScriptVault's allowed userscript-manager behavior from
forbidden extension-page or service-worker remote code execution. It is intended
to be attached or referenced during Chrome Web Store review when the package is
submitted.

Policy references:

- Chrome Web Store Program Policies: https://developer.chrome.com/docs/webstore/program-policies/policies
- Chrome remote-hosted-code guidance: https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code
- Chrome `chrome.userScripts` API reference: https://developer.chrome.com/docs/extensions/reference/api/userScripts

## Reviewer statement

Extension service worker and extension pages do not execute remote logic directly.
All extension UI and service-worker code is packaged with the Chrome ZIP and is
covered by the extension-page CSP `script-src 'self'`.

ScriptVault is a userscript manager. Users can install or write script source,
and that user-provided code is registered through browser userscript surfaces or
runs in the userscript wrapper after an explicit user install/action. Remote
URLs used for installs, updates, dependencies, script search, OAuth, and sync
are data/configuration inputs for those user-selected workflows, not remote
extension application code.

The planned DOM-less @background runner remains dry-run only. Current code can
parse, classify, and report runner eligibility, but extension service worker,
extension pages, and the offscreen document do not execute `@background` script
bodies or wrapper payloads.

## Remote-code-capable flow map

| Flow | Allowed policy bucket | Runtime path | Guardrails |
|---|---|---|---|
| Installed userscript bodies | `chrome.userScripts` | `src/background/registration.ts`, generated `background.js` | User reviews and saves scripts first; per-script match/exclude metadata controls sites; Chrome runs the registered body in `USER_SCRIPT` world. |
| `@require` dependency bodies | `chrome.userScripts` / remote data, configuration, and resources | `src/background/resource-loader.ts`, `modules/resources.js`, `modules/npm-resolve.js`, generated `background.js` | Dependency URLs come from user-installed script metadata; SRI/provenance checks run where declared; internal-host and bounded-fetch gates protect fetches; dependency bytes are wrapped into the registered userscript body rather than extension UI code. |
| `GM_loadScript` | `chrome.userScripts` user-action script API | `src/background/wrapper-builder.ts`, generated `background.js` | Requires `GM_xmlhttpRequest` grant; the fetched bytes are delivered to the userscript wrapper and executed in the page/userscript context for that installed script, not as extension service-worker or extension-page logic. |
| Direct `.user.js` install and update URLs | Remote data, configuration, and resources | `src/background/install-handler.ts`, `src/background/update-checker.ts`, generated `background.js`, `pages/install.js` | URLs are script source data selected by the user or stored in script metadata; install/update review records source, trust, diff, size, internal-host, and provenance/SRI state before saving. |
| Script discovery surfaces | Remote data, configuration, and resources | `pages/dashboard-store.js`, `pages/dashboard-collections.js`, `pages/dashboard-gist.js` | Greasy Fork, OpenUserJS, GitHub, and Gist APIs return search/listing data or script source selected by the user. Responses are not loaded as extension-page scripts. |
| Sandboxed editor page | sandboxed editor page | `pages/editor-sandbox.html`, `pages/monaco-adapter.js` | Monaco loads from packaged `lib/monaco/` assets. The sandbox page has no extension API access and is isolated by the manifest `sandbox` declaration. |
| OAuth provider calls | Remote data, configuration, and resources | `modules/sync-providers.js`, `modules/sync-easycloud.js` | Google Drive, Dropbox, OneDrive, and Easy Cloud endpoints exchange auth and file data for user-enabled sync. Responses are parsed as JSON/data, not evaluated as extension code. |
| User-configured sync | User-configured sync | `modules/sync-providers.js`, `modules/sync-easycloud.js`, `src/background/cloud-sync.ts` | WebDAV/S3/OAuth sync uses user-provided endpoints or provider APIs to move settings, scripts, and backup data. Sync endpoints are guarded against internal-host access unless the user explicitly opts in. |
| DOM-less `@background` runner | Dry-run only | `src/background/background-runner*.ts`, `src/background/background-wrapper.ts`, generated `background.js` | Parser, planner, dry-run, support snapshots, and wrapper payload assembly are present for review. No offscreen/service-worker/user-code execution path is wired. The CWS scanner fails future `offscreen_background_run` eval/new Function wiring unless a compliant execution architecture is reviewed first. |
| Extension service worker and extension pages | Packaged local extension code only | `manifest.json`, `background.js`, `content.js`, `pages/*.js`, `offscreen.js` | Chrome package scan fails remote script tags, remote workers, remote `importScripts`, dynamic remote `import()`, and direct fetched-string eval/new Function patterns outside the documented userscript/sandbox paths. |

## Package scanner

Run the credential-free source/doc gate before release work:

```bash
npm run cws:remote-code:check
```

After `bash build.sh` creates the Chrome Web Store ZIP, scan the artifact that
will be uploaded:

```bash
npm run cws:remote-code:check -- --target ScriptVault-v3.11.0.zip
```

The scanner reads source/package text files or ZIP entries and fails on:

- Remote `<script src="https://...">` tags outside documented sandbox paths.
- Remote `new Worker(...)`, `new SharedWorker(...)`, or `importScripts(...)`.
- Dynamic `import("https://...")`.
- DOM-created script elements with remote `.js` sources.
- `eval`, `Function`, or `new Function` calls directly fed by a remote
  `fetch("https://...")` response.
- `@background` offscreen runner handlers that execute wrapper code in an
  extension context.

The scanner also checks that this memo, `docs/store-listing-copy.md`,
`docs/release-runbook.md`, `package.json`, and CI keep the CWS evidence command
wired.

## Reviewer checklist

Before CWS upload, attach or retain these artifacts with the release evidence:

1. `docs/cws-remote-code-compliance.md`.
2. Output from `npm run cws:remote-code:check`.
3. Output from `npm run cws:remote-code:check -- --target ScriptVault-vX.Y.Z.zip`.
4. Output from `npm run store-copy:check`.
5. The Chrome package ZIP generated by `bash build.sh`.
