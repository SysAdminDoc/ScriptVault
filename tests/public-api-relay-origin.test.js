// The page-facing Public API / Local MCP relay: proves the action reaches the
// background at all (it was rejected by the user-script allowlist from v3.18.0),
// and that the requesting origin comes from the SENDER rather than the relayed
// payload — otherwise any tab could claim a trusted origin.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { SecurityActionHandler, senderWebOrigin } from '../src/background/security-action-handler.ts';
import { USER_SCRIPT_ALLOWED_EXTRAS, isUserScriptAllowedAction } from '../src/background/user-script-message-policy.ts';

const ROOT = process.cwd();

describe('public API relay reaches the background', () => {
  it('is on the user-script allowlist, so a content-script relay is not rejected', () => {
    expect(USER_SCRIPT_ALLOWED_EXTRAS).toContain('publicApi_handleWebMessage');
    expect(isUserScriptAllowedAction('publicApi_handleWebMessage')).toBe(true);
  });

  it('is still not a blanket opening: privileged actions stay rejected', () => {
    for (const action of ['factoryReset', 'deleteScript', 'importScripts', 'setSettings']) {
      expect(isUserScriptAllowedAction(action)).toBe(false);
    }
  });

  it('relays without an attacker-supplied origin field', () => {
    const content = readFileSync(resolve(ROOT, 'content.js'), 'utf8');
    const relayAt = content.indexOf("action: 'publicApi_handleWebMessage'");
    expect(relayAt).toBeGreaterThan(-1);
    const relayBlock = content.slice(relayAt, relayAt + 200);
    expect(relayBlock).not.toContain('origin:');
    // The same-window guard is what makes the sender's origin equivalent to the
    // posting origin; without it an embedded frame's message would be attributed
    // to the containing page.
    expect(content).toContain('if (event.source !== window) return;');
  });
});

describe('relay origin is derived from the sender', () => {
  it('prefers sender.origin, falls back to sender.url', () => {
    expect(senderWebOrigin({ origin: 'https://trusted.example' })).toBe('https://trusted.example');
    expect(senderWebOrigin({ url: 'https://trusted.example/page?q=1#x' })).toBe('https://trusted.example');
    expect(senderWebOrigin({ origin: 'https://a.example', url: 'https://b.example/p' })).toBe('https://a.example');
    expect(senderWebOrigin({ url: 'http://127.0.0.1:8765/bridge' })).toBe('http://127.0.0.1:8765');
  });

  it('yields no origin for non-web senders, so the handler refuses them', () => {
    expect(senderWebOrigin({ url: 'chrome-extension://abc/pages/dashboard.html' })).toBe('');
    expect(senderWebOrigin({ url: 'file:///tmp/page.html' })).toBe('');
    expect(senderWebOrigin({ origin: 'null' })).toBe('');
    expect(senderWebOrigin({ origin: 'not a url' })).toBe('');
    expect(senderWebOrigin({})).toBe('');
    expect(senderWebOrigin(null)).toBe('');
    expect(senderWebOrigin(undefined)).toBe('');
  });

  it('ignores a forged origin on the message and passes the sender origin through', async () => {
    const handleWebMessage = vi.fn().mockResolvedValue({ response: null });
    const handlers = SecurityActionHandler.createSecurityActionHandlers({
      handleWebMessage,
      // The rest of the dependency surface is unused by this action.
      getPublicKey: vi.fn(), sign: vi.fn(), verify: vi.fn(), verifyRaw: vi.fn(),
      trustKey: vi.fn(), untrustKey: vi.fn(), getTrustedKeys: vi.fn(), generateKeypair: vi.fn(),
      getTrustedOrigins: vi.fn(), setTrustedOrigins: vi.fn(),
      getTrustedExtensionIds: vi.fn(), setTrustedExtensionIds: vi.fn(),
      getLocalMcpBridgeConfig: vi.fn(), setLocalMcpBridgeConfig: vi.fn(),
      getPermissions: vi.fn(), getAuditLog: vi.fn(), clearAuditLog: vi.fn(),
    });

    await handlers.publicApi_handleWebMessage({
      action: 'publicApi_handleWebMessage',
      message: {
        action: 'publicApi_handleWebMessage',
        // An untrusted tab claiming to be the trusted origin.
        origin: 'https://trusted.example',
        message: { type: 'scriptvault:mcp:writeScript', name: 'evil', code: '// evil' },
      },
      sender: { origin: 'https://attacker.test', url: 'https://attacker.test/page', tab: { id: 4 } },
    });

    expect(handleWebMessage).toHaveBeenCalledTimes(1);
    expect(handleWebMessage.mock.calls[0][0]).toBe('https://attacker.test');
    expect(handleWebMessage.mock.calls[0][0]).not.toBe('https://trusted.example');
  });
});
