import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const sandboxHtml = readFileSync(resolve(process.cwd(), 'pages/editor-sandbox.html'), 'utf8');

function sandboxScript() {
  const match = sandboxHtml.match(/<script>([\s\S]*)<\/script>/);
  if (!match) throw new Error('editor sandbox script block missing');
  return match[1].replace(
    'const module = await import(LOCAL_ESM_ENTRY);',
    'window.__requestedModule = LOCAL_ESM_ENTRY; const module = await window.__importModule(LOCAL_ESM_ENTRY);',
  );
}

function createFakeMonaco() {
  const editorInstance = {
    addCommand: vi.fn(),
    onDidChangeModelContent: vi.fn(),
    onDidChangeCursorPosition: vi.fn(),
    getContribution: vi.fn(() => ({
      getState: () => ({
        onFindReplaceStateChange: vi.fn(),
      }),
    })),
    getValue: vi.fn(() => ''),
    setValue: vi.fn(),
    getPosition: vi.fn(() => null),
    setPosition: vi.fn(),
    focus: vi.fn(),
    updateOptions: vi.fn(),
    getOption: vi.fn(() => 'off'),
    getAction: vi.fn(() => ({ run: vi.fn() })),
  };

  return {
    editorInstance,
    monaco: {
      KeyMod: { CtrlCmd: 1, Shift: 2 },
      KeyCode: { KeyS: 1, Escape: 2, Slash: 3, F8: 4 },
      languages: {
        CompletionItemKind: { Keyword: 1, Value: 2 },
        registerCompletionItemProvider: vi.fn(),
      },
      editor: {
        EditorOption: { wordWrap: 'wordWrap' },
        create: vi.fn(() => editorInstance),
        defineTheme: vi.fn(),
        setTheme: vi.fn(),
      },
    },
  };
}

function createHarness({ moduleFails = false, stylesheetFails = false } = {}) {
  const messages = [];
  const appendedLinks = [];
  const loading = { style: {}, innerHTML: '' };
  const container = {};
  const { monaco, editorInstance } = createFakeMonaco();
  const windowObject = {};
  const document = {
    head: {
      appendChild(element) {
        if (element.rel === 'stylesheet') {
          appendedLinks.push(element.href);
          queueMicrotask(() => {
            if (stylesheetFails) element.onerror?.(new Error('missing css'));
            else element.onload?.();
          });
        }
      },
    },
    createElement(tagName) {
      return { tagName, style: {} };
    },
    getElementById(id) {
      if (id === 'loading') return loading;
      if (id === 'container') return container;
      return null;
    },
  };

  const context = {
    console,
    document,
    Error,
    Event,
    Promise,
    queueMicrotask,
    location: { origin: 'https://scriptvault.local' },
    parent: {
      postMessage(message) {
        messages.push(message);
      },
    },
    window: windowObject,
  };
  windowObject.__importModule = vi.fn(async (specifier) => {
    if (moduleFails) throw new Error(`missing module: ${specifier}`);
    return { monaco, default: monaco };
  });
  windowObject.addEventListener = vi.fn();
  windowObject.ScriptVaultMonacoEsm = { monaco };

  return { context, appendedLinks, editorInstance, loading, messages, monaco, windowObject };
}

async function runSandbox(context) {
  vm.runInNewContext(sandboxScript(), context);
  for (let i = 0; i < 6; i += 1) await Promise.resolve();
}

describe('Monaco ESM sandbox loader', () => {
  it('loads the packaged ESM bundle and posts ready', async () => {
    const harness = createHarness();

    await runSandbox(harness.context);

    expect(harness.appendedLinks).toEqual(['../lib/monaco-esm/editor.css']);
    expect(harness.windowObject.__requestedModule).toBe('../lib/monaco-esm/editor.js');
    expect(harness.windowObject.__importModule).toHaveBeenCalledWith('../lib/monaco-esm/editor.js');
    expect(harness.monaco.editor.create).toHaveBeenCalledWith(harness.context.document.getElementById('container'), expect.objectContaining({
      language: 'javascript',
      theme: 'vs-dark',
    }));
    expect(harness.messages).toContainEqual({ type: 'ready' });
  });

  it('posts the existing fallback message when the ESM bundle is missing', async () => {
    const harness = createHarness({ moduleFails: true });

    await runSandbox(harness.context);

    expect(harness.messages).toContainEqual({ type: 'monaco-load-error', reason: 'missing-bundle' });
    expect(harness.loading.innerHTML).toContain('node esbuild.config.mjs --monaco-esm-only');
  });
});
