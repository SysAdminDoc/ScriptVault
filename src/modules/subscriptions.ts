// Script subscription feed parsing and storage.
// Runs in the MV3 service worker after being generated to modules/subscriptions.js.

import { generateId } from '../shared/utils';

export interface SubscriptionFeedItem {
  url: string;
  name?: string;
  namespace?: string;
  version?: string;
}

export interface ParsedSubscriptionFeed {
  name: string;
  sourceUrl: string;
  scripts: SubscriptionFeedItem[];
  parsedAt: number;
}

export interface ScriptSubscription {
  id: string;
  url: string;
  name: string;
  enabled: boolean;
  scripts: SubscriptionFeedItem[];
  createdAt: number;
  updatedAt: number;
  lastCheckedAt: number | null;
  lastQueued: number;
  lastSkipped: number;
  lastErrors: string[];
}

interface UpsertOptions {
  name?: string;
  enabled?: boolean;
}

interface RefreshResult {
  queued?: number;
  skipped?: number;
  errors?: string[];
}

const STORAGE_KEY = 'scriptSubscriptions';
const MAX_SUBSCRIPTIONS = 50;
const MAX_FEED_ITEMS = 200;
const MAX_ERRORS = 10;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asCleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeHttpUrl(value: unknown, baseUrl?: string): string {
  const raw = asCleanString(value);
  if (!raw) throw new Error('Subscription URL is required');
  let resolved: URL;
  try {
    resolved = baseUrl ? new URL(raw, baseUrl) : new URL(raw);
  } catch (_) {
    throw new Error(`Invalid subscription URL: ${raw}`);
  }
  if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
    throw new Error('Subscription URLs must use http or https');
  }
  resolved.hash = '';
  return resolved.href;
}

function getFeedItemUrl(item: Record<string, unknown>): string {
  return asCleanString(item.url)
    || asCleanString(item.downloadURL)
    || asCleanString(item.downloadUrl)
    || asCleanString(item.codeURL)
    || asCleanString(item.codeUrl)
    || asCleanString(item.sourceURL)
    || asCleanString(item.sourceUrl)
    || asCleanString(item.href);
}

function normalizeFeedItem(item: unknown, feedUrl: string): SubscriptionFeedItem | null {
  if (typeof item === 'string') {
    return { url: normalizeHttpUrl(item, feedUrl) };
  }
  const record = asRecord(item);
  if (!record) return null;
  const rawUrl = getFeedItemUrl(record);
  if (!rawUrl) return null;
  const normalized: SubscriptionFeedItem = {
    url: normalizeHttpUrl(rawUrl, feedUrl),
  };
  const name = asCleanString(record.name);
  const namespace = asCleanString(record.namespace);
  const version = asCleanString(record.version);
  if (name) normalized.name = name;
  if (namespace) normalized.namespace = namespace;
  if (version) normalized.version = version;
  return normalized;
}

function getFeedItems(root: unknown): unknown[] {
  if (Array.isArray(root)) return root;
  const record = asRecord(root);
  if (!record) throw new Error('Subscription feed must be a JSON array or object');
  for (const key of ['scripts', 'items', 'subscriptions']) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }
  throw new Error('Subscription feed must include a scripts, items, or subscriptions array');
}

function fallbackNameFromUrl(url: string): string {
  try {
    return new URL(url).hostname || 'Script subscription';
  } catch (_) {
    return 'Script subscription';
  }
}

function normalizeSubscription(value: unknown): ScriptSubscription | null {
  const record = asRecord(value);
  if (!record) return null;
  try {
    const url = normalizeHttpUrl(record.url);
    const now = Date.now();
    return {
      id: asCleanString(record.id) || generateId(),
      url,
      name: asCleanString(record.name) || fallbackNameFromUrl(url),
      enabled: record.enabled !== false,
      scripts: Array.isArray(record.scripts)
        ? record.scripts.map((item) => normalizeFeedItem(item, url)).filter((item): item is SubscriptionFeedItem => !!item).slice(0, MAX_FEED_ITEMS)
        : [],
      createdAt: typeof record.createdAt === 'number' ? record.createdAt : now,
      updatedAt: typeof record.updatedAt === 'number' ? record.updatedAt : now,
      lastCheckedAt: typeof record.lastCheckedAt === 'number' ? record.lastCheckedAt : null,
      lastQueued: typeof record.lastQueued === 'number' ? record.lastQueued : 0,
      lastSkipped: typeof record.lastSkipped === 'number' ? record.lastSkipped : 0,
      lastErrors: Array.isArray(record.lastErrors)
        ? record.lastErrors.filter((item): item is string => typeof item === 'string').slice(0, MAX_ERRORS)
        : [],
    };
  } catch (_) {
    return null;
  }
}

async function readAll(): Promise<ScriptSubscription[]> {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const raw = data[STORAGE_KEY];
  return Array.isArray(raw)
    ? raw.map(normalizeSubscription).filter((item): item is ScriptSubscription => !!item).slice(0, MAX_SUBSCRIPTIONS)
    : [];
}

