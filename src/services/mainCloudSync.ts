import { createLegacyServices } from './legacyServices';
import { lifePlanRepository } from './lifePlanRepository';
import type { LifePlanData } from '../types/lifePlan';

type SyncConfig = {
  webdavUrl: string;
  remotePath: string;
  autoSync: boolean;
  useAppSyncKitProvider?: boolean;
  [key: string]: unknown;
};

type SyncState = Record<string, unknown> & {
  dirty?: boolean;
  lastLocalHash?: string;
  lastLocalUpdateAt?: string;
  lastRemoteHash?: string;
  lastRemoteEtag?: string;
  lastPullAt?: string;
  lastPushAt?: string;
  lastSyncAt?: string;
  lastConflictAt?: string;
};

type RemotePayload = { data: unknown; hash: string; etag?: string };
type StatusHandler = (message: string, isError?: boolean) => void;

const sync = createLegacyServices().sync;
const CONFIG_KEY = 'lifePlanSyncConfig';
const STATE_KEY = 'lifePlanSyncState';
const STATUS_EVENT = 'life-plan-main-sync-status';
const CONFIG_EVENT = 'life-plan-main-sync-config';

let autoSyncTimer: ReturnType<typeof setTimeout> | null = null;
let periodicTimer: ReturnType<typeof setInterval> | null = null;
let isCloudSyncing = false;
let pendingCloudSync = false;
let started = false;
let dataProvider: (() => LifePlanData) | null = null;
let dataReplacer: ((next: LifePlanData, reason: string) => void) | null = null;
let statusHandler: StatusHandler | null = null;
let visibilityBound = false;

function nowIso() {
  return new Date().toISOString();
}

function formatClockTime(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function withClockTime(message: string) {
  return `${message} ${formatClockTime()}`;
}

function normalizeConfig(raw: Partial<SyncConfig> = {}): SyncConfig {
  const next: SyncConfig = {
    webdavUrl: String(raw.webdavUrl || ''),
    remotePath: sync.normalizeRemotePath(raw.remotePath || '/life-plan.json'),
    autoSync: raw.autoSync !== false,
  };
  if (Object.prototype.hasOwnProperty.call(raw, 'useAppSyncKitProvider')) {
    next.useAppSyncKitProvider = raw.useAppSyncKitProvider === true;
  }
  return next;
}

function readConfig(): SyncConfig {
  try {
    const raw = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}') as Partial<SyncConfig>;
    let migratedFromWheel = false;
    if (!raw.webdavUrl) {
      try {
        const legacyWheelConfig = JSON.parse(localStorage.getItem('lifePlanWheelSyncConfig') || '{}') as { webdavUrl?: unknown };
        if (legacyWheelConfig.webdavUrl) {
          raw.webdavUrl = String(legacyWheelConfig.webdavUrl);
          migratedFromWheel = true;
        }
      } catch {
        // Ignore malformed legacy wheel settings and keep the main settings usable.
      }
    }
    const next = normalizeConfig(raw);
    if (migratedFromWheel) localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
    return next;
  } catch {
    return { webdavUrl: '', remotePath: '/life-plan.json', autoSync: true };
  }
}

function writeConfig(config: SyncConfig) {
  const next = normalizeConfig(config);
  localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CONFIG_EVENT, { detail: next }));
  }
  return next;
}

function readState(): SyncState {
  try {
    return JSON.parse(localStorage.getItem(STATE_KEY) || '{}') as SyncState;
  } catch {
    return {};
  }
}

function writeState(next: SyncState) {
  localStorage.setItem(STATE_KEY, JSON.stringify(next));
}

function emitStatus(message: string, isError = false) {
  statusHandler?.(message, isError);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(STATUS_EVENT, { detail: { message, isError } }));
  }
}

function rememberRemoteVersion(remote: RemotePayload | null, state: SyncState) {
  if (!remote) return;
  if (remote.etag) state.lastRemoteEtag = remote.etag;
}

function isConditionalWriteConflict(error: unknown) {
  return typeof error === 'object' && error !== null && (error as { status?: number }).status === 412;
}

function requireBindings() {
  if (!dataProvider || !dataReplacer) {
    throw new Error('main cloud sync is not bound to the Vue repository yet');
  }
}

