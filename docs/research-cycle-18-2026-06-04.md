# Research Cycle 18 - Import and Restore Trust Quarantine

Status: planning-only research handoff.
Date: 2026-06-04.
Scope: ScriptVault import, ZIP restore, backup restore, store-review, and
userscript-manager trust boundaries. Active checkbox state remains in
`ROADMAP.md`.

## Phase 0 - Repo Reconnaissance

Live checkout evidence reviewed:

- `git status --short --branch`: `main...origin/main` with pre-existing dirty
  source/build work and planning notes. This cycle did not edit source files.
- `rtk git log -10 --oneline --decorate`: current tracked HEAD was
  `9f474be feat: wire npm require resolver`.
- `README.md`: defines ScriptVault v3.11.0 as a Manifest V3 userscript manager
  with local-first script execution, import/export, backup, Firefox package,
  Edge package, and store-review documentation.
- Repo working notes confirm `ROADMAP.md` is the live planning source of truth
  and generated/runtime artifacts must not be edited directly.
- `ROADMAP.md`: already covers completed credential redaction, bounded archive
  intake, restore receipts, source ZIP review, remote-code compliance, and
  open supply-chain/coverage/settings items.
- `RESEARCH_REPORT.md` and `RESEARCH_FEATURE_PLAN.md`: companion research
  context only; they do not replace `ROADMAP.md`.
- `src/background/import-export.ts`: authoritative TypeScript import/export
  helper for JSON/ZIP script imports and archive registration.
- `src/modules/backup-scheduler.ts`: scheduled backup, inspect, verify, and
  restore orchestration.
- `pages/dashboard.js`: import, restore, backup review, credential-restore, and
  confirmation UI.
- `tests/runtime-import-export.test.js`, `tests/import-snapshot.test.js`, and
  `tests/backup-scheduler.test.js`: current regression coverage for identity,
  metadata, archive bounds, credentials, receipts, and overwrite rollback.

Current product shape from the repo: ScriptVault already treats archives as
untrusted for resource bounds and treats settings credentials as separately
gated. The remaining trust transition is executable script enablement after
archive import or restore.

## Phase 0.5 - Sync and Anti-Dup Ledger

Existing rows intentionally not duplicated:

- Credential-bearing settings in exports/backups are closed in `ROADMAP.md`
  under the P1 credential gate. Cycle 18 does not reopen credential redaction.
- Backup ZIP/JSON intake bounds are closed in `ROADMAP.md`. Cycle 18 assumes
  size, entry-count, nested-archive, and compression-ratio caps exist.
- Restore receipts and rollback are closed in `ROADMAP.md`. Cycle 18 builds on
  receipts but asks for pre-run trust quarantine, not only post-restore undo.
- CWS remote-hosted-code compliance is closed in `ROADMAP.md`. Cycle 18 uses the
  same policy boundary to keep reviewer evidence clear for user-provided code.
- Settings schema validation is already tracked in Cycle 17. Cycle 18 only
  touches import/restore script execution state.
- Host-permission recovery/narrow-host mode remains an open P2 item. Cycle 18
  does not change browser host permissions.

No built item was marked done in this cycle. The verified new gap is distinct:
archive import and restore can persist enabled executable scripts and
re-register immediately, with no quarantine or first-run review state.

## Phase 1 - Feature Inventory

Import and restore entry points:

- JSON script import: `src/background/import-export.ts:538-568` writes imported
  scripts, sets `enabled: script.enabled !== false`, and calls
  `registerAllScripts()`.
- ZIP script import: `src/background/import-export.ts:697-825` defaults
  `enabled` to `true`, preserves `optionsData.settings?.enabled !== false`
  when options exist, writes each script, and calls `registerAllScripts()`.
- Raw `.js` fallback in ZIP import:
  `src/background/import-export.ts:790-825` accepts user-script-looking JS,
  stores it with `enabled: true`, and re-registers all scripts.
- Selective managed-backup restore:
  `src/modules/backup-scheduler.ts:1321-1325` zips selected files and calls
  `importFromZip(..., { overwrite: true, recordReceipt: false })`.
- Full managed-backup restore:
  `src/modules/backup-scheduler.ts:1335-1345` calls `importFromZip(backup.data,
  { overwrite: true, recordReceipt: false })`.
- Generic import confirmation: `pages/dashboard.js:1336-1365` warns about
  overwrite, storage, settings, and credentials, but not first-run trust state.
- Dropped/imported files: `pages/dashboard.js:8278-8289` confirms matching
  scripts may be overwritten and credential behavior, but not that enabled
  imported scripts may be registered immediately.
- Backup review: `pages/dashboard.js:12248-12385` previews full-vault impact,
  scripts, stored values, and settings credentials.
- Restore actions: `pages/dashboard.js:12386-12535` confirm selected/all/full
  restore effects, then call restore. They do not offer a quarantine/default
  disabled mode for executable script bodies.

Existing protections:

- Archive bounds reject unsafe sizes before import/registration.
- Settings credentials require archive metadata plus user opt-in.
- Overwrites snapshot old script state and can create receipts.
- Backup verification can inspect archive contents before mutating state.
- Store-review remote-code docs explain the difference between extension logic
  and user-provided userscript code.

