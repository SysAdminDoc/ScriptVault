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
