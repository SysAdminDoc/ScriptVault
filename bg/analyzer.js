// ScriptVault - Static Analysis Engine
// Scans userscript code for suspicious or dangerous patterns

const ScriptAnalyzer = {
  // Pattern definitions with risk weights
  patterns: [
    // Code execution
    { id: 'eval', regex: /\beval\s*\(/g, label: 'eval() call', risk: 30, category: 'execution', desc: 'Dynamic code execution can run arbitrary code' },
    { id: 'function-ctor', regex: /\bnew\s+Function\s*\(/g, label: 'new Function()', risk: 30, category: 'execution', desc: 'Creates functions from strings, equivalent to eval' },
    { id: 'settimeout-str', regex: /setTimeout\s*\(\s*['"`]/g, label: 'setTimeout with string', risk: 20, category: 'execution', desc: 'String argument to setTimeout acts like eval' },
    { id: 'setinterval-str', regex: /setInterval\s*\(\s*['"`]/g, label: 'setInterval with string', risk: 20, category: 'execution', desc: 'String argument to setInterval acts like eval' },
    { id: 'document-write', regex: /document\.write\s*\(/g, label: 'document.write()', risk: 10, category: 'execution', desc: 'Can overwrite entire page content' },
    { id: 'innerhtml-assign', regex: /\.innerHTML\s*=/g, label: 'innerHTML assignment', risk: 5, category: 'execution', desc: 'Can inject HTML including scripts (XSS risk)' },

    // Data access
    { id: 'cookie-access', regex: /document\.cookie/g, label: 'Cookie access', risk: 25, category: 'data', desc: 'Can read or modify browser cookies' },
    { id: 'localstorage', regex: /localStorage\.(get|set|remove)Item/g, label: 'localStorage access', risk: 10, category: 'data', desc: 'Reads or writes persistent page data' },
    { id: 'sessionstorage', regex: /sessionStorage\.(get|set|remove)Item/g, label: 'sessionStorage access', risk: 5, category: 'data', desc: 'Reads or writes session data' },
    { id: 'indexeddb', regex: /indexedDB\.open/g, label: 'IndexedDB access', risk: 10, category: 'data', desc: 'Opens browser database' },

    // Network
    { id: 'fetch-call', regex: /\bfetch\s*\(/g, label: 'fetch() call', risk: 10, category: 'network', desc: 'Makes network requests (same-origin)' },
    { id: 'xhr-open', regex: /XMLHttpRequest|\.open\s*\(\s*['"](?:GET|POST|PUT|DELETE)/gi, label: 'XMLHttpRequest', risk: 10, category: 'network', desc: 'Makes network requests' },
    { id: 'websocket', regex: /new\s+WebSocket\s*\(/g, label: 'WebSocket', risk: 20, category: 'network', desc: 'Opens persistent connection to a server' },
    { id: 'beacon', regex: /navigator\.sendBeacon/g, label: 'sendBeacon()', risk: 15, category: 'network', desc: 'Sends data to a server, often used for tracking' },

    // Fingerprinting
    { id: 'canvas-fp', regex: /\.toDataURL\s*\(|\.getImageData\s*\(/g, label: 'Canvas fingerprinting', risk: 20, category: 'fingerprint', desc: 'Can generate unique device fingerprint via canvas' },
    { id: 'webgl-fp', regex: /getExtension\s*\(\s*['"]WEBGL/g, label: 'WebGL fingerprinting', risk: 20, category: 'fingerprint', desc: 'Can identify GPU for device fingerprinting' },
    { id: 'audio-fp', regex: /AudioContext|OfflineAudioContext/g, label: 'Audio fingerprinting', risk: 15, category: 'fingerprint', desc: 'Can generate audio-based device fingerprint' },
    { id: 'navigator-props', regex: /navigator\.(platform|userAgent|language|hardwareConcurrency|deviceMemory|plugins)/g, label: 'Navigator property access', risk: 5, category: 'fingerprint', desc: 'Reads browser/device information' },

    // Obfuscation indicators
    { id: 'atob-long', regex: /atob\s*\(\s*['"][A-Za-z0-9+/=]{100,}['"]\s*\)/g, label: 'Large base64 decode', risk: 25, category: 'obfuscation', desc: 'Decodes large embedded base64 data (possible obfuscation)' },
    { id: 'hex-escape', regex: /\\x[0-9a-fA-F]{2}(?:\\x[0-9a-fA-F]{2}){10,}/g, label: 'Hex escape sequences', risk: 20, category: 'obfuscation', desc: 'Long hex-encoded strings suggest obfuscated code' },
    { id: 'char-fromcode', regex: /String\.fromCharCode\s*\([^)]{20,}\)/g, label: 'String.fromCharCode chain', risk: 15, category: 'obfuscation', desc: 'Building strings from char codes (obfuscation technique)' },

    // Crypto mining
    { id: 'wasm-mining', regex: /WebAssembly\.(instantiate|compile|Module)/g, label: 'WebAssembly usage', risk: 15, category: 'mining', desc: 'WebAssembly can be used for crypto mining' },
    { id: 'worker-creation', regex: /new\s+Worker\s*\(/g, label: 'Web Worker creation', risk: 10, category: 'mining', desc: 'Workers can run background computations' },

    // DOM clobbering / hijacking
    { id: 'form-submit', regex: /\.submit\s*\(\s*\)/g, label: 'Form auto-submit', risk: 15, category: 'hijack', desc: 'Automatically submits forms' },
    { id: 'window-open', regex: /window\.open\s*\(/g, label: 'window.open()', risk: 5, category: 'hijack', desc: 'Opens new windows/popups' },
    { id: 'location-assign', regex: /(?:window\.|document\.)?location\s*=|location\.(?:href|assign|replace)\s*=/g, label: 'Page redirect', risk: 10, category: 'hijack', desc: 'Redirects the page to another URL' },
    { id: 'event-prevent', regex: /addEventListener\s*\(\s*['"](?:beforeunload|unload)['"]/g, label: 'Unload handler', risk: 10, category: 'hijack', desc: 'Prevents or intercepts page navigation' },
  ],

  // Analyze a script and return findings
  analyze(code) {
    const findings = [];
    let totalRisk = 0;

    // Strip comments to reduce false positives
    const strippedCode = code
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');

    for (const pattern of this.patterns) {
      pattern.regex.lastIndex = 0;
      const matches = strippedCode.match(pattern.regex);
      if (matches && matches.length > 0) {
        const count = matches.length;
        const adjustedRisk = Math.min(pattern.risk * Math.min(count, 3), pattern.risk * 3); // Cap at 3x
        totalRisk += adjustedRisk;
        findings.push({
          id: pattern.id,
          label: pattern.label,
          category: pattern.category,
          desc: pattern.desc,
          risk: pattern.risk,
          count,
          adjustedRisk
        });
      }
    }

    // Check for high-entropy strings (possible obfuscation)
    const longStrings = strippedCode.match(/['"][^'"]{200,}['"]/g);
    if (longStrings && longStrings.length > 0) {
      const entropy = this.calculateEntropy(longStrings[0]);
      if (entropy > 4.5) {
        findings.push({
          id: 'high-entropy',
          label: 'High-entropy string detected',
          category: 'obfuscation',
          desc: `Found ${longStrings.length} long string(s) with high randomness (entropy: ${entropy.toFixed(1)})`,
          risk: 20,
          count: longStrings.length,
          adjustedRisk: 20
        });
        totalRisk += 20;
      }
    }

    // Calculate risk level
    const riskLevel = totalRisk >= 80 ? 'high' : totalRisk >= 40 ? 'medium' : totalRisk >= 15 ? 'low' : 'minimal';

    // Group findings by category
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
      summary: this.generateSummary(riskLevel, findings)
    };
  },

  calculateEntropy(str) {
    const freq = {};
    for (const ch of str) {
      freq[ch] = (freq[ch] || 0) + 1;
    }
    let entropy = 0;
    const len = str.length;
    for (const count of Object.values(freq)) {
      const p = count / len;
      entropy -= p * Math.log2(p);
    }
    return entropy;
  },

  generateSummary(riskLevel, findings) {
    if (findings.length === 0) return 'No suspicious patterns detected.';
    const cats = [...new Set(findings.map(f => f.category))];
    const catLabels = {
      execution: 'dynamic code execution',
      data: 'data access',
      network: 'network activity',
      fingerprint: 'device fingerprinting',
      obfuscation: 'code obfuscation',
      mining: 'potential mining',
      hijack: 'page manipulation'
    };
    const labels = cats.map(c => catLabels[c] || c).join(', ');
    return `Found ${findings.length} pattern(s) involving ${labels}.`;
  }
};
