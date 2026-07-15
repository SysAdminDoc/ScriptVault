import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalNavigatorLanguage = Object.getOwnPropertyDescriptor(window.navigator, 'language');

async function loadFreshI18n() {
  vi.resetModules();
  return import('../src/modules/i18n.ts');
}

function setNavigatorLanguage(language) {
  Object.defineProperty(window.navigator, 'language', {
    configurable: true,
    value: language,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '';
});

afterEach(() => {
  document.body.innerHTML = '';
  if (originalNavigatorLanguage) {
    Object.defineProperty(window.navigator, 'language', originalNavigatorLanguage);
  }
});

describe('source i18n module', () => {
  it('normalizes region-specific locale values instead of falling back to English', async () => {
    const { I18n } = await loadFreshI18n();

    expect(I18n.init('pt-BR')).toBe('pt');
    expect(I18n.getLocale()).toBe('pt');
    expect(I18n.getMessage('syncConnect')).toBe('Conectar');

    expect(I18n.setLocale('es_MX')).toBe(true);
    expect(I18n.getLocale()).toBe('es');
    expect(I18n.getMessage('confirmDeleteMultiple', { count: '3' })).toBe('Delete 3 selected scripts?');

    expect(I18n.setLocale('not-a-real-locale')).toBe(false);
    expect(I18n.getLocale()).toBe('es');
  });

  it('detects underscored browser locales in auto mode and applies DOM translations', async () => {
    setNavigatorLanguage('zh_CN');

    const { I18n } = await loadFreshI18n();
    expect(I18n.init('auto')).toBe('zh');

    document.body.innerHTML = `
      <button data-i18n="save"></button>
      <input data-i18n-placeholder="searchScripts">
      <div data-i18n-title="refresh"></div>
      <button data-i18n-aria-label="clearScriptSearch"></button>
    `;

    I18n.applyToDOM(document);

    expect(document.querySelector('[data-i18n="save"]')?.textContent).toBe('保存');
    expect(document.querySelector('[data-i18n-placeholder="searchScripts"]')?.getAttribute('placeholder')).toBe('搜索脚本...');
    expect(document.querySelector('[data-i18n-title="refresh"]')?.getAttribute('title')).toBe('刷新');
    expect(document.querySelector('[data-i18n-aria-label="clearScriptSearch"]')?.getAttribute('aria-label')).toBe('Clear script search');
  });

  it('sets document language and direction from generated locale metadata', async () => {
    const { I18n } = await loadFreshI18n();

    expect(I18n.init('he-IL')).toBe('he');
    expect(document.documentElement.lang).toBe('he');
    expect(document.documentElement.dir).toBe('rtl');
    expect(I18n.getDirection()).toBe('rtl');

    expect(I18n.setLocale('ja-JP')).toBe(true);
    expect(document.documentElement.lang).toBe('ja');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('uses CLDR plural categories for Russian, Japanese, and Hebrew fixtures', async () => {
    const { I18n } = await loadFreshI18n();

    I18n.init('ru');
    expect([1, 2, 5, 21].map(count => I18n.getPluralCategory(count))).toEqual(['one', 'few', 'many', 'one']);
    expect([1, 2, 5].map(count => I18n.getPluralMessage('scriptNoun', count))).toEqual(['скрипт', 'скрипта', 'скриптов']);

    I18n.setLocale('ja');
    expect([0, 1, 2].map(count => I18n.getPluralCategory(count))).toEqual(['other', 'other', 'other']);
    expect([1, 5].map(count => I18n.getPluralMessage('scriptNoun', count))).toEqual(['スクリプト', 'スクリプト']);

    I18n.setLocale('he');
    expect([1, 2, 3].map(count => I18n.getPluralCategory(count))).toEqual(['one', 'two', 'other']);
    expect([1, 2, 3].map(count => I18n.getPluralMessage('scriptNoun', count))).toEqual(['סקריפט', 'סקריפטים', 'סקריפטים']);
  });

  it('labels incomplete catalogs as partial with measured coverage', async () => {
    const { I18n } = await loadFreshI18n();
    const locales = I18n.getAvailableLocales();
    const english = locales.find(locale => locale.code === 'en');
    const hebrew = locales.find(locale => locale.code === 'he');

    expect(english).toMatchObject({ label: 'English', translationStatus: 'complete' });
    expect(hebrew).toMatchObject({ label: 'עברית (partial)', direction: 'rtl', translationStatus: 'partial' });
    expect(hebrew.translatedRuntimeMessages).toBeGreaterThan(0);
    expect(hebrew.translatedRuntimeMessages).toBeLessThan(hebrew.totalRuntimeMessages);
  });
});
