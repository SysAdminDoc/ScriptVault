# ScriptVault Roadmap

Actionable work only. Historical and completed roadmap material is archived in CHANGELOG.md; blocked work is kept in Roadmap_Blocked.md.

## Actionable Items

### Unaudited — needs a pass

_Scope not covered by the 2026-08-02 pass. Not findings; each needs its own audit._

- [ ] P3 — Unaudited: cloud sync providers end to end against live services
  Category: testing
  Where: `modules/sync-providers.js`, `src/modules/sync-providers.ts`, `modules/cloud-sync.js`
  Problem: The 2026-08-02 pass verified only the WebDAV path that `smoke:firefox` exercises against a local stub server. Google Drive, Dropbox, OneDrive, Easy Cloud, and S3 were not exercised against real endpoints, so OAuth refresh, quota, and conflict behavior on those providers is unverified by this pass.
  Evidence: The Firefox smoke's `webdav` scenario is the only provider with live coverage in the harness output.
  Fix: Audit each provider's token refresh, error mapping, and 3-way merge against a real or high-fidelity fake endpoint.
  Acceptance: Each provider has an observed pass/fail record rather than an inference from shared code.
  Confidence: Needs-repro
  Effort: L

- [ ] P3 — Unaudited: Monaco editor interaction surface and the DevTools panel in a real DevTools host
  Category: testing
  Where: `pages/editor-sandbox.html`, `pages/monaco-adapter.js`, `pages/devtools-panel.js`
  Problem: `smoke:editor` was run and passes (overlay geometry, 14 controls hit-tested, close works), but editor behaviors beyond that harness — find/replace history, undo across tab switches, Vim mode, large-file handling — were not exercised. The DevTools panel was loaded as a bare page, where `chrome.devtools.inspectedWindow` is absent; its real behavior inside an attached DevTools host is unverified.
  Evidence: The panel rendered its empty state correctly as a standalone page, which does not exercise the inspected-window code paths.
  Fix: Drive the editor through its documented interactions, and load the DevTools panel through an actual DevTools session.
  Acceptance: Both surfaces have observed coverage of their primary interactions.
  Confidence: Needs-repro
  Effort: M

- [ ] P3 — Unaudited: install/update flow driven from a real `.user.js` navigation
  Category: testing
  Where: `pages/install.js`, install interception in `src/background/core.ts`
  Problem: The install page was audited only in its no-pending-install error state, which is handled well ("No userscript was found ... Download the userscript again from its source page"). The populated review flow — permission rendering, downgrade detection, `@require` probing, trust-card provenance — was not exercised in this pass.
  Evidence: Loading `pages/install.html` directly yields the empty state by design.
  Fix: Drive a real `.user.js` navigation through interception into the review UI and audit the populated states, including a malformed and an oversized script.
  Acceptance: The populated install review has observed coverage across valid, malformed, and downgrade cases.
  Confidence: Needs-repro
  Effort: M

