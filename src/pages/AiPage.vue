<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { createLegacyServices, getTodayStr } from '../services/legacyServices';
import { useLifePlanStore } from '../stores/lifePlanStore';
import { useRecordsStore } from '../stores/recordsStore';
import { useTodosStore } from '../stores/todosStore';

type AiMode = 'chatCapture' | 'todayPlan' | 'backlogTriage' | 'ideaNext' | 'todoBreakdown' | 'diaryReview';
type DiaryAiSectionKey = 'oneLine' | 'review' | 'tomorrow' | 'improve' | 'thinking' | 'smallJoy';
type DiaryAiSectionDraft = { key: DiaryAiSectionKey; label: string; value: string; selected: boolean };
type AiDraftItem = {
  text: string;
  note: string;
  dueDate: string;
  planStartDate: string;
  planEndDate: string;
  urgency: string;
  group: string;
  subTodos: Array<{ text: string; done?: boolean }>;
  selected: boolean;
};
type CaptureDraftKey = 'diaryText' | 'workText' | 'planText' | 'ideaText';

const route = useRoute();
const router = useRouter();
const store = useLifePlanStore();
const records = useRecordsStore();
const todos = useTodosStore();
const ai = createLegacyServices().ai;

function readPersistedAiConfig() {
  try {
    return JSON.parse(localStorage.getItem('lifePlanAiConfig') || '{}');
  } catch {
    return {};
  }
}

const config = reactive(ai.normalizeConfig(readPersistedAiConfig()));
const mode = ref<AiMode>('chatCapture');
const input = ref('');
const selectedIdeaId = ref('');
const selectedTodoId = ref('');
const selectedDiaryId = ref('');
const result = ref<any>(null);
const drafts = ref<AiDraftItem[]>([]);
const diarySections = ref<DiaryAiSectionDraft[]>([]);
const running = ref(false);
const error = ref('');
const status = ref('');
const captureDraft = reactive<Record<CaptureDraftKey, string>>({
  diaryText: '',
  workText: '',
  planText: '',
  ideaText: '',
});

const modeMeta: Record<AiMode, { title: string; subtitle: string; inputLabel: string; placeholder: string; action: string }> = {
  chatCapture: {
    title: 'AI 对话整理',
    subtitle: '把你随手说的一段话纠错、整理，并建议放到待办、工作、日记、计划或灵感。',
    inputLabel: '直接和 AI 说',
    placeholder: '例如：明天想把页面检查一下，顺手记个待办。',
    action: '生成建议',
  },
  todayPlan: {
    title: 'AI 今日计划',
    subtitle: '根据今日待办、习惯、目标和近期记录，整理一个短行动清单。',
    inputLabel: '补充今天的状态或限制',
    placeholder: '例如：优先补逾期，再推进一个高优先级任务。',
    action: '生成今日计划',
  },
  backlogTriage: {
    title: 'AI 待办整理',
    subtitle: '从未完成待办里挑出最值得今天推进的小步。',
    inputLabel: '整理偏好',
    placeholder: '例如：只保留今天能完成的 3 到 5 件。',
    action: '生成整理建议',
  },
  ideaNext: {
    title: 'AI 灵感下一步',
    subtitle: '选择一条灵感，把它变成一个小实验或下一步行动。',
    inputLabel: '转化要求',
    placeholder: '例如：先做最小验证，不要设计太大的项目。',
    action: '生成灵感行动',
  },
  todoBreakdown: {
    title: 'AI 待办拆解',
    subtitle: '选择一个待办，把它拆成可以勾选的子任务。',
    inputLabel: '拆解要求',
    placeholder: '例如：按准备、执行、收尾拆；每一步必须能直接开始。',
    action: '生成子任务',
  },
  diaryReview: {
    title: 'AI 日记分析',
    subtitle: '从一篇日记里提炼复盘、明日重点和可确认的行动建议。',
    inputLabel: '分析偏好',
    placeholder: '例如：复盘要直白一点；明日重点只保留一件最关键的事。',
    action: '生成日记分析',
  },
};

