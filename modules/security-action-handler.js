// ============================================================================
// Generated from src/background/security-action-handler.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const SecurityActionHandler = (() => {
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

  // src/background/security-action-handler.ts
  var security_action_handler_exports = {};
  __export(security_action_handler_exports, {
    SECURITY_BACKGROUND_ACTIONS: () => SECURITY_BACKGROUND_ACTIONS,
    SecurityActionHandler: () => SecurityActionHandler,
    createSecurityActionHandlers: () => createSecurityActionHandlers,
    default: () => security_action_handler_default,
    senderWebOrigin: () => senderWebOrigin
  });
  module.exports = __toCommonJS(security_action_handler_exports);
  var SECURITY_BACKGROUND_ACTIONS = [
    "signing_getPublicKey",
    "signing_sign",
    "signing_verify",
    "signing_verifyRaw",
    "signing_trustKey",
    "signing_untrustKey",
    "signing_getTrustedKeys",
    "signing_generateNewKeypair",
    "publicApi_getTrustedOrigins",
    "publicApi_setTrustedOrigins",
    "publicApi_getTrustedExtensionIds",
    "publicApi_setTrustedExtensionIds",
    "publicApi_getLocalMcpBridgeConfig",
    "publicApi_setLocalMcpBridgeConfig",
    "publicApi_getPermissions",
    "publicApi_getAuditLog",
    "publicApi_clearAuditLog",
    "publicApi_handleWebMessage"
  ];
  function senderWebOrigin(sender) {
    const record = sender;
    const declared = typeof record?.origin === "string" ? record.origin : "";
    const candidate = declared || (typeof record?.url === "string" ? record.url : "");
    if (!candidate) return "";
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
      return parsed.origin;
    } catch {
      return "";
    }
  }
  function createSecurityActionHandlers(dependencies) {
    const handlers = {
      signing_getPublicKey: () => dependencies.getPublicKey(),
      signing_sign: ({ message }) => message.code ? dependencies.sign(message.code) : { error: "No code provided" },
      signing_verify: ({ message }) => message.code ? dependencies.verify(message.code) : { error: "No code provided" },
      signing_verifyRaw: ({ message }) => message.code && message.signatureInfo ? dependencies.verifyRaw(message.code, message.signatureInfo) : { error: "Missing inputs" },
      signing_trustKey: ({ message }) => message.publicKey ? dependencies.trustKey(message.publicKey, message.name) : { error: "No public key" },
      signing_untrustKey: ({ message }) => message.publicKey ? dependencies.untrustKey(message.publicKey) : { success: false, error: "No public key" },
      signing_getTrustedKeys: () => dependencies.getTrustedKeys(),
      signing_generateNewKeypair: () => dependencies.generateKeypair(),
      publicApi_getTrustedOrigins: () => dependencies.getTrustedOrigins(),
      publicApi_setTrustedOrigins: ({ message }) => dependencies.setTrustedOrigins(
        Array.isArray(message.origins) ? message.origins : []
      ),
      publicApi_getTrustedExtensionIds: () => dependencies.getTrustedExtensionIds(),
      publicApi_setTrustedExtensionIds: ({ message }) => dependencies.setTrustedExtensionIds(
        Array.isArray(message.extensionIds) ? message.extensionIds : []
      ),
      publicApi_getLocalMcpBridgeConfig: () => dependencies.getLocalMcpBridgeConfig(),
      publicApi_setLocalMcpBridgeConfig: ({ message }) => dependencies.setLocalMcpBridgeConfig(
        message.config && typeof message.config === "object" ? message.config : {}
      ),
      publicApi_getPermissions: () => dependencies.getPermissions(),
      publicApi_getAuditLog: ({ message }) => dependencies.getAuditLog(message.limit || 50),
      publicApi_clearAuditLog: () => dependencies.clearAuditLog(),
      // The origin is derived from the SENDER, never from the relayed payload.
      // content.js sets `origin` from the page's own `event.origin`, but that field
      // is attacker-controllable by anything that can reach this action — a tab on
      // an untrusted origin could otherwise claim `origin: 'https://trusted.example'`
      // and pass the trusted-origin check for `scriptvault:mcp:writeScript`.
      publicApi_handleWebMessage: ({ message, sender }) => dependencies.handleWebMessage(
        senderWebOrigin(sender),
        message.message
      )
    };
    return Object.freeze(handlers);
  }
  var SecurityActionHandler = Object.freeze({
    SECURITY_BACKGROUND_ACTIONS,
    createSecurityActionHandlers,
    senderWebOrigin
  });
  var security_action_handler_default = SecurityActionHandler;
  return module.exports.default || module.exports.SecurityActionHandler || module.exports;
})();

if (typeof self !== 'undefined') {
  self.SecurityActionHandler = SecurityActionHandler;
}
