<p align="center">
  <img src="images/ScriptVault-192x192.png" alt="ScriptVault" width="128" height="128">
</p>

<h1 align="center">ScriptVault</h1>

<p align="center">
  <strong>A powerful, open-source userscript manager built on Chrome Manifest V3</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-3.19.1-22c55e?style=flat-square" alt="Version">
  <img src="https://img.shields.io/badge/manifest-v3-60a5fa?style=flat-square" alt="Manifest V3">
  <img src="https://img.shields.io/badge/license-MIT-orange?style=flat-square" alt="License">
  <img src="https://img.shields.io/badge/chrome-130%2B-blue?style=flat-square" alt="Chrome 130+">
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/scriptvault/jlhdbkeijcbgnonpfkfkkkhfmbeejkgh">Chrome Web Store</a> &bull;
  <a href="#features">Features</a> &bull;
  <a href="#installation">Installation</a> &bull;
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#security-model">Security</a> &bull;
  <a href="#contributing">Contributing</a>
</p>

---

## Project Planning And Research

Project planning is kept in local-only markdown files in the working checkout.

- `ROADMAP.md` - single source of truth for incomplete planned work.
- `RESEARCH.md` - consolidated research conclusions and evidence.
- `CHANGELOG.md` - shipped release ledger.

## Features

### Professional Security Workbench

ScriptVault uses a focused desktop workbench with a persistent navigation rail,
live vault health metrics, dense script controls, and a contextual trust/access
inspector. The popup, side panel, install review, DevTools diagnostics, and
full-screen editor share the same accessible four-theme surface system. Dark,
light, Catppuccin, and OLED dashboard layouts are protected by browser-rendered
visual regression baselines.

### GM API &mdash; 35+ Functions

Full Greasemonkey/Tampermonkey API compatibility with promise-based `GM.*` async variants.

| Storage | Network | UI | Utilities |
|---------|---------|-----|-----------|
| `GM_getValue` | `GM_xmlhttpRequest` | `GM_addStyle` | `GM_info` |
| `GM_setValue` | `GM_download` | `GM_notification` | `GM_log` |
| `GM_deleteValue` | `GM_webRequest` | `GM_registerMenuCommand` | `GM_setClipboard` |
| `GM_listValues` | | `GM_unregisterMenuCommand` | `GM_openInTab` |
| `GM_getValues` | | `GM_getMenuCommands` | `GM_getResourceText` |
| `GM_setValues` | `GM_webSocket` | `GM_addElement` | `GM_getResourceURL` |
| `GM_deleteValues` | `GM_head` | `GM_loadScript` | `GM_cookie` |
| `GM_addValueChangeListener` | `GM.fetch` | `GM_audio` | `GM_focusTab` |
| `GM_removeValueChangeListener` | | | |

Plus `GM_getTab`, `GM_saveTab`, `GM_getTabs` for cross-tab state, `window.close`, `window.focus`, `window.onurlchange` grants, `@top-level-await`, `@delay`, and `@nodownload` support.

TypeScript userscripts can reference `lib/scriptvault.d.ts` for generated ambient declarations that match ScriptVault's GM API surface.

`GM.fetch` returns a Fetch-compatible `Response`; modern browser contexts expose `res.body` as a `ReadableStream` so scripts can read cross-origin responses chunk-by-chunk while ScriptVault still applies the script's `@connect` hosts and internal-host guards. Older contexts fall back to the existing `GM_xmlhttpRequest` response path.

Scripts can opt into a per-script isolated cookie jar with `@isolationCookie`.
ScriptVault maps that script to a deterministic CHIPS partition for `GM_cookie`,
`GM_xmlhttpRequest`, and `GM_download` cookie routing; explicit `partitionKey`
or `cookiePartition` options still override the automatic jar.

#### SPA URL Changes

Scripts that need to re-run on soft navigation can grant `window.onurlchange`.
ScriptVault dispatches it for Navigation API route changes, history updates,
`popstate`, and `hashchange` without requiring an extra extension permission.
Keep handlers idempotent and re-check the DOM when the target app renders
asynchronously:

```javascript
// ==UserScript==
// @grant window.onurlchange
// ==/UserScript==
function apply() {
  // Rebind or refresh page-specific UI here.
}
window.addEventListener('urlchange', ({ url, oldUrl }) => {
  apply();
});
apply();
```

#### Trusted Types and MAIN-world DOM Writes

Most ScriptVault scripts run in the browser `USER_SCRIPT` world. That world is
separate from the page Trusted Types policy, so `GM_addElement`, `GM_addStyle`,
and normal DOM creation keep working on sites that enforce
`require-trusted-types-for 'script'`.

