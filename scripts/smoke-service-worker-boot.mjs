#!/usr/bin/env node

// Measure the cost users pay when the MV3 service worker is cold. Each sample
// closes the running worker through CDP, sends one representative runtime
// message, and records the end-to-end time until the response arrives.
//
// Run:
//   node scripts/smoke-service-worker-boot.mjs
//   node scripts/smoke-service-worker-boot.mjs --check
//   node scripts/smoke-service-worker-boot.mjs --json --report out.json

import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(SCRIPT_DIR, '..');
const DEFAULT_REPORT_PATH = 'release-artifacts/service-worker-boot-report.json';
const DEFAULT_SAMPLE_COUNT = 6;

// Thresholds are p99 milliseconds. They are intentionally above the local
// baseline so normal VM/CI variance does not make the release gate flaky while
// still catching a materially slower worker boot.
export const BOOT_THRESHOLDS = Object.freeze({
  freshProfileP99Ms: 1_000,
  seeded1kP99Ms: 1_500,
  maxErrors: 0,
});

export const BOOT_MESSAGE_BASKET = Object.freeze([
  Object.freeze({ name: 'getExtensionStatus', message: Object.freeze({ action: 'getExtensionStatus' }) }),
  Object.freeze({ name: 'getScripts', message: Object.freeze({ action: 'getScripts' }) }),
  Object.freeze({ name: 'getSettings', message: Object.freeze({ action: 'getSettings' }) }),
]);

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[index];
}

function summarizeDurations(samples) {
  const durations = samples.map(sample => sample.durationMs).filter(Number.isFinite);
  const errors = samples.filter(sample => sample.error).length;
  return {
    samples: samples.length,
    errors,
    minMs: durations.length ? Math.min(...durations) : 0,
    p50Ms: percentile(durations, 50),
    p95Ms: percentile(durations, 95),
    p99Ms: percentile(durations, 99),
    maxMs: durations.length ? Math.max(...durations) : 0,
  };
}

export function summarizeBootSamples(samples) {
  return {
    ...summarizeDurations(samples),
    byMessage: Object.fromEntries(BOOT_MESSAGE_BASKET.map(({ name }) => {
      const messageSamples = samples.filter(sample => sample.message === name);
      return [name, summarizeDurations(messageSamples)];
    })),
  };
}

export function evaluateBootChecks(scenarios, thresholds = BOOT_THRESHOLDS) {
  const checks = [];
  for (const scenario of scenarios) {
    const limit = scenario.name === 'fresh-profile'
      ? thresholds.freshProfileP99Ms
      : thresholds.seeded1kP99Ms;
    checks.push({
      label: `${scenario.name} p99`,
      actual: scenario.summary.p99Ms,
      limit,
      pass: scenario.summary.p99Ms <= limit,
    });
    checks.push({
      label: `${scenario.name} errors`,
      actual: scenario.summary.errors,
      limit: thresholds.maxErrors,
      pass: scenario.summary.errors <= thresholds.maxErrors,
    });
  }
  return checks;
}

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    check: false,
    json: false,
    report: DEFAULT_REPORT_PATH,
    samples: DEFAULT_SAMPLE_COUNT,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--check') {
      options.check = true;
      continue;
    }
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    if (arg === '--report' || arg === '--samples') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value`);
      if (arg === '--report') options.report = value;
      if (arg === '--samples') {
        options.samples = Number.parseInt(value, 10);
        if (!Number.isInteger(options.samples) || options.samples < 1 || options.samples > 50) {
          throw new Error('--samples must be an integer from 1 to 50');
        }
      }
      index += 1;
      continue;
    }
    throw new Error(`unknown service-worker boot option: ${arg}`);
  }
  return options;
}

function assertExtensionFiles() {
  const required = ['manifest.json', 'background.js', 'content.js'];
  const missing = required.filter(file => !existsSync(join(PROJECT_ROOT, file)));
  if (missing.length > 0) {
    throw new Error(`Missing extension files: ${missing.join(', ')}. Run npm run build first.`);
  }
}

async function launchExtension() {
  assertExtensionFiles();
  const userDataDir = await mkdtemp(join(tmpdir(), 'scriptvault-sw-boot-'));
  const channel = process.env.SCRIPT_VAULT_PLAYWRIGHT_CHANNEL || 'chromium';
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel,
    headless: true,
    args: [
      `--disable-extensions-except=${PROJECT_ROOT}`,
      `--load-extension=${PROJECT_ROOT}`,
      '--disable-dev-shm-usage',
      '--no-default-browser-check',
      '--no-first-run',
      '--no-sandbox',
    ],
  });
  try {
    const worker = context.serviceWorkers().find(candidate => candidate.url().startsWith('chrome-extension://'))
      || await context.waitForEvent('serviceworker', {
        predicate: candidate => candidate.url().startsWith('chrome-extension://'),
        timeout: 15_000,
      });
    const [, extensionId] = worker.url().match(/^chrome-extension:\/\/([^/]+)\//) || [];
    if (!extensionId) throw new Error(`Could not resolve extension id from ${worker.url()}`);
    return { context, userDataDir, extensionId, channel };
  } catch (error) {
    await context.close().catch(() => {});
    await rm(userDataDir, { recursive: true, force: true });
    throw error;
  }
}

async function openExtensionPage(app) {
  const page = await app.context.newPage();
  await page.goto(`chrome-extension://${app.extensionId}/pages/dashboard.html`, {
    waitUntil: 'domcontentloaded',
    timeout: 20_000,
  });
  return page;
}

