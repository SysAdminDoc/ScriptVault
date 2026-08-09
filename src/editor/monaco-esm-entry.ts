import * as editorApi from 'monaco-editor/editor/editor.api.js';
import * as lsp from '../../node_modules/monaco-editor/esm/external/monaco-lsp-client/out/index.js';
import 'monaco-editor/languages/definitions/javascript/register.js';
import 'monaco-editor/languages/definitions/typescript/register.js';
import 'monaco-editor/language/typescript/monaco.contribution.js';
import 'monaco-editor/languages/definitions/css/register.js';
import 'monaco-editor/language/css/monaco.contribution.js';

const monaco = Object.freeze({ ...editorApi, lsp });

const DEFAULT_WORKER_FILE = 'workers/editor.worker.js';

export const monacoWorkerFiles: Readonly<Record<string, string>> = Object.freeze({
  default: DEFAULT_WORKER_FILE,
  editorWorkerService: DEFAULT_WORKER_FILE,
  css: 'workers/css.worker.js',
  scss: 'workers/css.worker.js',
  less: 'workers/css.worker.js',
  typescript: 'workers/ts.worker.js',
  javascript: 'workers/ts.worker.js',
  userscriptLsp: 'workers/userscript-lsp.worker.js',
});

export function getMonacoWorkerFile(label: string): string {
  return monacoWorkerFiles[label] ?? DEFAULT_WORKER_FILE;
}

export function getMonacoWorkerUrl(label: string): string {
  return new URL(getMonacoWorkerFile(label), import.meta.url).toString();
}

const globalScope = globalThis as typeof globalThis & {
  MonacoEnvironment?: Record<string, unknown>;
  ScriptVaultMonacoEsm?: unknown;
};

globalScope.MonacoEnvironment = {
  ...(globalScope.MonacoEnvironment || {}),
  getWorkerUrl(_moduleId: string, label: string): string {
    return getMonacoWorkerUrl(label);
  },
};

globalScope.ScriptVaultMonacoEsm = Object.freeze({
  monaco,
  workerFiles: monacoWorkerFiles,
  getWorkerUrl: getMonacoWorkerUrl,
});

export { monaco };
export default monaco;
