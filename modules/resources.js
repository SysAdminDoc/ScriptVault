// ============================================================================
// Generated from src/modules/resources.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const ResourceCache = (() => {
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

  // src/modules/resources.ts
  var resources_exports = {};
  __export(resources_exports, {
    ResourceCache: () => ResourceCache
  });
  module.exports = __toCommonJS(resources_exports);

  // src/background/internal-host-guard.ts
  function isInternalIPv4(ip) {
    const parts = ip.split(".").map((p) => parseInt(p, 10));
    if (parts.length !== 4 || parts.some((p) => !Number.isFinite(p) || p < 0 || p > 255)) return true;
    const [a, b, c, d] = parts;
    if (a === 0) return true;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 255 && b === 255 && c === 255 && d === 255) return true;
    return false;
  }
  function isInternalHost(rawHost) {
    if (typeof rawHost !== "string" || !rawHost) return true;
    let h = rawHost.toLowerCase();
    if (h.startsWith("[") && h.endsWith("]")) h = h.slice(1, -1);
    if (h === "localhost" || h === "localhost.localdomain" || h === "ip6-localhost" || h === "ip6-loopback") {
      return true;
    }
    if (h.includes(":")) {
      if (h === "::1" || h === "::" || h === "::0" || h === "0:0:0:0:0:0:0:0" || h === "0:0:0:0:0:0:0:1") return true;
      if (/^fe[89ab][0-9a-f]?:/.test(h)) return true;
      if (/^f[cd][0-9a-f]{0,2}:/.test(h)) return true;
      const v4MappedDotted = h.match(/^::ffff:([0-9.]+)$/);
      if (v4MappedDotted) return isInternalIPv4(v4MappedDotted[1]);
      const v4MappedHex = h.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
      if (v4MappedHex) {
        const hi = parseInt(v4MappedHex[1], 16);
        const lo = parseInt(v4MappedHex[2], 16);
        const dotted = [hi >> 8 & 255, hi & 255, lo >> 8 & 255, lo & 255].join(".");
        return isInternalIPv4(dotted);
      }
      return false;
    }
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) {
      return isInternalIPv4(h);
    }
    return false;
  }
  function classifyFetchUrl(url, allowedSchemes = ["https:"]) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return { ok: false, reason: "malformed-url", url: null, message: "malformed URL" };
    }
    if (!allowedSchemes.includes(parsed.protocol)) {
      return {
        ok: false,
        reason: "unsupported-scheme",
        url: parsed,
        message: `unsupported scheme ${parsed.protocol}`
      };
    }
    const host = parsed.hostname || "";
    if (!host) {
      return { ok: false, reason: "empty-hostname", url: parsed, message: "empty hostname" };
    }
    if (isInternalHost(host)) {
      let reason = "internal-host";
      if (host === "localhost" || host.endsWith(".localdomain") || host === "ip6-localhost" || host === "ip6-loopback") {
        reason = "localhost-alias";
      } else if (host.includes(":")) {
        reason = "ipv6-internal";
      } else if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
        reason = "ipv4-internal";
      }
      return { ok: false, reason, url: parsed, message: `internal host (${reason})` };
    }
    return { ok: true, reason: null, url: parsed, message: "" };
  }
  function classifyResponseUrl(response, allowedSchemes = ["https:"]) {
    const finalUrl = typeof response?.url === "string" ? response.url : "";
    if (!finalUrl) {
      return { ok: true, reason: null, url: null, message: "" };
    }
    return classifyFetchUrl(finalUrl, allowedSchemes);
  }

  // src/modules/resources.ts
  var RESOURCE_SIZE_ERROR = "Resource exceeds maximum allowed size (5 MB)";
  async function readResponseBytesBounded(response, maxBytes) {
    const contentLength = Number.parseInt(response.headers.get("content-length") || "", 10);
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      throw new Error(RESOURCE_SIZE_ERROR);
    }
    const body = response.body;
    if (body && typeof body.getReader === "function") {
      const reader = body.getReader();
      const chunks = [];
      let totalBytes = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value) continue;
          totalBytes += value.byteLength;
          if (totalBytes > maxBytes) {
            try {
              await reader.cancel();
            } catch {
            }
            throw new Error(RESOURCE_SIZE_ERROR);
          }
          chunks.push(value);
        }
      } finally {
        try {
          reader.releaseLock();
        } catch {
        }
      }
      const bytes2 = new Uint8Array(totalBytes);
      let offset = 0;
      for (const chunk of chunks) {
        bytes2.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return bytes2;
    }
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    if (bytes.length > maxBytes) {
      throw new Error(RESOURCE_SIZE_ERROR);
    }
    return bytes;
  }
  var ResourceCache = {
    cache: {},
    _pendingFetches: /* @__PURE__ */ new Map(),
    maxAge: 864e5,
    // 24 hours
    maxEntries: 200,
    maxResourceBytes: 5 * 1024 * 1024,
    fetchTimeoutMs: 3e4,
    STORAGE_PREFIX: "res_cache_",
    async get(url) {
      const cached = this.cache[url];
      if (cached && Date.now() - cached.timestamp < this.maxAge) {
        return cached;
      }
      if (cached) delete this.cache[url];
      try {
        const key = this.STORAGE_PREFIX + url;
        const stored = await chrome.storage.local.get(key);
        const entry = stored[key];
        if (entry && Date.now() - entry.timestamp < this.maxAge) {
          this.cache[url] = entry;
          return entry;
        }
        if (entry) chrome.storage.local.remove(key).catch(() => {
        });
      } catch (_e) {
      }
      return null;
    },
    async set(url, text, dataUri) {
      const entry = { text, dataUri, timestamp: Date.now() };
      const keys = Object.keys(this.cache);
      if (keys.length >= this.maxEntries) {
        let oldestKey = keys[0];
        let oldestTs = Infinity;
        for (const key of keys) {
          if (this.cache[key].timestamp < oldestTs) {
            oldestKey = key;
            oldestTs = this.cache[key].timestamp;
          }
        }
        delete this.cache[oldestKey];
      }
      this.cache[url] = entry;
      try {
        const key = this.STORAGE_PREFIX + url;
        await chrome.storage.local.set({ [key]: entry });
      } catch (_e) {
      }
    },
    async fetchResource(url) {
      const cached = await this.get(url);
      if (cached) return cached.text;
      if (typeof url !== "string" || !/^https?:\/\//i.test(url)) {
        throw new Error("Only HTTP(S) URLs allowed for @resource/@require");
      }
      const preCheck = classifyFetchUrl(url, ["http:", "https:"]);
      if (!preCheck.ok) {
        throw new Error(`@resource URL rejected: ${preCheck.message}`);
      }
      const pending = this._pendingFetches.get(url);
      if (pending) return await pending;
      const fetchPromise = (async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.fetchTimeoutMs);
        try {
          const response = await fetch(url, { signal: controller.signal });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const postCheck = classifyResponseUrl(response, ["http:", "https:"]);
          if (!postCheck.ok) {
            throw new Error(`@resource URL redirected to ${postCheck.message}`);
          }
          const contentType = response.headers.get("content-type") || "text/plain";
          const bytes = await readResponseBytesBounded(response, this.maxResourceBytes);
          let text;
          if (contentType.includes("text") || contentType.includes("json") || contentType.includes("xml") || contentType.includes("css") || contentType.includes("javascript")) {
            text = new TextDecoder().decode(bytes);
          } else {
            text = "";
          }
          const chunks = [];
          for (let i = 0; i < bytes.length; i += 8192) {
            chunks.push(String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 8192))));
          }
          const base64 = btoa(chunks.join(""));
          const dataUri = `data:${contentType};base64,${base64}`;
          await this.set(url, text, dataUri);
          return text;
        } finally {
          clearTimeout(timeoutId);
        }
      })().catch((e) => {
        console.error("[ScriptVault] Failed to fetch resource:", url, e);
        throw e;
      });
      this._pendingFetches.set(url, fetchPromise);
      try {
        return await fetchPromise;
      } finally {
        this._pendingFetches.delete(url);
      }
    },
    async getDataUri(url) {
      const cached = await this.get(url);
      if (cached && cached.dataUri) return cached.dataUri;
      await this.fetchResource(url);
      const entry = await this.get(url);
      return entry ? entry.dataUri : null;
    },
    async prefetchResources(resources) {
      if (!resources || typeof resources !== "object") return;
      const promises = Object.values(resources).filter((url) => typeof url === "string" && url.length > 0).map(
        (url) => this.fetchResource(url).catch((e) => console.warn("[ScriptVault] Resource prefetch failed:", url, e.message))
      );
      await Promise.allSettled(promises);
    },
    async clear() {
      this.cache = {};
      try {
        const all = await chrome.storage.local.get(null);
        const keys = Object.keys(all).filter((k) => k.startsWith(this.STORAGE_PREFIX));
        if (keys.length > 0) await chrome.storage.local.remove(keys);
      } catch (_e) {
      }
    }
  };
  return module.exports.default || module.exports.ResourceCache || module.exports;
})();
