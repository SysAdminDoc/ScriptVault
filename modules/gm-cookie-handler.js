// ============================================================================
// Generated from src/background/gm-cookie-handler.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const GMCookieHandler = (() => {
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

  // src/background/gm-cookie-handler.ts
  var gm_cookie_handler_exports = {};
  __export(gm_cookie_handler_exports, {
    GMCookieHandler: () => GMCookieHandler,
    GM_COOKIE_ACTIONS: () => GM_COOKIE_ACTIONS,
    default: () => gm_cookie_handler_default,
    handleGMCookieMessage: () => handleGMCookieMessage,
    isGMCookieAction: () => isGMCookieAction
  });
  module.exports = __toCommonJS(gm_cookie_handler_exports);
  var GM_COOKIE_ACTIONS = [
    "GM_cookie_delete",
    "GM_cookie_list",
    "GM_cookie_set"
  ];
  var GM_COOKIE_ACTION_SET = new Set(GM_COOKIE_ACTIONS);
  function cookieGetAll() {
    return chrome.cookies.getAll;
  }
  function cookieSet() {
    return chrome.cookies.set;
  }
  function cookieRemove() {
    return chrome.cookies.remove;
  }
  function errorMessage(error) {
    if (error && typeof error === "object" && "message" in error) {
      const message = error.message;
      if (typeof message === "string") return message;
    }
    return String(error);
  }
  async function getCookieScript(data, sender) {
    const scriptId = sender.userScriptId || data.scriptId;
    if (!scriptId) return { error: "Missing script context" };
    const script = await ScriptStorage.get(scriptId);
    if (!script) return { error: "Script context not found" };
    return { script, scriptId };
  }
  async function enforceCookiePolicy(script, url) {
    const settings = await SettingsManager.get();
    const policy = evaluateScriptHostScopePolicy(script, url, "Cookie access", settings);
    return policy.allowed ? null : policy.error || "Cookie access denied";
  }
  function isGMCookieAction(action) {
    return typeof action === "string" && GM_COOKIE_ACTION_SET.has(action);
  }
  async function handleGMCookieMessage(action, data = {}, sender = {}) {
    switch (action) {
      case "GM_cookie_list": {
        try {
          const context = await getCookieScript(data, sender);
          if (context.error) return { error: context.error };
          const details = {};
          if (data.url) {
            if (!isHttpCookieUrl(data.url)) return { error: "url must be http(s)://" };
            details.url = data.url;
          }
          if (data.domain) details.domain = data.domain;
          if (data.name) details.name = data.name;
          if (data.path) details.path = data.path;
          const partition = normalizeCookiePartitionKey(data.partitionKey);
          if (partition.error) return { error: partition.error };
          if (partition.partitionKey) details.partitionKey = partition.partitionKey;
          const cookieTargetUrl = resolveCookiePolicyTarget(data, sender);
          if (!cookieTargetUrl) return { error: "url or domain is required for cookie list" };
          if (!isHttpCookieUrl(cookieTargetUrl)) return { error: "url must be http(s)://" };
          const policyError = await enforceCookiePolicy(context.script, cookieTargetUrl);
          if (policyError) return { error: policyError };
          if (!details.url && !details.domain) details.url = cookieTargetUrl;
          const cookies = await cookieGetAll()(details);
          return { success: true, cookies };
        } catch (error) {
          return { error: errorMessage(error) };
        }
      }
      case "GM_cookie_set": {
        try {
          if (!data.url) return { error: "url is required for cookie set" };
          if (!data.name) return { error: "name is required for cookie set" };
          if (!isHttpCookieUrl(data.url)) return { error: "url must be http(s)://" };
          const context = await getCookieScript(data, sender);
          if (context.error) return { error: context.error };
          const policyError = await enforceCookiePolicy(context.script, data.url);
          if (policyError) return { error: policyError };
          const partition = normalizeCookiePartitionKey(data.partitionKey);
          if (partition.error) return { error: partition.error };
          const cookie = await cookieSet()({
            url: data.url,
            name: data.name,
            value: data.value || "",
            domain: data.domain,
            path: data.path || "/",
            secure: data.secure || false,
            httpOnly: data.httpOnly || false,
            expirationDate: data.expirationDate,
            sameSite: data.sameSite || "unspecified",
            ...partition.partitionKey ? { partitionKey: partition.partitionKey } : {}
          });
          return { success: true, cookie };
        } catch (error) {
          return { error: errorMessage(error) };
        }
      }
      case "GM_cookie_delete": {
        try {
          if (!data.url || !data.name) return { error: "url and name are required for cookie delete" };
          if (!isHttpCookieUrl(data.url)) return { error: "url must be http(s)://" };
          const context = await getCookieScript(data, sender);
          if (context.error) return { error: context.error };
          const policyError = await enforceCookiePolicy(context.script, data.url);
          if (policyError) return { error: policyError };
          const partition = normalizeCookiePartitionKey(data.partitionKey);
          if (partition.error) return { error: partition.error };
          await cookieRemove()({
            url: data.url,
            name: data.name,
            ...partition.partitionKey ? { partitionKey: partition.partitionKey } : {}
          });
          return { success: true };
        } catch (error) {
          return { error: errorMessage(error) };
        }
      }
      default:
        return { error: `Unsupported GM_cookie action: ${action}` };
    }
  }
  var GMCookieHandler = Object.freeze({
    GM_COOKIE_ACTIONS,
    handleGMCookieMessage,
    isGMCookieAction
  });
  var gm_cookie_handler_default = GMCookieHandler;
  return module.exports.default || module.exports.GMCookieHandler || module.exports;
})();

if (typeof self !== 'undefined') {
  self.GMCookieHandler = GMCookieHandler;
}
