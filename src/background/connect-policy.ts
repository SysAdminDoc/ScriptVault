// ============================================================================
// Script network/connect policy helpers
// ============================================================================

type ScriptLike = {
  meta?: {
    connect?: unknown;
    match?: unknown;
    include?: unknown;
  };
  settings?: {
    useOriginalMatches?: boolean;
    userMatches?: unknown;
    useOriginalIncludes?: boolean;
    userIncludes?: unknown;
  };
};

type SettingsLike = {
  allowHighPrivilegeScriptApis?: boolean;
  allowInternalXhr?: boolean;
};

type GuardResult = {
  ok?: boolean;
  reason?: string;
};

type ConnectPolicyResult = {
  allowed: boolean;
  hostname: string;
  source?: string;
  error?: string;
};

function scopeArray(value: unknown): unknown[] {
  if (!value) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value];
}

export function normalizeConnectHost(value: unknown): string {
  if (typeof value !== 'string') return '';
  let pattern = value.trim().toLowerCase();
  if (!pattern) return '';
  if (pattern === '*' || pattern === 'self' || pattern === 'localhost') return pattern;

  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(pattern)) {
      pattern = new URL(pattern.replace(/\*/g, 'x')).hostname.toLowerCase();
    }
  } catch (_) {
    // Fall through to best-effort host extraction below.
  }

  pattern = pattern.replace(/^\/\//, '');
  for (const delimiter of ['/', '?', '#']) {
    const delimiterIndex = pattern.indexOf(delimiter);
    if (delimiterIndex >= 0) pattern = pattern.slice(0, delimiterIndex);
  }
  if (pattern.startsWith('*.')) pattern = pattern.slice(2);
  if (pattern.startsWith('x.')) pattern = pattern.slice(2);
  if (pattern.startsWith('.')) pattern = pattern.slice(1);
  const bracketEnd = pattern.indexOf(']');
  if (pattern.startsWith('[') && bracketEnd > 0) {
    pattern = pattern.slice(1, bracketEnd);
  } else {
    const [hostPart = ''] = pattern.split(':');
    pattern = hostPart;
  }
  return pattern;
}

export function hostMatchesConnectPattern(hostname: unknown, pattern: unknown): boolean {
  const host = normalizeConnectHost(hostname);
  const target = normalizeConnectHost(pattern);
  if (!host || !target) return false;
  if (target === 'localhost') return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  return host === target || host.endsWith('.' + target);
}

function isLocalhostConnectHost(hostname: unknown): boolean {
  const host = normalizeConnectHost(hostname);
  if (host === 'localhost' || host === '::1') return true;
  const parts = host.split('.');
  const [firstOctet] = parts;
  return parts.length === 4
    && typeof firstOctet === 'string'
    && parts.every(part => /^\d+$/.test(part))
    && Number(firstOctet) === 127;
}

function hasExplicitLocalhostConnectOptIn(script: ScriptLike | null | undefined, requestUrl: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(requestUrl).hostname;
  } catch (_) {
    return false;
  }
  if (!isLocalhostConnectHost(hostname)) return false;

  const connectList = Array.isArray(script?.meta?.connect) ? script.meta.connect : [];
  return connectList.some(pattern => {
    const rawPattern = String(pattern || '').trim();
    const normalized = normalizeConnectHost(rawPattern);
    if (!normalized || normalized === '*' || normalized === 'self') return false;
    if (!isLocalhostConnectHost(normalized)) return false;
    return hostMatchesConnectPattern(hostname, normalized);
  });
}

export function shouldAllowInternalXhr(
  script: ScriptLike | null | undefined,
  requestUrl: string,
  settings: SettingsLike | null | undefined,
  guardResult: GuardResult | null | undefined,
): boolean {
  if (!guardResult || guardResult.ok) return true;
  if (!['localhost-alias', 'ipv4-internal', 'ipv6-internal'].includes(String(guardResult.reason || ''))) {
    return false;
  }
  if (settings?.allowInternalXhr === true) return true;
  return hasExplicitLocalhostConnectOptIn(script, requestUrl);
}

