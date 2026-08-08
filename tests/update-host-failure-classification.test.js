// Greasy Fork is the dominant update host, and it has served both Cloudflare
// challenge pages (greasyfork#1553) and expired-certificate error pages (#1561).
// That HTML used to reach parseUserscript and surface as a generic "Parse
// failed" — telling the user their SCRIPT was broken rather than the host — while
// the exponential-backoff ring, which treats every failure alike, quietly drove
// the affected scripts toward never checking again.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileFunction } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

import {
  classifyFetchError,
  classifyRemoteResponse,
  isTransportError,
  looksLikeHostChallenge,
  looksLikeHtml,
} from '../src/background/remote-response-classifier.ts';

const ROOT = process.cwd();
const core = readFileSync(resolve(ROOT, 'background.core.js'), 'utf8');

const CLOUDFLARE_CHALLENGE = `<!DOCTYPE html><html><head><title>Just a moment...</title>
<script src="/cdn-cgi/challenge-platform/h/b/orchestrate/chl_page/v1"></script></head>
<body class="no-js"><div id="cf-wrapper">Enable JavaScript and cookies to continue</div></body></html>`;

const HTML_ERROR_PAGE = `<!DOCTYPE html><html><head><title>502 Bad Gateway</title></head>
<body><h1>502 Bad Gateway</h1><p>nginx</p></body></html>`;

const REAL_SCRIPT = `// ==UserScript==
// @name Fine
// @version 2.0.0
// ==/UserScript==
console.log('ok');`;

describe('host-challenge detection', () => {
  it('recognises a Cloudflare interstitial', () => {
    expect(looksLikeHostChallenge(CLOUDFLARE_CHALLENGE, 403)).toBe(true);
    expect(looksLikeHostChallenge(CLOUDFLARE_CHALLENGE, 200)).toBe(true);
  });

  it('recognises an HTML body behind a 403/429/503 as a challenge or rate limit', () => {
    expect(looksLikeHostChallenge('<html><body>nope</body></html>', 429)).toBe(true);
    expect(looksLikeHostChallenge('<html><body>nope</body></html>', 503)).toBe(true);
    // A JSON refusal at the same status is an ordinary answer, not a challenge.
    expect(looksLikeHostChallenge('{"error":"rate limited"}', 429)).toBe(false);
  });

  it('does not mistake a real userscript for a challenge', () => {
    expect(looksLikeHostChallenge(REAL_SCRIPT, 200)).toBe(false);
    expect(looksLikeHtml(REAL_SCRIPT)).toBe(false);
  });
});

describe('transport-error detection', () => {
  it.each([
    'Failed to fetch',
    'NetworkError when attempting to fetch resource.',
    'net::ERR_CERT_DATE_INVALID',
    'unable to verify the first certificate',
    'getaddrinfo ENOTFOUND update.greasyfork.org',
    'ECONNREFUSED',
    'The operation timed out',
  ])('classifies %s as transport', (message) => {
    expect(isTransportError(new Error(message))).toBe(true);
  });

  it('does not classify an ordinary application error as transport', () => {
    expect(isTransportError(new Error('Response too large (60 MB).'))).toBe(false);
    expect(isTransportError(null)).toBe(false);
  });
});

describe('classifying a completed response', () => {
  it('reports a Cloudflare challenge as a host problem and names the host', () => {
    const failure = classifyRemoteResponse({
      url: 'https://update.greasyfork.org/scripts/1/x.user.js',
      status: 403,
      contentType: 'text/html; charset=UTF-8',
      body: CLOUDFLARE_CHALLENGE,
    });
    expect(failure.kind).toBe('host-challenge');
    expect(failure.hostLevel).toBe(true);
    expect(failure.host).toBe('update.greasyfork.org');
    expect(failure.message).toContain('update.greasyfork.org');
    expect(failure.message).toContain('browser-check page');
    // The user must be told their script is fine.
    expect(failure.message).toContain('script itself is unchanged');
  });

  it('reports an HTTP error status as a host problem', () => {
    const failure = classifyRemoteResponse({
      url: 'https://api.greasyfork.org/x.user.js',
      status: 500,
      body: '',
    });
    expect(failure.kind).toBe('http-status');
    expect(failure.hostLevel).toBe(true);
    expect(failure.message).toContain('HTTP 500');
    expect(failure.message).toContain('Nothing is wrong with the installed script');
  });

  it('reports an HTML error page served with 200 as not-a-userscript', () => {
    const failure = classifyRemoteResponse({
      url: 'https://example.com/x.user.js',
      status: 200,
      contentType: 'text/html',
      body: HTML_ERROR_PAGE,
    });
    expect(failure.kind).toBe('not-a-userscript');
    expect(failure.hostLevel).toBe(true);
    expect(failure.message).toContain('served a web page instead of a userscript');
  });

  it('reports a truncated body with no metadata block', () => {
    const failure = classifyRemoteResponse({
      url: 'https://example.com/x.user.js',
      status: 200,
      contentType: 'application/javascript',
      body: 'console.log("half a file',
    });
    expect(failure.kind).toBe('not-a-userscript');
    expect(failure.message).toContain('not a userscript');
    expect(failure.message).toContain('truncated');
  });

  // The one case that IS about the script, so it must still count against it.
  it('reports a real userscript with bad metadata as a parse error, not host-level', () => {
    const failure = classifyRemoteResponse({
      url: 'https://example.com/x.user.js',
      status: 200,
      contentType: 'application/javascript',
      body: '// ==UserScript==\n// @name \n// ==/UserScript==\n',
      parseError: 'Missing @name',
    });
    expect(failure.kind).toBe('parse-error');
    expect(failure.hostLevel).toBe(false);
    expect(failure.message).toContain('Missing @name');
  });

  it('returns null for a healthy userscript response', () => {
    expect(classifyRemoteResponse({
      url: 'https://example.com/x.user.js',
      status: 200,
      contentType: 'application/javascript',
      body: REAL_SCRIPT,
    })).toBeNull();
  });
});

