import { createLegacyServices, genId, getNowLocal } from './legacyServices';
import { normalizeTopLevelData, type LifePlanData } from '../types/lifePlan';

export type CommitSource = 'user' | 'sync';
export type ImportOptions = { onBeforeSnapshotFailure?: () => boolean };
export type RestoreOptions = { onBeforeSnapshotFailure?: (error: Error) => boolean };
export type CriticalFailure = {
  id: string;
  label: string;
  message: string;
  createdAt: string;
  action: string;
};

const mainDataKey = 'lifePlanData';
const syncStateKey = 'lifePlanSyncState';
const todoMirrorKey = 'todoAppData';
const habitMirrorKey = 'habitAppData';
const criticalFailureKey = 'lifePlanCriticalFailures';
const maxCriticalFailures = 5;

function clone<T>(value: T): T {
  // Vue store values are reactive proxies. JSON cloning mirrors the legacy
  // snapshot service and deliberately converts them into plain persisted data.
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * The legacy app normalizes data before every persisted write. Keep that
 * boundary here so a Vue mutation or an imported backup cannot bypass the
 * existing service-owned Todo/Fitness normalizers or resurrect tombstoned
 * entities. This intentionally returns plain JSON-compatible data.
 */
function normalizePersistedData(value: unknown, services: ReturnType<typeof createLegacyServices>): LifePlanData {
  const target = normalizeTopLevelData(value);
  const normalizedAt = getNowLocal();
  const materialTypes = new Set(['金句', '提示词', '摘抄', '观点', '方法']);
  services.sync.pruneDeletedItems(target);
  target.todos = target.todos
    .map((item: Record<string, unknown>, index: number) => services.todos.normalizeTodoEntity(item, index))
    .filter(Boolean);
  target.records = target.records.filter(record => !record.isHabitRecord).map(record => ({
    ...record,
    todoIds: Array.isArray(record.todoIds) ? record.todoIds : [],
    content: typeof record.content === 'string' ? record.content : '',
    ideaTags: Array.isArray(record.ideaTags) ? record.ideaTags : [],
  }));
  target.materials = target.materials.map(item => ({
    ...item,
    id: typeof item.id === 'string' && item.id ? item.id : genId(),
    type: materialTypes.has(String(item.type || '')) ? String(item.type) : '摘抄',
    title: typeof item.title === 'string' ? item.title : '',
    content: typeof item.content === 'string' ? item.content : '',
    tags: services.records.getIdeaTags({ ideaTags: item.tags }),
    source: typeof item.source === 'string' ? item.source : '',
    note: typeof item.note === 'string' ? item.note : '',
    createdAt: typeof item.createdAt === 'string' && item.createdAt ? item.createdAt : normalizedAt,
    updatedAt: typeof item.updatedAt === 'string' && item.updatedAt ? item.updatedAt : (typeof item.createdAt === 'string' && item.createdAt ? item.createdAt : normalizedAt),
  }));
  target.goals = target.goals.map(item => ({
    ...item,
    progress: typeof item.progress === 'number' && Number.isFinite(item.progress) ? item.progress : item.status === '已完成' ? 100 : 0,
  }));
  services.fitness.normalizeFitnessData(target);
  return target;
}

export class LifePlanRepository {
  private readonly services = createLegacyServices();

  load(): LifePlanData {
    try {
      const raw = localStorage.getItem(mainDataKey);
      const parsed = raw ? JSON.parse(raw) : {};
      const normalized = normalizePersistedData(parsed, this.services);
      if (raw && parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Array.isArray(parsed.goals)) {
        const rawGoals = parsed.goals as Array<Record<string, unknown>>;
        const goalsWithExplicitProgress = normalized.goals.map((goal, index) => {
          const rawGoal = rawGoals[index];
          return rawGoal && Object.prototype.hasOwnProperty.call(rawGoal, 'progress') ? goal : rawGoal;
        });
        if (JSON.stringify(rawGoals) !== JSON.stringify(goalsWithExplicitProgress)) {
          localStorage.setItem(mainDataKey, JSON.stringify({ ...parsed, goals: goalsWithExplicitProgress }));
        }
      }
      return normalized;
    } catch (error) {
      console.warn('lifePlanData 读取失败，已使用空数据加载', error);
      return normalizePersistedData({}, this.services);
    }
  }

  normalizeImportPreview(raw: unknown): LifePlanData {
    return normalizePersistedData(raw, this.services);
  }

  commit(sourceData: LifePlanData, reason: string, source: CommitSource = 'user'): LifePlanData {
    const next = normalizePersistedData(clone(sourceData), this.services);
    const previous = localStorage.getItem(mainDataKey);
    try {
      localStorage.setItem(mainDataKey, JSON.stringify(next));
      this.rebuildTodoMirror(next, reason);
      this.rebuildHabitMirror(next, reason);
      this.updateMainSyncState(next, source);
      return next;
    } catch (error) {
      if (previous === null) localStorage.removeItem(mainDataKey);
      else localStorage.setItem(mainDataKey, previous);
      throw error;
    }
  }

  createSnapshot(reason: string, data: LifePlanData, meta: Record<string, unknown> = {}) {
    const snapshot = this.services.snapshots.createSnapshot(reason, data, { source: 'vue-migration', ...meta });
    if (!snapshot) {
      const error = this.snapshotError('快照服务返回空结果');
      this.recordCriticalFailure('本地快照写入失败', error, String(meta.action || 'snapshot-create'));
    }
    return snapshot;
  }

  mergeImport(data: LifePlanData, imported: unknown, options: ImportOptions = {}): LifePlanData {
    const incoming = normalizePersistedData(imported, this.services);
    const beforeSnapshot = this.createSnapshot('导入前自动备份', data, { action: 'before-import' });
    if (!beforeSnapshot && !options.onBeforeSnapshotFailure?.()) throw new Error('导入前快照创建失败，导入已取消');
    const merged = normalizePersistedData(this.services.sync.mergeCloudData(data, incoming), this.services);
    this.createSnapshot('导入合并结果', merged, { action: 'merge-result', mergedWith: { label: '导入文件' } });
    return this.commit(merged, 'import-merge');
  }

  exportData(data: LifePlanData) {
    this.createSnapshot('手动导出备份', data, { source: 'local', action: '' });
    const stamp = this.services.snapshots.getTimestampForFile();
    this.services.snapshots.downloadJsonFile(`人生规划备份_${stamp}.json`, data);
  }

  listSnapshots() {
    return this.services.snapshots.getAll();
  }

  getSnapshotStats() {
    return this.services.snapshots.getStorageStats();
  }

  createManualSnapshot(reason = '手动快照', data: LifePlanData) {
    return this.createSnapshot(reason, data, { action: 'manual-snapshot' });
  }

  downloadSnapshot(snapshot: { id?: string; createdAt?: string; data?: LifePlanData; reason?: string }) {
    const stamp = String(snapshot.createdAt || new Date().toISOString()).replace(/[:.]/g, '-');
    this.services.snapshots.downloadJsonFile(`人生规划快照_${stamp}.json`, snapshot.data || {});
  }

  deleteSnapshot(snapshotId: string) {
    const next = this.listSnapshots().filter((item: { id?: string }) => item.id !== snapshotId);
    this.services.snapshots.saveAll(next);
    return next;
  }

  restoreSnapshot(snapshotId: string, current: LifePlanData, options: RestoreOptions = {}): LifePlanData {
    const target = this.listSnapshots().find((item: { id?: string }) => item.id === snapshotId);
    if (!target?.data) throw new Error('快照不存在或已损坏');
    const beforeSnapshot = this.createSnapshot('恢复前自动快照', current, {
      action: 'before-restore',
      parentSnapshotId: target.id,
      parentVersion: target.version,
      parentHash: target.hash,
      mergedWith: { label: `恢复目标 v${target.version || '?'}`, hash: target.hash || '' },
    });
    if (!beforeSnapshot) {
      const snapshotFailure = this.snapshotError('恢复前快照创建失败');
      if (!options.onBeforeSnapshotFailure?.(snapshotFailure)) {
        throw new Error(`恢复前快照创建失败，恢复已取消：${snapshotFailure.message}`);
      }
    }
    try {
      return this.commit(normalizePersistedData(target.data, this.services), 'restore-snapshot');
    } catch (error) {
      const restoreError = this.toError(error, '恢复后的数据未能写入本地存储');
      this.recordCriticalFailure('恢复本地快照失败', restoreError, 'restore-snapshot');
      throw new Error(`恢复失败：${restoreError.message}。当前数据已保持不变。`);
    }
  }

  listCriticalFailures(): CriticalFailure[] {
    try {
      const parsed = JSON.parse(localStorage.getItem(criticalFailureKey) || '[]');
      return Array.isArray(parsed) ? parsed.slice(0, maxCriticalFailures) : [];
    } catch (error) {
      console.warn('关键故障记录读取失败', error);
      return [];
    }
  }

  getTodoSourceHash(data: LifePlanData) {
    return this.services.sync.getDataHash({ todos: data.todos, deletedItems: data.deletedItems.filter(item => item.collection === 'todos') });
  }

  rebuildTodoMirror(data: LifePlanData, reason: string) {
    const sourceHash = this.getTodoSourceHash(data);
    const built = this.services.todos.buildTodoAppLocalMirror(data, {
      reason,
      sourceHash,
      generatedAt: new Date().toISOString(),
      dualWriteEnabledPaths: this.services.todos.getTodoDualWritePathInventory()
        .filter((item: { dualWrite?: string }) => item.dualWrite === 'enabled')
        .map((item: { id: string }) => item.id),
    });
    const mirror = {
      ...built.snapshot,
      localMirror: true,
      remoteUploadEnabled: false,
      authority: 'lifePlanData.todos',
    };
    localStorage.setItem(todoMirrorKey, JSON.stringify(mirror));
    return mirror;
  }

  rebuildHabitMirror(data: LifePlanData, reason: string) {
    const source = typeof this.services.habit.getHabitLegacySourceSlice === 'function'
      ? this.services.habit.getHabitLegacySourceSlice(data)
      : {
        habits: data.habits,
        checkins: data.checkins,
        habitPointLedger: data.habitPointLedger,
        habitRewards: data.habitRewards,
        habitCurrencies: data.habitCurrencies,
        deletedItems: data.deletedItems,
      };
    const sourceHash = this.services.sync.getDataHash(source);
    const enabledPaths = typeof this.services.habit.getHabitDualWritePathInventory === 'function'
      ? this.services.habit.getHabitDualWritePathInventory()
        .filter((item: { dualWrite?: string }) => item.dualWrite === 'enabled')
        .map((item: { id: string }) => item.id)
      : [];
    const built = this.services.habit.buildHabitAppLocalMirror(data, {
      reason,
      sourceHash,
      generatedAt: new Date().toISOString(),
      dualWriteEnabledPaths: enabledPaths,
    });
    const mirror = {
      ...built.snapshot,
      localMirror: true,
      remoteUploadEnabled: false,
    };
    localStorage.setItem(habitMirrorKey, JSON.stringify(mirror));
    return mirror;
  }

  private snapshotError(fallback: string) {
    const error = typeof this.services.snapshots.getLastError === 'function'
      ? this.services.snapshots.getLastError()
      : null;
    return this.toError(error, fallback);
  }

  private toError(error: unknown, fallback: string) {
    if (error instanceof Error && error.message) return error;
    if (error && typeof error === 'object' && 'message' in error) {
      const message = String((error as { message?: unknown }).message || '').trim();
      if (message) return new Error(message);
    }
    return new Error(fallback);
  }

  private recordCriticalFailure(label: string, error: unknown, action: string) {
    const normalized = this.toError(error, '操作失败');
    const entry: CriticalFailure = {
      id: genId(),
      label,
      message: normalized.message,
      createdAt: getNowLocal(),
      action,
    };
    try {
      localStorage.setItem(criticalFailureKey, JSON.stringify([entry, ...this.listCriticalFailures()].slice(0, maxCriticalFailures)));
    } catch (logError) {
      console.warn('关键故障记录写入失败', logError);
    }
    console.error(label, normalized);
  }

  private updateMainSyncState(data: LifePlanData, source: CommitSource) {
    let state: Record<string, unknown> = {};
    try { state = JSON.parse(localStorage.getItem(syncStateKey) || '{}'); } catch { /* retain a safe default */ }
    localStorage.setItem(syncStateKey, JSON.stringify({
      ...state,
      dirty: source === 'user' ? true : state.dirty === true,
      lastLocalHash: this.services.sync.getDataHash(data),
      lastLocalUpdateAt: getNowLocal(),
    }));
  }
}

export const lifePlanRepository = new LifePlanRepository();
