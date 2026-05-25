import type { ScriptMeta, RunAt, WebRequestRule } from '../types/script';

/** Result returned on successful parse */
export interface ParseSuccess {
  meta: ScriptMeta;
  code: string;
  metaBlock: string;
  error?: undefined;
}

/** Result returned when no metadata block is found */
export interface ParseError {
  meta?: undefined;
  code?: undefined;
  metaBlock?: undefined;
  error: string;
}

export type ParseResult = ParseSuccess | ParseError;

/** String‐valued metadata keys that map directly to ScriptMeta */
type StringMetaKey =
  | 'name'
  | 'namespace'
  | 'version'
  | 'description'
  | 'author'
  | 'icon'
  | 'icon64'
  | 'homepage'
  | 'homepageURL'
  | 'website'
  | 'source'
  | 'updateURL'
  | 'downloadURL'
  | 'supportURL'
  | 'run-at'
  | 'inject-into'
  | 'module'
  | 'sandbox'
  | 'run-in'
  | 'license'
  | 'copyright'
  | 'contributionURL'
  | 'crontab';

const STRING_KEYS: ReadonlySet<string> = new Set<StringMetaKey>([
  'name',
  'namespace',
  'version',
  'description',
  'author',
  'icon',
  'icon64',
  'homepage',
  'homepageURL',
  'website',
  'source',
  'updateURL',
  'downloadURL',
  'supportURL',
  'run-at',
  'inject-into',
  'module',
  'sandbox',
  'run-in',
  'license',
  'copyright',
  'contributionURL',
  'crontab',
]);

/** Array‐valued metadata keys that map directly to ScriptMeta */
type ArrayMetaKey =
  | 'match'
  | 'include'
  | 'exclude'
  | 'excludeMatch'
  | 'matchTop'
  | 'excludeTop'
  | 'grant'
  | 'require'
  | 'connect'
  | 'antifeature'
  | 'tag'
  | 'compatible'
  | 'incompatible';

// Aliases: hyphenated forms in the user-visible directive syntax → canonical
// camelCase keys on `ScriptMeta`. Phase 39.11 adds `match-top` / `exclude-top`.
const ARRAY_ALIASES: Readonly<Record<string, ArrayMetaKey>> = {
  'exclude-match': 'excludeMatch',
  'match-top': 'matchTop',
  'exclude-top': 'excludeTop',
};

const ARRAY_KEYS: ReadonlySet<string> = new Set<string>([
  'match',
  'include',
  'exclude',
  'exclude-match',
  'excludeMatch',
  'match-top',
  'matchTop',
  'exclude-top',
  'excludeTop',
  'grant',
  'require',
  'connect',
  'antifeature',
  'tag',
  'compatible',
  'incompatible',
]);

/**
 * Parse a userscript's metadata block and extract all supported directives.
 *
 * @param code - The full userscript source code
 * @returns Parsed metadata + original code, or an error message
 */
