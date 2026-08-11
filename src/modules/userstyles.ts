// ============================================================================
// ScriptVault — UserStyles/CSS Engine (strict TypeScript migration)
// ============================================================================
// Parses UserCSS (==UserStyle==) format, manages CSS style registration,
// variable substitution, Stylus backup import, and userscript conversion.
// Runs in service worker context (no DOM).
//
// WIRING STATUS: the full engine is wired to the background runtime.
//   Persistent install/management is driven by the userStyle* message actions
//   (getUserStyles, installUserStyle, toggleUserStyle, deleteUserStyle,
//   updateUserStyleCode, setUserStyleVariables) in src/background/core.ts, and
//   enabled styles use document-aware `insertCSS` through `onTabUpdated` and
//   `webNavigation.onCommitted` (onDocumentCommitted → onTabUpdated). The
//   dynamic content-script registration API accepts packaged CSS file names,
//   not inline UserCSS text, so it is deliberately not used for these records;
//   this keeps Firefox and Chrome on the same real injection path.
//   `tabs.onRemoved` (onTabRemoved), and a startup `rehydrateOpenTabs`
//   call, and `.user.css` navigation interception. The live editor draft preview
//   (previewDraft / clearDraftPreview) remains wired via the `previewUserStyle` /
//   `clearUserStylePreview` handlers. Keep the injection dedup (onTabUpdated skips
//   when the identical sheet is already registered) and per-commit registry reset
//   (onTabNavigated) intact — together they prevent duplicate injected sheets.

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type VarType = 'color' | 'text' | 'number' | 'select' | 'checkbox' | 'range';
type ColorSpace = 'hex' | 'rgb' | 'hsl' | 'oklch' | 'oklab' | 'named' | 'css';
type PreviewColorScheme = 'auto' | 'light' | 'dark';
type PrimitiveStyleVariableValue = string | number | boolean;

interface ColorSchemeValue {
  light: string;
  dark: string;
}

type StyleVariableValue = PrimitiveStyleVariableValue | ColorSchemeValue;

interface ColorSchemeDefaults {
  light: string;
  dark: string;
}

interface StyleVariable {
  type: VarType;
  name: string;
  label: string;
  default: PrimitiveStyleVariableValue;
  options: Record<string, string | number> | { min: number; max: number; step: number } | null;
  group?: string;
  colorSpace?: ColorSpace;
  colorSchemes?: ColorSchemeDefaults;
}

interface StyleVariableWithCurrent extends StyleVariable {
  current: StyleVariableValue;
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
  /** Non-fatal notice, e.g. an unsupported @preprocessor whose source is not compiled. */
  warning?: string;
}

interface UserCSSValidationResult {
  valid: boolean;
  errors: string[];
}

interface UserCSSExportResult {
  code?: string;
  error?: string;
}

interface UserCSSImportResult {
  styleId?: string;
  error?: string;
  warning?: string;
}

// UserCSS @preprocessor values that require a Less/Stylus compiler ScriptVault
// deliberately does not bundle (zero runtime dependencies). `default` and `uso`
// are variable-substitution-only and are fully handled by _substituteVariables.
const _UNSUPPORTED_PREPROCESSORS = new Set(['less', 'stylus', 'styl']);

interface ConvertResult {
  script?: string;
  meta?: StyleMeta;
  error?: string;
}

interface ImportResult {
  imported: number;
  errors: string[];
}

interface DraftPreviewOptions {
  tabId?: number;
  values?: Record<string, StyleVariableValue>;
  colorScheme?: PreviewColorScheme;
}

interface DraftPreviewResult {
  success?: boolean;
  error?: string;
  tabId?: number;
  tabUrl?: string;
  styleName?: string;
  cssBytes?: number;
}