function getEffectiveScriptScopePatterns(script: ScriptLike | null | undefined): { matches: unknown[]; includes: unknown[] } {
  const meta = script?.meta || {};
  const settings = script?.settings || {};
  const matches: unknown[] = [];
  const includes: unknown[] = [];

  if (settings.useOriginalMatches !== false) matches.push(...scopeArray(meta.match));
  if (Array.isArray(settings.userMatches)) matches.push(...settings.userMatches.filter(Boolean));
  if (settings.useOriginalIncludes !== false) includes.push(...scopeArray(meta.include));
  if (Array.isArray(settings.userIncludes)) includes.push(...settings.userIncludes.filter(Boolean));

  return { matches, includes };
}

function extractHostScopeHost(pattern: string): string {
  if (typeof pattern !== 'string') return '';
  const raw = pattern.trim();
  if (!raw) return '';
  if (raw === '*' || raw === '<all_urls>') return '*';

  const match = raw.match(/^(?:\*|https?|file|ftp):\/\/([^/]+)/i);
  if (!match) return '';
  const host = match[1];
  if (!host || host === '*') return '*';
  return normalizeConnectHost(host);
}

export function getScriptHostScopeInfo(script: ScriptLike | null | undefined): { universal: boolean; hosts: string[] } {
  const { matches, includes } = getEffectiveScriptScopePatterns(script);
  const hosts = new Set<string>();
  let universal = false;

  for (const pattern of [...matches, ...includes]) {
    const host = extractHostScopeHost(String(pattern));
    if (host === '*') {
      universal = true;
      continue;
    }
    if (host) hosts.add(host);
  }

  return { universal, hosts: [...hosts] };
}

export function isScriptHostScopeAllowed(script: ScriptLike | null | undefined, requestUrl: string): boolean {
  let urlObj: URL;
  try {
    urlObj = new URL(requestUrl);
  } catch (_) {
    return false;
  }

  const scopeInfo = getScriptHostScopeInfo(script);
  if (scopeInfo.universal) return true;
  return scopeInfo.hosts.some(host => hostMatchesConnectPattern(urlObj.hostname, host));
}

function selfConnectDomains(script: ScriptLike | null | undefined): string[] {
  return getScriptHostScopeInfo(script).hosts;
}

export function evaluateConnectPolicy(script: ScriptLike | null | undefined, requestUrl: string): ConnectPolicyResult {
  let hostname: string;
  try {
    hostname = new URL(requestUrl).hostname;
  } catch (_) {
    return { allowed: false, error: 'Invalid URL', hostname: '' };
  }

  const connectList = Array.isArray(script?.meta?.connect) ? script.meta.connect : [];
  if (isScriptHostScopeAllowed(script, requestUrl)) {
    return { allowed: true, hostname };
  }
  if (connectList.some(pattern => String(pattern).trim() === '*')) {
    return { allowed: true, hostname, source: '@connect' };
  }

  const selfDomains = selfConnectDomains(script);
  const allowed = connectList.some(pattern => {
    const normalized = normalizeConnectHost(pattern);
    if (normalized === 'self') {
      return selfDomains.some(domain => hostMatchesConnectPattern(hostname, domain));
    }
    return hostMatchesConnectPattern(hostname, normalized);
  });

  return {
    allowed,
    hostname,
    error: allowed ? '' : (connectList.length > 0
      ? `Connection to ${hostname} blocked by @connect policy`
      : `Connection to ${hostname} blocked by script host scope`),
  };
}

function isHighPrivilegeScriptApiOverride(settings: SettingsLike | null | undefined): boolean {
  return settings?.allowHighPrivilegeScriptApis === true;
}

export function evaluateScriptHostScopePolicy(
  script: ScriptLike | null | undefined,
  requestUrl: string,
  capability: string,
  settings: SettingsLike = {},
): ConnectPolicyResult {
  let hostname: string;
  try {
    hostname = new URL(requestUrl).hostname;
  } catch (_) {
    return { allowed: false, hostname: '', error: 'Invalid URL' };
  }
  if (isHighPrivilegeScriptApiOverride(settings)) return { allowed: true, hostname };
  const allowed = isScriptHostScopeAllowed(script, requestUrl);
  return {
    allowed,
    hostname,
    error: allowed ? '' : `${capability} to ${hostname} blocked by script host scope`,
  };
}

export const ConnectPolicy = Object.freeze({
  evaluateConnectPolicy,
  evaluateScriptHostScopePolicy,
  getScriptHostScopeInfo,
  hostMatchesConnectPattern,
  isScriptHostScopeAllowed,
  normalizeConnectHost,
  shouldAllowInternalXhr,
});

export default ConnectPolicy;
