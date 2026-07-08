/**
 * Wrapper script builder — generates the complete wrapped userscript code
 * that runs in the USER_SCRIPT world with GM API shims, console capture,
 * error suppression, network proxy, and all Tampermonkey/Violentmonkey
 * compatible APIs.
 *
 * Extracted from background.core.js `buildWrappedScript()`.
 */

import type { Script, ScriptMeta } from '../types/script';
import { ScriptConfig } from '../modules/script-config';

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
  scheduleGuard = '',
): string {
  const meta = script.meta;
  const grants: string[] = meta.grant.length > 0 ? meta.grant : ['none'];
  const scriptConfigValues = ScriptConfig.normalizeValues(
    Array.isArray(meta.config) ? meta.config : [],
    (script.settings?.userConfig && typeof script.settings.userConfig === 'object')
      ? (script.settings.userConfig as Record<string, unknown>)
      : {},
  );

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

  // Phase 39.11 — @match-top / @exclude-top runtime gates (TM #2784).
  // Patterns are tested against `window.top.location.href`. Cross-origin
  // top frames throw on access, so we treat opaque top as:
  //   - "no match" for @match-top (do not run — author asked for a specific
  //     top origin we can't verify),
  //   - "match" for @exclude-top (do not run — author asked to keep the
  //     script away from frames whose top we can't audit).
  // The matcher lives inside the wrapper so it doesn't depend on the
  // background's `matchPattern` helper.
  const topOriginGuard: string = ((): string => {
    const matchTop: string[] = Array.isArray(meta.matchTop) ? meta.matchTop : [];
    const excludeTop: string[] = Array.isArray(meta.excludeTop) ? meta.excludeTop : [];
    if (matchTop.length === 0 && excludeTop.length === 0) return '';
    const patternsToLiteral = (arr: readonly string[]): string =>
      arr
        .map((p) => {
          const m = p.match(/^\/(.+)\/([gimsuy]*)$/);
          if (m) return `{re: new RegExp(${JSON.stringify(m[1])}, ${JSON.stringify(m[2])})}`;
          return `{glob: ${JSON.stringify(p)}}`;
        })
        .join(', ');
    return `
  // ============ @match-top / @exclude-top Guard (Phase 39.11) ============
  {
    let __topUrl;
    try { __topUrl = window.top && window.top.location && window.top.location.href; } catch (_e) { __topUrl = null; }
    const __testTop = (pattern) => {
      if (pattern.re) return pattern.re.test(__topUrl);
      const escaped = pattern.glob.replace(/[.+^$()|[\\]{}]/g, '\\\\$&').replace(/\\*/g, '.*').replace(/\\?/g, '.');
      try { return new RegExp('^' + escaped + '$').test(__topUrl); } catch { return false; }
    };
    ${matchTop.length > 0 ? `
    const __matchTopPatterns = [${patternsToLiteral(matchTop)}];
    if (!__topUrl) return; // Cross-origin top → cannot verify match-top → bail.
    if (!__matchTopPatterns.some(__testTop)) return;` : ''}
    ${excludeTop.length > 0 ? `
    const __excludeTopPatterns = [${patternsToLiteral(excludeTop)}];
    if (!__topUrl) return; // Cross-origin top → conservatively bail.
    if (__excludeTopPatterns.some(__testTop)) return;` : ''}
  }
  // ============ End @match-top / @exclude-top Guard ============
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
  ${topOriginGuard}
  const scriptId = ${JSON.stringify(script.id)};
  const meta = ${JSON.stringify(meta)};
  const grants = ${JSON.stringify(grants)};
  const grantSet = new Set(grants);
  const __scriptConfigValues = Object.freeze(${JSON.stringify(scriptConfigValues)});
  const CAT_userConfig = Object.freeze({
    ...__scriptConfigValues,
    get(name, defaultValue) {
      return Object.prototype.hasOwnProperty.call(__scriptConfigValues, name)
        ? __scriptConfigValues[name]
        : defaultValue;
    },
    getAll() {
      return { ...__scriptConfigValues };
    }
  });
  const GM_configShim = Object.freeze({
    get(name, defaultValue) { return CAT_userConfig.get(name, defaultValue); },
    getValue(name, defaultValue) { return CAT_userConfig.get(name, defaultValue); },
    getAll() { return CAT_userConfig.getAll(); },
    set() { return false; },
    setValue() { return false; },
    save() { return false; },
    open() { return false; },
    close() { return false; },
    fields: Object.freeze({})
  });

  // Channel ID for communication with content script bridge
  // Extension ID is injected at build time since chrome.runtime isn't available in USER_SCRIPT world
  const CHANNEL_ID = ${JSON.stringify('ScriptVault_' + extId)};

  // console.log('[ScriptVault] Script initializing:', meta.name, 'Channel:', CHANNEL_ID);

  // Grant checking. @grant none and an empty grant list BOTH mean
  // no GM_* APIs except GM_info. The runtime JS was changed in v2.0.4
  // (Empty @grant array now correctly denies all permissions - was
  // granting ALL - critical) but this TS mirror lagged and returned
  // true for empty grants. In practice the parser defaults empty
  // meta.grant to single-element [none] so this latent drift never
  // fired, but a future caller that bypasses the parser would
  // silently grant everything. Aligned with runtime JS.
  const hasNone = grantSet.has('none');
  const hasGrant = (n) => {
    if (hasNone || grants.length === 0) return false;
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
      supportURL: meta.supportURL || '',
      config: CAT_userConfig.getAll(),
      configVars: meta.config || [],
      // Phase 38.12 — VM v2.37.0 renamed "tag" to "tags". Older scripts read
      // the singular form; expose a getter that returns the first tag for
      // back-compat with pre-2026 Violentmonkey scripts.
      get tag() { return Array.isArray(this.tags) ? this.tags[0] : undefined; }
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

  // Background-owned WebSocket handles. Connections live in the service
  // worker so @connect and internal-host guards are enforced before dialing.
  const _webSocketHandles = new Map(); // requestId -> { handle, details, listeners, readyState, closed }
  let _webSocketSeqId = 0;

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
      sendToBackground('GM_getValue', { scriptId, key: msg.key }).then((newValue) => {
        if (newValue === undefined) {
          delete _cache[msg.key];
        } else {
          _cache[msg.key] = newValue;
        }
        // Notify value change listeners
        _valueChangeListeners.forEach((listener) => {
          if (listener.key === msg.key || listener.key === null) {
            try {
              listener.callback(msg.key, oldValue, newValue, msg.remote !== false);
            } catch (e) {
              /* silently ignore value change listener errors */
            }
          }
        });
      }).catch(() => {});
    }

    // Handle XHR events
    if (msg.type === 'xhrEvent' && msg.scriptId === scriptId) {
      const request = _xhrRequests.get(msg.requestId);
      if (!request || request.aborted) return;

      const { details } = request;
      const eventType = msg.eventType;
      const eventData = { ...(msg.data || {}) };
      delete eventData.response;
      delete eventData.responseText;
      delete eventData.responseXML;
      delete eventData.responseHeaders;
      delete eventData.streamChunk;
      if (eventType === 'load' || eventType === 'loadend' || eventType === 'error' ||
          eventType === 'timeout' || eventType === 'abort') {
        return;
      }

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

    // Handle GM_webSocket events
    if (msg.type === 'webSocketEvent' && msg.scriptId === scriptId) {
      const socket = _webSocketHandles.get(msg.requestId);
      if (!socket || socket.closed) return;

      const eventType = msg.eventType;
      const eventData = msg.data || {};

      if (eventType === 'message') {
        if (eventData.eventId) {
          sendToBackground('GM_webSocket_takeEvent', {
            scriptId,
            requestId: msg.requestId,
            eventId: eventData.eventId
          }).then((result) => {
            if (!result || result.success !== true) return;
            const payloadEventData = result.event || {};
            dispatch('message', {
              type: 'message',
              data: decodeMessageData(payloadEventData.payload),
              origin: payloadEventData.origin || '',
              target: socket.handle,
            });
          }).catch(() => {});
        }
        return;
      }

      function decodeMessageData(value) {
        if (value && typeof value === 'object' && value.__sv_base64__) {
          const binary = atob(value.data || '');
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          return bytes.buffer;
        }
        return value;
      }

      function dispatch(type, eventObject) {
        const handler = socket.handle && socket.handle['on' + type];
        if (typeof handler === 'function') {
          try { handler.call(socket.handle, eventObject); } catch (_e) {}
        }
        const listeners = socket.listeners[type];
        if (listeners) {
          for (const listener of Array.from(listeners)) {
            try { listener.call(socket.handle, eventObject); } catch (_e) {}
          }
        }
      }

      if (eventType === 'open') {
        socket.readyState = 1;
        socket.protocol = eventData.protocol || '';
        socket.extensions = eventData.extensions || '';
        dispatch('open', { type: 'open', target: socket.handle, currentTarget: socket.handle });
      } else if (eventType === 'message') {
        const messageEvent = {
          type: 'message',
          data: decodeMessageData(eventData.payload),
          origin: eventData.origin || '',
          lastEventId: '',
          source: null,
          ports: [],
          target: socket.handle,
          currentTarget: socket.handle,
        };
        dispatch('message', messageEvent);
      } else if (eventType === 'error') {
        dispatch('error', {
          type: 'error',
          message: eventData.error || 'WebSocket error',
          error: eventData.error || 'WebSocket error',
          target: socket.handle,
          currentTarget: socket.handle,
        });
      } else if (eventType === 'close') {
        socket.readyState = 3;
        socket.closed = true;
        dispatch('close', {
          type: 'close',
          code: eventData.code || 1006,
          reason: eventData.reason || '',
          wasClean: eventData.wasClean === true,
          target: socket.handle,
          currentTarget: socket.handle,
        });
        _webSocketHandles.delete(msg.requestId);
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

  function canUsePostMessageBridge(action) {
    return action === 'netlog_record' || action === 'reportExecError' || action === 'reportExecTime';
  }

  // Send message to background script.
  // Prefers chrome.runtime.sendMessage (direct, no bridge needed) when available via messaging: true.
  // The postMessage bridge is telemetry-only because page scripts can forge window messages.
  async function sendToBackground(action, data) {
    // Try direct messaging first (available when userScripts world has messaging: true)
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        return await chrome.runtime.sendMessage({ action, data });
      } catch (e) {
        // Extension context invalidated or messaging not available, fall through to bridge
      }
    }

    if (!canUsePostMessageBridge(action)) {
      return { error: 'ScriptVault requires Chrome userScripts messaging for GM API calls.' };
    }

    // Fallback: use the telemetry-only content script bridge via postMessage.
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
      // that run in sandboxed frames. The content bridge only accepts telemetry.
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
  function GM_xmlhttpRequest(details, options) {
    const allowFetchGrant = options && options.allowFetchGrant === true;
    if (!hasGrant('GM_xmlhttpRequest') && !hasGrant('GM.xmlHttpRequest') &&
        !(allowFetchGrant && (hasGrant('GM_fetch') || hasGrant('GM.fetch')))) {
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
        partitionKey: details.partitionKey,
        cookiePartition: details.cookiePartition,
        cookieStoreId: details.cookieStoreId,
        cookieStore: details.cookieStore,
        // VM #2168 / TM noCache: bypass intermediate caches.
        // Accept both noCache (VM camelCase) and nocache (TM lowercase).
        noCache: details.noCache === true || details.nocache === true,
        // VM #2359: expose RequestInit.redirect so scripts can detect/block redirects.
        redirect: details.redirect,
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
        pollXhrFinalResult();
      }
    })().catch(err => {
      if (aborted) return;
      if (details.onerror) details.onerror({ error: err.message || 'Request failed', status: 0 });
      _xhrRequests.delete(currentMapKey);
    });

    function dispatchXhrTerminal(eventType, eventData) {
      if (aborted || requestEntry.aborted) return;
      const response = eventData || { readyState: 4, status: 0 };
      if (typeof details.onreadystatechange === 'function') {
        try { details.onreadystatechange(response); } catch (e) {}
      }
      if (eventType === 'load') {
        if (typeof details.onload === 'function') {
          try { details.onload(response); } catch (e) {}
        }
      } else if (eventType === 'timeout') {
        if (typeof details.ontimeout === 'function') {
          try { details.ontimeout(response); } catch (e) {}
        }
      } else if (eventType === 'abort') {
        if (typeof details.onabort === 'function') {
          try { details.onabort(response); } catch (e) {}
        }
      } else if (typeof details.onerror === 'function') {
        try { details.onerror(response); } catch (e) {}
      }
      if (typeof details.onloadend === 'function') {
        try { details.onloadend(response); } catch (e) {}
      }
      _xhrRequests.delete(currentMapKey);
      if (requestId) _xhrRequests.delete(requestId);
    }

    function pollXhrFinalResult(attempt = 0) {
      if (aborted || requestEntry.aborted || !requestId) return;
      sendToBackground('GM_xmlhttpRequest_result', { scriptId, requestId }).then((result) => {
        if (aborted || requestEntry.aborted) return;
        if (!result || result.done !== true) {
          if (attempt < 600) setTimeout(() => pollXhrFinalResult(attempt + 1), 50);
          return;
        }
        dispatchXhrTerminal(result.type || 'error', result.response || { readyState: 4, status: 0, error: result.error || 'Request failed' });
      }).catch(() => {
        if (attempt < 600) setTimeout(() => pollXhrFinalResult(attempt + 1), 50);
      });
    }

    return control;
  }

  function _GM_xmlhttpRequestPromise(d, options) {
    let control;
    const promise = new Promise((res, rej) => {
      control = GM_xmlhttpRequest({
        ...d,
        onload: (r) => { if (d.onload) d.onload(r); res(r); },
        onerror: (e) => { if (d.onerror) d.onerror(e); rej(e.error || e); },
        ontimeout: (e) => { if (d.ontimeout) d.ontimeout(e); rej(new Error('timeout')); },
        onabort: (e) => { if (d.onabort) d.onabort(e); rej(new Error('aborted')); }
      }, options);
    });
    promise.abort = () => { if (control && typeof control.abort === 'function') control.abort(); };
    return promise;
  }

  function _normalizeWebSocketDetails(urlOrDetails, protocolsOrOptions, maybeOptions) {
    let details = {};
    if (urlOrDetails && typeof urlOrDetails === 'object' && !(urlOrDetails instanceof URL)) {
      details = { ...urlOrDetails };
    } else {
      details.url = String(urlOrDetails || '');
    }

    if (Array.isArray(protocolsOrOptions) || typeof protocolsOrOptions === 'string') {
      details.protocols = protocolsOrOptions;
    } else if (protocolsOrOptions && typeof protocolsOrOptions === 'object') {
      details = { ...details, ...protocolsOrOptions };
    }

    if (maybeOptions && typeof maybeOptions === 'object') {
      details = { ...details, ...maybeOptions };
    }

    return details;
  }

  function _dispatchLocalWebSocketError(entry, message) {
    const eventObject = {
      type: 'error',
      message,
      error: message,
      target: entry.handle,
      currentTarget: entry.handle,
    };
    if (typeof entry.handle.onerror === 'function') {
      try { entry.handle.onerror.call(entry.handle, eventObject); } catch (_e) {}
    }
    const listeners = entry.listeners.error;
    if (listeners) {
      for (const listener of Array.from(listeners)) {
        try { listener.call(entry.handle, eventObject); } catch (_e) {}
      }
    }
  }

  async function _serializeWebSocketPayload(payload) {
    if (payload == null) return '';
    if (typeof payload === 'string') return payload;
    if (payload instanceof URLSearchParams) return payload.toString();

    let buffer = null;
    if (payload instanceof ArrayBuffer) {
      buffer = payload;
    } else if (ArrayBuffer.isView(payload)) {
      buffer = payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength);
    } else if (payload instanceof Blob || payload instanceof File) {
      buffer = await payload.arrayBuffer();
    }

    if (!buffer) return String(payload);

    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 8192) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    }
    return { __sv_base64__: true, data: btoa(binary) };
  }

  function GM_webSocket(urlOrDetails, protocolsOrOptions, maybeOptions) {
    const details = _normalizeWebSocketDetails(urlOrDetails, protocolsOrOptions, maybeOptions);
    const localId = 'ws_' + (++_webSocketSeqId) + '_' + Date.now().toString(36);
    const listeners = { open: new Set(), message: new Set(), error: new Set(), close: new Set() };
    const entry = {
      requestId: null,
      details,
      listeners,
      readyState: 0,
      closed: false,
      protocol: '',
      extensions: '',
      handle: null,
    };

    const handle = {
      CONNECTING: 0,
      OPEN: 1,
      CLOSING: 2,
      CLOSED: 3,
      binaryType: details.binaryType === 'blob' ? 'blob' : 'arraybuffer',
      onopen: typeof details.onopen === 'function' ? details.onopen : null,
      onmessage: typeof details.onmessage === 'function' ? details.onmessage : null,
      onerror: typeof details.onerror === 'function' ? details.onerror : null,
      onclose: typeof details.onclose === 'function' ? details.onclose : null,
      get url() { return String(details.url || ''); },
      get readyState() { return entry.readyState; },
      get protocol() { return entry.protocol || ''; },
      get extensions() { return entry.extensions || ''; },
      addEventListener(type, listener) {
        if (listeners[type] && typeof listener === 'function') listeners[type].add(listener);
      },
      removeEventListener(type, listener) {
        if (listeners[type]) listeners[type].delete(listener);
      },
      dispatchEvent(event) {
        if (!event || !listeners[event.type]) return false;
        for (const listener of Array.from(listeners[event.type])) {
          try { listener.call(handle, event); } catch (_e) {}
        }
        return true;
      },
      send(payload) {
        if (!entry.requestId || entry.readyState !== 1 || entry.closed) {
          _dispatchLocalWebSocketError(entry, 'WebSocket is not open');
          return false;
        }
        (async () => {
          const encoded = await _serializeWebSocketPayload(payload);
          const response = await sendToBackground('GM_webSocket_send', {
            scriptId,
            requestId: entry.requestId,
            payload: encoded,
          });
          if (response && response.error) _dispatchLocalWebSocketError(entry, response.error);
        })().catch(error => _dispatchLocalWebSocketError(entry, error?.message || 'WebSocket send failed'));
        return true;
      },
      close(code, reason) {
        if (entry.closed) return;
        entry.readyState = 2;
        if (entry.requestId) {
          sendToBackground('GM_webSocket_close', {
            scriptId,
            requestId: entry.requestId,
            code,
            reason,
          }).catch(() => {});
        } else {
          entry.closed = true;
          entry.readyState = 3;
          _webSocketHandles.delete(localId);
        }
      },
      abort() {
        handle.close(1000, 'aborted');
      },
    };

    entry.handle = handle;
    _webSocketHandles.set(localId, entry);

    if (!hasGrant('GM_webSocket') && !hasGrant('GM.webSocket')) {
      entry.readyState = 3;
      entry.closed = true;
      _dispatchLocalWebSocketError(entry, 'Permission denied');
      _webSocketHandles.delete(localId);
      return handle;
    }

    sendToBackground('GM_webSocket', {
      scriptId,
      url: details.url,
      protocols: details.protocols,
      binaryType: handle.binaryType,
    }).then(response => {
      if (!response || response.error) {
        entry.readyState = 3;
        entry.closed = true;
        _dispatchLocalWebSocketError(entry, response?.error || 'WebSocket connection failed');
        _webSocketHandles.delete(localId);
        return;
      }
      if (response.requestId) {
        entry.requestId = response.requestId;
        _webSocketHandles.set(response.requestId, entry);
        _webSocketHandles.delete(localId);
      }
    }).catch(error => {
      entry.readyState = 3;
      entry.closed = true;
      _dispatchLocalWebSocketError(entry, error?.message || 'WebSocket connection failed');
      _webSocketHandles.delete(localId);
    });

    return handle;
  }

  GM_webSocket.CONNECTING = 0;
  GM_webSocket.OPEN = 1;
  GM_webSocket.CLOSING = 2;
  GM_webSocket.CLOSED = 3;

  function _gmFetchAbortError() {
    if (typeof DOMException === 'function') return new DOMException('The operation was aborted.', 'AbortError');
    const err = new Error('The operation was aborted.');
    err.name = 'AbortError';
    return err;
  }

  function _gmFetchHeadersToRecord(headers) {
    const out = {};
    if (!headers) return out;
    if (typeof Headers !== 'undefined' && headers instanceof Headers) {
      headers.forEach((value, key) => { out[key] = value; });
      return out;
    }
    if (Array.isArray(headers)) {
      for (const entry of headers) {
        if (Array.isArray(entry) && entry.length >= 2) out[String(entry[0])] = String(entry[1]);
      }
      return out;
    }
    if (typeof headers === 'object') {
      for (const key of Object.keys(headers)) {
        if (headers[key] !== undefined) out[key] = String(headers[key]);
      }
    }
    return out;
  }

  function _gmFetchParseResponseHeaders(raw) {
    const headers = typeof Headers !== 'undefined' ? new Headers() : {};
    if (!raw || typeof raw !== 'string') return headers;
    for (const line of raw.split(/\\r?\\n/)) {
      const idx = line.indexOf(':');
      if (idx <= 0) continue;
      const name = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (!name) continue;
      if (headers instanceof Headers) headers.append(name, value);
      else headers[name] = headers[name] ? headers[name] + ', ' + value : value;
    }
    return headers;
  }

  function _gmFetchBase64ToBytes(data) {
    const binary = atob(data || '');
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function _gmFetchDelay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function _gmFetchSerializeBody(body) {
    if (!body || typeof body === 'string' || body instanceof ArrayBuffer || ArrayBuffer.isView(body)) return body;
    if (typeof body.getReader === 'function') throw new Error('GM.fetch does not support streaming request bodies');
    if (body instanceof URLSearchParams) return body.toString();
    function _ab2b64(buf) {
      const bytes = new Uint8Array(buf), chunk = 8192;
      let s = '';
      for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode(...bytes.subarray(i, i + chunk));
      return btoa(s);
    }
    if (body instanceof Blob || body instanceof File) {
      const buf = await body.arrayBuffer();
      return { __sv_blob__: true, b64: _ab2b64(buf), type: body.type, name: body instanceof File ? body.name : undefined };
    }
    if (body instanceof FormData) {
      const entries = [];
      for (const [name, val] of body.entries()) {
        if (val instanceof Blob || val instanceof File) {
          const buf = await val.arrayBuffer();
          entries.push({ name, b64: _ab2b64(buf), type: val.type, filename: val instanceof File ? val.name : 'blob' });
        } else {
          entries.push({ name, value: val });
        }
      }
      return { __sv_formdata__: true, entries };
    }
    return body;
  }

  function _gmFetchBuildResponse(meta, body, fallbackUrl) {
    const status = Number(meta && meta.status);
    const responseStatus = status >= 200 && status <= 599 ? status : 200;
    const noBodyStatus = responseStatus === 204 || responseStatus === 205 || responseStatus === 304;
    const fetchResponse = new Response(noBodyStatus ? null : body, {
      status: responseStatus,
      statusText: (meta && meta.statusText) || '',
      headers: _gmFetchParseResponseHeaders((meta && meta.responseHeaders) || '')
    });
    try {
      Object.defineProperty(fetchResponse, 'url', { value: (meta && meta.finalUrl) || fallbackUrl, configurable: true });
    } catch (e) {}
    return fetchResponse;
  }

  async function GM_fetch(input, init = {}) {
    if (!hasGrant('GM_fetch') && !hasGrant('GM.fetch') &&
        !hasGrant('GM_xmlhttpRequest') && !hasGrant('GM.xmlHttpRequest')) {
      throw new Error('GM.fetch requires @grant GM.fetch or @grant GM_xmlhttpRequest');
    }
    if (typeof Response !== 'function') {
      throw new Error('GM.fetch requires Response support in this browser context');
    }

    const request = typeof Request !== 'undefined' && input instanceof Request ? input : null;
    const fetchInit = init || {};
    const method = String(fetchInit.method || (request && request.method) || 'GET').toUpperCase();
    const url = request ? request.url : String(input);
    const requestHeaders = request ? _gmFetchHeadersToRecord(request.headers) : {};
    const initHeaders = _gmFetchHeadersToRecord(fetchInit.headers);
    const headers = { ...requestHeaders, ...initHeaders };
    const hasInitBody = Object.prototype.hasOwnProperty.call(fetchInit, 'body');
    let body = hasInitBody ? fetchInit.body : undefined;
    if (!hasInitBody && request && method !== 'GET' && method !== 'HEAD') {
      try {
        body = await request.clone().arrayBuffer();
      } catch (e) {
        body = undefined;
      }
    }

    const signal = fetchInit.signal;
    if (signal && signal.aborted) throw _gmFetchAbortError();

    const requestPayload = {
      method,
      url,
      headers,
      data: body,
      anonymous: (fetchInit.credentials || (request && request.credentials)) === 'omit',
      noCache: fetchInit.cache === 'no-store' || fetchInit.cache === 'reload' || (request && (request.cache === 'no-store' || request.cache === 'reload')),
      redirect: fetchInit.redirect || (request && request.redirect)
    };

    if (typeof ReadableStream === 'function') {
      const serializedBody = await _gmFetchSerializeBody(body);
      let requestId = null;
      let streamController = null;
      let responseSettled = false;
      let streamSettled = false;
      let abortHandler;
      let abortPending = false;

      let resolveResponse;
      let rejectResponse;
      const responsePromise = new Promise((resolve, reject) => {
        resolveResponse = resolve;
        rejectResponse = reject;
      });

      const abortRequest = () => {
        if (streamSettled) return;
        streamSettled = true;
        if (requestId) sendToBackground('GM_xmlhttpRequest_abort', { scriptId, requestId }).catch(() => {});
        else abortPending = true;
        if (!responseSettled) {
          responseSettled = true;
          rejectResponse(_gmFetchAbortError());
        }
        try { streamController?.error?.(_gmFetchAbortError()); } catch (e) {}
      };

      const bodyStream = new ReadableStream({
        start(controller) {
          streamController = controller;
        },
        cancel() {
          abortRequest();
        }
      });

      if (signal && typeof signal.addEventListener === 'function') {
        abortHandler = abortRequest;
        signal.addEventListener('abort', abortHandler, { once: true });
      }

      const cleanupSignal = () => {
        if (signal && abortHandler && typeof signal.removeEventListener === 'function') {
          signal.removeEventListener('abort', abortHandler);
        }
      };

      const settleResponse = (meta) => {
        if (responseSettled) return;
        responseSettled = true;
        resolveResponse(_gmFetchBuildResponse(meta, bodyStream, url));
      };

      const failStream = (error) => {
        streamSettled = true;
        cleanupSignal();
        if (!responseSettled) {
          responseSettled = true;
          rejectResponse(error);
        } else {
          try { streamController?.error?.(error); } catch (e) {}
        }
      };

      const enqueueChunks = (chunks) => {
        if (!Array.isArray(chunks) || !chunks.length || streamSettled) return;
        for (const chunk of chunks) {
          const responseChunk = chunk && chunk.response;
          if (responseChunk && responseChunk.__sv_base64__) {
            streamController.enqueue(_gmFetchBase64ToBytes(responseChunk.data));
          } else if (typeof chunk.responseText === 'string') {
            streamController.enqueue(new TextEncoder().encode(chunk.responseText));
          }
        }
      };

      const started = await sendToBackground('GM_xmlhttpRequest', {
        scriptId,
        ...requestPayload,
        data: serializedBody,
        responseType: 'stream',
        streamEncoding: 'base64'
      });

      if (!started || started.error || !started.requestId) {
        cleanupSignal();
        throw new Error(started?.error || 'GM.fetch failed to start');
      }
      requestId = started.requestId;
      if (abortPending || (signal && signal.aborted)) {
        sendToBackground('GM_xmlhttpRequest_abort', { scriptId, requestId }).catch(() => {});
        return responsePromise;
      }

      (async () => {
        try {
          for (;;) {
            if (signal && signal.aborted) throw _gmFetchAbortError();
            const result = await sendToBackground('GM_xmlhttpRequest_result', {
              scriptId,
              requestId,
              takeStream: true
            });
            if (result?.meta) settleResponse(result.meta);
            enqueueChunks(result?.streamChunks);

            if (result?.done === true) {
              const terminalType = result.type || 'error';
              if (terminalType === 'load') {
                settleResponse(result.meta || result.response || {});
                streamSettled = true;
                cleanupSignal();
                try { streamController.close(); } catch (e) {}
              } else {
                const message = result.error || result.response?.error || 'GM.fetch request failed';
                failStream(new Error(message));
              }
              return;
            }
            await _gmFetchDelay(25);
          }
        } catch (error) {
          failStream((signal && signal.aborted) ? _gmFetchAbortError() : error);
        }
      })();

      return responsePromise;
    }

    const xhrPromise = _GM_xmlhttpRequestPromise({
      method,
      url,
      headers,
      data: body,
      responseType: 'arraybuffer',
      anonymous: (fetchInit.credentials || (request && request.credentials)) === 'omit',
      noCache: fetchInit.cache === 'no-store' || fetchInit.cache === 'reload' || (request && (request.cache === 'no-store' || request.cache === 'reload')),
      redirect: fetchInit.redirect || (request && request.redirect)
    }, { allowFetchGrant: true });

    let abortHandler;
    if (signal && typeof signal.addEventListener === 'function') {
      abortHandler = () => {
        if (typeof xhrPromise.abort === 'function') xhrPromise.abort();
      };
      signal.addEventListener('abort', abortHandler, { once: true });
    }

    let xhrResponse;
    try {
      xhrResponse = await xhrPromise;
    } catch (error) {
      if (signal && signal.aborted) throw _gmFetchAbortError();
      throw error;
    } finally {
      if (signal && abortHandler && typeof signal.removeEventListener === 'function') {
        signal.removeEventListener('abort', abortHandler);
      }
    }

    if (signal && signal.aborted) throw _gmFetchAbortError();
    const status = Number(xhrResponse && xhrResponse.status);
    const responseStatus = status >= 200 && status <= 599 ? status : 200;
    const bodyValue = xhrResponse && xhrResponse.response != null
      ? xhrResponse.response
      : ((xhrResponse && xhrResponse.responseText) || '');
    const fetchResponse = new Response(bodyValue, {
      status: responseStatus,
      statusText: (xhrResponse && xhrResponse.statusText) || '',
      headers: _gmFetchParseResponseHeaders((xhrResponse && xhrResponse.responseHeaders) || '')
    });
    try {
      Object.defineProperty(fetchResponse, 'url', { value: (xhrResponse && xhrResponse.finalUrl) || url, configurable: true });
    } catch (e) {}
    return fetchResponse;
  }

  // GM_head — convenience wrapper for HEAD requests. Mirrors the runtime
  // background.core.js implementation so promoting wrapper-builder.ts to
  // generated runtime output does not regress GM_head, which the install
  // page advertises and the linter known-globals list expects.
  function GM_head(url, callback) {
    if (!hasGrant('GM_xmlhttpRequest') && !hasGrant('GM.xmlHttpRequest')) {
      if (typeof callback === 'function') callback({ error: 'Missing @grant GM_xmlhttpRequest' });
      return;
    }
    GM_xmlhttpRequest({ method: 'HEAD', url, onload: callback, onerror: callback });
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
  // Phase 40.5 — Cap _notifCallbacks at 500 entries with oldest-first
  // eviction so a misbehaving script that fires GM_notification in a loop
  // without listening for ondone can't leak unbounded entries for the
  // lifetime of the host tab. Cleanup paths on actual events are
  // unchanged.
  // Phase 40.14 — Telemetry-free eviction counter. A non-zero count is
  // a smell the DevTools panel can surface as a "this script is leaking
  // GM_notification callbacks" hint.
  const _notifCallbacks = new Map();
  const _NOTIF_CALLBACKS_CAP = 500;
  let _notifCallbacksEvicted = 0;
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
    // Store callbacks (with cap eviction).
    if (_notifCallbacks.size >= _NOTIF_CALLBACKS_CAP) {
      const oldest = _notifCallbacks.keys().next().value;
      if (oldest !== undefined) _notifCallbacks.delete(oldest);
      _notifCallbacksEvicted += 1;
      if (_notifCallbacksEvicted === 1 || _notifCallbacksEvicted % 100 === 0) {
        console.warn('[ScriptVault] GM_notification cap evict — script may be missing ondone handlers. Evicted so far:', _notifCallbacksEvicted);
      }
    }
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
      // Tampermonkey/Violentmonkey parity — when set, Chrome pins the
      // notification until the user explicitly dismisses or acts on it.
      requireInteraction: typeof opts.requireInteraction === 'boolean' ? opts.requireInteraction : undefined,
      hasOnclick: !!opts.onclick,
      hasOndone: !!opts.ondone
    }).catch(() => {});
  }

  // GM_openInTab (with close(), onclose, insert, setParent, incognito).
  // Phase 40.5 + 40.14 — Cap + eviction counter (see _notifCallbacks).
  const _openedTabs = new Map();
  const _OPENED_TABS_CAP = 200;
  let _openedTabsEvicted = 0;
  function GM_openInTab(url, options) {
    if (!hasGrant('GM_openInTab') && !hasGrant('GM.openInTab')) return null;
    const opts = typeof options === 'boolean' ? { active: !options } : (options || {});
    const tabHandle = { closed: false, onclose: null, close: () => {} };

    // Phase 39.13 — TM #2669: blob: URLs are bound to the creating context's
    // blob registry. chrome.tabs.create() in the background SW cannot resolve
    // a blob URL minted by a USER_SCRIPT world. Route blob:, data:, and
    // about: URLs through window.open() in-context to preserve the registry
    // binding. window.open returns a Window we can't message-pass with,
    // so the returned tabHandle keeps its no-op close() and no onclose
    // tracking (Chrome doesn't expose the new tab's id to the page).
    const isLocalOnly = typeof url === 'string' && /^(blob|data|about):/i.test(url);
    if (isLocalOnly) {
      try {
        const win = window.open(url, '_blank', opts.active === false ? 'noopener=yes' : '');
        if (!win) {
          console.warn('[ScriptVault] GM_openInTab(blob:) blocked by pop-up settings — call within a user-gesture handler');
        }
      } catch (e) {
        console.warn('[ScriptVault] GM_openInTab(blob:) failed:', e?.message || e);
      }
      return tabHandle;
    }

    sendToBackground('GM_openInTab', {
      url, scriptId, trackClose: true,
      active: opts.active, insert: opts.insert,
      setParent: opts.setParent, background: opts.background
    }).then(result => {
      if (result && result.tabId) {
        if (_openedTabs.size >= _OPENED_TABS_CAP) {
          const oldest = _openedTabs.keys().next().value;
          if (oldest !== undefined) _openedTabs.delete(oldest);
          _openedTabsEvicted += 1;
          if (_openedTabsEvicted === 1 || _openedTabsEvicted % 100 === 0) {
            console.warn('[ScriptVault] GM_openInTab cap evict — script may be opening tabs without listening for openedTabClosed. Evicted so far:', _openedTabsEvicted);
          }
        }
        _openedTabs.set(result.tabId, tabHandle);
        tabHandle.close = () => {
          sendToBackground('GM_closeTab', { tabId: result.tabId }).catch(() => {});
          tabHandle.closed = true;
        };
      }
    }).catch(() => {});
    return tabHandle;
  }

  // GM_download (with onload, onerror, onprogress, ontimeout callbacks).
  // Phase 40.5 + 40.14 — Cap + eviction counter (see _notifCallbacks).
  const _downloadCallbacks = new Map();
  const _DOWNLOAD_CALLBACKS_CAP = 200;
  let _downloadCallbacksEvicted = 0;
  function _isDownloadBlobSource(value) {
    return typeof Blob !== 'undefined' && value instanceof Blob;
  }
  function _downloadNameFromUrl(url) {
    if (typeof url !== 'string' || !url) return '';
    try {
      const parsed = new URL(url, location.href);
      if (parsed.protocol === 'data:' || parsed.protocol === 'blob:') return '';
      const last = parsed.pathname.split('/').filter(Boolean).pop();
      return last ? decodeURIComponent(last) : '';
    } catch (e) {
      return url.split(/[?#]/)[0].split('/').filter(Boolean).pop() || '';
    }
  }
  function _safeDownloadMimeType(type) {
    const value = typeof type === 'string' ? type.trim() : '';
    const slash = value.indexOf('/');
    return value
      && slash > 0
      && slash < value.length - 1
      && !value.includes(String.fromCharCode(13))
      && !value.includes(String.fromCharCode(10))
      && !value.includes(',')
      ? value
      : 'application/octet-stream';
  }
  async function _downloadBlobToDataUrl(blob) {
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const chunk = 32768;
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(offset, offset + chunk));
    }
    const type = _safeDownloadMimeType(blob.type);
    return 'data:' + type + ';base64,' + btoa(binary);
  }
  async function _normalizeDownloadDetails(details, nameArg) {
    if (_isDownloadBlobSource(details)) {
      const sourceName = (typeof File !== 'undefined' && details instanceof File) ? details.name : '';
      return {
        url: await _downloadBlobToDataUrl(details),
        name: nameArg || sourceName || 'download',
        sourceName
      };
    }
    const opts = typeof details === 'string'
      ? { url: details, name: nameArg || _downloadNameFromUrl(details) }
      : { ...details };
    if (_isDownloadBlobSource(opts.url)) {
      const blob = opts.url;
      const sourceName = (typeof File !== 'undefined' && blob instanceof File) ? blob.name : '';
      opts.url = await _downloadBlobToDataUrl(blob);
      opts.sourceName = opts.sourceName || sourceName;
      opts.name = opts.name || nameArg || sourceName || 'download';
    } else if (!opts.name) {
      opts.name = nameArg || _downloadNameFromUrl(opts.url) || 'download';
    }
    return opts;
  }
  function GM_download(details) {
    if (!hasGrant('GM_download') && !hasGrant('GM.download')) return;
    const nameArg = arguments[1];
    const callbacks = {
      onload: details && typeof details === 'object' ? details.onload : undefined,
      onerror: details && typeof details === 'object' ? details.onerror : undefined,
      onprogress: details && typeof details === 'object' ? details.onprogress : undefined,
      ontimeout: details && typeof details === 'object' ? details.ontimeout : undefined
    };
    (async () => {
      const opts = await _normalizeDownloadDetails(details, nameArg);
      delete opts.onload; delete opts.onerror;
      delete opts.onprogress; delete opts.ontimeout;
      opts.scriptId = scriptId;
      opts.hasCallbacks = !!(callbacks.onload || callbacks.onerror || callbacks.onprogress || callbacks.ontimeout);
      const result = await sendToBackground('GM_download', opts);
      if (result && result.downloadId && opts.hasCallbacks) {
        if (_downloadCallbacks.size >= _DOWNLOAD_CALLBACKS_CAP) {
          const oldest = _downloadCallbacks.keys().next().value;
          if (oldest !== undefined) _downloadCallbacks.delete(oldest);
          _downloadCallbacksEvicted += 1;
          if (_downloadCallbacksEvicted === 1 || _downloadCallbacksEvicted % 100 === 0) {
            console.warn('[ScriptVault] GM_download cap evict — script may be missing onload/onerror handlers. Evicted so far:', _downloadCallbacksEvicted);
          }
        }
        _downloadCallbacks.set(result.downloadId, callbacks);
      }
      if (result && result.error && callbacks.onerror) {
        try { callbacks.onerror({ error: result.error }); } catch(e) {}
      }
    })().catch(e => {
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
  const _urlAttrs = new Set(['href', 'src', 'action', 'formaction', 'poster', 'cite', 'background', 'xlink:href', 'data']);
  function _isUnsafeElementAttribute(name, value) {
    const lowerName = String(name || '').trim().toLowerCase();
    if (!lowerName || lowerName.startsWith('on')) return true;
    if (lowerName === 'srcdoc') return true;
    if (!_urlAttrs.has(lowerName)) return false;
    const normalizedValue = String(value ?? '').replace(/[\\u0000-\\u0020\\u007f\\ufffd]+/g, '').toLowerCase();
    return /^(javascript|vbscript|data|blob|file):/.test(normalizedValue);
  }

  function GM_addElement(parentOrTag, tagOrAttrs, attrsOrUndefined) {
    if (!hasGrant('GM_addElement') && !hasGrant('GM.addElement')) return null;
    // Phase 38.1 — VM v2.37.0 + TM 5.5.6237 contract: return null on any
    // failure (missing tag, createElement throws, missing/detached parent,
    // appendChild throws). Never throw out of GM_addElement.
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
    if (typeof tag !== 'string' || !tag) return null;
    let el;
    try { el = document.createElement(tag); } catch { return null; }
    if (!el) return null;
    // Reject arrays — Object.entries(array) returns numeric-index pairs that
    // would silently create attributes like 0="value". TM/VM contract says
    // attrs is an object map, never an array.
    if (attrs && typeof attrs === 'object' && !Array.isArray(attrs)) {
      try {
        Object.entries(attrs).forEach(([k, v]) => {
          if (k === 'textContent') el.textContent = v;
          else if (k === 'innerHTML') {
            const temp = document.createElement('template');
            temp.innerHTML = v;
            temp.content.querySelectorAll('script').forEach(s => s.remove());
            temp.content.querySelectorAll('*').forEach(node => {
              for (const attr of [...node.attributes]) {
                if (_isUnsafeElementAttribute(attr.name, attr.value)) {
                  node.removeAttribute(attr.name);
                }
              }
            });
            el.innerHTML = temp.innerHTML;
          }
          else if (!_isUnsafeElementAttribute(k, v)) {
            try { el.setAttribute(k, v); } catch { /* ignore invalid attribute names */ }
          }
        });
      } catch { /* attribute errors do not abort; the appendChild guard below
                   still produces null if the element cannot be attached. */ }
    }
    if (!parent || typeof parent.appendChild !== 'function') return null;
    try { parent.appendChild(el); } catch { return null; }
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
    const result = await sendToBackground('GM_loadScript', { scriptId, url, timeout: options.timeout });
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
      sendToBackground('GM_cookie_list', { ...(details || {}), scriptId }).then(r => {
        if (callback) callback(r.cookies || [], r.error ? new Error(r.error) : undefined);
      }).catch(e => { if (callback) callback([], e); });
    },
    set: (details, callback) => {
      if (!hasGrant('GM_cookie') && !hasGrant('GM.cookie')) {
        if (callback) callback(new Error('Permission denied'));
        return;
      }
      sendToBackground('GM_cookie_set', { ...(details || {}), scriptId }).then(r => {
        if (callback) callback(r.error ? new Error(r.error) : undefined);
      }).catch(e => { if (callback) callback(e); });
    },
    delete: (details, callback) => {
      if (!hasGrant('GM_cookie') && !hasGrant('GM.cookie')) {
        if (callback) callback(new Error('Permission denied'));
        return;
      }
      sendToBackground('GM_cookie_delete', { ...(details || {}), scriptId }).then(r => {
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
    addElement: (...args) => Promise.resolve(GM_addElement(...args)),
    xmlHttpRequest: (d) => _GM_xmlhttpRequestPromise(d),
    fetch: GM_fetch,
    notification: (d, ondone) => Promise.resolve(GM_notification(d, ondone)),
    setClipboard: (t, type) => Promise.resolve(GM_setClipboard(t, type)),
    openInTab: (u, o) => Promise.resolve(GM_openInTab(u, o)),
    focusTab: () => Promise.resolve(GM_focusTab()),
    download: (d) => Promise.resolve(GM_download(d)),
    head: (url, callback) => Promise.resolve(GM_head(url, callback)),
    log: (...args) => Promise.resolve(GM_log(...args)),
    getResourceText: (n) => GM_getResourceText(n),
    getResourceUrl: (n) => GM_getResourceURL(n),
    registerMenuCommand: (c, cb, o) => Promise.resolve(GM_registerMenuCommand(c, cb, o)),
    unregisterMenuCommand: (id) => Promise.resolve(GM_unregisterMenuCommand(id)),
    getMenuCommands: () => Promise.resolve(GM_getMenuCommands()),
    addValueChangeListener: (k, cb) => Promise.resolve(GM_addValueChangeListener(k, cb)),
    removeValueChangeListener: (id) => Promise.resolve(GM_removeValueChangeListener(id)),
    getTab: () => new Promise(r => GM_getTab(r)),
    saveTab: (t) => Promise.resolve(GM_saveTab(t)),
    getTabs: () => new Promise(r => GM_getTabs(r)),
    loadScript: (url, opts) => GM_loadScript(url, opts),
    webSocket: (url, protocols, opts) => GM_webSocket(url, protocols, opts),
    cookies: {
      list: (d) => new Promise((res, rej) => GM_cookie.list(d, (cookies, err) => err ? rej(err) : res(cookies))),
      set: (d) => new Promise((res, rej) => GM_cookie.set(d, (err) => err ? rej(err) : res())),
      delete: (d) => new Promise((res, rej) => GM_cookie.delete(d, (err) => err ? rej(err) : res()))
    },
    cookie: {
      list: (d) => new Promise((res, rej) => GM_cookie.list(d, (cookies, err) => err ? rej(err) : res(cookies))),
      set: (d) => new Promise((res, rej) => GM_cookie.set(d, (err) => err ? rej(err) : res())),
      delete: (d) => new Promise((res, rej) => GM_cookie.delete(d, (err) => err ? rej(err) : res()))
    },
    webRequest: (rules, listener) => Promise.resolve(GM_webRequest(rules, listener)),
    get audio() {
      return {
        setMute: (details) => new Promise((resolve, reject) => GM_audio.setMute(details, err => err ? reject(err) : resolve())),
        getState: () => new Promise((resolve, reject) => GM_audio.getState((state, err) => err ? reject(err) : resolve(state))),
        addStateChangeListener: (listener) => new Promise((resolve, reject) => GM_audio.addStateChangeListener(listener, err => err ? reject(err) : resolve())),
        removeStateChangeListener: (listener) => new Promise((resolve, reject) => GM_audio.removeStateChangeListener(listener, err => err ? reject(err) : resolve()))
      };
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
  window.GM_fetch = GM_fetch;
  window.GM_head = GM_head;
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
  window.GM_webSocket = GM_webSocket;

  // ========== GM_webRequest (Tampermonkey-compatible, declarativeNetRequest-backed) ==========
  function GM_webRequest(rules, listener) {
    if (!hasGrant('GM_webRequest')) {
      console.warn('[ScriptVault] GM_webRequest requires @grant GM_webRequest');
      return;
    }
    const ruleArray = Array.isArray(rules) ? rules : [rules];
    sendToBackground('GM_webRequest', { scriptId, rules: ruleArray }).catch(e =>
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
  // Tampermonkey-compatible: fires when URL changes via pushState/replaceState/popstate.
  //
  // Page-scoped monkey-patch + shared dispatcher. The history/navigation
  // patch runs once per host page and fan-outs to per-wrapper listeners via a
  // CustomEvent, preventing stacked pushState/replaceState proxy chains when a
  // script is updated and re-registered while the tab stays open.
  if (hasGrant('window.onurlchange')) {
    const _urlChangeHandlers = [];

    function __dispatchUrlChangeToHandlers(detail) {
      _urlChangeHandlers.forEach(fn => { try { fn(detail); } catch(e) {} });
      if (typeof window.onurlchange === 'function') {
        try { window.onurlchange(detail); } catch(e) {}
      }
    }

    // One-time page-level setup. The defineProperty guard survives wrapper
    // closure swaps on re-injection.
    if (!window.__svUrlChangeBound__) {
      try {
        Object.defineProperty(window, '__svUrlChangeBound__', {
          value: true, writable: false, configurable: false, enumerable: false
        });
      } catch (_e) {
        // Property already locked by an earlier ScriptVault wrapper; treat as bound.
      }

      let _lastUrl = location.href;
      let _pendingUrlChangeCheck = false;
      let _lastDispatchedPair = '';
      function __emitUrlChange(newUrl, oldUrl) {
        const pair = oldUrl + '\\n' + newUrl;
        if (pair === _lastDispatchedPair) return;
        _lastDispatchedPair = pair;
        const detail = { url: newUrl, oldUrl };
        window.dispatchEvent(new CustomEvent('__sv_urlchange__', { detail }));
      }
      function __checkUrlChange() {
        const newUrl = location.href;
        if (newUrl !== _lastUrl) {
          const oldUrl = _lastUrl;
          _lastUrl = newUrl;
          __emitUrlChange(newUrl, oldUrl);
        }
      }
      function __scheduleUrlChangeCheck(reason) {
        if (!_pendingUrlChangeCheck) {
          _pendingUrlChangeCheck = true;
          Promise.resolve().then(() => {
            _pendingUrlChangeCheck = false;
            __checkUrlChange();
          });
        }
        const frameCheck = () => __checkUrlChange();
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(frameCheck);
        } else {
          setTimeout(frameCheck, 0);
        }
      }

      // Phase 38.6 — Prefer the Navigation API (Chrome 102+, our min-Chrome
      // 130 so always present here; Firefox port falls through to the polling
      // shim). Catches SPA navigations that don't route through pushState /
      // replaceState (e.g. direct location.href assignment + render-frame
      // routers).
      const _nav = (typeof window !== 'undefined') ? window.navigation : undefined;
      if (_nav && typeof _nav.addEventListener === 'function') {
        try {
          _nav.addEventListener('navigate', () => {
            __scheduleUrlChangeCheck('navigate');
          });
        } catch (_e) { /* fall through to polling shim */ }
      }

      // Intercept history API (kept as a backstop for non-Navigation-API
      // browsers and for any SPA library that bypasses navigation.navigate).
      const _origPushState = history.pushState;
      const _origReplaceState = history.replaceState;
      history.pushState = function() {
        _origPushState.apply(this, arguments);
        __scheduleUrlChangeCheck('pushState');
      };
      history.replaceState = function() {
        _origReplaceState.apply(this, arguments);
        __scheduleUrlChangeCheck('replaceState');
      };
      window.addEventListener('popstate', () => __scheduleUrlChangeCheck('popstate'));
      window.addEventListener('hashchange', () => __scheduleUrlChangeCheck('hashchange'));
    }

    const __svUrlChangeListener = (event) => __dispatchUrlChangeToHandlers(event.detail);
    window.addEventListener('__sv_urlchange__', __svUrlChangeListener);

    // Allow adding multiple handlers via addEventListener pattern
    window.addEventListener = new Proxy(window.addEventListener, {
      apply(target, thisArg, args) {
        if (args[0] === 'urlchange') {
          if (!_urlChangeHandlers.includes(args[1])) {
            _urlChangeHandlers.push(args[1]);
          }
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
    if (typeof window.onurlchange === 'undefined') window.onurlchange = null;
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

    function _safeSet(target, prop, value) {
      try {
        Object.defineProperty(target, prop, { configurable: true, writable: true, value });
        return true;
      } catch (e) {
        try {
          target[prop] = value;
          return target[prop] === value;
        } catch (e2) {
          return false;
        }
      }
    }

    // -- fetch --
    const _origFetch = window.fetch;
    if (typeof _origFetch === 'function') {
      _safeSet(window, 'fetch', function __svFetch(input, init) {
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
      });
    }

    // -- XMLHttpRequest --
    const _OrigXHR = window.XMLHttpRequest;
    if (typeof _OrigXHR === 'function') {
      const _WrappedXHR = function __svXHR() {
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
      _WrappedXHR.prototype = _OrigXHR.prototype;
      _safeSet(window, 'XMLHttpRequest', _WrappedXHR);
    }

    // -- WebSocket --
    const _OrigWS = window.WebSocket;
    if (typeof _OrigWS === 'function') {
      const _WrappedWS = function __svWebSocket(url, protocols) {
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
      _WrappedWS.prototype = _OrigWS.prototype;
      Object.assign(_WrappedWS, {
        CONNECTING: _OrigWS.CONNECTING ?? 0,
        OPEN: _OrigWS.OPEN ?? 1,
        CLOSING: _OrigWS.CLOSING ?? 2,
        CLOSED: _OrigWS.CLOSED ?? 3
      });
      _safeSet(window, 'WebSocket', _WrappedWS);
    }

    // -- sendBeacon --
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const _origBeacon = navigator.sendBeacon.bind(navigator);
      _safeSet(navigator, 'sendBeacon', function __svBeacon(url, data) {
        const result = _origBeacon(url, data);
        const size = data ? (typeof data === 'string' ? data.length : (data?.byteLength || data?.size || 0)) : 0;
        _log({ type: 'beacon', method: 'POST', url: String(url), status: result ? 200 : 0, duration: 0, responseSize: size });
        return result;
      });
    }
  })();
  // ========== End Network Proxy ==========

  // GM APIs exposed log disabled for performance
  // console.log('[ScriptVault] GM APIs exposed to window for:', meta.name);

  // ============ @require Scripts ============
  // These run after GM APIs are available on window
  const __svPreRequireGMConfig = window.GM_config;
${requireCode}
${libraryExports}
  const __svRequireGMConfig = (typeof GM_config !== 'undefined' && GM_config !== __svPreRequireGMConfig)
    ? GM_config
    : null;
  window.CAT_userConfig = CAT_userConfig;
  window.GM_config = __svRequireGMConfig || GM_configShim;
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
  let userCode: string = meta['top-level-await']
    ? `(async () => {\n${script.code}\n})();`
    : script.code;

  // @delay: postpone script execution by N milliseconds (legacy alignment)
  const delay = (meta as Partial<ScriptMeta> & { delay?: number }).delay;
  if (typeof delay === 'number' && delay > 0) {
    userCode = `setTimeout(() => {\n${userCode}\n}, ${delay});`;
  }

  // Phase 11.2 — `// @unwrap` (Violentmonkey parity). Emit the script body
  // verbatim without the GM API IIFE wrapper. GM_* APIs are unavailable in
  // this mode; we log a one-line console.warn so authors who set @unwrap by
  // mistake can spot it.
  if (meta.unwrap === true) {
    // JSON.stringify yields a properly-escaped double-quoted JS string.
    // Don't .slice(1, -1) — a name like "John's Script" contains a single
    // quote, which the slice-based form surfaced verbatim into a
    // single-quoted host string and broke the wrapper's syntax. The full
    // JSON-quoted form is a valid JS string literal that concatenates
    // cleanly inside the console.warn() call.
    const nameLit = JSON.stringify(meta.name || 'Unnamed');
    const banner = `console.warn('[ScriptVault] ' + ${nameLit} + ': @unwrap is set — GM_* APIs are unavailable.');`;
    if (scheduleGuard) {
      // @unwrap has no runner function to `return` from, so wrap the raw body
      // in a guard IIFE that only runs it inside the schedule window.
      return `${banner}\n${scheduleGuard}\n(function(){ if(!__svScheduleOk())return;\n${userCode}\n})();`;
    }
    return banner + '\n' + userCode;
  }

  // Schedule guard: a time/day/dateRange schedule gates page-load execution to
  // its window. Runs before @delay/@top-level-await scheduling so an
  // out-of-window load never queues the body.
  if (scheduleGuard) {
    userCode = `${scheduleGuard}\nif(!__svScheduleOk())return;\n${userCode}`;
  }

  return apiInit + userCode + apiClose;
}
