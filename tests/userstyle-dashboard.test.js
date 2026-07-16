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
    expect(en.runtime.updateUserStyleAction).toBeTruthy();
  });

  it('wires the install/update action to the backend', () => {
    expect(js).toContain('function installOrUpdateUserStyle');
    expect(js).toContain("action: 'installUserStyle'");
    expect(js).toContain("action: 'updateUserStyleCode'");
    expect(js).toContain("elements.btnEditorInstallUserStyle?.addEventListener('click'");
  });

  it('provides a manager surface with list/toggle/delete backed by the runtime', () => {
    expect(js).toContain('function showUserStylesManager');
    expect(js).toContain("action: 'getUserStyles'");
    expect(js).toContain("action: 'toggleUserStyle'");
    expect(js).toContain("action: 'deleteUserStyle'");
    // Discoverable from the command palette.
    expect(js).toContain("label: 'Manage UserStyles'");
  });

  it('tracks edit mode so re-saving an installed style updates rather than duplicates', () => {
    expect(js).toContain('editingUserStyleId');
    expect(js).toContain('function openUserStyleForEditing');
    // Opening a real script or a fresh draft must leave edit mode.
    const createNew = js.slice(js.indexOf('async function createNewScript'), js.indexOf('async function createNewScript') + 400);
    expect(createNew).toContain('state.editingUserStyleId = null');
  });
});
