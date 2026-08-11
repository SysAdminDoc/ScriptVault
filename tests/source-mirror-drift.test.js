import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(process.cwd());
const testsRoot = join(repoRoot, 'tests');
const promotionMap = JSON.parse(readFileSync(join(repoRoot, 'ts-source-promotion.json'), 'utf8'));
const promotedSources = new Set(
  promotionMap.entries
    .filter(entry => entry.status === 'promoted')
    .flatMap(entry => entry.sources || [])
);

// These typed helpers have their own shipped modules or deliberately separate
// runtime implementations. They are not the inline background mirrors this
// gate is tracking; keep the classification explicit so a newly imported
// unpromoted inline mirror fails the test instead of being silently ignored.
const independentlyShippedSources = new Set([
  'src/background/url-matcher.ts',
  'src/background/background-runner-bridge.ts',
  'src/background/background-runner.ts',
  'src/background/background-wrapper.ts',
  'src/background/badge.ts',
  'src/background/execution-diagnostics.ts',
  'src/background/find-script-sources.ts',
  'src/background/fetch-bounded.ts',
  'src/background/gm-value-sync.ts',
  'src/background/host-permission-patterns.ts',
  'src/background/local-libraries.ts',
  'src/background/dnr-rules.ts',
  'src/background/registration.ts'
]);

// These modules are intentionally still unshipped TypeScript mirrors. Their
// unit tests are useful for exercising focused behavior, but they must never
// be mistaken for the code that the extension actually runs. Keep one
// contract here for every mirror imported by tests and assert its shipped
// inline counterpart in background.core.js.
const MIRROR_CONTRACTS = [
  {
    source: 'src/background/parser.ts',
    sourceMarkers: ['export function parseUserscript', 'export function parseUserSubscribe'],
    runtimeMarkers: ['function parseUserscript(code)', 'function parseUserSubscribe(code,']
  },
  {
    source: 'src/background/wrapper-builder.ts',
    sourceMarkers: ['export function buildWrappedScript', 'function GM_webSocket(', 'window.GM_webSocket = GM_webSocket'],
    runtimeMarkers: [
      'function buildWrappedScript(script',
      'const _webSocketHandles = new Map()',
      "function GM_webSocket(urlOrDetails",
      "sendToBackground('GM_webSocket_takeEvent'",
      'window.GM_webSocket = GM_webSocket'
    ]
  },
  {
    source: 'src/background/import-export.ts',
    sourceMarkers: ['export async function exportAllScripts', 'export async function importScripts'],
    runtimeMarkers: ['async function exportAllScripts', 'async function importScripts']
  },
  {
    source: 'src/background/update-checker.ts',
    sourceMarkers: ['export const UpdateSystem'],
    runtimeMarkers: ['const UpdateSystem']
  },
  {
    source: 'src/background/install-handler.ts',
    sourceMarkers: ['export async function installFromCode', 'export async function installFromUrl'],
    runtimeMarkers: ['async function installFromCode', 'async function installFromUrl']
  },
  {
    source: 'src/background/trust-receipt.ts',
    sourceMarkers: ['export async function createScriptTrustReceipt', 'export function getRequireTofuSriFailure'],
    runtimeMarkers: ['async function createScriptTrustReceipt', 'function _getRequireTofuSriFailure']
  }
];

function readTestFiles(directory, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) readTestFiles(entryPath, files);
    else if (entry.isFile() && entry.name.endsWith('.test.js')) files.push(entryPath);
  }
  return files;
}

function importedBackgroundSources() {
  const imports = new Map();
  const importPattern = /(?:from\s+|import\s*\(\s*)['"]\.\.\/(src\/background\/[^'"]+\.ts)['"]/g;
  for (const filePath of readTestFiles(testsRoot)) {
    const source = readFileSync(filePath, 'utf8');
    for (const match of source.matchAll(importPattern)) {
      const sourcePath = match[1];
      const files = imports.get(sourcePath) || [];
      files.push(filePath.slice(repoRoot.length + 1));
      imports.set(sourcePath, files);
    }
  }
  return imports;
}

describe('unshipped TypeScript mirror drift', () => {
  it('requires a shipped-runtime contract for every non-promoted background mirror imported by tests', () => {
    const contracts = new Map(MIRROR_CONTRACTS.map(contract => [contract.source, contract]));
    const importedSources = importedBackgroundSources();
    const unpromotedImports = [...importedSources.keys()].filter(source => (
      !promotedSources.has(source) && !independentlyShippedSources.has(source)
    ));
    const missingContracts = unpromotedImports.filter(source => !contracts.has(source));

    expect(missingContracts).toEqual([]);
    expect(unpromotedImports.sort()).toEqual([...contracts.keys()].sort());
  });

  it('keeps each mirror’s exported contract represented by the shipped background runtime', () => {
    const runtime = readFileSync(join(repoRoot, 'background.core.js'), 'utf8');

    for (const contract of MIRROR_CONTRACTS) {
      const mirror = readFileSync(join(repoRoot, contract.source), 'utf8');
      for (const marker of contract.sourceMarkers) {
        expect(mirror, `${contract.source} is missing ${marker}`).toContain(marker);
      }
      for (const marker of contract.runtimeMarkers) {
        expect(runtime, `background.core.js is missing ${marker} for ${contract.source}`).toContain(marker);
      }
    }
  });
});
