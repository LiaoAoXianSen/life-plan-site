import { computed } from 'vue';
import { defineStore } from 'pinia';

import { createLegacyServices, genId, getNowLocal, getTodayStr } from '../services/legacyServices';
import type { Todo, TodoSession, TodoSubTodo } from '../types/lifePlan';
import { useLifePlanStore } from './lifePlanStore';

const services = createLegacyServices();

type TodoDetailInput = Pick<Todo, 'text' | 'note' | 'dueDate' | 'planStartDate' | 'planEndDate' | 'urgency' | 'group'> & {
  subTodos: TodoSubTodo[];
};

type TodoSessionInput = Pick<TodoSession, 'date' | 'startTime' | 'endTime' | 'note'>;

export const useTodosStore = defineStore('todos', () => {
  const lifePlan = useLifePlanStore();
  const todos = computed(() => lifePlan.data.todos);

  function toggle(id: string) {
    lifePlan.mutate('toggle-todo', data => {
      const todo = data.todos.find(item => item.id === id);
      if (todo) services.todos.toggleTodoDone(todo);
    });
  }

  type TodoCreateInput = Pick<Todo, 'text' | 'note' | 'dueDate' | 'planStartDate' | 'planEndDate' | 'urgency' | 'group'> & {
    subTodos?: TodoSubTodo[];
    sourceType?: string;
    sourceRecordId?: string;
  };

  function create(input: TodoCreateInput) {
    const range = services.todos.normalizeTodoDateRange(input.planStartDate, input.planEndDate);
    if (!range.isValid) throw new Error('计划开始日期不能晚于结束日期');
    const todo = services.todos.createTodoFromAiItem({
      ...input,
      ...range,
      subTodos: (input.subTodos || [])
        .map(item => ({ text: String(item.text || '').trim(), done: !!item.done }))
        .filter(item => item.text),
      sourceType: input.sourceType || 'manual',
      sourceRecordId: input.sourceRecordId || '',
    }) as Todo;
    lifePlan.mutate('create-todo', data => data.todos.unshift(todo));
    return todo;
  }

  function update(id: string, input: TodoDetailInput) {
    const text = input.text.trim();
    if (!text) throw new Error('请输入任务名称');
    const range = services.todos.normalizeTodoDateRange(input.planStartDate, input.planEndDate);
    if (!range.isValid) throw new Error('计划结束日期不能早于计划开始日期');
    lifePlan.mutate('update-todo-detail', data => {
      const todo = data.todos.find(item => item.id === id);
      if (!todo) return;
      const stamp = getNowLocal();
      Object.assign(todo, {
        ...input,
        ...range,
        text,
        note: input.note.trim(),
        group: input.group.trim() || '其他',
        subTodos: input.subTodos
          .map(item => ({ text: item.text.trim(), done: !!item.done }))
          .filter(item => item.text),
        updatedAt: stamp,
      });
      services.todos.syncDoneFromSubTodos(todo, stamp);
    });
  }

  function addSession(id: string, input: TodoSessionInput) {
    const date = input.date || getTodayStr();
    if (input.endTime && input.startTime && input.endTime <= input.startTime) {
      throw new Error('结束时间需要晚于开始时间');
    }
    const todo = lifePlan.data.todos.find(item => item.id === id);
    if (!todo) throw new Error('待办不存在');
    if (todo.sessions.some(session => session.date === date)) {
      throw new Error('这个待办当天已经记录过一次执行了');
    }
    const stamp = getNowLocal();
    const session: TodoSession = {
      id: genId(),
      date,
      startTime: input.startTime,
      endTime: input.endTime,
      note: input.note.trim(),
      createdAt: stamp,
    };
    lifePlan.mutate('add-todo-session', data => {
      const target = data.todos.find(item => item.id === id);
      if (!target) return;
      target.sessions.push(session);
      target.updatedAt = stamp;
    });
    return session;
  }

  function removeSession(todoId: string, sessionId: string) {
    lifePlan.mutate('delete-todo-session', data => {
      const todo = data.todos.find(item => item.id === todoId);
      if (!todo) return;
      todo.sessions = todo.sessions.filter(session => session.id !== sessionId);
      todo.updatedAt = getNowLocal();
    });
  }

  function linkRecord(todoId: string, recordId: string) {
    const todo = lifePlan.data.todos.find(item => item.id === todoId);
    const record = lifePlan.data.records.find(item => item.id === recordId);
    if (!todo || !record) throw new Error('待办或记录不存在');
    const todoIds = Array.isArray(record.todoIds) ? record.todoIds.map(String) : [];
    if (todoIds.includes(todoId) || record.ideaTodoId === todoId) return false;
    lifePlan.mutate('link-todo-record', data => {
      const target = data.records.find(item => item.id === recordId);
      if (!target) return;
      const linkedIds = Array.isArray(target.todoIds) ? target.todoIds.map(String) : [];
      target.todoIds = [...linkedIds, todoId];
      target.updatedAt = getNowLocal();
    });
    return true;
  }

  function unlinkRecord(todoId: string, recordId: string) {
    const todo = lifePlan.data.todos.find(item => item.id === todoId);
    const record = lifePlan.data.records.find(item => item.id === recordId);
    if (!todo || !record) throw new Error('待办或记录不存在');
    if (todo.isExclusive && todo.sourceRecordId === recordId) {
      throw new Error('专属待办必须保留来源记录');
    }
    const todoIds = Array.isArray(record.todoIds) ? record.todoIds.map(String) : [];
    if (!todoIds.includes(todoId) && record.ideaTodoId !== todoId) return false;
    lifePlan.mutate('unlink-todo-record', data => {
      const target = data.records.find(item => item.id === recordId);
      if (!target) return;
      target.todoIds = (Array.isArray(target.todoIds) ? target.todoIds.map(String) : []).filter(id => id !== todoId);
      if (target.ideaTodoId === todoId) target.ideaTodoId = '';
      target.updatedAt = getNowLocal();
    });
    return true;
  }

  function remove(id: string) {
    const todo = lifePlan.data.todos.find(item => item.id === id);
    if (!todo) return;
    lifePlan.mutate('delete-todo', data => {
      services.sync.markDeletedItem(data, 'todos', id, { text: todo.text, reason: 'vue-delete-todo' });
      data.todos = data.todos.filter(item => item.id !== id);
      data.records.forEach(record => {
        const todoIds = Array.isArray(record.todoIds) ? record.todoIds as string[] : [];
        let changed = false;
        if (todoIds.includes(id)) {
          record.todoIds = todoIds.filter(todoId => todoId !== id);
          changed = true;
        }
        if (record.ideaTodoId === id) {
          record.ideaTodoId = '';
          changed = true;
        }
        if (changed) record.updatedAt = getNowLocal();
      });
    });
  }

  return { todos, toggle, create, update, addSession, removeSession, linkRecord, unlinkRecord, remove, services };
});
