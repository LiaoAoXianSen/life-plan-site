<script setup lang="ts">
import { computed, reactive, ref } from 'vue';

import SyncResourcePanel from './common/SyncResourcePanel.vue';

import { createLegacyServices } from '../services/legacyServices';
import { lifePlanRepository } from '../services/lifePlanRepository';
import { getTodoSyncConfig, runTodoCloudSyncBoth, saveTodoSyncConfig } from '../services/todoCloudSync';
import { useLifePlanStore } from '../stores/lifePlanStore';
import type { DataEntity, LifePlanData, Todo } from '../types/lifePlan';

type SyncConfig = Record<string, unknown> & { webdavUrl?: string; useAppSyncKitProvider?: boolean };
type TodoSnapshot = { schemaVersion?: number; generatedAt?: string; todos: Todo[]; deletedItems: DataEntity[] };
type RemotePayload = { data: unknown; hash: string; etag?: string };
type SnapshotModel = {
  snapshot: TodoSnapshot;
  hash: string;
  hashShort: string;
  etag?: string;
  counts: { todos: number; openTodos: number; doneTodos: number; tombstones: number };
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
type TodoSyncConfig = { remotePath: string; autoSync: boolean; remoteUploadEnabled: false; autoSyncUserEnabled?: boolean };

const props = defineProps<{ syncConfig: SyncConfig }>();
const store = useLifePlanStore();
const services = createLegacyServices();
const sync = services.sync;
const todos = services.todos;
const remotePath = '/apps/todo-app/data.json';
const busy = ref(false);
const armed = ref(false);
const message = ref('');
const messageTone = ref<'info' | 'success' | 'danger'>('info');
const preview = reactive<PreviewState>({ status: 'idle', local: null, remote: null, merged: null, hashesMatch: false, risks: [] });
const syncState = reactive<TodoSyncState>(readJson('todoAppSyncState'));
const autoConfig = reactive<TodoSyncConfig>(getTodoSyncConfig());

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
  Object.assign(autoConfig, saveTodoSyncConfig({ autoSync: autoConfig.autoSync }));
}

function updateSyncState(patch: TodoSyncState) {
  Object.assign(syncState, patch);
  localStorage.setItem('todoAppSyncState', JSON.stringify(syncState));
}

function setMessage(value: string, tone: 'info' | 'success' | 'danger' = 'info') {
  message.value = value;
  messageTone.value = tone;
}

function saveAutoSyncConfig() {
  persistConfig();
  setMessage(autoConfig.autoSync ? 'Todo 自动同步已启用；仍不会后台首次创建云端文件。' : 'Todo 自动同步已关闭。', 'success');
}

async function runAutoSyncNow() {
  if (busy.value || !endpointReady.value) return;
  busy.value = true;
  setMessage('正在执行 Todo 自动同步流程...');
  try {
    const result = await runTodoCloudSyncBoth({ force: true, source: 'todo-panel-auto-now' });
    if ('skipped' in result && result.skipped) {
      setMessage(result.reason === 'missing-remote' ? 'Todo 云端文件不存在；自动同步不会后台首次创建。' : 'Todo 自动同步已跳过。');
      return;
    }
    setMessage('Todo 自动同步流程已执行。', 'success');
  } catch (error) {
    setMessage(error instanceof Error ? error.message : String(error), 'danger');
  } finally {
    busy.value = false;
    persistConfig();
  }
}

function todoHash(value: unknown) {
  return sync.getDataHash(todos.getTodoAppHashPayload(value));
}

function canonical(value: unknown): TodoSnapshot {
  return todos.getTodoAppCanonicalSnapshot(value) as TodoSnapshot;
}

function model(value: unknown, hash = '', etag = ''): SnapshotModel {
  const snapshot = canonical(value);
  const summary = todos.getTodoSnapshotCollectionSummary(snapshot) as Record<string, number>;
  const resolvedHash = hash || todoHash(snapshot);
  return {
    snapshot,
    hash: resolvedHash,
    hashShort: resolvedHash.slice(0, 12),
    ...(etag ? { etag } : {}),
    counts: {
      todos: summary.todos || 0,
      openTodos: summary.openTodos || 0,
      doneTodos: summary.doneTodos || 0,
      tombstones: summary.deletedItems || 0,
    },
  };
}

