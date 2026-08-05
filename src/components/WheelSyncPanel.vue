<script setup lang="ts">
import { computed, reactive, ref } from 'vue';

import SyncResourcePanel from './common/SyncResourcePanel.vue';

import { createLegacyServices } from '../services/legacyServices';
import { lifePlanRepository } from '../services/lifePlanRepository';
import { getWheelSyncConfig, saveWheelSyncConfig } from '../services/wheelCloudSync';
import { useLifePlanStore } from '../stores/lifePlanStore';
import type { DataEntity, LifePlanData } from '../types/lifePlan';

type SyncConfig = Record<string, unknown> & { webdavUrl?: string; useAppSyncKitProvider?: boolean };
type RunAutoSync = () => Promise<unknown>;
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
  lastPushAt?: string;
  lastSyncAt?: string;
  lastConflictAt?: string;
};

const props = defineProps<{ syncConfig: SyncConfig; runAutoSync?: RunAutoSync; restartAutoSync?: () => void }>();
const store = useLifePlanStore();
const sync = createLegacyServices().sync;
const remotePath = '/apps/wheel-app/data.json';
const busy = ref(false);
const autoBusy = ref(false);
const armed = ref(false);
const autoSyncEnabled = ref(getWheelSyncConfig().autoSync === true);
const message = ref('');
const messageTone = ref<'info' | 'success' | 'danger'>('info');
const preview = reactive<PreviewState>({ status: 'idle', local: null, remote: null, merged: null, hashesMatch: false, risks: [] });
const syncState = reactive<WheelSyncState>(readJson('lifePlanWheelSyncState'));

persistConfig();

const endpointReady = computed(() => !!String(props.syncConfig.webdavUrl || '').trim());
const hasDangerRisk = computed(() => preview.risks.some(item => item.severity === 'danger'));
const canApply = computed(() => preview.status === 'ready' && !preview.hashesMatch && !!preview.merged && !hasDangerRisk.value && !busy.value);
const canUploadExisting = computed(() => preview.status === 'ready' && !preview.hashesMatch && !hasDangerRisk.value && !busy.value);

