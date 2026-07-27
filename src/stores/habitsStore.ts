import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

import { createLegacyServices, genId, getNowLocal, getTodayStr } from '../services/legacyServices';
import type { DataEntity, LifePlanData } from '../types/lifePlan';
import { useLifePlanStore } from './lifePlanStore';

const DEFAULT_CURRENCY = '金币';
const MILESTONE_DAYS = [7, 15, 21, 30, 90, 180, 365];
const habitServices = createLegacyServices();

type HabitRule = 'daily' | 'weekly-fixed' | 'weekly-count' | 'monthly-count' | 'interval';

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
}

function asHabit(value: DataEntity): Habit {
  return value as Habit;
}

function asCheckin(value: DataEntity): HabitCheckin {
  return value as HabitCheckin;
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

export const useHabitsStore = defineStore('habits', () => {
  const lifePlan = useLifePlanStore();
  const lastError = ref('');
  const lastAction = ref('');

  const habits = computed(() => lifePlan.data.habits.map(asHabit));
  const todayHabits = computed(() => habits.value.filter(habit => isDueOnDate(habit, getTodayStr())));
  const balances = computed(() => lifePlan.data.habitPointLedger.reduce<Record<string, number>>((summary, entry) => {
    const currency = normalizeCurrency(entry.currency);
    summary[currency] = (summary[currency] || 0) + (Number(entry.amount) || 0);
    return summary;
  }, {}));

  function getCheckins(habitId: string, date = getTodayStr()): HabitCheckin[] {
    return lifePlan.data.checkins
      .map(asCheckin)
      .filter(item => item.habitId === habitId && item.date === date)
      .sort((a, b) => String(a.checkinAt || a.createdAt || '').localeCompare(String(b.checkinAt || b.createdAt || '')));
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
  }) {
    if (!input.amount) return;
    const now = getNowLocal();
    data.habitPointLedger.push({
      id: genId(),
      amount: input.amount,
      currency: normalizeCurrency(input.currency),
      type: input.type,
      habitId: input.habitId,
      rewardId: '',
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

  function create(input: CreateHabitInput): Habit {
    const name = input.name.trim();
    if (!name) throw new Error('请输入习惯名称');
    const now = getNowLocal();
    const habit: Habit = {
      id: genId(),
      name,
      rule: 'daily',
      weekdays: [],
      count: 3,
      timesPerDay: String(Math.max(1, Math.min(99, Math.trunc(input.timesPerDay || 1))),),
      tag: input.tag?.trim() || '',
      goalCount: 0,
      noteMode: 'ask',
      rewardPoints: 0,
      rewardCurrency: DEFAULT_CURRENCY,
      penaltyPoints: 0,
      penaltyCurrency: DEFAULT_CURRENCY,
      randomReward: false,
      rewardMin: 0,
      rewardMax: 0,
      breakPenaltyMode: 'none',
      breakPenaltyPoints: 0,
      breakPenaltyCurrency: DEFAULT_CURRENCY,
      milestoneRewards: milestoneDefaults(),
      startDate: getTodayStr(),
      createdAt: now,
      updatedAt: now,
    };
    try {
      lifePlan.mutate('vue-create-habit', data => {
        data.habits.push(habit);
        if (!data.habitCurrencies.some(item => normalizeCurrency(item.name || item.currency || item.id) === DEFAULT_CURRENCY)) {
          data.habitCurrencies.push({ id: 'habit-currency-default', name: DEFAULT_CURRENCY, createdAt: now, updatedAt: now });
        }
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

  function quickCheckin(habitId: string, note = ''): boolean {
    const habit = habits.value.find(item => item.id === habitId);
    const today = getTodayStr();
    if (!habit) {
      lastError.value = '未找到该习惯，未写入任何数据。';
      return false;
    }
    if (!isDueOnDate(habit, today)) {
      lastError.value = '这条习惯今天不在执行日，未写入任何数据。';
      return false;
    }
    if (targetCount(habit) === 1 && getCheckinCount(habitId, today) > 0) {
      lastError.value = '今天已完成该习惯；备注编辑和撤销仍请使用旧版。';
      return false;
    }

    try {
      lifePlan.mutate('vue-habit-quick-checkin', data => {
        const target = data.habits.find(item => item.id === habitId) as Habit | undefined;
        if (!target) throw new Error('习惯已不存在，已取消打卡。');
        const now = new Date();
        const timestamp = `${today}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        const checkin: HabitCheckin = {
          id: genId(),
          habitId,
          date: today,
          time: timestamp.slice(11, 16),
          checkinAt: timestamp,
          createdAt: timestamp,
          updatedAt: getNowLocal(now),
          note: String(note || '').trim(),
        };
        data.checkins.push(checkin);
        addCheckinReward(data, target, checkin);
        addMilestoneRewards(data, target, checkin);
        reversePenaltiesForDate(data, target, today);
        target.updatedAt = getNowLocal(now);
      });
      rebuildLocalMirror('vue-habit-quick-checkin');
      lastAction.value = `已为「${habit.name}」打卡`;
      lastError.value = '';
      return true;
    } catch (error) {
      lastError.value = error instanceof Error ? error.message : String(error);
      return false;
    }
  }

  return {
    habits,
    todayHabits,
    balances,
    lastError,
    lastAction,
    getCheckins,
    getCheckinCount,
    targetCount,
    create,
    quickCheckin,
  };
});
