import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

import { createLegacyServices, genId, getNowLocal, getTodayStr } from '../services/legacyServices';
import type { DataEntity, LifePlanData } from '../types/lifePlan';
import { useLifePlanStore } from './lifePlanStore';

const DEFAULT_CURRENCY = '金币';
const MILESTONE_DAYS = [7, 15, 21, 30, 90, 180, 365];
const MILESTONE_LABELS: Record<number, string> = {
  7: '一周',
  15: '15天',
  21: '21天',
  30: '30天',
  90: '一个季度',
  180: '半年',
  365: '一年',
};
const habitServices = createLegacyServices();

export type HabitRule = 'daily' | 'weekly-fixed' | 'weekly-count' | 'monthly-count' | 'interval';

interface Habit extends DataEntity {
  id: string;
  name: string;
  rule?: HabitRule;
  weekdays?: string[];
  count?: number;
  timesPerDay?: string;
  tag?: string;
  goalCount?: number;
  noteMode?: 'ask' | 'never';
  rewardPoints?: number;
  rewardCurrency?: string;
  penaltyPoints?: number;
  penaltyCurrency?: string;
  randomReward?: boolean;
  rewardMin?: number;
  rewardMax?: number;
  breakPenaltyMode?: 'none' | 'fixed' | 'stage';
  breakPenaltyPoints?: number;
  breakPenaltyCurrency?: string;
  milestoneRewards?: HabitMilestone[];
  startDate?: string;
  archived?: boolean;
}

interface HabitCheckin extends DataEntity {
  id: string;
  habitId: string;
  date: string;
  time: string;
  checkinAt: string;
  note: string;
}

interface HabitReward extends DataEntity {
  id: string;
  name: string;
  cost?: number;
  currency?: string;
  stock?: number;
  redeemedCount?: number;
  note?: string;
  archived?: boolean;
}

interface HabitLedgerEntry extends DataEntity {
  id: string;
  amount: number;
  currency: string;
  type: string;
  habitId?: string;
  rewardId?: string;
  sourceId?: string;
  date?: string;
  note?: string;
}

interface HabitMilestone {
  days: number;
  enabled: boolean;
  rewardAmount: number;
  currency: string;
  penaltyAmount: number;
  penaltyCurrency: string;
}

export interface CreateHabitInput {
  name: string;
  tag?: string;
  timesPerDay?: number;
  rule?: HabitRule;
  weekdays?: string[];
  count?: number;
  goalCount?: number;
  noteMode?: 'ask' | 'never';
  rewardPoints?: number;
  rewardCurrency?: string;
  penaltyPoints?: number;
  penaltyCurrency?: string;
  randomReward?: boolean;
  rewardMin?: number;
  rewardMax?: number;
  breakPenaltyMode?: 'none' | 'fixed' | 'stage';
  breakPenaltyPoints?: number;
  breakPenaltyCurrency?: string;
  milestoneRewards?: Partial<HabitMilestone>[];
}

export interface UpdateHabitInput extends CreateHabitInput {}

export interface CreateHabitRewardInput {
  name: string;
  cost?: number;
  currency?: string;
  stock?: number;
  note?: string;
}

function asHabit(value: DataEntity): Habit {
  return value as Habit;
}

function asCheckin(value: DataEntity): HabitCheckin {
  return value as HabitCheckin;
}

function asReward(value: DataEntity): HabitReward {
  return value as HabitReward;
}

function asLedgerEntry(value: DataEntity): HabitLedgerEntry {
  return value as HabitLedgerEntry;
}

function normalizeCurrency(value: unknown): string {
  return String(value || '').trim() || DEFAULT_CURRENCY;
}

function targetCount(habit: Habit): number {
  return Math.max(1, Number.parseInt(String(habit.timesPerDay || '1'), 10) || 1);
}

function addDays(dateText: string, offset: number): string {
  const date = new Date(`${dateText}T12:00:00`);
  date.setDate(date.getDate() + offset);
  return getTodayStr(date);
}

function isDueOnDate(habit: Habit, dateText: string): boolean {
  if (!dateText || habit.archived || (habit.startDate && dateText < habit.startDate)) return false;
  const date = new Date(`${dateText}T12:00:00`);
  switch (habit.rule) {
    case 'weekly-fixed':
      return Array.isArray(habit.weekdays) && habit.weekdays.includes(String(date.getDay()));
    case 'weekly-count':
      return (date.getDay() || 7) === 1;
    case 'monthly-count':
      return date.getDate() === 1;
    case 'interval': {
      if (!habit.startDate) return true;
      const start = new Date(`${habit.startDate}T12:00:00`);
      const elapsed = Math.floor((date.getTime() - start.getTime()) / 86_400_000);
      const every = Math.max(1, Number.parseInt(String(habit.count || 1), 10) || 1);
      return elapsed >= 0 && elapsed % every === 0;
    }
    default:
      return true;
  }
}

function milestoneDefaults(): HabitMilestone[] {
  return MILESTONE_DAYS.map(days => ({
    days,
    enabled: false,
    rewardAmount: 0,
    currency: DEFAULT_CURRENCY,
    penaltyAmount: 0,
    penaltyCurrency: DEFAULT_CURRENCY,
  }));
}

function normalizedMilestones(raw: unknown): HabitMilestone[] {
  const supplied = new Map<number, Partial<HabitMilestone>>();
  if (Array.isArray(raw)) {
    raw.forEach(value => {
      const item = value as Partial<HabitMilestone>;
      const days = Number.parseInt(String(item.days || 0), 10);
      if (MILESTONE_DAYS.includes(days)) supplied.set(days, item);
    });
  }
  return milestoneDefaults().map(fallback => {
    const item = supplied.get(fallback.days) || {};
    const rewardAmount = Math.max(0, Number.parseInt(String(item.rewardAmount ?? 0), 10) || 0);
    const penaltyAmount = Math.max(0, Number.parseInt(String(item.penaltyAmount ?? 0), 10) || 0);
    return {
      days: fallback.days,
      enabled: Boolean(item.enabled || rewardAmount > 0 || penaltyAmount > 0),
      rewardAmount,
      currency: normalizeCurrency(item.currency),
      penaltyAmount,
      penaltyCurrency: normalizeCurrency(item.penaltyCurrency || item.currency),
    };
  });
}

