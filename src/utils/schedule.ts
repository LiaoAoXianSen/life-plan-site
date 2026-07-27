import type { DataEntity, LifePlanData, Todo } from '../types/lifePlan';

export interface ScheduleTone { bg: string; border: string; ink: string }
export interface ScheduleItem {
  key: string; id: string; sourceType: 'record' | 'todo-plan' | 'todo-due' | 'todo-session' | 'habit'; type: string; date: string;
  title: string; preview: string; meta: string; done: boolean; allDay: boolean;
  startMinutes: number | null; endMinutes: number | null; timeLabel: string; tone: ScheduleTone;
  layoutColumn?: number; layoutColumns?: number;
}

const tones: Record<string, ScheduleTone> = {
  '日记': { bg: '#e7f1ff', border: '#5f9ee5', ink: '#163d67' }, '日计划': { bg: '#e7f1ff', border: '#5f9ee5', ink: '#163d67' },
  '工作记录': { bg: '#e6f4ed', border: '#5f9b78', ink: '#183b2b' }, '灵感碎片': { bg: '#fff3d2', border: '#cfaf34', ink: '#5f4f11' },
  '待办计划': { bg: '#eef6f1', border: '#8db29b', ink: '#274335' }, '待办截止': { bg: '#fff3d2', border: '#cfaf34', ink: '#5f4f11' },
  '待办执行': { bg: '#ffe9df', border: '#d77f57', ink: '#743116' }, '习惯': { bg: '#e8f3eb', border: '#6ca07c', ink: '#244c33' },
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
  const start = parseTimeToMinutes(entityString(record, 'recordTime'));
  const end = parseTimeToMinutes(entityString(record, 'recordEndTime'));
  const type = entityString(record, 'type') || '记录';
  return { key: `record:${record.id}`, id: String(record.id || ''), sourceType: 'record', type, date: entityString(record, 'startDate'), title: entityString(record, 'title') || type, preview: entityString(record, 'content'), meta: type === '灵感碎片' ? entityString(record, 'ideaStatus') : '', done: false, allDay: start === null, startMinutes: start, endMinutes: end !== null && start !== null && end > start ? end : null, timeLabel: entityString(record, 'recordTime') || '全天', tone: tone(type) };
}
function makeTodoPlanItem(todo: Todo, date: string): ScheduleItem {
  return { key: `todo-plan:${todo.id}:${date}`, id: todo.id, sourceType: 'todo-plan', type: '待办计划', date, title: `计划：${todo.text}`, preview: `${todo.planStartDate || date} ~ ${todo.planEndDate || date}`, meta: `${todo.group || '其他'} · ${urgencyLabels[todo.urgency]}`, done: todo.done, allDay: true, startMinutes: null, endMinutes: null, timeLabel: '计划', tone: tone('待办计划') };
}
function makeTodoDueItem(todo: Todo): ScheduleItem {
  return { key: `todo-due:${todo.id}`, id: todo.id, sourceType: 'todo-due', type: '待办截止', date: todo.dueDate, title: `截止：${todo.text}`, preview: todo.done ? '已完成' : '到期提醒', meta: `${todo.group || '其他'} · ${urgencyLabels[todo.urgency]}`, done: todo.done, allDay: true, startMinutes: null, endMinutes: null, timeLabel: '截止', tone: tone('待办截止') };
}
function makeTodoItem(todo: Todo, session: Record<string, unknown>): ScheduleItem {
  const start = parseTimeToMinutes(session.startTime); const end = parseTimeToMinutes(session.endTime);
  return { key: `todo-session:${todo.id}:${session.id}`, id: todo.id, sourceType: 'todo-session', type: '待办执行', date: String(session.date || ''), title: `执行：${todo.text}`, preview: String(session.note || ''), meta: todo.group, done: todo.done, allDay: start === null, startMinutes: start, endMinutes: end !== null && start !== null && end > start ? end : null, timeLabel: String(session.startTime || '执行'), tone: tone('待办执行') };
}
function makeHabitItem(habit: DataEntity, checkin: DataEntity): ScheduleItem {
  const start = parseTimeToMinutes(String(checkin.time || String(checkin.checkinAt || '').slice(11, 16)));
  return { key: `habit:${habit.id}:${checkin.id}`, id: String(habit.id || ''), sourceType: 'habit', type: '习惯', date: String(checkin.date || ''), title: entityString(habit, 'name') || '习惯打卡', preview: entityString(checkin, 'note'), meta: entityString(habit, 'tag'), done: true, allDay: start === null, startMinutes: start, endMinutes: null, timeLabel: start === null ? '已打卡' : formatMinutesLabel(start), tone: tone('习惯') };
}

