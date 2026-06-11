import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

function source(path) {
  return readFileSync(resolve(ROOT, path), 'utf8');
}

describe('GM_download service-worker restart recovery', () => {
  it('persists pending download callback metadata in chrome.storage.session', () => {
    const core = source('src/background/core.ts');

    expect(core).toContain("_PD_KEY: 'sessionPendingDownloads'");
    expect(core).toContain('persistPendingDownloads()');
    expect(core).toContain('if (!self._pendingDownloads) self._pendingDownloads = new Map();');
    expect(core).toContain('self._pendingDownloads.set(id, v);');
    expect(core).toContain('SessionState.persistPendingDownloads();');
  });

  it('tracks GM_download callbacks without per-download onChanged listeners', () => {
    const core = source('src/background/core.ts');
    const gmDownloadBlock = core.match(/case 'GM_download': \{[\s\S]*?case 'GM_notification': \{/);

    expect(gmDownloadBlock?.[0]).toContain('trackPendingDownload(downloadId');
    expect(gmDownloadBlock?.[0]).toContain('await reconcilePendingDownload(downloadId, tracker, Date.now());');
    expect(gmDownloadBlock?.[0]).not.toContain('chrome.downloads.onChanged.addListener(dlListener)');
    expect(gmDownloadBlock?.[0]).not.toContain('chrome.downloads.onChanged.removeListener(dlListener)');
  });

  it('reattaches a single global downloads listener and reconciles on startup', () => {
    const core = source('src/background/core.ts');

    expect(core).toContain('chrome.downloads.onChanged.addListener(async (delta) => {');
    expect(core).toContain('handlePendingDownloadDelta(delta);');
    expect(core).toContain('await SessionState.hydrate();');
    expect(core).toContain("await reconcilePendingDownloads('startup');");
    expect(core).toContain('await chrome.downloads.search({ id });');
  });

  it('routes terminal events and timeout alarms through one cleanup path', () => {
    const core = source('src/background/core.ts');

    expect(core).toContain("sendPendingDownloadEvent(id, tracker, 'load'");
    expect(core).toContain("sendPendingDownloadEvent(id, tracker, 'error'");
    expect(core).toContain("sendPendingDownloadEvent(id, tracker, 'timeout'");
    expect(core).toContain('cleanupPendingDownload(id);');
    expect(core).toContain('GM_DOWNLOAD_TIMEOUT_ALARM_PREFIX');
    expect(core).toContain('GM_DOWNLOAD_SAFETY_ALARM_PREFIX');
    expect(core).toContain('await handlePendingDownloadTimeoutAlarm(downloadId);');
    expect(core).toContain("cleanupPendingDownload(downloadId, { clearAlarms: false });");
  });
});
