// ScriptVault v2.3.0 - Content Script Bridge
// Bridges messages between userscripts (USER_SCRIPT world) and background service worker

(function() {
  'use strict';
  
  // Prevent double initialization (use extension ID to avoid page-level spoofing)
  const bridgeKey = '__ScriptVault_Bridge_' + chrome.runtime.id + '__';
  if (window[bridgeKey]) {
    return;
  }
  Object.defineProperty(window, bridgeKey, { value: true, writable: false, configurable: false });
  
  // Unique channel ID to prevent conflicts with other extensions
  const CHANNEL_ID = 'ScriptVault_' + chrome.runtime.id;

  // Security allowlist — the bridge receives window.postMessage events that
  // any page script can forge (channel ID is derived from the public extension
  // ID). Keep this bridge telemetry-only; privileged GM APIs must use
  // chrome.runtime messaging from the USER_SCRIPT world.
  const ALLOWED_BRIDGE_ACTIONS = new Set([
    'netlog_record',
    'reportExecError',
    'reportExecTime'
  ]);

  function isPublicApiPageMessage(msg) {
    if (!msg || typeof msg !== 'object') return false;
    if (typeof msg.type !== 'string') return false;
    if (!msg.type.startsWith('scriptvault:')) return false;
    // Responses posted back into the page are visible to this listener too.
    // Do not bounce them back to the service worker.
    if (msg.type.endsWith(':response')) return false;
    return true;
  }

  function isAllowedBridgeAction(action) {
    if (typeof action !== 'string') return false;
    return ALLOWED_BRIDGE_ACTIONS.has(action);
  }

  const BRIDGE_RATE_WINDOW_MS = 10000;
  const BRIDGE_RATE_LIMIT = 60;
  let bridgeRateWindowStartedAt = Date.now();
  let bridgeRateCount = 0;

  function consumeBridgeRateLimit() {
    const now = Date.now();
    if (now - bridgeRateWindowStartedAt >= BRIDGE_RATE_WINDOW_MS) {
      bridgeRateWindowStartedAt = now;
      bridgeRateCount = 0;
    }
    if (bridgeRateCount >= BRIDGE_RATE_LIMIT) return false;
    bridgeRateCount += 1;
    return true;
  }

  function boundedNumber(value, minimum, maximum, integer = false) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < minimum || number > maximum) return undefined;
    if (integer && !Number.isInteger(number)) return undefined;
    return number;
  }

  function normalizeBridgeTelemetry(action, value) {
    const data = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    if (action === 'reportExecError') {
      const error = typeof data.error === 'string' ? data.error.slice(0, 500) : '';
      return error ? { kind: 'execution-error', error } : null;
    }
    if (action === 'reportExecTime') {
      const duration = boundedNumber(data.time, 0, 86400000);
      return duration === undefined ? null : { kind: 'execution-time', duration };
    }
    if (action !== 'netlog_record') return null;
    const url = typeof data.url === 'string' ? data.url.slice(0, 4096) : '';
    if (!url) return null;
    const telemetry = {
      kind: 'network',
      url,
      method: typeof data.method === 'string' ? data.method.slice(0, 16).toUpperCase() : 'GET',
      type: typeof data.type === 'string' ? data.type.slice(0, 32) : 'fetch'
    };
    const status = boundedNumber(data.status, 0, 999, true);
    const duration = boundedNumber(data.duration, 0, 86400000);
    const responseSize = boundedNumber(data.responseSize, 0, 1073741824, true);
    if (status !== undefined) telemetry.status = status;
    if (duration !== undefined) telemetry.duration = duration;
    if (responseSize !== undefined) telemetry.responseSize = responseSize;
    if (typeof data.statusText === 'string') telemetry.statusText = data.statusText.slice(0, 256);
    if (typeof data.error === 'string') telemetry.error = data.error.slice(0, 500);
    return telemetry;
  }

  function redactBridgeEventData(data) {
    if (!data || typeof data !== 'object') return data;
    const safe = { ...data };
    delete safe.response;
    delete safe.responseText;
    delete safe.responseXML;
    delete safe.responseHeaders;
    delete safe.payload;
    delete safe.streamChunk;
    return safe;
  }

  const CHAIN_DOM_EVENT_LIMIT = 20;
  const chainDomEventListeners = new Map();

  function normalizeChainDomEventTypes(eventTypes) {
    const seen = new Set();
    const normalized = [];
    for (const eventType of Array.isArray(eventTypes) ? eventTypes : []) {
      const value = String(eventType || '').trim();
      if (!/^[A-Za-z][\w:.-]{0,63}$/.test(value) || seen.has(value)) continue;
      seen.add(value);
      normalized.push(value);
      if (normalized.length >= CHAIN_DOM_EVENT_LIMIT) break;
    }
    return normalized;
  }

  function notifyChainDomEvent(event) {
    chrome.runtime.sendMessage({
      action: 'chainDomEvent',
      eventType: event.type,
      url: location.href
    }).catch(() => {});
  }

  function installChainDomEventListeners(eventTypes) {
    for (const [eventType, listener] of chainDomEventListeners) {
      document.removeEventListener(eventType, listener, true);
    }
    chainDomEventListeners.clear();

    for (const eventType of normalizeChainDomEventTypes(eventTypes)) {
      const listener = (event) => notifyChainDomEvent(event);
      chainDomEventListeners.set(eventType, listener);
      document.addEventListener(eventType, listener, { capture: true, passive: true });
    }
  }

  async function refreshChainDomEventTriggers() {
    try {
      const result = await chrome.runtime.sendMessage({ action: 'getChainDomEventTriggers' });
      installChainDomEventListeners(result?.eventTypes || []);
    } catch (_) {
      installChainDomEventListeners([]);
    }
  }

  // Listen for messages from userscript world (USER_SCRIPT or page context)
  window.addEventListener('message', async (event) => {
    // Security: Only accept messages from same window
    if (event.source !== window) return;

    const msg = event.data;

    // Check for our message type
    if (!msg || typeof msg !== 'object') return;
    if (isPublicApiPageMessage(msg)) {
      try {
        const result = await chrome.runtime.sendMessage({
          action: 'publicApi_handleWebMessage',
          origin: event.origin,
          message: msg
        });
        if (result?.response) {
          window.postMessage(result.response, event.origin);
        }
      } catch (_) {
        // Public API relay failures are intentionally silent to avoid noisy pages.
      }
      return;
    }
    if (msg.channel !== CHANNEL_ID) return;
    if (msg.direction !== 'to-background') return;

    const msgId = msg.id;
    const action = msg.action;

    // Security: reject any action that isn't a known userscript-safe telemetry action.
    // Do not forward GM_* calls here: page scripts can post to this window too.
    if (!isAllowedBridgeAction(action)) {
      window.postMessage({
        channel: CHANNEL_ID,
        direction: 'to-userscript',
        id: msgId,
        error: 'Action not permitted via page-visible bridge',
        success: false
      }, '*');
      return;
    }

    try {
      const safeData = normalizeBridgeTelemetry(action, msg.data);
      if (!safeData) throw new Error('Invalid page telemetry payload');
      if (!consumeBridgeRateLimit()) throw new Error('Page telemetry rate limit exceeded');
      const result = await chrome.runtime.sendMessage({
        action: 'recordBridgeTelemetry',
        data: safeData
      });
      
      // Send response back to userscript world
      window.postMessage({
        channel: CHANNEL_ID,
        direction: 'to-userscript',
        id: msgId,
        result: result,
        success: true
      }, '*');
    } catch (e) {
      // Silently handle errors - no console output to avoid chrome://extensions error spam
      const errorMsg = e.message || 'Unknown error';
      window.postMessage({
        channel: CHANNEL_ID,
        direction: 'to-userscript',
        id: msgId,
        error: errorMsg,
        success: false
      }, '*');
    }
  });
  
  // Listen for messages from background script (menu commands, value changes, XHR events)
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Track if we handled the message
    let handled = false;
    
    // Menu command execution
    if (message.action === 'executeMenuCommand') {
      window.postMessage({
        channel: CHANNEL_ID,
        direction: 'to-userscript',
        type: 'menuCommand',
        scriptId: message.data?.scriptId,
        commandId: message.data?.commandId
      }, '*');
      handled = true;
    }
    
    // Value change notifications
    if (message.action === 'valueChanged') {
      window.postMessage({
        channel: CHANNEL_ID,
        direction: 'to-userscript',
        type: 'valueChanged',
        scriptId: message.data?.scriptId,
        key: message.data?.key,
        remote: message.data?.remote
      }, '*');
      handled = true;
    }
    
    // XHR event forwarding
    if (message.action === 'xhrEvent') {
      window.postMessage({
        channel: CHANNEL_ID,
        direction: 'to-userscript',
        type: 'xhrEvent',
        requestId: message.data?.requestId,
        scriptId: message.data?.scriptId,
        eventType: message.data?.type,
        data: redactBridgeEventData(message.data)
      }, '*');
      handled = true;
    }

    // GM_webSocket event forwarding (open, message, error, close)
    if (message.action === 'webSocketEvent') {
      window.postMessage({
        channel: CHANNEL_ID,
        direction: 'to-userscript',
        type: 'webSocketEvent',
        requestId: message.data?.requestId,
        scriptId: message.data?.scriptId,
        eventType: message.data?.type,
        data: redactBridgeEventData(message.data)
      }, '*');
      handled = true;
    }

    // Notification event forwarding (click, done, buttonClick).
    // Phase 11.11: buttonIndex is forwarded so the wrapper can fire
    // onbuttonclick({ buttonClickIndex }) per ScriptCat semantics.
    if (message.action === 'notificationEvent') {
      window.postMessage({
        channel: CHANNEL_ID,
        direction: 'to-userscript',
        type: 'notificationEvent',
        scriptId: message.data?.scriptId,
        notifTag: message.data?.notifId,
        eventType: message.data?.type,
        buttonIndex: message.data?.buttonIndex
      }, '*');
      handled = true;
    }

    // Download event forwarding (load, error, progress, timeout)
    if (message.action === 'downloadEvent') {
      window.postMessage({
        channel: CHANNEL_ID,
        direction: 'to-userscript',
        type: 'downloadEvent',
        scriptId: message.data?.scriptId,
        downloadId: message.data?.downloadId,
        eventType: message.data?.type,
        data: message.data
      }, '*');
      handled = true;
    }

    // Audio state change event
    if (message.action === 'audioStateChanged') {
      window.postMessage({
        channel: CHANNEL_ID,
        direction: 'to-userscript',
        type: 'audioStateChanged',
        data: message.data
      }, '*');
      handled = true;
    }

    // Opened tab closed event
    if (message.action === 'openedTabClosed') {
      window.postMessage({
        channel: CHANNEL_ID,
        direction: 'to-userscript',
        type: 'openedTabClosed',
        scriptId: message.data?.scriptId,
        closedTabId: message.data?.tabId
      }, '*');
      handled = true;
    }

    if (message.action === 'chainDomTriggersChanged') {
      refreshChainDomEventTriggers();
      handled = true;
    }
    
    // Always send response if we handled the message
    // This prevents "message channel closed" errors
    if (handled) {
      sendResponse({ success: true });
    }
    
    // Return false for synchronous response (we never do async here)
    return false;
  });
  
  // Signal readiness without exposing additional bridge material to page code.
  try {
    Promise.resolve(chrome.runtime.sendMessage({
      action: 'reportDocumentReady',
      url: location.href
    })).catch(() => {});
  } catch (_) { /* extension context may have restarted */ }
  refreshChainDomEventTriggers();
  Object.defineProperty(window, '__ScriptVault_BridgeReady__', { value: true, writable: false, configurable: false });
  
  window.postMessage({
    channel: CHANNEL_ID,
    direction: 'to-userscript',
    type: 'bridgeReady'
  }, '*');
})();
