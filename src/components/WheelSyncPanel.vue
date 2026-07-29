<script setup lang="ts">
import { computed, reactive, ref } from 'vue';

import { createLegacyServices } from '../services/legacyServices';
import { lifePlanRepository } from '../services/lifePlanRepository';
import { useLifePlanStore } from '../stores/lifePlanStore';
import type { DataEntity, LifePlanData } from '../types/lifePlan';

type SyncConfig = Record<string, unknown> & { webdavUrl?: string };
type RemotePayload = { data: unknown; hash: string; etag?: string };
type WheelSnapshot = {
  wheels: DataEntity[];
  wheelTags: DataEntity[];
  wheelLibraryItems: DataEntity[];
  wheelHistory: DataEntity[];
  deletedItems: DataEntity[];
};
type SnapshotModel = {
  snapshot: WheelSnapshot;
  hash: string;
  hashShort: string;
  etag?: string;
  counts: { wheels: number; tags: number; libraryItems: number; history: number; tombstones: number };
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
type WheelSyncState = Record<string, unknown> & {
  dirty?: boolean;
  lastLocalHash?: string;
  lastRemoteHash?: string;
  lastRemoteEtag?: string;
  lastPullAt?: string;
  lastSyncAt?: string;
  lastConflictAt?: string;
};

const props = defineProps<{ syncConfig: SyncConfig }>();
const store = useLifePlanStore();
const sync = createLegacyServices().sync;
const remotePath = '/apps/wheel-app/data.json';
const busy = ref(false);
const message = ref('');
const messageTone = ref<'info' | 'success' | 'danger'>('info');
const preview = reactive<PreviewState>({ status: 'idle', local: null, remote: null, merged: null, hashesMatch: false, risks: [] });
const syncState = reactive<WheelSyncState>(readJson('lifePlanWheelSyncState'));

persistConfig();

const endpointReady = computed(() => !!String(props.syncConfig.webdavUrl || '').trim());
const hasDangerRisk = computed(() => preview.risks.some(item => item.severity === 'danger'));
const canApply = computed(() => preview.status === 'ready' && !preview.hashesMatch && !!preview.merged && !hasDangerRisk.value && !busy.value);

function readJson(key: string): Record<string, unknown> {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

function persistConfig() {
  localStorage.setItem('lifePlanWheelSyncConfig', JSON.stringify({ remotePath, autoSync: false, remoteUploadEnabled: false }));
}

function updateSyncState(patch: WheelSyncState) {
  Object.assign(syncState, patch);
  localStorage.setItem('lifePlanWheelSyncState', JSON.stringify(syncState));
}

function setMessage(value: string, tone: 'info' | 'success' | 'danger' = 'info') {
  message.value = value;
  messageTone.value = tone;
}

function wheelHash(value: unknown) {
  return sync.getWheelDataHash(canonical(value));
}

function canonical(value: unknown): WheelSnapshot {
  return sync.getWheelSnapshot(value) as WheelSnapshot;
}

function model(value: unknown, hash = '', etag = ''): SnapshotModel {
  const snapshot = canonical(value);
  const resolvedHash = hash || wheelHash(snapshot);
  return {
    snapshot,
    hash: resolvedHash,
    hashShort: resolvedHash.slice(0, 12),
    ...(etag ? { etag } : {}),
    counts: {
      wheels: snapshot.wheels.length,
      tags: snapshot.wheelTags.length,
      libraryItems: snapshot.wheelLibraryItems.length,
      history: snapshot.wheelHistory.length,
      tombstones: snapshot.deletedItems.length,
    },
  };
}

function schemaRisks(value: unknown): SyncRisk[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [{ severity: 'danger', message: '云端 Wheel schema 不是对象。' }];
  const source = value as Record<string, unknown>;
  const risks: SyncRisk[] = [];
  (['wheels', 'wheelTags', 'wheelLibraryItems', 'wheelHistory'] as const).forEach(key => {
    if (!Array.isArray(source[key])) risks.push({ severity: 'danger', message: `云端缺少有效的 ${key} 数组。` });
  });
  if (!Array.isArray(source.deletedItems)) risks.push({ severity: 'warning', message: '云端缺少有效的 deletedItems 数组，将按空删除标记预览。' });
  return risks;
}

function prepareLocal() {
  const local = model(store.data);
  if (store.data.wheels.some(item => !String(item.id || '').trim())) throw new Error('本地存在缺少稳定 ID 的转盘。');
  return local;
}

async function pullRemote(): Promise<RemotePayload | null> {
  return await sync.pullJson(
    { ...props.syncConfig, remotePath },
    remotePath,
    (value: unknown) => canonical(value),
    (value: unknown) => wheelHash(value),
  ) as RemotePayload | null;
}

function setReadyPreview(local: SnapshotModel, remotePayload: RemotePayload) {
  const remote = model(remotePayload.data, remotePayload.hash, remotePayload.etag || '');
  const merged = model(sync.mergeWheelSnapshots(local.snapshot, remote.snapshot));
  Object.assign(preview, {
    status: 'ready', local, remote, merged, hashesMatch: local.hash === remote.hash, risks: schemaRisks(remotePayload.data),
  });
  return { remote, merged };
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
  setMessage('正在检查 Wheel 云端文件...');
  try {
    const local = prepareLocal();
    preview.local = local;
    const remotePayload = await pullRemote();
    if (!remotePayload) {
      Object.assign(preview, { status: 'missing', local, remote: null, merged: null, hashesMatch: false, risks: [] });
      setMessage('云端 Wheel 文件不存在；本阶段只做预览/应用，不创建云端文件。');
      return;
    }
    const { remote } = setReadyPreview(local, remotePayload);
    const stamp = new Date().toISOString();
    updateSyncState({ lastPullAt: stamp, lastRemoteHash: remote.hash, lastRemoteEtag: remote.etag || '' });
    setMessage(preview.hashesMatch ? '本机与 Wheel 云端一致。' : '已生成本机、云端与合并结果预览。', preview.hashesMatch ? 'success' : 'info');
  } catch (error) {
    preview.status = 'error';
    setMessage(error instanceof Error ? error.message : String(error), 'danger');
  } finally {
    busy.value = false;
  }
}

function applySnapshot(snapshot: WheelSnapshot) {
  const next = JSON.parse(JSON.stringify(store.data)) as LifePlanData;
  next.wheels = snapshot.wheels.map(item => ({ ...item }));
  next.wheelTags = snapshot.wheelTags.map(item => ({ ...item }));
  next.wheelLibraryItems = snapshot.wheelLibraryItems.map(item => ({ ...item }));
  next.wheelHistory = snapshot.wheelHistory.map(item => ({ ...item }));
  next.deletedItems = [
    ...next.deletedItems.filter(item => !['wheels', 'wheelTags', 'wheelLibraryItems', 'wheelHistory', 'wheelItems'].includes(String(item.collection || ''))),
    ...snapshot.deletedItems.map(item => ({ ...item })),
  ];
  store.replace(next, 'wheel-cloud-apply', 'user');
}

async function applyRemoteMerge() {
  if (!canApply.value || !preview.remote || !preview.merged) return;
  busy.value = true;
  setMessage('正在复查云端 Wheel 版本...');
  try {
    const expectedRemoteHash = preview.remote.hash;
    const expectedMergedHash = preview.merged.hash;
    const local = prepareLocal();
    const remotePayload = await pullRemote();
    if (!remotePayload) throw new Error('复查时云端 Wheel 文件不存在，已停止应用。');
    const { remote, merged } = setReadyPreview(local, remotePayload);
    if (remote.hash !== expectedRemoteHash) {
      updateSyncState({ lastConflictAt: new Date().toISOString(), lastRemoteHash: remote.hash, lastRemoteEtag: remote.etag || '' });
      setMessage('云端自预览后已变化，已刷新预览但没有写入本机。', 'danger');
      return;
    }
    if (merged.hash !== expectedMergedHash) {
      setMessage('本机自预览后已变化，已刷新合并结果但没有写入本机。', 'danger');
      return;
    }
    if (hasDangerRisk.value) throw new Error('云端 schema 风险阻止应用。');
    if (!window.confirm(`将 ${merged.counts.wheels} 个转盘、${merged.counts.libraryItems} 个公共项的合并结果应用到本机，并创建应用前快照。确认继续吗？`)) {
      setMessage('已取消应用；本机数据未改变。');
      return;
    }
    const beforeSnapshot = lifePlanRepository.createSnapshot('应用 Wheel 云端合并结果前', store.data, {
      action: 'before-wheel-cloud-apply', source: 'vue-wheel-sync', mergedWith: { label: 'Wheel 云端', hash: remote.hash },
    });
    if (!beforeSnapshot && !window.confirm('应用前快照创建失败。继续将缺少回滚点，仍要应用吗？')) {
      setMessage('快照未创建，已取消应用；本机数据未改变。', 'danger');
      return;
    }
    applySnapshot(merged.snapshot);
    const stamp = new Date().toISOString();
    updateSyncState({
      dirty: merged.hash !== remote.hash,
      lastLocalHash: wheelHash(store.data),
      lastRemoteHash: remote.hash,
      lastRemoteEtag: remote.etag || '',
      lastPullAt: stamp,
      lastSyncAt: stamp,
    });
    const nextLocal = model(store.data);
    Object.assign(preview, { status: 'ready', local: nextLocal, remote, merged: nextLocal, hashesMatch: nextLocal.hash === remote.hash, risks: [] });
    setMessage('Wheel 合并结果已应用到本机；云端未写入。', 'success');
  } catch (error) {
    setMessage(error instanceof Error ? error.message : String(error), 'danger');
  } finally {
    busy.value = false;
    persistConfig();
  }
}
</script>

<template>
  <article class="card wheel-sync-card">
    <div class="wheel-sync-heading">
      <div><div class="card-title">转盘独立同步</div><span>{{ remotePath }}</span></div>
      <span class="wheel-sync-mode">预览/应用阶段</span>
    </div>

    <div class="page-actions wheel-sync-actions">
      <button class="btn btn-secondary" type="button" :disabled="busy || !endpointReady" @click="previewRemote">检查 Wheel 云端</button>
      <button v-if="preview.status === 'ready'" class="btn btn-primary" type="button" :disabled="!canApply" @click="applyRemoteMerge">应用合并到本机</button>
    </div>

    <div v-if="preview.local" class="wheel-sync-comparison">
      <div v-for="item in [{ label: '本机', value: preview.local }, { label: '云端', value: preview.remote }, { label: '合并', value: preview.merged }]" :key="item.label" class="wheel-sync-column">
        <strong>{{ item.label }}</strong>
        <template v-if="item.value">
          <span>{{ item.value.counts.wheels }} 盘 · 标签 {{ item.value.counts.tags }} · 公共项 {{ item.value.counts.libraryItems }}</span>
          <small>{{ item.value.hashShort }}</small>
        </template>
        <span v-else>{{ preview.status === 'missing' && item.label === '云端' ? '不存在' : '-' }}</span>
      </div>
    </div>

    <div v-if="preview.risks.length" class="wheel-sync-risks">
      <p v-for="risk in preview.risks" :key="risk.message" :class="`is-${risk.severity}`">{{ risk.message }}</p>
    </div>
    <p v-if="message" class="sync-status active" :class="`is-${messageTone}`" role="status">{{ message }}</p>
  </article>
</template>

<style scoped>
.wheel-sync-card { margin-top: 18px; }
.wheel-sync-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.wheel-sync-heading span { color: var(--faint); font-size: 12px; overflow-wrap: anywhere; }
.wheel-sync-mode { padding: 5px 8px; border: 1px solid var(--line); border-radius: 6px; white-space: nowrap; }
.wheel-sync-actions { margin-top: 14px; }
.wheel-sync-comparison { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 16px; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.wheel-sync-column { display: grid; gap: 4px; min-width: 0; padding: 12px; border-right: 1px solid var(--line); }
.wheel-sync-column:last-child { border-right: 0; }
.wheel-sync-column strong { font-size: 13px; }
.wheel-sync-column span, .wheel-sync-column small { color: var(--muted); overflow-wrap: anywhere; }
.wheel-sync-column small { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
.wheel-sync-risks { margin-top: 12px; }
.wheel-sync-risks p { margin: 5px 0; color: var(--muted); }
.wheel-sync-risks .is-danger { color: var(--danger); }
.sync-status.is-success { color: var(--accent); }
.sync-status.is-danger { color: var(--danger); }
@media (max-width: 560px) {
  .wheel-sync-heading { align-items: stretch; flex-direction: column; }
  .wheel-sync-mode { align-self: flex-start; }
  .wheel-sync-comparison { grid-template-columns: 1fr; }
  .wheel-sync-column { border-right: 0; border-bottom: 1px solid var(--line); }
  .wheel-sync-column:last-child { border-bottom: 0; }
}
</style>
