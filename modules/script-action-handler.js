// ============================================================================
// Generated from src/background/script-action-handler.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const ScriptActionHandler = (() => {
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

  // src/background/script-action-handler.ts
  var script_action_handler_exports = {};
  __export(script_action_handler_exports, {
    SCRIPT_BACKGROUND_ACTIONS: () => SCRIPT_BACKGROUND_ACTIONS,
    ScriptActionHandler: () => ScriptActionHandler,
    createScriptActionHandlers: () => createScriptActionHandlers,
    default: () => script_action_handler_default
  });
  module.exports = __toCommonJS(script_action_handler_exports);
  var SCRIPT_BACKGROUND_ACTIONS = [
    "getScripts",
    "getHostPermissionStatus",
    "queueHostAccessRequest",
    "getScript",
    "saveScript",
    "createScript",
    "deleteScript",
    "getTrash",
    "restoreFromTrash",
    "emptyTrash",
    "rescheduleScript",
    "restart",
    "permanentlyDelete",
    "toggleScript",
    "duplicateScript",
    "searchScripts",
    "reorderScripts"
  ];
  function createScriptActionHandlers(dependencies) {
    const handlers = {
      getScripts: () => dependencies.getScripts(),
      getHostPermissionStatus: ({ message, sender }) => dependencies.getHostPermissionStatus(message, sender),
      queueHostAccessRequest: ({ message, sender }) => dependencies.queueHostAccessRequest(message, sender),
      getScript: ({ message }) => dependencies.getScript(message.id),
      saveScript: ({ message }) => dependencies.saveScript(message),
      createScript: ({ message }) => dependencies.createScript(message.code),
      deleteScript: ({ message }) => dependencies.deleteScript(message.id || message.scriptId),
      getTrash: () => dependencies.getTrash(),
      restoreFromTrash: ({ message }) => dependencies.restoreFromTrash(message.scriptId),
      emptyTrash: () => dependencies.emptyTrash(),
      rescheduleScript: ({ message }) => dependencies.rescheduleScript(message.scriptId),
      restart: () => dependencies.restart(),
      permanentlyDelete: ({ message }) => dependencies.permanentlyDelete(message.scriptId),
      toggleScript: ({ message }) => dependencies.toggleScript(message),
      duplicateScript: ({ message }) => dependencies.duplicateScript(message.id),
      searchScripts: ({ message }) => dependencies.searchScripts(message.query),
      reorderScripts: ({ message }) => dependencies.reorderScripts(message.orderedIds)
    };
    return Object.freeze(handlers);
  }
  var ScriptActionHandler = Object.freeze({
    SCRIPT_BACKGROUND_ACTIONS,
    createScriptActionHandlers
  });
  var script_action_handler_default = ScriptActionHandler;
  return module.exports.default || module.exports.ScriptActionHandler || module.exports;
})();

if (typeof self !== 'undefined') {
  self.ScriptActionHandler = ScriptActionHandler;
}
