// ScriptVault Dashboard v1.5.2 - Full-Featured Controller
(function() {
    'use strict';

    // State
    const state = {
        scripts: [],
        settings: {},
        currentScriptId: null,
        editor: null,
        unsavedChanges: false,
        selectedScripts: new Set(),
        sortColumn: 'updated',
        sortDirection: 'desc',
        openTabs: {}  // { scriptId: { code, unsaved } }
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
        await loadScripts();
        initEditor();
        initEventListeners();
        updateSortIndicators();
        applyTheme();
        updateStats();
        toggleSyncProviderSettings();
        loadSyncProviderStatus();
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
                    case 'editorFontSize': { const cm = document.querySelector('.CodeMirror'); if (cm) cm.style.fontSize = value + '%'; } break;
                    case 'wordWrap': state.editor.setOption('lineWrapping', value); break;
                    case 'tabSize': state.editor.setOption('tabSize', parseInt(value) || 4); break;
                    case 'indentWidth': state.editor.setOption('indentUnit', parseInt(value) || 4); break;
                    case 'indentWith': state.editor.setOption('indentWithTabs', value !== 'spaces'); break;
                    case 'lintOnType': state.editor.setOption('lint', value ? { getAnnotations: window.lintUserscript, delay: 300, tooltips: true, highlightLines: true } : false); break;
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
        if (elements.scriptRunAt) elements.scriptRunAt.value = settings.runAt || 'default';
        if (elements.scriptInjectInto) elements.scriptInjectInto.value = settings.injectInto || 'auto';
        if (elements.scriptNotifyErrors) elements.scriptNotifyErrors.checked = settings.notifyErrors || false;
        
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
            runAt: elements.scriptRunAt?.value || 'default',
            injectInto: elements.scriptInjectInto?.value || 'auto',
            notifyErrors: elements.scriptNotifyErrors?.checked || false,
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
    async function loadScripts() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getScripts' });
            if (response?.scripts) {
                state.scripts = response.scripts;
                renderScriptTable();
            }
        } catch (e) {
            console.error('Failed to load scripts:', e);
        }
    }
    
    // Get filtered and sorted scripts
    function getFilteredScripts() {
        const searchFilter = (elements.scriptSearch?.value || '').toLowerCase();
        const statusFilter = elements.filterSelect?.value || 'all';

        const filtered = state.scripts.filter(s => {
            // Search filter
            const name = s.metadata?.name || '';
            const desc = s.metadata?.description || '';
            const matchesSearch = name.toLowerCase().includes(searchFilter) || desc.toLowerCase().includes(searchFilter);

            // Status filter
            let matchesStatus = true;
            if (statusFilter === 'enabled') {
                matchesStatus = s.enabled !== false;
            } else if (statusFilter === 'disabled') {
                matchesStatus = s.enabled === false;
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

        return filtered;
    }

    // Handle column sort click
    function handleSortClick(column) {
        if (state.sortColumn === column) {
            state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            state.sortColumn = column;
            state.sortDirection = 'asc';
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
                    await chrome.runtime.sendMessage({ action: 'toggleScript', scriptId: ids[i], enabled: true });
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
                    await chrome.runtime.sendMessage({ action: 'toggleScript', scriptId: ids[i], enabled: false });
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

        filtered.forEach((script, i) => {
            const tr = createScriptRow(script, i + 1);
            elements.scriptTableBody.appendChild(tr);
        });
        
        updateBulkCheckboxes();
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
                    <span class="script-name" data-id="${script.id}">${escapeHtml(name)}${isBroadMatch(matches) ? ' <span title="Runs on all/most sites" style="opacity:0.5">🌐</span>' : ''}</span>
                    ${tagHtml ? `<div class="script-tags">${tagHtml}</div>` : ''}
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
                    <button class="action-icon" title="Edit" data-action="edit" data-id="${script.id}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="action-icon" title="Check for update" data-action="updateScript" data-id="${script.id}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
                    </button>
                    <button class="action-icon" title="Export" data-action="exportScript" data-id="${script.id}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
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
        tr.querySelector('.script-checkbox')?.addEventListener('change', e => {
            if (e.target.checked) {
                state.selectedScripts.add(script.id);
            } else {
                state.selectedScripts.delete(script.id);
            }
            updateBulkCheckboxes();
        });
        tr.querySelector('.script-name')?.addEventListener('click', () => openEditorForScript(script.id));
        tr.querySelector('[data-action="edit"]')?.addEventListener('click', () => openEditorForScript(script.id));
        tr.querySelector('[data-action="delete"]')?.addEventListener('click', () => deleteScript(script.id));
        tr.querySelector('[data-action="exportScript"]')?.addEventListener('click', () => exportSingleScript(script));
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
                });
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

        const grants = m.grant || [];
        if (elements.infoGrants) elements.infoGrants.innerHTML = grants.length ? grants.map(g => `<span class="info-tag grant">${escapeHtml(g)}</span>`).join('') : '<span class="info-tag">none</span>';

        const matches = [...(m.match || []), ...(m.include || [])];
        elements.infoMatches.innerHTML = matches.length ? matches.map(x => `<span class="info-tag">${escapeHtml(x)}</span>`).join('') : '-';

        const res = [...(Array.isArray(m.resource) ? m.resource : []), ...(Array.isArray(m.require) ? m.require : [])];
        elements.infoResources.innerHTML = res.length ? res.map(r => `<div style="font-size:11px;margin-bottom:3px">${escapeHtml(typeof r === 'string' ? r : r.url || r.name)}</div>`).join('') : '-';
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

        item.innerHTML = `
            <span class="storage-key">${escapeHtml(key)}</span>
            <input type="text" class="input-field" value="${escapeHtml(valStr)}" style="flex:1">
            <div class="btn-group">
                <button class="btn" title="Save">💾</button>
                <button class="btn btn-danger" title="Delete">🗑️</button>
            </div>
        `;

        item.querySelector('.btn:first-of-type').addEventListener('click', async () => {
            let newVal = item.querySelector('.input-field').value;
            try { newVal = JSON.parse(newVal); } catch (e) {}
            await chrome.runtime.sendMessage({ action: 'setScriptValue', scriptId, key, value: newVal });
            showToast('Saved', 'success');
        });

        item.querySelector('.btn-danger').addEventListener('click', async () => {
            if (await showConfirmModal('Delete', `Delete "${key}"?`)) {
                await chrome.runtime.sendMessage({ action: 'deleteScriptValue', scriptId, key });
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
            await chrome.runtime.sendMessage({ action: 'saveScript', scriptId: state.currentScriptId, code });
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
    async function createNewScript() {
        if (_creatingScript) return;
        _creatingScript = true;

        // Clear hash to prevent duplicate creation on refresh
        history.replaceState(null, '', window.location.pathname);

        const code = `// ==UserScript==
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
})();`;

        try {
            const response = await chrome.runtime.sendMessage({ action: 'createScript', code });
            if (response?.success) {
                await loadScripts();
                updateStats();
                openEditorForScript(response.scriptId);
                showToast('Created', 'success');
            }
        } catch (e) {
            showToast('Failed', 'error');
        } finally {
            _creatingScript = false;
        }
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
            hintOptions: {
                hint: CodeMirror.hint.userscript,
                completeSingle: false
            },
            extraKeys: {
                'Ctrl-S': saveCurrentScript,
                'Cmd-S': saveCurrentScript,
                'Ctrl-F': 'findPersistent',
                'Ctrl-H': 'replace',
                'Esc': closeEditor,
                'Tab': cm => cm.somethingSelected() ? cm.indentSelection('add') : cm.replaceSelection(indentStr, 'end'),
                'Ctrl-Space': 'autocomplete'
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
                searchExternal(`https://openuserjs.org/?q=${encodeURIComponent(query)}`);
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

    function renderFindResults(scripts, page, domain) {
        const html = scripts.map(s => {
            const installs = s.total_installs >= 1000 ? Math.round(s.total_installs / 1000) + 'k' : (s.total_installs || 0);
            const daily = s.daily_installs || 0;
            const rating = s.fan_score ? parseFloat(s.fan_score).toFixed(0) + '%' : '--';
            const updated = s.code_updated_at ? formatTime(s.code_updated_at) : '--';
            const author = s.users && s.users[0] ? s.users[0].name : 'Unknown';
            return `<div class="find-script-card">
                <div class="find-script-info">
                    <div class="find-script-name">
                        <a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(s.name)}</a>
                        ${s.version ? `<span class="find-script-version">v${escapeHtml(s.version)}</span>` : ''}
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
                    <button class="toolbar-btn primary" data-install-url="${escapeHtml(s.code_url || '')}">Install</button>
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
        elements.btnNewScript?.addEventListener('click', createNewScript);
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

        // Editor toolbar buttons
        elements.tbtnUndo?.addEventListener('click', () => state.editor?.undo());
        elements.tbtnRedo?.addEventListener('click', () => state.editor?.redo());
        elements.tbtnSearch?.addEventListener('click', () => state.editor?.execCommand('findPersistent'));
        elements.tbtnReplace?.addEventListener('click', () => state.editor?.execCommand('replace'));
        elements.tbtnBeautify?.addEventListener('click', beautifyCode);
        elements.tbtnLint?.addEventListener('click', () => {
            if (state.editor) {
                state.editor.performLint();
                showToast('Lint check complete', 'info');
            }
        });
        elements.tbtnFoldAll?.addEventListener('click', () => {
            if (state.editor) {
                for (let i = 0; i < state.editor.lineCount(); i++) state.editor.foldCode(i);
            }
        });
        elements.tbtnUnfoldAll?.addEventListener('click', () => {
            if (state.editor) {
                for (let i = 0; i < state.editor.lineCount(); i++) {
                    try { state.editor.foldCode(i, null, 'unfold'); } catch(e) {}
                }
            }
        });
        elements.tbtnJumpLine?.addEventListener('click', () => state.editor?.execCommand('jumpToLine'));

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

        // Keyboard
        document.addEventListener('keydown', e => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's' && elements.editorOverlay?.classList.contains('active')) {
                e.preventDefault();
                saveCurrentScript();
            }
            if (e.key === 'Escape' && !e.defaultPrevented && elements.editorOverlay?.classList.contains('active')) closeEditor();
        });

        window.addEventListener('beforeunload', e => {
            const anyUnsaved = state.unsavedChanges || Object.values(state.openTabs).some(t => t.unsaved);
            if (anyUnsaved) { e.preventDefault(); e.returnValue = ''; }
        });
    }

    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
