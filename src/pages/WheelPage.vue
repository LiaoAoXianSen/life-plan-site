<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { createLegacyServices, getTodayStr } from '../services/legacyServices';
import { useWheelStore, type WheelItem, type WheelMode, type WheelTag } from '../stores/wheelStore';

const wheelStore = useWheelStore();
const wheelServices = createLegacyServices();
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
const managementListMode = ref<'all' | WheelMode>('all');
let spinTimer: number | undefined;
let spinFrame: number | undefined;
let dragState: {
  x: number;
  y: number;
  moved: boolean;
  startAngle: number;
  startRotation: number;
  pointerId: number;
} | null = null;
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
const sortedHistory = computed(() => wheelStore.history
  .slice()
  .sort((a, b) => String(b.createdAt || b.updatedAt || '').localeCompare(String(a.createdAt || a.updatedAt || ''))));
const isTagSecondStage = computed(() => Boolean(selectedWheel.value?.mode === 'tag' && stageTag.value));
const stageHint = computed(() => {
  if (isTagSecondStage.value) return `当前是第二段，正在从“${stageTag.value?.name || ''}”对应的内容池里继续抽取。`;
  if (selectedWheel.value?.mode === 'tag') return '标签转盘会先定标签，再抽具体内容；也可以直接点某个标签单独转。';
  return '点击转盘或按钮都可以开始，普通转盘会直接给出最终结果。';
});
const segmentColors = ['#bcdcc9', '#d7e5f5', '#f4d5b7', '#e3d6f4', '#d1e6db', '#f3dfad'];
const canvasRef = ref<HTMLCanvasElement | null>(null);
const displayEntries = computed(() => {
  if (selectedWheel.value?.mode === 'tag' && !stageTag.value) return availableTags.value;
  return selectedOptions.value;
});

const wheelForm = reactive<{ id: string; name: string; mode: WheelMode; tagIds: string[]; itemsText: string }>({ id: '', name: '', mode: 'normal', tagIds: [], itemsText: '' });
const wheelCreateItems = ref<Array<{ name: string; weight: number }>>([{ name: '', weight: 1 }]);
const optionForm = reactive({ id: '', name: '', weight: 1, enabled: true });
const optionBatchText = ref('');
const copyLibraryTagFilter = ref('');
const copyLibraryId = ref('');
const tagForm = reactive({ id: '', name: '', color: '#216e4e', weight: 1, enabled: true });
const libraryForm = reactive({ id: '', name: '', tagIds: [] as string[], weight: 1, enabled: true });
const libraryBatchText = ref('');
const libraryTagFilter = ref('');
const selectedLibraryIds = ref<string[]>([]);
const batchLibraryTagIds = ref<string[]>([]);
const libraryAiSuggestions = ref<Array<{ tagId: string; name: string; reason: string; selected: boolean }>>([]);
const libraryAiStatus = ref('');
const libraryAiRunning = ref(false);
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
const managementStats = computed(() => {
  const wheel = selectedWheel.value;
  const activeCount = wheel
    ? wheel.mode === 'tag'
      ? (stageTag.value ? selectedOptions.value.length : availableTags.value.length)
      : selectedOptions.value.length
    : 0;
  const activeLabel = wheel?.mode === 'tag'
    ? (stageTag.value ? '标签内候选' : '可抽标签')
    : '当前选项';
  return [
    { label: activeLabel, value: activeCount },
    { label: '公共项', value: wheelStore.libraryItems.filter(item => item.enabled !== false).length },
    { label: '标签', value: wheelStore.tags.filter(tag => tag.enabled !== false).length },
    { label: '记录', value: wheel ? wheelStore.history.filter(entry => entry.wheelId === wheel.id).length : 0 },
  ];
});
const managementWheels = computed(() => wheelStore.wheels
  .filter(wheel => managementListMode.value === 'all' || wheel.mode === managementListMode.value)
  .slice()
  .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt))));

