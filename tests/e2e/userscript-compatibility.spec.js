import { expect, test } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  ensureUserScriptsAvailable,
  launchScriptVault,
  openExtensionPage,
  sendRuntimeMessage,
} from './helpers/extension-fixture.js';

const CORPUS_ROOT = resolve(process.cwd(), 'tests/fixtures/userscript-compatibility');
const manifest = JSON.parse(readFileSync(resolve(CORPUS_ROOT, 'manifest.json'), 'utf8'));

async function startLocalTargetServer() {
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end('<!doctype html><html><head><title>ScriptVault compatibility target</title></head><body><main>local target</main></body></html>');
  });
  await new Promise(resolveServer => server.listen(0, '127.0.0.1', resolveServer));
  const { port } = server.address();
  return {
    origin: `http://127.0.0.1:${port}`,
    async close() {
      await new Promise(resolveServer => server.close(resolveServer));
    },
  };
}

function gmRecorderPrelude(apiCalls) {
  if (apiCalls.length === 0) return '';
  const wraps = apiCalls.map(api => {
    const [, method] = api.split('.');
    return `__svWrap(__svGm, ${JSON.stringify(method)}, ${JSON.stringify(api)});`;
  }).join('\n');
  return `
(() => {
  const __svRecord = name => {
    try {
      window.postMessage({ __scriptVaultCompatibility: true, kind: 'gm-api', name }, '*');
    } catch {}
  };
  const __svWrap = (target, key, name) => {
    if (!target || typeof target[key] !== 'function') return;
    const original = target[key];
    if (original.__scriptVaultCompatibilityWrapped) return;
    const wrapped = function (...args) {
      __svRecord(name);
      return original.apply(this, args);
    };
    Object.defineProperty(wrapped, '__scriptVaultCompatibilityWrapped', { value: true });
    target[key] = wrapped;
  };
  const __svGm = typeof GM === 'object' && GM ? GM : null;
  ${wraps}
})();
`;
}

function instrumentSource(source, fixture) {
  const endMarker = '// ==/UserScript==';
  const markerIndex = source.indexOf(endMarker);
  if (markerIndex < 0) throw new Error(`${fixture.id} is missing its userscript metadata terminator`);
  const insertAt = markerIndex + endMarker.length;
  const prelude = gmRecorderPrelude(fixture.expectedApiCalls);
  return `${source.slice(0, insertAt)}${prelude}${source.slice(insertAt)}`;
}

async function fixtureSource(fixture) {
  return readFileSync(resolve(CORPUS_ROOT, fixture.path), 'utf8');
}

async function tabIdForUrl(page, url) {
  return page.evaluate(async targetUrl => {
    const tabs = await chrome.tabs.query({});
    return tabs.find(tab => tab.url === targetUrl)?.id || null;
  }, url);
}

async function installFixture(dashboard, fixture) {
  const source = await fixtureSource(fixture);
  return sendRuntimeMessage(dashboard, {
    action: 'saveScript',
    data: {
      id: `compat_${fixture.id}`,
      code: instrumentSource(source, fixture),
      enabled: true,
    },
  });
}

test('pinned real-world userscripts execute and exercise their GM surface on a local target', async () => {
  test.setTimeout(150_000);
  const server = await startLocalTargetServer();
  const app = await launchScriptVault();
  try {
    const dashboard = await openExtensionPage(app);
    const capability = await ensureUserScriptsAvailable(app, dashboard);
    test.skip(!capability.available, capability.reason);

    for (const fixture of manifest.fixtures) {
      await expect(installFixture(dashboard, fixture)).resolves.toMatchObject({
        success: true,
        scriptId: `compat_${fixture.id}`,
      });
    }
    for (const fixture of manifest.fixtures) {
      const target = await app.context.newPage();
      const targetUrl = `${server.origin}/compat/${fixture.id}/target`;
      try {
        await target.addInitScript(() => {
          window.__scriptVaultCompatibilityLog = [];
          window.addEventListener('message', event => {
            const data = event.data;
            if (!data || data.__scriptVaultCompatibility !== true) return;
            window.__scriptVaultCompatibilityLog.push(data);
          });
        });
        await target.goto(targetUrl, { waitUntil: 'domcontentloaded' });
        await target.waitForFunction(({ marker, expectedApiCalls }) => {
          const markerReady = document.documentElement.getAttribute(marker) === 'ready';
          const records = window.__scriptVaultCompatibilityLog || [];
          return markerReady && expectedApiCalls.every(api => records.some(record => record.name === api));
        }, {
          marker: fixture.readyMarker,
          expectedApiCalls: fixture.expectedApiCalls,
        }, { timeout: 30_000 });

        const recorded = await target.evaluate(() => window.__scriptVaultCompatibilityLog);
        expect(recorded.filter(entry => entry.kind === 'gm-api').map(entry => entry.name))
          .toEqual(expect.arrayContaining(fixture.expectedApiCalls));

        await expect.poll(() => tabIdForUrl(dashboard, targetUrl), { timeout: 10_000 }).toBeTruthy();
        const tabId = await tabIdForUrl(dashboard, targetUrl);
        expect(tabId).toEqual(expect.any(Number));
        await expect.poll(() => sendRuntimeMessage(dashboard, {
          action: 'getExecutionDiagnostics',
          tabId,
        }), { timeout: 20_000 }).toMatchObject({
          journal: {
            latest: {
              scriptId: `compat_${fixture.id}`,
              outcome: 'success',
            },
          },
        });
      } finally {
        await target.close().catch(() => {});
      }
    }

    await dashboard.close().catch(() => {});
  } finally {
    await app.close();
    await server.close();
  }
});
