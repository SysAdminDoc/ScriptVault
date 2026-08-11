// ============================================================================
// Generated from src/modules/subscriptions.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const ScriptSubscriptions = (() => {
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

  // src/modules/subscriptions.ts
  var subscriptions_exports = {};
  __export(subscriptions_exports, {
    ScriptSubscriptions: () => ScriptSubscriptions,
    default: () => subscriptions_default
  });
  module.exports = __toCommonJS(subscriptions_exports);

  // src/shared/utils.ts
  function generateId() {
    return "script_" + crypto.randomUUID();
  }

  // src/modules/subscriptions.ts
  var STORAGE_KEY = "scriptSubscriptions";
  var MAX_SUBSCRIPTIONS = 50;
  var MAX_FEED_ITEMS = 200;
  var MAX_ERRORS = 10;
  function asRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  }
  function asCleanString(value) {
    return typeof value === "string" ? value.trim() : "";
  }
  var MAX_VALIDATOR_LENGTH = 512;
  function safeValidator(value) {
    const text = asCleanString(value);
    if (!text || text.length > MAX_VALIDATOR_LENGTH) return "";
    return /[\r\n\0]/.test(text) ? "" : text;
  }
  function normalizeHttpUrl(value, baseUrl) {
    const raw = asCleanString(value);
    if (!raw) throw new Error("Subscription URL is required");
    let resolved;
    try {
      resolved = baseUrl ? new URL(raw, baseUrl) : new URL(raw);
    } catch (_) {
      throw new Error(`Invalid subscription URL: ${raw}`);
    }
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      throw new Error("Subscription URLs must use http or https");
    }
    resolved.hash = "";
    return resolved.href;
  }
  function normalizeHttpsUrl(value, baseUrl) {
    const normalized = normalizeHttpUrl(value, baseUrl);
    if (!normalized.startsWith("https://")) throw new Error("Subscription script URLs must use https");
    return normalized;
  }
  function parseUserSubscribe(code, baseUrl = "") {
    const match = code.match(/\/\/\s*==UserSubscribe==([\s\S]*?)\/\/\s*==\/UserSubscribe==/);
    if (!match) throw new Error("No UserSubscribe metadata block found");
    const meta = {
      name: "Script subscription",
      description: "",
      version: "1.0.0",
      author: "",
      connect: [],
      scriptUrl: [],
      metaBlock: match[0]
    };
    const seen = /* @__PURE__ */ new Set();
    for (const line of match[1].split("\n")) {
      const directive = line.match(/\/\/\s*@([\w-]+)(?:\s+(.*))?/);
      if (!directive) continue;
      const key = directive[1].trim();
      const value = (directive[2] ?? "").trim();
      if (key === "name" || key === "description" || key === "version" || key === "author") {
        meta[key] = value;
      } else if (key === "connect") {
        if (value) meta.connect.push(...value.split(",").map((part) => part.trim()).filter(Boolean));
      } else if (key === "scriptUrl" || key === "script-url") {
        if (!value) continue;
        const url = normalizeHttpsUrl(value, baseUrl);
        if (!seen.has(url)) {
          seen.add(url);
          meta.scriptUrl.push(url);
        }
      }
    }
    if (meta.scriptUrl.length === 0) throw new Error("Subscription must declare at least one @scriptUrl");
    return {
      name: meta.name,
      description: meta.description,
      version: meta.version,
      author: meta.author,
      connect: [...new Set(meta.connect)],
      sourceUrl: baseUrl ? normalizeHttpsUrl(baseUrl) : "",
      scripts: meta.scriptUrl.map((url) => ({ url })),
      metaBlock: meta.metaBlock,
      code,
      parsedAt: Date.now()
    };
  }
  function connectHost(value) {
    const raw = String(value || "").trim().toLowerCase().replace(/^\*:\/\//, "").replace(/^https?:\/\//, "");
    const host = raw.split(/[/?#:]/, 1)[0] || raw;
    return host.startsWith("*.") ? host.slice(2) : host;
  }
  function intersectConnectPatterns(member, bundle) {
    const left = String(member || "").trim();
    const right = String(bundle || "").trim();
    if (!left || !right) return null;
    if (left === "*") return right;
    if (right === "*") return left;
    if (left.toLowerCase() === right.toLowerCase()) return left;
    const leftHost = connectHost(left);
    const rightHost = connectHost(right);
    if (!leftHost || !rightHost) return null;
    if (leftHost === rightHost) return left.length <= right.length ? left : right;
    if (leftHost.endsWith(`.${rightHost}`)) return left;
    if (rightHost.endsWith(`.${leftHost}`)) return right;
    return null;
  }
  function constrainConnectPatterns(memberConnect, bundleConnect) {
    const member = Array.isArray(memberConnect) ? memberConnect.map(String).map((item) => item.trim()).filter(Boolean) : [];
    const bundle = Array.isArray(bundleConnect) ? bundleConnect.map(String).map((item) => item.trim()).filter(Boolean) : [];
    if (bundle.length === 0) return [...new Set(member)];
    const result = /* @__PURE__ */ new Set();
    for (const memberPattern of member) {
      for (const bundlePattern of bundle) {
        const overlap = intersectConnectPatterns(memberPattern, bundlePattern);
        if (overlap) result.add(overlap);
      }
    }
    return [...result].sort();
  }
  function getFeedItemUrl(item) {
    return asCleanString(item.url) || asCleanString(item.downloadURL) || asCleanString(item.downloadUrl) || asCleanString(item.codeURL) || asCleanString(item.codeUrl) || asCleanString(item.sourceURL) || asCleanString(item.sourceUrl) || asCleanString(item.href);
  }
  function normalizeFeedItem(item, feedUrl) {
    if (typeof item === "string") {
      return { url: normalizeHttpUrl(item, feedUrl) };
    }
    const record = asRecord(item);
    if (!record) return null;
    const rawUrl = getFeedItemUrl(record);
    if (!rawUrl) return null;
    const normalized = {
      url: normalizeHttpUrl(rawUrl, feedUrl)
    };
    const name = asCleanString(record.name);
    const namespace = asCleanString(record.namespace);
    const version = asCleanString(record.version);
    if (name) normalized.name = name;
    if (namespace) normalized.namespace = namespace;
    if (version) normalized.version = version;
    return normalized;
  }
  function getFeedItems(root) {
    if (Array.isArray(root)) return root;
    const record = asRecord(root);
    if (!record) throw new Error("Subscription feed must be a JSON array or object");
    for (const key of ["scripts", "items", "subscriptions"]) {
      const value = record[key];
      if (Array.isArray(value)) return value;
    }
    throw new Error("Subscription feed must include a scripts, items, or subscriptions array");
  }
  function fallbackNameFromUrl(url) {
    try {
      return new URL(url).hostname || "Script subscription";
    } catch (_) {
      return "Script subscription";
    }
  }
  function normalizeSubscription(value) {
    const record = asRecord(value);
    if (!record) return null;
    try {
      const url = normalizeHttpUrl(record.url);
      const now = Date.now();
      return {
        id: asCleanString(record.id) || generateId(),
        url,
        name: asCleanString(record.name) || fallbackNameFromUrl(url),
        kind: record.kind === "bundle" ? "bundle" : "feed",
        description: asCleanString(record.description),
        version: asCleanString(record.version),
        connect: Array.isArray(record.connect) ? record.connect.filter((item) => typeof item === "string").slice(0, 100) : [],
        enabled: record.enabled !== false,
        scripts: Array.isArray(record.scripts) ? record.scripts.map((item) => normalizeFeedItem(item, url)).filter((item) => !!item).slice(0, MAX_FEED_ITEMS) : [],
        createdAt: typeof record.createdAt === "number" ? record.createdAt : now,
        updatedAt: typeof record.updatedAt === "number" ? record.updatedAt : now,
        lastCheckedAt: typeof record.lastCheckedAt === "number" ? record.lastCheckedAt : null,
        lastQueued: typeof record.lastQueued === "number" ? record.lastQueued : 0,
        lastSkipped: typeof record.lastSkipped === "number" ? record.lastSkipped : 0,
        lastErrors: Array.isArray(record.lastErrors) ? record.lastErrors.filter((item) => typeof item === "string").slice(0, MAX_ERRORS) : [],
        httpEtag: safeValidator(record.httpEtag),
        httpLastModified: safeValidator(record.httpLastModified),
        sourceFetchedAt: typeof record.sourceFetchedAt === "number" ? record.sourceFetchedAt : null
      };
    } catch (_) {
      return null;
    }
  }
  async function readAll() {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    const raw = data[STORAGE_KEY];
    return Array.isArray(raw) ? raw.map(normalizeSubscription).filter((item) => !!item).slice(0, MAX_SUBSCRIPTIONS) : [];
  }
  async function writeAll(subscriptions) {
    const normalized = subscriptions.map(normalizeSubscription).filter((item) => !!item).slice(0, MAX_SUBSCRIPTIONS);
    await chrome.storage.local.set({ [STORAGE_KEY]: normalized });
    return normalized.map((item) => ({ ...item, scripts: item.scripts.map((script) => ({ ...script })) }));
  }
  var subscriptionMutation = Promise.resolve();
  async function waitForSubscriptionMutation() {
    await subscriptionMutation.catch(() => void 0);
  }
  async function mutateSubscriptions(mutator) {
    const execute = async () => {
      const subscriptions = await readAll();
      const mutation = await mutator(subscriptions);
      if (mutation.persist !== false) await writeAll(mutation.next);
      return mutation.value;
    };
    const previous = subscriptionMutation;
    const operation = previous.catch(() => void 0).then(execute);
    subscriptionMutation = operation.catch(() => void 0);
    return await operation;
  }
  function cloneSubscription(subscription) {
    return {
      ...subscription,
      connect: Array.isArray(subscription.connect) ? [...subscription.connect] : [],
      scripts: subscription.scripts.map((script) => ({ ...script })),
      lastErrors: [...subscription.lastErrors]
    };
  }
  function parseFeed(text, feedUrl) {
    const sourceUrl = normalizeHttpUrl(feedUrl);
    let root;
    try {
      root = JSON.parse(text);
    } catch (_) {
      throw new Error("Subscription feed is not valid JSON");
    }
    const record = asRecord(root);
    const name = asCleanString(record?.name) || asCleanString(record?.title) || fallbackNameFromUrl(sourceUrl);
    const seen = /* @__PURE__ */ new Set();
    const scripts = [];
    for (const rawItem of getFeedItems(root)) {
      if (scripts.length >= MAX_FEED_ITEMS) break;
      const item = normalizeFeedItem(rawItem, sourceUrl);
      if (!item || seen.has(item.url)) continue;
      seen.add(item.url);
      scripts.push(item);
    }
    if (scripts.length === 0) {
      throw new Error("Subscription feed did not contain any script URLs");
    }
    return {
      name,
      sourceUrl,
      scripts,
      parsedAt: Date.now()
    };
  }
  async function list() {
    await waitForSubscriptionMutation();
    return (await readAll()).sort((a, b) => a.createdAt - b.createdAt).map(cloneSubscription);
  }
  async function get(id) {
    await waitForSubscriptionMutation();
    const subscriptions = await readAll();
    const subscription = subscriptions.find((item) => item.id === id || item.url === id);
    return subscription ? cloneSubscription(subscription) : null;
  }
  async function upsertFromFeed(url, feed, options = {}) {
    const normalizedUrl = normalizeHttpUrl(url);
    const subscription = await mutateSubscriptions(async (subscriptions) => {
      const existingIndex = subscriptions.findIndex((item) => item.url === normalizedUrl);
      const existing = existingIndex >= 0 ? subscriptions[existingIndex] : null;
      const now = Date.now();
      const subscription2 = {
        id: existing?.id || generateId(),
        url: normalizedUrl,
        name: asCleanString(options.name) || feed.name || existing?.name || fallbackNameFromUrl(normalizedUrl),
        kind: existing?.kind || "feed",
        description: existing?.description || "",
        version: existing?.version || "",
        connect: existing?.connect ? [...existing.connect] : [],
        enabled: typeof options.enabled === "boolean" ? options.enabled : existing?.enabled !== false,
        scripts: feed.scripts.map((script) => ({ ...script })),
        createdAt: existing?.createdAt || now,
        updatedAt: now,
        lastCheckedAt: now,
        lastQueued: existing?.lastQueued || 0,
        lastSkipped: existing?.lastSkipped || 0,
        lastErrors: existing?.lastErrors ? [...existing.lastErrors] : [],
        // A read with no validators must not wipe a working pair — the next
        // scheduled check would then re-download a feed that had not changed.
        httpEtag: options.validators ? safeValidator(options.validators.etag) : existing?.httpEtag || "",
        httpLastModified: options.validators ? safeValidator(options.validators.lastModified) : existing?.httpLastModified || "",
        sourceFetchedAt: now
      };
      const next = existingIndex >= 0 ? subscriptions.map((item, index) => index === existingIndex ? subscription2 : item) : [subscription2, ...subscriptions];
      return { next, value: subscription2 };
    });
    return cloneSubscription(subscription);
  }
  async function upsertBundle(bundle, options = {}) {
    const normalizedUrl = normalizeHttpsUrl(bundle.sourceUrl);
    const subscription = await mutateSubscriptions(async (subscriptions) => {
      const existingIndex = subscriptions.findIndex((item) => item.url === normalizedUrl);
      const existing = existingIndex >= 0 ? subscriptions[existingIndex] : null;
      const now = Date.now();
      const subscription2 = {
        id: existing?.id || generateId(),
        url: normalizedUrl,
        name: asCleanString(options.name) || bundle.name || existing?.name || fallbackNameFromUrl(normalizedUrl),
        kind: "bundle",
        description: bundle.description || "",
        version: bundle.version || "",
        connect: [...new Set(bundle.connect.map((item) => item.trim()).filter(Boolean))],
        enabled: typeof options.enabled === "boolean" ? options.enabled : existing?.enabled !== false,
        scripts: bundle.scripts.map((script) => ({ ...script })),
        createdAt: existing?.createdAt || now,
        updatedAt: now,
        lastCheckedAt: now,
        lastQueued: existing?.lastQueued || 0,
        lastSkipped: existing?.lastSkipped || 0,
        lastErrors: existing?.lastErrors ? [...existing.lastErrors] : [],
        httpEtag: options.validators ? safeValidator(options.validators.etag) : existing?.httpEtag || "",
        httpLastModified: options.validators ? safeValidator(options.validators.lastModified) : existing?.httpLastModified || "",
        sourceFetchedAt: now
      };
      const next = existingIndex >= 0 ? subscriptions.map((item, index) => index === existingIndex ? subscription2 : item) : [subscription2, ...subscriptions];
      return { next, value: subscription2 };
    });
    return cloneSubscription(subscription);
  }
  async function remove(id) {
    return await mutateSubscriptions(async (subscriptions) => {
      const next = subscriptions.filter((item) => item.id !== id && item.url !== id);
      if (next.length === subscriptions.length) return { next, value: false, persist: false };
      return { next, value: true };
    });
  }
  async function markRefreshResult(id, result = {}) {
    const updated = await mutateSubscriptions(async (subscriptions) => {
      const index = subscriptions.findIndex((item) => item.id === id || item.url === id);
      if (index < 0) return { next: subscriptions, value: null, persist: false };
      const now = Date.now();
      const current = subscriptions[index];
      if (!current) return { next: subscriptions, value: null, persist: false };
      const updated2 = {
        ...current,
        updatedAt: now,
        lastCheckedAt: now,
        lastQueued: Math.max(0, result.queued || 0),
        lastSkipped: Math.max(0, result.skipped || 0),
        lastErrors: Array.isArray(result.errors) ? result.errors.slice(0, MAX_ERRORS) : [],
        // A 304 means the check happened but the stored item list was not re-read,
        // so its age must keep counting from the last real download.
        sourceFetchedAt: result.notModified ? current.sourceFetchedAt : now
      };
      subscriptions[index] = updated2;
      return { next: subscriptions, value: updated2 };
    });
    return updated ? cloneSubscription(updated) : null;
  }
  var ScriptSubscriptions = {
    STORAGE_KEY,
    MAX_SUBSCRIPTIONS,
    MAX_FEED_ITEMS,
    normalizeFeedUrl: normalizeHttpUrl,
    normalizeHttpsUrl,
    parseUserSubscribe,
    constrainConnectPatterns,
    parseFeed,
    list,
    get,
    upsertFromFeed,
    upsertBundle,
    remove,
    markRefreshResult,
    safeValidator
  };
  var subscriptions_default = ScriptSubscriptions;
  return module.exports.default || module.exports.ScriptSubscriptions || module.exports;
})();
