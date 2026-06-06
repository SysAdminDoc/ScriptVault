import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import {
  analyzeSettingsSchema,
  formatSettingsSchemaReport,
} from '../scripts/check-settings-schema.mjs';

const ROOT = process.cwd();
const SCRIPT = resolve(ROOT, 'scripts/check-settings-schema.mjs');

function makeFixture({ schemaKeys = ['theme', 'debugMode', 'customCss'] } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'scriptvault-settings-schema-'));
  mkdirSync(resolve(root, 'src/config'), { recursive: true });
  mkdirSync(resolve(root, 'src/types'), { recursive: true });
  mkdirSync(resolve(root, 'pages'), { recursive: true });

  writeFileSync(resolve(root, 'src/config/settings-defaults.json'), JSON.stringify({
    theme: 'dark',
    debugMode: false,
  }, null, 2));
  writeFileSync(resolve(root, 'src/config/settings-schema.json'), JSON.stringify({
    schemaVersion: 1,
    classifications: {
      visible: schemaKeys,
      credential: [],
      timestamp: [],
      internal: [],
      derived: [],
      deprecated: [],
    },
  }, null, 2));
  writeFileSync(resolve(root, 'src/types/settings.ts'), `
export interface Settings {
  theme: string;
  debugMode: boolean;
}
`);
  writeFileSync(resolve(root, 'pages/dashboard.js'), `
const settingMap = {
  settingsDebugMode: ['debugMode', 'checked'],
};
function wire() {
  saveSetting('customCss', '');
}
`);
  return root;
}

describe('settings schema gate', () => {
  it('passes for the repository settings schema', () => {
    const report = analyzeSettingsSchema({ rootDir: ROOT });

    expect(report.ok).toBe(true);
    expect(report.counts.defaults).toBe(71);
    expect(report.counts.dashboardSaveKeys).toBeGreaterThan(70);
    expect(report.counts.classified).toBeGreaterThanOrEqual(report.counts.dashboardSaveKeys);
    expect(formatSettingsSchemaReport(report)).toContain('[settings-schema] OK');
  });

  it('fails when a dashboard-saved key is not classified', () => {
    const root = makeFixture({ schemaKeys: ['theme', 'debugMode'] });
    const report = analyzeSettingsSchema({ rootDir: root });

    expect(report.ok).toBe(false);
    expect(report.errors).toContain(
      'Setting "customCss" is used by defaults/types/dashboard saves but is not classified in src/config/settings-schema.json'
    );
  });

  it('fails when the schema classifies a stale key', () => {
    const root = makeFixture({ schemaKeys: ['theme', 'debugMode', 'customCss', 'staleKey'] });
    const report = analyzeSettingsSchema({ rootDir: root });

    expect(report.ok).toBe(false);
    expect(report.errors).toContain(
      'Classified setting "staleKey" is not present in defaults, Settings type, or dashboard save handlers'
    );
  });

  it('returns a non-zero CLI exit code when schema coverage drifts', () => {
    const root = makeFixture({ schemaKeys: ['theme'] });
    const result = spawnSync('node', [SCRIPT], {
      cwd: root,
      encoding: 'utf8',
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('[settings-schema] Settings schema check failed:');
    expect(result.stdout).toContain('Setting "customCss" is used by defaults/types/dashboard saves');
    expect(result.stdout).toContain('Setting "debugMode" is used by defaults/types/dashboard saves');
  });
});
