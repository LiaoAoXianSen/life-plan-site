<script setup lang="ts">
import StatusBanner from './common/StatusBanner.vue';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import AiPage from '../pages/AiPage.vue';
import SyncPage from '../pages/SyncPage.vue';
import AiSettingsModal from './AiSettingsModal.vue';
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
const showSyncModal = ref(false);
const showAiAssistant = ref(false);
const showAiSettings = ref(false);
const aiAssistantMode = ref<'todayPlan' | 'chatCapture'>('todayPlan');
const previewSnapshotId = ref<string | null>(null);
const snapshotNotice = ref('');
const snapshotNoticeIsError = ref(false);
const criticalFailures = ref<CriticalFailure[]>([]);
const importInput = ref<HTMLInputElement | null>(null);
const sidebarBottom = ref<HTMLDetailsElement | null>(null);
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
const localSaveWarning = computed(() => {
  const error = String(lifePlan.lastError || '');
  const quotaExceeded = /(quota|space|full|storage[^\n]*(?:limit|exceed)|容量|空间不足|存储[^\n]*满)/i.test(error);
  return quotaExceeded
    ? '主数据未可靠保存：浏览器存储空间不足。请先导出备份或清理旧快照。'
    : '主数据未可靠保存：浏览器本地存储写入失败。请先导出备份。';
});

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

function updateSidebarBottom(force = false) {
  const panel = sidebarBottom.value;
  if (!panel) return;
  if (lifePlan.lastError) {
    panel.open = true;
    return;
  }
  const shouldOpen = window.innerWidth > 980;
  if (force || shouldOpen) panel.open = shouldOpen;
}

function handleResize() {
  updateSidebarBottom();
}

watch(() => lifePlan.lastError, error => {
  if (error && sidebarBottom.value) sidebarBottom.value.open = true;
});

