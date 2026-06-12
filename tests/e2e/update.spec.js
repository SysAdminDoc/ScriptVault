import { expect, test } from '@playwright/test';
import { launchScriptVault, openExtensionPage, seedPendingInstall, sendRuntimeMessage, setInstallEnabled, userscript } from './helpers/extension-fixture.js';

test('install review updates an existing script and keeps rollback history', async () => {
  const app = await launchScriptVault();
  try {
    const page = await openExtensionPage(app);
    const v1 = userscript({ name: 'E2E Update Flow', version: '1.0.0' });
    const seeded = await sendRuntimeMessage(page, {
      action: 'saveScript',
      data: {
        code: v1,
        enabled: false,
        trust: {
          recordReceipt: true,
          sourceUrl: 'https://example.com/e2e-update-v1.user.js',
          operation: 'install',
        },
      },
    });
    expect(seeded.success).toBe(true);

    const v2 = userscript({
      name: 'E2E Update Flow',
      version: '2.0.0',
      body: 'console.log("updated through Playwright");',
    });
    await seedPendingInstall(page, {
      code: v2,
      url: 'https://example.com/e2e-update-v2.user.js',
    });

    const installPage = await openExtensionPage(app, 'pages/install.html');
    await expect(installPage.locator('#btn-install')).toHaveText(/Update Script/);
    await setInstallEnabled(installPage, false);
    await installPage.locator('#btn-install').click();

    await expect(installPage.locator('#installTerminalTitle')).toHaveText('Script Updated');
    const saved = await sendRuntimeMessage(installPage, { action: 'getScript', id: seeded.scriptId });
    expect(saved.metadata.version).toBe('2.0.0');
    expect(saved.enabled).toBe(false);
    expect(saved.versionHistory?.at(-1)).toMatchObject({ version: '1.0.0', code: v1 });
    expect(saved.trustReceipt.operation).toBe('update');

    await expect(sendRuntimeMessage(installPage, {
      action: 'rollbackScript',
      scriptId: seeded.scriptId,
      index: saved.versionHistory.length - 1,
    })).resolves.toMatchObject({
      success: true,
      script: {
        metadata: { version: '1.0.0' },
        code: v1,
      },
    });
    await expect(sendRuntimeMessage(installPage, { action: 'getScript', id: seeded.scriptId }))
      .resolves.toMatchObject({ metadata: { version: '1.0.0' }, code: v1 });
  } finally {
    await app.close();
  }
});
