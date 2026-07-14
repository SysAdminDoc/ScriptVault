import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createLocalLibrarySnapshot } from '../src/background/local-libraries.ts';
import { buildWrappedScript } from '../src/background/wrapper-builder.ts';

const dashboardHtml = readFileSync(resolve(process.cwd(), 'pages/dashboard.html'), 'utf8');
const dashboardJs = readFileSync(resolve(process.cwd(), 'pages/dashboard.js'), 'utf8');
const installHtml = readFileSync(resolve(process.cwd(), 'pages/install.html'), 'utf8');
const installJs = readFileSync(resolve(process.cwd(), 'pages/install.js'), 'utf8');
const coreTs = readFileSync(resolve(process.cwd(), 'src/background/core.ts'), 'utf8');
const cloudSyncTs = readFileSync(resolve(process.cwd(), 'src/background/cloud-sync.ts'), 'utf8');
const easyCloudTs = readFileSync(resolve(process.cwd(), 'src/modules/sync-easycloud.ts'), 'utf8');
const storageTs = readFileSync(resolve(process.cwd(), 'src/storage/script-db.ts'), 'utf8');

function extractFunction(source, name) {
  const match = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(source);
  if (!match) throw new Error(`Function ${name} not found`);
  const start = match.index;
  const openParen = source.indexOf('(', start);
  let parenDepth = 0;
  let closeParen = -1;
  for (let index = openParen; index < source.length; index += 1) {
    if (source[index] === '(') parenDepth += 1;
    if (source[index] === ')') parenDepth -= 1;
    if (parenDepth === 0) {
      closeParen = index;
      break;
    }
  }
  const brace = source.indexOf('{', closeParen);
  let depth = 0;
  for (let index = brace; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Function ${name} did not close`);
}

function makeScript(localLibraries) {
  return {
    id: 'script_local_library_test',
    code: '// ==UserScript==\n// @name Local library test\n// @match https://example.com/*\n// @grant none\n// ==/UserScript==\nwindow.__mainMarker = true;',
    enabled: true,
    position: 0,
    settings: { localLibraries },
    meta: {
      name: 'Local library test', namespace: 'tests', version: '1.0.0', description: '', author: '',
      icon: '', icon64: '', homepage: '', homepageURL: '', website: '', source: '', updateURL: '',
      downloadURL: '', supportURL: '', license: '', copyright: '', contributionURL: '',
      match: ['https://example.com/*'], include: [], exclude: [], excludeMatch: [], matchTop: [], excludeTop: [],
      'run-at': 'document-idle', 'inject-into': 'auto', module: '', noframes: false, unwrap: false,
      sandbox: '', 'run-in': '', grant: ['none'], require: [], requireProvenance: [], requireIdentity: [],
      resource: {}, connect: [], 'top-level-await': false, webRequest: null, config: [], priority: 0,
      weight: 0, background: false, isolationCookie: false, antifeature: [], tag: [], compatible: [], incompatible: [],
    },
    createdAt: 1,
    updatedAt: 1,
  };
}

describe('local shared-library workflow', () => {
  it('injects reviewed local snapshots after remote requires and before userscript code', async () => {
    const created = await createLocalLibrarySnapshot({ name: 'helpers.js', code: 'window.__localMarker = true;' });
    if (!created.ok) throw new Error(created.error);
    const wrapped = buildWrappedScript(makeScript([created.snapshot]), [{
      url: 'https://cdn.example/remote.js',
      code: 'window.__remoteMarker = true;',
    }], {}, [], []);
    expect(wrapped.indexOf('window.__remoteMarker = true;')).toBeLessThan(wrapped.indexOf('window.__localMarker = true;'));
    expect(wrapped.indexOf('window.__localMarker = true;')).toBeLessThan(wrapped.indexOf('window.__mainMarker = true;'));
    expect(wrapped).toContain(`local-library://helpers.js#sha256=${created.snapshot.sha256}`);
  });

  it('ships an accessible Externals workflow with explicit security and portability copy', () => {
    expect(dashboardHtml).toContain('id="btnAttachLocalLibrary"');
    expect(dashboardHtml).toContain('aria-describedby="localLibraryHelp localLibraryStatus"');
    expect(dashboardHtml).toContain('id="localLibraryStatus" role="status" aria-live="polite"');
    expect(dashboardHtml).toContain('file handles and local paths stay on this device');
    expect(dashboardHtml).toContain('Plain .user.js exports do not include snapshots');
    expect(dashboardHtml).toContain('../modules/local-libraries.js');

    const attach = extractFunction(dashboardJs, 'attachLocalLibrary');
    const pickerIndex = attach.indexOf('await window.showOpenFilePicker');
    expect(pickerIndex).toBeGreaterThan(0);
    expect(attach.slice(0, pickerIndex)).not.toContain('await ');
    expect(attach).toContain('confirmLocalLibraryReview');
    expect(attach).toContain("bindingKind: 'library'");
    expect(attach).toContain('lastKnownSha256: result.snapshot.sha256');
  });

  it('routes manual and FileSystemObserver refreshes through review before replacing snapshots', () => {
    const observed = extractFunction(dashboardJs, 'runLocalWorkspaceObservedRefresh');
    const refresh = extractFunction(dashboardJs, 'refreshLocalLibraryBinding');
    expect(observed).toContain("slot.bindingKind === 'library'");
    expect(observed).toContain('refreshLocalLibraryBinding(slot.scriptId, slot.libraryId');
    expect(refresh).toContain('requestLocalWorkspacePermission(bindingRecord.handle');
    expect(refresh).toContain('confirmLocalLibraryReview');
    expect(refresh.indexOf('confirmLocalLibraryReview')).toBeLessThan(refresh.indexOf('saveLocalLibrariesForScript'));
    expect(refresh).toContain("lastStatusKind: 'unchanged'");
    expect(refresh).toContain("lastStatusKind: 'review-cancelled'");
    expect(refresh).toContain("lastStatusKind: 'applied'");
  });

  it('keeps handles local while making normalized snapshots portable', () => {
    expect(storageTs).toContain("bindingKind?: 'script' | 'library'");
    expect(storageTs).toContain('libraryId?: string');
    expect(coreTs).toContain("'localLibraries'");
    expect(coreTs).toContain('LocalLibraries.normalizeLocalLibrarySnapshots(sanitized.localLibraries)');
    expect(cloudSyncTs).toContain("'localLibraries'");
    expect(cloudSyncTs).toContain('normalizeLocalLibrarySnapshots(value)');
    expect(easyCloudTs).toContain("'localLibraries'");
    expect(easyCloudTs).toContain('normalizeLocalLibrarySnapshots(value)');
    expect(dashboardJs).not.toMatch(/localLibraries\s*:\s*[^\n]*(?:absolutePath|localFilePath|handle)/);
  });

  it('warns during update review that existing local snapshots remain active', () => {
    expect(installHtml).toContain('../modules/local-libraries.js');
    expect(installJs).toContain('Reviewed Local Libraries Remain Active');
    expect(installJs).toContain('These portable snapshots run after remote @require code and before the userscript');
    expect(installJs).toContain('File handles and local paths stay on the original device');
    expect(installJs).toContain("{ id: 'reviewLocalLibraries', label: 'Local libraries' }");
  });
});
