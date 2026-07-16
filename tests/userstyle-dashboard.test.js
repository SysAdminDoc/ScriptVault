import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8');
const html = read('pages/dashboard.html');
const js = read('pages/dashboard.js');
const en = JSON.parse(read('src/locales/en.json'));

describe('UserStyles dashboard management surface', () => {
  it('exposes the editor Install-as-userstyle control', () => {
    expect(html).toContain('id="btnEditorInstallUserStyle"');
    expect(html).toContain('data-i18n="installUserStyle"');
    expect(en.runtime.installUserStyle).toBeTruthy();
    expect(en.runtime.installUserStyleTitle).toBeTruthy();
  });

  it('installs the current UserCSS editor draft via the backend', () => {
    expect(js).toContain('function installCurrentUserStyle');
    expect(js).toContain("action: 'installUserStyle'");
    expect(js).toContain("elements.btnEditorInstallUserStyle?.addEventListener('click'");
  });

  it('provides a manager surface with list/toggle/delete/edit backed by the runtime', () => {
    expect(js).toContain('function showUserStylesManager');
    expect(js).toContain("action: 'getUserStyles'");
    expect(js).toContain("action: 'toggleUserStyle'");
    expect(js).toContain("action: 'deleteUserStyle'");
    expect(js).toContain("action: 'updateUserStyleCode'");
    // Discoverable from the command palette.
    expect(js).toContain("label: 'Manage UserStyles'");
  });

  it('edits and installs userstyles through review/edit modals, not the script editor', () => {
    expect(js).toContain('function showUserStyleEditModal');
    expect(js).toContain('function showUserStyleInstallReview');
    // The .user.css interception routes to the install-review modal.
    expect(js).toContain('function openPendingUserStyle');
    expect(js).toContain("hash.startsWith('usercss=')");
    // No lingering editor-routing that would create junk scripts.
    expect(js).not.toContain('function loadUserStyleIntoEditor');
    expect(js).not.toContain('editingUserStyleId');
  });
});
