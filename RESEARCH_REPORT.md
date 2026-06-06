# Research Report

Status: consolidated docs index plus 2026-06-03 deep research pass.

2026-06-06 Cycle 74 Monaco ESM prototype: X-4 now has a local ESM build path,
but the sandbox has not switched away from AMD. `src/editor/monaco-esm-entry.ts`
sets file-backed worker URLs, `esbuild.config.mjs --monaco-esm-only` emits
`lib/monaco-esm/editor.js`, `editor.css`, a codicon font asset, and deterministic
worker files, and `npm run monaco:esm:check` validates the post-build layout.
The committed evidence in `docs/audit/monaco-esm-prototype-2026-06-06.json`
shows the TypeScript worker at 12,156,466 bytes, so the next implementation
decision is whether to accept a full Chromium-only worker package behind an
explicit budget or slim the bundle before replacing the AMD sandbox loader.

2026-06-06 Cycle 73 Monaco package guard: X-4 has its first implementation
slice, but the ESM migration is not complete. Monaco AMD remains deprecated,
so the next implementation work should prototype a local ESM bundle and worker
layout. Until that deliberate switch lands, `npm run monaco:package:check`
pins the current safe packaging state: Chromium copies the local AMD bundle
from `node_modules/monaco-editor/min` into `lib/monaco/`, the sandbox loads
`../lib/monaco/vs/loader.js` rather than remote/CDN editor assets, Firefox
continues omitting Monaco from AMO package inputs, and `npm run check` runs the
guard so packaging drift fails before release work.

2026-06-06 Cycle 72 SPA URL-change proof: X-3 is shipped for source/jsdom
coverage. Current Navigation API guidance still supports page-level
`navigate` events as the least-permission route-change signal, while history,
popstate, and hashchange remain necessary fallbacks for non-Navigation-API
or library-specific paths. ScriptVault now routes all four signals through
`__scheduleUrlChangeCheck(reason)`, runs a microtask check plus a frame-level
recheck, and suppresses repeated dispatches for the same `(oldUrl, newUrl)`
pair. `tests/urlchange-wrapper.test.js` executes the real wrapper in isolated
jsdom frames and proves fake Navigation API notifications, duplicate listener
suppression, remove-listener behavior, popstate/hashchange fallback, and
preserved `{ url, oldUrl }` details. README now documents the
`window.onurlchange` grant and an idempotent rebinding pattern for SPA scripts.

2026-06-06 Cycle 71 guarded GM.fetch closure: N-2 is complete. The
Tampermonkey and Violentmonkey GM API source signal still supports
promise-style GM namespace parity, but ScriptVault's network safety boundary
requires all privileged cross-origin fetches to pass through the existing
`GM_xmlhttpRequest` host-scope, `@connect`, redirect, abort, no-cache, and
internal-host checks. ScriptVault now exposes `GM.fetch` and direct `GM_fetch`
as a Fetch `Response` wrapper over `_GM_xmlhttpRequestPromise` rather than a
new background action. The parity test asserts that both wrapper sources keep
`GM.fetch` on the XHR bridge and that `src/background/core.ts` has no
`case 'GM_fetch'`; the generated ambient declarations include both `GM.fetch`
and `GM_fetch`.

2026-06-06 Cycle 70 settings validation acceptance closure: N-1 is complete.
The source signal remains WCAG error identification plus MDN constraint
validation: dashboard controls that can accept malformed values need
user-facing errors and validation metadata. `npm run settings:schema:check`
now enforces that every dashboard-backed schema metadata control in the
malformed-input set (`select`, text, textarea, number, password, URL) declares
validation metadata; checkboxes and readonly fields stay exempt. A focused
settings-schema regression proves a dashboard-backed textarea without
validation now fails the gate, and the repository schema passes the acceptance
check.

2026-06-06 Cycle 69 custom CSS validation: N-1 closed the last non-select
schema-backed dashboard metadata gap. WCAG error identification and MDN
constraint validation still point to text errors, native constraints, and
custom validity for malformed free-form input. ScriptVault now requires
validation metadata and a dashboard `setting-error` node for
`settingsCustomCss`; the textarea has a 100,000-character native limit, and
the save path rejects unsafe control characters or overlarge CSS while
preserving intentional whitespace. The metadata query now reports no remaining
non-select text/number/textarea schema-backed dashboard gaps. Remaining N-1
work should run the acceptance recheck across dashboard-saved settings and
utility export/backup controls, then close the roadmap row if no gaps remain.

2026-06-06 Cycle 68 remaining select validation: N-1 closed the current
schema-backed select validation backlog. The same select-specific source
signal from Cycles 64-67 applies: option `value` is the persisted selection
contract, and `HTMLSelectElement.setCustomValidity()` supports custom
validation messages for select controls. ScriptVault now requires validation
metadata and dashboard `setting-error` nodes for badge info, blacklist source,
config mode, download mode, editor theme, highlight matches, indent style, key
mapping, logging level, popup columns, script order, search integration, tab
mode, and trash mode. The dashboard validates each value against its live
option list before persisting; popup columns now stores the raw select value
until validation accepts and converts it to a number. Remaining N-1 work should
move from select controls to export/backup and other non-select dashboard-saved
settings that still need native constraints, text errors, or field-specific
validators.

2026-06-06 Cycle 67 action behavior select validation: N-1 continued through
the remaining security/action behavior selects that already had schema option
lists. The same select-specific source signal from Cycles 64-66 applies:
option `value` is the persisted selection contract, and
`HTMLSelectElement.setCustomValidity()` supports custom validation messages
for select controls. ScriptVault now requires validation metadata and
dashboard `setting-error` nodes for default tab type, local file, cookie,
communication, SRI, include, @connect, incognito, page filter, block severity,
strict mode, and top-level await selects. The dashboard validates each value
against its live option list before persisting; block severity now stores the
raw select value until validation accepts and converts it to a number.
Remaining N-1 work should continue with the general/action/editor/download
select controls that still lack validation metadata.

2026-06-06 Cycle 66 security select validation: N-1 continued through the
security-facing mode selects. The same select-specific source signal from
Cycles 64-65 applies: option `value` is the persisted selection contract, and
`HTMLSelectElement.setCustomValidity()` supports custom validation messages
for select controls. ScriptVault now requires validation metadata and
dashboard `setting-error` nodes for `settingsContentScriptAPI`,
`settingsSandboxMode`, `settingsModifyCSP`, and
`settingsAllowHttpHeaders`. The dashboard save path validates content script
API, sandbox mode, CSP modification mode, and HTTP header modification mode
against the live option lists before persisting. Remaining N-1 work should
continue with the action-menu/security selects that already have schema option
lists but no save-blocking allowed-option validation.

2026-06-06 Cycle 65 interval select validation: N-1 continued through the
update and externals interval selects. The same select-specific source signal
from Cycle 64 applies: option `value` is the persisted selection contract, and
`HTMLSelectElement.setCustomValidity()` supports custom validation messages for
select controls. ScriptVault now requires validation metadata and dashboard
`setting-error` nodes for `settingsCheckInterval`,
`settingsNotifyHideAfter`, and `settingsExternalsInterval`. The dashboard
stores raw select values until `validateSettingsValue()` confirms they are live
options, then converts them to numbers. Loading settings now uses nullish
fallbacks so `0`/"Never" remains visible, and saving no longer collapses
`0` into the old fallback intervals. Remaining N-1 work should continue with
security/action-menu selects that already have schema option lists but no
save-blocking allowed-option validation.

2026-06-06 Cycle 64 editor select validation: N-1 continued through a visible
editor-settings slice. The source refresh confirmed that `HTMLSelectElement`
supports `setCustomValidity()` with an empty string clearing the custom
validity error, and MDN's select documentation keeps option `value` as the
submitted/persisted contract. ScriptVault now requires validation metadata and
dashboard `setting-error` nodes for editor font size, indentation width, and
tab size. `saveSetting()` checks the value against the live select options
before persisting, returns numeric settings only after an allowed option
matches, and surfaces a field-specific error for tampered or stale values.
Remaining N-1 work should start with update/external interval selects because
the current `parseInt(value) || fallback` transforms can collapse the visible
`0`/"Never" option into a fallback value before saving.

2026-06-06 Cycle 63 sync credential validation: N-1 continued through the
remaining sync credential fields. The source refresh again confirmed the same
form-validation contract: WCAG 2.1 SC 3.3.1 requires identified input errors,
MDN documents `setCustomValidity()` as the custom validity message that blocks
submission/saves until cleared, and MDN `aria-invalid` guidance expects custom
validation to pair invalid state with user-facing error messaging. ScriptVault
now applies that pattern to WebDAV URL, WebDAV username/password, sync
encryption passphrase, and S3 access/secret keys. WebDAV URL is required only
when WebDAV is selected; S3 access and secret keys are required only when S3 is
selected; sync encryption cannot be enabled without a passphrase; and the
credential fields reject unsafe control characters or excessive length before
persisting. Remaining N-1 work is to continue auditing dashboard-saved editor,
security, update, and export settings for missing UI constraints and accessible
errors.

2026-06-06 Cycle 62 S3 settings validation: N-1 continued after the deep-audit
security lane. The source refresh for WCAG 2.1 SC 3.3.1, MDN constraint
validation, and MDN `aria-invalid` guidance still points to text error
identification, `setCustomValidity()`, and field-level invalid state wiring.
ScriptVault now applies that contract to S3 sync settings: endpoint, region,
bucket, and object key have schema validation metadata, native dashboard
constraints where applicable, accessible inline error nodes, and save-blocking
blur validation. The S3 endpoint is required only when S3 is selected, must be
HTTP(S), and may not include a path; region, bucket, and object key now surface
field-specific error text. Remaining N-1 work is to continue auditing
dashboard-saved sync, credential, and security fields for missing UI
constraints and accessible errors.

