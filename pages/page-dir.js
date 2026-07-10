// Sets the document direction from the browser UI locale before first paint.
// This must be an external script: MV3 extension-page CSP (script-src 'self')
// blocks inline scripts, so the previous inline version never executed and
// only produced console CSP errors.
document.documentElement.dir = chrome.i18n?.getMessage?.('@@bidi_dir') || 'ltr';

// Reuse the last resolved theme before CSS paints. chrome.storage is async,
// so each page still validates the setting during initialization; this cache
// only prevents a dark flash for users who selected another supported theme.
const PAGE_THEMES = new Set(['dark', 'light', 'catppuccin', 'oled']);
try {
  const cachedTheme = localStorage.getItem('sv_theme');
  if (PAGE_THEMES.has(cachedTheme)) {
    document.documentElement.dataset.theme = cachedTheme;
  }
} catch (_) {
  // Storage can be unavailable in unusual embedded contexts; dark remains safe.
}

new MutationObserver(() => {
  const theme = document.documentElement.dataset.theme;
  if (!PAGE_THEMES.has(theme)) return;
  try {
    localStorage.setItem('sv_theme', theme);
  } catch (_) {
    // Keep theme application independent from cache availability.
  }
}).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