Maturity: data-safety and reviewer-safety are strong, but execution-safety lacks
one last consent gate.

## Phase 2 - Quality and Risk Audit

Security risk:

- A user may import an old archive, a shared backup, or a downloaded ZIP whose
  script bodies are executable code. If the archive marks scripts enabled, or
  omits explicit disabled state, ScriptVault can persist enabled scripts and
  re-register immediately.
- Rollback helps after mutation, but it does not prevent first-run exposure if a
  script matches an already-open page or is scheduled/background-capable.
- Store-review policy allows user scripts through documented APIs, but reviewer
  evidence is cleaner if imported user code has an explicit trust state rather
  than looking like extension-managed code silently activating from an archive.
- Backup restore is a high-trust operation for personal backups. The UI should
  still distinguish "restore my data" from "activate every restored executable
  script now."

UX risk:

- The backup review UI already shows "Will overwrite" and "New script" tags, so
  it has a natural place for "quarantined" / "requires review" tags.
- JSON/ZIP import confirmation can explain the default succinctly without adding
  a broad import wizard.
- A power-user escape hatch can exist for self-made backups, but it must be
  explicit and recorded in the restore/import receipt.

Testing risk:

- Current tests pin enablement preservation for ZIP metadata, for example
  `tests/runtime-import-export.test.js:280-338`.
- Current import-snapshot tests use enabled new scripts in fixtures, for example
  `tests/import-snapshot.test.js:150-225`.
- Quarantine will need focused fixture updates so old archive identity,
  overwrite receipts, rollback, and disabled-script preservation remain
  intentional rather than accidentally weakened.

## Phase 3 - External Landscape Sources

Primary browser and store-review sources:

1. Chrome `userScripts` API:
   https://developer.chrome.com/docs/extensions/reference/api/userScripts
2. Chrome extension permission declaration:
   https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions
3. Chrome Permissions API:
   https://developer.chrome.com/docs/extensions/reference/api/permissions
4. Chrome cross-origin requests:
   https://developer.chrome.com/docs/extensions/develop/concepts/network-requests
5. Chrome remote-hosted-code migration guidance:
   https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code
6. Chrome Web Store program policies:
   https://developer.chrome.com/docs/webstore/program-policies/policies
7. Chrome declarativeNetRequest API:
   https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest
8. Chrome storage API:
   https://developer.chrome.com/docs/extensions/reference/api/storage
9. Chrome downloads API:
   https://developer.chrome.com/docs/extensions/reference/api/downloads
10. Chrome cookies API:
   https://developer.chrome.com/docs/extensions/reference/api/cookies
11. MDN `userScripts` API:
   https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/userScripts
12. MDN optional host permissions:
   https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/optional_host_permissions
13. MDN permissions API:
   https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/permissions
14. MDN manifest permissions:
   https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/permissions
15. Mozilla Firefox for Android extension development:
   https://extensionworkshop.com/documentation/develop/developing-extensions-for-firefox-for-android/
16. Mozilla web-ext workflow:
   https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/
17. Mozilla source-code submission:
   https://extensionworkshop.com/documentation/publish/source-code-submission/
18. Mozilla third-party library usage:
   https://extensionworkshop.com/documentation/publish/third-party-library-usage/
19. Mozilla add-on policies:
   https://extensionworkshop.com/documentation/publish/add-on-policies/
20. MDN extension publishing notes:
   https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/What_next
21. Microsoft Edge Chrome-port guidance:
   https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/port-chrome-extension
22. Microsoft Edge Add-ons publish flow:
   https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension
23. Microsoft Edge supported APIs:
   https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/api-support
24. Microsoft Edge Add-ons API:
   https://learn.microsoft.com/en-us/microsoft-edge/extensions/update/api/using-addons-api

Userscript-manager and ecosystem sources:

25. Tampermonkey documentation:
   https://www.tampermonkey.net/documentation.php
26. Tampermonkey changelog:
   https://www.tampermonkey.net/changelog.php
27. Violentmonkey website:
   https://violentmonkey.github.io/
28. Violentmonkey repository:
   https://github.com/violentmonkey/violentmonkey
29. ScriptCat changelog:
   https://docs.scriptcat.org/docs/change/
30. ScriptCat device/sync config PR:
   https://github.com/scriptscat/scriptcat/pull/1309
31. Greasemonkey website:
   https://www.greasespot.net/
32. Greasemonkey repository:
   https://github.com/greasemonkey/greasemonkey
33. Greasy Fork installing-user-scripts help:
   https://greasyfork.org/en/help/installing-user-scripts
34. OpenUserJS:
   https://openuserjs.org/

Security, supply-chain, and test-process sources:

35. OWASP File Upload Cheat Sheet:
   https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
36. OWASP Secrets Management Cheat Sheet:
   https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html
37. OWASP SSRF Prevention Cheat Sheet:
   https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html
38. MITRE CWE-409:
   https://cwe.mitre.org/data/definitions/409.html
