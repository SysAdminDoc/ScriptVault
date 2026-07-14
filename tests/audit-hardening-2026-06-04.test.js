/**
 * Regression tests for the 2026-06-04 deep audit hardening pass.
 * Covers: internal-host-guard extensions, content bridge sanitization,
 * devtools panel fixes, popup null-safety, factory reset completeness,
 * trash restore tombstone cleanup, install permissions batching,
 * folder-color CSS injection, diff Uint32Array, sidepanel debounce.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

// ── Internal Host Guard — .localhost TLD + TEST-NET + Class E ────────────────

describe('InternalHostGuard hardening (2026-06-04)', () => {
  let isInternalHost;

  beforeEach(async () => {
    const code = fs.readFileSync(path.join(ROOT, 'modules/internal-host-guard.js'), 'utf8');
    const _body = code + '\nreturn InternalHostGuard;';
    let guard;
    try { const vm = require('node:vm'); guard = vm.compileFunction(_body, [], { filename: path.resolve(ROOT, 'modules/internal-host-guard.js') })(); } catch { guard = new Function(_body)(); }
    isInternalHost = guard.isInternalHost;
  });

  it('blocks .localhost TLD subdomains', () => {
    expect(isInternalHost('evil.localhost')).toBe(true);
    expect(isInternalHost('sub.deep.localhost')).toBe(true);
  });

  it('blocks TEST-NET-1/2/3 ranges', () => {
    expect(isInternalHost('192.0.2.1')).toBe(true);
    expect(isInternalHost('198.51.100.5')).toBe(true);
    expect(isInternalHost('203.0.113.254')).toBe(true);
  });

  it('blocks benchmarking range 198.18.0.0/15', () => {
    expect(isInternalHost('198.18.0.1')).toBe(true);
    expect(isInternalHost('198.19.255.254')).toBe(true);
  });

  it('blocks Class E reserved range (240+)', () => {
    expect(isInternalHost('240.0.0.1')).toBe(true);
    expect(isInternalHost('255.255.255.255')).toBe(true);
  });

  it('still allows normal public IPs', () => {
    expect(isInternalHost('8.8.8.8')).toBe(false);
    expect(isInternalHost('1.1.1.1')).toBe(false);
    expect(isInternalHost('greasyfork.org')).toBe(false);
  });
});

// ── Content bridge sanitization ──────────────────────────────────────────────

describe('content.js bridge telemetry sanitization (2026-06-04)', () => {
  it('content bridge maps page messages to bounded untrusted schemas', () => {
    const src = fs.readFileSync(path.join(ROOT, 'content.js'), 'utf8');
    expect(src).toContain('function normalizeBridgeTelemetry(action, value)');
    expect(src).toContain("action: 'recordBridgeTelemetry'");
    expect(src).toContain('BRIDGE_RATE_LIMIT = 60');
    expect(src).not.toContain('scriptId: data.scriptId');
    expect(src).not.toContain('scriptName: data.scriptName');
  });
});

// ── DevTools panel fixes ─────────────────────────────────────────────────────

describe('devtools-panel.js hardening (2026-06-04)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'pages/devtools-panel.js'), 'utf8');

  it('escapeHtml includes single-quote escape', () => {
    expect(src).toContain("'&#39;'");
  });

  it('has visibility-based interval cleanup', () => {
    expect(src).toContain('visibilitychange');
    expect(src).toContain('stopAutoRefresh');
  });

  it('$ helper tags stub elements for debugging', () => {
    expect(src).toContain('_dtStub');
  });
});

// ── Popup null-safety ────────────────────────────────────────────────────────

describe('popup.js null-safety (2026-06-04)', () => {
  it('guards scriptList classList/setAttribute inside if-block', () => {
    const src = fs.readFileSync(path.join(ROOT, 'pages/popup.js'), 'utf8');
    // After the fix, classList.remove('loading') is inside the if-block
    // Check that there's no bare `elements.scriptList.classList` outside an if-block
    // by verifying the pattern: if (elements.scriptList) { ... classList ...
    const lines = src.split('\n');
    let foundGuardedClassList = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('elements.scriptList') && lines[i].includes('{')) {
        // Look for classList in the next few lines within the block
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          if (lines[j].includes('classList.remove') && lines[j].includes('loading')) {
            foundGuardedClassList = true;
            break;
          }
        }
      }
    }
    expect(foundGuardedClassList).toBe(true);
  });
});

// ── Factory reset completeness ───────────────────────────────────────────────

describe('factoryReset cleanup (2026-06-04)', () => {
  it('clears all extension-owned storage, alarms, backups, and network rules', () => {
    const src = fs.readFileSync(path.join(ROOT, 'background.core.js'), 'utf8');
    const resetBlock = src.slice(
      src.indexOf('factoryReset: async () =>'),
      src.indexOf('backgroundActionRegistry.registerHandlers(DiagnosticsActionHandler', src.indexOf('factoryReset: async () =>'))
    );
    expect(resetBlock).toContain('await ScriptStorage.clear()');
    expect(resetBlock).toContain('await BackupsDAO.clear()');
    expect(resetBlock).toContain('await chrome.storage.local.clear()');
    expect(resetBlock).toContain('await chrome.storage.session.clear()');
    expect(resetBlock).toContain('await SettingsManager.reset()');
    expect(resetBlock).toContain('updateDynamicRules');
    expect(resetBlock).toContain('updateSessionRules');
    expect(resetBlock).toContain('await chrome.alarms.clearAll()');
  });
});

// ── Trash restore tombstone cleanup ──────────────────────────────────────────

describe('restoreFromTrash tombstone cleanup (2026-06-04)', () => {
  it('clears sync tombstone on restore', () => {
    const src = fs.readFileSync(path.join(ROOT, 'background.core.js'), 'utf8');
    const restoreBlock = src.slice(
      src.indexOf('restoreFromTrash: async scriptId'),
      src.indexOf('emptyTrash: async')
    );
    expect(restoreBlock).toContain('syncTombstones');
    expect(restoreBlock).toContain('delete tombstones[scriptId]');
    // The script must be persisted before it is removed from trash so an SW
    // crash mid-restore can't lose it from both stores.
    expect(restoreBlock.indexOf('ScriptStorage.set(script.id, script)'))
      .toBeLessThan(restoreBlock.indexOf('trash.splice(index, 1)'));
  });
});

// ── Install page permissions batching ────────────────────────────────────────

describe('install.js optional permissions batching (2026-06-04)', () => {
  it('batches needed permissions into a single request call', () => {
    const src = fs.readFileSync(path.join(ROOT, 'pages/install.js'), 'utf8');
    // Should have a single permissions.request with `needed` array
    expect(src).toContain('permissions.request({ permissions: needed })');
    // Should NOT have the old per-token request pattern
    expect(src).not.toContain('permissions.request({ permissions: [token] })');
  });
});

// ── Folder color CSS injection guard ─────────────────────────────────────────

describe('dashboard folder-color CSS guard (2026-06-04)', () => {
  it('validates folder.color against hex/named-color regex', () => {
    const src = fs.readFileSync(path.join(ROOT, 'pages/dashboard.js'), 'utf8');
    expect(src).toContain('#[0-9a-f]{3,8}');
    expect(src).toContain('#6b7280');
  });
});

// ── Diff LCS Uint32Array ─────────────────────────────────────────────────────

describe('dashboard diff LCS Uint32Array (2026-06-04)', () => {
  it('uses Uint32Array for LCS table to support >65k line files', () => {
    const src = fs.readFileSync(path.join(ROOT, 'pages/dashboard.js'), 'utf8');
    expect(src).toContain('new Uint32Array(m + 1)');
    expect(src).not.toContain('new Uint16Array(m + 1)');
  });
});

// ── Google OAuth revoke POST ─────────────────────────────────────────────────

describe('Google OAuth revoke uses POST (2026-06-04)', () => {
  it('sends token in POST body instead of query parameter', () => {
    const src = fs.readFileSync(path.join(ROOT, 'modules/sync-providers.js'), 'utf8');
    expect(src).toMatch(/method:\s*["']POST["']/);
    expect(src).toContain('application/x-www-form-urlencoded');
    expect(src).not.toContain('revoke?token=');
  });
});

// ── Google Drive file ID validation ──────────────────────────────────────────

describe('Google Drive file ID sanitization (2026-06-04)', () => {
  it('strips non-alphanumeric characters from file ID', () => {
    const src = fs.readFileSync(path.join(ROOT, 'modules/sync-providers.js'), 'utf8');
    expect(src).toContain('safeFileId');
    expect(src).toContain('/[^a-zA-Z0-9_-]/g');
  });
});
