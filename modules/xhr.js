// ============================================================================
// Generated from src/modules/xhr.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const XhrManager = (() => {
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

  // src/modules/xhr.ts
  var xhr_exports = {};
  __export(xhr_exports, {
    XhrManager: () => XhrManager
  });
  module.exports = __toCommonJS(xhr_exports);
  var XhrManager = {
    requests: /* @__PURE__ */ new Map(),
    // requestId -> { controller, tabId, scriptId, etc }
    nextId: 1,
    cleanupDelayMs: 3e5,
    maxActiveRequests: 512,
    maxActiveRequestsPerScript: 64,
    // Create a new tracked request (controller added later by caller)
    create(tabId, scriptId, details) {
      if (this.requests.size >= this.maxActiveRequests) {
        throw new Error(`Too many active GM_xmlhttpRequest requests. Maximum is ${this.maxActiveRequests}.`);
      }
      if (this.getActiveCountForScript(scriptId) >= this.maxActiveRequestsPerScript) {
        throw new Error(
          `Too many active GM_xmlhttpRequest requests for this script. Maximum is ${this.maxActiveRequestsPerScript}.`
        );
      }
      const requestId = `xhr_${this.nextId++}_${Date.now()}`;
      const request = {
        id: requestId,
        controller: null,
        // AbortController added by caller
        tabId,
        scriptId,
        details,
        aborted: false,
        startTime: Date.now()
      };
      this.requests.set(requestId, request);
      request._cleanupTimer = setTimeout(() => this.remove(requestId), this.cleanupDelayMs);
      return request;
    },
    // Get a request by ID
    get(requestId) {
      return this.requests.get(requestId);
    },
    // Abort a specific request
    abort(requestId) {
      const request = this.requests.get(requestId);
      if (request && !request.aborted) {
        request.aborted = true;
        if (request.controller) {
          try {
            request.controller.abort();
          } catch (_e) {
          }
        }
        return true;
      }
      return false;
    },
    // Remove a completed/aborted request
    remove(requestId) {
      const request = this.requests.get(requestId);
      if (request?._cleanupTimer) clearTimeout(request._cleanupTimer);
      this.requests.delete(requestId);
    },
    // Abort all requests for a tab
    abortByTab(tabId) {
      for (const [requestId, request] of this.requests) {
        if (request.tabId === tabId) {
          this.abort(requestId);
          this.remove(requestId);
        }
      }
    },
    // Abort all requests for a script
    abortByScript(scriptId) {
      for (const [requestId, request] of this.requests) {
        if (request.scriptId === scriptId) {
          this.abort(requestId);
          this.remove(requestId);
        }
      }
    },
    // Get count of active requests
    getActiveCount() {
      return this.requests.size;
    },
    getActiveCountForScript(scriptId) {
      let count = 0;
      for (const request of this.requests.values()) {
        if (request.scriptId === scriptId) count += 1;
      }
      return count;
    },
    /**
     * Build the `fetch()` init options for a GM_xmlhttpRequest payload.
     *
     * Encapsulates the per-option translation rules so they're unit-testable:
     *   - `data.noCache === true` adds Cache-Control + Pragma: no-cache
     *     (only if the caller hasn't already set them — case-insensitive).
     *   - `data.redirect` is forwarded only when it's a valid RequestInit value
     *     ('follow' | 'error' | 'manual'); typos are silently dropped.
     *   - `data.anonymous === true` switches credentials to 'omit'.
     *
     * Body and signal are wired by the caller because they involve
     * AbortController + body serialization that lives outside this helper.
     */
    buildFetchOptions(data) {
      const method = String(data.method || "GET").toUpperCase();
      const reqHeaders = { ...data.headers || {} };
      if (data.noCache === true) {
        const lcKeys = Object.keys(reqHeaders).map((k) => k.toLowerCase());
        if (!lcKeys.includes("cache-control")) reqHeaders["Cache-Control"] = "no-cache";
        if (!lcKeys.includes("pragma")) reqHeaders["Pragma"] = "no-cache";
      }
      const opts = {
        method,
        headers: reqHeaders,
        credentials: data.anonymous === true ? "omit" : "include"
      };
      if (data.redirect === "follow" || data.redirect === "error" || data.redirect === "manual") {
        opts.redirect = data.redirect;
      }
      return opts;
    }
  };
  return module.exports.default || module.exports.XhrManager || module.exports;
})();
