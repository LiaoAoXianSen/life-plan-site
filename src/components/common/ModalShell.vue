<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

type ModalSize = 'sm' | 'md' | 'lg';
type ModalElement = 'section' | 'article' | 'form';

const openModalStack: symbol[] = [];

const props = withDefaults(defineProps<{
  modelValue: boolean;
  title: string;
  as?: ModalElement;
  size?: ModalSize;
  dialogClass?: string;
  overlayClass?: string;
  dialogId?: string;
  closeLabel?: string;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  showHeader?: boolean;
  initialFocus?: string | HTMLElement | null;
  teleport?: boolean;
}>(), {
  as: 'section',
  size: 'md',
  dialogClass: '',
  closeOnBackdrop: false,
  closeOnEscape: true,
  closeLabel: '',
  showHeader: true,
  teleport: true,
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  close: [];
  submit: [event: Event];
  opened: [];
}>();

const overlayRef = ref<HTMLElement | null>(null);
const dialogRef = ref<HTMLElement | null>(null);
const modalToken = Symbol('modal');
let restoreFocus: HTMLElement | null = null;
const titleId = `modal-shell-title-${Math.random().toString(36).slice(2)}`;

function focusFirstControl() {
  void nextTick(() => {
    const preferred = props.initialFocus instanceof HTMLElement
      ? props.initialFocus
      : props.initialFocus
        ? dialogRef.value?.querySelector<HTMLElement>(props.initialFocus)
        : null;
    const target = preferred || dialogRef.value?.querySelector<HTMLElement>(
      'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) || dialogRef.value;
    target?.focus();
    emit('opened');
  });
}

function close() {
  emit('update:modelValue', false);
  emit('close');
}

function handleKeydown(event: KeyboardEvent) {
  if (!props.modelValue || event.defaultPrevented || openModalStack[openModalStack.length - 1] !== modalToken) return;
  if (event.key === 'Escape' && props.closeOnEscape) {
    event.preventDefault();
    event.stopImmediatePropagation();
    close();
    return;
  }
  if (event.key !== 'Tab') return;
  const controls = Array.from(overlayRef.value?.querySelectorAll<HTMLElement>(
    'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])',
  ) || []).filter(element => element.offsetParent !== null);
  if (!controls.length) return;
  const first = controls[0];
  const last = controls[controls.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

watch(() => props.modelValue, opened => {
  const stackIndex = openModalStack.indexOf(modalToken);
  if (stackIndex >= 0) openModalStack.splice(stackIndex, 1);
  if (opened) {
    openModalStack.push(modalToken);
    restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.addEventListener('keydown', handleKeydown);
    focusFirstControl();
  } else {
    document.removeEventListener('keydown', handleKeydown);
    const target = restoreFocus;
    restoreFocus = null;
    void nextTick(() => target?.focus());
  }
}, { immediate: true });

onMounted(() => {
  if (props.modelValue) focusFirstControl();
});

onBeforeUnmount(() => {
  const stackIndex = openModalStack.indexOf(modalToken);
  if (stackIndex >= 0) openModalStack.splice(stackIndex, 1);
  document.removeEventListener('keydown', handleKeydown);
  const target = restoreFocus;
  restoreFocus = null;
  void nextTick(() => target?.focus());
});
</script>

<template>
  <Teleport to="body" :disabled="!teleport">
    <div
      v-if="modelValue"
      ref="overlayRef"
      class="modal-overlay active"
      :class="overlayClass"
      role="presentation"
      @click.self="closeOnBackdrop && close()"
    >
      <component
        :is="as"
        ref="dialogRef"
        class="modal"
        :class="[`modal-${size}`, dialogClass]"
        :id="dialogId || undefined"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        :aria-labelledby="showHeader ? titleId : undefined"
        :aria-label="showHeader ? undefined : title"
        @submit.prevent="emit('submit', $event)"
      >
        <div v-if="showHeader" class="modal-header">
          <slot name="header"><h2 class="modal-title" :id="titleId">{{ title }}</h2></slot>
          <slot name="header-extra" />
          <button class="close-btn" type="button" :aria-label="closeLabel || `关闭${title}`" @click="close">×</button>
        </div>
        <slot />
        <div v-if="$slots.footer" class="modal-footer"><slot name="footer" :close="close" /></div>
      </component>
    </div>
  </Teleport>
</template>
