<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

import RecordCreateModal from './RecordCreateModal.vue';
import { useLifePlanStore } from '../stores/lifePlanStore';

type SnapshotItem = {
  id?: string;
  version?: number;
  reason?: string;
  createdAt?: string;
  bytes?: number;
  hash?: string;
  data?: unknown;
};

const router = useRouter();
const lifePlan = useLifePlanStore();
const showCreateRecord = ref(false);
const showSnapshots = ref(false);
const snapshotNotice = ref('');
const importInput = ref<HTMLInputElement | null>(null);

const navigation = [
  { to: '/dashboard', icon: '📊', label: '首页仪表盘' },
  { to: '/records', icon: '📝', label: '所有记录' },
  { to: '/ideas', icon: '💡', label: '灵感池' },
  { to: '/materials', icon: '📚', label: '素材库' },
  { to: '/tags', icon: '🏷️', label: '标签中心' },
  { to: '/search', icon: '🔎', label: '全局搜索' },
  { to: '/todos', icon: '✅', label: '待办总览' },
  { to: '/habits', icon: '🔥', label: '习惯打卡' },
  { to: '/fitness', icon: '🏋️', label: '运动健身' },
  { to: '/goals', icon: '🎯', label: '目标管理' },
  { to: '/wheel', icon: '🎡', label: '工具转盘' },
];

const snapshots = computed(() => (showSnapshots.value ? lifePlan.listSnapshots() as SnapshotItem[] : []));
const snapshotStats = computed(() => (showSnapshots.value ? lifePlan.getSnapshotStats() as {
  count?: number;
  totalBytes?: number;
  latestBytes?: number;
  isRisky?: boolean;
} : { count: 0, totalBytes: 0, latestBytes: 0, isRisky: false }));

const mainSyncLabel = computed(() => {
  try {
    const config = JSON.parse(localStorage.getItem('lifePlanSyncConfig') || '{}') as { webdavUrl?: string };
    const state = JSON.parse(localStorage.getItem('lifePlanSyncState') || '{}') as {
      dirty?: boolean;
      lastSyncAt?: string;
    };
    if (!config.webdavUrl) return '同步：未配置';
    if (state.dirty) return '同步：有未上传改动';
    if (state.lastSyncAt) return `同步：${String(state.lastSyncAt).slice(0, 16).replace('T', ' ')}`;
    return '同步：已配置';
  } catch {
    return '同步：未配置';
  }
});

const wheelSyncLabel = computed(() => {
  try {
    const state = JSON.parse(localStorage.getItem('wheelAppSyncState') || '{}') as {
      dirty?: boolean;
      lastSyncAt?: string;
      lastRemoteHash?: string;
    };
    if (!state.lastRemoteHash && !state.lastSyncAt) return '转盘：未同步';
    if (state.dirty) return '转盘：有未上传改动';
    if (state.lastSyncAt) return `转盘：${String(state.lastSyncAt).slice(0, 16).replace('T', ' ')}`;
    return '转盘：已同步';
  } catch {
    return '转盘：未同步';
  }
});

function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatTime(value = '') {
  return String(value || '').slice(0, 19).replace('T', ' ');
}

function exportBackup() {
  lifePlan.exportData();
  snapshotNotice.value = '已导出完整备份，并写入本地快照。';
}

function triggerImport() {
  importInput.value?.click();
}

async function importBackup(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    const raw = JSON.parse(await file.text());
    const confirmed = window.confirm(
      '将按安全合并导入，不会静默覆盖较新内容；两边都改过时会保留主版本并生成冲突副本。确认继续？',
    );
    if (!confirmed) return;
    lifePlan.importData(raw);
    snapshotNotice.value = '导入已按合并规则完成，并建立前后快照。';
  } catch (error) {
    snapshotNotice.value = error instanceof Error ? error.message : '文件格式错误，导入失败';
    window.alert(snapshotNotice.value);
  } finally {
    input.value = '';
  }
}

function openSnapshotModal() {
  snapshotNotice.value = '';
  showSnapshots.value = true;
}

function createSnapshotNow() {
  lifePlan.createManualSnapshot('手动快照');
  snapshotNotice.value = '已创建本地快照。';
}

function downloadSnapshot(item: SnapshotItem) {
  lifePlan.downloadSnapshot(item as never);
}

function deleteSnapshot(item: SnapshotItem) {
  if (!item.id) return;
  if (!window.confirm('确定删除这份本地快照吗？')) return;
  lifePlan.deleteSnapshot(item.id);
  snapshotNotice.value = '快照已删除。';
}

function restoreSnapshot(item: SnapshotItem) {
  if (!item.id) return;
  if (!window.confirm(`确认恢复快照「${item.reason || item.id}」吗？当前数据会先自动再存一份。`)) return;
  try {
    lifePlan.restoreSnapshot(item.id);
    snapshotNotice.value = '快照已恢复。';
    showSnapshots.value = false;
  } catch (error) {
    snapshotNotice.value = error instanceof Error ? error.message : String(error);
  }
}
</script>

