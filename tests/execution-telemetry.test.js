import { describe, expect, it, vi } from 'vitest';
import {
  createExecutionTelemetryHandler,
  normalizeBridgeTelemetry,
} from '../src/background/execution-telemetry.ts';

function createHarness() {
  let clock = 1_000_000;
  const scripts = new Map([
    ['attacker', { id: 'attacker', meta: { name: 'Attacker' } }],
    ['victim', { id: 'victim', meta: { name: 'Victim' } }],
  ]);
  const diagnostics = [];
  const networkLog = [];
  const errorLog = [];
  const scheduleStatsSave = vi.fn();
  const triggerAfterScript = vi.fn();
  const handler = createExecutionTelemetryHandler({
    getScript: async id => scripts.get(id),
    recordDiagnostic: (sender, event) => diagnostics.push({ sender, event }),
    scheduleStatsSave,
    triggerAfterScript,
    addNetworkLog: entry => networkLog.push(entry),
    getStatsUrlRetention: () => 'origin',
    retainStatsUrl: url => new URL(url).origin,
    logExecutionError: entry => errorLog.push(entry),
    now: () => clock,
  });
  return {
    handler,
    scripts,
    diagnostics,
    networkLog,
    errorLog,
    scheduleStatsSave,
    triggerAfterScript,
    advance: milliseconds => { clock += milliseconds; },
  };
}

