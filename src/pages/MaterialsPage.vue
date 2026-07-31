<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useLifePlanStore } from '../stores/lifePlanStore';
import { useRecordsStore } from '../stores/recordsStore';
import type { DataEntity } from '../types/lifePlan';

type MaterialEntity = DataEntity & {
  id: string;
  type?: string;
  content?: string;
  tags?: string[];
  source?: string;
  note?: string;
};

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
const editorOpen = ref(false);
const activeMaterialId = ref('');
const formError = ref('');
const materialContentRef = ref<HTMLTextAreaElement | null>(null);
const form = reactive({ type: '摘抄', content: '', tagsInput: '', source: '', note: '' });
let randomTagsInitialized = false;

function normalizeTags(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : String(value || '').split(/[,，、;；/\s]+/);
  return Array.from(new Set(raw.map(tag => String(tag || '').trim()).filter(Boolean)));
}

function matchesTag(material: MaterialEntity, query: string) {
  const clean = query.trim().toLowerCase();
  return !clean || normalizeTags(material.tags).some(tag => tag.toLowerCase().includes(clean));
}

const materials = computed(() => lifePlan.data.materials as MaterialEntity[]);
const allTags = computed(() => Array.from(new Set(materials.value.flatMap(material => normalizeTags(material.tags)))).sort((a, b) => a.localeCompare(b, 'zh-CN')));
const filteredMaterials = computed(() => {
  const clean = keyword.value.trim().toLowerCase();
  return [...materials.value]
    .filter(material => typeFilter.value === 'all' || material.type === typeFilter.value)
    .filter(material => matchesTag(material, tagFilter.value))
    .filter(material => !clean || [material.type, material.content, material.source, material.note, ...normalizeTags(material.tags)]
      .filter(Boolean).join(' ').toLowerCase().includes(clean))
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
});
const randomMaterials = computed(() => randomMaterialIds.value
  .map(id => materials.value.find(material => material.id === id))
  .filter((material): material is MaterialEntity => Boolean(material)));

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
  Object.assign(form, { type: '摘抄', content: '', tagsInput: '', source: '', note: '' });
  formError.value = '';
}

function openMaterial(material?: MaterialEntity) {
  activeMaterialId.value = material?.id || '';
  Object.assign(form, {
    type: material?.type || '摘抄',
    content: material?.content || '',
    tagsInput: normalizeTags(material?.tags).join(', '),
    source: material?.source || '',
    note: material?.note || '',
  });
  formError.value = '';
  editorOpen.value = true;
  void nextTick(() => materialContentRef.value?.focus());
}

function closeMaterial(syncRoute = true) {
  editorOpen.value = false;
  activeMaterialId.value = '';
  resetForm();
  if (syncRoute && route.query.material) {
    const query = { ...route.query };
    delete query.material;
    void router.replace({ query });
  }
}

function saveMaterial() {
  if (!form.content.trim()) {
    formError.value = '请输入素材内容';
    return;
  }
  try {
    records.saveMaterial(activeMaterialId.value, {
      type: form.type,
      content: form.content,
      tags: normalizeTags(form.tagsInput),
      source: form.source,
      note: form.note,
    });
  } catch (error) {
    formError.value = error instanceof Error ? error.message : String(error);
    return;
  }
  closeMaterial();
  refreshRandom();
}

function deleteMaterial() {
  if (!activeMaterialId.value || !window.confirm('确定删除这条素材吗？')) return;
  records.deleteMaterial(activeMaterialId.value);
  closeMaterial();
  refreshRandom();
}