function normalizeRule(value: unknown): HabitRule {
  return ['daily', 'weekly-fixed', 'weekly-count', 'monthly-count', 'interval'].includes(String(value))
    ? String(value) as HabitRule
    : 'daily';
}

function normalizeHabitBaseInput(input: CreateHabitInput | UpdateHabitInput) {
  const name = input.name.trim();
  if (!name) throw new Error('请输入习惯名称');
  const rule = normalizeRule(input.rule);
  const weekdays = rule === 'weekly-fixed'
    ? (Array.isArray(input.weekdays) ? input.weekdays.map(String).filter(value => /^[0-6]$/.test(value)) : [])
    : [];
  if (rule === 'weekly-fixed' && !weekdays.length) throw new Error('请至少选择一天');
  const timesPerDay = Math.max(1, Math.min(99, Math.trunc(Number(input.timesPerDay) || 1)));
  const count = Math.max(1, Math.min(99, Math.trunc(Number(input.count) || 3)));
  const goalCount = Math.max(0, Math.trunc(Number(input.goalCount) || 0));
  const rewardPoints = Math.max(0, Math.trunc(Number(input.rewardPoints) || 0));
  const rewardMin = Math.max(0, Math.trunc(Number(input.rewardMin ?? rewardPoints) || 0));
  const rewardMax = Math.max(rewardMin, Math.trunc(Number(input.rewardMax ?? rewardMin) || rewardMin));
  const breakPenaltyMode = ['none', 'fixed', 'stage'].includes(String(input.breakPenaltyMode))
    ? input.breakPenaltyMode as 'none' | 'fixed' | 'stage'
    : 'none';
  return {
    name,
    rule,
    weekdays,
    count,
    timesPerDay: String(timesPerDay),
    tag: String(input.tag || '').trim(),
    goalCount,
    noteMode: input.noteMode === 'never' ? 'never' as const : 'ask' as const,
    rewardPoints,
    rewardCurrency: normalizeCurrency(input.rewardCurrency),
    penaltyPoints: Math.max(0, Math.trunc(Number(input.penaltyPoints) || 0)),
    penaltyCurrency: normalizeCurrency(input.penaltyCurrency || input.rewardCurrency),
    randomReward: Boolean(input.randomReward),
    rewardMin,
    rewardMax,
    breakPenaltyMode,
    breakPenaltyPoints: Math.max(0, Math.trunc(Number(input.breakPenaltyPoints) || 0)),
    breakPenaltyCurrency: normalizeCurrency(input.breakPenaltyCurrency || input.penaltyCurrency || input.rewardCurrency),
    milestoneRewards: normalizedMilestones(input.milestoneRewards),
  };
}

function habitComparable(habit: Partial<Habit>) {
  return JSON.stringify({
    name: habit.name || '',
    rule: habit.rule || 'daily',
    weekdays: Array.isArray(habit.weekdays) ? habit.weekdays : [],
    count: Number(habit.count || 0),
    timesPerDay: String(habit.timesPerDay || '1'),
    tag: habit.tag || '',
    goalCount: Number(habit.goalCount || 0),
    noteMode: habit.noteMode || 'ask',
    rewardPoints: Number(habit.rewardPoints || 0),
    rewardCurrency: normalizeCurrency(habit.rewardCurrency),
    penaltyPoints: Number(habit.penaltyPoints || 0),
    penaltyCurrency: normalizeCurrency(habit.penaltyCurrency || habit.rewardCurrency),
    randomReward: Boolean(habit.randomReward),
    rewardMin: Number(habit.rewardMin ?? habit.rewardPoints ?? 0),
    rewardMax: Number(habit.rewardMax ?? habit.rewardPoints ?? 0),
    breakPenaltyMode: habit.breakPenaltyMode || 'none',
    breakPenaltyPoints: Number(habit.breakPenaltyPoints || 0),
    breakPenaltyCurrency: normalizeCurrency(habit.breakPenaltyCurrency || habit.penaltyCurrency || habit.rewardCurrency),
    milestoneRewards: normalizedMilestones(habit.milestoneRewards),
  });
}

function habitSlice(data: LifePlanData) {
  return {
    habits: data.habits,
    checkins: data.checkins,
    habitPointLedger: data.habitPointLedger,
    habitRewards: data.habitRewards,
    habitCurrencies: data.habitCurrencies,
    deletedItems: data.deletedItems,
  };
}

function ensureHabitCurrencies(data: LifePlanData, habit: Partial<Habit>) {
  const names = new Set<string>([DEFAULT_CURRENCY]);
  [habit.rewardCurrency, habit.penaltyCurrency, habit.breakPenaltyCurrency].forEach(value => names.add(normalizeCurrency(value)));
  normalizedMilestones(habit.milestoneRewards).forEach(item => {
    names.add(normalizeCurrency(item.currency));
    names.add(normalizeCurrency(item.penaltyCurrency));
  });
  names.forEach(name => {
    ensureHabitCurrency(data, name);
  });
}

function ensureHabitCurrency(data: LifePlanData, value: unknown) {
  const name = normalizeCurrency(value);
  if (data.habitCurrencies.some(item => normalizeCurrency(item.name || item.currency || item.id) === name)) return name;
  data.habitCurrencies.push({
    id: name === DEFAULT_CURRENCY ? 'habit-currency-default' : genId(),
    name,
    createdAt: getNowLocal(),
    updatedAt: getNowLocal(),
  });
  return name;
}

function balanceFor(data: LifePlanData, currency: string) {
  const targetCurrency = normalizeCurrency(currency);
  return data.habitPointLedger
    .map(asLedgerEntry)
    .filter(entry => normalizeCurrency(entry.currency) === targetCurrency)
    .reduce((total, entry) => total + (Number(entry.amount) || 0), 0);
}

function rewardCost(reward: Partial<HabitReward>): number {
  return Math.max(1, Number.parseInt(String(reward.cost || 0), 10) || 1);
}

