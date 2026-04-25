// Dashboard view-settings controller (zoom + density).
// Extracted from inline <script> in dashboard.html so the extension_pages CSP
// (script-src 'self') doesn't block execution.
(function() {
    'use strict';
    const STORAGE_KEY = 'sv_viewSettings';
    const scaleSelect = document.getElementById('uiScaleSelect');
    const densityBtns = document.querySelectorAll('.density-btn');

    function readViewSettings() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (_) {
            return {};
        }
    }

    function writeViewSettings(settings) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }

    function sanitizeScale(scale) {
        const value = String(scale || '1');
        return ['0.85', '0.9', '1', '1.1', '1.25', '1.5'].includes(value) ? value : '1';
    }

    function sanitizeDensity(density) {
        const value = String(density || 'comfortable');
        return ['compact', 'comfortable', 'spacious'].includes(value) ? value : 'comfortable';
    }

    function applyViewSettings(settings) {
        const applied = {
            scale: sanitizeScale(settings.scale),
            density: sanitizeDensity(settings.density)
        };

        document.documentElement.setAttribute('data-ui-scale', applied.scale);
        document.documentElement.setAttribute('data-density', applied.density);
        if (document.body) {
            document.body.setAttribute('data-ui-scale', applied.scale);
            document.body.setAttribute('data-density', applied.density);
        }

        if (scaleSelect) scaleSelect.value = applied.scale;
        densityBtns.forEach(btn => {
            const isActive = btn.dataset.density === applied.density;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-pressed', String(isActive));
        });

        return applied;
    }

    const initialSettings = applyViewSettings(readViewSettings());

    if (scaleSelect) {
        scaleSelect.addEventListener('change', () => {
            const nextSettings = applyViewSettings({
                ...readViewSettings(),
                scale: scaleSelect.value
            });
            writeViewSettings(nextSettings);
        });
    }

    densityBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const nextSettings = applyViewSettings({
                ...readViewSettings(),
                scale: scaleSelect ? scaleSelect.value : initialSettings.scale,
                density: btn.dataset.density
            });
            writeViewSettings(nextSettings);
        });
    });
})();
