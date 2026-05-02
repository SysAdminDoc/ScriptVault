import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';

const contentBridgeCode = readFileSync(resolve(process.cwd(), 'content.js'), 'utf8');
const backgroundCoreCode = readFileSync(resolve(process.cwd(), 'background.core.js'), 'utf8');
const wrapperBuilderCode = readFileSync(resolve(process.cwd(), 'src/background/wrapper-builder.ts'), 'utf8');

function loadContentBridge() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'https://example.com/page',
    runScripts: 'outside-only',
  });
  const sendMessage = vi.fn().mockResolvedValue({ ok: true });
  const chromeMock = {
    runtime: {
      id: 'test-extension-id',
      sendMessage,
      onMessage: {
        addListener: vi.fn(),
      },
    },
  };

  const run = new dom.window.Function('chrome', contentBridgeCode);
  run(chromeMock);

  return {
    window: dom.window,
    chromeMock,
    channel: 'ScriptVault_test-extension-id',
  };
}

function waitForBridgeResponse(win, id) {
  return new Promise((resolvePromise, rejectPromise) => {
    const timeout = win.setTimeout(() => {
      win.removeEventListener('message', handler);
      rejectPromise(new Error(`Timed out waiting for bridge response ${id}`));
    }, 1000);

    function handler(event) {
      const msg = event.data;
      if (!msg || msg.direction !== 'to-userscript' || msg.id !== id) return;
      win.clearTimeout(timeout);
      win.removeEventListener('message', handler);
      resolvePromise(msg);
    }

    win.addEventListener('message', handler);
  });
}

function loadConnectPolicyHelpers() {
  const start = backgroundCoreCode.indexOf('function normalizeConnectHost');
  const end = backgroundCoreCode.indexOf('if (chrome.runtime.onUserScriptMessage)', start);
  if (start === -1 || end === -1) {
    throw new Error('Unable to locate @connect helper functions in background.core.js');
  }
  const helperCode = backgroundCoreCode.slice(start, end);
  return new Function(`${helperCode}; return { evaluateConnectPolicy, normalizeConnectHost };`)();
}

describe('content script bridge security boundary', () => {
  it('does not expose privileged GM APIs through page-visible postMessage', async () => {
    const { window: win, chromeMock, channel } = loadContentBridge();

    expect(win.__ScriptVault_ChannelID__).toBeUndefined();
    expect(win.__ScriptVault_BridgeReady__).toBe(true);

    const blocked = waitForBridgeResponse(win, 'attack');
    win.dispatchEvent(new win.MessageEvent('message', {
      source: win,
      data: {
        channel,
        direction: 'to-background',
        id: 'attack',
        action: 'GM_xmlhttpRequest',
        data: { url: 'https://attacker.example/collect' },
      },
    }));

    await expect(blocked).resolves.toMatchObject({
      success: false,
      error: 'Action not permitted via page-visible bridge',
    });
    expect(chromeMock.runtime.sendMessage).not.toHaveBeenCalled();

    const allowed = waitForBridgeResponse(win, 'telemetry');
    win.dispatchEvent(new win.MessageEvent('message', {
      source: win,
      data: {
        channel,
        direction: 'to-background',
        id: 'telemetry',
        action: 'reportExecTime',
        data: { scriptId: 'script_alpha', time: 12 },
      },
    }));

    await expect(allowed).resolves.toMatchObject({
      success: true,
      result: { ok: true },
    });
    expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
      action: 'reportExecTime',
      data: { scriptId: 'script_alpha', time: 12 },
    });
  });

  it('keeps generated wrapper fallbacks telemetry-only and preserves GM_loadScript context', () => {
    for (const source of [backgroundCoreCode, wrapperBuilderCode]) {
      expect(source).toContain('function canUsePostMessageBridge(action)');
      expect(source).toContain('ScriptVault requires Chrome userScripts messaging for GM API calls.');
      expect(source).toContain("sendToBackground('GM_loadScript', { scriptId, url, timeout: options.timeout })");
    }
  });

  it('normalizes @connect hosts before allowing privileged network calls', () => {
    const { evaluateConnectPolicy, normalizeConnectHost } = loadConnectPolicyHelpers();
    const script = {
      meta: {
        name: 'Connect Test',
        match: ['https://*.example.org/*'],
        include: [],
        connect: ['*.api.example.com', 'https://cdn.example.net/assets/*', 'self', 'localhost'],
      },
    };

    expect(normalizeConnectHost('https://*.Example.com/path')).toBe('example.com');
    expect(evaluateConnectPolicy(script, 'https://v1.api.example.com/data')).toMatchObject({ allowed: true });
    expect(evaluateConnectPolicy(script, 'https://cdn.example.net/assets/lib.js')).toMatchObject({ allowed: true });
    expect(evaluateConnectPolicy(script, 'https://app.example.org/page')).toMatchObject({ allowed: true });
    expect(evaluateConnectPolicy(script, 'http://127.0.0.1:8080/health')).toMatchObject({ allowed: true });
    expect(evaluateConnectPolicy(script, 'https://attacker.example/data')).toMatchObject({
      allowed: false,
      error: 'Connection to attacker.example blocked by @connect policy',
    });
    expect(evaluateConnectPolicy(script, 'not a url')).toMatchObject({
      allowed: false,
      error: 'Invalid URL',
    });
  });
});
