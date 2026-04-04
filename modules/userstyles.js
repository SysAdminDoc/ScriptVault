// ============================================================================
// ScriptVault — UserStyles/CSS Engine
// ============================================================================
// Parses UserCSS (==UserStyle==) format, manages CSS style registration,
// variable substitution, Stylus backup import, and userscript conversion.
// Runs in service worker context (no DOM).

const UserStylesEngine = (() => {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  Constants                                                          */
  /* ------------------------------------------------------------------ */

  const STORAGE_KEY = 'sv_userstyles';
  const VARS_STORAGE_KEY = 'sv_userstyle_vars';
  const META_REGEX = /\/\*\s*==UserStyle==\s*([\s\S]*?)==\/UserStyle==\s*\*\//;
  const VAR_TYPES = ['color', 'text', 'number', 'select', 'checkbox', 'range'];
  const DIRECTIVE_REGEX = /^@(\S+)\s+(.*?)\s*$/;

  /* ------------------------------------------------------------------ */
  /*  Internal state                                                     */
  /* ------------------------------------------------------------------ */

  let _styles = {};       // { styleId: styleObject }
  let _customVars = {};   // { styleId: { varName: value } }
  let _initialized = false;
  let _registeredTabs = new Map(); // tabId -> Set<styleId>

  /* ------------------------------------------------------------------ */
  /*  Storage helpers                                                    */
  /* ------------------------------------------------------------------ */

  async function _loadState() {
    try {
      const data = await chrome.storage.local.get([STORAGE_KEY, VARS_STORAGE_KEY]);
      _styles = data[STORAGE_KEY] || {};
      _customVars = data[VARS_STORAGE_KEY] || {};
    } catch (e) {
      console.error('[UserStylesEngine] Failed to load state:', e);
      _styles = {};
      _customVars = {};
    }
  }

  async function _saveStyles() {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: _styles });
    } catch (e) {
      console.error('[UserStylesEngine] Failed to save styles:', e);
    }
  }

  async function _saveVars() {
    try {
      await chrome.storage.local.set({ [VARS_STORAGE_KEY]: _customVars });
    } catch (e) {
      console.error('[UserStylesEngine] Failed to save variables:', e);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  @var parsing                                                       */
  /* ------------------------------------------------------------------ */

  /**
   * Parse a single @var directive.
   * Formats:
   *   @var color  my-color  "Label"  #ff0000
   *   @var select my-select "Label"  {opt1:val1|opt2:val2}
   *   @var range  my-range  "Label"  [0, 100, 1, 50]
   *   @var number my-num    "Label"  42
   *   @var text   my-text   "Label"  "default value"
   *   @var checkbox my-chk  "Label"  0
   */
  function _parseVarDirective(type, rest) {
    // Extract: varName "Label" defaultValue
    const nameMatch = rest.match(/^(\S+)\s+"([^"]*?)"\s+([\s\S]*)$/);
    if (!nameMatch) {
      const simpleMatch = rest.match(/^(\S+)\s+(.*)$/);
      if (!simpleMatch) return null;
      return {
        type,
        name: simpleMatch[1],
        label: simpleMatch[1],
        default: simpleMatch[2].trim(),
        options: null,
      };
    }

    const varName = nameMatch[1];
    const label = nameMatch[2];
    let defaultVal = nameMatch[3].trim();
    let options = null;

    switch (type) {
      case 'color':
        // Default is a color value like #ff0000 or rgba(...)
        break;

      case 'text':
        // Strip surrounding quotes if present
        if (/^".*"$/.test(defaultVal)) {
          defaultVal = defaultVal.slice(1, -1);
        }
        break;

      case 'number':
        defaultVal = parseFloat(defaultVal) || 0;
        break;

      case 'checkbox':
        defaultVal = defaultVal === '1' || defaultVal === 'true';
        break;

      case 'select': {
        // {opt1:"Label 1"|opt2:"Label 2"} or {"Label 1":"val1","Label 2":"val2"}
        const braceMatch = defaultVal.match(/^\{([\s\S]*)\}$/);
        if (braceMatch) {
          options = {};
          const inner = braceMatch[1];
          // Try JSON-style first
          try {
            options = JSON.parse(`{${inner}}`);
            defaultVal = Object.keys(options)[0] || '';
          } catch {
            // Pipe-separated: key:value|key:value or "label":value
            const pairs = inner.split('|');
            let firstKey = null;
            for (const pair of pairs) {
              const kv = pair.match(/^"?([^":]+)"?\s*:\s*"?([^"|]*)"?\s*$/);
              if (kv) {
                options[kv[1].trim()] = kv[2].trim();
                if (!firstKey) firstKey = kv[1].trim();
              }
            }
            defaultVal = firstKey || '';
          }
        }
        break;
      }

      case 'range': {
        // [min, max, step, default] e.g. [0, 100, 1, 50]
        const arrMatch = defaultVal.match(/^\[([\s\S]*)\]$/);
        if (arrMatch) {
          const parts = arrMatch[1].split(',').map(s => { const n = parseFloat(s.trim()); return Number.isNaN(n) ? undefined : n; });
          options = {
            min: parts[0] ?? 0,
            max: parts[1] ?? 100,
            step: parts[2] ?? 1,
          };
          defaultVal = parts[3] ?? parts[0] ?? 0;
        } else {
          defaultVal = parseFloat(defaultVal) || 0;
          options = { min: 0, max: 100, step: 1 };
        }
        break;
      }
    }

    return { type, name: varName, label, default: defaultVal, options };
  }

  /* ------------------------------------------------------------------ */
  /*  UserCSS parser                                                     */
  /* ------------------------------------------------------------------ */

  /**
   * Parse UserCSS source code.
   * @param {string} code - Full UserCSS file content
   * @returns {{ meta: Object, variables: Object[], css: string, error?: string }}
   */
  function parseUserCSS(code) {
    const metaMatch = code.match(META_REGEX);
    if (!metaMatch) {
      return { error: 'No ==UserStyle== metadata block found.' };
    }

    const meta = {
      name: 'Unnamed Style',
      namespace: 'scriptvault',
      version: '1.0.0',
      description: '',
      author: '',
      license: '',
      preprocessor: 'default',
      homepageURL: '',
      supportURL: '',
      updateURL: '',
    };
    const variables = [];

    const metaBlock = metaMatch[1];
    const lines = metaBlock.split('\n');

    for (const line of lines) {
      const trimmed = line.replace(/^\s*\*?\s*/, '').trim();
      if (!trimmed || trimmed.startsWith('//')) continue;

      const match = trimmed.match(DIRECTIVE_REGEX);
      if (!match) continue;

      const key = match[1];
      const value = match[2];

      if (key === 'var') {
        // @var type name "label" default
        const varTypeMatch = value.match(/^(\S+)\s+([\s\S]+)$/);
        if (varTypeMatch && VAR_TYPES.includes(varTypeMatch[1])) {
          const parsed = _parseVarDirective(varTypeMatch[1], varTypeMatch[2]);
          if (parsed) variables.push(parsed);
        }
      } else if (key in meta) {
        meta[key] = value;
      }
    }

    // Extract CSS body (everything outside the meta block)
    const metaEnd = code.indexOf('==/UserStyle==');
    const afterMeta = code.indexOf('*/', metaEnd);
    let css = '';
    if (afterMeta !== -1) {
      css = code.substring(afterMeta + 2).trim();
    }

    return { meta, variables, css };
  }

  /* ------------------------------------------------------------------ */
  /*  Variable substitution                                              */
  /* ------------------------------------------------------------------ */

  /**
   * Apply variable values to CSS template.
   * Replaces /*[[varName]]*​/ patterns (UserCSS convention)
   * and var(--varName) custom property patterns.
   */
  function _substituteVariables(css, variables, customValues) {
    let result = css;

    for (const v of variables) {
      const val = customValues && customValues[v.name] !== undefined
        ? customValues[v.name]
        : v.default;

      // Replace /*[[varName]]*/ placeholders
      const placeholder = new RegExp(
        '/\\*\\[\\[' + _escapeRegex(v.name) + '\\]\\]\\*/', 'g'
      );
      result = result.replace(placeholder, String(val));

      // Replace <<varName>> placeholders (less-style)
      const anglePlaceholder = new RegExp(
        '<<' + _escapeRegex(v.name) + '>>', 'g'
      );
      result = result.replace(anglePlaceholder, String(val));
    }

    return result;
  }

  function _escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /* ------------------------------------------------------------------ */
  /*  Style registration via chrome.scripting                            */
  /* ------------------------------------------------------------------ */

  /**
   * Build the final CSS for a style, applying variable substitutions.
   */
  function _buildCSS(styleId) {
    const style = _styles[styleId];
    if (!style) return '';
    const vars = style.variables || [];
    const custom = _customVars[styleId] || {};
    return _substituteVariables(style.css, vars, custom);
  }

  /**
   * Register a style for injection.
   * @param {Object} style - Parsed style object with meta, variables, css
   * @returns {Promise<string>} The assigned style ID
   */
  async function registerStyle(style) {
    if (!_initialized) await _loadState();

    const id = style.id || `usercss_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const entry = {
      id,
      type: 'usercss',
      meta: style.meta || {},
      variables: style.variables || [],
      css: style.css || '',
      rawCode: style.rawCode || '',
      enabled: style.enabled !== false,
      match: style.match || ['*://*/*'],
      installDate: style.installDate || Date.now(),
      updateDate: Date.now(),
    };

    _styles[id] = entry;
    await _saveStyles();

    if (entry.enabled) {
      await _injectStyleToMatchingTabs(id);
    }

    return id;
  }

  /**
   * Unregister and remove a style.
   */
  async function unregisterStyle(styleId) {
    if (!_initialized) await _loadState();

    await _removeStyleFromAllTabs(styleId);

    delete _styles[styleId];
    delete _customVars[styleId];

    await Promise.all([_saveStyles(), _saveVars()]);
  }

  /**
   * Enable or disable a style.
   */
  async function toggleStyle(styleId, enabled) {
    if (!_initialized) await _loadState();

    const style = _styles[styleId];
    if (!style) return;

    style.enabled = enabled;
    await _saveStyles();

    if (enabled) {
      await _injectStyleToMatchingTabs(styleId);
    } else {
      await _removeStyleFromAllTabs(styleId);
    }
  }

  /**
   * Inject a style's CSS into all matching tabs.
   */
  async function _injectStyleToMatchingTabs(styleId) {
    const style = _styles[styleId];
    if (!style || !style.enabled) return;

    const css = _buildCSS(styleId);
    if (!css) return;

    try {
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (_urlMatchesPatterns(tab.url, style.match)) {
          try {
            await chrome.scripting.insertCSS({
              target: { tabId: tab.id },
              css,
            });
            if (!_registeredTabs.has(tab.id)) {
              _registeredTabs.set(tab.id, new Set());
            }
            _registeredTabs.get(tab.id).add(styleId);
          } catch {
            // Tab may not be injectable (chrome://, etc.)
          }
        }
      }
    } catch (e) {
      console.error('[UserStylesEngine] Inject failed:', e);
    }
  }

  /**
   * Remove a style's CSS from all tabs.
   */
  async function _removeStyleFromAllTabs(styleId) {
    const css = _buildCSS(styleId);
    if (!css) return;

    try {
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        const tabStyles = _registeredTabs.get(tab.id);
        if (tabStyles && tabStyles.has(styleId)) {
          try {
            await chrome.scripting.removeCSS({
              target: { tabId: tab.id },
              css,
            });
            tabStyles.delete(styleId);
          } catch {
            // Tab may have been closed
          }
        }
      }
    } catch (e) {
      console.error('[UserStylesEngine] Remove failed:', e);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  URL matching                                                       */
  /* ------------------------------------------------------------------ */

  function _urlMatchesPatterns(url, patterns) {
    if (!url || !patterns || patterns.length === 0) return false;

    for (const pattern of patterns) {
      if (pattern === '*://*/*' || pattern === '<all_urls>') return true;

      try {
        const regex = _matchPatternToRegex(pattern);
        if (regex.test(url)) return true;
      } catch {
        // Fallback: treat as glob
        if (_globMatch(url, pattern)) return true;
      }
    }
    return false;
  }

  function _matchPatternToRegex(pattern) {
    // Chrome extension match pattern: scheme://host/path
    const escaped = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\\\*/g, '.*');
    return new RegExp('^' + escaped + '$');
  }

  function _globMatch(url, glob) {
    const regex = glob
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');
    return new RegExp('^' + regex + '$').test(url);
  }

  /* ------------------------------------------------------------------ */
  /*  Variable management                                                */
  /* ------------------------------------------------------------------ */

  /**
   * Get variable definitions and current values for a style.
   */
  function getVariables(styleId) {
    const style = _styles[styleId];
    if (!style) return null;

    const custom = _customVars[styleId] || {};
    return (style.variables || []).map(v => ({
      ...v,
      current: custom[v.name] !== undefined ? custom[v.name] : v.default,
    }));
  }

  /**
   * Set variable values for a style and re-inject.
   * @param {string} styleId
   * @param {Object} values - { varName: value }
   */
  async function setVariables(styleId, values) {
    if (!_initialized) await _loadState();

    const style = _styles[styleId];
    if (!style) return;

    if (!_customVars[styleId]) _customVars[styleId] = {};

    for (const [key, val] of Object.entries(values)) {
      _customVars[styleId][key] = val;
    }

    await _saveVars();

    // Re-inject with updated values
    if (style.enabled) {
      await _removeStyleFromAllTabs(styleId);
      await _injectStyleToMatchingTabs(styleId);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Conversion: UserCSS -> Userscript                                  */
  /* ------------------------------------------------------------------ */

  /**
   * Convert a UserCSS source to a regular userscript that uses GM_addStyle.
   */
  function convertToUserscript(usercssCode) {
    const parsed = parseUserCSS(usercssCode);
    if (parsed.error) return { error: parsed.error };

    const { meta, variables, css } = parsed;

    // Build the default variable values for substitution
    const defaults = {};
    for (const v of variables) {
      defaults[v.name] = v.default;
    }
    const finalCSS = _substituteVariables(css, variables, defaults);

    // Escape backticks and backslashes for template literal
    const escapedCSS = finalCSS
      .replace(/\\/g, '\\\\')
      .replace(/`/g, '\\`')
      .replace(/\$/g, '\\$');

    const matchDirectives = '// @match        *://*/*';
    const grantDirective = '// @grant        GM_addStyle';

    const script = [
      '// ==UserScript==',
      `// @name         ${meta.name}`,
      `// @namespace    ${meta.namespace}`,
      `// @version      ${meta.version}`,
      `// @description  ${meta.description}`,
      `// @author       ${meta.author}`,
      matchDirectives,
      grantDirective,
      '// @run-at       document-start',
      '// ==/UserScript==',
      '',
      '(function () {',
      '  \'use strict\';',
      '',
      '  const css = `',
      escapedCSS,
      '  `;',
      '',
      '  if (typeof GM_addStyle === \'function\') {',
      '    GM_addStyle(css);',
      '  } else {',
      '    const style = document.createElement(\'style\');',
      '    style.textContent = css;',
      '    (document.head || document.documentElement).appendChild(style);',
      '  }',
      '})();',
    ].join('\n');

    return { script, meta };
  }

  /* ------------------------------------------------------------------ */
  /*  Import from Stylus JSON backup                                     */
  /* ------------------------------------------------------------------ */

  /**
   * Import styles from a Stylus JSON backup.
   * @param {string|Object} json - JSON string or parsed array of Stylus style objects
   * @returns {Promise<{ imported: number, errors: string[] }>}
   */
  async function importStylusBackup(json) {
    if (!_initialized) await _loadState();

    let stylusStyles;
    try {
      stylusStyles = typeof json === 'string' ? JSON.parse(json) : json;
    } catch (e) {
      return { imported: 0, errors: ['Invalid JSON: ' + e.message] };
    }

    if (!Array.isArray(stylusStyles)) {
      stylusStyles = [stylusStyles];
    }

    let imported = 0;
    const errors = [];

    for (const sStyle of stylusStyles) {
      try {
        const style = _convertStylusStyle(sStyle);
        if (style) {
          await registerStyle(style);
          imported++;
        } else {
          errors.push(`Skipped style: ${sStyle.name || 'unknown'} (no usable sections)`);
        }
      } catch (e) {
        errors.push(`Failed to import "${sStyle.name || 'unknown'}": ${e.message}`);
      }
    }

    return { imported, errors };
  }

  /**
   * Convert a single Stylus backup style object to our internal format.
   */
  function _convertStylusStyle(sStyle) {
    if (!sStyle.sections || sStyle.sections.length === 0) return null;

    // Build CSS from sections
    const cssParts = [];
    const matchPatterns = new Set();

    for (const section of sStyle.sections) {
      let sectionCSS = section.code || '';

      // Build selector from urls/urlPrefixes/domains/regexps
      if (section.urls && section.urls.length) {
        for (const url of section.urls) {
          matchPatterns.add(_urlToMatchPattern(url));
        }
      }
      if (section.urlPrefixes && section.urlPrefixes.length) {
        for (const prefix of section.urlPrefixes) {
          matchPatterns.add(_urlPrefixToMatchPattern(prefix));
        }
      }
      if (section.domains && section.domains.length) {
        for (const domain of section.domains) {
          matchPatterns.add(`*://${domain}/*`);
          matchPatterns.add(`*://*.${domain}/*`);
        }
      }
      if (section.regexps && section.regexps.length) {
        // Can't convert regex to match pattern; use catch-all
        matchPatterns.add('*://*/*');
      }
      if (!section.urls?.length && !section.urlPrefixes?.length &&
          !section.domains?.length && !section.regexps?.length) {
        matchPatterns.add('*://*/*');
      }

      cssParts.push(sectionCSS);
    }

    const match = [...matchPatterns];
    if (match.length === 0) match.push('*://*/*');

    return {
      meta: {
        name: sStyle.name || 'Imported Style',
        namespace: 'stylus-import',
        version: '1.0.0',
        description: `Imported from Stylus on ${new Date().toISOString().split('T')[0]}`,
        author: sStyle.author || '',
        license: '',
        preprocessor: 'default',
      },
      variables: [],
      css: cssParts.join('\n\n'),
      rawCode: '',
      match,
      enabled: sStyle.enabled !== false,
      installDate: sStyle.installDate || Date.now(),
    };
  }

  function _urlToMatchPattern(url) {
    try {
      const u = new URL(url);
      return `${u.protocol}//${u.hostname}${u.pathname}`;
    } catch {
      return '*://*/*';
    }
  }

  function _urlPrefixToMatchPattern(prefix) {
    try {
      const u = new URL(prefix);
      return `${u.protocol}//${u.hostname}${u.pathname}*`;
    } catch {
      return '*://*/*';
    }
  }

  /* ------------------------------------------------------------------ */
  /*  .user.css URL detection                                            */
  /* ------------------------------------------------------------------ */

  /**
   * Check if a URL points to a UserCSS file.
   */
  function isUserCSSUrl(url) {
    if (!url) return false;
    try {
      const pathname = new URL(url).pathname;
      return pathname.endsWith('.user.css');
    } catch {
      return false;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Tab navigation handler                                             */
  /* ------------------------------------------------------------------ */

  /**
   * Handle tab navigation — inject matching styles into newly loaded pages.
   * Call from background.js webNavigation.onCommitted or tabs.onUpdated.
   */
  const _injectingTabs = new Set();
  async function onTabUpdated(tabId, url) {
    if (!_initialized) await _loadState();
    if (!url) return;
    // Prevent concurrent injection for the same tab
    if (_injectingTabs.has(tabId)) return;
    _injectingTabs.add(tabId);

    try {
      for (const [styleId, style] of Object.entries(_styles)) {
        if (!style.enabled) continue;
        if (!_urlMatchesPatterns(url, style.match)) continue;

        const css = _buildCSS(styleId);
        if (!css) continue;

        try {
          await chrome.scripting.insertCSS({
            target: { tabId },
            css,
          });
          if (!_registeredTabs.has(tabId)) {
            _registeredTabs.set(tabId, new Set());
          }
          _registeredTabs.get(tabId).add(styleId);
        } catch {
          // Tab not injectable
        }
      }
    } finally {
      _injectingTabs.delete(tabId);
    }
  }

  /**
   * Clean up when a tab is closed.
   */
  function onTabRemoved(tabId) {
    _registeredTabs.delete(tabId);
  }

  /* ------------------------------------------------------------------ */
  /*  Initialization                                                     */
  /* ------------------------------------------------------------------ */

  async function init() {
    if (_initialized) return;
    await _loadState();
    _initialized = true;
  }

  /* ------------------------------------------------------------------ */
  /*  Get all styles (for dashboard display)                             */
  /* ------------------------------------------------------------------ */

  function getStyles() {
    return { ..._styles };
  }

  function getStyle(styleId) {
    return _styles[styleId] || null;
  }

  /* ------------------------------------------------------------------ */
  /*  Update raw CSS for a style                                         */
  /* ------------------------------------------------------------------ */

  async function updateCSS(styleId, newCSS) {
    if (!_initialized) await _loadState();

    const style = _styles[styleId];
    if (!style) return;

    // Re-parse if full UserCSS provided
    if (META_REGEX.test(newCSS)) {
      const parsed = parseUserCSS(newCSS);
      if (!parsed.error) {
        style.meta = parsed.meta;
        style.variables = parsed.variables;
        style.css = parsed.css;
        style.rawCode = newCSS;
      }
    } else {
      style.css = newCSS;
    }

    style.updateDate = Date.now();
    await _saveStyles();

    if (style.enabled) {
      await _removeStyleFromAllTabs(styleId);
      await _injectStyleToMatchingTabs(styleId);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Public API                                                         */
  /* ------------------------------------------------------------------ */

  return {
    init,
    parseUserCSS,
    registerStyle,
    unregisterStyle,
    toggleStyle,
    getVariables,
    setVariables,
    getStyles,
    getStyle,
    updateCSS,
    convertToUserscript,
    importStylusBackup,
    isUserCSSUrl,
    onTabUpdated,
    onTabRemoved,
  };
})();

// Export for module environments (tests, bundlers)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UserStylesEngine;
}
