<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { useWheelStore, type WheelItem, type WheelMode, type WheelTag } from '../stores/wheelStore';

const wheelStore = useWheelStore();
const route = useRoute();
const selectedId = ref('');
const stageTag = ref<WheelTag | null>(null);
const resultId = ref('');
const spinning = ref(false);
const rotation = ref(0);
const notice = ref('');
let spinTimer: number | undefined;
let dragState: { x: number; y: number; moved: boolean } | null = null;
let suppressCanvasClick = false;

const selectedWheel = computed(() => wheelStore.wheels.find(wheel => wheel.id === selectedId.value) || wheelStore.wheels[0]);
const selectedOptions = computed(() => selectedWheel.value ? wheelStore.candidates(selectedWheel.value, stageTag.value?.id || '') : []);
const availableTags = computed(() => selectedWheel.value?.mode === 'tag' ? wheelStore.candidateTags(selectedWheel.value) : []);
const currentResult = computed(() => wheelStore.history.find(item => item.id === resultId.value));
const isTagSecondStage = computed(() => Boolean(selectedWheel.value?.mode === 'tag' && stageTag.value));
const segmentColors = ['#bcdcc9', '#d7e5f5', '#f4d5b7', '#e3d6f4', '#d1e6db', '#f3dfad'];
const canvasRef = ref<HTMLCanvasElement | null>(null);
const displayEntries = computed(() => {
  if (selectedWheel.value?.mode === 'tag' && !stageTag.value) return availableTags.value;
  return selectedOptions.value;
});

const wheelForm = reactive<{ id: string; name: string; mode: WheelMode; tagIds: string[]; itemsText: string }>({ id: '', name: '', mode: 'normal', tagIds: [], itemsText: '' });
const optionForm = reactive({ id: '', name: '', weight: 1, enabled: true });
const tagForm = reactive({ id: '', name: '', color: '#216e4e', weight: 1, enabled: true });
const libraryForm = reactive({ id: '', name: '', tagIds: [] as string[], weight: 1, enabled: true });
const libraryTagFilter = ref('');
const selectedLibraryIds = ref<string[]>([]);
const batchLibraryTagIds = ref<string[]>([]);
const filteredLibraryItems = computed(() => {
  if (!libraryTagFilter.value) return wheelStore.libraryItems;
  return wheelStore.libraryItems.filter(item => itemTagIds(item).includes(libraryTagFilter.value));
});
const selectedLibrarySet = computed(() => new Set(selectedLibraryIds.value));
const selectedVisibleLibraryCount = computed(() => filteredLibraryItems.value.filter(item => selectedLibrarySet.value.has(item.id)).length);
const allVisibleLibrarySelected = computed(() => Boolean(filteredLibraryItems.value.length && selectedVisibleLibraryCount.value === filteredLibraryItems.value.length));
const librarySelectionSummary = computed(() => libraryTagFilter.value && selectedLibraryIds.value.length !== selectedVisibleLibraryCount.value
  ? `选中 ${selectedLibraryIds.value.length}（当前筛选 ${selectedVisibleLibraryCount.value}/${filteredLibraryItems.value.length}）`
  : `选中 ${selectedLibraryIds.value.length}/${filteredLibraryItems.value.length}`);

watch(() => wheelStore.wheels, wheels => {
  if (!wheels.some(wheel => wheel.id === selectedId.value)) selectedId.value = wheels[0]?.id || '';
}, { immediate: true, deep: true });
watch(selectedId, () => { stageTag.value = null; resultId.value = ''; notice.value = ''; });
watch(displayEntries, () => { void nextTick(drawWheelCanvas); }, { immediate: true, deep: true });
onMounted(drawWheelCanvas);
watch([() => route.query.library, () => wheelStore.libraryItems.length], ([value]) => {
  const id = String(Array.isArray(value) ? value[0] || '' : value || '');
  if (!id || libraryForm.id === id) return;
  const item = wheelStore.libraryItems.find(entry => entry.id === id);
  if (item) {
    editLibrary(item);
    say(`已定位公共项：${item.name}`);
  }
}, { immediate: true });
watch([() => route.query.tag, () => wheelStore.tags.length], ([value]) => {
  const id = String(Array.isArray(value) ? value[0] || '' : value || '');
  if (!id || tagForm.id === id) return;
  const tag = wheelStore.tags.find(entry => entry.id === id);
  if (tag) {
    editTag(tag);
    say(`已定位转盘标签：${tag.name}`);
  }
}, { immediate: true });
watch(() => wheelStore.libraryItems.map(item => item.id).join('|'), () => {
  const existing = new Set(wheelStore.libraryItems.map(item => item.id));
  selectedLibraryIds.value = selectedLibraryIds.value.filter(id => existing.has(id));
}, { immediate: true });
watch(() => wheelStore.tags.map(tag => tag.id).join('|'), () => {
  const existing = new Set(wheelStore.tags.map(tag => tag.id));
  batchLibraryTagIds.value = batchLibraryTagIds.value.filter(id => existing.has(id));
  if (libraryTagFilter.value && !existing.has(libraryTagFilter.value)) libraryTagFilter.value = '';
}, { immediate: true });
onBeforeUnmount(() => { if (spinTimer) window.clearTimeout(spinTimer); });

