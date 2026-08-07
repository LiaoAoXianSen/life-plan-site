<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import AppSelect from './common/AppSelect.vue';
import ModalShell from './common/ModalShell.vue';
import { getTodayStr } from '../services/legacyServices';
import { useLifePlanStore } from '../stores/lifePlanStore';
import { useRecordsStore } from '../stores/recordsStore';
import type { DataEntity } from '../types/lifePlan';

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
const templateEditorRef = ref<HTMLElement | null>(null);
const draftDirty = ref(false);
const draftStatus = ref('');
const draftTodoIds = ref<string[]>([]);
const newTodoText = ref('');
let hydrating = false;
let autoSaveTimer: number | undefined;

const typeGroups = [
  { label: '日常记录', types: ['日记', '日计划', '工作记录', '健康日报', '灵感碎片'] },
  { label: '周期复盘', types: ['周复盘', '月复盘', '年复盘'] },
  { label: '周期规划', types: ['周计划', '月计划', '年度计划', '3年计划'] },
  { label: '长期愿景', types: ['终身愿景'] },
];
const typeIcons: Record<string, string> = {
  日记: '📔',
  日计划: '📅',
  工作记录: '💼',
  健康日报: '🧬',
  灵感碎片: '💡',
  周复盘: '🔁',
  月复盘: '🌙',
  年复盘: '📊',
  周计划: '🗓️',
  月计划: '📌',
  年度计划: '🎯',
  '3年计划': '🧭',
  终身愿景: '🌟',
};
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

const draftTodos = computed(() => lifePlan.data.todos.filter(todo => draftTodoIds.value.includes(todo.id)));

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
  draftTodoIds.value = [];
  newTodoText.value = '';
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
  draftTodoIds.value = [];
  newTodoText.value = '';
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
    todoIds: [...draftTodoIds.value],
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
  const savedRecord = lifePlan.data.records.find(item => item.id === result.id);
  draftTodoIds.value = Array.isArray(savedRecord?.todoIds) ? savedRecord.todoIds.map(String) : [];
  draftDirty.value = false;
  if (mode === 'auto') draftStatus.value = `已自动保存于 ${new Date().toTimeString().slice(0, 8)}`;
  if (mode === 'manual') draftStatus.value = '已保存';
  return true;
}

function ensureDraftRecord() {
  if (draftId.value) return draftId.value;
  if (!hasMeaningfulInput()) draft.title = `${draft.type} ${draft.startDate}`;
  if (!persistDraft('silent')) return '';
  return draftId.value;
}

function applyTemplateTodos(templateTodos: DataEntity[]) {
  const recordId = ensureDraftRecord();
  if (!recordId) return;
  draftTodoIds.value = records.replaceRecordTodosFromTemplate(recordId, templateTodos);
}

