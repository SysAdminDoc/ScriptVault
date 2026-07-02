import type { BackgroundMessage } from '../types/messages';

export type GMMenuAction = Extract<
  BackgroundMessage['action'],
  | 'executeMenuCommand'
  | 'getMenuCommands'
  | 'GM_registerMenuCommand'
  | 'GM_unregisterMenuCommand'
  | 'registerMenuCommand'
  | 'unregisterMenuCommand'
>;

export const GM_MENU_ACTIONS = [
  'executeMenuCommand',
  'getMenuCommands',
  'GM_registerMenuCommand',
  'GM_unregisterMenuCommand',
  'registerMenuCommand',
  'unregisterMenuCommand',
] as const satisfies readonly GMMenuAction[];

type AssertNever<T extends never> = T;
type MissingGMMenuActions = Exclude<GMMenuAction, typeof GM_MENU_ACTIONS[number]>;
type ExtraGMMenuActions = Exclude<typeof GM_MENU_ACTIONS[number], GMMenuAction>;
type _MissingGMMenuActionCheck = AssertNever<MissingGMMenuActions>;
type _ExtraGMMenuActionCheck = AssertNever<ExtraGMMenuActions>;

interface RuntimeMessageSender {
  tab?: {
    id?: number;
  };
  userScriptId?: string;
}

interface GMMenuPayload {
  scriptId?: string;
  commandId?: string;
  caption?: string;
  accessKey?: string;
  autoClose?: boolean;
  title?: string;
}

interface MenuCommandEntry {
  id: string | undefined;
  caption: string | undefined;
  accessKey: string;
  autoClose: boolean;
  title: string;
}

interface StoredScript {
  id: string;
  meta?: {
    name?: string;
  };
}

interface ScriptStorageRuntime {
  getAll(): Promise<StoredScript[]>;
}

declare const ScriptStorage: ScriptStorageRuntime;

const GM_MENU_ACTION_SET: ReadonlySet<string> = new Set(GM_MENU_ACTIONS);

export function isGMMenuAction(action: unknown): action is GMMenuAction {
  return typeof action === 'string' && GM_MENU_ACTION_SET.has(action);
}

export async function handleGMMenuMessage(
  action: GMMenuAction,
  data: GMMenuPayload = {},
  sender: RuntimeMessageSender = {},
): Promise<Record<string, unknown>> {
  // Bind to the authenticated caller when the message came directly from a user
  // script, so a script can't register/unregister menu commands under another
  // script's id. Falls back to data.scriptId for the dashboard/content-bridge path.
  const ownedScriptId = sender.userScriptId || (data.scriptId as string);
  switch (action) {
    case 'registerMenuCommand':
    case 'GM_registerMenuCommand': {
      const scriptId = ownedScriptId;
      const commands = await chrome.storage.session.get('menuCommands') || {};
      if (!commands.menuCommands) commands.menuCommands = {};
      if (!commands.menuCommands[scriptId]) commands.menuCommands[scriptId] = [];

      const existing = commands.menuCommands[scriptId].findIndex(
        (command: MenuCommandEntry) => command.id === data.commandId,
      );
      const cmdEntry: MenuCommandEntry = {
        id: data.commandId,
        caption: data.caption,
        accessKey: data.accessKey || '',
        autoClose: data.autoClose !== false,
        title: data.title || '',
      };
      if (existing >= 0) {
        commands.menuCommands[scriptId][existing] = cmdEntry;
      } else {
        commands.menuCommands[scriptId].push(cmdEntry);
      }

      await chrome.storage.session.set(commands);
      return { success: true };
    }

    case 'unregisterMenuCommand':
    case 'GM_unregisterMenuCommand': {
      const scriptId = ownedScriptId;
      const commands = await chrome.storage.session.get('menuCommands') || {};
      if (commands.menuCommands?.[scriptId]) {
        commands.menuCommands[scriptId] = commands.menuCommands[scriptId].filter(
          (command: MenuCommandEntry) => command.id !== data.commandId,
        );
        if (commands.menuCommands[scriptId].length === 0) {
          delete commands.menuCommands[scriptId];
        }
        await chrome.storage.session.set(commands);
      }
      return { success: true };
    }

    case 'getMenuCommands': {
      const result = await chrome.storage.session.get('menuCommands');
      const allCommands = result?.menuCommands || {};
      const commands: Array<Record<string, unknown>> = [];

      const scripts = await ScriptStorage.getAll();
      for (const [scriptId, menuCommands] of Object.entries(allCommands)) {
        const script = scripts.find((candidate) => candidate.id === scriptId);
        if (script && menuCommands) {
          (menuCommands as MenuCommandEntry[]).forEach((command) => {
            commands.push({
              ...command,
              scriptId,
              scriptName: script.meta?.name || 'Unknown Script',
            });
          });
        }
      }

      return { commands };
    }

    case 'executeMenuCommand': {
      if (sender.tab?.id) {
        await chrome.tabs.sendMessage(sender.tab.id, {
          action: 'executeMenuCommand',
          data: { scriptId: data.scriptId, commandId: data.commandId },
        });
      }
      return { success: true };
    }

    default:
      return { error: `Unsupported menu command action: ${action}` };
  }
}

export const GMMenuHandler = Object.freeze({
  GM_MENU_ACTIONS,
  handleGMMenuMessage,
  isGMMenuAction,
});

export default GMMenuHandler;