async function writeAll(subscriptions: ScriptSubscription[]): Promise<ScriptSubscription[]> {
  const normalized = subscriptions
    .map(normalizeSubscription)
    .filter((item): item is ScriptSubscription => !!item)
    .slice(0, MAX_SUBSCRIPTIONS);
  await chrome.storage.local.set({ [STORAGE_KEY]: normalized });
  return normalized.map((item) => ({ ...item, scripts: item.scripts.map((script) => ({ ...script })) }));
}

function cloneSubscription(subscription: ScriptSubscription): ScriptSubscription {
  return {
    ...subscription,
    scripts: subscription.scripts.map((script) => ({ ...script })),
    lastErrors: [...subscription.lastErrors],
  };
}

function parseFeed(text: string, feedUrl: string): ParsedSubscriptionFeed {
  const sourceUrl = normalizeHttpUrl(feedUrl);
  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch (_) {
    throw new Error('Subscription feed is not valid JSON');
  }

  const record = asRecord(root);
  const name = asCleanString(record?.name)
    || asCleanString(record?.title)
    || fallbackNameFromUrl(sourceUrl);
  const seen = new Set<string>();
  const scripts: SubscriptionFeedItem[] = [];
  for (const rawItem of getFeedItems(root)) {
    if (scripts.length >= MAX_FEED_ITEMS) break;
    const item = normalizeFeedItem(rawItem, sourceUrl);
    if (!item || seen.has(item.url)) continue;
    seen.add(item.url);
    scripts.push(item);
  }

  if (scripts.length === 0) {
    throw new Error('Subscription feed did not contain any script URLs');
  }

  return {
    name,
    sourceUrl,
    scripts,
    parsedAt: Date.now(),
  };
}

async function list(): Promise<ScriptSubscription[]> {
  return (await readAll())
    .sort((a, b) => a.createdAt - b.createdAt)
    .map(cloneSubscription);
}

async function get(id: string): Promise<ScriptSubscription | null> {
  const subscriptions = await readAll();
  const subscription = subscriptions.find((item) => item.id === id || item.url === id);
  return subscription ? cloneSubscription(subscription) : null;
}

async function upsertFromFeed(url: string, feed: ParsedSubscriptionFeed, options: UpsertOptions = {}): Promise<ScriptSubscription> {
  const normalizedUrl = normalizeHttpUrl(url);
  const subscriptions = await readAll();
  const existingIndex = subscriptions.findIndex((item) => item.url === normalizedUrl);
  const existing = existingIndex >= 0 ? subscriptions[existingIndex] : null;
  const now = Date.now();
  const subscription: ScriptSubscription = {
    id: existing?.id || generateId(),
    url: normalizedUrl,
    name: asCleanString(options.name) || feed.name || existing?.name || fallbackNameFromUrl(normalizedUrl),
    enabled: typeof options.enabled === 'boolean' ? options.enabled : existing?.enabled !== false,
    scripts: feed.scripts.map((script) => ({ ...script })),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    lastCheckedAt: now,
    lastQueued: existing?.lastQueued || 0,
    lastSkipped: existing?.lastSkipped || 0,
    lastErrors: existing?.lastErrors ? [...existing.lastErrors] : [],
  };
  const next = existingIndex >= 0
    ? subscriptions.map((item, index) => index === existingIndex ? subscription : item)
    : [subscription, ...subscriptions];
  await writeAll(next);
  return cloneSubscription(subscription);
}

async function remove(id: string): Promise<boolean> {
  const subscriptions = await readAll();
  const next = subscriptions.filter((item) => item.id !== id && item.url !== id);
  if (next.length === subscriptions.length) return false;
  await writeAll(next);
  return true;
}

async function markRefreshResult(id: string, result: RefreshResult = {}): Promise<ScriptSubscription | null> {
  const subscriptions = await readAll();
  const index = subscriptions.findIndex((item) => item.id === id || item.url === id);
  if (index < 0) return null;
  const now = Date.now();
  const current = subscriptions[index];
  if (!current) return null;
  const updated: ScriptSubscription = {
    ...current,
    updatedAt: now,
    lastCheckedAt: now,
    lastQueued: Math.max(0, result.queued || 0),
    lastSkipped: Math.max(0, result.skipped || 0),
    lastErrors: Array.isArray(result.errors) ? result.errors.slice(0, MAX_ERRORS) : [],
  };
  subscriptions[index] = updated;
  await writeAll(subscriptions);
  return cloneSubscription(updated);
}

export const ScriptSubscriptions = {
  STORAGE_KEY,
  MAX_SUBSCRIPTIONS,
  MAX_FEED_ITEMS,
  normalizeFeedUrl: normalizeHttpUrl,
  parseFeed,
  list,
  get,
  upsertFromFeed,
  remove,
  markRefreshResult,
};

export default ScriptSubscriptions;
