#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const ROOT = process.cwd();
const EXTENSION_ID = 'ScriptVault@sysadmindoc.dev';
const DEFAULT_TIMEOUT_MS = 30000;
const args = new Set(process.argv.slice(2));
const skipPackage = args.has('--skip-package');
const headed = args.has('--headed');
const keepBrowser = args.has('--keep-browser');

function fail(message) {
  throw new Error(`[firefox-smoke] ${message}`);
}

function parseVersion(text) {
  const match = String(text || '').match(/(\d+)(?:\.(\d+))?(?:[ab]\d+)?/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2] || 0),
    raw: match[0],
  };
}

function versionAtLeast(actual, minimum) {
  if (!actual) return false;
  if (actual.major !== minimum.major) return actual.major > minimum.major;
  return actual.minor >= minimum.minor;
}

function firefoxCandidates() {
  const envPaths = [
    process.env.SCRIPT_VAULT_FIREFOX_PATH,
    process.env.FIREFOX_PATH,
  ].filter(Boolean);

  if (process.platform === 'win32') {
    return [
      ...envPaths,
      join(process.env.PROGRAMFILES || '', 'Firefox Developer Edition', 'firefox.exe'),
      join(process.env.PROGRAMFILES || '', 'Firefox Nightly', 'firefox.exe'),
      join(process.env.PROGRAMFILES || '', 'Mozilla Firefox', 'firefox.exe'),
      join(process.env.LOCALAPPDATA || '', 'Programs', 'Firefox Developer Edition', 'firefox.exe'),
      join(process.env.LOCALAPPDATA || '', 'Programs', 'Firefox Nightly', 'firefox.exe'),
      join(process.env.LOCALAPPDATA || '', 'Mozilla Firefox', 'firefox.exe'),
      join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WindowsApps', 'firefox.exe'),
    ];
  }

  if (process.platform === 'darwin') {
    return [
      ...envPaths,
      '/Applications/Firefox Developer Edition.app/Contents/MacOS/firefox',
      '/Applications/Firefox Nightly.app/Contents/MacOS/firefox',
      '/Applications/Firefox.app/Contents/MacOS/firefox',
    ];
  }

  return [
    ...envPaths,
    '/usr/bin/firefox-developer-edition',
    '/usr/bin/firefox-nightly',
    '/usr/bin/firefox',
    '/snap/bin/firefox',
  ];
}

function readFirefoxVersion(binary) {
  for (const flag of ['-v', '--version']) {
    const result = spawnSync(binary, [flag], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 10000,
    });
    const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
    const version = parseVersion(output);
    if (version) return { ...version, output };
  }
  return null;
}

function findFirefox(minimum) {
  const seen = new Set();
  const rejected = [];
  for (const candidate of firefoxCandidates()) {
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    if (!existsSync(candidate)) continue;
    const version = readFirefoxVersion(candidate);
    if (!version) {
      rejected.push(`${candidate} (version unreadable)`);
      continue;
    }
    if (versionAtLeast(version, minimum)) {
      return { binary: candidate, version };
    }
    rejected.push(`${candidate} (${version.output || version.raw})`);
  }
  fail(`Firefox ${minimum.raw}+ not found. Checked: ${rejected.join('; ') || 'no executable candidates'}. Set SCRIPT_VAULT_FIREFOX_PATH to a compatible Firefox/Nightly/Developer Edition binary.`);
}

function findGeckodriver() {
  const env = process.env.GECKODRIVER_PATH || process.env.GECKODRIVER;
  if (env && existsSync(env)) return env;
  const probe = process.platform === 'win32'
    ? spawnSync('where.exe', ['geckodriver'], { encoding: 'utf8', windowsHide: true })
    : spawnSync('which', ['geckodriver'], { encoding: 'utf8' });
  const found = probe.stdout?.split(/\r?\n/).find(Boolean);
  if (found) return found.trim();
  fail('geckodriver not found. Install it or set GECKODRIVER_PATH.');
}

async function freePort() {
  return await new Promise((resolvePort, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = address && typeof address === 'object' ? address.port : null;
      server.close(() => {
        if (!port) reject(new Error('Could not allocate a free local port'));
        else resolvePort(port);
      });
    });
  });
}

async function smokePageServer() {
  const server = createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(`<!doctype html>
      <html>
        <head><title>ScriptVault Firefox Smoke Target</title></head>
        <body><main id="target">Firefox smoke target</main></body>
      </html>`);
  });
  await new Promise((resolveServer, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', resolveServer);
  });
  const address = server.address();
  const port = address && typeof address === 'object' ? address.port : null;
  if (!port) {
    server.close();
    fail('Could not start local Firefox smoke target server');
  }
  return {
    url: `http://127.0.0.1:${port}/smoke-target`,
    close: () => new Promise(resolveClose => server.close(resolveClose)),
  };
}

