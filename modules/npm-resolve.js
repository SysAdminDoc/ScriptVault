// ============================================================================
// NPM Package Resolver for @require directives
// ============================================================================
// Resolves `@require npm:package-name` and `@require npm:package-name@version`
// to CDN URLs with fallback chain and integrity verification.
// Designed for service worker context (no DOM, fetch API only).
// ============================================================================

const NpmResolver = {
  CACHE_KEY: 'npmCache',
  CACHE_TTL: 86400000, // 24 hours
  REGISTRY_URL: 'https://registry.npmjs.org',
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
  },

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Check if a require URL uses the npm: prefix.
   * @param {string} url
   * @returns {boolean}
   */
  isNpmRequire(url) {
    return typeof url === 'string' && url.startsWith('npm:');
  },

  /**
   * Resolve a single npm require spec to a CDN URL.
   * @param {string} requireSpec - e.g. "npm:lodash" or "npm:lodash@4.17.21"
   * @returns {Promise<{url: string, integrity: string, version: string}>}
   */
  async resolve(requireSpec) {
    if (!this.isNpmRequire(requireSpec)) {
      throw new Error(`Not an npm require: ${requireSpec}`);
    }

    const { name, version: requestedVersion } = this._parseSpec(requireSpec);
    const cacheKey = `${name}@${requestedVersion || 'latest'}`;

    // Check cache first
    const cached = await this._getCache(cacheKey);
    if (cached) return cached;

    // Resolve version if not pinned (treat 'latest' as unresolved)
    const version = (requestedVersion && requestedVersion !== 'latest')
      ? requestedVersion
      : await this._resolveLatestVersion(name);
    if (!version) {
      throw new Error(`Failed to resolve version for package: ${name}`);
    }

    // Try CDN chain with fallback
    const urls = this._buildCdnUrls(name, version);
    let lastError = null;

    for (const url of urls) {
      try {
        const content = await this._fetchWithTimeout(url);
        const integrity = await this._computeSriHash(content);
        const result = { url, integrity, version };
        await this._setCache(cacheKey, result);
        return result;
      } catch (err) {
        lastError = err;
        // Continue to next CDN
      }
    }

    throw new Error(
      `Failed to resolve npm:${name}@${version} from all CDNs: ${lastError?.message || 'unknown error'}`
    );
  },

  /**
   * Batch-resolve multiple npm require specs.
   * @param {string[]} requires - Array of require specs
   * @returns {Promise<Map<string, {url: string, integrity: string, version: string}>>}
   */
  async resolveAll(requires) {
    const results = new Map();
    const promises = requires.map(async (spec) => {
      try {
        const result = await this.resolve(spec);
        results.set(spec, result);
      } catch (err) {
        results.set(spec, { error: err.message });
      }
    });
    await Promise.allSettled(promises);
    return results;
  },

  /**
   * Fetch metadata for a package from the npm registry.
   * @param {string} packageName
   * @returns {Promise<{name: string, version: string, description: string, homepage: string, main: string}>}
   */
  async getPackageInfo(packageName) {
    const sanitized = this._sanitizePackageName(packageName);
    const url = `${this.REGISTRY_URL}/${encodeURIComponent(sanitized).replace('%40', '@')}/latest`;

    const response = await this._fetchWithTimeout(url, { isJson: true });
    let data;
    try {
      data = JSON.parse(response);
    } catch (e) {
      throw new Error(`Invalid response from npm registry for "${packageName}"`);
    }

    return {
      name: data.name,
      version: data.version,
      description: data.description || '',
      homepage: data.homepage || '',
      main: data.main || 'index.js'
    };
  },

  /**
   * Clear all cached npm resolution data.
   */
  async clearCache() {
    try {
      await chrome.storage.local.remove(this.CACHE_KEY);
    } catch (e) {
      // Ignore storage errors
    }
  },

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Parse an npm require spec into name and optional version.
   * Handles scoped packages (e.g. npm:@scope/name@version).
   * @param {string} spec
   * @returns {{name: string, version: string|null}}
   */
  _parseSpec(spec) {
    // Strip "npm:" prefix
    const raw = spec.slice(4);
    if (!raw) throw new Error('Empty npm package spec');

    let name, version = null;

    if (raw.startsWith('@')) {
      // Scoped package: @scope/name or @scope/name@version
      const slashIdx = raw.indexOf('/');
      if (slashIdx === -1) throw new Error(`Invalid scoped package: ${raw}`);
      const afterScope = raw.indexOf('@', slashIdx);
      if (afterScope > slashIdx) {
        name = raw.slice(0, afterScope);
        version = raw.slice(afterScope + 1);
      } else {
        name = raw;
      }
    } else {
      // Regular package: name or name@version
      const atIdx = raw.indexOf('@');
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
   * @param {string} name
   * @returns {string}
   */
  _sanitizePackageName(name) {
    const trimmed = name.trim();
    // npm package names: lowercase, can contain hyphens, dots, underscores, scoped with @
    if (!/^(@[a-z0-9\-~][a-z0-9\-._~]*\/)?[a-z0-9\-~][a-z0-9\-._~]*$/.test(trimmed)) {
      throw new Error(`Invalid package name: ${trimmed}`);
    }
    return trimmed;
  },

  /**
   * Validate and sanitize a version string.
   * @param {string} version
   * @returns {string}
   */
  _sanitizeVersion(version) {
    const trimmed = version.trim();
    // Allow semver, ranges, and tags (e.g. "4.17.21", "^1.0.0", "latest", "next")
    if (!/^[a-z0-9\-._^~>=<| *]+$/i.test(trimmed)) {
      throw new Error(`Invalid version: ${trimmed}`);
    }
    return trimmed;
  },

  /**
   * Resolve the latest version of a package from the npm registry.
   * @param {string} name
   * @returns {Promise<string|null>}
   */
  async _resolveLatestVersion(name) {
    try {
      const info = await this.getPackageInfo(name);
      return info.version;
    } catch (e) {
      return null;
    }
  },

  /**
   * Build the ordered CDN URL list for a package.
   * Prefers UMD/IIFE bundles for userscript compatibility.
   * @param {string} name
   * @param {string} version
   * @returns {string[]}
   */
  _buildCdnUrls(name, version) {
    const popular = this.POPULAR_PACKAGES[name];
    const urls = [];

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
   * @param {string} url
   * @param {{isJson?: boolean}} options
   * @returns {Promise<string>}
   */
  async _fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);

    try {
      const response = await fetch(url, {
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
   * @param {string} content
   * @returns {Promise<string>} - SRI hash in "sha256-..." format
   */
  async _computeSriHash(content) {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    // Convert to base64
    let binary = '';
    for (let i = 0; i < hashArray.length; i++) {
      binary += String.fromCharCode(hashArray[i]);
    }
    return `sha256-${btoa(binary)}`;
  },

  /**
   * Read a single entry from the npm cache.
   * @param {string} key
   * @returns {Promise<{url: string, integrity: string, version: string}|null>}
   */
  async _getCache(key) {
    try {
      const stored = await chrome.storage.local.get(this.CACHE_KEY);
      const cache = stored[this.CACHE_KEY];
      if (!cache || typeof cache !== 'object') return null;

      const entry = cache[key];
      if (!entry) return null;

      // Check TTL
      if (Date.now() - entry.timestamp > this.CACHE_TTL) {
        // Expired — remove lazily
        delete cache[key];
        chrome.storage.local.set({ [this.CACHE_KEY]: cache }).catch(() => {});
        return null;
      }

      return { url: entry.url, integrity: entry.integrity, version: entry.version };
    } catch (e) {
      return null;
    }
  },

  /**
   * Write a single entry to the npm cache.
   * @param {string} key
   * @param {{url: string, integrity: string, version: string}} result
   */
  async _setCache(key, result) {
    try {
      const stored = await chrome.storage.local.get(this.CACHE_KEY);
      const cache = (stored[this.CACHE_KEY] && typeof stored[this.CACHE_KEY] === 'object')
        ? stored[this.CACHE_KEY]
        : {};

      cache[key] = {
        url: result.url,
        integrity: result.integrity,
        version: result.version,
        timestamp: Date.now()
      };

      await chrome.storage.local.set({ [this.CACHE_KEY]: cache });
    } catch (e) {
      // Storage write failures are non-fatal
    }
  }
};
