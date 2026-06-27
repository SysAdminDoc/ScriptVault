// ============================================================================
// Generated from src/background/gm-menu-handler.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const GMMenuHandler = (() => {
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

  // src/background/gm-menu-handler.ts
  var gm_menu_handler_exports = {};
  __export(gm_menu_handler_exports, {
    GMMenuHandler: () => GMMenuHandler,
    GM_MENU_ACTIONS: () => GM_MENU_ACTIONS,
    default: () => gm_menu_handler_default,
    handleGMMenuMessage: () => handleGMMenuMessage,
    isGMMenuAction: () => isGMMenuAction
  });
  module.exports = __toCommonJS(gm_menu_handler_exports);
  var GM_MENU_ACTIONS = [
    "executeMenuCommand",
    "getMenuCommands",
    "GM_registerMenuCommand",
    "GM_unregisterMenuCommand",
    "registerMenuCommand",
    "unregisterMenuCommand"
  ];
  var GM_MENU_ACTION_SET = new Set(GM_MENU_ACTIONS);
  function isGMMenuAction(action) {
    return typeof action === "string" && GM_MENU_ACTION_SET.has(action);
  }
  async function handleGMMenuMessage(action, data = {}, sender = {}) {
    switch (action) {
      case "registerMenuCommand":
      case "GM_registerMenuCommand": {
        const scriptId = data.scriptId;
        const commands = await chrome.storage.session.get("menuCommands") || {};
        if (!commands.menuCommands) commands.menuCommands = {};
        if (!commands.menuCommands[scriptId]) commands.menuCommands[scriptId] = [];
        const existing = commands.menuCommands[scriptId].findIndex(
          (command) => command.id === data.commandId
        );
        const cmdEntry = {
          id: data.commandId,
          caption: data.caption,
          accessKey: data.accessKey || "",
          autoClose: data.autoClose !== false,
          title: data.title || ""
        };
        if (existing >= 0) {
          commands.menuCommands[scriptId][existing] = cmdEntry;
        } else {
          commands.menuCommands[scriptId].push(cmdEntry);
        }
        await chrome.storage.session.set(commands);
        return { success: true };
      }
      case "unregisterMenuCommand":
      case "GM_unregisterMenuCommand": {
        const scriptId = data.scriptId;
        const commands = await chrome.storage.session.get("menuCommands") || {};
        if (commands.menuCommands?.[scriptId]) {
          commands.menuCommands[scriptId] = commands.menuCommands[scriptId].filter(
            (command) => command.id !== data.commandId
          );
          if (commands.menuCommands[scriptId].length === 0) {
            delete commands.menuCommands[scriptId];
          }
          await chrome.storage.session.set(commands);
        }
        return { success: true };
      }
      case "getMenuCommands": {
        const result = await chrome.storage.session.get("menuCommands");
        const allCommands = result?.menuCommands || {};
        const commands = [];
        const scripts = await ScriptStorage.getAll();
        for (const [scriptId, menuCommands] of Object.entries(allCommands)) {
          const script = scripts.find((candidate) => candidate.id === scriptId);
          if (script && menuCommands) {
            menuCommands.forEach((command) => {
              commands.push({
                ...command,
                scriptId,
                scriptName: script.meta?.name || "Unknown Script"
              });
            });
          }
        }
        return { commands };
      }
      case "executeMenuCommand": {
        if (sender.tab?.id) {
          await chrome.tabs.sendMessage(sender.tab.id, {
            action: "executeMenuCommand",
            data: { scriptId: data.scriptId, commandId: data.commandId }
          });
        }
        return { success: true };
      }
      default:
        return { error: `Unsupported menu command action: ${action}` };
    }
  }
  var GMMenuHandler = Object.freeze({
    GM_MENU_ACTIONS,
    handleGMMenuMessage,
    isGMMenuAction
  });
  var gm_menu_handler_default = GMMenuHandler;
  return module.exports.default || module.exports.GMMenuHandler || module.exports;
})();

if (typeof self !== 'undefined') {
  self.GMMenuHandler = GMMenuHandler;
}
