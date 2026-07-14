// ============================================================================
// Generated from src/background/organization-action-handler.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const OrganizationActionHandler = (() => {
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

  // src/background/organization-action-handler.ts
  var organization_action_handler_exports = {};
  __export(organization_action_handler_exports, {
    ORGANIZATION_BACKGROUND_ACTIONS: () => ORGANIZATION_BACKGROUND_ACTIONS,
    OrganizationActionHandler: () => OrganizationActionHandler,
    createOrganizationActionHandlers: () => createOrganizationActionHandlers,
    default: () => organization_action_handler_default
  });
  module.exports = __toCommonJS(organization_action_handler_exports);
  var ORGANIZATION_BACKGROUND_ACTIONS = [
    "getProfiles",
    "switchProfile",
    "saveProfile",
    "deleteProfile",
    "getCollections",
    "saveCollection",
    "deleteCollection",
    "getWorkspaces",
    "createWorkspace",
    "saveWorkspace",
    "activateWorkspace",
    "updateWorkspace",
    "deleteWorkspace",
    "getFolders",
    "createFolder",
    "updateFolder",
    "deleteFolder",
    "addScriptToFolder",
    "removeScriptFromFolder",
    "moveScriptToFolder"
  ];
  function createOrganizationActionHandlers(dependencies) {
    const handlers = {
      getProfiles: () => dependencies.getProfiles(),
      switchProfile: ({ message }) => dependencies.switchProfile(message.profileId),
      saveProfile: ({ message }) => dependencies.saveProfile(message.profile),
      deleteProfile: ({ message }) => dependencies.deleteProfile(message.profileId),
      getCollections: () => dependencies.getCollections(),
      saveCollection: ({ message }) => dependencies.saveCollection(message.collection),
      deleteCollection: ({ message }) => dependencies.deleteCollection(message.collectionId),
      getWorkspaces: () => dependencies.getWorkspaces(),
      createWorkspace: ({ message }) => dependencies.createWorkspace(message.name),
      saveWorkspace: ({ message }) => dependencies.saveWorkspace(message.id),
      activateWorkspace: ({ message }) => dependencies.activateWorkspace(message.id),
      updateWorkspace: ({ message }) => dependencies.updateWorkspace(message.id, message.updates),
      deleteWorkspace: ({ message }) => dependencies.deleteWorkspace(message.id),
      getFolders: () => dependencies.getFolders(),
      createFolder: ({ message }) => dependencies.createFolder(message.name, message.color),
      updateFolder: ({ message }) => dependencies.updateFolder(message.id, message.updates),
      deleteFolder: ({ message }) => dependencies.deleteFolder(message.id),
      addScriptToFolder: ({ message }) => dependencies.addScriptToFolder(message.folderId, message.scriptId),
      removeScriptFromFolder: ({ message }) => dependencies.removeScriptFromFolder(message.folderId, message.scriptId),
      moveScriptToFolder: ({ message }) => dependencies.moveScriptToFolder(
        message.scriptId,
        message.fromFolderId,
        message.toFolderId
      )
    };
    return Object.freeze(handlers);
  }
  var OrganizationActionHandler = Object.freeze({
    ORGANIZATION_BACKGROUND_ACTIONS,
    createOrganizationActionHandlers
  });
  var organization_action_handler_default = OrganizationActionHandler;
  return module.exports.default || module.exports.OrganizationActionHandler || module.exports;
})();

if (typeof self !== 'undefined') {
  self.OrganizationActionHandler = OrganizationActionHandler;
}
