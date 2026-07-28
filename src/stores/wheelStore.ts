import { computed } from 'vue';
import { defineStore } from 'pinia';

import { createLegacyServices, genId, getNowLocal, getTodayStr } from '../services/legacyServices';
import { lifePlanRepository } from '../services/lifePlanRepository';
import { useLifePlanStore } from './lifePlanStore';

export type WheelMode = 'normal' | 'tag';
export type WheelItem = Record<string, unknown> & { id: string; name: string; weight: number; enabled: boolean; note: string; createdAt: string; updatedAt: string };
export type Wheel = Record<string, unknown> & { id: string; name: string; mode: WheelMode; items: WheelItem[]; tagIds?: string[]; createdAt: string; updatedAt: string };
export type WheelTag = Record<string, unknown> & { id: string; name: string; color: string; weight: number; enabled: boolean; createdAt: string; updatedAt: string };
export type WheelHistory = Record<string, unknown> & { id: string; wheelId: string; wheelName: string; mode: WheelMode; resultId: string; resultName: string; note: string; createdAt: string; updatedAt: string; convertedTodoId?: string };

const palette = ['#216e4e', '#4f7cac', '#b56b45', '#8a6d3b', '#7667a6', '#a05a7a'];
const wheelCollections = ['wheels', 'wheelTags', 'wheelLibraryItems', 'wheelHistory', 'wheelItems'] as const;

