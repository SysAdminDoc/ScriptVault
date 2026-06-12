import { expect, test } from '@playwright/test';
import { createServer } from 'node:http';

import {
  enableUserScriptsToggle,
  launchScriptVault,
  openExtensionPage,
  sendRuntimeMessage,
} from './helpers/extension-fixture.js';

const SCRIPT_ID = 'script_e2e_sw_rehydrate';

async function startTargetServer() {
  const server = createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<!doctype html><title>ScriptVault service worker rehydrate smoke</title><main>ready</main>');
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

function rehydrationUserscript() {
  return [
    '// ==UserScript==',
    '// @name E2E Service Worker Rehydrate',
    '// @namespace scriptvault-e2e',
    '// @version 1.0.0',
    '// @match http://127.0.0.1/*',
    '// @grant none',
    '// ==/UserScript==',
    'document.documentElement.setAttribute("data-sv-sw-rehydrated", "true");',
    '',
  ].join('\n');
}

async function expectRehydrated(app, url) {
  const target = await app.context.newPage();
  try {
    await target.goto(url, { waitUntil: 'domcontentloaded' });
    await expect(target.locator('html')).toHaveAttribute('data-sv-sw-rehydrated', 'true', { timeout: 20_000 });
  } finally {
    await target.close().catch(() => {});
  }
}

async function reloadExtension(app, page) {
  const existingWorkers = new Set(app.context.serviceWorkers());
  const nextWorker = app.context.waitForEvent('serviceworker', {
    predicate: worker =>
      worker.url().startsWith(`chrome-extension://${app.extensionId}/`) &&
      !existingWorkers.has(worker),
    timeout: 20_000,
  }).catch(() => null);

  await page.evaluate(() => chrome.runtime.reload());
  await nextWorker;
}

test('enabled scripts are registered again after extension service worker restart', async () => {
  const server = await startTargetServer();
  const app = await launchScriptVault();
  try {
    const dashboard = await openExtensionPage(app);
    let status = await sendRuntimeMessage(dashboard, { action: 'getExtensionStatus' });
    let toggleResult = null;
    if (status?.setupState === 'allow-user-scripts-disabled' || status?.userScriptsAvailable === false) {
      toggleResult = await enableUserScriptsToggle(app);
      if (toggleResult?.enabledAfter) {
        status = await sendRuntimeMessage(dashboard, { action: 'repairRuntimeState' });
      }
    }
    test.skip(
      !status?.userScriptsAvailable,
      `chrome.userScripts unavailable in this profile: ${status?.setupState || status?.apiProbeError || toggleResult?.note || 'unknown setup state'}`,
    );

    await expect(sendRuntimeMessage(dashboard, {
      action: 'saveScript',
      data: { id: SCRIPT_ID, code: rehydrationUserscript(), enabled: true },
    })).resolves.toMatchObject({ success: true, scriptId: SCRIPT_ID });
    await expectRehydrated(app, `${server.url}/before-reload`);

    await reloadExtension(app, dashboard);
    await dashboard.close().catch(() => {});

    const afterReloadDashboard = await openExtensionPage(app);
    await expect(sendRuntimeMessage(afterReloadDashboard, { action: 'getScript', id: SCRIPT_ID }))
      .resolves.toMatchObject({ metadata: { name: 'E2E Service Worker Rehydrate' }, enabled: true });
    await expectRehydrated(app, `${server.url}/after-reload`);
  } finally {
    await app.close();
    await server.close();
  }
});
