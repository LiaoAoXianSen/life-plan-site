<script setup lang="ts">
/**
 * 公共筛选栏容器。
 * layout 负责稳定的控件排列，页面 class 只保留复杂业务布局。
 */
withDefaults(defineProps<{
  as?: 'div' | 'form';
  layout?: 'search-filter' | 'search-filter-action' | 'custom';
  variant?: 'panel' | 'plain';
}>(), {
  as: 'div',
  layout: 'custom',
  variant: 'panel',
});
</script>

<template>
  <component
    :is="as"
    class="filter-bar app-filter-bar"
    :class="[
      `app-filter-bar--${variant}`,
      `app-filter-bar--${layout}`,
    ]"
  >
    <slot />
  </component>
</template>
