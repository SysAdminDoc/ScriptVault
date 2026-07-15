import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { generateLocales } from '../scripts/generate-locales.mjs';

const temporaryRoots = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

describe('locale catalog generator', () => {
  it('keeps the checked-in typed and manifest artifacts deterministic', async () => {
    await expect(generateLocales({ rootDir: process.cwd(), check: true })).resolves.toMatchObject({ drift: [] });

    const generated = await readFile(join(process.cwd(), 'src/generated/locale-catalogs.ts'), 'utf8');
    expect(generated).toContain('export type LocaleCode = keyof typeof localeCatalogs;');
    expect(generated).toContain('export type TranslationKey = keyof typeof localeCatalogs.en;');
    expect(generated).toContain('"translationStatus": "partial"');
  });

  it('rejects a translated-message count below the locale baseline', async () => {
    const root = await mkdtemp(join(tmpdir(), 'scriptvault-locales-'));
    temporaryRoots.push(root);
    await mkdir(join(root, 'src/locales'), { recursive: true });

    const manifest = { extName: { message: 'ScriptVault' } };
    const english = {
      code: 'en', name: 'English', direction: 'ltr', translationStatus: 'complete',
      runtimeCoverageBaseline: 1, runtime: { hello: 'Hello' }, manifest,
    };
    const french = {
      code: 'fr', name: 'Français', direction: 'ltr', translationStatus: 'partial',
      runtimeCoverageBaseline: 1, runtime: { hello: 'Bonjour' }, manifest,
    };
    await writeFile(join(root, 'src/locales/en.json'), JSON.stringify(english));
    await writeFile(join(root, 'src/locales/fr.json'), JSON.stringify(french));
    await generateLocales({ rootDir: root });

    french.runtime = {};
    await writeFile(join(root, 'src/locales/fr.json'), JSON.stringify(french));
    await expect(generateLocales({ rootDir: root, check: true }))
      .rejects.toThrow('translated runtime coverage regressed below 1');
  });
});
