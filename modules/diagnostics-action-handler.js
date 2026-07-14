// ============================================================================
// Generated from src/background/diagnostics-action-handler.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const DiagnosticsActionHandler = (() => {
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

  // src/background/diagnostics-action-handler.ts
  var diagnostics_action_handler_exports = {};
  __export(diagnostics_action_handler_exports, {
    DIAGNOSTICS_BACKGROUND_ACTIONS: () => DIAGNOSTICS_BACKGROUND_ACTIONS,
    DiagnosticsActionHandler: () => DiagnosticsActionHandler,
    createDiagnosticsActionHandlers: () => createDiagnosticsActionHandlers,
    default: () => diagnostics_action_handler_default
  });
  module.exports = __toCommonJS(diagnostics_action_handler_exports);
  var DIAGNOSTICS_BACKGROUND_ACTIONS = [
    "reportCSPFailure",
    "getCSPReports",
    "getNetworkLog",
    "getNetworkLogStats",
    "clearNetworkLog",
    "analyzeScript",
    "getOnDeviceAIStatus",
    "runOnDeviceAI",
    "getScriptStats",
    "getExecutionDiagnostics",
    "resetScriptStats",
    "reportDocumentReady",
    "npmResolve",
    "npmResolveAll",
    "logError",
    "getErrorLog",
    "getErrorLogGrouped",
    "exportErrorLog",
    "clearErrorLog",
    "getNotificationPrefs",
    "setNotificationPrefs",
    "generateDigest",
    "scriptConsoleCapture",
    "getScriptConsole",
    "clearScriptConsole",
    "setLiveReload",
    "getLiveReloadScripts"
  ];
  function createDiagnosticsActionHandlers(dependencies) {
    const handlers = {
      reportCSPFailure: ({ message }) => dependencies.reportCspFailure(message.url, message.scriptId, message.directive),
      getCSPReports: () => dependencies.getCspReports(),
      getNetworkLog: ({ message }) => dependencies.getNetworkLog(message),
      getNetworkLogStats: () => dependencies.getNetworkLogStats(),
      clearNetworkLog: ({ message }) => dependencies.clearNetworkLog(message.scriptId),
      analyzeScript: ({ message }) => dependencies.analyzeScript(message.code || ""),
      getOnDeviceAIStatus: () => dependencies.getOnDeviceAiStatus(),
      runOnDeviceAI: ({ message }) => dependencies.runOnDeviceAi({
        mode: message.mode,
        code: message.code || "",
        metadata: message.metadata || null,
        analysis: message.analysis || null,
        prompt: message.prompt || ""
      }),
      getScriptStats: ({ message }) => dependencies.getScriptStats(message.scriptId),
      getExecutionDiagnostics: ({ message }) => dependencies.getExecutionDiagnostics(Number(message.tabId)),
      resetScriptStats: ({ message }) => dependencies.resetScriptStats(message.scriptId),
      reportDocumentReady: ({ message, sender }) => dependencies.reportDocumentReady(message.url || "", sender),
      npmResolve: ({ message }) => dependencies.npmResolve(message.spec),
      npmResolveAll: ({ message }) => dependencies.npmResolveAll(message.requires),
      logError: ({ message }) => dependencies.logError(message.entry || message),
      getErrorLog: ({ message }) => dependencies.getErrorLog(message.filters),
      getErrorLogGrouped: () => dependencies.getErrorLogGrouped(),
      exportErrorLog: ({ message }) => dependencies.exportErrorLog(message.format || "json"),
      clearErrorLog: () => dependencies.clearErrorLog(),
      getNotificationPrefs: () => dependencies.getNotificationPrefs(),
      setNotificationPrefs: ({ message }) => dependencies.setNotificationPrefs(message.prefs),
      generateDigest: () => dependencies.generateDigest(),
      scriptConsoleCapture: ({ message }) => dependencies.captureScriptConsole(message.scriptId, message.entries),
      getScriptConsole: ({ message }) => dependencies.getScriptConsole(message.scriptId),
      clearScriptConsole: ({ message }) => dependencies.clearScriptConsole(message.scriptId),
      setLiveReload: ({ message }) => dependencies.setLiveReload(message.scriptId, message.enabled),
      getLiveReloadScripts: () => dependencies.getLiveReloadScripts()
    };
    return Object.freeze(handlers);
  }
  var DiagnosticsActionHandler = Object.freeze({
    DIAGNOSTICS_BACKGROUND_ACTIONS,
    createDiagnosticsActionHandlers
  });
  var diagnostics_action_handler_default = DiagnosticsActionHandler;
  return module.exports.default || module.exports.DiagnosticsActionHandler || module.exports;
})();

if (typeof self !== 'undefined') {
  self.DiagnosticsActionHandler = DiagnosticsActionHandler;
}
