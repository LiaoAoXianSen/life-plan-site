<script setup lang="ts">
import StatusBanner from '../components/common/StatusBanner.vue';
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router';
import CalendarViews from '../components/CalendarViews.vue';
import AppSelect from '../components/common/AppSelect.vue';
import ModalShell from '../components/common/ModalShell.vue';
import PageHeader from '../components/common/PageHeader.vue';
import SegmentedTabs from '../components/common/SegmentedTabs.vue';
import FilterBar from '../components/common/FilterBar.vue';
import SearchInput from '../components/common/SearchInput.vue';
import RecordCreateModal from '../components/RecordCreateModal.vue';
import { buildScheduleItems, addDays, getMonthStart, getWeekStart, sortScheduleItems, type ScheduleItem } from '../utils/schedule';
import { getTodayStr } from '../services/legacyServices';
import { useLifePlanStore } from '../stores/lifePlanStore';
import { useRecordsStore } from '../stores/recordsStore';
import { useTodosStore } from '../stores/todosStore';
import type { DataEntity, Todo } from '../types/lifePlan';

type RecordEntity = DataEntity & {
  id: string;
  title?: string;
  content?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
  recordTime?: string;
  recordEndTime?: string;
  templateId?: string;
  todoIds?: string[];
  ideaStatus?: string;
  ideaTags?: string[];
  ideaNextAction?: string;
  ideaTodoId?: string;
  ideaConclusion?: string;
};

type DiaryAiSectionKey = 'oneLine' | 'review' | 'tomorrow' | 'improve' | 'thinking' | 'smallJoy';
type DiaryAiResult = {
  title: string;
  summary: string;
  diary: Partial<Record<DiaryAiSectionKey, string>>;
  items: Array<Record<string, any>>;
};
type DiaryAiSectionDraft = { key: DiaryAiSectionKey; label: string; value: string; selected: boolean };
type DiaryAiTodoDraft = {
  text: string;
  note: string;
  group: string;
  urgency: Todo['urgency'];
  planStartDate: string;
  planEndDate: string;
  dueDate: string;
  sourceMatchKey: string;
  selected: boolean;
  existingTodoText: string;
};

const lifePlan = useLifePlanStore();
const records = useRecordsStore();
const todos = useTodosStore();
const route = useRoute();
const router = useRouter();
const today = () => getTodayStr();
const editForm = reactive({
  id: '',
  title: '',
  content: '',
  type: '记录',
  startDate: today(),
  endDate: today(),
  recordTime: '',
  recordEndTime: '',
  templateId: '',
  todoIds: [] as string[],
  ideaStatus: '待整理',
  ideaTagsInput: '',
  ideaNextAction: '',
  ideaTodoId: '',
  ideaConclusion: '',
  linkedTodoId: '',
  newTodoText: '',
});
const view = ref<'list' | 'day' | 'week' | 'month'>('list');
const cursor = ref(today());
const keyword = ref('');
const typeFilter = ref('all');
const dayOrder = ref<'asc' | 'desc'>('desc');
const ideaStatusFilter = ref('all');
const ideaTagFilter = ref('');
const listRange = ref<'7' | '30' | '90' | 'all'>('30');
const activeRecordId = ref('');
const editorNotice = ref('');
const selectedTemplateKey = ref('');
const templateValues = reactive<Record<string, string>>({});
const showTemplateManager = ref(false);
const showRecordCreate = ref(false);
const templateEditorRef = ref<HTMLElement | null>(null);
const editorDirty = ref(false);
let editorHydrating = false;
let recordAutoSaveTimer: number | undefined;
const diaryAiPreference = ref('');
const diaryAiRunning = ref(false);
const diaryAiStatus = ref('');
const diaryAiError = ref(false);
const diaryAiResult = ref<DiaryAiResult | null>(null);
const diaryAiSections = ref<DiaryAiSectionDraft[]>([]);
const diaryAiTodos = ref<DiaryAiTodoDraft[]>([]);
let diaryAiRequestToken = 0;
const previewDraft = ref<RecordEntity | null>(null);
const previewFromEditor = ref(false);

const typeOptions = ['日记', '日计划', '工作记录', '健康日报', '灵感碎片', '周复盘', '月复盘', '年复盘', '周计划', '月计划', '年度计划', '3年计划', '终身愿景'];
const activeRecord = computed(() => lifePlan.data.records.find(record => record.id === activeRecordId.value) as RecordEntity | undefined);
const openTodos = computed(() => lifePlan.data.todos
  .filter(todo => !todo.done || editForm.todoIds.includes(todo.id))
  .slice()
  .sort(records.services.todos.compareTodosForFocus));
const linkedTodos = computed(() => lifePlan.data.todos.filter(todo => editForm.todoIds.includes(todo.id)));
const ideaTodoOptions = computed(() => lifePlan.data.todos
  .filter(todo => !todo.done || todo.id === editForm.ideaTodoId)
  .slice()
  .sort(records.services.todos.compareTodosForFocus));
const ideaLinkedTodo = computed(() => editForm.ideaTodoId
  ? lifePlan.data.todos.find(todo => todo.id === editForm.ideaTodoId)
  : undefined);
const builtInTemplates = computed(() => records.services.records.getBuiltInTemplates(editForm.type));
const customTemplates = computed(() => lifePlan.data.templates.filter(template => template.type === editForm.type));
const activeBuiltInTemplate = computed(() => editForm.templateId
  ? records.services.records.getBuiltInTemplate(editForm.templateId)
  : null);
const previewSections = computed(() => records.services.records.parseRecordContentSections(editForm.content || ''));
const previewDraftSections = computed(() => records.services.records.parseRecordContentSections(previewDraft.value?.content || ''));
const previewLinkedTodos = computed(() => previewDraft.value
  ? lifePlan.data.todos.filter(todo => recordTodoIds(previewDraft.value!).includes(todo.id))
  : []);
const previewIdeaTodoText = computed(() => {
  const draft = previewDraft.value;
  if (!draft?.ideaTodoId) return '未关联';
  return previewLinkedTodos.value.find(todo => todo.id === draft.ideaTodoId)?.text || '未关联';
});
const hasIdeaOnlyFilter = computed(() => ideaStatusFilter.value !== 'all' || Boolean(ideaTagFilter.value.trim()));

function matchesIdeaFilters(record: DataEntity) {
  if (!hasIdeaOnlyFilter.value) return true;
  if (record.type !== '灵感碎片') return false;
  if (ideaStatusFilter.value === 'unprocessed' && !records.services.records.isIdeaUnprocessed(record)) return false;
  if (ideaStatusFilter.value === 'needsConclusion' && !records.services.records.ideaNeedsConclusion(record)) return false;
  if (!['all', 'unprocessed', 'needsConclusion'].includes(ideaStatusFilter.value)
    && records.services.records.getIdeaStatus(record) !== ideaStatusFilter.value) return false;
  const tagQuery = ideaTagFilter.value.trim().toLowerCase();
  return !tagQuery || records.services.records.getIdeaTags(record).some((tag: string) => tag.toLowerCase().includes(tagQuery));
}

