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

export class LifePlanRepository {
  private readonly services = createLegacyServices();

  load(): LifePlanData {
    try {
      const raw = localStorage.getItem(mainDataKey);
      return normalizeTopLevelData(raw ? JSON.parse(raw) : {});
    } catch (error) {
      console.warn('lifePlanData 读取失败，已使用空数据加载', error);
      return normalizeTopLevelData({});
    }
  }

  commit(sourceData: LifePlanData, reason: string, source: CommitSource = 'user'): LifePlanData {
    const next = normalizeTopLevelData(clone(sourceData));
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
    const incoming = normalizeTopLevelData(imported);
    this.createSnapshot('导入前自动备份', data, { action: 'before-import' });
    const merged = normalizeTopLevelData(this.services.sync.mergeCloudData(data, incoming));
    this.createSnapshot('导入合并结果', merged, { action: 'merge-result', mergedWith: { label: '导入文件' } });
    return this.commit(merged, 'import-merge', 'sync');
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
