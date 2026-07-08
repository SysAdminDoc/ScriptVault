// ScriptVault Install Page v2.3.0

const _svPolicy = (typeof window.trustedTypes !== 'undefined' && window.trustedTypes.createPolicy)
    ? window.trustedTypes.createPolicy('sv-install', { createHTML: s => s })
    : null;
function htmlToFragment(html, contextEl) {
    // Anchor the parse range in the target element so context-sensitive tags
    // (<td>/<tr>/<option>/<li>) parse correctly instead of being dropped in
    // document context (regression fixed 2026-07-01).
    const range = document.createRange();
    if (contextEl) range.selectNodeContents(contextEl);
    return range.createContextualFragment(String(html ?? ''));
}
function safeSetHtml(el, html) {
    el.replaceChildren(htmlToFragment(_svPolicy ? _svPolicy.createHTML(html) : html, el));
}

function getInstallI18n() {
  try {
    return typeof I18n !== 'undefined' ? I18n : null;
  } catch (_) {
    return null;
  }
}

function tInstall(key, fallback = key, placeholders = {}) {
  const i18n = getInstallI18n();
  return i18n?.getMessage ? i18n.getMessage(key, placeholders) : fallback;
}

function applyInstallI18n() {
  const i18n = getInstallI18n();
  if (!i18n?.applyToDOM) return;
  i18n.init?.('auto');
  i18n.applyToDOM(document);
}

// Dangerous permissions that warrant security warnings
const DANGEROUS_PERMISSIONS = [
  'GM_xmlhttpRequest',
  'GM.xmlHttpRequest',
  'GM_download',
  'GM_webSocket',
  'GM_setClipboard',
  'unsafeWindow',
  'GM_cookie',
  'GM_webRequest'
];

// Permission descriptions for install page tooltips
const GRANT_DESCRIPTIONS = {
  'GM_xmlhttpRequest': 'Can make network requests from declared run hosts or explicit @connect hosts',
  'GM.xmlHttpRequest': 'Can make network requests from declared run hosts or explicit @connect hosts',
  'GM_download': 'Can download files from declared run hosts or explicit @connect hosts',
  'GM_webSocket': 'Can open persistent WebSocket connections to declared run hosts or explicit @connect hosts',
  'GM_setClipboard': 'Can write to your clipboard',
  'GM_cookie': 'Can read and modify browser cookies for declared run hosts',
  'unsafeWindow': 'Direct access to the page\'s JavaScript environment',
  'GM_getValue': 'Can store and retrieve persistent data',
  'GM_setValue': 'Can store and retrieve persistent data',
  'GM_deleteValue': 'Can delete stored data',
  'GM_listValues': 'Can list all stored data keys',
  'GM_notification': 'Can show desktop notifications',
  'GM_openInTab': 'Can open new browser tabs',
  'GM_registerMenuCommand': 'Can add items to the extension menu',
  'GM_addStyle': 'Can inject CSS styles into the page',
  'GM_getResourceText': 'Can access bundled text resources',
  'GM_getResourceURL': 'Can access bundled resource URLs',
  'GM_addValueChangeListener': 'Can listen for storage value changes',
  'GM_webRequest': 'Can intercept and modify network requests within declared run hosts',
  'GM_head': 'Can make HEAD requests to any server',
  'window.close': 'Can close the current tab',
  'window.focus': 'Can focus the current tab',
  'window.onurlchange': 'Can detect URL changes (SPA navigation)',
  'none': 'No special permissions required',
};

// Safe/benign permissions
const SAFE_PERMISSIONS = [
  'none',
  'GM_getValue',
  'GM_setValue',
  'GM_deleteValue',
  'GM_listValues',
  'GM_addStyle',
  'GM_getResourceText',
  'GM_getResourceURL',
  'GM_log',
  'GM_info'
];

// Maps each GM grant that needs a Chrome optional permission to its
// permission token. The cookies + clipboard permissions are declared as
// optional in manifest.json so the install page must prompt the user at
// install time — otherwise the script silently fails when it later calls
// chrome.cookies.* or chrome.clipboard.* because the permission was never
// granted at install. Keep this map in sync with manifest.json
// `optional_permissions`. Reading the clipboard (GM_getClipboard, if ever
// added) would need `clipboardRead`; today no grant maps to it.
const OPTIONAL_GRANT_PERMISSION_MAP = {
  'GM_cookie': 'cookies',
  'GM.cookie': 'cookies',
  'GM_setClipboard': 'clipboardWrite',
  'GM.setClipboard': 'clipboardWrite',
  'GM_download': 'downloads',
  'GM.download': 'downloads',
};
const OPTIONAL_BROAD_HOST_ORIGINS = ['http://*/*', 'https://*/*'];

const ANTIFEATURE_LABELS = Object.freeze({
  ads: 'Contains advertising',
  membership: 'Requires membership',
  miner: 'Contains cryptocurrency miner',
  payment: 'Requires payment',
  'referral-link': 'Uses referral links',
  tracking: 'Includes tracking'
});

function parseAntifeatureDirective(value, locale = '') {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(\S+)(?:\s+([\s\S]*))?$/);
  if (!match) return null;

  return {
    type: String(match[1] || '').toLowerCase(),
    description: String(match[2] || '').trim(),
    locale
  };
}

function normalizeAntifeatureEntry(entry) {
  if (typeof entry === 'string') return parseAntifeatureDirective(entry);
  if (!entry || typeof entry !== 'object') return null;

  const type = typeof entry.type === 'string' ? entry.type.trim().toLowerCase() : '';
  if (!type) return null;

  return {
    type,
    description: typeof entry.description === 'string' ? entry.description.trim() : '',
    locale: typeof entry.locale === 'string' ? entry.locale.trim() : ''
  };
}

function getDeclaredAntifeatures(meta) {
  if (!meta || !Array.isArray(meta.antifeature)) return [];
  return meta.antifeature.map(normalizeAntifeatureEntry).filter(Boolean);
}

function formatAntifeatureLabel(entry) {
  const label = ANTIFEATURE_LABELS[entry.type] || entry.type;
  const description = entry.description ? ` - ${entry.description}` : '';
  const locale = entry.locale ? ` [${entry.locale}]` : '';
  return `${label}${description}${locale}`;
}

/**
 * Walk the script's declared grants and return the Chrome optional
 * permission tokens that should be requested at install time. Returns an
 * empty array when the script doesn't need any — short-circuits the
 * permission prompt entirely so the common install path is unchanged.
 */
function getRequiredOptionalPermissions(meta) {
  if (!meta || !Array.isArray(meta.grant)) return [];
  const seen = new Set();
  const tokens = [];
  for (const grant of meta.grant) {
    const token = OPTIONAL_GRANT_PERMISSION_MAP[grant];
    if (!token || seen.has(token)) continue;
    seen.add(token);
    tokens.push(token);
  }
  return tokens;
}

/**
 * Inspect which optional permissions are already granted and request the
 * rest. Returns a structured result that the install trust receipt will
 * persist so users can see later which prompts they accepted.
 *
 * IMPORTANT: this must be called inside the same call stack as the install
 * button click. Chrome enforces a user-gesture requirement on
 * `chrome.permissions.request` — calling it after an `await` boundary that
 * crosses a non-user-gesture promise resolution will reject with
 * `This function must be called during a user gesture`.
 */
async function ensureOptionalPermissions(tokens) {
  const result = { requested: tokens.slice(), granted: [], denied: [], unavailable: [] };
  if (!tokens.length) return result;
  if (!chrome.permissions || !chrome.permissions.request) {
    result.unavailable = tokens.slice();
    return result;
  }
  // Check which tokens are already granted
  const needed = [];
  for (const token of tokens) {
    let already = false;
    try {
      already = !!(await chrome.permissions.contains({ permissions: [token] }));
    } catch {
      already = false;
    }
    if (already) {
      result.granted.push(token);
    } else {
      needed.push(token);
    }
  }
  // Batch all needed permissions into a single request to preserve user gesture
  if (needed.length > 0) {
    let approved = false;
    try {
      approved = !!(await chrome.permissions.request({ permissions: needed }));
    } catch {
      approved = false;
    }
    if (approved) {
      result.granted.push(...needed);
    } else {
      result.denied.push(...needed);
    }
  }
  return result;
}

function uniqueStrings(values) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function addOptionalHostOrigin(target, scheme, host) {
  const cleanScheme = String(scheme || '').replace(/:$/, '').toLowerCase();
  const cleanHost = String(host || '').trim().toLowerCase().replace(/:(\d{1,5})$/, '');
  if (!['http', 'https'].includes(cleanScheme) || !cleanHost) return;
  target.add(`${cleanScheme}://${cleanHost}/*`);
}

function addBroadHostOrigin(target, scheme = '*') {
  const cleanScheme = String(scheme || '*').replace(/:$/, '').toLowerCase();
  if (cleanScheme === '*') {
    OPTIONAL_BROAD_HOST_ORIGINS.forEach(origin => target.add(origin));
  } else if (['http', 'https'].includes(cleanScheme)) {
    target.add(`${cleanScheme}://*/*`);
  }
}

function addHostMatchPattern(pattern, origins, broadOrigins, unsupported) {
  const raw = String(pattern || '').trim();
  if (!raw) return;
  if (raw === '<all_urls>' || raw === '*://*/*') {
    addBroadHostOrigin(broadOrigins);
    return;
  }
  const match = raw.match(/^(\*|https?|file|ftp):\/\/([^/]+)(?:\/.*)?$/i);
  if (!match) {
    unsupported.add(raw);
    return;
  }
  const scheme = String(match[1] || '').toLowerCase();
  const host = String(match[2] || '').toLowerCase();
  if (scheme === 'file' || scheme === 'ftp') {
    unsupported.add(raw);
    return;
  }
  if (host === '*') {
    addBroadHostOrigin(broadOrigins, scheme);
    return;
  }
  if (scheme === '*') {
    addOptionalHostOrigin(origins, 'http', host);
    addOptionalHostOrigin(origins, 'https', host);
    return;
  }
  addOptionalHostOrigin(origins, scheme, host);
}

function addHostUrlOrigin(rawUrl, origins, unsupported) {
  const raw = String(rawUrl || '').trim();
  if (!raw) return;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      unsupported.add(raw);
      return;
    }
    addOptionalHostOrigin(origins, parsed.protocol, parsed.hostname);
  } catch {
    unsupported.add(raw);
  }
}

function addHostConnectPattern(pattern, origins, broadOrigins, unsupported) {
  const raw = String(pattern || '').trim();
  if (!raw || raw === 'self') return;
  if (raw === '*' || raw === '<all_urls>' || raw === '*://*/*') {
    addBroadHostOrigin(broadOrigins);
    return;
  }
  if (/^(?:\*|https?):\/\//i.test(raw)) {
    addHostMatchPattern(raw.endsWith('/*') || raw.includes('/', raw.indexOf('://') + 3) ? raw : `${raw}/*`, origins, broadOrigins, unsupported);
    return;
  }
  const host = raw.replace(/\/.*$/, '').toLowerCase();
  if (!host || /[\s?#]/.test(host)) {
    unsupported.add(raw);
    return;
  }
  addOptionalHostOrigin(origins, 'http', host);
  addOptionalHostOrigin(origins, 'https', host);
}

function asArray(value) {
  return Array.isArray(value) ? value : (value ? [value] : []);
}

function deriveOptionalHostPermissionPlan(meta, options) {
  options = options || {};
  const origins = new Set();
  const broadOrigins = new Set();
  const unsupported = new Set();
  const source = meta || {};
  asArray(source.match).forEach(pattern => addHostMatchPattern(pattern, origins, broadOrigins, unsupported));
  asArray(source.include).forEach(pattern => addHostMatchPattern(pattern, origins, broadOrigins, unsupported));
  asArray(source.matchTop).forEach(pattern => addHostMatchPattern(pattern, origins, broadOrigins, unsupported));
  asArray(source.connect).forEach(pattern => addHostConnectPattern(pattern, origins, broadOrigins, unsupported));
  asArray(source.require).forEach(url => addHostUrlOrigin(url, origins, unsupported));
  Object.values(source.resource || {}).forEach(url => addHostUrlOrigin(url, origins, unsupported));
  addHostUrlOrigin(source.updateURL, origins, unsupported);
  addHostUrlOrigin(source.downloadURL, origins, unsupported);
  if (options.allowBroad) {
    broadOrigins.forEach(origin => origins.add(origin));
  }
  return {
    origins: uniqueStrings(Array.from(origins)),
    broadOrigins: uniqueStrings(Array.from(broadOrigins)),
    unsupported: uniqueStrings(Array.from(unsupported)),
    requiresBroadHostAccess: broadOrigins.size > 0
  };
}

async function ensureOptionalHostPermissions(origins) {
  const result = { requested: origins.slice(), granted: [], denied: [], unavailable: [] };
  if (!origins.length) return result;
  if (!chrome.permissions || !chrome.permissions.request) {
    result.unavailable = origins.slice();
    return result;
  }
  const needed = [];
  for (const origin of origins) {
    let already = false;
    try {
      already = !!(await chrome.permissions.contains({ origins: [origin] }));
    } catch {
      already = false;
    }
    if (already) {
      result.granted.push(origin);
    } else {
      needed.push(origin);
    }
  }
  if (needed.length > 0) {
    let approved = false;
    try {
      approved = !!(await chrome.permissions.request({ origins: needed }));
    } catch {
      approved = false;
    }
    if (approved) {
      result.granted.push(...needed);
    } else {
      result.denied.push(...needed);
    }
  }
  return result;
}

// CodeMirror theme mapping per dashboard theme
const CM_THEME_MAP = {
  dark: 'monokai',
  light: 'default',
  catppuccin: 'dracula',
  oled: 'monokai'
};

let scriptCode = '';
let scriptMeta = null;
let existingScript = null;
let codeEditor = null;
let autoUpdate = true;
let enableOnInstall = true;
let allowBroadHostAccess = false;
let installSourceUrl = '';
let signatureVerification = null;
const numberFormatter = new Intl.NumberFormat();
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit'
});
let analysisDecisionState = {
  label: 'Scanning',
  tone: 'neutral',
  detail: 'Static analysis is running in the background.'
};
let dependencyDecisionState = {
  label: 'Pending',
  tone: 'neutral',
  detail: 'Dependency checks have not started yet.'
};
let provenanceDecisionState = {
  label: 'Pending',
  tone: 'neutral',
  detail: 'Dependency provenance checks have not started yet.'
};
let signatureDecisionState = {
  label: 'Reviewing',
  tone: 'neutral',
  detail: 'Checking embedded signature and signer trust.'
};
let cancelReviewArmed = false;
let cancelReviewTimer = null;
let reviewExitGuardActive = false;
let suppressExitGuard = false;

