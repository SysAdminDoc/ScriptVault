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
  function isAllowedBridgeAction(action) {
    if (typeof action !== 'string') return false;
    return ALLOWED_BRIDGE_ACTIONS.has(action);
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
      // Sanitize telemetry data: only forward expected scalar/object fields,
      // truncate strings to prevent oversized payloads from page scripts.
      let safeData = msg.data;
      if (safeData && typeof safeData === 'object') {
        const raw = safeData;
        safeData = {};
        for (const k of Object.keys(raw)) {
          const v = raw[k];
          if (typeof v === 'string') safeData[k] = v.slice(0, 2048);
          else if (typeof v === 'number' || typeof v === 'boolean') safeData[k] = v;
        }
      }
      const result = await chrome.runtime.sendMessage({
        action: action,
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
  refreshChainDomEventTriggers();
  Object.defineProperty(window, '__ScriptVault_BridgeReady__', { value: true, writable: false, configurable: false });
  
  window.postMessage({
    channel: CHANNEL_ID,
    direction: 'to-userscript',
    type: 'bridgeReady'
  }, '*');
})();
