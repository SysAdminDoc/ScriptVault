// Sets the document direction from the browser UI locale before first paint.
// This must be an external script: MV3 extension-page CSP (script-src 'self')
// blocks inline scripts, so the previous inline version never executed and
// only produced console CSP errors.
document.documentElement.dir = chrome.i18n?.getMessage?.('@@bidi_dir') || 'ltr';
