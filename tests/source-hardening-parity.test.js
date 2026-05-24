import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fetchTextBounded } from '../src/background/fetch-bounded.ts';

function source(path) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function bodyFromChunks(chunks) {
  let index = 0;
  return {
    getReader() {
      return {
        async read() {
          if (index >= chunks.length) return { done: true, value: undefined };
          return { done: false, value: chunks[index++] };
        },
        async cancel() {},
        releaseLock() {},
      };
    },
  };
}

function responseFromText(text, { declaredLength, stream = true } = {}) {
  const headers = new Map();
  if (declaredLength !== undefined) headers.set('content-length', String(declaredLength));
  const bytes = new TextEncoder().encode(text);
  return {
    headers: { get: (key) => headers.get(key.toLowerCase()) ?? null },
    body: stream ? bodyFromChunks([bytes]) : null,
    async text() {
      return text;
    },
  };
}

describe('source hardening parity guards', () => {
  it('keeps TypeScript remote script fetch paths on the bounded reader', async () => {
    const guardedFiles = [
      'src/background/install-handler.ts',
      'src/background/update-checker.ts',
      'src/background/resource-loader.ts',
      'src/background/context-menu.ts',
    ];

    for (const file of guardedFiles) {
      const text = source(file);
      expect(text, `${file} imports bounded reader`).toContain("import { fetchTextBounded } from './fetch-bounded';");
      expect(text, `${file} must not buffer remote responses directly`).not.toMatch(/await\s+response\.text\(\)/);
    }

    const small = await fetchTextBounded(responseFromText('ok'), 10, 'Script');
    expect(small).toBe('ok');
    await expect(fetchTextBounded(responseFromText('x'.repeat(20), { declaredLength: 5 }), 10, 'Script'))
      .rejects.toThrow(/Script too large/);
    await expect(fetchTextBounded(responseFromText('é', { stream: false }), 1, 'Script'))
      .rejects.toThrow(/Script too large/);
  });

  it('keeps empty grants and grant none locked down in the TypeScript wrapper mirror', () => {
    const wrapper = source('src/background/wrapper-builder.ts');
    expect(wrapper).toContain("const grants: string[] = meta.grant.length > 0 ? meta.grant : ['none'];");
    expect(wrapper).toContain('if (hasNone || grants.length === 0) return false;');
  });

  it('keeps Gist token writes on promise-based storage with rejection propagation', () => {
    const gist = source('pages/dashboard-gist.js');
    expect(gist).toContain('await chrome.storage.local.set({ [STORAGE_KEY_TOKEN]: token });');
    expect(gist).toContain("console.error('[gist] saveToken failed:', e);");
    expect(gist).toContain('throw e;');
    expect(gist).toContain("chrome.storage.local.set({ [STORAGE_KEY_AUTOSYNC]: val }).catch((e) => {");
    expect(gist).not.toMatch(/new Promise\s*\(\s*resolve\s*=>\s*\{[\s\S]*chrome\.storage\.local\.(set|remove)/);
  });
});
