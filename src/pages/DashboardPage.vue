<script setup lang="ts">
import EmptyState from '../components/common/EmptyState.vue';
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import RecordCreateModal from '../components/RecordCreateModal.vue';
import PageHeader from '../components/common/PageHeader.vue';
import AppSelect from '../components/common/AppSelect.vue';
import ModalShell from '../components/common/ModalShell.vue';
import AiPage from './AiPage.vue';
import TodosPage from './TodosPage.vue';
import { withReturnTo } from '../router/returnTo';
import { getTodayStr } from '../services/legacyServices';
import { useFitnessStore } from '../stores/fitnessStore';
import { useHabitsStore } from '../stores/habitsStore';
import { useLifePlanStore } from '../stores/lifePlanStore';
import { useRecordsStore } from '../stores/recordsStore';
import { useTodosStore } from '../stores/todosStore';
import type { DataEntity, Todo } from '../types/lifePlan';
import { addDays, buildScheduleItems, sortScheduleItems, type ScheduleItem } from '../utils/schedule';

type MaterialEntity = DataEntity & { id?: string; title?: string; content?: string; type?: string; tags?: string[]; source?: string; note?: string; createdAt?: string };
type RecordEntity = DataEntity & {
  id: string;
  title?: string;
  content?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
  recordTime?: string;
  recordEndTime?: string;
  updatedAt?: string;
  createdAt?: string;
  todoIds?: string[];
  ideaStatus?: string;
  ideaTags?: string[];
  ideaNextAction?: string;
  ideaTodoId?: string;
  ideaConclusion?: string;
};
type FloatingMode = 'random' | 'newest' | 'oldest';

const route = useRoute();
const router = useRouter();
const lifePlan = useLifePlanStore();
const recordsStore = useRecordsStore();
const todosStore = useTodosStore();
const habitsStore = useHabitsStore();
const fitnessStore = useFitnessStore();
const today = ref(getTodayStr());
const todayLabel = computed(() => formatLongDate(today.value));
let todayTimer: ReturnType<typeof setTimeout> | null = null;

function refreshToday() {
  const nextToday = getTodayStr();
  if (today.value !== nextToday) today.value = nextToday;
}

function scheduleTodayRefresh() {
  if (todayTimer !== null) clearTimeout(todayTimer);
  const now = new Date();
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 25);
  todayTimer = setTimeout(() => {
    refreshToday();
    scheduleTodayRefresh();
  }, Math.max(1000, nextMidnight.getTime() - now.getTime()));
}

function handleDashboardVisibility() {
  if (document.visibilityState !== 'hidden') {
    refreshToday();
    scheduleTodayRefresh();
  }
}
const showCreateRecord = ref(false);
const showAiAssistant = ref(false);
const showTodoAssistant = ref(false);
const aiAssistantMode = ref<'todayPlan' | 'chatCapture'>('todayPlan');
const showAiDiaryReview = ref(false);
const aiDiaryReviewId = ref('');
const createModal = ref<InstanceType<typeof RecordCreateModal> | null>(null);
const floatingMode = ref<FloatingMode>('random');
const floatingSampleNonce = ref(0);
const expandedMaterialIds = ref<string[]>([]);
const timelineRangeDays = ref(30);
const dashboardPreviewRecord = ref<RecordEntity | null>(null);
const showHabitCheckinNote = ref(false);
const habitCheckinNoteForm = reactive({
  mode: 'create' as 'create' | 'edit',
  checkinId: '',
  habitId: '',
  habitName: '',
  note: '',
  disableFuturePrompt: false,
});
const periodTypes = ['周复盘', '月复盘', '年复盘', '周计划', '月计划', '年度计划', '3年计划', '终身愿景'];
const urgencyLabels: Record<Todo['urgency'], string> = { urgent: '紧急', high: '高', medium: '中', low: '低' };

function isTodoPlannedOnDate(todo: Todo, date: string) {
  return Boolean(todo.planStartDate && todo.planEndDate && todo.planStartDate <= date && todo.planEndDate >= date);
}

function hasTodoSessionOnDate(todo: Todo, date: string) {
  return (todo.sessions || []).some(session => session.date === date);
}

function isTodoOverdue(todo: Todo, date = today.value) {
  return Boolean(!todo.done && todo.dueDate && todo.dueDate < date);
}

function getTodoOverdueDays(todo: Todo, date = today.value) {
  if (!isTodoOverdue(todo, date)) return 0;
  const diff = new Date(`${date}T12:00:00`).getTime() - new Date(`${todo.dueDate}T12:00:00`).getTime();
  return Math.max(1, Math.floor(diff / 86_400_000));
}

function isTodoRelevantToday(todo: Todo) {
  return isTodoOverdue(todo) || todo.dueDate === today.value || isTodoPlannedOnDate(todo, today.value) || hasTodoSessionOnDate(todo, today.value);
}

function getTodayTodoReason(todo: Todo) {
  const reasons = [];
  if (isTodoOverdue(todo)) reasons.push(`已超期 ${getTodoOverdueDays(todo)} 天`);
  if (isTodoPlannedOnDate(todo, today.value)) reasons.push('计划中');
  if (todo.dueDate === today.value) reasons.push('今天截止');
  if (hasTodoSessionOnDate(todo, today.value)) reasons.push('今天已记录');
  return reasons.join(' · ') || '今日关注';
}

const habitRuleLabels: Record<string, string> = {
  daily: '每天',
  'weekly-fixed': '固定周几',
  'weekly-count': '每周次数',
  'monthly-count': '每月次数',
  interval: '间隔天数',
};

function habitRuleText(habit: Record<string, any>) {
  const rule = String(habit.rule || '');
  if (rule === 'weekly-count') return `每周${habit.count || 0}次`;
  if (rule === 'monthly-count') return `每月${habit.count || 0}次`;
  if (rule === 'interval') return `每${habit.count || 0}天`;
  return habitRuleLabels[rule] || '自定义';
}

function latestHabitCheckin(habitId: string) {
  const checkins = habitsStore.getCheckins(habitId, today.value).slice().sort((a: Record<string, any>, b: Record<string, any>) => {
    const sortKey = (checkin: Record<string, any>) => String(checkin.checkinAt || (checkin.time ? `${today.value}T${checkin.time}:00` : checkin.createdAt || ''));
    return sortKey(a).localeCompare(sortKey(b));
  });
  return checkins[checkins.length - 1] || null;
}

function habitCheckinTimeText(habitId: string) {
  const latest = latestHabitCheckin(habitId) as Record<string, any> | null;
  if (!latest) return '未记录';
  if (/^\d{2}:\d{2}$/.test(String(latest.time || ''))) return latest.time;
  return String(latest.checkinAt || latest.createdAt || latest.updatedAt || '').slice(11, 16) || '未记录';
}

function habitCheckinNoteText(habitId: string) {
  const latest = latestHabitCheckin(habitId) as Record<string, any> | null;
  const clean = String(latest?.note || '').replace(/\s+/g, ' ').trim();
  return clean.length > 22 ? `${clean.slice(0, 21)}…` : clean;
}

