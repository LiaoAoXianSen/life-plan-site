import { createLegacyServices, genId, getNowLocal } from './legacyServices';
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
    type: materialTypes.has(String(item.type || '')) ? item.type : '摘抄',
    content: typeof item.content === 'string' ? item.content : '',
    tags: services.records.getIdeaTags({ ideaTags: item.tags }),
    source: typeof item.source === 'string' ? item.source : '',
    note: typeof item.note === 'string' ? item.note : '',
    createdAt: typeof item.createdAt === 'string' && item.createdAt ? item.createdAt : normalizedAt,
    updatedAt: typeof item.updatedAt === 'string' && item.updatedAt ? item.updatedAt : (typeof item.createdAt === 'string' && item.createdAt ? item.createdAt : normalizedAt),
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
