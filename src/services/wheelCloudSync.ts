import { createLegacyServices } from './legacyServices';
import { lifePlanRepository } from './lifePlanRepository';
import type { LifePlanData } from '../types/lifePlan';

type MainSyncConfig = { webdavUrl?: string; useAppSyncKitProvider?: boolean; [key: string]: unknown };
type WheelSyncConfig = {
  remotePath: string;
  autoSync: boolean;
  conditionalAutoSyncEnabled: boolean;
  remoteUploadEnabled: false;
};
type WheelSyncState = Record<string, unknown> & {
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
type WheelSnapshot = {
  wheels: LifePlanData['wheels'];
  wheelTags: LifePlanData['wheelTags'];
  wheelLibraryItems: LifePlanData['wheelLibraryItems'];
  wheelHistory: LifePlanData['wheelHistory'];
  deletedItems: LifePlanData['deletedItems'];
};
type StatusHandler = (message: string, isError?: boolean) => void;

const sync = createLegacyServices().sync;
const MAIN_CONFIG_KEY = 'lifePlanSyncConfig';
const MAIN_STATE_KEY = 'lifePlanSyncState';
const CONFIG_KEY = 'lifePlanWheelSyncConfig';
const STATE_KEY = 'lifePlanWheelSyncState';
const REMOTE_PATH = '/apps/wheel-app/data.json';

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
    return value && typeof value === 'object' ? value : {} as T;
  } catch {
    return {} as T;
  }
}

function readMainConfig(): MainSyncConfig {
  return readJson<MainSyncConfig>(MAIN_CONFIG_KEY);
}

function readConfig(): WheelSyncConfig {
  const raw = readJson<Partial<WheelSyncConfig>>(CONFIG_KEY);
  const autoSync = raw.conditionalAutoSyncEnabled === true && raw.autoSync === true;
  const next = {
    remotePath: REMOTE_PATH,
    autoSync,
    conditionalAutoSyncEnabled: autoSync,
    remoteUploadEnabled: false as const,
  };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
  return next;
}

function writeConfig(config: Partial<WheelSyncConfig> = {}) {
  const next: WheelSyncConfig = {
    remotePath: REMOTE_PATH,
    autoSync: config.autoSync === true,
    conditionalAutoSyncEnabled: config.autoSync === true,
    remoteUploadEnabled: false,
  };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
  return next;
}

function readState(): WheelSyncState {
  return readJson<WheelSyncState>(STATE_KEY);
}

