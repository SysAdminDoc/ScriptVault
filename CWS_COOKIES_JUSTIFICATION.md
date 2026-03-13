# ScriptVault - Cookies Permission Justification (Chrome Web Store)

## Permission: `cookies` (optional)

### Single Purpose Description

ScriptVault is a userscript manager that allows users to install and run custom JavaScript userscripts on web pages. The `cookies` permission is listed as an **optional permission** and is only activated when a user installs a userscript that explicitly declares `@grant GM_cookie` or `@grant GM.cookie` in its metadata.

### Why the `cookies` permission is needed

ScriptVault implements the `GM_cookie` API, which is part of the standard Greasemonkey/Tampermonkey userscript API specification. This API provides three functions:

- **`GM_cookie.list()`** — Reads cookies for a specific domain (calls `chrome.cookies.getAll()`)
- **`GM_cookie.set()`** — Sets a cookie on a specific domain (calls `chrome.cookies.set()`)
- **`GM_cookie.delete()`** — Removes a cookie from a specific domain (calls `chrome.cookies.remove()`)

These functions are required for compatibility with existing userscripts that depend on cookie access for legitimate purposes such as:

- Managing login sessions across subdomains
- Clearing tracking cookies from specific sites
- Reading site preferences stored in cookies
- Automating cookie consent workflows

### How it is used

1. The `cookies` permission is declared as an **optional permission** in `manifest.json` — it is never granted at install time.
2. When a user installs a userscript containing `@grant GM_cookie`, ScriptVault requests the permission via `chrome.permissions.request()` with an explicit user prompt.
3. Cookie operations are gated by a per-script `@grant` check — scripts without the `GM_cookie` grant cannot access cookie functions even if the permission has been granted.
4. An additional user-facing setting ("Allow scripts to access cookies") in the dashboard provides a global toggle for cookie access.
5. The extension does not read, modify, or transmit cookies for its own purposes. All cookie operations are initiated exclusively by user-installed userscripts.

### User control

- Users choose which userscripts to install and can review `@grant` declarations before installation.
- The optional permission prompt gives users an explicit opt-in at the browser level.
- The dashboard settings panel provides a global cookie access toggle.
- Users can revoke the optional permission at any time via Chrome's extension settings.

### Privacy

ScriptVault does not collect, store, or transmit any cookie data. Cookie operations occur entirely on the user's device between the userscript and the browser's cookie store. No cookie data is sent to any remote server by the extension itself. See our [Privacy Policy](https://github.com/SysAdminDoc/ScriptVault/blob/main/PRIVACY.md) for full details.

---

## CWS Submission Form — Suggested Text

**"Why does your extension need the `cookies` permission?"**

> ScriptVault is a userscript manager. The `cookies` permission is declared as optional and is only requested when a user installs a userscript that uses the standard GM_cookie API (`@grant GM_cookie`). This API allows userscripts to list, set, and delete cookies for specific domains — a standard feature of userscript managers (Tampermonkey, Violentmonkey). The permission is never used by the extension itself; it is exclusively used to fulfill userscript API calls initiated by user-installed scripts. Users must explicitly opt in via Chrome's permission prompt, and a dashboard toggle provides additional control. No cookie data is collected or transmitted by the extension.
