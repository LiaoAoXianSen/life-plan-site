<script setup lang="ts">
import EmptyState from './common/EmptyState.vue';
import StatusBanner from './common/StatusBanner.vue';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import RecordCreateModal from './RecordCreateModal.vue';
import ModalShell from './common/ModalShell.vue';
import { withReturnTo } from '../router/returnTo';
import { lifePlanRepository, type CriticalFailure } from '../services/lifePlanRepository';
import { useLifePlanStore } from '../stores/lifePlanStore';

type SnapshotItem = {
  id?: string;
  version?: number;
  reason?: string;
  createdAt?: string;
  bytes?: number;
  hash?: string;
  parent?: { version?: number | string; hash?: string } | null;
  mergedWith?: { label?: string; version?: number | string; hash?: string } | null;
  source?: string;
  action?: string;
  data?: unknown;
};

type SnapshotRecord = {
  id?: string;
  isHabitRecord?: boolean;
  updatedAt?: string;
  createdAt?: string;
  startDate?: string;
  type?: string;
  title?: string;
};

type SnapshotSummary = {
  records: unknown[];
  todos: unknown[];
  habits: unknown[];
  checkins: unknown[];
  goals: unknown[];
  materials: unknown[];
  bodyMetrics: unknown[];
  fitnessPlans: unknown[];
  fitnessWorkouts: unknown[];
  exerciseLibrary: unknown[];
  latestRecords: SnapshotRecord[];
  openTodos: number;
  doneTodos: number;
  relation: string;
};

const route = useRoute();
const router = useRouter();
const lifePlan = useLifePlanStore();
const showCreateRecord = ref(false);
const showSnapshots = ref(false);
const previewSnapshotId = ref<string | null>(null);
const snapshotNotice = ref('');
const snapshotNoticeIsError = ref(false);
const criticalFailures = ref<CriticalFailure[]>([]);
const importInput = ref<HTMLInputElement | null>(null);
const mainSyncStatus = ref<{ message: string; isError: boolean } | null>(null);
const mainSyncConfigVersion = ref(0);
const importCollections = ['records', 'todos', 'habits', 'checkins', 'habitPointLedger', 'habitRewards', 'habitCurrencies', 'templates', 'goals', 'materials', 'bodyMetrics', 'fitnessPlans', 'fitnessWorkouts', 'exerciseLibrary', 'wheels', 'wheelTags', 'wheelLibraryItems', 'wheelHistory'];

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
const selectedSnapshot = computed(() => snapshots.value.find(item => String(item.id || '') === previewSnapshotId.value) || null);
const selectedSnapshotSummary = computed(() => selectedSnapshot.value ? getSnapshotSummary(selectedSnapshot.value) : null);

function formatSyncClock(value = '') {
  const match = String(value || '').match(/T(\d{2}:\d{2}(?::\d{2})?)/);
  return match ? match[1].padEnd(8, ':00') : '';
}

function summarizeMainSyncStatus(message = '', isError = false, configured = false) {
  const text = String(message || '').trim();
  if (isError) return '同步：失败';
  if (!text) return configured ? '同步：待检查' : '同步：未配置';
  if (text.includes('未配置')) return '同步：未配置';
  if (text.includes('正在') || text.includes('稍后')) return '同步：进行中';
  if (text.includes('完成') || text.includes('已上传') || text.includes('已拉取') || text.includes('一致') || text.includes('已同步')) return '同步：已同步';
  if (text.includes('已加载')) return '同步：已配置';
  return `同步：${text.replace(/\s+/g, ' ').slice(0, 16)}`;
}

function handleMainSyncStatus(event: Event) {
  const detail = (event as CustomEvent<{ message?: unknown; isError?: unknown }>).detail || {};
  mainSyncStatus.value = {
    message: String(detail.message || ''),
    isError: detail.isError === true,
  };
}

function handleMainSyncConfig() {
  mainSyncStatus.value = null;
  mainSyncConfigVersion.value += 1;
}

onMounted(() => {
  window.addEventListener('life-plan-main-sync-status', handleMainSyncStatus);
  window.addEventListener('life-plan-main-sync-config', handleMainSyncConfig);
});

onBeforeUnmount(() => {
  window.removeEventListener('life-plan-main-sync-status', handleMainSyncStatus);
  window.removeEventListener('life-plan-main-sync-config', handleMainSyncConfig);
});

