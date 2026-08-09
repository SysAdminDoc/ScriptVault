(() => {
    'use strict';

    const title = document.getElementById('onboardingTitle');
    const message = document.getElementById('onboardingMessage');
    const statusNode = document.getElementById('onboardingStatus');
    const details = document.getElementById('onboardingDetails');
    const action = document.getElementById('onboardingAction');
    const refresh = document.getElementById('onboardingRefresh');
    const hint = document.getElementById('onboardingHint');
    const i18n = typeof I18n !== 'undefined' ? I18n : null;
    const extensionId = chrome.runtime?.id || '';
    const browserName = /Firefox\//.test(navigator.userAgent) ? 'firefox' : 'chromium';
    const context = { browserName, extensionId, surface: 'onboarding' };
    let currentView = null;
    let refreshing = false;

    function t(key, fallback) {
        try {
            const value = i18n?.getMessage?.(key);
            return value && value !== key ? value : fallback;
        } catch (_) {
            return fallback;
        }
    }

    function fallbackView(status = {}) {
        const ready = status.userScriptsAvailable === true;
        return {
            ready,
            setupState: ready ? 'available' : (status.setupState || 'unknown'),
            title: ready ? t('onboardingReadyTitle', 'ScriptVault is ready') : (status.setupTitle || t('onboardingTitle', 'Finish ScriptVault setup')),
            message: ready ? t('onboardingReadyMessage', 'User scripts are enabled for this browser profile.') : (status.setupMessage || t('onboardingSetupRequired', 'ScriptVault needs one browser setting before scripts can run.')),
            actionLabel: status.setupAction || t('onboardingOpenDetails', 'Open Extension Details'),
            actionKind: ready ? 'refresh' : 'open-extension-details',
            setupUrl: status.setupUrl || `chrome://extensions/?id=${extensionId}`,
            detailLines: []
        };
    }

    function buildView(status = {}) {
        const doctor = globalThis.UserScriptsSetupDoctor?.buildSetupDoctorView;
        return typeof doctor === 'function' ? doctor(status, context) : fallbackView(status);
    }

    function setDetails(lines) {
        if (!details) return;
        details.replaceChildren(...(Array.isArray(lines) ? lines : []).map(line => {
            const node = document.createElement('p');
            node.textContent = line;
            return node;
        }));
    }

    function render(status = {}) {
        const view = buildView(status);
        const ready = view.ready === true || status.userScriptsAvailable === true;
        currentView = view;
        if (title) title.textContent = ready ? t('onboardingReadyTitle', 'ScriptVault is ready') : (view.title || t('onboardingTitle', 'Finish ScriptVault setup'));
        if (message) message.textContent = ready ? t('onboardingReadyMessage', 'User scripts are enabled for this browser profile.') : (view.message || t('onboardingSetupRequired', 'ScriptVault needs one browser setting before scripts can run.'));
        if (statusNode) {
            statusNode.dataset.ready = String(ready);
            statusNode.textContent = ready
                ? t('onboardingReadyStatus', 'Ready — user scripts can run.')
                : `${t('onboardingStatusPrefix', 'Setup required')}: ${view.message || t('onboardingSetupRequired', 'ScriptVault needs one browser setting before scripts can run.')}`;
        }
        setDetails(ready ? [t('onboardingReadyDetail', 'The live runtime probe passed. You can close this tab or open the dashboard.')] : view.detailLines);
        if (action) {
            action.hidden = false;
            action.textContent = ready ? t('onboardingContinue', 'Open Dashboard') : (view.actionLabel || t('onboardingOpenDetails', 'Open Extension Details'));
        }
        if (refresh) refresh.disabled = false;
        if (hint) hint.textContent = ready
            ? t('onboardingReadyHint', 'Setup is complete. Your scripts will use the normal review and registration flow.')
            : t('onboardingSetupHint', 'Enable the requested browser setting, then return here. This page refreshes automatically.');
    }

    async function refreshStatus() {
        if (refreshing) return;
        refreshing = true;
        if (refresh) refresh.disabled = true;
        try {
            const status = await chrome.runtime.sendMessage({ action: 'getExtensionStatus' });
            render(status || {});
        } catch (error) {
            if (statusNode) {
                statusNode.dataset.ready = 'false';
                statusNode.textContent = error?.message || t('onboardingStatusError', 'Runtime status could not be read.');
            }
        } finally {
            refreshing = false;
            if (refresh) refresh.disabled = false;
        }
    }

    async function handleAction() {
        if (currentView?.ready === true) {
            chrome.tabs.create({ url: chrome.runtime.getURL('pages/dashboard.html') });
            return;
        }
        if (currentView?.actionKind === 'request-firefox-user-scripts') {
            try {
                const granted = await chrome.permissions?.request?.({ permissions: ['userScripts'] });
                if (granted) await chrome.runtime.sendMessage({ action: 'repairRuntimeState' });
                await refreshStatus();
            } catch (error) {
                if (statusNode) statusNode.textContent = error?.message || t('onboardingStatusError', 'Runtime status could not be read.');
            }
            return;
        }
        if (currentView?.setupUrl) chrome.tabs.create({ url: currentView.setupUrl });
    }

    try { i18n?.init?.(navigator.language || 'en'); } catch (_) {}
    try { i18n?.applyToDOM?.(document); } catch (_) {}
    action?.addEventListener('click', handleAction);
    refresh?.addEventListener('click', refreshStatus);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) refreshStatus();
    });
    refreshStatus();
    setInterval(() => {
        if (!document.hidden) refreshStatus();
    }, 3000);
})();
