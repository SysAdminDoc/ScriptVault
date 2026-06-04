// ============================================================================
// Generated from src/modules/npm-resolve.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const NpmResolver = (() => {
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

  // src/modules/npm-resolve.ts
  var npm_resolve_exports = {};
  __export(npm_resolve_exports, {
    NpmResolver: () => NpmResolver,
    default: () => npm_resolve_default
  });
  module.exports = __toCommonJS(npm_resolve_exports);

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
    if (a === 192 && b === 0 && c === 2) return true;
    if (a === 198 && b === 51 && c === 100) return true;
    if (a === 203 && b === 0 && c === 113) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a >= 240) return true;
    return false;
  }
  function isInternalHost(rawHost) {
    if (typeof rawHost !== "string" || !rawHost) return true;
    let h = rawHost.toLowerCase();
    if (h.startsWith("[") && h.endsWith("]")) h = h.slice(1, -1);
    if (h === "localhost" || h === "localhost.localdomain" || h === "ip6-localhost" || h === "ip6-loopback" || h.endsWith(".localhost")) {
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
      if (host === "localhost" || host.endsWith(".localdomain") || host === "ip6-localhost" || host === "ip6-loopback" || host.endsWith(".localhost")) {
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

  // src/modules/npm-resolve.ts
  var MAX_NPM_FETCH_BYTES = 5 * 1024 * 1024;
  var NPM_FETCH_SIZE_ERROR = "NPM response exceeds maximum allowed size (5 MB)";
  function utf8Length(text) {
    return new TextEncoder().encode(text).byteLength;
  }
  async function readTextBounded(response, maxBytes) {
    const contentLength = Number.parseInt(response.headers?.get?.("content-length") || "", 10);
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      throw new Error(NPM_FETCH_SIZE_ERROR);
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
            throw new Error(NPM_FETCH_SIZE_ERROR);
          }
          chunks.push(value);
        }
      } finally {
        try {
          reader.releaseLock();
        } catch {
        }
      }
      const decoder = new TextDecoder();
      let text2 = "";
      for (let i = 0; i < chunks.length; i++) {
        text2 += decoder.decode(chunks[i], { stream: i < chunks.length - 1 });
      }
      text2 += decoder.decode();
      return text2;
    }
    const text = await response.text();
    if (utf8Length(text) > maxBytes) {
      throw new Error(NPM_FETCH_SIZE_ERROR);
    }
    return text;
  }
  var NpmResolver = {
    CACHE_KEY: "npmCache",
    CACHE_TTL: 864e5,
    // 24 hours
    REGISTRY_URL: "https://registry.npmjs.org",
    REQUEST_TIMEOUT: 1e4,
    // 10 seconds
    // Pre-mapped shortcuts for popular packages (name -> CDN path overrides)
    POPULAR_PACKAGES: {
      "lodash": { cdn: "lodash", file: "lodash.min.js" },
      "jquery": { cdn: "jquery", file: "jquery.min.js" },
      "axios": { cdn: "axios", file: "axios.min.js" },
      "moment": { cdn: "moment", file: "moment.min.js" },
      "dayjs": { cdn: "dayjs", file: "dayjs.min.js" },
      "rxjs": { cdn: "rxjs", file: "rxjs.umd.min.js" },
      "underscore": { cdn: "underscore", file: "underscore-min.js" },
      "ramda": { cdn: "ramda", file: "ramda.min.js" },
      "dompurify": { cdn: "dompurify", file: "purify.min.js" },
      "marked": { cdn: "marked", file: "marked.min.js" },
      "highlight.js": { cdn: "highlight.js", file: "highlight.min.js" },
      "chart.js": { cdn: "Chart.js", file: "chart.umd.js" },
      "three": { cdn: "three", file: "three.min.js" },
      "d3": { cdn: "d3", file: "d3.min.js" },
      "gsap": { cdn: "gsap", file: "gsap.min.js" },
      "animejs": { cdn: "animejs", file: "anime.min.js" },
      "anime.js": { cdn: "animejs", file: "anime.min.js" },
      "sweetalert2": { cdn: "sweetalert2", file: "sweetalert2.all.min.js" },
      "tippy.js": { cdn: "tippy.js", file: "tippy-bundle.umd.min.js" },
      "sortablejs": { cdn: "Sortable", file: "Sortable.min.js" },
      "luxon": { cdn: "luxon", file: "luxon.min.js" }
    },
    // ---------------------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------------------
    /**
     * Check if a require URL uses the npm: prefix.
     */
    isNpmRequire(url) {
      return typeof url === "string" && url.startsWith("npm:");
    },
    /**
     * Resolve a single npm require spec to a CDN URL.
     */
    async resolve(requireSpec) {
      const resolved = await this.resolveWithCode(requireSpec);
      return {
        url: resolved.url,
        integrity: resolved.integrity,
        version: resolved.version
      };
    },
    /**
     * Resolve a single npm require spec and return the exact bytes used for SRI.
     * The @require loader uses this path to avoid computing integrity over one
     * CDN response and then executing a later, possibly different, response.
     */
    async resolveWithCode(requireSpec) {
      if (!this.isNpmRequire(requireSpec)) {
        throw new Error(`Not an npm require: ${requireSpec}`);
      }
      const { name, version: requestedVersion } = this._parseSpec(requireSpec);
      const cacheKey = `${name}@${requestedVersion || "latest"}`;
      const cached = await this._getCache(cacheKey, true);
      if (cached) return cached;
      const version = requestedVersion && requestedVersion !== "latest" ? requestedVersion : await this._resolveLatestVersion(name);
      if (!version) {
        throw new Error(`Failed to resolve version for package: ${name}`);
      }
      const urls = this._buildCdnUrls(name, version);
      let lastError = null;
      for (const url of urls) {
        try {
          const content = await this._fetchWithTimeout(url);
          const integrity = await this._computeSriHash(content);
          const result = { url, integrity, version, code: content };
          await this._setCache(cacheKey, result);
          return result;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
        }
      }
      throw new Error(
        `Failed to resolve npm:${name}@${version} from all CDNs: ${lastError?.message || "unknown error"}`
      );
    },
    /**
     * Batch-resolve multiple npm require specs.
     */
    async resolveAll(requires) {
      const results = /* @__PURE__ */ new Map();
      const promises = requires.map(async (spec) => {
        try {
          const result = await this.resolve(spec);
          results.set(spec, result);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          results.set(spec, { error: message });
        }
      });
      await Promise.allSettled(promises);
      return results;
    },
    /**
     * Fetch metadata for a package from the npm registry.
     */
    async getPackageInfo(packageName) {
      const sanitized = this._sanitizePackageName(packageName);
      const url = `${this.REGISTRY_URL}/${encodeURIComponent(sanitized).replace("%40", "@")}/latest`;
      const response = await this._fetchWithTimeout(url, { isJson: true });
      const data = JSON.parse(response);
      return {
        name: data.name,
        version: data.version,
        description: data.description || "",
        homepage: data.homepage || "",
        main: data.main || "index.js"
      };
    },
    /**
     * Clear all cached npm resolution data.
     */
    async clearCache() {
      try {
        await chrome.storage.local.remove(this.CACHE_KEY);
      } catch (_e) {
      }
    },
    // ---------------------------------------------------------------------------
    // Internal helpers
    // ---------------------------------------------------------------------------
    /**
     * Parse an npm require spec into name and optional version.
     * Handles scoped packages (e.g. npm:@scope/name@version).
     */
    _parseSpec(spec) {
      const raw = spec.slice(4);
      if (!raw) throw new Error("Empty npm package spec");
      let name;
      let version = null;
      if (raw.startsWith("@")) {
        const slashIdx = raw.indexOf("/");
        if (slashIdx === -1) throw new Error(`Invalid scoped package: ${raw}`);
        const afterScope = raw.indexOf("@", slashIdx);
        if (afterScope > slashIdx) {
          name = raw.slice(0, afterScope);
          version = raw.slice(afterScope + 1);
        } else {
          name = raw;
        }
      } else {
        const atIdx = raw.indexOf("@");
        if (atIdx > 0) {
          name = raw.slice(0, atIdx);
          version = raw.slice(atIdx + 1);
        } else {
          name = raw;
        }
      }
      name = this._sanitizePackageName(name);
      if (version) version = this._sanitizeVersion(version);
      return { name, version };
    },
    /**
     * Validate and sanitize a package name.
     */
    _sanitizePackageName(name) {
      const trimmed = name.trim();
      if (!/^(@[a-z0-9\-~][a-z0-9\-._~]*\/)?[a-z0-9\-~][a-z0-9\-._~]*$/.test(trimmed)) {
        throw new Error(`Invalid package name: ${trimmed}`);
      }
      return trimmed;
    },
    /**
     * Validate and sanitize a version string.
     */
    _sanitizeVersion(version) {
      const trimmed = version.trim();
      if (!/^[a-z0-9\-._^~>=<| *]+$/i.test(trimmed)) {
        throw new Error(`Invalid version: ${trimmed}`);
      }
      return trimmed;
    },
    /**
     * Resolve the latest version of a package from the npm registry.
     */
    async _resolveLatestVersion(name) {
      try {
        const info = await this.getPackageInfo(name);
        return info.version;
      } catch (_e) {
        return null;
      }
    },
    /**
     * Build the ordered CDN URL list for a package.
     * Prefers UMD/IIFE bundles for userscript compatibility.
     */
    _buildCdnUrls(name, version) {
      const popular = this.POPULAR_PACKAGES[name];
      const urls = [];
      if (popular) {
        urls.push(`https://cdn.jsdelivr.net/npm/${name}@${version}/dist/${popular.file}`);
        urls.push(`https://unpkg.com/${name}@${version}/dist/${popular.file}`);
        urls.push(
          `https://cdnjs.cloudflare.com/ajax/libs/${popular.cdn}/${version}/${popular.file}`
        );
      }
      urls.push(`https://cdn.jsdelivr.net/npm/${name}@${version}/+esm`);
      urls.push(`https://unpkg.com/${name}@${version}`);
      urls.push(
        `https://cdnjs.cloudflare.com/ajax/libs/${name}/${version}/${name}.min.js`
      );
      return [...new Set(urls)];
    },
    /**
     * Fetch a URL with a timeout. Returns the response body as text.
     */
    async _fetchWithTimeout(url, options = {}) {
      const preCheck = classifyFetchUrl(url, ["https:"]);
      if (!preCheck.ok) {
        throw new Error(`NPM URL rejected: ${preCheck.message}`);
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: options.isJson ? { "Accept": "application/json" } : {}
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} for ${url}`);
        }
        const postCheck = classifyResponseUrl(response, ["https:"]);
        if (!postCheck.ok) {
          throw new Error(`NPM URL redirected to ${postCheck.message}`);
        }
        return await readTextBounded(response, MAX_NPM_FETCH_BYTES);
      } finally {
        clearTimeout(timer);
      }
    },
    /**
     * Compute SHA-256 SRI hash from content string.
     * Uses the Web Crypto API (available in service workers).
     */
    async _computeSriHash(content) {
      const encoder = new TextEncoder();
      const data = encoder.encode(content);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data.buffer);
      const hashArray = new Uint8Array(hashBuffer);
      let binary = "";
      for (let i = 0; i < hashArray.length; i++) {
        binary += String.fromCharCode(hashArray[i]);
      }
      return `sha256-${btoa(binary)}`;
    },
    /**
     * Read a single entry from the npm cache.
     */
    async _getCache(key, requireCode = false) {
      try {
        const stored = await chrome.storage.local.get(this.CACHE_KEY);
        const cache = stored[this.CACHE_KEY];
        if (!cache || typeof cache !== "object") return null;
        const cacheObj = cache;
        const entry = cacheObj[key];
        if (!entry) return null;
        if (requireCode && typeof entry.code !== "string") return null;
        if (Date.now() - entry.timestamp > this.CACHE_TTL) {
          delete cacheObj[key];
          chrome.storage.local.set({ [this.CACHE_KEY]: cacheObj }).catch(() => {
          });
          return null;
        }
        return {
          url: entry.url,
          integrity: entry.integrity,
          version: entry.version,
          code: entry.code ?? ""
        };
      } catch (_e) {
        return null;
      }
    },
    /**
     * Write a single entry to the npm cache.
     */
    async _setCache(key, result) {
      try {
        const stored = await chrome.storage.local.get(this.CACHE_KEY);
        const rawCache = stored[this.CACHE_KEY];
        const cache = rawCache && typeof rawCache === "object" ? rawCache : {};
        cache[key] = {
          url: result.url,
          integrity: result.integrity,
          version: result.version,
          ...typeof result.code === "string" ? { code: result.code } : {},
          timestamp: Date.now()
        };
        await chrome.storage.local.set({ [this.CACHE_KEY]: cache });
      } catch (_e) {
      }
    }
  };
  var npm_resolve_default = NpmResolver;
  return module.exports.default || module.exports.NpmResolver || module.exports;
})();
