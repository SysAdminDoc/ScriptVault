// ============================================================================
// Resource Loader — @require script fetching with caching, fallbacks, and SRI
// Strict TypeScript migration from background.core.js (lines 4173-4436)
// ============================================================================

// ---------------------------------------------------------------------------
// External dependencies (not yet migrated to TS modules)
// ---------------------------------------------------------------------------

declare function debugLog(...args: unknown[]): void;

// ---------------------------------------------------------------------------
// In-memory cache for @require scripts (current session only)
// ---------------------------------------------------------------------------

export const requireCache: Map<string, string> = new Map();

// ---------------------------------------------------------------------------
// Common library fallback URLs
// ---------------------------------------------------------------------------

export const LIBRARY_FALLBACKS: Record<string, string[]> = {
  'jquery': [
    'https://code.jquery.com/jquery-3.7.1.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js',
    'https://ajax.googleapis.com/ajax/libs/jquery/3.7.1/jquery.min.js'
  ],
  'jquery@3': [
    'https://code.jquery.com/jquery-3.7.1.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js'
  ],
  'jquery@2': [
    'https://code.jquery.com/jquery-2.2.4.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jquery/2.2.4/jquery.min.js'
  ],
  'gm_config': [
    'https://cdn.jsdelivr.net/npm/gm_config@2024.12.1/gm_config.min.js',
    'https://cdn.jsdelivr.net/gh/sizzlemctwizzle/GM_config@master/gm_config.js',
    'https://raw.githubusercontent.com/sizzlemctwizzle/GM_config/master/gm_config.js',
    'https://greasyfork.org/scripts/1884-gm-config/code/gm_config.js',
    'https://openuserjs.org/src/libs/sizzle/GM_config.js'
  ],
  'mutation-summary': [
    'https://cdn.jsdelivr.net/npm/mutation-summary@1.0.1/dist/mutation-summary.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/mutation-summary/1.0.1/mutation-summary.min.js',
    'https://unpkg.com/mutation-summary@1.0.1/dist/mutation-summary.min.js'
  ]
};

// ---------------------------------------------------------------------------
// getFallbackUrls — find alternative CDN URLs for a library
// ---------------------------------------------------------------------------

export function getFallbackUrls(url: string): string[] {
  const lowerUrl = url.toLowerCase();

  // Check for known libraries
  if (lowerUrl.includes('gm_config') || lowerUrl.includes('gm-config') ||
      lowerUrl.includes('gm4_config') || lowerUrl.includes('sizzle/gm_config') ||
      lowerUrl.includes('1884-gm-config')) {
    return LIBRARY_FALLBACKS['gm_config'] ?? [];
  }
  if (lowerUrl.includes('mutation-summary') || lowerUrl.includes('mutationsummary')) {
    return LIBRARY_FALLBACKS['mutation-summary'] ?? [];
  }
  if (lowerUrl.includes('jquery')) {
    if (lowerUrl.includes('@2') || lowerUrl.includes('2.')) {
      return LIBRARY_FALLBACKS['jquery@2'] ?? [];
    }
    return LIBRARY_FALLBACKS['jquery'] ?? [];
  }

  // For unpkg URLs, try jsdelivr as fallback
  if (lowerUrl.includes('unpkg.com')) {
    const jsdelivrUrl = url.replace('unpkg.com', 'cdn.jsdelivr.net/npm');
    return [jsdelivrUrl];
  }

  // For rawgit/raw.githubusercontent, try jsdelivr gh
  if (lowerUrl.includes('raw.githubusercontent.com')) {
    // Convert: https://raw.githubusercontent.com/user/repo/branch/path
    // To: https://cdn.jsdelivr.net/gh/user/repo@branch/path
    const match = url.match(/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)/);
    if (match) {
      const [, user, repo, branch, path] = match;
      return [`https://cdn.jsdelivr.net/gh/${user}/${repo}@${branch}/${path}`];
    }
  }

  return [];
}

// ---------------------------------------------------------------------------
// isUnfetchableUrl — detect URLs known to be unfetchable (auth, CORS, etc.)
// ---------------------------------------------------------------------------

