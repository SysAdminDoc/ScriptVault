// ============================================================================
// Generated from src/background/update-action-handler.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const UpdateActionHandler = (() => {
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

  // src/background/update-action-handler.ts
  var update_action_handler_exports = {};
  __export(update_action_handler_exports, {
    UPDATE_BACKGROUND_ACTIONS: () => UPDATE_BACKGROUND_ACTIONS,
    UpdateActionHandler: () => UpdateActionHandler,
    createUpdateActionHandlers: () => createUpdateActionHandlers,
    default: () => update_action_handler_default
  });
  module.exports = __toCommonJS(update_action_handler_exports);
  var UPDATE_BACKGROUND_ACTIONS = [
    "checkUpdates",
    "queueUpdates",
    "getPendingUpdates",
    "clearPendingUpdates",
    "applyPendingUpdate",
    "applySafePendingUpdates",
    "getRecentUpdates",
    "clearRecentUpdates",
    "forceUpdate",
    "applyUpdate",
    "getVersionHistory",
    "rollbackScript",
    "getSubscriptions",
    "addSubscription",
    "refreshSubscription",
    "refreshSubscriptions",
    "removeSubscription"
  ];
  function createUpdateActionHandlers(dependencies) {
    const handlers = {
      checkUpdates: ({ message }) => dependencies.checkUpdates(message.scriptId),
      queueUpdates: ({ message }) => dependencies.queueUpdates(
        message.scriptId,
        message.updates,
        message.source || "manual-check"
      ),
      getPendingUpdates: () => dependencies.getPendingUpdates(),
      clearPendingUpdates: ({ message }) => dependencies.clearPendingUpdates(message.scriptId),
      applyPendingUpdate: ({ message }) => dependencies.applyPendingUpdate(message.scriptId, message.force === true),
      applySafePendingUpdates: ({ message }) => dependencies.applySafePendingUpdates(message.scriptIds),
      getRecentUpdates: () => dependencies.getRecentUpdates(),
      clearRecentUpdates: () => {
        dependencies.clearRecentUpdates();
        return { success: true };
      },
      forceUpdate: ({ message }) => dependencies.forceUpdate(message.scriptId),
      applyUpdate: ({ message }) => dependencies.applyUpdate(
        message.scriptId,
        message.code,
        message.sourceUrl || ""
      ),
      getVersionHistory: ({ message }) => dependencies.getVersionHistory(message.scriptId),
      rollbackScript: ({ message }) => dependencies.rollbackScript(message.scriptId, message.index),
      getSubscriptions: () => dependencies.getSubscriptions(),
      addSubscription: ({ message }) => dependencies.addSubscription(message.url || "", message.name || ""),
      refreshSubscription: ({ message }) => dependencies.refreshSubscription(
        message.subscriptionId || message.id || message.url || ""
      ),
      refreshSubscriptions: () => dependencies.refreshSubscriptions(),
      removeSubscription: ({ message }) => dependencies.removeSubscription(
        message.subscriptionId || message.id || message.url || ""
      )
    };
    return Object.freeze(handlers);
  }
  var UpdateActionHandler = Object.freeze({
    UPDATE_BACKGROUND_ACTIONS,
    createUpdateActionHandlers
  });
  var update_action_handler_default = UpdateActionHandler;
  return module.exports.default || module.exports.UpdateActionHandler || module.exports;
})();

if (typeof self !== 'undefined') {
  self.UpdateActionHandler = UpdateActionHandler;
}
