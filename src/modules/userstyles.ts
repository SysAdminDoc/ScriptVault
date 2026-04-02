// ============================================================================
// ScriptVault — UserStyles/CSS Engine (strict TypeScript migration)
// ============================================================================
// Parses UserCSS (==UserStyle==) format, manages CSS style registration,
// variable substitution, Stylus backup import, and userscript conversion.
// Runs in service worker context (no DOM).

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type VarType = 'color' | 'text' | 'number' | 'select' | 'checkbox' | 'range';

interface StyleVariable {
  type: VarType;
  name: string;
  label: string;
  default: string | number | boolean;
  options: Record<string, string | number> | { min: number; max: number; step: number } | null;
}

interface StyleVariableWithCurrent extends StyleVariable {
  current: string | number | boolean;
}

interface StyleMeta {
  name: string;
  namespace: string;
  version: string;
  description: string;
  author: string;
  license: string;
  preprocessor: string;
  homepageURL: string;
  supportURL: string;
  updateURL: string;
  [key: string]: string;
}

interface StyleEntry {
  id: string;
  type: string;
  meta: StyleMeta;
  variables: StyleVariable[];
  css: string;
  rawCode: string;
  enabled: boolean;
  match: string[];
  installDate: number;
  updateDate: number;
}

interface StyleRegistration {
  id?: string;
  meta?: Partial<StyleMeta>;
  variables?: StyleVariable[];
  css?: string;
  rawCode?: string;
  enabled?: boolean;
  match?: string[];
  installDate?: number;
}

interface ParseResult {
  meta?: StyleMeta;
  variables?: StyleVariable[];
  match?: string[];
  css?: string;
  error?: string;
}

interface ConvertResult {
  script?: string;
  meta?: StyleMeta;
  error?: string;
}

interface ImportResult {
  imported: number;
  errors: string[];
}

interface StylusSection {
  code?: string;
  urls?: string[];
  urlPrefixes?: string[];
  domains?: string[];
  regexps?: string[];
}

interface StylusStyle {
  name?: string;
  author?: string;
  enabled?: boolean;
  installDate?: number;
  sections?: StylusSection[];
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = 'sv_userstyles';
const VARS_STORAGE_KEY = 'sv_userstyle_vars';
const META_REGEX: RegExp = /\/\*\s*==UserStyle==\s*([\s\S]*?)==\/UserStyle==\s*\*\//;
const VAR_TYPES: VarType[] = ['color', 'text', 'number', 'select', 'checkbox', 'range'];
const DIRECTIVE_REGEX: RegExp = /^@(\S+)\s+(.*?)\s*$/;

/* ------------------------------------------------------------------ */
/*  Internal state                                                     */
/* ------------------------------------------------------------------ */

let _styles: Record<string, StyleEntry> = {};
let _customVars: Record<string, Record<string, string | number | boolean>> = {};
let _initialized = false;
const _registeredTabs: Map<number, Map<string, string>> = new Map();
const _injectingTabs: Set<number> = new Set();

/* ------------------------------------------------------------------ */
/*  Storage helpers                                                    */
/* ------------------------------------------------------------------ */

async function _loadState(): Promise<void> {
  try {
    const data: Record<string, unknown> = await chrome.storage.local.get([STORAGE_KEY, VARS_STORAGE_KEY]);
    _styles = (data[STORAGE_KEY] as Record<string, StyleEntry> | undefined) ?? {};
    _customVars = (data[VARS_STORAGE_KEY] as Record<string, Record<string, string | number | boolean>> | undefined) ?? {};
  } catch (e: unknown) {
    console.error('[UserStylesEngine] Failed to load state:', e);
    _styles = {};
    _customVars = {};
  }
}

async function _saveStyles(): Promise<void> {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: _styles });
  } catch (e: unknown) {
    console.error('[UserStylesEngine] Failed to save styles:', e);
  }
}

