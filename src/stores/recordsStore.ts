import { computed } from 'vue';
import { defineStore } from 'pinia';
import { createLegacyServices, genId, getNowLocal, getTodayStr } from '../services/legacyServices';
import type { Todo } from '../types/lifePlan';
import { useLifePlanStore } from './lifePlanStore';

const services = createLegacyServices();
type RecordUpdateInput = Partial<{
  title: string;
  content: string;
  type: string;
  startDate: string;
  endDate: string;
  recordTime: string;
  recordEndTime: string;
  todoIds: string[];
  ideaStatus: string;
  ideaTags: string[];
  ideaNextAction: string;
  ideaTodoId: string;
  ideaConclusion: string;
}>;

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

  function updateRecord(id: string, input: RecordUpdateInput) {
    lifePlan.mutate('update-record', data => {
      const record = data.records.find(item => item.id === id);
      if (!record) return;
      const next = { ...input };
      if (Array.isArray(next.todoIds)) next.todoIds = Array.from(new Set(next.todoIds.map(String).filter(Boolean)));
      Object.assign(record, next, { updatedAt: getNowLocal() });
    });
  }

  function linkExistingTodo(recordId: string, todoId: string) {
    lifePlan.mutate('link-record-todo', data => {
      const record = data.records.find(item => item.id === recordId);
      const todo = data.todos.find(item => item.id === todoId);
      if (!record || !todo) return;
      const todoIds = Array.isArray(record.todoIds) ? record.todoIds.map(String) : [];
      if (!todoIds.includes(todo.id)) record.todoIds = [...todoIds, todo.id];
      record.updatedAt = getNowLocal();
    });
  }

  function createExclusiveTodo(recordId: string, text: string): Todo | null {
    const cleanText = text.trim();
    if (!cleanText) return null;
    let created: Todo | null = null;
    lifePlan.mutate('create-record-exclusive-todo', data => {
      const record = data.records.find(item => item.id === recordId);
      if (!record) return;
      const endDate = String(record.endDate || record.startDate || getTodayStr());
      const todo = services.todos.createTodoFromAiItem({
        text: cleanText,
        note: record.title ? `来源记录：${record.title}` : '来源记录',
        group: '记录',
        urgency: 'medium',
        sourceType: 'record',
        sourceRecordId: recordId,
        planStartDate: String(record.startDate || endDate),
        planEndDate: endDate,
        dueDate: endDate,
      }) as Todo;
      todo.isExclusive = true;
      data.todos.unshift(todo);
      const todoIds = Array.isArray(record.todoIds) ? record.todoIds.map(String) : [];
      record.todoIds = [...todoIds, todo.id];
      record.updatedAt = getNowLocal();
      created = todo;
    });
    return created;
  }

  function removeLinkedTodo(recordId: string, todoId: string) {
    lifePlan.mutate('unlink-record-todo', data => {
      const record = data.records.find(item => item.id === recordId);
      if (!record) return;
      record.todoIds = (Array.isArray(record.todoIds) ? record.todoIds.map(String) : []).filter(id => id !== todoId);
      const todo = data.todos.find(item => item.id === todoId);
      if (todo?.isExclusive && todo.sourceRecordId === recordId) {
        services.sync.markDeletedItem(data, 'todos', todoId, { text: todo.text, reason: 'record-unlink-exclusive', recordId });
        data.todos = data.todos.filter(item => item.id !== todoId);
      }
      record.updatedAt = getNowLocal();
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
  function remove(collection: 'records' | 'materials', id: string) {
    const item = lifePlan.data[collection].find(entity => entity.id === id);
    if (!item) return;
    lifePlan.mutate(`delete-${collection}`, data => {
      if (collection === 'records') {
        const todoIds = Array.isArray(item.todoIds) ? item.todoIds.map(String) : [];
        data.todos
          .filter(todo => todoIds.includes(todo.id) && todo.isExclusive)
          .forEach(todo => services.sync.markDeletedItem(data, 'todos', todo.id, { text: todo.text, reason: 'record-delete', recordId: id }));
        data.todos = data.todos.filter(todo => !todoIds.includes(todo.id) || !todo.isExclusive);
      }
      services.sync.markDeletedItem(data, collection, id, { reason: `vue-delete-${collection}` });
      data[collection] = data[collection].filter(entity => entity.id !== id) as never;
    });
  }
  return { ideas, materials, addRecord, updateRecord, linkExistingTodo, createExclusiveTodo, removeLinkedTodo, addIdea, setIdeaStatus, linkIdeaTodo, addMaterial, remove, services };
});