const mainSyncLabel = computed(() => {
  if (mainSyncStatus.value) {
    let configured = false;
    try {
      configured = Boolean((JSON.parse(localStorage.getItem('lifePlanSyncConfig') || '{}') as { webdavUrl?: string }).webdavUrl);
    } catch { /* use the event status without a config fallback */ }
    return summarizeMainSyncStatus(mainSyncStatus.value.message, mainSyncStatus.value.isError, configured);
  }
  mainSyncConfigVersion.value;
  try {
    const config = JSON.parse(localStorage.getItem('lifePlanSyncConfig') || '{}') as { webdavUrl?: string };
    const state = JSON.parse(localStorage.getItem('lifePlanSyncState') || '{}') as {
      dirty?: boolean;
      lastSyncAt?: string;
      lastRemoteHash?: string;
    };
    if (!config.webdavUrl) return '同步：未配置';
    if (state.dirty) return '同步：有未上传改动';
    if (state.lastSyncAt || state.lastRemoteHash) return '同步：已同步';
    return '同步：待检查';
  } catch {
    return '同步：未配置';
  }
});

const mainSyncMessage = computed(() => {
  if (mainSyncStatus.value?.message) return mainSyncStatus.value.message;
  mainSyncConfigVersion.value;
  try {
    const config = JSON.parse(localStorage.getItem('lifePlanSyncConfig') || '{}') as { webdavUrl?: string };
    const state = JSON.parse(localStorage.getItem('lifePlanSyncState') || '{}') as {
      dirty?: boolean;
      lastSyncAt?: string;
    };
    if (!config.webdavUrl) return '未配置云同步';
    if (state.dirty) return '本地有更新，等待自动同步';
    if (state.lastSyncAt) return `上次同步 ${formatSyncClock(state.lastSyncAt)}`;
    return '同步状态待检查';
  } catch {
    return '未配置云同步';
  }
});

const wheelSyncLabel = computed(() => {
  try {
    const config = JSON.parse(localStorage.getItem('lifePlanSyncConfig') || '{}') as { webdavUrl?: string };
    const state = JSON.parse(localStorage.getItem('lifePlanWheelSyncState') || '{}') as {
      dirty?: boolean;
      lastSyncAt?: string;
      lastRemoteHash?: string;
    };
    if (!config.webdavUrl) return '转盘：未配置';
    if (state.dirty) return '转盘：有未上传改动';
    if (state.lastSyncAt) return `转盘：${String(state.lastSyncAt).slice(0, 16).replace('T', ' ')}`;
    if (!state.lastRemoteHash) return '转盘：待检查';
    return '转盘：已同步';
  } catch {
    return '转盘：未配置';
  }
});

function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatStoredDateTime(value = '') {
  const raw = String(value || '');
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return raw.replace('T', ' ');
  return `${match[1]}年${Number(match[2])}月${Number(match[3])}日 ${match[4]}:${match[5]}:${match[6] || '00'}`;
}

function getSnapshotRelationText(snapshot: SnapshotItem) {
  const parts: string[] = [];
  if (snapshot.parent) {
    const parentVersion = snapshot.parent.version ? `v${snapshot.parent.version}` : '上一版';
    const parentHash = snapshot.parent.hash ? ` · ${String(snapshot.parent.hash).slice(0, 8)}` : '';
    parts.push(`上一个版本：${parentVersion}${parentHash}`);
  } else {
    parts.push('上一个版本：无');
  }
  if (snapshot.mergedWith) {
    const label = snapshot.mergedWith.label || '未知来源';
    const hash = snapshot.mergedWith.hash ? ` · ${String(snapshot.mergedWith.hash).slice(0, 8)}` : '';
    const version = snapshot.mergedWith.version ? ` · v${snapshot.mergedWith.version}` : '';
    parts.push(`合并对象：${label}${version}${hash}`);
  }
  if (snapshot.source) parts.push(`来源：${snapshot.source}${snapshot.action ? `/${snapshot.action}` : ''}`);
  return parts.join(' ｜ ');
}