2026-06-06 Cycle 61 PublicAPI internal-host parity: N-9 EI-3 is closed and
the full deep-audit P0 security lane is complete. The deep audit found that
PublicAPI maintained a private `isInternalHost` copy that lagged
`InternalHostGuard`, leaving trusted origins and browser-mediated install URLs
with weaker SSRF protection. `src/modules/public-api.ts` now imports the
canonical `isInternalHost` from `src/background/internal-host-guard.ts`, and
the generated `modules/public-api.js`/`background.js` artifacts carry that
same policy. Focused regressions now prove trusted origins, web install URLs,
and webhooks reject `.localhost`, TEST-NET, benchmarking, Class E, and
IPv4-mapped IPv6 hex hosts, and `tests/source-hardening-parity.test.js` keeps
PublicAPI from reintroducing a private classifier.

2026-06-06 Cycle 60 crontab execution isolation: N-9 EI-2 is closed. The
deep audit found that scheduled `@crontab` scripts were executed with
`chrome.scripting.executeScript` in `ISOLATED` world, which can give
userscript code access to extension APIs. The scheduler now prefers
`chrome.userScripts.execute` in `USER_SCRIPT` world, matching the normal
userscript execution boundary, and falls back only to `chrome.scripting` in
`MAIN` world. The scheduled path no longer uses `new Function`, and
`tests/crontab-next-fire.test.js` pins `USER_SCRIPT`, `MAIN`, and the absence
of `ISOLATED`/`new Function` in the crontab execution block. The remaining
N-9 closure is PublicAPI internal-host guard drift.

2026-06-06 Cycle 59 deep-audit security closure: N-9 was added from
`docs/research-deep-audit-2026-06-06.md` so the newly identified P0 findings
are tracked in the active roadmap. The first closure hardens `GM_addElement`:
`srcdoc` is now treated as unsafe in both `src/background/wrapper-builder.ts`
and `src/background/core.ts`, regenerated runtime artifacts carry the same
guard, and `tests/wrapper-dom-security.test.js` proves direct attributes and
sanitized `innerHTML` iframes cannot retain `srcdoc`. Remaining N-9 work is
the `@crontab` isolated-world escalation and PublicAPI internal-host guard
drift from the deep audit.

2026-06-06 Cycle 58 local file refresh review: X-8 now has a review-only
refresh flow instead of only a binding handle. Current Chrome guidance still
requires permission rechecks for stored handles and user-gesture permission
requests, and CWS guidance still treats locally handled sensitive data as
disclosure-relevant. ScriptVault now exposes `Refresh File` and `Unbind` next
to `Bind File`; refresh retrieves the stored local-only handle, calls
`requestPermission({ mode: 'read' })` only from the user action when needed,
updates permission/missing-file/read/apply/no-change summaries, shows a local
diff review modal before changed code can apply, and saves accepted changes
through the normal `saveScript` path with a `local-save`/`local-file` receipt.
Remaining X-8 work is support-snapshot/local-health aggregate evidence and
deeper behavior fixtures for denied permission, missing handle, parse failure,
no-change, successful apply, receipt details, and registration.

2026-06-06 Cycle 57 dashboard local file binding: X-8 now has the first
user-facing File System Access entry point. Current Chrome guidance still
requires picker feature detection and a user gesture, stored handles still need
permission checks, and CWS guidance still treats local sensitive data as
disclosure-relevant. ScriptVault now adds a `Bind File` editor-toolbar action
that is hidden/disabled when `showOpenFilePicker` or IndexedDB is unavailable,
calls `window.showOpenFilePicker()` directly from the click handler, stores the
selected handle only in the local `localWorkspaceBindings` store, renders a
display-name/permission status chip, and tests that binding does not call
`saveScript`, read code text, or update save history. Remaining X-8 work is
`Refresh from local`, `Unbind`, explicit permission reconnect, review-only diff
apply, no-change detection, and local-file receipt coverage after accepted
applies.

2026-06-06 Cycle 56 local workspace binding store: X-8 now has the
first local-only data model needed before a dashboard "Refresh from local file"
flow can apply code. Current Chrome File System Access docs still allow
persisting `FileSystemHandle` objects in IndexedDB, require permission rechecks
through `queryPermission()`/`requestPermission()`, and document persistent
permission behavior for stored handles; current CWS user-data guidance still
treats locally stored sensitive data as disclosure-relevant. ScriptVault now
keeps future local file handles in a separate `localWorkspaceBindings`
IndexedDB store, exposes display-safe summaries without handles or absolute
paths, deletes bindings when scripts/storage are cleared, and strips future
local workspace settings from JSON exports, CloudSync, EasyCloud, and support
snapshots. Remaining X-8 work is the feature-detected dashboard "Bind local
file" action, permission-state summaries, review-only refresh apply, and
behavior-level no-code/local-save history tests.

2026-06-06 Cycle 55 autosave receipt coalescing: N-8 now has an
implementation path for coalescing repeated editor autosaves without storing a
session token in script data. The File System Access source refresh still
requires user-gesture picker entry, stored-handle permission rechecks, and
local-only handle storage; the CWS source refresh still treats locally stored
sensitive data as disclosure-relevant. ScriptVault now keeps autosave coalesce
keys in dashboard open-tab state and the background worker's in-memory map,
reuses the first rollback history entry during a coalescing window, clears that
state on manual/non-coalesced saves, and verifies the token is absent from
script records while the save path continues through `reregisterScript()`.
Remaining N-8/X-8 work is export/cloud/support redaction fixtures for future
local workspace binding metadata and the local-only binding-store skeleton.

2026-06-06 Cycle 54 local-save trust receipts: N-8 moved from planning into
the first implementation slice. Current CWS user-data guidance still expects
clear disclosure for locally stored sensitive data, and Chrome File System
Access guidance still requires user-gesture picker entry plus separate stored
handle permission checks. ScriptVault now records dashboard editor saves as
explicit `local-save` receipts with `local-editor` source metadata, suppresses
metadata URL fallback for those local saves, preserves remote update/download
URLs for review, and pins the manual/autosave payload contract in focused
tests. Remaining N-8 work after the following coalescing pass is behavior-level
no-code/history churn proof, export/cloud/support redaction coverage for future
local workspace metadata, and local workspace binding-store groundwork.

2026-06-06 Cycle 53 setup rehydration evidence: N-7 moved from a
setup-doctor planning row into support-safe runtime evidence. Current Chrome
docs still require the per-extension Allow User Scripts toggle on Chrome 138+
and note that registered user scripts are cleared on extension update; MDN
still documents Firefox MV3 `userScripts` as optional-only. ScriptVault now
records the last `registerAllScripts()` sweep as aggregate local health data
covering setup unavailable, global-disabled, already-current, stale-cleaned,
diff-registered, registered, partial, and error states. The support snapshot
inherits this through the existing local health block and keeps the privacy
envelope intact: no script source, names, IDs, or URLs.

2026-06-06 Cycle 37 background-script groundwork: X-2 now has a local
implementation contract in `docs/background-scripts-design.md`. The parser
preserves `@background`, the global settings contract includes an internal
default-off `experimentalBackgroundScripts` gate, and registration keeps
`@background` scripts dormant rather than treating them as page-load
userscripts before the DOM-less offscreen/service-worker runner exists. The
remaining X-2 work is runner scaffolding, restricted API enforcement,
scheduling/budget controls, review-only enablement, and a no-open-tab smoke.

2026-06-06 Cycle 38 background-runner scaffold: `src/background/background-runner.ts`
now provides the pure planning layer for the future DOM-less runner. It keeps
execution behind `experimentalBackgroundScripts`, requires a supported trigger,
normalizes the restricted GM grant surface, blocks DOM/page/tab grants, and
clamps timeout/concurrency/queue budgets. No offscreen or service-worker script
execution is enabled by this scaffold.

2026-06-06 Cycle 39 dormant background diagnostics: registration now records
the background planner status/reason when skipping `@background` scripts, and
the local health report exposes aggregate background-script counts for dormant,
eligible, gate-disabled, missing-trigger, unsupported-grant, and disabled states.
The diagnostics stay inside the existing privacy envelope: no script source,
names, identifiers, or URLs are included.

2026-06-06 Cycle 40 restricted background wrapper scaffold:
`src/background/background-wrapper.ts` now builds a DOM-less wrapper payload for
future runner use without wiring execution. It rejects unsupported DOM/page/tab
grants and `@require`, blocks page globals with throwing proxies, routes value,
XHR, notification, log, and info calls through background messages, and records
script errors through a runner-specific message.

2026-06-06 Cycle 41 non-executing background runner bridge:
`src/background/background-runner-bridge.ts` now assembles a planner result and
wrapper payload for eligible `@background` scripts while keeping
`executionEnabled: false`. The bridge carries reviewed budget clamps into the
payload and reports wrapper-construction failures, so the next cycle can expose
dry-run diagnostics without executing script code.

2026-06-06 Cycle 42 background runner dry-run action: the promoted runtime now
handles `prepareBackgroundRunnerDryRun`. The action returns planner status,
wrapper support, reviewed budget, and `executionEnabled: false`, omits wrapper
code from the response, and performs no offscreen, service-worker, or wrapper
execution.

2026-06-06 Cycle 43 support snapshot background dry-runs: dashboard support
snapshots now call `prepareBackgroundRunnerDryRun` for `@background` scripts
only when the user opts into the sensitive script-inventory category. Snapshot
entries contain sanitized planner, wrapper, budget, and `executionEnabled:
false` fields, with `includesCode: false` and no script execution.

2026-06-06 Cycle 44 CWS execution guard: `npm run cws:remote-code:check` now
fails future `offscreen_background_run` eval/new Function wiring in extension
contexts, and `docs/cws-remote-code-compliance.md` records that the DOM-less
`@background` runner remains dry-run only. Actual offscreen/service-worker
execution is blocked until a Chrome Web Store-compliant execution architecture
is selected and documented.

