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

function makeFixture({
  schemaKeys = ['theme', 'debugMode', 'customCss'],
  metadata,
  dashboardHtml,
} = {}) {
  const root = mkdtempSync(join(tmpdir(), 'scriptvault-settings-schema-'));
  mkdirSync(resolve(root, 'src/config'), { recursive: true });
  mkdirSync(resolve(root, 'src/types'), { recursive: true });
  mkdirSync(resolve(root, 'pages'), { recursive: true });

  writeFileSync(resolve(root, 'src/config/settings-defaults.json'), JSON.stringify({
    theme: 'dark',
    debugMode: false,
  }, null, 2));
  const schema = {
    schemaVersion: 1,
    classifications: {
      visible: schemaKeys,
      credential: [],
      timestamp: [],
      internal: [],
      derived: [],
      deprecated: [],
    },
    metadata: metadata ?? {
      theme: {
        type: 'string',
        control: 'select',
        label: 'Theme',
        help: 'Controls the dashboard theme.',
        default: 'dark',
        options: [{ value: 'dark', label: 'Dark' }],
      },
      debugMode: {
        type: 'boolean',
        control: 'checkbox',
        label: 'Debug mode',
        help: 'Controls verbose diagnostics.',
        default: false,
      },
      customCss: {
        type: 'string',
        control: 'textarea',
        label: 'Custom CSS',
        help: 'Stores custom dashboard CSS.',
        defaultSource: 'runtime',
      },
    },
  };
  writeFileSync(resolve(root, 'src/config/settings-schema.json'), JSON.stringify(schema, null, 2));
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
  writeFileSync(resolve(root, 'pages/dashboard.html'), dashboardHtml ?? `
<select id="settingsTheme"><option value="dark">Dark</option></select>
<input id="settingsDebugMode" type="checkbox">
<textarea id="settingsCustomCss"></textarea>
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
    expect(report.counts.metadata).toBeGreaterThan(100);
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
    const root = makeFixture({
      schemaKeys: ['theme', 'debugMode', 'customCss', 'staleKey'],
      metadata: {
        theme: {
          type: 'string',
          control: 'select',
          label: 'Theme',
          help: 'Controls the dashboard theme.',
          default: 'dark',
          options: [{ value: 'dark', label: 'Dark' }],
        },
        debugMode: {
          type: 'boolean',
          control: 'checkbox',
          label: 'Debug mode',
          help: 'Controls verbose diagnostics.',
          default: false,
        },
        customCss: {
          type: 'string',
          control: 'textarea',
          label: 'Custom CSS',
          help: 'Stores custom dashboard CSS.',
          defaultSource: 'runtime',
        },
        staleKey: {
          type: 'string',
          control: 'text',
          label: 'Stale key',
          help: 'Should fail as stale.',
          defaultSource: 'runtime',
        },
      },
    });
    const report = analyzeSettingsSchema({ rootDir: root });

    expect(report.ok).toBe(false);
    expect(report.errors).toContain(
      'Classified setting "staleKey" is not present in defaults, Settings type, or dashboard save handlers'
    );
  });

  it('fails when a visible setting is missing metadata', () => {
    const root = makeFixture({
      metadata: {
        theme: {
          type: 'string',
          control: 'select',
          label: 'Theme',
          help: 'Controls the dashboard theme.',
          default: 'dark',
          options: [{ value: 'dark', label: 'Dark' }],
        },
        debugMode: {
          type: 'boolean',
          control: 'checkbox',
          label: 'Debug mode',
          help: 'Controls verbose diagnostics.',
          default: false,
        },
      },
    });
    const report = analyzeSettingsSchema({ rootDir: root });

    expect(report.ok).toBe(false);
    expect(report.errors).toContain('Setting "customCss" is missing schema metadata');
  });

  it('fails when metadata defaults drift from settings defaults', () => {
    const root = makeFixture({
      metadata: {
        theme: {
          type: 'string',
          control: 'select',
          label: 'Theme',
          help: 'Controls the dashboard theme.',
          default: 'light',
          options: [{ value: 'light', label: 'Light' }],
        },
        debugMode: {
          type: 'boolean',
          control: 'checkbox',
          label: 'Debug mode',
          help: 'Controls verbose diagnostics.',
          default: false,
        },
        customCss: {
          type: 'string',
          control: 'textarea',
          label: 'Custom CSS',
          help: 'Stores custom dashboard CSS.',
          defaultSource: 'runtime',
        },
      },
    });
    const report = analyzeSettingsSchema({ rootDir: root });

    expect(report.ok).toBe(false);
    expect(report.errors).toContain('Setting "theme" metadata default does not match src/config/settings-defaults.json');
  });

  it('requires validation descriptors for high-risk settings', () => {
    const root = makeFixture({
      schemaKeys: ['theme', 'debugMode', 'customCss', 'badgeColor'],
      metadata: {
        theme: {
          type: 'string',
          control: 'select',
          label: 'Theme',
          help: 'Controls the dashboard theme.',
          default: 'dark',
          options: [{ value: 'dark', label: 'Dark' }],
        },
        debugMode: {
          type: 'boolean',
          control: 'checkbox',
          label: 'Debug mode',
          help: 'Controls verbose diagnostics.',
          default: false,
        },
        customCss: {
          type: 'string',
          control: 'textarea',
          label: 'Custom CSS',
          help: 'Stores custom dashboard CSS.',
          defaultSource: 'runtime',
        },
        badgeColor: {
          type: 'string',
          control: 'text',
          label: 'Badge color',
          help: 'Controls the badge color.',
          defaultSource: 'runtime',
        },
      },
    });
    const report = analyzeSettingsSchema({ rootDir: root });

    expect(report.ok).toBe(false);
    expect(report.errors).toContain('Setting "badgeColor" metadata must declare hex-color validation');
  });

  it('fails when metadata points at a missing dashboard element', () => {
    const root = makeFixture({
      metadata: {
        theme: {
          type: 'string',
          control: 'select',
          label: 'Theme',
          help: 'Controls the dashboard theme.',
          elementId: 'settingsMissingTheme',
          default: 'dark',
          options: [{ value: 'dark', label: 'Dark' }],
        },
        debugMode: {
          type: 'boolean',
          control: 'checkbox',
          label: 'Debug mode',
          help: 'Controls verbose diagnostics.',
          default: false,
        },
        customCss: {
          type: 'string',
          control: 'textarea',
          label: 'Custom CSS',
          help: 'Stores custom dashboard CSS.',
          defaultSource: 'runtime',
        },
      },
    });
    const report = analyzeSettingsSchema({ rootDir: root });

    expect(report.ok).toBe(false);
    expect(report.errors).toContain(
      'Setting "theme" metadata elementId "settingsMissingTheme" was not found in pages/dashboard.html'
    );
  });

  it('fails when metadata control shape drifts from dashboard markup', () => {
    const root = makeFixture({
      metadata: {
        theme: {
          type: 'string',
          control: 'text',
          label: 'Theme',
          help: 'Controls the dashboard theme.',
          elementId: 'settingsTheme',
          default: 'dark',
        },
        debugMode: {
          type: 'boolean',
          control: 'checkbox',
          label: 'Debug mode',
          help: 'Controls verbose diagnostics.',
          default: false,
        },
        customCss: {
          type: 'string',
          control: 'textarea',
          label: 'Custom CSS',
          help: 'Stores custom dashboard CSS.',
          defaultSource: 'runtime',
        },
      },
    });
    const report = analyzeSettingsSchema({ rootDir: root });

    expect(report.ok).toBe(false);
    expect(report.errors).toContain('Setting "theme" metadata control "text" does not match dashboard control "select"');
  });

  it('fails when metadata select options drift from dashboard markup', () => {
    const root = makeFixture({
      metadata: {
        theme: {
          type: 'string',
          control: 'select',
          label: 'Theme',
          help: 'Controls the dashboard theme.',
          elementId: 'settingsTheme',
          default: 'dark',
          options: [{ value: 'light', label: 'Light' }],
        },
        debugMode: {
          type: 'boolean',
          control: 'checkbox',
          label: 'Debug mode',
          help: 'Controls verbose diagnostics.',
          default: false,
        },
        customCss: {
          type: 'string',
          control: 'textarea',
          label: 'Custom CSS',
          help: 'Stores custom dashboard CSS.',
          defaultSource: 'runtime',
        },
      },
    });
    const report = analyzeSettingsSchema({ rootDir: root });

    expect(report.ok).toBe(false);
    expect(report.errors).toContain('Setting "theme" metadata select options do not match pages/dashboard.html');
  });

  it('fails when validation metadata is not wired to a dashboard error node', () => {
    const root = makeFixture({
      schemaKeys: ['theme', 'debugMode', 'customCss', 'badgeColor'],
      metadata: {
        theme: {
          type: 'string',
          control: 'select',
          label: 'Theme',
          help: 'Controls the dashboard theme.',
          default: 'dark',
          options: [{ value: 'dark', label: 'Dark' }],
        },
        debugMode: {
          type: 'boolean',
          control: 'checkbox',
          label: 'Debug mode',
          help: 'Controls verbose diagnostics.',
          default: false,
        },
        customCss: {
          type: 'string',
          control: 'textarea',
          label: 'Custom CSS',
          help: 'Stores custom dashboard CSS.',
          defaultSource: 'runtime',
        },
        badgeColor: {
          type: 'string',
          control: 'text',
          label: 'Badge color',
          help: 'Controls the badge color.',
          elementId: 'settingsBadgeColor',
          defaultSource: 'runtime',
          validation: { kind: 'hex-color' },
        },
      },
      dashboardHtml: '<input id="settingsBadgeColor" type="text">',
    });
    const report = analyzeSettingsSchema({ rootDir: root });

    expect(report.ok).toBe(false);
    expect(report.errors).toContain('Setting "badgeColor" validation metadata requires a dashboard setting-error element');
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
