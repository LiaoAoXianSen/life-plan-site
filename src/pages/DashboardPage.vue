<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';

import { getTodayStr } from '../services/legacyServices';
import { useLifePlanStore } from '../stores/lifePlanStore';
import { useRecordsStore } from '../stores/recordsStore';
import { useTodosStore } from '../stores/todosStore';
import type { DataEntity, Todo } from '../types/lifePlan';
import { addDays, buildScheduleItems, sortScheduleItems, type ScheduleItem } from '../utils/schedule';

type MaterialEntity = DataEntity & { id?: string; content?: string; type?: string; source?: string; note?: string };

const router = useRouter();
const lifePlan = useLifePlanStore();
const recordsStore = useRecordsStore();
const todosStore = useTodosStore();
const today = getTodayStr();
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

function entityString(entity: DataEntity, key: string) {
  return typeof entity[key] === 'string' ? entity[key] as string : '';
}

function activeRecordTodos(record: DataEntity) {
  const ids = Array.isArray(record.todoIds) ? record.todoIds.map(String) : [];
  const todos = lifePlan.data.todos.filter(todo => ids.includes(todo.id));
  return { total: todos.length, done: todos.filter(todo => todo.done).length };
}

function formatDate(value: unknown) {
  return String(value || '').replace(/-/g, '/');
}

function openTodo(todoId: string) {
  void router.push({ path: '/todos', query: { todo: todoId } });
}

function openRecord(recordId: string) {
  void router.push({ path: '/records', query: { record: recordId } });
}

function openScheduleItem(item: ScheduleItem) {
  if (item.sourceType === 'record') openRecord(item.id);
  if (item.sourceType.startsWith('todo-')) openTodo(item.id);
  if (item.sourceType === 'habit') void router.push({ path: '/habits', query: { habit: item.id } });
}

function openMaterial(materialId: string) {
  void router.push({ path: '/materials', query: { material: materialId } });
}