function buildRecordViewItems(startDate: string, endDate: string, includeTodoMilestones = false, includeHistoricalHabitCheckins = false) {
  return buildScheduleItems(lifePlan.data, startDate, endDate, {
    keyword: keyword.value,
    typeFilter: typeFilter.value,
    includeTodos: !hasIdeaOnlyFilter.value,
    includeHabits: !hasIdeaOnlyFilter.value,
    includeTodoPlans: includeTodoMilestones,
    includeTodoDue: includeTodoMilestones,
    includeTodoSessions: true,
    recordFilter: matchesIdeaFilters,
    ...(includeHistoricalHabitCheckins ? { isHabitDueOnDate: () => true } : {}),
  });
}

const listItems = computed(() => {
  const start = listRange.value === 'all' ? '' : addDays(today(), -Number(listRange.value) + 1);
  const end = listRange.value === 'all' ? '' : today();
  return buildRecordViewItems(start, end, false, true);
});
const listGroups = computed(() => {
  const groups = listItems.value.reduce<Record<string, ScheduleItem[]>>((result, item) => {
    (result[item.date] ??= []).push(item);
    return result;
  }, {});
  return Object.keys(groups).sort((a, b) => b.localeCompare(a)).map(date => ({ date, items: sortScheduleItems(groups[date], dayOrder.value) }));
});
const hasRecordResultFilter = computed(() => Boolean(keyword.value.trim())
  || typeFilter.value !== 'all'
  || hasIdeaOnlyFilter.value);
const recordEmptyState = computed(() => hasRecordResultFilter.value
  ? '没有匹配的记录，换个关键词试试'
  : '暂无记录');
const calendarRange = computed(() => view.value === 'day' ? [cursor.value, cursor.value] : view.value === 'week' ? (() => { const start = getWeekStart(cursor.value); return [start, addDays(start, 6)] as const; })() : [getWeekStart(getMonthStart(cursor.value)), addDays(getMonthStart(cursor.value), 41)] as const);
const calendarItems = computed(() => buildRecordViewItems(calendarRange.value[0], calendarRange.value[1], true));
const viewTitle = computed(() => {
  if (view.value === 'list') {
    return listRange.value === 'all' ? '全部历史' : '全部记录';
  }
  if (view.value === 'day') return formatDisplayDate(cursor.value);
  if (view.value === 'week') return `${formatDisplayDate(calendarRange.value[0])} ~ ${formatDisplayDate(calendarRange.value[1])}`;
  return formatDisplayMonth(cursor.value);
});

function formatDisplayDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatDisplayMonth(value: string) {
  const date = new Date(`${value.slice(0, 7)}-01T12:00:00`);
  if (Number.isNaN(date.getTime())) return value.slice(0, 7);
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

function shift(amount: number) {
  if (view.value === 'list') {
    if (listRange.value === 'all') return;
    const options: Array<'7' | '30' | '90' | 'all'> = ['7', '30', '90', 'all'];
    const index = options.indexOf(listRange.value);
    const next = options[Math.max(0, Math.min(options.length - 1, index + amount))];
    if (next) listRange.value = next;
    return;
  }
  cursor.value = view.value === 'month'
    ? (() => { const date = new Date(`${cursor.value.slice(0, 7)}-01T12:00:00`); date.setMonth(date.getMonth() + amount); return date.toISOString().slice(0, 10); })()
    : addDays(cursor.value, view.value === 'week' ? amount * 7 : amount);
}

function selectCalendarItem(item: ScheduleItem) {
  if (item.sourceType === 'record') {
    const record = lifePlan.data.records.find(candidate => candidate.id === item.id);
    if (record) openRecordPreview(record);
    return;
  }
  if (item.sourceType.startsWith('todo-')) {
    void router.push({ path: '/todos', query: { todo: item.id } });
    return;
  }
  if (item.sourceType === 'habit') void router.push({ path: '/habits', query: { habit: item.id } });
}

function recordForItem(item: ScheduleItem) {
  return item.sourceType === 'record'
    ? lifePlan.data.records.find(record => String(record.id || '') === item.id) as RecordEntity | undefined
    : undefined;
}

function recordTodoIds(record: DataEntity): string[] {
  return Array.isArray(record.todoIds) ? record.todoIds.map(String).filter(Boolean) : [];
}

function setTemplateValues(values: Record<string, string> = {}) {
  Object.keys(templateValues).forEach(key => delete templateValues[key]);
  Object.assign(templateValues, values);
}

function updateStructuredContent() {
  if (!activeBuiltInTemplate.value) return;
  editForm.content = records.services.records.composeTemplateContent(activeBuiltInTemplate.value, templateValues);
}

function applySelectedTemplate() {
  const key = selectedTemplateKey.value;
  if (!key) {
    editForm.templateId = '';
    setTemplateValues();
    editorNotice.value = '已切换为空白编辑';
    return;
  }
  const template = key.startsWith('builtin:')
    ? records.services.records.getBuiltInTemplate(key.slice('builtin:'.length))
    : lifePlan.data.templates.find(item => item.id === key);
  if (!template) return;
  const templateTodos = Array.isArray(template.todos) ? template.todos as DataEntity[] : [];
  if (templateTodos.length && linkedTodos.value.length && !window.confirm('应用模板会替换当前记录的待办关联，继续吗？')) return;

  if (template.builtIn && Array.isArray(template.fields)) {
    editForm.templateId = String(template.id);
    setTemplateValues();
    editForm.content = records.services.records.composeTemplateContent(template, templateValues);
  } else {
    editForm.templateId = '';
    setTemplateValues();
    editForm.content = String(template.content || '');
  }

  if (templateTodos.length) {
    editForm.todoIds = records.replaceRecordTodosFromTemplate(editForm.id, templateTodos);
  }
  editorNotice.value = `已应用模板：${String(template.name || '')}`;
}

function clearStructuredFields() {
  if (!activeBuiltInTemplate.value || !window.confirm('清空当前模板里已填写的内容吗？')) return;
  setTemplateValues();
  updateStructuredContent();
}

function toggleTemplateFields(open: boolean) {
  templateEditorRef.value?.querySelectorAll('details').forEach(item => { item.open = open; });
}

function saveAsTemplate() {
  const name = window.prompt('请输入模板名称：');
  if (!name?.trim()) return;
  const template = records.addTemplate({
    name,
    type: editForm.type || '记录',
    content: editForm.content,
    todos: linkedTodos.value,
  });
  if (!template) return;
  selectedTemplateKey.value = String(template.id);
  showTemplateManager.value = true;
  editorNotice.value = '模板已保存';
}

function deleteTemplate(id: string) {
  if (!window.confirm('确定删除这个模板吗？')) return;
  records.deleteTemplate(id);
  if (selectedTemplateKey.value === id) selectedTemplateKey.value = '';
  editorNotice.value = '模板已删除';
}

function updateRecordQuery(recordId = '') {
  const query = { ...route.query };
  if (recordId) query.record = recordId;
  else delete query.record;
  void router.replace({ path: route.path, query });
}

function resetDiaryAiState() {
  diaryAiRequestToken += 1;
  diaryAiRunning.value = false;
  diaryAiStatus.value = '';
  diaryAiError.value = false;
  diaryAiResult.value = null;
  diaryAiSections.value = [];
  diaryAiTodos.value = [];
}

function openEditor(record: DataEntity, updateRoute = true) {
  const item = record as RecordEntity;
  if (activeRecordId.value === item.id) {
    if (updateRoute && route.query.record !== item.id) updateRecordQuery(item.id);
    return;
  }
  if (activeRecordId.value && activeRecordId.value !== item.id) flushPendingEditorSave();
  resetDiaryAiState();
  editorHydrating = true;
  window.clearTimeout(recordAutoSaveTimer);
  activeRecordId.value = item.id;
  Object.assign(editForm, {
    id: item.id,
    title: item.title || '',
    content: item.content || '',
    type: item.type || '记录',
    startDate: item.startDate || today(),
    endDate: item.endDate || item.startDate || today(),
    recordTime: item.recordTime || '',
    recordEndTime: item.recordEndTime || '',
    templateId: item.templateId || '',
    todoIds: recordTodoIds(item),
    ideaStatus: records.services.records.getIdeaStatus(item),
    ideaTagsInput: records.services.records.getIdeaTags(item).join(', '),
    ideaNextAction: item.ideaNextAction || '',
    ideaTodoId: item.ideaTodoId && lifePlan.data.todos.some(todo => todo.id === item.ideaTodoId) ? item.ideaTodoId : '',
    ideaConclusion: item.ideaConclusion || '',
    linkedTodoId: '',
    newTodoText: '',
  });
  const template = item.templateId ? records.services.records.getBuiltInTemplate(item.templateId) : null;
  selectedTemplateKey.value = template ? `builtin:${template.id}` : '';
  setTemplateValues(template ? records.services.records.parseTemplateContent(template, item.content || '') : {});
  showTemplateManager.value = false;
  editorHydrating = false;
  editorDirty.value = false;
  editorNotice.value = '';
  if (updateRoute && route.query.record !== item.id) updateRecordQuery(item.id);
}

function clonePreviewRecord(record: RecordEntity): RecordEntity {
  return {
    ...record,
    todoIds: recordTodoIds(record),
    ideaTags: records.services.records.getIdeaTags(record),
  };
}

function buildPreviewRecordFromEditor(): RecordEntity {
  const current = activeRecord.value || {};
  return clonePreviewRecord({
    ...current,
    id: editForm.id,
    title: editForm.title,
    content: editForm.content,
    type: editForm.type,
    startDate: editForm.startDate,
    endDate: editForm.endDate,
    recordTime: editForm.recordTime,
    recordEndTime: editForm.recordEndTime,
    templateId: editForm.templateId,
    todoIds: [...editForm.todoIds],
    ideaStatus: editForm.ideaStatus,
    ideaTags: records.services.records.getIdeaTags({ ideaTags: editForm.ideaTagsInput }),
    ideaNextAction: editForm.ideaNextAction,
    ideaTodoId: editForm.ideaTodoId,
    ideaConclusion: editForm.ideaConclusion,
  });
}

function formatStoredDateTime(value: unknown) {
  const raw = String(value || '');
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return raw.replace('T', ' ');
  return `${match[1]}年${Number(match[2])}月${Number(match[3])}日 ${match[4]}:${match[5]}:${match[6] || '00'}`;
}

function openRecordPreview(record: DataEntity, fromEditor = false) {
  const item = record as RecordEntity;
  if (!item.id) return;
  if (!fromEditor && activeRecordId.value && activeRecordId.value !== item.id) {
    flushPendingEditorSave();
    closeEditor(false);
  }
  if (fromEditor) window.clearTimeout(recordAutoSaveTimer);
  previewDraft.value = fromEditor ? buildPreviewRecordFromEditor() : clonePreviewRecord(item);
  previewFromEditor.value = fromEditor;
}

function previewCurrentRecord() {
  if (!activeRecord.value) return;
  openRecordPreview(activeRecord.value, true);
}

function closeRecordPreview() {
  const returnToEditor = previewFromEditor.value;
  previewDraft.value = null;
  previewFromEditor.value = false;
  if (route.query.preview || route.query.record) {
    const query = { ...route.query };
    delete query.preview;
    if (!returnToEditor) delete query.record;
    void router.replace({ path: route.path, query });
  }
}

function openDiaryAiFromPreview() {
  const diaryId = previewDraft.value?.id;
  if (!diaryId) return;
  closeRecordPreview();
  void router.push({ path: '/ai', query: { mode: 'diaryReview', diary: diaryId } });
}

function editPreviewRecord() {
  const record = previewDraft.value;
  const returnToEditor = previewFromEditor.value;
  if (!record) return;
  previewDraft.value = null;
  previewFromEditor.value = false;
  const query = { ...route.query };
  delete query.preview;
  if (!returnToEditor) query.record = record.id;
  void router.replace({ path: route.path, query }).then(() => {
    if (!returnToEditor && activeRecordId.value !== record.id) openEditor(record, false);
  });
}

function openExistingFromCreate(recordId: string) {
  const record = lifePlan.data.records.find(item => item.id === recordId);
  if (!record) return;
  openEditor(record);
  editorNotice.value = '这个周期已经有一条了，已为你打开继续编辑';
}

function closeEditor(flush = true) {
  if (flush) flushPendingEditorSave();
  window.clearTimeout(recordAutoSaveTimer);
  editorDirty.value = false;
  activeRecordId.value = '';
  showTemplateManager.value = false;
  editorNotice.value = '';
  resetDiaryAiState();
  if (route.query.record) updateRecordQuery();
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;
  if (previewDraft.value) {
    closeRecordPreview();
    return;
  }
  if (activeRecordId.value) {
    closeEditor();
    return;
  }
  if (showTemplateManager.value) showTemplateManager.value = false;
}

function getEditorUpdateInput() {
  const ideaFields = editForm.type === '灵感碎片'
    ? {
        ideaStatus: editForm.ideaStatus || '待整理',
        ideaTags: records.services.records.getIdeaTags({ ideaTags: editForm.ideaTagsInput }),
        ideaNextAction: editForm.ideaNextAction.trim(),
        ideaTodoId: editForm.ideaTodoId,
        ideaConclusion: editForm.ideaConclusion.trim(),
      }
    : { ideaStatus: '', ideaTags: [], ideaNextAction: '', ideaTodoId: '', ideaConclusion: '' };
  return {
    title: editForm.title.trim(),
    content: editForm.content,
    type: editForm.type || '记录',
    startDate: editForm.startDate,
    endDate: editForm.endDate || editForm.startDate,
    recordTime: editForm.recordTime,
    recordEndTime: editForm.recordEndTime,
    templateId: editForm.templateId,
    todoIds: editForm.todoIds,
    ...ideaFields,
  };
}

function persistEditor(mode: 'manual' | 'auto' | 'silent' = 'manual') {
  if (!editForm.id) return false;
  window.clearTimeout(recordAutoSaveTimer);
  records.updateRecord(editForm.id, getEditorUpdateInput());
  editorDirty.value = false;
  if (mode === 'manual') editorNotice.value = '记录已保存';
  if (mode === 'auto') editorNotice.value = `已自动保存于 ${new Date().toTimeString().slice(0, 8)}`;
  return true;
}

function saveEditor() {
  if (!editForm.id || !editForm.title.trim()) return;
  persistEditor('manual');
}

function scheduleEditorAutoSave() {
  if (editorHydrating || !activeRecordId.value) return;
  editorDirty.value = true;
  editorNotice.value = '有未保存修改';
  window.clearTimeout(recordAutoSaveTimer);
  recordAutoSaveTimer = window.setTimeout(() => persistEditor('auto'), 3000);
}

function flushPendingEditorSave() {
  if (!editorDirty.value) return false;
  return persistEditor('silent');
}

function openIdeaTodo() {
  if (!editForm.ideaTodoId) return;
  void router.push({ path: '/todos', query: { todo: editForm.ideaTodoId } });
}

function linkExistingTodo() {
  if (!editForm.id || !editForm.linkedTodoId) return;
  records.linkExistingTodo(editForm.id, editForm.linkedTodoId);
  if (!editForm.todoIds.includes(editForm.linkedTodoId)) editForm.todoIds.push(editForm.linkedTodoId);
  editForm.linkedTodoId = '';
  editorNotice.value = '已关联待办';
}

function createExclusiveTodo() {
  if (!editForm.id || !editForm.newTodoText.trim()) return;
  const todo = records.createExclusiveTodo(editForm.id, editForm.newTodoText);
  if (todo && !editForm.todoIds.includes(todo.id)) editForm.todoIds.push(todo.id);
  editForm.newTodoText = '';
  editorNotice.value = '已创建专属待办';
}

function unlinkTodo(todo: Todo) {
  if (!editForm.id) return;
  records.removeLinkedTodo(editForm.id, todo.id);
  editForm.todoIds = editForm.todoIds.filter(id => id !== todo.id);
  editorNotice.value = todo.isExclusive ? '已删除专属待办' : '已取消关联';
}

function toggleLinkedTodo(todo: Todo) {
  todos.toggle(todo.id);
}

function removeRecord(id: string) {
  if (!window.confirm('确定删除这条记录吗？关联的专属待办也会一起删除')) return;
  records.remove('records', id);
  if (activeRecordId.value === id) closeEditor(false);
}

function getDiaryAiConfig() {
  try {
    return records.services.ai.normalizeConfig(JSON.parse(localStorage.getItem('lifePlanAiConfig') || '{}'));
  } catch {
    return records.services.ai.normalizeConfig({});
  }
}

function buildDiaryAiPayload(record: RecordEntity) {
  const template = records.services.records.getBuiltInTemplate('builtin-diary-daily-review');
  return {
    mode: 'diaryReview',
    title: 'AI 日记分析',
    today: today(),
    userInput: diaryAiPreference.value.trim(),
    context: {
      selectedDiary: {
        id: record.id,
        type: record.type || '',
        title: record.title || '',
        startDate: record.startDate || '',
        endDate: record.endDate || '',
        recordTime: record.recordTime || '',
        content: record.content || '',
        templateId: record.templateId || '',
        fields: template ? records.services.records.parseTemplateContent(template, record.content || '') : {},
      },
    },
    instruction: [
      '分析 selectedDiary，不要自动替用户下结论太满。',
      '返回 diary.review：适合写入日记“复盘”的 2-5 句中文。',
      '返回 diary.tomorrow：适合写入“明日重点”的 1-3 条短句。',
      '可选 diary.oneLine/improve/thinking/smallJoy；items 返回 0-4 个需要用户确认创建的待办。',
      '多个独立打算必须拆成多条 items；相对时间换算成 YYYY-MM-DD。',
      '所有结果都是可编辑草稿，不要假定已经写入。',
    ].join('\n'),
  };
}

function refineDiaryAiResult(result: DiaryAiResult): DiaryAiResult {
  return {
    ...result,
    items: (result.items || []).map(item => {
      const refined = records.services.ai.applyResolvedDatesToItem(item, today(), {
        fallbackDate: '',
        preferResolved: true,
        stripDateFromText: false,
      });
      if (refined.planStartDate && !refined.planEndDate) refined.planEndDate = refined.planStartDate;
      if (!refined.dueDate && refined.planEndDate) refined.dueDate = refined.planEndDate;
      return refined;
    }),
  };
}

function setDiaryAiDrafts(result: DiaryAiResult) {
  const sectionMeta: Array<[DiaryAiSectionKey, string]> = [
    ['review', '复盘'], ['tomorrow', '明日重点'], ['oneLine', '今日一句话'],
    ['improve', '待改进'], ['thinking', '思考'], ['smallJoy', '小确幸'],
  ];
  diaryAiResult.value = result;
  diaryAiSections.value = sectionMeta
    .filter(([key]) => String(result.diary?.[key] || '').trim())
    .map(([key, label]) => ({ key, label, value: String(result.diary[key] || ''), selected: key === 'review' || key === 'tomorrow' }));
  diaryAiTodos.value = (result.items || []).map(item => {
    const match = records.services.todos.findMatchingTodo(lifePlan.data.todos, item, {
      sourceRecordId: editForm.id,
      linkedTodoIds: editForm.todoIds,
    });
    return {
      text: String(item.text || ''),
      note: String(item.note || item.reason || ''),
      group: String(item.group || '其他'),
      urgency: ['urgent', 'high', 'medium', 'low'].includes(String(item.urgency)) ? item.urgency as Todo['urgency'] : 'medium',
      planStartDate: String(item.planStartDate || ''),
      planEndDate: String(item.planEndDate || item.planStartDate || ''),
      dueDate: String(item.dueDate || item.planEndDate || ''),
      sourceMatchKey: String(item.sourceMatchKey || item.text || ''),
      selected: !match,
      existingTodoText: String(match?.todo?.text || ''),
    };
  });
}

async function runDiaryAi() {
  if (diaryAiRunning.value || editForm.type !== '日记' || !editForm.id) return;
  flushPendingEditorSave();
  const target = lifePlan.data.records.find(item => item.id === editForm.id) as RecordEntity | undefined;
  if (!target || !String(target.content || '').trim()) {
    diaryAiError.value = true;
    diaryAiStatus.value = '先写一点日记内容，再生成分析。';
    return;
  }
  const token = ++diaryAiRequestToken;
  const targetId = target.id;
  diaryAiRunning.value = true;
  diaryAiError.value = false;
  diaryAiStatus.value = '正在分析日记…';
  diaryAiResult.value = null;
  diaryAiSections.value = [];
  diaryAiTodos.value = [];
  const payload = buildDiaryAiPayload(target);
  const config = getDiaryAiConfig();
  let usedFallback = false;
  try {
    let result: DiaryAiResult;
    if (records.services.ai.isRemoteReady(config)) {
      try {
        result = await records.services.ai.requestRemoteAi(config, payload) as DiaryAiResult;
      } catch {
        usedFallback = true;
        result = records.services.ai.generateLocalAiResult(payload) as DiaryAiResult;
      }
    } else {
      result = records.services.ai.generateLocalAiResult(payload) as DiaryAiResult;
    }
    if (token !== diaryAiRequestToken || activeRecordId.value !== targetId) return;
    setDiaryAiDrafts(refineDiaryAiResult(result));
    diaryAiStatus.value = usedFallback ? '远程 AI 请求失败，已改用本地规则生成草稿。' : records.services.ai.isRemoteReady(config) ? 'AI 草稿已生成。' : '已用本地规则生成草稿。';
    diaryAiError.value = usedFallback;
  } catch (error) {
    if (token !== diaryAiRequestToken || activeRecordId.value !== targetId) return;
    diaryAiError.value = true;
    diaryAiStatus.value = error instanceof Error ? error.message : String(error);
  } finally {
    if (token === diaryAiRequestToken) diaryAiRunning.value = false;
  }
}

function applySelectedDiaryAiSections() {
  const selected = diaryAiSections.value.filter(section => section.selected && section.value.trim());
  if (!selected.length || !editForm.id) {
    diaryAiError.value = true;
    diaryAiStatus.value = '请至少选择一个有内容的日记字段。';
    return;
  }
  flushPendingEditorSave();
  const template = records.services.records.getBuiltInTemplate('builtin-diary-daily-review');
  const existing = template ? records.services.records.parseTemplateContent(template, editForm.content) : {};
  const overwriteLabels = selected.filter(section => String(existing[section.key] || '').trim()).map(section => section.label);
  if (overwriteLabels.length && !window.confirm(`这些字段已有内容：${overwriteLabels.join('、')}。确定用 AI 草稿覆盖吗？`)) return;
  const result = records.applyDiaryAiSections(editForm.id, Object.fromEntries(selected.map(section => [section.key, section.value])));
  if (!result) return;
  editorHydrating = true;
  window.clearTimeout(recordAutoSaveTimer);
  editForm.templateId = result.templateId;
  editForm.content = result.content;
  selectedTemplateKey.value = `builtin:${result.templateId}`;
  setTemplateValues(result.values);
  editorDirty.value = false;
  editorHydrating = false;
  diaryAiError.value = false;
  diaryAiStatus.value = `已写入：${selected.map(section => section.label).join('、')}`;
  editorNotice.value = '日记 AI 内容已保存';
}

function createSelectedDiaryAiTodos() {
  const selected = diaryAiTodos.value.filter(item => item.selected && item.text.trim());
  if (!selected.length || !editForm.id) {
    diaryAiError.value = true;
    diaryAiStatus.value = '请至少选择一条保留标题的待办。';
    return;
  }
  const duplicateCount = selected.filter(item => item.existingTodoText).length;
  if (duplicateCount && !window.confirm(`选中项里有 ${duplicateCount} 条与已有待办相似，仍要创建吗？`)) return;
  flushPendingEditorSave();
  const createdIds = records.createDiaryAiTodos(editForm.id, selected.map(item => ({ ...item, text: item.text.trim() })));
  editorHydrating = true;
  editForm.todoIds = recordTodoIds(lifePlan.data.records.find(item => item.id === editForm.id) || {});
  editorHydrating = false;
  selected.forEach(item => { item.selected = false; });
  diaryAiError.value = false;
  diaryAiStatus.value = `已创建待办 ${createdIds.length} 项。`;
  editorNotice.value = '日记 AI 待办已创建';
}

watch(editForm, scheduleEditorAutoSave, { deep: true, flush: 'sync' });

watch([() => route.query.record, () => route.query.preview, () => lifePlan.data.records.length], ([value, preview]) => {
  const recordId = Array.isArray(value) ? value[0] : value;
  const previewRequested = (Array.isArray(preview) ? preview[0] : preview) === '1';
  if (!recordId) return;
  const record = lifePlan.data.records.find(item => item.id === recordId);
  if (!record) return;
  if (previewRequested) openRecordPreview(record, false);
  else if (activeRecordId.value !== recordId) openEditor(record, false);
}, { immediate: true });

watch(() => route.query.template, value => {
  const templateId = String(Array.isArray(value) ? value[0] || '' : value || '');
  if (!templateId) return;
  const template = lifePlan.data.templates.find(item => item.id === templateId);
  showTemplateManager.value = true;
  if (template) {
    selectedTemplateKey.value = templateId;
    editorNotice.value = `已定位模板：${String(template.name || '未命名模板')}`;
  }
}, { immediate: true });

watch(() => editForm.type, type => {
  if (type !== '日记') resetDiaryAiState();
  const selected = selectedTemplateKey.value;
  if (!selected) return;
  const template = selected.startsWith('builtin:')
    ? records.services.records.getBuiltInTemplate(selected.slice('builtin:'.length))
    : lifePlan.data.templates.find(item => item.id === selected);
  if (template?.type === type) return;
  selectedTemplateKey.value = '';
  editForm.templateId = '';
  setTemplateValues();
});

onMounted(() => window.addEventListener('keydown', handleKeydown));

onBeforeRouteLeave(() => {
  flushPendingEditorSave();
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
  flushPendingEditorSave();
  window.clearTimeout(recordAutoSaveTimer);
});
</script>

<template>
  <section class="page active" id="page-records">
    <PageHeader title="所有记录">
      <template #actions>
        <button class="btn btn-secondary" type="button" @click="showTemplateManager = true">📋 模板管理</button>
        <button class="btn btn-primary" type="button" @click="showRecordCreate = true">+ 新建记录</button>
      </template>
    </PageHeader>

    <RecordCreateModal v-model="showRecordCreate" @open-existing="openExistingFromCreate" />

    <ModalShell
      v-if="previewDraft"
      :model-value="Boolean(previewDraft)"
      title="记录预览"
      size="lg"
      dialog-class="record-preview-modal"
      @close="closeRecordPreview"
    >
        <div class="record-preview-dialog-body">
          <div class="record-preview-top">
            <span class="item-type">{{ previewDraft.type || '记录' }}</span>
            <div class="record-preview-title">{{ previewDraft.title || '未命名记录' }}</div>
            <div class="record-preview-meta">
              <span>{{ records.services.records.getRecordDateRangeLabel(previewDraft) }}</span>
              <span>时间 {{ previewDraft.recordTime || '全天' }}<template v-if="previewDraft.recordEndTime"> - {{ previewDraft.recordEndTime }}</template></span>
              <span>待办 {{ previewLinkedTodos.filter(todo => todo.done).length }}/{{ previewLinkedTodos.length }}</span>
              <span v-if="previewDraft.updatedAt || previewDraft.createdAt">更新于 {{ formatStoredDateTime(previewDraft.updatedAt || previewDraft.createdAt) }}</span>
              <span v-if="previewFromEditor && editorDirty">当前预览，尚未保存</span>
            </div>
          </div>
          <div class="record-preview-content">
            <div class="record-preview-heading">内容</div>
            <div v-if="previewDraftSections.length">
              <section v-for="section in previewDraftSections" :key="section.title" class="record-preview-section">
                <h4>{{ section.title }}</h4>
                <div class="record-preview-text">{{ section.body.join('\n').trim() || '暂未填写' }}</div>
              </section>
            </div>
            <div v-else class="record-preview-empty">还没有内容</div>
          </div>
          <div v-if="previewDraft.type === '灵感碎片'" class="record-preview-content">
            <div class="record-preview-heading">灵感推进</div>
            <div class="record-idea-badges"><span class="app-badge">{{ previewDraft.ideaStatus || '待整理' }}</span><span v-for="tag in records.services.records.getIdeaTags(previewDraft)" :key="tag" class="app-badge">{{ tag }}</span></div>
            <div class="record-idea-preview-grid">
              <div><strong>下一步</strong><span>{{ previewDraft.ideaNextAction || '未设置' }}</span></div>
              <div><strong>关联待办</strong><span>{{ previewIdeaTodoText }}</span></div>
              <div><strong>结果结论</strong><span>{{ previewDraft.ideaConclusion || '还没有结论' }}</span></div>
            </div>
          </div>
          <div v-if="previewLinkedTodos.length" class="record-preview-todos">
            <div class="record-preview-heading">关联待办</div>
            <div v-for="todo in previewLinkedTodos" :key="todo.id" class="record-preview-todo-item" :class="{ done: todo.done }">
              <span class="record-preview-dot"></span><span>{{ todo.text || '未命名待办' }}</span>
            </div>
          </div>
          <div class="record-preview-actions">
            <button v-if="!previewFromEditor && previewDraft.type === '日记'" class="btn btn-secondary" type="button" @click="openDiaryAiFromPreview">AI 分析日记</button>
            <button v-if="previewFromEditor" class="btn btn-secondary" type="button" @click="closeRecordPreview">返回继续编辑</button>
            <button v-else class="btn btn-secondary" type="button" @click="editPreviewRecord">编辑</button>
          </div>
        </div>
    </ModalShell>

    <ModalShell v-model="showTemplateManager" title="模板管理" size="sm" dialog-class="record-template-modal" close-label="关闭模板管理">
        <div class="record-template-manager" aria-label="自定义模板管理">
          <div v-if="lifePlan.data.templates.length" class="record-template-list">
            <div v-for="template in lifePlan.data.templates" :key="String(template.id)" class="record-template-row">
              <span><strong>{{ template.name }}</strong><small>{{ template.type }}</small></span>
              <button class="link-button danger-text" type="button" :aria-label="`删除模板 ${template.name}`" @click="deleteTemplate(String(template.id))">删除</button>
            </div>
          </div>
          <EmptyState v-else class="empty-state">暂无自定义模板。内置模板会直接出现在对应记录类型的模板下拉里。</EmptyState>
        </div>
    </ModalShell>

    <FilterBar class="record-filter-bar" :class="{ 'record-filter-bar--list': view === 'list' }">
      <SearchInput v-model="keyword" aria-label="搜索记录" placeholder="搜索标题、内容、类型" />
      <AppSelect
        v-model="typeFilter"
        aria-label="记录类型筛选"
        all-label="全部类型"
        :options="[
          ...typeOptions.map(type => ({ value: type, label: type })),
          { value: '待办', label: '待办完成/执行' },
          { value: '习惯', label: '习惯打卡' },
        ]"
      />
      <AppSelect
        v-model="dayOrder"
        aria-label="当日顺序"
        :options="[
          { value: 'desc', label: '当日倒序' },
          { value: 'asc', label: '当日正序' },
        ]"
      />
      <AppSelect
        v-model="ideaStatusFilter"
        aria-label="记录灵感状态筛选"
        :options="[
          { value: 'all', label: '全部灵感状态' },
          ...['待整理', '待实践', '实践中', '已验证', '已放弃'].map(status => ({ value: status, label: status })),
          { value: 'unprocessed', label: '未处理灵感' },
          { value: 'needsConclusion', label: '已实践未写结论' },
        ]"
      />
      <SearchInput v-model="ideaTagFilter" aria-label="记录灵感标签筛选" placeholder="灵感标签筛选" />
      <AppSelect
        v-if="view === 'list'"
        v-model="listRange"
        aria-label="记录日期范围"
        :options="[
          { value: '7', label: '最近7天' },
          { value: '30', label: '最近30天' },
          { value: '90', label: '最近90天' },
          { value: 'all', label: '全部历史' },
        ]"
      />
    </FilterBar>

    <div class="calendar-toolbar">
      <SegmentedTabs
        v-model="view"
        :ariaLabel="'记录视图'"
        :items="[
          { value: 'list', label: '列表' },
          { value: 'day', label: '日视图' },
          { value: 'week', label: '周视图' },
          { value: 'month', label: '月视图' },
        ]"
      />
      <div class="record-view-nav page-actions">
        <button class="btn btn-secondary" type="button" aria-label="上一段时间" @click="shift(-1)">‹</button>
        <strong id="record-view-title">{{ viewTitle }}</strong>
        <button class="btn btn-secondary" type="button" aria-label="下一段时间" @click="shift(1)">›</button>
        <button class="btn btn-secondary" type="button" @click="cursor = today()">今天</button>
      </div>
    </div>

    <ModalShell
      :model-value="Boolean(activeRecord && !previewDraft)"
      title="编辑记录"
      size="lg"
      dialog-class="record-editor-panel"
      overlay-class="record-editor-overlay"
      close-label="关闭编辑记录"
      :show-header="false"
      @update:model-value="value => { if (!value) closeEditor(); }"
    >
        <div class="section-title-row">
          <div>
            <h2 id="record-editor-title">编辑记录</h2>
            <p class="section-hint">保存会写入原有 records 字段；关联待办会同步重建 todoAppData 镜像。</p>
          </div>
          <div class="page-actions"><button class="btn btn-secondary" type="button" @click="previewCurrentRecord">预览</button><button class="btn btn-secondary" type="button" @click="closeEditor()">关闭</button></div>
        </div>
        <StatusBanner v-if="editorNotice" class="notice success" role="status" tone="success">{{ editorNotice }}</StatusBanner>
        <div class="record-editor-grid">
        <form class="record-edit-form" @submit.prevent="saveEditor">
          <div class="form-row">
            <label class="form-group"><span>标题</span><input v-model="editForm.title" required /></label>
            <label class="form-group"><span>类型</span><AppSelect v-model="editForm.type" :options="[...typeOptions.map(type => ({ value: type, label: type })), ...(editForm.type && !typeOptions.includes(editForm.type) ? [{ value: editForm.type, label: `${editForm.type}（旧类型）` }] : [])]" /></label>
            <label class="form-group"><span>开始日期</span><input v-model="editForm.startDate" type="date" /></label>
            <label class="form-group"><span>结束日期</span><input v-model="editForm.endDate" type="date" /></label>
            <label class="form-group"><span>开始时间</span><input v-model="editForm.recordTime" type="time" /></label>
            <label class="form-group"><span>结束时间</span><input v-model="editForm.recordEndTime" type="time" /></label>
          </div>
          <div class="record-template-toolbar">
            <label class="form-group"><span>记录模板</span><select v-model="selectedTemplateKey"><option value="">空白</option><optgroup v-if="builtInTemplates.length" label="内置模板"><option v-for="template in builtInTemplates" :key="template.id" :value="`builtin:${template.id}`">{{ template.name }}</option></optgroup><optgroup v-if="customTemplates.length" label="我的模板"><option v-for="template in customTemplates" :key="String(template.id)" :value="String(template.id)">{{ template.name }}</option></optgroup></select></label>
            <div class="record-template-actions">
              <button class="btn btn-secondary" type="button" :disabled="!selectedTemplateKey" @click="applySelectedTemplate">应用模板</button>
              <button class="btn btn-secondary" type="button" @click="saveAsTemplate">保存为模板</button>
              <button class="btn btn-secondary" type="button" :aria-expanded="showTemplateManager" @click="showTemplateManager = !showTemplateManager">管理模板</button>
            </div>
          </div>
          <section v-if="showTemplateManager" class="record-template-manager" aria-label="自定义模板管理">
            <div v-if="lifePlan.data.templates.length" class="record-template-list">
              <div v-for="template in lifePlan.data.templates" :key="String(template.id)" class="record-template-row">
                <span><strong>{{ template.name }}</strong><small>{{ template.type }}</small></span>
                <button class="link-button danger-text" type="button" :aria-label="`删除模板 ${template.name}`" @click="deleteTemplate(String(template.id))">删除</button>
              </div>
            </div>
            <EmptyState v-else class="empty-state">暂无自定义模板。内置模板会直接出现在对应记录类型的模板下拉里。</EmptyState>
          </section>
          <section v-if="activeBuiltInTemplate" ref="templateEditorRef" class="record-template-editor" :aria-label="`${activeBuiltInTemplate.name}结构化字段`">
            <div class="record-template-editor-head">
              <div><strong>{{ activeBuiltInTemplate.name }}</strong><p>{{ activeBuiltInTemplate.description }}</p></div>
              <div class="record-template-actions"><button class="link-button" type="button" @click="toggleTemplateFields(true)">全部展开</button><button class="link-button" type="button" @click="toggleTemplateFields(false)">全部收起</button><button class="link-button danger-text" type="button" @click="clearStructuredFields">清空</button></div>
            </div>
            <details v-for="field in activeBuiltInTemplate.fields" :key="field.id" class="record-template-field">
              <summary>{{ field.label }}</summary>
              <textarea v-model="templateValues[field.id]" :aria-label="field.label" :placeholder="field.placeholder" :rows="field.rows || 3" @input="updateStructuredContent" />
            </details>
          </section>
          <label class="form-group"><span>内容</span><textarea v-model="editForm.content" rows="8" :readonly="Boolean(activeBuiltInTemplate)" :class="{ 'is-preview': activeBuiltInTemplate }" /></label>
          <section v-if="editForm.type === '日记'" class="record-diary-ai" aria-labelledby="record-diary-ai-title">
            <div class="record-diary-ai-head">
              <div><div class="record-preview-heading" id="record-diary-ai-title">AI 日记分析</div><p>复盘、明日重点与行动草稿</p></div>
              <button class="btn btn-secondary ai-run-button" :class="{ 'is-loading': diaryAiRunning }" type="button" :disabled="diaryAiRunning" @click="runDiaryAi"><span class="ai-run-spinner"></span>{{ diaryAiRunning ? '分析中…' : '生成分析' }}</button>
            </div>
            <label class="form-group"><span>分析偏好</span><textarea v-model="diaryAiPreference" rows="2" placeholder="例如：复盘直白一点，明日重点只保留最关键的一件事" /></label>
            <p v-if="diaryAiStatus" class="record-diary-ai-status" :class="{ error: diaryAiError }" role="status">{{ diaryAiStatus }}</p>
            <div v-if="diaryAiResult" class="record-diary-ai-result">
              <div class="record-diary-ai-summary"><strong>{{ diaryAiResult.title }}</strong><span v-if="diaryAiResult.summary">{{ diaryAiResult.summary }}</span></div>
              <div v-if="diaryAiSections.length" class="diary-ai-section-list">
                <label v-for="section in diaryAiSections" :key="section.key" class="diary-ai-section record-diary-ai-section">
                  <span class="ai-result-select"><input v-model="section.selected" type="checkbox" /><strong>{{ section.label }}</strong></span>
                  <textarea v-model="section.value" class="ai-capture-draft diary-ai-draft" :aria-label="`AI ${section.label}草稿`" rows="4" />
                </label>
                <div class="diary-ai-actions"><button class="btn btn-primary" type="button" @click="applySelectedDiaryAiSections">写入所选内容</button></div>
              </div>
              <div v-if="diaryAiTodos.length" class="record-diary-ai-todos">
                <div class="record-preview-heading">建议待办</div>
                <div class="ai-result-list">
                  <div v-for="(item, index) in diaryAiTodos" :key="index" class="ai-result-item ai-capture-todo-draft" :class="{ 'is-existing': item.existingTodoText }">
                    <label class="ai-result-select"><input v-model="item.selected" type="checkbox" /><strong>创建这条待办</strong></label>
                    <div v-if="item.existingTodoText" class="ai-existing-hint">与已有待办相似：{{ item.existingTodoText }}</div>
                    <label><span>待办标题</span><input v-model="item.text" :aria-label="`AI 待办 ${index + 1} 标题`" /></label>
                    <label><span>备注</span><textarea v-model="item.note" :aria-label="`AI 待办 ${index + 1} 备注`" rows="2" /></label>
                    <label><span>分组</span><input v-model="item.group" :aria-label="`AI 待办 ${index + 1} 分组`" /></label>
                    <div class="ai-capture-todo-dates">
                      <label><span>计划开始</span><input v-model="item.planStartDate" :aria-label="`AI 待办 ${index + 1} 计划开始`" type="date" /></label>
                      <label><span>计划结束</span><input v-model="item.planEndDate" :aria-label="`AI 待办 ${index + 1} 计划结束`" type="date" /></label>
                      <label><span>截止日期</span><input v-model="item.dueDate" :aria-label="`AI 待办 ${index + 1} 截止日期`" type="date" /></label>
                    </div>
                  </div>
                </div>
                <div class="diary-ai-actions"><button class="btn btn-primary" type="button" @click="createSelectedDiaryAiTodos">创建所选待办</button></div>
              </div>
            </div>
          </section>
          <section v-if="editForm.type === '灵感碎片'" class="record-idea-fields" aria-labelledby="record-idea-fields-title">
            <div class="record-preview-heading" id="record-idea-fields-title">灵感推进</div>
            <div class="form-row">
              <label class="form-group"><span>状态</span><AppSelect v-model="editForm.ideaStatus" :options="['待整理', '待实践', '实践中', '已验证', '已放弃'].map(item => ({ value: item, label: item }))" /></label>
              <label class="form-group"><span>标签</span><input v-model="editForm.ideaTagsInput" placeholder="例如：写作, 产品, 实验" /></label>
            </div>
            <label class="form-group"><span>下一步</span><textarea v-model="editForm.ideaNextAction" rows="3" /></label>
            <label class="form-group"><span>关联待办</span><AppSelect v-model="editForm.ideaTodoId" :options="[{ value: '', label: '不关联' }, ...ideaTodoOptions.map(todo => ({ value: todo.id, label: todo.text }))]" /></label>
            <label class="form-group"><span>结果结论</span><textarea v-model="editForm.ideaConclusion" rows="4" /></label>
          </section>
          <div class="record-link-tools">
            <label class="form-group"><span>关联已有待办</span><AppSelect v-model="editForm.linkedTodoId" :options="[{ value: '', label: '选择待办' }, ...openTodos.map(todo => ({ value: todo.id, label: todo.text }))]" /></label>
            <button class="btn btn-secondary" type="button" @click="linkExistingTodo">关联待办</button>
          </div>
          <div class="record-link-tools">
            <label class="form-group"><span>新建专属待办</span><input v-model="editForm.newTodoText" placeholder="例如：补充这条记录的下一步" /></label>
            <button class="btn btn-secondary" type="button" @click="createExclusiveTodo">添加专属待办</button>
          </div>
          <div class="record-linked-list">
            <div class="record-preview-heading">关联待办</div>
            <div v-if="linkedTodos.length" class="linked-todo-list">
              <div v-for="todo in linkedTodos" :key="todo.id" class="record-preview-todo-item" :class="{ done: todo.done }">
                <span class="record-preview-dot"></span>
                <input class="record-linked-todo-check" type="checkbox" :checked="todo.done" :aria-label="`完成 ${todo.text}`" @change="toggleLinkedTodo(todo)" />
                <span>{{ todo.text }}</span>
                <em>{{ todo.isExclusive ? '专属' : '通用' }}</em>
                <button class="link-button danger-text" type="button" @click="unlinkTodo(todo)">{{ todo.isExclusive ? '删除' : '取消关联' }}</button>
              </div>
            </div>
            <EmptyState v-else class="empty-state">还没有关联待办。</EmptyState>
          </div>
          <div class="form-actions">
            <button v-if="editForm.id" class="btn btn-danger" type="button" aria-label="删除记录" @click="removeRecord(editForm.id)">删除</button>
            <button class="btn btn-primary" type="submit">保存修改</button>
          </div>
        </form>
        <aside class="record-preview-shell">
          <div class="record-preview-top">
            <span class="item-type">{{ editForm.type || '记录' }}</span>
            <div class="record-preview-title">{{ editForm.title || '未命名记录' }}</div>
            <div class="record-preview-meta">
              <span>{{ records.services.records.getRecordDateRangeLabel(editForm) }}</span>
              <span>时间 {{ editForm.recordTime || '全天' }}<template v-if="editForm.recordEndTime"> - {{ editForm.recordEndTime }}</template></span>
              <span>待办 {{ linkedTodos.filter(todo => todo.done).length }}/{{ linkedTodos.length }}</span>
            </div>
          </div>
          <div class="record-preview-content">
            <div class="record-preview-heading">内容预览</div>
            <div v-if="previewSections.length">
              <section v-for="section in previewSections" :key="section.title" class="record-preview-section">
                <h4>{{ section.title }}</h4>
                <div class="record-preview-text">{{ section.body.join('\n').trim() || '暂未填写' }}</div>
              </section>
            </div>
            <div v-else class="record-preview-empty">还没有内容</div>
          </div>
          <div v-if="editForm.type === '灵感碎片'" class="record-preview-content">
            <div class="record-preview-heading">灵感推进</div>
            <div class="record-idea-badges"><span class="app-badge">{{ editForm.ideaStatus || '待整理' }}</span><span v-for="tag in records.services.records.getIdeaTags({ ideaTags: editForm.ideaTagsInput })" :key="tag" class="app-badge">{{ tag }}</span></div>
            <div class="record-idea-preview-grid">
              <div><strong>下一步</strong><span>{{ editForm.ideaNextAction || '未设置' }}</span></div>
              <div><strong>关联待办</strong><button v-if="ideaLinkedTodo" class="link-button" type="button" @click="openIdeaTodo">{{ ideaLinkedTodo.text }}</button><span v-else>未关联</span></div>
              <div><strong>结果结论</strong><span>{{ editForm.ideaConclusion || '还没有结论' }}</span></div>
            </div>
          </div>
        </aside>
        </div>
    </ModalShell>

    <div id="all-records">
      <template v-if="view === 'list'">
        <div v-if="listGroups.length">
          <section v-for="group in listGroups" :key="group.date" class="timeline-group">
            <div class="timeline-date">{{ formatDisplayDate(group.date) || '未设置日期' }}</div>
            <article v-for="item in group.items" :key="item.key" class="record-row">
              <div class="record-time">{{ item.timeLabel }}</div>
              <div class="timeline-item" :style="{ '--event-bg': item.tone.bg, '--event-border': item.tone.border, '--event-ink': item.tone.ink }">
                <button class="record-open-button" type="button" @click="selectCalendarItem(item)">
                  <span class="item-type">{{ item.sourceType === 'todo-session' ? '待办' : item.type }}</span>
                  <span class="item-title">{{ item.title }}</span>
                  <div v-if="item.meta" class="item-meta"><span>{{ item.meta }}</span></div>
                  <p v-if="item.preview" class="item-preview">{{ item.preview }}</p>
                  <div v-if="recordForItem(item) && recordTodoIds(recordForItem(item)!).length" class="item-meta"><span>关联待办 {{ recordTodoIds(recordForItem(item)!).length }}</span></div>
                </button>
              </div>
            </article>
          </section>
        </div>
        <EmptyState v-else class="empty-state">{{ recordEmptyState }}</EmptyState>
      </template>
      <CalendarViews v-else :mode="view" :cursor="cursor" :items="calendarItems" :order="dayOrder" @select="selectCalendarItem" />
    </div>
  </section>
