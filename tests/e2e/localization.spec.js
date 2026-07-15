import { expect, test } from '@playwright/test';

import { launchScriptVault, openExtensionPage } from './helpers/extension-fixture.js';

const SURFACES = [
  'pages/dashboard.html',
  'pages/popup.html',
  'pages/sidepanel.html',
  'pages/install.html',
  'pages/devtools-panel.html',
];

test('real extension pages apply locale direction and CLDR plural forms', async () => {
  const app = await launchScriptVault();
  try {
    for (const path of SURFACES) {
      const page = await openExtensionPage(app, path);
      try {
        await expect(page.locator('html')).toHaveAttribute('lang', 'en');
        await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');

        const hebrew = await page.evaluate(() => {
          I18n.setLocale('he');
          I18n.applyToDOM(document);
          return {
            lang: document.documentElement.lang,
            direction: document.documentElement.dir,
            category: I18n.getPluralCategory(2),
            scripts: I18n.getPluralMessage('scriptNoun', 2),
          };
        });
        expect(hebrew).toEqual({ lang: 'he', direction: 'rtl', category: 'two', scripts: 'סקריפטים' });
      } finally {
        await page.close();
      }
    }

    const page = await openExtensionPage(app);
    try {
      const plurals = await page.evaluate(() => {
        I18n.setLocale('ru');
        const russian = [1, 2, 5].map(count => I18n.getPluralMessage('scriptNoun', count));
        I18n.setLocale('ja');
        const japanese = [1, 5].map(count => I18n.getPluralMessage('scriptNoun', count));
        return { russian, japanese };
      });
      expect(plurals).toEqual({
        russian: ['скрипт', 'скрипта', 'скриптов'],
        japanese: ['スクリプト', 'スクリプト'],
      });
    } finally {
      await page.close();
    }
  } finally {
    await app.close();
  }
});