export function isUnfetchableUrl(url: string): boolean {
  const lowerUrl = url.toLowerCase();

  // Font Awesome kit URLs require authentication
  if (lowerUrl.includes('kit.fontawesome.com')) {
    return true;
  }

  // Google Fonts CSS (not JS, but sometimes used)
  if (lowerUrl.includes('fonts.googleapis.com')) {
    return true;
  }

  // URLs with authentication tokens that will fail
  if (lowerUrl.includes('?token=') || lowerUrl.includes('&token=')) {
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// verifySRI — verify SubResource Integrity hash for fetched content
// ---------------------------------------------------------------------------

export async function verifySRI(code: string, hashStr: string | null): Promise<boolean> {
  if (!hashStr) return true;
  // Support formats: sha256-<base64>, md5-<hex>, or just <hex>
  const match = hashStr.match(/^(sha256|sha384|sha512|md5)[-=](.+)$/i);
  if (!match) return true; // Unknown format, skip verification
  const [, algo, expected] = match;
  if (!algo || !expected) return true;
  if (algo.toLowerCase() === 'md5') return true; // Can't verify MD5 with SubtleCrypto
  const algoMap: Record<string, string> = { sha256: 'SHA-256', sha384: 'SHA-384', sha512: 'SHA-512' };
  try {
    const algoName = algoMap[algo.toLowerCase()];
    if (!algoName) return true;
    const digest = await crypto.subtle.digest(algoName, new TextEncoder().encode(code));
    const actual = btoa(String.fromCharCode(...new Uint8Array(digest)));
    return actual === expected;
  } catch (_e) {
    return true; // Verification not possible, allow
  }
}

// ---------------------------------------------------------------------------
// fetchRequireScript — fetch a @require script with caching and fallbacks
// ---------------------------------------------------------------------------

export async function fetchRequireScript(url: string): Promise<string | null> {
  // Extract SRI hash from URL fragment (e.g., url#sha256=abc123 or url#md5=abc123)
  let sriHash: string | null = null;
  let fetchUrl: string = url;
  const hashIdx = url.indexOf('#');
  if (hashIdx > 0) {
    const fragment = url.slice(hashIdx + 1);
    if (/^(sha256|sha384|sha512|md5)[-=]/i.test(fragment)) {
      sriHash = fragment;
      fetchUrl = url.slice(0, hashIdx);
    }
  }

  debugLog('Fetching @require:', fetchUrl);

  // Skip URLs that are known to be unfetchable
  if (isUnfetchableUrl(fetchUrl)) {
    console.warn(`[ScriptVault] Skipping unfetchable @require: ${url}`);
    return null;
  }

  // Check in-memory cache first
  if (requireCache.has(fetchUrl)) {
    debugLog('Using cached @require:', fetchUrl);
    return requireCache.get(fetchUrl) ?? null;
  }

  // Check persistent cache in chrome.storage.local
  // Hash the URL to create a fixed-length collision-resistant cache key
  const cacheKey = await (async (): Promise<string> => {
    const data = new TextEncoder().encode(url);
    const hash = await crypto.subtle.digest('SHA-256', data);
    const hex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    return `require_cache_${hex}`;
  })();
  try {
    const cached = await chrome.storage.local.get(cacheKey);
    const entry = cached[cacheKey] as { code?: string; timestamp?: number } | undefined;
    if (entry?.code) {
      // Check if cache is less than 7 days old
      const age = Date.now() - (entry.timestamp ?? 0);
      if (age < 7 * 24 * 60 * 60 * 1000) {
        debugLog('Using persistent cached @require:', url);
        // Use fetchUrl (without SRI fragment) as the in-memory cache key so
        // subsequent lookups at line `requireCache.has(fetchUrl)` hit.
        requireCache.set(fetchUrl, entry.code);
        return entry.code;
      }
    }
  } catch (_e) {
    // Ignore cache errors
  }

  // Build list of URLs to try (original + fallbacks)
  const fallbacks = getFallbackUrls(fetchUrl);
  const urlsToTry = [fetchUrl, ...fallbacks];
  debugLog(`Will try ${urlsToTry.length} URLs for:`, fetchUrl);

  for (const tryUrl of urlsToTry) {
    try {
      debugLog('Trying:', tryUrl);
      const code = await fetchWithRetry(tryUrl);
      if (code) {
        // Verify SRI hash if provided
        if (sriHash) {
          const valid = await verifySRI(code, sriHash);
          if (!valid) {
            console.warn(`[ScriptVault] SRI hash mismatch for ${tryUrl}, skipping`);
            continue;
          }
        }
        // Store in both caches
        requireCache.set(fetchUrl, code);

        // Store in persistent cache
        try {
          await chrome.storage.local.set({
            [cacheKey]: { code, timestamp: Date.now(), url: tryUrl }
          });
        } catch (_e) {
          // Ignore storage errors
        }

        if (tryUrl !== url) {
          debugLog(`Successfully fetched ${url} from fallback:`, tryUrl);
        } else {
          debugLog('Successfully fetched:', url);
        }
        return code;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[ScriptVault] Failed to fetch ${tryUrl}: ${msg}`);
      // Try next URL
      continue;
    }
  }

  console.error(`[ScriptVault] Failed to fetch ${url} (tried ${urlsToTry.length} URLs)`);
  return null;
}

// ---------------------------------------------------------------------------
// fetchWithRetry — fetch with retry, timeout, and size limits
// ---------------------------------------------------------------------------

export async function fetchWithRetry(url: string, retries: number = 2): Promise<string | null> {
  for (let i = 0; i <= retries; i++) {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'text/javascript, application/javascript, text/plain, */*',
          'Cache-Control': 'no-cache'
        },
        mode: 'cors',
        credentials: 'omit',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Reject excessively large @require scripts (>5MB) to prevent memory issues
      const MAX_REQUIRE_BYTES = 5 * 1024 * 1024;
      const contentLength = parseInt(response.headers.get('content-length') ?? '0', 10);
      if (contentLength > MAX_REQUIRE_BYTES) {
        throw new Error(`Response too large (${Math.round(contentLength / 1024)}KB, max 5MB)`);
      }

      const code = await response.text();

      if (code.length > MAX_REQUIRE_BYTES) {
        throw new Error(`Response too large (${Math.round(code.length / 1024)}KB, max 5MB)`);
      }

      // Basic validation - should look like JavaScript
      if (code && code.length > 0) {
        return code;
      }

      throw new Error('Empty response');
    } catch (e) {
      clearTimeout(timeoutId); // Always clear to prevent dangling timers on network errors
      if (i === retries) {
        throw e;
      }
      // Wait before retry
      await new Promise<void>(r => setTimeout(r, 500 * (i + 1)));
    }
  }
  return null;
}
