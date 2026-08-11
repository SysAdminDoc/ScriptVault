import { describe, expect, it } from 'vitest';
import {
  classifyExecutionError,
  createExecutionDiagnosticsJournal,
  createExecutionDiagnosticsJournalPersistence,
  createExecutionDiagnosticsStore,
  redactExecutionUrl,
} from '../src/background/execution-diagnostics.ts';

function sender(tabId, documentId, frameId, url = 'https://example.test/') {
  return { tab: { id: tabId, url }, documentId, frameId };
}

describe('per-document execution diagnostics', () => {
  it('keeps replaced-document frame activity separate after same-tab navigation', () => {
    const store = createExecutionDiagnosticsStore();

    store.record(sender(7, 'top-a', 0, 'https://example.test/first'), { type: 'document-ready' });
    store.record(sender(7, 'frame-a', 2, 'https://frame.test/first'), { type: 'document-ready' });
    store.record(sender(7, 'frame-a', 2, 'https://frame.test/first'), {
      type: 'run',
      scriptId: 'script-old',
      duration: 12,
    });

    store.record(sender(7, 'top-b', 0, 'https://example.test/second'), { type: 'document-ready' });
    store.record(sender(7, 'frame-b', 3, 'https://frame.test/second'), { type: 'document-ready' });
    store.record(sender(7, 'frame-b', 3, 'https://frame.test/second'), {
      type: 'run',
      scriptId: 'script-current',
      duration: 8,
    });
    // A delayed error from the replaced frame must remain associated with its
    // original top document instead of being folded into the new navigation.
    store.record(sender(7, 'frame-a', 2, 'https://frame.test/first'), {
      type: 'error',
      scriptId: 'script-old',
      error: 'late failure',
    });

    const snapshot = store.snapshot(7);
    expect(snapshot.currentDocumentId).toBe('top-b');
    expect(snapshot.documents.find(document => document.documentId === 'top-b')).toMatchObject({ isCurrent: true, stale: false });
    expect(snapshot.documents.find(document => document.documentId === 'frame-b')).toMatchObject({ isCurrent: true, topDocumentId: 'top-b' });
    expect(snapshot.documents.find(document => document.documentId === 'top-a')).toMatchObject({ isCurrent: false, stale: true });
    expect(snapshot.documents.find(document => document.documentId === 'frame-a')).toMatchObject({
      isCurrent: false,
      stale: true,
      topDocumentId: 'top-a',
      runs: 1,
      errors: 1,
    });
    expect(snapshot.summary.currentEvents).toBe(3);
    expect(snapshot.summary.staleEvents).toBe(4);
  });

  it('bounds retained events and evicts older document groups before the current top document', () => {
    const store = createExecutionDiagnosticsStore({ maxDocumentsPerTab: 2, maxEventsPerDocument: 2 });
    store.record(sender(4, 'top-a', 0), { type: 'document-ready' });
    store.record(sender(4, 'top-a', 0), { type: 'run', scriptId: 'one', duration: 1 });
    store.record(sender(4, 'top-a', 0), { type: 'run', scriptId: 'two', duration: 2 });
    store.record(sender(4, 'top-b', 0), { type: 'document-ready' });
    store.record(sender(4, 'top-c', 0), { type: 'document-ready' });

    const snapshot = store.snapshot(4);
    expect(snapshot.documents).toHaveLength(2);
    expect(snapshot.documents.some(document => document.documentId === 'top-a')).toBe(false);
    expect(snapshot.documents.find(document => document.documentId === 'top-c')).toMatchObject({ isCurrent: true });
  });

  it('uses a clearly labeled fallback identity when a browser omits documentId', () => {
    const store = createExecutionDiagnosticsStore();
    store.record(sender(9, undefined, 0), { type: 'document-ready' });

    expect(store.snapshot(9)).toMatchObject({
      currentDocumentId: null,
      currentDocumentIdentity: 'legacy-frame:0',
      documents: [{ identity: 'legacy-frame:0', documentId: null, frameId: 0, isCurrent: true }],
    });
  });

  it('drops a tab snapshot when the tab closes', () => {
    const store = createExecutionDiagnosticsStore();
    store.record(sender(3, 'top', 0), { type: 'document-ready' });
    store.clear(3);
    expect(store.snapshot(3).documents).toEqual([]);
  });
});

