import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const coreTs = readFileSync(resolve(ROOT, 'background.core.js'), 'utf8');
const messagesTs = readFileSync(resolve(ROOT, 'src/types/messages.ts'), 'utf8');

describe('background runner dry-run action', () => {
  it('exposes a non-executing background dry-run action in the promoted source', () => {
    expect(coreTs).toContain('prepareBackgroundRunnerDryRun: async scriptId =>');
    expect(coreTs).toContain('return buildBackgroundRunnerDryRun(script, await SettingsManager.get());');
    expect(coreTs).toContain('function buildBackgroundRunnerDryRun(script, settings = {})');
    expect(coreTs).toContain('executionEnabled: false');
    expect(coreTs).toContain('includesCode: false');
    expect(coreTs).toContain("source: 'scriptvault-background-runner'");
    const routeStart = coreTs.indexOf('prepareBackgroundRunnerDryRun: async scriptId =>');
    const route = coreTs.slice(routeStart, coreTs.indexOf('repairRuntimeState:', routeStart));
    expect(route).not.toContain('buildBackgroundWrappedScript');
  });

  it('types the action and response without exposing wrapper code', () => {
    const responseStart = messagesTs.indexOf('interface BackgroundRunnerDryRunResponse');
    const responseEnd = messagesTs.indexOf('\n}', responseStart) + 2;
    const responseInterface = messagesTs.slice(responseStart, responseEnd);

    expect(responseStart).toBeGreaterThanOrEqual(0);
    expect(responseEnd).toBeGreaterThan(responseStart);
    expect(messagesTs).toContain("action: 'prepareBackgroundRunnerDryRun';");
    expect(messagesTs).toContain('interface BackgroundRunnerDryRunResponse');
    expect(messagesTs).toContain('executionEnabled: false;');
    expect(messagesTs).toContain('includesCode: false;');
    expect(messagesTs).toContain('prepareBackgroundRunnerDryRun: BackgroundRunnerDryRunResponse | ErrorResponse;');
    expect(responseInterface).not.toMatch(/\bcode:/);
  });
});
