// DevTools page — creates the ScriptVault panel in Chrome DevTools.
// Extracted from inline <script> in devtools.html so the extension_pages CSP
// (script-src 'self') doesn't block execution.
try {
  if (typeof I18n !== 'undefined') {
    I18n.init?.('auto');
    I18n.applyToDOM?.(document);
  }
} catch (_) {
  // DevTools panel creation must not depend on localization availability.
}

chrome.devtools.panels.create(
  'ScriptVault',
  '../images/icon16.png',
  'devtools-panel.html',
  function(panel) {
    // Panel created; the panel page handles everything
  }
);
