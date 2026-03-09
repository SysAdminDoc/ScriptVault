// ScriptVault Shared Utilities
// Used by background.js (inlined at build time) and HTML pages (via <script src>)

/**
 * Escape HTML special characters to prevent XSS.
 * Works in both DOM (pages) and non-DOM (service worker) contexts.
 */
function escapeHtml(str) {
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
function generateId() {
  return 'script_' + crypto.randomUUID();
}

/**
 * Validate and sanitize a URL for safe use in href attributes.
 * Returns the URL if safe, or null if potentially dangerous.
 */
function sanitizeUrl(url) {
  if (!url) return null;
  const trimmed = url.trim();
  if (/^(javascript|data|vbscript|blob):/i.test(trimmed)) return null;
  if (/^(https?|ftp|mailto):/i.test(trimmed) || trimmed.startsWith('/') || trimmed.startsWith('#')) {
    return trimmed;
  }
  if (trimmed.startsWith('//')) return trimmed;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null;
  return trimmed;
}

/**
 * Format byte count as human-readable string.
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
