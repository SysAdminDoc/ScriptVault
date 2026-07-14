export interface LspPosition {
  line: number;
  character: number;
}

export interface LspRange {
  start: LspPosition;
  end: LspPosition;
}

export interface UserscriptDiagnostic {
  range: LspRange;
  severity: 2;
  code: string;
  source: 'ScriptVault';
  message: string;
}

const METADATA_KEYS = [
  'name', 'namespace', 'description', 'version', 'author', 'match', 'include', 'exclude',
  'grant', 'require', 'resource', 'run-at', 'noframes', 'unwrap', 'icon', 'homepageURL',
  'updateURL', 'downloadURL', 'antifeature', 'compatible', 'incompatible', 'tag', 'license',
  'contributionURL', 'connect', 'priority', 'top-level-await', 'run-in', 'inject-into',
  'sandbox', 'webRequest',
] as const;

const SIGNATURES: Readonly<Record<string, { label: string; documentation: string }>> = Object.freeze({
  GM_getValue: { label: 'GM_getValue<T>(key: string, defaultValue?: T): Promise<T>', documentation: 'Read a script-scoped stored value.' },
  GM_setValue: { label: 'GM_setValue(key: string, value: unknown): Promise<void>', documentation: 'Persist a script-scoped value.' },
  GM_deleteValue: { label: 'GM_deleteValue(key: string): Promise<void>', documentation: 'Remove a stored script value.' },
  GM_xmlhttpRequest: { label: 'GM_xmlhttpRequest(details: GM.Request): GM.RequestHandle', documentation: 'Make a request allowed by @connect and ScriptVault network policy.' },
  'GM.xmlHttpRequest': { label: 'GM.xmlHttpRequest(details: GM.Request): Promise<GM.Response>', documentation: 'Promise-based userscript network request.' },
  GM_notification: { label: 'GM_notification(details: GM.NotificationDetails): Promise<void>', documentation: 'Show a browser notification.' },
  GM_download: { label: 'GM_download(details: GM.DownloadDetails): GM.DownloadHandle', documentation: 'Download a file with userscript permissions.' },
  GM_addStyle: { label: 'GM_addStyle(css: string): HTMLStyleElement', documentation: 'Inject CSS into the current page.' },
});

const VALID_RUN_AT = new Set(['document-start', 'document-body', 'document-end', 'document-idle', 'context-menu']);

function lineRange(line: number, text: string): LspRange {
  return { start: { line, character: 0 }, end: { line, character: Math.max(1, text.length) } };
}

function diagnostic(line: number, text: string, code: string, message: string): UserscriptDiagnostic {
  return { range: lineRange(line, text), severity: 2, code, source: 'ScriptVault', message };
}

function offsetAt(text: string, position: LspPosition): number {
  const lines = text.split('\n');
  const safeLine = Math.min(Math.max(0, Math.trunc(position.line || 0)), Math.max(0, lines.length - 1));
  let offset = 0;
  for (let line = 0; line < safeLine; line += 1) offset += (lines[line] ?? '').length + 1;
  return offset + Math.min(Math.max(0, Math.trunc(position.character || 0)), lines[safeLine]?.length || 0);
}

export function applyLspContentChanges(
  currentText: string,
  changes: Array<{ text?: unknown; range?: LspRange }> | undefined,
): string {
  let text = currentText;
  for (const change of changes || []) {
    const replacement = typeof change?.text === 'string' ? change.text : '';
    if (!change?.range) {
      text = replacement;
      continue;
    }
    const start = offsetAt(text, change.range.start);
    const end = offsetAt(text, change.range.end);
    text = `${text.slice(0, start)}${replacement}${text.slice(Math.max(start, end))}`;
  }
  return text;
}

