// Editor-screen smoke: opens the dashboard, creates a new script (which must
// jump straight into the editor), and verifies the editor chrome is visible,
// hit-testable, and closable. Exists because a z-index regression once left
// the sticky dashboard header painted over the editor's Save/Close row —
// selector-presence checks pass in that state; only hit-testing catches it.
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
            'Chrome executable not found. Set SCRIPT_VAULT_CHROME_PATH or PUPPETEER_EXECUTABLE_PATH to run the editor smoke test.'
        );
    }
    return executable;
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

const executablePath = findChromeExecutable();
const userDataDir = await mkdtemp(join(tmpdir(), 'scriptvault-editor-smoke-'));
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
            '--window-size=1440,900',
        ],
        defaultViewport: { width: 1440, height: 900 },
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
    await page.waitForSelector('#scriptsPanel.tm-panel.active', { timeout: 15000 });
    await page.waitForSelector('#btnNewScript', { timeout: 15000 });

    // First open after a version bump shows the What's New modal — it renders
    // asynchronously, so wait for it briefly and dismiss it the way a user
    // would before interacting with the dashboard.
    const whatsNewDismiss = await page.waitForSelector('#svWnDismiss', { timeout: 4000 }).catch(() => null);
    if (whatsNewDismiss) {
        await whatsNewDismiss.click();
        await page.waitForFunction(() => !document.querySelector('.sv-wn-overlay'), { timeout: 5000 });
    }

    // New Script must open the editor directly — no template modal in between.
    await page.click('#btnNewScript');
    await page.waitForSelector('#editorOverlay.active', { timeout: 15000 });

    const geometry = await page.evaluate(() => {
        const rect = id => {
            const el = document.getElementById(id) || document.querySelector(id);
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { top: r.top, bottom: r.bottom, height: r.height, width: r.width, x: r.x + r.width / 2, y: r.y + r.height / 2 };
        };
        // Hit-test: the element rendered at a control's center must be the
        // control itself (or a descendant) — catches anything painted on top.
        const hit = id => {
            const el = document.getElementById(id);
            if (!el) return 'missing';
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) return 'zero-size';
            const at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
            return el === at || el.contains(at) ? 'ok' : `covered-by:${at ? (at.id || at.className || at.tagName) : 'none'}`;
        };
        const overlay = document.getElementById('editorOverlay').getBoundingClientRect();
        const modalOpen = Boolean(document.querySelector('.modal-overlay.active, #modalOverlay.active, .modal.active'))
            || getComputedStyle(document.getElementById('modalOverlay') || document.createElement('div')).display === 'flex';
        const wrapper = rect('editorWrapper');
        return {
            overlayTop: overlay.top,
            overlayHeight: overlay.height,
            viewport: { w: innerWidth, h: innerHeight },
            modalOpen,
            header: rect('editorTitle'),
            wrapper,
            codePaneShare: wrapper ? wrapper.height / innerHeight : 0,
            hits: {
                save: hit('btnEditorSave'),
                close: hit('btnEditorClose'),
                run: hit('btnEditorRunNow'),
                export: hit('btnEditorExport'),
                toggle: hit('btnEditorToggle'),
                duplicate: hit('btnEditorDuplicate'),
                delete: hit('btnEditorDelete'),
                tabCode: hit('editorTabCode'),
                tabSettings: hit('editorTabScriptSettings'),
                tabInfo: hit('editorTabInfo'),
                undo: hit('tbtnUndo'),
                find: hit('tbtnSearch'),
                beautify: hit('tbtnBeautify'),
                share: hit('tbtnShare'),
            },
        };
    });

    const failures = [];
    if (geometry.modalOpen) failures.push('a template/modal popup opened on New Script');
    if (geometry.overlayTop !== 0) failures.push(`editor overlay does not start at top of viewport (top=${geometry.overlayTop})`);
    if (Math.abs(geometry.overlayHeight - geometry.viewport.h) > 2) failures.push(`editor overlay does not fill viewport height (${geometry.overlayHeight}/${geometry.viewport.h})`);
    if (geometry.codePaneShare < 0.7) failures.push(`code pane uses only ${(geometry.codePaneShare * 100).toFixed(0)}% of viewport height (expected >= 70%)`);
    for (const [name, result] of Object.entries(geometry.hits)) {
        if (result !== 'ok') failures.push(`${name} control not clickable: ${result}`);
    }

    await page.screenshot({ path: join(extensionPath, 'smoke-editor.png') });

    // Close must work with a plain click.
    await page.click('#btnEditorClose');
    await page.waitForFunction(() => !document.getElementById('editorOverlay').classList.contains('active'), { timeout: 10000 });

    if (failures.length > 0) {
        throw new Error(`Editor smoke failed: ${failures.join('; ')}`);
    }

    console.log(`Editor smoke passed: overlay full-viewport, code pane ${(geometry.codePaneShare * 100).toFixed(0)}% of viewport, all ${Object.keys(geometry.hits).length} controls hit-testable, close works.`);
    console.log('Screenshot: smoke-editor.png');
    if (pageErrors.length > 0) {
        console.warn(`Editor smoke observed ${pageErrors.length} console/page error(s):`);
        pageErrors.slice(0, 5).forEach(error => console.warn(`- ${error}`));
    }
} finally {
    if (browser) await browser.close();
    await rm(userDataDir, { recursive: true, force: true });
}
