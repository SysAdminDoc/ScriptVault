<p align="center">
  <img src="images/ScriptVault-192x192.png" alt="ScriptVault" width="128" height="128">
</p>

<h1 align="center">ScriptVault</h1>

<p align="center">
  <strong>A powerful, open-source userscript manager built on Chrome Manifest V3</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-2.0.0-22c55e?style=flat-square" alt="Version">
  <img src="https://img.shields.io/badge/manifest-v3-60a5fa?style=flat-square" alt="Manifest V3">
  <img src="https://img.shields.io/badge/license-MIT-orange?style=flat-square" alt="License">
  <img src="https://img.shields.io/badge/chrome-120%2B-blue?style=flat-square" alt="Chrome 120+">
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

## Features

### GM API &mdash; 35+ Functions

Full Greasemonkey/Tampermonkey API compatibility with promise-based `GM.*` async variants.

| Storage | Network | UI | Utilities |
|---------|---------|-----|-----------|
| `GM_getValue` | `GM_xmlhttpRequest` | `GM_addStyle` | `GM_info` |
| `GM_setValue` | `GM_download` | `GM_notification` | `GM_log` |
| `GM_deleteValue` | `GM_webRequest` | `GM_registerMenuCommand` | `GM_setClipboard` |
| `GM_listValues` | | `GM_unregisterMenuCommand` | `GM_openInTab` |
| `GM_getValues` | | `GM_getMenuCommands` | `GM_getResourceText` |
| `GM_setValues` | | `GM_addElement` | `GM_getResourceURL` |
| `GM_deleteValues` | | `GM_loadScript` | `GM_cookie` |
| `GM_addValueChangeListener` | | `GM_audio` | `GM_focusTab` |
| `GM_removeValueChangeListener` | | | `GM_closeTab` |

Plus `GM_getTab`, `GM_saveTab`, `GM_getTabs` for cross-tab state, `window.close`, `window.focus`, `window.onurlchange` grants, and `@top-level-await` support.

### Script Management

- **Auto-detect installation** &mdash; Navigate to any `.user.js` URL
- **One-click toggle** &mdash; Enable/disable scripts individually or globally
- **Auto-updates** &mdash; Configurable update intervals with notifications
- **Per-script update check** &mdash; Check and apply updates for individual scripts inline
- **Version tracking** &mdash; Installed vs. available version comparison
- **Tags & search** &mdash; Organize and filter scripts by name, description, or metadata
- **Popup quick-edit** &mdash; Click any script in the toolbar popup to jump straight into the editor
- **Find Scripts** &mdash; Search and install userscripts from Greasy Fork and other sources directly in the dashboard
- **Bulk operations** &mdash; Select multiple scripts to enable, disable, update, reset, or delete with progress tracking
- **Per-script export** &mdash; Export individual scripts as `.user.js` files
- **Script templates** &mdash; 6 starter templates (blank, page modifier, CSS injector, API interceptor, SPA script, cross-site request)
- **Version rollback** &mdash; Auto-saves last 3 versions on update; one-click rollback from info panel
- **Storage quota monitor** &mdash; Visual quota bar with warning when approaching Chrome's 10MB limit
- **Tag filtering** &mdash; Filter scripts by `@tag` metadata in the dashboard dropdown
- **Drag-and-drop install** &mdash; Drop `.user.js` or `.zip` files onto the dashboard to install
- **Shift+click multi-select** &mdash; Select ranges of scripts with Shift+click
- **Library browser** &mdash; Search and add CDN libraries (`@require`) from cdnjs directly in the editor
- **Advanced filters** &mdash; Filter scripts by grant type, error status, update URL, scope breadth, or tags
- **Code snippets** &mdash; Insert GM API templates directly from the editor toolbar
- **Keyboard shortcuts** &mdash; Ctrl+N new, Alt+1-5 switch tabs, Ctrl+W close tab, Ctrl+Tab cycle tabs
- **Script pinning** &mdash; Pin favorite scripts to the top of the list
- **Pattern tester** &mdash; Test any URL to see which scripts would run on it
- **Activity log** &mdash; Timestamped log of all installs, updates, and errors
- **Script health** &mdash; Visual indicators for scripts with errors or stale updates
- **Tampermonkey import** &mdash; Import from Tampermonkey's `.txt` backup format
- **Batch URL install** &mdash; Paste multiple `.user.js` URLs to install at once
- **Script notes** &mdash; Personal notes per script, saved with settings
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

### Cloud Sync

Sync scripts across devices with 5 providers:

