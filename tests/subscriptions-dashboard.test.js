import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();

describe('subscription dashboard surface', () => {
  const html = readFileSync(resolve(ROOT, 'pages/dashboard.html'), 'utf8');
  const js = readFileSync(resolve(ROOT, 'pages/dashboard.js'), 'utf8');

  it('renders the utilities subscription controls', () => {
    expect(html).toContain('id="subscriptionUrlInput"');
    expect(html).toContain('id="subscriptionNameInput"');
    expect(html).toContain('id="btnAddSubscription"');
    expect(html).toContain('id="btnRefreshSubscriptions"');
    expect(html).toContain('id="settingsSubscriptionAutoRefresh"');
    expect(html).toContain('id="settingsSubscriptionRefreshInterval"');
    expect(html).toContain('id="subscriptionList"');
  });

  it('wires subscription actions to background messages and the update inbox', () => {
    expect(js).toContain("'script subscriptions': 'import'");
    expect(js).toContain("action: 'getSubscriptions'");
    expect(js).toContain("action: 'addSubscription'");
    expect(js).toContain("action: 'refreshSubscriptions'");
    expect(js).toContain("action: 'removeSubscription'");
    expect(js).toContain("update.kind === 'subscription-install'");
    expect(js).toContain("settingsSubscriptionAutoRefresh: ['subscriptionAutoRefresh', 'checked']");
    expect(js).toContain("settingsSubscriptionRefreshInterval: ['subscriptionRefreshInterval', 'value']");
  });

  it('renders feed health indicators', () => {
    expect(html).toContain('subscription-health');
    expect(js).toContain("Health: ${escapeHtml(health.label)}");
    expect(js).toContain("Needs attention");
    expect(js).toContain("Not checked");
    expect(js).toContain("Healthy");
  });
});
