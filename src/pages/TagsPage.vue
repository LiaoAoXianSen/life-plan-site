<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useLifePlanStore } from '../stores/lifePlanStore';
const store = useLifePlanStore(); const router = useRouter();
const tags = computed(() => { const counts = new Map<string, number>(); const add = (value: unknown) => (Array.isArray(value) ? value : []).forEach(tag => { const key = String(tag || '').trim(); if (key) counts.set(key, (counts.get(key) || 0) + 1); }); store.data.records.forEach(record => add(record.ideaTags)); store.data.materials.forEach(material => add(material.tags)); store.data.wheelTags.forEach(tag => { const key = String(tag.name || '').trim(); if (key) counts.set(key, (counts.get(key) || 0) + 1); }); return [...counts].sort((a, b) => b[1] - a[1]); });
</script>
<template><section class="page active"><header class="page-header"><div class="page-title">标签中心</div></header><article class="card"><div class="card-title">全部标签</div><div class="tag-center-cloud"><button v-for="[tag, count] in tags" :key="tag" class="tag-pill" type="button" @click="router.push({ path: '/search', query: { q: tag } })">{{ tag }} <small>{{ count }}</small></button><div v-if="!tags.length" class="empty-state">尚未建立标签。</div></div></article></section></template>
