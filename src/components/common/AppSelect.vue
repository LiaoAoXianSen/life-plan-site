<script setup lang="ts">
/** 公共原生下拉，保留标准 select 行为并支持字符串和数字值。 */
export type SelectOption = {
  value: string | number;
  label: string;
  disabled?: boolean;
};

const props = withDefaults(defineProps<{
  modelValue?: string | number;
  options?: SelectOption[];
  allLabel?: string;
  allValue?: string | number;
  ariaLabel?: string;
  size?: 'default' | 'compact';
}>(), {
  modelValue: '',
  options: () => [],
  allLabel: '',
  allValue: 'all',
  ariaLabel: '',
  size: 'default',
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number): void;
  (e: 'change', event: Event): void;
}>();

function onChange(event: Event) {
  const rawValue = (event.target as HTMLSelectElement).value;
  const candidates = [
    ...(props.allLabel ? [{ value: props.allValue }] : []),
    ...props.options,
  ];
  const matched = candidates.find(option => String(option.value) === rawValue);
  emit('update:modelValue', matched?.value ?? rawValue);
  emit('change', event);
}
</script>

<template>
  <select
    class="app-control app-select"
    :class="{ 'app-control--compact': size === 'compact' }"
    :value="modelValue"
    :aria-label="ariaLabel || undefined"
    @change="onChange"
  >
    <option v-if="allLabel" :value="allValue">{{ allLabel }}</option>
    <option
      v-for="(option, index) in options"
      :key="`${typeof option.value}:${String(option.value)}:${index}`"
      :value="option.value"
      :disabled="option.disabled"
    >
      {{ option.label }}
    </option>
    <slot />
  </select>
</template>