function formatStoredDateTime(value: unknown) {
  const raw = String(value || '');
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return raw.replace('T', ' ');
  return `${match[1]}年${Number(match[2])}月${Number(match[3])}日 ${match[4]}:${match[5]}:${match[6] || '00'}`;
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && editorOpen.value) closeMaterial();
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
watch(() => route.query.tag, value => { tagFilter.value = String(value || ''); });
watch(() => route.query.material, value => {
  const id = String(value || '');
  if (!id) {
    if (editorOpen.value && activeMaterialId.value) closeMaterial(false);
    return;
  }
  const material = materials.value.find(item => item.id === id);
  if (material) {
    openMaterial(material);
    return;
  }
  closeMaterial(false);
  const query = { ...route.query };
  delete query.material;
  void router.replace({ query });
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
      <button class="btn btn-primary" type="button" @click="openMaterial()">+ 新增素材</button>
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
          <div class="material-content">{{ material.content || '空素材' }}</div>
          <div v-if="normalizeTags(material.tags).length" class="idea-badge-row"><span v-for="tag in normalizeTags(material.tags)" :key="tag" class="tag-pill">{{ tag }}</span></div>
          <div v-if="material.source" class="material-meta">来源：{{ material.source }}</div>
          <div v-if="material.note" class="material-meta">备注：{{ material.note }}</div>
        </article>
        <div v-if="!randomMaterials.length" class="empty-state">当前标签下没有可展示素材</div>
      </div>
    </section>

    <div class="filter-bar material-filter-bar">
      <input v-model="keyword" type="search" aria-label="搜索素材" placeholder="搜索素材内容、来源、备注、标签" />
      <select v-model="typeFilter" aria-label="素材类型筛选"><option value="all">全部类型</option><option v-for="type in materialTypes" :key="type" :value="type">{{ type }}</option></select>
      <input v-model="tagFilter" type="search" aria-label="素材标签筛选" placeholder="按标签筛选" />
    </div>

    <div class="material-grid material-list">
      <article v-for="material in filteredMaterials" :key="material.id" class="material-card">
        <div class="material-card-head"><span class="material-type">{{ material.type || '素材' }}</span><span>{{ formatStoredDateTime(material.createdAt) }}</span></div>
        <div class="material-content">{{ material.content || '空素材' }}</div>
        <div v-if="normalizeTags(material.tags).length" class="idea-badge-row"><span v-for="tag in normalizeTags(material.tags)" :key="tag" class="tag-pill">{{ tag }}</span></div>
        <div v-if="material.source" class="material-meta">来源：{{ material.source }}</div>
        <div v-if="material.note" class="material-meta">备注：{{ material.note }}</div>
        <div class="idea-card-actions"><button class="btn btn-secondary" type="button" :aria-label="`编辑素材 ${material.content || '空素材'}`" @click="openMaterial(material)">编辑</button></div>
      </article>
      <div v-if="!filteredMaterials.length" class="empty-state">暂无匹配素材</div>
    </div>

    <div v-if="editorOpen" class="modal-overlay active" role="presentation">
      <form class="modal modal-sm material-editor" role="dialog" aria-modal="true" aria-labelledby="material-editor-title" @submit.prevent="saveMaterial">
        <div class="modal-header"><div class="modal-title" id="material-editor-title">{{ activeMaterialId ? '编辑素材' : '新增素材' }}</div><button class="close-btn" type="button" aria-label="关闭素材编辑" @click="closeMaterial()">×</button></div>
        <label class="form-group"><span>类型</span><select v-model="form.type"><option v-for="type in materialTypes" :key="type" :value="type">{{ type }}</option></select></label>
        <label class="form-group"><span>内容</span><textarea ref="materialContentRef" v-model="form.content" required rows="6" placeholder="粘贴金句、提示词或摘抄内容" /></label>
        <label class="form-group"><span>标签</span><input v-model="form.tagsInput" placeholder="用逗号分隔，例如 AI, 工作" /></label>
        <label class="form-group"><span>来源</span><input v-model="form.source" placeholder="书名、链接、作者或看到的位置" /></label>
        <label class="form-group"><span>备注</span><textarea v-model="form.note" rows="3" placeholder="为什么留下它，适合什么时候用" /></label>
        <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
        <div class="modal-action-row">
          <button v-if="activeMaterialId" class="btn btn-danger" type="button" @click="deleteMaterial">删除</button>
          <div class="modal-action-right"><button class="btn btn-secondary" type="button" @click="closeMaterial()">取消</button><button class="btn btn-primary" type="submit">保存</button></div>
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
.material-card { min-width: 0; }
.material-content { white-space: pre-wrap; }
.material-editor .form-group > span { display: block; margin-bottom: 6px; color: var(--muted); font-size: 12px; font-weight: 800; }
.material-editor .modal-action-row { position: sticky; bottom: 0; padding-top: 14px; background: var(--surface); }
@media (max-width: 640px) {
  .material-filter-bar { grid-template-columns: minmax(0, 1fr); }
}
</style>