async function getServiceWorkerTarget(cdp, extensionId) {
  const { targetInfos } = await cdp.send('Target.getTargets');
  return targetInfos.find(target =>
    target.type === 'service_worker' &&
    target.url.startsWith(`chrome-extension://${extensionId}/`));
}

async function stopServiceWorker(cdp, extensionId) {
  const worker = await getServiceWorkerTarget(cdp, extensionId);
  if (!worker) throw new Error('ScriptVault service-worker target was not running before the sample');
  const result = await cdp.send('Target.closeTarget', { targetId: worker.targetId });
  if (!result.success) throw new Error('Chromium refused to stop the ScriptVault service worker');
  // Chrome can restart an extension worker immediately when an extension page
  // remains open. The successful Target.closeTarget response is the termination
  // proof; give the browser a scheduling turn before sending the wake message.
  await new Promise(resolveDelay => setTimeout(resolveDelay, 50));
}

function seededScripts(count = 1_000) {
  return Array.from({ length: count }, (_, index) => {
    const name = `Boot Perf ${String(index).padStart(4, '0')}`;
    return {
      id: `script_boot_perf_${index}`,
      code: [
        '// ==UserScript==',
        `// @name ${name}`,
        '// @namespace scriptvault-boot-perf',
        '// @version 1.0.0',
        '// @match https://example.com/*',
        '// @grant none',
        '// ==/UserScript==',
        `void ${index};`,
        '',
      ].join('\n'),
      enabled: false,
      position: index,
    };
  });
}

async function seedLibrary(page) {
  const scripts = seededScripts();
  const results = [];
  for (let offset = 0; offset < scripts.length; offset += 250) {
    const response = await page.evaluate(async batch => chrome.runtime.sendMessage({
      action: 'importAll',
      data: {
        data: { scripts: batch },
        options: {
          overwrite: true,
          recordReceipt: false,
          trustImportedScripts: false,
          sourceLabel: 'service-worker boot smoke',
        },
      },
    }), scripts.slice(offset, offset + 250));
    if (!response || response.error) {
      throw new Error(`Could not seed the 1,000-script profile: ${JSON.stringify(response)}`);
    }
    results.push(response);
  }
  const imported = results.reduce((total, response) => total + (response.imported || 0), 0);
  if (imported !== 1_000) throw new Error(`Could not seed the 1,000-script profile: imported ${imported}`);
  return { imported };
}

async function sendRuntimeMessage(page, message) {
  return page.evaluate(payload => chrome.runtime.sendMessage(payload), message);
}

async function measureScenario(name, { samples, seeded }) {
  const app = await launchExtension();
  const page = await openExtensionPage(app);
  const browser = app.context.browser();
  const cdp = await browser.newBrowserCDPSession();
  const measurements = [];
  try {
    if (seeded) await seedLibrary(page);
    for (let index = 0; index < samples; index += 1) {
      for (const basketEntry of BOOT_MESSAGE_BASKET) {
        await stopServiceWorker(cdp, app.extensionId);
        const startedAt = performance.now();
        let error = '';
        try {
          const response = await sendRuntimeMessage(page, basketEntry.message);
          if (response === undefined) error = 'runtime message returned no response';
        } catch (caught) {
          error = caught?.message || String(caught);
        }
        const durationMs = performance.now() - startedAt;
        measurements.push({
          message: basketEntry.name,
          iteration: index + 1,
          durationMs: Number(durationMs.toFixed(3)),
          ...(error ? { error } : {}),
        });
      }
    }
  } finally {
    await cdp.detach().catch(() => {});
    await page.close().catch(() => {});
    await app.context.close().catch(() => {});
    await rm(app.userDataDir, { recursive: true, force: true });
  }
  return {
    name,
    seededScripts: seeded ? 1_000 : 0,
    samplesRequested: samples * BOOT_MESSAGE_BASKET.length,
    summary: summarizeBootSamples(measurements),
    measurements,
  };
}

export async function runBootMeasurement({ samples = DEFAULT_SAMPLE_COUNT } = {}) {
  const startedAt = new Date();
  const scenarios = [
    await measureScenario('fresh-profile', { samples, seeded: false }),
    await measureScenario('seeded-1k', { samples, seeded: true }),
  ];
  const report = {
    schemaVersion: 1,
    generatedAt: startedAt.toISOString(),
    node: process.version,
    platform: process.platform,
    browserChannel: process.env.SCRIPT_VAULT_PLAYWRIGHT_CHANNEL || 'chromium',
    thresholds: BOOT_THRESHOLDS,
    scenarios,
  };
  report.checks = evaluateBootChecks(scenarios);
  report.pass = report.checks.every(check => check.pass);
  return report;
}

async function main() {
  const options = parseArgs();
  const report = await runBootMeasurement({ samples: options.samples });
  const reportPath = resolve(PROJECT_ROOT, options.report);
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    console.log('ScriptVault — service-worker cold-start harness');
    console.log(`  report ${relative(PROJECT_ROOT, reportPath).replace(/\\/g, '/')}`);
    for (const scenario of report.scenarios) {
      console.log(`  ${scenario.name} p50/p99 ${scenario.summary.p50Ms.toFixed(2)} / ${scenario.summary.p99Ms.toFixed(2)} ms (${scenario.summary.samples} samples, ${scenario.summary.errors} errors)`);
    }
    for (const check of report.checks) {
      console.log(`  ${check.pass ? 'OK' : 'FAIL'} ${check.label}: ${check.actual.toFixed(2)} ms (limit ${check.limit})`);
    }
  }
  if (options.check && !report.pass) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(`[smoke-service-worker-boot] ${error.stack || error.message || error}`);
    process.exitCode = 2;
  });
}
