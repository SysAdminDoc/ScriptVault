// ScriptVault - Static Analysis Engine v2
// AST-based analysis via the Chrome offscreen document when available.
// Firefox MV3 has no chrome.offscreen API, so the background page loads the
// same local Acorn/Diff libraries inline and falls back to regex analysis if
// parser loading is unavailable.

function debugLogSafe(...args: unknown[]): void {
  const maybeDebugLog = (globalThis as { debugLog?: (...debugArgs: unknown[]) => void }).debugLog;
  if (typeof maybeDebugLog === 'function') {
    maybeDebugLog(...args);
  }
}

type AstNode = Record<string, any>;

interface AnalysisPattern {
  id: string;
  regex: RegExp;
  label: string;
  risk: number;
  category: string;
  desc: string;
}

interface AstPattern {
  id: string;
  label: string;
  risk: number;
  category: string;
  desc: string;
  match: (node: AstNode) => boolean;
}

interface Finding {
  id: string;
  label: string;
  category: string;
  desc: string;
  risk: number;
  count: number;
  adjustedRisk: number;
  location?: { line: number; col: number } | null;
}

interface AnalysisResult {
  totalRisk: number;
  riskLevel: string;
  findings: Finding[];
  categories: Record<string, Finding[]>;
  summary: string;
  astAnalyzed: boolean;
  parseError?: boolean;
  skipped?: boolean;
}

interface ESMImportInfo {
  start: number;
  end: number;
  source: string;
  specifiers: Array<{
    kind: 'default' | 'namespace' | 'named';
    local: string;
    imported?: string;
  }>;
}

interface ESMExportInfo {
  kind: 'default' | 'named-declaration' | 'named-specifiers';
  start: number;
  end: number;
  declarationStart: number;
  declarationEnd: number;
  localName?: string | null;
  names?: string[];
  specifiers?: Array<{ local: string; exported: string }>;
}

interface ESMSyntaxInfo {
  imports: ESMImportInfo[];
  exports: ESMExportInfo[];
  dynamicImports: Array<{ line?: number | null; column?: number | null }>;
  unsupportedExports: Array<{ type: string }>;
  error?: string;
}

interface MergeResult {
  merged?: string;
  conflicts?: boolean;
  error?: string;
}

interface OffscreenApi {
  hasDocument?: () => Promise<boolean>;
  createDocument?: (params: {
    url: string;
    reasons: string[];
    justification: string;
  }) => Promise<void>;
}

interface AcornGlobal {
  parse(code: string, options: Record<string, unknown>): AstNode;
}

interface DiffGlobal {
  merge(local: string, remote: string, base: string): unknown;
  applyPatch(base: string, patch: unknown): string | false;
  diffLines(oldCode: string, newCode: string): Array<{ added?: boolean; removed?: boolean; count?: number }>;
}

type RuntimeImportScripts = (...urls: string[]) => void;

// Offscreen/inline dispatch

async function analyzeAsync(code: string): Promise<AnalysisResult> {
  const offscreenSupported = _supportsOffscreen();
  try {
    const result = await sendOffscreenMessage<AnalysisResult>({ type: 'offscreen_analyze', code });
    if (result && !result.parseError) return result;
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    debugLogSafe('[Analyzer] Offscreen analysis failed:', message);
  }

  if (!offscreenSupported) {
    try {
      const result = await analyzeInline(code);
      if (result && !result.parseError) return result;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      debugLogSafe('[Analyzer] Inline AST failed, using regex fallback:', message);
    }
  }

  return analyze(code);
}

function getOffscreenApi(): OffscreenApi | null {
  const maybeChrome = chrome as unknown as { offscreen?: OffscreenApi };
  const offscreen = maybeChrome?.offscreen;
  if (!offscreen || typeof offscreen.hasDocument !== 'function' || typeof offscreen.createDocument !== 'function') {
    return null;
  }
  return offscreen;
}

function _supportsOffscreen(): boolean {
  return getOffscreenApi() !== null;
}

async function _ensureOffscreen(): Promise<boolean> {
  const offscreen = getOffscreenApi();
  if (!offscreen) return false;

  if (!ScriptAnalyzer._offscreenPromise) {
    ScriptAnalyzer._offscreenPromise = (async (): Promise<boolean> => {
      const existing: boolean = await offscreen.hasDocument!().catch(() => false);
      if (!existing) {
        await offscreen.createDocument!({
          url: chrome.runtime.getURL('offscreen.html'),
          reasons: ['DOM_SCRAPING'],
          justification: 'AST-based script analysis with Acorn parser'
        });
      }
      return true;
    })().catch((e: unknown) => {
      ScriptAnalyzer._offscreenPromise = null;
      throw e;
    });
  }

  return ScriptAnalyzer._offscreenPromise;
}

async function sendOffscreenMessage<T>(message: Record<string, unknown>): Promise<T | undefined> {
  if (!await _ensureOffscreen()) return undefined;
  return chrome.runtime.sendMessage(message) as Promise<T>;
}

function getGlobalValue<T>(name: string): T | null {
  const value = (globalThis as unknown as Record<string, unknown>)[name];
  return value ? value as T : null;
}

function getNativeImportScripts(): RuntimeImportScripts | null {
  const loader = (globalThis as { importScripts?: unknown }).importScripts;
  if (typeof loader !== 'function') return null;
  const source = Function.prototype.toString.call(loader);
  // background.core.ts also has an app-level importScripts() function. Only the
  // native worker loader is safe to treat as a script-import primitive.
  if (!source.includes('[native code]')) return null;
  return loader as RuntimeImportScripts;
}

