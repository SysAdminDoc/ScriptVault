import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  FetchFreshness,
  buildFreshnessInit,
  isConditionalIntent,
  readResponseValidators,
  shouldStoreValidators,
  sourceAgeMs,
} from '../src/background/fetch-freshness.ts';

const ROOT = process.cwd();

function fakeResponse(headers = {}) {
  const lower = new Map(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
  return { headers: { get: (name) => (lower.has(String(name).toLowerCase()) ? lower.get(String(name).toLowerCase()) : null) } };
}

describe('fetch freshness policy', () => {
  it('never lets the shared HTTP cache answer a remote content read', () => {
    for (const intent of FetchFreshness.INTENTS) {
      expect(buildFreshnessInit(intent).cache).toBe('no-store');
    }
  });

  it('sends stored validators only for the scheduled intents', () => {
    const validators = { etag: 'W/"abc"', lastModified: 'Wed, 21 Oct 2026 07:28:00 GMT' };

    const scheduled = buildFreshnessInit('scheduled-update', validators);
    expect(scheduled.headers['If-None-Match']).toBe('W/"abc"');
    expect(scheduled.headers['If-Modified-Since']).toBe('Wed, 21 Oct 2026 07:28:00 GMT');

    const feed = buildFreshnessInit('scheduled-feed', validators);
    expect(feed.headers['If-None-Match']).toBe('W/"abc"');

    for (const intent of ['manual-update', 'manual-feed', 'feed-script', 'install']) {
      const init = buildFreshnessInit(intent, validators);
      expect(init.headers['If-None-Match']).toBeUndefined();
      expect(init.headers['If-Modified-Since']).toBeUndefined();
      expect(isConditionalIntent(intent)).toBe(false);
    }
  });

  it('treats an unknown intent as unconditional rather than sending validators', () => {
    const init = buildFreshnessInit('not-an-intent', { etag: 'W/"abc"' });
    expect(init.headers['If-None-Match']).toBeUndefined();
    expect(init.cache).toBe('no-store');
    expect(isConditionalIntent('not-an-intent')).toBe(false);
    expect(shouldStoreValidators(undefined)).toBe(false);
  });

  it('refuses validators that could split the request, and empty ones', () => {
    const init = buildFreshnessInit('scheduled-update', {
      etag: 'W/"abc"\r\nX-Injected: 1',
      lastModified: '   ',
    });
    expect(init.headers['If-None-Match']).toBeUndefined();
    expect(init.headers['If-Modified-Since']).toBeUndefined();
  });

  it('carries caller init and headers through but keeps cache authority', () => {
    const signal = Symbol('signal');
    const init = buildFreshnessInit('install', {
      headers: { Accept: 'text/plain' },
      init: { signal, cache: 'force-cache', method: 'GET' },
    });
    expect(init.headers.Accept).toBe('text/plain');
    expect(init.signal).toBe(signal);
    expect(init.method).toBe('GET');
    expect(init.cache).toBe('no-store');
  });

  it('reads validators for storing intents and refuses to clear a working pair', () => {
    expect(readResponseValidators('scheduled-update', fakeResponse({ etag: 'W/"1"' })))
      .toEqual({ etag: 'W/"1"', lastModified: '' });
    expect(readResponseValidators('manual-update', fakeResponse({ 'last-modified': 'Wed, 21 Oct 2026 07:28:00 GMT' })))
      .toEqual({ etag: '', lastModified: 'Wed, 21 Oct 2026 07:28:00 GMT' });

    // No validators on the response: null, so the caller keeps what it had.
    expect(readResponseValidators('scheduled-update', fakeResponse({}))).toBeNull();
    // Intents that install a body do not own the script's validator state.
    expect(readResponseValidators('install', fakeResponse({ etag: 'W/"1"' }))).toBeNull();
    expect(readResponseValidators('feed-script', fakeResponse({ etag: 'W/"1"' }))).toBeNull();
    expect(readResponseValidators('scheduled-update', null)).toBeNull();
  });

  it('reports source age only for a real timestamp', () => {
    expect(sourceAgeMs(1000, 4000)).toBe(3000);
    expect(sourceAgeMs(5000, 4000)).toBe(0);
    expect(sourceAgeMs(0)).toBeNull();
    expect(sourceAgeMs(null)).toBeNull();
    expect(sourceAgeMs('nope')).toBeNull();
  });
});

describe('freshness policy is wired into the shipped service worker', () => {
  const core = readFileSync(resolve(ROOT, 'background.core.js'), 'utf8');
  const background = readFileSync(resolve(ROOT, 'background.js'), 'utf8');

  it('ships the policy module ahead of the core bridge', () => {
    const moduleAt = background.indexOf('const FetchFreshness = (() => {');
    const coreAt = background.indexOf('const UpdateSystem = {');
    expect(moduleAt).toBeGreaterThan(-1);
    expect(coreAt).toBeGreaterThan(moduleAt);
  });

  it('routes the update check, subscription, and install fetches through the policy', () => {
    expect(core).toContain("const intent = isManualSingle ? 'manual-update' : 'scheduled-update';");
    expect(core).toContain('FetchFreshness.buildFreshnessInit(intent, {');
    expect(core).toContain('FetchFreshness.readResponseValidators(intent, response)');
    expect(core).toContain("FetchFreshness.buildFreshnessInit('install', {");
    expect(core).toContain("const intent = options.intent || 'scheduled-feed';");
    // No remaining bare fetch of remote userscript content.
    expect(core).not.toContain("await fetch(url, { signal: controller.signal })");
    expect(core).not.toContain("await fetch(linkUrl, { signal: controller.signal })");
  });

  it('keeps 304 handling on both conditional paths', () => {
    expect(core).toContain('if (response.status === 304) {');
    expect(core).toContain('return { notModified: true, text: \'\', response };');
    expect(core).toContain('if (feed.notModified) {');
  });
});
