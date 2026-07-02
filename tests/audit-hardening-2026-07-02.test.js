import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8');

describe('3-way sync merge on jsdiff v7 (2026-07-02 regression)', () => {
  it('offscreen merge uses structuredPatch + applyPatch, not the removed Diff.merge', () => {
    const src = read('offscreen.js');
    expect(src).toContain('Diff.structuredPatch(');
    expect(src).toContain('Diff.applyPatch(local, patch)');
    // The removed 3-way call form must be gone (a doc comment may mention the API).
    expect(src).not.toContain('Diff.merge(local');
  });
  it('analyzer inline merge and its getDiff guard no longer require Diff.merge', () => {
    const src = read('src/bg/analyzer.ts');
    expect(src).toContain('diff.structuredPatch(');
    expect(src).toContain('typeof diff.structuredPatch !== \'function\'');
    expect(src).not.toContain('diff.merge(local');
    expect(src).not.toContain("typeof diff.merge !== 'function'");
  });
  it('generated analyzer runtime is regenerated (no Diff.merge)', () => {
    const src = read('bg/analyzer.js');
    expect(src).not.toContain('.merge(local, remote, base)');
  });
});

describe('Backup storage-full warning (2026-07-02 regression)', () => {
  it('estimates size from the recorded byte size, not the stripped data field', () => {
    const src = read('src/modules/backup-scheduler.ts');
    const fn = src.slice(src.indexOf('function _estimateBackupSize'), src.indexOf('function _estimateBackupSize') + 700);
    expect(fn).toContain('b.size');
  });
});

describe('Dependency graph idle-render (2026-07-02 regression)', () => {
  const src = read('pages/dashboard-depgraph.js');
  it('only renders when animating or when an interaction marks the view dirty', () => {
    expect(src).toContain('_state.needsRender');
    expect(src).toContain('if (shouldRender) render();');
    // The unconditional per-frame render() is gone from the loop.
    const loop = src.slice(src.indexOf('function animationLoop'), src.indexOf('function animationLoop') + 600);
    expect(loop).not.toMatch(/\n\s*render\(\);\n\s*_state\.animFrameId/);
  });
});

describe('Debugger live-reload path (2026-07-02 regression)', () => {
  const src = read('pages/dashboard-debugger.js');
  it('removes the dead type:ScriptDebugger reloadTabs message (no router handler)', () => {
    expect(src).not.toContain("type: 'ScriptDebugger'");
    expect(src).not.toContain("notifyBackground('reloadTabs'");
  });
  it('swallows setLiveReload sendMessage rejections', () => {
    expect(src).toContain("action: 'setLiveReload', scriptId: id, enabled: _liveReload[id] }).catch(() => {})");
  });
});
