import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const coreTs = readFileSync(resolve(ROOT, 'src/background/core.ts'), 'utf8');
const messagesTs = readFileSync(resolve(ROOT, 'src/types/messages.ts'), 'utf8');

describe('background runner dry-run action', () => {
  it('exposes a non-executing background dry-run action in the promoted source', () => {
    expect(coreTs).toContain("case 'prepareBackgroundRunnerDryRun':");
    expect(coreTs).toContain('return buildBackgroundRunnerDryRun(script, settings);');
    expect(coreTs).toContain('function buildBackgroundRunnerDryRun(script, settings = {})');
    expect(coreTs).toContain('executionEnabled: false');
    expect(coreTs).toContain('includesCode: false');
    expect(coreTs).toContain("source: 'scriptvault-background-runner'");
    expect(coreTs).not.toMatch(/case 'prepareBackgroundRunnerDryRun':[\s\S]{0,600}buildBackgroundWrappedScript/);
  });

  it('types the action and response without exposing wrapper code', () => {
    expect(messagesTs).toContain("action: 'prepareBackgroundRunnerDryRun';");
    expect(messagesTs).toContain('interface BackgroundRunnerDryRunResponse');
    expect(messagesTs).toContain('executionEnabled: false;');
    expect(messagesTs).toContain('includesCode: false;');
    expect(messagesTs).toContain('prepareBackgroundRunnerDryRun: BackgroundRunnerDryRunResponse | ErrorResponse;');
    expect(messagesTs).not.toMatch(/BackgroundRunnerDryRunResponse[\s\S]{0,900}\bcode:/);
  });
});
