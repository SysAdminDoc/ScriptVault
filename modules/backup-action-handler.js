// ============================================================================
// Generated from src/background/backup-action-handler.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const BackupActionHandler = (() => {
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

  // src/background/backup-action-handler.ts
  var backup_action_handler_exports = {};
  __export(backup_action_handler_exports, {
    BACKUP_BACKGROUND_ACTIONS: () => BACKUP_BACKGROUND_ACTIONS,
    BackupActionHandler: () => BackupActionHandler,
    createBackupActionHandlers: () => createBackupActionHandlers,
    default: () => backup_action_handler_default
  });
  module.exports = __toCommonJS(backup_action_handler_exports);
  var BACKUP_BACKGROUND_ACTIONS = [
    "createBackup",
    "getBackups",
    "restoreBackup",
    "verifyBackup",
    "getRestoreReceipts",
    "getRestoreReceipt",
    "rollbackRestore",
    "clearRestoreReceipts",
    "deleteBackup",
    "importBackup",
    "exportBackup",
    "inspectBackup",
    "getBackupSettings",
    "setBackupSettings"
  ];
  function createBackupActionHandlers(dependencies) {
    const handlers = {
      createBackup: ({ message }) => dependencies.create(message.reason || "manual"),
      getBackups: () => dependencies.list(),
      restoreBackup: ({ message }) => dependencies.restore(message.backupId, message.options),
      verifyBackup: ({ message }) => dependencies.verify(message.backupId),
      getRestoreReceipts: () => dependencies.listReceipts(),
      getRestoreReceipt: ({ message }) => dependencies.getReceipt(message.receiptId),
      rollbackRestore: ({ message }) => dependencies.rollback(message.receiptId, message.options || {}),
      clearRestoreReceipts: () => dependencies.clearReceipts(),
      deleteBackup: ({ message }) => dependencies.delete(message.backupId),
      importBackup: ({ message }) => dependencies.import(message.zipData),
      exportBackup: ({ message }) => dependencies.export(message.backupId),
      inspectBackup: ({ message }) => dependencies.inspect(message.backupId),
      getBackupSettings: () => dependencies.getSettings(),
      setBackupSettings: ({ message }) => dependencies.setSettings(message.settings)
    };
    return Object.freeze(handlers);
  }
  var BackupActionHandler = Object.freeze({
    BACKUP_BACKGROUND_ACTIONS,
    createBackupActionHandlers
  });
  var backup_action_handler_default = BackupActionHandler;
  return module.exports.default || module.exports.BackupActionHandler || module.exports;
})();

if (typeof self !== 'undefined') {
  self.BackupActionHandler = BackupActionHandler;
}
