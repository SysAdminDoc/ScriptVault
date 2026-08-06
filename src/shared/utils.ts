// ScriptVault Shared Utilities
// Used by background.js (inlined at build time) and HTML pages (via <script src>)

/**
 * Escape HTML special characters to prevent XSS.
 * Works in both DOM (pages) and non-DOM (service worker) contexts.
 */
export function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Generate a unique script ID using crypto.randomUUID().
 */
export function generateId(): string {
  return 'script_' + crypto.randomUUID();
}

/**
 * Validate and sanitize a URL for safe use in href attributes.
 * Returns the URL if safe, or null if potentially dangerous.
 */
export function sanitizeUrl(url: string): string | null {
  if (!url) return null;
  const trimmed = String(url).replace(/[\u0000-\u0020\u007f]+/g, '');
  if (!trimmed) return null;
  if (/^(javascript|data|vbscript|blob|file):/i.test(trimmed)) return null;
  if (/^(https?|ftp|mailto):/i.test(trimmed) || trimmed.startsWith('/') || trimmed.startsWith('#')) {
    return trimmed;
  }
  if (trimmed.startsWith('//')) return trimmed;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null;
  return trimmed;
}

type BrowserAliasRoot = Record<string, unknown> & {
  browser?: unknown;
  chrome?: unknown;
};

export interface BrowserNamespaceAliasStatus {
  installed: boolean;
  source: 'native-browser' | 'chrome-alias' | 'unavailable' | 'locked';
  reason?: string;
}

function hasExtensionRuntime(api: unknown): boolean {
  if (!api || (typeof api !== 'object' && typeof api !== 'function')) return false;
  const runtime = (api as { runtime?: unknown }).runtime;
  if (!runtime || (typeof runtime !== 'object' && typeof runtime !== 'function')) return false;
  const rt = runtime as { id?: unknown; sendMessage?: unknown; getURL?: unknown };
  return typeof rt.id === 'string' ||
    typeof rt.sendMessage === 'function' ||
    typeof rt.getURL === 'function';
}

/**
 * Install a Chrome-to-browser namespace alias only inside an extension-owned
 * global that already has chrome.runtime. This keeps user/page worlds from
 * gaining any API they did not already have.
 */