const ideaOptions = computed(() => store.data.records
  .filter(record => record.type === '灵感碎片')
  .filter(record => records.services.records.isIdeaUnprocessed(record) || records.services.records.ideaNeedsConclusion(record) || record.id === selectedIdeaId.value)
  .slice()
  .sort((left, right) => String(right.updatedAt || '').localeCompare(String(left.updatedAt || ''))));

const todoOptions = computed(() => store.data.todos
  .filter(todo => !todo.done || todo.id === selectedTodoId.value)
  .slice()
  .sort(todos.services.todos.compareTodosForFocus));

const diaryOptions = computed(() => store.data.records
  .filter(record => record.type === '日记' && String(record.content || '').trim())
  .slice()
  .sort((left, right) => String(right.updatedAt || right.startDate || '').localeCompare(String(left.updatedAt || left.startDate || ''))));

const selectedIdea = computed(() => store.data.records.find(record => record.id === selectedIdeaId.value && record.type === '灵感碎片') ?? null);
const selectedTodo = computed(() => store.data.todos.find(todo => todo.id === selectedTodoId.value) ?? null);
const selectedDiary = computed(() => diaryOptions.value.find(record => record.id === selectedDiaryId.value) ?? diaryOptions.value[0] ?? null);
const selectedDrafts = computed(() => drafts.value.filter(item => item.selected && item.text.trim()));
const today = computed(() => getTodayStr());

function isTodoPlannedToday(todo: { planStartDate?: string; planEndDate?: string }) {
  return Boolean(todo.planStartDate && todo.planEndDate && todo.planStartDate <= today.value && todo.planEndDate >= today.value);
}

function hasTodoSessionToday(todo: { sessions?: Array<{ date?: string }> }) {
  return (todo.sessions || []).some(session => session.date === today.value);
}

function isTodoOverdue(todo: { done?: boolean; dueDate?: string }) {
  return Boolean(!todo.done && todo.dueDate && todo.dueDate < today.value);
}

function isTodoRelevantToday(todo: { done?: boolean; dueDate?: string; planStartDate?: string; planEndDate?: string; sessions?: Array<{ date?: string }> }) {
  return isTodoOverdue(todo) || todo.dueDate === today.value || isTodoPlannedToday(todo) || hasTodoSessionToday(todo);
}

function compactTodo(todo: any) {
  return {
    id: todo.id,
    text: todo.text,
    note: todo.note,
    group: todo.group,
    urgency: todo.urgency,
    dueDate: todo.dueDate,
    planStartDate: todo.planStartDate,
    planEndDate: todo.planEndDate,
    subTodos: todo.subTodos || [],
    sessions: todo.sessions || [],
  };
}

