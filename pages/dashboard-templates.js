/**
 * ScriptVault Custom Script Templates Module
 * Save, manage, and create scripts from templates with variable substitution.
 * Supports custom templates, categories, sharing, and command palette integration.
 */
const TemplateManager = (() => {
    'use strict';

    // =========================================
    // State
    // =========================================
    const _state = {
        container: null,
        styleEl: null,
        modalEl: null,
        templates: [],
        filter: '',
        category: 'all',
        getScript: null,
        onCreateScript: null,
        getCurrentTabUrl: null
    };

    const STORAGE_KEY = 'customTemplates';

    const CATEGORIES = [
        { id: 'all', label: 'All', icon: '&#9776;' },
        { id: 'my', label: 'My Templates', icon: '&#9733;' },
        { id: 'community', label: 'Community', icon: '&#127760;' },
        { id: 'blank', label: 'Blank', icon: '&#128196;' },
        { id: 'modifier', label: 'Modifier', icon: '&#9998;' },
        { id: 'utility', label: 'Utility', icon: '&#128295;' },
        { id: 'privacy', label: 'Privacy', icon: '&#128274;' },
        { id: 'social', label: 'Social', icon: '&#128172;' }
    ];

    const TEMPLATE_VARS = [
        { key: '{{SCRIPT_NAME}}', label: 'Script Name', default: 'My Script' },
        { key: '{{AUTHOR}}', label: 'Author', default: 'Anonymous' },
        { key: '{{MATCH_PATTERN}}', label: 'Match Pattern', default: '*://*/*' },
        { key: '{{DESCRIPTION}}', label: 'Description', default: 'A userscript' }
    ];

    // =========================================
    // Built-in templates
    // =========================================
    const BUILT_IN_TEMPLATES = [
        {
            id: 'builtin-blank',
            name: 'Blank Script',
            description: 'Empty userscript with standard metadata block',
            category: 'blank',
            icon: '&#128196;',
            builtIn: true,
            code: `// ==UserScript==
// @name         {{SCRIPT_NAME}}
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  {{DESCRIPTION}}
// @author       {{AUTHOR}}
// @match        {{MATCH_PATTERN}}
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Your code here...
})();`
        },
        {
            id: 'builtin-dom-modifier',
            name: 'DOM Modifier',
            description: 'Modify page elements with MutationObserver',
            category: 'modifier',
            icon: '&#9998;',
            builtIn: true,
            code: `// ==UserScript==
// @name         {{SCRIPT_NAME}}
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  {{DESCRIPTION}}
// @author       {{AUTHOR}}
// @match        {{MATCH_PATTERN}}
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function modifyPage() {
        // Select elements to modify
        const elements = document.querySelectorAll('.target-selector');
        elements.forEach(el => {
            // Modify element
        });
    }

    // Run on page load
    modifyPage();

    // Watch for dynamic content
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.addedNodes.length) {
                modifyPage();
            }
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
})();`
        },
        {
            id: 'builtin-css-injector',
            name: 'CSS Injector',
            description: 'Inject custom CSS into any page',
            category: 'modifier',
            icon: '&#127912;',
            builtIn: true,
            code: `// ==UserScript==
// @name         {{SCRIPT_NAME}}
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  {{DESCRIPTION}}
// @author       {{AUTHOR}}
// @match        {{MATCH_PATTERN}}
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    GM_addStyle(\`
        /* Your custom CSS here */
        body {
            /* example */
        }
    \`);
})();`
        },
        {
            id: 'builtin-api-interceptor',
            name: 'API Interceptor',
            description: 'Intercept and modify fetch/XHR requests',
            category: 'utility',
            icon: '&#128295;',
            builtIn: true,
            code: `// ==UserScript==
// @name         {{SCRIPT_NAME}}
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  {{DESCRIPTION}}
// @author       {{AUTHOR}}
// @match        {{MATCH_PATTERN}}
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const origFetch = window.fetch;
    window.fetch = async function(...args) {
        const [url, options] = args;

        // Intercept specific requests
        if (typeof url === 'string' && url.includes('/api/target')) {
            console.log('[Interceptor] Caught:', url);
            const response = await origFetch.apply(this, args);
            const data = await response.clone().json();
            // Modify response data here
            return new Response(JSON.stringify(data), {
                status: response.status,
                headers: response.headers
            });
        }

        return origFetch.apply(this, args);
    };
})();`
        },
        {
            id: 'builtin-keyboard-shortcut',
            name: 'Keyboard Shortcuts',
            description: 'Add custom keyboard shortcuts to any page',
            category: 'utility',
            icon: '&#9000;',
            builtIn: true,
            code: `// ==UserScript==
// @name         {{SCRIPT_NAME}}
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  {{DESCRIPTION}}
// @author       {{AUTHOR}}
// @match        {{MATCH_PATTERN}}
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const shortcuts = {
        'ctrl+shift+h': () => { /* Toggle element visibility */ },
        'ctrl+shift+d': () => { /* Download content */ },
        'escape': () => { /* Close modal/overlay */ },
    };

    document.addEventListener('keydown', (e) => {
        const parts = [];
        if (e.ctrlKey || e.metaKey) parts.push('ctrl');
        if (e.shiftKey) parts.push('shift');
        if (e.altKey) parts.push('alt');
        parts.push(e.key.toLowerCase());
        const combo = parts.join('+');

        if (shortcuts[combo]) {
            e.preventDefault();
            shortcuts[combo]();
        }
    });
})();`
        },
        {
            id: 'builtin-tracker-blocker',
            name: 'Tracker Blocker',
            description: 'Block tracking scripts and pixels',
            category: 'privacy',
            icon: '&#128274;',
            builtIn: true,
            code: `// ==UserScript==
// @name         {{SCRIPT_NAME}}
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  {{DESCRIPTION}}
// @author       {{AUTHOR}}
// @match        {{MATCH_PATTERN}}
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const blockedDomains = [
        'google-analytics.com',
        'googletagmanager.com',
        'facebook.net',
        'doubleclick.net',
        'hotjar.com',
    ];

    // Block script loading
    const origCreateElement = document.createElement.bind(document);
    document.createElement = function(tag, options) {
        const el = origCreateElement(tag, options);
        if (tag.toLowerCase() === 'script') {
            const origSetAttr = el.setAttribute.bind(el);
            el.setAttribute = function(name, value) {
                if (name === 'src' && blockedDomains.some(d => value.includes(d))) {
                    console.log('[Blocker] Blocked:', value);
                    return;
                }
                return origSetAttr(name, value);
            };
        }
        return el;
    };

    // Remove tracking pixels
    window.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('img[src*="pixel"], img[width="1"][height="1"]').forEach(el => el.remove());
    });
})();`
        },
        {
            id: 'builtin-social-enhancer',
            name: 'Social Media Enhancer',
            description: 'Clean up social media feeds and add features',
            category: 'social',
            icon: '&#128172;',
            builtIn: true,
            code: `// ==UserScript==
// @name         {{SCRIPT_NAME}}
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  {{DESCRIPTION}}
// @author       {{AUTHOR}}
// @match        {{MATCH_PATTERN}}
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    // Hide promoted/sponsored content
    GM_addStyle(\`
        [data-ad], [data-sponsored], .promoted-content {
            display: none !important;
        }
    \`);

    // Add download buttons to media
    function addDownloadButtons() {
        document.querySelectorAll('video, img.post-image').forEach(media => {
            if (media.dataset.dlBtn) return;
            media.dataset.dlBtn = '1';
            const btn = document.createElement('button');
            btn.textContent = 'Download';
            btn.style.cssText = 'position:absolute;top:4px;right:4px;padding:4px 8px;background:#333;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11px;z-index:100;';
            btn.onclick = (e) => {
                e.stopPropagation();
                const url = media.src || media.querySelector('source')?.src;
                if (url) {
                    const a = document.createElement('a');
                    a.href = url; a.download = ''; a.click();
                }
            };
            media.parentElement.style.position = 'relative';
            media.parentElement.appendChild(btn);
        });
    }

    const observer = new MutationObserver(() => addDownloadButtons());
    observer.observe(document.body, { childList: true, subtree: true });
    addDownloadButtons();
})();`
        },
        {
            id: 'builtin-storage-util',
            name: 'GM Storage Utility',
            description: 'Template with GM_getValue/setValue for persistent settings',
            category: 'utility',
            icon: '&#128190;',
            builtIn: true,
            code: `// ==UserScript==
// @name         {{SCRIPT_NAME}}
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  {{DESCRIPTION}}
// @author       {{AUTHOR}}
// @match        {{MATCH_PATTERN}}
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function() {
    'use strict';

    // Default settings
    const defaults = {
        enabled: true,
        theme: 'dark',
        fontSize: 14,
    };

    function getSetting(key) {
        return GM_getValue(key, defaults[key]);
    }

    function setSetting(key, value) {
        GM_setValue(key, value);
    }

    // Register menu commands for settings
    GM_registerMenuCommand('Toggle Enabled', () => {
        const current = getSetting('enabled');
        setSetting('enabled', !current);
        location.reload();
    });

    if (!getSetting('enabled')) return;

    // Your code here...
})();`
        }
    ];

    // =========================================
    // Storage
    // =========================================
    function loadTemplates() {
        return new Promise(resolve => {
            chrome.storage.local.get(STORAGE_KEY, (data) => {
                _state.templates = data[STORAGE_KEY] || [];
                resolve();
            });
        });
    }

    function saveTemplates() {
        return new Promise(resolve => {
            chrome.storage.local.set({ [STORAGE_KEY]: _state.templates }, resolve);
        });
    }

    function getAllTemplates() {
        return [...BUILT_IN_TEMPLATES, ..._state.templates];
    }

    function generateId() {
        return 'tpl-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    }

    // =========================================
    // Template variable processing
    // =========================================
    function extractVariables(code) {
        const found = new Set();
        const re = /\{\{([A-Z_]+)\}\}/g;
        let m;
        while ((m = re.exec(code)) !== null) {
            found.add(`{{${m[1]}}}`);
        }
        return TEMPLATE_VARS.filter(v => found.has(v.key));
    }

    function substituteVariables(code, values) {
        let result = code;
        for (const [key, val] of Object.entries(values)) {
            result = result.split(key).join(val);
        }
        return result;
    }

    function stripScriptSpecificMeta(code) {
        return code
            .replace(/(\/\/\s*@name\s+).*/g, '$1{{SCRIPT_NAME}}')
            .replace(/(\/\/\s*@description\s+).*/g, '$1{{DESCRIPTION}}')
            .replace(/(\/\/\s*@author\s+).*/g, '$1{{AUTHOR}}')
            .replace(/(\/\/\s*@match\s+).*/g, '$1{{MATCH_PATTERN}}')
            .replace(/(\/\/\s*@version\s+).*/g, '$11.0.0');
    }

    async function getSmartDefaults() {
        const defaults = {};
        try {
            if (_state.getCurrentTabUrl) {
                const url = await _state.getCurrentTabUrl();
                if (url) {
                    const u = new URL(url);
                    defaults['{{MATCH_PATTERN}}'] = `*://${u.hostname}/*`;
                }
            }
        } catch {}
        return defaults;
    }

    // =========================================
    // CSS (injected once)
    // =========================================
    function injectStyles() {
        if (_state.styleEl) return;
        const style = document.createElement('style');
        style.id = 'template-manager-styles';
        style.textContent = `
/* Template Manager Styles */
.tm-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-body, #1a1a1a);
    color: var(--text-primary, #e0e0e0);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
}
.tm-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: var(--bg-header, #252525);
    border-bottom: 1px solid var(--border-color, #404040);
}
.tm-header-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary, #e0e0e0);
    flex: 1;
}
.tm-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: var(--bg-header, #252525);
    border-bottom: 1px solid var(--border-color, #404040);
}
.tm-search {
    flex: 1;
    padding: 7px 12px;
    background: var(--bg-input, #333333);
    border: 1px solid var(--border-color, #404040);
    border-radius: 6px;
    color: var(--text-primary, #e0e0e0);
    font-size: 13px;
    outline: none;
    transition: border-color 0.15s;
}
.tm-search:focus {
    border-color: var(--accent-green, #4ade80);
}
.tm-search::placeholder {
    color: var(--text-muted, #707070);
}
.tm-categories {
    display: flex;
    gap: 4px;
    padding: 8px 16px;
    overflow-x: auto;
    background: var(--bg-body, #1a1a1a);
    border-bottom: 1px solid var(--border-color, #404040);
}
.tm-cat-btn {
    padding: 5px 12px;
    background: var(--bg-input, #333333);
    border: 1px solid transparent;
    border-radius: 16px;
    color: var(--text-secondary, #a0a0a0);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.tm-cat-btn:hover {
    color: var(--text-primary, #e0e0e0);
    border-color: var(--border-color, #404040);
}
.tm-cat-btn.active {
    background: var(--accent-green-dark, #22c55e);
    color: #fff;
    border-color: var(--accent-green-dark, #22c55e);
}
.tm-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
}
.tm-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 12px;
}
.tm-card {
    background: var(--bg-row, #2a2a2a);
    border: 1px solid var(--border-color, #404040);
    border-radius: 8px;
    padding: 14px;
    cursor: pointer;
    transition: border-color 0.15s, transform 0.1s;
    display: flex;
    flex-direction: column;
}
.tm-card:hover {
    border-color: var(--accent-green, #4ade80);
    transform: translateY(-1px);
}
.tm-card-icon {
    font-size: 24px;
    margin-bottom: 8px;
    line-height: 1;
}
.tm-card-name {
    font-weight: 600;
    font-size: 13px;
    color: var(--text-primary, #e0e0e0);
    margin-bottom: 4px;
}
.tm-card-desc {
    font-size: 11px;
    color: var(--text-secondary, #a0a0a0);
    line-height: 1.4;
    flex: 1;
    margin-bottom: 8px;
}
.tm-card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
}
.tm-card-cat {
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 4px;
    background: rgba(96, 165, 250, 0.12);
    color: var(--accent-blue, #60a5fa);
    font-weight: 500;
    text-transform: capitalize;
}
.tm-card-actions {
    display: flex;
    gap: 4px;
}
.tm-btn {
    padding: 7px 14px;
    border: none;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s, opacity 0.15s;
    white-space: nowrap;
}
.tm-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
.tm-btn-primary {
    background: var(--accent-green-dark, #22c55e);
    color: #fff;
}
.tm-btn-primary:hover:not(:disabled) {
    background: var(--accent-green, #4ade80);
}
.tm-btn-secondary {
    background: var(--bg-input, #333333);
    color: var(--text-primary, #e0e0e0);
    border: 1px solid var(--border-color, #404040);
}
.tm-btn-secondary:hover:not(:disabled) {
    background: var(--bg-row-hover, #333333);
    border-color: var(--text-secondary, #a0a0a0);
}
.tm-btn-danger {
    background: var(--accent-red, #f87171);
    color: #fff;
}
.tm-btn-danger:hover:not(:disabled) {
    opacity: 0.85;
}
.tm-btn-sm {
    padding: 4px 8px;
    font-size: 11px;
}
.tm-btn-icon {
    background: none;
    border: none;
    color: var(--text-muted, #707070);
    cursor: pointer;
    padding: 4px;
    font-size: 14px;
    line-height: 1;
    border-radius: 4px;
    transition: color 0.15s, background 0.15s;
}
.tm-btn-icon:hover {
    color: var(--text-primary, #e0e0e0);
    background: var(--bg-input, #333333);
}
.tm-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    animation: tm-fadein 0.15s ease;
}
@keyframes tm-fadein {
    from { opacity: 0; }
    to { opacity: 1; }
}
.tm-modal {
    background: var(--bg-header, #252525);
    color: var(--text-primary, #e0e0e0);
    border: 1px solid var(--border-color, #404040);
    border-radius: 10px;
    width: 520px;
    max-width: 95vw;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}
.tm-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid var(--border-color, #404040);
}
.tm-modal-header h3 {
    font-size: 14px;
    font-weight: 600;
    margin: 0;
}
.tm-modal-close {
    background: none;
    border: none;
    color: var(--text-secondary, #a0a0a0);
    cursor: pointer;
    font-size: 18px;
    padding: 4px;
    line-height: 1;
}
.tm-modal-close:hover {
    color: var(--text-primary, #e0e0e0);
}
.tm-modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
}
.tm-modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid var(--border-color, #404040);
}
.tm-form-group {
    margin-bottom: 14px;
}
.tm-form-label {
    display: block;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary, #a0a0a0);
    margin-bottom: 4px;
}
.tm-form-input {
    width: 100%;
    padding: 8px 12px;
    background: var(--bg-input, #333333);
    border: 1px solid var(--border-color, #404040);
    border-radius: 6px;
    color: var(--text-primary, #e0e0e0);
    font-size: 13px;
    outline: none;
    transition: border-color 0.15s;
}
.tm-form-input:focus {
    border-color: var(--accent-green, #4ade80);
}
.tm-form-input::placeholder {
    color: var(--text-muted, #707070);
}
.tm-form-select {
    width: 100%;
    padding: 8px 12px;
    background: var(--bg-input, #333333);
    border: 1px solid var(--border-color, #404040);
    border-radius: 6px;
    color: var(--text-primary, #e0e0e0);
    font-size: 13px;
    outline: none;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23a0a0a0' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
    padding-right: 30px;
}
.tm-form-textarea {
    width: 100%;
    padding: 8px 12px;
    background: var(--bg-input, #333333);
    border: 1px solid var(--border-color, #404040);
    border-radius: 6px;
    color: var(--text-primary, #e0e0e0);
    font-size: 12px;
    font-family: 'Fira Code', 'Cascadia Code', Consolas, monospace;
    outline: none;
    resize: vertical;
    min-height: 120px;
    line-height: 1.5;
    transition: border-color 0.15s;
}
.tm-form-textarea:focus {
    border-color: var(--accent-green, #4ade80);
}
.tm-toast {
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 10px 18px;
    border-radius: 8px;
    font-size: 13px;
    color: #fff;
    z-index: 10001;
    animation: tm-toast-in 0.25s ease, tm-toast-out 0.25s ease 2.5s forwards;
    pointer-events: none;
}
.tm-toast-success { background: var(--accent-green-dark, #22c55e); }
.tm-toast-error { background: var(--accent-red, #f87171); }
.tm-toast-info { background: var(--accent-blue, #60a5fa); }
@keyframes tm-toast-in {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}
@keyframes tm-toast-out {
    from { opacity: 1; }
    to { opacity: 0; }
}
.tm-empty {
    text-align: center;
    padding: 40px 16px;
    color: var(--text-muted, #707070);
    font-size: 13px;
}
.tm-code-preview {
    background: var(--bg-body, #1a1a1a);
    border: 1px solid var(--border-color, #404040);
    border-radius: 6px;
    padding: 12px;
    font-family: 'Fira Code', 'Cascadia Code', Consolas, monospace;
    font-size: 12px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 200px;
    overflow-y: auto;
    color: var(--text-primary, #e0e0e0);
    margin-top: 8px;
}
.tm-var-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
}
.tm-var-label {
    min-width: 120px;
    font-size: 12px;
    color: var(--text-secondary, #a0a0a0);
    font-weight: 500;
}
.tm-var-input {
    flex: 1;
    padding: 6px 10px;
    background: var(--bg-input, #333333);
    border: 1px solid var(--border-color, #404040);
    border-radius: 6px;
    color: var(--text-primary, #e0e0e0);
    font-size: 13px;
    outline: none;
}
.tm-var-input:focus {
    border-color: var(--accent-green, #4ade80);
}
.tm-share-url {
    width: 100%;
    padding: 8px 12px;
    background: var(--bg-body, #1a1a1a);
    border: 1px solid var(--border-color, #404040);
    border-radius: 6px;
    color: var(--accent-blue, #60a5fa);
    font-size: 11px;
    font-family: monospace;
    word-break: break-all;
    margin-top: 8px;
}
`;
        document.head.appendChild(style);
        _state.styleEl = style;
    }

    // =========================================
    // UI Helpers
    // =========================================
    function toast(msg, type = 'success') {
        const el = document.createElement('div');
        el.className = `tm-toast tm-toast-${type}`;
        el.textContent = msg;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 3000);
    }

    function closeModal() {
        if (_state.modalEl) {
            _state.modalEl.remove();
            _state.modalEl = null;
        }
    }

    function createModal(title, bodyFn, footerFn) {
        closeModal();
        const overlay = document.createElement('div');
        overlay.className = 'tm-modal-overlay';
        overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };

        const modal = document.createElement('div');
        modal.className = 'tm-modal';

        const header = document.createElement('div');
        header.className = 'tm-modal-header';
        const headerH3 = document.createElement('h3');
        headerH3.textContent = title;
        header.appendChild(headerH3);
        const closeBtn = document.createElement('button');
        closeBtn.className = 'tm-modal-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.onclick = closeModal;
        header.appendChild(closeBtn);
        modal.appendChild(header);

        const body = document.createElement('div');
        body.className = 'tm-modal-body';
        bodyFn(body);
        modal.appendChild(body);

        if (footerFn) {
            const footer = document.createElement('div');
            footer.className = 'tm-modal-footer';
            footerFn(footer);
            modal.appendChild(footer);
        }

        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        _state.modalEl = overlay;
        return { overlay, modal, body };
    }

    // =========================================
    // Rendering
    // =========================================
    function render() {
        if (!_state.container) return;
        const c = _state.container;
        c.innerHTML = '';

        // Panel wrapper
        const panel = document.createElement('div');
        panel.className = 'tm-panel';

        // Header
        const header = document.createElement('div');
        header.className = 'tm-header';
        header.innerHTML = `<div class="tm-header-title">Script Templates</div>`;

        const importBtn = document.createElement('button');
        importBtn.className = 'tm-btn tm-btn-secondary tm-btn-sm';
        importBtn.textContent = 'Import JSON';
        importBtn.onclick = showImportDialog;
        header.appendChild(importBtn);
        panel.appendChild(header);

        // Toolbar
        const toolbar = document.createElement('div');
        toolbar.className = 'tm-toolbar';
        const search = document.createElement('input');
        search.className = 'tm-search';
        search.placeholder = 'Search templates...';
        search.value = _state.filter;
        search.oninput = () => {
            _state.filter = search.value;
            renderGrid(grid);
        };
        toolbar.appendChild(search);
        panel.appendChild(toolbar);

        // Categories
        const catBar = document.createElement('div');
        catBar.className = 'tm-categories';
        for (const cat of CATEGORIES) {
            const btn = document.createElement('button');
            btn.className = `tm-cat-btn${_state.category === cat.id ? ' active' : ''}`;
            btn.innerHTML = `${cat.icon} ${cat.label}`;
            btn.onclick = () => {
                _state.category = cat.id;
                catBar.querySelectorAll('.tm-cat-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderGrid(grid);
            };
            catBar.appendChild(btn);
        }
        panel.appendChild(catBar);

        // Content
        const content = document.createElement('div');
        content.className = 'tm-content';
        const grid = document.createElement('div');
        grid.className = 'tm-grid';
        content.appendChild(grid);
        panel.appendChild(content);

        c.appendChild(panel);
        renderGrid(grid);
    }

    function renderGrid(grid) {
        grid.innerHTML = '';
        const all = getAllTemplates();
        const q = _state.filter.toLowerCase();
        const cat = _state.category;

        const filtered = all.filter(t => {
            if (cat !== 'all') {
                if (cat === 'my' && t.builtIn) return false;
                if (cat !== 'my' && t.category !== cat) return false;
            }
            if (q) {
                const searchable = `${t.name} ${t.description} ${t.category}`.toLowerCase();
                if (!searchable.includes(q)) return false;
            }
            return true;
        });

        if (filtered.length === 0) {
            grid.innerHTML = `<div class="tm-empty" style="grid-column:1/-1;">No templates found.</div>`;
            return;
        }

        for (const tpl of filtered) {
            const card = document.createElement('div');
            card.className = 'tm-card';
            card.onclick = () => showCreateFromTemplate(tpl);

            card.innerHTML = `
                <div class="tm-card-icon">${escHtml(tpl.icon || '\u{1F4C4}')}</div>
                <div class="tm-card-name">${escHtml(tpl.name)}</div>
                <div class="tm-card-desc">${escHtml(tpl.description || '')}</div>
            `;

            const footer = document.createElement('div');
            footer.className = 'tm-card-footer';
            footer.innerHTML = `<span class="tm-card-cat">${escHtml(tpl.category || 'custom')}</span>`;

            const actions = document.createElement('div');
            actions.className = 'tm-card-actions';
            actions.onclick = (e) => e.stopPropagation();

            // Export button
            const exportBtn = document.createElement('button');
            exportBtn.className = 'tm-btn-icon';
            exportBtn.title = 'Export';
            exportBtn.innerHTML = '&#8599;';
            exportBtn.onclick = () => showExportDialog(tpl);
            actions.appendChild(exportBtn);

            if (!tpl.builtIn) {
                // Edit button
                const editBtn = document.createElement('button');
                editBtn.className = 'tm-btn-icon';
                editBtn.title = 'Edit';
                editBtn.innerHTML = '&#9998;';
                editBtn.onclick = () => showEditDialog(tpl);
                actions.appendChild(editBtn);

                // Duplicate
                const dupBtn = document.createElement('button');
                dupBtn.className = 'tm-btn-icon';
                dupBtn.title = 'Duplicate';
                dupBtn.innerHTML = '&#10697;';
                dupBtn.onclick = () => {
                    duplicateTemplate(tpl.id);
                    toast('Template duplicated', 'success');
                    render();
                };
                actions.appendChild(dupBtn);

                // Delete
                const delBtn = document.createElement('button');
                delBtn.className = 'tm-btn-icon';
                delBtn.title = 'Delete';
                delBtn.innerHTML = '&#10005;';
                delBtn.onclick = async () => {
                    const confirmed = typeof window.ScriptVaultDashboardUI?.confirm === 'function'
                        ? await window.ScriptVaultDashboardUI.confirm('Delete Template', `Delete template "${tpl.name}"?`)
                        : confirm(`Delete template "${tpl.name}"?`);
                    if (confirmed) {
                        deleteTemplateById(tpl.id);
                        toast('Template deleted', 'info');
                        render();
                    }
                };
                actions.appendChild(delBtn);
            } else {
                // Duplicate built-in
                const dupBtn = document.createElement('button');
                dupBtn.className = 'tm-btn-icon';
                dupBtn.title = 'Duplicate as custom';
                dupBtn.innerHTML = '&#10697;';
                dupBtn.onclick = () => {
                    duplicateTemplate(tpl.id);
                    toast('Duplicated as custom template', 'success');
                    render();
                };
                actions.appendChild(dupBtn);
            }

            footer.appendChild(actions);
            card.appendChild(footer);
            grid.appendChild(card);
        }
    }

    function escHtml(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    // =========================================
    // Create from template (variable wizard)
    // =========================================
    async function showCreateFromTemplate(tpl) {
        const vars = extractVariables(tpl.code);
        const smartDefaults = await getSmartDefaults();
        const values = {};

        createModal(`Create from: ${tpl.name}`, (body) => {
            if (vars.length > 0) {
                const section = document.createElement('div');
                section.style.marginBottom = '16px';
                const title = document.createElement('div');
                title.style.cssText = 'font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px;';
                title.textContent = 'Template Variables';
                section.appendChild(title);

                for (const v of vars) {
                    const row = document.createElement('div');
                    row.className = 'tm-var-row';
                    const label = document.createElement('span');
                    label.className = 'tm-var-label';
                    label.textContent = v.label;
                    row.appendChild(label);

                    const input = document.createElement('input');
                    input.className = 'tm-var-input';
                    input.value = smartDefaults[v.key] || v.default;
                    input.dataset.varKey = v.key;
                    input.placeholder = v.default;
                    input.oninput = () => {
                        values[v.key] = input.value;
                        preview.textContent = substituteVariables(tpl.code, collectValues());
                    };
                    values[v.key] = input.value;
                    row.appendChild(input);
                    section.appendChild(row);
                }
                body.appendChild(section);
            }

            const previewLabel = document.createElement('div');
            previewLabel.style.cssText = 'font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;';
            previewLabel.textContent = 'Preview';
            body.appendChild(previewLabel);

            const preview = document.createElement('pre');
            preview.className = 'tm-code-preview';
            preview.textContent = substituteVariables(tpl.code, collectValues());
            body.appendChild(preview);

            function collectValues() {
                const vals = {};
                body.querySelectorAll('.tm-var-input').forEach(inp => {
                    const key = inp.dataset.varKey;
                    const varDef = TEMPLATE_VARS.find(v => v.key === key);
                    vals[key] = inp.value || varDef?.default || '';
                });
                return vals;
            }
        }, (footer) => {
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'tm-btn tm-btn-secondary';
            cancelBtn.textContent = 'Cancel';
            cancelBtn.onclick = closeModal;
            footer.appendChild(cancelBtn);

            const createBtn = document.createElement('button');
            createBtn.className = 'tm-btn tm-btn-primary';
            createBtn.textContent = 'Create Script';
            createBtn.onclick = () => {
                if (!_state.modalEl) return;
                const finalValues = {};
                _state.modalEl.querySelectorAll('.tm-var-input').forEach(inp => {
                    const key = inp.dataset.varKey;
                    const varDef = TEMPLATE_VARS.find(v => v.key === key);
                    finalValues[key] = inp.value || varDef?.default || '';
                });
                const code = substituteVariables(tpl.code, finalValues);
                if (_state.onCreateScript) {
                    _state.onCreateScript(code);
                    toast('Script created from template', 'success');
                }
                closeModal();
            };
            footer.appendChild(createBtn);
        });
    }

    // =========================================
    // Save as template dialog
    // =========================================
    function showSaveAsTemplateDialog(code, meta = {}) {
        const stripped = stripScriptSpecificMeta(code);
        let tplName = meta.name || '';
        let tplDesc = meta.description || '';
        let tplCat = meta.category || 'utility';
        let tplIcon = meta.icon || '&#128196;';
        let tplCode = stripped;

        createModal('Save as Template', (body) => {
            const fields = [
                { label: 'Template Name', key: 'name', value: tplName, placeholder: 'My Custom Template' },
                { label: 'Description', key: 'desc', value: tplDesc, placeholder: 'What this template does...' }
            ];

            for (const f of fields) {
                const group = document.createElement('div');
                group.className = 'tm-form-group';
                group.innerHTML = `<label class="tm-form-label">${f.label}</label>`;
                const input = document.createElement('input');
                input.className = 'tm-form-input';
                input.value = f.value;
                input.placeholder = f.placeholder;
                input.dataset.field = f.key;
                group.appendChild(input);
                body.appendChild(group);
            }

            // Category select
            const catGroup = document.createElement('div');
            catGroup.className = 'tm-form-group';
            catGroup.innerHTML = `<label class="tm-form-label">Category</label>`;
            const select = document.createElement('select');
            select.className = 'tm-form-select';
            select.dataset.field = 'category';
            for (const cat of CATEGORIES.filter(c => c.id !== 'all' && c.id !== 'my')) {
                const opt = document.createElement('option');
                opt.value = cat.id;
                opt.textContent = cat.label;
                if (cat.id === tplCat) opt.selected = true;
                select.appendChild(opt);
            }
            catGroup.appendChild(select);
            body.appendChild(catGroup);

            // Icon input
            const iconGroup = document.createElement('div');
            iconGroup.className = 'tm-form-group';
            iconGroup.innerHTML = `<label class="tm-form-label">Icon (HTML entity or emoji)</label>`;
            const iconInput = document.createElement('input');
            iconInput.className = 'tm-form-input';
            iconInput.value = tplIcon;
            iconInput.dataset.field = 'icon';
            iconGroup.appendChild(iconInput);
            body.appendChild(iconGroup);

            // Code textarea
            const codeGroup = document.createElement('div');
            codeGroup.className = 'tm-form-group';
            codeGroup.innerHTML = `<label class="tm-form-label">Template Code (variables: {{SCRIPT_NAME}}, {{AUTHOR}}, {{MATCH_PATTERN}}, {{DESCRIPTION}})</label>`;
            const textarea = document.createElement('textarea');
            textarea.className = 'tm-form-textarea';
            textarea.value = tplCode;
            textarea.rows = 10;
            textarea.dataset.field = 'code';
            codeGroup.appendChild(textarea);
            body.appendChild(codeGroup);
        }, (footer) => {
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'tm-btn tm-btn-secondary';
            cancelBtn.textContent = 'Cancel';
            cancelBtn.onclick = closeModal;
            footer.appendChild(cancelBtn);

            const saveBtn = document.createElement('button');
            saveBtn.className = 'tm-btn tm-btn-primary';
            saveBtn.textContent = 'Save Template';
            saveBtn.onclick = async () => {
                const modal = _state.modalEl;
                const name = modal.querySelector('[data-field="name"]').value.trim();
                if (!name) { toast('Template name is required', 'error'); return; }

                const template = {
                    id: generateId(),
                    name,
                    description: modal.querySelector('[data-field="desc"]').value.trim(),
                    category: modal.querySelector('[data-field="category"]').value,
                    icon: modal.querySelector('[data-field="icon"]').value || '&#128196;',
                    code: modal.querySelector('[data-field="code"]').value,
                    builtIn: false,
                    createdAt: new Date().toISOString()
                };

                _state.templates.push(template);
                await saveTemplates();
                toast('Template saved!', 'success');
                closeModal();
                render();
            };
            footer.appendChild(saveBtn);
        });
    }

    // =========================================
    // Edit template dialog
    // =========================================
    function showEditDialog(tpl) {
        createModal(`Edit: ${tpl.name}`, (body) => {
            const fields = [
                { label: 'Template Name', key: 'name', value: tpl.name },
                { label: 'Description', key: 'desc', value: tpl.description || '' }
            ];

            for (const f of fields) {
                const group = document.createElement('div');
                group.className = 'tm-form-group';
                group.innerHTML = `<label class="tm-form-label">${f.label}</label>`;
                const input = document.createElement('input');
                input.className = 'tm-form-input';
                input.value = f.value;
                input.dataset.field = f.key;
                group.appendChild(input);
                body.appendChild(group);
            }

            const catGroup = document.createElement('div');
            catGroup.className = 'tm-form-group';
            catGroup.innerHTML = `<label class="tm-form-label">Category</label>`;
            const select = document.createElement('select');
            select.className = 'tm-form-select';
            select.dataset.field = 'category';
            for (const cat of CATEGORIES.filter(c => c.id !== 'all' && c.id !== 'my')) {
                const opt = document.createElement('option');
                opt.value = cat.id;
                opt.textContent = cat.label;
                if (cat.id === tpl.category) opt.selected = true;
                select.appendChild(opt);
            }
            catGroup.appendChild(select);
            body.appendChild(catGroup);

            const iconGroup = document.createElement('div');
            iconGroup.className = 'tm-form-group';
            iconGroup.innerHTML = `<label class="tm-form-label">Icon</label>`;
            const iconInput = document.createElement('input');
            iconInput.className = 'tm-form-input';
            iconInput.value = tpl.icon || '';
            iconInput.dataset.field = 'icon';
            iconGroup.appendChild(iconInput);
            body.appendChild(iconGroup);

            const codeGroup = document.createElement('div');
            codeGroup.className = 'tm-form-group';
            codeGroup.innerHTML = `<label class="tm-form-label">Template Code</label>`;
            const textarea = document.createElement('textarea');
            textarea.className = 'tm-form-textarea';
            textarea.value = tpl.code;
            textarea.rows = 10;
            textarea.dataset.field = 'code';
            codeGroup.appendChild(textarea);
            body.appendChild(codeGroup);
        }, (footer) => {
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'tm-btn tm-btn-secondary';
            cancelBtn.textContent = 'Cancel';
            cancelBtn.onclick = closeModal;
            footer.appendChild(cancelBtn);

            const saveBtn = document.createElement('button');
            saveBtn.className = 'tm-btn tm-btn-primary';
            saveBtn.textContent = 'Save Changes';
            saveBtn.onclick = async () => {
                const modal = _state.modalEl;
                const idx = _state.templates.findIndex(t => t.id === tpl.id);
                if (idx === -1) { toast('Template not found', 'error'); return; }

                _state.templates[idx] = {
                    ..._state.templates[idx],
                    name: modal.querySelector('[data-field="name"]').value.trim() || tpl.name,
                    description: modal.querySelector('[data-field="desc"]').value.trim(),
                    category: modal.querySelector('[data-field="category"]').value,
                    icon: modal.querySelector('[data-field="icon"]').value || tpl.icon,
                    code: modal.querySelector('[data-field="code"]').value,
                    updatedAt: new Date().toISOString()
                };

                await saveTemplates();
                toast('Template updated', 'success');
                closeModal();
                render();
            };
            footer.appendChild(saveBtn);
        });
    }

    // =========================================
    // Export / Import / Share
    // =========================================
    function showExportDialog(tpl) {
        const exportData = {
            name: tpl.name,
            description: tpl.description || '',
            category: tpl.category,
            icon: tpl.icon || '&#128196;',
            code: tpl.code,
            exportedAt: new Date().toISOString(),
            source: 'ScriptVault'
        };
        const json = JSON.stringify(exportData, null, 2);
        const dataUrl = 'data:application/json;base64,' + btoa(unescape(encodeURIComponent(json)));

        createModal('Export Template', (body) => {
            const jsonLabel = document.createElement('div');
            jsonLabel.style.cssText = 'font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:6px;';
            jsonLabel.textContent = 'JSON';
            body.appendChild(jsonLabel);

            const pre = document.createElement('pre');
            pre.className = 'tm-code-preview';
            pre.textContent = json;
            pre.style.maxHeight = '200px';
            body.appendChild(pre);

            const urlLabel = document.createElement('div');
            urlLabel.style.cssText = 'font-size:12px;font-weight:600;color:var(--text-secondary);margin-top:14px;margin-bottom:6px;';
            urlLabel.textContent = 'Shareable Data URL';
            body.appendChild(urlLabel);

            const urlBox = document.createElement('div');
            urlBox.className = 'tm-share-url';
            urlBox.textContent = dataUrl;
            body.appendChild(urlBox);
        }, (footer) => {
            const copyJsonBtn = document.createElement('button');
            copyJsonBtn.className = 'tm-btn tm-btn-secondary';
            copyJsonBtn.textContent = 'Copy JSON';
            copyJsonBtn.onclick = async () => {
                try { await navigator.clipboard.writeText(json); toast('JSON copied', 'info'); } catch { toast('Copy failed', 'error'); }
            };
            footer.appendChild(copyJsonBtn);

            const copyUrlBtn = document.createElement('button');
            copyUrlBtn.className = 'tm-btn tm-btn-secondary';
            copyUrlBtn.textContent = 'Copy URL';
            copyUrlBtn.onclick = async () => {
                try { await navigator.clipboard.writeText(dataUrl); toast('URL copied', 'info'); } catch { toast('Copy failed', 'error'); }
            };
            footer.appendChild(copyUrlBtn);

            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'tm-btn tm-btn-primary';
            downloadBtn.textContent = 'Download';
            downloadBtn.onclick = () => {
                const blob = new Blob([json], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `${tpl.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.template.json`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(a.href), 1000);
                toast('Template downloaded', 'success');
            };
            footer.appendChild(downloadBtn);

            const closeBtn = document.createElement('button');
            closeBtn.className = 'tm-btn tm-btn-secondary';
            closeBtn.textContent = 'Close';
            closeBtn.onclick = closeModal;
            footer.appendChild(closeBtn);
        });
    }

    function showImportDialog() {
        createModal('Import Template', (body) => {
            const label = document.createElement('div');
            label.style.cssText = 'font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:8px;';
            label.textContent = 'Paste JSON or load a file';
            body.appendChild(label);

            const textarea = document.createElement('textarea');
            textarea.className = 'tm-form-textarea';
            textarea.placeholder = '{"name": "...", "code": "...", ...}';
            textarea.rows = 8;
            textarea.id = 'tm-import-json';
            body.appendChild(textarea);

            const orLabel = document.createElement('div');
            orLabel.style.cssText = 'text-align:center;color:var(--text-muted);font-size:12px;margin:10px 0;';
            orLabel.textContent = '- or -';
            body.appendChild(orLabel);

            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.json';
            fileInput.style.cssText = 'font-size:12px;color:var(--text-secondary);';
            fileInput.onchange = () => {
                const file = fileInput.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => { textarea.value = reader.result; };
                reader.readAsText(file);
            };
            body.appendChild(fileInput);
        }, (footer) => {
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'tm-btn tm-btn-secondary';
            cancelBtn.textContent = 'Cancel';
            cancelBtn.onclick = closeModal;
            footer.appendChild(cancelBtn);

            const importBtn = document.createElement('button');
            importBtn.className = 'tm-btn tm-btn-primary';
            importBtn.textContent = 'Import';
            importBtn.onclick = async () => {
                const json = _state.modalEl.querySelector('#tm-import-json').value.trim();
                if (!json) { toast('Paste or load a JSON template', 'error'); return; }
                try {
                    const result = importTemplateFromJson(json);
                    await saveTemplates();
                    toast(`Imported: ${result.name}`, 'success');
                    closeModal();
                    render();
                } catch (e) {
                    toast(e.message, 'error');
                }
            };
            footer.appendChild(importBtn);
        });
    }

    function importTemplateFromJson(json) {
        let data;
        try {
            data = JSON.parse(json);
        } catch {
            throw new Error('Invalid JSON');
        }
        if (!data.name || !data.code) throw new Error('Template must have "name" and "code" fields');

        const template = {
            id: generateId(),
            name: data.name,
            description: data.description || '',
            category: data.category || 'utility',
            icon: data.icon || '&#128196;',
            code: data.code,
            builtIn: false,
            createdAt: new Date().toISOString(),
            importedAt: new Date().toISOString()
        };

        _state.templates.push(template);
        return template;
    }

    // =========================================
    // Template CRUD
    // =========================================
    function deleteTemplateById(id) {
        _state.templates = _state.templates.filter(t => t.id !== id);
        saveTemplates();
    }

    function duplicateTemplate(id) {
        const all = getAllTemplates();
        const source = all.find(t => t.id === id);
        if (!source) return null;

        const dup = {
            id: generateId(),
            name: source.name + ' (Copy)',
            description: source.description || '',
            category: source.category,
            icon: source.icon || '&#128196;',
            code: source.code,
            builtIn: false,
            createdAt: new Date().toISOString()
        };

        _state.templates.push(dup);
        saveTemplates();
        return dup;
    }

    // =========================================
    // Command palette integration
    // =========================================
    function getCommandPaletteItems() {
        return getAllTemplates().map(tpl => ({
            id: `template:${tpl.id}`,
            label: `template: ${tpl.name}`,
            description: tpl.description || '',
            category: tpl.category,
            icon: tpl.icon,
            action: () => showCreateFromTemplate(tpl)
        }));
    }

    // =========================================
    // Public API
    // =========================================
    return {
        /**
         * Initialize the template manager.
         * @param {HTMLElement} containerEl - Container to render into
         * @param {Object} options - Configuration
         * @param {Function} options.getScript - fn(id) => script object
         * @param {Function} options.onCreateScript - fn(code) => void
         * @param {Function} options.getCurrentTabUrl - async fn() => string
         */
        async init(containerEl, options = {}) {
            _state.container = containerEl;
            _state.getScript = options.getScript || null;
            _state.onCreateScript = options.onCreateScript || null;
            _state.getCurrentTabUrl = options.getCurrentTabUrl || null;
            injectStyles();
            await loadTemplates();
            render();
        },

        /**
         * Save code as a new custom template.
         * @param {string} code - Script source code
         * @param {Object} meta - Optional metadata { name, description, category, icon }
         */
        saveAsTemplate(code, meta = {}) {
            showSaveAsTemplateDialog(code, meta);
        },

        /**
         * Show the create-from-template wizard.
         * @param {string} templateId - Template ID
         */
        async createFromTemplate(templateId) {
            const tpl = getAllTemplates().find(t => t.id === templateId);
            if (!tpl) throw new Error('Template not found');
            await showCreateFromTemplate(tpl);
        },

        /**
         * Get all available templates (built-in + custom).
         * @returns {Array} Templates
         */
        getTemplates() {
            return getAllTemplates();
        },

        /**
         * Import a template from JSON string.
         * @param {string} json - JSON string
         * @returns {Object} Imported template
         */
        async importTemplate(json) {
            const tpl = importTemplateFromJson(json);
            await saveTemplates();
            render();
            return tpl;
        },

        /**
         * Export a template as JSON string.
         * @param {string} templateId - Template ID
         * @returns {string} JSON string
         */
        exportTemplate(templateId) {
            const tpl = getAllTemplates().find(t => t.id === templateId);
            if (!tpl) throw new Error('Template not found');
            return JSON.stringify({
                name: tpl.name,
                description: tpl.description || '',
                category: tpl.category,
                icon: tpl.icon || '&#128196;',
                code: tpl.code,
                exportedAt: new Date().toISOString(),
                source: 'ScriptVault'
            }, null, 2);
        },

        /**
         * Delete a custom template.
         * @param {string} templateId - Template ID
         */
        async deleteTemplate(templateId) {
            const tpl = _state.templates.find(t => t.id === templateId);
            if (!tpl) throw new Error('Template not found or is built-in');
            deleteTemplateById(templateId);
            render();
        },

        /**
         * Get items for command palette integration.
         * @returns {Array} { id, label, description, action }
         */
        getCommandPaletteItems() {
            return getCommandPaletteItems();
        },

        /** Force re-render */
        refresh() {
            render();
        },

        destroy() {
            if (_state.styleEl) { _state.styleEl.remove(); _state.styleEl = null; }
            if (_state.modalEl) { _state.modalEl.remove(); _state.modalEl = null; }
            if (_state.container) { _state.container.innerHTML = ''; _state.container = null; }
            _state.templates = [];
        }
    };
})();
