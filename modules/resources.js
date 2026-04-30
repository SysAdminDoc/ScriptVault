// ============================================================================
// Resource Cache
// ============================================================================

const ResourceCache = {
  cache: {},
  maxAge: 86400000, // 24 hours
  maxEntries: 200,
  maxResourceBytes: 5 * 1024 * 1024,
  fetchTimeoutMs: 30000,
  STORAGE_PREFIX: 'res_cache_',

  async get(url) {
    const cached = this.cache[url];
    if (cached && Date.now() - cached.timestamp < this.maxAge) {
      return cached;
    }
    // Clean up expired in-memory entry
    if (cached) delete this.cache[url];

    // Try persistent storage
    try {
      const key = this.STORAGE_PREFIX + url;
      const stored = await chrome.storage.local.get(key);
      if (stored[key] && Date.now() - stored[key].timestamp < this.maxAge) {
        this.cache[url] = stored[key];
        return stored[key];
      }
      // Clean up expired persistent entry
      if (stored[key]) chrome.storage.local.remove(key).catch(() => {});
    } catch (e) {}
    return null;
  },

  async set(url, text, dataUri) {
    const entry = { text, dataUri, timestamp: Date.now() };
    // Cap in-memory cache size to prevent unbounded growth
    const keys = Object.keys(this.cache);
    if (keys.length >= this.maxEntries) {
      // Evict oldest entry
      let oldestKey = keys[0], oldestTs = Infinity;
      for (const k of keys) {
        if (this.cache[k].timestamp < oldestTs) { oldestTs = this.cache[k].timestamp; oldestKey = k; }
      }
      delete this.cache[oldestKey];
    }
    this.cache[url] = entry;
    try {
      const key = this.STORAGE_PREFIX + url;
      await chrome.storage.local.set({ [key]: entry });
    } catch (e) {}
  },

  async fetchResource(url) {
    const cached = await this.get(url);
    if (cached) return cached.text;

    // Validate URL protocol
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      throw new Error('Only HTTP(S) URLs allowed for @resource/@require');
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.fetchTimeoutMs);
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const contentType = response.headers.get('content-type') || 'text/plain';
        const contentLength = Number.parseInt(response.headers.get('content-length') || '', 10);
        if (Number.isFinite(contentLength) && contentLength > this.maxResourceBytes) {
          throw new Error('Resource exceeds maximum allowed size (5 MB)');
        }
        const buffer = await response.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        if (bytes.length > this.maxResourceBytes) {
          throw new Error('Resource exceeds maximum allowed size (5 MB)');
        }

        // Generate text representation
        let text;
        if (contentType.includes('text') || contentType.includes('json') || contentType.includes('xml') || contentType.includes('css') || contentType.includes('javascript')) {
          text = new TextDecoder().decode(bytes);
        } else {
          text = '';
        }

        // Generate data URI for binary resources (images, fonts, etc.)
        const chunks = [];
        for (let i = 0; i < bytes.length; i += 8192) {
          chunks.push(String.fromCharCode.apply(null, bytes.subarray(i, i + 8192)));
        }
        const base64 = btoa(chunks.join(''));
        const dataUri = `data:${contentType};base64,${base64}`;

        await this.set(url, text, dataUri);
        return text;
      } finally {
        clearTimeout(timeout);
      }
    } catch (e) {
      console.error('[ScriptVault] Failed to fetch resource:', url, e);
      throw e;
    }
  },

  async getDataUri(url) {
    const cached = await this.get(url);
    if (cached && cached.dataUri) return cached.dataUri;
    // Fetch it first
    await this.fetchResource(url);
    const entry = await this.get(url);
    return entry ? entry.dataUri : null;
  },

  async prefetchResources(resources) {
    if (!resources || typeof resources !== 'object') return;
    const promises = Object.values(resources)
      .filter(url => typeof url === 'string' && url.length > 0)
      .map(url =>
      this.fetchResource(url).catch(e => console.warn('[ScriptVault] Resource prefetch failed:', url, e.message))
    );
    await Promise.allSettled(promises);
  },

  async clear() {
    this.cache = {};
    // Also clear persistent resource cache entries
    try {
      const all = await chrome.storage.local.get(null);
      const keys = Object.keys(all).filter(k => k.startsWith(this.STORAGE_PREFIX));
      if (keys.length > 0) await chrome.storage.local.remove(keys);
    } catch (e) {}
  }
};