async function latestFirefoxPackage(version) {
  const artifactDir = resolve(ROOT, 'firefox-artifacts');
  const expected = join(artifactDir, `scriptvault-firefox-v${version}.zip`);
  if (existsSync(expected)) return expected;
  const entries = await readdir(artifactDir).catch(() => []);
  const packages = [];
  for (const name of entries) {
    if (!/^scriptvault-firefox-v.+\.zip$/i.test(name) || /source/i.test(name)) continue;
    const path = join(artifactDir, name);
    const info = await stat(path);
    packages.push({ path, mtimeMs: info.mtimeMs });
  }
  packages.sort((a, b) => b.mtimeMs - a.mtimeMs);
  if (packages[0]) return packages[0].path;
  fail('Firefox package missing. Run npm run firefox:package or omit --skip-package.');
}

async function readJsonFile(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function runCommand(command, commandArgs, label) {
  console.log(`${label}...`);
  const result = spawnSync(command, commandArgs, {
    cwd: ROOT,
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
  });
  if (result.error) fail(`${label} failed: ${result.error.message}`);
  if (result.status !== 0) fail(`${label} exited with ${result.status}`);
}

async function request(baseUrl, method, path, body, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const text = await response.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { value: text };
    }
    if (!response.ok) {
      const detail = parsed?.value?.message || text || response.statusText;
      fail(`${method} ${path} returned ${response.status}: ${detail}`);
    }
    return parsed;
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForGeckodriver(baseUrl, processHandle) {
  for (let i = 0; i < 100; i += 1) {
    if (processHandle.exitCode !== null) fail(`geckodriver exited early with ${processHandle.exitCode}`);
    try {
      const status = await request(baseUrl, 'GET', '/status', null, 1000);
      if (status.value?.ready) return;
    } catch {
      // Retry until the listener is ready.
    }
    await delay(150);
  }
  fail('geckodriver did not become ready');
}

async function webdriverSession(baseUrl, firefox, profileDir = null) {
  const firefoxArgs = ['-remote-allow-system-access'];
  if (!headed) firefoxArgs.unshift('-headless');
  if (profileDir) firefoxArgs.push('-profile', profileDir);
  const capabilities = {
    capabilities: {
      alwaysMatch: {
        browserName: 'firefox',
        'moz:firefoxOptions': {
          binary: firefox.binary,
          args: firefoxArgs,
          prefs: {
            'browser.shell.checkDefaultBrowser': false,
            'extensions.webextensions.userScripts.enabled': true,
            'xpinstall.signatures.required': false,
          },
        },
      },
    },
  };
  const session = await request(baseUrl, 'POST', '/session', capabilities, 60000);
  return session.value?.sessionId;
}

async function switchContext(baseUrl, sessionId, context) {
  await request(baseUrl, 'POST', `/session/${sessionId}/moz/context`, { context });
}

async function execute(baseUrl, sessionId, script, argsForScript = []) {
  const result = await request(baseUrl, 'POST', `/session/${sessionId}/execute/sync`, {
    script,
    args: argsForScript,
  });
  return result.value;
}

async function executeAsync(baseUrl, sessionId, script, argsForScript = [], timeoutMs = DEFAULT_TIMEOUT_MS) {
  const result = await request(baseUrl, 'POST', `/session/${sessionId}/execute/async`, {
    script,
    args: argsForScript,
  }, timeoutMs);
  return result.value;
}

async function runtimeMessage(baseUrl, sessionId, message, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const result = await executeAsync(baseUrl, sessionId, `
    const done = arguments[arguments.length - 1];
    chrome.runtime.sendMessage(arguments[0])
      .then(response => done(response))
      .catch(error => done({ error: String(error) }));
  `, [message], timeoutMs);
  if (result?.error) fail(`${message.action || 'runtime message'} failed during Firefox smoke: ${result.error}`);
  return result;
}

async function findElement(baseUrl, sessionId, selector) {
  const result = await request(baseUrl, 'POST', `/session/${sessionId}/element`, {
    using: 'css selector',
    value: selector,
  });
  const element = result.value?.ELEMENT || result.value?.['element-6066-11e4-a52e-4f735466cecf'];
  if (!element) fail(`Could not find element for selector ${selector}`);
  return element;
}

async function clickElement(baseUrl, sessionId, element) {
  await request(baseUrl, 'POST', `/session/${sessionId}/element/${element}/click`, {});
}

async function getExtensionResource(baseUrl, sessionId, resourcePath) {
  await switchContext(baseUrl, sessionId, 'chrome');
  const value = await executeAsync(baseUrl, sessionId, `
    const done = arguments[arguments.length - 1];
    (async () => {
      const { ExtensionParent } = ChromeUtils.importESModule('resource://gre/modules/ExtensionParent.sys.mjs');
      const extension = ExtensionParent.GlobalManager.extensionMap.get(arguments[0])
        || ExtensionParent.GlobalManager.getExtension(arguments[0]);
      if (!extension) {
        done({ error: 'add-on not found' });
        return;
      }
      done({
        id: extension.id,
        name: extension.manifest?.name,
        version: extension.version,
        uri: new URL(arguments[1], extension.baseURI.spec).href
      });
    })().catch(error => done({ error: String(error), stack: error.stack }));
  `, [EXTENSION_ID, resourcePath]);
  if (value?.error) fail(`Could not resolve extension resource ${resourcePath}: ${value.error}`);
  await switchContext(baseUrl, sessionId, 'content');
  return value;
}

async function grantFirefoxUserScriptsPermission(baseUrl, sessionId) {
  await switchContext(baseUrl, sessionId, 'chrome');
  const value = await executeAsync(baseUrl, sessionId, `
    const done = arguments[arguments.length - 1];
    (async () => {
      const { ExtensionParent } = ChromeUtils.importESModule('resource://gre/modules/ExtensionParent.sys.mjs');
      const { ExtensionPermissions } = ChromeUtils.importESModule('resource://gre/modules/ExtensionPermissions.sys.mjs');
      const extension = ExtensionParent.GlobalManager.extensionMap.get(arguments[0])
        || ExtensionParent.GlobalManager.getExtension(arguments[0]);
      if (!extension) {
        done({ error: 'add-on not found' });
        return;
      }
      await ExtensionPermissions.add(
        arguments[0],
        { permissions: ['userScripts'], origins: [] },
        extension
      );
      const permissions = await ExtensionPermissions.get(arguments[0]);
      done({
        ok: permissions.permissions.includes('userScripts'),
        permissions: permissions.permissions,
        origins: permissions.origins
      });
    })().catch(error => done({ error: String(error), stack: error.stack }));
  `, [EXTENSION_ID], 15000);
  await switchContext(baseUrl, sessionId, 'content');
  if (value?.error || !value?.ok) {
    fail(`Could not grant Firefox userScripts permission in headless smoke: ${value?.error || JSON.stringify(value)}`);
  }
  return value;
}

async function restartFirefoxSession(baseUrl, sessionId, firefox, packagePath, profileDir) {
  await request(baseUrl, 'DELETE', `/session/${sessionId}`).catch(() => {});
  await delay(1500);
  const restartedSessionId = await webdriverSession(baseUrl, firefox, profileDir);
  if (!restartedSessionId) fail('geckodriver did not return a WebDriver session id after Firefox restart');
  const install = await request(baseUrl, 'POST', `/session/${restartedSessionId}/moz/addon/install`, {
    path: packagePath,
    temporary: true,
  }, 60000);
  if (install.value !== EXTENSION_ID) fail(`unexpected installed add-on id after Firefox restart: ${install.value}`);
  return restartedSessionId;
}

async function navigate(baseUrl, sessionId, url) {
  await request(baseUrl, 'POST', `/session/${sessionId}/url`, { url }, 60000);
}

async function waitFor(baseUrl, sessionId, label, predicate, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeoutMs) {
    last = await execute(baseUrl, sessionId, predicate).catch(error => ({ error: error.message }));
    if (last?.ok) return last;
    await delay(250);
  }
  fail(`${label} timed out. Last snapshot: ${JSON.stringify(last)}`);
}

