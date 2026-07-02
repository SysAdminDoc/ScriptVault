import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const backupSchedulerJs = readFileSync(resolve(process.cwd(), 'modules/backup-scheduler.js'), 'utf8');

describe('cloud backup schedule integration', () => {
  it('adds cloudBackupEnabled to default settings as false', () => {
    expect(backupSchedulerJs).toContain('cloudBackupEnabled: false');
  });

  it('defines _uploadBackupToCloud function', () => {
    expect(backupSchedulerJs).toContain('async function _uploadBackupToCloud(backup)');
  });

  it('uses a separate schema from script sync', () => {
    expect(backupSchedulerJs).toContain('"scriptvault-cloud-backup/v1"');
    expect(backupSchedulerJs).not.toContain('scriptvault-cloud-backup/v1" === "scriptvault-sync');
  });

  it('uses a distinct object name from script sync (no clobber) and encrypts under E2EE', () => {
    // The cloud backup must write to a DISTINCT object so it can't overwrite the
    // sync envelope (they previously shared scriptvault-backup.json).
    expect(backupSchedulerJs).toContain('scriptvault-cloud-backup.json');
    expect(backupSchedulerJs).not.toContain('syncFilename: "scriptvault-backup.json"');
    // And it must encrypt the backup with the sync passphrase when E2EE is on.
    expect(backupSchedulerJs).toContain('isEncryptionEnabled');
    expect(backupSchedulerJs).toContain('SyncCrypto.prepareSyncEnvelopeForUpload(envelope, uploadSettings)');
  });

  it('checks for CloudSyncProviders availability before upload', () => {
    const fnStart = backupSchedulerJs.indexOf('async function _uploadBackupToCloud');
    const fnEnd = backupSchedulerJs.indexOf('\n  }', fnStart + 10) + 4;
    const fnBody = backupSchedulerJs.slice(fnStart, fnEnd);
    expect(fnBody).toContain('CloudSyncProviders');
    expect(fnBody).toMatch(/providerName === ['"]none['"]/)
  });

  it('calls cloud upload after successful backup when enabled', () => {
    expect(backupSchedulerJs).toContain('if (settings.cloudBackupEnabled)');
    expect(backupSchedulerJs).toContain('_uploadBackupToCloud(backup).catch');
  });

  it('cloud upload failure does not block local backup success', () => {
    const createStart = backupSchedulerJs.indexOf('async createBackup(');
    const createEnd = backupSchedulerJs.indexOf('\n  },', createStart + 10);
    const createBody = backupSchedulerJs.slice(createStart, createEnd);
    const cloudCallIndex = createBody.indexOf('_uploadBackupToCloud');
    const returnIndex = createBody.indexOf("return { success: true", cloudCallIndex);
    expect(cloudCallIndex).toBeGreaterThan(-1);
    expect(returnIndex).toBeGreaterThan(cloudCallIndex);
    expect(createBody).toContain('.catch(');
  });

  it('loads syncProvider from SettingsManager to pick the right provider', () => {
    const fnStart = backupSchedulerJs.indexOf('async function _uploadBackupToCloud');
    const fnEnd = backupSchedulerJs.indexOf('\n  }', fnStart + 10) + 4;
    const fnBody = backupSchedulerJs.slice(fnStart, fnEnd);
    expect(fnBody).toContain('SettingsManager.get()');
    expect(fnBody).toContain('syncProvider');
  });
});