const context = computed(() => ({
  todayTodos: store.data.todos
    .filter(todo => !todo.done && isTodoRelevantToday(todo))
    .slice()
    .sort(todos.services.todos.compareTodosForFocus)
    .slice(0, 10)
    .map(compactTodo),
  floatingTodos: store.data.todos
    .filter(todo => !todo.done && !todo.dueDate && !todo.planStartDate && !todo.planEndDate)
    .slice(0, 12)
    .map(compactTodo),
  overdueTodos: store.data.todos.filter(todo => isTodoOverdue(todo)).slice(0, 10).map(compactTodo),
  activeGoals: store.data.goals.filter(goal => goal.status === '进行中').slice(0, 8).map(goal => ({
    id: goal.id,
    name: goal.name,
    progress: goal.progress,
    status: goal.status,
  })),
  dueHabits: store.data.habits.filter(habit => !habit.archived).slice(0, 8).map(habit => ({
    id: habit.id,
    name: habit.name,
    doneToday: store.data.checkins.some(checkin => checkin.habitId === habit.id && checkin.date === today.value),
  })),
  ideas: store.data.records.filter(record => record.type === '灵感碎片').slice(0, 8).map(record => ({
    id: record.id,
    title: record.title,
    content: String(record.content || '').slice(0, 180),
    ideaStatus: record.ideaStatus,
  })),
  recentRecords: store.data.records
    .filter(record => record.type !== '灵感碎片')
    .slice()
    .sort((left, right) => String(right.updatedAt || right.startDate || '').localeCompare(String(left.updatedAt || left.startDate || '')))
    .slice(0, 8)
    .map(record => ({
      type: record.type,
      title: record.title,
      startDate: record.startDate,
      content: String(record.content || '').slice(0, 280),
    })),
  selectedIdea: selectedIdea.value ? {
    id: selectedIdea.value.id,
    title: selectedIdea.value.title,
    content: selectedIdea.value.content,
    ideaStatus: selectedIdea.value.ideaStatus,
    ideaNextAction: selectedIdea.value.ideaNextAction,
    ideaConclusion: selectedIdea.value.ideaConclusion,
    ideaTags: selectedIdea.value.ideaTags,
  } : null,
  selectedTodo: selectedTodo.value ? {
    id: selectedTodo.value.id,
    text: selectedTodo.value.text,
    note: selectedTodo.value.note,
    group: selectedTodo.value.group,
    urgency: selectedTodo.value.urgency,
    dueDate: selectedTodo.value.dueDate,
    planStartDate: selectedTodo.value.planStartDate,
    planEndDate: selectedTodo.value.planEndDate,
    subTodos: selectedTodo.value.subTodos,
  } : null,
  selectedDiary: selectedDiary.value ? {
    id: selectedDiary.value.id,
    type: selectedDiary.value.type,
    title: selectedDiary.value.title,
    startDate: selectedDiary.value.startDate,
    endDate: selectedDiary.value.endDate,
    recordTime: selectedDiary.value.recordTime,
    content: selectedDiary.value.content,
    templateId: selectedDiary.value.templateId,
    fields: (() => {
      const template = records.services.records.getBuiltInTemplate('builtin-diary-daily-review');
      return template ? records.services.records.parseTemplateContent(template, selectedDiary.value.content || '') : {};
    })(),
  } : null,
}));

function saveConfig() {
  Object.assign(config, ai.normalizeConfig(config));
  localStorage.setItem('lifePlanAiConfig', JSON.stringify(config));
  status.value = 'AI 设置已保存';
}

function resetResult() {
  result.value = null;
  drafts.value = [];
  error.value = '';
  status.value = '';
  captureDraft.diaryText = '';
  captureDraft.workText = '';
  captureDraft.planText = '';
  captureDraft.ideaText = '';
  diarySections.value = [];
}

function setMode(next: AiMode) {
  mode.value = next;
  resetResult();
  const query: Record<string, string> = { mode: next };
  if (next === 'ideaNext' && selectedIdeaId.value) query.idea = selectedIdeaId.value;
  if (next === 'todoBreakdown' && selectedTodoId.value) query.todo = selectedTodoId.value;
  if (next === 'diaryReview' && selectedDiaryId.value) query.diary = selectedDiaryId.value;
  void router.replace({ path: '/ai', query });
}

function toDrafts(items: any[] = []): AiDraftItem[] {
  return items.map(item => ({
    text: String(item?.text || '').trim(),
    note: String(item?.note || item?.reason || '').trim(),
    dueDate: String(item?.dueDate || ''),
    planStartDate: String(item?.planStartDate || ''),
    planEndDate: String(item?.planEndDate || ''),
    urgency: String(item?.urgency || 'medium'),
    group: String(item?.group || (mode.value === 'ideaNext' ? '学习' : '其他')),
    subTodos: Array.isArray(item?.subTodos) ? item.subTodos.map((sub: any) => ({ text: String(sub?.text || '').trim(), done: !!sub?.done })).filter((sub: any) => sub.text) : [],
    selected: true,
  })).filter(item => item.text);
}

