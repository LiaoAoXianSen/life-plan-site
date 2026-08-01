<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useRecordsStore } from '../stores/recordsStore';
import { useTodosStore } from '../stores/todosStore';

const records = useRecordsStore();
const todos = useTodosStore();
const route = useRoute();
const router = useRouter();
const query = ref('');
const status = ref(String(route.query.status || 'all') || 'all');
const tag = ref(String(route.query.tag || ''));
const title = ref('');
const content = ref('');
const showCreate = ref(false);
const statusOptions = ['待整理', '待实践', '实践中', '已验证', '已放弃'] as const;

type KpiItem = { key: string; label: string; count: number };

const ideas = computed(() => records.services.records.filterIdeas(records.ideas, {
  keyword: query.value,
  statusFilter: status.value,
  tagFilter: tag.value,
  hasMatchingTag: (tags: string[], search: string) => {
    const clean = search.trim().toLowerCase();
    return !clean || tags.some(item => item.toLowerCase().includes(clean));
  },
  getRecordSortValue: (item: Record<string, unknown>) => item.startDate && item.recordTime
    ? `${String(item.startDate)}T${String(item.recordTime)}:00`
    : String(item.createdAt || item.updatedAt || `${item.startDate || item.endDate || '0000-00-00'}T00:00:00`),
}));

const kpiItems = computed<KpiItem[]>(() => {
  const all = records.ideas;
  const getStatus = records.services.records.getIdeaStatus;
  return [
    { key: 'all', label: '全部灵感', count: all.length },
    { key: 'unprocessed', label: '未处理', count: all.filter(records.services.records.isIdeaUnprocessed).length },
    ...statusOptions.map(item => ({
      key: item,
      label: item,
      count: all.filter(idea => getStatus(idea) === item).length,
    })),
  ];
});

function setStatusFilter(next: string) {
  status.value = next;
}

function ideaStatus(idea: Record<string, unknown>) {
  return records.services.records.getIdeaStatus(idea);
}

function truncatePreview(text: unknown, maxLen = 80) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '还没有正文';
  if (normalized.length <= maxLen) return normalized;
  return `${normalized.slice(0, maxLen).trimEnd()}…`;
}

function add() {
  if (!title.value.trim()) return;
  records.addIdea(title.value.trim(), content.value);
  title.value = '';
  content.value = '';
  showCreate.value = false;
}

function openView(idea: Record<string, unknown>) {
  void router.push({ path: '/records', query: { record: String(idea.id) } });
}

function openEditor(idea: Record<string, unknown>) {
  void router.push({ path: '/records', query: { record: String(idea.id) } });
}

function getLinkedTodo(idea: Record<string, unknown>) {
  return idea.ideaTodoId ? todos.todos.find(todo => todo.id === idea.ideaTodoId) : undefined;
}

function convert(idea: Record<string, unknown>) {
  const linkedTodo = getLinkedTodo(idea);
  if (linkedTodo) {
    void router.push({ path: '/todos', query: { todo: linkedTodo.id } });
    return;
  }
  void router.push({ path: '/todos', query: { ideaDraft: String(idea.id) } });
}

watch(() => route.query.tag, value => { tag.value = String(value || ''); });
watch(() => route.query.status, value => {
  const next = String(value || 'all') || 'all';
  if (next !== status.value) status.value = next;
});
</script>

