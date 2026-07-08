/**
 * Regression tests for the 2026-06-04 deep audit hardening pass — wave 2.
 * Covers: cloud sync post-merge upload, compareVersions pre-release,
 * installFromCode single-script register, parser resource proto-pollution,
 * theme editor import sanitization, chains _esc attribute escaping,
 * backup-scheduler prune-before-write ordering.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

// ── Cloud sync: post-merge upload from ScriptStorage ─────────────────────────

describe('cloud sync post-merge upload (2026-06-04 p2)', () => {
  it('rebuilds upload envelope from post-merge ScriptStorage.getAll()', () => {
    const src = fs.readFileSync(path.join(ROOT, 'modules/cloud-sync.js'), 'utf8');
    expect(src).toContain('postMergeScripts');
    expect(src).toContain('ScriptStorage.getAll()');
    expect(src).toContain('syncBaseCode: s.syncBaseCode');
  });

  it('includes syncBaseCode in first-sync upload envelope', () => {
    const src = fs.readFileSync(path.join(ROOT, 'modules/cloud-sync.js'), 'utf8');
    // First sync path should also include syncBaseCode. esbuild strips the
    // source comment, so anchor on the generated first-sync mapping.
    const firstSyncStart = src.indexOf('localData.scripts = localData.scripts.map');
    expect(firstSyncStart).toBeGreaterThan(-1);
    const firstSyncSection = src.slice(
      firstSyncStart,
      firstSyncStart + 500
    );
    expect(firstSyncSection).toContain('syncBaseCode');
  });
});

// ── compareVersions: pre-release lexicographic comparison ────────────────────

describe('compareVersions pre-release (2026-06-04 p2)', () => {
  it('compares pre-release identifiers lexicographically', () => {
    const src = fs.readFileSync(path.join(ROOT, 'background.core.js'), 'utf8');
    expect(src).toContain('if (preRelease1 && preRelease2)');
    expect(src).toContain("v1.replace(/^[^-]*-/, '')");
  });

  it('TS source mirrors the runtime fix', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/background/update-checker.ts'), 'utf8');
    expect(src).toContain('Both have pre-release suffixes');
    expect(src).toContain('return -1;');
    expect(src).toContain('return 1;');
  });

  it('install page update review uses the same pre-release ordering branch', () => {
    const src = fs.readFileSync(path.join(ROOT, 'pages/install.js'), 'utf8');
    expect(src).toContain('if (preRelease1 && preRelease2)');
    expect(src).toContain("version1.replace(/^[^-]*-/, '')");
    expect(src).toContain('Number.isNaN');
  });
});

// ── installFromCode: single-script register ──────────────────────────────────

describe('installFromCode single-script register (2026-06-04 p2)', () => {
  it('uses reregisterScript instead of registerAllScripts', () => {
    const src = fs.readFileSync(path.join(ROOT, 'background.core.js'), 'utf8');
    const startIdx = src.indexOf('async function installFromCode');
    const endIdx = src.indexOf('\nasync function', startIdx + 1);
    const installBlock = src.slice(startIdx, endIdx > startIdx ? endIdx : startIdx + 5000);
    expect(installBlock).toContain('await reregisterScript(script)');
    expect(installBlock).not.toContain('await registerAllScripts(true)');
  });
});

// ── Parser resource Object.create(null) ──────────────────────────────────────

describe('parser resource prototype-safe init (2026-06-04 p2)', () => {
  it('runtime parser uses Object.create(null) for resource', () => {
    const src = fs.readFileSync(path.join(ROOT, 'background.core.js'), 'utf8');
    expect(src).toContain('resource: Object.create(null)');
  });

  it('TS parser source uses Object.create(null) for resource', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/background/parser.ts'), 'utf8');
    expect(src).toContain('resource: Object.create(null)');
  });
});

// ── Theme editor import sanitization ─────────────────────────────────────────

describe('theme editor import sanitization (2026-06-04 p2)', () => {
  it('has _safeCssValue sanitizer', () => {
    const src = fs.readFileSync(path.join(ROOT, 'pages/dashboard-theme-editor.js'), 'utf8');
    expect(src).toContain('_safeCssValue');
    expect(src).toContain("url\\s*\\(");
  });

  it('validates imported vars start with -- prefix', () => {
    const src = fs.readFileSync(path.join(ROOT, 'pages/dashboard-theme-editor.js'), 'utf8');
    expect(src).toContain("k.startsWith('--')");
  });

  it('sanitizes font family on import', () => {
    const src = fs.readFileSync(path.join(ROOT, 'pages/dashboard-theme-editor.js'), 'utf8');
    expect(src).toContain("theme.fonts.family");
    expect(src).toContain("[{}<>\"';]");
  });
});

// ── Chains _esc attribute escaping ───────────────────────────────────────────

describe('chains _esc attribute escaping (2026-06-04 p2)', () => {
  it('escapes double quotes for attribute context', () => {
    const src = fs.readFileSync(path.join(ROOT, 'pages/dashboard-chains.js'), 'utf8');
    expect(src).toContain("'&quot;'");
    expect(src).toContain("'&#39;'");
  });
});

// ── Backup scheduler prune-before-write ──────────────────────────────────────

describe('backup scheduler prune ordering (2026-06-04 p2)', () => {
  it('prunes before writing new backup in runtime JS', () => {
    const src = fs.readFileSync(path.join(ROOT, 'modules/backup-scheduler.js'), 'utf8');
    const pruneIdx = src.indexOf('await BackupScheduler.pruneOldBackups()');
    const unshiftIdx = src.indexOf('backups.unshift(backup)');
    expect(pruneIdx).toBeGreaterThan(-1);
    expect(unshiftIdx).toBeGreaterThan(-1);
    expect(pruneIdx).toBeLessThan(unshiftIdx);
  });

  it('prunes before writing new backup in TS source', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/modules/backup-scheduler.ts'), 'utf8');
    const firstPrune = src.indexOf('Prune old backups BEFORE');
    expect(firstPrune).toBeGreaterThan(-1);
  });
});