2026-06-04 Cycle 8 comprehensive feature-plan refresh: root-level
`RESEARCH_FEATURE_PLAN.md` now holds the current implementation-oriented
research plan for ScriptVault v3.11.0. It preserves `ROADMAP.md` as the open
queue while consolidating product map, feature inventory, competitive research,
highest-value new features, improvement themes, security/privacy/data-safety
risks, UX/accessibility/trust items, maintainability themes, prioritized
checkbox roadmap entries, quick wins, larger bets, non-goals, and open
questions.

2026-06-04 build-lane sync-endpoint update: WebDAV and S3 sync endpoints now
share the internal-host preflight and redirect guard. `ROADMAP.md` remains the
only active checkbox queue; `RESEARCH_FEATURE_PLAN.md` is a companion synthesis
without an independent checklist.

2026-06-04 build-lane credential-export update: vault JSON/cloud exports and
managed backup ZIPs now redact sync credentials by default, expose separate
credential opt-ins with risk copy, stamp settings credential metadata, and keep
restore/import from overwriting live WebDAV/OAuth/S3 credentials unless archive
metadata and user confirmation both opt in.

2026-06-04 build-lane archive-intake update: JSON imports, ZIP imports, backup
import, inspect, verify, and restore now use bounded archive intake before text
decode, JSON parse, or registration. The helper rejects oversized compressed
payloads, excessive file counts, aggregate expanded data, oversized entries,
nested archives, and high compression ratios; JSON imports also enforce the
5 MB per-script code cap plus a total import budget.

2026-06-04 Cycle 18 import/restore quarantine refresh: archive intake and
credential restore are now bounded/gated, but executable script bodies restored
from JSON, ZIP, raw-JS fallback, selected backup restore, or full-vault restore
can still be persisted as enabled and re-registered in the same flow. The
active roadmap now promotes a P1 quarantine/default-disabled first-run review
gate so imported/restored code is inert unless the user explicitly trusts that
archive. Detailed evidence and 52 external sources are in
`docs/research-cycle-18-2026-06-04.md`.

2026-06-04 build-lane host-permission recovery update: withheld current-site
host access is now diagnosed through background `getHostPermissionStatus`, the
popup, side panel, and dashboard show blocked matching scripts with a Chrome
`addHostAccessRequest` or `permissions.request({ origins })` recovery path, and
`npm run host-permissions:prototype` generates the optional HTTP(S) host grant
prototype report without changing the shipping `<all_urls>` manifests.

2026-06-04 build-lane sync-settings update: CloudSync and EasyCloud now
partition per-script settings before sync. Upload envelopes include only
allowlisted user-facing preferences, while local-only state such as
`userModified`, `mergeConflict`, failed dependency diagnostics, registration
errors, and source-identity warnings remains on the originating device and is
ignored when found in legacy remote envelopes.

2026-06-04 build-lane sync-encryption update: CloudSync and EasyCloud now read
plaintext v1 sync envelopes and encrypted v2 envelopes, then upload sanitized
`AES-256-GCM` v2 envelopes when the user enables sync encryption with a local
passphrase. The dashboard exposes the opt-in, and
`syncEncryptionPassphrase` is handled as a redacted sync credential in exports
and backups.

2026-06-04 build-lane privileged host-scope update: GM network, download,
cookie, and DNR primitives now enforce the script's effective run-host scope
before using ambient extension permissions. `@connect` explicitly widens
network/download/DNR targets, cookie access stays run-host scoped unless the
advanced cross-scope override is enabled, DNR rules carry initiator-domain
constraints, and CSP header mutation is gated by Modify CSP / high-privilege
override.

2026-06-04 build-lane Firefox Android update: the unverified Android
compatibility claim is deferred until a real device/emulator smoke exists.
`manifest-firefox.json` no longer declares `gecko_android`, and the generated
support matrix now labels Firefox for Android as deferred instead of an AMO
compatibility target.

2026-06-04 build-lane AMO vendored-library provenance update: the Firefox
package now has reviewer-reproducible provenance for packaged minified
third-party libraries. `acorn@8.16.0` and `diff@9.0.0` are exact npm dev pins,
`lib/acorn.min.js` is regenerated from official npm Acorn source with esbuild,
`lib/diff.min.js` is copied from the official npm jsdiff package, and
`docs/amo-vendored-libraries.md` plus `npm run vendored:provenance:check` gate
the package URLs, tarball integrity, source hashes, packaged hashes, licenses,
and Firefox package includes.

2026-06-04 build-lane Help-link update: dashboard, popup, side panel, and
install now expose a consistent `[data-help]` control with accessible name
`Help`. Popup and side-panel actions route through the existing dashboard
runtime opener with `tab: 'help'`, while every surface has a
`pages/dashboard.html#tab=help` fallback.

2026-06-04 build-lane readability update: H-2 is closed for the high-impact
setup/install/trust strings called out by the archived plan. New
`scripts/check-readability.mjs` computes Flesch Reading Ease, verifies the
audited strings still exist in source, reports offending IDs/files, and is
wired into CI, `npm run test:a11y`, and `npm run check`.

2026-06-04 implementation refresh: the 2026-06-03 findings still stand, but the
currently-breaking dependency item is now closed. `web-ext` was bumped to
`^10.3.0`, `npm ls tmp` resolves `tmp@0.2.6`, and
`npm audit --audit-level=high --omit=optional` exits 0. Firefox validation also
advanced: `npm run firefox:package` passes with 0 errors, 0 notices, and 139
warnings; `npm run smoke:firefox` passes with Firefox Developer Edition
151.0b10; and `npm run support:matrix:check` passes after regenerating the
browser support matrix. Current external anchors: GitHub
Advisory GHSA-ph9p-34f9-6g65 (`https://github.com/advisories/GHSA-ph9p-34f9-6g65`),
the `web-ext` npm package (`https://www.npmjs.com/package/web-ext`), and the
Chrome `userScripts` API reference
(`https://developer.chrome.com/docs/extensions/reference/api/userScripts`).

2026-06-04 Cycle 2 sync-state refresh: a static read of
`src/background/cloud-sync.ts`, `src/background/core.ts`,
`src/modules/sync-easycloud.ts`, and `src/types/script.ts` found that
per-script `settings` are serialized wholesale into cloud-sync envelopes even
though `ScriptSettings` includes device-local/conflict/error keys and arbitrary
future keys. This is now a P1 roadmap item to partition sync-safe settings from
device-local state. External anchor: ScriptCat PR #1309
(`https://github.com/scriptscat/scriptcat/pull/1309`) and the v0.16.14
changelog entry (`https://docs.scriptcat.org/docs/change/`), where
device-related sync config was moved to `chrome.storage.local` after OneDrive
state/OAuth prompts leaked across devices.

2026-06-04 Cycle 3 sync-endpoint egress refresh: after the GM_xhr
internal-host guard landed, the remaining network-egress gap is WebDAV/S3 sync.
`src/modules/sync-providers.ts` still derives WebDAV fetch URLs from
`webdavUrl` and S3 fetch URLs from `s3Endpoint` without `InternalHostGuard`
pre/post checks. `ROADMAP.md` now promotes a P1 item to guard those
user-configured sync endpoints while preserving an explicit local/private
endpoint opt-in for self-hosted Nextcloud, WebDAV, MinIO, or R2-compatible
deployments. External anchors: OWASP SSRF Prevention
(`https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html`),
AWS IMDS guidance
(`https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-instance-metadata-service.html`),
and Chrome extension cross-origin network request behavior
(`https://developer.chrome.com/docs/extensions/develop/concepts/network-requests`).

2026-06-04 Cycle 4 backup-settings credential refresh: manual export and
scheduled backup paths still serialize global settings as a single blob, while
provider settings include OAuth tokens, WebDAV passwords, and S3 access keys.
`ROADMAP.md` now promotes a P1 item to redact credential-bearing settings by
default, add a separate explicit credential-export opt-in with archive metadata,
and keep restore/import from overwriting live credentials unless both metadata
and user confirmation allow it. External anchors: OWASP Secrets Management
(`https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html`),
Google OAuth token storage best practices
(`https://developers.google.com/identity/protocols/oauth2/resources/best-practices`),
and AWS IAM access-key guidance
(`https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html`).

2026-06-04 Cycle 5 backup archive intake refresh: ZIP/JSON import, stored-backup
import, inspect, verify, and restore paths decode and decompress archives before
enforcing decompressed-size, file-count, per-entry, or per-script code caps.
`ROADMAP.md` now promotes a P1 item to replace raw archive intake with a shared
bounded helper and to apply the existing 5 MB script-size policy to backup
imports. External anchors: OWASP File Upload guidance
(`https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html`)
and MITRE CWE-409
(`https://cwe.mitre.org/data/definitions/409.html`).

2026-06-04 Cycle 6 Firefox Android smoke refresh: the desktop Firefox package
and sideload smoke now have strong coverage, but `manifest-firefox.json` also
declares `gecko_android.strict_min_version: 142.0` and the generated support
matrix lists Firefox for Android as a manifest validation target while explicitly
stating no Android device smoke exists. `ROADMAP.md` now promotes a P2
hardware-gated item to either add an ADB/web-ext Firefox Android smoke for the
critical userscript, permission, UI, WebDAV, and import paths, or remove/defer
the Android compatibility claim before AMO listing. External anchors: Mozilla's
Android compatibility/listing guidance
(`https://extensionworkshop.com/documentation/publish/version-compatibility/`),
Firefox-for-Android extension development checklist and MV3 caveats
(`https://extensionworkshop.com/documentation/develop/developing-extensions-for-firefox-for-android/`),
web-ext Android run workflow
(`https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/`),
Firefox `userScripts` optional-permission docs
(`https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/userScripts`),
and Android desktop-difference guidance
(`https://extensionworkshop.com/documentation/develop/differences-between-desktop-and-android-extensions/`).

