import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleGMNetworkMessage } from '../src/background/gm-network-handler.ts';
import { handleGMResourceMessage } from '../src/background/gm-resource-handler.ts';

// The 2026-07 audit found the GM network/resource handlers keyed their
// @connect / @resource authorization off the caller-supplied data.scriptId,
// letting a userscript forge another script's id to borrow its host scope.
// The fix binds to the Chrome-authenticated sender.userScriptId when present.
// These tests pin that the authenticated id wins over a forged data.scriptId.

const saved = {};
function stub(name, value) {
  saved[name] = globalThis[name];
  globalThis[name] = value;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  for (const [name, value] of Object.entries(saved)) {
    if (value === undefined) delete globalThis[name];
    else globalThis[name] = value;
  }
});

describe('GM network handler authenticated-caller binding', () => {
  it('evaluates @connect policy against sender.userScriptId, not a forged data.scriptId', async () => {
    const getSpy = vi.fn().mockResolvedValue({ meta: { name: 'Victim' } });
    stub('ScriptStorage', { get: getSpy });
    // Short-circuit after the ownership lookup so we don't touch the network.
    stub('evaluateConnectPolicy', vi.fn().mockReturnValue({ allowed: false, error: 'blocked', hostname: 'evil.example' }));

    const res = await handleGMNetworkMessage(
      'GM_xmlhttpRequest',
      { url: 'https://evil.example/', scriptId: 'attacker-forged-victim-id' },
      { userScriptId: 'real-caller-id', tab: { id: 3 } },
    );

    expect(res.error).toBe('blocked');
    expect(getSpy).toHaveBeenCalledWith('real-caller-id');
    expect(getSpy).not.toHaveBeenCalledWith('attacker-forged-victim-id');
  });

  it('falls back to data.scriptId when there is no authenticated sender (content-bridge path)', async () => {
    const getSpy = vi.fn().mockResolvedValue({ meta: { name: 'Self' } });
    stub('ScriptStorage', { get: getSpy });
    stub('evaluateConnectPolicy', vi.fn().mockReturnValue({ allowed: false, error: 'blocked' }));

    await handleGMNetworkMessage(
      'GM_xmlhttpRequest',
      { url: 'https://example.com/', scriptId: 'bridge-supplied-id' },
      {},
    );
    expect(getSpy).toHaveBeenCalledWith('bridge-supplied-id');
  });
});

describe('GM resource handler authenticated-caller binding', () => {
  it('reads @resource from sender.userScriptId, not a forged data.scriptId', async () => {
    const getSpy = vi.fn().mockResolvedValue({ meta: { resource: {} } });
    stub('ScriptStorage', { get: getSpy });

    await handleGMResourceMessage(
      'GM_getResourceText',
      { name: 'icon', scriptId: 'attacker-forged-victim-id' },
      { userScriptId: 'real-caller-id' },
    );
    expect(getSpy).toHaveBeenCalledWith('real-caller-id');
    expect(getSpy).not.toHaveBeenCalledWith('attacker-forged-victim-id');
  });
});
