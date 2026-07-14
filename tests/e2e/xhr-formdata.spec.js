import { expect, test } from '@playwright/test';
import { createServer } from 'node:http';

import {
  ensureUserScriptsAvailable,
  launchScriptVault,
  openExtensionPage,
  sendRuntimeMessage,
} from './helpers/extension-fixture.js';

function parseContentDisposition(value = '') {
  const result = {};
  for (const part of value.split(';').slice(1)) {
    const [rawKey, ...rawValue] = part.trim().split('=');
    const key = rawKey?.trim();
    if (!key) continue;
    const joined = rawValue.join('=').trim();
    result[key] = joined.replace(/^"|"$/g, '');
  }
  return result;
}

function parseMultipart(body, contentType) {
  const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.[1]
    || contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.[2];
  if (!boundary) throw new Error(`Missing multipart boundary in ${contentType}`);
  return body
    .split(`--${boundary}`)
    .filter(part => part.includes('\r\n\r\n'))
    .map(part => {
      const normalized = part.replace(/^\r\n/, '').replace(/\r\n$/, '');
      const [rawHeaders, ...bodyParts] = normalized.split('\r\n\r\n');
      const headers = Object.fromEntries(rawHeaders.split('\r\n').map(line => {
        const index = line.indexOf(':');
        return [line.slice(0, index).toLowerCase(), line.slice(index + 1).trim()];
      }));
      const disposition = parseContentDisposition(headers['content-disposition'] || '');
      return {
        name: disposition.name || '',
        filename: disposition.filename || '',
        contentType: headers['content-type'] || '',
        value: bodyParts.join('\r\n\r\n'),
      };
    });
}

async function startFormDataServer() {
  let resolveRequest;
  const requestPromise = new Promise(resolve => {
    resolveRequest = resolve;
  });
  const server = createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/upload') {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        const contentType = req.headers['content-type'] || '';
        resolveRequest({
          method: req.method,
          url: req.url,
          contentType,
          parts: parseMultipart(body, contentType),
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      });
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<!doctype html><title>ScriptVault XHR FormData smoke</title><main>ready</main>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    request: requestPromise,
    async close() {
      await new Promise(resolve => server.close(resolve));
    },
  };
}

function formDataUserscript(uploadUrl) {
  return [
    '// ==UserScript==',
    '// @name E2E XHR FormData Flow',
    '// @namespace scriptvault-e2e',
    '// @version 1.0.0',
    '// @match http://127.0.0.1/*',
    '// @connect 127.0.0.1',
    '// @grant GM_xmlhttpRequest',
    '// ==/UserScript==',
    'const fd = new FormData();',
    'fd.append("color", "red");',
    'fd.append("color", "blue");',
    'fd.append("upload", new File(["hello-file"], "note.txt", { type: "text/plain" }));',
    'fd.append("color", "green");',
    'GM_xmlhttpRequest({',
    '  method: "POST",',
    `  url: ${JSON.stringify(uploadUrl)},`,
    '  data: fd,',
    '  onload(response) {',
    '    document.documentElement.setAttribute("data-sv-xhr-status", String(response.status));',
    '  },',
    '  onerror(error) {',
    '    document.documentElement.setAttribute("data-sv-xhr-error", String(error?.error || "error"));',
    '  }',
    '});',
    '',
  ].join('\n');
}

test('GM_xmlhttpRequest preserves duplicate FormData keys and File metadata', async () => {
  const server = await startFormDataServer();
  const app = await launchScriptVault();
  try {
    const dashboard = await openExtensionPage(app);
    const executionCapability = await ensureUserScriptsAvailable(app, dashboard);
    test.skip(!executionCapability.available, executionCapability.reason);

    await expect(sendRuntimeMessage(dashboard, {
      action: 'saveScript',
      data: { code: formDataUserscript(`${server.url}/upload`), enabled: true },
    })).resolves.toMatchObject({ success: true });

    const target = await app.context.newPage();
    await target.goto(`${server.url}/target`, { waitUntil: 'domcontentloaded' });
    await expect(target.locator('html')).toHaveAttribute('data-sv-xhr-status', '200');

    const request = await server.request;
    expect(request.contentType).toContain('multipart/form-data');
    expect(request.parts).toEqual([
      { name: 'color', filename: '', contentType: '', value: 'red' },
      { name: 'color', filename: '', contentType: '', value: 'blue' },
      { name: 'upload', filename: 'note.txt', contentType: 'text/plain', value: 'hello-file' },
      { name: 'color', filename: '', contentType: '', value: 'green' },
    ]);
  } finally {
    await app.close();
    await server.close();
  }
});
