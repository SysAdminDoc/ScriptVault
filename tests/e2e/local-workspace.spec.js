import { expect, test } from '@playwright/test';
import { createServer } from 'node:http';

import {
  ensureUserScriptsAvailable,
  failReleaseIfUnsupported,
  launchScriptVault,
  openExtensionPage,
  sendRuntimeMessage,
} from './helpers/extension-fixture.js';

const SCRIPT_ID = 'script_e2e_local_workspace';
const LOCAL_FILE_NAME = 'scriptvault-e2e-local-workspace.user.js';

async function startTargetServer() {
  const server = createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<!doctype html><title>ScriptVault local workspace smoke</title><main>ready</main>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    async close() {
      await new Promise(resolve => server.close(resolve));
    },
  };
}

function localWorkspaceUserscript(version, marker) {
  return [
    '// ==UserScript==',
    '// @name E2E Local Workspace Flow',
    '// @namespace scriptvault-e2e',
    `// @version ${version}`,
    '// @match http://127.0.0.1/*',
    '// @grant none',
    '// ==/UserScript==',
    `document.documentElement.setAttribute("data-sv-local-workspace-version", ${JSON.stringify(version)});`,
    `document.documentElement.setAttribute("data-sv-local-workspace-marker", ${JSON.stringify(marker)});`,
    '',
  ].join('\n');
}

async function markWhatsNewSeen(page) {
  await page.evaluate(() => chrome.storage.local.set({
    lastSeenVersion: chrome.runtime.getManifest().version,
  }));
}

async function dismissSetupWarning(page) {
  const button = page.locator('#btnDismissWarning');
  if (await button.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await button.click();
  }
}

async function openEditorForScript(page, scriptId) {
  const editButton = page.locator(`.action-icon[data-action="edit"][data-id="${scriptId}"]`);
  await editButton.waitFor({ state: 'attached', timeout: 20_000 });
  await editButton.click();
  await expect(page.locator('#editorOverlay.active')).toBeVisible({ timeout: 20_000 });
}

async function waitForEditorValue(page, expected) {
  await page.waitForFunction(
    value => window._monacoEditorAdapter?.getValue?.().includes(value),
    expected,
    { timeout: 20_000 },
  );
}

async function installOpfsPickerHandle(page, code) {
  return page.evaluate(async ({ fileName, source }) => {
    if (!navigator.storage?.getDirectory) {
      return { supported: false, reason: 'navigator.storage.getDirectory unavailable' };
    }
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle(fileName, { create: true });
    const writable = await handle.createWritable();
    await writable.write(source);
    await writable.close();
    window.__scriptVaultLocalWorkspaceHandle = handle;
    Object.defineProperty(window, 'showOpenFilePicker', {
      configurable: true,
      value: async () => [handle],
    });
    const permission = await handle.queryPermission({ mode: 'read' });
    return { supported: true, permission, name: handle.name };
  }, { fileName: LOCAL_FILE_NAME, source: code });
}

async function writeOpfsHandle(page, code) {
  await page.evaluate(async source => {
    const handle = window.__scriptVaultLocalWorkspaceHandle;
    if (!handle?.createWritable) throw new Error('Local workspace handle was not installed');
    const writable = await handle.createWritable();
    await writable.write(source);
    await writable.close();
  }, code);
}

async function expectTargetVersion(app, url, version, marker) {
  const target = await app.context.newPage();
  try {
    await target.goto(url, { waitUntil: 'domcontentloaded' });
    await expect(target.locator('html')).toHaveAttribute('data-sv-local-workspace-version', version, { timeout: 20_000 });
    await expect(target.locator('html')).toHaveAttribute('data-sv-local-workspace-marker', marker);
  } finally {
    await target.close().catch(() => {});
  }
}

test('dashboard local workspace refresh reviews and applies a changed file handle', async () => {
  test.setTimeout(90_000);
  const server = await startTargetServer();
  const app = await launchScriptVault();
  try {
    const dashboard = await openExtensionPage(app);
    await markWhatsNewSeen(dashboard);

    const executionCapability = await ensureUserScriptsAvailable(app, dashboard);
    test.skip(!executionCapability.available, executionCapability.reason);

    const v1 = localWorkspaceUserscript('4.0.1', 'before-apply');
    const v2 = localWorkspaceUserscript('4.0.2', 'after-apply');
    await expect(sendRuntimeMessage(dashboard, {
      action: 'saveScript',
      data: { id: SCRIPT_ID, code: v1, enabled: true },
    })).resolves.toMatchObject({ success: true, scriptId: SCRIPT_ID });
    await expectTargetVersion(app, `${server.url}/initial`, '4.0.1', 'before-apply');

    const handleProbe = await installOpfsPickerHandle(dashboard, v1);
    failReleaseIfUnsupported(handleProbe.supported, handleProbe.reason || 'Origin Private File System unavailable', handleProbe);
    test.skip(!handleProbe.supported, handleProbe.reason || 'Origin Private File System unavailable');
    expect(handleProbe).toMatchObject({ permission: 'granted', name: LOCAL_FILE_NAME });

    await dashboard.reload({ waitUntil: 'domcontentloaded' });
    await markWhatsNewSeen(dashboard);
    await installOpfsPickerHandle(dashboard, v1);
    await dismissSetupWarning(dashboard);
    await openEditorForScript(dashboard, SCRIPT_ID);
    await waitForEditorValue(dashboard, 'before-apply');

    await expect(dashboard.locator('#tbtnBindLocalFile')).toBeVisible({ timeout: 10_000 });
    await dashboard.locator('#tbtnBindLocalFile').click();
    await expect(dashboard.locator('#editorLocalWorkspaceStatus')).toContainText(`Local: ${LOCAL_FILE_NAME}`);
    await expect(dashboard.locator('#editorLocalWorkspaceStatus')).toContainText('bound');

    await writeOpfsHandle(dashboard, v2);
    await dashboard.locator('#tbtnRefreshLocalFile').click();
    await expect(dashboard.locator('#modalTitle')).toHaveText('Refresh from local file');
    await expect(dashboard.locator('#modalBody')).toContainText('after-apply');
    await expect(dashboard.locator('#modalBody .diff-add-count')).toContainText('+');
    await expect(dashboard.locator('#modalBody .diff-del-count')).toContainText('-');

    await expectTargetVersion(app, `${server.url}/before-apply`, '4.0.1', 'before-apply');
    await dashboard.locator('#modalActions').getByRole('button', { name: 'Apply local file' }).click();

    await expect.poll(async () => {
      const script = await sendRuntimeMessage(dashboard, { action: 'getScript', id: SCRIPT_ID });
      return script?.metadata?.version;
    }, { timeout: 20_000 }).toBe('4.0.2');

    const saved = await sendRuntimeMessage(dashboard, { action: 'getScript', id: SCRIPT_ID });
    expect(saved.code).toContain('after-apply');
    expect(saved.trustReceipt).toMatchObject({
      operation: 'local-save',
      source: {
        sourceKind: 'local-file',
        sourceLabel: LOCAL_FILE_NAME,
      },
    });
    expect(saved.versionHistory?.at(-1)?.code).toContain('before-apply');
    await expect(dashboard.locator('#editorLocalWorkspaceStatus')).toContainText('applied');

    await expectTargetVersion(app, `${server.url}/after-apply`, '4.0.2', 'after-apply');
  } finally {
    await app.close();
    await server.close();
  }
});
