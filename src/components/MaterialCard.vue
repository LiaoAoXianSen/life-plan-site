<script setup lang="ts">
import { computed } from 'vue';
import type { Material } from '../types/lifePlan';

const props = withDefaults(defineProps<{
  material: Material;
  compact?: boolean;
  expanded?: boolean;
  expandable?: boolean;
  editable?: boolean;
}>(), {
  compact: false,
  expanded: false,
  expandable: false,
  editable: false,
});

const emit = defineEmits<{
  view: [material: Material];
  edit: [material: Material];
  toggle: [material: Material];
}>();

function normalizeTags(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : String(value || '').split(/[,，、;；/\s]+/);
  return Array.from(new Set(raw.map(tag => String(tag || '').trim()).filter(Boolean)));
}

function normalizePreviewText(value: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function truncateText(value: unknown, maxLength: number) {
  const clean = normalizePreviewText(value);
  return clean.length <= maxLength ? clean : `${clean.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
}

const title = computed(() => normalizePreviewText(props.material.title) || truncateText(props.material.content, 42) || '空素材');
const tags = computed(() => normalizeTags(props.material.tags));

function formatStoredDateTime(value: unknown) {
  const raw = String(value || '');
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return raw.replace('T', ' ');
  return `${match[1]}年${Number(match[2])}月${Number(match[3])}日 ${match[4]}:${match[5]}:${match[6] || '00'}`;
}
</script>

<template>
  <article class="material-card" :class="{ compact, 'is-expanded': expanded }">
    <div class="material-card-head"><span class="material-type">{{ material.type || '素材' }}</span><span>{{ formatStoredDateTime(material.createdAt) }}</span></div>
    <h3 class="material-title">{{ title }}</h3>
    <div class="material-card-copy">
      <div class="material-content">{{ material.content || '空素材' }}</div>
      <div v-if="material.source" class="material-meta material-source">来源：{{ material.source }}</div>
      <div v-if="material.note" class="material-meta material-note">备注：{{ material.note }}</div>
    </div>
    <div v-if="tags.length" class="idea-badge-row"><span v-for="tag in tags" :key="tag" class="tag-pill">{{ tag }}</span></div>
    <div class="idea-card-actions material-card-actions">
      <button v-if="expandable" class="mini-link material-expand-btn" type="button" :aria-expanded="expanded" @click="emit('toggle', material)">{{ expanded ? '收起内容' : '展开内容' }}</button>
      <button class="btn btn-secondary todo-mini-btn" type="button" @click="emit('view', material)">查看详情</button>
      <button v-if="editable" class="btn btn-secondary todo-mini-btn" type="button" :aria-label="`编辑素材 ${title}`" @click="emit('edit', material)">编辑</button>
    </div>
  </article>
</template>

<style scoped>
.material-card { min-width: 0; display: flex; flex-direction: column; }
.material-card.compact { background: #fbfdfb; }
.material-title { margin: 0 0 8px; color: var(--text); font-size: 16px; font-weight: 700; line-height: 1.45; overflow-wrap: anywhere; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; }
.material-card-copy { min-width: 0; }
.material-content { color: var(--text); font-size: 13px; font-weight: 650; line-height: 1.7; white-space: pre-line; overflow-wrap: anywhere; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; line-clamp: 3; overflow: hidden; }
.material-card.compact .material-content { -webkit-line-clamp: 2; line-clamp: 2; }
.material-meta { margin-top: 8px; color: var(--muted); font-size: 12px; line-height: 1.55; overflow-wrap: anywhere; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; }
.material-source { -webkit-line-clamp: 1; line-clamp: 1; }
.material-card.is-expanded .material-title,
.material-card.is-expanded .material-content,
.material-card.is-expanded .material-meta { display: block; max-height: none; overflow: visible; -webkit-line-clamp: unset; line-clamp: unset; }
.material-card-actions { margin-top: auto; padding-top: 12px; align-items: center; }
.material-expand-btn { margin: 0 auto 0 0; border: 0; background: transparent; color: var(--primary); cursor: pointer; font: inherit; font-size: 12px; font-weight: 800; }
</style>
