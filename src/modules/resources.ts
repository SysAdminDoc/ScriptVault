// ============================================================================
// Resource Cache
// ============================================================================

import { classifyFetchUrl, classifyResponseUrl } from '../background/internal-host-guard';

// SettingsManager is a runtime global (modules/storage.js loads before this
// module in the background build order).
declare const SettingsManager: { get(): Promise<Record<string, unknown>> } | undefined;

// Extract an SRI hash from a resource URL fragment (e.g. url#sha256=<base64>).
// TM/VM convention pins @resource integrity the same way as @require.
function _parseResourceIntegrity(url: string): { sriHash: string | null } {
  const hashIdx = url.indexOf('#');
  if (hashIdx === -1) return { sriHash: null };
  const frag = url.slice(hashIdx + 1);
  const m = frag.match(/(sha256|sha384|sha512)[-=]([A-Za-z0-9+/=_-]+)/i);
  return { sriHash: m ? `${m[1]}-${m[2]}` : null };
}

function _normalizeSriB64(s: string): string {
  return s.replace(/=+$/, '').replace(/\s+/g, '');
}

// Verify raw resource bytes against a pinned SRI hash. Returns true when no
// verifiable hash is present (nothing to enforce); fails CLOSED when a
// verifiable hash was requested but verification cannot complete.
async function _verifyResourceIntegrity(bytes: Uint8Array, sriHash: string | null): Promise<boolean> {
  if (!sriHash) return true;
  const match = sriHash.match(/^(sha256|sha384|sha512)[-=](.+)$/i);
  if (!match) return true;
  const algoMap: Record<string, string> = { sha256: 'SHA-256', sha384: 'SHA-384', sha512: 'SHA-512' };
  const algoName = algoMap[match[1]!.toLowerCase()];
  const expected = match[2]!;
  if (!algoName || !expected) return true;
  try {
    const digest = await crypto.subtle.digest(algoName, bytes as unknown as BufferSource);
    const actual = btoa(String.fromCharCode(...new Uint8Array(digest)));
    return _normalizeSriB64(actual) === _normalizeSriB64(expected);
  } catch {
    return false;
  }
}

interface CacheEntry {
  text: string;
  dataUri: string;
  timestamp: number;
}

interface ResourceCache {
  cache: Record<string, CacheEntry>;
  _pendingFetches: Map<string, Promise<string>>;
  maxAge: number;
  maxEntries: number;
  maxResourceBytes: number;
  fetchTimeoutMs: number;
  STORAGE_PREFIX: string;
  get(url: string): Promise<CacheEntry | null>;
  set(url: string, text: string, dataUri: string): Promise<void>;
  fetchResource(url: string): Promise<string>;
  getDataUri(url: string): Promise<string | null>;
  prefetchResources(resources: Record<string, string> | null | undefined): Promise<void>;
  clear(): Promise<void>;
}

const RESOURCE_SIZE_ERROR = 'Resource exceeds maximum allowed size (5 MB)';

async function readResponseBytesBounded(response: Response, maxBytes: number): Promise<Uint8Array> {
  const contentLength = Number.parseInt(response.headers.get('content-length') || '', 10);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error(RESOURCE_SIZE_ERROR);
  }

  const body = response.body;
  if (body && typeof body.getReader === 'function') {
    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          try { await reader.cancel(); } catch { /* ignore cancel failures */ }
          throw new Error(RESOURCE_SIZE_ERROR);
        }
        chunks.push(value);
      }
    } finally {
      try { reader.releaseLock(); } catch { /* ignore release failures */ }
    }

    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  }

  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (bytes.length > maxBytes) {
    throw new Error(RESOURCE_SIZE_ERROR);
  }
  return bytes;
}

