// ScriptVault Install Page v2.0.0

// Dangerous permissions that warrant security warnings
const DANGEROUS_PERMISSIONS = [
  'GM_xmlhttpRequest',
  'GM.xmlHttpRequest',
  'GM_download',
  'GM_setClipboard',
  'unsafeWindow',
  'GM_cookie'
];

// Permission descriptions for install page tooltips
const GRANT_DESCRIPTIONS = {
  'GM_xmlhttpRequest': 'Can make network requests to any server (bypasses CORS)',
  'GM.xmlHttpRequest': 'Can make network requests to any server (bypasses CORS)',
  'GM_download': 'Can download files to your computer',
  'GM_setClipboard': 'Can write to your clipboard',
  'GM_cookie': 'Can read and modify browser cookies',
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
  'GM_webRequest': 'Can intercept and modify network requests',
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
let signatureDecisionState = {
  label: 'Reviewing',
  tone: 'neutral',
  detail: 'Checking embedded signature and signer trust.'
};
let cancelReviewArmed = false;
let cancelReviewTimer = null;

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
  updateDecisionBadge('decisionSignatureState', signatureDecisionState);
}

async function init() {
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

  // Load and apply theme
  const settings = await chrome.runtime.sendMessage({ action: 'getSettings' });
  const themeSettings = settings?.settings || settings || {};
  const theme = themeSettings.layout || 'dark';
  document.documentElement.setAttribute('data-theme', theme);

  const content = document.getElementById('content');

  try {
    // Get pending install data
    const data = await chrome.storage.local.get('pendingInstall');

    if (!data.pendingInstall) {
      showError('No script to install', 'Please try downloading the script again.');
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
      s.meta.name === scriptMeta.name &&
      (s.meta.namespace === scriptMeta.namespace || (!s.meta.namespace && !scriptMeta.namespace))
    );

    // Render the install UI
    renderInstallUI(sourceUrl);

    // Run static analysis in background
    runStaticAnalysis(scriptCode);

  } catch (e) {
    console.error('Install error:', e);
    showError('Error loading script', e.message);
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
    } else if (key === 'resource') {
      const resourceMatch = val.match(/^(\S+)\s+(.+)$/);
      if (resourceMatch && !['__proto__', 'constructor', 'prototype'].includes(resourceMatch[1])) {
        meta.resource[resourceMatch[1]] = resourceMatch[2];
      }
    } else if (Array.isArray(meta[key])) {
      meta[key].push(val);
    } else if (key in meta) {
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
    const shortPath = url.pathname.length > 28 ? `${url.pathname.slice(0, 28)}...` : url.pathname;
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
    ? `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener">${escapeHtml(label)}</a>`
    : escapeHtml(url);
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
    ? 'Review the install source and update channel before trusting future updates.'
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

  return {
    label,
    detail,
    installSource,
    updateUrl,
    downloadUrl,
    homepageUrl
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

  mount.innerHTML = `
    <div class="install-card-header">
      <div>
        <div class="install-card-title">Source & Trust</div>
        <div class="install-card-subtitle">Review where this script came from and whether its signer is already trusted.</div>
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
  `;

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
  const presentation = getInstallPresentation();
  badge.innerHTML = presentation.badgeHtml;

  const matches = [...scriptMeta.match, ...scriptMeta.include];
  const excludes = [...scriptMeta.exclude, ...scriptMeta['exclude-match']];
  const grants = scriptMeta.grant.length > 0 ? scriptMeta.grant : ['none'];
  const dangerousPermissions = scriptMeta.grant.filter(g => DANGEROUS_PERMISSIONS.includes(g));
  const hasDangerousPerms = dangerousPermissions.length > 0;
  const resourceCount = scriptMeta.require.length + Object.keys(scriptMeta.resource).length;
  const lineCount = scriptCode.split('\n').length;
  const codeSize = scriptCode.length;
  const iconUrl = scriptMeta.icon64 || scriptMeta.icon;
  const source = getSourceSummary(sourceUrl);
  const dependencyCount = scriptMeta.require.length;
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
  if (scriptMeta.antifeature.length > 0) {
    const afLabels = { ads: 'Contains advertising', tracking: 'Includes tracking', miner: 'Contains cryptocurrency miner' };
    alerts.push(buildInstallAlert(
      'is-warning',
      'Anti-Features Declared',
      `<div class="install-alert-list">${scriptMeta.antifeature.map(af => `<div class="install-alert-list-item">• ${escapeHtml(afLabels[af] || af)}</div>`).join('')}</div>`
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
    <div class="surface-card analysis-card">
      <div class="install-card-header">
        <div>
          <div class="install-card-title">Dependency Reachability</div>
          <div class="install-card-subtitle">Check whether each @require URL can still be reached before install.</div>
        </div>
        <span class="count status-neutral" id="dep-status">Checking...</span>
      </div>
      <div class="tag-list" id="dep-list">
        ${scriptMeta.require.map(url => `<span class="tag" data-dep-url="${escapeHtml(url)}" title="${escapeHtml(url)}">${escapeHtml(getUrlFilename(url))}</span>`).join('')}
      </div>
    </div>
  ` : '';

  const html = `
    <div class="install-layout">
      <div class="install-main stack">
        ${alerts.length > 0 ? `<div class="install-alert-stack">${alerts.join('')}</div>` : ''}
        <div class="summary-grid">
          ${summaryCards.map(card => `
            <div class="surface-card summary-card">
              <div class="summary-label">${escapeHtml(card.label)}</div>
              <div class="summary-value">${escapeHtml(card.value)}</div>
              <div class="summary-meta">${escapeHtml(card.meta)}</div>
            </div>
          `).join('')}
        </div>

        <div class="script-card surface-card">
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

      ${matches.length > 0 ? `
        <div class="section">
          <div class="section-title">
            <span>Runs on</span>
            <span class="count">${matches.length}</span>
          </div>
          <div class="match-list">
            ${matches.slice(0, 8).map(m => `<div class="match-item">${escapeHtml(m)}</div>`).join('')}
            ${matches.length > 8 ? `<div class="match-item neutral">...and ${matches.length - 8} more</div>` : ''}
          </div>
        </div>
      ` : ''}

      ${excludes.length > 0 ? `
        <div class="section">
          <div class="section-title">
            <span>Excludes</span>
            <span class="count">${excludes.length}</span>
          </div>
          <div class="match-list">
            ${excludes.slice(0, 3).map(m => `<div class="match-item">${escapeHtml(m)}</div>`).join('')}
            ${excludes.length > 3 ? `<div class="match-item neutral">...and ${excludes.length - 3} more</div>` : ''}
          </div>
        </div>
      ` : ''}

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
                return `<span class="tag ${isDangerous ? 'warning' : isSafe ? 'safe' : ''}" ${desc ? `title="${escapeHtml(desc)}"` : ''}>${escapeHtml(g)}</span>`;
              }).join('')}
        </div>
      </div>

      ${scriptMeta.connect.length > 0 ? `
        <div class="section">
          <div class="section-title">
            <span>Network Access</span>
            <span class="count">${scriptMeta.connect.length}</span>
          </div>
          <div class="tag-list">
            ${scriptMeta.connect.map(d => `<span class="tag">${escapeHtml(d)}</span>`).join('')}
          </div>
        </div>
      ` : ''}

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

        <div class="surface-card analysis-card" id="analysisMount">
          <div class="install-card-header">
            <div>
              <div class="install-card-title">Security Analysis</div>
              <div class="install-card-subtitle">Scanning the script metadata and source for risky patterns.</div>
            </div>
            <span class="count status-neutral" id="analysisStatus">Scanning</span>
          </div>
          <div class="analysis-summary">Static analysis runs in the background so you can keep reviewing while ScriptVault checks the script.</div>
        </div>

      ${dependencyCard}

        <div class="surface-card trust-card" id="trustMount">
          <div class="install-card-header">
            <div>
              <div class="install-card-title">Source & Trust</div>
              <div class="install-card-subtitle">Review where this script came from and whether its signer is already trusted.</div>
            </div>
            <span class="count status-neutral">${hasSignature ? 'Verifying' : 'Unsigned'}</span>
          </div>
          <div class="analysis-summary">${hasSignature ? 'ScriptVault is checking the embedded signature and signer trust.' : 'This script does not declare an embedded signature.'}</div>
        </div>

      <div class="code-preview surface-card">
          <div class="code-preview-header">
            <span class="code-preview-title">Script Code <span class="install-card-subtitle">(${numberFormatter.format(lineCount)} lines)</span></span>
        <button class="code-preview-toggle" id="toggle-code" type="button" aria-expanded="false" aria-controls="code-container">
          <span id="toggle-icon">\u25BC</span>
          <span id="toggle-text">Show code</span>
        </button>
      </div>
      <div class="code-container" id="code-container">
        <textarea id="code-editor"></textarea>
      </div>
    </div>
      </div>

      <aside class="install-sidebar">
        <div class="surface-card decision-card">
          <div class="decision-eyebrow">${escapeHtml(presentation.modeLabel)} • ${escapeHtml(source.host)}</div>
          <div class="decision-title">${escapeHtml(installTitle)}</div>
          <div class="decision-copy">${installCopy}</div>

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
            <div class="decision-row">
              <span>Signature</span>
              <span class="count status-neutral" id="decisionSignatureState" title="${escapeHtml(hasSignature ? 'Checking the embedded signature and signer trust.' : 'No embedded @signature metadata was found.')}">${hasSignature ? 'Verifying' : 'Unsigned'}</span>
            </div>
            <div class="decision-row">
              <span>Network access</span>
              <strong>${scriptMeta.connect.length > 0 ? numberFormatter.format(scriptMeta.connect.length) : 'None declared'}</strong>
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

  content.innerHTML = html;

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
    setCancelReviewArmed(false);
    updateDecisionSummary();
  });

  document.getElementById('auto-update')?.addEventListener('change', (e) => {
    autoUpdate = e.target.checked;
    setCancelReviewArmed(false);
    updateDecisionSummary();
  });

  if (dependencyCount > 0) {
    setTimeout(() => checkDependencies(scriptMeta.require), 100);
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    const installButton = document.getElementById('btn-install');
    const cancelButton = document.getElementById('btn-cancel');
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

function toggleCodePreview() {
  const container = document.getElementById('code-container');
  const icon = document.getElementById('toggle-icon');
  const text = document.getElementById('toggle-text');
  const toggle = document.getElementById('toggle-code');

  container.classList.toggle('expanded');
  const expanded = container.classList.contains('expanded');

  if (expanded) {
    icon.textContent = '\u25B2';
    text.textContent = 'Hide code';
    codeEditor?.refresh();
  } else {
    icon.textContent = '\u25BC';
    text.textContent = 'Show code';
  }
  if (toggle) toggle.setAttribute('aria-expanded', String(expanded));
  setCancelReviewArmed(false);
}

function handleCancel() {
  setCancelReviewArmed(false);
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
  btn.disabled = true;
  btn.innerHTML = '<span class="loading-spinner install-inline-spinner"></span> Installing…';

  try {
    const scriptId = existingScript?.id || null;

    const result = await chrome.runtime.sendMessage({
      action: 'saveScript',
      data: {
        code: scriptCode,
        id: scriptId,
        enabled: enableOnInstall,
        autoUpdate: autoUpdate
      }
    });

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
    showSuccess(scriptMeta.name, successAction, result.scriptId);

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
    errorEl.className = 'install-error';
    const actions = document.querySelector('.actions');
    if (actions) actions.before(errorEl);
  }
  errorEl.innerHTML = `<span>\u26A0\uFE0F</span> ${escapeHtml(message)}`;
  errorEl.style.display = 'flex';
}

function showError(title, message) {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="error">
      <div class="error-icon">\u274C</div>
      <div class="error-title">${escapeHtml(title)}</div>
      <div class="error-message">${escapeHtml(message)}</div>
      <div class="actions" style="justify-content: center;">
        <button class="btn btn-secondary" id="btnCloseError" type="button" style="flex:none;min-width:120px">Close</button>
      </div>
    </div>
  `;
  document.getElementById('btnCloseError')?.addEventListener('click', () => {
    if (history.length > 1) history.back();
    else window.close();
  });
}

function showSuccess(name, action, scriptId) {
  const content = document.getElementById('content');
  const titleMap = {
    installed: 'Script Installed',
    updated: 'Script Updated',
    downgraded: 'Script Downgraded',
    reinstalled: 'Script Reinstalled'
  };
  content.innerHTML = `
    <div class="success">
      <div class="success-icon">\u2705</div>
      <div class="success-title">${escapeHtml(titleMap[action] || 'Script Installed')}!</div>
      <div class="success-message">${escapeHtml(name)} is now ${enableOnInstall ? 'active' : 'installed but disabled'}.</div>
      <div class="success-actions">
        <button class="btn btn-secondary" id="btnSuccessClose" type="button" style="flex:none">Close</button>
        <button class="btn btn-primary" id="btnOpenDashboard" type="button" style="flex:none">Open in Dashboard</button>
      </div>
    </div>
  `;

  document.getElementById('btnSuccessClose')?.addEventListener('click', () => {
    if (history.length > 1) history.back();
    else window.close();
  });
  document.getElementById('btnOpenDashboard')?.addEventListener('click', () => {
    const url = scriptId
      ? chrome.runtime.getURL(`pages/dashboard.html#script_${scriptId}`)
      : chrome.runtime.getURL('pages/dashboard.html');
    chrome.tabs.update({ url });
  });
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

function compareVersions(v1, v2) {
  const preRelease1 = v1.includes('-');
  const preRelease2 = v2.includes('-');
  const clean1 = (typeof v1 === 'string' ? v1 : String(v1)).replace(/-.*$/, '');
  const clean2 = (typeof v2 === 'string' ? v2 : String(v2)).replace(/-.*$/, '');
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
  return 0;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
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
        detail: 'ScriptVault could not complete the static scan for this install.'
      };
      updateDecisionStates();
      mount.innerHTML = `
        <div class="install-card-header">
          <div>
            <div class="install-card-title">Security Analysis</div>
            <div class="install-card-subtitle">ScriptVault could not complete the static scan for this install.</div>
          </div>
          <span class="count status-neutral">Unavailable</span>
        </div>
        <div class="analysis-summary">You can still review permissions, scope, and source details before deciding.</div>
      `;
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

    mount.innerHTML = `
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
    `;
  } catch (e) {
    console.warn('Static analysis failed:', e);
    analysisDecisionState = {
      label: 'Unavailable',
      tone: 'neutral',
      detail: 'The scanner ran into an error while processing this script.'
    };
    updateDecisionStates();
    const mount = document.getElementById('analysisMount');
    if (mount) {
      mount.innerHTML = `
        <div class="install-card-header">
          <div>
            <div class="install-card-title">Security Analysis</div>
            <div class="install-card-subtitle">The scanner ran into an error while processing this script.</div>
          </div>
          <span class="count status-neutral">Unavailable</span>
        </div>
        <div class="analysis-summary">Review the install details manually and open the code preview if the source is unfamiliar.</div>
      `;
    }
  }
}

// Initialize
init();
