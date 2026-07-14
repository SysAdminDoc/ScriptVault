import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const coreTs = readFileSync(resolve(ROOT, 'src/background/core.ts'), 'utf8');
const backgroundCoreJs = readFileSync(resolve(ROOT, 'background.core.js'), 'utf8');
const executionTelemetryTs = readFileSync(resolve(ROOT, 'src/background/execution-telemetry.ts'), 'utf8');
const executionTelemetryJs = readFileSync(resolve(ROOT, 'modules/execution-telemetry.js'), 'utf8');
const scriptDbTs = readFileSync(resolve(ROOT, 'src/storage/script-db.ts'), 'utf8');
const storageTs = readFileSync(resolve(ROOT, 'src/modules/storage.ts'), 'utf8');
const dashboardJs = readFileSync(resolve(ROOT, 'pages/dashboard.js'), 'utf8');
const settingsDefaults = JSON.parse(readFileSync(resolve(ROOT, 'src/config/settings-defaults.json'), 'utf8'));
const settingsSchema = JSON.parse(readFileSync(resolve(ROOT, 'src/config/settings-schema.json'), 'utf8'));
const privacyPolicy = readFileSync(resolve(ROOT, 'PRIVACY.md'), 'utf8');
const storeCopy = readFileSync(resolve(ROOT, 'docs/store-listing-copy.md'), 'utf8');

function extractBetween(src, startMarker, endMarker, label) {
  const start = src.indexOf(startMarker);
  const end = src.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`Unable to extract ${label}`);
  return src.slice(start, end);
}

const _body1 = `${extractBetween(dashboardJs, 'function retainStatsUrl(url, mode)', 'function buildStatsCSV', 'dashboard retainStatsUrl')}\nreturn retainStatsUrl;`;
let _fn1;
try { const vm = require('node:vm'); _fn1 = vm.compileFunction(_body1, [], { filename: resolve(ROOT, 'pages/dashboard.js') }); } catch { _fn1 = new Function(_body1); }
const dashboardRetain = _fn1();
const _body2 = `${extractBetween(backgroundCoreJs, 'function _retainStatsUrl(url, mode)', 'function _debouncedStatsSave', 'core _retainStatsUrl')}\nreturn _retainStatsUrl;`;
let _fn2;
try { const vm = require('node:vm'); _fn2 = vm.compileFunction(_body2, [], { filename: resolve(ROOT, 'background.core.js') }); } catch { _fn2 = new Function(_body2); }
const coreRetain = _fn2();

describe('execution-stats URL retention helper', () => {
  for (const [label, retain] of [['dashboard', dashboardRetain], ['service worker', coreRetain]]) {
    describe(label, () => {
      it('keeps the full URL only in explicit full mode', () => {
        expect(retain('https://example.com/path?q=1#h', 'full')).toBe('https://example.com/path?q=1#h');
        expect(retain('https://example.com/path?q=1#h', undefined)).toBe('https://example.com');
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
  it('defaults new installs to origin retention', () => {
    expect(settingsDefaults.statsUrlRetention).toBe('origin');
    expect(settingsSchema.metadata.statsUrlRetention.default).toBe('origin');
    expect(settingsSchema.metadata.statsUrlRetention.options.map((o) => o.value)).toEqual(['full', 'origin', 'none']);
  });

  it('enforces retention at the stats write site in source and generated runtime', () => {
    for (const [label, src] of [['core.ts', coreTs], ['background.core.js', backgroundCoreJs]]) {
      expect(src, `${label} reads the retention setting`).toContain('SettingsManager.cache.statsUrlRetention');
    }
    for (const [label, src] of [['execution-telemetry.ts', executionTelemetryTs], ['execution-telemetry.js', executionTelemetryJs]]) {
      expect(src, `${label} applies retention before storing lastUrl`).toContain('dependencies.retainStatsUrl(eventUrl, dependencies.getStatsUrlRetention())');
      expect(src, `${label} deletes lastUrl in none mode`).toMatch(/else delete stats\.lastUrl/);
    }
  });

  it('atomically scrubs IndexedDB and keeps display/export enforcement as defense in depth', () => {
    expect(scriptDbTs).toContain("withTransaction(Stores.scripts, 'readwrite'");
    expect(scriptDbTs).toContain('async rewriteStatsUrls(mode: StatsUrlRetentionMode)');
    expect(storageTs).toContain("const STATS_URL_RETENTION_PENDING_KEY = '_statsUrlRetentionRewritePending'");
    expect(storageTs).toContain('await finishStatsUrlRewrite(retentionMode)');
    expect(dashboardJs).toContain('retainStatsUrl(st.lastUrl, state.settings && state.settings.statsUrlRetention)');
    expect(dashboardJs).toContain('retainStatsUrl(s.lastUrl, state.settings && state.settings.statsUrlRetention)');
  });

  it('discloses every local and configured data destination', () => {
    for (const disclosure of [
      'Storage Bucket',
      'chrome.storage.session',
      'WebDAV',
      'Google Drive / Easy Cloud',
      'S3-compatible',
      'Greasy Fork API',
      'OpenUserJS API',
      'GitHub Gist',
      'Installed-Script Network Egress',
      'GM_xmlhttpRequest',
    ]) {
      expect(privacyPolicy, `privacy policy includes ${disclosure}`).toContain(disclosure);
    }
    expect(storeCopy).toContain('Storage Buckets');
    expect(storeCopy).toContain('persistent or session-only');
    expect(storeCopy).toContain('user-installed script network APIs');
  });
});