async function waitForAsync(baseUrl, sessionId, label, script, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeoutMs) {
    last = await executeAsync(baseUrl, sessionId, script, [], Math.min(5000, timeoutMs))
      .catch(error => ({ error: error.message }));
    if (last?.ok) return last;
    await delay(250);
  }
  fail(`${label} timed out. Last snapshot: ${JSON.stringify(last)}`);
}

async function dashboardSmoke(baseUrl, sessionId, dashboardUrl) {
  await navigate(baseUrl, sessionId, dashboardUrl);
  await waitFor(baseUrl, sessionId, 'dashboard load', `
    return {
      ok: document.readyState !== 'loading'
        && document.title === 'ScriptVault Dashboard'
        && !!document.querySelector('.tm-header')
        && !!document.querySelector('#scriptsPanel')
        && !!document.querySelector('#btnNewScript'),
      title: document.title,
      text: document.body?.innerText?.slice(0, 300) || '',
      url: location.href
    };
  `);
  return await execute(baseUrl, sessionId, `
    return {
      title: document.title,
      hasHeader: !!document.querySelector('.tm-header'),
      hasScriptsPanel: !!document.querySelector('#scriptsPanel'),
      hasNewScriptButton: !!document.querySelector('#btnNewScript'),
      hasSearch: !!document.querySelector('#scriptSearch')
    };
  `);
}