async function _saveVars(): Promise<void> {
  try {
    await chrome.storage.local.set({ [VARS_STORAGE_KEY]: _customVars });
  } catch (e: unknown) {
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
function _parseVarDirective(type: VarType, rest: string): StyleVariable | null {
  // Extract: varName "Label" defaultValue
  const nameMatch: RegExpMatchArray | null = rest.match(/^(\S+)\s+"([^"]*?)"\s+([\s\S]*)$/);
  if (!nameMatch) {
    const simpleMatch: RegExpMatchArray | null = rest.match(/^(\S+)\s+(.*)$/);
    if (!simpleMatch) return null;
    return {
      type,
      name: simpleMatch[1] ?? '',
      label: simpleMatch[1] ?? '',
      default: (simpleMatch[2] ?? '').trim(),
      options: null,
    };
  }

  const varName: string = nameMatch[1] ?? '';
  const label: string = nameMatch[2] ?? '';
  let defaultVal: string | number | boolean = (nameMatch[3] ?? '').trim();
  let options: StyleVariable['options'] = null;

  switch (type) {
    case 'color':
      // Default is a color value like #ff0000 or rgba(...)
      break;

    case 'text':
      // Strip surrounding quotes if present
      if (/^".*"$/.test(defaultVal as string)) {
        defaultVal = (defaultVal as string).slice(1, -1);
      }
      break;

    case 'number':
      defaultVal = parseFloat(defaultVal as string) || 0;
      break;

    case 'checkbox':
      defaultVal = defaultVal === '1' || defaultVal === 'true';
      break;

    case 'select': {
      // {opt1:"Label 1"|opt2:"Label 2"} or {"Label 1":"val1","Label 2":"val2"}
      const braceMatch: RegExpMatchArray | null = (defaultVal as string).match(/^\{([\s\S]*)\}$/);
      if (braceMatch) {
        const inner: string = braceMatch[1] ?? '';
        // Try JSON-style first
        try {
          const parsed: Record<string, string> = JSON.parse(`{${inner}}`) as Record<string, string>;
          options = parsed;
          defaultVal = Object.keys(parsed)[0] ?? '';
        } catch {
          // Pipe-separated: key:value|key:value or "label":value
          const pairs: string[] = inner.split('|');
          let firstKey: string | null = null;
          const selectOptions: Record<string, string> = {};
          for (const pair of pairs) {
            const kv: RegExpMatchArray | null = pair.match(/^"?([^":]+)"?\s*:\s*"?([^"|]*)"?\s*$/);
            if (kv) {
              const key: string = (kv[1] ?? '').trim();
              const val: string = (kv[2] ?? '').trim();
              selectOptions[key] = val;
              if (!firstKey) firstKey = key;
            }
          }
          options = selectOptions;
          defaultVal = firstKey ?? '';
        }
      }
      break;
    }

    case 'range': {
      // [min, max, step, default] e.g. [0, 100, 1, 50]
      const arrMatch: RegExpMatchArray | null = (defaultVal as string).match(/^\[([\s\S]*)\]$/);
      if (arrMatch) {
        const parts: number[] = (arrMatch[1] ?? '').split(',').map((s: string) => parseFloat(s.trim()));
        options = {
          min: parts[0] ?? 0,
          max: parts[1] ?? 100,
          step: parts[2] ?? 1,
        };
        defaultVal = parts[3] ?? parts[0] ?? 0;
      } else {
        defaultVal = parseFloat(defaultVal as string) || 0;
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
 */
function parseUserCSS(code: string): ParseResult {
  const metaMatch: RegExpMatchArray | null = code.match(META_REGEX);
  if (!metaMatch) {
    return { error: 'No ==UserStyle== metadata block found.' };
  }

  const meta: StyleMeta = {
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
  const variables: StyleVariable[] = [];
  const matchPatterns: string[] = [];

  const metaBlock: string = metaMatch[1] ?? '';
  const lines: string[] = metaBlock.split('\n');

  for (const line of lines) {
    const trimmed: string = line.replace(/^\s*\*?\s*/, '').trim();
    if (!trimmed || trimmed.startsWith('//')) continue;

    const match: RegExpMatchArray | null = trimmed.match(DIRECTIVE_REGEX);
    if (!match) continue;

    const key: string = match[1] ?? '';
    const value: string = match[2] ?? '';

    if (key === 'var') {
      // @var type name "label" default
      const varTypeMatch: RegExpMatchArray | null = value.match(/^(\S+)\s+([\s\S]+)$/);
      if (varTypeMatch && VAR_TYPES.includes(varTypeMatch[1] as VarType)) {
        const parsed: StyleVariable | null = _parseVarDirective(varTypeMatch[1] as VarType, varTypeMatch[2] ?? '');
        if (parsed) variables.push(parsed);
      }
    } else if (key === 'match' && value) {
      matchPatterns.push(value);
    } else if (key in meta) {
      meta[key] = value;
    }
  }

  // Extract CSS body (everything outside the meta block)
  const metaEnd: number = code.indexOf('==/UserStyle==');
  const afterMeta: number = code.indexOf('*/', metaEnd);
  let css = '';
  if (afterMeta !== -1) {
    css = code.substring(afterMeta + 2).trim();
  }

  return {
    meta,
    variables,
    match: matchPatterns.length ? matchPatterns : ['*://*/*'],
    css,
  };
}

/* ------------------------------------------------------------------ */
/*  Variable substitution                                              */
/* ------------------------------------------------------------------ */

/**
 * Apply variable values to CSS template.
 * Replaces /*[[varName]]*​/ patterns (UserCSS convention)
 * and var(--varName) custom property patterns.
 */
function _substituteVariables(
  css: string,
  variables: StyleVariable[],
  customValues: Record<string, string | number | boolean> | undefined,
): string {
  let result: string = css;

  for (const v of variables) {
    const val: string | number | boolean =
      customValues && customValues[v.name] !== undefined
        ? customValues[v.name]!
        : v.default;

    // Replace /*[[varName]]*/ placeholders
    const placeholder: RegExp = new RegExp(
      '/\\*\\[\\[' + _escapeRegex(v.name) + '\\]\\]\\*/', 'g',
    );
    result = result.replace(placeholder, String(val));

    // Replace <<varName>> placeholders (less-style)
    const anglePlaceholder: RegExp = new RegExp(
      '<<' + _escapeRegex(v.name) + '>>', 'g',
    );
    result = result.replace(anglePlaceholder, String(val));
  }

  return result;
}

function _escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* ------------------------------------------------------------------ */
/*  Style registration via chrome.scripting                            */
/* ------------------------------------------------------------------ */

/**
 * Build the final CSS for a style, applying variable substitutions.
 */
function _buildCSS(styleId: string): string {
  const style: StyleEntry | undefined = _styles[styleId];
  if (!style) return '';
  const vars: StyleVariable[] = style.variables ?? [];
  const custom: Record<string, string | number | boolean> = _customVars[styleId] ?? {};
  return _substituteVariables(style.css, vars, custom);
}

/**
 * Register a style for injection.
 */
async function registerStyle(style: StyleRegistration): Promise<string> {
  if (!_initialized) await _loadState();

  const id: string = style.id ?? `usercss_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const entry: StyleEntry = {
    id,
    type: 'usercss',
    meta: (style.meta ?? {}) as StyleMeta,
    variables: style.variables ?? [],
    css: style.css ?? '',
    rawCode: style.rawCode ?? '',
    enabled: style.enabled !== false,
    match: style.match ?? ['*://*/*'],
    installDate: style.installDate ?? Date.now(),
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
async function unregisterStyle(styleId: string): Promise<void> {
  if (!_initialized) await _loadState();

  await _removeStyleFromAllTabs(styleId);

  delete _styles[styleId];
  delete _customVars[styleId];

  await Promise.all([_saveStyles(), _saveVars()]);
}

/**
 * Enable or disable a style.
 */
async function toggleStyle(styleId: string, enabled: boolean): Promise<void> {
  if (!_initialized) await _loadState();

  const style: StyleEntry | undefined = _styles[styleId];
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
async function _injectStyleToMatchingTabs(styleId: string): Promise<void> {
  const style: StyleEntry | undefined = _styles[styleId];
  if (!style?.enabled) return;

  const css: string = _buildCSS(styleId);
  if (!css) return;

  try {
    const tabs: chrome.tabs.Tab[] = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id == null) continue;
      if (_urlMatchesPatterns(tab.url, style.match)) {
        const tabStyles: Map<string, string> = _registeredTabs.get(tab.id) ?? new Map<string, string>();
        const previousCss: string | undefined = tabStyles.get(styleId);
        try {
          if (previousCss && previousCss !== css) {
            try {
              await chrome.scripting.removeCSS({
                target: { tabId: tab.id },
                css: previousCss,
              });
            } catch {
              // The tab may have navigated since the previous injection.
            }
          }
          await chrome.scripting.insertCSS({
            target: { tabId: tab.id },
            css,
          });
          tabStyles.set(styleId, css);
          _registeredTabs.set(tab.id, tabStyles);
        } catch {
          // Tab may not be injectable (chrome://, etc.)
        }
      }
    }
  } catch (e: unknown) {
    console.error('[UserStylesEngine] Inject failed:', e);
  }
}

/**
 * Remove a style's CSS from all tabs.
 */
async function _removeStyleFromAllTabs(styleId: string): Promise<void> {
  try {
    const tabs: chrome.tabs.Tab[] = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id == null) continue;
      const tabStyles: Map<string, string> | undefined = _registeredTabs.get(tab.id);
      if (!tabStyles) continue;
      const registeredCss: string | undefined = tabStyles.get(styleId);
      if (registeredCss) {
        try {
          await chrome.scripting.removeCSS({
            target: { tabId: tab.id },
            css: registeredCss,
          });
          tabStyles.delete(styleId);
          if (tabStyles.size === 0) {
            _registeredTabs.delete(tab.id);
          }
        } catch {
          // Tab may have been closed
        }
      }
    }
  } catch (e: unknown) {
    console.error('[UserStylesEngine] Remove failed:', e);
  }
}

/* ------------------------------------------------------------------ */
/*  URL matching                                                       */
/* ------------------------------------------------------------------ */

function _urlMatchesPatterns(url: string | undefined, patterns: string[]): boolean {
  if (!url || !patterns || patterns.length === 0) return false;

  for (const pattern of patterns) {
    if (pattern === '*://*/*' || pattern === '<all_urls>') return true;

    try {
      const regex: RegExp = _matchPatternToRegex(pattern);
      if (regex.test(url)) return true;
    } catch {
      // Fallback: treat as glob
      if (_globMatch(url, pattern)) return true;
    }
  }
  return false;
}

function _matchPatternToRegex(pattern: string): RegExp {
  const match = pattern.match(/^(\*|http|https|file|ftp):\/\/([^/]*)(\/.*)$/);
  if (!match) {
    throw new Error(`Invalid match pattern: ${pattern}`);
  }

  const scheme: string = match[1] ?? '';
  const host: string = match[2] ?? '';
  const path: string = match[3] ?? '';

  const schemeRegex =
    scheme === '*'
      ? 'https?'
      : _escapeRegex(scheme);

  let hostRegex = '';
  if (scheme !== 'file') {
    if (host === '*') {
      hostRegex = '[^/]+';
    } else if (host.startsWith('*.')) {
      hostRegex = `(?:[^/]+\\.)*${_escapeRegex(host.slice(2))}`;
    } else {
      hostRegex = _escapeRegex(host);
    }
  }

  const pathRegex = path.split('*').map((segment: string) => _escapeRegex(segment)).join('.*');
  return new RegExp(`^${schemeRegex}:\\/\\/${hostRegex}${pathRegex}$`);
}

function _globMatch(url: string, glob: string): boolean {
  const regex: string = glob
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
function getVariables(styleId: string): StyleVariableWithCurrent[] | null {
  const style: StyleEntry | undefined = _styles[styleId];
  if (!style) return null;

  const custom: Record<string, string | number | boolean> = _customVars[styleId] ?? {};
  return (style.variables ?? []).map((v: StyleVariable): StyleVariableWithCurrent => ({
    ...v,
    current: custom[v.name] !== undefined ? custom[v.name]! : v.default,
  }));
}

/**
 * Set variable values for a style and re-inject.
 */
async function setVariables(styleId: string, values: Record<string, string | number | boolean>): Promise<void> {
  if (!_initialized) await _loadState();

  const style: StyleEntry | undefined = _styles[styleId];
  if (!style) return;

  if (!_customVars[styleId]) _customVars[styleId] = {};

  for (const [key, val] of Object.entries(values)) {
    _customVars[styleId]![key] = val;
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
function convertToUserscript(usercssCode: string): ConvertResult {
  const parsed: ParseResult = parseUserCSS(usercssCode);
  if (parsed.error) return { error: parsed.error };

  const meta: StyleMeta = parsed.meta!;
  const variables: StyleVariable[] = parsed.variables!;
  const matchPatterns: string[] = parsed.match ?? ['*://*/*'];
  const css: string = parsed.css!;

  // Build the default variable values for substitution
  const defaults: Record<string, string | number | boolean> = {};
  for (const v of variables) {
    defaults[v.name] = v.default;
  }
  const finalCSS: string = _substituteVariables(css, variables, defaults);

  // Escape backticks and backslashes for template literal
  const escapedCSS: string = finalCSS
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$');

  const matchDirectives: string[] = matchPatterns.map((pattern: string) => `// @match        ${pattern}`);
  const grantDirective = '// @grant        GM_addStyle';

  const script: string = [
    '// ==UserScript==',
    `// @name         ${meta.name}`,
    `// @namespace    ${meta.namespace}`,
    `// @version      ${meta.version}`,
    `// @description  ${meta.description}`,
    `// @author       ${meta.author}`,
    ...matchDirectives,
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
 */
async function importStylusBackup(json: string | StylusStyle[] | StylusStyle): Promise<ImportResult> {
  if (!_initialized) await _loadState();

  let stylusStyles: StylusStyle[];
  try {
    const parsed: unknown = typeof json === 'string' ? JSON.parse(json) : json;
    stylusStyles = Array.isArray(parsed) ? parsed as StylusStyle[] : [parsed as StylusStyle];
  } catch (e: unknown) {
    const message: string = e instanceof Error ? e.message : String(e);
    return { imported: 0, errors: ['Invalid JSON: ' + message] };
  }

  let imported = 0;
  const errors: string[] = [];

  for (const sStyle of stylusStyles) {
    try {
      const style: StyleRegistration | null = _convertStylusStyle(sStyle);
      if (style) {
        await registerStyle(style);
        imported++;
      } else {
        errors.push(`Skipped style: ${sStyle.name ?? 'unknown'} (no usable sections)`);
      }
    } catch (e: unknown) {
      const message: string = e instanceof Error ? e.message : String(e);
      errors.push(`Failed to import "${sStyle.name ?? 'unknown'}": ${message}`);
    }
  }

  return { imported, errors };
}

/**
 * Convert a single Stylus backup style object to our internal format.
 */
function _convertStylusStyle(sStyle: StylusStyle): StyleRegistration | null {
  if (!sStyle.sections || sStyle.sections.length === 0) return null;

  // Build CSS from sections
  const cssParts: string[] = [];
  const matchPatterns: Set<string> = new Set();

  for (const section of sStyle.sections) {
    const sectionCSS: string = section.code ?? '';

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

  const match: string[] = [...matchPatterns];
  if (match.length === 0) match.push('*://*/*');

  return {
    meta: {
      name: sStyle.name ?? 'Imported Style',
      namespace: 'stylus-import',
      version: '1.0.0',
      description: `Imported from Stylus on ${new Date().toISOString().split('T')[0]}`,
      author: sStyle.author ?? '',
      license: '',
      preprocessor: 'default',
      homepageURL: '',
      supportURL: '',
      updateURL: '',
    },
    variables: [],
    css: cssParts.join('\n\n'),
    rawCode: '',
    match,
    enabled: sStyle.enabled !== false,
    installDate: sStyle.installDate ?? Date.now(),
  };
}

function _urlToMatchPattern(url: string): string {
  try {
    const u: URL = new URL(url);
    return `${u.protocol}//${u.hostname}${u.pathname}`;
  } catch {
    return '*://*/*';
  }
}

function _urlPrefixToMatchPattern(prefix: string): string {
  try {
    const u: URL = new URL(prefix);
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
function isUserCSSUrl(url: string): boolean {
  if (!url) return false;
  try {
    const pathname: string = new URL(url).pathname;
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
async function onTabUpdated(tabId: number, url: string | undefined): Promise<void> {
  if (!url) return;
  if (_injectingTabs.has(tabId)) return;
  _injectingTabs.add(tabId);

  try {
    if (!_initialized) await _loadState();
    for (const [styleId, style] of Object.entries(_styles)) {
      if (!style.enabled) continue;
      if (!_urlMatchesPatterns(url, style.match)) continue;

      const css: string = _buildCSS(styleId);
      if (!css) continue;

        try {
          const tabStyles: Map<string, string> = _registeredTabs.get(tabId) ?? new Map<string, string>();
          const previousCss: string | undefined = tabStyles.get(styleId);
          if (previousCss && previousCss !== css) {
            try {
              await chrome.scripting.removeCSS({
                target: { tabId },
                css: previousCss,
              });
            } catch {
              // The previous page may already be gone.
            }
          }
          await chrome.scripting.insertCSS({
            target: { tabId },
            css,
          });
          tabStyles.set(styleId, css);
          _registeredTabs.set(tabId, tabStyles);
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
function onTabRemoved(tabId: number): void {
  _registeredTabs.delete(tabId);
}

/* ------------------------------------------------------------------ */
/*  Initialization                                                     */
/* ------------------------------------------------------------------ */

async function init(): Promise<void> {
  if (_initialized) return;
  await _loadState();
  _initialized = true;
}

/* ------------------------------------------------------------------ */
/*  Get all styles (for dashboard display)                             */
/* ------------------------------------------------------------------ */

function getStyles(): Record<string, StyleEntry> {
  return { ..._styles };
}

function getStyle(styleId: string): StyleEntry | null {
  return _styles[styleId] ?? null;
}

/* ------------------------------------------------------------------ */
/*  Update raw CSS for a style                                         */
/* ------------------------------------------------------------------ */

async function updateCSS(styleId: string, newCSS: string): Promise<void> {
  if (!_initialized) await _loadState();

  const style: StyleEntry | undefined = _styles[styleId];
  if (!style) return;

  // Re-parse if full UserCSS provided
  if (META_REGEX.test(newCSS)) {
    const parsed: ParseResult = parseUserCSS(newCSS);
    if (!parsed.error) {
      style.meta = parsed.meta!;
      style.variables = parsed.variables!;
      style.match = parsed.match!;
      style.css = parsed.css!;
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
/*  Public API (exported)                                              */
/* ------------------------------------------------------------------ */

export const UserStylesEngine = {
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
} as const;

export type { StyleVariable, StyleVariableWithCurrent, StyleMeta, StyleEntry, StyleRegistration, ParseResult, ConvertResult, ImportResult, StylusSection, StylusStyle };
