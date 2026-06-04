import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const adapterCode = readFileSync(resolve(process.cwd(), 'pages/monaco-adapter.js'), 'utf8');
const sandboxCode = readFileSync(resolve(process.cwd(), 'pages/editor-sandbox.html'), 'utf8');
const buildFirefox = readFileSync(resolve(process.cwd(), 'build-firefox.sh'), 'utf8');

function installAdapter() {
  document.body.innerHTML = `
    <iframe id="monacoFrame" src="editor-sandbox.html"></iframe>
    <textarea id="editorTextarea" style="display:none"></textarea>
  `;
  globalThis.CodeMirror = {
    fromTextArea: vi.fn(() => ({ original: true })),
  };
  window.CodeMirror = globalThis.CodeMirror;
  vm.runInNewContext(adapterCode, {
    CodeMirror: globalThis.CodeMirror,
    console,
    document,
    setTimeout,
    window,
  });
  return {
    frame: document.getElementById('monacoFrame'),
    textarea: document.getElementById('editorTextarea'),
    editor: globalThis.CodeMirror.fromTextArea(document.getElementById('editorTextarea'), {
      lineWrapping: true,
    }),
  };
}

function dispatchFrameMessage(frame, data) {
  const event = new MessageEvent('message', { data });
  Object.defineProperty(event, 'source', { value: frame.contentWindow });
  window.dispatchEvent(event);
}

describe('Firefox Monaco fallback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    delete globalThis.CodeMirror;
    delete window.CodeMirror;
    delete window._monacoEditorAdapter;
    document.body.innerHTML = '';
  });

  it('sandbox reports missing Monaco bundles to the parent adapter', () => {
    expect(sandboxCode).toContain("parent.postMessage({ type: 'monaco-load-error', reason: 'missing-bundle' }, '*')");
  });

  it('Firefox package still omits the Monaco bundle for AMO lint', () => {
    expect(buildFirefox).not.toContain('lib/monaco');
    expect(buildFirefox).toContain('pages');
  });

  it('activates an editable textarea fallback when Monaco cannot load', () => {
    const { frame, textarea, editor } = installAdapter();
    const onChange = vi.fn();

    editor.on('change', onChange);
    editor.setValue('initial code');
    dispatchFrameMessage(frame, { type: 'monaco-load-error', reason: 'missing-bundle' });

    expect(frame.style.display).toBe('none');
    expect(textarea.style.display).toBe('');
    expect(textarea.dataset.editorFallback).toBe('missing-bundle');
    expect(textarea.value).toBe('initial code');
    expect(editor.isMonaco).toBe(false);

    textarea.value = 'edited code';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    expect(editor.getValue()).toBe('edited code');
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
