import type { ResponseMap } from '../types/messages';
import type { BackgroundActionHandlers } from './message-router';

export const UPDATE_BACKGROUND_ACTIONS = [
  'checkUpdates',
  'queueUpdates',
  'getPendingUpdates',
  'clearPendingUpdates',
  'applyPendingUpdate',
  'applySafePendingUpdates',
  'getRecentUpdates',
  'clearRecentUpdates',
  'forceUpdate',
  'applyUpdate',
  'getVersionHistory',
  'rollbackScript',
  'getSubscriptions',
  'addSubscription',
  'refreshSubscription',
  'refreshSubscriptions',
  'removeSubscription',
] as const;

export type UpdateBackgroundAction = typeof UPDATE_BACKGROUND_ACTIONS[number];

export interface UpdateActionDependencies {
  checkUpdates(scriptId?: string): Promise<ResponseMap['checkUpdates']>;
  queueUpdates(scriptId: string | undefined, updates: unknown[] | undefined, source: string): Promise<ResponseMap['queueUpdates']>;
  getPendingUpdates(): Promise<ResponseMap['getPendingUpdates']>;
  clearPendingUpdates(scriptId?: string): Promise<ResponseMap['clearPendingUpdates']>;
  applyPendingUpdate(scriptId: string, force: boolean): Promise<ResponseMap['applyPendingUpdate']>;
  applySafePendingUpdates(scriptIds?: string[]): Promise<ResponseMap['applySafePendingUpdates']>;
  getRecentUpdates(): ResponseMap['getRecentUpdates'];
  clearRecentUpdates(): void;
  forceUpdate(scriptId: string): Promise<ResponseMap['forceUpdate']>;
  applyUpdate(scriptId: string, code: string, sourceUrl: string): Promise<ResponseMap['applyUpdate']>;
  getVersionHistory(scriptId: string): Promise<ResponseMap['getVersionHistory']>;
  rollbackScript(scriptId: string, index?: number): Promise<ResponseMap['rollbackScript']>;
  getSubscriptions(): Promise<ResponseMap['getSubscriptions']>;
  addSubscription(url: string, name: string): Promise<ResponseMap['addSubscription']>;
  refreshSubscription(id: string): Promise<ResponseMap['refreshSubscription']>;
  refreshSubscriptions(): Promise<ResponseMap['refreshSubscriptions']>;
  removeSubscription(id: string): Promise<ResponseMap['removeSubscription']>;
}

export function createUpdateActionHandlers(
  dependencies: UpdateActionDependencies,
): Pick<BackgroundActionHandlers, UpdateBackgroundAction> {
  const handlers: Pick<BackgroundActionHandlers, UpdateBackgroundAction> = {
    checkUpdates: ({ message }) => dependencies.checkUpdates(message.scriptId),
    queueUpdates: ({ message }) => dependencies.queueUpdates(
      message.scriptId,
      message.updates,
      message.source || 'manual-check',
    ),
    getPendingUpdates: () => dependencies.getPendingUpdates(),
    clearPendingUpdates: ({ message }) => dependencies.clearPendingUpdates(message.scriptId),
    applyPendingUpdate: ({ message }) => dependencies.applyPendingUpdate(message.scriptId, message.force === true),
    applySafePendingUpdates: ({ message }) => dependencies.applySafePendingUpdates(message.scriptIds),
    getRecentUpdates: () => dependencies.getRecentUpdates(),
    clearRecentUpdates: () => {
      dependencies.clearRecentUpdates();
      return { success: true as const };
    },
    forceUpdate: ({ message }) => dependencies.forceUpdate(message.scriptId),
    applyUpdate: ({ message }) => dependencies.applyUpdate(
      message.scriptId,
      message.code,
      message.sourceUrl || '',
    ),
    getVersionHistory: ({ message }) => dependencies.getVersionHistory(message.scriptId),
    rollbackScript: ({ message }) => dependencies.rollbackScript(message.scriptId, message.index),
    getSubscriptions: () => dependencies.getSubscriptions(),
    addSubscription: ({ message }) => dependencies.addSubscription(message.url || '', message.name || ''),
    refreshSubscription: ({ message }) => dependencies.refreshSubscription(
      message.subscriptionId || message.id || message.url || '',
    ),
    refreshSubscriptions: () => dependencies.refreshSubscriptions(),
    removeSubscription: ({ message }) => dependencies.removeSubscription(
      message.subscriptionId || message.id || message.url || '',
    ),
  };
  return Object.freeze(handlers);
}

export const UpdateActionHandler = Object.freeze({
  UPDATE_BACKGROUND_ACTIONS,
  createUpdateActionHandlers,
});

export default UpdateActionHandler;
