// ScriptVault Install Page v1.7.6

// Dangerous permissions that warrant security warnings
const DANGEROUS_PERMISSIONS = [
  'GM_xmlhttpRequest',
  'GM.xmlHttpRequest',
  'GM_download',
  'GM_setClipboard',
  'unsafeWindow',
  'GM_cookie'
];

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

    if (key === 'noframes' || key === 'unwrap') {
      meta[key] = true;
    } else if (key === 'top-level-await') {
      meta['top-level-await'] = true;
    } else if (key === 'resource') {
      const resourceMatch = val.match(/^(\S+)\s+(.+)$/);
      if (resourceMatch) {
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

function renderInstallUI(sourceUrl) {
  const content = document.getElementById('content');
  const badge = document.getElementById('install-type-badge');

  // Determine install type
  let isUpdate = false;
  let isReinstall = false;
  let isDowngrade = false;
  let versionChange = '';

  if (existingScript) {
    const existingVersion = existingScript.meta.version || '0.0.0';
    const newVersion = scriptMeta.version || '0.0.0';
    const cmp = compareVersions(newVersion, existingVersion);

    if (cmp > 0) {
      isUpdate = true;
      versionChange = `${existingVersion} \u2192 ${newVersion}`;
      badge.innerHTML = `<span class="update-badge">\u2B06\uFE0F Update Available</span>`;
    } else if (cmp < 0) {
      isDowngrade = true;
      versionChange = `${existingVersion} \u2192 ${newVersion}`;
      badge.innerHTML = `<span class="downgrade-badge">\u26A0\uFE0F Downgrade</span>`;
    } else {
      isReinstall = true;
      badge.innerHTML = `<span class="reinstall-badge">\uD83D\uDD04 Reinstall</span>`;
    }
  }

  // Check for dangerous permissions
  const hasDangerousPerms = scriptMeta.grant.some(g => DANGEROUS_PERMISSIONS.includes(g));

  // Build matches list
  const matches = [...scriptMeta.match, ...scriptMeta.include];
  const excludes = [...scriptMeta.exclude, ...scriptMeta['exclude-match']];

  // Script stats
  const lineCount = scriptCode.split('\n').length;
  const codeSize = scriptCode.length;

  // Get icon URL
  const iconUrl = scriptMeta.icon64 || scriptMeta.icon;

  let html = '';

  // Downgrade warning
  if (isDowngrade) {
    html += `
      <div class="security-warning" style="border-color: var(--warning); background: var(--warning-bg);">
        <div class="security-warning-header" style="color: var(--warning);">
          <span>\u26A0\uFE0F</span>
          <span>Version Downgrade</span>
        </div>
        <div class="security-warning-text">
          You are installing an <strong>older version</strong> (${escapeHtml(versionChange)}).
          This will replace your current version.
        </div>
      </div>
    `;
  }

  // Security warning if dangerous permissions
  if (hasDangerousPerms) {
    html += `
      <div class="security-warning">
        <div class="security-warning-header">
          <span>\u26A0\uFE0F</span>
          <span>Security Notice</span>
        </div>
        <div class="security-warning-text">
          This script requests powerful permissions that could access data across websites or make network requests.
          Only install if you trust the source.
        </div>
      </div>
    `;
  }

  // Antifeature warnings
  if (scriptMeta.antifeature.length > 0) {
    const afLabels = { ads: 'Contains advertising', tracking: 'Includes tracking', miner: 'Contains cryptocurrency miner' };
    html += `
      <div class="security-warning" style="border-color: var(--warning); background: var(--warning-bg);">
        <div class="security-warning-header" style="color: var(--warning);">
          <span>\u26A0\uFE0F</span>
          <span>Anti-Features Declared</span>
        </div>
        <div class="security-warning-text">
          ${scriptMeta.antifeature.map(af => `<div>\u2022 ${escapeHtml(afLabels[af] || af)}</div>`).join('')}
        </div>
      </div>
    `;
  }

  // Script card
  html += `
    <div class="script-card">
      <div class="script-header">
        <div class="script-icon-row">
          <div class="script-icon">
            ${iconUrl ? `<img src="${escapeHtml(iconUrl)}" alt="" data-icon-fallback="\uD83D\uDCDC">` : '<img src="../images/icon48.png" alt="ScriptVault">'}
          </div>
          <div class="script-title-area">
            <div class="script-name">${escapeHtml(scriptMeta.name)}</div>
            <div class="script-version">
              ${isUpdate || isDowngrade
                ? `<span class="version-change">${escapeHtml(versionChange)}</span>`
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
              <span class="meta-value">${sanitizeUrl(scriptMeta.homepage) ? `<a href="${escapeHtml(sanitizeUrl(scriptMeta.homepage))}" target="_blank">${escapeHtml(truncateUrl(scriptMeta.homepage))}</a>` : escapeHtml(scriptMeta.homepage)}</span>
            </div>
          ` : ''}

          <div class="meta-item">
            <span class="meta-label">Size</span>
            <span class="meta-value">${formatBytes(codeSize)} (${lineCount.toLocaleString()} lines)</span>
          </div>

          <div class="meta-item">
            <span class="meta-label">Runs at</span>
            <span class="meta-value">${escapeHtml(scriptMeta['run-at'])}${scriptMeta.noframes ? ' (no iframes)' : ''}</span>
          </div>

          <div class="meta-item full-width">
            <span class="meta-label">Source</span>
            <span class="meta-value">${escapeHtml(sourceUrl || 'Local file')}</span>
          </div>
        </div>
      </div>

      <!-- URL Patterns -->
      ${matches.length > 0 ? `
        <div class="section">
          <div class="section-title">
            <span>Runs on</span>
            <span class="count">${matches.length}</span>
          </div>
          <div class="match-list">
            ${matches.slice(0, 8).map(m => `<div class="match-item">${escapeHtml(m)}</div>`).join('')}
            ${matches.length > 8 ? `<div class="match-item" style="color: var(--text-muted)">...and ${matches.length - 8} more</div>` : ''}
          </div>
        </div>
      ` : ''}

      <!-- Excludes -->
      ${excludes.length > 0 ? `
        <div class="section">
          <div class="section-title">
            <span>Excludes</span>
            <span class="count">${excludes.length}</span>
          </div>
          <div class="match-list">
            ${excludes.slice(0, 3).map(m => `<div class="match-item">${escapeHtml(m)}</div>`).join('')}
            ${excludes.length > 3 ? `<div class="match-item" style="color: var(--text-muted)">...and ${excludes.length - 3} more</div>` : ''}
          </div>
        </div>
      ` : ''}

      <!-- Permissions -->
      <div class="section">
        <div class="section-title">
          <span>Permissions</span>
          <span class="count">${scriptMeta.grant.length || 1}</span>
        </div>
        <div class="tag-list">
          ${scriptMeta.grant.length > 0
            ? scriptMeta.grant.map(g => {
                const isDangerous = DANGEROUS_PERMISSIONS.includes(g);
                const isSafe = SAFE_PERMISSIONS.includes(g);
                return `<span class="tag ${isDangerous ? 'warning' : isSafe ? 'safe' : ''}">${escapeHtml(g)}</span>`;
              }).join('')
            : '<span class="tag safe">none</span>'
          }
        </div>
      </div>

      <!-- Connect domains -->
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

      <!-- Resources -->
      ${scriptMeta.require.length > 0 || Object.keys(scriptMeta.resource).length > 0 ? `
        <div class="section">
          <div class="section-title">
            <span>External Resources</span>
            <span class="count">${scriptMeta.require.length + Object.keys(scriptMeta.resource).length}</span>
          </div>
          <div class="tag-list">
            ${scriptMeta.require.map(r => `<span class="tag" title="${escapeHtml(r)}">${escapeHtml(getUrlFilename(r))}</span>`).join('')}
            ${Object.keys(scriptMeta.resource).map(name => {
              return `<span class="tag" title="${escapeHtml(scriptMeta.resource[name])}">${escapeHtml(name)}</span>`;
            }).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Tags -->
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
  `;

  // Large script warning
  if (codeSize > 500000) {
    html += `
      <div class="security-warning" style="border-color: var(--warning); background: var(--warning-bg);">
        <div class="security-warning-header" style="color: var(--warning);">
          <span>\u26A0\uFE0F</span>
          <span>Large Script</span>
        </div>
        <div class="security-warning-text">
          This script is ${formatBytes(codeSize)} (${lineCount.toLocaleString()} lines). Large scripts may impact page load performance.
        </div>
      </div>
    `;
  }

  // Options
  html += `
    <div class="options">
      <div class="options-title">Installation Options</div>

      <div class="option-row">
        <div class="option-info">
          <span class="option-label">Enable on install</span>
          <span class="option-description">Start running the script immediately after installation</span>
        </div>
        <label class="toggle">
          <input type="checkbox" id="enable-install" checked>
          <span class="toggle-slider"></span>
        </label>
      </div>

      ${scriptMeta.updateURL || scriptMeta.downloadURL ? `
        <div class="option-row">
          <div class="option-info">
            <span class="option-label">Auto-update</span>
            <span class="option-description">Automatically check for and install updates</span>
          </div>
          <label class="toggle">
            <input type="checkbox" id="auto-update" checked>
            <span class="toggle-slider"></span>
          </label>
        </div>
      ` : ''}
    </div>
  `;

  // Code preview
  html += `
    <div class="code-preview">
      <div class="code-preview-header">
        <span class="code-preview-title">Script Code <span style="color:var(--text-muted);font-weight:400;font-size:12px">(${lineCount.toLocaleString()} lines)</span></span>
        <button class="code-preview-toggle" id="toggle-code">
          <span id="toggle-icon">\u25BC</span>
          <span id="toggle-text">Show code</span>
        </button>
      </div>
      <div class="code-container" id="code-container">
        <textarea id="code-editor"></textarea>
      </div>
    </div>
  `;

  // Actions
  const installLabel = isUpdate ? '\u2B06\uFE0F Update Script'
    : isDowngrade ? '\u26A0\uFE0F Downgrade Script'
    : isReinstall ? '\uD83D\uDD04 Reinstall Script'
    : '\uD83D\uDCE5 Install Script';
  const installClass = isUpdate ? 'btn-update' : isDowngrade ? 'btn-downgrade' : 'btn-primary';

  html += `
    <div class="actions">
      <button class="btn btn-secondary" id="btn-cancel">Cancel</button>
      <button class="btn ${installClass}" id="btn-install">${installLabel}</button>
    </div>
  `;

  content.innerHTML = html;

  // Entrance animation
  content.style.opacity = '0';
  content.style.transform = 'translateY(8px)';
  requestAnimationFrame(() => {
    content.style.transition = 'opacity 0.3s, transform 0.3s';
    content.style.opacity = '1';
    content.style.transform = 'translateY(0)';
  });

  // Setup code preview
  setupCodePreview();

  // Setup event listeners
  document.getElementById('btn-cancel')?.addEventListener('click', handleCancel);
  document.getElementById('btn-install')?.addEventListener('click', handleInstall);
  document.getElementById('toggle-code')?.addEventListener('click', toggleCodePreview);

  document.getElementById('enable-install')?.addEventListener('change', (e) => {
    enableOnInstall = e.target.checked;
  });

  document.getElementById('auto-update')?.addEventListener('change', (e) => {
    autoUpdate = e.target.checked;
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.defaultPrevented) {
      const btn = document.getElementById('btn-install');
      if (btn && !btn.disabled) btn.click();
    }
    if (e.key === 'Escape') {
      handleCancel();
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

  container.classList.toggle('expanded');

  if (container.classList.contains('expanded')) {
    icon.textContent = '\u25B2';
    text.textContent = 'Hide code';
    codeEditor?.refresh();
  } else {
    icon.textContent = '\u25BC';
    text.textContent = 'Show code';
  }
}

function handleCancel() {
  chrome.storage.local.remove('pendingInstall');
  if (history.length > 1) {
    history.back();
  } else {
    window.close();
  }
}

async function handleInstall() {
  const btn = document.getElementById('btn-install');
  btn.disabled = true;
  btn.innerHTML = '<span class="loading-spinner" style="width: 16px; height: 16px; border-width: 2px; margin: 0;"></span> Installing...';

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
    showSuccess(scriptMeta.name, existingScript ? 'updated' : 'installed', result.scriptId);

  } catch (e) {
    console.error('Install failed:', e);
    btn.disabled = false;
    btn.innerHTML = '\uD83D\uDCE5 Install Script';
    // Show inline error instead of alert()
    showInstallError(e.message);
  }
}

function showInstallError(message) {
  let errorEl = document.querySelector('.install-error');
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
        <button class="btn btn-secondary" id="btnCloseError" style="flex:none;min-width:120px">Close</button>
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
  content.innerHTML = `
    <div class="success">
      <div class="success-icon">\u2705</div>
      <div class="success-title">Script ${action === 'updated' ? 'Updated' : 'Installed'}!</div>
      <div class="success-message">${escapeHtml(name)} is now ${enableOnInstall ? 'active' : 'installed but disabled'}.</div>
      <div class="success-actions">
        <button class="btn btn-secondary" id="btnSuccessClose" style="flex:none">Close</button>
        <button class="btn btn-primary" id="btnOpenDashboard" style="flex:none">Open in Dashboard</button>
      </div>
    </div>
  `;

  const autoCloseTimer = setTimeout(() => {
    if (history.length > 1) history.back();
    else window.close();
  }, 5000);

  document.getElementById('btnSuccessClose')?.addEventListener('click', () => {
    clearTimeout(autoCloseTimer);
    if (history.length > 1) history.back();
    else window.close();
  });
  document.getElementById('btnOpenDashboard')?.addEventListener('click', () => {
    clearTimeout(autoCloseTimer);
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
    return u.hostname + (u.pathname.length > 20 ? u.pathname.substring(0, 20) + '...' : u.pathname);
  } catch {
    return url.length > 40 ? url.substring(0, 40) + '...' : url;
  }
}

function getUrlFilename(url) {
  try {
    const u = new URL(url);
    const path = u.pathname;
    const filename = path.substring(path.lastIndexOf('/') + 1);
    return filename || u.hostname;
  } catch {
    return url.length > 30 ? url.substring(0, 30) + '...' : url;
  }
}

function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;

    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }

  return 0;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Static analysis
async function runStaticAnalysis(code) {
  try {
    const result = await chrome.runtime.sendMessage({ action: 'analyzeScript', code });
    if (!result || result.findings?.length === 0) return;

    const container = document.querySelector('.script-card');
    if (!container) return;

    const riskColors = { minimal: 'var(--accent)', low: 'var(--accent)', medium: 'var(--warning)', high: 'var(--danger)' };
    const riskColor = riskColors[result.riskLevel] || 'var(--text-muted)';

    const section = document.createElement('div');
    section.className = 'section';
    section.innerHTML = `
      <div class="section-title">
        <span>Security Analysis</span>
        <span class="count" style="background: ${riskColor}; color: ${result.riskLevel === 'high' || result.riskLevel === 'medium' ? '#fff' : 'inherit'}">
          ${result.riskLevel.toUpperCase()} (${result.totalRisk}/100)
        </span>
      </div>
      <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 10px;">${escapeHtml(result.summary)}</div>
      <div class="tag-list">
        ${result.findings.slice(0, 10).map(f => {
          const cls = f.risk >= 20 ? 'warning' : f.risk >= 10 ? '' : 'safe';
          return `<span class="tag ${cls}" title="${escapeHtml(f.desc)}${f.count > 1 ? ` (${f.count}x)` : ''}">${escapeHtml(f.label)}</span>`;
        }).join('')}
        ${result.findings.length > 10 ? `<span class="tag" style="opacity:0.6">+${result.findings.length - 10} more</span>` : ''}
      </div>
    `;
    container.appendChild(section);
  } catch (e) {
    console.warn('Static analysis failed:', e);
  }
}

// Initialize
init();
