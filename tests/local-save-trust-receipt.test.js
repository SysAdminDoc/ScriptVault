import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

function read(path) {
  return readFileSync(path, 'utf8');
}

function loadCoalescingHelpers() {
  const core = read('src/background/core.ts');
  const start = core.indexOf('const _localSaveReceiptCoalescing = new Map()');
  const end = core.indexOf('function _getScriptOperationLocks()', start);
  if (start < 0 || end < 0) throw new Error('Local-save coalescing helpers not found');
  return new Function(`${core.slice(start, end)}; return { map: _localSaveReceiptCoalescing, sweep: _sweepExpiredLocalSaveCoalescing };`)();
}

describe('local save trust receipt wiring', () => {
  it('marks dashboard editor saves as local trust receipts', () => {
    const dashboard = read('pages/dashboard.js');

    expect(dashboard).toContain('function buildEditorSaveTrustOptions');
    expect(dashboard).toContain("operation: 'local-save'");
    expect(dashboard).toContain("sourceKind: 'local-editor'");
    expect(dashboard).toContain("sourceLabel: autosave ? 'Dashboard autosave' : 'Dashboard editor'");
    expect(dashboard).toContain('suppressMetadataSourceFallback: true');
    expect(dashboard).toContain('function ensureEditorLocalSaveSessionId');
    expect(dashboard).toContain('trust.coalesceKey = coalesceKey');
    expect(dashboard).toContain('trust.coalesceWindowMs = 30000');
    expect(dashboard).toContain('trust: buildEditorSaveTrustOptions({ autosave: options.autosave === true })');
    expect(dashboard).toContain('saveCurrentScript({ autosave: true })');
  });

  it('threads local receipt source fields through typed and runtime contracts', () => {
    const messages = read('src/types/messages.ts');
    const receipt = read('src/background/trust-receipt.ts');
    const core = read('src/background/core.ts');

    expect(messages).toContain('sourceKind?: ScriptTrustReceipt');
    expect(messages).toContain('sourceLabel?: string');
    expect(messages).toContain('suppressMetadataSourceFallback?: boolean');
    expect(messages).toContain('coalesceKey?: string');
    expect(messages).toContain('coalesceWindowMs?: number');
    expect(messages).toContain('optionalPermissions?:');

    expect(receipt).toContain('suppressMetadataSourceFallback?: boolean');
    expect(receipt).toContain('sourceKind?: ScriptTrustReceipt');
    expect(receipt).toContain('sourceLabel?: string');
    expect(receipt).toContain('shouldSuppressMetadataSourceFallback');

    expect(core).toContain('suppressMetadataSourceFallback = false');
    expect(core).toContain('sourceKind: receiptOptions?.sourceKind ||');
    expect(core).toContain('sourceLabel: receiptOptions?.sourceLabel ||');
    expect(core).toContain('receiptOptions?.suppressMetadataSourceFallback === true');
  });

  it('keeps autosave coalescing ephemeral and outside script records', () => {
    const core = read('src/background/core.ts');
    const scriptTypes = read('src/types/script.ts');

    expect(core).toContain('const _localSaveReceiptCoalescing = new Map()');
    expect(core).toContain('receiptOptions?.coalesceKey');
    expect(core).toContain('versionHistory[coalesceState.rollbackIndex]');
    expect(core).toContain('historyEntry && previousScript && !coalescedHistoryEntry');
    expect(core).toContain('_clearLocalSaveCoalescingForScript(id)');
    expect(core).toContain('_sweepExpiredLocalSaveCoalescing(now)');
    expect(core).toContain('await reregisterScript(script)');

    expect(scriptTypes).not.toContain('coalesceKey');
    expect(scriptTypes).not.toContain('localSaveSessionId');
  });

  it('sweeps expired and malformed coalescing entries while retaining active sessions', () => {
    const { map, sweep } = loadCoalescingHelpers();
    map.set('expired', { scriptId: 'alpha', expiresAt: 999 });
    map.set('boundary', { scriptId: 'bravo', expiresAt: 1000 });
    map.set('active', { scriptId: 'charlie', expiresAt: 1001 });
    map.set('malformed', { scriptId: 'delta', expiresAt: 'not-a-time' });

    sweep(1000);

    expect([...map.keys()]).toEqual(['active']);
  });
});
