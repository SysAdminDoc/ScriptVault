// ============================================================================
// Generated from src/background/telemetry-action-handler.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const TelemetryActionHandler = (() => {
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

  // src/background/telemetry-action-handler.ts
  var telemetry_action_handler_exports = {};
  __export(telemetry_action_handler_exports, {
    EXECUTION_TELEMETRY_ACTIONS: () => EXECUTION_TELEMETRY_ACTIONS,
    TelemetryActionHandler: () => TelemetryActionHandler,
    createTelemetryActionHandlers: () => createTelemetryActionHandlers,
    default: () => telemetry_action_handler_default
  });
  module.exports = __toCommonJS(telemetry_action_handler_exports);
  var EXECUTION_TELEMETRY_ACTIONS = [
    "recordBridgeTelemetry",
    "netlog_record",
    "reportExecError",
    "reportExecTime"
  ];
  function asTelemetrySender(sender) {
    return sender && typeof sender === "object" ? sender : {};
  }
  function createTelemetryActionHandlers(dependencies) {
    return Object.freeze({
      recordBridgeTelemetry: ({ message, sender }) => dependencies.handleBridgeTelemetry(
        message,
        asTelemetrySender(sender)
      ),
      netlog_record: ({ message, sender }) => dependencies.handleTrustedTelemetry(
        "netlog_record",
        message,
        asTelemetrySender(sender)
      ),
      reportExecError: ({ message, sender }) => dependencies.handleTrustedTelemetry(
        "reportExecError",
        message,
        asTelemetrySender(sender)
      ),
      reportExecTime: ({ message, sender }) => dependencies.handleTrustedTelemetry(
        "reportExecTime",
        message,
        asTelemetrySender(sender)
      )
    });
  }
  var TelemetryActionHandler = Object.freeze({
    EXECUTION_TELEMETRY_ACTIONS,
    createTelemetryActionHandlers
  });
  var telemetry_action_handler_default = TelemetryActionHandler;
  return module.exports.default || module.exports.TelemetryActionHandler || module.exports;
})();

if (typeof self !== 'undefined') {
  self.TelemetryActionHandler = TelemetryActionHandler;
}
