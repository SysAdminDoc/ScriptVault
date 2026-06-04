import { expect, test } from '@playwright/test';
import { launchScriptVault, openExtensionPage, sendRuntimeMessage, userscript } from './helpers/extension-fixture.js';

test('backup restore can be rolled back from its restore receipt', async () => {
  const app = await launchScriptVault();
  try {
    const page = await openExtensionPage(app);
    const scriptId = 'script_e2e_restore';
    const v1 = userscript({ name: 'E2E Restore Flow', version: '1.0.0' });
    const v2 = userscript({ name: 'E2E Restore Flow', version: '2.0.0', body: 'console.log("mutated");' });

    await expect(sendRuntimeMessage(page, {
      action: 'saveScript',
      data: { id: scriptId, code: v1, enabled: false },
    })).resolves.toMatchObject({ success: true, scriptId });

    const backup = await sendRuntimeMessage(page, { action: 'createBackup', reason: 'playwright-e2e' });
    expect(backup).toMatchObject({ success: true });
    expect(backup.backupId).toBeTruthy();

    await expect(sendRuntimeMessage(page, {
      action: 'saveScript',
      data: { id: scriptId, code: v2, enabled: false },
    })).resolves.toMatchObject({ success: true, scriptId });
    await expect(sendRuntimeMessage(page, { action: 'getScript', id: scriptId }))
      .resolves.toMatchObject({ metadata: { version: '2.0.0' } });

    const restored = await sendRuntimeMessage(page, {
      action: 'restoreBackup',
      backupId: backup.backupId,
    });
    expect(restored).toMatchObject({ success: true });
    expect(restored.receiptId).toBeTruthy();
    await expect(sendRuntimeMessage(page, { action: 'getScript', id: scriptId }))
      .resolves.toMatchObject({ metadata: { version: '1.0.0' } });

    const rolledBack = await sendRuntimeMessage(page, {
      action: 'rollbackRestore',
      receiptId: restored.receiptId,
    });
    expect(rolledBack).toMatchObject({ success: true });
    await expect(sendRuntimeMessage(page, { action: 'getScript', id: scriptId }))
      .resolves.toMatchObject({ metadata: { version: '2.0.0' } });
  } finally {
    await app.close();
  }
});
