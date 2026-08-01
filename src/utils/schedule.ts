import type { DataEntity, LifePlanData, Todo } from '../types/lifePlan';

export interface ScheduleTone { bg: string; border: string; ink: string }
export interface ScheduleItem {
  key: string; id: string; sourceType: 'record' | 'todo-plan' | 'todo-due' | 'todo-session' | 'habit'; type: string; date: string;
  title: string; preview: string; meta: string; done: boolean; allDay: boolean;
  startMinutes: number | null; endMinutes: number | null; timeLabel: string; tone: ScheduleTone;
  sortValue?: string;
  layoutColumn?: number; layoutColumns?: number;
}

export interface ScheduleBuildOptions {
  keyword?: string;
  typeFilter?: string;
  includeRecords?: boolean;
  includeTodos?: boolean;
  includeHabits?: boolean;
  includeTodoPlans?: boolean;
  includeTodoDue?: boolean;
  includeTodoSessions?: boolean;
  recordFilter?: (record: DataEntity) => boolean;
  isHabitDueOnDate?: (habit: DataEntity, date: string) => boolean;
}

const tones: Record<string, ScheduleTone> = {
  '日记': { bg: '#e7f1ff', border: '#5f9ee5', ink: '#163d67' }, '日计划': { bg: '#e7f1ff', border: '#5f9ee5', ink: '#163d67' },
  '工作记录': { bg: '#e6f4ed', border: '#5f9b78', ink: '#183b2b' }, '灵感碎片': { bg: '#fff3d2', border: '#cfaf34', ink: '#5f4f11' },
  '待办计划': { bg: '#eef6f1', border: '#8db29b', ink: '#274335' }, '待办截止': { bg: '#fff3d2', border: '#cfaf34', ink: '#5f4f11' },
  '待办执行': { bg: '#ffe9df', border: '#d77f57', ink: '#743116' }, '习惯': { bg: '#e8f3eb', border: '#6ca07c', ink: '#244c33' },
  '习惯-全天': { bg: '#e8edf4', border: '#8a96a8', ink: '#344055' }, '习惯-晨间': { bg: '#fff1dd', border: '#d99138', ink: '#5e4214' },
  '习惯-午间': { bg: '#fff3d2', border: '#cfaf34', ink: '#5f4f11' }, '习惯-晚间': { bg: '#f1e9ff', border: '#8c70d1', ink: '#41286f' },
  '习惯-学习': { bg: '#f1e9ff', border: '#8c70d1', ink: '#41286f' }, '习惯-运动': { bg: '#e5f1ff', border: '#5e9feb', ink: '#153d69' },
  '习惯-工作': { bg: '#fff0df', border: '#c28a3f', ink: '#614116' }, '习惯-生活': { bg: '#e6f4ed', border: '#5f9b78', ink: '#183b2b' },
};
const urgencyLabels: Record<Todo['urgency'], string> = { urgent: '紧急', high: '高', medium: '中', low: '低' };

export function parseTimeToMinutes(value: unknown): number | null {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]); const minute = Number(match[2]);
  return hour < 24 && minute < 60 ? hour * 60 + minute : null;
}
export function formatMinutesLabel(value: number | null): string { return value === null ? '全天' : `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`; }
export function addDays(date: string, amount: number): string { const next = new Date(`${date}T12:00:00`); next.setDate(next.getDate() + amount); return next.toISOString().slice(0, 10); }
export function getWeekStart(date: string): string { const next = new Date(`${date}T12:00:00`); next.setDate(next.getDate() - ((next.getDay() || 7) - 1)); return next.toISOString().slice(0, 10); }
export function getMonthStart(date: string): string { return `${date.slice(0, 7)}-01`; }
export function getMonthEnd(date: string): string { const next = new Date(`${date.slice(0, 7)}-01T12:00:00`); next.setMonth(next.getMonth() + 1, 0); return next.toISOString().slice(0, 10); }

