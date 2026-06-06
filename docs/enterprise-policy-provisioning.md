# Enterprise Policy Provisioning

ScriptVault supports Chrome and Edge managed-storage provisioning through the
`storage.managed_schema` declaration in `manifest.json`.

Administrators can define these managed policy keys:

- `managedScripts`: array of managed userscript entries. Each entry can provide
  either `url` for a remote `.user.js` install through ScriptVault's normal
  remote-source guards, or `code` for complete inline userscript source.
- `managedScriptsCleanup`: optional boolean. When true, locally stored managed
  scripts whose policy origin key is no longer present are pruned.

Example policy payload:

```json
{
  "managedScripts": [
    { "url": "https://intranet.example/scripts/helpdesk.user.js" },
    { "code": "// ==UserScript==\n// @name Managed Inline\n// @namespace corp\n// @match https://example.com/*\n// ==/UserScript==\nconsole.log('managed');" }
  ],
  "managedScriptsCleanup": true
}
```

The service worker restricts `chrome.storage.managed` to trusted extension
contexts when the browser supports `setAccessLevel()`. Installed managed
scripts receive a dashboard `Managed` badge and a local `settings.managed`
marker. Inline policy entries are tracked by SHA-256 origin keys rather than by
source snippets.

The local health report includes aggregate managed-policy diagnostics for
support: managed-storage availability, policy read status, configured entry
counts, cleanup state, installed managed-script count, and the last apply run's
attempt/install/failure/skip/prune counts. It does not include policy URLs,
inline source, origin keys, script names, script IDs, raw errors, account data,
or external beacons.
