// ============================================================================
// Generated from src/background/user-script-message-policy.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const UserScriptMessagePolicy = (() => {
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

  // src/background/user-script-message-policy.ts
  var user_script_message_policy_exports = {};
  __export(user_script_message_policy_exports, {
    USER_SCRIPT_ALLOWED_EXTRAS: () => USER_SCRIPT_ALLOWED_EXTRAS,
    UserScriptMessagePolicy: () => UserScriptMessagePolicy,
    default: () => user_script_message_policy_default,
    isExtensionSurfaceSender: () => isExtensionSurfaceSender,
    isUserScriptAllowedAction: () => isUserScriptAllowedAction
  });
  module.exports = __toCommonJS(user_script_message_policy_exports);
  var USER_SCRIPT_ALLOWED_EXTRAS = Object.freeze([
    "chainDomEvent",
    "getChainDomEventTriggers",
    "netlog_record",
    "reportExecError",
    "reportExecTime"
  ]);
  var USER_SCRIPT_ALLOWED_EXTRA_SET = new Set(USER_SCRIPT_ALLOWED_EXTRAS);
  function isUserScriptAllowedAction(action) {
    if (typeof action !== "string") return false;
    if (action.startsWith("GM_") || action.startsWith("GM.")) return true;
    return USER_SCRIPT_ALLOWED_EXTRA_SET.has(action);
  }
  function isExtensionSurfaceSender(sender, extensionId) {
    if (!sender || !extensionId) return false;
    const ownExtensionPrefix = `chrome-extension://${extensionId}/`;
    const url = typeof sender.url === "string" ? sender.url : "";
    const ownFirefoxExtensionPage = sender.id === extensionId && url.startsWith("moz-extension://");
    if (url.startsWith(ownExtensionPrefix) || ownFirefoxExtensionPage) return true;
    if (sender.id === extensionId && !sender.tab && !url) return true;
    return false;
  }
  var UserScriptMessagePolicy = Object.freeze({
    USER_SCRIPT_ALLOWED_EXTRAS,
    isExtensionSurfaceSender,
    isUserScriptAllowedAction
  });
  var user_script_message_policy_default = UserScriptMessagePolicy;
  return module.exports.default || module.exports.UserScriptMessagePolicy || module.exports;
})();
