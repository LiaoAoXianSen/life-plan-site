<script setup lang="ts">
import { nextTick, ref } from 'vue';

export type SegmentedTabItem = {
  value: string | number;
  label: string;
  disabled?: boolean;
  id?: string;
  controls?: string;
  name?: string;
};

const props = withDefaults(defineProps<{
  modelValue: string | number;
  items: SegmentedTabItem[];
  ariaLabel: string;
  size?: 'default' | 'compact';
  tabClass?: string;
  semantics?: 'buttons' | 'tabs';
  buttonAriaSelected?: boolean;
}>(), {
  size: 'default',
  semantics: 'buttons',
  buttonAriaSelected: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: string | number];
  change: [value: string | number];
}>();

const rootRef = ref<HTMLElement | null>(null);

function select(value: string | number) {
  emit('update:modelValue', value);
  emit('change', value);
}

function move(event: KeyboardEvent, index: number) {
  const enabled = props.items.map((item, itemIndex) => ({ item, itemIndex })).filter(entry => !entry.item.disabled);
  const current = enabled.findIndex(entry => entry.itemIndex === index);
  let target = current;
  if (event.key === 'ArrowRight') target = (current + 1) % enabled.length;
  else if (event.key === 'ArrowLeft') target = (current - 1 + enabled.length) % enabled.length;
  else if (event.key === 'Home') target = 0;
  else if (event.key === 'End') target = enabled.length - 1;
  else return;
  event.preventDefault();
  const next = enabled[target];
  select(next.item.value);
  void nextTick(() => rootRef.value?.querySelectorAll<HTMLButtonElement>('button')[next.itemIndex]?.focus());
}
</script>

<template>
  <div ref="rootRef" class="segmented app-segmented" :class="{ 'app-segmented--compact': size === 'compact' }" :role="semantics === 'tabs' ? 'tablist' : 'group'" :aria-label="ariaLabel">
    <button
      v-for="(item, index) in items"
      :id="item.id"
      :key="`${typeof item.value}:${String(item.value)}`"
      type="button"
      :role="semantics === 'tabs' ? 'tab' : undefined"
      :name="item.name"
      :class="[tabClass, { active: modelValue === item.value }]"
      :disabled="item.disabled"
      :aria-pressed="semantics === 'buttons' ? modelValue === item.value : undefined"
      :aria-selected="semantics === 'tabs' || buttonAriaSelected ? modelValue === item.value : undefined"
      :aria-controls="item.controls"
      :tabindex="semantics === 'tabs' ? (modelValue === item.value ? 0 : -1) : undefined"
      @click="select(item.value)"
      @keydown="move($event, index)"
    >
      <slot name="tab" :item="item" :active="modelValue === item.value">{{ item.label }}</slot>
    </button>
  </div>
</template>
