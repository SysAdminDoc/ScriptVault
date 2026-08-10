# Research — ScriptVault
Date: 2026-08-10 — replaces all prior research.

## Executive Summary

ScriptVault v3.27.0 is a local-first, zero-telemetry Chrome/Firefox MV3 userscript and UserCSS manager with unusually strong trust review, update rollback, GM compatibility, Monaco authoring, local-file workflows, cloud-provider adapters, and a large automated test surface. `npm run check` is green at 249 files and 2,855 tests, so the highest-value work is no longer broad feature accumulation: it is closing the boundaries where the shipped product, release gates, and user-visible diagnostics still lose evidence or privacy. The new priorities are safe DevTools exports, a real extension-upgrade rehydration gate, bounded diagnostics that survive service-worker suspension, folder-level local development, and adversarial input coverage. Existing roadmap items already cover source health, document-start timing, compatibility corpus, HLC value sync, locale coverage, import settings, mutation serialization, dependency-graph performance/accessibility, and dependency refresh; they are intentionally not repeated here.

Priority order:

1. **Now / P1:** redact secrets and sensitive URLs from HAR and trace exports by default.
2. **Next / P2:** prove registrations recover across a real extension version update.
3. **Next / P2:** retain a bounded, redacted execution journal across service-worker restarts.
4. **Next / P2:** extend the shipped single-file binding into an explicit folder/project workflow.
5. **Next / P2:** fuzz metadata, imports, bridge messages, and network-boundary inputs using the existing Vitest harness.

## Product Map

**Core workflows**

- Install `.user.js` and `.user.css` from a URL, file, drag-and-drop, clipboard, bookmarklet, Gist, collection, or the Find Scripts discovery surface; review metadata, permissions, provenance, SRI, and analyzer risk before enabling.
- Create, edit, lint, format, search, and debug scripts in the Monaco-backed dashboard, with GM typings, local-file binding/watch, DevTools, side panel, profiles, workspaces, tags, folders, and command palette.
- Register enabled scripts through `chrome.userScripts` / `browser.userScripts`, match URLs and run-at phases, and expose the documented GM-compatible APIs, `@var` configuration, schedules, URL-change hooks, and MV3-compatible network controls.
- Review subscription and direct updates as diffs, including permission/dependency/risk deltas; quarantine or apply them, retain versions, roll back, restore from trash, and inspect receipts.
- Export/import ZIP or JSON and synchronize through WebDAV, local-folder backup, Google Drive, Dropbox, OneDrive, S3, Easy Cloud, or Gist, with optional passphrase encryption and provider-specific health state.

**Personas**

- Privacy-conscious power users who want an auditable alternative to closed-source managers.
- Userscript and UserCSS authors who need a real editor, update review, and a local development loop.
- Migrants from Tampermonkey, Violentmonkey, ScriptCat, Greasemonkey, FireMonkey, or Stylus.
- Support and release operators who need provenance, diagnostics, rollback, and redacted evidence rather than raw profile data.

**Platforms and distribution**

- Chrome MV3 is Tier 1 (`manifest.json`, minimum Chrome 130); Firefox MV3 has an AMO-ready manifest with minimum Firefox 140 but is not listed; Edge is package-ready; Chromium derivatives are smoke-only.
- Chrome and Firefox support four product themes (dark, light, Catppuccin, OLED); Firefox intentionally omits some Chrome-only surfaces and Monaco paths. Safari and Firefox Android remain outside the supported desktop delivery plan.
- The build is a deliberately manual/generated esbuild pipeline: TypeScript sources generate runtime modules and the unpacked extension root is the release artifact. That makes source/runtime parity and release-profile testing more important than framework migration.

**Key integrations and data flows**

- Browser APIs: `userScripts`, `storage`, `scripting`, `tabs`, `webNavigation`, `alarms`, declarative Net Request, notifications, side panel, offscreen documents, downloads, permissions, and optional identity.
- Local state: IndexedDB/script storage, `chrome.storage`, Storage Buckets where available, bounded receipts/history, File System Access handles, and local health summaries.
- External sources: Greasy Fork and OpenUserJS discovery/provenance, GitHub and custom HTTPS sources, remote `@require`/`@resource` fetched through SRI/TOFU and internal-host guards, and user-selected sync providers.
- Release trust: Ed25519 signing/trust-store paths, managed-script integrity/signature validation, AST risk analysis, Trusted Types/CSP, vendored dependencies, AMO source-build documentation, and source/generated parity tests.

## Competitive Landscape

### Violentmonkey

