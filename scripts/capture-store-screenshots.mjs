#!/usr/bin/env node
import { existsSync, mkdirSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import puppeteer from 'puppeteer-core';
import { closeBrowserWithFallback, removeTempProfileDir } from './browser-smoke-utils.mjs';

const extensionPath = resolve(process.cwd());
const screenshotDir = join(extensionPath, 'assets', 'screenshots');

function chromeCandidates() {
  const envPaths = [
    process.env.SCRIPT_VAULT_CHROME_PATH,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_PATH,
  ].filter(Boolean);

  if (process.platform === 'win32') {
    return [
      ...envPaths,
      join(process.env.PROGRAMFILES || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      join(process.env['PROGRAMFILES(X86)'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ];
  }

  if (process.platform === 'darwin') {
    return [
      ...envPaths,
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ];
  }

  return [
    ...envPaths,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
  ];
}

function findChromeExecutable() {
  const executable = chromeCandidates().find(c => c && existsSync(c));
  if (!executable) {
    throw new Error('Chrome executable not found. Set SCRIPT_VAULT_CHROME_PATH.');
  }
  return executable;
}

async function findExtensionId(browser) {
  const isTarget = target => {
    const url = target.url();
    return url.startsWith('chrome-extension://') && url.endsWith('/background.js');
  };
  const existing = browser.targets().find(isTarget);
  const target = existing || await browser.waitForTarget(isTarget, { timeout: 15000 });
  const [, id] = target.url().match(/^chrome-extension:\/\/([^/]+)/) || [];
  if (!id) throw new Error('Could not resolve extension id');
  return id;
}

const SCREENSHOTS = [
  { name: 'dashboard-dark', page: 'dashboard', theme: 'dark', width: 1280, height: 800 },
  { name: 'dashboard-light', page: 'dashboard', theme: 'light', width: 1280, height: 800 },
  { name: 'popup-dark', page: 'popup', theme: 'dark', width: 400, height: 600 },
  { name: 'sidepanel-dark', page: 'sidepanel', theme: 'dark', width: 420, height: 800 },
  { name: 'install-dark', page: 'install', theme: 'dark', width: 1280, height: 800 },
  { name: 'devtools-dark', page: 'devtools', theme: 'dark', width: 1200, height: 720 },
];

mkdirSync(screenshotDir, { recursive: true });

const executablePath = findChromeExecutable();
const userDataDir = await mkdtemp(join(tmpdir(), 'scriptvault-screenshots-'));
let browser;

try {
  browser = await puppeteer.launch({
    executablePath,
    headless: true,
    userDataDir,
    pipe: true,
    enableExtensions: [extensionPath],
    args: [
      '--disable-dev-shm-usage',
      '--no-default-browser-check',
      '--no-first-run',
      '--no-sandbox',
    ],
  });

  const extensionId = await findExtensionId(browser);

  for (const shot of SCREENSHOTS) {
    const page = await browser.newPage();
    await page.setViewport({ width: shot.width, height: shot.height, deviceScaleFactor: 2 });

    const pageFiles = {
      dashboard: 'pages/dashboard.html',
      popup: 'pages/popup.html',
      sidepanel: 'pages/sidepanel.html',
      install: 'pages/install.html',
      devtools: 'pages/devtools-panel.html',
    };
    const pageFile = pageFiles[shot.page];

    await page.goto(`chrome-extension://${extensionId}/${pageFile}`, {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    });

    await page.evaluate((theme) => {
      localStorage.setItem('sv_theme', theme);
      document.documentElement.setAttribute('data-theme', theme);
      document.body?.setAttribute('data-theme', theme);
    }, shot.theme);

    if (shot.page === 'dashboard') {
      await page.waitForSelector('.scripts-shell-header', { visible: true, timeout: 15000 });
      const whatsNewDismiss = await page.waitForSelector('#svWnDismiss', { timeout: 2500 }).catch(() => null);
      if (whatsNewDismiss) {
        await whatsNewDismiss.click();
        await page.waitForFunction(() => !document.querySelector('.sv-wn-overlay'), { timeout: 5000 });
      }
    } else {
      const selectors = {
        popup: '.header',
        sidepanel: '.sp-header',
        install: '.container',
        devtools: '.toolbar',
      };
      await page.waitForSelector(selectors[shot.page], { visible: true, timeout: 15000 });
    }

    if (shot.page === 'sidepanel') {
      await page.evaluate(() => {
        const hostname = document.getElementById('urlHostname');
        const path = document.getElementById('urlPath');
        if (hostname) hostname.textContent = 'example.com';
        if (path) path.textContent = '/projects';
      });
    }

    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

    const outputPath = join(screenshotDir, `${shot.name}.png`);
    await page.screenshot({ path: outputPath, fullPage: false });
    console.log(`Captured: ${shot.name}.png (${shot.width}x${shot.height})`);
    await page.close();
  }

  console.log(`\nAll screenshots saved to assets/screenshots/`);
} finally {
  await closeBrowserWithFallback(browser, 'Screenshot capture');
  await removeTempProfileDir(userDataDir, 'Screenshot capture');
}
