import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const source = readFileSync('pages/dashboard-debugger.js', 'utf8');
const createDebugger = new Function(`${source}\nreturn ScriptDebugger;`);
let activeDebugger = null;

afterEach(() => {
  activeDebugger?.destroy();
  activeDebugger = null;
  document.body.replaceChildren();
});

describe('dashboard debugger mapped locations', () => {
  it('shows mapped source coordinates and only jumps to editable userscript sources', () => {
    const onJumpToLine = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    activeDebugger = createDebugger();
    activeDebugger.init(container, { onJumpToLine });
    activeDebugger.recordError('script-1', {
      message: 'user boom',
      source: 'scriptvault://userscript/script-1/My%20Script.user.js',
      line: 17,
      column: 9,
      generatedLine: 917,
      generatedColumn: 9,
    });
    activeDebugger.recordError('script-1', {
      message: 'require boom',
      source: 'https://cdn.example.com/library.js',
      line: 3,
      column: 2,
    });

    [...container.querySelectorAll('.dbg-tab')].find(tab => tab.textContent.startsWith('Errors')).click();
    const links = [...container.querySelectorAll('.dbg-error-line-link')];
    const userLink = links.find(link => link.textContent === 'My Script:17:9');
    const requireLink = links.find(link => link.textContent === 'library.js:3:2');

    expect(userLink).toMatchObject({ title: 'scriptvault://userscript/script-1/My%20Script.user.js', tabIndex: 0 });
    expect(userLink.getAttribute('role')).toBe('button');
    userLink.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onJumpToLine).toHaveBeenCalledWith(
      'script-1',
      17,
      9,
      'scriptvault://userscript/script-1/My%20Script.user.js',
    );

    requireLink.click();
    expect(requireLink.getAttribute('role')).toBeNull();
    expect(onJumpToLine).toHaveBeenCalledTimes(1);
  });
});

// Every script-facing surface in the debugger rendered the raw internal id
// (`script_` + crypto.randomUUID()), so users chose between
// `script_3f6a1c2e-…` entries and screen-reader users heard a UUID. The module
// only ever receives ids, so the dashboard supplies a resolver.
describe('the debugger identifies scripts by name', () => {
  const NAMES = {
    'script_3f6a1c2e-aaaa-bbbb-cccc-ddddeeeeffff': 'Reddit Enhancement',
    'script_9b1c2d3e-1111-2222-3333-444455556666': 'YouTube Cleaner',
  };
  const IDS = Object.keys(NAMES);

  function mount({ getScriptName } = {}) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    activeDebugger = createDebugger();
    activeDebugger.init(container, {
      onJumpToLine: vi.fn(),
      ...(getScriptName === undefined ? { getScriptName: (id) => NAMES[id] } : { getScriptName }),
    });
    return container;
  }

  function openTab(container, prefix) {
    const tab = [...container.querySelectorAll('.dbg-tab')].find((t) => t.textContent.startsWith(prefix));
    tab?.click();
    return tab;
  }

  it('shows names in the console script selector, keeping the id as the value', () => {
    const container = mount();
    for (const id of IDS) activeDebugger.recordError(id, { message: 'boom', line: 1, column: 1 });
    openTab(container, 'Console');

    const options = [...container.querySelectorAll('.dbg-select option')].filter((o) => o.value);
    expect(options.map((o) => o.textContent)).toEqual(['Reddit Enhancement', 'YouTube Cleaner']);
    // The id stays the value so selection still works, and is discoverable.
    expect(options.map((o) => o.value)).toEqual(IDS);
    expect(options.map((o) => o.title)).toEqual(IDS);
  });

  it('shows names in the live-reload rows and their toggle accessible names', () => {
    const container = mount();
    for (const id of IDS) activeDebugger.recordError(id, { message: 'boom', line: 1, column: 1 });
    openTab(container, 'Live');

    const labels = [...container.querySelectorAll('.dbg-live-name')].map((n) => n.textContent);
    expect(labels).toEqual(expect.arrayContaining(['Reddit Enhancement', 'YouTube Cleaner']));

    const toggles = [...container.querySelectorAll('.dbg-toggle')];
    expect(toggles.length).toBeGreaterThan(0);
    const ariaLabels = toggles.map((t) => t.getAttribute('aria-label'));
    // A screen reader must not have to read out a UUID.
    expect(ariaLabels.join(' ')).toContain('Reddit Enhancement');
    for (const label of ariaLabels) {
      expect(label).not.toMatch(/script_[0-9a-f]{8}-/);
    }
  });

  it('falls back to the id when no resolver was supplied', () => {
    const container = mount({ getScriptName: null });
    activeDebugger.recordError(IDS[0], { message: 'boom', line: 1, column: 1 });
    openTab(container, 'Console');

    const option = [...container.querySelectorAll('.dbg-select option')].find((o) => o.value);
    expect(option.textContent).toBe(IDS[0]);
  });

  it('falls back to the id for a script that no longer exists', () => {
    const container = mount({ getScriptName: () => '' });
    activeDebugger.recordError(IDS[0], { message: 'boom', line: 1, column: 1 });
    openTab(container, 'Console');

    // A log from a deleted script must still be identifiable.
    const option = [...container.querySelectorAll('.dbg-select option')].find((o) => o.value);
    expect(option.textContent).toBe(IDS[0]);
  });

  it('survives a resolver that throws', () => {
    const container = mount({ getScriptName: () => { throw new Error('state not ready'); } });
    activeDebugger.recordError(IDS[0], { message: 'boom', line: 1, column: 1 });
    expect(() => openTab(container, 'Console')).not.toThrow();
    const option = [...container.querySelectorAll('.dbg-select option')].find((o) => o.value);
    expect(option.textContent).toBe(IDS[0]);
  });
});

describe('the dashboard supplies the debugger name resolver', () => {
  const dashboard = readFileSync('pages/dashboard.js', 'utf8');

  it('passes getScriptName built from the scripts it already holds', () => {
    const call = dashboard.slice(
      dashboard.indexOf('ScriptDebugger.init(container, {'),
      dashboard.indexOf('ScriptDebugger.init(container, {') + 600,
    );
    expect(call).toContain('getScriptName:');
    expect(call).toContain('state.scripts?.find(s => s.id === scriptId)');
    expect(call).toContain('script?.metadata?.name');
  });
});