function tone(type: string): ScheduleTone { return tones[type] ?? { bg: '#eef6f1', border: '#8db29b', ink: '#274335' }; }
function entityString(entity: DataEntity, key: string): string { return typeof entity[key] === 'string' ? entity[key] as string : ''; }

function makeRecordItem(record: DataEntity): ScheduleItem {
  const storedTime = (entityString(record, 'createdAt') || entityString(record, 'updatedAt')).match(/T(\d{2}:\d{2})/)?.[1] || '';
  const recordTime = entityString(record, 'recordTime') || storedTime;
  const start = parseTimeToMinutes(recordTime);
  const end = parseTimeToMinutes(entityString(record, 'recordEndTime'));
  const type = entityString(record, 'type') || '记录';
  const startDate = entityString(record, 'startDate');
  const endDate = entityString(record, 'endDate');
  const meta = [
    endDate && endDate !== startDate ? `${startDate} ~ ${endDate}` : '',
    type === '灵感碎片' ? `状态 ${entityString(record, 'ideaStatus') || '待整理'}` : '',
    type === '灵感碎片' && entityString(record, 'ideaNextAction') ? `下一步：${entityString(record, 'ideaNextAction')}` : '',
    type === '灵感碎片' && entityString(record, 'ideaConclusion') ? '已有结论' : '',
  ].filter(Boolean).join(' · ');
  const sortValue = startDate && entityString(record, 'recordTime')
    ? `${startDate}T${entityString(record, 'recordTime')}:00`
    : entityString(record, 'createdAt') || entityString(record, 'updatedAt') || `${startDate || endDate || '0000-00-00'}T00:00:00`;
  return { key: `record:${record.id}`, id: String(record.id || ''), sourceType: 'record', type, date: startDate, title: entityString(record, 'title') || type, preview: entityString(record, 'content'), meta, done: false, allDay: start === null, startMinutes: start, endMinutes: end !== null && start !== null && end > start ? end : null, timeLabel: recordTime || '全天', tone: tone(type), sortValue };
}
function makeTodoPlanItem(todo: Todo, date: string): ScheduleItem {
  return { key: `todo-plan:${todo.id}:${date}`, id: todo.id, sourceType: 'todo-plan', type: '待办计划', date, title: `计划：${todo.text}`, preview: `${todo.planStartDate || date} ~ ${todo.planEndDate || date}`, meta: `${todo.group || '其他'} · ${urgencyLabels[todo.urgency]}`, done: todo.done, allDay: true, startMinutes: null, endMinutes: null, timeLabel: '计划', tone: tone('待办计划') };
}
function makeTodoDueItem(todo: Todo): ScheduleItem {
  return { key: `todo-due:${todo.id}`, id: todo.id, sourceType: 'todo-due', type: '待办截止', date: todo.dueDate, title: `截止：${todo.text}`, preview: todo.done ? '已完成' : '到期提醒', meta: `${todo.group || '其他'} · ${urgencyLabels[todo.urgency]}`, done: todo.done, allDay: true, startMinutes: null, endMinutes: null, timeLabel: '截止', tone: tone('待办截止') };
}
function makeTodoItem(todo: Todo, session: Record<string, unknown>): ScheduleItem {
  const start = parseTimeToMinutes(session.startTime); const end = parseTimeToMinutes(session.endTime);
  const startLabel = String(session.startTime || '--:--');
  const endLabel = String(session.endTime || '');
  return { key: `todo-session:${todo.id}:${session.id}`, id: todo.id, sourceType: 'todo-session', type: '待办执行', date: String(session.date || ''), title: `执行：${todo.text}`, preview: String(session.note || `${todo.group || '其他'} 待办`), meta: endLabel ? `${startLabel} ~ ${endLabel}` : String(session.startTime || '执行记录'), done: todo.done, allDay: start === null, startMinutes: start, endMinutes: end !== null && start !== null && end > start ? end : null, timeLabel: String(session.startTime || '执行'), tone: tone('待办执行') };
}
function checkinSortValue(checkin: DataEntity): string {
  return entityString(checkin, 'checkinAt')
    || (entityString(checkin, 'time') ? `${entityString(checkin, 'date')}T${entityString(checkin, 'time')}:00` : '')
    || entityString(checkin, 'createdAt')
    || entityString(checkin, 'updatedAt');
}
function makeHabitItem(habit: DataEntity, date: string, checkins: DataEntity[]): ScheduleItem {
  const sorted = [...checkins].sort((a, b) => checkinSortValue(a).localeCompare(checkinSortValue(b)));
  const latest = sorted[sorted.length - 1];
  const clock = entityString(latest, 'time') || (entityString(latest, 'checkinAt') || entityString(latest, 'createdAt') || entityString(latest, 'updatedAt')).match(/T(\d{2}:\d{2})/)?.[1] || '';
  const start = parseTimeToMinutes(clock);
  const tag = entityString(habit, 'tag') || '习惯';
  const note = entityString(latest, 'note').replace(/\s+/g, ' ').trim();
  const target = Math.max(1, Number.parseInt(String(habit.timesPerDay || '1'), 10) || 1);
  return { key: `habit:${habit.id}:${date}:${latest.id || 'checked'}`, id: String(habit.id || ''), sourceType: 'habit', type: '习惯', date, title: entityString(habit, 'name') || '习惯打卡', preview: `${tag} · 打卡 ${clock || '已记录'}${note ? ` · ${note.slice(0, 42)}` : ''}`, meta: `已打卡 ${checkins.length}/${target}`, done: true, allDay: start === null, startMinutes: start, endMinutes: null, timeLabel: start === null ? '已打卡' : formatMinutesLabel(start), tone: tones[`习惯-${tag}`] ?? tones['习惯'] };
}

