<script setup lang="ts">
import StatusBanner from '../components/common/StatusBanner.vue';
import { reactive, ref } from 'vue';

import HabitSyncPanel from '../components/HabitSyncPanel.vue';
import TodoSyncPanel from '../components/TodoSyncPanel.vue';
import WheelSyncPanel from '../components/WheelSyncPanel.vue';
import { bindHabitCloudSync, runHabitCloudSyncBoth, startHabitAutoSyncEngine } from '../services/habitCloudSync';
import { createLegacyServices } from '../services/legacyServices';
import { lifePlanRepository } from '../services/lifePlanRepository';
import { bindMainCloudSync, getMainSyncConfig, runMainCloudSyncBoth, saveMainSyncConfig, startMainAutoSyncEngine } from '../services/mainCloudSync';
import { startTodoAutoSyncEngine } from '../services/todoCloudSync';
import { bindWheelCloudSync, runWheelCloudSyncBoth, startWheelAutoSyncEngine } from '../services/wheelCloudSync';
import { useLifePlanStore } from '../stores/lifePlanStore';

type SyncState = Record<string, unknown> & {
  dirty?: boolean;
  lastRemoteHash?: string;
  lastRemoteEtag?: string;
  lastPullAt?: string;
  lastPushAt?: string;
  lastSyncAt?: string;
  lastConflictAt?: string;
};

type RemotePayload = { data: unknown; hash: string; etag?: string };

const props = withDefaults(defineProps<{ embedded?: boolean }>(), { embedded: false });
const emit = defineEmits<{ close: [] }>();
const store = useLifePlanStore();
const sync = createLegacyServices().sync;
const config = reactive(getMainSyncConfig());
const status = ref('');
function configStatusHint() {
  return config.webdavUrl ? '已加载云同步配置' : '未配置云同步';
}
const autoStatus = ref(configStatusHint());
const busy = ref(false);

bindMainCloudSync({
  getData: () => store.data,
  replaceData: (next, reason) => store.replace(next, reason, 'sync'),
  onStatus: (message, isError) => {
    status.value = isError ? `自动同步失败：${message}` : message;
  },
});
bindWheelCloudSync({
  getData: () => store.data,
  replaceData: (next, reason) => store.replace(next, reason, 'sync'),
  onStatus: (message, isError) => {
    status.value = isError ? `Wheel 自动同步失败：${message}` : message;
  },
});
bindHabitCloudSync({
  getData: () => store.data,
  replaceData: (next, reason) => store.replace(next, reason, 'sync'),
  onStatus: (message, isError) => {
    status.value = isError ? `Habit 自动同步失败：${message}` : message;
  },
});


function nowIso() {
  return new Date().toISOString();
}

function normalizeRemotePath() {
  config.remotePath = sync.normalizeRemotePath(config.remotePath || '/life-plan.json');
  return config.remotePath;
}

function readSyncState(): SyncState {
  try {
    return JSON.parse(localStorage.getItem('lifePlanSyncState') || '{}') as SyncState;
  } catch {
    return {};
  }
}

function writeSyncState(next: SyncState) {
  localStorage.setItem('lifePlanSyncState', JSON.stringify(next));
}

function rememberRemoteVersion(remote: RemotePayload | null, state: SyncState) {
  if (!remote) return;
  if (remote.etag) state.lastRemoteEtag = remote.etag;
}

function isConditionalWriteConflict(error: unknown) {
  return typeof error === 'object' && error !== null && (error as { status?: number }).status === 412;
}

function createMergeSnapshots(reason: string, remote: RemotePayload, actionPrefix: string) {
  const before = lifePlanRepository.createSnapshot(`${reason}前`, store.data, {
    action: `${actionPrefix}-before-merge`,
    source: 'vue-main-sync',
    mergedWith: { label: '云端', hash: remote.hash },
  }) as { id?: string; version?: number; hash?: string } | undefined;
  const merged = sync.mergeCloudData(store.data, remote.data);
  lifePlanRepository.createSnapshot(`${reason}结果`, merged, {
    action: `${actionPrefix}-merge-result`,
    source: 'vue-main-sync',
    parentSnapshotId: before?.id,
    parentVersion: before?.version,
    parentHash: before?.hash,
    mergedWith: { label: '云端', hash: remote.hash },
  });
  store.replace(merged, `${actionPrefix}-merge`, 'sync');
}

