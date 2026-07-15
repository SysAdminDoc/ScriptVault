import type { ResponseMap } from '../types/messages';
import type {
  BackgroundActionHandlers,
  BackgroundMessageFor,
} from './message-router';

export const RUNTIME_BACKGROUND_ACTIONS = [
  'installFromUrl',
  'installFromCode',
  'fetchScriptPreview',
  'probeInstallDependency',
  'verifyRequireProvenancePreview',
  'fetchResource',
  'getScriptsForUrl',
  'diagnoseScripts',
  'updateBadgeForTab',
  'runScriptNow',
  'rescheduleChains',
  'runChainNow',
  'getChainDomEventTriggers',
  'chainDomEvent',
  'userStylePreviewDraft',
  'userStyleClearPreview',
  'getExtensionInfo',
  'openDashboard',
  'factoryReset',
] as const;

export type RuntimeBackgroundAction = typeof RUNTIME_BACKGROUND_ACTIONS[number];

export interface RuntimeActionDependencies {
  installFromUrl(url: string): Promise<ResponseMap['installFromUrl']>;
  installFromCode(code: string, sourceUrl: string, operation: string): Promise<ResponseMap['installFromCode']>;
  fetchScriptPreview(url: string): Promise<ResponseMap['fetchScriptPreview']>;
  probeInstallDependency(url: string): Promise<ResponseMap['probeInstallDependency']>;
  verifyRequireProvenancePreview(
    message: BackgroundMessageFor<'verifyRequireProvenancePreview'>,
  ): Promise<ResponseMap['verifyRequireProvenancePreview']>;
  fetchResource(url: string): Promise<ResponseMap['fetchResource']>;
  getScriptsForUrl(url: string): Promise<ResponseMap['getScriptsForUrl']>;
  diagnoseScripts(url: string, tabId?: number): Promise<ResponseMap['diagnoseScripts']>;
  updateBadgeForTab(tabId: number, url: string): Promise<ResponseMap['updateBadgeForTab']>;
  runScriptNow(message: BackgroundMessageFor<'runScriptNow'>): Promise<ResponseMap['runScriptNow']>;
  rescheduleChains(): Promise<ResponseMap['rescheduleChains']>;
  runChainNow(chainId: string, reason: string, tabId?: number): Promise<ResponseMap['runChainNow']>;
  getChainDomEventTriggers(): Promise<ResponseMap['getChainDomEventTriggers']>;
  chainDomEvent(eventType: string, url: string, sender: unknown): Promise<ResponseMap['chainDomEvent']>;
  previewUserStyle(
    code: string,
    tabId?: number,
    values?: BackgroundMessageFor<'userStylePreviewDraft'>['values'],
    colorScheme?: BackgroundMessageFor<'userStylePreviewDraft'>['colorScheme'],
  ): Promise<ResponseMap['userStylePreviewDraft']>;
  clearUserStylePreview(tabId?: number): Promise<ResponseMap['userStyleClearPreview']>;
  getExtensionInfo(): ResponseMap['getExtensionInfo'];
  openDashboard(message: BackgroundMessageFor<'openDashboard'>): Promise<ResponseMap['openDashboard']>;
  factoryReset(): Promise<ResponseMap['factoryReset']>;
}

export function createRuntimeActionHandlers(
  dependencies: RuntimeActionDependencies,
): Pick<BackgroundActionHandlers, RuntimeBackgroundAction> {
  const handlers: Pick<BackgroundActionHandlers, RuntimeBackgroundAction> = {
    installFromUrl: ({ message }) => dependencies.installFromUrl(message.url),
    installFromCode: ({ message }) => dependencies.installFromCode(
      message.code,
      message.sourceUrl || '',
      message.operation || 'install',
    ),
    fetchScriptPreview: ({ message }) => dependencies.fetchScriptPreview(message.url),
    probeInstallDependency: ({ message }) => dependencies.probeInstallDependency(message.url),
    verifyRequireProvenancePreview: ({ message }) => dependencies.verifyRequireProvenancePreview(message),
    fetchResource: ({ message }) => dependencies.fetchResource(message.url),
    getScriptsForUrl: ({ message }) => dependencies.getScriptsForUrl(message.url),
    diagnoseScripts: ({ message }) => dependencies.diagnoseScripts(message.url || '', message.tabId),
    updateBadgeForTab: ({ message }) => dependencies.updateBadgeForTab(message.tabId, message.url),
    runScriptNow: ({ message }) => dependencies.runScriptNow(message),
    rescheduleChains: () => dependencies.rescheduleChains(),
    runChainNow: ({ message }) => dependencies.runChainNow(
      message.chainId,
      message.reason || 'manual',
      message.tabId,
    ),
    getChainDomEventTriggers: () => dependencies.getChainDomEventTriggers(),
    chainDomEvent: ({ message, sender }) => dependencies.chainDomEvent(
      String(message.eventType || '').trim(),
      message.url || '',
      sender,
    ),
    userStylePreviewDraft: ({ message }) => dependencies.previewUserStyle(
      message.code || '',
      message.tabId,
      message.values,
      message.colorScheme,
    ),
    userStyleClearPreview: ({ message }) => dependencies.clearUserStylePreview(message.tabId),
    getExtensionInfo: () => dependencies.getExtensionInfo(),
    openDashboard: ({ message }) => dependencies.openDashboard(message),
    factoryReset: () => dependencies.factoryReset(),
  };
  return Object.freeze(handlers);
}

export const RuntimeActionHandler = Object.freeze({
  RUNTIME_BACKGROUND_ACTIONS,
  createRuntimeActionHandlers,
});

export default RuntimeActionHandler;
