import { createLegacyServices } from './legacyServices';
import { lifePlanRepository } from './lifePlanRepository';
import type { DataEntity, LifePlanData, Todo } from '../types/lifePlan';

type MainSyncConfig = { webdavUrl?: string; useAppSyncKitProvider?: boolean; [key: string]: unknown };
type TodoSyncConfig = { remotePath: string; autoSync: boolean; remoteUploadEnabled: false; autoSyncUserEnabled?: boolean };
type TodoSyncState = Record<string, unknown> & {
  dirty?: boolean;
  lastLocalHash?: string;
  lastRemoteHash?: string;
  lastRemoteEtag?: string;
  lastPullAt?: string;
  lastPushAt?: string;
  lastSyncAt?: string;
  lastConflictAt?: string;
};
type RemotePayload = { data: unknown; hash: string; etag?: string };
type TodoSnapshot = { schemaVersion?: number; generatedAt?: string; todos: Todo[]; deletedItems: DataEntity[] };
type LocalModel = { snapshot: TodoSnapshot; hash: string; sourceHash: string };
type StatusHandler = (message: string, isError?: boolean) => void;

const services = createLegacyServices();
const sync = services.sync;
const todos = services.todos;
const MAIN_CONFIG_KEY = 'lifePlanSyncConfig';
const MAIN_STATE_KEY = 'lifePlanSyncState';
const CONFIG_KEY = 'todoAppSyncConfig';
const STATE_KEY = 'todoAppSyncState';
const REMOTE_PATH = '/apps/todo-app/data.json';

let autoSyncTimer: ReturnType<typeof setTimeout> | null = null;
let periodicTimer: ReturnType<typeof setInterval> | null = null;
let isSyncing = false;
let pendingSync = false;
let started = false;
let visibilityBound = false;
let dataProvider: (() => LifePlanData) | null = null;
let dataReplacer: ((next: LifePlanData, reason: string) => void) | null = null;
let statusHandler: StatusHandler | null = null;

function nowIso() {
  return new Date().toISOString();
}

function readJson<T extends Record<string, unknown>>(key: string): T {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '{}');
    return value && typeof value === 'object' ? value as T : {} as T;
  } catch {
    return {} as T;
  }
}

function readMainConfig(): MainSyncConfig {
  return readJson<MainSyncConfig>(MAIN_CONFIG_KEY);
}

function readConfig(): TodoSyncConfig {
  const raw = readJson<Partial<TodoSyncConfig>>(CONFIG_KEY);
  const confirmed = raw.autoSyncUserEnabled === true;
  const next = {
    remotePath: REMOTE_PATH,
    autoSync: confirmed && raw.autoSync === true,
    remoteUploadEnabled: false as const,
    autoSyncUserEnabled: confirmed && raw.autoSync === true,
  };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
  return next;
}

function writeConfig(config: Partial<TodoSyncConfig> = {}) {
  const enabled = config.autoSync === true;
  const next: TodoSyncConfig = {
    remotePath: REMOTE_PATH,
    autoSync: enabled,
    remoteUploadEnabled: false,
    autoSyncUserEnabled: enabled,
  };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
  return next;
}

function readState(): TodoSyncState {
  return readJson<TodoSyncState>(STATE_KEY);
}

function writeState(next: TodoSyncState) {
  localStorage.setItem(STATE_KEY, JSON.stringify(next));
}

function markMainSyncDirty(data: LifePlanData) {
  const state = readJson<Record<string, unknown>>(MAIN_STATE_KEY);
  localStorage.setItem(MAIN_STATE_KEY, JSON.stringify({
    ...state,
    dirty: true,
    lastLocalHash: sync.getDataHash(data),
    lastLocalUpdateAt: nowIso(),
  }));
}

function emitStatus(message: string, isError = false) {
  statusHandler?.(message, isError);
}

function requireBindings() {
  if (!dataProvider || !dataReplacer) throw new Error('todo cloud sync is not bound to the Vue repository yet');
}

function todoHash(value: unknown) {
  return sync.getDataHash(todos.getTodoAppHashPayload(value));
}

function canonical(value: unknown): TodoSnapshot {
  return todos.getTodoAppCanonicalSnapshot(value) as TodoSnapshot;
}

function assertRemoteSchema(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('云端 todo schema 不是对象。');
  const source = value as Record<string, unknown>;
  if (!Array.isArray(source.todos)) throw new Error('云端缺少有效的 todos 数组。');
}

