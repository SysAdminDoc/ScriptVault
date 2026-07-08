export type GMNetworkAction =
  | 'GM_download'
  | 'GM_webSocket'
  | 'GM_webSocket_close'
  | 'GM_webSocket_send'
  | 'GM_webSocket_takeEvent'
  | 'GM_xmlhttpRequest'
  | 'GM_xmlhttpRequest_abort'
  | 'GM_xmlhttpRequest_result';

export const GM_NETWORK_ACTIONS: readonly GMNetworkAction[] = [
  'GM_download',
  'GM_webSocket',
  'GM_webSocket_close',
  'GM_webSocket_send',
  'GM_webSocket_takeEvent',
  'GM_xmlhttpRequest',
  'GM_xmlhttpRequest_abort',
  'GM_xmlhttpRequest_result',
];

const GM_NETWORK_ACTION_SET: ReadonlySet<string> = new Set(GM_NETWORK_ACTIONS);

type GMNetworkPayload = Record<string, any>;
type RuntimeMessageSender = {
  tab?: {
    id?: number;
    url?: string;
  };
  userScriptId?: string;
};

declare const ScriptStorage: any;
declare const SettingsManager: any;
declare const XhrManager: any;
declare const NetworkLog: any;
declare const InternalHostGuard: any;
declare const GM_DOWNLOAD_FETCH_MAX_BYTES: number;
declare const GM_WEBSOCKET_MAX_MESSAGE_BYTES: number;
declare const evaluateConnectPolicy: (script: any, url: string) => { allowed: boolean; error?: string; hostname?: string };
declare const shouldAllowInternalXhr: (script: any, url: string, settings: any, check: any) => boolean;
declare const internalXhrError: (label: string, check: any) => string;
declare const prepareCookieRoutingForFetch: (data?: GMNetworkPayload, apiName?: string) => Promise<{ applies?: boolean; cookieHeader?: string; error?: string }>;
declare const withCookieHeaderSessionRule: (url: string, cookieHeader: string | undefined, fetcher: () => Promise<Response>) => Promise<Response>;
declare const downloadNeedsFetchBridge: (data?: GMNetworkPayload) => boolean;
declare const responseToDownloadDataUrl: (response: Response) => Promise<string>;
declare const normalizeDownloadFilename: (name: unknown, url: string, sourceName?: unknown) => string;
declare const trackPendingDownload: (downloadId: number, data: GMNetworkPayload) => any;
declare const reconcilePendingDownload: (downloadId: number, tracker: any, now?: number) => Promise<void>;
declare const scriptHasGrant: (script: any, grants: string[]) => boolean;
declare const normalizeGMWebSocketUrl: (url: unknown) => string;
declare const normalizeGMWebSocketProtocols: (protocols: unknown) => string | string[] | undefined;
declare const normalizeGMWebSocketCloseCode: (code: unknown) => number | undefined;
declare const normalizeGMWebSocketCloseReason: (reason: unknown) => string | undefined;
declare const getGMWebSocketMap: () => Map<string, any>;
declare const sendGMWebSocketEvent: (record: any, type: string, data?: GMNetworkPayload) => void;
declare const estimateGMWebSocketPayloadBytes: (payload: unknown) => number;
declare const encodeGMWebSocketPayload: (payload: unknown) => Promise<unknown>;
declare const decodeGMWebSocketPayload: (payload: unknown) => unknown;
declare const formatBytes: (bytes: number) => string;

function errorMessage(error: unknown, fallback = 'Unexpected error'): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  if (typeof error === 'string' && error) return error;
  return fallback;
}

function errorName(error: unknown): string {
  if (error && typeof error === 'object' && 'name' in error) {
    const name = (error as { name?: unknown }).name;
    if (typeof name === 'string') return name;
  }
  return '';
}

function encodeBytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 32768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
  }
  return btoa(binary);
}