async function popupSmoke(baseUrl, sessionId, popupUrl) {
  await navigate(baseUrl, sessionId, popupUrl);
  await waitFor(baseUrl, sessionId, 'popup load', `
    return {
      ok: document.readyState !== 'loading'
        && document.title.includes('ScriptVault')
        && !!document.body
        && document.body.innerText.length > 0,
      title: document.title,
      text: document.body?.innerText?.slice(0, 300) || '',
      url: location.href
    };
  `);
  return await execute(baseUrl, sessionId, `
    return {
      title: document.title,
      text: document.body.innerText.slice(0, 300),
      hasActionButton: !!document.querySelector('button, [role="button"]')
    };
  `);
}

async function scriptRoundTripSmoke(baseUrl, sessionId, dashboardUrl) {
  await navigate(baseUrl, sessionId, dashboardUrl);
  let usedHeadlessPermissionGrant = false;
  const initialStatus = await executeAsync(baseUrl, sessionId, `
    const done = arguments[arguments.length - 1];
    chrome.runtime.sendMessage({ action: 'getExtensionStatus' })
      .then(result => done(result))
      .catch(error => done({ error: String(error) }));
  `, [], 60000);
  if (initialStatus?.error) fail(`getExtensionStatus failed during Firefox smoke: ${initialStatus.error}`);
  if (initialStatus?.setupState === 'firefox-user-scripts-permission') {
    await waitFor(baseUrl, sessionId, 'Firefox userScripts permission button', `
      const button = document.querySelector('#btnOpenExtensionDetails');
      return {
        ok: !!button && button.textContent.trim() === 'Grant Permission' && !button.disabled,
        text: button?.textContent?.trim() || '',
        disabled: !!button?.disabled
      };
    `);
    await clickElement(baseUrl, sessionId, await findElement(baseUrl, sessionId, '#btnOpenExtensionDetails'));
    const userGrantStatus = await waitForAsync(baseUrl, sessionId, 'Firefox userScripts permission grant', `
      const done = arguments[arguments.length - 1];
      chrome.runtime.sendMessage({ action: 'getExtensionStatus' })
        .then(status => done({
          ok: !!status?.userScriptsAvailable,
          setupState: status?.setupState || '',
          setupMessage: status?.setupMessage || '',
          apiProbeError: status?.apiProbeError || ''
        }))
        .catch(error => done({ ok: false, error: String(error) }));
    `, 5000).catch(error => ({ ok: false, error: error.message }));
    if (!userGrantStatus?.ok) {
      usedHeadlessPermissionGrant = true;
      console.log('Firefox permission prompt did not complete in headless WebDriver; granting optional userScripts permission through chrome context.');
      await grantFirefoxUserScriptsPermission(baseUrl, sessionId);
      await waitForAsync(baseUrl, sessionId, 'Firefox userScripts permission grant after chrome-context permission update', `
        const done = arguments[arguments.length - 1];
        chrome.runtime.sendMessage({ action: 'repairRuntimeState' })
          .then(status => done({
            ok: !!status?.userScriptsAvailable,
            setupState: status?.setupState || '',
            setupMessage: status?.setupMessage || '',
            apiProbeError: status?.apiProbeError || ''
          }))
          .catch(error => done({ ok: false, error: String(error) }));
      `, 15000);
    }
  } else if (!initialStatus?.userScriptsAvailable) {
    fail(`userScripts unavailable before smoke save: ${initialStatus?.setupState || initialStatus?.setupMessage || JSON.stringify(initialStatus)}`);
  }

  const code = `// ==UserScript==\n// @name ScriptVault Firefox Smoke\n// @namespace scriptvault/smoke\n// @version 1.0.0\n// @match http://127.0.0.1/*\n// @grant none\n// ==/UserScript==\n\ndocument.documentElement.dataset.scriptvaultFirefoxSmoke = 'ok';\n`;
  const save = await executeAsync(baseUrl, sessionId, `
    const done = arguments[arguments.length - 1];
    chrome.runtime.sendMessage({ action: 'saveScript', id: 'scriptvault_firefox_smoke', code: arguments[0], enabled: true })
      .then(result => done(result))
      .catch(error => done({ error: String(error) }));
  `, [code], 60000);
  if (save?.error) fail(`saveScript failed during Firefox smoke: ${save.error}`);

  const listAfterSave = await executeAsync(baseUrl, sessionId, `
    const done = arguments[arguments.length - 1];
    chrome.runtime.sendMessage({ action: 'getScripts' })
      .then(result => done(result))
      .catch(error => done({ error: String(error) }));
  `, [], 60000);
  if (listAfterSave?.error) fail(`getScripts failed during Firefox smoke: ${listAfterSave.error}`);
  const saved = (listAfterSave?.scripts || []).find(script => script.id === 'scriptvault_firefox_smoke');
  if (!saved) fail('Saved smoke script was not returned by getScripts');

  const disabled = await executeAsync(baseUrl, sessionId, `
    const done = arguments[arguments.length - 1];
    chrome.runtime.sendMessage({ action: 'toggleScript', scriptId: arguments[0], enabled: false })
      .then(result => done(result))
      .catch(error => done({ error: String(error) }));
  `, ['scriptvault_firefox_smoke'], 60000);
  if (disabled?.error || !disabled?.success) fail(`toggle off failed during Firefox smoke: ${disabled?.error || JSON.stringify(disabled)}`);

  const enabled = await executeAsync(baseUrl, sessionId, `
    const done = arguments[arguments.length - 1];
    chrome.runtime.sendMessage({ action: 'toggleScript', scriptId: arguments[0], enabled: true })
      .then(result => done(result))
      .catch(error => done({ error: String(error) }));
  `, ['scriptvault_firefox_smoke'], 60000);
  if (enabled?.error || !enabled?.success) fail(`toggle on failed during Firefox smoke: ${enabled?.error || JSON.stringify(enabled)}`);

  const target = await smokePageServer();
  let runResult;
  try {
    await navigate(baseUrl, sessionId, target.url);
    runResult = await waitFor(baseUrl, sessionId, 'userscript run on target page', `
      return {
        ok: document.documentElement.dataset.scriptvaultFirefoxSmoke === 'ok',
        marker: document.documentElement.dataset.scriptvaultFirefoxSmoke || '',
        title: document.title,
        url: location.href
      };
    `, 15000);
  } finally {
    await target.close();
  }

  return {
    savedName: saved.metadata?.name || saved.meta?.name || saved.id,
    savedEnabled: saved.enabled !== false,
    toggledOff: disabled.script?.enabled === false,
    toggledOn: enabled.script?.enabled === true,
    ranOnTargetPage: runResult.ok,
    headlessPermissionGrant: usedHeadlessPermissionGrant,
  };
}

