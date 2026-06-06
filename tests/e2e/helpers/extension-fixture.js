import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

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
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: process.env.SCRIPT_VAULT_PLAYWRIGHT_CHANNEL || 'chromium',
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
