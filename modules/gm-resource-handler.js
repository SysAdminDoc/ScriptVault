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
  async function handleGMResourceMessage(action, data = {}) {
    switch (action) {
      case "GM_getResourceText": {
        const script = await ScriptStorage.get(data.scriptId);
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
        const script = await ScriptStorage.get(data.scriptId);
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
          if (!data.scriptId) return { error: "Missing script context" };
          const script = await ScriptStorage.get(data.scriptId);
          if (!script) return { error: "Script context not found" };
          const policy = evaluateConnectPolicy(script, data.url);
          if (!policy.allowed) return { error: policy.error };
          const preCheck = InternalHostGuard.classifyFetchUrl(data.url, ["http:", "https:"]);
          if (!preCheck.ok) {
            return { error: "GM_loadScript URL rejected: " + preCheck.message };
          }
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), data.timeout || 3e4);
          let code;
          try {
            const response = await fetch(data.url, { signal: controller.signal });
            if (!response.ok) return { error: `HTTP ${response.status}` };
            const postCheck = InternalHostGuard.classifyResponseUrl(response, ["http:", "https:"]);
            if (!postCheck.ok) {
              return { error: "GM_loadScript URL redirected to " + postCheck.message };
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
