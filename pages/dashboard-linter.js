/**
 * ScriptVault Advanced Lint Rules with Auto-Fix
 * 20+ lint rules covering deprecated APIs, security, metadata,
 * code quality, and performance. One-click auto-fix with diff preview.
 */
const AdvancedLinter = (() => {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  Constants                                                          */
  /* ------------------------------------------------------------------ */

  const STYLE_ID = 'sv-linter-styles';
  const SEVERITY = { ERROR: 'error', WARNING: 'warning', INFO: 'info' };

  /* ------------------------------------------------------------------ */
  /*  State                                                              */
  /* ------------------------------------------------------------------ */

  let _container = null;
  let _styleEl = null;
  let _issues = [];
  let _currentCode = '';
  let _panelEl = null;
  let _onJumpToLine = null;
  let _onApplyFix = null;

  /* ------------------------------------------------------------------ */
  /*  CSS                                                                */
  /* ------------------------------------------------------------------ */

  const STYLES = `
.sv-lint-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-body, #1a1a1a);
  color: var(--text-primary, #e0e0e0);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
.sv-lint-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-color, #404040);
  flex-wrap: wrap;
}
.sv-lint-toolbar-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary, #e0e0e0);
  margin-right: auto;
}
.sv-lint-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 11px;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
}
.sv-lint-badge-error { background: var(--accent-red, #f87171); }
.sv-lint-badge-warning { background: var(--accent-yellow, #fbbf24); color: #1a1a1a; }
.sv-lint-badge-info { background: var(--accent-blue, #60a5fa); }
.sv-lint-btn {
  padding: 5px 12px;
  border: 1px solid var(--border-color, #404040);
  border-radius: 6px;
  background: var(--bg-input, #333);
  color: var(--text-primary, #e0e0e0);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.sv-lint-btn:hover {
  background: var(--bg-row-hover, #333);
  border-color: var(--accent-green, #4ade80);
}
.sv-lint-btn-fix {
  background: var(--accent-green-dark, #22c55e);
  color: #fff;
  border-color: var(--accent-green-dark, #22c55e);
}
.sv-lint-btn-fix:hover {
  background: var(--accent-green, #4ade80);
  border-color: var(--accent-green, #4ade80);
  color: #1a1a1a;
}
.sv-lint-btn-fixall {
  background: var(--accent-blue, #60a5fa);
  color: #fff;
  border-color: var(--accent-blue, #60a5fa);
}
.sv-lint-btn-fixall:hover {
  opacity: 0.85;
}
.sv-lint-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px 0;
}
.sv-lint-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 14px;
  cursor: pointer;
  border-bottom: 1px solid var(--border-color, #404040);
  transition: background 0.12s;
}
.sv-lint-item:hover {
  background: var(--bg-row-hover, #333);
}
.sv-lint-severity {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-top: 5px;
}
.sv-lint-severity-error { background: var(--accent-red, #f87171); }
.sv-lint-severity-warning { background: var(--accent-yellow, #fbbf24); }
.sv-lint-severity-info { background: var(--accent-blue, #60a5fa); }
.sv-lint-item-body {
  flex: 1;
  min-width: 0;
}
.sv-lint-item-msg {
  font-size: 13px;
  color: var(--text-primary, #e0e0e0);
  line-height: 1.4;
}
.sv-lint-item-loc {
  font-size: 11px;
  color: var(--text-muted, #707070);
  margin-top: 2px;
}
.sv-lint-item-rule {
  font-size: 10px;
  color: var(--text-secondary, #a0a0a0);
  background: var(--bg-input, #333);
  padding: 1px 6px;
  border-radius: 3px;
  margin-top: 3px;
  display: inline-block;
}
.sv-lint-item-fix {
  flex-shrink: 0;
  padding: 3px 8px;
  font-size: 11px;
  border-radius: 4px;
  background: var(--accent-green-dark, #22c55e);
  color: #fff;
  border: none;
  cursor: pointer;
  transition: opacity 0.15s;
}
.sv-lint-item-fix:hover { opacity: 0.8; }
.sv-lint-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--text-muted, #707070);
  font-size: 13px;
  text-align: center;
}
.sv-lint-empty-icon {
  font-size: 36px;
  margin-bottom: 10px;
  opacity: 0.5;
}
.sv-lint-diff-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}
.sv-lint-diff-modal {
  background: var(--bg-body, #1a1a1a);
  border: 1px solid var(--border-color, #404040);
  border-radius: 10px;
  width: 680px;
  max-width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.sv-lint-diff-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color, #404040);
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #e0e0e0);
}
.sv-lint-diff-body {
  flex: 1;
  overflow: auto;
  padding: 12px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
}
.sv-lint-diff-line-add {
  background: rgba(74, 222, 128, 0.15);
  color: var(--accent-green, #4ade80);
}
.sv-lint-diff-line-remove {
  background: rgba(248, 113, 113, 0.15);
  color: var(--accent-red, #f87171);
}
.sv-lint-diff-line-ctx {
  color: var(--text-secondary, #a0a0a0);
}
.sv-lint-diff-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 16px;
  border-top: 1px solid var(--border-color, #404040);
}
.sv-lint-filter-group {
  display: flex;
  gap: 4px;
}
.sv-lint-filter-btn {
  padding: 3px 8px;
  font-size: 11px;
  border-radius: 4px;
  border: 1px solid var(--border-color, #404040);
  background: transparent;
  color: var(--text-secondary, #a0a0a0);
  cursor: pointer;
  transition: all 0.15s;
}
.sv-lint-filter-btn.active {
  background: var(--bg-row-selected, #2d3a4d);
  color: var(--text-primary, #e0e0e0);
  border-color: var(--accent-blue, #60a5fa);
}
`;

  /* ------------------------------------------------------------------ */
  /*  Lint Rules                                                         */
  /* ------------------------------------------------------------------ */

  const DEPRECATED_APIS = {
    'GM_log': { replacement: 'console.log', grant: null },
    'GM_xmlhttpRequest': { replacement: 'GM.xmlHttpRequest', grant: 'GM.xmlHttpRequest' },
    'GM_getValue': { replacement: 'GM.getValue', grant: 'GM.getValue' },
    'GM_setValue': { replacement: 'GM.setValue', grant: 'GM.setValue' },
    'GM_deleteValue': { replacement: 'GM.deleteValue', grant: 'GM.deleteValue' },
    'GM_listValues': { replacement: 'GM.listValues', grant: 'GM.listValues' },
    'GM_getResourceURL': { replacement: 'GM.getResourceUrl', grant: 'GM.getResourceUrl' },
    'GM_openInTab': { replacement: 'GM.openInTab', grant: 'GM.openInTab' },
    'GM_registerMenuCommand': { replacement: 'GM.registerMenuCommand', grant: 'GM.registerMenuCommand' },
    'GM_setClipboard': { replacement: 'GM.setClipboard', grant: 'GM.setClipboard' },
    'GM_notification': { replacement: 'GM.notification', grant: 'GM.notification' },
    'GM_addStyle': { replacement: 'GM_addStyle (keep or use DOM)', grant: 'GM_addStyle' },
  };

  const DEPRECATED_META_KEYS = [
    '@namespace', '@installURL', '@contributionAmount', '@contributionURL',
  ];

  const GM_API_PATTERN = /\b(GM[_.]\w+)\b/g;

  const KNOWN_GM_APIS = [
    'GM.getValue', 'GM.setValue', 'GM.deleteValue', 'GM.listValues',
    'GM.xmlHttpRequest', 'GM.openInTab', 'GM.notification', 'GM.setClipboard',
    'GM.getResourceUrl', 'GM.registerMenuCommand', 'GM.info',
    'GM_getValue', 'GM_setValue', 'GM_deleteValue', 'GM_listValues',
    'GM_xmlhttpRequest', 'GM_openInTab', 'GM_notification', 'GM_setClipboard',
    'GM_getResourceURL', 'GM_registerMenuCommand', 'GM_info', 'GM_log',
    'GM_addStyle', 'GM_addElement', 'GM_download', 'GM_getTab',
    'GM_saveTab', 'GM_getTabs', 'GM_unregisterMenuCommand',
    'unsafeWindow', 'window.close', 'window.focus', 'window.onurlchange',
  ];

  function _parseMetadata(code) {
    const meta = { grants: [], matches: [], keys: {}, raw: '', startLine: -1, endLine: -1, lines: [] };
    const lines = code.split('\n');
    let inMeta = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '// ==UserScript==') { inMeta = true; meta.startLine = i; continue; }
      if (line === '// ==/UserScript==') { meta.endLine = i; break; }
      if (!inMeta) continue;
      meta.lines.push({ lineNum: i, text: lines[i] });
      const m = line.match(/^\/\/\s+@(\S+)\s*(.*)?$/);
      if (m) {
        const key = m[1];
        const val = (m[2] || '').trim();
        if (key === 'grant') meta.grants.push({ value: val, line: i });
        else if (key === 'match' || key === 'include') meta.matches.push({ value: val, line: i });
        if (!meta.keys[key]) meta.keys[key] = [];
        meta.keys[key].push({ value: val, line: i });
      }
    }
    meta.raw = meta.startLine >= 0 && meta.endLine >= 0
      ? lines.slice(meta.startLine, meta.endLine + 1).join('\n')
      : '';
    return meta;
  }

  function _getScriptBody(code, meta) {
    if (meta.endLine < 0) return code;
    return code.split('\n').slice(meta.endLine + 1).join('\n');
  }

  function _findUsedGMAPIs(body) {
    const used = new Set();
    const re = /\b(GM[_.]\w+)\b/g;
    let m;
    while ((m = re.exec(body)) !== null) {
      used.add(m[1]);
    }
    if (/\bunsafeWindow\b/.test(body)) used.add('unsafeWindow');
    return used;
  }

  /* --- Individual Rules --- */

  const RULES = [
    {
      id: 'deprecated-api',
      name: 'Deprecated API Usage',
      severity: SEVERITY.WARNING,
      fixable: true,
      check(code, meta) {
        const body = _getScriptBody(code, meta);
        const lines = body.split('\n');
        const bodyStart = meta.endLine >= 0 ? meta.endLine + 1 : 0;
        const issues = [];
        for (let i = 0; i < lines.length; i++) {
          for (const [api, info] of Object.entries(DEPRECATED_APIS)) {
            const re = new RegExp(`\\b${api.replace('.', '\\.')}\\b`, 'g');
            if (re.test(lines[i])) {
              issues.push({
                line: bodyStart + i + 1,
                message: `"${api}" is deprecated. Use "${info.replacement}" instead.`,
                fixData: { api, replacement: info.replacement },
              });
            }
          }
        }
        return issues;
      },
      fix(code, fixData) {
        const { api, replacement } = fixData;
        if (replacement.includes('(keep')) return code;
        const re = new RegExp(`\\b${api.replace('.', '\\.')}\\b`, 'g');
        return code.replace(re, replacement);
      },
    },
    {
      id: 'missing-grant',
      name: 'Missing @grant for Used API',
      severity: SEVERITY.ERROR,
      fixable: true,
      check(code, meta) {
        const body = _getScriptBody(code, meta);
        const used = _findUsedGMAPIs(body);
        const granted = new Set(meta.grants.map(g => g.value));
        if (granted.has('none') && used.size > 0) {
          return [{ line: meta.grants.find(g => g.value === 'none')?.line + 1 || 1, message: '@grant none declared but GM APIs are used.', fixData: { needed: [...used] } }];
        }
        const issues = [];
        for (const api of used) {
          const grantName = DEPRECATED_APIS[api]?.grant || api;
          if (!granted.has(grantName) && !granted.has(api)) {
            issues.push({
              line: meta.endLine >= 0 ? meta.endLine + 1 : 1,
              message: `Missing @grant ${grantName} for used API "${api}".`,
              fixData: { grantName },
            });
          }
        }
        return issues;
      },
      fix(code, fixData) {
        if (fixData.grantName) {
          const insertLine = `// @grant        ${fixData.grantName}`;
          return code.replace('// ==/UserScript==', insertLine + '\n// ==/UserScript==');
        }
        return code;
      },
    },
    {
      id: 'unused-grant',
      name: 'Unused @grant Declaration',
      severity: SEVERITY.WARNING,
      fixable: true,
      check(code, meta) {
        const body = _getScriptBody(code, meta);
        const used = _findUsedGMAPIs(body);
        const issues = [];
        for (const grant of meta.grants) {
          if (grant.value === 'none') continue;
          const isUsed = used.has(grant.value) || [...used].some(u => {
            const dep = DEPRECATED_APIS[u];
            return dep && dep.grant === grant.value;
          });
          if (!isUsed) {
            issues.push({
              line: grant.line + 1,
              message: `@grant "${grant.value}" is declared but never used.`,
              fixData: { grantValue: grant.value, grantLine: grant.line },
            });
          }
        }
        return issues;
      },
      fix(code, fixData) {
        const lines = code.split('\n');
        const removals = Array.isArray(fixData) ? fixData : [fixData];
        // Sort by grantLine descending so splicing doesn't corrupt later indices
        removals.sort((a, b) => b.grantLine - a.grantLine);
        for (const fd of removals) {
          const line = lines[fd.grantLine];
          if (line && line.includes(`@grant`) && line.includes(fd.grantValue)) {
            lines.splice(fd.grantLine, 1);
          }
        }
        return lines.join('\n');
      },
    },
    {
      id: 'invalid-match',
      name: 'Invalid @match Pattern',
      severity: SEVERITY.ERROR,
      fixable: false,
      check(code, meta) {
        const issues = [];
        const validSchemes = /^(https?|\*|file|ftp):\/\//;
        for (const match of meta.matches) {
          if (!validSchemes.test(match.value) && match.value !== '<all_urls>') {
            issues.push({
              line: match.line + 1,
              message: `Invalid @match pattern: "${match.value}". Must start with http://, https://, *, file://, or ftp://.`,
            });
          }
        }
        return issues;
      },
    },
    {
      id: 'broad-match',
      name: 'Overly Broad @match Pattern',
      severity: SEVERITY.WARNING,
      fixable: false,
      check(code, meta) {
        const broad = ['*://*/*', '<all_urls>', 'http://*/*', 'https://*/*'];
        const issues = [];
        for (const match of meta.matches) {
          if (broad.includes(match.value)) {
            issues.push({
              line: match.line + 1,
              message: `Overly broad @match "${match.value}". Consider restricting to specific domains.`,
            });
          }
        }
        return issues;
      },
    },
    {
      id: 'missing-version',
      name: 'Missing @version',
      severity: SEVERITY.WARNING,
      fixable: true,
      check(code, meta) {
        if (!meta.keys.version) {
          return [{ line: meta.endLine >= 0 ? meta.endLine + 1 : 1, message: 'Missing @version in metadata.', fixData: {} }];
        }
        return [];
      },
      fix(code) {
        return code.replace('// ==/UserScript==', '// @version      1.0.0\n// ==/UserScript==');
      },
    },
    {
      id: 'missing-description',
      name: 'Missing @description',
      severity: SEVERITY.INFO,
      fixable: true,
      check(code, meta) {
        if (!meta.keys.description) {
          return [{ line: meta.endLine >= 0 ? meta.endLine + 1 : 1, message: 'Missing @description in metadata.', fixData: {} }];
        }
        return [];
      },
      fix(code) {
        return code.replace('// ==/UserScript==', '// @description  TODO: Add description\n// ==/UserScript==');
      },
    },
    {
      id: 'missing-author',
      name: 'Missing @author',
      severity: SEVERITY.INFO,
      fixable: true,
      check(code, meta) {
        if (!meta.keys.author) {
          return [{ line: meta.endLine >= 0 ? meta.endLine + 1 : 1, message: 'Missing @author in metadata.', fixData: {} }];
        }
        return [];
      },
      fix(code) {
        return code.replace('// ==/UserScript==', '// @author       Anonymous\n// ==/UserScript==');
      },
    },
    {
      id: 'duplicate-match',
      name: 'Duplicate @match Pattern',
      severity: SEVERITY.WARNING,
      fixable: true,
      check(code, meta) {
        const seen = new Map();
        const issues = [];
        for (const match of meta.matches) {
          if (seen.has(match.value)) {
            issues.push({
              line: match.line + 1,
              message: `Duplicate @match pattern: "${match.value}".`,
              fixData: { matchLine: match.line },
            });
          }
          seen.set(match.value, match.line);
        }
        return issues;
      },
      fix(code, fixData) {
        const lines = code.split('\n');
        if (lines[fixData.matchLine] && /@match|@include/.test(lines[fixData.matchLine])) {
          lines.splice(fixData.matchLine, 1);
        }
        return lines.join('\n');
      },
    },
    {
      id: 'empty-script',
      name: 'Empty Script Body',
      severity: SEVERITY.WARNING,
      fixable: false,
      check(code, meta) {
        const body = _getScriptBody(code, meta).trim();
        if (!body) {
          return [{ line: meta.endLine >= 0 ? meta.endLine + 2 : 1, message: 'Script body is empty.' }];
        }
        return [];
      },
    },
    {
      id: 'unreachable-code',
      name: 'Unreachable Code After Return',
      severity: SEVERITY.WARNING,
      fixable: false,
      check(code, meta) {
        const body = _getScriptBody(code, meta);
        const lines = body.split('\n');
        const bodyStart = meta.endLine >= 0 ? meta.endLine + 1 : 0;
        const issues = [];
        for (let i = 0; i < lines.length - 1; i++) {
          const trimmed = lines[i].trim();
          if (/^return\b/.test(trimmed) && !trimmed.endsWith('{') && !trimmed.endsWith(',')) {
            const next = lines[i + 1]?.trim();
            if (next && next !== '}' && next !== '' && !next.startsWith('//') && !next.startsWith('/*') && next !== 'break;' && next !== 'case ') {
              issues.push({
                line: bodyStart + i + 2,
                message: 'Potentially unreachable code after return statement.',
              });
            }
          }
        }
        return issues;
      },
    },
    {
      id: 'console-log-production',
      name: 'Console.log in Production',
      severity: SEVERITY.INFO,
      fixable: false,
      check(code, meta) {
        const body = _getScriptBody(code, meta);
        const lines = body.split('\n');
        const bodyStart = meta.endLine >= 0 ? meta.endLine + 1 : 0;
        const issues = [];
        for (let i = 0; i < lines.length; i++) {
          if (/\bconsole\.(log|debug|trace)\s*\(/.test(lines[i]) && !/\/\//.test(lines[i].split('console')[0])) {
            issues.push({
              line: bodyStart + i + 1,
              message: 'console.log() found. Consider removing for production.',
            });
          }
        }
        return issues;
      },
    },
    {
      id: 'hardcoded-secrets',
      name: 'Hardcoded API Keys/Tokens',
      severity: SEVERITY.ERROR,
      fixable: false,
      check(code, meta) {
        const body = _getScriptBody(code, meta);
        const lines = body.split('\n');
        const bodyStart = meta.endLine >= 0 ? meta.endLine + 1 : 0;
        const patterns = [
          { re: /(['"`])(?:sk-[a-zA-Z0-9]{20,})\1/, name: 'OpenAI API key' },
          { re: /(['"`])(?:AIza[0-9A-Za-z_-]{35})\1/, name: 'Google API key' },
          { re: /(['"`])(?:ghp_[a-zA-Z0-9]{36})\1/, name: 'GitHub token' },
          { re: /(['"`])(?:glpat-[a-zA-Z0-9_-]{20,})\1/, name: 'GitLab token' },
          { re: /\b(api[_-]?key|api[_-]?secret|auth[_-]?token|access[_-]?token|secret[_-]?key)\s*[:=]\s*(['"`])[a-zA-Z0-9_-]{16,}\2/i, name: 'Potential secret' },
        ];
        const issues = [];
        for (let i = 0; i < lines.length; i++) {
          for (const pat of patterns) {
            if (pat.re.test(lines[i])) {
              issues.push({
                line: bodyStart + i + 1,
                message: `Possible hardcoded ${pat.name} detected. Store secrets securely.`,
              });
            }
          }
        }
        return issues;
      },
    },
    {
      id: 'eval-usage',
      name: 'eval() Usage',
      severity: SEVERITY.WARNING,
      fixable: false,
      check(code, meta) {
        const body = _getScriptBody(code, meta);
        const lines = body.split('\n');
        const bodyStart = meta.endLine >= 0 ? meta.endLine + 1 : 0;
        const issues = [];
        for (let i = 0; i < lines.length; i++) {
          if (/\beval\s*\(/.test(lines[i])) {
            issues.push({ line: bodyStart + i + 1, message: 'eval() usage detected. This is a security risk.' });
          }
        }
        return issues;
      },
    },
    {
      id: 'document-write',
      name: 'document.write() Usage',
      severity: SEVERITY.WARNING,
      fixable: false,
      check(code, meta) {
        const body = _getScriptBody(code, meta);
        const lines = body.split('\n');
        const bodyStart = meta.endLine >= 0 ? meta.endLine + 1 : 0;
        const issues = [];
        for (let i = 0; i < lines.length; i++) {
          if (/\bdocument\.write(ln)?\s*\(/.test(lines[i])) {
            issues.push({ line: bodyStart + i + 1, message: 'document.write() can break the page. Use DOM methods instead.' });
          }
        }
        return issues;
      },
    },
    {
      id: 'innerhtml-xss',
      name: 'innerHTML with Variable Content (XSS Risk)',
      severity: SEVERITY.WARNING,
      fixable: false,
      check(code, meta) {
        const body = _getScriptBody(code, meta);
        const lines = body.split('\n');
        const bodyStart = meta.endLine >= 0 ? meta.endLine + 1 : 0;
        const issues = [];
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (/\.innerHTML\s*=/.test(line) && /\$\{|[\+]\s*\w/.test(line)) {
            issues.push({ line: bodyStart + i + 1, message: 'innerHTML with variable content may allow XSS. Use textContent or sanitize.' });
          }
        }
        return issues;
      },
    },
    {
      id: 'async-no-catch',
      name: 'Missing Error Handling in Async Functions',
      severity: SEVERITY.WARNING,
      fixable: false,
      check(code, meta) {
        const body = _getScriptBody(code, meta);
        const issues = [];
        const bodyStart = meta.endLine >= 0 ? meta.endLine + 1 : 0;
        const asyncRe = /\basync\s+function\b|\basync\s*\(|\basync\s+\w+\s*=>/g;
        const lines = body.split('\n');
        let m;
        while ((m = asyncRe.exec(body)) !== null) {
          const before = body.substring(0, m.index);
          const lineNum = before.split('\n').length;
          // Look ahead for try/catch within the next ~30 lines
          const snippet = lines.slice(lineNum - 1, lineNum + 30).join('\n');
          if (!/\btry\s*\{/.test(snippet) && !/\.catch\s*\(/.test(snippet)) {
            issues.push({ line: bodyStart + lineNum, message: 'Async function without try/catch or .catch() error handling.' });
          }
        }
        return issues;
      },
    },
    {
      id: 'large-script',
      name: 'Large Script Warning',
      severity: SEVERITY.INFO,
      fixable: false,
      check(code) {
        const lineCount = code.split('\n').length;
        if (lineCount > 1000) {
          return [{ line: 1, message: `Script has ${lineCount} lines. Consider modularizing.` }];
        }
        return [];
      },
    },
    {
      id: 'missing-updateurl',
      name: 'Missing @updateURL',
      severity: SEVERITY.INFO,
      fixable: false,
      check(code, meta) {
        if (meta.keys.version && !meta.keys.updateURL && !meta.keys.downloadURL) {
          return [{ line: meta.endLine >= 0 ? meta.endLine + 1 : 1, message: 'Script has @version but no @updateURL or @downloadURL for auto-updates.' }];
        }
        return [];
      },
    },
    {
      id: 'deprecated-meta-key',
      name: 'Deprecated Metadata Key',
      severity: SEVERITY.INFO,
      fixable: true,
      check(code, meta) {
        const issues = [];
        for (const depKey of DEPRECATED_META_KEYS) {
          const key = depKey.replace('@', '');
          if (meta.keys[key]) {
            for (const entry of meta.keys[key]) {
              issues.push({
                line: entry.line + 1,
                message: `${depKey} is deprecated and may be ignored by managers.`,
                fixData: { metaLine: entry.line },
              });
            }
          }
        }
        return issues;
      },
      fix(code, fixData) {
        const lines = code.split('\n');
        lines.splice(fixData.metaLine, 1);
        return lines.join('\n');
      },
    },
    {
      id: 'no-use-strict',
      name: 'Missing "use strict"',
      severity: SEVERITY.INFO,
      fixable: true,
      check(code, meta) {
        const body = _getScriptBody(code, meta);
        if (body.trim() && !/'use strict'|"use strict"/.test(body.split('\n').slice(0, 5).join('\n'))) {
          return [{ line: meta.endLine >= 0 ? meta.endLine + 2 : 1, message: 'Consider adding "use strict" at the top of the script body.', fixData: {} }];
        }
        return [];
      },
      fix(code, _fixData, meta) {
        if (meta.endLine >= 0) {
          const lines = code.split('\n');
          lines.splice(meta.endLine + 1, 0, "'use strict';", '');
          return lines.join('\n');
        }
        return "'use strict';\n" + code;
      },
    },
  ];

  /* ------------------------------------------------------------------ */
  /*  Core Lint Engine                                                   */
  /* ------------------------------------------------------------------ */

  function lint(code) {
    const meta = _parseMetadata(code);
    const allIssues = [];
    for (const rule of RULES) {
      try {
        const found = rule.check(code, meta);
        for (const issue of found) {
          allIssues.push({
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            fixable: !!rule.fixable,
            line: issue.line,
            message: issue.message,
            fixData: issue.fixData || null,
          });
        }
      } catch (e) {
        console.warn(`[AdvancedLinter] Rule "${rule.id}" threw:`, e);
      }
    }
    allIssues.sort((a, b) => {
      const sev = { error: 0, warning: 1, info: 2 };
      return (sev[a.severity] - sev[b.severity]) || (a.line - b.line);
    });
    return allIssues;
  }

  function autoFix(code, ruleId, fixData) {
    const rule = RULES.find(r => r.id === ruleId);
    if (!rule || !rule.fix) return code;
    const meta = _parseMetadata(code);
    return rule.fix(code, fixData, meta);
  }

  function autoFixAll(code) {
    let result = code;
    const maxPasses = 5;
    for (let pass = 0; pass < maxPasses; pass++) {
      const issues = lint(result).filter(i => i.fixable);
      if (!issues.length) break;
      // Apply fixes one at a time (re-lint after each since line numbers shift)
      const issue = issues[0];
      const rule = RULES.find(r => r.id === issue.ruleId);
      if (rule && rule.fix) {
        const meta = _parseMetadata(result);
        const before = result;
        result = rule.fix(result, issue.fixData, meta);
        if (result === before) break; // Prevent infinite loop
      }
    }
    return result;
  }

  function getRules() {
    return RULES.map(r => ({ id: r.id, name: r.name, severity: r.severity, fixable: !!r.fixable }));
  }

  /* ------------------------------------------------------------------ */
  /*  Diff Preview                                                       */
  /* ------------------------------------------------------------------ */

  function _showDiffPreview(original, fixed, onAccept) {
    const origLines = original.split('\n');
    const fixedLines = fixed.split('\n');
    const overlay = document.createElement('div');
    overlay.className = 'sv-lint-diff-overlay';
    const modal = document.createElement('div');
    modal.className = 'sv-lint-diff-modal';

    const header = document.createElement('div');
    header.className = 'sv-lint-diff-header';
    header.textContent = 'Fix Preview';

    const body = document.createElement('div');
    body.className = 'sv-lint-diff-body';

    // Simple LCS-based diff
    const diff = _computeDiff(origLines, fixedLines);
    for (const entry of diff) {
      const div = document.createElement('div');
      if (entry.type === 'remove') {
        div.className = 'sv-lint-diff-line-remove';
        div.textContent = '- ' + entry.text;
      } else if (entry.type === 'add') {
        div.className = 'sv-lint-diff-line-add';
        div.textContent = '+ ' + entry.text;
      } else {
        div.className = 'sv-lint-diff-line-ctx';
        div.textContent = '  ' + entry.text;
      }
      body.appendChild(div);
    }

    const footer = document.createElement('div');
    footer.className = 'sv-lint-diff-footer';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'sv-lint-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => overlay.remove();
    const applyBtn = document.createElement('button');
    applyBtn.className = 'sv-lint-btn sv-lint-btn-fix';
    applyBtn.textContent = 'Apply Fix';
    applyBtn.onclick = () => { overlay.remove(); onAccept(); };
    footer.append(cancelBtn, applyBtn);

    modal.append(header, body, footer);
    overlay.appendChild(modal);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }

  function _computeDiff(a, b) {
    // Myers-like simple diff
    const result = [];
    const n = a.length, m = b.length;
    // Build LCS table
    const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
    // Backtrack
    let i = n, j = m;
    const ops = [];
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
        ops.push({ type: 'ctx', text: a[i - 1] }); i--; j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        ops.push({ type: 'add', text: b[j - 1] }); j--;
      } else {
        ops.push({ type: 'remove', text: a[i - 1] }); i--;
      }
    }
    ops.reverse();
    // Collapse unchanged regions
    let ctxRun = 0;
    const collapsed = [];
    for (const op of ops) {
      if (op.type === 'ctx') {
        ctxRun++;
        collapsed.push(op);
      } else {
        // Show context around changes
        ctxRun = 0;
        collapsed.push(op);
      }
    }
    return collapsed;
  }

  /* ------------------------------------------------------------------ */
  /*  Panel UI                                                           */
  /* ------------------------------------------------------------------ */

  function _injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    _styleEl = document.createElement('style');
    _styleEl.id = STYLE_ID;
    _styleEl.textContent = STYLES;
    document.head.appendChild(_styleEl);
  }

  function _buildPanel() {
    _panelEl = document.createElement('div');
    _panelEl.className = 'sv-lint-panel';
    _container.appendChild(_panelEl);
    _renderPanel();
  }

  function _renderPanel() {
    if (!_panelEl) return;
    const errors = _issues.filter(i => i.severity === 'error').length;
    const warnings = _issues.filter(i => i.severity === 'warning').length;
    const infos = _issues.filter(i => i.severity === 'info').length;
    const fixable = _issues.filter(i => i.fixable).length;

    _panelEl.innerHTML = '';

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'sv-lint-toolbar';
    const title = document.createElement('span');
    title.className = 'sv-lint-toolbar-title';
    title.textContent = 'Lint Issues';
    toolbar.appendChild(title);

    if (errors > 0) {
      const b = document.createElement('span');
      b.className = 'sv-lint-badge sv-lint-badge-error';
      b.textContent = errors;
      b.title = `${errors} error(s)`;
      toolbar.appendChild(b);
    }
    if (warnings > 0) {
      const b = document.createElement('span');
      b.className = 'sv-lint-badge sv-lint-badge-warning';
      b.textContent = warnings;
      b.title = `${warnings} warning(s)`;
      toolbar.appendChild(b);
    }
    if (infos > 0) {
      const b = document.createElement('span');
      b.className = 'sv-lint-badge sv-lint-badge-info';
      b.textContent = infos;
      b.title = `${infos} info(s)`;
      toolbar.appendChild(b);
    }

    if (fixable > 0) {
      const fixAllBtn = document.createElement('button');
      fixAllBtn.className = 'sv-lint-btn sv-lint-btn-fixall';
      fixAllBtn.textContent = `Fix All (${fixable})`;
      fixAllBtn.onclick = () => {
        const fixed = autoFixAll(_currentCode);
        if (fixed !== _currentCode) {
          _showDiffPreview(_currentCode, fixed, () => {
            if (_onApplyFix) _onApplyFix(fixed);
            _currentCode = fixed;
            _issues = lint(fixed);
            _renderPanel();
          });
        }
      };
      toolbar.appendChild(fixAllBtn);
    }
    _panelEl.appendChild(toolbar);

    // Filter buttons
    const filterGroup = document.createElement('div');
    filterGroup.className = 'sv-lint-filter-group';
    filterGroup.style.padding = '0 14px 8px';
    const filters = [
      { label: 'All', value: 'all' },
      { label: 'Errors', value: 'error' },
      { label: 'Warnings', value: 'warning' },
      { label: 'Info', value: 'info' },
    ];
    let activeFilter = 'all';
    for (const f of filters) {
      const btn = document.createElement('button');
      btn.className = 'sv-lint-filter-btn' + (f.value === 'all' ? ' active' : '');
      btn.textContent = f.label;
      btn.onclick = () => {
        activeFilter = f.value;
        filterGroup.querySelectorAll('.sv-lint-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _renderList(list, activeFilter);
      };
      filterGroup.appendChild(btn);
    }
    _panelEl.appendChild(filterGroup);

    // Issue list
    const list = document.createElement('div');
    list.className = 'sv-lint-list';
    _panelEl.appendChild(list);
    _renderList(list, activeFilter);
  }

  function _renderList(listEl, filter) {
    listEl.innerHTML = '';
    const filtered = filter === 'all' ? _issues : _issues.filter(i => i.severity === filter);

    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'sv-lint-empty';
      const icon = document.createElement('div');
      icon.className = 'sv-lint-empty-icon';
      icon.textContent = _issues.length ? '(filtered)' : '\u2714';
      const msg = document.createElement('div');
      msg.textContent = _issues.length ? 'No issues match this filter.' : 'No lint issues found!';
      empty.append(icon, msg);
      listEl.appendChild(empty);
      return;
    }

    for (const issue of filtered) {
      const item = document.createElement('div');
      item.className = 'sv-lint-item';
      item.onclick = () => { if (_onJumpToLine) _onJumpToLine(issue.line); };

      const dot = document.createElement('div');
      dot.className = `sv-lint-severity sv-lint-severity-${issue.severity}`;

      const body = document.createElement('div');
      body.className = 'sv-lint-item-body';
      const msgEl = document.createElement('div');
      msgEl.className = 'sv-lint-item-msg';
      msgEl.textContent = issue.message;
      const locEl = document.createElement('div');
      locEl.className = 'sv-lint-item-loc';
      locEl.textContent = `Line ${issue.line}`;
      const ruleEl = document.createElement('span');
      ruleEl.className = 'sv-lint-item-rule';
      ruleEl.textContent = issue.ruleId;
      body.append(msgEl, locEl, ruleEl);

      item.append(dot, body);

      if (issue.fixable) {
        const fixBtn = document.createElement('button');
        fixBtn.className = 'sv-lint-item-fix';
        fixBtn.textContent = 'Fix';
        fixBtn.onclick = (e) => {
          e.stopPropagation();
          const fixed = autoFix(_currentCode, issue.ruleId, issue.fixData);
          if (fixed !== _currentCode) {
            _showDiffPreview(_currentCode, fixed, () => {
              if (_onApplyFix) _onApplyFix(fixed);
              _currentCode = fixed;
              _issues = lint(fixed);
              _renderPanel();
            });
          }
        };
        item.appendChild(fixBtn);
      }

      listEl.appendChild(item);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Public API                                                         */
  /* ------------------------------------------------------------------ */

  function init(containerEl, options = {}) {
    _container = containerEl;
    _onJumpToLine = options.onJumpToLine || null;
    _onApplyFix = options.onApplyFix || null;
    _injectStyles();
    _buildPanel();
  }

  function destroy() {
    if (_panelEl) { _panelEl.remove(); _panelEl = null; }
    if (_styleEl) { _styleEl.remove(); _styleEl = null; }
    _container = null;
    _issues = [];
    _currentCode = '';
  }

  function lintAndRender(code) {
    _currentCode = code;
    _issues = lint(code);
    _renderPanel();
    return _issues;
  }

  return {
    init,
    lint,
    lintAndRender,
    autoFix,
    autoFixAll,
    getRules,
    destroy,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = AdvancedLinter;
