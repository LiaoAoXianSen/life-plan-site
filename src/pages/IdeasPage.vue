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
const status = ref('all');
const tag = ref(String(route.query.tag || ''));
const title = ref('');
const content = ref('');
const statusOptions = ['待整理', '待实践', '实践中', '已验证', '已放弃'];

const ideas = computed(() => records.services.records.filterIdeas(records.ideas, {
  keyword: query.value,
  statusFilter: status.value,
  tagFilter: tag.value,
  hasMatchingTag: (tags: string[], search: string) => {
    const clean = search.trim().toLowerCase();
    return !clean || tags.some(item => item.toLowerCase().includes(clean));
  },
  getRecordSortValue: (item: Record<string, unknown>) => String(item.updatedAt || item.createdAt || ''),
}));
const unprocessedCount = computed(() => records.ideas.filter(records.services.records.isIdeaUnprocessed).length);
const needsConclusionCount = computed(() => records.ideas.filter(records.services.records.ideaNeedsConclusion).length);

function add() {
  if (!title.value.trim()) return;
  records.addIdea(title.value.trim(), content.value);
  title.value = '';
  content.value = '';
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
  // Open an editable pre-create draft; nothing is written until the user saves.
  void router.push({ path: '/todos', query: { ideaDraft: String(idea.id) } });
}

function removeIdea(idea: Record<string, unknown>) {
  if (!window.confirm(`删除灵感“${String(idea.title || '无标题灵感')}”吗？`)) return;
  records.remove('records', String(idea.id));
}

watch(() => route.query.tag, value => { tag.value = String(value || ''); });
</script>

<template>
  <section class="page active" id="page-ideas">
    <header class="page-header"><div class="page-title">灵感池</div></header>
    <form class="card" @submit.prevent="add">
      <div class="form-row">
        <label class="form-group"><span>新灵感</span><input v-model="title" required placeholder="先接住这个想法" /></label>
        <label class="form-group"><span>补充</span><input v-model="content" placeholder="可选说明" /></label>
      </div>
      <button class="btn btn-primary">加入灵感池</button>
    </form>

    <div class="idea-summary" aria-label="灵感统计">
      <span><strong>{{ records.ideas.length }}</strong> 全部</span>
      <span><strong>{{ unprocessedCount }}</strong> 未处理</span>
      <span><strong>{{ needsConclusionCount }}</strong> 待结论</span>
    </div>
    <div class="filter-bar idea-filter-bar">
      <input v-model="query" type="search" placeholder="搜索标题、正文、下一步和结论" />
      <select v-model="status" aria-label="灵感状态筛选">
        <option value="all">全部状态</option>
        <option value="unprocessed">未处理</option>
        <option value="needsConclusion">已实践待结论</option>
        <option v-for="item in statusOptions" :key="item" :value="item">{{ item }}</option>
      </select>
      <input v-model="tag" aria-label="灵感标签筛选" placeholder="筛选标签" />
    </div>

    <div v-if="ideas.length" class="idea-grid">
      <article v-for="idea in ideas" :key="String(idea.id)" :class="['idea-card', `status-${idea.ideaStatus || '待整理'}`]">
        <div class="idea-card-head">
          <span class="item-type">灵感碎片</span>
          <select :value="idea.ideaStatus || '待整理'" :aria-label="`更新状态 ${idea.title || '无标题灵感'}`" @change="records.setIdeaStatus(String(idea.id), ($event.target as HTMLSelectElement).value)">
            <option v-for="item in statusOptions" :key="item" :value="item">{{ item }}</option>
          </select>
        </div>
        <h2>{{ idea.title || '无标题灵感' }}</h2>
        <p>{{ idea.content || '还没有正文' }}</p>
        <div v-if="records.services.records.getIdeaTags(idea).length" class="idea-tag-list">
          <span v-for="item in records.services.records.getIdeaTags(idea)" :key="item">{{ item }}</span>
        </div>
        <dl class="idea-progress-list">
          <div><dt>下一步</dt><dd>{{ idea.ideaNextAction || '未设置' }}</dd></div>
          <div v-if="idea.ideaConclusion"><dt>结论</dt><dd>{{ idea.ideaConclusion }}</dd></div>
        </dl>
        <div class="idea-card-actions">
          <button class="btn btn-primary" type="button" @click="openEditor(idea)">编辑推进</button>
          <button class="btn btn-secondary" type="button" @click="convert(idea)">{{ getLinkedTodo(idea) ? '打开待办' : '转成待办' }}</button>
          <button class="btn btn-danger" type="button" @click="removeIdea(idea)">删除</button>
        </div>
      </article>
    </div>
    <div v-else class="empty-state">还没有匹配的灵感。</div>
  </section>
</template>

<style scoped>
.idea-summary { display: flex; flex-wrap: wrap; gap: 14px; margin: 0 0 12px; color: var(--muted); font-size: 13px; }
.idea-summary strong { color: var(--text); }
#page-ideas .idea-filter-bar { grid-template-columns: minmax(210px, 1fr) minmax(150px, .45fr) minmax(150px, .45fr); }
.idea-card h2 { margin: 12px 0 8px; font-size: 18px; }
.idea-card > p { color: var(--muted); line-height: 1.65; white-space: pre-wrap; overflow-wrap: anywhere; }
.idea-tag-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.idea-tag-list span { padding: 3px 7px; border-radius: 999px; background: var(--surface-soft); color: var(--muted); font-size: 12px; font-weight: 700; }
.idea-progress-list { display: grid; gap: 8px; margin: 12px 0 0; }
.idea-progress-list div { display: grid; gap: 2px; }
.idea-progress-list dt { color: var(--faint); font-size: 12px; font-weight: 700; }
.idea-progress-list dd { margin: 0; color: var(--text); font-size: 13px; white-space: pre-wrap; overflow-wrap: anywhere; }
.idea-card-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
@media (max-width: 640px) {
  #page-ideas .idea-filter-bar { grid-template-columns: minmax(0, 1fr); }
}
</style>
