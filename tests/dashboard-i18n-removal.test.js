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

  it('keeps locale claims scoped to active runtime surfaces', () => {
    expect(readme).toContain('Manifest, browser-facing extension messages, and core dashboard shell controls');
    expect(readme).toContain('Deep dashboard content is still being migrated to DOM translation coverage');
    expect(localeDocs).not.toContain('dashboard-i18n-v2.js');
    expect(dashboardHtml).toContain('<script src="../modules/i18n.js"></script>');
    expect(dashboardJs).toContain('function applyDashboardI18n()');
    expect(dashboardJs).toContain('i18n.applyToDOM(document)');
  });

  it('translates the scripts table, empty state, and update queue through the active runtime dictionary', () => {
    expect(dashboardHtml).toContain('data-sort-i18n="scriptOrder"');
    expect(dashboardHtml).toContain('data-sort-i18n="scriptPerformance"');
    expect(dashboardHtml).toContain('data-i18n-aria-label="selectAllShownScriptsTable"');
    expect(dashboardHtml).toContain('data-i18n="emptyVaultTitle"');
    expect(dashboardHtml).toContain('data-i18n="updatesQueue"');
    expect(dashboardHtml).toContain('data-i18n-aria-label="updateQueueActions"');
    expect(dashboardJs).toContain("tDashboard('emptyVaultTitle'");
    expect(dashboardJs).toContain("'queuedUpdatesSummary'");
    expect(dashboardJs).toContain("button.dataset.sortLabel = label");
  });

  it('translates the settings hero, filters, and dynamic summary copy through the runtime dictionary', () => {
    expect(dashboardHtml).toContain('data-i18n="settingsPreferences"');
    expect(dashboardHtml).toContain('data-i18n-placeholder="settingsSearchPlaceholder"');
    expect(dashboardHtml).toContain('data-i18n-aria-label="settingsCategoryFilters"');
    expect(dashboardHtml).toContain('data-i18n="settingsFilterSecurity"');
    expect(dashboardJs).toContain("'settingsSectionsCount'");
    expect(dashboardJs).toContain("'settingsAdvancedShownCount'");
    expect(dashboardJs).toContain("'settingsShowingFilterMode'");
    expect(dashboardJs).toContain('function getSettingsFilterLabel(filter)');
  });
});
