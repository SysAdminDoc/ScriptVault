// ============================================================================
// Generated from src/background/remote-response-classifier.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const RemoteResponseClassifier = (() => {
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

  // src/background/remote-response-classifier.ts
  var remote_response_classifier_exports = {};
  __export(remote_response_classifier_exports, {
    RemoteResponseClassifier: () => RemoteResponseClassifier,
    classifyFetchError: () => classifyFetchError,
    classifyRemoteResponse: () => classifyRemoteResponse,
    default: () => remote_response_classifier_default,
    isTransportError: () => isTransportError,
    looksLikeHostChallenge: () => looksLikeHostChallenge,
    looksLikeHtml: () => looksLikeHtml
  });
  module.exports = __toCommonJS(remote_response_classifier_exports);
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
  var RemoteResponseClassifier = {
    looksLikeHtml,
    looksLikeHostChallenge,
    isTransportError,
    classifyFetchError,
    classifyRemoteResponse
  };
  var remote_response_classifier_default = RemoteResponseClassifier;
  return module.exports.default || module.exports.RemoteResponseClassifier || module.exports;
})();

if (typeof self !== 'undefined') {
  self.RemoteResponseClassifier = RemoteResponseClassifier;
}
