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
    authenticateUserScriptSender: () => authenticateUserScriptSender,
    default: () => user_script_message_policy_default,
    getScriptAuthToken: () => getScriptAuthToken,
    isExtensionSurfaceSender: () => isExtensionSurfaceSender,
    isScriptAuthRegistrationCurrent: () => isScriptAuthRegistrationCurrent,
    isUserScriptAllowedAction: () => isUserScriptAllowedAction,
    markScriptAuthRegistrationCurrent: () => markScriptAuthRegistrationCurrent
  });
  module.exports = __toCommonJS(user_script_message_policy_exports);
  var USER_SCRIPT_ALLOWED_EXTRAS = Object.freeze([
    "chainDomEvent",
    "getChainDomEventTriggers",
    "netlog_record",
    "recordBridgeTelemetry",
    "reportDocumentReady",
    "reportExecError",
    "reportExecTime"
  ]);
  var USER_SCRIPT_ALLOWED_EXTRA_SET = new Set(USER_SCRIPT_ALLOWED_EXTRAS);
  var USER_SCRIPT_AUTHENTICATED_EXTRA_SET = /* @__PURE__ */ new Set([
    "netlog_record",
    "reportExecError",
    "reportExecTime"
  ]);
  var SCRIPT_AUTH_SECRET_KEY = "_scriptMessageAuthSecretV1";
  var SCRIPT_AUTH_REGISTRATION_KEY = "_scriptMessageAuthRegistrationVersion";
  var SCRIPT_AUTH_REGISTRATION_VERSION = 2;
  var scriptAuthSecretPromise = null;
  function bytesToHex(bytes) {
    return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
  }
  function hexToBytes(value) {
    const bytes = new Uint8Array(value.length / 2);
    for (let index = 0; index < bytes.length; index++) {
      bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
    }
    return bytes;
  }
  async function getScriptAuthSecret() {
    if (!scriptAuthSecretPromise) {
      scriptAuthSecretPromise = (async () => {
        const stored = await chrome.storage.local.get(SCRIPT_AUTH_SECRET_KEY);
        const existing = stored?.[SCRIPT_AUTH_SECRET_KEY];
        if (typeof existing === "string" && /^[a-f0-9]{64}$/u.test(existing)) return existing;
        const secretBytes = new Uint8Array(32);
        globalThis.crypto.getRandomValues(secretBytes);
        const secret = bytesToHex(secretBytes);
        await chrome.storage.local.set({ [SCRIPT_AUTH_SECRET_KEY]: secret });
        return secret;
      })().catch((error) => {
        scriptAuthSecretPromise = null;
        throw error;
      });
    }
    return await scriptAuthSecretPromise;
  }
  async function getScriptAuthToken(scriptId) {
    if (typeof scriptId !== "string" || !scriptId) {
      throw new Error("A script id is required for authenticated GM messaging");
    }
    const secret = await getScriptAuthSecret();
    const key = await globalThis.crypto.subtle.importKey(
      "raw",
      hexToBytes(secret).buffer,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await globalThis.crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(scriptId)
    );
    return bytesToHex(new Uint8Array(signature));
  }
  function constantTimeEqual(left, right) {
    if (left.length !== right.length) return false;
    let difference = 0;
    for (let index = 0; index < left.length; index++) {
      difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
    }
    return difference === 0;
  }
  async function authenticateUserScriptSender(message, sender) {
    if (sender?.userScriptId) return sender;
    const action = message?.action;
    const requiresAuthentication = typeof action === "string" && (action.startsWith("GM_") || action.startsWith("GM.") || USER_SCRIPT_AUTHENTICATED_EXTRA_SET.has(action));
    if (!requiresAuthentication) {
      return sender;
    }
    const data = message?.data && typeof message.data === "object" ? message.data : message;
    const scriptId = typeof data.scriptId === "string" ? data.scriptId : "";
    const suppliedToken = typeof data.scriptAuthToken === "string" ? data.scriptAuthToken : "";
    if (!scriptId || !suppliedToken) {
      throw new Error("GM request could not be authenticated for this script");
    }
    const expectedToken = await getScriptAuthToken(scriptId);
    if (!constantTimeEqual(suppliedToken, expectedToken)) {
      throw new Error("GM request could not be authenticated for this script");
    }
    return { ...sender, userScriptId: scriptId };
  }
  async function isScriptAuthRegistrationCurrent() {
    const stored = await chrome.storage.local.get(SCRIPT_AUTH_REGISTRATION_KEY);
    return stored?.[SCRIPT_AUTH_REGISTRATION_KEY] === SCRIPT_AUTH_REGISTRATION_VERSION;
  }
  async function markScriptAuthRegistrationCurrent() {
    await chrome.storage.local.set({
      [SCRIPT_AUTH_REGISTRATION_KEY]: SCRIPT_AUTH_REGISTRATION_VERSION
    });
  }
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
    authenticateUserScriptSender,
    getScriptAuthToken,
    isExtensionSurfaceSender,
    isScriptAuthRegistrationCurrent,
    isUserScriptAllowedAction,
    markScriptAuthRegistrationCurrent
  });
  var user_script_message_policy_default = UserScriptMessagePolicy;
  return module.exports.default || module.exports.UserScriptMessagePolicy || module.exports;
})();