function defaultHabitDueOnDate(habit: DataEntity, dateText: string): boolean {
  const startDate = entityString(habit, 'startDate');
  if (!dateText || (startDate && dateText < startDate)) return false;
  const date = new Date(`${dateText}T12:00:00`);
  switch (entityString(habit, 'rule')) {
    case 'weekly-fixed': return Array.isArray(habit.weekdays) && habit.weekdays.map(String).includes(String(date.getDay()));
    case 'weekly-count': return (date.getDay() || 7) === 1;
    case 'monthly-count': return date.getDate() === 1;
    case 'interval': {
      if (!startDate) return true;
      const elapsed = Math.floor((date.getTime() - new Date(`${startDate}T12:00:00`).getTime()) / 86_400_000);
      const every = Math.max(1, Number.parseInt(String(habit.count || 1), 10) || 1);
      return elapsed >= 0 && elapsed % every === 0;
    }
    default: return true;
  }
}

function recordMatchesKeyword(record: DataEntity, clean: string): boolean {
  if (!clean) return true;
  const tags = Array.isArray(record.ideaTags) ? record.ideaTags : String(record.ideaTags || '').split(/[,，、;；/\s]+/);
  return [record.type, record.title, record.content, record.startDate, record.endDate, record.ideaStatus || '待整理', ...tags, record.ideaNextAction, record.ideaConclusion]
    .filter(Boolean).join(' ').toLowerCase().includes(clean);
}

function itemMatchesKeyword(item: ScheduleItem, clean: string): boolean {
  return !clean || [item.type, item.title, item.preview, item.meta, item.date, item.timeLabel].join(' ').toLowerCase().includes(clean);
}

function dateInRange(date: string, startDate: string, endDate: string): boolean {
  return (!startDate || date >= startDate) && (!endDate || date <= endDate);
}

