import type { Script } from '../types/script';
import { getUnsupportedBackgroundGrants, normalizeBackgroundGrant } from './background-runner';

export interface BackgroundWrapperOptions {
  preloadedStorage?: Record<string, unknown>;
}

const BLOCKED_BACKGROUND_APIS = [
  'GM_addElement',
  'GM_openInTab',
  'GM_registerMenuCommand',
  'GM_unregisterMenuCommand',
  'GM_getTab',
  'GM_saveTab',
  'GM_getTabs',
  'GM_download',
  'GM_cookie',
  'GM_webRequest',
  'GM_addStyle',
  'GM_setClipboard',
];

function extractUserscriptBody(code: string): string {
  return code.replace(/\/\/\s*==UserScript==[\s\S]*?\/\/\s*==\/UserScript==/, '').trimStart();
}

function assertBackgroundWrapperSupported(script: Script): void {
  if (!script.meta?.background) {
    throw new Error('Background wrapper requires @background metadata.');
  }
  if (Array.isArray(script.meta.require) && script.meta.require.length > 0) {
    throw new Error('Background wrapper does not support @require dependencies yet.');
  }
  const unsupported = getUnsupportedBackgroundGrants(script.meta);
  if (unsupported.length > 0) {
    throw new Error(`Background wrapper does not support grants: ${unsupported.join(', ')}`);
  }
}

export function buildBackgroundWrappedScript(script: Script, options: BackgroundWrapperOptions = {}): string {
  assertBackgroundWrapperSupported(script);

  const grants = (Array.isArray(script.meta.grant) && script.meta.grant.length > 0 ? script.meta.grant : ['none'])
    .map((grant) => normalizeBackgroundGrant(String(grant)));
  const body = extractUserscriptBody(script.code);
  const storage = options.preloadedStorage ?? {};
  const meta = {
    name: script.meta.name,
    namespace: script.meta.namespace,
    version: script.meta.version,
    description: script.meta.description,
    grant: grants,
    background: true,
    crontab: script.meta.crontab || '',
  };

  return `
(() => {
  'use strict';

  const __scriptId = ${JSON.stringify(script.id)};
  const __scriptMeta = Object.freeze(${JSON.stringify(meta)});
  const __grants = new Set(${JSON.stringify(grants)});
  const __storage = Object.assign(Object.create(null), ${JSON.stringify(storage)});

  const __blockedGlobal = (name) => new Proxy(Object.create(null), {
    get(_target, prop) {
      throw new Error(name + '.' + String(prop) + ' is unavailable in @background scripts');
    },
    set(_target, prop) {
      throw new Error(name + '.' + String(prop) + ' is unavailable in @background scripts');
    },
    apply() {
      throw new Error(name + ' is unavailable in @background scripts');
    }
  });
  const window = __blockedGlobal('window');
  const document = __blockedGlobal('document');
  const unsafeWindow = __blockedGlobal('unsafeWindow');
  const location = __blockedGlobal('location');
  const localStorage = __blockedGlobal('localStorage');
  const sessionStorage = __blockedGlobal('sessionStorage');
  const navigator = __blockedGlobal('navigator');

  function __hasGrant(...names) {
    return __grants.has('none') || names.some((name) => __grants.has(name));
  }

  function __sendToBackground(action, data) {
    const runtime = globalThis.chrome && globalThis.chrome.runtime;
    if (!runtime || typeof runtime.sendMessage !== 'function') {
      return Promise.reject(new Error('Background runner messaging is unavailable'));
    }
    return Promise.resolve(runtime.sendMessage({
      source: 'scriptvault-background-runner',
      scriptId: __scriptId,
      action,
      data
    }));
  }

  function __blockedApi(name) {
    return function blockedBackgroundApi() {
      throw new Error(name + ' is unavailable in @background scripts');
    };
  }

  const GM_info = Object.freeze({
    scriptHandler: 'ScriptVault',
    script: Object.freeze({ name: __scriptMeta.name, namespace: __scriptMeta.namespace, version: __scriptMeta.version }),
    scriptMeta: __scriptMeta
  });

  function GM_log(...args) {
    console.log('[ScriptVault background]', ...args);
  }

  function GM_getValue(key, defaultValue) {
    return Object.prototype.hasOwnProperty.call(__storage, key) ? __storage[key] : defaultValue;
  }

  function GM_setValue(key, value) {
    __storage[key] = value;
    return __sendToBackground('GM_setValue', { key, value });
  }

  function GM_deleteValue(key) {
    delete __storage[key];
    return __sendToBackground('GM_deleteValue', { key });
  }

  function GM_listValues() {
    return Object.keys(__storage);
  }

  function GM_addValueChangeListener(key, callback) {
    return __sendToBackground('GM_addValueChangeListener', { key }).then((result) => {
      const listenerId = result && result.listenerId ? result.listenerId : result;
      return listenerId;
    });
  }

  function GM_removeValueChangeListener(listenerId) {
    return __sendToBackground('GM_removeValueChangeListener', { listenerId });
  }

  function GM_xmlhttpRequest(details) {
    if (!__hasGrant('GM_xmlhttpRequest')) throw new Error('Missing @grant GM_xmlhttpRequest');
    const request = __sendToBackground('GM_xmlhttpRequest', details || {});
    request.then((response) => {
      if (response && response.error && typeof details?.onerror === 'function') details.onerror(response);
      else if (typeof details?.onload === 'function') details.onload(response);
    }).catch((error) => {
      if (typeof details?.onerror === 'function') details.onerror({ error: error.message || String(error) });
    });
    return {
      abort() {
        request.then((response) => {
          if (response && response.requestId) __sendToBackground('GM_xmlhttpRequest_abort', { requestId: response.requestId }).catch(() => {});
        }).catch(() => {});
      }
    };
  }

  function GM_notification(details, ondone) {
    if (!__hasGrant('GM_notification')) throw new Error('Missing @grant GM_notification');
    return __sendToBackground('GM_notification', details || {}).then((response) => {
      if (typeof ondone === 'function') ondone(response);
      return response;
    });
  }

  ${BLOCKED_BACKGROUND_APIS.map((name) => `const ${name} = __blockedApi(${JSON.stringify(name)});`).join('\n  ')}

  const GM = Object.freeze({
    getValue: (key, defaultValue) => Promise.resolve(GM_getValue(key, defaultValue)),
    setValue: GM_setValue,
    deleteValue: GM_deleteValue,
    listValues: () => Promise.resolve(GM_listValues()),
    addValueChangeListener: GM_addValueChangeListener,
    removeValueChangeListener: GM_removeValueChangeListener,
    xmlHttpRequest: GM_xmlhttpRequest,
    notification: GM_notification,
    info: GM_info,
    log: GM_log
  });

  try {
${body}
  } catch (error) {
    __sendToBackground('backgroundScriptError', {
      message: error && error.message ? error.message : String(error)
    }).catch(() => {});
    throw error;
  }
})();`.trim();
}