function habitRewardText(habit: Record<string, any>) {
  const currency = String(habit.rewardCurrency || '金币');
  const min = Math.max(0, Number.parseInt(String(habit.rewardMin ?? habit.rewardPoints ?? 0), 10) || 0);
  const max = Math.max(0, Number.parseInt(String(habit.rewardMax ?? habit.rewardPoints ?? 0), 10) || 0);
  if (habit.randomReward && (min > 0 || max > 0)) return `+${habit.rewardMin ?? habit.rewardPoints ?? 0}-${habit.rewardMax ?? habit.rewardPoints ?? 0} ${currency}`;
  const points = Math.max(0, Number.parseInt(String(habit.rewardPoints ?? 0), 10) || 0);
  return points > 0 ? `+${habit.rewardPoints} ${currency}` : '';
}

function habitPenaltyText(habit: Record<string, any>) {
  const points = Math.max(0, Number.parseInt(String(habit.penaltyPoints || 0), 10) || 0);
  return points > 0 ? `漏打 -${points}` : '';
}

function entityString(entity: DataEntity, key: string) {
  return typeof entity[key] === 'string' ? entity[key] as string : '';
}

function activeRecordTodos(record: DataEntity) {
  const ids = Array.isArray(record.todoIds) ? record.todoIds.map(String) : [];
  const todos = lifePlan.data.todos.filter(todo => ids.includes(todo.id));
  return { total: todos.length, done: todos.filter(todo => todo.done).length };
}

function formatDate(value: unknown) {
  return formatLongDate(String(value || ''));
}

function formatStoredDateTime(value: unknown) {
  const raw = String(value || '');
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return raw.replace('T', ' ');
  return `${match[1]}年${Number(match[2])}月${Number(match[3])}日 ${match[4]}:${match[5]}:${match[6] || '00'}`;
}

function formatLongDate(value: string) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value || '无';
  return `${match[1]}年${Number(match[2])}月${Number(match[3])}日`;
}

function recordTodoIds(record: DataEntity) {
  return Array.isArray(record.todoIds) ? record.todoIds.map(String).filter(Boolean) : [];
}

const dashboardPreviewTodos = computed(() => {
  if (!dashboardPreviewRecord.value) return [];
  const todoIds = recordTodoIds(dashboardPreviewRecord.value);
  return lifePlan.data.todos.filter(todo => todoIds.includes(todo.id));
});
const dashboardPreviewSections = computed(() => recordsStore.services.records.parseRecordContentSections(dashboardPreviewRecord.value?.content || ''));
const dashboardPreviewIdeaTodoText = computed(() => {
  const record = dashboardPreviewRecord.value;
  if (!record?.ideaTodoId) return '未关联';
  return dashboardPreviewTodos.value.find(todo => todo.id === record.ideaTodoId)?.text || '未关联';
});

function openTodo(todoId: string) {
  void router.push(withReturnTo(route, { path: '/todos', query: { todo: todoId } }));
}

function openRecord(recordId: string) {
  const record = lifePlan.data.records.find(item => item.id === recordId);
  dashboardPreviewRecord.value = record ? record as RecordEntity : null;
}

function closeDashboardPreview() {
  dashboardPreviewRecord.value = null;
}

function editDashboardPreview() {
  const recordId = dashboardPreviewRecord.value?.id;
  closeDashboardPreview();
  if (recordId) void router.push(withReturnTo(route, { path: '/records', query: { record: recordId } }));
}

function analyzeDashboardDiary() {
  const recordId = dashboardPreviewRecord.value?.id;
  closeDashboardPreview();
  if (recordId) {
    aiDiaryReviewId.value = recordId;
    showAiDiaryReview.value = true;
  }
}

function advanceDashboardIdea() {
  const record = dashboardPreviewRecord.value;
  if (!record) return;
  closeDashboardPreview();
  if (record.ideaTodoId && lifePlan.data.todos.some(todo => todo.id === record.ideaTodoId)) {
    openTodo(record.ideaTodoId);
    return;
  }
  void router.push(withReturnTo(route, { path: '/todos', query: { ideaDraft: record.id } }));
}

function openScheduleItem(item: ScheduleItem) {
  if (item.sourceType === 'record') openRecord(item.id);
  if (item.sourceType.startsWith('todo-')) openTodo(item.id);
  if (item.sourceType === 'habit') void router.push(withReturnTo(route, { path: '/habits', query: { habit: item.id } }));
}

function openMaterial(materialId: string) {
  void router.push(withReturnTo(route, { path: '/materials', query: { material: materialId } }));
}

