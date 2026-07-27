<script setup lang="ts">
import type { Todo } from '../types/lifePlan';

defineProps<{ todos: Todo[]; selectedId?: string }>();
const emit = defineEmits<{ toggle: [id: string]; select: [id: string] }>();

const urgencyLabel: Record<Todo['urgency'], string> = { urgent: '紧急', high: '高', medium: '中', low: '低' };

function subTodoSummary(todo: Todo) {
  if (!todo.subTodos.length) return '';
  return `子任务 ${todo.subTodos.filter(item => item.done).length}/${todo.subTodos.length}`;
}
</script>

<template>
  <div v-if="todos.length" class="todo-table-shell">
    <table class="todo-table">
      <thead>
        <tr><th>完成</th><th>任务</th><th>计划 / 截止</th><th>紧急度</th><th>分组</th><th aria-label="操作"></th></tr>
      </thead>
      <tbody>
        <tr v-for="todo in todos" :key="todo.id" :class="{ done: todo.done, selected: todo.id === selectedId }">
          <td><input :checked="todo.done" type="checkbox" :aria-label="`完成 ${todo.text}`" @change="emit('toggle', todo.id)" /></td>
          <td class="todo-title-cell"><button class="todo-title-button" type="button" @click="emit('select', todo.id)"><strong>{{ todo.text || '未命名待办' }}</strong><small v-if="todo.note">{{ todo.note }}</small><small v-if="subTodoSummary(todo)">{{ subTodoSummary(todo) }} · 执行 {{ todo.sessions.length }} 次</small></button></td>
          <td><span class="todo-due">{{ todo.dueDate || todo.planStartDate || '无日期' }}</span></td>
          <td><span :class="`todo-urgency todo-urgency-${todo.urgency}`">{{ urgencyLabel[todo.urgency] }}</span></td>
          <td>{{ todo.group || '其他' }}</td>
          <td><button class="btn btn-secondary" type="button" @click="emit('select', todo.id)">详情</button></td>
        </tr>
      </tbody>
    </table>
  </div>
  <div v-else class="empty-state">还没有符合条件的待办。</div>
</template>
