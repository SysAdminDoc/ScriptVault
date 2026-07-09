// ============================================================================
// Resource Loader — @require script fetching with caching, fallbacks, and SRI
// Strict TypeScript migration from background.core.js (lines 4173-4436)
// ============================================================================

import { fetchTextBounded } from './fetch-bounded';
import { classifyFetchUrl, classifyResponseUrl } from './internal-host-guard';
import { SettingsManager } from '../modules/storage';

// ---------------------------------------------------------------------------
// External dependencies (not yet migrated to TS modules)
// ---------------------------------------------------------------------------

declare function debugLog(...args: unknown[]): void;

interface NpmResolvedRequire {
  url: string;
  integrity: string;
  version: string;
  code: string;
}

declare const NpmResolver: {
  isNpmRequire?: (url: string) => boolean;
  resolveWithCode?: (spec: string) => Promise<NpmResolvedRequire>;
} | undefined;

// ---------------------------------------------------------------------------
// In-memory cache for @require scripts (current session only)
// ---------------------------------------------------------------------------

export const requireCache: Map<string, string> = new Map();

const MAX_REQUIRE_BYTES = 5 * 1024 * 1024;
const MAX_PROVENANCE_BUNDLE_BYTES = 256 * 1024;

export interface FetchRequireScriptOptions {
  bypassCache?: boolean;
  cacheResult?: boolean;
  // Probe/preview/receipt callers set this so install/update review can inspect
  // a dependency even under enforce mode (enforcement applies to execution).
  allowUnpinned?: boolean;
}

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

function parseRequireIntegrity(url: string): { fetchUrl: string; sriHash: string | null } {
  let fetchUrl = url;
  let sriHash: string | null = null;
  const hashIdx = url.indexOf('#');
  if (hashIdx > 0) {
    const fragment = url.slice(hashIdx + 1);
    if (/^(sha256|sha384|sha512|md5)[-=]/i.test(fragment)) {
      sriHash = fragment;
      fetchUrl = url.slice(0, hashIdx);
    }
  }
  return { fetchUrl, sriHash };
}

export function hasVerifiableRequireIntegrity(url: string): boolean {
  const { sriHash } = parseRequireIntegrity(url);
  return /^(sha256|sha384|sha512)[-=]/i.test(sriHash || '');
}

async function shouldRequirePinnedRequire(options: FetchRequireScriptOptions): Promise<boolean> {
  if (options.allowUnpinned) return false;
  try {
    const settings = await SettingsManager.get();
    return settings.sri === 'require';
  } catch {
    return false;
  }
}

async function buildRequireCacheKey(url: string): Promise<string> {
  const data = new TextEncoder().encode(url);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const hex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `require_cache_${hex}`;
}

function isNpmRequireSpec(url: string): boolean {
  return typeof NpmResolver !== 'undefined' &&
    typeof NpmResolver.isNpmRequire === 'function' &&
    NpmResolver.isNpmRequire(url);
}

// ---------------------------------------------------------------------------
// verifySRI — verify SubResource Integrity hash for fetched content
// ---------------------------------------------------------------------------

// Normalize a base64 / base64url value (with or without padding) to a canonical
// padded standard-base64 string so SRI hashes pasted in either encoding compare
// equal. Prevents a correctly-pinned require from silently failing the integrity
// check (and then falling through to a different fallback CDN).
function normalizeSriBase64(value: string): string {
  let s = value.replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '');
  const rem = s.length % 4;
  if (rem === 2) s += '==';
  else if (rem === 3) s += '=';
  return s;
}