async function backupRoundTripSmoke(baseUrl, sessionId, dashboardUrl) {
  await navigate(baseUrl, sessionId, dashboardUrl);
  const scriptId = 'script_firefox_backup_roundtrip';
  const code = `// ==UserScript==\n// @name ScriptVault Chrome Backup Fixture\n// @namespace scriptvault/firefox-backup-smoke\n// @version 1.2.3\n// @match https://example.com/*\n// @grant GM_getValue\n// @grant GM_setValue\n// ==/UserScript==\n\nconsole.log('backup round-trip');\n`;

  const save = await runtimeMessage(baseUrl, sessionId, {
    action: 'saveScript',
    id: scriptId,
    code,
    enabled: false,
  }, 60000);
  if (!save?.success || !save?.script?.updatedAt) {
    fail(`saveScript failed for Firefox backup round-trip: ${JSON.stringify(save)}`);
  }

  await runtimeMessage(baseUrl, sessionId, {
    action: 'GM_setValues',
    scriptId,
    values: {
      counter: 42,
      nested: { source: 'chrome-backup-fixture', ok: true },
    },
  }, 60000);

  const exported = await runtimeMessage(baseUrl, sessionId, {
    action: 'exportZip',
    options: { includeStorage: true },
  }, 60000);
  if (!exported?.zipData) fail(`exportZip did not return zipData: ${JSON.stringify(exported)}`);

  await runtimeMessage(baseUrl, sessionId, {
    action: 'GM_deleteValues',
    scriptId,
    keys: ['counter', 'nested'],
  }, 60000);
  const deleted = await runtimeMessage(baseUrl, sessionId, { action: 'deleteScript', scriptId }, 60000);
  if (!deleted?.success) fail(`deleteScript failed before backup import: ${JSON.stringify(deleted)}`);
  await runtimeMessage(baseUrl, sessionId, { action: 'emptyTrash' }, 60000);

  const importResult = await runtimeMessage(baseUrl, sessionId, {
    action: 'importFromZip',
    zipData: exported.zipData,
    options: {
      overwrite: true,
      sourceLabel: 'Firefox smoke Chrome backup fixture',
    },
  }, 60000);
  if (importResult?.imported < 1 || importResult?.errors?.length) {
    fail(`importFromZip backup round-trip failed: ${JSON.stringify(importResult)}`);
  }

  const scriptsAfterImport = await runtimeMessage(baseUrl, sessionId, { action: 'getScripts' }, 60000);
  const restored = (scriptsAfterImport?.scripts || []).find(script => script.id === scriptId);
  if (!restored) fail('Backup round-trip script was not restored by importFromZip');

  const storageAfterImport = await runtimeMessage(baseUrl, sessionId, {
    action: 'getScriptValues',
    scriptId,
  }, 60000);
  const restoredValues = storageAfterImport?.values || {};

  if (restored.enabled !== false) fail('Backup round-trip did not preserve disabled state');
  const restoredName = restored.metadata?.name || restored.meta?.name || '';
  if (restoredName !== 'ScriptVault Chrome Backup Fixture') fail('Backup round-trip did not preserve metadata name');
  if (restored.updatedAt !== save.script.updatedAt) {
    fail(`Backup round-trip did not preserve updatedAt: before=${save.script.updatedAt} after=${restored.updatedAt}`);
  }
  if (restored.createdAt !== save.script.createdAt) {
    fail(`Backup round-trip did not preserve createdAt: before=${save.script.createdAt} after=${restored.createdAt}`);
  }
  if (restoredValues.counter !== 42 || restoredValues.nested?.source !== 'chrome-backup-fixture') {
    fail(`Backup round-trip did not restore script storage: ${JSON.stringify(restoredValues)}`);
  }

  const jsonScriptId = 'script_firefox_json_backup';
  const jsonCreatedAt = 1700000010000;
  const jsonUpdatedAt = 1700000014321;
  const jsonCode = `// ==UserScript==\n// @name ScriptVault Chrome JSON Fixture\n// @namespace scriptvault/firefox-json-smoke\n// @version 2.0.0\n// @match https://example.org/*\n// @grant none\n// ==/UserScript==\n\nconsole.log('json backup round-trip');\n`;
  const jsonImport = await runtimeMessage(baseUrl, sessionId, {
    action: 'importAll',
    data: {
      data: {
        version: 2,
        exportedAt: '2026-06-04T00:00:00.000Z',
        scripts: [{
          id: jsonScriptId,
          code: jsonCode,
          enabled: false,
          position: 3,
          createdAt: jsonCreatedAt,
          updatedAt: jsonUpdatedAt,
        }],
      },
      options: {
        overwrite: true,
        importSettings: false,
      },
    },
  }, 60000);
  if (jsonImport?.imported !== 1 || jsonImport?.errors?.length) {
    fail(`importAll JSON backup round-trip failed: ${JSON.stringify(jsonImport)}`);
  }
  const scriptsAfterJsonImport = await runtimeMessage(baseUrl, sessionId, { action: 'getScripts' }, 60000);
  const jsonRestored = (scriptsAfterJsonImport?.scripts || []).find(script => script.id === jsonScriptId);
  if (!jsonRestored) fail('JSON backup script was not restored by importAll');
  const jsonRestoredName = jsonRestored.metadata?.name || jsonRestored.meta?.name || '';
  if (
    jsonRestoredName !== 'ScriptVault Chrome JSON Fixture' ||
    jsonRestored.enabled !== false ||
    jsonRestored.createdAt !== jsonCreatedAt ||
    jsonRestored.updatedAt !== jsonUpdatedAt
  ) {
    fail(`JSON backup round-trip did not preserve metadata/state/timestamps: ${JSON.stringify(jsonRestored)}`);
  }

  return {
    imported: importResult.imported,
    restoredId: restored.id,
    restoredName,
    restoredEnabled: restored.enabled,
    storageKeys: Object.keys(restoredValues).sort(),
    timestampsPreserved: restored.updatedAt === save.script.updatedAt && restored.createdAt === save.script.createdAt,
    jsonImported: jsonImport.imported,
    jsonTimestampsPreserved: jsonRestored.updatedAt === jsonUpdatedAt && jsonRestored.createdAt === jsonCreatedAt,
  };
}

