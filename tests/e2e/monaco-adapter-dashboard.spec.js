import { expect, test } from '@playwright/test';

import { launchScriptVault, openExtensionPage, sendRuntimeMessage, userscript } from './helpers/extension-fixture.js';

const SCRIPT_ID = 'script_e2e_monaco_adapter_dashboard';
const SWITCH_A_ID = 'script_e2e_editor_switch_a';
const SWITCH_B_ID = 'script_e2e_editor_switch_b';
const UNDO_A_ID = 'script_e2e_editor_undo_a';
const UNDO_B_ID = 'script_e2e_editor_undo_b';

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

function codeMirrorRangeForText(source, needle) {
  const start = source.indexOf(needle);
  expect(start).toBeGreaterThanOrEqual(0);
  const before = source.slice(0, start).split('\n');
  const selected = source.slice(0, start + needle.length).split('\n');
  return {
    from: { line: before.length - 1, ch: before[before.length - 1].length },
    to: { line: selected.length - 1, ch: selected[selected.length - 1].length },
  };
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

test('editor overlay exposes open script tabs for switching', async () => {
  const app = await launchScriptVault();
  try {
    const page = await openExtensionPage(app);
    await markWhatsNewSeen(page);

    const firstCode = userscript({
      name: 'E2E Switch First',
      body: 'console.log("first editor tab");',
    });
    const secondCode = userscript({
      name: 'E2E Switch Second',
      body: 'console.log("second editor tab");',
    });
    await expect(sendRuntimeMessage(page, {
      action: 'saveScript',
      data: { id: SWITCH_A_ID, code: firstCode, enabled: false },
    })).resolves.toMatchObject({ success: true, scriptId: SWITCH_A_ID });
    await expect(sendRuntimeMessage(page, {
      action: 'saveScript',
      data: { id: SWITCH_B_ID, code: secondCode, enabled: false },
    })).resolves.toMatchObject({ success: true, scriptId: SWITCH_B_ID });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await dismissSetupWarning(page);
    await openEditorForScript(page, SWITCH_A_ID);
    await waitForMonacoAdapter(page);
    await expect(page.locator('#editorTitle')).toHaveText('E2E Switch First');

    await page.evaluate((scriptId) => {
      document.querySelector(`.action-icon[data-action="edit"][data-id="${scriptId}"]`)?.click();
    }, SWITCH_B_ID);
    await expect(page.locator('#editorTitle')).toHaveText('E2E Switch Second');
    const mirroredTabs = page.locator('#editorScriptTabsGroup .editor-script-tab');
    await expect(mirroredTabs).toHaveCount(2);
    await expect(page.locator(`#editorScriptTabsGroup .editor-script-tab[data-script-id="${SWITCH_B_ID}"]`)).toHaveAttribute('aria-current', 'true');

    await page.locator(`#editorScriptTabsGroup .editor-script-tab[data-script-id="${SWITCH_A_ID}"]`).click();
    await expect(page.locator('#editorTitle')).toHaveText('E2E Switch First');
    await expect(page.locator(`#editorScriptTabsGroup .editor-script-tab[data-script-id="${SWITCH_A_ID}"]`)).toHaveAttribute('aria-current', 'true');
    await expect.poll(() => currentEditorValue(page), { timeout: 10_000 }).toContain('first editor tab');
  } finally {
    await app.close();
  }
});

test('Monaco editor preserves undo history when switching script tabs', async () => {
  const app = await launchScriptVault();
  try {
    const page = await openExtensionPage(app);
    await markWhatsNewSeen(page);

    const firstCode = userscript({
      name: 'E2E Undo First',
      body: 'console.log("first undo tab");',
    });
    const secondCode = userscript({
      name: 'E2E Undo Second',
      body: 'console.log("second undo tab");',
    });
    await expect(sendRuntimeMessage(page, {
      action: 'saveScript',
      data: { id: UNDO_A_ID, code: firstCode, enabled: false },
    })).resolves.toMatchObject({ success: true, scriptId: UNDO_A_ID });
    await expect(sendRuntimeMessage(page, {
      action: 'saveScript',
      data: { id: UNDO_B_ID, code: secondCode, enabled: false },
    })).resolves.toMatchObject({ success: true, scriptId: UNDO_B_ID });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await dismissSetupWarning(page);
    await openEditorForScript(page, UNDO_A_ID);
    await waitForMonacoAdapter(page);
    await expect.poll(() => currentEditorValue(page), { timeout: 10_000 }).toContain('first undo tab');

    const editRange = codeMirrorRangeForText(firstCode, 'first undo tab');
    await page.evaluate(({ range }) => {
      window._monacoEditorAdapter.replaceRange('first undo edited', range.from, range.to);
    }, { range: editRange });
    await expect.poll(() => currentEditorValue(page), { timeout: 10_000 }).toContain('first undo edited');

    await page.evaluate((scriptId) => {
      document.querySelector(`.action-icon[data-action="edit"][data-id="${scriptId}"]`)?.click();
    }, UNDO_B_ID);
    await expect(page.locator('#editorTitle')).toHaveText('E2E Undo Second');
    await expect.poll(() => currentEditorValue(page), { timeout: 10_000 }).toContain('second undo tab');

    await page.locator(`#editorScriptTabsGroup .editor-script-tab[data-script-id="${UNDO_A_ID}"]`).click();
    await expect(page.locator('#editorTitle')).toHaveText('E2E Undo First');
    await expect.poll(() => currentEditorValue(page), { timeout: 10_000 }).toContain('first undo edited');

    await page.evaluate(() => window._monacoEditorAdapter.undo());
    await expect.poll(() => currentEditorValue(page), { timeout: 10_000 }).toContain('first undo tab');
  } finally {
    await app.close();
  }
});
