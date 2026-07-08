import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GM_NETWORK_ACTIONS,
  handleGMNetworkMessage,
  isGMNetworkAction,
} from '../src/background/gm-network-handler.ts';

const originalGlobals = {
  ScriptStorage: globalThis.ScriptStorage,
  SettingsManager: globalThis.SettingsManager,
  XhrManager: globalThis.XhrManager,
  NetworkLog: globalThis.NetworkLog,
  InternalHostGuard: globalThis.InternalHostGuard,
  evaluateConnectPolicy: globalThis.evaluateConnectPolicy,
  shouldAllowInternalXhr: globalThis.shouldAllowInternalXhr,
  internalXhrError: globalThis.internalXhrError,
  prepareCookieRoutingForFetch: globalThis.prepareCookieRoutingForFetch,
  withCookieHeaderSessionRule: globalThis.withCookieHeaderSessionRule,
  downloadNeedsFetchBridge: globalThis.downloadNeedsFetchBridge,
  responseToDownloadDataUrl: globalThis.responseToDownloadDataUrl,
  normalizeDownloadFilename: globalThis.normalizeDownloadFilename,
  trackPendingDownload: globalThis.trackPendingDownload,
  reconcilePendingDownload: globalThis.reconcilePendingDownload,
  scriptHasGrant: globalThis.scriptHasGrant,
  normalizeGMWebSocketUrl: globalThis.normalizeGMWebSocketUrl,
  normalizeGMWebSocketProtocols: globalThis.normalizeGMWebSocketProtocols,
  normalizeGMWebSocketCloseCode: globalThis.normalizeGMWebSocketCloseCode,
  normalizeGMWebSocketCloseReason: globalThis.normalizeGMWebSocketCloseReason,
  getGMWebSocketMap: globalThis.getGMWebSocketMap,
  sendGMWebSocketEvent: globalThis.sendGMWebSocketEvent,
  estimateGMWebSocketPayloadBytes: globalThis.estimateGMWebSocketPayloadBytes,
  encodeGMWebSocketPayload: globalThis.encodeGMWebSocketPayload,
  decodeGMWebSocketPayload: globalThis.decodeGMWebSocketPayload,
  formatBytes: globalThis.formatBytes,
  GM_DOWNLOAD_FETCH_MAX_BYTES: globalThis.GM_DOWNLOAD_FETCH_MAX_BYTES,
  GM_WEBSOCKET_MAX_MESSAGE_BYTES: globalThis.GM_WEBSOCKET_MAX_MESSAGE_BYTES,
  WebSocket: globalThis.WebSocket,
  fetch: globalThis.fetch,
};

function restoreGlobal(key) {
  if (originalGlobals[key] === undefined) {
    Reflect.deleteProperty(globalThis, key);
  } else {
    globalThis[key] = originalGlobals[key];
  }
}