function openHelpDashboard() {
  chrome.tabs.create({ url: chrome.runtime.getURL('pages/dashboard.html#tab=help') });
}

function setReviewExitGuard(active) {
  reviewExitGuardActive = active;
  if (!active) {
    suppressExitGuard = false;
  }
}

function allowInstallExitOnce() {
  suppressExitGuard = true;
}

function getDecisionToneClass(tone) {
  if (tone === 'good') return 'status-good';
  if (tone === 'warn') return 'status-warn';
  return 'status-neutral';
}

function updateDecisionBadge(id, state) {
  const badge = document.getElementById(id);
  if (!badge) return;
  badge.textContent = state.label;
  badge.className = `count ${getDecisionToneClass(state.tone)}`;
  if (state.detail) {
    badge.title = state.detail;
  } else {
    badge.removeAttribute('title');
  }
}

function updateDecisionHint() {
  const presentation = getInstallPresentation();
  const hint = document.getElementById('decisionHint');
  if (!hint) return;
  hint.textContent = cancelReviewArmed
    ? 'Press Cancel again to discard this review, or wait a few seconds to keep reviewing.'
    : `Press Enter to ${presentation.isUpdate ? 'update' : presentation.isDowngrade ? 'downgrade' : presentation.isReinstall ? 'reinstall' : 'install'} when the install button is focused. Press Esc to arm cancel.`;
}

function setCancelReviewArmed(armed) {
  cancelReviewArmed = armed;
  if (cancelReviewTimer) {
    clearTimeout(cancelReviewTimer);
    cancelReviewTimer = null;
  }
  const cancelButton = document.getElementById('btn-cancel');
  if (cancelButton) {
    cancelButton.textContent = armed ? 'Discard Review' : 'Cancel';
    cancelButton.classList.toggle('is-armed', armed);
  }
  updateDecisionHint();
  if (armed) {
    cancelReviewTimer = setTimeout(() => setCancelReviewArmed(false), 5000);
  }
}

function updateDecisionStates() {
  updateDecisionBadge('decisionRiskState', analysisDecisionState);
  updateDecisionBadge('decisionDependencyState', dependencyDecisionState);
  updateDecisionBadge('decisionProvenanceState', provenanceDecisionState);
  updateDecisionBadge('decisionSignatureState', signatureDecisionState);
  updateDecisionHero();
}

function getDecisionHeroState() {
  const states = [analysisDecisionState, dependencyDecisionState, provenanceDecisionState, signatureDecisionState];
  const hasPendingCheck = states.some((state) => {
    const label = String(state?.label || '');
    return state?.tone === 'neutral' && /(Scanning|Checking|Verifying|Pending|Reviewing)/i.test(label);
  });

  if (hasPendingCheck) {
    return {
      tone: 'neutral',
      badge: 'In review',
      title: 'Checks are still running',
      copy: 'ScriptVault is still checking this script. You can keep reviewing permissions, scope, source, and code. The final checks will update here.'
    };
  }

  if (analysisDecisionState.tone === 'warn') {
    return {
      tone: 'warn',
      badge: 'Needs review',
      title: 'Proceed with caution',
      copy: analysisDecisionState.detail || 'Review these items first.'
    };
  }

  if (dependencyDecisionState.tone === 'warn') {
    return {
      tone: 'warn',
      badge: 'Dependency issue',
      title: 'Dependency checks failed',
      copy: dependencyDecisionState.detail || 'Some dependency checks failed. Review them before you install.'
    };
  }

  if (provenanceDecisionState.tone === 'warn') {
    return {
      tone: 'warn',
      badge: 'Provenance issue',
      title: 'Dependency provenance needs review',
      copy: provenanceDecisionState.detail || 'One or more @require provenance checks failed or did not finish. Review them before you install.'
    };
  }

  if (signatureDecisionState.tone === 'warn') {
    return {
      tone: 'warn',
      badge: 'Signature warning',
      title: 'Signer trust needs attention',
      copy: signatureDecisionState.detail || 'A signature check found a warning. Review the signer before you install.'
    };
  }

  if (
    signatureDecisionState.label === 'Trusted' &&
    analysisDecisionState.tone === 'good' &&
    dependencyDecisionState.tone === 'good' &&
    provenanceDecisionState.tone !== 'warn'
  ) {
    return {
      tone: 'good',
      badge: 'Ready',
      title: 'Ready to install',
      copy: 'The scans, dependency checks, provenance, and signer trust all look good.'
    };
  }

  if (signatureDecisionState.label === 'Valid') {
    return {
      tone: 'neutral',
      badge: 'Review signer',
      title: 'Install looks clean so far',
      copy: 'The signature is valid, but this signer is not trusted in ScriptVault yet.'
    };
  }

  if (signatureDecisionState.label === 'Unsigned') {
    return {
      tone: 'neutral',
      badge: 'Unsigned',
      title: 'Manual review recommended',
      copy: 'This script does not declare an embedded signature, so source and code review matter more here.'
    };
  }

  if (analysisDecisionState.tone === 'good' && dependencyDecisionState.tone !== 'warn') {
    return {
      tone: 'good',
      badge: 'Review complete',
      title: 'Ready for your decision',
      copy: 'ScriptVault finished its checks. Review the install options and decide how you want this script to land.'
    };
  }

  return {
    tone: 'neutral',
    badge: 'Review',
    title: 'Keep reviewing',
    copy: 'ScriptVault has enough detail to proceed, but this install still deserves a quick manual review.'
  };
}

function updateDecisionHero() {
  const hero = document.getElementById('decisionHero');
  const badge = document.getElementById('decisionHeroBadge');
  const title = document.getElementById('decisionHeroTitle');
  const copy = document.getElementById('decisionHeroCopy');
  if (!hero || !badge || !title || !copy) return;

  const state = getDecisionHeroState();
  hero.dataset.tone = state.tone;
  badge.textContent = state.badge;
  title.textContent = state.title;
  copy.textContent = state.copy;
}

async function init() {
  applyInstallI18n();
  document.getElementById('btnHelp')?.addEventListener('click', openHelpDashboard);

  window.addEventListener('beforeunload', (event) => {
    if (!reviewExitGuardActive || suppressExitGuard) return;
    event.preventDefault();
    event.returnValue = '';
  });

  // Event delegation for icon error handling (CSP-compliant)
  document.addEventListener('error', function(e) {
    if (e.target.tagName === 'IMG' && e.target.hasAttribute('data-icon-fallback')) {
      const fallback = e.target.getAttribute('data-icon-fallback');
      e.target.style.display = 'none';
      if (e.target.parentElement && fallback) {
        e.target.parentElement.textContent = fallback;
      }
    }
  }, true);

  // Phase 39.27 — VM #2491 incognito short-circuit.
  // Visiting *.user.js in a private window when the extension is not
  // allowed in incognito crashes VM's install flow. We probe up-front: if
  // we are in incognito context, chrome.runtime.sendMessage may still work
  // (extension *is* allowed in incognito) — but the test of allowed-ness
  // is whether chrome.storage.local responds within a short timeout. If it
  // doesn't, render a static guidance page with a deep-link to the
  // per-extension toggle and skip the rest of init() entirely.
  const isIncognito = !!(chrome?.extension?.inIncognitoContext);
  if (isIncognito) {
    try {
      const probe = await Promise.race([
        chrome.storage.local.get('__sv_incognito_probe__'),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 1500))
      ]);
      // Probe succeeded — incognito access is granted, continue normal init.
      void probe;
    } catch (_e) {
      // Probe failed / timed out — extension is loaded in private window but
      // can't reach storage. Render guidance and bail.
      const content = document.getElementById('content');
      if (content) {
        const extId = (typeof chrome?.runtime?.id === 'string') ? chrome.runtime.id : '';
        const detailsHref = extId ? `chrome://extensions/?id=${encodeURIComponent(extId)}` : 'chrome://extensions/';
        safeSetHtml(content, `
          <div class="install-terminal error" role="alert" aria-live="assertive" aria-atomic="true" aria-labelledby="installTerminalTitle" aria-describedby="installTerminalMessage">
            <div class="install-state-mark is-warning error-icon" aria-hidden="true">!</div>
            <div class="error-title" id="installTerminalTitle">ScriptVault is not allowed in private windows</div>
            <div class="error-message" id="installTerminalMessage">This script cannot be installed from an incognito window until ScriptVault is allowed to use extension storage there. Enable <strong>Allow in Incognito</strong>, then re-open the script URL, or install from a regular window.</div>
            <div class="error-actions actions">
              <a class="btn btn-secondary" href="${escapeHtml(detailsHref)}" target="_blank" rel="noopener">Open Extension Details</a>
            </div>
          </div>
        `);
      }
      return;
    }
  }

  const content = document.getElementById('content');

  try {
    await applySavedTheme();

    // Get pending install data
    const data = await chrome.storage.local.get('pendingInstall');

    if (!data.pendingInstall) {
      showError('No userscript was found', 'ScriptVault could not find a pending install request. Download the userscript again from its source page.');
      return;
    }

    // Handle fetch error from background
    if (data.pendingInstall.error) {
      showError('Failed to download script', data.pendingInstall.error);
      chrome.storage.local.remove('pendingInstall');
      return;
    }

    // Reject stale pendingInstall (older than 5 minutes)
    if (data.pendingInstall.timestamp && Date.now() - data.pendingInstall.timestamp > 300000) {
      showError('Install expired', 'This install request is too old. Please try downloading the script again.');
      chrome.storage.local.remove('pendingInstall');
      return;
    }

    scriptCode = data.pendingInstall.code;
    const sourceUrl = data.pendingInstall.url || '';
    installSourceUrl = sourceUrl;

    if (!scriptCode) {
      showError('Empty script', 'The downloaded script was empty.');
      chrome.storage.local.remove('pendingInstall');
      return;
    }

    // Parse metadata
    scriptMeta = parseMetadata(scriptCode);

    if (!scriptMeta) {
      showError('Invalid userscript', 'No valid userscript metadata block found.');
      chrome.storage.local.remove('pendingInstall');
      return;
    }

    // Check if script already exists
    const response = await chrome.runtime.sendMessage({ action: 'getScripts' });
    const scripts = response?.scripts || [];
    existingScript = scripts.find(s =>
      s && s.meta && s.meta.name === scriptMeta.name &&
      (s.meta.namespace === scriptMeta.namespace || (!s.meta.namespace && !scriptMeta.namespace))
    );
    allowBroadHostAccess = existingScript?.settings?.allowBroadHostAccess === true;

    // Render the install UI
    renderInstallUI(sourceUrl);

    // Run static analysis in background
    runStaticAnalysis(scriptCode);

  } catch (e) {
    console.error('Install error:', e);
    showError('Error loading script', e.message);
  }
}

async function applySavedTheme() {
  try {
    const settings = await chrome.runtime.sendMessage({ action: 'getSettings' });
    const themeSettings = settings?.settings || settings || {};
    const layoutPref = themeSettings.layout || 'dark';
    const theme = layoutPref === 'auto'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : layoutPref;
    document.documentElement.setAttribute('data-theme', theme);
    if (layoutPref === 'auto') {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      });
    }
  } catch (e) {
    console.warn('Theme settings unavailable; defaulting install page to dark theme.', e);
    document.documentElement.setAttribute('data-theme', 'dark');
  }
}

function parseMetadata(code) {
  const match = code.match(/\/\/\s*==UserScript==([\s\S]*?)\/\/\s*==\/UserScript==/);
  if (!match) return null;

  const meta = {
    name: 'Unknown Script',
    namespace: '',
    version: '1.0.0',
    description: '',
    author: '',
    homepage: '',
    homepageURL: '',
    supportURL: '',
    updateURL: '',
    downloadURL: '',
    icon: '',
    icon64: '',
    license: '',
    match: [],
    include: [],
    exclude: [],
    'exclude-match': [],
    grant: [],
    require: [],
    requireProvenance: [],
    requireIdentity: [],
    resource: {},
    'run-at': 'document-idle',
    noframes: false,
    connect: [],
    antifeature: [],
    tag: [],
    'run-in': '',
    'inject-into': 'auto',
    'top-level-await': false
  };

  const lines = match[1].split('\n');
  for (const line of lines) {
    const m = line.match(/\/\/\s*@(\S+)(?:\s+(.*))?/);
    if (!m) continue;

    const [, key, value] = m;
    const val = (value || '').trim();

    if (key === 'noframes' || key === 'unwrap' || key === 'nodownload') {
      meta[key] = true;
    } else if (key === 'delay') {
      meta.delay = Math.max(0, parseInt(val, 10) || 0);
    } else if (key === 'top-level-await') {
      meta['top-level-await'] = true;
    } else if (key === 'antifeature' || key.startsWith('antifeature:')) {
      const locale = key.startsWith('antifeature:') ? key.slice('antifeature:'.length) : '';
      const parsedAntifeature = parseAntifeatureDirective(val, locale);
      if (parsedAntifeature) meta.antifeature.push(parsedAntifeature);
    } else if (key === 'resource') {
      const resourceMatch = val.match(/^(\S+)\s+(.+)$/);
      if (resourceMatch && !['__proto__', 'constructor', 'prototype'].includes(resourceMatch[1])) {
        meta.resource[resourceMatch[1]] = resourceMatch[2];
      }
    } else if (key === 'require-provenance') {
      // Hyphenated directive maps to the camelCase field the provenance UI
      // reads; matches the background parser's alias so the install review can
      // actually verify declared Sigstore bundles.
      if (val) meta.requireProvenance.push(val);
    } else if (key === 'require-identity') {
      if (val) meta.requireIdentity.push(val);
    } else if (Object.prototype.hasOwnProperty.call(meta, key) && Array.isArray(meta[key])) {
      meta[key].push(val);
    } else if (Object.prototype.hasOwnProperty.call(meta, key)) {
      meta[key] = val;
    }
  }

  // Normalize homepage
  meta.homepage = meta.homepage || meta.homepageURL;

  return meta;
}