function prepareLocal(data: LifePlanData, reason: string): LocalModel {
  const mirror = lifePlanRepository.rebuildTodoMirror(data, reason);
  const sourceHash = lifePlanRepository.getTodoSourceHash(data);
  const consistency = todos.buildTodoDualWriteConsistency(data, mirror, sourceHash) as { status?: string; mismatches?: string[] };
  if (consistency.status !== 'matched' || consistency.mismatches?.length) {
    throw new Error(`本地 Todo 镜像不一致：${consistency.mismatches?.join('；') || consistency.status || 'unknown'}`);
  }
  if (data.todos.some(item => !String(item.id || '').trim())) throw new Error('本地存在缺少稳定 ID 的待办。');
  if (data.deletedItems.some(item => item.collection === 'todos' && (!String(item.id || '').trim() || !String(item.deletedAt || '').trim()))) {
    throw new Error('本地存在无法规范化的 Todo 删除标记。');
  }
  const snapshot = canonical(mirror);
  return { snapshot, hash: todoHash(snapshot), sourceHash };
}

async function fetchRemote(mainConfig: MainSyncConfig) {
  return await sync.pullJson(
    { ...mainConfig, remotePath: REMOTE_PATH },
    REMOTE_PATH,
    (value: unknown) => value,
    (value: unknown) => todoHash(value),
  ) as RemotePayload | null;
}

async function pushWithEtag(mainConfig: MainSyncConfig, snapshot: TodoSnapshot, ifMatch = '') {
  return await sync.pushJson(
    { ...mainConfig, remotePath: REMOTE_PATH },
    REMOTE_PATH,
    snapshot,
    'todo-app',
    { ifMatch },
  ) as { etag?: string };
}

async function verifyUpload(mainConfig: MainSyncConfig, localHash: string) {
  const verification = await fetchRemote(mainConfig);
  if (!verification || verification.hash !== localHash) throw new Error('上传后回读的 Todo hash 不一致。');
  return verification;
}

function applySnapshot(sourceData: LifePlanData, snapshot: TodoSnapshot): LifePlanData {
  const next = JSON.parse(JSON.stringify(sourceData)) as LifePlanData;
  next.todos = snapshot.todos.map(item => ({ ...item }));
  next.deletedItems = [
    ...next.deletedItems.filter(item => item.collection !== 'todos'),
    ...snapshot.deletedItems.map(item => ({ ...item })),
  ];
  return next;
}

function createMergeSnapshots(reason: string, current: LifePlanData, remote: RemotePayload, localSnapshot: TodoSnapshot, actionPrefix: string, source: string) {
  const before = lifePlanRepository.createSnapshot(`${reason}前`, current, {
    action: `${actionPrefix}-before-merge`,
    source,
    mergedWith: { label: 'Todo 云端', hash: remote.hash },
  }) as { id?: string; version?: number; hash?: string } | undefined;
  const merged = todos.mergeTodoSnapshots(localSnapshot, canonical(remote.data)) as TodoSnapshot;
  const next = applySnapshot(current, merged);
  lifePlanRepository.createSnapshot(`${reason}结果`, next, {
    action: `${actionPrefix}-merge-result`,
    source,
    parentSnapshotId: before?.id,
    parentVersion: before?.version,
    parentHash: before?.hash,
    mergedWith: { label: 'Todo 云端', hash: remote.hash },
  });
  return { snapshot: merged, data: next, hash: todoHash(merged) };
}

function updateAfterPush(sourceHash: string, localHash: string, response: { etag?: string }, fallbackEtag = '') {
  const stamp = nowIso();
  const state = readState();
  writeState({
    ...state,
    dirty: false,
    lastLocalHash: sourceHash,
    lastRemoteHash: localHash,
    lastRemoteEtag: response.etag || fallbackEtag || state.lastRemoteEtag || '',
    lastPushAt: stamp,
    lastSyncAt: stamp,
  });
}

function isConditionalWriteConflict(error: unknown) {
  return typeof error === 'object' && error !== null && (error as { status?: number }).status === 412;
}

export function bindTodoCloudSync(options: {
  getData: () => LifePlanData;
  replaceData: (next: LifePlanData, reason: string) => void;
  onStatus?: StatusHandler;
}) {
  dataProvider = options.getData;
  dataReplacer = options.replaceData;
  statusHandler = options.onStatus || null;
}

export function getTodoSyncConfig() {
  return readConfig();
}

export function saveTodoSyncConfig(config: Partial<TodoSyncConfig>) {
  const saved = writeConfig(config);
  startTodoAutoSyncEngine();
  return saved;
}

