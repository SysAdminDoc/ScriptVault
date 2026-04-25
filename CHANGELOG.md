# Changelog

All notable changes to ScriptVault will be documented in this file.

## [v2.3.4]

- Fixed: Two inline `<script>` blocks violated the `extension_pages` CSP (`script-src 'self'`). `pages/dashboard.html` had a 75-line view-settings controller (zoom + density) and `pages/devtools.html` had a 9-line panel registration call — both blocked at load time, leaving the dashboard's zoom/density toolbar inert and the DevTools panel un-registered. Extracted to `pages/dashboard-viewsettings.js` and `pages/devtools.js`. The remaining inline script in `pages/editor-sandbox.html` is the Monaco bootstrap and is allowed by the sandbox CSP (`'unsafe-inline'`).
- Chore: Moved self-distribution signing keys (`scriptvault.pem`, `scriptvault-selfhost.pem`) out of the repo root to `~/.scriptvault-keys/`. Chrome's "Load unpacked" warned `This extension includes the key file ... You probably don't want to do that` because anything inside the extension dir gets bundled at build/install time. `pack-crx.mjs` already takes the key path as a positional CLI arg, so callers just pass `~/.scriptvault-keys/scriptvault-selfhost.pem` now. Both keys remain gitignored.

## [v2.3.3]

- Fixed: Setup-required warning banner stuck in the popup after the user enabled the "Allow User Scripts" toggle in `chrome://extensions`. `getExtensionStatus` was AND-ing a cached `settings._userScriptsAvailable` flag with the live `chrome.userScripts` check, so once the cache was `false` it dominated even when the API became available; nothing in the request path flipped the cache back. The handler now ignores the cache, probes the API live (presence + a `getScripts()` call to catch the post-138 "Allow User Scripts" gate), refreshes the cache to whatever the live probe returned, and runs `configureUserScriptsWorld()` opportunistically so registrations work on next save without forcing an SW reload. Symptom is now self-healing: enabling the toggle and reopening the popup clears the banner immediately.

## [v2.3.2]

- Fixed: `background.core.js` `parseCronToMinutes()` JSDoc block contained `"*/n * * * *"` — the `*/` inside the string literal terminated the block comment early, so the rest of the doc text was parsed as code. After esbuild concatenation this became a hard `SyntaxError: Unexpected token '*'` at line 14298 of `background.js`, which prevented the service worker from booting. Symptom in the field: opening the popup did nothing — Find New Scripts, Create New Script, Dashboard, Utilities, and the per-script toggles were all dead, because `chrome.runtime.sendMessage` had no live receiver and `popup.js init()` blocked on the un-timed-out `loadAllScripts()` await before `setupEventListeners()` could attach handlers. Replaced the JSDoc with line comments and rephrased the description so it never contains `*/`. Rebuilt `background.js`.

## [v2.3.1]

- Fixed: `manifest.json` referenced `icons/16.png` / `icons/32.png` / `icons/48.png` / `icons/128.png`, but the `icons/` directory was deleted in v2.3.0's branding cleanup — extensions failed to load with `Could not load icon 'icons/16.png' specified in 'icons'`. Repointed manifest, `pages/popup.html`, `modules/public-api.js`, `modules/backup-scheduler.js`, and the TypeScript mirror at `src/modules/public-api.ts` to the surviving `images/icon{16,32,48,128}.png` files. Firefox manifest was already correct.

## [v2.3.0]

