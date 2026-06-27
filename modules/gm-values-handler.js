// ============================================================================
// Generated from src/background/gm-values-handler.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const GMValuesHandler = (() => {
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

  // src/background/gm-values-handler.ts
  var gm_values_handler_exports = {};
  __export(gm_values_handler_exports, {
    GMValuesHandler: () => GMValuesHandler,
    GM_VALUES_ACTIONS: () => GM_VALUES_ACTIONS,
    default: () => gm_values_handler_default,
    handleGMValuesMessage: () => handleGMValuesMessage,
    isGMValuesAction: () => isGMValuesAction
  });
  module.exports = __toCommonJS(gm_values_handler_exports);
  var GM_VALUES_ACTIONS = [
    "deleteScriptValue",
    "getScriptStorage",
    "getScriptValues",
    "getStorageSize",
    "GM_deleteValue",
    "GM_deleteValues",
    "GM_getValue",
    "GM_getValues",
    "GM_listValues",
    "GM_setValue",
    "GM_setValues",
    "setScriptStorage"
  ];
  var GM_VALUES_ACTION_SET = new Set(GM_VALUES_ACTIONS);
  function senderTabId(sender) {
    return sender.tab?.id ?? null;
  }
  function isGMValuesAction(action) {
    return typeof action === "string" && GM_VALUES_ACTION_SET.has(action);
  }
  async function handleGMValuesMessage(action, data = {}, sender = {}) {
    switch (action) {
      case "GM_getValue":
        return await ScriptValues.get(data.scriptId, data.key, data.defaultValue);
      case "GM_setValue":
        return await ScriptValues.set(data.scriptId, data.key, data.value, senderTabId(sender));
      case "GM_deleteValue":
        await ScriptValues.delete(data.scriptId, data.key, senderTabId(sender));
        return { success: true };
      case "deleteScriptValue":
        await ScriptValues.delete(data.scriptId, data.key);
        return { success: true };
      case "GM_listValues":
        return await ScriptValues.list(data.scriptId);
      case "GM_getValues":
        return await ScriptValues.getAll(data.scriptId);
      case "GM_setValues":
        await ScriptValues.setAll(data.scriptId, data.values, senderTabId(sender));
        return { success: true };
      case "GM_deleteValues":
        await ScriptValues.deleteMultiple(data.scriptId, data.keys, senderTabId(sender));
        return { success: true };
      case "getScriptStorage":
      case "getScriptValues": {
        const values = await ScriptValues.getAll(data.scriptId);
        return { values };
      }
      case "setScriptStorage":
        await ScriptValues.setAll(data.scriptId, data.values);
        return { success: true };
      case "getStorageSize":
        return await ScriptValues.getStorageSize(data.scriptId);
      default:
        return { error: `Unsupported GM values action: ${action}` };
    }
  }
  var GMValuesHandler = Object.freeze({
    GM_VALUES_ACTIONS,
    handleGMValuesMessage,
    isGMValuesAction
  });
  var gm_values_handler_default = GMValuesHandler;
  return module.exports.default || module.exports.GMValuesHandler || module.exports;
})();

if (typeof self !== 'undefined') {
  self.GMValuesHandler = GMValuesHandler;
}
