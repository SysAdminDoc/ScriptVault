#!/usr/bin/env node
// scripts/check-locales.mjs
//
// Locale coverage report and CI gate. Validates three things:
//   1. _locales/* JSON: every locale carries the same key set as `en`.
//   2. modules/i18n.js + pages/dashboard-i18n-v2.js inline translation
//      dictionaries: each locale carries the same keys as `en`, and the
//      locale list lines up with the on-disk _locales/ directories.
//   3. Cross-source locale set: _locales/, the runtime i18n module, and the
//      dashboard v2 module agree on which languages ScriptVault claims to
//      ship. A directory without runtime support, or a runtime locale that
//      has no _locales counterpart, is flagged.
//
// Usage:
//   node scripts/check-locales.mjs            # report
//   node scripts/check-locales.mjs --check    # exit 1 on any drift
//   node scripts/check-locales.mjs --json     # machine-readable output

import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createContext, runInContext } from 'node:vm';

const args = new Set(process.argv.slice(2));
const wantCheck = args.has('--check');
const wantStrict = args.has('--strict');
const wantJson = args.has('--json');

// Severities:
//   --check    => exits 1 on _locales/* key drift or cross-source locale set
//                 mismatches (the externally-shipped manifests).
//   --strict   => same as --check, plus fails on inline module-dict key drift
//                 (modules/i18n.js + pages/dashboard-i18n-v2.js). Use after a
//                 dedicated translation backfill.
//
// Translation-coverage shortfalls (value equals English) are always
// informational — they're useful to surface but not a CI failure.
const FATAL_KINDS = new Set([
  'locale-json-error',
  'locale-key-drift',
  'cross-source-locale-mismatch'
]);
const STRICT_KINDS = new Set([
  ...FATAL_KINDS,
  'runtime-key-drift',
  'dashboard-key-drift'
]);

const REPO_ROOT = process.cwd();

// --- _locales scan ----------------------------------------------------------
async function loadLocalesDir() {
  const root = join(REPO_ROOT, '_locales');
  const entries = await readdir(root);
  const locales = {};
  for (const name of entries) {
    const path = join(root, name);
    const info = await stat(path);
    if (!info.isDirectory()) continue;
    const messagesPath = join(path, 'messages.json');
    let messages;
    try {
      messages = JSON.parse(await readFile(messagesPath, 'utf8'));
    } catch (err) {
      messages = { __error: err.message || String(err) };
    }
    locales[name] = messages;
  }
  return locales;
}

// --- Inline-translations extractor -----------------------------------------
// Both modules/i18n.js and pages/dashboard-i18n-v2.js declare a
// translations object (`const` in handwritten sources, `var` in generated
// CommonJS wrappers).
// We evaluate just that const in an isolated VM context so we can read the
// resulting object without booting the full extension.
async function extractInlineTranslations(filePath, varName = 'translations') {
  const source = await readFile(filePath, 'utf8');
  const startMatch = source.match(new RegExp(`(?:const|let|var)\\s+${varName}\\s*=\\s*\\{`));
  if (!startMatch) {
    throw new Error(`No translations declaration found in ${filePath}`);
  }
  const start = startMatch.index + startMatch[0].length - 1; // include the {
  // Walk balanced braces to find the end of the object literal.
  let depth = 0;
  let end = -1;
  let inString = null;
  let escape = false;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (escape) { escape = false; continue; }
      if (ch === '\\') { escape = true; continue; }
      if (ch === inString) { inString = null; }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inString = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end === -1) {
    throw new Error(`Could not find end of translations object in ${filePath}`);
  }
  const literal = source.slice(start, end + 1);
  // Wrap in parentheses so the VM treats it as an expression.
  const sandbox = { result: null };
  const ctx = createContext(sandbox);
  runInContext(`result = (${literal});`, ctx);
  return sandbox.result;
}

function buildKeySet(obj) {
  return new Set(Object.keys(obj || {}));
}

function diffKeySets(canonical, other) {
  const missing = [...canonical].filter(k => !other.has(k));
  const orphaned = [...other].filter(k => !canonical.has(k));
  return { missing, orphaned };
}