async function storageAndTrashSmoke(baseUrl, sessionId, dashboardUrl, firefox, packagePath, profileDir) {
  await navigate(baseUrl, sessionId, dashboardUrl);
  const bulkScripts = Array.from({ length: 26 }, (_, index) => {
    const suffix = String(index + 1).padStart(2, '0');
    return {
      id: `script_firefox_quota_${suffix}`,
      code: [
        '// ==UserScript==',
        `// @name Firefox Quota Fixture ${suffix}`,
        `// @namespace scriptvault/firefox-quota/${suffix}`,
        '// @version 1.0.0',
        '// @match https://quota.example/*',
        '// @grant none',
        '// ==/UserScript==',
        `console.log('quota ${suffix}');`,
      ].join('\n'),
      enabled: false,
      position: index,
      createdAt: 1700000100000 + index,
      updatedAt: 1700000200000 + index,
    };
  });

  const bulkImport = await runtimeMessage(baseUrl, sessionId, {
    action: 'importAll',
    data: {
      data: {
        version: 2,
        exportedAt: '2026-06-04T00:00:00.000Z',
        scripts: bulkScripts,
      },
      options: {
        overwrite: true,
        importSettings: false,
      },
    },
  }, 60000);
  if (bulkImport?.imported !== bulkScripts.length || bulkImport?.errors?.length) {
    fail(`26-script Firefox quota fixture import failed: ${JSON.stringify(bulkImport)}`);
  }

  const afterBulkImport = await runtimeMessage(baseUrl, sessionId, { action: 'getScripts' }, 60000);
  const importedIds = new Set((afterBulkImport?.scripts || []).map(script => script.id));
  const missingBulkIds = bulkScripts.map(script => script.id).filter(id => !importedIds.has(id));
  if (missingBulkIds.length > 0) {
    fail(`26-script Firefox quota fixture missing restored ids: ${missingBulkIds.join(', ')}`);
  }
  const storageUsage = await runtimeMessage(baseUrl, sessionId, { action: 'getStorageUsage' }, 60000);
  if (storageUsage?.error) fail(`getStorageUsage failed after quota fixture import: ${storageUsage.error}`);

  const trashScriptId = 'script_firefox_trash_restart';
  const trashCode = `// ==UserScript==\n// @name Firefox Trash Restart Fixture\n// @namespace scriptvault/firefox-trash\n// @version 1.0.0\n// @match https://trash.example/*\n// @grant none\n// ==/UserScript==\n\nconsole.log('trash restart');\n`;
  const saveTrashScript = await runtimeMessage(baseUrl, sessionId, {
    action: 'saveScript',
    id: trashScriptId,
    code: trashCode,
    enabled: false,
  }, 60000);
  if (!saveTrashScript?.success) fail(`saveScript failed for trash restart fixture: ${JSON.stringify(saveTrashScript)}`);
  const deleteTrashScript = await runtimeMessage(baseUrl, sessionId, { action: 'deleteScript', scriptId: trashScriptId }, 60000);
  if (!deleteTrashScript?.success) fail(`deleteScript failed for trash restart fixture: ${JSON.stringify(deleteTrashScript)}`);
  const trashBeforeRestart = await runtimeMessage(baseUrl, sessionId, { action: 'getTrash' }, 60000);
  if (!(trashBeforeRestart?.trash || []).some(script => script.id === trashScriptId)) {
    fail(`Trash restart fixture missing before Firefox restart: ${JSON.stringify(trashBeforeRestart)}`);
  }

  const restartedSessionId = await restartFirefoxSession(baseUrl, sessionId, firefox, packagePath, profileDir);
  const refreshedDashboard = await getExtensionResource(baseUrl, restartedSessionId, 'pages/dashboard.html');
  await navigate(baseUrl, restartedSessionId, refreshedDashboard.uri);
  await waitFor(baseUrl, restartedSessionId, 'dashboard reload after Firefox restart', `
    return {
      ok: document.readyState !== 'loading'
        && document.title === 'ScriptVault Dashboard'
        && !!document.querySelector('#scriptsPanel'),
      title: document.title,
      url: location.href
    };
  `, 30000);

  const trashAfterRestart = await runtimeMessage(baseUrl, restartedSessionId, { action: 'getTrash' }, 60000);
  if (!(trashAfterRestart?.trash || []).some(script => script.id === trashScriptId)) {
    fail(`Trash restart fixture missing after Firefox restart: ${JSON.stringify(trashAfterRestart)}`);
  }
  const restoreResult = await runtimeMessage(baseUrl, restartedSessionId, { action: 'restoreFromTrash', scriptId: trashScriptId }, 60000);
  if (!restoreResult?.success) fail(`restoreFromTrash failed after Firefox restart: ${JSON.stringify(restoreResult)}`);
  const restoredScript = await runtimeMessage(baseUrl, restartedSessionId, { action: 'getScript', id: trashScriptId }, 60000);
  const restoredName = restoredScript?.metadata?.name || restoredScript?.meta?.name || '';
  if (restoredName !== 'Firefox Trash Restart Fixture') {
    fail(`Trash restart fixture restored with wrong metadata: ${JSON.stringify(restoredScript)}`);
  }

  return {
    sessionId: restartedSessionId,
    result: {
      importedCount: bulkImport.imported,
      storageUsageLevel: storageUsage?.level || '',
      storageBytesUsed: storageUsage?.bytesUsed || 0,
      firefoxProfileRestarted: true,
      trashPersistedAfterRestart: true,
      trashRestoredName: restoredName,
    },
  };
}

