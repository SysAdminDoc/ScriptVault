// ============================================================================
// Find Scripts source registry
// ============================================================================

export type BuiltinFindScriptsSourceId = 'greasyfork' | 'openuserjs' | 'github';

export interface FindScriptsCustomSource {
  id: string;
  label: string;
  urlTemplate: string;
  allowedOrigin: string;
  enabled: boolean;
}

export interface FindScriptsSourceSettings {
  builtin: Record<BuiltinFindScriptsSourceId, boolean>;
  custom: FindScriptsCustomSource[];
}

export interface FindScriptsSourceDescriptor {
  id: string;
  label: string;
  kind: 'builtin-api' | 'builtin-external' | 'custom-external';
  enabled: boolean;
  custom?: FindScriptsCustomSource;
}

export type CustomSourceValidationResult =
  | { ok: true; source: FindScriptsCustomSource }
  | { ok: false; error: string };

export type CustomSourceUrlResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

const MAX_CUSTOM_SOURCES = 10;
const ALLOWED_TEMPLATE_TOKENS = new Set(['query', 'page']);

export const BUILTIN_FIND_SCRIPT_SOURCES = Object.freeze([
  Object.freeze({ id: 'greasyfork', label: 'GreasyFork', kind: 'builtin-api' }),
  Object.freeze({ id: 'openuserjs', label: 'OpenUserJS', kind: 'builtin-api' }),
  Object.freeze({ id: 'github', label: 'GitHub', kind: 'builtin-external' }),
] as const);

export const DEFAULT_FIND_SCRIPT_SOURCE_SETTINGS: FindScriptsSourceSettings = Object.freeze({
  builtin: Object.freeze({ greasyfork: true, openuserjs: true, github: true }),
  custom: Object.freeze([]),
}) as unknown as FindScriptsSourceSettings;

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function stableSourceId(label: string, template: string): string {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28) || 'catalog';
  let hash = 2166136261;
  for (const char of template) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return `${slug}-${hash.toString(36)}`;
}

function isUnsafeCatalogHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
  if (host.includes(':')) return true;
  const octets = host.split('.');
  if (octets.length === 4 && octets.every(part => /^\d{1,3}$/.test(part))) {
    const values = octets.map(Number);
    const first = values[0] ?? 0;
    const second = values[1] ?? 0;
    if (values.some(value => value > 255)) return true;
    return first === 0
      || first === 10
      || first === 127
      || (first === 169 && second === 254)
      || (first === 172 && second >= 16 && second <= 31)
      || (first === 192 && second === 168)
      || first >= 224;
  }
  return !host.includes('.');
}

function parseTemplateUrl(urlTemplate: string): URL | null {
  try {
    return new URL(urlTemplate.replaceAll('{query}', 'userscript').replaceAll('{page}', '1'));
  } catch {
    return null;
  }
}

