import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const fixtureSource = readFileSync(resolve(root, 'tests/e2e/helpers/extension-fixture.js'), 'utf8');
const configSource = readFileSync(resolve(root, 'playwright.config.mjs'), 'utf8');
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const executionSpecs = [
  'local-workspace.spec.js',
  'service-worker-rehydration.spec.js',
  'value-change-remote.spec.js',
  'xhr-formdata.spec.js',
].map(name => readFileSync(resolve(root, 'tests/e2e', name), 'utf8'));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('release E2E mode', () => {
  it('has separately labeled capability and fail-closed release commands', () => {
    expect(packageJson.scripts['test:e2e']).toBe('node scripts/run-e2e.mjs capability');
    expect(packageJson.scripts['test:e2e:release']).toBe('node scripts/run-e2e.mjs release');
    expect(configSource).toContain('scriptvault-${process.env.SCRIPT_VAULT_E2E_MODE');
  });

  it('throws explicit evidence instead of skipping a required release capability', async () => {
    vi.stubEnv('SCRIPT_VAULT_E2E_MODE', 'release');
    const { failReleaseIfUnsupported } = await import('./e2e/helpers/e2e-mode.js');

    expect(() => failReleaseIfUnsupported(false, 'forced unavailable', { channel: 'test' }))
      .toThrow(/release proof failed closed[\s\S]*forced unavailable[\s\S]*"channel":"test"/);
  });

  it('keeps unsupported capabilities skippable only in capability mode', async () => {
    vi.stubEnv('SCRIPT_VAULT_E2E_MODE', 'capability');
    const { failReleaseIfUnsupported } = await import('./e2e/helpers/e2e-mode.js');
    expect(() => failReleaseIfUnsupported(false, 'capability probe', { channel: 'test' })).not.toThrow();
  });

  it('routes all four required execution smokes through the shared gate', () => {
    expect(fixtureSource).toContain('export async function ensureUserScriptsAvailable');
    expect(fixtureSource).toContain("from './e2e-mode.js'");
    for (const spec of executionSpecs) {
      expect(spec).toContain('ensureUserScriptsAvailable(app, dashboard)');
      expect(spec).not.toContain('enableUserScriptsToggle');
      expect(spec).not.toMatch(/test\.skip\(\s*!status\?\.userScriptsAvailable/);
    }
  });
});
