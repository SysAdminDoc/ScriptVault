// ============================================================================
// Resource Cache
// ============================================================================

interface CacheEntry {
  text: string;
  dataUri: string;
  timestamp: number;
}

interface ResourceCache {
  cache: Record<string, CacheEntry>;
  maxAge: number;
  STORAGE_PREFIX: string;
  get(url: string): Promise<CacheEntry | null>;
  set(url: string, text: string, dataUri: string): Promise<void>;
  fetchResource(url: string): Promise<string>;
  getDataUri(url: string): Promise<string | null>;
  prefetchResources(resources: Record<string, string> | null | undefined): Promise<void>;
  clear(): Promise<void>;
}

const ResourceCache: ResourceCache = {
  cache: {},
  maxAge: 86400000, // 24 hours
  STORAGE_PREFIX: 'res_cache_',

  async get(url: string): Promise<CacheEntry | null> {
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
      const entry = stored[key] as CacheEntry | undefined;
      if (entry && Date.now() - entry.timestamp < this.maxAge) {
        this.cache[url] = entry;
        return entry;
      }
      // Clean up expired persistent entry
      if (entry) chrome.storage.local.remove(key).catch(() => {});
    } catch (_e) { /* ignore */ }
    return null;
  },

  async set(url: string, text: string, dataUri: string): Promise<void> {
    const entry: CacheEntry = { text, dataUri, timestamp: Date.now() };
    this.cache[url] = entry;
    try {
      const key = this.STORAGE_PREFIX + url;
      await chrome.storage.local.set({ [key]: entry });
    } catch (_e) { /* ignore */ }
  },

  async fetchResource(url: string): Promise<string> {
    const cached = await this.get(url);
    if (cached) return cached.text;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30_000);
      let response: Response;
      try {
        response = await fetch(url, { signal: controller.signal });
      } finally {
        clearTimeout(timeoutId);
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = response.headers.get('content-type') || 'text/plain';
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      // Generate text representation
      let text: string;
      if (contentType.includes('text') || contentType.includes('json') || contentType.includes('xml') || contentType.includes('css') || contentType.includes('javascript')) {
        text = new TextDecoder().decode(bytes);
      } else {
        text = '';
      }

      // Generate data URI for binary resources (images, fonts, etc.)
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]!);
      }
      const base64 = btoa(binary);
      const dataUri = `data:${contentType};base64,${base64}`;

      await this.set(url, text, dataUri);
      return text;
    } catch (e: unknown) {
      console.error('[ScriptVault] Failed to fetch resource:', url, e);
      throw e;
    }
  },

  async getDataUri(url: string): Promise<string | null> {
    const cached = await this.get(url);
    if (cached && cached.dataUri) return cached.dataUri;
    // Fetch it first
    await this.fetchResource(url);
    const entry = await this.get(url);
    return entry ? entry.dataUri : null;
  },

  async prefetchResources(resources: Record<string, string> | null | undefined): Promise<void> {
    if (!resources || typeof resources !== 'object') return;
    const promises = Object.values(resources).map((url: string) =>
      this.fetchResource(url).catch((e: Error) => console.warn('[ScriptVault] Resource prefetch failed:', url, e.message))
    );
    await Promise.allSettled(promises);
  },

  async clear(): Promise<void> {
    this.cache = {};
    // Also clear persistent resource cache entries
    try {
      const all = await chrome.storage.local.get(undefined);
      const keys = Object.keys(all).filter((k: string) => k.startsWith(this.STORAGE_PREFIX));
      if (keys.length > 0) await chrome.storage.local.remove(keys);
    } catch (_e) { /* ignore */ }
  }
};

export { ResourceCache };
export type { CacheEntry };
