import type { BackgroundMessage } from '../types/messages';

export type GMNotificationAction = Extract<
  BackgroundMessage['action'],
  | 'GM_closeNotification'
  | 'GM_notification'
  | 'GM_updateNotification'
>;

export const GM_NOTIFICATION_ACTIONS = [
  'GM_closeNotification',
  'GM_notification',
  'GM_updateNotification',
] as const satisfies readonly GMNotificationAction[];

type AssertNever<T extends never> = T;
type MissingGMNotificationActions = Exclude<GMNotificationAction, typeof GM_NOTIFICATION_ACTIONS[number]>;
type ExtraGMNotificationActions = Exclude<typeof GM_NOTIFICATION_ACTIONS[number], GMNotificationAction>;
type _MissingGMNotificationActionCheck = AssertNever<MissingGMNotificationActions>;
type _ExtraGMNotificationActionCheck = AssertNever<ExtraGMNotificationActions>;

const SV_NOTIF_TITLE_MAX = 96;
const SV_NOTIF_MESSAGE_MAX = 280;

interface RuntimeMessageSender {
  tab?: {
    id?: number;
  };
}

interface NotificationButtonPayload {
  iconUrl?: string;
  title?: unknown;
}

interface GMNotificationPayload {
  buttons?: NotificationButtonPayload[];
  hasOnbuttonclick?: boolean;
  hasOnclick?: boolean;
  hasOndone?: boolean;
  id?: string;
  image?: string;
  progress?: number;
  requireInteraction?: boolean;
  scriptId?: string;
  silent?: boolean;
  tag?: string;
  text?: string;
  timeout?: number;
  title?: string;
}

interface NotificationOptions {
  buttons?: Array<{ iconUrl?: string; title: string }>;
  iconUrl?: string;
  message?: string;
  progress?: number;
  requireInteraction?: boolean;
  silent?: boolean;
  title?: string;
  type?: string;
}

interface NotificationCreate {
  (notificationId: string, options: NotificationOptions): Promise<string>;
  (options: NotificationOptions): Promise<string>;
}

type NotificationUpdate = (notificationId: string, options: NotificationOptions) => Promise<boolean>;
type NotificationClear = (notificationId: string) => Promise<boolean>;

interface NotificationCallbackEntry {
  hasOnbuttonclick?: boolean;
  hasOnclick?: boolean;
  hasOndone?: boolean;
  scriptId?: string;
  tabId: number;
}

interface SessionStateRuntime {
  persistNotifCallbacks?(): void;
}

type NotificationRuntimeGlobal = typeof globalThis & {
  _notifCallbacks?: Map<string, NotificationCallbackEntry>;
  SessionState?: SessionStateRuntime;
};

const GM_NOTIFICATION_ACTION_SET: ReadonlySet<string> = new Set(GM_NOTIFICATION_ACTIONS);

function notificationRuntime(): NotificationRuntimeGlobal {
  return globalThis as NotificationRuntimeGlobal;
}