</template>

<style scoped>
.record-editor-panel { margin-bottom: 0; }
.record-editor-overlay { z-index: 105; }
.record-preview-modal { max-width: 880px; }
.record-preview-dialog-body { display: grid; gap: 14px; }
#page-records .calendar-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}
#page-records .record-view-nav {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
#page-records .record-view-nav strong {
  min-width: 120px;
  text-align: center;
}
#page-records .record-filter-bar { grid-template-columns: minmax(200px, 1.4fr) minmax(145px, .8fr) minmax(120px, .65fr) minmax(155px, .9fr) minmax(150px, .9fr); }
#page-records .record-filter-bar--list { grid-template-columns: minmax(200px, 1.4fr) minmax(145px, .8fr) minmax(120px, .65fr) minmax(155px, .9fr) minmax(150px, .9fr) minmax(120px, .65fr); }
.record-editor-grid { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(280px, .9fr); gap: 18px; align-items: start; }
.record-edit-form { display: grid; gap: 13px; }
.record-template-toolbar { display: grid; grid-template-columns: minmax(220px, 1fr) auto; gap: 10px; align-items: end; }
.record-template-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.record-template-manager,
.record-template-editor { border-block: 1px solid rgba(42, 75, 56, .13); padding-block: 12px; }
.record-template-modal .record-template-manager { border-block: 0; padding-block: 0; }
.record-template-list { display: grid; }
.record-template-row { display: flex; justify-content: space-between; gap: 12px; align-items: center; padding: 8px 0; border-bottom: 1px solid rgba(42, 75, 56, .09); }
.record-template-row:last-child { border-bottom: 0; }
.record-template-row span { display: grid; gap: 2px; }
.record-template-row small,
.record-template-editor-head p { color: var(--faint); font-size: 12px; margin: 0; }
.record-template-editor { display: grid; gap: 8px; }
.record-template-editor-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
.record-template-field { border: 1px solid rgba(42, 75, 56, .13); border-radius: 6px; padding: 9px 11px; }
.record-template-field summary { cursor: pointer; font-weight: 650; }
.record-template-field textarea { margin-top: 9px; }
.is-preview { background: #f7f9f7; color: var(--muted); }
.record-idea-fields { display: grid; gap: 10px; padding-block: 12px; border-block: 1px solid rgba(42, 75, 56, .13); }
.record-idea-badges { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.record-idea-preview-grid { display: grid; gap: 10px; }
.record-idea-preview-grid > div { display: grid; gap: 3px; }
.record-idea-preview-grid strong { font-size: 12px; }
.record-idea-preview-grid span,
.record-idea-preview-grid button { overflow-wrap: anywhere; white-space: pre-wrap; }
.record-link-tools { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: end; }
.record-linked-list { display: grid; gap: 8px; }
.linked-todo-list { display: grid; gap: 6px; }
.record-open-button { display: block; width: 100%; min-width: 0; border: 0; background: transparent; padding: 0; text-align: left; color: inherit; cursor: pointer; }
.record-open-button .item-title { overflow-wrap: anywhere; word-break: break-word; }
.record-preview-text { white-space: pre-wrap; }
.record-preview-todo-item { gap: 8px; }
.record-preview-todo-item em { margin-left: auto; color: var(--faint); font-style: normal; font-size: 12px; }
.link-button { border: 0; background: transparent; color: #316c4a; cursor: pointer; padding: 3px; }
.danger-text { color: #b84f45; }
@media (max-width: 1180px) {
  #page-records .record-filter-bar { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .record-editor-grid,
  .record-link-tools,
  .record-template-toolbar { grid-template-columns: 1fr; }
  .record-template-editor-head { flex-direction: column; }
}
@media (max-width: 640px) {
  #page-records .record-filter-bar { grid-template-columns: minmax(0, 1fr); }
  #page-records :deep(.agenda-shell) { overflow-x: auto; overflow-y: hidden; }
}
</style>
