export type WorkflowStateKind = 'idle' | 'loading' | 'review' | 'empty' | 'success' | 'failure' | 'recovery';

export interface WorkflowState<T = unknown> {
  kind: WorkflowStateKind;
  phase: string;
  message: string;
  data?: T;
  error?: string;
  retryAvailable: boolean;
}

type MaybePromise<T> = T | Promise<T>;

export type WorkflowTranslator = (
  key: string,
  fallback: string,
  placeholders?: Record<string, string | number>,
) => string;

function translatedMessage(
  translate: WorkflowTranslator | undefined,
  key: string,
  fallback: string,
  placeholders: Record<string, string | number> = {},
): string {
  const translated = translate?.(key, fallback, placeholders);
  if (translated) return translated;
  return fallback.replace(/\{(\w+)\}/g, (_match, name: string) =>
    Object.prototype.hasOwnProperty.call(placeholders, name) ? String(placeholders[name]) : `{${name}}`,
  );
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return fallback;
}

function defaultEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

export interface ImportReviewAdapter<Input, Review, Result> {
  translate?: WorkflowTranslator;
  prepare(input: Input): MaybePromise<Review | null>;
  isEmpty?(review: Review | null): boolean;
  confirm(review: Review): MaybePromise<boolean>;
  apply(review: Review): MaybePromise<Result>;
  refresh?(result: Result): MaybePromise<void>;
  resultError?(result: Result): string;
  describeResult?(result: Result): string;
  render?(state: WorkflowState<Review | Result>): void;
  notify?(state: WorkflowState<Review | Result>): void;
}

export interface ImportReviewController<Input, Review, Result> {
  start(input: Input): Promise<WorkflowState<Review | Result>>;
  retry(): Promise<WorkflowState<Review | Result>>;
  getState(): WorkflowState<Review | Result>;
}

export function createImportReviewController<Input, Review, Result>(
  adapter: ImportReviewAdapter<Input, Review, Result>,
): ImportReviewController<Input, Review, Result> {
  const t = (key: string, fallback: string, placeholders?: Record<string, string | number>): string =>
    translatedMessage(adapter.translate, key, fallback, placeholders);
  let lastInput: Input | undefined;
  let hasLastInput = false;
  let state: WorkflowState<Review | Result> = {
    kind: 'idle',
    phase: 'idle',
    message: t('workflowImportReady', 'Ready to review an import.'),
    retryAvailable: false,
  };

  const emit = (next: WorkflowState<Review | Result>): WorkflowState<Review | Result> => {
    state = { ...next };
    adapter.render?.(state);
    if (state.kind === 'success' || state.kind === 'failure' || state.kind === 'empty') {
      adapter.notify?.(state);
    }
    return state;
  };

  const execute = async (input: Input): Promise<WorkflowState<Review | Result>> => {
    emit({
      kind: 'loading',
      phase: 'prepare',
      message: t('workflowImportReading', 'Reading import…'),
      retryAvailable: false,
    });
    try {
      const review = await adapter.prepare(input);
      if ((adapter.isEmpty || defaultEmpty)(review)) {
        return emit({
          kind: 'empty',
          phase: 'prepare',
          message: t('workflowImportEmpty', 'No importable scripts were found.'),
          data: review ?? undefined,
          retryAvailable: false,
        });
      }

      emit({
        kind: 'review',
        phase: 'confirm',
        message: t('workflowImportReviewRequired', 'Review required before import.'),
        data: review as Review,
        retryAvailable: false,
      });
      const confirmed = await adapter.confirm(review as Review);
      if (!confirmed) {
        return emit({
          kind: 'recovery',
          phase: 'cancelled',
          message: t('workflowImportCancelled', 'Import cancelled. Choose the file again when ready.'),
          data: review as Review,
          retryAvailable: true,
        });
      }

      emit({
        kind: 'loading',
        phase: 'apply',
        message: t('workflowImportApplying', 'Importing reviewed scripts…'),
        data: review as Review,
        retryAvailable: false,
      });
      const result = await adapter.apply(review as Review);
      const resultError = adapter.resultError?.(result) || '';
      if (resultError) throw new Error(resultError);
      await adapter.refresh?.(result);
      return emit({
        kind: 'success',
        phase: 'complete',
        message: adapter.describeResult?.(result) || t('workflowImportComplete', 'Import complete.'),
        data: result,
        retryAvailable: false,
      });
    } catch (error) {
      const message = errorMessage(error, t('workflowImportFailed', 'Import failed.'));
      return emit({
        kind: 'failure',
        phase: 'failed',
        message,
        error: message,
        retryAvailable: hasLastInput,
      });
    }
  };

  return {
    async start(input) {
      lastInput = input;
      hasLastInput = true;
      return execute(input);
    },
    async retry() {
      if (!hasLastInput) {
        return emit({
          kind: 'empty',
          phase: 'retry',
          message: t('workflowImportChooseBeforeRetry', 'Choose an import before retrying.'),
          retryAvailable: false,
        });
      }
      emit({
        kind: 'recovery',
        phase: 'retry',
        message: t('workflowImportRetrying', 'Retrying the last import…'),
        retryAvailable: false,
      });
      return execute(lastInput as Input);
    },
    getState: () => ({ ...state }),
  };
}

