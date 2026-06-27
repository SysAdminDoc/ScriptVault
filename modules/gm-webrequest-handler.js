// ============================================================================
// Generated from src/background/gm-webrequest-handler.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const GMWebRequestHandler = (() => {
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

  // src/background/gm-webrequest-handler.ts
  var gm_webrequest_handler_exports = {};
  __export(gm_webrequest_handler_exports, {
    GMWebRequestHandler: () => GMWebRequestHandler,
    GM_WEBREQUEST_ACTIONS: () => GM_WEBREQUEST_ACTIONS,
    default: () => gm_webrequest_handler_default,
    handleGMWebRequestMessage: () => handleGMWebRequestMessage,
    isGMWebRequestAction: () => isGMWebRequestAction
  });
  module.exports = __toCommonJS(gm_webrequest_handler_exports);
  var GM_WEBREQUEST_ACTIONS = [
    "GM_webRequest"
  ];
  var GM_WEBREQUEST_ACTION_SET = new Set(GM_WEBREQUEST_ACTIONS);
  function isGMWebRequestAction(action) {
    return typeof action === "string" && GM_WEBREQUEST_ACTION_SET.has(action);
  }
  async function handleGMWebRequestMessage(action, data = {}, sender = {}) {
    switch (action) {
      case "GM_webRequest": {
        const scriptId = sender.userScriptId || data.scriptId;
        if (!scriptId) return { error: "No script context" };
        const script = await ScriptStorage.get(scriptId);
        if (!script?.meta?.grant?.includes("GM_webRequest")) return { error: "Not granted" };
        const rules = Array.isArray(data.rules) ? data.rules : data.rules ? [data.rules] : [];
        const settings = await SettingsManager.get();
        const result = await applyWebRequestRules(scriptId, rules, { script, settings });
        if (!result?.success) return { error: result?.error || "GM_webRequest rule rejected" };
        return { success: true, count: result.count ?? rules.length };
      }
      default:
        return { error: `Unsupported GM_webRequest action: ${action}` };
    }
  }
  var GMWebRequestHandler = Object.freeze({
    GM_WEBREQUEST_ACTIONS,
    handleGMWebRequestMessage,
    isGMWebRequestAction
  });
  var gm_webrequest_handler_default = GMWebRequestHandler;
  return module.exports.default || module.exports.GMWebRequestHandler || module.exports;
})();

if (typeof self !== 'undefined') {
  self.GMWebRequestHandler = GMWebRequestHandler;
}