function deserializeRequestBody(rawBody: any): any {
  if (!rawBody || typeof rawBody !== 'object' || ArrayBuffer.isView(rawBody) || rawBody instanceof ArrayBuffer) {
    return rawBody;
  }
  if (rawBody.__sv_blob__) {
    const bytes = Uint8Array.from(atob(rawBody.b64), (char) => char.charCodeAt(0));
    return rawBody.name
      ? new File([bytes], rawBody.name, { type: rawBody.type || '' })
      : new Blob([bytes], { type: rawBody.type || '' });
  }
  if (rawBody.__sv_formdata__) {
    const formData = new FormData();
    for (const entry of rawBody.entries || []) {
      if (entry.b64 !== undefined) {
        const bytes = Uint8Array.from(atob(entry.b64), (char) => char.charCodeAt(0));
        formData.append(entry.name, new Blob([bytes], { type: entry.type || '' }), entry.filename || 'blob');
      } else {
        formData.append(entry.name, entry.value);
      }
    }
    return formData;
  }
  return rawBody;
}

async function blobToDataUrl(blob: Blob): Promise<string | null> {
  return await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

function redactXhrBridgePayload(eventData: GMNetworkPayload = {}): GMNetworkPayload {
  const safe = { ...eventData };
  delete safe.response;
  delete safe.responseText;
  delete safe.responseXML;
  delete safe.responseHeaders;
  delete safe.streamChunk;
  return safe;
}

export function isGMNetworkAction(action: unknown): action is GMNetworkAction {
  return typeof action === 'string' && GM_NETWORK_ACTION_SET.has(action);
}

export async function handleGMNetworkMessage(
  action: GMNetworkAction,
  data: GMNetworkPayload = {},
  sender: RuntimeMessageSender = {},
): Promise<Record<string, any>> {
  // Bind every network operation to the authenticated caller. sender.userScriptId
  // is set by Chrome for onUserScriptMessage and cannot be spoofed; it overrides
  // any data.scriptId a malicious script passes to borrow another script's
  // @connect allowlist / host scope. Falls back to data.scriptId for the
  // content-bridge path (older Chrome) where the bridge supplies the ID. Mirrors
  // the gm-values/cookie/webRequest handlers.
  const ownedScriptId = sender.userScriptId || data.scriptId;
  switch (action) {
    case 'GM_xmlhttpRequest': {
      try {
        if (!data.url) {
          return { error: 'No URL provided', type: 'error' };
        }

        if (!ownedScriptId) {
          return { error: 'Missing script context', type: 'error' };
        }
        const xhrScript = await ScriptStorage.get(ownedScriptId);
        if (!xhrScript) {
          return { error: 'Script context not found', type: 'error' };
        }

        const connectPolicy = evaluateConnectPolicy(xhrScript, data.url);
        if (!connectPolicy.allowed) {
          if (connectPolicy.hostname) {
            console.warn(`[ScriptVault] @connect blocked: ${connectPolicy.hostname} not in allowed list for ${xhrScript.meta.name}`);
          }
          return { error: connectPolicy.error, type: 'error' };
        }

        const settings = await SettingsManager.get();
        const xhrPreCheck = InternalHostGuard.classifyFetchUrl(data.url, ['http:', 'https:']);
        if (!xhrPreCheck.ok && !shouldAllowInternalXhr(xhrScript, data.url, settings, xhrPreCheck)) {
          return { error: internalXhrError('GM_xmlhttpRequest URL rejected', xhrPreCheck), type: 'error' };
        }
        const cookieRouting = await prepareCookieRoutingForFetch(data, 'GM_xmlhttpRequest');
        if (cookieRouting.error) return { error: cookieRouting.error, type: 'error' };

        const tabId: any = sender.tab?.id;
        const request = XhrManager.create(tabId, ownedScriptId, data);
        const { id: requestId } = request;

        const netLogStartTime = Date.now();
        const netLogEntry = {
          scriptId: ownedScriptId,
          scriptName: '',
          method: String(data.method || 'GET').toUpperCase(),
          url: data.url,
          requestSize: data.data ? (typeof data.data === 'string' ? data.data.length : 0) : 0,
        };
        try {
          const script = await ScriptStorage.get(ownedScriptId);
          netLogEntry.scriptName = script?.meta?.name || ownedScriptId;
        } catch (_) {}

        const controller = new AbortController();
        request.controller = controller;

        const sendEvent = (type: string, eventData: GMNetworkPayload = {}) => {
          if (request.aborted && type !== 'abort') return;
          try {
            chrome.tabs.sendMessage(tabId, {
              action: 'xhrEvent',
              data: {
                requestId,
                scriptId: ownedScriptId,
                type,
                ...redactXhrBridgePayload(eventData),
              },
            }).catch(() => {});
          } catch (_) {}
        };

        // Do not force mode:'cors'; extension host permissions provide the fetch authority.
        const method = String(data.method || 'GET').toUpperCase();
        const fetchOptions = XhrManager.buildFetchOptions(data);
        if (cookieRouting.applies) fetchOptions.credentials = 'omit';
        fetchOptions.signal = controller.signal;

        if (data.data && method !== 'GET' && method !== 'HEAD') {
          fetchOptions.body = deserializeRequestBody(data.data);
        }

        const timeoutMs = data.timeout || settings.xhrTimeout || 30000;
        const timeoutId = setTimeout(() => {
          if (!request.aborted) {
            request.aborted = true;
            controller.abort();
            request.finalResult = {
              done: true,
              type: 'timeout',
              response: {
                readyState: 4,
                status: 0,
                statusText: '',
                error: 'Request timed out',
              },
            };
            sendEvent('timeout', {
              readyState: 4,
              status: 0,
              statusText: '',
              error: 'Request timed out',
            });
            sendEvent('loadend', { readyState: 4 });
          }
        }, timeoutMs);

        sendEvent('loadstart', {
          readyState: 1,
          status: 0,
          lengthComputable: false,
          loaded: 0,
          total: 0,
        });

        (async () => {
          try {
            const response = await withCookieHeaderSessionRule(data.url, cookieRouting.cookieHeader, () => fetch(data.url, fetchOptions));

            if (request.aborted) return;
            const xhrPostCheck = InternalHostGuard.classifyResponseUrl(response, ['http:', 'https:']);
            if (!xhrPostCheck.ok && !shouldAllowInternalXhr(xhrScript, response.url || data.url, settings, xhrPostCheck)) {
              throw new Error(internalXhrError('GM_xmlhttpRequest redirected to internal host', xhrPostCheck));
            }

            const responseHeaders = [...response.headers.entries()]
              .map(([key, value]) => `${key}: ${value}`)
              .join('\r\n');

            sendEvent('readystatechange', {
              readyState: 2,
              status: response.status,
              statusText: response.statusText,
              responseHeaders,
              finalUrl: response.url,
            });

            const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
            const maxBytes = GM_DOWNLOAD_FETCH_MAX_BYTES;
            if (Number.isFinite(contentLength) && contentLength > maxBytes) {
              throw new Error(`Response too large (${formatBytes(contentLength)}). Maximum is ${formatBytes(maxBytes)}.`);
            }

            let responseData: any;
            let responseText = '';

            if (data.responseType === 'arraybuffer') {
              const buffer = await response.arrayBuffer();
              if (buffer.byteLength > maxBytes) throw new Error(`Response too large (${formatBytes(buffer.byteLength)}).`);
              const bytes = new Uint8Array(buffer);
              responseData = { __sv_base64__: true, data: encodeBytesToBase64(bytes) };
              sendEvent('progress', {
                readyState: 3,
                lengthComputable: contentLength > 0,
                loaded: buffer.byteLength,
                total: contentLength || buffer.byteLength,
              });
            } else if (data.responseType === 'blob') {
              const blob = await response.blob();
              if (blob.size > maxBytes) throw new Error(`Response too large (${formatBytes(blob.size)}).`);
              responseData = await blobToDataUrl(blob);
              sendEvent('progress', {
                readyState: 3,
                lengthComputable: contentLength > 0,
                loaded: blob.size,
                total: contentLength || blob.size,
              });
            } else if (data.responseType === 'json') {
              responseText = await response.text();
              try {
                responseData = JSON.parse(responseText);
              } catch (_) {
                responseData = responseText;
              }
              sendEvent('progress', {
                readyState: 3,
                lengthComputable: contentLength > 0,
                loaded: responseText.length,
                total: contentLength || responseText.length,
              });
            } else if (data.responseType === 'stream') {
              const reader = response.body?.getReader();
              if (reader) {
                let loaded = 0;
                const chunks: string[] = [];
                const decoder = new TextDecoder();
                try {
                  while (true) {
                    const { done, value } = await reader.read();
                    if (done || request.aborted) break;
                    loaded += value.byteLength;
                    if (loaded > maxBytes) {
                      await reader.cancel();
                      throw new Error(`Streamed response exceeds ${formatBytes(maxBytes)} limit.`);
                    }
                    const chunkText = decoder.decode(value, { stream: true });
                    chunks.push(chunkText);
                    sendEvent('progress', {
                      readyState: 3,
                      lengthComputable: contentLength > 0,
                      loaded,
                      total: contentLength || 0,
                      responseText: chunkText,
                      streamChunk: true,
                    });
                  }
                } finally {
                  reader.releaseLock();
                }
                responseText = chunks.join('');
                responseData = responseText;
              } else {
                responseText = await response.text();
                responseData = responseText;
              }
              sendEvent('progress', {
                readyState: 3,
                lengthComputable: contentLength > 0,
                loaded: responseText.length,
                total: contentLength || responseText.length,
              });
            } else {
              responseText = await response.text();
              responseData = responseText;
              sendEvent('progress', {
                readyState: 3,
                lengthComputable: contentLength > 0,
                loaded: responseText.length,
                total: contentLength || responseText.length,
              });
            }

            if (request.aborted) return;

            const finalResponse = {
              readyState: 4,
              status: response.status,
              statusText: response.statusText,
              responseHeaders,
              response: responseData,
              responseText: responseText || (typeof responseData === 'string' ? responseData : JSON.stringify(responseData)),
              finalUrl: response.url,
              lengthComputable: true,
              loaded: responseText?.length || 0,
              total: responseText?.length || 0,
            };

            NetworkLog.add({
              ...netLogEntry,
              status: finalResponse.status,
              statusText: finalResponse.statusText,
              responseSize: responseText?.length || 0,
              duration: Date.now() - netLogStartTime,
              finalUrl: finalResponse.finalUrl,
            });
            request.finalResult = {
              done: true,
              type: 'load',
              response: finalResponse,
            };
            sendEvent('readystatechange', {
              readyState: 4,
              status: response.status,
              statusText: response.statusText,
              finalUrl: response.url,
            });
          } catch (error) {
            if (request.aborted) return;

            const isAbort = errorName(error) === 'AbortError';
            const errorType = isAbort ? 'abort' : 'error';
            const errorMsg = isAbort ? 'Request aborted' : errorMessage(error, 'Network error');

            NetworkLog.add({
              ...netLogEntry,
              status: 0,
              error: errorMsg,
              duration: Date.now() - netLogStartTime,
            });

            request.finalResult = {
              done: true,
              type: errorType,
              response: {
                readyState: 4,
                status: 0,
                statusText: '',
                error: errorMsg,
              },
              error: errorMsg,
            };
            sendEvent(errorType, {
              readyState: 4,
              status: 0,
              statusText: '',
              error: errorMsg,
            });
            sendEvent('loadend', {
              readyState: 4,
              status: 0,
            });
          } finally {
            clearTimeout(timeoutId);
          }
        })().catch((error) => {
          console.error('[ScriptVault] Unexpected XHR handler error:', error);
          XhrManager.remove(requestId);
        });

        return { requestId, started: true };
      } catch (error) {
        console.error('[ScriptVault] GM_xmlhttpRequest setup error:', error);
        return { error: errorMessage(error, 'Request setup failed'), type: 'error' };
      }
    }

    case 'GM_xmlhttpRequest_abort': {
      const request = XhrManager.get(data.requestId);
      if (request && !request.aborted) {
        request.aborted = true;
        if (request.controller) {
          request.controller.abort();
        }
        XhrManager.remove(data.requestId);
        return { success: true };
      }
      return { success: false };
    }

    case 'GM_xmlhttpRequest_result': {
      const request = XhrManager.get(data.requestId);
      if (!request || request.scriptId !== ownedScriptId) return { done: false };
      if (!request.finalResult) return { done: false };
      const result = request.finalResult;
      XhrManager.remove(data.requestId);
      return result;
    }

    case 'GM_webSocket': {
      try {
        if (typeof WebSocket !== 'function') return { error: 'WebSocket is not available in this browser context' };
        if (!data.url) return { error: 'No URL provided' };
        if (!ownedScriptId) return { error: 'Missing script context' };

        const wsScript = await ScriptStorage.get(ownedScriptId);
        if (!wsScript) return { error: 'Script context not found' };
        if (!scriptHasGrant(wsScript, ['GM_webSocket', 'GM.webSocket'])) return { error: 'Not granted' };

        const wsUrl = normalizeGMWebSocketUrl(data.url);
        const connectPolicy = evaluateConnectPolicy(wsScript, wsUrl);
        if (!connectPolicy.allowed) {
          if (connectPolicy.hostname) {
            console.warn(`[ScriptVault] @connect blocked WebSocket: ${connectPolicy.hostname} not in allowed list for ${wsScript.meta.name}`);
          }
          return { error: connectPolicy.error };
        }

        const settings = await SettingsManager.get();
        const wsPreCheck = InternalHostGuard.classifyFetchUrl(wsUrl, ['ws:', 'wss:']);
        if (!wsPreCheck.ok && !shouldAllowInternalXhr(wsScript, wsUrl, settings, wsPreCheck)) {
          return { error: internalXhrError('GM_webSocket URL rejected', wsPreCheck) };
        }

        const tabId = sender.tab?.id;
        if (typeof tabId !== 'number') return { error: 'Missing tab context' };

        const protocols = normalizeGMWebSocketProtocols(data.protocols);
        const requestId = `ws_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        const startTime = Date.now();
        const sockets = getGMWebSocketMap();
        if (sockets.size >= 500) {
          return { error: 'Too many open WebSocket connections (limit: 500)' };
        }
        let socket: WebSocket;
        try {
          socket = protocols ? new WebSocket(wsUrl, protocols as string | string[]) : new WebSocket(wsUrl);
        } catch (error) {
          return { error: errorMessage(error, 'WebSocket setup failed') };
        }
        if (data.binaryType === 'blob' || data.binaryType === 'arraybuffer') {
          try { socket.binaryType = data.binaryType; } catch (_) {}
        }

        const record = {
          requestId,
          socket,
          tabId,
          scriptId: ownedScriptId,
          scriptName: wsScript.meta?.name || ownedScriptId,
          url: wsUrl,
          bytesSent: 0,
          bytesReceived: 0,
          startTime,
        };
        sockets.set(requestId, record);

        socket.addEventListener('open', () => {
          sendGMWebSocketEvent(record, 'open', {
            protocol: socket.protocol || '',
            extensions: socket.extensions || '',
          });
          NetworkLog.add({
            scriptId: record.scriptId,
            scriptName: record.scriptName,
            type: 'websocket',
            method: 'WS',
            url: wsUrl,
            status: 101,
            statusText: 'Switching Protocols',
            duration: Date.now() - startTime,
          });
        });

        socket.addEventListener('message', (event) => {
          (async () => {
            const size = estimateGMWebSocketPayloadBytes(event.data);
            record.bytesReceived += size;
            if (size > GM_WEBSOCKET_MAX_MESSAGE_BYTES) {
              try { socket.close(1000, 'Message too large'); } catch (_) { try { socket.close(); } catch (_) {} }
              sendGMWebSocketEvent(record, 'error', { error: `WebSocket message exceeds ${formatBytes(GM_WEBSOCKET_MAX_MESSAGE_BYTES)} limit` });
              return;
            }
            const payload = await encodeGMWebSocketPayload(event.data);
            sendGMWebSocketEvent(record, 'message', {
              payload,
              origin: event.origin || '',
            });
          })().catch((error) => {
            sendGMWebSocketEvent(record, 'error', { error: errorMessage(error, 'WebSocket message relay failed') });
          });
        });

        socket.addEventListener('error', () => {
          sendGMWebSocketEvent(record, 'error', { error: 'WebSocket error' });
        });

        socket.addEventListener('close', (event) => {
          sockets.delete(requestId);
          NetworkLog.add({
            scriptId: record.scriptId,
            scriptName: record.scriptName,
            type: 'websocket',
            method: 'WS_CLOSE',
            url: wsUrl,
            status: event.code || 0,
            statusText: event.reason || '',
            requestSize: record.bytesSent,
            responseSize: record.bytesReceived,
            duration: Date.now() - startTime,
          });
          sendGMWebSocketEvent(record, 'close', {
            code: event.code || 1006,
            reason: event.reason || '',
            wasClean: event.wasClean === true,
          });
        });

        return { requestId, started: true };
      } catch (error) {
        console.error('[ScriptVault] GM_webSocket setup error:', error);
        return { error: errorMessage(error, 'WebSocket setup failed') };
      }
    }

    case 'GM_webSocket_takeEvent': {
      const record = getGMWebSocketMap().get(data.requestId);
      if (!record || record.scriptId !== ownedScriptId) return { error: 'WebSocket event not found' };
      const queue = Array.isArray(record._eventQueue) ? record._eventQueue : [];
      const idx = queue.findIndex((entry: any) => entry?.id === data.eventId);
      if (idx < 0) return { error: 'WebSocket event not found' };
      const [entry] = queue.splice(idx, 1);
      return { success: true, event: entry?.data || {} };
    }

    case 'GM_webSocket_send': {
      try {
        const record = getGMWebSocketMap().get(data.requestId);
        if (!record || record.scriptId !== ownedScriptId) return { error: 'WebSocket request not found' };
        if (record.socket.readyState !== WebSocket.OPEN) return { error: 'WebSocket is not open' };
        const size = estimateGMWebSocketPayloadBytes(data.payload);
        if (size > GM_WEBSOCKET_MAX_MESSAGE_BYTES) {
          return { error: `WebSocket payload exceeds ${formatBytes(GM_WEBSOCKET_MAX_MESSAGE_BYTES)} limit` };
        }
        record.socket.send(decodeGMWebSocketPayload(data.payload));
        record.bytesSent += size;
        return { success: true };
      } catch (error) {
        return { error: errorMessage(error, 'WebSocket send failed') };
      }
    }

    case 'GM_webSocket_close': {
      const record = getGMWebSocketMap().get(data.requestId);
      if (!record || record.scriptId !== ownedScriptId) return { success: false };
      const code = normalizeGMWebSocketCloseCode(data.code);
      const reason = normalizeGMWebSocketCloseReason(data.reason);
      try {
        if (code !== undefined) record.socket.close(code, reason);
        else record.socket.close();
      } catch (_) {}
      return { success: true };
    }

    case 'GM_download': {
      try {
        if (!data.url) return { error: 'url is required for download' };
        if (!ownedScriptId) return { error: 'Missing script context' };
        const downloadScript = await ScriptStorage.get(ownedScriptId);
        if (!downloadScript) return { error: 'Script context not found' };
        let downloadProtocol = '';
        try {
          downloadProtocol = new URL(data.url).protocol;
        } catch (_) {
          return { error: 'Invalid URL' };
        }
        let downloadUrl = data.url;
        let cookieRouting = { applies: false, cookieHeader: '' };
        if (downloadProtocol === 'http:' || downloadProtocol === 'https:') {
          const downloadPolicy = evaluateConnectPolicy(downloadScript, data.url);
          if (!downloadPolicy.allowed) return { error: downloadPolicy.error };
          const downloadSettings = await SettingsManager.get();
          const downloadPreCheck = InternalHostGuard.classifyFetchUrl(data.url, ['http:', 'https:']);
          if (!downloadPreCheck.ok && !shouldAllowInternalXhr(downloadScript, data.url, downloadSettings, downloadPreCheck)) {
            return { error: internalXhrError('GM_download URL rejected', downloadPreCheck) };
          }
          cookieRouting = await prepareCookieRoutingForFetch(data, 'GM_download') as { applies: boolean; cookieHeader: string };
          if ((cookieRouting as any).error) return { error: (cookieRouting as any).error };
          if (downloadNeedsFetchBridge(data) || cookieRouting.applies) {
            const fetchOptions = XhrManager.buildFetchOptions({
              ...data,
              method: 'GET',
              noCache: data.noCache === true || data.nocache === true,
            });
            if (cookieRouting.applies) fetchOptions.credentials = 'omit';
            const response = await withCookieHeaderSessionRule(data.url, cookieRouting.cookieHeader, () => fetch(data.url, fetchOptions));
            const downloadPostCheck = InternalHostGuard.classifyResponseUrl(response, ['http:', 'https:']);
            if (!downloadPostCheck.ok && !shouldAllowInternalXhr(downloadScript, response.url || data.url, downloadSettings, downloadPostCheck)) {
              return { error: internalXhrError('GM_download redirected to internal host', downloadPostCheck) };
            }
            if (!response.ok) return { error: `HTTP ${response.status}` };
            downloadUrl = await responseToDownloadDataUrl(response);
          }
        }
        let hasDownloadPermission = false;
        try {
          hasDownloadPermission = !!chrome.downloads?.download && await chrome.permissions.contains({ permissions: ['downloads'] });
        } catch (_) {}
        if (!hasDownloadPermission) {
          return {
            error: 'Downloads permission not granted. Enable it in ScriptVault settings or reinstall the script that uses GM_download.',
            code: 'PERMISSION_REQUIRED',
          };
        }
        const downloadOpts = {
          url: downloadUrl,
          filename: normalizeDownloadFilename(data.name, data.url, data.sourceName),
          saveAs: data.saveAs || false,
          conflictAction: data.conflictAction || 'uniquify',
        };
        const downloadId = await chrome.downloads.download(downloadOpts);
        const tabId = sender.tab?.id;
        if (tabId && data.hasCallbacks) {
          const tracker = trackPendingDownload(downloadId, {
            tabId,
            scriptId: ownedScriptId,
            url: data.url,
            timeoutMs: data.timeout,
          });
          if (tracker) {
            await reconcilePendingDownload(downloadId, tracker, Date.now());
          }
        }
        return { success: true, downloadId };
      } catch (error) {
        return { error: errorMessage(error) };
      }
    }

    default:
      return { error: `Unsupported GM network action: ${action}` };
  }
}

export const GMNetworkHandler = Object.freeze({
  GM_NETWORK_ACTIONS,
  handleGMNetworkMessage,
  isGMNetworkAction,
});

export default GMNetworkHandler;
