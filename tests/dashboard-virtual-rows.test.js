import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function loadVirtualRows() {
  const sandbox = {
    window,
    document,
    globalThis: window,
    module: { exports: {} },
  };
  vm.runInNewContext(readFileSync('pages/dashboard-virtual-rows.js', 'utf8'), sandbox);
  return sandbox.module.exports;
}

describe('dashboard virtual rows', () => {
  it('computes a bounded visible window with spacer heights', () => {
    const api = loadVirtualRows();
    const win = api.computeWindow({
      total: 10000,
      rowHeight: 40,
      viewportHeight: 800,
      scrollTop: 4000,
      overscan: 10,
      maxRows: 50,
    });

    expect(win.start).toBe(90);
    expect(win.end).toBe(130);
    expect(win.count).toBe(40);
    expect(win.beforeHeight).toBe(3600);
    expect(win.afterHeight).toBe((10000 - 130) * 40);
  });

  it('renders only the visible row slice with before and after spacers', () => {
    const api = loadVirtualRows();
    const table = document.createElement('table');
    const tbody = document.createElement('tbody');
    table.appendChild(tbody);
    document.body.appendChild(table);
    const scripts = Array.from({ length: 1000 }, (_, index) => ({ id: `script_${index}` }));
    const state = api.computeWindow({
      total: scripts.length,
      rowHeight: 20,
      viewportHeight: 100,
      scrollTop: 200,
      overscan: 2,
      maxRows: 10,
    });

    api.renderWindow({
      tbody,
      scripts,
      windowState: state,
      columnCount: 13,
      createRow: (script, index) => {
        const tr = document.createElement('tr');
        tr.dataset.scriptId = script.id;
        tr.dataset.index = String(index);
        tr.appendChild(document.createElement('td'));
        return tr;
      },
    });

    const rows = [...tbody.querySelectorAll('tr[data-script-id]')];
    expect(tbody.dataset.virtualized).toBe('true');
    expect(tbody.querySelector('.virtual-row-spacer.before td').style.height).toBe(`${state.beforeHeight}px`);
    expect(rows).toHaveLength(state.count);
    expect(rows[0].dataset.scriptId).toBe(`script_${state.start}`);
    expect(rows.at(-1).dataset.scriptId).toBe(`script_${state.end - 1}`);
    expect(tbody.querySelector('.virtual-row-spacer.after td').style.height).toBe(`${state.afterHeight}px`);
  });
});
