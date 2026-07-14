// ============================================================================
// Generated from src/background/data-action-handler.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const DataActionHandler = (() => {
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

  // src/background/data-action-handler.ts
  var data_action_handler_exports = {};
  __export(data_action_handler_exports, {
    DATA_BACKGROUND_ACTIONS: () => DATA_BACKGROUND_ACTIONS,
    DataActionHandler: () => DataActionHandler,
    createDataActionHandlers: () => createDataActionHandlers,
    default: () => data_action_handler_default
  });
  module.exports = __toCommonJS(data_action_handler_exports);
  var DATA_BACKGROUND_ACTIONS = [
    "prefetchResources",
    "getAllScriptsValues",
    "setScriptValue",
    "clearScriptStorage",
    "renameScriptValue",
    "exportAll",
    "getStorageUsage",
    "getStorageBreakdown",
    "cleanupStorage",
    "getGistSettings",
    "saveGistSettings",
    "exportZip"
  ];
  function createDataActionHandlers(dependencies) {
    const handlers = {
      prefetchResources: ({ message }) => dependencies.prefetchResources(message.resources),
      getAllScriptsValues: () => dependencies.getAllScriptsValues(),
      setScriptValue: ({ message }) => dependencies.setScriptValue(message.scriptId, message.key, message.value),
      clearScriptStorage: ({ message }) => dependencies.clearScriptStorage(message.scriptId),
      renameScriptValue: ({ message }) => dependencies.renameScriptValue(
        message.scriptId,
        message.oldKey,
        message.newKey
      ),
      exportAll: ({ message }) => dependencies.exportAll(message.options || {}),
      getStorageUsage: () => dependencies.getStorageUsage(),
      getStorageBreakdown: () => dependencies.getStorageBreakdown(),
      cleanupStorage: ({ message }) => dependencies.cleanupStorage(message.options || {}),
      getGistSettings: () => dependencies.getGistSettings(),
      saveGistSettings: ({ message }) => dependencies.saveGistSettings(message.settings),
      exportZip: ({ message }) => dependencies.exportZip(message.options || {})
    };
    return Object.freeze(handlers);
  }
  var DataActionHandler = Object.freeze({
    DATA_BACKGROUND_ACTIONS,
    createDataActionHandlers
  });
  var data_action_handler_default = DataActionHandler;
  return module.exports.default || module.exports.DataActionHandler || module.exports;
})();

if (typeof self !== 'undefined') {
  self.DataActionHandler = DataActionHandler;
}
