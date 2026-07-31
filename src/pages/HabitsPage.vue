<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getTodayStr } from '../services/legacyServices';
import { useHabitsStore } from '../stores/habitsStore';
import { useLifePlanStore } from '../stores/lifePlanStore';
import type { HabitRule } from '../stores/habitsStore';

type AnalysisCheckin = {
  id?: string;
  habitId: string;
  date: string;
  note?: string;
  time?: string;
  checkinAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

const habits = useHabitsStore();
const lifePlan = useLifePlanStore();
const route = useRoute();
const router = useRouter();
const formError = ref('');
const activeTab = ref<'today' | 'backfill' | 'library' | 'wallet' | 'diagnostics' | 'sync'>('today');
const makeupDate = ref(getTodayStr());
const matrixDays = ref(30);
const actionDrafts = reactive<Record<string, { date: string; note: string }>>({});
const checkinNoteDrafts = reactive<Record<string, string>>({});
const rewardForm = reactive({ name: '', cost: 10, currency: '金币', stock: 0, note: '' });
const showPointAdjust = ref(false);
const pointAdjustForm = reactive({
  direction: 'add' as 'add' | 'subtract',
  amount: 1,
  currency: '金币',
  note: '',
});
const currencyOptions = computed(() => {
  const names = new Set<string>(['金币', ...Object.keys(habits.balances || {})]);
  lifePlan.data.habitCurrencies.forEach(item => {
    const name = String(item.name || item.currency || '').trim();
    if (name) names.add(name);
  });
  return [...names];
});
const focusedHabitId = computed(() => String(route.query.habit || ''));
const todayItems = computed(() => habits.todayHabits.map(habit => ({
  habit,
  count: habits.getCheckinCount(habit.id),
  target: habits.targetCount(habit),
})));
const rewardItems = computed(() => [...habits.rewards].sort((a, b) => {
  const archiveRank = Number(Boolean(a.archived)) - Number(Boolean(b.archived));
  if (archiveRank) return archiveRank;
  return String(a.currency || '金币').localeCompare(String(b.currency || '金币'), 'zh-Hans-CN') || Number(a.cost || 0) - Number(b.cost || 0);
}));
const balanceText = computed(() => Object.entries(habits.balances)
  .sort(([a], [b]) => a.localeCompare(b, 'zh-Hans-CN'))
  .map(([currency, amount]) => `${amount} ${currency}`)
  .join(' · ') || '0 金币');
const diagnosticSummary = computed(() => habits.diagnostics.summary || {});
const diagnosticIssues = computed(() => habits.diagnosticIssues.slice(0, 3));
const doneTodayCount = computed(() => todayItems.value.filter(item => item.count >= item.target).length);
const recentCheckinCount = computed(() => {
  const today = getTodayStr();
  const start = (() => {
    const date = new Date(`${today}T12:00:00`);
    date.setDate(date.getDate() - 6);
    return getTodayStr(date);
  })();
  return lifePlan.data.checkins.filter(item => {
    const date = String(item.date || '');
    return date >= start && date <= today;
  }).length;
});
const recentWindowCheckins = computed(() => {
  const today = getTodayStr();
  const start = (() => {
    const date = new Date(`${today}T12:00:00`);
    date.setDate(date.getDate() - Math.max(1, Number(matrixDays.value) || 30) + 1);
    return getTodayStr(date);
  })();
  return lifePlan.data.checkins.filter(item => {
    const date = String(item.date || '');
    return date >= start && date <= today;
  }).length;
});
const matrixDates = computed(() => {
  const today = getTodayStr();
  const days = Math.max(1, Number(matrixDays.value) || 30);
  const dates: string[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(`${today}T12:00:00`);
    date.setDate(date.getDate() - offset);
    dates.push(getTodayStr(date));
  }
  return dates;
});
const matrixRows = computed(() => habits.habits
  .filter(habit => !habit.archived)
  .map(habit => ({
    id: habit.id,
    name: habit.name || '未命名习惯',
    cells: matrixDates.value.map(date => ({
      date,
      count: habits.getCheckinCount(habit.id, date),
    })),
  })));
const analysisHabitSummaries = computed(() => matrixRows.value
  .map(row => {
    const checkins = row.cells.reduce((sum, cell) => sum + cell.count, 0);
    const activeDays = row.cells.filter(cell => cell.count > 0).length;
    let checkinStreak = 0;
    for (let index = row.cells.length - 1; index >= 0 && row.cells[index].count > 0; index -= 1) checkinStreak += 1;
    const latest = [...row.cells].reverse().find(cell => cell.count > 0);
    return { ...row, checkins, activeDays, checkinStreak, latestDate: latest?.date || '' };
  })
  .sort((a, b) => b.checkins - a.checkins || b.activeDays - a.activeDays || a.name.localeCompare(b.name, 'zh-Hans-CN')));
const analysisHabitId = ref(focusedHabitId.value);
const analysisYear = ref(new Date().getFullYear());
const analysisYears = computed(() => {
  const currentYear = new Date().getFullYear();
  return [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];
});
const selectedAnalysisHabit = computed(() => habits.habits.find(item => item.id === analysisHabitId.value && !item.archived)
  || habits.habits.find(item => !item.archived)
  || null);
const annualHeatmapCells = computed(() => {
  const habit = selectedAnalysisHabit.value;
  if (!habit) return [];
  const year = Number(analysisYear.value);
  const start = new Date(year, 0, 1, 12);
  const end = new Date(year, 11, 31, 12);
  const startDay = start.getDay() || 7;
  const endDay = end.getDay() || 7;
  const gridStart = new Date(start);
  gridStart.setDate(start.getDate() - startDay + 1);
  const gridEnd = new Date(end);
  gridEnd.setDate(end.getDate() + 7 - endDay);
  const cells: Array<{ date: string; count: number; level: number; outside: boolean; future: boolean }> = [];
  for (const date = new Date(gridStart); date <= gridEnd; date.setDate(date.getDate() + 1)) {
    const dateKey = getTodayStr(date);
    const count = habits.getCheckinCount(habit.id, dateKey);
    const level = count >= 7 ? 4 : count >= 4 ? 3 : count >= 2 ? 2 : count >= 1 ? 1 : 0;
    cells.push({
      date: dateKey,
      count,
      level,
      outside: date.getFullYear() !== year,
      future: dateKey > getTodayStr(),
    });
  }
  return cells;
});
const annualHeatmapColumns = computed(() => Math.max(1, Math.ceil(annualHeatmapCells.value.length / 7)));
const annualStats = computed(() => {
  const habit = selectedAnalysisHabit.value;
  if (!habit) return { totalDays: 0, currentStreak: 0, maxStreak: 0, monthRate: 0, yearRate: 0, lastOperation: '' };
  const checkins = (lifePlan.data.checkins as unknown as AnalysisCheckin[])
    .filter(item => item.habitId === habit.id && item.date)
    .map(item => ({ ...item, date: String(item.date) }));
  const allDates = new Set(checkins.map(item => item.date));
  const sortedDates = [...allDates].sort();
  let maxStreak = 0;
  let streak = 0;
  let previous = '';
  sortedDates.forEach(dateKey => {
    const date = new Date(`${dateKey}T12:00:00`);
    const previousDate = previous ? new Date(`${previous}T12:00:00`) : null;
    if (previousDate && (date.getTime() - previousDate.getTime()) === 86400000) streak += 1;
    else streak = 1;
    previous = dateKey;
    maxStreak = Math.max(maxStreak, streak);
  });
  let currentStreak = 0;
  for (const date = new Date(`${getTodayStr()}T12:00:00`); allDates.has(getTodayStr(date)); date.setDate(date.getDate() - 1)) currentStreak += 1;
  const year = Number(analysisYear.value);
  const yearDates = annualHeatmapCells.value.filter(item => !item.outside && item.count > 0).length;
  const yearDays = Math.round((new Date(year, 11, 31).getTime() - new Date(year, 0, 1).getTime()) / 86400000) + 1;
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthDates = new Set(checkins.filter(item => item.date.startsWith(monthKey)).map(item => item.date));
  const monthDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const lastOperation = [...checkins]
    .map(item => String(item.checkinAt || item.createdAt || item.updatedAt || `${item.date}T${item.time || '00:00:00'}`))
    .sort()
    .pop() || String(habit.updatedAt || '');
  return {
    totalDays: allDates.size,
    currentStreak,
    maxStreak,
    yearDays,
    monthRate: monthDays ? Math.round(monthDates.size / monthDays * 100) : 0,
    yearRate: yearDays ? Math.round(yearDates / yearDays * 100) : 0,
    lastOperation,
  };
});
const selectedHabitCheckins = computed(() => {
  const habit = selectedAnalysisHabit.value;
  if (!habit) return [];
  return (lifePlan.data.checkins as unknown as AnalysisCheckin[])
    .filter(item => item.habitId === habit.id && item.date)
    .map(item => ({
      ...item,
      date: String(item.date),
      timestamp: String(item.checkinAt || item.createdAt || item.updatedAt || `${item.date}T${item.time || '00:00:00'}`),
    }))
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
    .slice(0, 30);
});
const selectedHabitNoteCount = computed(() => selectedHabitCheckins.value.filter(item => String(item.note || '').trim()).length);
const yesterdayPendingCount = computed(() => {
  const yesterday = (() => {
    const date = new Date(`${getTodayStr()}T12:00:00`);
    date.setDate(date.getDate() - 1);
    return getTodayStr(date);
  })();
  return habits.habits.filter(habit => {
    if (habit.archived) return false;
    if (habit.startDate && habit.startDate > yesterday) return false;
    return habits.getCheckinCount(habit.id, yesterday) < habits.targetCount(habit);
  }).length;
});
const centerKpis = computed(() => [
  { label: '今日达标', value: `${doneTodayCount.value}/${todayItems.value.length}`, hint: todayItems.value.length ? '按今日规则' : '今日无待办习惯' },
  { label: '习惯库', value: String(habits.habits.length), hint: `${habits.habits.filter(item => item.archived).length} 已归档` },
  { label: '近 7 天打卡', value: String(recentCheckinCount.value), hint: 'checkins 条数' },
  { label: '昨日待处理', value: String(yesterdayPendingCount.value), hint: '可到补卡页处理' },
  { label: '钱包余额', value: balanceText.value, hint: 'habitPointLedger' },
]);
const tabItems = [
  { id: 'today', label: '今日' },
  { id: 'backfill', label: '补卡' },
  { id: 'library', label: '习惯库' },
  { id: 'wallet', label: '钱包' },
  { id: 'diagnostics', label: '分析' },
  { id: 'sync', label: '云同步' },
] as const;

function openTab(tab: typeof activeTab.value) {
  activeTab.value = tab;
}

function openCreateHabit() {
  resetHabitForm();
  activeTab.value = 'library';
}

function openCreateWish() {
  activeTab.value = 'wallet';
}

function openPointAdjust() {
  pointAdjustForm.direction = 'add';
  pointAdjustForm.amount = 1;
  pointAdjustForm.currency = Object.keys(habits.balances)[0] || '金币';
  pointAdjustForm.note = '';
  showPointAdjust.value = true;
}

function savePointAdjust() {
  if (!habits.adjustPoints({
    direction: pointAdjustForm.direction,
    amount: pointAdjustForm.amount,
    currency: pointAdjustForm.currency,
    note: pointAdjustForm.note,
  })) return;
  showPointAdjust.value = false;
}

watch(makeupDate, value => {
  if (!value) return;
  Object.keys(actionDrafts).forEach(habitId => {
    actionDrafts[habitId].date = value;
  });
});

const weekdayOptions = [
  { value: '1', label: '一' },
  { value: '2', label: '二' },
  { value: '3', label: '三' },
  { value: '4', label: '四' },
  { value: '5', label: '五' },
  { value: '6', label: '六' },
  { value: '0', label: '日' },
];
const ruleLabels: Record<string, string> = {
  daily: '每天',
  'weekly-fixed': '每周固定',
  'weekly-count': '每周次数',
  'monthly-count': '每月次数',
  interval: '间隔天数',
};
const milestoneDays = [7, 15, 21, 30, 90, 180, 365];

function milestoneDefaults() {
  return milestoneDays.map(days => ({
    days,
    enabled: false,
    rewardAmount: 0,
    currency: '金币',
    penaltyAmount: 0,
    penaltyCurrency: '金币',
  }));
}

const habitForm = reactive({
  id: '',
  name: '',
  rule: 'daily',
  weekdays: [] as string[],
  count: 3,
  timesPerDay: 1,
  tag: '',
  goalCount: 0,
  noteMode: 'ask',
  rewardPoints: 0,
  rewardCurrency: '金币',
  penaltyPoints: 0,
  penaltyCurrency: '金币',
  randomReward: false,
  rewardMin: 0,
  rewardMax: 0,
  breakPenaltyMode: 'none',
  breakPenaltyPoints: 0,
  breakPenaltyCurrency: '金币',
  milestoneRewards: milestoneDefaults(),
});
const editingHabit = computed(() => habitForm.id ? habits.habits.find(item => item.id === habitForm.id) : null);
const formTitle = computed(() => editingHabit.value ? '编辑基础习惯' : '添加基础习惯');

function resetHabitForm() {
  habitForm.id = '';
  habitForm.name = '';
  habitForm.rule = 'daily';
  habitForm.weekdays = [];
  habitForm.count = 3;
  habitForm.timesPerDay = 1;
  habitForm.tag = '';
  habitForm.goalCount = 0;
  habitForm.noteMode = 'ask';
  habitForm.rewardPoints = 0;
  habitForm.rewardCurrency = '金币';
  habitForm.penaltyPoints = 0;
  habitForm.penaltyCurrency = '金币';
  habitForm.randomReward = false;
  habitForm.rewardMin = 0;
  habitForm.rewardMax = 0;
  habitForm.breakPenaltyMode = 'none';
  habitForm.breakPenaltyPoints = 0;
  habitForm.breakPenaltyCurrency = '金币';
  habitForm.milestoneRewards = milestoneDefaults();
  formError.value = '';
}

function editHabit(item: {
  id: string; name?: string; rule?: string; weekdays?: unknown; count?: unknown; timesPerDay?: unknown; tag?: string; goalCount?: unknown; noteMode?: string;
  rewardPoints?: unknown; rewardCurrency?: string; penaltyPoints?: unknown; penaltyCurrency?: string; randomReward?: boolean; rewardMin?: unknown; rewardMax?: unknown;
  breakPenaltyMode?: string; breakPenaltyPoints?: unknown; breakPenaltyCurrency?: string; milestoneRewards?: unknown;
}) {
  activeTab.value = 'library';
  habitForm.id = item.id;
  habitForm.name = item.name || '';
  habitForm.rule = item.rule || 'daily';
  habitForm.weekdays = Array.isArray(item.weekdays) ? item.weekdays.map(String) : [];
  habitForm.count = Number(item.count || 3);
  habitForm.timesPerDay = Number(item.timesPerDay || 1);
  habitForm.tag = item.tag || '';
  habitForm.goalCount = Number(item.goalCount || 0);
  habitForm.noteMode = item.noteMode === 'never' ? 'never' : 'ask';
  habitForm.rewardPoints = Number(item.rewardPoints || 0);
  habitForm.rewardCurrency = item.rewardCurrency || '金币';
  habitForm.penaltyPoints = Number(item.penaltyPoints || 0);
  habitForm.penaltyCurrency = item.penaltyCurrency || item.rewardCurrency || '金币';
  habitForm.randomReward = Boolean(item.randomReward);
  habitForm.rewardMin = Number(item.rewardMin ?? item.rewardPoints ?? 0);
  habitForm.rewardMax = Number(item.rewardMax ?? item.rewardPoints ?? 0);
  habitForm.breakPenaltyMode = ['none', 'fixed', 'stage'].includes(String(item.breakPenaltyMode)) ? String(item.breakPenaltyMode) : 'none';
  habitForm.breakPenaltyPoints = Number(item.breakPenaltyPoints || 0);
  habitForm.breakPenaltyCurrency = item.breakPenaltyCurrency || item.penaltyCurrency || item.rewardCurrency || '金币';
  const supplied = Array.isArray(item.milestoneRewards) ? item.milestoneRewards as Array<Record<string, unknown>> : [];
  habitForm.milestoneRewards = milestoneDefaults().map(fallback => {
    const match = supplied.find(value => Number(value.days) === fallback.days);
    return {
      days: fallback.days,
      enabled: Boolean(match?.enabled),
      rewardAmount: Number(match?.rewardAmount || 0),
      currency: String(match?.currency || '金币'),
      penaltyAmount: Number(match?.penaltyAmount || 0),
      penaltyCurrency: String(match?.penaltyCurrency || match?.currency || '金币'),
    };
  });
  formError.value = '';
}

function draftFor(habitId: string) {
  if (!actionDrafts[habitId]) {
    actionDrafts[habitId] = {
      date: activeTab.value === 'backfill' ? (makeupDate.value || getTodayStr()) : getTodayStr(),
      note: '',
    };
  }
  return actionDrafts[habitId];
}

function saveHabit() {
  try {
    const input = {
      name: habitForm.name,
      rule: habitForm.rule as HabitRule,
      weekdays: habitForm.weekdays,
      count: habitForm.count,
      timesPerDay: habitForm.timesPerDay,
      tag: habitForm.tag,
      goalCount: habitForm.goalCount,
      noteMode: habitForm.noteMode as 'ask' | 'never',
      rewardPoints: habitForm.rewardPoints,
      rewardCurrency: habitForm.rewardCurrency,
      penaltyPoints: habitForm.penaltyPoints,
      penaltyCurrency: habitForm.penaltyCurrency,
      randomReward: habitForm.randomReward,
      rewardMin: habitForm.rewardMin,
      rewardMax: habitForm.rewardMax,
      breakPenaltyMode: habitForm.breakPenaltyMode as 'none' | 'fixed' | 'stage',
      breakPenaltyPoints: habitForm.breakPenaltyPoints,
      breakPenaltyCurrency: habitForm.breakPenaltyCurrency,
      milestoneRewards: habitForm.milestoneRewards,
    };
    const saved = habitForm.id ? habits.updateHabit(habitForm.id, input) : habits.create(input);
    if (saved) resetHabitForm();
    formError.value = '';
  } catch (error) {
    formError.value = error instanceof Error ? error.message : String(error);
  }
}

function resetRewardForm() {
  rewardForm.name = '';
  rewardForm.cost = 10;
  rewardForm.currency = '金币';
  rewardForm.stock = 0;
  rewardForm.note = '';
}

function saveReward() {
  try {
    habits.createReward({
      name: rewardForm.name,
      cost: rewardForm.cost,
      currency: rewardForm.currency,
      stock: rewardForm.stock,
      note: rewardForm.note,
    });
    resetRewardForm();
    formError.value = '';
  } catch (error) {
    formError.value = error instanceof Error ? error.message : String(error);
  }
}

function redeemReward(id: string) {
  const reward = habits.rewards.find(item => item.id === id);
  if (!reward) return;
  if (!window.confirm(`确认兑换「${reward.name}」吗？`)) return;
  habits.redeemReward(id);
}

function archiveReward(id: string, archived: boolean) {
  habits.setRewardArchived(id, archived);
}

function setHabitArchive(id: string, archived: boolean) {
  const item = habits.habits.find(habit => habit.id === id);
  if (!item) return;
  if (archived && !window.confirm(`归档「${item.name}」后，它不会出现在今日待做中。确认继续吗？`)) return;
  habits.setHabitArchived(id, archived);
  if (habitForm.id === id) resetHabitForm();
}

function deleteHabit(id: string) {
  const item = habits.habits.find(habit => habit.id === id);
  if (!item) return;
  if (!window.confirm('确定删除这个习惯吗？所有历史打卡记录和时间轴条目都会一起删除')) return;
  if (habits.deleteHabit(id) && habitForm.id === id) resetHabitForm();
}

function checkin(id: string) {
  habits.quickCheckin(id);
}

function appendWithDraft(habitId: string) {
  const draft = draftFor(habitId);
  if (habits.appendCheckin(habitId, draft.date, draft.note)) draft.note = '';
}

function undoWithDraft(habitId: string) {
  const draft = draftFor(habitId);
  habits.undoLatestCheckin(habitId, draft.date);
}

function checkinsForDraft(habitId: string) {
  const draft = draftFor(habitId);
  return habits.getCheckins(habitId, draft.date);
}

function openAnalysisCheckin(checkin: { habitId: string; date: string; note?: string }) {
  activeTab.value = 'backfill';
  makeupDate.value = checkin.date;
  const draft = draftFor(checkin.habitId);
  draft.date = checkin.date;
  draft.note = String(checkin.note || '');
}

function formatAnalysisDateTime(value: string, includeSeconds = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}${includeSeconds ? `:${pad(date.getSeconds())}` : ''}`;
}

function noteDraft(checkin: { id: string; note?: string }) {
  if (!(checkin.id in checkinNoteDrafts)) checkinNoteDrafts[checkin.id] = checkin.note || '';
  return checkinNoteDrafts[checkin.id];
}

function updateNoteDraft(checkinId: string, value: string) {
  checkinNoteDrafts[checkinId] = value;
}

function saveCheckinNote(checkinId: string) {
  habits.editCheckinNote(checkinId, checkinNoteDrafts[checkinId] || '');
}

function settlePenalties() {
  habits.settlePenaltiesThroughYesterday();
}

watch(focusedHabitId, value => {
  if (!value || habitForm.id) return;
  const item = habits.habits.find(habit => habit.id === value);
  if (item) editHabit(item);
}, { immediate: true });
</script>

<template>
  <section class="page active" id="page-habits">
    <header class="page-header">
      <div>
        <div class="page-title">习惯中心</div>
        <p class="page-subtitle">PC 端负责执行、补卡审计、习惯库、钱包和分析；数据仍沿用 life 旧字段。</p>
      </div>
      <div class="habit-header-actions">
        <button class="btn btn-secondary" type="button" @click="openTab('wallet')">币种管理</button>
        <button class="btn btn-secondary" type="button" @click="openPointAdjust">调整积分</button>
        <button class="btn btn-secondary" type="button" @click="openCreateWish">新增心愿</button>
        <button class="btn btn-primary" type="button" @click="openCreateHabit">+ 新建习惯</button>
      </div>
    </header>

    <article class="card habit-center-hero">
      <div>
        <div class="habit-kicker">HABIT OPERATIONS</div>
        <h2>今天先执行，历史在补卡页处理，规则和钱包集中管理。</h2>
        <p>日常在「今日 / 补卡 / 习惯库 / 钱包」完成；需要和手机对齐时，到「云同步」或全局云同步页手动操作。</p>
      </div>
      <div class="habit-center-sync-note">
        <strong>云同步</strong>
        <span>独立文件 `/apps/habit-app/data.json` · 手动合并与受保护上传 · 不自动后台同步。</span>
        <button class="btn btn-secondary" type="button" @click="openTab('sync')">打开云同步</button>
      </div>
    </article>

    <div v-if="habits.lastAction" class="notice success" role="status">{{ habits.lastAction }}</div>
    <div v-if="habits.lastError" class="notice warning" role="alert">{{ habits.lastError }}</div>

    <div class="habit-kpi-grid habit-center-kpis">
      <article v-for="item in centerKpis" :key="item.label" class="habit-kpi-card">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
        <em>{{ item.hint }}</em>
      </article>
    </div>

    <div class="habit-center-toolbar">
      <div class="habit-center-tabs" role="tablist" aria-label="习惯中心分区">
        <button
          v-for="tab in tabItems"
          :key="tab.id"
          type="button"
          role="tab"
          class="habit-center-tab"
          :class="{ active: activeTab === tab.id }"
          :aria-selected="activeTab === tab.id"
          @click="openTab(tab.id)"
        >{{ tab.label }}</button>
      </div>
      <div class="habit-center-toolbar-actions">
        <input
          v-show="activeTab === 'backfill'"
          v-model="makeupDate"
          type="date"
          aria-label="补卡日期"
        >
        <select
          v-show="activeTab === 'diagnostics'"
          v-model.number="matrixDays"
          class="year-select"
          aria-label="分析矩阵天数"
          style="max-width:150px;"
        >
          <option :value="14">近14天</option>
          <option :value="30">近30天</option>
          <option :value="60">近60天</option>
        </select>
      </div>
    </div>

    <section v-show="activeTab === 'wallet'" class="card habit-wallet-panel" aria-labelledby="habit-wallet-title">
      <div class="section-title-row">
        <div>
          <h2 id="habit-wallet-title">钱包与心愿</h2>
          <p class="section-hint">兑换会写入旧版 <code>habitPointLedger</code> 的 <code>type: redeem</code> 流水，并更新心愿兑换次数。</p>
        </div>
        <strong class="habit-wallet-total">{{ balanceText }}</strong>
      </div>

      <form class="habit-reward-form" @submit.prevent="saveReward">
        <label class="form-field"><span>心愿名称</span><input v-model="rewardForm.name" required maxlength="80" placeholder="例如：买一本书" /></label>
        <label class="form-field"><span>花费</span><input v-model.number="rewardForm.cost" type="number" min="1" max="999999" /></label>
        <label class="form-field"><span>币种</span><input v-model="rewardForm.currency" maxlength="24" /></label>
        <label class="form-field"><span>库存</span><input v-model.number="rewardForm.stock" type="number" min="0" max="99999" /></label>
        <label class="form-field reward-note"><span>备注</span><input v-model="rewardForm.note" maxlength="120" placeholder="可选" /></label>
        <div class="form-actions"><button class="btn btn-primary" type="submit">新增心愿</button></div>
      </form>

      <div class="habit-wallet-layout">
        <div class="habit-reward-list">
          <article v-for="reward in rewardItems" :key="reward.id" class="habit-reward-card" :class="{ archived: reward.archived }">
            <div>
              <strong>{{ reward.name }}</strong>
              <span>{{ Number(reward.cost || 0) }} {{ reward.currency || '金币' }} · 已兑 {{ Number(reward.redeemedCount || 0) }} · {{ Number(reward.stock || 0) > 0 ? `库存 ${habits.getRewardStockLeft(reward.id)}` : '不限次数' }}</span>
              <p v-if="reward.note">{{ reward.note }}</p>
            </div>
            <div class="habit-reward-actions">
              <button class="btn btn-secondary" type="button" :disabled="!habits.canRedeemReward(reward.id)" @click="redeemReward(reward.id)">兑换</button>
              <button class="btn btn-secondary" type="button" @click="archiveReward(reward.id, !reward.archived)">{{ reward.archived ? '恢复心愿' : '归档心愿' }}</button>
            </div>
          </article>
          <div v-if="!rewardItems.length" class="empty-state">还没有心愿。</div>
        </div>
        <div class="habit-ledger-panel">
          <h3>近期流水</h3>
          <div v-for="entry in habits.latestLedger" :key="entry.id" class="habit-ledger-row" :class="Number(entry.amount || 0) >= 0 ? 'plus' : 'minus'">
            <span>{{ entry.note || entry.type || '积分调整' }}</span>
            <strong>{{ Number(entry.amount || 0) > 0 ? '+' : '' }}{{ Number(entry.amount || 0) }} {{ entry.currency || '金币' }}</strong>
          </div>
          <div v-if="!habits.latestLedger.length" class="empty-state">暂无积分流水。</div>
        </div>
      </div>
    </section>

    <section v-show="activeTab === 'diagnostics'" class="card habit-diagnostics-panel" aria-labelledby="habit-diagnostics-title">
      <div class="section-title-row">
        <div>
          <h2 id="habit-diagnostics-title">习惯分析</h2>
          <p class="section-hint">查看近 {{ matrixDays }} 天执行概况与诊断摘要；诊断本身只读，结算扣分会写入 miss/break 流水。</p>
        </div>
        <div class="habit-diagnostics-actions">
          <button class="btn btn-secondary" type="button" @click="settlePenalties">结算昨日扣分</button>
          <span class="habit-diagnostics-pill">近{{ matrixDays }}天</span>
        </div>
      </div>
      <div class="habit-matrix-summary">
        <article>
          <span>分析窗口</span>
          <strong>近 {{ matrixDays }} 天</strong>
        </article>
        <article>
          <span>习惯数</span>
          <strong>{{ habits.habits.length }}</strong>
        </article>
        <article>
          <span>近窗打卡</span>
          <strong>{{ recentWindowCheckins }}</strong>
        </article>
        <article>
          <span>诊断状态</span>
          <strong>{{ habits.diagnostics.readOnly ? '只读' : '检查' }}</strong>
        </article>
      </div>

      <div class="habit-matrix-block" aria-label="近期执行矩阵">
          <div class="section-title-row compact">
          <div>
            <h3>近期执行矩阵</h3>
            <p class="section-hint">只读预览近 {{ matrixDays }} 天打卡分布；点选日期仍请到补卡页处理。</p>
          </div>
        </div>
        <div v-if="matrixRows.length" class="habit-matrix">
          <div
            class="habit-matrix-grid"
            :style="{ gridTemplateColumns: `160px repeat(${matrixDates.length}, minmax(28px, 36px))` }"
          >
            <div class="habit-matrix-cell name" title="习惯">习惯</div>
            <div
              v-for="date in matrixDates"
              :key="`head-${date}`"
              class="habit-matrix-cell head"
              :title="date"
            >{{ Number(date.slice(8, 10)) }}</div>
            <template v-for="row in matrixRows" :key="row.id">
              <div class="habit-matrix-cell name" :title="row.name">{{ row.name }}</div>
              <div
                v-for="cell in row.cells"
                :key="`${row.id}-${cell.date}`"
                class="habit-matrix-cell"
                :title="`${row.name} · ${cell.date} · ${cell.count}次`"
              >
                <span class="habit-dot" :class="{ done: cell.count > 0 }" />
              </div>
            </template>
          </div>
        </div>
        <div v-else class="empty-state">暂无习惯，先新建一个习惯。</div>
      </div>

      <div class="habit-analysis-summary" aria-label="习惯统计摘要">
        <div class="section-title-row compact">
          <div>
            <h3>习惯统计摘要</h3>
            <p class="section-hint">按当前分析窗口聚合，只有读取，不会改变打卡或奖励。</p>
          </div>
        </div>
        <div v-if="analysisHabitSummaries.length" class="habit-analysis-summary-grid">
          <article v-for="item in analysisHabitSummaries" :key="`${item.id}-summary`" class="habit-analysis-summary-card">
            <div class="habit-analysis-summary-copy">
              <strong>{{ item.name }}</strong>
              <span>{{ item.activeDays }} 天有打卡<span v-if="item.latestDate"> · 最近 {{ item.latestDate }}</span></span>
            </div>
            <div class="habit-analysis-summary-values">
              <strong>{{ item.checkins }}</strong>
              <span>次打卡</span>
              <em>连续有打卡 {{ item.checkinStreak }} 天</em>
            </div>
          </article>
        </div>
        <div v-else class="empty-state">暂无可统计的习惯。</div>
      </div>

      <div class="habit-annual-analysis" aria-label="单习惯年度热力图">
        <div class="section-title-row compact">
          <div>
            <h3>单习惯年度分析</h3>
            <p class="section-hint">沿用旧版年度热力图，只读展示每天打卡次数与年度完成率。</p>
          </div>
          <div class="habit-annual-controls">
            <select v-model="analysisHabitId" aria-label="选择分析习惯">
              <option value="" disabled>选择习惯</option>
              <option v-for="habit in habits.habits.filter(item => !item.archived)" :key="habit.id" :value="habit.id">{{ habit.name || '未命名习惯' }}</option>
            </select>
            <select v-model.number="analysisYear" aria-label="选择分析年份">
              <option v-for="year in analysisYears" :key="year" :value="year">{{ year }} 年</option>
            </select>
            </div>
          </div>
          <div class="habit-annual-habit-pills" role="tablist" aria-label="年度分析习惯">
            <button
              v-for="habit in habits.habits.filter(item => !item.archived)"
              :key="`annual-pill-${habit.id}`"
              type="button"
              role="tab"
              class="habit-annual-habit-pill"
              :class="{ active: selectedAnalysisHabit?.id === habit.id }"
              :aria-selected="selectedAnalysisHabit?.id === habit.id"
              @click="analysisHabitId = habit.id"
            >{{ habit.name || '未命名习惯' }}</button>
          </div>
          <template v-if="selectedAnalysisHabit">
          <div class="habit-annual-title"><strong>{{ selectedAnalysisHabit.name || '未命名习惯' }}</strong><span>{{ analysisYear }} 年 · 每格代表一天</span></div>
          <div class="habit-annual-heatmap-shell">
            <div
              class="habit-annual-heatmap"
              :style="{ gridTemplateColumns: `repeat(${annualHeatmapColumns}, 18px)` }"
            >
              <div
                v-for="cell in annualHeatmapCells"
                :key="cell.date"
                class="habit-annual-cell"
                :class="[`level-${cell.level}`, { outside: cell.outside, future: cell.future }]"
                :title="`${cell.date} · 打卡 ${cell.count} 次${cell.future ? ' · 尚未到达' : ''}`"
                :aria-label="`${cell.date}，打卡 ${cell.count} 次`"
              />
            </div>
            <div class="habit-annual-months" :style="{ minWidth: `${annualHeatmapColumns * 22}px` }">
              <span v-for="month in 12" :key="month">{{ month }}月</span>
            </div>
          </div>
          <div class="habit-annual-legend" aria-label="年度热力图图例">
            <span>少</span><i class="level-0" /><i class="level-1" /><i class="level-2" /><i class="level-3" /><i class="level-4" /><span>多</span>
          </div>
          <div class="habit-annual-stats">
            <article><strong>{{ annualStats.totalDays }}</strong><span>累计打卡天数</span></article>
            <article><strong>{{ annualStats.currentStreak }}</strong><span>当前连续天数</span></article>
            <article><strong>{{ annualStats.maxStreak }}</strong><span>最长连续天数</span></article>
            <article><strong>{{ annualStats.monthRate }}%</strong><span>本月完成率</span></article>
            <article><strong>{{ annualStats.yearRate }}%</strong><span>{{ analysisYear }} 年完成率</span></article>
            <article><strong class="habit-annual-last-operation">{{ annualStats.lastOperation ? formatAnalysisDateTime(annualStats.lastOperation, true) : '暂无' }}</strong><span>最后操作时间</span></article>
          </div>
          <div class="habit-history-panel" aria-label="最近打卡备注">
            <div class="section-title-row compact">
              <div>
                <h3>最近打卡备注</h3>
                <p class="section-hint">{{ selectedAnalysisHabit.name || '未命名习惯' }} · {{ selectedHabitCheckins.length }} 次打卡 · {{ selectedHabitNoteCount }} 条备注</p>
              </div>
            </div>
            <div v-if="selectedHabitCheckins.length" class="habit-history-list">
              <div v-for="checkin in selectedHabitCheckins" :key="checkin.id" class="habit-history-item" :class="{ 'has-note': String(checkin.note || '').trim() }">
                <div class="habit-history-main">
                  <strong>{{ formatAnalysisDateTime(checkin.timestamp) }}</strong>
                  <span>{{ String(checkin.note || '').trim() || '暂无备注' }}</span>
                </div>
                <button class="btn btn-secondary habit-history-action" type="button" @click="openAnalysisCheckin(checkin)">{{ String(checkin.note || '').trim() ? '编辑' : '补备注' }}</button>
              </div>
            </div>
            <div v-else class="empty-state">这条习惯还没有打卡记录。</div>
          </div>
        </template>
        <div v-else class="empty-state">暂无可分析的习惯。</div>
      </div>

      <div class="habit-diagnostics-grid">
        <article><span>权威源</span><strong>{{ habits.diagnostics.authority || 'lifePlanData' }}</strong></article>
        <article><span>习惯/打卡</span><strong>{{ Number(diagnosticSummary.habits || 0) }} / {{ Number(diagnosticSummary.checkins || 0) }}</strong></article>
        <article><span>流水/心愿</span><strong>{{ Number(diagnosticSummary.habitPointLedger || 0) }} / {{ Number(diagnosticSummary.habitRewards || 0) }}</strong></article>
        <article><span>今日进度</span><strong>{{ Number(diagnosticSummary.doneToday || 0) }} / {{ Number(diagnosticSummary.dueToday || 0) }}</strong></article>
      </div>
      <div class="habit-diagnostics-issues">
        <article v-for="issue in diagnosticIssues" :key="issue.type || issue.id || issue.label || issue.title" class="habit-diagnostics-issue" :class="`is-${issue.severity || 'info'}`">
          <strong>{{ issue.label || issue.title || issue.type || issue.id }}</strong>
          <span>{{ issue.hint || issue.message || '需要复核这类旧数据。' }}</span>
        </article>
        <div v-if="!diagnosticIssues.length" class="empty-state">当前没有发现重复 ID、孤儿引用、异常金额或未来打卡。</div>
      </div>
    </section>

    <section v-show="activeTab === 'today' || activeTab === 'backfill'" class="card" aria-labelledby="today-habits-title">
      <div class="section-title-row">
        <div>
          <h2 id="today-habits-title">{{ activeTab === 'backfill' ? '补卡与修正' : '今日执行' }}</h2>
          <p class="section-hint">{{ activeTab === 'backfill' ? '选择日期后可备注打卡、补卡或撤销最近一次。' : '保留原来的快速打卡、备注、再记一次、撤销和减少次数。' }}</p>
        </div>
      </div>
      <div class="habit-quick-list">
        <article v-for="item in todayItems" :key="item.habit.id" class="habit-quick-card compact" :class="{ done: item.count > 0, multi: item.target > 1, 'is-target': focusedHabitId === item.habit.id }" :aria-current="focusedHabitId === item.habit.id ? 'true' : undefined">
          <div class="habit-quick-head">
            <div class="habit-quick-main">
              <div class="habit-quick-title-row">
                <div class="habit-quick-title">{{ item.habit.name }}</div>
                <span class="habit-quick-tag">{{ item.habit.tag || '习惯' }}</span>
                <span class="habit-quick-status" :class="item.count >= item.target ? 'is-done' : item.count ? 'is-active' : 'is-pending'">
                  {{ item.count >= item.target ? '已完成' : item.count ? '进行中' : '待打卡' }}
                </span>
              </div>
              <div class="habit-quick-meta"><span>{{ item.count }}/{{ item.target }} 次</span></div>
            </div>
            <div class="habit-quick-actions compact">
              <button class="habit-quick-btn primary" type="button" :disabled="item.target === 1 && item.count > 0" @click="checkin(item.habit.id)">
                {{ item.target > 1 && item.count > 0 ? '再记一次' : '打卡' }}
              </button>
              <button class="btn btn-secondary habit-edit-shortcut" type="button" @click="draftFor(item.habit.id); openTab('backfill')">备注</button>
              <button class="btn btn-secondary habit-edit-shortcut" type="button" :disabled="!checkinsForDraft(item.habit.id).length" @click="undoWithDraft(item.habit.id)">撤销</button>
              <button class="btn btn-secondary habit-edit-shortcut" type="button" @click="editHabit(item.habit)">编辑</button>
            </div>
          </div>
          <div v-show="activeTab === 'backfill'" class="habit-correction-panel">
            <div class="habit-correction-form">
              <label><span>日期</span><input v-model="draftFor(item.habit.id).date" type="date" /></label>
              <label><span>备注</span><input v-model="draftFor(item.habit.id).note" maxlength="120" placeholder="本次打卡备注" /></label>
              <button class="btn btn-secondary" type="button" @click="appendWithDraft(item.habit.id)">备注打卡/补卡</button>
              <button class="btn btn-secondary" type="button" :disabled="!checkinsForDraft(item.habit.id).length" @click="undoWithDraft(item.habit.id)">撤销最近一次</button>
            </div>
            <div v-if="checkinsForDraft(item.habit.id).length" class="habit-checkin-note-list">
              <div v-for="checkinItem in checkinsForDraft(item.habit.id)" :key="checkinItem.id" class="habit-checkin-note-row">
                <span>{{ checkinItem.time || checkinItem.checkinAt?.slice(11, 16) || '记录' }}</span>
                <input :value="noteDraft(checkinItem)" maxlength="120" placeholder="备注" @input="updateNoteDraft(checkinItem.id, ($event.target as HTMLInputElement).value)" />
                <button class="btn btn-secondary" type="button" @click="saveCheckinNote(checkinItem.id)">保存备注</button>
              </div>
            </div>
          </div>
        </article>
        <div v-if="!todayItems.length" class="empty-state">今日没有按规则待完成的习惯。</div>
      </div>
    </section>

    <section v-show="activeTab === 'library'" class="card habit-management-card" aria-labelledby="habit-management-title">
      <div class="section-title-row">
        <div>
          <h2 id="habit-management-title">{{ formTitle }}</h2>
          <p class="section-hint">{{ editingHabit ? `正在编辑：${editingHabit.name}` : '基础字段会沿用旧版数据结构。' }}</p>
        </div>
        <button v-if="editingHabit" class="btn btn-secondary" type="button" @click="resetHabitForm">取消编辑</button>
      </div>
      <form class="habit-editor-form" @submit.prevent="saveHabit">
        <label class="form-field"><span>习惯名称</span><input v-model="habitForm.name" required maxlength="80" placeholder="例如：晨间阅读" /></label>
        <label class="form-field"><span>分组标签</span><input v-model="habitForm.tag" maxlength="40" placeholder="例如：学习" /></label>
        <label class="form-field"><span>规则</span><select v-model="habitForm.rule"><option value="daily">每天</option><option value="weekly-fixed">每周固定</option><option value="weekly-count">每周次数</option><option value="monthly-count">每月次数</option><option value="interval">间隔天数</option></select></label>
        <label class="form-field"><span>每天次数</span><input v-model.number="habitForm.timesPerDay" type="number" min="1" max="99" /></label>
        <label v-if="['weekly-count', 'monthly-count', 'interval'].includes(habitForm.rule)" class="form-field"><span>{{ habitForm.rule === 'interval' ? '间隔天数' : '目标次数' }}</span><input v-model.number="habitForm.count" type="number" min="1" max="99" /></label>
        <label class="form-field"><span>总目标次数</span><input v-model.number="habitForm.goalCount" type="number" min="0" max="99999" /></label>
        <label class="form-field"><span>备注模式</span><select v-model="habitForm.noteMode"><option value="ask">打卡时询问</option><option value="never">不询问</option></select></label>
        <div v-if="habitForm.rule === 'weekly-fixed'" class="habit-weekday-field">
          <span>执行星期</span>
          <label v-for="day in weekdayOptions" :key="day.value"><input v-model="habitForm.weekdays" type="checkbox" :value="day.value" />{{ day.label }}</label>
        </div>
        <details class="habit-advanced-fields">
          <summary>高级积分与里程碑</summary>
          <div class="habit-advanced-grid">
            <label class="form-field"><span>固定奖励</span><input v-model.number="habitForm.rewardPoints" type="number" min="0" max="99999" /></label>
            <label class="form-field"><span>奖励币种</span><input v-model="habitForm.rewardCurrency" maxlength="24" /></label>
            <label class="form-field"><span>未完成扣分</span><input v-model.number="habitForm.penaltyPoints" type="number" min="0" max="99999" /></label>
            <label class="form-field"><span>扣金币种</span><input v-model="habitForm.penaltyCurrency" maxlength="24" /></label>
            <label class="habit-check-field"><input v-model="habitForm.randomReward" type="checkbox" /><span>使用随机奖励区间</span></label>
            <label v-if="habitForm.randomReward" class="form-field"><span>奖励下限</span><input v-model.number="habitForm.rewardMin" type="number" min="0" max="99999" /></label>
            <label v-if="habitForm.randomReward" class="form-field"><span>奖励上限</span><input v-model.number="habitForm.rewardMax" type="number" min="0" max="99999" /></label>
            <label class="form-field"><span>断签扣分</span><select v-model="habitForm.breakPenaltyMode"><option value="none">不扣分</option><option value="fixed">固定扣分</option><option value="stage">按阶段扣分</option></select></label>
            <label v-if="habitForm.breakPenaltyMode === 'fixed'" class="form-field"><span>断签扣分值</span><input v-model.number="habitForm.breakPenaltyPoints" type="number" min="0" max="99999" /></label>
            <label v-if="habitForm.breakPenaltyMode === 'fixed'" class="form-field"><span>断签币种</span><input v-model="habitForm.breakPenaltyCurrency" maxlength="24" /></label>
          </div>
          <div class="habit-milestone-editor">
            <div class="habit-milestone-head"><span>天数</span><span>奖励</span><span>奖励币种</span><span>罚款</span><span>罚款币种</span></div>
            <div v-for="milestone in habitForm.milestoneRewards" :key="milestone.days" class="habit-milestone-row">
              <label><input v-model="milestone.enabled" type="checkbox" />{{ milestone.days }} 天</label>
              <input v-model.number="milestone.rewardAmount" :aria-label="`${milestone.days} 天奖励`" type="number" min="0" max="99999" />
              <input v-model="milestone.currency" :aria-label="`${milestone.days} 天奖励币种`" maxlength="24" />
              <input v-model.number="milestone.penaltyAmount" :aria-label="`${milestone.days} 天罚款`" type="number" min="0" max="99999" />
              <input v-model="milestone.penaltyCurrency" :aria-label="`${milestone.days} 天罚款币种`" maxlength="24" />
            </div>
          </div>
        </details>
        <div class="form-actions"><button class="btn btn-primary" type="submit">{{ editingHabit ? '保存习惯' : '添加习惯' }}</button></div>
      </form>
      <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
      <p class="section-hint">新建和编辑会保留旧版规则、积分、断签扣分、里程碑与本地镜像结构；远端同步仍在云同步页面维护。</p>

      <div class="habit-library-table habit-management-table">
        <div class="habit-library-row head">
          <span>习惯</span><span>规则</span><span>次数</span><span>分组</span><span>目标</span><span>操作</span>
        </div>
        <div v-for="item in habits.habits" :key="item.id" class="habit-library-row" :class="{ 'is-target': focusedHabitId === item.id, archived: item.archived }">
          <span class="habit-library-name"><strong>{{ item.name }}</strong><em>{{ item.archived ? '已归档' : (item.startDate || '未设置开始日') }}</em></span>
          <span>{{ ruleLabels[item.rule || 'daily'] || item.rule || '每天' }}</span>
          <span>{{ habits.targetCount(item) }}/日</span>
          <span>{{ item.tag || '习惯' }}</span>
          <span>{{ Number(item.goalCount || 0) || '-' }}</span>
          <span class="habit-library-actions">
            <button class="btn btn-secondary" type="button" @click="editHabit(item)">编辑</button>
            <button class="btn btn-secondary" type="button" @click="setHabitArchive(item.id, !item.archived)">{{ item.archived ? '恢复' : '归档' }}</button>
            <button class="btn btn-danger" type="button" @click="deleteHabit(item.id)">删除</button>
          </span>
        </div>
        <div v-if="!habits.habits.length" class="empty-state">还没有习惯。</div>
      </div>
    </section>

    <section v-show="activeTab === 'sync'" class="card habit-sync-panel" aria-labelledby="habit-sync-title">
      <div class="section-title-row">
        <div>
          <h2 id="habit-sync-title">习惯云同步</h2>
          <p class="section-hint">独立文件 <code>/apps/habit-app/data.json</code>。手动合并与受保护上传在全局云同步页维护，不在此页自动触发。</p>
        </div>
        <button class="btn btn-primary" type="button" @click="router.push('/sync')">打开云同步</button>
      </div>
      <div class="habit-sync-points">
        <article><strong>本地权威</strong><span>lifePlanData 习惯字段优先</span></article>
        <article><strong>本地镜像</strong><span>habitAppData 仅兼容，remoteUploadEnabled=false</span></article>
        <article><strong>远端操作</strong><span>预览 / 应用 / 受保护上传 / 首次创建 / 条件自动同步</span></article>
      </div>
    </section>

    <div v-if="showPointAdjust" class="modal-overlay active" role="presentation" @click.self="showPointAdjust = false">
      <section class="modal modal-sm habit-point-adjust-modal" role="dialog" aria-modal="true" aria-labelledby="habit-point-adjust-title">
        <div class="modal-header">
          <div id="habit-point-adjust-title" class="modal-title">调整积分</div>
          <button class="close-btn" type="button" aria-label="关闭调整积分" @click="showPointAdjust = false">×</button>
        </div>
        <form @submit.prevent="savePointAdjust">
          <div class="form-row">
            <div class="form-group">
              <label for="habit-point-adjust-type">类型</label>
              <select id="habit-point-adjust-type" v-model="pointAdjustForm.direction">
                <option value="add">加金币</option>
                <option value="subtract">扣金币</option>
              </select>
            </div>
            <div class="form-group">
              <label for="habit-point-adjust-amount">数量</label>
              <input id="habit-point-adjust-amount" v-model.number="pointAdjustForm.amount" type="number" min="1" required>
            </div>
            <div class="form-group">
              <label for="habit-point-adjust-currency">币种</label>
              <input
                id="habit-point-adjust-currency"
                v-model="pointAdjustForm.currency"
                list="habit-currency-options"
                maxlength="24"
                placeholder="金币"
                required
              >
            </div>
          </div>
          <div class="form-group">
            <label for="habit-point-adjust-note">原因</label>
            <input
              id="habit-point-adjust-note"
              v-model="pointAdjustForm.note"
              maxlength="80"
              placeholder="例如：额外完成、违规扣分"
            >
          </div>
          <div class="modal-action-row">
            <button class="btn btn-secondary" type="button" @click="showPointAdjust = false">取消</button>
            <button class="btn btn-primary" type="submit">保存调整</button>
          </div>
        </form>
        <datalist id="habit-currency-options">
          <option v-for="currency in currencyOptions" :key="currency" :value="currency" />
        </datalist>
      </section>
    </div>
  </section>
</template>

<style scoped>
.habit-header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}
.habit-matrix-block {
  margin: 14px 0 18px;
}
.habit-matrix-block .section-title-row.compact {
  margin-bottom: 10px;
}
.habit-matrix-block h3 {
  margin: 0;
  font-size: 1rem;
}
.habit-center-hero {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}
.habit-center-sync-note {
  display: grid;
  gap: 8px;
  min-width: min(280px, 100%);
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface-soft);
}
.habit-center-sync-note strong {
  font-size: 13px;
}
.habit-center-sync-note span {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
}
.habit-point-adjust-modal {
  width: min(420px, calc(100vw - 32px));
}
.habit-point-adjust-modal .form-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}
.habit-point-adjust-modal .form-group {
  display: grid;
  gap: 6px;
  min-width: 0;
  margin-bottom: 12px;
}
.habit-point-adjust-modal .form-group label {
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}
.habit-point-adjust-modal .modal-action-row {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}
@media (max-width: 640px) {
  .habit-point-adjust-modal .form-row {
    grid-template-columns: minmax(0, 1fr);
  }
}
.habit-center-hero {
  margin-bottom: 14px;
}
.habit-kicker {
  color: var(--faint, #7a8b80);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.04em;
}
.habit-center-hero h2 {
  margin: 6px 0;
  font-size: 1.35rem;
  color: #1f4633;
}
.habit-center-kpis {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}
.habit-center-kpis .habit-kpi-card {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(33, 110, 78, 0.05);
  border: 1px solid rgba(33, 110, 78, 0.1);
}
.habit-center-kpis em {
  color: var(--faint, #7a8b80);
  font-size: 12px;
  font-style: normal;
}
.habit-center-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
}
.habit-center-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin: 0 0 14px;
}
.habit-center-toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.habit-matrix-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}
.habit-matrix-summary article {
  display: grid;
  gap: 4px;
  padding: 12px;
  border-radius: 12px;
  background: #f8faf8;
  border: 1px solid rgba(42, 75, 56, 0.1);
}
.habit-matrix-summary span {
  color: var(--faint, #7a8b80);
  font-size: 12px;
}
.habit-analysis-summary {
  display: grid;
  gap: 10px;
}
.habit-analysis-summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.habit-analysis-summary-card {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 14px;
  min-width: 0;
  padding: 12px;
  border: 1px solid rgba(42, 75, 56, .11);
  border-radius: 10px;
  background: #fbfdfb;
}
.habit-analysis-summary-copy,
.habit-analysis-summary-values {
  display: grid;
  gap: 3px;
  min-width: 0;
}
.habit-analysis-summary-copy strong {
  overflow-wrap: anywhere;
}
.habit-analysis-summary-copy span,
.habit-analysis-summary-values span,
.habit-analysis-summary-values em {
  color: var(--muted, #647269);
  font-size: 12px;
  font-style: normal;
}
.habit-analysis-summary-values {
  flex: 0 0 auto;
  justify-items: end;
}
.habit-analysis-summary-values strong {
  color: #285940;
  font-size: 1.1rem;
}
.habit-annual-analysis {
  display: grid;
  gap: 10px;
  margin: 18px 0 20px;
  padding-top: 16px;
  border-top: 1px solid rgba(42, 75, 56, .1);
}
.habit-annual-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.habit-annual-controls select {
  min-width: 128px;
  min-height: 36px;
  padding: 6px 9px;
  border: 1px solid var(--line, #dfe7e1);
  border-radius: 8px;
  background: #fff;
  color: var(--text, #17211b);
}
.habit-annual-habit-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.habit-annual-habit-pill {
  min-height: 34px;
  padding: 6px 12px;
  border: 1px solid rgba(42, 75, 56, .14);
  border-radius: 8px;
  background: #fff;
  color: var(--text, #17211b);
  font-weight: 750;
  cursor: pointer;
}
.habit-annual-habit-pill.active {
  border-color: #216e4e;
  background: #216e4e;
  color: #fff;
}
.habit-annual-title {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 8px;
}
.habit-annual-title span {
  color: var(--muted, #647269);
  font-size: 12px;
}
.habit-annual-heatmap-shell {
  overflow-x: auto;
  padding: 10px 4px 8px;
  border: 1px solid rgba(42, 75, 56, .1);
  border-radius: 10px;
  background: #fbfdfb;
}
.habit-annual-heatmap {
  display: grid;
  grid-template-rows: repeat(7, 18px);
  grid-auto-flow: column;
  gap: 4px;
  width: max-content;
  min-width: 720px;
}
.habit-annual-cell {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  background: #e3e9e5;
  box-sizing: border-box;
}
.habit-annual-cell.level-1 { background: #bfe5ca; }
.habit-annual-cell.level-2 { background: #79c98f; }
.habit-annual-cell.level-3 { background: #36a766; }
.habit-annual-cell.level-4 { background: #16633d; }
.habit-annual-cell.outside { background: transparent; }
.habit-annual-cell.future { opacity: .38; }
.habit-annual-months {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 4px;
  margin-top: 7px;
  padding: 0 2px;
  color: var(--muted, #647269);
  font-size: 11px;
  font-weight: 750;
}
.habit-annual-months span {
  text-align: center;
}
.habit-annual-legend {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--muted, #647269);
  font-size: 11px;
}
.habit-annual-legend i {
  display: block;
  width: 14px;
  height: 14px;
  border-radius: 3px;
  background: #e3e9e5;
}
.habit-annual-legend i.level-1 { background: #bfe5ca; }
.habit-annual-legend i.level-2 { background: #79c98f; }
.habit-annual-legend i.level-3 { background: #36a766; }
.habit-annual-legend i.level-4 { background: #16633d; }
.habit-annual-stats {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}
.habit-annual-stats article {
  display: grid;
  gap: 3px;
  padding: 10px 12px;
  border: 1px solid rgba(42, 75, 56, .1);
  border-radius: 10px;
  background: #f8faf8;
}
.habit-annual-stats strong {
  color: #285940;
  font-size: 1.15rem;
}
.habit-annual-stats span {
  color: var(--muted, #647269);
  font-size: 12px;
}
.habit-annual-last-operation {
  font-size: 13px !important;
  line-height: 1.35;
}
.habit-history-panel {
  display: grid;
  gap: 10px;
  margin-top: 2px;
  padding: 14px;
  border: 1px solid rgba(42, 75, 56, .11);
  border-radius: 10px;
  background: #fbfdfb;
}
.habit-history-panel h3 {
  margin: 0;
  font-size: 1rem;
}
.habit-history-list {
  display: grid;
  max-height: 360px;
  overflow: auto;
  border-top: 1px solid rgba(42, 75, 56, .1);
}
.habit-history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(42, 75, 56, .1);
}
.habit-history-main {
  display: grid;
  gap: 3px;
  min-width: 0;
}
.habit-history-main strong {
  color: var(--text, #17211b);
  font-size: 13px;
}
.habit-history-main span {
  color: var(--muted, #647269);
  font-size: 12px;
  overflow-wrap: anywhere;
}
.habit-history-item.has-note .habit-history-main span {
  color: #285940;
}
.habit-history-action {
  flex: 0 0 auto;
  min-height: 32px;
  padding: 5px 10px;
  font-size: 12px;
}
.habit-center-tab {
  border: 1px solid rgba(33, 110, 78, 0.14);
  background: #f7faf8;
  color: #5d7266;
  border-radius: 999px;
  padding: 7px 14px;
  font-weight: 750;
  cursor: pointer;
}
.habit-center-tab.active {
  background: #216e4e;
  color: #fff;
  border-color: #216e4e;
}
.habit-sync-points {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.habit-sync-points article {
  display: grid;
  gap: 4px;
  padding: 12px;
  border-radius: 12px;
  background: #f8faf8;
  border: 1px solid rgba(42, 75, 56, 0.1);
}
.habit-sync-points span {
  color: var(--faint, #7a8b80);
  font-size: 13px;
}
.habit-quick-card.is-target { outline: 3px solid rgba(47, 128, 237, .24); outline-offset: 2px; }
.habit-quick-actions.compact {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.habit-edit-shortcut {
  min-height: 36px;
  padding: 7px 11px;
  border-radius: 999px;
  font-size: 12px;
}
.habit-correction-panel {
  display: grid;
  gap: 10px;
  margin-top: 12px;
  max-width: 860px;
  padding: 12px;
  border: 1px solid rgba(42, 75, 56, .10);
  border-radius: 12px;
  background: rgba(248, 251, 249, .82);
}
.habit-correction-form,
.habit-checkin-note-row {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 8px;
}
.habit-correction-form label {
  display: grid;
  min-width: 136px;
  flex: 0 1 190px;
  gap: 4px;
  color: var(--muted, #647269);
  font-size: 12px;
  font-weight: 700;
}
.habit-correction-form input,
.habit-checkin-note-row input,
.habit-editor-form input,
.habit-editor-form select {
  width: 100%;
  min-height: 38px;
  padding: 8px 10px;
  border: 1px solid var(--line, #dfe7e1);
  border-radius: 8px;
  background: #fff;
  color: var(--text, #17211b);
}
.habit-checkin-note-list {
  display: grid;
  gap: 8px;
}
.habit-checkin-note-row span {
  min-width: 48px;
  color: var(--muted, #647269);
  font-size: 12px;
  font-weight: 750;
}
.habit-checkin-note-row input {
  min-width: 160px;
  flex: 1 1 180px;
}
.habit-wallet-panel {
  display: grid;
  gap: 14px;
}
.habit-wallet-total {
  padding: 6px 10px;
  border: 1px solid rgba(42, 75, 56, .12);
  border-radius: 8px;
  background: #fff;
  color: var(--text, #17211b);
  font-size: 13px;
}
.habit-reward-form {
  display: grid;
  grid-template-columns: 1.3fr .7fr .8fr .7fr 1.3fr auto;
  gap: 10px;
  align-items: end;
  padding: 12px;
  border: 1px solid rgba(42, 75, 56, .11);
  border-radius: 12px;
  background: #fbfdfb;
}
.habit-reward-form .form-field {
  display: grid;
  gap: 5px;
  min-width: 0;
}
.habit-reward-form .form-field span {
  color: var(--muted, #647269);
  font-size: 12px;
  font-weight: 800;
}
.habit-reward-form input {
  width: 100%;
  min-height: 38px;
  padding: 8px 10px;
  border: 1px solid var(--line, #dfe7e1);
  border-radius: 8px;
  background: #fff;
  color: var(--text, #17211b);
}
.habit-wallet-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(240px, .8fr);
  gap: 14px;
}
.habit-reward-list,
.habit-ledger-panel {
  display: grid;
  gap: 10px;
  align-content: start;
}
.habit-ledger-panel {
  padding: 12px;
  border: 1px solid rgba(42, 75, 56, .11);
  border-radius: 12px;
  background: #fbfdfb;
}
.habit-ledger-panel h3 {
  margin: 0;
  font-size: 14px;
}
.habit-reward-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 12px;
  border: 1px solid rgba(42, 75, 56, .11);
  border-radius: 12px;
  background: #fff;
}
.habit-reward-card.archived,
.habit-library-row.archived {
  opacity: .64;
}
.habit-reward-card strong,
.habit-reward-card span,
.habit-reward-card p {
  display: block;
  min-width: 0;
  overflow-wrap: anywhere;
}
.habit-reward-card span,
.habit-reward-card p {
  margin: 3px 0 0;
  color: var(--muted, #647269);
  font-size: 12px;
}
.habit-reward-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.habit-ledger-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 0;
  border-top: 1px solid rgba(42, 75, 56, .09);
}
.habit-ledger-row span {
  min-width: 0;
  overflow-wrap: anywhere;
}
.habit-ledger-row.plus strong {
  color: #1d7f4d;
}
.habit-ledger-row.minus strong {
  color: #b84949;
}
.habit-diagnostics-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.habit-diagnostics-panel > .section-title-row { order: 1; }
.habit-diagnostics-panel > .habit-annual-analysis { order: 2; }
.habit-diagnostics-panel > .habit-matrix-summary { order: 3; }
.habit-diagnostics-panel > .habit-matrix-block { order: 4; }
.habit-diagnostics-panel > .habit-analysis-summary { order: 5; }
.habit-diagnostics-panel > .habit-diagnostics-grid { order: 6; }
.habit-diagnostics-panel > .habit-diagnostics-issues { order: 7; }
.habit-diagnostics-pill {
  padding: 5px 9px;
  border: 1px solid rgba(42, 75, 56, .14);
  border-radius: 999px;
  background: #fff;
  color: var(--muted, #647269);
  font-size: 12px;
  font-weight: 800;
}
.habit-diagnostics-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.habit-diagnostics-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}
.habit-diagnostics-grid article,
.habit-diagnostics-issue {
  min-width: 0;
  padding: 12px;
  border: 1px solid rgba(42, 75, 56, .11);
  border-radius: 12px;
  background: #fbfdfb;
}
.habit-diagnostics-grid span,
.habit-diagnostics-issue span {
  display: block;
  color: var(--muted, #647269);
  font-size: 12px;
  overflow-wrap: anywhere;
}
.habit-diagnostics-grid strong,
.habit-diagnostics-issue strong {
  display: block;
  margin-top: 3px;
  color: var(--text, #17211b);
  overflow-wrap: anywhere;
}
.habit-diagnostics-issues {
  display: grid;
  gap: 8px;
}
.habit-diagnostics-issue.is-danger {
  border-color: rgba(184, 73, 73, .28);
  background: #fff8f8;
}
.habit-diagnostics-issue.is-warning {
  border-color: rgba(170, 130, 28, .25);
  background: #fffdf4;
}
.habit-management-card {
  display: grid;
  gap: 14px;
}
.habit-editor-form {
  display: grid;
  grid-template-columns: repeat(4, minmax(140px, 1fr));
  gap: 12px;
  align-items: end;
  padding: 14px;
  border: 1px solid rgba(42, 75, 56, .11);
  border-radius: 12px;
  background: #fbfdfb;
}
.habit-editor-form .form-field {
  display: grid;
  gap: 5px;
  min-width: 0;
}
.habit-editor-form .form-field span,
.habit-weekday-field > span {
  color: var(--muted, #647269);
  font-size: 12px;
  font-weight: 800;
}
.habit-weekday-field {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
  grid-column: 1 / -1;
  min-height: 38px;
}
.habit-weekday-field label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 32px;
  padding: 5px 9px;
  border: 1px solid #dbe7df;
  border-radius: 999px;
  background: #fff;
  color: var(--text, #17211b);
  font-size: 12px;
  font-weight: 750;
}
.habit-weekday-field input {
  width: 14px;
  height: 14px;
}
.habit-advanced-fields {
  grid-column: 1 / -1;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid rgba(42, 75, 56, .12);
  border-radius: 10px;
  background: #fff;
}
.habit-advanced-fields summary {
  cursor: pointer;
  color: var(--text, #17211b);
  font-size: 13px;
  font-weight: 850;
}
.habit-advanced-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(130px, 1fr));
  gap: 10px;
  margin-top: 12px;
}
.habit-check-field {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  color: var(--text, #17211b);
  font-size: 13px;
  font-weight: 750;
}
.habit-check-field input {
  width: 16px;
  height: 16px;
}
.habit-milestone-editor {
  display: grid;
  gap: 7px;
  margin-top: 12px;
}
.habit-milestone-head,
.habit-milestone-row {
  display: grid;
  grid-template-columns: minmax(86px, .8fr) repeat(4, minmax(92px, 1fr));
  gap: 8px;
  align-items: center;
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
}
.habit-milestone-head {
  color: var(--muted, #647269);
  font-size: 12px;
  font-weight: 800;
}
.habit-milestone-row label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 12px;
  font-weight: 750;
}
.habit-milestone-row input {
  width: 100%;
  min-width: 0;
  min-height: 34px;
  padding: 7px 8px;
  border: 1px solid var(--line, #dfe7e1);
  border-radius: 8px;
  background: #fff;
  color: var(--text, #17211b);
}
.habit-milestone-row label input[type="checkbox"] {
  width: 16px;
  min-height: auto;
  flex: 0 0 auto;
}
.habit-management-table {
  margin-top: 2px;
}
.habit-library-row.is-target {
  background: #f5fbf7;
}
@media (max-width: 520px) {
  .habit-correction-form > *,
  .habit-checkin-note-row > * {
    width: 100%;
  }
}
@media (max-width: 900px) {
  .habit-center-kpis,
  .habit-sync-points {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .habit-center-hero {
    flex-direction: column;
  }
  .habit-editor-form,
  .habit-advanced-grid,
  .habit-reward-form,
  .habit-wallet-layout,
  .habit-diagnostics-grid,
  .habit-analysis-summary-grid,
  .habit-annual-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .habit-reward-form .reward-note,
  .habit-reward-form .form-actions,
  .habit-ledger-panel {
    grid-column: 1 / -1;
  }
  .habit-milestone-head {
    display: none;
  }
  .habit-milestone-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    padding: 8px;
    border: 1px solid rgba(42, 75, 56, .10);
    border-radius: 8px;
  }
  .habit-milestone-row label {
    grid-column: 1 / -1;
  }
}
@media (max-width: 620px) {
  .habit-center-kpis,
  .habit-sync-points,
  .habit-editor-form,
  .habit-advanced-grid,
  .habit-milestone-row,
  .habit-reward-form,
  .habit-wallet-layout,
  .habit-diagnostics-grid,
  .habit-analysis-summary-grid,
  .habit-annual-stats,
  .habit-reward-card {
    grid-template-columns: minmax(0, 1fr);
  }
  .habit-reward-actions {
    justify-content: stretch;
  }
  .habit-reward-actions .btn {
    flex: 1 1 120px;
  }
  .habit-management-table {
    overflow-x: auto;
  }
}
</style>
