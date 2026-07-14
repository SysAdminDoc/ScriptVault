import { describe, expect, it } from 'vitest';
import { webcrypto } from 'node:crypto';
import {
  USER_SCRIPT_ALLOWED_EXTRAS,
  authenticateUserScriptSender,
  getScriptAuthToken,
  isExtensionSurfaceSender,
  isScriptAuthRegistrationCurrent,
  isUserScriptAllowedAction,
  markScriptAuthRegistrationCurrent,
} from '../src/background/user-script-message-policy.ts';

describe('user-script message policy', () => {
  it('allows GM namespace calls and reviewed telemetry extras only', () => {
    expect(isUserScriptAllowedAction('GM_xmlhttpRequest')).toBe(true);
    expect(isUserScriptAllowedAction('GM.getValue')).toBe(true);
    expect(isUserScriptAllowedAction('reportExecError')).toBe(true);
    expect(isUserScriptAllowedAction('reportExecTime')).toBe(true);
    expect(isUserScriptAllowedAction('reportDocumentReady')).toBe(true);
    expect(isUserScriptAllowedAction('netlog_record')).toBe(true);
    expect(isUserScriptAllowedAction('recordBridgeTelemetry')).toBe(true);
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
      'recordBridgeTelemetry',
      'reportDocumentReady',
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

  it('authenticates fallback GM senders with a per-install script capability', async () => {
    const originalChrome = globalThis.chrome;
    const originalCryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    const values = {};
    globalThis.chrome = {
      storage: {
        local: {
          get: async key => ({ [key]: values[key] }),
          set: async entries => Object.assign(values, entries),
        },
      },
    };
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: webcrypto,
    });

    try {
      const token = await getScriptAuthToken('script-1');
      expect(token).toMatch(/^[a-f0-9]{64}$/u);

      await expect(authenticateUserScriptSender({
        action: 'GM_getValue',
        data: { scriptId: 'script-1', scriptAuthToken: token },
      }, { tab: { id: 7 } })).resolves.toMatchObject({
        tab: { id: 7 },
        userScriptId: 'script-1',
      });

      await expect(authenticateUserScriptSender({
        action: 'GM_getValue',
        data: { scriptId: 'victim', scriptAuthToken: token },
      }, { tab: { id: 7 } })).rejects.toThrow('could not be authenticated');

      await expect(authenticateUserScriptSender({
        action: 'GM_setValue',
        data: { scriptId: 'script-1' },
      }, { tab: { id: 7 } })).rejects.toThrow('could not be authenticated');

      await expect(authenticateUserScriptSender({
        action: 'reportExecTime',
        data: { scriptId: 'script-1' },
      }, { tab: { id: 7 } })).rejects.toThrow('could not be authenticated');

      await expect(authenticateUserScriptSender({
        action: 'reportExecTime',
        data: { scriptId: 'script-1', scriptAuthToken: token },
      }, { tab: { id: 7 } })).resolves.toMatchObject({
        tab: { id: 7 },
        userScriptId: 'script-1',
      });

      await expect(authenticateUserScriptSender({
        action: 'recordBridgeTelemetry',
        data: { kind: 'execution-time', duration: 12 },
      }, { tab: { id: 7 } })).resolves.toEqual({ tab: { id: 7 } });

      expect(await isScriptAuthRegistrationCurrent()).toBe(false);
      await markScriptAuthRegistrationCurrent();
      expect(await isScriptAuthRegistrationCurrent()).toBe(true);
    } finally {
      globalThis.chrome = originalChrome;
      if (originalCryptoDescriptor) {
        Object.defineProperty(globalThis, 'crypto', originalCryptoDescriptor);
      }
    }
  });
});
