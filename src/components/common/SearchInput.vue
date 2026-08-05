<script setup lang="ts">
import { ref, useAttrs } from 'vue';

/**
 * 公共搜索框。
 * 受控组件（v-model），支持清除按钮和 Esc 清除，并把原生属性透传给 input。
 */
defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<{
  modelValue?: string;
  placeholder?: string;
  ariaLabel?: string;
  clearable?: boolean;
  clearAriaLabel?: string;
  size?: 'default' | 'compact';
}>(), {
  modelValue: '',
  placeholder: '',
  ariaLabel: '',
  clearable: true,
  clearAriaLabel: '',
  size: 'default',
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'clear'): void;
}>();
const attrs = useAttrs();
const inputRef = ref<HTMLInputElement | null>(null);

function onInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value);
}

function clear() {
  if (!props.modelValue) return;
  emit('update:modelValue', '');
  emit('clear');
  requestAnimationFrame(() => inputRef.value?.focus());
}
</script>

<template>
  <div class="app-search-input" :class="[{ 'has-value': Boolean(props.modelValue) }, `app-search-input--${props.size}`]">
    <input
      ref="inputRef"
      v-bind="attrs"
      class="app-control app-search-control"
      :class="{ 'app-control--compact': props.size === 'compact' }"
      type="search"
      :value="props.modelValue"
      :aria-label="props.ariaLabel || undefined"
      :placeholder="props.placeholder"
      @input="onInput"
      @keydown.esc="clear"
    >
    <button
      v-if="props.clearable"
      class="app-search-clear"
      :class="{ 'is-visible': Boolean(props.modelValue) }"
      type="button"
      :disabled="Boolean(attrs.disabled) || !props.modelValue"
      :aria-hidden="!props.modelValue"
      :tabindex="props.modelValue && !attrs.disabled ? 0 : -1"
      :aria-label="props.clearAriaLabel || '清除搜索'"
      title="清除"
      @click="clear"
    >
      <span aria-hidden="true">×</span>
    </button>
  </div>
</template>
