import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const backgroundCore = readFileSync(resolve(process.cwd(), 'background.core.js'), 'utf8');
const popupSource = readFileSync(resolve(process.cwd(), 'pages/popup.js'), 'utf8');

describe('Firefox programmatic popup opening from alarms', () => {
  it('defines tryOpenPopup with feature-detect guard for chrome.action.openPopup', () => {
    expect(backgroundCore).toContain('async function tryOpenPopup(reason)');
    expect(backgroundCore).toContain("typeof chrome.action?.openPopup !== 'function'");
  });

  it('stores open reason in chrome.storage.session before opening', () => {
    expect(backgroundCore).toContain('sv_popup_open_reason');
    expect(backgroundCore).toContain('chrome.storage.session.set');
  });

  it('calls tryOpenPopup after auto-update finds review-pending updates', () => {
    const autoUpdateStart = backgroundCore.indexOf('async autoUpdate()');
    const autoUpdateEnd = backgroundCore.indexOf('getRecentUpdates()', autoUpdateStart);
    const autoUpdateBody = backgroundCore.slice(autoUpdateStart, autoUpdateEnd);
    expect(autoUpdateBody).toContain("tryOpenPopup('pending-updates')");
  });

  it('swallows errors from openPopup (Chrome requires user gesture)', () => {
    const fnStart = backgroundCore.indexOf('async function tryOpenPopup');
    const fnEnd = backgroundCore.indexOf('\n}\n', fnStart) + 3;
    const fnBody = backgroundCore.slice(fnStart, fnEnd);
    expect(fnBody).toContain('catch');
  });

  it('popup handles open reason by scrolling to pending updates badge', () => {
    expect(popupSource).toContain('handlePopupOpenReason');
    expect(popupSource).toContain('sv_popup_open_reason');
    expect(popupSource).toContain("reason === 'pending-updates'");
    expect(popupSource).toContain('scrollIntoView');
  });

  it('popup clears the open reason after reading it', () => {
    expect(popupSource).toContain("chrome.storage.session.remove('sv_popup_open_reason')");
  });

  it('popup guards against missing chrome.storage.session', () => {
    expect(popupSource).toContain('chrome.storage.session?.get');
  });
});
