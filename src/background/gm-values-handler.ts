import type { BackgroundMessage } from '../types/messages';

export type GMValuesAction = Extract<
  BackgroundMessage['action'],
  | 'deleteScriptValue'
  | 'getScriptStorage'
  | 'getScriptValues'
  | 'getStorageSize'
  | 'GM_deleteValue'
  | 'GM_deleteValues'
  | 'GM_getValue'
  | 'GM_getValues'
  | 'GM_listValues'
  | 'GM_setValue'
  | 'GM_setValues'
  | 'setScriptStorage'
>;

export const GM_VALUES_ACTIONS = [
  'deleteScriptValue',
  'getScriptStorage',
  'getScriptValues',
  'getStorageSize',
  'GM_deleteValue',
  'GM_deleteValues',
  'GM_getValue',
  'GM_getValues',
  'GM_listValues',
  'GM_setValue',
  'GM_setValues',
  'setScriptStorage',
] as const satisfies readonly GMValuesAction[];

type AssertNever<T extends never> = T;
type MissingGMValuesActions = Exclude<GMValuesAction, typeof GM_VALUES_ACTIONS[number]>;
type ExtraGMValuesActions = Exclude<typeof GM_VALUES_ACTIONS[number], GMValuesAction>;
type _MissingGMValuesActionCheck = AssertNever<MissingGMValuesActions>;
type _ExtraGMValuesActionCheck = AssertNever<ExtraGMValuesActions>;

interface RuntimeMessageSender {
  tab?: {
    id?: number;
  };
}

interface GMValuesPayload {
  defaultValue?: unknown;
  key?: string;
  keys?: string[];
  scriptId?: string;
  value?: unknown;
  values?: Record<string, unknown>;
}

interface ScriptValuesRuntime {
  delete(scriptId: string | undefined, key: string | undefined, tabId?: number | null): Promise<void>;
  deleteMultiple(scriptId: string | undefined, keys: string[] | undefined, tabId?: number | null): Promise<void>;
  get(scriptId: string | undefined, key: string | undefined, defaultValue?: unknown): Promise<unknown>;
  getAll(scriptId: string | undefined): Promise<Record<string, unknown>>;
  getStorageSize(scriptId: string | undefined): Promise<unknown>;
  list(scriptId: string | undefined): Promise<unknown>;
  set(scriptId: string | undefined, key: string | undefined, value: unknown, tabId?: number | null): Promise<unknown>;
  setAll(scriptId: string | undefined, values: Record<string, unknown> | undefined, tabId?: number | null): Promise<void>;
}

declare const ScriptValues: ScriptValuesRuntime;

const GM_VALUES_ACTION_SET: ReadonlySet<string> = new Set(GM_VALUES_ACTIONS);

function senderTabId(sender: RuntimeMessageSender): number | null {
  return sender.tab?.id ?? null;
}

export function isGMValuesAction(action: unknown): action is GMValuesAction {
  return typeof action === 'string' && GM_VALUES_ACTION_SET.has(action);
}

export async function handleGMValuesMessage(
  action: GMValuesAction,
  data: GMValuesPayload = {},
  sender: RuntimeMessageSender = {},
): Promise<unknown> {
  switch (action) {
    case 'GM_getValue':
      return await ScriptValues.get(data.scriptId, data.key, data.defaultValue);

    case 'GM_setValue':
      return await ScriptValues.set(data.scriptId, data.key, data.value, senderTabId(sender));

    case 'GM_deleteValue':
      await ScriptValues.delete(data.scriptId, data.key, senderTabId(sender));
      return { success: true };

    case 'deleteScriptValue':
      await ScriptValues.delete(data.scriptId, data.key);
      return { success: true };

    case 'GM_listValues':
      return await ScriptValues.list(data.scriptId);

    case 'GM_getValues':
      return await ScriptValues.getAll(data.scriptId);

    case 'GM_setValues':
      await ScriptValues.setAll(data.scriptId, data.values, senderTabId(sender));
      return { success: true };

    case 'GM_deleteValues':
      await ScriptValues.deleteMultiple(data.scriptId, data.keys, senderTabId(sender));
      return { success: true };

    case 'getScriptStorage':
    case 'getScriptValues': {
      const values = await ScriptValues.getAll(data.scriptId);
      return { values };
    }

    case 'setScriptStorage':
      await ScriptValues.setAll(data.scriptId, data.values);
      return { success: true };

    case 'getStorageSize':
      return await ScriptValues.getStorageSize(data.scriptId);

    default:
      return { error: `Unsupported GM values action: ${action}` };
  }
}

export const GMValuesHandler = Object.freeze({
  GM_VALUES_ACTIONS,
  handleGMValuesMessage,
  isGMValuesAction,
});

export default GMValuesHandler;
