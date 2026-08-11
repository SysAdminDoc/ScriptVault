import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, test } from '@playwright/test';

import {
  ensureUserScriptsAvailable,
  launchScriptVault,
  openExtensionPage,
  sendRuntimeMessage,
} from './helpers/extension-fixture.js';

const PROJECT_ROOT = resolve(process.cwd());
const COPY_PATHS = [
  'manifest.json',
  'background.js',
  'content.js',
  'managed-storage-schema.json',
  '_locales',
  'images',
  'lib',
  'modules',
  'pages',
];
const ENABLED_ID = 'script_e2e_upgrade_enabled';
const DISABLED_ID = 'script_e2e_upgrade_disabled';
const FAILED_ID = 'script_e2e_upgrade_failed';
const STALE_ID = 'stale_upgrade_registration';

async function copyExtensionPackage(destination) {
  for (const relativePath of COPY_PATHS) {
    await cp(resolve(PROJECT_ROOT, relativePath), join(destination, relativePath), { recursive: true });
  }
}

async function writeManifestVersion(extensionPath, version) {
  const manifestPath = join(extensionPath, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.version = version;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

function upgradeUserscript({ name, match = 'https://example.com/*' }) {
  return [
    '// ==UserScript==',
    `// @name ${name}`,
    '// @namespace scriptvault-e2e-upgrade',
    '// @version 1.0.0',
    `// @match ${match}`,
    '// @grant none',
    '// ==/UserScript==',
    'document.documentElement.dataset.scriptVaultUpgrade = "ok";',
    '',
  ].join('\n');
}

async function registrationIds(page) {
  return page.evaluate(async () => {
    if (!chrome.userScripts?.getScripts) return null;
    const registrations = await chrome.userScripts.getScripts();
    return registrations.map(registration => registration.id).sort();
  });
}

async function seedStaleRegistration(page) {
  await page.evaluate(async (id) => {
    await chrome.userScripts.register([{
      id,
      matches: ['https://example.com/*'],
      js: [{ code: 'void 0;' }],
    }]);
  }, STALE_ID);
}

test('extension update force-rehydrates enabled registrations and removes stale entries', async () => {
  const extensionPath = await mkdtemp(join(tmpdir(), 'scriptvault-upgrade-extension-'));
  const userDataDir = await mkdtemp(join(tmpdir(), 'scriptvault-upgrade-profile-'));
  let app = null;
  let updatedApp = null;

  try {
    await copyExtensionPackage(extensionPath);
    await writeManifestVersion(extensionPath, '3.27.0');

    app = await launchScriptVault({ extensionPath, userDataDir });
    const dashboard = await openExtensionPage(app);
    try {
      const capability = await ensureUserScriptsAvailable(app, dashboard);
      test.skip(!capability.available, capability.reason);

      await expect(sendRuntimeMessage(dashboard, {
        action: 'saveScript',
        data: { id: ENABLED_ID, code: upgradeUserscript({ name: 'Upgrade enabled' }), enabled: true },
      })).resolves.toMatchObject({ success: true, scriptId: ENABLED_ID });
      await expect(sendRuntimeMessage(dashboard, {
        action: 'saveScript',
        data: { id: DISABLED_ID, code: upgradeUserscript({ name: 'Upgrade disabled' }), enabled: false },
      })).resolves.toMatchObject({ success: true, scriptId: DISABLED_ID });
      await expect(sendRuntimeMessage(dashboard, {
        action: 'saveScript',
        data: {
          id: FAILED_ID,
          code: upgradeUserscript({ name: 'Upgrade failed registration', match: 'https://' }),
          enabled: true,
        },
      })).resolves.toMatchObject({ success: true, scriptId: FAILED_ID });

      await expect.poll(() => registrationIds(dashboard), { timeout: 30_000 })
        .toEqual(expect.arrayContaining([ENABLED_ID]));
      await seedStaleRegistration(dashboard);
      await expect.poll(() => registrationIds(dashboard), { timeout: 10_000 })
        .toEqual(expect.arrayContaining([ENABLED_ID, STALE_ID]));
    } finally {
      await dashboard.close().catch(() => {});
    }

    await app.close();
    app = null;
    await writeManifestVersion(extensionPath, '3.27.1');

    updatedApp = await launchScriptVault({ extensionPath, userDataDir });
    const updatedDashboard = await openExtensionPage(updatedApp);
    try {
      const capability = await ensureUserScriptsAvailable(updatedApp, updatedDashboard);
      test.skip(!capability.available, capability.reason);

      await expect.poll(async () => {
        const report = await sendRuntimeMessage(updatedDashboard, { action: 'getLocalHealthReport' });
        return report?.registration?.forceReregister === true ? report : null;
      }, { timeout: 30_000 }).not.toBeNull();
      const report = await sendRuntimeMessage(updatedDashboard, { action: 'getLocalHealthReport' });

      expect(report.registration.mode).toBe('force');
      expect(report.registration.forceReregister).toBe(true);
      expect(report.registration.status).toMatch(/registered|partial/);
      expect(report.scripts.registrationErrors).toBeGreaterThanOrEqual(1);
      expect(report.warnings).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'registrationErrors' }),
      ]));

      await expect.poll(() => registrationIds(updatedDashboard), { timeout: 30_000 })
        .toEqual([ENABLED_ID]);
      const finalIds = await registrationIds(updatedDashboard);
      expect(new Set(finalIds).size).toBe(finalIds.length);
      expect(finalIds).not.toContain(DISABLED_ID);
      expect(finalIds).not.toContain(STALE_ID);
      expect(finalIds).not.toContain(FAILED_ID);
    } finally {
      await updatedDashboard.close().catch(() => {});
    }
  } finally {
    await updatedApp?.close().catch(() => {});
    await app?.close().catch(() => {});
    await rm(userDataDir, { recursive: true, force: true });
    await rm(extensionPath, { recursive: true, force: true });
  }
});

test('Firefox extension-update registration coverage is explicitly capability-gated', async () => {
  test.skip(true, 'Firefox userScripts registration is covered by sideload capability smoke; Playwright has no equivalent unpacked-extension update install path.');
});