onMounted(() => {
  updateSidebarBottom(true);
  window.addEventListener('resize', handleResize);
  window.addEventListener('life-plan-main-sync-status', handleMainSyncStatus);
  window.addEventListener('life-plan-main-sync-config', handleMainSyncConfig);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
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
  showSyncModal.value = true;
}

function openAiAssistant() {
  aiAssistantMode.value = 'todayPlan';
  showAiAssistant.value = true;
}

function openAiSettings() {
  showAiSettings.value = true;
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
          <span aria-hidden="true">{{ item.icon }}&nbsp;</span>
          <span>{{ item.label }}</span>
        </a>
      </RouterLink>
    </nav>

    <div class="sidebar-primary-action">
      <button class="btn btn-primary" type="button" @click="showCreateRecord = true">+ 新建记录</button>
    </div>

    <details ref="sidebarBottom" class="sidebar-bottom">
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
        <span class="local-save-warning-text">{{ localSaveWarning }}</span>
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
      <div class="snapshot-help">
        自动保留最近 20 份快照。现在会记录版本号、上一个版本和合并来源；点“预览”可以先看内容概况，再决定是否恢复。
      </div>
      <section v-if="criticalFailures.length" class="critical-failure-log" aria-label="最近关键故障">
        <div v-for="failure in criticalFailures" :key="failure.id" class="critical-failure-item">
          <strong>{{ failure.label || '关键操作失败' }}</strong>
          <span>{{ formatStoredDateTime(failure.createdAt) }} · {{ failure.message || '未记录详细原因' }}</span>
        </div>
      </section>
      <div class="snapshot-storage-notice" :class="{ 'is-warning': snapshotStats.isRisky }">
        <strong>快照占用 {{ formatBytes(Number(snapshotStats.totalBytes || 0)) }}</strong>
        <span>已保留 {{ snapshotStats.count || 0 }}/20 份，最近一份 {{ formatBytes(Number(snapshotStats.latestBytes || 0)) }}。{{ snapshotStats.isRisky ? '数据变大时建议先导出备份，避免浏览器本地存储写满。' : '数据继续变大后，可定期手动导出一份离线备份。' }}</span>
      </div>
      <StatusBanner v-if="snapshotNotice" class="notice" :role="snapshotNoticeIsError ? 'alert' : 'status'" :tone="snapshotNoticeIsError ? 'danger' : 'success'">{{ snapshotNotice }}</StatusBanner>
      <div class="snapshot-preview" data-testid="snapshot-preview">
        <div v-if="selectedSnapshot && selectedSnapshotSummary" class="snapshot-preview-card">
          <div class="snapshot-preview-head">
            <div>
              <div class="snapshot-version">v{{ selectedSnapshot.version || '?' }} · {{ selectedSnapshot.reason || '本地快照' }}</div>
              <div class="snapshot-meta">{{ formatStoredDateTime(selectedSnapshot.createdAt) }} · {{ formatBytes(Number(selectedSnapshot.bytes || 0)) }} · {{ selectedSnapshot.hash || '' }}</div>
            </div>
            <button class="btn btn-secondary todo-mini-btn" type="button" @click="previewSnapshotId = null">收起</button>
          </div>
          <div class="snapshot-relation">{{ selectedSnapshotSummary.relation }}</div>
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
            <template v-if="selectedSnapshotSummary.latestRecords.length">
              <div v-for="record in selectedSnapshotSummary.latestRecords" :key="`${record.id || ''}-${record.updatedAt || record.startDate || ''}`">
                {{ record.startDate || '' }} · {{ record.type || '记录' }} · {{ record.title || '无标题' }}
              </div>
            </template>
            <div v-else>暂无记录</div>
          </div>
        </div>
      </div>
      <div class="snapshot-list">
        <article v-for="item in snapshots" :key="String(item.id)" class="snapshot-item">
          <div class="snapshot-main">
            <div class="snapshot-title"><span class="snapshot-version-pill">v{{ item.version || '?' }}</span>{{ item.reason || '本地快照' }}</div>
            <div class="snapshot-meta">{{ formatStoredDateTime(item.createdAt) }} · {{ formatBytes(Number(item.bytes || 0)) }} · {{ item.hash || '' }}</div>
            <div class="snapshot-relation">{{ getSnapshotRelationText(item) }}</div>
          </div>
          <div class="snapshot-actions">
            <button class="btn btn-secondary" type="button" :aria-expanded="previewSnapshotId === String(item.id)" @click="toggleSnapshotPreview(item)">预览</button>
            <button class="btn btn-secondary" type="button" @click="restoreSnapshot(item)">恢复</button>
            <button class="btn btn-secondary" type="button" @click="downloadSnapshot(item)">下载</button>
            <button class="btn btn-danger" type="button" @click="deleteSnapshot(item)">删除</button>
          </div>
        </article>
        <div v-if="!snapshots.length" class="snapshot-empty">还没有本地快照。同步、导入、删除前会自动创建，也可以手动创建一份。</div>
      </div>
      <div class="snapshot-footer-actions">
        <button class="btn btn-secondary" type="button" @click="createSnapshotNow">立即创建快照</button>
        <button class="btn btn-secondary" type="button" @click="closeSnapshotModal">关闭</button>
      </div>
    </ModalShell>

    <ModalShell v-model="showSyncModal" title="云同步" size="lg" dialog-class="sync-modal">
      <SyncPage embedded @close="showSyncModal = false" />
    </ModalShell>

    <ModalShell v-model="showAiAssistant" :title="aiAssistantMode === 'todayPlan' ? 'AI 助手' : 'AI 对话整理'" size="lg" dialog-class="ai-assistant-modal">
      <AiPage :embedded-mode="aiAssistantMode" @close="showAiAssistant = false" />
    </ModalShell>

    <AiSettingsModal v-model="showAiSettings" />
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
.nav-item {
  gap: 0;
}
.snapshot-modal {
  width: min(720px, calc(100vw - 32px));
  max-height: min(860px, calc(100vh - 32px));
  overflow: auto;
}
.snapshot-help {
  padding: 12px 13px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: #f6faf7;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.6;
  margin-bottom: 14px;
}
.snapshot-storage-notice {
  display: grid;
  gap: 4px;
  margin: 0 0 12px;
  padding: 10px 12px;
  border: 1px solid #d7e6dc;
  border-radius: 12px;
  background: #f8fcf9;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.6;
}
.snapshot-storage-notice strong {
  color: var(--text);
  font-size: 13px;
}
.snapshot-storage-notice.is-warning {
  border-color: #e7cf92;
  background: #fff9e8;
  color: #735b22;
}
.critical-failure-log {
  display: grid;
  gap: 8px;
  margin: 0 0 12px;
}
.critical-failure-item {
  padding: 10px 12px;
  border: 1px solid #e9b9ad;
  border-radius: 12px;
  background: #fff4f1;
  color: #7d2f1e;
  font-size: 12px;
  line-height: 1.55;
}
.critical-failure-item strong {
  display: block;
  color: #5f2115;
  font-size: 13px;
}
.snapshot-list {
  display: grid;
  gap: 10px;
  max-height: 48vh;
  overflow: auto;
  padding-right: 2px;
}
.snapshot-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 12px 13px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: #fff;
}
.snapshot-main { min-width: 0; }
.snapshot-title {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 4px;
  overflow-wrap: anywhere;
}
.snapshot-version-pill {
  display: inline-flex;
  align-items: center;
  min-height: 21px;
  padding: 1px 8px;
  border-radius: 999px;
  background: #e3f0e8;
  color: var(--accent);
  font-size: 12px;
  font-weight: 700;
}
.snapshot-meta {
  color: var(--faint);
  font-size: 12px;
  line-height: 1.5;
}
.snapshot-relation {
  margin-top: 4px;
  color: #607267;
  font-size: 12px;
  line-height: 1.55;
  overflow-wrap: anywhere;
}
.snapshot-actions {
  display: flex;
  gap: 7px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.snapshot-empty {
  padding: 18px;
  text-align: center;
  color: var(--faint);
  border: 1px dashed var(--line);
  border-radius: 14px;
  background: var(--surface-soft);
}
.snapshot-preview { margin-bottom: 12px; }
.snapshot-preview-card {
  border: 1px solid #cfe0d5;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(255,255,255,.96), rgba(239,248,242,.92));
  padding: 13px;
  box-shadow: 0 12px 26px rgba(44, 75, 54, .08);
}
.snapshot-preview-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: flex-start;
  margin-bottom: 9px;
}
.snapshot-version {
  font-weight: 700;
  color: var(--text);
  overflow-wrap: anywhere;
}
.snapshot-preview-stats {
  display: flex;
  gap: 7px;
  flex-wrap: wrap;
  margin: 10px 0;
}
.snapshot-preview-stats span {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 2px 9px;
  border-radius: 999px;
  background: #edf6f0;
  color: #456354;
  font-size: 12px;
  font-weight: 800;
}
.snapshot-preview-list {
  border-top: 1px dashed #cedbd3;
  padding-top: 9px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.7;
}
.snapshot-preview-list strong {
  display: block;
  color: var(--text);
  margin-bottom: 3px;
}
.snapshot-footer-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  flex-wrap: wrap;
  margin-top: 14px;
}
@media (max-width: 640px) {
  .snapshot-item { grid-template-columns: 1fr; }
  .snapshot-actions { justify-content: flex-start; }
}
</style>
