import { describe, expect, it } from 'vitest';
import {
  USER_SCRIPT_ALLOWED_EXTRAS,
  isExtensionSurfaceSender,
  isUserScriptAllowedAction,
} from '../src/background/user-script-message-policy.ts';

describe('user-script message policy', () => {
  it('allows GM namespace calls and reviewed telemetry extras only', () => {
    expect(isUserScriptAllowedAction('GM_xmlhttpRequest')).toBe(true);
    expect(isUserScriptAllowedAction('GM.getValue')).toBe(true);
    expect(isUserScriptAllowedAction('reportExecError')).toBe(true);
    expect(isUserScriptAllowedAction('reportExecTime')).toBe(true);
    expect(isUserScriptAllowedAction('netlog_record')).toBe(true);
    expect(isUserScriptAllowedAction('getChainDomEventTriggers')).toBe(true);
    expect(isUserScriptAllowedAction('chainDomEvent')).toBe(true);

    expect(isUserScriptAllowedAction('deleteScript')).toBe(false);
    expect(isUserScriptAllowedAction('runChainNow')).toBe(false);
    expect(isUserScriptAllowedAction('factoryReset')).toBe(false);
    expect(isUserScriptAllowedAction('setSettings')).toBe(false);
    expect(isUserScriptAllowedAction('')).toBe(false);
    expect(isUserScriptAllowedAction(null)).toBe(false);
  });

  it('keeps the explicit extra-action list narrow and reviewable', () => {
    expect([...USER_SCRIPT_ALLOWED_EXTRAS].sort()).toEqual([
      'chainDomEvent',
      'getChainDomEventTriggers',
      'netlog_record',
      'reportExecError',
      'reportExecTime',
    ]);
  });

  it('trusts only extension surfaces and service-worker self-messages', () => {
    const extensionId = 'abc123';

    expect(isExtensionSurfaceSender({
      id: extensionId,
      url: `chrome-extension://${extensionId}/pages/dashboard.html`,
    }, extensionId)).toBe(true);

    expect(isExtensionSurfaceSender({
      id: extensionId,
      url: 'moz-extension://generated-id/pages/popup.html',
    }, extensionId)).toBe(true);

    expect(isExtensionSurfaceSender({
      id: extensionId,
    }, extensionId)).toBe(true);

    expect(isExtensionSurfaceSender({
      id: extensionId,
      tab: { id: 1 },
      url: 'https://example.com/',
    }, extensionId)).toBe(false);

    expect(isExtensionSurfaceSender({
      id: 'other-extension',
      url: 'chrome-extension://other-extension/pages/dashboard.html',
    }, extensionId)).toBe(false);

    expect(isExtensionSurfaceSender(null, extensionId)).toBe(false);
    expect(isExtensionSurfaceSender({ id: extensionId }, '')).toBe(false);
  });
});