If a script intentionally switches to MAIN/page context or uses `unsafeWindow`,
the page policy applies. Avoid assigning raw strings to `innerHTML`,
`outerHTML`, script URLs, or inline event handlers there. Prefer `textContent`,
`append`, `createElement`, and `GM_addElement` with attributes. If the target
site requires a `TrustedHTML` object, use a policy approved by that site; do not
create a broad passthrough policy just to bypass CSP.

### Script Management

- **Auto-detect installation** &mdash; Navigate to any `.user.js` URL
- **One-click toggle** &mdash; Enable/disable scripts individually or globally
- **Auto-updates** &mdash; Configurable update intervals that default to notify-only queued review
- **Update inbox** &mdash; Review pending updates with diff, permission, source, and rollback context before install
- **Per-script update check** &mdash; Check and queue updates for individual scripts inline
- **Run on Tab** &mdash; Run any script once from the popup or dashboard without changing permanent registration (Chromium 135+)
- **Version tracking** &mdash; Installed vs. available version comparison
- **Tags & search** &mdash; Organize and filter scripts by name, description, or metadata
- **Popup quick-edit** &mdash; Click any script in the toolbar popup to jump straight into the editor
- **Find Scripts** &mdash; Search and install userscripts from Greasy Fork and other sources directly in the dashboard
- **Bulk operations** &mdash; Select multiple scripts to enable, disable, update, reset, or delete with progress tracking
- **Per-script export** &mdash; Export individual scripts as `.user.js` files
- **Script templates** &mdash; New Script opens a blank editor instantly; built-in starter templates (page modifier, CSS injector, API interceptor, and more) live in the editor's template manager
- **Version rollback** &mdash; Auto-saves last 3 versions on update; one-click rollback from info panel
- **Storage quota monitor** &mdash; Visual quota bar with warning when approaching the real storage quota (unlimitedStorage-aware)
- **Bucketed IndexedDB storage** &mdash; Separates script records, GM values, and backup blobs through Storage Buckets when Chrome exposes `navigator.storageBuckets`, with single-DB fallback elsewhere
- **Tag filtering** &mdash; Filter scripts by `@tag` metadata in the dashboard dropdown
- **Drag-and-drop install** &mdash; Drop `.user.js` or `.zip` files onto the dashboard to install
- **Shift+click multi-select** &mdash; Select ranges of scripts with Shift+click
- **Library browser** &mdash; Search and add CDN libraries (`@require`) from cdnjs directly in the editor
- **Advanced filters** &mdash; Filter scripts by grant type, error status, update URL, scope breadth, or tags
- **Code snippets** &mdash; Insert GM API templates directly from the editor toolbar
- **Keyboard shortcuts** &mdash; Ctrl+N new, Alt+1-7 switch tabs, Ctrl+W close tab
- **Script pinning** &mdash; Pin favorite scripts to the top of the list
- **Pattern tester** &mdash; Test any URL to see which scripts would run on it
- **Activity log** &mdash; Timestamped log of all installs, updates, and errors
- **Script health** &mdash; Visual indicators for scripts with errors or stale updates
- **Tampermonkey import** &mdash; Import from Tampermonkey's `.txt` backup format
- **Batch URL install** &mdash; Paste multiple `.user.js` URLs to install at once
- **Script notes** &mdash; Personal notes per script, saved with settings
- **Script configuration** &mdash; Userscript `@var` fields render in per-script Settings and expose values through `CAT_userConfig`, `GM_config`, and `GM_info.script.config`
- **Version diff view** &mdash; Compare any previous version against current code
- **Script folders** &mdash; Organize scripts into color-coded folders with drag-and-drop
- **Workspaces** &mdash; Named snapshots of enabled/disabled script states for quick context switching
- **Command palette** &mdash; Ctrl+K to fuzzy-search actions, scripts, and settings
- **Execution profiling** &mdash; Per-script timing stats with color-coded performance badges
- **Performance budgets** &mdash; Configurable time budget per script with visual over-budget indicators
- **Column visibility** &mdash; Toggle which columns appear in the script table
- **Full-text search** &mdash; Prefix with `code:` to search inside script source code
- **Copy install URL** &mdash; One-click clipboard copy of script download/update URL

### Advanced URL Matching

- Full `@match`, `@include`, `@exclude`, `@exclude-match` support
- **User overrides** &mdash; Add custom match patterns without editing script code
- **Per-pattern toggles** &mdash; Disable individual original patterns per-script
- Glob and regex pattern support

### Per-Site Control

