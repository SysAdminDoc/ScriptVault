import type { ResponseMap } from '../types/messages';
import type { BackgroundActionHandlers } from './message-router';

export const SYNC_BACKGROUND_ACTIONS = [
  'sync',
  'syncNow',
  'testSync',
  'getLastSyncResult',
  'syncProviderHealth',
  'syncDryRunPreview',
  'connectSyncProvider',
  'disconnectSyncProvider',
  'revokeSyncProvider',
  'getSyncProviderStatus',
  'cloudExport',
  'cloudImport',
  'cloudStatus',
  'easyCloudConnect',
  'easyCloudDisconnect',
  'easyCloudSync',
  'easyCloudStatus',
] as const;

export type SyncBackgroundAction = typeof SYNC_BACKGROUND_ACTIONS[number];

export interface CloudExportOptions {
  includeSettings: boolean;
  includeStorage: boolean;
  includeSettingsCredentials: boolean;
}

export interface CloudImportOptions {
  importSettings: boolean;
  importStorage: boolean;
  importSettingsCredentials: boolean;
  trustImportedScripts: boolean;
}

export interface SyncActionDependencies {
  sync(): Promise<ResponseMap['syncNow']>;
  test(provider?: string): Promise<ResponseMap['testSync']>;
  getLastResult(): Promise<ResponseMap['getLastSyncResult']>;
  health(provider?: string): Promise<ResponseMap['syncProviderHealth']>;
  preview(provider?: string): Promise<ResponseMap['syncDryRunPreview']>;
  connect(provider: string): Promise<ResponseMap['connectSyncProvider']>;
  disconnect(provider: string): Promise<ResponseMap['disconnectSyncProvider']>;
  status(provider: string): Promise<ResponseMap['getSyncProviderStatus']>;
  export(provider: string, options: CloudExportOptions): Promise<ResponseMap['cloudExport']>;
  import(provider: string, options: CloudImportOptions): Promise<ResponseMap['cloudImport']>;
  cloudStatus(provider: string): Promise<ResponseMap['cloudStatus']>;
  easyCloudConnect(): Promise<ResponseMap['easyCloudConnect']>;
  easyCloudDisconnect(): Promise<ResponseMap['easyCloudDisconnect']>;
  easyCloudSync(): Promise<ResponseMap['easyCloudSync']>;
  easyCloudStatus(): Promise<ResponseMap['easyCloudStatus']>;
}

export function createSyncActionHandlers(
  dependencies: SyncActionDependencies,
): Pick<BackgroundActionHandlers, SyncBackgroundAction> {
  const handlers: Pick<BackgroundActionHandlers, SyncBackgroundAction> = {
    sync: () => dependencies.sync(),
    syncNow: () => dependencies.sync(),
    testSync: ({ message }) => dependencies.test(message.provider),
    getLastSyncResult: () => dependencies.getLastResult(),
    syncProviderHealth: ({ message }) => dependencies.health(message.provider),
    syncDryRunPreview: ({ message }) => dependencies.preview(message.provider),
    connectSyncProvider: ({ message }) => dependencies.connect(message.provider),
    disconnectSyncProvider: ({ message }) => dependencies.disconnect(message.provider),
    revokeSyncProvider: ({ message }) => dependencies.disconnect(message.provider),
    getSyncProviderStatus: ({ message }) => dependencies.status(message.provider),
    cloudExport: ({ message }) => dependencies.export(message.provider, {
      includeSettings: message.includeSettings !== false,
      includeStorage: message.includeStorage !== false,
      includeSettingsCredentials: message.includeSettingsCredentials === true,
    }),
    cloudImport: ({ message }) => dependencies.import(message.provider, {
      importSettings: message.importSettings === true,
      importStorage: message.importStorage !== false,
      importSettingsCredentials: message.importSettingsCredentials === true,
      trustImportedScripts: message.trustImportedScripts === true,
    }),
    cloudStatus: ({ message }) => dependencies.cloudStatus(message.provider),
    easyCloudConnect: () => dependencies.easyCloudConnect(),
    easyCloudDisconnect: () => dependencies.easyCloudDisconnect(),
    easyCloudSync: () => dependencies.easyCloudSync(),
    easyCloudStatus: () => dependencies.easyCloudStatus(),
  };
  return Object.freeze(handlers);
}

export const SyncActionHandler = Object.freeze({
  SYNC_BACKGROUND_ACTIONS,
  createSyncActionHandlers,
});

export default SyncActionHandler;
