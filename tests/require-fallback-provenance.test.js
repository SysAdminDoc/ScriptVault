import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const core = readFileSync(resolve(process.cwd(), 'background.core.js'), 'utf8');
const start = core.indexOf('const LIBRARY_FALLBACKS');
const end = core.indexOf('// Check if a URL is known to be unfetchable', start);
if (start < 0 || end < 0) throw new Error('Unable to extract @require fallback policy');
const { getFallbackUrls } = new Function(
  `${core.slice(start, end)}\nreturn { getFallbackUrls };`,
)();

describe('@require fallback provenance', () => {
  it('does not substitute core libraries for arbitrary plugin URLs', () => {
    expect(getFallbackUrls('https://mysite.example/jquery-plugin-custom.js')).toEqual([]);
    expect(getFallbackUrls('https://mysite.example/gm_config.js')).toEqual([]);
    expect(getFallbackUrls('https://mysite.example/mutation-summary-shim.js')).toEqual([]);
  });

  it('only uses known CDN paths and parses the declared jQuery major version', () => {
    expect(getFallbackUrls('https://code.jquery.com/jquery-2.2.4.min.js')[0])
      .toContain('jquery-2.2.4');
    expect(getFallbackUrls('https://code.jquery.com/jquery-3.7.1.min.js')[0])
      .toContain('jquery-3.7.1');
    expect(getFallbackUrls('https://code.jquery.com/jquery-1.12.4.min.js')).toEqual([]);
    expect(getFallbackUrls('https://cdn.jsdelivr.net/npm/gm_config@2024.12.1/gm_config.min.js')[0])
      .toContain('gm_config');
    expect(getFallbackUrls('https://unpkg.com/mutation-summary@1.0.1/dist/mutation-summary.min.js')[0])
      .toContain('mutation-summary');
  });
});
