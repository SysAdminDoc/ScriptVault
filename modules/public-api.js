// ============================================================================
// Generated from src/modules/public-api.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const PublicAPI = (() => {
  const module = { exports: {} };
  const exports = module.exports;
  "use strict";
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/modules/public-api.ts
  var public_api_exports = {};
  __export(public_api_exports, {
    PublicAPI: () => PublicAPI,
    default: () => public_api_default
  });
  module.exports = __toCommonJS(public_api_exports);
  var API_VERSION = "1.0.0";
  var STORAGE_KEY_PERMS = "publicapi_permissions";
  var STORAGE_KEY_AUDIT = "publicapi_audit";
  var STORAGE_KEY_WEBHOOKS = "publicapi_webhooks";
  var STORAGE_KEY_ORIGINS = "publicapi_trusted_origins";
  var MAX_AUDIT_ENTRIES = 500;
  var RATE_LIMIT_WINDOW = 1e3;
  var RATE_LIMIT_MAX = 10;
  var RATE_LIMIT_SENDER_CAP = 200;
  var MAX_TRUSTED_ORIGINS = 128;
  var MAX_TRUSTED_ORIGIN_LENGTH = 256;
  var _permissions = null;
  var _auditLog = [];
  var _webhooks = {};
  var _trustedOrigins = [];
  var _initialized = false;
  var _initPromise = null;
  var _rateLimitMap = /* @__PURE__ */ new Map();
  var MAX_CODE_SIZE = 5 * 1024 * 1024;
  var MAX_FETCH_SIZE = 5 * 1024 * 1024;
  var FETCH_TIMEOUT_MS = 15e3;
  var WEBHOOK_TIMEOUT_MS = 1e4;
  var SCRIPT_SIZE_ERROR = "Script file exceeds maximum allowed size (5 MB)";
  function getRuntimeHooks() {
    return globalThis;
  }
  function isInternalIPv4(ip) {
    const parts = ip.split(".").map((part) => parseInt(part, 10));
    if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part) || part < 0 || part > 255)) {
      return true;
    }
    const [a, b, c, d] = parts;
    if (a === 0) return true;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 255 && b === 255 && c === 255 && d === 255) return true;
    return false;
  }
  function isInternalHost(rawHost) {
    if (!rawHost || typeof rawHost !== "string") return true;
    let host = rawHost.toLowerCase();
    if (host.startsWith("[") && host.endsWith("]")) host = host.slice(1, -1);
    if (host === "localhost" || host === "localhost.localdomain" || host === "ip6-localhost" || host === "ip6-loopback") {
      return true;
    }
    if (host.includes(":")) {
      if (host === "::1" || host === "::" || host === "::0" || host === "0:0:0:0:0:0:0:0" || host === "0:0:0:0:0:0:0:1") {
        return true;
      }
      if (/^fe[89ab][0-9a-f]?:/.test(host)) return true;
      if (/^f[cd][0-9a-f]{0,2}:/.test(host)) return true;
      const v4Mapped = host.match(/^::ffff:([0-9.]+)$/);
      return v4Mapped ? isInternalIPv4(v4Mapped[1]) : false;
    }
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
      return isInternalIPv4(host);
    }
    return false;
  }
  function normalizeTrustedOrigin(origin) {
    if (typeof origin !== "string") throw new Error("Trusted origin must be a string");
    const trimmed = origin.trim();
    if (!trimmed) throw new Error("Trusted origin cannot be empty");
    if (trimmed === "*") throw new Error("Wildcard trusted origins are not allowed");
    if (trimmed.length > MAX_TRUSTED_ORIGIN_LENGTH) throw new Error("Trusted origin is too long");
    let parsed;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new Error("Trusted origin is malformed");
    }
    if (parsed.protocol !== "https:") {
      throw new Error("Trusted origin must use https://");
    }
    if (!parsed.hostname || isInternalHost(parsed.hostname)) {
      throw new Error("Trusted origin points at an internal/loopback host");
    }
    return parsed.origin;
  }
  function normalizeTrustedOrigins(origins) {
    if (!Array.isArray(origins)) return [];
    if (origins.length > MAX_TRUSTED_ORIGINS) {
      throw new Error(`Too many trusted origins; maximum is ${MAX_TRUSTED_ORIGINS}`);
    }
    const normalized = [];
    const seen = /* @__PURE__ */ new Set();
    for (const origin of origins) {
      const value = normalizeTrustedOrigin(origin);
      if (!seen.has(value)) {
        seen.add(value);
        normalized.push(value);
      }
    }
    return normalized;
  }
  function normalizeStoredTrustedOrigins(origins) {
    if (!Array.isArray(origins)) return [];
    const normalized = [];
    const seen = /* @__PURE__ */ new Set();
    for (const origin of origins.slice(0, MAX_TRUSTED_ORIGINS)) {
      try {
        const value = normalizeTrustedOrigin(origin);
        if (!seen.has(value)) {
          seen.add(value);
          normalized.push(value);
        }
      } catch {
      }
    }
    return normalized;
  }
  function normalizeIncomingOrigin(origin) {
    try {
      return normalizeTrustedOrigin(origin);
    } catch {
      return null;
    }
  }
  function validateWebInstallUrl(url) {
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return "Invalid URL";
    }
    if (parsedUrl.protocol !== "https:") {
      return "Only https:// URLs are allowed for script installation";
    }
    if (isInternalHost(parsedUrl.hostname)) {
      return "Internal URLs are not allowed";
    }
    return null;
  }
  function isInternalWebhookUrl(url) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return "malformed URL";
    }
    const host = parsed.hostname || "";
    if (!host) return "empty hostname";
    if (!isInternalHost(host)) return null;
    if (host === "localhost" || host.endsWith(".localdomain")) return "localhost alias";
    if (host.includes(":")) return "IPv6 loopback/internal";
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return "IPv4 private/loopback/CGNAT";
    return "internal host";
  }
  function generateExternalScriptId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `ext_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
  function measuredUtf8Length(text) {
    return new TextEncoder().encode(text).byteLength;
  }
  async function readResponseTextBounded(resp, maxBytes) {
    const contentLength = resp.headers?.get?.("content-length");
    if (contentLength) {
      const declaredBytes = Number.parseInt(contentLength, 10);
      if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
        throw new Error(SCRIPT_SIZE_ERROR);
      }
    }
    const body = resp.body;
    if (body && typeof body.getReader === "function") {
      const reader = body.getReader();
      const chunks = [];
      let totalBytes = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value) continue;
          const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
          totalBytes += chunk.byteLength;
          if (totalBytes > maxBytes) {
            try {
              await reader.cancel();
            } catch {
            }
            throw new Error(SCRIPT_SIZE_ERROR);
          }
          chunks.push(chunk);
        }
      } finally {
        try {
          reader.releaseLock();
        } catch {
        }
      }
      const decoder = new TextDecoder();
      let text2 = "";
      for (let i = 0; i < chunks.length; i++) {
        text2 += decoder.decode(chunks[i], { stream: i < chunks.length - 1 });
      }
      text2 += decoder.decode();
      return text2;
    }
    const text = await resp.text();
    if (measuredUtf8Length(text) > maxBytes) {
      throw new Error(SCRIPT_SIZE_ERROR);
    }
    return text;
  }
  var ARRAY_META_KEYS = {
    match: "match",
    include: "include",
    exclude: "exclude",
    "exclude-match": "excludeMatch",
    grant: "grant",
    require: "require",
    connect: "connect",
    tag: "tag",
    compatible: "compatible",
    incompatible: "incompatible",
    antifeature: "antifeature"
  };
  var BOOLEAN_META_KEYS = /* @__PURE__ */ new Set(["noframes", "unwrap", "top-level-await"]);
  function appendMetaValue(meta, key, value) {
    const current = meta[key];
    if (Array.isArray(current)) {
      current.push(value);
    } else {
      meta[key] = [value];
    }
  }
  var DEFAULT_PERMISSIONS = {
    ping: "allow",
    getVersion: "allow",
    getAPISchema: "allow",
    getInstalledScripts: "allow",
    getScriptStatus: "allow",
    toggleScript: "prompt",
    installScript: "prompt"
  };
  var API_SCHEMA = {
    version: API_VERSION,
    endpoints: {
      ping: {
        description: "Health check. Returns { ok: true, version }.",
        params: null,
        auth: "none",
        rateLimit: true
      },
      getVersion: {
        description: "Return the ScriptVault version string.",
        params: null,
        auth: "none",
        rateLimit: true
      },
      getInstalledScripts: {
        description: "List all installed scripts with name, version, and enabled status.",
        params: null,
        auth: "basic",
        rateLimit: true
      },
      getScriptStatus: {
        description: "Get detailed status for a single script.",
        params: { scriptId: "string \u2014 the script ID" },
        auth: "basic",
        rateLimit: true
      },
      toggleScript: {
        description: "Enable or disable a script. Requires user approval.",
        params: { scriptId: "string", enabled: "boolean" },
        auth: "prompt",
        rateLimit: true
      },
      installScript: {
        description: "Install a new userscript. Requires user approval.",
        params: { code: "string \u2014 full userscript source" },
        auth: "prompt",
        rateLimit: true
      },
      getAPISchema: {
        description: "Return the full API schema (this document).",
        params: null,
        auth: "none",
        rateLimit: false
      }
    },
    webPageEndpoints: {
      "scriptvault:getScripts": {
        description: "Returns list of scripts matching the current page.",
        params: null
      },
      "scriptvault:isInstalled": {
        description: "Check if a script by name is installed.",
        params: { name: "string" }
      },
      "scriptvault:install": {
        description: "Trigger install flow for a script URL.",
        params: { url: "string" }
      }
    },
    webhookEvents: ["script.installed", "script.updated", "script.error", "script.toggled"]
  };
  async function loadState() {
    try {
      const result = await chrome.storage.local.get([
        STORAGE_KEY_PERMS,
        STORAGE_KEY_AUDIT,
        STORAGE_KEY_WEBHOOKS,
        STORAGE_KEY_ORIGINS
      ]);
      _permissions = {
        ...DEFAULT_PERMISSIONS,
        ...result[STORAGE_KEY_PERMS] ?? {}
      };
      _auditLog = result[STORAGE_KEY_AUDIT] ?? [];
      _webhooks = result[STORAGE_KEY_WEBHOOKS] ?? {};
      _trustedOrigins = normalizeStoredTrustedOrigins(result[STORAGE_KEY_ORIGINS]);
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
      console.warn("[PublicAPI] save permissions failed:", e);
    }
  }
  async function saveAuditLog() {
    try {
      if (_auditLog.length > MAX_AUDIT_ENTRIES) {
        _auditLog = _auditLog.slice(-MAX_AUDIT_ENTRIES);
      }
      await chrome.storage.local.set({ [STORAGE_KEY_AUDIT]: _auditLog });
    } catch (e) {
      console.warn("[PublicAPI] save audit failed:", e);
    }
  }
  async function saveWebhooks() {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY_WEBHOOKS]: _webhooks });
    } catch (e) {
      console.warn("[PublicAPI] save webhooks failed:", e);
    }
  }
  async function saveTrustedOrigins() {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY_ORIGINS]: _trustedOrigins });
    } catch (e) {
      console.warn("[PublicAPI] save origins failed:", e);
    }
  }
  function audit(action, sender, details, result) {
    const entry = {
      timestamp: Date.now(),
      action,
      sender: describeSender(sender),
      details: details ?? null,
      result: result || "ok"
    };
    _auditLog.push(entry);
    void saveAuditLog();
    return entry;
  }
  function describeSender(sender) {
    if (!sender) return "unknown";
    if (sender.id) return `extension:${sender.id}`;
    if (sender.origin) return `origin:${sender.origin}`;
    if (sender.url) return `url:${sender.url}`;
    return "unknown";
  }
  function checkRateLimit(senderId) {
    const now = Date.now();
    let timestamps = _rateLimitMap.get(senderId);
    if (!timestamps) {
      timestamps = [];
      _rateLimitMap.set(senderId, timestamps);
    }
    const cutoff = now - RATE_LIMIT_WINDOW;
    while (timestamps.length > 0 && (timestamps[0] ?? 0) < cutoff) {
      timestamps.shift();
    }
    if (timestamps.length >= RATE_LIMIT_MAX) {
      return false;
    }
    timestamps.push(now);
    if (_rateLimitMap.size > RATE_LIMIT_SENDER_CAP) {
      for (const [key, values] of _rateLimitMap) {
        if (values.length === 0 || (values[values.length - 1] ?? 0) < cutoff) {
          _rateLimitMap.delete(key);
        }
      }
    }
    return true;
  }
  function getPermission(apiName) {
    return _permissions?.[apiName] ?? "deny";
  }
  async function requestUserApproval(apiName, sender, _details) {
    try {
      if (chrome.notifications) {
        const notifId = `sv-api-approval-${Date.now()}`;
        await chrome.notifications.create(notifId, {
          type: "basic",
          iconUrl: chrome.runtime.getURL("images/icon128.png"),
          title: "ScriptVault API Request",
          message: `External request: ${apiName} from ${describeSender(sender)}. Pre-approve via settings to allow.`,
          priority: 2
        });
      }
    } catch {
    }
    return false;
  }
  async function authorize(apiName, sender) {
    const perm = getPermission(apiName);
    if (perm === "allow") return true;
    if (perm === "deny") return false;
    if (perm === "prompt") {
      return requestUserApproval(apiName, sender);
    }
    return false;
  }
  async function getScripts() {
    try {
      const store = await getScriptStore();
      return store.scripts;
    } catch {
      return [];
    }
  }
  async function getScriptById(scriptId) {
    const scripts = await getScripts();
    return scripts.find((s) => s.id === scriptId || s.name === scriptId) ?? null;
  }
  function asStringArray(value) {
    return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
  }
  function asNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : void 0;
  }
  function getMetaString(meta, existingMeta, key, fallback = "") {
    const value = meta[key] ?? existingMeta[key];
    return typeof value === "string" ? value : fallback;
  }
  function getMetaArray(meta, existingMeta, key) {
    if (key === "tag") {
      const fromSource = asStringArray(meta[key]);
      const fromExisting = asStringArray(existingMeta[key]);
      if (fromSource.length === 0) return fromExisting;
      const seen = /* @__PURE__ */ new Set();
      const merged = [];
      for (const t of fromSource) {
        if (!seen.has(t)) {
          seen.add(t);
          merged.push(t);
        }
      }
      for (const t of fromExisting) {
        if (!seen.has(t)) {
          seen.add(t);
          merged.push(t);
        }
      }
      return merged;
    }
    return asStringArray(meta[key] ?? existingMeta[key]);
  }
  function getMetaBoolean(meta, existingMeta, key) {
    const value = meta[key] ?? existingMeta[key];
    return value === true;
  }
  function normalizeStoredScript(raw) {
    if (!raw || typeof raw !== "object") return null;
    const script = raw;
    const meta = script.meta && typeof script.meta === "object" ? script.meta : null;
    const id = typeof script.id === "string" ? script.id : "";
    if (!id) return null;
    const matches = asStringArray(script.matches ?? script.match ?? meta?.match ?? meta?.include);
    const runAt = typeof script.runAt === "string" ? script.runAt : typeof meta?.["run-at"] === "string" ? String(meta["run-at"]).replace(/-/g, "_") : "document_idle";
    return {
      id,
      name: typeof script.name === "string" ? script.name : typeof meta?.name === "string" ? String(meta.name) : id,
      version: typeof script.version === "string" ? script.version : typeof meta?.version === "string" ? String(meta.version) : "1.0",
      description: typeof script.description === "string" ? script.description : typeof meta?.description === "string" ? String(meta.description) : "",
      enabled: script.enabled !== false,
      matches,
      match: matches,
      code: typeof script.code === "string" ? script.code : void 0,
      lastModified: asNumber(script.lastModified) ?? asNumber(script.updatedAt),
      runAt,
      installedAt: asNumber(script.installedAt) ?? asNumber(script.createdAt),
      installedBy: typeof script.installedBy === "string" ? script.installedBy : void 0,
      updatedAt: asNumber(script.updatedAt)
    };
  }
  async function getScriptStore() {
    const result = await chrome.storage.local.get("userscripts");
    const raw = result["userscripts"];
    if (Array.isArray(raw)) {
      return {
        mode: "array",
        raw,
        scripts: raw.map(normalizeStoredScript).filter((script) => script !== null)
      };
    }
    if (raw && typeof raw === "object") {
      const record = raw;
      return {
        mode: "record",
        raw: record,
        scripts: Object.values(record).map(normalizeStoredScript).filter((script) => script !== null)
      };
    }
    return {
      mode: "record",
      raw: {},
      scripts: []
    };
  }
  function findArrayScriptIndex(scripts, scriptId) {
    return scripts.findIndex((script) => script.id === scriptId || script.name === scriptId);
  }
  function findRecordScriptEntry(record, scriptId) {
    for (const [key, value] of Object.entries(record)) {
      const normalized = normalizeStoredScript(value);
      if (normalized && (normalized.id === scriptId || normalized.name === scriptId) && value && typeof value === "object") {
        return { key, value };
      }
    }
    return null;
  }
  function createNestedStoredScript(newScript, meta, installedBy, position, existing = null) {
    const existingRecord = existing ?? {};
    const existingMeta = existingRecord.meta && typeof existingRecord.meta === "object" ? existingRecord.meta : {};
    const matches = asStringArray(newScript.matches ?? newScript.match ?? meta.match ?? ["*://*/*"]);
    const resources = meta.resource && typeof meta.resource === "object" ? meta.resource : existingMeta.resource && typeof existingMeta.resource === "object" ? existingMeta.resource : {};
    return {
      ...existingRecord,
      id: newScript.id,
      code: newScript.code ?? (typeof existingRecord.code === "string" ? existingRecord.code : ""),
      enabled: newScript.enabled !== false,
      position: asNumber(existingRecord.position) ?? position,
      meta: {
        ...existingMeta,
        name: newScript.name ?? newScript.id,
        namespace: getMetaString(meta, existingMeta, "namespace"),
        version: newScript.version ?? "1.0",
        description: newScript.description ?? "",
        author: getMetaString(meta, existingMeta, "author"),
        icon: getMetaString(meta, existingMeta, "icon"),
        icon64: getMetaString(meta, existingMeta, "icon64"),
        homepage: getMetaString(meta, existingMeta, "homepage"),
        homepageURL: getMetaString(meta, existingMeta, "homepageURL"),
        website: getMetaString(meta, existingMeta, "website"),
        source: getMetaString(meta, existingMeta, "source"),
        updateURL: getMetaString(meta, existingMeta, "updateURL"),
        downloadURL: getMetaString(meta, existingMeta, "downloadURL"),
        supportURL: getMetaString(meta, existingMeta, "supportURL"),
        license: getMetaString(meta, existingMeta, "license"),
        copyright: getMetaString(meta, existingMeta, "copyright"),
        contributionURL: getMetaString(meta, existingMeta, "contributionURL"),
        match: matches.length > 0 ? matches : ["*://*/*"],
        include: getMetaArray(meta, existingMeta, "include"),
        exclude: getMetaArray(meta, existingMeta, "exclude"),
        excludeMatch: getMetaArray(meta, existingMeta, "excludeMatch"),
        "run-at": (newScript.runAt ?? meta.runAt ?? "document_idle").replace(/_/g, "-"),
        "inject-into": getMetaString(meta, existingMeta, "inject-into", "auto") || "auto",
        noframes: getMetaBoolean(meta, existingMeta, "noframes"),
        unwrap: getMetaBoolean(meta, existingMeta, "unwrap"),
        sandbox: getMetaString(meta, existingMeta, "sandbox"),
        "run-in": getMetaString(meta, existingMeta, "run-in"),
        grant: (() => {
          const grants = getMetaArray(meta, existingMeta, "grant");
          return grants.length > 0 ? grants : ["none"];
        })(),
        require: getMetaArray(meta, existingMeta, "require"),
        resource: resources,
        connect: getMetaArray(meta, existingMeta, "connect"),
        "top-level-await": getMetaBoolean(meta, existingMeta, "top-level-await"),
        webRequest: existingMeta.webRequest ?? null,
        priority: asNumber(existingMeta.priority) ?? 0,
        antifeature: getMetaArray(meta, existingMeta, "antifeature"),
        tag: getMetaArray(meta, existingMeta, "tag"),
        compatible: getMetaArray(meta, existingMeta, "compatible"),
        incompatible: getMetaArray(meta, existingMeta, "incompatible")
      },
      settings: existingRecord.settings && typeof existingRecord.settings === "object" ? existingRecord.settings : {},
      stats: existingRecord.stats && typeof existingRecord.stats === "object" ? existingRecord.stats : { runs: 0, totalTime: 0, avgTime: 0, lastRun: 0, errors: 0 },
      versionHistory: Array.isArray(existingRecord.versionHistory) ? existingRecord.versionHistory : [],
      createdAt: asNumber(existingRecord.createdAt) ?? newScript.installedAt ?? Date.now(),
      updatedAt: newScript.updatedAt ?? Date.now(),
      installedBy
    };
  }
  function upsertScriptStore(store, newScript, meta, installedBy) {
    if (store.mode === "array") {
      const scripts = Array.isArray(store.raw) ? [...store.raw] : [];
      const idx = findArrayScriptIndex(scripts, newScript.id);
      if (idx !== -1) {
        scripts[idx] = { ...scripts[idx], ...newScript, updatedAt: Date.now(), installedBy };
      } else {
        scripts.push({ ...newScript, installedBy });
      }
      return scripts;
    }
    const record = !Array.isArray(store.raw) ? { ...store.raw } : {};
    const existing = findRecordScriptEntry(record, newScript.id);
    const key = existing?.key ?? newScript.id;
    const position = existing ? asNumber(existing.value.position) ?? store.scripts.length : store.scripts.length;
    record[key] = createNestedStoredScript(newScript, meta, installedBy, position, existing?.value ?? null);
    return record;
  }
  function toRuntimeScriptShape(script, meta) {
    return {
      ...script,
      meta: {
        ...meta,
        name: script.name ?? meta.name ?? script.id,
        version: script.version ?? meta.version ?? "1.0",
        description: script.description ?? meta.description ?? "",
        match: Array.isArray(meta.match) && meta.match.length > 0 ? [...meta.match] : ["*://*/*"],
        include: Array.isArray(meta.include) ? [...meta.include] : [],
        exclude: Array.isArray(meta.exclude) ? [...meta.exclude] : [],
        excludeMatch: Array.isArray(meta.excludeMatch) ? [...meta.excludeMatch] : [],
        grant: Array.isArray(meta.grant) && meta.grant.length > 0 ? [...meta.grant] : ["none"],
        require: Array.isArray(meta.require) ? [...meta.require] : [],
        resource: meta.resource ?? {},
        connect: Array.isArray(meta.connect) ? [...meta.connect] : [],
        "run-at": script.runAt ?? meta.runAt ?? "document_idle"
      },
      settings: {}
    };
  }
  async function refreshRuntimeAfterMutation(script, meta = {}) {
    const hooks = getRuntimeHooks();
    if (typeof hooks.registerAllScripts === "function") {
      try {
        await hooks.registerAllScripts();
      } catch (e) {
        console.warn("[PublicAPI] Failed to refresh registered scripts:", e);
      }
    }
    if (typeof hooks.updateBadge === "function") {
      try {
        await hooks.updateBadge();
      } catch (e) {
        console.warn("[PublicAPI] Failed to refresh badge state:", e);
      }
    }
    if (script && typeof hooks.autoReloadMatchingTabs === "function") {
      try {
        await hooks.autoReloadMatchingTabs(toRuntimeScriptShape(script, meta));
      } catch (e) {
        console.warn("[PublicAPI] Failed to auto-reload matching tabs:", e);
      }
    }
  }
  async function getExtensionVersion() {
    try {
      const manifest = chrome.runtime.getManifest();
      return manifest.version || "0.0.0";
    } catch {
      return "0.0.0";
    }
  }
  var HANDLERS = {
    async ping(_msg, _sender) {
      return { ok: true, version: await getExtensionVersion(), api: API_VERSION };
    },
    async getVersion(_msg, _sender) {
      return { version: await getExtensionVersion(), api: API_VERSION };
    },
    async getInstalledScripts(_msg, _sender) {
      const scripts = await getScripts();
      return {
        scripts: scripts.map((s) => ({
          id: s.id,
          name: s.name ?? s.id,
          version: s.version ?? "1.0",
          enabled: s.enabled !== false,
          matchUrls: s.matches ?? s.match ?? []
        }))
      };
    },
    async getScriptStatus(msg, _sender) {
      const scriptId = msg.scriptId ?? msg.id;
      if (!scriptId) return { error: "Missing scriptId parameter" };
      const script = await getScriptById(scriptId);
      if (!script) return { error: "Script not found", scriptId };
      return {
        id: script.id,
        name: script.name ?? script.id,
        version: script.version ?? "1.0",
        enabled: script.enabled !== false,
        matches: script.matches ?? script.match ?? [],
        lastModified: script.lastModified ?? null,
        runAt: script.runAt ?? "document_idle"
      };
    },
    async toggleScript(msg, sender) {
      const scriptId = msg.scriptId ?? msg.id;
      const enabled = !!msg.enabled;
      if (!scriptId) return { error: "Missing scriptId parameter" };
      const allowed = await authorize("toggleScript", sender);
      if (!allowed) return { error: "Permission denied", action: "toggleScript" };
      try {
        const script = await ScriptStorage.get(scriptId);
        if (!script) {
          return { error: "Script not found", scriptId };
        }
        await ScriptStorage.set(scriptId, { ...script, enabled, updatedAt: Date.now() });
        await refreshRuntimeAfterMutation();
        void fireWebhook("script.toggled", { scriptId, enabled });
        return { ok: true, scriptId, enabled };
      } catch (e) {
        return { error: "Failed to toggle script", detail: e.message };
      }
    },
    async installScript(msg, sender) {
      const code = msg.code;
      if (!code || typeof code !== "string") return { error: "Missing or invalid code parameter" };
      if (code.length > MAX_CODE_SIZE) return { error: "Script code exceeds maximum allowed size (5 MB)" };
      if (!code.includes("==UserScript==")) return { error: "Not a valid userscript (missing ==UserScript== header)" };
      const allowed = await authorize("installScript", sender);
      if (!allowed) return { error: "Permission denied", action: "installScript" };
      try {
        const meta = parseUserscriptMeta(code);
        const scriptId = generateExternalScriptId();
        const newScript = {
          id: scriptId,
          name: meta.name ?? scriptId,
          version: meta.version ?? "1.0",
          description: meta.description ?? "",
          matches: meta.match ?? ["*://*/*"],
          code,
          enabled: true,
          installedAt: Date.now(),
          installedBy: describeSender(sender),
          runAt: meta.runAt ?? "document_idle"
        };
        const store = await getScriptStore();
        const updatedStore = upsertScriptStore(store, newScript, meta, describeSender(sender));
        if (Array.isArray(updatedStore)) {
          await ScriptStorage.set(newScript.id, createNestedStoredScript(
            newScript,
            meta,
            describeSender(sender),
            store.scripts.length,
            null
          ));
        } else {
          const entry = updatedStore[newScript.id] ?? Object.values(updatedStore).find((v) => {
            const n = normalizeStoredScript(v);
            return n?.id === newScript.id;
          });
          if (entry) {
            await ScriptStorage.set(newScript.id, entry);
          }
        }
        await refreshRuntimeAfterMutation(newScript, meta);
        void fireWebhook("script.installed", { scriptId, name: newScript.name, version: newScript.version });
        return { ok: true, scriptId, name: newScript.name };
      } catch (e) {
        return { error: "Failed to install script", detail: e.message };
      }
    },
    async getAPISchema(_msg, _sender) {
      return { schema: API_SCHEMA };
    }
  };
  function parseUserscriptMeta(code) {
    const meta = {};
    const headerMatch = code.match(/\/\/\s*==UserScript==([\s\S]*?)\/\/\s*==\/UserScript==/);
    if (!headerMatch?.[1]) return meta;
    const lines = headerMatch[1].split("\n");
    for (const line of lines) {
      const m = line.match(/\/\/\s*@(\S+)(?:\s+(.*))?/);
      if (!m?.[1]) continue;
      const key = m[1].trim();
      const val = (m[2] || "").trim();
      if (BOOLEAN_META_KEYS.has(key)) {
        meta[key] = true;
      } else if (ARRAY_META_KEYS[key]) {
        if (val) appendMetaValue(meta, ARRAY_META_KEYS[key], val);
      } else if (key === "resource") {
        const resourceMatch = val.match(/^(\S+)\s+(.+)$/);
        if (resourceMatch?.[1] && resourceMatch[2]) {
          meta.resource = meta.resource ?? {};
          meta.resource[resourceMatch[1]] = resourceMatch[2];
        }
      } else if (key === "run-at") {
        if (val) meta.runAt = val.replace(/-/g, "_");
      } else {
        if (val) meta[key] = val;
      }
    }
    return meta;
  }
  var WEB_HANDLERS = {
    "scriptvault:getScripts": async (_data, _origin) => {
      const scripts = await getScripts();
      return {
        type: "scriptvault:getScripts:response",
        scripts: scripts.map((s) => ({
          name: s.name ?? s.id,
          version: s.version ?? "1.0",
          enabled: s.enabled !== false
        }))
      };
    },
    "scriptvault:isInstalled": async (data, _origin) => {
      const name = data.name;
      if (!name) return { type: "scriptvault:isInstalled:response", error: "Missing name" };
      const scripts = await getScripts();
      const found = scripts.find(
        (s) => (s.name ?? "").toLowerCase() === name.toLowerCase() || (s.id ?? "").toLowerCase() === name.toLowerCase()
      );
      return {
        type: "scriptvault:isInstalled:response",
        installed: !!found,
        name,
        version: found ? found.version ?? "1.0" : null
      };
    },
    "scriptvault:install": async (data, origin) => {
      const url = data.url;
      if (!url || typeof url !== "string") {
        return { type: "scriptvault:install:response", error: "Missing or invalid url" };
      }
      const urlError = validateWebInstallUrl(url);
      if (urlError) {
        return { type: "scriptvault:install:response", error: urlError };
      }
      const allowed = await authorize("installScript", { origin });
      if (!allowed) {
        return { type: "scriptvault:install:response", error: "Permission denied", action: "installScript" };
      }
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        let code = "";
        try {
          const resp = await fetch(url, { signal: controller.signal });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          if (resp.url) {
            const finalUrlError = validateWebInstallUrl(resp.url);
            if (finalUrlError) throw new Error(finalUrlError);
          }
          code = await readResponseTextBounded(resp, MAX_FETCH_SIZE);
        } finally {
          clearTimeout(timeoutId);
        }
        if (!code.includes("==UserScript==")) {
          throw new Error("Not a valid userscript (missing ==UserScript== header)");
        }
        const meta = parseUserscriptMeta(code);
        const scriptId = generateExternalScriptId();
        const newScript = {
          id: scriptId,
          name: meta.name ?? scriptId,
          version: meta.version ?? "1.0",
          description: meta.description ?? "",
          matches: meta.match ?? ["*://*/*"],
          code,
          enabled: true,
          installedAt: Date.now(),
          installedBy: `origin:${origin}`,
          runAt: meta.runAt ?? "document_idle"
        };
        const store = await getScriptStore();
        const updatedStore = upsertScriptStore(store, newScript, meta, `origin:${origin}`);
        if (Array.isArray(updatedStore)) {
          await ScriptStorage.set(newScript.id, createNestedStoredScript(
            newScript,
            meta,
            `origin:${origin}`,
            store.scripts.length,
            null
          ));
        } else {
          const entry = updatedStore[newScript.id] ?? Object.values(updatedStore).find((v) => {
            const n = normalizeStoredScript(v);
            return n?.id === newScript.id;
          });
          if (entry) {
            await ScriptStorage.set(newScript.id, entry);
          }
        }
        await refreshRuntimeAfterMutation(newScript, meta);
        void fireWebhook("script.installed", { scriptId, name: newScript.name, version: newScript.version });
        return { type: "scriptvault:install:response", ok: true, scriptId, name: newScript.name };
      } catch (e) {
        return { type: "scriptvault:install:response", error: "Fetch failed", detail: e.message };
      }
    }
  };
  async function fireWebhook(eventType, payload) {
    const hook = _webhooks[eventType];
    if (!hook?.enabled || !hook.url) return;
    const guardReason = isInternalWebhookUrl(hook.url);
    if (guardReason) {
      console.warn(`[PublicAPI] webhook ${eventType} blocked at fire time: ${guardReason}`);
      return;
    }
    let body;
    try {
      body = JSON.stringify({
        event: eventType,
        timestamp: Date.now(),
        version: API_VERSION,
        data: payload
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.warn(`[PublicAPI] webhook ${eventType} payload serialization failed:`, message);
      return;
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
    try {
      await fetch(hook.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: controller.signal
      });
    } catch (e) {
      console.warn(`[PublicAPI] webhook ${eventType} failed:`, e);
    } finally {
      clearTimeout(timeoutId);
    }
  }
  async function dispatchExternal(message, sender) {
    const action = message?.action;
    if (!action || typeof action !== "string") {
      return { error: "Missing action field" };
    }
    const handler = HANDLERS[action];
    if (!handler) {
      return { error: `Unknown action: ${action}`, availableActions: Object.keys(HANDLERS) };
    }
    const senderId = describeSender(sender);
    const endpoint = API_SCHEMA.endpoints[action];
    if (endpoint?.rateLimit !== false) {
      if (!checkRateLimit(senderId)) {
        audit(action, sender, null, "rate_limited");
        return { error: "Rate limited. Max 10 requests per second." };
      }
    }
    const perm = getPermission(action);
    if (perm === "deny") {
      audit(action, sender, null, "denied");
      return { error: "Permission denied", action };
    }
    try {
      const result = await handler(message, sender);
      audit(action, sender, message, result?.["error"] ? "error" : "ok");
      return result;
    } catch (e) {
      audit(action, sender, message, "exception");
      console.warn("[PublicAPI] external handler exception:", action, e);
      return { error: "Internal error" };
    }
  }
  function dispatchWebMessage(event) {
    const origin = normalizeIncomingOrigin(event.origin);
    if (_trustedOrigins.length === 0 || !origin || !_trustedOrigins.includes(origin)) {
      return;
    }
    const data = event.data;
    if (!data || typeof data !== "object" || !("type" in data)) return;
    const msg = data;
    if (typeof msg.type !== "string") return;
    if (!msg.type.startsWith("scriptvault:")) return;
    const senderId = `web:${origin}`;
    if (!checkRateLimit(senderId)) {
      return;
    }
    const handler = WEB_HANDLERS[msg.type];
    if (!handler) return;
    audit(msg.type, { origin }, msg, "processing");
    handler(msg, origin).then((response) => {
      if (response && event.source) {
        try {
          event.source.postMessage(
            response,
            origin
          );
        } catch {
        }
      }
    }).catch((e) => {
      console.warn("[PublicAPI] web handler error:", e);
    });
  }
  function onExternalMessage(message, sender, sendResponse) {
    void dispatchExternal(message, sender).then((result) => {
      try {
        sendResponse(result);
      } catch {
      }
    });
    return true;
  }
  var PublicAPI = {
    /**
     * Initialize the Public API: load state, register listeners.
     * Safe for service workers (no DOM).
     * Concurrent callers share one init promise to prevent double-registration.
     */
    async init() {
      if (_initialized) return;
      if (!_initPromise) {
        _initPromise = (async () => {
          try {
            await loadState();
            if (chrome.runtime.onMessageExternal) {
              chrome.runtime.onMessageExternal.addListener(onExternalMessage);
            }
            if (typeof self !== "undefined" && typeof self.addEventListener === "function") {
              self.addEventListener("message", dispatchWebMessage);
            }
            _initialized = true;
            console.log("[PublicAPI] initialized, version", API_VERSION);
          } catch (err) {
            _initPromise = null;
            throw err;
          }
        })();
      }
      return _initPromise;
    },
    /**
     * Handle an external message manually (if not using auto-listener).
     */
    async handleExternalMessage(message, sender) {
      if (!_initialized) await this.init();
      return dispatchExternal(message, sender);
    },
    /**
     * Handle a web page message event manually.
     */
    handleWebMessage(event) {
      dispatchWebMessage(event);
    },
    /**
     * Return the full API schema.
     */
    getAPISchema() {
      return { ...API_SCHEMA };
    },
    /**
     * Return the audit log (most recent entries).
     */
    getAuditLog(limit = 50) {
      const start = Math.max(0, _auditLog.length - limit);
      return _auditLog.slice(start);
    },
    /**
     * Set permissions for API actions.
     */
    async setPermissions(perms) {
      if (!_permissions) await loadState();
      for (const [key, val] of Object.entries(perms)) {
        if (["allow", "deny", "prompt"].includes(val)) {
          _permissions[key] = val;
        }
      }
      await savePermissions();
    },
    getPermissions() {
      return { ..._permissions || DEFAULT_PERMISSIONS };
    },
    /**
     * Set trusted web page origins.
     */
    async setTrustedOrigins(origins) {
      _trustedOrigins = normalizeTrustedOrigins(origins);
      await saveTrustedOrigins();
    },
    /**
     * Get trusted web page origins.
     */
    getTrustedOrigins() {
      return _trustedOrigins.slice();
    },
    /**
     * Configure a webhook for an event type.
     */
    async setWebhook(eventType, config) {
      if (!API_SCHEMA.webhookEvents.includes(eventType)) {
        throw new Error(`Unknown event type: ${eventType}`);
      }
      const url = config.url ?? "";
      if (url) {
        if (!url.startsWith("https://")) {
          throw new Error("Webhook URL must use https://");
        }
        const reason = isInternalWebhookUrl(url);
        if (reason) {
          throw new Error("Webhook URL points at internal/loopback host: " + reason);
        }
      }
      _webhooks[eventType] = {
        url,
        enabled: !!config.enabled
      };
      await saveWebhooks();
    },
    /**
     * Get all configured webhooks.
     */
    getWebhooks() {
      return { ..._webhooks };
    },
    /**
     * Fire a webhook event programmatically (used by other modules).
     */
    async fireEvent(eventType, payload) {
      audit("fireEvent", { id: "internal" }, { eventType, payload }, "ok");
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
  var public_api_default = PublicAPI;
  return module.exports.default || module.exports.PublicAPI || module.exports;
})();
