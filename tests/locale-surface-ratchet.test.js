import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const ROOT = process.cwd();
const SURFACES = {
  dashboard: 'pages/dashboard.html',
  popup: 'pages/popup.html',
  sidepanel: 'pages/sidepanel.html',
};
const I18N_SOURCE = readFileSync(resolve(ROOT, 'modules/i18n.js'), 'utf8');
const PSEUDO_PREFIX = '⟦';
const PSEUDO_SUFFIX = '⟧';
const I18N_ATTRS = [
  ['data-i18n', 'text'],
  ['data-i18n-placeholder', 'placeholder'],
  ['data-i18n-title', 'title'],
  ['data-i18n-aria-label', 'aria-label'],
];
const EDITOR_KEYS = [
  'editorUserscriptEditor',
  'editorSaveTitle',
  'closeEditorTitle',
  'toolbarUndoTitle',
  'toolbarRedoTitle',
  'toolbarFindTitle',
  'toolbarReplaceTitle',
  'beautifyTitle',
  'lintTitle',
  'foldTitle',
  'unfoldTitle',
  'goToLineTitle',
  'toggleCommentTitle',
  'wordWrapTitle',
  'snippetTitle',
  'templateTitle',
  'patternTitle',
  'diffTitle',
  'bindLocalFileTitle',
  'refreshLocalFileTitle',
  'unbindLocalFileTitle',
  'publishGreasyForkTitle',
  'debugTitle',
  'shareTitle',
  'monacoEditorTitle',
];
const REQUIRED_KEYS = {
  dashboard: ['tabScripts', 'tabSettings', 'workbenchCommandSearch', ...EDITOR_KEYS],
  popup: ['popupScriptsForThisPageAria', 'popupFindNewScriptsEllipsis', 'popupCreateNewScriptEllipsis', 'popupScriptActionsAria'],
  sidepanel: ['sideSearchInstalledScripts', 'sideSearchScriptsPlaceholder', 'sideScriptsRunningOnPageAria', 'sideOpenDashboard'],
};

function createPseudoI18n(doc) {
  const marker = `
  localeCatalogs.pseudo = Object.fromEntries(
    Object.keys(localeCatalogs.en).map(key => [key, '${PSEUDO_PREFIX}' + key + '${PSEUDO_SUFFIX}']),
  );
  localeMetadata.pseudo = {
    ...localeMetadata.en,
    name: 'Pseudo',
    direction: 'rtl',
    translationStatus: 'complete',
    runtimeCoverageBaseline: localeMetadata.en.totalRuntimeMessages,
    translatedRuntimeMessages: localeMetadata.en.totalRuntimeMessages,
  };
`;
  const patched = I18N_SOURCE.replace('  var catalogs = localeCatalogs;', `${marker}\n  var catalogs = localeCatalogs;`);
  if (patched === I18N_SOURCE) throw new Error('generated i18n runtime changed its catalog initialization anchor');
  const compiled = vm.compileFunction(`${patched}\nreturn I18n;`, ['navigator', 'document'], {
    filename: resolve(ROOT, 'modules/i18n.js'),
  });
  return compiled({ language: 'en-US' }, doc);
}

function pseudoValue(key) {
  return `${PSEUDO_PREFIX}${key}${PSEUDO_SUFFIX}`;
}

function surfaceDocument(file) {
  const source = readFileSync(resolve(ROOT, file), 'utf8');
  return new DOMParser().parseFromString(source, 'text/html');
}

function localizedElements(doc) {
  return [...doc.querySelectorAll(I18N_ATTRS.map(([attribute]) => `[${attribute}]`).join(','))];
}

function applyPseudoSurface(file) {
  const doc = surfaceDocument(file);
  const i18n = createPseudoI18n(doc);
  expect(i18n.init('pseudo')).toBe('pseudo');
  i18n.applyToDOM(doc);

  expect(doc.documentElement.lang).toBe('pseudo');
  expect(doc.documentElement.dir).toBe('rtl');

  const keys = new Set();
  for (const element of localizedElements(doc)) {
    for (const [attribute, target] of I18N_ATTRS) {
      const key = element.getAttribute(attribute);
      if (!key) continue;
      keys.add(key);
      if (target === 'text') {
        expect(element.textContent).toBe(pseudoValue(key));
      } else if (target === 'placeholder') {
        expect(element.getAttribute('placeholder')).toBe(pseudoValue(key));
      } else {
        expect(element.getAttribute(target)).toBe(pseudoValue(key));
      }
    }
  }

  const css = [...doc.querySelectorAll('style')].map(style => style.textContent || '').join('\n');
  expect(css).toMatch(/overflow\s*:\s*(?:hidden|auto|clip)/);
  expect(css).toMatch(/min-width\s*:\s*0/);
  return { doc, keys, css, localizedCount: localizedElements(doc).length };
}

describe('deterministic pseudo-locale surface ratchet', () => {
  it('exercises dashboard, popup, sidepanel, and editor labels without English fallback', () => {
    const stats = Object.fromEntries(Object.entries(SURFACES).map(([name, file]) => [name, applyPseudoSurface(file)]));

    expect(stats.dashboard.keys.size).toBeGreaterThanOrEqual(500);
    expect(stats.popup.keys.size).toBeGreaterThanOrEqual(25);
    expect(stats.sidepanel.keys.size).toBeGreaterThanOrEqual(25);
    for (const [surface, required] of Object.entries(REQUIRED_KEYS)) {
      for (const key of required) expect(stats[surface].keys).toContain(key);
    }
  });

  it('keeps side panel RTL control order explicit and bounded', () => {
    const { css } = applyPseudoSurface(SURFACES.sidepanel);
    expect(css).toMatch(/html\[data-panel-position="left"\]\[dir="rtl"\][\s\S]*?flex-direction:\s*row-reverse/);
    expect(css).toMatch(/\.sp-url-hostname[\s\S]*?text-overflow:\s*ellipsis/);
    expect(css).toMatch(/\.sp-search-input[\s\S]*?min-width:\s*0/);
  });
});