| Provider | Method |
|----------|--------|
| WebDAV | Self-hosted or any WebDAV server |
| Google Drive | OAuth2 integration |
| Dropbox | App folder sync |
| OneDrive | Microsoft account integration |
| Browser Sync | Chrome's built-in sync |

### Monaco Editor

- **Monaco Editor** &mdash; Same editor that powers VS Code, loaded in a sandboxed iframe
- **Tabbed editing** &mdash; Open multiple scripts simultaneously with browser-style tabs (middle-click to close)
- **Unsaved indicators** &mdash; Visual dot on tabs with pending changes
- **4 editor themes** &mdash; Dark, Light, Catppuccin Mocha, OLED
- **Status bar** &mdash; Line count and cursor position display
- **IntelliSense** &mdash; Autocomplete for GM API functions and `@metadata` directives
- Code folding, bracket matching, bracket pair colorization, auto-close
- Search & replace (`Ctrl+F` / `Ctrl+H`)
- Real-time userscript metadata linting
- **Code beautifier** &mdash; One-click indentation normalization
- **Snippet insert** &mdash; 7 GM API code templates from the toolbar
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

### Security

- **Script isolation** &mdash; `USER_SCRIPT` world via `chrome.userScripts` API, per-script worldId (Chrome 133+)
- **Static analysis** &mdash; AST-based risk scoring with 31 pattern detectors on every install
- **Script signing** &mdash; Ed25519 cryptographic signatures with trust store
- **Blacklist system** &mdash; Remote + manual blacklists
- **Permission analysis** &mdash; Visual `@grant` permission breakdown on install
- **`@connect` validation** &mdash; Restrict XHR domains
- **SRI verification** &mdash; `@require` URLs with `#sha256=` hash are verified after fetch
- **CSP handling** &mdash; Works on sites with strict Content Security Policies
- **Zero telemetry** &mdash; No phone home, all data stays local

### Import & Export

- **ZIP** &mdash; Full backup with scripts + settings
- **JSON** &mdash; Text-based backup
- **File import** &mdash; Drag and drop `.user.js` or `.zip` files anywhere on the dashboard
- **URL import** &mdash; Install directly from any URL
- **Clipboard import** &mdash; Paste script code directly

### Internationalization

Available in 8 languages:

English &bull; German &bull; Spanish &bull; French &bull; Japanese &bull; Portuguese &bull; Russian &bull; Chinese

### v2.0 — New Features

<details>
<summary><strong>Click to expand all v2.0 features (58 major features)</strong></summary>

#### Discovery & Store
- **Built-in Script Store** &mdash; Search, browse, and install scripts from Greasy Fork directly in the dashboard
- **OpenUserJS Integration** &mdash; Additional script source alongside Greasy Fork
- **Script Collections** &mdash; Group scripts into installable bundles with 4 built-in packs
- **Smart Recommendations** &mdash; AI-powered script suggestions based on browsing patterns
- **Script Sharing** &mdash; QR code generation, data URL encoding, standalone HTML export

#### AI & Intelligence
- **AI Assistant** &mdash; Generate scripts from natural language, explain code, security reviews, auto-fix errors
- **Supports OpenAI, Anthropic, Ollama (local), and custom endpoints**
- **Encrypted API key storage** (AES-256-GCM with PBKDF2)
- **Advanced Linter** &mdash; 21 rules with one-click auto-fix, hardcoded secret detection
- **Script Diff Tool** &mdash; Side-by-side and unified diff with merge support

#### Monitoring & Analytics
- **Performance Dashboard** &mdash; Impact scores, sparkline trends, auto-disable recommendations
- **Script Analytics** &mdash; 90-day execution stats with canvas charts (line/bar/donut)
- **Activity Heatmap** &mdash; 365-day GitHub-style contribution grid
- **Error Log** &mdash; 500-entry structured log with JSON/CSV/text export
- **CSP Compatibility Reporter** &mdash; Track which sites block scripts with workaround suggestions

#### Debugging & Development
- **Script Debugger** &mdash; Per-script console capture, live reload, variable inspector, error timeline
- **DevTools Waterfall** &mdash; Canvas-based network timeline with request body inspector
- **Visual Pattern Builder** &mdash; Construct @match patterns by decomposing URLs
- **30+ Code Snippets** &mdash; Searchable library across 8 categories with editor integration
- **Custom Templates** &mdash; Save/share script templates with variable substitution wizard

