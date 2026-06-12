import { expect, test } from '@playwright/test';

import {
  launchScriptVault,
  openExtensionPage,
  sendRuntimeMessage,
  userscript,
} from './helpers/extension-fixture.js';

const SCRIPT_ID = 'script_e2e_import_quarantine';

test('JSON import quarantines enabled scripts until review enables them', async () => {
  const app = await launchScriptVault();
  try {
    const page = await openExtensionPage(app);
    const code = userscript({ name: 'E2E Import Quarantine', version: '1.0.0' });

    await expect(sendRuntimeMessage(page, {
      action: 'importAll',
      data: {
        data: {
          scripts: [
            {
              id: SCRIPT_ID,
              code,
              enabled: true,
              settings: { folder: 'Imported' },
            },
          ],
        },
        options: {
          overwrite: true,
          importSettings: true,
          sourceLabel: 'E2E JSON import',
          trustImportedScripts: false,
        },
      },
    })).resolves.toMatchObject({
      imported: 1,
      skipped: 0,
      quarantinedScripts: 1,
      trustedEnabledScripts: 0,
    });

    await expect(sendRuntimeMessage(page, { action: 'getScript', id: SCRIPT_ID }))
      .resolves.toMatchObject({
        enabled: false,
        metadata: { name: 'E2E Import Quarantine' },
        settings: {
          folder: 'Imported',
          _importQuarantine: {
            source: 'import-json',
            sourceLabel: 'E2E JSON import',
            archiveEnabled: true,
          },
        },
      });

    await expect(sendRuntimeMessage(page, {
      action: 'toggleScript',
      id: SCRIPT_ID,
      enabled: true,
    })).resolves.toMatchObject({
      success: true,
      script: {
        id: SCRIPT_ID,
        enabled: true,
      },
    });

    const reviewed = await sendRuntimeMessage(page, { action: 'getScript', id: SCRIPT_ID });
    expect(reviewed.enabled).toBe(true);
    expect(reviewed.settings?._importQuarantine).toBeUndefined();
  } finally {
    await app.close();
  }
});