2026-06-04 Cycle 7 AMO vendored-library provenance refresh: the Firefox
package ships `lib/acorn.min.js` and `lib/diff.min.js`, while
`AMO-SOURCE-README.md` only names those paths and says the source ZIP includes
the repo plus lockfiles. Mozilla source-code and third-party-library guidance
requires reviewer-readable source/build material, links to original included
files, and official release or package-manager provenance; local Acorn identifies
itself as jsDelivr-minified `acorn@8.14.1` while the lockfile resolves npm
`acorn@8.16.0`. `ROADMAP.md` now promotes a P2 item to add a reviewer-facing
library provenance inventory and gate packaged Firefox library hashes before AMO
upload. External anchors: Mozilla source-code submission
(`https://extensionworkshop.com/documentation/publish/source-code-submission/`),
third-party library usage
(`https://extensionworkshop.com/documentation/publish/third-party-library-usage/`),
add-on policies
(`https://extensionworkshop.com/documentation/publish/add-on-policies/`), and
MDN publishing notes
(`https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/What_next`).

2026-06-04 Cycle 9 CWS remote-code review refresh: Chrome Web Store MV3
policy permits remote logic only through documented APIs such as User Scripts
and treats the exemption as scoped to the covered code. ScriptVault has the
right architecture markers (`manifest.json` uses `userScripts`, extension pages
forbid `unsafe-eval`, and the editor uses a sandboxed page), and `PRIVACY.md`
explains externally sourced userscript execution. The build lane closed the
remaining release-review gap with `docs/cws-remote-code-compliance.md`,
`scripts/check-cws-remote-code.mjs`, release/store-copy references, and a CI
step that scans the packaged Chrome artifact for remote script tags, remote
workers/imports, and fetched strings executed outside `chrome.userScripts` and
sandboxed-page paths.
External anchors: Chrome Web Store program policies
(`https://developer.chrome.com/docs/webstore/program-policies/policies`), Chrome
remote-hosted-code violation guidance
(`https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code`),
and the Chrome `userScripts` API reference
(`https://developer.chrome.com/docs/extensions/reference/api/userScripts`).

2026-06-04 Cycle 10 Edge artifact/support-matrix refresh: the Edge package
builder is present (`npm run build:edge`, `npm run build:edge:check`, and
`tests/edge-build.test.js`), and `docs/edge-submission.md` documents the manual
Partner Center path. The remaining release-evidence gap is that CI does not
run or upload the Edge artifact, while the generated support matrix still says
Edge uses the same ZIP as Chrome and that the Edge package path is not
automated. `ROADMAP.md` now promotes a P2 item to tie Edge claims to the
generated `edge-artifacts/edge-build-<version>.json` report, distinguish
manual initial publication from optional update API automation, and keep Edge
privacy/remote-code declarations aligned with the current store forms.
External anchors: Microsoft Edge Chrome-port guidance
(`https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/port-chrome-extension`),
Microsoft Edge Add-ons publish flow
(`https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension`),
Microsoft Edge supported extension APIs
(`https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/api-support`),
and Microsoft Edge Add-ons update REST API
(`https://learn.microsoft.com/en-us/microsoft-edge/extensions/update/api/using-addons-api`).

2026-06-04 build-lane Edge evidence update: CI now runs
`npm run build:edge:check`, uploads `edge-artifacts/*`, and keeps
`npm run support:matrix:check` behind the generated Edge ZIP/report. The
support matrix no longer describes Edge as the Chrome ZIP; it reads
`edge-build-<version>.json` and records manual Partner Center publication,
deferred REST update automation, and no dedicated Edge browser smoke in CI.

2026-06-04 Cycle 11 Node toolchain-contract refresh: the repo now declares
`engines.node >=21.2.0`, and tests use Node ESM `import.meta.dirname`, but CI
still pins setup-node to `node-version: 20`, no `.nvmrc` / `.node-version` /
`.npmrc` / `packageManager` companion exists, and local npm reports
`engine-strict=false`. The existing `packageManager` / `.nvmrc` quick win is
therefore promoted into a P2 release-quality item: make CI, contributor shells,
npm engine enforcement, package-manager metadata, CWS tooling checks, and the
release runbook all consume the same Node floor.
External anchors: Node ESM `import.meta.dirname`
(`https://nodejs.org/api/esm.html#importmetadirname`), Node v21
`packageManager` / Corepack docs
(`https://nodejs.org/download/release/v21.1.0/docs/api/packages.html#packagemanager`),
npm `engines` / `engine-strict` docs
(`https://docs.npmjs.com/files/package.json/#engines`,
`https://docs.npmjs.com/cli/using-npm/config#engine-strict`), and setup-node
`node-version-file` docs (`https://github.com/actions/setup-node#usage`).

2026-06-04 Cycle 12 host-permission recovery refresh: the build lane closed
per-script privileged host scoping, but browser-level host access still has no
active recovery/prototype row. Chrome and Firefox manifests still require
`<all_urls>`, the dashboard runtime-host-permissions surface is a read-only
denied-host list with restore buttons, and optional-host / host-access-request
work only exists in archived notes. `ROADMAP.md` now promotes a P2 staged item:
first detect and recover user-withheld host access through popup/side-panel /
dashboard diagnostics, then run a gated optional-host-permission prototype before
any default-manifest change.
External anchors: Chrome optional-permission and host-permission guidance
(`https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions`),
Chrome Permissions API `request` / `addHostAccessRequest`
(`https://developer.chrome.com/docs/extensions/reference/api/permissions`), and
MDN MV3 `optional_host_permissions`
(`https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/optional_host_permissions`).

2026-06-04 Cycle 13 coverage-source-glob refresh: the open P1 coverage gate
still stands, but the precise failure mode changed after TypeScript promotion
and dashboard-module wiring. `vitest.config.mjs` reports coverage only for
`src/shared/**/*.ts`, `src/modules/**/*.ts`, and `src/bg/**/*.ts`, omitting the
now-authoritative `src/background/**` sources. A mapped-drive coverage smoke of
`tests/wrapper-dom-security.test.js` passed 9 tests while the report stayed at
0% and listed only the configured globs, not the exercised
`src/background/wrapper-builder.ts`. `ROADMAP.md` now sharpens the P1 item so
the coverage include set follows the TypeScript promotion map and explicitly
separates dashboard reachability checks from real coverage thresholds.
External anchors: Vitest coverage config for `coverage.include` and
thresholds (`https://vitest.dev/config/coverage.html`) and the Vitest coverage
guide on including uncovered source files
(`https://main.vitest.dev/guide/coverage`).

2026-06-04 Cycle 14 optional-dependency reach refresh: the CI audit exemption
for optional deps is still not guarded, but the current tree does not show a
shipped-code dependency on those packages. `package.json` has no direct
`optionalDependencies`; `package-lock.json` has 60 optional package records and
43 peer-optional edges; an exact import/require scan over 116 shipped extension
files found zero imports of those optional-like package names. Loose `canvas`
string hits in dashboard modules were DOM canvas usage, not the npm `canvas`
package. `ROADMAP.md` now sharpens the P2 row into a guard that parses the
lockfile, scans shipped source/package inputs for static and dynamic imports,
and keeps `npm audit --omit=optional` from hiding a future shipped-code CVE.
External anchors: npm audit `omit` config docs
(`https://docs.npmjs.com/cli/v11/commands/npm-audit/`) and npm package metadata
docs for `peerDependenciesMeta` / `optionalDependencies`
(`https://docs.npmjs.com/cli/v11/configuring-npm/package-json/`).

2026-06-04 Cycle 15 action pinning refresh: the release workflow's trusted
artifact path still consumes external actions by movable major tags. Local
evidence is eight `uses:` references in `.github/workflows/ci.yml`:
`actions/checkout@v4`, `actions/setup-node@v4`,
`browser-actions/setup-chrome@v1`, two `actions/attest@v4` steps, and three
`actions/upload-artifact@v4` steps. The same job grants `id-token: write` and
`attestations: write`, runs `npm run release:trust`, creates package/SBOM
attestations, and uploads Chrome/Firefox/Edge artifacts. `ROADMAP.md` now marks
the item verified and requires full 40-character SHA pins from the intended
upstream repositories plus a documented update path for those pins. External
anchors: GitHub's secure-use reference on full-length SHA pinning
(`https://docs.github.com/en/actions/reference/security/secure-use`) and
GitHub's action release-management docs for full commit SHA references
(`https://docs.github.com/en/actions/how-tos/create-and-publish-actions/manage-custom-actions`).

2026-06-04 Cycle 16 dependency-freshness refresh: after the `web-ext@^10.3.0`
fix, a mapped-checkout `npm outdated --json` run still reports nine direct
devDependencies behind latest or wanted versions: `@vitest/coverage-v8`,
`vitest`, `chrome-types`, `chrome-webstore-upload-cli`, `esbuild`, `jsdom`,
`monaco-editor`, `puppeteer-core`, and `typescript`. `.github/` still has only
`workflows/ci.yml`; no checked-in Dependabot or Renovate config watches npm
manifests or workflow action references. `ROADMAP.md` now sharpens the P1 item
to require npm plus GitHub Actions updater coverage, grouped patch/minor
development-tool PRs, isolated major updates, and no broad ignores that would
hide security updates. External anchors: Dependabot version-update setup
(`https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/configuring-dependabot-version-updates`),
action update setup
(`https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/keeping-your-actions-up-to-date-with-dependabot`),
and Dependabot grouping/options reference
(`https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference`).

