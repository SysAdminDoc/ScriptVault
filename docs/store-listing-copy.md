# Store Permission and Privacy Copy

**Last reviewed:** 2026-05-24

This is the reviewer-facing copy source for Chrome Web Store, AMO, and release notes when manifest permissions change. Keep it synchronized with `manifest.json`, `manifest-firefox.json`, and `PRIVACY.md`; `npm run store-copy:check` fails when a manifest permission, host match, web-accessible exposure, sandbox page, or AMO data-collection declaration is no longer covered here.

Primary policy references:

- Chrome Web Store Program Policies require narrow permissions, transparent handling of user data, and disclosure of data use in the store page, UI, or privacy policy.
- Chrome's user-data FAQ says extensions should include the permissions used and why they are required in the store listing or extension about page, and that dashboard disclosures, privacy policy, and product behavior must stay consistent.
- Chrome extension permission docs note that `permissions`, `optional_permissions`, `host_permissions`, `content_scripts.matches`, and optional host permissions can affect user warnings.
- Firefox requires `browser_specific_settings.gecko.data_collection_permissions` for new AMO submissions and signing from November 3, 2025.

## Store listing permission justifications

| Surface | Token | Store listing copy |
|---|---|---|
| permission | `storage` | Saves installed scripts, extension settings, folders, local values, cached dependencies, and backups locally so the manager works offline. |
| permission | `tabs` | Reads the active tab URL/title for script matching and supports user-triggered `GM_openInTab` behavior from installed scripts. |
| permission | `notifications` | Shows update status, script notifications, and user-visible sync/install results when the user enables those workflows. |
| permission | `contextMenus` | Adds context-menu actions so users can run scripts or open ScriptVault tools from the current page. |
| permission | `menus` | Firefox equivalent of the context-menu surface used to run scripts or open ScriptVault tools from the current page. |
| permission | `scripting` | Injects the ScriptVault content bridge and script injection support needed for user-installed scripts. |
| permission | `userScripts` | Registers userscripts in the browser `USER_SCRIPT world` so installed scripts run with isolated extension-managed APIs. |
| permission | `webNavigation` | Observes frame navigation and document lifecycle events so scripts run at their configured `@run-at` timing. |
| permission | `unlimitedStorage` | Avoids quota loss for larger local libraries, cached dependencies, backup history, and import/export data. |
| permission | `alarms` | Schedules update checks, scheduled sync, periodic backups, and maintenance tasks without external services. |
| permission | `downloads` | Enables user-triggered `GM_download`, script export, backup export, and HAR/report downloads. |
| permission | `declarativeNetRequest` | Applies per-script network rules declared by userscript metadata, including local webRequest metadata handling. |
| permission | `declarativeNetRequestWithHostAccess` | Applies host-backed DNR rules only on matching sites where the installed script is allowed to operate. |
| permission | `sidePanel` | Opens the browser side panel UI for quick script management while browsing. |
| permission | `offscreen` | Uses an offscreen document for background export and UI-adjacent work that cannot run directly in the service worker. |
| optional_permission | `clipboardWrite` | optional clipboard write access supports user-triggered copy/export actions and script APIs. |
| optional_permission | `clipboardRead` | optional clipboard read access supports user-triggered paste/import actions and script APIs. |
| optional_permission | `identity` | Optional Chrome OAuth access enables cloud sync providers such as Google Drive, Dropbox, OneDrive, and Easy Cloud when the user signs in. |
| optional_permission | `cookies` | optional cookie access supports user-requested scripts that need cookie-aware requests for sites the user controls or chooses. |
| optional_permission | `userScripts` | Firefox optional grant for the `USER_SCRIPT world`; ScriptVault asks only when the Firefox validation flow needs the API. |
| host_permission | `<all_urls>` | Host permission is required because userscripts can be installed for user-chosen sites across the web; execution is still limited by each script's metadata and user controls. |
| content_script_match | `<all_urls>` | Content script match lets ScriptVault detect `.user.js install` pages and establish the content bridge at document start on sites where scripts may run. |
| web_accessible_match | `<all_urls>` | Web-accessible match exposes only the install confirmation page to matching pages so direct `.user.js` installs can hand off to the extension UI. |
| web_accessible_resource | `pages/install.html` | `pages/install.html` is the web-accessible resource and install confirmation page used for user-approved script review before saving or running a script. |
| sandbox_page | `pages/editor-sandbox.html` | `pages/editor-sandbox.html` hosts the sandboxed editor and Monaco integration so editing tools stay isolated from extension pages. |
| data_collection_required | `none` | Required data collection is `none`: ScriptVault does not require developer-operated analytics, telemetry, accounts, or server-side storage. |
| data_collection_optional | `authenticationInfo` | `authenticationInfo` may be transmitted only when a user signs in to a configured OAuth cloud sync provider; OAuth tokens stay local except for provider exchanges. |
| data_collection_optional | `technicalAndInteraction` | `technicalAndInteraction` may be transmitted only by user-configured sync, backup, support export, or error diagnostics flows; ScriptVault has no external telemetry beacon. |
| data_collection_optional | `websiteActivity` | `websiteActivity` may be accessed locally so installed scripts match selected pages and may be transmitted only by user-installed scripts or configured sync/export actions. |
| data_collection_optional | `websiteContent` | `websiteContent` may be accessed for user-installed scripts and `GM_xmlhttpRequest`/resource flows, then transmitted only to URLs selected by the user or the installed script metadata. |

## Chrome Web Store Privacy Practices

Single purpose:

ScriptVault is a local-first userscript manager that lets users install, edit, run, update, back up, and sync their own userscripts.

Data-use summary:

- ScriptVault stores installed scripts, script settings, local values, folders, backups, and extension settings on the user's device.
- ScriptVault does not run developer-operated analytics, telemetry, advertising, tracking pixels, or remote configuration.
- Network requests happen for user-selected script installs, `@require`/`@resource` fetches, update checks, user-installed script network APIs, or cloud sync providers the user explicitly configures.
- Website access exists so user-installed scripts can run on the sites selected by each script's `@match`/`@include` metadata and the user's enable/disable controls.
- OAuth or sync credentials are used only for the provider chosen by the user; they are not sold, shared for advertising, or sent to ScriptVault-operated servers.

Limited Use statement:

The use of information received from Google APIs will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements. ScriptVault uses Google API information only to provide user-configured extension functionality such as cloud sync, does not sell or transfer that information for advertising, and does not allow human access except where legally required or explicitly authorized by the user for support.

## AMO Data Collection Copy

The Firefox manifest declares required data collection as `none` and optional categories for features the user may enable:

- `authenticationInfo`: provider authentication for user-configured cloud sync.
- `technicalAndInteraction`: local diagnostics, settings, and support/export data when the user chooses to share or sync it.
- `websiteActivity`: matching and running installed scripts on user-selected websites.
- `websiteContent`: script/resource/network flows initiated by installed userscripts.

Firefox validation packages currently omit Chrome `identity`; WebDAV remains the in-scope sync provider until a dedicated Firefox OAuth permission pass lands.