#### UX & Customization
- **Card View** &mdash; Grid layout alternative with site favicons and status indicators
- **10 Theme Presets** &mdash; Dark, Light, Catppuccin, OLED, Nord, Dracula, Solarized, Monokai, Gruvbox
- **Custom Theme Editor** &mdash; 21 CSS variable pickers with live preview and import/export
- **Keyboard Navigation** &mdash; Full keyboard-first nav with optional Vim keybindings
- **Onboarding Wizard** &mdash; 5-step welcome flow with Tampermonkey import
- **What's New Modal** &mdash; Changelog shown once per version update
- **Gamification** &mdash; 31 achievements, streaks, user levels, shareable profile cards

#### Sync & Backup
- **Zero-Config Cloud Sync** &mdash; One-click Google Drive sync via chrome.identity
- **GitHub Gist Integration** &mdash; Import/export/sync scripts with GitHub Gists
- **Automated Backups** &mdash; Scheduled daily/weekly backups with configurable retention
- **Multi-Profile Support** &mdash; Different script configurations for different contexts
- **Violentmonkey/Greasemonkey Import** &mdash; Import from VM JSON and GM4 backup formats

#### Platform & Architecture
- **UserStyles/CSS Support** &mdash; `.user.css` files with variable editor, Stylus import
- **Script Chaining** &mdash; Visual pipeline builder for sequential script execution
- **npm Package Resolution** &mdash; `@require npm:lodash` with CDN fallback chain
- **Script Scheduling** &mdash; Time/day/date-based execution with visual picker
- **Public Extension API** &mdash; External message API with rate limiting and webhooks
- **Firefox Compatibility Layer** &mdash; Polyfills for cross-browser v2.0 module support
- **Lazy Module Loading** &mdash; Dashboard loads 7 eager scripts, defers 30+ until needed
- **Automatic Migration** &mdash; Seamless v1.x → v2.0 data migration
- **Storage Quota Manager** &mdash; Auto-cleanup when approaching Chrome's 10MB limit

#### Quality & Testing
- **159 Unit Tests** &mdash; Vitest suite covering parser, utilities, versions, analyzer, network log
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

3. Enable **Developer mode** (toggle in top right)

4. Click **Load unpacked** and select the repository folder

5. **Chrome 138+**: Click the extension's "Details" and enable **Allow User Scripts**

### Chrome Web Store

**[Install ScriptVault from the Chrome Web Store](https://chromewebstore.google.com/detail/scriptvault/jlhdbkeijcbgnonpfkfkkkhfmbeejkgh)**

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
// @antifeature    tracking
// @tag            productivity
// @priority       10
// @inject-into    auto
// @compatible     chrome
// @incompatible   firefox Needs polyfill
// @contributionURL https://example.com/donate
// @webRequest     {"selector":"*ad*","action":"cancel"}
// @top-level-await
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
| Network restrictions | `@connect` domains are validated before XHR requests |
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
| Cloud Sync (4 providers) | Yes | Yes | Yes |
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
| 4 UI Themes | Yes | No | Yes |
| Open Source | MIT | No | Yes |
| Free | Yes | Freemium | Yes |

---

## Project Structure

```
ScriptVault/
├── manifest.json              # Chrome MV3 manifest
├── manifest-firefox.json      # Firefox MV3 manifest
├── background.js              # Service worker (built from source modules)
├── background.core.js         # Main service worker logic (~5500 lines)
├── content.js                 # Content script bridge (USER_SCRIPT <-> background)
├── offscreen.html/js          # Offscreen document (AST analysis, 3-way merge)
├── build-background.sh        # Concatenates modules into background.js
├── build.sh                   # Packages CWS-ready ZIP
├── bg/
│   ├── analyzer.js            # AST-based static analysis engine
│   ├── netlog.js              # Network request logger
│   ├── signing.js             # Ed25519 script signing
│   └── workspaces.js          # Workspace state manager
├── modules/
│   ├── storage.js             # Settings, scripts, values, folders
│   ├── sync-providers.js      # WebDAV, Google Drive, Dropbox, OneDrive
│   ├── resources.js           # @resource/@require cache
│   ├── xhr.js                 # XHR abort tracking
│   └── i18n.js                # Inline translations (8 languages)
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
│   ├── acorn.min.js           # Acorn JS parser for AST analysis
│   ├── diff.min.js            # diff.js for 3-way merge
│   └── fflate.js              # ZIP compression
├── images/                    # Extension icons
└── _locales/                  # 8 language translations
```

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
  <strong>ScriptVault v1.7.8</strong><br>
  <em>Your scripts, your rules &mdash; locked down and loaded</em>
</p>
