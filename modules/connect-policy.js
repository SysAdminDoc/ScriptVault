// ============================================================================
// Generated from src/background/connect-policy.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const ConnectPolicy = (() => {
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

  // src/background/connect-policy.ts
  var connect_policy_exports = {};
  __export(connect_policy_exports, {
    ConnectPolicy: () => ConnectPolicy,
    default: () => connect_policy_default,
    evaluateConnectPolicy: () => evaluateConnectPolicy,
    evaluateScriptHostScopePolicy: () => evaluateScriptHostScopePolicy,
    getScriptHostScopeInfo: () => getScriptHostScopeInfo,
    hostMatchesConnectPattern: () => hostMatchesConnectPattern,
    isScriptHostScopeAllowed: () => isScriptHostScopeAllowed,
    normalizeConnectHost: () => normalizeConnectHost,
    shouldAllowInternalXhr: () => shouldAllowInternalXhr
  });
  module.exports = __toCommonJS(connect_policy_exports);
  function scopeArray(value) {
    if (!value) return [];
    return Array.isArray(value) ? value.filter(Boolean) : [value];
  }
  function normalizeConnectHost(value) {
    if (typeof value !== "string") return "";
    let pattern = value.trim().toLowerCase();
    if (!pattern) return "";
    if (pattern === "*" || pattern === "self" || pattern === "localhost") return pattern;
    try {
      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(pattern)) {
        pattern = new URL(pattern.replace(/\*/g, "x")).hostname.toLowerCase();
      }
    } catch (_) {
    }
    pattern = pattern.replace(/^\/\//, "");
    for (const delimiter of ["/", "?", "#"]) {
      const delimiterIndex = pattern.indexOf(delimiter);
      if (delimiterIndex >= 0) pattern = pattern.slice(0, delimiterIndex);
    }
    if (pattern.startsWith("*.")) pattern = pattern.slice(2);
    if (pattern.startsWith("x.")) pattern = pattern.slice(2);
    if (pattern.startsWith(".")) pattern = pattern.slice(1);
    const bracketEnd = pattern.indexOf("]");
    if (pattern.startsWith("[") && bracketEnd > 0) {
      pattern = pattern.slice(1, bracketEnd);
    } else {
      const [hostPart = ""] = pattern.split(":");
      pattern = hostPart;
    }
    return pattern;
  }
  function hostMatchesConnectPattern(hostname, pattern) {
    const host = normalizeConnectHost(hostname);
    const target = normalizeConnectHost(pattern);
    if (!host || !target) return false;
    if (target === "localhost") return host === "localhost" || host === "127.0.0.1" || host === "::1";
    return host === target || host.endsWith("." + target);
  }
  function isLocalhostConnectHost(hostname) {
    const host = normalizeConnectHost(hostname);
    if (host === "localhost" || host === "::1") return true;
    const parts = host.split(".");
    const [firstOctet] = parts;
    return parts.length === 4 && typeof firstOctet === "string" && parts.every((part) => /^\d+$/.test(part)) && Number(firstOctet) === 127;
  }
  function hasExplicitLocalhostConnectOptIn(script, requestUrl) {
    let hostname;
    try {
      hostname = new URL(requestUrl).hostname;
    } catch (_) {
      return false;
    }
    if (!isLocalhostConnectHost(hostname)) return false;
    const connectList = Array.isArray(script?.meta?.connect) ? script.meta.connect : [];
    return connectList.some((pattern) => {
      const rawPattern = String(pattern || "").trim();
      const normalized = normalizeConnectHost(rawPattern);
      if (!normalized || normalized === "*" || normalized === "self") return false;
      if (!isLocalhostConnectHost(normalized)) return false;
      return hostMatchesConnectPattern(hostname, normalized);
    });
  }
  function shouldAllowInternalXhr(script, requestUrl, settings, guardResult) {
    if (!guardResult || guardResult.ok) return true;
    if (!["localhost-alias", "ipv4-internal", "ipv6-internal"].includes(String(guardResult.reason || ""))) {
      return false;
    }
    if (settings?.allowInternalXhr === true) return true;
    return hasExplicitLocalhostConnectOptIn(script, requestUrl);
  }
  function getEffectiveScriptScopePatterns(script) {
    const meta = script?.meta || {};
    const settings = script?.settings || {};
    const matches = [];
    const includes = [];
    if (settings.useOriginalMatches !== false) matches.push(...scopeArray(meta.match));
    if (Array.isArray(settings.userMatches)) matches.push(...settings.userMatches.filter(Boolean));
    if (settings.useOriginalIncludes !== false) includes.push(...scopeArray(meta.include));
    if (Array.isArray(settings.userIncludes)) includes.push(...settings.userIncludes.filter(Boolean));
    return { matches, includes };
  }
  function extractHostScopeHost(pattern) {
    if (typeof pattern !== "string") return "";
    const raw = pattern.trim();
    if (!raw) return "";
    if (raw === "*" || raw === "<all_urls>") return "*";
    const match = raw.match(/^(?:\*|https?|file|ftp):\/\/([^/]+)/i);
    if (!match) return "";
    const host = match[1];
    if (!host || host === "*") return "*";
    return normalizeConnectHost(host);
  }
  function getScriptHostScopeInfo(script) {
    const { matches, includes } = getEffectiveScriptScopePatterns(script);
    const hosts = /* @__PURE__ */ new Set();
    let universal = false;
    for (const pattern of [...matches, ...includes]) {
      const host = extractHostScopeHost(String(pattern));
      if (host === "*") {
        universal = true;
        continue;
      }
      if (host) hosts.add(host);
    }
    return { universal, hosts: [...hosts] };
  }
  function isScriptHostScopeAllowed(script, requestUrl) {
    let urlObj;
    try {
      urlObj = new URL(requestUrl);
    } catch (_) {
      return false;
    }
    const scopeInfo = getScriptHostScopeInfo(script);
    if (scopeInfo.universal) return true;
    return scopeInfo.hosts.some((host) => hostMatchesConnectPattern(urlObj.hostname, host));
  }
  function selfConnectDomains(script) {
    return getScriptHostScopeInfo(script).hosts;
  }
  function evaluateConnectPolicy(script, requestUrl) {
    let hostname;
    try {
      hostname = new URL(requestUrl).hostname;
    } catch (_) {
      return { allowed: false, error: "Invalid URL", hostname: "" };
    }
    const connectList = Array.isArray(script?.meta?.connect) ? script.meta.connect : [];
    if (isScriptHostScopeAllowed(script, requestUrl)) {
      return { allowed: true, hostname };
    }
    if (connectList.some((pattern) => String(pattern).trim() === "*")) {
      return { allowed: true, hostname, source: "@connect" };
    }
    const selfDomains = selfConnectDomains(script);
    const allowed = connectList.some((pattern) => {
      const normalized = normalizeConnectHost(pattern);
      if (normalized === "self") {
        return selfDomains.some((domain) => hostMatchesConnectPattern(hostname, domain));
      }
      return hostMatchesConnectPattern(hostname, normalized);
    });
    return {
      allowed,
      hostname,
      error: allowed ? "" : connectList.length > 0 ? `Connection to ${hostname} blocked by @connect policy` : `Connection to ${hostname} blocked by script host scope`
    };
  }
  function isHighPrivilegeScriptApiOverride(settings) {
    return settings?.allowHighPrivilegeScriptApis === true;
  }
  function evaluateScriptHostScopePolicy(script, requestUrl, capability, settings = {}) {
    let hostname;
    try {
      hostname = new URL(requestUrl).hostname;
    } catch (_) {
      return { allowed: false, hostname: "", error: "Invalid URL" };
    }
    if (isHighPrivilegeScriptApiOverride(settings)) return { allowed: true, hostname };
    const allowed = isScriptHostScopeAllowed(script, requestUrl);
    return {
      allowed,
      hostname,
      error: allowed ? "" : `${capability} to ${hostname} blocked by script host scope`
    };
  }
  var ConnectPolicy = Object.freeze({
    evaluateConnectPolicy,
    evaluateScriptHostScopePolicy,
    getScriptHostScopeInfo,
    hostMatchesConnectPattern,
    isScriptHostScopeAllowed,
    normalizeConnectHost,
    shouldAllowInternalXhr
  });
  var connect_policy_default = ConnectPolicy;
  return module.exports.default || module.exports.ConnectPolicy || module.exports;
})();
