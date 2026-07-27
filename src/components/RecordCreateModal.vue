<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { getTodayStr } from '../services/legacyServices';
import { useLifePlanStore } from '../stores/lifePlanStore';
import { useRecordsStore } from '../stores/recordsStore';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'open-existing': [recordId: string];
}>();

const lifePlan = useLifePlanStore();
const records = useRecordsStore();
const step = ref<'type' | 'edit'>('type');
const draftId = ref('');
const selectedTemplateKey = ref('');
const templateValues = reactive<Record<string, string>>({});
const draftDirty = ref(false);
const draftStatus = ref('');
let hydrating = false;
let autoSaveTimer: number | undefined;

const typeGroups = [
  { label: '日常记录', types: ['日记', '日计划', '工作记录', '灵感碎片'] },
  { label: '周期复盘', types: ['周复盘', '月复盘', '年复盘'] },
  { label: '周期规划', types: ['周计划', '月计划', '年度计划', '3年计划'] },
  { label: '长期愿景', types: ['终身愿景'] },
];
const allTypes = typeGroups.flatMap(group => group.types);
const draft = reactive({
  title: '', content: '', type: '日记', startDate: getTodayStr(), endDate: getTodayStr(),
  recordTime: '', recordEndTime: '', templateId: '', ideaStatus: '待整理', ideaTagsInput: '',
  ideaNextAction: '', ideaTodoId: '', ideaConclusion: '',
});

const builtInTemplates = computed(() => records.services.records.getBuiltInTemplates(draft.type));
const customTemplates = computed(() => lifePlan.data.templates.filter(template => template.type === draft.type));
const activeBuiltInTemplate = computed(() => draft.templateId
  ? records.services.records.getBuiltInTemplate(draft.templateId)
  : null);
const ideaTodoOptions = computed(() => lifePlan.data.todos
  .filter(todo => !todo.done || todo.id === draft.ideaTodoId)
  .slice()
  .sort(records.services.todos.compareTodosForFocus));

function currentTime() {
  return new Date().toTimeString().slice(0, 5);
}

function formatDiaryTitle(dateValue: string) {
  const date = new Date(`${dateValue || getTodayStr()}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${weekdays[date.getDay()]}`;
}

function isDiaryDateTitle(value: string) {
  return /^\d{4}年\d{1,2}月\d{1,2}日 星期[一二三四五六日]$/.test(value.trim());
}

function setTemplateValues(values: Record<string, string> = {}) {
  Object.keys(templateValues).forEach(key => delete templateValues[key]);
  Object.assign(templateValues, values);
}

function resetDraft() {
  hydrating = true;
  window.clearTimeout(autoSaveTimer);
  step.value = 'type';
  draftId.value = '';
  selectedTemplateKey.value = '';
  setTemplateValues();
  Object.assign(draft, {
    title: '', content: '', type: '日记', startDate: getTodayStr(), endDate: getTodayStr(),
    recordTime: '', recordEndTime: '', templateId: '', ideaStatus: '待整理', ideaTagsInput: '',
    ideaNextAction: '', ideaTodoId: '', ideaConclusion: '',
  });
  draftDirty.value = false;
  draftStatus.value = '';
  hydrating = false;
}

function selectType(type: string) {
  const range = records.services.records.getSuggestedRangeForType(type);
  const existing = records.findExistingScopedRecord(type, range.start, range.end);
  if (existing?.id) {
    emit('update:modelValue', false);
    emit('open-existing', String(existing.id));
    return;
  }
  hydrating = true;
  step.value = 'edit';
  draftId.value = '';
  Object.assign(draft, {
    title: type === '日记' ? formatDiaryTitle(range.start) : '',
    content: '', type, startDate: range.start, endDate: range.end, recordTime: currentTime(), recordEndTime: '',
    templateId: '', ideaStatus: '待整理', ideaTagsInput: '', ideaNextAction: '', ideaTodoId: '', ideaConclusion: '',
  });
  const defaultTemplate = records.services.records.getBuiltInTemplates(type).find((template: any) => Array.isArray(template.fields));
  if (defaultTemplate) {
    draft.templateId = String(defaultTemplate.id);
    selectedTemplateKey.value = `builtin:${defaultTemplate.id}`;
    setTemplateValues();
    draft.content = records.services.records.composeTemplateContent(defaultTemplate, templateValues);
  } else {
    selectedTemplateKey.value = '';
    setTemplateValues();
  }
  draftDirty.value = false;
  draftStatus.value = '';
  hydrating = false;
}

function hasMeaningfulInput() {
  const hasStructuredContent = Object.values(templateValues).some(value => String(value || '').trim());
  const plainContent = draft.templateId ? '' : draft.content.trim();
  return Boolean(draft.title.trim() || hasStructuredContent || plainContent);
}

function getDraftInput() {
  const ideaFields = draft.type === '灵感碎片'
    ? {
        ideaStatus: draft.ideaStatus || '待整理',
        ideaTags: records.services.records.getIdeaTags({ ideaTags: draft.ideaTagsInput }),
        ideaNextAction: draft.ideaNextAction.trim(),
        ideaTodoId: draft.ideaTodoId,
        ideaConclusion: draft.ideaConclusion.trim(),
      }
    : { ideaStatus: '', ideaTags: [], ideaNextAction: '', ideaTodoId: '', ideaConclusion: '' };
  return {
    title: draft.title,
    content: draft.content,
    type: draft.type,
    startDate: draft.startDate,
    endDate: draft.endDate,
    recordTime: draft.recordTime,
    recordEndTime: draft.recordEndTime,
    templateId: draft.templateId,
    todoIds: [] as string[],
    ...ideaFields,
  };
}

function persistDraft(mode: 'auto' | 'manual' | 'silent') {
  window.clearTimeout(autoSaveTimer);
  if (!hasMeaningfulInput()) {
    draftDirty.value = false;
    draftStatus.value = '';
    return false;
  }
  if (!draftId.value) {
    const existing = records.findExistingScopedRecord(draft.type, draft.startDate, draft.endDate);
    if (existing?.id) {
      draftDirty.value = false;
      emit('update:modelValue', false);
      emit('open-existing', String(existing.id));
      return false;
    }
  }
  const result = records.saveRecordDraft(draftId.value, getDraftInput());
  if (!result) return false;
  draftId.value = result.id;
  draftDirty.value = false;
  if (mode === 'auto') draftStatus.value = `已自动保存于 ${new Date().toTimeString().slice(0, 8)}`;
  if (mode === 'manual') draftStatus.value = '已保存';
  return true;
}

function scheduleAutoSave() {
  if (hydrating || step.value !== 'edit') return;
  draftDirty.value = true;
  draftStatus.value = '有未保存修改';
  window.clearTimeout(autoSaveTimer);
  autoSaveTimer = window.setTimeout(() => persistDraft('auto'), 3000);
}

function closeModal() {
  window.clearTimeout(autoSaveTimer);
  if (step.value === 'edit' && draftDirty.value) persistDraft('silent');
  emit('update:modelValue', false);
}

function saveManual() {
  persistDraft('manual');
  emit('update:modelValue', false);
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.modelValue) closeModal();
}

