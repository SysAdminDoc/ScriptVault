// ============================================================================
// XHR Request Manager (tracks requests for abort support)
// ============================================================================

const XhrManager = {
  requests: new Map(), // requestId -> { controller, tabId, scriptId, etc }
  nextId: 1,
  cleanupDelayMs: 300000,
  
  // Create a new tracked request (controller added later by caller)
  create(tabId, scriptId, details) {
    const requestId = `xhr_${this.nextId++}_${Date.now()}`;
    
    const request = {
      id: requestId,
      controller: null, // AbortController added by caller
      tabId,
      scriptId,
      details,
      aborted: false,
      startTime: Date.now()
    };
    
    this.requests.set(requestId, request);
    // Auto-cleanup after 5 minutes to prevent leaks from abandoned requests
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
        } catch (e) {
          // Ignore abort errors
        }
      }
      return true;
    }
    return false;
  },
  
  // Remove a completed/aborted request
  remove(requestId) {
    const req = this.requests.get(requestId);
    if (req?._cleanupTimer) clearTimeout(req._cleanupTimer);
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
   *
   * @param {object} data — the wrapper-side request payload.
   * @returns {RequestInit} — fetch() init object (no body/signal).
   */
  buildFetchOptions(data) {
    const method = String(data.method || 'GET').toUpperCase();
    const reqHeaders = { ...(data.headers || {}) };

    if (data.noCache === true) {
      const lcKeys = Object.keys(reqHeaders).map((k) => k.toLowerCase());
      if (!lcKeys.includes('cache-control')) reqHeaders['Cache-Control'] = 'no-cache';
      if (!lcKeys.includes('pragma')) reqHeaders['Pragma'] = 'no-cache';
    }

    const opts = {
      method,
      headers: reqHeaders,
      credentials: data.anonymous === true ? 'omit' : 'include'
    };

    if (data.redirect === 'follow' || data.redirect === 'error' || data.redirect === 'manual') {
      opts.redirect = data.redirect;
    }
    return opts;
  }
};