function updateAfterPush(response: { etag?: string }, fallbackEtag = '') {
  const stamp = nowIso();
  const hash = sync.getDataHash(store.data);
  const state = readSyncState();
  writeSyncState({
    ...state,
    dirty: false,
    lastRemoteHash: hash,
    lastRemoteEtag: response.etag || fallbackEtag || state.lastRemoteEtag || '',
    lastPushAt: stamp,
    lastSyncAt: stamp,
  });
}

async function fetchRemote() {
  return await sync.pullJson(config, normalizeRemotePath()) as RemotePayload | null;
}

async function pushWithEtag(ifMatch = '') {
  return await sync.pushJson(config, normalizeRemotePath(), store.data, 'life-plan', { ifMatch }) as { etag?: string };
}

async function saveConfig() {
  normalizeRemotePath();
  Object.assign(config, saveMainSyncConfig({ ...config, autoSync: !!config.autoSync }));
  startMainAutoSyncEngine();
  startTodoAutoSyncEngine();
  startWheelAutoSyncEngine();
  startHabitAutoSyncEngine();
  const savedMessage = config.autoSync
    ? `${configStatusHint()}；配置已保存；主数据自动同步与页面恢复同步已启用。`
    : `${configStatusHint()}；配置已保存；主数据自动同步已关闭。`;
  autoStatus.value = savedMessage;
  status.value = savedMessage;
  if (config.webdavUrl) {
    try {
      await runMainCloudSyncBoth({ force: true, source: 'config-save-auto-sync' });
      autoStatus.value = `${configStatusHint()}；${status.value}`;
    } catch (error) {
      status.value = error instanceof Error ? error.message : String(error);
      autoStatus.value = `${configStatusHint()}；${savedMessage}；${status.value}`;
    }
  }
}

async function testConnection() {
  busy.value = true;
  autoStatus.value = '正在测试连接...';
  try {
    const health = await sync.healthCheck(config, normalizeRemotePath());
    autoStatus.value = health === null
      ? '连接成功，云端目录还不存在，首次上传会自动创建'
      : '连接成功';
  } catch (error) {
    autoStatus.value = error instanceof Error ? error.message : '连接失败';
  } finally {
    busy.value = false;
  }
}

async function pullAndMerge() {
  busy.value = true;
  status.value = '';
  try {
    const remote = await fetchRemote();
    if (!remote) {
      status.value = '远端文件不存在或为空，未修改本地数据。';
      return;
    }
    createMergeSnapshots('云端合并', remote, 'cloud-pull');
    const stamp = nowIso();
    const dirty = sync.getDataHash(store.data) !== remote.hash;
    writeSyncState({
      ...readSyncState(),
      lastRemoteHash: remote.hash,
      lastRemoteEtag: remote.etag || '',
      lastPullAt: stamp,
      ...(dirty ? {} : { lastSyncAt: stamp }),
      dirty,
    });
    status.value = '已按原 mergeCloudData 规则合并云端数据。';
  } catch (error) {
    status.value = error instanceof Error ? error.message : String(error);
  } finally {
    busy.value = false;
  }
}

async function mergeAfterConditionalWriteConflict() {
  const remote = await fetchRemote();
  if (!remote) throw new Error('云端版本已变化，但重新拉取时未找到同步文件。');
  if (!remote.etag) throw new Error('云端版本已变化，但响应没有 ETag，无法安全重试上传。');
  createMergeSnapshots('条件写入冲突合并', remote, 'etag-conflict');
  const stamp = nowIso();
  writeSyncState({
    ...readSyncState(),
    dirty: true,
    lastRemoteHash: remote.hash,
    lastRemoteEtag: remote.etag,
    lastPullAt: stamp,
    lastConflictAt: stamp,
  });
  return remote;
}