export async function verifySRI(code: string, hashStr: string | null): Promise<boolean> {
  if (!hashStr) return true; // No integrity requested — nothing to verify.
  // Support formats: sha256-<base64>, sha384/512, md5-<hex>, with - or = separator.
  const match = hashStr.match(/^(sha256|sha384|sha512|md5)[-=](.+)$/i);
  if (!match) return true; // Not an SRI hash string — nothing enforceable to verify.
  const [, algo, expected] = match;
  if (!algo || !expected) return true;
  const algoMap: Record<string, string> = { sha256: 'SHA-256', sha384: 'SHA-384', sha512: 'SHA-512' };
  const algoName = algoMap[algo.toLowerCase()];
  // MD5 (and any algorithm SubtleCrypto cannot compute) is unverifiable here.
  // Treat it as "no enforceable integrity" rather than failing closed, which
  // would break existing scripts pinned with a legacy/weak hash.
  if (!algoName) return true;
  try {
    const digest = await crypto.subtle.digest(algoName, new TextEncoder().encode(code));
    const actual = btoa(String.fromCharCode(...new Uint8Array(digest)));
    return normalizeSriBase64(actual) === normalizeSriBase64(expected);
  } catch (_e) {
    // Integrity WAS requested with a verifiable algorithm but verification could
    // not complete — fail CLOSED. Accepting unverified bytes here would make the
    // SRI pin a no-op and defeat protection against a compromised/MITM'd CDN.
    return false;
  }
}

// ---------------------------------------------------------------------------
// fetchRequireScript — fetch a @require script with caching and fallbacks
// ---------------------------------------------------------------------------

