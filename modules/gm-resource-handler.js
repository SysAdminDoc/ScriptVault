// ============================================================================
// Generated from src/background/gm-resource-handler.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const GMResourceHandler = (() => {
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

  // src/background/gm-resource-handler.ts
  var gm_resource_handler_exports = {};
  __export(gm_resource_handler_exports, {
    GMResourceHandler: () => GMResourceHandler,
    GM_RESOURCE_ACTIONS: () => GM_RESOURCE_ACTIONS,
    default: () => gm_resource_handler_default,
    handleGMResourceMessage: () => handleGMResourceMessage,
    isGMResourceAction: () => isGMResourceAction
  });
  module.exports = __toCommonJS(gm_resource_handler_exports);
  var HTTP_GM_LOAD_SCRIPT_SRI_ERROR = "GM_loadScript over http requires a verifiable #sha256= integrity fragment";
  function parseScriptIntegrity(url) {
    const hashIdx = url.indexOf("#");
    if (hashIdx <= 0) return { fetchUrl: url, sriHash: null };
    const fragment = url.slice(hashIdx + 1);
    return /^(sha256|sha384|sha512)[-=]/i.test(fragment) ? { fetchUrl: url.slice(0, hashIdx), sriHash: fragment } : { fetchUrl: url, sriHash: null };
  }
  function hasVerifiableScriptIntegrity(hash) {
    return /^(sha256|sha384|sha512)[-=]/i.test(hash || "");
  }
  function normalizeIntegrityBase64(value) {
    let normalized = value.replace(/-/g, "+").replace(/_/g, "/").replace(/\s+/g, "");
    const remainder = normalized.length % 4;
    if (remainder === 2) normalized += "==";
    else if (remainder === 3) normalized += "=";
    return normalized;
  }
  async function verifyScriptIntegrity(code, hash) {
    const match = hash.match(/^(sha256|sha384|sha512)[-=](.+)$/i);
    if (!match?.[1] || !match[2]) return false;
    const algorithm = { sha256: "SHA-256", sha384: "SHA-384", sha512: "SHA-512" }[match[1].toLowerCase()];
    try {
      const digest = await crypto.subtle.digest(algorithm, new TextEncoder().encode(code));
      const actual = btoa(String.fromCharCode(...new Uint8Array(digest)));
      return normalizeIntegrityBase64(actual) === normalizeIntegrityBase64(match[2]);
    } catch {
      return false;
    }
  }
  var GM_RESOURCE_ACTIONS = [
    "GM_getResourceText",
    "GM_getResourceURL",
    "GM_loadScript"
  ];
  var GM_RESOURCE_ACTION_SET = new Set(GM_RESOURCE_ACTIONS);
  function errorMessage(error, fallback) {
    if (error && typeof error === "object" && "message" in error) {
      const message = error.message;
      if (typeof message === "string" && message) return message;
    }
    return fallback;
  }
  function isGMResourceAction(action) {
    return typeof action === "string" && GM_RESOURCE_ACTION_SET.has(action);
  }
  async function handleGMResourceMessage(action, data = {}, sender = {}) {
    const ownedScriptId = sender.userScriptId || data.scriptId;
    switch (action) {
      case "GM_getResourceText": {
        const script = await ScriptStorage.get(ownedScriptId);
        if (!script || !script.meta?.resource) return null;
        const url = data.name ? script.meta.resource[data.name] : void 0;
        if (!url) return null;
        try {
          return await ResourceCache.fetchResource(url);
        } catch (_) {
          return null;
        }
      }
      case "GM_getResourceURL": {
        const script = await ScriptStorage.get(ownedScriptId);
        if (!script || !script.meta?.resource) return null;
        const url = data.name ? script.meta.resource[data.name] : void 0;
        if (!url) return null;
        try {
          return await ResourceCache.getDataUri(url);
        } catch (_) {
          return null;
        }
      }
      case "GM_loadScript": {
        try {
          if (!data.url) return { error: "No URL provided" };
          if (!ownedScriptId) return { error: "Missing script context" };
          const script = await ScriptStorage.get(ownedScriptId);
          if (!script) return { error: "Script context not found" };
          const { fetchUrl, sriHash } = parseScriptIntegrity(data.url);
          let isPlainHttp = false;
          try {
            isPlainHttp = new URL(fetchUrl).protocol === "http:";
          } catch {
            return { error: "GM_loadScript URL rejected: invalid URL" };
          }
          if (isPlainHttp && !hasVerifiableScriptIntegrity(sriHash)) {
            return { error: HTTP_GM_LOAD_SCRIPT_SRI_ERROR };
          }
          const policy = evaluateConnectPolicy(script, fetchUrl);
          if (!policy.allowed) return { error: policy.error };
          const preCheck = InternalHostGuard.classifyFetchUrl(fetchUrl, ["http:", "https:"]);
          if (!preCheck.ok) {
            return { error: "GM_loadScript URL rejected: " + preCheck.message };
          }
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), data.timeout || 3e4);
          let code;
          try {
            const response = await fetch(fetchUrl, { signal: controller.signal });
            if (!response.ok) return { error: `HTTP ${response.status}` };
            const postCheck = InternalHostGuard.classifyResponseUrl(response, ["http:", "https:"]);
            if (!postCheck.ok) {
              return { error: "GM_loadScript URL redirected to " + postCheck.message };
            }
            if (response.url && response.url !== fetchUrl) {
              let crossOrigin = true;
              try {
                crossOrigin = new URL(response.url).origin !== new URL(fetchUrl).origin;
              } catch {
                crossOrigin = true;
              }
              if (crossOrigin) {
                const redirectPolicy = evaluateConnectPolicy(script, response.url);
                if (!redirectPolicy.allowed) {
                  return { error: redirectPolicy.error || "GM_loadScript redirect blocked by @connect" };
                }
              }
            }
            try {
              code = await _fetchTextBounded(response, MAX_SCRIPT_SIZE, "Script");
            } catch (sizeError) {
              return { error: errorMessage(sizeError, String(sizeError)) };
            }
          } finally {
            clearTimeout(timeoutId);
          }
          if (!code || code.length === 0) return { error: "Empty response" };
          if (sriHash && !await verifyScriptIntegrity(code, sriHash)) {
            return { error: "GM_loadScript integrity hash mismatch" };
          }
          return { code };
        } catch (error) {
          return { error: errorMessage(error, "Fetch failed") };
        }
      }
      default:
        return { error: `Unsupported GM resource action: ${action}` };
    }
  }
  var GMResourceHandler = Object.freeze({
    GM_RESOURCE_ACTIONS,
    handleGMResourceMessage,
    isGMResourceAction
  });
  var gm_resource_handler_default = GMResourceHandler;
  return module.exports.default || module.exports.GMResourceHandler || module.exports;
})();

if (typeof self !== 'undefined') {
  self.GMResourceHandler = GMResourceHandler;
}