export type SettingsSaveStateKind = 'saved' | 'saving' | 'invalid' | 'error';

export interface SettingsSaveState {
  kind: SettingsSaveStateKind;
  message: string;
  pending: number;
  key?: string;
}

export interface SettingValidationResult {
  ok: boolean;
  value?: unknown;
  error?: string;
}

export interface SerializedSettingsAdapter {
  translate?: WorkflowTranslator;
  validate(key: string, value: unknown, context: Record<string, unknown>): SettingValidationResult;
  read(key: string): unknown;
  write(key: string, value: unknown): void;
  persist(key: string, value: unknown): MaybePromise<void>;
  apply?(key: string, value: unknown): MaybePromise<void>;
  restoreInput?(key: string, value: unknown, context: Record<string, unknown>): void;
  setFieldError?(key: string, message: string, context: Record<string, unknown>): void;
  render?(state: SettingsSaveState): void;
  notify?(message: string, tone: 'error' | 'success'): void;
  savedMessage?(key: string, value: unknown): string;
}

export interface SerializedSettingsController {
  save(key: string, value: unknown, context?: Record<string, unknown>): Promise<boolean>;
  saveOrThrow(key: string, value: unknown, context?: Record<string, unknown>): Promise<true>;
  getState(): SettingsSaveState;
  getPendingKeys(): string[];
}

export function createSerializedSettingsController(adapter: SerializedSettingsAdapter): SerializedSettingsController {
  const t = (key: string, fallback: string, placeholders?: Record<string, string | number>): string =>
    translatedMessage(adapter.translate, key, fallback, placeholders);
  const queues = new Map<string, Promise<boolean>>();
  let pending = 0;
  let lastState: SettingsSaveState = { kind: 'saved', message: t('workflowSettingsSaved', 'Saved'), pending: 0 };

  const emit = (kind: SettingsSaveStateKind, message: string, key?: string): void => {
    lastState = { kind, message, pending, ...(key ? { key } : {}) };
    adapter.render?.({ ...lastState });
  };

  const saveNow = async (
    key: string,
    inputValue: unknown,
    context: Record<string, unknown>,
  ): Promise<boolean> => {
    const validation = adapter.validate(key, inputValue, context);
    if (!validation.ok) {
      const message = validation.error || t('workflowSettingsInvalidValue', 'Invalid value for {key}', { key });
      adapter.setFieldError?.(key, message, context);
      lastState = { kind: 'invalid', message: t('workflowSettingsNeedsAttention', 'Needs attention'), pending, key };
      if (!context.quiet) adapter.notify?.(message, 'error');
      return false;
    }

    adapter.setFieldError?.(key, '', context);
    const value = Object.prototype.hasOwnProperty.call(validation, 'value') ? validation.value : inputValue;
    const previousValue = adapter.read(key);
    adapter.write(key, value);
    try {
      await adapter.persist(key, value);
    } catch (_error) {
      // Persist failed: the new value was never committed, so roll back the
      // in-memory value and the input, and tell the user their prior value
      // is still active.
      adapter.write(key, previousValue);
      adapter.restoreInput?.(key, previousValue, context);
      lastState = { kind: 'error', message: t('workflowSettingsSaveFailed', 'Save failed'), pending, key };
      if (!context.quiet) adapter.notify?.(t(
        'workflowSettingsPreviousValueActive',
        'Couldn’t save this setting. Your previous value is still active.',
      ), 'error');
      return false;
    }
    try {
      // Persist succeeded — the value is committed. If applying it live
      // fails, do NOT roll back (that would desync the input from storage);
      // report success since a reload will pick up the saved value.
      await adapter.apply?.(key, value);
    } catch (_error) {
      lastState = { kind: 'saved', message: adapter.savedMessage?.(key, value) || t('workflowSettingsSaved', 'Saved'), pending, key };
      return true;
    }
    lastState = {
      kind: 'saved',
      message: adapter.savedMessage?.(key, value) || t('workflowSettingsSaved', 'Saved'),
      pending,
      key,
    };
    return true;
  };

  const save = (
    key: string,
    value: unknown,
    context: Record<string, unknown> = {},
  ): Promise<boolean> => {
    pending += 1;
    emit('saving', t('workflowSettingsSaving', 'Saving…'), key);
    const previous = queues.get(key) || Promise.resolve(true);
    const queued = previous.catch(() => false).then(() => saveNow(key, value, context));
    queues.set(key, queued);
    return queued.finally(() => {
      if (queues.get(key) === queued) queues.delete(key);
      pending = Math.max(0, pending - 1);
      if (pending > 0) {
        emit('saving', t('workflowSettingsSaving', 'Saving…'), key);
      } else {
        emit(lastState.kind, lastState.message, lastState.key);
      }
    });
  };

  return {
    save,
    async saveOrThrow(key, value, context = {}) {
      const saved = await save(key, value, { ...context, quiet: true });
      if (!saved) throw new Error(t('workflowSettingsSaveKeyFailed', 'Failed to save {key}', { key }));
      return true;
    },
    getState: () => ({ ...lastState, pending }),
    getPendingKeys: () => [...queues.keys()],
  };
}