describe('execution telemetry trust boundary', () => {
  it('downgrades page telemetry without accepting script attribution or firing chains', async () => {
    const harness = createHarness();
    const response = await harness.handler.handleBridgeTelemetry({
      kind: 'execution-time',
      duration: 12.5,
      scriptId: 'victim',
      completionId: 'forged-completion-id',
    }, {
      tab: { id: 7, url: 'https://page.example/private?token=secret' },
      documentId: 'document-1',
    });

    expect(response).toEqual({ success: true, trusted: false });
    expect(harness.scripts.get('victim').stats).toBeUndefined();
    expect(harness.triggerAfterScript).not.toHaveBeenCalled();
    expect(harness.scheduleStatsSave).not.toHaveBeenCalled();
    expect(harness.diagnostics).toEqual([
      expect.objectContaining({
        event: {
          type: 'run',
          duration: 12.5,
          url: 'https://page.example/private?token=secret',
        },
      }),
    ]);
    expect(harness.diagnostics[0].event).not.toHaveProperty('scriptId');
  });

  it('uses authenticated sender identity and processes each completion stage once', async () => {
    const harness = createHarness();
    const sender = {
      userScriptId: 'attacker',
      tab: { id: 9, url: 'https://sender.example/' },
      documentId: 'document-2',
      frameId: 0,
    };
    const payload = {
      scriptId: 'victim',
      completionId: 'completion_1234567890',
      time: 8,
      url: 'https://sender.example/path?secret=1',
    };

    await expect(harness.handler.handleTrustedTelemetry('reportExecTime', payload, sender))
      .resolves.toEqual({ success: true, trusted: true });
    await expect(harness.handler.handleTrustedTelemetry('reportExecTime', payload, sender))
      .resolves.toEqual({ success: true, trusted: true, duplicate: true });

    expect(harness.scripts.get('victim').stats).toBeUndefined();
    expect(harness.scripts.get('attacker').stats).toMatchObject({
      runs: 1,
      totalTime: 8,
      avgTime: 8,
      lastUrl: 'https://sender.example',
      lastTabId: 9,
      lastDocumentId: 'document-2',
      lastFrameId: 0,
    });
    expect(harness.triggerAfterScript).toHaveBeenCalledTimes(1);
    expect(harness.triggerAfterScript).toHaveBeenCalledWith('attacker', expect.objectContaining({
      reason: 'afterScript',
      tabId: 9,
    }));
    expect(harness.scheduleStatsSave).toHaveBeenCalledTimes(1);
  });

  it('allows error and completion stages once each while rejecting unauthenticated reports', async () => {
    const harness = createHarness();
    const completionId = 'completion_abcdefghij';
    const sender = { userScriptId: 'victim', tab: { id: 3, url: 'https://example.test/' } };

    await expect(harness.handler.handleTrustedTelemetry('reportExecError', {
      completionId,
      error: 'boom',
      stack: 'x'.repeat(9000),
      source: 'scriptvault://userscript/victim/Victim.user.js',
      line: 17,
      col: 9,
      generatedLine: 917,
      generatedCol: 9,
    }, sender)).resolves.toEqual({ success: true, trusted: true });
    await expect(harness.handler.handleTrustedTelemetry('reportExecError', {
      completionId,
      error: 'boom',
    }, sender)).resolves.toEqual({ success: true, trusted: true, duplicate: true });
    await expect(harness.handler.handleTrustedTelemetry('reportExecTime', {
      completionId,
      time: 5,
    }, sender)).resolves.toEqual({ success: true, trusted: true });
    await expect(harness.handler.handleTrustedTelemetry('reportExecTime', {
      completionId,
      time: 5,
    }, { tab: { id: 3 } })).resolves.toEqual({
      error: 'Authenticated script identity is required',
      trusted: false,
    });

    expect(harness.scripts.get('victim').stats).toMatchObject({ errors: 1, runs: 1 });
    expect(harness.triggerAfterScript).toHaveBeenCalledTimes(1);
    expect(harness.errorLog).toEqual([expect.objectContaining({
      scriptId: 'victim',
      scriptName: 'Victim',
      error: 'boom',
      source: 'scriptvault://userscript/victim/Victim.user.js',
      line: 17,
      col: 9,
      generatedLine: 917,
      generatedCol: 9,
      context: 'script-execution',
    })]);
    expect(harness.errorLog[0].stack).toHaveLength(8000);
  });

  it('attributes trusted network telemetry from storage and leaves bridge entries unattributed', async () => {
    const harness = createHarness();
    await harness.handler.handleTrustedTelemetry('netlog_record', {
      scriptId: 'victim',
      scriptName: 'Forged name',
      url: 'https://api.example/data',
      method: 'post',
    }, { userScriptId: 'attacker' });
    await harness.handler.handleBridgeTelemetry({
      kind: 'network',
      url: 'https://page.example/data',
      scriptId: 'victim',
      scriptName: 'Forged name',
    }, { tab: { id: 4 }, documentId: 'document-4' });

    expect(harness.networkLog[0]).toMatchObject({
      scriptId: 'attacker',
      scriptName: 'Attacker',
      url: 'https://api.example/data',
      method: 'POST',
    });
    expect(harness.networkLog[1]).toMatchObject({ url: 'https://page.example/data' });
    expect(harness.networkLog[1]).not.toHaveProperty('scriptId');
    expect(harness.networkLog[1]).not.toHaveProperty('scriptName');
  });

  it('validates bridge schemas and enforces a bounded per-document rate', async () => {
    const harness = createHarness();
    expect(normalizeBridgeTelemetry({ kind: 'execution-time', duration: Number.POSITIVE_INFINITY })).toBeNull();
    expect(normalizeBridgeTelemetry({ kind: 'network', url: '', responseHeaders: { cookie: 'secret' } })).toBeNull();
    expect(normalizeBridgeTelemetry({
      kind: 'network',
      url: 'https://example.com/',
      scriptId: 'victim',
      responseHeaders: { cookie: 'secret' },
    })).toEqual({
      kind: 'network',
      url: 'https://example.com/',
      method: 'GET',
      type: 'fetch',
    });

    const sender = { tab: { id: 5 }, documentId: 'document-5' };
    for (let index = 0; index < 60; index += 1) {
      await expect(harness.handler.handleBridgeTelemetry({ kind: 'execution-time', duration: index }, sender))
        .resolves.toEqual({ success: true, trusted: false });
    }
    await expect(harness.handler.handleBridgeTelemetry({ kind: 'execution-time', duration: 61 }, sender))
      .resolves.toEqual({ error: 'Page telemetry rate limit exceeded', trusted: false });
    harness.advance(10_000);
    await expect(harness.handler.handleBridgeTelemetry({ kind: 'execution-time', duration: 1 }, sender))
      .resolves.toEqual({ success: true, trusted: false });
  });
});
