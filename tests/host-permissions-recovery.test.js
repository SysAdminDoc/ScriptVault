import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runtimeHostPermissionPatternForUrl } from '../src/background/host-permission-patterns.ts';
import { deriveOptionalHostPermissionPlan } from '../src/background/host-permission-patterns.ts';

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
    const handler = source('src/background/script-action-handler.ts');
    expect(handler).toContain("'getHostPermissionStatus'");
    expect(handler).toContain("'queueHostAccessRequest'");
    expect(core).toContain('createScriptActionHandlers');
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

describe('optional host permission shipping gate', () => {
  it('ships Chrome and Firefox with broad install-time host access', () => {
    const chromeManifest = json('manifest.json');
    const firefoxManifest = json('manifest-firefox.json');

    expect(chromeManifest.host_permissions).toContain('<all_urls>');
    expect(chromeManifest.optional_host_permissions).toBeUndefined();
    expect(firefoxManifest.host_permissions).toContain('<all_urls>');
    expect(chromeManifest.content_scripts[0].matches).toContain('<all_urls>');
  });

  it('keeps the install review page out of web-accessible resources', () => {
    for (const manifestPath of ['manifest.json', 'manifest-firefox.json']) {
      const manifest = json(manifestPath);
      const blocks = manifest.web_accessible_resources || [];
      expect(blocks.flatMap(block => block.resources || [])).not.toContain('pages/install.html');
      expect(blocks.flatMap(block => block.matches || [])).not.toContain('<all_urls>');
    }

    const core = source('src/background/core.ts');
    expect(core).toContain("chrome.runtime.getURL('pages/install.html')");
  });

  it('derives scoped host grants from run, dependency, update, and connect metadata', () => {
    const plan = deriveOptionalHostPermissionPlan({
      match: ['https://example.com/*', '*://docs.example.org/*'],
      include: [],
      matchTop: ['https://top.example/*'],
      require: ['https://cdn.example.net/lib.js'],
      resource: { icon: 'https://static.example.net/icon.png' },
      updateURL: 'https://updates.example.net/script.user.js',
      downloadURL: '',
      connect: ['api.example.com'],
    });

    expect(plan.requiresBroadHostAccess).toBe(false);
    expect(plan.origins).toEqual(expect.arrayContaining([
      'https://example.com/*',
      'http://docs.example.org/*',
      'https://docs.example.org/*',
      'https://top.example/*',
      'https://cdn.example.net/*',
      'https://static.example.net/*',
      'https://updates.example.net/*',
      'http://api.example.com/*',
      'https://api.example.com/*',
    ]));
  });

  it('keeps universal host rules out of scoped grants until broad access is approved', () => {
    const plan = deriveOptionalHostPermissionPlan({
      match: ['<all_urls>'],
      include: [],
      matchTop: [],
      require: [],
      resource: {},
      updateURL: '',
      downloadURL: '',
      connect: ['*'],
    });

    expect(plan.requiresBroadHostAccess).toBe(true);
    expect(plan.origins).toEqual([]);
    expect(plan.broadOrigins).toEqual(['http://*/*', 'https://*/*']);

    expect(deriveOptionalHostPermissionPlan({
      match: ['<all_urls>'],
      connect: [],
    }, { allowBroad: true }).origins).toEqual(['http://*/*', 'https://*/*']);
  });
});