function getInstallPresentation() {
  const currentVersion = existingScript?.meta?.version || '0.0.0';
  const incomingVersion = scriptMeta?.version || '0.0.0';
  const comparison = existingScript ? compareVersions(incomingVersion, currentVersion) : 0;
  const isUpdate = existingScript ? comparison > 0 : false;
  const isDowngrade = existingScript ? comparison < 0 : false;
  const isReinstall = existingScript ? comparison === 0 : false;
  const versionChange = existingScript ? `${currentVersion} \u2192 ${incomingVersion}` : '';

  if (isUpdate) {
    return {
      isUpdate,
      isDowngrade,
      isReinstall,
      currentVersion,
      incomingVersion,
      versionChange,
      badgeHtml: '<span class="update-badge">Update Available</span>',
      installLabel: 'Update Script',
      installClass: 'btn-update',
      modeLabel: 'Update',
      summaryLabel: versionChange
    };
  }

  if (isDowngrade) {
    return {
      isUpdate,
      isDowngrade,
      isReinstall,
      currentVersion,
      incomingVersion,
      versionChange,
      badgeHtml: '<span class="downgrade-badge">Downgrade</span>',
      installLabel: 'Downgrade Script',
      installClass: 'btn-downgrade',
      modeLabel: 'Downgrade',
      summaryLabel: versionChange
    };
  }

  if (isReinstall) {
    return {
      isUpdate,
      isDowngrade,
      isReinstall,
      currentVersion,
      incomingVersion,
      versionChange,
      badgeHtml: '<span class="reinstall-badge">Reinstall</span>',
      installLabel: 'Reinstall Script',
      installClass: 'btn-primary',
      modeLabel: 'Reinstall',
      summaryLabel: `v${incomingVersion}`
    };
  }

  return {
    isUpdate,
    isDowngrade,
    isReinstall,
    currentVersion,
    incomingVersion,
    versionChange,
    badgeHtml: '',
    installLabel: 'Install Script',
    installClass: 'btn-primary',
    modeLabel: 'New Install',
    summaryLabel: `v${incomingVersion}`
  };
}

function getSourceSummary(sourceUrl) {
  if (!sourceUrl) {
    return { host: 'Local file', label: 'Local file', shortLabel: 'Opened from a local file', safeUrl: '' };
  }

  try {
    const url = new URL(sourceUrl);
    const shortPath = url.pathname.length > 28 ? `${url.pathname.slice(0, 28)}…` : url.pathname;
    return {
      host: url.host,
      label: url.toString(),
      shortLabel: `${url.host}${shortPath || ''}`,
      safeUrl: sanitizeUrl(url.toString()) || ''
    };
  } catch {
    return {
      host: 'Remote source',
      label: sourceUrl,
      shortLabel: truncateUrl(sourceUrl),
      safeUrl: sanitizeUrl(sourceUrl) || ''
    };
  }
}

function renderExternalLink(url, label = truncateUrl(url)) {
  const safeUrl = sanitizeUrl(url);
  if (!url) return '-';
  return safeUrl
    ? `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`
    : escapeHtml(url);
}

function renderExpandablePatternSection(sectionId, title, items, visibleCount) {
  if (!items.length) return '';
  const overflowItems = items.slice(visibleCount);
  const overflowId = `${sectionId}-overflow`;
  const toggleId = `${sectionId}-toggle`;

  return `
    <div class="section" data-expandable-section="${sectionId}">
      <div class="section-title">
        <span>${escapeHtml(title)}</span>
        <span class="count">${numberFormatter.format(items.length)}</span>
      </div>
      <div class="match-list">
        ${items.slice(0, visibleCount).map(item => `<div class="match-item">${escapeHtml(item)}</div>`).join('')}
        ${overflowItems.length > 0 ? `
          <div class="match-list-overflow" id="${overflowId}" hidden>
            ${overflowItems.map(item => `<div class="match-item">${escapeHtml(item)}</div>`).join('')}
          </div>
        ` : ''}
      </div>
      ${overflowItems.length > 0 ? `
        <div class="match-list-actions">
          <button
            class="match-list-toggle"
            id="${toggleId}"
            type="button"
            aria-expanded="false"
            aria-controls="${overflowId}"
            data-show-label="Show ${numberFormatter.format(overflowItems.length)} more"
            data-hide-label="Show fewer"
          >Show ${numberFormatter.format(overflowItems.length)} more</button>
        </div>
      ` : ''}
    </div>
  `;
}

function extractSignatureInfo(code) {
  const match = code.match(/\/\/\s*@signature\s+([^\n]+)/);
  if (!match) return null;
  const parts = match[1].trim().split('|');
  if (parts.length < 2) return null;
  return {
    signature: parts[0],
    publicKey: parts[1],
    timestamp: parts[2] ? parseInt(parts[2], 10) : null
  };
}

function getProvenanceSummary(sourceUrl, meta) {
  const installSource = getSourceSummary(sourceUrl);
  const updateUrl = meta.updateURL || '';
  const downloadUrl = meta.downloadURL || '';
  const homepageUrl = meta.homepage || meta.homepageURL || '';
  const comparisonUrl = updateUrl || downloadUrl || installSource.label;
  let label = installSource.host;
  let detail = sourceUrl
    ? 'Review where this script came from. Check the update channel before you trust future updates.'
    : 'This review started from a local file rather than a remote install page.';

  if (/greasyfork\.org/i.test(comparisonUrl)) {
    label = 'Greasy Fork';
    detail = 'Install and update provenance points at a Greasy Fork listing or payload.';
  } else if (/openuserjs\.org/i.test(comparisonUrl)) {
    label = 'OpenUserJS';
    detail = 'Install and update provenance points at OpenUserJS.';
  } else if (/(github\.com|raw\.githubusercontent\.com)/i.test(comparisonUrl)) {
    label = 'GitHub';
    detail = 'Install or update metadata points at GitHub-hosted source.';
  } else if (/gitlab\.com/i.test(comparisonUrl)) {
    label = 'GitLab';
    detail = 'Install or update metadata points at GitLab-hosted source.';
  }

  if (sourceUrl && updateUrl) {
    try {
      const installHost = new URL(sourceUrl).host;
      const updateHost = new URL(updateUrl).host;
      if (installHost !== updateHost) {
        detail = `Installed from ${installHost}, but future updates come from ${updateHost}.`;
      }
    } catch {}
  }

  if (!sourceUrl && (updateUrl || downloadUrl)) {
    detail = 'Local install with a remote update channel declared in metadata.';
  }

  // Surface a source-registry change when the user is updating a script and
  // the new install URL classifies to a different known registry than the
  // existing record. Existing script lookup is shared with `pages/install.js`
  // confirmation flow; we re-derive the classification here to avoid
  // round-tripping through background for an idempotent computation.
  let sourceChange = null;
  if (typeof classifyInstallSource === 'function' && existingScript?.installSource?.id) {
    const newSource = classifyInstallSource(sourceUrl || downloadUrl || updateUrl || '');
    if (newSource.id !== 'local' && newSource.id !== existingScript.installSource.id) {
      sourceChange = {
        previous: existingScript.installSource,
        next: newSource
      };
    }
  }

  return {
    label,
    detail,
    installSource,
    updateUrl,
    downloadUrl,
    homepageUrl,
    sourceChange
  };
}

function renderTrustCard(sourceUrl) {
  const mount = document.getElementById('trustMount');
  if (!mount || !scriptMeta) return;
  const provenance = getProvenanceSummary(sourceUrl, scriptMeta);
  const verification = signatureVerification;
  const signatureState = verification?.valid
    ? verification.trusted
      ? {
          label: verification.trustedName ? `Trusted as ${verification.trustedName}` : 'Trusted signer',
          badge: 'Trusted',
          tone: 'status-good',
          detail: verification.timestamp ? `Signed ${dateTimeFormatter.format(new Date(verification.timestamp))}.` : 'Signature is valid and the signing key is trusted.'
        }
      : {
          label: 'Valid signature',
          badge: 'Review signer',
          tone: 'status-neutral',
          detail: 'This script is signed, but the signing key is not yet trusted in ScriptVault.'
        }
    : verification
      ? {
          label: verification.reason === 'No signature found in script' ? 'Unsigned script' : 'Signature warning',
          badge: verification.reason === 'No signature found in script' ? 'Unsigned' : 'Warning',
          tone: verification.reason === 'No signature found in script' ? 'status-neutral' : 'status-warn',
          detail: verification.reason || 'Signature verification did not complete cleanly.'
        }
      : {
          label: 'Checking signature',
          badge: 'Scanning',
          tone: 'status-neutral',
          detail: 'ScriptVault is checking the embedded signature and signer trust.'
        };

  safeSetHtml(mount, `
    <div class="install-card-header">
      <div>
        <div class="install-card-title">Source & Trust</div>
        <div class="install-card-subtitle">Review where this script came from and whether you trust its signer.</div>
      </div>
      <span class="count ${signatureState.tone}">${escapeHtml(signatureState.badge)}</span>
    </div>
    <div class="trust-grid">
      <div class="trust-row">
        <div class="trust-copy">
          <strong>Provenance</strong>
          <span>${escapeHtml(provenance.detail)}</span>
        </div>
        <span class="count status-neutral">${escapeHtml(provenance.label)}</span>
      </div>
      <div class="trust-row">
        <div class="trust-copy">
          <strong>Install source</strong>
          <span>${provenance.installSource.shortLabel ? escapeHtml(provenance.installSource.shortLabel) : 'Local file'}</span>
        </div>
        <span class="trust-link">${provenance.installSource.safeUrl ? renderExternalLink(provenance.installSource.label, 'Open') : 'Local'}</span>
      </div>
      ${provenance.sourceChange ? `
        <div class="trust-row" role="alert">
          <div class="trust-copy">
            <strong>Source registry changed</strong>
            <span>Previous install came from ${escapeHtml(provenance.sourceChange.previous.name)} (${escapeHtml(provenance.sourceChange.previous.hostname || '—')}). This update is from ${escapeHtml(provenance.sourceChange.next.name)} (${escapeHtml(provenance.sourceChange.next.hostname || '—')}). Confirm you trust the new origin before installing.</span>
          </div>
          <span class="count status-warn">Review</span>
        </div>
      ` : ''}
      ${provenance.updateUrl ? `
        <div class="trust-row">
          <div class="trust-copy">
            <strong>Update channel</strong>
            <span>${escapeHtml(truncateUrl(provenance.updateUrl))}</span>
          </div>
          <span class="trust-link">${renderExternalLink(provenance.updateUrl, 'Open')}</span>
        </div>
      ` : ''}
      ${provenance.downloadUrl && provenance.downloadUrl !== provenance.updateUrl ? `
        <div class="trust-row">
          <div class="trust-copy">
            <strong>Download channel</strong>
            <span>${escapeHtml(truncateUrl(provenance.downloadUrl))}</span>
          </div>
          <span class="trust-link">${renderExternalLink(provenance.downloadUrl, 'Open')}</span>
        </div>
      ` : ''}
      ${provenance.homepageUrl ? `
        <div class="trust-row">
          <div class="trust-copy">
            <strong>Homepage</strong>
            <span>${escapeHtml(truncateUrl(provenance.homepageUrl))}</span>
          </div>
          <span class="trust-link">${renderExternalLink(provenance.homepageUrl, 'Open')}</span>
        </div>
      ` : ''}
      <div class="trust-row">
        <div class="trust-copy">
          <strong>Signature status</strong>
          <span>${escapeHtml(signatureState.label)}</span>
        </div>
        <span class="count ${signatureState.tone}">${escapeHtml(signatureVerification?.publicKey ? `${signatureVerification.publicKey.slice(0, 10)}…` : signatureState.badge)}</span>
      </div>
    </div>
    ${signatureState.detail ? `<div class="analysis-summary" style="margin-top:14px">${escapeHtml(signatureState.detail)}</div>` : ''}
    ${verification?.valid && !verification.trusted && verification.publicKey ? `
      <div class="trust-actions">
        <button class="btn btn-secondary" id="btnTrustSigner" type="button">Trust signer</button>
      </div>
    ` : ''}
  `);

  document.getElementById('btnTrustSigner')?.addEventListener('click', async () => {
    const trustName = scriptMeta.author || scriptMeta.name || provenance.label;
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'signing_trustKey',
        data: { publicKey: verification.publicKey, name: trustName }
      });
      if (response?.error) {
        showInstallError(response.error);
        return;
      }
      await runSignatureVerification(sourceUrl);
    } catch (error) {
      showInstallError(error?.message || 'Failed to trust signer');
    }
  });
}

function formatRunTiming(meta) {
  const parts = [meta['run-at'] || 'document-idle'];
  if (meta.noframes) parts.push('top frame only');
  if (meta.delay) parts.push(`delay ${numberFormatter.format(meta.delay)}ms`);
  if (meta.nodownload) parts.push('manual updates only');
  // @unwrap warning surface — script ships without the GM API wrapper.
  if (meta.unwrap) parts.push('unwrapped (no GM_* APIs)');
  return parts.join(' • ');
}

