// ScriptVault Offscreen Document v1.7.8
// Handles CPU-intensive tasks off the service worker:
//   - AST-based script analysis (via Acorn)
//   - 3-way text merge for sync conflict resolution
//   - ZIP processing
//   - Future: WASM language services

'use strict';

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  // Only accept messages from our own extension
  if (_sender.id !== chrome.runtime.id) return false;
  switch (msg.type) {
    case 'offscreen_analyze':
      sendResponse(handleAnalyze(msg.code));
      break;
    case 'offscreen_merge':
      sendResponse(handleMerge(msg.base, msg.local, msg.remote));
      break;
    case 'offscreen_diff':
      sendResponse(handleDiff(msg.oldCode, msg.newCode));
      break;
    case 'offscreen_ping':
      sendResponse({ ok: true });
      break;
    default:
      return false;
  }
  return false; // synchronous response
});

// ── AST Analyzer ─────────────────────────────────────────────────────────────
// Uses Acorn to walk the AST and detect risk patterns with full context awareness.
// Advantages over regex: no false positives from comments/strings, detects
// call chains, understands scope, can infer data flow between statements.

const RISK_PATTERNS = [
  // ── Execution ──────────────────────────────────────────────────────
  {
    id: 'eval', label: 'eval() call', risk: 30, category: 'execution',
    desc: 'Dynamic code execution can run arbitrary code',
    match: node => node.type === 'CallExpression' && isIdent(node.callee, 'eval')
  },
  {
    id: 'function-ctor', label: 'new Function()', risk: 30, category: 'execution',
    desc: 'Creates functions from strings, equivalent to eval',
    match: node => node.type === 'NewExpression' && isIdent(node.callee, 'Function')
  },
  {
    id: 'settimeout-str', label: 'setTimeout with string', risk: 20, category: 'execution',
    desc: 'String argument to setTimeout acts like eval',
    match: node => node.type === 'CallExpression' && isIdent(node.callee, 'setTimeout') && node.arguments[0]?.type === 'Literal' && typeof node.arguments[0].value === 'string'
  },
  {
    id: 'setinterval-str', label: 'setInterval with string', risk: 20, category: 'execution',
    desc: 'String argument to setInterval acts like eval',
    match: node => node.type === 'CallExpression' && isIdent(node.callee, 'setInterval') && node.arguments[0]?.type === 'Literal' && typeof node.arguments[0].value === 'string'
  },
  {
    id: 'document-write', label: 'document.write()', risk: 10, category: 'execution',
    desc: 'Can overwrite entire page content',
    match: node => node.type === 'CallExpression' && isMember(node.callee, 'document', 'write')
  },
  {
    id: 'innerhtml-assign', label: 'innerHTML assignment', risk: 5, category: 'execution',
    desc: 'Can inject HTML including scripts (XSS risk)',
    match: node => (node.type === 'AssignmentExpression' || node.type === 'AssignmentPattern') && node.left?.property?.name === 'innerHTML'
  },

  // ── Data access ────────────────────────────────────────────────────
  {
    id: 'cookie-access', label: 'Cookie access', risk: 25, category: 'data',
    desc: 'Can read or modify browser cookies',
    match: node => node.type === 'MemberExpression' && isMember(node, 'document', 'cookie')
  },
  {
    id: 'localstorage', label: 'localStorage access', risk: 10, category: 'data',
    desc: 'Reads or writes persistent page data',
    match: node => node.type === 'CallExpression' && node.callee?.type === 'MemberExpression' && isIdent(node.callee.object, 'localStorage') && ['getItem','setItem','removeItem'].includes(node.callee?.property?.name)
  },
  {
    id: 'sessionstorage', label: 'sessionStorage access', risk: 5, category: 'data',
    desc: 'Reads or writes session data',
    match: node => node.type === 'CallExpression' && node.callee?.type === 'MemberExpression' && isIdent(node.callee.object, 'sessionStorage') && ['getItem','setItem','removeItem'].includes(node.callee?.property?.name)
  },
  {
    id: 'indexeddb', label: 'IndexedDB access', risk: 10, category: 'data',
    desc: 'Opens browser database',
    match: node => node.type === 'CallExpression' && isMember(node.callee, 'indexedDB', 'open')
  },

  // ── Network ────────────────────────────────────────────────────────
  {
    id: 'fetch-call', label: 'fetch() call', risk: 10, category: 'network',
    desc: 'Makes network requests (same-origin)',
    match: node => node.type === 'CallExpression' && isIdent(node.callee, 'fetch')
  },
  {
    id: 'xhr-open', label: 'XMLHttpRequest', risk: 10, category: 'network',
    desc: 'Makes network requests via XHR',
    match: node => (node.type === 'NewExpression' && isIdent(node.callee, 'XMLHttpRequest')) || (node.type === 'CallExpression' && node.callee?.property?.name === 'open' && node.arguments[0]?.type === 'Literal' && /^(GET|POST|PUT|DELETE|PATCH|HEAD)$/i.test(node.arguments[0].value))
  },
  {
    id: 'websocket', label: 'WebSocket', risk: 20, category: 'network',
    desc: 'Opens persistent connection to a server',
    match: node => node.type === 'NewExpression' && isIdent(node.callee, 'WebSocket')
  },
  {
    id: 'beacon', label: 'sendBeacon()', risk: 15, category: 'network',
    desc: 'Sends data to a server, often used for tracking',
    match: node => node.type === 'CallExpression' && isMember(node.callee, 'navigator', 'sendBeacon')
  },

  // ── Fingerprinting ─────────────────────────────────────────────────
  {
    id: 'canvas-fp', label: 'Canvas fingerprinting', risk: 20, category: 'fingerprint',
    desc: 'Can generate unique device fingerprint via canvas',
    match: node => node.type === 'CallExpression' && ['toDataURL','getImageData'].includes(node.callee?.property?.name)
  },
  {
    id: 'webgl-fp', label: 'WebGL fingerprinting', risk: 20, category: 'fingerprint',
    desc: 'Can identify GPU for device fingerprinting',
    match: node => node.type === 'CallExpression' && node.callee?.property?.name === 'getExtension' && node.arguments[0]?.type === 'Literal' && String(node.arguments[0].value).startsWith('WEBGL')
  },
  {
    id: 'audio-fp', label: 'Audio fingerprinting', risk: 15, category: 'fingerprint',
    desc: 'Can generate audio-based device fingerprint',
    match: node => node.type === 'NewExpression' && ['AudioContext','OfflineAudioContext'].includes(node.callee?.name)
  },
  {
    id: 'navigator-props', label: 'Navigator property access', risk: 5, category: 'fingerprint',
    desc: 'Reads browser/device information',
    match: node => node.type === 'MemberExpression' && isIdent(node.object, 'navigator') && ['platform','userAgent','language','hardwareConcurrency','deviceMemory','plugins'].includes(node.property?.name)
  },

  // ── Obfuscation ────────────────────────────────────────────────────
  {
    id: 'atob-long', label: 'Large base64 decode', risk: 25, category: 'obfuscation',
    desc: 'Decodes large embedded base64 data (possible obfuscation)',
    match: node => node.type === 'CallExpression' && isIdent(node.callee, 'atob') && node.arguments[0]?.type === 'Literal' && typeof node.arguments[0].value === 'string' && node.arguments[0].value.length >= 100
  },
  {
    id: 'char-fromcode', label: 'String.fromCharCode chain', risk: 15, category: 'obfuscation',
    desc: 'Building strings from char codes (obfuscation technique)',
    match: node => node.type === 'CallExpression' && isMember(node.callee, 'String', 'fromCharCode') && node.arguments.length > 5
  },

  // ── Crypto mining ──────────────────────────────────────────────────
  {
    id: 'wasm-module', label: 'WebAssembly usage', risk: 15, category: 'mining',
    desc: 'WebAssembly can be used for crypto mining',
    match: node => node.type === 'CallExpression' && node.callee?.type === 'MemberExpression' && isIdent(node.callee.object, 'WebAssembly') && ['instantiate','compile','Module'].includes(node.callee?.property?.name)
  },
  {
    id: 'worker-creation', label: 'Web Worker creation', risk: 10, category: 'mining',
    desc: 'Workers can run background computations',
    match: node => node.type === 'NewExpression' && isIdent(node.callee, 'Worker')
  },

  // ── DOM hijacking ──────────────────────────────────────────────────
  {
    id: 'form-submit', label: 'Form auto-submit', risk: 15, category: 'hijack',
    desc: 'Automatically submits forms',
    match: node => node.type === 'CallExpression' && node.callee?.property?.name === 'submit' && node.arguments.length === 0
  },
  {
    id: 'window-open', label: 'window.open()', risk: 5, category: 'hijack',
    desc: 'Opens new windows/popups',
    match: node => node.type === 'CallExpression' && isMember(node.callee, 'window', 'open')
  },
  {
    id: 'location-assign', label: 'Page redirect', risk: 10, category: 'hijack',
    desc: 'Redirects the page to another URL',
    match: node => (node.type === 'AssignmentExpression' && (isMember(node.left, 'location', 'href') || isIdent(node.left, 'location'))) || (node.type === 'CallExpression' && node.callee?.type === 'MemberExpression' && isIdent(node.callee.object, 'location') && ['assign','replace'].includes(node.callee?.property?.name))
  },
  {
    id: 'event-prevent', label: 'Unload handler', risk: 10, category: 'hijack',
    desc: 'Prevents or intercepts page navigation',
    match: node => node.type === 'CallExpression' && node.callee?.property?.name === 'addEventListener' && node.arguments[0]?.type === 'Literal' && ['beforeunload','unload'].includes(node.arguments[0].value)
  },

  // ── Prototype / global pollution ────────────────────────────────────
  {
    id: 'proto-pollution', label: 'Prototype manipulation', risk: 25, category: 'hijack',
    desc: 'Modifying object prototypes can corrupt global state',
    match: node => (node.type === 'MemberExpression' && node.property?.name === '__proto__') || (node.type === 'CallExpression' && isMember(node.callee, 'Object', 'setPrototypeOf')) || (node.type === 'MemberExpression' && node.property?.name === 'prototype' && node.parent?.type === 'MemberExpression')
  },
  {
    id: 'document-domain', label: 'document.domain assignment', risk: 20, category: 'hijack',
    desc: 'Changing document.domain relaxes same-origin restrictions',
    match: node => node.type === 'AssignmentExpression' && isMember(node.left, 'document', 'domain')
  },
  {
    id: 'postmessage-wildcard', label: 'postMessage with wildcard origin', risk: 15, category: 'hijack',
    desc: 'Sending postMessage to any origin (*) can leak data to malicious frames',
    match: node => node.type === 'CallExpression' && node.callee?.property?.name === 'postMessage' && node.arguments[1]?.type === 'Literal' && node.arguments[1].value === '*'
  },
  {
    id: 'defineProperty-global', label: 'Global property definition', risk: 10, category: 'hijack',
    desc: 'Defining properties on the global object can interfere with page code',
    match: node => node.type === 'CallExpression' && isMember(node.callee, 'Object', 'defineProperty') && node.arguments[0]?.type === 'Identifier' && ['window','globalThis','self','unsafeWindow'].includes(node.arguments[0].name)
  },
];

