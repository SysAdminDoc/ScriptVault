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

    // Check path (convert glob to regex). Collapse consecutive `*` first so a
    // crafted @match like `/****…****a` can't produce `(.*){N}` — catastrophic
    // backtracking that freezes the SW per evaluated URL (matches matchIncludePattern).
    const pathRegex = new RegExp(
      '^' + path.replace(/\*+/g, '*').replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$',
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

export function nativeMatchPatternForRegistration(pattern: string): string | null {
  if (!isValidMatchPattern(pattern)) return null;
  if (pattern === '<all_urls>') return pattern;

  const match = pattern.match(/^(\*|https?|file|ftp):\/\/([^/]*)(\/.*)$/);
  if (!match) return null;

  const [, scheme, host, path] = match as [string, string, string, string];
  const nativeHost = host.replace(/:\d+$/, '');
  return `${scheme}://${nativeHost}${path}`;
}

function escapeRuntimeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function globPathToRuntimeRegex(path: string): string {
  return escapeRuntimeRegex(path.replace(/\*+/g, '*')).replace(/\\\*/g, '.*');
}

export function matchPatternToRuntimeRegex(pattern: string): string | null {
  if (!isValidMatchPattern(pattern)) return null;
  if (pattern === '<all_urls>') return '/^[^:]+:\\/\\//i';

  const match = pattern.match(/^(\*|https?|file|ftp):\/\/([^/]*)(\/.*)$/);
  if (!match) return null;

  const [, scheme, host, path] = match as [string, string, string, string];
  const schemeRegex = scheme === '*' ? '[^:]+' : escapeRuntimeRegex(scheme);
  let hostRegex = '';
  if (host === '*') {
    hostRegex = '[^/]*';
  } else if (host.startsWith('*.')) {
    const base = escapeRuntimeRegex(host.slice(2));
    hostRegex = `(?:${base}|[^/]+\\.${base})`;
  } else {
    hostRegex = escapeRuntimeRegex(host);
  }
  const source = `^${schemeRegex}://${hostRegex}${globPathToRuntimeRegex(path)}$`;
  return `/${source.replace(/\//g, '\\/')}/i`;
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

// ---------------------------------------------------------------------------
// MatchSet — precompiled host index for fast `getScriptsForUrl`-style queries.
//
// The naive matcher walks every script and tests every pattern on every URL
// query. With 200+ scripts that's hundreds of regex tests per popup open. The
// MatchSet trades a tiny amount of build cost for an O(1) hostname lookup
// that filters the candidate set down to scripts whose patterns could
// possibly match before falling through to the slow per-pattern check.
//
// Bucketing strategy:
//   - "*" or "<all_urls>" or scheme-only patterns → universal bucket (always
//     candidates).
//   - Concrete hostname → indexed under the lowercase hostname.
//   - "*.example.com" → indexed under "example.com" so a URL with hostname
//     "example.com" or "sub.example.com" both pick it up via suffix walk.
//   - Regex `@include` patterns → universal bucket (we can't statically
//     extract a host without false negatives).
//   - Plain glob `@include` (no `://` scheme delimiter) → universal bucket.
//
// `getCandidates(url)` returns the union of universal + hostname bucket +
// every parent domain bucket (so `*.example.com` matches `a.b.example.com`).
// ---------------------------------------------------------------------------

interface PatternRecord {
  pattern: string;
  kind: 'match' | 'include' | 'excludeMatch' | 'exclude';
}

function extractHostHint(pattern: string, kind: PatternRecord['kind']): string | null {
  if (!pattern) return null;
  if (pattern === '*' || pattern === '<all_urls>') return null;

  // Regex @include — no static host hint without false negatives.
  if ((kind === 'include' || kind === 'exclude') && isRegexPattern(pattern)) {
    return null;
  }

  // Match-style patterns: scheme://host/path
  const m = pattern.match(/^(?:\*|https?|file|ftp):\/\/([^/]+)/);
  if (!m) return null;
  const host = m[1]!;
  if (!host || host === '*') return null;
  // Strip port for indexing — matchPattern handles port comparison itself.
  const noPort = host.replace(/:\d+$/, '');
  if (noPort.startsWith('*.')) {
    const base = noPort.slice(2);
    return base.toLowerCase();
  }
  // Reject hostnames with embedded wildcards we don't index (e.g. "*foo.bar").
  if (noPort.includes('*')) return null;
  return noPort.toLowerCase();
}

function getEffectivePatterns(script: Script): PatternRecord[] {
  const meta = (script.meta || {}) as Partial<Script['meta']>;
  const settings = (script.settings || {}) as Record<string, unknown>;
  const out: PatternRecord[] = [];

  const pushAll = (
    arr: string[] | string | undefined,
    kind: PatternRecord['kind'],
  ): void => {
    if (!arr) return;
    const list = Array.isArray(arr) ? arr : [arr];
    for (const p of list) {
      if (typeof p === 'string' && p) out.push({ pattern: p, kind });
    }
  };

  if (settings.useOriginalMatches !== false) pushAll(meta.match as string[] | undefined, 'match');
  pushAll(settings.userMatches as string[] | undefined, 'match');

  if (settings.useOriginalIncludes !== false) {
    pushAll(meta.include as string[] | undefined, 'include');
  }
  pushAll(settings.userIncludes as string[] | undefined, 'include');

  pushAll(meta.excludeMatch as string[] | undefined, 'excludeMatch');

  return out;
}

/**
 * Precompiled fast-lookup index over a collection of scripts.
 *
 * Build once when the script set changes, then call `getCandidates(url)` for
 * each URL query. The candidate list is a strict superset of the scripts
 * that `doesScriptMatchUrl` would return true for; pass each candidate
 * through `doesScriptMatchUrl` for the authoritative answer.
 */
export class MatchSet {
  private universal: Script[] = [];
  private byHost: Map<string, Script[]> = new Map();
  readonly size: number;

  constructor(scripts: readonly Script[]) {
    this.size = scripts.length;
    for (const script of scripts) {
      if (!script || !script.id) continue;
      const patterns = getEffectivePatterns(script);

      // Match-only bucketing — only positive (match/include) patterns gate
      // candidacy. excludeMatch never adds to the candidate set; it's
      // applied later in doesScriptMatchUrl.
      const positive = patterns.filter((p) => p.kind === 'match' || p.kind === 'include');

      if (positive.length === 0) {
        // No positive patterns at all — script can't run on any URL.
        continue;
      }

      let allUniversal = false;
      const hosts = new Set<string>();
      for (const p of positive) {
        if (p.pattern === '*' || p.pattern === '<all_urls>') {
          allUniversal = true;
          break;
        }
        const hint = extractHostHint(p.pattern, p.kind);
        if (hint == null) {
          // Either regex without a host hint, or a non-match-shaped glob.
          // Conservatively put it in the universal bucket so doesScriptMatchUrl
          // can rule it in or out.
          allUniversal = true;
          break;
        }
        hosts.add(hint);
      }

      if (allUniversal) {
        this.universal.push(script);
      } else {
        for (const host of hosts) {
          let bucket = this.byHost.get(host);
          if (!bucket) {
            bucket = [];
            this.byHost.set(host, bucket);
          }
          bucket.push(script);
        }
      }
    }
  }

  /**
   * Return scripts whose @match/@include patterns *could* match `url`.
   * The result is a superset — callers must run `doesScriptMatchUrl` for
   * authoritative inclusion.
   */
  getCandidates(url: string): Script[] {
    let hostname: string;
    try {
      hostname = new URL(url).hostname.toLowerCase();
    } catch {
      // Invalid URL — only the universal bucket can match (e.g. <all_urls>
      // can match data: URLs which don't have a hostname).
      return [...this.universal];
    }

    const seen = new Set<Script>();
    const out: Script[] = [];

    for (const s of this.universal) {
      if (!seen.has(s)) {
        seen.add(s);
        out.push(s);
      }
    }

    // Walk every suffix: a.b.example.com → a.b.example.com, b.example.com,
    // example.com, com. This lets a `*.example.com` pattern (indexed under
    // "example.com") match a URL with hostname "a.b.example.com".
    let cursor = hostname;
    while (cursor) {
      const bucket = this.byHost.get(cursor);
      if (bucket) {
        for (const s of bucket) {
          if (!seen.has(s)) {
            seen.add(s);
            out.push(s);
          }
        }
      }
      const dot = cursor.indexOf('.');
      if (dot < 0) break;
      cursor = cursor.slice(dot + 1);
    }

    return out;
  }

  /**
   * Return scripts that actually match `url` (universal candidates filtered
   * through `doesScriptMatchUrl`).
   */
  getMatching(url: string): Script[] {
    const candidates = this.getCandidates(url);
    return candidates.filter((s) => doesScriptMatchUrl(s, url));
  }
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