- [ ] P3 — Drifted UNSHIPPED mirror modules are pinned by the test suite as if they were the product
  Category: maintainability
  Where: `src/background/wrapper-builder.ts`, `import-export.ts`, `update-checker.ts`, `install-handler.ts`, `trust-receipt.ts`, `parser.ts` (none in `ts-source-promotion.json`; live copies are inline in `core.ts`); tests `tests/gm-websocket.test.js`, `wrapper-gm-tabs-39-13.test.js`, `wrapper-dom-security.test.js`, `pending-update-queue.test.js`, `pending-install-isolation.test.js`, `trust-receipt*.test.js`, `versions.test.js` and others import the mirrors
  Problem: These files are re-exported only by the unused `src/background/index.ts` barrel and are not built. They have measurably drifted from the live `core.ts`: mirror `wrapper-builder.ts` lacks `GM_getTab/saveTab/getTabs` grant checks (live core.ts has them), defaults `GM_getResourceURL` to a never-revoked blob URL (live uses the data-URI leak fix), is missing standalone `GM_updateNotification`/`GM_closeNotification` + `buttons[]`/`onbuttonclick` + the highlight-path `_notifCallbacks` cleanup, and `meta.grant.length` throws where core uses `meta.grant || ['none']`; mirror `import-export.ts` lacks versionHistory snapshot, import receipts, per-script settings preservation, and resets `createdAt` on overwrite; mirror `update-checker.ts` lacks the backoff engine, the pending-updates byte cap, and the provenance-failure gate (but has the `userModified` skip the runtime lost). Tests importing these prove nothing about shipped behavior (the "check wired to the wrong data source" failure mode) and mislead anyone who "fixes" a bug in the mirror. `GM_webSocket` is concrete: implemented in the mirror wrapper and covered by `tests/gm-websocket.test.js`, but the shipped injected wrapper exposes no `window.GM_webSocket`/`GM.webSocket` (`grep "window.GM_webSocket" background.js` → 0), so a `@grant GM_webSocket` script gets a `ReferenceError`.
  Evidence: Verified — `ts-source-promotion.json` has no entries for these files; live-vs-mirror drift confirmed feature-by-feature (consolidates three passes' observations); `grep "window.GM_webSocket" background.js` → 0.
  Fix: For each mirror either (a) promote it — extract the live logic from `core.ts` into the module, add it to `ts-source-promotion.json` + the drift gate — or (b) delete it and repoint its tests at the generated `background.core.js` extraction. At minimum add a drift assertion between each mirror and its inline `core.ts` copy so divergence fails CI. Separately decide whether `GM_webSocket` is a shipped feature; if so expose the client in the live wrapper, else drop the mirror + test.
  Acceptance: No test imports a non-promoted `src/background/*.ts` mirror without a drift assertion against the shipped copy; `GM_webSocket` either works in a live browser or is removed from docs/tests.
  Confidence: Verified
  Effort: L

- [ ] P3 — Doc rot: CLAUDE.md lists dashboard modules that do not exist
  Category: docs
  Where: repo `CLAUDE.md` "Dashboard Modules (26 files)" lists `dashboard-i18n-v2.js` and `dashboard-recommendations.js`
  Problem: Neither file exists in `pages/` and nothing references `I18nV2`; future maintainers/agents hunt for phantom files.
  Evidence: Verified — `ls` fails for both; grep for references returns nothing.
  Fix: Remove the two entries and re-count the module list. (CLAUDE.md is AI working notes, not user-facing; safe to edit.)
  Acceptance: The module inventory lists only files that exist.
  Confidence: Verified
  Effort: S
  _2026-08-06 research pass — same item, wider scope than first recorded._ The
  same file also states version v3.19.2 (actual 3.24.0), Monaco 0.55.1 (actual
  0.56.0), vendored `acorn 8.14.1` and `diff 7.0.0` — both wrong: `lib/acorn.min.js`
  is 8.17.0 and `lib/diff.min.js` is 9.0.0, correctly recorded in
  `docs/amo-vendored-libraries.md`. Fold these into the same sweep; the vendored
  ones matter most because a stale note invites a needless "upgrade the vendored
  library" task that is already done.

### Unaudited — needs a pass

- [ ] P3 — Unaudited: live-browser drive of the populated install review, editor interactions, and DevTools panel in a real host
  Category: testing
  Where: `pages/install.js` (populated states), `pages/monaco-adapter.js`/`pages/editor-sandbox.html`, `pages/devtools-panel.js`
  Problem: This pass was static/trace + Node-timing based; the populated install review (valid/malformed/oversized/downgrade), editor find/replace/undo-across-tabs/large-file behavior, and the DevTools panel inside an attached DevTools session were not driven live. (Overlaps the prior 2026-08-02 "Unaudited" items; still open.)
  Evidence: No live-drive harness was run in this pass.
  Fix: Drive a real `.user.js` navigation into the review UI and load the DevTools panel through an attached session; drive the editor's documented interactions.
  Acceptance: Observed coverage of the populated install/editor/devtools interactions.
  Confidence: Needs-repro
  Effort: M

- [ ] P3 — Unaudited: cloud providers against live endpoints, and Stylus import
  Category: testing
  Where: `src/modules/sync-providers.ts` (Google Drive/Dropbox/OneDrive/S3 live OAuth+quota+429 bodies), `src/modules/sync-easycloud.ts`, `_convertStylusStyle`/`importStylusBackup` in `src/modules/userstyles.ts`
  Problem: Provider findings above were traced statically; real OAuth consent, token refresh, quota, and 429/403 bodies were not exercised against live services. Stylus import conversion was not audited.
  Evidence: No live endpoint or Stylus-import fixture was run in this pass.
  Fix: Audit each provider against a real/high-fidelity fake endpoint; add Stylus-import conversion fixtures.
  Acceptance: Each provider and the Stylus import path has an observed pass/fail record.
  Confidence: Needs-repro
  Effort: L

- [ ] P3 — Use runtime.getDocumentId() on Firefox to key per-document injection state
  Why: The open UserCSS SPA and injection-dedup items key state per tab, which cannot distinguish a reloaded document from a live one; Firefox 153 introduced a stable per-document identifier that makes that distinction directly.
  Evidence: https://blog.mozilla.org/addons/2026/07/23/firefox-153-webextensions-api-updates/ ("Firefox 153 introduces documentId, a stable identifier for a document instance, including a new runtime.getDocumentId() method"); relates to the open items "Persistent UserCSS can orphan an injected stylesheet on an SPA route change" and "SPA navigation events are dropped, not coalesced" above — this is an enabling mechanism for those, not a replacement.
  Touches: src/modules/userstyles.ts, src/background/core.ts (onTabNavigated/onTabUpdated/rehydrateOpenTabs), generated modules/userstyles.js, tests/userstyle-injection.test.js, scripts/smoke-firefox-sideload.mjs.
  Acceptance: where available, per-document injection state is keyed by documentId rather than tab id, with the tab-id path retained for Chrome; a reload no longer reuses the previous document's registry entry; the Firefox smoke harness proves a reloaded SPA page re-injects exactly once.
  Complexity: M

- [ ] P3 — Review the Find Scripts surface against the 2026-08-01 Chrome Web Store prohibited-products update
  Why: CWS added a Malicious and Prohibited Products clause on 2026-08-01 banning circumvention of AI service safety guardrails and usage restrictions; ScriptVault's discovery panel installs arbitrary third-party scripts from Greasy Fork and OpenUserJS, and neither the listing copy nor the in-product risk copy acknowledges that class.
  Evidence: https://developer.chrome.com/blog/cws-policy-updates-2026 (Limited Use, Disclosure Requirements and the prohibited-products clause all effective 2026-08-01); pages/dashboard.js Find Scripts sources hardcode https://api.greasyfork.org/en/scripts.json and https://openuserjs.org/api/script/list; scripts/check-permission-copy.mjs and docs/store-listing-copy.md cover permissions and privacy but not prohibited-content classes; the @antifeature surface already exists as the disclosure mechanism (https://greasyfork.org/en/help/antifeatures).
  Touches: docs/store-listing-copy.md, PRIVACY.md, scripts/check-permission-copy.mjs, pages/dashboard.js Find Scripts copy, pages/install.js review copy, docs/cws-remote-code-compliance.md.
  Acceptance: the listing and in-product copy state that discovery surfaces third-party code the project does not author or endorse and that installation is the user's decision; the compliance doc records the 2026-08-01 clauses and how each is met; the store-copy gate covers the new clauses so a future policy change fails the check instead of passing silently.
  Complexity: S

- [ ] P3 — Refresh dev dependencies and adopt the test-tooling features already paid for
  Why: Several dev dependencies are behind current releases and the newer versions ship capabilities that would directly improve this repo's existing harnesses; none of these are security-driven, so they belong behind the P0 audit work.
  Evidence: current vs latest as of 2026-08-06 — @playwright/test 1.61.1 vs 1.62.1 (2026-07-30), jsdom 29.1.1 vs 30.0.1 (2026-07-29, requires Node >=24.15 which the repo's >=24.16.0 satisfies), puppeteer-core 25.2.1 vs 25.5.0, acorn 8.17.0 vs 8.18.0, chrome-types 0.1.431 vs 0.1.436; Playwright 1.61 added page.localStorage/page.sessionStorage, 1.62 added retryStrategy 'isolated' and WebP screenshots; Vitest 4 ships Playwright trace integration usable from the existing browser-mode config; acorn 8.17's strict option and using/await-using fixes matter for the AST analyzer, whose vendored copy is already 8.17.0.
  Touches: package.json, package-lock.json, playwright.config.mjs, vitest.visual.config.mjs, tests/e2e/helpers/, scripts/check-cve-floors.mjs, docs/audit/cycle-22-dependency-freshness-*.md, docs/amo-vendored-libraries.md if acorn is re-vendored.
  Acceptance: dependencies are bumped with the full gate suite green; the extension-state assertions that currently go through page.evaluate() use the WebStorage API where it is clearer; failing browser-mode tests emit a Playwright trace; retryStrategy 'isolated' is applied to the extension-load E2E specs that have historically flaked; if acorn is re-vendored, docs/amo-vendored-libraries.md hashes are regenerated in the same change.
  Complexity: S

- [ ] P2 — Unblock GM value bidirectional sync with HLC per-key last-write-wins and preserved losers
  Why: `Roadmap_Blocked.md` blocks L-8 on a merge-conflict UX decision that has now been researched and does not need a modal at all; the sanitisation infrastructure is built, `providerWritesEnabled` is false, and the feature currently has zero user-visible effect.
  Evidence: `docs/gm-value-sync-data-model.md` is 52 KB and contains no conflict-resolution decision — every conflict path is advisory (`conflictBlocked` counts at lines 78, 123, 194, 296) and `wouldApplyValues` is false. Precedent: CouchDB/PouchDB never blocks the write, picks a deterministic winner and retains every loser under `_conflicts` for the app to resolve later (https://pouchdb.com/guides/conflicts.html); Automerge chooses the winner by operation id rather than wall clock and exposes losers via `getConflicts()` (https://automerge.org/docs/reference/documents/conflicts/), which matters because clock skew across six sync providers is certain; Obsidian Sync has never shipped a manual resolver despite a decade of requests and instead writes conflicts as inspectable artifacts (https://deepwiki.com/obsidianmd/obsidian-help/2.3-synchronization-and-conflict-resolution). Yjs `Y.Map` is ruled out on record — unpredictable winner, earlier writes can overwrite later ones, and unbounded historical key retention (https://github.com/rozek/y-lwwmap). A passive badge also satisfies this project's standing no-confirmation-dialogs rule.
  Touches: src/background/cloud-sync.ts, src/modules/sync-easycloud.ts, src/background/core.ts value store, src/config/settings-defaults.json (`providerWritesEnabled`, `wouldApplyValues`, a per-device policy setting), docs/gm-value-sync-data-model.md, pages/dashboard.js script row badge, tests/gm-value-sync.test.js, Roadmap_Blocked.md (remove L-8).
  Acceptance: each value carries a hybrid logical clock `{ts, counter, deviceId}` and the winner is max-HLC with a deterministic `deviceId` tiebreak, never wall-clock comparison; losing values are retained per `(scriptId, key)` under a capped, TTL'd sidecar; `providerWritesEnabled` defaults on with no new modal and no blocking prompt; the script row shows a passive conflict count that opens the existing review surface; a per-device policy (`hlc` default, `prefer-local`, `prefer-remote`) exists; a test simulates two devices with skewed clocks and asserts the later logical write wins regardless of wall-clock order.
  Complexity: L

- [ ] P2 — Build a real-world userscript compatibility corpus and gate on it
  Why: The suite has twenty GM handler unit-test files and no fixture from a script that anyone actually runs, which is precisely the gap that let Violentmonkey ship an MV3 build that microfroze the browser on a popular script.
  Evidence: `ls tests/` shows `gm-*.test.js` x20 covering handlers in isolation and no real-script fixtures (`tests/userstyle-compat-fixtures.test.js` is the only fixture-shaped file and it is UserCSS). https://github.com/violentmonkey/violentmonkey/issues/2608 was reproduced with Image Max Url and was absent under MV2; https://github.com/violentmonkey/violentmonkey/issues/2538 (31 comments) is "v2.40.0 broke this very old script". Available corpus material: Greasemonkey's own `@run-at` conformance scripts (https://github.com/greasemonkey/greasemonkey), and heavy real-world GM API users https://github.com/hoothin/UserScripts (Pagetual, Picviewer CE+), https://github.com/XIU2/UserScript, https://github.com/redphx/better-xcloud, https://github.com/prinsss/twitter-web-exporter. `vite-plugin-monkey` v8.1.0 added dev-time Web Worker support (https://github.com/lisonge/vite-plugin-monkey/releases), so authored scripts now spawn Workers and the USER_SCRIPT world must keep that working.
  Cross-reference: complements the open item "Prove document-start actually wins the race in a real browser" (2026-08-06 pass) — that one proves injection *timing* with a synthetic page; this one proves the *GM API surface* against scripts real users run. Sharing one browser harness between them is worth doing.
  Touches: tests/fixtures/ new directory, tests/ new corpus suite, tests/e2e/ new spec, scripts/smoke-large-library.mjs or a new harness, docs/ a note recording each fixture's provenance and licence.
  Acceptance: a pinned set of real userscripts installs, registers and executes in a real browser with their GM API calls recorded; a Worker-spawning script from the vite-plugin-monkey v8 shape is included; each fixture is vendored with its source URL, commit and licence recorded; the gate fails on a GM surface regression rather than on unrelated site changes, which means the fixtures must not perform live network calls to their target sites.
  Complexity: M

- [ ] P3 — Expose a cross-tab lock to userscripts
  Why: Scripts that coordinate across tabs have no primitive for it and reimplement broken ad-hoc locking, while the extension already serialises its own writes internally.
  Evidence: `grep -rn "navigator.locks" src/` returns nothing; the internal equivalent is `_runExclusiveScriptOperation` in `src/background/core.ts`, which is not reachable from a userscript. Demand: https://github.com/violentmonkey/violentmonkey/issues/1799 (Mutex API) and https://stackoverflow.com/questions/79736631/ asking how to get atomicity at all. Web Locks has been widely available since 2024-09-14, so this is a thin wrapper rather than an implementation.
  Touches: src/background/wrapper-builder.ts and the live `buildWrappedScript` in src/background/core.ts, src/background/gm-values-handler.ts if value writes participate, scripts/generate-gm-types.mjs, lib/scriptvault.d.ts, README GM API table, tests/ new coverage. Note the standing hazard: no backticks and no `${` in comments inside `buildWrappedScript`.
  Acceptance: `GM.withLock(name, fn)` serialises across tabs for the same script, scopes the lock name per script so two scripts cannot collide, releases on throw, supports an abort signal, and is gated behind an explicit `@grant`; `npm run gm-types:check` and `node --check background.core.js` both pass.
  Complexity: S

- [ ] P3 — Warn on unrecognised metadata keys in the editor
  Why: Authors ship metadata typos that silently do nothing, and the editor already lints metadata without checking whether a key is a key at all.
  Evidence: `pages/dashboard-linter.js` has no unknown-key or unrecognised-tag diagnostic (`grep -n "unknown\|unrecognized"` returns nothing). ScriptCat shipped this in https://github.com/scriptscat/scriptcat/pull/1608. `eslint-plugin-userscripts` already encodes the rule set worth reusing — `no-invalid-metadata`, `better-use-match`, and a `userscriptVersions` setting keyed to per-manager feature levels (https://github.com/Yash-Singh1/eslint-plugin-userscripts) — so the vocabulary does not need to be invented.
  Touches: pages/dashboard-linter.js, src/editor/userscript-lsp-worker.ts, pages/editor-sandbox.html, src/locales/en.json, tests/ linter coverage.
  Acceptance: an unrecognised `@key` produces a warning naming the nearest known key; keys this product supports but competitors do not are recognised rather than flagged; localized variants (`@name:ja`) are recognised as the base key; a suppression exists for deliberate custom keys so the warning does not become noise.
  Complexity: S

- [ ] P3 — Make the locale gate measure coverage against English, and use localized script metadata
  Why: Eight of nine locales translate under 4% of the runtime strings, and the gate ratchets each locale against its own current count, so it certifies "no regression" while reading as coverage — the same shape as the other gate defects in this pass.
  Evidence: `src/locales/en.json` carries 1,914 runtime keys against ru 117 (6.1%), ja 71, he 58, zh 46, es 45, de 43, fr 43, pt 42 (2.2%); each file's `runtimeCoverageBaseline` equals its current count, which is what `scripts/check-locales.mjs` compares against. Separately, `@name:xx` / `@description:xx` localized metadata is already parsed (`src/background/core.ts:1111`, `src/background/parser.ts:420`) but the script list never uses it — the same unmet ask as https://github.com/openstyles/stylus/issues/377.
  Touches: scripts/check-locales.mjs, docs/locale-coverage.md, src/locales/*.json, pages/dashboard.js script list rendering, pages/popup.js, README internationalization section.
  Acceptance: the gate reports each locale's coverage as a percentage of the English key set and the docs publish it, so the number is visible rather than implied; the ratchet still prevents regressions; the script list and popup prefer `@name:<uiLocale>` / `@description:<uiLocale>` when present, falling back to the base key.
  Complexity: S

- [ ] P3 — Import competitor settings and per-script configuration, not only scripts
  Why: A migrant currently arrives with their scripts and none of their per-script state, which is the part that took years to accumulate and the reason people stay on the incumbent.
  Evidence: the importers cover Tampermonkey `.txt`, Violentmonkey JSON/ZIP, Greasemonkey GM4 and ScriptCat, but `src/background/import-export.ts` and the inline `importScripts` at `src/background/core.ts:5618` restore script records rather than manager settings or per-script user config. ScriptCat shipped exactly this in https://github.com/scriptscat/scriptcat/pull/1554 (backup/restore imports ScriptCat, Tampermonkey and Violentmonkey custom config and settings and repairs resources).
  Touches: src/background/import-export.ts, src/background/core.ts import path, src/modules/script-config.ts, src/modules/migration.ts, pages/dashboard.js import UI, tests/runtime-import-export.test.js, tests/import-snapshot.test.js.
  Acceptance: an import maps competitor per-script settings — enabled state, run-at override, user-supplied `@var` / GM_config values, custom includes and excludes — onto ScriptVault equivalents, reports anything it could not map rather than dropping it silently, and continues to run every imported script through the existing quarantine and review path; prototype-polluting keys in imported config are rejected as they already are on the install path.
  Complexity: M

- [ ] P3 — Unbreak `npm audit signatures` and refresh the developer security pin
  Why: The audit-signature command cannot execute under the repository's release-age policy, and the checked-in Node pin predates the July 2026 security fixes; both controls currently read as passing without proving the intended release boundary.
  Evidence: `npm audit signatures` fails with `ETARGET — No matching version found for web-ext@10.6.0 with a date before 8/1/2026` because it re-resolves from the registry and `.npmrc`'s `min-release-age=7` rejects the lockfile's own installed versions; `--min-release-age=0` succeeds (473 registry signatures, 93 attestations). Separately `.nvmrc` and `.node-version` pin 24.16.0, which predates Node 24.17.0 and 24.18.1 (11 CVEs, 3 High — https://nodejs.org/en/blog/vulnerability/july-2026-security-releases), though see the P0 AMO item first: raising `engines` makes the reviewer-image conflict worse, so pin the developer toolchain rather than the compatibility range. The DOMPurify and Vitest floor metadata is now aligned with its current advisories in `scripts/check-cve-floors.mjs`.
  Cross-reference: the open item "Refresh dev dependencies and adopt the test-tooling features already paid for" (2026-08-06 pass) covers bumping dev-dependency *versions*; this item is only about the floor values and the two controls being inert. Do not fold them together — this one is security-relevant and that one explicitly is not.
  Touches: scripts/release-trust-gate.mjs, .nvmrc, .node-version, scripts/check-toolchain-contract.mjs, docs/dependency-audit-policy.md.
  Acceptance: `npm audit signatures --min-release-age=0` runs inside `release:trust` and its failure fails the gate; the developer Node pin is a version carrying the July 2026 security fixes while `engines` stays compatible with the AMO reviewer image; the unfixable `image-size` advisories (GHSA-w3rx-r6r6-pgpr, GHSA-5p2g-fcmc-qvqq — no patched version exists, reachable only from `firefox:lint` parsing this project's own icons) are recorded as a documented exception so `npm audit` is not permanently red.
  Complexity: S

- [ ] P3 — State in the enterprise documentation that no policy can enable user scripts
  Why: An administrator following the current provisioning doc will force-install ScriptVault, watch it do nothing on every machine, and have no way to discover why — and this is the single hardest friction point in the deployment story.
  Evidence: `docs/enterprise-policy-provisioning.md` documents `managedScripts` and managed-storage access levels and never mentions the per-extension "Allow user scripts" toggle. Verified against Chromium `main`: the complete extension policy set contains no `UserScripts` policy, and `ExtensionSettings`' per-extension keys are `installation_mode`, `update_url`, `override_update_url`, `blocked_permissions`, `allowed_permissions`, `minimum_version_required`, `runtime_blocked_hosts`, `runtime_allowed_hosts`, `blocked_install_message`, `toolbar_pin`, `file_url_navigation_allowed` — admins can only *block* `userScripts`, never grant it.
  Touches: docs/enterprise-policy-provisioning.md, README enterprise section, docs/store-listing-copy.md if it implies otherwise.
  Acceptance: the doc carries a recipe using `ExtensionInstallForcelist` plus `ExtensionUnpublishedAvailability` (insurance against a listing takedown) and states explicitly that each user must flip "Allow user scripts" once per profile, with the `chrome://extensions/?id=<id>` path and what the extension shows until they do; the claim is dated so a future policy change is visibly re-checkable.
  Complexity: S

- [ ] P3 — Replace remaining browser-version gates with feature detection
  Why: Chrome moves to a two-week release cycle at M153, which halves the calendar span of any "last N milestones" assumption and makes version arithmetic decay faster than it can be maintained.
  Evidence: https://developer.chrome.com/blog/chrome-two-week-release — M153 ships 2026-09-08 and milestone gaps collapse from 28 to 14 days, ~26 stable versions per year. The repo already feature-detects in the right places (`chrome.userScripts.getScripts` probe at `src/background/core.ts:11869`, `execute()` availability branches), but `_getChromeVersion()` also drives capability decisions and `minimum_chrome_version: 130` anchors a support window whose meaning has changed.
  Touches: src/background/core.ts (`_getChromeVersion` call sites), src/modules/user-scripts-setup.ts, pages/dashboard-firefox-compat.js, manifest.json, docs/cross-browser-pipeline.md, README browser support matrix, scripts/generate-browser-support-matrix.mjs.
  Acceptance: every capability decision branches on the presence of the API rather than a version number, with version numbers retained only for user-facing setup guidance where the browser genuinely differs; the support matrix documents the two-week cadence and states the support window in milestones with its calendar equivalent; a test asserts no capability branch compares `_getChromeVersion()` against a literal.
  Complexity: S

- [ ] P3 — List ScriptVault in the ecosystem's directories
  Why: Distribution is the weakest axis in the whole project and the largest curated index in this space does not know the product exists.
  Evidence: https://github.com/awesome-scripts/awesome-userscripts (3,449 stars, last updated 2026-08-03) lists Tampermonkey, Violentmonkey, ScriptCat, OrangeMonkey and Stay under "Userscript Managers" and omits ScriptVault — along with Userscripts-for-Safari, Greasemonkey and FireMonkey, so the section is stale and a correcting PR is welcome rather than self-promotional. Greasy Fork maintains recommendation lists that took additions in 2026 (https://github.com/greasyfork-org/greasyfork/pull/1550, https://github.com/greasyfork-org/greasyfork/pull/1540).
  Touches: no repository files — this is an outbound PR plus a note in the release runbook so it is re-checked when the listing state changes.
  Acceptance: a PR is open against awesome-userscripts adding ScriptVault with an accurate one-line description and the four missing managers; the release runbook records where the product is indexed so the list does not go stale again.
  Complexity: S

- [ ] P2 — Make the editor smoke command fail fast and clean up its browser on timeout (pre-existing baseline)
  Category: testing
  Where: `scripts/smoke-editor.mjs:105-245`; npm script `smoke:editor`
  Problem: The mandated headless editor smoke command did not produce a pass/fail result within the shell's 120-second execution window and left child browser processes requiring targeted cleanup. This makes release verification unable to distinguish a product hang from a harness hang and risks leaking automation processes in CI.
  Evidence: `npm run smoke:editor` was run against the current build with headless Chrome; it timed out after about 124 seconds without a stage result. The script's waits cover dashboard load, What's New dismissal, editor overlay, sandbox frame, Monaco, diagnostics, screenshot, and close, but there is no global deadline/reporting wrapper around the sequence.
  Fix: Add a bounded overall timeout with the current stage and URL in the failure message, ensure `browser.close()`/temporary-profile cleanup runs from a process-level `finally` even on timeout, and make each wait use a consistent diagnostic timeout. Do not hide a product failure; preserve the first failing stage.
  Acceptance: `npm run smoke:editor` always exits with a useful pass/fail result within a documented limit, leaves no matching Chrome/Node children or temporary profile, and reports the exact editor stage when a regression occurs.
  Confidence: Needs-repro
  Effort: M

- [ ] P2 — Add a real extension-upgrade registration rehydration gate
  Why: The runtime has version-marker/force-reregister logic, but the existing E2E test proves only service-worker restart; a broken release can therefore pass current coverage while losing enabled user-script registrations during an actual extension update.
  Evidence: `src/background/core.ts:12024-12126,13069+` compares the manifest version and re-registers scripts, while `tests/e2e/service-worker-rehydration.spec.js:70-93` only closes/reopens the worker. Chrome and MDN document that user-script registrations are cleared on extension update and must be restored on an update install path: https://developer.chrome.com/docs/extensions/reference/api/userScripts, https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/userScripts, https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/userScripts/update
  Touches: `tests/e2e/service-worker-rehydration.spec.js` or a dedicated upgrade spec, extension fixture/profile helpers, `src/background/core.ts`, generated runtime parity checks, and Firefox smoke coverage where `userScripts` is available.
  Acceptance: An isolated Chrome update test installs version N, seeds enabled/disabled scripts and registrations, replaces the package with version N+1, and verifies every eligible script is registered exactly once, stale registrations are removed, disabled scripts remain absent, and a failed registration is surfaced in the existing health evidence; retain the separate worker-restart test and add the equivalent Firefox case or an explicit capability-gated result.
  Complexity: M

- [ ] P2 — Persist a bounded, redacted execution journal across service-worker restarts
  Why: The current live diagnostics store is bounded but intentionally lasts only for the current service-worker lifetime, so the context for a failed run disappears when MV3 suspends or restarts the worker.
  Evidence: `src/background/execution-diagnostics.ts:85-99,145-294` keeps tabs/documents/events in memory with count caps, and `src/background/core.ts:7309-7316` documents the lifetime boundary. Popup, side panel, and DevTools already consume live diagnostics; this item extends continuity rather than adding another “why did it not run?” surface. The unified uBlock Origin logger is a comparable observability model: https://github.com/gorhill/uBlock/wiki/The-logger
  Touches: `src/background/execution-diagnostics.ts`, core diagnostic message handlers, `chrome.storage.session`/bounded IndexedDB adapter, popup/sidepanel/DevTools stale-state rendering, trace export sanitizer, and diagnostics tests.
  Acceptance: After a controlled service-worker stop/start, the latest bounded execution success/failure remains visible with an age/stale indicator; journal records contain only origin or stable URL hashes plus bounded error classes, never full query strings or script source; count, per-tab, age, and serialized-byte eviction are deterministic and covered by restart, quota, and redaction tests.
  Complexity: M

- [ ] P2 — Extend single-file local binding into a reviewable folder/project manifest
  Why: ScriptVault ships a permission-aware single-file binding/watch workflow, but a selected folder cannot currently represent multiple `.user.js`/`.user.css` files, additions, renames, deletions, or project-level conflicts; external-editor workflows in ScriptCat, Safari Userscripts, and community requests show this is a concrete authoring gap.
  Evidence: `pages/dashboard.js` local workspace binding/watch code around `11774+` stores one script/file relationship, while `src/modules/sync-providers.ts:151-153,744+` writes one `scriptvault-backup.json`; there is no relative-path manifest or folder reconciliation layer. Comparable evidence: https://docs.scriptcat.org/en/docs/use/vscode/, https://github.com/quoid/userscripts, https://www.reddit.com/r/userscripts/comments/1pt9xb5, https://www.reddit.com/r/userscripts/comments/1odi87w
  Touches: `pages/dashboard.js` local workspace UI, `src/storage/script-db.ts`/binding types, folder-picker and watch adapter, import/export redaction, local health/support summaries, and focused dashboard/storage/E2E tests.
  Acceptance: A user-selected folder containing three scripts maps each relative path to a stable ScriptVault ID and reconnects after dashboard restart; external add/rename/delete/change operations appear in a review queue; conflicts show both hashes/versions and never silently overwrite executable code; unbind/revoke/permission errors are visible; handles, absolute paths, and local file contents do not enter cloud sync, support snapshots, or ordinary exports.
  Complexity: L

- [ ] P2 — Add deterministic property-based and mutation fuzz coverage for trust-boundary inputs
  Why: The repository has strong hand-written malformed fixtures but no randomized corpus for the parsers and privileged message boundaries that accept untrusted metadata, archives, JSON, structured messages, and network responses.
  Evidence: Candidate boundaries are `src/background/parser.ts`, `src/background/import-export.ts`, `src/modules/public-api.ts`, `src/background/user-script-message-policy.ts`, and `src/background/gm-network-handler.ts`; existing tests are example-based and `package.json` has no property/fuzz command. OWASP identifies malformed and semi-malformed input fuzzing as a direct way to expose parser and security failures, while userscript-malware and extension-privilege studies show these boundaries are security-relevant: https://owasp.org/www-community/Fuzzing, https://singularity.be/public/papers/monkey-in-the-browser.extended.pdf, https://www.usenix.org/system/files/usenixsecurity23-kim-young-min.pdf
  Touches: existing Vitest test suites for parser/import/bridge/network policy, deterministic generators and seed corpus under `tests/`, bounded `package.json` test script, and failure-seed documentation in test fixtures (not a new top-level document).
  Acceptance: `npm run check` runs a deterministic, time-bounded corpus that mutates metadata headers (duplicates, Unicode, controls, oversized values), ZIP/JSON imports, public-API/bridge messages, and network errors/timeouts; malformed inputs fail closed without unhandled rejection, privilege escalation, persistent partial mutation, or unbounded allocation; any discovered seed is retained as a regression fixture and the run reports its seed and boundary.
  Complexity: M