function countTranslated(reference, other) {
  // For modules/i18n.js + dashboard-i18n-v2.js dictionaries (string-keyed),
  // count how many values are present and *differ from* the English version.
  // Equal-to-English strings are treated as untranslated.
  const enKeys = Object.keys(reference);
  let translated = 0;
  let same = 0;
  for (const k of enKeys) {
    if (!(k in other)) continue;
    if (reference[k] === other[k]) same++;
    else translated++;
  }
  return { translated, untranslatedCount: same, total: enKeys.length };
}

// --- Main runner ------------------------------------------------------------
const report = {
  generatedAt: new Date().toISOString(),
  sources: {},
  drifts: [],
  warnings: []
};

let localesDirData;
try {
  localesDirData = await loadLocalesDir();
} catch (err) {
  console.error(`[check-locales] Failed to read _locales/: ${err.message}`);
  process.exit(2);
}

const localesDirNames = Object.keys(localesDirData).sort();
report.sources.localesDir = localesDirNames;

const localesDirEnglish = localesDirData.en;
if (!localesDirEnglish) {
  console.error('[check-locales] _locales/en/messages.json missing — cannot anchor coverage.');
  process.exit(2);
}
const enLocaleKeys = buildKeySet(localesDirEnglish);

for (const name of localesDirNames) {
  if (name === 'en') continue;
  const msgs = localesDirData[name];
  if (msgs.__error) {
    report.drifts.push({ kind: 'locale-json-error', locale: name, error: msgs.__error });
    continue;
  }
  const otherKeys = buildKeySet(msgs);
  const { missing, orphaned } = diffKeySets(enLocaleKeys, otherKeys);
  if (missing.length || orphaned.length) {
    report.drifts.push({ kind: 'locale-key-drift', locale: name, missing, orphaned });
  }
}

let runtimeTranslations;
try {
  runtimeTranslations = await extractInlineTranslations(join(REPO_ROOT, 'modules/i18n.js'));
} catch (err) {
  console.error('[check-locales] modules/i18n.js extraction failed:', err.message);
  process.exit(2);
}
const runtimeLocaleNames = Object.keys(runtimeTranslations).sort();
report.sources.runtimeI18n = runtimeLocaleNames;
const runtimeEnKeys = buildKeySet(runtimeTranslations.en || {});
for (const name of runtimeLocaleNames) {
  if (name === 'en') continue;
  const dictKeys = buildKeySet(runtimeTranslations[name] || {});
  const { missing, orphaned } = diffKeySets(runtimeEnKeys, dictKeys);
  if (missing.length || orphaned.length) {
    report.drifts.push({ kind: 'runtime-key-drift', locale: name, missing, orphaned });
  }
  const counts = countTranslated(runtimeTranslations.en, runtimeTranslations[name] || {});
  if (counts.untranslatedCount > 0) {
    report.warnings.push({ kind: 'runtime-untranslated', locale: name, ...counts });
  }
}

let dashTranslations;
try {
  dashTranslations = await extractInlineTranslations(join(REPO_ROOT, 'pages/dashboard-i18n-v2.js'));
} catch (err) {
  console.error('[check-locales] pages/dashboard-i18n-v2.js extraction failed:', err.message);
  process.exit(2);
}
const dashLocaleNames = Object.keys(dashTranslations).sort();
report.sources.dashboardI18nV2 = dashLocaleNames;
const dashEnKeys = buildKeySet(dashTranslations.en || {});
for (const name of dashLocaleNames) {
  if (name === 'en') continue;
  const dictKeys = buildKeySet(dashTranslations[name] || {});
  const { missing, orphaned } = diffKeySets(dashEnKeys, dictKeys);
  if (missing.length || orphaned.length) {
    report.drifts.push({ kind: 'dashboard-key-drift', locale: name, missing, orphaned });
  }
  const counts = countTranslated(dashTranslations.en, dashTranslations[name] || {});
  if (counts.untranslatedCount > 0) {
    report.warnings.push({ kind: 'dashboard-untranslated', locale: name, ...counts });
  }
}

