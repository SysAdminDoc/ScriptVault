// ScriptVault — Public Extension API
// Allows other extensions and web pages to interact with ScriptVault.
// Designed for service worker (no DOM dependencies).

const PublicAPI = (() => {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  Constants                                                          */
  /* ------------------------------------------------------------------ */

  const API_VERSION = '1.0.0';
  const STORAGE_KEY_PERMS = 'publicapi_permissions';
  const STORAGE_KEY_AUDIT = 'publicapi_audit';
  const STORAGE_KEY_WEBHOOKS = 'publicapi_webhooks';
  const STORAGE_KEY_ORIGINS = 'publicapi_trusted_origins';
  const MAX_AUDIT_ENTRIES = 500;
  const RATE_LIMIT_WINDOW = 1000; // ms
  const RATE_LIMIT_MAX = 10;      // requests per window

  /* ------------------------------------------------------------------ */
  /*  State                                                              */
  /* ------------------------------------------------------------------ */

  let _permissions = null;    // { [apiName]: 'allow' | 'deny' | 'prompt' }
  let _auditLog = [];
  let _webhooks = {};         // { [eventType]: { url, enabled } }
  let _trustedOrigins = [];
  let _initialized = false;
  let _rateLimitMap = new Map(); // senderId -> [timestamps]

  /* ------------------------------------------------------------------ */
  /*  Default Permissions                                                */
  /* ------------------------------------------------------------------ */

  const DEFAULT_PERMISSIONS = {
    ping:                'allow',
    getVersion:          'allow',
    getAPISchema:        'allow',
    getInstalledScripts: 'allow',
    getScriptStatus:     'allow',
    toggleScript:        'prompt',
    installScript:       'prompt'
  };

  /* ------------------------------------------------------------------ */
  /*  API Schema (self-documenting)                                      */
  /* ------------------------------------------------------------------ */

  const API_SCHEMA = {
    version: API_VERSION,
    endpoints: {
      ping: {
        description: 'Health check. Returns { ok: true, version }.',
        params: null,
        auth: 'none',
        rateLimit: true
      },
      getVersion: {
        description: 'Return the ScriptVault version string.',
        params: null,
        auth: 'none',
        rateLimit: true
      },
      getInstalledScripts: {
        description: 'List all installed scripts with name, version, and enabled status.',
        params: null,
        auth: 'basic',
        rateLimit: true
      },
      getScriptStatus: {
        description: 'Get detailed status for a single script.',
        params: { scriptId: 'string — the script ID' },
        auth: 'basic',
        rateLimit: true
      },
      toggleScript: {
        description: 'Enable or disable a script. Requires user approval.',
        params: { scriptId: 'string', enabled: 'boolean' },
        auth: 'prompt',
        rateLimit: true
      },
      installScript: {
        description: 'Install a new userscript. Requires user approval.',
        params: { code: 'string — full userscript source' },
        auth: 'prompt',
        rateLimit: true
      },
      getAPISchema: {
        description: 'Return the full API schema (this document).',
        params: null,
        auth: 'none',
        rateLimit: false
      }
    },
    webPageEndpoints: {
      'scriptvault:getScripts': {
        description: 'Returns list of scripts matching the current page.',
        params: null
      },
      'scriptvault:isInstalled': {
        description: 'Check if a script by name is installed.',
        params: { name: 'string' }
      },
      'scriptvault:install': {
        description: 'Trigger install flow for a script URL.',
        params: { url: 'string' }
      }
    },
    webhookEvents: ['script.installed', 'script.updated', 'script.error', 'script.toggled']
  };

  /* ------------------------------------------------------------------ */
  /*  Storage Helpers                                                    */
  /* ------------------------------------------------------------------ */

  async function loadState() {
    try {
      const result = await chrome.storage.local.get([
        STORAGE_KEY_PERMS,
        STORAGE_KEY_AUDIT,
        STORAGE_KEY_WEBHOOKS,
        STORAGE_KEY_ORIGINS
      ]);
      _permissions = { ...DEFAULT_PERMISSIONS, ...(result[STORAGE_KEY_PERMS] || {}) };
      _auditLog = result[STORAGE_KEY_AUDIT] || [];
      _webhooks = result[STORAGE_KEY_WEBHOOKS] || {};
      _trustedOrigins = result[STORAGE_KEY_ORIGINS] || [];
    } catch {
      _permissions = { ...DEFAULT_PERMISSIONS };
      _auditLog = [];
      _webhooks = {};
      _trustedOrigins = [];
    }
  }

  async function savePermissions() {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY_PERMS]: _permissions });
    } catch (e) {
      console.warn('[PublicAPI] save permissions failed:', e);
    }
  }

  async function saveAuditLog() {
    try {
      // Trim to max entries
      if (_auditLog.length > MAX_AUDIT_ENTRIES) {
        _auditLog = _auditLog.slice(-MAX_AUDIT_ENTRIES);
      }
      await chrome.storage.local.set({ [STORAGE_KEY_AUDIT]: _auditLog });
    } catch (e) {
      console.warn('[PublicAPI] save audit failed:', e);
    }
  }

  async function saveWebhooks() {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY_WEBHOOKS]: _webhooks });
    } catch (e) {
      console.warn('[PublicAPI] save webhooks failed:', e);
    }
  }

  async function saveTrustedOrigins() {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY_ORIGINS]: _trustedOrigins });
    } catch (e) {
      console.warn('[PublicAPI] save origins failed:', e);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Audit Logging                                                      */
  /* ------------------------------------------------------------------ */

  function audit(action, sender, details, result) {
    const entry = {
      timestamp: Date.now(),
      action,
      sender: describeSender(sender),
      details: details || null,
      result: result || 'ok'
    };
    _auditLog.push(entry);
    // Async save, don't await in hot path
    saveAuditLog();
    return entry;
  }

  function describeSender(sender) {
    if (!sender) return 'unknown';
    if (sender.id) return `extension:${sender.id}`;
    if (sender.origin) return `origin:${sender.origin}`;
    if (sender.url) return `url:${sender.url}`;
    return 'unknown';
  }

  /* ------------------------------------------------------------------ */
  /*  Rate Limiting                                                      */
  /* ------------------------------------------------------------------ */

  function checkRateLimit(senderId) {
    const now = Date.now();
    let timestamps = _rateLimitMap.get(senderId);

    if (!timestamps) {
      timestamps = [];
      _rateLimitMap.set(senderId, timestamps);
    }

    // Purge old timestamps outside the window
    const cutoff = now - RATE_LIMIT_WINDOW;
    while (timestamps.length > 0 && timestamps[0] < cutoff) {
      timestamps.shift();
    }

    if (timestamps.length >= RATE_LIMIT_MAX) {
      return false; // rate limited
    }

    timestamps.push(now);

    // Evict dead entries to prevent unbounded Map growth
    if (_rateLimitMap.size > 200) {
      for (const [key, ts] of _rateLimitMap) {
        if (ts.length === 0 || ts[ts.length - 1] < cutoff) _rateLimitMap.delete(key);
      }
    }

    return true;
  }

  /* ------------------------------------------------------------------ */
  /*  Permission Checking                                                */
  /* ------------------------------------------------------------------ */

  function getPermission(apiName) {
    return _permissions[apiName] || 'deny';
  }

  async function requestUserApproval(apiName, sender, details) {
    // In a service worker we cannot show DOM prompts.
    // Use chrome.notifications for approval, but for safety we deny by default
    // and require pre-approval via setPermissions().
    // If running in a context with chrome.notifications, send one.
    try {
      if (chrome.notifications) {
        const notifId = `sv-api-approval-${Date.now()}`;
        await chrome.notifications.create(notifId, {
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon128.png'),
          title: 'ScriptVault API Request',
          message: `External request: ${apiName} from ${describeSender(sender)}. Pre-approve via settings to allow.`,
          priority: 2
        });
      }
    } catch { /* notifications not available */ }

    // Default: deny unless explicitly allowed
    return false;
  }

  async function authorize(apiName, sender) {
    const perm = getPermission(apiName);
    if (perm === 'allow') return true;
    if (perm === 'deny') return false;
    if (perm === 'prompt') {
      return requestUserApproval(apiName, sender);
    }
    return false;
  }

  /* ------------------------------------------------------------------ */
  /*  Script Data Access                                                 */
  /* ------------------------------------------------------------------ */

  async function getScripts() {
    try {
      const result = await chrome.storage.local.get('userscripts');
      const data = result.userscripts || {};
      return Array.isArray(data) ? data : Object.values(data);
    } catch {
      return [];
    }
  }

  async function getScriptById(scriptId) {
    const scripts = await getScripts();
    return scripts.find(s => s.id === scriptId || (s.meta?.name || s.name) === scriptId) || null;
  }

  async function getExtensionVersion() {
    try {
      const manifest = chrome.runtime.getManifest();
      return manifest.version || '0.0.0';
    } catch {
      return '0.0.0';
    }
  }

  /* ------------------------------------------------------------------ */
  /*  API Handlers (External Messages)                                   */
  /* ------------------------------------------------------------------ */

  const HANDLERS = {
    async ping(_msg, _sender) {
      return { ok: true, version: await getExtensionVersion(), api: API_VERSION };
    },

    async getVersion(_msg, _sender) {
      return { version: await getExtensionVersion(), api: API_VERSION };
    },

    async getInstalledScripts(_msg, _sender) {
      const scripts = await getScripts();
      return {
        scripts: scripts.map(s => ({
          id: s.id,
          name: s.meta?.name || s.name || s.id,
          version: s.meta?.version || s.version || '1.0',
          enabled: s.enabled !== false,
          matchUrls: s.meta?.match || s.matches || s.match || []
        }))
      };
    },

    async getScriptStatus(msg, _sender) {
      const scriptId = msg.scriptId || msg.id;
      if (!scriptId) return { error: 'Missing scriptId parameter' };

      const script = await getScriptById(scriptId);
      if (!script) return { error: 'Script not found', scriptId };

      return {
        id: script.id,
        name: script.meta?.name || script.name || script.id,
        version: script.meta?.version || script.version || '1.0',
        enabled: script.enabled !== false,
        matches: script.meta?.match || script.matches || [],
        lastModified: script.updatedAt || null,
        runAt: script.meta?.['run-at'] || 'document_idle'
      };
    },

    async toggleScript(msg, sender) {
      const scriptId = msg.scriptId || msg.id;
      const enabled = !!msg.enabled;
      if (!scriptId) return { error: 'Missing scriptId parameter' };

      const allowed = await authorize('toggleScript', sender);
      if (!allowed) return { error: 'Permission denied', action: 'toggleScript' };

      try {
        const result = await chrome.storage.local.get('userscripts');
        const data = result.userscripts || {};
        let found = false;
        if (Array.isArray(data)) {
          const idx = data.findIndex(s => s.id === scriptId || s.meta?.name === scriptId);
          if (idx === -1) return { error: 'Script not found', scriptId };
          data[idx].enabled = enabled;
          found = true;
        } else {
          const entry = Object.entries(data).find(([k, s]) => k === scriptId || s.id === scriptId || s.meta?.name === scriptId);
          if (!entry) return { error: 'Script not found', scriptId };
          data[entry[0]].enabled = enabled;
          found = true;
        }
        if (!found) return { error: 'Script not found', scriptId };
        await chrome.storage.local.set({ userscripts: data });

        fireWebhook('script.toggled', { scriptId, enabled });
        return { ok: true, scriptId, enabled };
      } catch (e) {
        return { error: 'Failed to toggle script', detail: e.message };
      }
    },

    async installScript(msg, sender) {
      const code = msg.code;
      if (!code || typeof code !== 'string') return { error: 'Missing or invalid code parameter' };

      const allowed = await authorize('installScript', sender);
      if (!allowed) return { error: 'Permission denied', action: 'installScript' };

      try {
        // Parse basic userscript metadata
        const meta = parseUserscriptMeta(code);
        const scriptId = meta.name
          ? meta.name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()
          : `ext_${Date.now()}`;

        const newScript = {
          id: scriptId,
          code,
          meta: {
            name: meta.name || scriptId,
            version: meta.version || '1.0',
            description: meta.description || '',
            match: meta.match || ['*://*/*'],
            'run-at': meta.runAt || 'document_idle'
          },
          enabled: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          installedBy: describeSender(sender)
        };

        const result = await chrome.storage.local.get('userscripts');
        const data = result.userscripts || {};

        // Check for duplicate — support both object and array formats
        if (Array.isArray(data)) {
          const existing = data.findIndex(s => s.id === scriptId);
          if (existing !== -1) {
            data[existing] = { ...data[existing], ...newScript, updatedAt: Date.now() };
          } else {
            data.push(newScript);
          }
        } else {
          if (data[scriptId]) {
            data[scriptId] = { ...data[scriptId], ...newScript, updatedAt: Date.now() };
          } else {
            data[scriptId] = newScript;
          }
        }

        await chrome.storage.local.set({ userscripts: data });

        fireWebhook('script.installed', { scriptId, name: newScript.meta.name, version: newScript.meta.version });
        return { ok: true, scriptId, name: newScript.meta.name };
      } catch (e) {
        return { error: 'Failed to install script', detail: e.message };
      }
    },

    async getAPISchema(_msg, _sender) {
      return { schema: API_SCHEMA };
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Userscript Metadata Parser (minimal)                               */
  /* ------------------------------------------------------------------ */

  function parseUserscriptMeta(code) {
    const meta = {};
    const headerMatch = code.match(/\/\/\s*==UserScript==([\s\S]*?)\/\/\s*==\/UserScript==/);
    if (!headerMatch) return meta;

    const lines = headerMatch[1].split('\n');
    for (const line of lines) {
      const m = line.match(/\/\/\s*@(\S+)\s+(.*)/);
      if (!m) continue;
      const key = m[1].trim();
      const val = m[2].trim();

      if (key === 'match' || key === 'include') {
        if (!meta.match) meta.match = [];
        meta.match.push(val);
      } else if (key === 'run-at') {
        meta.runAt = val.replace(/-/g, '_');
      } else {
        meta[key] = val;
      }
    }
    return meta;
  }

  /* ------------------------------------------------------------------ */
  /*  Web Page Message Handlers                                          */
  /* ------------------------------------------------------------------ */

  const WEB_HANDLERS = {
    'scriptvault:getScripts': async (data, origin) => {
      const scripts = await getScripts();
      return {
        type: 'scriptvault:getScripts:response',
        scripts: scripts.map(s => ({
          name: s.name || s.id,
          version: s.version || '1.0',
          enabled: s.enabled !== false
        }))
      };
    },

    'scriptvault:isInstalled': async (data, origin) => {
      const name = data.name;
      if (!name) return { type: 'scriptvault:isInstalled:response', error: 'Missing name' };

      const scripts = await getScripts();
      const found = scripts.find(s =>
        (s.name || '').toLowerCase() === name.toLowerCase() ||
        (s.id || '').toLowerCase() === name.toLowerCase()
      );
      return {
        type: 'scriptvault:isInstalled:response',
        installed: !!found,
        name,
        version: found ? (found.version || '1.0') : null
      };
    },

    'scriptvault:install': async (data, origin) => {
      const url = data.url;
      if (!url || typeof url !== 'string') {
        return { type: 'scriptvault:install:response', error: 'Missing or invalid url' };
      }

      // Authorize before fetching to prevent SSRF
      const allowed = await authorize('installScript', { origin });
      if (!allowed) {
        return { type: 'scriptvault:install:response', error: 'Permission denied', action: 'installScript' };
      }

      // Validate URL - only allow https:// from known userscript hosts
      try {
        const parsedUrl = new URL(url);
        if (parsedUrl.protocol !== 'https:') {
          return { type: 'scriptvault:install:response', error: 'Only HTTPS URLs are allowed' };
        }
        const h = parsedUrl.hostname;
        if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h.startsWith('192.168.') || h.startsWith('10.') || h.startsWith('172.')) {
          return { type: 'scriptvault:install:response', error: 'Internal URLs are not allowed' };
        }
      } catch {
        return { type: 'scriptvault:install:response', error: 'Invalid URL' };
      }

      // Fetch the script only after authorization and URL validation
      try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const code = await resp.text();

        // Parse and install directly (authorization already checked above)
        const meta = parseUserscriptMeta(code);
        const scriptId = meta.name
          ? meta.name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()
          : `ext_${Date.now()}`;

        const newScript = {
          id: scriptId,
          code,
          meta: {
            name: meta.name || scriptId,
            version: meta.version || '1.0',
            description: meta.description || '',
            match: meta.match || ['*://*/*'],
            'run-at': meta.runAt || 'document_idle'
          },
          enabled: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          installedBy: `origin:${origin}`
        };

        const result = await chrome.storage.local.get('userscripts');
        const data = result.userscripts || {};

        if (Array.isArray(data)) {
          const existing = data.findIndex(s => s.id === scriptId);
          if (existing !== -1) {
            data[existing] = { ...data[existing], ...newScript, updatedAt: Date.now() };
          } else {
            data.push(newScript);
          }
        } else {
          if (data[scriptId]) {
            data[scriptId] = { ...data[scriptId], ...newScript, updatedAt: Date.now() };
          } else {
            data[scriptId] = newScript;
          }
        }

        await chrome.storage.local.set({ userscripts: data });

        fireWebhook('script.installed', { scriptId, name: newScript.meta.name, version: newScript.meta.version });
        return { type: 'scriptvault:install:response', ok: true, scriptId, name: newScript.meta.name };
      } catch (e) {
        return { type: 'scriptvault:install:response', error: 'Fetch failed', detail: e.message };
      }
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Webhook Support                                                    */
  /* ------------------------------------------------------------------ */

  async function fireWebhook(eventType, payload) {
    const hook = _webhooks[eventType];
    if (!hook || !hook.enabled || !hook.url) return;

    const body = {
      event: eventType,
      timestamp: Date.now(),
      version: API_VERSION,
      data: payload
    };

    try {
      await fetch(hook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } catch (e) {
      console.warn(`[PublicAPI] webhook ${eventType} failed:`, e);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Message Dispatchers                                                */
  /* ------------------------------------------------------------------ */

  async function dispatchExternal(message, sender) {
    const action = message && message.action;
    if (!action || typeof action !== 'string') {
      return { error: 'Missing action field' };
    }

    const handler = HANDLERS[action];
    if (!handler) {
      return { error: `Unknown action: ${action}`, availableActions: Object.keys(HANDLERS) };
    }

    // Rate limit
    const senderId = describeSender(sender);
    if (API_SCHEMA.endpoints[action]?.rateLimit !== false) {
      if (!checkRateLimit(senderId)) {
        audit(action, sender, null, 'rate_limited');
        return { error: 'Rate limited. Max 10 requests per second.' };
      }
    }

    // Permission check (ping, getVersion, getAPISchema are always allowed)
    const perm = getPermission(action);
    if (perm === 'deny') {
      audit(action, sender, null, 'denied');
      return { error: 'Permission denied', action };
    }

    // Execute
    try {
      const result = await handler(message, sender);
      audit(action, sender, message, result.error ? 'error' : 'ok');
      return result;
    } catch (e) {
      audit(action, sender, message, 'exception');
      return { error: 'Internal error', detail: e.message };
    }
  }

  function dispatchWebMessage(event) {
    // Validate origin — deny-by-default when no trusted origins are configured
    if (_trustedOrigins.length === 0 || (!_trustedOrigins.includes(event.origin) && !_trustedOrigins.includes('*'))) {
      return; // ignore untrusted origins
    }

    const data = event.data;
    if (!data || typeof data !== 'object' || !data.type) return;
    if (!data.type.startsWith('scriptvault:')) return;

    const senderId = `web:${event.origin}`;
    if (!checkRateLimit(senderId)) {
      // Silently drop rate-limited web messages
      return;
    }

    const handler = WEB_HANDLERS[data.type];
    if (!handler) return;

    audit(data.type, { origin: event.origin }, data, 'processing');

    handler(data, event.origin).then(response => {
      if (response && event.source) {
        try {
          event.source.postMessage(response, event.origin === 'null' ? '*' : event.origin);
        } catch { /* cross-origin post failed */ }
      }
    }).catch(e => {
      console.warn('[PublicAPI] web handler error:', e);
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Listener Management                                                */
  /* ------------------------------------------------------------------ */

  function onExternalMessage(message, sender, sendResponse) {
    // chrome.runtime.onMessageExternal is async-capable via sendResponse
    dispatchExternal(message, sender).then(result => {
      try { sendResponse(result); } catch { /* port closed */ }
    });
    return true; // keep message channel open for async response
  }

  /* ------------------------------------------------------------------ */
  /*  Public Interface                                                   */
  /* ------------------------------------------------------------------ */

  return {
    /**
     * Initialize the Public API: load state, register listeners.
     * Safe for service workers (no DOM).
     */
    async init() {
      if (_initialized) return;

      await loadState();

      // Register external message listener
      if (chrome.runtime.onMessageExternal) {
        chrome.runtime.onMessageExternal.addListener(onExternalMessage);
      }

      // Register web page message listener (only in contexts that have window)
      if (typeof self !== 'undefined' && typeof self.addEventListener === 'function') {
        self.addEventListener('message', dispatchWebMessage);
      }

      _initialized = true;
      console.log('[PublicAPI] initialized, version', API_VERSION);
    },

    /**
     * Handle an external message manually (if not using auto-listener).
     * @param {object} message — { action, ...params }
     * @param {object} sender  — chrome sender object
     * @returns {Promise<object>} response
     */
    async handleExternalMessage(message, sender) {
      if (!_initialized) await this.init();
      return dispatchExternal(message, sender);
    },

    /**
     * Handle a web page message event manually.
     * @param {MessageEvent} event
     */
    handleWebMessage(event) {
      dispatchWebMessage(event);
    },

    /**
     * Return the full API schema.
     * @returns {object}
     */
    getAPISchema() {
      return { ...API_SCHEMA };
    },

    /**
     * Return the audit log (most recent entries).
     * @param {number} [limit=50]
     * @returns {Array}
     */
    getAuditLog(limit = 50) {
      const start = Math.max(0, _auditLog.length - limit);
      return _auditLog.slice(start);
    },

    /**
     * Set permissions for API actions.
     * @param {object} perms — { [apiName]: 'allow' | 'deny' | 'prompt' }
     */
    async setPermissions(perms) {
      if (!_permissions) await loadState();
      for (const [key, val] of Object.entries(perms)) {
        if (['allow', 'deny', 'prompt'].includes(val)) {
          _permissions[key] = val;
        }
      }
      await savePermissions();
    },

    /**
     * Get current API action permissions.
     * @returns {object}
     */
    getPermissions() {
      return { ...(_permissions || DEFAULT_PERMISSIONS) };
    },

    /**
     * Set trusted web page origins.
     * @param {string[]} origins — array of origin strings (e.g., 'https://example.com')
     */
    async setTrustedOrigins(origins) {
      _trustedOrigins = Array.isArray(origins) ? origins.slice() : [];
      await saveTrustedOrigins();
    },

    /**
     * Get trusted web page origins.
     * @returns {string[]}
     */
    getTrustedOrigins() {
      return _trustedOrigins.slice();
    },

    /**
     * Configure a webhook for an event type.
     * @param {string} eventType — one of API_SCHEMA.webhookEvents
     * @param {object} config — { url: string, enabled: boolean }
     */
    async setWebhook(eventType, config) {
      if (!API_SCHEMA.webhookEvents.includes(eventType)) {
        throw new Error(`Unknown event type: ${eventType}`);
      }
      const url = config.url || '';
      if (url && !url.startsWith('https://')) {
        throw new Error('Webhook URL must use https://');
      }
      _webhooks[eventType] = {
        url,
        enabled: !!config.enabled
      };
      await saveWebhooks();
    },

    /**
     * Get all configured webhooks.
     * @returns {object}
     */
    getWebhooks() {
      return { ..._webhooks };
    },

    /**
     * Fire a webhook event programmatically (used by other modules).
     * @param {string} eventType
     * @param {object} payload
     */
    async fireEvent(eventType, payload) {
      audit('fireEvent', { id: 'internal' }, { eventType, payload }, 'ok');
      await fireWebhook(eventType, payload);
    },

    /**
     * Clear the audit log.
     */
    async clearAuditLog() {
      _auditLog = [];
      await saveAuditLog();
    }
  };
})();
