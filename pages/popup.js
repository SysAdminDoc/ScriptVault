// ScriptVault Popup v2.3.0
// Tampermonkey-style popup interface

(function() {
    'use strict';

    const numberFormatter = new Intl.NumberFormat();
    const setupDoctor = globalThis.UserScriptsSetupDoctor;

    function getPopupI18n() {
        try {
            return typeof I18n !== 'undefined' ? I18n : null;
        } catch (_) {
            return null;
        }
    }

    function formatPopupI18nFallback(template, placeholders = {}) {
        return String(template ?? '').replace(/\{(\w+)\}/g, (_, name) =>
            Object.prototype.hasOwnProperty.call(placeholders, name) ? String(placeholders[name]) : `{${name}}`
        );
    }

    function tPopup(key, fallback = key, placeholders = {}) {
        const i18n = getPopupI18n();
        const message = i18n?.getMessage ? i18n.getMessage(key, placeholders) : '';
        return message && message !== key ? message : formatPopupI18nFallback(fallback, placeholders);
    }

    function applyPopupI18n() {
        const i18n = getPopupI18n();
        if (!i18n?.applyToDOM) return;
        i18n.init?.('auto');
        i18n.applyToDOM(document);
    }

    const _svPolicy = (typeof window.trustedTypes !== 'undefined' && window.trustedTypes.createPolicy)
        ? window.trustedTypes.createPolicy('sv-popup', { createHTML: s => s })
        : null;
    function htmlToFragment(html, contextEl) {
        // Anchor the parse range in the target element so context-sensitive
        // tags (<td>/<tr>/<option>/<li>) parse correctly instead of being
        // dropped in document context (regression fixed 2026-07-01).
        const range = document.createRange();
        if (contextEl) range.selectNodeContents(contextEl);
        return range.createContextualFragment(String(html ?? ''));
    }
    function safeSetHtml(el, html) {
        el.replaceChildren(htmlToFragment(_svPolicy ? _svPolicy.createHTML(html) : html, el));
    }

    // Event delegation for favicon error handling (CSP-compliant)
    document.addEventListener('error', function(e) {
        if (e.target.tagName === 'IMG' && e.target.hasAttribute('data-favicon-fallback')) {
            e.target.style.display = 'none';
            if (e.target.parentElement) {
                const parent = e.target.parentElement;
                parent.replaceChildren();
                parent.appendChild(buildPopupIconBadge(
                    e.target.dataset.fallbackLabel || 'SV',
                    e.target.dataset.fallbackHue || '145',
                    e.target.dataset.fallbackMode || 'google'
                ));
            }
        }
    }, true);

    // State
    let currentTab = null;
    let currentUrl = '';
    let pageScripts = [];
    let allScripts = [];
    let settings = {};
    let userScriptsAvailable = true;
    let setupStatus = null;
    let hostPermissionStatus = null;
    let popupToastTimer = null;
    const MATCHABLE_PROTOCOLS = new Set(['http:', 'https:', 'file:', 'ftp:']);
    const busyControls = new WeakSet();
    const pendingScriptActions = new Set();

    // DOM Elements
    const elements = {
        headerToggle: document.getElementById('headerToggle'),
        headerCheckIcon: document.getElementById('headerCheckIcon'),
        scriptList: document.getElementById('scriptList'),
        emptyState: document.getElementById('emptyState'),
        emptyStateIcon: document.getElementById('emptyStateIcon'),
        emptyStateTitle: document.getElementById('emptyStateTitle'),
        emptyStateHint: document.getElementById('emptyStateHint'),
        // Phase 38.4 — @run-at context-menu script section
        contextMenuSection: document.getElementById('contextMenuSection'),
        contextMenuScriptsList: document.getElementById('contextMenuScriptsList'),
        contextMenuScriptsCount: document.getElementById('contextMenuScriptsCount'),
        menuSection: document.getElementById('menuSection'),
        btnFindScripts: document.getElementById('btnFindScripts'),
        btnNewScript: document.getElementById('btnNewScript'),
        btnDiagnose: document.getElementById('btnDiagnose'),
        diagnosePanel: document.getElementById('diagnosePanel'),
        btnUtilities: document.getElementById('btnUtilities'),
        utilitiesSubmenu: document.getElementById('utilitiesSubmenu'),
        btnExportZip: document.getElementById('btnExportZip'),
        btnImport: document.getElementById('btnImport'),
        btnCheckUpdates: document.getElementById('btnCheckUpdates'),
        btnBlacklistDomain: document.getElementById('btnBlacklistDomain'),
        btnWhitelistDomain: document.getElementById('btnWhitelistDomain'),
        btnHelp: document.getElementById('btnHelp'),
        btnDashboard: document.getElementById('btnDashboard'),
        setupWarning: document.getElementById('setupWarning'),
        btnOpenExtSettings: document.getElementById('btnOpenExtSettings'),
        headerCount: document.getElementById('headerCount'),
        pendingUpdatesBadge: document.getElementById('pendingUpdatesBadge')
    };

    // Initialize
    async function init() {
        applyPopupI18n();
        setPopupListLoading(true);
        await checkUserScriptsAvailability();
        await loadSettings();
        await getCurrentTab();
        await loadAllScripts();
        await loadPageScripts();
        await refreshPendingUpdatesBadge();
        setPopupListLoading(false);
        setupEventListeners();
        updateEnabledState();
        updateEmptyStateHint();
        handlePopupOpenReason();
    }

    async function handlePopupOpenReason() {
        try {
            if (!chrome.storage.session?.get) return;
            const data = await chrome.storage.session.get('sv_popup_open_reason');
            const reason = data?.sv_popup_open_reason;
            if (!reason) return;
            await chrome.storage.session.remove('sv_popup_open_reason');
            if (reason === 'pending-updates' && elements.pendingUpdatesBadge && !elements.pendingUpdatesBadge.hidden) {
                elements.pendingUpdatesBadge.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        } catch (_) { /* session storage unavailable or popup closed early */ }
    }

    function setPopupListLoading(isLoading) {
        const list = elements.scriptList;
        if (!list) return;
        list.classList.toggle('loading', isLoading);
        list.setAttribute('aria-busy', String(isLoading));
        if (isLoading) {
            list.hidden = false;
            const loading = document.createElement('div');
            loading.className = 'popup-loading';
            loading.setAttribute('role', 'status');
            loading.setAttribute('aria-live', 'polite');
            loading.setAttribute('aria-label', tPopup('popupLoadingScriptsForPage', 'Loading scripts for this page'));
            for (let i = 0; i < 3; i += 1) {
                const row = document.createElement('div');
                row.className = 'popup-loading-row';
                row.setAttribute('aria-hidden', 'true');
                loading.appendChild(row);
            }
            list.replaceChildren(loading);
            elements.emptyState?.style.setProperty('display', 'none');
        }
    }

    // Load all scripts for total count.
    // Phase 39.23 — VM #2516: defensively coerce response arrays through
    // Array.from so a cross-realm array-like (e.g. one minted in the SW realm
    // and lacking [Symbol.iterator] when surfaced in the popup realm) doesn't
    // crash subsequent for-of loops on YouTube Live Archive-style pages.
    async function loadAllScripts() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getScripts' });
            const raw = response?.scripts;
            allScripts = Array.isArray(raw) ? raw : Array.from(raw ?? []);
        } catch (e) {
            allScripts = [];
        }
    }

    function escapeSelectorValue(value) {
        if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
            return CSS.escape(String(value));
        }
        return String(value).replace(/"/g, '\\"');
    }

    function getScriptRow(scriptId) {
        if (!scriptId) return null;
        // Primary: main script list row keyed on data-script-id.
        if (elements.scriptList) {
            const row = elements.scriptList.querySelector(`[data-script-id="${escapeSelectorValue(scriptId)}"]`);
            if (row) return row;
        }
        // Phase 38.4 — also surface the busy state on the context-menu
        // launcher row so the user sees a disabled-state on the button they
        // just clicked. Without this fallback the per-script lock still
        // bounces double-clicks but the user has no visual cue.
        if (elements.contextMenuScriptsList) {
            const ctxRow = elements.contextMenuScriptsList.querySelector(`[data-ctx-run-id="${escapeSelectorValue(scriptId)}"]`);
            if (ctxRow) return ctxRow;
        }
        return null;
    }

    function setScriptRowBusy(scriptId, isBusy) {
        const row = getScriptRow(scriptId);
        if (!row) return;
        row.classList.toggle('busy', isBusy);
        row.setAttribute('aria-busy', String(isBusy));
        row.querySelectorAll('input, button').forEach((control) => {
            control.disabled = isBusy;
            if (isBusy) {
                control.setAttribute('aria-disabled', 'true');
            } else {
                control.removeAttribute('aria-disabled');
            }
        });
    }

    async function runScriptAction(scriptId, task) {
        if (!scriptId || pendingScriptActions.has(scriptId)) return;
        pendingScriptActions.add(scriptId);
        setScriptRowBusy(scriptId, true);
        try {
            await task();
        } finally {
            pendingScriptActions.delete(scriptId);
            setScriptRowBusy(scriptId, false);
        }
    }

    async function runBusyControl(control, task) {
        if (!control || busyControls.has(control)) return;
        busyControls.add(control);
        control.disabled = true;
        control.classList.add('is-busy');
        control.setAttribute('aria-busy', 'true');
        try {
            await task();
        } finally {
            busyControls.delete(control);
            if (control.isConnected) {
                control.disabled = false;
                control.classList.remove('is-busy');
                control.removeAttribute('aria-busy');
            }
        }
    }

    async function copyTextToClipboard(text) {
        if (!text) throw new Error('Nothing to copy');
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return;
        }

        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', 'true');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        textarea.style.pointerEvents = 'none';
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand?.('copy');
        textarea.remove();
        if (!copied) {
            throw new Error('Copy failed');
        }
    }

    function updatePrimaryActionMenuVisibility() {
        const canFind = canMatchScriptsForUrl(currentUrl);
        if (elements.btnFindScripts) {
            elements.btnFindScripts.hidden = !canFind;
        }
        if (elements.btnNewScript) {
            elements.btnNewScript.hidden = false;
        }
        if (elements.menuSection) {
            const primaryVisibleCount = [elements.btnFindScripts, elements.btnNewScript]
                .filter((button) => button && !button.hidden)
                .length;
            elements.menuSection.classList.toggle('secondary-only', primaryVisibleCount === 0);
        }
    }

    function getPopupScriptRows() {
        return [...document.querySelectorAll('.script-item')];
    }

    function getPopupFocusDescriptor(control = document.activeElement) {
        const row = control?.closest?.('.script-item');
        if (!(row instanceof HTMLElement)) return null;
        const rows = getPopupScriptRows();
        const rowIndex = rows.indexOf(row);
        let target = 'row';
        if (control.matches?.('input[data-toggle-id]')) {
            target = 'toggle';
        } else if (control.matches?.('.script-name-btn')) {
            target = 'name';
        } else if (control.matches?.('.script-quick-edit')) {
            target = 'quickedit';
        } else if (control.matches?.('.script-more')) {
            target = 'more';
        }
        return {
            scriptId: row.dataset.scriptId || '',
            rowIndex: rowIndex >= 0 ? rowIndex : 0,
            target
        };
    }

    function resolvePopupFocusTarget(descriptor) {
        if (!descriptor) return null;
        const rows = getPopupScriptRows();
        if (!rows.length) return null;
        const row = rows.find((item) => item.dataset.scriptId === descriptor.scriptId)
            || rows[Math.min(descriptor.rowIndex ?? 0, rows.length - 1)]
            || rows[0];
        if (!(row instanceof HTMLElement)) return null;

        if (descriptor.target === 'toggle') {
            return row.querySelector('input[data-toggle-id]') || row;
        }
        if (descriptor.target === 'name') {
            return row.querySelector('.script-name-btn') || row;
        }
        if (descriptor.target === 'quickedit') {
            return row.querySelector('.script-quick-edit') || row;
        }
        if (descriptor.target === 'more') {
            return row.querySelector('.script-more') || row;
        }
        return row;
    }

    function restorePopupFocus(descriptor) {
        const target = resolvePopupFocusTarget(descriptor);
        if (!(target instanceof HTMLElement)) return;
        target.focus({ preventScroll: true });
        target.scrollIntoView?.({ block: 'nearest' });
    }

    function queuePopupFocusRestore(descriptor) {
        if (!descriptor) return;
        pendingPopupFocusDescriptor = descriptor;
    }

    function focusPopupScriptRow(row) {
        if (!(row instanceof HTMLElement)) return;
        row.focus();
        row.scrollIntoView?.({ block: 'nearest' });
    }

    // Contextual empty state hint
    function updateEmptyStateHint() {
        const el = elements.emptyStateHint;
        if (!el) return;
        el.textContent = tPopup('popupNoScriptsDefaultHint', 'Find trusted scripts or create one for this site.');
        updatePrimaryActionMenuVisibility();
        if (!canMatchScriptsForUrl(currentUrl)) {
            el.textContent = tPopup('popupNoScriptsRestrictedHint', 'Switch to a regular website or local file to search for matching scripts.');
            return;
        }
        try {
            const hostname = new URL(currentUrl).hostname.replace(/^www\./, '');
            if (hostname) {
                el.textContent = tPopup('popupNoScriptsHostHint', 'Search GreasyFork for {hostname} or create a focused script for this site.', { hostname });
            }
        } catch {}
    }

    function getMarkerMode() {
        const mode = settings.faviconService || 'google';
        return mode === 'duckduckgo' || mode === 'none' ? mode : 'google';
    }

    function hashMarkerSeed(seed) {
        let hash = 0;
        const input = String(seed || 'scriptvault');
        for (let i = 0; i < input.length; i++) {
            hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
        }
        return Math.abs(hash) % 360;
    }

    function getDomainRoot(domain) {
        const parts = String(domain || '')
            .replace(/^www\./, '')
            .split('.')
            .filter(Boolean);
        return parts.length >= 2 ? parts[parts.length - 2] : (parts[0] || '');
    }

    function canMatchScriptsForUrl(url) {
        if (!url) return false;
        try {
            return MATCHABLE_PROTOCOLS.has(new URL(url).protocol);
        } catch {
            return false;
        }
    }

    function showPopupEmptyState(title, description, iconText = 'SV') {
        const emptyState = elements.emptyState;
        if (!emptyState) return;
        emptyState.style.display = 'block';
        if (elements.emptyStateIcon) elements.emptyStateIcon.textContent = iconText;
        if (elements.emptyStateTitle) elements.emptyStateTitle.textContent = title;
        if (elements.emptyStateHint) elements.emptyStateHint.textContent = description;
        updatePrimaryActionMenuVisibility();
    }

    function getDomainBadgeLabel(domain, maxLetters = 2) {
        const root = getDomainRoot(domain).replace(/[^a-z0-9]/gi, '');
        if (!root) return 'SV'.slice(0, maxLetters);
        return root.slice(0, maxLetters).toUpperCase();
    }

    function getScriptBadgeLabel(name, maxLetters = 2) {
        const words = String(name || 'Script').trim().split(/\s+/).filter(Boolean);
        if (!words.length) return 'SV'.slice(0, maxLetters);
        if (words.length > 1) {
            return words.slice(0, maxLetters).map(word => word[0]).join('').toUpperCase();
        }
        return words[0].replace(/[^a-z0-9]/gi, '').slice(0, maxLetters).toUpperCase() || 'SV'.slice(0, maxLetters);
    }

    function buildPopupIconBadgeHtml(label, hue, mode = getMarkerMode()) {
        const classes = ['script-icon-badge'];
        if (mode === 'duckduckgo') classes.push('compact');
        if (mode === 'none') classes.push('minimal');
        const style = mode === 'none' ? '' : ` style="--script-icon-hue:${hue}"`;
        return `<span class="${classes.join(' ')}"${style}>${mode === 'none' ? '' : escapeHtml(label)}</span>`;
    }

    function buildPopupIconBadge(label, hue, mode = getMarkerMode()) {
        const span = document.createElement('span');
        span.className = 'script-icon-badge';
        if (mode === 'duckduckgo') span.classList.add('compact');
        if (mode === 'none') span.classList.add('minimal');
        if (mode !== 'none') {
            span.style.setProperty('--script-icon-hue', hue);
            span.textContent = label;
        }
        return span;
    }
    
    function getPopupChromeVersion() {
        const match = navigator.userAgent.match(/(?:Chrome|Chromium)\/(\d+)/);
        return match ? Number.parseInt(match[1], 10) : 0;
    }

    function isPopupFirefox() {
        return /Firefox\//.test(navigator.userAgent || '');
    }

    function buildPopupSetupDoctorView(status = {}) {
        if (setupDoctor?.buildSetupDoctorView) {
            return setupDoctor.buildSetupDoctorView(status, {
                browserName: isPopupFirefox() ? 'firefox' : 'chromium',
                chromeVersion: getPopupChromeVersion(),
                extensionId: chrome.runtime?.id || '',
                surface: 'popup'
            });
        }
        return {
            setupState: status.setupState || 'unsupported-browser',
            title: status.setupTitle || 'Setup Required',
            message: status.setupMessage || 'Runtime setup is required before scripts can run.',
            bannerText: status.setupMessage || 'Runtime setup is required before scripts can run.',
            actionLabel: status.setupAction || 'Open Extension Details',
            actionKind: 'open-extension-details',
            setupUrl: status.setupUrl || `chrome://extensions/?id=${chrome.runtime?.id || ''}`
        };
    }

    function buildPopupSetupFallback(message = '') {
        const chromeVersion = getPopupChromeVersion();
        let setupState = 'unsupported-browser';
        if (isPopupFirefox()) {
            setupState = 'firefox-user-scripts-permission';
        } else if (chromeVersion >= 138) {
            setupState = 'allow-user-scripts-disabled';
        } else if (chromeVersion >= 120) {
            setupState = 'developer-mode-disabled';
        }
        const view = buildPopupSetupDoctorView({
            userScriptsAvailable: false,
            setupState,
            setupMessage: message || '',
            chromeVersion
        });
        return {
            setupState: view.setupState,
            setupTitle: view.title,
            setupMessage: view.message,
            setupAction: view.actionLabel,
            setupActionKind: view.actionKind,
            setupUrl: view.setupUrl,
            chromeVersion
        };
    }

    // Check if userScripts API is available and enabled
    async function checkUserScriptsAvailability() {
        try {
            // Use background's getExtensionStatus for Chrome version-aware messaging
            const status = await chrome.runtime.sendMessage({ action: 'getExtensionStatus' });
            userScriptsAvailable = status?.userScriptsAvailable !== false;

            if (!userScriptsAvailable) {
                showSetupWarning(status);
            } else {
                hideSetupWarning();
            }
        } catch (error) {
            // Fallback: check directly
            if (!chrome.userScripts) {
                userScriptsAvailable = false;
                showSetupWarning(buildPopupSetupFallback());
            } else {
                try {
                    await chrome.userScripts.getScripts();
                    userScriptsAvailable = true;
                    hideSetupWarning();
                } catch (e) {
                    userScriptsAvailable = false;
                    showSetupWarning(buildPopupSetupFallback(e?.message));
                }
            }
        }
    }

    async function requestFirefoxUserScriptsPermissionFromPopup() {
        if (!chrome.permissions?.request) {
            showPopupToast(tPopup('popupFirefoxPermissionUnavailable', 'Firefox permission request API is unavailable'), 'error');
            return false;
        }
        const granted = await chrome.permissions.request({ permissions: ['userScripts'] });
        if (!granted) {
            showPopupToast(tPopup('popupFirefoxPermissionDenied', 'Firefox userScripts permission was not granted'), 'error');
            return false;
        }
        const result = await chrome.runtime.sendMessage({ action: 'repairRuntimeState' });
        if (result?.error || result?.success === false || result?.userScriptsAvailable === false) {
            showPopupToast(result?.error || result?.setupMessage || 'Runtime still needs setup', 'error');
            return false;
        }
        showPopupToast(tPopup('popupFirefoxPermissionGranted', 'Firefox userScripts permission granted'));
        await checkUserScriptsAvailability();
        await loadPageScripts();
        return true;
    }

    function clearHostPermissionWarning() {
        hostPermissionStatus = null;
        if (setupStatus?.setupState === 'host-permission-needed') {
            hideSetupWarning();
        }
    }

    function summarizeHostPermissionWarning(status) {
        const blocked = Array.isArray(status?.blockedScripts) ? status.blockedScripts : [];
        const names = blocked.slice(0, 2).map(script => script.name || script.id || 'script').join(', ');
        const more = status.blockedCount > blocked.slice(0, 2).length
            ? ` and ${status.blockedCount - blocked.slice(0, 2).length} more`
            : '';
        const target = status?.host || 'this site';
        if (names) {
            return `${names}${more} cannot run until ScriptVault is granted browser access to ${target}.`;
        }
        return status?.message || `Grant ScriptVault browser access to ${target} before matching scripts can run.`;
    }

    async function refreshHostPermissionWarning() {
        if (!userScriptsAvailable || !currentUrl || !canMatchScriptsForUrl(currentUrl)) {
            clearHostPermissionWarning();
            return null;
        }

        try {
            const status = await chrome.runtime.sendMessage({ action: 'getHostPermissionStatus', url: currentUrl });
            hostPermissionStatus = status || null;
            if (status?.needsHostAccess) {
                showSetupWarning({
                    setupState: 'host-permission-needed',
                    setupTitle: 'Site access needed',
                    setupMessage: summarizeHostPermissionWarning(status),
                    setupAction: status.requestMethod === 'addHostAccessRequest' ? 'Request Site Access' : 'Grant Site Access',
                    setupUrl: '',
                    pattern: status.pattern,
                    host: status.host,
                    requestMethod: status.requestMethod
                });
            } else if (setupStatus?.setupState === 'host-permission-needed') {
                hideSetupWarning();
            }
            return status;
        } catch (error) {
            clearHostPermissionWarning();
            return null;
        }
    }

    async function requestHostPermissionFromPopup() {
        const status = hostPermissionStatus || await refreshHostPermissionWarning();
        if (!status?.supported || !status.pattern) {
            showPopupToast(status?.message || tPopup('popupHostAccessUnavailable', 'Host access is not available for this page'), 'warning');
            return false;
        }

        if (status.requestMethod === 'addHostAccessRequest') {
            const response = await chrome.runtime.sendMessage({
                action: 'queueHostAccessRequest',
                url: currentUrl,
                tabId: currentTab?.id
            });
            if (response?.error || response?.success === false) {
                throw new Error(response?.error || 'Could not queue site access request');
            }
            showPopupToast(response.message || tPopup('popupSiteAccessRequestAdded', 'Site access request added'), 'info');
            await refreshHostPermissionWarning();
            return true;
        }

        if (chrome.permissions?.request) {
            const granted = await chrome.permissions.request({ origins: [status.pattern] });
            if (!granted) {
                showPopupToast(tPopup('popupSiteAccessNotGranted', 'Site access was not granted'), 'warning');
                await refreshHostPermissionWarning();
                return false;
            }
            showPopupToast(tPopup('popupSiteAccessGranted', 'Site access granted'));
            await loadPageScripts();
            return true;
        }

        await chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` });
        window.close();
        return false;
    }

    function showSetupWarning(statusOrMessage) {
        if (elements.setupWarning) {
            const status = typeof statusOrMessage === 'string'
                ? buildPopupSetupFallback(statusOrMessage)
                : (statusOrMessage || buildPopupSetupFallback());
            const setupView = buildPopupSetupDoctorView(status);
            setupStatus = {
                ...status,
                setupState: setupView.setupState,
                setupTitle: setupView.title,
                setupMessage: setupView.message,
                setupAction: setupView.actionLabel,
                setupActionKind: setupView.actionKind,
                setupUrl: setupView.setupUrl
            };
            elements.setupWarning.classList.add('visible');
            elements.setupWarning.dataset.setupState = setupStatus.setupState || 'unknown';
            const titleEl = elements.setupWarning.querySelector('.setup-warning-title-text');
            if (titleEl && setupStatus.setupTitle) titleEl.textContent = setupStatus.setupTitle;
            // Keep the warning title/icon intact and update only the explanatory text.
            const msgEl = elements.setupWarning.querySelector('.setup-warning-text');
            if (msgEl && setupStatus.setupMessage) msgEl.textContent = setupStatus.setupMessage;
            if (elements.btnOpenExtSettings && setupStatus.setupAction) {
                elements.btnOpenExtSettings.textContent = setupStatus.setupAction;
            }
        }
    }

    function hideSetupWarning() {
        setupStatus = null;
        if (elements.setupWarning) {
            elements.setupWarning.classList.remove('visible');
            delete elements.setupWarning.dataset.setupState;
        }
    }

    // Load settings
    async function loadSettings() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
            settings = response?.settings || response || {};
        } catch (error) {
            console.error('Failed to load settings:', error);
            settings = { enabled: true };
        }
        // Apply theme from settings
        const layout = settings.layout || 'dark';
        const theme = layout === 'auto'
            ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
            : layout;
        document.documentElement.setAttribute('data-theme', theme);
        if (layout === 'auto') {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                if (settings.layout === 'auto') {
                    document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
                }
            });
        }
    }

    // Get current tab
    // Per-tab "why didn't my script run?" diagnostics. Fetches a background
    // computed status for every script against the current URL and renders a
    // plain-language reason list. Toggles the panel open/closed.
    async function toggleDiagnostics() {
        const panel = elements.diagnosePanel;
        const btn = elements.btnDiagnose;
        if (!panel) return;
        if (!panel.hidden) {
            panel.hidden = true;
            btn?.setAttribute('aria-expanded', 'false');
            return;
        }
        panel.hidden = false;
        btn?.setAttribute('aria-expanded', 'true');
        safeSetHtml(panel, `<div class="diagnose-summary">${escapeHtml(tPopup('popupCheckingThisPage', 'Checking this page...'))}</div>`);
        try {
            const res = await chrome.runtime.sendMessage({ action: 'diagnoseScripts', url: currentUrl });
            renderDiagnostics(res);
        } catch (e) {
            safeSetHtml(panel, `<div class="diagnose-summary">${escapeHtml(tPopup('popupCouldNotReachBackground', 'Could not reach the background service.'))}</div>`);
        }
    }

    function renderDiagnostics(res) {
        const panel = elements.diagnosePanel;
        if (!panel) return;
        const scripts = Array.isArray(res?.scripts) ? res.scripts : [];
        if (scripts.length === 0) {
            safeSetHtml(panel, `<div class="diagnose-summary">${escapeHtml(tPopup('popupNoScriptsInstalledYet', 'No scripts are installed yet.'))}</div>`);
            return;
        }
        const running = scripts.filter(s => s.status === 'running').length;
        const order = { error: 0, blocked: 1, 'not-registered': 2, 'no-match': 3, disabled: 4, paused: 5, 'on-demand': 6, scheduled: 7, background: 8, running: 9 };
        const sorted = scripts.slice().sort((a, b) => {
            const statusOrder = (order[a.status] ?? 99) - (order[b.status] ?? 99);
            if (statusOrder !== 0) return statusOrder;
            const nameA = String(a.name || a.id || '');
            const nameB = String(b.name || b.id || '');
            return nameA.localeCompare(nameB);
        });
        let html = `<div class="diagnose-summary">${escapeHtml(
            running === scripts.length
                ? 'All matching scripts are running on this page.'
                : `${running} of ${scripts.length} script${scripts.length === 1 ? '' : 's'} running here.`
        )}</div>`;
        for (const s of sorted) {
            const status = String(s.status || '').replace(/[^a-z-]/gi, '');
            html += `
                <div class="diagnose-row">
                    <span class="diagnose-dot ${status}" aria-hidden="true"></span>
                    <span class="diagnose-text">
                        <span class="diagnose-name">${escapeHtml(s.name || s.id)}</span>
                        <span class="diagnose-reason">${escapeHtml(s.reason || '')}</span>
                    </span>
                </div>`;
        }
        safeSetHtml(panel, html);
    }

    async function getCurrentTab() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            currentTab = tab;
            currentUrl = tab?.url || '';
        } catch (error) {
            console.error('Failed to get current tab:', error);
        }
    }

    // Load scripts for current page (with 5s timeout)
    async function loadPageScripts() {
        if (!currentUrl) {
            clearHostPermissionWarning();
            pageScripts = [];
            renderScriptList();
            updateEnabledState();
            showPopupEmptyState('No page selected', 'Open a tab to see which scripts match it.', 'SV');
            return;
        }

        if (!canMatchScriptsForUrl(currentUrl)) {
            clearHostPermissionWarning();
            pageScripts = [];
            renderScriptList();
            updateEnabledState();
            showPopupEmptyState('Scripts don’t run here', 'Browser pages, extension pages, and other internal surfaces block userscripts.', '!');
            return;
        }

        try {
            const response = await Promise.race([
                chrome.runtime.sendMessage({ action: 'getScriptsForUrl', url: currentUrl }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
            ]);

            // Phase 39.23 — defensive coercion, see loadAllScripts() comment.
            pageScripts = Array.isArray(response) ? response : Array.from(response ?? []);
            renderScriptList();
            updateEnabledState();
            await refreshHostPermissionWarning();
        } catch (error) {
            console.error('Failed to load scripts:', error);
            pageScripts = [];
            renderScriptList();
            updateEnabledState();
            const isTimeout = error.message === 'timeout';
            showPopupEmptyState(
                isTimeout ? 'ScriptVault is loading\u2026' : 'Connection error',
                isTimeout
                    ? 'The background service is still starting up. Try again in a moment.'
                    : 'Could not connect to the ScriptVault background service.',
                '!'
            );
        }
    }

    // Update enabled state UI
    function updateEnabledState() {
        const enabled = settings.enabled !== false;

        if (elements.headerToggle) {
            elements.headerToggle.setAttribute('aria-pressed', String(enabled));
        }
        if (elements.headerCheckIcon) {
            elements.headerCheckIcon.classList.toggle('disabled', !enabled);
        }

        // Update script count badge
        if (elements.headerCount) {
            const enabledCount = pageScripts.filter(s => s.enabled !== false).length;
            elements.headerCount.textContent = enabledCount > 0 ? enabledCount : '';
            elements.headerCount.classList.toggle('disabled', !enabled);
        }
    }

    function getRuntimeError(result, fallback = 'Action failed') {
        if (!result) return fallback;
        if (result.error) return result.error;
        if (result.success === false) return fallback;
        return '';
    }

    function formatImportSummary(result) {
        if (!result || result.error) return '';
        const imported = Number(result.imported || 0);
        const skipped = Number(result.skipped || 0);
        const failed = Array.isArray(result.errors) ? result.errors.length : 0;
        const parts = [];
        if (imported) parts.push(tPopup('popupImportSummaryImported', 'Imported {count}', { count: numberFormatter.format(imported) }));
        if (skipped) parts.push(tPopup('popupImportSummarySkipped', 'Skipped {count}', { count: numberFormatter.format(skipped) }));
        if (failed) parts.push(tPopup('popupImportSummaryFailed', 'Failed {count}', { count: numberFormatter.format(failed) }));
        return parts.join(' • ') || tPopup('popupImportSummaryNoChange', 'Nothing changed');
    }

    // Shared dropdown state (module-level to avoid listener accumulation)
    let activeDropdownScriptId = null;
    let dropdownListenersAttached = false;
    let pendingDeleteScriptId = null;
    let pendingPopupFocusDescriptor = null;

    function getDropdownDeleteButton() {
        return document.querySelector('#scriptDropdown [data-action="delete"]');
    }

    function getDropdownTriggerButton(scriptId) {
        if (!elements.scriptList || !scriptId) return null;
        return elements.scriptList.querySelector(`[data-more-id="${escapeSelectorValue(scriptId)}"]`);
    }

    function resetDropdownDeleteState() {
        pendingDeleteScriptId = null;
        const deleteBtn = getDropdownDeleteButton();
        if (!deleteBtn) return;
        deleteBtn.textContent = tPopup('delete', 'Delete');
        deleteBtn.classList.remove('confirming');
    }

    function closeScriptDropdown({ restoreFocus = false } = {}) {
        const previousScriptId = activeDropdownScriptId;
        const trigger = getDropdownTriggerButton(previousScriptId);
        activeDropdownScriptId = null;
        resetDropdownDeleteState();
        const dropdown = document.getElementById('scriptDropdown');
        if (trigger) {
            trigger.setAttribute('aria-expanded', 'false');
        }
        try { dropdown?.hidePopover(); } catch {}
        if (restoreFocus) {
            trigger?.focus();
        }
    }

    function getDropdownMenuItems() {
        const dropdown = document.getElementById('scriptDropdown');
        if (!dropdown) return [];
        return Array.from(dropdown.querySelectorAll('[role="menuitem"]:not([disabled])'));
    }

    function configureScriptDropdown(scriptId) {
        const dropdown = document.getElementById('scriptDropdown');
        if (!dropdown) return;
        const script = pageScripts.find((item) => item.id === scriptId) || allScripts.find((item) => item.id === scriptId);
        const meta = script?.metadata || script?.meta || {};
        const name = meta.name || 'this script';
        const hasUpdateUrl = Boolean(meta.updateURL || meta.downloadURL);
        const installUrl = meta.downloadURL || meta.updateURL || '';
        const updateBtn = dropdown.querySelector('[data-action="update"]');
        const copyUrlBtn = dropdown.querySelector('[data-action="copyUrl"]');
        const pinBtn = dropdown.querySelector('[data-action="pin"]');

        dropdown.setAttribute('aria-label', tPopup('popupDropdownActionsForScript', 'Actions for {name}', { name }));

        if (updateBtn) {
            updateBtn.disabled = !hasUpdateUrl;
            updateBtn.textContent = hasUpdateUrl ? tPopup('popupCheckForUpdate', 'Check for Update') : tPopup('popupNoUpdateChannel', 'No Update Channel');
            updateBtn.title = hasUpdateUrl
                ? tPopup('popupCheckScriptRemoteTitle', 'Check {name} against its remote update URL.', { name })
                : tPopup('popupNoUpdateMetadataTitle', '{name} does not declare @updateURL or @downloadURL metadata.', { name });
        }

        if (copyUrlBtn) {
            copyUrlBtn.disabled = !installUrl;
            copyUrlBtn.textContent = installUrl ? tPopup('popupCopyInstallUrl', 'Copy Install URL') : tPopup('popupNoInstallUrl', 'No Install URL');
            copyUrlBtn.title = installUrl
                ? tPopup('popupCopyScriptInstallUrlTitle', "Copy {name}'s remote install URL.", { name })
                : tPopup('popupNoRemoteInstallUrlTitle', '{name} does not declare a remote install URL.', { name });
        }

        if (pinBtn) {
            pinBtn.textContent = script?.settings?.pinned ? tPopup('popupUnpinScript', 'Unpin Script') : tPopup('popupPinScript', 'Pin Script');
        }
    }

    function focusDropdownMenuItem(target = 0) {
        const items = getDropdownMenuItems();
        if (!items.length) return;
        const nextItem = typeof target === 'number'
            ? (target < 0 ? items[items.length - 1] : items[target])
            : target;
        nextItem?.focus();
    }

    function openScriptDropdown(scriptId, trigger, { focusTarget = 0 } = {}) {
        const dropdown = document.getElementById('scriptDropdown');
        if (!dropdown || !scriptId || !trigger) return;
        if (dropdown.matches(':popover-open') && activeDropdownScriptId === scriptId) {
            closeScriptDropdown({ restoreFocus: true });
            return;
        }
        closeScriptDropdown();
        activeDropdownScriptId = scriptId;
        resetDropdownDeleteState();
        configureScriptDropdown(scriptId);
        populateMenuCommands(scriptId);
        const rect = trigger.getBoundingClientRect();
        dropdown.style.right = (document.documentElement.clientWidth - rect.right) + 'px';
        trigger.setAttribute('aria-expanded', 'true');
        dropdown.showPopover();
        const dropRect = dropdown.getBoundingClientRect();
        const viewportH = document.documentElement.clientHeight;
        if (rect.bottom + 2 + dropRect.height > viewportH && rect.top - dropRect.height - 2 >= 0) {
            dropdown.style.top = (rect.top - dropRect.height - 2) + 'px';
        } else {
            dropdown.style.top = Math.min(rect.bottom + 2, viewportH - dropRect.height - 4) + 'px';
        }
        requestAnimationFrame(() => focusDropdownMenuItem(focusTarget));
    }

    function armDropdownDelete(scriptId, name) {
        pendingDeleteScriptId = scriptId;
        const deleteBtn = getDropdownDeleteButton();
        if (deleteBtn) {
            deleteBtn.textContent = tPopup('popupConfirmDelete', 'Confirm Delete');
            deleteBtn.classList.add('confirming');
        }
        showPopupToast(tPopup('popupConfirmDeleteToast', 'Click delete again to remove "{name}"', { name }));
    }

    // Render script list
    // Phase 38.4 — Render the @run-at context-menu script section as a
    // dedicated one-tap-launcher block above the normal script list.
    // ScriptVault already supports `@run-at context-menu` end-to-end (parser
    // + ctx menu registration); the popup surface matches TM 5.5.6234's
    // "Run on this page" UX. Click → runScriptNow via the existing handler
    // that v3.4.0 shipped.
    function renderContextMenuScripts(scripts) {
        const section = elements.contextMenuSection;
        const list = elements.contextMenuScriptsList;
        const count = elements.contextMenuScriptsCount;
        if (!section || !list || !count) return;

        const ctxScripts = (scripts || []).filter((s) => {
            if (s.enabled === false) return false;
            const meta = s.metadata || s.meta || {};
            return meta['run-at'] === 'context-menu';
        });

        if (ctxScripts.length === 0) {
            section.hidden = true;
            list.replaceChildren();
            count.textContent = '0';
            return;
        }

        section.hidden = false;
        count.textContent = String(ctxScripts.length);
        safeSetHtml(list, ctxScripts.map((script) => {
            const meta = script.metadata || script.meta || {};
            const name = meta.name || tPopup('popupUnnamedScript', 'Unnamed Script');
            const icon = getScriptIcon(script);
            const idAttr = escapeHtml(script.id);
            return `
                <button class="context-menu-script-row" type="button" role="listitem"
                        data-ctx-run-id="${idAttr}" aria-label="${escapeHtml(tPopup('popupRunNamedScriptOnTab', 'Run {name} on this tab', { name }))}">
                    <span class="ctx-icon" aria-hidden="true">${icon}</span>
                    <span class="ctx-name">${escapeHtml(name)}</span>
                    <span class="ctx-run-hint" aria-hidden="true">${escapeHtml(tPopup('popupRunHint', 'Run'))}</span>
                </button>
            `;
        }).join(''));

        list.querySelectorAll('.context-menu-script-row').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const scriptId = btn.getAttribute('data-ctx-run-id');
                if (!scriptId) return;
                await runScriptAction(scriptId, async () => {
                    try {
                        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                        if (!tab?.id) { showPopupToast(tPopup('popupNoActiveTab', 'No active tab'), 'error'); return; }
                        const result = await chrome.runtime.sendMessage({
                            action: 'runScriptNow', scriptId, tabId: tab.id,
                        });
                        if (result?.success) showPopupToast(tPopup('popupScriptRanOnTab', 'Script ran on this tab'));
                        else showPopupToast(result?.error || tPopup('popupRunFailed', 'Run failed'), 'error');
                    } catch (err) {
                        showPopupToast(err?.message || tPopup('popupRunFailed', 'Run failed'), 'error');
                    }
                });
            });
        });
    }

    function renderScriptList() {
        if (!elements.scriptList) return;
        const focusDescriptor = pendingPopupFocusDescriptor
            || (elements.scriptList.contains(document.activeElement) ? getPopupFocusDescriptor(document.activeElement) : null);
        pendingPopupFocusDescriptor = null;
        closeScriptDropdown();

        // Phase 38.4 — Surface @run-at context-menu scripts above the
        // normal list. The dedicated section is hidden when none match.
        renderContextMenuScripts(pageScripts);

        // Work on a copy to avoid mutating the canonical pageScripts array
        let displayScripts = [...pageScripts];

        // Filter: hide disabled scripts if setting enabled
        if (settings.hideDisabledPopup) {
            displayScripts = displayScripts.filter(s => s.enabled !== false);
        }

        // Sort scripts based on scriptOrder setting
        const order = settings.scriptOrder || 'auto';
        if (order === 'alpha') {
            displayScripts.sort((a, b) => {
                const na = (a.metadata || a.meta || {}).name || '';
                const nb = (b.metadata || b.meta || {}).name || '';
                return na.localeCompare(nb);
            });
        } else if (order === 'last-updated') {
            displayScripts.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        }

        // Always bump enabled scripts to the top
        displayScripts.sort((a, b) => (b.enabled !== false ? 1 : 0) - (a.enabled !== false ? 1 : 0));

        const emptyState = document.getElementById('emptyState');
        if (displayScripts.length === 0) {
            if (elements.scriptList) {
                elements.scriptList.hidden = true;
                elements.scriptList.classList.remove('loading');
                elements.scriptList.setAttribute('aria-busy', 'false');
                elements.scriptList.replaceChildren();
            }
            if (emptyState) emptyState.style.display = 'block';
            updateEmptyStateHint();
            updatePrimaryActionMenuVisibility();
            return;
        }
        if (emptyState) emptyState.style.display = 'none';
        if (elements.scriptList) {
            elements.scriptList.hidden = false;
            elements.scriptList.classList.remove('loading');
            elements.scriptList.setAttribute('aria-busy', 'false');
        }
        updatePrimaryActionMenuVisibility();

        safeSetHtml(elements.scriptList, displayScripts.map((script, i) => {
            const meta = script.metadata || script.meta || {};
            const name = meta.name || tPopup('popupUnnamedScript', 'Unnamed Script');
            const version = meta.version || '';
            const enabled = script.enabled !== false;
            const icon = getScriptIcon(script);
            const animDelay = `style="animation-delay: ${i * 30}ms"`;
            const rowLabel = [name, version ? tPopup('popupVersionLabel', 'version {version}', { version }) : ''].filter(Boolean).join(', ');
            const scriptIdAttr = escapeHtml(script.id);

            // Phase 40.17 — Surface the script's execution-world intent inline
            // with the name. ScriptVault always registers via chrome.userScripts
            // (USER_SCRIPT world), but `@inject-into content` is a deliberate
            // author signal that the script depends on isolated-world semantics
            // (no unsafeWindow, page CSP applies). `@inject-into page` signals
            // MAIN-world intent (currently falls back to USER_SCRIPT — flagged
            // so the user knows the author asked for it). Default `auto` shows
            // no badge to avoid wall-of-toggles clutter.
            const injectInto = meta['inject-into'];
            const worldBadgeHtml = injectInto === 'content'
                ? `<span class="script-world-badge world-content" title="Author requested content-script (isolated) world via @inject-into content">C</span>`
                : injectInto === 'page'
                    ? `<span class="script-world-badge world-page" title="Author requested MAIN world via @inject-into page (currently runs in USER_SCRIPT world)">M</span>`
                    : '';

            return `
                <div class="script-item${enabled ? '' : ' not-running'}" data-script-id="${scriptIdAttr}" role="listitem" tabindex="0" aria-posinset="${i + 1}" aria-setsize="${displayScripts.length}" aria-label="${escapeHtml(rowLabel)}" ${animDelay}>
                    <label class="script-toggle">
                        <input type="checkbox" ${enabled ? 'checked' : ''} data-toggle-id="${scriptIdAttr}" aria-label="${escapeHtml(enabled ? tPopup('popupDisableNamedScript', 'Disable {name}', { name }) : tPopup('popupEnableNamedScript', 'Enable {name}', { name }))}">
                        <span class="slider"></span>
                    </label>
                    <div class="script-icon">${icon}</div>
                    <div class="script-main">
                        <button class="script-name-btn" data-edit-id="${scriptIdAttr}" type="button" aria-label="${escapeHtml(tPopup('popupOpenNamedScriptInEditor', 'Open {name} in editor', { name }))}">
                            <span class="script-name-label">${escapeHtml(name)}</span>${version ? ` <span class="script-version">${escapeHtml(version)}</span>` : ''}${worldBadgeHtml}
                        </button>
                    </div>
                    <button class="script-quick-edit" data-quickedit-id="${scriptIdAttr}" type="button" aria-label="${escapeHtml(tPopup('popupQuickEditNamedScript', 'Quick edit {name}', { name }))}" title="${escapeHtml(tPopup('popupQuickEdit', 'Quick edit'))}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="script-more" data-more-id="${scriptIdAttr}" type="button" aria-label="${escapeHtml(tPopup('popupMoreActionsForScript', 'More actions for {name}', { name }))}" aria-haspopup="menu" aria-controls="scriptDropdown" aria-expanded="false">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
                        </svg>
                    </button>
                </div>
            `;
        }).join(''));

        // Shared dropdown element
        const dropdown = document.getElementById('scriptDropdown');
        if (!dropdown) return;

        // Attach per-item event listeners (these are on new DOM nodes each render, so no accumulation)
        elements.scriptList.querySelectorAll('.script-item').forEach(item => {
            const scriptId = item.dataset.scriptId;

            // Toggle checkbox
            const checkbox = item.querySelector('input[type="checkbox"]');
            checkbox?.addEventListener('change', (e) => {
                e.stopPropagation();
                toggleScript(scriptId, e.target.checked);
            });

            // Toggle label - prevent double-fire from row click
            const toggleLabel = item.querySelector('.script-toggle');
            toggleLabel?.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            // Script name click opens in dashboard editor
            item.querySelector('.script-name-btn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                openDashboard(scriptId);
            });

            item.addEventListener('keydown', (e) => {
                if ((e.key === 'Enter' || e.key === ' ') && e.target === item) {
                    e.preventDefault();
                    openDashboard(scriptId);
                }
            });

            // Quick edit button opens editor directly
            item.querySelector('.script-quick-edit')?.addEventListener('click', (e) => {
                e.stopPropagation();
                openDashboard(scriptId);
            });

            // More button (arrow) - position and show shared dropdown
            const moreBtn = item.querySelector('.script-more');
            moreBtn?.addEventListener('click', (e) => {
                e.stopPropagation();
                openScriptDropdown(scriptId, moreBtn);
            });

            moreBtn?.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    openScriptDropdown(scriptId, moreBtn, { focusTarget: 0 });
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    openScriptDropdown(scriptId, moreBtn, { focusTarget: -1 });
                }
            });
        });

        // Attach dropdown action listeners ONCE (they use module-level activeDropdownScriptId)
        if (!dropdownListenersAttached) {
            dropdownListenersAttached = true;

            dropdown.addEventListener('toggle', (e) => {
                if (e.newState === 'closed' && activeDropdownScriptId) {
                    const trigger = getDropdownTriggerButton(activeDropdownScriptId);
                    if (trigger) trigger.setAttribute('aria-expanded', 'false');
                    activeDropdownScriptId = null;
                    resetDropdownDeleteState();
                }
            });

            dropdown.querySelector('[data-action="edit"]')?.addEventListener('click', (e) => {
                e.stopPropagation();
                const scriptId = activeDropdownScriptId;
                closeScriptDropdown();
                if (scriptId) openDashboard(scriptId);
            });

            // Phase 11.4 — Run on This Tab. Fires the script once via the
            // background's runScriptNow handler (chrome.userScripts.execute()
            // when available, scripting.executeScript fallback otherwise).
            // The script doesn't have to be enabled or matching the URL.
            dropdown.querySelector('[data-action="runNow"]')?.addEventListener('click', async (e) => {
                e.stopPropagation();
                const scriptId = activeDropdownScriptId;
                queuePopupFocusRestore(getPopupFocusDescriptor(getDropdownTriggerButton(scriptId)));
                closeScriptDropdown();
                if (!scriptId) return;
                await runScriptAction(scriptId, async () => {
                    try {
                        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                        if (!tab?.id) {
                            showPopupToast(tPopup('popupNoActiveTab', 'No active tab'), 'error');
                            return;
                        }
                        const result = await chrome.runtime.sendMessage({
                            action: 'runScriptNow', scriptId, tabId: tab.id
                        });
                        if (result?.success) {
                            showPopupToast(tPopup('popupScriptRanOnTab', 'Script ran on this tab'));
                        } else {
                            showPopupToast(result?.error || tPopup('popupRunFailed', 'Run failed'), 'error');
                        }
                    } catch (err) {
                        showPopupToast(err?.message || tPopup('popupRunFailed', 'Run failed'), 'error');
                    }
                });
            });

            dropdown.querySelector('[data-action="update"]')?.addEventListener('click', async (e) => {
                e.stopPropagation();
                const scriptId = activeDropdownScriptId;
                queuePopupFocusRestore(getPopupFocusDescriptor(getDropdownTriggerButton(scriptId)));
                closeScriptDropdown();
                if (!scriptId) return;
                await runScriptAction(scriptId, async () => {
                    showPopupToast(tPopup('popupCheckingForUpdate', 'Checking for update...'));
                    try {
                        const updates = await chrome.runtime.sendMessage({ action: 'checkUpdates', scriptId });
                        if (updates && updates.length > 0) {
                            await chrome.runtime.sendMessage({ action: 'applyUpdate', scriptId, code: updates[0].code, sourceUrl: updates[0].sourceUrl || '' });
                            showPopupToast(tPopup('popupUpdatedToVersion', 'Updated to v{version}', { version: updates[0].newVersion }));
                            await loadPageScripts();
                        } else {
                            showPopupToast(tPopup('popupAlreadyUpToDate', 'Already up to date'));
                        }
                    } catch (err) {
                        showPopupToast(tPopup('popupUpdateCheckFailed', 'Update check failed'), 'error');
                    }
                });
            });

            dropdown.querySelector('[data-action="copyUrl"]')?.addEventListener('click', async (e) => {
                e.stopPropagation();
                const scriptId = activeDropdownScriptId;
                closeScriptDropdown();
                if (!scriptId) return;
                const script = pageScripts.find(s => s.id === scriptId);
                const url = (script?.metadata || script?.meta || {}).downloadURL || (script?.metadata || script?.meta || {}).updateURL;
                if (url) {
                    try {
                        await copyTextToClipboard(url);
                        showPopupToast(tPopup('popupInstallUrlCopied', 'Install URL copied'));
                    } catch { showPopupToast(tPopup('popupCopyFailed', 'Copy failed'), 'error'); }
                } else {
                    showPopupToast(tPopup('popupNoDownloadUrl', 'No download URL'), 'error');
                }
            });

            dropdown.querySelector('[data-action="pin"]')?.addEventListener('click', async (e) => {
                e.stopPropagation();
                const scriptId = activeDropdownScriptId;
                queuePopupFocusRestore(getPopupFocusDescriptor(getDropdownTriggerButton(scriptId)));
                closeScriptDropdown();
                if (!scriptId) return;
                await runScriptAction(scriptId, async () => {
                    const script = pageScripts.find(s => s.id === scriptId);
                    if (!script) return;
                    const nextSettings = { ...(script.settings || {}), pinned: !script.settings?.pinned };
                    try {
                        const result = await chrome.runtime.sendMessage({ action: 'setScriptSettings', scriptId, settings: nextSettings });
                        const error = getRuntimeError(result, tPopup('popupUnableUpdatePin', 'Unable to update pin state'));
                        if (error) throw new Error(error);
                        script.settings = nextSettings;
                        const allScript = allScripts.find(s => s.id === scriptId);
                        if (allScript) allScript.settings = nextSettings;
                        renderScriptList();
                        updateEnabledState();
                        showPopupToast(nextSettings.pinned ? tPopup('popupPinned', 'Pinned') : tPopup('popupUnpinned', 'Unpinned'));
                    } catch (error) {
                        showPopupToast(error.message || tPopup('popupUnableUpdatePin', 'Unable to update pin state'), 'error');
                    }
                });
            });

            dropdown.querySelector('[data-action="restrictSite"]')?.addEventListener('click', async (e) => {
                e.stopPropagation();
                const scriptId = activeDropdownScriptId;
                queuePopupFocusRestore(getPopupFocusDescriptor(getDropdownTriggerButton(scriptId)));
                closeScriptDropdown();
                if (!scriptId) return;
                let hostPattern = '';
                try {
                    if (!canMatchScriptsForUrl(currentUrl)) throw new Error('restricted-page');
                    const host = new URL(currentUrl).hostname;
                    if (!host) throw new Error('no-host');
                    // Chrome match patterns cannot express IPv6 (bracketed) hosts;
                    // a pattern like *://[::1]/* is rejected by registration and
                    // silently falls back to <all_urls> — the opposite of scoping.
                    // Refuse rather than accidentally widen the script to every site.
                    if (host.includes('[') || host.includes(']') || host.includes(':')) {
                        throw new Error('unsupported-host');
                    }
                    hostPattern = `*://${host}/*`;
                } catch (err) {
                    const msg = err && err.message === 'unsupported-host'
                        ? tPopup('popupUnsupportedScopeHost', "This site can't be scoped (IP-literal host)")
                        : tPopup('popupOpenNormalPageFirst', 'Open a normal web page first');
                    showPopupToast(msg, 'info');
                    return;
                }
                await runScriptAction(scriptId, async () => {
                    const script = pageScripts.find(s => s.id === scriptId);
                    if (!script) return;
                    // Replace the script's original @match AND @include with a single
                    // site-scoped pattern so it only runs on the current site. Both
                    // must be overridden — a legacy script with only @include *
                    // would otherwise keep running everywhere.
                    const nextSettings = {
                        ...(script.settings || {}),
                        useOriginalMatches: false,
                        useOriginalIncludes: false,
                        userMatches: [hostPattern],
                    };
                    try {
                        const result = await chrome.runtime.sendMessage({ action: 'setScriptSettings', scriptId, settings: nextSettings });
                        const error = getRuntimeError(result, tPopup('popupUnableRestrictScope', 'Unable to restrict scope'));
                        if (error) throw new Error(error);
                        script.settings = nextSettings;
                        const allScript = allScripts.find(s => s.id === scriptId);
                        if (allScript) allScript.settings = nextSettings;
                        renderScriptList();
                        showPopupToast(tPopup('popupRestrictedToHost', 'Restricted to {host}', { host: new URL(currentUrl).hostname }));
                    } catch (error) {
                        showPopupToast(error.message || tPopup('popupUnableRestrictScope', 'Unable to restrict scope'), 'error');
                    }
                });
            });

            dropdown.querySelector('[data-action="delete"]')?.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!activeDropdownScriptId) return;
                const scriptId = activeDropdownScriptId;
                const script = pageScripts.find(s => s.id === scriptId);
                const name = (script?.metadata || script?.meta || {}).name || 'this script';
                if (pendingDeleteScriptId !== scriptId) {
                    armDropdownDelete(scriptId, name);
                    return;
                }
                queuePopupFocusRestore(getPopupFocusDescriptor(getDropdownTriggerButton(scriptId)));
                closeScriptDropdown();
                deleteScript(scriptId);
            });

            dropdown.addEventListener('keydown', (e) => {
                const items = getDropdownMenuItems();
                if (!items.length) return;
                const currentIndex = items.indexOf(document.activeElement);
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    focusDropdownMenuItem((currentIndex + 1 + items.length) % items.length);
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    focusDropdownMenuItem((currentIndex - 1 + items.length) % items.length);
                } else if (e.key === 'Home') {
                    e.preventDefault();
                    focusDropdownMenuItem(0);
                } else if (e.key === 'End') {
                    e.preventDefault();
                    focusDropdownMenuItem(-1);
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    closeScriptDropdown({ restoreFocus: true });
                } else if (e.key === 'Tab') {
                    closeScriptDropdown();
                }
            });
        }

        if (focusDescriptor) {
            requestAnimationFrame(() => restorePopupFocus(focusDescriptor));
        }
    }

    // Populate per-script menu commands in the dropdown
    async function populateMenuCommands(scriptId) {
        const container = document.getElementById('dropdownMenuCmds');
        if (!container) return;
        container.replaceChildren();
        try {
            const data = await chrome.storage.session.get('menuCommands');
            const cmds = data?.menuCommands?.[scriptId] || [];
            for (const cmd of cmds) {
                const el = document.createElement('button');
                el.className = 'script-dropdown-cmd';
                el.type = 'button';
                el.setAttribute('role', 'menuitem');
                el.textContent = cmd.caption || cmd.name || 'Command';
                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    closeScriptDropdown();
                    if (currentTab?.id) {
                        chrome.tabs.sendMessage(currentTab.id, {
                            action: 'executeMenuCommand',
                            data: { scriptId, commandId: cmd.id }
                        }).catch(() => {});
                    }
                });
                container.appendChild(el);
            }
        } catch {}
    }

    // Get favicon icon HTML for script (matches dashboard style)
    function getScriptIcon(script) {
        const meta = script.metadata || script.meta || {};
        const iconUrl = meta.icon || meta.iconURL;
        const mode = getMarkerMode();
        const patterns = [...(meta.match || []), ...(meta.include || [])];
        let domain = '';

        for (const pattern of patterns) {
            const m = pattern.match(/^(?:\*|https?|file):\/\/(?:\*\.)?([^\/\*]+)/);
            if (m) {
                domain = m[1].replace(/^\*\./, '').replace(/^www\./, '').toLowerCase();
                if (domain && domain !== '*' && !domain.includes('*')) break;
            }
        }

        const maxLetters = mode === 'duckduckgo' ? 1 : 2;
        const label = domain
            ? getDomainBadgeLabel(domain, maxLetters)
            : getScriptBadgeLabel(meta.name || script.id, maxLetters);
        const hue = hashMarkerSeed(domain || meta.name || script.id);

        const safeIconUrl = iconUrl ? sanitizeUrl(iconUrl) : '';
        if (safeIconUrl) {
            return `<img src="${escapeHtml(safeIconUrl)}" width="16" height="16" alt="" loading="lazy" data-favicon-fallback="true" data-fallback-label="${escapeHtml(label)}" data-fallback-hue="${hue}" data-fallback-mode="${mode}">`;
        }

        return buildPopupIconBadgeHtml(label, hue, mode);
    }

    // Toggle script enabled/disabled
    async function toggleScript(scriptId, enabled) {
        await runScriptAction(scriptId, async () => {
            try {
                const result = await chrome.runtime.sendMessage({
                    action: 'toggleScript',
                    scriptId: scriptId,
                    enabled: enabled
                });
                const error = getRuntimeError(result, tPopup('popupFailedUpdateScript', 'Failed to update script'));
                if (error) throw new Error(error);

                // Update local state in both arrays
                const script = pageScripts.find(s => s.id === scriptId);
                if (script) script.enabled = enabled;
                const allScript = allScripts.find(s => s.id === scriptId);
                if (allScript) allScript.enabled = enabled;

                // Re-render so enabled sort + visual state updates
                renderScriptList();
                updateEnabledState();
                updateBadgeForTab();
            } catch (error) {
                console.error('Failed to toggle script:', error);
                showPopupToast(error.message || tPopup('popupFailedUpdateScript', 'Failed to update script'), 'error');
                // Toggle failed — restore both arrays to the pre-toggle state so
                // the re-render puts the checkbox back. (Local state is only
                // mutated on success above, but keep this explicit and correct.)
                const revScript = pageScripts.find(s => s.id === scriptId);
                if (revScript) revScript.enabled = !enabled;
                const revAll = allScripts.find(s => s.id === scriptId);
                if (revAll) revAll.enabled = !enabled;
                renderScriptList();
            }
        });
    }

    // Delete a script
    async function deleteScript(scriptId) {
        await runScriptAction(scriptId, async () => {
            try {
                const result = await chrome.runtime.sendMessage({
                    action: 'deleteScript',
                    scriptId: scriptId
                });
                const error = getRuntimeError(result, tPopup('popupFailedDeleteScript', 'Failed to delete script'));
                if (error) throw new Error(error);

                // Remove from both local arrays and re-render
                pageScripts = pageScripts.filter(s => s.id !== scriptId);
                allScripts = allScripts.filter(s => s.id !== scriptId);
                renderScriptList();
                updateEnabledState();
                updateBadgeForTab();
                const deletedName = result?.scriptName || tPopup('scriptDeleted', 'Script deleted');
                showPopupToast(tPopup('popupDeletedScript', 'Deleted {name}', { name: deletedName }));
            } catch (error) {
                console.error('Failed to delete script:', error);
                showPopupToast(error.message || tPopup('popupFailedDeleteScript', 'Failed to delete script'), 'error');
            }
        });
    }

    // Toggle global scripts enabled/disabled
    async function toggleGlobalEnabled() {
        const newEnabled = settings.enabled === false;
        
        try {
            const result = await chrome.runtime.sendMessage({
                action: 'setSettings',
                settings: { enabled: newEnabled }
            });
            const error = getRuntimeError(result, tPopup('popupFailedUpdateScriptVault', 'Failed to update ScriptVault'));
            if (error) throw new Error(error);

            settings.enabled = result?.enabled ?? newEnabled;
            updateEnabledState();

            // Update badge
            updateBadgeForTab();
            showPopupToast(settings.enabled === false ? tPopup('popupScriptVaultPaused', 'ScriptVault paused') : tPopup('popupScriptVaultEnabled', 'ScriptVault enabled'));
        } catch (error) {
            console.error('Failed to toggle global enabled:', error);
            showPopupToast(error.message || tPopup('popupFailedUpdateScriptVault', 'Failed to update ScriptVault'), 'error');
        }
    }

    // Update badge for current tab
    async function updateBadgeForTab() {
        try {
            await chrome.runtime.sendMessage({
                action: 'updateBadgeForTab',
                tabId: currentTab?.id,
                url: currentUrl
            });
        } catch (error) {
            // Ignore errors
        }
    }

    // Open dashboard
    async function openDashboard(scriptId = null) {
        try {
            await chrome.runtime.sendMessage({
                action: 'openDashboard',
                data: scriptId ? { scriptId } : {}
            });
        } catch (error) {
            const url = scriptId
                ? chrome.runtime.getURL(`pages/dashboard.html#script_${encodeURIComponent(scriptId)}`)
                : chrome.runtime.getURL('pages/dashboard.html');
            await chrome.tabs.create({ url });
        }
        window.close();
    }

    async function openUpdatesDashboard() {
        try {
            await chrome.runtime.sendMessage({
                action: 'openDashboard',
                data: { tab: 'updates' }
            });
        } catch (error) {
            await chrome.tabs.create({ url: chrome.runtime.getURL('pages/dashboard.html#tab=updates') });
        }
        window.close();
    }

    async function openHelpDashboard() {
        try {
            await chrome.runtime.sendMessage({
                action: 'openDashboard',
                data: { tab: 'help' }
            });
        } catch (error) {
            await chrome.tabs.create({ url: chrome.runtime.getURL('pages/dashboard.html#tab=help') });
        }
        window.close();
    }

    // Create new script - opens dashboard new script editor
    async function createNewScript() {
        try {
            await chrome.runtime.sendMessage({
                action: 'openDashboard',
                data: { newScript: true }
            });
        } catch (error) {
            const url = chrome.runtime.getURL('pages/dashboard.html#new_script');
            await chrome.tabs.create({ url });
        }
        window.close();
    }

    // Find scripts on GreasyFork
    function findScripts() {
        try {
            let hostname = '';
            try {
                if (!canMatchScriptsForUrl(currentUrl)) throw new Error('restricted-page');
                hostname = new URL(currentUrl).hostname.replace(/^www\./, '');
            } catch (e) {}

            const searchUrl = hostname
                ? `https://greasyfork.org/en/scripts/by-site/${encodeURIComponent(hostname)}?filter_locale=0`
                : 'https://greasyfork.org/en/scripts';
            chrome.tabs.create({ url: searchUrl });
            window.close();
        } catch (error) {
            console.error('Failed to search for scripts:', error);
        }
    }

    // Export to ZIP
    async function exportToZip() {
        try {
            showPopupToast(tPopup('popupPreparingBackup', 'Preparing backup...'));
            const response = await chrome.runtime.sendMessage({ action: 'exportZip' });
            
            if (response?.zipData) {
                // Convert base64 to blob and download
                const byteCharacters = atob(response.zipData);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'application/zip' });
                
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = response.filename || `scriptvault-backup-${new Date().toISOString().split('T')[0]}.zip`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);

                window.close();
            }
        } catch (error) {
            console.error('Failed to export:', error);
            showPopupToast(error.message || tPopup('popupExportFailed', 'Export failed'), 'error');
        }
    }

    // Import from file
    function importFromFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,.zip';

        input.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const isZip = file.name.toLowerCase().endsWith('.zip');
                let result;
                
                if (isZip) {
                    const arrayBuffer = await file.arrayBuffer();
                    const bytes = new Uint8Array(arrayBuffer);
                    let binary = '';
                    for (let i = 0; i < bytes.length; i += 8192) {
                        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
                    }
                    const base64 = btoa(binary);
                    
                    result = await chrome.runtime.sendMessage({
                        action: 'importFromZip',
                        zipData: base64,
                        options: { overwrite: true }
                    });
                } else {
                    const text = await file.text();
                    const data = JSON.parse(text);
                    
                    result = await chrome.runtime.sendMessage({
                        action: 'importAll',
                        data: { data, options: { overwrite: true } }
                    });
                }
                const error = getRuntimeError(result, tPopup('popupImportFailed', 'Import failed'));
                if (error) throw new Error(error);
                
                // Reload and close
                await loadAllScripts();
                await loadPageScripts();
                updateBadgeForTab();
                showPopupToast(formatImportSummary(result) || tPopup('popupImportedFile', 'Imported {name}', { name: file.name }));
            } catch (error) {
                console.error('Failed to import:', error);
                showPopupToast(error.message || tPopup('popupImportFailed', 'Import failed'), 'error');
            }
        });

        input.click();
    }

    // Check for updates
    async function checkForUpdates() {
        try {
            const result = await chrome.runtime.sendMessage({ action: 'queueUpdates', source: 'popup' });
            const error = getRuntimeError(result, tPopup('popupUpdateCheckFailed', 'Update check failed'));
            if (error) throw new Error(error);
            const updateCount = Number(result?.queued || 0);
            await refreshPendingUpdatesBadge(result?.pendingUpdates);
            showPopupToast(
                updateCount > 0
                    ? tPopup('popupUpdatesQueued', '{count} {updates} queued', {
                        count: numberFormatter.format(updateCount),
                        updates: updateCount === 1 ? tPopup('updateSingular', 'update') : tPopup('updatePlural', 'updates')
                    })
                    : tPopup('noUpdates', 'All scripts are up to date')
            );
        } catch (error) {
            console.error('Failed to check updates:', error);
            showPopupToast(error.message || tPopup('popupUpdateCheckFailed', 'Update check failed'), 'error');
        }
    }

    async function refreshPendingUpdatesBadge(existingUpdates = null) {
        try {
            const updates = Array.isArray(existingUpdates)
                ? existingUpdates
                : await chrome.runtime.sendMessage({ action: 'getPendingUpdates' });
            const count = Array.isArray(updates) ? updates.length : 0;
            if (elements.pendingUpdatesBadge) {
                elements.pendingUpdatesBadge.hidden = count === 0;
                elements.pendingUpdatesBadge.textContent = numberFormatter.format(count);
                elements.pendingUpdatesBadge.setAttribute('aria-label', tPopup('popupQueuedUpdatesAria', '{count} queued {updates}', {
                    count: numberFormatter.format(count),
                    updates: count === 1 ? tPopup('updateSingular', 'update') : tPopup('updatePlural', 'updates')
                }));
            }
        } catch (_error) {
            if (elements.pendingUpdatesBadge) elements.pendingUpdatesBadge.hidden = true;
        }
    }

    // Relative time helper
    function timeAgo(ts) {
        const diff = Date.now() - ts;
        if (diff < 60000) return 'just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        if (diff < 2592000000) return `${Math.floor(diff / 86400000)}d ago`;
        return new Date(ts).toLocaleDateString();
    }

    // Toast notification
    function showPopupToast(msg, type = 'success') {
        let toast = document.querySelector('.popup-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'popup-toast';
            toast.setAttribute('role', 'status');
            toast.setAttribute('aria-live', 'polite');
            toast.setAttribute('aria-atomic', 'true');
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        const toastType = ['success', 'error', 'warning', 'info'].includes(type) ? type : 'success';
        toast.classList.remove('success', 'error', 'warning', 'info');
        toast.classList.add(toastType);
        toast.setAttribute('role', toastType === 'error' ? 'alert' : 'status');
        toast.setAttribute('aria-live', toastType === 'error' ? 'assertive' : 'polite');
        toast.classList.remove('show');
        void toast.offsetWidth;
        toast.classList.add('show');
        clearTimeout(popupToastTimer);
        popupToastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
    }

    function setUtilitiesSubmenuOpen(isOpen, { restoreFocus = false } = {}) {
        if (!elements.utilitiesSubmenu || !elements.btnUtilities) return;
        elements.utilitiesSubmenu.classList.toggle('open', isOpen);
        elements.utilitiesSubmenu.hidden = !isOpen;
        elements.utilitiesSubmenu.setAttribute('aria-hidden', String(!isOpen));
        elements.btnUtilities.setAttribute('aria-expanded', String(isOpen));
        if (!isOpen && restoreFocus) {
            elements.btnUtilities.focus();
        }
    }

    async function refreshBlacklistDomainLabel() {
        if (!elements.btnBlacklistDomain || !currentUrl) return;
        try {
            const domain = new URL(currentUrl).hostname;
            if (!domain) return;
            const menuText = elements.btnBlacklistDomain.querySelector('.menu-item-text');
            if (!menuText) return;
            const res = await chrome.runtime.sendMessage({ action: 'getSettings' });
            const deniedHosts = (res?.settings || res || {}).deniedHosts || [];
            const isDenied = deniedHosts.includes(domain);
            menuText.textContent = isDenied
                ? tPopup('popupAllowDomainAgain', 'Allow {domain} again', { domain })
                : tPopup('popupDoNotRunOnDomainNamed', 'Do not run on {domain}', { domain });
        } catch (_) {}
    }

    async function refreshWhitelistDomainLabel() {
        if (!elements.btnWhitelistDomain || !currentUrl) return;
        try {
            const domain = new URL(currentUrl).hostname;
            if (!domain) return;
            const menuText = elements.btnWhitelistDomain.querySelector('.menu-item-text');
            if (!menuText) return;
            const res = await chrome.runtime.sendMessage({ action: 'getSettings' });
            const settings = res?.settings || res || {};
            const mode = settings.pageFilterMode || 'blacklist';
            const whitelist = (settings.whitelistedPages || '').split('\n').map(s => s.trim()).filter(Boolean);
            const wildcardPattern = `https://${domain}/*`;
            const httpPattern = `http://${domain}/*`;
            const alreadyAllowed = mode === 'whitelist'
                && (whitelist.includes(wildcardPattern) || whitelist.includes(httpPattern));
            menuText.textContent = alreadyAllowed
                ? tPopup('popupClearOnlyThisSiteLock', 'Clear "only this site" lock')
                : tPopup('popupRunOnlyOnDomainNamed', 'Run only on {domain}', { domain });
        } catch (_) {}
    }

    // Setup event listeners
    function setupEventListeners() {
        // Header toggle (global enable/disable)
        elements.headerToggle?.addEventListener('click', () => {
            runBusyControl(elements.headerToggle, toggleGlobalEnabled);
        });

        // Find scripts
        elements.btnFindScripts?.addEventListener('click', findScripts);

        // New script
        elements.btnNewScript?.addEventListener('click', createNewScript);

        // Per-tab run diagnostics
        elements.btnDiagnose?.addEventListener('click', toggleDiagnostics);

        // Utilities submenu toggle
        elements.btnUtilities?.addEventListener('click', async () => {
            const isOpen = !elements.utilitiesSubmenu?.classList.contains('open');
            setUtilitiesSubmenuOpen(isOpen);
            if (isOpen) {
                await refreshBlacklistDomainLabel();
                await refreshWhitelistDomainLabel();
            }
        });

        // Utilities actions
        elements.btnExportZip?.addEventListener('click', () => {
            setUtilitiesSubmenuOpen(false);
            runBusyControl(elements.btnExportZip, exportToZip);
        });
        elements.btnImport?.addEventListener('click', () => {
            setUtilitiesSubmenuOpen(false);
            showPopupToast(tPopup('popupSelectBackupToImport', 'Select a backup to import...'));
            importFromFile();
        });
        elements.btnCheckUpdates?.addEventListener('click', () => {
            setUtilitiesSubmenuOpen(false);
            runBusyControl(elements.btnCheckUpdates, async () => {
                showPopupToast(tPopup('popupCheckingForUpdates', 'Checking for updates...'));
                await checkForUpdates();
                if (!elements.pendingUpdatesBadge?.hidden) {
                    await openUpdatesDashboard();
                }
            });
        });

        // Whitelist domain (toggle): switches pageFilterMode to 'whitelist'
        // and adds an https://<host>/* pattern to whitelistedPages. Toggling
        // again clears the lock back to blacklist mode.
        elements.btnWhitelistDomain?.addEventListener('click', async () => {
            if (!currentUrl) return;
            await runBusyControl(elements.btnWhitelistDomain, async () => {
                try {
                    const domain = new URL(currentUrl).hostname;
                    const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
                    const freshSettings = response?.settings || response || {};
                    const mode = freshSettings.pageFilterMode || 'blacklist';
                    const wildcardPattern = `https://${domain}/*`;
                    const whitelist = (freshSettings.whitelistedPages || '')
                        .split('\n').map(s => s.trim()).filter(Boolean);
                    const alreadyLocked = mode === 'whitelist' && whitelist.includes(wildcardPattern);
                    if (alreadyLocked) {
                        const next = whitelist.filter(p => p !== wildcardPattern).join('\n');
                        const result = await chrome.runtime.sendMessage({
                            action: 'setSettings',
                            settings: { pageFilterMode: 'blacklist', whitelistedPages: next }
                        });
                        const error = getRuntimeError(result, tPopup('popupFailedClearSiteLock', 'Failed to clear site lock'));
                        if (error) throw new Error(error);
                        setUtilitiesSubmenuOpen(false);
                        await loadPageScripts();
                        showPopupToast(tPopup('popupClearedOnlyOnDomainLock', 'Cleared "only on {domain}" lock', { domain }));
                        return;
                    }
                    const nextList = whitelist.includes(wildcardPattern)
                        ? whitelist
                        : [...whitelist, wildcardPattern];
                    const result = await chrome.runtime.sendMessage({
                        action: 'setSettings',
                        settings: { pageFilterMode: 'whitelist', whitelistedPages: nextList.join('\n') }
                    });
                    const error = getRuntimeError(result, tPopup('popupFailedLockToDomain', 'Failed to lock to {domain}', { domain }));
                    if (error) throw new Error(error);
                    setUtilitiesSubmenuOpen(false);
                    await loadPageScripts();
                    showPopupToast(tPopup('popupScriptVaultOnlyRunOnDomain', 'ScriptVault will only run on {domain}', { domain }));
                } catch (e) {
                    console.error('Failed to whitelist:', e);
                    showPopupToast(e.message || tPopup('popupFailedUpdateSiteLock', 'Failed to update site lock'), 'error');
                }
            });
        });

        // Blacklist domain (toggle)
        elements.btnBlacklistDomain?.addEventListener('click', async () => {
            if (!currentUrl) return;
            await runBusyControl(elements.btnBlacklistDomain, async () => {
                try {
                    const domain = new URL(currentUrl).hostname;
                    const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
                    const freshSettings = response?.settings || response || {};
                    const deniedHosts = Array.isArray(freshSettings.deniedHosts) ? [...freshSettings.deniedHosts] : [];
                    const existingIdx = deniedHosts.indexOf(domain);
                    if (existingIdx !== -1) {
                        deniedHosts.splice(existingIdx, 1);
                        const result = await chrome.runtime.sendMessage({ action: 'setSettings', settings: { deniedHosts } });
                        const error = getRuntimeError(result, tPopup('popupFailedAllowDomain', 'Failed to allow {domain}', { domain }));
                        if (error) throw new Error(error);
                        setUtilitiesSubmenuOpen(false);
                        await loadPageScripts();
                        showPopupToast(tPopup('popupScriptVaultCanRunOnDomainAgain', 'ScriptVault can run on {domain} again', { domain }));
                        return;
                    }
                    deniedHosts.push(domain);
                    const result = await chrome.runtime.sendMessage({ action: 'setSettings', settings: { deniedHosts } });
                    const error = getRuntimeError(result, tPopup('popupFailedBlockDomain', 'Failed to block {domain}', { domain }));
                    if (error) throw new Error(error);
                    setUtilitiesSubmenuOpen(false);
                    await loadPageScripts();
                    showPopupToast(tPopup('popupScriptVaultWillNotRunOnDomain', 'ScriptVault will not run on {domain}', { domain }));
                } catch (e) {
                    console.error('Failed to blacklist:', e);
                    showPopupToast(e.message || tPopup('popupFailedUpdateBlockedDomains', 'Failed to update blocked domains'), 'error');
                }
            });
        });

        // Dashboard
        elements.btnHelp?.addEventListener('click', () => openHelpDashboard());
        elements.btnDashboard?.addEventListener('click', () => openDashboard());
        
        // Setup warning - Open extension settings
        elements.btnOpenExtSettings?.addEventListener('click', async () => {
            if (setupStatus?.setupState === 'firefox-user-scripts-permission') {
                await requestFirefoxUserScriptsPermissionFromPopup();
                return;
            }
            if (setupStatus?.setupState === 'host-permission-needed') {
                try {
                    await requestHostPermissionFromPopup();
                } catch (error) {
                    showPopupToast(error?.message || tPopup('sideRequestSiteAccessFailed', 'Failed to request site access'), 'error');
                }
                return;
            }
            const targetUrl = setupStatus?.setupUrl || `chrome://extensions/?id=${chrome.runtime.id}`;
            chrome.tabs.create({ url: targetUrl });
            window.close();
        });

        chrome.runtime.onMessage?.addListener((message) => {
            if (message?.action === 'runtimeHostPermissionsChanged') {
                refreshHostPermissionWarning().catch(() => {});
            }
        });

        // Keyboard navigation for script list
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.getElementById('scriptDropdown')?.classList.contains('open')) {
                e.preventDefault();
                closeScriptDropdown({ restoreFocus: true });
                return;
            }
            if (e.key === 'Escape' && elements.utilitiesSubmenu?.classList.contains('open')) {
                e.preventDefault();
                setUtilitiesSubmenuOpen(false, { restoreFocus: true });
                return;
            }
            const items = getPopupScriptRows();
            if (!items.length) return;
            const activeEl = document.activeElement;
            const focused = activeEl?.closest?.('.script-item');
            const idx = focused ? items.indexOf(focused) : -1;
            const focusedRow = activeEl instanceof HTMLElement && activeEl.classList.contains('script-item')
                ? activeEl
                : null;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                const next = items[idx + 1] || items[0];
                focusPopupScriptRow(next);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const prev = items[idx - 1] || items[items.length - 1];
                focusPopupScriptRow(prev);
            } else if (e.key === 'Home') {
                e.preventDefault();
                focusPopupScriptRow(items[0]);
            } else if (e.key === 'End') {
                e.preventDefault();
                focusPopupScriptRow(items[items.length - 1]);
            } else if (e.key === 'Enter' && focusedRow) {
                e.preventDefault();
                const sid = focusedRow.dataset.scriptId;
                if (sid) openDashboard(sid);
            }
        });

        document.addEventListener('click', (e) => {
            if (!elements.utilitiesSubmenu?.classList.contains('open')) return;
            const clickedInsideSubmenu = elements.utilitiesSubmenu.contains(e.target);
            const clickedToggle = elements.btnUtilities?.contains(e.target);
            if (!clickedInsideSubmenu && !clickedToggle) {
                setUtilitiesSubmenuOpen(false);
            }
        });
    }

    // Start
    document.addEventListener('DOMContentLoaded', init);
})();
