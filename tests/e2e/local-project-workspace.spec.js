import { expect, test } from '@playwright/test';

import {
  ensureUserScriptsAvailable,
  failReleaseIfUnsupported,
  launchScriptVault,
  openExtensionPage,
  sendRuntimeMessage,
} from './helpers/extension-fixture.js';

const SEED_SCRIPT_ID = 'script_e2e_local_project_seed';

function userscript(name, version, marker) {
  return [
    '// ==UserScript==',
    `// @name ${name}`,
    '// @namespace scriptvault-e2e-project',
    `// @version ${version}`,
    '// @match http://127.0.0.1/*',
    '// @grant none',
    '// ==/UserScript==',
    `document.documentElement.setAttribute("data-sv-project-marker", ${JSON.stringify(marker)});`,
    '',
  ].join('\n');
}

async function installProjectPicker(page, directoryName, files) {
  return page.evaluate(async ({ directoryName: name, files: entries }) => {
    if (!navigator.storage?.getDirectory) return { supported: false, reason: 'Origin Private File System unavailable' };
    const root = await navigator.storage.getDirectory();
    const directory = await root.getDirectoryHandle(name, { create: true });
    const writeFile = async (parent, fileName, source) => {
      const file = await parent.getFileHandle(fileName, { create: true });
      const writable = await file.createWritable();
      await writable.write(source);
      await writable.close();
    };
    for (const entry of entries) {
      const segments = entry.path.split('/');
      const fileName = segments.pop();
      let parent = directory;
      for (const segment of segments) parent = await parent.getDirectoryHandle(segment, { create: true });
      await writeFile(parent, fileName, entry.code);
    }
    window.__scriptVaultLocalProjectHandle = directory;
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: async () => directory,
    });
    return { supported: true, name: directory.name };
  }, { directoryName, files });
}

async function mutateProjectFiles(page, directoryName, files) {
  await page.evaluate(async ({ directoryName: name, changes }) => {
    const root = await navigator.storage.getDirectory();
    const directory = await root.getDirectoryHandle(name);
    for (const change of changes) {
      if (change.kind === 'delete') {
        const segments = change.path.split('/');
        const fileName = segments.pop();
        let parent = directory;
        for (const segment of segments) parent = await parent.getDirectoryHandle(segment);
        await parent.removeEntry(fileName);
        continue;
      }
      if (change.kind === 'rename') {
        const sourceSegments = change.from.split('/');
        const sourceName = sourceSegments.pop();
        let sourceParent = directory;
        for (const segment of sourceSegments) sourceParent = await sourceParent.getDirectoryHandle(segment);
        const source = await sourceParent.getFileHandle(sourceName);
        const sourceFile = await source.getFile();
        const targetSegments = change.to.split('/');
        const targetName = targetSegments.pop();
        let targetParent = directory;
        for (const segment of targetSegments) targetParent = await targetParent.getDirectoryHandle(segment, { create: true });
        const target = await targetParent.getFileHandle(targetName, { create: true });
        const writable = await target.createWritable();
        await writable.write(await sourceFile.text());
        await writable.close();
        await sourceParent.removeEntry(sourceName);
        continue;
      }
      const segments = change.path.split('/');
      const fileName = segments.pop();
      let parent = directory;
      for (const segment of segments) parent = await parent.getDirectoryHandle(segment);
      const file = await parent.getFileHandle(fileName);
      const writable = await file.createWritable();
      await writable.write(change.code);
      await writable.close();
    }
  }, { directoryName, changes: files });
}

async function openSeedEditor(page) {
  const button = page.locator(`.action-icon[data-action="edit"][data-id="${SEED_SCRIPT_ID}"]`);
  await button.waitFor({ state: 'attached', timeout: 20_000 });
  await button.click();
  await expect(page.locator('#editorOverlay.active')).toBeVisible({ timeout: 20_000 });
}

async function dismissSetupWarning(page) {
  const button = page.locator('#btnDismissWarning');
  if (await button.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await button.click();
  }
}

async function markWhatsNewSeen(page) {
  await page.evaluate(() => chrome.storage.local.set({
    lastSeenVersion: chrome.runtime.getManifest().version,
  }));
}

