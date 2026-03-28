import { describe, it, expect } from 'vitest';

// Re-implement functions for testing (extracted from shared/utils.js)

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function generateId() {
  return 'script_' + crypto.randomUUID();
}

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

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ── escapeHtml ──────────────────────────────────────────────────────────────

describe('escapeHtml', () => {
  it('escapes ampersand', () => {
    expect(escapeHtml('foo & bar')).toBe('foo &amp; bar');
  });

  it('escapes less-than', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes greater-than', () => {
    expect(escapeHtml('a > b')).toBe('a &gt; b');
  });

  it('escapes double quotes', () => {
    expect(escapeHtml('say "hello"')).toBe('say &quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#39;s');
  });

  it('escapes all special characters together', () => {
    expect(escapeHtml('<a href="x" data-x=\'y\'>&')).toBe(
      '&lt;a href=&quot;x&quot; data-x=&#39;y&#39;&gt;&amp;'
    );
  });

  it('returns empty string for null', () => {
    expect(escapeHtml(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(escapeHtml(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('converts numbers to string', () => {
    expect(escapeHtml(42)).toBe('42');
  });

  it('handles string with no special chars', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });
});

// ── generateId ──────────────────────────────────────────────────────────────

describe('generateId', () => {
  it('starts with "script_"', () => {
    expect(generateId()).toMatch(/^script_/);
  });

  it('contains a UUID after the prefix', () => {
    const id = generateId();
    const uuid = id.replace('script_', '');
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});

// ── sanitizeUrl ─────────────────────────────────────────────────────────────

describe('sanitizeUrl', () => {
  it('returns null for null input', () => {
    expect(sanitizeUrl(null)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(sanitizeUrl('')).toBeNull();
  });

  it('allows https URLs', () => {
    expect(sanitizeUrl('https://example.com')).toBe('https://example.com');
  });

  it('allows http URLs', () => {
    expect(sanitizeUrl('http://example.com')).toBe('http://example.com');
  });

  it('allows ftp URLs', () => {
    expect(sanitizeUrl('ftp://files.example.com')).toBe('ftp://files.example.com');
  });

  it('allows mailto URLs', () => {
    expect(sanitizeUrl('mailto:user@example.com')).toBe('mailto:user@example.com');
  });

  it('blocks javascript: URLs', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBeNull();
  });

  it('blocks JavaScript: (case-insensitive)', () => {
    expect(sanitizeUrl('JAVASCRIPT:void(0)')).toBeNull();
  });

  it('blocks data: URLs', () => {
    expect(sanitizeUrl('data:text/html,<h1>Hi</h1>')).toBeNull();
  });

  it('blocks vbscript: URLs', () => {
    expect(sanitizeUrl('vbscript:MsgBox("hi")')).toBeNull();
  });

  it('blocks blob: URLs', () => {
    expect(sanitizeUrl('blob:https://example.com/uuid')).toBeNull();
  });

  it('allows root-relative paths', () => {
    expect(sanitizeUrl('/path/to/page')).toBe('/path/to/page');
  });

  it('allows hash fragments', () => {
    expect(sanitizeUrl('#section')).toBe('#section');
  });

  it('allows protocol-relative URLs', () => {
    expect(sanitizeUrl('//cdn.example.com/lib.js')).toBe('//cdn.example.com/lib.js');
  });

  it('blocks unknown protocol schemes', () => {
    expect(sanitizeUrl('custom-proto://foo')).toBeNull();
  });

  it('trims whitespace', () => {
    expect(sanitizeUrl('  https://example.com  ')).toBe('https://example.com');
  });

  it('allows relative paths (no protocol)', () => {
    expect(sanitizeUrl('images/logo.png')).toBe('images/logo.png');
  });
});

// ── formatBytes ─────────────────────────────────────────────────────────────

describe('formatBytes', () => {
  it('returns "0 B" for 0', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('returns "0 B" for negative values', () => {
    expect(formatBytes(-5)).toBe('0 B');
  });

  it('returns "0 B" for null/undefined', () => {
    expect(formatBytes(null)).toBe('0 B');
    expect(formatBytes(undefined)).toBe('0 B');
  });

  it('formats bytes', () => {
    expect(formatBytes(500)).toBe('500 B');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1 KB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(1048576)).toBe('1 MB');
  });

  it('formats gigabytes', () => {
    expect(formatBytes(1073741824)).toBe('1 GB');
  });

  it('formats fractional kilobytes', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  it('formats 1 byte', () => {
    expect(formatBytes(1)).toBe('1 B');
  });

  it('produces broken output for TB-scale values (no Math.min clamping)', () => {
    // The sizes array only has ['B', 'KB', 'MB', 'GB'] — index 4 is undefined
    // This documents the current bug: 1 TB gives "1 undefined"
    const oneTB = Math.pow(1024, 4);
    expect(formatBytes(oneTB)).toBe('1 undefined');
  });
});

// ── formatBytes with Math.min clamping ──────────────────────────────────────

describe('formatBytes (clamped)', () => {
  function formatBytesClamped(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  it('clamps TB-scale values to GB', () => {
    const oneTB = Math.pow(1024, 4);
    expect(formatBytesClamped(oneTB)).toBe('1024 GB');
  });

  it('clamps 5 TB to GB', () => {
    const fiveTB = 5 * Math.pow(1024, 4);
    expect(formatBytesClamped(fiveTB)).toBe('5120 GB');
  });

  it('does not affect values within range', () => {
    expect(formatBytesClamped(1024)).toBe('1 KB');
    expect(formatBytesClamped(1073741824)).toBe('1 GB');
  });

  it('still returns 0 B for zero/negative/null', () => {
    expect(formatBytesClamped(0)).toBe('0 B');
    expect(formatBytesClamped(-1)).toBe('0 B');
    expect(formatBytesClamped(null)).toBe('0 B');
  });
});