function buildInstallAlert(tone, title, body) {
  return `
    <div class="install-alert ${tone}">
      <div class="install-alert-header">
        <span>${tone === 'is-danger' ? '!' : tone === 'is-warning' ? '!' : 'i'}</span>
        <span>${escapeHtml(title)}</span>
      </div>
      <div class="install-alert-body">${body}</div>
    </div>
  `;
}

function updateDecisionSummary() {
  const decisionEnableState = document.getElementById('decisionEnableState');
  if (decisionEnableState) {
    decisionEnableState.textContent = enableOnInstall ? 'Enabled immediately' : 'Installed disabled';
  }

  const decisionUpdateState = document.getElementById('decisionUpdateState');
  if (decisionUpdateState) {
    decisionUpdateState.textContent = autoUpdate ? 'Automatic' : 'Manual only';
  }

  updateDecisionStates();
  updateDecisionHint();
}

function renderInstallUI(sourceUrl) {
  const content = document.getElementById('content');
  const badge = document.getElementById('install-type-badge');
  // Defensive: the install page HTML could be out of sync with this renderer
  // (corrupted cache, user-modified pages/install.html, future refactor); a
  // null here used to throw and leave the install page blank with no feedback.
  if (!content || !badge) {
    showInstallError('Install page is missing required UI. Please reload.');
    return;
  }
  const presentation = getInstallPresentation();
  setReviewExitGuard(true);
  safeSetHtml(badge, presentation.badgeHtml);

  const matches = [...scriptMeta.match, ...scriptMeta.include];
  const excludes = [...scriptMeta.exclude, ...scriptMeta['exclude-match']];
  const grants = scriptMeta.grant.length > 0 ? scriptMeta.grant : ['none'];
  const hostPermissionPlan = deriveOptionalHostPermissionPlan(scriptMeta, { allowBroad: allowBroadHostAccess });
  const dangerousPermissions = scriptMeta.grant.filter(g => DANGEROUS_PERMISSIONS.includes(g));
  const hasDangerousPerms = dangerousPermissions.length > 0;
  const resourceCount = scriptMeta.require.length + Object.keys(scriptMeta.resource).length;
  const lineCount = scriptCode.split('\n').length;
  const codeSize = scriptCode.length;
  const iconUrl = scriptMeta.icon64 || scriptMeta.icon;
  const source = getSourceSummary(sourceUrl);
  const dependencyCount = scriptMeta.require.length;
  const hasRequireProvenance = (scriptMeta.requireProvenance || []).length > 0 || (scriptMeta.requireIdentity || []).length > 0;
  const hasUpdater = Boolean(scriptMeta.updateURL || scriptMeta.downloadURL);
  const hasSignature = Boolean(extractSignatureInfo(scriptCode));
  analysisDecisionState = {
    label: 'Scanning',
    tone: 'neutral',
    detail: 'Static analysis is still running.'
  };
  dependencyDecisionState = dependencyCount > 0
    ? {
        label: `Checking ${numberFormatter.format(dependencyCount)}`,
        tone: 'neutral',
        detail: 'Verifying each @require URL before install.'
      }
    : {
        label: 'None declared',
        tone: 'good',
        detail: 'No external @require dependencies were declared.'
      };
  provenanceDecisionState = dependencyCount > 0
    ? hasRequireProvenance
      ? {
          label: 'Checking',
          tone: 'neutral',
          detail: 'Verifying declared Sigstore provenance for @require dependencies.'
        }
      : {
          label: 'Not declared',
          tone: 'neutral',
          detail: 'No @require-provenance metadata was declared for these dependencies.'
        }
    : {
        label: 'None declared',
        tone: 'good',
        detail: 'No external @require dependencies were declared.'
      };
  signatureDecisionState = hasSignature
    ? {
        label: 'Verifying',
        tone: 'neutral',
        detail: 'Checking the embedded signature and signer trust.'
      }
    : {
        label: 'Unsigned',
        tone: 'neutral',
        detail: 'No embedded @signature metadata was found.'
      };
  signatureVerification = null;
  const summaryCards = [
    {
      label: 'Source',
      value: source.host,
      meta: source.shortLabel
    },
    {
      label: 'Permissions',
      value: scriptMeta.grant.length > 0 ? `${numberFormatter.format(scriptMeta.grant.length)} requested` : 'No special grants',
      meta: hasDangerousPerms
        ? `${numberFormatter.format(dangerousPermissions.length)} elevated permission${dangerousPermissions.length === 1 ? '' : 's'} need review`
        : 'Metadata only asks for low-risk userscript APIs'
    },
    {
      label: 'Scope',
      value: matches.length > 0 ? `${numberFormatter.format(matches.length)} run rule${matches.length === 1 ? '' : 's'}` : 'No explicit match rules',
      meta: excludes.length > 0
        ? `${numberFormatter.format(excludes.length)} exclusion${excludes.length === 1 ? '' : 's'} applied`
        : 'No extra exclusions declared'
    },
    {
      label: 'Payload',
      value: formatBytes(codeSize),
      meta: `${numberFormatter.format(lineCount)} lines • ${numberFormatter.format(resourceCount)} external asset${resourceCount === 1 ? '' : 's'}`
    }
  ];

  const alerts = [];
  if (presentation.isDowngrade) {
    alerts.push(buildInstallAlert(
      'is-warning',
      'Version Downgrade',
      `This replaces your current version with an older build (${escapeHtml(presentation.versionChange)}).`
    ));
  }
  if (hasDangerousPerms) {
    alerts.push(buildInstallAlert(
      'is-danger',
      'Elevated Browser Access',
      `This script requests ${numberFormatter.format(dangerousPermissions.length)} high-trust permission${dangerousPermissions.length === 1 ? '' : 's'}, including ${dangerousPermissions.slice(0, 3).map(escapeHtml).join(', ')}.`
    ));
  }
  if (hostPermissionPlan.requiresBroadHostAccess) {
    alerts.push(buildInstallAlert(
      'is-warning',
      'All-Sites Browser Access',
      'This script declares a universal run or connect rule. ScriptVault will not grant all-site browser access unless you explicitly approve broad access in the install options.'
    ));
  }

  // Phase 39.16 — Crypto-scam install-time heuristic (TM #2783).
  // Active scam campaigns distribute wallet-key exfiltration scripts via
  // Pastebin / Telegram / random repos. Stack a content+source heuristic on
  // top of the existing alert chain: if the install source is NOT one of
  // the known userscript catalogs AND the body mentions wallet / crypto
  // tokens, surface a distinct danger alert.
  //
  // This is intentionally a high-visibility alert, not a hard block — the
  // user can still install. The goal is to interrupt the "click install
  // without reading" reflex with a specific reason to pause.
  const CRYPTO_TRUSTED_HOSTS = new Set([
    'greasyfork.org', 'sleazyfork.org', 'openuserjs.org',
    'github.com', 'gist.github.com', 'raw.githubusercontent.com'
  ]);
  const CRYPTO_KEYWORD_REGEX = /\b(wallet|swap|exchange|seed|mnemonic|private[\s_-]?key|metamask|trust\s?wallet|coinbase|phantom|ledger|trezor|crypto|bitcoin|ethereum|web3)\b/i;
  let sourceHost = '';
  try { sourceHost = new URL(sourceUrl || installSourceUrl || '').hostname.toLowerCase(); } catch { /* no-op */ }
  const fromTrustedCatalog = !!sourceHost && [...CRYPTO_TRUSTED_HOSTS].some(h => sourceHost === h || sourceHost.endsWith('.' + h));
  const cryptoKeywordMatch = CRYPTO_KEYWORD_REGEX.test(scriptCode);
  if (cryptoKeywordMatch && !fromTrustedCatalog) {
    alerts.push(buildInstallAlert(
      'is-danger',
      'Crypto / Wallet Keywords from Untrusted Source',
      `This script mentions wallet, seed phrase, or other crypto-related terms AND was loaded from a source that is not a known userscript repository (Greasy Fork, OpenUserJS, GitHub). Active scam campaigns distribute wallet-draining scripts this way — verify the author before installing.`
    ));
  }
  const declaredAntifeatures = getDeclaredAntifeatures(scriptMeta);
  if (declaredAntifeatures.length > 0) {
    alerts.push(buildInstallAlert(
      'is-warning',
      'Anti-Features Declared',
      `<div class="install-alert-list">${declaredAntifeatures.map(af => `<div class="install-alert-list-item">• ${escapeHtml(formatAntifeatureLabel(af))}</div>`).join('')}</div>`
    ));
  }
  if (codeSize > 500000) {
    alerts.push(buildInstallAlert(
      'is-info',
      'Large Payload',
      `This script is ${formatBytes(codeSize)} across ${numberFormatter.format(lineCount)} lines, so first-run parsing may take longer than usual.`
    ));
  }

  const installTitle = presentation.isUpdate
    ? 'Update this script'
    : presentation.isDowngrade
      ? 'Review the downgrade'
      : presentation.isReinstall
        ? 'Reinstall this script'
        : 'Install into ScriptVault';

  const installCopy = presentation.isUpdate
    ? `ScriptVault will replace your current copy with ${escapeHtml(presentation.summaryLabel)} and preserve its script ID.`
    : presentation.isDowngrade
      ? `This will intentionally roll the script back to an older version from ${escapeHtml(source.host)}.`
      : presentation.isReinstall
        ? 'This installs the same version again, which is useful when you want a clean replacement from the original source.'
        : `ScriptVault will add this as a new userscript from ${escapeHtml(source.host)}.`;

  const dependencyCard = dependencyCount > 0 ? `
    <div class="surface-card analysis-card review-section" id="reviewDependencies">
      <div class="install-card-header">
        <div>
          <div class="install-card-title">Dependency Reachability & Provenance</div>
          <div class="install-card-subtitle">Check whether each @require URL is reachable and whether declared Sigstore provenance verifies.</div>
        </div>
        <span class="count status-neutral" id="dep-status" role="status" aria-live="polite" aria-atomic="true">Checking…</span>
      </div>
      <div class="tag-list" id="dep-list">
        ${scriptMeta.require.map(url => {
          const pinned = requireIsPinned(url);
          const badge = pinned
            ? ''
            : ` <span class="tag warning" title="This @require has no SRI hash — it loads whatever the CDN serves. Pin it with #sha256=… to verify, or set Security → Subresource Integrity to Require to block un-pinned dependencies.">unverified remote code</span>`;
          return `<span class="tag" data-dep-url="${escapeHtml(url)}" title="${escapeHtml(url)}">${escapeHtml(getUrlFilename(url))}</span>${badge}`;
        }).join('')}
      </div>
      <div class="install-card-header" style="margin-top:14px;margin-bottom:8px">
        <div class="install-card-subtitle">Sigstore provenance</div>
        <span class="count status-neutral" id="provenance-status" role="status" aria-live="polite" aria-atomic="true">${hasRequireProvenance ? 'Checking' : 'Not declared'}</span>
      </div>
      <div class="analysis-summary" id="provenance-summary" style="margin-top:12px">
        ${hasRequireProvenance ? 'Checking declared @require-provenance bundles.' : 'No @require-provenance metadata was declared for these dependencies.'}
      </div>
      <div class="tag-list" id="provenance-list">
        ${scriptMeta.require.map((url, index) => {
          const bundleUrl = scriptMeta.requireProvenance?.[index] || '';
          const identity = scriptMeta.requireIdentity?.[index] || '';
          const title = bundleUrl && identity
            ? `${url} — ${bundleUrl} — ${identity}`
            : bundleUrl
              ? `${url} — missing @require-identity`
              : identity
                ? `${url} — missing @require-provenance`
                : `${url} — no provenance declared`;
          return `<span class="tag neutral" data-provenance-index="${index}" title="${escapeHtml(title)}">${escapeHtml(bundleUrl || identity ? 'Checking provenance' : 'No provenance')}</span>`;
        }).join('')}
      </div>
    </div>
  ` : '';

  const reviewNavItems = [
    { id: 'reviewSummary', label: 'Summary' },
    { id: 'reviewDetails', label: 'Details' },
    { id: 'reviewSecurity', label: 'Security' },
    ...(dependencyCount > 0 ? [{ id: 'reviewDependencies', label: 'Dependencies' }] : []),
    { id: 'reviewTrust', label: 'Trust' },
    { id: 'reviewCode', label: 'Code' },
    { id: 'reviewInstall', label: 'Install' }
  ];

  const html = `
    <div class="install-layout">
      <div class="install-main stack">
        ${alerts.length > 0 ? `<div class="install-alert-stack">${alerts.join('')}</div>` : ''}
        <nav class="review-nav" id="reviewNav" aria-label="Review sections">
          ${reviewNavItems.map((item, index) => `
            <button
              class="review-nav-btn${index === 0 ? ' is-active' : ''}"
              type="button"
              data-target="${item.id}"
              aria-pressed="${index === 0 ? 'true' : 'false'}"
              aria-current="${index === 0 ? 'location' : 'false'}"
              tabindex="${index === 0 ? '0' : '-1'}"
            >${escapeHtml(item.label)}</button>
          `).join('')}
        </nav>
        <div class="review-nav-meta">
          <p class="review-nav-status" id="reviewNavStatus" role="status" aria-live="polite" aria-atomic="true">Reviewing Summary. Use Left and Right arrow keys to move between sections.</p>
        </div>
        <section class="review-section" id="reviewSummary">
          <div class="summary-grid">
            ${summaryCards.map(card => `
              <div class="surface-card summary-card">
                <div class="summary-label">${escapeHtml(card.label)}</div>
                <div class="summary-value">${escapeHtml(card.value)}</div>
                <div class="summary-meta">${escapeHtml(card.meta)}</div>
              </div>
            `).join('')}
          </div>
        </section>

        <div class="script-card surface-card review-section" id="reviewDetails">
      <div class="script-header">
        <div class="script-icon-row">
          <div class="script-icon">
            ${iconUrl && sanitizeUrl(iconUrl) ? `<img src="${escapeHtml(sanitizeUrl(iconUrl))}" width="48" height="48" alt="" data-icon-fallback="\uD83D\uDCDC">` : '<img src="../images/icon48.png" width="48" height="48" alt="ScriptVault">'}
          </div>
          <div class="script-title-area">
            <div class="script-name">${escapeHtml(scriptMeta.name)}</div>
            <div class="script-version">
              ${presentation.isUpdate || presentation.isDowngrade
                ? `<span class="version-change">${escapeHtml(presentation.versionChange)}</span>`
                : `v${escapeHtml(scriptMeta.version)}`
              }
            </div>
          </div>
        </div>
        ${scriptMeta.description ? `<div class="script-description">${escapeHtml(scriptMeta.description)}</div>` : ''}
      </div>

      <div class="script-meta">
        <div class="meta-grid">
          ${scriptMeta.author ? `
            <div class="meta-item">
              <span class="meta-label">Author</span>
              <span class="meta-value">${escapeHtml(scriptMeta.author)}</span>
            </div>
          ` : ''}

          ${scriptMeta.namespace ? `
            <div class="meta-item">
              <span class="meta-label">Namespace</span>
              <span class="meta-value">${escapeHtml(scriptMeta.namespace)}</span>
            </div>
          ` : ''}

          ${scriptMeta.license ? `
            <div class="meta-item">
              <span class="meta-label">License</span>
              <span class="meta-value">${escapeHtml(scriptMeta.license)}</span>
            </div>
          ` : ''}

          ${scriptMeta.homepage ? `
            <div class="meta-item">
              <span class="meta-label">Homepage</span>
              <span class="meta-value">${renderExternalLink(scriptMeta.homepage)}</span>
            </div>
          ` : ''}

          <div class="meta-item">
            <span class="meta-label">Size</span>
            <span class="meta-value">${formatBytes(codeSize)} (${numberFormatter.format(lineCount)} lines)</span>
          </div>

          <div class="meta-item">
            <span class="meta-label">Runs at</span>
            <span class="meta-value">${escapeHtml(formatRunTiming(scriptMeta))}</span>
          </div>

          <div class="meta-item full-width">
            <span class="meta-label">Install Source</span>
            <span class="meta-value">${source.safeUrl ? renderExternalLink(source.label) : escapeHtml(source.label)}</span>
          </div>
          ${scriptMeta.updateURL ? `
            <div class="meta-item full-width">
              <span class="meta-label">Update Channel</span>
              <span class="meta-value">${renderExternalLink(scriptMeta.updateURL)}</span>
            </div>
          ` : ''}
          ${scriptMeta.downloadURL && scriptMeta.downloadURL !== scriptMeta.updateURL ? `
            <div class="meta-item full-width">
              <span class="meta-label">Download Channel</span>
              <span class="meta-value">${renderExternalLink(scriptMeta.downloadURL)}</span>
            </div>
          ` : ''}
        </div>
      </div>

      ${renderExpandablePatternSection('matchRules', 'Runs on', matches, 8)}

      ${renderExpandablePatternSection('excludeRules', 'Excludes', excludes, 3)}

      <div class="section">
        <div class="section-title">
          <span>Permissions</span>
          <span class="count">${grants.length}</span>
        </div>
        <div class="tag-list">
          ${grants.map(g => {
                const isDangerous = DANGEROUS_PERMISSIONS.includes(g);
                const isSafe = SAFE_PERMISSIONS.includes(g);
                const desc = GRANT_DESCRIPTIONS[g] || '';
                const needsOptional = !!OPTIONAL_GRANT_PERMISSION_MAP[g];
                const augmentedDesc = needsOptional
                  ? `${desc}${desc ? ' — ' : ''}Will prompt for the Chrome '${OPTIONAL_GRANT_PERMISSION_MAP[g]}' permission at install.`
                  : desc;
                return `<span class="tag ${isDangerous ? 'warning' : isSafe ? 'safe' : ''}" ${augmentedDesc ? `title="${escapeHtml(augmentedDesc)}"` : ''}>${escapeHtml(g)}${needsOptional ? '<span class="optional-perm-hint" aria-hidden="true"> *</span>' : ''}</span>`;
              }).join('')}
        </div>
        ${grants.some(g => OPTIONAL_GRANT_PERMISSION_MAP[g]) ? `
          <p class="optional-perm-note" style="margin-top:8px;font-size:0.85em;color:var(--text-muted,#888);">
            * Chrome will ask you for the matching browser permission after you click install. Decline to keep the script working without that capability.
          </p>
        ` : ''}
      </div>

      <div class="section">
        <div class="section-title">
          <span>Privileged Host Scope</span>
          <span class="count">${scriptMeta.connect.length > 0 ? numberFormatter.format(scriptMeta.connect.length) : 'Run hosts'}</span>
        </div>
        <p class="optional-perm-note" style="margin-top:0;margin-bottom:8px;font-size:0.85em;color:var(--text-muted,#888);">
          GM_xmlhttpRequest, GM_webSocket, GM_download, GM_cookie, and GM_webRequest are limited to the declared run hosts. @connect entries explicitly widen network, download, WebSocket, and DNR targets; cookie access stays run-host scoped unless the advanced cross-scope override is enabled.
        </p>
        <div class="tag-list">
          ${scriptMeta.connect.length > 0
            ? scriptMeta.connect.map(d => `<span class="tag">${escapeHtml(d)}</span>`).join('')
            : '<span class="tag safe">No extra @connect hosts</span>'}
        </div>
      </div>

      <div class="section">
        <div class="section-title">
          <span>Browser Host Grants</span>
          <span class="count">${hostPermissionPlan.origins.length > 0 ? numberFormatter.format(hostPermissionPlan.origins.length) : hostPermissionPlan.requiresBroadHostAccess ? 'Broad' : 'None'}</span>
        </div>
        <p class="optional-perm-note" style="margin-top:0;margin-bottom:8px;font-size:0.85em;color:var(--text-muted,#888);">
          ScriptVault asks the browser only for hosts this script declares in run rules, update URLs, dependencies, or @connect. Universal rules stay blocked until you approve broad access.
        </p>
        <div class="tag-list">
          ${hostPermissionPlan.origins.length > 0
            ? hostPermissionPlan.origins.slice(0, 12).map(origin => `<span class="tag safe">${escapeHtml(origin)}</span>`).join('')
            : hostPermissionPlan.requiresBroadHostAccess
              ? '<span class="tag warning">Awaiting broad-access approval</span>'
              : '<span class="tag safe">No HTTP(S) host grants needed</span>'}
          ${hostPermissionPlan.origins.length > 12 ? `<span class="tag neutral">+${numberFormatter.format(hostPermissionPlan.origins.length - 12)} more</span>` : ''}
          ${hostPermissionPlan.requiresBroadHostAccess ? hostPermissionPlan.broadOrigins.map(origin => `<span class="tag warning">${escapeHtml(origin)}</span>`).join('') : ''}
          ${hostPermissionPlan.unsupported.length > 0 ? `<span class="tag neutral" title="${escapeHtml(hostPermissionPlan.unsupported.slice(0, 6).join(', '))}">${numberFormatter.format(hostPermissionPlan.unsupported.length)} non-HTTP rule${hostPermissionPlan.unsupported.length === 1 ? '' : 's'}</span>` : ''}
        </div>
      </div>

      ${resourceCount > 0 ? `
        <div class="section">
          <div class="section-title">
            <span>External Resources</span>
            <span class="count">${resourceCount}</span>
          </div>
          <div class="tag-list">
            ${scriptMeta.require.map(r => `<span class="tag" title="${escapeHtml(r)}">${escapeHtml(getUrlFilename(r))}</span>`).join('')}
            ${Object.keys(scriptMeta.resource).map(name => {
              return `<span class="tag" title="${escapeHtml(scriptMeta.resource[name])}">${escapeHtml(name)}</span>`;
            }).join('')}
          </div>
        </div>
      ` : ''}

      ${scriptMeta.tag.length > 0 ? `
        <div class="section">
          <div class="section-title">
            <span>Tags</span>
          </div>
          <div class="tag-list">
            ${scriptMeta.tag.map(t => `<span class="tag">#${escapeHtml(t)}</span>`).join('')}
          </div>
        </div>
      ` : ''}
        </div>

        <div class="surface-card analysis-card review-section" id="reviewSecurity">
          <div id="analysisMount">
            <div class="install-card-header">
              <div>
                <div class="install-card-title">Security Analysis</div>
                <div class="install-card-subtitle">Scanning the script metadata and source for risky patterns.</div>
              </div>
              <span class="count status-neutral" id="analysisStatus" role="status" aria-live="polite" aria-atomic="true">Scanning</span>
            </div>
            <div class="analysis-summary">ScriptVault checks the script in the background while you review it.</div>
          </div>
        </div>

        <div class="surface-card analysis-card review-section" id="reviewOnDeviceAI" hidden>
          <div id="onDeviceAiInstallMount">
            <div class="install-card-header">
              <div>
                <div class="install-card-title">Local AI Review</div>
                <div class="install-card-subtitle">Optional Chrome Prompt API summary generated on this device.</div>
              </div>
              <span class="count status-neutral">Opt-in</span>
            </div>
            <div class="analysis-summary">Enable on-device AI in Settings to summarize this install review locally.</div>
          </div>
        </div>

      ${dependencyCard}

        <div class="surface-card trust-card review-section" id="reviewTrust">
          <div id="trustMount">
            <div class="install-card-header">
              <div>
                <div class="install-card-title">Source & Trust</div>
                <div class="install-card-subtitle">Review where this script came from and whether you trust its signer.</div>
              </div>
              <span class="count status-neutral">${hasSignature ? 'Verifying' : 'Unsigned'}</span>
            </div>
            <div class="analysis-summary">${hasSignature ? 'ScriptVault is checking the embedded signature and signer trust.' : 'This script does not declare an embedded signature.'}</div>
          </div>
        </div>

      <div class="code-preview surface-card review-section" id="reviewCode">
          <div class="code-preview-header">
            <span class="code-preview-title">Script Code <span class="install-card-subtitle">(${numberFormatter.format(lineCount)} lines)</span></span>
        <button class="code-preview-toggle" id="toggle-code" type="button" aria-expanded="false" aria-controls="code-container">
          <span id="toggle-icon">\u25BC</span>
          <span id="toggle-text">Show code</span>
        </button>
      </div>
      <div class="code-container" id="code-container" hidden aria-hidden="true">
        <textarea id="code-editor"></textarea>
      </div>
    </div>
      </div>

      <aside class="install-sidebar">
        <div class="surface-card decision-card review-section" id="reviewInstall">
          <div class="decision-eyebrow">${escapeHtml(presentation.modeLabel)} • ${escapeHtml(source.host)}</div>
          <div class="decision-title">${escapeHtml(installTitle)}</div>
          <div class="decision-copy">${installCopy}</div>
          <div class="decision-hero" id="decisionHero" data-tone="neutral">
            <div class="decision-hero-meta">
              <span class="decision-hero-badge" id="decisionHeroBadge">In review</span>
            </div>
            <div class="decision-hero-title" id="decisionHeroTitle">Checks are still running</div>
            <div class="decision-hero-copy" id="decisionHeroCopy" role="status" aria-live="polite" aria-atomic="true">ScriptVault is still checking this script. You can keep reviewing permissions, scope, source, and code. The final checks will update here.</div>
          </div>

          <div class="decision-list">
            <div class="decision-row">
              <span>Version</span>
              <strong>${escapeHtml(presentation.summaryLabel)}</strong>
            </div>
            <div class="decision-row">
              <span>After install</span>
              <strong id="decisionEnableState">${enableOnInstall ? 'Enabled immediately' : 'Installed disabled'}</strong>
            </div>
            ${hasUpdater ? `
              <div class="decision-row">
                <span>Update policy</span>
                <strong id="decisionUpdateState">${autoUpdate ? 'Automatic' : 'Manual only'}</strong>
              </div>
            ` : ''}
            <div class="decision-row">
              <span>Risk review</span>
              <span class="count status-neutral" id="decisionRiskState" title="Static analysis is still running.">Scanning</span>
            </div>
            <div class="decision-row">
              <span>Dependencies</span>
              <span class="count status-neutral" id="decisionDependencyState" title="${escapeHtml(dependencyCount > 0 ? 'Verifying external @require URLs.' : 'No external @require dependencies were declared.')}">${dependencyCount > 0 ? `Checking ${numberFormatter.format(dependencyCount)}` : 'None declared'}</span>
            </div>
            ${dependencyCount > 0 ? `
              <div class="decision-row">
                <span>Dependency provenance</span>
                <span class="count status-neutral" id="decisionProvenanceState" title="${escapeHtml(hasRequireProvenance ? 'Verifying declared Sigstore provenance for @require dependencies.' : 'No @require-provenance metadata was declared.')}">${hasRequireProvenance ? 'Checking' : 'Not declared'}</span>
              </div>
            ` : ''}
            <div class="decision-row">
              <span>Signature</span>
              <span class="count status-neutral" id="decisionSignatureState" title="${escapeHtml(hasSignature ? 'Checking the embedded signature and signer trust.' : 'No embedded @signature metadata was found.')}">${hasSignature ? 'Verifying' : 'Unsigned'}</span>
            </div>
            <div class="decision-row">
              <span>Network access</span>
              <strong>${scriptMeta.connect.length > 0 ? numberFormatter.format(scriptMeta.connect.length) : 'None declared'}</strong>
            </div>
            <div class="decision-row">
              <span>Browser access</span>
              <strong>${hostPermissionPlan.requiresBroadHostAccess && !allowBroadHostAccess ? 'Broad approval needed' : hostPermissionPlan.origins.length > 0 ? `${numberFormatter.format(hostPermissionPlan.origins.length)} scoped host${hostPermissionPlan.origins.length === 1 ? '' : 's'}` : 'No HTTP(S) grants'}</strong>
            </div>
          </div>

          <div class="options">
            <div class="options-title">Installation Options</div>

            <div class="option-row">
              <div class="option-info">
                <span class="option-label">Enable on install</span>
                <span class="option-description">Start running the script immediately after installation.</span>
              </div>
              <label class="toggle">
                <input type="checkbox" id="enable-install" checked>
                <span class="toggle-slider"></span>
              </label>
            </div>

            ${hasUpdater ? `
              <div class="option-row">
                <div class="option-info">
                  <span class="option-label">Auto-update</span>
                  <span class="option-description">Keep checking the published source for newer versions.</span>
                </div>
                <label class="toggle">
                  <input type="checkbox" id="auto-update" checked>
                  <span class="toggle-slider"></span>
                </label>
            </div>
            ` : ''}
            ${hostPermissionPlan.requiresBroadHostAccess ? `
              <div class="option-row">
                <div class="option-info">
                  <span class="option-label">Allow all-site browser access</span>
                  <span class="option-description">Required only because this script declares &lt;all_urls&gt;, *://*/*, or another universal host rule.</span>
                </div>
                <label class="toggle">
                  <input type="checkbox" id="allow-broad-host-access" ${allowBroadHostAccess ? 'checked' : ''}>
                  <span class="toggle-slider"></span>
                </label>
              </div>
            ` : ''}
          </div>

          <div class="install-error" id="installError" role="alert"></div>

          <div class="actions">
            <button class="btn ${presentation.installClass}" id="btn-install" type="button">${escapeHtml(presentation.installLabel)}</button>
            <button class="btn btn-secondary" id="btn-cancel" type="button">Cancel</button>
          </div>

          <div class="decision-hint" id="decisionHint">Press Enter to ${presentation.isUpdate ? 'update' : presentation.isDowngrade ? 'downgrade' : presentation.isReinstall ? 'reinstall' : 'install'} when the install button is focused. Press Esc to arm cancel.</div>
        </div>
      </aside>
    </div>
  `;

  safeSetHtml(content, html);

  setupExpandablePatternSections();
  setupReviewNav();

  // Entrance animation
  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!prefersReducedMotion) {
    content.style.opacity = '0';
    content.style.transform = 'translateY(8px)';
    requestAnimationFrame(() => {
      content.style.transition = 'opacity 0.3s, transform 0.3s';
      content.style.opacity = '1';
      content.style.transform = 'translateY(0)';
    });
  }

  // Setup code preview
  setupCodePreview();
  renderTrustCard(sourceUrl);
  runSignatureVerification(sourceUrl);

  // Setup event listeners
  setCancelReviewArmed(false);
  updateDecisionSummary();
  document.getElementById('btn-cancel')?.addEventListener('click', requestCancelReview);
  document.getElementById('btn-install')?.addEventListener('click', handleInstall);
  document.getElementById('toggle-code')?.addEventListener('click', toggleCodePreview);

  document.getElementById('enable-install')?.addEventListener('change', (e) => {
    enableOnInstall = e.target.checked;
    clearInstallError();
    setCancelReviewArmed(false);
    updateDecisionSummary();
  });

  document.getElementById('auto-update')?.addEventListener('change', (e) => {
    autoUpdate = e.target.checked;
    clearInstallError();
    setCancelReviewArmed(false);
    updateDecisionSummary();
  });

  document.getElementById('allow-broad-host-access')?.addEventListener('change', (e) => {
    allowBroadHostAccess = e.target.checked;
    clearInstallError();
    setCancelReviewArmed(false);
    renderInstallUI(sourceUrl);
  });

  if (dependencyCount > 0) {
    setTimeout(() => checkDependencies(scriptMeta.require), 100);
    setTimeout(() => checkRequireProvenance(scriptMeta), 100);
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    const installButton = document.getElementById('btn-install');
    const cancelButton = document.getElementById('btn-cancel');
    const codeContainer = document.getElementById('code-container');
    if (!installButton && !cancelButton) return;

    if (e.key === 'Enter' && !e.defaultPrevented) {
      const active = document.activeElement;
      const safeFocus = !active
        || active === document.body
        || active === document.documentElement
        || active === installButton;
      if (safeFocus && installButton && !installButton.disabled) {
        e.preventDefault();
        installButton.click();
      }
    }
    if (e.key === 'Escape' && !e.defaultPrevented) {
      if (codeContainer?.classList.contains('expanded')) {
        e.preventDefault();
        setCodePreviewExpanded(false, { restoreFocus: true });
        return;
      }
      e.preventDefault();
      requestCancelReview();
    }
  });
}

