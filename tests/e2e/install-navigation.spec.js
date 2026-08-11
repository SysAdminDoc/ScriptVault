import { expect, test } from '@playwright/test';
import { createServer } from 'node:http';

import {
  ensureUserScriptsAvailable,
  launchScriptVault,
  openExtensionPage,
  sendRuntimeMessage,
  setInstallEnabled,
} from './helpers/extension-fixture.js';

const LOCAL_HOST = 'install.scriptvault.test';

function userscript({ name, version, body = 'console.log("install navigation");' }) {
  return [
    '// ==UserScript==',
    `// @name ${name}`,
    '// @namespace scriptvault-install-navigation',
    `// @version ${version}`,
    `// @match http://${LOCAL_HOST}/*`,
    '// @grant none',
    '// ==/UserScript==',
    body,
    '',
  ].join('\n');
}

async function startInstallServer() {
  const validCode = userscript({ name: 'Navigation Install', version: '1.0.0' });
  const downgradeCode = userscript({ name: 'Navigation Downgrade', version: '1.0.0' });
  const malformedCode = '// This is a JavaScript file, but not a userscript.\n';
  const oversizedCode = 'x'.repeat(5 * 1024 * 1024 + 1);
  const server = createServer((request, response) => {
    const path = new URL(request.url || '/', `http://${LOCAL_HOST}`).pathname;
    if (path === '/valid.user.js') {
      response.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
      response.end(validCode);
      return;
    }
    if (path === '/downgrade.user.js') {
      response.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
      response.end(downgradeCode);
      return;
    }
    if (path === '/malformed.user.js') {
      response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end(malformedCode);
      return;
    }
    if (path === '/oversized.user.js') {
      response.writeHead(200, {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Content-Length': Buffer.byteLength(oversizedCode),
      });
      response.end(oversizedCode);
      return;
    }
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('not found');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://${LOCAL_HOST}:${port}`;
  return {
    baseUrl,
    async close() {
      await new Promise(resolve => server.close(resolve));
    },
  };
}

async function navigateToUserscript(page, url) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
  } catch (error) {
    const message = String(error?.message || error);
    if (!message.includes('Download is starting') && !message.includes('ERR_ABORTED')) throw error;
  }
}

test('real .user.js navigation covers review, malformed, oversized, and downgrade paths', async () => {
  test.setTimeout(150_000);
  const server = await startInstallServer();
  const app = await launchScriptVault({
    browserArgs: [`--host-resolver-rules=MAP ${LOCAL_HOST} 127.0.0.1`],
  });
  try {
    const dashboard = await openExtensionPage(app);
    const capability = await ensureUserScriptsAvailable(app, dashboard);
    test.skip(!capability.available, capability.reason);

    const validPage = await app.context.newPage();
    try {
      await navigateToUserscript(validPage, `${server.baseUrl}/valid.user.js`);
      await expect(validPage.locator('#btn-install')).toHaveText(/Install Script/);
      await expect(validPage.locator('.script-name')).toHaveText('Navigation Install');
      await setInstallEnabled(validPage, false);
      await validPage.locator('#btn-install').click();
      await expect(validPage.locator('#installTerminalTitle')).toHaveText('Script Installed');
    } finally {
      await validPage.close().catch(() => {});
    }

    const malformedPage = await app.context.newPage();
    try {
      const malformedUrl = `${server.baseUrl}/malformed.user.js`;
      await navigateToUserscript(malformedPage, malformedUrl);
      await expect(malformedPage).not.toHaveURL(/pages\/install\.html/);
      const malformedStorage = await dashboard.evaluate(async () => chrome.storage.local.get());
      expect(Object.keys(malformedStorage).filter(key => /^pendingInstall_/.test(key))).toHaveLength(0);
      const scriptsAfterMalformed = await sendRuntimeMessage(dashboard, { action: 'getScripts' });
      expect(scriptsAfterMalformed.scripts.some(script => script.metadata?.name === 'Navigation Install' && script.metadata?.version === '1.0.0')).toBe(true);
      expect(scriptsAfterMalformed.scripts.some(script => script.metadata?.name === 'This is a JavaScript file, but not a userscript.')).toBe(false);
    } finally {
      await malformedPage.close().catch(() => {});
    }

    const oversizedPage = await app.context.newPage();
    try {
      await navigateToUserscript(oversizedPage, `${server.baseUrl}/oversized.user.js`);
      await expect(oversizedPage.locator('#installTerminalTitle')).toHaveText('Failed to download script');
      await expect(oversizedPage.locator('#installTerminalMessage')).toContainText(/maximum|exceed/i);
    } finally {
      await oversizedPage.close().catch(() => {});
    }

    const seeded = await sendRuntimeMessage(dashboard, {
      action: 'saveScript',
      data: {
        code: userscript({ name: 'Navigation Downgrade', version: '2.0.0', body: 'console.log("newer");' }),
        enabled: false,
        trust: {
          recordReceipt: true,
          sourceUrl: `${server.baseUrl}/downgrade.user.js`,
          operation: 'install',
        },
      },
    });
    expect(seeded.success).toBe(true);

    const downgradePage = await app.context.newPage();
    try {
      await navigateToUserscript(downgradePage, `${server.baseUrl}/downgrade.user.js`);
      await expect(downgradePage.locator('#btn-install')).toHaveText(/Downgrade Script/);
      await expect(downgradePage.locator('body')).toContainText('Downgrade');
      await setInstallEnabled(downgradePage, false);
      await downgradePage.locator('#btn-install').click();
      await expect(downgradePage.locator('#installTerminalTitle')).toHaveText('Script Downgraded');
    } finally {
      await downgradePage.close().catch(() => {});
    }
  } finally {
    await app.close();
    await server.close();
  }
});