describe('classifying a fetch that never completed', () => {
  it('names the host and says it is not the script', () => {
    const failure = classifyFetchError(
      'https://update.greasyfork.org/scripts/1/x.user.js',
      new Error('net::ERR_CERT_DATE_INVALID'),
    );
    expect(failure.kind).toBe('transport');
    expect(failure.hostLevel).toBe(true);
    expect(failure.host).toBe('update.greasyfork.org');
    expect(failure.message).toContain('not with the script');
  });
});

// The operational half: a host outage must not push the script's own retry ring
// toward silence, but a bad body must.
describe('the update checker does not punish a script for its host', () => {
  function loadRecorder() {
    const scripts = new Map();
    const logged = [];
    const body = `${extractFn(core, '_recordUpdateHostFailure')}
return _recordUpdateHostFailure;`;
    const fn = compileFunction(body, ['ScriptStorage', 'ErrorLog'], {
      filename: resolve(ROOT, 'background.core.js'),
    })(
      { set: async (id, script) => { scripts.set(id, script); } },
      { log: async (entry) => { logged.push(entry); } },
    );
    // The helper is a method using `this._nextRetryAt`.
    const receiver = {
      _recordUpdateHostFailure: fn,
      _nextRetryAt: (failures) => 1000 * failures,
    };
    return { host: receiver, scripts, logged };
  }

  function extractFn(source, name) {
    const marker = `async _recordUpdateHostFailure(`;
    const at = source.indexOf(marker);
    if (at === -1) throw new Error(`${name} not found`);
    let depth = 0;
    for (let i = source.indexOf('{', at); i < source.length; i += 1) {
      if (source[i] === '{') depth += 1;
      else if (source[i] === '}') {
        depth -= 1;
        if (depth === 0) {
          // Rewrite the object-method shorthand into a standalone function that
          // takes its receiver explicitly.
          // Keep `this._nextRetryAt` intact and supply the receiver via .call(),
          // so the extracted code is the shipped code.
          const methodSource = source.slice(at, i + 1);
          return methodSource.replace(marker, 'async function _recordUpdateHostFailure(');
        }
      }
    }
    throw new Error('unbalanced');
  }

  it('records a host failure without advancing the backoff ring', async () => {
    const { host, scripts, logged } = loadRecorder();
    const script = { id: 's1', meta: { name: 'Victim' }, _updateFailureCount: 0, _updateNextCheck: 0 };

    await host._recordUpdateHostFailure.call(
      host,
      script,
      { kind: 'host-challenge', hostLevel: true, message: 'challenge page', host: 'update.greasyfork.org' },
      'https://update.greasyfork.org/x.user.js',
    );

    // The whole point: a Cloudflare challenge must not escalate this script's
    // cooldown toward the 24h cap.
    expect(script._updateFailureCount).toBe(0);
    expect(script._updateNextCheck).toBe(0);
    expect(script._updateLastFailure).toMatchObject({ kind: 'host-challenge', host: 'update.greasyfork.org' });
    expect(scripts.get('s1')).toBe(script);
    expect(logged[0]).toMatchObject({ source: 'update-check', context: 'host-challenge' });
  });

  it('does advance the ring for a body that is genuinely bad', async () => {
    const { host } = loadRecorder();
    const script = { id: 's1', meta: { name: 'Victim' }, _updateFailureCount: 2, _updateNextCheck: 0 };

    await host._recordUpdateHostFailure.call(
      host,
      script,
      { kind: 'parse-error', hostLevel: false, message: 'Missing @name', host: 'example.com' },
      'https://example.com/x.user.js',
    );

    expect(script._updateFailureCount).toBe(3);
    expect(script._updateNextCheck).toBe(3000);
  });
});

describe('the shipped update path routes failures through the classifier', () => {
  it('classifies a non-2xx response instead of bumping the ring inline', () => {
    expect(core).toContain('RemoteResponseClassifier.classifyRemoteResponse({');
    expect(core).toContain('await this._recordUpdateHostFailure(script, failure, updateUrl);');
  });

  it('classifies a 2xx body before treating a parse failure as the script\'s fault', () => {
    const at = core.indexOf('const bodyFailure = RemoteResponseClassifier.classifyRemoteResponse({');
    const parseAt = core.indexOf('if (parsed.error) continue;');
    expect(at).toBeGreaterThan(-1);
    expect(parseAt).toBeGreaterThan(at);
  });

  it('classifies a thrown fetch as a transport failure', () => {
    expect(core).toContain("RemoteResponseClassifier.classifyFetchError(updateUrl, e, 'Update')");
  });

  it('ships the classifier ahead of the core bridge', () => {
    const background = readFileSync(resolve(ROOT, 'background.js'), 'utf8');
    const moduleAt = background.indexOf('const RemoteResponseClassifier = (() => {');
    const coreAt = background.indexOf('async _recordUpdateHostFailure(');
    expect(moduleAt).toBeGreaterThan(-1);
    expect(coreAt).toBeGreaterThan(moduleAt);
  });
});