export function buildScheduleItems(data: LifePlanData, startDate: string, endDate: string, options: ScheduleBuildOptions = {}): ScheduleItem[] {
  const {
    keyword = '', typeFilter = 'all', includeRecords = true, includeTodos = true, includeHabits = true,
    includeTodoPlans = true, includeTodoDue = true, includeTodoSessions = true,
    recordFilter = () => true, isHabitDueOnDate = defaultHabitDueOnDate,
  } = options;
  const clean = keyword.trim().toLowerCase();
  const records = includeRecords ? data.records.filter(record => {
    const date = entityString(record, 'startDate'); const type = entityString(record, 'type');
    return !record.isHabitRecord && dateInRange(date, startDate, endDate)
      && (typeFilter === 'all' || typeFilter === type)
      && recordFilter(record)
      && recordMatchesKeyword(record, clean);
  }).map(makeRecordItem) : [];
  const todoItems = includeTodos && (typeFilter === 'all' || typeFilter === '待办') ? data.todos.flatMap(todo => {
    const items: ScheduleItem[] = [];
    if (includeTodoPlans && todo.planStartDate && todo.planEndDate) {
      const rangeStart = todo.planStartDate < startDate ? startDate : todo.planStartDate;
      const rangeEnd = todo.planEndDate > endDate ? endDate : todo.planEndDate;
      for (let date = rangeStart; date <= rangeEnd; date = addDays(date, 1)) items.push(makeTodoPlanItem(todo, date));
    }
    if (includeTodoDue && todo.dueDate && todo.dueDate >= startDate && todo.dueDate <= endDate) items.push(makeTodoDueItem(todo));
    if (includeTodoSessions) (todo.sessions || [])
      .filter(session => Boolean(session.date) && dateInRange(String(session.date), startDate, endDate))
      .forEach(session => items.push(makeTodoItem(todo, session)));
    return items;
  }) : [];
  const habitGroups = new Map<string, DataEntity[]>();
  if (includeHabits && (typeFilter === 'all' || typeFilter === '习惯')) data.checkins.forEach(checkin => {
    const date = entityString(checkin, 'date');
    const habitId = entityString(checkin, 'habitId');
    if (!habitId || !date || !dateInRange(date, startDate, endDate)) return;
    const key = `${habitId}\u0000${date}`;
    const values = habitGroups.get(key) || [];
    values.push(checkin);
    habitGroups.set(key, values);
  });
  const habits = [...habitGroups.entries()].map(([key, checkins]) => {
    const [habitId, date] = key.split('\u0000');
    const habit = data.habits.find(item => String(item.id || '') === habitId);
    return habit && isHabitDueOnDate(habit, date) ? makeHabitItem(habit, date, checkins) : null;
  }).filter((item): item is ScheduleItem => item !== null);
  return [...records, ...todoItems, ...habits].filter(item => item.sourceType === 'record' || itemMatchesKeyword(item, clean));
}

export function sortScheduleItems(items: ScheduleItem[], order: 'asc' | 'desc' = 'asc'): ScheduleItem[] { return [...items].sort((a, b) => {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  const timeResult = (a.startMinutes ?? 0) - (b.startMinutes ?? 0);
  const result = timeResult || String(a.sortValue || '').localeCompare(String(b.sortValue || ''));
  return order === 'asc' ? result : -result;
}); }
function endMinutes(item: ScheduleItem): number { return item.endMinutes !== null && item.endMinutes > (item.startMinutes ?? 0) ? item.endMinutes : Math.min((item.startMinutes ?? 0) + 15, 1439); }
export function layoutTimedItems(items: ScheduleItem[]): ScheduleItem[] {
  const clusters: ScheduleItem[][] = []; let cluster: ScheduleItem[] = []; let clusterEnd = -1;
  [...items].sort((a, b) => (a.startMinutes ?? 0) - (b.startMinutes ?? 0)).forEach(item => { if (!cluster.length || (item.startMinutes ?? 0) < clusterEnd) { cluster.push(item); clusterEnd = Math.max(clusterEnd, endMinutes(item)); } else { clusters.push(cluster); cluster = [item]; clusterEnd = endMinutes(item); } });
  if (cluster.length) clusters.push(cluster);
  return clusters.flatMap(group => { const columns: number[] = []; const placed = group.map(item => { const index = columns.findIndex(value => value <= (item.startMinutes ?? 0)); const column = index === -1 ? columns.length : index; columns[column] = endMinutes(item); return { ...item, layoutColumn: column }; }); return placed.map(item => ({ ...item, layoutColumns: columns.length })); });
}
