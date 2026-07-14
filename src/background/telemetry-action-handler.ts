import type { ResponseMap } from '../types/messages';
import type { BackgroundActionHandlers } from './message-router';
import type {
  ExecutionTelemetryAction,
  ExecutionTelemetrySender,
} from './execution-telemetry';

export const EXECUTION_TELEMETRY_ACTIONS = [
  'recordBridgeTelemetry',
  'netlog_record',
  'reportExecError',
  'reportExecTime',
] as const;

export type ExecutionTelemetryBackgroundAction = typeof EXECUTION_TELEMETRY_ACTIONS[number];

export interface TelemetryActionDependencies {
  handleBridgeTelemetry(data: unknown, sender: ExecutionTelemetrySender): Promise<ResponseMap['recordBridgeTelemetry']>;
  handleTrustedTelemetry(
    action: ExecutionTelemetryAction,
    data: unknown,
    sender: ExecutionTelemetrySender,
  ): Promise<ResponseMap['netlog_record'] | ResponseMap['reportExecError'] | ResponseMap['reportExecTime']>;
}

function asTelemetrySender(sender: unknown): ExecutionTelemetrySender {
  return sender && typeof sender === 'object' ? sender as ExecutionTelemetrySender : {};
}

export function createTelemetryActionHandlers(
  dependencies: TelemetryActionDependencies,
): Pick<BackgroundActionHandlers, ExecutionTelemetryBackgroundAction> {
  return Object.freeze({
    recordBridgeTelemetry: ({ message, sender }) => dependencies.handleBridgeTelemetry(
      message,
      asTelemetrySender(sender),
    ),
    netlog_record: ({ message, sender }) => dependencies.handleTrustedTelemetry(
      'netlog_record',
      message,
      asTelemetrySender(sender),
    ) as Promise<ResponseMap['netlog_record']>,
    reportExecError: ({ message, sender }) => dependencies.handleTrustedTelemetry(
      'reportExecError',
      message,
      asTelemetrySender(sender),
    ) as Promise<ResponseMap['reportExecError']>,
    reportExecTime: ({ message, sender }) => dependencies.handleTrustedTelemetry(
      'reportExecTime',
      message,
      asTelemetrySender(sender),
    ) as Promise<ResponseMap['reportExecTime']>,
  });
}

export const TelemetryActionHandler = Object.freeze({
  EXECUTION_TELEMETRY_ACTIONS,
  createTelemetryActionHandlers,
});

export default TelemetryActionHandler;
