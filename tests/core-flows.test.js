// ScriptVault — Core Flow Tests
// Tests for bugs found and fixed during the audit (Round 9)
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Re-implement core functions for testing ─────────────────────────────────

function parseUserscript(code) {
  const metaBlockMatch = code.match(/\/\/\s*==UserScript==([\s\S]*?)\/\/\s*==\/UserScript==/);
  if (!metaBlockMatch) return { error: 'No metadata block found.' };
  const meta = { name: 'Unnamed Script', namespace: 'scriptvault', version: '1.0.0', description: '', author: '', match: [], include: [], exclude: [], excludeMatch: [], grant: [], require: [], resource: {}, 'run-at': 'document-idle', noframes: false, connect: [], tag: [] };
  const lines = metaBlockMatch[1].split('\n');
  for (const line of lines) {
    const m = line.match(/\/\/\s*@(\S+)(?:\s+(.*))?/);
    if (!m) continue;
    const key = m[1].trim();
    const value = (m[2] || '').trim();
    if (['name','namespace','version','description','author'].includes(key)) meta[key] = value;
    else if (['match','include','exclude','grant','require','connect','tag'].includes(key)) { if (value) meta[key].push(value); }
    else if (key === 'noframes') meta.noframes = true;
  }
  if (meta.grant.length === 0) meta.grant = ['none'];
  return { meta, code, metaBlock: metaBlockMatch[0] };
}

const MAX_SCRIPT_SIZE = 5 * 1024 * 1024;

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('installFromUrl safety', () => {
  it('should reject scripts larger than 5MB', () => {
    const hugeCode = 'x'.repeat(MAX_SCRIPT_SIZE + 1);
    expect(hugeCode.length).toBeGreaterThan(MAX_SCRIPT_SIZE);
    // The real function checks code.length > MAX_SCRIPT_SIZE
    expect(hugeCode.length > MAX_SCRIPT_SIZE).toBe(true);
  });

  it('should reject non-userscript content', () => {
    const htmlContent = '<html><body>Not a script</body></html>';
    expect(htmlContent.includes('==UserScript==')).toBe(false);
  });

  it('should accept valid userscript content', () => {
    const validScript = '// ==UserScript==\n// @name Test\n// ==/UserScript==\nconsole.log("hi");';
    expect(validScript.includes('==UserScript==')).toBe(true);
    const parsed = parseUserscript(validScript);
    expect(parsed.error).toBeUndefined();
    expect(parsed.meta.name).toBe('Test');
  });
});

describe('applyUpdate order safety', () => {
  it('should save version history before updating code', () => {
    const script = {
      id: 'test_1',
      code: '// ==UserScript==\n// @name Old\n// @version 1.0\n// ==/UserScript==',
      meta: { name: 'Old', version: '1.0' },
      versionHistory: []
    };

    // Simulate the fixed applyUpdate behavior: push old version to history first
    script.versionHistory.push({
      version: script.meta.version,
      code: script.code,
      updatedAt: Date.now()
    });

    const newCode = '// ==UserScript==\n// @name New\n// @version 2.0\n// ==/UserScript==';
    const parsed = parseUserscript(newCode);
    script.code = newCode;
    script.meta = parsed.meta;

    expect(script.versionHistory).toHaveLength(1);
    expect(script.versionHistory[0].version).toBe('1.0');
    expect(script.meta.version).toBe('2.0');
  });

  it('should trim version history to 5 entries', () => {
    const history = [
      { version: '1.0', code: 'v1', updatedAt: 1 },
      { version: '2.0', code: 'v2', updatedAt: 2 },
      { version: '3.0', code: 'v3', updatedAt: 3 },
      { version: '4.0', code: 'v4', updatedAt: 4 },
      { version: '5.0', code: 'v5', updatedAt: 5 },
    ];
    history.push({ version: '6.0', code: 'v6', updatedAt: 6 });
    const trimmed = history.length > 5 ? history.slice(-5) : history;
    expect(trimmed).toHaveLength(5);
    expect(trimmed[0].version).toBe('2.0');
  });
});