<template>
  <section class="page active" id="page-ideas">
    <header class="page-header">
      <div>
        <div class="page-title">灵感池</div>
        <p class="page-subtitle">灵感仍然是时间轴记录，这里只负责状态、标签和下一步。</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" type="button" :aria-expanded="showCreate" @click="showCreate = !showCreate">
          {{ showCreate ? '收起' : '+ 记录灵感' }}
        </button>
      </div>
    </header>

    <form v-if="showCreate" class="card idea-create-card" @submit.prevent="add">
      <div class="form-row">
        <label class="form-group"><span>新灵感</span><input v-model="title" required placeholder="先接住这个想法" /></label>
        <label class="form-group"><span>补充</span><input v-model="content" placeholder="可选说明" /></label>
      </div>
      <div class="idea-create-actions">
        <button class="btn btn-primary" type="submit">加入灵感池</button>
        <button class="btn btn-secondary" type="button" @click="showCreate = false">取消</button>
      </div>
    </form>

    <div class="filter-bar idea-filter-bar">
      <input v-model="query" type="search" placeholder="搜索灵感标题、内容、标签" />
      <select v-model="status" aria-label="灵感状态筛选">
        <option value="all">全部状态</option>
        <option value="unprocessed">未处理</option>
        <option value="needsConclusion">已实践未写结论</option>
        <option v-for="item in statusOptions" :key="item" :value="item">{{ item }}</option>
      </select>
      <input v-model="tag" aria-label="灵感标签筛选" placeholder="按标签，例如 AI / 工作" />
    </div>

    <div class="mini-summary-grid idea-summary-grid" aria-label="灵感统计">
      <button
        v-for="item in kpiItems"
        :key="item.key"
        type="button"
        class="mini-summary-card idea-kpi-card"
        :class="{ 'is-active': status === item.key }"
        :aria-pressed="status === item.key"
        :aria-label="`筛选 ${item.label}`"
        @click="setStatusFilter(item.key)"
      >
        <strong>{{ item.count }}</strong>
        <span>{{ item.label }}</span>
      </button>
    </div>

    <div v-if="ideas.length" class="idea-grid">
      <article
        v-for="idea in ideas"
        :key="String(idea.id)"
        :class="['idea-card', `status-${ideaStatus(idea)}`]"
      >
        <div class="idea-card-head">
          <span class="item-type type-灵感碎片">灵感碎片</span>
          <div class="idea-badge-row">
            <span :class="['idea-status-badge', `status-${ideaStatus(idea)}`]">{{ ideaStatus(idea) }}</span>
            <span v-for="item in records.services.records.getIdeaTags(idea)" :key="item" class="tag-pill">{{ item }}</span>
          </div>
        </div>
        <h3>{{ idea.title || '未命名灵感' }}</h3>
        <div class="idea-card-preview" :title="String(idea.content || '').replace(/\s+/g, ' ').trim()">
          {{ truncatePreview(idea.content) }}
        </div>
        <div class="idea-card-actions">
          <button class="btn btn-secondary" type="button" @click="openView(idea)">查看</button>
          <button class="btn btn-secondary" type="button" @click="convert(idea)">{{ getLinkedTodo(idea) ? '打开待办' : '转成待办' }}</button>
          <button class="btn btn-primary" type="button" @click="openEditor(idea)">编辑推进</button>
        </div>
      </article>
    </div>
    <div v-else class="empty-state idea-empty">暂无匹配的灵感</div>
  </section>
</template>

<style scoped>
.idea-create-card { margin-bottom: 14px; }
.idea-create-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
#page-ideas .idea-filter-bar {
  grid-template-columns: minmax(220px, 1.4fr) minmax(140px, .7fr) minmax(180px, 1fr);
  margin-bottom: 12px;
}
.idea-kpi-card {
  width: 100%;
  text-align: left;
  cursor: pointer;
  transition: border-color .16s ease, background .16s ease, transform .14s ease;
}
.idea-kpi-card:hover {
  background: var(--surface-soft);
  border-color: rgba(33, 110, 78, .18);
  transform: translateY(-1px);
}
.idea-kpi-card.is-active {
  border-color: rgba(33, 110, 78, .34);
  background: var(--accent-soft);
  box-shadow: 0 0 0 1px rgba(33, 110, 78, .08);
}
.idea-card-meta {
  display: grid;
  gap: 4px;
  margin-top: 10px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.idea-empty {
  min-height: 130px;
  display: grid;
  place-items: center;
}
@media (max-width: 640px) {
  #page-ideas .idea-filter-bar { grid-template-columns: minmax(0, 1fr); }
}
</style>