function rewardStockLeft(reward: Partial<HabitReward>): number {
  const stock = Math.max(0, Number.parseInt(String(reward.stock || 0), 10) || 0);
  if (stock <= 0) return Infinity;
  return Math.max(0, stock - (Number.parseInt(String(reward.redeemedCount || 0), 10) || 0));
}

export const useHabitsStore = defineStore('habits', () => {
  const lifePlan = useLifePlanStore();
  const lastError = ref('');
  const lastAction = ref('');

  const habits = computed(() => lifePlan.data.habits.map(asHabit));
  const todayHabits = computed(() => habits.value.filter(habit => isDueOnDate(habit, getTodayStr())));
  const rewards = computed(() => lifePlan.data.habitRewards.map(asReward));
  const latestLedger = computed(() => lifePlan.data.habitPointLedger
    .map(asLedgerEntry)
    .sort((a, b) => String(b.createdAt || b.date || '').localeCompare(String(a.createdAt || a.date || '')))
    .slice(0, 8));
  const diagnostics = computed(() => habitServices.habit.buildLegacyHabitDiagnostics(lifePlan.data) as {
    readOnly?: boolean;
    authority?: string;
    summary?: Record<string, any>;
    issues?: Array<{
      type?: string;
      id?: string;
      label?: string;
      title?: string;
      severity?: string;
      hint?: string;
      message?: string;
      details?: unknown[];
      count?: number;
      hiddenCount?: number;
    }>;
  });
  const diagnosticIssues = computed(() => [...(diagnostics.value.issues || [])]
    .sort((a, b) => {
      const rank: Record<string, number> = { danger: 0, warning: 1, info: 2 };
      return (rank[a.severity || 'info'] ?? 3) - (rank[b.severity || 'info'] ?? 3);
    })
    .slice(0, 4));
  const dualWriteReadiness = computed(() => {
    const buildReadiness = habitServices.habit.buildHabitDualWriteReadiness;
    if (typeof buildReadiness === 'function') {
      return buildReadiness(lifePlan.data, diagnostics.value) as Record<string, any>;
    }
    return {
      status: 'prepared',
      statusLabel: '诊断服务不可用',
      summary: {},
      blockers: [],
      writePaths: [],
      nextActions: [],
      readOnly: true,
      remoteUploadEnabled: false,
    };
  });
  const repairPreview = computed(() => {
    const habitIds = new Set(lifePlan.data.habits.map(item => String(item.id || '').trim()).filter(Boolean));
    const today = getTodayStr();
    const orphanCheckins = lifePlan.data.checkins.filter(item => {
      const habitId = String(item.habitId || '').trim();
      return Boolean(habitId && !habitIds.has(habitId));
    });
    const futureCheckins = lifePlan.data.checkins.filter(item => String(item.date || '').trim() > today);
    const invalidLedger = lifePlan.data.habitPointLedger.filter(item => !Number.isFinite(Number(item.amount)));
    const emptyLedgerCurrencies = lifePlan.data.habitPointLedger.filter(item => Number.isFinite(Number(item.amount)) && !String(item.currency || '').trim());
    const emptyRewardCurrencies = lifePlan.data.habitRewards.filter(item => !String(item.currency || '').trim());
    const checkinIds = new Set([...orphanCheckins, ...futureCheckins].map(item => String(item.id || '')).filter(Boolean));
    return {
      orphanCheckins: orphanCheckins.length,
      futureCheckins: futureCheckins.length,
      invalidLedger: invalidLedger.length,
      emptyLedgerCurrencies: emptyLedgerCurrencies.length,
      emptyRewardCurrencies: emptyRewardCurrencies.length,
      removableCheckins: checkinIds.size,
      total: checkinIds.size + invalidLedger.length + emptyLedgerCurrencies.length + emptyRewardCurrencies.length,
    };
  });
  const repairableCount = computed(() => repairPreview.value.total);
  const balances = computed(() => lifePlan.data.habitPointLedger.reduce<Record<string, number>>((summary, entry) => {
    const currency = normalizeCurrency(entry.currency);
    summary[currency] = (summary[currency] || 0) + (Number(entry.amount) || 0);
    return summary;
  }, {}));

  function getCheckins(habitId: string, date = getTodayStr()): HabitCheckin[] {
    return lifePlan.data.checkins
      .map(asCheckin)
      .filter(item => item.habitId === habitId && item.date === date)
      .sort((a, b) => {
        const aValue = a.checkinAt || (a.time ? `${a.date}T${a.time}:00` : a.createdAt || '');
        const bValue = b.checkinAt || (b.time ? `${b.date}T${b.time}:00` : b.createdAt || '');
        return aValue.localeCompare(bValue);
      });
  }

  function getCheckinCount(habitId: string, date = getTodayStr()): number {
    return getCheckins(habitId, date).length;
  }

  function rebuildLocalMirror(reason: string) {
    const habitService = window.LifePlanHabitService.create({
      defaultCurrency: DEFAULT_CURRENCY,
      getTodayStr,
      addDays,
      isHabitDueOnDate: isDueOnDate,
      getHabitTargetCount: targetCount,
    });
    const source = habitSlice(lifePlan.data);
    const sourceHash = habitServices.sync.getDataHash(source);
    const enabledPaths = typeof habitService.getHabitDualWritePathInventory === 'function'
      ? habitService.getHabitDualWritePathInventory()
        .filter((item: { dualWrite?: string }) => item.dualWrite === 'enabled')
        .map((item: { id: string }) => item.id)
      : [];
    const built = habitService.buildHabitAppLocalMirror(lifePlan.data, {
      reason,
      sourceHash,
      generatedAt: new Date().toISOString(),
      dualWriteEnabledPaths: enabledPaths,
    });
    localStorage.setItem('habitAppData', JSON.stringify({
      ...built.snapshot,
      localMirror: true,
      remoteUploadEnabled: false,
    }));
  }

  function addLedgerEntry(data: LifePlanData, input: {
    amount: number;
    type: string;
    habitId: string;
    sourceId: string;
    date: string;
    note: string;
    currency: string;
    rewardId?: string;
  }) {
    if (!input.amount) return;
    const now = getNowLocal();
    data.habitPointLedger.push({
      id: genId(),
      amount: input.amount,
      currency: normalizeCurrency(input.currency),
      type: input.type,
      habitId: input.habitId,
      rewardId: input.rewardId || '',
      sourceId: input.sourceId,
      date: input.date,
      note: input.note,
      createdAt: now,
      updatedAt: now,
    });
  }

  function addCheckinReward(data: LifePlanData, habit: Habit, checkin: HabitCheckin) {
    if (data.habitPointLedger.some(entry => entry.type === 'checkin' && entry.sourceId === checkin.id)) return;
    const fixed = Math.max(0, Number.parseInt(String(habit.rewardPoints ?? 0), 10) || 0);
    const min = Math.max(0, Number.parseInt(String(habit.rewardMin ?? fixed), 10) || 0);
    const max = Math.max(min, Number.parseInt(String(habit.rewardMax ?? min), 10) || min);
    const amount = habit.randomReward ? Math.floor(Math.random() * (max - min + 1)) + min : fixed;
    addLedgerEntry(data, {
      amount,
      type: 'checkin',
      habitId: habit.id,
      sourceId: checkin.id,
      date: checkin.date,
      note: `完成「${habit.name}」`,
      currency: normalizeCurrency(habit.rewardCurrency),
    });
  }

  function addMilestoneRewards(data: LifePlanData, habit: Habit, checkin: HabitCheckin) {
    const countForDate = data.checkins.filter(item => item.habitId === habit.id && item.date === checkin.date).length;
    if (countForDate < targetCount(habit)) return;
    const milestones = normalizedMilestones(habit.milestoneRewards);
    const cycleLength = Math.max(0, ...milestones.filter(item => item.enabled).map(item => item.days));
    if (!cycleLength) return;

    const completedDates = new Set<string>();
    const counts = new Map<string, number>();
    data.checkins.forEach(item => {
      if (item.habitId !== habit.id || String(item.date) > checkin.date) return;
      const date = String(item.date || '');
      counts.set(date, (counts.get(date) || 0) + 1);
    });
    counts.forEach((count, date) => {
      if (count >= targetCount(habit)) completedDates.add(date);
    });
    let streak = 0;
    for (let cursor = checkin.date; completedDates.has(cursor); cursor = addDays(cursor, -1)) streak += 1;
    if (!streak) return;
    const cycleIndex = Math.floor((streak - 1) / cycleLength);
    const dayInCycle = ((streak - 1) % cycleLength) + 1;

    milestones
      .filter(item => item.enabled && item.rewardAmount > 0 && item.days === dayInCycle)
      .forEach(item => {
        const sourceId = `${checkin.id}:milestone:${cycleLength}:${cycleIndex}:${item.days}`;
        if (data.habitPointLedger.some(entry => entry.type === 'milestone' && entry.sourceId === sourceId)) return;
        addLedgerEntry(data, {
          amount: item.rewardAmount,
          type: 'milestone',
          habitId: habit.id,
          sourceId,
          date: checkin.date,
          note: `连续${item.days}天奖励「${habit.name}」`,
          currency: item.currency,
        });
      });
  }

  function reverseCheckinRewards(data: LifePlanData, habit: Habit, checkin: HabitCheckin) {
    if (data.habitPointLedger.some(entry => entry.type === 'reverse' && entry.sourceId === checkin.id)) return;
    const totals = new Map<string, number>();
    data.habitPointLedger
      .filter(entry => {
        if (entry.type === 'checkin' && entry.sourceId === checkin.id) return true;
        return entry.type === 'milestone' && String(entry.sourceId || '').startsWith(`${checkin.id}:milestone:`);
      })
      .forEach(entry => {
        const currency = normalizeCurrency(entry.currency);
        totals.set(currency, (totals.get(currency) || 0) + (Number(entry.amount) || 0));
      });
    totals.forEach((total, currency) => {
      if (!total) return;
      addLedgerEntry(data, {
        amount: -total,
        type: 'reverse',
        habitId: habit.id,
        sourceId: checkin.id,
        date: checkin.date,
        note: `撤销打卡「${habit.name}」`,
        currency,
      });
    });
  }

  function reversePenaltiesForDate(data: LifePlanData, habit: Habit, date: string) {
    const prefix = `${habit.id}:${date}:penalty-reversal:`;
    const previouslyReversed = new Map<string, number>();
    data.habitPointLedger
      .filter(entry => entry.type === 'reverse-penalty' && String(entry.sourceId || '').startsWith(prefix))
      .forEach(entry => {
        const currency = normalizeCurrency(entry.currency);
        previouslyReversed.set(currency, (previouslyReversed.get(currency) || 0) + (Number(entry.amount) || 0));
      });
    const penalties = new Map<string, number>();
    data.habitPointLedger
      .filter(entry => entry.habitId === habit.id && entry.date === date && ['miss', 'break'].includes(String(entry.type)) && (Number(entry.amount) || 0) < 0)
      .forEach(entry => {
        const currency = normalizeCurrency(entry.currency);
        penalties.set(currency, (penalties.get(currency) || 0) + Math.abs(Number(entry.amount) || 0));
      });
    penalties.forEach((total, currency) => {
      const amount = total - (previouslyReversed.get(currency) || 0);
      if (amount <= 0) return;
      addLedgerEntry(data, {
        amount,
        type: 'reverse-penalty',
        habitId: habit.id,
        sourceId: `${prefix}${currency}`,
        date,
        note: `补卡冲销扣分「${habit.name}」`,
        currency,
      });
    });
  }

  function checkinCountOnDate(data: LifePlanData, habitId: string, date: string): number {
    return data.checkins.filter(item => item.habitId === habitId && item.date === date).length;
  }

  function completedDatesUpTo(data: LifePlanData, habit: Habit, upToDate: string): Set<string> {
    const counts = new Map<string, number>();
    data.checkins.forEach(item => {
      if (item.habitId !== habit.id) return;
      const date = String(item.date || '');
      if (!date || date > upToDate) return;
      counts.set(date, (counts.get(date) || 0) + 1);
    });
    const target = targetCount(habit);
    const completed = new Set<string>();
    counts.forEach((count, date) => {
      if (count >= target) completed.add(date);
    });
    return completed;
  }

  function streakEndingOn(data: LifePlanData, habit: Habit, date: string): number {
    const completed = completedDatesUpTo(data, habit, date);
    let streak = 0;
    for (let cursor = date; completed.has(cursor); cursor = addDays(cursor, -1)) streak += 1;
    return streak;
  }

  function streakBeforeDate(data: LifePlanData, habit: Habit, date: string): number {
    return streakEndingOn(data, habit, addDays(date, -1));
  }

  function enabledPenaltyMilestones(habit: Habit): HabitMilestone[] {
    return normalizedMilestones(habit.milestoneRewards)
      .filter(item => item.enabled && item.penaltyAmount > 0)
      .sort((a, b) => a.days - b.days);
  }

  function milestoneCycleLength(habit: Habit): number {
    const enabled = normalizedMilestones(habit.milestoneRewards).filter(item => item.enabled);
    return enabled.length ? Math.max(...enabled.map(item => item.days)) : 0;
  }

  function nextMilestoneForPenalty(habit: Habit, previousStreak: number): HabitMilestone | null {
    const milestones = enabledPenaltyMilestones(habit);
    const cycleLength = milestoneCycleLength(habit);
    if (!milestones.length || !cycleLength || previousStreak <= 0) return null;
    const dayInCycle = ((previousStreak - 1) % cycleLength) + 1;
    return milestones.find(item => item.days > dayInCycle) || milestones[0];
  }

  function applyMissPenalty(data: LifePlanData, habit: Habit, date: string): boolean {
    const penalty = Math.max(0, Number.parseInt(String(habit.penaltyPoints || 0), 10) || 0);
    if (!habit || penalty <= 0) return false;
    const sourceId = `${habit.id}:${date}:miss`;
    if (data.habitPointLedger.some(entry => entry.sourceId === sourceId)) return false;
    if (!isDueOnDate(habit, date)) return false;
    if (checkinCountOnDate(data, habit.id, date) >= targetCount(habit)) return false;
    addLedgerEntry(data, {
      amount: -penalty,
      type: 'miss',
      habitId: habit.id,
      sourceId,
      date,
      note: `未完成「${habit.name}」`,
      currency: normalizeCurrency(habit.penaltyCurrency || habit.rewardCurrency),
    });
    return true;
  }

  function applyBreakPenalty(data: LifePlanData, habit: Habit, date: string): boolean {
    if (!habit || !isDueOnDate(habit, date)) return false;
    if (checkinCountOnDate(data, habit.id, date) >= targetCount(habit)) return false;
    const previousStreak = streakBeforeDate(data, habit, date);
    if (previousStreak <= 0) return false;

    if (habit.breakPenaltyMode === 'fixed') {
      const penalty = Math.max(0, Number.parseInt(String(habit.breakPenaltyPoints || 0), 10) || 0);
      if (penalty <= 0) return false;
      const sourceId = `${habit.id}:${date}:break:fixed`;
      if (data.habitPointLedger.some(entry => entry.sourceId === sourceId)) return false;
      addLedgerEntry(data, {
        amount: -penalty,
        type: 'break',
        habitId: habit.id,
        sourceId,
        date,
        note: `断签「${habit.name}」`,
        currency: normalizeCurrency(habit.breakPenaltyCurrency || habit.penaltyCurrency || habit.rewardCurrency),
      });
      return true;
    }

    if (habit.breakPenaltyMode === 'stage') {
      const milestone = nextMilestoneForPenalty(habit, previousStreak);
      if (!milestone) return false;
      const sourceId = `${habit.id}:${date}:break:stage:${milestone.days}`;
      if (data.habitPointLedger.some(entry => entry.sourceId === sourceId)) return false;
      addLedgerEntry(data, {
        amount: -milestone.penaltyAmount,
        type: 'break',
        habitId: habit.id,
        sourceId,
        date,
        note: `未达${MILESTONE_LABELS[milestone.days] || `${milestone.days}天`}断签「${habit.name}」`,
        currency: normalizeCurrency(milestone.penaltyCurrency),
      });
      return true;
    }

    return false;
  }

  function settlePenaltiesThroughYesterday(): { changed: boolean; missCount: number; breakCount: number } {
    const yesterday = addDays(getTodayStr(), -1);
    let missCount = 0;
    let breakCount = 0;

    try {
      // Preview against current data so a no-op settle does not mark dirty.
      const draft = lifePlan.data;
      draft.habits.map(asHabit).forEach(habit => {
        const start = habit.startDate || yesterday;
        if (start > yesterday) return;
        for (let date = start; date <= yesterday; date = addDays(date, 1)) {
          // Dry-run style checks only: apply* needs mutable ledger, so we detect pending work first.
          const dueAndMissed = isDueOnDate(habit, date)
            && checkinCountOnDate(draft, habit.id, date) < targetCount(habit);
          if (!dueAndMissed) continue;
          const missSourceId = `${habit.id}:${date}:miss`;
          const missPenalty = Math.max(0, Number.parseInt(String(habit.penaltyPoints || 0), 10) || 0);
          if (missPenalty > 0 && !draft.habitPointLedger.some(entry => entry.sourceId === missSourceId)) {
            missCount += 1;
          }
          const previousStreak = streakBeforeDate(draft, habit, date);
          if (previousStreak > 0) {
            if (habit.breakPenaltyMode === 'fixed') {
              const breakPenalty = Math.max(0, Number.parseInt(String(habit.breakPenaltyPoints || 0), 10) || 0);
              const breakSourceId = `${habit.id}:${date}:break:fixed`;
              if (breakPenalty > 0 && !draft.habitPointLedger.some(entry => entry.sourceId === breakSourceId)) {
                breakCount += 1;
              }
            } else if (habit.breakPenaltyMode === 'stage') {
              const milestone = nextMilestoneForPenalty(habit, previousStreak);
              if (milestone) {
                const breakSourceId = `${habit.id}:${date}:break:stage:${milestone.days}`;
                if (!draft.habitPointLedger.some(entry => entry.sourceId === breakSourceId)) {
                  breakCount += 1;
                }
              }
            }
          }
        }
      });

      const pending = missCount + breakCount;
      if (!pending) {
        lastAction.value = '昨日及更早没有新的扣分';
        lastError.value = '';
        return { changed: false, missCount: 0, breakCount: 0 };
      }

      missCount = 0;
      breakCount = 0;
      lifePlan.mutate('vue-settle-penalties', data => {
        data.habits.map(asHabit).forEach(habit => {
          const start = habit.startDate || yesterday;
          if (start > yesterday) return;
          for (let date = start; date <= yesterday; date = addDays(date, 1)) {
            if (applyMissPenalty(data, habit, date)) missCount += 1;
            if (applyBreakPenalty(data, habit, date)) breakCount += 1;
          }
        });
      });

      rebuildLocalMirror('vue-settle-penalties');
      lastAction.value = `已结算扣分：漏打 ${missCount} 条，断签 ${breakCount} 条`;
      lastError.value = '';
      return { changed: true, missCount, breakCount };
    } catch (error) {
      lastError.value = error instanceof Error ? error.message : String(error);
      return { changed: false, missCount: 0, breakCount: 0 };
    }
  }

  function create(input: CreateHabitInput): Habit {
    const base = normalizeHabitBaseInput(input);
    const now = getNowLocal();
    const habit: Habit = {
      id: genId(),
      ...base,
      startDate: getTodayStr(),
      createdAt: now,
      updatedAt: now,
    };
    try {
      lifePlan.mutate('vue-create-habit', data => {
        data.habits.push(habit);
        ensureHabitCurrencies(data, habit);
      });
      rebuildLocalMirror('vue-create-habit');
      lastAction.value = `已添加「${habit.name}」`;
      lastError.value = '';
      return habit;
    } catch (error) {
      lastError.value = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  function updateHabit(habitId: string, input: UpdateHabitInput): boolean {
    const base = normalizeHabitBaseInput(input);
    const current = habits.value.find(item => item.id === habitId);
    if (!current) {
      lastError.value = '未找到该习惯，未保存修改。';
      return false;
    }
    if (habitComparable(current) === habitComparable(base)) {
      lastAction.value = '习惯没有变化';
      lastError.value = '';
      return true;
    }

    try {
      lifePlan.mutate('vue-update-habit', data => {
        const target = data.habits.find(item => item.id === habitId) as Habit | undefined;
        if (!target) throw new Error('习惯已不存在，未保存修改。');
        const previousTag = String(target.tag || '');
        Object.assign(target, {
          ...base,
          startDate: target.startDate || getTodayStr(),
          createdAt: target.createdAt || getNowLocal(),
          updatedAt: getNowLocal(),
        });
        ensureHabitCurrencies(data, target);
        if (previousTag !== base.tag) {
          data.records.forEach(record => {
            if (record.isHabitRecord && record.habitId === habitId) {
              record.type = `习惯打卡-${base.tag}`;
              record.updatedAt = getNowLocal();
            }
          });
        }
      });
      rebuildLocalMirror('vue-update-habit');
      lastAction.value = `已保存「${base.name}」`;
      lastError.value = '';
      return true;
    } catch (error) {
      lastError.value = error instanceof Error ? error.message : String(error);
      return false;
    }
  }

  function deleteHabit(habitId: string): boolean {
    const habit = habits.value.find(item => item.id === habitId);
    if (!habit) {
      lastError.value = '未找到该习惯，未执行删除。';
      return false;
    }
    try {
      lifePlan.mutate('vue-delete-habit', data => {
        const target = data.habits.find(item => item.id === habitId) as Habit | undefined;
        habitServices.sync.markDeletedItem(data, 'habits', habitId, { reason: 'manual-delete', name: String(target?.name || habit.name || '') });
        data.checkins
          .filter(checkin => checkin.habitId === habitId)
          .forEach(checkin => habitServices.sync.markDeletedItem(data, 'checkins', checkin.id, { reason: 'habit-delete', habitId }));
        data.records = data.records.filter(record => !(record.isHabitRecord && record.habitId === habitId));
        data.habits = data.habits.filter(item => item.id !== habitId);
        data.checkins = data.checkins.filter(checkin => checkin.habitId !== habitId);
      });
      rebuildLocalMirror('vue-delete-habit');
      lastAction.value = `已删除「${habit.name}」`;
      lastError.value = '';
      return true;
    } catch (error) {
      lastError.value = error instanceof Error ? error.message : String(error);
      return false;
    }
  }

  function setHabitArchived(habitId: string, archived: boolean): boolean {
    const habit = habits.value.find(item => item.id === habitId);
    if (!habit) {
      lastError.value = '未找到该习惯，未更新归档状态。';
      return false;
    }
    try {
      lifePlan.mutate(archived ? 'vue-archive-habit' : 'vue-restore-habit', data => {
        const target = data.habits.find(item => item.id === habitId) as Habit | undefined;
        if (!target) throw new Error('习惯已不存在。');
        target.archived = archived;
        target.updatedAt = getNowLocal();
      });
      rebuildLocalMirror(archived ? 'vue-archive-habit' : 'vue-restore-habit');
      lastAction.value = archived ? `已归档「${habit.name}」` : `已恢复「${habit.name}」`;
      lastError.value = '';
      return true;
    } catch (error) {
      lastError.value = error instanceof Error ? error.message : String(error);
      return false;
    }
  }

  function createReward(input: CreateHabitRewardInput): HabitReward {
    const name = String(input.name || '').trim();
    if (!name) throw new Error('请输入心愿名称');
    const cost = Math.max(1, Math.trunc(Number(input.cost) || 10));
    const stock = Math.max(0, Math.trunc(Number(input.stock) || 0));
    const currency = normalizeCurrency(input.currency);
    const now = getNowLocal();
    const reward: HabitReward = {
      id: genId(),
      name,
      cost,
      currency,
      stock,
      redeemedCount: 0,
      note: String(input.note || '').trim(),
      createdAt: now,
      updatedAt: now,
    };
    try {
      lifePlan.mutate('vue-create-habit-reward', data => {
        ensureHabitCurrency(data, currency);
        data.habitRewards.push(reward);
      });
      rebuildLocalMirror('vue-create-habit-reward');
      lastAction.value = `已添加心愿「${name}」`;
      lastError.value = '';
      return reward;
    } catch (error) {
      lastError.value = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  function setRewardArchived(rewardId: string, archived: boolean): boolean {
    const reward = rewards.value.find(item => item.id === rewardId);
    if (!reward) {
      lastError.value = '未找到该心愿，未更新归档状态。';
      return false;
    }
    try {
      lifePlan.mutate(archived ? 'vue-archive-habit-reward' : 'vue-restore-habit-reward', data => {
        const target = data.habitRewards.find(item => item.id === rewardId) as HabitReward | undefined;
        if (!target) throw new Error('心愿已不存在。');
        target.archived = archived;
        target.updatedAt = getNowLocal();
      });
      rebuildLocalMirror(archived ? 'vue-archive-habit-reward' : 'vue-restore-habit-reward');
      lastAction.value = archived ? `已归档心愿「${reward.name}」` : `已恢复心愿「${reward.name}」`;
      lastError.value = '';
      return true;
    } catch (error) {
      lastError.value = error instanceof Error ? error.message : String(error);
      return false;
    }
  }

  function adjustPoints(input: {
    direction: 'add' | 'subtract';
    amount: number;
    currency?: string;
    note?: string;
  }): boolean {
    const amount = Math.max(1, Math.floor(Number(input.amount) || 0));
    if (!amount) {
      lastError.value = '积分数量至少为 1。';
      return false;
    }
    const signed = input.direction === 'subtract' ? -amount : amount;
    const currency = normalizeCurrency(input.currency || DEFAULT_CURRENCY);
    const note = String(input.note || '').trim()
      || (input.direction === 'add' ? `手动增加${currency}` : `手动扣除${currency}`);
    try {
      lifePlan.mutate('vue-adjust-habit-points', data => {
        const targetCurrency = ensureHabitCurrency(data, currency);
        addLedgerEntry(data, {
          amount: signed,
          currency: targetCurrency,
          type: 'adjust',
          habitId: '',
          sourceId: '',
          date: getTodayStr(),
          note,
        });
      });
      rebuildLocalMirror('adjust-points');
      lastAction.value = signed > 0
        ? `已增加 ${amount} ${currency}`
        : `已扣除 ${amount} ${currency}`;
      lastError.value = '';
      return true;
    } catch (error) {
      lastError.value = error instanceof Error ? error.message : String(error);
      return false;
    }
  }

  function redeemReward(rewardId: string): boolean {
    const reward = rewards.value.find(item => item.id === rewardId);
    if (!reward) {
      lastError.value = '未找到该心愿，未兑换。';
      return false;
    }
    if (reward.archived) {
      lastError.value = '这个心愿已归档，不能兑换。';
      return false;
    }
    const currency = normalizeCurrency(reward.currency);
    const cost = rewardCost(reward);
    const stockLeft = rewardStockLeft(reward);
    if (stockLeft <= 0) {
      lastError.value = '这个心愿已经没有库存了。';
      return false;
    }
    if (balanceFor(lifePlan.data, currency) < cost) {
      lastError.value = `${currency} 不够，先攒一点再兑换。`;
      return false;
    }
    try {
      lifePlan.mutate('vue-redeem-habit-reward', data => {
        const target = data.habitRewards.find(item => item.id === rewardId) as HabitReward | undefined;
        if (!target) throw new Error('心愿已不存在。');
        if (target.archived) throw new Error('这个心愿已归档，不能兑换。');
        const targetCurrency = ensureHabitCurrency(data, target.currency || currency);
        const targetCost = rewardCost({ cost: target.cost || cost });
        const remaining = rewardStockLeft(target);
        if (remaining <= 0) throw new Error('这个心愿已经没有库存了。');
        if (balanceFor(data, targetCurrency) < targetCost) throw new Error(`${targetCurrency} 不够，先攒一点再兑换。`);
        target.redeemedCount = Number(target.redeemedCount || 0) + 1;
        target.updatedAt = getNowLocal();
        addLedgerEntry(data, {
          amount: -targetCost,
          currency: targetCurrency,
          type: 'redeem',
          habitId: '',
          rewardId: target.id,
          sourceId: '',
          date: getTodayStr(),
          note: `兑换「${target.name}」`,
        });
      });
      rebuildLocalMirror('vue-redeem-habit-reward');
      lastAction.value = `已兑换「${reward.name}」`;
      lastError.value = '';
      return true;
    } catch (error) {
      lastError.value = error instanceof Error ? error.message : String(error);
      return false;
    }
  }

  function getRewardStockLeft(rewardId: string): number {
    const reward = rewards.value.find(item => item.id === rewardId);
    return reward ? rewardStockLeft(reward) : 0;
  }

  function canRedeemReward(rewardId: string): boolean {
    const reward = rewards.value.find(item => item.id === rewardId);
    if (!reward || reward.archived) return false;
    return rewardStockLeft(reward) > 0 && balanceFor(lifePlan.data, normalizeCurrency(reward.currency)) >= rewardCost(reward);
  }

  function appendCheckin(habitId: string, date = getTodayStr(), note = ''): boolean {
    const habit = habits.value.find(item => item.id === habitId);
    if (!habit) {
      lastError.value = '未找到该习惯，未写入任何数据。';
      return false;
    }
    if (date > getTodayStr()) {
      lastError.value = '不能补未来日期的习惯打卡。';
      return false;
    }
    if (!isDueOnDate(habit, date)) {
      lastError.value = '这条习惯不在该日期执行，未写入任何数据。';
      return false;
    }
    if (targetCount(habit) === 1 && getCheckinCount(habitId, date) > 0) {
      lastError.value = '这一天已完成该习惯；可编辑备注或先撤销。';
      return false;
    }

    try {
      lifePlan.mutate('vue-habit-append-checkin', data => {
        const target = data.habits.find(item => item.id === habitId) as Habit | undefined;
        if (!target) throw new Error('习惯已不存在，已取消打卡。');
        const now = new Date();
        const timestamp = `${date}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        const checkin: HabitCheckin = {
          id: genId(),
          habitId,
          date,
          time: timestamp.slice(11, 16),
          checkinAt: timestamp,
          createdAt: timestamp,
          updatedAt: getNowLocal(now),
          note: String(note || '').trim(),
        };
        data.checkins.push(checkin);
        addCheckinReward(data, target, checkin);
        addMilestoneRewards(data, target, checkin);
        reversePenaltiesForDate(data, target, date);
        target.updatedAt = getNowLocal(now);
      });
      rebuildLocalMirror('append-checkin');
      lastAction.value = date === getTodayStr() ? `已为「${habit.name}」打卡` : `已为「${habit.name}」补卡 ${date}`;
      lastError.value = '';
      return true;
    } catch (error) {
      lastError.value = error instanceof Error ? error.message : String(error);
      return false;
    }
  }

  function quickCheckin(habitId: string, note = ''): boolean {
    return appendCheckin(habitId, getTodayStr(), note);
  }

  function editCheckinNote(checkinId: string, note = ''): boolean {
    const checkin = lifePlan.data.checkins.map(asCheckin).find(item => item.id === checkinId);
    if (!checkin) {
      lastError.value = '未找到这条打卡记录。';
      return false;
    }
    try {
      lifePlan.mutate('vue-habit-edit-checkin-note', data => {
        const targetCheckin = data.checkins.find(item => item.id === checkinId) as HabitCheckin | undefined;
        if (!targetCheckin) throw new Error('打卡记录已不存在。');
        targetCheckin.note = String(note || '').trim();
        targetCheckin.updatedAt = getNowLocal();
        const targetHabit = data.habits.find(item => item.id === targetCheckin.habitId) as Habit | undefined;
        if (targetHabit) targetHabit.updatedAt = getNowLocal();
      });
      rebuildLocalMirror('edit-checkin-note');
      lastAction.value = '打卡备注已保存';
      lastError.value = '';
      return true;
    } catch (error) {
      lastError.value = error instanceof Error ? error.message : String(error);
      return false;
    }
  }

  function undoLatestCheckin(habitId: string, date = getTodayStr()): boolean {
    const habit = habits.value.find(item => item.id === habitId);
    const checkins = getCheckins(habitId, date);
    const latest = checkins[checkins.length - 1];
    if (!habit || !latest) {
      lastError.value = '没有可撤销的打卡记录。';
      return false;
    }
    try {
      lifePlan.mutate('vue-habit-decrease-checkin', data => {
        const target = data.habits.find(item => item.id === habitId) as Habit | undefined;
        if (!target) throw new Error('习惯已不存在。');
        reverseCheckinRewards(data, target, latest);
        habitServices.sync.markDeletedItem(data, 'checkins', latest.id, { reason: 'manual-decrease', habitId });
        data.checkins = data.checkins.filter(item => item.id !== latest.id);
        target.updatedAt = getNowLocal();
      });
      rebuildLocalMirror('decrease-checkin');
      lastAction.value = `已撤销「${habit.name}」${date} 的最近一次打卡`;
      lastError.value = '';
      return true;
    } catch (error) {
      lastError.value = error instanceof Error ? error.message : String(error);
      return false;
    }
  }

  function repairSafeDiagnosticIssues() {
    const preview = repairPreview.value;
    if (!preview.total) {
      lastAction.value = '没有可自动安全修复的问题';
      lastError.value = '';
      return { changed: false, ...preview };
    }
    try {
      lifePlan.createManualSnapshot('Habit 安全修复前自动快照');
      lifePlan.mutate('vue-repair-habit-diagnostics', data => {
        const habitIds = new Set(data.habits.map(item => String(item.id || '').trim()).filter(Boolean));
        const today = getTodayStr();
        const removedCheckins = data.checkins.filter(item => {
          const habitId = String(item.habitId || '').trim();
          return Boolean((habitId && !habitIds.has(habitId)) || String(item.date || '').trim() > today);
        });
        removedCheckins.forEach(item => {
          const id = String(item.id || '').trim();
          if (id) habitServices.sync.markDeletedItem(data, 'checkins', id, {
            reason: 'diagnostic-safe-repair',
            habitId: String(item.habitId || ''),
          });
        });
        const removedIds = new Set(removedCheckins.map(item => item.id));
        data.checkins = data.checkins.filter(item => !removedIds.has(item.id));
        data.habitPointLedger = data.habitPointLedger.filter(item => Number.isFinite(Number(item.amount)));
        data.habitPointLedger.forEach(item => {
          item.amount = Number(item.amount);
          item.currency = normalizeCurrency(item.currency);
          item.updatedAt = getNowLocal();
        });
        data.habitRewards.forEach(item => {
          item.currency = normalizeCurrency(item.currency);
          item.updatedAt = getNowLocal();
        });
        data.habitPointLedger.forEach(item => ensureHabitCurrency(data, item.currency));
        data.habitRewards.forEach(item => ensureHabitCurrency(data, item.currency));
      });
      rebuildLocalMirror('vue-repair-habit-diagnostics');
      lastAction.value = `已安全修复 ${preview.total} 项：移除异常打卡 ${preview.removableCheckins} 条，移除无效流水 ${preview.invalidLedger} 条，补齐币种 ${preview.emptyLedgerCurrencies + preview.emptyRewardCurrencies} 项`;
      lastError.value = '';
      return { changed: true, ...preview };
    } catch (error) {
      lastError.value = error instanceof Error ? error.message : String(error);
      return { changed: false, ...preview };
    }
  }

  return {
    habits,
    todayHabits,
    rewards,
    latestLedger,
    diagnostics,
    diagnosticIssues,
    dualWriteReadiness,
    repairPreview,
    repairableCount,
    balances,
    lastError,
    lastAction,
    getCheckins,
    getCheckinCount,
    targetCount,
    isHabitDueOnDate: isDueOnDate,
    create,
    updateHabit,
    setHabitArchived,
    deleteHabit,
    createReward,
    setRewardArchived,
    adjustPoints,
    redeemReward,
    getRewardStockLeft,
    canRedeemReward,
    appendCheckin,
    editCheckinNote,
    undoLatestCheckin,
    quickCheckin,
    settlePenaltiesThroughYesterday,
    repairSafeDiagnosticIssues,
  };
});
