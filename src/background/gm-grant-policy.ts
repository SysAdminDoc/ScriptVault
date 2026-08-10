// Background-side `@grant` enforcement.
//
// `hasGrant()` lives inside the injected GM wrapper, which runs in the same
// USER_SCRIPT world as the untrusted script body. The body is concatenated into
// that scope with `chrome` unshadowed, so a script can ignore the wrapper
// entirely and message the background directly. Until this module existed the
// privileged side checked grants for exactly two actions (`GM_webRequest` and
// `GM_webSocket`), so a script the install review presented as `@grant none`
// could still drive `GM_setValue`, `GM_openInTab`, `GM_download`,
// `GM_notification`, `GM_registerMenuCommand`, `GM_cookie_*`, and
// `GM_xmlhttpRequest` — the permission disclosure did not describe enforced
// capability.
//
// The wrapper checks stay as the fast path; this is the boundary that actually
// decides. The grant names per action mirror the wrapper's own `hasGrant(...)`
// calls exactly, so a script that works through the wrapper is never rejected
// here.
//
// Runs in the MV3 service worker after being generated to
// modules/gm-grant-policy.js.

/**
 * Action → grants that authorize it. Any one grant in the list suffices, which
 * matches the wrapper's `hasGrant(a) || hasGrant(b)` shape. An action absent
 * from this table needs no grant (see UNGRANTED_ACTIONS for why).
 */
const ACTION_GRANTS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  // Value store
  // A value-change listener receives the changed value as part of its public
  // callback contract. On runtimes without the private event port, the wrapper
  // obtains that value through this authenticated read action, so the listener
  // grant must authorize the same narrow read without exposing GM_getValue in
  // the wrapper when the script did not request it.
  GM_getValue: [
    'GM_getValue', 'GM.getValue',
    'GM_addValueChangeListener', 'GM.addValueChangeListener',
  ],
  GM_getValues: ['GM_getValues', 'GM.getValues', 'GM_getValue', 'GM.getValue'],
  GM_setValue: ['GM_setValue', 'GM.setValue'],
  GM_setValues: ['GM_setValues', 'GM.setValues', 'GM_setValue', 'GM.setValue'],
  GM_deleteValue: ['GM_deleteValue', 'GM.deleteValue'],
  GM_deleteValues: ['GM_deleteValues', 'GM.deleteValues', 'GM_deleteValue', 'GM.deleteValue'],
  GM_listValues: ['GM_listValues', 'GM.listValues'],

  // Network. GM.fetch is layered on the same handler as GM_xmlhttpRequest, so
  // either grant admits it — mirroring the wrapper's allowFetchGrant path.
  GM_xmlhttpRequest: ['GM_xmlhttpRequest', 'GM.xmlHttpRequest', 'GM_fetch', 'GM.fetch'],
  GM_xmlhttpRequest_abort: ['GM_xmlhttpRequest', 'GM.xmlHttpRequest', 'GM_fetch', 'GM.fetch'],
  GM_xmlhttpRequest_result: ['GM_xmlhttpRequest', 'GM.xmlHttpRequest', 'GM_fetch', 'GM.fetch'],
  GM_webRequest: ['GM_webRequest'],
  GM_webSocket: ['GM_webSocket', 'GM.webSocket'],
  GM_webSocket_send: ['GM_webSocket', 'GM.webSocket'],
  GM_webSocket_close: ['GM_webSocket', 'GM.webSocket'],
  GM_webSocket_takeEvent: ['GM_webSocket', 'GM.webSocket'],
  // The wrapper gates GM_loadScript on the XHR grant, not a grant of its own.
  GM_loadScript: ['GM_xmlhttpRequest', 'GM.xmlHttpRequest'],

  // Tabs
  GM_openInTab: ['GM_openInTab', 'GM.openInTab'],
  GM_closeTab: ['GM_openInTab', 'GM.openInTab', 'GM_closeTab', 'GM.closeTab'],
  GM_focusTab: ['GM_focusTab', 'GM.focusTab', 'GM_openInTab', 'GM.openInTab'],
  GM_getTab: ['GM_getTab', 'GM.getTab'],
  GM_getTabs: ['GM_getTabs', 'GM.getTabs'],
  GM_saveTab: ['GM_saveTab', 'GM.saveTab'],

  // Notifications
  GM_notification: ['GM_notification', 'GM.notification'],
  GM_updateNotification: ['GM_notification', 'GM.notification'],
  GM_closeNotification: ['GM_notification', 'GM.notification'],

  // Downloads
  GM_download: ['GM_download', 'GM.download'],

  // Menu commands
  GM_registerMenuCommand: ['GM_registerMenuCommand', 'GM.registerMenuCommand'],
  GM_unregisterMenuCommand: [
    'GM_registerMenuCommand', 'GM.registerMenuCommand',
    'GM_unregisterMenuCommand', 'GM.unregisterMenuCommand',
  ],

  // Resources
  GM_getResourceText: ['GM_getResourceText', 'GM.getResourceText'],
  GM_getResourceURL: ['GM_getResourceURL', 'GM.getResourceUrl'],

  // Cookies — the wrapper gates all three on the single GM_cookie grant.
  GM_cookie_list: ['GM_cookie', 'GM.cookie'],
  GM_cookie_set: ['GM_cookie', 'GM.cookie'],
  GM_cookie_delete: ['GM_cookie', 'GM.cookie'],

  // Audio
  GM_audio_getState: ['GM_audio', 'GM.audio'],
  GM_audio_setMute: ['GM_audio', 'GM.audio'],
  GM_audio_watchState: ['GM_audio', 'GM.audio'],
  GM_audio_unwatchState: ['GM_audio', 'GM.audio'],
});

