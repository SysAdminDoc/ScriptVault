import type { ResponseMap } from '../types/messages';
import type {
  BackgroundActionHandlers,
  BackgroundMessageFor,
} from './message-router';

export const SCRIPT_BACKGROUND_ACTIONS = [
  'getScripts',
  'getHostPermissionStatus',
  'queueHostAccessRequest',
  'getScript',
  'saveScript',
  'createScript',
  'deleteScript',
  'getTrash',
  'restoreFromTrash',
  'emptyTrash',
  'rescheduleScript',
  'restart',
  'permanentlyDelete',
  'toggleScript',
  'duplicateScript',
  'searchScripts',
  'reorderScripts',
] as const;

export type ScriptBackgroundAction = typeof SCRIPT_BACKGROUND_ACTIONS[number];

export interface ScriptActionDependencies {
  getScripts(): Promise<ResponseMap['getScripts']>;
  getHostPermissionStatus(
    message: BackgroundMessageFor<'getHostPermissionStatus'>,
    sender: unknown,
  ): Promise<ResponseMap['getHostPermissionStatus']>;
  queueHostAccessRequest(
    message: BackgroundMessageFor<'queueHostAccessRequest'>,
    sender: unknown,
  ): Promise<ResponseMap['queueHostAccessRequest']>;
  getScript(id: string): Promise<ResponseMap['getScript']>;
  saveScript(message: BackgroundMessageFor<'saveScript'>): Promise<ResponseMap['saveScript']>;
  createScript(code: string): Promise<ResponseMap['createScript']>;
  deleteScript(scriptId?: string): Promise<ResponseMap['deleteScript']>;
  getTrash(): Promise<ResponseMap['getTrash']>;
  restoreFromTrash(scriptId: string): Promise<ResponseMap['restoreFromTrash']>;
  emptyTrash(): Promise<ResponseMap['emptyTrash']>;
  rescheduleScript(scriptId: string): Promise<ResponseMap['rescheduleScript']>;
  restart(): Promise<ResponseMap['restart']> | ResponseMap['restart'];
  permanentlyDelete(scriptId: string): Promise<ResponseMap['permanentlyDelete']>;
  toggleScript(message: BackgroundMessageFor<'toggleScript'>): Promise<ResponseMap['toggleScript']>;
  duplicateScript(id: string): Promise<ResponseMap['duplicateScript']>;
  searchScripts(query: string): Promise<ResponseMap['searchScripts']>;
  reorderScripts(orderedIds: string[]): Promise<ResponseMap['reorderScripts']>;
}

export function createScriptActionHandlers(
  dependencies: ScriptActionDependencies,
): Pick<BackgroundActionHandlers, ScriptBackgroundAction> {
  const handlers: Pick<BackgroundActionHandlers, ScriptBackgroundAction> = {
    getScripts: () => dependencies.getScripts(),
    getHostPermissionStatus: ({ message, sender }) => dependencies.getHostPermissionStatus(message, sender),
    queueHostAccessRequest: ({ message, sender }) => dependencies.queueHostAccessRequest(message, sender),
    getScript: ({ message }) => dependencies.getScript(message.id),
    saveScript: ({ message }) => dependencies.saveScript(message),
    createScript: ({ message }) => dependencies.createScript(message.code),
    deleteScript: ({ message }) => dependencies.deleteScript(message.id || message.scriptId),
    getTrash: () => dependencies.getTrash(),
    restoreFromTrash: ({ message }) => dependencies.restoreFromTrash(message.scriptId),
    emptyTrash: () => dependencies.emptyTrash(),
    rescheduleScript: ({ message }) => dependencies.rescheduleScript(message.scriptId),
    restart: () => dependencies.restart(),
    permanentlyDelete: ({ message }) => dependencies.permanentlyDelete(message.scriptId),
    toggleScript: ({ message }) => dependencies.toggleScript(message),
    duplicateScript: ({ message }) => dependencies.duplicateScript(message.id),
    searchScripts: ({ message }) => dependencies.searchScripts(message.query),
    reorderScripts: ({ message }) => dependencies.reorderScripts(message.orderedIds),
  };
  return Object.freeze(handlers);
}

export const ScriptActionHandler = Object.freeze({
  SCRIPT_BACKGROUND_ACTIONS,
  createScriptActionHandlers,
});

export default ScriptActionHandler;
