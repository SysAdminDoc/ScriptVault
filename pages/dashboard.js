// ScriptVault Dashboard v2.0.0 - Full-Featured Controller
(function() {
    'use strict';

    // State
    const state = {
        scripts: [],
        settings: {},
        folders: [],
        workspaces: [],
        currentScriptId: null,
        editor: null,
        unsavedChanges: false,
        selectedScripts: new Set(),
        sortColumn: 'updated',
        sortDirection: 'desc',
        openTabs: {},  // { scriptId: { code, unsaved } }
        _collapsedFolders: new Set(),
        _lastCheckedId: null,
        _quotaWarned: false,
        settingsPanelFilter: 'all',
        utilitiesPanelFilter: 'all',
        backupBrowserFilter: 'all',
        backupBrowserSort: 'newest',
        backupBrowserQuery: '',
        helpPanelFilter: 'all',
        trashPanelFilter: 'all',
        trashItems: [],
        trustCenter: {
            runtimeStatus: null,
            publicApiOrigins: [],
            publicApiPermissions: {},
            publicApiAudit: [],
            signingKeys: {},
            lastRuntimeRepairAt: 0
        },
        backups: [],
        backupSettings: null
    };

    // DOM Elements
    const elements = {};
    const numberFormatter = new Intl.NumberFormat();
    const bytesFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
    const fullDateFormatter = new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
    const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
    const relativeTimeFormatter = typeof Intl.RelativeTimeFormat === 'function'
        ? new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
        : null;
    const timeOnlyFormatter = new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit'
    });
    const THEME_LABELS = {
        dark: 'Dark',
        light: 'Light',
        catppuccin: 'Catppuccin',
        oled: 'OLED'
    };
    const SETTINGS_FILTER_LABELS = {
        all: 'all sections',
        core: 'core settings',
        workspace: 'workspace settings',
        automation: 'automation settings',
        security: 'security settings',
        recovery: 'recovery settings'
    };
    const UTILITIES_FILTER_LABELS = {
        all: 'all utilities',
        backup: 'backup utilities',
        import: 'import utilities',
        cloud: 'cloud utilities',
        diagnostics: 'diagnostic utilities'
    };
    const SCRIPT_FILTER_LABELS = {
        all: 'All Scripts',
        enabled: 'Enabled',
        disabled: 'Disabled',
        attention: 'Needs Review',
        pinned: 'Pinned',
        local: 'Local Edits',
        remote: 'Remote Source',
        'has-errors': 'Has Errors',
        'has-updates': 'Has Update URL',
        'no-url': 'No Update URL',
        'grant:xhr': 'Uses XHR',
        'grant:storage': 'Uses Storage',
        'grant:style': 'Uses AddStyle',
        'grant:none': 'Grant None',
        'scope:broad': 'Broad Match',
        'scope:single': 'Single Site'
    };
    const SCRIPT_SORT_LABELS = {
        order: 'Manual Order',
        enabled: 'Enabled',
        name: 'Name',
        version: 'Version',
        size: 'Size',
        lines: 'Lines',
        updated: 'Updated',
        perf: 'Performance'
    };
    const BULK_ACTION_LABELS = {
        enable: 'Enable Selected',
        disable: 'Disable Selected',
        export: 'Export Selected',
        update: 'Update Selected',
        reset: 'Reset Selected',
        delete: 'Delete Selected'
    };
    const BACKUP_BROWSER_FILTER_LABELS = {
        all: 'all backups',
        vault: 'vault snapshots',
        scripts: 'scripts-only backups',
        values: 'backups with stored values'
    };
    const BACKUP_BROWSER_SORT_LABELS = {
        newest: 'newest first',
        oldest: 'oldest first',
        largest: 'largest archives first',
        scripts: 'most scripts first'
    };
    const TRASH_FILTER_LABELS = {
        all: 'all deleted scripts',
        recent: 'deletions from the last 7 days',
        older: 'older deletions'
    };
    const HELP_FILTER_LABELS = {
        all: 'all references',
        actions: 'action references',
        shortcuts: 'shortcut references',
        reference: 'API and matcher references'
    };
    const BACKUP_DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const SETTINGS_SECTION_GROUPS = {
        general: 'core',
        appearance: 'workspace',
        tags: 'workspace',
        'action menu': 'workspace',
        'context menu': 'workspace',
        'userscript search': 'automation',
        'userscript update': 'automation',
        externals: 'automation',
        'userscript sync': 'automation',
        editor: 'workspace',
        security: 'security',
        'runtime host permissions': 'security',
        blackcheck: 'security',
        'downloads beta': 'security',
        experimental: 'security',
        reset: 'recovery'
    };
    const UTILITIES_SECTION_GROUPS = {
        general: 'backup',
        cloud: 'cloud',
        'import from file': 'import',
        zip: 'backup',
        file: 'backup',
        'backup schedule': 'backup',
        'backup browser': 'backup',
        'script stats': 'diagnostics',
        'tampermonkey import': 'import',
        textarea: 'import',
        'import from url': 'import',
        'batch install from urls': 'import',
        workspaces: 'backup',
        'network request log': 'diagnostics',
        'performance budgets': 'diagnostics',
        'runtime repair': 'diagnostics',
        'support snapshot': 'diagnostics',
        'public api trust': 'diagnostics',
        'signing trust': 'diagnostics',
        'activity log': 'diagnostics'
    };
    const SCRIPT_SEARCH_DEBOUNCE_MS = 90;
    const DASHBOARD_TABS = ['scripts', 'settings', 'utilities', 'trash', 'store', 'help'];
    const OAUTH_SYNC_PROVIDERS = ['googledrive', 'dropbox', 'onedrive'];
    let modalLastFocusedElement = null;
    let modalFocusManaged = false;
    let progressLastFocusedElement = null;
    let progressFocusManaged = false;
    let progressHideTimer = null;
    let editorLastFocusedElement = null;
    let editorFocusManaged = false;
    let findScriptsLastFocusedElement = null;
    let findScriptsFocusManaged = false;
    let scriptSearchTimer = null;
    let commandPaletteReturnFocus = null;
    const PROGRESS_BACKGROUND_SELECTORS = ['.skip-link', '.tm-header', '#viewSettingsBar', '#setupWarning', '#mainContent', '#editorOverlay', '#findScriptsOverlay', '#modal', '#commandPalette'];
    const EDITOR_BACKGROUND_SELECTORS = ['.skip-link', '.tm-header', '#viewSettingsBar', '#setupWarning', '#mainContent'];
    const FIND_SCRIPTS_BACKGROUND_SELECTORS = ['.skip-link', '.tm-header', '#mainContent'];

    function normalizeSyncProvider(settings = {}) {
        const provider = settings.syncProvider || settings.syncType || 'none';
        return provider === 'browser' ? 'none' : provider;
    }

    function normalizeSyncEnabled(settings = {}) {
        return settings.syncEnabled ?? settings.enableSync ?? false;
    }

    function formatSyncTimestamp(timestamp) {
        return timestamp ? dateTimeFormatter.format(new Date(timestamp)) : 'Never';
    }

    function syncSettingsProviderSelection(provider) {
        if (!elements.settingsSyncType) return;
        const options = Array.from(elements.settingsSyncType.options || []);
        const nextProvider = options.some(option => option.value === provider) ? provider : 'none';
        elements.settingsSyncType.value = nextProvider;
    }

    function syncCloudProviderSelection(provider, { triggerChange = true } = {}) {
        if (!elements.cloudProvider) return;
        const options = Array.from(elements.cloudProvider.options || []);
        const nextProvider = options.some(option => option.value === provider) ? provider : 'none';
        elements.cloudProvider.value = nextProvider;
        if (triggerChange) {
            elements.cloudProvider.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    function getDashboardUrl() {
        return new URL(window.location.href);
    }

    function replaceDashboardUrl(url) {
        history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    }

    function setDashboardHash(fragment) {
        const url = getDashboardUrl();
        url.hash = fragment ? `#${fragment}` : '';
        replaceDashboardUrl(url);
    }

    function escapeSelectorValue(value) {
        if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
            return CSS.escape(String(value));
        }
        return String(value).replace(/"/g, '\\"');
    }

    function getScriptTabElement(scriptId) {
        if (!scriptId) return null;
        return document.querySelector(`.tm-tab.script-tab[data-script-id="${escapeSelectorValue(scriptId)}"]`);
    }

    function getDashboardRoute() {
        const hash = window.location.hash.slice(1);
        const decodeRouteValue = (value) => {
            if (!value) return '';
            try {
                return decodeURIComponent(value);
            } catch {
                return value;
            }
        };
        if (!hash) return { type: 'tab', tab: 'scripts' };
        if (hash === 'new_script' || hash === 'new') return { type: 'new' };
        if (hash.startsWith('tab=')) {
            const tab = hash.slice(4);
            return { type: 'tab', tab: DASHBOARD_TABS.includes(tab) ? tab : 'scripts' };
        }
        if (hash.startsWith('script_')) {
            return { type: 'script', scriptId: decodeRouteValue(hash.slice(7)) };
        }
        if (hash.startsWith('script=')) {
            return { type: 'script', scriptId: decodeRouteValue(hash.slice(7)) };
        }
        if (hash.startsWith('edit=')) {
            return { type: 'script', scriptId: decodeRouteValue(hash.slice(5)) };
        }
        return { type: 'script', scriptId: decodeRouteValue(hash) };
    }

    function getCurrentScriptViewMode() {
        try {
            return localStorage.getItem('sv_viewMode') === 'card' ? 'card' : 'table';
        } catch {
            return 'table';
        }
    }

    function getScriptDisplayName(scriptId) {
        return state.scripts.find(script => script.id === scriptId)?.metadata?.name || scriptId;
    }

    function getErrorMessage(error, fallback = 'Unknown error') {
        if (typeof error === 'string' && error.trim()) return error.trim();
        if (error && typeof error.message === 'string' && error.message.trim()) return error.message.trim();
        return fallback;
    }

    function summarizeNames(names = [], maxVisible = 2) {
        const cleanNames = names
            .filter(name => typeof name === 'string')
            .map(name => name.trim())
            .filter(Boolean);
        if (cleanNames.length === 0) return '';
        if (cleanNames.length <= maxVisible) return cleanNames.join(', ');
        return `${cleanNames.slice(0, maxVisible).join(', ')}, +${cleanNames.length - maxVisible} more`;
    }

    function getBulkActionButtonLabel(action) {
        return BULK_ACTION_LABELS[action] || 'Apply';
    }

    function buildBulkActionToast(action, result) {
        const totalCount = result.totalCount || 0;
        const successCount = result.successCount || 0;
        const failureCount = result.failureCount || 0;
        const skippedCount = result.skippedCount || 0;
        const plural = count => count === 1 ? 'script' : 'scripts';
        const formattedTotal = numberFormatter.format(totalCount);
        const formattedSuccess = numberFormatter.format(successCount);
        const formattedSkipped = numberFormatter.format(skippedCount);
        const failureNames = summarizeNames((result.failures || []).map(entry => entry.name));
        const singleFailure = (result.failures || [])[0];

        const failureDetail = failureCount === 1 && singleFailure
            ? `${singleFailure.name}: ${singleFailure.reason}.`
            : failureNames
                ? `Needs attention: ${failureNames}.`
                : '';

        if (action === 'update') {
            if (failureCount === 0 && successCount === 0) {
                return {
                    tone: 'info',
                    summary: 'All selected scripts are already up to date.',
                    detail: '',
                };
            }

            if (failureCount === 0) {
                return {
                    tone: 'success',
                    summary: `Updated ${formattedSuccess} ${plural(successCount)}.`,
                    detail: skippedCount > 0 ? `${formattedSkipped} already up to date.` : '',
                };
            }

            if (successCount > 0) {
                return {
                    tone: 'warning',
                    summary: `Updated ${formattedSuccess} of ${formattedTotal} selected scripts.`,
                    detail: [skippedCount > 0 ? `${formattedSkipped} already up to date.` : '', failureDetail].filter(Boolean).join(' '),
                };
            }

            return {
                tone: 'error',
                summary: "Couldn't update the selected scripts.",
                detail: [skippedCount > 0 ? `${formattedSkipped} already up to date.` : '', failureDetail].filter(Boolean).join(' '),
            };
        }

        const actionCopy = {
            enable: { success: 'Enabled', failure: 'enable' },
            disable: { success: 'Disabled', failure: 'disable' },
            export: { success: 'Exported', failure: 'export' },
            reset: { success: 'Reset', failure: 'reset' },
            delete: { success: 'Deleted', failure: 'delete' }
        }[action];

        if (!actionCopy) {
            return {
                tone: failureCount > 0 ? 'warning' : 'success',
                summary: failureCount > 0 ? `Completed ${formattedSuccess} of ${formattedTotal} selected scripts.` : `Completed ${formattedSuccess} ${plural(successCount)}.`,
                detail: failureDetail,
            };
        }

        if (failureCount === 0) {
            return {
                tone: 'success',
                summary: `${actionCopy.success} ${formattedSuccess} ${plural(successCount)}.`,
                detail: '',
            };
        }

        if (successCount > 0) {
            return {
                tone: 'warning',
                summary: `${actionCopy.success} ${formattedSuccess} of ${formattedTotal} selected scripts.`,
                detail: failureDetail,
            };
        }

        return {
            tone: 'error',
            summary: `Couldn't ${actionCopy.failure} the selected scripts.`,
            detail: failureDetail,
        };
    }

    async function runBulkScriptOperation(ids, options) {
        const failures = [];
        const skipped = [];
        const succeededIds = [];
        const {
            action,
            progressTitle,
            task,
            reloadAfter = true,
            refreshStats = false,
            keepFailedSelection = false,
        } = options;

        showProgress(progressTitle);
        try {
            for (let i = 0; i < ids.length; i++) {
                const scriptId = ids[i];
                const name = getScriptDisplayName(scriptId);
                updateProgress(i + 1, ids.length, `${name} (${i + 1}/${ids.length})`);
                try {
                    const result = await task(scriptId, name, i);
                    if (result?.skipped) {
                        skipped.push({
                            id: scriptId,
                            name,
                            reason: result.reason || '',
                        });
                        continue;
                    }
                    succeededIds.push(scriptId);
                } catch (error) {
                    const reason = getErrorMessage(error, `Failed to ${action} ${name}`);
                    failures.push({ id: scriptId, name, reason });
                    console.warn(`[ScriptVault] Bulk ${action} failed for`, scriptId, reason);
                }
            }

            if (reloadAfter) await loadScripts();
            if (refreshStats) updateStats();

            if (keepFailedSelection) {
                state.selectedScripts = new Set(ids.filter(id => !succeededIds.includes(id)));
                if (state._lastCheckedId && !state.selectedScripts.has(state._lastCheckedId)) {
                    state._lastCheckedId = null;
                }
            }

            const feedback = buildBulkActionToast(action, {
                totalCount: ids.length,
                successCount: succeededIds.length,
                failureCount: failures.length,
                skippedCount: skipped.length,
                failures,
                skipped,
            });
            showToast(feedback.summary, feedback.tone);
            return { succeededIds, failures, skipped, feedback };
        } finally {
            hideProgress();
        }
    }

    function isValidScriptFilter(value) {
        if (!value || !elements.filterSelect) return false;
        return Array.from(elements.filterSelect.options || []).some(option => option.value === value && !option.disabled);
    }

    function normalizeScriptSortColumn(value) {
        return Object.prototype.hasOwnProperty.call(SCRIPT_SORT_LABELS, value) ? value : 'updated';
    }

    function normalizeScriptSortDirection(value) {
        return value === 'asc' ? 'asc' : 'desc';
    }

    function restoreScriptViewModeFromQuery() {
        const viewMode = getDashboardUrl().searchParams.get('view');
        if (viewMode === 'card' || viewMode === 'table') {
            try {
                localStorage.setItem('sv_viewMode', viewMode);
            } catch {
                // Ignore localStorage failures
            }
        }
    }

    function restoreScriptWorkspaceStateFromQuery() {
        const params = getDashboardUrl().searchParams;
        const query = params.get('q') || '';
        const filter = params.get('filter') || 'all';
        const sort = normalizeScriptSortColumn(params.get('sort') || state.sortColumn);
        const dir = normalizeScriptSortDirection(params.get('dir') || state.sortDirection);

        if (elements.scriptSearch) {
            elements.scriptSearch.value = query;
        }
        if (elements.filterSelect && isValidScriptFilter(filter)) {
            elements.filterSelect.value = filter;
        }
        state.sortColumn = sort;
        state.sortDirection = dir;
        updateScriptSearchAffordances();
        updateScriptQuickFilterButtons();
    }

    function syncScriptWorkspaceStateToUrl() {
        const url = getDashboardUrl();
        const searchValue = elements.scriptSearch?.value?.trim() || '';
        const filterValue = elements.filterSelect?.value || 'all';
        const viewMode = getCurrentScriptViewMode();

        if (searchValue) url.searchParams.set('q', searchValue);
        else url.searchParams.delete('q');

        if (filterValue !== 'all') url.searchParams.set('filter', filterValue);
        else url.searchParams.delete('filter');

        if (state.sortColumn !== 'updated') url.searchParams.set('sort', state.sortColumn);
        else url.searchParams.delete('sort');

        if (state.sortDirection !== 'desc') url.searchParams.set('dir', state.sortDirection);
        else url.searchParams.delete('dir');

        if (viewMode !== 'table') url.searchParams.set('view', viewMode);
        else url.searchParams.delete('view');

        replaceDashboardUrl(url);
    }

    function updateScriptSearchAffordances() {
        if (!elements.btnClearScriptSearch) return;
        const hasSearch = Boolean(elements.scriptSearch?.value?.trim());
        elements.btnClearScriptSearch.hidden = !hasSearch;
    }

    function updateScriptQuickFilterButtons() {
        const activeFilter = elements.filterSelect?.value || 'all';
        document.querySelectorAll('#scriptQuickFilters .script-filter-chip[data-filter-value]').forEach(button => {
            const isActive = button.dataset.filterValue === activeFilter;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', String(isActive));
        });
    }

    function updateScriptResultsSummary(filtered = []) {
        if (!elements.scriptResultsSummary) return;

        const total = state.scripts.length;
        const shown = filtered.length;
        const enabledCount = filtered.filter(script => script.enabled !== false).length;
        const pinnedCount = filtered.filter(script => script.settings?.pinned).length;
        const filterValue = elements.filterSelect?.value || 'all';
        const searchValue = elements.scriptSearch?.value?.trim() || '';
        const sortLabel = SCRIPT_SORT_LABELS[state.sortColumn] || 'Updated';
        const sortDirectionLabel = state.sortDirection === 'asc' ? 'Ascending' : 'Descending';
        const viewLabel = getCurrentScriptViewMode() === 'card' ? 'Cards' : 'Table';
        const fragments = [
            `<strong>${numberFormatter.format(shown)}</strong> visible`
        ];

        if (total !== shown) {
            fragments.push(`${numberFormatter.format(total)} total`);
        }
        fragments.push(`${numberFormatter.format(enabledCount)} enabled`);
        if (pinnedCount > 0) {
            fragments.push(`${numberFormatter.format(pinnedCount)} pinned`);
        }
        fragments.push(`${sortLabel} ${state.sortDirection === 'asc' ? '↑' : '↓'}`);
        if (filterValue !== 'all') {
            fragments.push(`Filter: ${escapeHtml(SCRIPT_FILTER_LABELS[filterValue] || filterValue)}`);
        }
        if (searchValue) {
            fragments.push(`Search: ${escapeHtml(searchValue)}`);
        }
        fragments.push(`View: ${viewLabel}`);

        elements.scriptResultsSummary.innerHTML = fragments.join(' • ');

        if (elements.btnClearScriptWorkspace) {
            elements.btnClearScriptWorkspace.hidden = !(
                searchValue ||
                filterValue !== 'all' ||
                state.sortColumn !== 'updated' ||
                state.sortDirection !== 'desc' ||
                viewLabel === 'Cards'
            );
        }
    }

    function resetScriptWorkspaceView() {
        if (elements.scriptSearch) elements.scriptSearch.value = '';
        if (elements.filterSelect) elements.filterSelect.value = 'all';
        state.sortColumn = 'updated';
        state.sortDirection = 'desc';
        if (typeof CardView !== 'undefined' && typeof CardView.setViewMode === 'function') {
            CardView.setViewMode('table');
        } else {
            try {
                localStorage.setItem('sv_viewMode', 'table');
            } catch {
                // Ignore localStorage failures
            }
        }
        updateSortIndicators();
        updateScriptSearchAffordances();
        updateScriptQuickFilterButtons();
        renderScriptTable();
    }

    function getTransferPreferences() {
        return {
            includeStorage: elements.exportIncludeStorage?.checked !== false,
            includeSettings: !!elements.exportIncludeSettings?.checked
        };
    }

    function formatBackupReason(reason = 'backup') {
        const normalized = String(reason || 'backup')
            .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
            .replace(/[-_]+/g, ' ')
            .trim()
            .replace(/\s+/g, ' ');
        return normalized ? normalized.replace(/\b\w/g, char => char.toUpperCase()) : 'Backup';
    }

    function getLatestBackup() {
        return Array.isArray(state.backups) && state.backups.length ? state.backups[0] : null;
    }

    function describeBackupScope(backup = {}) {
        const scopeParts = [];
        if (backup.hasGlobalSettings || backup.hasFolders || backup.hasWorkspaces) {
            scopeParts.push('vault snapshot');
        } else {
            scopeParts.push('scripts only');
        }
        if (backup.hasScriptStorage) {
            scopeParts.push('stored values');
        }
        return scopeParts.join(' + ');
    }

    function formatBackupBrowserSummary(backups = []) {
        if (!Array.isArray(backups) || backups.length === 0) {
            return '0 backups · no recovery snapshots yet';
        }
        const totalSize = backups.reduce((sum, entry) => sum + Number(entry.size || 0), 0);
        const latestBackup = backups[0];
        const latestLabel = latestBackup?.timestamp
            ? `latest ${formatBackupReason(latestBackup.reason).toLowerCase()} backup ${dateTimeFormatter.format(new Date(latestBackup.timestamp))}`
            : 'latest backup time unknown';
        return `${numberFormatter.format(backups.length)} backups · ${formatBytes(totalSize)} · ${latestLabel}`;
    }

    function formatRelativeBackupTime(timestamp) {
        if (!timestamp) return 'time unknown';
        const deltaMs = timestamp - Date.now();
        const minute = 60 * 1000;
        const hour = 60 * minute;
        const day = 24 * hour;
        const week = 7 * day;
        const month = 30 * day;
        const year = 365 * day;
        if (!relativeTimeFormatter) {
            return dateTimeFormatter.format(new Date(timestamp));
        }
        const absDelta = Math.abs(deltaMs);
        if (absDelta < hour) {
            return relativeTimeFormatter.format(Math.round(deltaMs / minute), 'minute');
        }
        if (absDelta < day) {
            return relativeTimeFormatter.format(Math.round(deltaMs / hour), 'hour');
        }
        if (absDelta < week) {
            return relativeTimeFormatter.format(Math.round(deltaMs / day), 'day');
        }
        if (absDelta < month) {
            return relativeTimeFormatter.format(Math.round(deltaMs / week), 'week');
        }
        if (absDelta < year) {
            return relativeTimeFormatter.format(Math.round(deltaMs / month), 'month');
        }
        return relativeTimeFormatter.format(Math.round(deltaMs / year), 'year');
    }

    function getBackupAgeGroup(timestamp) {
        if (!timestamp) return 'Older';
        const now = new Date();
        const backupDate = new Date(timestamp);
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const startOfWeek = startOfToday - (6 * 24 * 60 * 60 * 1000);
        if (timestamp >= startOfToday) return 'Today';
        if (timestamp >= startOfWeek) return 'Last 7 Days';
        if (backupDate.getFullYear() === now.getFullYear() && backupDate.getMonth() === now.getMonth()) {
            return 'Earlier This Month';
        }
        return 'Older';
    }

    function groupBackupsForDisplay(backups = [], groupOrder = ['Today', 'Last 7 Days', 'Earlier This Month', 'Older']) {
        const map = new Map();
        backups.forEach(backup => {
            const label = getBackupAgeGroup(backup.timestamp);
            if (!map.has(label)) {
                map.set(label, []);
            }
            map.get(label).push(backup);
        });
        const groups = [];
        groupOrder.forEach(label => {
            if (map.has(label)) {
                groups.push({ label, backups: map.get(label) });
                map.delete(label);
            }
        });
        map.forEach((groupBackups, label) => {
            groups.push({ label, backups: groupBackups });
        });
        return groups;
    }

    function sortBackupsForDisplay(backups = [], sort = state.backupBrowserSort) {
        const orderedBackups = Array.isArray(backups) ? backups.slice() : [];
        const byNewest = (a, b) => Number(b?.timestamp || 0) - Number(a?.timestamp || 0);
        switch (sort) {
            case 'oldest':
                return orderedBackups.sort((a, b) => Number(a?.timestamp || 0) - Number(b?.timestamp || 0));
            case 'largest':
                return orderedBackups.sort((a, b) => Number(b?.size || 0) - Number(a?.size || 0) || byNewest(a, b));
            case 'scripts':
                return orderedBackups.sort((a, b) => Number(b?.scriptCount || 0) - Number(a?.scriptCount || 0) || byNewest(a, b));
            case 'newest':
            default:
                return orderedBackups.sort(byNewest);
        }
    }

    function getBackupDisplayGroups(backups = []) {
        const orderedBackups = sortBackupsForDisplay(backups);
        if (state.backupBrowserSort === 'largest') {
            return [{ label: 'Largest Archives', backups: orderedBackups }];
        }
        if (state.backupBrowserSort === 'scripts') {
            return [{ label: 'Most Scripts', backups: orderedBackups }];
        }
        const groupOrder = state.backupBrowserSort === 'oldest'
            ? ['Older', 'Earlier This Month', 'Last 7 Days', 'Today']
            : ['Today', 'Last 7 Days', 'Earlier This Month', 'Older'];
        return groupBackupsForDisplay(orderedBackups, groupOrder);
    }

    function backupMatchesBrowserFilter(backup, filter = state.backupBrowserFilter) {
        switch (filter) {
            case 'vault':
                return !!(backup.hasGlobalSettings || backup.hasFolders || backup.hasWorkspaces);
            case 'scripts':
                return !(backup.hasGlobalSettings || backup.hasFolders || backup.hasWorkspaces);
            case 'values':
                return !!backup.hasScriptStorage;
            case 'all':
            default:
                return true;
        }
    }

    function getVisibleBackups(backups = state.backups) {
        const query = normalizeSettingsLabel(state.backupBrowserQuery);
        return (Array.isArray(backups) ? backups : []).filter(backup => {
            if (!backupMatchesBrowserFilter(backup)) return false;
            if (!query) return true;
            const haystack = normalizeSettingsLabel([
                formatBackupReason(backup.reason),
                backup.version || '',
                describeBackupScope(backup),
                backup.hasGlobalSettings ? 'settings' : '',
                backup.hasFolders ? 'folders' : '',
                backup.hasWorkspaces ? 'workspaces' : '',
                backup.hasScriptStorage ? 'stored values' : '',
                backup.timestamp ? dateTimeFormatter.format(new Date(backup.timestamp)) : ''
            ].join(' '));
            return haystack.includes(query);
        });
    }

    function resetBackupBrowserView() {
        state.backupBrowserFilter = 'all';
        state.backupBrowserSort = 'newest';
        state.backupBrowserQuery = '';
        if (elements.backupBrowserQuickFilter) elements.backupBrowserQuickFilter.value = '';
        if (elements.backupBrowserSort) elements.backupBrowserSort.value = 'newest';
        applyBackupBrowserFilters();
    }

    function syncPressedButtons(buttons, isActive) {
        buttons?.forEach(button => {
            const active = Boolean(isActive(button));
            button.classList.toggle('active', active);
            button.setAttribute('aria-pressed', String(active));
        });
    }

    function setEditorTab(panelId, { focusTab = false } = {}) {
        const tabs = Array.from(elements.editorTabs || []);
        const targetTab = tabs.find(tab => tab.dataset.panel === panelId);
        const targetPanel = elements.editorPanels?.[panelId];
        if (!targetTab || !targetPanel) return false;

        tabs.forEach(tab => {
            const isActive = tab === targetTab;
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-selected', String(isActive));
            tab.tabIndex = isActive ? 0 : -1;
        });

        Object.entries(elements.editorPanels || {}).forEach(([id, panel]) => {
            if (!panel) return;
            const isActive = id === panelId;
            panel.classList.toggle('active', isActive);
            panel.hidden = !isActive;
        });

        if (focusTab) targetTab.focus();
        if (panelId === 'code') setTimeout(() => state.editor?.refresh(), 10);
        if (panelId === 'scriptsettings') {
            const script = state.scripts.find(s => s.id === state.currentScriptId);
            loadScriptSettings(script);
        }
        return true;
    }

    function clearDashboardSectionSelection() {
        Array.from(elements.dashboardTabs || []).forEach(tab => {
            tab.classList.remove('active');
            tab.setAttribute('aria-selected', 'false');
            tab.tabIndex = -1;
        });

        Object.values(elements.mainPanels || {}).forEach(panel => {
            if (!panel) return;
            panel.classList.remove('active');
            panel.hidden = true;
        });

        if (elements.btnHelpTab) {
            elements.btnHelpTab.classList.remove('active');
            elements.btnHelpTab.setAttribute('aria-expanded', 'false');
            elements.btnHelpTab.setAttribute('aria-pressed', 'false');
        }
    }

    function setDashboardSection(name, { focusControl = false } = {}) {
        const nextTab = DASHBOARD_TABS.includes(name) ? name : 'scripts';
        clearDashboardSectionSelection();

        if (nextTab === 'help') {
            const panel = elements.mainPanels?.help;
            if (!panel) return false;
            panel.classList.add('active');
            panel.hidden = false;
            elements.btnHelpTab?.classList.add('active');
            elements.btnHelpTab?.setAttribute('aria-expanded', 'true');
            elements.btnHelpTab?.setAttribute('aria-pressed', 'true');
            if (focusControl) elements.btnHelpTab?.focus();
            return true;
        }

        const tab = Array.from(elements.dashboardTabs || []).find(candidate => candidate.dataset.tab === nextTab);
        const panel = elements.mainPanels?.[nextTab];
        if (!tab || !panel) return false;

        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        tab.tabIndex = 0;
        panel.classList.add('active');
        panel.hidden = false;
        if (focusControl) tab.focus();
        return true;
    }

    function setEditorBackgroundHidden(hidden) {
        EDITOR_BACKGROUND_SELECTORS.forEach(selector => {
            const element = document.querySelector(selector);
            if (!(element instanceof HTMLElement) || element === elements.editorOverlay) {
                return;
            }

            if (hidden) {
                const previousAriaHidden = element.getAttribute('aria-hidden');
                element.dataset.editorPreviousAriaHidden = previousAriaHidden == null ? '__none__' : previousAriaHidden;
                element.setAttribute('aria-hidden', 'true');
                element.inert = true;
                return;
            }

            if (element.dataset.editorPreviousAriaHidden === '__none__') {
                element.removeAttribute('aria-hidden');
            } else if (element.dataset.editorPreviousAriaHidden) {
                element.setAttribute('aria-hidden', element.dataset.editorPreviousAriaHidden);
            }
            delete element.dataset.editorPreviousAriaHidden;
            element.inert = false;
        });
    }

    function openEditorOverlay() {
        const overlay = elements.editorOverlay;
        if (!overlay) return;

        if (!overlay.classList.contains('active')) {
            editorLastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            editorFocusManaged = false;
        }

        overlay.hidden = false;
        overlay.setAttribute('aria-hidden', 'false');
        overlay.classList.add('active');

        if (!editorFocusManaged) {
            setEditorBackgroundHidden(true);
            if (typeof A11y !== 'undefined' && typeof A11y.trapFocus === 'function') {
                A11y.trapFocus(overlay);
                editorFocusManaged = true;
            }
        }
    }

    function hideEditorOverlay({ restoreFocus = false, focusTarget = null } = {}) {
        const overlay = elements.editorOverlay;
        if (!overlay) return;

        overlay.classList.remove('active');
        overlay.hidden = true;
        overlay.setAttribute('aria-hidden', 'true');
        setEditorBackgroundHidden(false);

        if (editorFocusManaged && typeof A11y !== 'undefined' && typeof A11y.releaseFocus === 'function') {
            A11y.releaseFocus();
            editorFocusManaged = false;
        }

        const target = focusTarget?.isConnected
            ? focusTarget
            : (restoreFocus && editorLastFocusedElement?.isConnected ? editorLastFocusedElement : null);
        editorLastFocusedElement = null;

        if (target instanceof HTMLElement) {
            requestAnimationFrame(() => target.focus());
        }
    }

    function getOpenScriptTabs() {
        return Array.from(document.querySelectorAll('.tm-tab.script-tab'));
    }

    function syncScriptTabAccessibility(tab, options = {}) {
        if (!(tab instanceof HTMLElement)) return;
        const name = options.name || tab.dataset.scriptName || tab.querySelector('.tab-name')?.textContent?.trim() || 'Untitled script';
        const isActive = typeof options.isActive === 'boolean' ? options.isActive : tab.classList.contains('active');
        const isDirty = typeof options.isDirty === 'boolean' ? options.isDirty : tab.classList.contains('unsaved');
        const labelParts = [
            isActive ? `Editing ${name}` : `Open ${name}`,
            isDirty ? 'Unsaved changes.' : 'Saved changes.',
            'Press Delete to close this tab.'
        ];

        tab.dataset.scriptName = name;
        tab.title = name;
        tab.setAttribute('aria-label', labelParts.join(' '));
        tab.setAttribute('aria-keyshortcuts', 'Delete Backspace');
        if (isActive) {
            tab.setAttribute('aria-current', 'true');
        } else {
            tab.removeAttribute('aria-current');
        }
    }

    function getCommandPaletteItems(overlay = document.getElementById('commandPalette')) {
        return Array.from(overlay?.querySelectorAll('.cmd-item') || []);
    }

    function setCommandPaletteActiveItem(overlay, nextItem) {
        const input = overlay?.querySelector('.cmd-input');
        const items = getCommandPaletteItems(overlay);

        items.forEach(item => {
            const isActive = item === nextItem;
            item.classList.toggle('active', isActive);
            item.setAttribute('aria-selected', String(isActive));
        });

        if (input) {
            if (nextItem?.id) {
                input.setAttribute('aria-activedescendant', nextItem.id);
            } else {
                input.removeAttribute('aria-activedescendant');
            }
        }
    }

    async function runButtonTask(button, task, options = {}) {
        const busyLabel = options.busyLabel || '';
        const isButton = button instanceof HTMLButtonElement;
        if (isButton && button.disabled) return null;

        const originalLabel = isButton ? button.textContent : '';
        const previousDisabled = isButton ? button.disabled : false;
        const previousAriaBusy = isButton ? button.getAttribute('aria-busy') : null;

        if (isButton) {
            button.disabled = true;
            button.setAttribute('aria-busy', 'true');
            if (busyLabel) button.textContent = busyLabel;
        }

        try {
            return await task();
        } finally {
            if (!isButton) return;
            button.disabled = previousDisabled;
            if (previousAriaBusy == null) {
                button.removeAttribute('aria-busy');
            } else {
                button.setAttribute('aria-busy', previousAriaBusy);
            }
            if (busyLabel) button.textContent = originalLabel;
        }
    }

    function updateBackupBrowserControls(visibleBackups = getVisibleBackups()) {
        elements.backupBrowserFilterButtons?.forEach(button => {
            const label = button.dataset.backupBrowserLabel || button.textContent.trim();
            button.dataset.backupBrowserLabel = label;
            const filter = button.dataset.backupBrowserFilter || 'all';
            const query = normalizeSettingsLabel(state.backupBrowserQuery);
            const count = state.backups.filter(backup => {
                if (!backupMatchesBrowserFilter(backup, filter)) return false;
                if (!query) return true;
                const haystack = normalizeSettingsLabel([
                    formatBackupReason(backup.reason),
                    backup.version || '',
                    describeBackupScope(backup),
                    backup.hasGlobalSettings ? 'settings' : '',
                    backup.hasFolders ? 'folders' : '',
                    backup.hasWorkspaces ? 'workspaces' : '',
                    backup.hasScriptStorage ? 'stored values' : '',
                    backup.timestamp ? dateTimeFormatter.format(new Date(backup.timestamp)) : ''
                ].join(' '));
                return haystack.includes(query);
            }).length;
            button.textContent = `${label} (${numberFormatter.format(count)})`;
        });
        syncPressedButtons(
            elements.backupBrowserFilterButtons,
            button => (button.dataset.backupBrowserFilter || 'all') === state.backupBrowserFilter
        );
        if (elements.backupBrowserSort) {
            elements.backupBrowserSort.value = state.backupBrowserSort || 'newest';
        }
        if (elements.btnResetBackupBrowser) {
            const hasActiveView = state.backupBrowserFilter !== 'all'
                || state.backupBrowserSort !== 'newest'
                || !!state.backupBrowserQuery.trim();
            elements.btnResetBackupBrowser.disabled = !hasActiveView;
        }
        if (!elements.backupBrowserStatus) return;
        const totalCount = Array.isArray(state.backups) ? state.backups.length : 0;
        const visibleCount = visibleBackups.length;
        const query = state.backupBrowserQuery.trim();
        const filterLabel = BACKUP_BROWSER_FILTER_LABELS[state.backupBrowserFilter] || 'all backups';
        const sortLabel = BACKUP_BROWSER_SORT_LABELS[state.backupBrowserSort] || 'newest first';
        const sortSuffix = state.backupBrowserSort === 'newest' ? '' : ` Sorted ${sortLabel}.`;
        if (totalCount === 0) {
            elements.backupBrowserStatus.textContent = 'No backups saved yet.';
            return;
        }
        if (query) {
            elements.backupBrowserStatus.textContent = `Showing ${numberFormatter.format(visibleCount)} of ${numberFormatter.format(totalCount)} backups for "${query}".${sortSuffix}`;
            return;
        }
        if (state.backupBrowserFilter === 'all') {
            elements.backupBrowserStatus.textContent = `Showing all ${numberFormatter.format(totalCount)} backups.${sortSuffix}`;
            return;
        }
        elements.backupBrowserStatus.textContent = `Showing ${numberFormatter.format(visibleCount)} ${filterLabel}.${sortSuffix}`;
    }

    function applyBackupBrowserFilters() {
        state.backupBrowserQuery = elements.backupBrowserQuickFilter?.value || '';
        state.backupBrowserSort = elements.backupBrowserSort?.value || state.backupBrowserSort || 'newest';
        const visibleBackups = getVisibleBackups();
        renderBackupList(visibleBackups, { totalCount: state.backups.length });
        updateBackupBrowserControls(visibleBackups);
    }

    function normalizeBackupSettings(rawSettings = {}) {
        return {
            enabled: !!rawSettings?.enabled,
            scheduleType: rawSettings?.scheduleType || 'manual',
            hour: Number.isFinite(Number(rawSettings?.hour)) ? Number(rawSettings.hour) : 3,
            dayOfWeek: Number.isFinite(Number(rawSettings?.dayOfWeek)) ? Number(rawSettings.dayOfWeek) : 0,
            maxBackups: Math.max(1, Number(rawSettings?.maxBackups || 5)),
            notifyOnSuccess: rawSettings?.notifyOnSuccess !== false,
            notifyOnFailure: rawSettings?.notifyOnFailure !== false,
            warnOnStorageFull: rawSettings?.warnOnStorageFull !== false
        };
    }

    function formatBackupScheduleSummary(settings = {}) {
        if (!settings.enabled) return 'Manual only';
        const hour = Math.max(0, Math.min(23, Number(settings.hour ?? 3)));
        const hourLabel = timeOnlyFormatter.format(new Date(2000, 0, 1, hour, 0));
        switch (settings.scheduleType) {
            case 'daily':
                return `Daily at ${hourLabel}`;
            case 'weekly':
                return `Weekly ${BACKUP_DAY_LABELS[Number(settings.dayOfWeek ?? 0)] || 'Sunday'} at ${hourLabel}`;
            case 'onChange':
                return 'After changes';
            case 'manual':
            default:
                return 'Manual only';
        }
    }

    function getNextBackupRun(settings = {}) {
        if (!settings.enabled) return null;
        const scheduleType = settings.scheduleType || 'manual';
        const hour = Math.max(0, Math.min(23, Number(settings.hour ?? 3)));
        if (scheduleType === 'daily' || scheduleType === 'weekly') {
            const now = new Date();
            const target = new Date(now);
            target.setHours(hour, 0, 0, 0);
            if (scheduleType === 'weekly') {
                const dayOfWeek = Math.max(0, Math.min(6, Number(settings.dayOfWeek ?? 0)));
                const currentDay = now.getDay();
                let daysUntil = (dayOfWeek - currentDay + 7) % 7;
                if (daysUntil === 0 && now >= target) daysUntil = 7;
                target.setDate(target.getDate() + daysUntil);
            } else if (now >= target) {
                target.setDate(target.getDate() + 1);
            }
            return target;
        }
        return null;
    }

    function getScriptIdentityKey(scriptLike) {
        if (!scriptLike || typeof scriptLike !== 'object') return '';
        const metadata = scriptLike.metadata || scriptLike.meta || scriptLike;
        const name = metadata?.name || '';
        const namespace = metadata?.namespace || '';
        if (name) {
            return namespace ? `${name}::${namespace}` : name;
        }
        return scriptLike.id || '';
    }

    function formatImportSummary(result) {
        const imported = Number(result?.imported || 0);
        const skipped = Number(result?.skipped || 0);
        const failed = Array.isArray(result?.errors) ? result.errors.length : 0;
        const parts = [];
        if (imported) parts.push(`${numberFormatter.format(imported)} imported`);
        if (skipped) parts.push(`${numberFormatter.format(skipped)} skipped`);
        if (failed) parts.push(`${numberFormatter.format(failed)} failed`);
        if (!parts.length) parts.push('no scripts changed');
        if (result?.settingsImported) parts.push('settings restored');
        return parts.join(', ');
    }

    function getImportResultTone(result) {
        if (result?.error) return 'error';
        const imported = Number(result?.imported || 0);
        const failed = Array.isArray(result?.errors) ? result.errors.length : 0;
        if (failed > 0 && imported === 0) return 'error';
        if (failed > 0) return 'warning';
        if (Number(result?.skipped || 0) > 0 && imported === 0) return 'info';
        return 'success';
    }

    function formatBackupRestoreSummary(result) {
        const restoredScripts = Number(result?.restoredScripts || 0);
        const skippedScripts = Number(result?.skippedScripts || 0);
        const failed = Array.isArray(result?.errors) ? result.errors.length : 0;
        const parts = [];
        if (restoredScripts) parts.push(`${numberFormatter.format(restoredScripts)} scripts restored`);
        if (skippedScripts) parts.push(`${numberFormatter.format(skippedScripts)} skipped`);
        if (result?.restoredSettings) parts.push('settings restored');
        if (result?.restoredFolders) parts.push('folders restored');
        if (result?.restoredWorkspaces) parts.push('workspaces restored');
        if (failed) parts.push(`${numberFormatter.format(failed)} issues`);
        if (!parts.length) parts.push('no changes applied');
        return parts.join(', ');
    }

    function getBackupRestoreTone(result) {
        if (result?.error) return 'error';
        const restored = Number(result?.restoredScripts || 0);
        const failed = Array.isArray(result?.errors) ? result.errors.length : 0;
        const restoredGlobal = !!(result?.restoredSettings || result?.restoredFolders || result?.restoredWorkspaces);
        if (failed > 0 && !restored && !restoredGlobal) return 'error';
        if (failed > 0) return 'warning';
        return restored || restoredGlobal ? 'success' : 'info';
    }

    function buildImportConfirmationMessage(sourceLabel, options = {}) {
        const {
            overwriteTarget = 'matching scripts',
            supportsSettings = false,
            supportsStorage = false,
            importSettings = false,
            importStorage = false,
            settingsUnavailableReason = '',
            storageUnavailableReason = ''
        } = options;
        const details = [`${overwriteTarget} will be overwritten.`];
        if (supportsStorage) {
            details.push(importStorage
                ? 'Stored values in the backup will also be restored when present.'
                : 'Stored values in the backup will be left untouched.');
        } else if (storageUnavailableReason) {
            details.push(storageUnavailableReason);
        }
        if (supportsSettings) {
            details.push(importSettings
                ? 'ScriptVault settings in the backup will also be restored when present.'
                : 'ScriptVault settings in the backup will not be restored.');
        } else if (settingsUnavailableReason) {
            details.push(settingsUnavailableReason);
        }
        return `Restore from ${sourceLabel}? ${details.join(' ')}`;
    }

    function downloadBase64Zip(zipData, filename) {
        const raw = atob(zipData);
        const bytes = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'application/zip' });
        const objUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objUrl;
        anchor.download = filename;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
    }

    function cacheElements() {
        // Main tabs
        elements.mainTabs = document.querySelectorAll('.tm-tabs .tm-tab');
        elements.dashboardTabs = document.querySelectorAll('.tm-tab[role="tab"]');
        elements.mainPanels = {
            scripts: document.getElementById('scriptsPanel'),
            settings: document.getElementById('settingsPanel'),
            utilities: document.getElementById('utilitiesPanel'),
            trash: document.getElementById('trashPanel'),
            help: document.getElementById('helpPanel'),
            store: document.getElementById('storePanel')
        };

        // Scripts tab
        elements.scriptSearch = document.getElementById('scriptSearch');
        elements.btnClearScriptSearch = document.getElementById('btnClearScriptSearch');
        elements.scriptTableBody = document.getElementById('scriptTableBody');
        elements.emptyState = document.getElementById('emptyState');
        elements.emptyStateTitle = document.getElementById('emptyStateTitle');
        elements.emptyStateDescription = document.getElementById('emptyStateDescription');
        elements.emptyStatePrimaryAction = document.getElementById('emptyStatePrimaryAction');
        elements.emptyStateSecondaryAction = document.getElementById('emptyStateSecondaryAction');
        elements.selectAllScripts = document.getElementById('selectAllScripts');
        elements.btnNewScript = document.getElementById('btnNewScript');
        elements.btnImportScript = document.getElementById('btnImportScript');
        elements.btnCheckUpdates = document.getElementById('btnCheckUpdates');
        elements.btnExportAll = document.getElementById('btnExportAll');
        elements.btnViewToggle = document.getElementById('btnViewToggle');
        elements.btnColumnToggle = document.getElementById('btnColumnToggle');
        elements.workspaceInstalledStat = document.getElementById('workspaceInstalledStat');
        elements.workspaceActiveStat = document.getElementById('workspaceActiveStat');
        elements.workspaceStorageStat = document.getElementById('workspaceStorageStat');
        
        // Bulk Actions (Tampermonkey-style)
        elements.bulkSelectAll = document.getElementById('bulkSelectAll');
        elements.bulkActionSelect = document.getElementById('bulkActionSelect');
        elements.btnBulkApply = document.getElementById('btnBulkApply');
        elements.filterSelect = document.getElementById('filterSelect');
        elements.scriptCounter = document.getElementById('scriptCounter');
        elements.scriptQuickFilters = document.getElementById('scriptQuickFilters');
        elements.scriptResultsSummary = document.getElementById('scriptResultsSummary');
        elements.btnClearScriptWorkspace = document.getElementById('btnClearScriptWorkspace');

        // Help button (header icon)
        elements.btnHelpTab = document.getElementById('btnHelpTab');
        elements.btnCycleTheme = document.getElementById('btnCycleTheme');
        elements.helpActionSummary = document.getElementById('helpActionSummary');
        elements.helpVisibleSummary = document.getElementById('helpVisibleSummary');
        elements.helpThemeSummary = document.getElementById('helpThemeSummary');
        elements.helpScriptSummary = document.getElementById('helpScriptSummary');
        elements.helpQuickFilter = document.getElementById('helpQuickFilter');
        elements.helpFilterStatus = document.getElementById('helpFilterStatus');
        elements.helpEmptyState = document.getElementById('helpEmptyState');
        elements.helpFilterButtons = document.querySelectorAll('[data-help-filter]');
        elements.helpActionButtons = document.querySelectorAll('[data-help-action]');

        // Editor overlay
        elements.editorOverlay = document.getElementById('editorOverlay');
        elements.editorEyebrow = document.getElementById('editorEyebrow');
        elements.editorTitle = document.getElementById('editorTitle');
        elements.editorSubtitle = document.getElementById('editorSubtitle');
        elements.editorSaveState = document.getElementById('editorSaveState');
        elements.editorSavedAt = document.getElementById('editorSavedAt');
        elements.editorLineCount = document.getElementById('editorLineCount');
        elements.editorCharCount = document.getElementById('editorCharCount');
        elements.editorCursorPos = document.getElementById('editorCursorPos');
        elements.editorTextarea = document.getElementById('editorTextarea');
        elements.editorTabs = document.querySelectorAll('.editor-tab');
        elements.editorPanels = {
            code: document.getElementById('codePanel'),
            info: document.getElementById('infoPanel'),
            storage: document.getElementById('storagePanel'),
            scriptsettings: document.getElementById('scriptsettingsPanel'),
            externals: document.getElementById('externalsPanel')
        };
        elements.btnEditorSave = document.getElementById('btnEditorSave');
        elements.btnEditorSaveLabel = document.getElementById('btnEditorSaveLabel');
        elements.btnEditorToggle = document.getElementById('btnEditorToggle');
        elements.btnEditorToggleLabel = document.getElementById('btnEditorToggleLabel');
        elements.btnEditorDuplicate = document.getElementById('btnEditorDuplicate');
        elements.btnEditorExport = document.getElementById('btnEditorExport');
        elements.btnEditorDelete = document.getElementById('btnEditorDelete');
        elements.btnEditorClose = document.getElementById('btnEditorClose');

        // Info panel
        elements.infoName = document.getElementById('infoName');
        elements.infoVersion = document.getElementById('infoVersion');
        elements.infoAuthor = document.getElementById('infoAuthor');
        elements.infoDescription = document.getElementById('infoDescription');
        elements.infoHomepage = document.getElementById('infoHomepage');
        elements.infoUpdateUrl = document.getElementById('infoUpdateUrl');
        elements.infoDownloadUrl = document.getElementById('infoDownloadUrl');
        elements.infoProvenance = document.getElementById('infoProvenance');
        elements.infoGrants = document.getElementById('infoGrants');
        elements.infoMatches = document.getElementById('infoMatches');
        elements.infoResources = document.getElementById('infoResources');
        elements.infoContributionURL = document.getElementById('infoContributionURL');
        elements.infoCompatible = document.getElementById('infoCompatible');
        elements.infoLicense = document.getElementById('infoLicense');

        // Storage panel
        elements.storageList = document.getElementById('storageList');
        elements.btnAddStorage = document.getElementById('btnAddStorage');
        elements.storageSizeInfo = document.getElementById('storageSizeInfo');

        // Editor toolbar
        elements.tbtnUndo = document.getElementById('tbtnUndo');
        elements.tbtnRedo = document.getElementById('tbtnRedo');
        elements.tbtnSearch = document.getElementById('tbtnSearch');
        elements.tbtnReplace = document.getElementById('tbtnReplace');
        elements.tbtnBeautify = document.getElementById('tbtnBeautify');
        elements.tbtnLint = document.getElementById('tbtnLint');
        elements.tbtnFoldAll = document.getElementById('tbtnFoldAll');
        elements.tbtnUnfoldAll = document.getElementById('tbtnUnfoldAll');
        elements.tbtnJumpLine = document.getElementById('tbtnJumpLine');

        // Externals panel
        elements.externalRequireList = document.getElementById('externalRequireList');
        elements.externalResourceList = document.getElementById('externalResourceList');
        elements.btnRefreshExternals = document.getElementById('btnRefreshExternals');

        // Per-script settings panel
        elements.scriptAutoUpdate = document.getElementById('scriptAutoUpdate');
        elements.scriptNotifyUpdates = document.getElementById('scriptNotifyUpdates');
        elements.scriptSyncLock = document.getElementById('scriptSyncLock');
        elements.scriptRunAt = document.getElementById('scriptRunAt');
        elements.scriptInjectInto = document.getElementById('scriptInjectInto');
        elements.scriptNotifyErrors = document.getElementById('scriptNotifyErrors');
        elements.btnSaveScriptSettings = document.getElementById('btnSaveScriptSettings');
        elements.btnResetScriptSettings = document.getElementById('btnResetScriptSettings');
        
        // URL Override controls
        elements.useOriginalIncludes = document.getElementById('useOriginalIncludes');
        elements.useOriginalMatches = document.getElementById('useOriginalMatches');
        elements.useOriginalExcludes = document.getElementById('useOriginalExcludes');
        elements.originalIncludesList = document.getElementById('originalIncludesList');
        elements.originalMatchesList = document.getElementById('originalMatchesList');
        elements.originalExcludesList = document.getElementById('originalExcludesList');
        elements.userIncludesList = document.getElementById('userIncludesList');
        elements.userMatchesList = document.getElementById('userMatchesList');
        elements.userExcludesList = document.getElementById('userExcludesList');
        elements.userIncludeInput = document.getElementById('userIncludeInput');
        elements.userMatchInput = document.getElementById('userMatchInput');
        elements.userExcludeInput = document.getElementById('userExcludeInput');
        elements.btnAddUserInclude = document.getElementById('btnAddUserInclude');
        elements.btnAddUserMatch = document.getElementById('btnAddUserMatch');
        elements.btnAddUserExclude = document.getElementById('btnAddUserExclude');

        // Settings - General
        elements.settingsConfigMode = document.getElementById('settingsConfigMode');
        elements.settingsLanguage = document.getElementById('settingsLanguage');
        elements.settingsAutoReload = document.getElementById('settingsAutoReload');
        elements.settingsAnonymousStats = document.getElementById('settingsAnonymousStats');
        elements.settingsDebugMode = document.getElementById('settingsDebugMode');
        elements.settingsShowFixedSource = document.getElementById('settingsShowFixedSource');
        elements.settingsLoggingLevel = document.getElementById('settingsLoggingLevel');
        elements.settingsTrashMode = document.getElementById('settingsTrashMode');
        elements.trashList = document.getElementById('trashList');
        elements.btnEmptyTrash = document.getElementById('btnEmptyTrash');
        elements.trashCountSummary = document.getElementById('trashCountSummary');
        elements.trashRetentionSummary = document.getElementById('trashRetentionSummary');
        elements.trashLatestSummary = document.getElementById('trashLatestSummary');
        elements.trashQuickFilter = document.getElementById('trashQuickFilter');
        elements.trashFilterStatus = document.getElementById('trashFilterStatus');
        elements.trashEmptyState = document.getElementById('trashEmptyState');
        elements.trashEmptyTitle = document.getElementById('trashEmptyTitle');
        elements.trashEmptyDescription = document.getElementById('trashEmptyDescription');
        elements.trashFilterButtons = document.querySelectorAll('[data-trash-filter]');

        // Settings - Appearance
        elements.settingsLayout = document.getElementById('settingsLayout');
        elements.settingsCustomCss = document.getElementById('settingsCustomCss');
        elements.settingsUpdateNotify = document.getElementById('settingsUpdateNotify');
        elements.settingsFaviconService = document.getElementById('settingsFaviconService');
        elements.btnSaveAppearance = document.getElementById('btnSaveAppearance');
        
        // Settings - Tags
        elements.settingsEnableTags = document.getElementById('settingsEnableTags');
        
        // Settings - Action Menu
        elements.settingsHideDisabledPopup = document.getElementById('settingsHideDisabledPopup');
        elements.settingsPopupColumns = document.getElementById('settingsPopupColumns');
        elements.settingsScriptOrder = document.getElementById('settingsScriptOrder');
        elements.settingsBadgeInfo = document.getElementById('settingsBadgeInfo');
        elements.settingsBadgeColor = document.getElementById('settingsBadgeColor');
        elements.badgeColorPreview = document.getElementById('badgeColorPreview');
        elements.btnSaveActionMenu = document.getElementById('btnSaveActionMenu');
        
        // Settings - Context Menu
        elements.settingsEnableContextMenu = document.getElementById('settingsEnableContextMenu');
        elements.settingsContextMenuRunAt = document.getElementById('settingsContextMenuRunAt');
        elements.settingsContextMenuCommands = document.getElementById('settingsContextMenuCommands');
        
        // Settings - Userscript Search
        elements.settingsSearchIntegration = document.getElementById('settingsSearchIntegration');
        
        // Settings - Userscript Update
        elements.settingsUpdateDisabled = document.getElementById('settingsUpdateDisabled');
        elements.settingsSilentUpdate = document.getElementById('settingsSilentUpdate');
        elements.settingsCheckInterval = document.getElementById('settingsCheckInterval');
        elements.settingsNotifyHideAfter = document.getElementById('settingsNotifyHideAfter');
        
        // Settings - Externals
        elements.settingsExternalsInterval = document.getElementById('settingsExternalsInterval');
        
        // Settings - Userscript Sync
        elements.settingsEnableSync = document.getElementById('settingsEnableSync');
        elements.settingsSyncType = document.getElementById('settingsSyncType');
        elements.lastSyncTime = document.getElementById('lastSyncTime');
        elements.syncWebdavSettings = document.getElementById('syncWebdavSettings');
        elements.syncOAuthSettings = document.getElementById('syncOAuthSettings');
        elements.oauthStatus = document.getElementById('oauthStatus');
        elements.oauthUser = document.getElementById('oauthUser');
        elements.oauthUserRow = document.getElementById('oauthUserRow');
        elements.btnConnectOAuth = document.getElementById('btnConnectOAuth');
        elements.btnDisconnectOAuth = document.getElementById('btnDisconnectOAuth');
        elements.settingsWebdavUrl = document.getElementById('settingsWebdavUrl');
        elements.settingsWebdavUsername = document.getElementById('settingsWebdavUsername');
        elements.settingsWebdavPassword = document.getElementById('settingsWebdavPassword');
        elements.btnSyncNow = document.getElementById('btnSyncNow');
        elements.btnSyncReset = document.getElementById('btnSyncReset');
        elements.syncLog = document.getElementById('syncLog');
        elements.btnSaveSync = document.getElementById('btnSaveSync');
        
        // Settings - Editor
        elements.settingsEnableEditor = document.getElementById('settingsEnableEditor');
        elements.settingsEditorTheme = document.getElementById('settingsEditorTheme');
        elements.settingsEditorFontSize = document.getElementById('settingsEditorFontSize');
        elements.settingsKeyMapping = document.getElementById('settingsKeyMapping');
        elements.settingsIndentWidth = document.getElementById('settingsIndentWidth');
        elements.settingsTabSize = document.getElementById('settingsTabSize');
        elements.settingsIndentWith = document.getElementById('settingsIndentWith');
        elements.settingsTabMode = document.getElementById('settingsTabMode');
        elements.settingsHighlightMatches = document.getElementById('settingsHighlightMatches');
        elements.settingsWordWrap = document.getElementById('settingsWordWrap');
        elements.settingsReindent = document.getElementById('settingsReindent');
        elements.settingsAutoSave = document.getElementById('settingsAutoSave');
        elements.settingsNoSaveConfirm = document.getElementById('settingsNoSaveConfirm');
        elements.settingsHighlightTrailingWhitespace = document.getElementById('settingsHighlightTrailingWhitespace');
        elements.settingsTrimWhitespace = document.getElementById('settingsTrimWhitespace');
        elements.settingsLintOnType = document.getElementById('settingsLintOnType');
        elements.settingsLintMaxSize = document.getElementById('settingsLintMaxSize');
        elements.settingsLinterConfig = document.getElementById('settingsLinterConfig');
        elements.btnSaveEditor = document.getElementById('btnSaveEditor');
        
        // Settings - Security
        elements.settingsContentScriptAPI = document.getElementById('settingsContentScriptAPI');
        elements.settingsSandboxMode = document.getElementById('settingsSandboxMode');
        elements.settingsModifyCSP = document.getElementById('settingsModifyCSP');
        elements.settingsAllowHttpHeaders = document.getElementById('settingsAllowHttpHeaders');
        elements.settingsDefaultTabTypes = document.getElementById('settingsDefaultTabTypes');
        elements.settingsAllowLocalFiles = document.getElementById('settingsAllowLocalFiles');
        elements.settingsAllowCookies = document.getElementById('settingsAllowCookies');
        elements.settingsAllowCommunication = document.getElementById('settingsAllowCommunication');
        elements.settingsSRI = document.getElementById('settingsSRI');
        elements.settingsIncludeMode = document.getElementById('settingsIncludeMode');
        elements.settingsCheckConnect = document.getElementById('settingsCheckConnect');
        elements.settingsIncognitoStorage = document.getElementById('settingsIncognitoStorage');
        elements.settingsPageFilterMode = document.getElementById('settingsPageFilterMode');
        elements.settingsWhitelistedPages = document.getElementById('settingsWhitelistedPages');
        elements.settingsBlacklistedPages = document.getElementById('settingsBlacklistedPages');
        elements.btnSaveSecurity = document.getElementById('btnSaveSecurity');
        
        // Settings - Runtime Host Permissions
        elements.settingsDeniedHosts = document.getElementById('settingsDeniedHosts');
        elements.btnGrantSelected = document.getElementById('btnGrantSelected');
        elements.btnGrantAll = document.getElementById('btnGrantAll');
        elements.btnResetPermissions = document.getElementById('btnResetPermissions');
        
        // Settings - BlackCheck
        elements.settingsBlacklistSource = document.getElementById('settingsBlacklistSource');
        elements.settingsBlockSeverity = document.getElementById('settingsBlockSeverity');
        elements.settingsManualBlacklist = document.getElementById('settingsManualBlacklist');
        elements.btnSaveBlackCheck = document.getElementById('btnSaveBlackCheck');
        
        // Settings - Downloads
        elements.settingsDownloadMode = document.getElementById('settingsDownloadMode');
        elements.settingsDownloadWhitelist = document.getElementById('settingsDownloadWhitelist');
        elements.btnSaveDownloads = document.getElementById('btnSaveDownloads');
        
        // Settings - Experimental
        elements.settingsStrictMode = document.getElementById('settingsStrictMode');
        elements.settingsTopLevelAwait = document.getElementById('settingsTopLevelAwait');
        
        // Settings - Reset
        elements.settingsQuickFilter = document.getElementById('settingsQuickFilter');
        elements.settingsModeSummary = document.getElementById('settingsModeSummary');
        elements.settingsVisibleSummary = document.getElementById('settingsVisibleSummary');
        elements.settingsAdvancedSummary = document.getElementById('settingsAdvancedSummary');
        elements.settingsFilterStatus = document.getElementById('settingsFilterStatus');
        elements.settingsEmptyState = document.getElementById('settingsEmptyState');
        elements.settingsFilterButtons = document.querySelectorAll('#settingsCategoryFilters .settings-filter');
        elements.btnRestartExtension = document.getElementById('btnRestartExtension');
        elements.btnFactoryReset = document.getElementById('btnFactoryReset');

        // Utilities
        elements.btnExportFile = document.getElementById('btnExportFile');
        elements.btnExportZip = document.getElementById('btnExportZip');
        elements.exportIncludeStorage = document.getElementById('exportIncludeStorage');
        elements.exportIncludeSettings = document.getElementById('exportIncludeSettings');
        elements.backupBrowserSummary = document.getElementById('backupBrowserSummary');
        elements.backupBrowserQuickFilter = document.getElementById('backupBrowserQuickFilter');
        elements.backupBrowserSort = document.getElementById('backupBrowserSort');
        elements.backupBrowserStatus = document.getElementById('backupBrowserStatus');
        elements.backupBrowserFilterButtons = Array.from(document.querySelectorAll('[data-backup-browser-filter]'));
        elements.btnResetBackupBrowser = document.getElementById('btnResetBackupBrowser');
        elements.backupList = document.getElementById('backupList');
        elements.backupScheduleSummary = document.getElementById('backupScheduleSummary');
        elements.backupScheduleStatus = document.getElementById('backupScheduleStatus');
        elements.backupNextRunStatus = document.getElementById('backupNextRunStatus');
        elements.backupEnabled = document.getElementById('backupEnabled');
        elements.backupScheduleType = document.getElementById('backupScheduleType');
        elements.backupHourRow = document.getElementById('backupHourRow');
        elements.backupHour = document.getElementById('backupHour');
        elements.backupDayRow = document.getElementById('backupDayRow');
        elements.backupDayOfWeek = document.getElementById('backupDayOfWeek');
        elements.backupMaxBackups = document.getElementById('backupMaxBackups');
        elements.backupNotifyOnSuccess = document.getElementById('backupNotifyOnSuccess');
        elements.backupNotifyOnFailure = document.getElementById('backupNotifyOnFailure');
        elements.backupWarnOnStorageFull = document.getElementById('backupWarnOnStorageFull');
        elements.btnSaveBackupSettings = document.getElementById('btnSaveBackupSettings');
        elements.btnCreateBackup = document.getElementById('btnCreateBackup');
        elements.btnImportBackupArchive = document.getElementById('btnImportBackupArchive');
        elements.btnRefreshBackups = document.getElementById('btnRefreshBackups');
        elements.backupArchiveInput = document.getElementById('backupArchiveInput');
        elements.btnChooseFile = document.getElementById('btnChooseFile');
        elements.importFileInput = document.getElementById('importFileInput');
        elements.importFileName = document.getElementById('importFileName');
        elements.importUrlInput = document.getElementById('importUrlInput');
        elements.btnInstallFromUrl = document.getElementById('btnInstallFromUrl');
        elements.textareaData = document.getElementById('textareaData');
        elements.btnTextareaExport = document.getElementById('btnTextareaExport');
        elements.btnTextareaImport = document.getElementById('btnTextareaImport');
        elements.cloudProvider = document.getElementById('cloudProvider');
        elements.cloudStatusText = document.getElementById('cloudStatusText');
        elements.cloudUserInfo = document.getElementById('cloudUserInfo');
        elements.btnCloudConnect = document.getElementById('btnCloudConnect');
        elements.btnCloudDisconnect = document.getElementById('btnCloudDisconnect');
        elements.btnCloudExport = document.getElementById('btnCloudExport');
        elements.btnCloudImport = document.getElementById('btnCloudImport');
        elements.cloudActionsRow = document.getElementById('cloudActionsRow');
        elements.utilitiesQuickFilter = document.getElementById('utilitiesQuickFilter');
        elements.utilitiesVisibleSummary = document.getElementById('utilitiesVisibleSummary');
        elements.utilitiesCloudSummary = document.getElementById('utilitiesCloudSummary');
        elements.utilitiesImportSummary = document.getElementById('utilitiesImportSummary');
        elements.utilitiesWorkspaceSummary = document.getElementById('utilitiesWorkspaceSummary');
        elements.utilitiesFilterStatus = document.getElementById('utilitiesFilterStatus');
        elements.utilitiesEmptyState = document.getElementById('utilitiesEmptyState');
        elements.utilitiesFilterButtons = document.querySelectorAll('#utilitiesCategoryFilters .utilities-filter');
        elements.workspaceList = document.getElementById('workspaceList');
        elements.networkLogContainer = document.getElementById('networkLogContainer');
        elements.activityLog = document.getElementById('activityLog');
        elements.perfBudgetDefault = document.getElementById('perfBudgetDefault');
        elements.batchUrlInput = document.getElementById('batchUrlInput');
        elements.runtimeStatusSummary = document.getElementById('runtimeStatusSummary');
        elements.runtimeStatusDetails = document.getElementById('runtimeStatusDetails');
        elements.supportSnapshotSummary = document.getElementById('supportSnapshotSummary');
        elements.supportSnapshotStatus = document.getElementById('supportSnapshotStatus');
        elements.publicApiTrustedOrigins = document.getElementById('publicApiTrustedOrigins');
        elements.publicApiPermissionsSummary = document.getElementById('publicApiPermissionsSummary');
        elements.publicApiTrustStatus = document.getElementById('publicApiTrustStatus');
        elements.publicApiAuditLog = document.getElementById('publicApiAuditLog');
        elements.signingTrustSummary = document.getElementById('signingTrustSummary');
        elements.signingKeysList = document.getElementById('signingKeysList');
        elements.btnRefreshRuntimeStatus = document.getElementById('btnRefreshRuntimeStatus');
        elements.btnRepairRuntime = document.getElementById('btnRepairRuntime');
        elements.btnShowSetupGuide = document.getElementById('btnShowSetupGuide');
        elements.btnExportSupportSnapshot = document.getElementById('btnExportSupportSnapshot');
        elements.btnRefreshPublicApiTrust = document.getElementById('btnRefreshPublicApiTrust');
        elements.btnSavePublicApiOrigins = document.getElementById('btnSavePublicApiOrigins');
        elements.btnClearPublicApiAudit = document.getElementById('btnClearPublicApiAudit');
        elements.btnRefreshSigningTrust = document.getElementById('btnRefreshSigningTrust');

        // Stats
        elements.statTotalScripts = document.getElementById('statTotalScripts');
        elements.statActiveScripts = document.getElementById('statActiveScripts');
        elements.statTotalStorage = document.getElementById('statTotalStorage');

        // Modal
        elements.modal = document.getElementById('modal');
        elements.modalTitle = document.getElementById('modalTitle');
        elements.modalBody = document.getElementById('modalBody');
        elements.modalActions = document.getElementById('modalActions');
        elements.modalClose = document.querySelector('.modal-close');

        // Find Scripts
        elements.btnFindScripts = document.getElementById('btnFindScripts');
        elements.findScriptsOverlay = document.getElementById('findScriptsOverlay');
        elements.findScriptsInput = document.getElementById('findScriptsInput');
        elements.findScriptsSource = document.getElementById('findScriptsSource');
        elements.btnFindScriptsSearch = document.getElementById('btnFindScriptsSearch');
        elements.btnCloseFindScripts = document.getElementById('btnCloseFindScripts');
        elements.findScriptsResults = document.getElementById('findScriptsResults');

        // Toast
        elements.toastContainer = document.getElementById('toastContainer');
    }

    // Measure and set header height for editor overlay positioning
    // ── View Settings: Zoom + Density ─────────────────────────────────────────
    function initViewSettings() {
        const root = document.documentElement;
        const zoomSelect = document.getElementById('uiScaleSelect');
        const densityBtns = document.querySelectorAll('.density-btn[data-density]');

        // Restore from localStorage
        const savedZoom = localStorage.getItem('sv_ui_scale');
        const savedDensity = localStorage.getItem('sv_density');

        if (savedZoom) {
            root.setAttribute('data-ui-scale', savedZoom);
            root.style.fontSize = `var(--base-font, 13px)`;
            if (zoomSelect) zoomSelect.value = savedZoom;
        }
        if (savedDensity) {
            root.setAttribute('data-density', savedDensity);
            densityBtns.forEach(btn => {
                const active = btn.dataset.density === savedDensity;
                btn.classList.toggle('active', active);
                btn.setAttribute('aria-pressed', String(active));
            });
        }

        // Zoom select handler
        if (zoomSelect) {
            zoomSelect.addEventListener('change', () => {
                const scale = zoomSelect.value;
                root.setAttribute('data-ui-scale', scale);
                localStorage.setItem('sv_ui_scale', scale);
                // Update header height since font change affects layout
                updateHeaderHeight();
            });
        }

        // Density button handlers
        densityBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const density = btn.dataset.density;
                root.setAttribute('data-density', density);
                localStorage.setItem('sv_density', density);
                densityBtns.forEach(b => {
                    const active = b.dataset.density === density;
                    b.classList.toggle('active', active);
                    b.setAttribute('aria-pressed', String(active));
                });
                // Update header height since padding changes affect layout
                updateHeaderHeight();
            });
        });
    }

    function updateHeaderHeight() {
        const root = document.documentElement;
        const header = document.querySelector('.tm-header');
        if (!header) return;
        const headerH = header.offsetHeight;
        root.style.setProperty('--header-height', headerH + 'px');
        // Stack the scripts toolbar + results bar under the sticky header so the
        // table thead can dock right below all of them.
        const toolbar = document.querySelector('.scripts-toolbar');
        const toolbarH = toolbar ? toolbar.offsetHeight : 0;
        const toolbarBottom = headerH + toolbarH;
        root.style.setProperty('--toolbar-bottom', toolbarBottom + 'px');
        const resultsBar = document.querySelector('.scripts-results-bar');
        const resultsH = resultsBar ? resultsBar.offsetHeight : 0;
        root.style.setProperty('--results-bar-bottom', (toolbarBottom + resultsH) + 'px');
    }

    // Initialize
    async function init() {
        // Set dynamic version from manifest
        const extVersion = 'v' + chrome.runtime.getManifest().version;
        const headerVer = document.getElementById('headerVersion');
        const aboutVer = document.getElementById('aboutVersion');
        if (headerVer) headerVer.textContent = extVersion;
        if (aboutVer) aboutVer.textContent = 'Version ' + chrome.runtime.getManifest().version;

        cacheElements();
        initViewSettings();
        initializeSettingsPanelControls();
        initializeUtilitiesPanelControls();
        initializeHelpPanelControls();
        initializeTrashPanelControls();
        updateHeaderHeight();
        window.addEventListener('resize', updateHeaderHeight);

        // Event delegation for favicon error handling (CSP-compliant)
        // Handles images with data-favicon-fallback attribute
        document.addEventListener('error', function(e) {
            if (e.target.tagName === 'IMG' && e.target.hasAttribute('data-favicon-fallback')) {
                e.target.style.display = 'none';
                if (e.target.parentElement) {
                    const parent = e.target.parentElement;
                    const label = parent.dataset.fallbackLabel || '';
                    const hue = parent.dataset.fallbackHue || '';
                    const mode = parent.dataset.fallbackMode || 'google';
                    parent.classList.add('marker-badge');
                    if (mode === 'duckduckgo') parent.classList.add('compact');
                    if (mode === 'none') parent.classList.add('minimal');
                    if (hue) parent.style.setProperty('--marker-hue', hue);
                    parent.textContent = mode === 'none' ? '' : label;
                }
            }
        }, true); // Use capture phase to catch errors before they propagate
        
        restoreScriptViewModeFromQuery();
        await loadSettings();
        await loadFolders();
        await loadScripts();
        restoreScriptWorkspaceStateFromQuery();
        try { initEditor(); } catch (e) { console.error('[ScriptVault] Editor init failed:', e); }
        initEventListeners();
        updateSortIndicators();
        renderScriptTable();
        applyTheme();
        updateStats();
        toggleSyncProviderSettings();
        loadSyncProviderStatus();
        loadWorkspaces();
        loadBackups();
        loadBackupSettings();
        await checkUserScriptsAvailability();

        // v2.0 Module Initialization
        initV2Modules();
        // Lazy-init the scripts tab (default active tab) so CardView etc. are available
        lazyInitTab('scripts');

        const route = getDashboardRoute();
        if (route.type === 'new') {
            createNewScript();
        } else if (route.type === 'script' && route.scriptId) {
            openEditorForScript(route.scriptId, { updateRoute: false });
        } else if (route.type === 'tab' && route.tab && route.tab !== 'scripts') {
            await switchTab(route.tab, { updateRoute: false });
        }
    }

    // Safe module initializer with error boundary
    // Container ID mapping for multi-word module names
    const _containerIds = {
        'Store': 'storeContainer',
        'CardView': 'cardViewContainer', 'PatternBuilder': 'patternBuilderContainer',
        'ThemeEditor': 'themeEditorContainer', 'DepGraph': 'depGraphContainer',
    };
    function safeInit(name, fn) {
        try { fn(); } catch (e) {
            console.error(`[ScriptVault] Module ${name} init failed:`, e);
            const containerId = _containerIds[name] || (name.toLowerCase() + 'Container');
            const container = document.getElementById(containerId);
            if (container) {
                container.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-muted)">
                    <div style="font-size:16px;margin-bottom:4px">Module Error</div>
                    <div style="font-size:12px">${name} failed to load: ${escapeHtml(e.message)}</div>
                </div>`;
            }
        }
    }

    // Initialize all v2.0 modules with individual error boundaries
    // Uses LazyLoader to defer non-critical modules until needed
    function initV2Modules() {
        // Only init modules that are eagerly loaded (a11y, keyboard, firefox-compat, i18n)
        // Eagerly loaded modules
        safeInit('Keyboard', () => { if (typeof KeyboardNav !== 'undefined') KeyboardNav.init(); });
        safeInit('A11y', () => { if (typeof A11y !== 'undefined') A11y.init(); });
        safeInit('FirefoxCompat', () => { if (typeof FirefoxCompat !== 'undefined') FirefoxCompat.polyfill(); });

        // What's New modal — shows once per version
        safeInit('WhatsNew', () => {
            if (typeof LazyLoader !== 'undefined') {
                LazyLoader.loadOnDemand('whatsnew').then(() => {
                    if (typeof WhatsNew !== 'undefined') WhatsNew.shouldShow().then(show => { if (show) WhatsNew.show(); });
                }).catch(e => {
                    console.warn('[ScriptVault] Failed to load whatsnew module:', e?.message || e);
                });
            }
        });

        // CWS Review Prompt
        safeInit('ReviewPrompt', initReviewPrompt);

        console.log('[ScriptVault] v2.0 modules initialized');
    }

    // ── Lazy Tab Init Helpers ──────────────────────────────────────────────
    // These are called by switchTab when the user first visits a tab.
    // Each checks _initialized to prevent double init.
    const _tabInited = new Set();

    async function lazyInitTab(tabName) {
        if (_tabInited.has(tabName)) return;
        if (typeof LazyLoader === 'undefined') return;

        // Mark as inited BEFORE the await to prevent duplicate concurrent inits
        _tabInited.add(tabName);

        try {
            await LazyLoader.loadForTab(tabName);
        } catch (e) {
            console.error(`[ScriptVault] Failed to init tab ${tabName}:`, e);
            const failedModules = Array.isArray(e?.sources) && e.sources.length > 0
                ? `Missing module${e.sources.length === 1 ? '' : 's'}: ${e.sources.join(', ')}`
                : 'Some tools may be unavailable until the tab reloads.';
            showToast(`Some ${tabName} tools failed to load`, 'error');
            logActivity(`${tabName} tab load issue: ${failedModules}`, 'error');
        }

        switch (tabName) {
            case 'store':
                if (typeof ScriptStore !== 'undefined') {
                    safeInit('Store', () => {
                        ScriptStore.init(document.getElementById('storeContainer'), {
                            getInstalledScripts: async () => {
                                const res = await chrome.runtime.sendMessage({ action: 'getScripts' });
                                return res?.scripts || Object.values(res || {});
                            },
                            onInstalled: async () => {
                                await loadScripts();
                            }
                        });
                    });
                } else {
                    const c = document.getElementById('storeContainer');
                    if (c) c.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted)"><div style="font-size:16px;margin-bottom:8px">Script Store failed to load</div><div style="font-size:12px">Check the browser console for errors. The module file may be missing.</div></div>';
                }
                break;
            case 'settings':
                // Theme editor loads with settings tab
                await LazyLoader.loadOnDemand('scheduler').catch(e => {
                    console.error('[ScriptVault] Failed to load scheduler module:', e);
                    showToast('Scheduling tools are unavailable right now', 'error');
                });
                break;
            case 'utilities':
                // Collections, standalone, depgraph load with utilities tab
                // (LazyLoader.loadForTab already called at line 438 above)
                break;
            case 'scripts':
                // Card view, linter, recommendations load with scripts tab
                // (LazyLoader.loadForTab already called at line 438 above)
                safeInit('CardView', () => {
                    if (typeof CardView !== 'undefined') {
                        const cardContainer = document.createElement('div');
                        cardContainer.id = 'cardViewContainer';
                        cardContainer.style.display = 'none';
                        const tableContainer = document.querySelector('.scripts-table-container');
                        if (tableContainer) tableContainer.parentNode.insertBefore(cardContainer, tableContainer.nextSibling);
                        CardView.init(cardContainer, {
                            tableContainer,
                            toggleButton: elements.btnViewToggle,
                            hasScripts: () => state.scripts.length > 0,
                            isSelected: id => state.selectedScripts.has(id),
                            onSelect: (id, selected) => {
                                if (selected) state.selectedScripts.add(id);
                                else state.selectedScripts.delete(id);
                                if (!selected && state._lastCheckedId === id) {
                                    state._lastCheckedId = null;
                                }
                                updateBulkCheckboxes();
                            },
                            onEdit: (id) => openEditorForScript(id),
                            onToggle: (id, enabled, options = {}) => toggleScriptEnabled(id, enabled, options),
                            onUpdate: (id, options = {}) => checkScriptForUpdates(id, { ...options }),
                            onExport: async (id, options = {}) => {
                                const exportTask = () => {
                                    const script = state.scripts.find(s => s.id === id);
                                    if (script) exportSingleScript(script);
                                };
                                if (options.triggerEl instanceof HTMLButtonElement) {
                                    await runButtonTask(options.triggerEl, exportTask, { busyLabel: 'Exporting…' });
                                    return;
                                }
                                exportTask();
                            },
                            onDelete: async (id, options = {}) => {
                                const deleteTask = async () => {
                                    const script = state.scripts.find(s => s.id === id);
                                    const name = script?.metadata?.name || id;
                                    if (await showConfirmModal(`Delete "${name}"?`, 'This action cannot be undone.')) {
                                        await deleteScript(id);
                                    }
                                };
                                if (options.triggerEl instanceof HTMLButtonElement) {
                                    await runButtonTask(options.triggerEl, deleteTask, { busyLabel: 'Deleting…' });
                                    return;
                                }
                                await deleteTask();
                            }
                        });
                        syncCardView(getFilteredScripts());
                    }
                });
                break;
        }
    }

    // On-demand module loader — call from UI handlers when a specific feature is triggered
    function initOnDemandModule(key, initFn) {
        if (typeof LazyLoader !== 'undefined') {
            return LazyLoader.loadOnDemand(key)
                .then(() => { safeInit(key, initFn); return true; })
                .catch(e => {
                    console.error(`[ScriptVault] Failed to load ${key} module:`, e);
                    showToast(`Failed to load ${key} tools`, 'error');
                    return false;
                });
        }
        return Promise.resolve(false);
    }

    // CWS Review Prompt - non-intrusive after 7 days of use
    function initReviewPrompt() {
        chrome.storage.local.get(['installDate', 'reviewDismissed', 'reviewCompleted'], (data) => {
            if (data.reviewCompleted || data.reviewDismissed) return;
            if (!data.installDate) {
                chrome.storage.local.set({ installDate: Date.now() });
                return;
            }
            const daysSinceInstall = (Date.now() - data.installDate) / (1000 * 60 * 60 * 24);
            if (daysSinceInstall < 7) return;
            // Only show if user has 3+ scripts (active user)
            if (state.scripts.length < 3) return;

            setTimeout(() => {
                const banner = document.createElement('div');
                banner.className = 'review-prompt';
                banner.innerHTML = `
                    <div style="display:flex;align-items:center;gap:12px;padding:12px 20px;background:linear-gradient(135deg,rgba(34,197,94,0.1),rgba(96,165,250,0.1));border:1px solid rgba(34,197,94,0.2);border-radius:8px;margin:8px 12px">
                        <div style="flex:1">
                            <div style="font-weight:600;color:var(--text-primary);margin-bottom:2px">Enjoying ScriptVault?</div>
                            <div style="font-size:12px;color:var(--text-secondary)">A review on the Chrome Web Store helps others discover us!</div>
                        </div>
                        <button id="btnReviewYes" class="toolbar-btn primary" style="white-space:nowrap">Leave a Review</button>
                        <button id="btnReviewLater" class="toolbar-btn" style="white-space:nowrap">Maybe Later</button>
                        <button id="btnReviewDismiss" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:18px;padding:4px">&times;</button>
                    </div>
                `;
                const panel = document.getElementById('scriptsPanel');
                if (panel) panel.insertBefore(banner, panel.firstChild);

                document.getElementById('btnReviewYes')?.addEventListener('click', () => {
                    chrome.tabs.create({ url: 'https://chromewebstore.google.com/detail/scriptvault/jlhdbkeijcbgnonpfkfkkkhfmbeejkgh/reviews' });
                    chrome.storage.local.set({ reviewCompleted: true });
                    banner.remove();
                });
                document.getElementById('btnReviewLater')?.addEventListener('click', () => {
                    chrome.storage.local.set({ reviewDismissed: true });
                    banner.remove();
                });
                document.getElementById('btnReviewDismiss')?.addEventListener('click', () => {
                    chrome.storage.local.set({ reviewDismissed: true });
                    banner.remove();
                });
            }, 3000); // Show after 3s delay to not interrupt initial load
        });
    }
    
    // Check if userScripts API is available and enabled
    async function checkUserScriptsAvailability() {
        const banner = document.getElementById('setupWarningBanner');
        const btnHelp = document.getElementById('btnSetupHelp');
        const btnDismiss = document.getElementById('btnDismissWarning');
        
        if (!banner) return;
        
        try {
            if (!chrome.userScripts) {
                banner.style.display = 'block';
                return;
            }
            
            // Try to use the API to see if it's enabled
            await chrome.userScripts.getScripts();
            banner.style.display = 'none';
        } catch (error) {
            console.warn('userScripts API not available:', error.message);
            banner.style.display = 'block';
        }
        
        // Setup help button
        btnHelp?.addEventListener('click', () => {
            showSetupInstructions();
        });
        
        // Dismiss button
        btnDismiss?.addEventListener('click', () => {
            banner.style.display = 'none';
        });
    }
    
    function showSetupInstructions() {
        const chromeVersion = parseInt(navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] || 0);
        
        let instructions = '';
        if (chromeVersion >= 138) {
            instructions = `
                <h3 style="margin-bottom: 15px; color: var(--text-primary);">Enable User Scripts (Chrome 138+)</h3>
                <ol style="line-height: 1.8; color: var(--text-secondary); padding-left: 20px;">
                    <li>Right-click the ScriptVault extension icon in your toolbar</li>
                    <li>Select <strong>"Manage Extension"</strong></li>
                    <li>Find and enable the <strong>"Allow User Scripts"</strong> toggle</li>
                    <li>Reload any open pages for scripts to take effect</li>
                </ol>
                <p style="margin-top: 15px; padding: 10px; background: var(--bg-input); border-radius: 4px; font-size: 12px;">
                    <strong>Note:</strong> This toggle was introduced in Chrome 138 as an additional security measure for extensions that inject user scripts.
                </p>
            `;
        } else {
            instructions = `
                <h3 style="margin-bottom: 15px; color: var(--text-primary);">Enable Developer Mode</h3>
                <ol style="line-height: 1.8; color: var(--text-secondary); padding-left: 20px;">
                    <li>Open Chrome and go to <strong>chrome://extensions</strong></li>
                    <li>Enable <strong>"Developer mode"</strong> toggle in the top-right corner</li>
                    <li>Reload any open pages for scripts to take effect</li>
                </ol>
            `;
        }
        
        instructions += `
            <div style="margin-top: 20px; display: flex; gap: 10px;">
                <button class="btn btn-primary" id="btnOpenExtSettings">
                    Open Extension Settings
                </button>
            </div>
        `;
        
        showModal('Setup Instructions', instructions, [
            { label: 'Close', callback: () => { hideModal(); } }
        ]);
        
        // Add event listener after modal is shown (CSP-safe)
        document.getElementById('btnOpenExtSettings')?.addEventListener('click', () => {
            chrome.tabs.create({url: 'chrome://extensions/?id=' + chrome.runtime.id});
        });
    }

    // Settings
    async function loadSettings() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
            if (response?.settings) {
                state.settings = { ...response.settings };
                state.settings.syncEnabled = normalizeSyncEnabled(state.settings);
                state.settings.syncProvider = normalizeSyncProvider(state.settings);
                applySettingsToUI();
            }
        } catch (e) {
            console.error('Failed to load settings:', e);
        }
    }

    function applySettingsToUI() {
        const s = state.settings;
        
        // General settings
        if (elements.settingsConfigMode) elements.settingsConfigMode.value = s.configMode || 'advanced';
        if (elements.settingsLanguage) elements.settingsLanguage.value = s.language || 'default';
        if (elements.settingsAutoReload) elements.settingsAutoReload.checked = s.autoReload !== false;
        if (elements.settingsAnonymousStats) elements.settingsAnonymousStats.checked = s.anonymousStats || false;
        if (elements.settingsDebugMode) elements.settingsDebugMode.checked = s.debugMode || false;
        if (elements.settingsShowFixedSource) elements.settingsShowFixedSource.checked = s.showFixedSource || false;
        if (elements.settingsLoggingLevel) elements.settingsLoggingLevel.value = s.loggingLevel || 'error';
        if (elements.settingsTrashMode) elements.settingsTrashMode.value = s.trashMode || '30';
        updateHelpOverview();
        updateTrashOverview();
        
        // Appearance settings
        if (elements.settingsLayout) elements.settingsLayout.value = s.layout || 'dark';
        if (elements.settingsCustomCss) elements.settingsCustomCss.value = s.customCss || '';
        if (elements.settingsUpdateNotify) elements.settingsUpdateNotify.value = s.updateNotify || 'changelog';
        if (elements.settingsFaviconService) elements.settingsFaviconService.value = s.faviconService || 'google';
        
        // Tags
        if (elements.settingsEnableTags) elements.settingsEnableTags.checked = s.enableTags || false;
        
        // Action Menu
        if (elements.settingsHideDisabledPopup) elements.settingsHideDisabledPopup.checked = s.hideDisabledPopup || false;
        if (elements.settingsPopupColumns) elements.settingsPopupColumns.value = s.popupColumns || '1';
        if (elements.settingsScriptOrder) elements.settingsScriptOrder.value = s.scriptOrder || 'auto';
        if (elements.settingsBadgeInfo) elements.settingsBadgeInfo.value = s.badgeInfo || 'running';
        if (elements.settingsBadgeColor) {
            elements.settingsBadgeColor.value = s.badgeColor || '#ee3131';
            if (elements.badgeColorPreview) {
                elements.badgeColorPreview.style.backgroundColor = s.badgeColor || '#ee3131';
            }
        }
        
        // Context Menu
        if (elements.settingsEnableContextMenu) elements.settingsEnableContextMenu.checked = s.enableContextMenu !== false;
        if (elements.settingsContextMenuRunAt) elements.settingsContextMenuRunAt.checked = s.contextMenuRunAt !== false;
        if (elements.settingsContextMenuCommands) elements.settingsContextMenuCommands.checked = s.contextMenuCommands !== false;
        
        // Userscript Search
        if (elements.settingsSearchIntegration) elements.settingsSearchIntegration.value = s.searchIntegration || 'disabled';
        
        // Userscript Update
        if (elements.settingsUpdateDisabled) elements.settingsUpdateDisabled.checked = s.updateDisabled || false;
        if (elements.settingsSilentUpdate) elements.settingsSilentUpdate.checked = s.silentUpdate !== false;
        if (elements.settingsCheckInterval) elements.settingsCheckInterval.value = s.checkInterval || '24';
        if (elements.settingsNotifyHideAfter) elements.settingsNotifyHideAfter.value = s.notifyHideAfter || '15';
        
        // Externals
        if (elements.settingsExternalsInterval) elements.settingsExternalsInterval.value = s.externalsInterval || '0';
        
        // Sync settings
        if (elements.settingsEnableSync) elements.settingsEnableSync.checked = normalizeSyncEnabled(s);
        if (elements.settingsSyncType) {
            elements.settingsSyncType.value = normalizeSyncProvider(s);
            toggleSyncProviderSettings();
        }
        if (elements.settingsWebdavUrl) elements.settingsWebdavUrl.value = s.webdavUrl || '';
        if (elements.settingsWebdavUsername) elements.settingsWebdavUsername.value = s.webdavUsername || '';
        if (elements.settingsWebdavPassword) elements.settingsWebdavPassword.value = s.webdavPassword || '';
        if (elements.syncLog) elements.syncLog.value = s.syncLog || '';
        syncCloudProviderSelection(normalizeSyncProvider(s), { triggerChange: false });
        
        // Editor settings
        if (elements.settingsEnableEditor) elements.settingsEnableEditor.checked = s.enableEditor !== false;
        if (elements.settingsEditorTheme) elements.settingsEditorTheme.value = s.editorTheme || 'default';
        if (elements.settingsEditorFontSize) elements.settingsEditorFontSize.value = s.editorFontSize || '100';
        if (elements.settingsKeyMapping) elements.settingsKeyMapping.value = s.keyMapping || 'default';
        if (elements.settingsIndentWidth) elements.settingsIndentWidth.value = s.indentWidth || '4';
        if (elements.settingsTabSize) elements.settingsTabSize.value = s.tabSize || '4';
        if (elements.settingsIndentWith) elements.settingsIndentWith.value = s.indentWith || 'spaces';
        if (elements.settingsTabMode) elements.settingsTabMode.value = s.tabMode || 'indent';
        if (elements.settingsHighlightMatches) elements.settingsHighlightMatches.value = s.highlightMatches || 'cursor';
        if (elements.settingsWordWrap) elements.settingsWordWrap.checked = s.wordWrap !== false;
        if (elements.settingsReindent) elements.settingsReindent.checked = s.reindent !== false;
        if (elements.settingsAutoSave) elements.settingsAutoSave.checked = s.autoSave || false;
        if (elements.settingsNoSaveConfirm) elements.settingsNoSaveConfirm.checked = s.noSaveConfirm !== false;
        if (elements.settingsHighlightTrailingWhitespace) elements.settingsHighlightTrailingWhitespace.checked = s.highlightTrailingWhitespace !== false;
        if (elements.settingsTrimWhitespace) elements.settingsTrimWhitespace.checked = s.trimWhitespace !== false;
        if (elements.settingsLintOnType) elements.settingsLintOnType.checked = s.lintOnType !== false;
        if (elements.settingsLintMaxSize) elements.settingsLintMaxSize.value = s.lintMaxSize || '1000000';
        if (elements.settingsLinterConfig) elements.settingsLinterConfig.value = s.linterConfig || '';
        
        // Security settings
        if (elements.settingsContentScriptAPI) elements.settingsContentScriptAPI.value = s.contentScriptAPI || 'userscripts';
        if (elements.settingsSandboxMode) elements.settingsSandboxMode.value = s.sandboxMode || 'default';
        if (elements.settingsModifyCSP) elements.settingsModifyCSP.value = s.modifyCSP || 'auto';
        if (elements.settingsAllowHttpHeaders) elements.settingsAllowHttpHeaders.value = s.allowHttpHeaders || 'yes';
        if (elements.settingsDefaultTabTypes) elements.settingsDefaultTabTypes.value = s.defaultTabTypes || 'all';
        if (elements.settingsAllowLocalFiles) elements.settingsAllowLocalFiles.value = s.allowLocalFiles || 'all';
        if (elements.settingsAllowCookies) elements.settingsAllowCookies.value = s.allowCookies || 'all';
        if (elements.settingsAllowCommunication) elements.settingsAllowCommunication.value = s.allowCommunication || 'version';
        if (elements.settingsSRI) elements.settingsSRI.value = s.sri || 'validate';
        if (elements.settingsIncludeMode) elements.settingsIncludeMode.value = s.includeMode || 'default';
        if (elements.settingsCheckConnect) elements.settingsCheckConnect.value = s.checkConnect || 'ask';
        if (elements.settingsIncognitoStorage) elements.settingsIncognitoStorage.value = s.incognitoStorage || 'temporary';
        if (elements.settingsPageFilterMode) elements.settingsPageFilterMode.value = s.pageFilterMode || 'blacklist';
        if (elements.settingsWhitelistedPages) elements.settingsWhitelistedPages.value = s.whitelistedPages || '';
        if (elements.settingsBlacklistedPages) elements.settingsBlacklistedPages.value = s.blacklistedPages || '';
        
        // Runtime Host Permissions
        if (elements.settingsDeniedHosts) elements.settingsDeniedHosts.value = (s.deniedHosts || []).join('\n');
        
        // BlackCheck
        if (elements.settingsBlacklistSource) elements.settingsBlacklistSource.value = s.blacklistSource || 'remote_manual';
        if (elements.settingsBlockSeverity) elements.settingsBlockSeverity.value = s.blockSeverity || '4';
        if (elements.settingsManualBlacklist) elements.settingsManualBlacklist.value = s.manualBlacklist || '';
        
        // Downloads
        if (elements.settingsDownloadMode) elements.settingsDownloadMode.value = s.downloadMode || 'default';
        if (elements.settingsDownloadWhitelist) elements.settingsDownloadWhitelist.value = s.downloadWhitelist || '';
        
        // Experimental
        if (elements.settingsStrictMode) elements.settingsStrictMode.value = s.strictMode || 'default';
        if (elements.settingsTopLevelAwait) elements.settingsTopLevelAwait.value = s.topLevelAwait || 'default';
        
        // Apply theme
        document.documentElement.setAttribute('data-theme', s.layout || 'dark');
        if (elements.btnCycleTheme) {
            const labels = { dark: 'Dark', light: 'Light', catppuccin: 'Catppuccin', oled: 'OLED' };
            elements.btnCycleTheme.title = `Theme: ${labels[s.layout] || 'Dark'}`;
        }
        applyConfigMode();

        // Apply custom CSS
        let customStyle = document.getElementById('sv-custom-css');
        if (s.customCss) {
            if (!customStyle) {
                customStyle = document.createElement('style');
                customStyle.id = 'sv-custom-css';
                document.head.appendChild(customStyle);
            }
            customStyle.textContent = s.customCss;
        } else if (customStyle) {
            customStyle.remove();
        }
        updateSupportSnapshotSummary();
    }

    async function saveSetting(key, value) {
        try {
            state.settings[key] = value;
            await chrome.runtime.sendMessage({ action: 'setSettings', settings: { [key]: value } });
            // Live-apply editor settings
            if (state.editor) {
                switch (key) {
                    case 'editorTheme': state.editor.setOption('theme', value); break;
                    case 'editorFontSize': { if (state.editor?.isMonaco) { state.editor.setFontSize(parseInt(value) || 100); } else { const cm = document.querySelector('.CodeMirror'); if (cm) cm.style.fontSize = value + '%'; } } break;
                    case 'wordWrap': state.editor.setOption('lineWrapping', value); break;
                    case 'tabSize': state.editor.setOption('tabSize', parseInt(value) || 4); break;
                    case 'indentWidth': state.editor.setOption('indentUnit', parseInt(value) || 4); break;
                    case 'indentWith': state.editor.setOption('indentWithTabs', value !== 'spaces'); break;
                    case 'lintOnType': if (!state.editor?.isMonaco) { state.editor.setOption('lint', value ? { getAnnotations: window.lintUserscript, delay: 300, tooltips: true, highlightLines: true } : false); } break;
                }
            }
            if (key === 'layout') document.documentElement.setAttribute('data-theme', value);
            if (key === 'configMode') applyConfigMode();
            if (key === 'customCss') applySettingsToUI();
            if (key === 'layout') updateHelpOverview();
            if (key === 'syncProvider') {
                syncSettingsProviderSelection(value);
                syncCloudProviderSelection(value);
            }
            if (key === 'syncEnabled' || key === 'syncProvider') {
                loadSyncProviderStatus();
            }
            showToast('Setting saved', 'success');
        } catch (e) {
            showToast('Failed to save', 'error');
        }
    }

    function toggleSyncProviderSettings() {
        const syncType = elements.settingsSyncType?.value || normalizeSyncProvider(state.settings);
        
        // Hide all provider settings first
        if (elements.syncWebdavSettings) elements.syncWebdavSettings.style.display = 'none';
        if (elements.syncOAuthSettings) elements.syncOAuthSettings.style.display = 'none';
        
        // Show selected provider settings
        if (syncType === 'webdav' && elements.syncWebdavSettings) {
            elements.syncWebdavSettings.style.display = 'block';
        } else if (OAUTH_SYNC_PROVIDERS.includes(syncType) && elements.syncOAuthSettings) {
            elements.syncOAuthSettings.style.display = 'block';
        }
        loadSyncProviderStatus();
    }
    
    // Update sync provider status UI
    function updateSyncProviderUI(provider, status) {
        const selectedProvider = elements.settingsSyncType?.value || normalizeSyncProvider(state.settings);
        if (!OAUTH_SYNC_PROVIDERS.includes(selectedProvider)) {
            if (elements.oauthStatus) {
                elements.oauthStatus.textContent = selectedProvider === 'none' ? 'Choose a provider' : 'Not required';
                elements.oauthStatus.className = 'sync-status disconnected';
            }
            if (elements.oauthUserRow) elements.oauthUserRow.style.display = 'none';
            if (elements.btnConnectOAuth) elements.btnConnectOAuth.style.display = selectedProvider === 'none' ? 'none' : 'inline-block';
            if (elements.btnDisconnectOAuth) elements.btnDisconnectOAuth.style.display = 'none';
            return;
        }

        if (provider && provider !== selectedProvider) return;

        const label = selectedProvider === 'googledrive'
            ? 'Google Drive'
            : selectedProvider === 'dropbox'
                ? 'Dropbox'
                : 'OneDrive';

        if (elements.btnConnectOAuth) {
            elements.btnConnectOAuth.textContent = `Connect ${label}`;
            elements.btnConnectOAuth.style.display = status?.connected ? 'none' : 'inline-block';
        }
        if (elements.btnDisconnectOAuth) {
            elements.btnDisconnectOAuth.textContent = `Disconnect ${label}`;
            elements.btnDisconnectOAuth.style.display = status?.connected ? 'inline-block' : 'none';
        }

        if (elements.oauthStatus) {
            elements.oauthStatus.textContent = status?.connected ? `${label} connected` : `${label} not connected`;
            elements.oauthStatus.className = `sync-status ${status?.connected ? 'connected' : 'disconnected'}`;
        }

        const accountLabel = status?.user?.email || status?.user?.name || status?.user || '';
        if (elements.oauthUser) elements.oauthUser.textContent = accountLabel;
        if (elements.oauthUserRow) elements.oauthUserRow.style.display = accountLabel ? 'flex' : 'none';
    }
    
    function capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
    
    // Load sync provider status for OAuth providers
    async function loadSyncProviderStatus() {
        const provider = elements.settingsSyncType?.value || normalizeSyncProvider(state.settings);
        if (!OAUTH_SYNC_PROVIDERS.includes(provider)) {
            updateSyncProviderUI(provider, { connected: false });
        } else {
            try {
                const response = await chrome.runtime.sendMessage({ action: 'getSyncProviderStatus', provider });
                updateSyncProviderUI(provider, response);
            } catch (e) {
                console.error(`Failed to get ${provider} status:`, e);
                updateSyncProviderUI(provider, { connected: false });
            }
        }

        if (elements.lastSyncTime) {
            elements.lastSyncTime.textContent = formatSyncTimestamp(state.settings.lastSync);
        }
    }

    async function ensureSyncIdentityPermission(provider) {
        if (!['googledrive', 'dropbox'].includes(provider)) return true;
        try {
            const granted = await chrome.permissions.request({ permissions: ['identity'] });
            if (!granted) {
                showToast('Identity permission is required to connect this provider', 'error');
                return false;
            }
            return true;
        } catch (e) {
            showToast(`Permission request failed: ${e.message}`, 'error');
            return false;
        }
    }
    
    // Connect to cloud sync provider
    async function connectSyncProvider(provider) {
        if (!(await ensureSyncIdentityPermission(provider))) return;
        showToast(`Connecting to ${capitalize(provider)}…`, 'info');
        try {
            const response = await chrome.runtime.sendMessage({ action: 'connectSyncProvider', provider });
            if (response?.success) {
                showToast(`Connected to ${capitalize(provider)}!`, 'success');
                state.settings.syncEnabled = true;
                state.settings.syncProvider = provider;
                if (elements.settingsEnableSync) elements.settingsEnableSync.checked = true;
                syncSettingsProviderSelection(provider);
                syncCloudProviderSelection(provider);
                await loadSettings();
                toggleSyncProviderSettings();
            } else {
                showToast(response?.error || `Failed to connect to ${capitalize(provider)}`, 'error');
            }
        } catch (e) {
            showToast(`Connection failed: ${e.message}`, 'error');
        }
    }
    
    // Disconnect from cloud sync provider
    async function disconnectSyncProvider(provider) {
        if (!await showConfirmModal('Disconnect', `Disconnect from ${capitalize(provider)}?`)) return;
        
        try {
            const response = await chrome.runtime.sendMessage({ action: 'disconnectSyncProvider', provider });
            if (response?.error) {
                showToast(response.error, 'error');
                return;
            }
            showToast(`Disconnected from ${capitalize(provider)}`, 'success');
            state.settings.syncProvider = 'none';
            syncSettingsProviderSelection('none');
            syncCloudProviderSelection('none');
            await loadSettings();
            toggleSyncProviderSettings();
        } catch (e) {
            showToast(`Disconnect failed: ${e.message}`, 'error');
        }
    }
    
    // Sync with provider
    async function syncWithProvider(provider) {
        showToast('Syncing…', 'info');
        try {
            const response = await chrome.runtime.sendMessage({ action: 'syncNow', provider });
            if (response?.success) {
                await loadScripts();
                updateStats();
                if (elements.lastSyncTime) {
                    state.settings.lastSync = Date.now();
                    elements.lastSyncTime.textContent = formatSyncTimestamp(state.settings.lastSync);
                }
                showToast('Sync complete!', 'success');
            } else {
                showToast(response?.error || 'Sync failed', 'error');
            }
        } catch (e) {
            showToast(`Sync failed: ${e.message}`, 'error');
        }
    }

    // ============================================
    // Per-Script Settings Functions
    // ============================================
    
    function loadScriptSettings(script) {
        if (!script) return;
        
        const settings = script.settings || {};
        const meta = script.metadata || {};
        
        // Basic settings
        if (elements.scriptAutoUpdate) elements.scriptAutoUpdate.checked = settings.autoUpdate !== false;
        if (elements.scriptNotifyUpdates) elements.scriptNotifyUpdates.checked = settings.notifyUpdates !== false;
        if (elements.scriptSyncLock) elements.scriptSyncLock.checked = settings.userModified === true;
        const syncLockStatus = document.getElementById('syncLockStatus');
        if (syncLockStatus) syncLockStatus.style.display = settings.userModified ? '' : 'none';
        if (elements.scriptRunAt) elements.scriptRunAt.value = settings.runAt || 'default';
        if (elements.scriptInjectInto) elements.scriptInjectInto.value = settings.injectInto || 'auto';
        if (elements.scriptNotifyErrors) elements.scriptNotifyErrors.checked = settings.notifyErrors || false;

        // Notes
        const notesEl = document.getElementById('scriptNotes');
        if (notesEl) notesEl.value = settings.notes || '';

        // URL Override settings
        // Original patterns checkboxes
        if (elements.useOriginalIncludes) {
            elements.useOriginalIncludes.checked = settings.useOriginalIncludes !== false;
        }
        if (elements.useOriginalMatches) {
            elements.useOriginalMatches.checked = settings.useOriginalMatches !== false;
        }
        if (elements.useOriginalExcludes) {
            elements.useOriginalExcludes.checked = settings.useOriginalExcludes !== false;
        }
        
        // Display original patterns from metadata (read-only)
        renderOriginalPatterns('originalIncludesList', meta.include || []);
        renderOriginalPatterns('originalMatchesList', meta.match || []);
        renderOriginalPatterns('originalExcludesList', meta.exclude || []);
        
        // Display user patterns (editable)
        renderUserPatterns('userIncludesList', settings.userIncludes || [], 'include');
        renderUserPatterns('userMatchesList', settings.userMatches || [], 'match');
        renderUserPatterns('userExcludesList', settings.userExcludes || [], 'exclude');
        
        // Update visual state based on checkbox states
        updateOriginalPatternsState();
    }
    
    function renderOriginalPatterns(elementId, patterns) {
        const el = document.getElementById(elementId);
        if (!el) return;
        
        if (!patterns || patterns.length === 0) {
            el.innerHTML = '<span class="panel-empty-inline">None defined</span>';
            return;
        }
        
        el.innerHTML = patterns.map(p => 
            `<span class="pattern-item">${escapeHtml(p)}</span>`
        ).join('');
    }
    
    function renderUserPatterns(elementId, patterns, type) {
        const el = document.getElementById(elementId);
        if (!el) return;
        
        if (!patterns || patterns.length === 0) {
            el.innerHTML = '';
            return;
        }
        
        const isExclude = type === 'exclude';
        el.innerHTML = patterns.map((p, i) => 
            `<span class="pattern-tag ${isExclude ? 'exclude' : ''}" data-index="${i}" data-type="${type}">
                <span class="pattern-text">${escapeHtml(p)}</span>
                <span class="remove-pattern" title="Remove pattern">×</span>
            </span>`
        ).join('');
        
        // Add click handlers for remove buttons
        el.querySelectorAll('.remove-pattern').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tag = e.target.closest('.pattern-tag');
                if (tag) {
                    tag.remove();
                }
            });
        });
    }
    
    function updateOriginalPatternsState() {
        // Toggle visual state of original pattern groups based on checkbox
        const groups = [
            { checkbox: elements.useOriginalIncludes, list: elements.originalIncludesList },
            { checkbox: elements.useOriginalMatches, list: elements.originalMatchesList },
            { checkbox: elements.useOriginalExcludes, list: elements.originalExcludesList }
        ];
        
        groups.forEach(({ checkbox, list }) => {
            if (checkbox && list) {
                const group = list.closest('.url-override-group');
                if (group) {
                    group.classList.toggle('disabled', !checkbox.checked);
                }
            }
        });
    }
    
    function getUserPatternsFromList(elementId) {
        const el = document.getElementById(elementId);
        if (!el) return [];
        
        const patterns = [];
        el.querySelectorAll('.pattern-tag .pattern-text').forEach(span => {
            const pattern = span.textContent.trim();
            if (pattern) patterns.push(pattern);
        });
        return patterns;
    }
    
    function addUserPattern(listId, pattern, type) {
        const el = document.getElementById(listId);
        if (!el) return;
        
        // Check for duplicates
        const existing = getUserPatternsFromList(listId);
        if (existing.includes(pattern)) {
            showToast('Pattern already exists', 'warning');
            return;
        }
        
        const isExclude = type === 'exclude';
        const index = existing.length;
        
        const tag = document.createElement('span');
        tag.className = `pattern-tag ${isExclude ? 'exclude' : ''}`;
        tag.dataset.index = index;
        tag.dataset.type = type;
        tag.innerHTML = `
            <span class="pattern-text">${escapeHtml(pattern)}</span>
            <span class="remove-pattern" title="Remove pattern">×</span>
        `;
        
        tag.querySelector('.remove-pattern').addEventListener('click', () => {
            tag.remove();
        });
        
        el.appendChild(tag);
    }
    
    async function saveScriptSettings() {
        if (!state.currentScriptId) return;
        
        const settings = {
            autoUpdate: elements.scriptAutoUpdate?.checked ?? true,
            notifyUpdates: elements.scriptNotifyUpdates?.checked ?? true,
            userModified: elements.scriptSyncLock?.checked ?? false,
            runAt: elements.scriptRunAt?.value || 'default',
            injectInto: elements.scriptInjectInto?.value || 'auto',
            notifyErrors: elements.scriptNotifyErrors?.checked || false,
            notes: document.getElementById('scriptNotes')?.value || '',
            // URL Override settings
            useOriginalIncludes: elements.useOriginalIncludes?.checked ?? true,
            useOriginalMatches: elements.useOriginalMatches?.checked ?? true,
            useOriginalExcludes: elements.useOriginalExcludes?.checked ?? true,
            userIncludes: getUserPatternsFromList('userIncludesList'),
            userMatches: getUserPatternsFromList('userMatchesList'),
            userExcludes: getUserPatternsFromList('userExcludesList')
        };
        
        try {
            await chrome.runtime.sendMessage({ action: 'setScriptSettings', scriptId: state.currentScriptId, settings });
            
            // Update local state
            const script = state.scripts.find(s => s.id === state.currentScriptId);
            if (script) script.settings = settings;
            
            showToast('Settings saved', 'success');
        } catch (e) {
            showToast('Failed to save settings', 'error');
        }
    }
    
    async function resetScriptSettings() {
        if (!state.currentScriptId) return;
        if (!await showConfirmModal('Reset Settings', 'Reset to default settings?')) return;
        
        const defaults = {
            autoUpdate: true,
            notifyUpdates: true,
            runAt: 'default',
            injectInto: 'auto',
            notifyErrors: false,
            // URL Override defaults
            useOriginalIncludes: true,
            useOriginalMatches: true,
            useOriginalExcludes: true,
            userIncludes: [],
            userMatches: [],
            userExcludes: []
        };
        
        try {
            await chrome.runtime.sendMessage({ action: 'setScriptSettings', scriptId: state.currentScriptId, settings: defaults });
            
            const script = state.scripts.find(s => s.id === state.currentScriptId);
            if (script) script.settings = defaults;
            
            loadScriptSettings(script);
            showToast('Settings reset', 'success');
        } catch (e) {
            showToast('Failed to reset settings', 'error');
        }
    }

    // Map dashboard themes to sensible editor theme defaults
    const DASHBOARD_TO_EDITOR_THEME = {
        dark: 'material-darker',
        light: 'default',
        catppuccin: 'dracula',
        oled: 'monokai'
    };

    function applyTheme() {
        const layout = state.settings.layout || 'dark';
        document.documentElement.setAttribute('data-theme', layout);
        // Auto-sync editor theme if user hasn't explicitly chosen one
        if (state.editor && (!state.settings.editorTheme || state.settings.editorTheme === 'default')) {
            const mapped = DASHBOARD_TO_EDITOR_THEME[layout] || 'material-darker';
            state.editor.setOption('theme', mapped);
        }
    }

    function normalizeSettingsLabel(text) {
        return (text || '')
            .replace(/\s+/g, ' ')
            .replace(/[!?]/g, '')
            .trim()
            .toLowerCase();
    }

    function getSettingsPanelSections() {
        return Array.from(document.querySelectorAll('#settingsPanel #settingsSections .settings-section'));
    }

    function initializeSettingsPanelControls() {
        const sections = getSettingsPanelSections();
        if (sections.length === 0) return;

        sections.forEach(section => {
            if (!section.dataset.settingsGroup) {
                const labelText = normalizeSettingsLabel(section.querySelector('.section-label')?.textContent || '');
                const contentText = normalizeSettingsLabel(section.querySelector('.section-content')?.textContent || '');
                section.dataset.settingsLabel = labelText;
                section.dataset.settingsGroup = SETTINGS_SECTION_GROUPS[labelText] || 'core';
                section.dataset.settingsSearch = `${labelText} ${contentText}`;
            }
        });

        elements.settingsFilterButtons?.forEach(button => {
            button.addEventListener('click', () => {
                state.settingsPanelFilter = button.dataset.settingsFilter || 'all';
                applySettingsPanelFilters();
            });
        });

        elements.settingsQuickFilter?.addEventListener('input', () => applySettingsPanelFilters());
        applySettingsPanelFilters();
    }

    function applySettingsPanelFilters() {
        const sections = getSettingsPanelSections();
        if (sections.length === 0) return;

        const mode = state.settings.configMode || 'advanced';
        const query = normalizeSettingsLabel(elements.settingsQuickFilter?.value || '');
        let visibleCount = 0;
        let visibleAdvancedCount = 0;
        let totalAdvancedCount = 0;

        sections.forEach(section => {
            const isAdvanced = section.dataset.configLevel === 'advanced';
            const group = section.dataset.settingsGroup || 'core';
            const matchesMode = !isAdvanced || mode === 'advanced';
            const matchesGroup = state.settingsPanelFilter === 'all' || group === state.settingsPanelFilter;
            const matchesQuery = !query || (section.dataset.settingsSearch || '').includes(query);
            const shouldShow = matchesMode && matchesGroup && matchesQuery;

            if (isAdvanced) totalAdvancedCount++;
            if (shouldShow) {
                visibleCount++;
                if (isAdvanced) visibleAdvancedCount++;
            }

            section.hidden = !shouldShow;
        });

        syncPressedButtons(
            elements.settingsFilterButtons,
            button => (button.dataset.settingsFilter || 'all') === state.settingsPanelFilter
        );

        if (elements.settingsModeSummary) {
            elements.settingsModeSummary.textContent = mode === 'advanced' ? 'Advanced' : 'Beginner';
        }
        if (elements.settingsVisibleSummary) {
            elements.settingsVisibleSummary.textContent = `${numberFormatter.format(visibleCount)} section${visibleCount === 1 ? '' : 's'}`;
        }
        if (elements.settingsAdvancedSummary) {
            elements.settingsAdvancedSummary.textContent = mode === 'advanced'
                ? `${numberFormatter.format(visibleAdvancedCount)}/${numberFormatter.format(totalAdvancedCount)} shown`
                : `${numberFormatter.format(totalAdvancedCount)} hidden`;
        }
        if (elements.settingsFilterStatus) {
            if (query) {
                elements.settingsFilterStatus.textContent = `Showing ${numberFormatter.format(visibleCount)} result${visibleCount === 1 ? '' : 's'} for "${elements.settingsQuickFilter?.value?.trim() || ''}".`;
            } else {
                elements.settingsFilterStatus.textContent = `Showing ${SETTINGS_FILTER_LABELS[state.settingsPanelFilter] || 'all sections'} in ${mode} mode.`;
            }
        }
        if (elements.settingsEmptyState) {
            elements.settingsEmptyState.hidden = visibleCount !== 0;
        }
    }

    function getUtilitiesPanelSections() {
        return Array.from(document.querySelectorAll('#utilitiesPanel #utilitiesSections .settings-section'));
    }

    function initializeUtilitiesPanelControls() {
        const sections = getUtilitiesPanelSections();
        if (sections.length === 0) return;

        sections.forEach(section => {
            if (!section.dataset.utilitiesGroup) {
                const labelText = normalizeSettingsLabel(section.querySelector('.section-label')?.textContent || '');
                const contentText = normalizeSettingsLabel(section.querySelector('.section-content')?.textContent || '');
                section.dataset.utilitiesLabel = labelText;
                section.dataset.utilitiesGroup = UTILITIES_SECTION_GROUPS[labelText] || 'backup';
                section.dataset.utilitiesSearch = `${labelText} ${contentText}`;
            }
        });

        elements.utilitiesFilterButtons?.forEach(button => {
            button.addEventListener('click', () => {
                state.utilitiesPanelFilter = button.dataset.utilitiesFilter || 'all';
                applyUtilitiesPanelFilters();
            });
        });

        elements.utilitiesQuickFilter?.addEventListener('input', () => applyUtilitiesPanelFilters());
        applyUtilitiesPanelFilters();
    }

    function updateUtilitiesOverview(visibleCount = null) {
        const providerLabel = elements.cloudProvider?.selectedOptions?.[0]?.textContent?.trim() || 'Cloud';
        const providerValue = elements.cloudProvider?.value || 'none';
        const cloudStatus = elements.cloudStatusText?.textContent?.trim() || 'Not connected';
        const workspaceCount = elements.workspaceList?.querySelectorAll('.workspace-item').length || 0;
        const importCount = getUtilitiesPanelSections().filter(section => section.dataset.utilitiesGroup === 'import').length;
        const resolvedVisibleCount = visibleCount == null
            ? getUtilitiesPanelSections().filter(section => !section.hidden).length
            : visibleCount;

        if (elements.utilitiesCloudSummary) {
            elements.utilitiesCloudSummary.textContent = providerValue === 'none'
                ? 'Choose provider'
                : cloudStatus === 'Connected'
                ? `${providerLabel} live`
                : cloudStatus === 'Error'
                    ? `${providerLabel} error`
                    : `${providerLabel} idle`;
        }
        if (elements.utilitiesImportSummary) {
            elements.utilitiesImportSummary.textContent = `${numberFormatter.format(importCount)} paths`;
        }
        if (elements.utilitiesWorkspaceSummary) {
            elements.utilitiesWorkspaceSummary.textContent = workspaceCount === 0
                ? 'None saved'
                : `${numberFormatter.format(workspaceCount)} saved`;
        }
        if (elements.utilitiesVisibleSummary) {
            elements.utilitiesVisibleSummary.textContent = `${numberFormatter.format(resolvedVisibleCount)} section${resolvedVisibleCount === 1 ? '' : 's'}`;
        }
    }

    function applyUtilitiesPanelFilters() {
        const sections = getUtilitiesPanelSections();
        if (sections.length === 0) return;

        const query = normalizeSettingsLabel(elements.utilitiesQuickFilter?.value || '');
        let visibleCount = 0;

        sections.forEach(section => {
            const group = section.dataset.utilitiesGroup || 'backup';
            const matchesGroup = state.utilitiesPanelFilter === 'all' || group === state.utilitiesPanelFilter;
            const matchesQuery = !query || (section.dataset.utilitiesSearch || '').includes(query);
            const shouldShow = matchesGroup && matchesQuery;
            if (shouldShow) visibleCount++;
            section.hidden = !shouldShow;
        });

        syncPressedButtons(
            elements.utilitiesFilterButtons,
            button => (button.dataset.utilitiesFilter || 'all') === state.utilitiesPanelFilter
        );

        if (elements.utilitiesFilterStatus) {
            if (query) {
                elements.utilitiesFilterStatus.textContent = `Showing ${numberFormatter.format(visibleCount)} result${visibleCount === 1 ? '' : 's'} for "${elements.utilitiesQuickFilter?.value?.trim() || ''}".`;
            } else {
                elements.utilitiesFilterStatus.textContent = `Showing ${UTILITIES_FILTER_LABELS[state.utilitiesPanelFilter] || 'all utilities'}.`;
            }
        }
        if (elements.utilitiesEmptyState) {
            elements.utilitiesEmptyState.hidden = visibleCount !== 0;
        }

        updateUtilitiesOverview(visibleCount);
    }

    function applyBackupScheduleFormState() {
        const scheduleType = elements.backupScheduleType?.value || 'manual';
        const showHour = scheduleType === 'daily' || scheduleType === 'weekly';
        const showDay = scheduleType === 'weekly';
        if (elements.backupHourRow) elements.backupHourRow.hidden = !showHour;
        if (elements.backupDayRow) elements.backupDayRow.hidden = !showDay;
        const manualOnly = scheduleType === 'manual';
        if (elements.backupEnabled) {
            elements.backupEnabled.disabled = manualOnly;
            if (manualOnly) elements.backupEnabled.checked = false;
        }
    }

    function updateBackupScheduleSummary(settings = state.backupSettings || {}) {
        const latestBackup = getLatestBackup();
        if (elements.backupScheduleSummary) {
            elements.backupScheduleSummary.textContent = formatBackupScheduleSummary(settings);
        }
        if (elements.backupScheduleStatus) {
            const retention = Math.max(1, Number(settings.maxBackups || 5));
            const notificationParts = [];
            if (settings.notifyOnSuccess) notificationParts.push('success alerts');
            if (settings.notifyOnFailure !== false) notificationParts.push('failure alerts');
            const lastBackupLabel = latestBackup
                ? `last ${formatBackupReason(latestBackup.reason).toLowerCase()} backup ${dateTimeFormatter.format(new Date(latestBackup.timestamp || Date.now()))}`
                : 'no backups saved yet';
            elements.backupScheduleStatus.textContent = `${numberFormatter.format(retention)} backup${retention === 1 ? '' : 's'} retained · ${notificationParts.length ? notificationParts.join(' + ') : 'notifications off'} · ${lastBackupLabel}`;
        }
        if (elements.backupNextRunStatus) {
            if (!settings.enabled) {
                elements.backupNextRunStatus.textContent = 'Next run: manual only.';
            } else if ((settings.scheduleType || 'manual') === 'onChange') {
                elements.backupNextRunStatus.textContent = 'Next run: about 5 minutes after the next script change.';
            } else {
                const nextRun = getNextBackupRun(settings);
                elements.backupNextRunStatus.textContent = nextRun
                    ? `Next run: ${dateTimeFormatter.format(nextRun)}`
                    : 'Next run: not scheduled.';
            }
        }
    }

    async function loadBackupSettings(options = {}) {
        const { announce = false } = options;
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getBackupSettings' });
            const settings = normalizeBackupSettings(response);
            state.backupSettings = settings;
            if (elements.backupEnabled) elements.backupEnabled.checked = settings.enabled;
            if (elements.backupScheduleType) elements.backupScheduleType.value = settings.scheduleType;
            if (elements.backupHour) elements.backupHour.value = String(settings.hour);
            if (elements.backupDayOfWeek) elements.backupDayOfWeek.value = String(settings.dayOfWeek);
            if (elements.backupMaxBackups) elements.backupMaxBackups.value = String(settings.maxBackups);
            if (elements.backupNotifyOnSuccess) elements.backupNotifyOnSuccess.checked = settings.notifyOnSuccess;
            if (elements.backupNotifyOnFailure) elements.backupNotifyOnFailure.checked = settings.notifyOnFailure;
            if (elements.backupWarnOnStorageFull) elements.backupWarnOnStorageFull.checked = settings.warnOnStorageFull;
            applyBackupScheduleFormState();
            updateBackupScheduleSummary(settings);
            updateSupportSnapshotSummary();
            if (announce) showToast('Backup schedule refreshed', 'success');
            return settings;
        } catch (error) {
            const message = error?.message || 'Failed to load backup schedule';
            state.backupSettings = null;
            if (elements.backupScheduleSummary) elements.backupScheduleSummary.textContent = 'Unavailable';
            if (elements.backupScheduleStatus) elements.backupScheduleStatus.textContent = message;
            if (elements.backupNextRunStatus) elements.backupNextRunStatus.textContent = 'Next run unavailable.';
            updateSupportSnapshotSummary();
            if (announce) showToast(message, 'error');
            return null;
        }
    }

    async function saveBackupSettings() {
        const scheduleType = elements.backupScheduleType?.value || 'manual';
        const nextSettings = {
            enabled: !!elements.backupEnabled?.checked && scheduleType !== 'manual',
            scheduleType,
            hour: Math.max(0, Math.min(23, Number(elements.backupHour?.value || 3))),
            dayOfWeek: Math.max(0, Math.min(6, Number(elements.backupDayOfWeek?.value || 0))),
            maxBackups: Math.max(1, Math.min(50, Number(elements.backupMaxBackups?.value || 5))),
            notifyOnSuccess: !!elements.backupNotifyOnSuccess?.checked,
            notifyOnFailure: !!elements.backupNotifyOnFailure?.checked,
            warnOnStorageFull: !!elements.backupWarnOnStorageFull?.checked
        };
        try {
            const response = await chrome.runtime.sendMessage({ action: 'setBackupSettings', settings: nextSettings });
            if (response?.error || response?.success === false) {
                showToast(response?.error || 'Failed to save backup schedule', 'error');
                return;
            }
            const savedSettings = response?.settings && typeof response.settings === 'object'
                ? {
                    enabled: !!response.settings.enabled,
                    scheduleType: response.settings.scheduleType || nextSettings.scheduleType,
                    hour: Number.isFinite(Number(response.settings.hour)) ? Number(response.settings.hour) : nextSettings.hour,
                    dayOfWeek: Number.isFinite(Number(response.settings.dayOfWeek)) ? Number(response.settings.dayOfWeek) : nextSettings.dayOfWeek,
                    maxBackups: Math.max(1, Number(response.settings.maxBackups || nextSettings.maxBackups)),
                    notifyOnSuccess: response.settings.notifyOnSuccess !== false,
                    notifyOnFailure: response.settings.notifyOnFailure !== false,
                    warnOnStorageFull: response.settings.warnOnStorageFull !== false
                }
                : { ...nextSettings };
            state.backupSettings = savedSettings;
            applyBackupScheduleFormState();
            updateBackupScheduleSummary(savedSettings);
            updateSupportSnapshotSummary();
            const prunedCount = Number(response?.settings?.prunedCount || 0);
            if (prunedCount > 0) {
                await loadBackups();
            }
            showToast(
                prunedCount > 0
                    ? `Backup schedule saved, pruned ${numberFormatter.format(prunedCount)} old backup${prunedCount === 1 ? '' : 's'}`
                    : 'Backup schedule saved',
                'success'
            );
        } catch (error) {
            showToast(error?.message || 'Failed to save backup schedule', 'error');
        }
    }

    function updateSupportSnapshotSummary() {
        if (!elements.supportSnapshotSummary) return;
        const runtime = state.trustCenter.runtimeStatus;
        const runtimeLabel = runtime
            ? (runtime.setupRequired ? 'Needs setup' : 'Ready')
            : 'Unchecked';
        const trustedOriginCount = state.trustCenter.publicApiOrigins?.length || 0;
        const trustedKeyCount = Object.keys(state.trustCenter.signingKeys || {}).length;
        const syncProvider = normalizeSyncProvider(state.settings);
        const enabledScriptCount = state.scripts.filter(script => script.enabled !== false).length;
        const backupCount = Array.isArray(state.backups) ? state.backups.length : 0;
        const backupSize = backupCount
            ? state.backups.reduce((sum, entry) => sum + Number(entry.size || 0), 0)
            : 0;
        const latestBackup = getLatestBackup();
        const backupSummary = latestBackup
            ? `${numberFormatter.format(backupCount)} backup${backupCount === 1 ? '' : 's'} (${formatBytes(backupSize)}), latest ${formatBackupReason(latestBackup.reason).toLowerCase()} backup ${dateTimeFormatter.format(new Date(latestBackup.timestamp || Date.now()))} (${describeBackupScope(latestBackup)})`
            : 'no backups saved yet';
        const backupScheduleLabel = state.backupSettings
            ? formatBackupScheduleSummary(state.backupSettings).toLowerCase()
            : 'schedule unavailable';
        elements.supportSnapshotSummary.textContent =
            `Runtime ${runtimeLabel}, ${numberFormatter.format(state.scripts.length)} scripts (${numberFormatter.format(enabledScriptCount)} enabled), ${numberFormatter.format(trustedOriginCount)} trusted origins, ${numberFormatter.format(trustedKeyCount)} trusted signing keys, sync ${syncProvider === 'none' ? 'disabled' : syncProvider}, recovery ${backupSummary}, schedule ${backupScheduleLabel}.`;
    }

    function normalizeTrustedOriginInput(rawValue) {
        const origins = [];
        const invalid = [];
        const seen = new Set();
        String(rawValue || '')
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean)
            .forEach(line => {
                try {
                    const parsed = new URL(line);
                    if (!/^https?:$/.test(parsed.protocol)) {
                        invalid.push(line);
                        return;
                    }
                    const origin = parsed.origin;
                    if (!seen.has(origin)) {
                        seen.add(origin);
                        origins.push(origin);
                    }
                } catch (error) {
                    invalid.push(line);
                }
            });
        return { origins, invalid };
    }

    function formatPublicApiPermissionSummary(permissions = {}) {
        const values = Object.values(permissions);
        if (!values.length) return 'Permission policy unavailable.';
        const allowCount = values.filter(value => value === 'allow').length;
        const promptCount = values.filter(value => value === 'prompt').length;
        const denyCount = values.filter(value => value === 'deny').length;
        const guardedActions = Object.entries(permissions)
            .filter(([, value]) => value !== 'allow')
            .map(([action, value]) => `${action}: ${value}`)
            .slice(0, 4)
            .join(' · ');
        return `Policy: ${numberFormatter.format(allowCount)} allow, ${numberFormatter.format(promptCount)} prompt, ${numberFormatter.format(denyCount)} deny${guardedActions ? ` (${guardedActions})` : ''}.`;
    }

    function summarizeAuditDetails(details) {
        if (!details || typeof details !== 'object') return '';
        const json = JSON.stringify(details);
        return json.length > 160 ? `${json.slice(0, 157)}...` : json;
    }

    function renderRuntimeStatus(status, errorMessage = '') {
        if (elements.runtimeStatusSummary) {
            elements.runtimeStatusSummary.textContent = errorMessage
                ? 'Unavailable'
                : status?.setupRequired
                    ? 'Setup Needed'
                    : status?.userScriptsAvailable
                        ? 'Ready'
                        : 'Unavailable';
        }
        if (elements.runtimeStatusDetails) {
            if (errorMessage) {
                elements.runtimeStatusDetails.textContent = errorMessage;
            } else if (status) {
                const detailLines = [
                    `Chrome ${status.chromeVersion || 'unknown'}`,
                    status.userScriptsAvailable
                        ? 'userScripts API is available and ready for registrations.'
                        : 'userScripts API is unavailable in the current browser state.',
                    status.setupRequired
                        ? status.setupMessage || 'Manual setup is still required before scripts can run.'
                        : 'Runtime looks ready for script injection.'
                ];
                if (state.trustCenter.lastRuntimeRepairAt) {
                    detailLines.push(`Last repair ran ${dateTimeFormatter.format(new Date(state.trustCenter.lastRuntimeRepairAt))}.`);
                }
                elements.runtimeStatusDetails.innerHTML = detailLines
                    .map(line => `<div>${escapeHtml(line)}</div>`)
                    .join('');
            } else {
                elements.runtimeStatusDetails.textContent = 'Runtime status unavailable.';
            }
        }
        updateSupportSnapshotSummary();
    }

    async function loadRuntimeStatus(options = {}) {
        const { announce = false } = options;
        try {
            const status = await chrome.runtime.sendMessage({ action: 'getExtensionStatus' });
            state.trustCenter.runtimeStatus = status || null;
            renderRuntimeStatus(status);
            if (announce) {
                showToast(status?.setupRequired ? 'Runtime still needs setup' : 'Runtime status refreshed', status?.setupRequired ? 'warning' : 'success');
            }
            return status;
        } catch (error) {
            const message = error?.message || 'Failed to load runtime status';
            renderRuntimeStatus(null, message);
            if (announce) showToast(message, 'error');
            return null;
        }
    }

    function renderPublicApiAuditLog(entries = []) {
        if (!elements.publicApiAuditLog) return;
        if (!entries.length) {
            elements.publicApiAuditLog.innerHTML = '<div class="panel-empty-inline">No external API activity yet.</div>';
            return;
        }
        elements.publicApiAuditLog.innerHTML = entries
            .slice()
            .reverse()
            .map(entry => {
                const resultTone = entry?.result === 'ok' ? 'success' : entry?.result === 'denied' ? 'warning' : 'error';
                const detail = summarizeAuditDetails(entry?.details);
                return `
                    <div class="setting-row" style="margin:0;padding:10px 0;display:grid;gap:4px;border-bottom:1px solid rgba(127,127,127,0.1)">
                        <div style="display:flex;justify-content:space-between;gap:12px;align-items:center">
                            <strong style="color:var(--text-primary)">${escapeHtml(entry?.action || 'unknown')}</strong>
                            <span class="info-tag ${resultTone}">${escapeHtml(entry?.result || 'unknown')}</span>
                        </div>
                        <div class="panel-empty-inline">${escapeHtml(entry?.sender || 'unknown sender')}</div>
                        <div class="panel-empty-inline">${escapeHtml(dateTimeFormatter.format(new Date(entry?.timestamp || Date.now())))}</div>
                        ${detail ? `<div class="panel-empty-inline" style="word-break:break-word">${escapeHtml(detail)}</div>` : ''}
                    </div>
                `;
            })
            .join('');
    }

    async function loadPublicApiTrustState(options = {}) {
        const { announce = false } = options;
        try {
            const [originsResponse, permissionsResponse, auditResponse] = await Promise.all([
                chrome.runtime.sendMessage({ action: 'publicApi_getTrustedOrigins' }),
                chrome.runtime.sendMessage({ action: 'publicApi_getPermissions' }),
                chrome.runtime.sendMessage({ action: 'publicApi_getAuditLog', data: { limit: 25 } })
            ]);
            const origins = Array.isArray(originsResponse?.origins) ? originsResponse.origins : [];
            const permissions = permissionsResponse?.permissions && typeof permissionsResponse.permissions === 'object'
                ? permissionsResponse.permissions
                : {};
            const entries = Array.isArray(auditResponse?.entries) ? auditResponse.entries : [];

            state.trustCenter.publicApiOrigins = origins;
            state.trustCenter.publicApiPermissions = permissions;
            state.trustCenter.publicApiAudit = entries;

            if (elements.publicApiTrustedOrigins) {
                elements.publicApiTrustedOrigins.value = origins.join('\n');
            }
            if (elements.publicApiPermissionsSummary) {
                elements.publicApiPermissionsSummary.textContent = formatPublicApiPermissionSummary(permissions);
            }
            if (elements.publicApiTrustStatus) {
                elements.publicApiTrustStatus.textContent = origins.length
                    ? `${numberFormatter.format(origins.length)} trusted origin${origins.length === 1 ? '' : 's'} · ${numberFormatter.format(entries.length)} recent audit entr${entries.length === 1 ? 'y' : 'ies'}`
                    : 'No trusted origins configured.';
            }
            renderPublicApiAuditLog(entries);
            updateSupportSnapshotSummary();
            if (announce) showToast('Public API trust state refreshed', 'success');
            return { origins, permissions, entries };
        } catch (error) {
            const message = error?.message || 'Failed to load public API trust state';
            if (elements.publicApiPermissionsSummary) elements.publicApiPermissionsSummary.textContent = message;
            if (elements.publicApiTrustStatus) elements.publicApiTrustStatus.textContent = 'Public API trust controls unavailable.';
            if (elements.publicApiAuditLog) {
                elements.publicApiAuditLog.innerHTML = `<div class="panel-empty-inline">${escapeHtml(message)}</div>`;
            }
            if (announce) showToast(message, 'error');
            return null;
        }
    }

    function renderSigningTrustList(keys = {}) {
        if (!elements.signingKeysList) return;
        const entries = Object.entries(keys).sort((a, b) => (b[1]?.addedAt || 0) - (a[1]?.addedAt || 0));
        if (!entries.length) {
            elements.signingKeysList.innerHTML = '<div class="panel-empty-inline">No trusted signing keys saved.</div>';
            return;
        }
        elements.signingKeysList.innerHTML = entries
            .map(([publicKey, meta]) => `
                <div class="setting-row" style="margin:0;padding:10px 0;display:flex;justify-content:space-between;align-items:flex-start;gap:12px;border-bottom:1px solid rgba(127,127,127,0.1)">
                    <div style="min-width:0;display:grid;gap:4px">
                        <strong style="color:var(--text-primary)">${escapeHtml(meta?.name || publicKey.slice(0, 12))}</strong>
                        <div class="panel-empty-inline" style="word-break:break-all">${escapeHtml(publicKey)}</div>
                        <div class="panel-empty-inline">Trusted ${escapeHtml(meta?.addedAt ? dateTimeFormatter.format(new Date(meta.addedAt)) : 'recently')}</div>
                    </div>
                    <button type="button" class="btn btn-sm btn-danger" data-untrust-key="${escapeHtml(publicKey)}">Remove Trust</button>
                </div>
            `)
            .join('');

        elements.signingKeysList.querySelectorAll('[data-untrust-key]').forEach(button => {
            button.addEventListener('click', async () => {
                const publicKey = button.dataset.untrustKey;
                const meta = keys[publicKey] || {};
                const label = meta.name || `${publicKey.slice(0, 12)}...`;
                if (!await showConfirmModal('Remove trusted key?', `Stop trusting ${label}? Verified installs from this key will require trust again.`)) {
                    return;
                }
                try {
                    const response = await chrome.runtime.sendMessage({ action: 'signing_untrustKey', data: { publicKey } });
                    if (response?.error) {
                        showToast(response.error, 'error');
                        return;
                    }
                    await loadSigningTrustState();
                    showToast(`Removed trust for ${label}`, 'success');
                } catch (error) {
                    showToast(error?.message || 'Failed to remove trusted key', 'error');
                }
            });
        });
    }

    async function loadSigningTrustState(options = {}) {
        const { announce = false } = options;
        try {
            const response = await chrome.runtime.sendMessage({ action: 'signing_getTrustedKeys' });
            const keys = response?.keys && typeof response.keys === 'object' ? response.keys : {};
            state.trustCenter.signingKeys = keys;
            const count = Object.keys(keys).length;
            if (elements.signingTrustSummary) {
                elements.signingTrustSummary.textContent = count
                    ? `${numberFormatter.format(count)} trusted signing key${count === 1 ? '' : 's'} configured.`
                    : 'No trusted signing keys saved.';
            }
            renderSigningTrustList(keys);
            updateSupportSnapshotSummary();
            if (announce) showToast('Signing trust refreshed', 'success');
            return keys;
        } catch (error) {
            const message = error?.message || 'Failed to load signing trust';
            if (elements.signingTrustSummary) elements.signingTrustSummary.textContent = message;
            if (elements.signingKeysList) {
                elements.signingKeysList.innerHTML = `<div class="panel-empty-inline">${escapeHtml(message)}</div>`;
            }
            if (announce) showToast(message, 'error');
            return null;
        }
    }

    async function refreshUtilitiesDiagnostics(options = {}) {
        const { announce = false } = options;
        await Promise.all([
            loadRuntimeStatus(),
            loadPublicApiTrustState(),
            loadSigningTrustState()
        ]);
        if (announce) showToast('Diagnostics refreshed', 'success');
    }

    function getRecentActivityEntries(limit = 15) {
        return Array.from(document.querySelectorAll('#activityLog .activity-entry'))
            .slice(0, limit)
            .map(entry => entry.textContent.trim())
            .filter(Boolean);
    }

    async function exportSupportSnapshot() {
        if (elements.supportSnapshotStatus) {
            elements.supportSnapshotStatus.textContent = 'Collecting diagnostics…';
        }
        try {
            const provider = normalizeSyncProvider(state.settings);
            const [
                runtimeStatus,
                publicApiData,
                signingKeys,
                errorLog,
                errorGroups,
                networkStats,
                networkLog,
                backupInventory,
                backupSettings
            ] = await Promise.all([
                chrome.runtime.sendMessage({ action: 'getExtensionStatus' }),
                Promise.all([
                    chrome.runtime.sendMessage({ action: 'publicApi_getTrustedOrigins' }),
                    chrome.runtime.sendMessage({ action: 'publicApi_getPermissions' }),
                    chrome.runtime.sendMessage({ action: 'publicApi_getAuditLog', data: { limit: 25 } })
                ]),
                chrome.runtime.sendMessage({ action: 'signing_getTrustedKeys' }),
                chrome.runtime.sendMessage({ action: 'getErrorLog' }),
                chrome.runtime.sendMessage({ action: 'getErrorLogGrouped' }),
                chrome.runtime.sendMessage({ action: 'getNetworkLogStats' }),
                chrome.runtime.sendMessage({ action: 'getNetworkLog' }),
                chrome.runtime.sendMessage({ action: 'getBackups' }),
                chrome.runtime.sendMessage({ action: 'getBackupSettings' })
            ]);

            const [originsResponse, permissionsResponse, auditResponse] = publicApiData;
            const cloudStatus = provider && provider !== 'none'
                ? await chrome.runtime.sendMessage({ action: 'cloudStatus', provider })
                : { connected: false };
            const backups = Array.isArray(backupInventory) ? backupInventory : (backupInventory?.backups || []);
            state.backups = backups.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            state.backupSettings = normalizeBackupSettings(backupSettings);
            const latestBackup = getLatestBackup();
            const totalBackupSize = state.backups.reduce((sum, entry) => sum + Number(entry.size || 0), 0);

            state.trustCenter.runtimeStatus = runtimeStatus || null;
            state.trustCenter.publicApiOrigins = Array.isArray(originsResponse?.origins) ? originsResponse.origins : [];
            state.trustCenter.publicApiPermissions = permissionsResponse?.permissions || {};
            state.trustCenter.publicApiAudit = Array.isArray(auditResponse?.entries) ? auditResponse.entries : [];
            state.trustCenter.signingKeys = signingKeys?.keys || {};

            renderRuntimeStatus(runtimeStatus);
            renderPublicApiAuditLog(state.trustCenter.publicApiAudit);
            renderSigningTrustList(state.trustCenter.signingKeys);

            const snapshot = {
                version: 1,
                exportedAt: new Date().toISOString(),
                extension: {
                    name: chrome.runtime.getManifest().name,
                    version: chrome.runtime.getManifest().version
                },
                runtime: runtimeStatus,
                sync: {
                    enabled: normalizeSyncEnabled(state.settings),
                    provider,
                    lastSyncTime: state.settings.lastSyncTime || null,
                    cloudStatus
                },
                recovery: {
                    schedule: state.backupSettings,
                    inventory: {
                        count: state.backups.length,
                        totalSize: totalBackupSize,
                        totalSizeFormatted: formatBytes(totalBackupSize),
                        latest: latestBackup ? {
                            id: latestBackup.id,
                            timestamp: latestBackup.timestamp || null,
                            reason: latestBackup.reason || 'backup',
                            reasonLabel: formatBackupReason(latestBackup.reason),
                            scope: describeBackupScope(latestBackup),
                            scriptCount: latestBackup.scriptCount || 0,
                            size: latestBackup.size || 0,
                            sizeFormatted: latestBackup.sizeFormatted || formatBytes(latestBackup.size || 0)
                        } : null,
                        recentBackups: state.backups.slice(0, 10).map(backup => ({
                            id: backup.id,
                            timestamp: backup.timestamp || null,
                            reason: backup.reason || 'backup',
                            reasonLabel: formatBackupReason(backup.reason),
                            scope: describeBackupScope(backup),
                            scriptCount: backup.scriptCount || 0,
                            size: backup.size || 0,
                            sizeFormatted: backup.sizeFormatted || formatBytes(backup.size || 0)
                        }))
                    }
                },
                trust: {
                    publicApiOrigins: state.trustCenter.publicApiOrigins,
                    publicApiPermissions: state.trustCenter.publicApiPermissions,
                    publicApiAudit: state.trustCenter.publicApiAudit,
                    trustedSigningKeys: state.trustCenter.signingKeys,
                    deniedHosts: state.settings.deniedHosts || []
                },
                counts: {
                    scripts: state.scripts.length,
                    enabledScripts: state.scripts.filter(script => script.enabled !== false).length,
                    folders: state.folders.length,
                    selectedScripts: state.selectedScripts.size
                },
                diagnostics: {
                    activityLog: getRecentActivityEntries(),
                    errorLog,
                    errorGroups,
                    networkStats,
                    recentNetworkLog: Array.isArray(networkLog) ? networkLog.slice(-25) : networkLog
                },
                scripts: state.scripts.map(script => {
                    const provenance = describeScriptProvenance(script);
                    return {
                        id: script.id,
                        name: script.metadata?.name || script.id,
                        version: script.metadata?.version || null,
                        enabled: script.enabled !== false,
                        provenance: provenance.label,
                        provenanceDetail: provenance.detail,
                        homepage: script.metadata?.homepage || script.metadata?.homepageURL || null,
                        updateURL: script.metadata?.updateURL || null,
                        downloadURL: script.metadata?.downloadURL || null,
                        userModified: !!script.settings?.userModified,
                        syncLock: !!script.settings?.syncLock
                    };
                })
            };

            const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `scriptvault-support-snapshot-${new Date().toISOString().split('T')[0]}.json`;
            anchor.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);

            updateSupportSnapshotSummary();
            if (elements.supportSnapshotStatus) {
                elements.supportSnapshotStatus.textContent = `Exported ${dateTimeFormatter.format(new Date())}`;
            }
            showToast('Support snapshot exported', 'success');
        } catch (error) {
            if (elements.supportSnapshotStatus) {
                elements.supportSnapshotStatus.textContent = error?.message || 'Export failed';
            }
            showToast(error?.message || 'Failed to export support snapshot', 'error');
        }
    }

    function applyConfigMode() {
        applySettingsPanelFilters();
    }

    function getHelpPanelSections() {
        return Array.from(document.querySelectorAll('#helpPanel #helpSections .help-section'));
    }

    function initializeHelpPanelControls() {
        const sections = getHelpPanelSections();
        if (sections.length === 0) return;

        sections.forEach(section => {
            if (!section.dataset.helpGroup) {
                section.dataset.helpGroup = 'reference';
            }
            const titleText = normalizeSettingsLabel(section.querySelector('.shortcuts-title, h2, h3')?.textContent || '');
            const contentText = normalizeSettingsLabel(section.textContent || '');
            section.dataset.helpSearch = `${titleText} ${contentText}`;
        });

        elements.helpFilterButtons?.forEach(button => {
            button.addEventListener('click', () => {
                state.helpPanelFilter = button.dataset.helpFilter || 'all';
                applyHelpPanelFilters();
            });
        });

        elements.helpQuickFilter?.addEventListener('input', () => applyHelpPanelFilters());
        elements.helpActionButtons?.forEach(button => {
            button.addEventListener('click', () => performHelpAction(button.dataset.helpAction || ''));
        });

        applyHelpPanelFilters();
    }

    function updateHelpOverview(visibleCount = null) {
        const total = state.scripts.length;
        const active = state.scripts.filter(s => s.enabled !== false).length;
        const resolvedVisibleCount = visibleCount == null ? getHelpPanelSections().filter(section => !section.hidden).length : visibleCount;
        const actionCount = elements.helpActionButtons?.length || 0;
        const theme = THEME_LABELS[state.settings.layout || 'dark'] || 'Dark';

        if (elements.helpActionSummary) {
            elements.helpActionSummary.textContent = `${numberFormatter.format(actionCount)} launch${actionCount === 1 ? '' : 'es'}`;
        }
        if (elements.helpVisibleSummary) {
            elements.helpVisibleSummary.textContent = `${numberFormatter.format(resolvedVisibleCount)} section${resolvedVisibleCount === 1 ? '' : 's'}`;
        }
        if (elements.helpThemeSummary) {
            elements.helpThemeSummary.textContent = theme;
        }
        if (elements.helpScriptSummary) {
            elements.helpScriptSummary.textContent = total === 0
                ? '0 installed'
                : `${numberFormatter.format(active)}/${numberFormatter.format(total)} active`;
        }
    }

    function applyHelpPanelFilters() {
        const sections = getHelpPanelSections();
        if (sections.length === 0) return;

        const query = normalizeSettingsLabel(elements.helpQuickFilter?.value || '');
        let visibleCount = 0;

        sections.forEach(section => {
            const group = section.dataset.helpGroup || 'reference';
            const matchesGroup = state.helpPanelFilter === 'all' || group === state.helpPanelFilter;
            const matchesQuery = !query || (section.dataset.helpSearch || '').includes(query);
            const shouldShow = matchesGroup && matchesQuery;
            if (shouldShow) visibleCount++;
            section.hidden = !shouldShow;
        });

        syncPressedButtons(
            elements.helpFilterButtons,
            button => (button.dataset.helpFilter || 'all') === state.helpPanelFilter
        );

        if (elements.helpFilterStatus) {
            if (query) {
                elements.helpFilterStatus.textContent = `Showing ${numberFormatter.format(visibleCount)} result${visibleCount === 1 ? '' : 's'} for "${elements.helpQuickFilter?.value?.trim() || ''}".`;
            } else {
                elements.helpFilterStatus.textContent = `Showing ${HELP_FILTER_LABELS[state.helpPanelFilter] || 'all references'}.`;
            }
        }
        if (elements.helpEmptyState) {
            elements.helpEmptyState.hidden = visibleCount !== 0;
        }

        updateHelpOverview(visibleCount);
    }

    function performHelpAction(action) {
        switch (action) {
            case 'new-script':
                createNewScript();
                break;
            case 'import-script':
                importScript();
                break;
            case 'find-scripts':
                openFindScripts();
                break;
            case 'command-palette':
                openCommandPalette();
                break;
            case 'open-settings':
                switchTab('settings');
                break;
            case 'open-utilities':
                switchTab('utilities');
                break;
            case 'open-trash':
                switchTab('trash');
                break;
            case 'check-updates':
                document.getElementById('btnCheckUpdates')?.click();
                break;
            default:
                break;
        }
    }

    // Trash
    function initializeTrashPanelControls() {
        elements.trashFilterButtons?.forEach(button => {
            button.addEventListener('click', () => {
                state.trashPanelFilter = button.dataset.trashFilter || 'all';
                renderTrashList();
            });
        });

        elements.trashQuickFilter?.addEventListener('input', () => renderTrashList());
        updateTrashOverview();
    }

    function getTrashTimestamp(script) {
        const date = new Date(script?.trashedAt || 0);
        const time = date.getTime();
        return Number.isFinite(time) ? time : 0;
    }

    function getTrashMetadata(script) {
        const metadata = script?.metadata || script?.meta || {};
        return {
            name: metadata.name || 'Unnamed',
            version: metadata.version || 'No version',
            author: metadata.author || '',
            description: metadata.description || ''
        };
    }

    function formatTrashRetention(mode = state.settings?.trashMode || 'disabled') {
        if (mode === 'disabled') return 'Disabled';
        const days = parseInt(mode, 10);
        return Number.isFinite(days) ? `${days} day${days === 1 ? '' : 's'}` : 'Manual';
    }

    function formatRelativeTimeLabel(ts) {
        const formatted = formatTime(ts);
        if (formatted === '-') return 'Unknown';
        if (formatted === 'now') return 'Just now';
        return /^\d+[mhd]$/.test(formatted) ? `${formatted} ago` : formatted;
    }

    function getFilteredTrashItems() {
        const query = normalizeSettingsLabel(elements.trashQuickFilter?.value || '');
        return [...state.trashItems]
            .sort((a, b) => getTrashTimestamp(b) - getTrashTimestamp(a))
            .filter(script => {
                const { name, version, author, description } = getTrashMetadata(script);
                const searchText = normalizeSettingsLabel(`${name} ${version} ${author} ${description}`);
                const deletedAt = getTrashTimestamp(script);
                const ageDays = deletedAt ? (Date.now() - deletedAt) / 86400000 : Number.POSITIVE_INFINITY;
                const matchesFilter = state.trashPanelFilter === 'all'
                    || (state.trashPanelFilter === 'recent' && ageDays <= 7)
                    || (state.trashPanelFilter === 'older' && ageDays > 7);
                const matchesQuery = !query || searchText.includes(query);
                return matchesFilter && matchesQuery;
            });
    }

    function setTrashEmptyState(title, description) {
        if (elements.trashEmptyTitle) elements.trashEmptyTitle.textContent = title;
        if (elements.trashEmptyDescription) elements.trashEmptyDescription.textContent = description;
        if (elements.trashEmptyState) elements.trashEmptyState.hidden = false;
        if (elements.trashList) {
            elements.trashList.hidden = true;
            elements.trashList.replaceChildren();
        }
    }

    function updateTrashOverview(visibleCount = null) {
        const total = state.trashItems.length;
        const retentionLabel = formatTrashRetention();
        const latestDeletedAt = state.trashItems.reduce((latest, item) => Math.max(latest, getTrashTimestamp(item)), 0);
        const resolvedVisibleCount = visibleCount == null ? getFilteredTrashItems().length : visibleCount;
        const query = elements.trashQuickFilter?.value?.trim() || '';

        if (elements.trashCountSummary) {
            elements.trashCountSummary.textContent = `${numberFormatter.format(total)} script${total === 1 ? '' : 's'}`;
        }
        if (elements.trashRetentionSummary) {
            elements.trashRetentionSummary.textContent = retentionLabel;
        }
        if (elements.trashLatestSummary) {
            elements.trashLatestSummary.textContent = latestDeletedAt
                ? formatRelativeTimeLabel(latestDeletedAt)
                : 'Never';
        }
        if (elements.btnEmptyTrash) {
            elements.btnEmptyTrash.disabled = total === 0;
        }
        syncPressedButtons(
            elements.trashFilterButtons,
            button => (button.dataset.trashFilter || 'all') === state.trashPanelFilter
        );
        if (elements.trashFilterStatus) {
            if (total === 0) {
                elements.trashFilterStatus.textContent = retentionLabel === 'Disabled'
                    ? 'Trash is disabled. Deleted scripts are removed immediately.'
                    : `Deleted scripts stay here for ${retentionLabel.toLowerCase()} before final cleanup.`;
            } else if (query) {
                elements.trashFilterStatus.textContent = `Showing ${numberFormatter.format(resolvedVisibleCount)} result${resolvedVisibleCount === 1 ? '' : 's'} for "${query}".`;
            } else {
                elements.trashFilterStatus.textContent = `Showing ${TRASH_FILTER_LABELS[state.trashPanelFilter] || 'all deleted scripts'}.`;
            }
        }
    }

    function renderTrashList() {
        if (!elements.trashList) return;

        const filteredTrash = getFilteredTrashItems();
        updateTrashOverview(filteredTrash.length);

        if (state.trashItems.length === 0) {
            const retentionLabel = formatTrashRetention();
            setTrashEmptyState(
                retentionLabel === 'Disabled' ? 'Trash is disabled' : 'Trash is empty',
                retentionLabel === 'Disabled'
                    ? 'Deleted scripts bypass recovery while this policy is off.'
                    : `Deleted scripts will stay here for ${retentionLabel.toLowerCase()} before permanent cleanup.`
            );
            return;
        }

        if (filteredTrash.length === 0) {
            setTrashEmptyState(
                'No deleted scripts matched',
                elements.trashQuickFilter?.value?.trim()
                    ? 'Try a different name, author, or version search.'
                    : 'Switch the time filter to inspect a different recovery window.'
            );
            return;
        }

        if (elements.trashEmptyState) elements.trashEmptyState.hidden = true;
        elements.trashList.hidden = false;

        const fragment = document.createDocumentFragment();
        filteredTrash.forEach(script => {
            const metadata = getTrashMetadata(script);
            const deletedAt = getTrashTimestamp(script);
            const deletedLabel = deletedAt ? formatRelativeTimeLabel(deletedAt) : 'Unknown';
            const deletedExact = deletedAt ? dateTimeFormatter.format(new Date(deletedAt)) : 'Unknown time';
            const item = document.createElement('article');
            item.className = 'trash-item';
            item.innerHTML = `
                <div class="trash-item-main">
                    <div class="trash-item-heading">
                        <div class="trash-item-name">${escapeHtml(metadata.name)}</div>
                        <span class="trash-item-version">${escapeHtml(metadata.version)}</span>
                    </div>
                    ${metadata.description ? `<div class="trash-item-description">${escapeHtml(metadata.description)}</div>` : ''}
                    <div class="trash-item-meta">
                        ${metadata.author ? `<span>${escapeHtml(metadata.author)}</span>` : ''}
                        <span>Deleted ${escapeHtml(deletedLabel)}</span>
                        <span>Removed ${escapeHtml(deletedExact)}</span>
                    </div>
                </div>
                <div class="trash-item-actions">
                    <button type="button" class="btn" data-trash-restore="${script.id}">Restore</button>
                    <button type="button" class="btn btn-danger" data-trash-delete="${script.id}">Delete Forever</button>
                </div>
            `;

            item.querySelector('[data-trash-restore]')?.addEventListener('click', async () => {
                const button = item.querySelector('[data-trash-restore]');
                await runButtonTask(button, async () => {
                    try {
                        const response = await chrome.runtime.sendMessage({ action: 'restoreFromTrash', scriptId: script.id });
                        if (response?.error) {
                            showToast(response.error, 'error');
                            return;
                        }
                        await Promise.all([loadTrash(), loadScripts()]);
                        updateStats();
                        showToast('Script restored', 'success');
                    } catch (error) {
                        console.error('Failed to restore from trash:', error);
                        showToast('Failed to restore script', 'error');
                    }
                }, { busyLabel: 'Restoring…' });
            });

            item.querySelector('[data-trash-delete]')?.addEventListener('click', async () => {
                const button = item.querySelector('[data-trash-delete]');
                await runButtonTask(button, async () => {
                    const confirm = await showConfirmModal(
                        'Delete Forever',
                        `Permanently remove "${metadata.name}" from trash?`
                    );
                    if (!confirm) return;
                    try {
                        const response = await chrome.runtime.sendMessage({ action: 'permanentlyDelete', scriptId: script.id });
                        if (response?.error) {
                            showToast(response.error, 'error');
                            return;
                        }
                        await loadTrash();
                        updateStats();
                        showToast('Permanently deleted', 'success');
                    } catch (error) {
                        console.error('Failed to permanently delete script:', error);
                        showToast('Failed to permanently delete script', 'error');
                    }
                }, { busyLabel: 'Deleting…' });
            });

            fragment.appendChild(item);
        });

        elements.trashList.replaceChildren(fragment);
    }

    async function loadTrash() {
        if (!elements.trashList) return;
        elements.trashList.hidden = false;
        if (elements.trashEmptyState) elements.trashEmptyState.hidden = true;
        elements.trashList.innerHTML = '<div class="panel-empty-inline">Loading deleted scripts…</div>';
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getTrash' });
            state.trashItems = Array.isArray(response?.trash) ? response.trash : [];
            renderTrashList();
        } catch (e) {
            console.error('Failed to load trash:', e);
            state.trashItems = [];
            updateTrashOverview(0);
            if (elements.trashFilterStatus) {
                elements.trashFilterStatus.textContent = 'Trash could not be loaded right now.';
            }
            setTrashEmptyState('Trash unavailable', 'ScriptVault could not load deleted scripts right now.');
        }
    }

    // Scripts
    // Folders
    async function loadFolders() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getFolders' });
            state.folders = response?.folders || [];
        } catch (e) {
            state.folders = [];
        }
    }

    async function createFolder() {
        const name = await showInputModal({
            title: 'New Folder',
            label: 'Folder name',
            placeholder: 'Favorites',
            confirmLabel: 'Create',
            validate: value => value ? '' : 'Enter a folder name.'
        });
        if (!name) return;
        const colors = ['#60a5fa', '#f87171', '#fbbf24', '#a78bfa', '#34d399', '#fb923c'];
        const color = colors[state.folders?.length % colors.length] || '#60a5fa';
        try {
            const res = await chrome.runtime.sendMessage({ action: 'createFolder', name, color });
            if (res?.folder) {
                await loadFolders();
                renderScriptTable();
                showToast('Folder created', 'success');
            }
        } catch (e) { showToast('Failed', 'error'); }
    }

    async function deleteFolder(folderId) {
        if (!await showConfirmModal('Delete Folder', 'Delete this folder? Scripts will not be deleted.')) return;
        try {
            await chrome.runtime.sendMessage({ action: 'deleteFolder', id: folderId });
            await loadFolders();
            renderScriptTable();
            showToast('Folder deleted', 'success');
        } catch (error) {
            showToast('Failed to delete folder', 'error');
        }
    }

    async function moveScriptToFolder(scriptId) {
        const folders = state.folders || [];
        const currentFolder = folders.find(f => f.scriptIds?.includes(scriptId));
        const options = [
            '<option value="">No folder</option>',
            ...folders.map(f => `<option value="${f.id}" ${currentFolder?.id === f.id ? 'selected' : ''}>${escapeHtml(f.name)}</option>`)
        ].join('');

        showModal('Move to Folder', `
            <select class="select-field" id="moveToFolderSelect" style="width:100%;margin-bottom:10px">${options}</select>
        `, [
            { label: 'Move', class: 'btn-primary', callback: async () => {
                const toId = document.getElementById('moveToFolderSelect')?.value || null;
                const fromId = currentFolder?.id || null;
                if (fromId === toId) {
                    hideModal();
                    return;
                }
                try {
                    await chrome.runtime.sendMessage({ action: 'moveScriptToFolder', scriptId, fromFolderId: fromId, toFolderId: toId });
                    await loadFolders();
                    renderScriptTable();
                    showToast(toId ? 'Script moved to folder' : 'Script removed from folder', 'success');
                    hideModal();
                } catch (error) {
                    showToast('Failed to move script', 'error');
                }
            }},
            { label: 'Cancel', callback: () => hideModal() }
        ]);
    }

    async function loadScripts() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getScripts' });
            if (response?.scripts) {
                state.scripts = response.scripts;
                updateTagFilterOptions();
                renderScriptTable();
                updateSupportSnapshotSummary();
            }
        } catch (e) {
            console.error('Failed to load scripts:', e);
        }
    }
    
    // Get filtered and sorted scripts
    // Rebuild tag filter options dynamically
    function updateTagFilterOptions() {
        if (!elements.filterSelect) return;
        const allTags = new Set();
        for (const s of state.scripts) {
            const tags = s.metadata?.tag || s.metadata?.tags || [];
            tags.forEach(t => allTags.add(t));
        }
        // Remove old tag options
        elements.filterSelect.querySelectorAll('option[data-tag]').forEach(o => o.remove());
        // Add tag options
        if (allTags.size > 0) {
            const sep = document.createElement('option');
            sep.disabled = true;
            sep.textContent = '--- Tags ---';
            sep.dataset.tag = '_sep';
            elements.filterSelect.appendChild(sep);
            for (const tag of [...allTags].sort()) {
                const opt = document.createElement('option');
                opt.value = 'tag:' + tag;
                opt.textContent = '#' + tag;
                opt.dataset.tag = tag;
                elements.filterSelect.appendChild(opt);
            }
        }
    }

    function getFilteredScripts() {
        const searchFilter = (elements.scriptSearch?.value || '').toLowerCase();
        const statusFilter = elements.filterSelect?.value || 'all';

        const isCodeSearch = searchFilter.startsWith('code:');
        const effectiveSearch = isCodeSearch ? searchFilter.slice(5) : searchFilter;

        const filtered = state.scripts.filter(s => {
            // Search filter
            const name = s.metadata?.name || '';
            const desc = s.metadata?.description || '';
            const author = s.metadata?.author || '';
            let matchesSearch;
            if (isCodeSearch && effectiveSearch) {
                matchesSearch = (s.code || '').toLowerCase().includes(effectiveSearch);
            } else if (effectiveSearch) {
                matchesSearch = name.toLowerCase().includes(effectiveSearch) ||
                    desc.toLowerCase().includes(effectiveSearch) ||
                    author.toLowerCase().includes(effectiveSearch);
            } else {
                matchesSearch = true;
            }

            // Status filter
            let matchesStatus = true;
            const m = s.metadata || {};
            const grants = m.grant || [];
            const patterns = [...(m.match || []), ...(m.include || [])];

            if (statusFilter === 'enabled') {
                matchesStatus = s.enabled !== false;
            } else if (statusFilter === 'disabled') {
                matchesStatus = s.enabled === false;
            } else if (statusFilter === 'attention') {
                const daysSinceUpdate = s.updatedAt ? Math.floor((Date.now() - s.updatedAt) / 86400000) : 0;
                const isRemoteScript = Boolean(m.updateURL || m.downloadURL);
                const isStale = isRemoteScript && daysSinceUpdate > 180;
                const perfBudget = s.settings?.perfBudget || state.settings.perfBudget || 200;
                const overBudget = Number(s.stats?.avgTime || 0) > perfBudget && Number(s.stats?.runs || 0) > 2;
                matchesStatus = Boolean(
                    s.stats?.errors > 0 ||
                    s.settings?.mergeConflict ||
                    s.settings?.userModified ||
                    isStale ||
                    overBudget
                );
            } else if (statusFilter === 'pinned') {
                matchesStatus = s.settings?.pinned === true;
            } else if (statusFilter === 'local') {
                matchesStatus = s.settings?.userModified === true;
            } else if (statusFilter === 'remote') {
                matchesStatus = Boolean(m.updateURL || m.downloadURL);
            } else if (statusFilter === 'has-errors') {
                matchesStatus = s.stats?.errors > 0;
            } else if (statusFilter === 'has-updates') {
                matchesStatus = !!(m.updateURL || m.downloadURL);
            } else if (statusFilter === 'no-url') {
                matchesStatus = !(m.updateURL || m.downloadURL);
            } else if (statusFilter === 'grant:xhr') {
                matchesStatus = grants.includes('GM_xmlhttpRequest') || grants.includes('GM.xmlHttpRequest');
            } else if (statusFilter === 'grant:storage') {
                matchesStatus = grants.some(g => g.includes('getValue') || g.includes('setValue'));
            } else if (statusFilter === 'grant:style') {
                matchesStatus = grants.includes('GM_addStyle') || grants.includes('GM.addStyle');
            } else if (statusFilter === 'grant:none') {
                matchesStatus = grants.length === 0 || (grants.length === 1 && grants[0] === 'none');
            } else if (statusFilter === 'scope:broad') {
                matchesStatus = patterns.some(p => ['*://*/*', '<all_urls>', 'http://*/*', 'https://*/*'].includes(p) || /^\*:\/\/\*\//.test(p));
            } else if (statusFilter === 'scope:single') {
                const domains = new Set();
                patterns.forEach(p => { const d = p.match(/^(?:\*|https?):\/\/(?:\*\.)?([^/*]+)/); if (d) domains.add(d[1].replace(/^\*\./, '')); });
                matchesStatus = domains.size === 1;
            } else if (statusFilter.startsWith('tag:')) {
                const tag = statusFilter.slice(4);
                const tags = m.tag || m.tags || [];
                matchesStatus = tags.includes(tag);
            }

            return matchesSearch && matchesStatus;
        });

        // Apply sorting
        const col = state.sortColumn;
        const dir = state.sortDirection === 'asc' ? 1 : -1;

        filtered.sort((a, b) => {
            let va, vb;
            switch (col) {
                case 'order':
                    va = a.position ?? 0;
                    vb = b.position ?? 0;
                    break;
                case 'name':
                    va = (a.metadata?.name || '').toLowerCase();
                    vb = (b.metadata?.name || '').toLowerCase();
                    return va.localeCompare(vb) * dir;
                case 'enabled':
                    va = a.enabled !== false ? 1 : 0;
                    vb = b.enabled !== false ? 1 : 0;
                    break;
                case 'version':
                    va = a.metadata?.version || '0';
                    vb = b.metadata?.version || '0';
                    return va.localeCompare(vb, undefined, { numeric: true }) * dir;
                case 'size':
                    va = (a.code || '').length;
                    vb = (b.code || '').length;
                    break;
                case 'lines':
                    va = (a.code || '').split('\n').length;
                    vb = (b.code || '').split('\n').length;
                    break;
                case 'updated':
                    va = a.updatedAt || 0;
                    vb = b.updatedAt || 0;
                    break;
                case 'perf':
                    va = a.stats?.avgTime ?? Infinity;
                    vb = b.stats?.avgTime ?? Infinity;
                    break;
                default:
                    va = a.position ?? 0;
                    vb = b.position ?? 0;
            }
            return (va > vb ? 1 : va < vb ? -1 : 0) * dir;
        });

        // Pinned scripts always sort to top
        filtered.sort((a, b) => {
            const aPinned = a.settings?.pinned ? 1 : 0;
            const bPinned = b.settings?.pinned ? 1 : 0;
            return bPinned - aPinned;
        });

        return filtered;
    }

    // Handle column sort click
    function handleSortClick(column) {
        if (state.sortColumn === column) {
            state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            state.sortColumn = column;
            // Default to desc for time-based columns (newest first)
            state.sortDirection = (column === 'updated' || column === 'perf') ? 'desc' : 'asc';
        }
        updateSortIndicators();
        renderScriptTable();
    }

    // Update sort indicator icons in table headers
    function updateSortIndicators() {
        document.querySelectorAll('.table-sort-button[data-sort]').forEach(button => {
            const indicator = button.querySelector('.sort-indicator');
            const th = button.closest('th');
            const isActive = button.dataset.sort === state.sortColumn;
            const sortLabel = button.dataset.sortLabel || (button.textContent || '').replace(/\s+/g, ' ').trim();
            if (indicator) {
                indicator.className = 'sort-indicator';
                if (isActive) {
                    indicator.classList.add(state.sortDirection);
                }
            }
            if (th) {
                th.setAttribute('aria-sort', isActive
                    ? (state.sortDirection === 'asc' ? 'ascending' : 'descending')
                    : 'none');
            }
            button.setAttribute('aria-pressed', String(isActive));
            button.setAttribute('aria-label', isActive
                ? `Sort by ${sortLabel} (${state.sortDirection === 'asc' ? 'ascending' : 'descending'})`
                : `Sort by ${sortLabel}`);
        });
    }

    function pruneSelectedScripts() {
        if (!(state.selectedScripts instanceof Set)) {
            state.selectedScripts = new Set(Array.isArray(state.selectedScripts) ? state.selectedScripts : []);
        }

        const validIds = new Set((state.scripts || []).map(script => script.id));
        const nextSelection = new Set();
        state.selectedScripts.forEach(id => {
            if (validIds.has(id)) nextSelection.add(id);
        });
        state.selectedScripts = nextSelection;
    }

    function setBulkMasterCheckboxState(checkbox, { allVisibleSelected, someVisibleSelected, hasVisibleScripts }) {
        if (!checkbox) return;
        checkbox.checked = allVisibleSelected;
        checkbox.indeterminate = !allVisibleSelected && someVisibleSelected;
        checkbox.disabled = !hasVisibleScripts;
        checkbox.setAttribute('aria-disabled', String(!hasVisibleScripts));
    }

    function updateBulkActionAvailability(selectionState) {
        const {
            filteredCount,
            visibleSelectedCount,
            hiddenSelectedCount,
            totalSelectedCount,
            allVisibleSelected,
            hasVisibleScripts,
        } = selectionState;

        const hasSelection = totalSelectedCount > 0;
        if (!hasSelection && elements.bulkActionSelect?.value) {
            elements.bulkActionSelect.value = '';
        }
        const hasAction = Boolean(elements.bulkActionSelect?.value);
        const formattedTotalSelected = numberFormatter.format(totalSelectedCount);
        const selectionLabel = totalSelectedCount === 1 ? 'script' : 'scripts';

        if (elements.bulkActionSelect) {
            const selectDisabled = !hasSelection;
            elements.bulkActionSelect.disabled = selectDisabled;
            elements.bulkActionSelect.setAttribute('aria-disabled', String(selectDisabled));
            elements.bulkActionSelect.title = hasSelection
                ? `Choose a bulk action for ${formattedTotalSelected} selected ${selectionLabel}`
                : 'Select scripts to enable bulk actions';
        }

        if (elements.btnBulkApply) {
            const buttonDisabled = !hasSelection || !hasAction;
            elements.btnBulkApply.disabled = buttonDisabled;
            elements.btnBulkApply.setAttribute('aria-disabled', String(buttonDisabled));
            elements.btnBulkApply.textContent = hasAction ? getBulkActionButtonLabel(elements.bulkActionSelect?.value) : 'Apply';
            elements.btnBulkApply.title = !hasSelection
                ? 'Select scripts to enable bulk actions'
                : hasAction
                    ? `Apply the selected bulk action to ${formattedTotalSelected} ${selectionLabel}`
                    : `Choose a bulk action for ${formattedTotalSelected} selected ${selectionLabel}`;
            elements.btnBulkApply.setAttribute('aria-label', elements.btnBulkApply.title);
        }

    }
    
    // Update bulk selection checkboxes
    function updateBulkCheckboxes() {
        const filtered = getFilteredScripts();
        pruneSelectedScripts();
        const filteredIds = new Set(filtered.map(script => script.id));
        let visibleSelectedCount = 0;
        
        // Update individual checkboxes
        document.querySelectorAll('.script-checkbox').forEach(cb => {
            const isChecked = state.selectedScripts.has(cb.dataset.id);
            cb.checked = isChecked;
            const row = cb.closest('tr');
            row?.classList.toggle('row-selected', isChecked);
            row?.setAttribute('aria-selected', String(isChecked));
            if (filteredIds.has(cb.dataset.id) && isChecked) visibleSelectedCount += 1;
        });
        
        // Update select all checkbox
        const filteredCount = filtered.length;
        const totalSelectedCount = state.selectedScripts.size;
        const hiddenSelectedCount = Math.max(0, totalSelectedCount - visibleSelectedCount);
        const allVisibleSelected = filteredCount > 0 && visibleSelectedCount === filteredCount;
        const someVisibleSelected = visibleSelectedCount > 0 && visibleSelectedCount < filteredCount;

        setBulkMasterCheckboxState(elements.bulkSelectAll, {
            allVisibleSelected,
            someVisibleSelected,
            hasVisibleScripts: filteredCount > 0,
        });
        setBulkMasterCheckboxState(elements.selectAllScripts, {
            allVisibleSelected,
            someVisibleSelected,
            hasVisibleScripts: filteredCount > 0,
        });

        updateBulkActionAvailability({
            filteredCount,
            visibleSelectedCount,
            hiddenSelectedCount,
            totalSelectedCount,
            allVisibleSelected,
            hasVisibleScripts: filteredCount > 0,
        });
        if (typeof CardView !== 'undefined' && typeof CardView.syncSelection === 'function') {
            CardView.syncSelection();
        }
    }
    
    // Execute bulk action
    async function executeBulkAction() {
        pruneSelectedScripts();
        const action = elements.bulkActionSelect?.value;
        if (!action) {
            showToast('Please select an action', 'error');
            return;
        }
        
        if (state.selectedScripts.size === 0) {
            showToast('No scripts selected', 'error');
            return;
        }
        
        const ids = Array.from(state.selectedScripts);
        
        switch (action) {
            case 'enable':
                await runBulkScriptOperation(ids, {
                    action,
                    progressTitle: `Enabling ${ids.length} scripts…`,
                    refreshStats: true,
                    task: async scriptId => {
                        const response = await chrome.runtime.sendMessage({ action: 'toggleScript', scriptId, enabled: true });
                        if (response?.error) throw new Error(response.error);
                    }
                });
                break;

            case 'disable':
                await runBulkScriptOperation(ids, {
                    action,
                    progressTitle: `Disabling ${ids.length} scripts…`,
                    refreshStats: true,
                    task: async scriptId => {
                        const response = await chrome.runtime.sendMessage({ action: 'toggleScript', scriptId, enabled: false });
                        if (response?.error) throw new Error(response.error);
                    }
                });
                break;

            case 'export': {
                const exportData = {
                    version: 2,
                    exportedAt: new Date().toISOString(),
                    scripts: state.scripts.filter(s => ids.includes(s.id)).map(s => ({
                        id: s.id,
                        code: s.code,
                        enabled: s.enabled,
                        position: s.position,
                        metadata: s.metadata,
                        settings: s.settings
                    }))
                };
                const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `scriptvault-export-${Date.now()}.json`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                showToast(`Exported ${numberFormatter.format(exportData.scripts.length)} ${exportData.scripts.length === 1 ? 'script' : 'scripts'}`, 'success');
                break;
            }

            case 'update':
                await runBulkScriptOperation(ids, {
                    action,
                    progressTitle: `Checking updates for ${ids.length} scripts…`,
                    task: async scriptId => {
                        const updates = await chrome.runtime.sendMessage({ action: 'checkUpdates', scriptId });
                        if (updates?.error) throw new Error(updates.error);
                        if (!Array.isArray(updates) || updates.length === 0) {
                            return { skipped: true, reason: 'Already up to date' };
                        }
                        const response = await chrome.runtime.sendMessage({ action: 'applyUpdate', scriptId, code: updates[0].code });
                        if (response?.error) throw new Error(response.error);
                    }
                });
                break;

            case 'reset':
                if (!await showConfirmModal('Factory Reset', `Reset settings for ${ids.length} scripts?`)) return;
                await runBulkScriptOperation(ids, {
                    action,
                    progressTitle: `Resetting ${ids.length} scripts…`,
                    task: async scriptId => {
                        const response = await chrome.runtime.sendMessage({ action: 'resetScriptSettings', scriptId });
                        if (response?.error) throw new Error(response.error);
                    }
                });
                break;

            case 'delete':
                if (!await showConfirmModal('Delete Scripts', `Permanently delete ${ids.length} selected script(s)? This cannot be undone.`)) return;
                await runBulkScriptOperation(ids, {
                    action,
                    progressTitle: `Deleting ${ids.length} scripts…`,
                    refreshStats: true,
                    keepFailedSelection: true,
                    task: async scriptId => {
                        const deleted = await deleteScript(scriptId, true);
                        if (!deleted) throw new Error('Delete failed');
                    }
                });
                break;
        }
        
        // Reset dropdown
        if (elements.bulkActionSelect) elements.bulkActionSelect.value = '';
        updateBulkCheckboxes();
    }

    function updateScriptEmptyState(filteredCount) {
        if (!elements.emptyState) return;

        const hasScripts = state.scripts.length > 0;
        const searchQuery = elements.scriptSearch?.value?.trim() || '';
        const filterValue = elements.filterSelect?.value || 'all';
        const hasSearch = searchQuery.length > 0;
        const hasFilter = filterValue !== 'all';

        if (!hasScripts) {
            if (elements.emptyStateTitle) elements.emptyStateTitle.textContent = 'No Userscripts Yet';
            if (elements.emptyStateDescription) {
                elements.emptyStateDescription.textContent = 'Create a new script or import one to build out the workspace.';
            }
            if (elements.emptyStatePrimaryAction) {
                elements.emptyStatePrimaryAction.hidden = false;
                elements.emptyStatePrimaryAction.textContent = 'Create Script';
                elements.emptyStatePrimaryAction.onclick = () => createNewScript();
            }
            if (elements.emptyStateSecondaryAction) {
                elements.emptyStateSecondaryAction.hidden = false;
                elements.emptyStateSecondaryAction.textContent = 'Import Script';
                elements.emptyStateSecondaryAction.onclick = () => importScript();
            }
            return;
        }

        if (filteredCount === 0 && (hasSearch || hasFilter)) {
            if (elements.emptyStateTitle) elements.emptyStateTitle.textContent = 'No Matching Scripts';
            if (elements.emptyStateDescription) {
                const searchDetail = hasSearch ? ` for "${searchQuery}"` : '';
                const filterDetail = hasFilter ? ` under the "${filterValue}" filter` : '';
                elements.emptyStateDescription.textContent = `No scripts matched${searchDetail}${filterDetail}. Clear the current search or filter to see the full workspace.`;
            }
            if (elements.emptyStatePrimaryAction) {
                elements.emptyStatePrimaryAction.hidden = false;
                elements.emptyStatePrimaryAction.textContent = hasSearch && hasFilter ? 'Reset Search & Filter' : hasSearch ? 'Clear Search' : 'Clear Filter';
                elements.emptyStatePrimaryAction.onclick = () => {
                    if (elements.scriptSearch) elements.scriptSearch.value = '';
                    if (elements.filterSelect) elements.filterSelect.value = 'all';
                    renderScriptTable();
                };
            }
            if (elements.emptyStateSecondaryAction) {
                elements.emptyStateSecondaryAction.hidden = true;
                elements.emptyStateSecondaryAction.onclick = null;
            }
            return;
        }

        if (elements.emptyStateTitle) elements.emptyStateTitle.textContent = 'Nothing To Show';
        if (elements.emptyStateDescription) {
            elements.emptyStateDescription.textContent = 'This view is empty right now. Try a different filter or refresh the workspace.';
        }
        if (elements.emptyStatePrimaryAction) {
            elements.emptyStatePrimaryAction.hidden = false;
            elements.emptyStatePrimaryAction.textContent = 'Show All Scripts';
            elements.emptyStatePrimaryAction.onclick = () => {
                if (elements.scriptSearch) elements.scriptSearch.value = '';
                if (elements.filterSelect) elements.filterSelect.value = 'all';
                renderScriptTable();
            };
        }
        if (elements.emptyStateSecondaryAction) {
            elements.emptyStateSecondaryAction.hidden = true;
            elements.emptyStateSecondaryAction.onclick = null;
        }
    }

    function syncCardView(filteredScripts = null) {
        if (typeof CardView === 'undefined' || !_tabInited.has('scripts')) return;
        const scripts = Array.isArray(filteredScripts) ? filteredScripts : getFilteredScripts();
        CardView.render(scripts);
    }

    function queueScriptTableRender(immediate = false) {
        clearTimeout(scriptSearchTimer);
        if (immediate) {
            renderScriptTable();
            return;
        }
        scriptSearchTimer = setTimeout(() => {
            scriptSearchTimer = null;
            renderScriptTable();
        }, SCRIPT_SEARCH_DEBOUNCE_MS);
    }

    function getScriptTableListSize(count) {
        if (count <= 0) return 'empty';
        if (count >= 120) return 'huge';
        if (count >= 60) return 'large';
        if (count >= 18) return 'medium';
        return 'small';
    }

    function syncScriptTableListSize(count) {
        if (!elements.scriptTableBody) return;
        const listSize = getScriptTableListSize(count);
        elements.scriptTableBody.dataset.listSize = listSize;
        const tableContainer = elements.scriptTableBody.closest('.scripts-table-container');
        if (tableContainer) {
            tableContainer.dataset.listSize = listSize;
        }
    }

    function renderScriptTable(filter = '') {
        if (!elements.scriptTableBody) return;
        elements.scriptTableBody.innerHTML = '';
        
        const filtered = getFilteredScripts();
        syncScriptTableListSize(filtered.length);
        syncCardView(filtered);
        updateScriptSearchAffordances();
        updateScriptQuickFilterButtons();
        
        // Update script counter
        if (elements.scriptCounter) {
            const total = state.scripts.length;
            const shown = filtered.length;
            const formattedTotal = numberFormatter.format(total);
            const formattedShown = numberFormatter.format(shown);
            elements.scriptCounter.textContent = total === shown ? `All ${formattedTotal} scripts` : `Showing ${formattedShown} of ${formattedTotal}`;
        }
        updateScriptResultsSummary(filtered);
        syncScriptWorkspaceStateToUrl();

        if (filtered.length === 0) {
            updateScriptEmptyState(filtered.length);
            if (elements.emptyState) elements.emptyState.style.display = 'block';
            return;
        }
        if (elements.emptyState) elements.emptyState.style.display = 'none';

        // Precompute conflict map once (avoids O(n^2) per-row scan)
        _conflictCache = buildConflictMap(state.scripts);

        // Render with folder grouping if folders exist
        const folders = state.folders || [];
        const collapsedFolders = state._collapsedFolders || new Set();
        const fragment = document.createDocumentFragment();

        if (folders.length > 0) {
            // Scripts in folders
            const assignedIds = new Set();
            let rowIdx = 1;

            for (const folder of folders) {
                const folderScripts = filtered.filter(s => folder.scriptIds?.includes(s.id));
                if (folderScripts.length === 0) continue;
                folderScripts.forEach(s => assignedIds.add(s.id));

                // Folder header row
                const collapsed = collapsedFolders.has(folder.id);
                const folderTr = document.createElement('tr');
                folderTr.className = `folder-row${collapsed ? ' collapsed' : ''}`;
                folderTr.dataset.folderId = folder.id;
                folderTr.innerHTML = `<td colspan="13">
                    <span class="folder-icon">\u25BC</span>
                    <span class="folder-color" style="background:${escapeHtml(folder.color)}"></span>
                    ${escapeHtml(folder.name)} <span class="folder-count">(${folderScripts.length})</span>
                    <span class="folder-actions">
                        <button type="button" data-folder-delete="${folder.id}" title="Delete folder" aria-label="Delete folder ${escapeHtml(folder.name)}">Delete</button>
                    </span>
                </td>`;
                folderTr.addEventListener('click', async (e) => {
                    const deleteButton = e.target.closest('[data-folder-delete]');
                    if (deleteButton) {
                        e.stopPropagation();
                        await runButtonTask(deleteButton, () => deleteFolder(folder.id), { busyLabel: 'Deleting…' });
                        return;
                    }
                    if (collapsedFolders.has(folder.id)) collapsedFolders.delete(folder.id);
                    else collapsedFolders.add(folder.id);
                    state._collapsedFolders = collapsedFolders;
                    renderScriptTable();
                });
                fragment.appendChild(folderTr);

                // Scripts in this folder
                if (!collapsed) {
                    for (const script of folderScripts) {
                        fragment.appendChild(createScriptRow(script, rowIdx++));
                    }
                }
            }

            // Unassigned scripts
            const unassigned = filtered.filter(s => !assignedIds.has(s.id));
            if (unassigned.length > 0 && assignedIds.size > 0) {
                const headerTr = document.createElement('tr');
                headerTr.className = 'folder-row';
                headerTr.innerHTML = `<td colspan="13">
                    <span class="folder-icon">\u25BC</span>
                    Uncategorized <span class="folder-count">(${unassigned.length})</span>
                </td>`;
                fragment.appendChild(headerTr);
            }
            for (const script of unassigned) {
                fragment.appendChild(createScriptRow(script, rowIdx++));
            }
        } else {
            // No folders — flat list
            filtered.forEach((script, i) => {
                fragment.appendChild(createScriptRow(script, i + 1));
            });
        }

        elements.scriptTableBody.appendChild(fragment);

        updateBulkCheckboxes();
        applyColumnVisibility();
        if (typeof KeyboardNav !== 'undefined' && typeof KeyboardNav.resetFocus === 'function') {
            KeyboardNav.resetFocus();
        }
    }

    function createScriptRow(script, index) {
        const tr = document.createElement('tr');
        const name = script.metadata?.name || 'Unnamed Script';
        const version = script.metadata?.version || '1.0';
        const enabled = script.enabled !== false;
        const size = formatBytes((script.code || '').length);
        const lineCount = (script.code || '').split('\n').length;
        const matches = [...(script.metadata?.match || []), ...(script.metadata?.include || [])];
        const grants = script.metadata?.grant || [];
        const updated = script.updatedAt ? formatTime(script.updatedAt) : '-';
        const icon = script.metadata?.icon || script.metadata?.iconURL;

        // Get homepage - fallback to derived URL from updateURL/downloadURL
        const homepage = script.metadata?.homepage || script.metadata?.homepageURL || 
                         deriveHomepageUrl(script.metadata?.updateURL) || 
                         deriveHomepageUrl(script.metadata?.downloadURL);

        // Extract unique domains from matches/includes for site icons
        const domains = extractDomainsFromPatterns(matches);
        
        // Generate favicon HTML - use @icon if present, otherwise derive from first domain
        const faviconHtml = generateFaviconHtml(icon, domains[0], name);
        
        // Generate site icons HTML (up to 5 icons with overflow indicator)
        const siteIconsHtml = generateSiteIconsHtml(domains);

        const features = [];
        if (grants.some(g => g.includes('getValue') || g.includes('setValue'))) features.push({ c: 'badge-s', l: 'S' });
        if (grants.includes('GM_xmlhttpRequest')) features.push({ c: 'badge-x', l: 'X' });
        if (grants.includes('GM_addStyle')) features.push({ c: 'badge-c', l: 'C' });
        if (grants.includes('GM_openInTab')) features.push({ c: 'badge-t', l: 'T' });

        // Execution stats
        const stats = script.stats;
        const statsTitle = stats ? `Runs: ${stats.runs} | Avg: ${stats.avgTime}ms | Errors: ${stats.errors}` : 'No execution data yet';
        const speedClass = stats?.avgTime != null ? (stats.avgTime < 50 ? 'fast' : stats.avgTime < 200 ? 'medium' : 'slow') : '';
        const statsHtml = stats && stats.runs > 0
          ? `<span class="exec-stat ${speedClass}" title="${escapeHtml(statsTitle)}">${stats.avgTime}ms</span>${stats.errors > 0 ? `<span class="exec-stat-errors" title="${stats.errors} error(s)">!</span>` : ''}`
          : '';

        // @tag badges
        const tags = script.metadata?.tag || script.metadata?.tags || [];
        const tagHtml = tags.map(t => `<span class="script-tag">${escapeHtml(t)}</span>`).join('');
        const provenance = describeScriptProvenance(script);
        const hasRemoteSource = Boolean(script.metadata?.updateURL || script.metadata?.downloadURL);
        const provenanceBadgeHtml = `<span class="script-origin-badge ${hasRemoteSource ? 'remote' : 'local'}" title="${escapeHtml(provenance.detail || provenance.label)}">${escapeHtml(provenance.label)}</span>`;

        // Conflict detection for table row
        const conflicts = findConflictingScripts(script.id, matches);
        const conflictHtml = conflicts.length > 0
          ? `<span class="conflict-badge" title="Overlaps with: ${escapeHtml(conflicts.map(c => c.name).join(', '))}">! ${conflicts.length}</span>`
          : '';
        const syncConflictHtml = script.settings?.mergeConflict
          ? '<span class="conflict-badge sync-conflict" title="Cloud merge conflict detected. Review this script in the info panel and save it once you are happy with the code.">Sync conflict</span>'
          : '';

        // Health indicators
        const hasErrors = script.stats?.errors > 0;
        const daysSinceUpdate = script.updatedAt ? Math.floor((Date.now() - script.updatedAt) / 86400000) : 0;
        const isStale = daysSinceUpdate > 180 && (script.metadata?.updateURL || script.metadata?.downloadURL);
        const perfBudget = script.settings?.perfBudget || state.settings.perfBudget || 200;
        const overBudget = script.stats?.avgTime > perfBudget && script.stats?.runs > 2;
        const localEditsHtml = script.settings?.userModified
          ? '<span class="script-health-badge warning" title="Local edits are present for this script.">Local edits</span>'
          : '';
        const staleHtml = isStale
          ? '<span class="script-health-badge warning" title="This remote script has not been refreshed in over 180 days.">Stale</span>'
          : '';
        const slowHtml = overBudget
          ? `<span class="script-health-badge warning" title="Average runtime exceeds the current ${escapeHtml(String(perfBudget))}ms budget.">Slow</span>`
          : '';
        const errorHtml = hasErrors
          ? `<span class="script-health-badge alert" title="${escapeHtml(String(script.stats?.errors || 0))} execution error(s) recorded.">Errors</span>`
          : '';
        if (hasErrors) tr.classList.add('row-has-errors');
        if (isStale) tr.classList.add('row-stale');
        if (overBudget) tr.classList.add('row-over-budget');

        const scriptIdAttr = escapeHtml(String(script.id));
        tr.draggable = true;
        tr.dataset.scriptId = script.id;
        tr.innerHTML = `
            <td class="center"><input type="checkbox" class="script-checkbox" data-id="${scriptIdAttr}" aria-label="Select ${escapeHtml(name)}"></td>
            <td class="center drag-handle" title="Drag to reorder" style="cursor:grab;color:var(--text-muted)">⠿</td>
            <td class="center">
                <label class="toggle-switch">
                    <input type="checkbox" class="script-toggle" data-id="${scriptIdAttr}" ${enabled ? 'checked' : ''} aria-label="${enabled ? 'Disable' : 'Enable'} ${escapeHtml(name)}">
                    <span class="toggle-slider"></span>
                </label>
            </td>
            <td>
                <div class="script-name-cell">
                    ${faviconHtml}
                    <div class="script-name-stack">
                        <div class="script-name-row">
                            <button type="button" class="script-name-button" data-id="${scriptIdAttr}" title="${escapeHtml(script.metadata?.description || '')}" aria-label="Open ${escapeHtml(name)} in the editor">
                                <span class="script-name-button-text">${escapeHtml(name)}${isBroadMatch(matches) ? ' <span title="Runs on all or most sites" style="opacity:0.58">🌐</span>' : ''}</span>
                            </button>
                            ${script.metadata?.author ? `<span class="script-author">by ${escapeHtml(script.metadata.author)}</span>` : ''}
                        </div>
                        <div class="script-name-badges">
                            ${provenanceBadgeHtml}
                            ${localEditsHtml}
                            ${errorHtml}
                            ${slowHtml}
                            ${staleHtml}
                            ${tagHtml ? `<div class="script-tags">${tagHtml}</div>` : ''}
                            ${conflictHtml}
                            ${syncConflictHtml}
                        </div>
                    </div>
                </div>
            </td>
            <td class="center">${escapeHtml(version)}</td>
            <td class="center">${size}</td>
            <td class="center">${lineCount}</td>
            <td class="center" title="${escapeHtml(domains.join('\n'))}">${siteIconsHtml}</td>
            <td class="center">
                <div class="feature-badges">${features.map(f => `<span class="badge ${f.c}">${f.l}</span>`).join('')}</div>
            </td>
            <td class="center">${homepage ? `<a href="${escapeHtml(homepage)}" target="_blank" rel="noopener noreferrer" aria-label="Open homepage for ${escapeHtml(name)}">🔗</a>` : '-'}</td>
            <td class="center"><button type="button" class="updated-link" data-action="checkUpdate" data-id="${scriptIdAttr}" title="Check for updates" aria-label="Check for updates for ${escapeHtml(name)}">${updated}</button></td>
            <td class="center">${statsHtml}</td>
            <td class="center">
                <div class="action-icons">
                    <button type="button" class="action-icon ${script.settings?.pinned ? 'pinned' : ''}" title="${script.settings?.pinned ? 'Unpin' : 'Pin to top'}" aria-label="${script.settings?.pinned ? 'Unpin' : 'Pin'} ${escapeHtml(name)}" data-action="pin" data-id="${scriptIdAttr}">
                        <svg viewBox="0 0 24 24" fill="${script.settings?.pinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M12 2L9.1 8.6 2 9.2l5.5 4.8L5.8 21 12 17.3 18.2 21l-1.7-7 5.5-4.8-7.1-.6z"/></svg>
                    </button>
                    <button type="button" class="action-icon" title="Edit" aria-label="Edit ${escapeHtml(name)}" data-action="edit" data-id="${scriptIdAttr}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button type="button" class="action-icon" title="Check for update (right-click: force update)" aria-label="Check for updates for ${escapeHtml(name)}" data-action="updateScript" data-id="${scriptIdAttr}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
                    </button>
                    <button type="button" class="action-icon" title="Export" aria-label="Export ${escapeHtml(name)}" data-action="exportScript" data-id="${scriptIdAttr}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </button>${(script.metadata?.downloadURL || script.metadata?.updateURL) ? `
                    <button type="button" class="action-icon" title="Copy install URL" aria-label="Copy install URL for ${escapeHtml(name)}" data-action="copyUrl" data-id="${scriptIdAttr}" data-url="${escapeHtml(script.metadata.downloadURL || script.metadata.updateURL)}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                    </button>` : ''}
                    <button type="button" class="action-icon" title="Move to folder" aria-label="Move ${escapeHtml(name)} to folder" data-action="moveFolder" data-id="${scriptIdAttr}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                    </button>
                    <button type="button" class="action-icon" title="Delete" aria-label="Delete ${escapeHtml(name)}" data-action="delete" data-id="${scriptIdAttr}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    </button>
                </div>
            </td>
        `;

        tr.querySelector('.script-toggle')?.addEventListener('change', e => {
            toggleScriptEnabled(script.id, e.target.checked, { control: e.target });
        });
        tr.querySelector('.script-checkbox')?.addEventListener('click', e => {
            const checkbox = e.target;
            // Shift+click multi-select
            if (e.shiftKey && state._lastCheckedId) {
                const allRows = [...elements.scriptTableBody.querySelectorAll('.script-checkbox')];
                const lastIdx = allRows.findIndex(cb => cb.dataset.id === state._lastCheckedId);
                const curIdx = allRows.findIndex(cb => cb.dataset.id === script.id);
                if (lastIdx !== -1 && curIdx !== -1) {
                    const start = Math.min(lastIdx, curIdx);
                    const end = Math.max(lastIdx, curIdx);
                    for (let i = start; i <= end; i++) {
                        allRows[i].checked = checkbox.checked;
                        const id = allRows[i].dataset.id;
                        if (checkbox.checked) state.selectedScripts.add(id);
                        else state.selectedScripts.delete(id);
                    }
                }
            } else {
                if (checkbox.checked) state.selectedScripts.add(script.id);
                else state.selectedScripts.delete(script.id);
            }
            state._lastCheckedId = script.id;
            updateBulkCheckboxes();
        });
        tr.querySelector('.script-name-button')?.addEventListener('click', () => openEditorForScript(script.id));
        tr.querySelector('[data-action="edit"]')?.addEventListener('click', () => openEditorForScript(script.id));
        tr.querySelector('[data-action="delete"]')?.addEventListener('click', async () => {
            const name = script.metadata?.name || script.id;
            if (await showConfirmModal(`Delete "${name}"?`, 'This action cannot be undone.')) {
                deleteScript(script.id);
            }
        });
        tr.querySelector('[data-action="exportScript"]')?.addEventListener('click', () => exportSingleScript(script));
        tr.querySelector('[data-action="moveFolder"]')?.addEventListener('click', () => moveScriptToFolder(script.id));
        tr.querySelector('[data-action="copyUrl"]')?.addEventListener('click', async (e) => {
            const url = e.currentTarget.dataset.url;
            if (url) {
                try {
                    await navigator.clipboard.writeText(url);
                    showToast('Install URL copied', 'success');
                } catch {
                    showToast('Copy failed', 'error');
                }
            }
        });
        tr.querySelector('[data-action="pin"]')?.addEventListener('click', async () => {
            const s = state.scripts.find(x => x.id === script.id);
            if (!s) return;
            if (!s.settings) s.settings = {};
            s.settings.pinned = !s.settings.pinned;
            await chrome.runtime.sendMessage({ action: 'setScriptSettings', scriptId: script.id, settings: s.settings });
            renderScriptTable();
            showToast(s.settings.pinned ? 'Pinned' : 'Unpinned', 'success');
        });
        tr.querySelector('[data-action="updateScript"]')?.addEventListener('click', async (e) => {
            await checkScriptForUpdates(script.id, { triggerEl: e.currentTarget });
        });
        // Right-click = force update (bypass HTTP cache)
        tr.querySelector('[data-action="updateScript"]')?.addEventListener('contextmenu', async (e) => {
            e.preventDefault();
            await checkScriptForUpdates(script.id, { force: true, triggerEl: e.currentTarget });
        });
        tr.querySelector('[data-action="checkUpdate"]')?.addEventListener('click', async () => {
            tr.querySelector('[data-action="updateScript"]')?.click();
        });

        // Drag-and-drop reorder
        tr.addEventListener('dragstart', e => {
            tr.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', script.id);
        });
        tr.addEventListener('dragend', () => {
            tr.classList.remove('dragging');
            document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        });
        tr.addEventListener('dragover', e => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const dragging = elements.scriptTableBody?.querySelector('.dragging');
            if (dragging && dragging !== tr) {
                tr.classList.add('drag-over');
            }
        });
        tr.addEventListener('dragleave', () => {
            tr.classList.remove('drag-over');
        });
        tr.addEventListener('drop', async e => {
            e.preventDefault();
            tr.classList.remove('drag-over');
            const draggedId = e.dataTransfer.getData('text/plain');
            const targetId = script.id;
            if (draggedId && draggedId !== targetId) {
                await reorderScripts(draggedId, targetId);
            }
        });

        return tr;
    }

    // Reorder scripts by moving draggedId before targetId
    async function reorderScripts(draggedId, targetId) {
        const ids = state.scripts.map(s => s.id);
        const fromIdx = ids.indexOf(draggedId);
        const toIdx = ids.indexOf(targetId);
        if (fromIdx === -1 || toIdx === -1) return;

        // Move in local array
        const [moved] = state.scripts.splice(fromIdx, 1);
        state.scripts.splice(toIdx, 0, moved);

        // Update positions
        state.scripts.forEach((s, i) => s.position = i);

        // Persist reorder
        const orderedIds = state.scripts.map(s => s.id);
        await chrome.runtime.sendMessage({ action: 'reorderScripts', data: { orderedIds } });

        // Reset sort to order to show the new positions
        state.sortColumn = 'order';
        state.sortDirection = 'asc';
        updateSortIndicators();
        renderScriptTable();
    }

    // Extract unique domains from @match/@include patterns
    function extractDomainsFromPatterns(patterns) {
        const domains = new Set();
        
        for (const pattern of patterns) {
            // Handle common patterns like *://*.example.com/*, https://www.example.com/*, etc.
            let domain = null;
            
            // Match URLs with protocol
            const urlMatch = pattern.match(/^(?:\*|https?|file):\/\/(?:\*\.)?([^\/\*]+)/);
            if (urlMatch) {
                domain = urlMatch[1].replace(/^\*\./, '');
            }
            
            // Handle @include patterns like /^https?:\/\/.*\.example\.com\//
            if (!domain && pattern.startsWith('/')) {
                const regexMatch = pattern.match(/\\?\.?([a-z0-9][-a-z0-9]*(?:\.[a-z0-9][-a-z0-9]*)+)/i);
                if (regexMatch) {
                    domain = regexMatch[1].replace(/\\/g, '');
                }
            }
            
            if (domain && domain !== '*' && !domain.includes('*')) {
                // Clean up domain
                domain = domain.toLowerCase();
                // Remove www. prefix for deduplication
                const cleanDomain = domain.replace(/^www\./, '');
                domains.add(cleanDomain);
            }
        }
        
        return Array.from(domains);
    }

    function getMarkerMode() {
        const mode = state.settings?.faviconService || 'google';
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

    function renderMarkerBadge(baseClass, label, seed, title, mode = getMarkerMode()) {
        const classes = [baseClass, 'marker-badge'];
        if (mode === 'duckduckgo') classes.push('compact');
        if (mode === 'none') classes.push('minimal');
        const hue = hashMarkerSeed(seed || label || title || 'scriptvault');
        const style = mode === 'none' ? '' : ` style="--marker-hue:${hue}"`;
        return `<span class="${classes.join(' ')}"${title ? ` title="${escapeHtml(title)}"` : ''}${style}>${mode === 'none' ? '' : escapeHtml(label)}</span>`;
    }
    
    // Generate favicon HTML for script name column
    // Uses data-favicon-fallback attribute for CSP-compliant error handling
    function generateFaviconHtml(iconUrl, firstDomain, scriptName) {
        const mode = getMarkerMode();
        const maxLetters = mode === 'duckduckgo' ? 1 : 2;
        const fallbackLabel = firstDomain
            ? getDomainBadgeLabel(firstDomain, maxLetters)
            : getScriptBadgeLabel(scriptName, maxLetters);
        const fallbackSeed = firstDomain || scriptName || 'scriptvault';
        const fallbackHue = hashMarkerSeed(fallbackSeed);
        if (iconUrl) {
            // Use the script's @icon directly
            return `<span class="script-favicon" data-fallback-label="${escapeHtml(fallbackLabel)}" data-fallback-hue="${fallbackHue}" data-fallback-mode="${mode}"><img src="${escapeHtml(iconUrl)}" width="16" height="16" alt="" loading="lazy" data-favicon-fallback="true"></span>`;
        }
        return renderMarkerBadge('script-favicon', fallbackLabel, fallbackSeed, firstDomain || scriptName || 'Script', mode);
    }
    
    // Derive homepage URL from updateURL or downloadURL
    function deriveHomepageUrl(url) {
        if (!url) return null;
        
        // GitHub raw URLs: https://github.com/user/repo/raw/... or https://raw.githubusercontent.com/user/repo/...
        const githubMatch = url.match(/^https?:\/\/(?:raw\.githubusercontent\.com|github\.com)\/([^\/]+)\/([^\/]+)/);
        if (githubMatch) {
            return `https://github.com/${githubMatch[1]}/${githubMatch[2]}/`;
        }
        
        // GitLab raw URLs
        const gitlabMatch = url.match(/^https?:\/\/gitlab\.com\/([^\/]+)\/([^\/]+)/);
        if (gitlabMatch) {
            return `https://gitlab.com/${gitlabMatch[1]}/${gitlabMatch[2]}/`;
        }
        
        // GreasyFork/OpenUserJS URLs
        const greasyforkMatch = url.match(/^https?:\/\/(greasyfork\.org|openuserjs\.org)\/[^\/]+\/scripts\/(\d+)/);
        if (greasyforkMatch) {
            return `https://${greasyforkMatch[1]}/scripts/${greasyforkMatch[2]}`;
        }
        
        // For other URLs, try to get the base domain
        try {
            const urlObj = new URL(url);
            // Only return if it looks like a project page, not a CDN
            if (!urlObj.hostname.includes('cdn') && !urlObj.hostname.includes('raw.')) {
                return `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname.split('/').slice(0, 3).join('/')}/`;
            }
        } catch (e) {
            // Invalid URL
        }
        
        return null;
    }

    function renderInfoLink(url) {
        if (!url) return '-';
        const safeUrl = sanitizeUrl(url);
        return safeUrl
            ? `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener">${escapeHtml(url)}</a>`
            : escapeHtml(url);
    }

    function describeScriptProvenance(script) {
        const metadata = script?.metadata || script?.meta || {};
        const downloadUrl = metadata.downloadURL || '';
        const updateUrl = metadata.updateURL || '';
        const homepageUrl = metadata.homepage || metadata.homepageURL || deriveHomepageUrl(downloadUrl) || deriveHomepageUrl(updateUrl) || '';
        const primaryUrl = downloadUrl || updateUrl || homepageUrl || '';
        const provenance = {
            label: 'Local or imported',
            detail: 'No remote update channel is declared.',
            sourceUrl: primaryUrl
        };

        if (primaryUrl) {
            try {
                const host = new URL(primaryUrl).hostname.replace(/^www\./, '');
                provenance.label = host;
                provenance.detail = downloadUrl && updateUrl && downloadUrl !== updateUrl
                    ? 'Separate install and update channels are declared.'
                    : (downloadUrl || updateUrl)
                        ? 'Remote update channel declared in metadata.'
                        : 'Linked from metadata only.';
            } catch (error) {
                provenance.label = 'Remote source';
                provenance.detail = 'Metadata includes an external source URL.';
            }
        }

        if (/greasyfork\.org/i.test(primaryUrl)) {
            provenance.label = 'Greasy Fork';
            provenance.detail = 'Installed from a Greasy Fork update channel.';
        } else if (/openuserjs\.org/i.test(primaryUrl)) {
            provenance.label = 'OpenUserJS';
            provenance.detail = 'Installed from an OpenUserJS update channel.';
        } else if (/(github\.com|raw\.githubusercontent\.com)/i.test(primaryUrl)) {
            provenance.label = 'GitHub';
            provenance.detail = downloadUrl && updateUrl && downloadUrl !== updateUrl
                ? 'Install and update URLs point to GitHub-hosted files.'
                : 'Script metadata points to GitHub-hosted source.';
        } else if (/gitlab\.com/i.test(primaryUrl)) {
            provenance.label = 'GitLab';
            provenance.detail = 'Script metadata points to GitLab-hosted source.';
        } else if (script?.settings?.userModified) {
            provenance.detail = 'Local edits are present; review remote URLs before trusting future updates.';
        }

        if (!primaryUrl && script?.settings?.userModified) {
            provenance.detail = 'Local edits are present and no remote source is declared.';
        }

        return provenance;
    }
    
    // Generate site icons HTML for sites column
    function generateSiteIconsHtml(domains) {
        if (domains.length === 0) {
            return '-';
        }

        const mode = getMarkerMode();
        if (mode === 'none') {
            return `<div class="site-icons"><span class="site-icon site-icon-more" title="${escapeHtml(domains.join('\n'))}">${numberFormatter.format(domains.length)}</span></div>`;
        }

        const maxIcons = 5;
        const displayDomains = domains.slice(0, maxIcons);
        const remainingCount = domains.length - maxIcons;

        let html = '<div class="site-icons">';

        for (const domain of displayDomains) {
            html += renderMarkerBadge(
                'site-icon',
                getDomainBadgeLabel(domain, mode === 'duckduckgo' ? 1 : 2),
                domain,
                domain,
                mode
            );
        }

        if (remainingCount > 0) {
            html += `<span class="site-icon-more" title="${escapeHtml(domains.slice(maxIcons).join('\n'))}">+${remainingCount}</span>`;
        }

        html += '</div>';
        return html;
    }

    // Editor
    function openEditorForScript(scriptId, options = {}) {
        const script = state.scripts.find(s => s.id === scriptId);
        if (!script) return;

        // Lazy-load editor modules (pattern builder, debugger, diff, snippets) on first editor open
        if (typeof LazyLoader !== 'undefined' && !_tabInited.has('_editor')) {
            _tabInited.add('_editor');
            LazyLoader.loadForEditor();
        }

        // Save current editor state before switching
        if (state.currentScriptId && state.editor && state.openTabs[state.currentScriptId]) {
            state.openTabs[state.currentScriptId].code = state.editor.getValue();
            state.openTabs[state.currentScriptId].unsaved = state.unsavedChanges;
        }

        // Create tab if not already open
        if (!state.openTabs[scriptId]) {
            state.openTabs[scriptId] = {
                code: script.code || '',
                unsaved: false,
                saveState: 'clean',
                lastSavedAt: script.updatedAt || null,
                saveError: ''
            };
            createScriptTab(scriptId, script.metadata?.name || 'Unnamed Script');
        }

        // Activate this script tab
        activateScriptTab(scriptId, options);
    }

    function createScriptTab(scriptId, name) {
        const tabBar = document.getElementById('scriptTabsGroup');
        if (!tabBar) return;
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.className = 'tm-tab script-tab';
        tab.dataset.tab = 'script_' + scriptId;
        tab.dataset.scriptId = scriptId;
        tab.innerHTML = `<span class="tab-name">${escapeHtml(name)}</span><span class="tab-close">&times;</span>`;
        tab.classList.toggle('unsaved', !!state.openTabs[scriptId]?.unsaved);
        syncScriptTabAccessibility(tab, {
            name,
            isDirty: !!state.openTabs[scriptId]?.unsaved,
            isActive: state.currentScriptId === scriptId
        });
        tabBar.appendChild(tab);

        tab.addEventListener('click', (e) => {
            if (e.target.closest('.tab-close')) {
                closeScriptTab(scriptId);
            } else {
                // Save current tab state before switching
                if (state.currentScriptId && state.editor && state.openTabs[state.currentScriptId]) {
                    state.openTabs[state.currentScriptId].code = state.editor.getValue();
                    state.openTabs[state.currentScriptId].unsaved = state.unsavedChanges;
                }
                activateScriptTab(scriptId);
            }
        });

        // Middle-click to close (like browser tabs)
        tab.addEventListener('mousedown', (e) => {
            if (e.button === 1) {
                e.preventDefault();
                closeScriptTab(scriptId);
            }
        });

        tab.addEventListener('keydown', (event) => {
            const tabs = getOpenScriptTabs();
            const currentIndex = tabs.indexOf(tab);
            if (currentIndex === -1) return;

            let nextIndex = -1;
            switch (event.key) {
                case 'ArrowLeft':
                    nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
                    break;
                case 'ArrowRight':
                    nextIndex = (currentIndex + 1) % tabs.length;
                    break;
                case 'Home':
                    nextIndex = 0;
                    break;
                case 'End':
                    nextIndex = tabs.length - 1;
                    break;
                case 'Delete':
                case 'Backspace': {
                    event.preventDefault();
                    const fallbackTab = tabs.length > 1
                        ? tabs[currentIndex === tabs.length - 1 ? currentIndex - 1 : currentIndex + 1]
                        : null;
                    closeScriptTab(scriptId, { focusFallbackScriptId: fallbackTab?.dataset.scriptId || null });
                    return;
                }
                default:
                    return;
            }

            event.preventDefault();
            tabs[nextIndex]?.focus();
        });
    }

    function getCurrentScript() {
        return state.currentScriptId ? state.scripts.find(s => s.id === state.currentScriptId) || null : null;
    }

    function ensureOpenTabStatus(scriptId, script = null) {
        if (!scriptId || !state.openTabs[scriptId]) return null;
        const tabData = state.openTabs[scriptId];
        if (typeof tabData.unsaved !== 'boolean') tabData.unsaved = false;
        if (!tabData.saveState) tabData.saveState = tabData.unsaved ? 'dirty' : 'clean';
        if (!Object.prototype.hasOwnProperty.call(tabData, 'lastSavedAt')) {
            tabData.lastSavedAt = script?.updatedAt || null;
        }
        if (!Object.prototype.hasOwnProperty.call(tabData, 'saveError')) {
            tabData.saveError = '';
        }
        return tabData;
    }

    function updateScriptTabVisual(scriptId, isDirty) {
        const tab = getScriptTabElement(scriptId);
        if (tab) {
            tab.classList.toggle('unsaved', !!isDirty);
            syncScriptTabAccessibility(tab, { isDirty });
        }
    }

    function patchOpenTabStatus(scriptId, patch = {}, script = null) {
        const tabData = ensureOpenTabStatus(scriptId, script);
        if (!tabData) return null;
        Object.assign(tabData, patch);
        updateScriptTabVisual(scriptId, tabData.unsaved);
        if (scriptId === state.currentScriptId) {
            state.unsavedChanges = !!tabData.unsaved;
        }
        return tabData;
    }

    function countScriptTargets(script) {
        if (!script) return 0;
        const metadata = script.metadata || {};
        const match = Array.isArray(metadata.match) ? metadata.match.length : 0;
        const include = Array.isArray(metadata.include) ? metadata.include.length : 0;
        return match + include;
    }

    function updateEditorHeader(script = getCurrentScript()) {
        if (!script) return;

        const metadata = script.metadata || {};
        const tabData = ensureOpenTabStatus(script.id, script);
        const saveState = tabData?.saveState || (tabData?.unsaved ? 'dirty' : 'clean');
        const targetCount = countScriptTargets(script);
        const subtitleParts = [
            script.enabled !== false ? 'Enabled' : 'Disabled',
            metadata.version ? `v${metadata.version}` : null,
            metadata.author ? `by ${metadata.author}` : null,
            targetCount > 0 ? `${numberFormatter.format(targetCount)} target${targetCount === 1 ? '' : 's'}` : 'No match rules',
            metadata.runAt ? metadata.runAt.replace(/^document-/, '') : null
        ].filter(Boolean);

        if (elements.editorEyebrow) {
            elements.editorEyebrow.textContent = metadata.downloadURL || metadata.updateURL ? 'Synced Userscript' : 'Userscript Editor';
        }
        if (elements.editorTitle) elements.editorTitle.textContent = metadata.name || 'Edit Script';
        if (elements.editorSubtitle) elements.editorSubtitle.textContent = subtitleParts.join(' • ');

        if (elements.editorSaveState) {
            const stateLabel = saveState === 'dirty' ? 'Unsaved' : saveState === 'saving' ? 'Saving' : saveState === 'error' ? 'Save Failed' : 'Saved';
            elements.editorSaveState.dataset.state = saveState;
            elements.editorSaveState.textContent = stateLabel;
            elements.editorSaveState.title = tabData?.saveError || stateLabel;
        }

        if (elements.editorSavedAt) {
            let detail = 'Ready to edit';
            if (saveState === 'dirty') {
                detail = state.settings.autoSave ? 'Autosaves after 2 seconds' : 'Press Ctrl+S to save';
            } else if (saveState === 'saving') {
                detail = 'Writing changes…';
            } else if (saveState === 'error') {
                detail = tabData?.saveError ? `Retry required: ${tabData.saveError}` : 'Retry save';
            } else if (tabData?.lastSavedAt) {
                detail = `Saved ${formatTime(tabData.lastSavedAt)}`;
            }
            elements.editorSavedAt.textContent = detail;
            elements.editorSavedAt.title = detail;
        }

        if (elements.btnEditorSave) {
            elements.btnEditorSave.dataset.saveState = saveState;
            elements.btnEditorSave.disabled = saveState === 'saving';
            elements.btnEditorSave.classList.toggle('btn-primary', saveState === 'dirty' || saveState === 'saving');
            elements.btnEditorSave.classList.toggle('btn-danger', saveState === 'error');
        }
        if (elements.btnEditorSaveLabel) {
            elements.btnEditorSaveLabel.textContent = saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Retry Save' : 'Save';
        }

        if (elements.btnEditorToggleLabel) {
            elements.btnEditorToggleLabel.textContent = script.enabled !== false ? 'Disable' : 'Enable';
        } else if (elements.btnEditorToggle) {
            elements.btnEditorToggle.textContent = script.enabled !== false ? 'Disable' : 'Enable';
        }

        const wordWrapButton = document.getElementById('tbtnWordWrap');
        if (wordWrapButton && state.editor) {
            wordWrapButton.classList.toggle('active', !!state.editor.getOption('lineWrapping'));
        }
    }

    function markCurrentEditorDirty() {
        if (!state.currentScriptId) return;
        patchOpenTabStatus(state.currentScriptId, {
            unsaved: true,
            saveState: 'dirty',
            saveError: ''
        }, getCurrentScript());
        updateEditorHeader();
    }

    function markScriptSaved(scriptId, savedAt = Date.now()) {
        if (!scriptId) return;
        const script = state.scripts.find(s => s.id === scriptId) || null;
        patchOpenTabStatus(scriptId, {
            unsaved: false,
            saveState: 'clean',
            lastSavedAt: savedAt,
            saveError: ''
        }, script);
        if (scriptId === state.currentScriptId) updateEditorHeader(script);
    }

    function markScriptSavePending(scriptId) {
        if (!scriptId) return;
        const script = state.scripts.find(s => s.id === scriptId) || null;
        patchOpenTabStatus(scriptId, {
            unsaved: true,
            saveState: 'saving',
            saveError: ''
        }, script);
        if (scriptId === state.currentScriptId) updateEditorHeader(script);
    }

    function markScriptSaveFailed(scriptId, message = '') {
        if (!scriptId) return;
        const script = state.scripts.find(s => s.id === scriptId) || null;
        patchOpenTabStatus(scriptId, {
            unsaved: true,
            saveState: 'error',
            saveError: message || 'Failed to save'
        }, script);
        if (scriptId === state.currentScriptId) updateEditorHeader(script);
    }

    function updateLineCount() {
        if (elements.editorLineCount && state.editor) {
            const lines = state.editor.lineCount();
            elements.editorLineCount.textContent = `${numberFormatter.format(lines)} line${lines !== 1 ? 's' : ''}`;
        }
        if (elements.editorCharCount && state.editor) {
            const chars = state.editor.getValue().length;
            elements.editorCharCount.textContent = `${numberFormatter.format(chars)} chars`;
        }
    }

    function updateCursorPos() {
        if (elements.editorCursorPos && state.editor) {
            const cursor = state.editor.getCursor();
            elements.editorCursorPos.textContent = `Ln ${cursor.line + 1}, Col ${cursor.ch + 1}`;
        }
    }

    function activateScriptTab(scriptId, options = {}) {
        const { updateRoute = true } = options;
        const script = state.scripts.find(s => s.id === scriptId);
        if (!script) return;

        const previousScriptId = state.currentScriptId;
        state.currentScriptId = scriptId;
        const tabData = ensureOpenTabStatus(scriptId, script);
        state.unsavedChanges = tabData?.unsaved || false;

        // Deactivate all tabs and panels
        getOpenScriptTabs().forEach(t => {
            t.classList.remove('active');
            syncScriptTabAccessibility(t, { isActive: false });
        });
        clearDashboardSectionSelection();
        closeFindScripts();

        // Activate script tab
        const tab = getScriptTabElement(scriptId);
        if (tab) {
            tab.classList.add('active');
            syncScriptTabAccessibility(tab, { isActive: true });
        }

        // Load editor content
        if (state.editor) {
            // Save outgoing tab's undo history before switching
            if (previousScriptId && state.openTabs[previousScriptId]) {
                try { state.openTabs[previousScriptId]._editorHistory = state.editor.getHistory(); } catch {}
            }
            if (state.editor.isMonaco) state.editor.setScriptId(script.id);
            state.editor.setValue(tabData?.code ?? script.code ?? '');
            // Restore target tab's undo history if available, otherwise clear
            if (tabData?._editorHistory) {
                try { state.editor.setHistory(tabData._editorHistory); } catch { state.editor.clearHistory(); }
            } else {
                state.editor.clearHistory();
            }
            setTimeout(() => state.editor.refresh(), 10);
            updateLineCount();
            updateCursorPos();
        }

        updateEditorHeader(script);
        loadScriptInfo(script);
        loadScriptStorage(script);
        loadExternals(script);
        openEditorOverlay();
        if (updateRoute) {
            setDashboardHash(`script_${encodeURIComponent(scriptId)}`);
        }
        setTimeout(() => state.editor?.focus(), 100);
    }

    function closeScriptTab(scriptId, options = {}) {
        const { focusFallbackScriptId = null } = options;
        const tabData = state.openTabs[scriptId];
        const doClose = () => {
            // Remove tab element
            const tab = getScriptTabElement(scriptId);
            if (tab) tab.remove();

            delete state.openTabs[scriptId];

            // Auto-delete new scripts that were never modified
            const script = state.scripts.find(s => s.id === scriptId);
            if (script && isDefaultTemplate(tabData?.code || script.code || '')) {
                chrome.runtime.sendMessage({ action: 'deleteScript', scriptId }).then(() => {
                    loadScripts();
                    updateStats();
                }).catch(e => console.warn('[ScriptVault] Auto-delete failed:', e.message));
            }

            if (state.currentScriptId === scriptId) {
                state.currentScriptId = null;
                state.unsavedChanges = false;

                // Switch to another open script tab, or back to scripts panel
                const remaining = Object.keys(state.openTabs);
                if (remaining.length > 0) {
                    activateScriptTab(remaining[remaining.length - 1]);
                } else {
                    const restoreTarget = editorLastFocusedElement instanceof HTMLElement && editorLastFocusedElement.isConnected
                        ? editorLastFocusedElement
                        : null;
                    hideEditorOverlay();
                    Promise.resolve(switchTab('scripts', { focusControl: !restoreTarget })).finally(() => {
                        if (restoreTarget) {
                            restoreTarget.focus();
                        }
                    });
                }
            }

            if (focusFallbackScriptId) {
                setTimeout(() => {
                    const fallbackTab = getScriptTabElement(focusFallbackScriptId);
                    if (fallbackTab instanceof HTMLElement) {
                        fallbackTab.focus();
                        return;
                    }
                    document.getElementById('tabNewScript')?.focus?.();
                }, 0);
            }
        };

        // Check for unsaved changes (skip if noSaveConfirm setting is enabled)
        if (tabData?.unsaved && !state.settings.noSaveConfirm) {
            showConfirmModal('Unsaved Changes', 'You have unsaved changes. Close without saving?')
                .then(confirmed => {
                    if (confirmed) doClose();
                });
            return;
        }
        doClose();
    }

    function closeEditor() {
        if (state.currentScriptId) {
            closeScriptTab(state.currentScriptId);
        } else {
            hideEditorOverlay({ restoreFocus: true });
        }
    }

    function isDefaultTemplate(code) {
        const trimmed = code.trim();
        return trimmed.includes('// @name        New Script') &&
               trimmed.includes('// Your code here...') &&
               trimmed.split('\n').filter(l => l.trim() && !l.trim().startsWith('//') && l.trim() !== '(function() {' && l.trim() !== "'use strict';" && l.trim() !== '})();').length === 0;
    }

    function loadScriptInfo(script) {
        const m = script.metadata || {};
        if (elements.infoName) elements.infoName.textContent = m.name || '-';
        if (elements.infoVersion) elements.infoVersion.textContent = m.version || '-';
        if (elements.infoAuthor) elements.infoAuthor.textContent = m.author || '-';
        if (elements.infoDescription) elements.infoDescription.textContent = m.description || '-';

        const hp = m.homepage || m.homepageURL || deriveHomepageUrl(m.downloadURL) || deriveHomepageUrl(m.updateURL);
        if (elements.infoHomepage) elements.infoHomepage.innerHTML = renderInfoLink(hp);

        const updateUrl = m.updateURL || '';
        const downloadUrl = m.downloadURL || '';
        if (elements.infoUpdateUrl) elements.infoUpdateUrl.innerHTML = renderInfoLink(updateUrl);
        if (elements.infoDownloadUrl) elements.infoDownloadUrl.innerHTML = renderInfoLink(downloadUrl);
        if (elements.infoProvenance) {
            const provenance = describeScriptProvenance(script);
            elements.infoProvenance.innerHTML = `<strong>${escapeHtml(provenance.label)}</strong>${provenance.detail ? `<div class="panel-empty-inline" style="margin-top:4px">${escapeHtml(provenance.detail)}</div>` : ''}`;
        }

        // @contributionURL
        const contribEl = document.getElementById('infoContributionURL');
        if (contribEl) {
            const cu = m.contributionURL || '';
            const safeCu = cu ? sanitizeUrl(cu) : null;
            contribEl.innerHTML = safeCu ? `<a href="${escapeHtml(safeCu)}" target="_blank">${escapeHtml(cu)}</a>` : (cu ? escapeHtml(cu) : '-');
        }

        // @compatible / @incompatible
        const compatEl = document.getElementById('infoCompatible');
        if (compatEl) {
            const compat = m.compatible || [];
            const incompat = m.incompatible || [];
            if (compat.length || incompat.length) {
                const compatHtml = compat.map(c => `<span class="info-tag success">✓ ${escapeHtml(c)}</span>`).join('');
                const incompatHtml = incompat.map(c => `<span class="info-tag error">✗ ${escapeHtml(c)}</span>`).join('');
                compatEl.innerHTML = compatHtml + incompatHtml;
            } else {
                compatEl.innerHTML = '<span class="panel-empty-inline">Not specified</span>';
            }
        }

        // @license
        const licenseEl = document.getElementById('infoLicense');
        if (licenseEl) licenseEl.textContent = m.license || m.copyright || '-';

        const grants = m.grant || [];
        if (elements.infoGrants) elements.infoGrants.innerHTML = grants.length ? grants.map(g => `<span class="info-tag grant">${escapeHtml(g)}</span>`).join('') : '<span class="info-tag">none</span>';

        const matches = [...(m.match || []), ...(m.include || [])];
        if (elements.infoMatches) elements.infoMatches.innerHTML = matches.length ? matches.map(x => `<span class="info-tag">${escapeHtml(x)}</span>`).join('') : '<span class="panel-empty-inline">No match rules</span>';

        const res = [...(Array.isArray(m.resource) ? m.resource : []), ...(Array.isArray(m.require) ? m.require : [])];
        if (elements.infoResources) {
            elements.infoResources.innerHTML = res.length
                ? `<div class="info-resource-list">${res.map(r => {
                    const raw = typeof r === 'string' ? r : r.url || r.name || '';
                    const safeUrl = sanitizeUrl(typeof r === 'string' ? (r.split(/\s+/)[1] || r) : (r.url || ''));
                    const display = escapeHtml(raw);
                    return `<div class="info-resource-row">${safeUrl ? `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener">${display}</a>` : display}</div>`;
                }).join('')}</div>`
                : '<span class="panel-empty-inline">No external resources declared</span>';
        }

        // Performance stats
        const perfEl = document.getElementById('infoPerfStats');
        const resetBtn = document.getElementById('btnResetStats');
        if (perfEl) {
            const s = script.stats;
            if (s && s.runs > 0) {
                const lastRun = s.lastRun ? fullDateFormatter.format(new Date(s.lastRun)) : '-';
                perfEl.innerHTML = `
                    <span class="perf-label">Runs:</span><span class="perf-value">${numberFormatter.format(s.runs)}</span>
                    <span class="perf-label">Avg Time:</span><span class="perf-value">${numberFormatter.format(s.avgTime)}ms</span>
                    <span class="perf-label">Total Time:</span><span class="perf-value">${numberFormatter.format(Math.round(s.totalTime))}ms</span>
                    <span class="perf-label">Errors:</span><span class="perf-value">${numberFormatter.format(s.errors)}${s.lastError ? ` (${escapeHtml(s.lastError)})` : ''}</span>
                    <span class="perf-label">Last Run:</span><span class="perf-value">${escapeHtml(lastRun)}</span>
                    ${s.lastUrl ? `<span class="perf-label">Last URL:</span><span class="perf-value">${escapeHtml(s.lastUrl)}</span>` : ''}
                `;
                if (resetBtn) {
                    resetBtn.style.display = '';
                    resetBtn.onclick = async () => {
                        await chrome.runtime.sendMessage({ action: 'resetScriptStats', data: { scriptId: script.id } });
                        script.stats = { runs: 0, totalTime: 0, avgTime: 0, lastRun: 0, errors: 0 };
                        loadScriptInfo(script);
                        renderScriptTable();
                        showToast('Stats reset');
                    };
                }
            } else {
                perfEl.innerHTML = '<span class="panel-empty-inline">No execution data yet</span>';
                if (resetBtn) resetBtn.style.display = 'none';
            }
        }

        // Conflict detection
        const conflictsEl = document.getElementById('infoConflicts');
        if (conflictsEl) {
            const myPatterns = [...(m.match || []), ...(m.include || [])];
            const conflicts = findConflictingScripts(script.id, myPatterns);
            const conflictCards = [];
            if (script.settings?.mergeConflict) {
                conflictCards.push(`
                    <div class="conflict-list-item">
                        <span>
                            <strong>Cloud merge conflict</strong>
                            <div class="panel-empty-inline" style="margin-top:4px">This script was marked during cloud merge. Review the code, then save it once you are happy with the local version to clear the conflict flag.</div>
                        </span>
                        <span class="info-tag error">Review required</span>
                    </div>
                `);
            }
            if (conflicts.length > 0) {
                conflictCards.push(...conflicts.map(c =>
                    `<div class="conflict-list-item">${escapeHtml(c.name)} <span class="panel-empty-inline">(${escapeHtml(c.sharedPatterns.join(', '))})</span></div>`
                ));
            }
            if (conflictCards.length > 0) {
                conflictsEl.innerHTML = `<div class="conflict-list">${conflictCards.join('')}</div>`;
            } else {
                conflictsEl.innerHTML = '<span class="panel-empty-inline">No sync or matcher conflicts detected</span>';
            }
        }

        // Version history / rollback
        const historyEl = document.getElementById('infoVersionHistory');
        if (historyEl) {
            const history = script.versionHistory || [];
            if (history.length > 0) {
                historyEl.innerHTML = `<div class="version-history-list">${history.map((h, idx) =>
                    `<div class="version-history-item">
                        <span class="version-history-ver">v${escapeHtml(h.version)}</span>
                        <span class="version-history-date">${formatTime(h.updatedAt)}</span>
                        <button class="toolbar-btn version-rollback-btn" data-rollback-idx="${idx}" title="Rollback to this version">Rollback</button>
                        <button class="toolbar-btn version-diff-btn" data-diff-idx="${idx}" title="View diff with current code">Diff</button>
                    </div>`
                ).reverse().join('')}</div>`;

                historyEl.querySelectorAll('.version-rollback-btn').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const idx = parseInt(btn.dataset.rollbackIdx);
                        const ver = history[idx]?.version || '?';
                        if (!await showConfirmModal('Rollback', `Rollback to v${ver}? Current code will be lost.`)) return;
                        try {
                            const res = await chrome.runtime.sendMessage({ action: 'rollbackScript', scriptId: script.id, index: idx });
                            if (res?.success) {
                                await loadScripts();
                                const updated = state.scripts.find(s => s.id === script.id);
                                if (updated) {
                                    loadScriptInfo(updated);
                                    if (state.editor && state.currentScriptId === script.id) {
                                        state.editor.setValue(updated.code);
                                        markScriptSaved(script.id, Date.now());
                                    }
                                }
                                showToast('Rolled back to v' + ver, 'success');
                            } else {
                                showToast(res?.error || 'Rollback failed', 'error');
                            }
                        } catch (e) {
                            showToast('Rollback failed', 'error');
                        }
                    });
                });
                // Diff buttons
                historyEl.querySelectorAll('.version-diff-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const idx = parseInt(btn.dataset.diffIdx);
                        const oldCode = history[idx]?.code || '';
                        const newCode = script.code || '';
                        showDiffView(oldCode, newCode, `v${history[idx]?.version || '?'}`, `v${(script.metadata || script.meta || {}).version || 'current'}`);
                    });
                });
            } else {
                historyEl.innerHTML = '<span class="panel-empty-inline">No previous versions</span>';
            }
        }
    }

    function showDiffView(oldCode, newCode, oldLabel, newLabel) {
        const oldLines = oldCode.split('\n');
        const newLines = newCode.split('\n');

        // Myers-like O(ND) diff: compute edit script via LCS
        const n = oldLines.length, m = newLines.length;
        // For very large files, fall back to simple positional comparison
        const useSimple = n + m > 10000;
        const ops = []; // {type: 'eq'|'del'|'add', oldIdx, newIdx}
        if (useSimple) {
            const maxLen = Math.max(n, m);
            for (let i = 0; i < maxLen; i++) {
                if (i >= n) ops.push({ type: 'add', newIdx: i });
                else if (i >= m) ops.push({ type: 'del', oldIdx: i });
                else if (oldLines[i] !== newLines[i]) { ops.push({ type: 'del', oldIdx: i }); ops.push({ type: 'add', newIdx: i }); }
                else ops.push({ type: 'eq', oldIdx: i, newIdx: i });
            }
        } else {
            // Build LCS table
            const dp = [];
            for (let i = 0; i <= n; i++) { dp[i] = new Uint16Array(m + 1); }
            for (let i = 1; i <= n; i++) {
                for (let j = 1; j <= m; j++) {
                    dp[i][j] = oldLines[i - 1] === newLines[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
                }
            }
            // Backtrack to produce edit script
            let i = n, j = m;
            const revOps = [];
            while (i > 0 || j > 0) {
                if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
                    revOps.push({ type: 'eq', oldIdx: i - 1, newIdx: j - 1 }); i--; j--;
                } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
                    revOps.push({ type: 'add', newIdx: j - 1 }); j--;
                } else {
                    revOps.push({ type: 'del', oldIdx: i - 1 }); i--;
                }
            }
            for (let k = revOps.length - 1; k >= 0; k--) ops.push(revOps[k]);
        }

        let diffHtml = '';
        let additions = 0, deletions = 0, unchanged = 0;
        let oldLn = 0, newLn = 0;

        // Identify which ops are near a change for context display
        const isChange = ops.map(o => o.type !== 'eq');
        const nearChange = new Uint8Array(ops.length);
        for (let i = 0; i < ops.length; i++) {
            if (isChange[i]) { for (let j = Math.max(0, i - 3); j <= Math.min(ops.length - 1, i + 3); j++) nearChange[j] = 1; }
        }

        for (let i = 0; i < ops.length; i++) {
            const op = ops[i];
            if (op.type === 'del') {
                oldLn++;
                diffHtml += `<div class="diff-line diff-del"><span class="diff-ln">${oldLn}</span><span class="diff-sign">-</span><span class="diff-text">${escapeHtml(oldLines[op.oldIdx] || '')}</span></div>`;
                deletions++;
            } else if (op.type === 'add') {
                newLn++;
                diffHtml += `<div class="diff-line diff-add"><span class="diff-ln">${newLn}</span><span class="diff-sign">+</span><span class="diff-text">${escapeHtml(newLines[op.newIdx] || '')}</span></div>`;
                additions++;
            } else {
                oldLn++; newLn++;
                unchanged++;
                if (nearChange[i]) {
                    diffHtml += `<div class="diff-line diff-ctx"><span class="diff-ln">${newLn}</span><span class="diff-sign"> </span><span class="diff-text">${escapeHtml(newLines[op.newIdx] || '')}</span></div>`;
                }
            }
        }

        const summary = `<div class="diff-summary"><span class="diff-add-count">+${additions}</span> <span class="diff-del-count">-${deletions}</span> <span class="diff-unch-count">${unchanged} unchanged</span></div>`;
        const header = `<div class="diff-header"><span>${escapeHtml(oldLabel)}</span> vs <span>${escapeHtml(newLabel)}</span></div>`;

        showModal('Version Diff', `${header}${summary}<div class="diff-container">${diffHtml || '<div style="padding:20px;text-align:center;color:var(--text-muted)">No differences found</div>'}</div>`, [
            { label: 'Close', callback: () => hideModal() }
        ]);
    }

    // Precomputed conflict cache (rebuilt each render, avoids O(n^2) per row)
    let _conflictCache = {};

    function buildConflictMap(scripts) {
        const patternToScripts = {};
        const normalizePattern = p => p.replace(/\s+/g, '').toLowerCase();

        for (const s of scripts) {
            const m = s.metadata || {};
            const patterns = [...(m.match || []), ...(m.include || [])];
            for (const p of patterns) {
                const norm = normalizePattern(p);
                if (!patternToScripts[norm]) patternToScripts[norm] = [];
                patternToScripts[norm].push({ id: s.id, name: m.name || 'Unnamed Script', pattern: p });
            }
        }

        // Build per-script conflict list
        const result = {};
        for (const s of scripts) {
            const m = s.metadata || {};
            const patterns = [...(m.match || []), ...(m.include || [])];
            const conflicts = [];
            const seen = new Set();
            for (const p of patterns) {
                const norm = normalizePattern(p);
                const others = patternToScripts[norm] || [];
                for (const o of others) {
                    if (o.id === s.id || seen.has(o.id)) continue;
                    seen.add(o.id);
                    const shared = patterns.filter(pp =>
                        (patternToScripts[normalizePattern(pp)] || []).some(x => x.id === o.id)
                    );
                    conflicts.push({ name: o.name, sharedPatterns: shared.slice(0, 3) });
                }
            }
            if (conflicts.length > 0) result[s.id] = conflicts;
        }
        return result;
    }

    // Find scripts with overlapping @match/@include patterns (uses precomputed cache)
    function findConflictingScripts(scriptId, patterns) {
        if (!patterns.length) return [];
        return _conflictCache[scriptId] || [];
    }

    function loadExternals(script) {
        const m = script.metadata || script.meta || {};
        const requires = Array.isArray(m.require) ? m.require : [];
        const resources = Array.isArray(m.resource) ? m.resource : [];

        if (elements.externalRequireList) {
            if (requires.length === 0) {
                elements.externalRequireList.innerHTML = '<div class="panel-empty"><strong>No @require directives</strong><span>This script does not import external libraries yet.</span></div>';
            } else {
                elements.externalRequireList.innerHTML = requires.map((url, index) => {
                    const safeUrl = sanitizeUrl(typeof url === 'string' ? url : url.url || '');
                    const display = escapeHtml(typeof url === 'string' ? url : url.url || url.name || '');
                    return `<div class="external-item">
                        <div class="external-item-meta">
                            <div class="external-item-name">@require ${numberFormatter.format(index + 1)}</div>
                            <div class="external-item-url">${safeUrl ? `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener">${display}</a>` : display}</div>
                        </div>
                    </div>`;
                }).join('');
            }
        }

        if (elements.externalResourceList) {
            if (resources.length === 0) {
                elements.externalResourceList.innerHTML = '<div class="panel-empty"><strong>No @resource directives</strong><span>There are no named external assets attached to this script.</span></div>';
            } else {
                elements.externalResourceList.innerHTML = resources.map(res => {
                    const name = typeof res === 'string' ? res.split(/\s+/)[0] : (res.name || '');
                    const url = typeof res === 'string' ? (res.split(/\s+/)[1] || res) : (res.url || '');
                    const safeUrl = sanitizeUrl(url);
                    return `<div class="external-item">
                        <div class="external-item-meta">
                            <div class="external-item-name">${escapeHtml(name || '@resource')}</div>
                            <div class="external-item-url">${safeUrl ? `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener">${escapeHtml(url)}</a>` : escapeHtml(url)}</div>
                        </div>
                    </div>`;
                }).join('');
            }
        }
    }

    async function loadScriptStorage(script) {
        if (!elements.storageList) return;
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getScriptValues', scriptId: script.id });
            const values = response?.values || {};
            const keys = Object.keys(values);

            elements.storageList.innerHTML = '';
            if (keys.length === 0) {
                elements.storageList.innerHTML = '<div class="panel-empty"><strong>No stored values</strong><span>This script has not written anything to persistent storage yet.</span></div>';
            } else {
                keys.forEach(key => {
                    const item = createStorageItem(script.id, key, values[key]);
                    elements.storageList.appendChild(item);
                });
            }

            if (elements.storageSizeInfo) elements.storageSizeInfo.textContent = `${formatBytes(JSON.stringify(values).length)} used`;
        } catch (e) {
            console.error('Failed to load storage:', e);
        }
    }

    function createStorageItem(scriptId, key, value) {
        const item = document.createElement('div');
        item.className = 'storage-item';
        const valStr = value == null ? '' : (typeof value === 'object' ? JSON.stringify(value) : String(value));
        let currentKey = key;

        item.innerHTML = `
            <button type="button" class="storage-key storage-key-button" title="Rename storage key">${escapeHtml(key)}</button>
            <input type="text" class="input-field storage-input" value="${escapeHtml(valStr)}">
            <div class="btn-group storage-item-actions">
                <button type="button" class="btn btn-sm" title="Save value">Save</button>
                <button type="button" class="btn btn-sm" title="Rename key">Rename</button>
                <button type="button" class="btn btn-sm btn-danger" title="Delete value">Delete</button>
            </div>
        `;

        const keySpan = item.querySelector('.storage-key');

        item.querySelector('.btn:first-of-type')?.addEventListener('click', async () => {
            let newVal = item.querySelector('.input-field').value;
            try { newVal = JSON.parse(newVal); } catch (e) {}
            await chrome.runtime.sendMessage({ action: 'setScriptValue', scriptId, key: currentKey, value: newVal });
            await loadScriptStorage(state.scripts.find(s => s.id === scriptId) || { id: scriptId });
            showToast('Saved', 'success');
        });

        // Rename button
        item.querySelectorAll('.btn')[1]?.addEventListener('click', async () => {
            const newKey = await showInputModal({
                title: 'Rename Value',
                label: 'Storage key',
                value: currentKey,
                confirmLabel: 'Rename',
                validate: value => {
                    if (!value) return 'Enter a storage key.';
                    if (value === currentKey) return 'Choose a different key name.';
                    return '';
                }
            });
            if (!newKey || newKey === currentKey) return;
            const res = await chrome.runtime.sendMessage({ action: 'renameScriptValue', scriptId, oldKey: currentKey, newKey });
            if (res?.success) {
                currentKey = newKey;
                keySpan.textContent = newKey;
                await loadScriptStorage(state.scripts.find(s => s.id === scriptId) || { id: scriptId });
                showToast('Key renamed', 'success');
            } else {
                showToast(res?.error || 'Rename failed', 'error');
            }
        });

        // Rename on key span click too
        keySpan?.addEventListener('click', () => item.querySelectorAll('.btn')[1]?.click());

        item.querySelector('.btn-danger')?.addEventListener('click', async () => {
            if (await showConfirmModal('Delete', `Delete "${currentKey}"?`)) {
                await chrome.runtime.sendMessage({ action: 'deleteScriptValue', scriptId, key: currentKey });
                await loadScriptStorage(state.scripts.find(s => s.id === scriptId) || { id: scriptId });
                showToast('Deleted', 'success');
            }
        });

        return item;
    }

    // Script operations
    async function toggleScriptEnabled(scriptId, enabled, options = {}) {
        const control = options.control instanceof HTMLElement ? options.control : null;
        const script = state.scripts.find(s => s.id === scriptId);
        const previousEnabled = script ? script.enabled !== false : !enabled;
        const previousDisabled = control?.matches('input, button') ? control.disabled : false;
        const previousAriaBusy = control?.getAttribute?.('aria-busy') ?? null;
        try {
            if (control?.matches('input, button')) {
                control.disabled = true;
                control.setAttribute('aria-busy', 'true');
            }
            const response = await chrome.runtime.sendMessage({ action: 'toggleScript', scriptId, enabled });
            if (response?.error) throw new Error(response.error);
            if (script) script.enabled = enabled;
            if (scriptId === state.currentScriptId) {
                updateEditorHeader(script || getCurrentScript());
            }
            renderScriptTable();
            updateStats();
            showToast(enabled ? 'Enabled' : 'Disabled', 'success');
            return true;
        } catch (e) {
            if (script) script.enabled = previousEnabled;
            if (control instanceof HTMLInputElement && control.isConnected) {
                control.checked = previousEnabled;
            }
            renderScriptTable();
            showToast('Failed to update script status', 'error');
            return false;
        } finally {
            if (control?.matches('input, button') && control.isConnected) {
                control.disabled = previousDisabled;
                if (previousAriaBusy == null) {
                    control.removeAttribute('aria-busy');
                } else {
                    control.setAttribute('aria-busy', previousAriaBusy);
                }
            }
        }
    }

    async function saveCurrentScript() {
        const savingScriptId = state.currentScriptId;
        if (!savingScriptId || !state.editor) return;
        markScriptSavePending(savingScriptId);
        try {
            let code = state.editor.getValue();
            // Trim trailing whitespace if setting enabled
            if (state.settings.trimWhitespace) {
                code = code.split('\n').map(line => line.replace(/\s+$/, '')).join('\n');
                state.editor.setValue(code);
                updateLineCount();
                updateCursorPos();
            }
            const saveResult = await chrome.runtime.sendMessage({ action: 'saveScript', scriptId: savingScriptId, code, markModified: true });
            if (saveResult?.error) throw new Error(saveResult.error);

            // Reload script list FIRST, then mark as saved
            await loadScripts();

            // Only mark unsaved=false after everything succeeded — use captured ID
            if (state.openTabs[savingScriptId]) {
                state.openTabs[savingScriptId].code = code;
            }
            const script = state.scripts.find(s => s.id === savingScriptId);
            if (script) {
                if (state.currentScriptId === savingScriptId) loadScriptInfo(script);
                const name = script.metadata?.name || 'Edit Script';
                if (state.currentScriptId === savingScriptId && elements.editorTitle) elements.editorTitle.textContent = name;
                // Update tab name
                const tab = getScriptTabElement(savingScriptId);
                if (tab) {
                    tab.classList.remove('unsaved');
                    const tabName = tab.querySelector('.tab-name');
                    if (tabName) tabName.textContent = name;
                    syncScriptTabAccessibility(tab, {
                        name,
                        isDirty: false,
                        isActive: state.currentScriptId === savingScriptId
                    });
                }
            }
            markScriptSaved(savingScriptId, Date.now());
            showToast('Saved', 'success');
        } catch (e) {
            markScriptSaveFailed(savingScriptId, e?.message || 'Failed to save');
            showToast('Failed to save', 'error');
        }
    }

    async function duplicateCurrentScript() {
        if (!state.currentScriptId) return;
        try {
            const response = await chrome.runtime.sendMessage({ action: 'duplicateScript', scriptId: state.currentScriptId });
            if (response?.success) {
                await loadScripts();
                closeEditor();
                openEditorForScript(response.newScriptId);
                showToast('Duplicated', 'success');
            }
        } catch (e) {
            showToast('Failed', 'error');
        }
    }

    async function deleteScript(scriptId, skipReload = false) {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'deleteScript', scriptId });
            if (response?.error) throw new Error(response.error);
            // Clean up open tab if exists
            if (state.openTabs[scriptId]) {
                delete state.openTabs[scriptId];
                getScriptTabElement(scriptId)?.remove();
            }
            if (scriptId === state.currentScriptId) {
                state.currentScriptId = null;
                state.unsavedChanges = false;
                const remaining = Object.keys(state.openTabs);
                if (remaining.length > 0) {
                    activateScriptTab(remaining[remaining.length - 1]);
                } else {
                    hideEditorOverlay();
                    await switchTab('scripts');
                }
            }
            if (!skipReload) {
                await loadScripts();
                updateStats();
                showToast('Deleted', 'success');
            }
            return true;
        } catch (e) {
            if (!skipReload) showToast('Failed', 'error');
            return false;
        }
    }

    async function checkScriptForUpdates(scriptId, { force = false, triggerEl = null } = {}) {
        const script = state.scripts.find(s => s.id === scriptId);
        const name = script?.metadata?.name || scriptId;
        const originalText = triggerEl?.matches('.updated-link') ? triggerEl.textContent : '';

        if (triggerEl) {
            if ('disabled' in triggerEl) {
                triggerEl.disabled = true;
            } else {
                triggerEl.style.opacity = '0.4';
                triggerEl.style.pointerEvents = 'none';
            }
            if (triggerEl.matches('.updated-link')) {
                triggerEl.textContent = force ? 'Forcing…' : 'Checking…';
            }
        }

        try {
            if (force) {
                showToast(`Force-updating ${name}…`, 'info');
                const response = await chrome.runtime.sendMessage({ action: 'forceUpdate', scriptId });
                if (response?.success) {
                    showToast(`${name} force-updated to v${response.script?.meta?.version || '?'}`, 'success');
                    setTimeout(() => loadScripts(), 800);
                    return true;
                }
                showToast(response?.error || 'Force update failed', 'error');
                return false;
            }

            const updates = await chrome.runtime.sendMessage({ action: 'checkUpdates', scriptId });
            if (updates && updates.length > 0) {
                await chrome.runtime.sendMessage({ action: 'applyUpdate', scriptId, code: updates[0].code });
                showToast(`${name} updated to v${updates[0].newVersion}`, 'success');
                setTimeout(() => loadScripts(), 800);
                return true;
            }

            showToast(`${name} is up to date`, 'info');
            return false;
        } catch (err) {
            showToast(force ? 'Force update failed' : 'Update check failed', 'error');
            return false;
        } finally {
            if (triggerEl) {
                if ('disabled' in triggerEl) {
                    triggerEl.disabled = false;
                } else {
                    triggerEl.style.opacity = '';
                    triggerEl.style.pointerEvents = '';
                }
                if (triggerEl.matches('.updated-link')) {
                    triggerEl.textContent = originalText;
                }
            }
        }
    }

    function isBroadMatch(patterns) {
        return patterns.some(p => p === '<all_urls>' || p === '*://*/*' || p === 'http://*/*' || p === 'https://*/*' || /^\*:\/\/\*\//.test(p));
    }

    let _creatingScript = false;

    const SCRIPT_TEMPLATES = {
        blank: {
            label: 'Blank Script',
            desc: 'Empty starter with metadata block',
            code: `// ==UserScript==
// @name        New Script
// @namespace   http://example.com/
// @version     1.0
// @description A new userscript
// @author      You
// @match       *://*/*
// @grant       none
// ==/UserScript==

(function() {
    'use strict';
    // Your code here...
})();`
        },
        domModifier: {
            label: 'Page Modifier',
            desc: 'Modify page content and layout',
            code: `// ==UserScript==
// @name        Page Modifier
// @namespace   http://example.com/
// @version     1.0
// @description Modify page elements
// @author      You
// @match       *://*/*
// @grant       GM_addStyle
// @run-at      document-end
// ==/UserScript==

(function() {
    'use strict';

    // Add custom CSS
    GM_addStyle(\`
        /* Your styles here */
    \`);

    // Wait for element then modify
    function waitForElement(selector, callback) {
        const el = document.querySelector(selector);
        if (el) return callback(el);
        const observer = new MutationObserver((mutations, obs) => {
            const el = document.querySelector(selector);
            if (el) { obs.disconnect(); callback(el); }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // Example: modify an element
    // waitForElement('.target', el => { el.textContent = 'Modified!'; });
})();`
        },
        cssInjector: {
            label: 'CSS Injector',
            desc: 'Inject custom styles into a page',
            code: `// ==UserScript==
// @name        Custom CSS
// @namespace   http://example.com/
// @version     1.0
// @description Inject custom styles
// @author      You
// @match       *://*/*
// @grant       GM_addStyle
// @run-at      document-start
// ==/UserScript==

(function() {
    'use strict';

    GM_addStyle(\`
        /* Dark mode override example */
        body {
            background: #1a1a1a !important;
            color: #e0e0e0 !important;
        }

        /* Hide elements */
        .ads, .banner, .popup {
            display: none !important;
        }
    \`);
})();`
        },
        apiInterceptor: {
            label: 'API Interceptor',
            desc: 'Intercept fetch/XHR requests',
            code: `// ==UserScript==
// @name        API Interceptor
// @namespace   http://example.com/
// @version     1.0
// @description Intercept and modify network requests
// @author      You
// @match       *://*/*
// @grant       unsafeWindow
// @run-at      document-start
// ==/UserScript==

(function() {
    'use strict';
    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

    // Intercept fetch
    const originalFetch = win.fetch;
    win.fetch = async function(...args) {
        const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
        console.log('[Intercepted fetch]', url);

        const response = await originalFetch.apply(this, args);
        // Modify response if needed
        return response;
    };

    // Intercept XMLHttpRequest
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        console.log('[Intercepted XHR]', method, url);
        return originalOpen.call(this, method, url, ...rest);
    };
})();`
        },
        spaScript: {
            label: 'SPA Content Script',
            desc: 'React to URL changes in single-page apps',
            code: `// ==UserScript==
// @name        SPA Script
// @namespace   http://example.com/
// @version     1.0
// @description Handle SPA navigation
// @author      You
// @match       *://*/*
// @grant       window.onurlchange
// @run-at      document-end
// ==/UserScript==

(function() {
    'use strict';

    function onPageLoad(url) {
        console.log('Page loaded:', url);
        // Run your logic here each time the page/URL changes
    }

    // Initial page load
    onPageLoad(location.href);

    // SPA navigation detection
    if (window.onurlchange === null) {
        window.addEventListener('urlchange', (e) => {
            onPageLoad(e.url || location.href);
        });
    }
})();`
        },
        crossSiteRequest: {
            label: 'Cross-Site Request',
            desc: 'Fetch data from external APIs',
            code: `// ==UserScript==
// @name        API Client
// @namespace   http://example.com/
// @version     1.0
// @description Fetch data from external APIs
// @author      You
// @match       *://*/*
// @grant       GM_xmlhttpRequest
// @grant       GM_getValue
// @grant       GM_setValue
// @connect     api.example.com
// ==/UserScript==

(function() {
    'use strict';

    // Cross-origin request example
    GM_xmlhttpRequest({
        method: 'GET',
        url: 'https://api.example.com/data',
        onload: function(response) {
            try {
                const data = JSON.parse(response.responseText);
                console.log('API response:', data);
            } catch (e) {
                console.error('Parse error:', e);
            }
        },
        onerror: function(err) {
            console.error('Request failed:', err);
        }
    });

    // Cache results
    // const cached = GM_getValue('apiCache');
    // GM_setValue('apiCache', { data, timestamp: Date.now() });
})();`
        }
    };

    async function createNewScript() {
        if (_creatingScript) return;

        // Clear hash to prevent duplicate creation on refresh
        const nextUrl = getDashboardUrl();
        nextUrl.hash = '';
        replaceDashboardUrl(nextUrl);

        const templateHtml = Object.entries(SCRIPT_TEMPLATES).map(([key, t]) => `
            <div class="template-card" data-template="${key}" tabindex="0" role="button">
                <div class="template-name">${escapeHtml(t.label)}</div>
                <div class="template-desc">${escapeHtml(t.desc)}</div>
            </div>
        `).join('');

        showModal('New Script', `
            <p style="margin-bottom: 16px; color: var(--text-secondary);">Choose a template to get started:</p>
            <div class="template-grid">${templateHtml}</div>
        `, [
            { label: 'Cancel', callback: () => hideModal() }
        ]);

        // Bind template clicks
        document.querySelectorAll('.template-card').forEach(card => {
            const handler = async () => {
                hideModal();
                const key = card.dataset.template;
                const template = SCRIPT_TEMPLATES[key];
                if (!template) return;

                _creatingScript = true;
                try {
                    const response = await chrome.runtime.sendMessage({ action: 'createScript', code: template.code });
                    if (response?.success) {
                        await loadScripts();
                        updateStats();
                        openEditorForScript(response.scriptId);
                        showToast('Created from ' + template.label, 'success');
                    }
                } catch (e) {
                    showToast('Failed', 'error');
                } finally {
                    _creatingScript = false;
                }
            };
            card.addEventListener('click', handler);
            card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); } });
        });
    }

    function beautifyCode() {
        if (!state.editor) return;
        const code = state.editor.getValue();
        const tabStr = state.editor.getOption('indentWithTabs') ? '\t' : ' '.repeat(state.editor.getOption('indentUnit') || 4);

        // Simple beautifier: normalize indentation based on braces
        const lines = code.split('\n');
        const beautified = [];
        let currentIndent = 0;

        for (let line of lines) {
            let trimmed = line.trim();
            if (!trimmed) { beautified.push(''); continue; }

            // Decrease indent for closing braces/brackets at line start
            const leadingClose = /^[}\])]/.test(trimmed);
            if (leadingClose && currentIndent > 0) currentIndent--;

            beautified.push(tabStr.repeat(currentIndent) + trimmed);

            // Count net brace changes (ignoring strings/comments roughly)
            let netBraces = 0;
            let inStr = false, strCh = '', escaped = false;
            for (let c = 0; c < trimmed.length; c++) {
                const ch = trimmed[c];
                if (escaped) { escaped = false; continue; }
                if (ch === '\\') { escaped = true; continue; }
                if (inStr) { if (ch === strCh) inStr = false; continue; }
                if (ch === '"' || ch === "'" || ch === '`') { inStr = true; strCh = ch; continue; }
                if (ch === '/' && trimmed[c+1] === '/') break; // line comment
                if (ch === '{' || ch === '[' || ch === '(') netBraces++;
                if (ch === '}' || ch === ']' || ch === ')') netBraces--;
            }
            currentIndent = Math.max(0, currentIndent + netBraces);
        }

        state.editor.setValue(beautified.join('\n'));
        state.editor.setCursor({ line: 0, ch: 0 });
        updateLineCount();
        updateCursorPos();
        markCurrentEditorDirty();
        showToast('Code beautified', 'success');
    }

    // Editor init
    function initEditor() {
        if (!elements.editorTextarea) return;
        const s = state.settings;
        const tabSz = parseInt(s.tabSize) || parseInt(s.editorTabSize) || 4;
        const indentSz = parseInt(s.indentWidth) || tabSz;
        const useSpaces = (s.indentWith || 'spaces') === 'spaces';
        const indentStr = useSpaces ? ' '.repeat(indentSz) : '\t';

        state.editor = CodeMirror.fromTextArea(elements.editorTextarea, {
            mode: 'javascript',
            theme: s.editorTheme || 'default',
            lineNumbers: true,
            lineWrapping: s.wordWrap !== undefined ? s.wordWrap : (s.editorWordWrap !== false),
            indentUnit: indentSz,
            tabSize: tabSz,
            indentWithTabs: !useSpaces,
            matchBrackets: true,
            autoCloseBrackets: true,
            foldGutter: true,
            gutters: ['CodeMirror-lint-markers', 'CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
            lint: s.lintOnType !== false ? {
                getAnnotations: window.lintUserscript,
                delay: 300,
                tooltips: true,
                highlightLines: true
            } : false,
            hintOptions: CodeMirror.hint?.userscript ? {
                hint: CodeMirror.hint.userscript,
                completeSingle: false
            } : undefined,
            extraKeys: {
                'Ctrl-S': saveCurrentScript,
                'Cmd-S': saveCurrentScript,
                'Ctrl-F': (cm) => { try { cm.execCommand('findPersistent'); } catch { showToast('Search requires Monaco editor', 'info'); } },
                'Ctrl-H': (cm) => { try { cm.execCommand('replace'); } catch { showToast('Replace requires Monaco editor', 'info'); } },
                'Esc': closeEditor,
                'Tab': cm => cm.somethingSelected() ? cm.indentSelection('add') : cm.replaceSelection(indentStr, 'end'),
                'Ctrl-Space': 'autocomplete',
                'Ctrl-/': () => document.getElementById('tbtnComment')?.click(),
                'Ctrl-G': () => { goToEditorLine(state.editor); }
            }
        });

        const cmEl = document.querySelector('.CodeMirror');
        if (cmEl) cmEl.style.fontSize = (s.editorFontSize || 100) + '%';

        // Cursor position tracking
        state.editor.on('cursorActivity', updateCursorPos);

        // Auto-save support
        let autoSaveTimer = null;
        state.editor.on('change', (cm, change) => {
            // Ignore programmatic loads (setValue) — only track actual user edits
            if (change.origin === 'setValue') return;
            markCurrentEditorDirty();
            updateLineCount();
            if (s.autoSave) {
                clearTimeout(autoSaveTimer);
                autoSaveTimer = setTimeout(() => saveCurrentScript(), 2000);
            }
            // Auto-trigger autocomplete on GM_ / GM. / @
            if (change.origin === '+input' && change.text.length === 1) {
                const ch = change.text[0];
                const line = cm.getLine(change.to.line);
                const pos = change.to.ch + ch.length;
                const prefix = line.slice(0, pos);
                if (/GM[_.]$/.test(prefix) || /\/\/\s*@\w*$/.test(prefix)) {
                    cm.showHint({ completeSingle: false });
                }
            }
        });
    }

    // Import/Export
    async function importScript() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.user.js,.js,.zip,.json';
        input.multiple = true;
        input.onchange = async e => {
            const files = Array.from(e.target.files);
            if (!files.length) return;
            const transfer = getTransferPreferences();
            const hasStructuredImports = files.some(file => /\.(zip|json)$/i.test(file.name));
            if (hasStructuredImports) {
                const confirmed = await showConfirmModal(
                    'Import Files',
                    `Import ${files.length} file${files.length === 1 ? '' : 's'}? Matching scripts may be overwritten.`
                );
                if (!confirmed) return;
            }
            showProgress(`Importing ${files.length} file${files.length > 1 ? 's' : ''}...`);
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                updateProgress(i + 1, files.length, `${file.name} (${i + 1}/${files.length})`);
                try {
                    const name = file.name.toLowerCase();
                    if (name.endsWith('.zip')) {
                        const buf = await file.arrayBuffer();
                        const bytes = new Uint8Array(buf);
                        let binary = '';
                        for (let j = 0; j < bytes.length; j += 8192) {
                            binary += String.fromCharCode.apply(null, bytes.subarray(j, j + 8192));
                        }
                        const r = await chrome.runtime.sendMessage({
                            action: 'importFromZip',
                            zipData: btoa(binary),
                            options: { overwrite: true }
                        });
                        showToast(
                            r?.error ? r.error : `${file.name}: ${formatImportSummary(r)}`,
                            r?.error ? 'error' : getImportResultTone(r)
                        );
                    } else if (name.endsWith('.json')) {
                        const data = JSON.parse(await file.text());
                        const r = await chrome.runtime.sendMessage({
                            action: 'importAll',
                            data: {
                                data,
                                options: {
                                    overwrite: true,
                                    importSettings: transfer.includeSettings,
                                    importStorage: transfer.includeStorage
                                }
                            }
                        });
                        showToast(
                            r?.error ? r.error : `${file.name}: ${formatImportSummary(r)}`,
                            r?.error ? 'error' : getImportResultTone(r)
                        );
                    } else {
                        const code = await file.text();
                        const res = await chrome.runtime.sendMessage({ action: 'createScript', code });
                        if (res?.success) showToast(`Imported: ${file.name}`, 'success');
                    }
                } catch (err) {
                    showToast(`Failed: ${file.name}`, 'error');
                }
            }
            await loadScripts();
            updateStats();
            hideProgress();
        };
        input.click();
    }

    async function exportAllScripts() {
        try {
            const transfer = getTransferPreferences();
            const response = await chrome.runtime.sendMessage({
                action: 'exportAll',
                options: {
                    includeSettings: transfer.includeSettings,
                    includeStorage: transfer.includeStorage
                }
            });
            if (response) {
                const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' });
                const a = document.createElement('a');
                const url = URL.createObjectURL(blob);
                a.href = url;
                a.download = `${transfer.includeSettings ? 'scriptvault-vault-export' : 'scriptvault-script-export'}-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                const exportedCount = response.scripts?.length || 0;
                const exportDetails = [
                    `${numberFormatter.format(exportedCount)} scripts`,
                    transfer.includeStorage ? 'stored values included' : 'stored values excluded',
                    transfer.includeSettings ? 'app settings included' : 'app settings excluded'
                ];
                showToast(`JSON export ready: ${exportDetails.join(', ')}`, 'success');
            }
        } catch (e) {
            showToast('Failed', 'error');
        }
    }

    function exportSingleScript(script) {
        const meta = script.metadata || {};
        const name = (meta.name || 'script').replace(/[^a-zA-Z0-9_-]/g, '_');
        const blob = new Blob([script.code || ''], { type: 'text/javascript' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${name}.user.js`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        showToast(`Exported ${meta.name || 'script'}`, 'success');
    }

    async function exportToZip() {
        try {
            const transfer = getTransferPreferences();
            const response = await chrome.runtime.sendMessage({
                action: 'exportZip',
                options: { includeStorage: transfer.includeStorage }
            });
            if (response?.zipData) {
                const raw = atob(response.zipData);
                const bytes = new Uint8Array(raw.length);
                for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
                const blob = new Blob([bytes], { type: 'application/zip' });
                const a = document.createElement('a');
                const objUrl = URL.createObjectURL(blob);
                a.href = objUrl;
                a.download = response.filename || `scriptvault-${new Date().toISOString().split('T')[0]}.zip`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
                showToast(
                    transfer.includeStorage
                        ? 'ZIP archive ready with stored values'
                        : 'ZIP archive ready without stored values',
                    'success'
                );
            }
        } catch (e) {
            showToast('Failed', 'error');
        }
    }

    function exportStatsCSV() {
        const rows = [['Name', 'Version', 'Enabled', 'Runs', 'Avg Time (ms)', 'Total Time (ms)', 'Errors', 'Last Run', 'Last URL', 'Size (bytes)', 'Lines', 'Tags', 'Matches']];
        for (const s of state.scripts) {
            const m = s.metadata || {};
            const st = s.stats || {};
            rows.push([
                m.name || 'Unnamed',
                m.version || '',
                s.enabled !== false ? 'Yes' : 'No',
                st.runs || 0,
                st.avgTime || 0,
                Math.round(st.totalTime || 0),
                st.errors || 0,
                st.lastRun ? new Date(st.lastRun).toISOString() : '',
                st.lastUrl || '',
                (s.code || '').length,
                (s.code || '').split('\n').length,
                (m.tag || []).join('; '),
                [...(m.match || []), ...(m.include || [])].join('; ')
            ]);
        }
        const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        const url = URL.createObjectURL(blob);
        a.href = url;
        a.download = `scriptvault-stats-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast('Stats exported to CSV', 'success');
    }

    async function installFromUrl() {
        const url = elements.importUrlInput?.value?.trim();
        if (!url) return showToast('Enter URL', 'error');
        try {
            showToast('Fetching...', 'info');
            const res = await chrome.runtime.sendMessage({ action: 'installFromUrl', url });
            if (res?.success) {
                await loadScripts();
                updateStats();
                elements.importUrlInput.value = '';
                showToast('Installed', 'success');
            } else {
                showToast(res?.error || 'Failed', 'error');
            }
        } catch (e) {
            showToast('Failed', 'error');
        }
    }

    // Helpers
    async function updateStats() {
        const total = state.scripts.length;
        const active = state.scripts.filter(s => s.enabled !== false).length;
        const formattedTotal = numberFormatter.format(total);
        const formattedActive = numberFormatter.format(active);
        if (elements.statTotalScripts) elements.statTotalScripts.textContent = formattedTotal;
        if (elements.statActiveScripts) elements.statActiveScripts.textContent = formattedActive;
        if (elements.workspaceInstalledStat) elements.workspaceInstalledStat.textContent = formattedTotal;
        if (elements.workspaceActiveStat) elements.workspaceActiveStat.textContent = formattedActive;
        updateHelpOverview();
        try {
            const bytes = await chrome.storage.local.getBytesInUse(null);
            const usedBytes = bytes || 0;
            const formattedStorage = formatBytes(usedBytes);
            if (elements.statTotalStorage) elements.statTotalStorage.textContent = formattedStorage;
            if (elements.workspaceStorageStat) elements.workspaceStorageStat.textContent = formattedStorage;

            // Storage quota bar
            const quotaBar = document.getElementById('storageQuotaBar');
            const quotaText = document.getElementById('storageQuotaText');
            const QUOTA_BYTES = 10 * 1024 * 1024; // 10MB Chrome limit
            const pct = Math.min(100, (usedBytes / QUOTA_BYTES) * 100);
            if (quotaBar) {
                quotaBar.style.width = pct + '%';
                quotaBar.className = 'quota-bar-fill' + (pct > 90 ? ' danger' : pct > 70 ? ' warning' : '');
            }
            if (quotaText) {
                quotaText.textContent = `${formatBytes(usedBytes)} / ${formatBytes(QUOTA_BYTES)} (${pct.toFixed(1)}%)`;
            }
            // Show warning toast if over 85%
            if (pct > 85 && !state._quotaWarned) {
                state._quotaWarned = true;
                showToast(`Storage at ${pct.toFixed(0)}% capacity - consider cleaning up`, 'warning');
            }
        } catch (e) {
            if (elements.statTotalStorage) elements.statTotalStorage.textContent = '-';
            if (elements.workspaceStorageStat) elements.workspaceStorageStat.textContent = '-';
        }
    }

    function formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${bytesFormatter.format(bytes / Math.pow(k, i))} ${sizes[i]}`;
    }

    function formatTime(ts) {
        if (!ts) return '-';
        const date = new Date(ts);
        if (isNaN(date.getTime())) return '-';
        const diff = Date.now() - date.getTime();
        const m = Math.floor(diff / 60000);
        const h = Math.floor(m / 60);
        const d = Math.floor(h / 24);
        if (d > 30) return fullDateFormatter.format(date);
        if (d > 0) return d + 'd';
        if (h > 0) return h + 'h';
        if (m > 0) return m + 'm';
        return 'now';
    }

    // escapeHtml provided by shared/utils.js

    // =========================================
    // Find Scripts
    // =========================================
    const findScriptsState = { page: 1, query: '', source: 'greasyfork', loading: false };

    function setFindScriptsBackgroundHidden(hidden) {
        FIND_SCRIPTS_BACKGROUND_SELECTORS.forEach(selector => {
            const element = document.querySelector(selector);
            if (!(element instanceof HTMLElement) || element === elements.findScriptsOverlay) {
                return;
            }

            if (hidden) {
                const previousAriaHidden = element.getAttribute('aria-hidden');
                element.dataset.findScriptsPreviousAriaHidden = previousAriaHidden == null ? '__none__' : previousAriaHidden;
                element.setAttribute('aria-hidden', 'true');
                element.inert = true;
                return;
            }

            if (element.dataset.findScriptsPreviousAriaHidden === '__none__') {
                element.removeAttribute('aria-hidden');
            } else if (element.dataset.findScriptsPreviousAriaHidden) {
                element.setAttribute('aria-hidden', element.dataset.findScriptsPreviousAriaHidden);
            }
            delete element.dataset.findScriptsPreviousAriaHidden;
            element.inert = false;
        });
    }

    function openFindScripts() {
        const overlay = elements.findScriptsOverlay;
        if (!overlay || overlay.classList.contains('active')) return;

        findScriptsLastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        findScriptsFocusManaged = false;
        overlay.hidden = false;
        overlay.setAttribute('aria-hidden', 'false');
        overlay.classList.add('active');
        elements.btnFindScripts?.setAttribute('aria-expanded', 'true');
        setFindScriptsBackgroundHidden(true);

        if (typeof A11y !== 'undefined' && typeof A11y.trapFocus === 'function') {
            A11y.trapFocus(overlay);
            findScriptsFocusManaged = true;
        }

        requestAnimationFrame(() => {
            if (overlay.hidden || !overlay.classList.contains('active')) return;
            (elements.findScriptsInput || elements.btnFindScriptsSearch || elements.btnCloseFindScripts || overlay)?.focus?.();
        });
    }

    function closeFindScripts() {
        const overlay = elements.findScriptsOverlay;
        if (!overlay) return;

        overlay.classList.remove('active');
        overlay.hidden = true;
        overlay.setAttribute('aria-hidden', 'true');
        elements.btnFindScripts?.setAttribute('aria-expanded', 'false');
        setFindScriptsBackgroundHidden(false);

        if (findScriptsFocusManaged && typeof A11y !== 'undefined' && typeof A11y.releaseFocus === 'function') {
            A11y.releaseFocus();
            findScriptsFocusManaged = false;
        }
        if (findScriptsLastFocusedElement?.isConnected) {
            findScriptsLastFocusedElement.focus();
        }
        findScriptsLastFocusedElement = null;
    }

    async function searchScripts(page = 1) {
        const query = elements.findScriptsInput?.value?.trim();
        const source = elements.findScriptsSource?.value || 'greasyfork';
        if (!query) return showToast('Enter a search term', 'error');
        if (findScriptsState.loading) return;

        findScriptsState.query = query;
        findScriptsState.source = source;
        findScriptsState.page = page;
        findScriptsState.loading = true;

        if (elements.findScriptsResults) elements.findScriptsResults.innerHTML = '<div class="find-scripts-loading">Searching</div>';

        try {
            if (source === 'greasyfork') {
                await searchGreasyFork(query, page);
            } else if (source === 'openuserjs') {
                await searchOpenUserJS(query, page);
            } else if (source === 'github') {
                searchExternal(`https://github.com/search?q=${encodeURIComponent(query + ' userscript')}&type=code`);
            }
        } catch (e) {
            if (elements.findScriptsResults) elements.findScriptsResults.innerHTML = `<div class="find-scripts-empty">Search failed: ${escapeHtml(e.message)}</div>`;
        } finally {
            findScriptsState.loading = false;
        }
    }

    function searchExternal(url) {
        chrome.tabs.create({ url });
        closeFindScripts();
    }

    async function searchGreasyFork(query, page) {
        // Detect if query looks like a domain
        const isDomain = /^[a-zA-Z0-9]([a-zA-Z0-9-]*\.)+[a-zA-Z]{2,}$/.test(query);
        let apiUrl;
        if (isDomain) {
            apiUrl = `https://api.greasyfork.org/en/scripts/by-site/${encodeURIComponent(query)}.json?page=${page}`;
        } else {
            apiUrl = `https://api.greasyfork.org/en/scripts.json?q=${encodeURIComponent(query)}&page=${page}`;
        }

        const resp = await fetch(apiUrl);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const scripts = await resp.json();

        if (!scripts || scripts.length === 0) {
            if (elements.findScriptsResults) elements.findScriptsResults.innerHTML = '<div class="find-scripts-empty">No scripts found. Try a different search term.</div>';
            return;
        }

        renderFindResults(scripts, page, isDomain ? query : null);
    }

    async function searchOpenUserJS(query, page) {
        // OpenUserJS has a JSON API at /api/script/list
        const apiUrl = `https://openuserjs.org/api/script/list?q=${encodeURIComponent(query)}&p=${page}&limit=25`;
        try {
            const resp = await fetch(apiUrl);
            if (!resp.ok) {
                // Fallback to external if API fails
                searchExternal(`https://openuserjs.org/?q=${encodeURIComponent(query)}`);
                return;
            }
            const data = await resp.json();
            const scripts = data?.scripts || data || [];
            if (!Array.isArray(scripts) || scripts.length === 0) {
                if (elements.findScriptsResults) elements.findScriptsResults.innerHTML = '<div class="find-scripts-empty">No scripts found on OpenUserJS. Try a different term.</div>';
                return;
            }
            // Normalize to same format as GreasyFork results
            const normalized = scripts.map(s => ({
                name: s.name || 'Unnamed',
                description: s.about || s.description || '',
                version: s.meta?.version || '',
                url: `https://openuserjs.org/scripts/${encodeURIComponent(s.author || '_')}/${encodeURIComponent(s.name || '')}`,
                code_url: s.installURL || `https://openuserjs.org/install/${encodeURIComponent(s.author || '_')}/${encodeURIComponent(s.name || '')}.user.js`,
                total_installs: s.installs || 0,
                daily_installs: 0,
                fan_score: s.rating || 0,
                code_updated_at: s.updated || s._updated,
                users: [{ name: s.author || 'Unknown' }]
            }));
            renderFindResults(normalized, page, null);
        } catch (e) {
            // Fallback to external
            searchExternal(`https://openuserjs.org/?q=${encodeURIComponent(query)}`);
        }
    }

    function renderFindResults(scripts, page, domain) {
        // Build installed script lookup for duplicate detection
        const installedNames = new Set(state.scripts.map(s => (s.metadata?.name || '').toLowerCase()));

        const html = scripts.map(s => {
            const installs = s.total_installs >= 1000 ? Math.round(s.total_installs / 1000) + 'k' : (s.total_installs || 0);
            const daily = s.daily_installs || 0;
            const rating = s.fan_score ? parseFloat(s.fan_score).toFixed(0) + '%' : '--';
            const updated = s.code_updated_at ? formatTime(s.code_updated_at) : '--';
            const author = s.users && s.users[0] ? s.users[0].name : 'Unknown';
            const isInstalled = installedNames.has((s.name || '').toLowerCase());
            const installedBadge = isInstalled ? '<span class="find-installed-badge">Installed</span>' : '';

            return `<div class="find-script-card${isInstalled ? ' already-installed' : ''}">
                <div class="find-script-info">
                    <div class="find-script-name">
                        <a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(s.name)}</a>
                        ${s.version ? `<span class="find-script-version">v${escapeHtml(s.version)}</span>` : ''}
                        ${installedBadge}
                    </div>
                    <div class="find-script-desc" title="${escapeHtml(s.description || '')}">${escapeHtml(s.description || 'No description')}</div>
                    <div class="find-script-meta">
                        <span title="Author">${escapeHtml(author)}</span>
                        <span title="Total installs">${installs} installs</span>
                        <span title="Daily installs">${daily}/day</span>
                        <span title="Rating">${rating} rating</span>
                        <span title="Updated">${updated}</span>
                    </div>
                </div>
                <div class="find-script-actions">
                    <button class="toolbar-btn primary" data-install-url="${escapeHtml(s.code_url || '')}">${isInstalled ? 'Reinstall' : 'Install'}</button>
                    <button class="toolbar-btn" data-preview-url="${escapeHtml(s.code_url || '')}">Preview</button>
                    <button class="toolbar-btn" data-view-url="${escapeHtml(s.url || '')}">View</button>
                </div>
                <div class="find-script-preview"></div>
            </div>`;
        }).join('');

        const countText = domain
            ? `<div class="find-scripts-count">Scripts for <strong>${escapeHtml(domain)}</strong> - Page ${page}</div>`
            : `<div class="find-scripts-count">Page ${page} - ${scripts.length} results</div>`;

        const pagination = `<div class="find-scripts-pagination">
            ${page > 1 ? `<button class="toolbar-btn" data-find-page="${page - 1}">Previous</button>` : ''}
            ${scripts.length >= 50 ? `<button class="toolbar-btn" data-find-page="${page + 1}">Next</button>` : ''}
        </div>`;

        if (elements.findScriptsResults) elements.findScriptsResults.innerHTML = countText + html + pagination;

        // Bind install buttons
        if (elements.findScriptsResults) elements.findScriptsResults.querySelectorAll('[data-install-url]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const url = btn.dataset.installUrl;
                if (!url) return;
                btn.textContent = 'Installing...';
                btn.disabled = true;
                try {
                    const res = await chrome.runtime.sendMessage({ action: 'installFromUrl', url });
                    if (res?.success) {
                        btn.textContent = 'Installed';
                        btn.classList.remove('primary');
                        await loadScripts();
                        updateStats();
                        showToast('Script installed', 'success');
                    } else {
                        btn.textContent = 'Failed';
                        showToast(res?.error || 'Install failed', 'error');
                        setTimeout(() => { btn.textContent = 'Install'; btn.disabled = false; }, 2000);
                    }
                } catch (e) {
                    btn.textContent = 'Error';
                    showToast('Install failed', 'error');
                    setTimeout(() => { btn.textContent = 'Install'; btn.disabled = false; }, 2000);
                }
            });
        });

        // Bind view buttons
        if (elements.findScriptsResults) elements.findScriptsResults.querySelectorAll('[data-view-url]').forEach(btn => {
            btn.addEventListener('click', () => {
                const url = btn.dataset.viewUrl;
                if (url) chrome.tabs.create({ url });
            });
        });

        // Bind preview buttons
        if (elements.findScriptsResults) elements.findScriptsResults.querySelectorAll('[data-preview-url]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const url = btn.dataset.previewUrl;
                if (!url) return;
                const card = btn.closest('.find-script-card');
                const preview = card?.querySelector('.find-script-preview');
                if (!preview) return;
                if (preview.classList.contains('open')) {
                    preview.classList.remove('open');
                    btn.textContent = 'Preview';
                    return;
                }
                btn.textContent = 'Loading...';
                btn.disabled = true;
                try {
                    const resp = await fetch(url);
                    const code = await resp.text();
                    preview.textContent = code;
                    preview.classList.add('open');
                    btn.textContent = 'Hide';
                } catch (e) {
                    preview.textContent = 'Failed to load code';
                    preview.classList.add('open');
                    btn.textContent = 'Preview';
                }
                btn.disabled = false;
            });
        });

        // Bind pagination
        if (elements.findScriptsResults) elements.findScriptsResults.querySelectorAll('[data-find-page]').forEach(btn => {
            btn.addEventListener('click', () => searchScripts(parseInt(btn.dataset.findPage)));
        });
    }

    function showToast(msg, type = 'info') {
        if (!elements.toastContainer) return;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
        toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span class="toast-message">${escapeHtml(msg)}</span>`;
        elements.toastContainer.appendChild(toast);
        if (typeof A11y !== 'undefined' && typeof A11y.announce === 'function') {
            A11y.announce(msg, type === 'error' ? 'assertive' : 'polite');
        }
        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);

        // Log to activity log
        logActivity(msg, type);
    }

    function logActivity(msg, type = 'info') {
        const logEl = document.getElementById('activityLog');
        if (!logEl) return;
        if (logEl.textContent === 'No activity yet') logEl.innerHTML = '';
        const time = new Date().toLocaleTimeString();
        const typeIcons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
        const entry = document.createElement('div');
        entry.className = `activity-entry activity-${type}`;
        entry.innerHTML = `<span class="activity-time">${time}</span><span class="activity-icon">${typeIcons[type] || 'ℹ'}</span>${escapeHtml(msg)}`;
        logEl.prepend(entry);
        // Keep only last 50 entries
        while (logEl.children.length > 50) logEl.removeChild(logEl.lastChild);
    }

    // Progress overlay helpers
    const progressEl = {
        overlay: null, title: null, fill: null, status: null, bar: null,
        init() {
            this.overlay = document.getElementById('progressOverlay');
            this.title = document.getElementById('progressTitle');
            this.fill = document.getElementById('progressFill');
            this.status = document.getElementById('progressStatus');
            this.bar = document.getElementById('progressBar');
        }
    };

    function setProgressBackgroundHidden(hidden) {
        PROGRESS_BACKGROUND_SELECTORS.forEach(selector => {
            const element = document.querySelector(selector);
            if (!(element instanceof HTMLElement) || element === progressEl.overlay) {
                return;
            }

            if (hidden) {
                const previousAriaHidden = element.getAttribute('aria-hidden');
                element.dataset.progressPreviousAriaHidden = previousAriaHidden == null ? '__none__' : previousAriaHidden;
                element.setAttribute('aria-hidden', 'true');
                element.inert = true;
                return;
            }

            if (element.dataset.progressPreviousAriaHidden === '__none__') {
                element.removeAttribute('aria-hidden');
            } else if (element.dataset.progressPreviousAriaHidden) {
                element.setAttribute('aria-hidden', element.dataset.progressPreviousAriaHidden);
            }
            delete element.dataset.progressPreviousAriaHidden;
            element.inert = false;
        });
    }

    function showProgress(title) {
        if (!progressEl.overlay) progressEl.init();
        if (!progressEl.overlay) return;
        const overlayWasOpen = progressEl.overlay.classList.contains('active') && !progressEl.overlay.hidden;
        if (progressHideTimer) {
            clearTimeout(progressHideTimer);
            progressHideTimer = null;
        }
        if (!overlayWasOpen) {
            progressLastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            progressFocusManaged = false;
        }
        if (progressEl.title) progressEl.title.textContent = title;
        if (progressEl.fill) progressEl.fill.style.width = '0%';
        if (progressEl.status) progressEl.status.textContent = '';
        if (progressEl.bar) progressEl.bar.setAttribute('aria-valuenow', '0');
        progressEl.overlay.setAttribute('aria-busy', 'true');
        progressEl.overlay.hidden = false;
        progressEl.overlay.setAttribute('aria-hidden', 'false');
        progressEl.overlay.classList.add('active');
        if (!progressFocusManaged) {
            setProgressBackgroundHidden(true);
            if (typeof A11y !== 'undefined' && typeof A11y.trapFocus === 'function') {
                A11y.trapFocus(progressEl.overlay);
                progressFocusManaged = true;
            }
        }
        requestAnimationFrame(() => progressEl.overlay?.focus());
        if (typeof A11y !== 'undefined' && typeof A11y.announce === 'function') {
            A11y.announce(title, 'polite');
        }
    }

    function updateProgress(current, total, label) {
        if (!progressEl.fill) return;
        const pct = Math.round((current / total) * 100);
        progressEl.fill.style.width = pct + '%';
        if (progressEl.status) progressEl.status.textContent = label || `${current} / ${total}`;
        if (progressEl.bar) progressEl.bar.setAttribute('aria-valuenow', String(Math.max(0, Math.min(100, pct))));
        if (label && typeof A11y !== 'undefined' && typeof A11y.announce === 'function') {
            A11y.announce(label, 'polite');
        }
    }

    function hideProgress() {
        if (!progressEl.overlay) return;
        if (progressHideTimer) {
            clearTimeout(progressHideTimer);
        }
        if (progressEl.fill) progressEl.fill.style.width = '100%';
        if (progressEl.bar) progressEl.bar.setAttribute('aria-valuenow', '100');
        progressEl.overlay.setAttribute('aria-busy', 'false');
        const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        progressHideTimer = window.setTimeout(() => {
            progressHideTimer = null;
            progressEl.overlay.classList.remove('active');
            progressEl.overlay.hidden = true;
            progressEl.overlay.setAttribute('aria-hidden', 'true');
            setProgressBackgroundHidden(false);
            if (progressFocusManaged && typeof A11y !== 'undefined' && typeof A11y.releaseFocus === 'function') {
                A11y.releaseFocus();
                progressFocusManaged = false;
            } else if (progressLastFocusedElement?.isConnected) {
                progressLastFocusedElement.focus();
            }
            progressLastFocusedElement = null;
        }, reduceMotion ? 0 : 300);
    }

    let modalDismissHandler = null;
    function closeModalShell() {
        elements.modal?.classList.remove('show');
        if (elements.modal) {
            elements.modal.hidden = true;
            elements.modal.setAttribute('aria-hidden', 'true');
        }
        if (modalFocusManaged && typeof A11y !== 'undefined' && typeof A11y.releaseFocus === 'function') {
            A11y.releaseFocus();
            modalFocusManaged = false;
        }
        if (modalLastFocusedElement?.isConnected) {
            modalLastFocusedElement.focus();
        }
        modalLastFocusedElement = null;
    }

    function showModal(title, html, actions = [], options = {}) {
        if (!elements.modal) return;
        modalLastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        modalDismissHandler = typeof options.onDismiss === 'function' ? options.onDismiss : null;
        if (elements.modalTitle) elements.modalTitle.textContent = title;
        if (elements.modalBody) elements.modalBody.innerHTML = html;
        if (elements.modalActions) {
            elements.modalActions.innerHTML = '';
            actions.forEach(a => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = `btn ${a.class || ''}`;
                btn.textContent = a.label;
                btn.addEventListener('click', async () => {
                    await runButtonTask(btn, a.callback, { busyLabel: a.busyLabel });
                });
                elements.modalActions.appendChild(btn);
            });
        }
        elements.modal.hidden = false;
        elements.modal.setAttribute('aria-hidden', 'false');
        elements.modal.classList.add('show');
        const modalSurface = elements.modal.querySelector('.modal-content');
        if (modalSurface && typeof A11y !== 'undefined' && typeof A11y.trapFocus === 'function') {
            A11y.trapFocus(modalSurface);
            modalFocusManaged = true;
        }
        requestAnimationFrame(() => {
            const preferredFocus = elements.modalActions?.querySelector('.btn-primary')
                || elements.modalActions?.querySelector('button')
                || elements.modalClose
                || modalSurface;
            preferredFocus?.focus?.();
        });
    }

    function hideModal() {
        closeModalShell();
        const onDismiss = modalDismissHandler;
        modalDismissHandler = null;
        onDismiss?.();
    }

    function showConfirmModal(title, msg) {
        return new Promise(resolve => {
            let settled = false;
            const finish = result => {
                if (settled) return;
                settled = true;
                modalDismissHandler = null;
                closeModalShell();
                resolve(result);
            };
            showModal(title, `<p>${escapeHtml(msg)}</p>`, [
                { label: 'Cancel', class: '', callback: () => finish(false) },
                { label: 'Confirm', class: 'btn-primary', callback: () => finish(true) }
            ], { onDismiss: () => finish(false) });
        });
    }

    function showInputModal({
        title,
        label,
        value = '',
        placeholder = '',
        confirmLabel = 'Save',
        validate
    }) {
        return new Promise(resolve => {
            const inputId = `modal-input-${Date.now()}`;
            const errorId = `${inputId}-error`;
            let settled = false;

            const finish = result => {
                if (settled) return;
                settled = true;
                modalDismissHandler = null;
                closeModalShell();
                document.removeEventListener('keydown', handleKeyDown, true);
                resolve(result);
            };

            const submit = () => {
                const input = document.getElementById(inputId);
                const errorEl = document.getElementById(errorId);
                const rawValue = input?.value ?? '';
                const trimmedValue = rawValue.trim();
                const error = typeof validate === 'function'
                    ? validate(trimmedValue, rawValue)
                    : (!trimmedValue ? 'This field is required.' : '');

                if (error) {
                    if (errorEl) errorEl.textContent = error;
                    input?.focus();
                    input?.select?.();
                    return;
                }

                finish(trimmedValue);
            };

            const handleKeyDown = e => {
                if (!elements.modal?.classList.contains('show')) return;
                if (e.key === 'Escape') {
                    e.preventDefault();
                    finish(null);
                    return;
                }
                if (e.key === 'Enter' && document.activeElement?.id === inputId) {
                    e.preventDefault();
                    submit();
                }
            };

            showModal(title, `
                <div style="display:flex;flex-direction:column;gap:10px">
                    <label for="${inputId}" style="font-weight:600;color:var(--text-primary)">${escapeHtml(label)}</label>
                    <input id="${inputId}" class="input-field" type="text" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" aria-describedby="${errorId}">
                    <div id="${errorId}" style="min-height:18px;font-size:12px;color:var(--accent-error)"></div>
                </div>
            `, [
                { label: 'Cancel', class: '', callback: () => finish(null) },
                { label: confirmLabel, class: 'btn-primary', callback: submit }
            ], { onDismiss: () => finish(null) });

            document.addEventListener('keydown', handleKeyDown, true);
            requestAnimationFrame(() => {
                const input = document.getElementById(inputId);
                input?.focus();
                input?.select?.();
            });
        });
    }

    window.ScriptVaultDashboardUI = {
        confirm: showConfirmModal,
        input: showInputModal,
        toast: showToast
    };

    function getEditorLineCount(editor) {
        if (!editor) return 1;
        if (typeof editor.lineCount === 'function') return editor.lineCount();
        if (typeof editor.getValue === 'function') return (editor.getValue().match(/\n/g) || []).length + 1;
        return 1;
    }

    async function promptForLineNumber(editor = state.editor) {
        if (!editor) return null;
        const maxLine = Math.max(1, getEditorLineCount(editor));
        const lineText = await showInputModal({
            title: 'Go to Line',
            label: `Line number (1-${maxLine})`,
            placeholder: '42',
            confirmLabel: 'Go',
            validate: value => {
                if (!value) return 'Enter a line number.';
                if (!/^\d+$/.test(value)) return 'Use digits only.';
                const lineNumber = parseInt(value, 10);
                if (lineNumber < 1 || lineNumber > maxLine) {
                    return `Enter a number between 1 and ${maxLine}.`;
                }
                return '';
            }
        });

        return lineText ? parseInt(lineText, 10) : null;
    }

    async function goToEditorLine(editor = state.editor) {
        const lineNumber = await promptForLineNumber(editor);
        if (!editor || !lineNumber) return;
        if (typeof editor.setCursor === 'function') {
            editor.setCursor(lineNumber - 1, 0);
        }
        if (typeof editor.scrollIntoView === 'function' && typeof editor.getScrollerElement === 'function') {
            editor.scrollIntoView(null, editor.getScrollerElement().offsetHeight / 2);
        }
    }

    // Event listeners
    function initEventListeners() {
        // Main tabs
        elements.mainTabs.forEach(tab => {
            tab.addEventListener('click', async () => {
                const id = tab.dataset.tab;
                if (id === 'newscript') {
                    createNewScript();
                    return;
                }
                await switchTab(id);
            });
        });

        elements.dashboardTabs.forEach(tab => {
            tab.addEventListener('keydown', async (event) => {
                const tabs = Array.from(elements.dashboardTabs || []);
                if (!tabs.length) return;

                let nextIndex = -1;
                switch (event.key) {
                    case 'ArrowLeft':
                        nextIndex = (tabs.indexOf(tab) - 1 + tabs.length) % tabs.length;
                        break;
                    case 'ArrowRight':
                        nextIndex = (tabs.indexOf(tab) + 1) % tabs.length;
                        break;
                    case 'Home':
                        nextIndex = 0;
                        break;
                    case 'End':
                        nextIndex = tabs.length - 1;
                        break;
                    default:
                        return;
                }

                event.preventDefault();
                await switchTab(tabs[nextIndex]?.dataset.tab, { focusControl: true });
            });
        });

        // Help icon button in header
        elements.btnHelpTab?.addEventListener('click', async () => {
            const isActive = elements.btnHelpTab.classList.contains('active');
            if (isActive) {
                await switchTab('scripts', { focusControl: true });
            } else {
                await switchTab('help');
            }
        });

        // Theme cycle button
        const themes = ['dark', 'light', 'catppuccin', 'oled'];
        const themeLabels = { dark: 'Dark', light: 'Light', catppuccin: 'Catppuccin', oled: 'OLED' };
        elements.btnCycleTheme?.addEventListener('click', () => {
            const current = state.settings.layout || 'dark';
            const idx = themes.indexOf(current);
            const next = themes[(idx + 1) % themes.length];
            saveSetting('layout', next);
            elements.btnCycleTheme.title = `Theme: ${themeLabels[next]}`;
            if (elements.settingsLayout) elements.settingsLayout.value = next;
        });

        // Scripts
        elements.scriptSearch?.addEventListener('input', () => {
            updateScriptSearchAffordances();
            queueScriptTableRender();
        });
        elements.scriptSearch?.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                queueScriptTableRender(true);
                return;
            }
            if (e.key === 'Escape' && elements.scriptSearch?.value) {
                e.preventDefault();
                elements.scriptSearch.value = '';
                queueScriptTableRender(true);
            }
        });
        elements.btnClearScriptSearch?.addEventListener('click', () => {
            if (!elements.scriptSearch) return;
            elements.scriptSearch.value = '';
            updateScriptSearchAffordances();
            queueScriptTableRender(true);
            elements.scriptSearch.focus();
        });
        elements.scriptQuickFilters?.querySelectorAll('[data-filter-value]')?.forEach(button => {
            button.addEventListener('click', () => {
                if (!elements.filterSelect) return;
                const nextFilter = button.dataset.filterValue || 'all';
                if (!isValidScriptFilter(nextFilter)) return;
                elements.filterSelect.value = nextFilter;
                updateScriptQuickFilterButtons();
                renderScriptTable();
            });
        });
        elements.btnClearScriptWorkspace?.addEventListener('click', resetScriptWorkspaceView);
        elements.btnViewToggle?.addEventListener('click', () => {
            setTimeout(() => {
                updateScriptResultsSummary(getFilteredScripts());
                syncScriptWorkspaceStateToUrl();
            }, 0);
        });

        // Column visibility toggle
        document.getElementById('btnColumnToggle')?.addEventListener('click', () => {
            const columns = [
                { id: 'version', label: 'Version' },
                { id: 'size', label: 'Size' },
                { id: 'lines', label: 'Lines' },
                { id: 'sites', label: 'Sites' },
                { id: 'features', label: 'Features' },
                { id: 'home', label: 'Homepage' },
                { id: 'updated', label: 'Updated' },
                { id: 'perf', label: 'Perf' }
            ];
            const hidden = state.settings._hiddenColumns || [];
            const html = columns.map(c => {
                const visible = !hidden.includes(c.id);
                return `<label class="column-toggle-item"><input type="checkbox" data-col-id="${c.id}" ${visible ? 'checked' : ''}> ${c.label}</label>`;
            }).join('');
            showModal('Column Visibility', `<div class="column-toggle-list">${html}</div>`, [
                { label: 'Apply', class: 'btn-primary', callback: () => {
                    const newHidden = [];
                    document.querySelectorAll('.column-toggle-item input').forEach(cb => {
                        if (!cb.checked) newHidden.push(cb.dataset.colId);
                    });
                    if (!state.settings._hiddenColumns) state.settings._hiddenColumns = [];
                    state.settings._hiddenColumns = newHidden;
                    applyColumnVisibility();
                    hideModal();
                    // Persist
                    chrome.runtime.sendMessage({ action: 'setSettings', settings: { _hiddenColumns: newHidden } });
                }},
                { label: 'Cancel', callback: () => hideModal() }
            ]);
        });
        elements.btnNewScript?.addEventListener('click', createNewScript);
        document.getElementById('btnNewFolder')?.addEventListener('click', createFolder);
        elements.btnImportScript?.addEventListener('click', importScript);
        elements.btnCheckUpdates?.addEventListener('click', async () => {
            showProgress('Checking for updates...');
            updateProgress(0, 1, 'Scanning all scripts...');
            try {
                const updates = await chrome.runtime.sendMessage({ action: 'checkUpdates' });
                if (updates && updates.length > 0) {
                    for (let i = 0; i < updates.length; i++) {
                        updateProgress(i + 1, updates.length, `Updating ${updates[i].name || updates[i].id} (${i + 1}/${updates.length})`);
                        await chrome.runtime.sendMessage({ action: 'applyUpdate', scriptId: updates[i].id, code: updates[i].code });
                    }
                    await loadScripts();
                    hideProgress();
                    showToast(`${updates.length} script${updates.length > 1 ? 's' : ''} updated`, 'success');
                } else {
                    hideProgress();
                    showToast('All scripts up to date', 'success');
                }
            } catch (e) { hideProgress(); showToast('Update check failed', 'error'); }
        });

        // Find Scripts
        elements.btnFindScripts?.addEventListener('click', openFindScripts);
        elements.btnCloseFindScripts?.addEventListener('click', closeFindScripts);
        elements.btnFindScriptsSearch?.addEventListener('click', () => searchScripts(1));
        elements.findScriptsOverlay?.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeFindScripts();
            }
        });
        elements.findScriptsInput?.addEventListener('keydown', e => {
            if (e.key === 'Enter') searchScripts(1);
        });

        // Bulk Actions (Tampermonkey-style)
        const setVisibleScriptSelection = checked => {
            const filtered = getFilteredScripts();
            filtered.forEach(s => {
                if (checked) state.selectedScripts.add(s.id);
                else state.selectedScripts.delete(s.id);
            });
            if (!checked && state._lastCheckedId && !state.selectedScripts.has(state._lastCheckedId)) {
                state._lastCheckedId = null;
            }
            updateBulkCheckboxes();
        };
        elements.bulkSelectAll?.addEventListener('change', e => {
            setVisibleScriptSelection(e.target.checked);
        });
        
        // Table header checkbox (syncs with bulk toolbar)
        elements.selectAllScripts?.addEventListener('change', e => {
            setVisibleScriptSelection(e.target.checked);
        });
        
        elements.bulkActionSelect?.addEventListener('change', () => {
            updateBulkCheckboxes();
        });
        elements.btnBulkApply?.addEventListener('click', async event => {
            await runButtonTask(event.currentTarget, executeBulkAction, { busyLabel: 'Applying…' });
        });

        // Sortable column headers
        document.querySelectorAll('.table-sort-button[data-sort]').forEach(button => {
            button.addEventListener('click', () => handleSortClick(button.dataset.sort));
        });

        elements.filterSelect?.addEventListener('change', () => {
            updateScriptQuickFilterButtons();
            renderScriptTable(elements.scriptSearch?.value || '');
        });
        
        elements.btnExportAll?.addEventListener('click', async () => {
            const exportData = {
                version: 2,
                exportedAt: new Date().toISOString(),
                scripts: state.scripts.map(s => ({
                    id: s.id,
                    code: s.code,
                    enabled: s.enabled,
                    position: s.position,
                    metadata: s.metadata,
                    settings: s.settings
                }))
            };
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `scriptvault-export-${Date.now()}.json`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            showToast(`Exported ${state.scripts.length} scripts`, 'success');
        });

        // Editor
        elements.btnEditorSave?.addEventListener('click', saveCurrentScript);
        elements.btnEditorToggle?.addEventListener('click', () => {
            const script = state.scripts.find(s => s.id === state.currentScriptId);
            if (script) toggleScriptEnabled(script.id, script.enabled === false);
        });
        elements.btnEditorDuplicate?.addEventListener('click', duplicateCurrentScript);
        elements.btnEditorExport?.addEventListener('click', () => {
            const script = state.scripts.find(s => s.id === state.currentScriptId);
            if (script) exportSingleScript(script);
        });
        elements.btnEditorClose?.addEventListener('click', closeEditor);
        elements.btnEditorDelete?.addEventListener('click', async () => {
            if (!state.currentScriptId) return;
            const script = state.scripts.find(s => s.id === state.currentScriptId);
            const name = script?.metadata?.name || 'this script';
            if (await showConfirmModal(`Delete "${name}"?`, 'This action cannot be undone.')) {
                deleteScript(state.currentScriptId);
            }
        });
        // Close button removed - tabs handle closing

        elements.btnEmptyTrash?.addEventListener('click', async () => {
            const total = state.trashItems.length;
            if (total === 0) return;
            if (!await showConfirmModal('Empty Trash', `Permanently delete ${numberFormatter.format(total)} script${total === 1 ? '' : 's'} from trash?`)) return;
            try {
                const r = await chrome.runtime.sendMessage({ action: 'emptyTrash' });
                showToast(r?.error ? r.error : 'Trash emptied', r?.error ? 'error' : 'success');
                await loadTrash();
                if (!r?.error) updateStats();
            } catch (error) {
                console.error('Failed to empty trash:', error);
                showToast('Failed to empty trash', 'error');
            }
        });

        // Externals refresh
        elements.btnRefreshExternals?.addEventListener('click', async () => {
            const script = state.scripts.find(s => s.id === state.currentScriptId);
            if (!script) return;
            const m = script.metadata || script.meta || {};
            const requires = Array.isArray(m.require) ? m.require : [];
            const resources = Array.isArray(m.resource) ? m.resource : [];
            const urls = [...requires.map(r => typeof r === 'string' ? r : r.url), ...resources.map(r => typeof r === 'string' ? r.split(/\s+/)[1] || r : r.url)].filter(Boolean);
            if (urls.length === 0) { showToast('No external resources to refresh', 'info'); return; }
            showToast(`Refreshing ${urls.length} resource(s)...`, 'info');
            try {
                await chrome.runtime.sendMessage({ action: 'prefetchResources', resources: Object.fromEntries(urls.map((u, i) => [i, u])) });
                showToast('Resources refreshed', 'success');
            } catch (e) {
                showToast('Failed to refresh some resources', 'error');
            }
        });

        // Library search (cdnjs API)
        const libSearchInput = document.getElementById('libSearchInput');
        const libSearchResults = document.getElementById('libSearchResults');
        const btnLibSearch = document.getElementById('btnLibSearch');

        async function searchLibraries() {
            const query = libSearchInput?.value?.trim();
            if (!query) return;
            if (libSearchResults) {
                libSearchResults.innerHTML = '<div class="panel-empty"><strong>Searching libraries...</strong><span>Fetching matching packages from cdnjs.</span></div>';
            }
            try {
                const resp = await fetch(`https://api.cdnjs.com/libraries?search=${encodeURIComponent(query)}&fields=description,version,filename&limit=10`);
                if (!resp.ok) throw new Error('Search failed');
                const data = await resp.json();
                if (!data.results || data.results.length === 0) {
                    if (libSearchResults) {
                        libSearchResults.innerHTML = '<div class="panel-empty"><strong>No libraries found</strong><span>Try a broader package name like jquery, lodash, or react.</span></div>';
                    }
                    return;
                }
                if (libSearchResults) libSearchResults.innerHTML = data.results.filter(lib =>
                    lib.name && lib.version && lib.filename &&
                    !/[\/\\]|\.\./.test(lib.name) && !/[\/\\]|\.\./.test(lib.version) && !/\.\./.test(lib.filename)
                ).map(lib => {
                    const cdnUrl = `https://cdnjs.cloudflare.com/ajax/libs/${encodeURIComponent(lib.name)}/${encodeURIComponent(lib.version)}/${lib.filename}`;
                    return `<div class="lib-result">
                        <div class="lib-result-info">
                            <span class="lib-result-name">${escapeHtml(lib.name)}</span>
                            <span class="lib-result-version">v${escapeHtml(lib.version)}</span>
                            <div class="lib-result-desc">${escapeHtml(lib.description || '')}</div>
                        </div>
                        <button class="toolbar-btn primary lib-add-btn" data-lib-url="${escapeHtml(cdnUrl)}" title="Insert @require into script header">Add</button>
                    </div>`;
                }).join('');

                // Bind add buttons
                libSearchResults?.querySelectorAll('.lib-add-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const url = btn.dataset.libUrl;
                        if (!url || !state.editor) return;
                        const code = state.editor.getValue();
                        // Insert @require before ==/UserScript==
                        const insertLine = `// @require      ${url}`;
                        const updated = code.replace(/(\/\/\s*==\/UserScript==)/, insertLine + '\n$1');
                        if (updated !== code) {
                            state.editor.setValue(updated);
                            updateLineCount();
                            markCurrentEditorDirty();
                            btn.textContent = 'Added';
                            btn.disabled = true;
                            showToast('Library added to @require', 'success');
                        } else {
                            showToast('Could not find metadata block', 'error');
                        }
                    });
                });
            } catch (e) {
                if (libSearchResults) {
                    libSearchResults.innerHTML = `<div class="panel-empty"><strong>Search failed</strong><span>${escapeHtml(e.message)}</span></div>`;
                }
            }
        }

        btnLibSearch?.addEventListener('click', searchLibraries);
        libSearchInput?.addEventListener('keydown', e => { if (e.key === 'Enter') searchLibraries(); });

        // Editor toolbar buttons
        elements.tbtnUndo?.addEventListener('click', () => state.editor?.undo());
        elements.tbtnRedo?.addEventListener('click', () => state.editor?.redo());
        elements.tbtnSearch?.addEventListener('click', () => {
            if (state.editor?.isMonaco) {
                state.editor.execCommand('actions.find');
            } else if (state.editor) {
                try { state.editor.execCommand('findPersistent'); } catch { state.editor.execCommand('find'); }
            }
        });
        elements.tbtnReplace?.addEventListener('click', () => {
            if (state.editor?.isMonaco) {
                state.editor.execCommand('editor.action.startFindReplaceAction');
            } else if (state.editor) {
                try { state.editor.execCommand('replace'); } catch {}
            }
        });
        elements.tbtnBeautify?.addEventListener('click', beautifyCode);
        elements.tbtnLint?.addEventListener('click', () => {
            if (state.editor) {
                if (state.editor.isMonaco) {
                    showToast('Monaco editor handles diagnostics automatically', 'info');
                } else {
                    state.editor.performLint();
                    showToast('Lint check complete', 'info');
                }
            }
        });
        elements.tbtnFoldAll?.addEventListener('click', () => {
            if (state.editor?.isMonaco) {
                state.editor.foldAll();
            } else if (state.editor) {
                for (let i = 0; i < state.editor.lineCount(); i++) state.editor.foldCode(i);
            }
        });
        elements.tbtnUnfoldAll?.addEventListener('click', () => {
            if (state.editor?.isMonaco) {
                state.editor.unfoldAll();
            } else if (state.editor) {
                for (let i = 0; i < state.editor.lineCount(); i++) {
                    try { state.editor.foldCode(i, null, 'unfold'); } catch(e) {}
                }
            }
        });
        elements.tbtnJumpLine?.addEventListener('click', () => goToEditorLine(state.editor));

        // Comment toggle (Ctrl+/)
        document.getElementById('tbtnComment')?.addEventListener('click', () => {
            if (!state.editor) return;
            if (state.editor.isMonaco) {
                state.editor.toggleComment();
                markCurrentEditorDirty();
                return;
            }
            const cm = state.editor;
            const sel = cm.listSelections();
            cm.operation(() => {
                for (const range of sel) {
                    const from = Math.min(range.anchor.line, range.head.line);
                    const to = Math.max(range.anchor.line, range.head.line);
                    let allCommented = true;
                    for (let i = from; i <= to; i++) {
                        if (!cm.getLine(i).trimStart().startsWith('//')) { allCommented = false; break; }
                    }
                    for (let i = from; i <= to; i++) {
                        const line = cm.getLine(i);
                        if (allCommented) {
                            const idx = line.indexOf('//');
                            const after = line[idx + 2] === ' ' ? 3 : 2;
                            cm.replaceRange(line.slice(0, idx) + line.slice(idx + after), {line: i, ch: 0}, {line: i, ch: line.length});
                        } else {
                            cm.replaceRange('// ' + line, {line: i, ch: 0}, {line: i, ch: line.length});
                        }
                    }
                }
            });
            markCurrentEditorDirty();
        });

        // Word wrap toggle
        document.getElementById('tbtnWordWrap')?.addEventListener('click', () => {
            if (!state.editor) return;
            const current = state.editor.getOption('lineWrapping');
            state.editor.setOption('lineWrapping', !current);
            const btn = document.getElementById('tbtnWordWrap');
            if (btn) btn.classList.toggle('active', !current);
            showToast(`Word wrap ${!current ? 'on' : 'off'}`, 'info');
        });

        // Insert snippet dropdown
        document.getElementById('tbtnSnippet')?.addEventListener('click', () => {
            if (!state.editor) return;
            const snippets = {
                'GM_xmlhttpRequest': "GM_xmlhttpRequest({\n    method: 'GET',\n    url: '',\n    onload: function(response) {\n        console.log(response.responseText);\n    },\n    onerror: function(err) {\n        console.error(err);\n    }\n});",
                'GM_notification': "GM_notification({\n    text: '',\n    title: 'Notification',\n    timeout: 5000\n});",
                'GM_addStyle': "GM_addStyle(`\n    /* CSS here */\n`);",
                'GM_setValue / getValue': "const val = GM_getValue('key', 'default');\nGM_setValue('key', val);",
                'waitForElement': "function waitForElement(sel, cb) {\n    const el = document.querySelector(sel);\n    if (el) return cb(el);\n    new MutationObserver((_, obs) => {\n        const el = document.querySelector(sel);\n        if (el) { obs.disconnect(); cb(el); }\n    }).observe(document.body, { childList: true, subtree: true });\n}",
                'IIFE wrapper': "(function() {\n    'use strict';\n    \n})();",
                'addEventListener': "document.addEventListener('DOMContentLoaded', () => {\n    \n});"
            };
            const html = Object.entries(snippets).map(([name]) =>
                `<div class="snippet-item" data-snippet="${escapeHtml(name)}">${escapeHtml(name)}</div>`
            ).join('');
            showModal('Insert Snippet', `<div class="snippet-list">${html}</div>`, [
                { label: 'Cancel', callback: () => hideModal() }
            ]);
            document.querySelectorAll('.snippet-item').forEach(item => {
                item.addEventListener('click', () => {
                    const name = item.dataset.snippet;
                    const code = snippets[name];
                    if (code && state.editor) {
                        state.editor.replaceSelection(code);
                        markCurrentEditorDirty();
                    }
                    hideModal();
                });
            });
        });

        // Editor tabs
        elements.editorTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                setEditorTab(tab.dataset.panel);
            });
            tab.addEventListener('keydown', (event) => {
                const tabs = Array.from(elements.editorTabs || []);
                if (!tabs.length) return;

                let nextIndex = -1;
                switch (event.key) {
                    case 'ArrowLeft':
                        nextIndex = (tabs.indexOf(tab) - 1 + tabs.length) % tabs.length;
                        break;
                    case 'ArrowRight':
                        nextIndex = (tabs.indexOf(tab) + 1) % tabs.length;
                        break;
                    case 'Home':
                        nextIndex = 0;
                        break;
                    case 'End':
                        nextIndex = tabs.length - 1;
                        break;
                    default:
                        return;
                }

                event.preventDefault();
                setEditorTab(tabs[nextIndex]?.dataset.panel, { focusTab: true });
            });
        });

        // Add storage
        elements.btnAddStorage?.addEventListener('click', () => {
            if (!state.currentScriptId) return;
            showModal('Add Value', `
                <div class="form-group"><label>Key</label><input class="input-field" id="newKey" placeholder="key"></div>
                <div class="form-group"><label>Value</label><input class="input-field" id="newVal" placeholder="value"></div>
            `, [
                { label: 'Cancel', callback: hideModal },
                { label: 'Add', class: 'btn-primary', callback: async () => {
                    const key = document.getElementById('newKey').value.trim();
                    let val = document.getElementById('newVal').value;
                    if (!key) return showToast('Key required', 'error');
                    try { val = JSON.parse(val); } catch (e) {}
                    await chrome.runtime.sendMessage({ action: 'setScriptValue', scriptId: state.currentScriptId, key, value: val });
                    hideModal();
                    loadScriptStorage(state.scripts.find(s => s.id === state.currentScriptId));
                    showToast('Added', 'success');
                }}
            ]);
        });
        
        // Per-script settings
        elements.btnSaveScriptSettings?.addEventListener('click', saveScriptSettings);
        elements.btnResetScriptSettings?.addEventListener('click', resetScriptSettings);
        
        // URL Override controls
        elements.useOriginalIncludes?.addEventListener('change', updateOriginalPatternsState);
        elements.useOriginalMatches?.addEventListener('change', updateOriginalPatternsState);
        elements.useOriginalExcludes?.addEventListener('change', updateOriginalPatternsState);
        
        // Add pattern buttons
        elements.btnAddUserInclude?.addEventListener('click', () => {
            elements.userIncludeInput.classList.add('visible');
            elements.userIncludeInput.focus();
        });
        elements.btnAddUserMatch?.addEventListener('click', () => {
            elements.userMatchInput.classList.add('visible');
            elements.userMatchInput.focus();
        });
        elements.btnAddUserExclude?.addEventListener('click', () => {
            elements.userExcludeInput.classList.add('visible');
            elements.userExcludeInput.focus();
        });
        
        // Pattern input handlers
        const setupPatternInput = (input, listId, type) => {
            if (!input) return;
            
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const pattern = input.value.trim();
                    if (pattern) {
                        addUserPattern(listId, pattern, type);
                        input.value = '';
                    }
                    input.classList.remove('visible');
                } else if (e.key === 'Escape') {
                    input.value = '';
                    input.classList.remove('visible');
                }
            });
            
            input.addEventListener('blur', () => {
                const pattern = input.value.trim();
                if (pattern) {
                    addUserPattern(listId, pattern, type);
                    input.value = '';
                }
                input.classList.remove('visible');
            });
        };
        
        setupPatternInput(elements.userIncludeInput, 'userIncludesList', 'include');
        setupPatternInput(elements.userMatchInput, 'userMatchesList', 'match');
        setupPatternInput(elements.userExcludeInput, 'userExcludesList', 'exclude');

        // Settings listeners - comprehensive settings map
        const settingMap = {
            // General
            settingsConfigMode: ['configMode', 'value'],
            settingsLanguage: ['language', 'value'],
            settingsAutoReload: ['autoReload', 'checked'],
            settingsAnonymousStats: ['anonymousStats', 'checked'],
            settingsDebugMode: ['debugMode', 'checked'],
            settingsShowFixedSource: ['showFixedSource', 'checked'],
            settingsLoggingLevel: ['loggingLevel', 'value'],
            settingsTrashMode: ['trashMode', 'value'],
            
            // Tags
            settingsEnableTags: ['enableTags', 'checked'],
            
            // Action Menu
            settingsHideDisabledPopup: ['hideDisabledPopup', 'checked'],
            settingsPopupColumns: ['popupColumns', 'value', v => parseInt(v) || 1],
            settingsScriptOrder: ['scriptOrder', 'value'],
            settingsBadgeInfo: ['badgeInfo', 'value'],
            
            // Context Menu
            settingsEnableContextMenu: ['enableContextMenu', 'checked'],
            settingsContextMenuRunAt: ['contextMenuRunAt', 'checked'],
            settingsContextMenuCommands: ['contextMenuCommands', 'checked'],
            
            // Userscript Search
            settingsSearchIntegration: ['searchIntegration', 'value'],
            
            // Userscript Update
            settingsUpdateDisabled: ['updateDisabled', 'checked'],
            settingsSilentUpdate: ['silentUpdate', 'checked'],
            settingsCheckInterval: ['checkInterval', 'value', v => parseInt(v) || 24],
            settingsNotifyHideAfter: ['notifyHideAfter', 'value', v => parseInt(v) || 0],

            // Externals
            settingsExternalsInterval: ['externalsInterval', 'value', v => parseInt(v) || 24],
            
            // Sync
            settingsEnableSync: ['syncEnabled', 'checked'],
            
            // Editor
            settingsEnableEditor: ['enableEditor', 'checked'],
            settingsEditorTheme: ['editorTheme', 'value'],
            settingsEditorFontSize: ['editorFontSize', 'value', v => parseInt(v) || 100],
            settingsKeyMapping: ['keyMapping', 'value'],
            settingsIndentWidth: ['indentWidth', 'value', v => parseInt(v) || 4],
            settingsTabSize: ['tabSize', 'value', v => parseInt(v) || 4],
            settingsIndentWith: ['indentWith', 'value'],
            settingsTabMode: ['tabMode', 'value'],
            settingsHighlightMatches: ['highlightMatches', 'value'],
            settingsWordWrap: ['wordWrap', 'checked'],
            settingsReindent: ['reindent', 'checked'],
            settingsAutoSave: ['autoSave', 'checked'],
            settingsNoSaveConfirm: ['noSaveConfirm', 'checked'],
            settingsHighlightTrailingWhitespace: ['highlightTrailingWhitespace', 'checked'],
            settingsTrimWhitespace: ['trimWhitespace', 'checked'],
            settingsLintOnType: ['lintOnType', 'checked'],
            
            // Security
            settingsContentScriptAPI: ['contentScriptAPI', 'value'],
            settingsSandboxMode: ['sandboxMode', 'value'],
            settingsModifyCSP: ['modifyCSP', 'value'],
            settingsAllowHttpHeaders: ['allowHttpHeaders', 'value'],
            settingsDefaultTabTypes: ['defaultTabTypes', 'value'],
            settingsAllowLocalFiles: ['allowLocalFiles', 'value'],
            settingsAllowCookies: ['allowCookies', 'value'],
            settingsAllowCommunication: ['allowCommunication', 'value'],
            settingsSRI: ['sri', 'value'],
            settingsIncludeMode: ['includeMode', 'value'],
            settingsCheckConnect: ['checkConnect', 'value'],
            settingsIncognitoStorage: ['incognitoStorage', 'value'],
            settingsPageFilterMode: ['pageFilterMode', 'value'],
            
            // BlackCheck
            settingsBlacklistSource: ['blacklistSource', 'value'],
            settingsBlockSeverity: ['blockSeverity', 'value', v => parseInt(v) || 1],
            
            // Downloads
            settingsDownloadMode: ['downloadMode', 'value'],
            
            // Experimental
            settingsStrictMode: ['strictMode', 'value'],
            settingsTopLevelAwait: ['topLevelAwait', 'value']
        };

        Object.entries(settingMap).forEach(([id, [key, prop, fn]]) => {
            elements[id]?.addEventListener('change', e => saveSetting(key, fn ? fn(e.target[prop]) : e.target[prop]));
        });
        
        // Layout/Theme setting (saveSetting handles data-theme)
        elements.settingsLayout?.addEventListener('change', e => {
            saveSetting('layout', e.target.value);
        });
        
        // Badge color with preview
        elements.settingsBadgeColor?.addEventListener('input', e => {
            if (elements.badgeColorPreview) {
                elements.badgeColorPreview.style.backgroundColor = e.target.value;
            }
        });
        elements.settingsBadgeColor?.addEventListener('blur', e => {
            saveSetting('badgeColor', e.target.value);
        });

        // Sync Type with provider toggle
        elements.settingsSyncType?.addEventListener('change', e => {
            saveSetting('syncProvider', e.target.value);
            if (elements.cloudProvider && e.target.value && e.target.value !== 'none') {
                elements.cloudProvider.value = e.target.value;
            }
            toggleSyncProviderSettings();
        });

        // Text/URL inputs that save on blur
        elements.settingsWebdavUrl?.addEventListener('blur', e => saveSetting('webdavUrl', e.target.value.trim()));
        elements.settingsWebdavUsername?.addEventListener('blur', e => saveSetting('webdavUsername', e.target.value.trim()));
        elements.settingsWebdavPassword?.addEventListener('blur', e => saveSetting('webdavPassword', e.target.value));
        elements.settingsLintMaxSize?.addEventListener('blur', e => saveSetting('lintMaxSize', parseInt(e.target.value) || 500));

        // Textarea inputs that save on blur
        elements.settingsCustomCss?.addEventListener('blur', e => saveSetting('customCss', e.target.value));
        elements.settingsWhitelistedPages?.addEventListener('blur', e => saveSetting('whitelistedPages', e.target.value));
        elements.settingsBlacklistedPages?.addEventListener('blur', e => saveSetting('blacklistedPages', e.target.value));
        elements.settingsManualBlacklist?.addEventListener('blur', e => saveSetting('manualBlacklist', e.target.value));
        elements.settingsDownloadWhitelist?.addEventListener('blur', e => saveSetting('downloadWhitelist', e.target.value));
        elements.settingsLinterConfig?.addEventListener('blur', e => saveSetting('linterConfig', e.target.value));

        // Section Save buttons
        elements.btnSaveAppearance?.addEventListener('click', async () => {
            await saveSetting('customCss', elements.settingsCustomCss?.value || '');
        });
        
        elements.btnSaveActionMenu?.addEventListener('click', async () => {
            await saveSetting('badgeColor', elements.settingsBadgeColor?.value || '#ee3131');
            showToast('Action Menu saved', 'success');
        });
        
        elements.btnSaveSync?.addEventListener('click', async () => {
            const provider = elements.settingsSyncType?.value || 'none';
            await saveSetting('syncEnabled', !!elements.settingsEnableSync?.checked);
            await saveSetting('syncProvider', provider);
            if (provider === 'webdav') {
                await saveSetting('webdavUrl', elements.settingsWebdavUrl?.value.trim() || '');
                await saveSetting('webdavUsername', elements.settingsWebdavUsername?.value.trim() || '');
                await saveSetting('webdavPassword', elements.settingsWebdavPassword?.value || '');
            }
            showToast(
                provider === 'none'
                    ? 'Sync is disabled until you choose a provider'
                    : `Saved sync settings for ${provider}`,
                'success'
            );
        });
        
        elements.btnSaveEditor?.addEventListener('click', async () => {
            await saveSetting('linterConfig', elements.settingsLinterConfig?.value || '');
            showToast('Editor settings saved', 'success');
        });
        
        elements.btnSaveSecurity?.addEventListener('click', async () => {
            await saveSetting('whitelistedPages', elements.settingsWhitelistedPages?.value || '');
            await saveSetting('blacklistedPages', elements.settingsBlacklistedPages?.value || '');
            const hostsText = elements.settingsDeniedHosts?.value || '';
            await saveSetting('deniedHosts', hostsText.split('\n').map(s => s.trim()).filter(Boolean));
            showToast('Security settings saved', 'success');
        });
        
        elements.btnSaveBlackCheck?.addEventListener('click', async () => {
            await saveSetting('manualBlacklist', elements.settingsManualBlacklist?.value || '');
            showToast('BlackCheck settings saved', 'success');
        });
        
        elements.btnSaveDownloads?.addEventListener('click', async () => {
            await saveSetting('downloadWhitelist', elements.settingsDownloadWhitelist?.value || '');
            showToast('Download settings saved', 'success');
        });

        // Sync buttons
        elements.btnSyncNow?.addEventListener('click', async () => {
            showToast('Syncing...', 'info');
            try {
                const r = await chrome.runtime.sendMessage({ action: 'syncNow' });
                if (elements.syncLog) {
                    elements.syncLog.value = (elements.syncLog.value || '') + 
                        `[${new Date().toLocaleTimeString()}] ${r?.success ? 'Sync completed' : (r?.error || 'Failed')}\n`;
                }
                if (r?.success) {
                    state.settings.lastSync = Date.now();
                    if (elements.lastSyncTime) {
                        elements.lastSyncTime.textContent = formatSyncTimestamp(state.settings.lastSync);
                    }
                    await loadScripts();
                    updateStats();
                }
                showToast(r?.success ? 'Sync completed' : (r?.error || 'Sync failed'), r?.success ? 'success' : 'error');
            } catch (e) { showToast('Sync failed', 'error'); }
        });
        
        elements.btnSyncReset?.addEventListener('click', async () => {
            if (elements.syncLog) elements.syncLog.value = '';
            showToast('Sync log cleared', 'success');
        });
        
        // OAuth connection
        elements.btnConnectOAuth?.addEventListener('click', async () => {
            const syncType = elements.settingsSyncType?.value;
            if (syncType && ['googledrive', 'dropbox', 'onedrive'].includes(syncType)) {
                connectSyncProvider(syncType);
            }
        });
        
        elements.btnDisconnectOAuth?.addEventListener('click', async () => {
            const syncType = elements.settingsSyncType?.value;
            if (syncType) {
                disconnectSyncProvider(syncType);
            }
        });

        // Runtime host permissions
        async function persistDeniedHosts(nextDeniedHosts, successMessage) {
            const response = await chrome.runtime.sendMessage({ action: 'setSettings', settings: { deniedHosts: nextDeniedHosts } });
            if (response?.error) {
                showToast(response.error, 'error');
                return false;
            }
            state.settings.deniedHosts = nextDeniedHosts;
            if (elements.settingsDeniedHosts) {
                elements.settingsDeniedHosts.value = nextDeniedHosts.join('\n');
            }
            showToast(successMessage, 'success');
            return true;
        }

        elements.btnGrantSelected?.addEventListener('click', async () => {
            const textarea = elements.settingsDeniedHosts;
            const currentHosts = (state.settings.deniedHosts || []).slice();
            if (!textarea || currentHosts.length === 0) {
                showToast('No denied hosts to restore', 'info');
                return;
            }
            const selectedText = textarea.value.slice(textarea.selectionStart || 0, textarea.selectionEnd || 0).trim();
            if (!selectedText) {
                showToast('Select one or more hosts in the list first', 'info');
                return;
            }
            const selectedHosts = new Set(selectedText.split(/\r?\n/).map(value => value.trim()).filter(Boolean));
            const nextDeniedHosts = currentHosts.filter(host => !selectedHosts.has(host));
            if (nextDeniedHosts.length === currentHosts.length) {
                showToast('Selected hosts were not found in the saved deny list', 'info');
                return;
            }
            await persistDeniedHosts(nextDeniedHosts, `Restored ${numberFormatter.format(currentHosts.length - nextDeniedHosts.length)} host permission${currentHosts.length - nextDeniedHosts.length === 1 ? '' : 's'}`);
        });
        elements.btnGrantAll?.addEventListener('click', async () => {
            const currentHosts = state.settings.deniedHosts || [];
            if (!currentHosts.length) {
                showToast('No denied hosts to restore', 'info');
                return;
            }
            if (!await showConfirmModal('Restore all denied hosts?', `Remove ${currentHosts.length} remembered host deny entr${currentHosts.length === 1 ? 'y' : 'ies'} from ScriptVault's runtime list.`)) {
                return;
            }
            await persistDeniedHosts([], 'Cleared all denied host entries');
        });
        elements.btnResetPermissions?.addEventListener('click', () => {
            if (elements.settingsDeniedHosts) {
                elements.settingsDeniedHosts.value = (state.settings.deniedHosts || []).join('\n');
                elements.settingsDeniedHosts.focus();
                elements.settingsDeniedHosts.select();
            }
            showToast('Reloaded the saved denied host list', 'info');
        });

        // Reset buttons
        elements.btnRestartExtension?.addEventListener('click', async () => {
            if (!await showConfirmModal('Restart', 'Restart ScriptVault?')) return;
            await chrome.runtime.sendMessage({ action: 'restart' });
            showToast('Restarting...', 'info');
        });
        
        elements.btnFactoryReset?.addEventListener('click', async () => {
            if (!await showConfirmModal('Factory Reset', 'This will delete all scripts and reset all settings. This cannot be undone. Continue?')) return;
            await chrome.runtime.sendMessage({ action: 'factoryReset' });
            await loadSettings();
            await loadScripts();
            showToast('Factory reset complete', 'success');
        });

        // Utilities
        elements.btnExportFile?.addEventListener('click', async event => {
            await runButtonTask(event.currentTarget, exportAllScripts, { busyLabel: 'Exporting JSON…' });
        });
        elements.btnExportZip?.addEventListener('click', async event => {
            await runButtonTask(event.currentTarget, exportToZip, { busyLabel: 'Exporting ZIP…' });
        });
        elements.btnCreateBackup?.addEventListener('click', async event => {
            await runButtonTask(event.currentTarget, async () => {
                showToast('Creating backup…', 'info');
                try {
                    const response = await chrome.runtime.sendMessage({ action: 'createBackup', reason: 'manual' });
                    if (response?.error || response?.success === false) {
                        showToast(response?.error || 'Backup failed', 'error');
                        return;
                    }
                    await loadBackups();
                    showToast('Backup created', 'success');
                } catch (error) {
                    showToast(error?.message || 'Backup failed', 'error');
                }
            }, { busyLabel: 'Creating Backup…' });
        });
        elements.btnImportBackupArchive?.addEventListener('click', () => elements.backupArchiveInput?.click());
        elements.btnRefreshBackups?.addEventListener('click', async event => {
            await runButtonTask(event.currentTarget, () => loadBackups({ announce: true }), { busyLabel: 'Refreshing…' });
        });
        elements.backupBrowserFilterButtons?.forEach(button => {
            button.addEventListener('click', () => {
                state.backupBrowserFilter = button.dataset.backupBrowserFilter || 'all';
                applyBackupBrowserFilters();
            });
        });
        elements.backupBrowserQuickFilter?.addEventListener('input', () => {
            state.backupBrowserQuery = elements.backupBrowserQuickFilter?.value || '';
            applyBackupBrowserFilters();
        });
        elements.backupBrowserSort?.addEventListener('change', () => {
            state.backupBrowserSort = elements.backupBrowserSort?.value || 'newest';
            applyBackupBrowserFilters();
        });
        elements.btnResetBackupBrowser?.addEventListener('click', resetBackupBrowserView);
        elements.backupArchiveInput?.addEventListener('change', async event => {
            const file = event.target.files?.[0];
            if (!file) return;
            showProgress(`Importing ${file.name}...`);
            updateProgress(0, 1, 'Reading archive...');
            try {
                const buf = await file.arrayBuffer();
                const bytes = new Uint8Array(buf);
                let binary = '';
                for (let i = 0; i < bytes.length; i += 8192) {
                    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
                }
                updateProgress(1, 2, 'Saving backup...');
                const response = await chrome.runtime.sendMessage({ action: 'importBackup', zipData: btoa(binary) });
                hideProgress();
                if (response?.error || response?.success === false || !response?.backupId) {
                    showToast(response?.error || 'Failed to import backup archive', 'error');
                    return;
                }
                await loadBackups();
                showToast('Backup archive imported', 'success');
                await openBackupReviewModal(response.backupId);
            } catch (error) {
                hideProgress();
                showToast(error?.message || 'Failed to import backup archive', 'error');
            } finally {
                event.target.value = '';
            }
        });
        elements.backupScheduleType?.addEventListener('change', () => {
            applyBackupScheduleFormState();
            updateBackupScheduleSummary({
                ...(state.backupSettings || {}),
                enabled: !!elements.backupEnabled?.checked,
                scheduleType: elements.backupScheduleType?.value || 'manual',
                hour: Number(elements.backupHour?.value || 3),
                dayOfWeek: Number(elements.backupDayOfWeek?.value || 0),
                maxBackups: Number(elements.backupMaxBackups?.value || 5),
                notifyOnSuccess: !!elements.backupNotifyOnSuccess?.checked,
                notifyOnFailure: !!elements.backupNotifyOnFailure?.checked
            });
        });
        elements.backupEnabled?.addEventListener('change', () => updateBackupScheduleSummary({
            ...(state.backupSettings || {}),
            enabled: !!elements.backupEnabled?.checked,
            scheduleType: elements.backupScheduleType?.value || 'manual',
            hour: Number(elements.backupHour?.value || 3),
            dayOfWeek: Number(elements.backupDayOfWeek?.value || 0),
            maxBackups: Number(elements.backupMaxBackups?.value || 5),
            notifyOnSuccess: !!elements.backupNotifyOnSuccess?.checked,
            notifyOnFailure: !!elements.backupNotifyOnFailure?.checked
        }));
        elements.backupHour?.addEventListener('input', () => updateBackupScheduleSummary({
            ...(state.backupSettings || {}),
            enabled: !!elements.backupEnabled?.checked,
            scheduleType: elements.backupScheduleType?.value || 'manual',
            hour: Number(elements.backupHour?.value || 3),
            dayOfWeek: Number(elements.backupDayOfWeek?.value || 0),
            maxBackups: Number(elements.backupMaxBackups?.value || 5),
            notifyOnSuccess: !!elements.backupNotifyOnSuccess?.checked,
            notifyOnFailure: !!elements.backupNotifyOnFailure?.checked
        }));
        elements.backupDayOfWeek?.addEventListener('change', () => updateBackupScheduleSummary({
            ...(state.backupSettings || {}),
            enabled: !!elements.backupEnabled?.checked,
            scheduleType: elements.backupScheduleType?.value || 'manual',
            hour: Number(elements.backupHour?.value || 3),
            dayOfWeek: Number(elements.backupDayOfWeek?.value || 0),
            maxBackups: Number(elements.backupMaxBackups?.value || 5),
            notifyOnSuccess: !!elements.backupNotifyOnSuccess?.checked,
            notifyOnFailure: !!elements.backupNotifyOnFailure?.checked
        }));
        elements.backupMaxBackups?.addEventListener('input', () => updateBackupScheduleSummary({
            ...(state.backupSettings || {}),
            enabled: !!elements.backupEnabled?.checked,
            scheduleType: elements.backupScheduleType?.value || 'manual',
            hour: Number(elements.backupHour?.value || 3),
            dayOfWeek: Number(elements.backupDayOfWeek?.value || 0),
            maxBackups: Number(elements.backupMaxBackups?.value || 5),
            notifyOnSuccess: !!elements.backupNotifyOnSuccess?.checked,
            notifyOnFailure: !!elements.backupNotifyOnFailure?.checked
        }));
        elements.backupNotifyOnSuccess?.addEventListener('change', () => updateBackupScheduleSummary({
            ...(state.backupSettings || {}),
            enabled: !!elements.backupEnabled?.checked,
            scheduleType: elements.backupScheduleType?.value || 'manual',
            hour: Number(elements.backupHour?.value || 3),
            dayOfWeek: Number(elements.backupDayOfWeek?.value || 0),
            maxBackups: Number(elements.backupMaxBackups?.value || 5),
            notifyOnSuccess: !!elements.backupNotifyOnSuccess?.checked,
            notifyOnFailure: !!elements.backupNotifyOnFailure?.checked
        }));
        elements.backupNotifyOnFailure?.addEventListener('change', () => updateBackupScheduleSummary({
            ...(state.backupSettings || {}),
            enabled: !!elements.backupEnabled?.checked,
            scheduleType: elements.backupScheduleType?.value || 'manual',
            hour: Number(elements.backupHour?.value || 3),
            dayOfWeek: Number(elements.backupDayOfWeek?.value || 0),
            maxBackups: Number(elements.backupMaxBackups?.value || 5),
            notifyOnSuccess: !!elements.backupNotifyOnSuccess?.checked,
            notifyOnFailure: !!elements.backupNotifyOnFailure?.checked
        }));
        elements.btnSaveBackupSettings?.addEventListener('click', async event => {
            await runButtonTask(event.currentTarget, saveBackupSettings, { busyLabel: 'Saving Schedule…' });
        });
        document.getElementById('btnExportStats')?.addEventListener('click', exportStatsCSV);
        // Tampermonkey backup import
        document.getElementById('btnImportTampermonkey')?.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.txt,.tampermonkey';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const text = await file.text();
                if (!text.includes('==UserScript==')) {
                    showToast('Not a valid Tampermonkey backup file', 'error');
                    return;
                }
                showProgress('Importing Tampermonkey backup...');
                updateProgress(0, 1, 'Parsing scripts...');
                try {
                    const res = await chrome.runtime.sendMessage({ action: 'importTampermonkeyBackup', text, overwrite: true });
                    if (res?.error) {
                        showToast(res.error, 'error');
                    } else {
                        showToast(`Imported ${res?.imported || 0} scripts${res?.skipped ? `, ${res.skipped} skipped` : ''}${res?.errors?.length ? `, ${res.errors.length} errors` : ''}`, 'success');
                        await loadScripts();
                        updateStats();
                    }
                } catch (err) {
                    showToast('Import failed: ' + err.message, 'error');
                }
                hideProgress();
            };
            input.click();
        });

        document.getElementById('btnClearLog')?.addEventListener('click', () => {
            const logEl = document.getElementById('activityLog');
            if (logEl) logEl.innerHTML = '<div style="color:var(--text-muted)">No activity yet</div>';
        });

        elements.btnRefreshRuntimeStatus?.addEventListener('click', () => loadRuntimeStatus({ announce: true }));
        elements.btnShowSetupGuide?.addEventListener('click', showSetupInstructions);
        elements.btnRepairRuntime?.addEventListener('click', async () => {
            if (!await showConfirmModal('Repair runtime?', 'Rebuild registrations, context menus, alarms, and badge state now.')) return;
            try {
                const result = await chrome.runtime.sendMessage({ action: 'repairRuntimeState' });
                if (result?.error || result?.success === false) {
                    showToast(result?.error || 'Runtime repair failed', 'error');
                    return;
                }
                state.trustCenter.lastRuntimeRepairAt = Date.now();
                state.trustCenter.runtimeStatus = result;
                renderRuntimeStatus(result);
                showToast('Runtime repaired', 'success');
            } catch (error) {
                showToast(error?.message || 'Runtime repair failed', 'error');
            }
        });
        elements.btnExportSupportSnapshot?.addEventListener('click', exportSupportSnapshot);
        elements.btnRefreshPublicApiTrust?.addEventListener('click', () => loadPublicApiTrustState({ announce: true }));
        elements.btnSavePublicApiOrigins?.addEventListener('click', async () => {
            const { origins, invalid } = normalizeTrustedOriginInput(elements.publicApiTrustedOrigins?.value || '');
            if (invalid.length) {
                showToast(`Invalid origin: ${invalid[0]}`, 'error');
                return;
            }
            try {
                const response = await chrome.runtime.sendMessage({ action: 'publicApi_setTrustedOrigins', data: { origins } });
                if (response?.error) {
                    showToast(response.error, 'error');
                    return;
                }
                await loadPublicApiTrustState();
                showToast(`Saved ${origins.length} trusted origin${origins.length === 1 ? '' : 's'}`, 'success');
            } catch (error) {
                showToast(error?.message || 'Failed to save trusted origins', 'error');
            }
        });
        elements.btnClearPublicApiAudit?.addEventListener('click', async () => {
            if (!await showConfirmModal('Clear audit log?', 'Remove recent Public API audit entries from the local log.')) return;
            try {
                const response = await chrome.runtime.sendMessage({ action: 'publicApi_clearAuditLog' });
                if (response?.error) {
                    showToast(response.error, 'error');
                    return;
                }
                await loadPublicApiTrustState();
                showToast('Public API audit log cleared', 'success');
            } catch (error) {
                showToast(error?.message || 'Failed to clear audit log', 'error');
            }
        });
        elements.btnRefreshSigningTrust?.addEventListener('click', () => loadSigningTrustState({ announce: true }));

        // Workspaces
        document.getElementById('btnCreateWorkspace')?.addEventListener('click', async () => {
            const name = await showInputModal({
                title: 'Save Workspace',
                label: 'Workspace name',
                placeholder: 'Work setup',
                confirmLabel: 'Save',
                validate: value => value ? '' : 'Enter a workspace name.'
            });
            if (!name) return;
            const res = await chrome.runtime.sendMessage({ action: 'createWorkspace', name });
            if (res?.workspace) { showToast('Workspace saved', 'success'); loadWorkspaces(); }
        });

        // Network Log
        document.getElementById('btnRefreshNetLog')?.addEventListener('click', loadNetworkLog);
        document.getElementById('btnClearNetLog')?.addEventListener('click', async () => {
            await chrome.runtime.sendMessage({ action: 'clearNetworkLog' });
            loadNetworkLog();
            showToast('Network log cleared', 'success');
        });
        document.getElementById('btnExportNetLog')?.addEventListener('click', async () => {
            const res = await chrome.runtime.sendMessage({ action: 'getNetworkLog' });
            const logEntries = Array.isArray(res) ? res : (Array.isArray(res?.log) ? res.log : []);
            if (!logEntries.length) { showToast('No requests to export', 'info'); return; }
            const har = {
                log: {
                    version: '1.2',
                    creator: { name: 'ScriptVault', version: chrome.runtime.getManifest().version },
                    entries: logEntries.map(e => ({
                        startedDateTime: new Date(e.timestamp).toISOString(),
                        time: e.duration || 0,
                        request: { method: e.method, url: e.url, httpVersion: 'HTTP/1.1', headers: [], queryString: [], bodySize: e.requestSize || 0 },
                        response: { status: e.status || 0, statusText: e.statusText || '', httpVersion: 'HTTP/1.1', headers: [], content: { size: e.responseSize || 0, mimeType: 'text/plain' }, bodySize: e.responseSize || 0 },
                        comment: e.scriptName || ''
                    }))
                }
            };
            const blob = new Blob([JSON.stringify(har, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `scriptvault-netlog-${new Date().toISOString().split('T')[0]}.har`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            showToast('Exported as HAR', 'success');
        });

        // Performance Budget
        document.getElementById('btnSavePerfBudget')?.addEventListener('click', async () => {
            const budget = parseInt(document.getElementById('perfBudgetDefault')?.value || '200');
            if (isNaN(budget) || budget < 10) { showToast('Invalid budget', 'error'); return; }
            await chrome.runtime.sendMessage({ action: 'setSettings', settings: { perfBudget: budget } });
            state.settings.perfBudget = budget;
            showToast(`Budget set to ${budget}ms`, 'success');
            renderScriptTable();
        });

        elements.btnChooseFile?.addEventListener('click', () => elements.importFileInput?.click());

        // Cloud
        async function updateCloudUI() {
            const provider = elements.cloudProvider?.value || normalizeSyncProvider(state.settings);
            const st = elements.cloudStatusText;
            const ui = elements.cloudUserInfo;
            const bc = elements.btnCloudConnect;
            const bd = elements.btnCloudDisconnect;
            const ar = elements.cloudActionsRow;
            if (!provider || provider === 'none') {
                if (st) { st.textContent = 'Not configured'; st.style.color = 'var(--text-muted)'; }
                if (ui) ui.textContent = '';
                if (bc) bc.style.display = 'none';
                if (bd) bd.style.display = 'none';
                if (ar) ar.style.display = 'none';
                updateUtilitiesOverview();
                return;
            }
            try {
                const r = await chrome.runtime.sendMessage({ action: 'cloudStatus', provider });
                if (r?.connected) {
                    if (st) { st.textContent = 'Connected'; st.style.color = 'var(--accent)'; }
                    if (ui) ui.textContent = r.user?.email || r.user?.name || '';
                    if (bc) bc.style.display = 'none';
                    if (bd) bd.style.display = '';
                    if (ar) ar.style.display = '';
                } else {
                    if (st) { st.textContent = 'Not connected'; st.style.color = 'var(--text-muted)'; }
                    if (ui) ui.textContent = '';
                    if (bc) bc.style.display = '';
                    if (bd) bd.style.display = 'none';
                    if (ar) ar.style.display = 'none';
                }
            } catch (e) {
                if (st) { st.textContent = 'Error'; st.style.color = 'var(--danger)'; }
            }
            updateUtilitiesOverview();
        }

        elements.cloudProvider?.addEventListener('change', async () => {
            const provider = elements.cloudProvider?.value || 'none';
            state.settings.syncProvider = provider;
            syncSettingsProviderSelection(provider);
            toggleSyncProviderSettings();
            await updateCloudUI();
        });
        updateCloudUI();

        elements.btnCloudConnect?.addEventListener('click', async () => {
            const provider = elements.cloudProvider?.value || 'none';
            if (provider === 'none') {
                showToast('Choose a sync provider first', 'info');
                return;
            }
            // Request identity permission if needed for OAuth providers
            if (['googledrive', 'dropbox'].includes(provider)) {
                try {
                    const granted = await chrome.permissions.request({ permissions: ['identity'] });
                    if (!granted) {
                        showToast('Permission denied - identity access required', 'error');
                        return;
                    }
                } catch (e) {
                    showToast('Permission request failed: ' + e.message, 'error');
                    return;
                }
            }
            showToast('Connecting...', 'info');
            try {
                const r = await chrome.runtime.sendMessage({ action: 'connectSyncProvider', provider });
                if (r?.success) {
                    showToast('Connected to ' + provider, 'success');
                    await updateCloudUI();
                } else {
                    showToast(r?.error || 'Connection failed', 'error');
                }
            } catch (e) { showToast('Failed: ' + e.message, 'error'); }
        });

        elements.btnCloudDisconnect?.addEventListener('click', async () => {
            const provider = elements.cloudProvider?.value || 'none';
            if (provider === 'none') {
                showToast('Choose a sync provider first', 'info');
                return;
            }
            try {
                await chrome.runtime.sendMessage({ action: 'disconnectSyncProvider', provider });
                showToast('Disconnected', 'success');
                await updateCloudUI();
            } catch (e) { showToast('Failed: ' + e.message, 'error'); }
        });

        elements.btnCloudExport?.addEventListener('click', async () => {
            const provider = elements.cloudProvider?.value || 'none';
            if (provider === 'none') {
                showToast('Choose a sync provider first', 'info');
                return;
            }
            const transfer = getTransferPreferences();
            showToast('Backing up to ' + provider + '...', 'info');
            try {
                const r = await chrome.runtime.sendMessage({
                    action: 'cloudExport',
                    provider,
                    includeSettings: transfer.includeSettings,
                    includeStorage: transfer.includeStorage
                });
                if (r?.success) {
                    const parts = [`${numberFormatter.format(r.exported || 0)} scripts backed up`];
                    parts.push(r.storageIncluded ? 'stored values included' : 'stored values excluded');
                    parts.push(r.settingsIncluded ? 'app settings included' : 'app settings excluded');
                    showToast(`Cloud backup ready: ${parts.join(', ')}`, 'success');
                } else {
                    showToast(r?.error || 'Export failed', 'error');
                }
            } catch (e) { showToast('Export failed: ' + e.message, 'error'); }
        });

        elements.btnCloudImport?.addEventListener('click', async () => {
            const provider = elements.cloudProvider?.value || 'none';
            if (provider === 'none') {
                showToast('Choose a sync provider first', 'info');
                return;
            }
            const transfer = getTransferPreferences();
            const confirmed = await showConfirmModal(
                'Restore From Cloud',
                buildImportConfirmationMessage(provider, {
                    supportsSettings: true,
                    supportsStorage: true,
                    importSettings: transfer.includeSettings,
                    importStorage: transfer.includeStorage,
                    overwriteTarget: 'matching scripts in this vault'
                })
            );
            if (!confirmed) return;
            showToast('Restoring from ' + provider + '...', 'info');
            try {
                const r = await chrome.runtime.sendMessage({
                    action: 'cloudImport',
                    provider,
                    importSettings: transfer.includeSettings,
                    importStorage: transfer.includeStorage
                });
                if (r?.success) {
                    await loadScripts();
                    await loadSettings();
                    updateStats();
                    showToast(`Cloud restore: ${formatImportSummary(r)}`, getImportResultTone(r));
                } else {
                    showToast(r?.error || 'Import failed', 'error');
                }
            } catch (e) { showToast('Import failed: ' + e.message, 'error'); }
        });
        elements.importFileInput?.addEventListener('change', async e => {
            const input = e.target;
            const file = input.files?.[0];
            if (!file) {
                if (elements.importFileName) elements.importFileName.textContent = 'No file chosen';
                return;
            }
            if (elements.importFileName) elements.importFileName.textContent = file.name;
            try {
                const isZip = file.name.endsWith('.zip');
                const transfer = getTransferPreferences();
                const isScriptFile = file.name.endsWith('.user.js') || file.name.endsWith('.js');
                const confirmMessage = isZip
                    ? buildImportConfirmationMessage(file.name, {
                        supportsStorage: true,
                        importStorage: true,
                        settingsUnavailableReason: 'ZIP archives do not include ScriptVault settings.'
                    })
                    : isScriptFile
                        ? `Install ${file.name}?`
                        : buildImportConfirmationMessage(file.name, {
                            supportsSettings: true,
                            supportsStorage: true,
                            importSettings: transfer.includeSettings,
                            importStorage: transfer.includeStorage
                        });
                if (!await showConfirmModal(isScriptFile ? 'Install Script' : 'Restore File', confirmMessage)) return;
                showProgress(`Importing ${file.name}...`);
                updateProgress(0, 1, 'Reading file...');
                try {
                    if (isZip) {
                        const buf = await file.arrayBuffer();
                        const bytes = new Uint8Array(buf);
                        let binary = '';
                        for (let i = 0; i < bytes.length; i += 8192) {
                            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
                        }
                        updateProgress(1, 2, 'Processing zip...');
                        const b64 = btoa(binary);
                        const r = await chrome.runtime.sendMessage({ action: 'importFromZip', zipData: b64, options: { overwrite: true } });
                        showToast(
                            r?.error ? r.error : `${file.name}: ${formatImportSummary(r)}`,
                            r?.error ? 'error' : getImportResultTone(r)
                        );
                    } else if (file.name.endsWith('.user.js') || file.name.endsWith('.js')) {
                        const code = await file.text();
                        updateProgress(1, 2, 'Installing script...');
                        const r = await chrome.runtime.sendMessage({ action: 'saveScript', code });
                        if (r?.success) {
                            showToast('Script installed', 'success');
                        } else {
                            showToast(r?.error || 'Install failed', 'error');
                        }
                    } else {
                        const data = JSON.parse(await file.text());
                        updateProgress(1, 2, 'Importing scripts...');
                        const r = await chrome.runtime.sendMessage({
                            action: 'importAll',
                            data: {
                                data,
                                options: {
                                    overwrite: true,
                                    importSettings: transfer.includeSettings,
                                    importStorage: transfer.includeStorage
                                }
                            }
                        });
                        showToast(
                            r?.error ? r.error : `${file.name}: ${formatImportSummary(r)}`,
                            r?.error ? 'error' : getImportResultTone(r)
                        );
                    }
                    await loadScripts();
                    await loadSettings();
                    updateStats();
                } catch (err) {
                    showToast('Failed: ' + err.message, 'error');
                } finally {
                    hideProgress();
                }
            } finally {
                input.value = '';
                if (elements.importFileName) elements.importFileName.textContent = 'No file chosen';
            }
        });

        elements.btnInstallFromUrl?.addEventListener('click', async event => {
            await runButtonTask(event.currentTarget, installFromUrl, { busyLabel: 'Installing…' });
        });

        // Batch URL install
        document.getElementById('btnBatchInstall')?.addEventListener('click', async event => {
            await runButtonTask(event.currentTarget, async () => {
                const textarea = document.getElementById('batchUrlInput');
                const urls = (textarea?.value || '').split('\n').map(u => u.trim()).filter(u => u && u.startsWith('http'));
                if (urls.length === 0) return showToast('No valid URLs found', 'error');
                if (!await showConfirmModal('Batch Install', `Install ${urls.length} script${urls.length > 1 ? 's' : ''} from URLs?`)) return;
                showProgress(`Installing ${urls.length} scripts...`);
                let installed = 0, failed = 0;
                try {
                    for (let i = 0; i < urls.length; i++) {
                        updateProgress(i + 1, urls.length, urls[i].split('/').pop() || urls[i]);
                        try {
                            const res = await chrome.runtime.sendMessage({ action: 'installFromUrl', url: urls[i] });
                            if (res?.success) installed++;
                            else failed++;
                        } catch (e) {
                            failed++;
                        }
                    }
                    await loadScripts();
                    updateStats();
                    if (textarea) textarea.value = '';
                    showToast(`Installed ${installed}${failed > 0 ? `, ${failed} failed` : ''}`, installed > 0 ? 'success' : 'error');
                } finally {
                    hideProgress();
                }
            }, { busyLabel: 'Installing…' });
        });

        elements.btnTextareaExport?.addEventListener('click', async event => {
            await runButtonTask(event.currentTarget, async () => {
                const transfer = getTransferPreferences();
                const r = await chrome.runtime.sendMessage({
                    action: 'exportAll',
                    options: {
                        includeSettings: transfer.includeSettings,
                        includeStorage: transfer.includeStorage
                    }
                });
                if (r && elements.textareaData) {
                    elements.textareaData.value = JSON.stringify(r, null, 2);
                    showToast('JSON export copied into textarea', 'success');
                }
            }, { busyLabel: 'Exporting…' });
        });

        elements.btnTextareaImport?.addEventListener('click', async event => {
            await runButtonTask(event.currentTarget, async () => {
                const txt = elements.textareaData?.value?.trim();
                if (!txt) return showToast('Empty', 'error');
                try {
                    const data = JSON.parse(txt);
                    const transfer = getTransferPreferences();
                    if (!await showConfirmModal('Restore JSON', buildImportConfirmationMessage('textarea data', {
                        supportsSettings: true,
                        supportsStorage: true,
                        importSettings: transfer.includeSettings,
                        importStorage: transfer.includeStorage
                    }))) return;
                    showProgress(`Importing ${data.scripts?.length || 0} scripts...`);
                    updateProgress(0, 1, 'Processing...');
                    try {
                        const result = await chrome.runtime.sendMessage({
                            action: 'importAll',
                            data: {
                                data,
                                options: {
                                    overwrite: true,
                                    importSettings: transfer.includeSettings,
                                    importStorage: transfer.includeStorage
                                }
                            }
                        });
                        await loadScripts();
                        await loadSettings();
                        updateStats();
                        showToast(
                            result?.error ? result.error : `Textarea restore: ${formatImportSummary(result)}`,
                            result?.error ? 'error' : getImportResultTone(result)
                        );
                    } finally {
                        hideProgress();
                    }
                } catch (e) {
                    showToast('Invalid JSON', 'error');
                }
            }, { busyLabel: 'Restoring…' });
        });

        // Modal
        elements.modalClose?.addEventListener('click', hideModal);
        elements.modal?.addEventListener('click', e => { if (e.target === elements.modal) hideModal(); });

        // Pattern tester
        document.getElementById('btnTestPattern')?.addEventListener('click', testPatterns);
        document.getElementById('patternTestUrl')?.addEventListener('keydown', e => { if (e.key === 'Enter') testPatterns(); });

        // Keyboard shortcuts
        document.addEventListener('keydown', async e => {
            const ctrl = e.ctrlKey || e.metaKey;
            const editorActive = elements.editorOverlay?.classList.contains('active');
            const modalOpen = elements.modal?.classList.contains('show');
            const paletteOpen = document.getElementById('commandPalette')?.classList.contains('open');

            if (modalOpen) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    hideModal();
                }
                return;
            }

            if (paletteOpen && !(ctrl && e.key === 'k')) {
                return;
            }

            // Ctrl+S — save in editor
            if (ctrl && e.key === 's' && editorActive) {
                e.preventDefault();
                saveCurrentScript();
                return;
            }
            // Escape — close editor
            if (e.key === 'Escape' && !e.defaultPrevented && editorActive) {
                closeEditor();
                return;
            }
            // Ctrl+N — new script
            if (ctrl && e.key === 'n' && !editorActive) {
                e.preventDefault();
                createNewScript();
                return;
            }
            // Ctrl+F — focus script search on the scripts tab
            if (ctrl && e.key === 'f' && !editorActive && elements.mainPanels.scripts?.classList.contains('active')) {
                e.preventDefault();
                elements.scriptSearch?.focus();
                elements.scriptSearch?.select?.();
                return;
            }
            // Ctrl+I — import script
            if (ctrl && e.key === 'i' && !editorActive) {
                e.preventDefault();
                importScript();
                return;
            }
            // Alt+1-6 — switch dashboard tabs
            if (e.altKey && !ctrl && e.key >= '1' && e.key <= String(DASHBOARD_TABS.length)) {
                e.preventDefault();
                const idx = parseInt(e.key) - 1;
                const tabName = DASHBOARD_TABS[idx];
                if (tabName) await switchTab(tabName);
                return;
            }
            // Ctrl+W — close current script tab
            if (ctrl && e.key === 'w' && editorActive && state.currentScriptId) {
                e.preventDefault();
                closeScriptTab(state.currentScriptId);
                return;
            }
            // Ctrl+Tab / Ctrl+Shift+Tab — cycle open script tabs
            if (ctrl && e.key === 'Tab' && editorActive) {
                e.preventDefault();
                const openIds = Object.keys(state.openTabs);
                if (openIds.length < 2) return;
                const curIdx = openIds.indexOf(state.currentScriptId);
                const nextIdx = e.shiftKey
                    ? (curIdx - 1 + openIds.length) % openIds.length
                    : (curIdx + 1) % openIds.length;
                activateScriptTab(openIds[nextIdx]);
                return;
            }
            // Ctrl+K — command palette
            if (ctrl && e.key === 'k') {
                e.preventDefault();
                openCommandPalette();
                return;
            }
            // Ctrl+/ — focus dashboard search
            if (ctrl && e.key === '/' && !editorActive) {
                e.preventDefault();
                elements.scriptSearch?.focus();
                return;
            }
        });

        window.addEventListener('beforeunload', e => {
            const anyUnsaved = state.unsavedChanges || Object.values(state.openTabs).some(t => t.unsaved);
            if (anyUnsaved) { e.preventDefault(); e.returnValue = ''; }
        });

        // Surface unhandled promise rejections to the activity log so they're visible
        window.addEventListener('unhandledrejection', e => {
            const msg = e.reason?.message || String(e.reason) || 'Unknown error';
            console.error('[ScriptVault] Unhandled rejection:', e.reason);
            logActivity('Internal error: ' + msg, 'error');
        });

        // Drag-and-drop file installation
        const dropZone = document.body;
        let _dragCounter = 0;

        dropZone.addEventListener('dragenter', e => {
            if (!e.dataTransfer?.types?.includes('Files')) return;
            e.preventDefault();
            _dragCounter++;
            if (_dragCounter === 1) showDropOverlay(true);
        });
        dropZone.addEventListener('dragleave', () => {
            _dragCounter--;
            if (_dragCounter <= 0) { _dragCounter = 0; showDropOverlay(false); }
        });
        dropZone.addEventListener('dragover', e => {
            if (!e.dataTransfer?.types?.includes('Files')) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });
        dropZone.addEventListener('drop', async e => {
            e.preventDefault();
            _dragCounter = 0;
            showDropOverlay(false);
            const files = [...(e.dataTransfer?.files || [])];
            if (files.length === 0) return;

            let installed = 0, errors = 0;
            showProgress('Installing dropped files...');

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                updateProgress(i + 1, files.length, file.name);
                try {
                    if (file.name.endsWith('.user.js') || file.name.endsWith('.js')) {
                        const code = await file.text();
                        if (!code.includes('==UserScript==')) { errors++; continue; }
                        const res = await chrome.runtime.sendMessage({ action: 'importScript', code });
                        if (res?.success) installed++;
                        else errors++;
                    } else if (file.name.endsWith('.zip')) {
                        const buf = await file.arrayBuffer();
                        const bytes = new Uint8Array(buf);
                        let binary = '';
                        for (let j = 0; j < bytes.length; j += 8192) {
                            binary += String.fromCharCode.apply(null, bytes.subarray(j, j + 8192));
                        }
                        const base64 = btoa(binary);
                        const res = await chrome.runtime.sendMessage({ action: 'importFromZip', zipData: base64, options: { overwrite: true } });
                        installed += res?.imported || 0;
                        errors += res?.errors?.length || 0;
                    }
                } catch (err) {
                    console.error('Drop install error:', err);
                    errors++;
                }
            }

            hideProgress();
            await loadScripts();
            updateStats();
            if (installed > 0) showToast(`Installed ${installed} script${installed > 1 ? 's' : ''}${errors > 0 ? ` (${errors} failed)` : ''}`, 'success');
            else showToast('No valid userscripts found in dropped files', 'error');
        });
    }

    function applyColumnVisibility() {
        const hidden = state.settings._hiddenColumns || [];
        // Column index mapping: version=4, size=5, lines=6, sites=7, features=8, home=9, updated=10, perf=11
        const colMap = { version: 4, size: 5, lines: 6, sites: 7, features: 8, home: 9, updated: 10, perf: 11 };
        const table = document.querySelector('.scripts-table');
        if (!table) return;
        // Reset all columns
        for (const [name, idx] of Object.entries(colMap)) {
            const display = hidden.includes(name) ? 'none' : '';
            // Header
            const th = table.querySelector(`th[data-col="${name}"]`);
            if (th) th.style.display = display;
            // Body cells
            table.querySelectorAll(`tbody tr`).forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells[idx]) cells[idx].style.display = display;
            });
        }
    }

    function testPatterns() {
        const urlInput = document.getElementById('patternTestUrl');
        const resultsEl = document.getElementById('patternTestResults');
        const testUrl = urlInput?.value?.trim();
        if (!testUrl || !resultsEl) return;

        try {
            new URL(testUrl); // validate URL
        } catch {
            resultsEl.innerHTML = '<span style="color:var(--accent-red)">Invalid URL format</span>';
            return;
        }

        const matching = [];
        const notMatching = [];

        for (const s of state.scripts) {
            const m = s.metadata || {};
            const patterns = [...(m.match || []), ...(m.include || [])];
            const excludes = [...(m.exclude || []), ...(m.excludeMatch || [])];
            let matches = false;

            for (const p of patterns) {
                if (testUrlAgainstPattern(testUrl, p)) { matches = true; break; }
            }
            // Check excludes
            if (matches) {
                for (const p of excludes) {
                    if (testUrlAgainstPattern(testUrl, p)) { matches = false; break; }
                }
            }

            if (matches) matching.push(s);
            else notMatching.push(s);
        }

        if (matching.length === 0) {
            resultsEl.innerHTML = '<div style="padding:8px;color:var(--text-muted)">No scripts match this URL</div>';
        } else {
            resultsEl.innerHTML = `<div style="margin-bottom:6px;font-weight:600;color:var(--accent-green)">${matching.length} script${matching.length > 1 ? 's' : ''} would run:</div>` +
                matching.map(s => {
                    const name = s.metadata?.name || 'Unnamed';
                    const enabled = s.enabled !== false;
                    return `<div class="pattern-test-match"><span class="pattern-test-indicator ${enabled ? 'active' : 'inactive'}"></span> ${escapeHtml(name)} ${!enabled ? '<span style="color:var(--text-muted)">(disabled)</span>' : ''}</div>`;
                }).join('');
        }
    }

    function testUrlAgainstPattern(url, pattern) {
        // Handle <all_urls>
        if (pattern === '<all_urls>') return true;

        // Handle regex patterns (/regex/)
        if (pattern.startsWith('/') && pattern.endsWith('/')) {
            try {
                return new RegExp(pattern.slice(1, -1)).test(url);
            } catch { return false; }
        }

        // Handle glob @include patterns
        if (pattern.includes('*') && !pattern.includes('://')) {
            // Glob-style include
            const re = new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
            return re.test(url);
        }

        // Handle @match patterns: scheme://host/path
        const matchRe = /^(\*|https?|file|ftp):\/\/(\*|\*\.[^/*]+|[^/*]+)\/(.*)$/;
        const m = pattern.match(matchRe);
        if (!m) {
            // Fallback: try as glob
            const re = new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
            return re.test(url);
        }

        const [, scheme, host, path] = m;
        let parsed;
        try { parsed = new URL(url); } catch { return false; }

        // Check scheme
        if (scheme !== '*' && parsed.protocol !== scheme + ':') return false;

        // Check host
        if (host !== '*') {
            if (host.startsWith('*.')) {
                const domain = host.slice(2);
                if (parsed.hostname !== domain && !parsed.hostname.endsWith('.' + domain)) return false;
            } else if (parsed.hostname !== host) return false;
        }

        // Check path
        if (path !== '*') {
            const pathPattern = new RegExp('^' + path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
            const urlPath = parsed.pathname + parsed.search;
            if (!pathPattern.test(urlPath) && !pathPattern.test(parsed.pathname)) return false;
        }

        return true;
    }

    // =========================================
    // Backup Browser
    // =========================================
    function renderBackupList(backups = [], options = {}) {
        const totalCount = Number(options.totalCount ?? state.backups.length ?? backups.length);
        if (!elements.backupList) return;
        if (!backups.length) {
            const hasActiveView = totalCount > 0 && (
                state.backupBrowserFilter !== 'all'
                || state.backupBrowserSort !== 'newest'
                || !!state.backupBrowserQuery.trim()
            );
            elements.backupList.innerHTML = totalCount > 0
                ? `<div class="panel-empty-inline">No backups match the current view.${hasActiveView ? '<div style="margin-top:10px"><button type="button" class="btn btn-sm" data-reset-backup-browser>Reset View</button></div>' : ''}</div>`
                : '<div class="panel-empty-inline">No backups saved yet. Create one to capture scripts, settings, folders, and workspaces.</div>';
            elements.backupList.querySelector('[data-reset-backup-browser]')?.addEventListener('click', resetBackupBrowserView);
            return;
        }

        const groups = getBackupDisplayGroups(backups);
        elements.backupList.innerHTML = `<div class="backup-browser-groups">${groups.map(group => `
            <section class="backup-browser-group">
                <div class="backup-browser-group-header">
                    <strong>${escapeHtml(group.label)}</strong>
                    <span class="panel-empty-inline">${numberFormatter.format(group.backups.length)} backup${group.backups.length === 1 ? '' : 's'}</span>
                </div>
                <div class="backup-browser-list">${group.backups.map(backup => `
                    <div class="backup-browser-item" data-backup-id="${escapeHtml(backup.id)}">
                        <div class="backup-browser-copy">
                            <strong style="color:var(--text-primary)">${escapeHtml(dateTimeFormatter.format(new Date(backup.timestamp || Date.now())))}</strong>
                            <div class="backup-browser-meta">
                                <span>${escapeHtml(formatRelativeBackupTime(backup.timestamp))}</span>
                                <span>${numberFormatter.format(backup.scriptCount || 0)} scripts</span>
                                <span>${escapeHtml(backup.sizeFormatted || formatBytes(backup.size || 0))}</span>
                                <span>${escapeHtml(formatBackupReason(backup.reason))}</span>
                                <span>${escapeHtml(backup.version || 'current')}</span>
                            </div>
                            <div class="info-tags">
                                <span class="info-tag ${backup.hasGlobalSettings || backup.hasFolders || backup.hasWorkspaces ? 'success' : ''}">${backup.hasGlobalSettings || backup.hasFolders || backup.hasWorkspaces ? 'Vault snapshot' : 'Scripts only'}</span>
                                ${backup.hasGlobalSettings ? '<span class="info-tag">Settings</span>' : ''}
                                ${backup.hasFolders ? '<span class="info-tag">Folders</span>' : ''}
                                ${backup.hasWorkspaces ? '<span class="info-tag">Workspaces</span>' : ''}
                                ${backup.hasScriptStorage ? '<span class="info-tag">Stored values</span>' : ''}
                            </div>
                        </div>
                        <div class="backup-browser-actions">
                            <button type="button" class="btn btn-sm" data-backup-review="${escapeHtml(backup.id)}">Review</button>
                            <button type="button" class="btn btn-sm" data-backup-export="${escapeHtml(backup.id)}">Download</button>
                            <button type="button" class="btn btn-sm btn-danger" data-backup-delete="${escapeHtml(backup.id)}">Delete</button>
                        </div>
                    </div>
                `).join('')}</div>
            </section>
        `).join('')}</div>`;

        elements.backupList.querySelectorAll('[data-backup-review]').forEach(button => {
            button.addEventListener('click', async () => {
                await runButtonTask(button, () => openBackupReviewModal(button.dataset.backupReview), { busyLabel: 'Loading…' });
            });
        });
        elements.backupList.querySelectorAll('[data-backup-export]').forEach(button => {
            button.addEventListener('click', async () => {
                await runButtonTask(button, () => exportStoredBackup(button.dataset.backupExport), { busyLabel: 'Downloading…' });
            });
        });
        elements.backupList.querySelectorAll('[data-backup-delete]').forEach(button => {
            button.addEventListener('click', async () => {
                await runButtonTask(button, async () => {
                    const backup = state.backups.find(entry => entry.id === button.dataset.backupDelete);
                    const label = backup?.timestamp ? dateTimeFormatter.format(new Date(backup.timestamp)) : 'this backup';
                    const confirmed = await showConfirmModal('Delete Backup', `Delete the backup from ${label}? This removes the stored archive from ScriptVault.`);
                    if (!confirmed) return;
                    try {
                        const response = await chrome.runtime.sendMessage({ action: 'deleteBackup', backupId: button.dataset.backupDelete });
                        if (response?.error || response?.success === false) {
                            showToast(response?.error || 'Failed to delete backup', 'error');
                            return;
                        }
                        await loadBackups();
                        showToast(`Deleted backup from ${label}`, 'success');
                    } catch (error) {
                        showToast(error?.message || 'Failed to delete backup', 'error');
                    }
                });
            });
        });
    }

    async function loadBackups(options = {}) {
        const { announce = false } = options;
        if (!elements.backupList) return [];
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getBackups' });
            const backups = Array.isArray(response) ? response : (response?.backups || []);
            state.backups = backups.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            applyBackupBrowserFilters();
            if (elements.backupBrowserSummary) {
                elements.backupBrowserSummary.textContent = formatBackupBrowserSummary(state.backups);
            }
            updateBackupScheduleSummary(state.backupSettings || {});
            updateSupportSnapshotSummary();
            updateUtilitiesOverview();
            if (announce) showToast('Backups refreshed', 'success');
            return state.backups;
        } catch (error) {
            const message = error?.message || 'Failed to load backups';
            if (elements.backupBrowserSummary) elements.backupBrowserSummary.textContent = 'Backup browser unavailable';
            if (elements.backupList) elements.backupList.innerHTML = `<div class="panel-empty-inline">${escapeHtml(message)}</div>`;
            if (elements.backupBrowserStatus) elements.backupBrowserStatus.textContent = 'Backup browser unavailable.';
            updateBackupScheduleSummary(state.backupSettings || {});
            updateSupportSnapshotSummary();
            if (announce) showToast(message, 'error');
            return [];
        }
    }

    async function exportStoredBackup(backupId) {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'exportBackup', backupId });
            if (response?.error || !response?.zipData) {
                showToast(response?.error || 'Failed to export backup', 'error');
                return;
            }
            downloadBase64Zip(response.zipData, response.filename || `scriptvault-autobackup-${backupId}.zip`);
            showToast('Backup archive downloaded', 'success');
        } catch (error) {
            showToast(error?.message || 'Failed to export backup', 'error');
        }
    }

    async function restoreStoredBackup(backupId, options = {}) {
        const progressTitle = options.progressTitle
            || (options.selective ? 'Restoring selected scripts…' : 'Restoring backup…');
        const progressDetail = options.progressDetail
            || (options.selective ? 'Applying selected scripts…' : 'Applying vault archive…');
        showProgress(progressTitle);
        updateProgress(0, 3, progressDetail);
        try {
            const response = await chrome.runtime.sendMessage({ action: 'restoreBackup', backupId, options });
            if (response?.error || response?.success === false) {
                hideProgress();
                showToast(response?.error || 'Restore failed', 'error');
                return response;
            }
            updateProgress(1, 3, 'Refreshing folders…');
            await loadFolders();
            updateProgress(2, 3, 'Refreshing scripts, settings, and workspaces…');
            await Promise.all([
                loadScripts(),
                loadSettings(),
                loadWorkspaces()
            ]);
            updateStats();
            updateProgress(3, 3, 'Restore complete');
            hideProgress();
            showToast(`Backup restore: ${formatBackupRestoreSummary(response)}`, getBackupRestoreTone(response));
            return response;
        } catch (error) {
            hideProgress();
            showToast(error?.message || 'Restore failed', 'error');
            return null;
        }
    }

    async function openBackupReviewModal(backupId, options = {}) {
        const backup = state.backups.find(entry => entry.id === backupId);
        if (!backup) {
            showToast('Backup not found', 'error');
            return;
        }
        try {
            const hasExplicitSelection = Array.isArray(options.selectedScriptIds);
            const selectedScriptIdSet = new Set(hasExplicitSelection ? options.selectedScriptIds.filter(Boolean) : []);
            const manifest = await chrome.runtime.sendMessage({ action: 'inspectBackup', backupId });
            if (!manifest || manifest?.error) {
                showToast(manifest?.error || 'Failed to inspect backup', 'error');
                return;
            }
            const installedIdentitySet = new Set(state.scripts.map(script => getScriptIdentityKey(script)).filter(Boolean));
            const scripts = (Array.isArray(manifest.scripts) ? manifest.scripts : []).map(script => ({
                ...script,
                identity: script.id || getScriptIdentityKey(script),
                existsInVault: installedIdentitySet.has(script.id || getScriptIdentityKey(script))
            }));
            const existingCount = scripts.filter(script => script.existsInVault).length;
            const newCount = scripts.length - existingCount;
            const hasScriptEntries = scripts.length > 0;
            const scriptsWithStorageCount = Number(manifest.scriptsWithStorageCount || scripts.filter(script => script.hasStorage).length);
            const currentSettingsKeyCount = Object.keys(state.settings || {}).length;
            const currentFolderCount = Array.isArray(state.folders) ? state.folders.length : 0;
            const currentWorkspaceCount = Array.isArray(state.workspaces) ? state.workspaces.length : 0;
            const archivedFolders = Array.isArray(manifest.folders) ? manifest.folders : [];
            const archivedWorkspaces = Array.isArray(manifest.workspaces) ? manifest.workspaces : [];
            const formatNamedPreview = (entries, formatter, maxItems = 3) => {
                const values = entries
                    .map(formatter)
                    .map(value => String(value || '').trim())
                    .filter(Boolean);
                if (!values.length) return '';
                if (values.length <= maxItems) return values.join(', ');
                const visible = values.slice(0, maxItems).join(', ');
                return `${visible}, +${numberFormatter.format(values.length - maxItems)} more`;
            };
            const hasGlobalItems = [];
            if (manifest.hasGlobalSettings) hasGlobalItems.push('app settings');
            if (manifest.hasFolders) hasGlobalItems.push('folders');
            if (manifest.hasWorkspaces) hasGlobalItems.push('workspaces');
            const hasVaultRestoreItems = hasGlobalItems.length > 0;
            const summaryText = hasGlobalItems.length
                ? `Full restore also applies ${hasGlobalItems.join(', ')}.`
                : scriptsWithStorageCount
                    ? `This backup only contains script-level data plus stored values for ${numberFormatter.format(scriptsWithStorageCount)} script${scriptsWithStorageCount === 1 ? '' : 's'}.`
                    : 'This backup only contains script-level data.';
            const impactRows = [];
            if (manifest.hasGlobalSettings) {
                impactRows.push({
                    label: 'App settings',
                    tag: `${numberFormatter.format(manifest.settingsKeyCount || 0)} keys in backup`,
                    detail: `Full restore will replace the current ${numberFormatter.format(currentSettingsKeyCount)} setting key${currentSettingsKeyCount === 1 ? '' : 's'} with the backup snapshot.`,
                    tone: 'warning'
                });
            }
            if (manifest.hasFolders) {
                const folderPreview = formatNamedPreview(
                    archivedFolders,
                    folder => folder.scriptCount > 0
                        ? `${folder.name} (${numberFormatter.format(folder.scriptCount)})`
                        : folder.name
                );
                impactRows.push({
                    label: 'Folders',
                    tag: `${numberFormatter.format(manifest.folderCount || 0)} folders in backup`,
                    detail: `Full restore will replace the current ${numberFormatter.format(currentFolderCount)} folder${currentFolderCount === 1 ? '' : 's'} with the archived layout.${folderPreview ? ` Includes ${folderPreview}.` : ''}`,
                    tone: 'warning'
                });
            }
            if (manifest.hasWorkspaces) {
                const workspacePreview = formatNamedPreview(
                    archivedWorkspaces,
                    workspace => workspace.active
                        ? `${workspace.name} (active)`
                        : workspace.scriptCount > 0
                            ? `${workspace.name} (${numberFormatter.format(workspace.scriptCount)})`
                            : workspace.name
                );
                impactRows.push({
                    label: 'Workspaces',
                    tag: `${numberFormatter.format(manifest.workspaceCount || 0)} workspaces in backup`,
                    detail: `Full restore will replace the current ${numberFormatter.format(currentWorkspaceCount)} workspace${currentWorkspaceCount === 1 ? '' : 's'} with the archived workspace set.${workspacePreview ? ` Includes ${workspacePreview}.` : ''}`,
                    tone: 'warning'
                });
            }
            if (scriptsWithStorageCount > 0) {
                impactRows.push({
                    label: 'Stored values',
                    tag: `${numberFormatter.format(scriptsWithStorageCount)} script${scriptsWithStorageCount === 1 ? '' : 's'} carry values`,
                    detail: 'Stored values are reapplied for matching scripts during full restore, and for checked scripts during selective restore.',
                    tone: 'success'
                });
            }
            const impactHtml = impactRows.length
                ? `
                    <div class="utility-surface">
                        <div class="setting-row" style="margin:0 0 10px 0;justify-content:space-between;align-items:center;gap:10px">
                            <strong style="color:var(--text-primary)">Full-vault impact</strong>
                            <span class="panel-empty-inline">${escapeHtml(summaryText)}</span>
                        </div>
                        <div class="restore-preview-list">${impactRows.map(row => `
                            <div class="restore-preview-item">
                                <div class="restore-preview-copy">
                                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                                        <strong style="color:var(--text-primary)">${escapeHtml(row.label)}</strong>
                                        <span class="info-tag ${escapeHtml(row.tone)}">${escapeHtml(row.tag)}</span>
                                    </div>
                                    <div class="restore-preview-meta">
                                        <span>${escapeHtml(row.detail)}</span>
                                    </div>
                                </div>
                            </div>
                        `).join('')}</div>
                    </div>
                `
                : '';
            const listHtml = scripts.length
                ? `<div class="restore-preview-list">${scripts.map(script => `
                    <label class="restore-preview-item">
                        <div class="restore-preview-copy">
                            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                                <input type="checkbox" data-restore-script-id="${escapeHtml(script.identity)}" data-restore-status="${script.existsInVault ? 'existing' : 'new'}" data-restore-storage="${script.hasStorage ? 'yes' : 'no'}"${!hasExplicitSelection || selectedScriptIdSet.has(script.identity) ? ' checked' : ''}>
                                <strong style="color:var(--text-primary)">${escapeHtml(script.name || script.id)}</strong>
                                ${script.namespace ? `<span class="panel-empty-inline">${escapeHtml(script.namespace)}</span>` : ''}
                                <span class="info-tag ${script.existsInVault ? 'warning' : 'success'}">${script.existsInVault ? 'Will overwrite' : 'New script'}</span>
                                ${script.hasStorage ? '<span class="info-tag success">Stored values</span>' : ''}
                            </div>
                            <div class="restore-preview-meta">
                                <span>${script.hasStorage ? 'Stored values included' : 'No stored values'}</span>
                                <span>${escapeHtml(script.identity)}</span>
                            </div>
                        </div>
                    </label>
                `).join('')}</div>`
                : '<div class="panel-empty-inline">No scripts found in this backup.</div>';
            const restoreAllScriptIds = scripts.map(script => script.identity).filter(Boolean);
            const selectionSummaryCard = hasScriptEntries
                ? `
                        <div class="restore-preview-card">
                            <span class="panel-empty-inline">Selected restore</span>
                            <strong id="backupSelectionSummary">All ${numberFormatter.format(restoreAllScriptIds.length)} scripts</strong>
                            <span class="panel-empty-inline" id="backupSelectionDetails">Ready to restore every archived script.</span>
                        </div>
                    `
                : '';
            const scopeNoteHtml = hasVaultRestoreItems
                ? `
                    <div class="utility-surface">
                        <div class="utility-note" id="backupScopeNote">Restore Scripts Only keeps current app settings, folders, and workspaces untouched. Use Restore Full Vault only when you want the archived vault state back too.</div>
                    </div>
                `
                : '';
            const buildRestoreMessage = ({ mode, selectedCount = 0, overwriteCount = 0, newScriptCount = 0, storageCount = 0 }) => {
                if (mode === 'full') {
                    const parts = [`Restore the full vault from ${dateTimeFormatter.format(new Date(backup.timestamp || Date.now()))}?`];
                    if (manifest.scriptCount) {
                        parts.push(`${numberFormatter.format(manifest.scriptCount)} scripts will be restored (${numberFormatter.format(existingCount)} overwrite, ${numberFormatter.format(newCount)} new).`);
                    }
                    if (manifest.hasGlobalSettings) {
                        parts.push(`App settings will be replaced with ${numberFormatter.format(manifest.settingsKeyCount || 0)} archived setting key${Number(manifest.settingsKeyCount || 0) === 1 ? '' : 's'}.`);
                    }
                    if (manifest.hasFolders) {
                        parts.push(`${numberFormatter.format(manifest.folderCount || 0)} archived folder${Number(manifest.folderCount || 0) === 1 ? '' : 's'} will replace the current folder layout.`);
                    }
                    if (manifest.hasWorkspaces) {
                        parts.push(`${numberFormatter.format(manifest.workspaceCount || 0)} archived workspace${Number(manifest.workspaceCount || 0) === 1 ? '' : 's'} will replace the current workspace set.`);
                    }
                    if (scriptsWithStorageCount > 0) {
                        parts.push(`Stored values for ${numberFormatter.format(scriptsWithStorageCount)} script${scriptsWithStorageCount === 1 ? '' : 's'} will be reapplied where present.`);
                    }
                    return parts.join(' ');
                }
                const selectedLabel = `${numberFormatter.format(selectedCount)} script${selectedCount === 1 ? '' : 's'}`;
                const detailParts = [
                    `${numberFormatter.format(overwriteCount)} overwrite`,
                    `${numberFormatter.format(newScriptCount)} new`
                ];
                if (storageCount > 0) {
                    detailParts.push(`${numberFormatter.format(storageCount)} with stored values`);
                }
                const scopeSentence = hasVaultRestoreItems
                    ? 'App settings, folders, and workspaces will stay unchanged.'
                    : 'This backup only contains script-level data.';
                return `Restore ${selectedLabel}? ${detailParts.join(', ')}. ${scopeSentence}`;
            };
            const getSelectedRestoreStats = () => {
                const selectedScripts = scripts.filter(script => {
                    const checkbox = elements.modalBody?.querySelector(`[data-restore-script-id="${CSS.escape(script.identity)}"]`);
                    return !!checkbox?.checked;
                });
                const selectedCount = selectedScripts.length;
                const overwriteCount = selectedScripts.filter(script => script.existsInVault).length;
                const storageCount = selectedScripts.filter(script => script.hasStorage).length;
                return {
                    selectedScripts,
                    selectedCount,
                    overwriteCount,
                    newScriptCount: selectedCount - overwriteCount,
                    storageCount
                };
            };
            const getSelectedRestoreIds = () => Array.from(elements.modalBody?.querySelectorAll('[data-restore-script-id]:checked') || [])
                .map(input => input.getAttribute('data-restore-script-id'))
                .filter(Boolean);
            const reopenBackupReview = async selectedScriptIds => {
                await openBackupReviewModal(backupId, { selectedScriptIds });
            };
            const modalActions = [
                { label: 'Close', class: '', callback: () => hideModal() },
                { label: 'Download ZIP', class: '', busyLabel: 'Downloading…', callback: async () => { await exportStoredBackup(backupId); } }
            ];
            if (hasScriptEntries) {
                modalActions.push({
                    label: 'Restore Selected',
                    class: '',
                    callback: async () => {
                        const selected = getSelectedRestoreIds();
                        if (!selected.length) {
                            showToast('Select at least one script to restore', 'info');
                            return;
                        }
                        const stats = getSelectedRestoreStats();
                        const confirmed = await showConfirmModal(
                            'Restore Selected Scripts',
                            buildRestoreMessage({
                                mode: 'selected',
                                selectedCount: stats.selectedCount,
                                overwriteCount: stats.overwriteCount,
                                newScriptCount: stats.newScriptCount,
                                storageCount: stats.storageCount
                            })
                        );
                        if (!confirmed) {
                            await reopenBackupReview(selected);
                            return;
                        }
                        hideModal();
                        await restoreStoredBackup(backupId, {
                            selective: true,
                            scriptIds: selected,
                            progressTitle: 'Restoring selected scripts…',
                            progressDetail: `Applying ${numberFormatter.format(stats.selectedCount)} selected script${stats.selectedCount === 1 ? '' : 's'}…`
                        });
                    }
                });
            }
            if (restoreAllScriptIds.length) {
                modalActions.push({
                    label: hasVaultRestoreItems ? 'Restore Scripts Only' : 'Restore All Scripts',
                    class: 'btn-primary',
                    callback: async () => {
                        const preservedSelection = getSelectedRestoreIds();
                        const confirmed = await showConfirmModal(
                            hasVaultRestoreItems ? 'Restore Scripts Only' : 'Restore All Scripts',
                            buildRestoreMessage({
                                mode: 'selected',
                                selectedCount: restoreAllScriptIds.length,
                                overwriteCount: existingCount,
                                newScriptCount: newCount,
                                storageCount: scriptsWithStorageCount
                            })
                        );
                        if (!confirmed) {
                            await reopenBackupReview(preservedSelection);
                            return;
                        }
                        hideModal();
                        await restoreStoredBackup(backupId, {
                            selective: true,
                            scriptIds: restoreAllScriptIds,
                            progressTitle: hasVaultRestoreItems ? 'Restoring scripts only…' : 'Restoring all scripts…',
                            progressDetail: `Applying ${numberFormatter.format(restoreAllScriptIds.length)} archived script${restoreAllScriptIds.length === 1 ? '' : 's'}…`
                        });
                    }
                });
            }
            if (hasVaultRestoreItems) {
                modalActions.push({
                    label: 'Restore Full Vault',
                    class: restoreAllScriptIds.length ? '' : 'btn-primary',
                    callback: async () => {
                        const preservedSelection = getSelectedRestoreIds();
                        const confirmed = await showConfirmModal(
                            'Restore Full Vault',
                            buildRestoreMessage({ mode: 'full' })
                        );
                        if (!confirmed) {
                            await reopenBackupReview(preservedSelection);
                            return;
                        }
                        hideModal();
                        await restoreStoredBackup(backupId, {
                            selective: false,
                            progressTitle: 'Restoring full vault…',
                            progressDetail: 'Applying archived scripts, settings, folders, and workspaces…'
                        });
                    }
                });
            }

            showModal('Review Backup', `
                <div class="restore-preview-shell">
                    <div class="restore-preview-summary">
                        <div class="restore-preview-card">
                            <span class="panel-empty-inline">Created</span>
                            <strong>${escapeHtml(dateTimeFormatter.format(new Date(backup.timestamp || Date.now())))}</strong>
                            <span class="panel-empty-inline">${escapeHtml((backup.reason || 'backup').replace(/([A-Z])/g, ' $1').trim())}</span>
                        </div>
                        <div class="restore-preview-card">
                            <span class="panel-empty-inline">Scripts</span>
                            <strong>${numberFormatter.format(manifest.scriptCount || scripts.length)}</strong>
                            <span class="panel-empty-inline">${escapeHtml(backup.sizeFormatted || formatBytes(backup.size || 0))}</span>
                        </div>
                        <div class="restore-preview-card">
                            <span class="panel-empty-inline">Vault impact</span>
                            <strong>${numberFormatter.format(existingCount)} overwrite · ${numberFormatter.format(newCount)} new</strong>
                            <span class="panel-empty-inline">Use quick selection to restore only new or only overlapping scripts.</span>
                        </div>
                        <div class="restore-preview-card">
                            <span class="panel-empty-inline">Full restore</span>
                            <strong>${hasGlobalItems.length ? `${numberFormatter.format(hasGlobalItems.length)} vault area${hasGlobalItems.length === 1 ? '' : 's'}` : 'Scripts only'}</strong>
                            <span class="panel-empty-inline">${escapeHtml(summaryText)}</span>
                        </div>
                        ${selectionSummaryCard}
                    </div>
                    ${impactHtml}
                    ${scopeNoteHtml}
                    ${hasScriptEntries ? `
                        <div class="utility-surface">
                            <div class="setting-row" style="margin:0 0 10px 0;justify-content:space-between;align-items:center;gap:10px">
                                <strong style="color:var(--text-primary)">Scripts in backup</strong>
                                <div class="backup-browser-actions">
                                    <button type="button" class="btn btn-sm" id="selectBackupExisting">Select Existing</button>
                                    <button type="button" class="btn btn-sm" id="selectBackupNew">Select New</button>
                                    ${scriptsWithStorageCount > 0 ? '<button type="button" class="btn btn-sm" id="selectBackupStorage">Select With Values</button>' : ''}
                                    <button type="button" class="btn btn-sm" id="toggleBackupSelection">Clear Selection</button>
                                </div>
                            </div>
                            ${listHtml}
                        </div>
                    ` : `
                        <div class="utility-surface">
                            <div class="panel-empty-inline">This backup does not contain any scripts. Use Restore Full Vault to bring back archived settings, folders, or workspaces.</div>
                        </div>
                    `}
                </div>
            `, modalActions);

            requestAnimationFrame(() => {
                const toggleButton = document.getElementById('toggleBackupSelection');
                const existingButton = document.getElementById('selectBackupExisting');
                const newButton = document.getElementById('selectBackupNew');
                const storageButton = document.getElementById('selectBackupStorage');
                const selectionSummary = document.getElementById('backupSelectionSummary');
                const selectionDetails = document.getElementById('backupSelectionDetails');
                const checkboxes = Array.from(elements.modalBody?.querySelectorAll('[data-restore-script-id]') || []);
                const updateToggleLabel = () => {
                    const checkedCount = checkboxes.filter(box => box.checked).length;
                    if (toggleButton) toggleButton.textContent = checkedCount === 0 ? 'Select All' : 'Clear Selection';
                };
                const updateSelectionSummary = () => {
                    if (!selectionSummary || !selectionDetails) return;
                    const selectedScripts = scripts.filter(script => {
                        const checkbox = checkboxes.find(box => box.getAttribute('data-restore-script-id') === script.identity);
                        return !!checkbox?.checked;
                    });
                    const selectedCount = selectedScripts.length;
                    const selectedExisting = selectedScripts.filter(script => script.existsInVault).length;
                    const selectedNew = selectedCount - selectedExisting;
                    const selectedStorage = selectedScripts.filter(script => script.hasStorage).length;
                    if (selectedCount === 0) {
                        selectionSummary.textContent = 'No scripts selected';
                        selectionDetails.textContent = 'Pick one or more archived scripts to restore.';
                        return;
                    }
                    selectionSummary.textContent = `${numberFormatter.format(selectedCount)} script${selectedCount === 1 ? '' : 's'} selected`;
                    const detailParts = [
                        `${numberFormatter.format(selectedExisting)} overwrite`,
                        `${numberFormatter.format(selectedNew)} new`
                    ];
                    if (selectedStorage > 0) {
                        detailParts.push(`${numberFormatter.format(selectedStorage)} with stored values`);
                    }
                    if (hasVaultRestoreItems) {
                        detailParts.push('settings/folders/workspaces stay unchanged');
                    }
                    selectionDetails.textContent = detailParts.join(' · ');
                };
                toggleButton?.addEventListener('click', () => {
                    const shouldSelect = checkboxes.every(box => !box.checked);
                    checkboxes.forEach(box => { box.checked = shouldSelect; });
                    updateToggleLabel();
                    updateSelectionSummary();
                });
                existingButton?.addEventListener('click', () => {
                    checkboxes.forEach(box => {
                        box.checked = box.dataset.restoreStatus === 'existing';
                    });
                    updateToggleLabel();
                    updateSelectionSummary();
                });
                newButton?.addEventListener('click', () => {
                    checkboxes.forEach(box => {
                        box.checked = box.dataset.restoreStatus === 'new';
                    });
                    updateToggleLabel();
                    updateSelectionSummary();
                });
                storageButton?.addEventListener('click', () => {
                    checkboxes.forEach(box => {
                        box.checked = box.dataset.restoreStorage === 'yes';
                    });
                    updateToggleLabel();
                    updateSelectionSummary();
                });
                checkboxes.forEach(box => box.addEventListener('change', () => {
                    updateToggleLabel();
                    updateSelectionSummary();
                }));
                updateToggleLabel();
                updateSelectionSummary();
            });
        } catch (error) {
            showToast(error?.message || 'Failed to inspect backup', 'error');
        }
    }

    // =========================================
    // Workspaces
    // =========================================
    async function loadWorkspaces() {
        const container = document.getElementById('workspaceList');
        if (!container) return;
        try {
            const res = await chrome.runtime.sendMessage({ action: 'getWorkspaces' });
            const { active, list } = res || {};
            state.workspaces = Array.isArray(list) ? list : [];
            if (!list || list.length === 0) {
                container.innerHTML = '<div style="color:var(--text-muted);font-size:12px;padding:4px 0">No workspaces saved</div>';
                updateUtilitiesOverview();
                return;
            }
            container.innerHTML = list.map(ws => `
                <div class="workspace-item${ws.id === active ? ' active' : ''}" data-ws-id="${ws.id}">
                    <span class="workspace-name">${escapeHtml(ws.name)}</span>
                    <span class="workspace-scripts">${Object.keys(ws.snapshot || {}).length} scripts</span>
                    <div class="workspace-actions">
                        <button type="button" class="toolbar-btn${ws.id === active ? ' primary' : ''}" data-ws-activate="${ws.id}"${ws.id === active ? ' disabled aria-current="true" title="Current workspace"' : ' title="Switch to workspace"'}>${ws.id === active ? 'Active' : 'Switch'}</button>
                        <button type="button" class="toolbar-btn" data-ws-save="${ws.id}" title="Update with current state">Save</button>
                        <button type="button" class="toolbar-btn" data-ws-delete="${ws.id}" title="Delete workspace">Delete</button>
                    </div>
                </div>
            `).join('');

            container.querySelectorAll('[data-ws-activate]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    await runButtonTask(btn, async () => {
                        const id = btn.dataset.wsActivate;
                        showToast('Switching workspace…', 'info');
                        const res = await chrome.runtime.sendMessage({ action: 'activateWorkspace', id });
                        if (res?.success) {
                            await Promise.all([loadScripts(), loadWorkspaces()]);
                            updateStats();
                            showToast(`Workspace "${res.name}" activated`, 'success');
                        } else {
                            showToast(res?.error || 'Failed', 'error');
                        }
                    }, { busyLabel: 'Switching…' });
                });
            });
            container.querySelectorAll('[data-ws-save]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    await runButtonTask(btn, async () => {
                        const workspaceName = btn.closest('[data-ws-id]')?.querySelector('.workspace-name')?.textContent?.trim() || 'workspace';
                        try {
                            const res = await chrome.runtime.sendMessage({ action: 'saveWorkspace', id: btn.dataset.wsSave });
                            if (res?.error || !res?.workspace) {
                                showToast(res?.error || `Failed to update "${workspaceName}"`, 'error');
                                return;
                            }
                            showToast(`Saved current script state to "${res.workspace.name}"`, 'success');
                            await loadWorkspaces();
                        } catch (error) {
                            showToast(`Failed to update "${workspaceName}"`, 'error');
                        }
                    }, { busyLabel: 'Saving…' });
                });
            });
            container.querySelectorAll('[data-ws-delete]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    await runButtonTask(btn, async () => {
                        const workspaceName = btn.closest('[data-ws-id]')?.querySelector('.workspace-name')?.textContent?.trim() || 'workspace';
                        const confirmed = await showConfirmModal(
                            'Delete Workspace',
                            `Delete "${workspaceName}"? This removes the saved snapshot but does not delete any scripts.`
                        );
                        if (!confirmed) return;
                        try {
                            const res = await chrome.runtime.sendMessage({ action: 'deleteWorkspace', id: btn.dataset.wsDelete });
                            if (res?.error || !res?.success) {
                                showToast(res?.error || `Failed to delete "${workspaceName}"`, 'error');
                                return;
                            }
                            const deletedName = res?.workspace?.name || workspaceName;
                            showToast(`Deleted workspace "${deletedName}"`, 'success');
                            await loadWorkspaces();
                        } catch (error) {
                            showToast(`Failed to delete "${workspaceName}"`, 'error');
                        }
                    }, { busyLabel: 'Deleting…' });
                });
            });
            updateUtilitiesOverview();
        } catch (e) {
            state.workspaces = [];
            container.innerHTML = '<div style="color:var(--text-muted);font-size:12px">Failed to load workspaces</div>';
            updateUtilitiesOverview();
        }
    }

    // =========================================
    // Network Log
    // =========================================
    async function loadNetworkLog() {
        const container = document.getElementById('networkLogContainer');
        if (!container) return;
        try {
            const res = await chrome.runtime.sendMessage({ action: 'getNetworkLog', limit: 50 });
            const log = res?.log || [];
            const stats = res?.stats || {};

            if (log.length === 0) {
                container.innerHTML = '<div style="color:var(--text-muted)">No network requests logged yet</div>';
                return;
            }

            let html = `<div class="netlog-stats">
                <span>${stats.totalRequests || 0} requests</span>
                <span>${stats.totalErrors || 0} errors</span>
                <span>${formatBytes(stats.totalBytes || 0)} transferred</span>
            </div>`;

            html += log.map(e => {
                const statusClass = e.error ? 'netlog-error' : (e.status >= 400 ? 'netlog-warn' : 'netlog-ok');
                const time = new Date(e.timestamp).toLocaleTimeString();
                let domain = '';
                try { domain = new URL(e.url).hostname; } catch {}
                return `<div class="netlog-entry ${statusClass}">
                    <span class="netlog-method">${escapeHtml(e.method || 'GET')}</span>
                    <span class="netlog-status">${e.error ? 'ERR' : e.status || '?'}</span>
                    <span class="netlog-url" title="${escapeHtml(e.url)}">${escapeHtml(domain)}${e.url.length > 40 ? '...' : ''}</span>
                    <span class="netlog-script" title="${escapeHtml(e.scriptName || '')}">${escapeHtml((e.scriptName || '').slice(0, 20))}</span>
                    <span class="netlog-size">${e.responseSize ? formatBytes(e.responseSize) : '-'}</span>
                    <span class="netlog-time">${time}</span>
                </div>`;
            }).join('');

            container.innerHTML = html;
        } catch (e) {
            container.innerHTML = '<div style="color:var(--text-muted)">Failed to load network log</div>';
        }
    }

    // =========================================
    // Command Palette (Ctrl+K)
    // =========================================
    function openCommandPalette() {
        let overlay = document.getElementById('commandPalette');
        commandPaletteReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'commandPalette';
            overlay.innerHTML = `
                <div class="cmd-backdrop"></div>
                <div class="cmd-dialog" role="dialog" aria-modal="true" aria-labelledby="commandPaletteLabel">
                    <div id="commandPaletteLabel" class="sr-only">Command palette</div>
                    <input type="search" id="commandPaletteInput" class="cmd-input" name="command_palette_query" placeholder="Type a command, script name, or action…" aria-label="Command palette" role="combobox" aria-autocomplete="list" aria-controls="commandPaletteResults" aria-expanded="true" autocomplete="off" spellcheck="false">
                    <div id="commandPaletteResults" class="cmd-results" role="listbox" aria-label="Command results"></div>
                </div>
            `;
            document.body.appendChild(overlay);

            const backdrop = overlay.querySelector('.cmd-backdrop');
            backdrop.addEventListener('click', closeCommandPalette);

            const input = overlay.querySelector('.cmd-input');
            input.addEventListener('input', () => renderCommandResults(input.value));
            input.addEventListener('keydown', (e) => {
                const items = getCommandPaletteItems(overlay);
                const activeIndex = items.findIndex(item => item.classList.contains('active'));
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    if (!items.length) return;
                    const nextItem = activeIndex === -1 ? items[0] : items[Math.min(activeIndex + 1, items.length - 1)];
                    setCommandPaletteActiveItem(overlay, nextItem);
                    nextItem?.scrollIntoView({ block: 'nearest' });
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (!items.length) return;
                    const nextItem = activeIndex <= 0 ? items[0] : items[activeIndex - 1];
                    setCommandPaletteActiveItem(overlay, nextItem);
                    nextItem?.scrollIntoView({ block: 'nearest' });
                } else if (e.key === 'Home') {
                    e.preventDefault();
                    if (!items.length) return;
                    setCommandPaletteActiveItem(overlay, items[0]);
                    items[0]?.scrollIntoView({ block: 'nearest' });
                } else if (e.key === 'End') {
                    e.preventDefault();
                    if (!items.length) return;
                    const nextItem = items[items.length - 1];
                    setCommandPaletteActiveItem(overlay, nextItem);
                    nextItem?.scrollIntoView({ block: 'nearest' });
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    const target = activeIndex >= 0 ? items[activeIndex] : items[0];
                    if (target) target.click();
                } else if (e.key === 'Escape') {
                    closeCommandPalette();
                }
            });
        }

        overlay.classList.add('open');
        const dialog = overlay.querySelector('.cmd-dialog');
        if (dialog && typeof A11y !== 'undefined' && typeof A11y.trapFocus === 'function') {
            A11y.trapFocus(dialog);
        }
        const input = overlay.querySelector('.cmd-input');
        if (input) {
            input.value = '';
            input.setAttribute('aria-expanded', 'true');
            input.removeAttribute('aria-activedescendant');
            input.focus();
        }
        renderCommandResults('');
    }

    function closeCommandPalette() {
        const overlay = document.getElementById('commandPalette');
        const wasOpen = overlay?.classList.contains('open');
        overlay?.classList.remove('open');
        const input = overlay?.querySelector('.cmd-input');
        input?.setAttribute('aria-expanded', 'false');
        input?.removeAttribute('aria-activedescendant');
        if (wasOpen && typeof A11y !== 'undefined' && typeof A11y.releaseFocus === 'function') {
            A11y.releaseFocus();
        }
        if (commandPaletteReturnFocus?.isConnected) {
            commandPaletteReturnFocus.focus();
        }
        commandPaletteReturnFocus = null;
    }

    function renderCommandResults(query) {
        const results = document.querySelector('#commandPalette .cmd-results');
        if (!results) return;
        const overlay = results.closest('#commandPalette');

        const q = query.toLowerCase().trim();

        // Build command list
        const commands = [
            // Actions
            { category: 'Actions', label: 'New Script', desc: 'Create a new script from template', action: () => { closeCommandPalette(); createNewScript(); } },
            { category: 'Actions', label: 'Import Script', desc: 'Import from file', action: () => { closeCommandPalette(); importScript(); } },
            { category: 'Actions', label: 'Check for Updates', desc: 'Check all scripts for updates', action: () => { closeCommandPalette(); document.getElementById('btnCheckUpdates')?.click(); } },
            { category: 'Actions', label: 'Export All (ZIP)', desc: 'Export all scripts as ZIP', action: () => { closeCommandPalette(); elements.btnExportZip?.click(); } },
            { category: 'Actions', label: 'Export All (JSON)', desc: 'Export all scripts as JSON', action: () => { closeCommandPalette(); elements.btnExportFile?.click(); } },
            { category: 'Actions', label: 'Export Stats CSV', desc: 'Export execution statistics', action: () => { closeCommandPalette(); exportStatsCSV(); } },
            { category: 'Actions', label: 'Find Scripts', desc: 'Search GreasyFork/OpenUserJS', action: () => { closeCommandPalette(); openFindScripts(); } },
            { category: 'Editor', label: 'Go to Line (Ctrl+G)', desc: 'Jump to a specific line number', action: async () => { closeCommandPalette(); await goToEditorLine(state.editor); } },
            // Navigation
            { category: 'Navigation', label: 'Scripts Tab', desc: 'Go to installed scripts', action: () => { closeCommandPalette(); switchTab('scripts'); } },
            { category: 'Navigation', label: 'Settings Tab', desc: 'Open settings', action: () => { closeCommandPalette(); switchTab('settings'); } },
            { category: 'Navigation', label: 'Utilities Tab', desc: 'Import/export tools', action: () => { closeCommandPalette(); switchTab('utilities'); } },
            { category: 'Navigation', label: 'Trash Tab', desc: 'View deleted scripts', action: () => { closeCommandPalette(); switchTab('trash'); } },
            { category: 'Navigation', label: 'Script Store Tab', desc: 'Discover installable scripts', action: () => { closeCommandPalette(); switchTab('store'); } },
            { category: 'Navigation', label: 'Help Tab', desc: 'Shortcuts and documentation', action: () => { closeCommandPalette(); switchTab('help'); } },
            // Settings
            { category: 'Settings', label: 'Toggle Dark/Light Theme', desc: 'Switch between themes', action: () => { closeCommandPalette(); document.getElementById('btnCycleTheme')?.click(); } },
            { category: 'Settings', label: 'Toggle Word Wrap', desc: 'Editor word wrap on/off', action: () => { closeCommandPalette(); document.getElementById('tbtnWordWrap')?.click(); } },
            { category: 'Settings', label: 'Column Visibility', desc: 'Show/hide table columns', action: () => { closeCommandPalette(); document.getElementById('btnColumnToggle')?.click(); } },
        ];

        // Add installed scripts as commands
        for (const s of state.scripts) {
            const name = s.metadata?.name || 'Unnamed';
            commands.push({
                category: 'Scripts',
                label: name,
                desc: s.metadata?.description || `v${s.metadata?.version || '?'} - ${s.enabled !== false ? 'Enabled' : 'Disabled'}`,
                action: () => { closeCommandPalette(); openEditorForScript(s.id); }
            });
        }

        // Filter
        const filtered = q
            ? commands.filter(c => c.label.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q) || c.category.toLowerCase().includes(q))
            : commands;

        // Group by category
        const groups = {};
        for (const c of filtered.slice(0, 20)) {
            if (!groups[c.category]) groups[c.category] = [];
            groups[c.category].push(c);
        }

        if (Object.keys(groups).length === 0) {
            results.innerHTML = '<div class="cmd-empty" role="status" aria-live="polite">No matching commands</div>';
            setCommandPaletteActiveItem(overlay, null);
            return;
        }

        let html = '';
        let renderedCount = 0;
        for (const [cat, items] of Object.entries(groups)) {
            html += `<div class="cmd-group">${escapeHtml(cat)}</div>`;
            html += items.map(c => {
                const activeClass = renderedCount === 0 ? ' active' : '';
                const isActive = renderedCount === 0;
                const optionId = `commandPaletteOption-${renderedCount}`;
                renderedCount += 1;
                return `<button type="button" id="${optionId}" role="option" aria-selected="${String(isActive)}" tabindex="-1" class="cmd-item${activeClass}" data-cmd-idx="${commands.indexOf(c)}"><span class="cmd-label">${escapeHtml(c.label)}</span><span class="cmd-desc">${escapeHtml(c.desc)}</span></button>`;
            }).join('');
        }

        results.innerHTML = html;
        setCommandPaletteActiveItem(overlay, getCommandPaletteItems(overlay)[0] || null);

        // Bind clicks
        results.querySelectorAll('.cmd-item').forEach(item => {
            item.addEventListener('click', () => {
                const idx = parseInt(item.dataset.cmdIdx);
                commands[idx]?.action();
            });
            item.addEventListener('mouseenter', () => {
                setCommandPaletteActiveItem(overlay, item);
            });
            item.addEventListener('focus', () => {
                setCommandPaletteActiveItem(overlay, item);
            });
        });
    }

    async function switchTab(name, options = {}) {
        const { updateRoute = true, focusControl = false } = options;
        const nextTab = DASHBOARD_TABS.includes(name) ? name : 'scripts';
        const editorActive = elements.editorOverlay?.classList.contains('active');
        if (editorActive) {
            if (state.currentScriptId && state.editor && state.openTabs[state.currentScriptId]) {
                state.openTabs[state.currentScriptId].code = state.editor.getValue();
                state.openTabs[state.currentScriptId].unsaved = state.unsavedChanges;
            }
            state.currentScriptId = null;
            hideEditorOverlay();
        }
        document.querySelectorAll('.tm-tab.script-tab').forEach(t => t.classList.remove('active'));
        setDashboardSection(nextTab, { focusControl });
        if (updateRoute) {
            setDashboardHash(nextTab === 'scripts' ? '' : `tab=${nextTab}`);
        }
        if (nextTab === 'trash') loadTrash();
        if (nextTab === 'utilities') {
            refreshUtilitiesDiagnostics().catch(error => {
                console.warn('[ScriptVault] Diagnostics refresh failed:', error?.message || error);
            });
            loadBackups().catch(error => {
                console.warn('[ScriptVault] Backup browser refresh failed:', error?.message || error);
            });
            loadBackupSettings().catch(error => {
                console.warn('[ScriptVault] Backup schedule refresh failed:', error?.message || error);
            });
        }

        // Lazy-load and initialize modules for this tab
        await lazyInitTab(nextTab);
    }

    function showDropOverlay(show) {
        let overlay = document.getElementById('dropOverlay');
        if (show && !overlay) {
            overlay = document.createElement('div');
            overlay.id = 'dropOverlay';
            overlay.innerHTML = '<div class="drop-overlay-content"><div class="drop-overlay-icon">📥</div><div class="drop-overlay-text">Drop .user.js or .zip files to install</div></div>';
            document.body.appendChild(overlay);
        }
        if (overlay) overlay.classList.toggle('active', show);
    }

    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
