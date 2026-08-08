// ============================================================================
// Generated from src/background/gm-grant-policy.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const GMGrantPolicy = (() => {
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

  // src/background/gm-grant-policy.ts
  var gm_grant_policy_exports = {};
  __export(gm_grant_policy_exports, {
    GMGrantPolicy: () => GMGrantPolicy,
    default: () => gm_grant_policy_default,
    grantDeniedError: () => grantDeniedError,
    grantsForAction: () => grantsForAction,
    isActionGrantedByList: () => isActionGrantedByList,
    isActionGrantedForScript: () => isActionGrantedForScript,
    isUnclassifiedGmAction: () => isUnclassifiedGmAction,
    isUngrantedAction: () => isUngrantedAction
  });
  module.exports = __toCommonJS(gm_grant_policy_exports);
  var ACTION_GRANTS = Object.freeze({
    // Value store
    GM_getValue: ["GM_getValue", "GM.getValue"],
    GM_getValues: ["GM_getValues", "GM.getValues", "GM_getValue", "GM.getValue"],
    GM_setValue: ["GM_setValue", "GM.setValue"],
    GM_setValues: ["GM_setValues", "GM.setValues", "GM_setValue", "GM.setValue"],
    GM_deleteValue: ["GM_deleteValue", "GM.deleteValue"],
    GM_deleteValues: ["GM_deleteValues", "GM.deleteValues", "GM_deleteValue", "GM.deleteValue"],
    GM_listValues: ["GM_listValues", "GM.listValues"],
    // Network. GM.fetch is layered on the same handler as GM_xmlhttpRequest, so
    // either grant admits it — mirroring the wrapper's allowFetchGrant path.
    GM_xmlhttpRequest: ["GM_xmlhttpRequest", "GM.xmlHttpRequest", "GM_fetch", "GM.fetch"],
    GM_xmlhttpRequest_abort: ["GM_xmlhttpRequest", "GM.xmlHttpRequest", "GM_fetch", "GM.fetch"],
    GM_xmlhttpRequest_result: ["GM_xmlhttpRequest", "GM.xmlHttpRequest", "GM_fetch", "GM.fetch"],
    GM_webRequest: ["GM_webRequest"],
    GM_webSocket: ["GM_webSocket", "GM.webSocket"],
    GM_webSocket_send: ["GM_webSocket", "GM.webSocket"],
    GM_webSocket_close: ["GM_webSocket", "GM.webSocket"],
    GM_webSocket_takeEvent: ["GM_webSocket", "GM.webSocket"],
    // The wrapper gates GM_loadScript on the XHR grant, not a grant of its own.
    GM_loadScript: ["GM_xmlhttpRequest", "GM.xmlHttpRequest"],
    // Tabs
    GM_openInTab: ["GM_openInTab", "GM.openInTab"],
    GM_closeTab: ["GM_openInTab", "GM.openInTab", "GM_closeTab", "GM.closeTab"],
    GM_focusTab: ["GM_focusTab", "GM.focusTab", "GM_openInTab", "GM.openInTab"],
    GM_getTab: ["GM_getTab", "GM.getTab"],
    GM_getTabs: ["GM_getTabs", "GM.getTabs"],
    GM_saveTab: ["GM_saveTab", "GM.saveTab"],
    // Notifications
    GM_notification: ["GM_notification", "GM.notification"],
    GM_updateNotification: ["GM_notification", "GM.notification"],
    GM_closeNotification: ["GM_notification", "GM.notification"],
    // Downloads
    GM_download: ["GM_download", "GM.download"],
    // Menu commands
    GM_registerMenuCommand: ["GM_registerMenuCommand", "GM.registerMenuCommand"],
    GM_unregisterMenuCommand: [
      "GM_registerMenuCommand",
      "GM.registerMenuCommand",
      "GM_unregisterMenuCommand",
      "GM.unregisterMenuCommand"
    ],
    // Resources
    GM_getResourceText: ["GM_getResourceText", "GM.getResourceText"],
    GM_getResourceURL: ["GM_getResourceURL", "GM.getResourceUrl"],
    // Cookies — the wrapper gates all three on the single GM_cookie grant.
    GM_cookie_list: ["GM_cookie", "GM.cookie"],
    GM_cookie_set: ["GM_cookie", "GM.cookie"],
    GM_cookie_delete: ["GM_cookie", "GM.cookie"],
    // Audio
    GM_audio_getState: ["GM_audio", "GM.audio"],
    GM_audio_setMute: ["GM_audio", "GM.audio"],
    GM_audio_watchState: ["GM_audio", "GM.audio"],
    GM_audio_unwatchState: ["GM_audio", "GM.audio"]
  });
  var UNGRANTED_ACTIONS = Object.freeze({
    // Nothing here today. Every GM action the router accepts maps to a grant.
  });
  var KNOWN_GRANTED_ACTIONS = new Set(Object.keys(ACTION_GRANTS));
  var KNOWN_UNGRANTED_ACTIONS = new Set(Object.keys(UNGRANTED_ACTIONS));
  function grantsForAction(action) {
    if (typeof action !== "string") return null;
    return ACTION_GRANTS[action] ?? null;
  }
  function isUngrantedAction(action) {
    return typeof action === "string" && KNOWN_UNGRANTED_ACTIONS.has(action);
  }
  function isUnclassifiedGmAction(action) {
    if (typeof action !== "string") return false;
    if (!action.startsWith("GM_") && !action.startsWith("GM.")) return false;
    return !KNOWN_GRANTED_ACTIONS.has(action) && !KNOWN_UNGRANTED_ACTIONS.has(action);
  }
  function isActionGrantedByList(action, grants) {
    const list = Array.isArray(grants) ? grants.filter((value) => typeof value === "string") : [];
    const required = grantsForAction(action);
    if (!required) {
      return !isUnclassifiedGmAction(action);
    }
    if (list.includes("none") || list.length === 0) return false;
    if (list.includes("*")) return true;
    return required.some((grant) => list.includes(grant));
  }
  function isActionGrantedForScript(action, script) {
    const grants = script?.meta?.grant;
    return isActionGrantedByList(action, grants);
  }
  function grantDeniedError(action) {
    const required = grantsForAction(action);
    const name = required && required.length ? required[0] : String(action);
    return `${action} is not granted: add @grant ${name} to the script's metadata block`;
  }
  var GMGrantPolicy = {
    ACTION_GRANTS,
    UNGRANTED_ACTIONS,
    grantsForAction,
    isUngrantedAction,
    isUnclassifiedGmAction,
    isActionGrantedByList,
    isActionGrantedForScript,
    grantDeniedError
  };
  var gm_grant_policy_default = GMGrantPolicy;
  return module.exports.default || module.exports.GMGrantPolicy || module.exports;
})();

if (typeof self !== 'undefined') {
  self.GMGrantPolicy = GMGrantPolicy;
}