function sampleMaterials(items: MaterialEntity[], count: number) {
  const pool = [...items].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
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
const floatingTodos = computed(() => lifePlan.data.todos
  .filter(todo => !todo.done && !todo.dueDate && !todo.planStartDate && !todo.planEndDate)
  .sort(todosStore.services.todos.compareTodosForFocus)
  .slice(0, 5));
const dueHabits = computed(() => lifePlan.data.habits.filter(habit => {
    const startDate = entityString(habit, 'startDate');
    if (startDate && today < startDate) return false;
    const date = new Date(`${today}T12:00:00`);
    switch (entityString(habit, 'rule')) {
      case 'weekly-fixed':
        return Array.isArray(habit.weekdays) && habit.weekdays.map(String).includes(String(date.getDay()));
      case 'weekly-count':
        return (date.getDay() || 7) === 1;
      case 'monthly-count':
        return date.getDate() === 1;
      case 'interval': {
        if (!startDate) return true;
        const elapsed = Math.floor((date.getTime() - new Date(`${startDate}T12:00:00`).getTime()) / 86_400_000);
        const every = Math.max(1, Number.parseInt(String(habit.count || 1), 10) || 1);
        return elapsed >= 0 && elapsed % every === 0;
      }
      default:
        return true;
    }
  }));
const doneHabitCount = computed(() => dueHabits.value.filter(habit => lifePlan.data.checkins.some(checkin => entityString(checkin, 'habitId') === String(habit.id || '') && entityString(checkin, 'date') === today)).length);
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
  const startDate = addDays(today, -13);
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
      <button class="btn btn-primary" type="button" @click="router.push('/todos')">+ 新建待办</button>
    </header>

    <div class="dashboard-hero">
      <div class="hero-panel">
        <div>
          <div class="hero-date">{{ today }}</div>
          <h1 class="hero-title">{{ nextTodo ? `今天先处理：${nextTodo.text}` : '今天先把最重要的事推进一点' }}</h1>
          <div class="hero-meta">
            <span>待办 {{ todayTodoDone }}/{{ todayRelevantTodos.length }}</span>
            <span>习惯 {{ doneHabitCount }}/{{ dueHabits.length }}</span>
            <span>进行中目标 {{ activeGoals.length }}</span>
            <span>本周记录 {{ weekRecords }}</span>
          </div>
        </div>
        <div class="quick-create">
          <button class="btn" type="button" @click="router.push('/todos')">加待办</button>
          <button class="btn" type="button" @click="router.push('/records')">查看记录</button>
          <button class="btn" type="button" @click="router.push('/materials')">素材库</button>
          <button class="btn" type="button" @click="router.push('/fitness')">健身</button>
        </div>
      </div>
      <div class="summary-grid">
        <div class="summary-card"><strong class="summary-value">{{ todayTodoDone }}/{{ todayRelevantTodos.length }}</strong><span class="summary-label">今日待办</span></div>
        <div class="summary-card"><strong class="summary-value">{{ doneHabitCount }}/{{ dueHabits.length }}</strong><span class="summary-label">今日习惯</span></div>
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
          <button class="command-metric" type="button" @click="router.push('/ideas')"><strong>{{ unprocessedIdeas.length }}</strong><span>未处理灵感</span></button>
          <button class="command-metric" type="button" @click="router.push('/ideas')"><strong>{{ needsConclusionIdeas.length }}</strong><span>待写结论</span></button>
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
            <span>{{ material.content || '空素材' }}</span>
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
          <button v-for="goal in goalFocusList" :key="String(goal.id)" class="command-row" type="button" @click="router.push('/goals')">
            <span>{{ goal.name || '未命名目标' }}</span>
            <strong>{{ Number(goal.progress || 0) }}%</strong>
          </button>
        </div>
        <div v-else class="empty-state compact-empty">暂无进行中的目标</div>
      </article>
    </section>

    <div class="today-grid dashboard-main-grid">
      <article class="card">
        <h2 class="card-title">今日待办</h2>
        <ul v-if="todayTodos.length" class="todo-list">
          <li v-for="todo in todayTodos" :key="todo.id" class="todo-item">
            <button class="todo-text todo-dashboard-link" type="button" :aria-label="todo.text" @click="openTodo(todo.id)">
              {{ todo.text }}<small>{{ getTodayTodoReason(todo) }}</small>
            </button>
            <span class="todo-urgency" :class="`todo-urgency-${todo.urgency}`">{{ urgencyLabels[todo.urgency] }}</span>
          </li>
        </ul>
        <div v-else class="empty-state">今日暂无待办</div>
      </article>

      <article class="card">
        <h2 class="card-title">无截止待办池</h2>
        <ul v-if="floatingTodos.length" class="todo-list">
          <li v-for="todo in floatingTodos" :key="todo.id" class="todo-item">
            <button class="todo-text todo-dashboard-link" type="button" :aria-label="todo.text" @click="openTodo(todo.id)">
              {{ todo.text }}<small>无截止 · 可转入今天</small>
            </button>
            <span class="todo-urgency" :class="`todo-urgency-${todo.urgency}`">{{ urgencyLabels[todo.urgency] }}</span>
          </li>
        </ul>
        <div v-else class="empty-state">暂无无截止待办</div>
      </article>

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
    </div>

    <article class="card dashboard-timeline">
      <div class="section-title-row timeline-title-row">
        <h2 class="card-title">最近时间轴</h2>
        <button class="btn btn-secondary todo-mini-btn" type="button" @click="router.push('/records')">全部记录</button>
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
.todo-list { display: grid; gap: 8px; padding: 0; margin: 0; }
.todo-item { align-items: center; min-width: 0; }
.todo-dashboard-link { display: grid; gap: 3px; width: 100%; min-width: 0; }
.todo-dashboard-link small { color: var(--faint); font-size: 12px; font-weight: 650; }
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