function entryColor(item: unknown, index: number) {
  const value = String((item as { color?: unknown }).color || '');
  return /^#[0-9a-f]{6}$/i.test(value) ? value : segmentColors[index % segmentColors.length];
}

function drawWheelCanvas() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const entries = displayEntries.value;
  const ratio = window.devicePixelRatio || 1;
  const cssSize = 390;
  canvas.width = cssSize * ratio;
  canvas.height = cssSize * ratio;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  const cx = cssSize / 2;
  const cy = cssSize / 2;
  const radius = cssSize / 2 - 12;
  const innerRadius = Math.max(42, radius * (entries.length > 28 ? 0.24 : 0.29));
  ctx.clearRect(0, 0, cssSize, cssSize);
  ctx.beginPath();
  ctx.fillStyle = '#e9eef1';
  ctx.arc(cx, cy, radius + 8, 0, Math.PI * 2);
  ctx.fill();
  if (!entries.length) {
    ctx.beginPath();
    ctx.fillStyle = '#edf2ee';
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    drawCenter(ctx, cx, cy, '空');
    return;
  }
  const slice = (Math.PI * 2) / entries.length;
  entries.forEach((entry, index) => {
    const start = index * slice - Math.PI / 2;
    const end = start + slice;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(start) * innerRadius, cy + Math.sin(start) * innerRadius);
    ctx.arc(cx, cy, radius, start, end);
    ctx.arc(cx, cy, innerRadius, end, start, true);
    ctx.closePath();
    ctx.fillStyle = entryColor(entry, index);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.lineWidth = entries.length > 32 ? 0.8 : 1.4;
    ctx.stroke();
    drawSliceLabel(ctx, String(entry.name || '未命名'), cx, cy, innerRadius, radius, start + slice / 2, entries.length, index);
  });
  drawCenter(ctx, cx, cy, selectedWheel.value?.mode === 'tag' && !stageTag.value ? '标签' : 'GO');
}