function schemaRisks(value: unknown): SyncRisk[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [{ severity: 'danger', message: '云端 todo schema 不是对象。' }];
  const source = value as Record<string, unknown>;
  const risks: SyncRisk[] = [];
  if (!Array.isArray(source.todos)) risks.push({ severity: 'danger', message: '云端缺少有效的 todos 数组。' });
  if (!Array.isArray(source.deletedItems)) risks.push({ severity: 'warning', message: '云端缺少有效的 deletedItems 数组，将按空删除标记预览。' });
  return risks;
}

function setReadyPreview(local: SnapshotModel, remotePayload: RemotePayload) {
  const remote = model(remotePayload.data, remotePayload.hash, remotePayload.etag || '');
  const merged = model(todos.mergeTodoSnapshots(local.snapshot, remote.snapshot));
  Object.assign(preview, {
    status: 'ready', local, remote, merged, hashesMatch: local.hash === remote.hash, risks: schemaRisks(remotePayload.data),
  });
  return { remote, merged };
}

function prepareLocal(reason: string) {
  const mirror = lifePlanRepository.rebuildTodoMirror(store.data, reason);
  const sourceHash = lifePlanRepository.getTodoSourceHash(store.data);
  const consistency = todos.buildTodoDualWriteConsistency(store.data, mirror, sourceHash) as { status?: string; mismatches?: string[] };
  if (consistency.status !== 'matched' || consistency.mismatches?.length) {
    throw new Error(`本地 Todo 镜像不一致：${consistency.mismatches?.join('；') || consistency.status || 'unknown'}`);
  }
  if (store.data.todos.some(item => !String(item.id || '').trim())) throw new Error('本地存在缺少稳定 ID 的待办。');
  if (store.data.deletedItems.some(item => item.collection === 'todos' && (!String(item.id || '').trim() || !String(item.deletedAt || '').trim()))) {
    throw new Error('本地存在无法规范化的 Todo 删除标记。');
  }
  return { sourceHash, local: model(mirror) };
}

async function pullRemote(): Promise<RemotePayload | null> {
  return await sync.pullJson(
    { ...props.syncConfig, remotePath },
    remotePath,
    (value: unknown) => value,
    (value: unknown) => todoHash(value),
  ) as RemotePayload | null;
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
  setMessage('正在检查 Todo 云端文件...');
  try {
    const { local } = prepareLocal('todo-remote-preview');
    preview.local = local;
    const remotePayload = await pullRemote();
    if (!remotePayload) {
      Object.assign(preview, { status: 'missing', local, remote: null, merged: null, hashesMatch: false, risks: [] });
      setMessage('云端 Todo 文件不存在。首次创建需要本次会话授权。');
      return;
    }
    const { remote } = setReadyPreview(local, remotePayload);
    const stamp = new Date().toISOString();
    updateSyncState({ lastPullAt: stamp, lastRemoteHash: remote.hash, lastRemoteEtag: remote.etag || '' });
    setMessage(preview.hashesMatch ? '本机与 Todo 云端一致。' : '已生成本机、云端与合并结果预览。', preview.hashesMatch ? 'success' : 'info');
  } catch (error) {
    preview.status = 'error';
    setMessage(error instanceof Error ? error.message : String(error), 'danger');
  } finally {
    busy.value = false;
  }
}

function applySnapshot(snapshot: TodoSnapshot) {
  const next = JSON.parse(JSON.stringify(store.data)) as LifePlanData;
  next.todos = snapshot.todos.map(item => ({ ...item }));
  next.deletedItems = [
    ...next.deletedItems.filter(item => item.collection !== 'todos'),
    ...snapshot.deletedItems.map(item => ({ ...item })),
  ];
  // The independent Todo remote changes authoritative lifePlanData, so the
  // main /life-plan.json channel must see this as a new local change.
  store.replace(next, 'todo-cloud-apply', 'user');
}

