<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router';

import { useLifePlanStore } from '../stores/lifePlanStore';
import type { DataEntity, Todo } from '../types/lifePlan';

type SearchItem = {
  module: string;
  label: string;
  id: string;
  title: string;
  subtitle: string;
  body: string;
  tags: string[];
  meta: string;
  target: RouteLocationRaw;
};

const moduleLabels: Record<string, string> = {
  records: '记录',
  todos: '待办',
  goals: '目标',
  materials: '素材库',
  templates: '模板',
  wheel: '转盘公共项',
};
const store = useLifePlanStore();
const route = useRoute();
const router = useRouter();
const query = ref(String(route.query.q || ''));
const scope = ref(String(route.query.scope || 'all'));

function normalizeTags(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : String(value || '').split(/[,，、;；/\s]+/);
  return Array.from(new Set(raw.map(tag => String(tag || '').trim()).filter(Boolean)));
}

function formatRecordRange(record: DataEntity) {
  const start = String(record.startDate || '');
  const end = String(record.endDate || start || '');
  return start && end && start !== end ? `${start} ~ ${end}` : start || end || '未设置日期';
}

function formatTodoDate(todo: Todo) {
  if (todo.dueDate) return `截止 ${todo.dueDate}`;
  if (todo.planStartDate || todo.planEndDate) return `计划 ${todo.planStartDate || '-'} ~ ${todo.planEndDate || '-'}`;
  return '未设置日期';
}

function formatStoredDateTime(value: unknown) {
  const raw = String(value || '');
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return raw.replace('T', ' ');
  return `${match[1]}年${Number(match[2])}月${Number(match[3])}日 ${match[4]}:${match[5]}:${match[6] || '00'}`;
}

function wheelTagNames(tagIds: unknown) {
  const ids = Array.isArray(tagIds) ? tagIds.map(String) : [];
  return ids.map(id => store.data.wheelTags.find(tag => tag.id === id)?.name).filter(Boolean) as string[];
}

const indexItems = computed<SearchItem[]>(() => {
  const recordItems = store.data.records.map(record => ({
    module: 'records',
    label: moduleLabels.records,
    id: String(record.id || ''),
    title: String(record.title || record.type || '未命名记录'),
    subtitle: `${record.type || '记录'} · ${formatRecordRange(record)}`,
    body: String(record.content || ''),
    tags: record.type === '灵感碎片' ? normalizeTags(record.ideaTags) : [],
    meta: [record.ideaStatus, record.ideaNextAction, record.ideaConclusion].filter(Boolean).join(' '),
    target: { path: '/records', query: { record: String(record.id || '') } },
  }));
  const todoItems = store.data.todos.map(todo => ({
    module: 'todos',
    label: moduleLabels.todos,
    id: String(todo.id || ''),
    title: todo.text || '未命名待办',
    subtitle: `${todo.group || '其他'} · ${todo.done ? '已完成' : '未完成'} · ${formatTodoDate(todo)}`,
    body: [todo.note, todo.planStartDate, todo.planEndDate, ...(todo.subTodos || []).map(item => item.text), ...(todo.sessions || []).map(item => item.note)].filter(Boolean).join(' '),
    tags: [todo.group || '其他'],
    meta: todo.urgency || '',
    target: { path: '/todos', query: { todo: todo.id } },
  }));
  const goalItems = store.data.goals.map(goal => ({
    module: 'goals',
    label: moduleLabels.goals,
    id: String(goal.id || ''),
    title: String(goal.name || '未命名目标'),
    subtitle: `${goal.status || '进行中'} · ${goal.period || '未设置周期'}`,
    body: `${goal.target || ''} ${goal.progress || 0}%`,
    tags: [goal.status, goal.period].filter(Boolean).map(String),
    meta: String(goal.target || ''),
    target: { path: '/goals', query: { goal: String(goal.id || '') } },
  }));
  const materialItems = store.data.materials.map(material => ({
    module: 'materials',
    label: moduleLabels.materials,
    id: String(material.id || ''),
    title: String(material.content || '').slice(0, 42) || '空素材',
    subtitle: `${material.type || '素材'} · ${formatStoredDateTime(material.createdAt)}`,
    body: `${material.content || ''} ${material.source || ''} ${material.note || ''}`,
    tags: normalizeTags(material.tags),
    meta: String(material.source || material.note || ''),
    target: { path: '/materials', query: { material: String(material.id || '') } },
  }));
  const templateItems = store.data.templates.map(template => ({
    module: 'templates',
    label: moduleLabels.templates,
    id: String(template.id || ''),
    title: String(template.name || '未命名模板'),
    subtitle: String(template.type || '模板'),
    body: `${template.content || ''} ${(Array.isArray(template.todos) ? template.todos : []).map(todo => todo.text).join(' ')}`,
    tags: [template.type].filter(Boolean).map(String),
    meta: `${Array.isArray(template.todos) ? template.todos.length : 0} 个模板待办`,
    target: { path: '/records', query: { template: String(template.id || '') } },
  }));
  const wheelItems = store.data.wheelLibraryItems.map(item => {
    const tags = wheelTagNames(item.tagIds);
    return {
      module: 'wheel',
      label: moduleLabels.wheel,
      id: String(item.id || ''),
      title: String(item.name || '未命名公共项'),
      subtitle: `转盘公共项 · 权重 ${item.weight || 1}`,
      body: String(item.note || ''),
      tags,
      meta: item.enabled === false ? '已停用' : '启用中',
      target: { path: '/wheel', query: { library: String(item.id || '') } },
    };
  });
  return [...recordItems, ...todoItems, ...goalItems, ...materialItems, ...templateItems, ...wheelItems];
});