2026-06-04 Cycle 17 Settings schema/validation refresh: the dashboard now has
a consolidated Settings tab, so the original "no panel" framing is stale. The
remaining verified gap is schema drift and validation. `settings-defaults.json`
has 71 default keys, the Settings tab has 91 `settings*` controls, and
dashboard listeners can persist 80 keys. A parity scan found 51 saveable keys
missing from the defaults/type contract and 42 default keys with no Settings UI
save path. Several missing defaults are intentionally internal credential or
timestamp fields, but visible-operator candidates such as `allowInternalXhr`,
`xhrTimeout`, `dashboardVirtualizationThreshold`, `experimentalESMUserscripts`,
`syncInterval`, `notifyOnInstall`, `notifyOnUpdate`, and `showBadge` need an
explicit classification. Raw text fields such as badge color, lint max size,
WebDAV/S3 URLs, denied hosts, custom CSS, and linter config save on blur without
a shared constraint layer or field-specific text errors. `ROADMAP.md` now
promotes this to a schema-parity and accessible-validation gate. External
anchors: MDN form constraint validation
(`https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Constraint_validation`)
and WCAG 2.1 SC 3.3.1 Error Identification
(`https://www.w3.org/TR/WCAG21/#error-identification`).

2026-06-04 Cycle 19 GM namespace parity refresh: rechecked the wrapper GM API
against the source wrapper and primary userscript-manager docs. The wrapper
defines 34 `window.GM_*` exports but only 25 top-level `GM.*` properties. The
missing promise aliases are `GM.addElement`, `GM.audio`, `GM.cookie`,
`GM.focusTab`, `GM.getMenuCommands`, `GM.head`, `GM.log`, and `GM.webRequest`;
the only cookie promise namespace is plural `GM.cookies` even though grant and
optional-permission checks already accept singular `GM.cookie`; and no
`GM.fetch` / `GM_fetch` path exists. Violentmonkey documents
Greasemonkey4-compatible `GM.*` aliases, Tampermonkey documents
`GM.xmlHttpRequest` as the promise form, and ScriptVault already routes
`GM_xmlhttpRequest` through `@connect`, host-scope, and internal-host pre/post
checks. `ROADMAP.md` now sharpens the existing P3 item to require a generated or
explicit alias contract, singular/plural cookie coverage, and any fetch-shaped
alias to reuse the guarded network path. External anchors: Violentmonkey GM API
(`https://violentmonkey.github.io/api/gm/`), Tampermonkey GM_xmlhttpRequest docs
(`https://www.tampermonkey.net/documentation.php?ext=d2&q=GM_xmlhttpRequest`),
and Tampermonkey's `GM.fetch` / streaming proposal
(`https://github.com/Tampermonkey/tampermonkey/issues/1278`).

2026-06-05 Cycle 20 companion-plan reconciliation: rechecked the current
`RESEARCH_FEATURE_PLAN.md` against `ROADMAP.md` after `2ad4acd`. The companion
plan's top opportunities for coverage, Node/npm enforcement, dependency
freshness, action SHA pinning, Settings schema validation, optional-dependency
reach, GM namespace parity, GM value-change semantics, and AMO publication are
already represented by active roadmap rows or the Firefox Phase 5 carry-over.
The missing active handoff was Edge runtime evidence: the package builder, CI
artifact upload, Edge readiness report, and support-matrix checks are shipped,
but the current docs still intentionally state that no dedicated live Edge
browser smoke exists. `ROADMAP.md` now adds a P2 Edge sideload smoke gate that
keeps "package ready" separate from "runtime smoked" until Microsoft Edge can
load the generated package, exercise dashboard/popup/script execution, and
record console/runtime evidence. Validation during this pass: `npm audit
--audit-level=high --omit=optional` passed with 0 vulnerabilities;
`npm run ts-source:check` passed with 27 promoted entries and no promoted
JS-only drift; `npm run readme:check` passed; `npm run dashboard:modules:check`
passed for 28 modules; `npm config get engine-strict` returned `false`; and
`npm outdated --json` still reported nine stale direct devDependencies
(`@vitest/coverage-v8`, `vitest`, `chrome-types`,
`chrome-webstore-upload-cli`, `esbuild`, `jsdom`, `monaco-editor`,
`puppeteer-core`, and `typescript`). Detailed evidence is in
`docs/research-cycle-20-2026-06-05.md`. External anchors: Microsoft Edge
Chrome-port guidance
(`https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/port-chrome-extension`),
Microsoft Edge Add-ons publish flow
(`https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension`),
and Microsoft Edge supported APIs
(`https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/api-support`).

## Executive Summary

ScriptVault is a Manifest V3 Chrome userscript manager (Chrome 130+, with a parallel
Firefox 140+ port) built as an ordered concatenation of `shared/`, `modules/`, `bg/`,
and `background.core.js`, mirrored by a `src/**` TypeScript tree that is type-checked but
not yet the build authority. The product surface is large and mature: install from many
sources, `chrome.userScripts` execution with a Greasemonkey/Tampermonkey API wrapper,
a Monaco editor, cloud sync across five providers, signing/provenance primitives, and an
extensive CI/release-trust pipeline (SLSA attestation, SBOM, source ZIP, web-ext lint).
The dominant constraint remains runtime/TS mirror drift, already tracked under F-1.

