// ============================================================================
// Generated from src/background/find-script-sources.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const FindScriptSources = (() => {
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

  // src/background/find-script-sources.ts
  var find_script_sources_exports = {};
  __export(find_script_sources_exports, {
    BUILTIN_FIND_SCRIPT_SOURCES: () => BUILTIN_FIND_SCRIPT_SOURCES,
    DEFAULT_FIND_SCRIPT_SOURCE_SETTINGS: () => DEFAULT_FIND_SCRIPT_SOURCE_SETTINGS,
    FindScriptSources: () => FindScriptSources,
    buildCustomFindScriptSourceUrl: () => buildCustomFindScriptSourceUrl,
    default: () => find_script_sources_default,
    getEnabledFindScriptSources: () => getEnabledFindScriptSources,
    normalizeFindScriptSourceSettings: () => normalizeFindScriptSourceSettings,
    resolveFindScriptSource: () => resolveFindScriptSource,
    validateCustomFindScriptSource: () => validateCustomFindScriptSource
  });
  module.exports = __toCommonJS(find_script_sources_exports);
  var MAX_CUSTOM_SOURCES = 10;
  var ALLOWED_TEMPLATE_TOKENS = /* @__PURE__ */ new Set(["query", "page"]);
  var BUILTIN_FIND_SCRIPT_SOURCES = Object.freeze([
    Object.freeze({ id: "greasyfork", label: "GreasyFork", kind: "builtin-api" }),
    Object.freeze({ id: "openuserjs", label: "OpenUserJS", kind: "builtin-api" }),
    Object.freeze({ id: "github", label: "GitHub", kind: "builtin-external" })
  ]);
  var DEFAULT_FIND_SCRIPT_SOURCE_SETTINGS = Object.freeze({
    builtin: Object.freeze({ greasyfork: true, openuserjs: true, github: true }),
    custom: Object.freeze([])
  });
  function cleanText(value, maxLength) {
    return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
  }
  function stableSourceId(label, template) {
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 28) || "catalog";
    let hash = 2166136261;
    for (const char of template) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return `${slug}-${hash.toString(36)}`;
  }
  function isUnsafeCatalogHost(hostname) {
    const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
    if (host.includes(":")) return true;
    const octets = host.split(".");
    if (octets.length === 4 && octets.every((part) => /^\d{1,3}$/.test(part))) {
      const values = octets.map(Number);
      const first = values[0] ?? 0;
      const second = values[1] ?? 0;
      if (values.some((value) => value > 255)) return true;
      return first === 0 || first === 10 || first === 127 || first === 169 && second === 254 || first === 172 && second >= 16 && second <= 31 || first === 192 && second === 168 || first >= 224;
    }
    return !host.includes(".");
  }
  function parseTemplateUrl(urlTemplate) {
    try {
      return new URL(urlTemplate.replaceAll("{query}", "userscript").replaceAll("{page}", "1"));
    } catch {
      return null;
    }
  }
  function validateCustomFindScriptSource(input) {
    const candidate = input && typeof input === "object" ? input : {};
    const label = cleanText(candidate.label, 40);
    const urlTemplate = cleanText(candidate.urlTemplate, 2048);
    if (label.length < 2) return { ok: false, error: "Source name must be at least 2 characters." };
    if (!urlTemplate) return { ok: false, error: "Enter an HTTPS search URL template." };
    if (!urlTemplate.includes("{query}")) return { ok: false, error: "URL template must include {query}." };
    const authority = urlTemplate.match(/^https:\/\/([^/?#]+)/i)?.[1] ?? "";
    if (/[{}]/.test(authority)) {
      return { ok: false, error: "Template placeholders cannot change the catalog origin." };
    }
    const tokens = [...urlTemplate.matchAll(/\{([^{}]+)\}/g)].map((match) => match[1] ?? "");
    const unknownToken = tokens.find((token) => !ALLOWED_TEMPLATE_TOKENS.has(token));
    if (unknownToken) return { ok: false, error: `Unsupported template token {${unknownToken}}. Use only {query} and {page}.` };
    const unmatchedBraces = urlTemplate.replace(/\{(?:query|page)\}/g, "");
    if (/[{}]/.test(unmatchedBraces)) return { ok: false, error: "URL template contains an incomplete placeholder." };
    const parsed = parseTemplateUrl(urlTemplate);
    if (!parsed) return { ok: false, error: "Enter a valid URL template." };
    if (parsed.protocol !== "https:") return { ok: false, error: "Custom search sources must use HTTPS." };
    if (parsed.username || parsed.password) return { ok: false, error: "Search source URLs cannot contain credentials." };
    if (isUnsafeCatalogHost(parsed.hostname)) return { ok: false, error: "Use a public catalog hostname, not a local or private address." };
    return {
      ok: true,
      source: {
        id: stableSourceId(label, urlTemplate),
        label,
        urlTemplate,
        allowedOrigin: parsed.origin,
        enabled: candidate.enabled !== false
      }
    };
  }
  function normalizeFindScriptSourceSettings(input) {
    const candidate = input && typeof input === "object" ? input : {};
    const builtinInput = candidate.builtin && typeof candidate.builtin === "object" ? candidate.builtin : {};
    const builtin = {
      greasyfork: builtinInput.greasyfork !== false,
      openuserjs: builtinInput.openuserjs !== false,
      github: builtinInput.github !== false
    };
    const custom = [];
    const seenIds = /* @__PURE__ */ new Set();
    for (const item of Array.isArray(candidate.custom) ? candidate.custom.slice(0, MAX_CUSTOM_SOURCES) : []) {
      const validation = validateCustomFindScriptSource(item);
      if (!validation.ok || seenIds.has(validation.source.id)) continue;
      seenIds.add(validation.source.id);
      custom.push(validation.source);
    }
    return { builtin, custom };
  }
  function getEnabledFindScriptSources(input) {
    const settings = normalizeFindScriptSourceSettings(input);
    const builtins = BUILTIN_FIND_SCRIPT_SOURCES.filter((source) => settings.builtin[source.id]).map((source) => ({ ...source, enabled: true }));
    const custom = settings.custom.filter((source) => source.enabled).map((source) => ({ id: `custom:${source.id}`, label: source.label, kind: "custom-external", enabled: true, custom: source }));
    return [...builtins, ...custom];
  }
  function resolveFindScriptSource(input, id) {
    const sourceId = cleanText(id, 160);
    return getEnabledFindScriptSources(input).find((source) => source.id === sourceId) || null;
  }
  function buildCustomFindScriptSourceUrl(sourceInput, query, page = 1) {
    const validation = validateCustomFindScriptSource(sourceInput);
    if (!validation.ok) return validation;
    const cleanQuery = cleanText(query, 500);
    if (!cleanQuery) return { ok: false, error: "Enter a search term." };
    const pageNumber = Number.isInteger(Number(page)) && Number(page) > 0 ? Number(page) : 1;
    const url = validation.source.urlTemplate.replaceAll("{query}", encodeURIComponent(cleanQuery)).replaceAll("{page}", encodeURIComponent(String(pageNumber)));
    const parsed = parseTemplateUrl(url);
    if (!parsed || parsed.origin !== validation.source.allowedOrigin) {
      return { ok: false, error: "Search URL escaped its reviewed catalog origin." };
    }
    return { ok: true, url: parsed.href };
  }
  var FindScriptSources = Object.freeze({
    BUILTIN_FIND_SCRIPT_SOURCES,
    DEFAULT_FIND_SCRIPT_SOURCE_SETTINGS,
    buildCustomFindScriptSourceUrl,
    getEnabledFindScriptSources,
    normalizeFindScriptSourceSettings,
    resolveFindScriptSource,
    validateCustomFindScriptSource
  });
  var find_script_sources_default = FindScriptSources;
  return module.exports.default || module.exports.FindScriptSources || module.exports;
})();

if (typeof self !== 'undefined') {
  self.FindScriptSources = FindScriptSources;
}
