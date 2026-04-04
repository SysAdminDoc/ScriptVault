// ScriptVault Popup v2.0.0
// Tampermonkey-style popup interface

(function() {
    'use strict';

    const numberFormatter = new Intl.NumberFormat();

    // Event delegation for favicon error handling (CSP-compliant)
    document.addEventListener('error', function(e) {
        if (e.target.tagName === 'IMG' && e.target.hasAttribute('data-favicon-fallback')) {
            e.target.style.display = 'none';
            if (e.target.parentElement) {
                e.target.parentElement.innerHTML = buildPopupIconBadgeHtml(
                    e.target.dataset.fallbackLabel || 'SV',
                    e.target.dataset.fallbackHue || '145',
                    e.target.dataset.fallbackMode || 'google'
                );
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
    let popupToastTimer = null;
    const MATCHABLE_PROTOCOLS = new Set(['http:', 'https:', 'file:', 'ftp:']);
    const busyControls = new WeakSet();
    const pendingScriptActions = new Set();

    // DOM Elements
    const elements = {
        headerToggle: document.getElementById('headerToggle'),
        headerCheckIcon: document.getElementById('headerCheckIcon'),
        pageSummary: document.getElementById('pageSummary'),
        pageSummaryTitle: document.getElementById('pageSummaryTitle'),
        pageSummaryMeta: document.getElementById('pageSummaryMeta'),
        pageSummaryCount: document.getElementById('pageSummaryCount'),
        scriptList: document.getElementById('scriptList'),
        emptyState: document.getElementById('emptyState'),
        emptyStateIcon: document.getElementById('emptyStateIcon'),
        emptyStateTitle: document.getElementById('emptyStateTitle'),
        emptyStateHint: document.getElementById('emptyStateHint'),
        emptyStateActions: document.getElementById('emptyStateActions'),
        btnEmptyFindScripts: document.getElementById('btnEmptyFindScripts'),
        btnEmptyNewScript: document.getElementById('btnEmptyNewScript'),
        btnFindScripts: document.getElementById('btnFindScripts'),
        btnNewScript: document.getElementById('btnNewScript'),
        btnUtilities: document.getElementById('btnUtilities'),
        utilitiesSubmenu: document.getElementById('utilitiesSubmenu'),
        btnExportZip: document.getElementById('btnExportZip'),
        btnImport: document.getElementById('btnImport'),
        btnCheckUpdates: document.getElementById('btnCheckUpdates'),
        btnBlacklistDomain: document.getElementById('btnBlacklistDomain'),
        btnDashboard: document.getElementById('btnDashboard'),
        setupWarning: document.getElementById('setupWarning'),
        btnOpenExtSettings: document.getElementById('btnOpenExtSettings'),
        headerCount: document.getElementById('headerCount')
    };

    // Initialize
    async function init() {
        // Show loading state immediately
        if (elements.scriptList) {
            elements.scriptList.style.opacity = '0.5';
            elements.scriptList.style.transition = 'opacity 0.2s';
        }
        await checkUserScriptsAvailability();
        await loadSettings();
        await getCurrentTab();
        await loadAllScripts();
        await loadPageScripts();
        if (elements.scriptList) elements.scriptList.style.opacity = '1';
        setupEventListeners();
        updateEnabledState();
        updateUrlBar();
        updateFooterCount();
        updateEmptyStateHint();
        updatePageSummary();

        // v2.0: Initialize execution timeline
        if (typeof PopupTimeline !== 'undefined') {
            const footer = document.querySelector('.footer');
            if (footer) {
                PopupTimeline.init(footer, pageScripts);
                syncTimeline();
            }
        }
    }

    // Load all scripts for total count
    async function loadAllScripts() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getScripts' });
            allScripts = response?.scripts || [];
        } catch (e) {
            allScripts = [];
        }
    }

    // Show current URL
    function updateUrlBar() {
        const urlBar = document.getElementById('urlBar');
        const urlHost = document.getElementById('urlHost');
        const urlPath = document.getElementById('urlPath');
        if (urlBar && currentUrl) {
            try {
                const u = new URL(currentUrl);
                const path = (u.pathname || '/') + (u.search || '');
                if (urlHost) urlHost.textContent = u.hostname;
                if (urlPath) urlPath.textContent = path;
                urlBar.classList.add('has-url');
            } catch {
                if (urlHost) urlHost.textContent = '';
                if (urlPath) urlPath.textContent = '';
                urlBar.classList.remove('has-url');
            }
        } else if (urlBar) {
            if (urlHost) urlHost.textContent = '';
            if (urlPath) urlPath.textContent = '';
            urlBar.classList.remove('has-url');
        }
    }

    // Show total count in footer
    function updateFooterCount() {
        const el = document.getElementById('footerTotalCount');
        if (el) {
            const total = allScripts.length;
            const active = allScripts.filter(s => s.enabled !== false).length;
            el.textContent = `${numberFormatter.format(active)}/${numberFormatter.format(total)} scripts`;
        }
    }

    function escapeSelectorValue(value) {
        if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
            return CSS.escape(String(value));
        }
        return String(value).replace(/"/g, '\\"');
    }

    function getScriptRow(scriptId) {
        if (!elements.scriptList || !scriptId) return null;
        return elements.scriptList.querySelector(`[data-script-id="${escapeSelectorValue(scriptId)}"]`);
    }

    function setScriptRowBusy(scriptId, isBusy) {
        const row = getScriptRow(scriptId);
        if (!row) return;
        row.classList.toggle('busy', isBusy);
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

    function syncTimeline() {
        if (typeof PopupTimeline !== 'undefined' && typeof PopupTimeline.update === 'function') {
            PopupTimeline.update(pageScripts);
        }
    }

    function updatePageSummary(displayScripts = pageScripts) {
        if (!elements.pageSummaryTitle || !elements.pageSummaryMeta || !elements.pageSummaryCount) return;

        if (!currentUrl) {
            elements.pageSummaryTitle.textContent = 'No page selected';
            elements.pageSummaryMeta.textContent = 'Open a website or local file to review matching scripts here.';
            elements.pageSummaryCount.textContent = '0';
            return;
        }

        if (!canMatchScriptsForUrl(currentUrl)) {
            elements.pageSummaryTitle.textContent = 'Protected surface';
            elements.pageSummaryMeta.textContent = 'Userscripts cannot run on browser, extension, and similar internal pages.';
            elements.pageSummaryCount.textContent = 'Read-only';
            return;
        }

        const totalMatched = Array.isArray(pageScripts) ? pageScripts.length : 0;
        const visibleScripts = Array.isArray(displayScripts) ? displayScripts.length : totalMatched;

        if (settings.enabled === false) {
            elements.pageSummaryTitle.textContent = 'ScriptVault paused';
            elements.pageSummaryMeta.textContent = totalMatched > 0
                ? `${numberFormatter.format(totalMatched)} matching script${totalMatched === 1 ? '' : 's'} will resume when ScriptVault is enabled again.`
                : 'Enable ScriptVault to run matching scripts on this page.';
            elements.pageSummaryCount.textContent = 'Paused';
            return;
        }

        if (totalMatched === 0) {
            elements.pageSummaryTitle.textContent = 'No matching scripts';
            elements.pageSummaryMeta.textContent = 'Search for a script for this site or create a new one for this page.';
            elements.pageSummaryCount.textContent = '0';
            return;
        }

        const runningCount = displayScripts.filter((script) => script.enabled !== false && script._matchesCurrent !== false).length;
        const pausedCount = displayScripts.filter((script) => script.enabled === false).length;
        const errorCount = displayScripts.filter((script) => Number(script?.stats?.errors || 0) > 0).length;
        const hiddenCount = settings.hideDisabledPopup ? Math.max(0, totalMatched - visibleScripts) : 0;

        elements.pageSummaryTitle.textContent = `${numberFormatter.format(totalMatched)} matching script${totalMatched === 1 ? '' : 's'}`;
        elements.pageSummaryCount.textContent = hiddenCount > 0
            ? `${numberFormatter.format(visibleScripts)}/${numberFormatter.format(totalMatched)}`
            : numberFormatter.format(totalMatched);

        const parts = [];
        if (runningCount > 0) parts.push(`${numberFormatter.format(runningCount)} running`);
        if (pausedCount > 0) parts.push(`${numberFormatter.format(pausedCount)} paused`);
        if (errorCount > 0) parts.push(`${numberFormatter.format(errorCount)} with errors`);
        if (hiddenCount > 0) parts.push(`${numberFormatter.format(hiddenCount)} hidden`);
        elements.pageSummaryMeta.textContent = parts.join(' • ') || 'Ready to run on this page.';
    }

    function updateEmptyStateActions({ showFindScripts = canMatchScriptsForUrl(currentUrl), showCreateScript = true } = {}) {
        if (elements.btnEmptyFindScripts) elements.btnEmptyFindScripts.hidden = !showFindScripts;
        if (elements.btnEmptyNewScript) elements.btnEmptyNewScript.hidden = !showCreateScript;
        if (elements.emptyStateActions) {
            elements.emptyStateActions.hidden = !showFindScripts && !showCreateScript;
        }
    }

    // Contextual empty state hint
    function updateEmptyStateHint() {
        const el = elements.emptyStateHint;
        if (!el) return;
        el.textContent = 'Find scripts on GreasyFork or create your own.';
        updateEmptyStateActions();
        if (!canMatchScriptsForUrl(currentUrl)) {
            el.textContent = 'Switch to a regular website or local file to search for matching scripts.';
            updateEmptyStateActions({ showFindScripts: false, showCreateScript: true });
            return;
        }
        try {
            const hostname = new URL(currentUrl).hostname.replace(/^www\./, '');
            if (hostname) {
                el.textContent = `Search GreasyFork for ${hostname} or start a new script for this site.`;
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

    function showPopupEmptyState(title, description, iconText = '\uD83D\uDCDC', options = {}) {
        const emptyState = elements.emptyState;
        if (!emptyState) return;
        emptyState.style.display = 'block';
        if (elements.emptyStateIcon) elements.emptyStateIcon.textContent = iconText;
        if (elements.emptyStateTitle) elements.emptyStateTitle.textContent = title;
        if (elements.emptyStateHint) elements.emptyStateHint.textContent = description;
        updateEmptyStateActions({
            showFindScripts: canMatchScriptsForUrl(currentUrl),
            showCreateScript: true,
            ...options
        });
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
    
    // Check if userScripts API is available and enabled
    async function checkUserScriptsAvailability() {
        try {
            // Use background's getExtensionStatus for Chrome version-aware messaging
            const status = await chrome.runtime.sendMessage({ action: 'getExtensionStatus' });
            userScriptsAvailable = status?.userScriptsAvailable !== false;

            if (!userScriptsAvailable) {
                showSetupWarning(status?.setupMessage);
            } else {
                hideSetupWarning();
            }
        } catch (error) {
            // Fallback: check directly
            if (!chrome.userScripts) {
                userScriptsAvailable = false;
                showSetupWarning();
            } else {
                try {
                    await chrome.userScripts.getScripts();
                    userScriptsAvailable = true;
                    hideSetupWarning();
                } catch (e) {
                    userScriptsAvailable = false;
                    showSetupWarning();
                }
            }
        }
    }

    function showSetupWarning(message) {
        if (elements.setupWarning) {
            elements.setupWarning.classList.add('visible');
            // Keep the warning title/icon intact and update only the explanatory text.
            const msgEl = elements.setupWarning.querySelector('.setup-warning-text');
            if (msgEl && message) msgEl.textContent = message;
        }
    }

    function hideSetupWarning() {
        if (elements.setupWarning) {
            elements.setupWarning.classList.remove('visible');
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
        const theme = settings.layout || 'dark';
        document.documentElement.setAttribute('data-theme', theme);
    }

    // Get current tab
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
            pageScripts = [];
            renderScriptList();
            updateEnabledState();
            showPopupEmptyState('No page selected', 'Open a tab to see which scripts match it.', '\uD83D\uDCDC', { showFindScripts: false, showCreateScript: true });
            return;
        }

        if (!canMatchScriptsForUrl(currentUrl)) {
            pageScripts = [];
            renderScriptList();
            updateEnabledState();
            showPopupEmptyState('Scripts don’t run here', 'Browser pages, extension pages, and other internal surfaces block userscripts.', '\uD83D\uDEE1\uFE0F', { showFindScripts: false, showCreateScript: true });
            return;
        }

        try {
            const response = await Promise.race([
                chrome.runtime.sendMessage({ action: 'getScriptsForUrl', url: currentUrl }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
            ]);

            pageScripts = Array.isArray(response) ? response : [];
            renderScriptList();
            updateEnabledState();
        } catch (error) {
            console.error('Failed to load scripts:', error);
            pageScripts = [];
            renderScriptList();
            updateEnabledState();
            const isTimeout = error.message === 'timeout';
            showPopupEmptyState(
                isTimeout ? 'ScriptVault is loading…' : 'Connection error',
                isTimeout
                    ? 'The background service is still starting up. Try again in a moment.'
                    : 'Could not connect to the ScriptVault background service.',
                '\u26A0',
                { showFindScripts: false, showCreateScript: true }
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
        if (imported) parts.push(`Imported ${numberFormatter.format(imported)}`);
        if (skipped) parts.push(`Skipped ${numberFormatter.format(skipped)}`);
        if (failed) parts.push(`Failed ${numberFormatter.format(failed)}`);
        return parts.join(' • ') || 'Nothing changed';
    }

    // Shared dropdown state (module-level to avoid listener accumulation)
    let activeDropdownScriptId = null;
    let dropdownListenersAttached = false;
    let pendingDeleteScriptId = null;

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
        deleteBtn.textContent = 'Delete';
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
        if (dropdown) {
            dropdown.classList.remove('open');
            dropdown.hidden = true;
            dropdown.setAttribute('aria-hidden', 'true');
        }
        if (restoreFocus) {
            trigger?.focus();
        }
    }

    function armDropdownDelete(scriptId, name) {
        pendingDeleteScriptId = scriptId;
        const deleteBtn = getDropdownDeleteButton();
        if (deleteBtn) {
            deleteBtn.textContent = 'Confirm Delete';
            deleteBtn.classList.add('confirming');
        }
        showPopupToast(`Click delete again to remove "${name}"`);
    }

    // Render script list
    function renderScriptList() {
        if (!elements.scriptList) return;
        closeScriptDropdown();

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
        updatePageSummary(displayScripts);

        const emptyState = document.getElementById('emptyState');
        if (displayScripts.length === 0) {
            elements.scriptList.innerHTML = '';
            updateEmptyStateHint();
            if (emptyState) emptyState.style.display = 'block';
            syncTimeline();
            return;
        }
        if (emptyState) emptyState.style.display = 'none';

        elements.scriptList.innerHTML = displayScripts.map((script, i) => {
            const meta = script.metadata || script.meta || {};
            const name = meta.name || 'Unnamed Script';
            const version = meta.version || '';
            const description = meta.description || '';
            const enabled = script.enabled !== false;
            const icon = getScriptIcon(script);

            // Running indicator — script is enabled AND matches current URL
            const isRunning = enabled && script._matchesCurrent !== false;

            // Perf badge
            const stats = script.stats;
            const perfHtml = stats && stats.runs > 0
                ? `<span class="script-perf ${stats.avgTime < 50 ? 'fast' : stats.avgTime < 200 ? 'medium' : 'slow'}" title="Avg: ${stats.avgTime}ms (${stats.runs} runs${stats.errors ? ', ' + stats.errors + ' errors' : ''})">${stats.avgTime}ms</span>`
                : '';

            // Error dot
            const errorDot = stats?.errors > 0 ? `<span class="script-error-dot" title="${stats.errors} error(s)"></span>` : '';

            const updatedAgo = script.updatedAt ? timeAgo(script.updatedAt) : '';
            const tooltipParts = [description, updatedAgo ? `Updated ${updatedAgo}` : ''].filter(Boolean).join('\n');
            const descAttr = tooltipParts ? ` title="${escapeHtml(tooltipParts)}"` : '';
            const secondaryText = description
                || [
                    updatedAgo ? `Updated ${updatedAgo}` : '',
                    stats?.runs > 0 ? `${numberFormatter.format(stats.runs)} run${stats.runs === 1 ? '' : 's'}` : ''
                ].filter(Boolean).join(' • ')
                || 'No recent activity yet';

            // Stagger animation delay
            const animDelay = `style="animation-delay: ${i * 30}ms"`;

            // Running status indicator
            const statusClass = stats?.errors > 0 ? 'error' : (isRunning ? 'running' : 'idle');
            const stateTone = stats?.errors > 0 ? 'error' : enabled ? (isRunning ? 'running' : 'ready') : 'paused';
            const statusTitle = stats?.errors > 0
                ? `${stats.errors} error(s)`
                : (isRunning ? 'Running on this page' : (enabled ? 'Ready on this page' : 'Paused'));
            const stateLabel = stats?.errors > 0 ? 'Errors' : (isRunning ? 'Running' : (enabled ? 'Ready' : 'Paused'));

            // Recently installed (< 1 hour ago)
            const isRecentlyInstalled = Boolean(script.installedAt && (Date.now() - script.installedAt < 3600000));
            const recentClass = isRecentlyInstalled ? ' recently-installed' : '';
            const tags = [];
            if (script.settings?.pinned) tags.push('<span class="script-tag pinned">Pinned</span>');
            if (isRecentlyInstalled) tags.push('<span class="script-tag recent">New</span>');
            const tagsHtml = tags.length ? `<div class="script-tags" aria-hidden="true">${tags.join('')}</div>` : '';

            return `
                <div class="script-item${isRunning ? '' : ' not-running'}${recentClass}" data-script-id="${script.id}" ${animDelay}>
                    <span class="script-status ${statusClass}" title="${statusTitle}"></span>
                    <label class="script-toggle">
                        <input type="checkbox" ${enabled ? 'checked' : ''} data-toggle-id="${script.id}">
                        <span class="slider"></span>
                    </label>
                    <div class="script-icon">${icon}</div>
                    <div class="script-main">
                        <button class="script-name-btn" data-edit-id="${script.id}" type="button" aria-label="Open ${escapeHtml(name)} in editor">
                            <span class="script-name-label">${escapeHtml(name)}</span>${version ? ` <span class="script-version">${escapeHtml(version)}</span>` : ''}
                        </button>
                        <div class="script-meta-row">
                            <span class="script-state-pill ${stateTone}" title="${statusTitle}">${stateLabel}</span>
                            <span class="script-secondary"${descAttr}>${escapeHtml(secondaryText)}</span>
                            ${tagsHtml}
                        </div>
                    </div>
                    ${errorDot}
                    ${perfHtml}
                    <button class="script-quick-edit" data-quickedit-id="${script.id}" type="button" aria-label="Quick edit ${escapeHtml(name)}" title="Quick edit">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="script-more" data-more-id="${script.id}" type="button" aria-label="More actions for ${escapeHtml(name)}" aria-haspopup="menu" aria-controls="scriptDropdown" aria-expanded="false">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
                        </svg>
                    </button>
                </div>
            `;
        }).join('');

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

            // Quick edit button opens editor directly
            item.querySelector('.script-quick-edit')?.addEventListener('click', (e) => {
                e.stopPropagation();
                openDashboard(scriptId);
            });

            // More button (arrow) - position and show shared dropdown
            const moreBtn = item.querySelector('.script-more');
            moreBtn?.addEventListener('click', (e) => {
                e.stopPropagation();
                if (dropdown.classList.contains('open') && activeDropdownScriptId === scriptId) {
                    closeScriptDropdown({ restoreFocus: true });
                    return;
                }
                closeScriptDropdown();
                activeDropdownScriptId = scriptId;
                resetDropdownDeleteState();
                populateMenuCommands(scriptId);
                const rect = moreBtn.getBoundingClientRect();
                dropdown.style.top = rect.bottom + 2 + 'px';
                dropdown.style.right = (document.documentElement.clientWidth - rect.right) + 'px';
                moreBtn.setAttribute('aria-expanded', 'true');
                dropdown.hidden = false;
                dropdown.setAttribute('aria-hidden', 'false');
                dropdown.classList.add('open');
            });
        });

        // Attach dropdown action listeners ONCE (they use module-level activeDropdownScriptId)
        if (!dropdownListenersAttached) {
            dropdownListenersAttached = true;

            dropdown.querySelector('[data-action="edit"]')?.addEventListener('click', (e) => {
                e.stopPropagation();
                const scriptId = activeDropdownScriptId;
                closeScriptDropdown();
                if (scriptId) openDashboard(scriptId);
            });

            dropdown.querySelector('[data-action="update"]')?.addEventListener('click', async (e) => {
                e.stopPropagation();
                const scriptId = activeDropdownScriptId;
                closeScriptDropdown();
                if (!scriptId) return;
                await runScriptAction(scriptId, async () => {
                    showPopupToast('Checking for update…');
                    try {
                        const updates = await chrome.runtime.sendMessage({ action: 'checkUpdates', scriptId });
                        if (updates && updates.length > 0) {
                            await chrome.runtime.sendMessage({ action: 'applyUpdate', scriptId, code: updates[0].code });
                            showPopupToast(`Updated to v${updates[0].newVersion}`);
                            await loadPageScripts();
                        } else {
                            showPopupToast('Already up to date');
                        }
                    } catch (err) {
                        showPopupToast('Update check failed', 'error');
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
                        await navigator.clipboard.writeText(url);
                        showPopupToast('Install URL copied');
                    } catch { showPopupToast('Copy failed', 'error'); }
                } else {
                    showPopupToast('No download URL', 'error');
                }
            });

            dropdown.querySelector('[data-action="pin"]')?.addEventListener('click', async (e) => {
                e.stopPropagation();
                const scriptId = activeDropdownScriptId;
                closeScriptDropdown();
                if (!scriptId) return;
                await runScriptAction(scriptId, async () => {
                    const script = pageScripts.find(s => s.id === scriptId);
                    if (!script) return;
                    const nextSettings = { ...(script.settings || {}), pinned: !script.settings?.pinned };
                    try {
                        const result = await chrome.runtime.sendMessage({ action: 'setScriptSettings', scriptId, settings: nextSettings });
                        const error = getRuntimeError(result, 'Unable to update pin state');
                        if (error) throw new Error(error);
                        script.settings = nextSettings;
                        const allScript = allScripts.find(s => s.id === scriptId);
                        if (allScript) allScript.settings = nextSettings;
                        renderScriptList();
                        updateEnabledState();
                        showPopupToast(nextSettings.pinned ? 'Pinned' : 'Unpinned');
                    } catch (error) {
                        showPopupToast(error.message || 'Unable to update pin state', 'error');
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
                closeScriptDropdown();
                deleteScript(scriptId);
            });

            // Close dropdown when clicking outside (but not inside it)
            document.addEventListener('click', (e) => {
                if (!dropdown.contains(e.target) && !e.target.closest('.script-more')) {
                    closeScriptDropdown();
                }
            });
        }

        syncTimeline();
    }

    // Populate per-script menu commands in the dropdown
    async function populateMenuCommands(scriptId) {
        const container = document.getElementById('dropdownMenuCmds');
        if (!container) return;
        container.innerHTML = '';
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
                const error = getRuntimeError(result, 'Failed to update script');
                if (error) throw new Error(error);

                // Update local state in both arrays
                const script = pageScripts.find(s => s.id === scriptId);
                if (script) script.enabled = enabled;
                const allScript = allScripts.find(s => s.id === scriptId);
                if (allScript) allScript.enabled = enabled;

                // Re-render so enabled sort + visual state updates
                renderScriptList();
                updateEnabledState();
                updateFooterCount();
                updateBadgeForTab();
            } catch (error) {
                console.error('Failed to toggle script:', error);
                showPopupToast(error.message || 'Failed to update script', 'error');
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
                const error = getRuntimeError(result, 'Failed to delete script');
                if (error) throw new Error(error);

                // Remove from both local arrays and re-render
                pageScripts = pageScripts.filter(s => s.id !== scriptId);
                allScripts = allScripts.filter(s => s.id !== scriptId);
                renderScriptList();
                updateEnabledState();
                updateFooterCount();
                updateBadgeForTab();
                const deletedName = result?.scriptName || 'Script deleted';
                showPopupToast(`Deleted ${deletedName}`);
            } catch (error) {
                console.error('Failed to delete script:', error);
                showPopupToast(error.message || 'Failed to delete script', 'error');
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
            const error = getRuntimeError(result, 'Failed to update ScriptVault');
            if (error) throw new Error(error);

            settings.enabled = result?.enabled ?? newEnabled;
            updateEnabledState();
            updatePageSummary();
            
            // Update badge
            updateBadgeForTab();
            showPopupToast(settings.enabled === false ? 'ScriptVault paused' : 'ScriptVault enabled');
        } catch (error) {
            console.error('Failed to toggle global enabled:', error);
            showPopupToast(error.message || 'Failed to update ScriptVault', 'error');
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
    function openDashboard(scriptId = null) {
        const url = scriptId 
            ? chrome.runtime.getURL(`pages/dashboard.html#script_${scriptId}`)
            : chrome.runtime.getURL('pages/dashboard.html');
        chrome.tabs.create({ url });
        window.close();
    }

    // Create new script - opens dashboard new script editor
    function createNewScript() {
        const url = chrome.runtime.getURL('pages/dashboard.html#new_script');
        chrome.tabs.create({ url });
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
            showPopupToast('Preparing backup…');
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
            showPopupToast(error.message || 'Export failed', 'error');
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
                    const base64 = btoa(
                        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
                    );
                    
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
                const error = getRuntimeError(result, 'Import failed');
                if (error) throw new Error(error);
                
                // Reload and close
                await loadAllScripts();
                await loadPageScripts();
                updateFooterCount();
                updateBadgeForTab();
                showPopupToast(formatImportSummary(result) || `Imported ${file.name}`);
            } catch (error) {
                console.error('Failed to import:', error);
                showPopupToast(error.message || 'Import failed', 'error');
            }
        });

        input.click();
    }

    // Check for updates
    async function checkForUpdates() {
        try {
            const result = await chrome.runtime.sendMessage({ action: 'checkUpdates' });
            const error = getRuntimeError(result, 'Update check failed');
            if (error) throw new Error(error);
            const updateCount = Array.isArray(result)
                ? result.length
                : (Array.isArray(result?.updates) ? result.updates.length : 0);
            showPopupToast(
                updateCount > 0
                    ? `Updates available for ${numberFormatter.format(updateCount)} script${updateCount === 1 ? '' : 's'}`
                    : 'All scripts are up to date'
            );
        } catch (error) {
            console.error('Failed to check updates:', error);
            showPopupToast(error.message || 'Update check failed', 'error');
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
        toast.style.background = type === 'error' ? 'var(--popup-danger)' : 'var(--popup-accent)';
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
            menuText.textContent = isDenied ? `Allow ${domain} again` : `Do not run on ${domain}`;
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
        elements.btnEmptyFindScripts?.addEventListener('click', findScripts);

        // New script
        elements.btnNewScript?.addEventListener('click', createNewScript);
        elements.btnEmptyNewScript?.addEventListener('click', createNewScript);

        // Utilities submenu toggle
        elements.btnUtilities?.addEventListener('click', async () => {
            const isOpen = !elements.utilitiesSubmenu?.classList.contains('open');
            setUtilitiesSubmenuOpen(isOpen);
            if (isOpen) await refreshBlacklistDomainLabel();
        });

        // Utilities actions
        elements.btnExportZip?.addEventListener('click', () => {
            setUtilitiesSubmenuOpen(false);
            runBusyControl(elements.btnExportZip, exportToZip);
        });
        elements.btnImport?.addEventListener('click', () => {
            setUtilitiesSubmenuOpen(false);
            showPopupToast('Select a backup to import…');
            importFromFile();
        });
        elements.btnCheckUpdates?.addEventListener('click', () => {
            setUtilitiesSubmenuOpen(false);
            runBusyControl(elements.btnCheckUpdates, async () => {
                showPopupToast('Checking for updates…');
                await checkForUpdates();
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
                        const error = getRuntimeError(result, `Failed to allow ${domain}`);
                        if (error) throw new Error(error);
                        setUtilitiesSubmenuOpen(false);
                        await loadPageScripts();
                        showPopupToast(`ScriptVault can run on ${domain} again`);
                        return;
                    }
                    deniedHosts.push(domain);
                    const result = await chrome.runtime.sendMessage({ action: 'setSettings', settings: { deniedHosts } });
                    const error = getRuntimeError(result, `Failed to block ${domain}`);
                    if (error) throw new Error(error);
                    setUtilitiesSubmenuOpen(false);
                    await loadPageScripts();
                    showPopupToast(`ScriptVault will not run on ${domain}`);
                } catch (e) {
                    console.error('Failed to blacklist:', e);
                    showPopupToast(e.message || 'Failed to update blocked domains', 'error');
                }
            });
        });

        // Dashboard
        elements.btnDashboard?.addEventListener('click', () => openDashboard());
        
        // Setup warning - Open extension settings
        elements.btnOpenExtSettings?.addEventListener('click', () => {
            const extensionId = chrome.runtime.id;
            chrome.tabs.create({ url: `chrome://extensions/?id=${extensionId}` });
            window.close();
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
            const items = [...document.querySelectorAll('.script-item')];
            if (!items.length) return;
            const focused = document.activeElement?.closest('.script-item');
            const idx = focused ? items.indexOf(focused) : -1;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                const next = items[idx + 1] || items[0];
                next.querySelector('input[type="checkbox"]')?.focus();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const prev = items[idx - 1] || items[items.length - 1];
                prev.querySelector('input[type="checkbox"]')?.focus();
            } else if (e.key === 'Enter' && focused) {
                e.preventDefault();
                const sid = focused.dataset.scriptId;
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
