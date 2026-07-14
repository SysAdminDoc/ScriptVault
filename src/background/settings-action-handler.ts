import type { ResponseMap } from '../types/messages';
import type { BackgroundActionHandlers } from './message-router';

export const SETTINGS_BACKGROUND_ACTIONS = [
  'getSettings',
  'getExtensionStatus',
  'getLocalHealthReport',
  'prepareBackgroundRunnerDryRun',
  'repairRuntimeState',
  'getSetting',
  'setSettings',
  'resetSettings',
  'getScriptSettings',
  'setScriptSettings',
  'resetScriptSettings',
] as const;

export type SettingsBackgroundAction = typeof SETTINGS_BACKGROUND_ACTIONS[number];

export interface SettingsActionDependencies {
  getSettings(): Promise<ResponseMap['getSettings']>;
  getExtensionStatus(): Promise<ResponseMap['getExtensionStatus']>;
  getLocalHealthReport(): Promise<ResponseMap['getLocalHealthReport']>;
  prepareBackgroundRunnerDryRun(scriptId: string): Promise<ResponseMap['prepareBackgroundRunnerDryRun']>;
  repairRuntimeState(): Promise<ResponseMap['repairRuntimeState']>;
  getSetting(key: string): Promise<ResponseMap['getSetting']>;
  setSettings(settings: Record<string, unknown>): Promise<ResponseMap['setSettings']>;
  resetSettings(): Promise<ResponseMap['resetSettings']>;
  getScriptSettings(scriptId: string): Promise<ResponseMap['getScriptSettings']>;
  setScriptSettings(scriptId: string, settings: Record<string, unknown>): Promise<ResponseMap['setScriptSettings']>;
  resetScriptSettings(scriptId: string): Promise<ResponseMap['resetScriptSettings']>;
}

export function createSettingsActionHandlers(
  dependencies: SettingsActionDependencies,
): Pick<BackgroundActionHandlers, SettingsBackgroundAction> {
  const handlers: Pick<BackgroundActionHandlers, SettingsBackgroundAction> = {
    getSettings: () => dependencies.getSettings(),
    getExtensionStatus: () => dependencies.getExtensionStatus(),
    getLocalHealthReport: () => dependencies.getLocalHealthReport(),
    prepareBackgroundRunnerDryRun: ({ message }) => dependencies.prepareBackgroundRunnerDryRun(message.scriptId),
    repairRuntimeState: () => dependencies.repairRuntimeState(),
    getSetting: ({ message }) => dependencies.getSetting(message.key),
    setSettings: ({ message }) => dependencies.setSettings(message.settings),
    resetSettings: () => dependencies.resetSettings(),
    getScriptSettings: ({ message }) => dependencies.getScriptSettings(message.scriptId),
    setScriptSettings: ({ message }) => dependencies.setScriptSettings(message.scriptId, message.settings),
    resetScriptSettings: ({ message }) => dependencies.resetScriptSettings(message.scriptId),
  };
  return Object.freeze(handlers);
}

export const SettingsActionHandler = Object.freeze({
  SETTINGS_BACKGROUND_ACTIONS,
  createSettingsActionHandlers,
});

export default SettingsActionHandler;