async function main() {
  const packageJson = await readJsonFile(resolve(ROOT, 'package.json'));
  const firefoxManifest = await readJsonFile(resolve(ROOT, 'manifest-firefox.json'));
  const minimum = parseVersion(firefoxManifest.browser_specific_settings?.gecko?.strict_min_version);
  if (!minimum) fail('manifest-firefox.json has no parseable gecko.strict_min_version');
  minimum.raw = firefoxManifest.browser_specific_settings.gecko.strict_min_version;

  if (!skipPackage) {
    await runCommand(process.execPath, ['scripts/run-bash.mjs', 'build-firefox.sh', '--lint'], 'Building Firefox package');
  }

  const packagePath = await latestFirefoxPackage(packageJson.version);
  const firefox = findFirefox(minimum);
  const geckodriver = findGeckodriver();
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const profileDir = await mkdtemp(join(tmpdir(), 'scriptvault-firefox-profile-'));
  console.log(`Firefox: ${firefox.version.output || firefox.version.raw}`);
  console.log(`Package: ${basename(packagePath)}`);

  const gecko = spawn(geckodriver, ['--port', String(port)], {
    cwd: ROOT,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const geckoOutput = [];
  gecko.stdout.on('data', data => {
    const text = data.toString();
    geckoOutput.push(text);
    if (process.env.SCRIPT_VAULT_FIREFOX_SMOKE_VERBOSE === '1') process.stdout.write(text);
  });
  gecko.stderr.on('data', data => {
    const text = data.toString();
    geckoOutput.push(text);
    if (process.env.SCRIPT_VAULT_FIREFOX_SMOKE_VERBOSE === '1') process.stderr.write(text);
  });

  let sessionId = null;
  try {
    await waitForGeckodriver(baseUrl, gecko);
    sessionId = await webdriverSession(baseUrl, firefox, profileDir);
    if (!sessionId) fail('geckodriver did not return a WebDriver session id');
    const install = await request(baseUrl, 'POST', `/session/${sessionId}/moz/addon/install`, {
      path: packagePath,
      temporary: true,
    }, 60000);
    if (install.value !== EXTENSION_ID) fail(`unexpected installed add-on id: ${install.value}`);

    const dashboard = await getExtensionResource(baseUrl, sessionId, 'pages/dashboard.html');
    const popup = await getExtensionResource(baseUrl, sessionId, 'pages/popup.html');
    const dashboardResult = await dashboardSmoke(baseUrl, sessionId, dashboard.uri);
    const popupResult = await popupSmoke(baseUrl, sessionId, popup.uri);
    const scriptResult = await scriptRoundTripSmoke(baseUrl, sessionId, dashboard.uri);
    const backupResult = await backupRoundTripSmoke(baseUrl, sessionId, dashboard.uri);
    const storageSmoke = await storageAndTrashSmoke(baseUrl, sessionId, dashboard.uri, firefox, packagePath, profileDir);
    sessionId = storageSmoke.sessionId;
    const storageResult = storageSmoke.result;

    console.log('Firefox sideload smoke passed.');
    console.log(JSON.stringify({
      firefox: firefox.version.output || firefox.version.raw,
      package: basename(packagePath),
      dashboard: dashboardResult,
      popup: popupResult,
      script: scriptResult,
      backup: backupResult,
      storage: storageResult,
    }, null, 2));
  } catch (error) {
    const tail = geckoOutput.join('').split(/\r?\n/).filter(Boolean).slice(-25).join('\n');
    if (tail) console.error(`\n[geckodriver tail]\n${tail}`);
    throw error;
  } finally {
    if (sessionId && !keepBrowser) {
      await request(baseUrl, 'DELETE', `/session/${sessionId}`).catch(() => {});
    }
    if (!keepBrowser) gecko.kill();
    if (!keepBrowser) await rm(profileDir, { recursive: true, force: true }).catch(() => {});
  }
}

main().catch(error => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