function drawCenter(ctx: CanvasRenderingContext2D, cx: number, cy: number, label: string) {
  ctx.beginPath();
  ctx.fillStyle = '#ffffff';
  ctx.arc(cx, cy, 43, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(31,83,57,.16)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#285940';
  ctx.font = '700 18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, cy);
}

function drawSliceLabel(ctx: CanvasRenderingContext2D, raw: string, cx: number, cy: number, innerRadius: number, radius: number, angle: number, count: number, index: number) {
  const compact = raw.replace(/\s+/g, '').replace(/^[\d]+[.、．\s]*/, '');
  const max = count > 32 ? 6 : count > 16 ? 7 : 9;
  const label = count > 32 ? `${index + 1} ${compact.slice(0, max)}` : compact.slice(0, max);
  const text = compact.length > max ? `${label}…` : label;
  const labelRadius = innerRadius + (radius - innerRadius) * (count > 20 ? 0.62 : 0.58);
  ctx.save();
  ctx.translate(cx + Math.cos(angle) * labelRadius, cy + Math.sin(angle) * labelRadius);
  ctx.rotate(angle + Math.PI / 2);
  ctx.fillStyle = count > 20 ? '#314036' : '#ffffff';
  ctx.strokeStyle = count > 20 ? 'rgba(255,255,255,.7)' : 'rgba(35,48,39,.42)';
  ctx.lineWidth = 3;
  ctx.font = `${count > 32 ? 10 : count > 16 ? 11 : 13}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeText(text, 0, 0, Math.max(48, radius - innerRadius - 16));
  ctx.fillText(text, 0, 0, Math.max(48, radius - innerRadius - 16));
  ctx.restore();
}

function say(message: string) { notice.value = message; }
function handle(action: () => void, success = '') { try { action(); if (success) say(success); } catch (error) { say(error instanceof Error ? error.message : String(error)); } }
function confirmAction(message: string, action: () => void, success = '') { if (window.confirm(message)) handle(action, success); }
function itemTagIds(item: WheelItem) { return Array.isArray(item.tagIds) ? item.tagIds as string[] : []; }
function libraryTagNames(item: WheelItem) { return itemTagIds(item).map(id => wheelStore.tags.find(tag => tag.id === id)?.name).filter(Boolean).join('、') || '未分类'; }
function resetWheelForm() { Object.assign(wheelForm, { id: '', name: '', mode: 'normal', tagIds: [], itemsText: '' }); }
function editWheel() { const wheel = selectedWheel.value; if (!wheel) return; Object.assign(wheelForm, { id: wheel.id, name: wheel.name, mode: wheel.mode, tagIds: [...(wheel.tagIds || [])], itemsText: wheel.items.map(item => `${item.name},${item.weight}`).join('\n') }); }
function parseItems(text: string) {
  return text.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
    const match = line.match(/^(.*?)[,，\t]\s*(\d+(?:\.\d+)?)%?\s*$/);
    return { name: (match?.[1] || line).trim(), weight: Number(match?.[2] || 1) };
  });
}
function submitWheel() {
  handle(() => {
    if (wheelForm.id) wheelStore.updateWheel(wheelForm.id, { name: wheelForm.name, tagIds: wheelForm.tagIds });
    else {
      const created = wheelStore.createWheel({ name: wheelForm.name, mode: wheelForm.mode, tagIds: wheelForm.tagIds, items: parseItems(wheelForm.itemsText) });
      selectedId.value = created.id;
    }
    resetWheelForm();
  }, wheelForm.id ? '已更新转盘' : '已创建转盘');
}
function removeWheel() { const wheel = selectedWheel.value; if (wheel && window.confirm(`删除转盘“${wheel.name}”吗？抽取历史会保留。`)) handle(() => wheelStore.deleteWheel(wheel.id), '已删除转盘'); }
function resetOptionForm() { Object.assign(optionForm, { id: '', name: '', weight: 1, enabled: true }); }
function editOption(item: WheelItem) { Object.assign(optionForm, { id: item.id, name: item.name, weight: item.weight, enabled: item.enabled }); }
function submitOption() { const wheel = selectedWheel.value; if (!wheel) return; handle(() => { wheelStore.saveOption(wheel.id, optionForm); resetOptionForm(); }, optionForm.id ? '已更新选项' : '已添加选项'); }
function resetTagForm() { Object.assign(tagForm, { id: '', name: '', color: '#216e4e', weight: 1, enabled: true }); }
function editTag(tag: WheelTag) { Object.assign(tagForm, { id: tag.id, name: tag.name, color: tag.color, weight: tag.weight, enabled: tag.enabled }); }
function submitTag() { handle(() => { wheelStore.saveTag(tagForm); resetTagForm(); }, tagForm.id ? '已更新标签' : '已添加标签'); }
function resetLibraryForm() { Object.assign(libraryForm, { id: '', name: '', tagIds: [], weight: 1, enabled: true }); }
function editLibrary(item: WheelItem) { Object.assign(libraryForm, { id: item.id, name: item.name, tagIds: [...(Array.isArray(item.tagIds) ? item.tagIds as string[] : [])], weight: item.weight, enabled: item.enabled }); }
function submitLibrary() { handle(() => { wheelStore.saveLibraryItem(libraryForm); resetLibraryForm(); }, libraryForm.id ? '已更新公共项' : '已添加公共项'); }
function setAllVisibleLibrarySelection(checked: boolean) {
  const next = new Set(selectedLibraryIds.value);
  filteredLibraryItems.value.forEach(item => checked ? next.add(item.id) : next.delete(item.id));
  selectedLibraryIds.value = [...next];
}
function clearLibrarySelection() { selectedLibraryIds.value = []; }
function selectedLibraryActionIds() { return selectedLibraryIds.value.filter(id => wheelStore.libraryItems.some(item => item.id === id)); }
function applyLibraryBatchEnabled(enabled: boolean) {
  handle(() => {
    const changed = wheelStore.batchSetLibraryEnabled(selectedLibraryActionIds(), enabled);
    say(changed ? `已批量${enabled ? '启用' : '停用'} ${changed} 个公共项` : `选中的公共项已经是${enabled ? '启用' : '停用'}状态`);
  });
}
function applyLibraryBatchTags(action: 'add' | 'remove') {
  handle(() => {
    const result = wheelStore.batchUpdateLibraryTags(selectedLibraryActionIds(), batchLibraryTagIds.value, action);
    const tagNames = batchLibraryTagIds.value.map(id => wheelStore.tags.find(tag => tag.id === id)?.name).filter(Boolean).join('、');
    if (!result.changed) {
      say(action === 'remove' && result.blockedOnlyTag ? '没有可移除的标签；公共项至少要保留一个标签' : '选中的公共项没有需要修改的标签');
      return;
    }
    say(action === 'remove' ? `已从 ${result.changed} 个公共项去掉标签：${tagNames}` : `已给 ${result.changed} 个公共项加上标签：${tagNames}`);
  });
}
function applyLibraryBatchDelete() {
  if (!selectedLibraryIds.value.length || !window.confirm(`确定删除选中的 ${selectedLibraryIds.value.length} 个公共项吗？普通转盘里已复制的私有项不会受影响。`)) return;
  handle(() => {
    const removed = wheelStore.batchDeleteLibraryItems(selectedLibraryActionIds());
    clearLibrarySelection();
    say(removed ? `已删除 ${removed} 个公共项` : '勾选的公共项已不存在');
  });
}
function nextSpin() {
  const wheel = selectedWheel.value;
  if (!wheel || spinning.value) return;
  if (wheel.mode === 'tag' && !stageTag.value) {
    const tag = wheelStore.weightedPick(availableTags.value);
    if (!tag) return say('这个标签转盘没有可抽标签，或标签下没有启用的公共项。');
    animate(() => { stageTag.value = tag; say(`已锁定标签：${tag.name}，再转一次抽具体内容。`); });
    return;
  }
  const picked = wheelStore.weightedPick(selectedOptions.value);
  if (!picked) return say('当前转盘没有启用的可抽选项。');
  animate(() => {
    const history = wheelStore.recordSpin(wheel.id, picked, stageTag.value || undefined);
    resultId.value = history.id; stageTag.value = null; say(`抽中了：${picked.name}`);
  });
}
function directTag(tag: WheelTag) { stageTag.value = tag; resultId.value = ''; nextSpin(); }
function animate(done: () => void) {
  spinning.value = true; rotation.value += 1440 + Math.floor(Math.random() * 720);
  const configured = Number((window as unknown as { __wheelSpinDurationMs?: number }).__wheelSpinDurationMs);
  const duration = Number.isFinite(configured) ? Math.max(1, configured) : 560;
  spinTimer = window.setTimeout(() => { spinning.value = false; done(); void nextTick(drawWheelCanvas); }, duration);
}
function canvasClick() {
  if (suppressCanvasClick) {
    suppressCanvasClick = false;
    return;
  }
  nextSpin();
}
function canvasPointerDown(event: PointerEvent) {
  dragState = { x: event.clientX, y: event.clientY, moved: false };
  (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
}
function canvasPointerMove(event: PointerEvent) {
  if (!dragState) return;
  const dx = event.clientX - dragState.x;
  const dy = event.clientY - dragState.y;
  if (Math.hypot(dx, dy) < 8) return;
  dragState.moved = true;
  rotation.value += dx * 0.4 + dy * 0.2;
}
function canvasPointerUp(event: PointerEvent) {
  const state = dragState;
  dragState = null;
  (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
  if (state?.moved) {
    suppressCanvasClick = true;
    nextSpin();
    window.setTimeout(() => { suppressCanvasClick = false; }, 0);
  }
}
function toggleTag(list: string[], id: string, checked: boolean) { const next = new Set(list); checked ? next.add(id) : next.delete(id); return [...next]; }
function exportJson() { wheelStore.exportBackup(); say('已下载转盘 JSON 备份，并创建本地快照。'); }
function exportCsv() { wheelStore.exportHistoryCsv(); say('已下载抽取历史 CSV。'); }
function importJson(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const raw = JSON.parse(String(reader.result || '{}')) as Record<string, unknown>;
      const summary = `转盘 ${Array.isArray(raw.wheels) ? raw.wheels.length : 0} 个，标签 ${Array.isArray(raw.wheelTags) ? raw.wheelTags.length : 0} 个，公共项 ${Array.isArray(raw.wheelLibraryItems) ? raw.wheelLibraryItems.length : 0} 个，历史 ${Array.isArray(raw.wheelHistory) ? raw.wheelHistory.length : 0} 条`;
      if (!window.confirm(`恢复会覆盖当前转盘、标签、公共项和抽取记录。\n\n备份内容：${summary}\n\n恢复前会自动建立可回滚快照。继续吗？`)) return;
      wheelStore.restoreBackup(raw, file.name); selectedId.value = wheelStore.wheels[0]?.id || ''; resultId.value = ''; stageTag.value = null; say('已恢复转盘 JSON 备份。');
    } catch (error) { say(error instanceof Error ? error.message : '备份文件不是有效的大转盘 JSON'); }
    (event.target as HTMLInputElement).value = '';
  };
  reader.readAsText(file, 'utf-8');
}
</script>

<template>
  <section id="page-wheel" class="page active">
    <header class="page-header wheel-header">
      <div><div class="page-title">工具转盘</div><p class="wheel-subtitle">用可追溯的随机选择，帮自己越过“该做什么”的小阻力。</p></div>
      <div class="wheel-actions"><button class="btn btn-secondary" type="button" @click="exportJson">导出 JSON</button><label class="btn btn-secondary import-button">恢复备份<input type="file" accept=".json,application/json" @change="importJson" /></label><button class="btn btn-secondary" type="button" @click="exportCsv">导出 CSV</button></div>
    </header>

    <p v-if="notice" class="wheel-notice" role="status">{{ notice }}</p>
    <div class="wheel-layout">
      <article class="card wheel-stage-card">
        <div class="wheel-toolbar">
          <label class="form-group wheel-selector"><span>当前转盘</span><select v-model="selectedId" :disabled="!wheelStore.wheels.length"><option v-for="wheel in wheelStore.wheels" :key="wheel.id" :value="wheel.id">{{ wheel.name }} · {{ wheel.mode === 'tag' ? '标签' : '普通' }}</option></select></label>
          <button class="btn btn-secondary" type="button" @click="editWheel" :disabled="!selectedWheel">编辑当前</button>
          <button class="btn btn-danger" type="button" @click="removeWheel" :disabled="!selectedWheel">删除</button>
        </div>
        <div class="wheel-pointer">▼</div>
        <div
          class="wheel-canvas-wrap"
          :class="{ spinning }"
          role="button"
          tabindex="0"
          :aria-label="isTagSecondStage ? '抽取具体内容' : selectedWheel?.mode === 'tag' ? '开始抽标签' : '开始转动'"
          @click="canvasClick"
          @keydown.enter.prevent="nextSpin"
          @keydown.space.prevent="nextSpin"
          @pointerdown="canvasPointerDown"
          @pointermove="canvasPointerMove"
          @pointerup="canvasPointerUp"
          @pointercancel="dragState = null"
        >
          <canvas ref="canvasRef" class="wheel-canvas" :style="{ transform: `rotate(${rotation}deg)` }" />
          <span class="wheel-center-label">{{ spinning ? '转动中' : isTagSecondStage ? '抽项目' : selectedWheel?.mode === 'tag' ? '抽标签' : 'GO' }}</span>
        </div>
        <div class="wheel-result" aria-live="polite"><template v-if="currentResult"><strong>{{ currentResult!.resultName }}</strong><span>{{ currentResult!.mode === 'tag' ? `标签：${currentResult!.tagName || '-'}` : '普通转盘结果' }}</span><button class="btn btn-primary" :disabled="Boolean(currentResult!.convertedTodoId)" @click="handle(() => wheelStore.convertHistoryToTodo(currentResult!.id), '已转入今日待办')">{{ currentResult!.convertedTodoId ? '已转入待办' : '转入待办' }}</button></template><template v-else-if="stageTag"><strong>已锁定：{{ stageTag.name }}</strong><span>再转一次，从该标签的公共项里抽取。</span></template><template v-else><strong>{{ selectedWheel ? '准备开始' : '先创建一个转盘' }}</strong><span>{{ displayEntries.length }} 个{{ selectedWheel?.mode === 'tag' ? '候选标签' : '候选' }}</span></template></div>
        <button class="btn btn-primary wheel-spin" type="button" :disabled="spinning || !selectedWheel" @click="nextSpin">{{ isTagSecondStage ? '抽取具体内容' : selectedWheel?.mode === 'tag' ? '开始抽标签' : '开始转动' }}</button>
        <div v-if="selectedWheel?.mode === 'tag' && availableTags.length" class="direct-tags"><span>直接抽标签：</span><button v-for="tag in availableTags" :key="tag.id" type="button" class="tag-chip" :style="{ '--tag-color': tag.color }" @click="directTag(tag)">{{ tag.name }} · {{ wheelStore.candidates(selectedWheel, tag.id).length }}</button></div>
      </article>

      <aside class="wheel-side-stack">
        <form class="card compact-form" @submit.prevent="submitWheel"><div class="card-title">{{ wheelForm.id ? '编辑转盘' : '新建转盘' }}</div><div class="form-group"><label>名称<input v-model="wheelForm.name" required placeholder="例如：今晚吃什么" /></label></div><div class="form-group"><label>模式<select v-model="wheelForm.mode" :disabled="Boolean(wheelForm.id)"><option value="normal">普通转盘</option><option value="tag">标签转盘（两段抽取）</option></select></label></div><div v-if="wheelForm.mode === 'normal'" class="form-group"><label>选项（每行一项；可用“名称,权重”）<textarea v-model="wheelForm.itemsText" rows="4" placeholder="阅读,2&#10;散步,1" /></label></div><div v-else class="tag-checks"><label v-for="tag in wheelStore.tags" :key="tag.id"><input type="checkbox" :checked="wheelForm.tagIds.includes(tag.id)" @change="wheelForm.tagIds = toggleTag(wheelForm.tagIds, tag.id, ($event.target as HTMLInputElement).checked)" />{{ tag.name }}</label><span v-if="!wheelStore.tags.length" class="hint">先在标签管理中添加标签。</span></div><div class="inline-actions"><button class="btn btn-primary">{{ wheelForm.id ? '保存修改' : '创建转盘' }}</button><button v-if="wheelForm.id" class="btn btn-secondary" type="button" @click="resetWheelForm">取消</button></div></form>
        <article class="card history-card"><div class="card-title-row"><div class="card-title">最近抽取</div><button v-if="wheelStore.history.length" type="button" class="link-button danger-text" @click="confirmAction('清空全部抽取记录吗？', () => wheelStore.clearHistory(), '已清空历史')">清空</button></div><div v-for="entry in wheelStore.history.slice(0, 8)" :key="entry.id" class="history-row"><div><strong>{{ entry.resultName }}</strong><span>{{ entry.wheelName }} · {{ entry.createdAt }}</span></div><button type="button" class="link-button danger-text" @click="confirmAction('删除这条记录吗？', () => wheelStore.deleteHistory(entry.id), '已删除记录')">删除</button></div><p v-if="!wheelStore.history.length" class="empty-state">还没有抽取记录。</p></article>
      </aside>
    </div>

    <div class="wheel-management-grid">
      <article class="card"><div class="card-title">普通转盘选项</div><form v-if="selectedWheel?.mode === 'normal'" class="inline-editor" @submit.prevent="submitOption"><input v-model="optionForm.name" required placeholder="选项名称" /><input v-model.number="optionForm.weight" type="number" min="1" title="权重" /><label><input v-model="optionForm.enabled" type="checkbox" />启用</label><button class="btn btn-primary">{{ optionForm.id ? '保存' : '添加' }}</button><button v-if="optionForm.id" type="button" class="btn btn-secondary" @click="resetOptionForm">取消</button></form><p v-else class="hint">标签转盘从公共项按标签抽取，不维护私有选项。</p><div v-for="item in selectedWheel?.mode === 'normal' ? selectedWheel.items : []" :key="item.id" class="entity-row"><span><strong>{{ item.name }}</strong><em>权重 {{ item.weight }} · {{ item.enabled ? '启用' : '停用' }}</em></span><span><button class="link-button" @click="editOption(item)">编辑</button><button class="link-button danger-text" @click="confirmAction(`删除选项“${item.name}”吗？`, () => wheelStore.deleteOption(selectedWheel!.id, item.id), '已删除选项')">删除</button></span></div></article>
      <article class="card"><div class="card-title">标签管理</div><form class="inline-editor tag-form" @submit.prevent="submitTag"><input v-model="tagForm.name" required placeholder="标签名称" /><input v-model="tagForm.color" type="color" /><input v-model.number="tagForm.weight" type="number" min="1" title="权重" /><label><input v-model="tagForm.enabled" type="checkbox" />启用</label><button class="btn btn-primary">{{ tagForm.id ? '保存' : '添加' }}</button><button v-if="tagForm.id" type="button" class="btn btn-secondary" @click="resetTagForm">取消</button></form><div v-for="tag in wheelStore.tags" :key="tag.id" class="entity-row"><span><i class="color-dot" :style="{ background: tag.color }" /><strong>{{ tag.name }}</strong><em>权重 {{ tag.weight }} · {{ tag.enabled ? '启用' : '停用' }}</em></span><span><button class="link-button" @click="editTag(tag)">编辑</button><button class="link-button danger-text" @click="confirmAction(`删除标签“${tag.name}”吗？`, () => wheelStore.deleteTag(tag.id))">删除</button></span></div></article>
      <article class="card library-card">
        <div class="card-title-row">
          <div class="card-title">公共项库</div>
          <label class="library-filter">
            <span>按标签筛选</span>
            <select v-model="libraryTagFilter" aria-label="公共项标签筛选">
              <option value="">全部标签</option>
              <option v-for="tag in wheelStore.tags" :key="tag.id" :value="tag.id">{{ tag.name }}</option>
            </select>
          </label>
        </div>
        <form class="library-form" @submit.prevent="submitLibrary">
          <input v-model="libraryForm.name" required placeholder="公共项名称" />
          <input v-model.number="libraryForm.weight" type="number" min="1" title="权重" />
          <label><input v-model="libraryForm.enabled" type="checkbox" />启用</label>
          <div class="tag-checks"><label v-for="tag in wheelStore.tags" :key="tag.id"><input type="checkbox" :checked="libraryForm.tagIds.includes(tag.id)" @change="libraryForm.tagIds = toggleTag(libraryForm.tagIds, tag.id, ($event.target as HTMLInputElement).checked)" />{{ tag.name }}</label></div>
          <div class="inline-actions"><button class="btn btn-primary">{{ libraryForm.id ? '保存公共项' : '添加公共项' }}</button><button v-if="libraryForm.id" type="button" class="btn btn-secondary" @click="resetLibraryForm">取消</button></div>
        </form>
        <div class="library-batch-bar">
          <label class="select-all-row"><input type="checkbox" :checked="allVisibleLibrarySelected" :disabled="!filteredLibraryItems.length" @change="setAllVisibleLibrarySelection(($event.target as HTMLInputElement).checked)" />{{ librarySelectionSummary }}</label>
          <button type="button" class="link-button" :disabled="!selectedLibraryIds.length" @click="clearLibrarySelection">清空选择</button>
          <div class="batch-tag-checks" role="group" aria-label="批量标签">
            <label v-for="tag in wheelStore.tags" :key="tag.id"><input type="checkbox" :checked="batchLibraryTagIds.includes(tag.id)" @change="batchLibraryTagIds = toggleTag(batchLibraryTagIds, tag.id, ($event.target as HTMLInputElement).checked)" />{{ tag.name }}</label>
          </div>
          <div class="inline-actions">
            <button class="btn btn-secondary" type="button" :disabled="!selectedLibraryIds.length || !batchLibraryTagIds.length" @click="applyLibraryBatchTags('add')">批量加标签</button>
            <button class="btn btn-secondary" type="button" :disabled="!selectedLibraryIds.length || !batchLibraryTagIds.length" @click="applyLibraryBatchTags('remove')">批量去标签</button>
            <button class="btn btn-secondary" type="button" :disabled="!selectedLibraryIds.length" @click="applyLibraryBatchEnabled(true)">批量启用</button>
            <button class="btn btn-secondary" type="button" :disabled="!selectedLibraryIds.length" @click="applyLibraryBatchEnabled(false)">批量停用</button>
            <button class="btn btn-danger" type="button" :disabled="!selectedLibraryIds.length" @click="applyLibraryBatchDelete">批量删除</button>
          </div>
        </div>
        <div v-for="item in filteredLibraryItems" :key="item.id" class="entity-row library-row" :class="{ selected: selectedLibrarySet.has(item.id) }">
          <label class="library-select"><input v-model="selectedLibraryIds" type="checkbox" :value="item.id" :aria-label="`选择公共项 ${item.name}`" /></label>
          <span><strong>{{ item.name }}</strong><em>权重 {{ item.weight }} · {{ item.enabled ? '启用' : '停用' }} · {{ libraryTagNames(item) }}</em></span>
          <span><button class="link-button" @click="editLibrary(item)">编辑</button><button class="link-button danger-text" @click="confirmAction(`删除公共项“${item.name}”吗？`, () => wheelStore.deleteLibraryItem(item.id), '已删除公共项')">删除</button></span>
        </div>
        <p v-if="!filteredLibraryItems.length" class="empty-state">当前筛选下没有公共项。</p>
      </article>
    </div>
  </section>
</template>

<style scoped>
.wheel-header,.wheel-toolbar,.wheel-actions,.inline-actions,.card-title-row,.entity-row,.history-row,.wheel-result,.wheel-management-grid,.inline-editor,.direct-tags{display:flex;align-items:center}.wheel-header,.wheel-toolbar,.card-title-row,.entity-row,.history-row{justify-content:space-between;gap:12px}.wheel-header{align-items:flex-start}.wheel-subtitle,.hint{margin:5px 0 0;color:var(--text-secondary,#66756c);font-size:.9rem}.wheel-actions,.inline-actions{flex-wrap:wrap}.import-button{cursor:pointer}.import-button input{display:none}.wheel-notice{margin:0 0 14px;padding:10px 13px;border-radius:9px;background:#edf6ef;color:#25613d}.wheel-layout{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(290px,.8fr);gap:18px}.wheel-side-stack{display:grid;gap:18px}.wheel-stage-card{text-align:center}.wheel-selector{text-align:left;min-width:200px}.wheel-selector span{display:block;margin-bottom:4px}.wheel-pointer{position:relative;z-index:2;color:#e75d4d;font-size:28px;line-height:.5;margin-top:16px}.wheel-canvas-wrap{position:relative;width:min(390px,86vw);aspect-ratio:1;margin:-1px auto 14px;border:10px solid #f7faf8;border-radius:50%;background:#eef4f0;box-shadow:0 8px 28px rgba(25,61,42,.16),inset 0 0 0 2px rgba(31,83,57,.08);cursor:pointer;touch-action:none;user-select:none;overflow:hidden}.wheel-canvas-wrap:focus-visible{outline:3px solid rgba(47,128,237,.32);outline-offset:4px}.wheel-canvas{display:block;width:100%;height:100%;border-radius:50%;transition:transform 560ms cubic-bezier(.16,.85,.22,1);will-change:transform}.wheel-canvas-wrap.spinning .wheel-canvas{transition-duration:560ms}.wheel-center-label{position:absolute;inset:50% auto auto 50%;display:grid;place-items:center;width:82px;height:82px;border-radius:50%;background:#fff;color:#285940;font-weight:800;transform:translate(-50%,-50%);box-shadow:0 2px 9px rgba(0,0,0,.12);pointer-events:none}.wheel-result{min-height:68px;justify-content:center;flex-direction:column;gap:3px}.wheel-result strong{font-size:1.15rem}.wheel-result span,.history-row span,.entity-row em{color:var(--text-secondary,#66756c);font-style:normal;font-size:.82rem}.wheel-spin{min-width:180px}.direct-tags{justify-content:center;flex-wrap:wrap;margin-top:15px;gap:7px;font-size:.85rem}.tag-chip{border:1px solid color-mix(in srgb,var(--tag-color) 35%,white);background:color-mix(in srgb,var(--tag-color) 12%,white);color:#32483a;border-radius:999px;padding:5px 9px;cursor:pointer}.compact-form label{display:block}.tag-checks,.batch-tag-checks{display:flex;flex-wrap:wrap;gap:7px;margin:8px 0}.tag-checks label,.batch-tag-checks label{display:inline-flex;gap:4px;align-items:center;padding:4px 7px;background:#f5f7f5;border-radius:7px;font-size:.84rem}.inline-editor{gap:8px;flex-wrap:wrap;margin:10px 0 14px}.inline-editor input:not([type=checkbox]){width:100px}.inline-editor input:first-child{flex:1;min-width:130px}.entity-row,.history-row{padding:9px 0;border-top:1px solid rgba(42,75,56,.1);text-align:left}.entity-row>span:first-child,.history-row>div{display:flex;align-items:center;gap:7px;min-width:0}.entity-row em{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.library-row{justify-content:start;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px}.library-row.selected{background:rgba(33,110,78,.05)}.library-select{display:grid;place-items:center}.library-filter{display:flex;align-items:center;gap:8px;font-size:.86rem;color:var(--text-secondary,#66756c)}.library-filter select{min-width:130px}.library-batch-bar{display:grid;grid-template-columns:auto auto minmax(180px,1fr);gap:10px;align-items:center;margin:8px 0 4px;padding:10px;border:1px solid rgba(42,75,56,.12);border-radius:8px;background:#f8faf8}.library-batch-bar .inline-actions{grid-column:1/-1}.select-all-row{display:inline-flex;align-items:center;gap:6px;font-size:.88rem}.color-dot{display:inline-block;width:10px;height:10px;border-radius:50%}.link-button{border:0;background:transparent;color:#316c4a;cursor:pointer;padding:3px}.link-button:disabled{color:#98a49d;cursor:not-allowed}.danger-text{color:#b84f45}.wheel-management-grid{align-items:start;display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:18px}.library-card{grid-column:1/-1}.library-form{display:grid;grid-template-columns:minmax(160px,1fr) 90px auto;gap:8px;align-items:center;margin:10px 0}.library-form .tag-checks,.library-form .inline-actions{grid-column:1/-1}.empty-state{padding:12px 0}.history-card{max-height:430px;overflow:auto}@media (max-width:850px){.wheel-layout,.wheel-management-grid{grid-template-columns:1fr}.wheel-header{flex-direction:column}.library-card{grid-column:auto}.library-form{grid-template-columns:1fr 90px auto}.wheel-canvas-wrap{width:min(350px,82vw)}}@media (max-width:560px){.wheel-toolbar{align-items:stretch;flex-wrap:wrap}.wheel-selector{width:100%}.wheel-canvas-wrap{width:280px}.library-form{grid-template-columns:1fr 80px}.library-form>label{grid-column:1/-1}.library-batch-bar{grid-template-columns:1fr}.library-row{grid-template-columns:auto minmax(0,1fr);align-items:start}.library-row>span:last-child{grid-column:2}.library-filter{width:100%;justify-content:space-between}.wheel-actions .btn{font-size:.82rem}}
</style>
