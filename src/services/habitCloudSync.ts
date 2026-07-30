import { createLegacyServices, genId, getNowLocal, getTodayStr } from './legacyServices';
import { lifePlanRepository } from './lifePlanRepository';
import type { LifePlanData } from '../types/lifePlan';

type MainSyncConfig = { webdavUrl?: string; useAppSyncKitProvider?: boolean; [key: string]: unknown };
type HabitSyncConfig = {
  remotePath: string;
  autoSync: boolean;
  conditionalAutoSyncEnabled: boolean;
  remoteUploadEnabled: false;
};
type HabitSyncState = Record<string, unknown> & {
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
type HabitSnapshot = Record<string, unknown> & {
  habits: unknown[];
  habitGroups: unknown[];
  habitRecords: unknown[];
  habitRewards: unknown[];
  habitRewardRecords: unknown[];
  habitFineRecords: unknown[];
  habitLedger: unknown[];
  habitCurrencies: unknown[];
  habitMilestones: unknown[];
  habitMilestoneClaims: unknown[];
  habitOverdueEvents: unknown[];
  habitMoodNotes: unknown[];
  habitTimeTasks: unknown[];
  deletedItems: unknown[];
};
type HabitLocal = { snapshot: HabitSnapshot; hash: string; sourceHash: string };
type StatusHandler = (message: string, isError?: boolean) => void;

const services = createLegacyServices();
const sync = services.sync;
const habit = services.habit;
const MAIN_CONFIG_KEY = 'lifePlanSyncConfig';
const MAIN_STATE_KEY = 'lifePlanSyncState';
const CONFIG_KEY = 'habitAppSyncConfig';
const STATE_KEY = 'habitAppSyncState';
const REMOTE_PATH = '/apps/habit-app/data.json';

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

function readConfig(): HabitSyncConfig {
  const raw = readJson<Partial<HabitSyncConfig>>(CONFIG_KEY);
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

function writeConfig(config: Partial<HabitSyncConfig> = {}) {
  const next: HabitSyncConfig = {
    remotePath: REMOTE_PATH,
    autoSync: config.autoSync === true,
    conditionalAutoSyncEnabled: config.autoSync === true,
    remoteUploadEnabled: false,
  };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
  return next;
}

function readState(): HabitSyncState {
  return readJson<HabitSyncState>(STATE_KEY);
}

function writeState(next: HabitSyncState) {
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

function habitHash(value: unknown) {
  return sync.getHabitDataHash(value);
}

function canonical(value: unknown): HabitSnapshot {
  return sync.getHabitSnapshot(value) as HabitSnapshot;
}

function localFromData(data: LifePlanData): HabitLocal {
  const sourceHash = sync.getDataHash(habit.getHabitLegacySourceSlice(data));
  const preview = habit.buildHabitAppSnapshotPreview(data, {
    sourceHash,
    generatedAt: new Date().toISOString(),
  }) as { snapshot: HabitSnapshot };
  return { snapshot: canonical(preview.snapshot), hash: habitHash(preview.snapshot), sourceHash };
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(item => item && typeof item === 'object').map(item => ({ ...(item as Record<string, unknown>) })) : [];
}

function decodeRemoteId(value: unknown, collection = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const prefixes: Record<string, string> = {
    habits: 'life-plan/habits/',
    habitRecords: 'life-plan/checkins/',
    habitLedger: 'life-plan/ledger/',
    habitRewards: 'life-plan/rewards/',
    habitCurrencies: 'life-plan/currencies/',
    habitRewardRecords: 'life-plan/reward-records/',
    habitFineRecords: 'life-plan/fine-records/',
  };
  const prefix = prefixes[collection] || '';
  if (!prefix || !raw.startsWith(prefix)) return raw;
  try {
    return decodeURIComponent(raw.slice(prefix.length));
  } catch {
    return raw.slice(prefix.length);
  }
}

function normalizeHabitCurrency(value: unknown) {
  return String(value || '金币').trim() || '金币';
}

function currencyName(snapshot: HabitSnapshot, id: unknown) {
  const raw = String(id || '').trim();
  if (!raw || raw === 'default') return '金币';
  const match = asArray(snapshot.habitCurrencies).find(item => String(item.id || '') === raw || String(item.name || '') === raw);
  return normalizeHabitCurrency(match?.name || decodeRemoteId(raw, 'habitCurrencies') || raw);
}

function groupName(snapshot: HabitSnapshot, id: unknown) {
  const raw = String(id || '').trim();
  if (!raw || raw === 'default') return '';
  const match = asArray(snapshot.habitGroups).find(item => String(item.id || '') === raw);
  return String(match?.name || '').trim();
}

function recordDate(record: Record<string, unknown>) {
  return String(record.recordDate || record.date || record.recordTime || record.createdAt || '').slice(0, 10);
}

function intValue(value: unknown, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildLegacySlice(snapshot: HabitSnapshot) {
  const source = canonical(snapshot);
  const habitIds = new Set(asArray(source.habits).map(item => String(item.id || '')).filter(Boolean));
  const deletedMap = new Map(asArray(source.deletedItems)
    .filter(item => item.collection && item.id)
    .map(item => [`${String(item.collection)}:${String(item.id)}`, item]));
  const isDeleted = (collection: string, id: unknown) => !!id && deletedMap.has(`${collection}:${String(id)}`);
  const habits = asArray(source.habits)
    .filter(item => item.id && !isDeleted('habits', item.id))
    .map((item, index) => {
      const rewardCurrency = currencyName(source, item.rewardCurrencyId || item.currencyId);
      const fineCurrency = currencyName(source, item.fineCurrencyId || item.penaltyCurrencyId || item.rewardCurrencyId);
      const repeatUnit = String(item.repeatUnit || item.rule || 'daily');
      return {
        id: decodeRemoteId(item.id, 'habits'),
        remoteId: item.id,
        name: item.title || item.name || '未命名习惯',
        description: item.description || '',
        tag: groupName(source, item.groupId) || '未分组',
        rule: repeatUnit === 'weekly' ? 'weekly-fixed' : 'daily',
        weekdays: Array.isArray(item.weekdays) ? item.weekdays : [],
        timesPerDay: Math.max(1, intValue(item.requiredCountPerDay ?? item.targetCount, 1)),
        goalCount: Math.max(0, intValue(item.targetCount, 0)),
        targetRewardAmount: Math.max(0, intValue(item.targetRewardAmount, 0)),
        taskDurationSec: Math.max(0, intValue(item.taskDurationSec, 0)),
        reminderTimes: Array.isArray(item.reminderTimes) ? item.reminderTimes : [],
        lastCheckAt: item.lastCheckAt || '',
        startDate: item.startDate || String(item.createdAt || item.updatedAt || getTodayStr()).slice(0, 10),
        noteMode: item.noteMode || 'ask',
        rewardPoints: Math.max(0, intValue(item.rewardAmount, 0)),
        rewardCurrency,
        penaltyPoints: Math.max(0, intValue(item.fineAmount ?? item.penaltyAmount, 0)),
        penaltyCurrency: fineCurrency,
        randomReward: false,
        rewardMin: Math.max(0, intValue(item.rewardAmount, 0)),
        rewardMax: Math.max(0, intValue(item.rewardAmount, 0)),
        breakPenaltyMode: 'none',
        breakPenaltyPoints: 0,
        breakPenaltyCurrency: fineCurrency,
        milestoneRewards: asArray(source.habitMilestones)
          .filter(milestone => milestone.habitId === item.id && !isDeleted('habitMilestones', milestone.id))
          .sort((a, b) => (Number(a.sort ?? index) || 0) - (Number(b.sort ?? index) || 0))
          .map(milestone => ({
            days: Math.max(1, intValue(milestone.targetDays, 1)),
            enabled: true,
            rewardAmount: Math.max(0, intValue(milestone.rewardAmount, 0)),
            currency: currencyName(source, milestone.currencyId || item.rewardCurrencyId),
            penaltyAmount: 0,
            penaltyCurrency: fineCurrency,
          })),
        archived: item.status === 'archived',
        icon: item.icon || '✅',
        color: item.color || '#6EA6E4',
        sort: Number.isFinite(Number(item.sort)) ? Number(item.sort) : index,
        createdAt: item.createdAt || getNowLocal(),
        updatedAt: item.updatedAt || item.createdAt || getNowLocal(),
      };
    });
  const legacyHabitIds = new Set(habits.map(item => item.id));
  const checkins = asArray(source.habitRecords)
    .filter(item => item.id && item.habitId && !isDeleted('habitRecords', item.id) && habitIds.has(String(item.habitId)))
    .map(item => {
      const habitId = decodeRemoteId(item.habitId, 'habits');
      return {
        id: decodeRemoteId(item.id, 'habitRecords'),
        remoteId: item.id,
        habitId,
        date: recordDate(item),
        time: String(item.recordTime || item.createdAt || '').slice(11, 16),
        note: item.note || '',
        recordType: item.type || item.recordType || 'normal',
        amount: Number.isFinite(Number(item.amount)) ? Number(item.amount) : undefined,
        sourceKey: item.sourceKey || '',
        checkinAt: item.recordTime || item.checkinAt || item.createdAt || `${recordDate(item)}T00:00:00`,
        createdAt: item.createdAt || item.recordTime || getNowLocal(),
        updatedAt: item.updatedAt || item.createdAt || item.recordTime || getNowLocal(),
      };
    })
    .filter(item => item.id && legacyHabitIds.has(String(item.habitId)));
  const legacyRewardIds = new Set(asArray(source.habitRewards)
    .filter(item => item.id && !isDeleted('habitRewards', item.id))
    .map(item => decodeRemoteId(item.id, 'habitRewards')));
  const habitRewards = asArray(source.habitRewards)
    .filter(item => item.id && !isDeleted('habitRewards', item.id))
    .map((item, index) => ({
      id: decodeRemoteId(item.id, 'habitRewards'),
      remoteId: item.id,
      name: item.name || item.title || '未命名心愿',
      note: item.description || item.note || '',
      cost: Math.max(1, intValue(item.cost, 1)),
      currency: currencyName(source, item.currencyId),
      archived: item.status === 'archived',
      icon: item.icon || '🎁',
      color: item.color || '#6EA6E4',
      stock: Math.max(0, intValue(item.stock, 0)),
      redeemedCount: Math.max(0, intValue(item.redeemedCount, 0)),
      sort: Number.isFinite(Number(item.sort)) ? Number(item.sort) : index,
      createdAt: item.createdAt || getNowLocal(),
      updatedAt: item.updatedAt || item.createdAt || getNowLocal(),
    }));
  const typeMap: Record<string, string> = {
    streak_reward: 'milestone',
    target_reward: 'milestone',
    reward_redeem: 'redeem',
    fine: 'miss',
  };
  const habitPointLedger = asArray(source.habitLedger)
    .filter(item => item.id && !isDeleted('habitLedger', item.id))
    .map(item => {
      const canonicalType = String(item.type || 'adjust');
      const habitId = decodeRemoteId(item.habitId, 'habits');
      const rewardId = decodeRemoteId(item.rewardId, 'habitRewards');
      const sourceId = canonicalType === 'checkin' || canonicalType === 'makeup'
        ? decodeRemoteId(item.sourceId, 'habitRecords')
        : decodeRemoteId(item.sourceId);
      return {
        id: decodeRemoteId(item.id, 'habitLedger'),
        remoteId: item.id,
        habitId: legacyHabitIds.has(habitId) ? habitId : '',
        rewardId: legacyRewardIds.has(rewardId) ? rewardId : '',
        sourceId,
        type: typeMap[canonicalType] || canonicalType,
        amount: intValue(item.amount, 0),
        currency: currencyName(source, item.currencyId || item.currency),
        date: item.date || String(item.createdAt || item.updatedAt || getTodayStr()).slice(0, 10),
        note: item.note || '',
        createdAt: item.createdAt || item.date || getNowLocal(),
        updatedAt: item.updatedAt || item.createdAt || item.date || getNowLocal(),
      };
    });
  const habitCurrencies = asArray(source.habitCurrencies)
    .filter(item => item.id && !isDeleted('habitCurrencies', item.id))
    .map(item => ({
      id: decodeRemoteId(item.id, 'habitCurrencies') || genId(),
      name: normalizeHabitCurrency(item.name || item.currency || item.id),
      createdAt: item.createdAt || getNowLocal(),
      updatedAt: item.updatedAt || item.createdAt || getNowLocal(),
    }));
  const collectionMap: Record<string, string> = {
    habits: 'habits',
    habitRecords: 'checkins',
    habitLedger: 'habitPointLedger',
    habitRewards: 'habitRewards',
    habitCurrencies: 'habitCurrencies',
  };
  const deletedItems = asArray(source.deletedItems)
    .filter(item => item.collection && item.id && item.deletedAt)
    .map(item => {
      const collection = collectionMap[String(item.collection || '')];
      if (!collection) return null;
      return {
        collection,
        id: decodeRemoteId(item.id, String(item.collection || '')),
        deletedAt: item.deletedAt,
        reason: item.reason || 'habit-cloud-apply',
        name: item.name || '',
        parentId: decodeRemoteId(item.parentId, 'habits'),
      };
    })
    .filter(Boolean);
  return { habits, checkins, habitPointLedger, habitRewards, habitCurrencies, deletedItems };
}

function applySnapshot(sourceData: LifePlanData, snapshot: HabitSnapshot): LifePlanData {
  const next = JSON.parse(JSON.stringify(sourceData)) as LifePlanData;
  const legacySlice = buildLegacySlice(snapshot);
  next.habits = legacySlice.habits as unknown as LifePlanData['habits'];
  next.checkins = legacySlice.checkins as unknown as LifePlanData['checkins'];
  next.habitPointLedger = legacySlice.habitPointLedger as unknown as LifePlanData['habitPointLedger'];
  next.habitRewards = legacySlice.habitRewards as unknown as LifePlanData['habitRewards'];
  next.habitCurrencies = legacySlice.habitCurrencies as unknown as LifePlanData['habitCurrencies'];
  next.deletedItems = [
    ...next.deletedItems.filter(item => !['habits', 'checkins', 'habitPointLedger', 'habitRewards', 'habitCurrencies'].includes(String(item.collection || ''))),
    ...legacySlice.deletedItems as unknown as LifePlanData['deletedItems'],
  ];
  return next;
}

function requireBindings() {
  if (!dataProvider || !dataReplacer) throw new Error('habit cloud sync is not bound to the Vue repository yet');
}

function isConditionalWriteConflict(error: unknown) {
  return typeof error === 'object' && error !== null && (error as { status?: number }).status === 412;
}

async function fetchRemote(mainConfig: MainSyncConfig) {
  return await sync.pullJson(
    { ...mainConfig, remotePath: REMOTE_PATH },
    REMOTE_PATH,
    (value: unknown) => value,
    (value: unknown) => habitHash(value),
  ) as RemotePayload | null;
}

async function pushWithEtag(mainConfig: MainSyncConfig, snapshot: HabitSnapshot, ifMatch = '') {
  return await sync.pushJson(
    { ...mainConfig, remotePath: REMOTE_PATH },
    REMOTE_PATH,
    snapshot,
    'habit-app',
    { ifMatch },
  ) as { etag?: string };
}

async function verifyUpload(mainConfig: MainSyncConfig, localHash: string) {
  const verification = await fetchRemote(mainConfig);
  if (!verification || verification.hash !== localHash) throw new Error('上传后回读的 Habit hash 不一致。');
  return verification;
}

function createMergeSnapshots(reason: string, current: LifePlanData, remote: RemotePayload, actionPrefix: string, source: string) {
  const before = lifePlanRepository.createSnapshot(`${reason}前`, current, {
    action: `${actionPrefix}-before-merge`,
    source,
    mergedWith: { label: 'Habit 云端', hash: remote.hash },
  }) as { id?: string; version?: number; hash?: string } | undefined;
  const merged = sync.mergeHabitSnapshots(localFromData(current).snapshot, remote.data) as HabitSnapshot;
  const next = applySnapshot(current, merged);
  lifePlanRepository.createSnapshot(`${reason}结果`, next, {
    action: `${actionPrefix}-merge-result`,
    source,
    parentSnapshotId: before?.id,
    parentVersion: before?.version,
    parentHash: before?.hash,
    mergedWith: { label: 'Habit 云端', hash: remote.hash },
  });
  return next;
}

function updateAfterPush(local: HabitLocal, response: { etag?: string }, fallbackEtag = '') {
  const stamp = nowIso();
  const state = readState();
  writeState({
    ...state,
    dirty: false,
    lastLocalHash: local.sourceHash,
    lastRemoteHash: local.hash,
    lastRemoteEtag: response.etag || fallbackEtag || state.lastRemoteEtag || '',
    lastPushAt: stamp,
    lastSyncAt: stamp,
  });
}

export function bindHabitCloudSync(options: {
  getData: () => LifePlanData;
  replaceData: (next: LifePlanData, reason: string) => void;
  onStatus?: StatusHandler;
}) {
  dataProvider = options.getData;
  dataReplacer = options.replaceData;
  statusHandler = options.onStatus || null;
}

export function getHabitSyncConfig() {
  return readConfig();
}

export function saveHabitSyncConfig(config: Partial<HabitSyncConfig>) {
  const saved = writeConfig(config);
  startHabitAutoSyncEngine();
  return saved;
}

export async function runHabitCloudSyncBoth(options: { source?: string; force?: boolean } = {}) {
  requireBindings();
  const mainConfig = readMainConfig();
  const habitConfig = readConfig();
  if (!mainConfig.webdavUrl) return { skipped: true, reason: 'missing-url' as const };
  if (!habitConfig.autoSync && !options.force) return { skipped: true, reason: 'auto-disabled' as const };
  if (mainConfig.useAppSyncKitProvider) return { skipped: true, reason: 'provider-no-conditional-write' as const };

  if (isSyncing) {
    pendingSync = true;
    return { skipped: true, reason: 'busy' as const };
  }

  isSyncing = true;
  try {
    const current = dataProvider!();
    const local = localFromData(current);
    const state = readState();
    const remote = await fetchRemote(mainConfig);

    if (!remote) {
      writeState({ ...state, lastLocalHash: local.sourceHash, lastSyncAt: nowIso() });
      emitStatus('Habit 云端文件不存在；自动同步不会后台首次创建。');
      return { skipped: true, reason: 'missing-remote' as const };
    }

    if (!state.lastRemoteHash && local.hash !== remote.hash) {
      writeState({
        ...state,
        lastLocalHash: local.sourceHash,
        lastRemoteHash: remote.hash,
        lastRemoteEtag: remote.etag || state.lastRemoteEtag || '',
        lastPullAt: nowIso(),
        lastSyncAt: nowIso(),
      });
      emitStatus('Habit 自动同步已记录云端基线；首次差异需要手动预览确认。');
      return { skipped: true, reason: 'missing-baseline' as const };
    }

    const localChanged = state.dirty === true || (!!state.lastLocalHash && state.lastLocalHash !== local.sourceHash);
    const remoteChanged = remote.hash !== local.hash && (!!state.lastRemoteHash && remote.hash !== state.lastRemoteHash);

    if (!localChanged && !remoteChanged) {
      writeState({
        ...state,
        dirty: false,
        lastLocalHash: local.sourceHash,
        lastRemoteHash: remote.hash,
        lastRemoteEtag: remote.etag || state.lastRemoteEtag || '',
        lastPullAt: nowIso(),
        lastSyncAt: nowIso(),
      });
      emitStatus('Habit 云端和本地一致，无需同步');
      return { synced: true, unchanged: true };
    }

    if (!localChanged && remoteChanged) {
      const next = applySnapshot(current, canonical(remote.data));
      dataReplacer!(next, 'habit-auto-pull');
      markMainSyncDirty(dataProvider!());
      const nextLocal = localFromData(dataProvider!());
      const shouldUpload = nextLocal.hash !== remote.hash;
      writeState({
        ...readState(),
        dirty: shouldUpload,
        lastLocalHash: nextLocal.sourceHash,
        lastRemoteHash: remote.hash,
        lastRemoteEtag: remote.etag || '',
        lastPullAt: nowIso(),
        lastSyncAt: shouldUpload ? readState().lastSyncAt : nowIso(),
      });
      if (shouldUpload && remote.etag) {
        const response = await pushWithEtag(mainConfig, nextLocal.snapshot, remote.etag);
        const verification = await verifyUpload(mainConfig, nextLocal.hash);
        updateAfterPush(nextLocal, response, verification.etag || remote.etag);
        emitStatus('发现 Habit 云端更新，已拉取并回写规范快照');
        return { pulled: true, uploaded: true };
      }
      emitStatus('发现 Habit 云端更新，已拉取到本机');
      return { pulled: true };
    }

    if (localChanged && !remoteChanged) {
      if (!remote.etag && !state.lastRemoteEtag) throw new Error('Habit 云端响应没有 ETag，无法自动条件上传。');
      const response = await pushWithEtag(mainConfig, local.snapshot, remote.etag || String(state.lastRemoteEtag || ''));
      const verification = await verifyUpload(mainConfig, local.hash);
      updateAfterPush(local, response, verification.etag || remote.etag || '');
      emitStatus('发现 Habit 本地更新，已条件上传');
      return { uploaded: true };
    }

    const next = createMergeSnapshots('自动合并 Habit', current, remote, 'habit-auto-both', options.source || 'vue-habit-auto-sync');
    dataReplacer!(next, 'habit-auto-both-merge');
    markMainSyncDirty(dataProvider!());
    const mergedLocal = localFromData(dataProvider!());
    writeState({
      ...readState(),
      dirty: true,
      lastLocalHash: mergedLocal.sourceHash,
      lastRemoteHash: remote.hash,
      lastRemoteEtag: remote.etag || '',
      lastPullAt: nowIso(),
      lastConflictAt: nowIso(),
    });
    if (!remote.etag) throw new Error('Habit 云端响应没有 ETag，无法自动合并后上传。');
    try {
      const response = await pushWithEtag(mainConfig, mergedLocal.snapshot, remote.etag);
      const verification = await verifyUpload(mainConfig, mergedLocal.hash);
      updateAfterPush(mergedLocal, response, verification.etag || remote.etag);
      emitStatus('Habit 两端都有变化，已保守合并并回写云端');
      return { merged: true, uploaded: true, conflict: true };
    } catch (error) {
      if (!isConditionalWriteConflict(error)) throw error;
      const latestRemote = await fetchRemote(mainConfig);
      if (!latestRemote?.etag) throw error;
      const mergedAgain = createMergeSnapshots('Habit 条件写入冲突合并', dataProvider!(), latestRemote, 'habit-auto-etag-conflict', options.source || 'vue-habit-auto-sync');
      dataReplacer!(mergedAgain, 'habit-auto-etag-conflict-merge');
      markMainSyncDirty(dataProvider!());
      const retryLocal = localFromData(dataProvider!());
      const response = await pushWithEtag(mainConfig, retryLocal.snapshot, latestRemote.etag);
      const verification = await verifyUpload(mainConfig, retryLocal.hash);
      updateAfterPush(retryLocal, response, verification.etag || latestRemote.etag);
      emitStatus('Habit 云端版本变化，已合并后重新上传');
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
        void runHabitCloudSyncBoth({ source: 'habit-pending-follow-up', force: true }).catch(() => undefined);
      });
    }
  }
}

export function scheduleHabitAutoSync(reason = '') {
  const mainConfig = readMainConfig();
  const habitConfig = readConfig();
  if (!habitConfig.autoSync || !mainConfig.webdavUrl) return;
  if (autoSyncTimer) clearTimeout(autoSyncTimer);
  if (reason) emitStatus(reason);
  autoSyncTimer = setTimeout(() => {
    void runHabitCloudSyncBoth({ source: 'habit-scheduled-auto-sync' }).catch(() => undefined);
  }, 20000);
}

export function notifyHabitDataUserCommit() {
  if (!dataProvider) return;
  const currentHash = localFromData(dataProvider()).sourceHash;
  const state = readState();
  if (state.lastLocalHash !== currentHash) {
    writeState({ ...state, dirty: true, lastLocalHash: currentHash });
    scheduleHabitAutoSync('Habit 数据已修改，将在 20 秒后自动同步');
  }
}

function onVisibilityChange() {
  if (document.hidden) return;
  const mainConfig = readMainConfig();
  const habitConfig = readConfig();
  if (!habitConfig.autoSync || !mainConfig.webdavUrl) return;
  void runHabitCloudSyncBoth({ source: 'habit-visibility-resume' }).catch(() => undefined);
}

export function startHabitAutoSyncEngine() {
  const mainConfig = readMainConfig();
  const habitConfig = readConfig();
  started = false;
  if (periodicTimer) {
    clearInterval(periodicTimer);
    periodicTimer = null;
  }
  if (!visibilityBound && typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange);
    visibilityBound = true;
  }
  if (!habitConfig.autoSync || !mainConfig.webdavUrl) return;
  periodicTimer = setInterval(() => {
    if (typeof document !== 'undefined' && document.hidden) return;
    void runHabitCloudSyncBoth({ source: 'habit-periodic-auto-sync' }).catch(() => undefined);
  }, 300000);
  started = true;
}

export function stopHabitAutoSyncEngine() {
  if (autoSyncTimer) clearTimeout(autoSyncTimer);
  if (periodicTimer) clearInterval(periodicTimer);
  autoSyncTimer = null;
  periodicTimer = null;
  started = false;
}

export function isHabitAutoSyncStarted() {
  return started;
}