// Cross-source locale-set agreement.
const allSets = {
  localesDir: new Set(localesDirNames),
  runtimeI18n: new Set(runtimeLocaleNames),
  dashboardI18nV2: new Set(dashLocaleNames)
};
const universe = new Set([...allSets.localesDir, ...allSets.runtimeI18n, ...allSets.dashboardI18nV2]);
for (const locale of universe) {
  const missingFrom = [];
  for (const [sourceName, set] of Object.entries(allSets)) {
    if (!set.has(locale)) missingFrom.push(sourceName);
  }
  if (missingFrom.length > 0) {
    report.drifts.push({ kind: 'cross-source-locale-mismatch', locale, missingFrom });
  }
}

if (wantJson) {
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
} else {
  console.log('ScriptVault — locale coverage report');
  console.log(`  _locales/      ${localesDirNames.join(', ')}`);
  console.log(`  modules/i18n   ${runtimeLocaleNames.join(', ')}`);
  console.log(`  dashboard v2   ${dashLocaleNames.join(', ')}`);
  console.log('');
  if (report.drifts.length === 0) {
    console.log('  No drift detected.');
  } else {
    console.log(`  ${report.drifts.length} drift entr${report.drifts.length === 1 ? 'y' : 'ies'}:`);
    for (const d of report.drifts) {
      switch (d.kind) {
        case 'locale-json-error':
          console.log(`    [_locales/${d.locale}] JSON error: ${d.error}`);
          break;
        case 'locale-key-drift':
          if (d.missing.length) console.log(`    [_locales/${d.locale}] missing keys (${d.missing.length}): ${d.missing.slice(0, 6).join(', ')}${d.missing.length > 6 ? '…' : ''}`);
          if (d.orphaned.length) console.log(`    [_locales/${d.locale}] orphaned keys (${d.orphaned.length}): ${d.orphaned.slice(0, 6).join(', ')}${d.orphaned.length > 6 ? '…' : ''}`);
          break;
        case 'runtime-key-drift':
          if (d.missing.length) console.log(`    [modules/i18n.${d.locale}] missing keys (${d.missing.length}): ${d.missing.slice(0, 6).join(', ')}${d.missing.length > 6 ? '…' : ''}`);
          if (d.orphaned.length) console.log(`    [modules/i18n.${d.locale}] orphaned keys (${d.orphaned.length}): ${d.orphaned.slice(0, 6).join(', ')}${d.orphaned.length > 6 ? '…' : ''}`);
          break;
        case 'dashboard-key-drift':
          if (d.missing.length) console.log(`    [dashboard-i18n-v2.${d.locale}] missing keys (${d.missing.length}): ${d.missing.slice(0, 6).join(', ')}${d.missing.length > 6 ? '…' : ''}`);
          if (d.orphaned.length) console.log(`    [dashboard-i18n-v2.${d.locale}] orphaned keys (${d.orphaned.length}): ${d.orphaned.slice(0, 6).join(', ')}${d.orphaned.length > 6 ? '…' : ''}`);
          break;
        case 'cross-source-locale-mismatch':
          console.log(`    locale ${d.locale} missing from: ${d.missingFrom.join(', ')}`);
          break;
      }
    }
  }
  if (report.warnings.length > 0) {
    console.log('');
    console.log(`  ${report.warnings.length} translation-coverage warning${report.warnings.length === 1 ? '' : 's'} (informational):`);
    for (const w of report.warnings) {
      const tag = w.kind === 'runtime-untranslated' ? 'modules/i18n' : 'dashboard-i18n-v2';
      console.log(`    [${tag}.${w.locale}] ${w.translated}/${w.total} translated, ${w.untranslatedCount} still match en`);
    }
  }
}

const gatedKinds = wantStrict ? STRICT_KINDS : FATAL_KINDS;
const fatalDrifts = report.drifts.filter(d => gatedKinds.has(d.kind));
if (fatalDrifts.length > 0 && (wantCheck || wantStrict)) {
  if (!wantJson) {
    console.error(`\n[check-locales] ${fatalDrifts.length} fatal drift entr${fatalDrifts.length === 1 ? 'y' : 'ies'} — failing build.`);
  }
  process.exit(1);
}
