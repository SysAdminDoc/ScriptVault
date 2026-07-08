export interface RuntimeHostPermissionPattern {
  supported: boolean;
  pattern: string;
  origin: string;
  scheme: string;
  host: string;
  reason: string;
}

export interface OptionalHostPermissionPlan {
  origins: string[];
  broadOrigins: string[];
  unsupported: string[];
  requiresBroadHostAccess: boolean;
}

export const OPTIONAL_HOST_PERMISSION_PATTERNS = ['http://*/*', 'https://*/*'] as const;

const RECOVERABLE_HOST_SCHEMES = new Set(['http:', 'https:']);
const OPTIONAL_HOST_SCHEMES = new Set(['http', 'https']);

function emptyPattern(reason: string): RuntimeHostPermissionPattern {
  return {
    supported: false,
    pattern: '',
    origin: '',
    scheme: '',
    host: '',
    reason,
  };
}

function normalizeHostForPattern(hostname: string): string {
  const host = String(hostname || '').trim().toLowerCase();
  if (!host) return '';
  if (host.includes(':') && !host.startsWith('[')) return `[${host}]`;
  return host;
}

export function runtimeHostPermissionPatternForUrl(rawUrl: string | URL): RuntimeHostPermissionPattern {
  let url: URL;
  try {
    url = rawUrl instanceof URL ? rawUrl : new URL(String(rawUrl || ''));
  } catch {
    return emptyPattern('invalid-url');
  }

  if (!RECOVERABLE_HOST_SCHEMES.has(url.protocol)) {
    return emptyPattern('unsupported-scheme');
  }

  const host = normalizeHostForPattern(url.hostname);
  if (!host) return emptyPattern('missing-host');

  return {
    supported: true,
    pattern: `${url.protocol}//${host}/*`,
    origin: url.origin,
    scheme: url.protocol.slice(0, -1),
    host,
    reason: '',
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

function addOptionalOrigin(target: Set<string>, scheme: string, host: string): void {
  const cleanScheme = String(scheme || '').replace(/:$/, '').toLowerCase();
  const cleanHost = String(host || '').trim().toLowerCase().replace(/:(\d{1,5})$/, '');
  if (!OPTIONAL_HOST_SCHEMES.has(cleanScheme) || !cleanHost) return;
  target.add(`${cleanScheme}://${cleanHost}/*`);
}

function addBroadOrigin(target: Set<string>, scheme: string): void {
  const cleanScheme = String(scheme || '').replace(/:$/, '').toLowerCase();
  if (cleanScheme === '*') {
    target.add('http://*/*');
    target.add('https://*/*');
  } else if (OPTIONAL_HOST_SCHEMES.has(cleanScheme)) {
    target.add(`${cleanScheme}://*/*`);
  }
}

function addMatchPattern(pattern: unknown, origins: Set<string>, broadOrigins: Set<string>, unsupported: Set<string>): void {
  const raw = String(pattern || '').trim();
  if (!raw) return;
  if (raw === '<all_urls>' || raw === '*://*/*') {
    broadOrigins.add('http://*/*');
    broadOrigins.add('https://*/*');
    return;
  }
  const match = raw.match(/^(\*|https?|file|ftp):\/\/([^/]+)(?:\/.*)?$/i);
  if (!match) {
    unsupported.add(raw);
    return;
  }
  const scheme = String(match[1] || '').toLowerCase();
  const host = String(match[2] || '').toLowerCase();
  if (scheme === 'file' || scheme === 'ftp') {
    unsupported.add(raw);
    return;
  }
  if (host === '*') {
    addBroadOrigin(broadOrigins, scheme);
    return;
  }
  if (scheme === '*') {
    addOptionalOrigin(origins, 'http', host);
    addOptionalOrigin(origins, 'https', host);
    return;
  }
  addOptionalOrigin(origins, scheme, host);
}

function addUrlOrigin(rawUrl: unknown, origins: Set<string>, unsupported: Set<string>): void {
  const raw = String(rawUrl || '').trim();
  if (!raw) return;
  try {
    const parsed = new URL(raw);
    if (!RECOVERABLE_HOST_SCHEMES.has(parsed.protocol)) {
      unsupported.add(raw);
      return;
    }
    const host = normalizeHostForPattern(parsed.hostname);
    if (!host) {
      unsupported.add(raw);
      return;
    }
    addOptionalOrigin(origins, parsed.protocol, host);
  } catch {
    unsupported.add(raw);
  }
}

function addConnectPattern(pattern: unknown, origins: Set<string>, broadOrigins: Set<string>, unsupported: Set<string>): void {
  const raw = String(pattern || '').trim();
  if (!raw || raw === 'self') return;
  if (raw === '*' || raw === '<all_urls>' || raw === '*://*/*') {
    broadOrigins.add('http://*/*');
    broadOrigins.add('https://*/*');
    return;
  }
  if (/^(?:\*|https?):\/\//i.test(raw)) {
    addMatchPattern(raw.endsWith('/*') || raw.includes('/', raw.indexOf('://') + 3) ? raw : `${raw}/*`, origins, broadOrigins, unsupported);
    return;
  }
  const host = raw.replace(/^(\*\.)?/, '$1').replace(/\/.*$/, '').toLowerCase();
  if (!host || /[\s?#]/.test(host)) {
    unsupported.add(raw);
    return;
  }
  addOptionalOrigin(origins, 'http', host);
  addOptionalOrigin(origins, 'https', host);
}

function arrayValues(value: unknown): unknown[] {
  return Array.isArray(value) ? value : (value ? [value] : []);
}

export function deriveOptionalHostPermissionPlan(
  meta: Record<string, unknown> | null | undefined,
  options: { allowBroad?: boolean } = {},
): OptionalHostPermissionPlan {
  const origins = new Set<string>();
  const broadOrigins = new Set<string>();
  const unsupported = new Set<string>();
  const scriptMeta = meta || {};

  for (const pattern of arrayValues(scriptMeta.match)) addMatchPattern(pattern, origins, broadOrigins, unsupported);
  for (const pattern of arrayValues(scriptMeta.include)) addMatchPattern(pattern, origins, broadOrigins, unsupported);
  for (const pattern of arrayValues(scriptMeta.matchTop)) addMatchPattern(pattern, origins, broadOrigins, unsupported);

  for (const pattern of arrayValues(scriptMeta.connect)) addConnectPattern(pattern, origins, broadOrigins, unsupported);
  for (const url of arrayValues(scriptMeta.require)) addUrlOrigin(url, origins, unsupported);
  for (const url of Object.values((scriptMeta.resource && typeof scriptMeta.resource === 'object') ? scriptMeta.resource as Record<string, unknown> : {})) {
    addUrlOrigin(url, origins, unsupported);
  }
  addUrlOrigin(scriptMeta.updateURL, origins, unsupported);
  addUrlOrigin(scriptMeta.downloadURL, origins, unsupported);

  if (options.allowBroad) {
    for (const origin of broadOrigins) origins.add(origin);
  }

  return {
    origins: unique([...origins]),
    broadOrigins: unique([...broadOrigins]),
    unsupported: unique([...unsupported]),
    requiresBroadHostAccess: broadOrigins.size > 0,
  };
}
