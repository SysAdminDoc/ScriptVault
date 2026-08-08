// The Theme Editor stores extra presets (nord/dracula/solarized/…) and custom
// themes as CSS-variable overrides under `sv_active_custom_theme`, deliberately
// leaving settings.layout on a built-in so the base palette still resolves. Only
// the dashboard read that key, so a user's chosen theme applied to the dashboard
// alone and every other surface rendered the base built-in.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ROOT = process.cwd();
const themeApplySource = readFileSync(resolve(ROOT, 'pages/theme-apply.js'), 'utf8');

const SURFACES = [
  { name: 'popup', script: 'pages/popup.js', html: 'pages/popup.html' },
  { name: 'side panel', script: 'pages/sidepanel.js', html: 'pages/sidepanel.html' },
  { name: 'install review', script: 'pages/install.js', html: 'pages/install.html' },
  { name: 'DevTools panel', script: 'pages/devtools-panel.js', html: 'pages/devtools-panel.html' },
];

function loadThemeModule() {
  // Classic script assigning window.ScriptVaultTheme.
  new Function(themeApplySource)();
  return window.ScriptVaultTheme;
}

beforeEach(() => {
  document.head.innerHTML = '';
  document.documentElement.removeAttribute('data-theme');
  globalThis.__resetStorageMock?.();
});

afterEach(() => {
  delete window.ScriptVaultTheme;
  // Deliberately NOT vi.restoreAllMocks(): the shared chrome storage mock is
  // built from vi.fn()s, and restoring them strips their implementations for
  // every later test in the file.
});

describe('every surface loads and uses the shared theme applier', () => {
  it.each(SURFACES)('$name loads theme-apply.js before its own script', ({ script, html }) => {
    const markup = readFileSync(resolve(ROOT, html), 'utf8');
    const themeAt = markup.indexOf('theme-apply.js');
    const ownAt = markup.indexOf(script.replace('pages/', ''));
    expect(themeAt).toBeGreaterThan(-1);
    // Order matters: window.ScriptVaultTheme must exist by the time the page
    // script runs.
    expect(ownAt).toBeGreaterThan(themeAt);
  });

  it.each(SURFACES)('$name applies the theme through the shared module', ({ script }) => {
    const src = readFileSync(resolve(ROOT, script), 'utf8');
    expect(src).toContain('ScriptVaultTheme.applyTheme(');
    expect(src).toContain('ScriptVaultTheme.watchCustomTheme()');
  });

  it.each(SURFACES)('$name no longer hand-rolls the layout resolution', ({ script }) => {
    const src = readFileSync(resolve(ROOT, script), 'utf8');
    // The five-way duplicated auto/layout ternary is gone from the page scripts.
    expect(src).not.toMatch(/matchMedia\('\(prefers-color-scheme: dark\)'\)\.matches \? 'dark' : 'light'/);
  });
});

describe('the shared applier resolves the built-in layout', () => {
  it('uses an explicit layout as-is', () => {
    const theme = loadThemeModule();
    expect(theme.applyLayout('catppuccin')).toBe('catppuccin');
    expect(document.documentElement.getAttribute('data-theme')).toBe('catppuccin');
    expect(theme.applyLayout('oled')).toBe('oled');
  });

  it('falls back to dark for an unknown layout rather than passing it through', () => {
    const theme = loadThemeModule();
    expect(theme.applyLayout('not-a-theme')).toBe('dark');
    expect(theme.applyLayout('')).toBe('dark');
  });

  it('resolves auto from the OS preference and follows changes', () => {
    const theme = loadThemeModule();
    const listeners = [];
    // jsdom ships no matchMedia, so define one rather than spying on a property
    // that does not exist.
    const previous = window.matchMedia;
    window.matchMedia = () => ({
      matches: true,
      addEventListener: (_type, fn) => listeners.push(fn),
      removeEventListener: () => {},
    });
    try {
      expect(theme.applyLayout('auto')).toBe('dark');
      expect(listeners).toHaveLength(1);
      // The listener keeps data-theme in sync while the preference is auto.
      window.matchMedia = () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} });
      listeners[0]();
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    } finally {
      if (previous) window.matchMedia = previous;
      else delete window.matchMedia;
    }
  });

  it('falls back to dark when the engine has no matchMedia at all', () => {
    const theme = loadThemeModule();
    const previous = window.matchMedia;
    delete window.matchMedia;
    try {
      expect(theme.applyLayout('auto')).toBe('dark');
    } finally {
      if (previous) window.matchMedia = previous;
    }
  });
});

