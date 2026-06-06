import { expect, test } from '@playwright/test';

import { launchScriptVault, openExtensionPage, sendRuntimeMessage, userscript } from './helpers/extension-fixture.js';

const SCRIPT_ID = 'script_e2e_monaco_adapter_dashboard';

async function markWhatsNewSeen(page) {
  await page.evaluate(() => chrome.storage.local.set({
    lastSeenVersion: chrome.runtime.getManifest().version,
  }));
}

async function dismissSetupWarning(page) {
  await page.locator('#btnDismissWarning').click({ timeout: 5_000 }).catch(() => {});
}

async function openEditorForScript(page, scriptId) {
  const overlay = page.locator('#editorOverlay.active');
  if (await overlay.isVisible().catch(() => false)) return;

  const editButton = page.locator(`.action-icon[data-action="edit"][data-id="${scriptId}"]`);
  await editButton.waitFor({ state: 'attached', timeout: 20_000 });
  await editButton.click();
}

async function waitForMonacoAdapter(page) {
  await expect(page.locator('#editorOverlay.active')).toBeVisible({ timeout: 20_000 });
  await expect(page.frameLocator('#monacoFrame').locator('.monaco-editor')).toBeVisible({ timeout: 20_000 });
  await page.waitForFunction(() => window._monacoEditorAdapter?.isMonaco === true, null, { timeout: 20_000 });
}

async function currentEditorValue(page) {
  return page.evaluate(() => window._monacoEditorAdapter?.getValue?.() || '');
}

test('dashboard saves and reloads script edits through the Monaco adapter', async () => {
  const app = await launchScriptVault();
  try {
    const page = await openExtensionPage(app);
    await markWhatsNewSeen(page);

    const initialCode = userscript({
      name: 'E2E Monaco Adapter Dashboard',
      body: 'console.log("initial adapter value");',
    });
    const saved = await sendRuntimeMessage(page, {
      action: 'saveScript',
      data: { id: SCRIPT_ID, code: initialCode, enabled: false },
    });
    expect(saved).toMatchObject({ success: true, scriptId: SCRIPT_ID });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await dismissSetupWarning(page);
    await openEditorForScript(page, SCRIPT_ID);
    await waitForMonacoAdapter(page);
    await expect.poll(() => currentEditorValue(page), { timeout: 10_000 }).toContain('initial adapter value');

    const updatedCode = initialCode.replace('initial adapter value', 'saved through Monaco adapter');
    await page.evaluate(code => window._monacoEditorAdapter.setValue(code), updatedCode);
    await expect.poll(() => currentEditorValue(page), { timeout: 10_000 }).toContain('saved through Monaco adapter');

    await dismissSetupWarning(page);
    await page.locator('#btnEditorSave').click();
    await expect.poll(async () => {
      const script = await sendRuntimeMessage(page, { action: 'getScript', id: SCRIPT_ID });
      return script?.code || '';
    }, { timeout: 20_000 }).toContain('saved through Monaco adapter');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await dismissSetupWarning(page);
    await openEditorForScript(page, SCRIPT_ID);
    await waitForMonacoAdapter(page);
    await expect.poll(() => currentEditorValue(page), { timeout: 10_000 }).toContain('saved through Monaco adapter');
  } finally {
    await app.close();
  }
});