function matches(item: SearchItem, keyword: string) {
  const haystack = [item.module, item.title, item.subtitle, item.body, item.meta, ...item.tags]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(keyword);
}

const results = computed(() => {
  const keyword = query.value.trim().toLowerCase();
  if (!keyword) return [];
  return indexItems.value
    .filter(item => scope.value === 'all' || item.module === scope.value)
    .filter(item => matches(item, keyword));
});

const groupedResults = computed(() => Object.entries(results.value.reduce<Record<string, SearchItem[]>>((groups, item) => {
  if (!groups[item.module]) groups[item.module] = [];
  groups[item.module].push(item);
  return groups;
}, {})));

watch(() => route.query.q, value => { query.value = String(value || ''); });
watch(() => route.query.scope, value => { scope.value = String(value || 'all'); });

function search() {
  router.replace({ query: query.value ? { q: query.value, ...(scope.value !== 'all' ? { scope: scope.value } : {}) } : {} });
}
</script>

<template>
  <section class="page active" id="page-search">
    <header class="page-header">
      <div>
        <div class="page-title">全局搜索</div>
        <p class="page-subtitle">跨记录、待办、目标、素材、模板和转盘公共项搜索。</p>
      </div>
    </header>
    <form class="global-search-panel search-panel" @submit.prevent="search">
      <input v-model="query" type="search" aria-label="全局搜索关键词" placeholder="搜索记录、待办、目标、素材、模板与转盘项" />
      <select v-model="scope" aria-label="搜索范围">
        <option value="all">全部模块</option>
        <option v-for="(label, key) in moduleLabels" :key="key" :value="key">{{ label }}</option>
      </select>
      <button class="btn btn-primary">搜索</button>
    </form>
    <div v-if="query" class="mini-summary-row search-summary" aria-label="搜索结果摘要">
      <div v-for="(label, key) in moduleLabels" :key="key" class="mini-summary-card"><strong>{{ results.filter(item => item.module === key).length }}</strong><span>{{ label }}</span></div>
    </div>
    <div class="search-results">
      <section v-for="[module, items] in groupedResults" :key="module" class="search-group">
        <div class="search-group-title">{{ moduleLabels[module] || module }} · {{ items.length }}</div>
        <div class="search-result-list">
          <article v-for="result in items" :key="`${result.module}:${result.id}`" class="search-result-item" @click="router.push(result.target)">
            <div class="search-result-main">
              <strong>{{ result.title }}</strong>
              <span>{{ result.subtitle }}</span>
              <p v-if="result.body">{{ result.body.replace(/\s+/g, ' ').slice(0, 120) }}</p>
              <div v-if="result.tags.length" class="idea-badge-row"><span v-for="tag in result.tags" :key="tag" class="tag-pill">{{ tag }}</span></div>
            </div>
            <span class="material-type">{{ result.label }}</span>
          </article>
        </div>
      </section>
      <div v-if="query && !results.length" class="empty-state">没有找到匹配内容</div>
      <div v-if="!query" class="empty-state">输入关键词后开始搜索，或选择一个模块缩小范围。</div>
    </div>
  </section>
</template>

<style scoped>
.search-panel { grid-template-columns: minmax(0, 1fr) minmax(150px, .32fr) auto; }
.search-summary { margin: 14px 0; }
.search-result-main { min-width: 0; }
.search-result-main strong,
.search-result-main span,
.search-result-main p {
  overflow-wrap: anywhere;
}
@media (max-width: 700px) {
  .search-panel { grid-template-columns: minmax(0, 1fr); }
}
</style>
