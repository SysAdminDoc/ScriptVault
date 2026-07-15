import { expect, test } from '@playwright/test';

import {
  launchScriptVault,
  openExtensionPage,
  sendRuntimeMessage,
  userscript,
} from './helpers/extension-fixture.js';

test('workbench filters, inspector tabs, and progressive row actions operate in the real extension', async () => {
  test.setTimeout(90_000);
  const app = await launchScriptVault();
  try {
    const page = await openExtensionPage(app);
    await page.evaluate(() => chrome.storage.local.set({
      lastSeenVersion: chrome.runtime.getManifest().version,
    }));

    const code = userscript({
      name: 'E2E Workbench Script',
      version: '2.4.1',
      body: 'document.documentElement.dataset.scriptVaultWorkbench = "ready";',
    });
    await expect(sendRuntimeMessage(page, {
      action: 'saveScript',
      data: { id: 'script_e2e_workbench', code, enabled: true },
    })).resolves.toMatchObject({ success: true });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('.sv-workbench-topbar')).toBeVisible();
    await expect(page.locator('.scripts-shell-stats > .scripts-shell-stat')).toHaveCount(3);
    await expect(page.locator('#scriptTableBody tr')).toHaveCount(1, { timeout: 20_000 });
    await expect(page.locator('#siteFilterSelect option')).toContainText(['All sites', 'example.com']);
    await expect(page.locator('#scriptInspectorTitle')).toHaveText('E2E Workbench Script');

    await page.locator('[data-inspector-tab="access"]').click();
    await expect(page.locator('#scriptInspectorAccessView')).toBeVisible();
    await expect(page.locator('#scriptInspectorOverview')).toBeHidden();
    await page.locator('[data-inspector-tab="activity"]').press('ArrowLeft');
    await expect(page.locator('[data-inspector-tab="access"]')).toBeFocused();

    const rowMenuTrigger = page.locator('.script-row-menu-trigger');
    await rowMenuTrigger.click();
    const rowMenu = page.locator('.script-row-menu:popover-open');
    await expect(rowMenu).toBeVisible();
    expect(await rowMenu.getByRole('menuitem').count()).toBeGreaterThanOrEqual(5);
    await expect(rowMenu.locator('[data-action="pin"]')).toBeFocused();
    await rowMenu.press('End');
    await expect(rowMenu.locator('[data-action="delete"]')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(rowMenu).toBeHidden();
    await expect(rowMenuTrigger).toHaveAttribute('aria-expanded', 'false');

    await page.locator('#siteFilterSelect').selectOption('example.com');
    await expect(page.locator('#scriptTableBody tr')).toHaveCount(1);
    await page.locator('#siteFilterSelect').selectOption('all');
    await page.locator('#savedViewSelect').selectOption('enabled');
    await expect(page.locator('#filterSelect')).toHaveValue('enabled');
    await expect(page.locator('#scriptTableBody tr')).toHaveCount(1);
  } finally {
    await app.close();
  }
});
