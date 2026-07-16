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
  var _draftPreviewTabs = /* @__PURE__ */ new Map();
  var _injectingTabs = /* @__PURE__ */ new Set();
  var _draftPreviewChain = Promise.resolve();
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
  function _stripQuotedValue(value) {
    const trimmed = value.trim();
    if (trimmed.length >= 2 && (trimmed.startsWith('"') && trimmed.endsWith('"') || trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.slice(1, -1);
    }
    return trimmed;
  }
  function _splitTopLevel(value, separator = ",") {
    const parts = [];
    let depth = 0;
    let quote = "";
    let start = 0;
    for (let index = 0; index < value.length; index++) {
      const char = value[index] ?? "";
      if (quote) {
        if (char === quote && value[index - 1] !== "\\") quote = "";
        continue;
      }
      if (char === '"' || char === "'") {
        quote = char;
      } else if (char === "(") {
        depth++;
      } else if (char === ")") {
        depth--;
      } else if (char === separator && depth === 0) {
        parts.push(value.slice(start, index).trim());
        start = index + 1;
      }
    }
    parts.push(value.slice(start).trim());
    return parts;
  }
  function _detectColorSpace(value) {
    const normalized = _stripQuotedValue(value).toLowerCase();
    if (/^#[0-9a-f]+$/i.test(normalized)) return "hex";
    if (/^rgba?\(/.test(normalized)) return "rgb";
    if (/^hsla?\(/.test(normalized)) return "hsl";
    if (/^oklch\(/.test(normalized)) return "oklch";
    if (/^oklab\(/.test(normalized)) return "oklab";
    if (/^[a-z][a-z0-9-]*$/i.test(normalized)) return "named";
    return "css";
  }
  function _validateColorValue(value, label = "Color") {
    if (typeof value !== "string") return `${label} must be a CSS color string.`;
    const color = _stripQuotedValue(value);
    if (!color) return `${label} cannot be empty.`;
    if (color.length > 256) return `${label} must be 256 characters or fewer.`;
    if (/[;{}\x00-\x1f\x7f]/.test(color)) return `${label} contains unsafe CSS characters.`;
    if (/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color)) return "";
    if (/^(?:transparent|currentcolor|canvas|canvastext|accentcolor|accentcolortext|[a-z]+)$/i.test(color)) return "";
    const functional = color.match(/^([a-z][a-z0-9-]*)\(([\s\S]*)\)$/i);
    if (!functional) return `${label} is not a supported CSS color.`;
    const functionName = (functional[1] ?? "").toLowerCase();
    const body = functional[2] ?? "";
    const supported = /* @__PURE__ */ new Set([
      "rgb",
      "rgba",
      "hsl",
      "hsla",
      "hwb",
      "lab",
      "lch",
      "oklab",
      "oklch",
      "color",
      "color-mix",
      "light-dark",
      "var"
    ]);
    if (!supported.has(functionName)) return `${label} uses unsupported ${functionName}() syntax.`;
    let depth = 0;
    for (const char of body) {
      if (char === "(") depth++;
      if (char === ")") depth--;
      if (depth < 0) return `${label} has unbalanced parentheses.`;
    }
    if (depth !== 0) return `${label} has unbalanced parentheses.`;
    if (functionName === "light-dark") {
      const choices = _splitTopLevel(body);
      if (choices.length !== 2) return `${label} light-dark() requires light and dark colors.`;
      return _validateColorValue(choices[0], `${label} light value`) || _validateColorValue(choices[1], `${label} dark value`);
    }
    if (functionName === "oklab" || functionName === "oklch") {
      const components = body.split("/")[0]?.trim().split(/\s+/).filter(Boolean) ?? [];
      if (components.length !== 3) return `${label} ${functionName}() requires three components.`;
    }
    if (functionName === "hsl" || functionName === "hsla") {
      const components = body.includes(",") ? _splitTopLevel(body) : body.split("/")[0]?.trim().split(/\s+/).filter(Boolean) ?? [];
      if (components.length < 3) return `${label} ${functionName}() requires hue, saturation, and lightness.`;
    }
    return "";
  }
  function _parseAdvancedColorValue(rawValue) {
    const annotations = [];
    const annotationRegex = /\s+@(group|light|dark)\s+/gi;
    let match;
    while ((match = annotationRegex.exec(rawValue)) !== null) {
      annotations.push({
        name: (match[1] ?? "").toLowerCase(),
        start: match.index,
        valueStart: annotationRegex.lastIndex
      });
    }
    const base = _stripQuotedValue(rawValue.slice(0, annotations[0]?.start ?? rawValue.length));
    let group = "";
    let light = "";
    let dark = "";
    annotations.forEach((annotation, index) => {
      const end = annotations[index + 1]?.start ?? rawValue.length;
      const annotationValue = _stripQuotedValue(rawValue.slice(annotation.valueStart, end));
      if (annotation.name === "group") group = annotationValue.replace(/^#/, "");
      if (annotation.name === "light") light = annotationValue;
      if (annotation.name === "dark") dark = annotationValue;
    });
    const colorSchemes = light || dark ? { light: light || base, dark: dark || base } : void 0;
    return {
      value: base,
      ...group ? { group } : {},
      ...colorSchemes ? { colorSchemes } : {}
    };
  }
  function _parseVarDirective(type, rest) {
    const nameMatch = rest.match(/^(\S+)\s+"([^"]*?)"\s+([\s\S]*)$/);
    let varName;
    let label;
    let defaultVal;
    if (nameMatch) {
      varName = nameMatch[1] ?? "";
      label = nameMatch[2] ?? "";
      defaultVal = (nameMatch[3] ?? "").trim();
    } else {
      const simpleMatch = rest.match(/^(\S+)\s+(.*)$/);
      if (!simpleMatch) return null;
      varName = simpleMatch[1] ?? "";
      label = varName;
      defaultVal = (simpleMatch[2] ?? "").trim();
    }
    let options = null;
    let group;
    let colorSpace;
    let colorSchemes;
    switch (type) {
      case "color":
        {
          const advanced = _parseAdvancedColorValue(String(defaultVal));
          defaultVal = advanced.value;
          group = advanced.group;
          colorSchemes = advanced.colorSchemes;
          colorSpace = _detectColorSpace(advanced.value);
        }
        break;
      case "text":
        if (/^"[\s\S]*"$/.test(defaultVal)) {
          try {
            defaultVal = JSON.parse(defaultVal);
          } catch {
            defaultVal = defaultVal.slice(1, -1);
          }
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
    return {
      type,
      name: varName,
      label,
      default: defaultVal,
      options,
      ...group ? { group } : {},
      ...colorSpace ? { colorSpace } : {},
      ...colorSchemes ? { colorSchemes } : {}
    };
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
    const validation = validateUserCSSVariables(variables);
    if (!validation.valid) {
      return { error: validation.errors.join(" ") };
    }
    return {
      meta,
      variables,
      match: matchPatterns.length ? matchPatterns : ["*://*/*"],
      css
    };
  }
  function _isColorSchemeValue(value) {
    return !!value && typeof value === "object" && !Array.isArray(value) && typeof value.light === "string" && typeof value.dark === "string";
  }
  function _validateVariableValue(variable, value) {
    if (variable.type === "color") {
      if (_isColorSchemeValue(value)) {
        return _validateColorValue(value.light, `${variable.label} light color`) || _validateColorValue(value.dark, `${variable.label} dark color`);
      }
      return _validateColorValue(value, variable.label || variable.name);
    }
    if (variable.type === "checkbox" && typeof value !== "boolean") {
      return `${variable.label || variable.name} must be true or false.`;
    }
    if ((variable.type === "number" || variable.type === "range") && (typeof value !== "number" || !Number.isFinite(value))) {
      return `${variable.label || variable.name} must be a finite number.`;
    }
    if (variable.type === "select" && variable.options && !Object.prototype.hasOwnProperty.call(variable.options, String(value))) {
      return `${variable.label || variable.name} must use a configured option.`;
    }
    if (variable.type === "text" && typeof value === "string") {
      if (value.length > 8192) {
        return `${variable.label || variable.name} must be 8192 characters or fewer.`;
      }
      if (/[{}\x00-\x1f\x7f]/.test(value)) {
        return `${variable.label || variable.name} contains unsafe CSS characters.`;
      }
    }
    if (typeof value === "object") return `${variable.label || variable.name} has an invalid value.`;
    return "";
  }
  function validateUserCSSVariables(variables, values = {}) {
    const errors = [];
    const names = /* @__PURE__ */ new Set();
    const reservedNames = /* @__PURE__ */ new Set(["__proto__", "prototype", "constructor"]);
    for (const variable of variables) {
      if (!/^-?[_a-z][\w-]*$/i.test(variable.name) || reservedNames.has(variable.name.toLowerCase())) {
        errors.push("UserCSS variable names must be non-empty CSS identifiers.");
        continue;
      }
      if (names.has(variable.name)) {
        errors.push(`Duplicate UserCSS variable: ${variable.name}.`);
        continue;
      }
      names.add(variable.name);
      if (variable.group && !/^[a-z0-9_-]{1,64}$/i.test(variable.group)) {
        errors.push(`${variable.label || variable.name} has an invalid color group.`);
      }
      const defaultError = _validateVariableValue(variable, variable.colorSchemes ?? variable.default);
      if (defaultError) errors.push(defaultError);
    }
    for (const [name, value] of Object.entries(values)) {
      const variable = variables.find((candidate) => candidate.name === name);
      if (!variable) {
        errors.push(`Unknown UserCSS variable: ${name}.`);
        continue;
      }
      const valueError = _validateVariableValue(variable, value);
      if (valueError) errors.push(valueError);
    }
    return { valid: errors.length === 0, errors };
  }
  function _expandLinkedGroupValues(variables, values) {
    const expanded = { ...values };
    for (const [name, value] of Object.entries(values)) {
      const source = variables.find((variable) => variable.name === name);
      if (!source?.group || source.type !== "color") continue;
      for (const linked of variables) {
        if (linked.type === "color" && linked.group === source.group) {
          expanded[linked.name] = value;
        }
      }
    }
    return expanded;
  }
  function _substituteVariables(css, variables, customValues, colorScheme = "auto") {
    if (colorScheme === "auto" && variables.some((variable) => {
      const configured = customValues && customValues[variable.name] !== void 0 ? customValues[variable.name] : variable.colorSchemes ?? variable.default;
      return _isColorSchemeValue(configured);
    })) {
      const lightCSS = _substituteVariables(css, variables, customValues, "light");
      const darkCSS = _substituteVariables(css, variables, customValues, "dark");
      return `${lightCSS}
  @media (prefers-color-scheme: dark) {
  ${darkCSS}
  }`;
    }
    let result = css;
    for (const v of variables) {
      const configured = customValues && customValues[v.name] !== void 0 ? customValues[v.name] : v.colorSchemes ?? v.default;
      let val;
      if (_isColorSchemeValue(configured)) {
        val = colorScheme === "dark" ? configured.dark : configured.light;
      } else {
        val = configured;
      }
      const replacement = String(val);
      const placeholder = new RegExp(
        "/\\*\\[\\[" + _escapeRegex(v.name) + "\\]\\]\\*/",
        "g"
      );
      result = result.replace(placeholder, () => replacement);
      const anglePlaceholder = new RegExp(
        "<<" + _escapeRegex(v.name) + ">>",
        "g"
      );
      result = result.replace(anglePlaceholder, () => replacement);
      result = _replaceCssVarAliases(result, v.name, replacement);
    }
    return result;
  }
  function _replaceCssVarAliases(css, name, replacement) {
    const open = new RegExp("var\\(\\s*--" + _escapeRegex(name) + "\\s*(?=[,)])", "g");
    let result = "";
    let lastIndex = 0;
    let match;
    while ((match = open.exec(css)) !== null) {
      let depth = 1;
      let end = match.index + match[0].length;
      while (end < css.length && depth > 0) {
        const char = css[end] ?? "";
        if (char === "(") depth++;
        else if (char === ")") depth--;
        end++;
      }
      if (depth !== 0) break;
      result += css.slice(lastIndex, match.index) + replacement;
      lastIndex = end;
      open.lastIndex = end;
    }
    return result + css.slice(lastIndex);
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
  function _buildDraftPreviewCSS(usercssCode, options = {}) {
    const parsed = parseUserCSS(usercssCode);
    if (parsed.error) return { error: parsed.error };
    const variables = parsed.variables ?? [];
    const defaults = {};
    for (const variable of variables) {
      defaults[variable.name] = variable.colorSchemes ?? variable.default;
    }
    const providedValues = options.values ?? {};
    const validation = validateUserCSSVariables(variables, providedValues);
    if (!validation.valid) return { error: validation.errors.join(" ") };
    const values = { ...defaults, ..._expandLinkedGroupValues(variables, providedValues) };
    const css = _substituteVariables(
      parsed.css ?? "",
      variables,
      values,
      options.colorScheme ?? "auto"
    ).trim();
    if (!css) return { error: "UserCSS draft has no CSS to preview." };
    return {
      css,
      match: parsed.match ?? ["*://*/*"],
      styleName: parsed.meta?.name || "UserCSS draft"
    };
  }
  async function _getPreviewTab(tabId) {
    if (typeof tabId === "number") {
      try {
        return await chrome.tabs.get(tabId);
      } catch {
        return null;
      }
    }
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return activeTab ?? null;
  }
  async function _removeDraftPreviewFromTab(tabId) {
    const previousCss = _draftPreviewTabs.get(tabId);
    if (!previousCss) return false;
    try {
      await chrome.scripting.removeCSS({
        target: { tabId },
        css: previousCss
      });
    } catch {
    }
    _draftPreviewTabs.delete(tabId);
    return true;
  }
  function _enqueueDraftPreviewTask(task) {
    const queued = _draftPreviewChain.then(task, task);
    _draftPreviewChain = queued.catch(() => void 0);
    return queued;
  }
  function clearDraftPreview(options = {}) {
    return _enqueueDraftPreviewTask(() => _clearDraftPreviewNow(options));
  }
  async function _clearDraftPreviewNow(options = {}) {
    if (typeof options.tabId === "number") {
      const cleared2 = await _removeDraftPreviewFromTab(options.tabId);
      return { success: true, cleared: cleared2 ? 1 : 0 };
    }
    let cleared = 0;
    for (const tabId of Array.from(_draftPreviewTabs.keys())) {
      if (await _removeDraftPreviewFromTab(tabId)) cleared++;
    }
    return { success: true, cleared };
  }
  function previewDraft(usercssCode, options = {}) {
    return _enqueueDraftPreviewTask(() => _previewDraftNow(usercssCode, options));
  }
  async function _previewDraftNow(usercssCode, options = {}) {
    const built = _buildDraftPreviewCSS(usercssCode, options);
    if (built.error || !built.css || !built.match) return { error: built.error || "Unable to preview UserCSS draft." };
    const tab = await _getPreviewTab(options.tabId);
    if (tab?.id == null) return { error: "No active tab is available for preview." };
    if (!_urlMatchesPatterns(tab.url, built.match)) {
      return { error: "The UserCSS @match rules do not include the preview tab." };
    }
    await _removeDraftPreviewFromTab(tab.id);
    try {
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        css: built.css
      });
      _draftPreviewTabs.set(tab.id, built.css);
      return {
        success: true,
        tabId: tab.id,
        tabUrl: tab.url || "",
        styleName: built.styleName,
        cssBytes: built.css.length
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      _draftPreviewTabs.delete(tab.id);
      return { error: message || "Failed to inject UserCSS preview." };
    }
  }
  async function registerStyle(style) {
    if (!_initialized) await _loadState();
    const variableValidation = validateUserCSSVariables(style.variables ?? []);
    if (!variableValidation.valid) throw new Error(variableValidation.errors.join(" "));
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
      current: custom[v.name] !== void 0 ? custom[v.name] : v.colorSchemes ?? v.default
    }));
  }
  async function setVariables(styleId, values) {
    if (!_initialized) await _loadState();
    const style = _styles[styleId];
    if (!style) return;
    const validation = validateUserCSSVariables(style.variables ?? [], values);
    if (!validation.valid) throw new Error(validation.errors.join(" "));
    const expandedValues = _expandLinkedGroupValues(style.variables ?? [], values);
    if (!_customVars[styleId]) _customVars[styleId] = {};
    for (const [key, val] of Object.entries(expandedValues)) {
      _customVars[styleId][key] = val;
    }
    await _saveVars();
    if (style.enabled) {
      await _removeStyleFromAllTabs(styleId);
      await _injectStyleToMatchingTabs(styleId);
    }
  }
  function _serializeStyleVariable(variable, value) {
    let serialized = "";
    if (variable.type === "color") {
      if (_isColorSchemeValue(value)) {
        serialized = `${value.light} @light ${value.light} @dark ${value.dark}`;
      } else {
        serialized = String(value);
      }
      if (variable.group) serialized += ` @group ${variable.group}`;
    } else if (variable.type === "checkbox") {
      serialized = value ? "1" : "0";
    } else if (variable.type === "range") {
      const range = variable.options && "min" in variable.options ? variable.options : null;
      serialized = range ? `[${range.min}, ${range.max}, ${range.step}, ${Number(value)}]` : String(value);
    } else if (variable.type === "select" && variable.options && !("min" in variable.options)) {
      const selected = String(value);
      const entries = Object.entries(variable.options);
      entries.sort(([left], [right]) => left === selected ? -1 : right === selected ? 1 : left.localeCompare(right));
      serialized = `{${entries.map(([key, optionValue]) => `${JSON.stringify(key)}:${JSON.stringify(optionValue)}`).join("|")}}`;
    } else if (variable.type === "text") {
      serialized = JSON.stringify(String(value));
    } else {
      serialized = String(value);
    }
    return `@var ${variable.type} ${variable.name} ${JSON.stringify(variable.label)} ${serialized}`;
  }
  function applyVariableDefaults(usercssCode, values) {
    const parsed = parseUserCSS(usercssCode);
    if (parsed.error || !parsed.variables) return { error: parsed.error || "Unable to parse UserCSS." };
    const expanded = _expandLinkedGroupValues(parsed.variables, values);
    const validation = validateUserCSSVariables(parsed.variables, expanded);
    if (!validation.valid) return { error: validation.errors.join(" ") };
    let code = usercssCode;
    for (const variable of parsed.variables) {
      if (!Object.prototype.hasOwnProperty.call(expanded, variable.name)) continue;
      const directive = _serializeStyleVariable(variable, expanded[variable.name]);
      const line = new RegExp(
        "^(\\s*\\*?\\s*)@var\\s+\\S+\\s+" + _escapeRegex(variable.name) + "\\s+.*$",
        "m"
      );
      code = code.replace(line, (_match, prefix) => `${prefix}${directive}`);
    }
    return { code };
  }
  function _serializeUserCSS(style, values) {
    const meta = style.meta || {};
    const metadataLines = [
      `@name ${meta.name || "Unnamed Style"}`,
      `@namespace ${meta.namespace || "scriptvault"}`,
      `@version ${meta.version || "1.0.0"}`
    ];
    for (const key of ["description", "author", "license", "preprocessor", "homepageURL", "supportURL", "updateURL"]) {
      if (meta[key]) metadataLines.push(`@${key} ${meta[key]}`);
    }
    for (const pattern of style.match || ["*://*/*"]) metadataLines.push(`@match ${pattern}`);
    for (const variable of style.variables || []) {
      const value = values[variable.name] ?? variable.colorSchemes ?? variable.default;
      metadataLines.push(_serializeStyleVariable(variable, value));
    }
    return `/* ==UserStyle==
  ${metadataLines.join("\n")}
  ==/UserStyle== */

  ${style.css || ""}`;
  }
  function exportUserCSS(styleId) {
    const style = _styles[styleId];
    if (!style) return { error: "UserCSS style not found." };
    const values = _customVars[styleId] ?? {};
    if (style.rawCode && META_REGEX.test(style.rawCode)) {
      return applyVariableDefaults(style.rawCode, values);
    }
    return { code: _serializeUserCSS(style, values) };
  }
  async function importUserCSS(usercssCode, values = {}) {
    const parsed = parseUserCSS(usercssCode);
    if (parsed.error) return { error: parsed.error };
    const validation = validateUserCSSVariables(parsed.variables ?? [], values);
    if (!validation.valid) return { error: validation.errors.join(" ") };
    const styleId = await registerStyle({
      meta: parsed.meta,
      variables: parsed.variables,
      css: parsed.css,
      rawCode: usercssCode,
      match: parsed.match
    });
    if (Object.keys(values).length > 0) await setVariables(styleId, values);
    return { styleId };
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
      defaults[v.name] = v.colorSchemes ?? v.default;
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
    if (_draftPreviewTabs.has(tabId)) {
      await clearDraftPreview({ tabId });
    }
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
    _draftPreviewTabs.delete(tabId);
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
    validateUserCSSVariables,
    registerStyle,
    unregisterStyle,
    toggleStyle,
    getVariables,
    setVariables,
    applyVariableDefaults,
    exportUserCSS,
    importUserCSS,
    getStyles,
    getStyle,
    updateCSS,
    previewDraft,
    clearDraftPreview,
    convertToUserscript,
    importStylusBackup,
    isUserCSSUrl,
    onTabUpdated,
    onTabRemoved
  };
  return module.exports.default || module.exports.UserStylesEngine || module.exports;
})();
