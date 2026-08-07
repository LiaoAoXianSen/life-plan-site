<script setup lang="ts">
import EmptyState from '../components/common/EmptyState.vue';
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppSelect from '../components/common/AppSelect.vue';
import FilterBar from '../components/common/FilterBar.vue';
import PageHeader from '../components/common/PageHeader.vue';
import RecordCreateModal from '../components/RecordCreateModal.vue';
import SearchInput from '../components/common/SearchInput.vue';
import { withReturnTo } from '../router/returnTo';
import { useRecordsStore } from '../stores/recordsStore';
import { useTodosStore } from '../stores/todosStore';

const records = useRecordsStore();
const todos = useTodosStore();
const route = useRoute();
const router = useRouter();
const query = ref('');
const status = ref(String(route.query.status || 'all') || 'all');
const tag = ref(String(route.query.tag || ''));
const showCreateRecord = ref(false);
const createModal = ref<InstanceType<typeof RecordCreateModal> | null>(null);
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

function createIdea() {
  createModal.value?.openWithType('灵感碎片');
}

function openExistingFromCreate(recordId: string) {
  showCreateRecord.value = false;
  void router.push(withReturnTo(route, { path: '/records', query: { record: recordId } }));
}

function openView(idea: Record<string, unknown>) {
  void router.push(withReturnTo(route, { path: '/records', query: { record: String(idea.id), preview: '1' } }));
}

function openEditor(idea: Record<string, unknown>) {
  void router.push(withReturnTo(route, { path: '/records', query: { record: String(idea.id) } }));
}

function getLinkedTodo(idea: Record<string, unknown>) {
  return idea.ideaTodoId ? todos.todos.find(todo => todo.id === idea.ideaTodoId) : undefined;
}

function convert(idea: Record<string, unknown>) {
  const linkedTodo = getLinkedTodo(idea);
  if (linkedTodo) {
    void router.push(withReturnTo(route, { path: '/todos', query: { todo: linkedTodo.id } }));
    return;
  }
  void router.push(withReturnTo(route, { path: '/todos', query: { ideaDraft: String(idea.id) } }));
}

watch(() => route.query.tag, value => { tag.value = String(value || ''); });
watch(() => route.query.status, value => {
  const next = String(value || 'all') || 'all';
  if (next !== status.value) status.value = next;
});
</script>

<template>
  <section class="page active" id="page-ideas">
    <PageHeader title="灵感池" subtitle="灵感仍然是时间轴记录，这里只负责状态、标签和下一步。">
      <template #actions>
        <button class="btn btn-primary" type="button" @click="createIdea">
          + 记录灵感
        </button>
      </template>
    </PageHeader>

    <RecordCreateModal ref="createModal" v-model="showCreateRecord" @open-existing="openExistingFromCreate" />
    <FilterBar class="idea-filter-bar">
      <SearchInput v-model="query" aria-label="搜索灵感" placeholder="搜索灵感标题、内容、标签" />
      <AppSelect
        v-model="status"
        aria-label="灵感状态筛选"
        :options="[
          { value: 'all', label: '全部状态' },
          { value: 'unprocessed', label: '未处理' },
          { value: 'needsConclusion', label: '已实践未写结论' },
          ...statusOptions.map(item => ({ value: item, label: item })),
        ]"
      />
      <SearchInput v-model="tag" aria-label="灵感标签筛选" placeholder="按标签，例如 AI / 工作" />
    </FilterBar>

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
    <EmptyState v-else class="empty-state idea-empty">暂无匹配的灵感</EmptyState>
  </section>
</template>

<style scoped>
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