function setupCodePreview() {
  const textarea = document.getElementById('code-editor');
  if (!textarea) return;

  const dataTheme = document.documentElement.getAttribute('data-theme');
  const cmTheme = CM_THEME_MAP[dataTheme] || 'monokai';

  codeEditor = CodeMirror.fromTextArea(textarea, {
    mode: 'javascript',
    theme: cmTheme,
    lineNumbers: true,
    readOnly: true,
    lineWrapping: true
  });

  codeEditor.setValue(scriptCode);
}

function setupExpandablePatternSections() {
  document.querySelectorAll('.match-list-toggle').forEach((button) => {
    const overflow = document.getElementById(button.getAttribute('aria-controls'));
    if (!overflow) return;
    const showLabel = button.dataset.showLabel || 'Show more';
    const hideLabel = button.dataset.hideLabel || 'Show fewer';
    button.addEventListener('click', () => {
      const expanded = button.getAttribute('aria-expanded') === 'true';
      overflow.hidden = expanded;
      button.setAttribute('aria-expanded', String(!expanded));
      button.textContent = expanded ? showLabel : hideLabel;
    });
  });
}

function setupReviewNav() {
  const nav = document.getElementById('reviewNav');
  if (!nav) return;
  const buttons = Array.from(nav.querySelectorAll('.review-nav-btn'));
  const status = document.getElementById('reviewNavStatus');
  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const setActiveTarget = (targetId, { announce = false, moveFocus = false } = {}) => {
    let activeButton = null;
    buttons.forEach((button) => {
      const isActive = button.dataset.target === targetId;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
      button.tabIndex = isActive ? 0 : -1;
      if (isActive) {
        button.setAttribute('aria-current', 'location');
        activeButton = button;
      } else {
        button.removeAttribute('aria-current');
      }
    });
    if (announce && status && activeButton) {
      status.textContent = `Reviewing ${activeButton.textContent.trim()}. Use Left and Right arrow keys to move between sections.`;
    }
    if (moveFocus && activeButton) {
      activeButton.focus({ preventScroll: true });
    }
  };

  const activateButton = (button, { announce = true, moveFocus = false } = {}) => {
    const target = document.getElementById(button.dataset.target || '');
    if (!target) return;
    setActiveTarget(button.dataset.target, { announce, moveFocus });
    target.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'start'
    });
  };

  buttons.forEach((button, index) => {
    button.addEventListener('click', () => {
      activateButton(button, { announce: true });
    });

    button.addEventListener('keydown', (event) => {
      if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      let nextIndex = index;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        nextIndex = (index + 1) % buttons.length;
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        nextIndex = (index - 1 + buttons.length) % buttons.length;
      } else if (event.key === 'Home') {
        nextIndex = 0;
      } else if (event.key === 'End') {
        nextIndex = buttons.length - 1;
      }
      activateButton(buttons[nextIndex], { announce: true, moveFocus: true });
    });
  });

  const sections = buttons
    .map((button) => document.getElementById(button.dataset.target || ''))
    .filter(Boolean);

  if (!sections.length) return;
  setActiveTarget(buttons[0]?.dataset.target || sections[0].id, { announce: true });

  if (!('IntersectionObserver' in window)) return;

  const observer = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
    if (visible[0]?.target?.id) {
      setActiveTarget(visible[0].target.id);
    }
  }, {
    rootMargin: '-24% 0px -58% 0px',
    threshold: [0.18, 0.4, 0.7]
  });

  sections.forEach((section) => observer.observe(section));
}