function updateCaptureDraft(raw: any) {
  const capture = raw?.capture || {};
  const cleanText = String(capture.cleanText || '').trim();
  captureDraft.diaryText = String(capture.diaryText || cleanText).trim();
  captureDraft.workText = String(capture.workText || '').trim();
  captureDraft.planText = String(capture.planText || '').trim();
  captureDraft.ideaText = String(capture.ideaText || '').trim();
}

function updateDiaryDraft(raw: any) {
  const sectionMeta: Array<[DiaryAiSectionKey, string]> = [
    ['review', '复盘'], ['tomorrow', '明日重点'], ['oneLine', '今日一句话'],
    ['improve', '待改进'], ['thinking', '思考'], ['smallJoy', '小确幸'],
  ];
  diarySections.value = sectionMeta
    .filter(([key]) => String(raw?.diary?.[key] || '').trim())
    .map(([key, label]) => ({ key, label, value: String(raw.diary[key] || ''), selected: key === 'review' || key === 'tomorrow' }));
}

async function run() {
  running.value = true;
  error.value = '';
  status.value = '';
  result.value = null;
  drafts.value = [];
  try {
    if (mode.value === 'ideaNext' && !selectedIdea.value) throw new Error('请先选择一条灵感');
    if (mode.value === 'todoBreakdown' && !selectedTodo.value) throw new Error('请先选择一个待办');
    if (mode.value === 'diaryReview' && !selectedDiary.value) throw new Error('请先选择一篇有内容的日记');
    const payload = {
      mode: mode.value,
      userInput: input.value,
      today: getTodayStr(),
      context: context.value,
    };
    let remoteError = '';
    let raw;
    if (ai.isRemoteReady(config)) {
      try {
        raw = await ai.requestRemoteAi(config, payload);
      } catch (remoteFailure) {
        remoteError = remoteFailure instanceof Error ? remoteFailure.message : String(remoteFailure);
        raw = ai.generateLocalAiResult(payload);
      }
    } else {
      raw = ai.generateLocalAiResult(payload);
    }
    result.value = raw;
    drafts.value = toDrafts(raw?.items || []);
    if (mode.value === 'chatCapture') updateCaptureDraft(raw);
    if (mode.value === 'diaryReview') updateDiaryDraft(raw);
    const hasCapture = Object.values(captureDraft).some(value => value.trim());
    status.value = remoteError
      ? `远程 AI 报错：${remoteError}\n已改用本地规则生成建议。`
      : drafts.value.length || hasCapture ? '已生成建议，确认后再写入' : '没有可用建议';
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    running.value = false;
  }
}

function applyChatItem(item: AiDraftItem, sourceType = 'ai-capture') {
  todos.create({
    text: item.text.trim(),
    note: item.note,
    dueDate: item.dueDate,
    planStartDate: item.planStartDate,
    planEndDate: item.planEndDate,
    urgency: (item.urgency as any) || 'medium',
    group: item.group || '其他',
    subTodos: item.subTodos.map(sub => ({ text: sub.text, done: false })),
    sourceType,
  });
  status.value = '已创建待办';
}

function applyChatTodos() {
  const selected = selectedDrafts.value;
  if (!selected.length) {
    error.value = '请至少选择一条待办并保留标题';
    return;
  }
  selected.forEach(item => applyChatItem(item, 'ai-capture'));
  status.value = `已创建待办 ${selected.length} 项`;
  error.value = '';
}

function applyPlanTodos() {
  const selected = selectedDrafts.value;
  if (!selected.length) {
    error.value = '请至少选择一条待办并保留标题';
    return;
  }
  selected.forEach(item => applyChatItem(item, 'ai'));
  status.value = mode.value === 'backlogTriage'
    ? `已加入整理待办 ${selected.length} 项`
    : `已加入今日待办 ${selected.length} 项`;
  error.value = '';
}