function getSnapshotSummary(snapshot: SnapshotItem): SnapshotSummary {
  const snapshotData = snapshot.data && typeof snapshot.data === 'object' ? snapshot.data as Record<string, unknown> : {};
  const collections = {
    records: Array.isArray(snapshotData.records) ? snapshotData.records : [],
    todos: Array.isArray(snapshotData.todos) ? snapshotData.todos : [],
    habits: Array.isArray(snapshotData.habits) ? snapshotData.habits : [],
    checkins: Array.isArray(snapshotData.checkins) ? snapshotData.checkins : [],
    goals: Array.isArray(snapshotData.goals) ? snapshotData.goals : [],
    materials: Array.isArray(snapshotData.materials) ? snapshotData.materials : [],
    bodyMetrics: Array.isArray(snapshotData.bodyMetrics) ? snapshotData.bodyMetrics : [],
    fitnessPlans: Array.isArray(snapshotData.fitnessPlans) ? snapshotData.fitnessPlans : [],
    fitnessWorkouts: Array.isArray(snapshotData.fitnessWorkouts) ? snapshotData.fitnessWorkouts : [],
    exerciseLibrary: Array.isArray(snapshotData.exerciseLibrary) ? snapshotData.exerciseLibrary : [],
  };
  const latestRecords = [...collections.records]
    .filter(record => !(record as SnapshotRecord).isHabitRecord)
    .sort((a, b) => {
      const left = a as SnapshotRecord;
      const right = b as SnapshotRecord;
      return String(right.updatedAt || right.createdAt || right.startDate || '').localeCompare(String(left.updatedAt || left.createdAt || left.startDate || ''));
    })
    .slice(0, 3) as SnapshotRecord[];
  return {
    ...collections,
    latestRecords,
    openTodos: collections.todos.filter(todo => !(todo as { done?: boolean }).done).length,
    doneTodos: collections.todos.filter(todo => Boolean((todo as { done?: boolean }).done)).length,
    relation: getSnapshotRelationText(snapshot),
  };
}

function exportBackup() {
  lifePlan.exportData();
  snapshotNotice.value = '已导出完整备份，并写入本地快照。';
}

function triggerImport() {
  importInput.value?.click();
}

function getImportSummary(imported: unknown) {
  const value = imported && typeof imported === 'object' ? imported as Record<string, unknown> : {};
  return importCollections.map(key => `${key}:${Array.isArray(value[key]) ? value[key].length : 0}`).join(' · ');
}

async function importBackup(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    const raw = lifePlanRepository.normalizeImportPreview(JSON.parse(await file.text()));
    const summary = getImportSummary(raw);
    const confirmed = window.confirm(
      `将按安全合并导入，不会静默覆盖较新内容；两边都改过时会保留主版本并生成冲突副本。\n\n备份内容：${summary}\n\n确认继续？`,
    );
    if (!confirmed) return;
    lifePlan.importData(raw, {
      onBeforeSnapshotFailure: () => window.confirm('导入前快照创建失败。继续导入会缺少回滚点，确定继续吗？'),
    });
    snapshotNotice.value = '导入已按合并规则完成，并建立前后快照。';
  } catch (error) {
    snapshotNotice.value = error instanceof Error ? error.message : '文件格式错误，导入失败';
    window.alert(snapshotNotice.value);
  } finally {
    input.value = '';
  }
}

function retryLocalSave() {
  try {
    lifePlan.retryLocalSave();
    snapshotNotice.value = '本地数据已重新保存。';
  } catch (error) {
    snapshotNotice.value = error instanceof Error ? error.message : '重试保存失败';
  }
}

function refreshCriticalFailures() {
  criticalFailures.value = lifePlanRepository.listCriticalFailures();
}

function setSnapshotNotice(message: string, isError = false) {
  snapshotNotice.value = message;
  snapshotNoticeIsError.value = isError;
  refreshCriticalFailures();
}

function openSnapshotModal() {
  snapshotNotice.value = '';
  snapshotNoticeIsError.value = false;
  refreshCriticalFailures();
  previewSnapshotId.value = null;
  showSnapshots.value = true;
}

function closeSnapshotModal() {
  showSnapshots.value = false;
  previewSnapshotId.value = null;
}

function toggleSnapshotPreview(item: SnapshotItem) {
  const id = String(item.id || '');
  previewSnapshotId.value = previewSnapshotId.value === id ? null : id;
}