function nameKey(value: unknown) { return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase(); }
function weight(value: unknown) { return Math.max(1, Math.round(Number(value) || 1)); }
function color(value: unknown, fallback: string) { return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value) : fallback; }
function safeArray(value: unknown) { return Array.isArray(value) ? value : []; }
function fileStamp() { return new Date().toISOString().slice(0, 10); }
function download(filename: string, contents: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
function csvCell(value: unknown) { return `"${String(value ?? '').replace(/"/g, '""')}"`; }

/**
 * Writes only the wheel-owned collections through the shared lifePlan store.
 * The legacy wheel runtime is deliberately not imported: it binds to the old DOM.
 */
export const useWheelStore = defineStore('wheel', () => {
  const lifePlan = useLifePlanStore();
  const services = createLegacyServices();
  const wheels = computed(() => lifePlan.data.wheels as unknown as Wheel[]);
  const tags = computed(() => lifePlan.data.wheelTags as unknown as WheelTag[]);
  const libraryItems = computed(() => lifePlan.data.wheelLibraryItems as unknown as WheelItem[]);
  const history = computed(() => lifePlan.data.wheelHistory as unknown as WheelHistory[]);

  function validTagIds(input: unknown) {
    const valid = new Set(tags.value.map(tag => tag.id));
    return Array.from(new Set(safeArray(input).map(String).filter(id => valid.has(id))));
  }

  // This is intentionally scoped to wheel data. The repository owns the global
  // normalisation boundary; this preserves the historic wheel fields it receives.
  function normalize() {
    const data = lifePlan.data;
    const stamp = getNowLocal();
    const remap = new Map<string, string>();
    const seenTags = new Set<string>();
    data.wheelTags = safeArray(data.wheelTags).map((raw, index) => {
      const tag = raw as Record<string, unknown>; const name = String(tag.name || '未命名标签').trim() || '未命名标签';
      const id = String(tag.id || genId()); const key = nameKey(name);
      if (seenTags.has(key)) { remap.set(id, ''); return null; }
      seenTags.add(key); remap.set(id, id);
      const createdAt = String(tag.createdAt || stamp);
      return { ...tag, id, name, color: color(tag.color, palette[index % palette.length]), weight: weight(tag.weight), enabled: tag.enabled !== false, createdAt, updatedAt: String(tag.updatedAt || createdAt) };
    }).filter(Boolean) as typeof data.wheelTags;
    const valid = new Set(data.wheelTags.map(tag => String(tag.id)));
    const normalizeTagIds = (input: unknown) => Array.from(new Set(safeArray(input).map(id => remap.get(String(id)) ?? String(id)).filter(id => id && valid.has(id))));
    data.wheelLibraryItems = safeArray(data.wheelLibraryItems).map((raw, index) => {
      const item = raw as Record<string, unknown>; const createdAt = String(item.createdAt || stamp);
      return { ...item, id: String(item.id || genId()), name: String(item.name || '未命名公共项').trim() || '未命名公共项', note: typeof item.note === 'string' ? item.note : '', tagIds: normalizeTagIds(item.tagIds), weight: weight(item.weight), enabled: item.enabled !== false, createdAt, updatedAt: String(item.updatedAt || createdAt), _index: index };
    }).filter((item, index, all) => all.findIndex(candidate => nameKey(candidate.name) === nameKey(item.name)) === index).map(({ _index, ...item }) => item) as typeof data.wheelLibraryItems;
    data.wheels = safeArray(data.wheels).map(raw => {
      const wheel = raw as Record<string, unknown>; const mode: WheelMode = wheel.mode === 'tag' ? 'tag' : 'normal'; const createdAt = String(wheel.createdAt || stamp);
      const seen = new Set<string>();
      const items = mode === 'tag' ? [] : safeArray(wheel.items).map(item => {
        const source = item as Record<string, unknown>; const itemName = String(source.name || '未命名选项').trim() || '未命名选项'; const key = nameKey(itemName);
        if (seen.has(key)) return null; seen.add(key); const itemCreated = String(source.createdAt || createdAt);
        return { ...source, id: String(source.id || genId()), name: itemName, note: typeof source.note === 'string' ? source.note : '', weight: weight(source.weight), enabled: source.enabled !== false, createdAt: itemCreated, updatedAt: String(source.updatedAt || itemCreated) };
      }).filter(Boolean);
      const next: Record<string, unknown> = { ...wheel, id: String(wheel.id || genId()), name: String(wheel.name || '未命名转盘').trim() || '未命名转盘', mode, items, createdAt, updatedAt: String(wheel.updatedAt || createdAt) };
      if (mode === 'tag') next.tagIds = normalizeTagIds(wheel.tagIds); else delete next.tagIds;
      return next;
    }) as typeof data.wheels;
    data.wheelHistory = safeArray(data.wheelHistory).map(raw => {
      const item = raw as Record<string, unknown>; const createdAt = String(item.createdAt || stamp);
      const next: Record<string, unknown> = { ...item, id: String(item.id || genId()), wheelId: String(item.wheelId || ''), wheelName: String(item.wheelName || '未命名转盘'), mode: item.mode === 'tag' ? 'tag' : 'normal', resultId: String(item.resultId || ''), resultName: String(item.resultName || '未命名结果'), note: typeof item.note === 'string' ? item.note : '', createdAt, updatedAt: String(item.updatedAt || createdAt) };
      if (typeof item.tagId !== 'string') delete next.tagId;
      if (typeof item.tagName !== 'string') delete next.tagName;
      if (typeof item.convertedTodoId !== 'string') next.convertedTodoId = '';
      return next;
    }) as typeof data.wheelHistory;
  }

  function mutate(reason: string, action: () => void) {
    lifePlan.mutate(reason, () => { action(); normalize(); });
  }
  function tombstone(collection: typeof wheelCollections[number], id: string, extra: Record<string, unknown> = {}) {
    services.sync.markDeletedItem(lifePlan.data, collection, id, { reason: 'vue-wheel-delete', ...extra });
  }
  function byId(id: string) { return wheels.value.find(wheel => wheel.id === id); }

  function candidates(wheel: Wheel, lockedTagId = ''): WheelItem[] {
    if (wheel.mode !== 'tag') return wheel.items.filter(item => item.enabled !== false);
    const tagSet = new Set(lockedTagId ? [lockedTagId] : validTagIds(wheel.tagIds));
    return libraryItems.value.filter(item => item.enabled !== false && safeArray(item.tagIds).map(String).some(id => tagSet.has(id)));
  }
  function candidateTags(wheel: Wheel) { return tags.value.filter(tag => tag.enabled !== false && validTagIds(wheel.tagIds).includes(tag.id) && candidates(wheel, tag.id).length); }
  function weightedPick<T extends { weight?: unknown }>(items: T[]) {
    const total = items.reduce((sum, item) => sum + weight(item.weight), 0); let cursor = Math.random() * total;
    return items.find(item => (cursor -= weight(item.weight)) <= 0) || items[items.length - 1];
  }

  function createWheel(input: { name: string; mode: WheelMode; tagIds?: string[]; items?: Array<Pick<WheelItem, 'name' | 'weight'>> }) {
    const stamp = getNowLocal(); const mode = input.mode === 'tag' ? 'tag' : 'normal';
    const entries = (input.items || []).reduce<WheelItem[]>((all, item) => {
      const name = String(item.name || '').trim(); if (!name || all.some(existing => nameKey(existing.name) === nameKey(name))) return all;
      all.push({ id: genId(), name, note: '', weight: weight(item.weight), enabled: true, createdAt: stamp, updatedAt: stamp }); return all;
    }, []);
    if (mode === 'normal' && !entries.length) throw new Error('普通转盘至少需要一个选项');
    const tagIds = validTagIds(input.tagIds); if (mode === 'tag' && !tagIds.length) throw new Error('标签转盘至少需要选择一个标签');
    const wheel: Wheel = { id: genId(), name: String(input.name || '').trim() || (mode === 'tag' ? '新的标签转盘' : '新的普通转盘'), mode, items: mode === 'tag' ? [] : entries, ...(mode === 'tag' ? { tagIds } : {}), createdAt: stamp, updatedAt: stamp };
    mutate('create-wheel', () => { lifePlan.data.wheels.unshift(wheel); }); return wheel;
  }
  function updateWheel(id: string, input: { name?: string; tagIds?: string[] }) { mutate('update-wheel', () => { const wheel = byId(id); if (!wheel) return; if (input.name !== undefined && String(input.name).trim()) wheel.name = String(input.name).trim(); if (wheel.mode === 'tag' && input.tagIds) { const next = validTagIds(input.tagIds); if (!next.length) throw new Error('标签转盘至少需要选择一个标签'); wheel.tagIds = next; } wheel.updatedAt = getNowLocal(); }); }
  function deleteWheel(id: string) { mutate('delete-wheel', () => { const wheel = byId(id); if (!wheel) return; tombstone('wheels', id, { name: wheel.name }); wheel.items.forEach(item => tombstone('wheelItems', item.id, { wheelId: id, name: item.name })); lifePlan.data.wheels = lifePlan.data.wheels.filter(item => String(item.id) !== id); }); }
  function saveOption(wheelId: string, input: { id?: string; name: string; weight: number; enabled?: boolean }) { mutate(input.id ? 'update-wheel-item' : 'create-wheel-item', () => { const wheel = byId(wheelId); if (!wheel || wheel.mode === 'tag') throw new Error('标签转盘没有私有选项'); const name = String(input.name || '').trim(); if (!name) throw new Error('请输入选项名称'); if (wheel.items.some(item => item.id !== input.id && nameKey(item.name) === nameKey(name))) throw new Error('当前转盘已有同名选项'); const stamp = getNowLocal(); const existing = wheel.items.find(item => item.id === input.id); if (existing) Object.assign(existing, { name, weight: weight(input.weight), enabled: input.enabled !== false, updatedAt: stamp }); else wheel.items.push({ id: genId(), name, note: '', weight: weight(input.weight), enabled: input.enabled !== false, createdAt: stamp, updatedAt: stamp }); wheel.updatedAt = stamp; }); }
  function deleteOption(wheelId: string, itemId: string) { mutate('delete-wheel-item', () => { const wheel = byId(wheelId); const item = wheel?.items.find(entry => entry.id === itemId); if (!wheel || !item) return; tombstone('wheelItems', itemId, { wheelId, name: item.name }); wheel.items = wheel.items.filter(entry => entry.id !== itemId); wheel.updatedAt = getNowLocal(); }); }

  function saveTag(input: { id?: string; name: string; color?: string; weight?: number; enabled?: boolean }) { mutate(input.id ? 'update-wheel-tag' : 'create-wheel-tag', () => { const name = String(input.name || '').trim(); if (!name) throw new Error('请输入标签名称'); if (tags.value.some(tag => tag.id !== input.id && nameKey(tag.name) === nameKey(name))) throw new Error('已有同名标签'); const stamp = getNowLocal(); const existing = tags.value.find(tag => tag.id === input.id); if (existing) Object.assign(existing, { name, color: color(input.color, existing.color), weight: weight(input.weight), enabled: input.enabled !== false, updatedAt: stamp }); else lifePlan.data.wheelTags.push({ id: genId(), name, color: color(input.color, palette[tags.value.length % palette.length]), weight: weight(input.weight), enabled: input.enabled !== false, createdAt: stamp, updatedAt: stamp }); }); }
  function deleteTag(id: string) { mutate('delete-wheel-tag', () => { const tag = tags.value.find(item => item.id === id); if (!tag) return; const orphaned = libraryItems.value.filter(item => safeArray(item.tagIds).map(String).includes(id) && safeArray(item.tagIds).length === 1); if (orphaned.length) throw new Error(`仍有 ${orphaned.length} 个公共项只属于该标签，请先调整它们的标签`); tombstone('wheelTags', id, { name: tag.name }); lifePlan.data.wheelTags = lifePlan.data.wheelTags.filter(item => String(item.id) !== id); libraryItems.value.forEach(item => { item.tagIds = safeArray(item.tagIds).map(String).filter(tagId => tagId !== id); }); wheels.value.filter(wheel => wheel.mode === 'tag').forEach(wheel => { wheel.tagIds = safeArray(wheel.tagIds).map(String).filter(tagId => tagId !== id); wheel.updatedAt = getNowLocal(); }); }); }
  function saveLibraryItem(input: { id?: string; name: string; tagIds: string[]; weight?: number; enabled?: boolean }) { mutate(input.id ? 'update-wheel-library-item' : 'create-wheel-library-item', () => { const name = String(input.name || '').trim(); const tagIds = validTagIds(input.tagIds); if (!name) throw new Error('请输入公共项名称'); if (!tagIds.length) throw new Error('公共项至少需要选择一个标签'); if (libraryItems.value.some(item => item.id !== input.id && nameKey(item.name) === nameKey(name))) throw new Error('公共项里已有同名内容'); const stamp = getNowLocal(); const existing = libraryItems.value.find(item => item.id === input.id); if (existing) Object.assign(existing, { name, tagIds, weight: weight(input.weight), enabled: input.enabled !== false, updatedAt: stamp }); else lifePlan.data.wheelLibraryItems.push({ id: genId(), name, note: '', tagIds, weight: weight(input.weight), enabled: input.enabled !== false, createdAt: stamp, updatedAt: stamp }); }); }
  function deleteLibraryItem(id: string) { mutate('delete-wheel-library-item', () => { const item = libraryItems.value.find(entry => entry.id === id); if (!item) return; tombstone('wheelLibraryItems', id, { name: item.name }); lifePlan.data.wheelLibraryItems = lifePlan.data.wheelLibraryItems.filter(entry => String(entry.id) !== id); }); }
  function batchSetLibraryEnabled(ids: string[], enabled: boolean) {
    const selected = new Set(ids.map(String));
    const targets = libraryItems.value.filter(item => selected.has(item.id) && (item.enabled !== false) !== enabled);
    if (!targets.length) return 0;
    mutate('batch-toggle-wheel-library-items', () => {
      const stamp = getNowLocal();
      targets.forEach(item => {
        item.enabled = enabled;
        item.updatedAt = stamp;
      });
    });
    return targets.length;
  }
  function batchUpdateLibraryTags(ids: string[], tagIds: string[], action: 'add' | 'remove') {
    let blockedOnlyTag = 0;
    const validTags = validTagIds(tagIds);
    if (!ids.length) throw new Error('请先勾选公共项');
    if (!validTags.length) throw new Error('请先选择至少一个标签');
    const selected = new Set(ids.map(String));
    const plans = libraryItems.value.map(item => {
      if (!selected.has(item.id)) return null;
      const set = new Set(safeArray(item.tagIds).map(String));
      let itemChanged = false;
      validTags.forEach(tagId => {
        if (action === 'remove') {
          if (!set.has(tagId)) return;
          if (set.size <= 1) {
            blockedOnlyTag += 1;
            return;
          }
          set.delete(tagId);
          itemChanged = true;
          return;
        }
        if (set.has(tagId)) return;
        set.add(tagId);
        itemChanged = true;
      });
      return itemChanged ? { item, tagIds: validTagIds(Array.from(set)) } : null;
    }).filter(Boolean) as Array<{ item: WheelItem; tagIds: string[] }>;
    if (!plans.length) return { changed: 0, blockedOnlyTag };
    mutate(action === 'remove' ? 'batch-remove-wheel-library-tags' : 'batch-add-wheel-library-tags', () => {
      const stamp = getNowLocal();
      plans.forEach(({ item, tagIds }) => {
        item.tagIds = tagIds;
        item.updatedAt = stamp;
      });
    });
    return { changed: plans.length, blockedOnlyTag };
  }
  function batchDeleteLibraryItems(ids: string[]) {
    const selected = new Set(ids.map(String));
    const items = libraryItems.value.filter(item => selected.has(item.id));
    if (!items.length) return 0;
    mutate('batch-delete-wheel-library-items', () => {
      items.forEach(item => tombstone('wheelLibraryItems', item.id, { name: item.name }));
      lifePlan.data.wheelLibraryItems = lifePlan.data.wheelLibraryItems.filter(item => !selected.has(String(item.id)));
    });
    return items.length;
  }

  function recordSpin(wheelId: string, result: WheelItem, tag?: WheelTag) { const wheel = byId(wheelId); if (!wheel) throw new Error('找不到转盘'); const stamp = getNowLocal(); const entry: WheelHistory = { id: genId(), wheelId, wheelName: wheel.name, mode: wheel.mode, ...(tag ? { tagId: tag.id, tagName: tag.name } : {}), resultId: result.id, resultName: result.name, note: result.note, convertedTodoId: '', createdAt: stamp, updatedAt: stamp }; mutate('wheel-spin', () => { lifePlan.data.wheelHistory.unshift(entry); }); return entry; }
  function deleteHistory(id: string) { mutate('delete-wheel-history', () => { const item = history.value.find(entry => entry.id === id); if (!item) return; tombstone('wheelHistory', id, { wheelId: item.wheelId, resultName: item.resultName }); lifePlan.data.wheelHistory = lifePlan.data.wheelHistory.filter(entry => String(entry.id) !== id); }); }
  function clearHistory() { mutate('clear-wheel-history', () => { history.value.forEach(item => tombstone('wheelHistory', item.id, { wheelId: item.wheelId, resultName: item.resultName })); lifePlan.data.wheelHistory = []; }); }
  function convertHistoryToTodo(id: string) { let todoId = ''; mutate('wheel-result-to-todo', () => { const entry = history.value.find(item => item.id === id); if (!entry) throw new Error('找不到抽取记录'); if (entry.convertedTodoId && lifePlan.data.todos.some(todo => todo.id === entry.convertedTodoId)) throw new Error('这个结果已经转入待办'); const todo = services.todos.createTodoFromAiItem({ text: entry.resultName, note: entry.note, group: '转盘', urgency: 'medium', sourceType: 'wheel', sourceRecordId: entry.id, planStartDate: getTodayStr(), planEndDate: getTodayStr(), dueDate: '' }); lifePlan.data.todos.unshift(todo); entry.convertedTodoId = todo.id; entry.updatedAt = getNowLocal(); todoId = todo.id; }); return todoId; }

  function backupSnapshot() { return { wheels: wheels.value, wheelTags: tags.value, wheelLibraryItems: libraryItems.value, wheelHistory: history.value }; }
  function exportBackup() { lifePlanRepository.createSnapshot('大转盘导出前自动快照', lifePlan.data, { action: 'wheel-backup-export', source: 'vue-wheel' }); download(`大转盘完整备份_${fileStamp()}.json`, JSON.stringify(backupSnapshot(), null, 2), 'application/json;charset=utf-8'); }
  function restoreBackup(raw: unknown, filename = '大转盘备份') {
    if (!raw || typeof raw !== 'object') throw new Error('备份文件不是有效的大转盘 JSON');
    const source = raw as Record<string, unknown>; const snapshot = backupSnapshot(); const deletedItems = lifePlan.data.deletedItems.slice();
    lifePlanRepository.createSnapshot('大转盘恢复前自动快照', lifePlan.data, { action: 'wheel-backup-import', source: 'vue-wheel', mergedWith: { label: filename } });
    try {
      mutate('restore-wheel-backup', () => {
        const incoming = { wheels: safeArray(source.wheels), wheelTags: safeArray(source.wheelTags), wheelLibraryItems: safeArray(source.wheelLibraryItems), wheelHistory: safeArray(source.wheelHistory) };
        const present = new Map<typeof wheelCollections[number], Set<string>>([
          ['wheels', new Set(incoming.wheels.map(item => String((item as Record<string, unknown>).id || '')))], ['wheelTags', new Set(incoming.wheelTags.map(item => String((item as Record<string, unknown>).id || '')))], ['wheelLibraryItems', new Set(incoming.wheelLibraryItems.map(item => String((item as Record<string, unknown>).id || '')))], ['wheelHistory', new Set(incoming.wheelHistory.map(item => String((item as Record<string, unknown>).id || '')))], ['wheelItems', new Set(incoming.wheels.flatMap(item => safeArray((item as Record<string, unknown>).items).map(entry => String((entry as Record<string, unknown>).id || ''))))],
        ]);
        const removed = new Map<typeof wheelCollections[number], string[]>([['wheels', wheels.value.map(item => item.id)], ['wheelTags', tags.value.map(item => item.id)], ['wheelLibraryItems', libraryItems.value.map(item => item.id)], ['wheelHistory', history.value.map(item => item.id)], ['wheelItems', wheels.value.flatMap(item => item.items.map(entry => entry.id))]]);
        removed.forEach((ids, collection) => ids.filter(id => !present.get(collection)?.has(id)).forEach(id => tombstone(collection, id, { reason: 'vue-wheel-backup-restore' })));
        lifePlan.data.deletedItems = lifePlan.data.deletedItems.filter(item => !wheelCollections.includes(String(item.collection) as typeof wheelCollections[number]) || !present.get(String(item.collection) as typeof wheelCollections[number])?.has(String(item.id)));
        lifePlan.data.wheels = incoming.wheels; lifePlan.data.wheelTags = incoming.wheelTags; lifePlan.data.wheelLibraryItems = incoming.wheelLibraryItems; lifePlan.data.wheelHistory = incoming.wheelHistory;
      });
    } catch (error) {
      // The repository commit is transactional. Restore the reactive draft only if a
      // synchronous validation/write error occurred before it could be persisted.
      lifePlan.data.wheels = snapshot.wheels; lifePlan.data.wheelTags = snapshot.wheelTags; lifePlan.data.wheelLibraryItems = snapshot.wheelLibraryItems; lifePlan.data.wheelHistory = snapshot.wheelHistory; lifePlan.data.deletedItems = deletedItems;
      throw error;
    }
  }
  function exportHistoryCsv() { const header = ['时间', '转盘', '模式', '标签', '结果', '备注', '是否已转待办']; const rows = history.value.map(item => [item.createdAt, item.wheelName, item.mode === 'tag' ? '标签转盘' : '普通转盘', item.tagName || '', item.resultName, item.note, item.convertedTodoId ? '是' : '否']); download(`大转盘抽取记录_${fileStamp()}.csv`, `\uFEFF${[header, ...rows].map(row => row.map(csvCell).join(',')).join('\n')}`, 'text/csv;charset=utf-8'); }

  return { wheels, tags, libraryItems, history, candidates, candidateTags, weightedPick, createWheel, updateWheel, deleteWheel, saveOption, deleteOption, saveTag, deleteTag, saveLibraryItem, deleteLibraryItem, batchSetLibraryEnabled, batchUpdateLibraryTags, batchDeleteLibraryItems, recordSpin, deleteHistory, clearHistory, convertHistoryToTodo, backupSnapshot, exportBackup, restoreBackup, exportHistoryCsv };
});
