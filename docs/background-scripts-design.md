# DOM-less Background Scripts Design

Status: scoped for X-2. The metadata and setting gate are present, but the
runner is intentionally dormant until a later implementation cycle ships the
offscreen/service-worker execution path.

## Contract

ScriptVault recognizes `@background` as a marker for a script that should run
without an open matching tab. The marker is not equivalent to normal page
injection. A script carrying `@background` must not be registered as a
`chrome.userScripts` page-load script while the DOM-less runner is unavailable.

`experimentalBackgroundScripts` is the global default-off gate for the future
runner. The current dormant contract keeps imported ScriptCat-style scripts from
executing in the wrong context.

## Runner Shape

The runner should use a Chromium offscreen document when DOM-like extension
APIs are required, with a service-worker-only path for pure timer and storage
jobs. Firefox remains deferred until the AMO package can prove the runner works
without unsupported Chromium-only APIs.

Background executions must be queued and serialized per script. A later cycle
should add explicit time, memory, and concurrent-job budgets before enabling
the gate.

`src/background/background-runner.ts` owns the current pure planning contract.
It does not execute script code. It classifies candidates as gated, missing a
trigger, blocked by unsupported grants, or ready for a future runner.
Registration and local-health diagnostics consume the same planner status so
users and support exports can explain why a background script is dormant without
recording script names, source, or URLs.

`src/background/background-wrapper.ts` owns the initial restricted wrapper
scaffold. It builds a DOM-less wrapper string for the future runner but is not
called by registration or alarms yet.

`src/background/background-runner-bridge.ts` owns the non-executing assembly
step. It combines a planner result with a wrapper payload for eligible scripts,
returns wrapper construction errors such as unsupported `@require`, and always
reports `executionEnabled: false` until an offscreen/service-worker runner is
wired.

The runtime `prepareBackgroundRunnerDryRun` action exposes the same eligibility
shape for support/dashboard diagnostics. It does not include wrapper code in the
response and does not execute scripts.

Dashboard support snapshots call the dry-run action only when the user opts into
the sensitive script-inventory category. The snapshot stores sanitized status,
budget, wrapper-support, and `executionEnabled: false` fields; it does not store
wrapper code.

Execution is intentionally blocked until a Chrome Web Store-compliant execution
architecture is approved. The release remote-code gate fails any future
`offscreen_background_run` handler that evaluates wrapper code inside the
extension offscreen document or service worker.

## API Surface

Initial allowed APIs should be limited to DOM-independent primitives:

- `GM_getValue`, `GM_setValue`, `GM_deleteValue`, `GM_listValues`
- `GM_addValueChangeListener`, `GM_removeValueChangeListener`
- `GM_xmlhttpRequest` through the existing host, `@connect`, redirect, abort,
  timeout, and internal-host guard
- `GM_notification`
- logging and script metadata helpers

DOM APIs, page globals, tab-scoped helpers, and page-injection helpers must stay
unavailable in the DOM-less wrapper. The wrapper should fail closed with a clear
runtime error instead of silently falling back to page context.

The current wrapper scaffold rejects unsupported DOM/page/tab grants and
`@require` dependencies before code generation. Inside the generated code,
`window`, `document`, `unsafeWindow`, `location`, storage globals, and
`navigator` are blocked proxy objects that throw on access.

## Scheduling

`@background` may later combine with `@crontab`, alarms, subscription refresh,
or explicit dashboard run actions. A script with `@background` but no schedule
should remain disabled for automatic execution until the user chooses an
explicit trigger model.

The first supported automatic trigger is `@crontab`. The planner reports
`missing-trigger` for a background script without a non-empty crontab expression.

## Budgets

The reviewed defaults are:

- Timeout: 30 seconds per run.
- Concurrency: one active run per script.
- Queue depth: three pending runs per script.

The planner clamps overrides to conservative limits: timeout 1-60 seconds,
concurrency fixed at one, and queue depth 0-10. The execution runner must apply
the same limits before the `experimentalBackgroundScripts` gate can do anything
other than classify candidates.

## Review And Safety

Enablement must reuse review-only install and import quarantine flows. The
install/update UI should label background capability separately from page-match
permissions because it changes when code can run.

## Verification

Acceptance for the implementation pass:

- Parser preserves `meta.background === true`.
- Default settings keep `experimentalBackgroundScripts === false`.
- Page registration skips `@background` scripts while the runner is dormant.
- `planBackgroundScript()` blocks the runner when the gate is off, grants are
  unsupported, no trigger exists, or budgets exceed reviewed limits.
- Local health reports aggregate dormant/eligible/background grant counts
  without script identifiers or URLs.
- `buildBackgroundWrappedScript()` exposes only the reviewed value, XHR,
  notification, log, and info APIs, and fails closed for DOM/page globals.
- `prepareBackgroundRunnerPayload()` can build a wrapper payload for an
  eligible plan while still refusing execution.
- `prepareBackgroundRunnerDryRun` reports planner/wrapper status without
  returning wrapper code.
- Support snapshots include sanitized dry-run results only behind the
  script-inventory opt-in.
- A later live smoke proves a scheduled background script can call
  `GM_notification` with no matching tab open.
- Tests prove blocked DOM APIs, host-scope enforcement, timeouts, and disabled
  gate behavior.
