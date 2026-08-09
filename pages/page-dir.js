// Shared Trusted Types helpers are initialized before any page or lazy module
// can create a DOM sink. The policy is intentionally small and only permits
// same-extension module filenames for script URLs.
const ScriptVaultTrustedTypes = globalThis.ScriptVaultTrustedTypes || (() => {
  const policies = new Map();

  function getPolicy(name) {
    if (policies.has(name)) return policies.get(name);
    const trustedTypesApi = globalThis.trustedTypes;
    if (!trustedTypesApi?.createPolicy) {
      policies.set(name, null);
      return null;
    }
    let policy = null;
    try {
      policy = trustedTypesApi.createPolicy(name, {
        createHTML: value => String(value ?? ''),
        createScriptURL: value => {
          const source = String(value ?? '');
          if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\.js$/.test(source)) {
            throw new TypeError('ScriptVault only loads local JavaScript module filenames');
          }
          return source;
        },
      });
    } catch (_) {
      // A page may have initialized this named policy before page-dir.js was
      // evaluated. The caller will fall back to its local non-TT path.
    }
    policies.set(name, policy);
    return policy;
  }

  return {
    getPolicy,
    toTrustedHTML(name, value) {
      const raw = String(value ?? '');
      return getPolicy(name)?.createHTML(raw) ?? raw;
    },
    toTrustedScriptURL(name, value) {
      const raw = String(value ?? '');
      return getPolicy(name)?.createScriptURL(raw) ?? raw;
    },
  };
})();
globalThis.ScriptVaultTrustedTypes = ScriptVaultTrustedTypes;

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
