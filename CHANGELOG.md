# Changelog

All notable changes to ScriptVault will be documented in this file.

## [v3.1.0] — MatchSet precompiled URL lookup + tests target production code

- Added: `MatchSet` precompiled host index (`background.core.js` + `src/background/url-matcher.ts`). Builds an `O(1)` hostname → script bucket so `getScriptsForUrl` no longer linear-scans every script's pattern list. Wildcard subdomains (`*.example.com`) are indexed under their base domain and resolved via parent-suffix walk so deep subdomains (`a.b.example.com`) still hit the bucket. Regex `@include` and patterns without a host hint fall into a universal bucket so the candidate set remains a strict superset of the true match set. Phase 4.2 of the roadmap.
- Changed: `chrome.runtime.onMessage` `getScriptsForUrl` handler now uses `MatchSet.getMatching()` instead of filtering all scripts. Cache invalidates automatically on every `ScriptStorage.set`/`delete`/`clear` via the new `invalidateMatchSet()` global hook.
- Changed: `tests/url-matcher.test.js` now imports directly from `src/background/url-matcher.ts` instead of duplicating ~190 lines of matcher logic. The previous duplicate could (and did) drift away from the real implementation; tests now test what ships.
- Added: 21 new tests covering `MatchSet` (host indexing, wildcard subdomains, universal candidates, port stripping, dedup) and `isUrlBlockedByGlobalSettings` (denied-host suffix-coincidence guard, whitelist/blacklist modes). 571 tests pass.
- Hardened: a `ReDoS` regression test in `matchIncludePattern` proves the `*+ → *` collapse keeps a 80-wildcard pathological pattern under 500 ms (without the collapse it spins for seconds).
- Internal: TS mirror in `src/modules/storage.ts` exports `setScriptChangeListener()` so future TS migration of `background.core.js` can wire the same invalidation pattern without a global.

## [v3.0.2] — Persistent runtime state + smarter wake-time registration

- Added: `SessionState` helper persists `_notifCallbacks`, `_openTabTrackers`, and `_audioWatchedTabs` to `chrome.storage.session` on every mutation, and rehydrates on `init()`. GM_notification onclick/ondone, GM_openInTab onclose, and GM_audio_watchState callbacks now survive service-worker termination instead of silently dropping after the SW idles out.
- Changed: `registerAllScripts` diff-on-wake now also unregisters stale scripts (registered but no longer enabled / no longer in storage). Previously the diff only filled in missing scripts, so deleted/disabled scripts could remain injected until the next forced re-registration.
- Hardened: `chrome.tabs.onRemoved`, `chrome.notifications.onClicked`, and `chrome.notifications.onClosed` now await `ensureInitialized()` before reading hydrated state, eliminating the race where a tab close event firing during SW wake would see an empty tracker map.

## [v3.0.1] — Service worker cold-start guard

- Fixed: `init()`'s promise is now stored on `self._initPromise` so the cold-start guard inside `handleMessage` actually awaits it. Previously the guard was a dormant `if (self._initPromise)` check that never matched because `init()` was called bare. Result: messages arriving during SW wake (popup/dashboard opens, badge update races) would hit handlers before `ScriptStorage` / `SettingsManager` had loaded.
- Added: `ensureInitialized()` helper memoising the init promise; wired into `chrome.runtime.onMessage`, `chrome.runtime.onUserScriptMessage`, `chrome.alarms.onAlarm`, `chrome.commands.onCommand`, `chrome.tabs.onActivated`, and `chrome.tabs.onUpdated` so every wake-triggering event waits for init.
- Changed: `_debouncedStatsSave()` now uses `chrome.alarms.create('statsSave', { delayInMinutes: 0.1 })` instead of `setTimeout(5000)` so the debounce survives SW termination. Stats writes that previously vanished when the SW was killed mid-debounce now coalesce into the next alarm fire.
- Internal: `chrome.alarms.onAlarm` handler routes the new `statsSave` alarm to `ScriptStorage.save()`.

## [v3.0.0] — IndexedDB storage rewrite

**BREAKING:** Major version bump. Storage backend migrated from `chrome.storage.local` (single 10 MB blob) to IndexedDB. Userscripts, GM-values, stats, and backups now live in object stores with per-record reads/writes and transactional safety. Settings and folder index stay in `chrome.storage.local`.

- New: `src/storage/` module — `idb.ts` (low-level wrapper), `transaction.ts` (multi-store helper), `script-db.ts` (schema + DAOs for scripts/values/stats/backups), `migration-v3.ts` (one-shot v2→v3 copy with 30-day legacy tombstone).
- Migration: First v3 boot reads the legacy `userscripts` blob and `values_*` keys, copies them into IDB, stamps `_storageSchema=3`, and leaves the legacy keys in place for 30 days as a downgrade safety net. After TTL the legacy keys are wiped on next boot.
- Refactored: `ScriptStorage` and `ScriptValues` (`src/modules/storage.ts`) now route through the IDB DAOs while keeping their public method surface identical — callers don't change.
- Refactored: `PublicAPI.installScript` (both extension-message and URL-install paths) and `PublicAPI.toggleScript` now persist through `ScriptStorage.set()` instead of writing the legacy `userscripts` blob directly. The legacy fallback in `toggleScript` was dropped — post-migration the IDB store is authoritative.
- Hardened: IDB connection caching tracks the active `IDBFactory` so test runners (and any future SW context that swaps factories) get a fresh connection automatically.
- Internal: `withTransaction()` waits for `oncomplete` before resolving so callers see fully-committed state on resolve, not just queued writes.
- Tests: 550 passing. Added IDB-aware rollback tests via `vi.spyOn(ScriptsDAO, 'delete')` and `vi.spyOn(ValuesDAO, 'setAll')`. `fake-indexeddb` wired into the vitest setup with a per-test `IDBFactory` reset.

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
