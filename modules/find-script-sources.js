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
    classifyFindScriptsSourceError: () => classifyFindScriptsSourceError,
    classifyFindScriptsSourceResponse: () => classifyFindScriptsSourceResponse,
    default: () => find_script_sources_default,
    getEnabledFindScriptSources: () => getEnabledFindScriptSources,
    normalizeFindScriptSourceSettings: () => normalizeFindScriptSourceSettings,
    resolveFindScriptSource: () => resolveFindScriptSource,
    validateCustomFindScriptSource: () => validateCustomFindScriptSource
  });
  module.exports = __toCommonJS(find_script_sources_exports);

  // src/background/remote-response-classifier.ts
  var CHALLENGE_MARKERS = [
    /just a moment/i,
    /cf[-_]?chl[-_]?(?:opt|jschl|tk)/i,
    /cf-browser-verification/i,
    /challenge-platform/i,
    /_cf_chl_/i,
    /attention required!/i,
    /checking your browser before accessing/i,
    /enable javascript and cookies to continue/i,
    /ddos[- ]protection by/i,
    /<title>\s*access denied/i
  ];
  var TRANSPORT_MARKERS = [
    /failed to fetch/i,
    /networkerror/i,
    /err_(?:connection|name_not_resolved|internet_disconnected|timed_out|cert|ssl)/i,
    /certificate/i,
    /\bcert_/i,
    /ssl|tls/i,
    /getaddrinfo|enotfound|econnrefused|econnreset|etimedout|eai_again/i,
    /dns/i,
    /timed out/i,
    /aborted/i
  ];
  function hostOf(url) {
    try {
      return new URL(String(url || "")).host || "";
    } catch {
      return "";
    }
  }
  function firstBytes(body, limit = 4096) {
    return typeof body === "string" ? body.slice(0, limit) : "";
  }
  function looksLikeHtml(body) {
    const head = firstBytes(body).trimStart();
    if (!head) return false;
    return /^<(?:!doctype\s+html|html|head|body|meta|script[\s>]|title[\s>])/i.test(head) || /<html[\s>]/i.test(head);
  }
  function looksLikeHostChallenge(body, status) {
    const head = firstBytes(body);
    if (!head) return false;
    if (CHALLENGE_MARKERS.some((marker) => marker.test(head))) return true;
    const code = Number(status);
    return (code === 403 || code === 429 || code === 503) && looksLikeHtml(head);
  }
  function isTransportError(error) {
    const text = error instanceof Error ? `${error.name || ""} ${error.message || ""}` : String(error || "");
    if (!text.trim()) return false;
    return TRANSPORT_MARKERS.some((marker) => marker.test(text));
  }
  function classifyFetchError(url, error, label = "Update") {
    const host = hostOf(url);
    const detail = error instanceof Error ? error.message || String(error) : String(error || "");
    const where = host ? ` from ${host}` : "";
    if (isTransportError(error)) {
      return {
        kind: "transport",
        hostLevel: true,
        host,
        detail,
        message: `${label} could not reach${where ? where.replace(" from", "") : " the update host"}: ${detail || "the connection failed"}. This is a problem with the host or the network, not with the script.`
      };
    }
    return {
      kind: "transport",
      hostLevel: true,
      host,
      detail,
      message: `${label} request${where} failed: ${detail || "unknown error"}. This is a problem with the host, not with the script.`
    };
  }
  function classifyRemoteResponse(options) {
    const label = options.label || "Update";
    const host = hostOf(options.url);
    const where = host ? ` from ${host}` : "";
    const body = options.body;
    const status = Number(options.status);
    if (looksLikeHostChallenge(body, options.status)) {
      return {
        kind: "host-challenge",
        hostLevel: true,
        host,
        detail: firstBytes(body, 200),
        message: `${host || "The update host"} returned a browser-check page instead of the script. Open ${host || "the host"} in a tab once to clear the challenge, then check again. The script itself is unchanged.`
      };
    }
    if (Number.isFinite(status) && status >= 400) {
      return {
        kind: "http-status",
        hostLevel: true,
        host,
        detail: `HTTP ${status}`,
        message: `${label} host${where} answered HTTP ${status}. Nothing is wrong with the installed script.`
      };
    }
    const declaredHtml = /text\/html/i.test(String(options.contentType || ""));
    if (declaredHtml || looksLikeHtml(body)) {
      return {
        kind: "not-a-userscript",
        hostLevel: true,
        host,
        detail: firstBytes(body, 200),
        message: `${host || "The update host"} served a web page instead of a userscript. The update URL may have moved or now needs a login. The installed script is untouched.`
      };
    }
    if (typeof body === "string" && !body.includes("==UserScript==")) {
      return {
        kind: "not-a-userscript",
        hostLevel: true,
        host,
        detail: firstBytes(body, 200),
        message: `The response${where} is not a userscript (no metadata block). The update URL may be wrong or the download was truncated.`
      };
    }
    if (options.parseError) {
      return {
        kind: "parse-error",
        hostLevel: false,
        host,
        detail: String(options.parseError),
        message: `The updated script${where} could not be parsed: ${String(options.parseError)}`
      };
    }
    return null;
  }

  // src/background/find-script-sources.ts
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
  function healthySource(label, host = "") {
    return {
      state: "ok",
      kind: "ok",
      host,
      detail: "",
      message: `${label} is reachable and returned a catalog response.`
    };
  }
  function mapRemoteFailure(failure) {
    const state = failure.kind === "host-challenge" ? "challenged" : failure.kind === "transport" ? "unreachable" : "http-error";
    return {
      state,
      kind: failure.kind,
      message: failure.message,
      host: failure.host,
      detail: failure.detail
    };
  }
  function classifyFindScriptsSourceResponse(options) {
    const label = cleanText(options.label, 80) || "Catalog";
    const status = Number(options.status);
    const body = typeof options.body === "string" ? options.body : "";
    const contentType = String(options.contentType || "");
    const inspectBody = Boolean(options.parseError) || Number.isFinite(status) && status >= 400 || /text\/html/i.test(contentType) || looksLikeHostChallenge(body, status);
    const failure = classifyRemoteResponse({
      url: options.url,
      status: options.status,
      contentType,
      body: inspectBody ? body : void 0,
      parseError: options.parseError,
      label
    });
    return failure ? mapRemoteFailure(failure) : healthySource(label, getHost(options.url));
  }
  function classifyFindScriptsSourceError(url, error, label = "Catalog") {
    const cleanLabel = cleanText(label, 80) || "Catalog";
    return mapRemoteFailure(classifyFetchError(url, error, cleanLabel));
  }
  function getHost(url) {
    try {
      return new URL(String(url || "")).host || "";
    } catch {
      return "";
    }
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
    classifyFindScriptsSourceError,
    classifyFindScriptsSourceResponse,
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
