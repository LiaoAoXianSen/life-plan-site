<script setup lang="ts">
import { computed, reactive, ref } from 'vue';

import { getHabitSyncConfig, saveHabitSyncConfig } from '../services/habitCloudSync';
import { createLegacyServices, genId, getNowLocal, getTodayStr } from '../services/legacyServices';
import { lifePlanRepository } from '../services/lifePlanRepository';
import { useLifePlanStore } from '../stores/lifePlanStore';
import type { LifePlanData } from '../types/lifePlan';

type SyncConfig = Record<string, unknown> & { webdavUrl?: string; useAppSyncKitProvider?: boolean };
type RunAutoSync = () => Promise<unknown>;
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
type SnapshotModel = {
  snapshot: HabitSnapshot;
  hash: string;
  hashShort: string;
  etag?: string;
  counts: { habits: number; records: number; ledger: number; rewards: number; tombstones: number };
};
type SyncRisk = { severity: 'danger' | 'warning'; message: string };
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
type PreviewState = {
  status: 'idle' | 'loading' | 'missing' | 'ready' | 'error';
  local: SnapshotModel | null;
  remote: SnapshotModel | null;
  merged: SnapshotModel | null;
  hashesMatch: boolean;
  risks: SyncRisk[];
};
type HabitSyncConfig = { remotePath: string; autoSync: boolean; conditionalAutoSyncEnabled: boolean; remoteUploadEnabled: false };

const props = defineProps<{ syncConfig: SyncConfig; runAutoSync?: RunAutoSync; restartAutoSync?: () => void }>();
const store = useLifePlanStore();
const services = createLegacyServices();
const sync = services.sync;
const habit = services.habit;
const remotePath = '/apps/habit-app/data.json';
const busy = ref(false);
const autoBusy = ref(false);
const armed = ref(false);
const message = ref('');
const messageTone = ref<'info' | 'success' | 'danger'>('info');
const preview = reactive<PreviewState>({ status: 'idle', local: null, remote: null, merged: null, hashesMatch: false, risks: [] });
const syncState = reactive<HabitSyncState>(readJson('habitAppSyncState'));
const autoConfig = reactive<HabitSyncConfig>(getHabitSyncConfig());

persistConfig();

const endpointReady = computed(() => !!String(props.syncConfig.webdavUrl || '').trim());
const hasDangerRisk = computed(() => preview.risks.some(item => item.severity === 'danger'));
const canApply = computed(() => preview.status === 'ready' && !preview.hashesMatch && !!preview.merged && !hasDangerRisk.value && !busy.value);
const canUploadExisting = computed(() => preview.status === 'ready' && !preview.hashesMatch && !!preview.remote && !hasDangerRisk.value && !busy.value);

