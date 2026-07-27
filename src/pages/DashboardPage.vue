<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { getTodayStr } from '../services/legacyServices';
import { useLifePlanStore } from '../stores/lifePlanStore';
import { useTodosStore } from '../stores/todosStore';

const router = useRouter();
const lifePlan = useLifePlanStore();
const todosStore = useTodosStore();
const today = getTodayStr();

const todayTodos = computed(() => lifePlan.data.todos
  .filter(todo => !todo.done && (todo.dueDate === today || (todo.planStartDate <= today && todo.planEndDate >= today) || todo.sessions.some(session => session.date === today)))
  .sort(todosStore.services.todos.compareTodosForFocus));
const floatingTodos = computed(() => lifePlan.data.todos.filter(todo => !todo.done && !todo.dueDate && !todo.planStartDate).sort(todosStore.services.todos.compareTodosForFocus).slice(0, 5));
const todayCheckins = computed(() => lifePlan.data.checkins.filter(checkin => checkin.date === today).length);
const activeGoals = computed(() => lifePlan.data.goals.filter(goal => goal.status !== '已完成').length);
const weekRecords = computed(() => lifePlan.data.records.filter(record => String(record.startDate || '') >= new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10)).length);
</script>

<template>
  <section class="page active" id="page-dashboard">
    <header class="page-header"><div class="page-title">首页仪表盘</div><button class="btn btn-primary" type="button" @click="router.push('/todos')">+ 新建待办</button></header>
    <div class="dashboard-hero">
      <div class="hero-panel"><div><div class="hero-date">{{ today }}</div><h1 class="hero-title">今天先把最重要的事推进一点</h1><div class="hero-meta"><span>Vue 迁移版 · 本地数据已加载</span></div></div><div class="quick-create"><button class="btn" type="button" @click="router.push('/todos')">加待办</button><button class="btn" type="button" @click="router.push('/records')">查看记录</button></div></div>
      <div class="summary-grid"><div class="summary-card"><strong class="summary-value">{{ todayTodos.length }}</strong><span class="summary-label">今日待办</span></div><div class="summary-card"><strong class="summary-value">{{ todayCheckins }}</strong><span class="summary-label">今日习惯</span></div><div class="summary-card"><strong class="summary-value">{{ activeGoals }}</strong><span class="summary-label">进行目标</span></div><div class="summary-card"><strong class="summary-value">{{ weekRecords }}</strong><span class="summary-label">本周记录</span></div></div>
    </div>
    <div class="today-grid">
      <article class="card"><h2 class="card-title">今日待办</h2><div v-if="todayTodos.length" class="todo-list"><label v-for="todo in todayTodos" :key="todo.id" class="todo-item"><input type="checkbox" :checked="todo.done" @change="todosStore.toggle(todo.id)" /><span class="todo-text">{{ todo.text }}</span></label></div><div v-else class="empty-state">今天没有已安排的待办。</div></article>
      <article class="card"><h2 class="card-title">无截止待办池</h2><div v-if="floatingTodos.length" class="todo-list"><label v-for="todo in floatingTodos" :key="todo.id" class="todo-item"><input type="checkbox" :checked="todo.done" @change="todosStore.toggle(todo.id)" /><span class="todo-text">{{ todo.text }}</span></label></div><div v-else class="empty-state">待办池是空的。</div></article>
      <article class="card"><h2 class="card-title">迁移状态</h2><p class="migration-copy">当前首页与待办数据已改为 Vue 状态层读取。复杂的习惯、同步与快照交互将继续保留原有数据契约后逐步迁入。</p></article>
    </div>
  </section>
</template>
