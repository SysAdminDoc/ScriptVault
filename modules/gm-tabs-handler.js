// ============================================================================
// Generated from src/background/gm-tabs-handler.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const GMTabsHandler = (() => {
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

  // src/background/gm-tabs-handler.ts
  var gm_tabs_handler_exports = {};
  __export(gm_tabs_handler_exports, {
    GMTabsHandler: () => GMTabsHandler,
    GM_TABS_ACTIONS: () => GM_TABS_ACTIONS,
    default: () => gm_tabs_handler_default,
    handleGMTabsMessage: () => handleGMTabsMessage,
    isGMTabsAction: () => isGMTabsAction
  });
  module.exports = __toCommonJS(gm_tabs_handler_exports);
  var GM_TABS_ACTIONS = [
    "GM_closeTab",
    "GM_focusTab",
    "GM_getTab",
    "GM_getTabs",
    "GM_openInTab",
    "GM_saveTab"
  ];
  var GM_TABS_ACTION_SET = new Set(GM_TABS_ACTIONS);
  function getTabsRuntimeGlobal() {
    return globalThis;
  }
  function isGMTabsAction(action) {
    return typeof action === "string" && GM_TABS_ACTION_SET.has(action);
  }
  async function handleGMTabsMessage(action, data = {}, sender = {}) {
    switch (action) {
      case "GM_getTab":
        if (!sender.tab?.id) return {};
        return TabStorage.get(sender.tab.id);
      case "GM_saveTab":
        if (!sender.tab?.id) return { error: "GM_saveTab requires a tab context" };
        TabStorage.set(sender.tab.id, data.data);
        return { success: true };
      case "GM_getTabs":
        return TabStorage.getAll();
      case "GM_openInTab": {
        const openUrl = String(data.url || "");
        try {
          const parsed = new URL(openUrl);
          if (!["http:", "https:", "data:"].includes(parsed.protocol)) {
            return { error: `GM_openInTab: scheme "${parsed.protocol}" is not allowed` };
          }
        } catch {
          return { error: "GM_openInTab: invalid URL" };
        }
        const newTabOpts = {
          url: openUrl,
          active: data.active !== void 0 ? data.active : !data.background
        };
        if (data.insert && sender.tab?.index !== void 0) {
          newTabOpts.index = sender.tab.index + 1;
        }
        if (data.setParent && sender.tab?.id) {
          newTabOpts.openerTabId = sender.tab.id;
        }
        const tab = await chrome.tabs.create(newTabOpts);
        const callerTabId = sender.tab?.id;
        if (callerTabId && data.trackClose) {
          const runtime = getTabsRuntimeGlobal();
          if (!runtime._openTabTrackers) runtime._openTabTrackers = /* @__PURE__ */ new Map();
          if (runtime._openTabTrackers.size > 1e3) {
            const oldest = runtime._openTabTrackers.keys().next().value;
            runtime._openTabTrackers.delete(oldest);
          }
          runtime._openTabTrackers.set(tab.id, { callerTabId, scriptId: data.scriptId });
          runtime.SessionState?.persistOpenTabTrackers?.();
        }
        return { success: true, tabId: tab.id };
      }
      case "GM_focusTab":
        if (sender.tab?.id) {
          await chrome.tabs.update(sender.tab.id, { active: true });
        }
        return { success: true };
      case "GM_closeTab":
        if (data.tabId) {
          try {
            await chrome.tabs.remove(data.tabId);
          } catch (_) {
          }
        }
        return { success: true };
      default:
        return { error: `Unsupported GM tabs action: ${action}` };
    }
  }
  var GMTabsHandler = Object.freeze({
    GM_TABS_ACTIONS,
    handleGMTabsMessage,
    isGMTabsAction
  });
  var gm_tabs_handler_default = GMTabsHandler;
  return module.exports.default || module.exports.GMTabsHandler || module.exports;
})();

if (typeof self !== 'undefined') {
  self.GMTabsHandler = GMTabsHandler;
}
