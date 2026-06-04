import { expect, test } from '@playwright/test';
import { launchScriptVault, openExtensionPage, seedPendingInstall, sendRuntimeMessage, setInstallEnabled, userscript } from './helpers/extension-fixture.js';

test('install review saves a pending userscript', async () => {
  const app = await launchScriptVault();
  try {
    const setupPage = await openExtensionPage(app);
    const code = userscript({ name: 'E2E Install Flow', version: '1.0.0' });
    await seedPendingInstall(setupPage, {
      code,
      url: 'https://greasyfork.org/scripts/100-e2e-install.user.js',
    });

    const installPage = await openExtensionPage(app, 'pages/install.html');
    await expect(installPage.locator('#btn-install')).toHaveText(/Install Script/);
    await setInstallEnabled(installPage, false);
    await installPage.locator('#btn-install').click();

    await expect(installPage.locator('#installTerminalTitle')).toHaveText('Script Installed');
    const { scripts } = await sendRuntimeMessage(installPage, { action: 'getScripts' });
    const installed = scripts.find(script => script.metadata?.name === 'E2E Install Flow');
    expect(installed).toMatchObject({
      enabled: false,
      metadata: {
        version: '1.0.0',
        namespace: 'scriptvault-e2e',
      },
    });
    expect(installed.trustReceipt.operation).toBe('install');
  } finally {
    await app.close();
  }
});
