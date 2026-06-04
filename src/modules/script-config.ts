// ============================================================================
// ScriptVault — userscript author configuration helpers
// ============================================================================
// Shared @var parsing, value coercion, and dashboard field rendering for
// userscript-level configuration.

type ScriptConfigVarType = 'color' | 'text' | 'number' | 'select' | 'checkbox' | 'range';

type ScriptConfigOptionMap =
  | Record<string, string | number>
  | { min: number; max: number; step: number };

interface ScriptConfigVariable {
  type: ScriptConfigVarType;
  name: string;
  label: string;
  default: string | number | boolean;
  options: ScriptConfigOptionMap | null;
}

type ScriptConfigValue = string | number | boolean;
type ScriptConfigValues = Record<string, ScriptConfigValue>;

const VAR_TYPES: ScriptConfigVarType[] = ['color', 'text', 'number', 'select', 'checkbox', 'range'];
const POLLUTED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isSafeConfigName(name: string): boolean {
  return !!name && !POLLUTED_KEYS.has(name);
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseSelectOptions(raw: string): { options: Record<string, string | number> | null; defaultValue: string } {
  const braceMatch = raw.match(/^\{([\s\S]*)\}$/);
  if (!braceMatch) return { options: null, defaultValue: raw };

  const inner = braceMatch[1] ?? '';
  try {
    const parsed = JSON.parse(`{${inner}}`) as Record<string, string | number>;
    const keys = Object.keys(parsed).filter(isSafeConfigName);
    if (!keys.length) return { options: null, defaultValue: '' };
    const options: Record<string, string | number> = {};
    for (const key of keys) options[key] = parsed[key] ?? '';
    return { options, defaultValue: keys[0] ?? '' };
  } catch {
    // Pipe-separated form: {label:value|other:value}
  }

  const options: Record<string, string | number> = {};
  let firstKey = '';
  for (const pair of inner.split('|')) {
    const kv = pair.match(/^"?([^":]+)"?\s*:\s*"?([^"|]*)"?\s*$/);
    if (!kv) continue;
    const key = (kv[1] ?? '').trim();
    if (!isSafeConfigName(key)) continue;
    options[key] = (kv[2] ?? '').trim();
    if (!firstKey) firstKey = key;
  }

  return {
    options: firstKey ? options : null,
    defaultValue: firstKey,
  };
}

function parseVarDirective(type: ScriptConfigVarType, rest: string): ScriptConfigVariable | null {
  const nameMatch = rest.match(/^(\S+)\s+"([^"]*?)"\s+([\s\S]*)$/);
  const simpleMatch = nameMatch ? null : rest.match(/^(\S+)\s+([\s\S]*)$/);
  const name = (nameMatch?.[1] ?? simpleMatch?.[1] ?? '').trim();
  if (!isSafeConfigName(name)) return null;

  const label = nameMatch ? (nameMatch[2] ?? '') : name;
  let defaultValue: string | number | boolean = (nameMatch?.[3] ?? simpleMatch?.[2] ?? '').trim();
  let options: ScriptConfigVariable['options'] = null;

  switch (type) {
    case 'text':
      defaultValue = unquote(String(defaultValue));
      break;
    case 'number': {
      const parsed = Number.parseFloat(String(defaultValue));
      defaultValue = Number.isFinite(parsed) ? parsed : 0;
      break;
    }
    case 'checkbox': {
      const raw = String(defaultValue).trim().toLowerCase();
      defaultValue = raw === '1' || raw === 'true';
      break;
    }
    case 'select': {
      const parsed = parseSelectOptions(String(defaultValue));
      options = parsed.options;
      defaultValue = parsed.defaultValue;
      break;
    }
    case 'range': {
      const arrMatch = String(defaultValue).match(/^\[([\s\S]*)\]$/);
      if (arrMatch) {
        const parts = (arrMatch[1] ?? '').split(',').map((part) => Number.parseFloat(part.trim()));
        options = {
          min: Number.isFinite(parts[0]) ? parts[0]! : 0,
          max: Number.isFinite(parts[1]) ? parts[1]! : 100,
          step: Number.isFinite(parts[2]) ? parts[2]! : 1,
        };
        defaultValue = Number.isFinite(parts[3]) ? parts[3]! : (options.min ?? 0);
      } else {
        const parsed = Number.parseFloat(String(defaultValue));
        defaultValue = Number.isFinite(parsed) ? parsed : 0;
        options = { min: 0, max: 100, step: 1 };
      }
      break;
    }
    case 'color':
      default:
      break;
  }

  return {
    type,
    name,
    label: label || name,
    default: defaultValue,
    options,
  };
}

function parseDirective(value: string): ScriptConfigVariable | null {
  const match = String(value || '').trim().match(/^(\S+)\s+([\s\S]+)$/);
  if (!match) return null;
  const type = match[1] as ScriptConfigVarType;
  if (!VAR_TYPES.includes(type)) return null;
  return parseVarDirective(type, match[2] ?? '');
}