- Fixed: Weekly-digest alarm (`scriptvault-weekly-digest`) was never dispatched — `chrome.alarms.onAlarm` in `background.core.js` only routed `autoUpdate`, `autoSync`, and a handful of internal names, so `NotificationSystem.handleAlarm()` was unreachable and users who enabled digest notifications got nothing. The listener now delegates unknown alarms to `NotificationSystem.handleAlarm()` first.
- Fixed: `ScriptSigning.verifyScript()` trust-store lookup used bare `trustedKeys[signatureInfo.publicKey]`, so a malicious signed script whose publicKey collided with an inherited `Object.prototype` property (e.g. `toString`, `hasOwnProperty`, `valueOf`) would resolve to the inherited function and be reported as `trusted: true`. Replaced with `Object.hasOwn()` guard in both `bg/signing.js` and the TypeScript mirror at `src/bg/signing.ts`. Two regression tests added.
- Fixed: `ScriptValues.set()` / `delete()` / `setAll()` / `deleteMultiple()` mutated the in-memory cache before awaiting persistence, with no rollback on failure. If `chrome.storage.local.set` threw (quota exceeded, transient error), callers saw the new value in-memory but storage kept the old — and a bogus change notification fired for the write that never landed. All four methods now snapshot prior state, defer notifications until after the successful write, and roll back the cache + rethrow on persist failure. Five regression tests added in `tests/storage.test.js`.
- Fixed: `ScriptStorage.clear()` had no rollback on `chrome.storage.local.set` failure — cache was wiped in-memory while storage kept the old data, drifting until SW restart. Added try/catch rollback matching the pattern used by `set()`.
- Fixed: `FolderStorage.update()` had no rollback on save failure and used `Object.assign` over the whole folder; if save threw, the folder retained partial updates. Now snapshots only the mutated fields so rollback doesn't clobber concurrent writes to unrelated properties. Regression test added.
- Hardened: `GM_addElement` attribute setter (background.core.js) now applies the same sanitization to the `attrs` object path that the `innerHTML` path already enforces — drops `on*` event handlers and rejects `javascript:` / `vbscript:` URLs regardless of attribute name (href, src, xlink:href, formaction, poster, etc.). Previously the `innerHTML` branch was sanitized but `el.setAttribute('onclick', ...)` via attrs was a free XSS for any userscript that called `GM_addElement`.
- Hardened: `pages/install.js` `renderInstallUI()` now returns early with a user-visible error if `#content` or `#install-type-badge` is missing, instead of crashing on `badge.innerHTML =` and leaving the page blank with no feedback.
- Hardened: `pages/sidepanel.js` `openInEditor()` and the dashboard-open button handlers now `.catch()` the `chrome.runtime.sendMessage()` promise — prevents `Unchecked runtime.lastError` console spam when the background service worker is in the process of waking.
- Fixed: `requireCache` in-memory Map is now capped at 500 entries (LRU eviction) to prevent unbounded service worker memory growth
- Fixed: `QuotaManager.getBreakdown()` now uses `TextEncoder` for accurate UTF-8 byte counts instead of JS string `.length` (affects non-ASCII script content)
- Fixed: `npm-resolve.js` `getPackageInfo()` wraps `JSON.parse` in try/catch — malformed npm registry responses no longer crash the resolver
- Fixed: `verifySRI()` now logs a `console.warn` for unverifiable MD5 hashes and unexpected SubtleCrypto errors instead of failing silently
- Fixed: `backup-scheduler.js` backup IDs now use `crypto.randomUUID()` for collision-proof uniqueness
- Fixed: `sidepanel.js` `$()` helper now returns `null` for missing elements; callers updated with proper null guards (previously returned detached `<div>`, masking missing-element bugs)
- Chore: Updated stale `v2.0.0` version comments in `pages/install.js`, `modules/migration.js`
- Chore: Updated `Migration.CURRENT_VERSION` to `2.3.0` so future migration steps target the right version range

## [v2.2.0]

- Fixed: `GM_addValueChangeListener` `remote` flag — listener callbacks in the tab that called `GM_setValue`/`GM_deleteValue` now correctly receive `remote: false`; all other tabs receive `remote: true` (Tampermonkey spec compliance)
- Fixed: ZIP import in popup used O(n²) string-concatenation `btoa` encoding — replaced with chunked 8 KB approach (matches the dashboard implementation)
- Chore: Removed dead 4th argument from three `showPopupEmptyState()` call sites in popup.js
- Chore: Updated stale `v2.0.0` version comments in popup.js and dashboard.js

## [v2.1.9]

- Added: `@crontab` metadata directive — schedule script execution via cron expressions (`*/5 * * * *`, `0 * * * *`, `0 0 * * *`, etc.)
- Added: `GM_info.injectInto` property — reports the script's `@inject-into` value
- Added: `$DATETIME$` template variable — auto-populates with today's ISO date when creating scripts from templates
- Added: F8 / Shift+F8 Monaco editor keybindings for linter error navigation (next/previous marker)
- Fixed: `GM_xmlhttpRequest` body serialization — `Blob`, `File`, `FormData`, and `URLSearchParams` now correctly cross the extension messaging boundary
- Fixed: `setupAlarms()` missing `SettingsManager.get()` call (was referencing undefined `settings`)

## [v2.1.8] - %Y->- (HEAD -> main, origin/main, origin/HEAD)

- Added: Add Firefox port roadmap + session log scaffolding
- v2.1.7: Fix massive editor text (fontSize percentage treated as pixels)
- v2.1.6: Fix blank Monaco editor when opening a script to edit
- v2.1.5: Center dashboard toast container at bottom
- v2.1.4: Dashboard debloat pass + light theme readability fix
- v2.1.3: Drop provenance origin badges from dashboard script rows
- v2.1.2: Fix dashboard column header rendering in middle of data rows
- v2.1.1: Fix Monaco editor never loading (sandbox CSP missing unsafe-eval)
- v2.1.0: Strip popup search, filters, and script row chrome (-613 lines)
- v2.0.9: Debloat toolbar popup (-629 lines)
