import * as monaco from 'monaco-editor';

const DEFAULT_WORKER_FILE = 'workers/editor.worker.js';

export const monacoWorkerFiles: Readonly<Record<string, string>> = Object.freeze({
  default: DEFAULT_WORKER_FILE,
  editorWorkerService: DEFAULT_WORKER_FILE,
  json: 'workers/json.worker.js',
  css: 'workers/css.worker.js',
  scss: 'workers/css.worker.js',
  less: 'workers/css.worker.js',
  html: 'workers/html.worker.js',
  handlebars: 'workers/html.worker.js',
  razor: 'workers/html.worker.js',
  typescript: 'workers/ts.worker.js',
  javascript: 'workers/ts.worker.js',
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