export async function runTodoCloudSyncBoth(options: { source?: string; force?: boolean } = {}) {
  requireBindings();
  const mainConfig = readMainConfig();
  const todoConfig = readConfig();
  if (!mainConfig.webdavUrl) return { skipped: true, reason: 'missing-url' as const };
  if (!todoConfig.autoSync && !options.force) return { skipped: true, reason: 'auto-disabled' as const };
  if (mainConfig.useAppSyncKitProvider) return { skipped: true, reason: 'provider-no-conditional-write' as const };

  if (isSyncing) {
    pendingSync = true;
    return { skipped: true, reason: 'busy' as const };
  }

  isSyncing = true;
  try {
    const current = dataProvider!();
    const local = prepareLocal(current, 'todo-auto-sync-preflight');
    const state = readState();
    const remote = await fetchRemote(mainConfig);

    if (!remote) {
      writeState({ ...state, dirty: state.dirty === true, lastLocalHash: local.sourceHash, lastSyncAt: nowIso() });
      emitStatus('Todo 云端文件不存在；自动同步不会后台首次创建。');
      return { skipped: true, reason: 'missing-remote' as const };
    }
    assertRemoteSchema(remote.data);

    if (!state.lastRemoteHash && local.hash !== remote.hash) {
      writeState({
        ...state,
        dirty: state.dirty === true,
        lastLocalHash: local.sourceHash,
        lastRemoteHash: remote.hash,
        lastRemoteEtag: remote.etag || state.lastRemoteEtag || '',
        lastPullAt: nowIso(),
        lastSyncAt: nowIso(),
      });
      emitStatus('Todo 自动同步已记录云端基线；首次差异需要手动预览确认。');
      return { skipped: true, reason: 'missing-baseline' as const };
    }

    if (local.hash === remote.hash) {
      writeState({
        ...state,
        dirty: false,
        lastLocalHash: local.sourceHash,
        lastRemoteHash: remote.hash,
        lastRemoteEtag: remote.etag || state.lastRemoteEtag || '',
        lastPullAt: nowIso(),
        lastSyncAt: nowIso(),
      });
      emitStatus('Todo 云端和本地一致，无需同步');
      return { synced: true, unchanged: true };
    }

    const localChanged = state.dirty === true || (!!state.lastLocalHash && state.lastLocalHash !== local.sourceHash);
    const remoteChanged = !state.lastRemoteHash || remote.hash !== state.lastRemoteHash;

    if (!localChanged && remoteChanged) {
      const merged = createMergeSnapshots('自动拉取 Todo 云端合并', current, remote, local.snapshot, 'todo-auto-pull', options.source || 'vue-todo-auto-sync');
      dataReplacer!(merged.data, 'todo-auto-pull-merge');
      markMainSyncDirty(dataProvider!());
      const nextSourceHash = lifePlanRepository.getTodoSourceHash(dataProvider!());
      const shouldUpload = merged.hash !== remote.hash;
      writeState({
        ...readState(),
        dirty: shouldUpload,
        lastLocalHash: nextSourceHash,
        lastRemoteHash: remote.hash,
        lastRemoteEtag: remote.etag || '',
        lastPullAt: nowIso(),
        lastSyncAt: shouldUpload ? readState().lastSyncAt : nowIso(),
      });
      if (shouldUpload) {
        if (!remote.etag) throw new Error('Todo 云端响应没有 ETag，无法自动合并后上传。');
        const response = await pushWithEtag(mainConfig, merged.snapshot, remote.etag);
        const verification = await verifyUpload(mainConfig, merged.hash);
        updateAfterPush(nextSourceHash, merged.hash, response, verification.etag || remote.etag);
        emitStatus('发现 Todo 云端更新，已安全合并并回传');
        return { merged: true, uploaded: true };
      }
      emitStatus('发现 Todo 云端更新，已安全合并到本机');
      return { merged: true };
    }

    if (localChanged && !remoteChanged) {
      if (!remote.etag && !state.lastRemoteEtag) throw new Error('Todo 云端响应没有 ETag，无法自动条件上传。');
      const response = await pushWithEtag(mainConfig, local.snapshot, remote.etag || String(state.lastRemoteEtag || ''));
      const verification = await verifyUpload(mainConfig, local.hash);
      updateAfterPush(local.sourceHash, local.hash, response, verification.etag || remote.etag || '');
      emitStatus('发现 Todo 本地更新，已条件上传');
      return { uploaded: true };
    }

    const merged = createMergeSnapshots('自动合并 Todo', current, remote, local.snapshot, 'todo-auto-both', options.source || 'vue-todo-auto-sync');
    dataReplacer!(merged.data, 'todo-auto-both-merge');
    markMainSyncDirty(dataProvider!());
    const mergedSourceHash = lifePlanRepository.getTodoSourceHash(dataProvider!());
    writeState({
      ...readState(),
      dirty: true,
      lastLocalHash: mergedSourceHash,
      lastRemoteHash: remote.hash,
      lastRemoteEtag: remote.etag || '',
      lastPullAt: nowIso(),
      lastConflictAt: nowIso(),
    });
    if (!remote.etag) throw new Error('Todo 云端响应没有 ETag，无法自动合并后上传。');
    try {
      const response = await pushWithEtag(mainConfig, canonical(merged.snapshot), remote.etag);
      const verification = await verifyUpload(mainConfig, merged.hash);
      updateAfterPush(mergedSourceHash, merged.hash, response, verification.etag || remote.etag);
      emitStatus('Todo 两端都有变化，已保守合并并回写云端');
      return { merged: true, uploaded: true, conflict: true };
    } catch (error) {
      if (!isConditionalWriteConflict(error)) throw error;
      const latestRemote = await fetchRemote(mainConfig);
      if (!latestRemote?.etag) throw error;
      assertRemoteSchema(latestRemote.data);
      const latestLocal = prepareLocal(dataProvider!(), 'todo-auto-conflict-preflight');
      const mergedAgain = createMergeSnapshots('Todo 条件写入冲突合并', dataProvider!(), latestRemote, latestLocal.snapshot, 'todo-auto-etag-conflict', options.source || 'vue-todo-auto-sync');
      dataReplacer!(mergedAgain.data, 'todo-auto-etag-conflict-merge');
      markMainSyncDirty(dataProvider!());
      const retrySourceHash = lifePlanRepository.getTodoSourceHash(dataProvider!());
      const response = await pushWithEtag(mainConfig, mergedAgain.snapshot, latestRemote.etag);
      const verification = await verifyUpload(mainConfig, mergedAgain.hash);
      updateAfterPush(retrySourceHash, mergedAgain.hash, response, verification.etag || latestRemote.etag);
      emitStatus('Todo 云端版本变化，已合并后重新上传');
      return { merged: true, uploaded: true, conflict: true };
    }
  } catch (error) {
    emitStatus(error instanceof Error ? error.message : String(error), true);
    throw error;
  } finally {
    isSyncing = false;
    if (pendingSync) {
      pendingSync = false;
      queueMicrotask(() => {
        void runTodoCloudSyncBoth({ source: 'todo-pending-follow-up', force: true }).catch(() => undefined);
      });
    }
  }
}

