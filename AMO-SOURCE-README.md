# ScriptVault AMO Source Review Notes

Last verified: 2026-06-04.

This file is included in `firefox-artifacts/scriptvault-firefox-source-v<version>.zip`
because the Firefox package contains generated and minified runtime assets.
Mozilla reviewers should be able to rebuild the AMO upload package from this
source archive and compare it with `firefox-artifacts/scriptvault-firefox-v<version>.zip`.

Official references used for this checklist:

- https://extensionworkshop.com/documentation/publish/source-code-submission/
- https://extensionworkshop.com/documentation/publish/add-on-policies/
- https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/
- https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/permissions
- https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_Security_Policy

## Reviewer Build Instructions

Required tools:

- Node.js and npm. The package is tested with the repo's committed
  `package-lock.json`; use `npm ci` so dependency versions match.
- `bash` for `build-firefox.sh`. On Windows, the repo wrapper prefers Git Bash.
- Network access to npm's official registry for dependency installation.

Commands from a clean checkout or unpacked source ZIP:

```bash
npm ci
npm run firefox:package
```

Expected outputs:

- `firefox-artifacts/scriptvault-firefox-v<version>.zip`
- `firefox-artifacts/scriptvault-firefox-source-v<version>.zip`
- `firefox-artifacts/web-ext-lint.json`

`npm run firefox:package` runs these steps:

1. Checks `manifest-firefox.json` against `manifest-firefox.transformations.json`.
2. Builds `background.js` through `node esbuild.config.mjs --bg-only`.
3. Stages the Firefox build directory with `manifest-firefox.json` as
   `manifest.json`.
4. Runs `web-ext lint` and fails on any lint error.
5. Runs `web-ext build` to produce the AMO upload ZIP.
6. Writes the source-review ZIP using `git archive HEAD`.

## Source and Dependency Notes

- First-party generated runtime files are built from checked-in source and
  pinned by `npm run ts-runtime:check`.
- The Firefox package intentionally omits Monaco because the AMO package uses
  the textarea fallback path. The Chrome build still includes Monaco locally.
- Firefox package libraries are local files: `lib/acorn.min.js` and
  `lib/diff.min.js` for the background parser/merge fallback. The source
  archive includes the repo, `package.json`, and `package-lock.json`.
- Dependencies are installed through npm's official package manager path. Do not
  download third-party libraries from CDNs during review builds.
- Obfuscated code is not used. Minified/generated code is paired with this source
  archive and build instructions.

## AMO Listing Summary

Short description:

ScriptVault is a local-first userscript manager for installing, editing,
running, updating, backing up, and syncing user-selected userscripts.

Full description:

ScriptVault lets users manage their own website-specific scripts from a local
dashboard. Users can install scripts, review metadata before saving, edit code,
enable or disable scripts per site, export backups, restore archives, and use
WebDAV sync in the Firefox build. Script execution remains controlled by each
script's metadata and the user's enable/disable choices.

Firefox v1 scope:

- WebDAV sync is supported.
- Google Drive, Dropbox, OneDrive, and Easy Cloud OAuth sync are deferred until
  a dedicated Firefox identity/OAuth pass.
- The side panel and Chrome offscreen document APIs are feature-detected and
  hidden or replaced on Firefox.
- Monaco is omitted from the AMO package; the dashboard falls back to the
  editable textarea adapter.

## AMO Data Collection Copy

The Firefox manifest declares:

- Required data collection: `none`.
- Optional data categories: `authenticationInfo`,
  `technicalAndInteraction`, `websiteActivity`, and `websiteContent`.

Rationale:

- ScriptVault has no developer-operated analytics, telemetry, advertising,
  tracking pixels, remote configuration, account service, or server-side script
  storage.
- User data stays local unless the user exports it, installs or updates a script
  from a chosen URL, fetches a script-declared dependency/resource, uses a
  user-installed script network API, or configures sync.
- `authenticationInfo` applies only to user-configured provider authentication.
  The Firefox v1 package is WebDAV-only, so OAuth identity flows are not part of
  the current Firefox package.
- `technicalAndInteraction` covers local settings, diagnostics, support exports,
  backups, and sync metadata only when the user chooses those flows.
- `websiteActivity` and `websiteContent` are needed because a userscript manager
  must match pages and run user-installed scripts on user-selected sites. These
  data types leave the device only through user-selected script/resource/network
  behavior or user-configured export/sync behavior.

Canonical policy text:

- `PRIVACY.md`
- `docs/store-listing-copy.md`

## Permission Rationale

Firefox manifest surfaces:

- `storage`: stores installed scripts, settings, local values, cached
  dependencies, backups, and folders locally.
- `tabs`: reads active tab metadata for matching and user-triggered open-tab
  behavior.
- `notifications`: shows update, install, script, and sync results.
- `menus`: Firefox context-menu support for running scripts and opening tools.
- `scripting`: injects the content bridge and script support.
- `webNavigation`: observes document/frame lifecycle so scripts run at the
  configured timing.
- `unlimitedStorage`: prevents local library/cache/backup quota loss.
- `alarms`: schedules local update, sync, backup, and maintenance tasks.
- `downloads`: supports user-triggered downloads, exports, backups, and reports.
- `declarativeNetRequest` and `declarativeNetRequestWithHostAccess`: apply
  user-script-declared network rules only on matching sites.
- Optional `userScripts`: Firefox requires an explicit grant for the
  `USER_SCRIPT world`; ScriptVault asks only as part of the Firefox setup flow.
- Optional `clipboardWrite` / `clipboardRead`: supports user-triggered
  copy/paste/import/export actions and matching script APIs.
- Optional `cookies`: supports user-requested scripts that need cookie-aware
  requests for sites the user controls or chooses.
- `<all_urls>` host permission and content-script match: required because users
  can install scripts for arbitrary user-chosen sites; execution remains limited
  by script metadata and user controls.

`npm run store-copy:check` verifies that the current manifest permission and
data-collection surfaces remain covered by `PRIVACY.md`,
`docs/store-listing-copy.md`, and this AMO source review file.

## Manual Submission Steps

1. Confirm the AMO developer account exists under the intended publisher.
2. Run `npm run firefox:package`.
3. Upload `firefox-artifacts/scriptvault-firefox-v<version>.zip`.
4. Attach `firefox-artifacts/scriptvault-firefox-source-v<version>.zip` as the
   source code package.
5. Start as unlisted for internal signing/smoke validation.
6. Record any Mozilla review feedback in `FIREFOX-PORT.md` before changing code.
7. Move to listed only after the unlisted build passes install/smoke validation
   and review feedback is resolved.

Manual blockers:

- The AMO developer account, upload, review response, and listed-publication
  actions require maintainer credentials and cannot be completed by a
  credential-free build agent.
