import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildWrappedScript } from '../src/background/wrapper-builder.ts';

const ROOT = process.cwd();

function source(path) {
  return readFileSync(resolve(ROOT, path), 'utf8');
}

function makeScript(grants) {
  return {
    id: 'gm-download-parity',
    code: '// ==UserScript==\n// @name Download parity\n// ==/UserScript==\n',
    enabled: true,
    position: 0,
    meta: {
      name: 'Download parity',
      namespace: 'sv',
      version: '1',
      description: '',
      author: '',
      icon: '',
      icon64: '',
      homepage: '',
      homepageURL: '',
      website: '',
      source: '',
      updateURL: '',
      downloadURL: '',
      supportURL: '',
      license: '',
      copyright: '',
      contributionURL: '',
      match: ['https://example.com/*'],
      include: [],
      exclude: [],
      excludeMatch: [],
      matchTop: [],
      excludeTop: [],
      'run-at': 'document-idle',
      'inject-into': 'auto',
      noframes: false,
      unwrap: false,
      sandbox: '',
      'run-in': '',
      grant: grants,
      require: [],
      resource: {},
      connect: ['example.com'],
      'top-level-await': false,
      webRequest: null,
      priority: 0,
      weight: 0,
      antifeature: [],
      tag: [],
      compatible: [],
      incompatible: [],
    },
    createdAt: 0,
    updatedAt: 0,
  };
}

describe('GM_download parity surface', () => {
  it('serializes Blob/File download sources in the userscript wrapper', () => {
    const wrapped = buildWrappedScript(makeScript(['GM_download']), [], 'test-ext-id', []);

    expect(wrapped).toContain('function _isDownloadBlobSource(value)');
    expect(wrapped).toContain('details instanceof File');
    expect(wrapped).toContain('await _downloadBlobToDataUrl(details)');
    expect(wrapped).toContain('await _downloadBlobToDataUrl(blob)');
    expect(wrapped).toContain("opts.hasCallbacks = !!(callbacks.onload || callbacks.onerror || callbacks.onprogress || callbacks.ontimeout)");
    expect(wrapped).toContain('result && result.downloadId && opts.hasCallbacks');
  });

  it('routes header and anonymous downloads through a bounded fetch bridge', () => {
    const core = source('src/background/core.ts');
    const gmDownloadBlock = core.match(/case 'GM_download': \{[\s\S]*?case 'GM_notification': \{/);

    expect(core).toContain('const GM_DOWNLOAD_FETCH_MAX_BYTES = 50 * 1024 * 1024;');
    expect(core).toContain('function downloadNeedsFetchBridge(data = {})');
    expect(core).toContain('async function responseToDownloadDataUrl(response)');
    expect(gmDownloadBlock?.[0]).toContain('downloadNeedsFetchBridge(data)');
    expect(gmDownloadBlock?.[0]).toContain('XhrManager.buildFetchOptions');
    expect(gmDownloadBlock?.[0]).toContain('withCookieHeaderSessionRule(data.url, cookieRouting.cookieHeader');
    expect(gmDownloadBlock?.[0]).toContain('downloadUrl = await responseToDownloadDataUrl(response);');
    expect(gmDownloadBlock?.[0]).toContain('filename: normalizeDownloadFilename(data.name, data.url, data.sourceName)');
  });

  it('routes partition-cookie options through the explicit fetch cookie bridge', () => {
    const core = source('src/background/core.ts');
    const wrapper = source('src/background/wrapper-builder.ts');
    const xhrBlock = core.match(/case 'GM_xmlhttpRequest': \{[\s\S]*?case 'GM_xmlhttpRequest_abort': \{/);
    const gmDownloadBlock = core.match(/case 'GM_download': \{[\s\S]*?case 'GM_notification': \{/);

    expect(core).toContain('function hasCookieRoutingOptions(data = {})');
    expect(core).toContain('async function prepareCookieRoutingForFetch(data = {}, apiName =');
    expect(core).toContain('chrome.cookies.getAll(details)');
    expect(core).toContain('chrome.declarativeNetRequest.updateSessionRules');
    expect(xhrBlock?.[0]).toContain("prepareCookieRoutingForFetch(data, 'GM_xmlhttpRequest')");
    expect(xhrBlock?.[0]).toContain("fetchOptions.credentials = 'omit'");
    expect(xhrBlock?.[0]).toContain('withCookieHeaderSessionRule(data.url, cookieRouting.cookieHeader');
    expect(gmDownloadBlock?.[0]).toContain("prepareCookieRoutingForFetch(data, 'GM_download')");
    expect(gmDownloadBlock?.[0]).toContain('downloadNeedsFetchBridge(data) || cookieRouting.applies');
    expect(gmDownloadBlock?.[0]).toContain("fetchOptions.credentials = 'omit'");
    expect(wrapper).toContain('partitionKey: details.partitionKey');
    expect(wrapper).toContain('cookiePartition: details.cookiePartition');
    expect(wrapper).toContain('cookieStoreId: details.cookieStoreId');
  });
});
