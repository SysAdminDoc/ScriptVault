// ============================================================================
// Generated from src/background/import-action-handler.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const ImportActionHandler = (() => {
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

  // src/background/import-action-handler.ts
  var import_action_handler_exports = {};
  __export(import_action_handler_exports, {
    IMPORT_BACKGROUND_ACTIONS: () => IMPORT_BACKGROUND_ACTIONS,
    ImportActionHandler: () => ImportActionHandler,
    createImportActionHandlers: () => createImportActionHandlers,
    default: () => import_action_handler_default
  });
  module.exports = __toCommonJS(import_action_handler_exports);
  var IMPORT_BACKGROUND_ACTIONS = [
    "importScript",
    "importAll",
    "importTampermonkeyBackup",
    "importViolentmonkeyBackup",
    "importGreasemonkeyBackup",
    "importFromZip"
  ];
  function createImportActionHandlers(dependencies) {
    return Object.freeze({
      importScript: ({ message }) => dependencies.importScript(message.code),
      importAll: ({ message }) => dependencies.importAll(message.data, message.options),
      importTampermonkeyBackup: ({ message }) => dependencies.importVendorBackup(
        "tampermonkey",
        message.text,
        message
      ),
      importViolentmonkeyBackup: ({ message }) => dependencies.importVendorBackup(
        "violentmonkey",
        message.text,
        message
      ),
      importGreasemonkeyBackup: ({ message }) => dependencies.importVendorBackup(
        "greasemonkey",
        message.text,
        message
      ),
      importFromZip: ({ message }) => dependencies.importFromZip(message.zipData, message.options)
    });
  }
  var ImportActionHandler = Object.freeze({
    IMPORT_BACKGROUND_ACTIONS,
    createImportActionHandlers
  });
  var import_action_handler_default = ImportActionHandler;
  return module.exports.default || module.exports.ImportActionHandler || module.exports;
})();

if (typeof self !== 'undefined') {
  self.ImportActionHandler = ImportActionHandler;
}
