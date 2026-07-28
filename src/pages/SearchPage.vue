<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router';

import { useLifePlanStore } from '../stores/lifePlanStore';

const store = useLifePlanStore();
const route = useRoute();
const router = useRouter();
const query = ref(String(route.query.q || ''));

watch(() => route.query.q, value => {
  query.value = String(value || '');
});

const results = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return [];

  const collections: Array<[string, Array<Record<string, unknown>>, string]> = [
    ['记录', store.data.records, '/records'],
    ['待办', store.data.todos, '/todos'],
    ['目标', store.data.goals, '/goals'],
    ['素材', store.data.materials, '/materials'],
    ['模板', store.data.templates, '/records'],
    ['转盘公共项', store.data.wheelLibraryItems, '/wheel'],
  ];

  return collections.flatMap(([kind, items, path]) => items
    .filter(item => Object.values(item).flat().join(' ').toLowerCase().includes(q))
    .slice(0, 20)
    .map(item => {
      const id = String(item.id || '');
      const materialContent = typeof item.content === 'string' ? item.content : '';
      const target: RouteLocationRaw = kind === '素材'
        ? { path: '/materials', query: { material: id } }
        : path;

      return {
        kind,
        id,
        target,
        title: kind === '素材'
          ? materialContent.slice(0, 42) || '空素材'
          : String(item.title || item.text || item.name || '未命名'),
        preview: String(item.content || item.note || ''),
      };
    }));
});

function search() {
  router.replace({ query: query.value ? { q: query.value } : {} });
}
</script>

<template>
  <section class="page active">
    <header class="page-header">
      <div class="page-title">全局搜索</div>
    </header>
    <form class="global-search-panel" @submit.prevent="search">
      <input v-model="query" type="search" placeholder="搜索记录、待办、目标、素材、模板与转盘项" />
      <button class="btn btn-primary">搜索</button>
    </form>
    <div class="search-results">
      <article
        v-for="result in results"
        :key="`${result.kind}:${result.id}`"
        class="search-result-item"
        @click="router.push(result.target)"
      >
        <span class="item-type">{{ result.kind }}</span>
        <div>
          <strong>{{ result.title }}</strong>
          <p>{{ result.preview }}</p>
        </div>
      </article>
      <div v-if="query && !results.length" class="empty-state">没有找到匹配内容。</div>
    </div>
  </section>
</template>
