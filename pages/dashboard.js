// ScriptVault Dashboard v1.7.8 - Full-Featured Controller
(function() {
    'use strict';

    // State
    const state = {
        scripts: [],
        settings: {},
        folders: [],
        currentScriptId: null,
        editor: null,
        unsavedChanges: false,
        selectedScripts: new Set(),
        sortColumn: 'updated',
        sortDirection: 'desc',
        openTabs: {},  // { scriptId: { code, unsaved } }
        _collapsedFolders: new Set(),
        _lastCheckedId: null,
        _quotaWarned: false
    };

    // DOM Elements
    const elements = {};

    function cacheElements() {
        // Main tabs
        elements.mainTabs = document.querySelectorAll('.tm-tab');
        elements.mainPanels = {
            scripts: document.getElementById('scriptsPanel'),
            settings: document.getElementById('settingsPanel'),
            utilities: document.getElementById('utilitiesPanel'),
            trash: document.getElementById('trashPanel'),
            help: document.getElementById('helpPanel')
        };

        // Scripts tab
        elements.scriptSearch = document.getElementById('scriptSearch');
        elements.scriptTableBody = document.getElementById('scriptTableBody');
        elements.emptyState = document.getElementById('emptyState');
        elements.selectAllScripts = document.getElementById('selectAllScripts');
        elements.btnNewScript = document.getElementById('btnNewScript');
        elements.btnImportScript = document.getElementById('btnImportScript');
        elements.btnCheckUpdates = document.getElementById('btnCheckUpdates');
        elements.btnExportAll = document.getElementById('btnExportAll');
        
        // Bulk Actions (Tampermonkey-style)
        elements.bulkSelectAll = document.getElementById('bulkSelectAll');
        elements.bulkActionSelect = document.getElementById('bulkActionSelect');
        elements.btnBulkApply = document.getElementById('btnBulkApply');
        elements.filterSelect = document.getElementById('filterSelect');
        elements.scriptCounter = document.getElementById('scriptCounter');

        // Help button (header icon)
        elements.btnHelpTab = document.getElementById('btnHelpTab');
        elements.btnCycleTheme = document.getElementById('btnCycleTheme');

        // Editor overlay
        elements.editorOverlay = document.getElementById('editorOverlay');
        elements.editorTitle = document.getElementById('editorTitle');
        elements.editorLineCount = document.getElementById('editorLineCount');
        elements.editorCursorPos = document.getElementById('editorCursorPos');
        elements.editorTextarea = document.getElementById('editorTextarea');
        elements.editorTabs = document.querySelectorAll('.editor-tab');
        elements.editorPanels = {
            code: document.getElementById('codePanel'),
            info: document.getElementById('infoPanel'),
            storage: document.getElementById('storagePanel'),
            scriptsettings: document.getElementById('scriptsettingsPanel')
        };
        elements.btnEditorSave = document.getElementById('btnEditorSave');
        elements.btnEditorToggle = document.getElementById('btnEditorToggle');
        elements.btnEditorDuplicate = document.getElementById('btnEditorDuplicate');
        elements.btnEditorExport = document.getElementById('btnEditorExport');
        elements.btnEditorDelete = document.getElementById('btnEditorDelete');
        // btnEditorClose removed - tabs handle closing

        // Info panel
        elements.infoName = document.getElementById('infoName');
        elements.infoVersion = document.getElementById('infoVersion');
        elements.infoAuthor = document.getElementById('infoAuthor');
        elements.infoDescription = document.getElementById('infoDescription');
        elements.infoHomepage = document.getElementById('infoHomepage');
        elements.infoUpdateUrl = document.getElementById('infoUpdateUrl');
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
        elements.btnRestartExtension = document.getElementById('btnRestartExtension');
        elements.btnFactoryReset = document.getElementById('btnFactoryReset');

        // Utilities
        elements.btnExportFile = document.getElementById('btnExportFile');
        elements.btnExportZip = document.getElementById('btnExportZip');
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
    function updateHeaderHeight() {
        const header = document.querySelector('.tm-header');
        if (header) {
            const h = header.offsetHeight;
            document.documentElement.style.setProperty('--header-height', h + 'px');
            const toolbar = document.querySelector('.scripts-toolbar');
            if (toolbar) {
                document.documentElement.style.setProperty('--toolbar-bottom', (h + toolbar.offsetHeight) + 'px');
            }
        }
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
        updateHeaderHeight();
        window.addEventListener('resize', updateHeaderHeight);

        // Event delegation for favicon error handling (CSP-compliant)
        // Handles images with data-favicon-fallback attribute
        document.addEventListener('error', function(e) {
            if (e.target.tagName === 'IMG' && e.target.hasAttribute('data-favicon-fallback')) {
                e.target.style.display = 'none';
                if (e.target.parentElement) {
                    e.target.parentElement.classList.add('favicon-fallback');
                }
            }
        }, true); // Use capture phase to catch errors before they propagate
        
        await loadSettings();
        await loadFolders();
        await loadScripts();
        try { initEditor(); } catch (e) { console.error('[ScriptVault] Editor init failed:', e); }
        initEventListeners();
        updateSortIndicators();
        applyTheme();
        updateStats();
        toggleSyncProviderSettings();
        loadSyncProviderStatus();
        loadWorkspaces();
        await checkUserScriptsAvailability();

        const hash = window.location.hash.slice(1);
        if (hash === 'new_script') {
            createNewScript();
        } else if (hash) {
            const scriptId = hash.startsWith('script_') ? hash.slice(7) : hash;
            openEditorForScript(scriptId);
        }
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
                state.settings = response.settings;
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
        if (elements.settingsEnableSync) elements.settingsEnableSync.checked = s.enableSync || false;
        if (elements.settingsSyncType) {
            elements.settingsSyncType.value = s.syncType || 'browser';
            toggleSyncProviderSettings();
        }
        if (elements.settingsWebdavUrl) elements.settingsWebdavUrl.value = s.webdavUrl || '';
        if (elements.settingsWebdavUsername) elements.settingsWebdavUsername.value = s.webdavUsername || '';
        if (elements.settingsWebdavPassword) elements.settingsWebdavPassword.value = s.webdavPassword || '';
        if (elements.syncLog) elements.syncLog.value = s.syncLog || '';
        
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
            showToast('Setting saved', 'success');
        } catch (e) {
            showToast('Failed to save', 'error');
        }
    }

    function toggleSyncProviderSettings() {
        const syncType = elements.settingsSyncType?.value || 'browser';
        
        // Hide all provider settings first
        if (elements.syncWebdavSettings) elements.syncWebdavSettings.style.display = 'none';
        if (elements.syncOAuthSettings) elements.syncOAuthSettings.style.display = 'none';
        
        // Show selected provider settings
        if (syncType === 'webdav' && elements.syncWebdavSettings) {
            elements.syncWebdavSettings.style.display = 'block';
        } else if (['googledrive', 'dropbox', 'onedrive'].includes(syncType) && elements.syncOAuthSettings) {
            elements.syncOAuthSettings.style.display = 'block';
        }
    }
    
    // Update sync provider status UI
    function updateSyncProviderUI(provider, status) {
        const statusEl = elements[`${provider}Status`];
        const userEl = elements[`${provider}User`];
        const userRowEl = elements[`${provider}UserRow`];
        const connectBtn = elements[`btnConnect${capitalize(provider)}`];
        const disconnectBtn = elements[`btnDisconnect${capitalize(provider)}`];
        const syncBtn = elements[`btnSync${capitalize(provider)}`];
        
        if (status?.connected) {
            if (statusEl) {
                statusEl.textContent = 'Connected';
                statusEl.className = 'sync-status connected';
            }
            if (userEl && status.user) userEl.textContent = status.user;
            if (userRowEl) userRowEl.style.display = status.user ? 'flex' : 'none';
            if (connectBtn) connectBtn.style.display = 'none';
            if (disconnectBtn) disconnectBtn.style.display = 'inline-block';
            if (syncBtn) syncBtn.style.display = 'inline-block';
        } else {
            if (statusEl) {
                statusEl.textContent = 'Not connected';
                statusEl.className = 'sync-status disconnected';
            }
            if (userRowEl) userRowEl.style.display = 'none';
            if (connectBtn) connectBtn.style.display = 'inline-block';
            if (disconnectBtn) disconnectBtn.style.display = 'none';
            if (syncBtn) syncBtn.style.display = 'none';
        }
    }
    
    function capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
    
    // Load sync provider status for OAuth providers
    async function loadSyncProviderStatus() {
        const providers = ['googledrive', 'dropbox', 'onedrive'];
        await Promise.allSettled(providers.map(async (provider) => {
            try {
                const response = await chrome.runtime.sendMessage({ action: 'getSyncProviderStatus', provider });
                updateSyncProviderUI(provider, response);
            } catch (e) {
                console.error(`Failed to get ${provider} status:`, e);
            }
        }));
        
        // Update last sync time
        if (elements.lastSyncTime && state.settings.lastSync) {
            elements.lastSyncTime.textContent = new Date(state.settings.lastSync).toLocaleString();
        }
    }
    
    // Connect to cloud sync provider
    async function connectSyncProvider(provider) {
        showToast(`Connecting to ${capitalize(provider)}...`, 'info');
        try {
            const response = await chrome.runtime.sendMessage({ action: 'connectSyncProvider', provider });
            if (response?.success) {
                showToast(`Connected to ${capitalize(provider)}!`, 'success');
                updateSyncProviderUI(provider, response);
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
            await chrome.runtime.sendMessage({ action: 'disconnectSyncProvider', provider });
            showToast(`Disconnected from ${capitalize(provider)}`, 'success');
            updateSyncProviderUI(provider, { connected: false });
        } catch (e) {
            showToast(`Disconnect failed: ${e.message}`, 'error');
        }
    }
    
    // Sync with provider
    async function syncWithProvider(provider) {
        showToast('Syncing...', 'info');
        try {
            const response = await chrome.runtime.sendMessage({ action: 'syncNow' });
            if (response?.success) {
                await loadScripts();
                updateStats();
                if (elements.lastSyncTime) {
                    elements.lastSyncTime.textContent = new Date().toLocaleString();
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
            el.innerHTML = '<em style="color: var(--text-muted);">None defined</em>';
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

    function applyConfigMode() {
        const mode = state.settings.configMode || 'advanced';
        document.querySelectorAll('#settingsTab .settings-section[data-config-level]').forEach(section => {
            const level = section.getAttribute('data-config-level');
            if (level === 'advanced' && mode !== 'advanced') {
                section.style.display = 'none';
            } else {
                section.style.display = '';
            }
        });
    }

    // Trash
    async function loadTrash() {
        if (!elements.trashList) return;
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getTrash' });
            const trash = response?.trash || [];

            if (trash.length === 0) {
                elements.trashList.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:40px">Trash is empty</div>';
                return;
            }

            elements.trashList.innerHTML = '';
            const table = document.createElement('table');
            table.className = 'script-table';
            table.style.width = '100%';
            table.innerHTML = '<thead><tr><th>Name</th><th class="center">Version</th><th class="center">Deleted</th><th class="center">Actions</th></tr></thead>';
            const tbody = document.createElement('tbody');

            trash.forEach(script => {
                const tr = document.createElement('tr');
                const name = script.metadata?.name || script.meta?.name || 'Unnamed';
                const version = script.metadata?.version || script.meta?.version || '-';
                const deletedAt = script.trashedAt ? formatTime(script.trashedAt) : '-';
                tr.innerHTML = `
                    <td>${escapeHtml(name)}</td>
                    <td class="center">${escapeHtml(version)}</td>
                    <td class="center">${deletedAt}</td>
                    <td class="center">
                        <div class="action-icons">
                            <button class="btn" style="font-size:11px;padding:4px 10px" data-restore="${script.id}">Restore</button>
                            <button class="btn btn-danger" style="font-size:11px;padding:4px 10px" data-permdelete="${script.id}">Delete</button>
                        </div>
                    </td>
                `;
                tr.querySelector('[data-restore]').addEventListener('click', async () => {
                    await chrome.runtime.sendMessage({ action: 'restoreFromTrash', scriptId: script.id });
                    showToast('Script restored', 'success');
                    await loadTrash();
                    await loadScripts();
                    updateStats();
                });
                tr.querySelector('[data-permdelete]').addEventListener('click', async () => {
                    await chrome.runtime.sendMessage({ action: 'permanentlyDelete', scriptId: script.id });
                    showToast('Permanently deleted', 'success');
                    await loadTrash();
                });
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            elements.trashList.innerHTML = '';
            elements.trashList.appendChild(table);
        } catch (e) {
            console.error('Failed to load trash:', e);
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
        const name = prompt('Folder name:');
        if (!name?.trim()) return;
        const colors = ['#60a5fa', '#f87171', '#fbbf24', '#a78bfa', '#34d399', '#fb923c'];
        const color = colors[state.folders?.length % colors.length] || '#60a5fa';
        try {
            const res = await chrome.runtime.sendMessage({ action: 'createFolder', name: name.trim(), color });
            if (res?.folder) {
                await loadFolders();
                renderScriptTable();
                showToast('Folder created', 'success');
            }
        } catch (e) { showToast('Failed', 'error'); }
    }

    async function deleteFolder(folderId) {
        if (!await showConfirmModal('Delete Folder', 'Delete this folder? Scripts will not be deleted.')) return;
        await chrome.runtime.sendMessage({ action: 'deleteFolder', id: folderId });
        await loadFolders();
        renderScriptTable();
        showToast('Folder deleted', 'success');
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
                if (fromId !== toId) {
                    await chrome.runtime.sendMessage({ action: 'moveScriptToFolder', scriptId, fromFolderId: fromId, toFolderId: toId });
                    await loadFolders();
                    renderScriptTable();
                }
                hideModal();
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
        document.querySelectorAll('.scripts-table th.sortable').forEach(th => {
            const indicator = th.querySelector('.sort-indicator');
            if (!indicator) return;
            indicator.className = 'sort-indicator';
            if (th.dataset.sort === state.sortColumn) {
                indicator.classList.add(state.sortDirection);
            }
        });
    }
    
    // Update bulk selection checkboxes
    function updateBulkCheckboxes() {
        const filtered = getFilteredScripts();
        
        // Update individual checkboxes
        document.querySelectorAll('.script-checkbox').forEach(cb => {
            cb.checked = state.selectedScripts.has(cb.dataset.id);
        });
        
        // Update select all checkbox
        const allSelected = filtered.length > 0 && filtered.every(s => state.selectedScripts.has(s.id));
        if (elements.bulkSelectAll) elements.bulkSelectAll.checked = allSelected;
        if (elements.selectAllScripts) elements.selectAllScripts.checked = allSelected;
    }
    
    // Execute bulk action
    async function executeBulkAction() {
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
                showProgress(`Enabling ${ids.length} scripts...`);
                for (let i = 0; i < ids.length; i++) {
                    const s = state.scripts.find(x => x.id === ids[i]);
                    updateProgress(i + 1, ids.length, `${s?.metadata?.name || ids[i]} (${i + 1}/${ids.length})`);
                    try {
                        await chrome.runtime.sendMessage({ action: 'toggleScript', scriptId: ids[i], enabled: true });
                    } catch (e) {
                        console.warn('[ScriptVault] Enable failed for', ids[i], e.message);
                    }
                }
                await loadScripts();
                updateStats();
                hideProgress();
                showToast(`Enabled ${ids.length} scripts`, 'success');
                break;

            case 'disable':
                showProgress(`Disabling ${ids.length} scripts...`);
                for (let i = 0; i < ids.length; i++) {
                    const s = state.scripts.find(x => x.id === ids[i]);
                    updateProgress(i + 1, ids.length, `${s?.metadata?.name || ids[i]} (${i + 1}/${ids.length})`);
                    try {
                        await chrome.runtime.sendMessage({ action: 'toggleScript', scriptId: ids[i], enabled: false });
                    } catch (e) {
                        console.warn('[ScriptVault] Disable failed for', ids[i], e.message);
                    }
                }
                await loadScripts();
                updateStats();
                hideProgress();
                showToast(`Disabled ${ids.length} scripts`, 'success');
                break;

            case 'export':
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
                URL.revokeObjectURL(url);
                showToast(`Exported ${ids.length} scripts`, 'success');
                break;

            case 'update':
                showProgress(`Checking updates for ${ids.length} scripts...`);
                let updateCount = 0;
                for (let i = 0; i < ids.length; i++) {
                    const s = state.scripts.find(x => x.id === ids[i]);
                    updateProgress(i + 1, ids.length, `${s?.metadata?.name || ids[i]} (${i + 1}/${ids.length})`);
                    try {
                        const updates = await chrome.runtime.sendMessage({ action: 'checkUpdates', scriptId: ids[i] });
                        if (updates && updates.length > 0) {
                            await chrome.runtime.sendMessage({ action: 'applyUpdate', scriptId: ids[i], code: updates[0].code });
                            updateCount++;
                        }
                    } catch (e) {
                        console.warn('[ScriptVault] Update check failed for', ids[i], e.message);
                    }
                }
                await loadScripts();
                hideProgress();
                showToast(updateCount > 0 ? `${updateCount} script${updateCount > 1 ? 's' : ''} updated` : 'All up to date', 'success');
                break;

            case 'reset':
                if (!await showConfirmModal('Factory Reset', `Reset settings for ${ids.length} scripts?`)) return;
                showProgress(`Resetting ${ids.length} scripts...`);
                for (let i = 0; i < ids.length; i++) {
                    const s = state.scripts.find(x => x.id === ids[i]);
                    updateProgress(i + 1, ids.length, `${s?.metadata?.name || ids[i]} (${i + 1}/${ids.length})`);
                    try {
                        await chrome.runtime.sendMessage({ action: 'resetScriptSettings', scriptId: ids[i] });
                    } catch (e) {
                        console.warn('[ScriptVault] Reset failed for', ids[i], e.message);
                    }
                }
                await loadScripts();
                hideProgress();
                showToast(`Reset ${ids.length} scripts`, 'success');
                break;

            case 'delete':
                showProgress(`Deleting ${ids.length} scripts...`);
                for (let i = 0; i < ids.length; i++) {
                    const s = state.scripts.find(x => x.id === ids[i]);
                    updateProgress(i + 1, ids.length, `${s?.metadata?.name || ids[i]} (${i + 1}/${ids.length})`);
                    await deleteScript(ids[i], true);
                }
                state.selectedScripts.clear();
                await loadScripts();
                updateStats();
                hideProgress();
                showToast(`Deleted ${ids.length} scripts`, 'success');
                break;
        }
        
        // Reset dropdown
        if (elements.bulkActionSelect) elements.bulkActionSelect.value = '';
    }

    function renderScriptTable(filter = '') {
        if (!elements.scriptTableBody) return;
        elements.scriptTableBody.innerHTML = '';
        
        const filtered = getFilteredScripts();
        
        // Update script counter
        if (elements.scriptCounter) {
            const total = state.scripts.length;
            const shown = filtered.length;
            elements.scriptCounter.textContent = total === shown ? `${total} scripts` : `${shown} of ${total} scripts`;
        }

        if (filtered.length === 0) {
            if (elements.emptyState) elements.emptyState.style.display = 'block';
            return;
        }
        if (elements.emptyState) elements.emptyState.style.display = 'none';

        // Precompute conflict map once (avoids O(n^2) per-row scan)
        _conflictCache = buildConflictMap(state.scripts);

        // Render with folder grouping if folders exist
        const folders = state.folders || [];
        const collapsedFolders = state._collapsedFolders || new Set();

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
                folderTr.innerHTML = `<td colspan="14">
                    <span class="folder-icon">\u25BC</span>
                    <span class="folder-color" style="background:${escapeHtml(folder.color)}"></span>
                    ${escapeHtml(folder.name)} <span class="folder-count">(${folderScripts.length})</span>
                    <span class="folder-actions">
                        <button data-folder-delete="${folder.id}" title="Delete folder">x</button>
                    </span>
                </td>`;
                folderTr.addEventListener('click', (e) => {
                    if (e.target.closest('[data-folder-delete]')) {
                        e.stopPropagation();
                        deleteFolder(folder.id);
                        return;
                    }
                    if (collapsedFolders.has(folder.id)) collapsedFolders.delete(folder.id);
                    else collapsedFolders.add(folder.id);
                    state._collapsedFolders = collapsedFolders;
                    renderScriptTable();
                });
                elements.scriptTableBody.appendChild(folderTr);

                // Scripts in this folder
                if (!collapsed) {
                    for (const script of folderScripts) {
                        elements.scriptTableBody.appendChild(createScriptRow(script, rowIdx++));
                    }
                }
            }

            // Unassigned scripts
            const unassigned = filtered.filter(s => !assignedIds.has(s.id));
            if (unassigned.length > 0 && assignedIds.size > 0) {
                const headerTr = document.createElement('tr');
                headerTr.className = 'folder-row';
                headerTr.innerHTML = `<td colspan="14">
                    <span class="folder-icon">\u25BC</span>
                    Uncategorized <span class="folder-count">(${unassigned.length})</span>
                </td>`;
                elements.scriptTableBody.appendChild(headerTr);
            }
            for (const script of unassigned) {
                elements.scriptTableBody.appendChild(createScriptRow(script, rowIdx++));
            }
        } else {
            // No folders — flat list
            filtered.forEach((script, i) => {
                elements.scriptTableBody.appendChild(createScriptRow(script, i + 1));
            });
        }

        updateBulkCheckboxes();
        applyColumnVisibility();
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
        const faviconHtml = generateFaviconHtml(icon, domains[0]);
        
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

        // Conflict detection for table row
        const conflicts = findConflictingScripts(script.id, matches);
        const conflictHtml = conflicts.length > 0
          ? `<span class="conflict-badge" title="Overlaps with: ${escapeHtml(conflicts.map(c => c.name).join(', '))}">! ${conflicts.length}</span>`
          : '';

        // Health indicators
        const hasErrors = script.stats?.errors > 0;
        const daysSinceUpdate = script.updatedAt ? Math.floor((Date.now() - script.updatedAt) / 86400000) : 0;
        const isStale = daysSinceUpdate > 180 && (script.metadata?.updateURL || script.metadata?.downloadURL);
        const perfBudget = script.settings?.perfBudget || state.settings.perfBudget || 200;
        const overBudget = script.stats?.avgTime > perfBudget && script.stats?.runs > 2;
        if (hasErrors) tr.classList.add('row-has-errors');
        if (isStale) tr.classList.add('row-stale');
        if (overBudget) tr.classList.add('row-over-budget');

        tr.draggable = true;
        tr.dataset.scriptId = script.id;
        tr.innerHTML = `
            <td class="center"><input type="checkbox" class="script-checkbox" data-id="${script.id}"></td>
            <td class="center drag-handle" title="Drag to reorder" style="cursor:grab;color:var(--text-muted)">⠿</td>
            <td class="center">
                <label class="toggle-switch">
                    <input type="checkbox" class="script-toggle" data-id="${script.id}" ${enabled ? 'checked' : ''}>
                    <span class="toggle-slider"></span>
                </label>
            </td>
            <td>
                <div class="script-name-cell">
                    ${faviconHtml}
                    <span class="script-name" data-id="${script.id}" title="${escapeHtml(script.metadata?.description || '')}">${escapeHtml(name)}${isBroadMatch(matches) ? ' <span title="Runs on all/most sites" style="opacity:0.5">🌐</span>' : ''}</span>
                    ${script.metadata?.author ? `<span class="script-author">${escapeHtml(script.metadata.author)}</span>` : ''}
                    ${tagHtml ? `<div class="script-tags">${tagHtml}</div>` : ''}
                    ${conflictHtml}
                </div>
            </td>
            <td class="center">${escapeHtml(version)}</td>
            <td class="center">${size}</td>
            <td class="center">${lineCount}</td>
            <td class="center" title="${escapeHtml(domains.join('\n'))}">${siteIconsHtml}</td>
            <td class="center">
                <div class="feature-badges">${features.map(f => `<span class="badge ${f.c}">${f.l}</span>`).join('')}</div>
            </td>
            <td class="center">${homepage ? `<a href="${escapeHtml(homepage)}" target="_blank">🔗</a>` : '-'}</td>
            <td class="center"><span class="updated-link" data-action="checkUpdate" data-id="${script.id}" title="Click to check for updates" style="cursor:pointer">${updated}</span></td>
            <td class="center">${statsHtml}</td>
            <td class="center">
                <div class="action-icons">
                    <button class="action-icon ${script.settings?.pinned ? 'pinned' : ''}" title="${script.settings?.pinned ? 'Unpin' : 'Pin to top'}" data-action="pin" data-id="${script.id}">
                        <svg viewBox="0 0 24 24" fill="${script.settings?.pinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M12 2L9.1 8.6 2 9.2l5.5 4.8L5.8 21 12 17.3 18.2 21l-1.7-7 5.5-4.8-7.1-.6z"/></svg>
                    </button>
                    <button class="action-icon" title="Edit" data-action="edit" data-id="${script.id}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="action-icon" title="Check for update (right-click: force update)" data-action="updateScript" data-id="${script.id}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
                    </button>
                    <button class="action-icon" title="Export" data-action="exportScript" data-id="${script.id}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </button>${(script.metadata?.downloadURL || script.metadata?.updateURL) ? `
                    <button class="action-icon" title="Copy install URL" data-action="copyUrl" data-id="${script.id}" data-url="${escapeHtml(script.metadata.downloadURL || script.metadata.updateURL)}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                    </button>` : ''}
                    <button class="action-icon" title="Move to folder" data-action="moveFolder" data-id="${script.id}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                    </button>
                    <button class="action-icon" title="Delete" data-action="delete" data-id="${script.id}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    </button>
                </div>
            </td>
        `;

        tr.querySelector('.script-toggle')?.addEventListener('change', e => {
            toggleScriptEnabled(script.id, e.target.checked);
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
        tr.querySelector('.script-name')?.addEventListener('click', () => openEditorForScript(script.id));
        tr.querySelector('[data-action="edit"]')?.addEventListener('click', () => openEditorForScript(script.id));
        tr.querySelector('[data-action="delete"]')?.addEventListener('click', () => deleteScript(script.id));
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
            const btn = e.currentTarget;
            btn.style.opacity = '0.4';
            btn.style.pointerEvents = 'none';
            try {
                const updates = await chrome.runtime.sendMessage({ action: 'checkUpdates', scriptId: script.id });
                if (updates && updates.length > 0) {
                    await chrome.runtime.sendMessage({ action: 'applyUpdate', scriptId: script.id, code: updates[0].code });
                    showToast(`${name} updated to v${updates[0].newVersion}`, 'success');
                    setTimeout(() => loadScripts(), 800);
                } else {
                    showToast(`${name} is up to date`, 'info');
                    btn.style.opacity = '';
                    btn.style.pointerEvents = '';
                }
            } catch (err) {
                showToast('Update check failed', 'error');
                btn.style.opacity = '';
                btn.style.pointerEvents = '';
            }
        });
        // Right-click = force update (bypass HTTP cache)
        tr.querySelector('[data-action="updateScript"]')?.addEventListener('contextmenu', async (e) => {
            e.preventDefault();
            const btn = e.currentTarget;
            btn.style.opacity = '0.4';
            btn.style.pointerEvents = 'none';
            showToast(`Force-updating ${name}...`, 'info');
            try {
                const res = await chrome.runtime.sendMessage({ action: 'forceUpdate', scriptId: script.id });
                if (res?.success) {
                    showToast(`${name} force-updated to v${res.script?.meta?.version || '?'}`, 'success');
                    setTimeout(() => loadScripts(), 800);
                } else {
                    showToast(res?.error || 'Force update failed', 'error');
                    btn.style.opacity = '';
                    btn.style.pointerEvents = '';
                }
            } catch (err) {
                showToast('Force update failed', 'error');
                btn.style.opacity = '';
                btn.style.pointerEvents = '';
            }
        });
        tr.querySelector('[data-action="checkUpdate"]')?.addEventListener('click', async (e) => {
            const el = e.target;
            el.textContent = '...';
            try {
                const updates = await chrome.runtime.sendMessage({ action: 'checkUpdates', scriptId: script.id });
                if (updates && updates.length > 0) {
                    await chrome.runtime.sendMessage({ action: 'applyUpdate', scriptId: script.id, code: updates[0].code });
                    el.textContent = `v${updates[0].newVersion}`;
                    el.style.color = 'var(--accent-primary)';
                    setTimeout(() => loadScripts(), 1500);
                } else {
                    el.textContent = 'Up to date';
                    el.style.color = 'var(--text-muted)';
                    setTimeout(() => { el.textContent = updated; el.style.color = ''; }, 2000);
                }
            } catch (e) {
                el.textContent = updated;
            }
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
    
    // Generate favicon HTML for script name column
    // Uses data-favicon-fallback attribute for CSP-compliant error handling
    function generateFaviconHtml(iconUrl, firstDomain) {
        if (iconUrl) {
            // Use the script's @icon directly
            return `<span class="script-favicon"><img src="${escapeHtml(iconUrl)}" data-favicon-fallback="true"></span>`;
        } else if (firstDomain) {
            // Derive favicon from first domain
            const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(firstDomain)}&sz=32`;
            return `<span class="script-favicon"><img src="${faviconUrl}" data-favicon-fallback="true"></span>`;
        } else {
            return `<span class="script-favicon favicon-fallback"></span>`;
        }
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
    
    // Generate site icons HTML for sites column
    function generateSiteIconsHtml(domains) {
        if (domains.length === 0) {
            return '-';
        }
        
        const maxIcons = 5;
        const displayDomains = domains.slice(0, maxIcons);
        const remainingCount = domains.length - maxIcons;
        
        let html = '<div class="site-icons">';
        
        for (const domain of displayDomains) {
            const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
            html += `<span class="site-icon" title="${escapeHtml(domain)}"><img src="${faviconUrl}" data-favicon-fallback="true"></span>`;
        }
        
        if (remainingCount > 0) {
            html += `<span class="site-icon-more" title="${escapeHtml(domains.slice(maxIcons).join('\n'))}">+${remainingCount}</span>`;
        }
        
        html += '</div>';
        return html;
    }

    // Editor
    function openEditorForScript(scriptId) {
        const script = state.scripts.find(s => s.id === scriptId);
        if (!script) return;

        // Save current editor state before switching
        if (state.currentScriptId && state.editor && state.openTabs[state.currentScriptId]) {
            state.openTabs[state.currentScriptId].code = state.editor.getValue();
            state.openTabs[state.currentScriptId].unsaved = state.unsavedChanges;
        }

        // Create tab if not already open
        if (!state.openTabs[scriptId]) {
            state.openTabs[scriptId] = { code: script.code || '', unsaved: false };
            createScriptTab(scriptId, script.metadata?.name || 'Unnamed Script');
        }

        // Activate this script tab
        activateScriptTab(scriptId);
    }

    function createScriptTab(scriptId, name) {
        const tabBar = document.getElementById('scriptTabsGroup');
        if (!tabBar) return;
        const tab = document.createElement('button');
        tab.className = 'tm-tab script-tab';
        tab.dataset.tab = 'script_' + scriptId;
        tab.dataset.scriptId = scriptId;
        tab.innerHTML = `<span class="tab-name">${escapeHtml(name)}</span><span class="tab-close">&times;</span>`;
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
    }

    function updateLineCount() {
        if (elements.editorLineCount && state.editor) {
            const lines = state.editor.lineCount();
            elements.editorLineCount.textContent = lines + ' line' + (lines !== 1 ? 's' : '');
        }
    }

    function updateCursorPos() {
        if (elements.editorCursorPos && state.editor) {
            const cursor = state.editor.getCursor();
            elements.editorCursorPos.textContent = `Ln ${cursor.line + 1}, Col ${cursor.ch + 1}`;
        }
    }

    function activateScriptTab(scriptId) {
        const script = state.scripts.find(s => s.id === scriptId);
        if (!script) return;

        state.currentScriptId = scriptId;
        const tabData = state.openTabs[scriptId];
        state.unsavedChanges = tabData?.unsaved || false;

        // Deactivate all tabs and panels
        document.querySelectorAll('.tm-tab').forEach(t => t.classList.remove('active'));
        Object.values(elements.mainPanels).forEach(p => p?.classList.remove('active'));
        elements.btnHelpTab?.classList.remove('active');
        closeFindScripts();

        // Activate script tab
        const tab = document.querySelector(`.tm-tab[data-script-id="${scriptId}"]`);
        if (tab) tab.classList.add('active');

        // Load editor content
        if (elements.editorTitle) elements.editorTitle.textContent = script.metadata?.name || 'Edit Script';
        if (state.editor) {
            if (state.editor.isMonaco) state.editor.setScriptId(script.id);
            state.editor.setValue(tabData?.code ?? script.code ?? '');
            state.editor.clearHistory();
            setTimeout(() => state.editor.refresh(), 10);
            updateLineCount();
            updateCursorPos();
        }

        if (elements.btnEditorToggle) elements.btnEditorToggle.textContent = script.enabled !== false ? 'Disable' : 'Enable';
        loadScriptInfo(script);
        loadScriptStorage(script);
        loadExternals(script);
        elements.editorOverlay?.classList.add('active');
        setTimeout(() => state.editor?.focus(), 100);
    }

    function closeScriptTab(scriptId) {
        const tabData = state.openTabs[scriptId];
        const doClose = () => {
            // Remove tab element
            const tab = document.querySelector(`.tm-tab[data-script-id="${scriptId}"]`);
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
                elements.editorOverlay?.classList.remove('active');

                // Switch to another open script tab, or back to scripts panel
                const remaining = Object.keys(state.openTabs);
                if (remaining.length > 0) {
                    activateScriptTab(remaining[remaining.length - 1]);
                } else {
                    const scriptsTab = document.querySelector('.tm-tab[data-tab="scripts"]');
                    if (scriptsTab) {
                        scriptsTab.classList.add('active');
                        elements.mainPanels.scripts?.classList.add('active');
                    }
                }
            }
        };

        // Check for unsaved changes (skip if noSaveConfirm setting is enabled)
        if (tabData?.unsaved && !state.settings.noSaveConfirm) {
            if (!confirm('You have unsaved changes. Close without saving?')) return;
        }
        doClose();
    }

    function closeEditor() {
        if (state.currentScriptId) {
            closeScriptTab(state.currentScriptId);
        } else {
            elements.editorOverlay?.classList.remove('active');
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

        const hp = m.homepage || m.homepageURL;
        const safeHp = hp ? sanitizeUrl(hp) : null;
        if (elements.infoHomepage) elements.infoHomepage.innerHTML = safeHp ? `<a href="${escapeHtml(safeHp)}" target="_blank">${escapeHtml(hp)}</a>` : (hp ? escapeHtml(hp) : '-');

        const up = m.updateURL || m.downloadURL;
        const safeUp = up ? sanitizeUrl(up) : null;
        if (elements.infoUpdateUrl) elements.infoUpdateUrl.innerHTML = safeUp ? `<a href="${escapeHtml(safeUp)}" target="_blank">${escapeHtml(up)}</a>` : (up ? escapeHtml(up) : '-');

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
                const compatHtml = compat.map(c => `<span class="info-tag" style="background:var(--success-bg,#1a3a1a);color:var(--success-text,#4ade80)">✓ ${escapeHtml(c)}</span>`).join('');
                const incompatHtml = incompat.map(c => `<span class="info-tag" style="background:var(--error-bg,#3a1a1a);color:var(--error-text,#f87171)">✗ ${escapeHtml(c)}</span>`).join('');
                compatEl.innerHTML = compatHtml + incompatHtml;
            } else {
                compatEl.innerHTML = '<span style="color:var(--text-muted)">Not specified</span>';
            }
        }

        // @license
        const licenseEl = document.getElementById('infoLicense');
        if (licenseEl) licenseEl.textContent = m.license || m.copyright || '-';

        const grants = m.grant || [];
        if (elements.infoGrants) elements.infoGrants.innerHTML = grants.length ? grants.map(g => `<span class="info-tag grant">${escapeHtml(g)}</span>`).join('') : '<span class="info-tag">none</span>';

        const matches = [...(m.match || []), ...(m.include || [])];
        elements.infoMatches.innerHTML = matches.length ? matches.map(x => `<span class="info-tag">${escapeHtml(x)}</span>`).join('') : '-';

        const res = [...(Array.isArray(m.resource) ? m.resource : []), ...(Array.isArray(m.require) ? m.require : [])];
        elements.infoResources.innerHTML = res.length ? res.map(r => `<div style="font-size:11px;margin-bottom:3px">${escapeHtml(typeof r === 'string' ? r : r.url || r.name)}</div>`).join('') : '-';

        // Performance stats
        const perfEl = document.getElementById('infoPerfStats');
        const resetBtn = document.getElementById('btnResetStats');
        if (perfEl) {
            const s = script.stats;
            if (s && s.runs > 0) {
                const lastRun = s.lastRun ? new Date(s.lastRun).toLocaleString() : '-';
                perfEl.innerHTML = `
                    <span class="perf-label">Runs:</span><span class="perf-value">${s.runs}</span>
                    <span class="perf-label">Avg Time:</span><span class="perf-value">${s.avgTime}ms</span>
                    <span class="perf-label">Total Time:</span><span class="perf-value">${Math.round(s.totalTime)}ms</span>
                    <span class="perf-label">Errors:</span><span class="perf-value">${s.errors}${s.lastError ? ` (${escapeHtml(s.lastError)})` : ''}</span>
                    <span class="perf-label">Last Run:</span><span class="perf-value">${escapeHtml(lastRun)}</span>
                    ${s.lastUrl ? `<span class="perf-label">Last URL:</span><span class="perf-value" style="word-break:break-all">${escapeHtml(s.lastUrl)}</span>` : ''}
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
                perfEl.textContent = 'No execution data yet';
                if (resetBtn) resetBtn.style.display = 'none';
            }
        }

        // Conflict detection
        const conflictsEl = document.getElementById('infoConflicts');
        if (conflictsEl) {
            const myPatterns = [...(m.match || []), ...(m.include || [])];
            const conflicts = findConflictingScripts(script.id, myPatterns);
            if (conflicts.length > 0) {
                conflictsEl.innerHTML = conflicts.map(c =>
                    `<div class="conflict-list-item">${escapeHtml(c.name)} <span style="color:var(--text-muted)">(${escapeHtml(c.sharedPatterns.join(', '))})</span></div>`
                ).join('');
            } else {
                conflictsEl.textContent = 'None';
            }
        }

        // Version history / rollback
        const historyEl = document.getElementById('infoVersionHistory');
        if (historyEl) {
            const history = script.versionHistory || [];
            if (history.length > 0) {
                historyEl.innerHTML = history.map((h, idx) =>
                    `<div class="version-history-item">
                        <span class="version-history-ver">v${escapeHtml(h.version)}</span>
                        <span class="version-history-date">${formatTime(h.updatedAt)}</span>
                        <button class="toolbar-btn version-rollback-btn" data-rollback-idx="${idx}" title="Rollback to this version">Rollback</button>
                        <button class="toolbar-btn version-diff-btn" data-diff-idx="${idx}" title="View diff with current code">Diff</button>
                    </div>`
                ).reverse().join('');

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
                                        state.unsavedChanges = false;
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
                historyEl.textContent = 'No previous versions';
            }
        }
    }

    function showDiffView(oldCode, newCode, oldLabel, newLabel) {
        const oldLines = oldCode.split('\n');
        const newLines = newCode.split('\n');

        // Simple line-by-line diff
        const maxLen = Math.max(oldLines.length, newLines.length);
        let diffHtml = '';
        let additions = 0, deletions = 0, unchanged = 0;

        for (let i = 0; i < maxLen; i++) {
            const oldLine = oldLines[i];
            const newLine = newLines[i];
            const lineNum = i + 1;

            if (oldLine === undefined) {
                // Added
                diffHtml += `<div class="diff-line diff-add"><span class="diff-ln">${lineNum}</span><span class="diff-sign">+</span><span class="diff-text">${escapeHtml(newLine)}</span></div>`;
                additions++;
            } else if (newLine === undefined) {
                // Deleted
                diffHtml += `<div class="diff-line diff-del"><span class="diff-ln">${lineNum}</span><span class="diff-sign">-</span><span class="diff-text">${escapeHtml(oldLine)}</span></div>`;
                deletions++;
            } else if (oldLine !== newLine) {
                // Changed
                diffHtml += `<div class="diff-line diff-del"><span class="diff-ln">${lineNum}</span><span class="diff-sign">-</span><span class="diff-text">${escapeHtml(oldLine)}</span></div>`;
                diffHtml += `<div class="diff-line diff-add"><span class="diff-ln">${lineNum}</span><span class="diff-sign">+</span><span class="diff-text">${escapeHtml(newLine)}</span></div>`;
                additions++;
                deletions++;
            } else {
                unchanged++;
                // Only show context lines (3 before/after changes)
                const hasNearbyChange = (i2) => {
                    for (let j = Math.max(0, i2 - 3); j <= Math.min(maxLen - 1, i2 + 3); j++) {
                        if (j === i2) continue;
                        if ((oldLines[j] || '') !== (newLines[j] || '')) return true;
                    }
                    return false;
                };
                if (hasNearbyChange(i)) {
                    diffHtml += `<div class="diff-line diff-ctx"><span class="diff-ln">${lineNum}</span><span class="diff-sign"> </span><span class="diff-text">${escapeHtml(newLine)}</span></div>`;
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
                elements.externalRequireList.innerHTML = '<span style="color:var(--text-muted)">No @require directives</span>';
            } else {
                elements.externalRequireList.innerHTML = requires.map(url => {
                    const safeUrl = sanitizeUrl(typeof url === 'string' ? url : url.url || '');
                    const display = escapeHtml(typeof url === 'string' ? url : url.url || url.name || '');
                    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px;border:1px solid var(--border-color);border-radius:4px;margin-bottom:6px;background:var(--bg-input)">
                        <span style="font-family:monospace;font-size:11px;word-break:break-all;flex:1">${safeUrl ? `<a href="${escapeHtml(safeUrl)}" target="_blank" style="color:var(--accent-secondary)">${display}</a>` : display}</span>
                    </div>`;
                }).join('');
            }
        }

        if (elements.externalResourceList) {
            if (resources.length === 0) {
                elements.externalResourceList.innerHTML = '<span style="color:var(--text-muted)">No @resource directives</span>';
            } else {
                elements.externalResourceList.innerHTML = resources.map(res => {
                    const name = typeof res === 'string' ? res.split(/\s+/)[0] : (res.name || '');
                    const url = typeof res === 'string' ? (res.split(/\s+/)[1] || res) : (res.url || '');
                    const safeUrl = sanitizeUrl(url);
                    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px;border:1px solid var(--border-color);border-radius:4px;margin-bottom:6px;background:var(--bg-input)">
                        <div style="flex:1">
                            <div style="font-weight:500;font-size:12px;color:var(--text-primary)">${escapeHtml(name)}</div>
                            <div style="font-family:monospace;font-size:11px;word-break:break-all;margin-top:2px">${safeUrl ? `<a href="${escapeHtml(safeUrl)}" target="_blank" style="color:var(--accent-secondary)">${escapeHtml(url)}</a>` : escapeHtml(url)}</div>
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
                elements.storageList.innerHTML = '<div style="color:var(--text-muted);padding:20px;text-align:center">No stored values</div>';
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
        const valStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
        let currentKey = key;

        item.innerHTML = `
            <span class="storage-key" title="Click to rename" style="cursor:pointer">${escapeHtml(key)}</span>
            <input type="text" class="input-field" value="${escapeHtml(valStr)}" style="flex:1">
            <div class="btn-group">
                <button class="btn" title="Save value">💾</button>
                <button class="btn" title="Rename key">✏️</button>
                <button class="btn btn-danger" title="Delete">🗑️</button>
            </div>
        `;

        const keySpan = item.querySelector('.storage-key');

        item.querySelector('.btn:first-of-type')?.addEventListener('click', async () => {
            let newVal = item.querySelector('.input-field').value;
            try { newVal = JSON.parse(newVal); } catch (e) {}
            await chrome.runtime.sendMessage({ action: 'setScriptValue', scriptId, key: currentKey, value: newVal });
            showToast('Saved', 'success');
        });

        // Rename button
        item.querySelectorAll('.btn')[1]?.addEventListener('click', async () => {
            const newKey = prompt('Rename key:', currentKey);
            if (!newKey || newKey === currentKey) return;
            const res = await chrome.runtime.sendMessage({ action: 'renameScriptValue', scriptId, oldKey: currentKey, newKey });
            if (res?.success) {
                currentKey = newKey;
                keySpan.textContent = newKey;
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
                item.remove();
                showToast('Deleted', 'success');
            }
        });

        return item;
    }

    // Script operations
    async function toggleScriptEnabled(scriptId, enabled) {
        try {
            await chrome.runtime.sendMessage({ action: 'toggleScript', scriptId, enabled });
            const script = state.scripts.find(s => s.id === scriptId);
            if (script) script.enabled = enabled;
            if (scriptId === state.currentScriptId) {
                elements.btnEditorToggle.textContent = enabled ? 'Disable' : 'Enable';
            }
            updateStats();
            showToast(enabled ? 'Enabled' : 'Disabled', 'success');
        } catch (e) {
            showToast('Failed', 'error');
        }
    }

    async function saveCurrentScript() {
        if (!state.currentScriptId || !state.editor) return;
        try {
            let code = state.editor.getValue();
            // Trim trailing whitespace if setting enabled
            if (state.settings.trimWhitespace) {
                code = code.split('\n').map(line => line.replace(/\s+$/, '')).join('\n');
                state.editor.setValue(code);
            }
            await chrome.runtime.sendMessage({ action: 'saveScript', scriptId: state.currentScriptId, code, markModified: true });
            state.unsavedChanges = false;
            // Update open tab state
            if (state.openTabs[state.currentScriptId]) {
                state.openTabs[state.currentScriptId].code = code;
                state.openTabs[state.currentScriptId].unsaved = false;
            }
            await loadScripts();
            const script = state.scripts.find(s => s.id === state.currentScriptId);
            if (script) {
                loadScriptInfo(script);
                const name = script.metadata?.name || 'Edit Script';
                if (elements.editorTitle) elements.editorTitle.textContent = name;
                // Update tab name
                const tab = document.querySelector(`.tm-tab[data-script-id="${state.currentScriptId}"]`);
                if (tab) {
                    tab.classList.remove('unsaved');
                    const tabName = tab.querySelector('.tab-name');
                    if (tabName) tabName.textContent = name;
                }
            }
            showToast('Saved', 'success');
        } catch (e) {
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
            await chrome.runtime.sendMessage({ action: 'deleteScript', scriptId });
            // Clean up open tab if exists
            if (state.openTabs[scriptId]) {
                delete state.openTabs[scriptId];
                document.querySelector(`.tm-tab.script-tab[data-script-id="${scriptId}"]`)?.remove();
            }
            if (scriptId === state.currentScriptId) {
                state.currentScriptId = null;
                state.unsavedChanges = false;
                elements.editorOverlay?.classList.remove('active');
            }
            if (!skipReload) {
                await loadScripts();
                updateStats();
                showToast('Deleted', 'success');
            }
        } catch (e) {
            if (!skipReload) showToast('Failed', 'error');
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
        history.replaceState(null, '', window.location.pathname);

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

        const cursor = state.editor.getCursor();
        state.editor.setValue(beautified.join('\n'));
        state.editor.setCursor(cursor);
        state.unsavedChanges = true;
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
                'Ctrl-F': 'findPersistent',
                'Ctrl-H': 'replace',
                'Esc': closeEditor,
                'Tab': cm => cm.somethingSelected() ? cm.indentSelection('add') : cm.replaceSelection(indentStr, 'end'),
                'Ctrl-Space': 'autocomplete',
                'Ctrl-/': () => document.getElementById('tbtnComment')?.click()
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
            state.unsavedChanges = true;
            // Mark tab as unsaved
            if (state.currentScriptId) {
                if (state.openTabs[state.currentScriptId]) state.openTabs[state.currentScriptId].unsaved = true;
                const tab = document.querySelector(`.tm-tab[data-script-id="${state.currentScriptId}"]`);
                if (tab) tab.classList.add('unsaved');
            }
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
                        const r = await chrome.runtime.sendMessage({ action: 'importFromZip', zipData: btoa(binary), options: { overwrite: true } });
                        showToast(r?.error ? r.error : `Imported ${r?.imported || 0} scripts from ${file.name}`, r?.error ? 'error' : 'success');
                    } else if (name.endsWith('.json')) {
                        const data = JSON.parse(await file.text());
                        const r = await chrome.runtime.sendMessage({ action: 'importAll', data: { data, options: { overwrite: true } } });
                        showToast(r?.error ? r.error : `Imported ${r?.imported || 0} scripts from ${file.name}`, r?.error ? 'error' : 'success');
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
            const response = await chrome.runtime.sendMessage({ action: 'exportAll' });
            if (response) {
                const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' });
                const a = document.createElement('a');
                const url = URL.createObjectURL(blob);
                a.href = url;
                a.download = `scriptvault-backup-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
                showToast('Exported', 'success');
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
        URL.revokeObjectURL(a.href);
        showToast(`Exported ${meta.name || 'script'}`, 'success');
    }

    async function exportToZip() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'exportZip' });
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
                URL.revokeObjectURL(objUrl);
                showToast('Exported ZIP', 'success');
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
        URL.revokeObjectURL(url);
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
        if (elements.statTotalScripts) elements.statTotalScripts.textContent = total;
        if (elements.statActiveScripts) elements.statActiveScripts.textContent = active;
        try {
            const bytes = await chrome.storage.local.getBytesInUse(null);
            if (elements.statTotalStorage) elements.statTotalStorage.textContent = formatBytes(bytes || 0);

            // Storage quota bar
            const quotaBar = document.getElementById('storageQuotaBar');
            const quotaText = document.getElementById('storageQuotaText');
            const QUOTA_BYTES = 10 * 1024 * 1024; // 10MB Chrome limit
            const pct = Math.min(100, (bytes / QUOTA_BYTES) * 100);
            if (quotaBar) {
                quotaBar.style.width = pct + '%';
                quotaBar.className = 'quota-bar-fill' + (pct > 90 ? ' danger' : pct > 70 ? ' warning' : '');
            }
            if (quotaText) {
                quotaText.textContent = `${formatBytes(bytes)} / ${formatBytes(QUOTA_BYTES)} (${pct.toFixed(1)}%)`;
            }
            // Show warning toast if over 85%
            if (pct > 85 && !state._quotaWarned) {
                state._quotaWarned = true;
                showToast(`Storage at ${pct.toFixed(0)}% capacity - consider cleaning up`, 'warning');
            }
        } catch (e) {
            if (elements.statTotalStorage) elements.statTotalStorage.textContent = '-';
        }
    }

    function formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    function formatTime(ts) {
        if (!ts) return '-';
        const date = new Date(ts);
        if (isNaN(date.getTime())) return '-';
        const diff = Date.now() - date.getTime();
        const m = Math.floor(diff / 60000);
        const h = Math.floor(m / 60);
        const d = Math.floor(h / 24);
        if (d > 30) return new Date(ts).toLocaleDateString();
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

    function openFindScripts() {
        elements.findScriptsOverlay?.classList.add('active');
        elements.findScriptsInput?.focus();
    }

    function closeFindScripts() {
        elements.findScriptsOverlay?.classList.remove('active');
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
        overlay: null, title: null, fill: null, status: null,
        init() {
            this.overlay = document.getElementById('progressOverlay');
            this.title = document.getElementById('progressTitle');
            this.fill = document.getElementById('progressFill');
            this.status = document.getElementById('progressStatus');
        }
    };

    function showProgress(title) {
        if (!progressEl.overlay) progressEl.init();
        if (!progressEl.overlay) return;
        if (progressEl.title) progressEl.title.textContent = title;
        if (progressEl.fill) progressEl.fill.style.width = '0%';
        if (progressEl.status) progressEl.status.textContent = '';
        progressEl.overlay.classList.add('active');
    }

    function updateProgress(current, total, label) {
        if (!progressEl.fill) return;
        const pct = Math.round((current / total) * 100);
        progressEl.fill.style.width = pct + '%';
        if (progressEl.status) progressEl.status.textContent = label || `${current} / ${total}`;
    }

    function hideProgress() {
        if (!progressEl.overlay) return;
        progressEl.fill.style.width = '100%';
        setTimeout(() => progressEl.overlay.classList.remove('active'), 300);
    }

    function showModal(title, html, actions = []) {
        if (!elements.modal) return;
        if (elements.modalTitle) elements.modalTitle.textContent = title;
        if (elements.modalBody) elements.modalBody.innerHTML = html;
        if (elements.modalActions) {
            elements.modalActions.innerHTML = '';
            actions.forEach(a => {
                const btn = document.createElement('button');
                btn.className = `btn ${a.class || ''}`;
                btn.textContent = a.label;
                btn.onclick = a.callback;
                elements.modalActions.appendChild(btn);
            });
        }
        elements.modal?.classList.add('show');
    }

    function hideModal() { elements.modal?.classList.remove('show'); }

    function showConfirmModal(title, msg) {
        return new Promise(resolve => {
            showModal(title, `<p>${escapeHtml(msg)}</p>`, [
                { label: 'Cancel', class: '', callback: () => { hideModal(); resolve(false); } },
                { label: 'Confirm', class: 'btn-primary', callback: () => { hideModal(); resolve(true); } }
            ]);
        });
    }

    // Event listeners
    function initEventListeners() {
        // Main tabs
        elements.mainTabs.forEach(tab => {
            tab.addEventListener('click', async () => {
                const id = tab.dataset.tab;
                // Skip script tabs — they have their own handler
                if (tab.classList.contains('script-tab')) return;
                closeFindScripts();
                if (id === 'newscript') {
                    createNewScript();
                    return;
                }
                // Save current editor state if switching away
                if (state.currentScriptId && state.editor && state.openTabs[state.currentScriptId]) {
                    state.openTabs[state.currentScriptId].code = state.editor.getValue();
                    state.openTabs[state.currentScriptId].unsaved = state.unsavedChanges;
                }
                state.currentScriptId = null;
                elements.editorOverlay?.classList.remove('active');
                document.querySelectorAll('.tm-tab').forEach(t => t.classList.remove('active'));
                Object.values(elements.mainPanels).forEach(p => p?.classList.remove('active'));
                tab.classList.add('active');
                elements.mainPanels[id]?.classList.add('active');
                if (tab.dataset.tab === 'trash') await loadTrash();
                elements.btnHelpTab?.classList.remove('active');
            });
        });

        // Help icon button in header
        elements.btnHelpTab?.addEventListener('click', () => {
            const isActive = elements.btnHelpTab.classList.contains('active');
            // Save current editor state if switching away
            if (state.currentScriptId && state.editor && state.openTabs[state.currentScriptId]) {
                state.openTabs[state.currentScriptId].code = state.editor.getValue();
                state.openTabs[state.currentScriptId].unsaved = state.unsavedChanges;
            }
            state.currentScriptId = null;
            elements.editorOverlay?.classList.remove('active');
            document.querySelectorAll('.tm-tab').forEach(t => t.classList.remove('active'));
            Object.values(elements.mainPanels).forEach(p => p?.classList.remove('active'));
            if (isActive) {
                elements.btnHelpTab.classList.remove('active');
                const scriptsTab = document.querySelector('.tm-tab[data-tab="scripts"]');
                if (scriptsTab) scriptsTab.classList.add('active');
                elements.mainPanels.scripts?.classList.add('active');
            } else {
                elements.btnHelpTab.classList.add('active');
                elements.mainPanels.help?.classList.add('active');
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
        elements.scriptSearch?.addEventListener('input', e => renderScriptTable(e.target.value));

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
        elements.findScriptsInput?.addEventListener('keydown', e => {
            if (e.key === 'Enter') searchScripts(1);
        });

        // Bulk Actions (Tampermonkey-style)
        elements.bulkSelectAll?.addEventListener('change', e => {
            state.selectedScripts.clear();
            if (e.target.checked) {
                const filtered = getFilteredScripts();
                filtered.forEach(s => state.selectedScripts.add(s.id));
            }
            updateBulkCheckboxes();
        });
        
        // Table header checkbox (syncs with bulk toolbar)
        elements.selectAllScripts?.addEventListener('change', e => {
            state.selectedScripts.clear();
            if (e.target.checked) {
                const filtered = getFilteredScripts();
                filtered.forEach(s => state.selectedScripts.add(s.id));
            }
            updateBulkCheckboxes();
        });
        
        elements.btnBulkApply?.addEventListener('click', executeBulkAction);

        // Sortable column headers
        document.querySelectorAll('.scripts-table th.sortable').forEach(th => {
            th.addEventListener('click', () => handleSortClick(th.dataset.sort));
        });

        elements.filterSelect?.addEventListener('change', () => {
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
            URL.revokeObjectURL(url);
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
        elements.btnEditorDelete?.addEventListener('click', () => { if (state.currentScriptId) deleteScript(state.currentScriptId); });
        // Close button removed - tabs handle closing

        elements.btnEmptyTrash?.addEventListener('click', async () => {
            if (!await showConfirmModal('Empty Trash', 'Permanently delete all trashed scripts?')) return;
            const r = await chrome.runtime.sendMessage({ action: 'emptyTrash' });
            showToast(r?.error ? r.error : 'Trash emptied', r?.error ? 'error' : 'success');
            await loadTrash();
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
            if (libSearchResults) libSearchResults.innerHTML = '<div style="padding:8px;color:var(--text-muted)">Searching...</div>';
            try {
                const resp = await fetch(`https://api.cdnjs.com/libraries?search=${encodeURIComponent(query)}&fields=description,version,filename&limit=10`);
                if (!resp.ok) throw new Error('Search failed');
                const data = await resp.json();
                if (!data.results || data.results.length === 0) {
                    if (libSearchResults) libSearchResults.innerHTML = '<div style="padding:8px;color:var(--text-muted)">No libraries found</div>';
                    return;
                }
                if (libSearchResults) libSearchResults.innerHTML = data.results.map(lib => {
                    const cdnUrl = `https://cdnjs.cloudflare.com/ajax/libs/${lib.name}/${lib.version}/${lib.filename}`;
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
                            state.unsavedChanges = true;
                            if (state.openTabs[state.currentScriptId]) {
                                state.openTabs[state.currentScriptId].unsaved = true;
                            }
                            const tab = document.querySelector(`.tm-tab[data-script-id="${state.currentScriptId}"]`);
                            if (tab) tab.classList.add('unsaved');
                            btn.textContent = 'Added';
                            btn.disabled = true;
                            showToast('Library added to @require', 'success');
                        } else {
                            showToast('Could not find metadata block', 'error');
                        }
                    });
                });
            } catch (e) {
                if (libSearchResults) libSearchResults.innerHTML = `<div style="padding:8px;color:var(--accent-red)">Search failed: ${escapeHtml(e.message)}</div>`;
            }
        }

        btnLibSearch?.addEventListener('click', searchLibraries);
        libSearchInput?.addEventListener('keydown', e => { if (e.key === 'Enter') searchLibraries(); });

        // Editor toolbar buttons
        elements.tbtnUndo?.addEventListener('click', () => state.editor?.undo());
        elements.tbtnRedo?.addEventListener('click', () => state.editor?.redo());
        elements.tbtnSearch?.addEventListener('click', () => state.editor?.execCommand('findPersistent'));
        elements.tbtnReplace?.addEventListener('click', () => state.editor?.execCommand('replace'));
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
        elements.tbtnJumpLine?.addEventListener('click', () => state.editor?.execCommand('jumpToLine'));

        // Comment toggle (Ctrl+/)
        document.getElementById('tbtnComment')?.addEventListener('click', () => {
            if (!state.editor) return;
            if (state.editor.isMonaco) {
                state.editor.toggleComment();
                state.unsavedChanges = true;
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
            state.unsavedChanges = true;
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
                        state.unsavedChanges = true;
                        if (state.openTabs[state.currentScriptId]) state.openTabs[state.currentScriptId].unsaved = true;
                        const tab = document.querySelector(`.tm-tab[data-script-id="${state.currentScriptId}"]`);
                        if (tab) tab.classList.add('unsaved');
                    }
                    hideModal();
                });
            });
        });

        // Editor tabs
        elements.editorTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const id = tab.dataset.panel;
                elements.editorTabs.forEach(t => t.classList.remove('active'));
                Object.values(elements.editorPanels).forEach(p => p?.classList.remove('active'));
                tab.classList.add('active');
                elements.editorPanels[id]?.classList.add('active');
                if (id === 'code') setTimeout(() => state.editor?.refresh(), 10);
                if (id === 'scriptsettings') {
                    const script = state.scripts.find(s => s.id === state.currentScriptId);
                    loadScriptSettings(script);
                }
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
            settingsEnableSync: ['enableSync', 'checked'],
            
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
            saveSetting('syncType', e.target.value);
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
            showToast('Sync settings saved', 'success');
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
                if (r?.success) { await loadScripts(); updateStats(); }
                showToast(r?.success ? 'Done' : (r?.error || 'Failed'), r?.success ? 'success' : 'error');
            } catch (e) { showToast('Failed', 'error'); }
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

        // Permissions (placeholder - full permission management not yet implemented)
        elements.btnGrantSelected?.addEventListener('click', () => showToast('Permission management coming soon', 'info'));
        elements.btnGrantAll?.addEventListener('click', () => showToast('Permission management coming soon', 'info'));
        elements.btnResetPermissions?.addEventListener('click', () => {
            if (elements.settingsDeniedHosts) elements.settingsDeniedHosts.value = '';
            showToast('Permissions list cleared', 'info');
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
        elements.btnExportFile?.addEventListener('click', exportAllScripts);
        elements.btnExportZip?.addEventListener('click', exportToZip);
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

        // Workspaces
        document.getElementById('btnCreateWorkspace')?.addEventListener('click', async () => {
            const name = prompt('Workspace name:');
            if (!name?.trim()) return;
            const res = await chrome.runtime.sendMessage({ action: 'createWorkspace', name: name.trim() });
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
            if (!res?.log?.length) { showToast('No requests to export', 'info'); return; }
            const har = {
                log: {
                    version: '1.2',
                    creator: { name: 'ScriptVault', version: chrome.runtime.getManifest().version },
                    entries: res.log.map(e => ({
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
            URL.revokeObjectURL(a.href);
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
            const provider = elements.cloudProvider?.value || 'googledrive';
            const st = elements.cloudStatusText;
            const ui = elements.cloudUserInfo;
            const bc = elements.btnCloudConnect;
            const bd = elements.btnCloudDisconnect;
            const ar = elements.cloudActionsRow;
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
        }

        elements.cloudProvider?.addEventListener('change', updateCloudUI);
        updateCloudUI();

        elements.btnCloudConnect?.addEventListener('click', async () => {
            const provider = elements.cloudProvider?.value || 'googledrive';
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
            const provider = elements.cloudProvider?.value || 'googledrive';
            try {
                await chrome.runtime.sendMessage({ action: 'disconnectSyncProvider', provider });
                showToast('Disconnected', 'success');
                await updateCloudUI();
            } catch (e) { showToast('Failed: ' + e.message, 'error'); }
        });

        elements.btnCloudExport?.addEventListener('click', async () => {
            const provider = elements.cloudProvider?.value || 'googledrive';
            showToast('Exporting to ' + provider + '...', 'info');
            try {
                const r = await chrome.runtime.sendMessage({ action: 'cloudExport', provider });
                showToast(r?.success ? 'Exported to cloud' : (r?.error || 'Export failed'), r?.success ? 'success' : 'error');
            } catch (e) { showToast('Export failed: ' + e.message, 'error'); }
        });

        elements.btnCloudImport?.addEventListener('click', async () => {
            const provider = elements.cloudProvider?.value || 'googledrive';
            showToast('Importing from ' + provider + '...', 'info');
            try {
                const r = await chrome.runtime.sendMessage({ action: 'cloudImport', provider });
                if (r?.success) {
                    await loadScripts();
                    await loadSettings();
                    updateStats();
                    showToast('Imported ' + (r.imported || 0) + ' scripts from cloud', 'success');
                } else {
                    showToast(r?.error || 'Import failed', 'error');
                }
            } catch (e) { showToast('Import failed: ' + e.message, 'error'); }
        });
        elements.importFileInput?.addEventListener('change', async e => {
            const file = e.target.files[0];
            if (!file) return;
            if (elements.importFileName) elements.importFileName.textContent = file.name;
            const isZip = file.name.endsWith('.zip');
            if (!await showConfirmModal('Import', `Import from ${file.name}?`)) return;
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
                    showToast(r?.error ? r.error : `Imported ${r?.imported || 0}`, r?.error ? 'error' : 'success');
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
                    await chrome.runtime.sendMessage({ action: 'importAll', data: { data, options: { overwrite: true } } });
                    showToast('Imported', 'success');
                }
                await loadScripts();
                await loadSettings();
                updateStats();
            } catch (err) { showToast('Failed: ' + err.message, 'error'); }
            hideProgress();
            e.target.value = '';
        });

        elements.btnInstallFromUrl?.addEventListener('click', installFromUrl);

        // Batch URL install
        document.getElementById('btnBatchInstall')?.addEventListener('click', async () => {
            const textarea = document.getElementById('batchUrlInput');
            const urls = (textarea?.value || '').split('\n').map(u => u.trim()).filter(u => u && u.startsWith('http'));
            if (urls.length === 0) return showToast('No valid URLs found', 'error');
            if (!await showConfirmModal('Batch Install', `Install ${urls.length} script${urls.length > 1 ? 's' : ''} from URLs?`)) return;
            showProgress(`Installing ${urls.length} scripts...`);
            let installed = 0, failed = 0;
            for (let i = 0; i < urls.length; i++) {
                updateProgress(i + 1, urls.length, urls[i].split('/').pop() || urls[i]);
                try {
                    const res = await chrome.runtime.sendMessage({ action: 'installFromUrl', url: urls[i] });
                    if (res?.success) installed++;
                    else failed++;
                } catch (e) { failed++; }
            }
            hideProgress();
            await loadScripts();
            updateStats();
            if (textarea) textarea.value = '';
            showToast(`Installed ${installed}${failed > 0 ? `, ${failed} failed` : ''}`, installed > 0 ? 'success' : 'error');
        });

        elements.btnTextareaExport?.addEventListener('click', async () => {
            const r = await chrome.runtime.sendMessage({ action: 'exportAll' });
            if (r && elements.textareaData) {
                elements.textareaData.value = JSON.stringify(r, null, 2);
                showToast('Exported', 'success');
            }
        });

        elements.btnTextareaImport?.addEventListener('click', async () => {
            const txt = elements.textareaData?.value?.trim();
            if (!txt) return showToast('Empty', 'error');
            try {
                const data = JSON.parse(txt);
                if (!await showConfirmModal('Import', `Import ${data.scripts?.length || 0} scripts?`)) return;
                showProgress(`Importing ${data.scripts?.length || 0} scripts...`);
                updateProgress(0, 1, 'Processing...');
                await chrome.runtime.sendMessage({ action: 'importAll', data: { data, options: { overwrite: true } } });
                await loadScripts();
                updateStats();
                hideProgress();
                showToast('Imported', 'success');
            } catch (e) { hideProgress(); showToast('Invalid JSON', 'error'); }
        });

        // Modal
        elements.modalClose?.addEventListener('click', hideModal);
        elements.modal?.addEventListener('click', e => { if (e.target === elements.modal) hideModal(); });

        // Pattern tester
        document.getElementById('btnTestPattern')?.addEventListener('click', testPatterns);
        document.getElementById('patternTestUrl')?.addEventListener('keydown', e => { if (e.key === 'Enter') testPatterns(); });

        // Keyboard shortcuts
        document.addEventListener('keydown', e => {
            const ctrl = e.ctrlKey || e.metaKey;
            const editorActive = elements.editorOverlay?.classList.contains('active');

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
            // Ctrl+I — import script
            if (ctrl && e.key === 'i' && !editorActive) {
                e.preventDefault();
                importScript();
                return;
            }
            // Alt+1-5 — switch dashboard tabs
            if (e.altKey && !ctrl && e.key >= '1' && e.key <= '5') {
                e.preventDefault();
                const tabNames = ['scripts', 'settings', 'utilities', 'trash', 'help'];
                const idx = parseInt(e.key) - 1;
                if (tabNames[idx]) {
                    // Close editor if open
                    if (editorActive) {
                        if (state.currentScriptId && state.editor && state.openTabs[state.currentScriptId]) {
                            state.openTabs[state.currentScriptId].code = state.editor.getValue();
                            state.openTabs[state.currentScriptId].unsaved = state.unsavedChanges;
                        }
                        state.currentScriptId = null;
                        elements.editorOverlay?.classList.remove('active');
                    }
                    document.querySelectorAll('.tm-tab').forEach(t => t.classList.remove('active'));
                    Object.values(elements.mainPanels).forEach(p => p?.classList.remove('active'));
                    const tab = document.querySelector(`.tm-tab[data-tab="${tabNames[idx]}"]`);
                    tab?.classList.add('active');
                    elements.mainPanels[tabNames[idx]]?.classList.add('active');
                    if (tabNames[idx] === 'trash') loadTrash();
                }
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
    // Workspaces
    // =========================================
    async function loadWorkspaces() {
        const container = document.getElementById('workspaceList');
        if (!container) return;
        try {
            const res = await chrome.runtime.sendMessage({ action: 'getWorkspaces' });
            const { active, list } = res || {};
            if (!list || list.length === 0) {
                container.innerHTML = '<div style="color:var(--text-muted);font-size:12px;padding:4px 0">No workspaces saved</div>';
                return;
            }
            container.innerHTML = list.map(ws => `
                <div class="workspace-item${ws.id === active ? ' active' : ''}" data-ws-id="${ws.id}">
                    <span class="workspace-name">${escapeHtml(ws.name)}</span>
                    <span class="workspace-scripts">${Object.keys(ws.snapshot || {}).length} scripts</span>
                    <div class="workspace-actions">
                        <button class="toolbar-btn${ws.id === active ? ' primary' : ''}" data-ws-activate="${ws.id}">${ws.id === active ? 'Active' : 'Switch'}</button>
                        <button class="toolbar-btn" data-ws-save="${ws.id}" title="Update with current state">Save</button>
                        <button class="toolbar-btn" data-ws-delete="${ws.id}" title="Delete">x</button>
                    </div>
                </div>
            `).join('');

            container.querySelectorAll('[data-ws-activate]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.dataset.wsActivate;
                    showToast('Switching workspace...', 'info');
                    const res = await chrome.runtime.sendMessage({ action: 'activateWorkspace', id });
                    if (res?.success) {
                        await loadScripts();
                        await loadWorkspaces();
                        showToast(`Workspace "${res.name}" activated`, 'success');
                    } else {
                        showToast(res?.error || 'Failed', 'error');
                    }
                });
            });
            container.querySelectorAll('[data-ws-save]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    await chrome.runtime.sendMessage({ action: 'saveWorkspace', id: btn.dataset.wsSave });
                    showToast('Workspace updated', 'success');
                    loadWorkspaces();
                });
            });
            container.querySelectorAll('[data-ws-delete]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    await chrome.runtime.sendMessage({ action: 'deleteWorkspace', id: btn.dataset.wsDelete });
                    showToast('Workspace deleted', 'success');
                    loadWorkspaces();
                });
            });
        } catch (e) {
            container.innerHTML = '<div style="color:var(--text-muted);font-size:12px">Failed to load workspaces</div>';
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
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'commandPalette';
            overlay.innerHTML = `
                <div class="cmd-backdrop"></div>
                <div class="cmd-dialog">
                    <input type="text" class="cmd-input" placeholder="Type a command, script name, or action..." autofocus>
                    <div class="cmd-results"></div>
                </div>
            `;
            document.body.appendChild(overlay);

            const backdrop = overlay.querySelector('.cmd-backdrop');
            backdrop.addEventListener('click', closeCommandPalette);

            const input = overlay.querySelector('.cmd-input');
            input.addEventListener('input', () => renderCommandResults(input.value));
            input.addEventListener('keydown', (e) => {
                const items = overlay.querySelectorAll('.cmd-item');
                const active = overlay.querySelector('.cmd-item.active');
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    if (!active && items.length) { items[0].classList.add('active'); items[0].scrollIntoView({ block: 'nearest' }); }
                    else if (active?.nextElementSibling) { active.classList.remove('active'); active.nextElementSibling.classList.add('active'); active.nextElementSibling.scrollIntoView({ block: 'nearest' }); }
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (active?.previousElementSibling) { active.classList.remove('active'); active.previousElementSibling.classList.add('active'); active.previousElementSibling.scrollIntoView({ block: 'nearest' }); }
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    const target = active || items[0];
                    if (target) target.click();
                } else if (e.key === 'Escape') {
                    closeCommandPalette();
                }
            });
        }

        overlay.classList.add('open');
        const input = overlay.querySelector('.cmd-input');
        if (input) { input.value = ''; input.focus(); }
        renderCommandResults('');
    }

    function closeCommandPalette() {
        document.getElementById('commandPalette')?.classList.remove('open');
    }

    function renderCommandResults(query) {
        const results = document.querySelector('#commandPalette .cmd-results');
        if (!results) return;

        const q = query.toLowerCase().trim();

        // Build command list
        const commands = [
            // Actions
            { category: 'Actions', label: 'New Script', desc: 'Create a new script from template', action: () => { closeCommandPalette(); createNewScript(); } },
            { category: 'Actions', label: 'Import Script', desc: 'Import from file', action: () => { closeCommandPalette(); importScript(); } },
            { category: 'Actions', label: 'Check for Updates', desc: 'Check all scripts for updates', action: () => { closeCommandPalette(); document.getElementById('btnCheckUpdates')?.click(); } },
            { category: 'Actions', label: 'Export All (ZIP)', desc: 'Export all scripts as ZIP', action: () => { closeCommandPalette(); exportToZip(); } },
            { category: 'Actions', label: 'Export All (JSON)', desc: 'Export all scripts as JSON', action: () => { closeCommandPalette(); exportAllScripts(); } },
            { category: 'Actions', label: 'Export Stats CSV', desc: 'Export execution statistics', action: () => { closeCommandPalette(); exportStatsCSV(); } },
            { category: 'Actions', label: 'Find Scripts', desc: 'Search GreasyFork/OpenUserJS', action: () => { closeCommandPalette(); openFindScripts(); } },
            // Navigation
            { category: 'Navigation', label: 'Scripts Tab', desc: 'Go to installed scripts', action: () => { closeCommandPalette(); switchTab('scripts'); } },
            { category: 'Navigation', label: 'Settings Tab', desc: 'Open settings', action: () => { closeCommandPalette(); switchTab('settings'); } },
            { category: 'Navigation', label: 'Utilities Tab', desc: 'Import/export tools', action: () => { closeCommandPalette(); switchTab('utilities'); } },
            { category: 'Navigation', label: 'Trash Tab', desc: 'View deleted scripts', action: () => { closeCommandPalette(); switchTab('trash'); } },
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
            results.innerHTML = '<div class="cmd-empty">No matching commands</div>';
            return;
        }

        let html = '';
        for (const [cat, items] of Object.entries(groups)) {
            html += `<div class="cmd-group">${escapeHtml(cat)}</div>`;
            html += items.map((c, i) => `<div class="cmd-item${i === 0 && !q ? '' : ''}" data-cmd-idx="${commands.indexOf(c)}"><span class="cmd-label">${escapeHtml(c.label)}</span><span class="cmd-desc">${escapeHtml(c.desc)}</span></div>`).join('');
        }

        results.innerHTML = html;

        // Bind clicks
        results.querySelectorAll('.cmd-item').forEach(item => {
            item.addEventListener('click', () => {
                const idx = parseInt(item.dataset.cmdIdx);
                commands[idx]?.action();
            });
            item.addEventListener('mouseenter', () => {
                results.querySelectorAll('.cmd-item.active').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
            });
        });
    }

    function switchTab(name) {
        const editorActive = elements.editorOverlay?.classList.contains('active');
        if (editorActive) {
            if (state.currentScriptId && state.editor && state.openTabs[state.currentScriptId]) {
                state.openTabs[state.currentScriptId].code = state.editor.getValue();
                state.openTabs[state.currentScriptId].unsaved = state.unsavedChanges;
            }
            state.currentScriptId = null;
            elements.editorOverlay?.classList.remove('active');
        }
        document.querySelectorAll('.tm-tab').forEach(t => t.classList.remove('active'));
        Object.values(elements.mainPanels).forEach(p => p?.classList.remove('active'));
        elements.btnHelpTab?.classList.remove('active');

        if (name === 'help') {
            // Help tab is a separate header icon, not a .tm-tab
            elements.btnHelpTab?.classList.add('active');
            elements.mainPanels.help?.classList.add('active');
        } else {
            const tab = document.querySelector(`.tm-tab[data-tab="${name}"]`);
            tab?.classList.add('active');
            elements.mainPanels[name]?.classList.add('active');
        }
        if (name === 'trash') loadTrash();
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
