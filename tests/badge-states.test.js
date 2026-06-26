import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const badgeTs = readFileSync(resolve(process.cwd(), 'src/background/badge.ts'), 'utf8');
const settingsDefaults = JSON.parse(readFileSync(resolve(process.cwd(), 'src/config/settings-defaults.json'), 'utf8'));
const settingsSchema = JSON.parse(readFileSync(resolve(process.cwd(), 'src/config/settings-schema.json'), 'utf8'));
const settingsTypes = readFileSync(resolve(process.cwd(), 'src/types/settings.ts'), 'utf8');

describe('Ambient toolbar badge error states', () => {
  it('defaults badgeErrorStates to true', () => {
    expect(settingsDefaults.badgeErrorStates).toBe(true);
  });

  it('has badgeErrorStates in the Settings type', () => {
    expect(settingsTypes).toContain('badgeErrorStates');
  });

  it('has badgeErrorStates in the settings schema', () => {
    expect(settingsSchema.metadata.badgeErrorStates).toBeTruthy();
    expect(settingsSchema.metadata.badgeErrorStates.type).toBe('boolean');
  });

  it('checks badgeErrorStates setting in badge logic', () => {
    expect(badgeTs).toContain('badgeErrorStates');
  });

  it('uses amber color (#f59e0b) for error state', () => {
    expect(badgeTs).toContain('#f59e0b');
  });

  it('checks script stats.errors to determine error state', () => {
    expect(badgeTs).toContain('stats.errors');
  });

  it('preserves green as default badge color when no errors', () => {
    expect(badgeTs).toContain('#22c55e');
  });

  it('allows disabling error states via setting', () => {
    expect(badgeTs).toContain('badgeErrorStates !== false');
  });
});
