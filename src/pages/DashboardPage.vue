<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

import RecordCreateModal from '../components/RecordCreateModal.vue';
import { getTodayStr } from '../services/legacyServices';
import { useFitnessStore } from '../stores/fitnessStore';
import { useHabitsStore } from '../stores/habitsStore';
import { useLifePlanStore } from '../stores/lifePlanStore';
import { useRecordsStore } from '../stores/recordsStore';
import { useTodosStore } from '../stores/todosStore';
import type { DataEntity, Todo } from '../types/lifePlan';
import { addDays, buildScheduleItems, sortScheduleItems, type ScheduleItem } from '../utils/schedule';

type MaterialEntity = DataEntity & { id?: string; content?: string; type?: string; tags?: string[]; source?: string; note?: string; createdAt?: string };
type FloatingMode = 'random' | 'newest' | 'oldest';

const router = useRouter();
const lifePlan = useLifePlanStore();
const recordsStore = useRecordsStore();
const todosStore = useTodosStore();
const habitsStore = useHabitsStore();
const fitnessStore = useFitnessStore();
const today = getTodayStr();
const todayLabel = formatLongDate(today);
const showCreateRecord = ref(false);
const createModal = ref<InstanceType<typeof RecordCreateModal> | null>(null);
const floatingMode = ref<FloatingMode>('random');
const timelineRangeDays = ref(30);
const periodTypes = ['周复盘', '月复盘', '年复盘', '周计划', '月计划', '年度计划', '3年计划', '终身愿景'];
const urgencyLabels: Record<Todo['urgency'], string> = { urgent: '紧急', high: '高', medium: '中', low: '低' };

function isTodoPlannedOnDate(todo: Todo, date: string) {
  return Boolean(todo.planStartDate && todo.planEndDate && todo.planStartDate <= date && todo.planEndDate >= date);
}

function hasTodoSessionOnDate(todo: Todo, date: string) {
  return (todo.sessions || []).some(session => session.date === date);
}

function isTodoOverdue(todo: Todo, date = today) {
  return Boolean(!todo.done && todo.dueDate && todo.dueDate < date);
}

function getTodoOverdueDays(todo: Todo, date = today) {
  if (!isTodoOverdue(todo, date)) return 0;
  const diff = new Date(`${date}T12:00:00`).getTime() - new Date(`${todo.dueDate}T12:00:00`).getTime();
  return Math.max(1, Math.floor(diff / 86_400_000));
}

function isTodoRelevantToday(todo: Todo) {
  return isTodoOverdue(todo) || todo.dueDate === today || isTodoPlannedOnDate(todo, today) || hasTodoSessionOnDate(todo, today);
}

