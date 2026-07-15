import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateManifestForProfile } from '../scripts/generate-manifest-firefox.mjs';

const ROOT = process.cwd();
const readJson = (path) => JSON.parse(readFileSync(resolve(ROOT, path), 'utf8'));
const readText = (path) => readFileSync(resolve(ROOT, path), 'utf8');

describe('enterprise policy provisioning manifest contract', () => {
  it('declares a Chrome managed-storage schema for enterprise policy keys', () => {
    const manifest = readJson('manifest.json');

    expect(manifest.storage).toEqual({ managed_schema: 'managed-storage-schema.json' });
    expect(existsSync(resolve(ROOT, manifest.storage.managed_schema))).toBe(true);

    const schema = readJson(manifest.storage.managed_schema);
    expect(schema.type).toBe('object');
    expect(schema).not.toHaveProperty('additionalProperties');
    expect(schema.properties.managedScripts.type).toBe('array');
    expect(schema.properties.managedScripts.items.type).toBe('object');
    expect(schema.properties.managedScripts.items.properties.url.type).toBe('string');
    expect(schema.properties.managedScripts.items.properties.code.type).toBe('string');
    expect(schema.properties.managedScriptsCleanup.type).toBe('boolean');
  });

  it('keeps Firefox on the existing profile without managed-storage schema wiring', async () => {
    const { manifest } = await generateManifestForProfile({ profile: 'firefox', rootDir: ROOT });

    expect(manifest).not.toHaveProperty('storage');
    expect(manifest.permissions).toContain('storage');
    expect(manifest.optional_permissions).toContain('userScripts');
  });

  it('keeps Edge aligned with the Chromium managed-storage schema', async () => {
    const { manifest } = await generateManifestForProfile({ profile: 'edge', rootDir: ROOT });

    expect(manifest.storage).toEqual({ managed_schema: 'managed-storage-schema.json' });
    expect(manifest.permissions).toContain('storage');
  });
});

describe('enterprise policy provisioning runtime contract', () => {
  const coreSource = readText('background.core.js');
  const dashboardSource = readText('pages/dashboard.js');
  const docs = readText('docs/enterprise-policy-provisioning.md');

  it('reads only declared policy keys and hides managed storage from content-script contexts', () => {
    expect(coreSource).toContain("const MANAGED_SCRIPT_POLICY_KEYS = ['managedScripts', 'managedScriptsCleanup'];");
    expect(coreSource).toContain('chrome.storage.managed.get(MANAGED_SCRIPT_POLICY_KEYS)');
    expect(coreSource).toContain("managed.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })");
    expect(coreSource).toContain('await restrictManagedStorageAccess();');
  });

  it('tags the returned install result instead of guessing from recent timestamps', () => {
    expect(coreSource).toContain('async function markManagedScript(result, originKey)');
    expect(coreSource).toContain("return `code-sha256:${await _sha256Hex(item.code)}`;");
    expect(coreSource).toContain('const managedScript = await markManagedScript(res, originKey);');
    expect(coreSource).not.toContain('item.code.slice(0, 64)');
    expect(coreSource).not.toContain('Date.now() - s.updatedAt < 30000');
  });

  it('records only aggregate managed-policy apply run feedback', () => {
    expect(coreSource).toContain("const MANAGED_SCRIPT_RUN_SCHEMA = 'scriptvault-managed-policy-run/v1';");
    expect(coreSource).toContain("const MANAGED_SCRIPT_LAST_RUN_KEY = 'managedScriptsLastRun';");
    expect(coreSource).toContain('async function recordManagedPolicyRunSummary(summary = {})');
    expect(coreSource).toContain('attemptedEntries');
    expect(coreSource).toContain('failedEntries');
    expect(coreSource).toContain('skippedInvalidEntries');
    expect(coreSource).toContain('pruneFailedScripts');
    expect(coreSource).toContain('await recordManagedPolicyRunSummary(runSummary);');
    expect(coreSource).not.toContain("console.warn('[ScriptVault] Managed script install (URL) failed:', url");
    expect(coreSource).not.toContain("console.warn('[ScriptVault] Managed prune failed:', script.id");
    expect(coreSource).not.toContain('Pruned ${script.meta?.name}');
  });

  it('surfaces managed scripts in the dashboard and administrator docs', () => {
    expect(dashboardSource).toContain('data-managed-badge="true"');
    expect(dashboardSource).toContain('Installed or updated from enterprise managed policy.');
    expect(docs).toContain('managedScriptsCleanup');
    expect(docs).toContain('source snippets');
  });
});
