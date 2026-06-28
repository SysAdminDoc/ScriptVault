#!/usr/bin/env node
// scripts/smoke-large-library.mjs
//
// Synthetic-dataset performance harness for ScriptVault. Generates 1k and 10k
// userscripts in memory, then measures the cost of:
//   - building MatchSet from the dataset
//   - getCandidates() / getMatching() over a basket of representative URLs
//   - text + match-pattern search (sort by name)
//   - IndexedDB script/value/backup writes with and without Storage Buckets
//
// Designed to stay within a few hundred ms even on a VMware shared drive so
// it can run in CI. Pass --check to fail the process when any measurement
// exceeds its documented threshold (also written to docs/large-library-perf.md).
//
// Run:
//   node scripts/smoke-large-library.mjs            # report only
//   node scripts/smoke-large-library.mjs --check    # report + threshold gate
//   node scripts/smoke-large-library.mjs --json     # JSON output (CI logs)
//
// Output mode notes: --json suppresses prose; --check sets exit code 1 on
// any threshold violation but still prints the report.

import { performance } from 'node:perf_hooks';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

// Register a TS loader so we can `await import('../src/background/url-matcher.ts')`.
// Vitest provides this normally; for raw Node we need esbuild-register or
// the built-in tsx loader. We use the dependency-light approach: a tiny
// dynamic loader hook that compiles .ts files with esbuild (already a dev
// dep on this project) and serves them as ESM modules.
try {
  // esbuild ships an `esbuild-register` integration but we already depend
  // on esbuild itself; rely on Node's experimental `module.register` plus
  // an inline loader that transpiles each .ts request on the fly.
  register('./scripts/ts-loader.mjs', pathToFileURL('./'));
} catch (err) {
  console.error('[smoke-large-library] Failed to register TS loader:', err.message);
  process.exit(2);
}

const args = new Set(process.argv.slice(2));
const wantJson = args.has('--json');
const wantCheck = args.has('--check');

// Thresholds (ms). Mirror docs/large-library-perf.md. Generous enough to be
// stable on VMware shared drives; tight enough to fail real regressions.
const THRESHOLDS = {
  build1k: 60,
  build10k: 600,
  candidates1k_p99: 5,
  candidates10k_p99: 25,
  matching1k_p99: 8,
  matching10k_p99: 50,
  search1k: 25,
  search10k: 250,
  sort1k: 20,
  sort10k: 200,
  dashboardRender1k_p99: 50,
  dashboardRender10k_p99: 100,
  storageSingle1k: 5000,
  storageBucketed1k: 5000
};

const { MatchSet } = await import('../src/background/url-matcher.ts');
const { IDBFactory, IDBKeyRange } = await import('fake-indexeddb');
const {
  BackupsDAO,
  ScriptsDAO,
  ValuesDAO
} = await import('../src/storage/script-db.ts');
const {
  DB_NAME,
  StorageBucketNames,
  closeDB
} = await import('../src/storage/idb.ts');
const virtualRowsCode = readFileSync(new URL('../pages/dashboard-virtual-rows.js', import.meta.url), 'utf8');

function loadVirtualRows(window) {
  const sandbox = {
    window,
    document: window.document,
    globalThis: window,
    module: { exports: {} }
  };
  vm.runInNewContext(virtualRowsCode, sandbox);
  return sandbox.module.exports;
}

function generateScripts(count, { seed = 1 } = {}) {
  // Deterministic hostname pool — 90% site-scoped, 5% wildcard, 5% regex include.
  const hostnames = ['example.com', 'github.com', 'reddit.com', 'twitter.com', 'youtube.com',
                     'wikipedia.org', 'amazon.com', 'stackoverflow.com', 'mozilla.org',
                     'developer.mozilla.org', 'news.ycombinator.com', 'medium.com',
                     'cloudflare.com', 'apple.com', 'microsoft.com'];
  const scripts = [];
  let rngState = seed;
  const rng = () => {
    rngState = (rngState * 1664525 + 1013904223) >>> 0;
    return rngState / 0x100000000;
  };
  for (let i = 0; i < count; i++) {
    const r = rng();
    let match, include;
    if (r < 0.9) {
      const host = hostnames[Math.floor(rng() * hostnames.length)];
      match = [`https://${host}/*`];
    } else if (r < 0.95) {
      match = ['<all_urls>'];
    } else {
      include = ['/^https?:\\/\\/[a-z]+\\.example\\.org\\/.*$/'];
      match = [];
    }
    scripts.push({
      id: `script_perf_${i}`,
      enabled: i % 5 !== 0, // 80% enabled
      code: `// generated ${i}`,
      meta: {
        name: `Perf Script ${String(i).padStart(5, '0')}`,
        namespace: `scriptvault/perf/${i}`,
        version: '1.0.0',
        match: match || [],
        include: include || [],
        exclude: [],
        grant: ['none'],
        require: [],
        resource: {},
        'run-at': 'document-idle'
      }
    });
  }
  return scripts;
}

