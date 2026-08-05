<script setup lang="ts">
import { computed } from 'vue';

type StatusTone = 'info' | 'success' | 'warning' | 'danger';

const props = withDefaults(defineProps<{
  tone?: StatusTone;
  role?: 'status' | 'alert';
  live?: 'polite' | 'assertive' | 'off';
}>(), {
  tone: 'info',
  role: 'status',
  live: 'polite',
});

const liveValue = computed(() => props.live === 'off' ? undefined : props.live);
</script>

<template>
  <div class="status-banner" :class="[`is-${tone}`]" :role="role" :aria-live="liveValue">
    <slot name="icon" />
    <slot />
    <span v-if="$slots.actions" class="status-banner-actions"><slot name="actions" /></span>
  </div>
</template>
