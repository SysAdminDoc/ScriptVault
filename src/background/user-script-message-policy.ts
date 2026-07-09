// ============================================================================
// User-script message policy
// ============================================================================

export const USER_SCRIPT_ALLOWED_EXTRAS = Object.freeze([
  'chainDomEvent',
  'getChainDomEventTriggers',
  'netlog_record',
  'reportExecError',
  'reportExecTime',
] as const);

const USER_SCRIPT_ALLOWED_EXTRA_SET = new Set<string>(USER_SCRIPT_ALLOWED_EXTRAS);

interface RuntimeMessageSender {
  id?: string;
  url?: string;
  tab?: unknown;
}

export function isUserScriptAllowedAction(action: unknown): boolean {
  if (typeof action !== 'string') return false;
  if (action.startsWith('GM_') || action.startsWith('GM.')) return true;
  return USER_SCRIPT_ALLOWED_EXTRA_SET.has(action);
}

export function isExtensionSurfaceSender(
  sender: RuntimeMessageSender | null | undefined,
  extensionId: string | null | undefined,
): boolean {
  if (!sender || !extensionId) return false;

  const ownExtensionPrefix = `chrome-extension://${extensionId}/`;
  const url = typeof sender.url === 'string' ? sender.url : '';
  const ownFirefoxExtensionPage = sender.id === extensionId && url.startsWith('moz-extension://');
  if (url.startsWith(ownExtensionPrefix) || ownFirefoxExtensionPage) return true;

  // Service-worker self-messages have no sender.tab/url; only this extension's
  // own code can originate them.
  if (sender.id === extensionId && !sender.tab && !url) return true;

  return false;
}

export const UserScriptMessagePolicy = Object.freeze({
  USER_SCRIPT_ALLOWED_EXTRAS,
  isExtensionSurfaceSender,
  isUserScriptAllowedAction,
});

export default UserScriptMessagePolicy;