function createExclusiveTodo() {
  const text = newTodoText.value.trim();
  if (!text) return;
  const recordId = ensureDraftRecord();
  if (!recordId) return;
  const todo = records.createExclusiveTodo(recordId, text);
  if (todo && !draftTodoIds.value.includes(todo.id)) draftTodoIds.value.push(todo.id);
  newTodoText.value = '';
  draftStatus.value = '已创建专属待办';
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

function flushDraftBeforeRouteLeave() {
  window.clearTimeout(autoSaveTimer);
  if (props.modelValue && step.value === 'edit' && draftDirty.value) persistDraft('silent');
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
  const templateTodos = Array.isArray(template.todos) ? template.todos as DataEntity[] : [];
  if (templateTodos.length && draftTodoIds.value.length && !window.confirm('应用模板会替换当前记录的待办关联，继续吗？')) return;
  if (template.builtIn && Array.isArray(template.fields)) {
    draft.templateId = String(template.id);
    setTemplateValues(records.services.records.parseTemplateContent(template, draft.content));
    if (templateTodos.length) applyTemplateTodos(templateTodos);
    draft.content = records.services.records.composeTemplateContent(template, templateValues);
  } else {
    draft.templateId = '';
    setTemplateValues();
    draft.content = String(template.content || '');
    if (templateTodos.length) applyTemplateTodos(templateTodos);
  }
}

function toggleTemplateFields(open: boolean) {
  templateEditorRef.value?.querySelectorAll('details').forEach(item => { item.open = open; });
}

function clearStructuredFields() {
  if (!activeBuiltInTemplate.value || !window.confirm('清空当前模板里已填写的内容吗？')) return;
  setTemplateValues();
  updateStructuredContent();
}

function saveAsTemplate() {
  const name = window.prompt('请输入模板名称：');
  if (!name?.trim()) return;
  const template = records.addTemplate({
    name,
    type: draft.type || '记录',
    todos: draftTodos.value,
    content: draft.content,
  });
  if (!template) return;
  selectedTemplateKey.value = String(template.id);
  draftStatus.value = '模板已保存';
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

const pendingType = ref('');

watch(draft, scheduleAutoSave, { deep: true, flush: 'sync' });
watch(() => props.modelValue, open => {
  if (open) {
    resetDraft();
    if (pendingType.value) {
      const type = pendingType.value;
      pendingType.value = '';
      selectType(type);
    }
  }
});

function openWithType(type: string) {
  pendingType.value = type;
  emit('update:modelValue', true);
}

defineExpose({ openWithType, selectType });

onBeforeRouteLeave(flushDraftBeforeRouteLeave);

onBeforeUnmount(() => {
  window.clearTimeout(autoSaveTimer);
  if (props.modelValue && step.value === 'edit' && draftDirty.value) persistDraft('silent');
});
</script>

<template>
  <ModalShell
    :model-value="modelValue"
    :title="step === 'type' ? '新建记录' : `新建${draft.type}`"
    :size="step === 'type' ? 'sm' : 'lg'"
    dialog-class="record-create-modal"
    overlay-class="record-create-overlay"
    close-label="关闭新建记录"
    @update:model-value="value => { if (!value) closeModal(); }"
  >

        <section v-if="step === 'type'" class="record-create-type-groups">
          <section v-for="group in typeGroups" :key="group.label" class="record-create-type-group type-section" :aria-labelledby="`record-type-${group.label}`">
            <h3 :id="`record-type-${group.label}`">{{ group.label }}</h3>
            <div class="type-cards">
              <button
                v-for="type in group.types"
                :key="type"
                class="type-card record-create-type-option"
                type="button"
                :aria-label="type"
                @click="selectType(type)"
              >
                <span class="icon" aria-hidden="true">{{ typeIcons[type] || '📝' }}</span>
                <span class="name">{{ type }}</span>
              </button>
            </div>
          </section>
        </section>

        <form v-else class="record-create-form" @submit.prevent="saveManual">
          <div class="record-create-template-toolbar template-select">
            <label class="form-group"><span>选择模板</span><select v-model="selectedTemplateKey" aria-label="记录模板" @change="applySelectedTemplate"><option value="">空白</option><optgroup v-if="builtInTemplates.length" label="内置模板"><option v-for="template in builtInTemplates" :key="template.id" :value="`builtin:${template.id}`">{{ template.name }}</option></optgroup><optgroup v-if="customTemplates.length" label="我的模板"><option v-for="template in customTemplates" :key="String(template.id)" :value="String(template.id)">{{ template.name }}</option></optgroup></select></label>
            <div class="record-template-actions">
              <button class="btn btn-secondary" type="button" :disabled="!selectedTemplateKey" @click="applySelectedTemplate">应用模板</button>
              <button class="btn btn-secondary" type="button" @click="saveAsTemplate">保存为模板</button>
            </div>
          </div>
          <section v-if="activeBuiltInTemplate" ref="templateEditorRef" class="record-template-editor template-editor active" :aria-label="`${activeBuiltInTemplate.name}新记录字段`">
            <div class="record-template-editor-head">
              <div><strong class="template-editor-title">{{ activeBuiltInTemplate.name }}</strong><p class="template-editor-meta">{{ activeBuiltInTemplate.description }}</p></div>
              <div class="record-template-actions template-editor-actions"><button class="link-button" type="button" @click="toggleTemplateFields(true)">全部展开</button><button class="link-button" type="button" @click="toggleTemplateFields(false)">全部收起</button><button class="link-button danger-text" type="button" @click="clearStructuredFields">清空</button></div>
            </div>
            <details v-for="field in activeBuiltInTemplate.fields" :key="field.id" class="record-template-field template-field">
              <summary>{{ field.label }}</summary>
              <textarea v-model="templateValues[field.id]" :aria-label="`新记录${field.label}`" :placeholder="field.placeholder" :rows="field.rows || 3" @input="updateStructuredContent" />
            </details>
          </section>
          <div class="form-row">
            <label class="form-group"><span>记录类型</span><AppSelect v-model="draft.type" :options="allTypes.map(type => ({ value: type, label: type }))" @change="handleTypeChange" /></label>
            <label class="form-group"><span>标题</span><input v-model="draft.title" placeholder="输入记录标题" /></label>
          </div>
          <div class="form-row">
            <label class="form-group"><span>开始日期</span><input v-model="draft.startDate" type="date" @change="handleStartDateChange" /></label>
            <label class="form-group"><span>结束日期</span><input v-model="draft.endDate" type="date" /></label>
          </div>
          <div class="form-row">
            <label class="form-group"><span>开始时间</span><input v-model="draft.recordTime" type="time" /></label>
            <label class="form-group"><span>结束时间</span><input v-model="draft.recordEndTime" type="time" /></label>
          </div>
          <label class="form-group"><span>正文内容</span><textarea v-model="draft.content" rows="7" placeholder="记录详细内容..." aria-label="正文内容" :readonly="Boolean(activeBuiltInTemplate)" :class="{ 'is-preview': activeBuiltInTemplate }" /></label>
          <section v-if="draft.type === '灵感碎片'" class="record-idea-fields" aria-label="新记录灵感推进">
            <div class="form-row">
              <label class="form-group"><span>灵感状态</span><AppSelect v-model="draft.ideaStatus" :options="['待整理', '待实践', '实践中', '已验证', '已放弃'].map(item => ({ value: item, label: item }))" /></label>
              <label class="form-group"><span>灵感标签</span><input v-model="draft.ideaTagsInput" placeholder="用逗号分隔，例如 AI, 工作" /></label>
            </div>
            <div class="form-row">
              <label class="form-group"><span>下一步动作</span><input v-model="draft.ideaNextAction" placeholder="这条灵感下一步怎么实践" /></label>
              <label class="form-group"><span>关联待办</span><AppSelect v-model="draft.ideaTodoId" :options="[{ value: '', label: '不关联' }, ...ideaTodoOptions.map(todo => ({ value: todo.id, label: String(todo.text) }))]" /></label>
            </div>
            <label class="form-group"><span>结果结论</span><textarea v-model="draft.ideaConclusion" rows="3" placeholder="实践之后补一句：有用、一般、放弃原因..." /></label>
          </section>
          <section class="record-create-todos" aria-label="新记录待办">
            <div class="record-preview-heading">关联待办</div>
            <div v-if="draftTodos.length" class="linked-todo-list"><div v-for="todo in draftTodos" :key="todo.id" class="record-preview-todo-item"><span>{{ todo.text }}</span><em>{{ todo.isExclusive ? '专属' : '模板' }}</em></div></div>
            <p v-else class="record-preview-empty">还没有关联待办。</p>
            <div class="record-link-tools"><input v-model="newTodoText" aria-label="新建专属待办" placeholder="例如：补充这条记录的下一步" /><button class="btn btn-secondary" type="button" @click="createExclusiveTodo">添加专属待办</button></div>
          </section>
          <div class="record-create-footer">
            <span class="record-create-status" role="status">{{ draftStatus }}</span>
            <div class="form-actions"><button class="btn btn-secondary" type="button" @click="closeModal">关闭</button><button class="btn btn-primary" type="submit">保存记录</button></div>
          </div>
        </form>
  </ModalShell>
</template>
