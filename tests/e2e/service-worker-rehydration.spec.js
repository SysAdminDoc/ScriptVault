import { expect, test } from '@playwright/test';
import { createServer } from 'node:http';

import {
  ensureUserScriptsAvailable,
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

async function stopExtensionServiceWorker(app) {
  const browser = app.context.browser();
  if (!browser) throw new Error('Chromium browser handle unavailable for service-worker restart smoke');
  const cdp = await browser.newBrowserCDPSession();
  try {
    const { targetInfos } = await cdp.send('Target.getTargets');
    const worker = targetInfos.find(target =>
      target.type === 'service_worker' &&
      target.url.startsWith(`chrome-extension://${app.extensionId}/`));
    if (!worker) throw new Error('ScriptVault service-worker target was not running before restart');
    const result = await cdp.send('Target.closeTarget', { targetId: worker.targetId });
    if (!result.success) throw new Error('Chromium refused to stop the ScriptVault service worker');
    return worker.targetId;
  } finally {
    await cdp.detach().catch(() => {});
  }
}

test('enabled scripts are registered again after extension service worker restart', async () => {
  const server = await startTargetServer();
  const app = await launchScriptVault();
  try {
    const dashboard = await openExtensionPage(app);
    const executionCapability = await ensureUserScriptsAvailable(app, dashboard);
    test.skip(!executionCapability.available, executionCapability.reason);

    await expect(sendRuntimeMessage(dashboard, {
      action: 'saveScript',
      data: { id: SCRIPT_ID, code: rehydrationUserscript(), enabled: true },
    })).resolves.toMatchObject({ success: true, scriptId: SCRIPT_ID });
    await expectRehydrated(app, `${server.url}/before-reload`);

    const previousWorkerTargetId = await stopExtensionServiceWorker(app);
    await dashboard.close().catch(() => {});

    const afterReloadDashboard = await openExtensionPage(app);
    await expect(sendRuntimeMessage(afterReloadDashboard, { action: 'getScript', id: SCRIPT_ID }))
      .resolves.toMatchObject({ metadata: { name: 'E2E Service Worker Rehydrate' }, enabled: true });
    const currentWorker = app.context.serviceWorkers().find(worker =>
      worker.url().startsWith(`chrome-extension://${app.extensionId}/`));
    expect(currentWorker, `service worker ${previousWorkerTargetId} was not restarted`).toBeTruthy();
    await expectRehydrated(app, `${server.url}/after-reload`);
  } finally {
    await app.close();
    await server.close();
  }
});