function writeState(next: WheelSyncState) {
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

function canonical(value: unknown): WheelSnapshot {
  return sync.getWheelSnapshot(value) as WheelSnapshot;
}

function wheelHash(value: unknown) {
  return sync.getWheelDataHash(canonical(value));
}

function snapshotFromData(data: LifePlanData) {
  return canonical(data);
}

function applySnapshot(sourceData: LifePlanData, snapshot: WheelSnapshot): LifePlanData {
  const next = JSON.parse(JSON.stringify(sourceData)) as LifePlanData;
  next.wheels = snapshot.wheels.map(item => ({ ...item }));
  next.wheelTags = snapshot.wheelTags.map(item => ({ ...item }));
  next.wheelLibraryItems = snapshot.wheelLibraryItems.map(item => ({ ...item }));
  next.wheelHistory = snapshot.wheelHistory.map(item => ({ ...item }));
  next.deletedItems = [
    ...next.deletedItems.filter(item => !['wheels', 'wheelTags', 'wheelLibraryItems', 'wheelHistory', 'wheelItems'].includes(String(item.collection || ''))),
    ...snapshot.deletedItems.map(item => ({ ...item })),
  ];
  return next;
}

function requireBindings() {
  if (!dataProvider || !dataReplacer) throw new Error('wheel cloud sync is not bound to the Vue repository yet');
}

function isConditionalWriteConflict(error: unknown) {
  return typeof error === 'object' && error !== null && (error as { status?: number }).status === 412;
}

async function fetchRemote(mainConfig: MainSyncConfig) {
  return await sync.pullJson(
    { ...mainConfig, remotePath: REMOTE_PATH },
    REMOTE_PATH,
    (value: unknown) => canonical(value),
    (value: unknown) => wheelHash(value),
  ) as RemotePayload | null;
}

async function pushWithEtag(mainConfig: MainSyncConfig, snapshot: WheelSnapshot, ifMatch = '') {
  return await sync.pushJson(
    { ...mainConfig, remotePath: REMOTE_PATH },
    REMOTE_PATH,
    snapshot,
    'wheel-app',
    { ifMatch },
  ) as { etag?: string };
}

async function verifyUpload(mainConfig: MainSyncConfig, localHash: string) {
  const verification = await fetchRemote(mainConfig);
  if (!verification || verification.hash !== localHash) throw new Error('上传后回读的 Wheel hash 不一致。');
  return verification;
}

function createMergeSnapshots(reason: string, current: LifePlanData, remote: RemotePayload, actionPrefix: string, source: string) {
  const before = lifePlanRepository.createSnapshot(`${reason}前`, current, {
    action: `${actionPrefix}-before-merge`,
    source,
    mergedWith: { label: 'Wheel 云端', hash: remote.hash },
  }) as { id?: string; version?: number; hash?: string } | undefined;
  const merged = sync.mergeWheelSnapshots(snapshotFromData(current), remote.data) as WheelSnapshot;
  const next = applySnapshot(current, merged);
  lifePlanRepository.createSnapshot(`${reason}结果`, next, {
    action: `${actionPrefix}-merge-result`,
    source,
    parentSnapshotId: before?.id,
    parentVersion: before?.version,
    parentHash: before?.hash,
    mergedWith: { label: 'Wheel 云端', hash: remote.hash },
  });
  return next;
}

function updateAfterPush(localHash: string, response: { etag?: string }, fallbackEtag = '') {
  const stamp = nowIso();
  const state = readState();
  writeState({
    ...state,
    dirty: false,
    lastLocalHash: localHash,
    lastRemoteHash: localHash,
    lastRemoteEtag: response.etag || fallbackEtag || state.lastRemoteEtag || '',
    lastPushAt: stamp,
    lastSyncAt: stamp,
  });
}

export function bindWheelCloudSync(options: {
  getData: () => LifePlanData;
  replaceData: (next: LifePlanData, reason: string) => void;
  onStatus?: StatusHandler;
}) {
  dataProvider = options.getData;
  dataReplacer = options.replaceData;
  statusHandler = options.onStatus || null;
}

export function getWheelSyncConfig() {
  return readConfig();
}

export function saveWheelSyncConfig(config: Partial<WheelSyncConfig>) {
  const saved = writeConfig(config);
  startWheelAutoSyncEngine();
  return saved;
}

export async function runWheelCloudSyncBoth(options: { source?: string; force?: boolean } = {}) {
  requireBindings();
  const mainConfig = readMainConfig();
  const wheelConfig = readConfig();
  if (!mainConfig.webdavUrl) return { skipped: true, reason: 'missing-url' as const };
  if (!wheelConfig.autoSync && !options.force) return { skipped: true, reason: 'auto-disabled' as const };
  if (mainConfig.useAppSyncKitProvider) return { skipped: true, reason: 'provider-no-conditional-write' as const };

  if (isSyncing) {
    pendingSync = true;
    return { skipped: true, reason: 'busy' as const };
  }

  isSyncing = true;
  try {
    const current = dataProvider!();
    const localSnapshot = snapshotFromData(current);
    const localHash = wheelHash(localSnapshot);
    const state = readState();
    const remote = await fetchRemote(mainConfig);

    if (!remote) {
      writeState({ ...state, lastLocalHash: localHash, lastSyncAt: nowIso() });
      emitStatus('Wheel 云端文件不存在；自动同步不会后台首次创建。');
      return { skipped: true, reason: 'missing-remote' as const };
    }

    if (!state.lastRemoteHash && localHash !== remote.hash) {
      writeState({
        ...state,
        lastLocalHash: localHash,
        lastRemoteHash: remote.hash,
        lastRemoteEtag: remote.etag || state.lastRemoteEtag || '',
        lastPullAt: nowIso(),
        lastSyncAt: nowIso(),
      });
      emitStatus('Wheel 自动同步已记录云端基线；首次差异需要手动预览确认。');
      return { skipped: true, reason: 'missing-baseline' as const };
    }

    const localChanged = state.dirty === true || (!!state.lastLocalHash && state.lastLocalHash !== localHash);
    const remoteChanged = remote.hash !== localHash && (!!state.lastRemoteHash && remote.hash !== state.lastRemoteHash);

    if (!localChanged && !remoteChanged) {
      writeState({
        ...state,
        dirty: false,
        lastLocalHash: localHash,
        lastRemoteHash: remote.hash,
        lastRemoteEtag: remote.etag || state.lastRemoteEtag || '',
        lastPullAt: nowIso(),
        lastSyncAt: nowIso(),
      });
      emitStatus('Wheel 云端和本地一致，无需同步');
      return { synced: true, unchanged: true };
    }

    if (!localChanged && remoteChanged) {
      const next = applySnapshot(current, canonical(remote.data));
      dataReplacer!(next, 'wheel-auto-pull');
      markMainSyncDirty(dataProvider!());
      const nextHash = wheelHash(next);
      writeState({
        ...readState(),
        dirty: false,
        lastLocalHash: nextHash,
        lastRemoteHash: remote.hash,
        lastRemoteEtag: remote.etag || '',
        lastPullAt: nowIso(),
        lastSyncAt: nowIso(),
      });
      emitStatus('发现 Wheel 云端更新，已拉取到本机');
      return { pulled: true };
    }

    if (localChanged && !remoteChanged) {
      if (!remote.etag && !state.lastRemoteEtag) throw new Error('Wheel 云端响应没有 ETag，无法自动条件上传。');
      const response = await pushWithEtag(mainConfig, localSnapshot, remote.etag || String(state.lastRemoteEtag || ''));
      const verification = await verifyUpload(mainConfig, localHash);
      updateAfterPush(localHash, response, verification.etag || remote.etag || '');
      emitStatus('发现 Wheel 本地更新，已条件上传');
      return { uploaded: true };
    }

    const next = createMergeSnapshots('自动合并 Wheel', current, remote, 'wheel-auto-both', options.source || 'vue-wheel-auto-sync');
    dataReplacer!(next, 'wheel-auto-both-merge');
    markMainSyncDirty(dataProvider!());
    const mergedSnapshot = snapshotFromData(dataProvider!());
    const mergedHash = wheelHash(mergedSnapshot);
    const latestState = readState();
    writeState({
      ...latestState,
      dirty: true,
      lastLocalHash: mergedHash,
      lastRemoteHash: remote.hash,
      lastRemoteEtag: remote.etag || '',
      lastPullAt: nowIso(),
      lastConflictAt: nowIso(),
    });
    if (!remote.etag) throw new Error('Wheel 云端响应没有 ETag，无法自动合并后上传。');
    try {
      const response = await pushWithEtag(mainConfig, mergedSnapshot, remote.etag);
      const verification = await verifyUpload(mainConfig, mergedHash);
      updateAfterPush(mergedHash, response, verification.etag || remote.etag);
      emitStatus('Wheel 两端都有变化，已保守合并并回写云端');
      return { merged: true, uploaded: true, conflict: true };
    } catch (error) {
      if (!isConditionalWriteConflict(error)) throw error;
      const latestRemote = await fetchRemote(mainConfig);
      if (!latestRemote?.etag) throw error;
      const mergedAgain = createMergeSnapshots('Wheel 条件写入冲突合并', dataProvider!(), latestRemote, 'wheel-auto-etag-conflict', options.source || 'vue-wheel-auto-sync');
      dataReplacer!(mergedAgain, 'wheel-auto-etag-conflict-merge');
      markMainSyncDirty(dataProvider!());
      const retrySnapshot = snapshotFromData(dataProvider!());
      const retryHash = wheelHash(retrySnapshot);
      const response = await pushWithEtag(mainConfig, retrySnapshot, latestRemote.etag);
      const verification = await verifyUpload(mainConfig, retryHash);
      updateAfterPush(retryHash, response, verification.etag || latestRemote.etag);
      emitStatus('Wheel 云端版本变化，已合并后重新上传');
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
        void runWheelCloudSyncBoth({ source: 'wheel-pending-follow-up', force: true }).catch(() => undefined);
      });
    }
  }
}

