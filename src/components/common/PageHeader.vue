<script setup lang="ts">
withDefaults(defineProps<{
  title: string;
  subtitle?: string;
  titleAs?: 'h1' | 'div';
  actionsClass?: string;
}>(), {
  subtitle: '',
  titleAs: 'div',
  actionsClass: 'page-actions',
});
</script>

<template>
  <header class="page-header">
    <div>
      <slot name="pretitle" />
      <component :is="titleAs" class="page-title">{{ title }}</component>
      <slot name="subtitle"><p v-if="subtitle" class="page-subtitle">{{ subtitle }}</p></slot>
      <slot />
    </div>
    <div v-if="$slots.actions" class="page-actions page-header-actions" :class="actionsClass"><slot name="actions" /></div>
  </header>
</template>
