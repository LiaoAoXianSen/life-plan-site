<script setup lang="ts">
import StatusBanner from './StatusBanner.vue';
type PreviewStatus = 'idle' | 'loading' | 'missing' | 'ready' | 'error';

withDefaults(defineProps<{
  title: string;
  remotePath: string;
  modeLabel: string;
  resourceLabel: string;
  status: PreviewStatus;
  busy?: boolean;
  autoBusy?: boolean;
  endpointReady?: boolean;
  autoSyncEnabled?: boolean;
  armed?: boolean;
  canApply?: boolean;
  canUpload?: boolean;
  message?: string;
  messageTone?: string;
  rootClass?: string;
  autoLabel?: string;
  runLabel?: string;
  checkLabel?: string;
}>(), {
  busy: false,
  autoBusy: false,
  endpointReady: false,
  autoSyncEnabled: false,
  armed: false,
  canApply: false,
  canUpload: false,
  message: '',
  messageTone: 'info',
  rootClass: '',
  autoLabel: '',
  runLabel: '立即自动同步一次',
  checkLabel: '',
});

const emit = defineEmits<{
  'update:autoSyncEnabled': [value: boolean];
  'update:armed': [value: boolean];
  saveAutoSync: [];
  runAutoSync: [];
  preview: [];
  apply: [];
  upload: [];
  create: [];
}>();
</script>

<template>
  <article class="card sync-resource-panel" :class="rootClass">
    <div class="sync-resource-heading">
      <div><div class="card-title">{{ title }}</div><span>{{ remotePath }}</span></div>
      <span class="sync-resource-mode">{{ modeLabel }}</span>
    </div>
    <div class="sync-resource-auto">
      <label>
        <input :checked="autoSyncEnabled" type="checkbox" :disabled="busy || !endpointReady" @change="emit('update:autoSyncEnabled', ($event.target as HTMLInputElement).checked); emit('saveAutoSync')" />
        <span>{{ autoLabel || `启用 ${resourceLabel} 条件自动同步` }}</span>
      </label>
      <button class="btn btn-secondary" type="button" :disabled="autoBusy || busy || !endpointReady" @click="emit('runAutoSync')">{{ runLabel }}</button>
    </div>
    <div class="page-actions sync-resource-actions">
      <button class="btn btn-secondary" type="button" :disabled="busy || !endpointReady" @click="emit('preview')">{{ checkLabel || `检查 ${resourceLabel} 云端` }}</button>
      <button v-if="status === 'ready'" class="btn btn-secondary" type="button" :disabled="!canApply" @click="emit('apply')">应用合并到本机</button>
      <button v-if="status === 'ready'" class="btn btn-primary" type="button" :disabled="!canUpload" @click="emit('upload')">受保护上传</button>
      <slot name="actions-extra" />
    </div>
    <label v-if="status === 'missing'" class="sync-resource-arm">
      <input :checked="armed" type="checkbox" @change="emit('update:armed', ($event.target as HTMLInputElement).checked)" />
      <span>本次会话允许首次创建</span>
      <button class="btn btn-primary" type="button" :disabled="!armed || busy" @click.prevent="emit('create')">首次创建</button>
    </label>
    <slot name="preview" />
    <slot name="risks" />
    <StatusBanner v-if="message" class="sync-status active" :class="`is-${messageTone}`" role="status" tone="info">{{ message }}</StatusBanner>
  </article>
</template>

<style>
.sync-resource-panel { margin-top: 18px; }
.sync-resource-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.sync-resource-heading span { color: var(--faint); font-size: 12px; overflow-wrap: anywhere; }
.sync-resource-mode { padding: 5px 8px; border: 1px solid var(--line); border-radius: 6px; white-space: nowrap; }
.sync-resource-auto { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-top: 14px; padding: 10px 0; border-top: 1px solid var(--line); }
.sync-resource-auto label { display: inline-flex; align-items: center; gap: 8px; min-width: 0; }
.sync-resource-actions { margin-top: 14px; }
.sync-resource-arm { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 9px; align-items: center; margin-top: 14px; padding: 10px 0; border-top: 1px solid var(--line); }
.sync-resource-comparison { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 16px; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.sync-resource-column { display: grid; gap: 4px; min-width: 0; padding: 12px; border-right: 1px solid var(--line); }
.sync-resource-column:last-child { border-right: 0; }
.sync-resource-column strong { font-size: 13px; }
.sync-resource-column span, .sync-resource-column small { color: var(--muted); overflow-wrap: anywhere; }
.sync-resource-column small { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
.sync-resource-risks { margin-top: 12px; }
.sync-resource-risks p { margin: 5px 0; color: var(--muted); }
.sync-resource-risks .is-danger, .sync-resource-panel .sync-status.is-danger { color: var(--danger); }
.sync-resource-panel .sync-status.is-success { color: var(--accent); }
@media (max-width: 560px) {
  .sync-resource-heading { align-items: stretch; flex-direction: column; }
  .sync-resource-mode { align-self: flex-start; }
  .sync-resource-auto { align-items: stretch; flex-direction: column; }
  .sync-resource-auto .btn { width: 100%; }
  .sync-resource-comparison { grid-template-columns: 1fr; }
  .sync-resource-column { border-right: 0; border-bottom: 1px solid var(--line); }
  .sync-resource-column:last-child { border-bottom: 0; }
  .sync-resource-arm { grid-template-columns: auto minmax(0, 1fr); }
  .sync-resource-arm .btn { grid-column: 1 / -1; width: 100%; }
}
</style>
