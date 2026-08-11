// ============================================================================
// Generated from src/modules/local-workspace-project.ts; do not edit by hand.
// Run `node scripts/generate-ts-runtime-modules.mjs` or `npm run build:bg`.
// ============================================================================

const LocalWorkspaceProject = (() => {
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

  // src/modules/local-workspace-project.ts
  var local_workspace_project_exports = {};
  __export(local_workspace_project_exports, {
    LOCAL_WORKSPACE_PROJECT_SCHEMA: () => LOCAL_WORKSPACE_PROJECT_SCHEMA,
    LOCAL_WORKSPACE_PROJECT_VERSION: () => LOCAL_WORKSPACE_PROJECT_VERSION,
    LocalWorkspaceProject: () => LocalWorkspaceProject,
    MAX_LOCAL_WORKSPACE_PROJECT_FILES: () => MAX_LOCAL_WORKSPACE_PROJECT_FILES,
    MAX_LOCAL_WORKSPACE_PROJECT_PATH_LENGTH: () => MAX_LOCAL_WORKSPACE_PROJECT_PATH_LENGTH,
    MAX_LOCAL_WORKSPACE_PROJECT_QUEUE: () => MAX_LOCAL_WORKSPACE_PROJECT_QUEUE,
    createLocalWorkspaceProjectId: () => createLocalWorkspaceProjectId,
    createLocalWorkspaceProjectScriptId: () => createLocalWorkspaceProjectScriptId,
    default: () => local_workspace_project_default,
    isSupportedLocalWorkspaceProjectPath: () => isSupportedLocalWorkspaceProjectPath,
    normalizeLocalWorkspaceProjectManifest: () => normalizeLocalWorkspaceProjectManifest,
    normalizeLocalWorkspaceProjectPath: () => normalizeLocalWorkspaceProjectPath,
    reconcileLocalWorkspaceProject: () => reconcileLocalWorkspaceProject,
    resolveLocalWorkspaceProjectAction: () => resolveLocalWorkspaceProjectAction,
    toPortableLocalWorkspaceProjectManifest: () => toPortableLocalWorkspaceProjectManifest
  });
  module.exports = __toCommonJS(local_workspace_project_exports);
  var LOCAL_WORKSPACE_PROJECT_SCHEMA = "scriptvault-local-project/v1";
  var LOCAL_WORKSPACE_PROJECT_VERSION = 1;
  var MAX_LOCAL_WORKSPACE_PROJECT_FILES = 128;
  var MAX_LOCAL_WORKSPACE_PROJECT_PATH_LENGTH = 240;
  var MAX_LOCAL_WORKSPACE_PROJECT_QUEUE = 256;
  var SHA256_HEX = /^[a-f0-9]{64}$/;
  var PROJECT_ID = /^local-project-[a-z0-9_-]{8,128}$/;
  var SCRIPT_ID = /^[a-z0-9_-]{3,160}$/i;
  var PROJECT_ACTION_ID = /^project-action-[a-z0-9_-]{8,160}$/;
  var SUPPORTED_PROJECT_FILE = /\.(?:user\.js|user\.css)$/i;
  function clampText(value, max) {
    return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max) : "";
  }
  function normalizeHash(value) {
    const hash = typeof value === "string" ? value.trim().toLowerCase() : "";
    return SHA256_HEX.test(hash) ? hash : "";
  }
  function normalizeVersion(value) {
    return clampText(value, 96);
  }
  function normalizeScriptId(value) {
    const id = typeof value === "string" ? value.trim() : "";
    return SCRIPT_ID.test(id) ? id.slice(0, 160) : "";
  }
  function fnv1a(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }
  function normalizeLocalWorkspaceProjectPath(value) {
    if (typeof value !== "string") return null;
    const raw = value.replace(/\\/g, "/").trim();
    if (!raw || raw.length > MAX_LOCAL_WORKSPACE_PROJECT_PATH_LENGTH) return null;
    if (raw.startsWith("/") || /^[a-z]:\//i.test(raw) || raw.includes("\0")) return null;
    const segments = raw.split("/");
    if (segments.some((segment) => !segment || segment === "." || segment === "..")) return null;
    if (segments.some((segment) => /[\u0000-\u001f\u007f]/.test(segment))) return null;
    return segments.join("/");
  }
  function isSupportedLocalWorkspaceProjectPath(value) {
    const path = normalizeLocalWorkspaceProjectPath(value);
    return !!path && SUPPORTED_PROJECT_FILE.test(path);
  }
  function createLocalWorkspaceProjectId(displayName, now = Date.now(), salt = "") {
    const name = clampText(displayName, 80) || "project";
    const suffix = `${Math.max(0, Number(now) || 0).toString(36)}-${fnv1a(`${name}:${salt}`)}`;
    return `local-project-${suffix}`.slice(0, 128);
  }
  function createLocalWorkspaceProjectScriptId(projectId, relativePath) {
    const project = typeof projectId === "string" ? projectId : "local-project";
    const path = normalizeLocalWorkspaceProjectPath(relativePath) || "script.user.js";
    return `sv-project-${fnv1a(`${project}:${path}`)}`;
  }
  function createProjectActionId(kind, scriptId, relativePath, previousPath, sha256) {
    return `project-action-${fnv1a(`${kind}:${scriptId}:${relativePath}:${previousPath}:${sha256}`)}`;
  }
  function normalizeEntry(value, projectId, fallbackPath) {
    if (!value || typeof value !== "object") return null;
    const candidate = value;
    const relativePath = candidate.relativePath == null ? normalizeLocalWorkspaceProjectPath(fallbackPath) : normalizeLocalWorkspaceProjectPath(candidate.relativePath);
    if (!relativePath || !isSupportedLocalWorkspaceProjectPath(relativePath)) return null;
    const scriptId = normalizeScriptId(candidate.scriptId) || createLocalWorkspaceProjectScriptId(projectId, relativePath);
    const status = ["pending", "synced", "missing", "conflict", "orphaned"].includes(String(candidate.status)) ? String(candidate.status) : "pending";
    const observedAt = Number(candidate.lastObservedAt);
    return {
      relativePath,
      scriptId,
      status,
      lastAppliedSha256: normalizeHash(candidate.lastAppliedSha256),
      lastAppliedVersion: normalizeVersion(candidate.lastAppliedVersion),
      lastObservedSha256: normalizeHash(candidate.lastObservedSha256),
      lastObservedVersion: normalizeVersion(candidate.lastObservedVersion),
      lastObservedAt: Number.isFinite(observedAt) && observedAt > 0 ? observedAt : null
    };
  }
  function normalizeAction(value) {
    if (!value || typeof value !== "object") return null;
    const candidate = value;
    const actionId = typeof candidate.actionId === "string" && PROJECT_ACTION_ID.test(candidate.actionId) ? candidate.actionId : "";
    const kind = ["added", "changed", "renamed", "deleted", "conflict", "orphaned"].includes(String(candidate.kind)) ? String(candidate.kind) : null;
    const scriptId = normalizeScriptId(candidate.scriptId);
    const relativePath = normalizeLocalWorkspaceProjectPath(candidate.relativePath);
    if (!actionId || !kind || !scriptId || !relativePath || !isSupportedLocalWorkspaceProjectPath(relativePath)) return null;
    const createdAt = Number(candidate.createdAt);
    return {
      actionId,
      kind,
      scriptId,
      relativePath,
      previousPath: normalizeLocalWorkspaceProjectPath(candidate.previousPath) || "",
      sha256: normalizeHash(candidate.sha256),
      previousSha256: normalizeHash(candidate.previousSha256),
      scriptSha256: normalizeHash(candidate.scriptSha256),
      version: normalizeVersion(candidate.version),
      previousVersion: normalizeVersion(candidate.previousVersion),
      scriptVersion: normalizeVersion(candidate.scriptVersion),
      createdAt: Number.isFinite(createdAt) && createdAt > 0 ? createdAt : 0
    };
  }
  function normalizeLocalWorkspaceProjectManifest(input, defaults = {}) {
    const candidate = input && typeof input === "object" ? input : {};
    const projectIdCandidate = typeof candidate.projectId === "string" ? candidate.projectId.trim() : "";
    const projectId = PROJECT_ID.test(projectIdCandidate) ? projectIdCandidate : PROJECT_ID.test(defaults.projectId || "") ? defaults.projectId : createLocalWorkspaceProjectId(defaults.displayName || candidate.displayName || "project");
    const displayName = clampText(candidate.displayName || defaults.displayName, 160) || "Local project";
    const rawEntries = Array.isArray(candidate.entries) ? candidate.entries : [];
    const entries = [];
    const seenPaths = /* @__PURE__ */ new Set();
    const seenScriptIds = /* @__PURE__ */ new Set();
    for (const value of rawEntries.slice(0, MAX_LOCAL_WORKSPACE_PROJECT_FILES)) {
      const entry = normalizeEntry(value, projectId, "script.user.js");
      if (!entry || seenPaths.has(entry.relativePath) || seenScriptIds.has(entry.scriptId)) continue;
      seenPaths.add(entry.relativePath);
      seenScriptIds.add(entry.scriptId);
      entries.push(entry);
    }
    const queue = [];
    const seenActions = /* @__PURE__ */ new Set();
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
      lastScanAt: Number.isFinite(lastScanAt) && lastScanAt > 0 ? lastScanAt : null
    };
  }
  function makeAction(kind, entry, file, previousPath, previousSha256, previousVersion, script, now) {
    const relativePath = file?.relativePath || entry.relativePath;
    const sha256 = file?.sha256 || "";
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
      createdAt: now
    };
  }
  function reconcileLocalWorkspaceProject(input, filesInput, scriptsInput = [], now = Date.now()) {
    const initial = normalizeLocalWorkspaceProjectManifest(input);
    const issues = [];
    const files = [];
    const seenPaths = /* @__PURE__ */ new Set();
    for (const candidate of Array.isArray(filesInput) ? filesInput : []) {
      const relativePath = normalizeLocalWorkspaceProjectPath(candidate?.relativePath);
      if (!relativePath || !isSupportedLocalWorkspaceProjectPath(relativePath)) {
        issues.push("unsupported-path");
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
        matchedEntryScriptId: normalizeScriptId(candidate.matchedEntryScriptId)
      });
      if (!normalizeHash(candidate.sha256)) issues.push(`missing-hash:${relativePath}`);
    }
    files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    if (files.length > MAX_LOCAL_WORKSPACE_PROJECT_FILES) {
      files.splice(MAX_LOCAL_WORKSPACE_PROJECT_FILES);
      issues.push("file-limit");
    }
    const scripts = /* @__PURE__ */ new Map();
    for (const candidate of Array.isArray(scriptsInput) ? scriptsInput : []) {
      const id = normalizeScriptId(candidate?.id);
      if (id && !scripts.has(id)) {
        scripts.set(id, {
          id,
          sha256: normalizeHash(candidate.sha256),
          version: normalizeVersion(candidate.version)
        });
      }
    }
    const entriesByPath = new Map(initial.entries.map((entry) => [entry.relativePath, entry]));
    const entriesByScriptId = new Map(initial.entries.map((entry) => [entry.scriptId, entry]));
    const claimed = /* @__PURE__ */ new Set();
    const nextEntries = [];
    const actions = [];
    for (const file of files) {
      const pathEntry = entriesByPath.get(file.relativePath);
      const matchedEntry = pathEntry && !claimed.has(pathEntry.scriptId) ? pathEntry : file.matchedEntryScriptId && !claimed.has(file.matchedEntryScriptId) ? entriesByScriptId.get(file.matchedEntryScriptId) || null : null;
      const entry = matchedEntry || {
        relativePath: file.relativePath,
        scriptId: createLocalWorkspaceProjectScriptId(initial.projectId, file.relativePath),
        status: "pending",
        lastAppliedSha256: "",
        lastAppliedVersion: "",
        lastObservedSha256: "",
        lastObservedVersion: "",
        lastObservedAt: null
      };
      if (claimed.has(entry.scriptId)) {
        issues.push(`duplicate-script-id:${entry.scriptId}`);
        continue;
      }
      claimed.add(entry.scriptId);
      const previousPath = entry.relativePath !== file.relativePath ? entry.relativePath : "";
      const previousSha256 = entry.lastAppliedSha256;
      const previousVersion = entry.lastAppliedVersion;
      const script = scripts.get(entry.scriptId);
      const fileChanged = !!previousSha256 && !!file.sha256 && previousSha256 !== file.sha256;
      const scriptChanged = !!previousSha256 && !!script?.sha256 && previousSha256 !== script.sha256;
      let kind = null;
      if (fileChanged && scriptChanged) kind = "conflict";
      else if (fileChanged) kind = "changed";
      else if (previousPath) kind = "renamed";
      else if (!previousSha256) kind = "added";
      else if (!script) kind = "orphaned";
      const nextEntry = {
        ...entry,
        relativePath: file.relativePath,
        status: kind === "conflict" ? "conflict" : kind ? "pending" : "synced",
        lastObservedSha256: file.sha256,
        lastObservedVersion: normalizeVersion(file.version),
        lastObservedAt: now
      };
      nextEntries.push(nextEntry);
      if (kind) {
        actions.push(makeAction(kind, nextEntry, file, previousPath, previousSha256, previousVersion, script, now));
      }
    }
    for (const entry of initial.entries) {
      if (claimed.has(entry.scriptId)) continue;
      nextEntries.push({ ...entry, status: "missing", lastObservedAt: now });
      actions.push(makeAction("deleted", entry, null, "", entry.lastAppliedSha256, entry.lastAppliedVersion, scripts.get(entry.scriptId), now));
    }
    nextEntries.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    actions.sort((a, b) => a.relativePath.localeCompare(b.relativePath) || a.kind.localeCompare(b.kind));
    const boundedActions = actions.slice(0, MAX_LOCAL_WORKSPACE_PROJECT_QUEUE);
    const manifest = {
      ...initial,
      entries: nextEntries.slice(0, MAX_LOCAL_WORKSPACE_PROJECT_FILES),
      queue: boundedActions,
      lastScanAt: now
    };
    return { manifest, actions: boundedActions, issues };
  }
  function resolveLocalWorkspaceProjectAction(input, actionId, resolution, scriptSha256 = "", scriptVersion = "") {
    const manifest = normalizeLocalWorkspaceProjectManifest(input);
    const action = manifest.queue.find((item) => item.actionId === actionId);
    if (!action) return manifest;
    const entry = manifest.entries.find((item) => item.scriptId === action.scriptId);
    const remainingQueue = manifest.queue.filter((item) => item.actionId !== action.actionId);
    if (!entry) return { ...manifest, queue: remainingQueue };
    if (resolution === "unmap" || action.kind === "deleted" && resolution === "apply") {
      return {
        ...manifest,
        entries: manifest.entries.filter((item) => item.scriptId !== action.scriptId),
        queue: remainingQueue
      };
    }
    const acceptedSha256 = resolution === "keep-script" ? normalizeHash(scriptSha256) || action.scriptSha256 || normalizeHash(action.sha256) : normalizeHash(action.sha256);
    const acceptedVersion = resolution === "keep-script" ? normalizeVersion(scriptVersion) || action.scriptVersion || action.version : action.version;
    return {
      ...manifest,
      entries: manifest.entries.map((item) => item.scriptId === action.scriptId ? {
        ...item,
        relativePath: action.relativePath,
        status: "synced",
        lastAppliedSha256: acceptedSha256,
        lastAppliedVersion: acceptedVersion,
        lastObservedSha256: normalizeHash(action.sha256),
        lastObservedVersion: action.version
      } : item),
      queue: remainingQueue
    };
  }
  function toPortableLocalWorkspaceProjectManifest(input) {
    const manifest = normalizeLocalWorkspaceProjectManifest(input);
    return {
      schema: LOCAL_WORKSPACE_PROJECT_SCHEMA,
      version: LOCAL_WORKSPACE_PROJECT_VERSION,
      projectId: manifest.projectId,
      displayName: manifest.displayName,
      lastScanAt: manifest.lastScanAt,
      entries: manifest.entries.map((entry) => ({
        relativePath: entry.relativePath,
        scriptId: entry.scriptId,
        status: entry.status,
        lastAppliedSha256: entry.lastAppliedSha256,
        lastAppliedVersion: entry.lastAppliedVersion,
        lastObservedSha256: entry.lastObservedSha256,
        lastObservedVersion: entry.lastObservedVersion,
        lastObservedAt: entry.lastObservedAt
      })),
      queue: manifest.queue.map((action) => ({
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
        createdAt: action.createdAt
      })),
      privacy: {
        includesHandles: false,
        includesAbsolutePaths: false,
        includesFileContents: false
      }
    };
  }
  var LocalWorkspaceProject = Object.freeze({
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
    toPortableLocalWorkspaceProjectManifest
  });
  var local_workspace_project_default = LocalWorkspaceProject;
  return module.exports.default || module.exports.LocalWorkspaceProject || module.exports;
})();

if (typeof self !== 'undefined') {
  self.LocalWorkspaceProject = LocalWorkspaceProject;
}