function applyCaptureToDiary() {
  const applied = records.applyAiCaptureToDiary(captureDraft.diaryText);
  if (!applied) {
    error.value = '没有可写入日记的整理内容';
    return;
  }
  status.value = applied.created ? '已新建今天的日记' : '已追加到今天的日记';
  error.value = '';
}

function applyCaptureRecord(type: '工作记录' | '日计划' | '灵感碎片', key: CaptureDraftKey) {
  const applied = records.applyAiCaptureRecord(type, captureDraft[key]);
  if (!applied) {
    error.value = `没有可写入${type}的整理内容`;
    return;
  }
  status.value = type === '日计划' && !applied.created ? '已追加到今天的日计划' : `已创建${type}`;
  error.value = '';
}

function applyIdeaDrafts() {
  if (!selectedIdea.value) {
    error.value = '请先选择一条灵感';
    return;
  }
  const selected = selectedDrafts.value;
  if (!selected.length) {
    error.value = '请至少选择一条行动建议';
    return;
  }
  const createdIds = records.applyIdeaAiActions(String(selectedIdea.value.id), selected, { replaceNextAction: true });
  if (!createdIds.length) {
    error.value = '没有可写入的行动建议';
    return;
  }
  status.value = `已转成关联待办 ${createdIds.length} 项，并把灵感状态更新为待实践`;
  error.value = '';
  void router.push({ path: '/todos', query: { todo: createdIds[0] } });
}

function applyTodoBreakdown() {
  if (!selectedTodo.value) {
    error.value = '请先选择一个待办';
    return;
  }
  const selected = selectedDrafts.value;
  if (!selected.length) {
    error.value = '请至少选择一条子任务建议';
    return;
  }
  const existing = new Set((selectedTodo.value.subTodos || []).map(sub => sub.text));
  const additions = selected
    .map(item => item.text.trim())
    .filter(text => text && !existing.has(text))
    .map(text => ({ text, done: false }));
  if (!additions.length) {
    error.value = '没有新增子任务（可能已存在）';
    return;
  }
  const noteParts = [selectedTodo.value.note || ''];
  if (result.value?.summary) noteParts.push(`AI 拆解：${result.value.summary}`);
  todos.update(selectedTodo.value.id, {
    text: selectedTodo.value.text,
    note: noteParts.filter(Boolean).join('\n\n'),
    dueDate: selectedTodo.value.dueDate,
    planStartDate: selectedTodo.value.planStartDate,
    planEndDate: selectedTodo.value.planEndDate,
    urgency: selectedTodo.value.urgency,
    group: selectedTodo.value.group,
    subTodos: [...selectedTodo.value.subTodos.map(item => ({ ...item })), ...additions],
  });
  status.value = `已写入子任务 ${additions.length} 项`;
  error.value = '';
}

function applyDiarySections() {
  if (!selectedDiary.value) {
    error.value = '请先选择一篇有内容的日记';
    return;
  }
  const selected = diarySections.value.filter(section => section.selected && section.value.trim());
  if (!selected.length) {
    error.value = '请至少选择一个有内容的日记字段';
    return;
  }
  const template = records.services.records.getBuiltInTemplate('builtin-diary-daily-review');
  const existing = template ? records.services.records.parseTemplateContent(template, selectedDiary.value.content || '') : {};
  const overwriteLabels = selected.filter(section => String(existing[section.key] || '').trim()).map(section => section.label);
  if (overwriteLabels.length && !window.confirm(`这些字段已有内容：${overwriteLabels.join('、')}。确定用 AI 草稿覆盖吗？`)) return;
  const applied = records.applyDiaryAiSections(String(selectedDiary.value.id), Object.fromEntries(selected.map(section => [section.key, section.value])));
  if (!applied) {
    error.value = '日记字段写入失败';
    return;
  }
  status.value = `已写入：${selected.map(section => section.label).join('、')}`;
  error.value = '';
}

