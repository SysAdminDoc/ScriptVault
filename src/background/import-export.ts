/**
 * Import/Export — export and import scripts as JSON or ZIP archives.
 *
 * Extracted from background.core.js (lines 505-805) — logic is kept identical.
 */

import type { Script, ScriptMeta } from '../types/script';
import type { Settings } from '../types/settings';
import { ScriptStorage, ScriptValues, SettingsManager } from '../modules/storage';
import { parseUserscript } from './parser';

// ---------------------------------------------------------------------------
// External globals available in the service-worker context
// ---------------------------------------------------------------------------

declare const fflate: {
  strToU8(str: string): Uint8Array;
  strFromU8(data: Uint8Array): string;
  zipSync(
    data: Record<string, Uint8Array>,
    opts?: { level?: number },
  ): Uint8Array;
  unzipSync(data: Uint8Array): Record<string, Uint8Array>;
};

// Functions defined in background.core.js but not yet migrated
declare function registerAllScripts(): Promise<void>;
declare function generateId(): string;
declare function updateBadge(): Promise<void>;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImportOptions {
  overwrite?: boolean;
  importSettings?: boolean;
}

interface ImportResults {
  imported: number;
  skipped: number;
  errors: Array<{ name: string; error: string }>;
  error?: string;
}

interface ExportedScript {
  id: string;
  code: string;
  enabled: boolean;
  position: number;
  createdAt: number;
  updatedAt: number;
}

interface ExportData {
  version: number;
  exportedAt: string;
  settings: Settings;
  scripts: ExportedScript[];
}

interface ImportScriptEntry {
  id: string;
  code: string;
  enabled?: boolean;
  position?: number;
  createdAt?: number;
  updatedAt?: number;
}

interface ImportData {
  scripts?: ImportScriptEntry[];
  settings?: Settings;
}

interface ZipExportResult {
  zipData: string;
  filename: string;
}

