export interface RuntimeHostPermissionPattern {
  supported: boolean;
  pattern: string;
  origin: string;
  scheme: string;
  host: string;
  reason: string;
}

const RECOVERABLE_HOST_SCHEMES = new Set(['http:', 'https:']);

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