function normalizeMaterialText(value: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function materialDisplayTitle(material: MaterialEntity) {
  const explicit = normalizeMaterialText(material.title);
  if (explicit) return explicit;
  const clean = normalizeMaterialText(material.content);
  return clean.length > 42 ? `${clean.slice(0, 41).trimEnd()}…` : clean || '空素材';
}

function normalizeMaterialTags(material: MaterialEntity) {
  return Array.from(new Set((Array.isArray(material.tags) ? material.tags : []).map(tag => String(tag || '').trim()).filter(Boolean)));
}

function isDashboardMaterialLong(material: MaterialEntity) {
  return materialDisplayTitle(material).length > 46
    || normalizeMaterialText(material.content).length > 110
    || normalizeMaterialText(material.source).length > 54
    || normalizeMaterialText(material.note).length > 72;
}

function isDashboardMaterialExpanded(materialId: unknown) {
  return expandedMaterialIds.value.includes(String(materialId || ''));
}

function toggleDashboardMaterial(materialId: unknown) {
  const id = String(materialId || '');
  if (!id) return;
  expandedMaterialIds.value = isDashboardMaterialExpanded(id)
    ? expandedMaterialIds.value.filter(item => item !== id)
    : [...expandedMaterialIds.value, id];
}

function openCreateRecord() {
  showCreateRecord.value = true;
}

function createRecordOfType(type: string) {
  createModal.value?.openWithType(type);
}

function openExistingFromCreate(recordId: string) {
  void router.push(withReturnTo(route, { path: '/records', query: { record: recordId } }));
}

function openAi(mode: 'todayPlan' | 'chatCapture') {
  aiAssistantMode.value = mode;
  showAiAssistant.value = true;
}

function createTodo() {
  showTodoAssistant.value = true;
}

function setFloatingMode(mode: FloatingMode) {
  floatingMode.value = mode;
  if (mode === 'random') floatingSampleNonce.value += 1;
}

function seededFloatingValue(id: string, nonce: number) {
  let value = nonce ^ 0x9e3779b9;
  for (let index = 0; index < id.length; index += 1) {
    value = Math.imul(value ^ id.charCodeAt(index), 0x45d9f3b);
    value ^= value >>> 16;
  }
  return value >>> 0;
}

const notice = ref('');
const noticeVariant = ref<'success' | 'warning'>('success');

function announce(message: string, variant: 'success' | 'warning' = 'success') {
  notice.value = message;
  noticeVariant.value = variant;
}

function toggleTodo(todoId: string) {
  try {
    todosStore.toggle(todoId);
    const todo = lifePlan.data.todos.find(item => item.id === todoId);
    announce(todo?.done ? `已标记完成「${todo.text || '待办'}」` : `已恢复「${todo?.text || '待办'}」为未完成`);
  } catch (error) {
    announce(error instanceof Error ? error.message : String(error), 'warning');
  }
}

function planTodayFromDashboard(todoId: string) {
  try {
    const changed = todosStore.planForToday(todoId);
    if (!changed) {
      announce('待办不存在', 'warning');
      return;
    }
    const todo = lifePlan.data.todos.find(item => item.id === todoId);
    announce(`已将「${todo?.text || '待办'}」加入今日计划`);
  } catch (error) {
    announce(error instanceof Error ? error.message : String(error), 'warning');
  }
}

function quickSessionFromDashboard(todoId: string) {
  try {
    todosStore.quickSession(todoId);
    const todo = lifePlan.data.todos.find(item => item.id === todoId);
    announce(`已为「${todo?.text || '待办'}」记录一次执行`);
  } catch (error) {
    announce(error instanceof Error ? error.message : String(error), 'warning');
  }
}

function startFitnessSuggestion() {
  const planId = String(fitnessSuggestion.value?.id || '');
  if (!planId) {
    void router.push('/fitness');
    return;
  }
  try {
    fitnessStore.startFromPlan(planId);
    announce(`已开始：${fitnessSuggestion.value?.name || '训练计划'}`);
    void router.push('/fitness');
  } catch (error) {
    announce(error instanceof Error ? error.message : String(error), 'warning');
  }
}

function openHabit(habitId: string) {
  void router.push(withReturnTo(route, { path: '/habits', query: { habit: habitId } }));
}

function completeDashboardHabitCheckin(habitId: string, note = '') {
  if (!habitsStore.quickCheckin(habitId, note)) {
    announce(habitsStore.lastError || '打卡失败', 'warning');
    return false;
  }
  announce(habitsStore.lastAction || '已打卡');
  return true;
}

function openHabitCheckinNote(habitId: string) {
  const habit = habitsStore.habits.find(item => item.id === habitId);
  if (!habit) {
    announce('未找到该习惯，未打卡', 'warning');
    return;
  }
  habitCheckinNoteForm.mode = 'create';
  habitCheckinNoteForm.checkinId = '';
  habitCheckinNoteForm.habitId = habit.id;
  habitCheckinNoteForm.habitName = habit.name || '未命名习惯';
  habitCheckinNoteForm.note = '';
  habitCheckinNoteForm.disableFuturePrompt = false;
  showHabitCheckinNote.value = true;
}

function openHabitNoteEdit(habitId: string) {
  const habit = habitsStore.habits.find(item => item.id === habitId);
  const latest = habitsStore.getCheckins(habitId, today.value).slice(-1)[0] as Record<string, any> | undefined;
  if (!habit || !latest) return;
  habitCheckinNoteForm.mode = 'edit';
  habitCheckinNoteForm.checkinId = String(latest.id || '');
  habitCheckinNoteForm.habitId = habit.id;
  habitCheckinNoteForm.habitName = habit.name || '未命名习惯';
  habitCheckinNoteForm.note = String(latest.note || '');
  habitCheckinNoteForm.disableFuturePrompt = false;
  showHabitCheckinNote.value = true;
}

function closeHabitCheckinNote() {
  showHabitCheckinNote.value = false;
  habitCheckinNoteForm.mode = 'create';
  habitCheckinNoteForm.checkinId = '';
  habitCheckinNoteForm.habitId = '';
  habitCheckinNoteForm.habitName = '';
  habitCheckinNoteForm.note = '';
  habitCheckinNoteForm.disableFuturePrompt = false;
}

function submitHabitCheckinNote(saveNote: boolean) {
  if (habitCheckinNoteForm.mode === 'edit') {
    if (!habitsStore.editCheckinNote(habitCheckinNoteForm.checkinId, saveNote ? habitCheckinNoteForm.note : '')) {
      announce(habitsStore.lastError || '备注保存失败', 'warning');
      return;
    }
    announce(habitsStore.lastAction || '打卡备注已保存');
    closeHabitCheckinNote();
    return;
  }
  const habitId = habitCheckinNoteForm.habitId;
  if (!habitId) return;
  if (!completeDashboardHabitCheckin(habitId, saveNote ? habitCheckinNoteForm.note : '')) return;
  if (habitCheckinNoteForm.disableFuturePrompt) habitsStore.setHabitNoteMode(habitId, 'never');
  closeHabitCheckinNote();
}

function quickHabitCheckin(habitId: string) {
  const habit = habitsStore.habits.find(item => item.id === habitId);
  if (!habit) {
    announce('未找到该习惯，未打卡', 'warning');
    return;
  }
  if (habit.noteMode !== 'never') {
    openHabitCheckinNote(habitId);
    return;
  }
  if (!habitsStore.quickCheckin(habitId)) {
    announce(habitsStore.lastError || '打卡失败', 'warning');
    return;
  }
  announce(habitsStore.lastAction || '已打卡');
}

function quickHabitCheckinWithNote(habitId: string) {
  openHabitCheckinNote(habitId);
}

function editLatestHabitNote(habitId: string) {
  const latest = habitsStore.getCheckins(habitId, today.value).slice(-1)[0];
  if (!latest) {
    quickHabitCheckinWithNote(habitId);
    return;
  }
  openHabitNoteEdit(habitId);
}

function undoHabitCheckin(habitId: string, requireConfirmation = false) {
  if (requireConfirmation) {
    const habit = habitsStore.habits.find(item => item.id === habitId);
    if (!window.confirm(`确认要减少【${habit?.name || '该习惯'}】${today.value} 的打卡次数吗？`)) return;
  }
  if (!habitsStore.undoLatestCheckin(habitId, today.value)) {
    announce(habitsStore.lastError || '撤销失败', 'warning');
    return;
  }
  announce(habitsStore.lastAction || '已撤销');
}

function sampleMaterials(items: MaterialEntity[], count: number) {
  const pool = [...items];
  for (let index = 0; index < Math.min(count, pool.length); index += 1) {
    const swapIndex = index + Math.floor(Math.random() * (pool.length - index));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }
  return pool.slice(0, count);
}

const todayRelevantTodos = computed(() => lifePlan.data.todos.filter(isTodoRelevantToday));
const todayTodoDone = computed(() => todayRelevantTodos.value.filter(todo => todo.done).length);
const todayTodos = computed(() => todayRelevantTodos.value
  .filter(todo => !todo.done)
  .sort(todosStore.services.todos.compareTodosForFocus)
  .slice(0, 8));
const floatingTodoPool = computed(() => lifePlan.data.todos
  .filter(todo => !todo.done && !todo.dueDate && !todo.planStartDate && !todo.planEndDate));
const floatingTodos = computed(() => {
  const pool = [...floatingTodoPool.value];
  if (floatingMode.value === 'newest') {
    return pool
      .sort((a, b) => String(b.createdAt || b.updatedAt || b.id || '').localeCompare(String(a.createdAt || a.updatedAt || a.id || '')))
      .slice(0, 5);
  }
  if (floatingMode.value === 'oldest') {
    return pool
      .sort((a, b) => String(a.createdAt || a.updatedAt || a.id || '').localeCompare(String(b.createdAt || b.updatedAt || b.id || '')))
      .slice(0, 5);
  }
  const ordered = pool.sort((a, b) => seededFloatingValue(String(a.id), 0) - seededFloatingValue(String(b.id), 0));
  if (ordered.length <= 5) return ordered;
  const offset = floatingSampleNonce.value % ordered.length;
  return [...ordered.slice(offset), ...ordered.slice(0, offset)].slice(0, 5);


});
const dueHabits = computed(() => habitsStore.habits.filter(habit => habitsStore.isHabitDueOnDate(habit, today.value)));
const todayHabitItems = computed(() => dueHabits.value.map(habit => {
  const count = habitsStore.getCheckinCount(habit.id, today.value);
  const target = habitsStore.targetCount(habit);
  return {
    habit,
    count,
    target,
    done: count >= target,
    canCheckin: !(target === 1 && count > 0),
    statusText: count === 0 ? '待开始' : count >= target ? '今日达标' : `进行中 ${count}/${target}`,
    ruleText: habitRuleText(habit),
    checkinTimeText: habitCheckinTimeText(habit.id),
    rewardText: habitRewardText(habit),
    penaltyText: habitPenaltyText(habit),
    noteText: habitCheckinNoteText(habit.id),
  };
}));
const doneHabitCount = computed(() => dueHabits.value.filter(habit => habitsStore.getCheckinCount(habit.id, today.value) > 0).length);
const fitnessOverview = computed(() => fitnessStore.services.fitness.buildFitnessOverview({
  bodyMetrics: fitnessStore.metrics,
  fitnessPlans: fitnessStore.plans,
  fitnessWorkouts: fitnessStore.workouts,
}) as Record<string, any>);
const fitnessWorkoutCount = computed(() => Number(fitnessOverview.value.workoutSummary?.doneCount || 0));
const fitnessStreak = computed(() => Number(fitnessOverview.value.workoutSummary?.streak || 0));
const fitnessWeightText = computed(() => fitnessStore.services.fitness.formatMetricValue(fitnessOverview.value.latestMetric?.weight, 'kg'));
const fitnessPlanCount = computed(() => Number(fitnessOverview.value.activePlanCount || 0));
const fitnessSuggestion = computed(() => fitnessOverview.value.suggestion?.plan || null);
const fitnessLatestText = computed(() => {
  const latest = fitnessOverview.value.latestWorkout;
  if (!latest) return '暂无训练记录';
  return `${formatDate(latest.date)} · ${fitnessStore.services.fitness.getWorkoutTitle(latest)}`;
});
const activeGoals = computed(() => lifePlan.data.goals.filter(goal => goal.status === '进行中'));
const weekStart = computed(() => {
  const date = new Date(`${today.value}T12:00:00`);
  date.setDate(date.getDate() - ((date.getDay() || 7) - 1));
  return date.toISOString().slice(0, 10);
});
const weekRecords = computed(() => lifePlan.data.records.filter(record => entityString(record, 'startDate') >= weekStart.value).length);
const nextTodo = computed(() => lifePlan.data.todos.filter(todo => !todo.done).sort(todosStore.services.todos.compareTodosForFocus)[0]);
const ideas = computed(() => lifePlan.data.records.filter(record => record.type === '灵感碎片'));
const unprocessedIdeas = computed(() => ideas.value.filter(recordsStore.services.records.isIdeaUnprocessed));
const needsConclusionIdeas = computed(() => ideas.value.filter(recordsStore.services.records.ideaNeedsConclusion));
const urgentTodos = computed(() => lifePlan.data.todos
  .filter(todo => !todo.done && (isTodoOverdue(todo) || ['urgent', 'high'].includes(todo.urgency)))
  .sort(todosStore.services.todos.compareTodosForFocus)
  .slice(0, 4));
const materialPicks = computed(() => sampleMaterials(lifePlan.data.materials as MaterialEntity[], 2));
const goalFocusList = computed(() => [...activeGoals.value]
  .sort((a, b) => Number(b.progress || 0) - Number(a.progress || 0))
  .slice(0, 3));
const activePeriods = computed(() => lifePlan.data.records
  .filter(record => periodTypes.includes(entityString(record, 'type')) && (!entityString(record, 'endDate') || entityString(record, 'endDate') >= today.value))
  .sort((a, b) => (entityString(a, 'endDate') || '9999-12-31').localeCompare(entityString(b, 'endDate') || '9999-12-31')));
const timelineGroups = computed(() => {
  const days = Math.max(7, Number(timelineRangeDays.value) || 30);
  const startDate = addDays(today.value, -(days - 1));
  const items = buildScheduleItems(lifePlan.data, startDate, today.value, {
    includeRecords: true,
    includeTodos: true,
    includeHabits: true,
    includeTodoPlans: false,
    includeTodoDue: false,
    includeTodoSessions: true,
  });
  const groups = new Map<string, ScheduleItem[]>();
  items.forEach(item => {
    if (!groups.has(item.date)) groups.set(item.date, []);
    groups.get(item.date)?.push(item);
  });
  return [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, values]) => ({ date, items: sortScheduleItems(values, 'desc') }));
});
onMounted(() => {
  document.addEventListener('visibilitychange', handleDashboardVisibility);
  scheduleTodayRefresh();
});

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', handleDashboardVisibility);
  if (todayTimer !== null) clearTimeout(todayTimer);
  todayTimer = null;
});
</script>

