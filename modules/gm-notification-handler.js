// ============================================================================
// Generated from src/background/gm-notification-handler.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const GMNotificationHandler = (() => {
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

  // src/background/gm-notification-handler.ts
  var gm_notification_handler_exports = {};
  __export(gm_notification_handler_exports, {
    GMNotificationHandler: () => GMNotificationHandler,
    GM_NOTIFICATION_ACTIONS: () => GM_NOTIFICATION_ACTIONS,
    default: () => gm_notification_handler_default,
    handleGMNotificationMessage: () => handleGMNotificationMessage,
    isGMNotificationAction: () => isGMNotificationAction
  });
  module.exports = __toCommonJS(gm_notification_handler_exports);
  var GM_NOTIFICATION_ACTIONS = [
    "GM_closeNotification",
    "GM_notification",
    "GM_updateNotification"
  ];
  var SV_NOTIF_TITLE_MAX = 96;
  var SV_NOTIF_MESSAGE_MAX = 280;
  var GM_NOTIFICATION_ACTION_SET = new Set(GM_NOTIFICATION_ACTIONS);
  function notificationRuntime() {
    return globalThis;
  }
  function clampString(value, max) {
    const text = String(value ?? "");
    return text.length > max ? text.slice(0, max - 1) + "\u2026" : text;
  }
  function normalizeButtons(buttons) {
    if (!Array.isArray(buttons) || buttons.length === 0) return void 0;
    return buttons.slice(0, 2).map((button) => ({
      title: String(button?.title ?? "").slice(0, 200),
      ...button?.iconUrl ? { iconUrl: button.iconUrl } : {}
    }));
  }
  function persistNotifCallbacks() {
    notificationRuntime().SessionState?.persistNotifCallbacks?.();
  }
  function createNotification() {
    return chrome.notifications.create;
  }
  function updateNotification() {
    return chrome.notifications.update;
  }
  function clearNotification() {
    return chrome.notifications.clear;
  }
  function removeNotifCallback(id) {
    const runtime = notificationRuntime();
    if (runtime._notifCallbacks) {
      runtime._notifCallbacks.delete(id);
      persistNotifCallbacks();
    }
  }
  function ownedScriptId(sender, data) {
    const candidate = sender.userScriptId || data.scriptId;
    return typeof candidate === "string" && candidate ? candidate : void 0;
  }
  function namespaceNotificationId(scriptId, publicId) {
    return `${scriptId}:${publicId}`;
  }
  function resolveNotification(sender, data) {
    const scriptId = ownedScriptId(sender, data);
    const publicId = typeof data.id === "string" && data.id ? data.id : "";
    if (!scriptId || !publicId) return void 0;
    const runtime = notificationRuntime();
    const callbacks = runtime._notifCallbacks;
    if (!callbacks) return void 0;
    const namespacedId = namespaceNotificationId(scriptId, publicId);
    const namespacedEntry = callbacks.get(namespacedId);
    if (namespacedEntry?.scriptId === scriptId) {
      return { id: namespacedId, entry: namespacedEntry };
    }
    const directEntry = callbacks.get(publicId);
    if (directEntry?.scriptId === scriptId) {
      return { id: publicId, entry: directEntry };
    }
    return void 0;
  }
  function isGMNotificationAction(action) {
    return typeof action === "string" && GM_NOTIFICATION_ACTION_SET.has(action);
  }
  async function handleGMNotificationMessage(action, data = {}, sender = {}) {
    switch (action) {
      case "GM_notification": {
        const hasProgress = typeof data.progress === "number";
        const notifOpts = {
          type: hasProgress ? "progress" : "basic",
          iconUrl: data.image || "images/icon128.png",
          title: clampString(data.title || "ScriptVault", SV_NOTIF_TITLE_MAX),
          message: clampString(data.text || "", SV_NOTIF_MESSAGE_MAX),
          silent: data.silent || false
        };
        if (typeof data.requireInteraction === "boolean" && data.requireInteraction) {
          notifOpts.requireInteraction = true;
        }
        if (hasProgress) {
          notifOpts.progress = Math.max(0, Math.min(100, Math.floor(data.progress)));
        }
        const buttons = normalizeButtons(data.buttons);
        if (buttons) notifOpts.buttons = buttons;
        const scriptId = ownedScriptId(sender, data);
        const publicTag = typeof data.tag === "string" && data.tag ? data.tag : void 0;
        const chromeTag = scriptId && publicTag ? namespaceNotificationId(scriptId, publicTag) : publicTag;
        const notifId = chromeTag ? await createNotification()(chromeTag, notifOpts) : await createNotification()(notifOpts);
        const runtime = notificationRuntime();
        if (!runtime._notifCallbacks) runtime._notifCallbacks = /* @__PURE__ */ new Map();
        if (runtime._notifCallbacks.size >= 500 && !runtime._notifCallbacks.has(notifId)) {
          const oldest = runtime._notifCallbacks.keys().next().value;
          if (oldest !== void 0) runtime._notifCallbacks.delete(oldest);
        }
        runtime._notifCallbacks.set(notifId, {
          tabId: typeof sender.tab?.id === "number" ? sender.tab.id : -1,
          publicId: publicTag || notifId,
          scriptId,
          hasOnclick: data.hasOnclick,
          hasOndone: data.hasOndone,
          hasOnbuttonclick: data.hasOnbuttonclick
        });
        persistNotifCallbacks();
        if (data.timeout && data.timeout > 0) {
          if (data.timeout >= 3e4) {
            const alarmName = `notif_clear_${notifId}`;
            chrome.alarms.create(alarmName, { delayInMinutes: data.timeout / 6e4 });
          } else {
            setTimeout(() => {
              clearNotification()(notifId).catch(() => {
              });
              removeNotifCallback(notifId);
            }, data.timeout);
          }
        }
        return { success: true, id: publicTag || notifId };
      }
      case "GM_updateNotification": {
        if (!data.id) return { success: false, error: "Missing notification id" };
        const resolved = resolveNotification(sender, data);
        if (!resolved) {
          return { success: false, error: "Notification not owned by caller" };
        }
        const updateOpts = {};
        if (typeof data.title === "string") updateOpts.title = data.title;
        if (typeof data.text === "string") updateOpts.message = data.text;
        if (typeof data.image === "string") updateOpts.iconUrl = data.image;
        if (typeof data.progress === "number") {
          updateOpts.type = "progress";
          updateOpts.progress = Math.max(0, Math.min(100, Math.floor(data.progress)));
        }
        const buttons = normalizeButtons(data.buttons);
        if (buttons) updateOpts.buttons = buttons;
        if (typeof data.silent === "boolean") updateOpts.silent = data.silent;
        if (typeof data.requireInteraction === "boolean") updateOpts.requireInteraction = data.requireInteraction;
        try {
          const wasUpdated = await updateNotification()(resolved.id, updateOpts);
          return { success: !!wasUpdated };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : "Update failed" };
        }
      }
      case "GM_closeNotification": {
        if (!data.id) return { success: false, error: "Missing notification id" };
        const resolved = resolveNotification(sender, data);
        if (!resolved) {
          return { success: false, error: "Notification not owned by caller" };
        }
        try {
          await clearNotification()(resolved.id);
          removeNotifCallback(resolved.id);
          return { success: true };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : "Close failed" };
        }
      }
      default:
        return { error: `Unsupported GM notification action: ${action}` };
    }
  }
  var GMNotificationHandler = Object.freeze({
    GM_NOTIFICATION_ACTIONS,
    handleGMNotificationMessage,
    isGMNotificationAction
  });
  var gm_notification_handler_default = GMNotificationHandler;
  return module.exports.default || module.exports.GMNotificationHandler || module.exports;
})();

if (typeof self !== 'undefined') {
  self.GMNotificationHandler = GMNotificationHandler;
}