export interface DiagnosticsAdapter {
  translate?: WorkflowTranslator;
  loaders: Record<string, () => MaybePromise<unknown>>;
  isEmpty?(value: unknown, key: string): boolean;
  render?(state: WorkflowState<Record<string, unknown>>): void;
  notify?(state: WorkflowState<Record<string, unknown>>): void;
}

export interface DiagnosticsController {
  refresh(options?: { announce?: boolean }): Promise<WorkflowState<Record<string, unknown>>>;
  retry(options?: { announce?: boolean }): Promise<WorkflowState<Record<string, unknown>>>;
  getState(): WorkflowState<Record<string, unknown>>;
}

export function createDiagnosticsController(adapter: DiagnosticsAdapter): DiagnosticsController {
  const t = (key: string, fallback: string, placeholders?: Record<string, string | number>): string =>
    translatedMessage(adapter.translate, key, fallback, placeholders);
  let state: WorkflowState<Record<string, unknown>> = {
    kind: 'idle',
    phase: 'idle',
    message: t('workflowDiagnosticsNotRefreshed', 'Diagnostics have not been refreshed.'),
    retryAvailable: false,
  };

  const emit = (
    next: WorkflowState<Record<string, unknown>>,
    announce = false,
  ): WorkflowState<Record<string, unknown>> => {
    state = { ...next, data: next.data ? { ...next.data } : undefined };
    adapter.render?.(state);
    // 'empty' announces too: an explicit retry that still finds nothing
    // available must give feedback rather than fail silently.
    if (announce && (state.kind === 'success' || state.kind === 'failure' || state.kind === 'recovery' || state.kind === 'empty')) {
      adapter.notify?.(state);
    }
    return state;
  };

  const refresh = async (options: { announce?: boolean } = {}): Promise<WorkflowState<Record<string, unknown>>> => {
    const announce = options.announce === true;
    emit({
      kind: 'loading',
      phase: 'refresh',
      message: t('workflowDiagnosticsRefreshing', 'Refreshing diagnostics…'),
      retryAvailable: false,
    });
    const entries = Object.entries(adapter.loaders);
    // Wrap each loader so a synchronous throw becomes a rejected promise
    // rather than breaking out of the whole refresh.
    const settled = await Promise.allSettled(
      entries.map(([, loader]) => (async () => loader())()),
    );
    const data: Record<string, unknown> = {};
    const failures: string[] = [];
    let emptyCount = 0;

    settled.forEach((result, index) => {
      const key = entries[index]?.[0] || `loader-${index}`;
      if (result.status === 'rejected') {
        failures.push(`${key}: ${errorMessage(result.reason, t('workflowDiagnosticsUnavailable', 'unavailable'))}`);
        return;
      }
      data[key] = result.value;
      if ((adapter.isEmpty || defaultEmpty)(result.value, key)) emptyCount += 1;
    });

    const availableCount = entries.length - failures.length - emptyCount;
    if (availableCount === 0 && failures.length > 0) {
      return emit({
        kind: 'failure',
        phase: 'failed',
        message: failures.join(' · '),
        error: failures.join(' · '),
        data,
        retryAvailable: true,
      }, announce);
    }
    if (availableCount === 0) {
      return emit({
        kind: 'empty',
        phase: 'complete',
        message: t('workflowDiagnosticsEmpty', 'No diagnostics are available yet.'),
        data,
        retryAvailable: true,
      }, announce);
    }
    if (failures.length > 0 || emptyCount > 0) {
      const unavailable = failures.length + emptyCount;
      return emit({
        kind: 'recovery',
        phase: 'degraded',
        message: t(
          unavailable === 1 ? 'workflowDiagnosticSourceUnavailable' : 'workflowDiagnosticSourcesUnavailable',
          unavailable === 1
            ? '{count} diagnostic source unavailable. Showing the last available data.'
            : '{count} diagnostic sources unavailable. Showing the last available data.',
          { count: unavailable },
        ),
        data,
        error: failures.join(' · ') || undefined,
        retryAvailable: true,
      }, announce);
    }
    return emit({
      kind: 'success',
      phase: 'complete',
      message: t('workflowDiagnosticsRefreshed', 'Diagnostics refreshed.'),
      data,
      retryAvailable: false,
    }, announce);
  };

  return {
    refresh,
    async retry(options = {}) {
      emit({
        kind: 'recovery',
        phase: 'retry',
        message: t('workflowDiagnosticsRetrying', 'Retrying diagnostic sources…'),
        data: state.data,
        retryAvailable: false,
      });
      return refresh(options);
    },
    getState: () => ({ ...state, data: state.data ? { ...state.data } : undefined }),
  };
}

export const DashboardWorkflowControllers = Object.freeze({
  createImportReviewController,
  createSerializedSettingsController,
  createDiagnosticsController,
});

export default DashboardWorkflowControllers;