function readJson(key: string): Record<string, unknown> {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

const requiredCollections = [
  'habits',
  'habitGroups',
  'habitRecords',
  'habitRewards',
  'habitRewardRecords',
  'habitFineRecords',
  'habitLedger',
  'habitCurrencies',
  'habitMilestones',
  'habitMilestoneClaims',
  'habitOverdueEvents',
  'habitMoodNotes',
  'habitTimeTasks',
  'deletedItems',
];

function persistConfig() {
  Object.assign(autoConfig, saveHabitSyncConfig({ autoSync: autoConfig.autoSync }));
}

function updateSyncState(patch: HabitSyncState) {
  Object.assign(syncState, patch);
  localStorage.setItem('habitAppSyncState', JSON.stringify(syncState));
}

function setMessage(value: string, tone: 'info' | 'success' | 'danger' = 'info') {
  message.value = value;
  messageTone.value = tone;
}

function saveAutoSyncSetting() {
  persistConfig();
  props.restartAutoSync?.();
  setMessage(autoConfig.autoSync
    ? 'Habit 条件自动同步已启用；仅同步已存在的云端文件，不会后台首次创建。'
    : 'Habit 条件自动同步已关闭。', autoConfig.autoSync ? 'success' : 'info');
}

async function runAutoSyncNow() {
  if (!props.runAutoSync || autoBusy.value) return;
  autoBusy.value = true;
  setMessage('正在执行一次 Habit 条件自动同步...');
  try {
    const result = await props.runAutoSync();
    if (result && typeof result === 'object' && 'skipped' in result && result.skipped) {
      const reason = 'reason' in result ? String(result.reason || '') : '';
      setMessage(reason === 'missing-remote'
        ? 'Habit 云端文件不存在；自动同步不会后台首次创建。'
        : reason === 'missing-baseline'
          ? 'Habit 自动同步已记录云端基线；首次差异需要手动预览确认。'
          : 'Habit 条件自动同步已跳过。');
      return;
    }
    setMessage('已执行一次 Habit 条件自动同步。', 'success');
  } catch (error) {
    setMessage(error instanceof Error ? error.message : String(error), 'danger');
  } finally {
    autoBusy.value = false;
    Object.assign(autoConfig, getHabitSyncConfig());
  }
}

function habitHash(value: unknown) {
  return sync.getHabitDataHash(value);
}

function canonical(value: unknown): HabitSnapshot {
  return sync.getHabitSnapshot(value) as HabitSnapshot;
}

function model(value: unknown, hash = '', etag = ''): SnapshotModel {
  const snapshot = canonical(value);
  const resolvedHash = hash || habitHash(snapshot);
  return {
    snapshot,
    hash: resolvedHash,
    hashShort: resolvedHash.slice(0, 12),
    ...(etag ? { etag } : {}),
    counts: {
      habits: snapshot.habits.length,
      records: snapshot.habitRecords.length,
      ledger: snapshot.habitLedger.length,
      rewards: snapshot.habitRewards.length,
      tombstones: snapshot.deletedItems.length,
    },
  };
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

function applySnapshot(snapshot: HabitSnapshot) {
  const next = JSON.parse(JSON.stringify(store.data)) as LifePlanData;
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
  store.replace(next, 'habit-cloud-apply', 'user');
}

function schemaRisks(value: unknown): SyncRisk[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [{ severity: 'danger', message: '云端 habit-app schema 不是对象。' }];
  }
  const source = value as Record<string, unknown>;
  return requiredCollections
    .filter(key => !Array.isArray(source[key]))
    .map(key => ({
      severity: key === 'deletedItems' ? 'warning' : 'danger',
      message: key === 'deletedItems'
        ? '云端缺少有效的 deletedItems 数组，将按空删除标记预览。'
        : `云端缺少有效的 ${key} 数组。`,
    }));
}

function prepareLocal() {
  const sourceHash = sync.getDataHash(habit.getHabitLegacySourceSlice(store.data));
  const previewModel = habit.buildHabitAppSnapshotPreview(store.data, {
    sourceHash,
    generatedAt: new Date().toISOString(),
  }) as { snapshot: HabitSnapshot };
  return model(previewModel.snapshot);
}

function legacySourceHash() {
  return sync.getDataHash(habit.getHabitLegacySourceSlice(store.data));
}

async function pullRemote(): Promise<RemotePayload | null> {
  return await sync.pullJson(
    { ...props.syncConfig, remotePath },
    remotePath,
    (value: unknown) => value,
    (value: unknown) => habitHash(value),
  ) as RemotePayload | null;
}

function setReadyPreview(local: SnapshotModel, remotePayload: RemotePayload) {
  const remote = model(remotePayload.data, remotePayload.hash, remotePayload.etag || '');
  const merged = model(sync.mergeHabitSnapshots(local.snapshot, remote.snapshot));
  Object.assign(preview, {
    status: 'ready',
    local,
    remote,
    merged,
    hashesMatch: local.hash === remote.hash,
    risks: schemaRisks(remotePayload.data),
  });
  return remote;
}

function verifyLocalUnchanged(localHash: string) {
  return prepareLocal().hash === localHash;
}

async function verifyUpload(local: SnapshotModel) {
  const verification = await pullRemote();
  if (!verification || verification.hash !== local.hash) throw new Error('上传后回读的 Habit hash 不一致。');
  return verification;
}

function finishUpload(local: SnapshotModel, verification: RemotePayload, fallbackEtag = '') {
  const stamp = new Date().toISOString();
  updateSyncState({
    dirty: false,
    lastLocalHash: legacySourceHash(),
    lastRemoteHash: local.hash,
    lastRemoteEtag: verification.etag || fallbackEtag,
    lastPullAt: stamp,
    lastPushAt: stamp,
    lastSyncAt: stamp,
  });
  Object.assign(preview, {
    status: 'ready',
    local,
    remote: { ...local, etag: verification.etag || fallbackEtag },
    merged: local,
    hashesMatch: true,
    risks: [],
  });
}

async function previewRemote() {
  if (busy.value) return;
  armed.value = false;
  persistConfig();
  if (!endpointReady.value) {
    preview.status = 'error';
    setMessage('请先保存统一同步地址。', 'danger');
    return;
  }
  busy.value = true;
  preview.status = 'loading';
  setMessage('正在只读检查 Habit 云端文件...');
  try {
    const local = prepareLocal();
    preview.local = local;
    const remotePayload = await pullRemote();
    if (!remotePayload) {
      Object.assign(preview, { status: 'missing', local, remote: null, merged: null, hashesMatch: false, risks: [] });
      setMessage('云端 Habit 文件不存在。首次创建需要本次会话授权。');
      return;
    }
    setReadyPreview(local, remotePayload);
    setMessage(preview.hashesMatch ? '只读预检完成：本机与 Habit 云端一致。' : '只读预检完成：已生成本机、云端与合并预览。', preview.hashesMatch ? 'success' : 'info');
  } catch (error) {
    preview.status = 'error';
    setMessage(error instanceof Error ? error.message : String(error), 'danger');
  } finally {
    busy.value = false;
    persistConfig();
  }
}

async function applyRemoteMerge() {
  if (!canApply.value || !preview.remote || !preview.merged) return;
  busy.value = true;
  setMessage('正在复查 Habit 云端版本...');
  try {
    const expectedRemoteHash = preview.remote.hash;
    const expectedMergedHash = preview.merged.hash;
    const local = prepareLocal();
    const remotePayload = await pullRemote();
    if (!remotePayload) throw new Error('复查时云端 Habit 文件不存在，已停止应用。');
    const remote = setReadyPreview(local, remotePayload);
    const merged = preview.merged;
    if (remote.hash !== expectedRemoteHash) {
      updateSyncState({ lastConflictAt: new Date().toISOString(), lastRemoteHash: remote.hash, lastRemoteEtag: remote.etag || '' });
      setMessage('云端自预览后已变化，已刷新预览但没有写入本机。', 'danger');
      return;
    }
    if (!merged || merged.hash !== expectedMergedHash) {
      setMessage('本机自预览后已变化，已刷新合并结果但没有写入本机。', 'danger');
      return;
    }
    if (hasDangerRisk.value) throw new Error('云端 schema 风险阻止应用。');
    if (!window.confirm(`将 ${merged.counts.habits} 个习惯、${merged.counts.records} 条记录和 ${merged.counts.ledger} 条流水应用到本机，并创建应用前快照。确认继续吗？`)) {
      setMessage('已取消应用；本机数据未改变。');
      return;
    }
    const beforeSnapshot = lifePlanRepository.createSnapshot('应用 Habit 云端合并结果前', store.data, {
      action: 'before-habit-cloud-apply',
      source: 'vue-habit-sync',
      mergedWith: { label: 'Habit 云端', hash: remote.hash },
    });
    if (!beforeSnapshot && !window.confirm('应用前快照创建失败。继续将缺少回滚点，仍要应用吗？')) {
      setMessage('快照未创建，已取消应用；本机数据未改变。', 'danger');
      return;
    }
    applySnapshot(merged.snapshot);
    const stamp = new Date().toISOString();
    const legacySourceHash = sync.getDataHash(habit.getHabitLegacySourceSlice(store.data));
    const nextLocal = model(habit.buildHabitAppSnapshotPreview(store.data, {
      sourceHash: legacySourceHash,
      generatedAt: stamp,
    }).snapshot);
    updateSyncState({
      dirty: merged.hash !== remote.hash,
      lastLocalHash: legacySourceHash,
      lastRemoteHash: remote.hash,
      lastRemoteEtag: remote.etag || '',
      lastPullAt: stamp,
      lastSyncAt: stamp,
    });
    Object.assign(preview, { status: 'ready', local: nextLocal, remote, merged: nextLocal, hashesMatch: nextLocal.hash === remote.hash, risks: [] });
    setMessage('Habit 合并结果已应用到本机；云端未写入。', 'success');
  } catch (error) {
    setMessage(error instanceof Error ? error.message : String(error), 'danger');
  } finally {
    busy.value = false;
    persistConfig();
  }
}

async function uploadExisting() {
  if (!canUploadExisting.value || !preview.remote || busy.value) return;
  if (props.syncConfig.useAppSyncKitProvider) {
    setMessage('当前 provider 不支持 If-Match 条件写入。', 'danger');
    return;
  }
  busy.value = true;
  let putAttempted = false;
  setMessage('正在复查本机 Habit 快照与云端基线...');
  try {
    const expectedRemoteHash = preview.remote.hash;
    const local = prepareLocal();
    const remotePayload = await pullRemote();
    if (!remotePayload) {
      Object.assign(preview, { status: 'missing', local, remote: null, merged: null, hashesMatch: false, risks: [] });
      throw new Error('云端文件已不存在，请重新检查；本切片不做首次创建。');
    }
    const remote = setReadyPreview(local, remotePayload);
    if (hasDangerRisk.value) throw new Error('云端 schema 风险阻止上传。');
    if (local.hash === remote.hash) {
      finishUpload(local, remotePayload, remote.etag || '');
      setMessage('本机与 Habit 云端已一致，未发送 PUT。', 'success');
      return;
    }
    if (remote.hash !== expectedRemoteHash) {
      updateSyncState({ lastConflictAt: new Date().toISOString(), lastRemoteHash: remote.hash, lastRemoteEtag: remote.etag || '' });
      throw new Error('云端自上次检查后已变化，已停止上传并刷新预览。');
    }
    if (!remote.etag) throw new Error('云端响应没有 ETag，无法安全上传。');
    if (!window.confirm(`使用 If-Match ${remote.etag} 将本机 Habit 快照写入云端。确认继续吗？`)) {
      setMessage('已取消上传；云端未改变。');
      return;
    }
    if (!verifyLocalUnchanged(local.hash)) throw new Error('确认期间本机 Habit 数据已变化，请重新检查。');
    putAttempted = true;
    const result = await sync.pushJson(
      { ...props.syncConfig, remotePath }, remotePath, local.snapshot, 'habit-app', { ifMatch: remote.etag },
    ) as { etag?: string };
    const verification = await verifyUpload(local);
    finishUpload(local, verification, result.etag || remote.etag);
    setMessage('Habit 云端已条件写入并回读核验一致。', 'success');
  } catch (error) {
    const status = typeof error === 'object' && error !== null ? (error as { status?: number }).status : undefined;
    setMessage(status === 412
      ? 'If-Match 被拒绝：云端版本已变化，未发生覆盖。'
      : putAttempted
        ? `PUT 已发出但无法确认结果：${error instanceof Error ? error.message : String(error)}。不会自动重试。`
        : error instanceof Error ? error.message : String(error), 'danger');
  } finally {
    busy.value = false;
    persistConfig();
  }
}

async function uploadFirst() {
  if (preview.status !== 'missing' || !armed.value || busy.value) return;
  if (props.syncConfig.useAppSyncKitProvider) {
    setMessage('当前 provider 不支持 create-only 条件写入。', 'danger');
    return;
  }
  busy.value = true;
  let putAttempted = false;
  setMessage('正在执行 Habit 首次创建前复查...');
  try {
    const local = prepareLocal();
    const remotePayload = await pullRemote();
    if (remotePayload) {
      setReadyPreview(local, remotePayload);
      throw new Error('最终复查发现云端文件已存在，已停止首次创建。');
    }
    if (!window.confirm(`以 create-only 条件创建 ${remotePath}，包含 ${local.counts.habits} 个习惯、${local.counts.records} 条记录和 ${local.counts.ledger} 条流水。确认继续吗？`)) {
      setMessage('已取消首次创建；云端未改变。');
      return;
    }
    if (!verifyLocalUnchanged(local.hash)) throw new Error('确认期间本机 Habit 数据已变化，请重新检查。');
    putAttempted = true;
    const result = await sync.pushJson(
      { ...props.syncConfig, remotePath }, remotePath, local.snapshot, 'habit-app', { ifNoneMatch: '*' },
    ) as { etag?: string };
    const verification = await verifyUpload(local);
    finishUpload(local, verification, result.etag || '');
    setMessage('Habit 云端文件已首次创建并回读核验一致。', 'success');
  } catch (error) {
    const status = typeof error === 'object' && error !== null ? (error as { status?: number }).status : undefined;
    if (status === 412 || putAttempted) preview.status = 'idle';
    setMessage(status === 412
      ? 'Create-only 写入被拒绝：云端文件已由其他设备创建。'
      : putAttempted
        ? `PUT 已发出但无法确认结果：${error instanceof Error ? error.message : String(error)}。不会自动重试。`
        : error instanceof Error ? error.message : String(error), 'danger');
  } finally {
    busy.value = false;
    armed.value = false;
    persistConfig();
  }
}
</script>

<template>
  <article class="card habit-sync-card">
    <div class="habit-sync-heading">
      <div><div class="card-title">习惯独立同步</div><span>{{ remotePath }}</span></div>
      <span class="habit-sync-mode">预览/应用/条件自动</span>
    </div>

    <div class="habit-sync-auto">
      <label>
        <input v-model="autoConfig.autoSync" type="checkbox" :disabled="busy || !endpointReady" @change="saveAutoSyncSetting" />
        <span>启用 Habit 条件自动同步</span>
      </label>
      <button class="btn btn-secondary" type="button" :disabled="autoBusy || busy || !endpointReady" @click="runAutoSyncNow">立即自动同步一次</button>
    </div>

    <div class="page-actions habit-sync-actions">
      <button class="btn btn-secondary" type="button" :disabled="busy || !endpointReady" @click="previewRemote">检查 Habit 云端</button>
      <button v-if="preview.status === 'ready'" class="btn btn-secondary" type="button" :disabled="!canApply" @click="applyRemoteMerge">应用合并到本机</button>
      <button v-if="preview.status === 'ready'" class="btn btn-primary" type="button" :disabled="!canUploadExisting" @click="uploadExisting">受保护上传</button>
    </div>

    <label v-if="preview.status === 'missing'" class="habit-sync-arm">
      <input v-model="armed" type="checkbox" />
      <span>本次会话允许首次创建</span>
      <button class="btn btn-primary" type="button" :disabled="!armed || busy" @click.prevent="uploadFirst">首次创建</button>
    </label>

    <div v-if="preview.local" class="habit-sync-comparison">
      <div v-for="item in [{ label: '本机', value: preview.local }, { label: '云端', value: preview.remote }, { label: '合并', value: preview.merged }]" :key="item.label" class="habit-sync-column">
        <strong>{{ item.label }}</strong>
        <template v-if="item.value">
          <span>{{ item.value.counts.habits }} 习惯 · 记录 {{ item.value.counts.records }} · 流水 {{ item.value.counts.ledger }}</span>
          <small>{{ item.value.hashShort }}</small>
        </template>
        <span v-else>{{ preview.status === 'missing' && item.label === '云端' ? '不存在' : '-' }}</span>
      </div>
    </div>

    <div v-if="preview.risks.length" class="habit-sync-risks">
      <p v-for="risk in preview.risks" :key="risk.message" :class="`is-${risk.severity}`">{{ risk.message }}</p>
    </div>
    <p v-if="message" class="sync-status active" :class="`is-${messageTone}`" role="status">{{ message }}</p>
  </article>
</template>

<style scoped>
.habit-sync-card { margin-top: 18px; }
.habit-sync-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.habit-sync-heading span { color: var(--faint); font-size: 12px; overflow-wrap: anywhere; }
.habit-sync-mode { padding: 5px 8px; border: 1px solid var(--line); border-radius: 6px; white-space: nowrap; }
.habit-sync-auto {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 14px;
  padding: 10px 0;
  border-top: 1px solid var(--line);
}
.habit-sync-auto label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.habit-sync-actions { margin-top: 14px; }
.habit-sync-arm { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 9px; align-items: center; margin-top: 14px; padding: 10px 0; border-top: 1px solid var(--line); }
.habit-sync-comparison { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 16px; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.habit-sync-column { display: grid; gap: 4px; min-width: 0; padding: 12px; border-right: 1px solid var(--line); }
.habit-sync-column:last-child { border-right: 0; }
.habit-sync-column strong { font-size: 13px; }
.habit-sync-column span, .habit-sync-column small { color: var(--muted); overflow-wrap: anywhere; }
.habit-sync-column small { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
.habit-sync-risks { margin-top: 12px; }
.habit-sync-risks p { margin: 5px 0; color: var(--muted); }
.habit-sync-risks .is-danger { color: var(--danger); }
.sync-status.is-success { color: var(--accent); }
.sync-status.is-danger { color: var(--danger); }
@media (max-width: 560px) {
  .habit-sync-heading { align-items: stretch; flex-direction: column; }
  .habit-sync-mode { align-self: flex-start; }
  .habit-sync-auto { align-items: stretch; flex-direction: column; }
  .habit-sync-auto .btn { width: 100%; }
  .habit-sync-comparison { grid-template-columns: 1fr; }
  .habit-sync-column { border-right: 0; border-bottom: 1px solid var(--line); }
  .habit-sync-column:last-child { border-bottom: 0; }
  .habit-sync-arm { grid-template-columns: auto minmax(0, 1fr); }
  .habit-sync-arm .btn { grid-column: 1 / -1; width: 100%; }
}
</style>
