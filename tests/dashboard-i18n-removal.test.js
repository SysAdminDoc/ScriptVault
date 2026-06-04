import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dashboardHtml = readFileSync(resolve(process.cwd(), 'pages/dashboard.html'), 'utf8');
const dashboardJs = readFileSync(resolve(process.cwd(), 'pages/dashboard.js'), 'utf8');
const lazyLoader = readFileSync(resolve(process.cwd(), 'pages/dashboard-lazy-loader.js'), 'utf8');
const localeDocs = readFileSync(resolve(process.cwd(), 'docs/locale-coverage.md'), 'utf8');
const readme = readFileSync(resolve(process.cwd(), 'README.md'), 'utf8');

describe('dashboard i18n-v2 removal', () => {
  it('does not ship or eager-load the dead dashboard dictionary', () => {
    expect(existsSync(resolve(process.cwd(), 'pages/dashboard-i18n-v2.js'))).toBe(false);
    expect(dashboardHtml).not.toContain('dashboard-i18n-v2.js');
    expect(lazyLoader).not.toContain('dashboard-i18n-v2.js');
    expect(dashboardJs).not.toContain('I18nV2');
    expect(dashboardJs).not.toContain('syncDashboardModuleLanguage');
  });

  it('removes the dashboard language selector that had no translation target', () => {
    expect(dashboardHtml).not.toContain('id="settingsLanguage"');
    expect(dashboardJs).not.toContain('settingsLanguage');
  });

  it('keeps locale claims scoped to manifest and runtime messages', () => {
    expect(readme).toContain('Manifest and browser-facing extension messages are localized');
    expect(readme).toContain('dashboard interface is currently English-only');
    expect(localeDocs).not.toContain('dashboard-i18n-v2.js');
    expect(localeDocs).toContain('two active surfaces');
  });
});
