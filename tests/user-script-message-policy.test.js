import { describe, expect, it } from 'vitest';
import {
  USER_SCRIPT_ALLOWED_EXTRAS,
  isUserScriptAllowedAction,
} from '../src/background/user-script-message-policy.ts';

describe('user-script message policy', () => {
  it('allows GM namespace calls and reviewed telemetry extras only', () => {
    expect(isUserScriptAllowedAction('GM_xmlhttpRequest')).toBe(true);
    expect(isUserScriptAllowedAction('GM.getValue')).toBe(true);
    expect(isUserScriptAllowedAction('reportExecError')).toBe(true);
    expect(isUserScriptAllowedAction('reportExecTime')).toBe(true);
    expect(isUserScriptAllowedAction('netlog_record')).toBe(true);

    expect(isUserScriptAllowedAction('deleteScript')).toBe(false);
    expect(isUserScriptAllowedAction('factoryReset')).toBe(false);
    expect(isUserScriptAllowedAction('setSettings')).toBe(false);
    expect(isUserScriptAllowedAction('')).toBe(false);
    expect(isUserScriptAllowedAction(null)).toBe(false);
  });

  it('keeps the explicit extra-action list narrow and reviewable', () => {
    expect([...USER_SCRIPT_ALLOWED_EXTRAS].sort()).toEqual([
      'netlog_record',
      'reportExecError',
      'reportExecTime',
    ]);
  });
});
