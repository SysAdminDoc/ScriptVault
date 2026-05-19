# Changelog

All notable changes to ScriptVault will be documented in this file.

## [v3.11.0] — Storage & persistence rollback hardening + Phase 38 parity wave (2026-05-19)

- Added: **Phase 38.1** `GM_addElement` returns `null` (never throws) on every failure path — non-string/empty tag, `createElement` throws, falsy parent, parent without `appendChild`, or `appendChild` throws. Matches VM v2.37.0 + TM 5.5.6237 contract. Attribute-application errors no longer abort the call. Both runtime JS and TS mirror updated. 3 regression cases.
- Added: **Phase 38.2** dashboard search bar accepts regex via `re:<pattern>` (case-insensitive) or `/pattern/flags` (flags honored verbatim) prefix. `code:` prefix can be combined with regex (`code:re:fetch\(`). Invalid patterns never throw — short-circuit to no-match and surface via `aria-invalid` + tooltip. 8 regression cases pin the parser. TM 5.5.6234 parity.
- Added: **Phase 38.4** popup gains a dedicated "Context-menu scripts" section above the main list that surfaces `@run-at context-menu` scripts as one-tap launchers. Hidden when none match the active tab. 6px corner-radius count badge. TM 5.5.6234 parity.
- Added: **Phase 38.6** `window.onurlchange` subscribes to `navigation.addEventListener('navigate', ...)` as the primary detector. Catches SPA navigations that bypass pushState/replaceState (direct location assignment, library routers). pushState/replaceState/popstate/hashchange shim preserved as backstop for the Firefox port. ScriptCat v1.4 parity.
- Changed: **Phase 38.8** per-script settings panel section label `Updates` → `Update` (singular) to match VM v2.37.1 / TM split-tab convention.
- Changed: **Phase 38.9** per-script "check for updates" icon click is now check-only with a three-button confirmation modal (`View diff` / `Install update` / `Cancel`). Right-click still triggers the force-update bypass-cache path. Bulk update + popup "update" entries keep auto-installing because they have their own progress-modal confirmation. VM v2.37.1 footgun fix.
- Audited: **Phase 38.11** GM_xmlhttpRequest service-worker event-leak bug class does not translate to ScriptVault — uses AbortController + one-shot tabs.sendMessage, not persistent port.onMessage/onDisconnect subscribers. 3 regression cases pin the no-leak invariant: 1000 sequential create→remove cycles leave the table empty after auto-cleanup window; abortByScript/abortByTab remove matching requests without zombies.
- Added: **Phase 38.12** singular `tag` getter alias on `GM_info.script` (`get tag() { return Array.isArray(this.tags) ? this.tags[0] : undefined; }`) so pre-2026 scripts written against Violentmonkey's singular form keep working. VM v2.37.0 back-compat. 2 regression cases.
- Added: **Phase 38.13** multi-key rollback contract regression suite (`tests/storage.test.js`) — 7 cases pinning the cache↔persisted-state consistency invariant across `ScriptStorage.set` (update + insert), `ScriptStorage.delete` (script + values atomic restore), `ScriptStorage.clear` (all-or-nothing across multiple value bags), `ScriptValues.setAll` (batch atomicity), `FolderStorage.update` (unrelated-field preservation), `SettingsManager.set` (cache revert), and `invalidateMatchSet` suppression on rollback. The contract was already enforced by the v3.10.1 → HEAD storage-hardening commits (aca9e8c → a1e89c9); the suite locks it in.
- Storage hardening commits (folded under this release per Phase 38.13 grouping): `aca9e8c` clone storage write boundaries, `4f1e25e` isolate settings snapshots from cache, `a4c2c02` rollback settings cache on persist failure, `3b576c3` harden script value storage keys, `5d0d479` harden imported script ID handling, `d35fce7` preserve script IDs in runtime ZIP restores, `cdf17ae` harden factory reset storage cleanup, `f5f6640` rollback workspace activation state on save failure, `42e6a10` harden folder and workspace persistence rollback, `bf409f1` harden wrapper DOM and network hooks, `a1e89c9` harden userscript bridge and network fetches.
- Changed: `minimum_chrome_version` 120 → 130 (Phase 40.23). Picks up ~10 versions of cumulative security patches and aligns with the `storage.session.getKeys()` requirement.
- Tests: 42 test files, 712/712 green. `tsc --noEmit` strict clean. background.js 19,405 lines.