watch(() => wheelStore.wheels, wheels => {
  if (!wheels.some(wheel => wheel.id === selectedId.value)) selectedId.value = wheels[0]?.id || '';
}, { immediate: true, deep: true });
watch(selectedId, () => { stageTag.value = null; resultId.value = ''; notice.value = ''; });
watch(displayEntries, () => { void nextTick(drawWheelCanvas); }, { immediate: true, deep: true });
onMounted(drawWheelCanvas);
watch([() => route.query.library, () => wheelStore.libraryItems.length], ([value]) => {
  const id = String(Array.isArray(value) ? value[0] || '' : value || '');
  if (!id) return;
  const item = wheelStore.libraryItems.find(entry => entry.id === id);
  if (item) {
    showManagement.value = true;
    activeManagementPanel.value = 'library';
    menuOpen.value = false;
    say(`已定位公共项：${item.name}`);
  }
}, { immediate: true });
watch([() => route.query.tag, () => wheelStore.tags.length], ([value]) => {
  if (value === undefined) return;
  showManagement.value = true;
  activeManagementPanel.value = 'tags';
  menuOpen.value = false;
  const id = String(Array.isArray(value) ? value[0] || '' : value || '');
  if (!id) return;
  const tag = wheelStore.tags.find(entry => entry.id === id);
  if (tag) {
    say(`已定位转盘标签：${tag.name}`);
    void nextTick(() => {
      const row = Array.from(document.querySelectorAll('[data-wheel-tag-id]'))
        .find(item => item.getAttribute('data-wheel-tag-id') === id);
      row?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
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
onBeforeUnmount(() => {
  if (spinTimer) window.clearTimeout(spinTimer);
  if (spinFrame) window.cancelAnimationFrame(spinFrame);
});
const copyableLibraryItems = computed(() => {
  if (!copyLibraryTagFilter.value) return wheelStore.libraryItems;
  return wheelStore.libraryItems.filter(item => itemTagIds(item).includes(copyLibraryTagFilter.value));
});

const wheelPalette = ['#ff6b6b', '#ff9f43', '#ffd166', '#06d6a0', '#2ec4b6', '#00bbf9', '#5c7cfa', '#9b5de5', '#f15bb5', '#8ac926'];
let wheelRenderCache: { key: string; canvas: HTMLCanvasElement; radius: number; innerRadius: number; count: number } | null = null;

function splitWheelLabel(value: string, maxCharsPerLine: number, maxLines: number) {
  const text = String(value || '').trim();
  if (!text || maxLines <= 0 || maxCharsPerLine <= 0) return [];
  const lines: string[] = [];
  for (let index = 0; index < text.length && lines.length < maxLines; index += maxCharsPerLine) lines.push(text.slice(index, index + maxCharsPerLine));
  if (text.length > maxCharsPerLine * maxLines) {
    const last = lines.length - 1;
    lines[last] = `${lines[last].slice(0, Math.max(1, maxCharsPerLine - 1))}…`;
  }
  return lines;
}

function wheelLabelPlan(count: number) {
  if (count <= 8) return { maxChars: 6, maxLines: 2, fontSize: 15, showStroke: true, shadow: true, layout: 'tangent', textColor: '#ffffff' };
  if (count <= 18) return { maxChars: 5, maxLines: 2, fontSize: 12, showStroke: true, shadow: false, layout: 'tangent', textColor: '#ffffff' };
  if (count <= 40) return { maxChars: 8, maxLines: 1, fontSize: 11, showStroke: true, shadow: false, layout: 'radial', textColor: '#3a322c' };
  if (count <= 80) return { maxChars: 7, maxLines: 1, fontSize: 10, showStroke: true, shadow: false, layout: 'radial', textColor: '#3a322c' };
  return { maxChars: 6, maxLines: 1, fontSize: 9, showStroke: true, shadow: false, layout: 'radial', textColor: '#3a322c' };
}

function wheelSliceColor(entry: unknown, index: number, count: number) {
  const own = String((entry as { color?: unknown }).color || '');
  if (count <= wheelPalette.length && /^#[0-9a-f]{6}$/i.test(own)) return own;
  if (count <= wheelPalette.length) return wheelPalette[index % wheelPalette.length];
  const hue = Math.round((index / Math.max(1, count)) * 360);
  const saturation = count >= 80 ? 52 : count >= 40 ? 56 : 60;
  const lightness = count >= 80 ? 80 : count >= 40 ? 76 : 72;
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

function wheelLabel(entry: unknown, index: number, plan: ReturnType<typeof wheelLabelPlan>) {
  const raw = String((entry as { name?: unknown }).name || '未命名').trim();
  const compact = raw.replace(/^[\d]+[\.、．\s]*/, '').replace(/\s+/g, '').replace(/[（(].*?[）)]/g, '').trim() || '未命名';
  if (plan.layout === 'radial') {
    const short = compact.slice(0, plan.maxChars);
    return [`${index + 1} ${short}${compact.length > plan.maxChars ? '…' : ''}`];
  }
  return splitWheelLabel(compact, plan.maxChars, plan.maxLines);
}

type WheelRenderEntry = { id?: unknown; name?: unknown; color?: unknown; weight?: unknown };

function buildWheelRenderCache(entries: WheelRenderEntry[]) {
  const key = entries.map(entry => `${entry.id || ''}|${entry.name || ''}|${entry.color || ''}|${entry.weight || 1}`).join('||');
  if (wheelRenderCache?.key === key && wheelRenderCache.count === entries.length) return wheelRenderCache;
  const size = entries.length >= 48 ? 900 : 720;
  const offscreen = document.createElement('canvas');
  offscreen.width = size;
  offscreen.height = size;
  const ctx = offscreen.getContext('2d');
  if (!ctx) return null;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - (entries.length >= 48 ? 22 : 28);
  const count = entries.length;
  const plan = wheelLabelPlan(count);
  const innerRadius = Math.max(54, radius * (count >= 80 ? 0.2 : count >= 40 ? 0.24 : count >= 20 ? 0.26 : 0.28));
  const labelRadius = innerRadius + (radius - innerRadius) * (plan.layout === 'radial' ? 0.62 : count <= 8 ? 0.52 : 0.58);
  const radialTextMaxWidth = Math.max(36, radius - innerRadius - 18);
  ctx.clearRect(0, 0, size, size);
  ctx.beginPath(); ctx.fillStyle = '#e8edf2'; ctx.arc(cx, cy, radius + 14, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.fillStyle = '#f8fafc'; ctx.arc(cx, cy, radius + 6, 0, Math.PI * 2); ctx.fill();
  if (count) {
    const slice = (Math.PI * 2) / count;
    entries.forEach((entry, index) => {
      const start = index * slice;
      const end = start + slice;
      const mid = start + slice / 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(start) * innerRadius, cy + Math.sin(start) * innerRadius);
      ctx.arc(cx, cy, radius, start, end);
      ctx.arc(cx, cy, innerRadius, end, start, true);
      ctx.closePath();
      ctx.fillStyle = wheelSliceColor(entry, index, count);
      ctx.fill();
      if (plan.showStroke) {
        ctx.lineWidth = count <= 16 ? 2 : count <= 48 ? 1.1 : .7;
        ctx.strokeStyle = count >= 36 ? 'rgba(255,255,255,.82)' : 'rgba(255,255,255,.92)';
        ctx.stroke();
      }
      const lines = wheelLabel(entry, index, plan);
      if (!lines.length) return;
      ctx.save();
      if (plan.layout === 'radial') {
        ctx.translate(cx, cy); ctx.rotate(mid);
        const flip = Math.cos(mid) < 0;
        if (flip) ctx.rotate(Math.PI);
        ctx.fillStyle = plan.textColor; ctx.font = `700 ${plan.fontSize}px Microsoft YaHei, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(lines[0], flip ? -labelRadius : labelRadius, 0, radialTextMaxWidth);
      } else {
        ctx.translate(cx + Math.cos(mid) * labelRadius, cy + Math.sin(mid) * labelRadius);
        let angle = mid; if (angle > Math.PI / 2 && angle < Math.PI * 1.5) angle += Math.PI;
        ctx.rotate(angle); ctx.fillStyle = plan.textColor;
        if (plan.shadow) { ctx.shadowColor = 'rgba(16,23,19,.14)'; ctx.shadowBlur = 8; }
        ctx.font = `800 ${plan.fontSize}px Microsoft YaHei, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const lineHeight = plan.fontSize + 4; const offset = lines.length > 1 ? lineHeight / 2 : 0;
        lines.forEach((line, lineIndex) => ctx.fillText(line, 0, lineIndex * lineHeight - offset));
      }
      ctx.restore();
    });
  } else {
    ctx.beginPath(); ctx.fillStyle = '#eef2f7'; ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
  }
  ctx.beginPath(); ctx.strokeStyle = 'rgba(255,255,255,.98)'; ctx.lineWidth = count >= 48 ? 8 : 10; ctx.arc(cx, cy, radius + 1, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.strokeStyle = 'rgba(120,132,146,.18)'; ctx.lineWidth = 3; ctx.arc(cx, cy, radius + 8, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.fillStyle = '#ffffff'; ctx.arc(cx, cy, innerRadius + 2, 0, Math.PI * 2); ctx.fill();
  wheelRenderCache = { key, canvas: offscreen, radius, innerRadius, count };
  return wheelRenderCache;
}

function drawWheelCanvas(selectedIndex = -1) {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const entries = displayEntries.value;
  const ratio = window.devicePixelRatio || 1;
  const cssSize = 390;
  canvas.width = cssSize * ratio;
  canvas.height = cssSize * ratio;
  canvas.style.width = '100%'; canvas.style.height = '100%';
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, cssSize, cssSize);
  const cache = buildWheelRenderCache(entries);
  if (!cache) return;
  const scale = cssSize / cache.canvas.width;
  ctx.drawImage(cache.canvas, 0, 0, cache.canvas.width * scale, cache.canvas.height * scale);
  if (selectedIndex >= 0 && selectedIndex < entries.length) {
    const radius = cache.radius * scale;
    const innerRadius = cache.innerRadius * scale;
    const slice = (Math.PI * 2) / entries.length;
    const start = selectedIndex * slice;
    ctx.beginPath();
    ctx.moveTo(cssSize / 2 + Math.cos(start) * innerRadius, cssSize / 2 + Math.sin(start) * innerRadius);
    ctx.arc(cssSize / 2, cssSize / 2, radius, start, start + slice);
    ctx.arc(cssSize / 2, cssSize / 2, innerRadius, start + slice, start, true);
    ctx.closePath();
    ctx.fillStyle = 'rgba(251,93,87,.28)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(251,93,87,.95)';
    ctx.stroke();
  }
  drawCenter(ctx, cssSize / 2, cssSize / 2, entries.length ? 'GO' : '空');
}

function drawCenter(ctx: CanvasRenderingContext2D, cx: number, cy: number, label: string) {
  const radius = label === '空' ? 43 : 43;
  ctx.beginPath(); ctx.fillStyle = '#ffffff'; ctx.arc(cx, cy, radius + 8, 0, Math.PI * 2); ctx.fill();
  const gradient = ctx.createRadialGradient(cx, cy, 10, cx, cy, radius + 8);
  gradient.addColorStop(0, '#ffffff'); gradient.addColorStop(1, '#f2f5f9');
  ctx.beginPath(); ctx.fillStyle = gradient; ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.strokeStyle = 'rgba(23,33,27,.08)'; ctx.lineWidth = 2; ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#68766f'; ctx.font = '700 12px Microsoft YaHei, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label === 'GO' ? '点击旋转' : '暂无可抽内容', cx, cy - 9);
  ctx.fillStyle = '#16201b'; ctx.font = '900 16px Microsoft YaHei, sans-serif'; ctx.fillText(label, cx, cy + 13);
}

function say(message: string) { notice.value = message; }
function handle(action: () => void, success = '') { try { action(); if (success) say(success); } catch (error) { say(error instanceof Error ? error.message : String(error)); } }
function confirmAction(message: string, action: () => void, success = '') { if (window.confirm(message)) handle(action, success); }
function formatStoredDateTime(value: unknown) {
  const raw = String(value || '');
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return raw.replace('T', ' ');
  return `${match[1]}年${Number(match[2])}月${Number(match[3])}日 ${match[4]}:${match[5]}:${match[6] || '00'}`;
}
function clearCurrentResult() {
  resultId.value = '';
  say('已保留这条抽取记录');
}
function itemTagIds(item: WheelItem) { return Array.isArray(item.tagIds) ? item.tagIds as string[] : []; }
function libraryTagNames(item: WheelItem) { return itemTagIds(item).map(id => wheelStore.tags.find(tag => tag.id === id)?.name).filter(Boolean).join('、') || '未分类'; }
function resetWheelForm() { Object.assign(wheelForm, { id: '', name: '', mode: 'normal', tagIds: [], itemsText: '' }); wheelCreateItems.value = [{ name: '', weight: 1 }]; }
function editWheel() {
  const wheel = selectedWheel.value;
  if (!wheel) return;
  showManagement.value = true;
  activeManagementPanel.value = 'edit';
  menuOpen.value = false;
  Object.assign(wheelForm, { id: wheel.id, name: wheel.name, mode: wheel.mode, tagIds: [...(wheel.tagIds || [])], itemsText: wheel.items.map(item => `${item.name},${item.weight}`).join('\n') });
  wheelCreateItems.value = wheel.items.map(item => ({ name: item.name, weight: item.weight }));
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
      const created = wheelStore.createWheel({ name: wheelForm.name, mode: wheelForm.mode, tagIds: wheelForm.tagIds, items: wheelCreateItems.value.filter(item => item.name.trim()) });
      selectedId.value = created.id;
    }
    resetWheelForm();
  }, wheelForm.id ? '已更新转盘' : '已创建转盘');
}
function removeWheel() { const wheel = selectedWheel.value; if (wheel && window.confirm(`删除转盘“${wheel.name}”吗？抽取历史会保留。`)) handle(() => wheelStore.deleteWheel(wheel.id), '已删除转盘'); }
function openWheelFromList(wheel: typeof selectedWheel.value) {
  if (!wheel) return;
  selectedId.value = wheel.id;
  stageTag.value = null;
  resultId.value = '';
  showManagement.value = false;
  say(`已打开转盘：${wheel.name}`);
}
function editWheelFromList(wheel: typeof selectedWheel.value) {
  if (!wheel) return;
  selectedId.value = wheel.id;
  void nextTick(editWheel);
}
function renameWheelFromList(wheel: typeof selectedWheel.value) {
  if (!wheel) return;
  const nextName = window.prompt('修改转盘名称', wheel.name);
  if (nextName === null) return;
  handle(() => wheelStore.updateWheel(wheel.id, { name: nextName }), '已更新转盘名称');
}
function removeWheelFromList(wheel: typeof selectedWheel.value) {
  if (!wheel || !window.confirm(`删除转盘“${wheel.name}”吗？抽取历史会保留。`)) return;
  handle(() => wheelStore.deleteWheel(wheel.id), '已删除转盘');
}
function resetOptionForm() { Object.assign(optionForm, { id: '', name: '', weight: 1, enabled: true }); }
function editOption(item: WheelItem) { Object.assign(optionForm, { id: item.id, name: item.name, weight: item.weight, enabled: item.enabled }); }
function submitOption() { const wheel = selectedWheel.value; if (!wheel) return; handle(() => { wheelStore.saveOption(wheel.id, optionForm); resetOptionForm(); }, optionForm.id ? '已更新选项' : '已添加选项'); }
function submitBatchOptions() {
  const wheel = selectedWheel.value;
  if (!wheel) return;
  const items = parseItems(optionBatchText.value);
  if (!items.length) return say('请先输入至少一个选项');
  handle(() => {
    const result = wheelStore.batchAddOptions(wheel.id, items);
    optionBatchText.value = '';
    say(result.skipped ? `已添加 ${result.added} 个选项，跳过 ${result.skipped} 个重复或空行` : `已添加 ${result.added} 个选项`);
  });
}
function copyLibraryItem() {
  const wheel = selectedWheel.value;
  if (!wheel || wheel.mode !== 'normal') return;
  if (!copyLibraryId.value) return say('请选择公共项');
  handle(() => {
    const copiedName = wheelStore.copyLibraryItemToWheel(wheel.id, copyLibraryId.value);
    copyLibraryId.value = '';
    say(`已复制公共项：${copiedName || '未命名选项'}`);
  });
}
function resetTagForm() { Object.assign(tagForm, { id: '', name: '', color: '#216e4e', weight: 1, enabled: true }); }
function editTag(tag: WheelTag) {
  showManagement.value = true;
  activeManagementPanel.value = 'tags';
  menuOpen.value = false;
  Object.assign(tagForm, { id: tag.id, name: tag.name, color: tag.color, weight: tag.weight, enabled: tag.enabled });
}
function submitTag() { handle(() => { wheelStore.saveTag(tagForm); resetTagForm(); }, tagForm.id ? '已更新标签' : '已添加标签'); }
function tagCandidateCount(tag: WheelTag) { return wheelStore.libraryItems.filter(item => item.enabled !== false && itemTagIds(item).includes(tag.id)).length; }
function ensureTagWheelContext() {
  if (selectedWheel.value?.mode === 'tag') return selectedWheel.value;
  const tagWheel = wheelStore.wheels.find(wheel => wheel.mode === 'tag');
  if (!tagWheel) {
    say('请先创建一个标签转盘');
    return null;
  }
  selectedId.value = tagWheel.id;
  stageTag.value = null;
  resultId.value = '';
  return tagWheel;
}
function previewTagStage(tag: WheelTag) {
  const wheel = ensureTagWheelContext();
  if (!wheel || !tagCandidateCount(tag)) return say('这个标签下没有可抽公共项');
  const activate = () => {
    stageTag.value = tag;
    resultId.value = '';
    showManagement.value = false;
    say(`已预览标签池：${tag.name}`);
  };
  void nextTick(activate);
}
function directTag(tag: WheelTag) {
  const wheel = ensureTagWheelContext();
  if (!wheel || !tagCandidateCount(tag)) return say('这个标签下没有可抽公共项');
  const activate = () => {
    stageTag.value = tag;
    resultId.value = '';
    showManagement.value = false;
    void nextTick(nextSpin);
  };
  void nextTick(activate);
}
function toggleTagEnabled(tag: WheelTag) {
  handle(() => wheelStore.toggleTagEnabled(tag.id), tag.enabled === false ? '已启用标签' : '已停用标签');
}
function resetLibraryForm() { Object.assign(libraryForm, { id: '', name: '', tagIds: [], weight: 1, enabled: true }); libraryAiSuggestions.value = []; libraryAiStatus.value = ''; }
function editLibrary(item: WheelItem) {
  showManagement.value = true;
  activeManagementPanel.value = 'library';
  menuOpen.value = false;
  Object.assign(libraryForm, { id: item.id, name: item.name, tagIds: [...(Array.isArray(item.tagIds) ? item.tagIds as string[] : [])], weight: item.weight, enabled: item.enabled });
}
function getWheelAiConfig() {
  try {
    return wheelServices.ai.normalizeConfig(JSON.parse(localStorage.getItem('lifePlanAiConfig') || '{}'));
  } catch {
    return wheelServices.ai.normalizeConfig({});
  }
}
function buildWheelTagSuggestPayload(itemText: string) {
  return {
    mode: 'wheelTagSuggest',
    title: '公共项标签推荐',
    today: getTodayStr(),
    userInput: itemText,
    context: {
      itemText,
      existingTags: wheelStore.tags.map(tag => ({ id: tag.id, name: tag.name, enabled: tag.enabled !== false })),
      sampleLibraryItems: wheelStore.libraryItems.slice(0, 20).map(item => ({ name: item.name, tags: libraryTagNames(item) })),
    },
    instruction: '只从 existingTags 中推荐 1-5 个标签；返回 tags[{name,reason}]，不要创建新标签。',
  };
}
function applyLibraryAiSuggestion(index: number, selected: boolean) {
  const suggestion = libraryAiSuggestions.value[index];
  if (!suggestion) return;
  suggestion.selected = selected;
  const next = new Set(libraryForm.tagIds);
  if (selected) next.add(suggestion.tagId); else next.delete(suggestion.tagId);
  libraryForm.tagIds = [...next];
}
function toggleLibraryTag(tagId: string, checked: boolean) {
  libraryForm.tagIds = toggleTag(libraryForm.tagIds, tagId, checked);
  libraryAiSuggestions.value.forEach((suggestion) => {
    if (suggestion.tagId === tagId) suggestion.selected = checked;
  });
}
async function suggestLibraryTags() {
  if (libraryAiRunning.value) return;
  const itemText = libraryForm.name.trim();
  if (!itemText) return say('请先输入公共项名称');
  if (!wheelStore.tags.length) return say('还没有标签，请先在标签管理中添加');
  libraryAiRunning.value = true;
  libraryAiStatus.value = '正在根据现有标签推荐…';
  libraryAiSuggestions.value = [];
  const config = getWheelAiConfig();
  const payload = buildWheelTagSuggestPayload(itemText);
  let usedFallback = false;
  try {
    let result: any;
    if (wheelServices.ai.isRemoteReady(config)) {
      try {
        result = await wheelServices.ai.requestRemoteAi(config, payload);
      } catch {
        usedFallback = true;
        result = wheelServices.ai.generateLocalAiResult(payload);
      }
    } else {
      result = wheelServices.ai.generateLocalAiResult(payload);
    }
    const byName = new Map(wheelStore.tags.map(tag => [String(tag.name).trim().toLowerCase(), tag]));
    const seen = new Set<string>();
    libraryAiSuggestions.value = (Array.isArray(result?.tags) ? result.tags : [])
      .map((tag: any) => {
        const name = String(tag?.name || tag || '').trim();
        const existing = byName.get(name.toLowerCase());
        if (!existing || seen.has(existing.id)) return null;
        seen.add(existing.id);
        return { tagId: existing.id, name: existing.name, reason: String(tag?.reason || '').trim(), selected: true };
      })
      .filter(Boolean)
      .slice(0, 5) as Array<{ tagId: string; name: string; reason: string; selected: boolean }>;
    libraryAiSuggestions.value.forEach((suggestion) => {
      const next = new Set(libraryForm.tagIds);
      next.add(suggestion.tagId);
      libraryForm.tagIds = [...next];
    });
    libraryAiStatus.value = usedFallback
      ? '远程 AI 请求失败，已使用本地规则推荐。'
      : (result?.summary || `已推荐 ${libraryAiSuggestions.value.length} 个已有标签。`);
    if (!libraryAiSuggestions.value.length) libraryAiStatus.value = '没有匹配到已有标签，请手动勾选。';
  } catch (error) {
    libraryAiStatus.value = error instanceof Error ? error.message : 'AI 推荐失败';
  } finally {
    libraryAiRunning.value = false;
  }
}
function submitLibrary() { handle(() => { wheelStore.saveLibraryItem(libraryForm); resetLibraryForm(); }, libraryForm.id ? '已更新公共项' : '已添加公共项'); }
function submitBatchLibrary() {
  const items = parseItems(libraryBatchText.value);
  if (!items.length) return say('请先输入至少一个公共项');
  handle(() => {
    const result = wheelStore.batchAddLibraryItems(items, batchLibraryTagIds.value);
    libraryBatchText.value = '';
    say(result.skipped ? `已添加 ${result.added} 个公共项，跳过 ${result.skipped} 个重复或空行` : `已添加 ${result.added} 个公共项`);
  });
}
function toggleLibraryEnabled(item: WheelItem) {
  handle(() => wheelStore.toggleLibraryEnabled(item.id), item.enabled === false ? '已启用公共项' : '已停用公共项');
}
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
    const entries = availableTags.value;
    const tag = wheelStore.weightedPick(entries);
    if (!tag) return say('这个标签转盘没有可抽标签，或标签下没有启用的公共项。');
    const selectedIndex = entries.findIndex(entry => entry.id === tag.id);
    animate(entries, Math.max(0, selectedIndex), () => { stageTag.value = tag; say(`已锁定标签：${tag.name}，再转一次抽具体内容。`); });
    return;
  }
  const entries = selectedOptions.value;
  const picked = wheelStore.weightedPick(entries);
  if (!picked) return say('当前转盘没有启用的可抽选项。');
  const selectedIndex = entries.findIndex(entry => entry.id === picked.id);
  animate(entries, Math.max(0, selectedIndex), () => {
    const history = wheelStore.recordSpin(wheel.id, picked, stageTag.value || undefined);
    resultId.value = history.id; stageTag.value = null; say(`抽中了：${picked.name}`);
  });
}
function animate(entries: Array<WheelRenderEntry>, selectedIndex: number, done: () => void) {
  if (spinning.value) return;
  spinning.value = true;
  buildWheelRenderCache(entries);
  const start = rotation.value;
  const slice = 360 / Math.max(1, entries.length);
  const desired = 270 - (selectedIndex * slice + slice / 2);
  const normalizedStart = ((start % 360) + 360) % 360;
  const delta = ((desired - normalizedStart) + 360) % 360;
  const extraTurns = entries.length >= 80 ? 1080 : entries.length >= 36 ? 1440 : 1800;
  const target = start + extraTurns + delta;
  const configured = Number((window as unknown as { __wheelSpinDurationMs?: number }).__wheelSpinDurationMs);
  const duration = Number.isFinite(configured) && configured > 0
    ? configured
    : entries.length >= 80 ? 2600 : entries.length >= 36 ? 3000 : 3600;
  const startTime = performance.now();
  const tick = (time: number) => {
    const progress = Math.min(1, (time - startTime) / duration);
    const eased = 1 - Math.pow(1 - progress, 2.4);
    const nextRotation = start + (target - start) * eased;
    if (canvasRef.value) canvasRef.value.style.transform = `rotate(${nextRotation}deg)`;
    if (progress < 1) {
      spinFrame = window.requestAnimationFrame(tick);
      return;
    }
    rotation.value = ((nextRotation % 360) + 360) % 360;
    if (canvasRef.value) canvasRef.value.style.transform = `rotate(${rotation.value}deg)`;
    spinFrame = undefined;
    spinning.value = false;
    done();
    void nextTick(() => drawWheelCanvas());
  };
  spinFrame = window.requestAnimationFrame(tick);
}
function canvasClick() {
  if (suppressCanvasClick) {
    suppressCanvasClick = false;
    return;
  }
  nextSpin();
}
function canvasPointerDown(event: PointerEvent) {
  if (spinning.value || !displayEntries.value.length) return;
  const element = event.currentTarget as HTMLElement;
  const rect = element.getBoundingClientRect();
  const startAngle = Math.atan2(event.clientY - rect.top - rect.height / 2, event.clientX - rect.left - rect.width / 2) * 180 / Math.PI;
  dragState = { x: event.clientX, y: event.clientY, moved: false, startAngle, startRotation: rotation.value, pointerId: event.pointerId };
  element.setPointerCapture?.(event.pointerId);
}
function canvasPointerMove(event: PointerEvent) {
  if (!dragState || spinning.value || dragState.pointerId !== event.pointerId) return;
  const dx = event.clientX - dragState.x;
  const dy = event.clientY - dragState.y;
  if (Math.hypot(dx, dy) > 8) dragState.moved = true;
  if (!dragState.moved) return;
  const element = event.currentTarget as HTMLElement;
  const rect = element.getBoundingClientRect();
  const currentAngle = Math.atan2(event.clientY - rect.top - rect.height / 2, event.clientX - rect.left - rect.width / 2) * 180 / Math.PI;
  const nextRotation = dragState.startRotation + currentAngle - dragState.startAngle;
  rotation.value = nextRotation;
  if (canvasRef.value) canvasRef.value.style.transform = `rotate(${nextRotation}deg)`;
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
function addWheelCreateItem() { wheelCreateItems.value.push({ name: '', weight: 1 }); }
function removeWheelCreateItem(index: number) { if (wheelCreateItems.value.length <= 1) return; wheelCreateItems.value.splice(index, 1); }
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
                  <button class="btn btn-secondary" type="button" @click="clearCurrentResult">只保留记录</button>
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
            @click="canvasClick"
            @pointerdown="canvasPointerDown"
            @pointermove="canvasPointerMove"
            @pointerup="canvasPointerUp"
            @pointercancel="dragState = null"
          >
            <canvas ref="canvasRef" class="wheel-canvas" :style="{ transform: `rotate(${rotation}deg)` }" />
            <span class="wheel-center-label">{{ spinning ? '转动中' : isTagSecondStage ? '抽项目' : selectedWheel?.mode === 'tag' ? '抽标签' : 'GO' }}</span>
          </div>
          <div class="wheel-stage-hint">{{ stageHint }}</div>
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
          <div v-if="activeManagementPanel === 'list'" class="wheel-list-management">
            <div class="segmented wheel-list-mode-filter" role="tablist" aria-label="转盘列表模式">
              <button type="button" :class="{ active: managementListMode === 'all' }" @click="managementListMode = 'all'">全部</button>
              <button type="button" :class="{ active: managementListMode === 'normal' }" @click="managementListMode = 'normal'">普通</button>
              <button type="button" :class="{ active: managementListMode === 'tag' }" @click="managementListMode = 'tag'">标签</button>
            </div>
            <div class="wheel-list-stack">
              <article v-for="wheel in managementWheels" :key="wheel.id" class="wheel-list-card" :class="{ selected: wheel.id === selectedWheel?.id }">
                <div class="wheel-list-card-main"><div class="wheel-list-card-title"><strong>{{ wheel.name }}</strong><span v-if="wheel.id === selectedWheel?.id" class="wheel-list-badge current">当前</span></div><div class="wheel-list-card-meta"><span class="wheel-list-badge">{{ wheel.mode === 'tag' ? '标签' : '普通' }}</span><span>{{ wheel.mode === 'tag' ? `${wheelStore.candidateTags(wheel).length} 个标签` : `${wheel.items.filter(item => item.enabled !== false).length} 个选项` }}</span><span>{{ wheelStore.history.filter(entry => entry.wheelId === wheel.id).length }} 条记录</span></div></div>
                <div class="wheel-list-card-actions"><button class="wheel-mini-btn primary" type="button" @click="openWheelFromList(wheel)">打开</button><button class="wheel-mini-btn" type="button" @click="editWheelFromList(wheel)">修改</button><button class="wheel-mini-btn" type="button" @click="renameWheelFromList(wheel)">重命名</button><button class="wheel-mini-btn danger" type="button" @click="removeWheelFromList(wheel)">删除</button></div>
              </article>
              <div v-if="!managementWheels.length" class="empty-state wheel-list-empty"><strong>这一类还没有转盘</strong><span class="wheel-hint">{{ managementListMode === 'tag' ? '先新建一个标签盘。' : '先新建一个普通盘。' }}</span><button class="btn btn-primary" type="button" @click="openManagement('create')">新建转盘</button></div>
            </div>
          </div>
        </article>

        <aside class="wheel-side-stack">
          <form id="wheel-create-panel" class="card compact-form" @submit.prevent="submitWheel"><div class="card-title">{{ wheelForm.id ? '编辑转盘' : '新建转盘' }}</div><div class="form-group"><label>名称<input v-model="wheelForm.name" required placeholder="例如：今晚吃什么" /></label></div><div class="form-group"><label>模式<select v-model="wheelForm.mode" :disabled="Boolean(wheelForm.id)"><option value="normal">普通转盘</option><option value="tag">标签转盘（两段抽取）</option></select></label></div><div v-if="wheelForm.mode === 'normal'" class="form-group"><span class="field-label">选项</span><div class="wheel-create-items"><div v-for="(item, index) in wheelCreateItems" :key="index" class="wheel-create-item-row"><input v-model="item.name" :aria-label="`选项 ${index + 1}`" placeholder="选项名称" /><input v-model.number="item.weight" type="number" min="1" aria-label="选项权重" /><button v-if="wheelCreateItems.length > 1" class="link-button danger-text" type="button" :aria-label="`删除选项 ${index + 1}`" @click="removeWheelCreateItem(index)">删除</button></div><button class="btn btn-secondary" type="button" @click="addWheelCreateItem">添加选项</button></div></div><div v-else class="tag-checks"><label v-for="tag in wheelStore.tags" :key="tag.id"><input type="checkbox" :checked="wheelForm.tagIds.includes(tag.id)" @change="wheelForm.tagIds = toggleTag(wheelForm.tagIds, tag.id, ($event.target as HTMLInputElement).checked)" />{{ tag.name }}</label><span v-if="!wheelStore.tags.length" class="hint">先在标签管理中添加标签。</span></div><div class="inline-actions"><button class="btn btn-primary">{{ wheelForm.id ? '保存修改' : '创建转盘' }}</button><button v-if="wheelForm.id" class="btn btn-secondary" type="button" @click="resetWheelForm">取消</button></div></form>
          <article id="wheel-history-panel" class="card history-card"><div class="card-title-row"><div class="card-title">抽取记录</div><div class="history-head-actions"><button type="button" class="link-button" @click="exportCsv">导出 CSV</button><button type="button" class="link-button" @click="exportJson">导出 JSON</button><label class="link-button import-button">恢复 JSON<input type="file" accept=".json,application/json" @change="importJson" /></label><button type="button" class="link-button danger-text" @click="confirmAction('清空全部抽取记录吗？', () => wheelStore.clearHistory(), '已清空历史')">清空</button></div></div><div v-for="entry in sortedHistory" :key="entry.id" class="history-row"><div><strong>{{ entry.resultName }}</strong><span>{{ entry.wheelName }} · {{ formatStoredDateTime(entry.createdAt) }}<template v-if="entry.mode === 'tag'"> · 标签 {{ entry.tagName || '-' }}</template></span></div><span class="history-row-actions"><button v-if="!entry.convertedTodoId" type="button" class="link-button" @click="handle(() => wheelStore.convertHistoryToTodo(entry.id), '已转入今日待办')">转入待办</button><span v-else class="history-done">已转待办</span><button type="button" class="link-button danger-text" @click="confirmAction('删除这条记录吗？', () => wheelStore.deleteHistory(entry.id), '已删除记录')">删除</button></span></div><p v-if="!wheelStore.history.length" class="empty-state">还没有抽取记录。</p></article>
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
        <details v-if="selectedWheel?.mode === 'normal'" class="wheel-batch-tools">
          <summary>批量导入选项</summary>
          <textarea v-model="optionBatchText" rows="4" placeholder="每行一个选项，也可写成：散步,2" />
          <button class="btn btn-secondary" type="button" @click="submitBatchOptions">导入到当前转盘</button>
        </details>
        <details v-if="selectedWheel?.mode === 'normal'" class="wheel-batch-tools wheel-copy-tools">
          <summary>从公共项复制</summary>
          <div class="wheel-copy-row">
            <select v-model="copyLibraryTagFilter" aria-label="复制公共项标签筛选">
              <option value="">全部标签</option>
              <option v-for="tag in wheelStore.tags" :key="tag.id" :value="tag.id">{{ tag.name }}</option>
            </select>
            <select v-model="copyLibraryId" aria-label="复制公共项">
              <option value="">选择公共项</option>
              <option v-for="item in copyableLibraryItems" :key="item.id" :value="item.id">{{ item.name }} · 权重 {{ item.weight }}</option>
            </select>
            <button class="btn btn-secondary" type="button" @click="copyLibraryItem">复制到当前转盘</button>
          </div>
        </details>
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
        <div v-for="tag in wheelStore.tags" :key="tag.id" class="entity-row" :data-wheel-tag-id="tag.id"><span><i class="color-dot" :style="{ background: tag.color }" /><strong>{{ tag.name }}</strong><em>权重 {{ tag.weight }} · {{ tagCandidateCount(tag) }} 个公共项 · {{ tag.enabled ? '启用' : '停用' }}</em></span><span class="tag-row-actions"><button class="link-button" :disabled="tag.enabled === false || !tagCandidateCount(tag)" @click="directTag(tag)">只转这个标签</button><button class="link-button" :disabled="tag.enabled === false || !tagCandidateCount(tag)" @click="previewTagStage(tag)">先看这个标签池</button><button class="link-button" @click="toggleTagEnabled(tag)">{{ tag.enabled === false ? '启用' : '停用' }}</button><button class="link-button" @click="editTag(tag)">编辑</button><button class="link-button danger-text" @click="confirmAction(`删除标签“${tag.name}”吗？`, () => wheelStore.deleteTag(tag.id))">删除</button></span></div>
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
          <button class="btn btn-secondary" type="button" :disabled="libraryAiRunning" @click="suggestLibraryTags">{{ libraryAiRunning ? '推荐中…' : 'AI 推荐标签' }}</button>
          <div class="tag-checks"><label v-for="tag in wheelStore.tags" :key="tag.id"><input type="checkbox" :checked="libraryForm.tagIds.includes(tag.id)" @change="toggleLibraryTag(tag.id, ($event.target as HTMLInputElement).checked)" />{{ tag.name }}</label></div>
          <div v-if="libraryAiStatus || libraryAiSuggestions.length" class="library-ai-suggestions" role="status">
            <span class="hint">{{ libraryAiStatus }}</span>
            <label v-for="(suggestion, index) in libraryAiSuggestions" :key="suggestion.tagId" class="library-ai-suggestion"><input type="checkbox" :checked="suggestion.selected" @change="applyLibraryAiSuggestion(index, ($event.target as HTMLInputElement).checked)" /><span>{{ suggestion.name }}</span><small v-if="suggestion.reason">{{ suggestion.reason }}</small></label>
          </div>
          <div class="inline-actions"><button class="btn btn-primary">{{ libraryForm.id ? '保存公共项' : '添加公共项' }}</button><button v-if="libraryForm.id" type="button" class="btn btn-secondary" @click="resetLibraryForm">取消</button></div>
        </form>
        <details class="wheel-batch-tools library-batch-tools">
          <summary>批量导入公共项</summary>
          <textarea v-model="libraryBatchText" rows="4" placeholder="每行一个公共项，也可写成：周末晨跑,2" />
          <div class="batch-tag-checks" role="group" aria-label="批量导入标签"><label v-for="tag in wheelStore.tags" :key="tag.id"><input type="checkbox" :checked="batchLibraryTagIds.includes(tag.id)" @change="batchLibraryTagIds = toggleTag(batchLibraryTagIds, tag.id, ($event.target as HTMLInputElement).checked)" />{{ tag.name }}</label></div>
          <button class="btn btn-secondary" type="button" @click="submitBatchLibrary">导入公共项</button>
        </details>
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
        <div v-for="item in filteredLibraryItems" :key="item.id" class="entity-row library-row" :data-wheel-library-id="item.id" :class="{ selected: selectedLibrarySet.has(item.id) }">
          <label class="library-select"><input v-model="selectedLibraryIds" type="checkbox" :value="item.id" :aria-label="`选择公共项 ${item.name}`" /></label>
          <span><strong>{{ item.name }}</strong><em>权重 {{ item.weight }} · {{ item.enabled ? '启用' : '停用' }} · {{ libraryTagNames(item) }}</em></span>
          <span><button class="link-button" @click="editLibrary(item)">编辑</button><button class="link-button" @click="toggleLibraryEnabled(item)">{{ item.enabled ? '停用' : '启用' }}</button><button class="link-button danger-text" @click="confirmAction(`删除公共项“${item.name}”吗？`, () => wheelStore.deleteLibraryItem(item.id), '已删除公共项')">删除</button></span>
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
.wheel-canvas{display:block;transform-origin:center;will-change:transform}
.wheel-mode-badge{display:inline-flex;align-items:center;min-height:26px;padding:3px 10px;border-radius:999px;background:#fef1ed;color:#d85c38;font-size:11px;font-weight:900;letter-spacing:.04em}
.wheel-focus-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:center;width:100%;max-width:520px;padding:10px;border:1px solid rgba(223,231,239,.96);border-radius:22px;background:rgba(245,247,251,.94);box-shadow:inset 0 1px 0 rgba(255,255,255,.92)}
.wheel-focus-actions .wheel-spin{flex:1 1 260px}
.wheel-focus-actions .btn-secondary{min-width:92px}
.wheel-batch-tools{display:grid;gap:8px;margin:12px 0;padding:10px 12px;border:1px solid rgba(223,231,239,.9);border-radius:12px;background:#fafbfd}.wheel-batch-tools summary{cursor:pointer;font-weight:850;color:#53625a}.wheel-batch-tools textarea{width:100%;resize:vertical;min-height:76px}
.wheel-copy-row{display:grid;grid-template-columns:minmax(120px,.7fr) minmax(180px,1.3fr) auto;gap:8px;align-items:center}.wheel-copy-row select{min-height:38px;min-width:0}
.tag-row-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px}
.library-batch-tools{margin-top:12px}
.wheel-list-management{display:grid;gap:12px;margin-top:16px}.wheel-list-mode-filter{display:flex;flex-wrap:wrap;gap:6px}.wheel-list-mode-filter button{min-height:34px;padding:7px 12px;border:1px solid rgba(215,224,232,.95);border-radius:10px;background:#fff;color:#53625a;cursor:pointer;font:inherit;font-size:12px;font-weight:800}.wheel-list-mode-filter button.active{background:#eaf5ee;border-color:#a6cdb3;color:#216e4e}.wheel-list-stack{display:grid;gap:10px}.wheel-list-empty{display:grid;gap:8px;justify-items:center;align-content:center;padding:28px 16px}.wheel-list-empty strong{font-size:14px;color:#2b3a33}.wheel-list-empty .wheel-hint{display:block}.wheel-list-card{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border:1px solid rgba(220,228,235,.96);border-radius:14px;background:#fff}.wheel-list-card.selected{border-color:#a8cdb4;box-shadow:0 0 0 2px rgba(33,110,78,.08)}.wheel-list-card-main{display:grid;gap:7px;min-width:0}.wheel-list-card-title{display:flex;align-items:center;gap:8px;min-width:0}.wheel-list-card-title strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wheel-list-card-meta{display:flex;flex-wrap:wrap;gap:8px;color:#74817b;font-size:12px}.wheel-list-badge{display:inline-flex;align-items:center;padding:3px 8px;border-radius:999px;background:#f3f6f4;color:#53625a;font-size:11px;font-weight:800}.wheel-list-badge.current{background:#e8f5ed;color:#216e4e}.wheel-list-card-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px;flex-shrink:0}.wheel-mini-btn{min-height:32px;padding:6px 10px;border:1px solid rgba(215,224,232,.95);border-radius:9px;background:#fff;color:#53625a;cursor:pointer;font:inherit;font-size:12px;font-weight:800}.wheel-mini-btn.primary{background:#eef8f1;border-color:#afd1b8;color:#216e4e}.wheel-mini-btn.danger{color:#b64d47}
.history-head-actions,.history-row-actions{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:8px}.history-done{color:#688276;font-size:12px}
.wheel-create-items{display:grid;gap:8px}.wheel-create-item-row{display:grid;grid-template-columns:minmax(0,1fr) 84px auto;gap:8px;align-items:center}.wheel-create-item-row input{min-width:0}
.library-ai-suggestions{display:grid;gap:6px;padding:8px 10px;border:1px solid rgba(215,224,232,.9);border-radius:10px;background:#fafbfd}.library-ai-suggestion{display:flex;align-items:center;gap:7px;flex-wrap:wrap;font-size:12px}.library-ai-suggestion small{color:#74817b}
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
.wheel-center-label{display:none}
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
