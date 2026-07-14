import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { e2eMode, failReleaseIfUnsupported, isReleaseE2EMode } from './e2e-mode.js';

export { failReleaseIfUnsupported, isReleaseE2EMode } from './e2e-mode.js';

const extensionPath = resolve(process.cwd());

function assertExtensionFiles() {
  const requiredFiles = [
    'manifest.json',
    'background.js',
    'content.js',
    'pages/dashboard.html',
    'pages/install.html',
    'lib/codemirror/codemirror.min.js',
    'lib/monaco-esm/editor.css',
    'lib/monaco-esm/editor.js',
  ];
  const missing = requiredFiles.filter(file => !existsSync(join(extensionPath, file)));
  if (missing.length > 0) {
    throw new Error(`Missing extension files: ${missing.join(', ')}. Run npm run build before npm run test:e2e.`);
  }
}

async function findExtensionId(context) {
  const existing = context.serviceWorkers().find(worker => worker.url().startsWith('chrome-extension://'));
  const worker = existing || await context.waitForEvent('serviceworker', {
    predicate: candidate => candidate.url().startsWith('chrome-extension://'),
    timeout: 15_000,
  });
  const [, extensionId] = worker.url().match(/^chrome-extension:\/\/([^/]+)\//) || [];
  if (!extensionId) throw new Error(`Could not resolve extension id from ${worker.url()}`);
  return extensionId;
}

export async function launchScriptVault() {
  assertExtensionFiles();
  const userDataDir = await mkdtemp(join(tmpdir(), 'scriptvault-pw-'));
  const channel = process.env.SCRIPT_VAULT_PLAYWRIGHT_CHANNEL || 'chromium';
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel,
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--disable-dev-shm-usage',
      '--no-default-browser-check',
      '--no-first-run',
      '--no-sandbox',
    ],
  });

  const extensionId = await findExtensionId(context);
  return {
    context,
    channel,
    extensionId,
    url: path => `chrome-extension://${extensionId}/${path.replace(/^\/+/, '')}`,
    async close() {
      await context.close().catch(() => {});
      await rm(userDataDir, { recursive: true, force: true });
    },
  };
}

export async function openExtensionPage(app, path = 'pages/dashboard.html') {
  const page = await app.context.newPage();
  await page.goto(app.url(path), { waitUntil: 'domcontentloaded', timeout: 20_000 });
  return page;
}

export async function sendRuntimeMessage(page, message) {
  return page.evaluate(payload => chrome.runtime.sendMessage(payload), message);
}

export async function enableUserScriptsToggle(app) {
  const page = await app.context.newPage();
  try {
    await page.goto(`chrome://extensions/?id=${app.extensionId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 20_000,
    });
    const findToggle = () => page.evaluateHandle(() => {
      const findControl = root => {
        const direct = root.querySelector?.('#itemAllowUserScripts');
        if (direct) return direct;
        const row = root.querySelector?.('#allow-user-scripts');
        if (row) {
          return row.shadowRoot?.querySelector('#crToggle, cr-toggle')
            || row.querySelector?.('#crToggle, cr-toggle')
            || row;
        }
        for (const element of root.querySelectorAll?.('*') || []) {
          if (!element.shadowRoot) continue;
          const nested = findControl(element.shadowRoot);
          if (nested) return nested;
        }
        return null;
      };
      return findControl(document);
    });

    let toggle = null;
    const deadline = Date.now() + 10_000;
    while (!toggle && Date.now() < deadline) {
      const handle = await findToggle();
      toggle = handle.asElement();
      if (!toggle) {
        await handle.dispose();
        await page.waitForTimeout(150);
      }
    }
    if (!toggle) {
      return {
        present: false,
        enabledBefore: null,
        enabledAfter: null,
        note: 'The browser did not expose an Allow User Scripts toggle.',
      };
    }

    const enabledBefore = await toggle.evaluate(input => input.checked === true);
    if (!enabledBefore) {
      await toggle.click();
      await page.waitForFunction(() => {
        const findControl = root => {
          const direct = root.querySelector?.('#itemAllowUserScripts');
          if (direct) return direct;
          const row = root.querySelector?.('#allow-user-scripts');
          if (row) return row.shadowRoot?.querySelector('#crToggle, cr-toggle') || row.querySelector?.('#crToggle, cr-toggle') || row;
          for (const element of root.querySelectorAll?.('*') || []) {
            if (element.shadowRoot) {
              const nested = findControl(element.shadowRoot);
              if (nested) return nested;
            }
          }
          return null;
        };
        return findControl(document)?.checked === true;
      }, { timeout: 10_000 });
    }
    const enabledAfter = await toggle.evaluate(input => input.checked === true);
    return {
      present: true,
      enabledBefore,
      enabledAfter,
      note: enabledBefore
        ? 'Allow User Scripts was already enabled in the Playwright profile.'
        : 'Allow User Scripts was enabled through the extension details page.',
    };
  } finally {
    await page.close().catch(() => {});
  }
}

export async function ensureUserScriptsAvailable(app, page) {
  let status = await sendRuntimeMessage(page, { action: 'getExtensionStatus' });
  let toggleResult = null;
  if (!status?.userScriptsAvailable) {
    toggleResult = await enableUserScriptsToggle(app);
    if (toggleResult?.enabledAfter) {
      status = await sendRuntimeMessage(page, { action: 'repairRuntimeState' });
    }
  }

  const available = status?.userScriptsAvailable === true;
  const reason = `chrome.userScripts unavailable: ${status?.setupState || status?.apiProbeError || toggleResult?.note || 'unknown setup state'}`;
  failReleaseIfUnsupported(available, reason, {
    mode: e2eMode(),
    channel: app.channel,
    browserVersion: app.context.browser()?.version() || 'unknown',
    status: {
      userScriptsAvailable: status?.userScriptsAvailable ?? null,
      setupState: status?.setupState || null,
      apiProbeError: status?.apiProbeError || null,
    },
    toggle: toggleResult,
  });
  return { available, reason, status, toggleResult };
}

export async function seedPendingInstall(page, { code, url }) {
  await page.evaluate(({ nextCode, nextUrl }) => chrome.storage.local.set({
    pendingInstall: {
      code: nextCode,
      url: nextUrl,
      timestamp: Date.now(),
    },
  }), { nextCode: code, nextUrl: url });
}

export function userscript({ name, namespace = 'scriptvault-e2e', version = '1.0.0', body = '' }) {
  return [
    '// ==UserScript==',
    `// @name ${name}`,
    `// @namespace ${namespace}`,
    `// @version ${version}`,
    '// @match https://example.com/*',
    '// @grant none',
    '// ==/UserScript==',
    body || `console.log(${JSON.stringify(`${name} ${version}`)});`,
    '',
  ].join('\n');
}

export async function setInstallEnabled(page, enabled) {
  const checkbox = page.locator('#enable-install');
  await checkbox.waitFor({ state: 'attached', timeout: 10_000 });
  await checkbox.evaluate((element, nextEnabled) => {
    element.checked = nextEnabled;
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, enabled);
}
