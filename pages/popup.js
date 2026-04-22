// ScriptVault Popup v2.3.0
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
        scriptList: document.getElementById('scriptList'),
        emptyState: document.getElementById('emptyState'),
        emptyStateIcon: document.getElementById('emptyStateIcon'),
        emptyStateTitle: document.getElementById('emptyStateTitle'),
        emptyStateHint: document.getElementById('emptyStateHint'),
        menuSection: document.getElementById('menuSection'),
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
        updateEmptyStateHint();
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
        el.textContent = 'Find scripts on GreasyFork or create your own.';
        updatePrimaryActionMenuVisibility();
        if (!canMatchScriptsForUrl(currentUrl)) {
            el.textContent = 'Switch to a regular website or local file to search for matching scripts.';
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

    function showPopupEmptyState(title, description, iconText = '\uD83D\uDCDC') {
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
            showPopupEmptyState('No page selected', 'Open a tab to see which scripts match it.', '\uD83D\uDCDC');
            return;
        }

        if (!canMatchScriptsForUrl(currentUrl)) {
            pageScripts = [];
            renderScriptList();
            updateEnabledState();
            showPopupEmptyState('Scripts don’t run here', 'Browser pages, extension pages, and other internal surfaces block userscripts.', '\uD83D\uDEE1\uFE0F');
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
                isTimeout ? 'ScriptVault is loading\u2026' : 'Connection error',
                isTimeout
                    ? 'The background service is still starting up. Try again in a moment.'
                    : 'Could not connect to the ScriptVault background service.',
                '\u26A0'
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

        dropdown.setAttribute('aria-label', `Actions for ${name}`);

        if (updateBtn) {
            updateBtn.disabled = !hasUpdateUrl;
            updateBtn.textContent = hasUpdateUrl ? 'Check for Update' : 'No Update Channel';
            updateBtn.title = hasUpdateUrl
                ? `Check ${name} against its remote update URL.`
                : `${name} does not declare @updateURL or @downloadURL metadata.`;
        }

        if (copyUrlBtn) {
            copyUrlBtn.disabled = !installUrl;
            copyUrlBtn.textContent = installUrl ? 'Copy Install URL' : 'No Install URL';
            copyUrlBtn.title = installUrl
                ? `Copy ${name}'s remote install URL.`
                : `${name} does not declare a remote install URL.`;
        }

        if (pinBtn) {
            pinBtn.textContent = script?.settings?.pinned ? 'Unpin Script' : 'Pin Script';
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
        if (dropdown.classList.contains('open') && activeDropdownScriptId === scriptId) {
            closeScriptDropdown({ restoreFocus: true });
            return;
        }
        closeScriptDropdown();
        activeDropdownScriptId = scriptId;
        resetDropdownDeleteState();
        configureScriptDropdown(scriptId);
        populateMenuCommands(scriptId);
        const rect = trigger.getBoundingClientRect();
        dropdown.style.top = rect.bottom + 2 + 'px';
        dropdown.style.right = (document.documentElement.clientWidth - rect.right) + 'px';
        trigger.setAttribute('aria-expanded', 'true');
        dropdown.hidden = false;
        dropdown.setAttribute('aria-hidden', 'false');
        dropdown.classList.add('open');
        requestAnimationFrame(() => focusDropdownMenuItem(focusTarget));
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
        const focusDescriptor = pendingPopupFocusDescriptor
            || (elements.scriptList.contains(document.activeElement) ? getPopupFocusDescriptor(document.activeElement) : null);
        pendingPopupFocusDescriptor = null;
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

        const emptyState = document.getElementById('emptyState');
        if (displayScripts.length === 0) {
            if (elements.scriptList) elements.scriptList.hidden = true;
            elements.scriptList.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            updateEmptyStateHint();
            updatePrimaryActionMenuVisibility();
            return;
        }
        if (emptyState) emptyState.style.display = 'none';
        if (elements.scriptList) elements.scriptList.hidden = false;
        updatePrimaryActionMenuVisibility();

        elements.scriptList.innerHTML = displayScripts.map((script, i) => {
            const meta = script.metadata || script.meta || {};
            const name = meta.name || 'Unnamed Script';
            const version = meta.version || '';
            const enabled = script.enabled !== false;
            const icon = getScriptIcon(script);
            const animDelay = `style="animation-delay: ${i * 30}ms"`;
            const rowLabel = [name, version ? `version ${version}` : ''].filter(Boolean).join(', ');
            const scriptIdAttr = escapeHtml(script.id);

            return `
                <div class="script-item${enabled ? '' : ' not-running'}" data-script-id="${scriptIdAttr}" role="listitem" tabindex="0" aria-posinset="${i + 1}" aria-setsize="${displayScripts.length}" aria-label="${escapeHtml(rowLabel)}" ${animDelay}>
                    <label class="script-toggle">
                        <input type="checkbox" ${enabled ? 'checked' : ''} data-toggle-id="${scriptIdAttr}" aria-label="${escapeHtml(enabled ? `Disable ${name}` : `Enable ${name}`)}">
                        <span class="slider"></span>
                    </label>
                    <div class="script-icon">${icon}</div>
                    <div class="script-main">
                        <button class="script-name-btn" data-edit-id="${scriptIdAttr}" type="button" aria-label="Open ${escapeHtml(name)} in editor">
                            <span class="script-name-label">${escapeHtml(name)}</span>${version ? ` <span class="script-version">${escapeHtml(version)}</span>` : ''}
                        </button>
                    </div>
                    <button class="script-quick-edit" data-quickedit-id="${scriptIdAttr}" type="button" aria-label="Quick edit ${escapeHtml(name)}" title="Quick edit">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="script-more" data-more-id="${scriptIdAttr}" type="button" aria-label="More actions for ${escapeHtml(name)}" aria-haspopup="menu" aria-controls="scriptDropdown" aria-expanded="false">
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

            dropdown.querySelector('[data-action="edit"]')?.addEventListener('click', (e) => {
                e.stopPropagation();
                const scriptId = activeDropdownScriptId;
                closeScriptDropdown();
                if (scriptId) openDashboard(scriptId);
            });

            dropdown.querySelector('[data-action="update"]')?.addEventListener('click', async (e) => {
                e.stopPropagation();
                const scriptId = activeDropdownScriptId;
                queuePopupFocusRestore(getPopupFocusDescriptor(getDropdownTriggerButton(scriptId)));
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
                        await copyTextToClipboard(url);
                        showPopupToast('Install URL copied');
                    } catch { showPopupToast('Copy failed', 'error'); }
                } else {
                    showPopupToast('No download URL', 'error');
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
                queuePopupFocusRestore(getPopupFocusDescriptor(getDropdownTriggerButton(scriptId)));
                closeScriptDropdown();
                deleteScript(scriptId);
            });

            // Close dropdown when clicking outside (but not inside it)
            document.addEventListener('click', (e) => {
                if (!dropdown.contains(e.target) && !e.target.closest('.script-more')) {
                    closeScriptDropdown();
                }
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
                const error = getRuntimeError(result, 'Import failed');
                if (error) throw new Error(error);
                
                // Reload and close
                await loadAllScripts();
                await loadPageScripts();
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

        // New script
        elements.btnNewScript?.addEventListener('click', createNewScript);

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
