<script setup lang="ts">
withDefaults(defineProps<{
  title?: string;
  description?: string;
  compact?: boolean;
}>(), {
  title: '',
  description: '',
  compact: false,
});
</script>

<template>
  <div class="empty-state" :class="{ 'empty-state--compact': compact }">
    <slot name="icon" />
    <slot>
      <strong v-if="title" class="empty-state-title">{{ title }}</strong>
      <span v-if="description" class="empty-state-description">{{ description }}</span>
    </slot>
    <div v-if="$slots.actions" class="empty-state-actions"><slot name="actions" /></div>
  </div>
</template>
