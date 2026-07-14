import type { ResponseMap } from '../types/messages';
import type { BackgroundActionHandlers } from './message-router';

export const DATA_BACKGROUND_ACTIONS = [
  'prefetchResources',
  'getAllScriptsValues',
  'setScriptValue',
  'clearScriptStorage',
  'renameScriptValue',
  'exportAll',
  'getStorageUsage',
  'getStorageBreakdown',
  'cleanupStorage',
  'getGistSettings',
  'saveGistSettings',
  'exportZip',
] as const;

export type DataBackgroundAction = typeof DATA_BACKGROUND_ACTIONS[number];

export interface DataActionDependencies {
  prefetchResources(resources: string[]): Promise<ResponseMap['prefetchResources']>;
  getAllScriptsValues(): Promise<ResponseMap['getAllScriptsValues']>;
  setScriptValue(scriptId: string, key: string, value: unknown): Promise<ResponseMap['setScriptValue']>;
  clearScriptStorage(scriptId: string): Promise<ResponseMap['clearScriptStorage']>;
  renameScriptValue(scriptId: string, oldKey: string, newKey: string): Promise<ResponseMap['renameScriptValue']>;
  exportAll(options: Record<string, unknown>): Promise<ResponseMap['exportAll']>;
  getStorageUsage(): Promise<ResponseMap['getStorageUsage']>;
  getStorageBreakdown(): Promise<ResponseMap['getStorageBreakdown']>;
  cleanupStorage(options: Record<string, unknown>): Promise<ResponseMap['cleanupStorage']>;
  getGistSettings(): Promise<ResponseMap['getGistSettings']>;
  saveGistSettings(settings: Record<string, unknown>): Promise<ResponseMap['saveGistSettings']>;
  exportZip(options: Record<string, unknown>): Promise<ResponseMap['exportZip']>;
}

export function createDataActionHandlers(
  dependencies: DataActionDependencies,
): Pick<BackgroundActionHandlers, DataBackgroundAction> {
  const handlers: Pick<BackgroundActionHandlers, DataBackgroundAction> = {
    prefetchResources: ({ message }) => dependencies.prefetchResources(message.resources),
    getAllScriptsValues: () => dependencies.getAllScriptsValues(),
    setScriptValue: ({ message }) => dependencies.setScriptValue(message.scriptId, message.key, message.value),
    clearScriptStorage: ({ message }) => dependencies.clearScriptStorage(message.scriptId),
    renameScriptValue: ({ message }) => dependencies.renameScriptValue(
      message.scriptId,
      message.oldKey,
      message.newKey,
    ),
    exportAll: ({ message }) => dependencies.exportAll(message.options || {}),
    getStorageUsage: () => dependencies.getStorageUsage(),
    getStorageBreakdown: () => dependencies.getStorageBreakdown(),
    cleanupStorage: ({ message }) => dependencies.cleanupStorage(message.options || {}),
    getGistSettings: () => dependencies.getGistSettings(),
    saveGistSettings: ({ message }) => dependencies.saveGistSettings(message.settings),
    exportZip: ({ message }) => dependencies.exportZip(message.options || {}),
  };
  return Object.freeze(handlers);
}

export const DataActionHandler = Object.freeze({
  DATA_BACKGROUND_ACTIONS,
  createDataActionHandlers,
});

export default DataActionHandler;
