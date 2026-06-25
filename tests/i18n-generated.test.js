import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const code = readFileSync(resolve(process.cwd(), 'modules/i18n.js'), 'utf8');
const _body = `${code}\nreturn I18n;`;
let _compiledFn;
try { const vm = require('node:vm'); _compiledFn = vm.compileFunction(_body, ['navigator', 'document'], { filename: resolve(process.cwd(), 'modules/i18n.js') }); } catch { _compiledFn = new Function('navigator', 'document', _body); }

function createI18n(language = 'en-US') {
  return _compiledFn({ language }, document);
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('generated I18n runtime', () => {
  it('normalizes regional locales and substitutes placeholders', () => {
    const I18n = createI18n('pt-BR');

    expect(I18n.init('pt-BR')).toBe('pt');
    expect(I18n.getMessage('syncConnect')).toBe('Conectar');
    expect(I18n.setLocale('es_MX')).toBe(true);
    expect(I18n.getMessage('confirmDeleteMultiple', { count: '3' })).toBe('Delete 3 selected scripts?');
  });

  it('applies translations to DOM text and attributes', () => {
    const I18n = createI18n('zh_CN');
    I18n.init('auto');
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
});
