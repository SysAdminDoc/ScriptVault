import { expect, test } from '@playwright/test';
import { createServer } from 'node:http';

import {
  ensureUserScriptsAvailable,
  launchScriptVault,
  openExtensionPage,
  sendRuntimeMessage,
} from './helpers/extension-fixture.js';

const SCRIPT_ID = 'script_e2e_document_start_order';

async function startTargetServer() {
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end(`<!doctype html>
<html>
  <head>
    <script>
      const sawDocumentStart = document.documentElement.getAttribute('data-sv-document-start') === 'true';
      document.documentElement.setAttribute('data-sv-inline-observed', sawDocumentStart ? 'user-script-first' : 'page-first');
    </script>
  </head>
  <body><main>document-start ordering fixture</main></body>
</html>`);
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

function documentStartUserscript() {
  return [
    '// ==UserScript==',
    '// @name E2E Document Start Ordering',
    '// @namespace scriptvault-e2e',
    '// @version 1.0.0',
    '// @match http://127.0.0.1/*',
    '// @run-at document-start',
    '// @grant none',
    '// ==/UserScript==',
    'document.documentElement.setAttribute("data-sv-document-start", "true");',
    '',
  ].join('\n');
}

async function stopExtensionServiceWorker(app) {
  const browser = app.context.browser();
  if (!browser) throw new Error('Chromium browser handle unavailable for document-start restart proof');
  const cdp = await browser.newBrowserCDPSession();
  try {
    const { targetInfos } = await cdp.send('Target.getTargets');
    const worker = targetInfos.find(target =>
      target.type === 'service_worker' &&
      target.url.startsWith(`chrome-extension://${app.extensionId}/`));
    if (!worker) throw new Error('ScriptVault service-worker target was not running before restart');
    const result = await cdp.send('Target.closeTarget', { targetId: worker.targetId });
    if (!result.success) throw new Error('Chromium refused to stop the ScriptVault service worker');
  } finally {
    await cdp.detach().catch(() => {});
  }
}

async function expectDocumentStartBeforeInlineScript(app, url) {
  const target = await app.context.newPage();
  try {
    await target.goto(url, { waitUntil: 'domcontentloaded' });
    await expect(target.locator('html')).toHaveAttribute('data-sv-inline-observed', 'user-script-first', { timeout: 20_000 });
  } finally {
    await target.close().catch(() => {});
  }
}

test('document-start userscripts run before page inline scripts across worker restart', async () => {
  test.setTimeout(120_000);
  const server = await startTargetServer();
  const app = await launchScriptVault();
  try {
    const dashboard = await openExtensionPage(app);
    const executionCapability = await ensureUserScriptsAvailable(app, dashboard);
    test.skip(!executionCapability.available, executionCapability.reason);

    await expect(sendRuntimeMessage(dashboard, {
      action: 'saveScript',
      data: { id: SCRIPT_ID, code: documentStartUserscript(), enabled: true },
    })).resolves.toMatchObject({ success: true, scriptId: SCRIPT_ID });

    await expectDocumentStartBeforeInlineScript(app, `${server.url}/warm`);

    await stopExtensionServiceWorker(app);
    await dashboard.close().catch(() => {});
    const restartedDashboard = await openExtensionPage(app);
    await expect(sendRuntimeMessage(restartedDashboard, { action: 'getScript', id: SCRIPT_ID }))
      .resolves.toMatchObject({ enabled: true });
    await expectDocumentStartBeforeInlineScript(app, `${server.url}/cold`);
    await restartedDashboard.close().catch(() => {});
  } finally {
    await app.close();
    await server.close();
  }
});
