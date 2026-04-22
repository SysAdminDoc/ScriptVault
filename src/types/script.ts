/**
 * Core script data types for ScriptVault.
 */

/** Parsed userscript metadata from ==UserScript== block */
export interface ScriptMeta {
  name: string;
  namespace: string;
  version: string;
  description: string;
  author: string;
  icon: string;
  icon64: string;
  homepage: string;
  homepageURL: string;
  website: string;
  source: string;
  updateURL: string;
  downloadURL: string;
  supportURL: string;
  license: string;
  copyright: string;
  contributionURL: string;

  // Matching & injection
  match: string[];
  include: string[];
  exclude: string[];
  excludeMatch: string[];
  'run-at': RunAt;
  'inject-into': string;
  noframes: boolean;
  unwrap: boolean;
  sandbox: string;
  'run-in': string;

  // Grants & dependencies
  grant: string[];
  require: string[];
  resource: Record<string, string>;
  connect: string[];

  // Features
  'top-level-await': boolean;
  webRequest: WebRequestRule[] | null;
  priority: number;

  // Tags & compat
  antifeature: string[];
  tag: string[];
  compatible: string[];
  incompatible: string[];

  crontab?: string;

  // Localization (@name:ja, @description:fr, etc.)
  localized?: Record<string, Record<string, string>>;
}

export type RunAt =
  | 'document-start'
  | 'document-body'
  | 'document-end'
  | 'document-idle'
  | 'context-menu';

export interface WebRequestRule {
  selector: { include?: string[]; exclude?: string[] };
  action: string | { cancel?: boolean; redirect?: string };
}

/** Per-script user settings */
export interface ScriptSettings {
  userModified?: boolean;
  mergeConflict?: boolean;
  _failedRequires?: string[];
  _registrationError?: string;
  [key: string]: unknown;
}

/** Script execution statistics */
export interface ScriptStats {
  runs: number;
  totalTime: number;
  avgTime: number;
  lastRun: number;
  lastUrl?: string;
  errors: number;
  lastError?: string;
  lastErrorTime?: number;
}

/** A previous version stored for rollback */
export interface VersionHistoryEntry {
  version: string;
  code: string;
  updatedAt: number;
}

/** The full script object stored in ScriptStorage */
export interface Script {
  id: string;
  code: string;
  enabled: boolean;
  position: number;
  meta: ScriptMeta;
  settings?: ScriptSettings;
  stats?: ScriptStats;
  versionHistory?: VersionHistoryEntry[];

  createdAt: number;
  updatedAt: number;

  // HTTP caching for update checks
  _httpEtag?: string;
  _httpLastModified?: string;

  // Trash
  trashedAt?: number;

  // Sync
  syncBaseCode?: string;
}
