import { expect, test } from '@playwright/test';

import { launchScriptVault, openExtensionPage, sendRuntimeMessage } from './helpers/extension-fixture.js';

const SCRIPT_ID = 'script_e2e_advanced_usercss';

const ADVANCED_USERCSS = `// ==UserScript==
// @name Advanced UserCSS E2E
// @namespace scriptvault-e2e
// @version 1.0.0
// @match https://example.com/*
// @grant none
// ==/UserScript==
/* ==UserStyle==
@name Advanced UserCSS E2E
@namespace scriptvault-e2e
@version 1.0.0
@match https://example.com/*
@var color accent "Accent" hsl(260 75% 60%) @group brand
@var color accentAlias "Accent alias" hsl(260 75% 60%) @group brand
@var color surface "Surface" #ffffff @light #ffffff @dark oklch(24% 0.02 255)
==/UserStyle== */
body { color: /*[[accent]]*/; border-color: var(--accentAlias); background: /*[[surface]]*/; }`;

async function markWhatsNewSeen(page) {
  await page.evaluate(() => chrome.storage.local.set({
    lastSeenVersion: chrome.runtime.getManifest().version,
  }));
}

test('advanced UserCSS configuration live-previews linked palettes and persists draft defaults', async () => {
  test.setTimeout(120_000);
  const app = await launchScriptVault();
  try {
    const target = await app.context.newPage();
    await target.route('https://example.com/**', route => route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><html><body>Advanced UserCSS target</body></html>',
    }));
    await target.goto('https://example.com/usercss-target');

    const page = await openExtensionPage(app);
    await markWhatsNewSeen(page);
    const saved = await sendRuntimeMessage(page, {
      action: 'saveScript',
      data: { id: SCRIPT_ID, code: ADVANCED_USERCSS, enabled: false },
    });
    expect(saved).toMatchObject({ success: true, scriptId: SCRIPT_ID });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('#btnDismissWarning').click({ timeout: 5_000 }).catch(() => {});
    await page.locator(`.action-icon[data-action="edit"][data-id="${SCRIPT_ID}"]`).click();
    await expect(page.frameLocator('#monacoFrame').locator('.monaco-editor')).toBeVisible({ timeout: 20_000 });
    await page.waitForFunction(() => window._monacoEditorAdapter?.isMonaco === true, null, { timeout: 20_000 });

    await expect(page.locator('#btnEditorConfigureUserCSS')).toBeVisible();
    await page.locator('#btnEditorConfigureUserCSS').click();
    await expect(page.locator('#userCssConfiguration')).toBeVisible();
    await expect(page.locator('[data-usercss-names="accent,accentAlias"]')).toHaveCount(1);
    await expect(page.locator('[data-usercss-names="surface"]')).toHaveCount(2);

    await page.locator('[data-usercss-names="accent,accentAlias"]').fill('oklab(70% -0.04 -0.12)');
    await page.locator('[data-usercss-names="surface"][data-usercss-scheme="dark"]').fill('oklch(30% 0.04 255)');
    await page.locator('#userCssPreviewScheme').selectOption('dark');

    await expect.poll(() => target.evaluate(() => {
      const style = getComputedStyle(document.body);
      return style.color === style.borderTopColor
        && style.color !== 'rgb(0, 0, 0)'
        && style.backgroundColor !== 'rgb(255, 255, 255)';
    }), { timeout: 20_000 }).toBe(true);
    const rendered = await target.evaluate(() => {
      const style = getComputedStyle(document.body);
      return { color: style.color, border: style.borderTopColor, background: style.backgroundColor };
    });
    expect(rendered.color).toBe(rendered.border);
    expect(rendered.background).not.toBe('rgb(255, 255, 255)');

    await page.getByRole('button', { name: 'Apply to Draft' }).click();
    await expect.poll(() => page.evaluate(() => window._monacoEditorAdapter?.getValue?.() || ''), { timeout: 10_000 })
      .toContain('@var color accent "Accent" oklab(70% -0.04 -0.12) @group brand');
    await page.locator('#btnEditorSave').click();
    await expect.poll(async () => {
      const script = await sendRuntimeMessage(page, { action: 'getScript', id: SCRIPT_ID });
      return script?.code || '';
    }, { timeout: 20_000 }).toContain('@dark oklch(30% 0.04 255)');
  } finally {
    await app.close();
  }
});