Violentmonkey remains the closest open-source comparison and its active MV3 issue/release stream shows how installation, injection timing, storage, and mobile edge cases fail after migration. ScriptVault should keep investing in real-browser upgrade, document-start, and compatibility gates. It should avoid adopting an alternative page-mode workaround as a product dependency when native `userScripts` registration is available.

### ScriptCat

ScriptCat combines Tampermonkey compatibility with background/cron scripts, cloud sync, a community store, debugging, and an external VS Code workflow. Its folder/editor sync and recent settings/config import are the useful lessons: authoring must work as a project, not only as a text box. Its remote bridge is a security reference, not a reason to add an unscoped localhost integration; any future bridge would need the capability, approval, hash-binding, and audit model documented by ScriptCat.

### Tampermonkey

Tampermonkey demonstrates the table stakes of automatic updates, ZIP backup, external editor workflows, policy provisioning, and large-scale distribution. Its policy hash requirement is a direct model for making ScriptVault managed provisioning tamper-evident. ScriptVault should not copy opaque telemetry or a closed trust model; its existing Ed25519 and review infrastructure can provide stronger explainability.

### FireMonkey

FireMonkey is the closest Firefox-native analogue: userscripts and UserCSS, import/export, logging, and Firefox/Android distribution. ScriptVault should learn from its native browser integration and explicit diagnostics, while keeping Android out of the active plan until the device/API and distribution work in `Roadmap_Blocked.md` is unblocked.

### Stylus

Stylus is the reference UserCSS product with variables, editor/linting, galleries, external editing, and live reload. Its long-running FOUC and shadow-DOM issues validate the value of ScriptVault's existing UserCSS engine and make a folder/project workflow a stronger differentiator than another gallery. ScriptVault should not inherit page-DOM CSS assumptions that do not respect the extension's security and shadow-root boundaries.

### Userscripts for Safari

The Safari Userscripts project makes a selected local directory and external-editor workflow first-class across macOS/iOS. The lesson is the folder model and reconnect/status UX, not Safari parity: ScriptVault's supported platform and MV3 permission model are different, and Safari remains out of scope.

### Greasy Fork and OpenUserJS

These catalogs are important discovery and provenance sources, but the verified public Greasy Fork API is read-oriented and its publish flow is a user-session prefilled form; OpenUserJS documents author tools and metadata endpoints without a public write API in the reviewed material. The current product therefore has a tested Greasy Fork browser handoff and OpenUserJS discovery/provenance, not credentialed background publishing. A provider-neutral publication decision is a product question, not an unverified feature recommendation.

### uBlock Origin (adjacent)

uBlock Origin's logger is a useful observability analogue: one inspectable timeline connects requests, filters, and page actions. ScriptVault already has live per-tab execution diagnostics and DevTools network/profiler views; the gap is bounded, privacy-safe continuity and export, which is why the plan extends the existing diagnostic store rather than proposing a new generic panel.

## Security, Privacy, and Reliability

**Current strengths verified in source and tests**

- `src/background/resource-loader.ts`, `src/background/gm-resource-handler.ts`, and the trust-store paths enforce SRI/TOFU or Ed25519 review for remote resources; `src/background/core.ts` also validates managed-script integrity/signatures.
- `src/background/user-script-message-policy.ts`, the content bridge, public API, internal-host guard, AST analyzer, and CSP/Trusted Types gates establish explicit privilege boundaries for page messages, network, imports, and extension pages.
- Support snapshots and local-health exports already use allowlists and aggregate fields, and the repository declares no telemetry. Those controls do not automatically sanitize the separate DevTools HAR/trace exporters.
- `npm run check` currently passes the unit/static gates, CVE floors, manifest/settings/permission checks, locale gate, and 2,855 tests. Prior research claims about DOMPurify, managed-script authentication, AMO toolchain floors, UserCSS `document_start`, Trusted Types, and metadata identity review are stale and intentionally excluded because the current code/history shows them addressed.

**New guardrails required**