The active queue (`ROADMAP.md` → Existing Planned Work) plus the PASS3 deep-audit block
(`## Research-Driven Additions`) already cover the deepest *runtime* findings (GM_xhr SSRF,
now-closed plaintext cloud sync, `@crontab` engine, dashboard-module reachability,
dead What's New / i18n-v2). This 2026-06-03 pass therefore concentrated on the layers PASS3 did **not**
touch — dependency health, CI/supply-chain, coverage gating, settings/UX, and competitive
parity — and surfaced one then-breaking issue: a real CVE in a CI dependency.
That P0 dependency item is now closed in the build lane.

Top opportunities (one line each):

1. **[Closed 2026-06-04] CI was red on a real CVE** — `web-ext@10.2.0` → `tmp@0.2.5` → GHSA-ph9p-34f9-6g65 / CVE-2026-44705 (CVSS 7.7). `web-ext@^10.3.0` now resolves fixed `tmp@0.2.6`, and the high audit gate exits 0. (P0)
2. **[Verified] Coverage is blind** — `vitest.config.mjs` has no thresholds and omits `src/background/**` from coverage includes even though `background.core.js` is now generated from `src/background/core.ts`; a focused coverage smoke passed tests while reporting 0%. (P1)
3. **[Verified] No dependency-update automation** — nine direct devDeps are still behind and no checked-in updater config watches npm or workflow actions; the audit gate remains reactive only. Add Dependabot/Renovate. (P1)
4. **[Verified] Floating Action tags in a signing/attestation pipeline** — `ci.yml` has eight tag-based `uses:` references, including attestation and artifact-upload steps, while the same job grants `id-token: write` / `attestations: write` and publishes trusted artifacts; SHA-pin and keep those pins fresh. (P1)
5. **[Closed 2026-06-04] Sync envelopes mixed shared script data with device-local state** — CloudSync/EasyCloud now upload only allowlisted user-facing per-script settings and ignore legacy local-only remote keys. (P1)
6. **[Closed 2026-06-04] Cloud sync uploaded plaintext script source** — CloudSync/EasyCloud now support optional local-passphrase v2 sync-envelope encryption while still reading legacy v1 plaintext envelopes. (P1)
7. **[Closed 2026-06-04] User-configured sync endpoints lacked the internal-host guard** — WebDAV/S3 now share preflight and post-fetch redirect guards with explicit local/private endpoint opt-in. (P1)
8. **[Closed 2026-06-04] Backup/export settings could include sync credentials** — exports/backups now redact provider credentials by default and require separate credential opt-ins. (P1)
9. **[Closed 2026-06-04] Backup ZIP/JSON intake was not resource-bounded** — import/inspect/verify/restore now use bounded archive intake before decode, parse, or registration. (P1)
10. **[Closed 2026-06-04] Imported/restored executable scripts were not quarantined before first run** — JSON/ZIP/raw-JS imports, cloud restores, and selected/full restores now persist archive-enabled script bodies disabled with a local review marker unless an explicit trusted-archive override is selected; receipts count quarantined, preserved-disabled, and trusted-enabled scripts. (P1)
11. **[Closed 2026-06-04] Firefox for Android was claimed but not smoke-tested** — `gecko_android` and Android support-matrix claims are deferred until a real device/emulator smoke exists. (P2)
12. **[Closed 2026-06-04] AMO vendored-library provenance was incomplete** — Firefox package libraries now have exact npm pins, official source/package hashes, and a provenance check. (P2)
13. **[Closed 2026-06-04] CWS remote-hosted-code review packet was missing** — `docs/cws-remote-code-compliance.md` and `npm run cws:remote-code:check` now separate allowed User Scripts/sandbox flows from forbidden extension remote logic and scan source/package inputs plus the built Chrome ZIP in CI. (P1)
14. **[Closed 2026-06-04] Edge artifact evidence was not wired into CI or support claims** — CI now builds/uploads `edge-artifacts/*`, and the support matrix validates the current Edge ZIP/report instead of claiming the Chrome ZIP is the Edge package. (P2)
15. **[Verified] Node toolchain contract drift** — `package.json` declares `engines.node >=21.2.0`, CI still runs setup-node `20`, there is no Node version file / package-manager pin / engine-strict gate, and npm treats `engines` as advisory by default. (P2)
16. **[Closed 2026-06-04] Host-permission recovery/narrow-host prototype was inactive** — popup, side panel, dashboard, background diagnostics, permission grant/revoke refresh, and a gated optional-host prototype report now cover the staged recovery path while default manifests remain unchanged. (P2)
17. **[Verified] Undocumented `sv` omnibox + keyboard commands** — shipped in `background.core.js`/`manifest.json`, surfaced nowhere in docs/help; pure discoverability loss. (P3)
18. **[Verified] Settings surface is not schema-driven or consistently validated** — the Settings tab exists, but 51 saveable keys are outside the defaults/type contract and raw text controls lack shared field-level validation. (P2)
19. **[Verified] `--omit=optional` audit exemption is unguarded** — current static scan found zero shipped import/require hits, but package-lock contains optional/peer-optional entries and no CI guard proves they stay unreachable. (P2)
20. **[Verified] `GM.*` namespace parity drifts from shipped `GM_*` APIs** — wrapper code exposes 34 callback-style `window.GM_*` entries but only 25 top-level `GM.*` properties; several shipped APIs lack promise aliases, singular `GM.cookie` is accepted for grants but not exposed, and `GM.fetch` remains absent. (P3)

## Evidence Reviewed

- **Manifests / build**: `package.json`, `package-lock.json`, `manifest.json`, `manifest-firefox.json`, `esbuild.config.mjs`, `vitest.config.mjs`, `tsconfig.json`, `playwright.config.mjs`.
- **CI / release**: `.github/workflows/ci.yml` (full read), `scripts/*` (16 gate/generator scripts), `docs/dependency-audit-policy.md`, `docs/release-runbook.md`.
- **Runtime**: `background.core.js` (omnibox handler ~L5682, GM_xhr path), `modules/` (15 files incl. `internal-host-guard.js`, `storage.js`, `sync-providers.js`, `error-log.js`, `npm-resolve.js`, `quota-manager.js`), `content.js`, `pages/dashboard-*.js` (29 modules).
- **Git range**: `git log -30 --oneline` from `8526792` (planning consolidation) back through the TS-promotion and hardening waves; HEAD advanced to `4db9624 feat: show ESM dashboard badges` during this pass via concurrent work in the same tree.
- **Dependency state**: original research found `npm audit --audit-level=moderate --omit=optional` (2 high — both `tmp` via `web-ext`) and `npm ls tmp` (→ `tmp@0.2.5`). The 2026-06-04 build-lane fix now resolves `tmp@0.2.6` through `web-ext@^10.3.0` and the high audit gate exits 0. A Cycle 16 `npm outdated --json` run still shows nine direct devDeps behind: `@vitest/coverage-v8`, `vitest`, `chrome-types`, `chrome-webstore-upload-cli`, `esbuild`, `jsdom`, `monaco-editor`, `puppeteer-core`, and `typescript`.
- **Sync state**: `src/types/script.ts` defines open-ended per-script `settings`; `src/background/cloud-sync.ts`, `src/background/core.ts`, and `src/modules/sync-easycloud.ts` serialize those settings wholesale into cloud-sync data and merge remote settings back into local scripts.
- **Sync endpoint egress**: WebDAV `test`/`upload`/`download` and S3 `test`/`upload`/`download` build URLs from `webdavUrl`/`s3Endpoint` and call `fetch`/`fetchWithTimeout`; existing `InternalHostGuard` pre/post checks are present in script-source, `@require`, provenance, GM_loadScript, and GM_xhr paths but not these provider endpoints.
- **Backup/export settings**: `exportAllScripts()` reads `SettingsManager.get()` into export data; `BackupScheduler.createBackup()` writes `global-settings.json` from `SettingsManager.get()`; backup restore and import paths call `SettingsManager.set(...)`; dashboard copy exposes an "Include ScriptVault settings" checkbox and says cloud backups can restore settings when enabled, but credential-bearing settings are not split from ordinary preferences.
- **Backup archive intake**: `importFromZip`, `BackupScheduler.importBackup`, `BackupScheduler.inspectBackup`, `BackupScheduler.verifyBackup`, and restore paths call `fflate.unzipSync(...)` on decoded archive bytes; code then converts `.user.js`, options, storage, settings, folders, and workspace entries with `strFromU8`/`JSON.parse`. Existing tests cover identity, selective restore, and metadata preservation, but not decompression amplification, file-count limits, oversized per-entry JSON, nested archives, or the install path's 5 MB code cap on backup imports.
- **Import/restore execution trust**: JSON imports, ZIP imports, raw-JS ZIP fallback imports, cloud restores, selected backup restores, and full-vault restores now route archive-enabled script bodies through `applyImportedScriptTrust`, defaulting them to disabled with `_importQuarantine` review metadata. The backup review modal exposes an explicit `trustImportedScripts` override and names the active-script count before restore; receipts/results record quarantined, preserved-disabled, and trusted-enabled counts without script bodies or credentials.
- **Firefox Android target**: `manifest-firefox.json` declares `gecko_android.strict_min_version: 142.0`; `FIREFOX-PORT.md`, `README.md`, `docs/cross-browser-pipeline.md`, and `scripts/generate-browser-support-matrix.mjs` state Android is only a manifest validation target and that no Android device smoke is wired; `scripts/smoke-firefox-sideload.mjs` targets desktop Firefox/geckodriver only.
- **AMO vendored libraries**: `build-firefox.sh` includes `lib/acorn.min.js` and `lib/diff.min.js`; `AMO-SOURCE-README.md` describes only local library paths and generic source ZIP contents; tests pin those library inclusions but not reviewer provenance; `lib/acorn.min.js` says it was minified by jsDelivr from `acorn@8.14.1`, while `package-lock.json` currently resolves npm `acorn@8.16.0`.
- **CWS remote-code review**: `manifest.json` declares `userScripts` and limits extension-page CSP to `script-src 'self'` while sandboxing `pages/editor-sandbox.html`; `PRIVACY.md` explains externally sourced userscript execution; `docs/cws-remote-code-compliance.md` maps policy buckets; `scripts/check-cws-remote-code.mjs` scans source/package inputs and the built Chrome ZIP for forbidden remote-code execution patterns.
- **Edge artifact/support claims**: `scripts/build-edge.mjs` stages `build-edge/`, writes `edge-artifacts/scriptvault-edge-v<version>.zip`, and emits an `edge-build-<version>.json` release-readiness report; `tests/edge-build.test.js` covers the builder/report; CI now builds and uploads `edge-artifacts/*`; `scripts/generate-browser-support-matrix.mjs`, `README.md`, and `docs/cross-browser-pipeline.md` validate the current Edge report and state that Partner Center publication remains manual while REST update automation is deferred.
- **Node/toolchain contract**: `package.json:6-8` declares `engines.node >=21.2.0`, `.github/workflows/ci.yml:25-29` still uses setup-node `node-version: 20`, `.nvmrc` / `.node-version` / `.npmrc` are absent, local `npm config get engine-strict` returns `false`, `tests/audit-hardening-2026-06-04*.test.js:12` uses `import.meta.dirname`, and `scripts/check-cws-publish-tooling.mjs:40-58` still checks CWS tooling against a hard-coded Node 20 lower bound.
- **Host permission recovery**: default Chrome and Firefox manifests still require `<all_urls>`, but the active recovery path now probes withheld current-site access from background diagnostics, surfaces blocked matching scripts in popup/side panel/dashboard, queues Chrome `addHostAccessRequest` where available, falls back to `permissions.request({ origins })`, listens for host permission grant/revoke events, and keeps the optional HTTP(S) host manifest experiment in `docs/host-permission-prototype.md` until default-manifest evidence is ready.
- **Coverage/source glob alignment**: `vitest.config.mjs:21-25` uses V8 coverage with `all:false`, no thresholds, and includes only `src/shared/**/*.ts`, `src/modules/**/*.ts`, and `src/bg/**/*.ts`; `ts-source-promotion.json:163-168` marks `background.core.js` as promoted from `src/background/core.ts`; `package.json:54` runs `vitest run --coverage`; a mapped-drive run of `npx vitest run tests/wrapper-dom-security.test.js --coverage --coverage.reporter=json-summary --coverage.reporter=text-summary` passed 9 tests but `coverage/coverage-summary.json` showed 0% total coverage and no `src/background/wrapper-builder.ts` entry.
- **Optional dependency reach**: `.github/workflows/ci.yml:44-50` and `docs/dependency-audit-policy.md:3-31` intentionally use `npm audit --audit-level=high --omit=optional`; `package.json` has no direct `optionalDependencies`; `package-lock.json` currently has 60 optional package records and 43 peer-optional edges; a lockfile-derived import/require scan over 116 shipped extension files found zero hits; loose `canvas` matches in dashboard files were DOM canvas strings only.
- **Action pinning state**: `.github/workflows/ci.yml:9-12` grants `id-token: write` and `attestations: write`; `.github/workflows/ci.yml:21`, `:26`, `:87`, `:120`, `:126`, `:132`, `:141`, and `:148` use movable major tags for checkout, setup-node, setup-chrome, attest, and upload-artifact in the same trusted artifact job.
- **Dependency updater state**: `.github/` contains only `workflows/ci.yml`; no `.github/dependabot.yml`, `renovate.json`, or equivalent updater config is present for npm or workflow action references.
- **Settings schema/validation state**: `src/config/settings-defaults.json` has 71 default keys; `src/types/settings.ts` is a hand-written interface; `SettingsManager.set(...)` merges arbitrary keys; `pages/dashboard.html:5985-6554` exposes 91 Settings controls; dashboard listeners can save 80 keys; a parity scan found 51 saveable keys absent from defaults/types and 42 default keys with no Settings UI save path; settings inputs use some URL/password controls, but no shared `setCustomValidity` / `aria-invalid` pattern exists for Settings fields.
- **GM namespace parity state**: `src/background/wrapper-builder.ts:1328-1393` defines 25 top-level `GM.*` properties, while the wrapper exports 34 `window.GM_*` symbols through `src/background/wrapper-builder.ts:1393-1592`. Missing promise aliases are `GM.addElement`, `GM.audio`, `GM.cookie`, `GM.focusTab`, `GM.getMenuCommands`, `GM.head`, `GM.log`, and `GM.webRequest`; `tests/gm-types.test.js:79-124` covers `GM.xmlHttpRequest` and plural `GM.cookies` but not those missing aliases; `tests/install-optional-permissions.test.js:81-93` maps singular `GM.cookie`; and `src/background/core.ts:5635-5778` already applies `@connect` and internal-host pre/post checks to the underlying network path.
- **External sources**:
  - tmp advisory GHSA-ph9p-34f9-6g65 / CVE-2026-44705 (fixed in `tmp@0.2.6`, CVSS 7.7): https://github.com/advisories/GHSA-ph9p-34f9-6g65
  - web-ext 10.3.0 bundles `tmp@0.2.6` (verified via `npm view web-ext@10.3.0 dependencies.tmp`).
  - ScriptCat PR #1309 + v0.16.14 changelog moved device-related sync config to `chrome.storage.local` after cross-device sync leaked OneDrive state and OAuth prompts: https://github.com/scriptscat/scriptcat/pull/1309 and https://docs.scriptcat.org/docs/change/
  - OWASP SSRF Prevention, AWS IMDS, and Chrome extension network-request docs anchor the sync-endpoint egress guard: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html, https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-instance-metadata-service.html, https://developer.chrome.com/docs/extensions/develop/concepts/network-requests
  - OWASP Secrets Management, Google OAuth token storage best practices, and AWS IAM access-key guidance anchor the backup/export credential redaction item: https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html, https://developers.google.com/identity/protocols/oauth2/resources/best-practices, https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html
  - OWASP File Upload guidance and MITRE CWE-409 anchor the backup ZIP/JSON intake bounds item: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html and https://cwe.mitre.org/data/definitions/409.html
  - Chrome Web Store policies, remote-hosted-code guidance, the User Scripts API, OWASP File Upload, MITRE CWE-494, MITRE CWE-829, Tampermonkey docs, and Violentmonkey docs anchor the import/restore quarantine item: https://developer.chrome.com/docs/webstore/program-policies/policies, https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code, https://developer.chrome.com/docs/extensions/reference/api/userScripts, https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html, https://cwe.mitre.org/data/definitions/494.html, https://cwe.mitre.org/data/definitions/829.html, https://www.tampermonkey.net/documentation.php, and https://violentmonkey.github.io/
  - Mozilla Android compatibility/listing guidance, Firefox-for-Android development checklist/MV3 caveats, web-ext Android run workflow, Firefox `userScripts` optional-permission docs, and Android desktop-difference guidance anchor the Firefox Android smoke item: https://extensionworkshop.com/documentation/publish/version-compatibility/, https://extensionworkshop.com/documentation/develop/developing-extensions-for-firefox-for-android/, https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/, https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/userScripts, https://extensionworkshop.com/documentation/develop/differences-between-desktop-and-android-extensions/
  - Mozilla source-code submission, third-party library usage, add-on policies, and MDN publishing notes anchor the AMO vendored-library provenance item: https://extensionworkshop.com/documentation/publish/source-code-submission/, https://extensionworkshop.com/documentation/publish/third-party-library-usage/, https://extensionworkshop.com/documentation/publish/add-on-policies/, https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/What_next
  - Chrome Web Store program policies, Chrome remote-hosted-code violation guidance, and the Chrome `userScripts` API reference anchor the CWS remote-code review packet item: https://developer.chrome.com/docs/webstore/program-policies/policies, https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code, https://developer.chrome.com/docs/extensions/reference/api/userScripts
  - Microsoft Edge Chrome-port guidance, Add-ons publish flow, supported API table, and update REST API docs anchor the Edge artifact/support-matrix item: https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/port-chrome-extension, https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension, https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/api-support, https://learn.microsoft.com/en-us/microsoft-edge/extensions/update/api/using-addons-api
  - Node ESM, Node v21 package metadata/Corepack, npm engines/engine-strict, and setup-node version-file docs anchor the Node toolchain contract item: https://nodejs.org/api/esm.html#importmetadirname, https://nodejs.org/download/release/v21.1.0/docs/api/packages.html#packagemanager, https://docs.npmjs.com/files/package.json/#engines, https://docs.npmjs.com/cli/using-npm/config#engine-strict, https://github.com/actions/setup-node#usage
  - Chrome optional-permission / host-permission docs, Chrome Permissions API `request` / `addHostAccessRequest`, and MDN MV3 `optional_host_permissions` anchor the host-permission recovery item: https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions, https://developer.chrome.com/docs/extensions/reference/api/permissions, https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/optional_host_permissions
  - Vitest coverage config and guide anchor the coverage-source-glob refinement: https://vitest.dev/config/coverage.html and https://main.vitest.dev/guide/coverage
  - npm audit omit config and package metadata docs anchor the optional-dependency reach item: https://docs.npmjs.com/cli/v11/commands/npm-audit/ and https://docs.npmjs.com/cli/v11/configuring-npm/package-json/
  - GitHub Actions secure-use and action release-management docs anchor the action SHA-pinning item: https://docs.github.com/en/actions/reference/security/secure-use and https://docs.github.com/en/actions/how-tos/create-and-publish-actions/manage-custom-actions
  - GitHub Dependabot version-update, action-update, and options docs anchor the dependency-freshness item: https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/configuring-dependabot-version-updates, https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/keeping-your-actions-up-to-date-with-dependabot, and https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference
  - MDN constraint-validation guidance and WCAG 2.1 Error Identification anchor the Settings validation item: https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Constraint_validation and https://www.w3.org/TR/WCAG21/#error-identification
  - Violentmonkey GM API docs, Tampermonkey GM_xmlhttpRequest docs, and Tampermonkey's GM.fetch / streaming proposal anchor the GM namespace parity item: https://violentmonkey.github.io/api/gm/, https://www.tampermonkey.net/documentation.php?ext=d2&q=GM_xmlhttpRequest, and https://github.com/Tampermonkey/tampermonkey/issues/1278
  - Userscript-manager landscape (Tampermonkey / Violentmonkey / ScriptCat sync, MV3, GitHub-Gist sync, granular execution control): comparison sources at extensionfixes.com and addons.mozilla.org Violentmonkey listing.
- **Unverifiable here** [Needs validation]: live MV3 runtime behavior (cross-tab GM listener fan-out, omnibox UX, settings round-trips) — no browser run performed this pass; all runtime claims are static-read [Verified] or [Likely].

## Canonical Research Map

- `ROADMAP.md` — single source of truth for planned work. `## Existing Planned Work`
  holds the active queue folded from the former `TODO.md`; `## Research-Driven Additions`
  holds the PASS3 net-new findings plus this 2026-06-03 dependency/CI/release/UX block;
  the Round 14 body below is the broad historical planning appendix.
- `RESEARCH_FEATURE_PLAN.md` — current comprehensive research-backed feature
  plan for v3.11.0; it is a companion synthesis, not the active queue.
- `COMPLETED.md` — completed-work navigator with the shipped-feature roll-up.
- `CHANGELOG.md` — canonical shipped-release ledger.
- `FIREFOX-PORT.md` — active Firefox-port session ledger (open items extracted as G-* in ROADMAP).

### Archived Planning Sources (docs/archive/)

- `docs/archive/TODO.md` — former consolidated open-work queue (folded into ROADMAP Existing Planned Work + COMPLETED Shipped Features).
- `docs/archive/RESEARCH_FEATURE_PLAN.md` — first 2026-05-24 research refresh.
- `docs/archive/RESEARCH_FEATURE_PLAN_PASS2.md` — second-pass companion (NF-1..NF-25).
- `docs/archive/RESEARCH_FEATURE_PLAN_PASS3.md` — third-pass live-runtime re-audit; source for the first Research-Driven Additions block.
- `docs/archive/iter-1-l1-*.md`, `docs/archive/iter-1-l3-*.md` — dated research-iteration logs.

## Current Product Map

- **Install**: URL, pasted code, dropped files, ZIP/JSON backup, store/discovery pages, import formats (`pages/install.*`, install-source classification, `InternalHostGuard`, bounded fetch).
- **Run**: `chrome.userScripts` + wrapper-built GM/TM API, `@match`/`@include`/regex, metadata directives, in-place `userScripts.update`, popup/context-menu one-shot, `sv` omnibox search.
- **Manage**: dashboard + popup — search, cards/table, collections, snippets, profiles, templates, scheduler, theme editor, dependency graph, heatmap, CSP/DNR helper, linter, debugger, Gist surface, side panel. O-1 is now closed by dashboard-module wiring plus `npm run dashboard:modules:check`, but coverage thresholds remain separate.
- **Sync/backup**: WebDAV, Google Drive, Dropbox, OneDrive, EasyCloud, browser sync, Gist, scheduled backups, manual import/export (`modules/sync-providers.js`, `modules/backup-scheduler.js`).
- **Safety**: analyzer, signing/trust receipts, netlog/HAR, error log, DevTools panel, PRIVACY/CWS docs.
- **Release**: `esbuild` concat build, `build.sh`/`publish.sh`/`cws-setup.sh`, `ci.yml` with audit + 12 custom gate scripts + SLSA attestation + SBOM + Firefox/Edge packaging.

## Feature Inventory (delta from PASS3)

| Feature | Accessed via | Code | Maturity | Test/doc |
| --- | --- | --- | --- | --- |
| `sv` omnibox search | address bar `sv ` | `background.core.js:5682` | shipped | code only — **undocumented** |
| Keyboard commands | `Alt+Shift+S/D/E` | `manifest.json` commands | shipped | **undocumented**, no rebind note |
| CI audit gate | CI | `ci.yml` `npm audit --audit-level=high` | shipped | clean after `web-ext@^10.3.0` |
| Firefox Android compatibility claim | AMO / Android listing via `gecko_android` | `manifest-firefox.json`, generated support matrix | deferred | no Android claim until ADB/device smoke exists |
| AMO vendored library provenance | AMO source review | `AMO-SOURCE-README.md`, `docs/amo-vendored-libraries.md`, `build-firefox.sh`, `lib/acorn.min.js`, `lib/diff.min.js` | shipped | exact package/source/hash inventory gated |
| CWS remote-code review packet | Chrome Web Store review | `PRIVACY.md`, `docs/store-listing-copy.md`, `docs/cws-remote-code-compliance.md`, `manifest.json`, package ZIP | shipped 2026-06-04 | reviewer memo plus source/package and built-artifact remote-code scan |
| Edge package evidence | Edge Add-ons package/release | `scripts/build-edge.mjs`, `edge-artifacts/edge-build-<version>.json`, support matrix | shipped | CI builds/uploads Edge artifacts; support matrix validates the Edge report |
| Node toolchain contract | CI/contributor bootstrap/release scripts | `package.json`, `.github/workflows/ci.yml`, missing `.nvmrc` / `.node-version` / `.npmrc`, CWS tooling script | partial | `engines.node` exists, but CI/version files/package-manager pin/engine enforcement drift |
| Host-permission recovery | Browser site access / runtime diagnostics | required `<all_urls>` manifests plus runtime diagnostics, popup, side panel, dashboard, prototype report | shipped | withheld-host recovery shipped; optional-host manifest remains gated until a future default-manifest change |
| Coverage report | `npm run test:cov` | `vitest.config.mjs`, `coverage/coverage-summary.json` | partial | no threshold; include globs omit `src/background/**`; focused smoke passed tests with 0% reported coverage |
| Dependency audit policy | manual / CI | `docs/dependency-audit-policy.md`, `.github/workflows/ci.yml`, `package-lock.json` | partial | high+ audit gate exists; optional-dep reach is manually verified but not gated |
| Release attestation/SBOM | CI on push | `ci.yml` `actions/attest@v4` | shipped | eight workflow actions are tag-pinned, not SHA-pinned |
| Dashboard Settings | dashboard Settings tab | `pages/dashboard.html`, `pages/dashboard.js`, `settings-defaults.json`, `Settings` type | partial | consolidated tab exists; schema parity and field-level validation are missing |
| `GM.*` promise namespace | userscript wrapper | `src/background/wrapper-builder.ts`, generated `background.core.js`, GM type tests | partial | 25 top-level aliases vs 34 `window.GM_*` exports; missing several shipped aliases and `GM.fetch` |

## Competitive Landscape

- **Tampermonkey** — polished UI, granular execution control (priority, domain blocking, per-script permissions), cloud sync, broad browser support (Chrome/FF/Edge/Safari/Opera). *Lesson*: the granular per-script execution/permission surface is the bar; ScriptVault's NF-4 per-script host scope and a real Settings panel close part of this gap. *Avoid*: closed-source telemetry posture (ScriptVault's local-first stance is a differentiator — keep it).
- **Violentmonkey** — fully open-source, minimal, low CPU/memory, GitHub-Gist + Dropbox/OneDrive/Drive/WebDAV sync, zip import/export. *Lesson*: lightweight + open is a real wedge; ScriptVault already matches sync breadth but carries far more dashboard surface (O-1) — pruning unmounted modules also wins on the "lightweight" axis. *Avoid*: lagging MV3 support (a Violentmonkey pain point) — ScriptVault is MV3-native, a clear advantage to keep advertising accurately.
- **ScriptCat** — script subscriptions (URL→JSON list), DOM-less `@background` scripts, `GM_config`/`CAT_userConfig` author config. *Lesson*: these are exactly the PASS3 NF-3/NF-6/NF-8 differentiators already on the roadmap — confirms their priority.
- **Greasemonkey / FireMonkey** — Firefox-first, simpler API. *Lesson*: the ScriptVault Firefox port (G-* group) is the relevant parity track.
- **Standards baseline** — Chrome `userScripts` MV3 API, WCAG 2.2 AA for the dashboard UI (gap matrix tracked in `docs/wcag3-gap-analysis.md`; H-1/H-2 open), CycloneDX SBOM + SLSA provenance for release trust (already implemented; SHA-pin gap noted).