<template>
  <aside class="sidebar" aria-label="主导航">
    <RouterLink class="app-brand" to="/dashboard" aria-label="返回首页仪表盘">
      <h2>人生规划系统</h2>
    </RouterLink>

    <nav class="nav-list" aria-label="功能导航">
      <RouterLink
        v-for="item in navigation"
        :key="item.to"
        v-slot="{ href, isActive, navigate }"
        :to="item.to"
        custom
      >
        <a :class="['nav-item', { active: isActive }]" :href="href" @click="navigate">
          <span aria-hidden="true">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </a>
      </RouterLink>
    </nav>

    <div class="sidebar-primary-action">
      <button class="btn btn-primary" type="button" @click="showCreateRecord = true">+ 新建记录</button>
    </div>

    <details class="sidebar-bottom" open>
      <summary>
        <span>数据与备份</span>
        <span class="sync-status-stack">
          <span class="sync-status-inline">{{ mainSyncLabel }}</span>
          <span class="sync-status-inline">{{ wheelSyncLabel }}</span>
        </span>
      </summary>
      <div class="sidebar-button-row">
        <button class="btn btn-secondary" type="button" style="flex:1" @click="exportBackup">导出备份</button>
        <button class="btn btn-secondary" type="button" style="flex:1" @click="triggerImport">导入恢复</button>
      </div>
      <div class="sidebar-button-row sidebar-button-row-compact">
        <button class="btn btn-secondary sync-btn" type="button" @click="openSnapshotModal">🛟 本地快照</button>
        <button class="btn btn-secondary sync-btn" type="button" @click="router.push('/sync')">☁️ 云同步</button>
      </div>
      <div class="sidebar-button-row sidebar-button-row-compact sidebar-ai-row">
        <button class="btn btn-secondary sync-btn" type="button" @click="router.push({ path: '/ai', query: { mode: 'todayPlan' } })">AI 助手</button>
        <button class="btn btn-secondary sync-btn" type="button" @click="router.push('/ai')">AI 设置</button>
      </div>
      <div v-if="lifePlan.lastError" class="local-save-warning active" role="alert">
        <span class="local-save-warning-text">{{ lifePlan.lastError }}</span>
        <div class="local-save-warning-actions">
          <button class="btn btn-secondary" type="button" @click="exportBackup">立即导出</button>
          <button class="btn btn-secondary" type="button" @click="openSnapshotModal">管理快照</button>
        </div>
      </div>
    </details>

    <input ref="importInput" hidden type="file" accept="application/json,.json" @change="importBackup">
    <RecordCreateModal v-model="showCreateRecord" />

    <Teleport to="body">
      <div v-if="showSnapshots" class="modal-overlay active" role="presentation" @click.self="showSnapshots = false">
        <section class="modal snapshot-modal" role="dialog" aria-modal="true" aria-labelledby="snapshot-modal-title">
          <div class="modal-header">
            <div id="snapshot-modal-title" class="modal-title">本地快照</div>
            <button class="close-btn" type="button" aria-label="关闭本地快照" @click="showSnapshots = false">×</button>
          </div>
          <p class="section-hint">自动保留最近 20 份；可预览、下载、恢复。恢复前会再自动存一份当前数据。</p>
          <div class="snapshot-storage-notice" :class="{ risky: snapshotStats.isRisky }">
            共 {{ snapshotStats.count || 0 }} 份 · 占用 {{ formatBytes(Number(snapshotStats.totalBytes || 0)) }}
            · 最近一份 {{ formatBytes(Number(snapshotStats.latestBytes || 0)) }}
          </div>
          <div class="page-actions" style="margin: 12px 0;">
            <button class="btn btn-primary" type="button" @click="createSnapshotNow">立即创建快照</button>
            <button class="btn btn-secondary" type="button" @click="exportBackup">导出备份</button>
          </div>
          <p v-if="snapshotNotice" class="notice success" role="status">{{ snapshotNotice }}</p>
          <div class="snapshot-list">
            <article v-for="item in snapshots" :key="String(item.id)" class="snapshot-item card">
              <div>
                <strong>v{{ item.version || '-' }} · {{ item.reason || '本地快照' }}</strong>
                <p>{{ formatTime(item.createdAt) }} · {{ formatBytes(Number(item.bytes || 0)) }}</p>
              </div>
              <div class="page-actions">
                <button class="btn btn-secondary" type="button" @click="downloadSnapshot(item)">下载</button>
                <button class="btn btn-primary" type="button" @click="restoreSnapshot(item)">恢复</button>
                <button class="btn btn-danger" type="button" @click="deleteSnapshot(item)">删除</button>
              </div>
            </article>
            <div v-if="!snapshots.length" class="empty-state">还没有本地快照。</div>
          </div>
        </section>
      </div>
    </Teleport>
  </aside>
</template>

<style scoped>
.sidebar {
  height: 100vh;
  max-height: 100vh;
  overflow: hidden;
}
.nav-list {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}
.sidebar-primary-action,
.sidebar-bottom {
  flex: 0 0 auto;
}
.sidebar-ai-row {
  margin-bottom: 4px;
}
.snapshot-modal {
  width: min(720px, calc(100vw - 32px));
  max-height: min(860px, calc(100vh - 32px));
  overflow: auto;
}
.snapshot-list {
  display: grid;
  gap: 10px;
}
.snapshot-item {
  display: grid;
  gap: 10px;
  padding: 12px 14px;
}
.snapshot-item p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 12px;
}
.snapshot-storage-notice {
  margin-top: 8px;
  padding: 8px 10px;
  border-radius: var(--radius);
  background: var(--surface-soft);
  color: var(--muted);
  font-size: 12px;
}
.snapshot-storage-notice.risky {
  color: #8a4b00;
  background: rgba(255, 186, 73, 0.16);
}
.section-hint {
  color: var(--muted);
  font-size: 13px;
  line-height: 1.6;
}
</style>