const PROBE_URLS = [
  'https://example.com/path/page',
  'https://github.com/user/repo',
  'https://www.example.com/',
  'https://reddit.com/r/programming',
  'https://docs.github.com/api',
  'https://twitter.com/example',
  'https://www.unknownhost.test/',
  'https://nested.subdomain.example.com/path',
  'https://www.amazon.com/dp/B08L5VWVS5',
  'https://en.wikipedia.org/wiki/JavaScript',
  'https://stackoverflow.com/questions/123',
  'https://news.ycombinator.com/item?id=42',
  'https://random.example.org/anything',
  'https://api.cloudflare.com/v1',
  'https://developer.mozilla.org/en-US/docs/Web/JavaScript',
  'https://medium.com/@example/post-id',
  'about:blank',
  'data:text/html,Hello',
  'https://localhost:8443/page',
  'https://192.168.1.1/admin'
];

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function measureBuild(scripts) {
  const t0 = performance.now();
  const ms = new MatchSet(scripts);
  const t1 = performance.now();
  return { ms: t1 - t0, matchSet: ms };
}

function measureLookups(matchSet, kind) {
  const samples = [];
  // Repeat probes to get >100 samples even with a 20-url basket.
  const repeats = 6;
  for (let i = 0; i < repeats; i++) {
    for (const url of PROBE_URLS) {
      const t0 = performance.now();
      if (kind === 'candidates') matchSet.getCandidates(url);
      else matchSet.getMatching(url);
      const t1 = performance.now();
      samples.push(t1 - t0);
    }
  }
  return {
    median: percentile(samples, 50),
    p95: percentile(samples, 95),
    p99: percentile(samples, 99),
    samples: samples.length
  };
}

function measureSearch(scripts, term) {
  const t0 = performance.now();
  const lower = term.toLowerCase();
  const out = [];
  for (const s of scripts) {
    const name = s.meta?.name || '';
    if (name.toLowerCase().includes(lower)) out.push(s);
  }
  const t1 = performance.now();
  return { ms: t1 - t0, hits: out.length };
}

function measureSort(scripts) {
  const t0 = performance.now();
  const copy = scripts.slice();
  copy.sort((a, b) => (a.meta?.name || '').localeCompare(b.meta?.name || ''));
  const t1 = performance.now();
  return { ms: t1 - t0 };
}

function measureDashboardRender(scripts) {
  const dom = new JSDOM('<!doctype html><table><tbody id="scriptTableBody"></tbody></table>');
  const api = loadVirtualRows(dom.window);
  const tbody = dom.window.document.getElementById('scriptTableBody');
  const samples = [];
  const totalHeight = scripts.length * 72;
  const scrollSamples = 120;
  const createRow = (script) => {
    const tr = dom.window.document.createElement('tr');
    tr.dataset.scriptId = script.id;
    const td = dom.window.document.createElement('td');
    td.textContent = script.meta?.name || script.id;
    tr.appendChild(td);
    return tr;
  };
  for (let i = 0; i < scrollSamples; i += 1) {
    const scrollTop = (totalHeight / scrollSamples) * i;
    const windowState = api.computeWindow({
      total: scripts.length,
      rowHeight: 72,
      viewportHeight: 900,
      scrollTop,
      overscan: 12,
      maxRows: 60
    });
    const t0 = performance.now();
    api.renderWindow({ tbody, scripts, createRow, windowState, columnCount: 13 });
    const t1 = performance.now();
    samples.push(t1 - t0);
  }
  return {
    median: percentile(samples, 50),
    p99: percentile(samples, 99),
    samples: samples.length
  };
}