function clampString(value: unknown, max: number): string {
  const text = String(value ?? '');
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

function normalizeButtons(buttons: unknown): NotificationOptions['buttons'] {
  if (!Array.isArray(buttons) || buttons.length === 0) return undefined;
  return buttons.slice(0, 2).map((button) => ({
    title: String(button?.title ?? '').slice(0, 200),
    ...(button?.iconUrl ? { iconUrl: button.iconUrl } : {}),
  }));
}

function persistNotifCallbacks(): void {
  notificationRuntime().SessionState?.persistNotifCallbacks?.();
}

function createNotification(): NotificationCreate {
  return chrome.notifications.create as unknown as NotificationCreate;
}

function updateNotification(): NotificationUpdate {
  return chrome.notifications.update as unknown as NotificationUpdate;
}

function clearNotification(): NotificationClear {
  return chrome.notifications.clear as unknown as NotificationClear;
}

function removeNotifCallback(id: string): void {
  const runtime = notificationRuntime();
  if (runtime._notifCallbacks) {
    runtime._notifCallbacks.delete(id);
    persistNotifCallbacks();
  }
}

export function isGMNotificationAction(action: unknown): action is GMNotificationAction {
  return typeof action === 'string' && GM_NOTIFICATION_ACTION_SET.has(action);
}

export async function handleGMNotificationMessage(
  action: GMNotificationAction,
  data: GMNotificationPayload = {},
  sender: RuntimeMessageSender = {},
): Promise<Record<string, unknown>> {
  switch (action) {
    case 'GM_notification': {
      const hasProgress = typeof data.progress === 'number';
      const notifOpts: NotificationOptions = {
        type: hasProgress ? 'progress' : 'basic',
        iconUrl: data.image || 'images/icon128.png',
        title: clampString(data.title || 'ScriptVault', SV_NOTIF_TITLE_MAX),
        message: clampString(data.text || '', SV_NOTIF_MESSAGE_MAX),
        silent: data.silent || false,
      };
      if (typeof data.requireInteraction === 'boolean' && data.requireInteraction) {
        notifOpts.requireInteraction = true;
      }
      if (hasProgress) {
        notifOpts.progress = Math.max(0, Math.min(100, Math.floor(data.progress as number)));
      }
      const buttons = normalizeButtons(data.buttons);
      if (buttons) notifOpts.buttons = buttons;

      const notifId = data.tag
        ? await createNotification()(data.tag, notifOpts)
        : await createNotification()(notifOpts);
      const tabId = sender.tab?.id;
      if (tabId && (data.hasOnclick || data.hasOndone || data.hasOnbuttonclick)) {
        const runtime = notificationRuntime();
        if (!runtime._notifCallbacks) runtime._notifCallbacks = new Map();
        if (runtime._notifCallbacks.size > 500) {
          const oldest = runtime._notifCallbacks.keys().next().value;
          if (oldest !== undefined) runtime._notifCallbacks.delete(oldest);
        }
        runtime._notifCallbacks.set(notifId, {
          tabId,
          scriptId: data.scriptId,
          hasOnclick: data.hasOnclick,
          hasOndone: data.hasOndone,
          hasOnbuttonclick: data.hasOnbuttonclick,
        });
        persistNotifCallbacks();
      }

      if (data.timeout && data.timeout > 0) {
        if (data.timeout >= 30000) {
          const alarmName = `notif_clear_${notifId}`;
          chrome.alarms.create(alarmName, { delayInMinutes: data.timeout / 60000 });
        } else {
          setTimeout(() => {
            clearNotification()(notifId).catch(() => {});
            removeNotifCallback(notifId);
          }, data.timeout);
        }
      }
      return { success: true, id: notifId };
    }

    case 'GM_updateNotification': {
      if (!data.id) return { success: false, error: 'Missing notification id' };
      const updateOpts: NotificationOptions = {};
      if (typeof data.title === 'string') updateOpts.title = data.title;
      if (typeof data.text === 'string') updateOpts.message = data.text;
      if (typeof data.image === 'string') updateOpts.iconUrl = data.image;
      if (typeof data.progress === 'number') {
        updateOpts.type = 'progress';
        updateOpts.progress = Math.max(0, Math.min(100, Math.floor(data.progress)));
      }
      const buttons = normalizeButtons(data.buttons);
      if (buttons) updateOpts.buttons = buttons;
      if (typeof data.silent === 'boolean') updateOpts.silent = data.silent;
      if (typeof data.requireInteraction === 'boolean') updateOpts.requireInteraction = data.requireInteraction;
      try {
        const wasUpdated = await updateNotification()(data.id, updateOpts);
        return { success: !!wasUpdated };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Update failed' };
      }
    }

    case 'GM_closeNotification': {
      if (!data.id) return { success: false, error: 'Missing notification id' };
      try {
        await clearNotification()(data.id);
        removeNotifCallback(data.id);
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Close failed' };
      }
    }

    default:
      return { error: `Unsupported GM notification action: ${action}` };
  }
}

export const GMNotificationHandler = Object.freeze({
  GM_NOTIFICATION_ACTIONS,
  handleGMNotificationMessage,
  isGMNotificationAction,
});

export default GMNotificationHandler;
