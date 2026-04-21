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
  | 'sandbox'
  | 'run-in'
  | 'license'
  | 'copyright'
  | 'contributionURL';

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
  'sandbox',
  'run-in',
  'license',
  'copyright',
  'contributionURL',
]);

/** Array‐valued metadata keys that map directly to ScriptMeta */
type ArrayMetaKey =
  | 'match'
  | 'include'
  | 'exclude'
  | 'excludeMatch'
  | 'grant'
  | 'require'
  | 'connect'
  | 'antifeature'
  | 'tag'
  | 'compatible'
  | 'incompatible';

const ARRAY_KEYS: ReadonlySet<string> = new Set<ArrayMetaKey | 'exclude-match'>([
  'match',
  'include',
  'exclude',
  'exclude-match',
  'excludeMatch',
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
      const arrayKey: ArrayMetaKey = (key === 'exclude-match' ? 'excludeMatch' : key) as ArrayMetaKey;
      if (value) {
        meta[arrayKey].push(value);
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
            meta.webRequest = JSON.parse(value) as WebRequestRule[] | null;
          } catch {
            // Malformed JSON — leave as null
          }
          break;
        default:
          // Handle localized metadata like @name:ja or @name:zh-Hans.
          // Use indexOf/slice to preserve multi-segment locale tags — split(':')
          // would truncate "zh-Hans" or similar hyphenated subtags.
          {
            const colonIdx: number = key.indexOf(':');
            if (colonIdx > 0) {
              const baseKey: string = key.slice(0, colonIdx);
              const locale: string = key.slice(colonIdx + 1);
              if (!meta.localized) meta.localized = {};
              if (!meta.localized[locale]) meta.localized[locale] = {};
              meta.localized[locale]![baseKey] = value;
            }
          }
      }
    }
  }

  // Default grant if none specified
  if (meta.grant.length === 0) {
    meta.grant = ['none'];
  }

  return { meta, code, metaBlock: metaBlockMatch[0]! };
}