function setNavigatorStorageBuckets(storageBuckets) {
  const current = typeof globalThis.navigator === 'object' && globalThis.navigator
    ? globalThis.navigator
    : {};
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { ...current, storageBuckets }
  });
}

function resetIndexedDBHarness({ bucketed }) {
  closeDB();
  Object.defineProperty(globalThis, 'indexedDB', {
    configurable: true,
    value: new IDBFactory()
  });
  Object.defineProperty(globalThis, 'IDBKeyRange', {
    configurable: true,
    value: IDBKeyRange
  });
  if (!bucketed) {
    setNavigatorStorageBuckets(undefined);
    return;
  }
  const factories = Object.fromEntries(
    Object.values(StorageBucketNames).map((name) => [name, new IDBFactory()])
  );
  setNavigatorStorageBuckets({
    open: async (name) => ({ indexedDB: factories[name] })
  });
}

async function writeValueBags(scripts) {
  for (const script of scripts) {
    await ValuesDAO.setAll(script.id, {
      enabled: script.enabled,
      namespace: script.meta?.namespace || '',
      updatedAt: script.updatedAt || 0
    });
  }
}

async function writeBackupBlob(scripts) {
  const payload = new TextEncoder().encode(JSON.stringify({
    schema: 'scriptvault-storage-write-benchmark/v1',
    count: scripts.length,
    scripts: scripts.map((script) => ({
      id: script.id,
      name: script.meta?.name,
      namespace: script.meta?.namespace,
      code: `${script.code}\n`.repeat(120)
    }))
  }));
  await BackupsDAO.put({
    id: `perf-backup-${scripts.length}`,
    name: `perf-backup-${scripts.length}`,
    createdAt: Date.now(),
    byteSize: payload.byteLength,
    data: payload.buffer
  });
}

async function measureStorageWrites(scripts, { bucketed }) {
  resetIndexedDBHarness({ bucketed });
  const t0 = performance.now();
  const scriptStart = performance.now();
  const scriptsWrite = ScriptsDAO.bulkPut(scripts).then(() => performance.now() - scriptStart);
  const valuesStart = performance.now();
  const valuesWrite = writeValueBags(scripts).then(() => performance.now() - valuesStart);
  const backupStart = performance.now();
  const backupWrite = writeBackupBlob(scripts).then(() => performance.now() - backupStart);
  const [scriptsMs, valuesMs, backupMs] = await Promise.all([scriptsWrite, valuesWrite, backupWrite]);
  const total = performance.now() - t0;
  closeDB();
  return {
    mode: bucketed ? 'storage-buckets' : 'single-indexeddb',
    total,
    scripts: scriptsMs,
    values: valuesMs,
    backup: backupMs,
    scriptsPerSecond: scripts.length / (total / 1000)
  };
}

async function runFor(count) {
  const scripts = generateScripts(count);
  const build = measureBuild(scripts);
  const candidates = measureLookups(build.matchSet, 'candidates');
  const matching = measureLookups(build.matchSet, 'matching');
  const search = measureSearch(scripts, 'Perf Script 09999');
  const sort = measureSort(scripts);
  const dashboardRender = measureDashboardRender(scripts);
  return { count, build: build.ms, candidates, matching, search: search.ms, sort: sort.ms, dashboardRender };
}

const datasets = [];
datasets.push(await runFor(1000));
datasets.push(await runFor(10000));
const storageWriteScripts = generateScripts(1000, { seed: 99 });
const storageWrites = {
  count: storageWriteScripts.length,
  single: await measureStorageWrites(storageWriteScripts, { bucketed: false }),
  bucketed: await measureStorageWrites(storageWriteScripts, { bucketed: true })
};
storageWrites.improvement = storageWrites.single.total / storageWrites.bucketed.total;

const report = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  platform: process.platform,
  thresholds: THRESHOLDS,
  datasets,
  storageWrites
};