/**
 * GM actions that deliberately require no grant, with the reason. Kept explicit
 * so the completeness check below can tell "intentionally ungranted" from
 * "someone added an action and forgot the table".
 */
const UNGRANTED_ACTIONS: Readonly<Record<string, string>> = Object.freeze({
  // Nothing here today. Every GM action the router accepts maps to a grant.
});

const KNOWN_GRANTED_ACTIONS = new Set<string>(Object.keys(ACTION_GRANTS));
const KNOWN_UNGRANTED_ACTIONS = new Set<string>(Object.keys(UNGRANTED_ACTIONS));

/** Grants that authorize `action`, or `null` when it needs none. */
export function grantsForAction(action: unknown): readonly string[] | null {
  if (typeof action !== 'string') return null;
  return ACTION_GRANTS[action] ?? null;
}

/** True when this action is knowingly exempt from grant enforcement. */
export function isUngrantedAction(action: unknown): boolean {
  return typeof action === 'string' && KNOWN_UNGRANTED_ACTIONS.has(action);
}

/**
 * True when a GM action is neither in the grant table nor on the explicit
 * exemption list — i.e. a new action was wired into the router without a
 * decision about the grant it needs. The gate treats this as ungranted (fail
 * closed) and a test asserts the set is empty, so it cannot ship unnoticed.
 */
export function isUnclassifiedGmAction(action: unknown): boolean {
  if (typeof action !== 'string') return false;
  if (!action.startsWith('GM_') && !action.startsWith('GM.')) return false;
  return !KNOWN_GRANTED_ACTIONS.has(action) && !KNOWN_UNGRANTED_ACTIONS.has(action);
}

/**
 * Decide whether a script's declared `@grant` list authorizes `action`.
 *
 * Mirrors the wrapper's semantics exactly: `@grant none` (or an empty list)
 * grants nothing, `@grant *` grants everything.
 */
export function isActionGrantedByList(action: unknown, grants: unknown): boolean {
  const list: string[] = Array.isArray(grants)
    ? grants.filter((value): value is string => typeof value === 'string')
    : [];
  const required = grantsForAction(action);
  if (!required) {
    // Unclassified GM actions fail closed; explicitly exempt ones pass.
    return !isUnclassifiedGmAction(action);
  }
  if (list.includes('none') || list.length === 0) return false;
  if (list.includes('*')) return true;
  return required.some((grant) => list.includes(grant));
}

/** Same decision, taking a stored script record. */
export function isActionGrantedForScript(action: unknown, script: unknown): boolean {
  const grants = (script as { meta?: { grant?: unknown } } | null)?.meta?.grant;
  return isActionGrantedByList(action, grants);
}

/**
 * The message a rejected request receives. Names the missing grant so a script
 * author can fix their metadata block instead of guessing.
 */
export function grantDeniedError(action: unknown): string {
  const required = grantsForAction(action);
  const name = required && required.length ? required[0] : String(action);
  return `${action} is not granted: add @grant ${name} to the script's metadata block`;
}

export const GMGrantPolicy = {
  ACTION_GRANTS,
  UNGRANTED_ACTIONS,
  grantsForAction,
  isUngrantedAction,
  isUnclassifiedGmAction,
  isActionGrantedByList,
  isActionGrantedForScript,
  grantDeniedError,
};

export default GMGrantPolicy;