function createSnapshotNow() {
  try {
    const snapshot = lifePlan.createManualSnapshot('手动快照');
    if (!snapshot) {
      const error = lifePlanRepository.listCriticalFailures()[0];
      throw new Error(error?.message || '快照服务返回空结果');
    }
    setSnapshotNotice('已创建本地快照。');
  } catch (error) {
    setSnapshotNotice(`创建快照失败：${error instanceof Error ? error.message : String(error)}`, true);
  }
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

function openSyncPage() {
  void router.push(withReturnTo(route, { path: '/sync' }));
}

function openAiAssistant() {
  if (route.path === '/ai') {
    void router.push({ path: '/ai', query: { mode: 'todayPlan', ...(route.query.returnTo ? { returnTo: route.query.returnTo } : {}) } });
    return;
  }
  void router.push(withReturnTo(route, { path: '/ai', query: { mode: 'todayPlan' } }));
}

function openAiSettings() {
  if (route.path === '/ai') {
    void router.push({ path: '/ai', query: { ...route.query, settings: '1' } });
    return;
  }
  void router.push(withReturnTo(route, { path: '/ai', query: { settings: '1' } }));
}

function restoreSnapshot(item: SnapshotItem) {
  if (!item.id) return;
  if (!window.confirm(`确认恢复快照「${item.reason || item.id}」吗？当前数据会先自动再存一份。`)) return;
  try {
    const next = lifePlanRepository.restoreSnapshot(item.id, lifePlan.data, {
      onBeforeSnapshotFailure: error => window.confirm(`恢复前快照创建失败：${error.message}。继续恢复会缺少回滚点，确定继续吗？`),
    });
    lifePlan.data = next;
    lifePlan.lastError = '';
    setSnapshotNotice('快照已恢复。');
    showSnapshots.value = false;
  } catch (error) {
    setSnapshotNotice(error instanceof Error ? error.message : String(error), true);
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
          <span :class="['sync-status-inline', { 'is-error': mainSyncStatus?.isError }]">{{ mainSyncLabel }}</span>
          <span class="sync-status-inline">{{ wheelSyncLabel }}</span>
        </span>
      </summary>
      <div class="sidebar-button-row">
        <button class="btn btn-secondary" type="button" style="flex:1" @click="exportBackup">导出备份</button>
        <button class="btn btn-secondary" type="button" style="flex:1" @click="triggerImport">导入恢复</button>
      </div>
      <div class="sidebar-button-row sidebar-button-row-compact">
        <button class="btn btn-secondary sync-btn" type="button" @click="openSnapshotModal">🛟 本地快照</button>
        <button class="btn btn-secondary sync-btn" type="button" @click="openSyncPage">☁️ 云同步</button>
      </div>
      <div class="sidebar-button-row sidebar-button-row-compact sidebar-ai-row">
        <button class="btn btn-secondary sync-btn" type="button" @click="openAiAssistant">AI 助手</button>
        <button class="btn btn-secondary sync-btn" type="button" @click="openAiSettings">AI 设置</button>
      </div>
      <div v-if="lifePlan.lastError" class="local-save-warning active" role="alert">
        <span class="local-save-warning-text">{{ lifePlan.lastError }}</span>
        <div class="local-save-warning-actions">
          <button class="btn btn-secondary" type="button" @click="exportBackup">立即导出</button>
          <button class="btn btn-secondary" type="button" @click="openSnapshotModal">管理快照</button>
          <button class="btn btn-primary" type="button" @click="retryLocalSave">重试保存</button>
        </div>
      </div>
      <div :class="['sync-status', 'active', { 'is-error': mainSyncStatus?.isError }]" role="status">
        {{ mainSyncMessage }}
      </div>
    </details>

    <input ref="importInput" hidden type="file" accept="application/json,.json" @change="importBackup">
    <RecordCreateModal v-model="showCreateRecord" @open-existing="recordId => router.push(withReturnTo(route, { path: '/records', query: { record: recordId } }))" />

    <ModalShell v-model="showSnapshots" title="本地快照" dialog-class="snapshot-modal" close-label="关闭本地快照" @close="previewSnapshotId = null">
          <p class="section-hint">自动保留最近 20 份；可预览、下载、恢复。恢复前会再自动存一份当前数据。</p>
          <div class="snapshot-storage-notice" :class="{ risky: snapshotStats.isRisky }">
            共 {{ snapshotStats.count || 0 }} 份 · 占用 {{ formatBytes(Number(snapshotStats.totalBytes || 0)) }}
            · 最近一份 {{ formatBytes(Number(snapshotStats.latestBytes || 0)) }}
          </div>
          <div class="page-actions" style="margin: 12px 0;">
            <button class="btn btn-primary" type="button" @click="createSnapshotNow">立即创建快照</button>
            <button class="btn btn-secondary" type="button" @click="exportBackup">导出备份</button>
          </div>
          <StatusBanner v-if="snapshotNotice" class="notice" :role="snapshotNoticeIsError ? 'alert' : 'status'" :tone="snapshotNoticeIsError ? 'danger' : 'success'">{{ snapshotNotice }}</StatusBanner>
          <section v-if="criticalFailures.length" class="critical-failure-log" aria-label="最近关键故障">
            <strong>最近关键故障</strong>
            <div v-for="failure in criticalFailures" :key="failure.id" class="critical-failure-item">
              <strong>{{ failure.label || '关键操作失败' }}</strong>
              <span>{{ formatStoredDateTime(failure.createdAt) }} · {{ failure.message || '未记录详细原因' }}</span>
            </div>
          </section>
          <div class="snapshot-list">
            <article v-for="item in snapshots" :key="String(item.id)" class="snapshot-item card">
              <div>
                <strong>v{{ item.version || '-' }} · {{ item.reason || '本地快照' }}</strong>
                <p>{{ formatStoredDateTime(item.createdAt) }} · {{ formatBytes(Number(item.bytes || 0)) }} · {{ item.hash || '' }}</p>
                <p class="snapshot-preview-relation">{{ getSnapshotRelationText(item) }}</p>
              </div>
              <div class="page-actions">
                <button class="btn btn-secondary" type="button" :aria-expanded="previewSnapshotId === String(item.id)" @click="toggleSnapshotPreview(item)">
                  {{ previewSnapshotId === String(item.id) ? '收起' : '预览' }}
                </button>
                <button class="btn btn-secondary" type="button" @click="downloadSnapshot(item)">下载</button>
                <button class="btn btn-primary" type="button" @click="restoreSnapshot(item)">恢复</button>
                <button class="btn btn-danger" type="button" @click="deleteSnapshot(item)">删除</button>
              </div>
              <div v-if="previewSnapshotId === String(item.id) && selectedSnapshotSummary" class="snapshot-preview" data-testid="snapshot-preview">
                <div class="snapshot-preview-heading">v{{ selectedSnapshot?.version || '-' }} · {{ selectedSnapshot?.reason || '本地快照' }}</div>
                <div class="snapshot-preview-meta">{{ formatStoredDateTime(selectedSnapshot?.createdAt) }} · {{ formatBytes(Number(selectedSnapshot?.bytes || 0)) }} · {{ selectedSnapshot?.hash || '' }}</div>
                <div class="snapshot-preview-relation">{{ selectedSnapshotSummary.relation }}</div>
                <div class="snapshot-preview-stats">
                  <span>记录 {{ selectedSnapshotSummary.records.length }}</span>
                  <span>待办 {{ selectedSnapshotSummary.todos.length }}（未完成 {{ selectedSnapshotSummary.openTodos }} / 已完成 {{ selectedSnapshotSummary.doneTodos }}）</span>
                  <span>习惯 {{ selectedSnapshotSummary.habits.length }}</span>
                  <span>打卡 {{ selectedSnapshotSummary.checkins.length }}</span>
                  <span>目标 {{ selectedSnapshotSummary.goals.length }}</span>
                  <span>素材 {{ selectedSnapshotSummary.materials.length }}</span>
                  <span>身材 {{ selectedSnapshotSummary.bodyMetrics.length }}</span>
                  <span>训练计划 {{ selectedSnapshotSummary.fitnessPlans.length }}</span>
                  <span>训练日志 {{ selectedSnapshotSummary.fitnessWorkouts.length }}</span>
                  <span>动作库 {{ selectedSnapshotSummary.exerciseLibrary.length }}</span>
                </div>
                <div class="snapshot-preview-list">
                  <strong>最近记录</strong>
                  <div v-if="selectedSnapshotSummary.latestRecords.length">
                    <div v-for="record in selectedSnapshotSummary.latestRecords" :key="`${record.id || ''}-${record.updatedAt || record.startDate || ''}`">
                      {{ record.startDate || '' }} · {{ record.type || '记录' }} · {{ record.title || '无标题' }}
                    </div>
                  </div>
                  <div v-else>暂无记录</div>
                </div>
              </div>
            </article>
            <EmptyState v-if="!snapshots.length">还没有本地快照。同步、导入、删除前会自动创建，也可以手动创建一份。</EmptyState>
          </div>
    </ModalShell>
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
@media (max-width: 980px) {
  .sidebar {
    height: auto;
    max-height: none;
    overflow: visible;
  }
  .nav-list {
    overflow-x: auto;
    overflow-y: hidden;
  }
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
.snapshot-preview {
  display: grid;
  gap: 8px;
  padding-top: 2px;
  border-top: 1px solid var(--border);
  font-size: 12px;
}
.snapshot-preview-heading {
  font-weight: 700;
}
.snapshot-preview-relation,
.snapshot-preview-list {
  color: var(--muted);
  overflow-wrap: anywhere;
}
.snapshot-preview-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
}
.snapshot-preview-stats span {
  white-space: nowrap;
}
.snapshot-preview-list {
  display: grid;
  gap: 4px;
}
.critical-failure-log {
  display: grid;
  gap: 8px;
  margin: 10px 0;
  padding: 10px 12px;
  border: 1px solid rgba(196, 67, 54, 0.28);
  border-radius: var(--radius);
  background: rgba(196, 67, 54, 0.08);
}
.critical-failure-item {
  display: grid;
  gap: 2px;
  font-size: 12px;
}
.critical-failure-item span {
  color: var(--muted);
  overflow-wrap: anywhere;
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
