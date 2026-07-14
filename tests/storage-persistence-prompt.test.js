import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();

describe('storage persistence prompt wiring', () => {
  const background = readFileSync(resolve(ROOT, 'background.core.js'), 'utf8');
  const quotaSource = readFileSync(resolve(ROOT, 'src/modules/quota-manager.ts'), 'utf8');

  it('exposes a one-time persistent-storage request in QuotaManager', () => {
    expect(quotaSource).toContain('ensurePersistentStorageForWrite');
    expect(quotaSource).toContain('navigator.storage.persist');
    expect(quotaSource).toContain('sv_storage_persistence');
  });

  it('requests persistence before script-source writes', () => {
    expect(background).toContain('async function ensurePersistentStorageForScriptWrite');
    expect(background).toContain("ensurePersistentStorageForScriptWrite(existing ? 'script-reinstall' : 'script-install'");
    expect(background).toContain("ensurePersistentStorageForScriptWrite('script-update'");
    expect(background).toContain("ensurePersistentStorageForScriptWrite(existing ? 'script-save' : 'script-create'");
    expect(background).toContain("ensurePersistentStorageForScriptWrite('script-import'");
    expect(background).toContain("ensurePersistentStorageForScriptWrite('zip-import'");
    expect(background).toContain('ensurePersistentStorageForScriptWrite(existing ? `${vendor}-import-update` : `${vendor}-import`, code)');
  });
});