describe('the shared applier injects the active custom theme', () => {
  it('writes the sanitized variables into a style element', () => {
    const theme = loadThemeModule();
    theme.applyCustomThemeVars({ vars: { '--sv-bg': '#101014', '--sv-text': 'rgb(240 240 240)' } });

    const style = document.getElementById('sv-active-custom-theme');
    expect(style).toBeTruthy();
    expect(style.textContent).toContain('--sv-bg: #101014;');
    expect(style.textContent).toContain('--sv-text: rgb(240 240 240);');
  });

  it('clears the style element when no custom theme is active', () => {
    const theme = loadThemeModule();
    theme.applyCustomThemeVars({ vars: { '--sv-bg': '#101014' } });
    theme.applyCustomThemeVars(null);
    expect(document.getElementById('sv-active-custom-theme').textContent).toBe('');
  });

  // The stored entry is JSON in extension storage; a value able to close the
  // declaration block would inject arbitrary CSS rules on every surface.
  it('rejects a value that could break out of the declaration', () => {
    const theme = loadThemeModule();
    const safe = theme.sanitizeThemeVars({
      '--ok': '#fff',
      '--brace': '#fff } body { display: none',
      '--semi': '#fff; position: fixed',
      '--close': 'red}',
    });
    expect(Object.keys(safe)).toEqual(['--ok']);
  });

  it('rejects keys that are not CSS custom properties', () => {
    const theme = loadThemeModule();
    const safe = theme.sanitizeThemeVars({
      '--good': '#fff',
      'color': 'red',
      '--bad space': '#fff',
      '--bad:colon': '#fff',
      '': '#fff',
    });
    expect(Object.keys(safe)).toEqual(['--good']);
  });

  it('rejects non-string values', () => {
    const theme = loadThemeModule();
    expect(theme.sanitizeThemeVars({ '--n': 1, '--o': {}, '--a': [], '--nl': null })).toEqual({});
  });

  it('produces no style block for an empty or malformed theme', () => {
    const theme = loadThemeModule();
    expect(theme.buildCustomThemeCss(null)).toBe('');
    expect(theme.buildCustomThemeCss({})).toBe('');
    expect(theme.buildCustomThemeCss({ 'nope': 'red' })).toBe('');
  });

  it('reads the stored theme and survives storage being unavailable', async () => {
    const theme = loadThemeModule();
    await chrome.storage.local.set({ sv_active_custom_theme: { vars: { '--sv-bg': '#000' } } });
    await expect(theme.readActiveCustomTheme()).resolves.toMatchObject({ vars: { '--sv-bg': '#000' } });

    const originalGet = chrome.storage.local.get;
    chrome.storage.local.get = async () => { throw new Error('no storage'); };
    try {
      // The base built-in theme is still correct, so this is not an error path.
      await expect(theme.readActiveCustomTheme()).resolves.toBeNull();
    } finally {
      chrome.storage.local.get = originalGet;
    }
  });

  it('applies layout and custom vars together', async () => {
    const theme = loadThemeModule();
    await chrome.storage.local.set({ sv_active_custom_theme: { vars: { '--sv-accent': '#8be9fd' } } });

    const result = await theme.applyTheme({ layout: 'light' });
    expect(result.theme).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.getElementById('sv-active-custom-theme').textContent).toContain('--sv-accent: #8be9fd;');
  });

  it('takes the layout from a getSettings callback when not passed directly', async () => {
    const theme = loadThemeModule();
    const result = await theme.applyTheme({
      getSettings: async () => ({ settings: { layout: 'oled' } }),
    });
    expect(result.theme).toBe('oled');
  });

  it('still renders a built-in theme when getSettings fails', async () => {
    const theme = loadThemeModule();
    const result = await theme.applyTheme({ getSettings: async () => { throw new Error('no background'); } });
    expect(result.theme).toBe('dark');
  });
});

describe('the theme editor confirms before destroying a custom theme', () => {
  const editor = readFileSync(resolve(ROOT, 'pages/dashboard-theme-editor.js'), 'utf8');

  it('routes deletion through the shared confirm modal', () => {
    // A custom theme is 21+ hand-picked tokens with no undo; every other delete
    // in the dashboard confirms.
    expect(editor).toContain("window.ScriptVaultDashboardUI?.confirm");
    expect(editor).toContain("'Delete Theme?'");
    expect(editor).toContain("tone: 'danger'");
    expect(editor).toContain('if (!ok) return;');
  });

  it('does not delete before the confirm resolves', () => {
    const handler = editor.slice(
      editor.indexOf("delBtn.addEventListener('click'"),
      editor.indexOf('card.appendChild(delBtn);'),
    );
    const confirmAt = handler.indexOf('confirmDelete(');
    const deleteAt = handler.indexOf('deleteCustomTheme(');
    expect(confirmAt).toBeGreaterThan(-1);
    expect(deleteAt).toBeGreaterThan(confirmAt);
  });

  it('meets the enforced 24x24 minimum target size', () => {
    const css = editor.slice(
      editor.indexOf('.sv-te-delete-custom {'),
      editor.indexOf('.sv-te-preset:hover .sv-te-delete-custom'),
    );
    expect(css).toContain('width: 24px;');
    expect(css).toContain('height: 24px;');
    expect(css).toContain('min-width: 24px;');
    expect(css).toContain('min-height: 24px;');
    expect(css).not.toContain('width: 16px;');
  });

  it('is always rendered rather than revealed only on hover', () => {
    const css = editor.slice(
      editor.indexOf('.sv-te-delete-custom {'),
      editor.indexOf('.sv-te-preset:hover .sv-te-delete-custom'),
    );
    // A hover-only control is unreachable by touch.
    expect(css).toContain('display: flex;');
    expect(css).not.toMatch(/display:\s*none/);
  });

  it('is a real button so Enter and Space activate it', () => {
    expect(editor).toContain("type: 'button', className: 'sv-te-delete-custom'");
    expect(editor).toContain("'aria-label': `Delete custom theme ${preset.name}`");
  });
});
