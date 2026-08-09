import { expect, test } from '@playwright/test';
import { createServer } from 'node:http';

import {
  launchScriptVault,
  openExtensionPage,
  sendRuntimeMessage,
} from './helpers/extension-fixture.js';

async function startShadowFixture() {
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!doctype html><body>
      <div id="sv-shadow-immediate"></div>
      <script>
        const attach = (id, text) => {
          const host = document.getElementById(id) || document.createElement('div');
          host.id = id;
          if (!host.isConnected) document.body.append(host);
          const root = host.attachShadow({ mode: 'open' });
          root.innerHTML = '<span class="sv-shadow-text">' + text + '</span>';
        };
        attach('sv-shadow-immediate', 'immediate');
        setTimeout(() => attach('sv-shadow-late', 'late'), 2500);
      </script>
    </body>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  return {
    url: `http://127.0.0.1:${port}/shadow.html`,
    match: `http://127.0.0.1:${port}/*`,
    async close() {
      await new Promise(resolve => server.close(resolve));
    },
  };
}

async function shadowState(page) {
  return page.evaluate(() => {
    const hosts = ['sv-shadow-immediate', 'sv-shadow-late'];
    return Object.fromEntries(hosts.map(id => {
      const root = document.getElementById(id)?.shadowRoot;
      const style = root?.querySelector('style[data-scriptvault-userstyle]');
      const text = root?.querySelector('.sv-shadow-text');
      return [id, {
        style: style?.textContent || '',
        color: text ? getComputedStyle(text).color : '',
      }];
    }));
  });
}

test('enabled UserCSS reaches existing and later open shadow roots, then cleans up', async () => {
  test.setTimeout(45_000);
  const fixture = await startShadowFixture();
  const app = await launchScriptVault();
  try {
    const target = await app.context.newPage();
    await target.goto(fixture.url, { waitUntil: 'domcontentloaded' });
    const dashboard = await openExtensionPage(app);
    const code = [
      '/* ==UserStyle==',
      '@name Shadow root E2E',
      '@namespace scriptvault-shadow-e2e',
      '@version 1.0.0',
      `@match ${fixture.match}`,
      '==/UserStyle== */',
      '.sv-shadow-text { color: rgb(255, 0, 0) !important; }',
      '',
    ].join('\n');

    const installed = await sendRuntimeMessage(dashboard, { action: 'installUserStyle', code });
    expect(installed).toMatchObject({ success: true });
    await expect.poll(() => shadowState(target), { timeout: 12_000 }).toEqual({
      'sv-shadow-immediate': {
        style: '.sv-shadow-text { color: rgb(255, 0, 0) !important; }',
        color: 'rgb(255, 0, 0)',
      },
      'sv-shadow-late': {
        style: '.sv-shadow-text { color: rgb(255, 0, 0) !important; }',
        color: 'rgb(255, 0, 0)',
      },
    });

    await expect(sendRuntimeMessage(dashboard, {
      action: 'toggleUserStyle',
      id: installed.id,
      enabled: false,
    })).resolves.toMatchObject({ success: true });
    await expect.poll(() => shadowState(target), { timeout: 10_000 }).toEqual({
      'sv-shadow-immediate': { style: '', color: 'rgb(0, 0, 0)' },
      'sv-shadow-late': { style: '', color: 'rgb(0, 0, 0)' },
    });
    await dashboard.close();
    await target.close();
  } finally {
    await app.close();
    await fixture.close();
  }
});
