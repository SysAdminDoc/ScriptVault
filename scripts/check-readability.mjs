#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const MIN_FLESCH = 60;

const auditedCopy = [
  {
    id: 'dashboard.setup-warning',
    file: 'pages/dashboard.html',
    text: 'Setup Required: User scripts are off. Chrome 138 or newer needs the per-extension "Allow User Scripts" toggle. Chrome 120-137 needs Developer Mode in chrome://extensions.'
  },
  {
    id: 'popup.setup-warning',
    file: 'pages/popup.html',
    text: 'User scripts are off. In Firefox, grant the optional userScripts permission. In Chrome 138 or newer, turn on "Allow User Scripts" for ScriptVault. In Chrome 120-137, turn on Developer Mode.'
  },
  {
    id: 'install.pending-review',
    file: 'pages/install.js',
    text: 'ScriptVault is still checking this script. You can keep reviewing permissions, scope, source, and code. The final checks will update here.'
  },
  {
    id: 'install.analysis-warning',
    file: 'pages/install.js',
    text: 'Review these items first.'
  },
  {
    id: 'install.dependency-warning',
    file: 'pages/install.js',
    text: 'Some dependency checks failed. Review them before you install.'
  },
  {
    id: 'install.provenance-warning',
    file: 'pages/install.js',
    text: 'One or more @require provenance checks failed or did not finish. Review them before you install.'
  },
  {
    id: 'install.signature-warning',
    file: 'pages/install.js',
    text: 'A signature check found a warning. Review the signer before you install.'
  },
  {
    id: 'install.ready',
    file: 'pages/install.js',
    text: 'The scans, dependency checks, provenance, and signer trust all look good.'
  },
  {
    id: 'install.source-trust',
    file: 'pages/install.js',
    text: 'Review where this script came from and whether you trust its signer.'
  },
  {
    id: 'install.analysis-summary',
    file: 'pages/install.js',
    text: 'ScriptVault checks the script in the background while you review it.'
  },
  {
    id: 'install.scan-unavailable',
    file: 'pages/install.js',
    text: 'ScriptVault could not finish this scan.'
  },
  {
    id: 'install.scan-error',
    file: 'pages/install.js',
    text: 'The scanner hit an error while it checked this script.'
  },
  {
    id: 'install.source-default',
    file: 'pages/install.js',
    text: 'Review where this script came from. Check the update channel before you trust future updates.'
  }
];

function compactText(value) {
  return String(value)
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\\u2019/g, "'")
    .replace(/\\u201c|\\u201d/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactSource(file, value) {
  const source = file.endsWith('.html')
    ? String(value).replace(/<[^>]*>/g, ' ')
    : String(value);
  return compactText(source);
}

function normalizeWord(word) {
  return word
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z]/g, '');
}

const syllableOverrides = new Map([
  ['chrome', 1],
  ['firefox', 2],
  ['scriptvault', 2],
  ['userscripts', 3],
  ['provenance', 3],
  ['require', 2],
  ['dependencies', 4],
  ['dependency', 4],
  ['verification', 5]
]);

function countSyllables(rawWord) {
  const word = normalizeWord(rawWord);
  if (!word) return 0;
  if (syllableOverrides.has(word)) return syllableOverrides.get(word);
  if (word.length <= 3) return 1;

  const trimmed = word
    .replace(/(?:e|es|ed)$/i, '')
    .replace(/le$/i, 'le');
  const groups = trimmed.match(/[aeiouy]+/g);
  return Math.max(1, groups ? groups.length : 1);
}

function splitSentences(text) {
  const matches = compactText(text).match(/[^.!?]+[.!?]+|[^.!?]+$/g);
  return (matches || []).map((sentence) => sentence.trim()).filter(Boolean);
}

function wordsIn(text) {
  return compactText(text).match(/@?[A-Za-z][A-Za-z'-]*|[0-9]+/g) || [];
}

export function fleschReadingEase(text) {
  const sentences = splitSentences(text);
  const words = wordsIn(text);
  if (!sentences.length || !words.length) return 0;
  const syllables = words.reduce((sum, word) => sum + countSyllables(word), 0);
  return 206.835 - (1.015 * (words.length / sentences.length)) - (84.6 * (syllables / words.length));
}

function readProjectFile(path) {
  return readFileSync(join(projectRoot, path), 'utf8');
}

function formatScore(score) {
  return score.toFixed(1);
}

export function runReadabilityCheck({ reportAll = false } = {}) {
  const results = auditedCopy.map((entry) => {
    const source = compactSource(entry.file, readProjectFile(entry.file));
    const text = compactText(entry.text);
    const score = fleschReadingEase(text);
    return {
      ...entry,
      text,
      score,
      words: wordsIn(text).length,
      sentences: splitSentences(text).length,
      present: source.includes(text)
    };
  });

  if (reportAll) {
    console.log(`Readability audit (${MIN_FLESCH}+ Flesch required):`);
    for (const result of results) {
      console.log(
        `${result.id}: ${formatScore(result.score)} ` +
        `(${result.words} words, ${result.sentences} sentences) - ${result.file}`
      );
    }
  }

  return {
    results,
    failures: results.filter((result) => !result.present || result.score < MIN_FLESCH)
  };
}

const isMain = fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const args = new Set(process.argv.slice(2));
  const { results, failures } = runReadabilityCheck({ reportAll: args.has('--report') });

  if (failures.length > 0) {
    console.error(`Readability check failed (${MIN_FLESCH}+ Flesch required):`);
    for (const failure of failures) {
      const reasons = [];
      if (!failure.present) reasons.push('text not found in source');
      if (failure.score < MIN_FLESCH) reasons.push(`Flesch ${formatScore(failure.score)}`);
      console.error(`- ${failure.id} (${failure.file}): ${reasons.join('; ')}`);
      console.error(`  ${failure.text}`);
    }
    process.exit(1);
  }

  console.log(`Readability check passed for ${results.length} user-facing strings.`);
}