## Quality & Friction Findings

- **Closed** — CI audit gate failure on `tmp` CVE-2026-44705 was resolved by the ROADMAP P0 `web-ext@^10.3.0` bump. [Verified]
- **Major** — Coverage blind: no threshold, `src/background/**` omitted from coverage includes, and a focused smoke can pass tests while reporting 0%. → ROADMAP P1 coverage gate. [Verified]
- **Major** — No dependency-update automation; reactive audit only (root cause of the CVE slip). → ROADMAP P1 Dependabot/Renovate. [Verified]
- **Major** — Floating Action tags in an attestation/SBOM pipeline. → ROADMAP P1 SHA-pin. [Verified]
- **Closed** — AMO vendored-library provenance for minified Firefox-package libraries now has official package/source/hash inventory and a gate. [Verified]
- **Closed 2026-06-04** — CWS remote-hosted-code policy evidence is now packaged and scanned for Chrome submissions through `docs/cws-remote-code-compliance.md` and `npm run cws:remote-code:check`.
- **Moderate, closed 2026-06-04** — Edge package evidence is now wired into CI artifacts and generated support claims. → ROADMAP P2 Edge artifact/support-matrix gate. [Closed]
- **Major** — `--omit=optional` audit exemption is unguarded against shipped optional deps. Current scan found zero shipped import/require hits, but this is not automated. → ROADMAP P2 reach check. [Verified]
- **Major** — Settings surface exists but is not schema-driven or consistently validated. → ROADMAP P2 settings audit. [Verified]
- **Minor** — `sv` omnibox + keyboard commands undocumented. → ROADMAP P3 doc items. [Verified]
- **Minor** — `GM.*` promise namespace is hand-maintained and has drifted from shipped `GM_*` APIs. → ROADMAP P3 namespace parity item. [Verified]
- **Major** — Node/toolchain contract drift: `engines.node >=21.2.0` is advisory under default npm config, CI still sets up Node 20, and the repo lacks a version file/package-manager pin/engine-strict gate. → ROADMAP P2 toolchain alignment. [Verified]
- **Closed 2026-06-04** — Host-permission recovery/narrow-host prototype now has runtime diagnostics, UI recovery prompts, permission event refresh, support-matrix copy, and a generated optional-host prototype report. → ROADMAP P2 host-permission recovery. [Closed]
- **Closed 2026-06-04** — Import/restore execution trust now defaults archive-enabled executable scripts to disabled-for-review, exposes an explicit trusted restore override with active counts, and records trust-posture counters in import/restore results. → ROADMAP P1 import/restore quarantine. [Closed]

