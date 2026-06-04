import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

function fail(message) {
  console.error(`What's New changelog check failed: ${message}`);
  process.exit(1);
}

const manifest = JSON.parse(readProjectFile('manifest.json'));
const packageJson = JSON.parse(readProjectFile('package.json'));
const source = readProjectFile('pages/dashboard-whatsnew.js');

if (!manifest.version) fail('manifest.json is missing version');
if (packageJson.version !== manifest.version) {
  fail(`package.json version ${packageJson.version || '<missing>'} does not match manifest.json ${manifest.version}`);
}

const chromeStub = {
  runtime: {
    getManifest: () => ({ version: manifest.version }),
  },
  storage: {
    local: {
      get: async () => ({ lastSeenVersion: '0.0.0' }),
      set: async () => {},
    },
  },
};

let whatsNew;
try {
  whatsNew = new Function('chrome', `${source}
return WhatsNew;`)(chromeStub);
} catch (error) {
  fail(`unable to evaluate pages/dashboard-whatsnew.js: ${error?.message || error}`);
}

if (!whatsNew || typeof whatsNew.getEntry !== 'function') {
  fail('pages/dashboard-whatsnew.js must expose WhatsNew.getEntry(version)');
}

const entry = whatsNew.getEntry(manifest.version);
if (!entry) fail(`missing CHANGELOG entry for manifest version ${manifest.version}`);
if (!entry.title || !entry.title.includes(manifest.version)) {
  fail(`CHANGELOG[${manifest.version}] title must include the version`);
}
if (!entry.date) fail(`CHANGELOG[${manifest.version}] is missing date`);
if (!Array.isArray(entry.highlights) || entry.highlights.length === 0) {
  fail(`CHANGELOG[${manifest.version}] must include highlights`);
}
if (!Array.isArray(entry.improvements) || entry.improvements.length === 0) {
  fail(`CHANGELOG[${manifest.version}] must include improvements`);
}

const shouldShow = await whatsNew.shouldShow();
if (!shouldShow) {
  fail(`WhatsNew.shouldShow() returned false for unseen manifest version ${manifest.version}`);
}

console.log(`What's New changelog check passed for ${manifest.version}.`);