function readJson(key: string): Record<string, unknown> {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

function persistConfig() {
  saveWheelSyncConfig({ autoSync: autoSyncEnabled.value });
}

function updateSyncState(patch: WheelSyncState) {
  Object.assign(syncState, patch);
  localStorage.setItem('lifePlanWheelSyncState', JSON.stringify(syncState));
}

function setMessage(value: string, tone: 'info' | 'success' | 'danger' = 'info') {
  message.value = value;
  messageTone.value = tone;
}

function saveAutoSyncSetting() {
  persistConfig();
  props.restartAutoSync?.();
  setMessage(autoSyncEnabled.value
    ? 'Wheel 条件自动同步已启用；仅同步已存在的云端文件，不会后台首次创建。'
    : 'Wheel 条件自动同步已关闭。', autoSyncEnabled.value ? 'success' : 'info');
}

async function runAutoSyncNow() {
  if (!props.runAutoSync || autoBusy.value) return;
  autoBusy.value = true;
  setMessage('正在执行一次 Wheel 条件自动同步...');
  try {
    await props.runAutoSync();
    setMessage('已执行一次 Wheel 条件自动同步。', 'success');
  } catch (error) {
    setMessage(error instanceof Error ? error.message : String(error), 'danger');
  } finally {
    autoBusy.value = false;
    autoSyncEnabled.value = getWheelSyncConfig().autoSync === true;
  }
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
  armed.value = false;
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
      setMessage('云端 Wheel 文件不存在。首次创建需要本次会话授权。');
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

function verifyLocalUnchanged(localHash: string) {
  return wheelHash(store.data) === localHash;
}

async function verifyUpload(local: SnapshotModel) {
  const verification = await pullRemote();
  if (!verification || verification.hash !== local.hash) throw new Error('上传后回读的 Wheel hash 不一致。');
  return verification;
}

function finishUpload(local: SnapshotModel, verification: RemotePayload, fallbackEtag = '') {
  const stamp = new Date().toISOString();
  updateSyncState({
    dirty: false,
    lastLocalHash: wheelHash(store.data),
    lastRemoteHash: local.hash,
    lastRemoteEtag: verification.etag || fallbackEtag,
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

async function uploadExisting() {
  if (!canUploadExisting.value || busy.value) return;
  if (props.syncConfig.useAppSyncKitProvider) {
    setMessage('当前 provider 不支持 If-Match 条件写入。', 'danger');
    return;
  }
  busy.value = true;
  let putAttempted = false;
  setMessage('正在复查本机 Wheel 快照与云端基线...');
  try {
    const local = prepareLocal();
    const remotePayload = await pullRemote();
    if (!remotePayload) {
      Object.assign(preview, { status: 'missing', local, remote: null, merged: null, hashesMatch: false, risks: [] });
      throw new Error('云端文件已不存在，请重新检查并走首次创建。');
    }
    const { remote } = setReadyPreview(local, remotePayload);
    if (hasDangerRisk.value) throw new Error('云端 schema 风险阻止上传。');
    if (local.hash === remote.hash) {
      finishUpload(local, remotePayload, remote.etag || '');
      setMessage('本机与 Wheel 云端已一致，未发送 PUT。', 'success');
      return;
    }
    if (!syncState.lastRemoteHash || remote.hash !== syncState.lastRemoteHash) {
      updateSyncState({ lastConflictAt: new Date().toISOString(), lastRemoteHash: remote.hash, lastRemoteEtag: remote.etag || '' });
      throw new Error('云端自上次检查后已变化，已停止上传并刷新预览。');
    }
    if (!remote.etag) throw new Error('云端响应没有 ETag，无法安全上传。');
    if (!window.confirm(`使用 If-Match ${remote.etag} 将本机 Wheel 快照写入云端。确认继续吗？`)) {
      setMessage('已取消上传；云端未改变。');
      return;
    }
    if (!verifyLocalUnchanged(local.hash)) throw new Error('确认期间本机 Wheel 数据已变化，请重新检查。');
    putAttempted = true;
    const result = await sync.pushJson(
      { ...props.syncConfig, remotePath }, remotePath, local.snapshot, 'wheel-app', { ifMatch: remote.etag },
    ) as { etag?: string };
    const verification = await verifyUpload(local);
    finishUpload(local, verification, result.etag || remote.etag);
    setMessage('Wheel 云端已条件写入并回读核验一致。', 'success');
  } catch (error) {
    const status = typeof error === 'object' && error !== null ? (error as { status?: number }).status : undefined;
    setMessage(status === 412
      ? 'If-Match 被拒绝：云端版本已变化，未发生覆盖。'
      : putAttempted
        ? `PUT 已发出但无法确认结果：${error instanceof Error ? error.message : String(error)}。不会自动重试。`
        : error instanceof Error ? error.message : String(error), 'danger');
  } finally {
    busy.value = false;
    armed.value = false;
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
  setMessage('正在执行 Wheel 首次创建前复查...');
  try {
    const local = prepareLocal();
    const remotePayload = await pullRemote();
    if (remotePayload) {
      setReadyPreview(local, remotePayload);
      throw new Error('最终复查发现云端文件已存在，已停止首次创建。');
    }
    if (!window.confirm(`以 create-only 条件创建 ${remotePath}，包含 ${local.counts.wheels} 个转盘和 ${local.counts.libraryItems} 个公共项。确认继续吗？`)) {
      setMessage('已取消首次创建；云端未改变。');
      return;
    }
    if (!verifyLocalUnchanged(local.hash)) throw new Error('确认期间本机 Wheel 数据已变化，请重新检查。');
    putAttempted = true;
    const result = await sync.pushJson(
      { ...props.syncConfig, remotePath }, remotePath, local.snapshot, 'wheel-app', { ifNoneMatch: '*' },
    ) as { etag?: string };
    const verification = await verifyUpload(local);
    finishUpload(local, verification, result.etag || '');
    setMessage('Wheel 云端文件已首次创建并回读核验一致。', 'success');
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
  <SyncResourcePanel root-class="wheel-sync-card" title="转盘独立同步" :remote-path="remotePath" :mode-label="'预览/应用/条件自动'" resource-label="Wheel" auto-label="启用 Wheel 条件自动同步" run-label="立即自动同步一次" :status="preview.status" :busy="busy" :auto-busy="autoBusy" :endpoint-ready="endpointReady" :auto-sync-enabled="autoSyncEnabled" :armed="armed" :can-apply="canApply" :can-upload="canUploadExisting" :message="message" :message-tone="messageTone" @update:auto-sync-enabled="autoSyncEnabled = $event" @update:armed="armed = $event" @save-auto-sync="saveAutoSyncSetting" @run-auto-sync="runAutoSyncNow" @preview="previewRemote" @apply="applyRemoteMerge" @upload="uploadExisting" @create="uploadFirst">
    <template #preview>
      <div v-if="preview.local" class="sync-resource-comparison">
        <div v-for="item in [{ label: '本机', value: preview.local }, { label: '云端', value: preview.remote }, { label: '合并', value: preview.merged }]" :key="item.label" class="sync-resource-column">
          <strong>{{ item.label }}</strong><template v-if="item.value"><span>{{ item.value.counts.wheels }} 盘 · 标签 {{ item.value.counts.tags }} · 公共项 {{ item.value.counts.libraryItems }}</span><small>{{ item.value.hashShort }}</small></template>
          <span v-else>{{ preview.status === 'missing' && item.label === '云端' ? '不存在' : '-' }}</span>
        </div>
      </div>
    </template>
    <template #risks><div v-if="preview.risks.length" class="sync-resource-risks"><p v-for="risk in preview.risks" :key="risk.message" :class="`is-${risk.severity}`">{{ risk.message }}</p></div></template>
  </SyncResourcePanel>
</template>