- `pages/devtools-panel.js:730-765` copies complete request/response headers and URLs into HAR output, while `:779-831` copies raw document URLs and execution diagnostic errors into trace output. Query tokens, `Authorization`, `Cookie`, `Set-Cookie`, API keys, and sensitive page URLs can therefore leave the extension through a user-triggered download. The existing support-snapshot sanitizer does not cover these paths.
- `src/background/execution-diagnostics.ts:85-99,145-294` bounds the in-memory store but explicitly limits it to the current service-worker lifetime (`src/background/core.ts:7309-7316`). A sleeping/restarted worker removes the context users need to explain a failed run.
- The registration path in `src/background/core.ts:12024-12126,13069+` has version-marker and force-reregister logic, but `tests/e2e/service-worker-rehydration.spec.js:70-93` only proves a worker restart. Chrome and MDN document that user-script registrations are cleared on extension update; the missing proof is a release-risk gap, not evidence that the current code always fails.
- The shipped local workspace is deliberately single-file/file-bound and the sync provider writes one `scriptvault-backup.json` (`src/modules/sync-providers.ts:151-153,744+`). It does not define a multi-file folder manifest, rename/delete reconciliation, or project conflict review.
- Parser/import/bridge/network boundaries have many hand-written malformed fixtures but no deterministic property-based or mutation fuzz corpus. Userscript malware research and extension-privilege research make this a high-value security test gap, especially for metadata, ZIP/JSON import, structured messages, and network error paths.

**Recovery and rollback needs**

- Keep current update review, version history, receipts, trash, and rollback as the recovery primitives for folder imports, upgrade rehydration, and diagnostics. New folder reconciliation must never silently overwrite executable content; new exports must preserve useful status/origin/timing while removing secrets.
- Cloud-provider outages and live browser/real-service coverage are already represented by open roadmap items. AMO/Edge publication credentials and other external operator decisions remain in `Roadmap_Blocked.md`; they are not duplicated as active implementation items.

## Architecture Assessment

- The generated runtime architecture is appropriate for the current MV3 constraints, but it creates two release hazards: source and generated modules can drift, and service-worker startup/extension-update behavior is not covered by the same depth as unit tests. Add the upgrade gate before changing registration architecture or splitting the worker.
- `src/background/core.ts` and `pages/dashboard.js` remain the largest behavioral boundaries. Do not begin a broad rewrite for its own sake; extract or reuse narrow services for privacy-safe export, diagnostics persistence, folder reconciliation, and adversarial boundary fixtures so the existing mutation/concurrency roadmap can land without duplicating policy.
- The current diagnostics model should gain a bounded session/IDB journal with origin-only or hashed URLs, age/eviction metadata, and a single export sanitizer. Preserve the live in-memory view and make persistence an implementation detail, not a second diagnostic UI.
- The local File System Access work is a solid foundation: stored handles, user gestures, permission-state UI, refresh review, size limits, support-safe evidence, and no export of handles/paths are already present. The next layer is a user-selected folder manifest that maps relative paths to ScriptVault IDs and makes add/rename/delete/conflict operations reviewable.
- Testing is strongest in Vitest/static gates and synthetic Playwright surfaces. The highest-leverage expansion is real version-transition coverage, adversarial generators, and the already-open real-world compatibility corpus. Do not re-add existing concurrency, dependency-graph, locale, source-health, document-start, or dependency-refresh items.
- i18n/l10n is intentionally incremental: English is complete and other locales are partial; the existing locale-coverage/localized-metadata item is the right place for that work. Accessibility has explicit four-theme gates, but the current roadmap already owns the untested reflow/forced-colors/deep-link cases; no duplicate a11y item is added here.
- Offline/resilience is aligned with the local-first philosophy: local execution and history work without a provider, while provider health and recovery remain open. Multi-user collaboration is not a fit for the current trust and storage model; migration/import configuration and distribution/packaging are already tracked separately.

## Rejected Ideas

- **Safari native app or Firefox Android expansion** — platform APIs, packaging, and device validation are explicitly deferred or operator-gated in `docs/cross-browser-pipeline.md` and `Roadmap_Blocked.md`; they would dilute the desktop MV3 hardening plan.
- **Runtime plugin marketplace or remote extension modules** — Chrome's remote-hosted-code policy and the userscript privilege model make remote executable extension code an unacceptable default. Use typed in-tree adapters and explicit user code boundaries instead.
- **Direct Greasy Fork/OpenUserJS background publishing** — the verified Greasy Fork API is read-oriented and OpenUserJS's reviewed FAQ does not document a write API; storing account/session credentials would be a worse trust boundary than the current browser handoff.
- **MCP/agent bridge in this pass** — ScriptCat provides a strong model, but a secure companion daemon, transport, capability scopes, approvals, credentials, and store policy review are separately blocked in `Roadmap_Blocked.md`.
- **Collaborative/CRDT editing** — the product is local-first with a small shared-script use case; HLC value synchronization is already an active roadmap item, while full multi-user editing adds conflict, identity, and code-disclosure complexity without current evidence of demand.
- **Chrome Sync as another provider** — the existing roadmap rejected it because quota/size semantics are a poor fit for executable source, history, and encrypted bundles; improve current providers and local recovery instead.
- **Default remote AI authoring** — local Prompt API support is a safer optional experiment, but sending page structure or script content to a remote authoring service conflicts with the product's privacy philosophy and creates a new supply-chain boundary.

