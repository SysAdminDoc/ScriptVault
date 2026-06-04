import { expect, test } from '@playwright/test';
import { createServer } from 'node:http';
import { launchScriptVault, openExtensionPage, sendRuntimeMessage, userscript } from './helpers/extension-fixture.js';

async function startWebDavServer() {
  let remoteData = null;
  const requests = [];
  const server = createServer((req, res) => {
    requests.push({ method: req.method, url: req.url, authorization: req.headers.authorization || '' });
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      if (req.method === 'PROPFIND') {
        res.writeHead(207, { 'Content-Type': 'text/xml' });
        res.end('<multistatus />');
        return;
      }
      if (req.url !== '/scriptvault-backup.json') {
        res.writeHead(404);
        res.end();
        return;
      }
      if (req.method === 'GET') {
        if (!remoteData) {
          res.writeHead(404);
          res.end();
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(remoteData));
        return;
      }
      if (req.method === 'PUT') {
        remoteData = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }
      res.writeHead(405);
      res.end();
    });
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    get remoteData() {
      return remoteData;
    },
    async close() {
      await new Promise(resolve => server.close(resolve));
    },
  };
}

test('WebDAV sync preview and upload run against a real HTTP endpoint', async () => {
  const server = await startWebDavServer();
  const app = await launchScriptVault();
  try {
    const page = await openExtensionPage(app);
    const saved = await sendRuntimeMessage(page, {
      action: 'saveScript',
      data: {
        code: userscript({ name: 'E2E Sync Flow', version: '1.0.0' }),
        enabled: false,
      },
    });
    expect(saved.success).toBe(true);

    await expect(sendRuntimeMessage(page, {
      action: 'setSettings',
      data: {
        settings: {
          syncEnabled: true,
          syncProvider: 'webdav',
          webdavUrl: server.url,
          webdavUsername: 'e2e',
          webdavPassword: 'secret',
        },
      },
    })).resolves.toMatchObject({
      syncEnabled: true,
      syncProvider: 'webdav',
      webdavUrl: server.url,
    });

    const preview = await sendRuntimeMessage(page, {
      action: 'syncDryRunPreview',
      data: { provider: 'webdav' },
    });
    expect(preview).toMatchObject({
      success: true,
      dryRun: true,
      noWrites: true,
      provider: 'webdav',
      remoteFound: false,
      summary: {
        localScripts: 1,
        remoteScripts: 0,
        wouldUpload: true,
        wouldDownload: false,
      },
    });
    expect(server.remoteData).toBeNull();

    const sync = await sendRuntimeMessage(page, { action: 'syncNow' });
    expect(sync).toMatchObject({ success: true });
    expect(server.remoteData.scripts).toHaveLength(1);
    expect(server.remoteData.scripts[0]).toMatchObject({
      id: saved.scriptId,
      code: expect.stringContaining('E2E Sync Flow'),
    });
    expect(server.requests.some(request => request.method === 'PUT')).toBe(true);
  } finally {
    await app.close();
    await server.close();
  }
});
