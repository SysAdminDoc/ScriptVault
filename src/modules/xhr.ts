// ============================================================================
// XHR Request Manager (tracks requests for abort support)
// ============================================================================

interface XhrRequestDetails {
  url?: string;
  method?: string;
  [key: string]: unknown;
}

interface XhrRequest {
  id: string;
  controller: AbortController | null;
  tabId: number;
  scriptId: string;
  details: XhrRequestDetails;
  aborted: boolean;
  startTime: number;
  _cleanupTimer?: ReturnType<typeof setTimeout>;
}

interface XhrManagerInterface {
  requests: Map<string, XhrRequest>;
  nextId: number;
  cleanupDelayMs: number;
  create(tabId: number, scriptId: string, details: XhrRequestDetails): XhrRequest;
  get(requestId: string): XhrRequest | undefined;
  abort(requestId: string): boolean;
  remove(requestId: string): void;
  abortByTab(tabId: number): void;
  abortByScript(scriptId: string): void;
  getActiveCount(): number;
  buildFetchOptions(data: XhrFetchPayload): RequestInit;
}

/**
 * Wire-format payload sent from the GM_xmlhttpRequest wrapper to the
 * background. Only the subset relevant to fetch() options is typed here;
 * the body and signal are wired by the caller.
 */
export interface XhrFetchPayload {
  method?: string;
  headers?: Record<string, string>;
  noCache?: boolean;
  redirect?: 'follow' | 'error' | 'manual' | string;
  anonymous?: boolean;
  [key: string]: unknown;
}

const XhrManager: XhrManagerInterface = {
  requests: new Map(), // requestId -> { controller, tabId, scriptId, etc }
  nextId: 1,
  cleanupDelayMs: 300000,

  // Create a new tracked request (controller added later by caller)
  create(tabId: number, scriptId: string, details: XhrRequestDetails): XhrRequest {
    const requestId = `xhr_${this.nextId++}_${Date.now()}`;

    const request: XhrRequest = {
      id: requestId,
      controller: null, // AbortController added by caller
      tabId,
      scriptId,
      details,
      aborted: false,
      startTime: Date.now()
    };

    this.requests.set(requestId, request);
    // Auto-cleanup after 5 minutes to prevent leaks from abandoned requests.
    request._cleanupTimer = setTimeout(() => this.remove(requestId), this.cleanupDelayMs);
    return request;
  },

  // Get a request by ID
  get(requestId: string): XhrRequest | undefined {
    return this.requests.get(requestId);
  },

  // Abort a specific request
  abort(requestId: string): boolean {
    const request = this.requests.get(requestId);
    if (request && !request.aborted) {
      request.aborted = true;
      if (request.controller) {
        try {
          request.controller.abort();
        } catch (_e) {
          // Ignore abort errors
        }
      }
      return true;
    }
    return false;
  },

  // Remove a completed/aborted request
  remove(requestId: string): void {
    const request = this.requests.get(requestId);
    if (request?._cleanupTimer) clearTimeout(request._cleanupTimer);
    this.requests.delete(requestId);
  },

  // Abort all requests for a tab
  abortByTab(tabId: number): void {
    for (const [requestId, request] of this.requests) {
      if (request.tabId === tabId) {
        this.abort(requestId);
        this.remove(requestId);
      }
    }
  },

  // Abort all requests for a script
  abortByScript(scriptId: string): void {
    for (const [requestId, request] of this.requests) {
      if (request.scriptId === scriptId) {
        this.abort(requestId);
        this.remove(requestId);
      }
    }
  },

  // Get count of active requests
  getActiveCount(): number {
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
   */
  buildFetchOptions(data: XhrFetchPayload): RequestInit {
    const method = String(data.method || 'GET').toUpperCase();
    const reqHeaders: Record<string, string> = { ...(data.headers || {}) };

    if (data.noCache === true) {
      const lcKeys = Object.keys(reqHeaders).map((k) => k.toLowerCase());
      if (!lcKeys.includes('cache-control')) reqHeaders['Cache-Control'] = 'no-cache';
      if (!lcKeys.includes('pragma')) reqHeaders['Pragma'] = 'no-cache';
    }

    const opts: RequestInit = {
      method,
      headers: reqHeaders,
      credentials: data.anonymous === true ? 'omit' : 'include',
    };

    if (data.redirect === 'follow' || data.redirect === 'error' || data.redirect === 'manual') {
      opts.redirect = data.redirect;
    }
    return opts;
  }
};

export { XhrManager };
export type { XhrRequest, XhrRequestDetails, XhrManagerInterface };
