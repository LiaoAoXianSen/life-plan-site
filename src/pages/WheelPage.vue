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
const showManagement = ref(false);
const activeManagementPanel = ref<'create' | 'edit' | 'library' | 'tags' | 'history' | 'list'>('list');
const menuOpen = ref(false);
const modeFilter = ref<'all' | WheelMode>('all');
let spinTimer: number | undefined;
let dragState: { x: number; y: number; moved: boolean } | null = null;
let suppressCanvasClick = false;

const selectedWheel = computed(() => wheelStore.wheels.find(wheel => wheel.id === selectedId.value) || wheelStore.wheels[0]);
const selectedWheelHeadline = computed(() => {
  if (selectedWheel.value?.name === '默认普通转盘') return '今天做什么';
  if (selectedWheel.value?.name === '默认标签转盘') return '先抽个方向';
  return selectedWheel.value?.name || '未命名转盘';
});
const selectedWheelModeLabel = computed(() => selectedWheel.value?.mode === 'tag' ? '标签转盘 · 两段抽取' : '普通转盘 · 一步出结果');
const modeWheels = computed(() => {
  if (modeFilter.value === 'all') return wheelStore.wheels;
  return wheelStore.wheels.filter(wheel => wheel.mode === modeFilter.value);
});
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
const managementStats = computed(() => [
  { label: '转盘', value: wheelStore.wheels.length },
  { label: '标签', value: wheelStore.tags.length },
  { label: '公共项', value: wheelStore.libraryItems.length },
  { label: '历史', value: wheelStore.history.length },
]);

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
function editWheel() {
  const wheel = selectedWheel.value;
  if (!wheel) return;
  showManagement.value = true;
  activeManagementPanel.value = 'edit';
  menuOpen.value = false;
  Object.assign(wheelForm, { id: wheel.id, name: wheel.name, mode: wheel.mode, tagIds: [...(wheel.tagIds || [])], itemsText: wheel.items.map(item => `${item.name},${item.weight}`).join('\n') });
}
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
function editTag(tag: WheelTag) {
  showManagement.value = true;
  activeManagementPanel.value = 'tags';
  menuOpen.value = false;
  Object.assign(tagForm, { id: tag.id, name: tag.name, color: tag.color, weight: tag.weight, enabled: tag.enabled });
}
function submitTag() { handle(() => { wheelStore.saveTag(tagForm); resetTagForm(); }, tagForm.id ? '已更新标签' : '已添加标签'); }
function resetLibraryForm() { Object.assign(libraryForm, { id: '', name: '', tagIds: [], weight: 1, enabled: true }); }
function editLibrary(item: WheelItem) {
  showManagement.value = true;
  activeManagementPanel.value = 'library';
  menuOpen.value = false;
  Object.assign(libraryForm, { id: item.id, name: item.name, tagIds: [...(Array.isArray(item.tagIds) ? item.tagIds as string[] : [])], weight: item.weight, enabled: item.enabled });
}
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
function setModeFilter(mode: WheelMode) {
  modeFilter.value = mode;
  const match = wheelStore.wheels.find(wheel => wheel.mode === mode);
  if (match) {
    selectedId.value = match.id;
    stageTag.value = null;
    resultId.value = '';
  }
  showManagement.value = false;
  menuOpen.value = false;
}

