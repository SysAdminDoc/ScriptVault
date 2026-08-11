// ============================================================================
// Local folder/project manifest reconciliation
// ----------------------------------------------------------------------------
// This module deliberately contains no File System Access or IndexedDB code.
// The dashboard supplies bounded file observations and persists the resulting
// manifest. Keeping the policy pure makes path safety, stable identity,
// conflict detection, and privacy redaction independently testable.
// ============================================================================

export const LOCAL_WORKSPACE_PROJECT_SCHEMA = 'scriptvault-local-project/v1';
export const LOCAL_WORKSPACE_PROJECT_VERSION = 1;
export const MAX_LOCAL_WORKSPACE_PROJECT_FILES = 128;
export const MAX_LOCAL_WORKSPACE_PROJECT_PATH_LENGTH = 240;
export const MAX_LOCAL_WORKSPACE_PROJECT_QUEUE = 256;

const SHA256_HEX = /^[a-f0-9]{64}$/;
const PROJECT_ID = /^local-project-[a-z0-9_-]{8,128}$/;
const SCRIPT_ID = /^[a-z0-9_-]{3,160}$/i;
const PROJECT_ACTION_ID = /^project-action-[a-z0-9_-]{8,160}$/;
const SUPPORTED_PROJECT_FILE = /\.(?:user\.js|user\.css)$/i;

export type LocalWorkspaceProjectActionKind =
  | 'added'
  | 'changed'
  | 'renamed'
  | 'deleted'
  | 'conflict'
  | 'orphaned';

export type LocalWorkspaceProjectEntryStatus =
  | 'pending'
  | 'synced'
  | 'missing'
  | 'conflict'
  | 'orphaned';

export interface LocalWorkspaceProjectManifestEntry {
  relativePath: string;
  scriptId: string;
  status: LocalWorkspaceProjectEntryStatus;
  lastAppliedSha256: string;
  lastAppliedVersion: string;
  lastObservedSha256: string;
  lastObservedVersion: string;
  lastObservedAt: number | null;
}

export interface LocalWorkspaceProjectReviewAction {
  actionId: string;
  kind: LocalWorkspaceProjectActionKind;
  scriptId: string;
  relativePath: string;
  previousPath: string;
  sha256: string;
  previousSha256: string;
  scriptSha256: string;
  version: string;
  previousVersion: string;
  scriptVersion: string;
  createdAt: number;
}

export interface LocalWorkspaceProjectManifest {
  schema: typeof LOCAL_WORKSPACE_PROJECT_SCHEMA;
  version: number;
  projectId: string;
  displayName: string;
  entries: LocalWorkspaceProjectManifestEntry[];
  queue: LocalWorkspaceProjectReviewAction[];
  lastScanAt: number | null;
}

export interface LocalWorkspaceProjectFileObservation {
  relativePath: string;
  sha256: string;
  version?: string;
  bytes?: number;
  modified?: number | null;
  /** Runtime-only identity supplied after FileSystemHandle.isSameEntry(). */
  matchedEntryScriptId?: string;
}

export interface LocalWorkspaceProjectScriptObservation {
  id: string;
  sha256: string;
  version?: string;
}

export interface LocalWorkspaceProjectReconcileResult {
  manifest: LocalWorkspaceProjectManifest;
  actions: LocalWorkspaceProjectReviewAction[];
  issues: string[];
}

function clampText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max) : '';
}

function normalizeHash(value: unknown): string {
  const hash = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return SHA256_HEX.test(hash) ? hash : '';
}

function normalizeVersion(value: unknown): string {
  return clampText(value, 96);
}

function normalizeScriptId(value: unknown): string {
  const id = typeof value === 'string' ? value.trim() : '';
  return SCRIPT_ID.test(id) ? id.slice(0, 160) : '';
}

