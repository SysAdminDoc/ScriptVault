// Shared theme application for every extension surface.
//
// The Theme Editor's extra presets (nord/dracula/solarized/…) and user-built
// custom themes are stored as CSS-variable overrides under
// `sv_active_custom_theme`, deliberately leaving `settings.layout` on a built-in
// so the base palette still resolves. Only the dashboard read that key, so a
// user's chosen theme applied to the dashboard alone and the popup, side panel,
// install review and DevTools panel all rendered the base built-in — the same
// product looking like two different ones.
//
// This module owns both halves: resolving `data-theme` from `settings.layout`
// (including `auto` plus its `prefers-color-scheme` listener, which was
// duplicated five times) and injecting the sanitized custom-theme variables.
//
// Loaded as a classic script before each page's own script, exposing
// `window.ScriptVaultTheme`.

(() => {
  'use strict';

  const CUSTOM_THEME_KEY = 'sv_active_custom_theme';
  const STYLE_ELEMENT_ID = 'sv-active-custom-theme';
  const BUILT_IN_THEMES = ['dark', 'light', 'catppuccin', 'oled'];

  /**
   * A custom-theme entry crosses a trust boundary: it is JSON in extension
   * storage that a compromised page-facing import path could have written. Only
   * accept real CSS custom-property names, and reject any value carrying `{`,
   * `}` or `;` — those would let a value close the declaration block and inject
   * arbitrary rules.
   */
  function sanitizeThemeVars(vars) {
    const safe = {};
    if (!vars || typeof vars !== 'object') return safe;
    for (const [key, value] of Object.entries(vars)) {
      if (!/^--[\w-]+$/.test(key)) continue;
      if (typeof value !== 'string' || /[{};]/.test(value)) continue;
      safe[key] = value;
    }
    return safe;
  }

  function buildCustomThemeCss(vars) {
    const safe = sanitizeThemeVars(vars);
    const keys = Object.keys(safe);
    if (keys.length === 0) return '';
    let css = ':root {\n';
    for (const key of keys) css += `  ${key}: ${safe[key]};\n`;
    css += '}\n';
    return css;
  }

  let styleElement = null;

  /** Inject (or clear) the active custom theme's variables on this document. */
  function applyCustomThemeVars(active) {
    const vars = active && typeof active === 'object' ? active.vars : null;
    const css = buildCustomThemeCss(vars);
    if (!css) {
      if (styleElement) styleElement.textContent = '';
      return '';
    }
    if (!styleElement) {
      styleElement = document.getElementById(STYLE_ELEMENT_ID);
    }
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = STYLE_ELEMENT_ID;
      document.head.appendChild(styleElement);
    }
    styleElement.textContent = css;
    return css;
  }

  /** Read the stored custom theme, or null when there is none. */
  async function readActiveCustomTheme() {
    try {
      const data = await chrome.storage.local.get(CUSTOM_THEME_KEY);
      const active = data?.[CUSTOM_THEME_KEY];
      return active && typeof active === 'object' ? active : null;
    } catch (_e) {
      // Storage unavailable (a surface without permission, or teardown) — the
      // base built-in theme is still correct, so this is not an error.
      return null;
    }
  }

  let colorSchemeMedia = null;
  let colorSchemeHandler = null;

  function removeColorSchemeListener() {
    if (colorSchemeMedia && colorSchemeHandler) {
      try {
        colorSchemeMedia.removeEventListener('change', colorSchemeHandler);
      } catch (_e) { /* older engines */ }
    }
    colorSchemeMedia = null;
    colorSchemeHandler = null;
  }

  function resolveLayout(layoutPref) {
    if (layoutPref !== 'auto') {
      return BUILT_IN_THEMES.includes(layoutPref) ? layoutPref : 'dark';
    }
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch (_e) {
      return 'dark';
    }
  }

  /**
   * Set `data-theme` for a layout preference and keep it in sync while the
   * preference is `auto`. Replaces the copy that lived in five page scripts.
   */
  function applyLayout(layoutPref) {
    const pref = typeof layoutPref === 'string' && layoutPref ? layoutPref : 'dark';
    removeColorSchemeListener();
    document.documentElement.setAttribute('data-theme', resolveLayout(pref));
    if (pref === 'auto') {
      try {
        colorSchemeMedia = window.matchMedia('(prefers-color-scheme: dark)');
        colorSchemeHandler = () => {
          document.documentElement.setAttribute('data-theme', resolveLayout('auto'));
        };
        colorSchemeMedia.addEventListener('change', colorSchemeHandler);
      } catch (_e) { /* no matchMedia — the static value above stands */ }
    }
    return document.documentElement.getAttribute('data-theme');
  }

  /**
   * Apply the complete theme for this surface: the built-in layout plus any
   * active custom/extra-preset variables.
   *
   * `getSettings` is provided by the caller because the surfaces differ — the
   * dashboard has settings in hand, the others ask the background.
   */
  async function applyTheme(options = {}) {
    let layoutPref = options.layout;
    if (layoutPref === undefined && typeof options.getSettings === 'function') {
      try {
        const result = await options.getSettings();
        const settings = result?.settings || result || {};
        layoutPref = settings.layout;
      } catch (_e) {
        layoutPref = undefined;
      }
    }
    const theme = applyLayout(layoutPref || 'dark');
    const active = options.customTheme !== undefined
      ? options.customTheme
      : await readActiveCustomTheme();
    applyCustomThemeVars(active);
    return { theme, layout: layoutPref || 'dark', customTheme: active || null };
  }

  /**
   * Re-apply when the theme editor writes a new custom theme, so a surface open
   * at the time follows along instead of waiting for a reload.
   */
  function watchCustomTheme() {
    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local' || !changes?.[CUSTOM_THEME_KEY]) return;
        applyCustomThemeVars(changes[CUSTOM_THEME_KEY].newValue || null);
      });
    } catch (_e) { /* no storage events on this surface */ }
  }

  window.ScriptVaultTheme = {
    CUSTOM_THEME_KEY,
    STYLE_ELEMENT_ID,
    BUILT_IN_THEMES,
    sanitizeThemeVars,
    buildCustomThemeCss,
    applyCustomThemeVars,
    readActiveCustomTheme,
    resolveLayout,
    applyLayout,
    applyTheme,
    watchCustomTheme,
  };
})();