interface TampermonkeyOptions {
  scriptId?: string;
  settings?: {
    enabled?: boolean;
    'run-at'?: string;
    override?: {
      use_includes: string[];
      use_matches: string[];
      use_excludes: string[];
      use_connects: string[];
      merge_includes: boolean;
      merge_matches: boolean;
      merge_excludes: boolean;
      merge_connects: boolean;
    };
  };
  meta?: {
    name: string;
    namespace: string;
    version: string;
    description: string;
    author: string;
    match: string[];
    include: string[];
    exclude: string[];
    grant: string[];
    require: string[];
    resource: Record<string, string>;
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function exportAllScripts(): Promise<ExportData> {
  const scripts: Script[] = await ScriptStorage.getAll();
  const settings = await SettingsManager.get() as unknown as Settings;

  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    settings: settings,
    scripts: scripts.map((s: Script) => ({
      id: s.id,
      code: s.code,
      enabled: s.enabled,
      position: s.position,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt
    }))
  };
}

const RESERVED_IMPORT_SCRIPT_IDS = new Set(['__proto__', 'prototype', 'constructor']);

function isSafeImportedScriptId(id: unknown): id is string {
  return (
    typeof id === 'string' &&
    /^script_[A-Za-z0-9._:-]{1,160}$/.test(id) &&
    !RESERVED_IMPORT_SCRIPT_IDS.has(id)
  );
}

function allocateImportedScriptId(preferredId: unknown, usedScriptIds: Set<string>): string {
  if (isSafeImportedScriptId(preferredId) && !usedScriptIds.has(preferredId)) {
    return preferredId;
  }
  let nextId: string;
  do {
    nextId = generateId();
  } while (usedScriptIds.has(nextId));
  return nextId;
}

export async function importScripts(
  data: ImportData,
  options: ImportOptions = {},
): Promise<ImportResults | { error: string }> {
  const { overwrite = false } = options;
  const results: ImportResults = { imported: 0, skipped: 0, errors: [] };

  if (!data.scripts || !Array.isArray(data.scripts)) {
    return { error: 'Invalid import format' };
  }

  // Cache existing count once to avoid O(n²) getAll() inside the loop
  const allExistingScripts: Script[] = await ScriptStorage.getAll();
  const usedScriptIds = new Set(allExistingScripts.map((script) => script.id));
  let _importPosition: number = allExistingScripts.length;

  for (const script of data.scripts) {
    const rawScriptId: unknown = script && typeof script === 'object' ? script.id : undefined;
    const requestedScriptId: string = isSafeImportedScriptId(rawScriptId) ? rawScriptId : '';
    const errorName: string = requestedScriptId || (typeof rawScriptId === 'string' ? rawScriptId : '<unknown>');
    try {
      if (!script || typeof script.code !== 'string') {
        results.errors.push({ name: errorName, error: 'Invalid script entry' });
        continue;
      }

      const parsed = parseUserscript(script.code);
      if (parsed.error) {
        results.errors.push({ name: errorName, error: parsed.error });
        continue;
      }

      const existing: Script | null = requestedScriptId ? await ScriptStorage.get(requestedScriptId) : null;
      if (existing && !overwrite) {
        results.skipped++;
        continue;
      }

      const scriptId: string = existing?.id && isSafeImportedScriptId(existing.id)
        ? existing.id
        : allocateImportedScriptId(requestedScriptId, usedScriptIds);
      usedScriptIds.add(scriptId);

      await ScriptStorage.set(scriptId, {
        id: scriptId,
        code: script.code,
        meta: parsed.meta,
        enabled: script.enabled !== false,
        position: Number.isFinite(script.position) ? script.position : _importPosition++,
        createdAt: Number.isFinite(script.createdAt) ? script.createdAt : Date.now(),
        updatedAt: Number.isFinite(script.updatedAt) ? script.updatedAt : Date.now()
      } as Script);
      results.imported++;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      results.errors.push({ name: errorName, error: message });
    }
  }

  // Import settings if present
  if (data.settings && options.importSettings) {
    await SettingsManager.set(data.settings);
  }

  // Re-register all scripts after import
  await registerAllScripts();
  await updateBadge();

  return results;
}

// Export to ZIP (Tampermonkey-compatible format)
export async function exportToZip(): Promise<ZipExportResult> {
  const scripts: Script[] = await ScriptStorage.getAll();
  const files: Record<string, Uint8Array> = {}; // fflate uses { filename: Uint8Array } format
  const usedNames = new Set<string>();

  for (const script of scripts) {
    // Create safe filename, deduplicating collisions
    let safeName: string = (script.meta.name || 'unnamed')
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 100);

    if (usedNames.has(safeName)) {
      let counter = 2;
      while (usedNames.has(`${safeName}_${counter}`)) counter++;
      safeName = `${safeName}_${counter}`;
    }
    usedNames.add(safeName);

    // Add the userscript file
    files[`${safeName}.user.js`] = fflate.strToU8(script.code);

    // Add options.json (Tampermonkey format)
    const tmOptions: TampermonkeyOptions = {
      scriptId: script.id,
      settings: {
        enabled: script.enabled,
        'run-at': script.meta['run-at'] || 'document-idle',
        override: {
          use_includes: [],
          use_matches: [],
          use_excludes: [],
          use_connects: [],
          merge_includes: true,
          merge_matches: true,
          merge_excludes: true,
          merge_connects: true
        }
      },
      meta: {
        name: script.meta.name,
        namespace: script.meta.namespace || '',
        version: script.meta.version || '1.0',
        description: script.meta.description || '',
        author: script.meta.author || '',
        match: script.meta.match || [],
        include: script.meta.include || [],
        exclude: script.meta.exclude || [],
        grant: script.meta.grant || [],
        require: script.meta.require || [],
        resource: script.meta.resource || {}
      }
    };
    files[`${safeName}.options.json`] = fflate.strToU8(JSON.stringify(tmOptions, null, 2));

    // Add storage.json if script has stored values
    const values: Record<string, unknown> | null = await ScriptValues.getAll(script.id);
    if (values && Object.keys(values).length > 0) {
      const storage = { data: values };
      files[`${safeName}.storage.json`] = fflate.strToU8(JSON.stringify(storage, null, 2));
    }
  }

  // Generate zip as Uint8Array then convert to base64 in chunks (avoid stack overflow)
  const zipData: Uint8Array = fflate.zipSync(files, { level: 6 });
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < zipData.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(zipData.subarray(i, i + chunkSize)));
  }
  const base64: string = btoa(binary);
  return { zipData: base64, filename: `scriptvault-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.zip` };
}