async function dismissWhatsNew(page) {
  const button = page.locator('#svWnDismiss');
  if (await button.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await button.click();
  }
  await page.waitForFunction(() => !document.querySelector('.sv-wn-overlay'), null, { timeout: 10_000 });
}

async function applyNextProjectChange(page) {
  await page.locator('#tbtnRefreshLocalProject').click();
  await expect(page.locator('#modalTitle')).toHaveText('Review local project changes', { timeout: 10_000 });
  await page.locator('[data-local-project-resolution="apply"]').first().click();
  await expect(page.locator('#modal')).toBeHidden({ timeout: 10_000 });
}

test('folder project maps files, survives dashboard restart, and queues external changes', async () => {
  test.setTimeout(120_000);
  const directoryName = `scriptvault-e2e-project-${Date.now().toString(36)}`;
  const v1 = userscript('Project One', '1.0.0', 'one-v1');
  const v2 = userscript('Project Two', '1.0.0', 'two-v1');
  const v3 = userscript('Project Three', '1.0.0', 'three-v1');
  const app = await launchScriptVault();
  try {
    const dashboard = await openExtensionPage(app);
    await markWhatsNewSeen(dashboard);
    await dismissWhatsNew(dashboard);
    await expect(sendRuntimeMessage(dashboard, {
      action: 'saveScript',
      scriptId: SEED_SCRIPT_ID,
      code: userscript('Project Seed', '1.0.0', 'seed'),
      enabled: false,
    })).resolves.toMatchObject({ success: true, scriptId: SEED_SCRIPT_ID });
    await dashboard.reload({ waitUntil: 'domcontentloaded' });

    const executionCapability = await ensureUserScriptsAvailable(app, dashboard);
    test.skip(!executionCapability.available, executionCapability.reason);
    await dismissSetupWarning(dashboard);
    await openSeedEditor(dashboard);
    const picker = await installProjectPicker(dashboard, directoryName, [
      { path: 'one.user.js', code: v1 },
      { path: 'two.user.js', code: v2 },
      { path: 'nested/three.user.js', code: v3 },
    ]);
    failReleaseIfUnsupported(picker.supported, picker.reason, picker);
    test.skip(!picker.supported, picker.reason);

    await dashboard.locator('#tbtnBindLocalProject').click();
    await expect(dashboard.locator('#modalTitle')).toHaveText('Review local project changes', { timeout: 20_000 });
    await expect(dashboard.locator('#modalBody')).toContainText('one.user.js');
    await expect(dashboard.locator('#modalBody')).toContainText('nested/three.user.js');
    await dashboard.locator('[data-local-project-resolution="apply"]').first().click();
    await expect(dashboard.locator('#modal')).toBeHidden({ timeout: 10_000 });
    await applyNextProjectChange(dashboard);
    await applyNextProjectChange(dashboard);
    await expect(dashboard.locator('#editorLocalProjectStatus')).toContainText('synced', { timeout: 20_000 });

    await dashboard.reload({ waitUntil: 'domcontentloaded' });
    await markWhatsNewSeen(dashboard);
    await installProjectPicker(dashboard, directoryName, []);
    await dismissWhatsNew(dashboard);
    await expect(dashboard.locator('#editorLocalProjectStatus')).toContainText('synced', { timeout: 20_000 });

    await mutateProjectFiles(dashboard, directoryName, [
      { kind: 'change', path: 'one.user.js', code: userscript('Project One', '2.0.0', 'one-v2') },
      { kind: 'rename', from: 'two.user.js', to: 'renamed-two.user.js' },
      { kind: 'delete', path: 'nested/three.user.js' },
    ]);
    await dashboard.locator('#tbtnRefreshLocalProject').click();
    await expect(dashboard.locator('#modalTitle')).toHaveText('Review local project changes', { timeout: 20_000 });
    await expect(dashboard.locator('#modalBody')).toContainText('one.user.js');
    await expect(dashboard.locator('#modalBody')).toContainText('renamed-two.user.js');
    await expect(dashboard.locator('#modalBody')).toContainText('three.user.js');
    await expect(dashboard.locator('#modalBody')).toContainText('Changed file');
    await expect(dashboard.locator('#modalBody')).toContainText('Renamed file');
    await expect(dashboard.locator('#modalBody')).toContainText('Deleted file');
  } finally {
    await app.close();
  }
});