function coerceValue(variable: ScriptConfigVariable, value: unknown): ScriptConfigValue {
  if (value === undefined || value === null) return variable.default;

  switch (variable.type) {
    case 'checkbox':
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number') return value !== 0;
      if (typeof value === 'string') return /^(1|true|yes|on)$/i.test(value.trim());
      return Boolean(value);
    case 'number': {
      const parsed = Number.parseFloat(String(value));
      return Number.isFinite(parsed) ? parsed : variable.default;
    }
    case 'range': {
      const parsed = Number.parseFloat(String(value));
      if (!Number.isFinite(parsed)) return variable.default;
      const options = isRecord(variable.options) ? variable.options : {};
      const min = typeof options.min === 'number' ? options.min : Number.NEGATIVE_INFINITY;
      const max = typeof options.max === 'number' ? options.max : Number.POSITIVE_INFINITY;
      return Math.max(min, Math.min(max, parsed));
    }
    case 'select': {
      const raw = String(value);
      if (!isRecord(variable.options)) return raw || String(variable.default);
      const entries = Object.entries(variable.options);
      if (Object.hasOwn(variable.options, raw)) return raw;
      const matchingEntry = entries.find(([, optionValue]) => String(optionValue) === raw);
      return matchingEntry?.[0] ?? variable.default;
    }
    case 'color':
    case 'text':
    default:
      return String(value);
  }
}

function normalizeValues(
  variables: ScriptConfigVariable[] | undefined,
  values: Record<string, unknown> | undefined,
): ScriptConfigValues {
  const result: ScriptConfigValues = {};
  const rawValues = isRecord(values) ? values : {};

  for (const variable of variables ?? []) {
    if (!variable || !isSafeConfigName(variable.name)) continue;
    result[variable.name] = coerceValue(variable, rawValues[variable.name]);
  }

  return result;
}

function createInput(variable: ScriptConfigVariable, value: ScriptConfigValue): HTMLInputElement | HTMLSelectElement {
  if (variable.type === 'select') {
    const select = document.createElement('select');
    select.className = 'select-field script-config-input';
    if (isRecord(variable.options)) {
      for (const [key, optionValue] of Object.entries(variable.options)) {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = key;
        option.title = String(optionValue);
        select.appendChild(option);
      }
    }
    select.value = String(value);
    return select;
  }

  const input = document.createElement('input');
  input.className = 'input-field script-config-input';
  switch (variable.type) {
    case 'checkbox':
      input.type = 'checkbox';
      input.checked = Boolean(value);
      break;
    case 'color':
      input.type = 'color';
      input.value = String(value || '#000000');
      break;
    case 'number':
      input.type = 'number';
      input.value = String(value);
      break;
    case 'range': {
      input.type = 'range';
      if (isRecord(variable.options)) {
        if (typeof variable.options.min === 'number') input.min = String(variable.options.min);
        if (typeof variable.options.max === 'number') input.max = String(variable.options.max);
        if (typeof variable.options.step === 'number') input.step = String(variable.options.step);
      }
      input.value = String(value);
      break;
    }
    case 'text':
    default:
      input.type = 'text';
      input.value = String(value);
      break;
  }
  return input;
}

function renderFields(
  container: HTMLElement,
  variables: ScriptConfigVariable[] | undefined,
  values: Record<string, unknown> | undefined,
): void {
  container.textContent = '';
  const normalized = normalizeValues(variables, values);

  if (!variables?.length) {
    const empty = document.createElement('div');
    empty.className = 'panel-empty-inline';
    empty.textContent = 'No @var configuration declared.';
    container.appendChild(empty);
    return;
  }

  for (const variable of variables) {
    if (!isSafeConfigName(variable.name)) continue;
    const row = document.createElement('label');
    row.className = 'script-config-row';

    const label = document.createElement('span');
    label.className = 'script-config-label';
    label.textContent = variable.label || variable.name;

    const input = createInput(variable, normalized[variable.name] ?? variable.default);
    input.dataset.scriptConfigName = variable.name;
    input.setAttribute('aria-label', variable.label || variable.name);

    row.append(label, input);
    container.appendChild(row);
  }
}

function readFields(
  container: HTMLElement,
  variables: ScriptConfigVariable[] | undefined,
): ScriptConfigValues {
  const raw: Record<string, unknown> = {};
  for (const input of Array.from(container.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-script-config-name]'))) {
    const name = input.dataset.scriptConfigName || '';
    if (!isSafeConfigName(name)) continue;
    raw[name] = input instanceof HTMLInputElement && input.type === 'checkbox'
      ? input.checked
      : input.value;
  }
  return normalizeValues(variables, raw);
}

export const ScriptConfig = {
  VAR_TYPES,
  parseDirective,
  normalizeValues,
  coerceValue,
  renderFields,
  readFields,
};

export type {
  ScriptConfigVarType,
  ScriptConfigVariable,
  ScriptConfigValues,
  ScriptConfigValue,
};