// Import from ZIP (supports Tampermonkey and other formats)
export async function importFromZip(
  zipData: string | ArrayBuffer | Uint8Array,
  options: ImportOptions = {},
): Promise<ImportResults> {
  const results: ImportResults = { imported: 0, skipped: 0, errors: [] };

  try {
    // Convert base64 to Uint8Array if needed
    let zipBytes: Uint8Array;
    if (typeof zipData === 'string') {
      // Base64 string
      const binaryString: string = atob(zipData);
      zipBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        zipBytes[i] = binaryString.charCodeAt(i);
      }
    } else if (zipData instanceof ArrayBuffer) {
      zipBytes = new Uint8Array(zipData);
    } else {
      zipBytes = zipData;
    }

    // Load the zip file using fflate
    const unzipped: Record<string, Uint8Array> = fflate.unzipSync(zipBytes);
    const fileNames: string[] = Object.keys(unzipped);

    // Find all .user.js files
    const userScripts: string[] = fileNames.filter(name => name.endsWith('.user.js'));
    const allExistingScripts: Script[] = await ScriptStorage.getAll();
    const usedScriptIds = new Set(allExistingScripts.map((script) => script.id));
    // Starting position for newly-imported scripts (avoids O(n²) getAll() per script)
    let _importPosition: number = allExistingScripts.length;

    for (const filename of userScripts) {
      try {
        const code: string = fflate.strFromU8(unzipped[filename]!);

        // Validate it's a userscript
        if (!code.includes('==UserScript==')) {
          results.errors.push({ name: filename, error: 'Not a valid userscript' });
          continue;
        }

        const parsed = parseUserscript(code);
        if (!parsed.meta) {
          results.errors.push({ name: filename, error: parsed.error ?? 'Parse failed' });
          continue;
        }

        const parsedMeta: ScriptMeta = parsed.meta;

        // Look for associated options and storage files
        const baseName: string = filename.replace('.user.js', '');
        const optionsFileData: Uint8Array | undefined = unzipped[`${baseName}.options.json`];
        const storageFileData: Uint8Array | undefined = unzipped[`${baseName}.storage.json`];

        let enabled = true;
        let storedValues: Record<string, unknown> = {};
        let preferredScriptId = '';

        // Parse options file if exists
        if (optionsFileData) {
          try {
            const optionsData = JSON.parse(fflate.strFromU8(optionsFileData)) as {
              scriptId?: string;
              settings?: { enabled?: boolean };
            };
            enabled = optionsData.settings?.enabled !== false;
            preferredScriptId = isSafeImportedScriptId(optionsData.scriptId) ? optionsData.scriptId : '';
          } catch (e: unknown) {
            console.warn('Failed to parse options file:', e);
          }
        }

        // Parse storage file if exists
        if (storageFileData) {
          try {
            const storageData = JSON.parse(fflate.strFromU8(storageFileData)) as {
              data?: Record<string, unknown>;
            };
            storedValues = storageData.data || storageData as unknown as Record<string, unknown> || {};
          } catch (e: unknown) {
            console.warn('Failed to parse storage file:', e);
          }
        }

        // Prefer ScriptVault's stable scriptId metadata when present. Name or
        // namespace can change over time, but backup restore should still
        // update the same script record.
        const existingById: Script | undefined = preferredScriptId
          ? allExistingScripts.find(s => s.id === preferredScriptId)
          : undefined;
        const existing: Script | undefined = existingById ?? allExistingScripts.find(s =>
          s.meta.name === parsedMeta.name &&
          (s.meta.namespace === parsedMeta.namespace || (!s.meta.namespace && !parsedMeta.namespace))
        );

        if (existing && !options.overwrite) {
          results.skipped++;
          continue;
        }

        // Create or update script
        let scriptId: string;
        if (existing?.id && isSafeImportedScriptId(existing.id)) {
          scriptId = existing.id;
        } else {
          scriptId = allocateImportedScriptId(preferredScriptId, usedScriptIds);
        }
        usedScriptIds.add(scriptId);
        const script: Script = {
          id: scriptId,
          code: code,
          meta: parsedMeta,
          enabled: enabled,
          position: existing?.position ?? _importPosition++,
          createdAt: existing?.createdAt || Date.now(),
          updatedAt: Date.now()
        };

        await ScriptStorage.set(scriptId, script);

        // Import stored values
        if (Object.keys(storedValues).length > 0) {
          await ScriptValues.setAll(scriptId, storedValues);
        }

        results.imported++;
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        results.errors.push({ name: filename, error: message });
      }
    }

    // If no .user.js files found, try importing raw JS files
    if (userScripts.length === 0) {
      const jsFiles: string[] = fileNames.filter(name =>
        name.endsWith('.js') && !name.includes('/')
      );

      for (const filename of jsFiles) {
        try {
          const code: string = fflate.strFromU8(unzipped[filename]!);
          if (!code.includes('==UserScript==')) continue;

          const parsed = parseUserscript(code);
          if (parsed.error) continue;

          const scriptId: string = generateId();
          await ScriptStorage.set(scriptId, {
            id: scriptId,
            code: code,
            meta: parsed.meta,
            enabled: true,
            position: _importPosition++,
            createdAt: Date.now(),
            updatedAt: Date.now()
          } as Script);
          results.imported++;
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : String(e);
          results.errors.push({ name: filename, error: message });
        }
      }
    }

    await updateBadge();

    // Re-register all scripts after import
    await registerAllScripts();

    return results;
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[ScriptVault] importFromZip error:', e);
    return { ...results, error: message };
  }
}
