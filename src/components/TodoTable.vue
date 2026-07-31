<script setup lang="ts">
import { computed } from 'vue';

import { createLegacyServices } from '../services/legacyServices';
import type { DataEntity, Todo } from '../types/lifePlan';
import { useLifePlanStore } from '../stores/lifePlanStore';

const props = defineProps<{ todos: Todo[]; selectedId?: string }>();
const emit = defineEmits<{ toggle: [id: string]; select: [id: string] }>();

const lifePlan = useLifePlanStore();
const services = createLegacyServices();

function linkedRecordNames(todo: Todo) {
  const names = lifePlan.data.records
    .filter(record => {
      const todoIds = Array.isArray(record.todoIds) ? record.todoIds.map(String) : [];
      return todoIds.includes(todo.id) || String(record.ideaTodoId || '') === todo.id;
    })
    .map(record => String(record.title || record.type || '未命名记录'));
  return names.join('、') || '无归属';
}

function planMeta(todo: Todo) {
  const plan = services.todos.getTodoPlanLabel(todo);
  const sessions = (todo.sessions || []).length;
  const subDone = (todo.subTodos || []).filter(item => item.done).length;
  const subTotal = (todo.subTodos || []).length;
  const parts = [plan, `执行 ${sessions} 次`];
  if (subTotal) parts.unshift(`${subDone}/${subTotal}`);
  return parts.join(' · ');
}

function dueClass(todo: Todo) {
  return todo.dueDate ? 'todo-due' : 'todo-due todo-due-none';
}

function groupClass(group: string) {
  const safe = String(group || '其他').replace(/[^\w\u4e00-\u9fff-]+/g, '-').toLowerCase() || 'todo-group';
  return `tag tag-${safe}`;
}

const rows = computed(() => props.todos.map(todo => ({
  todo,
  dueText: services.todos.formatTodoDueDate(todo),
  urgencyLabel: services.todos.getTodoUrgencyMeta(todo).label,
  planMeta: planMeta(todo),
  linked: linkedRecordNames(todo),
})));
</script>

<template>
  <div v-if="rows.length" class="todo-table-shell">
    <table class="todo-table">
      <thead>
        <tr>
          <th style="width: 36px;"></th>
          <th>任务名称</th>
          <th style="width: 110px;">截止日期</th>
          <th style="width: 86px;">紧急度</th>
          <th style="width: 80px;">分组</th>
          <th style="width: 80px;">模式</th>
          <th>关联记录</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in rows"
          :key="row.todo.id"
          :class="{ done: row.todo.done, selected: row.todo.id === selectedId }"
        >
          <td>
            <input
              :checked="row.todo.done"
              type="checkbox"
              :aria-label="`完成 ${row.todo.text}`"
              @change="emit('toggle', row.todo.id)"
            >
          </td>
          <td
            class="todo-title-cell"
            :class="{ 'is-done': row.todo.done }"
            role="button"
            tabindex="0"
            @click="emit('select', row.todo.id)"
            @keydown.enter.prevent="emit('select', row.todo.id)"
          >
            {{ row.todo.text || '未命名待办' }}
            <span v-if="row.todo.subTodos?.length" class="todo-subtodo-count">
              ({{ row.todo.subTodos.filter(item => item.done).length }}/{{ row.todo.subTodos.length }})
            </span>
            <div class="todo-title-meta">{{ row.planMeta }}</div>
          </td>
          <td><span :class="dueClass(row.todo)">{{ row.dueText }}</span></td>
          <td>
            <span :class="`todo-urgency todo-urgency-${row.todo.urgency || 'medium'}`">{{ row.urgencyLabel }}</span>
          </td>
          <td><span :class="groupClass(row.todo.group || '其他')">{{ row.todo.group || '其他' }}</span></td>
          <td>{{ row.todo.isExclusive ? '专属' : '通用' }}</td>
          <td class="todo-linked-cell">{{ row.linked }}</td>
        </tr>
      </tbody>
    </table>
  </div>
  <div v-else class="empty-state">暂无符合条件的待办</div>
</template>
