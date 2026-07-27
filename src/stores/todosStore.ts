import { computed } from 'vue';
import { defineStore } from 'pinia';

import { createLegacyServices } from '../services/legacyServices';
import type { Todo } from '../types/lifePlan';
import { useLifePlanStore } from './lifePlanStore';

const services = createLegacyServices();

export const useTodosStore = defineStore('todos', () => {
  const lifePlan = useLifePlanStore();
  const todos = computed(() => lifePlan.data.todos);

  function toggle(id: string) {
    const todo = lifePlan.data.todos.find(item => item.id === id);
    if (!todo) return;
    services.todos.toggleTodoDone(todo);
    lifePlan.commit('toggle-todo');
  }

  function create(input: Pick<Todo, 'text' | 'note' | 'dueDate' | 'planStartDate' | 'planEndDate' | 'urgency' | 'group'>) {
    const range = services.todos.normalizeTodoDateRange(input.planStartDate, input.planEndDate);
    if (!range.isValid) throw new Error('计划开始日期不能晚于结束日期');
    const todo = services.todos.createTodoFromAiItem({
      ...input,
      ...range,
      sourceType: 'manual',
    }) as Todo;
    lifePlan.data.todos.unshift(todo);
    lifePlan.commit('create-todo');
  }

  function remove(id: string) {
    const todo = lifePlan.data.todos.find(item => item.id === id);
    if (!todo) return;
    services.sync.markDeletedItem(lifePlan.data, 'todos', id, { text: todo.text, reason: 'vue-delete-todo' });
    lifePlan.data.todos = lifePlan.data.todos.filter(item => item.id !== id);
    lifePlan.data.records.forEach(record => {
      const todoIds = Array.isArray(record.todoIds) ? record.todoIds as string[] : [];
      if (todoIds.includes(id)) record.todoIds = todoIds.filter(todoId => todoId !== id);
      if (record.ideaTodoId === id) record.ideaTodoId = '';
    });
    lifePlan.commit('delete-todo');
  }

  return { todos, toggle, create, remove, services };
});