function applySelectedTemplate() {
  const key = selectedTemplateKey.value;
  if (!key) {
    draft.templateId = '';
    setTemplateValues();
    return;
  }
  const template = key.startsWith('builtin:')
    ? records.services.records.getBuiltInTemplate(key.slice('builtin:'.length))
    : lifePlan.data.templates.find(item => item.id === key);
  if (!template) return;
  if (template.builtIn && Array.isArray(template.fields)) {
    draft.templateId = String(template.id);
    setTemplateValues(records.services.records.parseTemplateContent(template, draft.content));
    draft.content = records.services.records.composeTemplateContent(template, templateValues);
  } else {
    draft.templateId = '';
    setTemplateValues();
    draft.content = String(template.content || '');
  }
}

function updateStructuredContent() {
  if (!activeBuiltInTemplate.value) return;
  draft.content = records.services.records.composeTemplateContent(activeBuiltInTemplate.value, templateValues);
}

function handleTypeChange() {
  hydrating = true;
  const range = records.services.records.getSuggestedRangeForType(draft.type);
  draft.startDate = range.start;
  draft.endDate = range.end;
  draft.templateId = '';
  selectedTemplateKey.value = '';
  setTemplateValues();
  if (draft.type === '日记' && (!draft.title.trim() || isDiaryDateTitle(draft.title))) draft.title = formatDiaryTitle(range.start);
  hydrating = false;
  scheduleAutoSave();
}

function handleStartDateChange() {
  if (draft.type === '日记' && (!draft.title.trim() || isDiaryDateTitle(draft.title))) draft.title = formatDiaryTitle(draft.startDate);
}

watch(draft, scheduleAutoSave, { deep: true, flush: 'sync' });
watch(() => props.modelValue, open => {
  if (open) resetDraft();
});

