// ============================================================================
// NPM Package Resolver for @require directives
// ============================================================================
// Resolves `@require npm:package-name` and `@require npm:package-name@version`
// to CDN URLs with fallback chain and integrity verification.
// Designed for service worker context (no DOM, fetch API only).
// ============================================================================

interface PopularPackageEntry {
  cdn: string;
  file: string;
}

interface ResolveResult {
  url: string;
  integrity: string;
  version: string;
}

interface ResolveError {
  error: string;
}

interface CacheEntry {
  url: string;
  integrity: string;
  version: string;
  timestamp: number;
}

interface NpmCache {
  [key: string]: CacheEntry | undefined;
}

interface PackageInfo {
  name: string;
  version: string;
  description: string;
  homepage: string;
  main: string;
}

interface ParsedSpec {
  name: string;
  version: string | null;
}

interface FetchOptions {
  isJson?: boolean;
}

const NpmResolver = {
  CACHE_KEY: 'npmCache' as const,
  CACHE_TTL: 86400000, // 24 hours
  REGISTRY_URL: 'https://registry.npmjs.org' as const,
  REQUEST_TIMEOUT: 10000, // 10 seconds

  // Pre-mapped shortcuts for popular packages (name -> CDN path overrides)
  POPULAR_PACKAGES: {
    'lodash':       { cdn: 'lodash', file: 'lodash.min.js' },
    'jquery':       { cdn: 'jquery', file: 'jquery.min.js' },
    'axios':        { cdn: 'axios', file: 'axios.min.js' },
    'moment':       { cdn: 'moment', file: 'moment.min.js' },
    'dayjs':        { cdn: 'dayjs', file: 'dayjs.min.js' },
    'rxjs':         { cdn: 'rxjs', file: 'rxjs.umd.min.js' },
    'underscore':   { cdn: 'underscore', file: 'underscore-min.js' },
    'ramda':        { cdn: 'ramda', file: 'ramda.min.js' },
    'dompurify':    { cdn: 'dompurify', file: 'purify.min.js' },
    'marked':       { cdn: 'marked', file: 'marked.min.js' },
    'highlight.js': { cdn: 'highlight.js', file: 'highlight.min.js' },
    'chart.js':     { cdn: 'Chart.js', file: 'chart.umd.js' },
    'three':        { cdn: 'three', file: 'three.min.js' },
    'd3':           { cdn: 'd3', file: 'd3.min.js' },
    'gsap':         { cdn: 'gsap', file: 'gsap.min.js' },
    'animejs':      { cdn: 'animejs', file: 'anime.min.js' },
    'anime.js':     { cdn: 'animejs', file: 'anime.min.js' },
    'sweetalert2':  { cdn: 'sweetalert2', file: 'sweetalert2.all.min.js' },
    'tippy.js':     { cdn: 'tippy.js', file: 'tippy-bundle.umd.min.js' },
    'sortablejs':   { cdn: 'Sortable', file: 'Sortable.min.js' },
    'luxon':        { cdn: 'luxon', file: 'luxon.min.js' }
  } as Record<string, PopularPackageEntry | undefined>,

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Check if a require URL uses the npm: prefix.
   */
  isNpmRequire(url: string): boolean {
    return typeof url === 'string' && url.startsWith('npm:');
  },

  /**
   * Resolve a single npm require spec to a CDN URL.
   */
  async resolve(requireSpec: string): Promise<ResolveResult> {
    if (!this.isNpmRequire(requireSpec)) {
      throw new Error(`Not an npm require: ${requireSpec}`);
    }

    const { name, version: requestedVersion } = this._parseSpec(requireSpec);
    const cacheKey: string = `${name}@${requestedVersion || 'latest'}`;

    // Check cache first
    const cached: ResolveResult | null = await this._getCache(cacheKey);
    if (cached) return cached;

    // Resolve version if not pinned
    const version: string | null = requestedVersion || await this._resolveLatestVersion(name);
    if (!version) {
      throw new Error(`Failed to resolve version for package: ${name}`);
    }

    // Try CDN chain with fallback
    const urls: string[] = this._buildCdnUrls(name, version);
    let lastError: Error | null = null;

    for (const url of urls) {
      try {
        const content: string = await this._fetchWithTimeout(url);
        const integrity: string = await this._computeSriHash(content);
        const result: ResolveResult = { url, integrity, version };
        await this._setCache(cacheKey, result);
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        // Continue to next CDN
      }
    }

    throw new Error(
      `Failed to resolve npm:${name}@${version} from all CDNs: ${lastError?.message || 'unknown error'}`
    );
  },

  /**
   * Batch-resolve multiple npm require specs.
   */
  async resolveAll(requires: string[]): Promise<Map<string, ResolveResult | ResolveError>> {
    const results: Map<string, ResolveResult | ResolveError> = new Map();
    const promises: Promise<void>[] = requires.map(async (spec: string): Promise<void> => {
      try {
        const result: ResolveResult = await this.resolve(spec);
        results.set(spec, result);
      } catch (err) {
        const message: string = err instanceof Error ? err.message : String(err);
        results.set(spec, { error: message });
      }
    });
    await Promise.allSettled(promises);
    return results;
  },

  /**
   * Fetch metadata for a package from the npm registry.
   */
  async getPackageInfo(packageName: string): Promise<PackageInfo> {
    const sanitized: string = this._sanitizePackageName(packageName);
    const url: string = `${this.REGISTRY_URL}/${encodeURIComponent(sanitized).replace('%40', '@')}/latest`;

    const response: string = await this._fetchWithTimeout(url, { isJson: true });
    const data: Record<string, unknown> = JSON.parse(response) as Record<string, unknown>;

    return {
      name: data.name as string,
      version: data.version as string,
      description: (data.description as string) || '',
      homepage: (data.homepage as string) || '',
      main: (data.main as string) || 'index.js'
    };
  },

  /**
   * Clear all cached npm resolution data.
   */
  async clearCache(): Promise<void> {
    try {
      await chrome.storage.local.remove(this.CACHE_KEY);
    } catch (_e) {
      // Ignore storage errors
    }
  },

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Parse an npm require spec into name and optional version.
   * Handles scoped packages (e.g. npm:@scope/name@version).
   */
  _parseSpec(spec: string): ParsedSpec {
    // Strip "npm:" prefix
    const raw: string = spec.slice(4);
    if (!raw) throw new Error('Empty npm package spec');

    let name: string;
    let version: string | null = null;

    if (raw.startsWith('@')) {
      // Scoped package: @scope/name or @scope/name@version
      const slashIdx: number = raw.indexOf('/');
      if (slashIdx === -1) throw new Error(`Invalid scoped package: ${raw}`);
      const afterScope: number = raw.indexOf('@', slashIdx);
      if (afterScope > slashIdx) {
        name = raw.slice(0, afterScope);
        version = raw.slice(afterScope + 1);
      } else {
        name = raw;
      }
    } else {
      // Regular package: name or name@version
      const atIdx: number = raw.indexOf('@');
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
  _sanitizePackageName(name: string): string {
    const trimmed: string = name.trim();
    // npm package names: lowercase, can contain hyphens, dots, underscores, scoped with @
    if (!/^(@[a-z0-9\-~][a-z0-9\-._~]*\/)?[a-z0-9\-~][a-z0-9\-._~]*$/.test(trimmed)) {
      throw new Error(`Invalid package name: ${trimmed}`);
    }
    return trimmed;
  },

  /**
   * Validate and sanitize a version string.
   */
  _sanitizeVersion(version: string): string {
    const trimmed: string = version.trim();
    // Allow semver, ranges, and tags (e.g. "4.17.21", "^1.0.0", "latest", "next")
    if (!/^[a-z0-9\-._^~>=<| *]+$/i.test(trimmed)) {
      throw new Error(`Invalid version: ${trimmed}`);
    }
    return trimmed;
  },

  /**
   * Resolve the latest version of a package from the npm registry.
   */
  async _resolveLatestVersion(name: string): Promise<string | null> {
    try {
      const info: PackageInfo = await this.getPackageInfo(name);
      return info.version;
    } catch (_e) {
      return null;
    }
  },

  /**
   * Build the ordered CDN URL list for a package.
   * Prefers UMD/IIFE bundles for userscript compatibility.
   */
  _buildCdnUrls(name: string, version: string): string[] {
    const popular: PopularPackageEntry | undefined = this.POPULAR_PACKAGES[name];
    const urls: string[] = [];

    if (popular) {
      // Use known-good paths for popular packages
      urls.push(`https://cdn.jsdelivr.net/npm/${name}@${version}/dist/${popular.file}`);
      urls.push(`https://unpkg.com/${name}@${version}/dist/${popular.file}`);
      urls.push(
        `https://cdnjs.cloudflare.com/ajax/libs/${popular.cdn}/${version}/${popular.file}`
      );
    }

    // Generic CDN chain (always included as final fallback)
    // jsdelivr +esm endpoint auto-detects the right entry point
    urls.push(`https://cdn.jsdelivr.net/npm/${name}@${version}/+esm`);
    urls.push(`https://unpkg.com/${name}@${version}`);
    urls.push(
      `https://cdnjs.cloudflare.com/ajax/libs/${name}/${version}/${name}.min.js`
    );

    // Deduplicate while preserving order
    return [...new Set(urls)];
  },

  /**
   * Fetch a URL with a timeout. Returns the response body as text.
   */
  async _fetchWithTimeout(url: string, options: FetchOptions = {}): Promise<string> {
    const controller: AbortController = new AbortController();
    const timer: ReturnType<typeof setTimeout> = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);

    try {
      const response: Response = await fetch(url, {
        signal: controller.signal,
        headers: options.isJson ? { 'Accept': 'application/json' } : {}
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }
      return await response.text();
    } finally {
      clearTimeout(timer);
    }
  },

  /**
   * Compute SHA-256 SRI hash from content string.
   * Uses the Web Crypto API (available in service workers).
   */
  async _computeSriHash(content: string): Promise<string> {
    const encoder: TextEncoder = new TextEncoder();
    const data: Uint8Array = encoder.encode(content);
    const hashBuffer: ArrayBuffer = await crypto.subtle.digest('SHA-256', data.buffer as ArrayBuffer);
    const hashArray: Uint8Array = new Uint8Array(hashBuffer);
    // Convert to base64
    let binary: string = '';
    for (let i: number = 0; i < hashArray.length; i++) {
      binary += String.fromCharCode(hashArray[i]!);
    }
    return `sha256-${btoa(binary)}`;
  },

  /**
   * Read a single entry from the npm cache.
   */
  async _getCache(key: string): Promise<ResolveResult | null> {
    try {
      const stored: Record<string, unknown> = await chrome.storage.local.get(this.CACHE_KEY);
      const cache: unknown = stored[this.CACHE_KEY];
      if (!cache || typeof cache !== 'object') return null;

      const cacheObj: NpmCache = cache as NpmCache;
      const entry: CacheEntry | undefined = cacheObj[key];
      if (!entry) return null;

      // Check TTL
      if (Date.now() - entry.timestamp > this.CACHE_TTL) {
        // Expired — remove lazily
        delete cacheObj[key];
        chrome.storage.local.set({ [this.CACHE_KEY]: cacheObj }).catch(() => {});
        return null;
      }

      return { url: entry.url, integrity: entry.integrity, version: entry.version };
    } catch (_e) {
      return null;
    }
  },

  /**
   * Write a single entry to the npm cache.
   */
  async _setCache(key: string, result: ResolveResult): Promise<void> {
    try {
      const stored: Record<string, unknown> = await chrome.storage.local.get(this.CACHE_KEY);
      const rawCache: unknown = stored[this.CACHE_KEY];
      const cache: NpmCache = (rawCache && typeof rawCache === 'object')
        ? rawCache as NpmCache
        : {};

      cache[key] = {
        url: result.url,
        integrity: result.integrity,
        version: result.version,
        timestamp: Date.now()
      };

      await chrome.storage.local.set({ [this.CACHE_KEY]: cache });
    } catch (_e) {
      // Storage write failures are non-fatal
    }
  }
};

export default NpmResolver;
export { NpmResolver };
export type { ResolveResult, ResolveError, PackageInfo, PopularPackageEntry, CacheEntry };
