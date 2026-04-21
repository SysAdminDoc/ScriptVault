/**
 * URL matching utilities for determining which scripts should run on a given URL.
 *
 * Extracted from background.core.js — logic is kept identical.
 */

import type { Script } from '../types/script';
import type { Settings } from '../types/settings';

/**
 * Subset of global settings consumed by URL-blocking checks.
 * The full Settings type does not carry these fields today, so we
 * define a narrow interface that matches what background.core.js passes.
 */
export interface GlobalUrlFilterSettings {
  deniedHosts?: string[];
  pageFilterMode?: 'blacklist' | 'whitelist';
  whitelistedPages?: string;
  blacklistedPages?: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check whether a URL is blocked by global (extension-wide) settings
 * such as denied hosts or page-level black/white-lists.
 */
export function isUrlBlockedByGlobalSettings(
  url: string,
  globalSettings: GlobalUrlFilterSettings,
): boolean {
  if (!url) return false;
  try {
    const urlObj = new URL(url);

    // Denied hosts
    const denied = globalSettings.deniedHosts;
    if (denied && Array.isArray(denied)) {
      for (const host of denied) {
        if (host && (urlObj.hostname === host || urlObj.hostname.endsWith('.' + host))) {
          return true;
        }
      }
    }

    // Page filter mode
    const mode: string = globalSettings.pageFilterMode || 'blacklist';
    if (mode === 'whitelist') {
      const whitelist = (globalSettings.whitelistedPages || '')
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      if (whitelist.length > 0) {
        const matched = whitelist.some((p) => matchIncludePattern(p, url, urlObj));
        if (!matched) return true;
      }
    } else if (mode === 'blacklist') {
      const blacklist = (globalSettings.blacklistedPages || '')
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      if (blacklist.length > 0) {
        const matched = blacklist.some((p) => matchIncludePattern(p, url, urlObj));
        if (matched) return true;
      }
    }
  } catch (_e) {
    // Invalid URL — treat as not blocked
  }
  return false;
}

/**
 * Determine whether a given script should run on `url`, taking into account
 * the script's @match, @include, @exclude, @exclude-match directives as
 * well as per-script settings overrides (userMatches, userIncludes, etc.).
 */
export function doesScriptMatchUrl(script: Script, url: string): boolean {
  const meta = script.meta || ({} as Script['meta']);
  const settings = script.settings || {};

  try {
    const urlObj = new URL(url);

    // Build effective patterns based on settings
    const effectiveMatches: string[] = [];
    const effectiveIncludes: string[] = [];
    const effectiveExcludes: string[] = [];

    // Original @match patterns (if enabled)
    if ((settings as Record<string, unknown>).useOriginalMatches !== false) {
      const origMatches: string[] = Array.isArray(meta.match)
        ? meta.match
        : meta.match
          ? [meta.match as unknown as string]
          : [];
      effectiveMatches.push(...origMatches);
    }

    // User @match patterns
    const userMatches = (settings as Record<string, unknown>).userMatches as
      | string[]
      | undefined;
    if (userMatches && userMatches.length > 0) {
      effectiveMatches.push(...userMatches);
    }

    // Original @include patterns (if enabled)
    if ((settings as Record<string, unknown>).useOriginalIncludes !== false) {
      const origIncludes: string[] = Array.isArray(meta.include)
        ? meta.include
        : meta.include
          ? [meta.include as unknown as string]
          : [];
      effectiveIncludes.push(...origIncludes);
    }

    // User @include patterns
    const userIncludes = (settings as Record<string, unknown>).userIncludes as
      | string[]
      | undefined;
    if (userIncludes && userIncludes.length > 0) {
      effectiveIncludes.push(...userIncludes);
    }

    // Original @exclude patterns (if enabled)
    if ((settings as Record<string, unknown>).useOriginalExcludes !== false) {
      const origExcludes: string[] = Array.isArray(meta.exclude)
        ? meta.exclude
        : meta.exclude
          ? [meta.exclude as unknown as string]
          : [];
      effectiveExcludes.push(...origExcludes);
    }

    // User @exclude patterns
    const userExcludes = (settings as Record<string, unknown>).userExcludes as
      | string[]
      | undefined;
    if (userExcludes && userExcludes.length > 0) {
      effectiveExcludes.push(...userExcludes);
    }

    // Also check @exclude-match (stored as excludeMatch by parser)
    const excludeMatchPatterns: string[] = Array.isArray(meta.excludeMatch)
      ? meta.excludeMatch
      : meta.excludeMatch
        ? [meta.excludeMatch as unknown as string]
        : [];

    // First check if URL matches any exclude pattern
    for (const pattern of effectiveExcludes) {
      if (matchIncludePattern(pattern, url, urlObj)) return false;
    }
    for (const pattern of excludeMatchPatterns) {
      if (matchPattern(pattern, url, urlObj)) return false;
    }

    // Then check if URL matches any include/match pattern
    for (const pattern of effectiveMatches) {
      if (matchPattern(pattern, url, urlObj)) return true;
    }
    for (const pattern of effectiveIncludes) {
      if (matchIncludePattern(pattern, url, urlObj)) return true;
    }

    return false;
  } catch (_e) {
    return false;
  }
}

/**
 * Match a `@match` pattern (Chrome-style match pattern) against a URL.
 */
export function matchPattern(pattern: string, url: string, urlObj: URL): boolean {
  if (!pattern) return false;
  if (pattern === '<all_urls>') return true;
  if (pattern === '*') return true;

  try {
    // Parse the pattern
    const patternMatch = pattern.match(/^(\*|https?|file|ftp):\/\/([^/]+)(\/.*)$/);
    if (!patternMatch) return false;

    const [, scheme, host, path] = patternMatch as [string, string, string, string];

    // Check scheme
    if (scheme !== '*' && scheme !== urlObj.protocol.slice(0, -1)) {
      return false;
    }

    // Check host (use urlObj.host when pattern includes port, urlObj.hostname otherwise)
    if (host !== '*') {
      const hasPort = host.includes(':');
      const urlHost = hasPort ? urlObj.host : urlObj.hostname;
      if (host.startsWith('*.')) {
        const baseDomain = host.slice(2);
        if (hasPort) {
          // For *.example.com:8080, compare host (includes port) against baseDomain
          if (urlHost !== baseDomain && !urlHost.endsWith('.' + baseDomain)) {
            return false;
          }
        } else {
          // For *.example.com, compare hostname only
          if (urlObj.hostname !== baseDomain && !urlObj.hostname.endsWith('.' + baseDomain)) {
            return false;
          }
        }
      } else if (host !== urlHost) {
        return false;
      }
    }

    // Check path (convert glob to regex)
    const pathRegex = new RegExp(
      '^' + path.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$',
    );
    if (!pathRegex.test(urlObj.pathname + urlObj.search)) {
      return false;
    }

    return true;
  } catch (_e) {
    return false;
  }
}

/**
 * Match an `@include` pattern (glob-style or regex) against a URL.
 */
export function matchIncludePattern(pattern: string, url: string, urlObj: URL): boolean {
  if (!pattern) return false;
  if (pattern === '*') return true;

  try {
    // Handle regex patterns: /regex/ or /regex/flags
    if (isRegexPattern(pattern)) {
      const re = parseRegexPattern(pattern);
      return re ? re.test(url) : false;
    }

    // Convert glob to regex. Collapse consecutive `*` before conversion so
    // patterns like `***abc***.tld` don't produce `(.*){N}` which is a
    // catastrophic-backtracking ReDoS vector.
    const collapsed: string = pattern.replace(/\*+/g, '*');
    let regex = collapsed
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special chars
      .replace(/\*/g, '.*') // * -> .*
      .replace(/\?/g, '.'); // ? -> .

    // Handle scheme wildcards
    regex = regex.replace(/^(\\\*):\/\//, '(https?|file|ftp)://');

    const re = new RegExp('^' + regex + '$', 'i');
    return re.test(url);
  } catch (_e) {
    return false;
  }
}

/**
 * Validate whether a string is a well-formed Chrome extension match pattern.
 */
export function isValidMatchPattern(pattern: string): boolean {
  if (!pattern) return false;
  if (pattern === '<all_urls>') return true;

  // Match pattern validation (allows ports: http://localhost:3000/*)
  const matchRegex = /^(\*|https?|file|ftp):\/\/(\*|\*\.[^/*]+|[^/*:]+(?::\d+)?)\/.*$/;
  return matchRegex.test(pattern);
}

/**
 * Check if a pattern is a regex `@include` (wrapped in `/regex/`).
 */
export function isRegexPattern(pattern: string): boolean {
  if (!pattern || !pattern.startsWith('/') || pattern.length <= 2) return false;
  const match = pattern.match(/^\/(.+?)\/([gimsuy]*)$/);
  if (!match) return false;
  // Require at least one regex metacharacter to distinguish from plain URL paths like /path/to/file/
  return /[\\^$\[(+?{|]/.test(match[1]!);
}

/**
 * Parse a regex `@include` pattern string into a `RegExp` object.
 * Returns `null` if the pattern is invalid.
 */
export function parseRegexPattern(pattern: string): RegExp | null {
  const match = pattern.match(/^\/(.+)\/([gimsuy]*)$/);
  if (!match) return null;
  try {
    return new RegExp(match[1]!, match[2]!);
  } catch (_e) {
    return null;
  }
}

/**
 * Extract broad match patterns from a regex string, suitable for Chrome
 * content-script registration. The actual fine-grained filtering happens
 * at runtime in the injected wrapper.
 */
export function extractMatchPatternsFromRegex(regexStr: string): string[] {
  // Remove the /.../ wrapper and flags
  const inner = regexStr.replace(/^\//, '').replace(/\/[gimsuy]*$/, '');
  const patterns: string[] = [];

  // Strategy 1: Find domain patterns like "name\.(tld1|tld2|tld3)" or "name\.tld"
  // Handles: 1337x\.(to|st|ws|eu|se|is|gd|unblocked\.dk)
  const domainWithAlts = /([a-z0-9][-a-z0-9]*)\\\.\(([^)]+)\)/gi;
  let match: RegExpExecArray | null;
  while ((match = domainWithAlts.exec(inner)) !== null) {
    const base = match[1]!;
    const altsRaw = match[2]!;
    // Split alternatives, handling escaped dots within them (e.g. unblocked\.dk)
    const alts = altsRaw.split('|').map((a) => a.replace(/\\\./g, '.'));
    for (const alt of alts) {
      // Only use clean TLD/domain alternatives (no regex metacharacters)
      if (/^[a-z0-9][-a-z0-9.]*$/i.test(alt) && alt.length >= 2 && alt.length <= 30) {
        patterns.push(`*://*.${base}.${alt}/*`);
        patterns.push(`*://${base}.${alt}/*`);
      }
    }
  }

  // Strategy 2: Find simple "domain\.tld" patterns not inside groups
  const simpleDomain =
    /(?:^|\/\/)(?:\([^)]*\))?([a-z0-9][-a-z0-9]*(?:\\\.)[a-z]{2,10})(?:[\\\/\$\)]|$)/gi;
  while ((match = simpleDomain.exec(inner)) !== null) {
    const domain = match[1]!.replace(/\\\./g, '.');
    if (/^[a-z0-9][-a-z0-9]*\.[a-z]{2,10}$/i.test(domain)) {
      patterns.push(`*://*.${domain}/*`);
      patterns.push(`*://${domain}/*`);
    }
  }

  // Deduplicate
  return [...new Set(patterns)];
}

/**
 * Convert an `@include` glob pattern to a `@match`-style pattern.
 * Returns `null` if conversion is not possible.
 */
export function convertIncludeToMatch(include: string): string | null {
  if (!include) return null;

  // If it's already a valid match pattern, return it
  if (isValidMatchPattern(include)) return include;

  // Handle common patterns
  if (include === '*') return '<all_urls>';

  // Try to convert glob to match pattern
  // Replace ** with * and handle http/https
  let pattern = include;

  // Handle patterns like *://example.com/*
  if (pattern.startsWith('*://')) {
    const afterScheme = pattern.slice(4);
    if (!afterScheme.includes('/')) pattern += '/*';
    return isValidMatchPattern(pattern) ? pattern : null;
  }

  // Handle patterns like http://example.com/*
  if (/^https?:\/\//.test(pattern)) {
    if (!pattern.includes('/*') && !pattern.endsWith('/')) pattern += '/*';
    return isValidMatchPattern(pattern) ? pattern : null;
  }

  // Handle patterns like *.example.com
  if (pattern.startsWith('*.')) {
    const result = '*://' + pattern + '/*';
    return isValidMatchPattern(result) ? result : null;
  }

  // Handle patterns like example.com
  if (!pattern.includes('://') && !pattern.startsWith('/')) {
    const result = '*://' + pattern + '/*';
    return isValidMatchPattern(result) ? result : null;
  }

  return null;
}