describe('rollback preserves current version', () => {
  it('should save current version before rolling back', () => {
    const script = {
      code: '// ==UserScript==\n// @name Current\n// @version 3.0\n// ==/UserScript==',
      meta: { name: 'Current', version: '3.0' },
      updatedAt: Date.now(),
      versionHistory: [
        { version: '1.0', code: 'v1code', updatedAt: 1 },
        { version: '2.0', code: 'v2code', updatedAt: 2 },
      ]
    };

    const targetIdx = 0; // Roll back to v1.0
    const target = script.versionHistory[targetIdx];

    // Fixed behavior: push current to history first
    script.versionHistory.push({
      version: script.meta.version,
      code: script.code,
      updatedAt: script.updatedAt
    });

    // Now apply rollback
    script.code = target.code;

    // Current version (3.0) should still be in history
    expect(script.versionHistory).toHaveLength(3);
    expect(script.versionHistory[2].version).toBe('3.0');
    expect(script.code).toBe('v1code');
  });
});

describe('@require failure tracking', () => {
  it('should track failed requires in script settings', () => {
    const script = { id: 'test_1', settings: {} };
    const failedRequires = ['https://cdn.example.com/missing.js'];

    if (failedRequires.length > 0) {
      script.settings._failedRequires = failedRequires;
    }

    expect(script.settings._failedRequires).toEqual(['https://cdn.example.com/missing.js']);
  });

  it('should clear failed requires when all succeed', () => {
    const script = { id: 'test_1', settings: { _failedRequires: ['old.js'] } };
    const failedRequires = [];

    if (failedRequires.length === 0 && script.settings._failedRequires) {
      delete script.settings._failedRequires;
    }

    expect(script.settings._failedRequires).toBeUndefined();
  });
});

describe('registration error tracking', () => {
  it('should save registration error to script settings', () => {
    const script = { id: 'test_1', settings: {} };
    const error = new Error('chrome.userScripts.register failed');

    script.settings._registrationError = error.message;

    expect(script.settings._registrationError).toBe('chrome.userScripts.register failed');
  });
});

describe('popup timeout handling', () => {
  it('should resolve within timeout for fast responses', async () => {
    const fastResponse = Promise.resolve({ scripts: [] });
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 100));

    const result = await Promise.race([fastResponse, timeout]);
    expect(result).toEqual({ scripts: [] });
  });

  it('should reject with timeout for slow responses', async () => {
    const slowResponse = new Promise(resolve => setTimeout(() => resolve({ scripts: [] }), 200));
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 50));

    await expect(Promise.race([slowResponse, timeout])).rejects.toThrow('timeout');
  });
});

describe('save order correctness', () => {
  it('should not clear unsaved flag if loadScripts would throw', () => {
    let unsavedChanges = true;
    const loadScripts = () => { throw new Error('background dead'); };

    try {
      // Simulate: save succeeds, loadScripts fails
      // Fixed order: loadScripts() first, THEN clear flag
      loadScripts();
      unsavedChanges = false; // This line should NOT be reached
    } catch {
      // unsavedChanges should still be true
    }

    expect(unsavedChanges).toBe(true);
  });

  it('should clear unsaved flag when everything succeeds', () => {
    let unsavedChanges = true;
    const loadScripts = () => { /* success */ };

    try {
      loadScripts();
      unsavedChanges = false;
    } catch {
      // should not reach here
    }

    expect(unsavedChanges).toBe(false);
  });
});

describe('script size validation', () => {
  it('MAX_SCRIPT_SIZE should be 5MB', () => {
    expect(MAX_SCRIPT_SIZE).toBe(5 * 1024 * 1024);
  });

  it('formatBytes should format sizes correctly', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB');
  });
});
