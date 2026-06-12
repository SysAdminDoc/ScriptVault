// ============================================================================
// Generated from src/modules/user-scripts-setup.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const UserScriptsSetupDoctor = (() => {
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

  // src/modules/user-scripts-setup.ts
  var user_scripts_setup_exports = {};
  __export(user_scripts_setup_exports, {
    UserScriptsSetupDoctor: () => UserScriptsSetupDoctor,
    buildSetupDoctorView: () => buildSetupDoctorView,
    default: () => user_scripts_setup_default
  });
  module.exports = __toCommonJS(user_scripts_setup_exports);
  var EXTENSIONS_PAGE = "chrome://extensions";
  function toNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  function extensionDetailsUrl(extensionId = "") {
    return extensionId ? `${EXTENSIONS_PAGE}/?id=${extensionId}` : EXTENSIONS_PAGE;
  }
  function normalizeSetupState(status = {}, context = {}) {
    const raw = String(status.setupState || "").trim();
    if (raw) return raw;
    if (status.needsHostAccess) return "host-permission-needed";
    if (status.userScriptsAvailable === true || status.setupRequired === false) return "available";
    const browserName = String(context.browserName || "").toLowerCase();
    if (browserName === "firefox") return "firefox-user-scripts-permission";
    const chromeVersion = toNumber(status.chromeVersion, toNumber(context.chromeVersion));
    if (chromeVersion >= 138) return "allow-user-scripts-disabled";
    if (chromeVersion >= 120) return "developer-mode-disabled";
    return "unsupported-browser";
  }
  function buildView(status, context) {
    const setupState = normalizeSetupState(status, context);
    const chromeVersion = toNumber(status.chromeVersion, toNumber(context.chromeVersion));
    const detailsUrl = status.setupUrl || extensionDetailsUrl(context.extensionId);
    switch (setupState) {
      case "available":
        return {
          setupState,
          ready: true,
          title: "Runtime ready",
          message: "userScripts API is available and ready for registrations.",
          bannerText: "Runtime looks ready for script injection.",
          actionLabel: "Refresh Status",
          actionKind: "refresh",
          setupUrl: "",
          detailLines: [
            `Chrome ${chromeVersion || "unknown"}`,
            "Status: available",
            "userScripts API is available and ready for registrations.",
            "Runtime looks ready for script injection."
          ],
          helpTitle: "Runtime Ready",
          helpSteps: ["No setup action is required. Reload target pages if scripts were enabled while a page was already open."]
        };
      case "firefox-user-scripts-permission":
        return {
          setupState,
          ready: false,
          title: status.setupTitle || "Firefox userScripts permission required",
          message: status.setupMessage || "Grant ScriptVault the optional Firefox userScripts permission, then refresh runtime status.",
          bannerText: "Setup required: grant the optional userScripts permission so Firefox can register userscripts.",
          actionLabel: status.setupAction || "Grant Permission",
          actionKind: "request-firefox-user-scripts",
          setupUrl: "",
          detailLines: [
            `Chrome ${chromeVersion || "unknown"}`,
            "Status: firefox-user-scripts-permission",
            "userScripts API is unavailable until Firefox grants ScriptVault the optional userScripts permission.",
            status.setupMessage || "Grant ScriptVault the optional Firefox userScripts permission, then refresh runtime status."
          ],
          helpTitle: "Grant Firefox userScripts Permission",
          helpSteps: [
            "Click Grant Permission in the setup banner.",
            "Approve Firefox's permission prompt for ScriptVault.",
            "Refresh runtime status, then reload any open target pages."
          ]
        };
      case "allow-user-scripts-disabled":
        return {
          setupState,
          ready: false,
          title: status.setupTitle || "Allow User Scripts is off",
          message: status.setupMessage || 'Open Extension Details, enable "Allow User Scripts" for ScriptVault, then refresh status; reload the extension if this banner remains.',
          bannerText: 'Setup required: ScriptVault needs the "Allow User Scripts" toggle for this extension. Open Extension Details, enable it, then refresh status; reload the extension if this banner remains.',
          actionLabel: status.setupAction || "Open Extension Details",
          actionKind: "open-extension-details",
          setupUrl: detailsUrl,
          detailLines: [
            `Chrome ${chromeVersion || "unknown"}`,
            "Status: allow-user-scripts-disabled",
            "userScripts API is unavailable in the current browser state.",
            status.setupMessage || 'Open Extension Details, enable "Allow User Scripts" for ScriptVault, then refresh status; reload the extension if this banner remains.',
            `Setup page: ${detailsUrl}`
          ],
          helpTitle: "Enable User Scripts (Chrome 138+)",
          helpSteps: [
            "Right-click the ScriptVault extension icon in your toolbar.",
            "Select Manage Extension.",
            "Find and enable the Allow User Scripts toggle.",
            "Refresh ScriptVault runtime status and reload open target pages."
          ]
        };
      case "developer-mode-disabled":
        return {
          setupState,
          ready: false,
          title: status.setupTitle || "Developer Mode required",
          message: status.setupMessage || "Open chrome://extensions and enable Developer Mode to run userscripts.",
          bannerText: "Setup required: enable Developer Mode in chrome://extensions so ScriptVault can inject userscripts.",
          actionLabel: status.setupAction || "Open Extensions Page",
          actionKind: "open-extensions-page",
          setupUrl: EXTENSIONS_PAGE,
          detailLines: [
            `Chrome ${chromeVersion || "unknown"}`,
            "Status: developer-mode-disabled",
            "userScripts API is unavailable in the current browser state.",
            status.setupMessage || "Open chrome://extensions and enable Developer Mode to run userscripts.",
            `Setup page: ${EXTENSIONS_PAGE}`
          ],
          helpTitle: "Enable Developer Mode",
          helpSteps: [
            "Open Chrome and go to chrome://extensions.",
            "Enable the Developer mode toggle in the top-right corner.",
            "Refresh ScriptVault runtime status and reload open target pages."
          ]
        };
      case "host-permission-needed": {
        const host = status.host || "this site";
        const usesHostAccessRequest = status.requestMethod === "addHostAccessRequest";
        return {
          setupState,
          ready: false,
          title: status.setupTitle || "Site access needed",
          message: status.message || status.setupMessage || `Grant ScriptVault browser access to ${host} before matching scripts can run.`,
          bannerText: status.message || status.setupMessage || `Grant ScriptVault browser access to ${host} before matching scripts can run.`,
          actionLabel: status.setupAction || (usesHostAccessRequest ? "Request Site Access" : "Grant Site Access"),
          actionKind: usesHostAccessRequest ? "queue-host-access-request" : "request-host-permission",
          setupUrl: "",
          detailLines: [
            `Target: ${host}`,
            `Pattern: ${status.pattern || "none"}`,
            status.message || status.setupMessage || "Host access status available.",
            `Recovery: ${status.requestMethod || "permissions.request"}.`
          ],
          helpTitle: "Grant Current Site Access",
          helpSteps: [
            "Use the setup banner or Runtime Repair panel to request access for the current site.",
            "Approve the browser permission prompt if one appears.",
            "Reload the target page after access is granted."
          ]
        };
      }
      default:
        return {
          setupState: "unsupported-browser",
          ready: false,
          title: status.setupTitle || "Unsupported browser",
          message: status.setupMessage || "ScriptVault userscripts require Chrome 120 or newer.",
          bannerText: "Browser unsupported: the chrome.userScripts API is not available. ScriptVault needs Chrome 120 or newer, or a Chromium derivative that exposes it.",
          actionLabel: status.setupAction || "Open Extensions Page",
          actionKind: "open-extensions-page",
          setupUrl: EXTENSIONS_PAGE,
          detailLines: [
            `Chrome ${chromeVersion || "unknown"}`,
            "Status: unsupported-browser",
            "userScripts API is unavailable in the current browser state.",
            status.setupMessage || "ScriptVault userscripts require Chrome 120 or newer."
          ],
          helpTitle: "Unsupported Browser",
          helpSteps: [
            "Use Chrome 120 or newer, or a Chromium browser that exposes chrome.userScripts.",
            "Refresh runtime status after upgrading or switching browsers."
          ]
        };
    }
  }
  function buildSetupDoctorView(status = {}, context = {}) {
    const view = buildView(status || {}, context || {});
    const extraLines = [];
    if (status.apiProbeError) extraLines.push(`API probe: ${status.apiProbeError}`);
    return {
      ...view,
      detailLines: [...view.detailLines, ...extraLines]
    };
  }
  var UserScriptsSetupDoctor = {
    buildSetupDoctorView
  };
  var user_scripts_setup_default = UserScriptsSetupDoctor;
  return module.exports.default || module.exports.UserScriptsSetupDoctor || module.exports;
})();

if (typeof self !== 'undefined') {
  self.UserScriptsSetupDoctor = UserScriptsSetupDoctor;
}