export async function fetchRequireScript(url: string, options: FetchRequireScriptOptions = {}): Promise<string | null> {
  const bypassCache = options.bypassCache === true;
  const cacheResult = options.cacheResult !== false;

  if (isNpmRequireSpec(url)) {
    debugLog('Resolving npm @require:', url);

    if (!bypassCache && requireCache.has(url)) {
      debugLog('Using cached npm @require:', url);
      return requireCache.get(url) ?? null;
    }

    let cacheKey = '';
    if (!bypassCache || cacheResult) {
      cacheKey = await buildRequireCacheKey(url);
    }

    if (!bypassCache) {
      try {
        const cached = await chrome.storage.local.get(cacheKey);
        const entry = cached[cacheKey] as { code?: string; timestamp?: number; url?: string } | undefined;
        if (entry?.code) {
          const age = Date.now() - (entry.timestamp ?? 0);
          if (age < 7 * 24 * 60 * 60 * 1000) {
            debugLog('Using persistent cached npm @require:', url);
            requireCache.set(url, entry.code);
            if (entry.url) requireCache.set(entry.url, entry.code);
            return entry.code;
          }
        }
      } catch (_e) {
        // Ignore cache errors.
      }
    }

    if (typeof NpmResolver?.resolveWithCode !== 'function') {
      console.warn(`[ScriptVault] NPM @require resolver unavailable: ${url}`);
      return null;
    }

    try {
      const resolved = await NpmResolver.resolveWithCode(url);
      if (!resolved || typeof resolved.code !== 'string' || !resolved.url || !resolved.integrity) {
        throw new Error('NPM resolver returned an incomplete result');
      }

      const valid = await verifySRI(resolved.code, resolved.integrity);
      if (!valid) {
        throw new Error(`computed SRI verification failed for ${resolved.url}`);
      }

      if (cacheResult) {
        requireCache.set(url, resolved.code);
        requireCache.set(resolved.url, resolved.code);
        try {
          await chrome.storage.local.set({
            [cacheKey]: {
              code: resolved.code,
              timestamp: Date.now(),
              url: resolved.url,
              integrity: resolved.integrity,
              version: resolved.version,
              spec: url
            }
          });
        } catch (_e) {
          // Ignore storage errors.
        }
      }

      debugLog(`Resolved npm @require ${url} to ${resolved.url}`);
      return resolved.code;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[ScriptVault] Failed to resolve npm @require ${url}: ${msg}`);
      return null;
    }
  }

  if (typeof url === 'string' && url.startsWith('npm:')) {
    console.warn(`[ScriptVault] NPM @require resolver unavailable: ${url}`);
    return null;
  }

  // Extract SRI hash from URL fragment (e.g., url#sha256=abc123 or url#md5=abc123)
  const { fetchUrl, sriHash } = parseRequireIntegrity(url);

  // SRI enforcement: in "require" mode, refuse un-pinned remote requires. npm
  // specs are resolved with a computed SRI above and never reach here.
  if (await shouldRequirePinnedRequire(options) && !hasVerifiableRequireIntegrity(url)) {
    console.warn(`[ScriptVault] Refusing un-pinned @require (SRI = require): ${fetchUrl}`);
    return null;
  }

  debugLog('Fetching @require:', fetchUrl);

  // Skip URLs that are known to be unfetchable
  if (isUnfetchableUrl(fetchUrl)) {
    console.warn(`[ScriptVault] Skipping unfetchable @require: ${url}`);
    return null;
  }

  // Check in-memory cache first
  if (!bypassCache && requireCache.has(fetchUrl)) {
    debugLog('Using cached @require:', fetchUrl);
    return requireCache.get(fetchUrl) ?? null;
  }

  // Check persistent cache in chrome.storage.local
  // Hash the URL to create a fixed-length collision-resistant cache key
  let cacheKey = '';
  if (!bypassCache || cacheResult) {
    cacheKey = await buildRequireCacheKey(url);
  }
  if (!bypassCache) {
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
        // Store in both caches unless this is an integrity probe. TOFU receipt
        // checks must not poison the active cache when they reject an update.
        if (cacheResult) {
          requireCache.set(fetchUrl, code);

          // Store in persistent cache
          try {
            await chrome.storage.local.set({
              [cacheKey]: { code, timestamp: Date.now(), url: tryUrl }
            });
          } catch (_e) {
            // Ignore storage errors
          }
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

export async function fetchProvenanceBundle(url: string): Promise<string | null> {
  const preCheck = classifyFetchUrl(url, ['http:', 'https:']);
  if (!preCheck.ok) {
    throw new Error(`@require-provenance URL rejected: ${preCheck.message}`);
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/vnd.dev.sigstore.bundle.v0.3+json, application/json, text/plain, */*',
        'Cache-Control': 'no-cache',
      },
      // Do not force mode:'cors'. Extension host permissions cover these
      // remote reads, and forcing CORS breaks valid dependency hosts that do
      // not echo the extension origin.
      credentials: 'omit',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const postCheck = classifyResponseUrl(response, ['http:', 'https:']);
    if (!postCheck.ok) {
      throw new Error(`@require-provenance URL redirected to ${postCheck.message}`);
    }
    const text = await fetchTextBounded(response, MAX_PROVENANCE_BUNDLE_BYTES, 'Provenance bundle');
    return text && text.trim().length > 0 ? text : null;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---------------------------------------------------------------------------
// fetchWithRetry — fetch with retry, timeout, and size limits
// ---------------------------------------------------------------------------

export async function fetchWithRetry(url: string, retries: number = 2): Promise<string | null> {
  // Pre-flight: reject internal/loopback/link-local hosts before any network
  // I/O. @require sources should be public CDNs; allow http:/https: only and
  // let the post-flight check catch redirects into private space.
  const preCheck = classifyFetchUrl(url, ['http:', 'https:']);
  if (!preCheck.ok) {
    throw new Error(`@require URL rejected: ${preCheck.message}`);
  }

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
        // Do not force mode:'cors'. Extension host permissions cover these
        // remote reads, and forcing CORS breaks valid dependency hosts that do
        // not echo the extension origin.
        credentials: 'omit',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const postCheck = classifyResponseUrl(response, ['http:', 'https:']);
      if (!postCheck.ok) {
        throw new Error(`@require URL redirected to ${postCheck.message}`);
      }

      const code = await fetchTextBounded(response, MAX_REQUIRE_BYTES, 'Response');

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
