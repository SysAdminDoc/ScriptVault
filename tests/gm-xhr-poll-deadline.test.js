// Terminal GM_xmlhttpRequest events reach a userscript only through the wrapper's
// result poll, so that poll's deadline IS the request's effective lifetime. It
// used to be a fixed 600 ticks x 50 ms = 30 s, so a `timeout: 60000` request
// completed in the background while onload/onerror/onloadend never fired. The
// GM.fetch stream loop had the opposite problem: unbounded, and a bare
// {done:false} for an id the background had forgotten kept it polling forever.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const core = readFileSync(resolve(ROOT, 'background.core.js'), 'utf8');
const handlerSource = readFileSync(resolve(ROOT, 'src/background/gm-network-handler.ts'), 'utf8');

describe('the injected wrapper stays syntactically valid', () => {
  // The wrapper body is assembled as a TEMPLATE LITERAL inside the bridge, so an
  // unescaped backtick anywhere in it ends the literal early and turns the rest
  // of the bridge into garbage. `tsc --noEmit` does not catch it (the bridge is
  // emitted by a type-stripping pass, not by tsc), so parse the generated file.
  it('parses the generated bridge, which an unbalanced template would break', () => {
    const result = spawnSync(process.execPath, ['--check', resolve(ROOT, 'background.core.js')], {
      encoding: 'utf8',
    });
    expect(result.stderr || '').toBe('');
    expect(result.status).toBe(0);
  });

  it('keeps the poll and stream regions free of backticks', () => {
    const pollAt = core.indexOf('function pollXhrFinalResult(');
    expect(pollAt).toBeGreaterThan(-1);
    // Look backwards over the comment block that precedes it as well.
    const region = core.slice(pollAt - 900, pollAt + 1600);
    expect(region).not.toContain('`');

    const streamAt = core.indexOf('const streamPollDeadline = Date.now()');
    expect(streamAt).toBeGreaterThan(-1);
    expect(core.slice(streamAt - 700, streamAt + 900)).not.toContain('`');
  });
});

describe('the XHR result poll runs to the request\'s own deadline', () => {
  it('no longer caps every request at a fixed tick count', () => {
    expect(core).not.toContain('attempt < 600');
    expect(core).toContain('const xhrPollDeadline = Date.now()');
    expect(core).toContain("Number(details.timeout) > 0 ? Number(details.timeout) : 30000");
  });

  it('adds headroom over the request timeout rather than expiring exactly with it', () => {
    expect(core).toContain('const XHR_POLL_GRACE_MS = 15000;');
    expect(core).toContain('+ XHR_POLL_GRACE_MS;');
  });

  it('reports a poll that outlives its deadline instead of abandoning it silently', () => {
    expect(core).toContain("dispatchXhrTerminal('timeout', {");
    expect(core).toContain('No result from the background within the request timeout');
  });

  it('settles immediately when the background no longer knows the request', () => {
    expect(core).toContain('result.unknown === true');
    expect(core).toContain('Request was lost before it completed (the extension service worker restarted)');
  });
});

describe('the GM.fetch stream loop is bounded and stops on an unknown id', () => {
  it('has a wall-clock deadline instead of an unbounded loop', () => {
    expect(core).toContain('const streamPollDeadline = Date.now()');
    expect(core).toContain('GM.fetch stream timed out waiting for the background');
  });

  it('fails the stream when the background has forgotten the request', () => {
    expect(core).toContain('GM.fetch stream was lost before it completed (the extension service worker restarted)');
  });

  it('uses the named interval rather than a bare literal', () => {
    expect(core).toContain('const STREAM_POLL_INTERVAL_MS = 25;');
    expect(core).toContain('await _gmFetchDelay(STREAM_POLL_INTERVAL_MS);');
  });
});

describe('the background reports an unknown request id', () => {
  it('returns unknown:true for a request it has no record of', () => {
    expect(handlerSource).toContain('return { done: false, unknown: true };');
  });

  it('gives the same answer for another script\'s id, so ids cannot be probed', () => {
    // One combined branch: !request OR a foreign scriptId.
    expect(handlerSource).toContain("if (!request || request.scriptId !== ownedScriptId) return { done: false, unknown: true };");
  });

  it('still returns a plain done:false while a known request is in flight', () => {
    const resultCase = handlerSource.slice(
      handlerSource.indexOf("case 'GM_xmlhttpRequest_result': {"),
      handlerSource.indexOf("case 'GM_webSocket': {"),
    );
    expect(resultCase).toContain('if (!request.finalResult) return { done: false };');
  });
});
