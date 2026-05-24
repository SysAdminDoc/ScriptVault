// ============================================================================
// Generated from src/bg/analyzer.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const ScriptAnalyzer = (() => {
  const module = { exports: {} };
  const exports = module.exports;
  "use strict";
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/bg/analyzer.ts
  var analyzer_exports = {};
  __export(analyzer_exports, {
    ScriptAnalyzer: () => ScriptAnalyzer
  });
  module.exports = __toCommonJS(analyzer_exports);
  function debugLogSafe(...args) {
    const maybeDebugLog = globalThis.debugLog;
    if (typeof maybeDebugLog === "function") {
      maybeDebugLog(...args);
    }
  }
  async function analyzeAsync(code) {
    try {
      await _ensureOffscreen();
      const result = await chrome.runtime.sendMessage({ type: "offscreen_analyze", code });
      if (result && !result.parseError) return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      debugLogSafe("[Analyzer] Offscreen failed, using regex fallback:", message);
    }
    return analyze(code);
  }
  async function _ensureOffscreen() {
    const offscreen = chrome.offscreen;
    if (!offscreen) throw new Error("Offscreen API not available");
    if (!ScriptAnalyzer._offscreenPromise) {
      ScriptAnalyzer._offscreenPromise = (async () => {
        const existing = await offscreen.hasDocument().catch(() => false);
        if (!existing) {
          await chrome.offscreen.createDocument({
            url: chrome.runtime.getURL("offscreen.html"),
            reasons: ["DOM_SCRAPING"],
            justification: "AST-based script analysis with Acorn parser"
          });
        }
      })().catch((e) => {
        ScriptAnalyzer._offscreenPromise = null;
        throw e;
      });
    }
    return ScriptAnalyzer._offscreenPromise;
  }
  var patterns = [
    { id: "eval", regex: /\beval\s*\(/g, label: "eval() call", risk: 30, category: "execution", desc: "Dynamic code execution can run arbitrary code" },
    { id: "function-ctor", regex: /\bnew\s+Function\s*\(/g, label: "new Function()", risk: 30, category: "execution", desc: "Creates functions from strings, equivalent to eval" },
    { id: "settimeout-str", regex: /setTimeout\s*\(\s*['\"`]/g, label: "setTimeout with string", risk: 20, category: "execution", desc: "String argument to setTimeout acts like eval" },
    { id: "setinterval-str", regex: /setInterval\s*\(\s*['\"`]/g, label: "setInterval with string", risk: 20, category: "execution", desc: "String argument to setInterval acts like eval" },
    { id: "document-write", regex: /document\.write\s*\(/g, label: "document.write()", risk: 10, category: "execution", desc: "Can overwrite entire page content" },
    { id: "innerhtml-assign", regex: /\.innerHTML\s*=/g, label: "innerHTML assignment", risk: 5, category: "execution", desc: "Can inject HTML including scripts (XSS risk)" },
    { id: "cookie-access", regex: /document\.cookie/g, label: "Cookie access", risk: 25, category: "data", desc: "Can read or modify browser cookies" },
    { id: "localstorage", regex: /localStorage\.(get|set|remove)Item/g, label: "localStorage access", risk: 10, category: "data", desc: "Reads or writes persistent page data" },
    { id: "sessionstorage", regex: /sessionStorage\.(get|set|remove)Item/g, label: "sessionStorage access", risk: 5, category: "data", desc: "Reads or writes session data" },
    { id: "indexeddb", regex: /indexedDB\.open/g, label: "IndexedDB access", risk: 10, category: "data", desc: "Opens browser database" },
    { id: "fetch-call", regex: /\bfetch\s*\(/g, label: "fetch() call", risk: 10, category: "network", desc: "Makes network requests (same-origin)" },
    { id: "xhr-open", regex: /XMLHttpRequest|\.open\s*\(\s*['""](?:GET|POST|PUT|DELETE)/gi, label: "XMLHttpRequest", risk: 10, category: "network", desc: "Makes network requests" },
    { id: "websocket", regex: /new\s+WebSocket\s*\(/g, label: "WebSocket", risk: 20, category: "network", desc: "Opens persistent connection to a server" },
    { id: "beacon", regex: /navigator\.sendBeacon/g, label: "sendBeacon()", risk: 15, category: "network", desc: "Sends data to a server, often used for tracking" },
    { id: "canvas-fp", regex: /\.toDataURL\s*\(|\.getImageData\s*\(/g, label: "Canvas fingerprinting", risk: 20, category: "fingerprint", desc: "Can generate unique device fingerprint via canvas" },
    { id: "webgl-fp", regex: /getExtension\s*\(\s*['""]WEBGL/g, label: "WebGL fingerprinting", risk: 20, category: "fingerprint", desc: "Can identify GPU for device fingerprinting" },
    { id: "audio-fp", regex: /AudioContext|OfflineAudioContext/g, label: "Audio fingerprinting", risk: 15, category: "fingerprint", desc: "Can generate audio-based device fingerprint" },
    { id: "navigator-props", regex: /navigator\.(platform|userAgent|language|hardwareConcurrency|deviceMemory|plugins)/g, label: "Navigator property access", risk: 5, category: "fingerprint", desc: "Reads browser/device information" },
    { id: "atob-long", regex: /atob\s*\(\s*['""][A-Za-z0-9+/=]{100,}['"]\s*\)/g, label: "Large base64 decode", risk: 25, category: "obfuscation", desc: "Decodes large embedded base64 data (possible obfuscation)" },
    { id: "hex-escape", regex: /\\x[0-9a-fA-F]{2}(?:\\x[0-9a-fA-F]{2}){10,}/g, label: "Hex escape sequences", risk: 20, category: "obfuscation", desc: "Long hex-encoded strings suggest obfuscated code" },
    { id: "char-fromcode", regex: /String\.fromCharCode\s*\([^)]{20,}\)/g, label: "String.fromCharCode chain", risk: 15, category: "obfuscation", desc: "Building strings from char codes (obfuscation technique)" },
    { id: "wasm-mining", regex: /WebAssembly\.(instantiate|compile|Module)/g, label: "WebAssembly usage", risk: 15, category: "mining", desc: "WebAssembly can be used for crypto mining" },
    { id: "worker-creation", regex: /new\s+Worker\s*\(/g, label: "Web Worker creation", risk: 10, category: "mining", desc: "Workers can run background computations" },
    { id: "form-submit", regex: /\.submit\s*\(\s*\)/g, label: "Form auto-submit", risk: 15, category: "hijack", desc: "Automatically submits forms" },
    { id: "window-open", regex: /window\.open\s*\(/g, label: "window.open()", risk: 5, category: "hijack", desc: "Opens new windows/popups" },
    { id: "location-assign", regex: /(?:window\.|document\.)?location\s*=|location\.(?:href|assign|replace)\s*=/g, label: "Page redirect", risk: 10, category: "hijack", desc: "Redirects the page to another URL" },
    { id: "event-prevent", regex: /addEventListener\s*\(\s*['""](?:beforeunload|unload)['"]/g, label: "Unload handler", risk: 10, category: "hijack", desc: "Prevents or intercepts page navigation" },
    { id: "proto-pollution", regex: /__proto__|Object\.setPrototypeOf\s*\(|prototype\[/g, label: "Prototype manipulation", risk: 25, category: "hijack", desc: "Modifying object prototypes can corrupt global state and affect other scripts" },
    { id: "document-domain", regex: /document\.domain\s*=/g, label: "document.domain assignment", risk: 20, category: "hijack", desc: "Changing document.domain relaxes same-origin restrictions" },
    { id: "postmessage-noorigin", regex: /postMessage\s*\([^,)]+,\s*['"]\*['"]/g, label: "postMessage with wildcard origin", risk: 15, category: "hijack", desc: "Sending postMessage to any origin (* target) can leak data to malicious frames" },
    { id: "defineProperty-global", regex: /Object\.defineProperty\s*\(\s*(?:window|globalThis|self|unsafeWindow)\s*,/g, label: "Global property definition", risk: 10, category: "hijack", desc: "Defining properties on the global object can interfere with page code" }
  ];
  function analyze(code) {
    const findings = [];
    let totalRisk = 0;
    const strippedCode = code.replace(/(^|[^:])\/\/.*$/gm, "$1").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const pattern of patterns) {
      pattern.regex.lastIndex = 0;
      const matches = strippedCode.match(pattern.regex);
      if (matches && matches.length > 0) {
        const count = matches.length;
        const adjustedRisk = Math.min(pattern.risk * Math.min(count, 3), pattern.risk * 3);
        totalRisk += adjustedRisk;
        findings.push({ id: pattern.id, label: pattern.label, category: pattern.category, desc: pattern.desc, risk: pattern.risk, count, adjustedRisk });
      }
    }
    const longStrings = strippedCode.match(/['"][^'"]{80,}['"]/g);
    if (longStrings && longStrings.length > 0) {
      let maxEntropy = 0;
      let maxStr = longStrings[0];
      for (const s of longStrings) {
        const entropy = calculateEntropy(s);
        if (entropy > maxEntropy) {
          maxEntropy = entropy;
          maxStr = s;
        }
      }
      const threshold = maxStr.length >= 200 ? 4.5 : 5.2;
      if (maxEntropy > threshold) {
        findings.push({ id: "high-entropy", label: "High-entropy string detected", category: "obfuscation", desc: `Found ${longStrings.length} long string(s) with high randomness (entropy: ${maxEntropy.toFixed(1)})`, risk: 20, count: longStrings.length, adjustedRisk: 20 });
        totalRisk += 20;
      }
    }
    const riskLevel = totalRisk >= 80 ? "high" : totalRisk >= 40 ? "medium" : totalRisk >= 15 ? "low" : "minimal";
    const categories = {};
    for (const f of findings) {
      if (!categories[f.category]) categories[f.category] = [];
      categories[f.category].push(f);
    }
    return { totalRisk: Math.min(totalRisk, 100), riskLevel, findings, categories, summary: generateSummary(riskLevel, findings), astAnalyzed: false };
  }
  function calculateEntropy(str) {
    const freq = {};
    for (const ch of str) freq[ch] = (freq[ch] ?? 0) + 1;
    let entropy = 0;
    const len = str.length;
    for (const count of Object.values(freq)) {
      const p = count / len;
      entropy -= p * Math.log2(p);
    }
    return entropy;
  }
  function generateSummary(riskLevel, findings) {
    if (!findings.length) return "No suspicious patterns detected.";
    const cats = [...new Set(findings.map((f) => f.category))];
    const catLabels = { execution: "dynamic code execution", data: "data access", network: "network activity", fingerprint: "device fingerprinting", obfuscation: "code obfuscation", mining: "potential mining", hijack: "page manipulation" };
    return `Found ${findings.length} pattern(s) involving ${cats.map((c) => catLabels[c] ?? c).join(", ")}.`;
  }
  var ScriptAnalyzer = {
    analyzeAsync,
    _ensureOffscreen,
    _offscreenPromise: null,
    patterns,
    analyze,
    calculateEntropy,
    generateSummary
  };
  return module.exports.default || module.exports.ScriptAnalyzer || module.exports;
})();
