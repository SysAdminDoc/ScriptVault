import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..');

const bgCore = readFileSync(resolve(repoRoot, 'background.core.js'), 'utf8');
const gmNotificationHandler = readFileSync(resolve(repoRoot, 'modules/gm-notification-handler.js'), 'utf8');
const wrapperTs = readFileSync(resolve(repoRoot, 'src/background/wrapper-builder.ts'), 'utf8');

/**
 * GM_notification `requireInteraction` parity contract.
 *
 * Tampermonkey 5.x and Violentmonkey 2.37+ both pass `requireInteraction`
 * through to `chrome.notifications.create`, which pins the notification
 * until the user explicitly dismisses or acts on it. ScriptVault used to
 * drop the field on the wrapper-to-background hop and on the background-to-
 * Chrome hop. These regressions pin the four code paths (wrapper send,
 * wrapper update, background create, background update) so a future
 * refactor that drops one of them fails CI.
 */
describe('GM_notification requireInteraction parity', () => {
  it('runtime background handler forwards requireInteraction to chrome.notifications.create', () => {
    expect(gmNotificationHandler).toMatch(/requireInteraction\s*=\s*true/);
    expect(gmNotificationHandler).toMatch(/data\.requireInteraction/);
  });

  it('runtime background update handler forwards requireInteraction', () => {
    // The GM_updateNotification handler reads data.requireInteraction into
    // updateOpts so chrome.notifications.update mirrors the create path.
    expect(gmNotificationHandler).toMatch(/updateOpts\.requireInteraction\s*=\s*data\.requireInteraction/);
  });

  it('runtime wrapper sends requireInteraction in GM_notification payload', () => {
    expect(bgCore).toMatch(/requireInteraction:\s*typeof opts\.requireInteraction/);
  });

  it('runtime wrapper update sends requireInteraction in GM_updateNotification payload', () => {
    expect(bgCore).toMatch(/requireInteraction:\s*typeof patch\.requireInteraction/);
    expect(bgCore).toMatch(/requireInteraction:\s*typeof details\.requireInteraction/);
  });

  it('TS wrapper mirror sends requireInteraction in GM_notification payload', () => {
    expect(wrapperTs).toMatch(/requireInteraction:\s*typeof opts\.requireInteraction/);
  });

  it('TS wrapper mirror exposes GM_head on window', () => {
    // Bundled with this batch because the wrapper drift gate caught GM_head
    // missing from the mirror — pin it here so a future TS-runtime promotion
    // can't reintroduce the drift.
    expect(wrapperTs).toMatch(/function GM_head\(url, callback\)/);
    expect(wrapperTs).toMatch(/window\.GM_head\s*=\s*GM_head/);
  });
});