## Sources

### Direct managers, catalogs, and UserCSS tools

- https://violentmonkey.github.io/
- https://github.com/violentmonkey/violentmonkey
- https://github.com/violentmonkey/violentmonkey/releases
- https://github.com/violentmonkey/violentmonkey/issues/2608
- https://docs.scriptcat.org/en/
- https://docs.scriptcat.org/en/docs/use/vscode/
- https://docs.scriptcat.org/en/docs/use/sync/
- https://docs.scriptcat.org/en/docs/dev/meta/
- https://github.com/quoid/userscripts
- https://openstyles.org/stylus
- https://github.com/openstyles/stylus/wiki/Writing-UserCSS
- https://github.com/openstyles/stylus/issues/248
- https://addons.mozilla.org/en-US/firefox/addon/firemonkey/
- https://erosman.github.io/firemonkey/src/content/help.html
- https://www.tampermonkey.net/documentation.php?locale=en
- https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo?hl=en-US
- https://greasyfork.org/en/help/api
- https://openuserjs.org/about/Frequently-Asked-Questions
- https://gitlab.com/awesome-scripts/awesome-userscripts

### Community and adjacent observability

- https://www.reddit.com/r/userscripts/comments/1pt9xb5
- https://www.reddit.com/r/userscripts/comments/1odi87w
- https://github.com/violentmonkey/violentmonkey/issues/2453
- https://github.com/violentmonkey/violentmonkey/issues/2455
- https://github.com/violentmonkey/violentmonkey/issues/2365
- https://github.com/Tampermonkey/tampermonkey/issues/211
- https://github.com/Tampermonkey/tampermonkey/issues/2589
- https://github.com/gorhill/uBlock/wiki/The-logger

### Browser APIs, standards, and distribution policy

- https://developer.chrome.com/docs/extensions/reference/api/userScripts
- https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/userScripts
- https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/userScripts/update
- https://developer.chrome.com/docs/extensions/reference/api/permissions
- https://developer.chrome.com/docs/webstore/program-policies
- https://developer.chrome.com/docs/webstore/program-policies/limited-use
- https://developer.chrome.com/docs/webstore/program-policies/user-data-faq
- https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code
- https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- https://developer.chrome.com/docs/capabilities/web-apis/file-system-access
- https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api
- https://developer.chrome.com/blog/file-system-observer
- https://extensionworkshop.com/documentation/publish/source-code-submission/
- https://blog.mozilla.org/addons/2026/07/23/firefox-153-webextensions-api-updates/
- https://www.w3.org/groups/wg/webextensions/
- https://github.com/w3c/webextensions/issues/212
- https://developer.chrome.com/blog/cws-policy-updates-2026

### Dependencies, security, and engineering research

- https://playwright.dev/docs/release-notes
- https://github.com/microsoft/playwright/releases
- https://github.com/vitest-dev/vitest/releases
- https://github.com/jsdom/jsdom/releases
- https://github.com/evanw/esbuild/blob/main/CHANGELOG.md
- https://github.com/microsoft/monaco-editor/releases
- https://github.com/microsoft/monaco-editor/blob/main/CHANGELOG.md
- https://github.com/microsoft/TypeScript
- https://www.npmjs.com/package/web-ext
- https://www.usenix.org/system/files/usenixsecurity23-kim-young-min.pdf
- https://singularity.be/public/papers/monkey-in-the-browser.extended.pdf
- https://owasp.org/www-community/Fuzzing
- https://developer.chrome.com/blog/measuring-performance-in-a-service-worker
- https://automerge.org/docs/reference/documents/conflicts/
- https://pouchdb.apache.org/guides/conflicts.html

## Open Questions

- Does the product want OpenUserJS to remain discovery/provenance-only, or should a future user-initiated handoff be specified? The public API evidence does not justify credentialed background publishing, but the desired product scope requires maintainer judgment.
- Should a future raw-fidelity HAR/trace mode exist behind an explicit, per-export warning, or should every export remain privacy-sanitized? The safe default is implementable now; retaining raw headers is a product/privacy decision.
- If folder projects become a supported synchronization primitive, should the manifest be local-only or deliberately exportable as a portable project format? This affects privacy, cross-device conflict semantics, and migration design and cannot be inferred solely from the current single-file binding.