onMounted(() => window.addEventListener('keydown', handleKeydown));

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
  window.clearTimeout(autoSaveTimer);
  if (props.modelValue && step.value === 'edit' && draftDirty.value) persistDraft('silent');
});
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue" class="modal-overlay active record-create-overlay" role="presentation" @click.self="closeModal">
      <section class="modal record-create-modal" role="dialog" aria-modal="true" :aria-labelledby="step === 'type' ? 'record-create-type-title' : 'record-create-editor-title'">
        <div class="modal-header">
          <div class="modal-title" :id="step === 'type' ? 'record-create-type-title' : 'record-create-editor-title'">{{ step === 'type' ? '新建记录' : `新建${draft.type}` }}</div>
          <button class="close-btn" type="button" aria-label="关闭新建记录" @click="closeModal">×</button>
        </div>

        <div v-if="step === 'type'" class="record-create-type-groups">
          <section v-for="group in typeGroups" :key="group.label" class="record-create-type-group" :aria-labelledby="`record-type-${group.label}`">
            <h3 :id="`record-type-${group.label}`">{{ group.label }}</h3>
            <div class="record-create-type-options">
              <button v-for="type in group.types" :key="type" class="record-create-type-option" type="button" @click="selectType(type)">{{ type }}</button>
            </div>
          </section>
        </div>

        <form v-else class="record-create-form" @submit.prevent="saveManual">
          <div class="form-row">
            <label class="form-group"><span>记录类型</span><select v-model="draft.type" @change="handleTypeChange"><option v-for="type in allTypes" :key="type" :value="type">{{ type }}</option></select></label>
            <label class="form-group"><span>标题</span><input v-model="draft.title" placeholder="输入记录标题" /></label>
          </div>
          <div class="form-row">
            <label class="form-group"><span>开始日期</span><input v-model="draft.startDate" type="date" @change="handleStartDateChange" /></label>
            <label class="form-group"><span>结束日期</span><input v-model="draft.endDate" type="date" /></label>
            <label class="form-group"><span>开始时间</span><input v-model="draft.recordTime" type="time" /></label>
            <label class="form-group"><span>结束时间</span><input v-model="draft.recordEndTime" type="time" /></label>
          </div>
          <div class="record-create-template-row">
            <label class="form-group"><span>记录模板</span><select v-model="selectedTemplateKey" @change="applySelectedTemplate"><option value="">空白</option><optgroup v-if="builtInTemplates.length" label="内置模板"><option v-for="template in builtInTemplates" :key="template.id" :value="`builtin:${template.id}`">{{ template.name }}</option></optgroup><optgroup v-if="customTemplates.length" label="我的模板"><option v-for="template in customTemplates" :key="String(template.id)" :value="String(template.id)">{{ template.name }}</option></optgroup></select></label>
          </div>
          <section v-if="activeBuiltInTemplate" class="record-template-editor" :aria-label="`${activeBuiltInTemplate.name}新记录字段`">
            <div class="record-template-editor-head"><div><strong>{{ activeBuiltInTemplate.name }}</strong><p>{{ activeBuiltInTemplate.description }}</p></div></div>
            <details v-for="field in activeBuiltInTemplate.fields" :key="field.id" class="record-template-field">
              <summary>{{ field.label }}</summary>
              <textarea v-model="templateValues[field.id]" :aria-label="`新记录${field.label}`" :placeholder="field.placeholder" :rows="field.rows || 3" @input="updateStructuredContent" />
            </details>
          </section>
          <label class="form-group"><span>内容</span><textarea v-model="draft.content" rows="7" :readonly="Boolean(activeBuiltInTemplate)" :class="{ 'is-preview': activeBuiltInTemplate }" /></label>
          <section v-if="draft.type === '灵感碎片'" class="record-idea-fields" aria-label="新记录灵感推进">
            <div class="form-row">
              <label class="form-group"><span>状态</span><select v-model="draft.ideaStatus"><option v-for="item in ['待整理','待实践','实践中','已验证','已放弃']" :key="item" :value="item">{{ item }}</option></select></label>
              <label class="form-group"><span>标签</span><input v-model="draft.ideaTagsInput" placeholder="例如：写作, 产品, 实验" /></label>
            </div>
            <label class="form-group"><span>下一步</span><textarea v-model="draft.ideaNextAction" rows="3" /></label>
            <label class="form-group"><span>关联待办</span><select v-model="draft.ideaTodoId"><option value="">不关联</option><option v-for="todo in ideaTodoOptions" :key="todo.id" :value="todo.id">{{ todo.text }}</option></select></label>
            <label class="form-group"><span>结果结论</span><textarea v-model="draft.ideaConclusion" rows="3" /></label>
          </section>
          <div class="record-create-footer">
            <span class="record-create-status" role="status">{{ draftStatus }}</span>
            <div class="form-actions"><button class="btn btn-secondary" type="button" @click="closeModal">关闭</button><button class="btn btn-primary" type="submit">保存记录</button></div>
          </div>
        </form>
      </section>
    </div>
  </Teleport>
</template>
