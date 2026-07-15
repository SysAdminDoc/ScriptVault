import { expect, test } from '@playwright/test';

import {
  analyzeAccessibility,
  formatAccessibilityFailures,
  inspectInteractiveGeometry,
  reviewedAccessibilityExceptions,
} from './helpers/accessibility.js';
import {
  launchScriptVault,
  openExtensionPage,
  seedPendingInstall,
  userscript,
} from './helpers/extension-fixture.js';

const THEMES = ['dark', 'light', 'catppuccin', 'oled'];
const SURFACES = [
  { name: 'dashboard', path: 'pages/dashboard.html', ready: '#scriptsPanel', viewports: [{ width: 1280, height: 800 }, { width: 800, height: 700 }] },
  { name: 'popup', path: 'pages/popup.html', ready: 'body', viewports: [{ width: 400, height: 650 }] },
  { name: 'sidepanel', path: 'pages/sidepanel.html', ready: 'body', viewports: [{ width: 420, height: 760 }] },
  { name: 'install', path: 'pages/install.html', ready: '#content', viewports: [{ width: 1100, height: 800 }, { width: 720, height: 700 }] },
  { name: 'devtools', path: 'pages/devtools-panel.html', ready: 'body', viewports: [{ width: 1100, height: 720 }, { width: 620, height: 700 }] },
];

async function markWhatsNewSeen(page) {
  await page.evaluate(() => chrome.storage.local.set({
    lastSeenVersion: chrome.runtime.getManifest().version,
  }));
}

async function settle(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(150);
}

test('real extension surfaces meet WCAG 2.2 AA across themes and viewports', async () => {
  test.setTimeout(240_000);
  const app = await launchScriptVault();
  const failures = [];
  const geometryFailures = [];
  try {
    const setupPage = await openExtensionPage(app);
    await markWhatsNewSeen(setupPage);
    await seedPendingInstall(setupPage, {
      code: userscript({ name: 'Accessibility Review Fixture' }),
      url: 'https://example.com/accessibility.user.js',
    });
    await setupPage.close();

    for (const surface of SURFACES) {
      const page = await openExtensionPage(app, surface.path);
      try {
        for (const viewport of surface.viewports) {
          await page.setViewportSize(viewport);
          for (const theme of THEMES) {
            await page.reload({ waitUntil: 'domcontentloaded' });
            await page.evaluate(nextTheme => document.documentElement.setAttribute('data-theme', nextTheme), theme);
            await page.locator(surface.ready).first().waitFor({ state: 'attached', timeout: 15_000 });
            await settle(page);
            const label = `${surface.name}/${theme}/${viewport.width}x${viewport.height}`;
            failures.push(...await analyzeAccessibility(page, label));
            const geometry = await inspectInteractiveGeometry(page);
            for (const kind of ['undersized', 'focusFailures', 'obscured']) {
              geometryFailures.push(...geometry[kind].map(failure => ({ label, kind, ...failure })));
            }
          }
        }
      } finally {
        await page.close();
      }
    }

    expect(reviewedAccessibilityExceptions.every(exception => exception.reason?.trim())).toBe(true);
    expect(failures.length, formatAccessibilityFailures(failures)).toBe(0);
    expect(geometryFailures, JSON.stringify(geometryFailures, null, 2)).toEqual([]);
  } finally {
    await app.close();
  }
});

test('dashboard empty, loading, error, and dialog states preserve keyboard access', async () => {
  test.setTimeout(120_000);
  const app = await launchScriptVault();
  try {
    const page = await openExtensionPage(app);
    await markWhatsNewSeen(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.setViewportSize({ width: 1280, height: 800 });
    await settle(page);

    await expect(page.locator('#emptyState')).toBeVisible();
    expect(await analyzeAccessibility(page, 'dashboard/empty')).toEqual([]);

    await page.evaluate(() => {
      const overlay = document.getElementById('progressOverlay');
      overlay.hidden = false;
      overlay.classList.add('active');
      overlay.setAttribute('aria-hidden', 'false');
      overlay.setAttribute('aria-busy', 'true');
    });
    await expect(page.locator('#progressOverlay')).toBeVisible();
    expect(await analyzeAccessibility(page, 'dashboard/loading')).toEqual([]);
    await page.evaluate(() => {
      const overlay = document.getElementById('progressOverlay');
      overlay.classList.remove('active');
      overlay.hidden = true;
      overlay.setAttribute('aria-hidden', 'true');
      overlay.setAttribute('aria-busy', 'false');
    });

    const trigger = page.locator('#btnFindScripts');
    await trigger.focus();
    await trigger.click();
    const dialog = page.locator('#findScriptsOverlay:not([hidden])');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Find Userscripts');
    await expect.poll(() => page.evaluate(() => document.getElementById('findScriptsOverlay')?.contains(document.activeElement))).toBe(true);
    for (let index = 0; index < 12; index++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => document.getElementById('findScriptsOverlay')?.contains(document.activeElement))).toBe(true);
    }
    expect(await analyzeAccessibility(page, 'dashboard/dialog')).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();

    const geometry = await inspectInteractiveGeometry(page);
    expect(geometry.count).toBeGreaterThan(10);
    expect(geometry.undersized, JSON.stringify(geometry.undersized, null, 2)).toEqual([]);
    expect(geometry.focusFailures, JSON.stringify(geometry.focusFailures, null, 2)).toEqual([]);
    expect(geometry.obscured, JSON.stringify(geometry.obscured, null, 2)).toEqual([]);

    const errorPage = await openExtensionPage(app, 'pages/install.html');
    await expect(errorPage.locator('#installTerminalTitle')).toContainText(/No userscript|Unable|Error/i);
    expect(await analyzeAccessibility(errorPage, 'install/error')).toEqual([]);
    await errorPage.close();
  } finally {
    await app.close();
  }
});
