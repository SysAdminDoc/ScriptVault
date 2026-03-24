<p align="center">
  <img src="images/ScriptVault-192x192.png" alt="ScriptVault" width="128" height="128">
</p>

<h1 align="center">ScriptVault</h1>

<p align="center">
  <strong>A powerful, open-source userscript manager built on Chrome Manifest V3</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.7.3-22c55e?style=flat-square" alt="Version">
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

### GM API &mdash; 24+ Functions

Full Greasemonkey/Tampermonkey API compatibility with promise-based `GM.*` async variants.

| Storage | Network | UI | Utilities |
|---------|---------|-----|-----------|
| `GM_getValue` | `GM_xmlhttpRequest` | `GM_addStyle` | `GM_info` |
| `GM_setValue` | `GM_fetch` | `GM_notification` | `GM_log` |
| `GM_deleteValue` | `GM_download` | `GM_registerMenuCommand` | `GM_setClipboard` |
| `GM_listValues` | | `GM_unregisterMenuCommand` | `GM_openInTab` |
| `GM_getValues` | | `GM_addElement` | `GM_getResourceText` |
| `GM_setValues` | | | `GM_getResourceURL` |
| `GM_deleteValues` | | | |
| `GM_addValueChangeListener` | | | |
| `GM_removeValueChangeListener` | | | |

Plus `GM_getTab`, `GM_saveTab`, `GM_getTabs` for cross-tab state management.

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

### Built-in Code Editor

- **Tabbed editing** &mdash; Open multiple scripts simultaneously with browser-style tabs (middle-click to close)
- **Unsaved indicators** &mdash; Visual dot on tabs with pending changes
- **CodeMirror** with JavaScript syntax highlighting
- **5 editor themes** &mdash; Monokai, Dracula, Material Darker, Nord, Ayu Dark
- **Status bar** &mdash; Line count and cursor position display
- Code folding, bracket matching, auto-close
- Search & replace (`Ctrl+F` / `Ctrl+H`)
- Real-time userscript metadata linting
- Open in vscode.dev for external editing

### Security

- **Script isolation** &mdash; `USER_SCRIPT` world via `chrome.userScripts` API
- **Blacklist system** &mdash; Remote + manual blacklists
- **Permission analysis** &mdash; Visual `@grant` permission breakdown on install
- **`@connect` validation** &mdash; Restrict XHR domains
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
// ==/UserScript==
```

### @run-at Options

| Value | Timing |
|-------|--------|
| `document-start` | Before DOM loads |
| `document-body` | When `<body>` exists |
| `document-end` | When DOM is complete (default) |
| `document-idle` | When page is fully loaded |

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
| Full GM API (24+) | Yes | Yes | Yes |
| Cloud Sync (5 providers) | Yes | Yes | Yes |
| Tabbed Multi-Script Editor | Yes | No | No |
| Built-in Script Search | Yes | No | No |
| Script Templates | 6 | No | No |
| Version Rollback | Yes (3) | No | No |
| CDN Library Browser | Yes | No | No |
| Drag-and-Drop Install | Yes | Yes | No |
| Tag Filtering | Yes | No | No |
| Script Pinning | Yes | No | No |
| Pattern Tester | Yes | No | No |
| Activity Log | Yes | No | No |
| Script Health Indicators | Yes | No | No |
| Tampermonkey Import | Yes | N/A | No |
| Version Diff View | Yes | No | No |
| Storage Quota Monitor | Yes | No | No |
| Bulk Operations w/ Progress | Yes | Yes | No |
| 4 UI Themes | Yes | No | Yes |
| Open Source | MIT | No | Yes |
| Free | Yes | Freemium | Yes |

---

## Project Structure

```
ScriptVault/
├── manifest.json              # Extension manifest (MV3)
├── background.js              # Service worker — API, sync, script registration
├── content.js                 # Content script bridge (USER_SCRIPT <-> background)
├── pages/
│   ├── dashboard.html/js/css  # Main settings & editor UI
│   ├── popup.html/js          # Toolbar popup
│   └── install.html/js        # Script installation page
├── images/                    # Extension icons (16-512px, .ico)
├── lib/
│   └── codemirror/            # CodeMirror editor + addons
└── _locales/
    └── */messages.json        # 8 language translations
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
- [CodeMirror](https://codemirror.net/) &mdash; Code editor
- [fflate](https://github.com/101arrowz/fflate) &mdash; Fast ZIP compression

---

<p align="center">
  <strong>ScriptVault v1.7.3</strong><br>
  <em>Your scripts, your rules &mdash; locked down and loaded</em>
</p>
