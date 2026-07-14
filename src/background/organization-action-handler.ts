import type { ResponseMap } from '../types/messages';
import type { BackgroundActionHandlers } from './message-router';

export const ORGANIZATION_BACKGROUND_ACTIONS = [
  'getProfiles',
  'switchProfile',
  'saveProfile',
  'deleteProfile',
  'getCollections',
  'saveCollection',
  'deleteCollection',
  'getWorkspaces',
  'createWorkspace',
  'saveWorkspace',
  'activateWorkspace',
  'updateWorkspace',
  'deleteWorkspace',
  'getFolders',
  'createFolder',
  'updateFolder',
  'deleteFolder',
  'addScriptToFolder',
  'removeScriptFromFolder',
  'moveScriptToFolder',
] as const;

export type OrganizationBackgroundAction = typeof ORGANIZATION_BACKGROUND_ACTIONS[number];

export interface OrganizationActionDependencies {
  getProfiles(): Promise<ResponseMap['getProfiles']>;
  switchProfile(profileId: string): Promise<ResponseMap['switchProfile']>;
  saveProfile(profile: Record<string, unknown>): Promise<ResponseMap['saveProfile']>;
  deleteProfile(profileId: string): Promise<ResponseMap['deleteProfile']>;
  getCollections(): Promise<ResponseMap['getCollections']>;
  saveCollection(collection: Record<string, unknown>): Promise<ResponseMap['saveCollection']>;
  deleteCollection(collectionId: string): Promise<ResponseMap['deleteCollection']>;
  getWorkspaces(): Promise<ResponseMap['getWorkspaces']>;
  createWorkspace(name: string): Promise<ResponseMap['createWorkspace']>;
  saveWorkspace(id: string): Promise<ResponseMap['saveWorkspace']>;
  activateWorkspace(id: string): Promise<ResponseMap['activateWorkspace']>;
  updateWorkspace(id: string, updates: Record<string, unknown>): Promise<ResponseMap['updateWorkspace']>;
  deleteWorkspace(id: string): Promise<ResponseMap['deleteWorkspace']>;
  getFolders(): Promise<ResponseMap['getFolders']>;
  createFolder(name: string, color?: string): Promise<ResponseMap['createFolder']>;
  updateFolder(id: string, updates: Record<string, unknown>): Promise<ResponseMap['updateFolder']>;
  deleteFolder(id: string): Promise<ResponseMap['deleteFolder']>;
  addScriptToFolder(folderId: string, scriptId: string): Promise<ResponseMap['addScriptToFolder']>;
  removeScriptFromFolder(folderId: string, scriptId: string): Promise<ResponseMap['removeScriptFromFolder']>;
  moveScriptToFolder(scriptId: string, fromFolderId: string, toFolderId: string): Promise<ResponseMap['moveScriptToFolder']>;
}

export function createOrganizationActionHandlers(
  dependencies: OrganizationActionDependencies,
): Pick<BackgroundActionHandlers, OrganizationBackgroundAction> {
  const handlers: Pick<BackgroundActionHandlers, OrganizationBackgroundAction> = {
    getProfiles: () => dependencies.getProfiles(),
    switchProfile: ({ message }) => dependencies.switchProfile(message.profileId),
    saveProfile: ({ message }) => dependencies.saveProfile(message.profile),
    deleteProfile: ({ message }) => dependencies.deleteProfile(message.profileId),
    getCollections: () => dependencies.getCollections(),
    saveCollection: ({ message }) => dependencies.saveCollection(message.collection),
    deleteCollection: ({ message }) => dependencies.deleteCollection(message.collectionId),
    getWorkspaces: () => dependencies.getWorkspaces(),
    createWorkspace: ({ message }) => dependencies.createWorkspace(message.name),
    saveWorkspace: ({ message }) => dependencies.saveWorkspace(message.id),
    activateWorkspace: ({ message }) => dependencies.activateWorkspace(message.id),
    updateWorkspace: ({ message }) => dependencies.updateWorkspace(message.id, message.updates),
    deleteWorkspace: ({ message }) => dependencies.deleteWorkspace(message.id),
    getFolders: () => dependencies.getFolders(),
    createFolder: ({ message }) => dependencies.createFolder(message.name, message.color),
    updateFolder: ({ message }) => dependencies.updateFolder(message.id, message.updates),
    deleteFolder: ({ message }) => dependencies.deleteFolder(message.id),
    addScriptToFolder: ({ message }) => dependencies.addScriptToFolder(message.folderId, message.scriptId),
    removeScriptFromFolder: ({ message }) => dependencies.removeScriptFromFolder(message.folderId, message.scriptId),
    moveScriptToFolder: ({ message }) => dependencies.moveScriptToFolder(
      message.scriptId,
      message.fromFolderId,
      message.toFolderId,
    ),
  };
  return Object.freeze(handlers);
}

export const OrganizationActionHandler = Object.freeze({
  ORGANIZATION_BACKGROUND_ACTIONS,
  createOrganizationActionHandlers,
});

export default OrganizationActionHandler;