function fnv1a(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function normalizeLocalWorkspaceProjectPath(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.replace(/\\/g, '/').trim();
  if (!raw || raw.length > MAX_LOCAL_WORKSPACE_PROJECT_PATH_LENGTH) return null;
  if (raw.startsWith('/') || /^[a-z]:\//i.test(raw) || raw.includes('\u0000')) return null;
  const segments = raw.split('/');
  if (segments.some(segment => !segment || segment === '.' || segment === '..')) return null;
  if (segments.some(segment => /[\u0000-\u001f\u007f]/.test(segment))) return null;
  return segments.join('/');
}

export function isSupportedLocalWorkspaceProjectPath(value: unknown): boolean {
  const path = normalizeLocalWorkspaceProjectPath(value);
  return !!path && SUPPORTED_PROJECT_FILE.test(path);
}

export function createLocalWorkspaceProjectId(displayName: unknown, now = Date.now(), salt = ''): string {
  const name = clampText(displayName, 80) || 'project';
  const suffix = `${Math.max(0, Number(now) || 0).toString(36)}-${fnv1a(`${name}:${salt}`)}`;
  return `local-project-${suffix}`.slice(0, 128);
}

export function createLocalWorkspaceProjectScriptId(projectId: unknown, relativePath: unknown): string {
  const project = typeof projectId === 'string' ? projectId : 'local-project';
  const path = normalizeLocalWorkspaceProjectPath(relativePath) || 'script.user.js';
  return `sv-project-${fnv1a(`${project}:${path}`)}`;
}

function createProjectActionId(
  kind: LocalWorkspaceProjectActionKind,
  scriptId: string,
  relativePath: string,
  previousPath: string,
  sha256: string,
): string {
  return `project-action-${fnv1a(`${kind}:${scriptId}:${relativePath}:${previousPath}:${sha256}`)}`;
}

function normalizeEntry(
  value: unknown,
  projectId: string,
  fallbackPath: string,
): LocalWorkspaceProjectManifestEntry | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  const relativePath = candidate.relativePath == null
    ? normalizeLocalWorkspaceProjectPath(fallbackPath)
    : normalizeLocalWorkspaceProjectPath(candidate.relativePath);
  if (!relativePath || !isSupportedLocalWorkspaceProjectPath(relativePath)) return null;
  const scriptId = normalizeScriptId(candidate.scriptId) || createLocalWorkspaceProjectScriptId(projectId, relativePath);
  const status = ['pending', 'synced', 'missing', 'conflict', 'orphaned'].includes(String(candidate.status))
    ? String(candidate.status) as LocalWorkspaceProjectEntryStatus
    : 'pending';
  const observedAt = Number(candidate.lastObservedAt);
  return {
    relativePath,
    scriptId,
    status,
    lastAppliedSha256: normalizeHash(candidate.lastAppliedSha256),
    lastAppliedVersion: normalizeVersion(candidate.lastAppliedVersion),
    lastObservedSha256: normalizeHash(candidate.lastObservedSha256),
    lastObservedVersion: normalizeVersion(candidate.lastObservedVersion),
    lastObservedAt: Number.isFinite(observedAt) && observedAt > 0 ? observedAt : null,
  };
}

function normalizeAction(value: unknown): LocalWorkspaceProjectReviewAction | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  const actionId = typeof candidate.actionId === 'string' && PROJECT_ACTION_ID.test(candidate.actionId)
    ? candidate.actionId
    : '';
  const kind = ['added', 'changed', 'renamed', 'deleted', 'conflict', 'orphaned'].includes(String(candidate.kind))
    ? String(candidate.kind) as LocalWorkspaceProjectActionKind
    : null;
  const scriptId = normalizeScriptId(candidate.scriptId);
  const relativePath = normalizeLocalWorkspaceProjectPath(candidate.relativePath);
  if (!actionId || !kind || !scriptId || !relativePath || !isSupportedLocalWorkspaceProjectPath(relativePath)) return null;
  const createdAt = Number(candidate.createdAt);
  return {
    actionId,
    kind,
    scriptId,
    relativePath,
    previousPath: normalizeLocalWorkspaceProjectPath(candidate.previousPath) || '',
    sha256: normalizeHash(candidate.sha256),
    previousSha256: normalizeHash(candidate.previousSha256),
    scriptSha256: normalizeHash(candidate.scriptSha256),
    version: normalizeVersion(candidate.version),
    previousVersion: normalizeVersion(candidate.previousVersion),
    scriptVersion: normalizeVersion(candidate.scriptVersion),
    createdAt: Number.isFinite(createdAt) && createdAt > 0 ? createdAt : 0,
  };
}

