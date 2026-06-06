import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

function read(path) {
  return readFileSync(path, 'utf8');
}

describe('local save trust receipt wiring', () => {
  it('marks dashboard editor saves as local trust receipts', () => {
    const dashboard = read('pages/dashboard.js');

    expect(dashboard).toContain('function buildEditorSaveTrustOptions');
    expect(dashboard).toContain("operation: 'local-save'");
    expect(dashboard).toContain("sourceKind: 'local-editor'");
    expect(dashboard).toContain("sourceLabel: autosave ? 'Dashboard autosave' : 'Dashboard editor'");
    expect(dashboard).toContain('suppressMetadataSourceFallback: true');
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
});