function setCodePreviewExpanded(expanded, { restoreFocus = false } = {}) {
  const container = document.getElementById('code-container');
  const icon = document.getElementById('toggle-icon');
  const text = document.getElementById('toggle-text');
  const toggle = document.getElementById('toggle-code');
  if (!container || !icon || !text) return false;

  container.classList.toggle('expanded', expanded);
  container.hidden = !expanded;
  container.setAttribute('aria-hidden', String(!expanded));

  if (expanded) {
    icon.textContent = '\u25B2';
    text.textContent = 'Hide code';
    codeEditor?.refresh();
  } else {
    icon.textContent = '\u25BC';
    text.textContent = 'Show code';
  }
  if (toggle) toggle.setAttribute('aria-expanded', String(expanded));
  if (!expanded && restoreFocus) {
    toggle?.focus({ preventScroll: true });
  }
  setCancelReviewArmed(false);
  return expanded;
}

function toggleCodePreview() {
  const container = document.getElementById('code-container');
  const expanded = !(container?.classList.contains('expanded'));
  return setCodePreviewExpanded(expanded);
}

function handleCancel() {
  setCancelReviewArmed(false);
  allowInstallExitOnce();
  setReviewExitGuard(false);
  chrome.storage.local.remove('pendingInstall');
  if (history.length > 1) {
    history.back();
  } else {
    window.close();
  }
}

function requestCancelReview() {
  if (!cancelReviewArmed) {
    setCancelReviewArmed(true);
    document.getElementById('btn-cancel')?.focus();
    return;
  }
  handleCancel();
}

async function handleInstall() {
  const btn = document.getElementById('btn-install');
  const presentation = getInstallPresentation();
  setCancelReviewArmed(false);
  clearInstallError();
  btn.disabled = true;
  safeSetHtml(btn, '<span class="loading-spinner install-inline-spinner"></span> Installing…');

  try {
    const scriptId = existingScript?.id || null;
    const hostPermissionPlan = deriveOptionalHostPermissionPlan(scriptMeta, { allowBroad: allowBroadHostAccess });
    if (hostPermissionPlan.requiresBroadHostAccess && !allowBroadHostAccess) {
      throw new Error('This script asks for all-site browser access. Approve broad access or narrow its @match/@connect rules before installing.');
    }
    const optionalHostPermissionsResult = await ensureOptionalHostPermissions(hostPermissionPlan.origins);
    if (optionalHostPermissionsResult.denied.length > 0) {
      throw new Error(`Browser host access was not granted for ${optionalHostPermissionsResult.denied.slice(0, 3).join(', ')}.`);
    }

    // Request optional Chrome permissions for grants that need them
    // (GM_cookie → cookies, GM_setClipboard → clipboardWrite). Run before
    // any await on a non-permission promise so the user-gesture window
    // from the install button click is still open when Chrome evaluates
    // the request. Result lands in the trust receipt so the user can see
    // later which prompts they accepted/denied.
    const optionalPermissionTokens = getRequiredOptionalPermissions(scriptMeta);
    const optionalPermissionsResult = await ensureOptionalPermissions(optionalPermissionTokens);

    // Round 11: The background saveScript handler doesn't read the `autoUpdate`
    // flag — the canonical per-script update opt-out is `@nodownload` in the
    // metadata block, which the update-checker honors. If the user toggled
    // auto-update OFF on the install page and the script doesn't already
    // declare @nodownload, inject it into the header so the preference
    // actually takes effect.
    let codeToSave = scriptCode;
    if (autoUpdate === false && !scriptMeta.nodownload) {
      codeToSave = codeToSave.replace(
        /(\/\/\s*==UserScript==\s*\r?\n)/,
        '$1// @nodownload\n'
      );
    }

    const result = await chrome.runtime.sendMessage({
      action: 'saveScript',
      data: {
        code: codeToSave,
        id: scriptId,
        enabled: enableOnInstall,
        autoUpdate: autoUpdate,
        settings: {
          allowBroadHostAccess
        },
        trust: {
          recordReceipt: true,
          sourceUrl: installSourceUrl,
          optionalPermissions: optionalPermissionsResult,
          optionalHostPermissions: optionalHostPermissionsResult,
          operation: presentation.isDowngrade
            ? 'downgrade'
            : presentation.isReinstall
              ? 'reinstall'
              : existingScript
                ? 'update'
                : 'install'
        }
      }
    });

    if (!result) {
      throw new Error('No response from background (service worker may have stopped)');
    }
    if (result.error) {
      throw new Error(result.error);
    }

    await chrome.storage.local.remove('pendingInstall');

    const successAction = presentation.isDowngrade
      ? 'downgraded'
      : presentation.isReinstall
        ? 'reinstalled'
        : existingScript
          ? 'updated'
          : 'installed';
    showSuccess(scriptMeta.name, successAction, result?.scriptId);

  } catch (e) {
    console.error('Install failed:', e);
    btn.disabled = false;
    btn.textContent = presentation.installLabel;
    showInstallError(e.message);
  }
}

function showInstallError(message) {
  let errorEl = document.getElementById('installError') || document.querySelector('.install-error');
  if (!errorEl) {
    errorEl = document.createElement('div');
    errorEl.id = 'installError';
    errorEl.className = 'install-error';
    const actions = document.querySelector('.actions');
    if (actions) {
      actions.before(errorEl);
    } else {
      (document.getElementById('content') || document.body).append(errorEl);
    }
  }
  errorEl.setAttribute('role', 'alert');
  errorEl.setAttribute('aria-live', 'assertive');
  errorEl.setAttribute('aria-atomic', 'true');
  errorEl.tabIndex = -1;
  safeSetHtml(errorEl, `
    <span class="install-inline-mark" aria-hidden="true">!</span>
    <span class="install-error-message">
      <span>${escapeHtml(message)}</span>
      <span class="install-error-helper">No script was saved. Review the install details, then try again.</span>
    </span>
  `);
  errorEl.style.display = 'flex';
  errorEl.focus({ preventScroll: true });
}