export function validateCustomFindScriptSource(input: unknown): CustomSourceValidationResult {
  const candidate = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const label = cleanText(candidate.label, 40);
  const urlTemplate = cleanText(candidate.urlTemplate, 2048);
  if (label.length < 2) return { ok: false, error: 'Source name must be at least 2 characters.' };
  if (!urlTemplate) return { ok: false, error: 'Enter an HTTPS search URL template.' };
  if (!urlTemplate.includes('{query}')) return { ok: false, error: 'URL template must include {query}.' };

  const authority = urlTemplate.match(/^https:\/\/([^/?#]+)/i)?.[1] ?? '';
  if (/[{}]/.test(authority)) {
    return { ok: false, error: 'Template placeholders cannot change the catalog origin.' };
  }

  const tokens = [...urlTemplate.matchAll(/\{([^{}]+)\}/g)].map(match => match[1] ?? '');
  const unknownToken = tokens.find(token => !ALLOWED_TEMPLATE_TOKENS.has(token));
  if (unknownToken) return { ok: false, error: `Unsupported template token {${unknownToken}}. Use only {query} and {page}.` };
  const unmatchedBraces = urlTemplate.replace(/\{(?:query|page)\}/g, '');
  if (/[{}]/.test(unmatchedBraces)) return { ok: false, error: 'URL template contains an incomplete placeholder.' };

  const parsed = parseTemplateUrl(urlTemplate);
  if (!parsed) return { ok: false, error: 'Enter a valid URL template.' };
  if (parsed.protocol !== 'https:') return { ok: false, error: 'Custom search sources must use HTTPS.' };
  if (parsed.username || parsed.password) return { ok: false, error: 'Search source URLs cannot contain credentials.' };
  if (isUnsafeCatalogHost(parsed.hostname)) return { ok: false, error: 'Use a public catalog hostname, not a local or private address.' };

  return {
    ok: true,
    source: {
      id: stableSourceId(label, urlTemplate),
      label,
      urlTemplate,
      allowedOrigin: parsed.origin,
      enabled: candidate.enabled !== false,
    },
  };
}

export function normalizeFindScriptSourceSettings(input: unknown): FindScriptsSourceSettings {
  const candidate = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const builtinInput = candidate.builtin && typeof candidate.builtin === 'object'
    ? candidate.builtin as Record<string, unknown>
    : {};
  const builtin = {
    greasyfork: builtinInput.greasyfork !== false,
    openuserjs: builtinInput.openuserjs !== false,
    github: builtinInput.github !== false,
  };
  const custom: FindScriptsCustomSource[] = [];
  const seenIds = new Set<string>();
  for (const item of Array.isArray(candidate.custom) ? candidate.custom.slice(0, MAX_CUSTOM_SOURCES) : []) {
    const validation = validateCustomFindScriptSource(item);
    if (!validation.ok || seenIds.has(validation.source.id)) continue;
    seenIds.add(validation.source.id);
    custom.push(validation.source);
  }
  return { builtin, custom };
}

export function getEnabledFindScriptSources(input: unknown): FindScriptsSourceDescriptor[] {
  const settings = normalizeFindScriptSourceSettings(input);
  const builtins: FindScriptsSourceDescriptor[] = BUILTIN_FIND_SCRIPT_SOURCES
    .filter(source => settings.builtin[source.id])
    .map(source => ({ ...source, enabled: true }));
  const custom: FindScriptsSourceDescriptor[] = settings.custom
    .filter(source => source.enabled)
    .map(source => ({ id: `custom:${source.id}`, label: source.label, kind: 'custom-external', enabled: true, custom: source }));
  return [...builtins, ...custom];
}

export function resolveFindScriptSource(input: unknown, id: unknown): FindScriptsSourceDescriptor | null {
  const sourceId = cleanText(id, 160);
  return getEnabledFindScriptSources(input).find(source => source.id === sourceId) || null;
}

export function buildCustomFindScriptSourceUrl(sourceInput: unknown, query: unknown, page: unknown = 1): CustomSourceUrlResult {
  const validation = validateCustomFindScriptSource(sourceInput);
  if (!validation.ok) return validation;
  const cleanQuery = cleanText(query, 500);
  if (!cleanQuery) return { ok: false, error: 'Enter a search term.' };
  const pageNumber = Number.isInteger(Number(page)) && Number(page) > 0 ? Number(page) : 1;
  const url = validation.source.urlTemplate
    .replaceAll('{query}', encodeURIComponent(cleanQuery))
    .replaceAll('{page}', encodeURIComponent(String(pageNumber)));
  const parsed = parseTemplateUrl(url);
  if (!parsed || parsed.origin !== validation.source.allowedOrigin) {
    return { ok: false, error: 'Search URL escaped its reviewed catalog origin.' };
  }
  return { ok: true, url: parsed.href };
}

export const FindScriptSources = Object.freeze({
  BUILTIN_FIND_SCRIPT_SOURCES,
  DEFAULT_FIND_SCRIPT_SOURCE_SETTINGS,
  buildCustomFindScriptSourceUrl,
  getEnabledFindScriptSources,
  normalizeFindScriptSourceSettings,
  resolveFindScriptSource,
  validateCustomFindScriptSource,
});

export default FindScriptSources;
