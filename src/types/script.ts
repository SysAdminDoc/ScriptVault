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
  /**
   * Phase 39.11 — TM #2784 top-level-origin gates. Match patterns tested
   * against `window.top.location.href` instead of `window.location.href`.
   * `matchTop`: script runs only when the top frame's URL matches at least
   * one pattern (cross-origin top → bail conservatively).
   * `excludeTop`: script bails when the top frame's URL matches any
   * pattern (cross-origin top → bail conservatively).
   */
  matchTop: string[];
  excludeTop: string[];
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
  /** Userscripts (Safari) `@weight 1..999` injection priority — higher = earlier. */
  weight: number;

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
  trustReceipt?: ScriptTrustReceipt;
}

export interface ScriptTrustReceipt {
  schemaVersion: 1;
  operation: 'install' | 'update' | 'manual-update' | 'auto-update' | 'reinstall' | 'downgrade' | 'local-save' | 'rollback-point';
  createdAt: number;
  source: {
    installUrl: string;
    installHost: string;
    updateUrl: string;
    downloadUrl: string;
    homepageUrl: string;
  };
  hashes: {
    sha256: string;
    previousSha256?: string;
  };
  grants: string[];
  hostScope: {
    match: string[];
    include: string[];
    exclude: string[];
    excludeMatch: string[];
    connect: string[];
  };
  dependencies: {
    require: Array<{ url: string }>;
    resource: Array<{ name: string; url: string }>;
    requireCount: number;
    resourceCount: number;
  };
  diff: {
    previousVersion: string;
    nextVersion: string;
    previousHash: string;
    nextHash: string;
    previousLines: number;
    nextLines: number;
    addedLines: number;
    removedLines: number;
  };
  rollback: {
    available: boolean;
    action: 'rollbackScript';
    scriptId: string;
    version: string;
    updatedAt: number | null;
    historyIndex: number | null;
  };
  lineCount: number;
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
  trustReceipt?: ScriptTrustReceipt;

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