ScriptVault has three independent layers for stopping scripts from running on a given site, all reachable from Settings (and the popup's "Run only on this domain" / "Do not run on this domain" quick actions):

| Layer | Behavior | Setting |
|---|---|---|
| **Denied hosts** | Block every script on listed hosts. Highest priority — overrides script `@match` patterns. | `deniedHosts` (array of hostnames) |
| **Blacklist mode** *(default)* | Run scripts everywhere except on URLs listed in `blacklistedPages` (one per line, glob-style patterns). | `pageFilterMode: 'blacklist'` + `blacklistedPages` |
| **Whitelist mode** | Run scripts *only* on URLs listed in `whitelistedPages`. Nothing else triggers a script. | `pageFilterMode: 'whitelist'` + `whitelistedPages` |

Per-script `@match`/`@include`/`@exclude` still apply on top of these global gates. The popup chip flips a single domain in or out of the active list in one click.

### Cloud Sync

Sync scripts across devices with 6 providers:

| Provider | Method |
|----------|--------|
| WebDAV | Self-hosted or any WebDAV server |
| Local folder | Browser-selected folder with `scriptvault-backup.json` for self-managed backups |
| Google Drive | OAuth2 integration |
| Dropbox | App folder sync |
| OneDrive | Microsoft account integration |
| S3-compatible | AWS S3, Cloudflare R2, MinIO, Backblaze B2, and other S3 endpoints |

Two additional zero-config flows ship as separate modules: **Easy Cloud** for one-click Google Drive sync via `chrome.identity`, and **GitHub Gist** import/export/sync via a personal access token.

**Session-only credentials** &mdash; Sync provider secrets and encryption passphrases can be kept in `chrome.storage.session` (cleared on browser restart) instead of stored at rest. No other MV3 userscript manager offers this mode.

### Monaco Editor

- **Monaco Editor** &mdash; Same editor that powers VS Code, loaded in a sandboxed iframe
- **Tabbed editing** &mdash; Open multiple scripts simultaneously with browser-style tabs (middle-click to close)
- **Unsaved indicators** &mdash; Visual dot on tabs with pending changes
- **5 editor themes** &mdash; Auto (system, follows OS dark/light preference), Dark, Light, Catppuccin Mocha, OLED
- **Status bar** &mdash; Line count and cursor position display
- **IntelliSense** &mdash; Autocomplete for GM API functions and `@metadata` directives, backed by generated ScriptVault GM declarations in the Monaco sandbox
- Code folding, bracket matching, bracket pair colorization, auto-close
- Search & replace (`Ctrl+F` / `Ctrl+H`)
- Real-time userscript metadata linting
- **Code beautifier** &mdash; One-click indentation normalization
- **Snippet insert** &mdash; 7 GM API code templates from the toolbar
- **On-device AI assistance** &mdash; Optional Chrome Prompt API controls explain the current script or draft an edit locally; disabled by default
- Open in vscode.dev for external editing

### DevTools Panel

- **Network inspector** &mdash; View all GM_xmlhttpRequest + fetch/XHR/WebSocket/sendBeacon calls from userscripts
- **Execution profiler** &mdash; See run count, avg/total time, and errors per script
- **HAR export** &mdash; Export network log in standard HAR format
- Auto-refreshes every 3 seconds

### Side Panel

- **Persistent companion panel** &mdash; Always visible alongside the active page (Chrome 114+)
- Shows scripts running on the current page with toggles, timing badges, and error dots
- Live updates on tab navigation
- Quick access to dashboard and script creation

### Script Signing (Ed25519)

- **Cryptographic signing** &mdash; Sign scripts with your Ed25519 keypair
- **Signature verification** &mdash; Verify integrity of installed scripts
- **Trust store** &mdash; Manage trusted author public keys
- `@signature` metadata tag embedded in script header

### Static Analysis

- **AST-based analyzer** &mdash; 31 risk pattern detectors using Acorn parser
- **Zero false positives** &mdash; AST walk ignores comments and strings
- **Risk scoring** &mdash; Color-coded risk level (minimal/low/medium/high)
- Categories: execution, data access, network, fingerprinting, obfuscation, mining, DOM hijacking
- Shown on install page before script installation
- Optional on-device AI review can summarize static analyzer findings with Chrome Prompt API after you enable it in Settings

### Security

- **Script isolation** &mdash; `USER_SCRIPT` world via `chrome.userScripts` API, per-script worldId (Chrome 133+)
- **Static analysis** &mdash; AST-based risk scoring with 31 pattern detectors on every install
- **Script signing** &mdash; Ed25519 cryptographic signatures with trust store
- **Blacklist system** &mdash; Remote + manual blacklists
- **Permission analysis** &mdash; Visual `@grant` permission breakdown on install
- **Local AI gate** &mdash; On-device AI assistance is opt-in, uses Chrome Prompt API only, and never sends script text to a remote AI service
- **`@connect` validation** &mdash; Restrict XHR/WebSocket domains and block internal-host requests by default
- **SRI verification** &mdash; `@require` URLs with `#sha256=` hash are verified after fetch
- **CSP handling** &mdash; Works on sites with strict Content Security Policies
- **Zero telemetry** &mdash; No phone home, all data stays local

### Import & Export

- **ZIP** &mdash; Full backup with scripts + settings
- **JSON** &mdash; Text-based backup
- **File import** &mdash; Drag and drop `.user.js` or `.zip` files anywhere on the dashboard
- **URL import** &mdash; Install directly from any URL
- **Clipboard import** &mdash; Paste script code directly
- **Bookmarklet import** &mdash; Paste a `javascript:` URL to convert it into a userscript for review

### Internationalization

Manifest, browser-facing extension messages, and core dashboard shell controls
are localized in 9 languages:

English &bull; German &bull; Spanish &bull; French &bull; Hebrew &bull; Japanese &bull; Portuguese &bull; Russian &bull; Chinese

Deep dashboard content is still being migrated to DOM translation coverage.

### v2.0 — New Features

<details>
<summary><strong>Click to expand all v2.0 features (57 major features)</strong></summary>

#### Discovery
- **OpenUserJS Integration** &mdash; Additional script source alongside Greasy Fork
- **Script Collections** &mdash; Group scripts into installable bundles with 4 built-in packs
- **Recommendations Panel** &mdash; Heuristic script suggestions derived from installed scripts and Greasy Fork categories
- **Script Sharing** &mdash; QR code generation, data URL encoding, standalone HTML export

#### Linting & Diff
- **Advanced Linter** &mdash; Rule-driven `@grant`/metadata linter with one-click auto-fix
- **Script Diff Tool** &mdash; Side-by-side and unified diff with LCS algorithm and merge support

#### Monitoring
- **Activity Heatmap** &mdash; 365-day GitHub-style contribution grid
- **Error Log** &mdash; 500-entry structured log with JSON/CSV/text export
- **CSP Compatibility Reporter** &mdash; Track which sites block scripts with workaround suggestions

#### Debugging & Development
- **Script Debugger** &mdash; Per-script console capture, live reload, variable inspector, error timeline
- **DevTools Network Panel** &mdash; Capture of every GM_xmlhttpRequest plus fetch/XHR/WebSocket/sendBeacon call, with HAR export
- **Visual Pattern Builder** &mdash; Construct @match patterns by decomposing URLs
- **30+ Code Snippets** &mdash; Searchable library across 8 categories with editor integration
- **Custom Templates** &mdash; Save/share script templates with variable substitution wizard

#### UX & Customization
- **Card View** &mdash; Grid layout alternative with site favicons and status indicators
- **10 Theme Presets** &mdash; Custom theme editor ships with Dark, Light, Catppuccin, OLED, Nord, Dracula, Solarized Dark, Solarized Light, Monokai, and Gruvbox starting points
- **Custom Theme Editor** &mdash; 21 CSS variable pickers with live preview and import/export
- **Keyboard Navigation** &mdash; Full keyboard-first nav with optional Vim keybindings
- **What's New Modal** &mdash; Changelog shown once per version update
- **Gamification** &mdash; Achievements, streaks, user levels, shareable profile cards

#### Sync & Backup
- **Zero-Config Cloud Sync** &mdash; One-click Google Drive sync via chrome.identity
- **GitHub Gist Integration** &mdash; Import/export/sync scripts with GitHub Gists
- **Automated Backups** &mdash; Scheduled daily/weekly backups with configurable retention
- **Multi-Profile Support** &mdash; Different script configurations for different contexts
- **Violentmonkey/Greasemonkey Import** &mdash; Import from VM JSON and GM4 backup formats

#### Platform & Architecture
- **UserStyles/CSS Support** &mdash; `.user.css` files with variable editor, Stylus import, and draft live preview
- **Script Chaining** &mdash; Visual pipeline builder for sequential script execution
- **npm Package Resolution** &mdash; `@require npm:lodash` with CDN fallback chain
- **Script Scheduling** &mdash; Time/day/date-based execution with visual picker
- **Public Extension API** &mdash; External message API with rate limiting and webhooks
- **Firefox Compatibility Layer** &mdash; Polyfills for cross-browser v2.0 module support
- **Lazy Module Loading** &mdash; Dashboard loads 7 eager scripts, defers 30+ until needed
- **Automatic Migration** &mdash; Seamless v1.x → v2.0 data migration
- **Storage Quota Manager** &mdash; Auto-cleanup when approaching Chrome's 10MB limit
- **Storage Bucket Partitioning** &mdash; Feature-detected IndexedDB partitions isolate script metadata, GM value bags, and backup scheduler blobs while preserving backup restore and sync merge flows

#### Quality & Testing
- **1800+ Vitest Tests** &mdash; Coverage for parser, utilities, storage, update flows, UI modules, accessibility, and security boundaries
- **Browser visual regression gate** &mdash; `npm run test:visual` runs Vitest Browser Mode in Chromium and checks the dashboard list-view screenshot baseline
- **JSDoc Type Annotations** &mdash; @ts-check compatible on critical functions
- **esbuild Build System** &mdash; Modern bundler with minification and source maps
- **Accessibility (WCAG 2.1 AA)** &mdash; ARIA labels, focus trapping, high contrast, reduced motion

</details>

---

## Installation

### From Source (Developer Mode)

1. Clone or download this repository:
   ```bash
   git clone https://github.com/SysAdminDoc/ScriptVault.git
   cd ScriptVault
   ```

2. Open Chrome and navigate to `chrome://extensions`

3. Enable **Developer mode** (toggle in top right), then click **Load unpacked** and select the repository folder.

4. Enable userscript execution for your Chrome version:
   - **Chrome 138+**: Click ScriptVault's **Details** button and enable **Allow User Scripts**.
   - **Chrome 120-137**: Keep the global **Developer mode** toggle enabled.

If the toggle is off, the popup and dashboard show a setup banner. After enabling the required toggle, reopen the popup or click **Refresh** in dashboard runtime diagnostics; ScriptVault re-probes `chrome.userScripts` and configures the USER_SCRIPT world without requiring a browser restart. If Chrome keeps the API unavailable in the current extension context, use the **Reload** button on ScriptVault's `chrome://extensions` details page and refresh status again.

### Chrome Web Store

**[Install ScriptVault from the Chrome Web Store](https://chromewebstore.google.com/detail/scriptvault/jlhdbkeijcbgnonpfkfkkkhfmbeejkgh)**

### Firefox / AMO Validation Build

Firefox is still a validation target, not a published AMO listing. The current package targets Firefox 140+ desktop and produces AMO-ready artifacts:

```bash
npm run firefox:package
npm run smoke:firefox
```

Artifacts are written to `firefox-artifacts/`: the Firefox package ZIP, a source-review ZIP, and `web-ext-lint.json`. The package gate currently passes with 0 linter errors and 0 notices. `npm run smoke:firefox` uses geckodriver plus Firefox Developer Edition/Nightly 140+ to temporary-install the package, open the dashboard and popup, save/toggle a smoke userscript, verify it runs on a local target page, validate DNR dynamic-rule add/remove, verify `@require` SRI at packaged-runtime registration, exercise Ed25519 signing/verification, validate WebDAV sync against a local fixture, import Chrome-shaped JSON/ZIP backup fixtures, import a 26-script quota fixture, and verify trash restore after a profile-backed Firefox restart. Firefox v1 is intentionally textarea-first: Monaco is omitted from the Firefox package until a pruned local editor bundle has AMO lint proof, so the editor falls back to the textarea adapter. OAuth cloud providers are deferred because Firefox does not support `identity` as an optional permission.

---

## Browser Support Matrix

<!-- SCRIPT_VAULT_BROWSER_SUPPORT_MATRIX:START -->
_Last generated: 2026-07-10 with `npm run support:matrix`. Version source: `manifest.json` / `manifest-firefox.json` 3.19.1._

| Browser | Support level | Tested version / target | Last successful verification | Verification evidence | Unsupported or deferred APIs |
|---|---|---|---|---|---|
| Chrome / Chromium | Tier 1 published target | Chrome 130+ MV3 | 2026-07-10 | `npm run smoke:dashboard`, `npm run cws:check`, local Chrome ZIP packaging with `npm run build:prod` then `bash build.sh` | Chrome 138+ requires per-extension Allow User Scripts; current-site recovery uses Chrome 133+ `permissions.addHostAccessRequest` when available and falls back to `permissions.request({ origins })`; per-script `worldId` is Chrome 133+ and feature-gated |
| Microsoft Edge | Tier 1 compatible package; Partner Center publication manual | Edge 130+ Chromium MV3 package | 2026-07-10 generated package/report; local Edge smoke command is available but has no current evidence | `npm run build:edge:check`, `edge-artifacts/scriptvault-edge-v3.19.1.zip`, `edge-artifacts/edge-build-3.19.1.json`, `npm run smoke:edge`, `edge-artifacts/edge-smoke-3.19.1.json`; local release attaches `edge-artifacts/*` manually | Manual Partner Center upload remains required until a live Edge Add-ons listing exists; Microsoft Edge Add-ons REST update automation is deferred until listing identifiers and publisher credentials are provisioned; Dedicated local Edge sideload smoke is wired via npm run smoke:edge; release readiness requires a maintainer to run that command on Microsoft Edge |
| Firefox Desktop | AMO validation target, not a published listing | Firefox 140.0+ MV3 | 2026-07-10 | `npm run firefox:package`, `npm run smoke:firefox`; web-ext lint 0 errors / 0 notices / 53 warnings | `sidePanel`, `offscreen`, `identity` OAuth, and some `userScripts.execute` flows are unsupported/deferred; host grant/revoke diagnostics listen to permissions events; Firefox package omits Monaco until the Firefox editor-loading pass |
| Firefox for Android | Deferred; not an AMO compatibility target | No current `gecko_android` manifest target | 2026-07-10 | `manifest-firefox.json` intentionally omits `gecko_android` until an Android smoke gate exists | Android UI/runtime, extension-action overlay, host-permission, import/export, and WebDAV paths are unverified |
| Brave / Vivaldi / Opera / Arc | Chromium derivative watchlist | Chrome 130+ package may load | Not release-verified | No local smoke or store package for these browsers | Store policy, shields/sidebar behavior, and extension UI chrome are unverified |
| Orion / Safari | Not supported | Not a current target | Not verified | No build, smoke, or package path | Requires separate WebKit/Orion validation and likely native Safari extension work |
<!-- SCRIPT_VAULT_BROWSER_SUPPORT_MATRIX:END -->

---

## Permission and Privacy Review

ScriptVault requests Chrome site access with optional HTTP(S) host grants derived from each script's declared run, update, dependency, and `@connect` hosts. Scripts that declare universal access require an explicit per-script broad-access approval; Firefox keeps the required `<all_urls>` fallback until its MV3 userscript host-grant behavior is equivalent. The reviewer-facing permission justifications live in [docs/store-listing-copy.md](docs/store-listing-copy.md), the CWS remote-code review memo lives in [docs/cws-remote-code-compliance.md](docs/cws-remote-code-compliance.md), and the privacy policy keeps the same manifest inventory in [PRIVACY.md](PRIVACY.md).

Before release, run:

```bash
npm run store-copy:check
npm run cws:remote-code:check
```

These checks compare `manifest.json` and `manifest-firefox.json` against the privacy policy, store copy, release runbook, package scripts, local release gates, and the CWS remote-code scanner so a new permission or remote-code-capable path cannot ship without matching reviewer evidence.

---

## Quick Start

### Installing Scripts

| Method | Steps |
|--------|-------|
| **Direct URL** | Navigate to any `.user.js` URL &mdash; ScriptVault auto-detects it |
| **Find Scripts** | Dashboard &rarr; click **Find Scripts** &rarr; search &rarr; one-click install |
| **File drop** | Drag and drop a `.user.js` file onto the dashboard |
| **Dashboard import** | Dashboard &rarr; Utilities &rarr; paste URL or code &rarr; Import |
| **Create new** | Dashboard &rarr; click **+** &rarr; write script &rarr; `Ctrl+S` |

### Managing Scripts

| Action | How |
|--------|-----|
| Toggle | Click the switch next to any script |
| Edit | Click the script name &mdash; opens in a tab (multiple scripts at once) |
| Update | Click the refresh icon on any script to check for updates |
| Export | Click the download icon to export a single script |
| Delete | Click the trash icon |
| View storage | Click the database icon to inspect `GM_getValue` data |
| Bulk actions | Select multiple scripts via checkboxes &rarr; choose action from dropdown |

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+Shift+S` | Open ScriptVault popup |
| `Alt+Shift+D` | Open Dashboard |
| `Alt+Shift+E` | Toggle all scripts on/off |
| `Ctrl+S` | Save script (in editor) |
| `Ctrl+F` | Find in editor |
| `Ctrl+H` | Find and replace |
| `Ctrl+G` | Go to line |

### Omnibox Search

Type `sv ` followed by a script name (or tag) in the browser's address bar
to fuzzy-search your installed scripts. Press Enter on a suggestion to open
that script in the dashboard editor.

---

## Supported Metadata

```javascript
// ==UserScript==
// @name           Script Name
// @namespace      https://example.com
// @version        1.0.0
// @description    What the script does
// @author         Your Name
// @match          https://example.com/*
// @include        http://example.org/*
// @exclude        *://example.com/private/*
// @exclude-match  *://admin.example.com/*
// @grant          GM_getValue
// @grant          GM_setValue
// @grant          GM_xmlhttpRequest
// @require        https://code.jquery.com/jquery-3.6.0.min.js
// @resource       myCSS https://example.com/style.css
// @icon           https://example.com/icon.png
// @run-at         document-end
// @connect        api.example.com
// @downloadURL    https://example.com/script.user.js
// @updateURL      https://example.com/script.meta.js
// @supportURL     https://github.com/user/repo/issues
// @homepageURL    https://github.com/user/repo
// @license        MIT
// @antifeature    tracking Analytics beacon
// @tag            productivity
// @priority       10
// @inject-into    auto
// @compatible     chrome
// @incompatible   firefox Needs polyfill
// @contributionURL https://example.com/donate
// @webRequest     {"selector":"*ad*","action":"cancel"}
// @top-level-await
// @isolationCookie
// ==/UserScript==
```

### @run-at Options

| Value | Timing |
|-------|--------|
| `document-start` | Before DOM loads |
| `document-body` | When `<body>` exists |
| `document-end` | When DOM is complete (default) |
| `document-idle` | When page is fully loaded |
| `context-menu` | On right-click context menu |

---

## Security Model

| Layer | Protection |
|-------|------------|
| Script isolation | Scripts run in isolated `USER_SCRIPT` world via `chrome.userScripts` API |
| Permission transparency | Installation page shows all requested `@grant` permissions |
| Network restrictions | `@connect` domains and internal-host guards are enforced before XHR, download, and WebSocket requests run |
| Blacklist protection | Remote + manual blacklists block known malicious scripts |
| Zero telemetry | No data collection, no phone home &mdash; everything stays local |

---

## Comparison

| Feature | ScriptVault | Tampermonkey | ViolentMonkey |
|---------|:-----------:|:------------:|:-------------:|
| Manifest V3 | Yes | Yes | Yes |
| Full GM API (35+) | Yes | Yes | Yes |
| Monaco Editor (VS Code) | Yes | No | No |
| DevTools Panel | Yes | No | No |
| Side Panel | Yes | No | No |
| Script Signing (Ed25519) | Yes | No | No |
| AST Static Analysis (31 detectors) | Yes | No | No |
| Cloud Sync (WebDAV, local folder, Google Drive, Dropbox, OneDrive, S3) | Yes&sup1; | Yes | Yes |
| 3-Way Sync Merge | Yes | No | No |
| Tabbed Multi-Script Editor | Yes | No | No |
| Built-in Script Search | Yes | No | No |
| Script Templates | 6 | No | No |
| Version Rollback | Yes (3) | No | No |
| CDN Library Browser | Yes | No | No |
| Workspaces | Yes | No | No |
| Script Folders | Yes | No | No |
| Command Palette (Ctrl+K) | Yes | No | No |
| Drag-and-Drop Install | Yes | Yes | No |
| Tag Filtering | Yes | No | No |
| Script Pinning | Yes | No | No |
| Pattern Tester | Yes | No | No |
| Version Diff View | Yes | No | No |
| Network Request Log + HAR | Yes | No | No |
| Execution Profiling | Yes | No | No |
| Performance Budgets | Yes | No | No |
| Storage Quota Monitor | Yes | No | No |
| Bulk Operations w/ Progress | Yes | Yes | No |
| 5 UI Themes | Yes | No | Yes |
| Session-Only Credentials | Yes | No | No |
| Bookmarklet Import | Yes | No | No |
| Open Source | MIT | No | Yes |
| Free | Yes | Freemium | Yes |

&sup1; Firefox currently supports WebDAV and import/export sync. OAuth providers (Google Drive, Dropbox, OneDrive) and Easy Cloud require the `identity` permission, which is deferred until a Firefox OAuth validation pass lands. S3-compatible sync works on Firefox (no `identity` dependency).

---

## Project Structure

```
ScriptVault/
├── manifest.json              # Chrome MV3 manifest
├── manifest-firefox.json      # Firefox MV3 manifest
├── esbuild.config.mjs         # Cross-platform build pipeline
├── playwright.config.mjs      # Playwright E2E flow suite
├── .env.example               # Safe template for Chrome Web Store publishing credentials
├── background.js              # Service worker (built from source modules)
├── background.core.js         # Main service worker logic (~5500 lines)
├── content.js                 # Content script bridge (USER_SCRIPT <-> background)
├── offscreen.html/js          # Offscreen document (AST analysis, 3-way merge)
├── build.sh                   # Packages CWS-ready ZIP
├── bg/
│   ├── analyzer.js            # AST-based static analysis engine
│   ├── netlog.js              # Network request logger
│   ├── signing.js             # Ed25519 script signing
│   └── workspaces.js          # Workspace state manager
├── modules/
│   ├── storage.js             # Settings, scripts, values, folders
│   ├── sync-providers.js      # WebDAV, local folder, Google Drive, Dropbox, OneDrive, S3
│   ├── resources.js           # @resource/@require cache
│   ├── xhr.js                 # XHR abort tracking
│   └── i18n.js                # Inline translations (9 languages)
├── shared/
│   └── utils.js               # escapeHtml, generateId, sanitizeUrl, formatBytes
├── pages/
│   ├── dashboard.html/js      # Main dashboard + Monaco editor (~5000 lines)
│   ├── popup.html/js          # Toolbar popup
│   ├── install.html/js        # Script installation page
│   ├── sidepanel.html/js      # Persistent side panel (Chrome 114+)
│   ├── devtools.html          # DevTools registration
│   ├── devtools-panel.html/js # DevTools network + profiling UI
│   ├── editor-sandbox.html    # Sandboxed Monaco editor iframe
│   └── monaco-adapter.js      # CodeMirror-to-Monaco API bridge
├── lib/
│   ├── codemirror/            # CodeMirror (lint only)
│   ├── scriptvault.d.ts       # Generated GM API ambient declarations
│   ├── acorn.min.js           # Acorn JS parser for AST analysis
│   ├── diff.min.js            # diff.js for 3-way merge
│   └── fflate.js              # ZIP compression
├── images/                    # Extension icons
├── tests/e2e/                 # Playwright install/update/restore/sync flows
├── tests/visual/              # Vitest Browser Mode screenshot baselines
└── _locales/                  # 8 language translations
```

---

## Migrating from Other Managers

### From Violentmonkey

Violentmonkey is MV2-only and disabled on Chrome 139+. To migrate:

1. Open Violentmonkey &rarr; Settings &rarr; **Export to zip**
2. Open ScriptVault dashboard &rarr; Utilities tab
3. Drop the exported `.zip` file onto the dashboard (or use Import &rarr; File)
4. Review the imported scripts in the quarantine/review flow

ScriptVault reads the VM JSON export format (`scripts[].code`, `scripts[].config.enabled`, `scripts[].props`). Enabled/disabled state is preserved. Scripts with empty code are skipped. `@grant`, `@match`, and other metadata are parsed from the script header.

### From Tampermonkey

1. Open Tampermonkey &rarr; Utilities &rarr; **Export** (ZIP or `.txt` backup)
2. Drop the exported file onto the ScriptVault dashboard

### From ScriptCat

ScriptCat exports in Tampermonkey-compatible format:

1. Open ScriptCat &rarr; Settings &rarr; **Export**
2. Drop the exported file onto the ScriptVault dashboard

Scripts, metadata, and `@crontab` schedules are preserved. ScriptCat `@background` scripts import as dormant until ScriptVault's background runner is enabled.

### From Greasemonkey

1. Export your GM4 backup from Greasemonkey settings
2. Import through ScriptVault dashboard &rarr; Utilities &rarr; Import

### AI-Generated Scripts (Tweeks, ChatGPT, Claude)

AI tools can generate userscripts from natural language descriptions. To manage them in ScriptVault:

1. Copy the generated `.user.js` code
2. Open the ScriptVault dashboard &rarr; click **New** (or paste into Utilities &rarr; Import)
3. Review the script in the editor before saving

ScriptVault's 31-detector AST analyzer automatically flags common issues in generated scripts: overbroad `@match <all_urls>` patterns, unnecessary `@grant` declarations, `eval()` usage, hardcoded credentials, and other risk patterns. If you enable on-device AI assistance, ScriptVault can also ask Chrome Prompt API for a local-only explanation or draft while keeping script text on the device.

---

## Contributing

Contributions are welcome. Feel free to open a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

---

## License

MIT License &mdash; see [LICENSE](LICENSE) for details.

---

## Acknowledgments

- [Tampermonkey](https://www.tampermonkey.net/) &mdash; Setting the standard in userscript management
- [ViolentMonkey](https://violentmonkey.github.io/) &mdash; Manifest V3 inspiration
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) &mdash; The VS Code editor powering the script editor
- [Acorn](https://github.com/acornjs/acorn) &mdash; JavaScript parser for AST-based static analysis
- [jsdiff](https://github.com/kpdecker/jsdiff) &mdash; Text diffing for 3-way sync merge
- [fflate](https://github.com/101arrowz/fflate) &mdash; Fast ZIP compression

---

<p align="center">
  <strong>ScriptVault v3.19.1</strong><br>
  <em>Your scripts, your rules &mdash; locked down and loaded</em>
</p>
