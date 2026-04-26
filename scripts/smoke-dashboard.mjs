import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

const extensionPath = resolve(process.cwd());

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
            join(process.env.PROGRAMFILES || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
            join(process.env['PROGRAMFILES(X86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        ];
    }

    if (process.platform === 'darwin') {
        return [
            ...envPaths,
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
            '/Applications/Chromium.app/Contents/MacOS/Chromium',
        ];
    }

    return [
        ...envPaths,
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/snap/bin/chromium',
    ];
}

function findChromeExecutable() {
    const executable = chromeCandidates().find(candidate => candidate && existsSync(candidate));
    if (!executable) {
        throw new Error(
            'Chrome executable not found. Set SCRIPT_VAULT_CHROME_PATH or PUPPETEER_EXECUTABLE_PATH to run the dashboard smoke test.'
        );
    }
    return executable;
}

function assertExtensionFiles() {
    const requiredFiles = [
        'manifest.json',
        'background.js',
        'pages/dashboard.html',
        'pages/dashboard.js',
        'content.js',
    ];
    const missing = requiredFiles.filter(file => !existsSync(join(extensionPath, file)));
    if (missing.length > 0) {
        throw new Error(`Missing extension files: ${missing.join(', ')}. Run npm run build before the smoke test.`);
    }
}

async function findExtensionId(browser) {
    const isScriptVaultTarget = target => {
        const url = target.url();
        return url.startsWith('chrome-extension://') && url.endsWith('/background.js');
    };

    const existing = browser.targets().find(isScriptVaultTarget);
    const target = existing || await browser.waitForTarget(isScriptVaultTarget, { timeout: 15000 });
    const [, extensionId] = target.url().match(/^chrome-extension:\/\/([^/]+)/) || [];
    if (!extensionId) {
        throw new Error(`Could not resolve extension id from target URL: ${target.url()}`);
    }
    return extensionId;
}

async function dashboardDebugSnapshot(page) {
    return page.evaluate(() => ({
        url: location.href,
        title: document.title,
        bodyText: document.body?.innerText?.slice(0, 500) || '',
        ids: Array.from(document.querySelectorAll('[id]')).slice(0, 20).map(node => node.id),
    }));
}

const scriptsTabSelector = '.tm-tab[data-tab="scripts"]';

assertExtensionFiles();

const executablePath = findChromeExecutable();
const userDataDir = await mkdtemp(join(tmpdir(), 'scriptvault-smoke-'));
const pageErrors = [];
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
    const page = await browser.newPage();
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('console', message => {
        if (message.type() === 'error') pageErrors.push(message.text());
    });

    await page.goto(`chrome-extension://${extensionId}/pages/dashboard.html`, {
        waitUntil: 'domcontentloaded',
        timeout: 20000,
    });
    try {
        await page.waitForSelector('#scriptsPanel.tm-panel.active', { timeout: 15000 });
        await page.waitForSelector(scriptsTabSelector, { timeout: 15000 });
    } catch (error) {
        console.error('Dashboard smoke selector wait failed:', await dashboardDebugSnapshot(page));
        throw error;
    }

    const snapshot = await page.evaluate(() => ({
        title: document.title,
        version: chrome.runtime.getManifest().version,
        activeTab: document.querySelector('.tm-tab[data-tab="scripts"]')?.textContent?.trim(),
        selectedTab: document.querySelector('.tm-tab[data-tab="scripts"]')?.getAttribute('aria-selected'),
        hasHeader: Boolean(document.querySelector('.tm-header')),
        hasScriptsPanel: Boolean(document.querySelector('#scriptsPanel.tm-panel.active')),
        hasNewScriptButton: Boolean(document.querySelector('#btnNewScript')),
        hasSearch: Boolean(document.querySelector('#scriptSearch')),
    }));

    const failures = [];
    if (snapshot.title !== 'ScriptVault Dashboard') failures.push(`unexpected title: ${snapshot.title}`);
    if (!/installed userscripts/i.test(snapshot.activeTab || '')) failures.push(`unexpected active tab: ${snapshot.activeTab}`);
    if (snapshot.selectedTab !== 'true') failures.push('installed scripts tab is not selected');
    if (!snapshot.hasHeader) failures.push('dashboard header missing');
    if (!snapshot.hasScriptsPanel) failures.push('scripts panel missing or inactive');
    if (!snapshot.hasNewScriptButton) failures.push('new script button missing');
    if (!snapshot.hasSearch) failures.push('script search missing');

    if (failures.length > 0) {
        throw new Error(`Dashboard smoke failed: ${failures.join('; ')}`);
    }

    console.log(`Dashboard smoke passed for ScriptVault ${snapshot.version} (${extensionId}).`);
    if (pageErrors.length > 0) {
        console.warn(`Dashboard smoke observed ${pageErrors.length} console/page error(s):`);
        pageErrors.slice(0, 5).forEach(error => console.warn(`- ${error}`));
    }
} finally {
    if (browser) await browser.close();
    await rm(userDataDir, { recursive: true, force: true });
}