function createMergeSnapshots(reason: string, current: LifePlanData, remote: RemotePayload, actionPrefix: string, source = 'vue-main-auto-sync') {
  const before = lifePlanRepository.createSnapshot(`${reason}前`, current, {
    action: `${actionPrefix}-before-merge`,
    source,
    mergedWith: { label: '云端', hash: remote.hash },
  }) as { id?: string; version?: number; hash?: string } | undefined;
  const merged = sync.mergeCloudData(current, remote.data) as LifePlanData;
  lifePlanRepository.createSnapshot(`${reason}结果`, merged, {
    action: `${actionPrefix}-merge-result`,
    source,
    parentSnapshotId: before?.id,
    parentVersion: before?.version,
    parentHash: before?.hash,
    mergedWith: { label: '云端', hash: remote.hash },
  });
  return merged;
}

async function fetchRemote(config: SyncConfig) {
  return await sync.pullJson(config, config.remotePath) as RemotePayload | null;
}

async function pushWithEtag(config: SyncConfig, data: LifePlanData, ifMatch = '') {
  return await sync.pushJson(config, config.remotePath, data, 'life-plan', { ifMatch }) as { etag?: string };
}

function updateAfterPush(data: LifePlanData, response: { etag?: string }, fallbackEtag = '') {
  const stamp = nowIso();
  const hash = sync.getDataHash(data);
  const state = readState();
  writeState({
    ...state,
    dirty: false,
    lastLocalHash: hash,
    lastRemoteHash: hash,
    lastRemoteEtag: response.etag || fallbackEtag || state.lastRemoteEtag || '',
    lastPushAt: stamp,
    lastSyncAt: stamp,
  });
}

export function bindMainCloudSync(options: {
  getData: () => LifePlanData;
  replaceData: (next: LifePlanData, reason: string) => void;
  onStatus?: StatusHandler;
}) {
  dataProvider = options.getData;
  dataReplacer = options.replaceData;
  statusHandler = options.onStatus || null;
  const state = readState();
  const localHash = sync.getDataHash(dataProvider());
  if (!state.lastLocalHash) {
    writeState({ ...state, lastLocalHash: localHash });
  }
}

export function getMainSyncConfig() {
  return readConfig();
}

export function saveMainSyncConfig(config: SyncConfig) {
  const saved = writeConfig(config);
  startMainAutoSyncEngine();
  return saved;
}