async function loadRuntimeScript(path: string): Promise<void> {
  const url = chrome.runtime?.getURL ? chrome.runtime.getURL(path) : path;
  const workerLoader = getNativeImportScripts();
  if (workerLoader) {
    workerLoader(url);
    return;
  }

  const doc = (globalThis as typeof globalThis & { document?: Document }).document;
  if (!doc?.createElement) {
    throw new Error(`No runtime script loader available for ${path}`);
  }
  const parent = doc.head || doc.documentElement;
  if (!parent?.appendChild) {
    throw new Error(`No document root available to load ${path}`);
  }

  await new Promise<void>((resolve, reject) => {
    const script = doc.createElement('script');
    const timer = globalThis.setTimeout(() => {
      script.remove();
      reject(new Error(`Timed out loading ${path}`));
    }, 5000);
    script.src = url;
    script.async = false;
    script.onload = (): void => {
      globalThis.clearTimeout(timer);
      script.remove();
      resolve();
    };
    script.onerror = (): void => {
      globalThis.clearTimeout(timer);
      script.remove();
      reject(new Error(`Failed to load ${path}`));
    };
    parent.appendChild(script);
  });
}

async function ensureInlineLibrary(path: string, globalName: string): Promise<void> {
  if (getGlobalValue<unknown>(globalName)) return;
  const key = `${globalName}:${path}`;
  if (!ScriptAnalyzer._inlineLibraryPromises[key]) {
    ScriptAnalyzer._inlineLibraryPromises[key] = loadRuntimeScript(path).then(() => {
      if (!getGlobalValue<unknown>(globalName)) {
        throw new Error(`${globalName} did not initialize from ${path}`);
      }
    }).catch((e: unknown) => {
      ScriptAnalyzer._inlineLibraryPromises[key] = undefined;
      throw e;
    });
  }
  return ScriptAnalyzer._inlineLibraryPromises[key]!;
}

async function ensureInlineAcorn(): Promise<void> {
  await ensureInlineLibrary('lib/acorn.min.js', 'acorn');
}

async function ensureInlineDiff(): Promise<void> {
  await ensureInlineLibrary('lib/diff.min.js', 'Diff');
}

function getAcorn(): AcornGlobal {
  const parser = getGlobalValue<AcornGlobal>('acorn');
  if (!parser || typeof parser.parse !== 'function') {
    throw new Error('Acorn parser is not available');
  }
  return parser;
}

function getDiff(): DiffGlobal {
  const diff = getGlobalValue<DiffGlobal>('Diff');
  if (!diff || typeof diff.merge !== 'function' || typeof diff.applyPatch !== 'function') {
    throw new Error('Diff library is not available');
  }
  return diff;
}

async function analyzeInline(code: string): Promise<AnalysisResult> {
  await ensureInlineAcorn();
  return handleInlineAnalyze(code);
}

async function analyzeESMImports(code: string): Promise<ESMSyntaxInfo> {
  const offscreenSupported = _supportsOffscreen();
  try {
    const offscreenResult = await sendOffscreenMessage<ESMSyntaxInfo>({ type: 'offscreen_esm_imports', code });
    if (offscreenResult) return offscreenResult;
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    debugLogSafe('[Analyzer] Offscreen ESM parse failed:', message);
  }

  if (offscreenSupported) {
    return { imports: [], exports: [], dynamicImports: [], unsupportedExports: [], error: 'ESM parse error: offscreen parser unavailable' };
  }

  try {
    await ensureInlineAcorn();
    return parseESMImportsInline(code);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return { imports: [], exports: [], dynamicImports: [], unsupportedExports: [], error: 'ESM parse error: ' + message };
  }
}

async function mergeText(base: string, local: string, remote: string): Promise<MergeResult> {
  const offscreenSupported = _supportsOffscreen();
  try {
    const offscreenResult = await sendOffscreenMessage<MergeResult>({
      type: 'offscreen_merge',
      base,
      local,
      remote
    });
    if (offscreenResult) return offscreenResult;
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    debugLogSafe('[Analyzer] Offscreen merge failed:', message);
  }

  if (offscreenSupported) {
    return { merged: resolveWithMarkers(local, remote), conflicts: true, error: 'offscreen merge unavailable' };
  }

  try {
    await ensureInlineDiff();
    return mergeTextInline(base, local, remote);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return { merged: resolveWithMarkers(local, remote), conflicts: true, error: message };
  }
}

