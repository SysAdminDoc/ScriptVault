// ============================================================================
// Generated from src/background/host-permission-patterns.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const HostPermissionPatterns = (() => {
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

  // src/background/host-permission-patterns.ts
  var host_permission_patterns_exports = {};
  __export(host_permission_patterns_exports, {
    OPTIONAL_HOST_PERMISSION_PATTERNS: () => OPTIONAL_HOST_PERMISSION_PATTERNS,
    deriveOptionalHostPermissionPlan: () => deriveOptionalHostPermissionPlan,
    runtimeHostPermissionPatternForUrl: () => runtimeHostPermissionPatternForUrl
  });
  module.exports = __toCommonJS(host_permission_patterns_exports);
  var OPTIONAL_HOST_PERMISSION_PATTERNS = ["http://*/*", "https://*/*"];
  var RECOVERABLE_HOST_SCHEMES = /* @__PURE__ */ new Set(["http:", "https:"]);
  var OPTIONAL_HOST_SCHEMES = /* @__PURE__ */ new Set(["http", "https"]);
  function emptyPattern(reason) {
    return {
      supported: false,
      pattern: "",
      origin: "",
      scheme: "",
      host: "",
      reason
    };
  }
  function normalizeHostForPattern(hostname) {
    const host = String(hostname || "").trim().toLowerCase();
    if (!host) return "";
    if (host.includes(":") && !host.startsWith("[")) return `[${host}]`;
    return host;
  }
  function runtimeHostPermissionPatternForUrl(rawUrl) {
    let url;
    try {
      url = rawUrl instanceof URL ? rawUrl : new URL(String(rawUrl || ""));
    } catch {
      return emptyPattern("invalid-url");
    }
    if (!RECOVERABLE_HOST_SCHEMES.has(url.protocol)) {
      return emptyPattern("unsupported-scheme");
    }
    const host = normalizeHostForPattern(url.hostname);
    if (!host) return emptyPattern("missing-host");
    return {
      supported: true,
      pattern: `${url.protocol}//${host}/*`,
      origin: url.origin,
      scheme: url.protocol.slice(0, -1),
      host,
      reason: ""
    };
  }
  function unique(values) {
    return [...new Set(values.filter(Boolean))].sort();
  }
  function addOptionalOrigin(target, scheme, host) {
    const cleanScheme = String(scheme || "").replace(/:$/, "").toLowerCase();
    const cleanHost = String(host || "").trim().toLowerCase().replace(/:(\d{1,5})$/, "");
    if (!OPTIONAL_HOST_SCHEMES.has(cleanScheme) || !cleanHost) return;
    target.add(`${cleanScheme}://${cleanHost}/*`);
  }
  function addBroadOrigin(target, scheme) {
    const cleanScheme = String(scheme || "").replace(/:$/, "").toLowerCase();
    if (cleanScheme === "*") {
      target.add("http://*/*");
      target.add("https://*/*");
    } else if (OPTIONAL_HOST_SCHEMES.has(cleanScheme)) {
      target.add(`${cleanScheme}://*/*`);
    }
  }
  function addMatchPattern(pattern, origins, broadOrigins, unsupported) {
    const raw = String(pattern || "").trim();
    if (!raw) return;
    if (raw === "<all_urls>" || raw === "*://*/*") {
      broadOrigins.add("http://*/*");
      broadOrigins.add("https://*/*");
      return;
    }
    const match = raw.match(/^(\*|https?|file|ftp):\/\/([^/]+)(?:\/.*)?$/i);
    if (!match) {
      unsupported.add(raw);
      return;
    }
    const scheme = String(match[1] || "").toLowerCase();
    const host = String(match[2] || "").toLowerCase();
    if (scheme === "file" || scheme === "ftp") {
      unsupported.add(raw);
      return;
    }
    if (host === "*") {
      addBroadOrigin(broadOrigins, scheme);
      return;
    }
    if (scheme === "*") {
      addOptionalOrigin(origins, "http", host);
      addOptionalOrigin(origins, "https", host);
      return;
    }
    addOptionalOrigin(origins, scheme, host);
  }
  function addUrlOrigin(rawUrl, origins, unsupported) {
    const raw = String(rawUrl || "").trim();
    if (!raw) return;
    try {
      const parsed = new URL(raw);
      if (!RECOVERABLE_HOST_SCHEMES.has(parsed.protocol)) {
        unsupported.add(raw);
        return;
      }
      const host = normalizeHostForPattern(parsed.hostname);
      if (!host) {
        unsupported.add(raw);
        return;
      }
      addOptionalOrigin(origins, parsed.protocol, host);
    } catch {
      unsupported.add(raw);
    }
  }
  function addConnectPattern(pattern, origins, broadOrigins, unsupported) {
    const raw = String(pattern || "").trim();
    if (!raw || raw === "self") return;
    if (raw === "*" || raw === "<all_urls>" || raw === "*://*/*") {
      broadOrigins.add("http://*/*");
      broadOrigins.add("https://*/*");
      return;
    }
    if (/^(?:\*|https?):\/\//i.test(raw)) {
      addMatchPattern(raw.endsWith("/*") || raw.includes("/", raw.indexOf("://") + 3) ? raw : `${raw}/*`, origins, broadOrigins, unsupported);
      return;
    }
    const host = raw.replace(/^(\*\.)?/, "$1").replace(/\/.*$/, "").toLowerCase();
    if (!host || /[\s?#]/.test(host)) {
      unsupported.add(raw);
      return;
    }
    addOptionalOrigin(origins, "http", host);
    addOptionalOrigin(origins, "https", host);
  }
  function arrayValues(value) {
    return Array.isArray(value) ? value : value ? [value] : [];
  }
  function deriveOptionalHostPermissionPlan(meta, options = {}) {
    const origins = /* @__PURE__ */ new Set();
    const broadOrigins = /* @__PURE__ */ new Set();
    const unsupported = /* @__PURE__ */ new Set();
    const scriptMeta = meta || {};
    for (const pattern of arrayValues(scriptMeta.match)) addMatchPattern(pattern, origins, broadOrigins, unsupported);
    for (const pattern of arrayValues(scriptMeta.include)) addMatchPattern(pattern, origins, broadOrigins, unsupported);
    for (const pattern of arrayValues(scriptMeta.matchTop)) addMatchPattern(pattern, origins, broadOrigins, unsupported);
    for (const pattern of arrayValues(scriptMeta.connect)) addConnectPattern(pattern, origins, broadOrigins, unsupported);
    for (const url of arrayValues(scriptMeta.require)) addUrlOrigin(url, origins, unsupported);
    for (const url of Object.values(scriptMeta.resource && typeof scriptMeta.resource === "object" ? scriptMeta.resource : {})) {
      addUrlOrigin(url, origins, unsupported);
    }
    addUrlOrigin(scriptMeta.updateURL, origins, unsupported);
    addUrlOrigin(scriptMeta.downloadURL, origins, unsupported);
    if (options.allowBroad) {
      for (const origin of broadOrigins) origins.add(origin);
    }
    return {
      origins: unique([...origins]),
      broadOrigins: unique([...broadOrigins]),
      unsupported: unique([...unsupported]),
      requiresBroadHostAccess: broadOrigins.size > 0
    };
  }
  return module.exports.default || module.exports.HostPermissionPatterns || module.exports;
})();
