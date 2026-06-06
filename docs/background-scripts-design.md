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

## Scheduling

`@background` may later combine with `@crontab`, alarms, subscription refresh,
or explicit dashboard run actions. A script with `@background` but no schedule
should remain disabled for automatic execution until the user chooses an
explicit trigger model.

## Review And Safety

Enablement must reuse review-only install and import quarantine flows. The
install/update UI should label background capability separately from page-match
permissions because it changes when code can run.

## Verification

Acceptance for the implementation pass:

- Parser preserves `meta.background === true`.
- Default settings keep `experimentalBackgroundScripts === false`.
- Page registration skips `@background` scripts while the runner is dormant.
- A later live smoke proves a scheduled background script can call
  `GM_notification` with no matching tab open.
- Tests prove blocked DOM APIs, host-scope enforcement, timeouts, and disabled
  gate behavior.
