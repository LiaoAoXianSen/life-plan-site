import { computed } from 'vue';
import { defineStore } from 'pinia';
import { createLegacyServices, genId, getNowLocal, getTodayStr } from '../services/legacyServices';
import { useLifePlanStore } from './lifePlanStore';

const services = createLegacyServices();

export const useRecordsStore = defineStore('records', () => {
  const lifePlan = useLifePlanStore();
  const ideas = computed(() => lifePlan.data.records.filter(record => record.type === '灵感碎片'));
  const materials = computed(() => lifePlan.data.materials);

  function addRecord(input: { title: string; content?: string; type?: string; startDate?: string; endDate?: string; recordTime?: string; recordEndTime?: string }) {
    const now = getNowLocal();
    const date = input.startDate || getTodayStr();
    lifePlan.mutate('create-record', data => data.records.unshift({
      id: genId(), title: input.title.trim(), content: input.content?.trim() || '', type: input.type || '记录',
      startDate: date, endDate: input.endDate || date, recordTime: input.recordTime || '', recordEndTime: input.recordEndTime || '',
      todoIds: [], createdAt: now, updatedAt: now,
    }));
  }

  function updateRecord(id: string, input: Partial<{ title: string; content: string; type: string; startDate: string; endDate: string; recordTime: string; recordEndTime: string }>) {
    lifePlan.mutate('update-record', data => {
      const record = data.records.find(item => item.id === id);
      if (!record) return;
      Object.assign(record, input, { updatedAt: getNowLocal() });
    });
  }

  function addIdea(title: string, content = '') {
    const now = getNowLocal();
    lifePlan.data.records.unshift({ id: genId(), type: '灵感碎片', title, content, startDate: getTodayStr(), endDate: getTodayStr(), recordTime: '', recordEndTime: '', todoIds: [], ideaStatus: '待整理', ideaTags: [], ideaNextAction: '', ideaTodoId: '', ideaConclusion: '', createdAt: now, updatedAt: now });
    lifePlan.commit('create-idea');
  }
  function setIdeaStatus(id: string, status: string) { const idea = lifePlan.data.records.find(record => record.id === id); if (!idea) return; idea.ideaStatus = status; idea.updatedAt = getNowLocal(); lifePlan.commit('update-idea-status'); }
  function linkIdeaTodo(id: string, todoId: string) { const idea = lifePlan.data.records.find(record => record.id === id); if (!idea) return; idea.ideaTodoId = todoId; idea.updatedAt = getNowLocal(); lifePlan.commit('link-idea-todo'); }
  function addMaterial(input: { title: string; content: string; type: string; tags: string[]; source: string; note: string }) { const now = getNowLocal(); lifePlan.data.materials.unshift({ id: genId(), ...input, createdAt: now, updatedAt: now }); lifePlan.commit('create-material'); }
  function remove(collection: 'records' | 'materials', id: string) { const item = lifePlan.data[collection].find(entity => entity.id === id); if (!item) return; services.sync.markDeletedItem(lifePlan.data, collection, id, { reason: `vue-delete-${collection}` }); lifePlan.data[collection] = lifePlan.data[collection].filter(entity => entity.id !== id) as never; lifePlan.commit(`delete-${collection}`); }
  return { ideas, materials, addRecord, updateRecord, addIdea, setIdeaStatus, linkIdeaTodo, addMaterial, remove, services };
});
