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

const ADDITIONAL_A11Y_MODES = [
  { name: 'forced-colors', viewport: { width: 1280, height: 800 }, forcedColors: 'active' },
  { name: 'reflow-320', viewport: { width: 320, height: 720 }, reflow: true },
  { name: 'text-spacing', viewport: { width: 1280, height: 800 }, textSpacing: true },
];

const TEXT_SPACING_STYLE = `
  body * {
    line-height: 1.5 !important;
    letter-spacing: 0.12em !important;
    word-spacing: 0.16em !important;
  }
  body p,
  body li {
    margin-block-end: 2em !important;
  }
`;

async function markWhatsNewSeen(page) {
  await page.evaluate(() => chrome.storage.local.set({
    lastSeenVersion: chrome.runtime.getManifest().version,
  }));
}

// Seed the stored theme so each surface's async applyTheme (which reads
// settings after a getSettings roundtrip) applies the SAME theme this spec
// injects — otherwise the stored default overwrites the injected attribute
// and the light/catppuccin/oled passes silently re-test the default theme.
async function seedTheme(page, theme) {
  await page.evaluate(async nextTheme => {
    const current = (await chrome.storage.local.get('settings')).settings || {};
    await chrome.storage.local.set({ settings: { ...current, layout: nextTheme, theme: nextTheme } });
  }, theme);
}

async function settle(page, { forcedColors = 'none' } = {}) {
  await page.emulateMedia({ reducedMotion: 'reduce', forcedColors });
  await page.waitForTimeout(150);
}

async function inspectHorizontalOverflow(page) {
  return page.evaluate(() => ({
    viewport: innerWidth,
    // The root scrolling element is the page-level reflow contract. Body
    // scrollWidth also counts intentionally clipped descendants such as the
    // bounded library table and the horizontally scrollable mobile rail.
    scrollWidth: document.documentElement.scrollWidth,
  }));
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
            await seedTheme(page, theme);
            await page.reload({ waitUntil: 'domcontentloaded' });
            await page.evaluate(nextTheme => document.documentElement.setAttribute('data-theme', nextTheme), theme);
            await page.locator(surface.ready).first().waitFor({ state: 'attached', timeout: 15_000 });
            await settle(page);
            // Fail loudly if a surface's async theme apply overwrote the
            // injected theme — otherwise the pass would silently test the
            // wrong theme.
            const appliedTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
            if (appliedTheme !== theme) {
              throw new Error(`${surface.name}: expected data-theme="${theme}" but found "${appliedTheme}"`);
            }
            const label = `${surface.name}/${theme}/${viewport.width}x${viewport.height}`;
            failures.push(...await analyzeAccessibility(page, label));
            const geometry = await inspectInteractiveGeometry(page);
            for (const kind of ['undersized', 'focusFailures', 'obscured']) {
              geometryFailures.push(...geometry[kind].map(failure => ({ label, kind, ...failure })));
            }
          }
        }

        for (const mode of ADDITIONAL_A11Y_MODES) {
          await page.setViewportSize(mode.viewport);
          await page.emulateMedia({
            reducedMotion: 'reduce',
            forcedColors: mode.forcedColors || 'none',
          });
          await seedTheme(page, 'dark');
          await page.reload({ waitUntil: 'domcontentloaded' });
          await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
          await page.locator(surface.ready).first().waitFor({ state: 'attached', timeout: 15_000 });
          await settle(page, mode);
          if (mode.textSpacing) {
            await page.addStyleTag({ content: TEXT_SPACING_STYLE });
          }
          const label = `${surface.name}/${mode.name}`;
          failures.push(...await analyzeAccessibility(page, label));
          if (mode.reflow || mode.textSpacing) {
            const overflow = await inspectHorizontalOverflow(page);
            if (overflow.scrollWidth > overflow.viewport + 1) {
              geometryFailures.push({
                label,
                kind: 'horizontal-overflow',
                target: 'document',
                viewport: overflow.viewport,
                scrollWidth: overflow.scrollWidth,
              });
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
