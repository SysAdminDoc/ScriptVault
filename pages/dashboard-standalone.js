/**
 * ScriptVault Standalone HTML Export Module
 * Export scripts as self-contained HTML pages, portfolio sites,
 * bookmarklets, and install pages. All generated output works
 * completely offline with no external dependencies.
 */
const StandaloneExport = (() => {
    'use strict';

    // =========================================
    // State
    // =========================================
    const _state = {
        styleEl: null,
        getScript: null,       // fn(id) => { id, name, code, description, version, ... }
        getAllScripts: null,    // fn() => scripts[]
    };

    const _safeSetHtml = (typeof window.ScriptVaultDashboardUI?.safeSetHtml === 'function')
        ? window.ScriptVaultDashboardUI.safeSetHtml
        : (el, html) => {
          { const _r = document.createRange(); _r.selectNodeContents(el); el.replaceChildren(_r.createContextualFragment(String(html ?? ''))); }
        };

    // =========================================
    // CSS (injected for in-dashboard UI)
    // =========================================
    function injectStyles() {
        if (_state.styleEl) return;
        const style = document.createElement('style');
        style.id = 'standalone-export-styles';
        style.textContent = `
.se-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    animation: se-fadein 0.15s ease;
}
@keyframes se-fadein { from { opacity: 0; } to { opacity: 1; } }
.se-modal {
    background: var(--bg-header, #252525);
    color: var(--text-primary, #e0e0e0);
    border: 1px solid var(--border-color, #404040);
    border-radius: 10px;
    width: 600px;
    max-width: 95vw;
    max-height: 90vh;
    overflow-y: auto;
    padding: 24px;
}
.se-modal h3 { margin: 0 0 16px; color: var(--accent-green, #4ade80); }
.se-modal p { color: var(--text-secondary, #a0a0a0); font-size: 0.8125rem; margin-bottom: 12px; }
.se-btn {
    appearance: none;
    padding: 8px 18px;
    border: 1px solid var(--border-color, #404040);
    border-radius: 6px;
    background: var(--bg-input, #333);
    color: var(--text-primary, #e0e0e0);
    cursor: pointer;
    font-size: 0.8125rem;
    transition: border-color 0.15s, background 0.15s, filter 0.15s;
}
.se-btn:hover { border-color: var(--accent-green, #4ade80); }
.se-btn.primary { background: var(--accent-green-dark, #22c55e); border-color: var(--accent-green-dark, #22c55e); color: #fff; }
.se-btn.primary:hover { filter: brightness(1.1); }
.se-btn-row { display: flex; gap: 8px; margin-top: 16px; justify-content: flex-end; }
.se-preview { background: var(--bg-body, #1a1a1a); border: 1px solid var(--border-color, #404040); border-radius: 6px; padding: 12px; margin-top: 12px; max-height: 200px; overflow: auto; font-family: monospace; font-size: 0.6875rem; color: var(--text-secondary, #a0a0a0); white-space: pre-wrap; word-break: break-all; }
.se-bookmarklet-link { display: inline-block; padding: 10px 24px; background: var(--accent-blue, #60a5fa); color: #fff; border-radius: 8px; text-decoration: none; font-weight: 600; cursor: grab; margin: 12px 0; }
.se-warning { color: var(--accent-yellow, #fbbf24); font-size: 0.75rem; margin-top: 8px; }
`;
        document.head.appendChild(style);
        _state.styleEl = style;
    }

    // =========================================
    // Helpers
    // =========================================
    function escapeHTML(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function downloadFile(filename, content, mimeType = 'text/html') {
        const blob = new Blob([content], { type: mimeType + ';charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
    }

    async function copyText(text) {
        if (navigator.clipboard?.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch (_) {}
        }

        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        let copied = false;
        try {
            copied = document.execCommand('copy');
        } catch (_) {
            copied = false;
        }
        ta.remove();
        return copied;
    }

    function slugify(str) {
        const base = String(str || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        return base || 'script';
    }

    function formatGeneratedDate() {
        try {
            return new Date().toLocaleDateString();
        } catch {
            return new Date().toISOString().slice(0, 10);
        }
    }

    function parseMetadata(code) {
        const meta = {};
        const headerMatch = code.match(/\/\/\s*==UserScript==([\s\S]*?)\/\/\s*==\/UserScript==/);
        if (headerMatch) {
            const lines = headerMatch[1].split('\n');
            for (const line of lines) {
                const m = line.match(/\/\/\s*@(\S+)\s+(.*)/);
                if (m) {
                    const key = m[1].trim();
                    const val = m[2].trim();
                    if (meta[key]) {
                        if (!Array.isArray(meta[key])) meta[key] = [meta[key]];
                        meta[key].push(val);
                    } else {
                        meta[key] = val;
                    }
                }
            }
        }
        return meta;
    }

    function minifyJS(code) {
        // Skip minification for very large scripts to avoid perf issues
        if (code.length > 500000) return code;
        // Strip userscript header
        let js = code.replace(/\/\/\s*==UserScript==[\s\S]*?\/\/\s*==\/UserScript==\s*/, '');
        // Conservative, string/regex-safe minification: only remove comments
        // that occupy an entire line, then collapse blank lines/indentation.
        // We deliberately do NOT strip inline `//` or `/* */` via regex —
        // those match `//`, `/*`, `*/` sequences inside string and regex
        // literals (e.g. "a//b", "/*", or /\/\*/), corrupting the exported
        // bookmarklet. Full-line comments are the bulk of comment bytes and are
        // always safe to drop.
        js = js.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0 && !line.startsWith('//'))
            .join('\n');
        return js;
    }

    function buildClientHelpers() {
        return `
function svShowToast(message) {
    var toast = document.getElementById('copyToast');
    if (!toast) return;
    toast.textContent = message || 'Copied to clipboard!';
    toast.classList.add('show');
    if (window.__svToastTimer) {
        clearTimeout(window.__svToastTimer);
    }
    window.__svToastTimer = setTimeout(function() {
        toast.classList.remove('show');
    }, 2000);
}
function svCopyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text).catch(function() {
            return svLegacyCopyText(text);
        });
    }
    return svLegacyCopyText(text);
}
function svLegacyCopyText(text) {
    return new Promise(function(resolve, reject) {
        try {
            var ta = document.createElement('textarea');
            ta.value = text;
            ta.style.cssText = 'position:fixed;opacity:0';
            document.body.appendChild(ta);
            ta.select();
            var copied = document.execCommand('copy');
            ta.remove();
            if (copied === false) {
                reject(new Error('Copy failed'));
                return;
            }
            resolve();
        } catch (error) {
            reject(error);
        }
    });
}
function svDownloadFile(filename, content, mimeType) {
    var blob = new Blob([content], { type: (mimeType || 'text/plain') + ';charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function() {
        URL.revokeObjectURL(a.href);
        a.remove();
    }, 1000);
}
function svSetToggleState(button, expanded, showLabel, hideLabel) {
    if (!button) return;
    button.textContent = expanded ? hideLabel : showLabel;
    button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
}`;
    }

    // =========================================
    // Shared HTML Theme
    // =========================================
    function baseHTMLTemplate({ title, bodyContent, inlineCSS = '', inlineJS = '' }) {
        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHTML(title)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#1a1a1a;color:#e0e0e0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;min-height:100vh}
a{color:#60a5fa;text-decoration:none}a:hover{text-decoration:underline}
.container{max-width:960px;margin:0 auto;padding:32px 24px}
h1{font-size:1.5rem;color:#4ade80;margin-bottom:8px}
h2{font-size:1.125rem;color:#e0e0e0;margin-bottom:12px}
h3{font-size:0.9375rem;color:#a0a0a0;margin-bottom:8px}
.subtitle{color:#a0a0a0;font-size:0.875rem;margin-bottom:24px}
.badge{display:inline-block;padding:2px 10px;border-radius:10px;font-size:0.6875rem;font-weight:600;margin-inline-end:6px}
.badge-green{background:#22c55e22;color:#4ade80;border:1px solid #22c55e44}
.badge-blue{background:#60a5fa22;color:#60a5fa;border:1px solid #60a5fa44}
.badge-purple{background:#c084fc22;color:#c084fc;border:1px solid #c084fc44}
.card{background:#2a2a2a;border:1px solid #404040;border-radius:10px;padding:20px;margin-bottom:16px;transition:border-color 0.15s}
.card:hover{border-color:#4ade8066}
.card-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.card-title{font-size:1rem;font-weight:600}
.card-desc{color:#a0a0a0;font-size:0.8125rem;margin-bottom:12px}
.code-block{background:#1a1a1a;border:1px solid #404040;border-radius:8px;padding:16px;font-family:'Cascadia Code','Fira Code',Consolas,monospace;font-size:0.75rem;line-height:1.6;overflow-x:auto;position:relative;white-space:pre;color:#a0a0a0;max-height:400px;overflow-y:auto}
.code-block.expanded{max-height:none}
.btn{appearance:none;display:inline-flex;align-items:center;justify-content:center;padding:8px 20px;border:none;border-radius:6px;cursor:pointer;font-size:0.8125rem;font-weight:600;transition:background 0.15s,border-color 0.15s,filter 0.15s,color 0.15s}
.btn-green{background:#22c55e;color:#fff}.btn-green:hover{filter:brightness(1.1)}
.btn-blue{background:#3b82f6;color:#fff}.btn-blue:hover{filter:brightness(1.1)}
.btn-outline{background:transparent;border:1px solid #404040;color:#e0e0e0}.btn-outline:hover{border-color:#4ade80}
.btn-row{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
.meta-table{width:100%;border-collapse:collapse;margin-bottom:16px}
.meta-table td{padding:6px 12px;border-bottom:1px solid #333;font-size:0.8125rem}
.meta-table td:first-child{color:#a0a0a0;width:120px;white-space:nowrap}
.search-box{width:100%;padding:10px 16px;background:#333;border:1px solid #404040;border-radius:8px;color:#e0e0e0;font-size:0.875rem;outline:none;margin-bottom:16px}
.search-box:focus{border-color:#4ade80}
.search-box::placeholder{color:#707070}
.header-bar{background:#252525;border-bottom:1px solid #404040;padding:16px 24px;margin-bottom:32px}
.header-bar h1{margin:0}
.toggle-btn{appearance:none;background:none;border:1px solid #404040;color:#a0a0a0;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:0.75rem;transition:border-color 0.15s,color 0.15s,background 0.15s}
.toggle-btn:hover{border-color:#4ade80;color:#e0e0e0}
.footer{text-align:center;padding:32px 24px;color:#707070;font-size:0.75rem;border-top:1px solid #333;margin-top:32px}
.copy-toast{position:fixed;bottom:24px;right:24px;background:#333;color:#4ade80;padding:10px 20px;border-radius:8px;font-size:0.8125rem;opacity:0;transition:opacity 0.3s;pointer-events:none;z-index:9999}
.copy-toast.show{opacity:1}
${inlineCSS}
</style>
</head>
<body>
${bodyContent}
${inlineJS ? `<script>${inlineJS.replace(/<\/(script)/gi, '<\\/$1')}<\/script>` : ''}
</body>
</html>`;
    }

    // =========================================
    // Syntax Highlighting (inline, no deps)
    // =========================================
    function highlightJS(code) {
        const esc = escapeHTML(code);
        // Extract strings and comments first to prevent double-wrapping keywords inside them
        const tokens = [];
        const placeholder = esc.replace(/(\/\/.*?)$/gm, (m) => { tokens.push('<span style="color:#707070;font-style:italic">' + m + '</span>'); return '\x00T' + (tokens.length - 1) + 'T\x00'; })
            .replace(/(["'`])(?:(?!\1|\\).|\\.)*?\1/g, (m) => { tokens.push('<span style="color:#4ade80">' + m + '</span>'); return '\x00T' + (tokens.length - 1) + 'T\x00'; });
        // Now highlight keywords and numbers in remaining (non-string, non-comment) text
        return placeholder
            .replace(/\b(const|let|var|function|async|await|return|if|else|for|while|new|class|try|catch|throw|typeof|instanceof|import|export|from|of|in|this|null|undefined|true|false|void)\b/g, '<span style="color:#c084fc">$1</span>')
            .replace(/\b(\d+\.?\d*)\b/g, '<span style="color:#fb923c">$1</span>')
            .replace(/\x00T(\d+)T\x00/g, (_, i) => tokens[i]);
    }

    // =========================================
    // Module 1: Single Script HTML Export
    // =========================================
    function exportAsHTML(scriptOrId) {
        const script = (scriptOrId && typeof scriptOrId === 'object') ? scriptOrId : _state.getScript?.(scriptOrId);
        if (!script) throw new Error('Script not found');

        const meta = parseMetadata(script.code || '');
        const name = script.name || meta.name || 'Untitled Script';
        const desc = script.description || meta.description || '';
        const version = script.version || meta.version || '1.0';
        const author = script.author || meta.author || 'Unknown';
        const downloadSlug = slugify(name);
        const generatedDate = formatGeneratedDate();

        const metaRows = [
            ['Name', escapeHTML(name)],
            ['Version', escapeHTML(version)],
            ['Author', escapeHTML(author)],
            desc ? ['Description', escapeHTML(desc)] : null,
            meta.match ? ['Match', escapeHTML(Array.isArray(meta.match) ? meta.match.join(', ') : meta.match)] : null,
            meta.grant ? ['Grants', escapeHTML(Array.isArray(meta.grant) ? meta.grant.join(', ') : meta.grant)] : null,
        ].filter(Boolean);

        const metaTableHTML = metaRows.map(([label, val]) =>
            `<tr><td>${label}</td><td>${val}</td></tr>`
        ).join('');

        const bodyContent = `
<div class="header-bar">
    <h1>${escapeHTML(name)}</h1>
    <p class="subtitle">v${escapeHTML(version)} by ${escapeHTML(author)}</p>
</div>
<div class="container">
    <div class="card">
        <h2>Script Details</h2>
        <table class="meta-table">${metaTableHTML}</table>
    </div>

    <div class="card">
        <div class="card-header">
            <h2>Source Code</h2>
            <div class="btn-row" style="margin:0">
                <button type="button" class="btn btn-green" data-action="copy-code">Copy Code</button>
                <button type="button" class="btn btn-outline" data-action="download-script">Download .user.js</button>
            </div>
        </div>
        <pre class="code-block" id="codeBlock">${highlightJS(script.code || '')}</pre>
    </div>

    <div class="card">
        <h2>Install Instructions</h2>
        <ol style="padding-inline-start:20px;color:#a0a0a0;font-size:0.8125rem;line-height:2">
            <li>Install a userscript manager: <a href="https://www.tampermonkey.net/" target="_blank" rel="noopener noreferrer">Tampermonkey</a> or <a href="https://violentmonkey.github.io/" target="_blank" rel="noopener noreferrer">Violentmonkey</a></li>
            <li>Click the "Copy Code" button above</li>
            <li>Open your userscript manager dashboard</li>
            <li>Create a new script and paste the code</li>
            <li>Save the script (Ctrl+S)</li>
        </ol>
    </div>

    <div class="footer">
        Generated by ScriptVault &middot; ${generatedDate}
    </div>
</div>
<div class="copy-toast" id="copyToast" role="status" aria-live="polite" aria-atomic="true">Copied to clipboard!</div>`;

        const inlineJS = `
${buildClientHelpers()}
var _rawCode = ${JSON.stringify(script.code || '')};
var _downloadName = ${JSON.stringify(downloadSlug + '.user.js')};
document.addEventListener('DOMContentLoaded', function() {
    var copyButton = document.querySelector('[data-action="copy-code"]');
    var downloadButton = document.querySelector('[data-action="download-script"]');

    copyButton && copyButton.addEventListener('click', function() {
        svCopyText(_rawCode).then(function() {
            svShowToast('Copied to clipboard!');
        }).catch(function() {
            svShowToast('Copy failed');
        });
    });

    downloadButton && downloadButton.addEventListener('click', function() {
        svDownloadFile(_downloadName, _rawCode, 'text/javascript');
    });
});`;

        const html = baseHTMLTemplate({
            title: name + ' - ScriptVault Export',
            bodyContent,
            inlineJS,
        });

        downloadFile(downloadSlug + '.html', html);
        return html;
    }

    // =========================================
    // Module 2: Portfolio Page
    // =========================================
    function exportPortfolio(scriptIdsOrScripts) {
        let scripts;
        if (Array.isArray(scriptIdsOrScripts) && scriptIdsOrScripts.length > 0 && typeof scriptIdsOrScripts[0] === 'object') {
            scripts = scriptIdsOrScripts;
        } else if (Array.isArray(scriptIdsOrScripts)) {
            scripts = scriptIdsOrScripts.map(id => _state.getScript?.(id)).filter(Boolean);
        } else {
            scripts = _state.getAllScripts?.() || [];
        }

        if (scripts.length === 0) throw new Error('No scripts to export');
        const generatedDate = formatGeneratedDate();

        const scriptDataJSON = JSON.stringify(scripts.map((s, i) => {
            const meta = parseMetadata(s.code || '');
            const scriptName = s.name || meta.name || 'Untitled';
            return {
                idx: i,
                name: scriptName,
                slug: slugify(scriptName),
                description: s.description || meta.description || '',
                version: s.version || meta.version || '1.0',
                author: s.author || meta.author || '',
                category: s.category || 'general',
                code: s.code || '',
            };
        }));

        const cardsHTML = scripts.map((s, i) => {
            const meta = parseMetadata(s.code || '');
            const name = s.name || meta.name || 'Untitled';
            const desc = s.description || meta.description || '';
            const version = s.version || meta.version || '1.0';
            const cat = s.category || 'general';
            const preview = (s.code || '').split('\n').slice(0, 5).map(l => escapeHTML(l)).join('\n');

            return `<div class="card script-card" data-idx="${i}" data-name="${escapeHTML(name.toLowerCase())}" data-desc="${escapeHTML(desc.toLowerCase())}" data-cat="${escapeHTML(cat.toLowerCase())}">
    <div class="card-header">
        <div>
            <span class="card-title">${escapeHTML(name)}</span>
            <span class="badge badge-green">v${escapeHTML(version)}</span>
            <span class="badge badge-purple">${escapeHTML(cat)}</span>
        </div>
        <button type="button" class="toggle-btn" data-action="toggle-code" data-idx="${i}" aria-controls="code-${i}" aria-expanded="false">Show Code</button>
    </div>
    <div class="card-desc">${escapeHTML(desc)}</div>
    <pre class="code-block" id="code-${i}" hidden>${highlightJS(s.code || '')}</pre>
    <div class="btn-row">
        <button type="button" class="btn btn-green" data-action="copy-script" data-idx="${i}">Copy</button>
        <button type="button" class="btn btn-outline" data-action="download-script" data-idx="${i}">Download .user.js</button>
    </div>
</div>`;
        }).join('\n');

        const bodyContent = `
<div class="header-bar">
    <h1>Script Portfolio</h1>
    <p class="subtitle">${scripts.length} userscript${scripts.length !== 1 ? 's' : ''} &middot; Generated by ScriptVault</p>
</div>
<div class="container">
    <input type="search" class="search-box" id="searchBox" name="portfolioSearch" autocomplete="off" spellcheck="false" placeholder="Search scripts by name, description, or category...">
    <div id="scriptList">${cardsHTML}</div>
    <div class="footer">
        Generated by ScriptVault &middot; ${generatedDate}
    </div>
</div>
<div class="copy-toast" id="copyToast" role="status" aria-live="polite" aria-atomic="true">Copied to clipboard!</div>`;

        const inlineJS = `
${buildClientHelpers()}
var _scripts = ${scriptDataJSON};
function filterScripts() {
    var q = document.getElementById('searchBox').value.toLowerCase().trim();
    var cards = document.querySelectorAll('.script-card');
    cards.forEach(function(card) {
        var name = card.getAttribute('data-name') || '';
        var desc = card.getAttribute('data-desc') || '';
        var cat = card.getAttribute('data-cat') || '';
        card.hidden = !!(q && !name.includes(q) && !desc.includes(q) && !cat.includes(q));
    });
}
document.addEventListener('DOMContentLoaded', function() {
    var searchBox = document.getElementById('searchBox');
    searchBox && searchBox.addEventListener('input', filterScripts);

    document.querySelectorAll('[data-action="toggle-code"]').forEach(function(button) {
        button.addEventListener('click', function() {
            var idx = button.getAttribute('data-idx');
            var panel = document.getElementById('code-' + idx);
            if (!panel) return;
            panel.hidden = !panel.hidden;
            svSetToggleState(button, !panel.hidden, 'Show Code', 'Hide Code');
        });
    });

    document.querySelectorAll('[data-action="copy-script"]').forEach(function(button) {
        button.addEventListener('click', function() {
            var script = _scripts[Number(button.getAttribute('data-idx'))];
            if (!script) return;
            svCopyText(script.code).then(function() {
                svShowToast('Copied to clipboard!');
            }).catch(function() {
                svShowToast('Copy failed');
            });
        });
    });

    document.querySelectorAll('[data-action="download-script"]').forEach(function(button) {
        button.addEventListener('click', function() {
            var script = _scripts[Number(button.getAttribute('data-idx'))];
            if (!script) return;
            svDownloadFile(script.slug + '.user.js', script.code, 'text/javascript');
        });
    });
});`;

        const html = baseHTMLTemplate({
            title: 'Script Portfolio - ScriptVault',
            bodyContent,
            inlineJS,
        });

        downloadFile('script-portfolio.html', html);
        return html;
    }

    // =========================================
    // Module 3: Bookmarklet Generator
    // =========================================
    const BOOKMARKLET_SIZE_LIMIT = 2000; // characters — browser URL bar limit varies

    function generateBookmarklet(scriptOrId) {
        const script = (scriptOrId && typeof scriptOrId === 'object') ? scriptOrId : _state.getScript?.(scriptOrId);
        if (!script) throw new Error('Script not found');

        const meta = parseMetadata(script.code || '');
        const name = script.name || meta.name || 'Bookmarklet';
        const minified = minifyJS(script.code || '');
        const bookmarkletCode = 'javascript:void(' + encodeURIComponent('(function(){' + minified + '})()') + ')';
        const isTooLarge = bookmarkletCode.length > BOOKMARKLET_SIZE_LIMIT;

        return {
            name,
            code: bookmarkletCode,
            size: bookmarkletCode.length,
            isTooLarge,
            warning: isTooLarge
                ? `This bookmarklet is ${bookmarkletCode.length} characters (limit ~${BOOKMARKLET_SIZE_LIMIT}). It may not work in all browsers.`
                : null,
        };
    }

    /**
     * Show bookmarklet dialog in the dashboard.
     */
    function showBookmarkletDialog(scriptOrId) {
        injectStyles();
        const result = generateBookmarklet(scriptOrId);

        const overlay = document.createElement('div');
        overlay.className = 'se-overlay';
        _safeSetHtml(overlay, `
<div class="se-modal">
    <h3>Bookmarklet: ${escapeHTML(result.name)}</h3>
    <p>Drag the button below to your bookmarks bar to install:</p>
    <div style="text-align:center">
        <a class="se-bookmarklet-link" href="${escapeHTML(result.code)}" title="Drag me to your bookmarks bar">${escapeHTML(result.name)}</a>
    </div>
    <p style="font-size:0.75rem;color:var(--text-muted,#707070)">Size: ${result.size} characters</p>
    ${result.isTooLarge ? `<p class="se-warning">Warning: ${escapeHTML(result.warning)}</p>` : ''}
    <details style="margin-top:12px">
        <summary style="cursor:pointer;color:var(--accent-blue,#60a5fa);font-size:0.8125rem">View bookmarklet code</summary>
        <div class="se-preview" style="margin-top:8px">${escapeHTML(result.code)}</div>
    </details>
    <div class="se-btn-row">
        <button type="button" class="se-btn" id="se-bm-copy">Copy URL</button>
        <button type="button" class="se-btn primary" id="se-bm-close">Close</button>
    </div>
</div>`);
        document.body.appendChild(overlay);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
        overlay.querySelector('#se-bm-close').addEventListener('click', () => overlay.remove());
        overlay.querySelector('#se-bm-copy').addEventListener('click', async () => {
            await copyText(result.code);
            const btn = overlay.querySelector('#se-bm-copy');
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.textContent = 'Copy URL'; }, 1500);
        });

        return result;
    }

    // =========================================
    // Module 4: Install Page Generator
    // =========================================
    function generateInstallPage(scriptOrId) {
        const script = (scriptOrId && typeof scriptOrId === 'object') ? scriptOrId : _state.getScript?.(scriptOrId);
        if (!script) throw new Error('Script not found');

        const meta = parseMetadata(script.code || '');
        const name = script.name || meta.name || 'Untitled Script';
        const desc = script.description || meta.description || '';
        const version = script.version || meta.version || '1.0';
        const author = script.author || meta.author || 'Unknown';
        const downloadSlug = slugify(name);
        const generatedDate = formatGeneratedDate();

        const bodyContent = `
<div class="header-bar">
    <h1>Install ${escapeHTML(name)}</h1>
    <p class="subtitle">v${escapeHTML(version)} by ${escapeHTML(author)}</p>
</div>
<div class="container">
    <div class="card" style="text-align:center;padding:32px">
        <h2 style="margin-bottom:16px">One-Click Install</h2>
        <p style="margin-bottom:20px">Click the button below to install this userscript. You need a userscript manager like <a href="https://www.tampermonkey.net/" target="_blank" rel="noopener noreferrer">Tampermonkey</a> installed first.</p>
        <button type="button" class="btn btn-green" style="font-size:1rem;padding:14px 40px" data-action="install-script">Install Script</button>
    </div>

    <div class="card">
        <h2>About This Script</h2>
        ${desc ? `<p class="card-desc">${escapeHTML(desc)}</p>` : ''}
        <table class="meta-table">
            <tr><td>Version</td><td>${escapeHTML(version)}</td></tr>
            <tr><td>Author</td><td>${escapeHTML(author)}</td></tr>
            ${meta.match ? `<tr><td>Runs on</td><td>${escapeHTML(Array.isArray(meta.match) ? meta.match.join(', ') : meta.match)}</td></tr>` : ''}
            ${meta.license ? `<tr><td>License</td><td>${escapeHTML(meta.license)}</td></tr>` : ''}
        </table>
    </div>

    <div class="card" style="text-align:center">
        <h2 style="margin-bottom:12px">Share</h2>
        <p style="margin-bottom:16px;color:#a0a0a0;font-size:0.8125rem">Copy this page's link to open it on another device.</p>
        <button type="button" class="btn btn-outline" data-action="copy-link">Copy Page Link</button>
    </div>

    <div class="card">
        <div class="card-header">
            <h2>Source Code</h2>
            <button type="button" class="toggle-btn" data-action="toggle-source" aria-controls="sourceCode" aria-expanded="false">Show</button>
        </div>
        <pre class="code-block" id="sourceCode" hidden>${highlightJS(script.code || '')}</pre>
        <div class="btn-row">
            <button type="button" class="btn btn-green" data-action="copy-code">Copy Code</button>
            <button type="button" class="btn btn-outline" data-action="download-script">Download .user.js</button>
        </div>
    </div>

    <div class="footer">
        Generated by ScriptVault &middot; ${generatedDate}
    </div>
</div>
<div class="copy-toast" id="copyToast" role="status" aria-live="polite" aria-atomic="true">Copied to clipboard!</div>`;

        const inlineJS = `
${buildClientHelpers()}
var _rawCode = ${JSON.stringify(script.code || '')};
var _scriptName = ${JSON.stringify(downloadSlug)};
document.addEventListener('DOMContentLoaded', function() {
    var installButton = document.querySelector('[data-action="install-script"]');
    var toggleButton = document.querySelector('[data-action="toggle-source"]');
    var copyButton = document.querySelector('[data-action="copy-code"]');
    var downloadButton = document.querySelector('[data-action="download-script"]');
    var copyLinkButton = document.querySelector('[data-action="copy-link"]');

    installButton && installButton.addEventListener('click', function() {
        svDownloadFile(_scriptName + '.user.js', _rawCode, 'text/javascript');
    });

    toggleButton && toggleButton.addEventListener('click', function() {
        var panel = document.getElementById('sourceCode');
        if (!panel) return;
        panel.hidden = !panel.hidden;
        svSetToggleState(toggleButton, !panel.hidden, 'Show', 'Hide');
    });

    copyButton && copyButton.addEventListener('click', function() {
        svCopyText(_rawCode).then(function() {
            svShowToast('Copied to clipboard!');
        }).catch(function() {
            svShowToast('Copy failed');
        });
    });

    downloadButton && downloadButton.addEventListener('click', function() {
        svDownloadFile(_scriptName + '.user.js', _rawCode, 'text/javascript');
    });

    copyLinkButton && copyLinkButton.addEventListener('click', function() {
        svCopyText(location.href).then(function() {
            svShowToast('Link copied!');
        }).catch(function() {
            svShowToast('Copy failed');
        });
    });
});`;

        const html = baseHTMLTemplate({
            title: 'Install ' + name + ' - ScriptVault',
            bodyContent,
            inlineJS,
        });

        downloadFile(downloadSlug + '-install.html', html);
        return html;
    }

    // =========================================
    // Public API
    // =========================================
    return {
        /**
         * Initialize the export module.
         * @param {object} [options]
         * @param {function} options.getScript - fn(id) => script object
         * @param {function} options.getAllScripts - fn() => script[]
         */
        init(options = {}) {
            _state.getScript = options.getScript || null;
            _state.getAllScripts = options.getAllScripts || null;
            injectStyles();
        },

        /**
         * Export a single script as a self-contained HTML file.
         * @param {string|object} scriptId - Script ID or script object
         * @returns {string} Generated HTML
         */
        exportAsHTML(scriptId) {
            return exportAsHTML(scriptId);
        },

        /**
         * Export multiple scripts as a portfolio HTML page.
         * @param {Array<string|object>} scriptIds - Array of script IDs or script objects
         * @returns {string} Generated HTML
         */
        exportPortfolio(scriptIds) {
            return exportPortfolio(scriptIds);
        },

        /**
         * Generate a bookmarklet from a script.
         * @param {string|object} scriptId - Script ID or script object
         * @returns {object} { name, code, size, isTooLarge, warning }
         */
        generateBookmarklet(scriptId) {
            return generateBookmarklet(scriptId);
        },

        /**
         * Show the bookmarklet dialog (if running in dashboard).
         * @param {string|object} scriptId
         * @returns {object} bookmarklet result
         */
        showBookmarkletDialog(scriptId) {
            return showBookmarkletDialog(scriptId);
        },

        /**
         * Generate and download an install page HTML file.
         * @param {string|object} scriptId - Script ID or script object
         * @returns {string} Generated HTML
         */
        generateInstallPage(scriptId) {
            return generateInstallPage(scriptId);
        },

        /**
         * Destroy and clean up.
         */
        destroy() {
            if (_state.styleEl) { _state.styleEl.remove(); _state.styleEl = null; }
            _state.getScript = null;
            _state.getAllScripts = null;
        }
    };
})();