async function push() {
  busy.value = true;
  status.value = '';
  try {
    normalizeRemotePath();
    lifePlanRepository.createSnapshot('上传云端前', store.data, {
      action: 'upload',
      source: 'vue-main-sync',
    });

    const state = readSyncState();
    const remote = await fetchRemote();
    const localHash = sync.getDataHash(store.data);
    if (remote) {
      rememberRemoteVersion(remote, state);
      const remoteChanged = remote.hash !== localHash && (!state.lastRemoteHash || remote.hash !== state.lastRemoteHash);
      if (remoteChanged) {
        createMergeSnapshots('手动上传合并', remote, 'cloud-push');
        const stamp = nowIso();
        writeSyncState({
          ...state,
          dirty: true,
          lastRemoteHash: remote.hash,
          lastRemoteEtag: remote.etag || state.lastRemoteEtag || '',
          lastPullAt: stamp,
          lastConflictAt: stamp,
        });
      } else {
        writeSyncState(state);
      }
    }

    const currentState = readSyncState();
    const firstEtag = remote?.etag || String(currentState.lastRemoteEtag || '');
    let response;
    try {
      response = await pushWithEtag(firstEtag);
    } catch (error) {
      if (!isConditionalWriteConflict(error)) throw error;
      const latest = await mergeAfterConditionalWriteConflict();
      response = await pushWithEtag(latest.etag || '');
      updateAfterPush(response, latest.etag || '');
      status.value = '云端版本变化，已按原 mergeCloudData 规则合并后重新上传。';
      return;
    }
    updateAfterPush(response, firstEtag);
    status.value = '主数据已使用条件写入上传到原 /life-plan.json 路径。';
  } catch (error) {
    status.value = error instanceof Error ? error.message : String(error);
  } finally {
    busy.value = false;
  }
}

</script>

<template>
  <section class="page active">
    <article class="card">
      <div class="card-title">主数据 WebDAV 配置</div>
      <div class="form-row">
        <div class="form-group"><label for="sync-webdav-url">同步中转地址（主数据与大转盘共用）</label><input id="sync-webdav-url" v-model="config.webdavUrl" placeholder="https://..." /></div>
        <div class="form-group"><label for="sync-remote-path">云端路径</label><input id="sync-remote-path" v-model="config.remotePath" /></div>
        <div class="form-group"><label for="sync-auto"><input id="sync-auto" v-model="config.autoSync" type="checkbox" /> 自动同步（修改后 20 秒上传，每 5 分钟检查云端）</label></div>
      </div>
      <StatusBanner v-if="autoStatus || status" class="sync-modal-status sync-status active" role="status" tone="info">{{ status || autoStatus }}</StatusBanner>
      <div class="page-actions">
        <button class="btn btn-secondary" type="button" :disabled="busy || !config.webdavUrl" @click="testConnection">测试连接</button>
        <button class="btn btn-secondary" type="button" :disabled="busy || !config.webdavUrl" @click="pullAndMerge">从云端拉取</button>
        <button class="btn btn-secondary" type="button" :disabled="busy || !config.webdavUrl" @click="push">上传到云端</button>
        <button class="btn btn-primary" type="button" @click="saveConfig">保存并同步</button>
      </div>
    </article>

    <WheelSyncPanel title="共享大转盘" :sync-config="config" :run-auto-sync="() => runWheelCloudSyncBoth({ force: true, source: 'wheel-manual-auto-both' })" :restart-auto-sync="startWheelAutoSyncEngine" />

    <details class="sync-extras">
      <summary>独立应用同步（待办 / 习惯）</summary>
      <TodoSyncPanel :sync-config="config" />
      <HabitSyncPanel :sync-config="config" :run-auto-sync="() => runHabitCloudSyncBoth({ force: true, source: 'habit-manual-auto-both' })" :restart-auto-sync="startHabitAutoSyncEngine" />
    </details>
  </section>
</template>

<style scoped>
.sync-extras {
  margin-top: 6px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface-soft);
}
.sync-extras > summary {
  padding: 10px 14px;
  cursor: pointer;
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
}
.sync-extras > summary:hover {
  color: var(--text);
}
.sync-extras[open] > summary {
  border-bottom: 1px solid var(--line);
}
.sync-extras :deep(.sync-resource-card),
.sync-extras :deep(.wheel-sync-card) {
  margin: 0;
  border: none;
  border-bottom: 1px solid var(--line);
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}
</style>
