import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const coreTs = readFileSync(resolve(ROOT, 'src/background/core.ts'), 'utf8');
const backgroundCoreJs = readFileSync(resolve(ROOT, 'background.core.js'), 'utf8');
const dashboardJs = readFileSync(resolve(ROOT, 'pages/dashboard.js'), 'utf8');
const settingsDefaults = JSON.parse(readFileSync(resolve(ROOT, 'src/config/settings-defaults.json'), 'utf8'));
const settingsSchema = JSON.parse(readFileSync(resolve(ROOT, 'src/config/settings-schema.json'), 'utf8'));

function extractBetween(src, startMarker, endMarker, label) {
  const start = src.indexOf(startMarker);
  const end = src.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`Unable to extract ${label}`);
  return src.slice(start, end);
}

const dashboardRetain = new Function(
  `${extractBetween(dashboardJs, 'function retainStatsUrl(url, mode)', 'function buildStatsCSV', 'dashboard retainStatsUrl')}\nreturn retainStatsUrl;`,
)();
const coreRetain = new Function(
  `${extractBetween(backgroundCoreJs, 'function _retainStatsUrl(url, mode)', 'function _debouncedStatsSave', 'core _retainStatsUrl')}\nreturn _retainStatsUrl;`,
)();

describe('execution-stats URL retention helper', () => {
  for (const [label, retain] of [['dashboard', dashboardRetain], ['service worker', coreRetain]]) {
    describe(label, () => {
      it('keeps the full URL in full mode (default behavior)', () => {
        expect(retain('https://example.com/path?q=1#h', 'full')).toBe('https://example.com/path?q=1#h');
        expect(retain('https://example.com/path?q=1#h', undefined)).toBe('https://example.com/path?q=1#h');
      });

      it('reduces to origin in origin mode', () => {
        expect(retain('https://example.com/path?token=secret', 'origin')).toBe('https://example.com');
        expect(retain('http://sub.example.test:8080/a/b', 'origin')).toBe('http://sub.example.test:8080');
      });

      it('stores nothing in none mode', () => {
        expect(retain('https://example.com/sensitive', 'none')).toBe('');
      });

      it('returns empty string for missing or unparseable URLs', () => {
        expect(retain('', 'full')).toBe('');
        expect(retain(undefined, 'origin')).toBe('');
        expect(retain('not a url', 'origin')).toBe('');
      });
    });
  }
});

describe('execution-stats URL retention wiring', () => {
  it('defaults to full retention to preserve prior behavior', () => {
    expect(settingsDefaults.statsUrlRetention).toBe('full');
    expect(settingsSchema.metadata.statsUrlRetention.options.map((o) => o.value)).toEqual(['full', 'origin', 'none']);
  });

  it('enforces retention at the stats write site in source and generated runtime', () => {
    for (const [label, src] of [['core.ts', coreTs], ['background.core.js', backgroundCoreJs]]) {
      expect(src, `${label} reads the retention setting`).toContain('SettingsManager.cache.statsUrlRetention');
      expect(src, `${label} applies retention before storing lastUrl`).toContain('script.stats.lastUrl = _retainStatsUrl(data.url, _statsUrlMode);');
    }
  });

  it('scrubs existing stored URLs at display and CSV export per setting', () => {
    expect(dashboardJs).toContain('retainStatsUrl(st.lastUrl, state.settings && state.settings.statsUrlRetention)');
    expect(dashboardJs).toContain('retainStatsUrl(s.lastUrl, state.settings && state.settings.statsUrlRetention)');
  });
});
