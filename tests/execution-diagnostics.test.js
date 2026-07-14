import { describe, expect, it } from 'vitest';
import { createExecutionDiagnosticsStore } from '../src/background/execution-diagnostics.ts';

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
