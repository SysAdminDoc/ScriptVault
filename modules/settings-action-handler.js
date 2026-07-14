// ============================================================================
// Generated from src/background/settings-action-handler.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const SettingsActionHandler = (() => {
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

  // src/background/settings-action-handler.ts
  var settings_action_handler_exports = {};
  __export(settings_action_handler_exports, {
    SETTINGS_BACKGROUND_ACTIONS: () => SETTINGS_BACKGROUND_ACTIONS,
    SettingsActionHandler: () => SettingsActionHandler,
    createSettingsActionHandlers: () => createSettingsActionHandlers,
    default: () => settings_action_handler_default
  });
  module.exports = __toCommonJS(settings_action_handler_exports);
  var SETTINGS_BACKGROUND_ACTIONS = [
    "getSettings",
    "getExtensionStatus",
    "getLocalHealthReport",
    "prepareBackgroundRunnerDryRun",
    "repairRuntimeState",
    "getSetting",
    "setSettings",
    "resetSettings",
    "getScriptSettings",
    "setScriptSettings",
    "resetScriptSettings"
  ];
  function createSettingsActionHandlers(dependencies) {
    const handlers = {
      getSettings: () => dependencies.getSettings(),
      getExtensionStatus: () => dependencies.getExtensionStatus(),
      getLocalHealthReport: () => dependencies.getLocalHealthReport(),
      prepareBackgroundRunnerDryRun: ({ message }) => dependencies.prepareBackgroundRunnerDryRun(message.scriptId),
      repairRuntimeState: () => dependencies.repairRuntimeState(),
      getSetting: ({ message }) => dependencies.getSetting(message.key),
      setSettings: ({ message }) => dependencies.setSettings(message.settings),
      resetSettings: () => dependencies.resetSettings(),
      getScriptSettings: ({ message }) => dependencies.getScriptSettings(message.scriptId),
      setScriptSettings: ({ message }) => dependencies.setScriptSettings(message.scriptId, message.settings),
      resetScriptSettings: ({ message }) => dependencies.resetScriptSettings(message.scriptId)
    };
    return Object.freeze(handlers);
  }
  var SettingsActionHandler = Object.freeze({
    SETTINGS_BACKGROUND_ACTIONS,
    createSettingsActionHandlers
  });
  var settings_action_handler_default = SettingsActionHandler;
  return module.exports.default || module.exports.SettingsActionHandler || module.exports;
})();

if (typeof self !== 'undefined') {
  self.SettingsActionHandler = SettingsActionHandler;
}
