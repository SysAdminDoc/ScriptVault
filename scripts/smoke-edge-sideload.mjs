#!/usr/bin/env node
// scripts/smoke-edge-sideload.mjs
//
// Deterministic Microsoft Edge sideload smoke for the generated Edge package.
// The script builds/stages the Edge artifact, loads build-edge/ into Edge,
// exercises extension pages, saves/toggles a userscript, verifies it runs on a
// local target page, and writes ignored release evidence under edge-artifacts/.

import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = process.cwd();
const BUILD_DIR = resolve(ROOT, 'build-edge');
const ARTIFACT_DIR = resolve(ROOT, 'edge-artifacts');
const MANIFEST = JSON.parse(readFileSync(resolve(ROOT, 'manifest.json'), 'utf8'));
const VERSION = MANIFEST.version;
const EDGE_REPORT_PATH = resolve(ARTIFACT_DIR, `edge-build-${VERSION}.json`);
const EDGE_SMOKE_PATH = resolve(ARTIFACT_DIR, `edge-smoke-${VERSION}.json`);
const args = new Set(process.argv.slice(2));

function fail(message) {
  throw new Error(`[edge-smoke] ${message}`);
}

function edgeCandidates() {
  const envPaths = [
    process.env.SCRIPT_VAULT_EDGE_PATH,
    process.env.EDGE_PATH,
    process.env.PUPPETEER_EXECUTABLE_PATH,
  ].filter(Boolean);

  if (process.platform === 'win32') {
    return [
      ...envPaths,
      join(process.env.PROGRAMFILES || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      join(process.env['PROGRAMFILES(X86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ];
  }

  if (process.platform === 'darwin') {
    return [
      ...envPaths,
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ];
  }

  return [
    ...envPaths,
    '/usr/bin/microsoft-edge',
    '/usr/bin/microsoft-edge-stable',
    '/opt/microsoft/msedge/msedge',
  ];
}

function findEdgeExecutable() {
  const executable = edgeCandidates().find(candidate => candidate && existsSync(candidate));
  if (!executable) {
    fail('Microsoft Edge executable not found. Set SCRIPT_VAULT_EDGE_PATH or EDGE_PATH.');
  }
  return executable;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function assertEdgePackageReady(report) {
  const failures = [];
  if (!existsSync(BUILD_DIR)) failures.push('build-edge/ is missing');
  if (!existsSync(EDGE_REPORT_PATH)) failures.push(`missing ${EDGE_REPORT_PATH}`);
  if (report.version !== VERSION) failures.push(`report version ${report.version || '<missing>'} does not match manifest ${VERSION}`);
  if (Array.isArray(report.missingFiles) && report.missingFiles.length > 0) {
    failures.push(`report has missing files: ${report.missingFiles.join(', ')}`);
  }
  if (!report.artifact || !existsSync(resolve(ROOT, report.artifact))) {
    failures.push(`missing Edge ZIP: ${report.artifact || '<missing>'}`);
  }
  if (report.edgeReadiness?.updateUrlRemoved !== true) {
    failures.push('Edge report did not verify update_url removal');
  }
  if (failures.length > 0) fail(failures.join('; '));
}

function buildEdgePackageIfNeeded() {
  if (args.has('--skip-build')) return;
  execFileSync(process.execPath, ['scripts/build-edge.mjs', '--check'], {
    cwd: ROOT,
    stdio: 'inherit',
  });
}

async function smokePageServer() {
  const server = createServer((req, res) => {
    if (req.url === '/favicon.ico') {
      res.writeHead(204);
      res.end();
      return;
    }
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    });
    res.end(`<!doctype html>
      <html>
        <head><title>ScriptVault Edge smoke target</title></head>
        <body><main id="target">Edge smoke target</main></body>
      </html>`);
  });

  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const port = server.address().port;
  return {
    url: `http://127.0.0.1:${port}/smoke-target`,
    close: () => new Promise(resolveClose => server.close(resolveClose)),
  };
}

async function findExtensionId(browser) {
  const isScriptVaultTarget = target => {
    const url = target.url();
    return url.startsWith('chrome-extension://') && url.endsWith('/background.js');
  };
  const existing = browser.targets().find(isScriptVaultTarget);
  const target = existing || await browser.waitForTarget(isScriptVaultTarget, { timeout: 20000 });
  const [, extensionId] = target.url().match(/^chrome-extension:\/\/([^/]+)/) || [];
  if (!extensionId) fail(`Could not resolve extension id from target URL: ${target.url()}`);
  return extensionId;
}

async function attachTargetLogging(target, errors, seenTargets) {
  if (seenTargets.has(target)) return;
  seenTargets.add(target);
  const url = target.url();
  const type = target.type();
  const extensionTarget = url.startsWith('chrome-extension://') || type === 'service_worker';
  if (!extensionTarget) return;

  if (type === 'page') {
    const page = await target.page().catch(() => null);
    if (!page) return;
    attachPageLogging(page, errors, `page:${url || '<pending>'}`);
    return;
  }

  if (type === 'service_worker') {
    const session = await target.createCDPSession().catch(() => null);
    if (!session) return;
    await session.send('Runtime.enable').catch(() => {});
    session.on('Runtime.exceptionThrown', event => {
      errors.push({
        scope: `service_worker:${url}`,
        type: 'exception',
        text: event.exceptionDetails?.text || event.exceptionDetails?.exception?.description || 'service worker exception',
      });
    });
    session.on('Runtime.consoleAPICalled', event => {
      if (event.type !== 'error') return;
      const text = (event.args || []).map(arg => arg.value || arg.description || '').filter(Boolean).join(' ');
      errors.push({
        scope: `service_worker:${url}`,
        type: 'console.error',
        text: text || 'service worker console.error',
      });
    });
  }
}

function attachPageLogging(page, errors, scope) {
  page.on('pageerror', error => {
    errors.push({ scope, type: 'pageerror', text: error?.message || String(error) });
  });
  page.on('console', message => {
    if (message.type() !== 'error') return;
    errors.push({
      scope,
      type: 'console.error',
      text: message.text(),
      location: message.location(),
    });
  });
}

async function runtimeMessage(page, message, timeout = 60000) {
  page.setDefaultTimeout(timeout);
  return await page.evaluate(msg => chrome.runtime.sendMessage(msg).catch(error => ({ error: String(error) })), message);
}

async function openDashboard(browser, extensionId, errors) {
  const page = await browser.newPage();
  attachPageLogging(page, errors, 'dashboard');
  await page.goto(`chrome-extension://${extensionId}/pages/dashboard.html`, {
    waitUntil: 'domcontentloaded',
    timeout: 25000,
  });
  await page.waitForSelector('#scriptsPanel.tm-panel.active', { timeout: 20000 });
  await page.waitForSelector('.tm-tab[data-tab="scripts"]', { timeout: 20000 });

  return {
    page,
    snapshot: await page.evaluate(() => ({
      title: document.title,
      manifestVersion: chrome.runtime.getManifest().version,
      activeTab: document.querySelector('.tm-tab[data-tab="scripts"]')?.textContent?.trim() || '',
      selectedTab: document.querySelector('.tm-tab[data-tab="scripts"]')?.getAttribute('aria-selected') || '',
      hasNewScriptButton: !!document.querySelector('#btnNewScript'),
      hasSearch: !!document.querySelector('#scriptSearch'),
      setupBannerState: document.querySelector('[data-setup-state]')?.getAttribute('data-setup-state') || '',
    })),
  };
}

async function enableEdgeUserScriptsToggle(browser, extensionId) {
  const page = await browser.newPage();
  try {
    await page.goto(`edge://extensions/?id=${extensionId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    });
    await page.waitForSelector('#itemAllowUserScripts', { timeout: 10000 }).catch(() => null);
    const hasToggle = await page.$('#itemAllowUserScripts');
    if (!hasToggle) {
      return {
        present: false,
        enabledBefore: null,
        enabledAfter: null,
        note: 'Edge did not expose an Allow User Scripts toggle on the extension details page.',
      };
    }

    const enabledBefore = await page.$eval('#itemAllowUserScripts', input => !!input.checked);
    if (!enabledBefore) {
      await page.$eval('#itemAllowUserScripts', input => input.click());
      await page.waitForFunction(() => document.querySelector('#itemAllowUserScripts')?.checked === true, {
        timeout: 10000,
      });
    }
    const enabledAfter = await page.$eval('#itemAllowUserScripts', input => !!input.checked);
    return {
      present: true,
      enabledBefore,
      enabledAfter,
      note: enabledBefore
        ? 'Allow User Scripts was already enabled in the temporary Edge profile.'
        : 'Allow User Scripts was enabled through edge://extensions in the temporary Edge profile.',
    };
  } finally {
    await page.close().catch(() => {});
  }
}

async function openPopup(browser, extensionId, errors) {
  const page = await browser.newPage();
  attachPageLogging(page, errors, 'popup');
  await page.goto(`chrome-extension://${extensionId}/pages/popup.html`, {
    waitUntil: 'domcontentloaded',
    timeout: 20000,
  });
  await page.waitForSelector('body', { timeout: 10000 });
  return await page.evaluate(() => {
    const rect = document.body.getBoundingClientRect();
    return {
      title: document.title,
      bodyText: document.body.innerText.slice(0, 300),
      hasActionButton: !!document.querySelector('button, [role="button"]'),
      popupWidthOk: Math.round(rect.width) === 360,
      popupOverflowOk: document.body.scrollWidth <= Math.ceil(rect.width),
      bodyWidth: rect.width,
      bodyScrollWidth: document.body.scrollWidth,
    };
  });
}

async function scriptRoundTrip(browser, dashboardPage) {
  const status = await runtimeMessage(dashboardPage, { action: 'getExtensionStatus' });
  if (status?.error) fail(`getExtensionStatus failed: ${status.error}`);
  if (!status?.userScriptsAvailable) {
    fail(`userScripts unavailable: ${status?.setupState || status?.setupMessage || JSON.stringify(status)}`);
  }

  const scriptId = 'scriptvault_edge_smoke';
  const code = `// ==UserScript==\n// @name ScriptVault Edge Smoke\n// @namespace scriptvault/smoke\n// @version 1.0.0\n// @match http://127.0.0.1/*\n// @grant none\n// ==/UserScript==\n\ndocument.documentElement.dataset.scriptvaultEdgeSmoke = 'ok';\n`;

  const save = await runtimeMessage(dashboardPage, {
    action: 'saveScript',
    id: scriptId,
    code,
    enabled: true,
  });
  if (save?.error || !save?.success) fail(`saveScript failed: ${save?.error || JSON.stringify(save)}`);

  const list = await runtimeMessage(dashboardPage, { action: 'getScripts' });
  if (list?.error) fail(`getScripts failed: ${list.error}`);
  const saved = (list?.scripts || []).find(script => script.id === scriptId);
  if (!saved) fail('Saved Edge smoke script was not returned by getScripts');

  const disabled = await runtimeMessage(dashboardPage, {
    action: 'toggleScript',
    scriptId,
    enabled: false,
  });
  if (disabled?.error || !disabled?.success) fail(`toggle off failed: ${disabled?.error || JSON.stringify(disabled)}`);

  const enabled = await runtimeMessage(dashboardPage, {
    action: 'toggleScript',
    scriptId,
    enabled: true,
  });
  if (enabled?.error || !enabled?.success) fail(`toggle on failed: ${enabled?.error || JSON.stringify(enabled)}`);

  const target = await smokePageServer();
  const targetPage = await browser.newPage();
  try {
    await targetPage.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await targetPage.waitForFunction(() => document.documentElement.dataset.scriptvaultEdgeSmoke === 'ok', {
      timeout: 15000,
    });
    const runResult = await targetPage.evaluate(() => ({
      ok: document.documentElement.dataset.scriptvaultEdgeSmoke === 'ok',
      marker: document.documentElement.dataset.scriptvaultEdgeSmoke || '',
      title: document.title,
      url: location.href,
    }));

    return {
      status,
      savedScript: {
        id: saved.id,
        name: saved.meta?.name || '',
        enabledAfterSave: saved.enabled !== false,
      },
      toggle: {
        disabled: disabled.script?.enabled === false,
        enabled: enabled.script?.enabled === true,
      },
      target: runResult,
    };
  } finally {
    await targetPage.close().catch(() => {});
    await target.close();
  }
}

async function writeEvidence(evidence) {
  await mkdir(ARTIFACT_DIR, { recursive: true });
  await writeFile(EDGE_SMOKE_PATH, `${JSON.stringify(evidence, null, 2)}\n`);
}

async function main() {
  buildEdgePackageIfNeeded();
  const edgeReport = readJson(EDGE_REPORT_PATH);
  assertEdgePackageReady(edgeReport);

  const executablePath = findEdgeExecutable();
  const userDataDir = await mkdtemp(join(tmpdir(), 'scriptvault-edge-smoke-'));
  const extensionErrors = [];
  const seenTargets = new WeakSet();
  let browser;
  let evidence = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    version: VERSION,
    status: 'failed',
    edgeExecutable: executablePath,
    buildReport: {
      path: `edge-artifacts/edge-build-${VERSION}.json`,
      generatedAt: edgeReport.generatedAt,
      artifact: edgeReport.artifact,
      manifestTransformed: edgeReport.manifestTransformed,
    },
    checks: {},
    extensionErrors,
  };

  try {
    browser = await puppeteer.launch({
      executablePath,
      headless: args.has('--headed') ? false : true,
      userDataDir,
      pipe: true,
      enableExtensions: [BUILD_DIR],
      args: [
        '--disable-dev-shm-usage',
        '--no-default-browser-check',
        '--no-first-run',
        '--no-sandbox',
      ],
    });

    browser.on('targetcreated', target => {
      attachTargetLogging(target, extensionErrors, seenTargets).catch(error => {
        extensionErrors.push({ scope: 'targetcreated', type: 'logging-attach-failed', text: error?.message || String(error) });
      });
    });
    await Promise.all(browser.targets().map(target => attachTargetLogging(target, extensionErrors, seenTargets)));

    evidence.edgeVersion = await browser.version();
    const extensionId = await findExtensionId(browser);
    evidence.extensionId = extensionId;
    evidence.checks.edgeUserScriptsToggle = await enableEdgeUserScriptsToggle(browser, extensionId);

    const dashboard = await openDashboard(browser, extensionId, extensionErrors);
    evidence.checks.dashboard = dashboard.snapshot;
    if (dashboard.snapshot.title !== 'ScriptVault Dashboard') fail(`unexpected dashboard title: ${dashboard.snapshot.title}`);
    if (dashboard.snapshot.manifestVersion !== VERSION) fail(`dashboard manifest version ${dashboard.snapshot.manifestVersion} does not match ${VERSION}`);
    if (!/installed userscripts/i.test(dashboard.snapshot.activeTab)) fail(`unexpected dashboard active tab: ${dashboard.snapshot.activeTab}`);
    if (dashboard.snapshot.selectedTab !== 'true') fail('dashboard installed scripts tab is not selected');
    if (!dashboard.snapshot.hasNewScriptButton || !dashboard.snapshot.hasSearch) fail('dashboard missing script controls');

    const popup = await openPopup(browser, extensionId, extensionErrors);
    evidence.checks.popup = popup;
    if (!popup.hasActionButton) fail('popup did not render any action buttons');
    if (!popup.popupWidthOk || !popup.popupOverflowOk) {
      fail(`popup layout overflow: width=${popup.bodyWidth}, scrollWidth=${popup.bodyScrollWidth}`);
    }

    evidence.checks.scriptRoundTrip = await scriptRoundTrip(browser, dashboard.page);
    if (!evidence.checks.scriptRoundTrip.target?.ok) fail('Edge smoke userscript did not run on the local target page');

    const fatalErrors = extensionErrors.filter(error => error.type !== 'console.error');
    if (fatalErrors.length > 0) {
      fail(`captured ${fatalErrors.length} extension runtime exception(s)`);
    }
    if (args.has('--strict-console') && extensionErrors.length > 0) {
      fail(`captured ${extensionErrors.length} extension console/runtime error(s)`);
    }

    evidence.status = 'passed';
    await writeEvidence(evidence);
    console.log(`Edge sideload smoke passed for ScriptVault ${VERSION} (${extensionId}).`);
    console.log(`Evidence: edge-artifacts/edge-smoke-${VERSION}.json`);
  } catch (error) {
    evidence.failure = error?.message || String(error);
    await writeEvidence(evidence);
    throw error;
  } finally {
    if (browser) await browser.close().catch(() => {});
    await rm(userDataDir, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
