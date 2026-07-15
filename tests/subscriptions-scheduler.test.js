import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();

describe('subscription refresh scheduler', () => {
  const core = readFileSync(resolve(ROOT, 'background.core.js'), 'utf8');
  const settingsType = readFileSync(resolve(ROOT, 'src/types/settings.ts'), 'utf8');
  const defaults = JSON.parse(readFileSync(resolve(ROOT, 'src/config/settings-defaults.json'), 'utf8'));
  const schema = JSON.parse(readFileSync(resolve(ROOT, 'src/config/settings-schema.json'), 'utf8'));

  it('defines typed defaults and visible schema controls', () => {
    expect(settingsType).toContain('subscriptionAutoRefresh: boolean;');
    expect(settingsType).toContain('subscriptionRefreshInterval: number;');
    expect(defaults.subscriptionAutoRefresh).toBe(true);
    expect(defaults.subscriptionRefreshInterval).toBe(24);
    expect(schema.classifications.visible).toContain('subscriptionAutoRefresh');
    expect(schema.classifications.visible).toContain('subscriptionRefreshInterval');
    expect(schema.metadata.subscriptionRefreshInterval.validation.kind).toBe('select-option');
  });

  it('manages a dedicated alarm only when enabled feeds exist', () => {
    expect(core).toContain("const SUBSCRIPTION_REFRESH_ALARM = 'subscriptionRefresh';");
    expect(core).toContain('await chrome.alarms.clear(SUBSCRIPTION_REFRESH_ALARM)');
    expect(core).toContain('settings.subscriptionAutoRefresh !== false');
    expect(core).toContain('await ScriptSubscriptions.list().catch(() => [])');
    expect(core).toContain('subscriptions.some(subscription => subscription.enabled !== false)');
    expect(core).toContain('Number(settings.subscriptionRefreshInterval ?? DEFAULT_SUBSCRIPTION_REFRESH_INTERVAL_HOURS)');
    expect(core).toContain('chrome.alarms.create(SUBSCRIPTION_REFRESH_ALARM, { periodInMinutes })');
  });

  it('routes alarm dispatch through the background mutex and reschedules on feed/settings changes', () => {
    expect(core).toMatch(/else if \(alarm\.name === SUBSCRIPTION_REFRESH_ALARM\) \{\s+await SubscriptionSystem\.refreshSubscriptions\(\);/);
    expect(core).toContain("'subscriptionAutoRefresh' in changed");
    expect(core).toContain("'subscriptionRefreshInterval' in changed");
    expect(core).toMatch(/const result = await this\.refreshSubscription\(subscription\.id, \{ feed, subscription \}\);\s+if \(result\?\.success\) \{\s+await setupAlarms\(\)\.catch\(\(\) => \{\}\);/);
    expect(core).toMatch(/const removed = await ScriptSubscriptions\.remove\(id\);\s+if \(removed\) \{\s+await setupAlarms\(\)\.catch\(\(\) => \{\}\);/);
  });
});
