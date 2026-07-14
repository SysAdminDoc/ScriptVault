import { expect, test } from '@playwright/test';
import { createServer } from 'node:http';

import {
  ensureUserScriptsAvailable,
  launchScriptVault,
  openExtensionPage,
  sendRuntimeMessage,
} from './helpers/extension-fixture.js';

async function startTargetServer() {
  const server = createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<!doctype html><title>ScriptVault value remote smoke</title><main>ready</main>');
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

function valueChangeUserscript() {
  return [
    '// ==UserScript==',
    '// @name E2E Value Remote Flow',
    '// @namespace scriptvault-e2e',
    '// @version 1.0.0',
    '// @match http://127.0.0.1/*',
    '// @grant GM_setValue',
    '// @grant GM_addValueChangeListener',
    '// ==/UserScript==',
    'GM_addValueChangeListener("count", (name, oldValue, newValue, remote) => {',
    '  document.documentElement.setAttribute("data-sv-value-name", String(name));',
    '  document.documentElement.setAttribute("data-sv-value-old", String(oldValue));',
    '  document.documentElement.setAttribute("data-sv-value-new", String(newValue));',
    '  document.documentElement.setAttribute("data-sv-value-remote", String(remote));',
    '});',
    'document.addEventListener("scriptvault-e2e-set-value", event => {',
    '  GM_setValue("count", event.detail.value);',
    '});',
    'document.documentElement.setAttribute("data-sv-value-ready", "true");',
    '',
  ].join('\n');
}

test('GM_addValueChangeListener marks other-tab writes as remote', async () => {
  const server = await startTargetServer();
  const app = await launchScriptVault();
  try {
    const dashboard = await openExtensionPage(app);
    const executionCapability = await ensureUserScriptsAvailable(app, dashboard);
    test.skip(!executionCapability.available, executionCapability.reason);

    await expect(sendRuntimeMessage(dashboard, {
      action: 'saveScript',
      data: { code: valueChangeUserscript(), enabled: true },
    })).resolves.toMatchObject({ success: true });

    const origin = await app.context.newPage();
    const remote = await app.context.newPage();
    await Promise.all([
      origin.goto(`${server.url}/origin`, { waitUntil: 'domcontentloaded' }),
      remote.goto(`${server.url}/remote`, { waitUntil: 'domcontentloaded' }),
    ]);
    await origin.waitForFunction(() => document.documentElement.getAttribute('data-sv-value-ready') === 'true');
    await remote.waitForFunction(() => document.documentElement.getAttribute('data-sv-value-ready') === 'true');

    await origin.evaluate(() => {
      document.dispatchEvent(new CustomEvent('scriptvault-e2e-set-value', { detail: { value: 42 } }));
    });

    await expect(remote.locator('html')).toHaveAttribute('data-sv-value-remote', 'true');
    await expect(remote.locator('html')).toHaveAttribute('data-sv-value-new', '42');
    await expect(origin.locator('html')).toHaveAttribute('data-sv-value-remote', 'false');
  } finally {
    await app.close();
    await server.close();
  }
});
