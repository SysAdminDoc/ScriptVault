# ScriptVault 🔐

<p align="center">


</p>

<p align="center">
  <strong>A powerful, modern userscript manager built with Chrome Manifest V3</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.1.0-22c55e?style=flat-square" alt="Version">
  <img src="https://img.shields.io/badge/manifest-v3-60a5fa?style=flat-square" alt="Manifest V3">
  <img src="https://img.shields.io/badge/license-MIT-orange?style=flat-square" alt="License">
  <img src="https://img.shields.io/badge/chrome-120%2B-blue?style=flat-square" alt="Chrome 120+">
</p>

---

## ✨ Features

### Full GM API Support
ScriptVault provides comprehensive Greasemonkey/Tampermonkey API compatibility:

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

Plus `GM_getTab`, `GM_saveTab`, `GM_getTabs` for tab state management.

**Promise-based GM.* API** - All functions available as async versions (e.g., `GM.getValue()`, `GM.setValue()`)

### Script Management
- **Automatic Installation** - Navigate to any `.user.js` URL for instant detection
- **One-click Enable/Disable** - Toggle scripts individually or globally
- **Auto-Updates** - Configurable update checking with notifications
- **Version Tracking** - Track installed vs available versions
- **Tags System** - Organize scripts with custom tags
- **Search & Filter** - Find scripts by name, description, or metadata

### Advanced URL Matching
- Full `@match`, `@include`, `@exclude`, `@exclude-match` support
- **User Overrides** - Add custom patterns without editing script code
- **Original Pattern Toggles** - Disable original patterns per-script
- Glob and regex pattern support

### Cloud Sync
Sync your scripts across devices with multiple providers:
- **WebDAV** - Self-hosted or any WebDAV server
- **Google Drive** - OAuth2 integration
- **Dropbox** - App folder sync
- **OneDrive** - Microsoft account integration
- **Browser Sync** - Chrome's built-in sync

### Editor Features
- **CodeMirror Integration** - Syntax highlighting for JavaScript
- **Multiple Themes** - Monokai, Dracula, Material Darker, Nord, Ayu Dark
- **Code Folding** - Collapse functions and blocks
- **Bracket Matching** - Auto-close and highlight matching brackets
- **Search & Replace** - Ctrl+F find, Ctrl+H replace
- **Linting** - Real-time userscript metadata validation
- **External Editor Support** - Open scripts in vscode.dev

### Security Features
- **Blacklist System** - Block scripts from running on specific sites
  - Remote blacklists (auto-updated)
  - Manual blacklist entries
- **Permission Analysis** - Visual breakdown of requested `@grant` permissions
- **@connect Validation** - Restrict network access domains
- **CSP Handling** - Works on sites with strict Content Security Policies

### Import/Export
- **ZIP Format** - Full backup with all scripts and settings
- **JSON Format** - Text-based backup
- **URL Import** - Install directly from URL
- **Clipboard Import** - Paste scripts from clipboard

### Internationalization
Available in 8 languages:
🇺🇸 English | 🇩🇪 German | 🇪🇸 Spanish | 🇫🇷 French | 🇯🇵 Japanese | 🇵🇹 Portuguese | 🇷🇺 Russian | 🇨🇳 Chinese

---

## 📦 Installation

### From Source (Developer Mode)

1. Clone or download this repository:
   ```bash
   git clone https://github.com/SysAdminDoc/ScriptVault.git
   cd ScriptVault
   ```

2. Open Chrome and navigate to `chrome://extensions`

3. Enable **Developer mode** (toggle in top right)

4. Click **Load unpacked**

5. Select the `scriptvault` folder

6. **For Chrome 138+**: Click the extension's "Details" and enable "Allow User Scripts"

### Chrome Web Store
*Coming soon*

---

## 🚀 Quick Start

### Installing Userscripts

**Method 1: Direct URL**
Navigate to any `.user.js` file URL - ScriptVault automatically detects and opens the installation page.

**Method 2: From Dashboard**
1. Click the ScriptVault icon → **Open Dashboard**
2. Go to **Utilities** tab
3. Paste a URL or script code
4. Click **Import**

**Method 3: Create New**
1. Open Dashboard
2. Click the **+** button
3. Write your script using the built-in editor
4. Press **Ctrl+S** to save

### Managing Scripts

- **Toggle scripts** - Click the checkbox next to any script
- **Edit scripts** - Click the script name to open the editor
- **Delete scripts** - Click the trash icon
- **View storage** - Click the database icon to see/edit GM_getValue data

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+Shift+S` | Open ScriptVault popup |
| `Alt+Shift+D` | Open Dashboard |
| `Alt+Shift+E` | Toggle all scripts on/off |
| `Ctrl+S` | Save script (in editor) |
| `Ctrl+F` | Find in script |
| `Ctrl+H` | Find and replace |
| `Ctrl+G` | Go to line |

---

## 🔧 Supported Metadata

ScriptVault supports all standard userscript metadata:

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
- `document-start` - Run before DOM loads
- `document-body` - Run when body element exists
- `document-end` - Run when DOM is complete (default)
- `document-idle` - Run when page is fully loaded

---

## 🔐 Security Model

ScriptVault takes security seriously:

1. **Script Isolation** - Scripts run in isolated `USER_SCRIPT` world via `chrome.userScripts` API
2. **Permission Transparency** - Installation page shows all requested permissions
3. **Network Restrictions** - `@connect` domains are validated
4. **Blacklist Protection** - Block known malicious scripts
5. **No Phone Home** - Zero telemetry, all data stays local (unless you enable cloud sync)

---

## 🆚 Comparison

| Feature | ScriptVault | Tampermonkey | ViolentMonkey |
|---------|----------------|--------------|---------------|
| Manifest V3 | ✅ | ✅ | ✅ |
| Full GM API | ✅ 24+ functions | ✅ | ✅ |
| Cloud Sync | ✅ 5 providers | ✅ | ✅ |
| Open Source | ✅ MIT | ❌ | ✅ |
| Free | ✅ | Freemium | ✅ |

---

## 📁 Project Structure

```
scriptvault/
├── manifest.json          # Extension manifest
├── background.js          # Service worker (API, sync, registration)
├── content.js             # Content script bridge
├── pages/
│   ├── dashboard.html/js/css  # Main settings UI
│   ├── popup.html/js          # Toolbar popup
│   └── install.html/js        # Script installation page
├── images/
│   └── icon*.png          # Extension icons
├── lib/
│   └── codemirror/        # CodeMirror editor
└── _locales/
    └── */messages.json    # Translations
```

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Tampermonkey](https://www.tampermonkey.net/) - For setting the standard in userscript management
- [ViolentMonkey](https://violentmonkey.github.io/) - For Manifest V3 inspiration
- [CodeMirror](https://codemirror.net/) - Excellent code editor
- [fflate](https://github.com/101arrowz/fflate) - Fast ZIP library

---

<p align="center">
  <strong>ScriptVault v1.1.0</strong><br>
  <em>Your scripts, your rules — locked down and loaded</em>
</p>
