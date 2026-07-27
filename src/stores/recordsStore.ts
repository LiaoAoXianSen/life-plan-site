import { computed } from 'vue';
import { defineStore } from 'pinia';
import { createLegacyServices, genId, getNowLocal, getTodayStr } from '../services/legacyServices';
import type { DataEntity, Todo } from '../types/lifePlan';
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
  templateId: string;
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
      delete record.templateFields;
    });
  }

  function addTemplate(input: { name: string; type: string; content: string; todos?: DataEntity[] }) {
    const name = input.name.trim();
    if (!name) return null;
    const template = {
      id: genId(),
      name,
      type: input.type || '记录',
      content: input.content || '',
      todos: JSON.parse(JSON.stringify(input.todos || [])),
    };
    lifePlan.mutate('create-record-template', data => data.templates.push(template));
    return template;
  }

  function deleteTemplate(id: string) {
    const template = lifePlan.data.templates.find(item => item.id === id);
    if (!template) return;
    lifePlan.mutate('delete-record-template', data => {
      services.sync.markDeletedItem(data, 'templates', id, { reason: 'manual-delete', name: String(template.name || '') });
      data.templates = data.templates.filter(item => item.id !== id);
    });
  }

  function replaceRecordTodosFromTemplate(recordId: string, templateTodos: DataEntity[] = []) {
    let todoIds: string[] = [];
    lifePlan.mutate('apply-record-template-todos', data => {
      const record = data.records.find(item => item.id === recordId);
      if (!record) return;
      const previousIds = Array.isArray(record.todoIds) ? record.todoIds.map(String) : [];
      data.todos
        .filter(todo => previousIds.includes(todo.id) && todo.isExclusive)
        .forEach(todo => services.sync.markDeletedItem(data, 'todos', todo.id, {
          text: todo.text,
          reason: 'record-template-replace',
          recordId,
        }));
      data.todos = data.todos.filter(todo => !previousIds.includes(todo.id) || !todo.isExclusive);

      const now = getNowLocal();
      const dueDate = String(record.endDate || record.startDate || getTodayStr());
      const created = templateTodos.map(source => {
        const cloned = JSON.parse(JSON.stringify(source || {}));
        const todo = Object.assign(services.todos.createTodoFromAiItem({
          text: String(cloned.text || '模板待办'),
          note: String(cloned.note || ''),
          group: String(cloned.group || '记录'),
          urgency: cloned.urgency || 'medium',
          sourceType: 'record',
          sourceRecordId: recordId,
          planStartDate: String(record.startDate || dueDate),
          planEndDate: dueDate,
          dueDate,
        }), cloned, {
          id: genId(),
          dueDate,
          createdAt: now,
          updatedAt: now,
        }) as Todo;
        todo.text = String(todo.text || '模板待办');
        todo.subTodos = Array.isArray(todo.subTodos) ? todo.subTodos.map(item => ({ ...item })) : [];
        todo.sessions = Array.isArray(todo.sessions) ? todo.sessions.map(item => ({ ...item })) : [];
        if (todo.isExclusive) {
          todo.sourceType = 'record';
          todo.sourceRecordId = recordId;
        }
        return todo;
      });
      data.todos.push(...created);
      todoIds = created.map(todo => todo.id);
      record.todoIds = todoIds;
      record.updatedAt = now;
    });
    return todoIds;
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
  return { ideas, materials, addRecord, updateRecord, addTemplate, deleteTemplate, replaceRecordTodosFromTemplate, linkExistingTodo, createExclusiveTodo, removeLinkedTodo, addIdea, setIdeaStatus, linkIdeaTodo, addMaterial, remove, services };
});
