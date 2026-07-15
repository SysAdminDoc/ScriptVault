// Phase 39.4 — CI lint: CWS 75-char universal name limit + descriptive caps.
//
// Chrome Web Store rejects manifest uploads where the extension `name`
// (resolved per-locale via __MSG_extName__) exceeds 75 characters in ANY
// supported locale. Similarly, `description` is capped at 132. This test
// pins the limit so a future locale PR can't silently break the upload.
//
// Source: https://developer.chrome.com/docs/webstore/program-policies

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';

const NAME_CAP = 75;
const DESCRIPTION_CAP = 132;
const LOCALES_DIR = resolve(__dirname, '../_locales');

function readLocaleMessages(dir) {
  const path = join(LOCALES_DIR, dir, 'messages.json');
  return JSON.parse(readFileSync(path, 'utf8'));
}

const locales = readdirSync(LOCALES_DIR).filter((d) =>
  statSync(join(LOCALES_DIR, d)).isDirectory()
);

describe('CWS manifest locale length caps (Phase 39.4)', () => {
  it('discovers all 9 documented locale catalogs', () => {
    expect(locales.length).toBe(9);
  });

  describe.each(locales)('locale: %s', (locale) => {
    const messages = readLocaleMessages(locale);

    it('extName message exists and is within 75 chars', () => {
      expect(messages.extName).toBeDefined();
      expect(typeof messages.extName.message).toBe('string');
      expect(messages.extName.message.length).toBeLessThanOrEqual(NAME_CAP);
    });

    it('extDescription message exists and is within 132 chars', () => {
      expect(messages.extDescription).toBeDefined();
      expect(typeof messages.extDescription.message).toBe('string');
      // CWS short description limit; UI auto-truncates above this.
      expect(messages.extDescription.message.length).toBeLessThanOrEqual(
        DESCRIPTION_CAP
      );
    });

    it('every message has a non-empty `message` string', () => {
      for (const [key, entry] of Object.entries(messages)) {
        expect(typeof entry.message, `${locale}.${key}.message`).toBe('string');
        expect(entry.message.length, `${locale}.${key}.message`).toBeGreaterThan(0);
      }
    });
  });

  it('all locales share the same key set as `en` (no orphaned/missing keys)', () => {
    const en = readLocaleMessages('en');
    const enKeys = new Set(Object.keys(en));
    for (const locale of locales) {
      if (locale === 'en') continue;
      const keys = new Set(Object.keys(readLocaleMessages(locale)));
      const missing = [...enKeys].filter((k) => !keys.has(k));
      const orphaned = [...keys].filter((k) => !enKeys.has(k));
      expect(missing, `${locale} missing keys`).toEqual([]);
      expect(orphaned, `${locale} orphaned keys`).toEqual([]);
    }
  });
});