function getTodayTodoReason(todo: Todo) {
  const reasons = [];
  if (isTodoOverdue(todo)) reasons.push(`已超期 ${getTodoOverdueDays(todo)} 天`);
  if (isTodoPlannedOnDate(todo, today)) reasons.push('计划中');
  if (todo.dueDate === today) reasons.push('今天截止');
  if (hasTodoSessionOnDate(todo, today)) reasons.push('今天已记录');
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
  const checkins = habitsStore.getCheckins(habitId, today).slice().sort((a: Record<string, any>, b: Record<string, any>) => {
    const sortKey = (checkin: Record<string, any>) => String(checkin.checkinAt || (checkin.time ? `${today}T${checkin.time}:00` : checkin.createdAt || ''));
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

function openTodo(todoId: string) {
  void router.push({ path: '/todos', query: { todo: todoId } });
}

function openRecord(recordId: string) {
  void router.push({ path: '/records', query: { record: recordId, preview: '1' } });
}

function openScheduleItem(item: ScheduleItem) {
  if (item.sourceType === 'record') openRecord(item.id);
  if (item.sourceType.startsWith('todo-')) openTodo(item.id);
  if (item.sourceType === 'habit') void router.push({ path: '/habits', query: { habit: item.id } });
}

function openMaterial(materialId: string) {
  void router.push({ path: '/materials', query: { material: materialId } });
}

function openCreateRecord() {
  showCreateRecord.value = true;
}

function createRecordOfType(type: string) {
  createModal.value?.openWithType(type);
}

function openExistingFromCreate(recordId: string) {
  openRecord(recordId);
}

function openAi(mode: string) {
  void router.push({ path: '/ai', query: { mode } });
}

function setFloatingMode(mode: FloatingMode) {
  floatingMode.value = mode;
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
  void router.push({ path: '/habits', query: { habit: habitId } });
}

function quickHabitCheckin(habitId: string) {
  if (!habitsStore.quickCheckin(habitId)) {
    announce(habitsStore.lastError || '打卡失败', 'warning');
    return;
  }
  announce(habitsStore.lastAction || '已打卡');
}

function quickHabitCheckinWithNote(habitId: string) {
  const note = window.prompt('打卡备注', '');
  if (note === null) return;
  if (!habitsStore.quickCheckin(habitId, note)) {
    announce(habitsStore.lastError || '打卡失败', 'warning');
    return;
  }
  announce(habitsStore.lastAction || '已打卡');
}

function editLatestHabitNote(habitId: string) {
  const latest = habitsStore.getCheckins(habitId, today).slice(-1)[0];
  if (!latest) {
    quickHabitCheckinWithNote(habitId);
    return;
  }
  const note = window.prompt('编辑打卡备注', String(latest.note || ''));
  if (note === null) return;
  if (!habitsStore.editCheckinNote(latest.id, note)) {
    announce(habitsStore.lastError || '备注保存失败', 'warning');
    return;
  }
  announce(habitsStore.lastAction || '打卡备注已保存');
}

function undoHabitCheckin(habitId: string) {
  if (!habitsStore.undoLatestCheckin(habitId)) {
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
  for (let index = 0; index < Math.min(5, pool.length); index += 1) {
    const swapIndex = index + Math.floor(Math.random() * (pool.length - index));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }
  return pool.slice(0, 5);
});
const dueHabits = computed(() => habitsStore.todayHabits);
const todayHabitItems = computed(() => dueHabits.value.map(habit => {
  const count = habitsStore.getCheckinCount(habit.id, today);
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
const doneHabitCount = computed(() => dueHabits.value.filter(habit => habitsStore.getCheckinCount(habit.id, today) > 0).length);
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
  const date = new Date(`${today}T12:00:00`);
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
  .filter(record => periodTypes.includes(entityString(record, 'type')) && (!entityString(record, 'endDate') || entityString(record, 'endDate') >= today))
  .sort((a, b) => (entityString(a, 'endDate') || '9999-12-31').localeCompare(entityString(b, 'endDate') || '9999-12-31')));
const timelineGroups = computed(() => {
  const days = Math.max(7, Number(timelineRangeDays.value) || 30);
  const startDate = addDays(today, -(days - 1));
  const items = buildScheduleItems(lifePlan.data, startDate, today, {
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
    .map(([date, values]) => ({ date, items: sortScheduleItems(values, 'asc') }));
});
</script>

<template>
  <section class="page active" id="page-dashboard">
    <header class="page-header">
      <div class="page-title">首页仪表盘</div>
      <button class="btn btn-primary" type="button" @click="openCreateRecord">+ 新建记录</button>
    </header>

    <div v-if="notice" class="notice" :class="noticeVariant" role="status">{{ notice }}</div>

    <div class="dashboard-hero">
      <div class="hero-panel">
        <div>
          <div class="hero-date">{{ todayLabel }}</div>
          <h1 class="hero-title">{{ nextTodo ? `今天先处理：${nextTodo.text}` : '今天先把最重要的事推进一点' }}</h1>
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
          <button class="btn" type="button" @click="router.push('/todos')">加待办</button>
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
        <div v-else class="empty-state compact-empty">暂时没有超期或高优先级待办</div>
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
          <button v-for="material in materialPicks" :key="String(material.id)" class="command-row" type="button" @click="openMaterial(String(material.id))">
            <span class="dashboard-material-copy">
              <span>{{ material.content || '空素材' }}</span>
              <span class="dashboard-material-details">
                {{ formatStoredDateTime(material.createdAt) }}
                <template v-if="material.tags?.length"> · {{ material.tags.join(' · ') }}</template>
                <template v-if="material.source"> · 来源：{{ material.source }}</template>
                <template v-if="material.note"> · 备注：{{ material.note }}</template>
              </span>
            </span>
            <strong>{{ material.type || '素材' }}</strong>
          </button>
        </div>
        <div v-else class="empty-state compact-empty">素材库还没有内容</div>
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
          <button v-for="goal in goalFocusList" :key="String(goal.id)" class="command-row" type="button" @click="router.push({ path: '/goals', query: { goal: String(goal.id) } })">
            <span>{{ goal.name || '未命名目标' }}</span>
            <strong>{{ Number(goal.progress || 0) }}%</strong>
          </button>
        </div>
        <div v-else class="empty-state compact-empty">暂无进行中的目标</div>
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
          <div v-else class="empty-state">今日暂无待办</div>
        </section>

        <section class="dashboard-floating-todos" aria-label="无截止待办池">
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
          <div v-else class="empty-state">暂无无截止待办</div>
        </section>

        <section class="dashboard-today-habits" aria-label="今日习惯">
          <div class="section-title">今日习惯快捷打卡</div>
          <ul v-if="todayHabitItems.length" class="todo-list dashboard-habit-list">
            <li v-for="item in todayHabitItems" :key="item.habit.id" class="todo-item dashboard-habit-item habit-quick-card compact" :class="{ done: item.count > 0, multi: item.target > 1 }">
              <button class="todo-text todo-dashboard-link" type="button" :aria-label="item.habit.name" @click="openHabit(item.habit.id)">
                <span class="habit-quick-title-row">
                  <span class="habit-quick-title">{{ item.habit.name }}</span>
                  <span class="habit-quick-tag">{{ item.habit.tag || '习惯' }}</span>
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
              <span class="habit-quick-status" :class="item.count === 0 ? 'is-pending' : item.done ? 'is-done' : 'is-active'">{{ item.statusText }}</span>
              <span class="todo-actions">
                <button
                  class="btn btn-secondary todo-mini-btn"
                  type="button"
                  :disabled="item.target === 1 && item.count > 0 ? false : !item.canCheckin"
                  @click="item.target === 1 && item.count > 0 ? editLatestHabitNote(item.habit.id) : quickHabitCheckin(item.habit.id)"
                >{{ item.target === 1 && item.count > 0 ? '备注' : '打卡' }}</button>
                <button
                  class="btn btn-secondary todo-mini-btn"
                  type="button"
                  :disabled="item.target > 1 ? false : item.count <= 0"
                  @click="item.target > 1 ? (item.count > 0 ? editLatestHabitNote(item.habit.id) : quickHabitCheckinWithNote(item.habit.id)) : undoHabitCheckin(item.habit.id)"
                >{{ item.target > 1 ? '备注' : '撤销' }}</button>
                <button
                  v-if="item.target > 1 && item.count > 0"
                  class="btn btn-secondary todo-mini-btn"
                  type="button"
                  @click="undoHabitCheckin(item.habit.id)"
                >-1</button>
              </span>
            </li>
          </ul>
          <div v-else class="empty-state">今日暂无安排的习惯</div>
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
      <div v-else class="empty-state">暂无进行中的周期记录</div>
    </article>

    <article class="card dashboard-timeline">
      <div class="section-title-row timeline-title-row">
        <h2 class="card-title">近期记录时间轴</h2>
        <select v-model.number="timelineRangeDays" class="compact-select" aria-label="时间轴范围">
          <option :value="7">最近7天</option>
          <option :value="30">最近30天</option>
          <option :value="90">最近90天</option>
        </select>
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
      <div v-else class="empty-state">当前范围暂无记录，换个范围或新建第一条吧</div>
    </article>

    <RecordCreateModal ref="createModal" v-model="showCreateRecord" @open-existing="openExistingFromCreate" />
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
.command-card-head,
.timeline-title-row {
  flex-wrap: wrap;
}
.dashboard-main-grid { margin-bottom: 16px; }
.dashboard-timeline { min-width: 0; }
.dashboard-material-copy { display: grid; gap: 2px; min-width: 0; }
.dashboard-material-details { color: var(--muted); font-size: 11px; font-weight: 600; }
.todo-list { display: grid; gap: 8px; padding: 0; margin: 0; list-style: none; }
.todo-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  min-width: 0;
}
.todo-check { width: 16px; height: 16px; margin: 0; flex: 0 0 auto; }
.todo-dashboard-link { display: grid; gap: 3px; width: 100%; min-width: 0; text-align: left; }
.todo-dashboard-link small { color: var(--faint); font-size: 12px; font-weight: 650; }
.todo-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
  grid-column: 1 / -1;
  min-width: 0;
}
.dashboard-habit-item .todo-dashboard-link small {
  color: var(--faint);
}
@media (min-width: 720px) {
  .todo-item {
    grid-template-columns: auto minmax(0, 1fr) auto auto;
  }
  .todo-actions {
    grid-column: auto;
    justify-content: flex-end;
  }
  .dashboard-habit-item {
    grid-template-columns: minmax(0, 1fr) auto auto;
  }
}
.period-item { width: 100%; min-width: 0; text-align: left; }
.period-info { min-width: 0; }
.period-info h4 { display: flex; flex-wrap: wrap; gap: 4px; min-width: 0; }
.progress-bar { min-width: 0; }
.timeline-item { width: 100%; min-width: 0; text-align: left; }
.item-preview { margin-top: 8px; color: var(--muted); font-size: 13px; line-height: 1.55; white-space: pre-wrap; overflow-wrap: anywhere; }
@media (max-width: 980px) {
  .command-center { grid-template-columns: minmax(0, 1fr); }
  .today-grid { grid-template-columns: minmax(0, 1fr); }
}
</style>