## Architecture & Technical Findings

- Build authority is still concatenated runtime JS, not `src/**` (F-1 tracks convergence); this pass adds no new architectural item there — it is already the top Larger Bet.
- `vitest` runs `pool: vmThreads, maxWorkers:1` to dodge an `@exodus/bytes` ESM-in-CJS crash under jsdom on the VMware share — a real environment fragility worth noting for contributors (documented in `vitest.config.mjs`, no action needed).
- `error-log.js`, `background.core.js`, and other promoted runtime files are generated from TypeScript sources; coverage gate (P1) should follow `ts-source-promotion.json`, including `src/background/**`, not only the current `src/modules` / `src/bg` / `src/shared` globs.
- The VMware-share runner needs a local or `pushd`-mapped path for coverage commands; direct UNC execution made `npx` fall back to `C:\Windows` and fail before Vitest loaded.
- Toolchain authority is split between `package.json` (`>=21.2.0`), CI (`node-version: 20`), the release runbook's Node 20 CWS note, and a CWS helper script that hard-codes Node 20+. The P2 toolchain item should collapse those into one source of truth.
- Dependency health: 10 devDeps were behind at research time. The `web-ext`/`tmp` security issue is closed; esbuild/monaco/puppeteer majors remain low-risk dev-only and should fold into the Dependabot grouped PRs rather than ad-hoc bumps.
- Optional dependency reach is clean by one-off static scan today: no exact import/require hits across shipped extension files. The risk is regression, because the audit exemption is only justified if that property is continuously checked.

## Security / Privacy / Data Safety

- The deepest runtime risks (GM_xhr SSRF NF-1, plaintext cloud sync NF-2, per-script scope NF-4, TOFU SRI NF-5) are already roadmapped or closed — not re-listed.
- New Cycle 12 trust item: now that privileged GM host scope is enforced, the remaining browser-permission trust gap is recovering from user-withheld host access and proving whether a future optional-host-permission mode can keep ScriptVault functional with lower default warnings.
- New: the **supply-chain/review** layer is the gap this pass surfaces — a CVE reached CI via an unpinned, un-bot-tracked dev dependency, the release pipeline that signs/attests artifacts uses floating action tags, and Chrome submissions needed a remote-hosted-code review packet plus package scan that separates allowed User Scripts/sandbox flows from forbidden extension remote logic. The P0 web-ext bump, AMO library provenance, and CWS remote-code review packet are closed; P1 Dependabot + P1 SHA-pin remain to harden the path from source to reviewed artifact.
- Privacy posture remains local-first with no usage beacon; external telemetry stays a non-goal.

## UX & Accessibility

- WCAG 2.2 AA tracking lives in `docs/wcag3-gap-analysis.md`; H-1 (help-link consistency) and H-2 (plain-language Flesch ≥60) remain open in Existing Planned Work — not duplicated.
- New UX items are discoverability (omnibox/commands docs, P3), host-permission recovery diagnostics (P2), and a validated Settings surface (P2); all complement, not duplicate, the accessibility rows.

## Explicit Non-Goals

- **External usage telemetry / analytics beacon** — rejected; conflicts with the local-first privacy posture in `PRIVACY.md`.
- **Auto-installing subscription members** — rejected; NF-6 deliberately routes new members to the pending-update inbox (consent-first), not silent install.
- **Reopening dashboard-module wiring as a blanket research item** — rejected; O-1 is closed by concrete reachability wiring and `npm run dashboard:modules:check`. Remaining risk is coverage/a11y depth for those mounted surfaces.
- **Bumping esbuild/monaco/puppeteer majors ad-hoc this pass** — deferred into the Dependabot grouped-PR flow to avoid an unreviewed major-version churn.

## Open Questions (genuine blockers only)

_None this pass._ The optional-dependency reach question has current static evidence; the remaining work is turning that evidence into a gate.

## Maintenance Rule

`ROADMAP.md` is the open queue. When a research pass becomes historical-only, move it under
`docs/archive/` and update this map.