## [v3.10.1] — Polish polish: token-clean diff view + feature badges + button refinements

- Changed: `.feature-storage` / `.feature-xhr` / `.feature-style` / `.feature-notify` / `.feature-menu` / `.feature-unsafe` badges no longer hardcode `#22c55e33`/`#60a5fa33`/etc. — they reference `--tint-{green,blue,purple,yellow,orange,red}-soft` so the badges retint correctly in light/catppuccin themes instead of staying dark-mode-only.
- Changed: diff view (`.diff-add`, `.diff-del`, `.diff-add-count`, `.diff-del-count`, `.diff-add .diff-sign`, `.diff-del .diff-sign`) now uses `var(--accent-green)` / `var(--accent-red)` / `var(--tint-*-soft)` instead of literal hex. Light-theme diffs are readable now.
- Changed: `.toolbar-btn` got tokenised transitions, hairline border on hover, and a 0.5px press-down on `:active` for premium tactile feel. Border-radius bumped to `--r-sm`.
- Changed: `.modal-close` is now a 28×28 hit target with rounded-square hover background instead of a bare floating × — matches the rest of the icon-button system, easier to click, focusable.
- Tests: 601/601 green. CSS-only.

## [v3.10.0] — Premium UX polish (design tokens, multi-theme dashboard, refined components)

- Added: design-token layer at the top of `pages/dashboard.css` — `--hairline`, `--hairline-strong`, `--shadow-sm/md/lg`, `--overlay-scrim`, `--r-xs/sm/md/lg/pill`, `--t-fast/base/slow`, `--ease-out`, `--ease-spring`, `--focus-ring`, and per-accent `--tint-*-soft/edge` variants. Theme-aware via `[data-theme="light|catppuccin|oled"]` overrides; `color-scheme` declared so native form controls pick the right palette.
- Changed: dropped the neon-green slabs. `<th>` lost its 2px green bottom-border in favour of a hairline + uppercase 11px label; `.section-label` lost its 3px green right-bar in favour of a 1px hairline divider with refined typography. Active tabs now show a 2px accent indicator strip via `::after` rather than the old margin-overlap trick.
- Changed: table rows render as a calm hairline-shadow stack instead of hard 1px borders; selected rows get an inset 3px accent-blue rail. Empty-state typography tightened (h3 promoted to `--text-primary` / 600 weight); spinner reduced 28→24px and slowed slightly for less mechanical feel.
- Changed: toasts now have variant-tinted backgrounds + accent stripe (success / error / warning each get their own soft tint and inset 3px stripe). Modals get `backdrop-filter: blur(4px)` on the scrim, spring-eased scale-and-translate enter, and `--shadow-lg` elevation. Scrollbars are 10px transparent-track / pill-thumb that adapts to theme.
- Changed: snippet-item hover replaced its `transform: translateX(4px)` with a calmer accent-green inset stripe + 4px padding shift. Toggle switches gained an inner hairline border on OFF and a subtle knob shadow; checked transition uses spring easing.
- Added: global premium-polish layer at end-of-file — system-wide `:focus-visible` ring (2px accent-blue + 4px halo), `::selection` styling, tabular-nums on numeric columns (`.col-version`, `.col-size`, `.col-order`, `.col-updated`), and elevation on `.modal` / `.cmd-dialog`.
- Compatibility: every legacy CSS variable (`--bg-body`, `--bg-row*`, `--border-section`, `--toggle-on/off`, `--accent-*`, etc.) is preserved unchanged so the runtime theme editor (`pages/dashboard-theme-editor.js`), inline `[data-theme]` blocks in `pages/dashboard.html`, and dashboard JS modules continue to work without touch. Pure CSS pass; no HTML or JS changes.
- Tests: 601/601 green (no functional change).

## [v3.9.0] — Round 10 parser & template wins (Phases 36.4, 36.6, 36.11)

