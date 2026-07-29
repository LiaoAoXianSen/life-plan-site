<script setup lang="ts">
import { computed, reactive, ref } from 'vue';

import { createLegacyServices } from '../services/legacyServices';
import { useLifePlanStore } from '../stores/lifePlanStore';

type SyncConfig = Record<string, unknown> & { webdavUrl?: string };
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
type PreviewState = {
  status: 'idle' | 'loading' | 'missing' | 'ready' | 'error';
  local: SnapshotModel | null;
  remote: SnapshotModel | null;
  merged: SnapshotModel | null;
  hashesMatch: boolean;
  risks: SyncRisk[];
};

const props = defineProps<{ syncConfig: SyncConfig }>();
const store = useLifePlanStore();
const services = createLegacyServices();
const sync = services.sync;
const habit = services.habit;
const remotePath = '/apps/habit-app/data.json';
const busy = ref(false);
const message = ref('');
const messageTone = ref<'info' | 'success' | 'danger'>('info');
const preview = reactive<PreviewState>({ status: 'idle', local: null, remote: null, merged: null, hashesMatch: false, risks: [] });

persistConfig();

const endpointReady = computed(() => !!String(props.syncConfig.webdavUrl || '').trim());

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
  localStorage.setItem('habitAppSyncConfig', JSON.stringify({ remotePath, autoSync: false, remoteUploadEnabled: false }));
}

function setMessage(value: string, tone: 'info' | 'success' | 'danger' = 'info') {
  message.value = value;
  messageTone.value = tone;
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

async function previewRemote() {
  if (busy.value) return;
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
      setMessage('云端尚无 Habit 文件；本切片不会创建或上传。');
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
</script>

<template>
  <article class="card habit-sync-card">
    <div class="habit-sync-heading">
      <div><div class="card-title">习惯独立同步</div><span>{{ remotePath }}</span></div>
      <span class="habit-sync-mode">只读预览</span>
    </div>

    <div class="page-actions habit-sync-actions">
      <button class="btn btn-secondary" type="button" :disabled="busy || !endpointReady" @click="previewRemote">检查 Habit 云端</button>
    </div>

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
.habit-sync-actions { margin-top: 14px; }
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
  .habit-sync-comparison { grid-template-columns: 1fr; }
  .habit-sync-column { border-right: 0; border-bottom: 1px solid var(--line); }
  .habit-sync-column:last-child { border-bottom: 0; }
}
</style>
