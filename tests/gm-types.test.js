import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const DECLARATION_PATH = resolve(ROOT, 'lib/scriptvault.d.ts');
const GENERATOR_PATH = resolve(ROOT, 'scripts/generate-gm-types.mjs');
const TSC_PATH = resolve(ROOT, 'node_modules/typescript/bin/tsc');
const tempDirs = [];

function runNode(args) {
  try {
    return execFileSync(process.execPath, args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: 'pipe',
    });
  } catch (error) {
    const stdout = error.stdout ? `\nstdout:\n${error.stdout}` : '';
    const stderr = error.stderr ? `\nstderr:\n${error.stderr}` : '';
    throw new Error(`Command failed: ${process.execPath} ${args.join(' ')}${stdout}${stderr}`);
  }
}

describe('GM ambient declarations', () => {
  afterAll(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('is generated, checked, and included by the Chrome package path', () => {
    const packageJson = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
    const esbuildConfig = readFileSync(resolve(ROOT, 'esbuild.config.mjs'), 'utf8');
    const buildScript = readFileSync(resolve(ROOT, 'build.sh'), 'utf8');
    const declaration = readFileSync(DECLARATION_PATH, 'utf8');

    expect(packageJson.scripts['gm-types:generate']).toBe('node scripts/generate-gm-types.mjs');
    expect(packageJson.scripts['gm-types:check']).toBe('node scripts/generate-gm-types.mjs --check');
    expect(esbuildConfig).toContain('generateGmTypes');
    expect(buildScript).toMatch(/^\s+lib\s*$/m);
    expect(existsSync(DECLARATION_PATH)).toBe(true);
    expect(declaration).toContain('declare const GM: GMAsyncApi;');
    expect(declaration).toContain('declare const GM_cookie: GMCookieCallbackApi;');
    expect(declaration).toContain('declare function GM_updateNotification');
    expect(declaration).toContain('declare function GM_getResourceURL(name: string, isBlobUrl?: boolean): Promise<string | null>;');
    expect(declaration).not.toContain('GM_closeTab');
  });

  it('keeps the generated file in sync with the generator', () => {
    expect(runNode([GENERATOR_PATH, '--check'])).toContain('[gm-types] ok');
  });

  it('typechecks a sample TypeScript userscript against the ambient API', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'scriptvault-gm-types-'));
    tempDirs.push(tempDir);
    const samplePath = join(tempDir, 'sample.user.ts');
    const declarationReference = DECLARATION_PATH.replace(/\\/g, '/');

    writeFileSync(samplePath, `/// <reference path="${declarationReference}" />
async function main() {
  const count = GM_getValue<number>('count', 0);
  GM_setValue('count', count + 1);
  const values = GM_getValues({ theme: 'dark', count: 0 });
  const keyCount = GM_listValues().length + Object.keys(values).length;

  const xhr = GM_xmlhttpRequest<{ ok: boolean }>({
    url: 'https://example.com/api',
    responseType: 'json',
    onload(response) {
      const ok: boolean | undefined = response.response?.ok;
      console.log(ok);
    },
  });
  xhr.abort();

  const asyncResponse = GM.xmlHttpRequest<{ ok: boolean }>({ url: 'https://example.com/api' });
  asyncResponse.abort();
  await asyncResponse;

  const tab = GM_openInTab('https://example.com', { active: true });
  tab?.close();

  const notification = GM_notification({
    title: 'ScriptVault',
    text: 'Done',
    buttons: [{ title: 'Open' }],
    onbuttonclick(event) {
      const index: number = event.buttonClickIndex;
      console.log(index);
    },
  });
  notification?.update({ progress: 50 });
  notification?.close();
  GM_updateNotification('status', { text: 'Updated' });
  GM_closeNotification('status');

  const style = await GM.addStyle('body { color: red; }');
  style.dataset.scriptvault = 'sample';
  const link = GM_addElement('a', { href: 'https://example.com', textContent: 'Open' });
  link?.click();

  const resourceUrl = await GM_getResourceURL('icon', true);
  const asyncResourceUrl = await GM.getResourceUrl('icon');
  console.log(resourceUrl, asyncResourceUrl, keyCount);

  await GM_loadScript('https://cdn.example.com/lib.js', { timeout: 500, force: true });
  await GM.loadScript('https://cdn.example.com/lib.js');

  GM_cookie.list({ domain: 'example.com' }, (cookies, error) => {
    console.log(cookies.at(0)?.name, error?.message);
  });
  await GM.cookies.list({ domain: 'example.com' });

  GM_audio.setMute({ mute: true }, error => console.log(error?.message));
  GM_audio.getState(state => {
    const muted: boolean | undefined = state?.muted;
    console.log(muted);
  });

  GM_webRequest([{ selector: { url: '*://example.com/*' }, action: { cancel: true } }]);
  GM_head('https://example.com', response => console.log(response.status));
  GM_addValueChangeListener('count', (name, oldValue, newValue, remote) => {
    const changedRemotely: boolean = remote;
    console.log(name, oldValue, newValue, changedRemotely);
  });

  onurlchange = detail => {
    const nextUrl: string = detail.url;
    console.log(nextUrl);
  };
  unsafeWindow.customProperty = 'ok';
}

main();
`, 'utf8');

    runNode([
      TSC_PATH,
      '--noEmit',
      '--ignoreConfig',
      '--target',
      'ES2022',
      '--module',
      'ESNext',
      '--lib',
      'DOM,ES2022',
      '--skipLibCheck',
      samplePath,
    ]);
  });
});
