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
 * Format byte count as human-readable string.
 */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'] as const;
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
