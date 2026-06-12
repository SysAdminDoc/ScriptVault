// Smoke-tests for scripts/check-locales.mjs. The script is intentionally
// dependency-light so it can run in CI without booting the extension. These
// tests verify it produces a stable JSON report and that --check / --strict
// have the documented severity behavior.
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const SCRIPT = resolve(process.cwd(), 'scripts/check-locales.mjs');

function runReport(flags = []) {
  const stdout = execFileSync('node', [SCRIPT, '--json', ...flags], { encoding: 'utf8' });
  return JSON.parse(stdout);
}

describe('scripts/check-locales.mjs', () => {
  it('lists the same 8 locales across _locales and modules/i18n.js', () => {
    const report = runReport();
    expect(report.sources.localesDir).toEqual(['de', 'en', 'es', 'fr', 'ja', 'pt', 'ru', 'zh']);
    expect(report.sources.runtimeI18n).toEqual(['de', 'en', 'es', 'fr', 'ja', 'pt', 'ru', 'zh']);
    expect(report.sources.dashboardI18nV2).toBeUndefined();
  });

  it('reports zero drift for _locales/ key parity (the CI-gated source-of-truth)', () => {
    const report = runReport();
    const fatalKinds = new Set(['locale-json-error', 'locale-key-drift', 'cross-source-locale-mismatch']);
    const fatal = report.drifts.filter(d => fatalKinds.has(d.kind));
    expect(fatal).toEqual([]);
  });

  it('exits 0 in --check mode (no fatal drift)', () => {
    let exitCode = 0;
    try {
      execFileSync('node', [SCRIPT, '--check'], { encoding: 'utf8', stdio: 'pipe' });
    } catch (err) {
      exitCode = err.status || 1;
    }
    expect(exitCode).toBe(0);
  });

  it('exits 0 in --strict mode after runtime dictionary key parity backfill', () => {
    const report = runReport();
    expect(report.drifts.filter(d => d.kind === 'runtime-key-drift')).toEqual([]);

    let exitCode = 0;
    try {
      execFileSync('node', [SCRIPT, '--strict'], { encoding: 'utf8', stdio: 'pipe' });
    } catch (err) {
      exitCode = err.status || 1;
    }
    expect(exitCode).toBe(0);
  });

  it('translation-coverage warnings include explicit counts', () => {
    const report = runReport();
    for (const w of report.warnings) {
      expect(w).toHaveProperty('translated');
      expect(w).toHaveProperty('total');
      expect(w).toHaveProperty('untranslatedCount');
      expect(w.locale).not.toBe('en');
    }
  });
});