<template>
  <section class="page active" id="page-dashboard">
    <PageHeader title="首页仪表盘">
      <template #actions><button class="btn btn-primary" type="button" @click="openCreateRecord">+ 新建记录</button></template>
    </PageHeader>

    <div v-if="notice" class="notice" :class="noticeVariant" role="status">{{ notice }}</div>

    <div class="dashboard-hero">
      <div class="hero-panel">
        <div>
          <div class="hero-date">{{ todayLabel }}</div>
          <button v-if="nextTodo" class="hero-title hero-title-button" type="button" :aria-label="`打开首要待办 ${nextTodo.text}`" @click="openTodo(nextTodo.id)">今天先处理：{{ nextTodo.text }}</button>
          <h1 v-else class="hero-title">今天先把最重要的事推进一点</h1>
          <div class="hero-meta">
            <span>待办 {{ todayTodoDone }}/{{ todayRelevantTodos.length }}</span>
            <span>习惯 {{ doneHabitCount }}/{{ dueHabits.length }}</span>
            <span>进行中目标 {{ activeGoals.length }}</span>
            <span>本周记录 {{ weekRecords }}</span>
            <span>近30天训练 {{ fitnessWorkoutCount }}</span>
            <span>连续训练 {{ fitnessStreak }} 天</span>
          </div>
        </div>
        <div class="quick-create">
          <button class="btn" type="button" @click="createRecordOfType('日计划')">新建日计划</button>
          <button class="btn" type="button" @click="createRecordOfType('日记')">写日记</button>
          <button class="btn" type="button" @click="createRecordOfType('工作记录')">记工作</button>
          <button class="btn" type="button" @click="createRecordOfType('灵感碎片')">记灵感</button>
          <button class="btn" type="button" @click="createTodo">加待办</button>
          <button class="btn" type="button" @click="openAi('todayPlan')">AI 今日计划</button>
          <button class="btn" type="button" @click="openAi('chatCapture')">AI 对话整理</button>
        </div>
      </div>
      <div class="summary-grid">
        <div class="summary-card"><strong class="summary-value">{{ todayTodoDone }}/{{ todayRelevantTodos.length }}</strong><span class="summary-label">今日待办</span></div>
        <div class="summary-card"><strong class="summary-value">{{ doneHabitCount }}/{{ dueHabits.length }}</strong><span class="summary-label">习惯完成</span></div>
        <div class="summary-card"><strong class="summary-value">{{ activeGoals.length }}</strong><span class="summary-label">进行目标</span></div>
        <div class="summary-card"><strong class="summary-value">{{ weekRecords }}</strong><span class="summary-label">本周记录</span></div>
      </div>
    </div>

    <section class="command-center" aria-label="今日指挥中心">
      <article class="command-card command-card-ideas">
        <div class="command-card-head">
          <div>
            <div class="section-title">今日指挥中心</div>
            <p>先看哪里卡住，再决定下一步。</p>
          </div>
          <button class="btn btn-secondary todo-mini-btn" type="button" @click="router.push('/tags')">标签中心</button>
        </div>
        <div class="command-metric-grid">
          <button class="command-metric" type="button" @click="router.push({ path: '/ideas', query: { status: 'unprocessed' } })"><strong>{{ unprocessedIdeas.length }}</strong><span>未处理灵感</span></button>
          <button class="command-metric" type="button" @click="router.push({ path: '/ideas', query: { status: 'needsConclusion' } })"><strong>{{ needsConclusionIdeas.length }}</strong><span>待写结论</span></button>
          <button class="command-metric" type="button" @click="router.push('/todos')"><strong>{{ urgentTodos.length }}</strong><span>高压待办</span></button>
        </div>
        <div v-if="urgentTodos.length" class="command-list">
          <button v-for="todo in urgentTodos" :key="todo.id" class="command-row" type="button" @click="openTodo(todo.id)">
            <span>{{ todo.text || '未命名待办' }}</span>
            <strong>{{ urgencyLabels[todo.urgency] }}</strong>
          </button>
        </div>
        <EmptyState v-else class="empty-state compact-empty">暂时没有超期或高优先级待办</EmptyState>
      </article>

      <article class="command-card command-card-fitness">
        <div class="command-card-head">
          <div>
            <div class="section-title">运动健身</div>
            <p>把身材变化和训练节奏放到今天的视野里。</p>
          </div>
          <button class="btn btn-secondary todo-mini-btn" type="button" @click="startFitnessSuggestion">{{ fitnessSuggestion ? '按计划开练' : '去健身页' }}</button>
        </div>
        <div class="command-metric-grid">
          <button class="command-metric" type="button" @click="router.push('/fitness')"><strong>{{ fitnessWeightText }}</strong><span>当前体重</span></button>
          <button class="command-metric" type="button" @click="router.push('/fitness')"><strong>{{ fitnessWorkoutCount }}</strong><span>近30天训练</span></button>
          <button class="command-metric" type="button" @click="router.push('/fitness')"><strong>{{ fitnessStreak }}</strong><span>连续训练天</span></button>
        </div>
        <div class="command-list">
          <button class="command-row" type="button" @click="router.push('/fitness')">
            <span>{{ fitnessLatestText }}</span>
            <strong>计划 {{ fitnessPlanCount }}</strong>
          </button>
          <button v-if="fitnessSuggestion" class="command-row" type="button" @click="startFitnessSuggestion">
            <span>今日建议：{{ fitnessSuggestion.name }}</span>
            <strong>开练</strong>
          </button>
        </div>
      </article>

      <article class="command-card">
        <div class="command-card-head">
          <div>
            <div class="section-title">随机复习素材</div>
            <p>从素材库随手捞两条，给今天一点燃料。</p>
          </div>
          <button class="btn btn-secondary todo-mini-btn" type="button" @click="router.push('/materials')">去素材库</button>
        </div>
        <div v-if="materialPicks.length" class="command-materials">
          <article v-for="material in materialPicks" :key="String(material.id)" class="material-card compact dashboard-material-card" :class="{ 'is-expanded': isDashboardMaterialExpanded(material.id) }">
            <div class="material-card-head"><span class="material-type">{{ material.type || '素材' }}</span><span>{{ formatStoredDateTime(material.createdAt) }}</span></div>
            <h3 class="material-title">{{ materialDisplayTitle(material) }}</h3>
            <div class="material-card-copy">
              <div class="material-content">{{ material.content || '空素材' }}</div>
              <div v-if="material.source" class="material-meta material-source">来源：{{ material.source }}</div>
              <div v-if="material.note" class="material-meta material-note">备注：{{ material.note }}</div>
            </div>
            <div v-if="normalizeMaterialTags(material).length" class="idea-badge-row"><span v-for="tag in normalizeMaterialTags(material)" :key="tag" class="tag-pill">{{ tag }}</span></div>
            <div class="idea-card-actions material-card-actions">
              <button v-if="isDashboardMaterialLong(material)" class="mini-link material-expand-btn" type="button" :aria-expanded="isDashboardMaterialExpanded(material.id)" @click="toggleDashboardMaterial(material.id)">{{ isDashboardMaterialExpanded(material.id) ? '收起内容' : '展开内容' }}</button>
              <button class="btn btn-secondary todo-mini-btn" type="button" @click="openMaterial(String(material.id))">查看详情</button>
            </div>
          </article>
        </div>
        <EmptyState v-else class="empty-state compact-empty">素材库还没有内容</EmptyState>
      </article>

      <article class="command-card">
        <div class="command-card-head">
          <div>
            <div class="section-title">目标进度</div>
            <p>只看进行中的目标，避免长期目标隐身。</p>
          </div>
          <button class="btn btn-secondary todo-mini-btn" type="button" @click="router.push('/goals')">看目标</button>
        </div>
        <div v-if="goalFocusList.length" class="command-list">
          <button v-for="goal in goalFocusList" :key="String(goal.id)" class="command-row" type="button" @click="router.push(withReturnTo(route, { path: '/goals', query: { goal: String(goal.id) } }))">
            <span>{{ goal.name || '未命名目标' }}</span>
            <strong>{{ Number(goal.progress || 0) }}%</strong>
          </button>
        </div>
        <EmptyState v-else class="empty-state compact-empty">暂无进行中的目标</EmptyState>
      </article>
    </section>

    <div class="card dashboard-today-overview">
      <div class="card-title">今日概览 · {{ todayLabel }}</div>
      <div class="today-grid dashboard-main-grid">
        <section class="dashboard-today-todos" aria-label="今日待办">
          <div class="section-title">今日待办</div>
          <ul v-if="todayTodos.length" class="todo-list">
            <li v-for="todo in todayTodos" :key="todo.id" class="todo-item">
              <input
                class="todo-check"
                type="checkbox"
                :checked="todo.done"
                :aria-label="`完成 ${todo.text}`"
                @change="toggleTodo(todo.id)"
              >
              <button class="todo-text todo-dashboard-link" type="button" :aria-label="todo.text" @click="openTodo(todo.id)">
                {{ todo.text }}<small>{{ getTodayTodoReason(todo) }}</small>
              </button>
              <span class="todo-urgency" :class="`todo-urgency-${todo.urgency}`">{{ urgencyLabels[todo.urgency] }}</span>
              <span class="todo-actions">
                <button class="btn btn-secondary todo-mini-btn" type="button" @click="quickSessionFromDashboard(todo.id)">执行一次</button>
              </span>
            </li>
          </ul>
          <EmptyState v-else class="empty-state">今日暂无待办</EmptyState>
        </section>

        <section class="dashboard-floating-todos" aria-label="无截止待办池" :data-sample-nonce="floatingSampleNonce">
          <div class="section-title-row">
            <div class="section-title">无截止待办池</div>
            <div class="todo-pool-toolbar">
              <button class="btn btn-secondary todo-pool-mode" type="button" :class="{ active: floatingMode === 'random' }" @click="setFloatingMode('random')">随机</button>
              <button class="btn btn-secondary todo-pool-mode" type="button" :class="{ active: floatingMode === 'newest' }" @click="setFloatingMode('newest')">最新</button>
              <button class="btn btn-secondary todo-pool-mode" type="button" :class="{ active: floatingMode === 'oldest' }" @click="setFloatingMode('oldest')">最老</button>
            </div>
          </div>
          <ul v-if="floatingTodos.length" class="todo-list">
            <li v-for="todo in floatingTodos" :key="todo.id" class="todo-item">
              <input
                class="todo-check"
                type="checkbox"
                :checked="todo.done"
                :aria-label="`完成 ${todo.text}`"
                @change="toggleTodo(todo.id)"
              >
              <button class="todo-text todo-dashboard-link" type="button" :aria-label="todo.text" @click="openTodo(todo.id)">
                {{ todo.text }}<small>无截止 · 可转入今天</small>
              </button>
              <span class="todo-urgency" :class="`todo-urgency-${todo.urgency}`">{{ urgencyLabels[todo.urgency] }}</span>
              <span class="todo-actions">
                <button class="btn btn-secondary todo-mini-btn" type="button" @click="planTodayFromDashboard(todo.id)">今天做</button>
                <button class="btn btn-secondary todo-mini-btn" type="button" @click="quickSessionFromDashboard(todo.id)">执行一次</button>
              </span>
            </li>
          </ul>
          <div v-if="floatingTodoPool.length > floatingTodos.length" class="todo-pool-hint">还有 {{ floatingTodoPool.length - floatingTodos.length }} 条无截止待办没展示</div>
          <EmptyState v-if="!floatingTodos.length" class="empty-state">暂无无截止待办</EmptyState>
        </section>

        <section class="dashboard-today-habits" aria-label="今日习惯">
          <div class="section-title">今日习惯快捷打卡</div>
          <div v-if="todayHabitItems.length" class="habit-quick-list dashboard-habit-list">
            <article v-for="item in todayHabitItems" :key="item.habit.id" class="todo-item dashboard-habit-item habit-quick-card compact" :class="{ done: item.count > 0, multi: item.target > 1 }">
              <div class="habit-quick-head">
                <div class="habit-quick-main">
                  <button class="habit-quick-open" type="button" :aria-label="item.habit.name" @click="openHabit(item.habit.id)">
                    <span class="habit-quick-title-row">
                      <span class="habit-quick-title">{{ item.habit.name }}</span>
                      <span class="habit-quick-tag">{{ item.habit.tag || '习惯' }}</span>
                      <span class="habit-quick-status" :class="item.count === 0 ? 'is-pending' : item.done ? 'is-done' : 'is-active'">{{ item.statusText }}</span>
                    </span>
                    <span class="habit-quick-meta">
                      <span>{{ item.ruleText }}</span>
                      <span>{{ item.count }}/{{ item.target }}</span>
                      <span>{{ item.checkinTimeText }}</span>
                      <span v-if="item.rewardText" class="is-points">{{ item.rewardText }}</span>
                      <span v-if="item.penaltyText" class="is-penalty">{{ item.penaltyText }}</span>
                    </span>
                    <span v-if="item.noteText" class="habit-quick-note-inline">备注：{{ item.noteText }}</span>
                  </button>
                </div>
                <div class="habit-quick-actions compact">
                  <button
                    class="habit-quick-btn primary"
                    type="button"
                    :disabled="item.target === 1 && item.count > 0 ? false : !item.canCheckin"
                    @click="item.target === 1 && item.count > 0 ? editLatestHabitNote(item.habit.id) : quickHabitCheckin(item.habit.id)"
                  >{{ item.target === 1 && item.count > 0 ? '备注' : '打卡' }}</button>
                  <button
                    class="habit-quick-btn secondary"
                    type="button"
                    :disabled="item.target > 1 ? false : item.count <= 0 && item.habit.noteMode === 'never'"
                    @click="item.target > 1 ? (item.count > 0 ? editLatestHabitNote(item.habit.id) : quickHabitCheckinWithNote(item.habit.id)) : item.count > 0 ? undoHabitCheckin(item.habit.id) : quickHabitCheckinWithNote(item.habit.id)"
                  >{{ item.target > 1 || item.count <= 0 ? '备注' : '撤销' }}</button>
                  <button
                    v-if="item.target > 1 && item.count > 0"
                    class="habit-quick-btn ghost"
                    type="button"
                    @click="undoHabitCheckin(item.habit.id, true)"
                  >-1</button>
                </div>
              </div>
            </article>
          </div>
          <EmptyState v-else class="empty-state">今日暂无安排的习惯</EmptyState>
        </section>
      </div>
    </div>

    <article class="card">
      <h2 class="card-title">进行中的周期记录</h2>
      <div v-if="activePeriods.length">
        <button v-for="record in activePeriods" :key="String(record.id)" class="period-item" type="button" @click="openRecord(String(record.id))">
          <div class="period-info">
            <h4><span class="item-type">{{ record.type }}</span>{{ record.title || '无标题' }}</h4>
            <p>{{ formatDate(record.startDate) }} ~ {{ formatDate(record.endDate) }} · 待办 {{ activeRecordTodos(record).done }}/{{ activeRecordTodos(record).total }}</p>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${activeRecordTodos(record).total ? Math.round(activeRecordTodos(record).done / activeRecordTodos(record).total * 100) : 0}%` }" />
          </div>
        </button>
      </div>
      <EmptyState v-else class="empty-state">暂无进行中的周期记录</EmptyState>
    </article>

    <article class="dashboard-timeline">
      <div class="section-title-row timeline-title-row">
        <h2 class="card-title">近期记录时间轴</h2>
        <AppSelect
          v-model="timelineRangeDays"
          size="compact"
          aria-label="时间轴范围"
          :options="[
            { value: 7, label: '最近7天' },
            { value: 30, label: '最近30天' },
            { value: 90, label: '最近90天' },
          ]"
        />
      </div>
      <div v-if="timelineGroups.length">
        <section v-for="group in timelineGroups" :key="group.date" class="timeline-group">
          <div class="timeline-date">{{ formatDate(group.date) }}</div>
          <div v-for="item in group.items" :key="item.key" class="record-row">
            <div class="record-time">{{ item.allDay ? item.timeLabel : item.timeLabel }}</div>
            <button class="timeline-item" type="button" :style="{ '--event-bg': item.tone.bg, '--event-border': item.tone.border, '--event-ink': item.tone.ink }" @click="openScheduleItem(item)">
              <span class="item-type">{{ item.sourceType === 'habit' ? '习惯' : item.type }}</span>
              <span class="item-title">{{ item.title || '未命名' }}</span>
              <div class="item-meta">
                <span v-if="item.meta">{{ item.meta }}</span>
                <span v-if="item.sourceType === 'habit'">{{ item.timeLabel }}</span>
              </div>
              <div v-if="item.preview" class="item-preview">{{ item.preview }}</div>
            </button>
          </div>
        </section>
      </div>
      <EmptyState v-else class="empty-state">当前范围暂无记录，换个范围或新建第一条吧</EmptyState>
    </article>

    <ModalShell
      v-if="showHabitCheckinNote"
      :model-value="showHabitCheckinNote"
      :title="`${habitCheckinNoteForm.mode === 'edit' ? '编辑备注' : '备注'} · ${habitCheckinNoteForm.habitName}`"
      close-on-backdrop
      size="sm"
      dialog-class="habit-note-modal"
      initial-focus="#dashboard-habit-checkin-note"
      @close="closeHabitCheckinNote"
    >
      <div class="habit-note-field">
      <textarea
        id="dashboard-habit-checkin-note"
        v-model="habitCheckinNoteForm.note"
        rows="3"
        maxlength="120"
        placeholder="这次做了什么？可留空"
      />
      </div>
      <div class="habit-note-foot">
        <label v-if="habitCheckinNoteForm.mode === 'create'" class="habit-note-toggle">
          <input v-model="habitCheckinNoteForm.disableFuturePrompt" type="checkbox">
          <span>以后不提醒</span>
        </label>
        <div class="habit-note-actions">
          <button v-if="habitCheckinNoteForm.mode === 'create'" class="btn btn-secondary" type="button" @click="submitHabitCheckinNote(false)">本次不填</button>
          <button class="btn btn-primary" type="button" @click="submitHabitCheckinNote(true)">保存</button>
        </div>
      </div>
    </ModalShell>

    <ModalShell
      v-if="dashboardPreviewRecord"
      :model-value="Boolean(dashboardPreviewRecord)"
      title="记录详情"
      close-on-backdrop
      size="lg"
      dialog-class="record-preview-modal"
      @close="closeDashboardPreview"
    >
        <div class="record-preview-dialog-body">
          <div class="record-preview-top">
            <span class="item-type">{{ dashboardPreviewRecord.type || '记录' }}</span>
            <div class="record-preview-title">{{ dashboardPreviewRecord.title || '未命名记录' }}</div>
            <div class="record-preview-meta">
              <span>{{ recordsStore.services.records.getRecordDateRangeLabel(dashboardPreviewRecord) }}</span>
              <span>时间 {{ dashboardPreviewRecord.recordTime || '全天' }}<template v-if="dashboardPreviewRecord.recordEndTime"> - {{ dashboardPreviewRecord.recordEndTime }}</template></span>
              <span>待办 {{ dashboardPreviewTodos.filter(todo => todo.done).length }}/{{ dashboardPreviewTodos.length }}</span>
              <span v-if="dashboardPreviewRecord.updatedAt || dashboardPreviewRecord.createdAt">更新于 {{ formatStoredDateTime(dashboardPreviewRecord.updatedAt || dashboardPreviewRecord.createdAt) }}</span>
            </div>
          </div>
          <div class="record-preview-content">
            <div class="record-preview-heading">内容</div>
            <div v-if="dashboardPreviewSections.length">
              <section v-for="section in dashboardPreviewSections" :key="section.title" class="record-preview-section">
                <h4>{{ section.title }}</h4>
                <div class="record-preview-text">{{ section.body.join('\n').trim() || '暂未填写' }}</div>
              </section>
            </div>
            <div v-else class="record-preview-empty">还没有内容</div>
          </div>
          <div v-if="dashboardPreviewRecord.type === '灵感碎片'" class="record-preview-content">
            <div class="record-preview-heading">灵感推进</div>
            <div class="idea-badge-row"><span class="idea-status-badge">{{ dashboardPreviewRecord.ideaStatus || '待整理' }}</span><span v-for="tag in recordsStore.services.records.getIdeaTags(dashboardPreviewRecord)" :key="tag" class="tag-pill">{{ tag }}</span></div>
            <div class="idea-detail-grid dashboard-idea-detail-grid">
              <div><strong>下一步</strong><span>{{ dashboardPreviewRecord.ideaNextAction || '未设置' }}</span></div>
              <div><strong>关联待办</strong><span>{{ dashboardPreviewIdeaTodoText }}</span></div>
              <div class="wide"><strong>结果结论</strong><span>{{ dashboardPreviewRecord.ideaConclusion || '还没有结论' }}</span></div>
            </div>
          </div>
          <div v-if="dashboardPreviewTodos.length" class="record-preview-todos">
            <div class="record-preview-heading">关联待办</div>
            <div v-for="todo in dashboardPreviewTodos" :key="todo.id" class="record-preview-todo-item" :class="{ done: todo.done }">
              <span class="record-preview-dot" /><span>{{ todo.text || '未命名待办' }}</span>
            </div>
          </div>
          <div class="record-preview-actions">
            <button v-if="dashboardPreviewRecord.type === '日记' && dashboardPreviewRecord.content?.trim()" class="btn btn-secondary" type="button" @click="analyzeDashboardDiary">AI 分析日记</button>
            <button v-if="dashboardPreviewRecord.type === '灵感碎片'" class="btn btn-secondary" type="button" @click="advanceDashboardIdea">{{ dashboardPreviewRecord.ideaTodoId && dashboardPreviewTodos.some(todo => todo.id === dashboardPreviewRecord?.ideaTodoId) ? '打开关联待办' : '转成待办' }}</button>
            <button class="btn btn-secondary" type="button" @click="editDashboardPreview">编辑</button>
          </div>
        </div>
    </ModalShell>

    <RecordCreateModal ref="createModal" v-model="showCreateRecord" @open-existing="openExistingFromCreate" />
    <ModalShell v-model="showAiAssistant" :title="aiAssistantMode === 'todayPlan' ? 'AI 今日计划' : 'AI 对话整理'" size="lg" dialog-class="ai-assistant-modal">
      <AiPage :embedded-mode="aiAssistantMode" @close="showAiAssistant = false" />
    </ModalShell>

    <ModalShell v-model="showAiDiaryReview" title="AI 日记分析" size="lg" dialog-class="ai-assistant-modal">
      <AiPage embedded-mode="diaryReview" :embedded-diary-id="aiDiaryReviewId" @close="showAiDiaryReview = false" />
    </ModalShell>
    <TodosPage v-if="showTodoAssistant" embedded-create @close="showTodoAssistant = false" />
  </section>
</template>

<style scoped>
#page-dashboard,
#page-dashboard :where(.dashboard-hero, .hero-panel, .hero-panel > div, .summary-grid, .command-center, .command-card, .command-card-head, .dashboard-main-grid, .card, .period-info, .timeline-group, .record-row) {
  min-width: 0;
}
.hero-title,
.hero-meta span,
.command-card p,
.command-row span,
.command-row strong,
.todo-dashboard-link,
.todo-dashboard-link small,
.period-info h4,
.period-info p,
.item-title,
.item-meta,
.item-preview {
  overflow-wrap: anywhere;
  word-break: break-word;
}
.quick-create,
.command-card-head {
  flex-wrap: wrap;
}
.timeline-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
  flex-wrap: nowrap;
}
.timeline-title-row .card-title {
  min-width: 0;
  margin-bottom: 0;
  white-space: nowrap;
}
.timeline-title-row :deep(.app-select),
.timeline-title-row :deep(.app-control--compact) {
  width: auto;
  min-width: 118px;
  max-width: 148px;
  flex: 0 0 auto;
  min-height: 32px;
  padding: 5px 8px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface-soft);
  box-shadow: 0 2px 8px rgba(60, 55, 40, .06);
}
@media (max-width: 420px) {
  .timeline-title-row {
    gap: 8px;
  }
  .timeline-title-row :deep(.app-select),
  .timeline-title-row :deep(.app-control--compact) {
    min-width: 108px;
    max-width: 136px;
    padding-inline: 7px;
  }
}
.timeline-title-row :deep(.app-select:focus-visible),
.timeline-title-row :deep(.app-control--compact:focus-visible) {
  outline: 3px solid rgba(47, 128, 237, .2);
  outline-offset: 2px;
  border-color: var(--accent-2);
}
.dashboard-main-grid { margin-bottom: 0; }
.command-row span { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; line-height: 1.45; }
.command-row strong { flex: 0 0 auto; }
.hero-title-button { display: -webkit-box; width: 100%; padding: 0; border: 0; background: transparent; color: inherit; text-align: left; cursor: pointer; font-family: inherit; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; }
.dashboard-timeline { min-width: 0; }
.command-materials { display: grid; gap: 9px; }
.dashboard-material-card { min-width: 0; display: flex; flex-direction: column; padding: 14px; border: 1px solid var(--line); border-radius: var(--radius); background: #fbfdfb; box-shadow: 0 12px 26px rgba(35,60,45,.055); }
.dashboard-material-card .material-card-head { display: flex; justify-content: space-between; gap: 8px; align-items: flex-start; margin-bottom: 9px; color: var(--faint); font-size: 12px; font-weight: 750; }
.dashboard-material-card .material-title { margin: 0 0 8px; color: var(--text); font-size: 16px; font-weight: 700; line-height: 1.45; overflow-wrap: anywhere; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; }
.dashboard-material-card .material-card-copy { min-width: 0; }
.dashboard-material-card .material-content { color: var(--text); font-size: 13px; font-weight: 650; line-height: 1.7; white-space: pre-line; overflow-wrap: anywhere; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; }
.dashboard-material-card .material-meta { margin-top: 8px; color: var(--muted); font-size: 12px; line-height: 1.55; overflow-wrap: anywhere; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; }
.dashboard-material-card .material-source { -webkit-line-clamp: 1; line-clamp: 1; }
.dashboard-material-card.is-expanded .material-title,
.dashboard-material-card.is-expanded .material-content,
.dashboard-material-card.is-expanded .material-meta { display: block; max-height: none; overflow: visible; -webkit-line-clamp: unset; line-clamp: unset; }
.dashboard-material-card .material-card-actions { display: flex; justify-content: flex-end; gap: 7px; flex-wrap: wrap; align-items: center; margin-top: auto; padding-top: 12px; }
.dashboard-material-card .material-expand-btn { margin: 0 auto 0 0; padding: 0; border: 0; background: transparent; color: var(--primary); cursor: pointer; font: inherit; font-size: 12px; font-weight: 800; }
.todo-list { display: grid; gap: 0; padding: 0; margin: 0; list-style: none; }
.todo-pool-hint { margin-top: 8px; color: var(--faint); font-size: 12px; }
.todo-item {
  display: flex;
  font-size: 14px;
  gap: 9px;
  align-items: center;
  min-width: 0;
  padding: 7px 0;
}
.todo-check { width: 16px; height: 16px; margin: 0; flex: 0 0 auto; }
.todo-dashboard-link { display: -webkit-box; width: 100%; min-width: 0; text-align: left; line-height: 1.45; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; }
.todo-dashboard-link small { display: block; margin-top: 3px; color: var(--faint); font-size: 12px; font-weight: 650; line-height: 1.45; }
.habit-quick-list { display: grid; gap: 8px; }
.dashboard-habit-item { min-width: 0; }
.dashboard-habit-item .habit-quick-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; min-width: 0; }
.dashboard-habit-item .habit-quick-main { min-width: 0; flex: 1 1 auto; overflow: hidden; }
.habit-quick-open { display: block; width: 100%; min-width: 0; padding: 0; border: 0; background: transparent; text-align: left; color: inherit; cursor: pointer; font: inherit; }
.dashboard-habit-item .habit-quick-actions { display: flex; flex-wrap: wrap; gap: 6px; flex: 0 1 auto; justify-content: flex-end; align-items: center; max-width: 100%; }
.todo-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;

  min-width: 0;
}
.dashboard-habit-item .todo-dashboard-link small {
  color: var(--faint);
}
@media (min-width: 720px) {
  .todo-actions { justify-content: flex-end; }
}
.period-item { width: 100%; min-width: 0; text-align: left; }
.period-info { min-width: 0; }
.period-info h4 { display: -webkit-box; min-width: 0; line-height: 1.45; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; }
.period-info h4 .item-type { margin-right: 8px; }
.progress-bar { min-width: 0; }
.timeline-item { width: 100%; min-width: 0; text-align: left; }
.item-title { display: -webkit-box; line-height: 1.45; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; }
.item-preview { margin-top: 9px; max-width: 78ch; color: var(--muted); font-size: 13px; line-height: 1.75; white-space: pre-wrap; overflow-wrap: anywhere; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; }
:global(.habit-note-modal) { width: min(430px, 100%); padding: 18px; border-radius: 22px; background: linear-gradient(180deg, #ffffff, #f8fbf8); }
:global(.habit-note-modal .modal-header) { margin-bottom: 12px; }
:global(.habit-note-modal .modal-title) { font-size: 17px; letter-spacing: -.02em; }
.habit-note-field { margin-bottom: 10px; }
.habit-note-modal textarea { width: 100%; min-height: 96px; padding: 13px 14px; border: 1px solid #cbded1; border-radius: 16px; background: #fff; resize: vertical; font-size: 14px; line-height: 1.7; }
.habit-note-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.habit-note-toggle { display: inline-flex; align-items: center; gap: 7px; color: #607166; font-size: 12px; font-weight: 800; cursor: pointer; }
.habit-note-toggle input { width: 16px; height: 16px; accent-color: var(--accent); }
.habit-note-actions { display: flex; align-items: center; justify-content: flex-end; gap: 10px; }
.habit-note-actions .btn { min-height: 34px; padding: 0 16px; border-radius: 999px; font-size: 13px; }
.record-preview-modal { max-width: 880px; }
.record-preview-dialog-body { display: grid; gap: 16px; padding-bottom: 15px; }
.dashboard-idea-detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; margin-top: 10px; }
.dashboard-idea-detail-grid > div { display: grid; gap: 4px; padding: 10px; border: 1px solid #e0e9e3; border-radius: var(--radius); background: rgba(255,255,255,.75); }
.dashboard-idea-detail-grid > .wide { grid-column: 1 / -1; }
.dashboard-idea-detail-grid strong { color: var(--text); font-size: 12px; }
.dashboard-idea-detail-grid span { color: var(--muted); font-size: 12px; line-height: 1.55; overflow-wrap: anywhere; }
@media (max-width: 640px) {
  .dashboard-habit-item .habit-quick-head { flex-direction: column; align-items: stretch; }
  .dashboard-habit-item .habit-quick-actions { justify-content: flex-start; width: 100%; }
  .dashboard-idea-detail-grid { grid-template-columns: minmax(0, 1fr); }
  .dashboard-idea-detail-grid > .wide { grid-column: auto; }
}
@media (max-width: 980px) {
  .command-center { grid-template-columns: minmax(0, 1fr); }
  .today-grid { grid-template-columns: minmax(0, 1fr); }
}
</style>
