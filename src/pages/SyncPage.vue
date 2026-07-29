<script setup lang="ts">
import { reactive, ref } from 'vue';

import TodoSyncPanel from '../components/TodoSyncPanel.vue';
import WheelSyncPanel from '../components/WheelSyncPanel.vue';
import { createLegacyServices } from '../services/legacyServices';
import { lifePlanRepository } from '../services/lifePlanRepository';
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

const store = useLifePlanStore();
const sync = createLegacyServices().sync;
const config = reactive({
  webdavUrl: '',
  remotePath: '/life-plan.json',
  autoSync: true,
  ...JSON.parse(localStorage.getItem('lifePlanSyncConfig') || '{}'),
});
const status = ref('');
const busy = ref(false);

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
  state.lastRemoteHash = remote.hash;
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

function saveConfig() {
  normalizeRemotePath();
  localStorage.setItem('lifePlanSyncConfig', JSON.stringify(config));
  status.value = '配置已保存到原 lifePlanSyncConfig。';
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
    writeSyncState({
      ...readSyncState(),
      lastRemoteHash: remote.hash,
      lastRemoteEtag: remote.etag || '',
      lastPullAt: stamp,
      lastSyncAt: stamp,
      dirty: false,
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

async function importFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    store.importData(JSON.parse(await file.text()));
    status.value = '导入已按合并规则完成，并建立前后快照。';
  } catch (error) {
    status.value = error instanceof Error ? error.message : String(error);
  } finally {
    (event.target as HTMLInputElement).value = '';
  }
}
</script>

<template>
  <section class="page active">
    <header class="page-header"><div class="page-title">云同步</div></header>

    <article class="card">
      <div class="card-title">主数据 WebDAV 配置</div>
      <div class="form-row">
        <div class="form-group"><label>同步地址</label><input v-model="config.webdavUrl" placeholder="https://..." /></div>
        <div class="form-group"><label>远端路径</label><input v-model="config.remotePath" /></div>
      </div>
      <button class="btn btn-secondary" @click="saveConfig">保存配置</button>
    </article>

    <article class="card">
      <div class="card-title">备份与导入</div>
      <p>导出的是原有完整 `lifePlanData` 格式。导入不是覆盖操作，会保留原有合并和快照保护。</p>
      <div class="page-actions">
        <button class="btn btn-secondary" @click="store.exportData">导出备份</button>
        <label class="btn btn-secondary">导入并合并<input hidden type="file" accept="application/json" @change="importFile" /></label>
      </div>
    </article>

    <article class="card">
      <div class="card-title">手动同步</div>
      <p>上传会先读取云端 ETag，使用 If-Match 条件写入；遇到 412 会重新拉取、快照、合并并只重试一次。</p>
      <div class="page-actions">
        <button class="btn btn-secondary" :disabled="busy || !config.webdavUrl" @click="pullAndMerge">下载并合并</button>
        <button class="btn btn-primary" :disabled="busy || !config.webdavUrl" @click="push">上传主数据</button>
      </div>
      <p v-if="status" class="sync-status active">{{ status }}</p>
    </article>

    <TodoSyncPanel :sync-config="config" />
    <WheelSyncPanel :sync-config="config" />
  </section>
</template>
