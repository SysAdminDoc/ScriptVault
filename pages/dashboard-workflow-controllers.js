// ============================================================================
// Generated from src/pages/dashboard-workflow-controllers.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const DashboardWorkflowControllers = (() => {
  const module = { exports: {} };
  const exports = module.exports;
  "use strict";
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/pages/dashboard-workflow-controllers.ts
  var dashboard_workflow_controllers_exports = {};
  __export(dashboard_workflow_controllers_exports, {
    DashboardWorkflowControllers: () => DashboardWorkflowControllers,
    createDiagnosticsController: () => createDiagnosticsController,
    createImportReviewController: () => createImportReviewController,
    createSerializedSettingsController: () => createSerializedSettingsController,
    default: () => dashboard_workflow_controllers_default
  });
  module.exports = __toCommonJS(dashboard_workflow_controllers_exports);
  function errorMessage(error, fallback) {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === "string" && error) return error;
    return fallback;
  }
  function defaultEmpty(value) {
    if (value == null) return true;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === "object") return Object.keys(value).length === 0;
    return false;
  }
  function createImportReviewController(adapter) {
    let lastInput;
    let hasLastInput = false;
    let state = {
      kind: "idle",
      phase: "idle",
      message: "Ready to review an import.",
      retryAvailable: false
    };
    const emit = (next) => {
      state = { ...next };
      adapter.render?.(state);
      if (state.kind === "success" || state.kind === "failure" || state.kind === "empty") {
        adapter.notify?.(state);
      }
      return state;
    };
    const execute = async (input) => {
      emit({
        kind: "loading",
        phase: "prepare",
        message: "Reading import\u2026",
        retryAvailable: false
      });
      try {
        const review = await adapter.prepare(input);
        if ((adapter.isEmpty || defaultEmpty)(review)) {
          return emit({
            kind: "empty",
            phase: "prepare",
            message: "No importable scripts were found.",
            data: review ?? void 0,
            retryAvailable: false
          });
        }
        emit({
          kind: "review",
          phase: "confirm",
          message: "Review required before import.",
          data: review,
          retryAvailable: false
        });
        const confirmed = await adapter.confirm(review);
        if (!confirmed) {
          return emit({
            kind: "recovery",
            phase: "cancelled",
            message: "Import cancelled. Choose the file again when ready.",
            data: review,
            retryAvailable: true
          });
        }
        emit({
          kind: "loading",
          phase: "apply",
          message: "Importing reviewed scripts\u2026",
          data: review,
          retryAvailable: false
        });
        const result = await adapter.apply(review);
        const resultError = adapter.resultError?.(result) || "";
        if (resultError) throw new Error(resultError);
        await adapter.refresh?.(result);
        return emit({
          kind: "success",
          phase: "complete",
          message: adapter.describeResult?.(result) || "Import complete.",
          data: result,
          retryAvailable: false
        });
      } catch (error) {
        const message = errorMessage(error, "Import failed.");
        return emit({
          kind: "failure",
          phase: "failed",
          message,
          error: message,
          retryAvailable: hasLastInput
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
            kind: "empty",
            phase: "retry",
            message: "Choose an import before retrying.",
            retryAvailable: false
          });
        }
        emit({
          kind: "recovery",
          phase: "retry",
          message: "Retrying the last import\u2026",
          retryAvailable: false
        });
        return execute(lastInput);
      },
      getState: () => ({ ...state })
    };
  }
  function createSerializedSettingsController(adapter) {
    const queues = /* @__PURE__ */ new Map();
    let pending = 0;
    let lastState = { kind: "saved", message: "Saved", pending: 0 };
    const emit = (kind, message, key) => {
      lastState = { kind, message, pending, ...key ? { key } : {} };
      adapter.render?.({ ...lastState });
    };
    const saveNow = async (key, inputValue, context) => {
      const validation = adapter.validate(key, inputValue, context);
      if (!validation.ok) {
        const message = validation.error || `Invalid value for ${key}`;
        adapter.setFieldError?.(key, message, context);
        lastState = { kind: "invalid", message: "Needs attention", pending, key };
        if (!context.quiet) adapter.notify?.(message, "error");
        return false;
      }
      adapter.setFieldError?.(key, "", context);
      const value = Object.prototype.hasOwnProperty.call(validation, "value") ? validation.value : inputValue;
      const previousValue = adapter.read(key);
      adapter.write(key, value);
      try {
        await adapter.persist(key, value);
      } catch (_error) {
        adapter.write(key, previousValue);
        adapter.restoreInput?.(key, previousValue, context);
        lastState = { kind: "error", message: "Save failed", pending, key };
        if (!context.quiet) adapter.notify?.("Couldn\u2019t save this setting. Your previous value is still active.", "error");
        return false;
      }
      try {
        await adapter.apply?.(key, value);
      } catch (_error) {
        lastState = { kind: "saved", message: adapter.savedMessage?.(key, value) || "Saved", pending, key };
        return true;
      }
      lastState = {
        kind: "saved",
        message: adapter.savedMessage?.(key, value) || "Saved",
        pending,
        key
      };
      return true;
    };
    const save = (key, value, context = {}) => {
      pending += 1;
      emit("saving", "Saving\u2026", key);
      const previous = queues.get(key) || Promise.resolve(true);
      const queued = previous.catch(() => false).then(() => saveNow(key, value, context));
      queues.set(key, queued);
      return queued.finally(() => {
        if (queues.get(key) === queued) queues.delete(key);
        pending = Math.max(0, pending - 1);
        if (pending > 0) {
          emit("saving", "Saving\u2026", key);
        } else {
          emit(lastState.kind, lastState.message, lastState.key);
        }
      });
    };
    return {
      save,
      async saveOrThrow(key, value, context = {}) {
        const saved = await save(key, value, { ...context, quiet: true });
        if (!saved) throw new Error(`Failed to save ${key}`);
        return true;
      },
      getState: () => ({ ...lastState, pending }),
      getPendingKeys: () => [...queues.keys()]
    };
  }
  function createDiagnosticsController(adapter) {
    let state = {
      kind: "idle",
      phase: "idle",
      message: "Diagnostics have not been refreshed.",
      retryAvailable: false
    };
    const emit = (next, announce = false) => {
      state = { ...next, data: next.data ? { ...next.data } : void 0 };
      adapter.render?.(state);
      if (announce && (state.kind === "success" || state.kind === "failure" || state.kind === "recovery" || state.kind === "empty")) {
        adapter.notify?.(state);
      }
      return state;
    };
    const refresh = async (options = {}) => {
      const announce = options.announce === true;
      emit({
        kind: "loading",
        phase: "refresh",
        message: "Refreshing diagnostics\u2026",
        retryAvailable: false
      });
      const entries = Object.entries(adapter.loaders);
      const settled = await Promise.allSettled(
        entries.map(([, loader]) => (async () => loader())())
      );
      const data = {};
      const failures = [];
      let emptyCount = 0;
      settled.forEach((result, index) => {
        const key = entries[index]?.[0] || `loader-${index}`;
        if (result.status === "rejected") {
          failures.push(`${key}: ${errorMessage(result.reason, "unavailable")}`);
          return;
        }
        data[key] = result.value;
        if ((adapter.isEmpty || defaultEmpty)(result.value, key)) emptyCount += 1;
      });
      const availableCount = entries.length - failures.length - emptyCount;
      if (availableCount === 0 && failures.length > 0) {
        return emit({
          kind: "failure",
          phase: "failed",
          message: failures.join(" \xB7 "),
          error: failures.join(" \xB7 "),
          data,
          retryAvailable: true
        }, announce);
      }
      if (availableCount === 0) {
        return emit({
          kind: "empty",
          phase: "complete",
          message: "No diagnostics are available yet.",
          data,
          retryAvailable: true
        }, announce);
      }
      if (failures.length > 0 || emptyCount > 0) {
        const unavailable = failures.length + emptyCount;
        return emit({
          kind: "recovery",
          phase: "degraded",
          message: `${unavailable} diagnostic source${unavailable === 1 ? "" : "s"} unavailable. Showing the last available data.`,
          data,
          error: failures.join(" \xB7 ") || void 0,
          retryAvailable: true
        }, announce);
      }
      return emit({
        kind: "success",
        phase: "complete",
        message: "Diagnostics refreshed.",
        data,
        retryAvailable: false
      }, announce);
    };
    return {
      refresh,
      async retry(options = {}) {
        emit({
          kind: "recovery",
          phase: "retry",
          message: "Retrying diagnostic sources\u2026",
          data: state.data,
          retryAvailable: false
        });
        return refresh(options);
      },
      getState: () => ({ ...state, data: state.data ? { ...state.data } : void 0 })
    };
  }
  var DashboardWorkflowControllers = Object.freeze({
    createImportReviewController,
    createSerializedSettingsController,
    createDiagnosticsController
  });
  var dashboard_workflow_controllers_default = DashboardWorkflowControllers;
  return module.exports.default || module.exports.DashboardWorkflowControllers || module.exports;
})();

if (typeof self !== 'undefined') {
  self.DashboardWorkflowControllers = DashboardWorkflowControllers;
}
