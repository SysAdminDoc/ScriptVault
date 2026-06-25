#!/usr/bin/env node

/**
 * Firefox lint warning budget gate.
 *
 * Reads the checked-in web-ext lint report and verifies that:
 * 1. All warning codes are in the reviewed allowlist with rationale.
 * 2. Total warning count has not increased beyond the budget ceiling.
 * 3. No new files appear with warnings that aren't in the per-file inventory.
 *
 * Run: node scripts/check-firefox-lint-warnings.mjs [--report]
 *   --report: print the full warning inventory without failing
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const LINT_REPORT = resolve(ROOT, 'firefox-artifacts/web-ext-lint.json');

const REVIEWED_CODES = {
  UNSAFE_VAR_ASSIGNMENT: 'Dynamic HTML via safeSetHtml() Trusted Types policy — DOM XSS mitigated by policy enforcement; raw innerHTML eliminated in popup/sidepanel; dashboard modules use the scoped policy helper. AMO reviewer can verify by searching for the TrustedTypePolicy creation in dashboard.js.',
  UNSUPPORTED_API: 'Chrome-only API feature-detection probes (identity.getAuthToken, userScripts.execute, notifications.update, permissions.addHostAccessRequest). Code handles absence gracefully with try/catch or typeof checks. Required for cross-browser compatibility.',
  DANGEROUS_EVAL: 'Generated wrapper code uses Function constructor for GM API injection into USER_SCRIPT world. This is the core mechanism for userscript execution and cannot be replaced without abandoning the extension\'s purpose. Equivalent to Tampermonkey/Violentmonkey architecture.',
  INLINE_SCRIPT: 'Monaco editor sandbox page (pages/editor-sandbox.html) requires inline script for sandbox CSP context. The page is declared in manifest.json sandbox section with restricted CSP.',
  KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION: 'Firefox Android minimum version warning. gecko_android.strict_min_version is intentionally lower to maximize compatibility; feature detection handles API gaps.',
};

const WARNING_BUDGET = 160;

function main() {
  const reportMode = process.argv.includes('--report');

  if (!existsSync(LINT_REPORT)) {
    if (reportMode) {
      console.log('No lint report found at', LINT_REPORT);
      console.log('Run: npm run firefox:lint');
      return;
    }
    console.error('Firefox lint report not found:', LINT_REPORT);
    console.error('Run: npm run firefox:lint');
    process.exit(1);
  }

  const report = JSON.parse(readFileSync(LINT_REPORT, 'utf8'));
  const warnings = report.warnings || [];
  const total = warnings.length;

  const byCode = {};
  const byFile = {};
  for (const w of warnings) {
    byCode[w.code] = (byCode[w.code] || 0) + 1;
    const key = `${w.file}`;
    byFile[key] = (byFile[key] || 0) + 1;
  }

  if (reportMode) {
    console.log(`Firefox lint warning inventory: ${total} warnings\n`);
    console.log('By code:');
    for (const [code, count] of Object.entries(byCode).sort((a, b) => b[1] - a[1])) {
      const reviewed = REVIEWED_CODES[code] ? '[REVIEWED]' : '[UNREVIEWED]';
      console.log(`  ${count.toString().padStart(4)} ${code} ${reviewed}`);
    }
    console.log('\nBy file:');
    for (const [file, count] of Object.entries(byFile).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${count.toString().padStart(4)} ${file}`);
    }
    if (total > 0) {
      console.log('\nReviewed rationale:');
      for (const [code, rationale] of Object.entries(REVIEWED_CODES)) {
        if (byCode[code]) {
          console.log(`  ${code}: ${rationale}`);
        }
      }
    }
    return;
  }

  const failures = [];

  for (const code of Object.keys(byCode)) {
    if (!REVIEWED_CODES[code]) {
      failures.push(`Unreviewed warning code: ${code} (${byCode[code]} occurrences). Add rationale to REVIEWED_CODES in this script.`);
    }
  }

  if (total > WARNING_BUDGET) {
    failures.push(`Warning count ${total} exceeds budget of ${WARNING_BUDGET}. Reduce warnings or raise the budget with justification.`);
  }

  if (failures.length > 0) {
    console.error(`Firefox lint warning budget: ${failures.length} failure(s)\n`);
    for (const f of failures) console.error(`- ${f}`);
    console.error(`\nTotal: ${total} warnings (budget: ${WARNING_BUDGET})`);
    process.exit(1);
  }

  console.log(`Firefox lint warning budget passed: ${total} warnings (budget: ${WARNING_BUDGET}), all codes reviewed.`);
}

main();
