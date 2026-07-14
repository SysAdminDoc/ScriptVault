import type { ResponseMap } from '../types/messages';
import type { BackgroundActionHandlers } from './message-router';

export const BACKUP_BACKGROUND_ACTIONS = [
  'createBackup',
  'getBackups',
  'restoreBackup',
  'verifyBackup',
  'getRestoreReceipts',
  'getRestoreReceipt',
  'rollbackRestore',
  'clearRestoreReceipts',
  'deleteBackup',
  'importBackup',
  'exportBackup',
  'inspectBackup',
  'getBackupSettings',
  'setBackupSettings',
] as const;

export type BackupBackgroundAction = typeof BACKUP_BACKGROUND_ACTIONS[number];

export interface BackupActionDependencies {
  create(reason: string): Promise<ResponseMap['createBackup']>;
  list(): Promise<ResponseMap['getBackups']>;
  restore(backupId: string, options?: Record<string, unknown>): Promise<ResponseMap['restoreBackup']>;
  verify(backupId: string): Promise<ResponseMap['verifyBackup']>;
  listReceipts(): Promise<ResponseMap['getRestoreReceipts']>;
  getReceipt(receiptId: string): Promise<ResponseMap['getRestoreReceipt']>;
  rollback(receiptId: string, options: Record<string, unknown>): Promise<ResponseMap['rollbackRestore']>;
  clearReceipts(): Promise<ResponseMap['clearRestoreReceipts']>;
  delete(backupId: string): Promise<ResponseMap['deleteBackup']>;
  import(zipData: unknown): Promise<ResponseMap['importBackup']>;
  export(backupId: string): Promise<ResponseMap['exportBackup']>;
  inspect(backupId: string): Promise<ResponseMap['inspectBackup']>;
  getSettings(): Promise<ResponseMap['getBackupSettings']> | ResponseMap['getBackupSettings'];
  setSettings(settings: Record<string, unknown>): Promise<ResponseMap['setBackupSettings']>;
}

export function createBackupActionHandlers(
  dependencies: BackupActionDependencies,
): Pick<BackgroundActionHandlers, BackupBackgroundAction> {
  const handlers: Pick<BackgroundActionHandlers, BackupBackgroundAction> = {
    createBackup: ({ message }) => dependencies.create(message.reason || 'manual'),
    getBackups: () => dependencies.list(),
    restoreBackup: ({ message }) => dependencies.restore(message.backupId, message.options),
    verifyBackup: ({ message }) => dependencies.verify(message.backupId),
    getRestoreReceipts: () => dependencies.listReceipts(),
    getRestoreReceipt: ({ message }) => dependencies.getReceipt(message.receiptId),
    rollbackRestore: ({ message }) => dependencies.rollback(message.receiptId, message.options || {}),
    clearRestoreReceipts: () => dependencies.clearReceipts(),
    deleteBackup: ({ message }) => dependencies.delete(message.backupId),
    importBackup: ({ message }) => dependencies.import(message.zipData),
    exportBackup: ({ message }) => dependencies.export(message.backupId),
    inspectBackup: ({ message }) => dependencies.inspect(message.backupId),
    getBackupSettings: () => dependencies.getSettings(),
    setBackupSettings: ({ message }) => dependencies.setSettings(message.settings),
  };
  return Object.freeze(handlers);
}

export const BackupActionHandler = Object.freeze({
  BACKUP_BACKGROUND_ACTIONS,
  createBackupActionHandlers,
});

export default BackupActionHandler;
