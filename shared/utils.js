// ============================================================================
// Generated from src/shared/utils.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const SharedUtils = (() => {
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

  // src/shared/utils.ts
  var utils_exports = {};
  __export(utils_exports, {
    classifyInstallSource: () => classifyInstallSource,
    escapeHtml: () => escapeHtml,
    formatBytes: () => formatBytes,
    generateId: () => generateId,
    installBrowserNamespaceAlias: () => installBrowserNamespaceAlias,
    sanitizeUrl: () => sanitizeUrl
  });
  module.exports = __toCommonJS(utils_exports);
  function escapeHtml(str) {
    if (!str) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function generateId() {
    return "script_" + crypto.randomUUID();
  }
  function sanitizeUrl(url) {
    if (!url) return null;
    const trimmed = String(url).replace(/[\u0000-\u0020\u007f]+/g, "");
    if (!trimmed) return null;
    if (/^(javascript|data|vbscript|blob|file):/i.test(trimmed)) return null;
    if (/^(https?|ftp|mailto):/i.test(trimmed) || trimmed.startsWith("/") || trimmed.startsWith("#")) {
      return trimmed;
    }
    if (trimmed.startsWith("//")) return trimmed;
    if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null;
    return trimmed;
  }
  function hasExtensionRuntime(api) {
    if (!api || typeof api !== "object" && typeof api !== "function") return false;
    const runtime = api.runtime;
    if (!runtime || typeof runtime !== "object" && typeof runtime !== "function") return false;
    const rt = runtime;
    return typeof rt.id === "string" || typeof rt.sendMessage === "function" || typeof rt.getURL === "function";
  }
  function installBrowserNamespaceAlias(root = globalThis) {
    if (hasExtensionRuntime(root.browser)) {
      return { installed: false, source: root.browser === root.chrome ? "chrome-alias" : "native-browser" };
    }
    const chromeApi = root.chrome;
    if (!hasExtensionRuntime(chromeApi)) {
      return { installed: false, source: "unavailable", reason: "chrome.runtime unavailable" };
    }
    const descriptor = Object.getOwnPropertyDescriptor(root, "browser");
    if (descriptor && !descriptor.configurable) {
      if ("value" in descriptor && (descriptor.value === void 0 || descriptor.value === chromeApi)) {
        return { installed: false, source: descriptor.value === chromeApi ? "chrome-alias" : "unavailable" };
      }
      return { installed: false, source: "locked", reason: "browser property is not configurable" };
    }
    try {
      Object.defineProperty(root, "browser", {
        configurable: true,
        enumerable: false,
        writable: false,
        value: chromeApi
      });
      return { installed: true, source: "chrome-alias" };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { installed: false, source: "locked", reason: message };
    }
  }
  function classifyInstallSource(url) {
    if (typeof url !== "string" || !url.trim()) {
      return { id: "local", name: "Local import", hostname: "", tone: "neutral", url: "" };
    }
    let host = "";
    let path = "";
    try {
      const u = new URL(url);
      host = (u.hostname || "").toLowerCase();
      path = u.pathname || "";
    } catch (_) {
      return { id: "other", name: "Unknown source", hostname: "", tone: "warn", url };
    }
    if (host === "greasyfork.org" || host === "www.greasyfork.org") {
      return { id: "greasyfork", name: "Greasy Fork", hostname: host, tone: "good", url };
    }
    if (host === "sleazyfork.org" || host === "www.sleazyfork.org") {
      return { id: "sleazyfork", name: "Sleazy Fork", hostname: host, tone: "warn", url };
    }
    if (host === "openuserjs.org" || host === "www.openuserjs.org") {
      return { id: "openuserjs", name: "OpenUserJS", hostname: host, tone: "good", url };
    }
    if (host === "gist.github.com" || host === "gist.githubusercontent.com") {
      return { id: "github-gist", name: "GitHub Gist", hostname: host, tone: "neutral", url };
    }
    if (host === "raw.githubusercontent.com") {
      return { id: "github-raw", name: "GitHub raw", hostname: host, tone: "neutral", url };
    }
    if (host === "github.com" || host === "www.github.com") {
      if (/\/releases\/(download|latest)/i.test(path)) {
        return { id: "github-release", name: "GitHub release", hostname: host, tone: "good", url };
      }
      return { id: "github", name: "GitHub", hostname: host, tone: "neutral", url };
    }
    if (host === "gitlab.com" || host === "www.gitlab.com") {
      return { id: "gitlab", name: "GitLab", hostname: host, tone: "neutral", url };
    }
    if (host === "codeberg.org") {
      return { id: "codeberg", name: "Codeberg", hostname: host, tone: "neutral", url };
    }
    if (host === "bitbucket.org") {
      return { id: "bitbucket", name: "Bitbucket", hostname: host, tone: "neutral", url };
    }
    if (host === "tampermonkey.net" || host === "www.tampermonkey.net") {
      return { id: "tampermonkey", name: "Tampermonkey site", hostname: host, tone: "neutral", url };
    }
    return { id: "other", name: host || "Unknown source", hostname: host, tone: "warn", url };
  }
  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }
  return module.exports.default || module.exports;
})();

const escapeHtml = SharedUtils.escapeHtml;
const generateId = SharedUtils.generateId;
const sanitizeUrl = SharedUtils.sanitizeUrl;
const installBrowserNamespaceAlias = SharedUtils.installBrowserNamespaceAlias;
const classifyInstallSource = SharedUtils.classifyInstallSource;
const formatBytes = SharedUtils.formatBytes;

try {
  installBrowserNamespaceAlias(globalThis);
} catch (_) {}
