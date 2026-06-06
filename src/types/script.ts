/**
 * Core script data types for ScriptVault.
 */

import type { ScriptConfigVariable } from '../modules/script-config';

/** Parsed userscript `@antifeature` metadata entry. */
export interface ScriptAntifeature {
  type: string;
  description: string;
  locale: string;
}

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
  module: string;
  esm?: boolean;
  esmBundle?: {
    entryUrl: string;
    imports: Array<{ url: string; bytes: number }>;
    bundledAt: number;
  };
  noframes: boolean;
  unwrap: boolean;
  sandbox: string;
  'run-in': string;

  // Grants & dependencies
  grant: string[];
  require: string[];
  requireProvenance: string[];
  requireIdentity: string[];
  resource: Record<string, string>;
  connect: string[];

  // Features
  'top-level-await': boolean;
  webRequest: WebRequestRule[] | null;
  /** Userscript `@var` author configuration fields. */
  config: ScriptConfigVariable[];
  priority: number;
  /** Userscripts (Safari) `@weight 1..999` injection priority — higher = earlier. */
  weight: number;
  /** Default-off ScriptCat-compatible DOM-less background script marker. */
  background: boolean;

  // Tags & compat
  antifeature: ScriptAntifeature[];
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

export interface WebRequestHeaderCondition {
  header: string;
  values?: string[];
  excludedValues?: string[];
}

export interface WebRequestRuleSelector {
  url?: string | Array<string | { include?: string; exclude?: string }>;
  include?: string | string[];
  exclude?: string | string[];
  tab?: number | number[];
  type?: string | string[];
  responseHeaders?: WebRequestHeaderCondition[];
  excludedResponseHeaders?: WebRequestHeaderCondition[];
}

export interface WebRequestRuleAction {
  cancel?: boolean;
  redirect?: string | { url?: string; regexSubstitution?: string };
  setRequestHeaders?: Record<string, string | null>;
  setResponseHeaders?: Record<string, string | null>;
}

export interface WebRequestRule {
  priority?: number;
  selector?: string | WebRequestRuleSelector;
  action: string | WebRequestRuleAction;
}

/** Per-script user settings */
export interface ScriptSettings {
  // Local-only sync/editing state. Cloud sync helpers must not upload these.
  userModified?: boolean;
  mergeConflict?: boolean;
  _failedRequires?: string[];
  _failedRequireErrors?: Array<{ url: string; message: string }>;
  _registrationError?: string;
  _importQuarantine?: {
    source: string;
    sourceLabel: string;
    importedAt: number;
    archiveEnabled: boolean;
  };
  managed?: boolean;
  managedOriginKey?: string;
  managedAppliedAt?: number;
  /** Opt-in marker for future cross-device GM storage value sync. */
  syncValues?: boolean;
  // User-facing preferences such as runAt, URL overrides, notes, tags, and
  // pinned state are synced only when explicitly allowlisted by the sync helper.
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

export interface ScriptTrustReceiptDependency {
  url: string;
  sha256?: string;
  bytes?: number;
  error?: string;
  provenance?: {
    bundleUrl: string;
    identity: string;
    status: 'declared' | 'missing-bundle' | 'missing-identity';
    verification: 'not-yet-implemented' | 'signature-verified' | 'signature-failed' | 'root-verification-failed' | 'bundle-unavailable' | 'unsupported-bundle';
    error?: string;
    certificateIdentity?: string;
    certificateIssuer?: string;
    certificateNotBefore?: string;
    certificateNotAfter?: string;
    digestVerified?: boolean;
    signatureVerified?: boolean;
    rootVerified?: 'not-checked' | 'verified' | 'failed';
  };
}

export interface ScriptTrustReceiptDependencyChange {
  url: string;
  change: 'added' | 'removed' | 'changed' | 'unchanged' | 'unverified';
  previousSha256?: string;
  nextSha256?: string;
  previousBytes?: number;
  nextBytes?: number;
  previousError?: string;
  nextError?: string;
}

export interface ScriptTrustReceiptPermissionChangeSet {
  added: string[];
  removed: string[];
  unchanged: string[];
}

export type ScriptTrustReceiptSourceKind =
  | 'remote'
  | 'local-editor'
  | 'local-file'
  | 'local-import';

export interface ScriptTrustReceipt {
  schemaVersion: 1;
  operation: 'install' | 'update' | 'manual-update' | 'auto-update' | 'pending-update' | 'subscription-install' | 'reinstall' | 'downgrade' | 'local-save' | 'rollback-point';
  createdAt: number;
  source: {
    installUrl: string;
    installHost: string;
    updateUrl: string;
    downloadUrl: string;
    homepageUrl: string;
    sourceKind?: ScriptTrustReceiptSourceKind;
    sourceLabel?: string;
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
    require: ScriptTrustReceiptDependency[];
    resource: Array<{ name: string; url: string }>;
    requireCount: number;
    resourceCount: number;
  };
  dependencyChanges?: {
    require: ScriptTrustReceiptDependencyChange[];
  };
  permissionChanges?: {
    grant: ScriptTrustReceiptPermissionChangeSet;
    connect: ScriptTrustReceiptPermissionChangeSet;
    match: ScriptTrustReceiptPermissionChangeSet;
  };
  /**
   * Outcome of optional-permission prompts surfaced by the install page
   * for grants that map to a Chrome optional permission (cookies,
   * clipboardWrite, etc.). `null` for receipts whose install path did not
   * surface a prompt (sync, internal saves, legacy receipts).
   */
  optionalPermissions?: {
    requested: string[];
    granted: string[];
    denied: string[];
    unavailable: string[];
  } | null;
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