export async function runMainCloudSyncBoth(options: { source?: string; force?: boolean } = {}) {
  requireBindings();
  const config = readConfig();
  if (!config.webdavUrl) return { skipped: true, reason: 'missing-url' as const };
  if (!config.autoSync && !options.force) return { skipped: true, reason: 'auto-disabled' as const };

  if (isCloudSyncing) {
    pendingCloudSync = true;
    return { skipped: true, reason: 'busy' as const };
  }

  isCloudSyncing = true;
  try {
    emitStatus(withClockTime('正在同步...'));
    const current = dataProvider!();
    const localHash = sync.getDataHash(current);
    const state = readState();
    const remote = await fetchRemote(config);
    const previousRemoteHash = String(state.lastRemoteHash || '');
    const localChanged = state.dirty === true
      || (!!previousRemoteHash && previousRemoteHash !== localHash)
      || (!previousRemoteHash && !!remote && localHash !== remote.hash);

    if (!remote) {
      lifePlanRepository.createSnapshot('自动上传前', current, {
        action: 'auto-upload',
        source: options.source || 'vue-main-auto-sync',
      });
      const response = await pushWithEtag(config, current, '');
      updateAfterPush(current, response);
      emitStatus(withClockTime('云端文件不存在，已自动上传本地主数据'));
      return { uploaded: true };
    }

    rememberRemoteVersion(remote, state);
    const remoteChanged = !!remote && !!previousRemoteHash && remote.hash !== previousRemoteHash;

    if (!localChanged && !remoteChanged) {
      writeState({
        ...state,
        dirty: false,
        lastLocalHash: localHash,
        lastRemoteHash: remote.hash,
        lastRemoteEtag: remote.etag || state.lastRemoteEtag || '',
        lastSyncAt: nowIso(),
      });
      emitStatus(withClockTime('云端和本地一致，无需同步'));
      return { synced: true, unchanged: true };
    }

    if (!localChanged && remoteChanged) {
      const remoteEtag = remote.etag || String(state.lastRemoteEtag || '');
      const merged = createMergeSnapshots('拉取云端安全合并', current, remote, 'auto-pull', options.source || 'vue-main-auto-sync');
      dataReplacer!(merged, 'auto-pull-merge');
      const mergedHash = sync.getDataHash(merged);
      const shouldUpload = mergedHash !== remote.hash;
      writeState({
        ...readState(),
        dirty: shouldUpload,
        lastLocalHash: mergedHash,
        lastRemoteHash: remote.hash,
        lastRemoteEtag: remote.etag || '',
        lastPullAt: nowIso(),
        lastSyncAt: shouldUpload ? readState().lastSyncAt : nowIso(),
      });
      if (shouldUpload) {
        const latest = dataProvider!();
        const response = await pushWithEtag(config, latest, remoteEtag);
        updateAfterPush(latest, response, remoteEtag);
        emitStatus(withClockTime('发现云端更新，已安全合并并回传'));
        return { merged: true, uploaded: true };
      }
      emitStatus(withClockTime('发现云端更新，已安全合并'));
      return { merged: true };
    }

    if (localChanged && !remoteChanged) {
      lifePlanRepository.createSnapshot('自动上传前', current, {
        action: 'auto-upload',
        source: options.source || 'vue-main-auto-sync',
      });
      try {
        const response = await pushWithEtag(config, current, remote.etag || String(state.lastRemoteEtag || ''));
        updateAfterPush(current, response, remote.etag || '');
      } catch (error) {
        if (!isConditionalWriteConflict(error)) throw error;
        const latestRemote = await fetchRemote(config);
        if (!latestRemote?.etag) throw error;
        const merged = createMergeSnapshots('条件写入冲突合并', dataProvider!(), latestRemote, 'auto-etag-conflict', options.source || 'vue-main-auto-sync');
        dataReplacer!(merged, 'auto-etag-conflict-merge');
        const response = await pushWithEtag(config, dataProvider!(), latestRemote.etag);
        updateAfterPush(dataProvider!(), response, latestRemote.etag);
        emitStatus(withClockTime('云端版本变化，已合并后重新上传'));
        return { merged: true, uploaded: true, conflict: true };
      }
      emitStatus(withClockTime('发现本地更新，已上传'));
      return { uploaded: true };
    }

    const merged = createMergeSnapshots('自动合并', current, remote, 'auto-both', options.source || 'vue-main-auto-sync');
    dataReplacer!(merged, 'auto-both-merge');
    writeState({
      ...readState(),
      dirty: true,
      lastLocalHash: sync.getDataHash(merged),
      lastRemoteHash: remote.hash,
      lastRemoteEtag: remote.etag || '',
      lastPullAt: nowIso(),
      lastConflictAt: nowIso(),
    });
    const remoteEtag = remote.etag || String(state.lastRemoteEtag || '');
    const response = await pushWithEtag(config, dataProvider!(), remoteEtag);
    updateAfterPush(dataProvider!(), response, remoteEtag);
    emitStatus(withClockTime('本地和云端都有变化，已按条目时间保守合并'));
    return { merged: true, uploaded: true, conflict: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    emitStatus(message || '自动同步失败', true);
    throw error;
  } finally {
    isCloudSyncing = false;
    if (pendingCloudSync) {
      pendingCloudSync = false;
      queueMicrotask(() => {
        void runMainCloudSyncBoth({ source: 'pending-follow-up', force: true }).catch(() => undefined);
      });
    }
  }
}

export function scheduleMainAutoSync(reason = '') {
  const config = readConfig();
  if (!config.autoSync || !config.webdavUrl) return;
  if (autoSyncTimer) clearTimeout(autoSyncTimer);
  if (reason) emitStatus(reason);
  autoSyncTimer = setTimeout(() => {
    void runMainCloudSyncBoth({ source: 'scheduled-auto-sync' }).catch(() => undefined);
  }, 20000);
}

export function notifyMainDataUserCommit() {
  scheduleMainAutoSync('本地有更新，将在 20 秒后自动同步');
}

function onVisibilityChange() {
  if (document.hidden) return;
  const config = readConfig();
  if (!config.autoSync || !config.webdavUrl) return;
  void runMainCloudSyncBoth({ source: 'visibility-resume' }).catch(() => undefined);
}

export function startMainAutoSyncEngine() {
  const config = readConfig();
  if (periodicTimer) {
    clearInterval(periodicTimer);
    periodicTimer = null;
  }
  if (!visibilityBound && typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange);
    visibilityBound = true;
  }
  if (!config.autoSync || !config.webdavUrl) return;
  periodicTimer = setInterval(() => {
    if (typeof document !== 'undefined' && document.hidden) return;
    void runMainCloudSyncBoth({ source: 'periodic-auto-sync' }).catch(() => undefined);
  }, 300000);
  started = true;
}

export function stopMainAutoSyncEngine() {
  if (autoSyncTimer) clearTimeout(autoSyncTimer);
  if (periodicTimer) clearInterval(periodicTimer);
  autoSyncTimer = null;
  periodicTimer = null;
  started = false;
}

export function isMainAutoSyncStarted() {
  return started;
}
