// ============================================================================
// Generated from src/background/gm-audio-handler.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const GMAudioHandler = (() => {
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

  // src/background/gm-audio-handler.ts
  var gm_audio_handler_exports = {};
  __export(gm_audio_handler_exports, {
    GMAudioHandler: () => GMAudioHandler,
    GM_AUDIO_ACTIONS: () => GM_AUDIO_ACTIONS,
    default: () => gm_audio_handler_default,
    handleGMAudioMessage: () => handleGMAudioMessage,
    isGMAudioAction: () => isGMAudioAction
  });
  module.exports = __toCommonJS(gm_audio_handler_exports);
  var GM_AUDIO_ACTIONS = [
    "GM_audio_getState",
    "GM_audio_setMute",
    "GM_audio_unwatchState",
    "GM_audio_watchState"
  ];
  var GM_AUDIO_ACTION_SET = new Set(GM_AUDIO_ACTIONS);
  function getSenderTabId(sender) {
    const tabId = sender?.tab?.id;
    return typeof tabId === "number" ? tabId : null;
  }
  function getAudioRuntimeGlobal() {
    return globalThis;
  }
  function getOwnedScriptId(data, sender) {
    const scriptId = sender.userScriptId || data.scriptId;
    return typeof scriptId === "string" && scriptId ? scriptId : null;
  }
  function audioWatchKey(scriptId, tabId) {
    return `${scriptId}:${tabId}`;
  }
  function persistAudioWatchedTabs() {
    try {
      getAudioRuntimeGlobal().SessionState?.persistAudioWatchedTabs?.();
    } catch (_) {
    }
  }
  function isGMAudioAction(action) {
    return typeof action === "string" && GM_AUDIO_ACTION_SET.has(action);
  }
  async function handleGMAudioMessage(action, data = {}, sender = {}) {
    try {
      const tabId = getSenderTabId(sender);
      switch (action) {
        case "GM_audio_setMute": {
          if (!tabId) return { error: "No tab context" };
          const mute = typeof data.mute === "object" ? !!data.mute?.mute : !!data.mute;
          await chrome.tabs.update(tabId, { muted: mute });
          return { success: true };
        }
        case "GM_audio_getState": {
          if (!tabId) return { error: "No tab context" };
          const tab = await chrome.tabs.get(tabId);
          return {
            muted: tab.mutedInfo?.muted || false,
            reason: tab.mutedInfo?.reason || "user",
            audible: tab.audible || false
          };
        }
        case "GM_audio_watchState": {
          if (!tabId) return { error: "No tab context" };
          const scriptId = getOwnedScriptId(data, sender);
          if (!scriptId) return { error: "Missing script context" };
          const runtime = getAudioRuntimeGlobal();
          if (!runtime._audioWatchedTabs) runtime._audioWatchedTabs = /* @__PURE__ */ new Set();
          runtime._audioWatchedTabs.add(audioWatchKey(scriptId, tabId));
          persistAudioWatchedTabs();
          return { success: true };
        }
        case "GM_audio_unwatchState": {
          const scriptId = getOwnedScriptId(data, sender);
          const runtime = getAudioRuntimeGlobal();
          if (typeof tabId === "number" && scriptId && runtime._audioWatchedTabs?.delete(audioWatchKey(scriptId, tabId))) {
            persistAudioWatchedTabs();
          }
          return { success: true };
        }
        default:
          return { error: `Unsupported GM_audio action: ${action}` };
      }
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }
  var GMAudioHandler = Object.freeze({
    GM_AUDIO_ACTIONS,
    handleGMAudioMessage,
    isGMAudioAction
  });
  var gm_audio_handler_default = GMAudioHandler;
  return module.exports.default || module.exports.GMAudioHandler || module.exports;
})();

if (typeof self !== 'undefined') {
  self.GMAudioHandler = GMAudioHandler;
}
