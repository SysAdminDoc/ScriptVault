/**
 * Global extension settings managed by SettingsManager.
 */

export interface Settings {
  // General
  enabled: boolean;
  showBadge: boolean;
  badgeColor: string;
  theme: string;

  // Notifications
  notifyOnInstall: boolean;
  notifyOnUpdate: boolean;
  notifyOnError: boolean;

  // Editor
  editorTheme: string;
  editorFontSize: number;
  editorTabSize: number;
  editorLineWrapping: boolean;
  editorAutoComplete: boolean;
  editorMatchBrackets: boolean;
  editorAutoCloseBrackets: boolean;
  editorHighlightActiveLine: boolean;
  editorShowInvisibles: boolean;
  editorKeyMap: string;

  // Updates
  autoUpdate: boolean;
  updateInterval: number;
  lastUpdateCheck: number;

  // Sync
  syncEnabled: boolean;
  syncProvider: SyncProvider;
  syncInterval: number;
  lastSync: number;

  // WebDAV
  webdavUrl: string;
  webdavUsername: string;
  webdavPassword: string;

  // Google Drive
  googleDriveConnected: boolean;
  googleDriveToken: string;
  googleDriveRefreshToken: string;
  googleClientId: string;
  googleDriveUser: { email: string; name: string } | null;

  // Dropbox
  dropboxToken: string;
  dropboxRefreshToken: string;
  dropboxUser: { email: string; name: string } | null;
  dropboxClientId: string;

  // OneDrive
  onedriveToken: string;
  onedriveRefreshToken: string;
  onedriveClientId: string;
  onedriveConnected: boolean;
  onedriveUser: { email: string; name: string } | null;

  // Language
  language: string;

  // Advanced
  debugMode: boolean;
  injectIntoFrames: boolean;
  xhrTimeout: number;

  // Blacklist
  blacklist: string[];

  // Badge
  badgeInfo: 'running' | 'total' | 'none';

  // Auto-reload
  autoReload: boolean;

  // Page filtering
  pageFilterMode: 'blacklist' | 'whitelist';
  blacklistedPages: string;
  whitelistedPages: string;
  deniedHosts: string[];

  // Signing trust store
  trustedSigningKeys: Record<string, { name: string; addedAt: number }>;

  // Layout (used by popup/sidepanel for theme)
  layout?: string;
  trashMode?: string;
}

export type SyncProvider =
  | 'none'
  | 'webdav'
  | 'google'
  | 'googledrive'
  | 'dropbox'
  | 'onedrive'
  | 'easycloud';
