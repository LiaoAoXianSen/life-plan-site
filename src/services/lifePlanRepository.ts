import { createLegacyServices, getNowLocal } from './legacyServices';
import { normalizeTopLevelData, type LifePlanData } from '../types/lifePlan';

export type CommitSource = 'user' | 'sync';

const mainDataKey = 'lifePlanData';
const syncStateKey = 'lifePlanSyncState';
const todoMirrorKey = 'todoAppData';

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
    type: typeof item.type === 'string' && item.type ? item.type : '摘抄',
    content: typeof item.content === 'string' ? item.content : '',
    tags: Array.isArray(item.tags) ? item.tags : [],
    source: typeof item.source === 'string' ? item.source : '',
    note: typeof item.note === 'string' ? item.note : '',
  }));
  target.goals = target.goals.map(item => ({
    ...item,
    progress: Number.isFinite(Number(item.progress)) ? Number(item.progress) : item.status === '已完成' ? 100 : 0,
  }));
  services.fitness.normalizeFitnessData(target);
  return target;
}

export class LifePlanRepository {
  private readonly services = createLegacyServices();

  load(): LifePlanData {
    try {
      const raw = localStorage.getItem(mainDataKey);
      return normalizePersistedData(raw ? JSON.parse(raw) : {}, this.services);
    } catch (error) {
      console.warn('lifePlanData 读取失败，已使用空数据加载', error);
      return normalizePersistedData({}, this.services);
    }
  }

  commit(sourceData: LifePlanData, reason: string, source: CommitSource = 'user'): LifePlanData {
    const next = normalizePersistedData(clone(sourceData), this.services);
    const previous = localStorage.getItem(mainDataKey);
    try {
      localStorage.setItem(mainDataKey, JSON.stringify(next));
      this.rebuildTodoMirror(next, reason);
      this.updateMainSyncState(next, source);
      return next;
    } catch (error) {
      if (previous === null) localStorage.removeItem(mainDataKey);
      else localStorage.setItem(mainDataKey, previous);
      throw error;
    }
  }

  createSnapshot(reason: string, data: LifePlanData, meta: Record<string, unknown> = {}) {
    return this.services.snapshots.createSnapshot(reason, data, { source: 'vue-migration', ...meta });
  }

  mergeImport(data: LifePlanData, imported: unknown): LifePlanData {
    const incoming = normalizePersistedData(imported, this.services);
    this.createSnapshot('导入前自动备份', data, { action: 'before-import' });
    const merged = normalizePersistedData(this.services.sync.mergeCloudData(data, incoming), this.services);
    this.createSnapshot('导入合并结果', merged, { action: 'merge-result', mergedWith: { label: '导入文件' } });
    return this.commit(merged, 'import-merge', 'sync');
  }

  exportData(data: LifePlanData) {
    this.createSnapshot('手动导出备份', data, { action: 'export' });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.services.snapshots.downloadJsonFile(`life-plan-backup-${stamp}.json`, data);
  }

  private rebuildTodoMirror(data: LifePlanData, reason: string) {
    const sourceHash = this.services.sync.getDataHash({ todos: data.todos, deletedItems: data.deletedItems.filter(item => item.collection === 'todos') });
    const built = this.services.todos.buildTodoAppLocalMirror(data, {
      reason,
      sourceHash,
      generatedAt: new Date().toISOString(),
      dualWriteEnabledPaths: this.services.todos.getTodoDualWritePathInventory()
        .filter((item: { dualWrite?: string }) => item.dualWrite === 'enabled')
        .map((item: { id: string }) => item.id),
    });
    localStorage.setItem(todoMirrorKey, JSON.stringify({
      ...built.snapshot,
      localMirror: true,
      remoteUploadEnabled: false,
      authority: 'lifePlanData.todos',
    }));
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
