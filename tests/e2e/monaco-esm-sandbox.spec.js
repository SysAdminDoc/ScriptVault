import { expect, test } from '@playwright/test';

import { launchScriptVault } from './helpers/extension-fixture.js';

async function openInstrumentedSandbox(app, { missingBundle = false } = {}) {
  const page = await app.context.newPage();
  await page.addInitScript(() => {
    window.__scriptVaultSandboxMessages = [];
    window.addEventListener('message', event => {
      window.__scriptVaultSandboxMessages.push(event.data);
    });
  });
  if (missingBundle) {
    await page.route('**/lib/monaco-esm/editor.js', route => route.abort());
  }
  await page.goto(app.url('pages/editor-sandbox.html'), {
    waitUntil: 'domcontentloaded',
    timeout: 20_000,
  });
  return page;
}

test('Monaco ESM sandbox loads the packaged editor in Chromium', async () => {
  const app = await launchScriptVault();
  try {
    const page = await openInstrumentedSandbox(app);

    await page.waitForFunction(
      () => window.__scriptVaultSandboxMessages?.some(message => message?.type === 'ready'),
      null,
      { timeout: 20_000 },
    );

    await expect(page.locator('.monaco-editor')).toBeVisible();
    await expect(page.locator('#loading')).toBeHidden();
    const snapshot = await page.evaluate(() => ({
      messages: window.__scriptVaultSandboxMessages,
      stylesheetHrefs: Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(link => link.href),
      hasEsmApi: Boolean(window.ScriptVaultMonacoEsm?.monaco?.editor),
    }));

    expect(snapshot.messages).toContainEqual({ type: 'ready' });
    expect(snapshot.messages).not.toContainEqual(expect.objectContaining({ type: 'monaco-load-error' }));
    expect(snapshot.stylesheetHrefs.some(href => href.endsWith('/lib/monaco-esm/editor.css'))).toBe(true);
    expect(snapshot.hasEsmApi).toBe(true);
  } finally {
    await app.close();
  }
});

test('Monaco ESM sandbox reports missing packaged editor in Chromium', async () => {
  const app = await launchScriptVault();
  try {
    const page = await openInstrumentedSandbox(app, { missingBundle: true });

    await page.waitForFunction(
      () => window.__scriptVaultSandboxMessages?.some(message => message?.type === 'monaco-load-error'),
      null,
      { timeout: 20_000 },
    );

    await expect(page.locator('.monaco-editor')).toHaveCount(0);
    await expect(page.locator('#loading')).toContainText('Editor Bundle Missing');
    await expect(page.locator('#loading')).toContainText('node esbuild.config.mjs --monaco-esm-only');
    const messages = await page.evaluate(() => window.__scriptVaultSandboxMessages);
    expect(messages).toContainEqual({ type: 'monaco-load-error', reason: 'missing-bundle' });
    expect(messages).not.toContainEqual(expect.objectContaining({ type: 'ready' }));
  } finally {
    await app.close();
  }
});