const ResourceCache: ResourceCache = {
  cache: {},
  _pendingFetches: new Map(),
  maxAge: 86400000, // 24 hours
  maxEntries: 200,
  maxResourceBytes: 5 * 1024 * 1024,
  fetchTimeoutMs: 30_000,
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
    // Cap in-memory cache size to prevent unbounded growth.
    const keys = Object.keys(this.cache);
    if (keys.length >= this.maxEntries) {
      let oldestKey = keys[0]!;
      let oldestTs = Infinity;
      for (const key of keys) {
        if (this.cache[key]!.timestamp < oldestTs) {
          oldestKey = key;
          oldestTs = this.cache[key]!.timestamp;
        }
      }
      delete this.cache[oldestKey];
    }
    this.cache[url] = entry;
    try {
      const key = this.STORAGE_PREFIX + url;
      await chrome.storage.local.set({ [key]: entry });
    } catch (_e) { /* ignore */ }
  },

  async fetchResource(url: string): Promise<string> {
    const cached = await this.get(url);
    if (cached) return cached.text;

    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      throw new Error('Only HTTP(S) URLs allowed for @resource/@require');
    }

    const preCheck = classifyFetchUrl(url, ['http:', 'https:']);
    if (!preCheck.ok) {
      throw new Error(`@resource URL rejected: ${preCheck.message}`);
    }

    // SRI enforcement parity with @require: in "require" mode, refuse a remote
    // @resource that carries no verifiable integrity hash. A pinned hash (any
    // mode) is verified against the fetched bytes below. @resource content is
    // exposed via GM_getResourceText/URL and routinely injected, so unpinned
    // remote content must be gated the same way @require is.
    const { sriHash } = _parseResourceIntegrity(url);
    if (!sriHash) {
      try {
        const sriSettings = typeof SettingsManager !== 'undefined' && SettingsManager
          ? await SettingsManager.get()
          : null;
        if (sriSettings && sriSettings.sri === 'require') {
          throw new Error('Blocked: unpinned @resource under SRI "Require" policy');
        }
      } catch (e) {
        if (e instanceof Error && e.message.startsWith('Blocked:')) throw e;
        // Settings unavailable — do not block execution.
      }
    }

    const pending = this._pendingFetches.get(url);
    if (pending) return await pending;

    const fetchPromise = (async (): Promise<string> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.fetchTimeoutMs);
      try {
        const response: Response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const postCheck = classifyResponseUrl(response, ['http:', 'https:']);
        if (!postCheck.ok) {
          throw new Error(`@resource URL redirected to ${postCheck.message}`);
        }
        const contentType = response.headers.get('content-type') || 'text/plain';
        const bytes = await readResponseBytesBounded(response, this.maxResourceBytes);

        // Verify a pinned SRI hash against the raw bytes before caching. Fails
        // closed on mismatch/verification error so a compromised or MITM'd CDN
        // cannot substitute resource content.
        if (sriHash && !(await _verifyResourceIntegrity(bytes, sriHash))) {
          throw new Error('@resource SRI hash mismatch');
        }

        // Generate text representation
        let text: string;
        if (contentType.includes('text') || contentType.includes('json') || contentType.includes('xml') || contentType.includes('css') || contentType.includes('javascript')) {
          text = new TextDecoder().decode(bytes);
        } else {
          text = '';
        }

        // Generate data URI for binary resources (images, fonts, etc.)
        const chunks: string[] = [];
        for (let i = 0; i < bytes.length; i += 8192) {
          chunks.push(String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 8192))));
        }
        const base64 = btoa(chunks.join(''));
        const dataUri = `data:${contentType};base64,${base64}`;

        await this.set(url, text, dataUri);
        return text;
      } finally {
        clearTimeout(timeoutId);
      }
    })().catch((e: unknown) => {
      console.error('[ScriptVault] Failed to fetch resource:', url, e);
      throw e;
    });

    this._pendingFetches.set(url, fetchPromise);
    try {
      return await fetchPromise;
    } finally {
      this._pendingFetches.delete(url);
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
    const promises = Object.values(resources)
      .filter((url): url is string => typeof url === 'string' && url.length > 0)
      .map((url: string) =>
        this.fetchResource(url).catch((e: Error) => console.warn('[ScriptVault] Resource prefetch failed:', url, e.message))
      );
    await Promise.allSettled(promises);
  },

  async clear(): Promise<void> {
    this.cache = {};
    // Also clear persistent resource cache entries
    try {
      // Chrome accepts null to enumerate all keys; chrome-types omits it.
      const all = await chrome.storage.local.get(null as unknown as undefined);
      const keys = Object.keys(all).filter((k: string) => k.startsWith(this.STORAGE_PREFIX));
      if (keys.length > 0) await chrome.storage.local.remove(keys);
    } catch (_e) { /* ignore */ }
  }
};

export { ResourceCache };
export type { CacheEntry };
