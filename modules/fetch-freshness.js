// ============================================================================
// Generated from src/background/fetch-freshness.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const FetchFreshness = (() => {
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

  // src/background/fetch-freshness.ts
  var fetch_freshness_exports = {};
  __export(fetch_freshness_exports, {
    FetchFreshness: () => FetchFreshness,
    buildFreshnessInit: () => buildFreshnessInit,
    default: () => fetch_freshness_default,
    isConditionalIntent: () => isConditionalIntent,
    readResponseValidators: () => readResponseValidators,
    shouldStoreValidators: () => shouldStoreValidators,
    sourceAgeMs: () => sourceAgeMs
  });
  module.exports = __toCommonJS(fetch_freshness_exports);
  var CONDITIONAL_INTENTS = ["scheduled-update", "scheduled-feed"];
  var VALIDATOR_STORING_INTENTS = [
    "scheduled-update",
    "manual-update",
    "scheduled-feed",
    "manual-feed"
  ];
  var ALL_INTENTS = [
    "scheduled-update",
    "manual-update",
    "scheduled-feed",
    "manual-feed",
    "feed-script",
    "install"
  ];
  function isIntent(intent) {
    return typeof intent === "string" && ALL_INTENTS.includes(intent);
  }
  function isConditionalIntent(intent) {
    return isIntent(intent) && CONDITIONAL_INTENTS.includes(intent);
  }
  function shouldStoreValidators(intent) {
    return isIntent(intent) && VALIDATOR_STORING_INTENTS.includes(intent);
  }
  function cleanValidator(value) {
    if (typeof value !== "string") return "";
    const trimmed = value.trim();
    if (!trimmed || /[\r\n\0]/.test(trimmed)) return "";
    return trimmed;
  }
  function buildFreshnessInit(intent, options = {}) {
    const headers = { ...options.headers || {} };
    if (isConditionalIntent(intent)) {
      const etag = cleanValidator(options.etag);
      const lastModified = cleanValidator(options.lastModified);
      if (etag) headers["If-None-Match"] = etag;
      if (lastModified) headers["If-Modified-Since"] = lastModified;
    }
    return {
      ...options.init || {},
      // Set after the caller's init so an accidental `cache` there cannot
      // reintroduce shared-cache reads.
      cache: "no-store",
      headers
    };
  }
  function readResponseValidators(intent, response) {
    if (!shouldStoreValidators(intent)) return null;
    const get = response?.headers?.get;
    if (typeof get !== "function") return null;
    const etag = cleanValidator(response.headers.get("etag"));
    const lastModified = cleanValidator(response.headers.get("last-modified"));
    if (!etag && !lastModified) return null;
    return { etag, lastModified };
  }
  function sourceAgeMs(fetchedAt, now = Date.now()) {
    const stamp = Number(fetchedAt);
    if (!Number.isFinite(stamp) || stamp <= 0) return null;
    return Math.max(0, now - stamp);
  }
  var FetchFreshness = {
    INTENTS: ALL_INTENTS,
    CONDITIONAL_INTENTS,
    VALIDATOR_STORING_INTENTS,
    isConditionalIntent,
    shouldStoreValidators,
    buildFreshnessInit,
    readResponseValidators,
    sourceAgeMs
  };
  var fetch_freshness_default = FetchFreshness;
  return module.exports.default || module.exports.FetchFreshness || module.exports;
})();

if (typeof self !== 'undefined') {
  self.FetchFreshness = FetchFreshness;
}
