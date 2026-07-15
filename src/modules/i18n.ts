// ============================================================================
// i18n.ts - generated-catalog runtime with locale, plural, and directionality
// ============================================================================

import {
  localeCatalogs,
  localeMetadata,
  type LocaleCode,
  type TranslationCatalog,
  type TranslationKey,
} from '../generated/locale-catalogs';

type PluralCategory = Intl.LDMLPluralRule;
type PluralKey = Extract<TranslationKey, `${string}.${PluralCategory}`>;
type PluralFamilyOf<Key> = Key extends `${infer Family}.${PluralCategory}` ? Family : never;
type PluralFamily = PluralFamilyOf<PluralKey>;
type MessagePlaceholders = Record<string, string | number>;

interface LocaleInfo {
  code: LocaleCode;
  name: string;
  label: string;
  direction: 'ltr' | 'rtl';
  translationStatus: 'complete' | 'partial';
  translatedRuntimeMessages: number;
  totalRuntimeMessages: number;
}

interface I18nModule {
  init(locale: string): LocaleCode;
  setLocale(locale: string): boolean;
  getLocale(): LocaleCode;
  getDirection(): 'ltr' | 'rtl';
  getMessage(key: string, placeholders?: MessagePlaceholders): string;
  t(key: string, placeholders?: MessagePlaceholders): string;
  getPluralCategory(count: number): PluralCategory;
  getPluralMessage(family: PluralFamily, count: number, placeholders?: MessagePlaceholders): string;
  getAvailableLocales(): LocaleInfo[];
  applyToDOM(container?: Document | Element): void;
  applyDocumentLocale(target?: Document): void;
}

const catalogs = localeCatalogs as Record<LocaleCode, TranslationCatalog>;
const englishCatalog = localeCatalogs.en as Readonly<Record<TranslationKey, string>>;
let currentLocale: LocaleCode = 'en';
let pluralRules = new Intl.PluralRules(currentLocale);
let numberFormatter = new Intl.NumberFormat(currentLocale);

function resolveLocale(locale: string | null | undefined): LocaleCode | null {
  const normalized = (locale ?? '')
    .trim()
    .split(/[-_]/)[0]
    ?.toLowerCase();
  return normalized && Object.prototype.hasOwnProperty.call(localeCatalogs, normalized)
    ? normalized as LocaleCode
    : null;
}

function normalizeLocale(locale: string | null | undefined): LocaleCode {
  return resolveLocale(locale) ?? 'en';
}

function detectLocale(): LocaleCode {
  const browserLanguage = typeof navigator !== 'undefined'
    ? navigator.language || (navigator as Navigator & { userLanguage?: string }).userLanguage
    : undefined;
  return normalizeLocale(browserLanguage || 'en');
}

function interpolate(message: string, placeholders: MessagePlaceholders = {}): string {
  let result = message;
  for (const [placeholder, value] of Object.entries(placeholders)) {
    result = result.replaceAll(`{${placeholder}}`, String(value));
  }
  return result;
}

function lookupMessage(key: string): string | undefined {
  const activeCatalog = catalogs[currentLocale] as Readonly<Record<string, string | undefined>>;
  return activeCatalog[key] ??
    (englishCatalog as Readonly<Record<string, string | undefined>>)[key];
}

function getMessage(key: string, placeholders: MessagePlaceholders = {}): string {
  return interpolate(lookupMessage(key) ?? key, placeholders);
}

function applyDocumentLocale(target?: Document): void {
  const activeDocument = target ?? (typeof document !== 'undefined' ? document : undefined);
  if (!activeDocument?.documentElement) return;
  activeDocument.documentElement.lang = currentLocale;
  activeDocument.documentElement.dir = localeMetadata[currentLocale].direction;
}

function activateLocale(locale: LocaleCode): void {
  currentLocale = locale;
  pluralRules = new Intl.PluralRules(currentLocale);
  numberFormatter = new Intl.NumberFormat(currentLocale);
  applyDocumentLocale();
}

function getPluralMessage(
  family: PluralFamily,
  count: number,
  placeholders: MessagePlaceholders = {},
): string {
  const safeCount = Number.isFinite(count) ? count : 0;
  const category = pluralRules.select(safeCount);
  const activeCatalog = catalogs[currentLocale] as Readonly<Record<string, string | undefined>>;
  const activeKey = `${family}.${category}`;
  const otherKey = `${family}.other`;
  const message = activeCatalog[activeKey] ??
    activeCatalog[otherKey] ??
    (englishCatalog as Readonly<Record<string, string | undefined>>)[activeKey] ??
    (englishCatalog as Readonly<Record<string, string | undefined>>)[otherKey] ??
    otherKey;
  return interpolate(message, {
    count: numberFormatter.format(safeCount),
    ...placeholders,
  });
}

export const I18n: I18nModule = {
  init(locale: string): LocaleCode {
    const resolved = locale === 'auto' ? detectLocale() : normalizeLocale(locale);
    activateLocale(resolved);
    console.log('[I18n] Initialized with locale:', currentLocale);
    return currentLocale;
  },

  setLocale(locale: string): boolean {
    const normalized = resolveLocale(locale);
    if (!normalized) return false;
    activateLocale(normalized);
    return true;
  },

  getLocale(): LocaleCode {
    return currentLocale;
  },

  getDirection(): 'ltr' | 'rtl' {
    return localeMetadata[currentLocale].direction;
  },

  getMessage,
  t: getMessage,

  getPluralCategory(count: number): PluralCategory {
    return pluralRules.select(Number.isFinite(count) ? count : 0);
  },

  getPluralMessage,

  getAvailableLocales(): LocaleInfo[] {
    return (Object.keys(localeMetadata) as LocaleCode[])
      .map(code => {
        const metadata = localeMetadata[code];
        return {
          code,
          name: metadata.name,
          label: metadata.translationStatus === 'partial'
            ? `${metadata.name} (partial)`
            : metadata.name,
          direction: metadata.direction,
          translationStatus: metadata.translationStatus,
          translatedRuntimeMessages: metadata.translatedRuntimeMessages,
          totalRuntimeMessages: metadata.totalRuntimeMessages,
        };
      })
      .sort((left, right) => left.code === 'en' ? -1 : right.code === 'en' ? 1 : left.name.localeCompare(right.name));
  },

  applyToDOM(container?: Document | Element): void {
    const target = container ?? (typeof document !== 'undefined' ? document : undefined);
    if (!target) return;
    const targetDocument = 'documentElement' in target
      ? target as Document
      : target.ownerDocument ?? undefined;
    applyDocumentLocale(targetDocument);
    target.querySelectorAll('[data-i18n]').forEach((element: Element) => {
      const key = element.getAttribute('data-i18n');
      if (key) element.textContent = getMessage(key);
    });
    target.querySelectorAll('[data-i18n-placeholder]').forEach((element: Element) => {
      const key = element.getAttribute('data-i18n-placeholder');
      if (key) (element as HTMLInputElement).placeholder = getMessage(key);
    });
    target.querySelectorAll('[data-i18n-title]').forEach((element: Element) => {
      const key = element.getAttribute('data-i18n-title');
      if (key) (element as HTMLElement).title = getMessage(key);
    });
    target.querySelectorAll('[data-i18n-aria-label]').forEach((element: Element) => {
      const key = element.getAttribute('data-i18n-aria-label');
      if (key) element.setAttribute('aria-label', getMessage(key));
    });
  },

  applyDocumentLocale,
};

export default I18n;
