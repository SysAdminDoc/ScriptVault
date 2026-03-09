// ============================================================================
// XHR Request Manager (tracks requests for abort support)
// ============================================================================

const XhrManager = {
  requests: new Map(), // requestId -> { controller, tabId, scriptId, etc }
  nextId: 1,
  
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
  }
};
