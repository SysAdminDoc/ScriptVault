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

const THEMES = ['dark', 'light', 'catppuccin', 'oled'];
const SCREENSHOTS = [
  ...THEMES.map(theme => ({ name: `dashboard-${theme}`, page: 'dashboard', variant: 'scripts', theme, width: 1280, height: 800 })),
  ...THEMES.map(theme => ({ name: `dashboard-settings-${theme}`, page: 'dashboard', variant: 'settings', theme, width: 1280, height: 800 })),
  ...THEMES.flatMap(theme => ['updates', 'utilities', 'trash', 'help'].map(variant => ({
    name: `dashboard-${variant}-${theme}`,
    page: 'dashboard',
    variant,
    theme,
    width: 1280,
    height: 800,
  }))),
  ...THEMES.map(theme => ({ name: `dashboard-editor-${theme}`, page: 'dashboard', variant: 'editor', theme, width: 1280, height: 800 })),
  ...THEMES.map(theme => ({ name: `popup-${theme}`, page: 'popup', theme, width: 400, height: 600 })),
  ...THEMES.map(theme => ({ name: `sidepanel-${theme}`, page: 'sidepanel', theme, width: 420, height: 800 })),
  ...THEMES.map(theme => ({ name: `install-${theme}`, page: 'install', theme, width: 1280, height: 800 })),
  ...THEMES.map(theme => ({ name: `devtools-${theme}`, page: 'devtools', theme, width: 1200, height: 720 })),
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
    await page.evaluateOnNewDocument((theme) => {
      localStorage.setItem('sv_theme', theme);
    }, shot.theme);

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
      if (shot.variant === 'editor') {
        await page.click('#btnNewScript');
        await page.waitForSelector('.editor-overlay.active', { visible: true, timeout: 15000 });
      } else if (shot.variant && shot.variant !== 'scripts') {
        await page.click(`.sv-rail-item[data-workbench-tab="${shot.variant}"]:not(.sv-rail-subitem)`);
        const panelSelector = `#${shot.variant}Panel`;
        await page.waitForSelector(panelSelector, { visible: true, timeout: 10000 });
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

    // App initialization and view transitions can reapply the saved/default
    // theme after DOMContentLoaded. Pin the requested theme only after the
    // target surface is ready, then wait for the transition snapshot to clear.
    await page.evaluate(async (theme) => {
      localStorage.setItem('sv_theme', theme);
      document.documentElement.setAttribute('data-theme', theme);
      document.body?.setAttribute('data-theme', theme);
      await new Promise(resolve => setTimeout(resolve, 320));
      document.documentElement.setAttribute('data-theme', theme);
      document.body?.setAttribute('data-theme', theme);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }, shot.theme);
    await page.waitForFunction(
      theme => document.documentElement.dataset.theme === theme,
      { timeout: 5000 },
      shot.theme,
    );

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
