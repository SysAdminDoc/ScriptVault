/**
 * Wrapper script builder — generates the complete wrapped userscript code
 * that runs in the USER_SCRIPT world with GM API shims, console capture,
 * error suppression, network proxy, and all Tampermonkey/Violentmonkey
 * compatible APIs.
 *
 * Extracted from background.core.js `buildWrappedScript()`.
 */

import type { Script } from '../types/script';

/** A fetched @require script with its source URL and code text. */
export interface RequireScript {
  url: string;
  code: string;
}

/**
 * Build the full wrapped userscript code string that will be injected into
 * the USER_SCRIPT world.
 *
 * @param script           The script object (id, code, meta, …).
 * @param requireScripts   Pre-fetched @require script sources.
 * @param preloadedStorage Pre-loaded GM storage key/value pairs.
 * @param regexIncludes    Regex @include patterns (e.g. `/pattern/flags`).
 * @param regexExcludes    Regex @exclude patterns.
 * @returns The generated JavaScript source as a string.
 */
export function buildWrappedScript(
  script: Script,
  requireScripts: RequireScript[] = [],
  preloadedStorage: Record<string, unknown> = {},
  regexIncludes: string[] = [],
  regexExcludes: string[] = [],
): string {
  const meta = script.meta;
  const grants: string[] = meta.grant.length > 0 ? meta.grant : ['none'];

  // Build @require scripts section
  // Code runs INSIDE the main IIFE after GM APIs are available
  // No try/catch wrapper because let/const are block-scoped and wouldn't escape
  let requireCode = '';
  for (const req of requireScripts) {
    const safeUrl = req.url.replace(/\*\//g, '* /');
    requireCode += `
// @require ${safeUrl}
${req.code}
`;
  }

  // After @require code, expose common libraries to window for cross-script access
  const libraryExports: string = requireCode ? `
  // Expose common @require libraries to window
  if (typeof GM_config !== 'undefined' && typeof window.GM_config === 'undefined') window.GM_config = GM_config;
  if (typeof GM_configStruct !== 'undefined' && typeof window.GM_configStruct === 'undefined') window.GM_configStruct = GM_configStruct;
  if (typeof $ !== 'undefined' && typeof window.$ === 'undefined') window.$ = $;
  if (typeof jQuery !== 'undefined' && typeof window.jQuery === 'undefined') window.jQuery = jQuery;
  if (typeof Fuse !== 'undefined' && typeof window.Fuse === 'undefined') window.Fuse = Fuse;
  if (typeof JSZip !== 'undefined' && typeof window.JSZip === 'undefined') window.JSZip = JSZip;
` : '';

  // Build the GM API initialization with pre-loaded storage
  // Get the extension ID at build time so it's available in the wrapper
  const extId: string = chrome.runtime.id;

  // Build the regex URL guard block
  const regexGuardBlock: string = (() => {
    const validIncludes: string[] = regexIncludes
      .map((p) => {
        const m = p.match(/^\/(.+)\/([gimsuy]*)$/);
        return m ? `new RegExp(${JSON.stringify(m[1])}, ${JSON.stringify(m[2])})` : null;
      })
      .filter((v): v is string => v !== null);
    const validExcludes: string[] = regexExcludes
      .map((p) => {
        const m = p.match(/^\/(.+)\/([gimsuy]*)$/);
        return m ? `new RegExp(${JSON.stringify(m[1])}, ${JSON.stringify(m[2])})` : null;
      })
      .filter((v): v is string => v !== null);
    if (validIncludes.length === 0 && validExcludes.length === 0) return '';
    return `
  // ============ Regex @include/@exclude URL Guard ============
  {
    const __url = location.href;
    ${validIncludes.length > 0 ? `const __regexIncludes = [${validIncludes.join(', ')}];
    const __includeMatch = __regexIncludes.some(re => re.test(__url));
    if (!__includeMatch) return;` : ''}
    ${validExcludes.length > 0 ? `const __regexExcludes = [${validExcludes.join(', ')}];
    const __excludeMatch = __regexExcludes.some(re => re.test(__url));
    if (__excludeMatch) return;` : ''}
  }
  // ============ End URL Guard ============
`;
  })();

  // Build the @run-in guard block
  const runInGuard: string =
    meta['run-in'] === 'incognito-tabs'
      ? `
  // ============ @run-in incognito-tabs Guard ============
  if (!chrome?.extension?.inIncognitoContext) return;
  // ============ End @run-in Guard ============
`
      : meta['run-in'] === 'normal-tabs'
        ? `
  // ============ @run-in normal-tabs Guard ============
  if (chrome?.extension?.inIncognitoContext) return;
  // ============ End @run-in Guard ============
`
        : '';

  const metaBlock: string =
    script.code.match(/\/\/\s*==UserScript==([\s\S]*?)\/\/\s*==\/UserScript==/)?.[0] ?? '';

  const manifestVersion: string = chrome.runtime.getManifest().version;

  const apiInit: string = `
(function() {
  'use strict';

  // ============ Console Capture (v2.0) ============
  // Intercept console.log/warn/error for per-script debugging
  {
    const _origConsole = { log: console.log, warn: console.warn, error: console.error, info: console.info, debug: console.debug };
    const _scriptId = ${JSON.stringify(script.id)};
    const _captureLimit = 200;
    let _captureBuffer = [];
    function _captureConsole(level, args) {
      try {
        _captureBuffer.push({ level, args: Array.from(args).map(a => { try { return typeof a === 'object' ? JSON.stringify(a).slice(0, 500) : String(a); } catch { return String(a); } }), timestamp: Date.now() });
        if (_captureBuffer.length > _captureLimit) _captureBuffer.shift();
        // Batch-send every 2 seconds
        if (!_captureConsole._timer) {
          _captureConsole._timer = setTimeout(() => {
            try { chrome.runtime.sendMessage({ action: 'scriptConsoleCapture', scriptId: _scriptId, entries: _captureBuffer.splice(0) }); } catch {}
            _captureConsole._timer = null;
          }, 2000);
        }
      } catch {}
    }
    console.log = function() { _captureConsole('log', arguments); return _origConsole.log.apply(console, arguments); };
    console.warn = function() { _captureConsole('warn', arguments); return _origConsole.warn.apply(console, arguments); };
    console.error = function() { _captureConsole('error', arguments); return _origConsole.error.apply(console, arguments); };
    console.info = function() { _captureConsole('info', arguments); return _origConsole.info.apply(console, arguments); };
    console.debug = function() { _captureConsole('debug', arguments); return _origConsole.debug.apply(console, arguments); };
  }
  // ============ End Console Capture ============

  // ============ Error Suppression ============
  // Suppress uncaught errors and unhandled rejections from userscripts
  // to prevent them from appearing on chrome://extensions error page.
  // Chrome captures any error/warn/log from USER_SCRIPT world, so we
  // must silently swallow these without any console output.
  window.addEventListener('error', function(event) {
    event.stopImmediatePropagation();
    event.preventDefault();
    // Report to error log
    try { chrome.runtime.sendMessage({ action: 'logError', entry: { scriptId: ${JSON.stringify(script.id)}, scriptName: ${JSON.stringify(meta.name)}, error: event.message || 'Unknown error', url: location.href, line: event.lineno, col: event.colno, timestamp: Date.now() } }); } catch {}
    return true;
  }, true);
  window.addEventListener('unhandledrejection', function(event) {
    event.stopImmediatePropagation();
    event.preventDefault();
    try { chrome.runtime.sendMessage({ action: 'logError', entry: { scriptId: ${JSON.stringify(script.id)}, scriptName: ${JSON.stringify(meta.name)}, error: event.reason?.message || String(event.reason) || 'Unhandled rejection', url: location.href, timestamp: Date.now() } }); } catch {}
  }, true);
  // ============ End Error Suppression ============

  ${runInGuard}
  ${regexGuardBlock}
  const scriptId = ${JSON.stringify(script.id)};
  const meta = ${JSON.stringify(meta)};
  const grants = ${JSON.stringify(grants)};
  const grantSet = new Set(grants);

  // Channel ID for communication with content script bridge
  // Extension ID is injected at build time since chrome.runtime isn't available in USER_SCRIPT world
  const CHANNEL_ID = ${JSON.stringify('ScriptVault_' + extId)};

  // console.log('[ScriptVault] Script initializing:', meta.name, 'Channel:', CHANNEL_ID);

  // Grant checking - @grant none means NO APIs except GM_info
  const hasNone = grantSet.has('none');
  const hasGrant = (n) => {
    if (hasNone) return false;
    if (grants.length === 0) return true;
    return grantSet.has(n) || grantSet.has('*');
  };

  // GM_info - always available
  const GM_info = {
    script: {
      name: meta.name || 'Unknown',
      namespace: meta.namespace || '',
      description: meta.description || '',
      version: meta.version || '1.0',
      author: meta.author || '',
      homepage: meta.homepage || meta.homepageURL || '',
      icon: meta.icon || '',
      icon64: meta.icon64 || '',
      matches: meta.match || [],
      includes: meta.include || [],
      excludes: meta.exclude || [],
      excludeMatches: meta.excludeMatch || [],
      grants: grants,
      resources: meta.resource || {},
      requires: meta.require || [],
      runAt: meta['run-at'] || 'document-idle',
      connect: meta.connect || [],
      noframes: meta.noframes || false,
      unwrap: meta.unwrap || false,
      antifeatures: meta.antifeature || [],
      tags: meta.tag || [],
      license: meta.license || '',
      updateURL: meta.updateURL || '',
      downloadURL: meta.downloadURL || '',
      supportURL: meta.supportURL || ''
    },
    scriptMetaStr: ${JSON.stringify(metaBlock)},
    scriptHandler: 'ScriptVault',
    scriptSource: 'ScriptVault',
    version: ${JSON.stringify(manifestVersion)},
    scriptWillUpdate: !!(meta.updateURL || meta.downloadURL),
    isIncognito: typeof chrome !== 'undefined' && chrome.extension ? chrome.extension.inIncognitoContext : false,
    injectInto: ${JSON.stringify(meta['inject-into'] || 'auto')},
    downloadMode: 'browser',
    platform: {
      os: navigator.userAgentData?.platform || navigator.platform || 'unknown',
      arch: navigator.userAgentData?.architecture || 'unknown',
      browserName: 'Chrome',
      browserVersion: navigator.userAgent?.match(/Chrome\\/([\\d.]+)/)?.[1] || 'unknown'
    },
    uuid: ${JSON.stringify(script.id)}
  };

  // Storage cache - mutable so we can refresh it with fresh values from background
  // Pre-loaded values serve as fallback if background fetch fails
  let _cache = ${JSON.stringify(preloadedStorage)};
  let _cacheReady = false; // Track if we've fetched fresh values
  let _cacheReadyPromise = null;
  let _cacheReadyResolve = null;

  // XHR request tracking (like Violentmonkey's idMap)
  const _xhrRequests = new Map(); // requestId -> { details, aborted }
  let _xhrSeqId = 0;

  // Value change listeners (like Tampermonkey)
  const _valueChangeListeners = new Map(); // listenerId -> { key, callback }
  let _valueChangeListenerId = 0;

  // Listen for messages from content script (for menu commands, value changes, and XHR events)
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const msg = event.data;
    if (!msg || msg.channel !== CHANNEL_ID || msg.direction !== 'to-userscript') return;

    // Handle menu command execution
    if (msg.type === 'menuCommand' && msg.scriptId === scriptId) {
      const cmd = _menuCmds.get(msg.commandId);
      if (cmd?.callback) try { cmd.callback(); } catch(err) { /* silently ignore menu command errors */ }
    }

    // Handle value change notifications (cross-tab sync)
    if (msg.type === 'valueChanged' && msg.scriptId === scriptId) {
      const oldValue = _cache[msg.key];
      if (msg.newValue === undefined) {
        delete _cache[msg.key];
      } else {
        _cache[msg.key] = msg.newValue;
      }
      // Notify value change listeners
      _valueChangeListeners.forEach((listener) => {
        if (listener.key === msg.key || listener.key === null) {
          try {
            listener.callback(msg.key, oldValue, msg.newValue, msg.remote !== false);
          } catch (e) {
            /* silently ignore value change listener errors */
          }
        }
      });
    }

    // Handle XHR events
    if (msg.type === 'xhrEvent' && msg.scriptId === scriptId) {
      const request = _xhrRequests.get(msg.requestId);
      if (!request || request.aborted) return;

      const { details } = request;
      const eventType = msg.eventType;
      const eventData = msg.data || {};

      // Decode binary responses transferred as base64/dataURL
      let responseValue = eventData.response;
      if (responseValue && typeof responseValue === 'object' && responseValue.__sv_base64__) {
        // arraybuffer: base64 -> ArrayBuffer
        const binary = atob(responseValue.data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        responseValue = bytes.buffer;
      } else if (details.responseType === 'blob' && typeof responseValue === 'string' && responseValue.startsWith('data:')) {
        // blob: data URL -> Blob
        try {
          const [header, b64] = responseValue.split(',');
          const mime = header.match(/:(.*?);/)?.[1] || 'application/octet-stream';
          const binary = atob(b64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          responseValue = new Blob([bytes], { type: mime });
        } catch (e) {
          // Fall through with data URL string if conversion fails
        }
      }

      // Build response object matching GM_xmlhttpRequest spec
      const response = {
        readyState: eventData.readyState || 0,
        status: eventData.status || 0,
        statusText: eventData.statusText || '',
        responseHeaders: eventData.responseHeaders || '',
        response: responseValue,
        responseText: eventData.responseText || '',
        responseXML: eventData.responseXML,
        finalUrl: eventData.finalUrl || details.url,
        context: details.context,
        lengthComputable: eventData.lengthComputable,
        loaded: eventData.loaded,
        total: eventData.total
      };

      // Call appropriate callback
      const callbackName = 'on' + eventType;
      if (eventType.startsWith('upload.')) {
        const uploadEvent = eventType.replace('upload.', '');
        if (details.upload && details.upload['on' + uploadEvent]) {
          try {
            details.upload['on' + uploadEvent](response);
          } catch (e) {
            /* silently ignore XHR upload callback errors */
          }
        }
      } else if (details[callbackName]) {
        try {
          details[callbackName](response);
        } catch (e) {
          /* silently ignore XHR callback errors */
        }
      }

      // Clean up on loadend
      if (eventType === 'loadend') {
        _xhrRequests.delete(msg.requestId);
      }
    }
  });

  // Bridge ready state tracking
  let _bridgeReady = false;
  let _bridgeReadyPromise = null;
  let _bridgeReadyResolve = null;

  // Wait for bridge to be ready
  function waitForBridge() {
    // Check if already ready (content script sets this global)
    if (window.__ScriptVault_BridgeReady__ || _bridgeReady) {
      _bridgeReady = true;
      return Promise.resolve();
    }

    // Return existing promise if already waiting
    if (_bridgeReadyPromise) return _bridgeReadyPromise;

    // Create promise to wait for bridge ready message
    _bridgeReadyPromise = new Promise((resolve) => {
      _bridgeReadyResolve = resolve;

      // Listen for bridgeReady message from content script
      function bridgeReadyHandler(event) {
        if (event.source !== window) return;
        const msg = event.data;
        if (!msg || msg.channel !== CHANNEL_ID || msg.direction !== 'to-userscript') return;
        if (msg.type === 'bridgeReady') {
          window.removeEventListener('message', bridgeReadyHandler);
          _bridgeReady = true;
          resolve();
        }
      }
      window.addEventListener('message', bridgeReadyHandler);

      // Also check global flag periodically (fallback)
      const checkInterval = setInterval(() => {
        if (window.__ScriptVault_BridgeReady__) {
          clearInterval(checkInterval);
          window.removeEventListener('message', bridgeReadyHandler);
          _bridgeReady = true;
          resolve();
        }
      }, 10);

      // Timeout after 1 second - bridge should be ready much faster
      setTimeout(() => {
        clearInterval(checkInterval);
        window.removeEventListener('message', bridgeReadyHandler);
        if (!_bridgeReady) {
          // This is normal in some contexts, proceed without warning spam
          _bridgeReady = true;
          resolve();
        }
      }, 1000);
    });

    return _bridgeReadyPromise;
  }

  // Send message to background script
  // Prefers chrome.runtime.sendMessage (direct, no bridge needed) when available via messaging: true
  // Falls back to postMessage bridge for older Chrome versions
  async function sendToBackground(action, data) {
    // Try direct messaging first (available when userScripts world has messaging: true)
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        return await chrome.runtime.sendMessage({ action, data });
      } catch (e) {
        // Extension context invalidated or messaging not available, fall through to bridge
      }
    }

    // Fallback: use content script bridge via postMessage
    await waitForBridge();

    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).substring(2) + Date.now().toString(36);

      // Set timeout for response
      const timeout = setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve(undefined);
      }, 10000);

      // Listen for response
      function handler(event) {
        if (event.source !== window) return;
        const msg = event.data;
        if (!msg || msg.channel !== CHANNEL_ID || msg.direction !== 'to-userscript') return;
        if (msg.id !== id) return;

        window.removeEventListener('message', handler);
        clearTimeout(timeout);

        if (msg.success) {
          resolve(msg.result);
        } else {
          resolve(undefined);
        }
      }

      window.addEventListener('message', handler);

      // Send to content script bridge.
      // targetOrigin must be '*' because opaque origins (data:, blob:, about:blank)
      // cannot match any specific origin and rejecting them would break scripts
      // that run in sandboxed frames. Channel-ID authentication protects the
      // channel (see bridge init in content.js).
      window.postMessage({
        channel: CHANNEL_ID,
        direction: 'to-background',
        id: id,
        action: action,
        data: data
      }, '*');
    });
  }

  // Refresh storage cache from background
  // This ensures we have the latest values, not stale values from registration time
  async function _refreshStorageCache() {
    if (_cacheReady) return;

    try {
      const freshValues = await sendToBackground('GM_getValues', { scriptId });
      if (freshValues && typeof freshValues === 'object') {
        // Merge fresh values with any local changes made before refresh completed
        _cache = { ..._cache, ...freshValues };
      }
      _cacheReady = true;
      if (_cacheReadyResolve) _cacheReadyResolve();
    } catch (e) {
      // If refresh fails, continue with pre-loaded values
      _cacheReady = true;
      if (_cacheReadyResolve) _cacheReadyResolve();
    }
  }

  // Start refreshing cache immediately (don't await - let script start running)
  // Scripts can use GM_getValue immediately with pre-loaded values
  // Fresh values will be available after the async refresh completes
  _refreshStorageCache();

  // Synchronous GM_getValue - returns from cache (pre-loaded or refreshed)
  function GM_getValue(key, defaultValue) {
    if (!hasGrant('GM_getValue') && !hasGrant('GM.getValue')) return defaultValue;
    if (key in _cache) return _cache[key];
    return defaultValue;
  }

  // GM_setValue - updates cache IMMEDIATELY, persists async (like Tampermonkey/Violentmonkey)
  function GM_setValue(key, value) {
    if (!hasGrant('GM_setValue') && !hasGrant('GM.setValue')) {
      return;
    }
    // Update local cache IMMEDIATELY - this makes subsequent GM_getValue instant
    _cache[key] = value;
    // Persist async (fire and forget) - background handles debouncing
    sendToBackground('GM_setValue', { scriptId, key, value }).catch(() => {});
    return value;
  }

  // GM_deleteValue
  function GM_deleteValue(key) {
    if (!hasGrant('GM_deleteValue') && !hasGrant('GM.deleteValue')) return;
    delete _cache[key];
    sendToBackground('GM_deleteValue', { scriptId, key }).catch(() => {});
  }

  // GM_listValues - returns cached keys synchronously
  function GM_listValues() {
    if (!hasGrant('GM_listValues') && !hasGrant('GM.listValues')) return [];
    return Object.keys(_cache);
  }

  // GM_getValues - Get multiple values at once (like Violentmonkey)
  // Accepts array of keys or object with default values
  function GM_getValues(keysOrDefaults) {
    if (!hasGrant('GM_getValue') && !hasGrant('GM.getValue') &&
        !hasGrant('GM_getValues') && !hasGrant('GM.getValues')) {
      return Array.isArray(keysOrDefaults) ? {} : keysOrDefaults;
    }
    const result = {};
    if (Array.isArray(keysOrDefaults)) {
      // Array of keys - return values or undefined
      for (const key of keysOrDefaults) {
        if (key in _cache) {
          result[key] = _cache[key];
        }
      }
    } else if (typeof keysOrDefaults === 'object' && keysOrDefaults !== null) {
      // Object with defaults - return values or defaults
      for (const key of Object.keys(keysOrDefaults)) {
        result[key] = key in _cache ? _cache[key] : keysOrDefaults[key];
      }
    }
    return result;
  }

  // GM_setValues - Set multiple values at once (like Violentmonkey)
  function GM_setValues(values) {
    if (!hasGrant('GM_setValue') && !hasGrant('GM.setValue') &&
        !hasGrant('GM_setValues') && !hasGrant('GM.setValues')) {
      return;
    }
    if (typeof values !== 'object' || values === null) return;

    // Update local cache immediately for all values
    for (const [key, value] of Object.entries(values)) {
      _cache[key] = value;
    }
    // Persist all values to background in one call
    sendToBackground('GM_setValues', { scriptId, values }).catch(() => {});
  }

  // GM_deleteValues - Delete multiple values at once (like Violentmonkey)
  function GM_deleteValues(keys) {
    if (!hasGrant('GM_deleteValue') && !hasGrant('GM.deleteValue') &&
        !hasGrant('GM_deleteValues') && !hasGrant('GM.deleteValues')) {
      return;
    }
    if (!Array.isArray(keys)) return;

    // Delete from local cache immediately
    for (const key of keys) {
      delete _cache[key];
    }
    // Persist deletions to background in one call
    sendToBackground('GM_deleteValues', { scriptId, keys }).catch(() => {});
  }

  // GM_addStyle - inject CSS with robust DOM handling
  function GM_addStyle(css) {
    const style = document.createElement('style');
    style.textContent = css;
    style.setAttribute('data-scriptvault', scriptId);

    // Try to inject immediately
    function inject() {
      const target = document.head || document.documentElement || document.body;
      if (target && target.appendChild) {
        try {
          target.appendChild(style);
          return true;
        } catch (e) {
          // appendChild failed, will retry
        }
      }
      return false;
    }

    if (!inject()) {
      // DOM not ready - wait for it
      if (document.readyState === 'loading') {
        // Document still loading, wait for DOMContentLoaded
        document.addEventListener('DOMContentLoaded', () => inject(), { once: true });
      } else {
        // Document loaded but no valid target - use MutationObserver
        const observer = new MutationObserver(() => {
          if (inject()) {
            observer.disconnect();
          }
        });

        // Observe whatever root we can find
        const root = document.documentElement || document;
        if (root && root.nodeType === Node.ELEMENT_NODE) {
          observer.observe(root, { childList: true, subtree: true });
        }

        // Fallback timeout - try one more time after a delay
        setTimeout(() => {
          observer.disconnect();
          if (!style.parentNode) {
            inject();
          }
        }, 1000);
      }
    }

    return style;
  }

  // GM_xmlhttpRequest - Full implementation with all events (like Violentmonkey)
  function GM_xmlhttpRequest(details) {
    if (!hasGrant('GM_xmlhttpRequest') && !hasGrant('GM.xmlHttpRequest')) {
      if (details.onerror) details.onerror({ error: 'Permission denied', status: 0 });
      return { abort: () => {} };
    }

    // Generate unique request ID
    const localId = 'xhr_' + (++_xhrSeqId) + '_' + Date.now().toString(36);
    let requestId = null;
    let aborted = false;
    let currentMapKey = localId;

    // Store request details for event handling
    const requestEntry = { details, aborted: false };
    _xhrRequests.set(localId, requestEntry);

    // Control object returned to the script
    const control = {
      abort: () => {
        aborted = true;
        requestEntry.aborted = true;
        // Send abort using server ID if available, clean up both keys
        if (requestId) {
          sendToBackground('GM_xmlhttpRequest_abort', { requestId }).catch(() => {});
        }
        // Call onabort callback
        if (details.onabort) {
          try {
            details.onabort({ error: 'Aborted', status: 0 });
          } catch (e) {}
        }
        // Clean up both possible keys to avoid orphans
        _xhrRequests.delete(localId);
        if (requestId) _xhrRequests.delete(requestId);
      }
    };

    // Serialize request body to a structured-clone-safe format.
    // Blob/File/FormData cannot cross the extension messaging boundary natively.
    async function _serializeBody(d) {
      if (!d || typeof d === 'string' || d instanceof ArrayBuffer || ArrayBuffer.isView(d)) return d;
      if (d instanceof URLSearchParams) return d.toString();
      function _ab2b64(buf) {
        const bytes = new Uint8Array(buf), chunk = 8192;
        let s = '';
        for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode(...bytes.subarray(i, i + chunk));
        return btoa(s);
      }
      if (d instanceof Blob || d instanceof File) {
        const buf = await d.arrayBuffer();
        return { __sv_blob__: true, b64: _ab2b64(buf), type: d.type, name: d instanceof File ? d.name : undefined };
      }
      if (d instanceof FormData) {
        const entries = [];
        for (const [name, val] of d.entries()) {
          if (val instanceof Blob || val instanceof File) {
            const buf = await val.arrayBuffer();
            entries.push({ name, b64: _ab2b64(buf), type: val.type, filename: val instanceof File ? val.name : 'blob' });
          } else {
            entries.push({ name, value: val });
          }
        }
        return { __sv_formdata__: true, entries };
      }
      return d;
    }

    // Start the request (async to allow body serialization)
    (async () => {
      const serializedData = await _serializeBody(details.data);
      const response = await sendToBackground('GM_xmlhttpRequest', {
        scriptId,
        method: details.method || 'GET',
        url: details.url,
        headers: details.headers,
        data: serializedData,
        timeout: details.timeout,
        responseType: details.responseType,
        overrideMimeType: details.overrideMimeType,
        user: details.user,
        password: details.password,
        context: details.context,
        anonymous: details.anonymous,
        // Track which callbacks are registered so background knows what to send
        hasCallbacks: {
          onload: !!details.onload,
          onerror: !!details.onerror,
          onprogress: !!details.onprogress,
          onreadystatechange: !!details.onreadystatechange,
          ontimeout: !!details.ontimeout,
          onabort: !!details.onabort,
          onloadstart: !!details.onloadstart,
          onloadend: !!details.onloadend,
          upload: !!(details.upload && (
            details.upload.onprogress ||
            details.upload.onloadstart ||
            details.upload.onload ||
            details.upload.onerror
          ))
        }
      });
      if (aborted) return;

      if (!response) {
        // No response (bridge failure)
        if (details.onerror) details.onerror({ error: 'Request failed - no response', status: 0 });
        _xhrRequests.delete(currentMapKey);
      } else if (response.error) {
        // Immediate error
        if (details.onerror) details.onerror({ error: response.error, status: 0 });
        _xhrRequests.delete(currentMapKey);
      } else if (response.requestId) {
        // Re-key: add server ID entry, then remove local ID
        requestId = response.requestId;
        _xhrRequests.set(requestId, requestEntry);
        _xhrRequests.delete(localId);
        currentMapKey = requestId;
      }
    })().catch(err => {
      if (aborted) return;
      if (details.onerror) details.onerror({ error: err.message || 'Request failed', status: 0 });
      _xhrRequests.delete(currentMapKey);
    });

    return control;
  }

  // GM_addValueChangeListener - Watch for value changes (like Tampermonkey)
  function GM_addValueChangeListener(key, callback) {
    if (!hasGrant('GM_addValueChangeListener') && !hasGrant('GM.addValueChangeListener')) return null;
    if (typeof callback !== 'function') return null;

    const listenerId = ++_valueChangeListenerId;
    _valueChangeListeners.set(listenerId, { key, callback });
    return listenerId;
  }

  // GM_removeValueChangeListener - Stop watching for value changes
  function GM_removeValueChangeListener(listenerId) {
    if (!hasGrant('GM_removeValueChangeListener') && !hasGrant('GM.removeValueChangeListener')) return false;
    return _valueChangeListeners.delete(listenerId);
  }

  // GM_setClipboard
  function GM_setClipboard(text, type) {
    if (!hasGrant('GM_setClipboard') && !hasGrant('GM.setClipboard')) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopyText(text));
    } else {
      fallbackCopyText(text);
    }
  }

  function fallbackCopyText(text) {
    const target = document.body || document.documentElement;
    if (!target) return;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
    target.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch(e) {}
    ta.remove();
  }

  // GM_notification (with onclick, ondone, timeout, tag, silent, highlight, url)
  const _notifCallbacks = new Map();
  function GM_notification(details, ondone) {
    if (!hasGrant('GM_notification') && !hasGrant('GM.notification')) return;
    let opts;
    if (typeof details === 'string') {
      // GM_notification(text, title, image, onclick)
      opts = { text: details, title: ondone, image: arguments[2] };
      const onclickArg = arguments[3];
      if (typeof onclickArg === 'function') opts.onclick = onclickArg;
      ondone = undefined;
    } else {
      opts = details;
    }
    if (typeof ondone === 'function') opts.ondone = ondone;
    const notifTag = opts.tag || ('notif_' + Math.random().toString(36).substring(2));
    // Store callbacks
    _notifCallbacks.set(notifTag, {
      onclick: opts.onclick, ondone: opts.ondone
    });
    // Highlight tab instead of notification
    if (opts.highlight) {
      sendToBackground('GM_focusTab', {}).catch(() => {});
      if (opts.ondone) { try { opts.ondone(); } catch(e) {} }
      return;
    }
    sendToBackground('GM_notification', {
      scriptId,
      title: opts.title || GM_info.script.name,
      text: opts.text || opts.body || '',
      image: opts.image,
      timeout: opts.timeout || 0,
      tag: notifTag,
      silent: opts.silent || false,
      hasOnclick: !!opts.onclick,
      hasOndone: !!opts.ondone
    }).catch(() => {});
  }

  // GM_openInTab (with close(), onclose, insert, setParent, incognito)
  const _openedTabs = new Map();
  function GM_openInTab(url, options) {
    if (!hasGrant('GM_openInTab') && !hasGrant('GM.openInTab')) return null;
    const opts = typeof options === 'boolean' ? { active: !options } : (options || {});
    const tabHandle = { closed: false, onclose: null, close: () => {} };
    sendToBackground('GM_openInTab', {
      url, scriptId, trackClose: true,
      active: opts.active, insert: opts.insert,
      setParent: opts.setParent, background: opts.background
    }).then(result => {
      if (result && result.tabId) {
        _openedTabs.set(result.tabId, tabHandle);
        tabHandle.close = () => {
          sendToBackground('GM_closeTab', { tabId: result.tabId }).catch(() => {});
          tabHandle.closed = true;
        };
      }
    }).catch(() => {});
    return tabHandle;
  }

  // GM_download (with onload, onerror, onprogress, ontimeout callbacks)
  const _downloadCallbacks = new Map();
  function GM_download(details) {
    if (!hasGrant('GM_download') && !hasGrant('GM.download')) return;
    let opts;
    if (typeof details === 'string') {
      opts = { url: details, name: arguments[1] || details.split('/').pop() };
    } else {
      opts = { ...details };
    }
    const callbacks = {
      onload: opts.onload, onerror: opts.onerror,
      onprogress: opts.onprogress, ontimeout: opts.ontimeout
    };
    delete opts.onload; delete opts.onerror;
    delete opts.onprogress; delete opts.ontimeout;
    opts.scriptId = scriptId;
    opts.hasCallbacks = !!(callbacks.onload || callbacks.onerror || callbacks.onprogress || callbacks.ontimeout);
    sendToBackground('GM_download', opts).then(result => {
      if (result && result.downloadId) {
        _downloadCallbacks.set(result.downloadId, callbacks);
      }
      if (result && result.error && callbacks.onerror) {
        try { callbacks.onerror({ error: result.error }); } catch(e) {}
      }
    }).catch(e => {
      if (callbacks.onerror) try { callbacks.onerror({ error: e.message || 'Download failed' }); } catch(ex) {}
    });
  }

  // GM_log
  function GM_log(...args) {
    console.log('[' + GM_info.script.name + ']', ...args);
  }

  // GM_registerMenuCommand (with extended options: id, accessKey, autoClose, title)
  const _menuCmds = new Map();
  function GM_registerMenuCommand(caption, callback, accessKeyOrOptions) {
    if (!hasGrant('GM_registerMenuCommand') && !hasGrant('GM.registerMenuCommand')) return null;
    let opts = {};
    if (typeof accessKeyOrOptions === 'string') {
      opts.accessKey = accessKeyOrOptions;
    } else if (accessKeyOrOptions && typeof accessKeyOrOptions === 'object') {
      opts = accessKeyOrOptions;
    }
    const id = opts.id || Math.random().toString(36).substring(2);
    _menuCmds.set(id, { callback, caption });
    sendToBackground('GM_registerMenuCommand', {
      scriptId, commandId: id, caption,
      accessKey: opts.accessKey || '',
      autoClose: opts.autoClose !== false,
      title: opts.title || ''
    }).catch(() => {});
    return id;
  }

  function GM_unregisterMenuCommand(id) {
    if (!hasGrant('GM_registerMenuCommand') && !hasGrant('GM.registerMenuCommand') &&
        !hasGrant('GM_unregisterMenuCommand') && !hasGrant('GM.unregisterMenuCommand')) return;
    _menuCmds.delete(id);
    sendToBackground('GM_unregisterMenuCommand', { scriptId, commandId: id }).catch(() => {});
  }

  function GM_getMenuCommands() {
    if (!hasGrant('GM_registerMenuCommand') && !hasGrant('GM.registerMenuCommand')) return [];
    return Array.from(_menuCmds.entries()).map(([id, entry]) => ({ id, name: entry.caption || id, caption: entry.caption || id }));
  }

  // GM_getResourceText / GM_getResourceURL
  async function GM_getResourceText(name) {
    if (!hasGrant('GM_getResourceText') && !hasGrant('GM.getResourceText')) return null;
    return await sendToBackground('GM_getResourceText', { scriptId, name });
  }

  async function GM_getResourceURL(name, isBlobUrl) {
    if (!hasGrant('GM_getResourceURL') && !hasGrant('GM.getResourceUrl')) return null;
    const dataUri = await sendToBackground('GM_getResourceURL', { scriptId, name });
    if (!dataUri) return null;
    // Return data URI by default, or convert to blob URL if requested
    if (isBlobUrl === false) return dataUri;
    try {
      const resp = await fetch(dataUri);
      const blob = await resp.blob();
      return URL.createObjectURL(blob);
    } catch (e) {
      return dataUri;
    }
  }

  // GM_addElement
  function GM_addElement(parentOrTag, tagOrAttrs, attrsOrUndefined) {
    if (!hasGrant('GM_addElement') && !hasGrant('GM.addElement')) return null;
    let parent, tag, attrs;
    if (typeof parentOrTag === 'string') {
      tag = parentOrTag;
      attrs = tagOrAttrs;
      parent = document.head || document.documentElement;
    } else {
      parent = parentOrTag;
      tag = tagOrAttrs;
      attrs = attrsOrUndefined;
    }
    const el = document.createElement(tag);
    if (attrs) {
      Object.entries(attrs).forEach(([k, v]) => {
        if (k === 'textContent') el.textContent = v;
        else if (k === 'innerHTML') el.innerHTML = v;
        else el.setAttribute(k, v);
      });
    }
    if (parent) parent.appendChild(el);
    return el;
  }

  // GM_loadScript - Dynamically fetch and eval a script URL at runtime
  // Fetches via background service worker (bypasses CORS/CSP), evals in userscript scope
  // Masks module/define/exports to force UMD libraries to set globals on window
  const _loadedScripts = new Set();
  async function GM_loadScript(url, options = {}) {
    if (!hasGrant('GM_xmlhttpRequest') && !hasGrant('GM.xmlHttpRequest')) {
      throw new Error('GM_loadScript requires @grant GM_xmlhttpRequest');
    }
    if (!url) throw new Error('GM_loadScript: No URL provided');
    if (!options.force && _loadedScripts.has(url)) return;
    const result = await sendToBackground('GM_loadScript', { url, timeout: options.timeout });
    if (result.error) throw new Error('GM_loadScript: ' + result.error);
    // Temporarily mask module systems so UMD scripts create window globals
    const _savedModule = window.module;
    const _savedExports = window.exports;
    const _savedDefine = window.define;
    try {
      window.module = undefined;
      window.exports = undefined;
      window.define = undefined;
      const fn = new Function(result.code);
      fn.call(window);
    } finally {
      window.module = _savedModule;
      window.exports = _savedExports;
      window.define = _savedDefine;
    }
    _loadedScripts.add(url);
  }

  // GM_getTab / GM_saveTab / GM_getTabs (real implementations via background)
  let _tabData = {};
  function GM_getTab(callback) {
    sendToBackground('GM_getTab', { scriptId }).then(data => {
      _tabData = data || {};
      if (callback) callback(_tabData);
    }).catch(() => { if (callback) callback(_tabData); });
    return _tabData;
  }
  function GM_saveTab(tab) {
    _tabData = tab || {};
    sendToBackground('GM_saveTab', { scriptId, data: _tabData }).catch(() => {});
  }
  function GM_getTabs(callback) {
    sendToBackground('GM_getTabs', { scriptId }).then(data => {
      if (callback) callback(data || {});
    }).catch(() => { if (callback) callback({}); });
  }

  function GM_focusTab() {
    if (!hasGrant('GM_focusTab') && !hasGrant('GM.focusTab') &&
        !hasGrant('GM_openInTab') && !hasGrant('GM.openInTab')) return;
    sendToBackground('GM_focusTab', {}).catch(() => {});
  }

  // unsafeWindow
  const unsafeWindow = window;

  // Helper to wait for cache to be ready (used by async GM.* API)
  function _waitForCache() {
    if (_cacheReady) return Promise.resolve();
    if (!_cacheReadyPromise) {
      _cacheReadyPromise = new Promise(resolve => {
        _cacheReadyResolve = resolve;
      });
    }
    return _cacheReadyPromise;
  }

  // GM.* Promise-based API
  // These wait for storage to be refreshed before returning, ensuring fresh values
  // GM_cookie (list, set, delete)
  const GM_cookie = {
    list: (details, callback) => {
      if (!hasGrant('GM_cookie') && !hasGrant('GM.cookie')) {
        if (callback) callback([], new Error('Permission denied'));
        return;
      }
      sendToBackground('GM_cookie_list', details || {}).then(r => {
        if (callback) callback(r.cookies || [], r.error ? new Error(r.error) : undefined);
      }).catch(e => { if (callback) callback([], e); });
    },
    set: (details, callback) => {
      if (!hasGrant('GM_cookie') && !hasGrant('GM.cookie')) {
        if (callback) callback(new Error('Permission denied'));
        return;
      }
      sendToBackground('GM_cookie_set', details || {}).then(r => {
        if (callback) callback(r.error ? new Error(r.error) : undefined);
      }).catch(e => { if (callback) callback(e); });
    },
    delete: (details, callback) => {
      if (!hasGrant('GM_cookie') && !hasGrant('GM.cookie')) {
        if (callback) callback(new Error('Permission denied'));
        return;
      }
      sendToBackground('GM_cookie_delete', details || {}).then(r => {
        if (callback) callback(r.error ? new Error(r.error) : undefined);
      }).catch(e => { if (callback) callback(e); });
    }
  };

  // Event listener for notification/download/tab close events from background
  // Content.js forwards these with 'type' field (not 'action') and flat structure (not nested 'data')
  window.addEventListener('message', function __svEventHandler(event) {
    if (!event.data || event.data.channel !== CHANNEL_ID || event.data.direction !== 'to-userscript') return;

    // Notification events (content.js sends: type, scriptId, notifTag, eventType)
    if (event.data.type === 'notificationEvent' && event.data.scriptId === scriptId) {
      const tag = event.data.notifTag;
      const cbs = _notifCallbacks.get(tag);
      if (!cbs) return;
      if (event.data.eventType === 'click' && cbs.onclick) { try { cbs.onclick(); } catch(e) {} }
      if (event.data.eventType === 'done') {
        if (cbs.ondone) { try { cbs.ondone(); } catch(e) {} }
        _notifCallbacks.delete(tag);
      }
    }

    // Download events (content.js sends: type, scriptId, downloadId, eventType, data)
    if (event.data.type === 'downloadEvent' && event.data.scriptId === scriptId) {
      const d = event.data.data || {};
      const cbs = _downloadCallbacks.get(event.data.downloadId);
      if (!cbs) return;
      const evType = event.data.eventType;
      if (evType === 'load' && cbs.onload) { try { cbs.onload({ url: d.url }); } catch(e) {} _downloadCallbacks.delete(event.data.downloadId); }
      if (evType === 'error' && cbs.onerror) { try { cbs.onerror({ error: d.error }); } catch(e) {} _downloadCallbacks.delete(event.data.downloadId); }
      if (evType === 'progress' && cbs.onprogress) { try { cbs.onprogress({ loaded: d.loaded, total: d.total }); } catch(e) {} }
      if (evType === 'timeout' && cbs.ontimeout) { try { cbs.ontimeout(); } catch(e) {} _downloadCallbacks.delete(event.data.downloadId); }
    }

    // Tab close events (content.js sends: type, scriptId, closedTabId)
    if (event.data.type === 'openedTabClosed' && event.data.scriptId === scriptId) {
      const tabId = event.data.closedTabId;
      const handle = _openedTabs.get(tabId);
      if (handle) {
        handle.closed = true;
        if (typeof handle.onclose === 'function') { try { handle.onclose(); } catch(e) {} }
        _openedTabs.delete(tabId);
      }
    }
  });

  // GM.* Promise-based API
  const GM = {
    info: GM_info,
    getValue: async (k, d) => {
      await _waitForCache();
      return GM_getValue(k, d);
    },
    setValue: (k, v) => Promise.resolve(GM_setValue(k, v)),
    deleteValue: (k) => Promise.resolve(GM_deleteValue(k)),
    listValues: async () => {
      await _waitForCache();
      return GM_listValues();
    },
    getValues: async (keys) => {
      await _waitForCache();
      return GM_getValues(keys);
    },
    setValues: (vals) => Promise.resolve(GM_setValues(vals)),
    deleteValues: (keys) => Promise.resolve(GM_deleteValues(keys)),
    addStyle: (css) => Promise.resolve(GM_addStyle(css)),
    xmlHttpRequest: (d) => {
      let control;
      const promise = new Promise((res, rej) => {
        control = GM_xmlhttpRequest({
          ...d,
          onload: (r) => { if (d.onload) d.onload(r); res(r); },
          onerror: (e) => { if (d.onerror) d.onerror(e); rej(e.error || e); },
          ontimeout: (e) => { if (d.ontimeout) d.ontimeout(e); rej(new Error('timeout')); },
          onabort: (e) => { if (d.onabort) d.onabort(e); rej(new Error('aborted')); }
        });
      });
      promise.abort = () => control.abort();
      return promise;
    },
    notification: (d, ondone) => Promise.resolve(GM_notification(d, ondone)),
    setClipboard: (t, type) => Promise.resolve(GM_setClipboard(t, type)),
    openInTab: (u, o) => Promise.resolve(GM_openInTab(u, o)),
    download: (d) => Promise.resolve(GM_download(d)),
    getResourceText: (n) => GM_getResourceText(n),
    getResourceUrl: (n) => GM_getResourceURL(n),
    registerMenuCommand: (c, cb, o) => Promise.resolve(GM_registerMenuCommand(c, cb, o)),
    unregisterMenuCommand: (id) => Promise.resolve(GM_unregisterMenuCommand(id)),
    addValueChangeListener: (k, cb) => Promise.resolve(GM_addValueChangeListener(k, cb)),
    removeValueChangeListener: (id) => Promise.resolve(GM_removeValueChangeListener(id)),
    getTab: () => new Promise(r => GM_getTab(r)),
    saveTab: (t) => Promise.resolve(GM_saveTab(t)),
    getTabs: () => new Promise(r => GM_getTabs(r)),
    loadScript: (url, opts) => GM_loadScript(url, opts),
    cookies: {
      list: (d) => new Promise((res, rej) => GM_cookie.list(d, (cookies, err) => err ? rej(err) : res(cookies))),
      set: (d) => new Promise((res, rej) => GM_cookie.set(d, (err) => err ? rej(err) : res())),
      delete: (d) => new Promise((res, rej) => GM_cookie.delete(d, (err) => err ? rej(err) : res()))
    }
  };

  // CRITICAL: Expose all GM_* functions to window for Tampermonkey/Violentmonkey compatibility
  window.GM_info = GM_info;
  window.GM_getValue = GM_getValue;
  window.GM_setValue = GM_setValue;
  window.GM_deleteValue = GM_deleteValue;
  window.GM_listValues = GM_listValues;
  window.GM_getValues = GM_getValues;
  window.GM_setValues = GM_setValues;
  window.GM_deleteValues = GM_deleteValues;
  window.GM_addStyle = GM_addStyle;
  window.GM_xmlhttpRequest = GM_xmlhttpRequest;
  window.GM_setClipboard = GM_setClipboard;
  window.GM_notification = GM_notification;
  window.GM_openInTab = GM_openInTab;
  window.GM_download = GM_download;
  window.GM_log = GM_log;
  window.GM_registerMenuCommand = GM_registerMenuCommand;
  window.GM_unregisterMenuCommand = GM_unregisterMenuCommand;
  window.GM_getMenuCommands = GM_getMenuCommands;
  window.GM_getResourceText = GM_getResourceText;
  window.GM_getResourceURL = GM_getResourceURL;
  window.GM_addElement = GM_addElement;
  window.GM_loadScript = GM_loadScript;
  window.GM_getTab = GM_getTab;
  window.GM_saveTab = GM_saveTab;
  window.GM_getTabs = GM_getTabs;
  window.GM_addValueChangeListener = GM_addValueChangeListener;
  window.GM_removeValueChangeListener = GM_removeValueChangeListener;
  window.GM_cookie = GM_cookie;
  window.GM_focusTab = GM_focusTab;

  // ========== GM_webRequest (Tampermonkey-compatible, declarativeNetRequest-backed) ==========
  function GM_webRequest(rules, listener) {
    if (!hasGrant('GM_webRequest')) {
      console.warn('[ScriptVault] GM_webRequest requires @grant GM_webRequest');
      return;
    }
    const ruleArray = Array.isArray(rules) ? rules : [rules];
    sendToBackground('GM_webRequest', { rules: ruleArray }).catch(e =>
      console.warn('[ScriptVault] GM_webRequest failed:', e.message)
    );
    // listener is called with (info, message, details) when a rule matches;
    // declarativeNetRequest doesn't support runtime callbacks, so we no-op this.
    if (typeof listener === 'function') {
      console.info('[ScriptVault] GM_webRequest: runtime listener not supported in MV3 — use @webRequest metadata for static rules');
    }
  }
  window.GM_webRequest = GM_webRequest;

  window.unsafeWindow = unsafeWindow;
  window.GM = GM;

  // ========== window.onurlchange (SPA navigation detection) ==========
  // Tampermonkey-compatible: fires when URL changes via pushState/replaceState/popstate
  if (hasGrant('window.onurlchange')) {
    let _lastUrl = location.href;
    const _urlChangeHandlers = [];

    function __checkUrlChange() {
      const newUrl = location.href;
      if (newUrl !== _lastUrl) {
        const oldUrl = _lastUrl;
        _lastUrl = newUrl;
        const event = { url: newUrl, oldUrl };
        _urlChangeHandlers.forEach(fn => { try { fn(event); } catch(e) {} });
        if (typeof window.onurlchange === 'function') {
          try { window.onurlchange(event); } catch(e) {}
        }
      }
    }

    // Intercept history API
    const _origPushState = history.pushState;
    const _origReplaceState = history.replaceState;
    history.pushState = function() {
      _origPushState.apply(this, arguments);
      __checkUrlChange();
    };
    history.replaceState = function() {
      _origReplaceState.apply(this, arguments);
      __checkUrlChange();
    };
    window.addEventListener('popstate', __checkUrlChange);
    window.addEventListener('hashchange', __checkUrlChange);

    // Allow adding multiple handlers via addEventListener pattern
    window.addEventListener = new Proxy(window.addEventListener, {
      apply(target, thisArg, args) {
        if (args[0] === 'urlchange') {
          _urlChangeHandlers.push(args[1]);
          return;
        }
        return Reflect.apply(target, thisArg, args);
      }
    });
    window.removeEventListener = new Proxy(window.removeEventListener, {
      apply(target, thisArg, args) {
        if (args[0] === 'urlchange') {
          const idx = _urlChangeHandlers.indexOf(args[1]);
          if (idx >= 0) _urlChangeHandlers.splice(idx, 1);
          return;
        }
        return Reflect.apply(target, thisArg, args);
      }
    });
    window.onurlchange = null; // Initialize as settable
  }

  // ========== window.close / window.focus grants ==========
  if (hasGrant('window.close')) {
    // Already available in USER_SCRIPT world, but explicitly expose
    window.close = window.close.bind(window);
  }
  if (hasGrant('window.focus')) {
    window.focus = window.focus.bind(window);
  }

  // ========== GM_audio API (Tampermonkey-compatible tab mute control) ==========
  const GM_audio = {
    setMute: (details, callback) => {
      if (!hasGrant('GM_audio')) { if (callback) callback(new Error('Permission denied')); return; }
      sendToBackground('GM_audio_setMute', { mute: details?.mute ?? details }).then(r => {
        if (callback) callback(r?.error ? new Error(r.error) : undefined);
      }).catch(e => { if (callback) callback(e); });
    },
    getState: (callback) => {
      if (!hasGrant('GM_audio')) { if (callback) callback(null, new Error('Permission denied')); return; }
      sendToBackground('GM_audio_getState', {}).then(r => {
        if (callback) callback(r, r?.error ? new Error(r.error) : undefined);
      }).catch(e => { if (callback) callback(null, e); });
    },
    _listeners: [],
    _watching: false,
    _msgHandler: null,
    addStateChangeListener: (listener, callback) => {
      if (!hasGrant('GM_audio')) { if (callback) callback(new Error('Permission denied')); return; }
      GM_audio._listeners.push(listener);
      if (!GM_audio._watching) {
        GM_audio._watching = true;
        sendToBackground('GM_audio_watchState', {});
        // Listen for audio state change events from content script bridge
        GM_audio._msgHandler = (e) => {
          if (e.source !== window || !e.data || e.data.channel !== CHANNEL_ID) return;
          if (e.data.type === 'audioStateChanged') {
            const state = e.data.data;
            for (const fn of GM_audio._listeners) {
              try { fn(state); } catch (err) { console.error('[GM_audio listener]', err); }
            }
          }
        };
        window.addEventListener('message', GM_audio._msgHandler);
      }
      if (callback) callback();
    },
    removeStateChangeListener: (listener, callback) => {
      const idx = GM_audio._listeners.indexOf(listener);
      if (idx >= 0) GM_audio._listeners.splice(idx, 1);
      if (GM_audio._listeners.length === 0 && GM_audio._watching) {
        GM_audio._watching = false;
        if (GM_audio._msgHandler) {
          window.removeEventListener('message', GM_audio._msgHandler);
          GM_audio._msgHandler = null;
        }
        sendToBackground('GM_audio_unwatchState', {});
      }
      if (callback) callback();
    }
  };
  window.GM_audio = GM_audio;

  // ========== DOM HELPER FUNCTIONS ==========
  // These help userscripts handle DOM timing issues gracefully
  // Use these when document.body/head might not exist yet

  // Wait for any element matching selector to appear in DOM
  function __waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      // Check if already exists
      const existing = document.querySelector(selector);
      if (existing) return resolve(existing);

      let resolved = false;
      const observer = new MutationObserver((mutations, obs) => {
        if (resolved) return;
        const el = document.querySelector(selector);
        if (el) {
          resolved = true;
          obs.disconnect();
          resolve(el);
        }
      });

      // Start observing - handle case where documentElement might not exist yet
      const root = document.documentElement || document;
      if (root && typeof root.nodeType !== 'undefined') {
        observer.observe(root, { childList: true, subtree: true });
      }

      // Timeout with final check
      setTimeout(() => {
        if (resolved) return;
        observer.disconnect();
        const el = document.querySelector(selector);
        if (el) {
          resolve(el);
        } else {
          reject(new Error('[ScriptVault] Timeout waiting for element: ' + selector));
        }
      }, timeout);
    });
  }

  // Wait for document.body to be available
  function __waitForBody(timeout = 10000) {
    if (document.body) return Promise.resolve(document.body);
    return __waitForElement('body', timeout);
  }

  // Wait for document.head to be available
  function __waitForHead(timeout = 10000) {
    if (document.head) return Promise.resolve(document.head);
    return __waitForElement('head', timeout);
  }

  // Safe MutationObserver that waits for target element to exist
  // Prevents "parameter 1 is not of type 'Node'" errors
  function __safeObserve(target, options, callback) {
    // Handle selector string or element
    const element = typeof target === 'string' ? document.querySelector(target) : target;

    // If element exists and is valid, observe immediately
    if (element && element.nodeType === Node.ELEMENT_NODE) {
      const observer = new MutationObserver(callback);
      observer.observe(element, options);
      return { observer, promise: Promise.resolve(observer) };
    }

    // Element doesn't exist yet - wait for it
    const selectorToWait = typeof target === 'string' ? target : 'body';
    const promise = __waitForElement(selectorToWait)
      .then(el => {
        const observer = new MutationObserver(callback);
        observer.observe(el, options);
        return observer;
      })
      .catch(() => null);

    return { observer: null, promise };
  }

  // Expose DOM helpers to window for userscripts to use
  window.__ScriptVault_waitForElement = __waitForElement;
  window.__ScriptVault_waitForBody = __waitForBody;
  window.__ScriptVault_waitForHead = __waitForHead;
  window.__ScriptVault_safeObserve = __safeObserve;

  // Also expose as shorter aliases
  window.waitForElement = __waitForElement;
  window.waitForBody = __waitForBody;
  window.waitForHead = __waitForHead;
  window.safeObserve = __safeObserve;

  // ========== Network Proxy (full capture: fetch, XHR, WebSocket, sendBeacon) ==========
  // Intercepts all network calls made by this script and logs them to the network log.
  // Logs are viewable in the DevTools panel and the dashboard Network Log.
  (function __svNetProxy() {
    const _scriptName = ${JSON.stringify(meta.name || script.id)};
    const _scriptId = ${JSON.stringify(script.id)};

    function _log(entry) {
      sendToBackground('netlog_record', { scriptId: _scriptId, scriptName: _scriptName, ...entry }).catch(() => {});
    }

    // -- fetch --
    const _origFetch = window.fetch;
    window.fetch = function __svFetch(input, init) {
      const method = (init?.method || 'GET').toUpperCase();
      const url = typeof input === 'string' ? input : input?.url || String(input);
      const t0 = performance.now();
      return _origFetch.apply(this, arguments).then(resp => {
        const duration = Math.round(performance.now() - t0);
        const cl = parseInt(resp.headers.get('content-length') || '0') || 0;
        _log({ type: 'fetch', method, url, status: resp.status, statusText: resp.statusText, duration, responseSize: cl, responseHeaders: Object.fromEntries(resp.headers.entries()) });
        return resp;
      }, err => {
        const duration = Math.round(performance.now() - t0);
        _log({ type: 'fetch', method, url, error: err?.message || String(err), duration });
        throw err;
      });
    };

    // -- XMLHttpRequest --
    const _OrigXHR = window.XMLHttpRequest;
    window.XMLHttpRequest = function __svXHR() {
      const xhr = new _OrigXHR();
      let _method = 'GET', _url = '', _t0 = 0;
      const _origOpen = xhr.open.bind(xhr);
      xhr.open = function(method, url) {
        _method = (method || 'GET').toUpperCase();
        _url = String(url);
        return _origOpen.apply(this, arguments);
      };
      const _origSend = xhr.send.bind(xhr);
      xhr.send = function() {
        _t0 = performance.now();
        xhr.addEventListener('loadend', () => {
          const duration = Math.round(performance.now() - _t0);
          if (xhr.status) {
            _log({ type: 'xhr', method: _method, url: _url, status: xhr.status, statusText: xhr.statusText, duration, responseSize: (xhr.responseText || '').length });
          } else {
            _log({ type: 'xhr', method: _method, url: _url, error: 'Request failed', duration });
          }
        }, { once: true });
        return _origSend.apply(this, arguments);
      };
      return xhr;
    };
    window.XMLHttpRequest.prototype = _OrigXHR.prototype;

    // -- WebSocket --
    const _OrigWS = window.WebSocket;
    window.WebSocket = function __svWebSocket(url, protocols) {
      const ws = protocols ? new _OrigWS(url, protocols) : new _OrigWS(url);
      const t0 = performance.now();
      let bytesSent = 0, bytesRecv = 0;
      ws.addEventListener('open', () => {
        _log({ type: 'websocket', method: 'WS', url: String(url), status: 101, statusText: 'Switching Protocols', duration: Math.round(performance.now() - t0) });
      });
      ws.addEventListener('message', e => { bytesRecv += (e.data?.length || 0); });
      ws.addEventListener('close', e => {
        _log({ type: 'websocket', method: 'WS_CLOSE', url: String(url), status: e.code, duration: Math.round(performance.now() - t0), responseSize: bytesRecv });
      });
      const _origSendWS = ws.send.bind(ws);
      ws.send = function(data) { bytesSent += (data?.length || 0); return _origSendWS(data); };
      return ws;
    };
    window.WebSocket.prototype = _OrigWS.prototype;
    Object.assign(window.WebSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });

    // -- sendBeacon --
    const _origBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function __svBeacon(url, data) {
      const result = _origBeacon(url, data);
      const size = data ? (typeof data === 'string' ? data.length : (data?.byteLength || data?.size || 0)) : 0;
      _log({ type: 'beacon', method: 'POST', url: String(url), status: result ? 200 : 0, duration: 0, responseSize: size });
      return result;
    };
  })();
  // ========== End Network Proxy ==========

  // GM APIs exposed log disabled for performance
  // console.log('[ScriptVault] GM APIs exposed to window for:', meta.name);

  // ============ @require Scripts ============
  // These run after GM APIs are available on window
${requireCode}
${libraryExports}
  // ============ End @require Scripts ============

  // Wait for storage to be refreshed, then execute the userscript
  // This ensures scripts see fresh values when using GM_getValue
  (async function __scriptMonkeyRunner() {
    await _waitForCache();
    const __startTime = performance.now();
    try {
`;

  const apiClose: string = `
    } catch (e) {
      // Report error to background for profiling
      sendToBackground('reportExecError', { scriptId, error: (e?.message || String(e)).slice(0, 200) }).catch(() => {});
    } finally {
      // Report execution time to background for profiling
      const __elapsed = Math.round((performance.now() - __startTime) * 100) / 100;
      sendToBackground('reportExecTime', { scriptId, time: __elapsed, url: location.href }).catch(() => {});
    }
  })();
})();
`;

  // @top-level-await: wrap user code in async IIFE so top-level await works
  const userCode: string = meta['top-level-await']
    ? `(async () => {\n${script.code}\n})();`
    : script.code;

  return apiInit + userCode + apiClose;
}
