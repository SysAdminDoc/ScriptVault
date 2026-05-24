import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const code = readFileSync(resolve(process.cwd(), 'shared/utils.js'), 'utf8');

function createUtils() {
  const fn = new Function('crypto', `${code}\nreturn { escapeHtml, generateId, sanitizeUrl, classifyInstallSource, formatBytes };`);
  return fn({ randomUUID: () => 'uuid-123' });
}

describe('generated shared utilities runtime', () => {
  it('exposes the expected service-worker/page globals', () => {
    const utils = createUtils();

    expect(utils.escapeHtml('<tag "x">')).toBe('&lt;tag &quot;x&quot;&gt;');
    expect(utils.generateId()).toBe('script_uuid-123');
    expect(utils.formatBytes(1024 ** 4)).toBe('1 TB');
  });

  it('sanitizes dangerous URL schemes after control-character stripping', () => {
    const { sanitizeUrl } = createUtils();

    expect(sanitizeUrl('\u0000javascript:alert(1)')).toBeNull();
    expect(sanitizeUrl('java\nscript:alert(1)')).toBeNull();
    expect(sanitizeUrl('https://example.com/app')).toBe('https://example.com/app');
  });

  it('classifies known install sources and unknown hosts', () => {
    const { classifyInstallSource } = createUtils();

    expect(classifyInstallSource('https://greasyfork.org/en/scripts/123/foo.user.js')).toMatchObject({ id: 'greasyfork', tone: 'good' });
    expect(classifyInstallSource('https://sleazyfork.org/en/scripts/123/foo.user.js')).toMatchObject({ id: 'sleazyfork', tone: 'warn' });
    expect(classifyInstallSource('not-a-url')).toMatchObject({ id: 'other', tone: 'warn' });
  });
});