function isIdent(node, name) {
  return node?.type === 'Identifier' && node.name === name;
}
function isMember(node, obj, prop) {
  return node?.type === 'MemberExpression' && isIdent(node.object, obj) && node.property?.name === prop;
}

function handleAnalyze(code) {
  try {
    return analyzeAST(code);
  } catch (e) {
    // AST parse failed — fall back to basic info
    return { totalRisk: 0, riskLevel: 'unknown', findings: [], categories: {}, summary: 'Parse error: ' + e.message, parseError: true };
  }
}

function analyzeAST(code) {
  let ast;
  try {
    ast = acorn.parse(code, { ecmaVersion: 2022, sourceType: 'script', allowHashBang: true });
  } catch (e) {
    // Try module mode
    ast = acorn.parse(code, { ecmaVersion: 2022, sourceType: 'module', allowHashBang: true });
  }

  const hits = new Map(); // pattern.id → count
  const hitNodes = new Map(); // pattern.id → first node info

  walkAST(ast, node => {
    for (const pattern of RISK_PATTERNS) {
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

  // Check for high-entropy string literals
  const entropyResult = checkHighEntropyStrings(ast);

  const findings = [];
  let totalRisk = 0;

  for (const pattern of RISK_PATTERNS) {
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

  const riskLevel = totalRisk >= 80 ? 'high' : totalRisk >= 40 ? 'medium' : totalRisk >= 15 ? 'low' : 'minimal';
  const categories = {};
  for (const f of findings) {
    if (!categories[f.category]) categories[f.category] = [];
    categories[f.category].push(f);
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

function walkAST(node, visitor, parent = null) {
  if (!node || typeof node !== 'object') return;
  if (node.type) {
    node.parent = parent;
    visitor(node);
  }
  for (const key of Object.keys(node)) {
    if (key === 'parent') continue;
    const child = node[key];
    if (Array.isArray(child)) {
      for (const c of child) { if (c && typeof c === 'object' && c.type) walkAST(c, visitor, node); }
    } else if (child && typeof child === 'object' && child.type) {
      walkAST(child, visitor, node);
    }
  }
}

function checkHighEntropyStrings(ast) {
  const longStrings = [];
  walkAST(ast, node => {
    if (node.type === 'Literal' && typeof node.value === 'string' && node.value.length >= 80) {
      longStrings.push(node.value);
    }
  });
  if (!longStrings.length) return null;
  const entropy = calculateEntropy(longStrings[0]);
  // Shorter strings need higher entropy to flag; longer strings are suspicious at lower entropy
  const threshold = longStrings[0].length >= 200 ? 4.5 : 5.2;
  if (entropy <= threshold) return null;
  return {
    id: 'high-entropy',
    label: 'High-entropy string detected',
    category: 'obfuscation',
    desc: `Found ${longStrings.length} long string(s) with high randomness (entropy: ${entropy.toFixed(1)})`,
    risk: 20,
    count: longStrings.length,
    adjustedRisk: 20
  };
}

function calculateEntropy(str) {
  const freq = {};
  for (const ch of str) freq[ch] = (freq[ch] || 0) + 1;
  let entropy = 0;
  const len = str.length;
  for (const count of Object.values(freq)) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function generateSummary(riskLevel, findings) {
  if (!findings.length) return 'No suspicious patterns detected.';
  const cats = [...new Set(findings.map(f => f.category))];
  const catLabels = { execution: 'dynamic code execution', data: 'data access', network: 'network activity', fingerprint: 'device fingerprinting', obfuscation: 'code obfuscation', mining: 'potential mining', hijack: 'page manipulation' };
  return `Found ${findings.length} pattern(s) involving ${cats.map(c => catLabels[c] || c).join(', ')}.`;
}

// ── 3-way Text Merge ──────────────────────────────────────────────────────────
// Uses diff.js's merge() to reconcile concurrent edits to the same script.
// Called by background during sync when both local and remote have changes
// since the last known common ancestor (tracked via script.syncBase).

function handleMerge(base, local, remote) {
  if (!base || !local || !remote) return { error: 'Missing merge inputs' };
  if (local === remote) return { merged: local, conflicts: false };
  if (local === base) return { merged: remote, conflicts: false };
  if (remote === base) return { merged: local, conflicts: false };

  try {
    // Diff computes local patch and remote patch against base, then merges
    const localPatch = Diff.structuredPatch('base', 'local', base, local, '', '', { context: 3 });
    const remotePatch = Diff.structuredPatch('base', 'remote', base, remote, '', '', { context: 3 });
    const merged = Diff.merge(localPatch, remotePatch, base);
    const hasConflicts = merged.conflict === true || (Array.isArray(merged.hunks) && merged.hunks.some(h => h.conflict));

    if (hasConflicts) {
      // Produce conflict markers like git
      const result = resolveWithMarkers(base, local, remote);
      return { merged: result, conflicts: true };
    }

    // Convert merged patch object back to string
    const mergedText = Diff.applyPatch(base, merged);
    if (mergedText === false) {
      // Patch apply failed — produce conflict markers
      return { merged: resolveWithMarkers(base, local, remote), conflicts: true };
    }
    return { merged: mergedText, conflicts: false };
  } catch (e) {
    return { merged: resolveWithMarkers(base, local, remote), conflicts: true, error: e.message };
  }
}

function resolveWithMarkers(base, local, remote) {
  // Line-level diff to find where they diverge
  const localDiff = Diff.diffLines(base, local);
  const remoteDiff = Diff.diffLines(base, remote);

  // Simple approach: mark the whole thing as conflicted for user resolution
  return [
    '<<<<<<< LOCAL (your device)',
    local,
    '=======',
    remote,
    '>>>>>>> REMOTE (cloud)'
  ].join('\n');
}

// ── Diff ──────────────────────────────────────────────────────────────────────
function handleDiff(oldCode, newCode) {
  try {
    const patches = Diff.diffLines(oldCode || '', newCode || '');
    const stats = { added: 0, removed: 0, unchanged: 0 };
    for (const p of patches) {
      if (p.added) stats.added += p.count;
      else if (p.removed) stats.removed += p.count;
      else stats.unchanged += p.count;
    }
    return { patches, stats };
  } catch (e) {
    return { error: e.message };
  }
}