export function normalizeLocalWorkspaceProjectManifest(
  input: unknown,
  defaults: { projectId?: string; displayName?: string } = {},
): LocalWorkspaceProjectManifest {
  const candidate = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const projectIdCandidate = typeof candidate.projectId === 'string' ? candidate.projectId.trim() : '';
  const projectId = PROJECT_ID.test(projectIdCandidate)
    ? projectIdCandidate
    : PROJECT_ID.test(defaults.projectId || '')
      ? defaults.projectId as string
      : createLocalWorkspaceProjectId(defaults.displayName || candidate.displayName || 'project');
  const displayName = clampText(candidate.displayName || defaults.displayName, 160) || 'Local project';
  const rawEntries = Array.isArray(candidate.entries) ? candidate.entries : [];
  const entries: LocalWorkspaceProjectManifestEntry[] = [];
  const seenPaths = new Set<string>();
  const seenScriptIds = new Set<string>();
  for (const value of rawEntries.slice(0, MAX_LOCAL_WORKSPACE_PROJECT_FILES)) {
    const entry = normalizeEntry(value, projectId, 'script.user.js');
    if (!entry || seenPaths.has(entry.relativePath) || seenScriptIds.has(entry.scriptId)) continue;
    seenPaths.add(entry.relativePath);
    seenScriptIds.add(entry.scriptId);
    entries.push(entry);
  }
  const queue: LocalWorkspaceProjectReviewAction[] = [];
  const seenActions = new Set<string>();
  const rawQueue = Array.isArray(candidate.queue) ? candidate.queue : [];
  for (const value of rawQueue.slice(0, MAX_LOCAL_WORKSPACE_PROJECT_QUEUE)) {
    const action = normalizeAction(value);
    if (!action || seenActions.has(action.actionId)) continue;
    seenActions.add(action.actionId);
    queue.push(action);
  }
  const lastScanAt = Number(candidate.lastScanAt);
  return {
    schema: LOCAL_WORKSPACE_PROJECT_SCHEMA,
    version: LOCAL_WORKSPACE_PROJECT_VERSION,
    projectId,
    displayName,
    entries,
    queue,
    lastScanAt: Number.isFinite(lastScanAt) && lastScanAt > 0 ? lastScanAt : null,
  };
}

function makeAction(
  kind: LocalWorkspaceProjectActionKind,
  entry: LocalWorkspaceProjectManifestEntry,
  file: LocalWorkspaceProjectFileObservation | null,
  previousPath: string,
  previousSha256: string,
  previousVersion: string,
  script: LocalWorkspaceProjectScriptObservation | undefined,
  now: number,
): LocalWorkspaceProjectReviewAction {
  const relativePath = file?.relativePath || entry.relativePath;
  const sha256 = file?.sha256 || '';
  return {
    actionId: createProjectActionId(kind, entry.scriptId, relativePath, previousPath, sha256),
    kind,
    scriptId: entry.scriptId,
    relativePath,
    previousPath,
    sha256,
    previousSha256,
    scriptSha256: normalizeHash(script?.sha256),
    version: normalizeVersion(file?.version),
    previousVersion,
    scriptVersion: normalizeVersion(script?.version),
    createdAt: now,
  };
}

