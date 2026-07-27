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
    lifePlan.mutate('toggle-todo', data => {
      const todo = data.todos.find(item => item.id === id);
      if (todo) services.todos.toggleTodoDone(todo);
    });
  }

  function create(input: Pick<Todo, 'text' | 'note' | 'dueDate' | 'planStartDate' | 'planEndDate' | 'urgency' | 'group'>) {
    const range = services.todos.normalizeTodoDateRange(input.planStartDate, input.planEndDate);
    if (!range.isValid) throw new Error('计划开始日期不能晚于结束日期');
    const todo = services.todos.createTodoFromAiItem({
      ...input,
      ...range,
      sourceType: 'manual',
    }) as Todo;
    lifePlan.mutate('create-todo', data => data.todos.unshift(todo));
    return todo;
  }

  function remove(id: string) {
    const todo = lifePlan.data.todos.find(item => item.id === id);
    if (!todo) return;
    lifePlan.mutate('delete-todo', data => {
      services.sync.markDeletedItem(data, 'todos', id, { text: todo.text, reason: 'vue-delete-todo' });
      data.todos = data.todos.filter(item => item.id !== id);
      data.records.forEach(record => {
        const todoIds = Array.isArray(record.todoIds) ? record.todoIds as string[] : [];
        if (todoIds.includes(id)) record.todoIds = todoIds.filter(todoId => todoId !== id);
        if (record.ideaTodoId === id) record.ideaTodoId = '';
      });
    });
  }

  return { todos, toggle, create, remove, services };
});
