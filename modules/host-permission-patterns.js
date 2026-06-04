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
    runtimeHostPermissionPatternForUrl: () => runtimeHostPermissionPatternForUrl
  });
  module.exports = __toCommonJS(host_permission_patterns_exports);
  var RECOVERABLE_HOST_SCHEMES = /* @__PURE__ */ new Set(["http:", "https:"]);
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
  return module.exports.default || module.exports.HostPermissionPatterns || module.exports;
})();
