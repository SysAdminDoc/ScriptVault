import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runtimeHostPermissionPatternForUrl } from '../src/background/host-permission-patterns.ts';
import {
  buildOptionalHostPrototype,
  renderReport,
} from '../scripts/check-host-permission-prototype.mjs';

const ROOT = process.cwd();

function source(path) {
  return readFileSync(resolve(ROOT, path), 'utf8');
}

function json(path) {
  return JSON.parse(source(path));
}

describe('runtime host permission origin patterns', () => {
  it('derives narrow HTTP(S) origin request patterns', () => {
    expect(runtimeHostPermissionPatternForUrl('https://Example.com:8443/path?q=1')).toMatchObject({
      supported: true,
      pattern: 'https://example.com/*',
      origin: 'https://example.com:8443',
      host: 'example.com',
    });
    expect(runtimeHostPermissionPatternForUrl('http://sub.example.test/a')).toMatchObject({
      supported: true,
      pattern: 'http://sub.example.test/*',
      origin: 'http://sub.example.test',
      host: 'sub.example.test',
    });
  });

  it('rejects non-site URLs for runtime host access recovery', () => {
    expect(runtimeHostPermissionPatternForUrl('file:///tmp/script.user.js')).toMatchObject({
      supported: false,
      reason: 'unsupported-scheme',
    });
    expect(runtimeHostPermissionPatternForUrl('not a url')).toMatchObject({
      supported: false,
      reason: 'invalid-url',
    });
  });
});

describe('runtime host permission recovery wiring', () => {
  it('exposes background diagnostics, Chrome host access queueing, and permission events', () => {
    const core = source('src/background/core.ts');
    expect(core).toContain("case 'getHostPermissionStatus':");
    expect(core).toContain("case 'queueHostAccessRequest':");
    expect(core).toContain('chrome.permissions.addHostAccessRequest(request)');
    expect(core).toContain('chrome.permissions.onAdded.addListener');
    expect(core).toContain('chrome.permissions.onRemoved.addListener');
    expect(core).toContain("action: 'runtimeHostPermissionsChanged'");
  });

  it('surfaces blocked site access in popup, side panel, and dashboard', () => {
    const popup = source('pages/popup.js');
    const sidepanelHtml = source('pages/sidepanel.html');
    const sidepanelJs = source('pages/sidepanel.js');
    const dashboardHtml = source('pages/dashboard.html');
    const dashboardJs = source('pages/dashboard.js');

    expect(popup).toContain("setupState: 'host-permission-needed'");
    expect(popup).toContain("chrome.permissions.request({ origins: [status.pattern] })");
    expect(sidepanelHtml).toContain('id="hostAccessPanel"');
    expect(sidepanelJs).toContain("action: 'getHostPermissionStatus'");
    expect(sidepanelJs).toContain("action: 'queueHostAccessRequest'");
    expect(dashboardHtml).toContain('id="runtimeHostPermissionSummary"');
    expect(dashboardHtml).toContain('id="btnGrantCurrentHostAccess"');
    expect(dashboardJs).toContain('requestCurrentHostAccessFromDashboard');
    expect(dashboardJs).toContain("chrome.permissions.request({ origins: [status.pattern] })");
  });
});

describe('optional host permission prototype gate', () => {
  it('moves required all_urls into optional HTTP(S) host grants without changing shipping manifests', () => {
    const chromeManifest = json('manifest.json');
    const firefoxManifest = json('manifest-firefox.json');
    const prototype = buildOptionalHostPrototype(chromeManifest);

    expect(chromeManifest.host_permissions).toContain('<all_urls>');
    expect(firefoxManifest.host_permissions).toContain('<all_urls>');
    expect(prototype.host_permissions || []).not.toContain('<all_urls>');
    expect(prototype.optional_host_permissions).toEqual(expect.arrayContaining(['http://*/*', 'https://*/*']));
    expect(prototype.content_scripts[0].matches).toContain('<all_urls>');
  });

  it('keeps the generated prototype report current with reviewer copy', () => {
    const report = renderReport({
      chromeManifest: json('manifest.json'),
      firefoxManifest: json('manifest-firefox.json'),
      privacy: source('PRIVACY.md'),
      storeCopy: source('docs/store-listing-copy.md'),
    });

    expect(report.failures).toEqual([]);
    expect(report.text).toContain('Reviewer copy status: pass.');
    expect(report.text).toContain('optional_host_permissions');
  });
});
