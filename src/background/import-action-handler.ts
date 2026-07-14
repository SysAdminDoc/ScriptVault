import type { ResponseMap } from '../types/messages';
import type { BackgroundActionHandlers } from './message-router';

export const IMPORT_BACKGROUND_ACTIONS = [
  'importScript',
  'importAll',
  'importTampermonkeyBackup',
  'importViolentmonkeyBackup',
  'importGreasemonkeyBackup',
  'importFromZip',
] as const;

export type ImportBackgroundAction = typeof IMPORT_BACKGROUND_ACTIONS[number];
export type VendorBackupType = 'tampermonkey' | 'violentmonkey' | 'greasemonkey';

export interface ImportActionDependencies {
  importScript(code: string): Promise<ResponseMap['importScript']>;
  importAll(data: unknown, options?: Record<string, unknown>): Promise<ResponseMap['importAll']>;
  importVendorBackup(
    vendor: VendorBackupType,
    text: string,
    options: Record<string, unknown>,
  ): Promise<ResponseMap['importTampermonkeyBackup']>;
  importFromZip(
    zipData: unknown,
    options?: Record<string, unknown>,
  ): Promise<ResponseMap['importFromZip']>;
}

export function createImportActionHandlers(
  dependencies: ImportActionDependencies,
): Pick<BackgroundActionHandlers, ImportBackgroundAction> {
  return Object.freeze({
    importScript: ({ message }) => dependencies.importScript(message.code),
    importAll: ({ message }) => dependencies.importAll(message.data, message.options),
    importTampermonkeyBackup: ({ message }) => dependencies.importVendorBackup(
      'tampermonkey',
      message.text,
      message as unknown as Record<string, unknown>,
    ),
    importViolentmonkeyBackup: ({ message }) => dependencies.importVendorBackup(
      'violentmonkey',
      message.text,
      message as unknown as Record<string, unknown>,
    ),
    importGreasemonkeyBackup: ({ message }) => dependencies.importVendorBackup(
      'greasemonkey',
      message.text,
      message as unknown as Record<string, unknown>,
    ),
    importFromZip: ({ message }) => dependencies.importFromZip(message.zipData, message.options),
  });
}

export const ImportActionHandler = Object.freeze({
  IMPORT_BACKGROUND_ACTIONS,
  createImportActionHandlers,
});

export default ImportActionHandler;