export function scheduleTodoAutoSync(reason = '') {
  const mainConfig = readMainConfig();
  const todoConfig = readConfig();
  if (!todoConfig.autoSync || !mainConfig.webdavUrl) return;
  if (autoSyncTimer) clearTimeout(autoSyncTimer);
  if (reason) emitStatus(reason);
  autoSyncTimer = setTimeout(() => {
    void runTodoCloudSyncBoth({ source: 'todo-scheduled-auto-sync' }).catch(() => undefined);
  }, 20000);
}

export function notifyTodoDataUserCommit() {
  if (!dataProvider) return;
  const currentHash = lifePlanRepository.getTodoSourceHash(dataProvider());
  const state = readState();
  if (state.lastLocalHash !== currentHash) {
    writeState({ ...state, dirty: true, lastLocalHash: currentHash });
    scheduleTodoAutoSync('Todo 数据已修改，将在 20 秒后自动同步');
  }
}

function onVisibilityChange() {
  if (document.hidden) return;
  const mainConfig = readMainConfig();
  const todoConfig = readConfig();
  if (!todoConfig.autoSync || !mainConfig.webdavUrl) return;
  void runTodoCloudSyncBoth({ source: 'todo-visibility-resume' }).catch(() => undefined);
}

export function startTodoAutoSyncEngine() {
  const mainConfig = readMainConfig();
  const todoConfig = readConfig();
  writeConfig({ autoSync: todoConfig.autoSync });
  started = false;
  if (periodicTimer) {
    clearInterval(periodicTimer);
    periodicTimer = null;
  }
  if (!visibilityBound && typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange);
    visibilityBound = true;
  }
  if (!todoConfig.autoSync || !mainConfig.webdavUrl) return;
  periodicTimer = setInterval(() => {
    if (typeof document !== 'undefined' && document.hidden) return;
    void runTodoCloudSyncBoth({ source: 'todo-periodic-auto-sync' }).catch(() => undefined);
  }, 300000);
  started = true;
}

export function stopTodoAutoSyncEngine() {
  if (autoSyncTimer) clearTimeout(autoSyncTimer);
  if (periodicTimer) clearInterval(periodicTimer);
  autoSyncTimer = null;
  periodicTimer = null;
  started = false;
}

export function isTodoAutoSyncStarted() {
  return started;
}