export function reconcileLocalWorkspaceProject(
  input: unknown,
  filesInput: LocalWorkspaceProjectFileObservation[],
  scriptsInput: LocalWorkspaceProjectScriptObservation[] = [],
  now = Date.now(),
): LocalWorkspaceProjectReconcileResult {
  const initial = normalizeLocalWorkspaceProjectManifest(input);
  const issues: string[] = [];
  const files: LocalWorkspaceProjectFileObservation[] = [];
  const seenPaths = new Set<string>();
  for (const candidate of Array.isArray(filesInput) ? filesInput : []) {
    const relativePath = normalizeLocalWorkspaceProjectPath(candidate?.relativePath);
    if (!relativePath || !isSupportedLocalWorkspaceProjectPath(relativePath)) {
      issues.push('unsupported-path');
      continue;
    }
    if (seenPaths.has(relativePath)) {
      issues.push(`duplicate-path:${relativePath}`);
      continue;
    }
    seenPaths.add(relativePath);
    files.push({
      relativePath,
      sha256: normalizeHash(candidate.sha256),
      version: normalizeVersion(candidate.version),
      bytes: Number.isFinite(Number(candidate.bytes)) ? Math.max(0, Number(candidate.bytes)) : 0,
      modified: Number.isFinite(Number(candidate.modified)) ? Number(candidate.modified) : null,
      matchedEntryScriptId: normalizeScriptId(candidate.matchedEntryScriptId),
    });
    if (!normalizeHash(candidate.sha256)) issues.push(`missing-hash:${relativePath}`);
  }
  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  if (files.length > MAX_LOCAL_WORKSPACE_PROJECT_FILES) {
    files.splice(MAX_LOCAL_WORKSPACE_PROJECT_FILES);
    issues.push('file-limit');
  }

  const scripts = new Map<string, LocalWorkspaceProjectScriptObservation>();
  for (const candidate of Array.isArray(scriptsInput) ? scriptsInput : []) {
    const id = normalizeScriptId(candidate?.id);
    if (id && !scripts.has(id)) {
      scripts.set(id, {
        id,
        sha256: normalizeHash(candidate.sha256),
        version: normalizeVersion(candidate.version),
      });
    }
  }

  const entriesByPath = new Map(initial.entries.map(entry => [entry.relativePath, entry]));
  const entriesByScriptId = new Map(initial.entries.map(entry => [entry.scriptId, entry]));
  const claimed = new Set<string>();
  const nextEntries: LocalWorkspaceProjectManifestEntry[] = [];
  const actions: LocalWorkspaceProjectReviewAction[] = [];

  for (const file of files) {
    const pathEntry = entriesByPath.get(file.relativePath);
    const matchedEntry = pathEntry && !claimed.has(pathEntry.scriptId)
      ? pathEntry
      : file.matchedEntryScriptId && !claimed.has(file.matchedEntryScriptId)
        ? entriesByScriptId.get(file.matchedEntryScriptId) || null
        : null;
    const entry = matchedEntry || {
      relativePath: file.relativePath,
      scriptId: createLocalWorkspaceProjectScriptId(initial.projectId, file.relativePath),
      status: 'pending' as const,
      lastAppliedSha256: '',
      lastAppliedVersion: '',
      lastObservedSha256: '',
      lastObservedVersion: '',
      lastObservedAt: null,
    };
    if (claimed.has(entry.scriptId)) {
      issues.push(`duplicate-script-id:${entry.scriptId}`);
      continue;
    }
    claimed.add(entry.scriptId);
    const previousPath = entry.relativePath !== file.relativePath ? entry.relativePath : '';
    const previousSha256 = entry.lastAppliedSha256;
    const previousVersion = entry.lastAppliedVersion;
    const script = scripts.get(entry.scriptId);
    const fileChanged = !!previousSha256 && !!file.sha256 && previousSha256 !== file.sha256;
    const scriptChanged = !!previousSha256 && !!script?.sha256 && previousSha256 !== script.sha256;
    let kind: LocalWorkspaceProjectActionKind | null = null;
    if (fileChanged && scriptChanged) kind = 'conflict';
    else if (fileChanged) kind = 'changed';
    else if (previousPath) kind = 'renamed';
    else if (!previousSha256) kind = 'added';
    else if (!script) kind = 'orphaned';

    const nextEntry: LocalWorkspaceProjectManifestEntry = {
      ...entry,
      relativePath: file.relativePath,
      status: kind === 'conflict' ? 'conflict' : kind ? 'pending' : 'synced',
      lastObservedSha256: file.sha256,
      lastObservedVersion: normalizeVersion(file.version),
      lastObservedAt: now,
    };
    nextEntries.push(nextEntry);
    if (kind) {
      actions.push(makeAction(kind, nextEntry, file, previousPath, previousSha256, previousVersion, script, now));
    }
  }

  for (const entry of initial.entries) {
    if (claimed.has(entry.scriptId)) continue;
    nextEntries.push({ ...entry, status: 'missing', lastObservedAt: now });
    actions.push(makeAction('deleted', entry, null, '', entry.lastAppliedSha256, entry.lastAppliedVersion, scripts.get(entry.scriptId), now));
  }

  nextEntries.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  actions.sort((a, b) => a.relativePath.localeCompare(b.relativePath) || a.kind.localeCompare(b.kind));
  const boundedActions = actions.slice(0, MAX_LOCAL_WORKSPACE_PROJECT_QUEUE);
  const manifest: LocalWorkspaceProjectManifest = {
    ...initial,
    entries: nextEntries.slice(0, MAX_LOCAL_WORKSPACE_PROJECT_FILES),
    queue: boundedActions,
    lastScanAt: now,
  };
  return { manifest, actions: boundedActions, issues };
}

