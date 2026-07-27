<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import TodoTable from '../components/TodoTable.vue';
import { useTodosStore } from '../stores/todosStore';

const todosStore = useTodosStore();
const query = ref('');
const status = ref<'all' | 'open' | 'done'>('all');
const urgency = ref('all');
const form = reactive({ text: '', note: '', dueDate: '', planStartDate: '', planEndDate: '', urgency: 'medium' as const, group: '其他' });

const filteredTodos = computed(() => todosStore.todos
  .filter(todo => status.value === 'all' || (status.value === 'done' ? todo.done : !todo.done))
  .filter(todo => urgency.value === 'all' || todo.urgency === urgency.value)
  .filter(todo => [todo.text, todo.note, todo.group].join(' ').toLowerCase().includes(query.value.trim().toLowerCase()))
  .slice().sort(todosStore.services.todos.compareTodosForFocus));

function submit() {
  if (!form.text.trim()) return;
  todosStore.create({ ...form, text: form.text.trim() });
  Object.assign(form, { text: '', note: '', dueDate: '', planStartDate: '', planEndDate: '', urgency: 'medium', group: '其他' });
}
</script>

<template>
  <section class="page active" id="page-todos">
    <header class="page-header"><div class="page-title">待办总览</div></header>
    <form class="card todo-create-form" @submit.prevent="submit"><div class="card-title">新建待办</div><div class="form-row"><div class="form-group"><label>任务</label><input v-model="form.text" required placeholder="下一步要推进什么？" /></div><div class="form-group"><label>分组</label><input v-model="form.group" /></div><div class="form-group"><label>截止日期</label><input v-model="form.dueDate" type="date" /></div><div class="form-group"><label>紧急度</label><select v-model="form.urgency"><option value="urgent">紧急</option><option value="high">高</option><option value="medium">中</option><option value="low">低</option></select></div></div><div class="form-group"><label>备注</label><input v-model="form.note" placeholder="可选备注" /></div><button class="btn btn-primary" type="submit">保存待办</button></form>
    <div class="filter-bar"><input v-model="query" type="search" placeholder="搜索待办" /><select v-model="status"><option value="all">全部状态</option><option value="open">未完成</option><option value="done">已完成</option></select><select v-model="urgency"><option value="all">全部紧急度</option><option value="urgent">紧急</option><option value="high">高</option><option value="medium">中</option><option value="low">低</option></select></div>
    <TodoTable :todos="filteredTodos" @toggle="todosStore.toggle" @remove="todosStore.remove" />
  </section>
</template>
