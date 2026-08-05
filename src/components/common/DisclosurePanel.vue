<script setup lang="ts">
import { ref, watch } from 'vue';

const props = withDefaults(defineProps<{
  open?: boolean;
  title: string;
  description?: string;
}>(), {
  description: '',
});

const emit = defineEmits<{
  'update:open': [value: boolean];
  toggle: [value: boolean];
}>();

const internalOpen = ref(props.open ?? false);
watch(() => props.open, value => {
  if (value !== undefined) internalOpen.value = value;
});

function handleToggle(event: Event) {
  const value = (event.currentTarget as HTMLDetailsElement).open;
  internalOpen.value = value;
  emit('update:open', value);
  emit('toggle', value);
}
</script>

<template>
  <details class="app-disclosure" :open="internalOpen" @toggle="handleToggle">
    <summary><slot name="summary"><strong>{{ title }}</strong><span v-if="description">{{ description }}</span></slot></summary>
    <slot />
  </details>
</template>

<style>
.app-disclosure { margin-bottom: 16px; }
.app-disclosure > summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--line, #dfe7e1);
  border-radius: 10px;
  background: var(--surface, #fff);
  color: var(--text, #17211b);
  cursor: pointer;
  list-style: none;
}
.app-disclosure > summary::-webkit-details-marker { display: none; }
.app-disclosure > summary::after {
  content: '展开';
  flex: 0 0 auto;
  color: var(--muted, #647269);
  font-size: 12px;
}
.app-disclosure[open] > summary::after { content: '收起'; }
.app-disclosure > summary span { color: var(--muted, #647269); font-size: 12px; }
.app-disclosure > .form-row,
.app-disclosure > form { margin-top: 12px; }
</style>