function clearInstallError() {
  const errorEl = document.getElementById('installError') || document.querySelector('.install-error');
  if (!errorEl) return;
  errorEl.style.display = 'none';
  errorEl.textContent = '';
}

function showError(title, message) {
  setReviewExitGuard(false);
  const content = document.getElementById('content');
  if (!content) return;
  safeSetHtml(content, `
    <div class="error install-terminal" role="alert" aria-live="assertive" aria-atomic="true" aria-labelledby="installTerminalTitle" aria-describedby="installTerminalMessage">
      <div class="install-state-mark is-error error-icon" aria-hidden="true">!</div>
      <div class="error-title" id="installTerminalTitle">${escapeHtml(title)}</div>
      <div class="error-message" id="installTerminalMessage">${escapeHtml(message)}</div>
      <div class="error-actions actions">
        <button class="btn btn-secondary" id="btnCloseError" type="button">Close review</button>
      </div>
    </div>
  `);
  document.getElementById('btnCloseError')?.addEventListener('click', () => {
    allowInstallExitOnce();
    if (history.length > 1) history.back();
    else window.close();
  });
  document.getElementById('btnCloseError')?.focus({ preventScroll: true });
}

function showSuccess(name, action, scriptId) {
  setReviewExitGuard(false);
  const content = document.getElementById('content');
  if (!content) return;
  const titleMap = {
    installed: 'Script Installed',
    updated: 'Script Updated',
    downgraded: 'Script Downgraded',
    reinstalled: 'Script Reinstalled'
  };
  const statusCopy = enableOnInstall
    ? `${name} is active now. You can inspect settings, storage, and update history from the dashboard.`
    : `${name} was saved disabled. Enable it from the dashboard when you are ready to let it run.`;
  const nextStepCopy = action === 'downgraded'
    ? 'Version changes are applied immediately, but the script keeps your existing per-script settings.'
    : action === 'updated'
      ? 'Existing script settings and stored values were preserved during the update.'
      : 'ScriptVault saved the script locally before leaving the install review.';
  safeSetHtml(content, `
    <div class="success install-terminal" role="status" aria-live="polite" aria-atomic="true" aria-labelledby="installTerminalTitle" aria-describedby="installTerminalMessage">
      <div class="install-state-mark is-success success-icon" aria-hidden="true">OK</div>
      <div class="success-title" id="installTerminalTitle">${escapeHtml(titleMap[action] || 'Script Installed')}</div>
      <div class="success-message" id="installTerminalMessage">${escapeHtml(statusCopy)}</div>
      <div class="success-next-step">${escapeHtml(nextStepCopy)}</div>
      <div class="success-actions">
        <button class="btn btn-primary" id="btnOpenDashboard" type="button">Open Dashboard</button>
        <button class="btn btn-secondary" id="btnSuccessClose" type="button">Close review</button>
      </div>
    </div>
  `);

  document.getElementById('btnSuccessClose')?.addEventListener('click', () => {
    allowInstallExitOnce();
    if (history.length > 1) history.back();
    else window.close();
  });
  document.getElementById('btnOpenDashboard')?.addEventListener('click', () => {
    allowInstallExitOnce();
    const url = scriptId
      ? chrome.runtime.getURL(`pages/dashboard.html#script_${encodeURIComponent(scriptId)}`)
      : chrome.runtime.getURL('pages/dashboard.html');
    chrome.tabs.update({ url });
  });
  document.getElementById('btnOpenDashboard')?.focus({ preventScroll: true });
}

// Utilities
function truncateUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname + (u.pathname.length > 20 ? u.pathname.substring(0, 20) + '…' : u.pathname);
  } catch {
    return url.length > 40 ? url.substring(0, 40) + '…' : url;
  }
}

function getUrlFilename(url) {
  try {
    const u = new URL(url);
    const path = u.pathname;
    const filename = path.substring(path.lastIndexOf('/') + 1);
    return filename || u.hostname;
  } catch {
    return url.length > 30 ? url.substring(0, 30) + '…' : url;
  }
}

// A @require is "pinned" (verifiable) when it carries an SRI fragment
// (#sha256=/sha384=/sha512=) or is an npm: spec (resolved with a computed SRI).
// Un-pinned remote requires run whatever the CDN serves — flag them so the user
// reviews the unverified remote code before installing.
function requireIsPinned(url) {
  if (typeof url !== 'string') return true;
  if (/^npm:/i.test(url.trim())) return true;
  const hashIdx = url.indexOf('#');
  if (hashIdx > 0) {
    return /^(sha256|sha384|sha512)[-=]/i.test(url.slice(hashIdx + 1));
  }
  return false;
}

function compareVersions(v1, v2) {
  const version1 = typeof v1 === 'string' ? v1 : String(v1 ?? '');
  const version2 = typeof v2 === 'string' ? v2 : String(v2 ?? '');
  const preRelease1 = version1.includes('-');
  const preRelease2 = version2.includes('-');
  const clean1 = version1.replace(/-.*$/, '');
  const clean2 = version2.replace(/-.*$/, '');
  const parts1 = clean1.split('.').map(n => parseInt(n, 10) || 0);
  const parts2 = clean2.split('.').map(n => parseInt(n, 10) || 0);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] ?? 0;
    const p2 = parts2[i] ?? 0;

    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }

  if (preRelease1 && !preRelease2) return -1;
  if (!preRelease1 && preRelease2) return 1;
  if (preRelease1 && preRelease2) {
    const pre1 = version1.replace(/^[^-]*-/, '').split('.');
    const pre2 = version2.replace(/^[^-]*-/, '').split('.');
    for (let i = 0; i < Math.max(pre1.length, pre2.length); i++) {
      const hasA = i < pre1.length;
      const hasB = i < pre2.length;
      if (!hasA && hasB) return -1;
      if (hasA && !hasB) return 1;

      const a = pre1[i] ?? '';
      const b = pre2[i] ?? '';
      const aNum = /^\d+$/.test(a) ? parseInt(a, 10) : NaN;
      const bNum = /^\d+$/.test(b) ? parseInt(b, 10) : NaN;
      if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
        if (aNum > bNum) return 1;
        if (aNum < bNum) return -1;
      } else if (!Number.isNaN(aNum)) {
        return -1;
      } else if (!Number.isNaN(bNum)) {
        return 1;
      } else {
        if (a > b) return 1;
        if (a < b) return -1;
      }
    }
  }
  return 0;
}

async function runSignatureVerification(sourceUrl) {
  const signatureInfo = extractSignatureInfo(scriptCode);
  if (!signatureInfo) {
    signatureVerification = { valid: false, reason: 'No signature found in script' };
    signatureDecisionState = {
      label: 'Unsigned',
      tone: 'neutral',
      detail: 'No embedded @signature metadata was found.'
    };
    updateDecisionStates();
    renderTrustCard(sourceUrl);
    return;
  }

  signatureDecisionState = {
    label: 'Verifying',
    tone: 'neutral',
    detail: 'Checking the embedded signature and signer trust.'
  };
  updateDecisionStates();
  renderTrustCard(sourceUrl);

  try {
    const result = await chrome.runtime.sendMessage({
      action: 'signing_verify',
      data: { code: scriptCode }
    });
    signatureVerification = result || { valid: false, reason: 'Verification unavailable' };
    if (result?.valid && result?.trusted) {
      signatureDecisionState = {
        label: 'Trusted',
        tone: 'good',
        detail: result.trustedName
          ? `Signed by trusted key "${result.trustedName}".`
          : 'Signed by a trusted key.'
      };
    } else if (result?.valid) {
      signatureDecisionState = {
        label: 'Valid',
        tone: 'neutral',
        detail: 'Signature is valid, but this signer is not trusted yet.'
      };
    } else {
      signatureDecisionState = {
        label: result?.reason === 'No signature found in script' ? 'Unsigned' : 'Warning',
        tone: result?.reason === 'No signature found in script' ? 'neutral' : 'warn',
        detail: result?.reason || 'Signature verification failed.'
      };
    }
  } catch (error) {
    signatureVerification = { valid: false, reason: error?.message || 'Verification failed' };
    signatureDecisionState = {
      label: 'Unavailable',
      tone: 'warn',
      detail: error?.message || 'Signature verification failed.'
    };
  }

  updateDecisionStates();
  renderTrustCard(sourceUrl);
}