async function applyRemoteMerge() {
  if (!canApply.value || !preview.remote || !preview.merged) return;
  busy.value = true;
  setMessage('正在复查云端 Todo 版本...');
  try {
    const expectedRemoteHash = preview.remote.hash;
    const expectedMergedHash = preview.merged.hash;
    const { local } = prepareLocal('todo-cloud-apply-preflight');
    const remotePayload = await pullRemote();
    if (!remotePayload) throw new Error('复查时云端 Todo 文件不存在，已停止应用。');
    const { remote, merged } = setReadyPreview(local, remotePayload);
    if (remote.hash !== expectedRemoteHash) {
      setMessage('云端自预览后已变化，已刷新预览但没有写入本机。', 'danger');
      return;
    }
    if (merged.hash !== expectedMergedHash) {
      setMessage('本机自预览后已变化，已刷新合并结果但没有写入本机。', 'danger');
      return;
    }
    if (hasDangerRisk.value) throw new Error('云端 schema 风险阻止应用。');
    if (!window.confirm(`将 ${merged.counts.todos} 条合并待办应用到本机，并创建应用前快照。确认继续吗？`)) {
      setMessage('已取消应用；本机数据未改变。');
      return;
    }
    const beforeSnapshot = lifePlanRepository.createSnapshot('应用 Todo 云端合并结果前', store.data, {
      action: 'before-todo-cloud-apply', source: 'vue-todo-sync', mergedWith: { label: 'Todo 云端', hash: remote.hash },
    });
    if (!beforeSnapshot && !window.confirm('应用前快照创建失败。继续将缺少回滚点，仍要应用吗？')) {
      setMessage('快照未创建，已取消应用；本机数据未改变。', 'danger');
      return;
    }
    applySnapshot(merged.snapshot);
    const stamp = new Date().toISOString();
    updateSyncState({
      dirty: merged.hash !== remote.hash,
      lastLocalHash: lifePlanRepository.getTodoSourceHash(store.data),
      lastRemoteHash: remote.hash,
      lastRemoteEtag: remote.etag || '',
      lastPullAt: stamp,
      lastSyncAt: stamp,
    });
    preview.local = model(localStorage.getItem('todoAppData') ? JSON.parse(localStorage.getItem('todoAppData')!) : merged.snapshot);
    preview.merged = preview.local;
    preview.hashesMatch = preview.local.hash === remote.hash;
    setMessage('Todo 合并结果已应用到本机；云端未写入。', 'success');
  } catch (error) {
    setMessage(error instanceof Error ? error.message : String(error), 'danger');
  } finally {
    busy.value = false;
  }
}

function verifyLocalUnchanged(sourceHash: string, localHash: string) {
  const liveSourceHash = lifePlanRepository.getTodoSourceHash(store.data);
  const rawMirror = localStorage.getItem('todoAppData');
  const liveMirrorHash = rawMirror ? todoHash(JSON.parse(rawMirror)) : '';
  return liveSourceHash === sourceHash && liveMirrorHash === localHash;
}

async function verifyUpload(local: SnapshotModel) {
  const verification = await pullRemote();
  if (!verification || verification.hash !== local.hash) throw new Error('上传后回读的 Todo hash 不一致。');
  return verification;
}

function finishUpload(local: SnapshotModel, verification: RemotePayload, fallbackEtag = '') {
  const stamp = new Date().toISOString();
  updateSyncState({
    dirty: false,
    lastLocalHash: lifePlanRepository.getTodoSourceHash(store.data),
    lastRemoteHash: local.hash,
    lastRemoteEtag: verification.etag || fallbackEtag,
    lastPushAt: stamp,
    lastSyncAt: stamp,
  });
  Object.assign(preview, { status: 'ready', local, remote: { ...local, etag: verification.etag || fallbackEtag }, merged: local, hashesMatch: true, risks: [] });
}