export function installBrowserNamespaceAlias(
  root: BrowserAliasRoot = globalThis as unknown as BrowserAliasRoot,
): BrowserNamespaceAliasStatus {
  if (hasExtensionRuntime(root.browser)) {
    return { installed: false, source: root.browser === root.chrome ? 'chrome-alias' : 'native-browser' };
  }

  const chromeApi = root.chrome;
  if (!hasExtensionRuntime(chromeApi)) {
    return { installed: false, source: 'unavailable', reason: 'chrome.runtime unavailable' };
  }

  const descriptor = Object.getOwnPropertyDescriptor(root, 'browser');
  if (descriptor && !descriptor.configurable) {
    if ('value' in descriptor && (descriptor.value === undefined || descriptor.value === chromeApi)) {
      return { installed: false, source: descriptor.value === chromeApi ? 'chrome-alias' : 'unavailable' };
    }
    return { installed: false, source: 'locked', reason: 'browser property is not configurable' };
  }

  try {
    Object.defineProperty(root, 'browser', {
      configurable: true,
      enumerable: false,
      writable: false,
      value: chromeApi,
    });
    return { installed: true, source: 'chrome-alias' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { installed: false, source: 'locked', reason: message };
  }
}

export type InstallSourceTone = 'good' | 'neutral' | 'warn';

export interface InstallSourceClassification {
  id: string;
  name: string;
  hostname: string;
  tone: InstallSourceTone;
  url: string;
}

/**
 * Classify an install/update URL into a known userscript registry.
 */
export function classifyInstallSource(url: string): InstallSourceClassification {
  if (typeof url !== 'string' || !url.trim()) {
    return { id: 'local', name: 'Local import', hostname: '', tone: 'neutral', url: '' };
  }
  let host = '';
  let path = '';
  try {
    const u = new URL(url);
    host = (u.hostname || '').toLowerCase();
    path = u.pathname || '';
  } catch (_) {
    return { id: 'other', name: 'Unknown source', hostname: '', tone: 'warn', url };
  }
  if (host === 'greasyfork.org' || host === 'www.greasyfork.org') {
    return { id: 'greasyfork', name: 'Greasy Fork', hostname: host, tone: 'good', url };
  }
  if (host === 'sleazyfork.org' || host === 'www.sleazyfork.org') {
    return { id: 'sleazyfork', name: 'Sleazy Fork', hostname: host, tone: 'warn', url };
  }
  if (host === 'openuserjs.org' || host === 'www.openuserjs.org') {
    return { id: 'openuserjs', name: 'OpenUserJS', hostname: host, tone: 'good', url };
  }
  if (host === 'gist.github.com' || host === 'gist.githubusercontent.com') {
    return { id: 'github-gist', name: 'GitHub Gist', hostname: host, tone: 'neutral', url };
  }
  if (host === 'raw.githubusercontent.com') {
    return { id: 'github-raw', name: 'GitHub raw', hostname: host, tone: 'neutral', url };
  }
  if (host === 'github.com' || host === 'www.github.com') {
    if (/\/releases\/(download|latest)/i.test(path)) {
      return { id: 'github-release', name: 'GitHub release', hostname: host, tone: 'good', url };
    }
    return { id: 'github', name: 'GitHub', hostname: host, tone: 'neutral', url };
  }
  if (host === 'gitlab.com' || host === 'www.gitlab.com') {
    return { id: 'gitlab', name: 'GitLab', hostname: host, tone: 'neutral', url };
  }
  if (host === 'codeberg.org') {
    return { id: 'codeberg', name: 'Codeberg', hostname: host, tone: 'neutral', url };
  }
  if (host === 'bitbucket.org') {
    return { id: 'bitbucket', name: 'Bitbucket', hostname: host, tone: 'neutral', url };
  }
  if (host === 'tampermonkey.net' || host === 'www.tampermonkey.net') {
    return { id: 'tampermonkey', name: 'Tampermonkey site', hostname: host, tone: 'neutral', url };
  }
  return { id: 'other', name: host || 'Unknown source', hostname: host, tone: 'warn', url };
}

/**
 * Reduce a hostname to the label a domain badge should show.
 *
 * `www.example.com` -> `example`. Multi-level TLDs need a real public-suffix
 * list: the label-count heuristic turns `example.co.uk` into `co`.
 *
 * Firefox 153 added `browser.publicSuffix`, which answers this exactly from the
 * browser's own PSL. It is gated behind the `"publicSuffix"` permission, so the
 * namespace is `undefined` unless the manifest declares it — an earlier probe
 * that omitted the permission concluded the API did not exist and the branch was
 * deleted. It does exist: with the permission declared, Firefox 154.0b1 returns
 * `example.co.uk` for `www.example.co.uk`. `manifest-firefox.json` now declares
 * it; Chrome has no equivalent API, and Firefox 140-152 predate it, so both fall
 * through to the heuristic. Never assume the namespace is present — feature-detect.
 *
 * Single implementation shared by the dashboard, popup, and side panel — the
 * three had byte-identical copies that had to be patched in lockstep.
 */
export function getDomainRoot(domain: string): string {
  const host = String(domain || '').replace(/^www\./, '');
  if (!host) return '';

  // With a real PSL the answer is exact: the first label of the eTLD+1.
  const registrable = getRegistrableDomain(host);
  if (registrable) return registrable.split('.').filter(Boolean)[0] ?? '';

  // Fallback heuristic, unchanged: second-to-last label. Correct for
  // `a.b.example.com` -> `example`, wrong for `example.co.uk` -> `co`.
  const parts = host.split('.').filter(Boolean);
  return parts.length >= 2 ? (parts[parts.length - 2] ?? '') : (parts[0] ?? '');
}

/**
 * eTLD+1 for a hostname via `browser.publicSuffix`, or `''` where the API is
 * unavailable (Chrome entirely, Firefox before 153, or the permission ungranted).
 * Synchronous by design — the API is a local PSL lookup, so badge rendering stays
 * on its current code path.
 */
function getRegistrableDomain(host: string): string {
  try {
    const api = (globalThis as { browser?: { publicSuffix?: { getDomain?: (h: string) => string | null } } }).browser;
    const getDomain = api?.publicSuffix?.getDomain;
    if (typeof getDomain !== 'function') return '';
    return getDomain.call(api!.publicSuffix, host) || '';
  } catch {
    return '';
  }
}

/**
 * Format byte count as human-readable string.
 */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'] as const;
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
