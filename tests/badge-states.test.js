import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { updateBadgeForTab } from '../src/background/badge.ts';

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

  it('counts only scripts that can actually auto-run on the page', async () => {
    vi.clearAllMocks();
    const originalMatcher = globalThis.doesScriptMatchUrl;
    globalThis.doesScriptMatchUrl = vi.fn(() => true);
    const script = (id, overrides = {}) => ({
      id,
      enabled: true,
      meta: { match: ['https://example.com/*'], 'run-at': 'document-idle', background: false },
      settings: {},
      ...overrides,
    });
    const scripts = [
      script('normal'),
      script('background', { meta: { match: ['https://example.com/*'], 'run-at': 'document-idle', background: true } }),
      script('context-menu', { meta: { match: ['https://example.com/*'], 'run-at': 'context-menu', background: false } }),
      script('quarantined', { settings: { _importQuarantine: { source: 'test' } } }),
      script('registration-error', { settings: { _registrationError: 'register failed' } }),
    ];

    try {
      await updateBadgeForTab(
        1,
        'https://example.com/page',
        { showBadge: true, enabled: true, badgeInfo: 'running', pageFilterMode: 'blacklist' },
        scripts,
      );

      expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '1', tabId: 1 });
    } finally {
      globalThis.doesScriptMatchUrl = originalMatcher;
    }
  });
});
