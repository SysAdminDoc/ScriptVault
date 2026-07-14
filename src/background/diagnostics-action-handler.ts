import type { ResponseMap } from '../types/messages';
import type { BackgroundActionHandlers } from './message-router';

export const DIAGNOSTICS_BACKGROUND_ACTIONS = [
  'reportCSPFailure',
  'getCSPReports',
  'getNetworkLog',
  'getNetworkLogStats',
  'clearNetworkLog',
  'analyzeScript',
  'getOnDeviceAIStatus',
  'runOnDeviceAI',
  'getScriptStats',
  'getExecutionDiagnostics',
  'resetScriptStats',
  'reportDocumentReady',
  'npmResolve',
  'npmResolveAll',
  'logError',
  'getErrorLog',
  'getErrorLogGrouped',
  'exportErrorLog',
  'clearErrorLog',
  'getNotificationPrefs',
  'setNotificationPrefs',
  'generateDigest',
  'scriptConsoleCapture',
  'getScriptConsole',
  'clearScriptConsole',
  'setLiveReload',
  'getLiveReloadScripts',
] as const;

export type DiagnosticsBackgroundAction = typeof DIAGNOSTICS_BACKGROUND_ACTIONS[number];

export interface OnDeviceAiPromptInput {
  mode?: string;
  code: string;
  metadata: Record<string, unknown> | null;
  analysis: Record<string, unknown> | null;
  prompt: string;
}

export interface DiagnosticsActionDependencies {
  reportCspFailure(url: string, scriptId: string, directive: string): Promise<ResponseMap['reportCSPFailure']>;
  getCspReports(): Promise<ResponseMap['getCSPReports']>;
  getNetworkLog(filters: Record<string, unknown>): Promise<ResponseMap['getNetworkLog']> | ResponseMap['getNetworkLog'];
  getNetworkLogStats(): Promise<ResponseMap['getNetworkLogStats']> | ResponseMap['getNetworkLogStats'];
  clearNetworkLog(scriptId?: string): Promise<ResponseMap['clearNetworkLog']> | ResponseMap['clearNetworkLog'];
  analyzeScript(code: string): Promise<ResponseMap['analyzeScript']>;
  getOnDeviceAiStatus(): Promise<ResponseMap['getOnDeviceAIStatus']>;
  runOnDeviceAi(input: OnDeviceAiPromptInput): Promise<ResponseMap['runOnDeviceAI']>;
  getScriptStats(scriptId?: string): Promise<ResponseMap['getScriptStats']>;
  getExecutionDiagnostics(tabId: number): Promise<ResponseMap['getExecutionDiagnostics']> | ResponseMap['getExecutionDiagnostics'];
  resetScriptStats(scriptId: string): Promise<ResponseMap['resetScriptStats']>;
  reportDocumentReady(url: string, sender: unknown): Promise<ResponseMap['reportDocumentReady']> | ResponseMap['reportDocumentReady'];
  npmResolve(spec: string): Promise<ResponseMap['npmResolve']>;
  npmResolveAll(requires: string[]): Promise<ResponseMap['npmResolveAll']>;
  logError(entry: Record<string, unknown>): Promise<ResponseMap['logError']>;
  getErrorLog(filters?: Record<string, unknown>): Promise<ResponseMap['getErrorLog']>;
  getErrorLogGrouped(): Promise<ResponseMap['getErrorLogGrouped']>;
  exportErrorLog(format: 'json' | 'csv' | 'text'): Promise<ResponseMap['exportErrorLog']>;
  clearErrorLog(): Promise<ResponseMap['clearErrorLog']>;
  getNotificationPrefs(): Promise<ResponseMap['getNotificationPrefs']>;
  setNotificationPrefs(prefs: Record<string, unknown>): Promise<ResponseMap['setNotificationPrefs']>;
  generateDigest(): Promise<ResponseMap['generateDigest']>;
  captureScriptConsole(scriptId: string, entries: unknown[]): Promise<ResponseMap['scriptConsoleCapture']>;
  getScriptConsole(scriptId: string): Promise<ResponseMap['getScriptConsole']>;
  clearScriptConsole(scriptId: string): Promise<ResponseMap['clearScriptConsole']>;
  setLiveReload(scriptId: string, enabled: boolean): Promise<ResponseMap['setLiveReload']>;
  getLiveReloadScripts(): Promise<ResponseMap['getLiveReloadScripts']>;
}

export function createDiagnosticsActionHandlers(
  dependencies: DiagnosticsActionDependencies,
): Pick<BackgroundActionHandlers, DiagnosticsBackgroundAction> {
  const handlers: Pick<BackgroundActionHandlers, DiagnosticsBackgroundAction> = {
    reportCSPFailure: ({ message }) => dependencies.reportCspFailure(message.url, message.scriptId, message.directive),
    getCSPReports: () => dependencies.getCspReports(),
    getNetworkLog: ({ message }) => dependencies.getNetworkLog(message),
    getNetworkLogStats: () => dependencies.getNetworkLogStats(),
    clearNetworkLog: ({ message }) => dependencies.clearNetworkLog(message.scriptId),
    analyzeScript: ({ message }) => dependencies.analyzeScript(message.code || ''),
    getOnDeviceAIStatus: () => dependencies.getOnDeviceAiStatus(),
    runOnDeviceAI: ({ message }) => dependencies.runOnDeviceAi({
      mode: message.mode,
      code: message.code || '',
      metadata: message.metadata || null,
      analysis: message.analysis || null,
      prompt: message.prompt || '',
    }),
    getScriptStats: ({ message }) => dependencies.getScriptStats(message.scriptId),
    getExecutionDiagnostics: ({ message }) => dependencies.getExecutionDiagnostics(Number(message.tabId)),
    resetScriptStats: ({ message }) => dependencies.resetScriptStats(message.scriptId),
    reportDocumentReady: ({ message, sender }) => dependencies.reportDocumentReady(message.url || '', sender),
    npmResolve: ({ message }) => dependencies.npmResolve(message.spec),
    npmResolveAll: ({ message }) => dependencies.npmResolveAll(message.requires),
    logError: ({ message }) => dependencies.logError(message.entry || message),
    getErrorLog: ({ message }) => dependencies.getErrorLog(message.filters),
    getErrorLogGrouped: () => dependencies.getErrorLogGrouped(),
    exportErrorLog: ({ message }) => dependencies.exportErrorLog(message.format || 'json'),
    clearErrorLog: () => dependencies.clearErrorLog(),
    getNotificationPrefs: () => dependencies.getNotificationPrefs(),
    setNotificationPrefs: ({ message }) => dependencies.setNotificationPrefs(message.prefs),
    generateDigest: () => dependencies.generateDigest(),
    scriptConsoleCapture: ({ message }) => dependencies.captureScriptConsole(message.scriptId, message.entries),
    getScriptConsole: ({ message }) => dependencies.getScriptConsole(message.scriptId),
    clearScriptConsole: ({ message }) => dependencies.clearScriptConsole(message.scriptId),
    setLiveReload: ({ message }) => dependencies.setLiveReload(message.scriptId, message.enabled),
    getLiveReloadScripts: () => dependencies.getLiveReloadScripts(),
  };
  return Object.freeze(handlers);
}

export const DiagnosticsActionHandler = Object.freeze({
  DIAGNOSTICS_BACKGROUND_ACTIONS,
  createDiagnosticsActionHandlers,
});

export default DiagnosticsActionHandler;
