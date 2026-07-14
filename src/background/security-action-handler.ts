import type { ResponseMap } from '../types/messages';
import type { BackgroundActionHandlers } from './message-router';

export const SECURITY_BACKGROUND_ACTIONS = [
  'signing_getPublicKey',
  'signing_sign',
  'signing_verify',
  'signing_verifyRaw',
  'signing_trustKey',
  'signing_untrustKey',
  'signing_getTrustedKeys',
  'signing_generateNewKeypair',
  'publicApi_getTrustedOrigins',
  'publicApi_setTrustedOrigins',
  'publicApi_getTrustedExtensionIds',
  'publicApi_setTrustedExtensionIds',
  'publicApi_getLocalMcpBridgeConfig',
  'publicApi_setLocalMcpBridgeConfig',
  'publicApi_getPermissions',
  'publicApi_getAuditLog',
  'publicApi_clearAuditLog',
  'publicApi_handleWebMessage',
] as const;

export type SecurityBackgroundAction = typeof SECURITY_BACKGROUND_ACTIONS[number];

export interface LocalMcpBridgeConfigUpdate {
  enabled?: boolean;
  origins?: string[];
  token?: string;
  clearToken?: boolean;
}

export interface SecurityActionDependencies {
  getPublicKey(): Promise<ResponseMap['signing_getPublicKey']>;
  sign(code: string): Promise<ResponseMap['signing_sign']>;
  verify(code: string): Promise<ResponseMap['signing_verify']>;
  verifyRaw(code: string, signatureInfo: Record<string, unknown>): Promise<ResponseMap['signing_verifyRaw']>;
  trustKey(publicKey: JsonWebKey, name?: string): Promise<ResponseMap['signing_trustKey']>;
  untrustKey(publicKey: JsonWebKey): Promise<ResponseMap['signing_untrustKey']>;
  getTrustedKeys(): Promise<ResponseMap['signing_getTrustedKeys']>;
  generateKeypair(): Promise<ResponseMap['signing_generateNewKeypair']>;
  getTrustedOrigins(): Promise<ResponseMap['publicApi_getTrustedOrigins']> | ResponseMap['publicApi_getTrustedOrigins'];
  setTrustedOrigins(origins: string[]): Promise<ResponseMap['publicApi_setTrustedOrigins']>;
  getTrustedExtensionIds(): Promise<ResponseMap['publicApi_getTrustedExtensionIds']> | ResponseMap['publicApi_getTrustedExtensionIds'];
  setTrustedExtensionIds(extensionIds: string[]): Promise<ResponseMap['publicApi_setTrustedExtensionIds']>;
  getLocalMcpBridgeConfig(): Promise<ResponseMap['publicApi_getLocalMcpBridgeConfig']> | ResponseMap['publicApi_getLocalMcpBridgeConfig'];
  setLocalMcpBridgeConfig(config: LocalMcpBridgeConfigUpdate): Promise<ResponseMap['publicApi_setLocalMcpBridgeConfig']>;
  getPermissions(): Promise<ResponseMap['publicApi_getPermissions']> | ResponseMap['publicApi_getPermissions'];
  getAuditLog(limit: number): Promise<ResponseMap['publicApi_getAuditLog']> | ResponseMap['publicApi_getAuditLog'];
  clearAuditLog(): Promise<ResponseMap['publicApi_clearAuditLog']>;
  handleWebMessage(origin: string, message: unknown): Promise<ResponseMap['publicApi_handleWebMessage']>;
}

export function createSecurityActionHandlers(
  dependencies: SecurityActionDependencies,
): Pick<BackgroundActionHandlers, SecurityBackgroundAction> {
  const handlers: Pick<BackgroundActionHandlers, SecurityBackgroundAction> = {
    signing_getPublicKey: () => dependencies.getPublicKey(),
    signing_sign: ({ message }) => message.code
      ? dependencies.sign(message.code)
      : { error: 'No code provided' },
    signing_verify: ({ message }) => message.code
      ? dependencies.verify(message.code)
      : { error: 'No code provided' },
    signing_verifyRaw: ({ message }) => message.code && message.signatureInfo
      ? dependencies.verifyRaw(message.code, message.signatureInfo)
      : { error: 'Missing inputs' },
    signing_trustKey: ({ message }) => message.publicKey
      ? dependencies.trustKey(message.publicKey, message.name)
      : { error: 'No public key' },
    signing_untrustKey: ({ message }) => message.publicKey
      ? dependencies.untrustKey(message.publicKey)
      : { success: false, error: 'No public key' },
    signing_getTrustedKeys: () => dependencies.getTrustedKeys(),
    signing_generateNewKeypair: () => dependencies.generateKeypair(),
    publicApi_getTrustedOrigins: () => dependencies.getTrustedOrigins(),
    publicApi_setTrustedOrigins: ({ message }) => dependencies.setTrustedOrigins(
      Array.isArray(message.origins) ? message.origins : [],
    ),
    publicApi_getTrustedExtensionIds: () => dependencies.getTrustedExtensionIds(),
    publicApi_setTrustedExtensionIds: ({ message }) => dependencies.setTrustedExtensionIds(
      Array.isArray(message.extensionIds) ? message.extensionIds : [],
    ),
    publicApi_getLocalMcpBridgeConfig: () => dependencies.getLocalMcpBridgeConfig(),
    publicApi_setLocalMcpBridgeConfig: ({ message }) => dependencies.setLocalMcpBridgeConfig(
      message.config && typeof message.config === 'object' ? message.config : {},
    ),
    publicApi_getPermissions: () => dependencies.getPermissions(),
    publicApi_getAuditLog: ({ message }) => dependencies.getAuditLog(message.limit || 50),
    publicApi_clearAuditLog: () => dependencies.clearAuditLog(),
    publicApi_handleWebMessage: ({ message }) => dependencies.handleWebMessage(
      typeof message.origin === 'string' ? message.origin : '',
      message.message,
    ),
  };
  return Object.freeze(handlers);
}

export const SecurityActionHandler = Object.freeze({
  SECURITY_BACKGROUND_ACTIONS,
  createSecurityActionHandlers,
});

export default SecurityActionHandler;