export function getMetadataCompletions(text: string, position: LspPosition) {
  const cursorOffset = offsetAt(text, position);
  const beforeCursor = text.slice(0, cursorOffset);
  const headerStart = beforeCursor.lastIndexOf('==UserScript==');
  const headerEnd = beforeCursor.lastIndexOf('==/UserScript==');
  if (headerStart < 0 || headerEnd > headerStart) return [];
  const currentLine = beforeCursor.slice(beforeCursor.lastIndexOf('\n') + 1);
  if (!/^\s*\/\/\s*@[-\w]*$/.test(currentLine)) return [];
  const replaceStart = currentLine.lastIndexOf('@');
  const textEditRange: LspRange = {
    start: { line: position.line, character: replaceStart },
    end: { line: position.line, character: position.character },
  };
  return METADATA_KEYS.map(key => ({
    label: `@${key}`,
    kind: 14,
    detail: 'Userscript metadata',
    insertText: `@${key} `,
    textEdit: { range: textEditRange, newText: `@${key} ` },
  }));
}

export function getGmSignatureHelp(text: string, position: LspPosition) {
  const beforeCursor = text.slice(0, offsetAt(text, position));
  const match = beforeCursor.match(/\b(GM_[A-Za-z]\w*|GM\.[A-Za-z]\w*)\s*\([^()]*$/);
  const signatureName = match?.[1];
  const signature = signatureName ? SIGNATURES[signatureName] : undefined;
  if (!signature) return null;
  return {
    signatures: [{ label: signature.label, documentation: signature.documentation }],
    activeSignature: 0,
    activeParameter: Math.max(0, (match?.[0].match(/,/g) || []).length),
  };
}

export function getUserscriptDiagnostics(text: string): UserscriptDiagnostic[] {
  const lines = text.split('\n');
  const start = lines.findIndex(line => line.includes('==UserScript=='));
  const end = lines.findIndex((line, index) => index > start && line.includes('==/UserScript=='));
  if (start < 0 || end < 0) {
    return [diagnostic(0, lines[0] || '', 'metadata-block', 'Add a complete ==UserScript== metadata block before installing or running this script.')];
  }

  const values = new Map<string, Array<{ line: number; value: string; text: string }>>();
  for (let line = start + 1; line < end; line += 1) {
    const lineText = lines[line] ?? '';
    const match = lineText.match(/^\s*\/\/\s*@([^\s]+)(?:\s+(.*))?$/);
    if (!match) continue;
    const key = match[1] ?? '';
    const entries = values.get(key) || [];
    entries.push({ line, value: String(match[2] || '').trim(), text: lineText });
    values.set(key, entries);
  }

  const diagnostics: UserscriptDiagnostic[] = [];
  const headerLine = lines[start] ?? '';
  if (!values.get('name')?.some(entry => entry.value)) {
    diagnostics.push(diagnostic(start, headerLine, 'missing-name', 'Add @name so this script is identifiable during review.'));
  }
  if (![...(values.get('match') || []), ...(values.get('include') || [])].some(entry => entry.value)) {
    diagnostics.push(diagnostic(start, headerLine, 'missing-scope', 'Add @match or @include to define where this script may run.'));
  }
  for (const key of ['name', 'namespace', 'version', 'run-at']) {
    const entries = values.get(key) || [];
    const duplicate = entries[1];
    if (duplicate) diagnostics.push(diagnostic(duplicate.line, duplicate.text, 'duplicate-metadata', `Keep only one @${key} directive.`));
  }
  for (const entry of values.get('run-at') || []) {
    if (!VALID_RUN_AT.has(entry.value)) diagnostics.push(diagnostic(entry.line, entry.text, 'invalid-run-at', `Use a supported @run-at value: ${[...VALID_RUN_AT].join(', ')}.`));
  }
  for (const entry of values.get('require') || []) {
    if (/^http:\/\//i.test(entry.value)) diagnostics.push(diagnostic(entry.line, entry.text, 'insecure-require', 'Use HTTPS for @require dependencies to protect code integrity in transit.'));
  }
  for (const entry of values.get('connect') || []) {
    if (entry.value === '*') diagnostics.push(diagnostic(entry.line, entry.text, 'broad-connect', 'Replace @connect * with the specific hosts this script needs.'));
  }
  return diagnostics;
}
