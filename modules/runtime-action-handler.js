// ============================================================================
// Generated from src/background/runtime-action-handler.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const RuntimeActionHandler = (() => {
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

  // src/background/runtime-action-handler.ts
  var runtime_action_handler_exports = {};
  __export(runtime_action_handler_exports, {
    RUNTIME_BACKGROUND_ACTIONS: () => RUNTIME_BACKGROUND_ACTIONS,
    RuntimeActionHandler: () => RuntimeActionHandler,
    createRuntimeActionHandlers: () => createRuntimeActionHandlers,
    default: () => runtime_action_handler_default
  });
  module.exports = __toCommonJS(runtime_action_handler_exports);
  var RUNTIME_BACKGROUND_ACTIONS = [
    "installFromUrl",
    "installFromCode",
    "fetchScriptPreview",
    "probeInstallDependency",
    "verifyRequireProvenancePreview",
    "fetchResource",
    "getScriptsForUrl",
    "diagnoseScripts",
    "updateBadgeForTab",
    "runScriptNow",
    "rescheduleChains",
    "runChainNow",
    "getChainDomEventTriggers",
    "chainDomEvent",
    "userStylePreviewDraft",
    "userStyleClearPreview",
    "getExtensionInfo",
    "openDashboard",
    "factoryReset"
  ];
  function createRuntimeActionHandlers(dependencies) {
    const handlers = {
      installFromUrl: ({ message }) => dependencies.installFromUrl(message.url),
      installFromCode: ({ message }) => dependencies.installFromCode(
        message.code,
        message.sourceUrl || "",
        message.operation || "install"
      ),
      fetchScriptPreview: ({ message }) => dependencies.fetchScriptPreview(message.url),
      probeInstallDependency: ({ message }) => dependencies.probeInstallDependency(message.url),
      verifyRequireProvenancePreview: ({ message }) => dependencies.verifyRequireProvenancePreview(message),
      fetchResource: ({ message }) => dependencies.fetchResource(message.url),
      getScriptsForUrl: ({ message }) => dependencies.getScriptsForUrl(message.url),
      diagnoseScripts: ({ message }) => dependencies.diagnoseScripts(message.url || "", message.tabId),
      updateBadgeForTab: ({ message }) => dependencies.updateBadgeForTab(message.tabId, message.url),
      runScriptNow: ({ message }) => dependencies.runScriptNow(message),
      rescheduleChains: () => dependencies.rescheduleChains(),
      runChainNow: ({ message }) => dependencies.runChainNow(
        message.chainId,
        message.reason || "manual",
        message.tabId
      ),
      getChainDomEventTriggers: () => dependencies.getChainDomEventTriggers(),
      chainDomEvent: ({ message, sender }) => dependencies.chainDomEvent(
        String(message.eventType || "").trim(),
        message.url || "",
        sender
      ),
      userStylePreviewDraft: ({ message }) => dependencies.previewUserStyle(message.code || "", message.tabId),
      userStyleClearPreview: ({ message }) => dependencies.clearUserStylePreview(message.tabId),
      getExtensionInfo: () => dependencies.getExtensionInfo(),
      openDashboard: ({ message }) => dependencies.openDashboard(message),
      factoryReset: () => dependencies.factoryReset()
    };
    return Object.freeze(handlers);
  }
  var RuntimeActionHandler = Object.freeze({
    RUNTIME_BACKGROUND_ACTIONS,
    createRuntimeActionHandlers
  });
  var runtime_action_handler_default = RuntimeActionHandler;
  return module.exports.default || module.exports.RuntimeActionHandler || module.exports;
})();

if (typeof self !== 'undefined') {
  self.RuntimeActionHandler = RuntimeActionHandler;
}
