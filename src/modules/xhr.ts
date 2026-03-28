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
}

interface XhrManagerInterface {
  requests: Map<string, XhrRequest>;
  nextId: number;
  create(tabId: number, scriptId: string, details: XhrRequestDetails): XhrRequest;
  get(requestId: string): XhrRequest | undefined;
  abort(requestId: string): boolean;
  remove(requestId: string): void;
  abortByTab(tabId: number): void;
  abortByScript(scriptId: string): void;
  getActiveCount(): number;
}

const XhrManager: XhrManagerInterface = {
  requests: new Map(), // requestId -> { controller, tabId, scriptId, etc }
  nextId: 1,

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
  }
};

export { XhrManager };
export type { XhrRequest, XhrRequestDetails, XhrManagerInterface };