async function flushNetworkTasks() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('GM network handler', () => {
  let xhrRequests;
  let wsRecords;
  let createdSockets;

  beforeEach(() => {
    vi.clearAllMocks();
    xhrRequests = new Map();
    wsRecords = new Map();
    createdSockets = [];

    globalThis.ScriptStorage = {
      get: vi.fn().mockResolvedValue({
        id: 'script-1',
        meta: { name: 'Network Script', connect: ['api.example.com'] },
      }),
    };
    globalThis.SettingsManager = {
      get: vi.fn().mockResolvedValue({ xhrTimeout: 1000 }),
    };
    globalThis.XhrManager = {
      create: vi.fn((_tabId, _scriptId, _data) => {
        const request = { id: 'xhr_1', tabId: _tabId, scriptId: _scriptId, details: _data, aborted: false };
        xhrRequests.set(request.id, request);
        return request;
      }),
      get: vi.fn((id) => xhrRequests.get(id)),
      remove: vi.fn((id) => xhrRequests.delete(id)),
      buildFetchOptions: vi.fn(() => ({})),
    };
    globalThis.NetworkLog = { add: vi.fn() };
    globalThis.InternalHostGuard = {
      classifyFetchUrl: vi.fn().mockReturnValue({ ok: true }),
      classifyResponseUrl: vi.fn().mockReturnValue({ ok: true }),
    };
    globalThis.evaluateConnectPolicy = vi.fn().mockReturnValue({ allowed: true });
    globalThis.shouldAllowInternalXhr = vi.fn().mockReturnValue(false);
    globalThis.internalXhrError = vi.fn((label) => `${label}: internal`);
    globalThis.prepareCookieRoutingForFetch = vi.fn().mockResolvedValue({ applies: false, cookieHeader: '' });
    globalThis.withCookieHeaderSessionRule = vi.fn((_url, _cookieHeader, fetcher) => fetcher());
    globalThis.downloadNeedsFetchBridge = vi.fn().mockReturnValue(false);
    globalThis.responseToDownloadDataUrl = vi.fn().mockResolvedValue('data:text/plain;base64,b2s=');
    globalThis.normalizeDownloadFilename = vi.fn().mockReturnValue('download.txt');
    globalThis.trackPendingDownload = vi.fn().mockReturnValue({ tabId: 7 });
    globalThis.reconcilePendingDownload = vi.fn().mockResolvedValue();
    globalThis.scriptHasGrant = vi.fn().mockReturnValue(true);
    globalThis.normalizeGMWebSocketUrl = vi.fn((url) => String(url));
    globalThis.normalizeGMWebSocketProtocols = vi.fn((protocols) => protocols);
    globalThis.normalizeGMWebSocketCloseCode = vi.fn((code) => code);
    globalThis.normalizeGMWebSocketCloseReason = vi.fn((reason) => reason);
    globalThis.getGMWebSocketMap = vi.fn(() => wsRecords);
    globalThis.sendGMWebSocketEvent = vi.fn();
    globalThis.estimateGMWebSocketPayloadBytes = vi.fn((payload) => String(payload ?? '').length);
    globalThis.encodeGMWebSocketPayload = vi.fn(async (payload) => payload);
    globalThis.decodeGMWebSocketPayload = vi.fn((payload) => payload);
    globalThis.formatBytes = vi.fn((bytes) => `${bytes} B`);
    globalThis.GM_DOWNLOAD_FETCH_MAX_BYTES = 1024 * 1024;
    globalThis.GM_WEBSOCKET_MAX_MESSAGE_BYTES = 1024;
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('ok', {
      status: 200,
      statusText: 'OK',
      headers: { 'content-length': '2' },
    }));
    class FakeWebSocket {
      static OPEN = 1;
      static CLOSED = 3;

      constructor(url, protocols) {
        this.url = url;
        this.protocols = protocols;
        this.readyState = FakeWebSocket.OPEN;
        this.binaryType = 'blob';
        this.protocol = Array.isArray(protocols) ? protocols[0] : protocols || '';
        this.extensions = '';
        this.sent = [];
        this.closed = null;
        this.listeners = {};
        createdSockets.push(this);
      }

      addEventListener(type, listener) {
        this.listeners[type] = listener;
      }

      send(payload) {
        this.sent.push(payload);
      }

      close(code, reason) {
        this.readyState = FakeWebSocket.CLOSED;
        this.closed = { code, reason };
      }
    }
    globalThis.WebSocket = FakeWebSocket;
    chrome.tabs.sendMessage.mockResolvedValue();
    chrome.permissions.contains.mockResolvedValue(true);
    chrome.downloads.download.mockResolvedValue(42);
  });

  afterEach(() => {
    for (const key of Object.keys(originalGlobals)) restoreGlobal(key);
  });

  it('exposes the exact network action set', () => {
    expect([...GM_NETWORK_ACTIONS]).toEqual([
      'GM_download',
      'GM_webSocket',
      'GM_webSocket_close',
      'GM_webSocket_send',
      'GM_webSocket_takeEvent',
      'GM_xmlhttpRequest',
      'GM_xmlhttpRequest_abort',
      'GM_xmlhttpRequest_result',
    ]);
    expect(isGMNetworkAction('GM_xmlhttpRequest')).toBe(true);
    expect(isGMNetworkAction('GM_cookie_list')).toBe(false);
  });

  it('starts GM_xmlhttpRequest behind connect, internal-host, and cookie-routing guards', async () => {
    await expect(handleGMNetworkMessage('GM_xmlhttpRequest', {
      scriptId: 'script-1',
      url: 'https://api.example.com/data',
      method: 'POST',
      data: 'payload',
    }, { tab: { id: 7 } })).resolves.toEqual({ requestId: 'xhr_1', started: true });

    expect(globalThis.evaluateConnectPolicy).toHaveBeenCalledWith(expect.objectContaining({ id: 'script-1' }), 'https://api.example.com/data');
    expect(globalThis.InternalHostGuard.classifyFetchUrl).toHaveBeenCalledWith('https://api.example.com/data', ['http:', 'https:']);
    expect(globalThis.prepareCookieRoutingForFetch).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://api.example.com/data',
    }), 'GM_xmlhttpRequest');
    expect(globalThis.XhrManager.create).toHaveBeenCalledWith(7, 'script-1', expect.any(Object));
    await flushNetworkTasks();
    expect(globalThis.fetch).toHaveBeenCalledWith('https://api.example.com/data', expect.objectContaining({
      body: 'payload',
    }));
    await vi.waitFor(() => {
      expect(xhrRequests.get('xhr_1')?.finalResult).toMatchObject({
        done: true,
        type: 'load',
      });
    });
    for (const [, message] of chrome.tabs.sendMessage.mock.calls) {
      if (message?.action !== 'xhrEvent') continue;
      expect(message.data).not.toHaveProperty('response');
      expect(message.data).not.toHaveProperty('responseText');
      expect(message.data).not.toHaveProperty('responseHeaders');
    }
    await expect(handleGMNetworkMessage('GM_xmlhttpRequest_result', {
      scriptId: 'script-1',
      requestId: 'xhr_1',
    })).resolves.toMatchObject({
      done: true,
      type: 'load',
      response: expect.objectContaining({
        responseText: 'ok',
      }),
    });
    expect(globalThis.XhrManager.remove).toHaveBeenCalledWith('xhr_1');
  });

  it('aborts tracked GM_xmlhttpRequest entries', async () => {
    const controller = { abort: vi.fn() };
    xhrRequests.set('xhr_abort', { id: 'xhr_abort', aborted: false, controller });

    await expect(handleGMNetworkMessage('GM_xmlhttpRequest_abort', {
      requestId: 'xhr_abort',
    })).resolves.toEqual({ success: true });

    expect(controller.abort).toHaveBeenCalled();
    expect(globalThis.XhrManager.remove).toHaveBeenCalledWith('xhr_abort');
  });

  it('starts, sends, and closes GM_webSocket records behind grant and policy guards', async () => {
    const result = await handleGMNetworkMessage('GM_webSocket', {
      scriptId: 'script-1',
      url: 'wss://api.example.com/socket',
      protocols: ['scriptvault'],
      binaryType: 'arraybuffer',
    }, { tab: { id: 7 } });

    expect(result).toMatchObject({ started: true });
    expect(String(result.requestId)).toMatch(/^ws_/);
    expect(globalThis.scriptHasGrant).toHaveBeenCalledWith(expect.objectContaining({ id: 'script-1' }), ['GM_webSocket', 'GM.webSocket']);
    expect(globalThis.InternalHostGuard.classifyFetchUrl).toHaveBeenCalledWith('wss://api.example.com/socket', ['ws:', 'wss:']);
    expect(createdSockets).toHaveLength(1);

    await expect(handleGMNetworkMessage('GM_webSocket_send', {
      scriptId: 'script-1',
      requestId: result.requestId,
      payload: 'hello',
    })).resolves.toEqual({ success: true });
    expect(createdSockets[0].sent).toEqual(['hello']);

    await expect(handleGMNetworkMessage('GM_webSocket_close', {
      scriptId: 'script-1',
      requestId: result.requestId,
      code: 1000,
      reason: 'done',
    })).resolves.toEqual({ success: true });
    expect(createdSockets[0].closed).toEqual({ code: 1000, reason: 'done' });

    wsRecords.set('ws_queued', {
      scriptId: 'script-1',
      _eventQueue: [{ id: 'evt_secret', data: { payload: 'secret-message', origin: 'https://api.example.com' } }],
    });
    await expect(handleGMNetworkMessage('GM_webSocket_takeEvent', {
      scriptId: 'script-1',
      requestId: 'ws_queued',
      eventId: 'evt_secret',
    })).resolves.toEqual({
      success: true,
      event: { payload: 'secret-message', origin: 'https://api.example.com' },
    });
    expect(wsRecords.get('ws_queued')._eventQueue).toEqual([]);
  });

  it('starts GM_download through permission and filename normalization', async () => {
    await expect(handleGMNetworkMessage('GM_download', {
      scriptId: 'script-1',
      url: 'https://api.example.com/file.txt',
      name: '../download.txt',
      hasCallbacks: true,
    }, { tab: { id: 7 } })).resolves.toEqual({ success: true, downloadId: 42 });

    expect(globalThis.evaluateConnectPolicy).toHaveBeenCalledWith(expect.objectContaining({ id: 'script-1' }), 'https://api.example.com/file.txt');
    expect(globalThis.prepareCookieRoutingForFetch).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://api.example.com/file.txt',
    }), 'GM_download');
    expect(chrome.permissions.contains).toHaveBeenCalledWith({ permissions: ['downloads'] });
    expect(chrome.downloads.download).toHaveBeenCalledWith({
      url: 'https://api.example.com/file.txt',
      filename: 'download.txt',
      saveAs: false,
      conflictAction: 'uniquify',
    });
    expect(globalThis.trackPendingDownload).toHaveBeenCalledWith(42, expect.objectContaining({
      tabId: 7,
      scriptId: 'script-1',
    }));
  });

  it('returns clear validation and policy errors', async () => {
    await expect(handleGMNetworkMessage('GM_xmlhttpRequest', {}))
      .resolves.toEqual({ error: 'No URL provided', type: 'error' });
    globalThis.evaluateConnectPolicy.mockReturnValueOnce({ allowed: false, error: 'not connected' });
    await expect(handleGMNetworkMessage('GM_download', {
      scriptId: 'script-1',
      url: 'https://api.example.com/file.txt',
    })).resolves.toEqual({ error: 'not connected' });

    chrome.permissions.contains.mockResolvedValueOnce(false);
    await expect(handleGMNetworkMessage('GM_download', {
      scriptId: 'script-1',
      url: 'https://api.example.com/file.txt',
    })).resolves.toEqual({
      error: 'Downloads permission not granted. Enable it in ScriptVault settings or reinstall the script that uses GM_download.',
      code: 'PERMISSION_REQUIRED',
    });
  });
});