function applyDiaryTodos() {
  if (!selectedDiary.value) {
    error.value = '请先选择一篇有内容的日记';
    return;
  }
  const selected = selectedDrafts.value;
  if (!selected.length) {
    error.value = '请至少选择一条保留标题的待办';
    return;
  }
  const createdIds = records.createDiaryAiTodos(String(selectedDiary.value.id), selected.map(item => ({
    ...item,
    text: item.text.trim(),
    urgency: (['urgent', 'high', 'medium', 'low'].includes(item.urgency) ? item.urgency : 'medium') as 'urgent' | 'high' | 'medium' | 'low',
    subTodos: item.subTodos.map(sub => ({ text: sub.text, done: Boolean(sub.done) })),
  })));
  status.value = `已创建待办 ${createdIds.length} 项`;
  error.value = '';
}

function applySelected() {
  if (mode.value === 'ideaNext') {
    applyIdeaDrafts();
    return;
  }
  if (mode.value === 'todoBreakdown') {
    applyTodoBreakdown();
    return;
  }
  if (mode.value === 'diaryReview') {
    applyDiaryTodos();
    return;
  }
  if (mode.value === 'todayPlan' || mode.value === 'backlogTriage') {
    applyPlanTodos();
    return;
  }
  applyChatTodos();
}

watch(() => route.query.mode, value => {
  const next = String(Array.isArray(value) ? value[0] : value || 'chatCapture');
    if (next === 'ideaNext' || next === 'todoBreakdown' || next === 'diaryReview' || next === 'chatCapture' || next === 'todayPlan' || next === 'backlogTriage') {
    mode.value = next;
  }
}, { immediate: true });

watch(() => route.query.idea, value => {
  const id = String(Array.isArray(value) ? value[0] : value || '');
  if (id) selectedIdeaId.value = id;
}, { immediate: true });

watch(() => route.query.todo, value => {
  const id = String(Array.isArray(value) ? value[0] : value || '');
  if (id) selectedTodoId.value = id;
}, { immediate: true });

watch(() => route.query.diary, value => {
  const id = String(Array.isArray(value) ? value[0] : value || '');
  if (id) selectedDiaryId.value = id;
}, { immediate: true });
</script>

