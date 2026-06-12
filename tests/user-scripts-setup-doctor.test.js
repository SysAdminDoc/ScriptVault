import { describe, expect, it } from 'vitest';
import { buildSetupDoctorView } from '../src/modules/user-scripts-setup.ts';

describe('UserScripts setup doctor view model', () => {
  it('normalizes Chrome 138+ Allow User Scripts recovery', () => {
    const view = buildSetupDoctorView(
      { userScriptsAvailable: false, chromeVersion: 139 },
      { browserName: 'chromium', extensionId: 'abc123' },
    );

    expect(view).toMatchObject({
      setupState: 'allow-user-scripts-disabled',
      actionLabel: 'Open Extension Details',
      actionKind: 'open-extension-details',
      setupUrl: 'chrome://extensions/?id=abc123',
    });
    expect(view.bannerText).toContain('Allow User Scripts');
    expect(view.helpSteps.join(' ')).toContain('Allow User Scripts');
  });

  it('normalizes Chrome 120-137 Developer Mode recovery', () => {
    const view = buildSetupDoctorView(
      { userScriptsAvailable: false, chromeVersion: 137 },
      { browserName: 'chromium', extensionId: 'abc123' },
    );

    expect(view).toMatchObject({
      setupState: 'developer-mode-disabled',
      actionLabel: 'Open Extensions Page',
      actionKind: 'open-extensions-page',
      setupUrl: 'chrome://extensions',
    });
    expect(view.bannerText).toContain('Developer Mode');
  });

  it('normalizes Firefox optional userScripts permission recovery', () => {
    const view = buildSetupDoctorView(
      { userScriptsAvailable: false },
      { browserName: 'firefox', extensionId: 'abc123' },
    );

    expect(view).toMatchObject({
      setupState: 'firefox-user-scripts-permission',
      actionLabel: 'Grant Permission',
      actionKind: 'request-firefox-user-scripts',
      setupUrl: '',
    });
    expect(view.message).toContain('optional Firefox userScripts permission');
  });

  it('models current-site host permission recovery separately from userScripts setup', () => {
    const view = buildSetupDoctorView({
      setupState: 'host-permission-needed',
      host: 'example.com',
      pattern: 'https://example.com/*',
      requestMethod: 'addHostAccessRequest',
      message: 'example.com cannot run until ScriptVault is granted browser access.',
    });

    expect(view).toMatchObject({
      setupState: 'host-permission-needed',
      actionLabel: 'Request Site Access',
      actionKind: 'queue-host-access-request',
      setupUrl: '',
    });
    expect(view.detailLines).toContain('Pattern: https://example.com/*');
  });

  it('keeps ready state and probe errors explicit for runtime diagnostics', () => {
    const view = buildSetupDoctorView({
      userScriptsAvailable: true,
      setupRequired: false,
      setupState: 'available',
      chromeVersion: 140,
      apiProbeError: 'transient probe text',
    });

    expect(view.ready).toBe(true);
    expect(view.detailLines).toEqual(expect.arrayContaining([
      'Status: available',
      'API probe: transient probe text',
    ]));
  });
});