export function parseUserscript(code: string): ParseResult {
  const metaBlockMatch: RegExpMatchArray | null = code.match(
    /\/\/\s*==UserScript==([\s\S]*?)\/\/\s*==\/UserScript==/,
  );

  if (!metaBlockMatch) {
    return {
      error: 'No metadata block found. Scripts must include ==UserScript== header.',
    };
  }

  const meta: ScriptMeta = {
    name: 'Unnamed Script',
    namespace: 'scriptvault',
    version: '1.0.0',
    description: '',
    author: '',
    match: [],
    include: [],
    exclude: [],
    excludeMatch: [],
    matchTop: [],
    excludeTop: [],
    grant: [],
    require: [],
    resource: {},
    'run-at': 'document-idle',
    noframes: false,
    icon: '',
    icon64: '',
    homepage: '',
    homepageURL: '',
    website: '',
    source: '',
    updateURL: '',
    downloadURL: '',
    supportURL: '',
    connect: [],
    antifeature: [],
    unwrap: false,
    'inject-into': 'auto',
    module: '',
    sandbox: '',
    tag: [],
    'run-in': '',
    'top-level-await': false,
    license: '',
    copyright: '',
    contributionURL: '',
    compatible: [],
    incompatible: [],
    webRequest: null,
    priority: 0,
    weight: 0,
  };

  const metaBlock: string = metaBlockMatch[1]!;
  const lines: string[] = metaBlock.split('\n');

  for (const line of lines) {
    const match: RegExpMatchArray | null = line.match(/\/\/\s*@(\S+)(?:\s+(.*))?/);
    if (!match) continue;

    const key: string = match[1]!.trim();
    const value: string = (match[2] ?? '').trim();

    if (STRING_KEYS.has(key)) {
      // Type assertion is safe: we only enter this branch for keys that are
      // known to be string‐valued properties of ScriptMeta.
      (meta as unknown as Record<string, unknown>)[key] = key === 'run-at' ? (value as RunAt) : value;
    } else if (ARRAY_KEYS.has(key)) {
      const arrayKey: ArrayMetaKey = (ARRAY_ALIASES[key] ?? key) as ArrayMetaKey;
      if (value) {
        // Phase 36.6 — comma-separated convenience syntax for match/include
        // patterns (VM #2403). Authors who target many sibling sites can write
        // `// @match a.com,b.com,c.*` instead of three separate directives. We
        // only split for URL-pattern keys; commas are not valid in match
        // patterns per Chrome's match syntax. `tag` keeps the raw value so
        // multi-word tags like `// @tag my util` round-trip intact (matches
        // Violentmonkey v2.35.2 semantics).
        const splittable: boolean =
          arrayKey === 'match' ||
          arrayKey === 'include' ||
          arrayKey === 'exclude' ||
          arrayKey === 'excludeMatch' ||
          arrayKey === 'matchTop' ||
          arrayKey === 'excludeTop' ||
          arrayKey === 'connect';
        if (splittable && value.includes(',')) {
          for (const part of value.split(',')) {
            const trimmed: string = part.trim();
            if (trimmed) meta[arrayKey].push(trimmed);
          }
        } else {
          meta[arrayKey].push(value);
        }
      }
    } else {
      switch (key) {
        case 'resource': {
          const resourceMatch: RegExpMatchArray | null = value.match(/^(\S+)\s+(.+)$/);
          if (resourceMatch) {
            meta.resource[resourceMatch[1]!] = resourceMatch[2]!;
          }
          break;
        }
        case 'noframes':
          meta.noframes = true;
          break;
        case 'unwrap':
          meta.unwrap = true;
          break;
        case 'top-level-await':
          meta['top-level-await'] = true;
          break;
        case 'priority':
          meta.priority = parseInt(value, 10) || 0;
          break;
        case 'weight': {
          // Phase 11.7 — Userscripts (Safari) `@weight 1..999`. Higher =
          // earlier within the same `@run-at`. Clamped to the documented
          // range so an `@weight 99999` typo can't dominate the sort.
          const w: number = parseInt(value, 10);
          if (Number.isFinite(w)) meta.weight = Math.max(1, Math.min(999, w));
          break;
        }
        case 'nodownload':
          (meta as unknown as { nodownload?: boolean }).nodownload = true;
          break;
        case 'delay': {
          const ms: number = parseInt(value, 10);
          if (Number.isFinite(ms)) {
            (meta as unknown as { delay?: number }).delay = Math.max(0, ms);
          }
          break;
        }
        case 'webRequest':
          try {
            const raw: unknown = JSON.parse(value);
            // @webRequest accepts either a single rule object or an array of
            // rules. Normalize to array, then drop entries that don't match
            // the documented shape. The DNR rule constructor downstream
            // assumes selector + action are well-formed, so reject early
            // here rather than letting a malformed value reach the rule
            // builder where the failure mode is harder to attribute.
            const candidates: unknown[] = Array.isArray(raw) ? raw : [raw];
            const validated: WebRequestRule[] = [];
            for (const entry of candidates) {
              if (!entry || typeof entry !== 'object') continue;
              const obj = entry as Record<string, unknown>;
              const action = obj['action'];
              const selector = obj['selector'];
              // action: must be a string (e.g. 'cancel') or a shape with
              // cancel:boolean / redirect:string. Anything else is dropped.
              let validAction = false;
              if (typeof action === 'string' && action.length > 0) {
                validAction = true;
              } else if (action && typeof action === 'object') {
                const a = action as Record<string, unknown>;
                const cancel = a['cancel'];
                const redirect = a['redirect'];
                if (typeof cancel === 'boolean' || typeof redirect === 'string') {
                  validAction = true;
                }
              }
              if (!validAction) continue;
              // selector: must be an object with optional include/exclude
              // string-array properties. Missing selector defaults to a
              // catch-all wildcard rule, which is intentional per spec.
              if (selector != null && typeof selector !== 'object') continue;
              if (selector && typeof selector === 'object') {
                const s = selector as Record<string, unknown>;
                const include = s['include'];
                const exclude = s['exclude'];
                if (include != null && !Array.isArray(include)) continue;
                if (exclude != null && !Array.isArray(exclude)) continue;
              }
              validated.push(entry as WebRequestRule);
            }
            meta.webRequest = validated.length > 0 ? validated : null;
          } catch {
            // Malformed JSON — leave as null
          }
          break;
        default:
          // Handle localized metadata like @name:ja or @name:zh-Hans.
          // Use indexOf/slice to preserve multi-segment locale tags — split(':')
          // would truncate "zh-Hans" or similar hyphenated subtags.
          //
          // SECURITY: reject prototype-pollution keys. A malicious script
          // with `// @name:__proto__ EVIL` would otherwise reach
          // `meta.localized["__proto__"]["name"] = "EVIL"` — the bracket
          // accessor returns Object.prototype, and the subsequent
          // `.name = ...` mutates it directly. That contaminates every
          // object in the SW context (e.g. `{}.name === "EVIL"`),
          // corrupting all downstream code that reads `.name`/`.constructor`/
          // `.toString` etc. via inheritance.
          {
            const colonIdx: number = key.indexOf(':');
            if (colonIdx > 0) {
              const baseKey: string = key.slice(0, colonIdx);
              const locale: string = key.slice(colonIdx + 1);
              const POLLUTED = ['__proto__', 'constructor', 'prototype'];
              if (!POLLUTED.includes(baseKey) && !POLLUTED.includes(locale)) {
                if (!meta.localized) meta.localized = Object.create(null) as Record<string, Record<string, string>>;
                if (!Object.hasOwn(meta.localized, locale)) {
                  meta.localized[locale] = Object.create(null) as Record<string, string>;
                }
                meta.localized[locale]![baseKey] = value;
              }
            }
          }
      }
    }
  }

  // Default grant if none specified
  if (meta.grant.length === 0) {
    meta.grant = ['none'];
  }
  meta.esm = meta.module === '1' || meta['inject-into'] === 'module';

  return { meta, code, metaBlock: metaBlockMatch[0]! };
}
