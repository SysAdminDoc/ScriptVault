import { expect, test } from '@playwright/test';

import { launchScriptVault, openExtensionPage } from './helpers/extension-fixture.js';

test('real dashboard controllers render success, empty, loading, recovery, and failure states', async () => {
  test.setTimeout(120_000);
  const app = await launchScriptVault();
  try {
    const page = await openExtensionPage(app);
    await page.evaluate(() => chrome.storage.local.set({
      lastSeenVersion: chrome.runtime.getManifest().version,
    }));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(
      window.DashboardWorkflowControllers
      && window.ScriptVaultDashboardUI?.controllers?.importReview
      && window.ScriptVaultDashboardUI?.controllers?.settings
      && window.ScriptVaultDashboardUI?.controllers?.diagnostics
    ));

    const result = await page.evaluate(async () => {
      const factories = window.DashboardWorkflowControllers;
      const transitions = { import: [], settings: [], diagnostics: [] };

      let importAttempt = 0;
      const importController = factories.createImportReviewController({
        prepare: async input => input === 'empty' ? null : { input, count: 1 },
        confirm: async () => true,
        apply: async review => {
          importAttempt += 1;
          if (review.input === 'retry' && importAttempt === 2) throw new Error('temporary import failure');
          return { imported: review.count };
        },
        render: state => transitions.import.push(state.kind),
      });
      const importSuccess = await importController.start('success');
      const importEmpty = await importController.start('empty');
      const importFailure = await importController.start('retry');
      const importRecovery = await importController.retry();

      const settingValues = { theme: 'dark' };
      let failSetting = false;
      const settingsController = factories.createSerializedSettingsController({
        validate: (_key, value) => ({ ok: true, value }),
        read: key => settingValues[key],
        write: (key, value) => { settingValues[key] = value; },
        persist: async () => { if (failSetting) throw new Error('storage unavailable'); },
        render: state => transitions.settings.push(state.kind),
      });
      const settingsSuccess = await settingsController.save('theme', 'light');
      failSetting = true;
      const settingsFailure = await settingsController.save('theme', 'oled');

      let diagnosticMode = 'success';
      const diagnosticsController = factories.createDiagnosticsController({
        loaders: {
          runtime: () => diagnosticMode === 'failure' ? Promise.reject(new Error('runtime offline')) : { ready: true },
          trust: () => diagnosticMode === 'success' ? { keys: 1 } : Promise.reject(new Error('trust offline')),
        },
        render: state => transitions.diagnostics.push(state.kind),
      });
      const diagnosticsSuccess = await diagnosticsController.refresh();
      diagnosticMode = 'failure';
      const diagnosticsFailure = await diagnosticsController.refresh();
      diagnosticMode = 'recovery';
      const diagnosticsRecovery = await diagnosticsController.retry();

      const realImportEmpty = await window.ScriptVaultDashboardUI.controllers.importReview.start(
        new File(['not a userscript'], 'empty.txt', { type: 'text/plain' })
      );
      const realDiagnostics = await window.ScriptVaultDashboardUI.controllers.diagnostics.refresh();

      return {
        transitions,
        states: {
          importSuccess: importSuccess.kind,
          importEmpty: importEmpty.kind,
          importFailure: importFailure.kind,
          importRecovery: importRecovery.kind,
          settingsSuccess,
          settingsFailure,
          settingsValue: settingValues.theme,
          diagnosticsSuccess: diagnosticsSuccess.kind,
          diagnosticsFailure: diagnosticsFailure.kind,
          diagnosticsRecovery: diagnosticsRecovery.kind,
          realImportEmpty: realImportEmpty.kind,
          realDiagnostics: realDiagnostics.kind,
          realDiagnosticsRetryAvailable: realDiagnostics.retryAvailable,
        },
        dom: {
          importState: document.getElementById('importWorkflowStatus')?.dataset.state,
          importRetryHidden: document.getElementById('btnRetryImport')?.hidden,
          diagnosticsState: document.getElementById('diagnosticsWorkflowStatus')?.dataset.state,
          diagnosticsRetryHidden: document.getElementById('btnRetryDiagnostics')?.hidden,
        },
      };
    });

    expect(result.states).toMatchObject({
      importSuccess: 'success',
      importEmpty: 'empty',
      importFailure: 'failure',
      importRecovery: 'success',
      settingsSuccess: true,
      settingsFailure: false,
      settingsValue: 'light',
      diagnosticsSuccess: 'success',
      diagnosticsFailure: 'failure',
      diagnosticsRecovery: 'recovery',
      realImportEmpty: 'empty',
    });
    expect(['success', 'recovery', 'empty']).toContain(result.states.realDiagnostics);
    expect(result.transitions.import).toEqual(expect.arrayContaining(['loading', 'review', 'success', 'empty', 'failure', 'recovery']));
    expect(result.transitions.settings).toEqual(expect.arrayContaining(['saving', 'saved', 'error']));
    expect(result.transitions.diagnostics).toEqual(expect.arrayContaining(['loading', 'success', 'failure', 'recovery']));
    expect(result.dom.importState).toBe('empty');
    expect(result.dom.importRetryHidden).toBe(true);
    expect(result.dom.diagnosticsState).toBe(result.states.realDiagnostics);
    expect(result.dom.diagnosticsRetryHidden).toBe(!result.states.realDiagnosticsRetryAvailable);
  } finally {
    await app.close();
  }
});
