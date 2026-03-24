// ScriptVault v1.7.5 - Content Script Bridge
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
    
    try {
      // Forward to background script and wait for response
      const result = await chrome.runtime.sendMessage({
        action: action,
        data: msg.data
      });
      
      // Send response back to userscript world
      window.postMessage({
        channel: CHANNEL_ID,
        direction: 'to-userscript',
        id: msgId,
        result: result,
        success: true
      }, window.location.origin);
    } catch (e) {
      // Silently handle errors - no console output to avoid chrome://extensions error spam
      const errorMsg = e.message || 'Unknown error';
      window.postMessage({
        channel: CHANNEL_ID,
        direction: 'to-userscript',
        id: msgId,
        error: errorMsg,
        success: false
      }, window.location.origin);
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
      }, window.location.origin);
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
        oldValue: message.data?.oldValue,
        newValue: message.data?.newValue,
        remote: message.data?.remote
      }, window.location.origin);
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
        data: message.data
      }, window.location.origin);
      handled = true;
    }

    // Notification event forwarding (click, done)
    if (message.action === 'notificationEvent') {
      window.postMessage({
        channel: CHANNEL_ID,
        direction: 'to-userscript',
        type: 'notificationEvent',
        scriptId: message.data?.scriptId,
        notifTag: message.data?.notifId,
        eventType: message.data?.type
      }, window.location.origin);
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
      }, window.location.origin);
      handled = true;
    }

    // Audio state change event
    if (message.action === 'audioStateChanged') {
      window.postMessage({
        channel: CHANNEL_ID,
        direction: 'to-userscript',
        type: 'audioStateChanged',
        data: message.data
      }, window.location.origin);
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
      }, window.location.origin);
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
  
  // Expose channel ID for userscripts and signal ready
  window.__ScriptVault_ChannelID__ = CHANNEL_ID;
  window.__ScriptVault_BridgeReady__ = true;
  
  window.postMessage({
    channel: CHANNEL_ID,
    direction: 'to-userscript',
    type: 'bridgeReady'
  }, '/');
})();
