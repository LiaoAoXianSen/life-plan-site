<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useLifePlanStore } from '../stores/lifePlanStore';
import { useRecordsStore } from '../stores/recordsStore';
import type { Material } from '../types/lifePlan';

const materialTypes = ['金句', '提示词', '摘抄', '观点', '方法'];
const lifePlan = useLifePlanStore();
const records = useRecordsStore();
const route = useRoute();
const router = useRouter();
const keyword = ref('');
const typeFilter = ref('all');
const tagFilter = ref(String(route.query.tag || ''));
const selectedRandomTags = ref<string[]>([]);
const randomMaterialIds = ref<string[]>([]);
const expandedMaterialIds = ref<string[]>([]);
const detailMaterialId = ref('');
const editorOpen = ref(false);
const activeMaterialId = ref('');
const formError = ref('');
const materialTitleRef = ref<HTMLInputElement | null>(null);
const newTag = ref('');
const batchTags = ref('');
const form = reactive({ title: '', type: '摘抄', content: '', tags: [] as string[], source: '', note: '' });
let randomTagsInitialized = false;

function normalizeTags(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : String(value || '').split(/[,，、;；/\s]+/);
  return Array.from(new Set(raw.map(tag => String(tag || '').trim()).filter(Boolean)));
}

function normalizePreviewText(value: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function truncateText(value: unknown, maxLength: number) {
  const clean = normalizePreviewText(value);
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
}

function materialTitle(material: Material) {
  const explicit = normalizePreviewText(material.title);
  if (explicit) return explicit;
  return truncateText(material.content, 42) || '空素材';
}

function isLongMaterial(material: Material) {
  return materialTitle(material).length > 46
    || normalizePreviewText(material.content).length > 110
    || normalizePreviewText(material.source).length > 54
    || normalizePreviewText(material.note).length > 72;
}

function isExpanded(materialId: string) {
  return expandedMaterialIds.value.includes(materialId);
}

function toggleMaterialCard(materialId: string) {
  expandedMaterialIds.value = isExpanded(materialId)
    ? expandedMaterialIds.value.filter(id => id !== materialId)
    : [...expandedMaterialIds.value, materialId];
}

function matchesTag(material: Material, query: string) {
  const clean = query.trim().toLowerCase();
  return !clean || normalizeTags(material.tags).some(tag => tag.toLowerCase().includes(clean));
}

const materials = computed(() => lifePlan.data.materials);
const allTags = computed(() => Array.from(new Set(materials.value.flatMap(material => normalizeTags(material.tags)))).sort((a, b) => a.localeCompare(b, 'zh-CN')));
const filteredMaterials = computed(() => {
  const clean = keyword.value.trim().toLowerCase();
  return [...materials.value]
    .filter(material => typeFilter.value === 'all' || material.type === typeFilter.value)
    .filter(material => matchesTag(material, tagFilter.value))
    .filter(material => !clean || [material.title, material.type, material.content, material.source, material.note, ...normalizeTags(material.tags)]
      .filter(Boolean).join(' ').toLowerCase().includes(clean))
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
});
const randomMaterials = computed(() => randomMaterialIds.value
  .map(id => materials.value.find(material => material.id === id))
  .filter((material): material is Material => Boolean(material)));
const detailMaterial = computed(() => materials.value.find(material => material.id === detailMaterialId.value) || null);

function refreshRandom() {
  const selected = new Set(selectedRandomTags.value);
  const pool = materials.value.filter(material => !selected.size || normalizeTags(material.tags).some(tag => selected.has(tag)));
  const shuffled = [...pool];
  for (let index = 0; index < Math.min(3, shuffled.length); index += 1) {
    const swapIndex = index + Math.floor(Math.random() * (shuffled.length - index));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  randomMaterialIds.value = shuffled.slice(0, 3).map(material => material.id);
}

function resetForm() {
  Object.assign(form, { title: '', type: '摘抄', content: '', tags: [], source: '', note: '' });
  newTag.value = '';
  batchTags.value = '';
  formError.value = '';
}

function openEditor(material?: Material) {
  activeMaterialId.value = material?.id || '';
  Object.assign(form, {
    title: material ? materialTitle(material) : '',
    type: material?.type || '摘抄',
    content: material?.content || '',
    tags: normalizeTags(material?.tags),
    source: material?.source || '',
    note: material?.note || '',
  });
  batchTags.value = normalizeTags(material?.tags).join(', ');
  newTag.value = '';
  detailMaterialId.value = '';
  formError.value = '';
  editorOpen.value = true;
  void nextTick(() => materialTitleRef.value?.focus());
}

function closeEditor(syncRoute = true) {
  editorOpen.value = false;
  activeMaterialId.value = '';
  resetForm();
  if (syncRoute && route.query.material) removeMaterialQuery();
}

function openDetail(material: Material, syncRoute = true) {
  editorOpen.value = false;
  detailMaterialId.value = material.id;
  if (syncRoute && String(route.query.material || '') !== material.id) {
    void router.replace({ query: { ...route.query, material: material.id } });
  }
}

function closeDetail(syncRoute = true) {
  detailMaterialId.value = '';
  if (syncRoute && route.query.material) removeMaterialQuery();
}

function removeMaterialQuery() {
  const query = { ...route.query };
  delete query.material;
  void router.replace({ query });
}

function editDetailMaterial() {
  if (detailMaterial.value) openEditor(detailMaterial.value);
}

function addMaterialEditorTag() {
  const additions = normalizeTags(newTag.value);
  if (!additions.length) return;
  form.tags = normalizeTags([...form.tags, ...additions]);
  batchTags.value = form.tags.join(', ');
  newTag.value = '';
}

function syncBatchTags() {
  form.tags = normalizeTags([...form.tags, ...normalizeTags(batchTags.value)]);
  batchTags.value = form.tags.join(', ');
}

function saveMaterial() {
  if (!form.content.trim()) {
    formError.value = '请输入素材内容';
    return;
  }
  addMaterialEditorTag();
  syncBatchTags();
  try {
    records.saveMaterial(activeMaterialId.value, {
      title: form.title,
      type: form.type,
      content: form.content,
      tags: form.tags,
      source: form.source,
      note: form.note,
    });
  } catch (error) {
    formError.value = error instanceof Error ? error.message : String(error);
    return;
  }
  closeEditor();
  refreshRandom();
}

function deleteMaterial() {
  if (!activeMaterialId.value || !window.confirm('确定删除这条素材吗？')) return;
  records.deleteMaterial(activeMaterialId.value);
  closeEditor();
  refreshRandom();
}

function formatStoredDateTime(value: unknown) {
  const raw = String(value || '');
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return raw.replace('T', ' ');
  return `${match[1]}年${Number(match[2])}月${Number(match[3])}日 ${match[4]}:${match[5]}:${match[6] || '00'}`;
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;
  if (editorOpen.value) closeEditor();
  else if (detailMaterialId.value) closeDetail();
}

watch(allTags, tags => {
  selectedRandomTags.value = selectedRandomTags.value.filter(tag => tags.includes(tag));
  if (!randomTagsInitialized && tags.length) {
    selectedRandomTags.value = tags.slice(0, 3);
    randomTagsInitialized = true;
  }
  refreshRandom();
}, { immediate: true });
watch(selectedRandomTags, refreshRandom, { deep: true });
watch(() => route.query.tag, value => {
  tagFilter.value = String(value || '');
  keyword.value = '';
  typeFilter.value = 'all';
});
watch(() => route.query.material, value => {
  const id = String(value || '');
  if (!id) {
    detailMaterialId.value = '';
    return;
  }
  const material = materials.value.find(item => item.id === id);
  if (material) {
    openDetail(material, false);
    return;
  }
  detailMaterialId.value = '';
  removeMaterialQuery();
}, { immediate: true });

onMounted(() => window.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <section class="page active" id="page-materials">
    <header class="page-header">
      <div>
        <div class="page-title">素材库</div>
        <p class="page-subtitle">金句、提示词、摘抄和方法，都可以按标签收纳与随机展示。</p>
      </div>
      <button class="btn btn-primary" type="button" @click="openEditor()">+ 新增素材</button>
    </header>

    <section class="material-random-panel" aria-labelledby="material-random-title">
      <div class="section-title-row">
        <div class="section-title" id="material-random-title">随机展示</div>
        <button class="btn btn-secondary" type="button" @click="refreshRandom">换一批</button>
      </div>
      <div v-if="allTags.length" class="tag-picker" role="group" aria-label="随机展示标签">
        <label v-for="tag in allTags" :key="tag" class="tag-check">
          <input v-model="selectedRandomTags" type="checkbox" :value="tag" />
          <span>{{ tag }}</span>
        </label>
      </div>
      <div v-else class="empty-state">先给素材添加标签后，这里会出现随机展示筛选。</div>
      <div class="material-grid material-random-list">
        <article v-for="material in randomMaterials" :key="material.id" class="material-card compact">
          <div class="material-card-head"><span class="material-type">{{ material.type || '素材' }}</span><span>{{ formatStoredDateTime(material.createdAt) }}</span></div>
          <h3 class="material-title">{{ materialTitle(material) }}</h3>
          <div class="material-card-copy">
            <div class="material-content">{{ material.content || '空素材' }}</div>
            <div v-if="material.source" class="material-meta material-source">来源：{{ material.source }}</div>
            <div v-if="material.note" class="material-meta material-note">备注：{{ material.note }}</div>
          </div>
          <div v-if="normalizeTags(material.tags).length" class="idea-badge-row"><span v-for="tag in normalizeTags(material.tags)" :key="tag" class="tag-pill">{{ tag }}</span></div>
          <div class="idea-card-actions material-card-actions"><button class="btn btn-secondary todo-mini-btn" type="button" @click="openDetail(material)">查看详情</button></div>
        </article>
        <div v-if="!randomMaterials.length" class="empty-state">当前标签下没有可展示素材</div>
      </div>
    </section>

    <div class="filter-bar material-filter-bar">
      <input v-model="keyword" type="search" aria-label="搜索素材" placeholder="搜索标题、内容、来源、备注、标签" />
      <select v-model="typeFilter" aria-label="素材类型筛选"><option value="all">全部类型</option><option v-for="type in materialTypes" :key="type" :value="type">{{ type }}</option></select>
      <input v-model="tagFilter" type="search" aria-label="素材标签筛选" placeholder="按标签筛选" />
    </div>

    <div class="material-grid material-list">
      <article v-for="material in filteredMaterials" :key="material.id" class="material-card" :class="{ 'is-expanded': isExpanded(material.id) }">
        <div class="material-card-head"><span class="material-type">{{ material.type || '素材' }}</span><span>{{ formatStoredDateTime(material.createdAt) }}</span></div>
        <h3 class="material-title">{{ materialTitle(material) }}</h3>
        <div class="material-card-copy">
          <div class="material-content">{{ material.content || '空素材' }}</div>
          <div v-if="material.source" class="material-meta material-source">来源：{{ material.source }}</div>
          <div v-if="material.note" class="material-meta material-note">备注：{{ material.note }}</div>
        </div>
        <div v-if="normalizeTags(material.tags).length" class="idea-badge-row"><span v-for="tag in normalizeTags(material.tags)" :key="tag" class="tag-pill">{{ tag }}</span></div>
        <div class="idea-card-actions material-card-actions">
          <button v-if="isLongMaterial(material)" class="mini-link material-expand-btn" type="button" :aria-expanded="isExpanded(material.id)" @click="toggleMaterialCard(material.id)">{{ isExpanded(material.id) ? '收起内容' : '展开内容' }}</button>
          <button class="btn btn-secondary todo-mini-btn" type="button" @click="openDetail(material)">查看详情</button>
          <button class="btn btn-secondary todo-mini-btn" type="button" :aria-label="`编辑素材 ${materialTitle(material)}`" @click="openEditor(material)">编辑</button>
        </div>
      </article>
      <div v-if="!filteredMaterials.length" class="empty-state">暂无匹配素材</div>
    </div>

    <div v-if="detailMaterial" class="modal-overlay active" role="presentation">
      <article class="modal modal-md material-detail-modal" role="dialog" aria-modal="true" aria-labelledby="material-detail-title">
        <div class="modal-header"><div class="modal-title" id="material-detail-title">{{ materialTitle(detailMaterial) }}</div><button class="close-btn" type="button" aria-label="关闭素材详情" @click="closeDetail()">×</button></div>
        <div class="material-detail-meta"><span class="material-type">{{ detailMaterial.type || '素材' }}</span><span>{{ formatStoredDateTime(detailMaterial.createdAt) }}</span></div>
        <div class="material-detail-content">{{ detailMaterial.content || '空素材' }}</div>
        <div v-if="normalizeTags(detailMaterial.tags).length" class="idea-badge-row"><span v-for="tag in normalizeTags(detailMaterial.tags)" :key="tag" class="tag-pill">{{ tag }}</span></div>
        <section v-if="detailMaterial.source" class="material-detail-section"><strong>来源</strong><p>{{ detailMaterial.source }}</p></section>
        <section v-if="detailMaterial.note" class="material-detail-section"><strong>备注</strong><p>{{ detailMaterial.note }}</p></section>
        <div class="modal-action-row"><span /><div class="modal-action-right"><button class="btn btn-secondary" type="button" @click="closeDetail()">关闭</button><button class="btn btn-primary" type="button" @click="editDetailMaterial">编辑素材</button></div></div>
      </article>
    </div>

    <div v-if="editorOpen" class="modal-overlay active" role="presentation">
      <form class="modal modal-sm material-editor" role="dialog" aria-modal="true" aria-labelledby="material-editor-title" @submit.prevent="saveMaterial">
        <div class="modal-header"><div class="modal-title" id="material-editor-title">{{ activeMaterialId ? '编辑素材' : '新增素材' }}</div><button class="close-btn" type="button" aria-label="关闭素材编辑" @click="closeEditor()">×</button></div>
        <label class="form-group"><span>标题</span><input ref="materialTitleRef" v-model="form.title" placeholder="给这条素材一个方便回看的标题" /></label>
        <label class="form-group"><span>类型</span><select v-model="form.type"><option v-for="type in materialTypes" :key="type" :value="type">{{ type }}</option></select></label>
        <label class="form-group"><span>内容</span><textarea v-model="form.content" required rows="8" placeholder="粘贴金句、提示词或摘抄内容" /></label>
        <div class="form-group material-tag-editor">
          <span>标签</span>
          <div v-if="allTags.length" class="tag-picker material-existing-tags" role="group" aria-label="已有素材标签">
            <label v-for="tag in allTags" :key="tag" class="tag-check material-tag-option"><input v-model="form.tags" type="checkbox" :value="tag" @change="batchTags = normalizeTags(form.tags).join(', ')" /><span>{{ tag }}</span></label>
          </div>
          <div v-else class="material-tag-empty">暂无已有标签，可在下方添加</div>
          <div class="material-new-tag-row"><input v-model="newTag" aria-label="新素材标签" placeholder="输入新标签，按回车或点击添加" @keydown.enter.prevent="addMaterialEditorTag" /><button class="btn btn-secondary" type="button" @click="addMaterialEditorTag">添加标签</button></div>
          <input v-model="batchTags" class="material-tags-fallback" aria-label="批量素材标签" placeholder="也可用逗号批量输入标签" @blur="syncBatchTags" />
        </div>
        <label class="form-group"><span>来源</span><input v-model="form.source" placeholder="书名、链接、作者或看到的位置" /></label>
        <label class="form-group"><span>备注</span><textarea v-model="form.note" rows="3" placeholder="为什么留下它，适合什么时候用" /></label>
        <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
        <div class="modal-action-row">
          <button v-if="activeMaterialId" class="btn btn-danger" type="button" @click="deleteMaterial">删除</button>
          <div class="modal-action-right"><button class="btn btn-secondary" type="button" @click="closeEditor()">取消</button><button class="btn btn-primary" type="submit">保存</button></div>
        </div>
      </form>
    </div>
  </section>
</template>

<style scoped>
.material-filter-bar { grid-template-columns: minmax(0, 1fr) minmax(140px, .35fr) minmax(180px, .5fr); }
.material-random-panel { margin-bottom: 18px; }
.material-random-panel .section-title-row { margin-bottom: 10px; }
.material-random-list { margin-top: 12px; }
.material-card { min-width: 0; display: flex; flex-direction: column; }
.material-card.compact { background: #fbfdfb; }
.material-title { margin: 0 0 8px; color: var(--text); font-size: 16px; font-weight: 700; line-height: 1.45; overflow-wrap: anywhere; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; }
.material-card-copy { min-width: 0; }
.material-content { color: var(--text); font-size: 13px; font-weight: 650; line-height: 1.7; white-space: pre-line; overflow-wrap: anywhere; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; line-clamp: 3; overflow: hidden; }
.material-card.compact .material-content { -webkit-line-clamp: 2; line-clamp: 2; }
.material-meta { margin-top: 8px; color: var(--muted); font-size: 12px; line-height: 1.55; overflow-wrap: anywhere; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; }
.material-source { -webkit-line-clamp: 1; line-clamp: 1; }
.material-card.is-expanded .material-title,
.material-card.is-expanded .material-content,
.material-card.is-expanded .material-meta { display: block; max-height: none; overflow: visible; -webkit-line-clamp: unset; line-clamp: unset; }
.material-card-actions { margin-top: auto; padding-top: 12px; align-items: center; }
.material-expand-btn { margin: 0 auto 0 0; border: 0; background: transparent; color: var(--primary); cursor: pointer; font: inherit; font-size: 12px; font-weight: 800; }
.material-detail-modal { width: min(720px, calc(100vw - 28px)); max-height: min(86vh, 820px); overflow: auto; }
.material-detail-modal .modal-title { overflow-wrap: anywhere; }
.material-detail-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; color: var(--faint); font-size: 12px; font-weight: 700; }
.material-detail-content { color: var(--text); font-size: 15px; line-height: 1.8; overflow-wrap: anywhere; white-space: pre-wrap; }
.material-detail-section { margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--line); }
.material-detail-section strong { display: block; margin-bottom: 6px; color: var(--text); font-size: 13px; }
.material-detail-section p { margin: 0; color: var(--muted); line-height: 1.7; overflow-wrap: anywhere; white-space: pre-wrap; }
.material-editor .form-group > span { display: block; margin-bottom: 6px; color: var(--muted); font-size: 12px; font-weight: 800; }
.material-editor .modal-action-row { position: sticky; bottom: 0; padding-top: 14px; background: var(--surface); }
.material-tag-editor { min-width: 0; }
.material-existing-tags { max-height: 132px; overflow-y: auto; padding: 2px; }
.material-tag-option:has(input:checked) { border-color: #a9cdb7; background: var(--accent-soft); color: var(--accent); }
.material-tag-empty { width: 100%; margin: 8px 0; padding: 10px 12px; border: 1px dashed var(--line); border-radius: var(--radius); color: var(--faint); font-size: 12px; text-align: center; }
.material-new-tag-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; margin-bottom: 8px; }
.material-new-tag-row .btn { min-height: 40px; }
.material-tags-fallback { font-size: 12px !important; }
@media (max-width: 640px) {
  .material-filter-bar { grid-template-columns: minmax(0, 1fr); }
  .material-new-tag-row { grid-template-columns: minmax(0, 1fr); }
  .material-detail-modal { width: min(100%, calc(100vw - 18px)); }
}
</style>