interface DraftPreviewClearResult {
  success: boolean;
  cleared: number;
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
let _customVars: Record<string, Record<string, StyleVariableValue>> = {};
let _initialized = false;
type InjectionRegistryKey = string;

// Firefox 153+ gives each loaded document a stable identity. Keep the tab-only
// key for Chrome and older Firefox builds, but use a document key whenever the
// caller has one so a reload cannot inherit the previous document's dedup
// record. The CSS APIs still receive tabId because it is required alongside
// documentIds by the cross-browser injection target shape.
const _registeredTabs: Map<InjectionRegistryKey, Map<string, string>> = new Map();
const _currentDocumentIds: Map<number, string> = new Map();
const _draftPreviewTabs: Map<number, string> = new Map();
const _injectingTabs: Set<InjectionRegistryKey> = new Set();
const PERSISTENT_REGISTRATION_PREFIX = 'scriptvault-usercss-';
let _persistentRegistrationSupported = false;
let _persistentRegistrationChain: Promise<boolean> = Promise.resolve(false);
// Latest URL that arrived for a tab while an injection pass was in flight. The
// re-entrancy guard used to DROP those events, so a client-side router firing
// several pushState calls in a row could leave the final route unprocessed —
// a style stuck on a non-matching route, or a newly matching route with no
// sheet until the next real navigation. Only the newest URL is worth keeping:
// intermediate routes are already superseded.
const _pendingTabUrls: Map<InjectionRegistryKey, string> = new Map();
// Serializes previewDraft/clearDraftPreview: overlapping calls would both
// insert CSS while _draftPreviewTabs remembers only the last, orphaning the
// earlier sheet on the page until navigation.
let _draftPreviewChain: Promise<unknown> = Promise.resolve();

function _normalizeDocumentId(value: unknown): string | undefined {
  const id = typeof value === 'string' ? value.trim() : '';
  return id && id.length <= 256 ? id : undefined;
}

function _tabRegistryKey(tabId: number): InjectionRegistryKey {
  return `tab:${tabId}`;
}

function _documentRegistryKey(tabId: number, documentId: string): InjectionRegistryKey {
  return `document:${tabId}:${documentId}`;
}

function _documentIdForTab(tabId: number, explicitDocumentId?: unknown): string | undefined {
  return _normalizeDocumentId(explicitDocumentId) ?? _currentDocumentIds.get(tabId);
}

function _registryKeyForTab(tabId: number, explicitDocumentId?: unknown): InjectionRegistryKey {
  const documentId = _normalizeDocumentId(explicitDocumentId);
  if (documentId) {
    const current = _currentDocumentIds.get(tabId);
    if (current !== documentId) {
      _deleteTabRegistries(tabId);
      _currentDocumentIds.set(tabId, documentId);
    }
    return _documentRegistryKey(tabId, documentId);
  }
  const current = _currentDocumentIds.get(tabId);
  return current ? _documentRegistryKey(tabId, current) : _tabRegistryKey(tabId);
}

function _injectionTarget(tabId: number, explicitDocumentId?: unknown): { tabId: number; documentIds?: string[] } {
  const documentId = _documentIdForTab(tabId, explicitDocumentId);
  return documentId ? { tabId, documentIds: [documentId] } : { tabId };
}

function _deleteTabRegistries(tabId: number): void {
  _registeredTabs.delete(_tabRegistryKey(tabId));
  const prefix = `document:${tabId}:`;
  for (const key of _registeredTabs.keys()) {
    if (key.startsWith(prefix)) _registeredTabs.delete(key);
  }
}

function _isFirefoxRuntime(): boolean {
  try {
    return /Firefox\//.test(String((globalThis as any).navigator?.userAgent || ''));
  } catch {
    return false;
  }
}

async function _readCurrentDocumentId(tabId: number): Promise<string | undefined> {
  if (!_isFirefoxRuntime()) return undefined;
  const getFrame = (chrome.webNavigation as any)?.getFrame;
  if (typeof getFrame !== 'function') return undefined;
  try {
    const frame = await getFrame({ tabId, frameId: 0 });
    return _normalizeDocumentId(frame?.documentId);
  } catch {
    return undefined;
  }
}

/* ------------------------------------------------------------------ */
/*  Storage helpers                                                    */
/* ------------------------------------------------------------------ */

async function _loadState(): Promise<void> {
  try {
    const data: Record<string, unknown> = await chrome.storage.local.get([STORAGE_KEY, VARS_STORAGE_KEY]);
    _styles = (data[STORAGE_KEY] as Record<string, StyleEntry> | undefined) ?? {};
    _customVars = (data[VARS_STORAGE_KEY] as Record<string, Record<string, StyleVariableValue>> | undefined) ?? {};
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

function _stripQuotedValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && ((trimmed.startsWith('"') && trimmed.endsWith('"'))
      || (trimmed.startsWith("'") && trimmed.endsWith("'")))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function _splitTopLevel(value: string, separator = ','): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote = '';
  let start = 0;
  for (let index = 0; index < value.length; index++) {
    const char = value[index] ?? '';
    if (quote) {
      if (char === quote && value[index - 1] !== '\\') quote = '';
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '(') {
      depth++;
    } else if (char === ')') {
      depth--;
    } else if (char === separator && depth === 0) {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(value.slice(start).trim());
  return parts;
}

function _detectColorSpace(value: string): ColorSpace {
  const normalized = _stripQuotedValue(value).toLowerCase();
  if (/^#[0-9a-f]+$/i.test(normalized)) return 'hex';
  if (/^rgba?\(/.test(normalized)) return 'rgb';
  if (/^hsla?\(/.test(normalized)) return 'hsl';
  if (/^oklch\(/.test(normalized)) return 'oklch';
  if (/^oklab\(/.test(normalized)) return 'oklab';
  if (/^[a-z][a-z0-9-]*$/i.test(normalized)) return 'named';
  return 'css';
}

function _validateColorValue(value: unknown, label = 'Color'): string {
  if (typeof value !== 'string') return `${label} must be a CSS color string.`;
  const color = _stripQuotedValue(value);
  if (!color) return `${label} cannot be empty.`;
  if (color.length > 256) return `${label} must be 256 characters or fewer.`;
  if (/[;{}\x00-\x1f\x7f]/.test(color)) return `${label} contains unsafe CSS characters.`;
  if (/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color)) return '';
  if (/^(?:transparent|currentcolor|canvas|canvastext|accentcolor|accentcolortext|[a-z]+)$/i.test(color)) return '';

  const functional = color.match(/^([a-z][a-z0-9-]*)\(([\s\S]*)\)$/i);
  if (!functional) return `${label} is not a supported CSS color.`;
  const functionName = (functional[1] ?? '').toLowerCase();
  const body = functional[2] ?? '';
  const supported = new Set([
    'rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'lab', 'lch', 'oklab', 'oklch',
    'color', 'color-mix', 'light-dark', 'var',
  ]);
  if (!supported.has(functionName)) return `${label} uses unsupported ${functionName}() syntax.`;

  let depth = 0;
  for (const char of body) {
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (depth < 0) return `${label} has unbalanced parentheses.`;
  }
  if (depth !== 0) return `${label} has unbalanced parentheses.`;

  if (functionName === 'light-dark') {
    const choices = _splitTopLevel(body);
    if (choices.length !== 2) return `${label} light-dark() requires light and dark colors.`;
    return _validateColorValue(choices[0], `${label} light value`)
      || _validateColorValue(choices[1], `${label} dark value`);
  }
  if (functionName === 'oklab' || functionName === 'oklch') {
    const components = body.split('/')[0]?.trim().split(/\s+/).filter(Boolean) ?? [];
    if (components.length !== 3) return `${label} ${functionName}() requires three components.`;
  }
  if (functionName === 'hsl' || functionName === 'hsla') {
    const components = body.includes(',')
      ? _splitTopLevel(body)
      : (body.split('/')[0]?.trim().split(/\s+/).filter(Boolean) ?? []);
    if (components.length < 3) return `${label} ${functionName}() requires hue, saturation, and lightness.`;
  }
  return '';
}

function _parseAdvancedColorValue(rawValue: string): {
  value: string;
  group?: string;
  colorSchemes?: ColorSchemeDefaults;
} {
  const annotations: Array<{ name: string; start: number; valueStart: number }> = [];
  const annotationRegex = /\s+@(group|light|dark)\s+/gi;
  let match: RegExpExecArray | null;
  while ((match = annotationRegex.exec(rawValue)) !== null) {
    annotations.push({
      name: (match[1] ?? '').toLowerCase(),
      start: match.index,
      valueStart: annotationRegex.lastIndex,
    });
  }

  const base = _stripQuotedValue(rawValue.slice(0, annotations[0]?.start ?? rawValue.length));
  let group = '';
  let light = '';
  let dark = '';
  annotations.forEach((annotation, index) => {
    const end = annotations[index + 1]?.start ?? rawValue.length;
    const annotationValue = _stripQuotedValue(rawValue.slice(annotation.valueStart, end));
    if (annotation.name === 'group') group = annotationValue.replace(/^#/, '');
    if (annotation.name === 'light') light = annotationValue;
    if (annotation.name === 'dark') dark = annotationValue;
  });

  const colorSchemes = light || dark
    ? { light: light || base, dark: dark || base }
    : undefined;
  return {
    value: base,
    ...(group ? { group } : {}),
    ...(colorSchemes ? { colorSchemes } : {}),
  };
}

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
  let varName: string;
  let label: string;
  let defaultVal: string | number | boolean;
  if (nameMatch) {
    varName = nameMatch[1] ?? '';
    label = nameMatch[2] ?? '';
    defaultVal = (nameMatch[3] ?? '').trim();
  } else {
    // Label-less form: `@var type name default`. Must run the same per-type
    // coercion below — a string default for number/checkbox would otherwise
    // fail validateUserCSSVariables and reject the whole style.
    const simpleMatch: RegExpMatchArray | null = rest.match(/^(\S+)\s+(.*)$/);
    if (!simpleMatch) return null;
    varName = simpleMatch[1] ?? '';
    label = varName;
    defaultVal = (simpleMatch[2] ?? '').trim();
  }
  let options: StyleVariable['options'] = null;
  let group: string | undefined;
  let colorSpace: ColorSpace | undefined;
  let colorSchemes: ColorSchemeDefaults | undefined;

  switch (type) {
    case 'color':
      // ScriptVault's backwards-compatible annotations extend the normal
      // UserCSS color value without changing simple @var behavior:
      //   @group palette   links aliases to one configuration control
      //   @light/@dark     provide prefers-color-scheme alternatives
      {
        const advanced = _parseAdvancedColorValue(String(defaultVal));
        defaultVal = advanced.value;
        group = advanced.group;
        colorSchemes = advanced.colorSchemes;
        colorSpace = _detectColorSpace(advanced.value);
      }
      break;

    case 'text':
      // Strip surrounding quotes if present. JSON-decode so escaped
      // quotes/backslashes written by _serializeStyleVariable round-trip.
      if (/^"[\s\S]*"$/.test(defaultVal as string)) {
        try {
          defaultVal = JSON.parse(defaultVal as string) as string;
        } catch {
          defaultVal = (defaultVal as string).slice(1, -1);
        }
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

  return {
    type,
    name: varName,
    label,
    default: defaultVal,
    options,
    ...(group ? { group } : {}),
    ...(colorSpace ? { colorSpace } : {}),
    ...(colorSchemes ? { colorSchemes } : {}),
  };
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
    } else if (Object.prototype.hasOwnProperty.call(meta, key)) {
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

  const validation = validateUserCSSVariables(variables);
  if (!validation.valid) {
    return { error: validation.errors.join(' ') };
  }

  const result: ParseResult = {
    meta,
    variables,
    match: matchPatterns.length ? matchPatterns : ['*://*/*'],
    css,
  };
  const preprocessor = (meta.preprocessor || 'default').toLowerCase();
  if (_UNSUPPORTED_PREPROCESSORS.has(preprocessor)) {
    result.warning = `This style declares "@preprocessor ${meta.preprocessor}", which requires a ${preprocessor === 'less' ? 'Less' : 'Stylus'} compiler that ScriptVault does not bundle. Its variables are substituted, but its ${preprocessor} syntax is not compiled and may not render correctly. Convert it to plain CSS (default/uso) for full support.`;
  }
  return result;
}

function _isColorSchemeValue(value: unknown): value is ColorSchemeValue {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && typeof (value as ColorSchemeValue).light === 'string'
    && typeof (value as ColorSchemeValue).dark === 'string';
}

function _validateVariableValue(variable: StyleVariable, value: StyleVariableValue): string {
  if (variable.type === 'color') {
    if (_isColorSchemeValue(value)) {
      return _validateColorValue(value.light, `${variable.label} light color`)
        || _validateColorValue(value.dark, `${variable.label} dark color`);
    }
    return _validateColorValue(value, variable.label || variable.name);
  }
  if (variable.type === 'checkbox' && typeof value !== 'boolean') {
    return `${variable.label || variable.name} must be true or false.`;
  }
  if ((variable.type === 'number' || variable.type === 'range')
      && (typeof value !== 'number' || !Number.isFinite(value))) {
    return `${variable.label || variable.name} must be a finite number.`;
  }
  if (variable.type === 'select' && variable.options
      && !Object.prototype.hasOwnProperty.call(variable.options, String(value))) {
    return `${variable.label || variable.name} must use a configured option.`;
  }
  if (variable.type === 'text' && typeof value === 'string') {
    // Text values are spliced into page CSS: block rule/selector injection
    // (`{}`) and control characters. `;` stays allowed for data: URIs.
    if (value.length > 8192) {
      return `${variable.label || variable.name} must be 8192 characters or fewer.`;
    }
    if (/[{}\x00-\x1f\x7f]/.test(value)) {
      return `${variable.label || variable.name} contains unsafe CSS characters.`;
    }
  }
  if (typeof value === 'object') return `${variable.label || variable.name} has an invalid value.`;
  return '';
}

function validateUserCSSVariables(
  variables: StyleVariable[],
  values: Record<string, StyleVariableValue> = {},
): UserCSSValidationResult {
  const errors: string[] = [];
  const names = new Set<string>();
  const reservedNames = new Set(['__proto__', 'prototype', 'constructor']);
  for (const variable of variables) {
    if (!/^-?[_a-z][\w-]*$/i.test(variable.name) || reservedNames.has(variable.name.toLowerCase())) {
      errors.push('UserCSS variable names must be non-empty CSS identifiers.');
      continue;
    }
    if (names.has(variable.name)) {
      errors.push(`Duplicate UserCSS variable: ${variable.name}.`);
      continue;
    }
    names.add(variable.name);
    if (variable.group && !/^[a-z0-9_-]{1,64}$/i.test(variable.group)) {
      errors.push(`${variable.label || variable.name} has an invalid color group.`);
    }
    const defaultError = _validateVariableValue(variable, variable.colorSchemes ?? variable.default);
    if (defaultError) errors.push(defaultError);
  }

  for (const [name, value] of Object.entries(values)) {
    const variable = variables.find(candidate => candidate.name === name);
    if (!variable) {
      errors.push(`Unknown UserCSS variable: ${name}.`);
      continue;
    }
    const valueError = _validateVariableValue(variable, value);
    if (valueError) errors.push(valueError);
  }
  return { valid: errors.length === 0, errors };
}

function _expandLinkedGroupValues(
  variables: StyleVariable[],
  values: Record<string, StyleVariableValue>,
): Record<string, StyleVariableValue> {
  const expanded: Record<string, StyleVariableValue> = { ...values };
  for (const [name, value] of Object.entries(values)) {
    const source = variables.find(variable => variable.name === name);
    if (!source?.group || source.type !== 'color') continue;
    for (const linked of variables) {
      if (linked.type === 'color' && linked.group === source.group) {
        expanded[linked.name] = value;
      }
    }
  }
  return expanded;
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
  customValues: Record<string, StyleVariableValue> | undefined,
  colorScheme: PreviewColorScheme = 'auto',
): string {
  if (colorScheme === 'auto' && variables.some((variable) => {
    const configured = customValues && customValues[variable.name] !== undefined
      ? customValues[variable.name]
      : (variable.colorSchemes ?? variable.default);
    return _isColorSchemeValue(configured);
  })) {
    const lightCSS = _substituteVariables(css, variables, customValues, 'light');
    const darkCSS = _substituteVariables(css, variables, customValues, 'dark');
    return `${lightCSS}\n@media (prefers-color-scheme: dark) {\n${darkCSS}\n}`;
  }

  let result: string = css;

  for (const v of variables) {
    const configured: StyleVariableValue =
      customValues && customValues[v.name] !== undefined
        ? customValues[v.name]!
        : (v.colorSchemes ?? v.default);
    let val: PrimitiveStyleVariableValue;
    if (_isColorSchemeValue(configured)) {
      val = colorScheme === 'dark' ? configured.dark : configured.light;
    } else {
      val = configured;
    }

    // Function replacements throughout: a string replacement would expand
    // `$'`/`$&` patterns in the value, splicing surrounding stylesheet text
    // past the structural validation.
    const replacement: string = String(val);

    // Replace /*[[varName]]*/ placeholders
    const placeholder: RegExp = new RegExp(
      '/\\*\\[\\[' + _escapeRegex(v.name) + '\\]\\]\\*/', 'g',
    );
    result = result.replace(placeholder, () => replacement);

    // Replace <<varName>> placeholders (less-style)
    const anglePlaceholder: RegExp = new RegExp(
      '<<' + _escapeRegex(v.name) + '>>', 'g',
    );
    result = result.replace(anglePlaceholder, () => replacement);

    // CSS-native UserCSS variables are aliases, not declarations in the
    // source file. Resolve them to the same configured value so placeholder
    // and var(--name) forms render identically.
    result = _replaceCssVarAliases(result, v.name, replacement);
  }

  return result;
}

/**
 * Replace `var(--name)` / `var(--name, fallback)` references with a value.
 * Fallback arguments may contain nested parentheses (rgb(), hsl(), …), so
 * the closing paren is found by depth scan rather than `[^)]*`.
 */
function _replaceCssVarAliases(css: string, name: string, replacement: string): string {
  const open: RegExp = new RegExp('var\\(\\s*--' + _escapeRegex(name) + '\\s*(?=[,)])', 'g');
  let result = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = open.exec(css)) !== null) {
    let depth = 1;
    let end: number = match.index + match[0].length;
    while (end < css.length && depth > 0) {
      const char: string = css[end] ?? '';
      if (char === '(') depth++;
      else if (char === ')') depth--;
      end++;
    }
    if (depth !== 0) break;
    result += css.slice(lastIndex, match.index) + replacement;
    lastIndex = end;
    open.lastIndex = end;
  }
  return result + css.slice(lastIndex);
}

function _escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* ------------------------------------------------------------------ */
/*  Style registration via chrome.scripting                            */
/* ------------------------------------------------------------------ */

interface ShadowStyleInstruction {
  id: string;
  css: string;
}

/**
 * Runs inside the target document's isolated world. `insertCSS` styles the
 * document tree but cannot cross a shadow boundary, so keep one bounded,
 * per-document registry of `<style>` nodes for every open shadow root.
 *
 * The observer only watches the host tree; a scan is chunked into small idle
 * turns so pages with many hosts remain responsive. The function is passed to
 * `chrome.scripting.executeScript` and therefore must not capture extension
 * state or call any service-worker APIs.
 */
function _syncShadowStylesInDocument(styles: ShadowStyleInstruction[]): void {
  const pageGlobal: any = globalThis as any;
  const pageDocument: any = pageGlobal.document;
  if (!pageDocument) return;

  const stateKey = '__scriptvaultUserStyleShadowState';
  const state: any = pageGlobal[stateKey] ?? (pageGlobal[stateKey] = {
    entries: new Map<string, { css: string; nodes: Map<any, any> }>(),
    observers: new Map<any, any>(),
    documentRoot: null,
    scanning: false,
    scanAgain: false,
  });
  if (!state.observers) state.observers = new Map<any, any>();
  const desired = new Map<string, string>();
  for (const style of Array.isArray(styles) ? styles : []) {
    if (style?.id && style.css) desired.set(String(style.id), String(style.css));
  }

  const removeEntry = (entry: { css: string; nodes: Map<any, any> }): void => {
    for (const node of entry.nodes.values()) {
      try { node.remove(); } catch { /* root/document may have been replaced */ }
    }
    entry.nodes.clear();
  };
  for (const [id, entry] of state.entries) {
    if (!desired.has(id)) {
      removeEntry(entry);
      state.entries.delete(id);
    }
  }
  for (const [id, css] of desired) {
    const existing = state.entries.get(id);
    if (existing) {
      if (existing.css !== css) {
        existing.css = css;
        for (const node of existing.nodes.values()) node.textContent = css;
      }
    } else {
      state.entries.set(id, { css, nodes: new Map<any, any>() });
    }
  }

  const hasEntries = state.entries.size > 0;
  const observedRoot = pageDocument.documentElement || pageDocument;
  if (!hasEntries) {
    for (const observer of state.observers.values()) observer?.disconnect?.();
    state.observers.clear();
    delete pageGlobal[stateKey];
    return;
  }
  const Observer = pageGlobal.MutationObserver;
  const observeRoot = (root: any): void => {
    if (typeof Observer !== 'function' || !root?.nodeType || state.observers.has(root)) return;
    const observer = new Observer(() => scheduleScan());
    observer.observe(root, { childList: true, subtree: true });
    state.observers.set(root, observer);
  };
  if (state.documentRoot !== observedRoot) {
    for (const observer of state.observers.values()) observer?.disconnect?.();
    state.observers.clear();
    state.documentRoot = observedRoot;
  }
  observeRoot(observedRoot);

  const applyToRoot = (shadowRoot: any, entry: { css: string; nodes: Map<any, any> }): void => {
    if (!shadowRoot?.appendChild) return;
    const previous = entry.nodes.get(shadowRoot);
    if (previous) {
      if (previous.textContent !== entry.css) previous.textContent = entry.css;
      return;
    }
    const styleNode = pageDocument.createElement('style');
    styleNode.setAttribute('data-scriptvault-userstyle', '');
    styleNode.textContent = entry.css;
    try {
      shadowRoot.appendChild(styleNode);
      entry.nodes.set(shadowRoot, styleNode);
    } catch { /* closed or detached root */ }
  };

  const pruneDetachedRoots = (): void => {
    for (const entry of state.entries.values()) {
      for (const [shadowRoot, node] of entry.nodes) {
        if (shadowRoot?.host?.isConnected) continue;
        try { node.remove(); } catch { /* already detached */ }
        entry.nodes.delete(shadowRoot);
        state.observers.get(shadowRoot)?.disconnect?.();
        state.observers.delete(shadowRoot);
      }
    }
  };

  function scheduleScan(): void {
    if (state.scanning) {
      state.scanAgain = true;
      return;
    }
    state.scanning = true;
    state.scanAgain = false;
    pruneDetachedRoots();
    const roots: any[] = [pageDocument];
    const seenRoots = new Set<any>();
    let rootIndex = 0;
    let hosts: any[] = [];
    let hostIndex = 0;

    const runChunk = (): void => {
      let budget = 200;
      while (budget-- > 0) {
        if (hostIndex < hosts.length) {
          const host = hosts[hostIndex++];
          const shadowRoot = host?.shadowRoot;
          if (!shadowRoot || seenRoots.has(shadowRoot)) continue;
          seenRoots.add(shadowRoot);
          roots.push(shadowRoot);
          observeRoot(shadowRoot);
          for (const entry of state.entries.values()) applyToRoot(shadowRoot, entry);
          continue;
        }
        if (rootIndex >= roots.length) {
          state.scanning = false;
          if (state.scanAgain) {
            state.scanAgain = false;
            scheduleScan();
          }
          return;
        }
        const root = roots[rootIndex++];
        try {
          hosts = Array.from(root.querySelectorAll?.('*') ?? []);
        } catch {
          hosts = [];
        }
        hostIndex = 0;
      }
      const idle = pageGlobal.requestIdleCallback;
      if (typeof idle === 'function') idle(runChunk, { timeout: 100 });
      else pageGlobal.setTimeout(runChunk, 0);
    };
    runChunk();
  }

  scheduleScan();
}

async function _syncShadowStylesToTab(
  tabId: number,
  url?: string,
  extraStyles: ShadowStyleInstruction[] = [],
  documentId?: string,
): Promise<void> {
  const executeScript = (chrome.scripting as any)?.executeScript;
  if (typeof executeScript !== 'function') return;

  let targetUrl = url;
  if (!targetUrl) {
    try {
      targetUrl = (await chrome.tabs.get(tabId))?.url;
    } catch {
      targetUrl = undefined;
    }
  }
  const desired: ShadowStyleInstruction[] = [];
  if (targetUrl) {
    for (const [styleId, style] of Object.entries(_styles)) {
      if (!style.enabled || !_urlMatchesPatterns(targetUrl, style.match)) continue;
      const css = _buildCSS(styleId);
      if (css) desired.push({ id: styleId, css });
    }
  }
  const draftCss = _draftPreviewTabs.get(tabId);
  if (draftCss) desired.push({ id: '__draft__', css: draftCss });
  desired.push(...extraStyles.filter((style) => style?.id && style.css));
  try {
    await executeScript({
      target: _injectionTarget(tabId, documentId),
      func: _syncShadowStylesInDocument,
      args: [desired],
    });
  } catch {
    // Internal pages, missing host permission, and closed tabs are not
    // injectable; the normal document CSS path reports the same outcome.
  }
}

/**
 * Build the final CSS for a style, applying variable substitutions.
 */
function _buildCSS(styleId: string): string {
  const style: StyleEntry | undefined = _styles[styleId];
  if (!style) return '';
  const vars: StyleVariable[] = style.variables ?? [];
  const custom: Record<string, StyleVariableValue> = _customVars[styleId] ?? {};
  return _substituteVariables(style.css, vars, custom);
}

function _persistentMatchPatterns(style: StyleEntry): string[] {
  const patterns = Array.isArray(style.match) && style.match.length > 0 ? style.match : ['*://*/*'];
  return patterns
    .map((pattern) => String(pattern || '').trim())
    .filter((pattern) => {
      if (pattern === '<all_urls>') return true;
      try {
        _matchPatternToRegex(pattern);
        return true;
      } catch {
        return false;
      }
    });
}

async function _syncPersistentRegistrationsNow(): Promise<boolean> {
  const scripting: any = chrome.scripting as any;
  if (typeof scripting?.registerContentScripts !== 'function' ||
      typeof scripting?.unregisterContentScripts !== 'function' ||
      typeof scripting?.getRegisteredContentScripts !== 'function') {
    _persistentRegistrationSupported = false;
    return false;
  }

  try {
    const registered = await scripting.getRegisteredContentScripts();
    const staleIds = (Array.isArray(registered) ? registered : [])
      .map((entry: any) => entry?.id)
      .filter((id: any): id is string => typeof id === 'string' && id.startsWith(PERSISTENT_REGISTRATION_PREFIX));
    if (staleIds.length > 0) await scripting.unregisterContentScripts({ ids: staleIds });

    let hasEnabledStyles = false;
    for (const [styleId, style] of Object.entries(_styles)) {
      if (!style.enabled) continue;
      const css = _buildCSS(styleId);
      const matches = _persistentMatchPatterns(style);
      if (!css || matches.length === 0) continue;
      hasEnabledStyles = true;
    }
    // RegisteredContentScript.css is a list of packaged file paths. UserCSS is
    // stored as inline text and cannot be represented by that API without
    // generating a new extension asset, so always use insertCSS for these
    // dynamic records. The capability probe above remains useful for cleaning
    // registrations left by older builds.
    _persistentRegistrationSupported = !hasEnabledStyles;
    return _persistentRegistrationSupported;
  } catch (error: unknown) {
    _persistentRegistrationSupported = false;
    console.warn('[UserStylesEngine] Persistent document_start registration unavailable:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

function _syncPersistentRegistrations(): Promise<boolean> {
  const queued = _persistentRegistrationChain.then(_syncPersistentRegistrationsNow, _syncPersistentRegistrationsNow);
  _persistentRegistrationChain = queued.catch(() => false);
  return queued;
}

function _buildDraftPreviewCSS(
  usercssCode: string,
  options: DraftPreviewOptions = {},
): DraftPreviewResult & { css?: string; match?: string[] } {
  const parsed: ParseResult = parseUserCSS(usercssCode);
  if (parsed.error) return { error: parsed.error };

  const variables: StyleVariable[] = parsed.variables ?? [];
  const defaults: Record<string, StyleVariableValue> = {};
  for (const variable of variables) {
    defaults[variable.name] = variable.colorSchemes ?? variable.default;
  }

  const providedValues = options.values ?? {};
  const validation = validateUserCSSVariables(variables, providedValues);
  if (!validation.valid) return { error: validation.errors.join(' ') };
  const values = { ...defaults, ..._expandLinkedGroupValues(variables, providedValues) };
  const css: string = _substituteVariables(
    parsed.css ?? '',
    variables,
    values,
    options.colorScheme ?? 'auto',
  ).trim();
  if (!css) return { error: 'UserCSS draft has no CSS to preview.' };

  return {
    css,
    match: parsed.match ?? ['*://*/*'],
    styleName: parsed.meta?.name || 'UserCSS draft',
  };
}

async function _getPreviewTab(tabId?: number): Promise<chrome.tabs.Tab | null> {
  if (typeof tabId === 'number') {
    try {
      return await chrome.tabs.get(tabId);
    } catch {
      return null;
    }
  }

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return activeTab ?? null;
}

async function _removeDraftPreviewFromTab(tabId: number): Promise<boolean> {
  const previousCss: string | undefined = _draftPreviewTabs.get(tabId);
  if (!previousCss) return false;

  try {
    await chrome.scripting.removeCSS({
      target: _injectionTarget(tabId),
      css: previousCss,
    });
  } catch {
    // The tab may have navigated or closed. The bookkeeping must still clear.
  }
  _draftPreviewTabs.delete(tabId);
  await _syncShadowStylesToTab(tabId);
  return true;
}

function _enqueueDraftPreviewTask<T>(task: () => Promise<T>): Promise<T> {
  const queued: Promise<T> = _draftPreviewChain.then(task, task);
  _draftPreviewChain = queued.catch(() => undefined);
  return queued;
}

function clearDraftPreview(options: DraftPreviewOptions = {}): Promise<DraftPreviewClearResult> {
  return _enqueueDraftPreviewTask(() => _clearDraftPreviewNow(options));
}

async function _clearDraftPreviewNow(options: DraftPreviewOptions = {}): Promise<DraftPreviewClearResult> {
  if (typeof options.tabId === 'number') {
    const cleared: boolean = await _removeDraftPreviewFromTab(options.tabId);
    return { success: true, cleared: cleared ? 1 : 0 };
  }

  let cleared = 0;
  for (const tabId of Array.from(_draftPreviewTabs.keys())) {
    if (await _removeDraftPreviewFromTab(tabId)) cleared++;
  }
  return { success: true, cleared };
}

function previewDraft(usercssCode: string, options: DraftPreviewOptions = {}): Promise<DraftPreviewResult> {
  return _enqueueDraftPreviewTask(() => _previewDraftNow(usercssCode, options));
}

async function _previewDraftNow(usercssCode: string, options: DraftPreviewOptions = {}): Promise<DraftPreviewResult> {
  const built = _buildDraftPreviewCSS(usercssCode, options);
  if (built.error || !built.css || !built.match) return { error: built.error || 'Unable to preview UserCSS draft.' };

  const tab = await _getPreviewTab(options.tabId);
  if (tab?.id == null) return { error: 'No active tab is available for preview.' };
  if (!_urlMatchesPatterns(tab.url, built.match)) {
    return { error: 'The UserCSS @match rules do not include the preview tab.' };
  }

  await _removeDraftPreviewFromTab(tab.id);
  try {
    await chrome.scripting.insertCSS({
      target: _injectionTarget(tab.id),
      css: built.css,
    });
    _draftPreviewTabs.set(tab.id, built.css);
    await _syncShadowStylesToTab(tab.id, tab.url, [{ id: '__draft__', css: built.css }]);
    return {
      success: true,
      tabId: tab.id,
      tabUrl: tab.url || '',
      styleName: built.styleName,
      cssBytes: built.css.length,
    };
  } catch (e: unknown) {
    const message: string = e instanceof Error ? e.message : String(e);
    _draftPreviewTabs.delete(tab.id);
    return { error: message || 'Failed to inject UserCSS preview.' };
  }
}

/**
 * Register a style for injection.
 */
async function registerStyle(style: StyleRegistration): Promise<string> {
  if (!_initialized) await _loadState();

  const variableValidation = validateUserCSSVariables(style.variables ?? []);
  if (!variableValidation.valid) throw new Error(variableValidation.errors.join(' '));

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
  await _syncPersistentRegistrations();

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
  await _syncPersistentRegistrations();
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id != null) await _syncShadowStylesToTab(tab.id, tab.url);
    }
  } catch {
    // Tabs can close while the style record is being removed.
  }
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
  await _syncPersistentRegistrations();

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
        const documentId = _documentIdForTab(tab.id);
        const registryKey = _registryKeyForTab(tab.id, documentId);
        const tabStyles: Map<string, string> = _registeredTabs.get(registryKey) ?? new Map<string, string>();
        const previousCss: string | undefined = tabStyles.get(styleId);
        // Dedup: identical CSS already injected for this document — do not
        // stack a duplicate sheet on a repeated inject pass.
        if (previousCss !== css) {
          try {
            if (previousCss) {
              try {
                await chrome.scripting.removeCSS({
                  target: _injectionTarget(tab.id, documentId),
                  css: previousCss,
                });
              } catch {
                // The tab may have navigated since the previous injection.
              }
            }
            await chrome.scripting.insertCSS({
              target: _injectionTarget(tab.id, documentId),
              css,
            });
            tabStyles.set(styleId, css);
            _registeredTabs.set(registryKey, tabStyles);
          } catch {
            // Tab may not be injectable (chrome://, etc.)
          }
        }
        await _syncShadowStylesToTab(tab.id, tab.url, [], documentId);
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
  // Reconstruct the current CSS so we can also clear an orphaned injection whose
  // per-tab record was lost when the service worker was torn down and restarted
  // (the injected sheet persists in the live document even though _registeredTabs
  // is in-memory). removeCSS matches by exact string, so this only clears the
  // sheet when the reconstructed CSS still equals what was injected.
  const reconstructedCss: string = _buildCSS(styleId);
  try {
    const tabs: chrome.tabs.Tab[] = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id == null) continue;
      const documentId = _documentIdForTab(tab.id);
      const registryKey = _registryKeyForTab(tab.id, documentId);
      const tabStyles: Map<string, string> | undefined = _registeredTabs.get(registryKey);
      const registeredCss: string | undefined = tabStyles?.get(styleId);
      const cssToRemove: string | undefined = registeredCss ?? (reconstructedCss || undefined);
      if (cssToRemove) {
        try {
          await chrome.scripting.removeCSS({
            target: _injectionTarget(tab.id, documentId),
            css: cssToRemove,
          });
        } catch {
          // Tab may have been closed, navigated, or never carried this sheet.
        }
      }
      if (tabStyles) {
        tabStyles.delete(styleId);
        if (tabStyles.size === 0) {
          _registeredTabs.delete(registryKey);
        }
      }
      await _syncShadowStylesToTab(tab.id, tab.url, [], documentId);
    }
  } catch (e: unknown) {
    console.error('[UserStylesEngine] Remove failed:', e);
  }
}

/**
 * Forget the injected-CSS registry for a tab whose document was just replaced
 * (navigation or reload). The previously injected sheets are gone with the old
 * document, so the next inject pass must treat the tab as a clean slate — this
 * is what makes the onTabUpdated dedup safe across navigations.
 */
function onTabNavigated(tabId: number, documentId?: string): void {
  _deleteTabRegistries(tabId);
  _currentDocumentIds.delete(tabId);
  const normalized = _normalizeDocumentId(documentId);
  if (normalized) _currentDocumentIds.set(tabId, normalized);
}

/**
 * Re-apply every enabled style to all currently open matching tabs. Called once
 * after the service worker restarts: the in-memory registry is empty but a
 * previously injected sheet may still persist in a live document, so remove any
 * reconstructed match first and re-insert exactly one sheet.
 */
async function rehydrateOpenTabs(): Promise<void> {
  if (!_initialized) await _loadState();
  let tabs: chrome.tabs.Tab[];
  try {
    tabs = await chrome.tabs.query({});
  } catch {
    return;
  }
  const documentIds = new Map<number, string>();
  for (const tab of tabs) {
    if (tab.id == null) continue;
    const documentId = await _readCurrentDocumentId(tab.id);
    if (documentId) {
      documentIds.set(tab.id, documentId);
      _currentDocumentIds.set(tab.id, documentId);
    }
  }
  for (const [styleId, style] of Object.entries(_styles)) {
    if (!style.enabled) continue;
    const css: string = _buildCSS(styleId);
    if (!css) continue;
    for (const tab of tabs) {
      if (tab.id == null) continue;
      if (!_urlMatchesPatterns(tab.url, style.match)) continue;
      const documentId = documentIds.get(tab.id);
      const registryKey = _registryKeyForTab(tab.id, documentId);
      const tabStyles: Map<string, string> = _registeredTabs.get(registryKey) ?? new Map<string, string>();
      if (tabStyles.get(styleId) === css) continue;
      try {
        // Clear a possible orphaned duplicate from before the restart, then
        // inject exactly one fresh sheet.
        try {
          await chrome.scripting.removeCSS({ target: _injectionTarget(tab.id, documentId), css });
        } catch {
          // Nothing to remove.
        }
        await chrome.scripting.insertCSS({ target: _injectionTarget(tab.id, documentId), css });
        tabStyles.set(styleId, css);
        _registeredTabs.set(registryKey, tabStyles);
      } catch {
        // Tab not injectable.
      }
    }
  }
  for (const tab of tabs) {
    if (tab.id != null) await _syncShadowStylesToTab(tab.id, tab.url, [], documentIds.get(tab.id));
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
  const rawHost: string = match[2] ?? '';
  const path: string = match[3] ?? '';

  // Match patterns do not require a port, but the URL being tested may carry
  // one (localhost test servers and development origins commonly do). Preserve
  // an explicitly supplied port for permissive legacy inputs; otherwise allow
  // any URL port exactly as the WebExtension matcher does.
  const explicitPort = rawHost.match(/:(\d+)$/);
  const host: string = explicitPort ? rawHost.slice(0, -explicitPort[0].length) : rawHost;

  const schemeRegex =
    scheme === '*'
      ? 'https?'
      : _escapeRegex(scheme);

  let hostRegex = '';
  let portRegex = '';
  if (scheme !== 'file') {
    if (host === '*') {
      hostRegex = '[^/]+';
    } else if (host.startsWith('*.')) {
      hostRegex = `(?:[^/]+\\.)*${_escapeRegex(host.slice(2))}`;
    } else {
      hostRegex = _escapeRegex(host);
    }
    if (explicitPort) {
      portRegex = _escapeRegex(explicitPort[0]);
    } else if (host !== '*') {
      portRegex = '(?::\\d+)?';
    }
  }

  // Collapse consecutive `*` before conversion. Without this, N adjacent
  // wildcards become N adjacent `.*` groups — catastrophic backtracking that
  // freezes the service worker for every evaluated URL (a 12-star @match in a
  // .user.css measured ~78s per test()). The userscript matcher already does
  // this in matchPattern/matchIncludePattern; keep the two in step.
  const pathRegex = path
    .replace(/\*+/g, '*')
    .split('*')
    .map((segment: string) => _escapeRegex(segment))
    .join('.*');
  return new RegExp(`^${schemeRegex}:\\/\\/${hostRegex}${portRegex}${pathRegex}$`);
}

function _globMatch(url: string, glob: string): boolean {
  const regex: string = glob
    .replace(/\*+/g, '*') // collapse first — see _matchPatternToRegex
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

  const custom: Record<string, StyleVariableValue> = _customVars[styleId] ?? {};
  return (style.variables ?? []).map((v: StyleVariable): StyleVariableWithCurrent => ({
    ...v,
    current: custom[v.name] !== undefined ? custom[v.name]! : (v.colorSchemes ?? v.default),
  }));
}

/**
 * Set variable values for a style and re-inject.
 */
async function setVariables(styleId: string, values: Record<string, StyleVariableValue>): Promise<void> {
  if (!_initialized) await _loadState();

  const style: StyleEntry | undefined = _styles[styleId];
  if (!style) return;

  const validation = validateUserCSSVariables(style.variables ?? [], values);
  if (!validation.valid) throw new Error(validation.errors.join(' '));
  const expandedValues = _expandLinkedGroupValues(style.variables ?? [], values);

  if (!_customVars[styleId]) _customVars[styleId] = {};

  for (const [key, val] of Object.entries(expandedValues)) {
    _customVars[styleId]![key] = val;
  }

  await _saveVars();
  await _syncPersistentRegistrations();

  // Re-inject with updated values
  if (style.enabled) {
    await _removeStyleFromAllTabs(styleId);
    await _injectStyleToMatchingTabs(styleId);
  }
}

function _serializeStyleVariable(variable: StyleVariable, value: StyleVariableValue): string {
  let serialized = '';
  if (variable.type === 'color') {
    if (_isColorSchemeValue(value)) {
      serialized = `${value.light} @light ${value.light} @dark ${value.dark}`;
    } else {
      serialized = String(value);
    }
    if (variable.group) serialized += ` @group ${variable.group}`;
  } else if (variable.type === 'checkbox') {
    serialized = value ? '1' : '0';
  } else if (variable.type === 'range') {
    const range = variable.options && 'min' in variable.options ? variable.options : null;
    serialized = range
      ? `[${range.min}, ${range.max}, ${range.step}, ${Number(value)}]`
      : String(value);
  } else if (variable.type === 'select' && variable.options && !('min' in variable.options)) {
    const selected = String(value);
    const entries = Object.entries(variable.options);
    // The selected option is encoded as the FIRST key (parse convention),
    // so the comparator must be a consistent two-argument ordering.
    entries.sort(([left], [right]) => (
      left === selected ? -1 : right === selected ? 1 : left.localeCompare(right)
    ));
    serialized = `{${entries.map(([key, optionValue]) => `${JSON.stringify(key)}:${JSON.stringify(optionValue)}`).join('|')}}`;
  } else if (variable.type === 'text') {
    serialized = JSON.stringify(String(value));
  } else {
    serialized = String(value);
  }
  return `@var ${variable.type} ${variable.name} ${JSON.stringify(variable.label)} ${serialized}`;
}

function applyVariableDefaults(
  usercssCode: string,
  values: Record<string, StyleVariableValue>,
): UserCSSExportResult {
  const parsed = parseUserCSS(usercssCode);
  if (parsed.error || !parsed.variables) return { error: parsed.error || 'Unable to parse UserCSS.' };
  const expanded = _expandLinkedGroupValues(parsed.variables, values);
  const validation = validateUserCSSVariables(parsed.variables, expanded);
  if (!validation.valid) return { error: validation.errors.join(' ') };

  let code = usercssCode;
  for (const variable of parsed.variables) {
    if (!Object.prototype.hasOwnProperty.call(expanded, variable.name)) continue;
    const directive = _serializeStyleVariable(variable, expanded[variable.name]!);
    const line = new RegExp(
      '^(\\s*\\*?\\s*)@var\\s+\\S+\\s+' + _escapeRegex(variable.name) + '\\s+.*$',
      'm',
    );
    code = code.replace(line, (_match, prefix: string) => `${prefix}${directive}`);
  }
  return { code };
}

function _serializeUserCSS(style: StyleEntry, values: Record<string, StyleVariableValue>): string {
  const meta = style.meta || ({} as StyleMeta);
  const metadataLines = [
    `@name ${meta.name || 'Unnamed Style'}`,
    `@namespace ${meta.namespace || 'scriptvault'}`,
    `@version ${meta.version || '1.0.0'}`,
  ];
  for (const key of ['description', 'author', 'license', 'preprocessor', 'homepageURL', 'supportURL', 'updateURL']) {
    if (meta[key]) metadataLines.push(`@${key} ${meta[key]}`);
  }
  for (const pattern of style.match || ['*://*/*']) metadataLines.push(`@match ${pattern}`);
  for (const variable of style.variables || []) {
    const value = values[variable.name] ?? variable.colorSchemes ?? variable.default;
    metadataLines.push(_serializeStyleVariable(variable, value));
  }
  return `/* ==UserStyle==\n${metadataLines.join('\n')}\n==/UserStyle== */\n\n${style.css || ''}`;
}

function exportUserCSS(styleId: string): UserCSSExportResult {
  const style = _styles[styleId];
  if (!style) return { error: 'UserCSS style not found.' };
  const values = _customVars[styleId] ?? {};
  if (style.rawCode && META_REGEX.test(style.rawCode)) {
    return applyVariableDefaults(style.rawCode, values);
  }
  return { code: _serializeUserCSS(style, values) };
}

async function importUserCSS(
  usercssCode: string,
  values: Record<string, StyleVariableValue> = {},
): Promise<UserCSSImportResult> {
  const parsed = parseUserCSS(usercssCode);
  if (parsed.error) return { error: parsed.error };
  const validation = validateUserCSSVariables(parsed.variables ?? [], values);
  if (!validation.valid) return { error: validation.errors.join(' ') };
  const styleId = await registerStyle({
    meta: parsed.meta,
    variables: parsed.variables,
    css: parsed.css,
    rawCode: usercssCode,
    match: parsed.match,
  });
  if (Object.keys(values).length > 0) await setVariables(styleId, values);
  return parsed.warning ? { styleId, warning: parsed.warning } : { styleId };
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
  const defaults: Record<string, StyleVariableValue> = {};
  for (const v of variables) {
    defaults[v.name] = v.colorSchemes ?? v.default;
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
 * True when a `chrome.scripting` rejection proves the injection target no
 * longer exists, so the per-tab registry entry describes nothing and can be
 * dropped. Anything else — a transient failure against a live document, a
 * permission error — must keep the entry: `_registeredTabs` is the only record
 * of the injected sheet, and forgetting it leaks the stylesheet onto every
 * route for the life of that document with no way to retry.
 */
function _isMissingTargetError(error: unknown): boolean {
  const message: string = typeof error === 'string'
    ? error
    : String((error as { message?: unknown } | null)?.message ?? '');
  if (!message) return false;
  return /no tab with id|no frame with id|frame with id .* was removed|tab was closed|no window with id|target closed|the tab is being discarded/i.test(message);
}

/**
 * Handle tab navigation — inject matching styles into newly loaded pages.
 * Call from background.js webNavigation.onCommitted or tabs.onUpdated.
 */
async function onTabUpdated(tabId: number, url: string | undefined, documentId?: string): Promise<void> {
  if (!url) return;
  const registryKey = _registryKeyForTab(tabId, documentId);
  const activeDocumentId = _documentIdForTab(tabId, documentId);
  if (_draftPreviewTabs.has(tabId)) {
    await clearDraftPreview({ tabId });
  }
  if (_injectingTabs.has(registryKey)) {
    // Coalesce instead of dropping: the in-flight pass re-runs with this URL
    // once it settles, so the last route always gets processed. Only the newest
    // URL is kept — intermediate SPA routes are already superseded.
    _pendingTabUrls.set(registryKey, url);
    return;
  }
  _injectingTabs.add(registryKey);
  _pendingTabUrls.delete(registryKey);

  try {
    let current: string | undefined = url;
    // Flat drain loop rather than a recursive re-entry, so a router that keeps
    // firing pushState cannot grow the stack.
    while (current) {
      await _applyStylesToTab(tabId, current, activeDocumentId, registryKey);
      current = _pendingTabUrls.get(registryKey);
      _pendingTabUrls.delete(registryKey);
      // Skip a route that has nothing injected and nothing to inject rather
      // than paying for a full sweep on every intermediate route.
      while (current && !_registeredTabs.has(registryKey) && !_anyEnabledStyleMatches(current)) {
        current = _pendingTabUrls.get(registryKey);
        _pendingTabUrls.delete(registryKey);
      }
    }
  } finally {
    _injectingTabs.delete(registryKey);
    _pendingTabUrls.delete(registryKey);
  }
}

/**
 * Handle a new top-level document. Persisted document_start registrations do
 * the first-paint work; only browsers without that API use the old immediate
 * insertCSS fallback here.
 */
async function onDocumentCommitted(tabId: number, url: string | undefined, documentId?: string): Promise<void> {
  if (!url) return;
  if (!_initialized) await _loadState();
  const normalizedDocumentId = _normalizeDocumentId(documentId);
  const previousDocumentId = _currentDocumentIds.get(tabId);
  if (normalizedDocumentId) {
    if (previousDocumentId !== normalizedDocumentId) _deleteTabRegistries(tabId);
    _currentDocumentIds.set(tabId, normalizedDocumentId);
  } else {
    _deleteTabRegistries(tabId);
    _currentDocumentIds.delete(tabId);
  }
  if (!_persistentRegistrationSupported) await onTabUpdated(tabId, url, normalizedDocumentId);
  else await _syncShadowStylesToTab(tabId, url, [], normalizedDocumentId);
}

/** True when at least one enabled style matches `url`. */
function _anyEnabledStyleMatches(url: string): boolean {
  for (const style of Object.values(_styles)) {
    if (style.enabled && _urlMatchesPatterns(url, style.match)) return true;
  }
  return false;
}

/**
 * One injection pass for a tab at `url`: drop sheets that no longer apply, then
 * inject every enabled matching style. Callers hold the per-tab in-flight guard.
 */
async function _applyStylesToTab(
  tabId: number,
  url: string,
  documentId?: string,
  registryKey: InjectionRegistryKey = _registryKeyForTab(tabId, documentId),
): Promise<void> {
  if (!_initialized) await _loadState();
  // Remove any previously-injected sheet that no longer applies to the current
  // URL (an SPA route change to a non-matching route), is now disabled, or was
  // deleted. On a full document commit onTabNavigated() has already cleared the
  // registry, so this pass only does work for same-document (SPA/hash) updates.
  const existing: Map<string, string> | undefined = _registeredTabs.get(registryKey);
  if (existing) {
    for (const [styleId, injectedCss] of [...existing]) {
      const style = _styles[styleId];
      const stillApplies = !!style && style.enabled && _urlMatchesPatterns(url, style.match);
      if (!stillApplies) {
        try {
          await chrome.scripting.removeCSS({ target: _injectionTarget(tabId, documentId), css: injectedCss });
          existing.delete(styleId);
        } catch (error) {
          // Only forget the sheet when the target is provably gone. If removal
          // failed against a live document the stylesheet is STILL applied, and
          // this registry is the only record of it — dropping the entry would
          // bleed the userstyle onto non-matching routes for the life of that
          // document. Keeping it means the next navigation event retries.
          if (_isMissingTargetError(error)) existing.delete(styleId);
        }
      }
    }
    if (existing.size === 0) _registeredTabs.delete(registryKey);
  }
  for (const [styleId, style] of Object.entries(_styles)) {
    if (!style.enabled) continue;
    if (!_urlMatchesPatterns(url, style.match)) continue;

    const css: string = _buildCSS(styleId);
    if (!css) continue;

    try {
      const tabStyles: Map<string, string> = _registeredTabs.get(registryKey) ?? new Map<string, string>();
      const previousCss: string | undefined = tabStyles.get(styleId);
      // Dedup: the exact CSS is already injected in this document, so a
      // repeated onUpdated/onCommitted event must not stack a duplicate
      // sheet. onTabNavigated() clears this registry per document commit, so
      // an equal previousCss here means the same live document, not a stale
      // pre-navigation record.
      if (previousCss === css) continue;
      if (previousCss) {
        try {
          await chrome.scripting.removeCSS({
            target: _injectionTarget(tabId, documentId),
            css: previousCss,
          });
        } catch {
          // The previous page may already be gone.
        }
      }
      await chrome.scripting.insertCSS({
        target: _injectionTarget(tabId, documentId),
        css,
      });
      tabStyles.set(styleId, css);
      _registeredTabs.set(registryKey, tabStyles);
    } catch (error) {
      // Tab not injectable (internal page, missing host permission, or a
      // document that closed while the asynchronous pass was running).
    }
  }
  await _syncShadowStylesToTab(tabId, url, [], documentId);
}

/**
 * Clean up when a tab is closed.
 */
function onTabRemoved(tabId: number): void {
  _deleteTabRegistries(tabId);
  _currentDocumentIds.delete(tabId);
  _draftPreviewTabs.delete(tabId);
  // A queued SPA route for a closed tab has nowhere to apply.
  _pendingTabUrls.delete(_tabRegistryKey(tabId));
  for (const key of _pendingTabUrls.keys()) {
    if (key.startsWith(`document:${tabId}:`)) _pendingTabUrls.delete(key);
  }
}

/* ------------------------------------------------------------------ */
/*  Initialization                                                     */
/* ------------------------------------------------------------------ */

async function init(): Promise<void> {
  if (_initialized) return;
  await _loadState();
  await _syncPersistentRegistrations();
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
  await _syncPersistentRegistrations();

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
  validateUserCSSVariables,
  registerStyle,
  unregisterStyle,
  toggleStyle,
  getVariables,
  setVariables,
  applyVariableDefaults,
  exportUserCSS,
  importUserCSS,
  getStyles,
  getStyle,
  updateCSS,
  previewDraft,
  clearDraftPreview,
  convertToUserscript,
  importStylusBackup,
  isUserCSSUrl,
  onDocumentCommitted,
  onTabUpdated,
  onTabNavigated,
  onTabRemoved,
  rehydrateOpenTabs,
} as const;

export type { ColorSpace, PreviewColorScheme, PrimitiveStyleVariableValue, ColorSchemeValue, StyleVariableValue, ColorSchemeDefaults, StyleVariable, StyleVariableWithCurrent, StyleMeta, StyleEntry, StyleRegistration, ParseResult, UserCSSValidationResult, UserCSSExportResult, UserCSSImportResult, ConvertResult, ImportResult, DraftPreviewOptions, DraftPreviewResult, DraftPreviewClearResult, StylusSection, StylusStyle };
