// ============================================================================
// Generated from src/background/sync-action-handler.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const SyncActionHandler = (() => {
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

  // src/background/sync-action-handler.ts
  var sync_action_handler_exports = {};
  __export(sync_action_handler_exports, {
    SYNC_BACKGROUND_ACTIONS: () => SYNC_BACKGROUND_ACTIONS,
    SyncActionHandler: () => SyncActionHandler,
    createSyncActionHandlers: () => createSyncActionHandlers,
    default: () => sync_action_handler_default
  });
  module.exports = __toCommonJS(sync_action_handler_exports);
  var SYNC_BACKGROUND_ACTIONS = [
    "sync",
    "syncNow",
    "testSync",
    "getLastSyncResult",
    "syncProviderHealth",
    "syncDryRunPreview",
    "connectSyncProvider",
    "disconnectSyncProvider",
    "revokeSyncProvider",
    "getSyncProviderStatus",
    "cloudExport",
    "cloudImport",
    "cloudStatus",
    "easyCloudConnect",
    "easyCloudDisconnect",
    "easyCloudSync",
    "easyCloudStatus"
  ];
  function createSyncActionHandlers(dependencies) {
    const handlers = {
      sync: () => dependencies.sync(),
      syncNow: () => dependencies.sync(),
      testSync: ({ message }) => dependencies.test(message.provider),
      getLastSyncResult: () => dependencies.getLastResult(),
      syncProviderHealth: ({ message }) => dependencies.health(message.provider),
      syncDryRunPreview: ({ message }) => dependencies.preview(message.provider),
      connectSyncProvider: ({ message }) => dependencies.connect(message.provider),
      disconnectSyncProvider: ({ message }) => dependencies.disconnect(message.provider),
      revokeSyncProvider: ({ message }) => dependencies.disconnect(message.provider),
      getSyncProviderStatus: ({ message }) => dependencies.status(message.provider),
      cloudExport: ({ message }) => dependencies.export(message.provider, {
        includeSettings: message.includeSettings !== false,
        includeStorage: message.includeStorage !== false,
        includeSettingsCredentials: message.includeSettingsCredentials === true
      }),
      cloudImport: ({ message }) => dependencies.import(message.provider, {
        importSettings: message.importSettings === true,
        importStorage: message.importStorage !== false,
        importSettingsCredentials: message.importSettingsCredentials === true,
        trustImportedScripts: message.trustImportedScripts === true
      }),
      cloudStatus: ({ message }) => dependencies.cloudStatus(message.provider),
      easyCloudConnect: () => dependencies.easyCloudConnect(),
      easyCloudDisconnect: () => dependencies.easyCloudDisconnect(),
      easyCloudSync: () => dependencies.easyCloudSync(),
      easyCloudStatus: () => dependencies.easyCloudStatus()
    };
    return Object.freeze(handlers);
  }
  var SyncActionHandler = Object.freeze({
    SYNC_BACKGROUND_ACTIONS,
    createSyncActionHandlers
  });
  var sync_action_handler_default = SyncActionHandler;
  return module.exports.default || module.exports.SyncActionHandler || module.exports;
})();

if (typeof self !== 'undefined') {
  self.SyncActionHandler = SyncActionHandler;
}
