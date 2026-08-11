import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileFunction } from 'node:vm';
import { vi } from 'vitest';

import { ScriptSubscriptions as SourceScriptSubscriptions } from '../src/modules/subscriptions.ts';

function loadRuntimeSubscriptions() {
  const modulePath = resolve(__dirname, '../modules/subscriptions.js');
  const code = readFileSync(modulePath, 'utf8');
  return compileFunction(`${code}\nreturn ScriptSubscriptions;`, ['chrome'], { filename: modulePath })(globalThis.chrome);
}

const implementations = [
  { label: 'source', api: SourceScriptSubscriptions },
  { label: 'runtime', api: loadRuntimeSubscriptions() },
];

beforeEach(() => {
  globalThis.__resetStorageMock?.();
});

describe.each(implementations)('script subscriptions ($label)', ({ api: ScriptSubscriptions }) => {
  it('parses HTTPS UserSubscribe bundles and constrains member connect scope', () => {
    const bundle = ScriptSubscriptions.parseUserSubscribe(`// ==UserSubscribe==\n// @name Curated Pack\n// @connect api.example.com\n// @connect cdn.example.com\n// @scriptUrl https://cdn.example.com/one.user.js\n// ==/UserSubscribe==`, 'https://feeds.example.com/pack.user.sub.js');
    expect(bundle.name).toBe('Curated Pack');
    expect(bundle.scripts).toEqual([{ url: 'https://cdn.example.com/one.user.js' }]);
    expect(ScriptSubscriptions.constrainConnectPatterns(['api.example.com', 'other.example.com'], bundle.connect)).toEqual(['api.example.com']);
    expect(ScriptSubscriptions.constrainConnectPatterns(['*'], ['api.example.com'])).toEqual(['api.example.com']);
  });

  it('rejects non-HTTPS UserSubscribe members', () => {
    expect(() => ScriptSubscriptions.parseUserSubscribe('// ==UserSubscribe==\n// @scriptUrl http://cdn.example.com/a.user.js\n// ==/UserSubscribe==', 'https://feeds.example.com/pack.user.sub.js')).toThrow(/https/);
  });

  it('parses array and object feed entries with relative URLs', () => {
    const feed = ScriptSubscriptions.parseFeed(JSON.stringify({
      name: 'Curated Pack',
      scripts: [
        '/one.user.js',
        {
          name: 'Two',
          namespace: 'tests',
          version: '2.0.0',
          downloadURL: 'https://cdn.example.com/two.user.js',
        },
        {
          url: 'https://cdn.example.com/two.user.js',
        },
      ],
    }), 'https://feeds.example.com/list/scripts.json');

    expect(feed.name).toBe('Curated Pack');
    expect(feed.sourceUrl).toBe('https://feeds.example.com/list/scripts.json');
    expect(feed.scripts).toEqual([
      { url: 'https://feeds.example.com/one.user.js' },
      {
        url: 'https://cdn.example.com/two.user.js',
        name: 'Two',
        namespace: 'tests',
        version: '2.0.0',
      },
    ]);
  });

  it('rejects non-http subscription URLs', () => {
    expect(() => ScriptSubscriptions.parseFeed('[]', 'file:///tmp/feed.json')).toThrow(/http or https/);
    expect(() => ScriptSubscriptions.normalizeFeedUrl('javascript:alert(1)')).toThrow(/http or https/);
  });

  it('upserts, refresh-marks, lists, and removes stored subscriptions', async () => {
    const feed = ScriptSubscriptions.parseFeed(JSON.stringify([
      'https://cdn.example.com/one.user.js',
    ]), 'https://feeds.example.com/list.json');

    const created = await ScriptSubscriptions.upsertFromFeed(feed.sourceUrl, feed, { name: 'Pinned List' });
    expect(created.name).toBe('Pinned List');
    expect(created.scripts).toHaveLength(1);

    const updated = await ScriptSubscriptions.markRefreshResult(created.id, {
      queued: 2,
      skipped: 1,
      errors: ['bad.user.js: parse failed'],
    });
    expect(updated.lastQueued).toBe(2);
    expect(updated.lastSkipped).toBe(1);
    expect(updated.lastErrors).toEqual(['bad.user.js: parse failed']);

    const list = await ScriptSubscriptions.list();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(created.id);

    expect(await ScriptSubscriptions.remove(created.id)).toBe(true);
    expect(await ScriptSubscriptions.list()).toEqual([]);
  });

  it('persists feed validators and source age, and refuses unsafe validator values', async () => {
    const feed = ScriptSubscriptions.parseFeed(JSON.stringify([
      'https://cdn.example.com/one.user.js',
    ]), 'https://feeds.example.com/list.json');

    const created = await ScriptSubscriptions.upsertFromFeed(feed.sourceUrl, feed, {
      validators: { etag: 'W/"feed-1"', lastModified: 'Wed, 21 Oct 2026 07:28:00 GMT' },
    });
    expect(created.httpEtag).toBe('W/"feed-1"');
    expect(created.httpLastModified).toBe('Wed, 21 Oct 2026 07:28:00 GMT');
    expect(typeof created.sourceFetchedAt).toBe('number');

    // A read that carried no validators must not wipe the working pair.
    const reread = await ScriptSubscriptions.upsertFromFeed(feed.sourceUrl, feed, {});
    expect(reread.httpEtag).toBe('W/"feed-1"');

    // A header-splitting value never reaches storage.
    const hostile = await ScriptSubscriptions.upsertFromFeed(feed.sourceUrl, feed, {
      validators: { etag: 'W/"x"\r\nX-Injected: 1', lastModified: 'y'.repeat(600) },
    });
    expect(hostile.httpEtag).toBe('');
    expect(hostile.httpLastModified).toBe('');
  });

  it('keeps source age counting from the last real download when a feed answers 304', async () => {
    const feed = ScriptSubscriptions.parseFeed(JSON.stringify([
      'https://cdn.example.com/one.user.js',
    ]), 'https://feeds.example.com/list.json');
    const created = await ScriptSubscriptions.upsertFromFeed(feed.sourceUrl, feed, {});
    const downloadedAt = created.sourceFetchedAt;

    const notModified = await ScriptSubscriptions.markRefreshResult(created.id, { notModified: true });
    expect(notModified.sourceFetchedAt).toBe(downloadedAt);
    expect(notModified.lastCheckedAt).toBeGreaterThanOrEqual(downloadedAt);

    const downloaded = await ScriptSubscriptions.markRefreshResult(created.id, { queued: 1 });
    expect(downloaded.sourceFetchedAt).toBeGreaterThanOrEqual(downloadedAt);
  });

  it('serializes overlapping feed, bundle, refresh, and remove mutations', async () => {
    const seed = {
      id: 'seed',
      url: 'https://feeds.example.com/seed.json',
      name: 'Seed',
      kind: 'feed',
      description: '',
      version: '',
      connect: [],
      enabled: true,
      scripts: [{ url: 'https://cdn.example.com/seed.user.js' }],
      createdAt: 1,
      updatedAt: 1,
      lastCheckedAt: 1,
      lastQueued: 0,
      lastSkipped: 0,
      lastErrors: [],
      httpEtag: 'seed-etag',
      httpLastModified: '',
      sourceFetchedAt: 1,
    };
    const removable = { ...seed, id: 'remove-me', url: 'https://feeds.example.com/remove.json', name: 'Remove me' };
    let storedSubscriptions = [seed, removable];
    const originalGet = chrome.storage.local.get;
    const originalSet = chrome.storage.local.set;
    const delay = () => new Promise(resolve => setTimeout(resolve, 2));
    const clone = value => JSON.parse(JSON.stringify(value));
    chrome.storage.local.get = vi.fn(async () => {
      await delay();
      return { scriptSubscriptions: clone(storedSubscriptions) };
    });
    chrome.storage.local.set = vi.fn(async ({ scriptSubscriptions }) => {
      await delay();
      storedSubscriptions = clone(scriptSubscriptions);
    });

    const feed = {
      name: 'Feed addition',
      sourceUrl: 'https://feeds.example.com/feed.json',
      scripts: [{ url: 'https://cdn.example.com/feed.user.js' }],
      parsedAt: Date.now(),
    };
    const bundle = {
      name: 'Bundle addition',
      description: '',
      version: '1.0.0',
      author: '',
      connect: ['cdn.example.com'],
      sourceUrl: 'https://feeds.example.com/bundle.user.sub.js',
      scripts: [{ url: 'https://cdn.example.com/bundle.user.js' }],
      metaBlock: '',
      code: '',
      parsedAt: Date.now(),
    };

    try {
      const results = await Promise.all([
        ScriptSubscriptions.upsertFromFeed(feed.sourceUrl, feed),
        ScriptSubscriptions.upsertBundle(bundle),
        ScriptSubscriptions.markRefreshResult('seed', {
          queued: 7,
          skipped: 2,
          errors: ['feed returned a malformed member'],
        }),
        ScriptSubscriptions.remove('remove-me'),
      ]);

      const list = await ScriptSubscriptions.list();
      expect(list.map(item => item.url)).toEqual(expect.arrayContaining([
        seed.url,
        feed.sourceUrl,
        bundle.sourceUrl,
      ]));
      expect(list).toHaveLength(3);
      expect(list.find(item => item.id === 'remove-me')).toBeUndefined();
      expect(list.find(item => item.id === 'seed')).toMatchObject({
        lastQueued: 7,
        lastSkipped: 2,
        lastErrors: ['feed returned a malformed member'],
        httpEtag: 'seed-etag',
      });
      expect(results[2]).toMatchObject({ lastQueued: 7, lastSkipped: 2 });
      expect(results[3]).toBe(true);
      expect(storedSubscriptions.map(item => item.url)).toEqual(expect.arrayContaining([
        seed.url,
        feed.sourceUrl,
        bundle.sourceUrl,
      ]));
      expect(chrome.storage.local.set).toHaveBeenCalledTimes(4);
    } finally {
      chrome.storage.local.get = originalGet;
      chrome.storage.local.set = originalSet;
    }
  });
});
