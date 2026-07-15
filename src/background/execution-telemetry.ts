// ============================================================================
// Execution telemetry trust boundary
// ============================================================================

export type ExecutionTelemetryAction = 'netlog_record' | 'reportExecError' | 'reportExecTime';
export type BridgeTelemetryKind = 'execution-error' | 'execution-time' | 'network';

export interface ExecutionTelemetrySender {
  userScriptId?: string;
  documentId?: string;
  frameId?: number;
  tab?: {
    id?: number;
    url?: string;
  };
}

interface RuntimeScriptStats {
  runs: number;
  totalTime: number;
  avgTime: number;
  lastRun: number;
  lastUrl?: string;
  errors: number;
  lastError?: string;
  lastErrorTime?: number;
  lastTabId?: number;
  lastDocumentId?: string;
  lastFrameId?: number;
}

interface RuntimeScript {
  id?: string;
  name?: string;
  meta?: { name?: string };
  stats?: RuntimeScriptStats;
}

interface ExecutionDiagnosticInput {
  type: 'run' | 'error';
  scriptId?: string;
  duration?: number;
  error?: string;
  url?: string;
}

interface ExecutionErrorLogInput {
  scriptId: string;
  scriptName: string;
  error: string;
  stack: string | null;
  url: string | null;
  source: string | null;
  line: number | null;
  col: number | null;
  generatedLine: number | null;
  generatedCol: number | null;
  context: 'script-execution';
}

interface NetworkLogInput {
  method?: string;
  url: string;
  status?: number;
  statusText?: string;
  duration?: number;
  responseSize?: number;
  responseHeaders?: Record<string, string>;
  scriptId?: string;
  scriptName?: string;
  error?: string;
  type?: string;
}

export interface ExecutionTelemetryDependencies {
  getScript(scriptId: string): Promise<RuntimeScript | null | undefined>;
  recordDiagnostic(sender: ExecutionTelemetrySender, event: ExecutionDiagnosticInput): unknown;
  scheduleStatsSave(): void;
  triggerAfterScript(scriptId: string, context: { reason: 'afterScript'; tabId?: number; url: string }): unknown;
  addNetworkLog(entry: NetworkLogInput): void;
  getStatsUrlRetention(): string;
  retainStatsUrl(url: string, mode: string): string;
  logExecutionError?(entry: ExecutionErrorLogInput): Promise<unknown> | unknown;
  onTriggerError?(error: unknown): void;
  now?(): number;
}

export interface ExecutionTelemetryHandler {
  handleBridgeTelemetry(data: unknown, sender: ExecutionTelemetrySender): Promise<Record<string, unknown>>;
  handleTrustedTelemetry(
    action: ExecutionTelemetryAction,
    data: unknown,
    sender: ExecutionTelemetrySender,
  ): Promise<Record<string, unknown>>;
}

interface CompletionState {
  timestamp: number;
  stages: Set<'error' | 'time'>;
}

interface RateState {
  startedAt: number;
  count: number;
}

interface NormalizedBridgeTelemetry {
  kind: BridgeTelemetryKind;
  duration?: number;
  error?: string;
  method?: string;
  url?: string;
  status?: number;
  statusText?: string;
  responseSize?: number;
  type?: string;
}

const COMPLETION_ID_PATTERN = /^[A-Za-z0-9_-]{16,128}$/u;
const COMPLETION_TTL_MS = 10 * 60 * 1000;
const COMPLETION_LIMIT = 4096;
const BRIDGE_RATE_WINDOW_MS = 10_000;
const BRIDGE_RATE_LIMIT = 60;
const BRIDGE_RATE_KEY_LIMIT = 256;
const MAX_DURATION_MS = 24 * 60 * 60 * 1000;
const MAX_RESPONSE_BYTES = 1024 * 1024 * 1024;

function cleanString(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.slice(0, maxLength) : '';
}

function cleanFiniteNumber(value: unknown, minimum: number, maximum: number): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum ? number : undefined;
}