export function buildScheduleItems(data: LifePlanData, startDate: string, endDate: string, keyword = '', typeFilter = 'all'): ScheduleItem[] {
  const clean = keyword.trim().toLowerCase();
  const records = data.records.filter(record => {
    const date = entityString(record, 'startDate'); const type = entityString(record, 'type');
    return date >= startDate && date <= endDate && (typeFilter === 'all' || typeFilter === type || (typeFilter === '待办' && false));
  }).map(makeRecordItem);
  const todoItems = typeFilter === 'all' || typeFilter === '待办' ? data.todos.flatMap(todo => {
    const items: ScheduleItem[] = [];
    if (todo.planStartDate && todo.planEndDate) {
      const rangeStart = todo.planStartDate < startDate ? startDate : todo.planStartDate;
      const rangeEnd = todo.planEndDate > endDate ? endDate : todo.planEndDate;
      for (let date = rangeStart; date <= rangeEnd; date = addDays(date, 1)) items.push(makeTodoPlanItem(todo, date));
    }
    if (todo.dueDate && todo.dueDate >= startDate && todo.dueDate <= endDate) items.push(makeTodoDueItem(todo));
    todo.sessions
      .filter(session => String(session.date || '') >= startDate && String(session.date || '') <= endDate)
      .forEach(session => items.push(makeTodoItem(todo, session)));
    return items;
  }) : [];
  const habits = typeFilter === 'all' || typeFilter === '习惯' ? data.checkins.filter(checkin => String(checkin.date || '') >= startDate && String(checkin.date || '') <= endDate).map(checkin => {
    const habit = data.habits.find(item => item.id === checkin.habitId); return habit ? makeHabitItem(habit, checkin) : null;
  }).filter((item): item is ScheduleItem => item !== null) : [];
  return [...records, ...todoItems, ...habits].filter(item => !clean || [item.type, item.title, item.preview, item.meta].join(' ').toLowerCase().includes(clean));
}

export function sortScheduleItems(items: ScheduleItem[]): ScheduleItem[] { return [...items].sort((a, b) => (a.allDay === b.allDay ? (a.startMinutes ?? 0) - (b.startMinutes ?? 0) : a.allDay ? -1 : 1)); }
function endMinutes(item: ScheduleItem): number { return item.endMinutes !== null && item.endMinutes > (item.startMinutes ?? 0) ? item.endMinutes : Math.min((item.startMinutes ?? 0) + 15, 1439); }
export function layoutTimedItems(items: ScheduleItem[]): ScheduleItem[] {
  const clusters: ScheduleItem[][] = []; let cluster: ScheduleItem[] = []; let clusterEnd = -1;
  [...items].sort((a, b) => (a.startMinutes ?? 0) - (b.startMinutes ?? 0)).forEach(item => { if (!cluster.length || (item.startMinutes ?? 0) < clusterEnd) { cluster.push(item); clusterEnd = Math.max(clusterEnd, endMinutes(item)); } else { clusters.push(cluster); cluster = [item]; clusterEnd = endMinutes(item); } });
  if (cluster.length) clusters.push(cluster);
  return clusters.flatMap(group => { const columns: number[] = []; const placed = group.map(item => { const index = columns.findIndex(value => value <= (item.startMinutes ?? 0)); const column = index === -1 ? columns.length : index; columns[column] = endMinutes(item); return { ...item, layoutColumn: column }; }); return placed.map(item => ({ ...item, layoutColumns: columns.length })); });
}