export function scheduleWheelAutoSync(reason = '') {
  const mainConfig = readMainConfig();
  const wheelConfig = readConfig();
  if (!wheelConfig.autoSync || !mainConfig.webdavUrl) return;
  if (autoSyncTimer) clearTimeout(autoSyncTimer);
  if (reason) emitStatus(reason);
  autoSyncTimer = setTimeout(() => {
    void runWheelCloudSyncBoth({ source: 'wheel-scheduled-auto-sync' }).catch(() => undefined);
  }, 20000);
}

export function notifyWheelDataUserCommit() {
  if (!dataProvider) return;
  const currentHash = wheelHash(dataProvider());
  const state = readState();
  if (state.lastLocalHash !== currentHash) {
    writeState({ ...state, dirty: true, lastLocalHash: currentHash });
    scheduleWheelAutoSync('Wheel 数据已修改，将在 20 秒后自动同步');
  }
}

function onVisibilityChange() {
  if (document.hidden) return;
  const mainConfig = readMainConfig();
  const wheelConfig = readConfig();
  if (!wheelConfig.autoSync || !mainConfig.webdavUrl) return;
  void runWheelCloudSyncBoth({ source: 'wheel-visibility-resume' }).catch(() => undefined);
}

export function startWheelAutoSyncEngine() {
  const mainConfig = readMainConfig();
  const wheelConfig = writeConfig(readConfig());
  started = false;
  if (periodicTimer) {
    clearInterval(periodicTimer);
    periodicTimer = null;
  }
  if (!visibilityBound && typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange);
    visibilityBound = true;
  }
  if (!wheelConfig.autoSync || !mainConfig.webdavUrl) return;
  periodicTimer = setInterval(() => {
    if (typeof document !== 'undefined' && document.hidden) return;
    void runWheelCloudSyncBoth({ source: 'wheel-periodic-auto-sync' }).catch(() => undefined);
  }, 300000);
  started = true;
}

export function stopWheelAutoSyncEngine() {
  if (autoSyncTimer) clearTimeout(autoSyncTimer);
  if (periodicTimer) clearInterval(periodicTimer);
  autoSyncTimer = null;
  periodicTimer = null;
  started = false;
}

export function isWheelAutoSyncStarted() {
  return started;
}