function openManagement(panel: 'create' | 'edit' | 'library' | 'tags' | 'history' | 'list' = 'list') {
  showManagement.value = true;
  activeManagementPanel.value = panel;
  menuOpen.value = false;
  if (panel === 'create') resetWheelForm();
  if (panel === 'edit') editWheel();
  void nextTick(() => {
    const map: Record<string, string> = {
      create: 'wheel-create-panel',
      edit: 'wheel-create-panel',
      library: 'wheel-library-panel',
      tags: 'wheel-tags-panel',
      history: 'wheel-history-panel',
      list: 'wheel-management-block',
    };
    document.getElementById(map[panel])?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function toggleManageMenu() {
  menuOpen.value = !menuOpen.value;
}

function collapseManagement() {
  showManagement.value = false;
  menuOpen.value = false;
}

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
      <div>
        <div class="page-title">工具转盘</div>
        <p class="wheel-subtitle">普通转盘、标签二段抽取、公共项库和抽取历史都在这里。</p>
      </div>
      <div class="wheel-header-actions">
        <div v-if="!selectedWheel" class="wheel-action-menu-wrap">
          <button
            id="wheel-action-menu-button"
            class="btn btn-secondary wheel-action-menu-button"
            type="button"
            :aria-expanded="menuOpen"
            aria-controls="wheel-action-menu"
            @click="toggleManageMenu"
          >管理</button>
          <div v-show="menuOpen" id="wheel-action-menu" class="wheel-action-menu">
            <button type="button" @click="openManagement('list')">转盘列表</button>
            <button type="button" @click="openManagement('create')">新建转盘</button>
            <button type="button" @click="openManagement('edit')">修改当前盘</button>
            <button type="button" @click="openManagement('library')">公共项库</button>
            <button type="button" @click="openManagement('tags')">标签管理</button>
            <button type="button" @click="openManagement('history')">记录/备份</button>
          </div>
        </div>
        <button
          v-if="showManagement"
          class="btn btn-secondary"
          type="button"
          @click="collapseManagement"
        >收起管理</button>
      </div>
    </header>

    <p v-if="notice" class="wheel-notice" role="status">{{ notice }}</p>

    <section v-if="selectedWheel" class="wheel-stage wheel-focus-shell" aria-label="转盘主舞台">
      <div class="wheel-mode-bar wheel-focus-toolbar">
        <div class="wheel-mode-pills segmented" role="tablist" aria-label="转盘模式">
          <button type="button" class="wheel-mode-pill" :class="{ active: modeFilter === 'normal' || (modeFilter === 'all' && selectedWheel.mode !== 'tag') }" @click="setModeFilter('normal')">普通转盘</button>
          <button type="button" class="wheel-mode-pill" :class="{ active: modeFilter === 'tag' || (modeFilter === 'all' && selectedWheel.mode === 'tag') }" @click="setModeFilter('tag')">标签转盘</button>
        </div>
        <label class="form-group wheel-selector compact">
          <select id="wheel-selector" v-model="selectedId" :disabled="!modeWheels.length" aria-label="当前转盘">
            <option v-for="wheel in modeWheels" :key="wheel.id" :value="wheel.id">{{ wheel.name }}{{ wheel.mode === 'tag' ? ' · 标签' : '' }}</option>
          </select>
        </label>
        <div class="wheel-action-menu-wrap">
          <button
            id="wheel-action-menu-button"
            class="btn btn-secondary wheel-action-menu-button"
            type="button"
            :aria-expanded="menuOpen"
            aria-controls="wheel-action-menu"
            @click="toggleManageMenu"
          >管理</button>
          <div v-show="menuOpen" id="wheel-action-menu" class="wheel-action-menu">
            <button type="button" @click="openManagement('list')">转盘列表</button>
            <button type="button" @click="openManagement('create')">新建转盘</button>
            <button type="button" :disabled="!selectedWheel" @click="openManagement('edit')">修改当前盘</button>
            <button type="button" @click="openManagement('library')">公共项库</button>
            <button type="button" @click="openManagement('tags')">标签管理</button>
            <button type="button" @click="openManagement('history')">记录/备份</button>
          </div>
        </div>
      </div>

      <div class="wheel-focus-stage">
        <div class="wheel-focus-copy wheel-stage-summary">
          <div class="wheel-stage-card hero compact" :class="{ active: Boolean(stageTag) }">
            <div class="wheel-stage-card-top">
              <span class="wheel-mode-badge wheel-stage-badge">{{ selectedWheelModeLabel }}</span>
              <span v-if="stageTag" class="wheel-stage-badge muted">标签已锁定</span>
            </div>
            <h2 class="wheel-mode-title wheel-stage-title">{{ stageTag ? `已锁定：${stageTag.name}` : selectedWheelHeadline }}</h2>
            <p class="wheel-subtitle wheel-stage-copy">
            <template v-if="selectedWheel.mode === 'tag' && !stageTag">先抽一个标签，再抽该标签下的公共项；也可以单独点某个标签直接转。</template>
              <template v-else-if="stageTag">{{ selectedWheelHeadline }} · 再转一次抽具体内容。</template>
              <template v-else>先转出一个明确答案。</template>
            </p>
          <div v-if="selectedWheel.mode === 'tag' && availableTags.length" class="direct-tags hero-tags wheel-stage-quick-tags">
            <button
              v-for="tag in availableTags"
              :key="tag.id"
              type="button"
              class="tag-chip wheel-stage-quick-tag"
              :style="{ '--tag-color': tag.color }"
              @click="directTag(tag)"
            ><span>{{ tag.name }}</span><span>{{ wheelStore.candidates(selectedWheel, tag.id).length }} 项</span></button>
          </div>
          </div>
          <div class="wheel-focus-actions wheel-actions">
            <button class="btn btn-primary wheel-spin large" type="button" :disabled="spinning || !displayEntries.length" @click="nextSpin">
              {{ spinning ? '转动中…' : isTagSecondStage ? '继续抽具体内容' : selectedWheel.mode === 'tag' ? '先抽一个标签' : '开始抽取' }}
            </button>
            <button
              v-if="isTagSecondStage"
              class="btn btn-secondary"
              type="button"
              :disabled="spinning"
              @click="stageTag = null; resultId = ''; say('已返回标签转盘')"
            >返回标签转盘</button>
            <button
              v-else
              class="btn btn-secondary"
              type="button"
              :disabled="spinning"
              @click="stageTag = null; resultId = ''; say('已重置本轮状态')"
            >刷新</button>
          </div>
          <div class="wheel-result focus" aria-live="polite">
            <template v-if="currentResult">
              <div class="wheel-result-card">
                <div class="wheel-result-meta">
                  <span class="wheel-result-meta-item">{{ selectedWheel.name || '当前转盘' }}</span>
                  <span class="wheel-result-meta-item">{{ currentResult!.mode === 'tag' ? `标签 · ${currentResult!.tagName || '-'}` : '普通模式' }}</span>
                </div>
                <div class="wheel-result-kicker">{{ currentResult!.mode === 'tag' ? '最终结果' : '这次抽中了' }}</div>
                <div class="wheel-result-title"><strong>{{ currentResult!.resultName }}</strong></div>
                <div class="wheel-result-note">如果这个答案正好对味，就直接把它转成待办，省掉继续纠结的那一步。</div>
                <div class="wheel-result-actions">
                  <button class="btn btn-primary" :disabled="Boolean(currentResult!.convertedTodoId)" @click="handle(() => wheelStore.convertHistoryToTodo(currentResult!.id), '已转入今日待办')">{{ currentResult!.convertedTodoId ? '已转入待办' : '转入待办' }}</button>
                </div>
              </div>
            </template>
            <template v-else-if="stageTag">
              <div class="wheel-result-card pending compact">
                <span class="wheel-result-kicker">第二段</span>
                <strong class="wheel-result-title">再转一次</strong>
                <span class="wheel-result-note">{{ displayEntries.length }} 个候选 · 已锁定：{{ stageTag.name }}</span>
              </div>
            </template>
            <template v-else>
              <div class="wheel-result-card pending compact">
                <span class="wheel-result-kicker">准备开始</span>
                <strong class="wheel-result-title">转一转</strong>
                <span class="wheel-result-note">{{ displayEntries.length }} 个候选</span>
              </div>
            </template>
          </div>
        </div>

        <div class="wheel-focus-canvas">
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
        </div>
      </div>
    </section>

    <section v-else class="wheel-stage wheel-focus-shell wheel-empty-shell" aria-label="转盘主舞台">
      <div class="wheel-empty-copy">
        <div class="wheel-mode-badge">空白转盘</div>
        <h2 class="wheel-mode-title">还没有转盘</h2>
        <p class="wheel-subtitle">先创建一个普通转盘或标签转盘，主舞台会保留在这里。</p>
        <button class="btn btn-primary" type="button" @click="openManagement('create')">新建转盘</button>
      </div>
      <div class="wheel-focus-canvas">
        <div class="wheel-pointer">▼</div>
        <div class="wheel-canvas-wrap empty" aria-hidden="true">
          <canvas ref="canvasRef" class="wheel-canvas" />
          <span class="wheel-center-label">空</span>
        </div>
      </div>
    </section>

    <div v-show="showManagement" id="wheel-management-block" class="wheel-management-block" :data-management-panel="activeManagementPanel">
      <section class="wheel-management-landing" aria-label="转盘管理入口">
        <div class="wheel-management-landing-head">
          <div>
            <div class="card-title">管理概览</div>
            <p class="hint">先选工作区，再处理对应内容；主舞台会保持在上方。</p>
          </div>
          <div class="wheel-management-nav" role="navigation" aria-label="管理工作区">
            <button class="btn btn-secondary" type="button" @click="openManagement('list')">转盘列表</button>
            <button class="btn btn-secondary" type="button" @click="openManagement('create')">新建转盘</button>
            <button class="btn btn-secondary" type="button" @click="openManagement('library')">公共项库</button>
            <button class="btn btn-secondary" type="button" @click="openManagement('tags')">标签管理</button>
            <button class="btn btn-secondary" type="button" @click="openManagement('history')">记录/备份</button>
          </div>
        </div>
        <div class="wheel-management-summary" aria-label="转盘管理概览">
          <span v-for="item in managementStats" :key="item.label"><strong>{{ item.value }}</strong>{{ item.label }}</span>
        </div>
      </section>

      <div class="wheel-layout">
        <article v-show="['list', 'edit', 'history'].includes(activeManagementPanel)" class="card wheel-stage-card">
          <div class="wheel-toolbar">
            <label class="form-group wheel-selector"><span>当前转盘</span><select v-model="selectedId" :disabled="!wheelStore.wheels.length"><option v-for="wheel in wheelStore.wheels" :key="wheel.id" :value="wheel.id">{{ wheel.name }} · {{ wheel.mode === 'tag' ? '标签' : '普通' }}</option></select></label>
            <button class="btn btn-secondary" type="button" @click="editWheel" :disabled="!selectedWheel">编辑当前</button>
            <button class="btn btn-danger" type="button" @click="removeWheel" :disabled="!selectedWheel">删除</button>
          </div>
          <p class="hint">下方表单用于创建/编辑转盘、标签和公共项；主舞台默认保持专注抽取。</p>
          <div class="page-actions" style="margin-top:10px;">
            <button class="btn btn-secondary" type="button" @click="exportJson">导出 JSON</button>
            <label class="btn btn-secondary import-button">恢复备份<input type="file" accept=".json,application/json" @change="importJson" /></label>
            <button class="btn btn-secondary" type="button" @click="exportCsv">导出 CSV</button>
          </div>
        </article>

        <aside class="wheel-side-stack">
          <form id="wheel-create-panel" class="card compact-form" @submit.prevent="submitWheel"><div class="card-title">{{ wheelForm.id ? '编辑转盘' : '新建转盘' }}</div><div class="form-group"><label>名称<input v-model="wheelForm.name" required placeholder="例如：今晚吃什么" /></label></div><div class="form-group"><label>模式<select v-model="wheelForm.mode" :disabled="Boolean(wheelForm.id)"><option value="normal">普通转盘</option><option value="tag">标签转盘（两段抽取）</option></select></label></div><div v-if="wheelForm.mode === 'normal'" class="form-group"><label>选项（每行一项；可用“名称,权重”）<textarea v-model="wheelForm.itemsText" rows="4" placeholder="阅读,2&#10;散步,1" /></label></div><div v-else class="tag-checks"><label v-for="tag in wheelStore.tags" :key="tag.id"><input type="checkbox" :checked="wheelForm.tagIds.includes(tag.id)" @change="wheelForm.tagIds = toggleTag(wheelForm.tagIds, tag.id, ($event.target as HTMLInputElement).checked)" />{{ tag.name }}</label><span v-if="!wheelStore.tags.length" class="hint">先在标签管理中添加标签。</span></div><div class="inline-actions"><button class="btn btn-primary">{{ wheelForm.id ? '保存修改' : '创建转盘' }}</button><button v-if="wheelForm.id" class="btn btn-secondary" type="button" @click="resetWheelForm">取消</button></div></form>
          <article id="wheel-history-panel" class="card history-card"><div class="card-title-row"><div class="card-title">最近抽取</div><button v-if="wheelStore.history.length" type="button" class="link-button danger-text" @click="confirmAction('清空全部抽取记录吗？', () => wheelStore.clearHistory(), '已清空历史')">清空</button></div><div v-for="entry in wheelStore.history.slice(0, 8)" :key="entry.id" class="history-row"><div><strong>{{ entry.resultName }}</strong><span>{{ entry.wheelName }} · {{ entry.createdAt }}</span></div><button type="button" class="link-button danger-text" @click="confirmAction('删除这条记录吗？', () => wheelStore.deleteHistory(entry.id), '已删除记录')">删除</button></div><p v-if="!wheelStore.history.length" class="empty-state">还没有抽取记录。</p></article>
        </aside>
      </div>

      <div class="wheel-management-grid">
      <article class="card management-card">
        <div class="card-title">普通转盘选项</div>
        <form v-if="selectedWheel?.mode === 'normal'" class="inline-editor management-form option-form" @submit.prevent="submitOption">
          <label class="field-label"><span>选项名称</span><input v-model="optionForm.name" required placeholder="选项名称" /></label>
          <label class="field-label field-small"><span>权重</span><input v-model.number="optionForm.weight" type="number" min="1" /></label>
          <label class="check-label"><input v-model="optionForm.enabled" type="checkbox" />启用</label>
          <div class="inline-actions"><button class="btn btn-primary">{{ optionForm.id ? '保存' : '添加' }}</button><button v-if="optionForm.id" type="button" class="btn btn-secondary" @click="resetOptionForm">取消</button></div>
        </form>
        <p v-else class="hint">标签转盘从公共项按标签抽取，不维护私有选项。</p>
        <div v-for="item in selectedWheel?.mode === 'normal' ? selectedWheel.items : []" :key="item.id" class="entity-row"><span><strong>{{ item.name }}</strong><em>权重 {{ item.weight }} · {{ item.enabled ? '启用' : '停用' }}</em></span><span><button class="link-button" @click="editOption(item)">编辑</button><button class="link-button danger-text" @click="confirmAction(`删除选项“${item.name}”吗？`, () => wheelStore.deleteOption(selectedWheel!.id, item.id), '已删除选项')">删除</button></span></div>
      </article>
      <article id="wheel-tags-panel" class="card management-card">
        <div class="card-title">标签管理</div>
        <form class="inline-editor management-form tag-form" @submit.prevent="submitTag">
          <label class="field-label"><span>标签名称</span><input v-model="tagForm.name" required placeholder="标签名称" /></label>
          <label class="field-label color-field"><span>颜色</span><input v-model="tagForm.color" type="color" /></label>
          <label class="field-label field-small"><span>权重</span><input v-model.number="tagForm.weight" type="number" min="1" /></label>
          <label class="check-label"><input v-model="tagForm.enabled" type="checkbox" />启用</label>
          <div class="inline-actions"><button class="btn btn-primary">{{ tagForm.id ? '保存' : '添加' }}</button><button v-if="tagForm.id" type="button" class="btn btn-secondary" @click="resetTagForm">取消</button></div>
        </form>
        <div v-for="tag in wheelStore.tags" :key="tag.id" class="entity-row"><span><i class="color-dot" :style="{ background: tag.color }" /><strong>{{ tag.name }}</strong><em>权重 {{ tag.weight }} · {{ tag.enabled ? '启用' : '停用' }}</em></span><span><button class="link-button" @click="editTag(tag)">编辑</button><button class="link-button danger-text" @click="confirmAction(`删除标签“${tag.name}”吗？`, () => wheelStore.deleteTag(tag.id))">删除</button></span></div>
      </article>
      <article id="wheel-library-panel" class="card library-card">
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
          <label class="field-label"><span>公共项名称</span><input v-model="libraryForm.name" required placeholder="公共项名称" /></label>
          <label class="field-label field-small"><span>权重</span><input v-model.number="libraryForm.weight" type="number" min="1" /></label>
          <label class="check-label"><input v-model="libraryForm.enabled" type="checkbox" />启用</label>
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
    </div>
  </section>
</template>

<style scoped>
.wheel-focus-shell{max-width:860px;margin:0 auto 16px;padding:24px;border-radius:28px}.wheel-empty-shell{display:grid;grid-template-columns:1fr;gap:16px;align-items:start}.wheel-empty-copy{display:grid;gap:12px;justify-items:center;max-width:620px;width:100%;margin:0 auto;text-align:center}.wheel-canvas-wrap.empty{cursor:default}
.wheel-focus-toolbar{display:grid;grid-template-columns:minmax(180px,1fr) minmax(220px,1.2fr) auto;align-items:center;gap:14px;width:100%;margin-bottom:12px}
.wheel-focus-toolbar .wheel-selector{margin:0;min-width:0;width:100%}
.wheel-focus-toolbar .wheel-selector select{min-height:42px;width:100%}
.wheel-focus-stage{display:grid;grid-template-columns:1fr;gap:14px;align-items:start}
.wheel-focus-copy{position:relative;z-index:2;display:grid;gap:10px;min-width:0;width:100%;max-width:860px;margin:0 auto;justify-items:center;text-align:center}
.wheel-focus-canvas{position:relative;z-index:1;display:grid;justify-items:center;min-width:0;width:100%;padding-top:2px}
.wheel-mode-badge{display:inline-flex;align-items:center;min-height:26px;padding:3px 10px;border-radius:999px;background:#fef1ed;color:#d85c38;font-size:11px;font-weight:900;letter-spacing:.04em}
.wheel-focus-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:center;width:100%;max-width:520px;padding:10px;border:1px solid rgba(223,231,239,.96);border-radius:22px;background:rgba(245,247,251,.94);box-shadow:inset 0 1px 0 rgba(255,255,255,.92)}
.wheel-focus-actions .wheel-spin{flex:1 1 260px}
.wheel-focus-actions .btn-secondary{min-width:92px}
.wheel-spin.large{min-width:220px;min-height:48px;font-size:1rem}
.wheel-result.focus{align-items:center;text-align:center;min-height:auto;padding:4px 0 0}
.wheel-management-block{margin-top:8px}.wheel-management-landing{margin:0 0 14px;padding:14px 16px;border:1px solid rgba(42,75,56,.12);border-radius:10px;background:#fbfdfb}.wheel-management-landing-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.wheel-management-nav{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px}.wheel-management-nav .btn{min-height:34px}.wheel-management-landing .wheel-management-summary{margin-top:12px}
.wheel-mode-pills{display:flex;flex-wrap:wrap;gap:8px}
.wheel-mode-pill{display:inline-flex;align-items:center;padding:10px 14px;border-radius:14px;border:0;background:transparent;color:#6a756f;font-size:13px;font-weight:850;cursor:pointer}
.wheel-mode-pills.segmented{padding:6px;border:1px solid rgba(219,225,233,.9);border-radius:20px;background:rgba(245,247,251,.94);box-shadow:inset 0 1px 0 rgba(255,255,255,.92);gap:0}
.wheel-mode-pills.segmented .wheel-mode-pill{background:transparent;min-height:42px}
.wheel-mode-pill.active{background:#fff;color:var(--text);box-shadow:0 12px 24px rgba(35,60,45,.1)}
.wheel-action-menu-button{min-height:42px;padding:10px 16px;border-radius:16px;font-weight:900}
.wheel-mode-title{margin:0;color:var(--text);font-size:clamp(22px,3.4vw,34px);font-weight:900;line-height:1.24}
.hero-tags{justify-content:center;margin-top:0}
.wheel-action-menu-wrap{position:relative;justify-self:end;z-index:30}.wheel-action-menu{position:absolute;right:0;top:calc(100% + 8px);z-index:40;display:grid;width:178px;padding:8px;border:1px solid rgba(222,229,238,.96);border-radius:18px;background:rgba(255,255,255,.98);box-shadow:0 18px 42px rgba(35,60,45,.16)}.wheel-action-menu button{width:100%;min-height:36px;padding:8px 10px;border:0;background:transparent;text-align:left;border-radius:12px;color:var(--text);cursor:pointer;font:inherit;font-size:13px;font-weight:850}.wheel-action-menu button:hover{background:#f6f8fb;color:#c64d2d}.wheel-header-actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;align-items:center}
.wheel-management-block[data-management-panel="list"] #wheel-create-panel,
.wheel-management-block[data-management-panel="list"] #wheel-history-panel,
.wheel-management-block[data-management-panel="list"] .wheel-management-grid .management-card,
.wheel-management-block[data-management-panel="list"] #wheel-library-panel,
.wheel-management-block[data-management-panel="create"] #wheel-history-panel,
.wheel-management-block[data-management-panel="create"] .wheel-management-grid,
.wheel-management-block[data-management-panel="edit"] #wheel-history-panel,
.wheel-management-block[data-management-panel="edit"] #wheel-tags-panel,
.wheel-management-block[data-management-panel="edit"] #wheel-library-panel,
.wheel-management-block[data-management-panel="library"] #wheel-create-panel,
.wheel-management-block[data-management-panel="library"] #wheel-history-panel,
.wheel-management-block[data-management-panel="library"] .wheel-management-grid > article:not(#wheel-library-panel),
.wheel-management-block[data-management-panel="tags"] #wheel-create-panel,
.wheel-management-block[data-management-panel="tags"] #wheel-history-panel,
.wheel-management-block[data-management-panel="tags"] .wheel-management-grid > article:not(#wheel-tags-panel),
.wheel-management-block[data-management-panel="history"] #wheel-create-panel,
.wheel-management-block[data-management-panel="history"] .wheel-management-grid {
  display: none !important;
}
</style>