- Added: `@tag` round-trip preservation. User-assigned tags now survive script re-install and update — `getMetaArray('tag')` unions source-declared and existing tags (dedupe, first-seen order). VM v2.35.2 parity. Phase 36.4.
- Added: comma-separated convenience syntax for URL pattern arrays. `// @match a.com,b.com,c.com` now expands to three patterns at install time. Same desugaring applies to `@include`, `@exclude`, `@exclude-match`, `@connect`. `@tag` is intentionally left raw so multi-word values like `tools,utility` round-trip intact. Mirrored in `src/background/parser.ts`, `background.core.js`, and `tests/parser.test.js`. VM #2403. Phase 36.6.
- Added: `{{icon}}` template token. The blank-script template now ships with `// @icon {{icon}}` and resolves the active tab's `favIconUrl` at create-time. `{{name}}`, `{{match}}`, and `{{namespace}}` already resolved; this completes the standard set. Unresolvable directive lines are stripped to keep generated headers clean. Phase 36.11.
- Tests: 5 new regressions in `tests/parser.test.js` covering comma-split for `@match`/`@exclude-match`, single-pattern preservation, multi-word `@tag` retention, and the deliberate non-split of comma-bearing tag values. 601/601 green.

## [v3.8.0] — Install from Local File + Drag-and-Drop (Phase 12.9)