function cleanInteger(value: unknown, minimum: number, maximum: number): number | undefined {
  const number = cleanFiniteNumber(value, minimum, maximum);
  return number !== undefined && Number.isInteger(number) ? number : undefined;
}

function normalizeHeaders(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const headers: Record<string, string> = {};
  for (const [rawName, rawValue] of Object.entries(value as Record<string, unknown>).slice(0, 64)) {
    const name = cleanString(rawName, 128).trim();
    const headerValue = cleanString(rawValue, 1024);
    if (name && headerValue) headers[name] = headerValue;
  }
  return Object.keys(headers).length > 0 ? headers : undefined;
}

export function normalizeBridgeTelemetry(value: unknown): NormalizedBridgeTelemetry | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const kind = data.kind;
  if (kind !== 'execution-error' && kind !== 'execution-time' && kind !== 'network') return null;

  if (kind === 'execution-error') {
    const error = cleanString(data.error, 500);
    return error ? { kind, error } : null;
  }
  if (kind === 'execution-time') {
    const duration = cleanFiniteNumber(data.duration, 0, MAX_DURATION_MS);
    return duration === undefined ? null : { kind, duration };
  }

  const url = cleanString(data.url, 4096);
  if (!url) return null;
  const normalized: NormalizedBridgeTelemetry = {
    kind,
    url,
    method: cleanString(data.method, 16).toUpperCase() || 'GET',
    type: cleanString(data.type, 32) || 'fetch',
  };
  const status = cleanInteger(data.status, 0, 999);
  const duration = cleanFiniteNumber(data.duration, 0, MAX_DURATION_MS);
  const responseSize = cleanInteger(data.responseSize, 0, MAX_RESPONSE_BYTES);
  const statusText = cleanString(data.statusText, 256);
  const error = cleanString(data.error, 500);
  if (status !== undefined) normalized.status = status;
  if (duration !== undefined) normalized.duration = duration;
  if (responseSize !== undefined) normalized.responseSize = responseSize;
  if (statusText) normalized.statusText = statusText;
  if (error) normalized.error = error;
  return normalized;
}

function normalizeTrustedNetworkTelemetry(data: Record<string, unknown>): NetworkLogInput | null {
  const url = cleanString(data.url, 4096);
  if (!url) return null;
  const entry: NetworkLogInput = {
    url,
    method: cleanString(data.method, 16).toUpperCase() || 'GET',
    type: cleanString(data.type, 32) || 'fetch',
  };
  const status = cleanInteger(data.status, 0, 999);
  const duration = cleanFiniteNumber(data.duration, 0, MAX_DURATION_MS);
  const responseSize = cleanInteger(data.responseSize, 0, MAX_RESPONSE_BYTES);
  const statusText = cleanString(data.statusText, 256);
  const error = cleanString(data.error, 500);
  const responseHeaders = normalizeHeaders(data.responseHeaders);
  if (status !== undefined) entry.status = status;
  if (duration !== undefined) entry.duration = duration;
  if (responseSize !== undefined) entry.responseSize = responseSize;
  if (statusText) entry.statusText = statusText;
  if (error) entry.error = error;
  if (responseHeaders) entry.responseHeaders = responseHeaders;
  return entry;
}

function senderRateKey(sender: ExecutionTelemetrySender): string | null {
  const tabId = sender?.tab?.id;
  if (!Number.isInteger(tabId) || Number(tabId) < 0) return null;
  const documentId = cleanString(sender.documentId, 256);
  const frameId = Number.isInteger(sender.frameId) && Number(sender.frameId) >= 0 ? Number(sender.frameId) : 0;
  return `${tabId}:${documentId || `frame-${frameId}`}`;
}

function setSenderContext(stats: RuntimeScriptStats, sender: ExecutionTelemetrySender): void {
  if (typeof sender?.tab?.id === 'number') stats.lastTabId = sender.tab.id;
  if (typeof sender?.documentId === 'string') stats.lastDocumentId = sender.documentId;
  if (typeof sender?.frameId === 'number') stats.lastFrameId = sender.frameId;
}

