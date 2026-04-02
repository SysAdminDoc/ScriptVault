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
    `;

    I18n.applyToDOM(document);

    expect(document.querySelector('[data-i18n="save"]')?.textContent).toBe('保存');
    expect(document.querySelector('[data-i18n-placeholder="searchScripts"]')?.getAttribute('placeholder')).toBe('搜索脚本...');
    expect(document.querySelector('[data-i18n-title="refresh"]')?.getAttribute('title')).toBe('刷新');
  });
});
