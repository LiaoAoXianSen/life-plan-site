<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

import { useLifePlanStore } from '../stores/lifePlanStore';
import type { DataEntity } from '../types/lifePlan';

type TagCenterItem = {
  name: string;
  ideas: DataEntity[];
  materials: DataEntity[];
  wheelItems: DataEntity[];
  wheelTags: DataEntity[];
};

const store = useLifePlanStore();
const router = useRouter();
const keyword = ref('');
const scope = ref('all');

function normalizeTags(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : String(value || '').split(/[,，、;；/\s]+/);
  return Array.from(new Set(raw.map(tag => String(tag || '').trim()).filter(Boolean)));
}

function getTagItems() {
  const map = new Map<string, TagCenterItem>();
  const ensure = (name: unknown) => {
    const clean = String(name || '').trim();
    if (!clean) return null;
    const key = clean.toLowerCase();
    if (!map.has(key)) map.set(key, { name: clean, ideas: [], materials: [], wheelItems: [], wheelTags: [] });
    return map.get(key)!;
  };
  store.data.records
    .filter(record => record.type === '灵感碎片')
    .forEach(record => normalizeTags(record.ideaTags).forEach(tag => ensure(tag)?.ideas.push(record)));
  store.data.materials.forEach(material => normalizeTags(material.tags).forEach(tag => ensure(tag)?.materials.push(material)));
  store.data.wheelTags.forEach(tag => ensure(tag.name)?.wheelTags.push(tag));
  store.data.wheelLibraryItems.forEach(item => {
    const ids = Array.isArray(item.tagIds) ? item.tagIds.map(String) : [];
    ids.forEach(id => {
      const tag = store.data.wheelTags.find(candidate => candidate.id === id);
      ensure(tag?.name)?.wheelItems.push(item);
    });
  });
  return [...map.values()].sort((a, b) => {
    const totalA = a.ideas.length + a.materials.length + a.wheelItems.length + a.wheelTags.length;
    const totalB = b.ideas.length + b.materials.length + b.wheelItems.length + b.wheelTags.length;
    return totalB - totalA || a.name.localeCompare(b.name, 'zh-CN');
  });
}

const allItems = computed(getTagItems);
const filteredItems = computed(() => allItems.value
  .filter(item => {
    if (scope.value === 'ideas') return item.ideas.length > 0;
    if (scope.value === 'materials') return item.materials.length > 0;
    if (scope.value === 'wheel') return item.wheelItems.length > 0 || item.wheelTags.length > 0;
    return true;
  })
  .filter(item => !keyword.value.trim() || item.name.toLowerCase().includes(keyword.value.trim().toLowerCase())));
const summary = computed(() => ({
  all: allItems.value.length,
  ideas: allItems.value.filter(item => item.ideas.length).length,
  materials: allItems.value.filter(item => item.materials.length).length,
  wheel: allItems.value.filter(item => item.wheelItems.length || item.wheelTags.length).length,
  filtered: filteredItems.value.length,
}));

function firstId(items: DataEntity[]) {
  return String(items[0]?.id || '');
}

function totalCount(item: TagCenterItem) {
  return item.ideas.length + item.materials.length + item.wheelItems.length;
}
</script>

<template>
  <section class="page active" id="page-tags">
    <header class="page-header">
      <div>
        <div class="page-title">标签中心</div>
        <p class="page-subtitle">先统一查看灵感、素材和转盘标签，避免标签体系越用越散。</p>
      </div>
    </header>

    <div class="filter-bar tag-filter-bar">
      <input v-model="keyword" type="search" aria-label="搜索标签" placeholder="搜索标签，例如 AI / 工作 / 学习" />
      <select v-model="scope" aria-label="标签范围">
        <option value="all">全部来源</option>
        <option value="ideas">灵感</option>
        <option value="materials">素材</option>
        <option value="wheel">转盘</option>
      </select>
    </div>

    <div class="mini-summary-grid tag-summary" aria-label="标签摘要">
      <div class="mini-summary-card"><strong>{{ summary.all }}</strong><span>全部标签</span></div>
      <div class="mini-summary-card"><strong>{{ summary.ideas }}</strong><span>灵感标签</span></div>
      <div class="mini-summary-card"><strong>{{ summary.materials }}</strong><span>素材标签</span></div>
      <div class="mini-summary-card"><strong>{{ summary.wheel }}</strong><span>转盘标签</span></div>
      <div class="mini-summary-card"><strong>{{ summary.filtered }}</strong><span>当前筛选</span></div>
    </div>

    <div class="tag-center-grid">
      <article v-for="item in filteredItems" :key="item.name" class="tag-center-card">
        <div class="tag-center-head">
          <span class="tag-pill">{{ item.name }}</span>
          <strong>{{ totalCount(item) }}</strong>
        </div>
        <div class="tag-center-counts">
          <button type="button" @click="router.push({ path: '/ideas', query: { tag: item.name } })">
            <strong>{{ item.ideas.length }}</strong><span>灵感</span>
          </button>
          <button type="button" @click="router.push({ path: '/materials', query: { tag: item.name } })">
            <strong>{{ item.materials.length }}</strong><span>素材</span>
          </button>
          <button type="button" @click="router.push({ path: '/wheel', query: { tag: firstId(item.wheelTags) } })">
            <strong>{{ item.wheelItems.length }}</strong><span>转盘项</span>
          </button>
        </div>
        <div class="tag-center-preview">
          <span v-if="item.ideas[0]">灵感：{{ item.ideas[0].title || '未命名灵感' }}</span>
          <span v-if="item.materials[0]">素材：{{ String(item.materials[0].content || '').slice(0, 34) }}</span>
          <span v-if="item.wheelItems[0]">转盘：{{ item.wheelItems[0].name || '未命名公共项' }}</span>
        </div>
      </article>
      <div v-if="!filteredItems.length" class="empty-state">暂无匹配标签</div>
    </div>
  </section>
</template>

<style scoped>
.tag-summary { margin-bottom: 14px; }
.tag-filter-bar {
  grid-template-columns: minmax(0, 1fr) minmax(150px, .28fr);
  margin-bottom: 14px;
}
.tag-center-card,
.tag-center-head,
.tag-center-preview,
.tag-center-counts button {
  min-width: 0;
}
.tag-center-head,
.tag-center-preview span {
  overflow-wrap: anywhere;
}
#page-tags .tag-center-grid {
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 10px;
}
#page-tags .tag-center-card {
  padding: 14px;
}
#page-tags .tag-center-head {
  margin-bottom: 10px;
}
#page-tags .tag-center-counts {
  gap: 6px;
}
#page-tags .tag-center-counts button {
  padding: 8px;
}
#page-tags .tag-center-preview {
  margin-top: 8px;
  gap: 4px;
}
@media (max-width: 640px) {
  .tag-filter-bar { grid-template-columns: minmax(0, 1fr); }
}
</style>
