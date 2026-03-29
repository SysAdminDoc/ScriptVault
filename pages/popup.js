// ScriptVault Popup v2.0.0
// Tampermonkey-style popup interface

(function() {
    'use strict';

    // Event delegation for favicon error handling (CSP-compliant)
    document.addEventListener('error', function(e) {
        if (e.target.tagName === 'IMG' && e.target.hasAttribute('data-favicon-fallback')) {
            e.target.style.display = 'none';
            if (e.target.parentElement) e.target.parentElement.textContent = e.target.getAttribute('data-favicon-fallback');
        }
    }, true);

    // State
    let currentTab = null;
    let currentUrl = '';
    let pageScripts = [];
    let allScripts = [];
    let settings = {};
    let userScriptsAvailable = true;

    // DOM Elements
    const elements = {
        headerToggle: document.getElementById('headerToggle'),
        headerCheckIcon: document.getElementById('headerCheckIcon'),
        scriptList: document.getElementById('scriptList'),
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

        // v2.0: Initialize execution timeline
        if (typeof PopupTimeline !== 'undefined') {
            const footer = document.querySelector('.footer');
            if (footer) PopupTimeline.init(footer, pageScripts);
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
        if (urlBar && currentUrl) {
            try {
                const u = new URL(currentUrl);
                urlBar.textContent = u.hostname + u.pathname;
            } catch {
                urlBar.textContent = '';
            }
        }
    }

    // Show total count in footer
    function updateFooterCount() {
        const el = document.getElementById('footerTotalCount');
        if (el) {
            const total = allScripts.length;
            const active = allScripts.filter(s => s.enabled !== false).length;
            el.textContent = `${active}/${total} scripts`;
        }
    }

    // Contextual empty state hint
    function updateEmptyStateHint() {
        const el = document.getElementById('emptyStateHint');
        if (!el) return;
        try {
            const hostname = new URL(currentUrl).hostname.replace(/^www\./, '');
            if (hostname) {
                el.textContent = '';
                const link = document.createElement('a');
                link.href = '#';
                link.id = 'emptyFindLink';
                link.textContent = `Find scripts for ${hostname}`;
                link.style.cssText = 'color:var(--popup-accent);text-decoration:underline;cursor:pointer';
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    chrome.tabs.create({ url: `https://greasyfork.org/en/scripts/by-site/${encodeURIComponent(hostname)}?filter_locale=0` });
                    window.close();
                });
                el.appendChild(link);
            }
        } catch {}
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
            // Update message if provided and an element exists for it
            const msgEl = elements.setupWarning.querySelector('.setup-warning-msg, p, span');
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
        try {
            const response = await Promise.race([
                chrome.runtime.sendMessage({ action: 'getScriptsForUrl', url: currentUrl }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
            ]);

            pageScripts = response || [];
            renderScriptList();
            updateEnabledState();
        } catch (error) {
            console.error('Failed to load scripts:', error);
            pageScripts = [];
            renderScriptList();
            updateEnabledState();

            // Show distinct error state when background is unresponsive
            const emptyState = document.getElementById('emptyState');
            if (emptyState) {
                emptyState.style.display = 'block';
                const isTimeout = error.message === 'timeout';
                emptyState.textContent = '';
                const icon = document.createElement('div');
                icon.style.cssText = 'font-size:24px;margin-bottom:8px;opacity:0.6';
                icon.textContent = '\u26A0';
                const title = document.createElement('div');
                title.style.cssText = 'font-size:13px;font-weight:500;color:var(--popup-text);margin-bottom:4px';
                title.textContent = isTimeout ? 'ScriptVault is loading...' : 'Connection error';
                const desc = document.createElement('div');
                desc.style.cssText = 'font-size:12px;color:var(--popup-text-muted)';
                desc.textContent = isTimeout ? 'The background service is still starting up. Try again in a moment.' : 'Could not connect to ScriptVault background service.';
                emptyState.append(icon, title, desc);
            }
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

    // Shared dropdown state (module-level to avoid listener accumulation)
    let activeDropdownScriptId = null;
    let dropdownListenersAttached = false;

    // Render script list
    function renderScriptList() {
        if (!elements.scriptList) return;

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
            elements.scriptList.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
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

            // Description + last updated tooltip
            const updatedAgo = script.updatedAt ? timeAgo(script.updatedAt) : '';
            const tooltipParts = [description, updatedAgo ? `Updated ${updatedAgo}` : ''].filter(Boolean).join('\n');
            const descAttr = tooltipParts ? ` title="${escapeHtml(tooltipParts)}"` : '';

            // Stagger animation delay
            const animDelay = `style="animation-delay: ${i * 30}ms"`;

            // Running status indicator
            const statusClass = stats?.errors > 0 ? 'error' : (isRunning ? 'running' : 'idle');
            const statusTitle = stats?.errors > 0 ? `${stats.errors} error(s)` : (isRunning ? 'Running on this page' : 'Not active');

            // Recently installed (< 1 hour ago)
            const recentClass = script.installedAt && (Date.now() - script.installedAt < 3600000) ? ' recently-installed' : '';

            return `
                <div class="script-item${isRunning ? '' : ' not-running'}${recentClass}" data-script-id="${script.id}"${descAttr} ${animDelay}>
                    <span class="script-status ${statusClass}" title="${statusTitle}"></span>
                    <label class="script-toggle">
                        <input type="checkbox" ${enabled ? 'checked' : ''} data-toggle-id="${script.id}">
                        <span class="slider"></span>
                    </label>
                    <div class="script-icon">${icon}</div>
                    <span class="script-name" data-edit-id="${script.id}">${escapeHtml(name)}${version ? ` <span class="script-version">${escapeHtml(version)}</span>` : ''}</span>
                    ${errorDot}
                    ${perfHtml}
                    <div class="script-quick-edit" data-quickedit-id="${script.id}" title="Quick edit">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </div>
                    <div class="script-more" data-more-id="${script.id}">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
                        </svg>
                    </div>
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
            item.querySelector('.script-name')?.addEventListener('click', (e) => {
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
                    dropdown.classList.remove('open');
                    activeDropdownScriptId = null;
                    return;
                }
                activeDropdownScriptId = scriptId;
                populateMenuCommands(scriptId);
                const rect = moreBtn.getBoundingClientRect();
                dropdown.style.top = rect.bottom + 2 + 'px';
                dropdown.style.right = (document.documentElement.clientWidth - rect.right) + 'px';
                dropdown.classList.add('open');
            });
        });

        // Attach dropdown action listeners ONCE (they use module-level activeDropdownScriptId)
        if (!dropdownListenersAttached) {
            dropdownListenersAttached = true;

            dropdown.querySelector('[data-action="edit"]')?.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.remove('open');
                if (activeDropdownScriptId) openDashboard(activeDropdownScriptId);
            });

            dropdown.querySelector('[data-action="update"]')?.addEventListener('click', async (e) => {
                e.stopPropagation();
                dropdown.classList.remove('open');
                if (!activeDropdownScriptId) return;
                showPopupToast('Checking for update...');
                try {
                    const updates = await chrome.runtime.sendMessage({ action: 'checkUpdates', scriptId: activeDropdownScriptId });
                    if (updates && updates.length > 0) {
                        await chrome.runtime.sendMessage({ action: 'applyUpdate', scriptId: activeDropdownScriptId, code: updates[0].code });
                        showPopupToast(`Updated to v${updates[0].newVersion}`);
                        await loadPageScripts();
                    } else {
                        showPopupToast('Already up to date');
                    }
                } catch (err) {
                    showPopupToast('Update check failed', 'error');
                }
            });

            dropdown.querySelector('[data-action="copyUrl"]')?.addEventListener('click', async (e) => {
                e.stopPropagation();
                dropdown.classList.remove('open');
                if (!activeDropdownScriptId) return;
                const script = pageScripts.find(s => s.id === activeDropdownScriptId);
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
                dropdown.classList.remove('open');
                if (!activeDropdownScriptId) return;
                const script = pageScripts.find(s => s.id === activeDropdownScriptId);
                if (!script) return;
                const settings = script.settings || {};
                settings.pinned = !settings.pinned;
                await chrome.runtime.sendMessage({ action: 'setScriptSettings', scriptId: activeDropdownScriptId, settings });
                script.settings = settings;
                showPopupToast(settings.pinned ? 'Pinned' : 'Unpinned');
            });

            dropdown.querySelector('[data-action="delete"]')?.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.remove('open');
                if (!activeDropdownScriptId) return;
                const script = pageScripts.find(s => s.id === activeDropdownScriptId);
                const name = (script?.metadata || script?.meta || {}).name || 'this script';
                if (confirm(`Delete "${name}"?`)) {
                    deleteScript(activeDropdownScriptId);
                }
            });

            // Close dropdown when clicking outside (but not inside it)
            document.addEventListener('click', (e) => {
                if (!dropdown.contains(e.target) && !e.target.closest('.script-more')) {
                    dropdown.classList.remove('open');
                    activeDropdownScriptId = null;
                }
            });
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
                const el = document.createElement('div');
                el.className = 'script-dropdown-cmd';
                el.textContent = cmd.caption || cmd.name || 'Command';
                el.setAttribute('role', 'button');
                el.setAttribute('tabindex', '0');
                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    document.getElementById('scriptDropdown')?.classList.remove('open');
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

        if (iconUrl && sanitizeUrl(iconUrl)) {
            return `<img src="${escapeHtml(iconUrl)}" data-favicon-fallback="📜">`;
        }

        // Derive favicon from first matched domain
        const patterns = [...(meta.match || []), ...(meta.include || [])];
        for (const pattern of patterns) {
            const m = pattern.match(/^(?:\*|https?|file):\/\/(?:\*\.)?([^\/\*]+)/);
            if (m) {
                const domain = m[1].replace(/^\*\./, '').replace(/^www\./, '').toLowerCase();
                if (domain && domain !== '*' && !domain.includes('*')) {
                    const service = settings.faviconService || 'google';
                    const faviconUrl = service === 'duckduckgo'
                        ? `https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico`
                        : `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
                    return `<img src="${escapeHtml(faviconUrl)}" data-favicon-fallback="📜">`;
                }
            }
        }

        return '📜';
    }

    // Toggle script enabled/disabled
    async function toggleScript(scriptId, enabled) {
        try {
            await chrome.runtime.sendMessage({
                action: 'toggleScript',
                scriptId: scriptId,
                enabled: enabled
            });

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
        }
    }

    // Delete a script
    async function deleteScript(scriptId) {
        try {
            await chrome.runtime.sendMessage({
                action: 'deleteScript',
                scriptId: scriptId
            });

            // Remove from both local arrays and re-render
            pageScripts = pageScripts.filter(s => s.id !== scriptId);
            allScripts = allScripts.filter(s => s.id !== scriptId);
            renderScriptList();
            updateEnabledState();
            updateFooterCount();
            updateBadgeForTab();
        } catch (error) {
            console.error('Failed to delete script:', error);
        }
    }

    // Toggle global scripts enabled/disabled
    async function toggleGlobalEnabled() {
        const newEnabled = settings.enabled === false;
        
        try {
            await chrome.runtime.sendMessage({
                action: 'setSettings',
                settings: { enabled: newEnabled }
            });

            settings.enabled = newEnabled;
            updateEnabledState();
            
            // Update badge
            updateBadgeForTab();
        } catch (error) {
            console.error('Failed to toggle global enabled:', error);
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
        }
    }

    // Import from file
    function importFromFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,.zip';

        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const isZip = file.name.toLowerCase().endsWith('.zip');
                
                if (isZip) {
                    const arrayBuffer = await file.arrayBuffer();
                    const base64 = btoa(
                        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
                    );
                    
                    await chrome.runtime.sendMessage({
                        action: 'importFromZip',
                        zipData: base64,
                        options: { overwrite: true }
                    });
                } else {
                    const text = await file.text();
                    const data = JSON.parse(text);
                    
                    await chrome.runtime.sendMessage({
                        action: 'importAll',
                        data: { data, options: { overwrite: true } }
                    });
                }
                
                // Reload and close
                await loadPageScripts();
                updateBadgeForTab();
            } catch (error) {
                console.error('Failed to import:', error);
            }
        };

        input.click();
    }

    // Check for updates
    async function checkForUpdates() {
        try {
            await chrome.runtime.sendMessage({ action: 'checkUpdates' });
            showPopupToast('Checking for updates...');
            setTimeout(() => window.close(), 1200);
        } catch (error) {
            console.error('Failed to check updates:', error);
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
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.style.background = type === 'error' ? 'var(--popup-danger)' : 'var(--popup-accent)';
        toast.classList.remove('show');
        void toast.offsetWidth;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3500);
    }

    // Setup event listeners
    function setupEventListeners() {
        // Header toggle (global enable/disable)
        elements.headerToggle?.addEventListener('click', toggleGlobalEnabled);

        // Find scripts
        elements.btnFindScripts?.addEventListener('click', findScripts);

        // New script
        elements.btnNewScript?.addEventListener('click', createNewScript);

        // Utilities submenu toggle
        elements.btnUtilities?.addEventListener('click', async () => {
            elements.utilitiesSubmenu?.classList.toggle('open');
            // Update blacklist item with current domain (show toggle state)
            if (elements.btnBlacklistDomain && currentUrl) {
                try {
                    const domain = new URL(currentUrl).hostname;
                    if (domain) {
                        const menuText = elements.btnBlacklistDomain.querySelector('.menu-item-text');
                        if (menuText) {
                            const res = await chrome.runtime.sendMessage({ action: 'getSettings' });
                            const bl = (res?.settings || res || {}).blacklist || [];
                            const isBlacklisted = bl.some(p => p === `*://${domain}/*` || p === `*://*.${domain}/*`);
                            menuText.textContent = isBlacklisted ? `Remove ${domain} from blacklist` : `Do not run on ${domain}`;
                        }
                    }
                } catch (e) {}
            }
        });

        // Utilities actions
        elements.btnExportZip?.addEventListener('click', exportToZip);
        elements.btnImport?.addEventListener('click', importFromFile);
        elements.btnCheckUpdates?.addEventListener('click', checkForUpdates);

        // Blacklist domain (toggle)
        elements.btnBlacklistDomain?.addEventListener('click', async () => {
            if (!currentUrl) return;
            try {
                const domain = new URL(currentUrl).hostname;
                const pattern = `*://${domain}/*`;
                const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
                const freshSettings = response?.settings || response || {};
                const blacklist = freshSettings.blacklist || [];
                const existingIdx = blacklist.findIndex(p => p === pattern || p === `*://*.${domain}/*`);
                if (existingIdx !== -1) {
                    blacklist.splice(existingIdx, 1);
                    await chrome.runtime.sendMessage({ action: 'setSettings', settings: { blacklist } });
                    showPopupToast(`${domain} removed from blacklist`);
                    const menuText = elements.btnBlacklistDomain.querySelector('.menu-item-text');
                    if (menuText) menuText.textContent = `Do not run on ${domain}`;
                    return;
                }
                blacklist.push(pattern);
                await chrome.runtime.sendMessage({ action: 'setSettings', settings: { blacklist } });
                showPopupToast(`${domain} blacklisted`);
                const menuText = elements.btnBlacklistDomain.querySelector('.menu-item-text');
                if (menuText) menuText.textContent = `Remove ${domain} from blacklist`;
            } catch (e) {
                console.error('Failed to blacklist:', e);
            }
        });

        // Dashboard
        elements.btnDashboard?.addEventListener('click', () => openDashboard());
        
        // Setup warning - Open extension settings
        elements.btnOpenExtSettings?.addEventListener('click', () => {
            const extensionId = chrome.runtime.id;
            chrome.tabs.create({ url: `chrome://extensions/?id=${extensionId}` });
            window.close();
        });

        // Feedback link
        document.getElementById('btnFeedback')?.addEventListener('click', () => {
            chrome.tabs.create({ url: 'https://github.com/SysAdminDoc/ScriptVault/issues' });
            window.close();
        });

        // Keyboard navigation for script list
        document.addEventListener('keydown', (e) => {
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
    }

    // Keyboard support for role="button" elements (Enter/Space activates click)
    document.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target.getAttribute('role') === 'button') {
            e.preventDefault();
            e.target.click();
        }
    });

    // Start
    document.addEventListener('DOMContentLoaded', init);
})();