describe('persistent execution journal', () => {
  it('redacts URL paths and error messages to bounded diagnostic fields', () => {
    const redacted = redactExecutionUrl('https://example.test/private/path?token=secret#source');
    expect(redacted).toEqual({ origin: 'https://example.test', urlHash: expect.stringMatching(/^[0-9a-f]{8}$/) });
    expect(classifyExecutionError('TypeError: userscript source should never be persisted')).toBe('TypeError');

    const journal = createExecutionDiagnosticsJournal({ now: () => 10_000 });
    const entry = journal.record(sender(12, 'document', 0), {
      type: 'error',
      timestamp: 10_000,
      scriptId: 'script-1',
      url: 'https://example.test/private/path?token=secret',
      error: 'TypeError: userscript source should never be persisted',
    });

    expect(entry).toMatchObject({
      origin: 'https://example.test',
      outcome: 'failure',
      errorClass: 'TypeError',
    });
    expect(JSON.stringify(entry)).not.toContain('secret');
    expect(JSON.stringify(entry)).not.toContain('userscript source');
  });

  it('evicts by per-tab count, total count, age, and serialized bytes deterministically', () => {
    let now = 1_000;
    const journal = createExecutionDiagnosticsJournal({
      maxEntries: 3,
      maxEntriesPerTab: 2,
      maxAgeMs: 200,
      maxSerializedBytes: 8_192,
      staleAfterMs: 50,
      now: () => now,
    });
    const add = (tabId, timestamp, scriptId) => journal.record(sender(tabId, `doc-${timestamp}`, 0), {
      type: 'run', timestamp, scriptId, url: 'https://example.test/path', duration: 1,
    });

    add(1, 800, 'old');
    add(1, 900, 'one');
    add(1, 950, 'two');
    expect(journal.snapshot(1).entries.map(entry => entry.scriptId)).toEqual(['two', 'one']);
    add(2, 960, 'three');
    add(2, 970, 'four');

    const tabOne = journal.snapshot(1);
    expect(tabOne.entries.map(entry => entry.scriptId)).toEqual(['two']);
    expect(tabOne.latestStale).toBe(true);
    expect(journal.toStorage().entries.length).toBeLessThanOrEqual(3);
    expect(JSON.stringify(journal.toStorage()).length).toBeGreaterThan(0);

    const byteBound = createExecutionDiagnosticsJournal({ maxSerializedBytes: 512, now: () => 1_000 });
    for (let index = 0; index < 8; index += 1) {
      byteBound.record(sender(9, `doc-${index}`, 0), {
        type: 'run', timestamp: 1_000 + index, scriptId: `long-script-${index}-${'x'.repeat(80)}`,
        url: 'https://example.test/path', duration: 1,
      });
    }
    expect(byteBound.snapshot(9).count).toBeLessThan(8);
    expect(byteBound.snapshot(9).latest?.scriptId).toContain('long-script-7');
    expect(new TextEncoder().encode(JSON.stringify(byteBound.toStorage())).byteLength).toBeLessThanOrEqual(512);

    now = 1_200;
    expect(journal.snapshot(1)).toMatchObject({ entries: [], latest: null, count: 0, latestAgeMs: null, latestStale: false });
  });

  it('rehydrates after a worker restart and retries quota failures without losing the in-memory record', async () => {
    const backing = {};
    let failWrites = true;
    const storage = {
      async get(key) {
        return { [key]: backing[key] };
      },
      async set(items) {
        if (failWrites) throw new Error('QUOTA_BYTES');
        backing.svExecutionJournal = structuredClone(items.svExecutionJournal);
      },
    };
    const first = createExecutionDiagnosticsJournal({ now: () => 5_000 });
    const firstPersistence = createExecutionDiagnosticsJournalPersistence(first, storage);
    first.record(sender(4, 'doc', 0), {
      type: 'run', timestamp: 5_000, scriptId: 'survives-restart',
      url: 'https://example.test/path?secret=value', duration: 4,
    });
    await firstPersistence.schedule();
    expect(backing.svExecutionJournal).toBeUndefined();
    expect(firstPersistence.getStatus().lastError).toBe('QUOTA_BYTES');

    failWrites = false;
    await firstPersistence.schedule();
    expect(backing.svExecutionJournal.entries).toHaveLength(1);

    const restarted = createExecutionDiagnosticsJournal({ now: () => 5_100 });
    const restartedPersistence = createExecutionDiagnosticsJournalPersistence(restarted, storage);
    await expect(restartedPersistence.hydrate()).resolves.toMatchObject({ loaded: 1, error: null });
    const snapshot = restarted.snapshot(4);
    expect(snapshot.latest).toMatchObject({ scriptId: 'survives-restart', outcome: 'success' });
    expect(snapshot.latestAgeMs).toBe(100);
    expect(JSON.stringify(snapshot)).not.toContain('secret');
  });
});
