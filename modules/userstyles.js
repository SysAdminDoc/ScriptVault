// ============================================================================
// Generated from src/modules/userstyles.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const UserStylesEngine = (() => {
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

  // src/modules/userstyles.ts
  var userstyles_exports = {};
  __export(userstyles_exports, {
    UserStylesEngine: () => UserStylesEngine
  });
  module.exports = __toCommonJS(userstyles_exports);
  var STORAGE_KEY = "sv_userstyles";
  var VARS_STORAGE_KEY = "sv_userstyle_vars";
  var META_REGEX = /\/\*\s*==UserStyle==\s*([\s\S]*?)==\/UserStyle==\s*\*\//;
  var VAR_TYPES = ["color", "text", "number", "select", "checkbox", "range"];
  var DIRECTIVE_REGEX = /^@(\S+)\s+(.*?)\s*$/;
  var _styles = {};
  var _customVars = {};
  var _initialized = false;
  var _registeredTabs = /* @__PURE__ */ new Map();
  var _injectingTabs = /* @__PURE__ */ new Set();
  async function _loadState() {
    try {
      const data = await chrome.storage.local.get([STORAGE_KEY, VARS_STORAGE_KEY]);
      _styles = data[STORAGE_KEY] ?? {};
      _customVars = data[VARS_STORAGE_KEY] ?? {};
    } catch (e) {
      console.error("[UserStylesEngine] Failed to load state:", e);
      _styles = {};
      _customVars = {};
    }
  }
  async function _saveStyles() {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: _styles });
    } catch (e) {
      console.error("[UserStylesEngine] Failed to save styles:", e);
    }
  }
  async function _saveVars() {
    try {
      await chrome.storage.local.set({ [VARS_STORAGE_KEY]: _customVars });
    } catch (e) {
      console.error("[UserStylesEngine] Failed to save variables:", e);
    }
  }
  function _parseVarDirective(type, rest) {
    const nameMatch = rest.match(/^(\S+)\s+"([^"]*?)"\s+([\s\S]*)$/);
    if (!nameMatch) {
      const simpleMatch = rest.match(/^(\S+)\s+(.*)$/);
      if (!simpleMatch) return null;
      return {
        type,
        name: simpleMatch[1] ?? "",
        label: simpleMatch[1] ?? "",
        default: (simpleMatch[2] ?? "").trim(),
        options: null
      };
    }
    const varName = nameMatch[1] ?? "";
    const label = nameMatch[2] ?? "";
    let defaultVal = (nameMatch[3] ?? "").trim();
    let options = null;
    switch (type) {
      case "color":
        break;
      case "text":
        if (/^".*"$/.test(defaultVal)) {
          defaultVal = defaultVal.slice(1, -1);
        }
        break;
      case "number":
        defaultVal = parseFloat(defaultVal) || 0;
        break;
      case "checkbox":
        defaultVal = defaultVal === "1" || defaultVal === "true";
        break;
      case "select": {
        const braceMatch = defaultVal.match(/^\{([\s\S]*)\}$/);
        if (braceMatch) {
          const inner = braceMatch[1] ?? "";
          try {
            const parsed = JSON.parse(`{${inner}}`);
            options = parsed;
            defaultVal = Object.keys(parsed)[0] ?? "";
          } catch {
            const pairs = inner.split("|");
            let firstKey = null;
            const selectOptions = {};
            for (const pair of pairs) {
              const kv = pair.match(/^"?([^":]+)"?\s*:\s*"?([^"|]*)"?\s*$/);
              if (kv) {
                const key = (kv[1] ?? "").trim();
                const val = (kv[2] ?? "").trim();
                selectOptions[key] = val;
                if (!firstKey) firstKey = key;
              }
            }
            options = selectOptions;
            defaultVal = firstKey ?? "";
          }
        }
        break;
      }
      case "range": {
        const arrMatch = defaultVal.match(/^\[([\s\S]*)\]$/);
        if (arrMatch) {
          const parts = (arrMatch[1] ?? "").split(",").map((s) => parseFloat(s.trim()));
          options = {
            min: parts[0] ?? 0,
            max: parts[1] ?? 100,
            step: parts[2] ?? 1
          };
          defaultVal = parts[3] ?? parts[0] ?? 0;
        } else {
          defaultVal = parseFloat(defaultVal) || 0;
          options = { min: 0, max: 100, step: 1 };
        }
        break;
      }
    }
    return { type, name: varName, label, default: defaultVal, options };
  }
  function parseUserCSS(code) {
    const metaMatch = code.match(META_REGEX);
    if (!metaMatch) {
      return { error: "No ==UserStyle== metadata block found." };
    }
    const meta = {
      name: "Unnamed Style",
      namespace: "scriptvault",
      version: "1.0.0",
      description: "",
      author: "",
      license: "",
      preprocessor: "default",
      homepageURL: "",
      supportURL: "",
      updateURL: ""
    };
    const variables = [];
    const matchPatterns = [];
    const metaBlock = metaMatch[1] ?? "";
    const lines = metaBlock.split("\n");
    for (const line of lines) {
      const trimmed = line.replace(/^\s*\*?\s*/, "").trim();
      if (!trimmed || trimmed.startsWith("//")) continue;
      const match = trimmed.match(DIRECTIVE_REGEX);
      if (!match) continue;
      const key = match[1] ?? "";
      const value = match[2] ?? "";
      if (key === "var") {
        const varTypeMatch = value.match(/^(\S+)\s+([\s\S]+)$/);
        if (varTypeMatch && VAR_TYPES.includes(varTypeMatch[1])) {
          const parsed = _parseVarDirective(varTypeMatch[1], varTypeMatch[2] ?? "");
          if (parsed) variables.push(parsed);
        }
      } else if (key === "match" && value) {
        matchPatterns.push(value);
      } else if (key in meta) {
        meta[key] = value;
      }
    }
    const metaEnd = code.indexOf("==/UserStyle==");
    const afterMeta = code.indexOf("*/", metaEnd);
    let css = "";
    if (afterMeta !== -1) {
      css = code.substring(afterMeta + 2).trim();
    }
    return {
      meta,
      variables,
      match: matchPatterns.length ? matchPatterns : ["*://*/*"],
      css
    };
  }
  function _substituteVariables(css, variables, customValues) {
    let result = css;
    for (const v of variables) {
      const val = customValues && customValues[v.name] !== void 0 ? customValues[v.name] : v.default;
      const placeholder = new RegExp(
        "/\\*\\[\\[" + _escapeRegex(v.name) + "\\]\\]\\*/",
        "g"
      );
      result = result.replace(placeholder, String(val));
      const anglePlaceholder = new RegExp(
        "<<" + _escapeRegex(v.name) + ">>",
        "g"
      );
      result = result.replace(anglePlaceholder, String(val));
    }
    return result;
  }
  function _escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  function _buildCSS(styleId) {
    const style = _styles[styleId];
    if (!style) return "";
    const vars = style.variables ?? [];
    const custom = _customVars[styleId] ?? {};
    return _substituteVariables(style.css, vars, custom);
  }
  async function registerStyle(style) {
    if (!_initialized) await _loadState();
    const id = style.id ?? `usercss_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const entry = {
      id,
      type: "usercss",
      meta: style.meta ?? {},
      variables: style.variables ?? [],
      css: style.css ?? "",
      rawCode: style.rawCode ?? "",
      enabled: style.enabled !== false,
      match: style.match ?? ["*://*/*"],
      installDate: style.installDate ?? Date.now(),
      updateDate: Date.now()
    };
    _styles[id] = entry;
    await _saveStyles();
    if (entry.enabled) {
      await _injectStyleToMatchingTabs(id);
    }
    return id;
  }
  async function unregisterStyle(styleId) {
    if (!_initialized) await _loadState();
    await _removeStyleFromAllTabs(styleId);
    delete _styles[styleId];
    delete _customVars[styleId];
    await Promise.all([_saveStyles(), _saveVars()]);
  }
  async function toggleStyle(styleId, enabled) {
    if (!_initialized) await _loadState();
    const style = _styles[styleId];
    if (!style) return;
    style.enabled = enabled;
    await _saveStyles();
    if (enabled) {
      await _injectStyleToMatchingTabs(styleId);
    } else {
      await _removeStyleFromAllTabs(styleId);
    }
  }
  async function _injectStyleToMatchingTabs(styleId) {
    const style = _styles[styleId];
    if (!style?.enabled) return;
    const css = _buildCSS(styleId);
    if (!css) return;
    try {
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.id == null) continue;
        if (_urlMatchesPatterns(tab.url, style.match)) {
          const tabStyles = _registeredTabs.get(tab.id) ?? /* @__PURE__ */ new Map();
          const previousCss = tabStyles.get(styleId);
          try {
            if (previousCss && previousCss !== css) {
              try {
                await chrome.scripting.removeCSS({
                  target: { tabId: tab.id },
                  css: previousCss
                });
              } catch {
              }
            }
            await chrome.scripting.insertCSS({
              target: { tabId: tab.id },
              css
            });
            tabStyles.set(styleId, css);
            _registeredTabs.set(tab.id, tabStyles);
          } catch {
          }
        }
      }
    } catch (e) {
      console.error("[UserStylesEngine] Inject failed:", e);
    }
  }
  async function _removeStyleFromAllTabs(styleId) {
    try {
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.id == null) continue;
        const tabStyles = _registeredTabs.get(tab.id);
        if (!tabStyles) continue;
        const registeredCss = tabStyles.get(styleId);
        if (registeredCss) {
          try {
            await chrome.scripting.removeCSS({
              target: { tabId: tab.id },
              css: registeredCss
            });
            tabStyles.delete(styleId);
            if (tabStyles.size === 0) {
              _registeredTabs.delete(tab.id);
            }
          } catch {
          }
        }
      }
    } catch (e) {
      console.error("[UserStylesEngine] Remove failed:", e);
    }
  }
  function _urlMatchesPatterns(url, patterns) {
    if (!url || !patterns || patterns.length === 0) return false;
    for (const pattern of patterns) {
      if (pattern === "*://*/*" || pattern === "<all_urls>") return true;
      try {
        const regex = _matchPatternToRegex(pattern);
        if (regex.test(url)) return true;
      } catch {
        if (_globMatch(url, pattern)) return true;
      }
    }
    return false;
  }
  function _matchPatternToRegex(pattern) {
    const match = pattern.match(/^(\*|http|https|file|ftp):\/\/([^/]*)(\/.*)$/);
    if (!match) {
      throw new Error(`Invalid match pattern: ${pattern}`);
    }
    const scheme = match[1] ?? "";
    const host = match[2] ?? "";
    const path = match[3] ?? "";
    const schemeRegex = scheme === "*" ? "https?" : _escapeRegex(scheme);
    let hostRegex = "";
    if (scheme !== "file") {
      if (host === "*") {
        hostRegex = "[^/]+";
      } else if (host.startsWith("*.")) {
        hostRegex = `(?:[^/]+\\.)*${_escapeRegex(host.slice(2))}`;
      } else {
        hostRegex = _escapeRegex(host);
      }
    }
    const pathRegex = path.split("*").map((segment) => _escapeRegex(segment)).join(".*");
    return new RegExp(`^${schemeRegex}:\\/\\/${hostRegex}${pathRegex}$`);
  }
  function _globMatch(url, glob) {
    const regex = glob.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    return new RegExp("^" + regex + "$").test(url);
  }
  function getVariables(styleId) {
    const style = _styles[styleId];
    if (!style) return null;
    const custom = _customVars[styleId] ?? {};
    return (style.variables ?? []).map((v) => ({
      ...v,
      current: custom[v.name] !== void 0 ? custom[v.name] : v.default
    }));
  }
  async function setVariables(styleId, values) {
    if (!_initialized) await _loadState();
    const style = _styles[styleId];
    if (!style) return;
    if (!_customVars[styleId]) _customVars[styleId] = {};
    for (const [key, val] of Object.entries(values)) {
      _customVars[styleId][key] = val;
    }
    await _saveVars();
    if (style.enabled) {
      await _removeStyleFromAllTabs(styleId);
      await _injectStyleToMatchingTabs(styleId);
    }
  }
  function convertToUserscript(usercssCode) {
    const parsed = parseUserCSS(usercssCode);
    if (parsed.error) return { error: parsed.error };
    const meta = parsed.meta;
    const variables = parsed.variables;
    const matchPatterns = parsed.match ?? ["*://*/*"];
    const css = parsed.css;
    const defaults = {};
    for (const v of variables) {
      defaults[v.name] = v.default;
    }
    const finalCSS = _substituteVariables(css, variables, defaults);
    const escapedCSS = finalCSS.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");
    const matchDirectives = matchPatterns.map((pattern) => `// @match        ${pattern}`);
    const grantDirective = "// @grant        GM_addStyle";
    const script = [
      "// ==UserScript==",
      `// @name         ${meta.name}`,
      `// @namespace    ${meta.namespace}`,
      `// @version      ${meta.version}`,
      `// @description  ${meta.description}`,
      `// @author       ${meta.author}`,
      ...matchDirectives,
      grantDirective,
      "// @run-at       document-start",
      "// ==/UserScript==",
      "",
      "(function () {",
      "  'use strict';",
      "",
      "  const css = `",
      escapedCSS,
      "  `;",
      "",
      "  if (typeof GM_addStyle === 'function') {",
      "    GM_addStyle(css);",
      "  } else {",
      "    const style = document.createElement('style');",
      "    style.textContent = css;",
      "    (document.head || document.documentElement).appendChild(style);",
      "  }",
      "})();"
    ].join("\n");
    return { script, meta };
  }
  async function importStylusBackup(json) {
    if (!_initialized) await _loadState();
    let stylusStyles;
    try {
      const parsed = typeof json === "string" ? JSON.parse(json) : json;
      stylusStyles = Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { imported: 0, errors: ["Invalid JSON: " + message] };
    }
    let imported = 0;
    const errors = [];
    for (const sStyle of stylusStyles) {
      try {
        const style = _convertStylusStyle(sStyle);
        if (style) {
          await registerStyle(style);
          imported++;
        } else {
          errors.push(`Skipped style: ${sStyle.name ?? "unknown"} (no usable sections)`);
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        errors.push(`Failed to import "${sStyle.name ?? "unknown"}": ${message}`);
      }
    }
    return { imported, errors };
  }
  function _convertStylusStyle(sStyle) {
    if (!sStyle.sections || sStyle.sections.length === 0) return null;
    const cssParts = [];
    const matchPatterns = /* @__PURE__ */ new Set();
    for (const section of sStyle.sections) {
      const sectionCSS = section.code ?? "";
      if (section.urls && section.urls.length) {
        for (const url of section.urls) {
          matchPatterns.add(_urlToMatchPattern(url));
        }
      }
      if (section.urlPrefixes && section.urlPrefixes.length) {
        for (const prefix of section.urlPrefixes) {
          matchPatterns.add(_urlPrefixToMatchPattern(prefix));
        }
      }
      if (section.domains && section.domains.length) {
        for (const domain of section.domains) {
          matchPatterns.add(`*://${domain}/*`);
          matchPatterns.add(`*://*.${domain}/*`);
        }
      }
      if (section.regexps && section.regexps.length) {
        matchPatterns.add("*://*/*");
      }
      if (!section.urls?.length && !section.urlPrefixes?.length && !section.domains?.length && !section.regexps?.length) {
        matchPatterns.add("*://*/*");
      }
      cssParts.push(sectionCSS);
    }
    const match = [...matchPatterns];
    if (match.length === 0) match.push("*://*/*");
    return {
      meta: {
        name: sStyle.name ?? "Imported Style",
        namespace: "stylus-import",
        version: "1.0.0",
        description: `Imported from Stylus on ${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}`,
        author: sStyle.author ?? "",
        license: "",
        preprocessor: "default",
        homepageURL: "",
        supportURL: "",
        updateURL: ""
      },
      variables: [],
      css: cssParts.join("\n\n"),
      rawCode: "",
      match,
      enabled: sStyle.enabled !== false,
      installDate: sStyle.installDate ?? Date.now()
    };
  }
  function _urlToMatchPattern(url) {
    try {
      const u = new URL(url);
      return `${u.protocol}//${u.hostname}${u.pathname}`;
    } catch {
      return "*://*/*";
    }
  }
  function _urlPrefixToMatchPattern(prefix) {
    try {
      const u = new URL(prefix);
      return `${u.protocol}//${u.hostname}${u.pathname}*`;
    } catch {
      return "*://*/*";
    }
  }
  function isUserCSSUrl(url) {
    if (!url) return false;
    try {
      const pathname = new URL(url).pathname;
      return pathname.endsWith(".user.css");
    } catch {
      return false;
    }
  }
  async function onTabUpdated(tabId, url) {
    if (!url) return;
    if (_injectingTabs.has(tabId)) return;
    _injectingTabs.add(tabId);
    try {
      if (!_initialized) await _loadState();
      for (const [styleId, style] of Object.entries(_styles)) {
        if (!style.enabled) continue;
        if (!_urlMatchesPatterns(url, style.match)) continue;
        const css = _buildCSS(styleId);
        if (!css) continue;
        try {
          const tabStyles = _registeredTabs.get(tabId) ?? /* @__PURE__ */ new Map();
          const previousCss = tabStyles.get(styleId);
          if (previousCss && previousCss !== css) {
            try {
              await chrome.scripting.removeCSS({
                target: { tabId },
                css: previousCss
              });
            } catch {
            }
          }
          await chrome.scripting.insertCSS({
            target: { tabId },
            css
          });
          tabStyles.set(styleId, css);
          _registeredTabs.set(tabId, tabStyles);
        } catch {
        }
      }
    } finally {
      _injectingTabs.delete(tabId);
    }
  }
  function onTabRemoved(tabId) {
    _registeredTabs.delete(tabId);
  }
  async function init() {
    if (_initialized) return;
    await _loadState();
    _initialized = true;
  }
  function getStyles() {
    return { ..._styles };
  }
  function getStyle(styleId) {
    return _styles[styleId] ?? null;
  }
  async function updateCSS(styleId, newCSS) {
    if (!_initialized) await _loadState();
    const style = _styles[styleId];
    if (!style) return;
    if (META_REGEX.test(newCSS)) {
      const parsed = parseUserCSS(newCSS);
      if (!parsed.error) {
        style.meta = parsed.meta;
        style.variables = parsed.variables;
        style.match = parsed.match;
        style.css = parsed.css;
        style.rawCode = newCSS;
      }
    } else {
      style.css = newCSS;
    }
    style.updateDate = Date.now();
    await _saveStyles();
    if (style.enabled) {
      await _removeStyleFromAllTabs(styleId);
      await _injectStyleToMatchingTabs(styleId);
    }
  }
  var UserStylesEngine = {
    init,
    parseUserCSS,
    registerStyle,
    unregisterStyle,
    toggleStyle,
    getVariables,
    setVariables,
    getStyles,
    getStyle,
    updateCSS,
    convertToUserscript,
    importStylusBackup,
    isUserCSSUrl,
    onTabUpdated,
    onTabRemoved
  };
  return module.exports.default || module.exports.UserStylesEngine || module.exports;
})();
