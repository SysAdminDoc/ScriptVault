// ============================================================================
// User-script message policy
// ============================================================================

export const USER_SCRIPT_ALLOWED_EXTRAS = Object.freeze([
  'netlog_record',
  'reportExecError',
  'reportExecTime',
] as const);

const USER_SCRIPT_ALLOWED_EXTRA_SET = new Set<string>(USER_SCRIPT_ALLOWED_EXTRAS);

export function isUserScriptAllowedAction(action: unknown): boolean {
  if (typeof action !== 'string') return false;
  if (action.startsWith('GM_') || action.startsWith('GM.')) return true;
  return USER_SCRIPT_ALLOWED_EXTRA_SET.has(action);
}

export const UserScriptMessagePolicy = Object.freeze({
  USER_SCRIPT_ALLOWED_EXTRAS,
  isUserScriptAllowedAction,
});

export default UserScriptMessagePolicy;