function defaultStats(): RuntimeScriptStats {
  return { runs: 0, totalTime: 0, avgTime: 0, lastRun: 0, errors: 0 };
}

export function createExecutionTelemetryHandler(
  dependencies: ExecutionTelemetryDependencies,
): ExecutionTelemetryHandler {
  const now = dependencies.now || Date.now;
  const completions = new Map<string, CompletionState>();
  const bridgeRates = new Map<string, RateState>();

  function pruneCompletions(timestamp: number): void {
    for (const [key, state] of completions) {
      if (timestamp - state.timestamp > COMPLETION_TTL_MS) completions.delete(key);
    }
    while (completions.size > COMPLETION_LIMIT) {
      const oldest = completions.keys().next().value;
      if (typeof oldest !== 'string') break;
      completions.delete(oldest);
    }
  }

  function claimCompletion(scriptId: string, completionId: unknown, stage: 'error' | 'time'): boolean {
    if (typeof completionId !== 'string' || !COMPLETION_ID_PATTERN.test(completionId)) return false;
    const timestamp = now();
    pruneCompletions(timestamp);
    const key = `${scriptId}:${completionId}`;
    const existing = completions.get(key);
    if (existing?.stages.has(stage)) return false;
    if (existing) {
      existing.timestamp = timestamp;
      existing.stages.add(stage);
      completions.delete(key);
      completions.set(key, existing);
    } else {
      completions.set(key, { timestamp, stages: new Set([stage]) });
    }
    pruneCompletions(timestamp);
    return true;
  }

  function allowBridgeTelemetry(sender: ExecutionTelemetrySender): boolean {
    const key = senderRateKey(sender);
    if (!key) return false;
    const timestamp = now();
    const existing = bridgeRates.get(key);
    if (!existing || timestamp - existing.startedAt >= BRIDGE_RATE_WINDOW_MS) {
      bridgeRates.delete(key);
      bridgeRates.set(key, { startedAt: timestamp, count: 1 });
    } else if (existing.count >= BRIDGE_RATE_LIMIT) {
      return false;
    } else {
      existing.count += 1;
    }
    while (bridgeRates.size > BRIDGE_RATE_KEY_LIMIT) {
      const oldest = bridgeRates.keys().next().value;
      if (typeof oldest !== 'string') break;
      bridgeRates.delete(oldest);
    }
    return true;
  }

  async function handleBridgeTelemetry(
    value: unknown,
    sender: ExecutionTelemetrySender,
  ): Promise<Record<string, unknown>> {
    const data = normalizeBridgeTelemetry(value);
    if (!data) return { error: 'Invalid page telemetry payload', trusted: false };
    if (!allowBridgeTelemetry(sender)) return { error: 'Page telemetry rate limit exceeded', trusted: false };

    if (data.kind === 'network') {
      dependencies.addNetworkLog({
        method: data.method,
        url: data.url || '',
        status: data.status,
        statusText: data.statusText,
        duration: data.duration,
        responseSize: data.responseSize,
        error: data.error,
        type: data.type,
      });
    } else if (data.kind === 'execution-time') {
      dependencies.recordDiagnostic(sender, {
        type: 'run',
        duration: data.duration,
        url: cleanString(sender?.tab?.url, 2048),
      });
    } else {
      dependencies.recordDiagnostic(sender, {
        type: 'error',
        error: data.error,
        url: cleanString(sender?.tab?.url, 2048),
      });
    }
    return { success: true, trusted: false };
  }

  async function handleTrustedTelemetry(
    action: ExecutionTelemetryAction,
    value: unknown,
    sender: ExecutionTelemetrySender,
  ): Promise<Record<string, unknown>> {
    const scriptId = cleanString(sender?.userScriptId, 256);
    if (!scriptId) return { error: 'Authenticated script identity is required', trusted: false };
    const data = value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
    const script = await dependencies.getScript(scriptId);
    if (!script) return { error: 'Authenticated script is not installed', trusted: true };

    if (action === 'netlog_record') {
      const entry = normalizeTrustedNetworkTelemetry(data);
      if (!entry) return { error: 'Invalid network telemetry payload', trusted: true };
      dependencies.addNetworkLog({
        ...entry,
        scriptId,
        scriptName: cleanString(script.meta?.name || script.name, 256) || scriptId,
      });
      return { ok: true, trusted: true };
    }

    const stage = action === 'reportExecTime' ? 'time' : 'error';
    if (typeof data.completionId !== 'string' || !COMPLETION_ID_PATTERN.test(data.completionId)) {
      return { error: 'Invalid execution completion id', trusted: true };
    }
    const duration = action === 'reportExecTime'
      ? cleanFiniteNumber(data.time, 0, MAX_DURATION_MS)
      : undefined;
    const error = action === 'reportExecError' ? cleanString(data.error, 500) : '';
    if (action === 'reportExecTime' && duration === undefined) {
      return { error: 'Invalid execution duration', trusted: true };
    }
    if (action === 'reportExecError' && !error) {
      return { error: 'Invalid execution error', trusted: true };
    }
    if (!claimCompletion(scriptId, data.completionId, stage)) {
      return { success: true, trusted: true, duplicate: true };
    }

    const eventUrl = cleanString(data.url, 4096) || cleanString(sender?.tab?.url, 4096);
    const stats = script.stats || (script.stats = defaultStats());
    if (action === 'reportExecTime') {
      stats.runs += 1;
      stats.totalTime += duration!;
      stats.avgTime = stats.runs > 0 ? Math.round((stats.totalTime / stats.runs) * 100) / 100 : 0;
      stats.lastRun = now();
      const retainedUrl = dependencies.retainStatsUrl(eventUrl, dependencies.getStatsUrlRetention());
      if (retainedUrl) stats.lastUrl = retainedUrl;
      else delete stats.lastUrl;
      setSenderContext(stats, sender);
      dependencies.recordDiagnostic(sender, { type: 'run', scriptId, duration: duration!, url: eventUrl });
      dependencies.scheduleStatsSave();
      try {
        const triggerResult = dependencies.triggerAfterScript(scriptId, {
          reason: 'afterScript',
          tabId: typeof sender?.tab?.id === 'number' ? sender.tab.id : undefined,
          url: eventUrl,
        });
        Promise.resolve(triggerResult).catch(error => dependencies.onTriggerError?.(error));
      } catch (error) {
        dependencies.onTriggerError?.(error);
      }
      return { success: true, trusted: true };
    }

    stats.errors += 1;
    stats.lastError = error;
    stats.lastErrorTime = now();
    setSenderContext(stats, sender);
    dependencies.recordDiagnostic(sender, { type: 'error', scriptId, error, url: eventUrl });
    if (dependencies.logExecutionError) {
      await dependencies.logExecutionError({
        scriptId,
        scriptName: cleanString(script.meta?.name || script.name, 256) || scriptId,
        error,
        stack: cleanString(data.stack, 8000) || null,
        url: eventUrl || null,
        source: cleanString(data.source, 4096) || null,
        line: cleanInteger(data.line, 1, 10_000_000) ?? null,
        col: cleanInteger(data.col, 1, 10_000_000) ?? null,
        generatedLine: cleanInteger(data.generatedLine, 1, 10_000_000) ?? null,
        generatedCol: cleanInteger(data.generatedCol, 1, 10_000_000) ?? null,
        context: 'script-execution',
      });
    }
    dependencies.scheduleStatsSave();
    return { success: true, trusted: true };
  }

  return Object.freeze({ handleBridgeTelemetry, handleTrustedTelemetry });
}

export const ExecutionTelemetry = Object.freeze({
  createExecutionTelemetryHandler,
  normalizeBridgeTelemetry,
});

export default ExecutionTelemetry;