export function resolveLocalWorkspaceProjectAction(
  input: unknown,
  actionId: unknown,
  resolution: 'apply' | 'keep-script' | 'unmap',
  scriptSha256 = '',
  scriptVersion = '',
): LocalWorkspaceProjectManifest {
  const manifest = normalizeLocalWorkspaceProjectManifest(input);
  const action = manifest.queue.find(item => item.actionId === actionId);
  if (!action) return manifest;
  const entry = manifest.entries.find(item => item.scriptId === action.scriptId);
  const remainingQueue = manifest.queue.filter(item => item.actionId !== action.actionId);
  if (!entry) return { ...manifest, queue: remainingQueue };
  if (resolution === 'unmap' || action.kind === 'deleted' && resolution === 'apply') {
    return {
      ...manifest,
      entries: manifest.entries.filter(item => item.scriptId !== action.scriptId),
      queue: remainingQueue,
    };
  }
  const acceptedSha256 = resolution === 'keep-script'
    ? normalizeHash(scriptSha256) || action.scriptSha256 || normalizeHash(action.sha256)
    : normalizeHash(action.sha256);
  const acceptedVersion = resolution === 'keep-script'
    ? normalizeVersion(scriptVersion) || action.scriptVersion || action.version
    : action.version;
  return {
    ...manifest,
    entries: manifest.entries.map(item => item.scriptId === action.scriptId
      ? {
        ...item,
        relativePath: action.relativePath,
        status: 'synced',
        lastAppliedSha256: acceptedSha256,
        lastAppliedVersion: acceptedVersion,
        lastObservedSha256: normalizeHash(action.sha256),
        lastObservedVersion: action.version,
      }
      : item),
    queue: remainingQueue,
  };
}

export function toPortableLocalWorkspaceProjectManifest(input: unknown): Record<string, unknown> {
  const manifest = normalizeLocalWorkspaceProjectManifest(input);
  return {
    schema: LOCAL_WORKSPACE_PROJECT_SCHEMA,
    version: LOCAL_WORKSPACE_PROJECT_VERSION,
    projectId: manifest.projectId,
    displayName: manifest.displayName,
    lastScanAt: manifest.lastScanAt,
    entries: manifest.entries.map(entry => ({
      relativePath: entry.relativePath,
      scriptId: entry.scriptId,
      status: entry.status,
      lastAppliedSha256: entry.lastAppliedSha256,
      lastAppliedVersion: entry.lastAppliedVersion,
      lastObservedSha256: entry.lastObservedSha256,
      lastObservedVersion: entry.lastObservedVersion,
      lastObservedAt: entry.lastObservedAt,
    })),
    queue: manifest.queue.map(action => ({
      actionId: action.actionId,
      kind: action.kind,
      scriptId: action.scriptId,
      relativePath: action.relativePath,
      previousPath: action.previousPath,
      sha256: action.sha256,
      previousSha256: action.previousSha256,
      scriptSha256: action.scriptSha256,
      version: action.version,
      previousVersion: action.previousVersion,
      scriptVersion: action.scriptVersion,
      createdAt: action.createdAt,
    })),
    privacy: {
      includesHandles: false,
      includesAbsolutePaths: false,
      includesFileContents: false,
    },
  };
}

export const LocalWorkspaceProject = Object.freeze({
  LOCAL_WORKSPACE_PROJECT_SCHEMA,
  LOCAL_WORKSPACE_PROJECT_VERSION,
  MAX_LOCAL_WORKSPACE_PROJECT_FILES,
  MAX_LOCAL_WORKSPACE_PROJECT_PATH_LENGTH,
  MAX_LOCAL_WORKSPACE_PROJECT_QUEUE,
  createLocalWorkspaceProjectId,
  createLocalWorkspaceProjectScriptId,
  isSupportedLocalWorkspaceProjectPath,
  normalizeLocalWorkspaceProjectManifest,
  normalizeLocalWorkspaceProjectPath,
  reconcileLocalWorkspaceProject,
  resolveLocalWorkspaceProjectAction,
  toPortableLocalWorkspaceProjectManifest,
});

export default LocalWorkspaceProject;
