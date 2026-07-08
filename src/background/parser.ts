import type { ScriptMeta, RunAt, ScriptAntifeature, WebRequestRule } from '../types/script';
import { ScriptConfig } from '../modules/script-config';

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
  | 'requireProvenance'
  | 'requireIdentity'
  | 'connect'
  | 'tag'
  | 'compatible'
  | 'incompatible';

// Aliases: hyphenated forms in the user-visible directive syntax → canonical
// camelCase keys on `ScriptMeta`. Phase 39.11 adds `match-top` / `exclude-top`.
const ARRAY_ALIASES: Readonly<Record<string, ArrayMetaKey>> = {
  'exclude-match': 'excludeMatch',
  'match-top': 'matchTop',
  'exclude-top': 'excludeTop',
  'require-provenance': 'requireProvenance',
  'require-identity': 'requireIdentity',
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
  'require-provenance',
  'requireProvenance',
  'require-identity',
  'requireIdentity',
  'connect',
  'tag',
  'compatible',
  'incompatible',
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isHeaderConditionArray(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  return value.every((entry) => {
    if (!isPlainObject(entry)) return false;
    if (typeof entry['header'] !== 'string' || !entry['header'].trim()) return false;
    if (entry['values'] != null && !isStringArray(entry['values'])) return false;
    if (entry['excludedValues'] != null && !isStringArray(entry['excludedValues'])) return false;
    return true;
  });
}

function isHeaderMutationMap(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  return Object.entries(value).every(([name, headerValue]) => (
    !!name.trim() && (headerValue === null || typeof headerValue === 'string')
  ));
}

function isRedirectTarget(value: unknown): boolean {
  if (typeof value === 'string') return value.length > 0;
  if (!isPlainObject(value)) return false;
  return typeof value['url'] === 'string' || typeof value['regexSubstitution'] === 'string';
}

function isValidWebRequestAction(action: unknown): boolean {
  if (typeof action === 'string') return action.length > 0;
  if (!isPlainObject(action)) return false;
  if (typeof action['cancel'] === 'boolean') return true;
  if (action['redirect'] != null && isRedirectTarget(action['redirect'])) return true;
  if (action['setRequestHeaders'] != null && isHeaderMutationMap(action['setRequestHeaders'])) return true;
  if (action['setResponseHeaders'] != null && isHeaderMutationMap(action['setResponseHeaders'])) return true;
  return false;
}

function isValidWebRequestSelector(selector: unknown): boolean {
  if (selector == null || typeof selector === 'string') return true;
  if (!isPlainObject(selector)) return false;
  if (selector['include'] != null && !isStringArray(selector['include'])) return false;
  if (selector['exclude'] != null && !isStringArray(selector['exclude'])) return false;
  if (selector['responseHeaders'] != null && !isHeaderConditionArray(selector['responseHeaders'])) return false;
  if (selector['excludedResponseHeaders'] != null && !isHeaderConditionArray(selector['excludedResponseHeaders'])) return false;
  return true;
}

function parseAntifeatureDirective(value: string, locale = ''): ScriptAntifeature | null {
  const trimmed: string = value.trim();
  if (!trimmed) return null;

  const match: RegExpMatchArray | null = trimmed.match(/^(\S+)(?:\s+([\s\S]*))?$/);
  if (!match) return null;

  return {
    type: match[1]!.toLowerCase(),
    description: (match[2] ?? '').trim(),
    locale,
  };
}

function parseBooleanDirective(value: string): boolean {
  if (!value) return true;
  const normalized: string = value.trim().toLowerCase();
  return !['0', 'false', 'no', 'off', 'disabled'].includes(normalized);
}

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
    requireProvenance: [],
    requireIdentity: [],
    resource: Object.create(null) as Record<string, string>,
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
    config: [],
    priority: 0,
    weight: 0,
    background: false,
    isolationCookie: false,
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
    } else if (key === 'antifeature') {
      const parsedAntifeature: ScriptAntifeature | null = parseAntifeatureDirective(value);
      if (parsedAntifeature) meta.antifeature.push(parsedAntifeature);
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
          arrayKey === 'requireProvenance' ||
          arrayKey === 'requireIdentity' ||
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
        case 'background':
          meta.background = true;
          break;
        case 'isolationCookie':
        case 'isolation-cookie':
        case 'cookieIsolation':
        case 'cookie-isolation':
          meta.isolationCookie = parseBooleanDirective(value);
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
              // action: string commands and reviewed DNR header mutation maps.
              if (!isValidWebRequestAction(action)) continue;
              // selector: URL/include/exclude filters plus Chrome 128+
              // responseHeaders/excludedResponseHeaders HeaderInfo arrays.
              if (!isValidWebRequestSelector(selector)) continue;
              validated.push(entry as WebRequestRule);
            }
            meta.webRequest = validated.length > 0 ? validated : null;
          } catch {
            // Malformed JSON — leave as null
          }
          break;
        case 'var': {
          const parsedConfig = ScriptConfig.parseDirective(value);
          if (parsedConfig) meta.config.push(parsedConfig);
          break;
        }
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
                if (baseKey === 'antifeature') {
                  const parsedAntifeature: ScriptAntifeature | null = parseAntifeatureDirective(value, locale);
                  if (parsedAntifeature) meta.antifeature.push(parsedAntifeature);
                } else {
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
  }

  // Default grant if none specified
  if (meta.grant.length === 0) {
    meta.grant = ['none'];
  }
  meta.esm = meta.module === '1' || meta['inject-into'] === 'module';

  return { meta, code, metaBlock: metaBlockMatch[0]! };
}