// v2.0: Check @require dependency URLs
// The @require reachability preview probes URLs taken from untrusted userscript
// metadata, and it auto-fires before the user clicks Install. Mirror the
// background's InternalHostGuard here (the page can't import it) so the preview
// can never be coerced into probing loopback/RFC-1918/link-local/metadata hosts
// or non-http(s) schemes. URL.hostname normalizes numeric/hex/octal IPv4 forms,
// so the dotted-quad check below also covers http://2130706433/ etc.
function _isInternalDepV4(ip) {
  const p = String(ip).split('.').map(n => parseInt(n, 10));
  if (p.length !== 4 || p.some(n => !Number.isFinite(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;          // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC 1918
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 255 && b === 255) return true;
  return false;
}
function _isInternalDepHost(host) {
  host = String(host || '').toLowerCase();
  if (!host) return true;
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.localdomain')) return true;
  if (host.includes(':')) { // IPv6 literal
    if (host === '::1' || host === '::' || host === '::0') return true;
    if (/^fe[89ab]/.test(host)) return true; // fe80::/10 link-local
    if (/^f[cd]/.test(host)) return true;     // fc00::/7 ULA
    const m = host.match(/^::ffff:([0-9.]+)$/);
    if (m) return _isInternalDepV4(m[1]);
    return false;
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return _isInternalDepV4(host);
  return false;
}
function _isProbeableDepUrl(url) {
  let parsed;
  try { parsed = new URL(url); } catch { return false; }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  return !_isInternalDepHost(parsed.hostname);
}

async function checkDependencies(requires) {
  const counters = {
    ok: 0,
    fail: 0,
    unverifiable: 0,
    pending: requires.length
  };
  const statusEl = document.getElementById('dep-status');

  const refreshDependencyState = () => {
    if (counters.pending > 0) {
      dependencyDecisionState = {
        label: `${numberFormatter.format(requires.length - counters.pending)}/${numberFormatter.format(requires.length)} checked`,
        tone: 'neutral',
        detail: `Verified ${numberFormatter.format(counters.ok)} reachable, ${numberFormatter.format(counters.unverifiable)} unverified, ${numberFormatter.format(counters.fail)} failed.`
      };
    } else if (counters.fail === 0 && counters.unverifiable === 0) {
      dependencyDecisionState = {
        label: 'All reachable',
        tone: 'good',
        detail: `${numberFormatter.format(counters.ok)} dependency URL${counters.ok === 1 ? ' is' : 's are'} reachable.`
      };
    } else if (counters.fail === 0) {
      dependencyDecisionState = {
        label: `${numberFormatter.format(counters.unverifiable)} unverified`,
        tone: 'neutral',
        detail: `${numberFormatter.format(counters.ok)} reachable, ${numberFormatter.format(counters.unverifiable)} reachable but status could not be verified.`
      };
    } else {
      dependencyDecisionState = {
        label: `${numberFormatter.format(counters.fail)} failed`,
        tone: 'warn',
        detail: `${numberFormatter.format(counters.fail)} dependency URL${counters.fail === 1 ? '' : 's'} failed to respond cleanly.`
      };
    }

    updateDecisionStates();

    if (!statusEl) return;
    statusEl.textContent = dependencyDecisionState.label;
    statusEl.className = `count ${getDecisionToneClass(dependencyDecisionState.tone)}`;
    if (dependencyDecisionState.detail) {
      statusEl.title = dependencyDecisionState.detail;
    } else {
      statusEl.removeAttribute('title');
    }
  };

  refreshDependencyState();

  const checks = requires.map(async (url) => {
    const tag = document.querySelector(`[data-dep-url="${CSS.escape(url)}"]`);
    let outcome = 'fail';
    let detail = `${url} — unreachable`;

    if (!_isProbeableDepUrl(url)) {
      // Refuse to probe non-http(s) or internal/loopback hosts — surface it as
      // unverified rather than fetching (avoids a renderer-side host probe).
      outcome = 'unverifiable';
      detail = `${url} — not probed (only external http(s) URLs are checked)`;
    } else {
      try {
        const resp = await fetch(url, { method: 'HEAD' });
        if (resp.ok) {
          outcome = 'ok';
          detail = `${url} — OK (${resp.status})`;
        } else {
          detail = `${url} — HTTP ${resp.status}`;
        }
      } catch {
        try {
          await fetch(url, { method: 'HEAD', mode: 'no-cors' });
          outcome = 'unverifiable';
          detail = `${url} — server reachable (status unverifiable)`;
        } catch {
          detail = `${url} — unreachable`;
        }
      }
    }

    if (tag) {
      tag.classList.remove('safe', 'warning', 'neutral');
      if (outcome === 'ok') tag.classList.add('safe');
      if (outcome === 'unverifiable') tag.classList.add('neutral');
      if (outcome === 'fail') tag.classList.add('warning');
      tag.title = detail;
    }

    counters[outcome] += 1;
    counters.pending -= 1;
    refreshDependencyState();
  });

  await Promise.all(checks);
}

function getRequireProvenanceDeclarations(meta) {
  const requires = Array.isArray(meta?.require) ? meta.require : [];
  const bundles = Array.isArray(meta?.requireProvenance) ? meta.requireProvenance : [];
  const identities = Array.isArray(meta?.requireIdentity) ? meta.requireIdentity : [];
  return {
    requires,
    bundles,
    identities,
    hasDeclarations: bundles.length > 0 || identities.length > 0
  };
}

function isVerifiedRequireProvenanceEntry(entry) {
  return entry?.verification === 'signature-verified' && entry?.rootVerified === 'verified';
}

function requireProvenanceNeedsReview(entry) {
  if (!entry) return false;
  if (entry.status && entry.status !== 'declared' && entry.status !== 'not-declared') return true;
  return ['signature-failed', 'root-verification-failed', 'bundle-unavailable', 'unsupported-bundle']
    .includes(entry.verification || '');
}

function getRequireProvenanceLabel(entry) {
  if (isVerifiedRequireProvenanceEntry(entry)) return 'Verified author';
  if (!entry || entry.status === 'not-declared') return 'No provenance';
  if (entry.status === 'missing-identity') return 'Missing identity';
  if (entry.status === 'missing-bundle') return 'Missing bundle';
  if (entry.verification === 'root-verification-failed') return 'Root failed';
  if (entry.verification === 'signature-failed') return 'Signature failed';
  if (entry.verification === 'bundle-unavailable') return 'Bundle unavailable';
  if (entry.verification === 'unsupported-bundle') return 'Unsupported bundle';
  if (entry.verification === 'signature-verified') return 'Signature verified';
  return 'Pending provenance';
}

function getRequireProvenanceDetail(entry) {
  if (!entry) return 'No provenance result returned.';
  if (entry.error) return entry.error;
  if (isVerifiedRequireProvenanceEntry(entry)) {
    const identity = entry.certificateIdentity || entry.identity || 'declared author';
    const issuer = entry.certificateIssuer ? ` via ${entry.certificateIssuer}` : '';
    return `${entry.url} — verified ${identity}${issuer}`;
  }
  if (entry.status === 'not-declared') return `${entry.url} — no @require-provenance declared`;
  if (entry.status === 'missing-identity') return `${entry.url} — bundle declared without @require-identity`;
  if (entry.status === 'missing-bundle') return `${entry.url} — identity declared without @require-provenance`;
  return `${entry.url} — ${getRequireProvenanceLabel(entry)}`;
}

function setRequireProvenanceStatus(state) {
  provenanceDecisionState = state;
  updateDecisionStates();

  const statusEl = document.getElementById('provenance-status');
  if (!statusEl) return;
  statusEl.textContent = state.label;
  statusEl.className = `count ${getDecisionToneClass(state.tone)}`;
  if (state.detail) {
    statusEl.title = state.detail;
  } else {
    statusEl.removeAttribute('title');
  }
}

function renderRequireProvenanceEntries(entries = []) {
  const listEl = document.getElementById('provenance-list');
  if (!listEl) return;

  if (entries.length === 0) {
    safeSetHtml(listEl, '<span class="tag neutral">No provenance</span>');
    return;
  }

  safeSetHtml(listEl, entries.map((entry) => {
    const cls = isVerifiedRequireProvenanceEntry(entry)
      ? 'safe'
      : requireProvenanceNeedsReview(entry)
        ? 'warning'
        : 'neutral';
    const label = getRequireProvenanceLabel(entry);
    const detail = getRequireProvenanceDetail(entry);
    return `<span class="tag ${cls}" data-provenance-index="${entry.index}" title="${escapeHtml(detail)}">${escapeHtml(label)}</span>`;
  }).join(''));
}

async function checkRequireProvenance(meta) {
  const { requires, bundles, identities, hasDeclarations } = getRequireProvenanceDeclarations(meta);
  const summaryEl = document.getElementById('provenance-summary');
  const statusEl = document.getElementById('provenance-status');

  if (requires.length === 0) {
    setRequireProvenanceStatus({
      label: 'None declared',
      tone: 'good',
      detail: 'No external @require dependencies were declared.'
    });
    if (summaryEl) summaryEl.textContent = 'No external @require dependencies were declared.';
    return;
  }

  if (!hasDeclarations) {
    setRequireProvenanceStatus({
      label: 'Not declared',
      tone: 'neutral',
      detail: 'No @require-provenance metadata was declared for these dependencies.'
    });
    if (summaryEl) summaryEl.textContent = 'No @require-provenance metadata was declared for these dependencies.';
    renderRequireProvenanceEntries(requires.map((url, index) => ({
      index,
      url,
      status: 'not-declared',
      verification: 'not-declared'
    })));
    return;
  }

  setRequireProvenanceStatus({
    label: 'Checking',
    tone: 'neutral',
    detail: 'Verifying Sigstore bundle signatures and Fulcio identities.'
  });
  if (summaryEl) summaryEl.textContent = 'Checking declared @require-provenance bundles.';
  if (statusEl) statusEl.setAttribute('aria-busy', 'true');

  try {
    const result = await chrome.runtime.sendMessage({
      action: 'verifyRequireProvenancePreview',
      data: {
        requires,
        requireProvenance: bundles,
        requireIdentity: identities
      }
    });

    if (!result || result.error) {
      throw new Error(result?.error || 'No provenance result returned');
    }

    const entries = Array.isArray(result.entries) ? result.entries : [];
    const counts = result.counts || {};
    renderRequireProvenanceEntries(entries);

    if (result.status === 'verified') {
      setRequireProvenanceStatus({
        label: 'Verified author',
        tone: 'good',
        detail: `${numberFormatter.format(counts.verified || entries.length)} @require dependencies were signed by the declared Fulcio identities.`
      });
      if (summaryEl) summaryEl.textContent = 'All declared @require-provenance bundles verified against the dependency bytes and expected author identities.';
    } else if (result.status === 'partial') {
      setRequireProvenanceStatus({
        label: `${numberFormatter.format(counts.verified || 0)} verified`,
        tone: 'neutral',
        detail: 'Declared provenance verified for some dependencies; other dependencies do not declare provenance.'
      });
      if (summaryEl) summaryEl.textContent = 'Declared provenance verified, but not every @require dependency has provenance metadata.';
    } else if (result.status === 'review-required') {
      const failed = (counts.failed || 0) + (counts.missing || 0);
      setRequireProvenanceStatus({
        label: `${numberFormatter.format(failed)} issue${failed === 1 ? '' : 's'}`,
        tone: 'warn',
        detail: 'One or more @require provenance checks failed or are incomplete.'
      });
      if (summaryEl) summaryEl.textContent = 'One or more declared provenance checks failed or are missing required metadata. Review before installing.';
    } else {
      setRequireProvenanceStatus({
        label: 'Not declared',
        tone: 'neutral',
        detail: 'No @require-provenance metadata was declared for these dependencies.'
      });
      if (summaryEl) summaryEl.textContent = 'No @require-provenance metadata was declared for these dependencies.';
    }
  } catch (error) {
    setRequireProvenanceStatus({
      label: 'Unavailable',
      tone: 'warn',
      detail: error?.message || 'Dependency provenance verification failed.'
    });
    if (summaryEl) summaryEl.textContent = error?.message || 'Dependency provenance verification failed.';
  } finally {
    if (statusEl) statusEl.removeAttribute('aria-busy');
  }
}

async function renderOnDeviceAiInstallSummary(code, analysisResult) {
  const card = document.getElementById('reviewOnDeviceAI');
  const mount = document.getElementById('onDeviceAiInstallMount');
  if (!card || !mount) return;

  let status;
  try {
    status = await chrome.runtime.sendMessage({ action: 'getOnDeviceAIStatus' });
  } catch (error) {
    card.hidden = true;
    return;
  }

  if (status?.enabled !== true) {
    card.hidden = true;
    return;
  }

  card.hidden = false;
  const available = status.available === true;
  const statusClass = available ? 'status-good' : 'status-neutral';
  const summary = available
    ? 'Generate a short local summary from ScriptVault static analysis and this script source. This may download the Chrome on-device model if it is not ready yet.'
    : (status.reason || 'Chrome Prompt API is not available in this browser context.');

  safeSetHtml(mount, `
    <div class="install-card-header">
      <div>
        <div class="install-card-title">Local AI Review</div>
        <div class="install-card-subtitle">Chrome Prompt API summary. Script text stays on this device.</div>
      </div>
      <span class="count ${statusClass}">${escapeHtml(String(status.availability || 'unknown'))}</span>
    </div>
    <div class="analysis-summary">${escapeHtml(summary)}</div>
    <button type="button" class="btn btn-secondary" id="btnOnDeviceAiInstallSummary" ${available ? '' : 'disabled'}>Summarize locally</button>
  `);

  document.getElementById('btnOnDeviceAiInstallSummary')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = 'Summarizing...';
    safeSetHtml(mount, `
      <div class="install-card-header">
        <div>
          <div class="install-card-title">Local AI Review</div>
          <div class="install-card-subtitle">Chrome Prompt API summary. Script text stays on this device.</div>
        </div>
        <span class="count status-neutral">Running</span>
      </div>
      <div class="analysis-summary">The local model is reviewing the analyzer output.</div>
    `);
    try {
      const result = await chrome.runtime.sendMessage({
        action: 'runOnDeviceAI',
        mode: 'install-summary',
        code,
        metadata: scriptMeta,
        analysis: analysisResult || null
      });
      const text = result?.text || result?.error || 'The local model did not return a summary.';
      safeSetHtml(mount, `
        <div class="install-card-header">
          <div>
            <div class="install-card-title">Local AI Review</div>
            <div class="install-card-subtitle">Generated locally with Chrome Prompt API.</div>
          </div>
          <span class="count ${result?.success ? 'status-good' : 'status-warn'}">${result?.success ? 'Ready' : 'Unavailable'}</span>
        </div>
        <div class="analysis-summary" style="white-space:pre-wrap">${escapeHtml(text)}</div>
      `);
    } catch (error) {
      safeSetHtml(mount, `
        <div class="install-card-header">
          <div>
            <div class="install-card-title">Local AI Review</div>
            <div class="install-card-subtitle">Chrome Prompt API summary could not run.</div>
          </div>
          <span class="count status-warn">Unavailable</span>
        </div>
        <div class="analysis-summary">${escapeHtml(error?.message || 'Local AI summary failed.')}</div>
      `);
    }
  });
}

// Static analysis
async function runStaticAnalysis(code) {
  try {
    const result = await chrome.runtime.sendMessage({ action: 'analyzeScript', code });
    const mount = document.getElementById('analysisMount');
    const status = document.getElementById('analysisStatus');
    if (!mount || !status) return;

    if (!result) {
      status.textContent = 'Unavailable';
      status.className = 'count status-neutral';
      analysisDecisionState = {
        label: 'Unavailable',
        tone: 'neutral',
        detail: 'ScriptVault could not finish this scan.'
      };
      updateDecisionStates();
      safeSetHtml(mount, `
        <div class="install-card-header">
          <div>
            <div class="install-card-title">Security Analysis</div>
            <div class="install-card-subtitle">ScriptVault could not finish this scan.</div>
          </div>
          <span class="count status-neutral">Unavailable</span>
        </div>
        <div class="analysis-summary">You can still review permissions, scope, and source details before deciding.</div>
      `);
      renderOnDeviceAiInstallSummary(code, null).catch(() => {});
      return;
    }

    const riskClass = result.riskLevel === 'high' || result.riskLevel === 'medium'
      ? 'status-warn'
      : result.riskLevel === 'low' || result.riskLevel === 'minimal'
        ? 'status-good'
        : 'status-neutral';
    const findings = result.findings || [];
    analysisDecisionState = {
      label: result.riskLevel ? `${String(result.riskLevel).toUpperCase()} (${numberFormatter.format(result.totalRisk || 0)})` : 'Unknown',
      tone: result.riskLevel === 'high' || result.riskLevel === 'medium'
        ? 'warn'
        : result.riskLevel === 'low' || result.riskLevel === 'minimal'
          ? 'good'
          : 'neutral',
      detail: result.summary || 'Static analysis completed.'
    };
    updateDecisionStates();

    safeSetHtml(mount, `
      <div class="install-card-header">
        <div>
          <div class="install-card-title">Security Analysis</div>
          <div class="install-card-subtitle">Static scan results for this specific install payload.</div>
        </div>
        <span class="count ${riskClass}">${escapeHtml(String(result.riskLevel || 'unknown').toUpperCase())} (${numberFormatter.format(result.totalRisk || 0)}/100)</span>
      </div>
      <div class="analysis-summary">${escapeHtml(result.summary || 'No notable findings returned from static analysis.')}</div>
      <div class="tag-list">
        ${findings.length > 0
          ? findings.slice(0, 10).map(f => {
              const cls = f.risk >= 20 ? 'warning' : f.risk >= 10 ? '' : 'safe';
              return `<span class="tag ${cls}" title="${escapeHtml(f.desc)}${f.count > 1 ? ` (${f.count}x)` : ''}">${escapeHtml(f.label)}</span>`;
            }).join('')
          : '<span class="tag safe">No notable findings</span>'
        }
        ${findings.length > 10 ? `<span class="tag neutral">+${findings.length - 10} more</span>` : ''}
      </div>
    `);
    renderOnDeviceAiInstallSummary(code, result).catch(() => {});
  } catch (e) {
    console.warn('Static analysis failed:', e);
    analysisDecisionState = {
      label: 'Unavailable',
      tone: 'neutral',
      detail: 'The scanner hit an error while it checked this script.'
    };
    updateDecisionStates();
    const mount = document.getElementById('analysisMount');
    if (mount) {
      safeSetHtml(mount, `
        <div class="install-card-header">
          <div>
            <div class="install-card-title">Security Analysis</div>
            <div class="install-card-subtitle">The scanner hit an error while it checked this script.</div>
          </div>
          <span class="count status-neutral">Unavailable</span>
        </div>
        <div class="analysis-summary">Review the install details manually and open the code preview if the source is unfamiliar.</div>
      `);
    }
    renderOnDeviceAiInstallSummary(code, null).catch(() => {});
  }
}

// Initialize
init().catch((e) => {
  console.error('Install page failed to initialize:', e);
  showError('Error loading script', e?.message || 'The install page could not initialize. Try re-opening the userscript URL.');
});
