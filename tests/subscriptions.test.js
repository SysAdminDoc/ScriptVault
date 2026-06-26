import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileFunction } from 'node:vm';

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
});
