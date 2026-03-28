/**
 * ScriptVault Advanced Snippet Library
 * Comprehensive code snippet library with built-in and custom snippets,
 * searchable grid UI, category filtering, and Monaco editor integration.
 */
const SnippetLibrary = (() => {
    'use strict';

    // =========================================
    // State
    // =========================================
    const _state = {
        container: null,
        styleEl: null,
        monacoEditor: null,
        activeCategory: 'all',
        searchQuery: '',
        customSnippets: [],
        expandedSnippet: null,
        editingSnippet: null,
        visible: false,
    };

    // =========================================
    // Built-in Snippets
    // =========================================
    const BUILTIN_SNIPPETS = [
        // --- DOM Manipulation ---
        {
            id: 'dom-qs-helper',
            title: 'querySelector Helper',
            description: 'Short aliases for querySelector and querySelectorAll.',
            category: 'dom',
            code: `const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
$CURSOR$`
        },
        {
            id: 'dom-wait-for-element',
            title: 'waitForElement',
            description: 'Wait for an element to appear in the DOM using MutationObserver.',
            category: 'dom',
            code: `function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const el = document.querySelector(selector);
        if (el) return resolve(el);
        const observer = new MutationObserver((_, obs) => {
            const found = document.querySelector(selector);
            if (found) { obs.disconnect(); resolve(found); }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        if (timeout > 0) {
            setTimeout(() => { observer.disconnect(); reject(new Error('Timeout waiting for ' + selector)); }, timeout);
        }
    });
}
$CURSOR$`
        },
        {
            id: 'dom-observe',
            title: 'observeDOM',
            description: 'Observe DOM changes with a simple callback interface.',
            category: 'dom',
            code: `function observeDOM(target, callback, options = {}) {
    const config = { childList: true, subtree: true, ...options };
    const observer = new MutationObserver((mutations) => {
        callback(mutations, observer);
    });
    observer.observe(target || document.body, config);
    return observer;
}
$CURSOR$`
        },
        {
            id: 'dom-create-el',
            title: 'createElement Shorthand',
            description: 'Create DOM elements with attributes and children in one call.',
            category: 'dom',
            code: `function h(tag, attrs = {}, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
        else el.setAttribute(k, v);
    }
    for (const child of children) {
        el.append(typeof child === 'string' ? document.createTextNode(child) : child);
    }
    return el;
}
$CURSOR$`
        },
        // --- Network ---
        {
            id: 'net-fetch-retry',
            title: 'Fetch with Retry',
            description: 'Fetch wrapper with automatic retry and exponential backoff.',
            category: 'network',
            code: `async function fetchWithRetry(url, options = {}, retries = 3, backoff = 300) {
    for (let i = 0; i <= retries; i++) {
        try {
            const res = await fetch(url, options);
            if (!res.ok && i < retries) throw new Error(\`HTTP \${res.status}\`);
            return res;
        } catch (err) {
            if (i === retries) throw err;
            await new Promise(r => setTimeout(r, backoff * Math.pow(2, i)));
        }
    }
}
$CURSOR$`
        },
        {
            id: 'net-cors-proxy',
            title: 'CORS Proxy Wrapper',
            description: 'Wrap fetch requests through a CORS proxy for cross-origin access.',
            category: 'network',
            code: `function corsProxy(url, proxyBase = 'https://corsproxy.io/?') {
    return fetch(proxyBase + encodeURIComponent(url));
}
// Usage with GM_xmlhttpRequest (no CORS restriction):
// GM_xmlhttpRequest({ method: 'GET', url, onload: (r) => console.log(r.responseText) });
$CURSOR$`
        },
        {
            id: 'net-request-interceptor',
            title: 'Request Interceptor',
            description: 'Intercept and modify fetch/XHR requests before they are sent.',
            category: 'network',
            code: `(function interceptRequests() {
    const origFetch = window.fetch;
    window.fetch = function(input, init = {}) {
        const url = typeof input === 'string' ? input : input.url;
        console.log('[Intercept] fetch:', url);
        // Modify request here
        return origFetch.call(this, input, init);
    };

    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...args) {
        console.log('[Intercept] XHR:', method, url);
        this._url = url;
        return origOpen.call(this, method, url, ...args);
    };
})();
$CURSOR$`
        },
        {
            id: 'net-response-modifier',
            title: 'Response Modifier',
            description: 'Intercept and modify fetch responses before they reach the caller.',
            category: 'network',
            code: `(function modifyResponses() {
    const origFetch = window.fetch;
    window.fetch = async function(input, init) {
        const res = await origFetch.call(this, input, init);
        const url = typeof input === 'string' ? input : input.url;
        if (url.includes('$1')) {
            const clone = res.clone();
            const data = await clone.json();
            // Modify data here
            return new Response(JSON.stringify(data), {
                status: res.status,
                headers: res.headers
            });
        }
        return res;
    };
})();
$CURSOR$`
        },
        // --- Storage ---
        {
            id: 'store-persistent-cache',
            title: 'Persistent Cache Helper',
            description: 'Cache API responses in localStorage with expiration.',
            category: 'storage',
            code: `const PersistentCache = {
    get(key) {
        try {
            const item = JSON.parse(localStorage.getItem('cache_' + key));
            if (!item) return null;
            if (item.expiry && Date.now() > item.expiry) {
                localStorage.removeItem('cache_' + key);
                return null;
            }
            return item.value;
        } catch { return null; }
    },
    set(key, value, ttlMs = 3600000) {
        localStorage.setItem('cache_' + key, JSON.stringify({
            value, expiry: ttlMs > 0 ? Date.now() + ttlMs : 0
        }));
    },
    clear(prefix) {
        Object.keys(localStorage)
            .filter(k => k.startsWith('cache_' + (prefix || '')))
            .forEach(k => localStorage.removeItem(k));
    }
};
$CURSOR$`
        },
        {
            id: 'store-cross-tab-sync',
            title: 'Cross-Tab Sync',
            description: 'Synchronize data across browser tabs using storage events.',
            category: 'storage',
            code: `const CrossTabSync = {
    _listeners: new Map(),
    send(channel, data) {
        localStorage.setItem('cts_' + channel, JSON.stringify({ data, ts: Date.now() }));
        localStorage.removeItem('cts_' + channel);
    },
    on(channel, callback) {
        const handler = (e) => {
            if (e.key === 'cts_' + channel && e.newValue) {
                try { callback(JSON.parse(e.newValue).data); } catch {}
            }
        };
        this._listeners.set(channel, handler);
        window.addEventListener('storage', handler);
    },
    off(channel) {
        const handler = this._listeners.get(channel);
        if (handler) window.removeEventListener('storage', handler);
        this._listeners.delete(channel);
    }
};
$CURSOR$`
        },
        {
            id: 'store-migration',
            title: 'Storage Migration Helper',
            description: 'Migrate stored data between versions with transform functions.',
            category: 'storage',
            code: `async function migrateStorage(key, migrations) {
    // migrations: { 2: (data) => newData, 3: (data) => newData }
    const raw = GM_getValue ? GM_getValue(key, null) : JSON.parse(localStorage.getItem(key));
    if (!raw) return null;
    let data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const currentVersion = data._version || 1;
    const versions = Object.keys(migrations).map(Number).sort((a, b) => a - b);
    for (const v of versions) {
        if (v > currentVersion) {
            data = migrations[v](data);
            data._version = v;
        }
    }
    if (GM_setValue) GM_setValue(key, data);
    else localStorage.setItem(key, JSON.stringify(data));
    return data;
}
$CURSOR$`
        },
        // --- UI ---
        {
            id: 'ui-modal-dialog',
            title: 'Modal Dialog',
            description: 'Create a styled modal dialog with title, body, and action buttons.',
            category: 'ui',
            code: `function showModal({ title, body, buttons = ['OK'], onAction }) {
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
        position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: '99999'
    });
    const modal = document.createElement('div');
    Object.assign(modal.style, {
        background: '#2a2a2a', color: '#e0e0e0', borderRadius: '8px',
        padding: '20px', minWidth: '300px', maxWidth: '500px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
    });
    modal.innerHTML = \`<h3 style="margin:0 0 12px">\${title}</h3><div style="margin-bottom:16px">\${body}</div>\`;
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:8px;justify-content:flex-end';
    buttons.forEach((label, i) => {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.style.cssText = 'padding:6px 16px;border:none;border-radius:4px;cursor:pointer;' +
            (i === buttons.length - 1 ? 'background:#22c55e;color:#fff' : 'background:#555;color:#e0e0e0');
        btn.onclick = () => { overlay.remove(); onAction?.(label, i); };
        btnRow.append(btn);
    });
    modal.append(btnRow);
    overlay.append(modal);
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    document.body.append(overlay);
    return overlay;
}
$CURSOR$`
        },
        {
            id: 'ui-toast',
            title: 'Toast Notification',
            description: 'Show a temporary toast notification at the bottom of the screen.',
            category: 'ui',
            code: `function showToast(message, duration = 3000, type = 'info') {
    const colors = { info: '#60a5fa', success: '#4ade80', error: '#f87171', warning: '#fbbf24' };
    const toast = document.createElement('div');
    Object.assign(toast.style, {
        position: 'fixed', bottom: '20px', right: '20px', zIndex: '99999',
        background: '#333', color: '#e0e0e0', padding: '12px 20px',
        borderRadius: '8px', borderLeft: \`4px solid \${colors[type] || colors.info}\`,
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)', fontSize: '13px',
        transition: 'opacity 0.3s, transform 0.3s', opacity: '0', transform: 'translateY(10px)'
    });
    toast.textContent = message;
    document.body.append(toast);
    requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.transform = 'translateY(0)'; });
    setTimeout(() => {
        toast.style.opacity = '0'; toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}
$CURSOR$`
        },
        {
            id: 'ui-floating-panel',
            title: 'Floating Panel',
            description: 'Create a draggable floating panel with minimize/close buttons.',
            category: 'ui',
            code: `function createFloatingPanel({ title = 'Panel', width = 300, height = 200, content = '' }) {
    const panel = document.createElement('div');
    panel.innerHTML = \`
        <div class="fp-header" style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#333;cursor:move;border-radius:8px 8px 0 0;user-select:none">
            <span style="font-weight:600">\${title}</span>
            <div><button class="fp-min" style="background:none;border:none;color:#e0e0e0;cursor:pointer;font-size:16px">_</button>
            <button class="fp-close" style="background:none;border:none;color:#f87171;cursor:pointer;font-size:16px">x</button></div>
        </div>
        <div class="fp-body" style="padding:12px;overflow:auto;height:calc(100% - 40px)">\${content}</div>\`;
    Object.assign(panel.style, {
        position: 'fixed', top: '50px', right: '20px', width: width + 'px', height: height + 'px',
        background: '#2a2a2a', color: '#e0e0e0', borderRadius: '8px', zIndex: '99999',
        border: '1px solid #404040', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', fontSize: '13px'
    });
    // Drag logic
    let dragging = false, dx, dy;
    const header = panel.querySelector('.fp-header');
    header.onmousedown = (e) => { dragging = true; dx = e.clientX - panel.offsetLeft; dy = e.clientY - panel.offsetTop; };
    document.addEventListener('mousemove', (e) => { if (dragging) { panel.style.left = (e.clientX - dx) + 'px'; panel.style.top = (e.clientY - dy) + 'px'; panel.style.right = 'auto'; } });
    document.addEventListener('mouseup', () => { dragging = false; });
    panel.querySelector('.fp-close').onclick = () => panel.remove();
    panel.querySelector('.fp-min').onclick = () => {
        const body = panel.querySelector('.fp-body');
        body.style.display = body.style.display === 'none' ? '' : 'none';
        panel.style.height = body.style.display === 'none' ? 'auto' : height + 'px';
    };
    document.body.append(panel);
    return panel;
}
$CURSOR$`
        },
        {
            id: 'ui-css-inject',
            title: 'CSS Injection',
            description: 'Inject CSS styles into the page with deduplication.',
            category: 'ui',
            code: `function injectCSS(id, css) {
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = css;
    (document.head || document.documentElement).append(style);
    return style;
}
$CURSOR$`
        },
        // --- Page Modification ---
        {
            id: 'page-auto-click',
            title: 'Auto-Click',
            description: 'Automatically click an element when it appears on the page.',
            category: 'page',
            code: `function autoClick(selector, { delay = 0, repeat = false, interval = 1000 } = {}) {
    const doClick = () => {
        const el = document.querySelector(selector);
        if (el) { setTimeout(() => el.click(), delay); return true; }
        return false;
    };
    if (doClick() && !repeat) return;
    const observer = new MutationObserver(() => {
        if (doClick() && !repeat) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return observer;
}
$CURSOR$`
        },
        {
            id: 'page-auto-fill',
            title: 'Auto-Fill Form',
            description: 'Fill form fields by selector with specified values.',
            category: 'page',
            code: `function autoFill(fieldMap) {
    // fieldMap: { '#username': 'myuser', '#email': 'me@example.com', ... }
    for (const [selector, value] of Object.entries(fieldMap)) {
        const el = document.querySelector(selector);
        if (!el) continue;
        const nativeSetter = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype, 'value'
        )?.set || Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
        if (nativeSetter) nativeSetter.call(el, value);
        else el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }
}
$CURSOR$`
        },
        {
            id: 'page-remove-elements',
            title: 'Remove Elements',
            description: 'Remove matching elements from the page and future additions.',
            category: 'page',
            code: `function removeElements(selectors) {
    const selectorStr = Array.isArray(selectors) ? selectors.join(',') : selectors;
    const remove = () => document.querySelectorAll(selectorStr).forEach(el => el.remove());
    remove();
    const observer = new MutationObserver(remove);
    observer.observe(document.body, { childList: true, subtree: true });
    return observer;
}
$CURSOR$`
        },
        {
            id: 'page-text-replace',
            title: 'Text Replacement',
            description: 'Replace text content across the page using a map of patterns.',
            category: 'page',
            code: `function replaceText(replacements) {
    // replacements: { 'old text': 'new text', ... } or [{ pattern: /regex/, replace: 'new' }]
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
        let text = walker.currentNode.textContent;
        if (Array.isArray(replacements)) {
            for (const { pattern, replace } of replacements) {
                text = text.replace(pattern, replace);
            }
        } else {
            for (const [from, to] of Object.entries(replacements)) {
                text = text.split(from).join(to);
            }
        }
        walker.currentNode.textContent = text;
    }
}
$CURSOR$`
        },
        {
            id: 'page-add-button',
            title: 'Add Button to Page',
            description: 'Add a styled floating action button to the page.',
            category: 'page',
            code: `function addPageButton({ text = 'Action', onClick, position = 'bottom-right', color = '#22c55e' }) {
    const positions = {
        'bottom-right': { bottom: '20px', right: '20px' },
        'bottom-left': { bottom: '20px', left: '20px' },
        'top-right': { top: '20px', right: '20px' },
        'top-left': { top: '20px', left: '20px' }
    };
    const btn = document.createElement('button');
    btn.textContent = text;
    Object.assign(btn.style, {
        position: 'fixed', zIndex: '99999', padding: '10px 20px',
        background: color, color: '#fff', border: 'none', borderRadius: '8px',
        cursor: 'pointer', fontSize: '14px', fontWeight: '600',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        ...positions[position]
    });
    btn.onclick = onClick;
    document.body.append(btn);
    return btn;
}
$CURSOR$`
        },
        // --- SPA Handling ---
        {
            id: 'spa-url-change',
            title: 'URL Change Listener',
            description: 'Detect URL changes in SPAs (popstate + pushState + replaceState).',
            category: 'spa',
            code: `function onURLChange(callback) {
    let lastURL = location.href;
    const check = () => {
        if (location.href !== lastURL) {
            const prev = lastURL;
            lastURL = location.href;
            callback(location.href, prev);
        }
    };
    window.addEventListener('popstate', check);
    const wrap = (orig) => function(...args) {
        const result = orig.apply(this, args);
        check();
        return result;
    };
    history.pushState = wrap(history.pushState);
    history.replaceState = wrap(history.replaceState);
    return () => { window.removeEventListener('popstate', check); };
}
$CURSOR$`
        },
        {
            id: 'spa-pushstate-intercept',
            title: 'pushState Interceptor',
            description: 'Intercept pushState/replaceState with before/after hooks.',
            category: 'spa',
            code: `function interceptPushState({ before, after } = {}) {
    const origPush = history.pushState.bind(history);
    const origReplace = history.replaceState.bind(history);
    history.pushState = function(state, title, url) {
        if (before?.(url, 'push') === false) return;
        origPush(state, title, url);
        after?.(url, 'push');
    };
    history.replaceState = function(state, title, url) {
        if (before?.(url, 'replace') === false) return;
        origReplace(state, title, url);
        after?.(url, 'replace');
    };
}
$CURSOR$`
        },
        {
            id: 'spa-route-watcher',
            title: 'Route Watcher',
            description: 'Run callbacks when specific URL patterns are matched.',
            category: 'spa',
            code: `function watchRoutes(routes) {
    // routes: { '/users/:id': (params) => {}, '/settings*': () => {} }
    function matchRoute(pattern, path) {
        const keys = []; let regex = pattern.replace(/\\*/g, '.*')
            .replace(/:([\\w]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; });
        const m = path.match(new RegExp('^' + regex + '$'));
        if (!m) return null;
        return keys.reduce((p, k, i) => ({ ...p, [k]: m[i + 1] }), {});
    }
    function check() {
        const path = location.pathname;
        for (const [pattern, handler] of Object.entries(routes)) {
            const params = matchRoute(pattern, path);
            if (params) handler(params);
        }
    }
    onURLChange(check);
    check();
}
$CURSOR$`
        },
        // --- Utility ---
        {
            id: 'util-debounce',
            title: 'Debounce',
            description: 'Debounce a function to run only after a pause in calls.',
            category: 'utility',
            code: `function debounce(fn, delay = 300) {
    let timer;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}
$CURSOR$`
        },
        {
            id: 'util-throttle',
            title: 'Throttle',
            description: 'Throttle a function to run at most once per interval.',
            category: 'utility',
            code: `function throttle(fn, interval = 300) {
    let last = 0, timer;
    return function(...args) {
        const now = Date.now();
        if (now - last >= interval) {
            last = now;
            fn.apply(this, args);
        } else {
            clearTimeout(timer);
            timer = setTimeout(() => { last = Date.now(); fn.apply(this, args); }, interval - (now - last));
        }
    };
}
$CURSOR$`
        },
        {
            id: 'util-sleep',
            title: 'Sleep',
            description: 'Async sleep/delay utility.',
            category: 'utility',
            code: `const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Usage:
// await sleep(1000);
$CURSOR$`
        },
        {
            id: 'util-retry',
            title: 'Retry',
            description: 'Retry an async function with configurable attempts and backoff.',
            category: 'utility',
            code: `async function retry(fn, { attempts = 3, delay = 500, backoff = 2 } = {}) {
    for (let i = 0; i < attempts; i++) {
        try { return await fn(); }
        catch (err) {
            if (i === attempts - 1) throw err;
            await new Promise(r => setTimeout(r, delay * Math.pow(backoff, i)));
        }
    }
}
$CURSOR$`
        },
        {
            id: 'util-memoize',
            title: 'Memoize',
            description: 'Cache function results based on arguments.',
            category: 'utility',
            code: `function memoize(fn, keyFn = (...args) => JSON.stringify(args)) {
    const cache = new Map();
    return function(...args) {
        const key = keyFn(...args);
        if (cache.has(key)) return cache.get(key);
        const result = fn.apply(this, args);
        cache.set(key, result);
        return result;
    };
}
$CURSOR$`
        },
        {
            id: 'util-deep-clone',
            title: 'Deep Clone',
            description: 'Deep clone objects supporting circular references.',
            category: 'utility',
            code: `function deepClone(obj) {
    if (typeof structuredClone === 'function') return structuredClone(obj);
    // Fallback for older environments
    const seen = new WeakMap();
    function clone(val) {
        if (val === null || typeof val !== 'object') return val;
        if (seen.has(val)) return seen.get(val);
        if (val instanceof Date) return new Date(val);
        if (val instanceof RegExp) return new RegExp(val.source, val.flags);
        const result = Array.isArray(val) ? [] : {};
        seen.set(val, result);
        for (const [k, v] of Object.entries(val)) result[k] = clone(v);
        return result;
    }
    return clone(obj);
}
$CURSOR$`
        },
        {
            id: 'util-date-formatter',
            title: 'Date Formatter',
            description: 'Simple date formatter with common format patterns.',
            category: 'utility',
            code: `function formatDate(date, format = 'YYYY-MM-DD HH:mm:ss') {
    const d = date instanceof Date ? date : new Date(date);
    const pad = (n, len = 2) => String(n).padStart(len, '0');
    const tokens = {
        YYYY: d.getFullYear(), MM: pad(d.getMonth() + 1), DD: pad(d.getDate()),
        HH: pad(d.getHours()), mm: pad(d.getMinutes()), ss: pad(d.getSeconds()),
        SSS: pad(d.getMilliseconds(), 3)
    };
    return format.replace(/YYYY|MM|DD|HH|mm|ss|SSS/g, m => tokens[m]);
}
$CURSOR$`
        },
        // --- GM API Wrappers ---
        {
            id: 'gm-storage-sync',
            title: 'GM Storage Sync',
            description: 'Promise-based GM storage wrapper with JSON serialization.',
            category: 'gm',
            code: `const GMStorage = {
    async get(key, defaultVal = null) {
        try {
            const raw = await (typeof GM?.getValue === 'function'
                ? GM.getValue(key) : GM_getValue(key));
            return raw !== undefined ? JSON.parse(raw) : defaultVal;
        } catch { return defaultVal; }
    },
    async set(key, value) {
        const raw = JSON.stringify(value);
        return typeof GM?.setValue === 'function'
            ? GM.setValue(key, raw) : GM_setValue(key, raw);
    },
    async remove(key) {
        return typeof GM?.deleteValue === 'function'
            ? GM.deleteValue(key) : GM_deleteValue(key);
    },
    async keys() {
        return typeof GM?.listValues === 'function'
            ? GM.listValues() : GM_listValues();
    }
};
$CURSOR$`
        },
        {
            id: 'gm-xhr-promise',
            title: 'GM XHR Promise Wrapper',
            description: 'Promise wrapper for GM_xmlhttpRequest with full options support.',
            category: 'gm',
            code: `function gmFetch(url, options = {}) {
    return new Promise((resolve, reject) => {
        const xhrFn = typeof GM?.xmlHttpRequest === 'function'
            ? GM.xmlHttpRequest : GM_xmlhttpRequest;
        xhrFn({
            method: options.method || 'GET',
            url,
            headers: options.headers || {},
            data: options.body || null,
            responseType: options.responseType || 'text',
            onload: (res) => {
                const response = {
                    ok: res.status >= 200 && res.status < 300,
                    status: res.status,
                    statusText: res.statusText,
                    text: () => Promise.resolve(res.responseText),
                    json: () => Promise.resolve(JSON.parse(res.responseText)),
                    headers: res.responseHeaders
                };
                resolve(response);
            },
            onerror: (err) => reject(new Error('GM XHR failed: ' + (err.statusText || 'unknown'))),
            ontimeout: () => reject(new Error('GM XHR timeout'))
        });
    });
}
$CURSOR$`
        },
        {
            id: 'gm-notification-actions',
            title: 'GM Notification with Actions',
            description: 'Display a GM notification with click and close handlers.',
            category: 'gm',
            code: `function gmNotify({ title, text, image, timeout = 5000, onClick, onClose }) {
    const notifyFn = typeof GM?.notification === 'function'
        ? GM.notification : GM_notification;
    if (typeof notifyFn === 'function') {
        notifyFn({
            title: title || 'ScriptVault',
            text,
            image: image || '',
            timeout,
            onclick: onClick || (() => {}),
            ondone: onClose || (() => {})
        });
    } else {
        // Fallback to Notification API
        if (Notification.permission === 'granted') {
            const n = new Notification(title, { body: text, icon: image });
            if (onClick) n.onclick = onClick;
            if (timeout > 0) setTimeout(() => n.close(), timeout);
        } else {
            Notification.requestPermission().then(p => { if (p === 'granted') gmNotify({ title, text, image, timeout, onClick, onClose }); });
        }
    }
}
$CURSOR$`
        },
    ];

    const CATEGORIES = {
        all:     { label: 'All',              icon: '\u2726' },
        dom:     { label: 'DOM',              icon: '\u29C9' },
        network: { label: 'Network',          icon: '\u21C4' },
        storage: { label: 'Storage',          icon: '\u26C1' },
        ui:      { label: 'UI',               icon: '\u25A3' },
        page:    { label: 'Page Mod',         icon: '\u270E' },
        spa:     { label: 'SPA',              icon: '\u21BB' },
        utility: { label: 'Utility',          icon: '\u2699' },
        gm:      { label: 'GM API',           icon: '\u2731' },
        custom:  { label: 'Custom',           icon: '\u2605' },
    };

    // =========================================
    // CSS
    // =========================================
    function injectStyles() {
        if (_state.styleEl) return;
        const style = document.createElement('style');
        style.id = 'snippet-library-styles';
        style.textContent = `
.snip-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-body, #1a1a1a);
    color: var(--text-primary, #e0e0e0);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
}
.snip-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color, #404040);
    background: var(--bg-header, #252525);
    flex-shrink: 0;
}
.snip-header h3 {
    margin: 0;
    font-size: 15px;
    color: var(--accent-green, #4ade80);
    white-space: nowrap;
}
.snip-search {
    flex: 1;
    padding: 6px 12px;
    background: var(--bg-input, #333);
    border: 1px solid var(--border-color, #404040);
    border-radius: 6px;
    color: var(--text-primary, #e0e0e0);
    font-size: 13px;
    outline: none;
}
.snip-search:focus {
    border-color: var(--accent-green, #4ade80);
}
.snip-search::placeholder {
    color: var(--text-muted, #707070);
}
.snip-btn-add {
    padding: 6px 14px;
    background: var(--accent-green-dark, #22c55e);
    color: #fff;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
}
.snip-btn-add:hover {
    filter: brightness(1.1);
}
.snip-categories {
    display: flex;
    gap: 4px;
    padding: 8px 16px;
    border-bottom: 1px solid var(--border-color, #404040);
    overflow-x: auto;
    flex-shrink: 0;
}
.snip-cat-btn {
    padding: 4px 12px;
    background: transparent;
    border: 1px solid var(--border-color, #404040);
    border-radius: 14px;
    color: var(--text-secondary, #a0a0a0);
    cursor: pointer;
    font-size: 12px;
    white-space: nowrap;
    transition: all 0.15s;
}
.snip-cat-btn:hover {
    border-color: var(--accent-green, #4ade80);
    color: var(--text-primary, #e0e0e0);
}
.snip-cat-btn.active {
    background: var(--accent-green-dark, #22c55e);
    border-color: var(--accent-green-dark, #22c55e);
    color: #fff;
}
.snip-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 12px;
    padding: 16px;
    overflow-y: auto;
    flex: 1;
}
.snip-card {
    background: var(--bg-row, #2a2a2a);
    border: 1px solid var(--border-color, #404040);
    border-radius: 8px;
    padding: 14px;
    cursor: pointer;
    transition: border-color 0.15s, box-shadow 0.15s;
}
.snip-card:hover {
    border-color: var(--accent-green, #4ade80);
    box-shadow: 0 2px 12px rgba(74, 222, 128, 0.08);
}
.snip-card.expanded {
    grid-column: 1 / -1;
}
.snip-card-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary, #e0e0e0);
    margin-bottom: 4px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}
.snip-card-cat {
    font-size: 10px;
    padding: 2px 8px;
    background: var(--bg-input, #333);
    border-radius: 10px;
    color: var(--text-secondary, #a0a0a0);
}
.snip-card-desc {
    font-size: 12px;
    color: var(--text-secondary, #a0a0a0);
    margin-bottom: 10px;
    line-height: 1.4;
}
.snip-card-preview {
    background: var(--bg-body, #1a1a1a);
    border: 1px solid var(--border-color, #404040);
    border-radius: 6px;
    padding: 10px;
    font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
    font-size: 11px;
    line-height: 1.5;
    color: var(--text-secondary, #a0a0a0);
    overflow: hidden;
    white-space: pre;
    max-height: 60px;
}
.snip-card.expanded .snip-card-preview {
    max-height: none;
    overflow-x: auto;
    color: var(--text-primary, #e0e0e0);
}
.snip-card-actions {
    display: none;
    gap: 8px;
    margin-top: 10px;
}
.snip-card.expanded .snip-card-actions {
    display: flex;
}
.snip-action-btn {
    padding: 5px 14px;
    border: 1px solid var(--border-color, #404040);
    border-radius: 5px;
    background: var(--bg-input, #333);
    color: var(--text-primary, #e0e0e0);
    cursor: pointer;
    font-size: 12px;
    transition: all 0.15s;
}
.snip-action-btn:hover {
    border-color: var(--accent-green, #4ade80);
}
.snip-action-btn.primary {
    background: var(--accent-green-dark, #22c55e);
    border-color: var(--accent-green-dark, #22c55e);
    color: #fff;
}
.snip-action-btn.danger {
    border-color: var(--accent-red, #f87171);
    color: var(--accent-red, #f87171);
}
.snip-action-btn.danger:hover {
    background: var(--accent-red, #f87171);
    color: #fff;
}
.snip-empty {
    text-align: center;
    padding: 40px;
    color: var(--text-muted, #707070);
}
/* Code highlighting in expanded view */
.snip-card.expanded .snip-card-preview .kw { color: var(--accent-purple, #c084fc); }
.snip-card.expanded .snip-card-preview .fn { color: var(--accent-blue, #60a5fa); }
.snip-card.expanded .snip-card-preview .str { color: var(--accent-green, #4ade80); }
.snip-card.expanded .snip-card-preview .num { color: var(--accent-orange, #fb923c); }
.snip-card.expanded .snip-card-preview .cmt { color: var(--text-muted, #707070); font-style: italic; }
.snip-card.expanded .snip-card-preview .op { color: var(--accent-yellow, #fbbf24); }

/* Custom snippet editor modal */
.snip-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    animation: snip-fadein 0.15s ease;
}
@keyframes snip-fadein {
    from { opacity: 0; }
    to { opacity: 1; }
}
.snip-modal {
    background: var(--bg-header, #252525);
    color: var(--text-primary, #e0e0e0);
    border: 1px solid var(--border-color, #404040);
    border-radius: 10px;
    width: 560px;
    max-width: 95vw;
    max-height: 90vh;
    overflow-y: auto;
    padding: 24px;
}
.snip-modal h3 {
    margin: 0 0 16px;
    color: var(--accent-green, #4ade80);
}
.snip-modal label {
    display: block;
    font-size: 12px;
    color: var(--text-secondary, #a0a0a0);
    margin-bottom: 4px;
    margin-top: 12px;
}
.snip-modal input,
.snip-modal select,
.snip-modal textarea {
    width: 100%;
    padding: 8px 12px;
    background: var(--bg-input, #333);
    border: 1px solid var(--border-color, #404040);
    border-radius: 6px;
    color: var(--text-primary, #e0e0e0);
    font-size: 13px;
    outline: none;
}
.snip-modal input:focus,
.snip-modal select:focus,
.snip-modal textarea:focus {
    border-color: var(--accent-green, #4ade80);
}
.snip-modal textarea {
    font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
    min-height: 160px;
    resize: vertical;
}
.snip-modal-btns {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    margin-top: 20px;
}
.snip-count {
    font-size: 11px;
    color: var(--text-muted, #707070);
    padding: 4px 16px 0;
}
`;
        document.head.appendChild(style);
        _state.styleEl = style;
    }

    // =========================================
    // Syntax Highlighting (simple)
    // =========================================
    function highlightCode(code) {
        const esc = code
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        return esc
            // Comments (single-line)
            .replace(/(\/\/.*?)$/gm, '<span class="cmt">$1</span>')
            // Strings (double-quoted, single-quoted, backtick)
            .replace(/(["'`])(?:(?!\1|\\).|\\.)*?\1/g, '<span class="str">$&</span>')
            // Keywords
            .replace(/\b(const|let|var|function|async|await|return|if|else|for|while|do|switch|case|break|continue|new|class|extends|import|export|default|from|try|catch|throw|finally|typeof|instanceof|in|of|this|null|undefined|true|false|void)\b/g, '<span class="kw">$1</span>')
            // Numbers
            .replace(/\b(\d+\.?\d*)\b/g, '<span class="num">$1</span>')
            // Arrow functions and operators
            .replace(/(=&gt;|===|!==|==|!=|&amp;&amp;|\|\||\.\.\.)/g, '<span class="op">$1</span>');
    }

    function previewLines(code, lineCount = 3) {
        const clean = code.replace(/\$CURSOR\$/g, '').replace(/\$SELECTION\$/g, '').replace(/\$\d+/g, '');
        return clean.split('\n').slice(0, lineCount).join('\n');
    }

    // =========================================
    // Storage
    // =========================================
    async function loadCustomSnippets() {
        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                chrome.storage.local.get('customSnippets', (result) => {
                    _state.customSnippets = result.customSnippets || [];
                    resolve(_state.customSnippets);
                });
            } else {
                try {
                    _state.customSnippets = JSON.parse(localStorage.getItem('customSnippets') || '[]');
                } catch { _state.customSnippets = []; }
                resolve(_state.customSnippets);
            }
        });
    }

    async function saveCustomSnippets() {
        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                chrome.storage.local.set({ customSnippets: _state.customSnippets }, resolve);
            } else {
                localStorage.setItem('customSnippets', JSON.stringify(_state.customSnippets));
                resolve();
            }
        });
    }

    // =========================================
    // Filtering
    // =========================================
    function getAllSnippets() {
        const custom = _state.customSnippets.map(s => ({ ...s, isCustom: true }));
        return [...BUILTIN_SNIPPETS, ...custom];
    }

    function filterSnippets() {
        let snippets = getAllSnippets();
        const cat = _state.activeCategory;
        if (cat && cat !== 'all') {
            snippets = snippets.filter(s => {
                if (cat === 'custom') return s.isCustom;
                return s.category === cat;
            });
        }
        const q = _state.searchQuery.toLowerCase().trim();
        if (q) {
            snippets = snippets.filter(s =>
                s.title.toLowerCase().includes(q) ||
                s.description.toLowerCase().includes(q) ||
                s.code.toLowerCase().includes(q) ||
                s.category.toLowerCase().includes(q)
            );
        }
        return snippets;
    }

    // =========================================
    // Render
    // =========================================
    function render() {
        if (!_state.container) return;
        const snippets = filterSnippets();

        const catHTML = Object.entries(CATEGORIES).map(([key, cat]) => {
            const activeClass = _state.activeCategory === key ? ' active' : '';
            return `<button class="snip-cat-btn${activeClass}" data-cat="${key}">${cat.icon} ${cat.label}</button>`;
        }).join('');

        const cardsHTML = snippets.length === 0
            ? '<div class="snip-empty">No snippets found</div>'
            : snippets.map(s => {
                const expanded = _state.expandedSnippet === s.id;
                const preview = expanded
                    ? highlightCode(s.code.replace(/\$CURSOR\$/g, '\u258E').replace(/\$SELECTION\$/g, '\u00ABselection\u00BB').replace(/\$(\d+)/g, '\u00ABtab$1\u00BB'))
                    : escapeHTML(previewLines(s.code));
                const customBtns = s.isCustom
                    ? `<button class="snip-action-btn" data-action="edit" data-id="${s.id}">Edit</button>
                       <button class="snip-action-btn danger" data-action="delete" data-id="${s.id}">Delete</button>`
                    : '';
                return `<div class="snip-card${expanded ? ' expanded' : ''}" data-id="${s.id}">
                    <div class="snip-card-title">
                        <span>${escapeHTML(s.title)}</span>
                        <span class="snip-card-cat">${escapeHTML(CATEGORIES[s.category]?.label || s.category)}</span>
                    </div>
                    <div class="snip-card-desc">${escapeHTML(s.description)}</div>
                    <pre class="snip-card-preview">${preview}</pre>
                    <div class="snip-card-actions">
                        <button class="snip-action-btn primary" data-action="insert" data-id="${s.id}">Insert at Cursor</button>
                        <button class="snip-action-btn" data-action="copy" data-id="${s.id}">Copy</button>
                        ${customBtns}
                    </div>
                </div>`;
            }).join('');

        _state.container.innerHTML = `
            <div class="snip-panel">
                <div class="snip-header">
                    <h3>Snippets</h3>
                    <input type="text" class="snip-search" placeholder="Search snippets..." value="${escapeHTML(_state.searchQuery)}">
                    <button class="snip-btn-add">+ Custom</button>
                </div>
                <div class="snip-categories">${catHTML}</div>
                <div class="snip-count">${snippets.length} snippet${snippets.length !== 1 ? 's' : ''}</div>
                <div class="snip-grid">${cardsHTML}</div>
            </div>`;

        bindEvents();
    }

    function escapeHTML(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    // =========================================
    // Event Binding
    // =========================================
    function bindEvents() {
        const panel = _state.container.querySelector('.snip-panel');
        if (!panel) return;

        // Search
        const searchInput = panel.querySelector('.snip-search');
        searchInput?.addEventListener('input', (e) => {
            const cursorPos = e.target.selectionStart;
            _state.searchQuery = e.target.value;
            render();
            // Re-focus search and restore cursor position
            const newInput = _state.container.querySelector('.snip-search');
            if (newInput) {
                newInput.focus();
                newInput.setSelectionRange(cursorPos, cursorPos);
            }
        });

        // Category tabs
        panel.querySelectorAll('.snip-cat-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                _state.activeCategory = btn.dataset.cat;
                _state.expandedSnippet = null;
                render();
            });
        });

        // Card click (expand/collapse)
        panel.querySelectorAll('.snip-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.snip-action-btn')) return;
                const id = card.dataset.id;
                _state.expandedSnippet = _state.expandedSnippet === id ? null : id;
                render();
            });
        });

        // Action buttons
        panel.querySelectorAll('.snip-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const id = btn.dataset.id;
                switch (action) {
                    case 'insert': insertSnippet(id); break;
                    case 'copy': copySnippet(id); break;
                    case 'edit': showSnippetEditor(id); break;
                    case 'delete': confirmDeleteSnippet(id); break;
                }
            });
        });

        // Add custom button
        panel.querySelector('.snip-btn-add')?.addEventListener('click', () => {
            showSnippetEditor(null);
        });
    }

    // =========================================
    // Snippet Actions
    // =========================================
    function getSnippetById(id) {
        return getAllSnippets().find(s => s.id === id) || null;
    }

    function processSnippetCode(code, selection = '') {
        let processed = code.replace(/\$SELECTION\$/g, selection);
        // Remove tab stop markers for now (future: implement tab stop navigation)
        processed = processed.replace(/\$\d+/g, '');
        // Find cursor position
        const cursorIndex = processed.indexOf('$CURSOR$');
        processed = processed.replace(/\$CURSOR\$/g, '');
        return { code: processed, cursorOffset: cursorIndex >= 0 ? cursorIndex : processed.length };
    }

    function insertSnippet(snippetId) {
        const snippet = getSnippetById(snippetId);
        if (!snippet) return;

        const editor = _state.monacoEditor;
        if (!editor) {
            copySnippet(snippetId);
            return;
        }

        const selection = editor.getSelection();
        const model = editor.getModel();
        if (!model) return;

        const selectedText = model.getValueInRange(selection) || '';
        const { code, cursorOffset } = processSnippetCode(snippet.code, selectedText);

        // Insert at current position
        const position = selection.getStartPosition();
        editor.executeEdits('snippet-library', [{
            range: selection,
            text: code,
            forceMoveMarkers: true
        }]);

        // Move cursor to $CURSOR$ position
        const insertOffset = model.getOffsetAt(position) + cursorOffset;
        const newPos = model.getPositionAt(insertOffset);
        editor.setPosition(newPos);
        editor.focus();
    }

    async function copySnippet(snippetId) {
        const snippet = getSnippetById(snippetId);
        if (!snippet) return;
        const { code } = processSnippetCode(snippet.code);
        try {
            await navigator.clipboard.writeText(code);
            showCopyFeedback(snippetId);
        } catch {
            // Fallback
            const ta = document.createElement('textarea');
            ta.value = code;
            ta.style.cssText = 'position:fixed;opacity:0';
            document.body.append(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
            showCopyFeedback(snippetId);
        }
    }

    function showCopyFeedback(snippetId) {
        const btn = _state.container.querySelector(`.snip-action-btn[data-action="copy"][data-id="${snippetId}"]`);
        if (!btn) return;
        const orig = btn.textContent;
        btn.textContent = 'Copied!';
        btn.style.borderColor = 'var(--accent-green, #4ade80)';
        btn.style.color = 'var(--accent-green, #4ade80)';
        setTimeout(() => {
            btn.textContent = orig;
            btn.style.borderColor = '';
            btn.style.color = '';
        }, 1500);
    }

    // =========================================
    // Custom Snippet Editor Modal
    // =========================================
    function showSnippetEditor(editId) {
        const existing = editId ? _state.customSnippets.find(s => s.id === editId) : null;

        const overlay = document.createElement('div');
        overlay.className = 'snip-modal-overlay';

        const catOptions = Object.entries(CATEGORIES)
            .filter(([k]) => k !== 'all' && k !== 'custom')
            .map(([k, v]) => `<option value="${k}" ${existing?.category === k ? 'selected' : ''}>${v.label}</option>`)
            .join('');

        overlay.innerHTML = `
            <div class="snip-modal">
                <h3>${existing ? 'Edit' : 'New'} Custom Snippet</h3>
                <label>Name</label>
                <input type="text" id="snip-edit-name" value="${escapeHTML(existing?.title || '')}" placeholder="My Snippet">
                <label>Description</label>
                <input type="text" id="snip-edit-desc" value="${escapeHTML(existing?.description || '')}" placeholder="What does it do?">
                <label>Category</label>
                <select id="snip-edit-cat">${catOptions}</select>
                <label>Code (use $CURSOR$ for cursor position, $SELECTION$ for selected text)</label>
                <textarea id="snip-edit-code" placeholder="// Your snippet code here">${escapeHTML(existing?.code || '')}</textarea>
                <div class="snip-modal-btns">
                    <button class="snip-action-btn" id="snip-edit-cancel">Cancel</button>
                    <button class="snip-action-btn primary" id="snip-edit-save">Save</button>
                </div>
            </div>`;

        document.body.appendChild(overlay);

        overlay.querySelector('#snip-edit-cancel').onclick = () => overlay.remove();
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

        overlay.querySelector('#snip-edit-save').onclick = async () => {
            const name = overlay.querySelector('#snip-edit-name').value.trim();
            const desc = overlay.querySelector('#snip-edit-desc').value.trim();
            const cat = overlay.querySelector('#snip-edit-cat').value;
            const code = overlay.querySelector('#snip-edit-code').value;

            if (!name) {
                overlay.querySelector('#snip-edit-name').style.borderColor = 'var(--accent-red, #f87171)';
                return;
            }
            if (!code.trim()) {
                overlay.querySelector('#snip-edit-code').style.borderColor = 'var(--accent-red, #f87171)';
                return;
            }

            const snippetData = {
                id: existing ? existing.id : 'custom-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
                title: name,
                description: desc,
                category: cat,
                code: code,
            };

            if (existing) {
                const idx = _state.customSnippets.findIndex(s => s.id === existing.id);
                if (idx >= 0) _state.customSnippets[idx] = snippetData;
            } else {
                _state.customSnippets.push(snippetData);
            }

            await saveCustomSnippets();
            overlay.remove();
            render();
        };

        overlay.querySelector('#snip-edit-name').focus();
    }

    function confirmDeleteSnippet(snippetId) {
        const snippet = _state.customSnippets.find(s => s.id === snippetId);
        if (!snippet) return;

        const overlay = document.createElement('div');
        overlay.className = 'snip-modal-overlay';
        overlay.innerHTML = `
            <div class="snip-modal" style="width:400px">
                <h3>Delete Snippet</h3>
                <p style="margin:12px 0;color:var(--text-secondary,#a0a0a0)">
                    Are you sure you want to delete "<strong>${escapeHTML(snippet.title)}</strong>"? This cannot be undone.
                </p>
                <div class="snip-modal-btns">
                    <button class="snip-action-btn" id="snip-del-cancel">Cancel</button>
                    <button class="snip-action-btn danger" id="snip-del-confirm">Delete</button>
                </div>
            </div>`;

        document.body.appendChild(overlay);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
        overlay.querySelector('#snip-del-cancel').onclick = () => overlay.remove();
        overlay.querySelector('#snip-del-confirm').onclick = async () => {
            _state.customSnippets = _state.customSnippets.filter(s => s.id !== snippetId);
            await saveCustomSnippets();
            overlay.remove();
            _state.expandedSnippet = null;
            render();
        };
    }

    // =========================================
    // Keyboard Shortcut
    // =========================================
    function handleKeyDown(e) {
        // Ctrl+Shift+S to toggle snippet panel
        if (e.ctrlKey && e.shiftKey && e.key === 'S') {
            e.preventDefault();
            if (_state.visible) {
                _state.container.style.display = 'none';
                _state.visible = false;
            } else {
                _state.container.style.display = '';
                _state.visible = true;
                const searchInput = _state.container.querySelector('.snip-search');
                searchInput?.focus();
            }
        }
    }

    // =========================================
    // Public API
    // =========================================
    return {
        /**
         * Initialize the snippet library.
         * @param {HTMLElement} containerEl - Container to render into
         * @param {object} [options] - { editor: Monaco editor instance }
         */
        async init(containerEl, options = {}) {
            _state.container = containerEl;
            _state.monacoEditor = options.editor || null;
            _state.visible = true;
            injectStyles();
            await loadCustomSnippets();
            render();
            document.addEventListener('keydown', handleKeyDown);
        },

        /**
         * Get snippets by category (or all).
         * @param {string} [category] - Category key or null for all
         * @returns {Array} snippets
         */
        getSnippets(category) {
            if (!category || category === 'all') return getAllSnippets();
            return getAllSnippets().filter(s => s.category === category);
        },

        /**
         * Insert a snippet into the editor by ID.
         * @param {string} snippetId
         */
        insertSnippet(snippetId) {
            insertSnippet(snippetId);
        },

        /**
         * Save a custom snippet.
         * @param {object} snippet - { title, description, category, code }
         * @returns {Promise<object>} saved snippet with generated id
         */
        async saveCustomSnippet(snippet) {
            const data = {
                id: 'custom-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
                title: snippet.title || 'Untitled',
                description: snippet.description || '',
                category: snippet.category || 'utility',
                code: snippet.code || '',
            };
            _state.customSnippets.push(data);
            await saveCustomSnippets();
            render();
            return data;
        },

        /**
         * Delete a custom snippet by ID.
         * @param {string} snippetId
         * @returns {Promise<boolean>}
         */
        async deleteCustomSnippet(snippetId) {
            const idx = _state.customSnippets.findIndex(s => s.id === snippetId);
            if (idx < 0) return false;
            _state.customSnippets.splice(idx, 1);
            await saveCustomSnippets();
            render();
            return true;
        },

        /**
         * Search snippets by query string.
         * @param {string} query
         * @returns {Array} matching snippets
         */
        search(query) {
            const q = (query || '').toLowerCase().trim();
            if (!q) return getAllSnippets();
            return getAllSnippets().filter(s =>
                s.title.toLowerCase().includes(q) ||
                s.description.toLowerCase().includes(q) ||
                s.code.toLowerCase().includes(q)
            );
        },

        /**
         * Set the Monaco editor reference.
         * @param {object} editor - Monaco editor instance
         */
        setEditor(editor) {
            _state.monacoEditor = editor;
        },

        /**
         * Save current editor selection as a snippet.
         */
        saveSelectionAsSnippet() {
            const editor = _state.monacoEditor;
            if (!editor) return;
            const sel = editor.getSelection();
            const model = editor.getModel();
            if (!sel || !model) return;
            const text = model.getValueInRange(sel);
            if (!text.trim()) return;
            showSnippetEditor(null);
            // Pre-fill the code field after a tick
            setTimeout(() => {
                const codeEl = document.querySelector('#snip-edit-code');
                if (codeEl) codeEl.value = text;
            }, 50);
        },

        /**
         * Destroy and clean up.
         */
        destroy() {
            document.removeEventListener('keydown', handleKeyDown);
            if (_state.styleEl) { _state.styleEl.remove(); _state.styleEl = null; }
            if (_state.container) { _state.container.innerHTML = ''; }
            _state.container = null;
            _state.monacoEditor = null;
            _state.expandedSnippet = null;
            _state.customSnippets = [];
        }
    };
})();
