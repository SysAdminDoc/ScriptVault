import { describe, it, expect } from 'vitest';

// Re-implement the analyzer for testing (extracted from bg/analyzer.js)

const patterns = [
  { id: 'eval', regex: /\beval\s*\(/g, label: 'eval() call', risk: 30, category: 'execution' },
  { id: 'function-ctor', regex: /\bnew\s+Function\s*\(/g, label: 'new Function()', risk: 30, category: 'execution' },
  { id: 'settimeout-str', regex: /setTimeout\s*\(\s*['\"`]/g, label: 'setTimeout with string', risk: 20, category: 'execution' },
  { id: 'setinterval-str', regex: /setInterval\s*\(\s*['\"`]/g, label: 'setInterval with string', risk: 20, category: 'execution' },
  { id: 'document-write', regex: /document\.write\s*\(/g, label: 'document.write()', risk: 10, category: 'execution' },
  { id: 'innerhtml-assign', regex: /\.innerHTML\s*=/g, label: 'innerHTML assignment', risk: 5, category: 'execution' },
  { id: 'cookie-access', regex: /document\.cookie/g, label: 'Cookie access', risk: 25, category: 'data' },
  { id: 'localstorage', regex: /localStorage\.(get|set|remove)Item/g, label: 'localStorage access', risk: 10, category: 'data' },
  { id: 'sessionstorage', regex: /sessionStorage\.(get|set|remove)Item/g, label: 'sessionStorage access', risk: 5, category: 'data' },
  { id: 'indexeddb', regex: /indexedDB\.open/g, label: 'IndexedDB access', risk: 10, category: 'data' },
  { id: 'fetch-call', regex: /\bfetch\s*\(/g, label: 'fetch() call', risk: 10, category: 'network' },
  { id: 'xhr-open', regex: /XMLHttpRequest|\.open\s*\(\s*['""](?:GET|POST|PUT|DELETE)/gi, label: 'XMLHttpRequest', risk: 10, category: 'network' },
  { id: 'websocket', regex: /new\s+WebSocket\s*\(/g, label: 'WebSocket', risk: 20, category: 'network' },
  { id: 'beacon', regex: /navigator\.sendBeacon/g, label: 'sendBeacon()', risk: 15, category: 'network' },
  { id: 'canvas-fp', regex: /\.toDataURL\s*\(|\.getImageData\s*\(/g, label: 'Canvas fingerprinting', risk: 20, category: 'fingerprint' },
  { id: 'webgl-fp', regex: /getExtension\s*\(\s*['""]WEBGL/g, label: 'WebGL fingerprinting', risk: 20, category: 'fingerprint' },
  { id: 'audio-fp', regex: /AudioContext|OfflineAudioContext/g, label: 'Audio fingerprinting', risk: 15, category: 'fingerprint' },
  { id: 'navigator-props', regex: /navigator\.(platform|userAgent|language|hardwareConcurrency|deviceMemory|plugins)/g, label: 'Navigator property access', risk: 5, category: 'fingerprint' },
  { id: 'atob-long', regex: /atob\s*\(\s*['""][A-Za-z0-9+/=]{100,}['"]\s*\)/g, label: 'Large base64 decode', risk: 25, category: 'obfuscation' },
  { id: 'hex-escape', regex: /\\x[0-9a-fA-F]{2}(?:\\x[0-9a-fA-F]{2}){10,}/g, label: 'Hex escape sequences', risk: 20, category: 'obfuscation' },
  { id: 'char-fromcode', regex: /String\.fromCharCode\s*\([^)]{20,}\)/g, label: 'String.fromCharCode chain', risk: 15, category: 'obfuscation' },
  { id: 'wasm-mining', regex: /WebAssembly\.(instantiate|compile|Module)/g, label: 'WebAssembly usage', risk: 15, category: 'mining' },
  { id: 'worker-creation', regex: /new\s+Worker\s*\(/g, label: 'Web Worker creation', risk: 10, category: 'mining' },
  { id: 'form-submit', regex: /\.submit\s*\(\s*\)/g, label: 'Form auto-submit', risk: 15, category: 'hijack' },
  { id: 'window-open', regex: /window\.open\s*\(/g, label: 'window.open()', risk: 5, category: 'hijack' },
  { id: 'location-assign', regex: /(?:window\.|document\.)?location\s*=|location\.(?:href|assign|replace)\s*=/g, label: 'Page redirect', risk: 10, category: 'hijack' },
  { id: 'event-prevent', regex: /addEventListener\s*\(\s*['""](?:beforeunload|unload)['"]/g, label: 'Unload handler', risk: 10, category: 'hijack' },
  { id: 'proto-pollution', regex: /__proto__|Object\.setPrototypeOf\s*\(|prototype\[/g, label: 'Prototype manipulation', risk: 25, category: 'hijack' },
  { id: 'document-domain', regex: /document\.domain\s*=/g, label: 'document.domain assignment', risk: 20, category: 'hijack' },
  { id: 'postmessage-noorigin', regex: /postMessage\s*\([^,)]+,\s*['"]\*['"]/g, label: 'postMessage with wildcard origin', risk: 15, category: 'hijack' },
  { id: 'defineProperty-global', regex: /Object\.defineProperty\s*\(\s*(?:window|globalThis|self|unsafeWindow)\s*,/g, label: 'Global property definition', risk: 10, category: 'hijack' },
];

function testPattern(id, code) {
  const p = patterns.find(x => x.id === id);
  p.regex.lastIndex = 0;
  return p.regex.test(code);
}

function countMatches(id, code) {
  const p = patterns.find(x => x.id === id);
  p.regex.lastIndex = 0;
  const m = code.match(p.regex);
  return m ? m.length : 0;
}

// ── Execution patterns ────────────────────────────────────────────────────

describe('Analyzer: execution patterns', () => {
  it('detects eval()', () => {
    expect(testPattern('eval', 'eval("code")')).toBe(true);
  });

  it('detects eval with whitespace', () => {
    expect(testPattern('eval', 'eval  ("code")')).toBe(true);
  });

  it('does not match "medieval"', () => {
    expect(testPattern('eval', 'medieval')).toBe(false);
  });

  it('detects new Function()', () => {
    expect(testPattern('function-ctor', 'new Function("return 1")')).toBe(true);
  });

  it('detects setTimeout with string arg', () => {
    expect(testPattern('settimeout-str', 'setTimeout("alert(1)", 100)')).toBe(true);
  });

  it('does not flag setTimeout with function arg', () => {
    expect(testPattern('settimeout-str', 'setTimeout(function(){}, 100)')).toBe(false);
  });

  it('detects setInterval with string arg', () => {
    expect(testPattern('setinterval-str', "setInterval('tick()', 1000)")).toBe(true);
  });

  it('detects document.write()', () => {
    expect(testPattern('document-write', 'document.write("<h1>hi</h1>")')).toBe(true);
  });

  it('detects innerHTML assignment', () => {
    expect(testPattern('innerhtml-assign', 'el.innerHTML = "<b>x</b>"')).toBe(true);
  });
});

// ── Data access patterns ──────────────────────────────────────────────────

describe('Analyzer: data access patterns', () => {
  it('detects document.cookie read', () => {
    expect(testPattern('cookie-access', 'var c = document.cookie')).toBe(true);
  });

  it('detects localStorage.getItem', () => {
    expect(testPattern('localstorage', 'localStorage.getItem("key")')).toBe(true);
  });

  it('detects localStorage.setItem', () => {
    expect(testPattern('localstorage', 'localStorage.setItem("key", "val")')).toBe(true);
  });

  it('detects localStorage.removeItem', () => {
    expect(testPattern('localstorage', 'localStorage.removeItem("key")')).toBe(true);
  });

  it('detects sessionStorage.getItem', () => {
    expect(testPattern('sessionstorage', 'sessionStorage.getItem("k")')).toBe(true);
  });

  it('detects indexedDB.open', () => {
    expect(testPattern('indexeddb', 'indexedDB.open("mydb")')).toBe(true);
  });
});

// ── Network patterns ──────────────────────────────────────────────────────

describe('Analyzer: network patterns', () => {
  it('detects fetch()', () => {
    expect(testPattern('fetch-call', 'fetch("/api/data")')).toBe(true);
  });

  it('detects XMLHttpRequest', () => {
    expect(testPattern('xhr-open', 'new XMLHttpRequest()')).toBe(true);
  });

  it('detects new WebSocket', () => {
    expect(testPattern('websocket', 'new WebSocket("wss://example.com")')).toBe(true);
  });

  it('detects navigator.sendBeacon', () => {
    expect(testPattern('beacon', 'navigator.sendBeacon("/log", data)')).toBe(true);
  });
});

// ── Fingerprinting patterns ───────────────────────────────────────────────

describe('Analyzer: fingerprinting patterns', () => {
  it('detects canvas toDataURL', () => {
    expect(testPattern('canvas-fp', 'canvas.toDataURL()')).toBe(true);
  });

  it('detects canvas getImageData', () => {
    expect(testPattern('canvas-fp', 'ctx.getImageData(0,0,w,h)')).toBe(true);
  });

  it('detects AudioContext', () => {
    expect(testPattern('audio-fp', 'new AudioContext()')).toBe(true);
  });

  it('detects OfflineAudioContext', () => {
    expect(testPattern('audio-fp', 'new OfflineAudioContext(1, 44100, 44100)')).toBe(true);
  });

  it('detects navigator.userAgent', () => {
    expect(testPattern('navigator-props', 'var ua = navigator.userAgent')).toBe(true);
  });

  it('detects navigator.platform', () => {
    expect(testPattern('navigator-props', 'navigator.platform')).toBe(true);
  });
});

// ── Obfuscation patterns ─────────────────────────────────────────────────

describe('Analyzer: obfuscation patterns', () => {
  it('detects long String.fromCharCode chain', () => {
    const code = 'String.fromCharCode(72,101,108,108,111,32,87,111,114,108,100)';
    expect(testPattern('char-fromcode', code)).toBe(true);
  });

  it('does not flag short String.fromCharCode', () => {
    const code = 'String.fromCharCode(65)';
    expect(testPattern('char-fromcode', code)).toBe(false);
  });
});

// ── Hijack patterns ───────────────────────────────────────────────────────

describe('Analyzer: hijack patterns', () => {
  it('detects form.submit()', () => {
    expect(testPattern('form-submit', 'form.submit()')).toBe(true);
  });

  it('detects window.open()', () => {
    expect(testPattern('window-open', 'window.open("https://example.com")')).toBe(true);
  });

  it('detects location assignment', () => {
    expect(testPattern('location-assign', 'location.href = "http://evil.com"')).toBe(true);
  });

  it('detects window.location assignment', () => {
    expect(testPattern('location-assign', 'window.location = "/new"')).toBe(true);
  });

  it('detects __proto__ access', () => {
    expect(testPattern('proto-pollution', 'obj.__proto__.polluted = true')).toBe(true);
  });

  it('detects Object.setPrototypeOf', () => {
    expect(testPattern('proto-pollution', 'Object.setPrototypeOf(obj, proto)')).toBe(true);
  });

  it('detects prototype[] bracket access', () => {
    expect(testPattern('proto-pollution', 'Constructor.prototype["method"] = fn')).toBe(true);
  });

  it('detects document.domain assignment', () => {
    expect(testPattern('document-domain', 'document.domain = "example.com"')).toBe(true);
  });

  it('detects postMessage with wildcard origin', () => {
    expect(testPattern('postmessage-noorigin', 'window.postMessage(data, "*")')).toBe(true);
  });

  it('detects Object.defineProperty on window', () => {
    expect(testPattern('defineProperty-global', 'Object.defineProperty(window, "x", {value:1})')).toBe(true);
  });

  it('detects Object.defineProperty on globalThis', () => {
    expect(testPattern('defineProperty-global', 'Object.defineProperty(globalThis, "x", {})')).toBe(true);
  });

  it('detects beforeunload handler', () => {
    expect(testPattern('event-prevent', 'addEventListener("beforeunload", fn)')).toBe(true);
  });

  it('detects unload handler', () => {
    expect(testPattern('event-prevent', 'addEventListener("unload", fn)')).toBe(true);
  });
});

// ── Mining patterns ───────────────────────────────────────────────────────

describe('Analyzer: mining patterns', () => {
  it('detects WebAssembly.instantiate', () => {
    expect(testPattern('wasm-mining', 'WebAssembly.instantiate(bytes)')).toBe(true);
  });

  it('detects WebAssembly.compile', () => {
    expect(testPattern('wasm-mining', 'WebAssembly.compile(buffer)')).toBe(true);
  });

  it('detects new Worker', () => {
    expect(testPattern('worker-creation', 'new Worker("worker.js")')).toBe(true);
  });
});

// ── Multiple match counting ───────────────────────────────────────────────

describe('Analyzer: match counting', () => {
  it('counts multiple eval calls', () => {
    expect(countMatches('eval', 'eval("a"); eval("b"); eval("c")')).toBe(3);
  });

  it('counts multiple fetch calls', () => {
    expect(countMatches('fetch-call', 'fetch("/a"); fetch("/b")')).toBe(2);
  });
});

// ── Re-implement analyze() for testing (extracted from bg/analyzer.js) ────

function calculateEntropy(str) {
  const freq = {};
  for (const ch of str) freq[ch] = (freq[ch] || 0) + 1;
  let entropy = 0;
  const len = str.length;
  for (const count of Object.values(freq)) { const p = count / len; entropy -= p * Math.log2(p); }
  return entropy;
}

function generateSummary(riskLevel, findings) {
  if (!findings.length) return 'No suspicious patterns detected.';
  const cats = [...new Set(findings.map(f => f.category))];
  const catLabels = { execution: 'dynamic code execution', data: 'data access', network: 'network activity', fingerprint: 'device fingerprinting', obfuscation: 'code obfuscation', mining: 'potential mining', hijack: 'page manipulation' };
  return `Found ${findings.length} pattern(s) involving ${cats.map(c => catLabels[c] || c).join(', ')}.`;
}

function analyze(code) {
  const findings = [];
  let totalRisk = 0;
  const strippedCode = code.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const pattern of patterns) {
    pattern.regex.lastIndex = 0;
    const matches = strippedCode.match(pattern.regex);
    if (matches && matches.length > 0) {
      const count = matches.length;
      const adjustedRisk = Math.min(pattern.risk * Math.min(count, 3), pattern.risk * 3);
      totalRisk += adjustedRisk;
      findings.push({ id: pattern.id, label: pattern.label, category: pattern.category, risk: pattern.risk, count, adjustedRisk });
    }
  }
  const longStrings = strippedCode.match(/['"][^'"]{80,}['"]/g);
  if (longStrings && longStrings.length > 0) {
    const entropy = calculateEntropy(longStrings[0]);
    const threshold = longStrings[0].length >= 200 ? 4.5 : 5.2;
    if (entropy > threshold) {
      findings.push({ id: 'high-entropy', label: 'High-entropy string detected', category: 'obfuscation', risk: 20, count: longStrings.length, adjustedRisk: 20 });
      totalRisk += 20;
    }
  }
  const riskLevel = totalRisk >= 80 ? 'high' : totalRisk >= 40 ? 'medium' : totalRisk >= 15 ? 'low' : 'minimal';
  const categories = {};
  for (const f of findings) {
    if (!categories[f.category]) categories[f.category] = [];
    categories[f.category].push(f);
  }
  return { totalRisk: Math.min(totalRisk, 100), riskLevel, findings, categories, summary: generateSummary(riskLevel, findings), astAnalyzed: false };
}

// ── analyze() integration tests ───────────────────────────────────────────

describe('Analyzer: analyze() function', () => {
  it('returns minimal risk for clean code', () => {
    const result = analyze('var x = 1 + 2;');
    expect(result.riskLevel).toBe('minimal');
    expect(result.totalRisk).toBe(0);
    expect(result.findings).toHaveLength(0);
    expect(result.astAnalyzed).toBe(false);
  });

  it('returns a summary string', () => {
    const result = analyze('eval("code")');
    expect(result.summary).toContain('pattern');
    expect(result.summary).toContain('execution');
  });

  it('groups findings by category', () => {
    const result = analyze('eval("a"); fetch("/b")');
    expect(result.categories.execution).toBeDefined();
    expect(result.categories.network).toBeDefined();
    expect(result.categories.execution.length).toBeGreaterThanOrEqual(1);
  });

  it('caps totalRisk at 100', () => {
    // Stack many high-risk patterns to exceed 100
    const code = 'eval("a"); eval("b"); eval("c"); new Function("x"); new Function("y"); new Function("z"); document.cookie; document.cookie; document.cookie;';
    const result = analyze(code);
    expect(result.totalRisk).toBeLessThanOrEqual(100);
  });
});

// ── Comment stripping tests ───────────────────────────────────────────────

describe('Analyzer: comment stripping', () => {
  it('does not match patterns inside single-line comments', () => {
    const code = '// eval("this is a comment")\nvar x = 1;';
    const result = analyze(code);
    const evalFinding = result.findings.find(f => f.id === 'eval');
    expect(evalFinding).toBeUndefined();
  });

  it('does not match patterns inside block comments', () => {
    const code = '/* eval("commented out") */\nvar x = 1;';
    const result = analyze(code);
    const evalFinding = result.findings.find(f => f.id === 'eval');
    expect(evalFinding).toBeUndefined();
  });

  it('does not match patterns inside multi-line block comments', () => {
    const code = '/*\n  fetch("/api")\n  document.cookie\n*/\nvar x = 1;';
    const result = analyze(code);
    expect(result.findings).toHaveLength(0);
  });

  it('still detects patterns in real code alongside comments', () => {
    const code = '// eval("comment")\neval("real code")';
    const result = analyze(code);
    const evalFinding = result.findings.find(f => f.id === 'eval');
    expect(evalFinding).toBeDefined();
    expect(evalFinding.count).toBe(1);
  });
});

// ── High-entropy string detection ─────────────────────────────────────────

describe('Analyzer: high-entropy string detection', () => {
  it('detects a high-entropy long string (randomized)', () => {
    // Generate a string with high randomness (many distinct characters)
    const randomChars = 'aB3$xZ9!kL7@mN2#pQ5&rT8*uW1^yA4%cE6(fH0)jK';
    const highEntropyStr = Array.from({ length: 120 }, (_, i) => randomChars[i % randomChars.length]).join('');
    const code = `var s = "${highEntropyStr}";`;
    const result = analyze(code);
    const entropyFinding = result.findings.find(f => f.id === 'high-entropy');
    expect(entropyFinding).toBeDefined();
  });

  it('does not flag a low-entropy long string (repeated chars)', () => {
    const lowEntropyStr = 'a'.repeat(120);
    const code = `var s = "${lowEntropyStr}";`;
    const result = analyze(code);
    const entropyFinding = result.findings.find(f => f.id === 'high-entropy');
    expect(entropyFinding).toBeUndefined();
  });
});

// ── Risk level thresholds ─────────────────────────────────────────────────

describe('Analyzer: risk level thresholds', () => {
  it('returns "minimal" for totalRisk < 15', () => {
    // innerHTML assignment = risk 5
    const result = analyze('el.innerHTML = "hi"');
    expect(result.totalRisk).toBeLessThan(15);
    expect(result.riskLevel).toBe('minimal');
  });

  it('returns "low" for totalRisk >= 15 and < 40', () => {
    // eval = 30 risk → totalRisk = 30
    const result = analyze('eval("x")');
    expect(result.totalRisk).toBeGreaterThanOrEqual(15);
    expect(result.totalRisk).toBeLessThan(40);
    expect(result.riskLevel).toBe('low');
  });

  it('returns "medium" for totalRisk >= 40 and < 80', () => {
    // eval(30) + new Function(30) = 60
    const result = analyze('eval("x"); new Function("y")');
    expect(result.totalRisk).toBeGreaterThanOrEqual(40);
    expect(result.totalRisk).toBeLessThan(80);
    expect(result.riskLevel).toBe('medium');
  });

  it('returns "high" for totalRisk >= 80', () => {
    // eval(30) + new Function(30) + document.cookie(25) = 85
    const result = analyze('eval("x"); new Function("y"); document.cookie;');
    expect(result.totalRisk).toBeGreaterThanOrEqual(80);
    expect(result.riskLevel).toBe('high');
  });
});