<template>
  <section class="page active" id="page-ai">
    <header class="page-header">
      <div>
        <div class="page-title">AI 助手</div>
        <p class="todo-page-summary">生成结果默认只是草稿，确认后才写入 lifePlanData。</p>
      </div>
    </header>

    <article class="card">
      <div class="card-title">AI 设置</div>
      <div class="form-row">
        <div class="form-group"><label for="ai-endpoint">接口地址</label><input id="ai-endpoint" v-model="config.endpointUrl" placeholder="https://.../v1" /></div>
        <div class="form-group"><label for="ai-model">模型</label><input id="ai-model" v-model="config.model" /></div>
        <div class="form-group"><label for="ai-key">API Key</label><input id="ai-key" v-model="config.apiKey" type="password" /></div>
        <div class="form-group"><label><input v-model="config.remoteEnabled" type="checkbox" /> 启用远程 AI</label></div>
      </div>
      <button class="btn btn-secondary" type="button" @click="saveConfig">保存设置</button>
    </article>

    <article class="card">
      <div class="card-title">模式</div>
      <div class="ai-mode-tabs" role="tablist" aria-label="AI mode">
        <button type="button" :class="{ active: mode === 'chatCapture' }" @click="setMode('chatCapture')">对话整理</button>
        <button type="button" :class="{ active: mode === 'todayPlan' }" @click="setMode('todayPlan')">今日计划</button>
        <button type="button" :class="{ active: mode === 'backlogTriage' }" @click="setMode('backlogTriage')">待办整理</button>
        <button type="button" :class="{ active: mode === 'ideaNext' }" @click="setMode('ideaNext')">灵感下一步</button>
        <button type="button" :class="{ active: mode === 'todoBreakdown' }" @click="setMode('todoBreakdown')">待办拆解</button>
        <button type="button" :class="{ active: mode === 'diaryReview' }" @click="setMode('diaryReview')">日记分析</button>
      </div>
      <p class="todo-page-summary">{{ modeMeta[mode].subtitle }}</p>

      <div v-if="mode === 'ideaNext'" class="form-group">
        <label for="ai-idea-select">选择灵感</label>
        <select id="ai-idea-select" v-model="selectedIdeaId">
          <option value="">选择一条待处理灵感</option>
          <option v-for="idea in ideaOptions" :key="String(idea.id)" :value="String(idea.id)">{{ idea.title || idea.content || '未命名灵感' }}</option>
        </select>
      </div>

      <div v-if="mode === 'todoBreakdown'" class="form-group">
        <label for="ai-todo-select">选择待办</label>
        <select id="ai-todo-select" v-model="selectedTodoId">
          <option value="">选择一个待办</option>
          <option v-for="todo in todoOptions" :key="todo.id" :value="todo.id">{{ todo.text }}</option>
        </select>
      </div>

      <div v-if="mode === 'diaryReview'" class="form-group">
        <label for="ai-diary-select">选择日记</label>
        <select id="ai-diary-select" v-model="selectedDiaryId">
          <option value="">选择一篇有内容的日记</option>
          <option v-for="diary in diaryOptions" :key="String(diary.id)" :value="String(diary.id)">{{ diary.title || diary.startDate || '未命名日记' }}</option>
        </select>
      </div>

      <div class="form-group">
        <label for="ai-user-input">{{ modeMeta[mode].inputLabel }}</label>
        <textarea id="ai-user-input" v-model="input" :placeholder="modeMeta[mode].placeholder" />
      </div>
      <button class="btn btn-primary" type="button" :disabled="running" @click="run">{{ running ? '生成中…' : modeMeta[mode].action }}</button>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <p v-if="status" class="todo-save-status" role="status">{{ status }}</p>
    </article>

    <article v-if="result" class="card">
      <div class="card-title">{{ result.title || 'AI' }}</div>
      <p>{{ result.summary }}</p>
      <div v-if="mode === 'chatCapture'" class="ai-capture-section-list">
        <section class="ai-capture-section">
          <div class="ai-capture-section-head">
            <label for="ai-capture-draft-diaryText">日记草稿</label>
            <button class="btn btn-secondary" type="button" @click="applyCaptureToDiary">追加到日记</button>
          </div>
          <textarea id="ai-capture-draft-diaryText" v-model="captureDraft.diaryText" rows="4" />
        </section>
        <section class="ai-capture-section">
          <div class="ai-capture-section-head">
            <label for="ai-capture-draft-workText">工作记录草稿</label>
            <button class="btn btn-secondary" type="button" @click="applyCaptureRecord('工作记录', 'workText')">创建工作记录</button>
          </div>
          <textarea id="ai-capture-draft-workText" v-model="captureDraft.workText" rows="4" />
        </section>
        <section class="ai-capture-section">
          <div class="ai-capture-section-head">
            <label for="ai-capture-draft-planText">计划草稿</label>
            <button class="btn btn-secondary" type="button" @click="applyCaptureRecord('日计划', 'planText')">写入日计划</button>
          </div>
          <textarea id="ai-capture-draft-planText" v-model="captureDraft.planText" rows="4" />
        </section>
        <section class="ai-capture-section">
          <div class="ai-capture-section-head">
            <label for="ai-capture-draft-ideaText">灵感草稿</label>
            <button class="btn btn-secondary" type="button" @click="applyCaptureRecord('灵感碎片', 'ideaText')">存为灵感</button>
          </div>
          <textarea id="ai-capture-draft-ideaText" v-model="captureDraft.ideaText" rows="4" />
        </section>
      </div>
      <div v-if="mode === 'diaryReview' && diarySections.length" class="ai-capture-section-list">
        <section v-for="section in diarySections" :key="section.key" class="ai-capture-section">
          <label class="todo-check-row"><input v-model="section.selected" type="checkbox" :aria-label="`选择${section.label}`" /><span>{{ section.label }}</span></label>
          <textarea v-model="section.value" :aria-label="`AI ${section.label}草稿`" rows="4" />
        </section>
        <button class="btn btn-secondary" type="button" @click="applyDiarySections">写入所选日记字段</button>
      </div>
      <div class="ai-result-list">
        <div v-for="(item, index) in drafts" :key="`${index}-${item.text}`" class="ai-result-item">
          <label class="todo-check-row">
            <input v-model="item.selected" type="checkbox" :aria-label="`select ${index + 1}`" />
            <span>写入这条</span>
          </label>
          <div class="form-group"><label :for="`ai-draft-text-${index}`">标题</label><input :id="`ai-draft-text-${index}`" v-model="item.text" /></div>
          <div class="form-group"><label :for="`ai-draft-note-${index}`">备注</label><textarea :id="`ai-draft-note-${index}`" v-model="item.note" /></div>
          <div v-if="mode !== 'todoBreakdown'" class="form-row">
            <div class="form-group"><label :for="`ai-draft-due-${index}`">截止日期</label><input :id="`ai-draft-due-${index}`" v-model="item.dueDate" type="date" /></div>
            <div class="form-group"><label :for="`ai-draft-plan-start-${index}`">计划开始</label><input :id="`ai-draft-plan-start-${index}`" v-model="item.planStartDate" type="date" /></div>
            <div class="form-group"><label :for="`ai-draft-plan-end-${index}`">计划结束</label><input :id="`ai-draft-plan-end-${index}`" v-model="item.planEndDate" type="date" /></div>
            <div class="form-group"><label :for="`ai-draft-group-${index}`">分组</label><input :id="`ai-draft-group-${index}`" v-model="item.group" /></div>
          </div>
          <p v-if="item.subTodos.length" class="todo-detail-copy">建议子任务：{{ item.subTodos.map(sub => sub.text).join(' / ') }}</p>
          <button v-if="mode === 'chatCapture'" class="btn btn-secondary" type="button" @click="applyChatItem(item)">创建待办</button>
        </div>
      </div>
      <div class="todo-detail-actions">
        <button class="btn btn-primary" type="button" :disabled="!selectedDrafts.length" @click="applySelected">
          {{
            mode === 'ideaNext'
              ? '转成关联待办'
              : mode === 'todoBreakdown'
                ? '写入子任务'
                : mode === 'diaryReview'
                  ? '创建所选待办'
                : mode === 'todayPlan'
                  ? '加入今日待办'
                  : mode === 'backlogTriage'
                    ? '加入整理待办'
                    : '创建这些待办'
          }}
        </button>
      </div>
    </article>
  </section>
</template>

<style scoped>
.ai-mode-tabs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.ai-mode-tabs button {
  border: 1px solid var(--line);
  background: var(--surface-soft);
  color: var(--muted);
  border-radius: var(--radius-pill);
  padding: 6px 12px;
  font-weight: 700;
  cursor: pointer;
}
.ai-mode-tabs button.active {
  background: var(--accent-soft, #f3e7d3);
  color: var(--text);
  border-color: var(--accent, #c7923e);
}
.ai-result-list { display: grid; gap: 12px; margin-top: 12px; }
.ai-capture-section-list { display: grid; gap: 12px; margin-top: 12px; }
.ai-capture-section {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface-soft);
}
.ai-capture-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.ai-capture-section-head label { font-weight: 800; }
.ai-capture-section textarea {
  width: 100%;
  resize: vertical;
}
.ai-result-item {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface-soft);
}
</style>