- Added: file-picker install in the dashboard Import section. Pick a `.user.js` (or `.js`) file from disk and ScriptVault parses, validates, and installs it the same way URL installs do — same 5MB ceiling, same name+namespace dedupe, same `==UserScript==` requirement.
- Added: drag-and-drop install. Drop one or more `.user.js` files anywhere on the dashboard and the page dims with a "Drop .user.js to install" overlay; on release each file is parsed and installed in sequence with a single end-of-batch toast.
- Added: new background message `installFromCode` (and `installFromCode(code)` helper exported from `src/background/install-handler.ts`). `installFromUrl` is now a thin wrapper that fetches the URL and delegates to `installFromCode`, so both paths share the same parse/dedupe/registration flow.
- Source: TM issue [#2722](https://github.com/Tampermonkey/tampermonkey/issues/2722).

## [v3.7.0] — In-app update notifications + summary OS notifications (Phase 12.10)

- Changed: `applyUpdate` no longer fires a per-script OS notification. Previously a 10-script auto-update cycle would trigger 10 OS-level "Script Updated" toasts back-to-back; now `autoUpdate` aggregates the cycle's successful updates and fires at most one summary notification (`"3 scripts updated: A v1.0 → v1.1, B v2.0 → v2.1, C v0.4 → v0.5"`).
- Added: in-app dashboard banner that lists scripts auto-updated since the last visit. Lands at the top of the Scripts tab on dashboard load. Dismiss button clears the ring on the background side so the banner stays gone next visit.
- Added: `UpdateSystem._recentUpdates` ring buffer (cap 20, newest first) plus `getRecentUpdates` / `clearRecentUpdates` background message handlers.
- Manual single-script flows (popup "Check for Update", dashboard force-update) keep their inline feedback path — they don't push onto the ring or fire a summary notification.

## [v3.6.3] — Beautify preserves cursor + scroll (Phase 7.5)

- Fixed: `beautifyCode` (editor toolbar "Beautify" button) used to slam the cursor to line 0, char 0 after every reformat. On a long file you'd lose your place every time you hit it. The cursor + vertical scroll position now stay where they were.
- Approach: capture cursor + scroll before the reformat, then map the old column to the new one — `newCh = newLeadingWS + max(0, oldCh - oldLeadingWS)` — since beautify only changes leading whitespace, the same logical line exists before/after with the same trimmed content. Cursors that sat inside the indent region snap to the start of the content on the new line.
- Falls back to the old behaviour (cursor at top) only if the editor adapter doesn't expose `getCursor()` (e.g. some Monaco-adapter edge cases on first-paint).

## [v3.6.2] — Drop fake gist token encryption (Phase 5.5)

- Removed: the AES-GCM encryption around the GitHub gist PAT was security theater. The key was derived via PBKDF2 from two string literals (`'ScriptVault-Gist-Key-v1'` + `'sv-gist-salt'`) embedded in the source — anyone with the encrypted blob and access to this file could derive the same key. Tokens now live in `chrome.storage.local` plaintext; that storage is already sandboxed by Chrome at the extension boundary, which is the actual protection.
- Migration: existing installs decrypt their stored token once (using the same legacy hardcoded inputs), re-save it under the new `gist_pat` key, and drop the legacy `gist_pat_encrypted` entry. Best-effort — if the one-shot decryption or write fails, the next dashboard load retries.
- Hardened: `clearToken()` now removes both the new and the legacy storage keys defensively, so a sign-out followed by a downgrade can't leak a token via the legacy key.
- UX: the gist setup hint now describes the storage model honestly ("Stored in `chrome.storage.local`, sandboxed by Chrome — readable only by ScriptVault") instead of claiming local encryption.

## [v3.6.1] — Webhook SSRF guard (Phase 5.5)

- Hardened: `PublicAPI.setWebhook` now rejects URLs that point at internal/loopback hosts. Previously the only validation was `https://` — a malicious web origin with capability-token access could register a webhook at `https://192.168.1.1/admin` or `https://169.254.169.254/latest/meta-data/` (cloud metadata) and exfiltrate or trigger LAN-side actions when the extension fired the webhook.
- Coverage matches the existing `_isInternalHost` SSRF guard already used by the install-from-URL flow: localhost aliases, IPv4 loopback (127/8), unspecified (0/8), RFC 1918 (10/8, 172.16/12, 192.168/16), CGNAT (100.64/10), link-local (169.254/16), broadcast, IPv6 loopback (`::1`), IPv6 link-local (`fe80::/10`), and IPv6 ULA (`fc00::/7`).
- Added: 7 new tests pinning the rejection set (localhost, RFC 1918 sweep, link-local, IPv6 loopback, IPv6 link-local, malformed URL) plus regression tests confirming public hostnames + public IPv4 still work. 596 tests pass total.
- Internal: TS mirror in `src/modules/public-api.ts` matched. The JS source got a small `isInternalWebhookUrl()` wrapper around `_isInternalHost` so the install-flow guard and the webhook guard share classification logic without duplication.

## [v3.6.0] — Update-check exponential backoff (Phase 6.1)

- Added: per-script exponential backoff in `UpdateSystem.checkForUpdates`. A network error or non-2xx response increments `script._updateFailureCount` and stamps `script._updateNextCheck = now + 2^(failures-1) * 1min`, capped at 24 hours. The auto-update path skips scripts whose cooldown hasn't elapsed; manual single-script checks (popup "Check for Update", dashboard force-update) bypass the cooldown so users see fresh failures immediately.
- Fixed: scripts with a permanently broken `updateURL` previously consumed bandwidth on every periodic alarm. The new backoff means a dead URL retries at most ~17 cooldowns/day instead of every check interval.
- Changed: a 304 Not Modified response now also clears the failure count + next-check timestamp (treating it as a successful conditional fetch). Previously 304 just `continue`'d without touching backoff state, so a script that returned 5xx once and then 304 forever would stay in a stale cooldown.
- Added: 4 tests pinning the backoff math (`_nextRetryAt`) — first-failure base interval, doubling progression, 24-hour cap, defensive zero-failures input. 589 tests pass.

The conditional `If-None-Match` / `If-Modified-Since` headers and 304 short-circuit were already implemented; this release adds the resilience layer around them so misbehaving update servers don't waste resources.

## [v3.5.0] — `@weight` injection priority (Phase 11.7)

- Added: `// @weight 1..999` directive (Userscripts/Safari standard). Higher = earlier within the same `@run-at`. Clamped to the documented range so an `@weight 99999` typo can't dominate the sort.
- Changed: `registerAllScripts` sort now uses `Math.max(meta.priority || 0, meta.weight || 0)` so authors who set both don't get surprised by the lower one winning. Existing `@priority` behavior preserved.
- Added: `GM_info.script.weight` and `GM_info.script.priority` so scripts can introspect their own injection ordering hints.
- Added: 5 parser tests covering valid range, clamp-above, clamp-below, default, non-numeric. 585 tests pass.
- Internal: TS mirrors in `src/types/script.ts` and `src/background/parser.ts` now declare the new field; the existing JS-test parser duplicate matched.

## [v3.4.0] — Run on This Tab via chrome.userScripts.execute() (Phase 11.4)

- Added: "Run on This Tab" entry in the popup script-action dropdown. Fires the script once on the active tab without registering it for future page loads — useful for quick-test workflows and for running scripts that aren't enabled or that don't match the current URL.
- Added: `runScriptNow` background message handler. Prefers `chrome.userScripts.execute()` (Chrome 135+) so the script runs in the same `USER_SCRIPT` world as a normal injection — `unsafeWindow` and the GM_* APIs behave identically. Falls back to `chrome.scripting.executeScript({ world: 'MAIN' })` on older Chrome (without GM_* APIs but the script body still runs).
- Internal: `runScriptNow` resolves `@require` dependencies via `fetchRequireScript` exactly like the context-menu run-once path so the one-shot run sees the same library set as a normal injection. Per-require fetch failures are non-fatal.

## [v3.3.0] — GM_notification: progress, buttons, update, close (Phase 11.11)

- Added: `GM_notification({ progress: 0..100 })` — shows a progress bar inside the notification (uses `chrome.notifications.type='progress'`). Useful for download or batch-job scripts.
- Added: `GM_notification({ buttons: [{title, iconUrl}, ...] })` — up to 2 action buttons (Chrome's hard cap; we silently truncate so the platform contract stays explicit). Click events fire the new `onbuttonclick` callback with `{ buttonClickIndex }` (ScriptCat semantics).
- Added: `GM_updateNotification(id, details)` — updates an existing notification by tag without closing it. Fields the caller doesn't pass are left untouched, so partial updates don't blank out the title/message.
- Added: `GM_closeNotification(id)` — programmatically dismisses a notification by tag.
- Added: `GM_notification(...)` now returns a control object `{ close(), update(patch) }` so authors don't have to track tags manually for the common case.
- Internal: new background-side message handlers `GM_updateNotification` and `GM_closeNotification` plus a `chrome.notifications.onButtonClicked` listener that routes button clicks back to the originating tab.
- Internal: `content.js` notification bridge now forwards `buttonIndex` so the wrapper can fire the right callback. Linter `KNOWN_GM_APIS` learned the two new function names.

## [v3.2.1] — @unwrap metadata tag (Phase 11.2)

- Added: `// @unwrap` directive support (Violentmonkey parity). When present, the wrapper builder emits the user code verbatim without the GM API IIFE — useful for ESM-style top-level imports/exports and scripts that intentionally modify the top-level scope. A one-line `console.warn` banner is prepended so authors who set `@unwrap` by mistake can spot it. GM_* APIs are unavailable in this mode.
- Added: install confirmation dialog now displays `unwrapped (no GM_* APIs)` in the run-timing summary so users know what they're agreeing to before installing an `@unwrap`'d script.
- Internal: TS mirror in `src/background/wrapper-builder.ts` updated to match (and now also honours `meta.delay`, which the JS source already did).

## [v3.2.0] — GM_xmlhttpRequest noCache/redirect + GM_info platform parity (Phase 11)

- Added: `GM_xmlhttpRequest({ noCache: true })` (and Tampermonkey's lowercase `nocache` alias) — sets `Cache-Control: no-cache` + `Pragma: no-cache` on the request, but only if the caller didn't already set them (case-insensitive). Closes Violentmonkey issue #2168 / Tampermonkey changelog parity.
- Added: `GM_xmlhttpRequest({ redirect: 'follow' | 'error' | 'manual' })` — forwarded directly to `RequestInit.redirect` so scripts can detect or block redirects. Invalid values are silently dropped (no breakage on typos like `redirect: true`). Closes VM #2359.
- Refactored: extracted the fetch-options translation into `XhrManager.buildFetchOptions(data)` (in `modules/xhr.js` + the TS mirror at `src/modules/xhr.ts`) so the noCache/redirect/credentials rules are unit-testable in isolation. The background `GM_xmlhttpRequest` handler now consumes this helper.
- Added: 9 new tests for `XhrManager.buildFetchOptions` covering case-insensitive Cache-Control/Pragma overrides, valid/invalid redirect values, anonymous credentials, and method default. 580 tests pass across 33 files.
- Added: `GM_info.userAgent`, `GM_info.userAgentData` (clone of `navigator.userAgentData` brands/platform/mobile), and `GM_info.platform.fullVersionList` + `GM_info.platform.mobile` — Phase 11.1 GM_info enrichment for parity with Violentmonkey.
- Hardened: `GM_info.platform.browserName` / `browserVersion` now prefer `navigator.userAgentData.brands` over the legacy `navigator.userAgent` regex, with the regex retained as a fallback for older Chrome.

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