39. MITRE CWE-494:
   https://cwe.mitre.org/data/definitions/494.html
40. MITRE CWE-829:
   https://cwe.mitre.org/data/definitions/829.html
41. GitHub Actions secure use:
   https://docs.github.com/en/actions/reference/security/secure-use
42. GitHub Dependabot npm version updates:
   https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/configuring-dependabot-version-updates
43. GitHub Dependabot action updates:
   https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/keeping-your-actions-up-to-date-with-dependabot
44. GitHub Dependabot options reference:
   https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference
45. npm audit:
   https://docs.npmjs.com/cli/v11/commands/npm-audit/
46. npm package metadata:
   https://docs.npmjs.com/cli/v11/configuring-npm/package-json/
47. npm engine-strict config:
   https://docs.npmjs.com/cli/using-npm/config#engine-strict
48. Node `import.meta.dirname`:
   https://nodejs.org/api/esm.html#importmetadirname
49. Node package manager metadata:
   https://nodejs.org/download/release/v21.1.0/docs/api/packages.html#packagemanager
50. setup-node usage:
   https://github.com/actions/setup-node#usage
51. Vitest coverage config:
   https://vitest.dev/config/coverage.html
52. Vitest coverage guide:
   https://main.vitest.dev/guide/coverage

## Phase 4 - Harvested Ideas

Candidate ideas and fit:

- Quarantine imported/restored scripts by default until explicit review.
  Strong fit. It protects the exact trust boundary that remains after archive
  bounds and credential redaction.
- Add a "trust and enable all scripts from this archive" advanced checkbox.
  Medium fit. Useful for personal backups, but must be explicit, default off,
  and reflected in receipts.
- Add per-script restore toggles for enabled state. Strong fit. Backup review
  already shows each script and can display archived enabled state versus local
  post-restore state.
- Add receipt metadata showing how many scripts were imported disabled,
  preserved disabled, preserved enabled by explicit override, or quarantined.
  Strong fit. It aligns with restore receipts and reviewer evidence.
- Add a post-import review queue/filter in dashboard. Medium fit. Helpful, but
  can be staged after the core import default changes.
- Require script signature/provenance before enabling imported scripts. Low fit
  for this immediate item. Provenance is valuable but would block legacy backups
  and third-party managers too aggressively.
- Virus-scan imported script bodies. Rejected. Browser extensions should not
  add unreliable malware-scanning claims without a maintained engine and update
  channel.
- Disable all ScriptVault execution during restore. Rejected as too broad. The
  risk is newly imported or overwritten executable script bodies, not unrelated
  stable local scripts.

## Phase 5 - Scored Recommendation

Recommended roadmap item:

- Priority: P1.
- Title: Quarantine imported/restored executable scripts before first run.
- Fit: high. This directly matches ScriptVault's local-first, consent-first,
  reviewer-friendly positioning.
- Impact: high. Prevents accidental execution of unreviewed archive code after
  JSON import, ZIP import, selective restore, or full-vault restore.
- Effort: medium. The import helpers, backup review UI, receipts, and tests are
  already centralized.
- Risk: medium. Some users expect personal backups to restore enabled state.
  Mitigate with explicit "trust this archive and preserve enabled scripts" copy,
  receipt metadata, and a migration-safe default.
- Dependencies: import/export helpers, backup scheduler, dashboard restore UI,
  receipt schema, runtime registration, tests.
- Novelty: medium. Competitors support backup/import, but a clear quarantine
  state is a useful trust differentiator.
- Tier: Now.

Acceptance target:

- JSON, ZIP, selected restore, full restore, and raw-JS fallback imports default
  new or overwritten executable script bodies to disabled/quarantined unless an
  explicit trust option is passed by the UI.
- Disabled archive entries remain disabled and are not mislabeled as requiring
  new trust.
- Trusted self-backup restore can preserve enabled state only after a visible
  confirmation that names the count of scripts that will become active.
- Restore/import receipts record quarantined counts, preserved-enabled counts,
  and trust override source without logging script bodies or credentials.
- The dashboard exposes a review path to enable quarantined scripts later.
- `registerAllScripts()` is not called in a way that activates quarantined
  imports before the review state is persisted.

Verification target:

- Import/export tests cover JSON import, ZIP import, raw-JS fallback,
  overwritten existing script, selected backup restore, and full-vault restore.
- Backup review tests verify default quarantine copy and explicit trust override
  copy.
- Receipt tests verify counts and rollback compatibility.
- Runtime/source parity checks continue to pass.
- Store-copy/release docs remain clear that user-provided scripts execute only
  after user action.

## Self-Audit

- Planning-only files are the intended touch set.
- No source/build/runtime/generated files are part of this cycle.
- The recommendation is not a duplicate of archive bounds, credential redaction,
  restore receipts, host-permission recovery, or settings schema validation.
- Security, UX/accessibility, testing, docs, store-review, import/export,
  backup/restore, migration, and cross-browser implications are explicitly
  covered.
- Every promoted recommendation has local file-line evidence plus external URL
  anchors.