// Regex fallback (kept for parity and offline use)
const patterns: AnalysisPattern[] = [
  { id: 'eval', regex: /\beval\s*\(/g, label: 'eval() call', risk: 30, category: 'execution', desc: 'Dynamic code execution can run arbitrary code' },
  { id: 'function-ctor', regex: /\bnew\s+Function\s*\(/g, label: 'new Function()', risk: 30, category: 'execution', desc: 'Creates functions from strings, equivalent to eval' },
  { id: 'settimeout-str', regex: /setTimeout\s*\(\s*['\"`]/g, label: 'setTimeout with string', risk: 20, category: 'execution', desc: 'String argument to setTimeout acts like eval' },
  { id: 'setinterval-str', regex: /setInterval\s*\(\s*['\"`]/g, label: 'setInterval with string', risk: 20, category: 'execution', desc: 'String argument to setInterval acts like eval' },
  { id: 'document-write', regex: /document\.write\s*\(/g, label: 'document.write()', risk: 10, category: 'execution', desc: 'Can overwrite entire page content' },
  { id: 'innerhtml-assign', regex: /\.innerHTML\s*=/g, label: 'innerHTML assignment', risk: 5, category: 'execution', desc: 'Can inject HTML including scripts (XSS risk)' },
  { id: 'cookie-access', regex: /document\.cookie/g, label: 'Cookie access', risk: 25, category: 'data', desc: 'Can read or modify browser cookies' },
  { id: 'localstorage', regex: /localStorage\.(get|set|remove)Item/g, label: 'localStorage access', risk: 10, category: 'data', desc: 'Reads or writes persistent page data' },
  { id: 'sessionstorage', regex: /sessionStorage\.(get|set|remove)Item/g, label: 'sessionStorage access', risk: 5, category: 'data', desc: 'Reads or writes session data' },
  { id: 'indexeddb', regex: /indexedDB\.open/g, label: 'IndexedDB access', risk: 10, category: 'data', desc: 'Opens browser database' },
  { id: 'fetch-call', regex: /\bfetch\s*\(/g, label: 'fetch() call', risk: 10, category: 'network', desc: 'Makes network requests (same-origin)' },
  { id: 'xhr-open', regex: /XMLHttpRequest|\.open\s*\(\s*['""](?:GET|POST|PUT|DELETE)/gi, label: 'XMLHttpRequest', risk: 10, category: 'network', desc: 'Makes network requests' },
  { id: 'websocket', regex: /new\s+WebSocket\s*\(/g, label: 'WebSocket', risk: 20, category: 'network', desc: 'Opens persistent connection to a server' },
  { id: 'beacon', regex: /navigator\.sendBeacon/g, label: 'sendBeacon()', risk: 15, category: 'network', desc: 'Sends data to a server, often used for tracking' },
  { id: 'canvas-fp', regex: /\.toDataURL\s*\(|\.getImageData\s*\(/g, label: 'Canvas fingerprinting', risk: 20, category: 'fingerprint', desc: 'Can generate unique device fingerprint via canvas' },
  { id: 'webgl-fp', regex: /getExtension\s*\(\s*['""]WEBGL/g, label: 'WebGL fingerprinting', risk: 20, category: 'fingerprint', desc: 'Can identify GPU for device fingerprinting' },
  { id: 'audio-fp', regex: /AudioContext|OfflineAudioContext/g, label: 'Audio fingerprinting', risk: 15, category: 'fingerprint', desc: 'Can generate audio-based device fingerprint' },
  { id: 'navigator-props', regex: /navigator\.(platform|userAgent|language|hardwareConcurrency|deviceMemory|plugins)/g, label: 'Navigator property access', risk: 5, category: 'fingerprint', desc: 'Reads browser/device information' },
  { id: 'atob-long', regex: /atob\s*\(\s*['""][A-Za-z0-9+/=]{100,}['"]\s*\)/g, label: 'Large base64 decode', risk: 25, category: 'obfuscation', desc: 'Decodes large embedded base64 data (possible obfuscation)' },
  { id: 'hex-escape', regex: /\\x[0-9a-fA-F]{2}(?:\\x[0-9a-fA-F]{2}){10,}/g, label: 'Hex escape sequences', risk: 20, category: 'obfuscation', desc: 'Long hex-encoded strings suggest obfuscated code' },
  { id: 'char-fromcode', regex: /String\.fromCharCode\s*\([^)]{20,}\)/g, label: 'String.fromCharCode chain', risk: 15, category: 'obfuscation', desc: 'Building strings from char codes (obfuscation technique)' },
  { id: 'wasm-mining', regex: /WebAssembly\.(instantiate|compile|Module)/g, label: 'WebAssembly usage', risk: 15, category: 'mining', desc: 'WebAssembly can be used for crypto mining' },
  { id: 'worker-creation', regex: /new\s+Worker\s*\(/g, label: 'Web Worker creation', risk: 10, category: 'mining', desc: 'Workers can run background computations' },
  { id: 'form-submit', regex: /\.submit\s*\(\s*\)/g, label: 'Form auto-submit', risk: 15, category: 'hijack', desc: 'Automatically submits forms' },
  { id: 'window-open', regex: /window\.open\s*\(/g, label: 'window.open()', risk: 5, category: 'hijack', desc: 'Opens new windows/popups' },
  { id: 'location-assign', regex: /(?:window\.|document\.)?location\s*=|location\.(?:href|assign|replace)\s*=/g, label: 'Page redirect', risk: 10, category: 'hijack', desc: 'Redirects the page to another URL' },
  { id: 'event-prevent', regex: /addEventListener\s*\(\s*['""](?:beforeunload|unload)['"]/g, label: 'Unload handler', risk: 10, category: 'hijack', desc: 'Prevents or intercepts page navigation' },
  { id: 'proto-pollution', regex: /__proto__|Object\.setPrototypeOf\s*\(|prototype\[/g, label: 'Prototype manipulation', risk: 25, category: 'hijack', desc: 'Modifying object prototypes can corrupt global state and affect other scripts' },
  { id: 'document-domain', regex: /document\.domain\s*=/g, label: 'document.domain assignment', risk: 20, category: 'hijack', desc: 'Changing document.domain relaxes same-origin restrictions' },
  { id: 'postmessage-noorigin', regex: /postMessage\s*\([^,)]+,\s*['"]\*['"]/g, label: 'postMessage with wildcard origin', risk: 15, category: 'hijack', desc: 'Sending postMessage to any origin (* target) can leak data to malicious frames' },
  { id: 'defineProperty-global', regex: /Object\.defineProperty\s*\(\s*(?:window|globalThis|self|unsafeWindow)\s*,/g, label: 'Global property definition', risk: 10, category: 'hijack', desc: 'Defining properties on the global object can interfere with page code' },
  { id: 'mutation-events', regex: /addEventListener\s*\(\s*['"](?:DOMNodeInserted|DOMNodeRemoved|DOMSubtreeModified|DOMAttrModified|DOMCharacterDataModified|DOMNodeInsertedIntoDocument|DOMNodeRemovedFromDocument)['"]/g, label: 'Deprecated Mutation Events', risk: 5, category: 'deprecated', desc: 'Legacy Mutation Events are removed in Chrome and Firefox 140+. Use MutationObserver instead.' },
];

const AST_RISK_PATTERNS: AstPattern[] = [
  {
    id: 'eval',
    label: 'eval() call',
    risk: 30,
    category: 'execution',
    desc: 'Dynamic code execution can run arbitrary code',
    match: (node: AstNode): boolean => node.type === 'CallExpression' && isIdent(node.callee, 'eval')
  },
  {
    id: 'function-ctor',
    label: 'new Function()',
    risk: 30,
    category: 'execution',
    desc: 'Creates functions from strings, equivalent to eval',
    match: (node: AstNode): boolean => node.type === 'NewExpression' && isIdent(node.callee, 'Function')
  },
  {
    id: 'indirect-eval',
    label: 'Indirect eval ((0, eval))',
    risk: 30,
    category: 'execution',
    desc: 'Indirect eval runs in global scope, bypassing local closures (obfuscation pattern)',
    match: (node: AstNode): boolean => {
      if (node?.type !== 'CallExpression') return false;
      const callee = node.callee;
      if (callee?.type !== 'SequenceExpression') return false;
      const exprs = callee.expressions;
      if (!Array.isArray(exprs) || exprs.length === 0) return false;
      return isIdent(exprs[exprs.length - 1], 'eval');
    }
  },
  {
    id: 'dynamic-property-call',
    label: 'Dynamic-property global call',
    risk: 25,
    category: 'obfuscation',
    desc: 'Calls a globally-scoped function via computed property access (eval obfuscation)',
    match: (node: AstNode): boolean => {
      if (node?.type !== 'CallExpression') return false;
      const callee = node.callee;
      if (callee?.type !== 'MemberExpression' || callee.computed !== true) return false;
      if (callee.property?.type === 'Literal' && typeof callee.property.value === 'string') return false;
      return isIdent(callee.object, 'window')
          || isIdent(callee.object, 'globalThis')
          || isIdent(callee.object, 'self')
          || isIdent(callee.object, 'unsafeWindow');
    }
  },
  {
    id: 'function-ctor-apply',
    label: 'Function constructor via .apply/.call/.bind',
    risk: 25,
    category: 'execution',
    desc: 'Calling Function() via .apply/.call/.bind is equivalent to new Function()',
    match: (node: AstNode): boolean => {
      if (node?.type !== 'CallExpression') return false;
      const callee = node.callee;
      if (callee?.type !== 'MemberExpression') return false;
      const methodName = callee.property?.name;
      if (methodName !== 'apply' && methodName !== 'call' && methodName !== 'bind') return false;
      if (isIdent(callee.object, 'Function')) return true;
      if (callee.object?.type === 'MemberExpression') {
        if (isMember(callee.object, 'Function', 'prototype')) return true;
        if (callee.object?.property?.name === 'constructor'
            && callee.object?.object?.type === 'MemberExpression'
            && isMember(callee.object.object, 'Function', 'prototype')) return true;
      }
      return false;
    }
  },
  {
    id: 'settimeout-str',
    label: 'setTimeout with string',
    risk: 20,
    category: 'execution',
    desc: 'String argument to setTimeout acts like eval',
    match: (node: AstNode): boolean => node.type === 'CallExpression' && isIdent(node.callee, 'setTimeout') && node.arguments?.[0]?.type === 'Literal' && typeof node.arguments[0].value === 'string'
  },
  {
    id: 'setinterval-str',
    label: 'setInterval with string',
    risk: 20,
    category: 'execution',
    desc: 'String argument to setInterval acts like eval',
    match: (node: AstNode): boolean => node.type === 'CallExpression' && isIdent(node.callee, 'setInterval') && node.arguments?.[0]?.type === 'Literal' && typeof node.arguments[0].value === 'string'
  },
  {
    id: 'document-write',
    label: 'document.write()',
    risk: 10,
    category: 'execution',
    desc: 'Can overwrite entire page content',
    match: (node: AstNode): boolean => node.type === 'CallExpression' && isMember(node.callee, 'document', 'write')
  },
  {
    id: 'innerhtml-assign',
    label: 'innerHTML assignment',
    risk: 5,
    category: 'execution',
    desc: 'Can inject HTML including scripts (XSS risk)',
    match: (node: AstNode): boolean => (node.type === 'AssignmentExpression' || node.type === 'AssignmentPattern') && node.left?.property?.name === 'innerHTML'
  },
  {
    id: 'cookie-access',
    label: 'Cookie access',
    risk: 25,
    category: 'data',
    desc: 'Can read or modify browser cookies',
    match: (node: AstNode): boolean => node.type === 'MemberExpression' && isMember(node, 'document', 'cookie')
  },
  {
    id: 'localstorage',
    label: 'localStorage access',
    risk: 10,
    category: 'data',
    desc: 'Reads or writes persistent page data',
    match: (node: AstNode): boolean => node.type === 'CallExpression' && node.callee?.type === 'MemberExpression' && isIdent(node.callee.object, 'localStorage') && ['getItem','setItem','removeItem'].includes(node.callee?.property?.name)
  },
  {
    id: 'sessionstorage',
    label: 'sessionStorage access',
    risk: 5,
    category: 'data',
    desc: 'Reads or writes session data',
    match: (node: AstNode): boolean => node.type === 'CallExpression' && node.callee?.type === 'MemberExpression' && isIdent(node.callee.object, 'sessionStorage') && ['getItem','setItem','removeItem'].includes(node.callee?.property?.name)
  },
  {
    id: 'indexeddb',
    label: 'IndexedDB access',
    risk: 10,
    category: 'data',
    desc: 'Opens browser database',
    match: (node: AstNode): boolean => node.type === 'CallExpression' && isMember(node.callee, 'indexedDB', 'open')
  },
  {
    id: 'fetch-call',
    label: 'fetch() call',
    risk: 10,
    category: 'network',
    desc: 'Makes network requests (same-origin)',
    match: (node: AstNode): boolean => node.type === 'CallExpression' && isIdent(node.callee, 'fetch')
  },
  {
    id: 'xhr-open',
    label: 'XMLHttpRequest',
    risk: 10,
    category: 'network',
    desc: 'Makes network requests via XHR',
    match: (node: AstNode): boolean => (node.type === 'NewExpression' && isIdent(node.callee, 'XMLHttpRequest')) || (node.type === 'CallExpression' && node.callee?.property?.name === 'open' && node.arguments?.[0]?.type === 'Literal' && /^(GET|POST|PUT|DELETE|PATCH|HEAD)$/i.test(String(node.arguments[0].value)))
  },
  {
    id: 'websocket',
    label: 'WebSocket',
    risk: 20,
    category: 'network',
    desc: 'Opens persistent connection to a server',
    match: (node: AstNode): boolean => node.type === 'NewExpression' && isIdent(node.callee, 'WebSocket')
  },
  {
    id: 'beacon',
    label: 'sendBeacon()',
    risk: 15,
    category: 'network',
    desc: 'Sends data to a server, often used for tracking',
    match: (node: AstNode): boolean => node.type === 'CallExpression' && isMember(node.callee, 'navigator', 'sendBeacon')
  },
  {
    id: 'canvas-fp',
    label: 'Canvas fingerprinting',
    risk: 20,
    category: 'fingerprint',
    desc: 'Can generate unique device fingerprint via canvas',
    match: (node: AstNode): boolean => node.type === 'CallExpression' && ['toDataURL','getImageData'].includes(node.callee?.property?.name)
  },
  {
    id: 'webgl-fp',
    label: 'WebGL fingerprinting',
    risk: 20,
    category: 'fingerprint',
    desc: 'Can identify GPU for device fingerprinting',
    match: (node: AstNode): boolean => node.type === 'CallExpression' && node.callee?.property?.name === 'getExtension' && node.arguments?.[0]?.type === 'Literal' && String(node.arguments[0].value).startsWith('WEBGL')
  },
  {
    id: 'audio-fp',
    label: 'Audio fingerprinting',
    risk: 15,
    category: 'fingerprint',
    desc: 'Can generate audio-based device fingerprint',
    match: (node: AstNode): boolean => node.type === 'NewExpression' && ['AudioContext','OfflineAudioContext'].includes(node.callee?.name)
  },
  {
    id: 'navigator-props',
    label: 'Navigator property access',
    risk: 5,
    category: 'fingerprint',
    desc: 'Reads browser/device information',
    match: (node: AstNode): boolean => node.type === 'MemberExpression' && isIdent(node.object, 'navigator') && ['platform','userAgent','language','hardwareConcurrency','deviceMemory','plugins'].includes(node.property?.name)
  },
  {
    id: 'atob-long',
    label: 'Large base64 decode',
    risk: 25,
    category: 'obfuscation',
    desc: 'Decodes large embedded base64 data (possible obfuscation)',
    match: (node: AstNode): boolean => node.type === 'CallExpression' && isIdent(node.callee, 'atob') && node.arguments?.[0]?.type === 'Literal' && typeof node.arguments[0].value === 'string' && node.arguments[0].value.length >= 100
  },
  {
    id: 'char-fromcode',
    label: 'String.fromCharCode chain',
    risk: 15,
    category: 'obfuscation',
    desc: 'Building strings from char codes (obfuscation technique)',
    match: (node: AstNode): boolean => node.type === 'CallExpression' && isMember(node.callee, 'String', 'fromCharCode') && node.arguments.length > 5
  },
  {
    id: 'wasm-module',
    label: 'WebAssembly usage',
    risk: 15,
    category: 'mining',
    desc: 'WebAssembly can be used for crypto mining',
    match: (node: AstNode): boolean => node.type === 'CallExpression' && node.callee?.type === 'MemberExpression' && isIdent(node.callee.object, 'WebAssembly') && ['instantiate','compile','Module'].includes(node.callee?.property?.name)
  },
  {
    id: 'worker-creation',
    label: 'Web Worker creation',
    risk: 10,
    category: 'mining',
    desc: 'Workers can run background computations',
    match: (node: AstNode): boolean => node.type === 'NewExpression' && isIdent(node.callee, 'Worker')
  },
  {
    id: 'form-submit',
    label: 'Form auto-submit',
    risk: 15,
    category: 'hijack',
    desc: 'Automatically submits forms',
    match: (node: AstNode): boolean => node.type === 'CallExpression' && node.callee?.property?.name === 'submit' && node.arguments.length === 0
  },
  {
    id: 'window-open',
    label: 'window.open()',
    risk: 5,
    category: 'hijack',
    desc: 'Opens new windows/popups',
    match: (node: AstNode): boolean => node.type === 'CallExpression' && isMember(node.callee, 'window', 'open')
  },
  {
    id: 'location-assign',
    label: 'Page redirect',
    risk: 10,
    category: 'hijack',
    desc: 'Redirects the page to another URL',
    match: (node: AstNode): boolean => (node.type === 'AssignmentExpression' && (isMember(node.left, 'location', 'href') || isIdent(node.left, 'location'))) || (node.type === 'CallExpression' && node.callee?.type === 'MemberExpression' && isIdent(node.callee.object, 'location') && ['assign','replace'].includes(node.callee?.property?.name))
  },
  {
    id: 'event-prevent',
    label: 'Unload handler',
    risk: 10,
    category: 'hijack',
    desc: 'Prevents or intercepts page navigation',
    match: (node: AstNode): boolean => node.type === 'CallExpression' && node.callee?.property?.name === 'addEventListener' && node.arguments?.[0]?.type === 'Literal' && ['beforeunload','unload'].includes(node.arguments[0].value)
  },
  {
    id: 'proto-pollution',
    label: 'Prototype manipulation',
    risk: 25,
    category: 'hijack',
    desc: 'Modifying object prototypes can corrupt global state',
    match: (node: AstNode): boolean => (node.type === 'MemberExpression' && node.property?.name === '__proto__') || (node.type === 'CallExpression' && isMember(node.callee, 'Object', 'setPrototypeOf')) || (node.type === 'MemberExpression' && node.property?.name === 'prototype' && node._parent?.type === 'MemberExpression')
  },
  {
    id: 'document-domain',
    label: 'document.domain assignment',
    risk: 20,
    category: 'hijack',
    desc: 'Changing document.domain relaxes same-origin restrictions',
    match: (node: AstNode): boolean => node.type === 'AssignmentExpression' && isMember(node.left, 'document', 'domain')
  },
  {
    id: 'postmessage-wildcard',
    label: 'postMessage with wildcard origin',
    risk: 15,
    category: 'hijack',
    desc: 'Sending postMessage to any origin (*) can leak data to malicious frames',
    match: (node: AstNode): boolean => node.type === 'CallExpression' && node.callee?.property?.name === 'postMessage' && node.arguments?.[1]?.type === 'Literal' && node.arguments[1].value === '*'
  },
  {
    id: 'defineProperty-global',
    label: 'Global property definition',
    risk: 10,
    category: 'hijack',
    desc: 'Defining properties on the global object can interfere with page code',
    match: (node: AstNode): boolean => node.type === 'CallExpression' && isMember(node.callee, 'Object', 'defineProperty') && node.arguments?.[0]?.type === 'Identifier' && ['window','globalThis','self','unsafeWindow'].includes(node.arguments[0].name)
  },
];

function isIdent(node: AstNode | null | undefined, name: string): boolean {
  return node?.type === 'Identifier' && node.name === name;
}

function isMember(node: AstNode | null | undefined, obj: string, prop: string): boolean {
  return node?.type === 'MemberExpression' && isIdent(node.object, obj) && node.property?.name === prop;
}

function handleInlineAnalyze(code: string): AnalysisResult {
  try {
    if (code && code.length > 2000000) {
      return {
        totalRisk: 0,
        riskLevel: 'unknown',
        findings: [],
        categories: {},
        summary: 'Script too large for AST analysis',
        astAnalyzed: false,
        skipped: true
      };
    }
    return analyzeAST(code);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      totalRisk: 0,
      riskLevel: 'unknown',
      findings: [],
      categories: {},
      summary: 'Parse error: ' + message,
      astAnalyzed: false,
      parseError: true
    };
  }
}

function analyzeAST(code: string): AnalysisResult {
  const parser = getAcorn();
  const hasUseStrict = /^(['"])use strict\1/m.test(code);
  let ast: AstNode;
  try {
    ast = parser.parse(code, { ecmaVersion: 2022, sourceType: 'script', allowHashBang: true, locations: true, ...(hasUseStrict ? { strict: true } : {}) });
  } catch {
    ast = parser.parse(code, { ecmaVersion: 2022, sourceType: 'module', allowHashBang: true, locations: true });
  }

  const hits = new Map<string, number>();
  const hitNodes = new Map<string, { line: number; col: number }>();

  walkAST(ast, (node: AstNode): void => {
    for (const pattern of AST_RISK_PATTERNS) {
      try {
        if (pattern.match(node)) {
          hits.set(pattern.id, (hits.get(pattern.id) || 0) + 1);
          if (!hitNodes.has(pattern.id) && node.loc) {
            hitNodes.set(pattern.id, { line: node.loc.start.line, col: node.loc.start.column });
          }
        }
      } catch {}
    }
  });

  const entropyResult = checkHighEntropyStrings(ast);
  const findings: Finding[] = [];
  let totalRisk = 0;

  for (const pattern of AST_RISK_PATTERNS) {
    const count = hits.get(pattern.id) || 0;
    if (count > 0) {
      const adjustedRisk = Math.min(pattern.risk * Math.min(count, 3), pattern.risk * 3);
      totalRisk += adjustedRisk;
      findings.push({
        id: pattern.id,
        label: pattern.label,
        category: pattern.category,
        desc: pattern.desc,
        risk: pattern.risk,
        count,
        adjustedRisk,
        location: hitNodes.get(pattern.id) || null
      });
    }
  }

  if (entropyResult) {
    totalRisk += entropyResult.adjustedRisk;
    findings.push(entropyResult);
  }

  const riskLevel: string = totalRisk >= 80 ? 'high' : totalRisk >= 40 ? 'medium' : totalRisk >= 15 ? 'low' : 'minimal';
  const categories: Record<string, Finding[]> = {};
  for (const f of findings) {
    if (!categories[f.category]) categories[f.category] = [];
    categories[f.category]!.push(f);
  }

  return {
    totalRisk: Math.min(totalRisk, 100),
    riskLevel,
    findings,
    categories,
    summary: generateSummary(riskLevel, findings),
    astAnalyzed: true
  };
}

function parseESMImportsInline(code: string): ESMSyntaxInfo {
  const parser = getAcorn();
  try {
    const ast = parser.parse(code, { ecmaVersion: 2022, sourceType: 'module', allowHashBang: true, locations: true });
    const imports: ESMImportInfo[] = [];
    const exports: ESMExportInfo[] = [];
    const dynamicImports: ESMSyntaxInfo['dynamicImports'] = [];
    const unsupportedExports: ESMSyntaxInfo['unsupportedExports'] = [];

    walkAST(ast, (node: AstNode): void => {
      if (node.type === 'ImportDeclaration') {
        imports.push({
          start: node.start,
          end: node.end,
          source: node.source?.value || '',
          specifiers: (node.specifiers || []).map((spec: AstNode) => {
            if (spec.type === 'ImportDefaultSpecifier') {
              return { kind: 'default', local: spec.local.name };
            }
            if (spec.type === 'ImportNamespaceSpecifier') {
              return { kind: 'namespace', local: spec.local.name };
            }
            return {
              kind: 'named',
              imported: spec.imported?.name || spec.imported?.value,
              local: spec.local.name
            };
          })
        });
      } else if (node.type === 'ImportExpression'
          || (node.type === 'CallExpression' && node.callee?.type === 'Import')) {
        dynamicImports.push({
          line: node.loc?.start?.line || null,
          column: node.loc?.start?.column || null
        });
      } else if (node.type === 'ExportDefaultDeclaration') {
        const declaration = node.declaration;
        exports.push({
          kind: 'default',
          start: node.start,
          end: node.end,
          declarationStart: declaration.start,
          declarationEnd: declaration.end,
          localName: declaration.id?.name || null
        });
      } else if (node.type === 'ExportNamedDeclaration') {
        if (node.source) {
          unsupportedExports.push({ type: 're-export' });
        } else if (node.declaration) {
          exports.push({
            kind: 'named-declaration',
            start: node.start,
            end: node.end,
            declarationStart: node.declaration.start,
            declarationEnd: node.declaration.end,
            names: declaredExportNames(node.declaration)
          });
        } else {
          exports.push({
            kind: 'named-specifiers',
            start: node.start,
            end: node.end,
            declarationStart: node.start,
            declarationEnd: node.end,
            specifiers: (node.specifiers || []).map((spec: AstNode) => ({
              local: spec.local?.name || spec.local?.value,
              exported: spec.exported?.name || spec.exported?.value
            }))
          });
        }
      } else if (node.type === 'ExportAllDeclaration') {
        unsupportedExports.push({ type: 'export-all' });
      }
    });

    return { imports, exports, dynamicImports, unsupportedExports };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return { imports: [], exports: [], dynamicImports: [], unsupportedExports: [], error: 'ESM parse error: ' + message };
  }
}

function declaredExportNames(declaration: AstNode | null | undefined): string[] {
  if (!declaration) return [];
  if ((declaration.type === 'FunctionDeclaration' || declaration.type === 'ClassDeclaration') && declaration.id?.name) {
    return [declaration.id.name];
  }
  if (declaration.type === 'VariableDeclaration') {
    const names: string[] = [];
    for (const decl of declaration.declarations || []) {
      collectPatternNames(decl.id, names);
    }
    return names;
  }
  return [];
}

function collectPatternNames(pattern: AstNode | null | undefined, names: string[]): void {
  if (!pattern) return;
  if (pattern.type === 'Identifier') {
    names.push(pattern.name);
  } else if (pattern.type === 'ObjectPattern') {
    for (const prop of pattern.properties || []) {
      collectPatternNames(prop.value || prop.argument, names);
    }
  } else if (pattern.type === 'ArrayPattern') {
    for (const item of pattern.elements || []) {
      collectPatternNames(item, names);
    }
  } else if (pattern.type === 'AssignmentPattern') {
    collectPatternNames(pattern.left, names);
  } else if (pattern.type === 'RestElement') {
    collectPatternNames(pattern.argument, names);
  }
}

function walkAST(node: AstNode | null | undefined, visitor: (node: AstNode) => void, parent: AstNode | null = null): void {
  if (!node || typeof node !== 'object') return;
  if (node.type) {
    node._parent = parent;
    visitor(node);
    delete node._parent;
  }
  for (const key of Object.keys(node)) {
    if (key === '_parent') continue;
    const child = node[key];
    if (Array.isArray(child)) {
      for (const c of child) {
        if (c && typeof c === 'object' && c.type) walkAST(c, visitor, node);
      }
    } else if (child && typeof child === 'object' && child.type) {
      walkAST(child, visitor, node);
    }
  }
}

function checkHighEntropyStrings(ast: AstNode): Finding | null {
  const longStrings: string[] = [];
  walkAST(ast, (node: AstNode): void => {
    if (node.type === 'Literal' && typeof node.value === 'string' && node.value.length >= 80) {
      longStrings.push(node.value);
    }
  });
  if (!longStrings.length) return null;

  let maxEntropy = 0;
  let maxStr: string = longStrings[0]!;
  for (const s of longStrings) {
    const entropy: number = calculateEntropy(s);
    if (entropy > maxEntropy) {
      maxEntropy = entropy;
      maxStr = s;
    }
  }
  const threshold: number = maxStr.length >= 200 ? 4.5 : 5.2;
  if (maxEntropy <= threshold) return null;
  return {
    id: 'high-entropy',
    label: 'High-entropy string detected',
    category: 'obfuscation',
    desc: `Found ${longStrings.length} long string(s) with high randomness (entropy: ${maxEntropy.toFixed(1)})`,
    risk: 20,
    count: longStrings.length,
    adjustedRisk: 20
  };
}

function mergeTextInline(base: string, local: string, remote: string): MergeResult {
  if (base == null || local == null || remote == null) return { error: 'Missing merge inputs' };
  if (local === remote) return { merged: local, conflicts: false };
  if (local === base) return { merged: remote, conflicts: false };
  if (remote === base) return { merged: local, conflicts: false };

  try {
    const diff = getDiff();
    const merged = diff.merge(local, remote, base) as { hunks?: Array<{ lines?: Array<unknown> }> };
    const hasConflicts = Array.isArray(merged.hunks) && merged.hunks.some((hunk) =>
      Array.isArray(hunk.lines) && hunk.lines.some((line) => typeof line === 'object' && line !== null && (line as { conflict?: unknown }).conflict)
    );

    if (hasConflicts) {
      return { merged: resolveWithMarkers(local, remote), conflicts: true };
    }

    const mergedText = diff.applyPatch(base, merged);
    if (mergedText === false) {
      return { merged: resolveWithMarkers(local, remote), conflicts: true };
    }
    return { merged: mergedText, conflicts: false };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return { merged: resolveWithMarkers(local, remote), conflicts: true, error: message };
  }
}

function resolveWithMarkers(local: string, remote: string): string {
  return [
    '<<<<<<< LOCAL (your device)',
    local,
    '=======',
    remote,
    '>>>>>>> REMOTE (cloud)'
  ].join('\n');
}

function analyze(code: string): AnalysisResult {
  const findings: Finding[] = [];
  let totalRisk: number = 0;
  const strippedCode: string = code
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  for (const pattern of patterns) {
    pattern.regex.lastIndex = 0;
    const matches: RegExpMatchArray | null = strippedCode.match(pattern.regex);
    if (matches && matches.length > 0) {
      const count: number = matches.length;
      const adjustedRisk: number = Math.min(pattern.risk * Math.min(count, 3), pattern.risk * 3);
      totalRisk += adjustedRisk;
      findings.push({ id: pattern.id, label: pattern.label, category: pattern.category, desc: pattern.desc, risk: pattern.risk, count, adjustedRisk });
    }
  }
  const longStrings: RegExpMatchArray | null = strippedCode.match(/['"][^'"]{80,}['"]/g);
  if (longStrings && longStrings.length > 0) {
    let maxEntropy = 0;
    let maxStr: string = longStrings[0]!;
    for (const s of longStrings) {
      const entropy: number = calculateEntropy(s);
      if (entropy > maxEntropy) {
        maxEntropy = entropy;
        maxStr = s;
      }
    }
    const threshold: number = maxStr.length >= 200 ? 4.5 : 5.2;
    if (maxEntropy > threshold) {
      findings.push({ id: 'high-entropy', label: 'High-entropy string detected', category: 'obfuscation', desc: `Found ${longStrings.length} long string(s) with high randomness (entropy: ${maxEntropy.toFixed(1)})`, risk: 20, count: longStrings.length, adjustedRisk: 20 });
      totalRisk += 20;
    }
  }
  const riskLevel: string = totalRisk >= 80 ? 'high' : totalRisk >= 40 ? 'medium' : totalRisk >= 15 ? 'low' : 'minimal';
  const categories: Record<string, Finding[]> = {};
  for (const f of findings) {
    if (!categories[f.category]) categories[f.category] = [];
    categories[f.category]!.push(f);
  }
  return { totalRisk: Math.min(totalRisk, 100), riskLevel, findings, categories, summary: generateSummary(riskLevel, findings), astAnalyzed: false };
}

function calculateEntropy(str: string): number {
  const freq: Record<string, number> = {};
  for (const ch of str) freq[ch] = (freq[ch] ?? 0) + 1;
  let entropy: number = 0;
  const len: number = str.length;
  for (const count of Object.values(freq)) {
    const p: number = count / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function generateSummary(riskLevel: string, findings: Finding[]): string {
  if (!findings.length) return 'No suspicious patterns detected.';
  const cats: string[] = [...new Set(findings.map((f: Finding) => f.category))];
  const catLabels: Record<string, string> = { execution: 'dynamic code execution', data: 'data access', network: 'network activity', fingerprint: 'device fingerprinting', obfuscation: 'code obfuscation', mining: 'potential mining', hijack: 'page manipulation', deprecated: 'deprecated API usage' };
  return `Found ${findings.length} pattern(s) involving ${cats.map((c: string) => catLabels[c] ?? c).join(', ')}.`;
}

interface ScriptAnalyzerShape {
  analyzeAsync: typeof analyzeAsync;
  analyzeESMImports: typeof analyzeESMImports;
  mergeText: typeof mergeText;
  _ensureOffscreen: typeof _ensureOffscreen;
  _supportsOffscreen: typeof _supportsOffscreen;
  _offscreenPromise: Promise<boolean> | null;
  _inlineLibraryPromises: Record<string, Promise<void> | undefined>;
  patterns: typeof patterns;
  analyze: typeof analyze;
  calculateEntropy: typeof calculateEntropy;
  generateSummary: typeof generateSummary;
}

export const ScriptAnalyzer: ScriptAnalyzerShape = {
  analyzeAsync,
  analyzeESMImports,
  mergeText,
  _ensureOffscreen,
  _supportsOffscreen,
  _offscreenPromise: null,
  _inlineLibraryPromises: {},
  patterns,
  analyze,
  calculateEntropy,
  generateSummary,
};