async function uploadExisting() {
  if (!canUploadExisting.value || busy.value) return;
  if (props.syncConfig.useAppSyncKitProvider) {
    setMessage('当前 provider 不支持 If-Match 条件写入。', 'danger');
    return;
  }
  busy.value = true;
  let putAttempted = false;
  setMessage('正在复查本机镜像与云端基线...');
  try {
    const { sourceHash, local } = prepareLocal('todo-existing-upload-preflight');
    const remotePayload = await pullRemote();
    if (!remotePayload) {
      Object.assign(preview, { status: 'missing', local, remote: null, merged: null, hashesMatch: false, risks: [] });
      throw new Error('云端文件已不存在，请重新检查并走首次创建。');
    }
    const { remote } = setReadyPreview(local, remotePayload);
    if (hasDangerRisk.value) throw new Error('云端 schema 风险阻止上传。');
    if (local.hash === remote.hash) {
      finishUpload(local, remotePayload, remote.etag || '');
      setMessage('本机与 Todo 云端已一致，未发送 PUT。', 'success');
      return;
    }
    if (!syncState.lastRemoteHash || remote.hash !== syncState.lastRemoteHash) {
      updateSyncState({ lastConflictAt: new Date().toISOString() });
      throw new Error('云端自上次检查后已变化，已停止上传并刷新预览。');
    }
    if (!remote.etag) throw new Error('云端响应没有 ETag，无法安全上传。');
    if (!window.confirm(`使用 If-Match ${remote.etag} 将本机 Todo 镜像写入云端。确认继续吗？`)) {
      setMessage('已取消上传；云端未改变。');
      return;
    }
    if (!verifyLocalUnchanged(sourceHash, local.hash)) throw new Error('确认期间本机 Todo 数据已变化，请重新检查。');
    putAttempted = true;
    const result = await sync.pushJson(
      { ...props.syncConfig, remotePath }, remotePath, local.snapshot, 'todo-app', { ifMatch: remote.etag },
    ) as { etag?: string };
    const verification = await verifyUpload(local);
    finishUpload(local, verification, result.etag || remote.etag);
    setMessage('Todo 云端已条件写入并回读核验一致。', 'success');
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
  setMessage('正在执行首次创建前复查...');
  try {
    const { sourceHash, local } = prepareLocal('todo-first-upload-preflight');
    const remotePayload = await pullRemote();
    if (remotePayload) {
      setReadyPreview(local, remotePayload);
      throw new Error('最终复查发现云端文件已存在，已停止首次创建。');
    }
    if (!window.confirm(`以 create-only 条件创建 ${remotePath}，包含 ${local.counts.todos} 条待办。确认继续吗？`)) {
      setMessage('已取消首次创建；云端未改变。');
      return;
    }
    if (!verifyLocalUnchanged(sourceHash, local.hash)) throw new Error('确认期间本机 Todo 数据已变化，请重新检查。');
    putAttempted = true;
    const result = await sync.pushJson(
      { ...props.syncConfig, remotePath }, remotePath, local.snapshot, 'todo-app', { ifNoneMatch: '*' },
    ) as { etag?: string };
    const verification = await verifyUpload(local);
    finishUpload(local, verification, result.etag || '');
    setMessage('Todo 云端文件已首次创建并回读核验一致。', 'success');
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
  <SyncResourcePanel root-class="todo-sync-card" title="待办独立同步" :remote-path="remotePath" :mode-label="autoConfig.autoSync ? '自动同步开启' : '自动同步关闭'" resource-label="Todo" auto-label="启用待办自动同步" run-label="立即同步一次" :status="preview.status" :busy="busy" :auto-busy="busy" :endpoint-ready="endpointReady" :auto-sync-enabled="autoConfig.autoSync" :armed="armed" :can-apply="canApply" :can-upload="canUploadExisting" :message="message" :message-tone="messageTone" @update:auto-sync-enabled="autoConfig.autoSync = $event" @update:armed="armed = $event" @save-auto-sync="saveAutoSyncConfig" @run-auto-sync="runAutoSyncNow" @preview="previewRemote" @apply="applyRemoteMerge" @upload="uploadExisting" @create="uploadFirst">
    <template #preview>
      <div v-if="preview.local" class="sync-resource-comparison">
        <div v-for="item in [{ label: '本机', value: preview.local }, { label: '云端', value: preview.remote }, { label: '合并', value: preview.merged }]" :key="item.label" class="sync-resource-column">
          <strong>{{ item.label }}</strong><template v-if="item.value"><span>{{ item.value.counts.todos }} 条 · 未完成 {{ item.value.counts.openTodos }}</span><small>{{ item.value.hashShort }}</small></template>
          <span v-else>{{ preview.status === 'missing' && item.label === '云端' ? '不存在' : '-' }}</span>
        </div>
      </div>
    </template>
    <template #risks><div v-if="preview.risks.length" class="sync-resource-risks"><p v-for="risk in preview.risks" :key="risk.message" :class="`is-${risk.severity}`">{{ risk.message }}</p></div></template>
  </SyncResourcePanel>
</template>