const checks = [];
const get = (key) => THRESHOLDS[key];
function check(label, actual, limit) {
  const pass = actual <= limit;
  checks.push({ label, actual: +actual.toFixed(3), limit, pass });
}

check('build 1k',                      datasets[0].build,             get('build1k'));
check('build 10k',                     datasets[1].build,             get('build10k'));
check('getCandidates p99 1k',          datasets[0].candidates.p99,    get('candidates1k_p99'));
check('getCandidates p99 10k',         datasets[1].candidates.p99,    get('candidates10k_p99'));
check('getMatching p99 1k',            datasets[0].matching.p99,      get('matching1k_p99'));
check('getMatching p99 10k',           datasets[1].matching.p99,      get('matching10k_p99'));
check('substring search 1k',           datasets[0].search,            get('search1k'));
check('substring search 10k',          datasets[1].search,            get('search10k'));
check('localeCompare sort 1k',         datasets[0].sort,              get('sort1k'));
check('localeCompare sort 10k',        datasets[1].sort,              get('sort10k'));
check('dashboard render p99 1k',       datasets[0].dashboardRender.p99, get('dashboardRender1k_p99'));
check('dashboard render p99 10k',      datasets[1].dashboardRender.p99, get('dashboardRender10k_p99'));
check('storage writes total 1k single', storageWrites.single.total,       get('storageSingle1k'));
check('storage writes total 1k buckets', storageWrites.bucketed.total,    get('storageBucketed1k'));

report.checks = checks;

if (wantJson) {
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
} else {
  const fmt = (n) => n.toFixed(2).padStart(7) + ' ms';
  console.log('ScriptVault — large library performance harness');
  console.log(`  Node ${report.node} on ${report.platform}`);
  console.log('');
  for (const ds of datasets) {
    console.log(`  Dataset N=${ds.count}`);
    console.log(`    MatchSet build         ${fmt(ds.build)}`);
    console.log(`    getCandidates p50/p99  ${fmt(ds.candidates.median)} / ${fmt(ds.candidates.p99)}`);
    console.log(`    getMatching   p50/p99  ${fmt(ds.matching.median)} / ${fmt(ds.matching.p99)}`);
    console.log(`    substring search       ${fmt(ds.search)}`);
    console.log(`    localeCompare sort     ${fmt(ds.sort)}`);
    console.log(`    dashboard render p50/p99 ${fmt(ds.dashboardRender.median)} / ${fmt(ds.dashboardRender.p99)}`);
    console.log('');
  }
  console.log('  IndexedDB write throughput N=1000');
  console.log(`    single DB total        ${fmt(storageWrites.single.total)} (${storageWrites.single.scriptsPerSecond.toFixed(0)} scripts/sec)`);
  console.log(`      scripts/values/backup ${fmt(storageWrites.single.scripts)} / ${fmt(storageWrites.single.values)} / ${fmt(storageWrites.single.backup)}`);
  console.log(`    Storage Buckets total  ${fmt(storageWrites.bucketed.total)} (${storageWrites.bucketed.scriptsPerSecond.toFixed(0)} scripts/sec)`);
  console.log(`      scripts/values/backup ${fmt(storageWrites.bucketed.scripts)} / ${fmt(storageWrites.bucketed.values)} / ${fmt(storageWrites.bucketed.backup)}`);
  console.log(`    bucketed improvement   ${storageWrites.improvement.toFixed(2)}x`);
  console.log('');
  console.log('  Threshold checks');
  for (const c of checks) {
    const status = c.pass ? 'OK    ' : 'FAIL  ';
    console.log(`    ${status} ${c.label.padEnd(28)} actual=${String(c.actual).padStart(7)} ms  limit=${String(c.limit).padStart(4)} ms`);
  }
}

const failed = checks.filter(c => !c.pass);
if (failed.length > 0 && wantCheck) {
  if (!wantJson) {
    console.error(`\n[smoke-large-library] ${failed.length} threshold violation${failed.length === 1 ? '' : 's'}.`);
  }
  process.exit(1);
} else if (failed.length > 0 && !wantJson) {
  console.warn(`\n[smoke-large-library] ${failed.length} threshold violation${failed.length === 1 ? '' : 's'} (informational — pass --check to fail).`);
}
