<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import CalendarViews from '../components/CalendarViews.vue';
import { buildScheduleItems, addDays, getMonthStart, getWeekStart } from '../utils/schedule';
import { useLifePlanStore } from '../stores/lifePlanStore';
import { useRecordsStore } from '../stores/recordsStore';
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
  todoIds?: string[];
  ideaStatus?: string;
  ideaTags?: string[];
};

const lifePlan = useLifePlanStore();
const records = useRecordsStore();
const route = useRoute();
const router = useRouter();
const today = () => new Date().toISOString().slice(0, 10);
const form = reactive({ title: '', content: '', type: '记录', startDate: today(), recordTime: '', recordEndTime: '' });
const editForm = reactive({
  id: '',
  title: '',
  content: '',
  type: '记录',
  startDate: today(),
  endDate: today(),
  recordTime: '',
  recordEndTime: '',
  todoIds: [] as string[],
  linkedTodoId: '',
  newTodoText: '',
});
const view = ref<'list' | 'day' | 'week' | 'month'>('list');
const cursor = ref(today());
const keyword = ref('');
const typeFilter = ref('all');
const listRange = ref<'7' | '30' | '90' | 'all'>('30');
const activeRecordId = ref('');
const editorNotice = ref('');

const typeOptions = computed(() => [...new Set(lifePlan.data.records.map(record => String(record.type || '')).filter(Boolean))]);
const activeRecord = computed(() => lifePlan.data.records.find(record => record.id === activeRecordId.value) as RecordEntity | undefined);
const openTodos = computed(() => lifePlan.data.todos
  .filter(todo => !todo.done || editForm.todoIds.includes(todo.id))
  .slice()
  .sort(records.services.todos.compareTodosForFocus));
const linkedTodos = computed(() => lifePlan.data.todos.filter(todo => editForm.todoIds.includes(todo.id)));
const previewSections = computed(() => records.services.records.parseRecordContentSections(editForm.content || ''));
const listRecords = computed(() => {
  const min = listRange.value === 'all' ? '' : addDays(today(), -Number(listRange.value) + 1);
  const query = keyword.value.trim().toLowerCase();
  return lifePlan.data.records.filter(record => !record.isHabitRecord)
    .filter(record => !min || String(record.startDate || '') >= min)
    .filter(record => typeFilter.value === 'all' || record.type === typeFilter.value)
    .filter(record => !query || [record.title, record.content, record.type, record.ideaStatus, ...(Array.isArray(record.ideaTags) ? record.ideaTags : [])].filter(Boolean).join(' ').toLowerCase().includes(query))
    .slice().sort((a, b) => String(b.updatedAt || b.createdAt || b.startDate || '').localeCompare(String(a.updatedAt || a.createdAt || a.startDate || '')));
});
const calendarRange = computed(() => view.value === 'day' ? [cursor.value, cursor.value] : view.value === 'week' ? (() => { const start = getWeekStart(cursor.value); return [start, addDays(start, 6)] as const; })() : [getWeekStart(getMonthStart(cursor.value)), addDays(getMonthStart(cursor.value), 41)] as const);
const calendarItems = computed(() => buildScheduleItems(lifePlan.data, calendarRange.value[0], calendarRange.value[1], keyword.value, typeFilter.value));
const viewTitle = computed(() => view.value === 'list' ? '全部记录' : view.value === 'day' ? cursor.value : view.value === 'week' ? `${calendarRange.value[0]} ~ ${calendarRange.value[1]}` : cursor.value.slice(0, 7));

function shift(amount: number) {
  cursor.value = view.value === 'month'
    ? (() => { const date = new Date(`${cursor.value.slice(0, 7)}-01T12:00:00`); date.setMonth(date.getMonth() + amount); return date.toISOString().slice(0, 10); })()
    : addDays(cursor.value, view.value === 'week' ? amount * 7 : amount);
}

function addRecord() {
  if (!form.title.trim()) return;
  records.addRecord({ ...form, title: form.title.trim(), endDate: form.startDate });
  Object.assign(form, { title: '', content: '', type: '记录', startDate: today(), recordTime: '', recordEndTime: '' });
}

function recordTodoIds(record: DataEntity): string[] {
  return Array.isArray(record.todoIds) ? record.todoIds.map(String).filter(Boolean) : [];
}

function updateRecordQuery(recordId = '') {
  const query = { ...route.query };
  if (recordId) query.record = recordId;
  else delete query.record;
  void router.replace({ path: route.path, query });
}

function openEditor(record: DataEntity, updateRoute = true) {
  const item = record as RecordEntity;
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
    todoIds: recordTodoIds(item),
    linkedTodoId: '',
    newTodoText: '',
  });
  editorNotice.value = '';
  if (updateRoute && route.query.record !== item.id) updateRecordQuery(item.id);
}

function closeEditor() {
  activeRecordId.value = '';
  editorNotice.value = '';
  if (route.query.record) updateRecordQuery();
}

function saveEditor() {
  if (!editForm.id || !editForm.title.trim()) return;
  records.updateRecord(editForm.id, {
    title: editForm.title.trim(),
    content: editForm.content,
    type: editForm.type || '记录',
    startDate: editForm.startDate,
    endDate: editForm.endDate || editForm.startDate,
    recordTime: editForm.recordTime,
    recordEndTime: editForm.recordEndTime,
    todoIds: editForm.todoIds,
  });
  editorNotice.value = '记录已保存';
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

function removeRecord(id: string) {
  records.remove('records', id);
  if (activeRecordId.value === id) closeEditor();
}

watch([() => route.query.record, () => lifePlan.data.records.length], ([value]) => {
  const recordId = Array.isArray(value) ? value[0] : value;
  if (!recordId || activeRecordId.value === recordId) return;
  const record = lifePlan.data.records.find(item => item.id === recordId);
  if (record) openEditor(record, false);
}, { immediate: true });
</script>

<template>
  <section class="page active" id="page-records">
    <header class="page-header"><div class="page-title">所有记录</div></header>

    <form class="card" @submit.prevent="addRecord">
      <div class="card-title">新建记录</div>
      <div class="form-row">
        <label class="form-group"><span>标题</span><input v-model="form.title" required placeholder="记录一件事" /></label>
        <label class="form-group"><span>类型</span><input v-model="form.type" /></label>
        <label class="form-group"><span>日期</span><input v-model="form.startDate" type="date" /></label>
        <label class="form-group"><span>开始时间</span><input v-model="form.recordTime" type="time" /></label>
        <label class="form-group"><span>结束时间</span><input v-model="form.recordEndTime" type="time" /></label>
      </div>
      <label class="form-group"><span>内容</span><textarea v-model="form.content" /></label>
      <button class="btn btn-primary">保存记录</button>
    </form>

    <div class="filter-bar">
      <input v-model="keyword" type="search" placeholder="搜索标题、内容、类型" />
      <select v-model="typeFilter">
        <option value="all">全部类型</option>
        <option v-for="type in typeOptions" :key="type" :value="type">{{ type }}</option>
        <option value="待办">待办执行</option>
        <option value="习惯">习惯打卡</option>
      </select>
      <select v-if="view === 'list'" v-model="listRange">
        <option value="7">最近 7 天</option>
        <option value="30">最近 30 天</option>
        <option value="90">最近 90 天</option>
        <option value="all">全部历史</option>
      </select>
    </div>

    <div class="calendar-toolbar">
      <div class="segmented">
        <button v-for="item in ['list','day','week','month'] as const" :key="item" :class="{ active: view === item }" type="button" @click="view = item">{{ ({ list: '列表', day: '日', week: '周', month: '月' })[item] }}</button>
      </div>
      <template v-if="view !== 'list'">
        <div class="page-actions">
          <button class="btn btn-secondary" type="button" @click="shift(-1)">上一{{ view === 'month' ? '月' : view === 'week' ? '周' : '天' }}</button>
          <strong id="record-view-title">{{ viewTitle }}</strong>
          <button class="btn btn-secondary" type="button" @click="shift(1)">下一{{ view === 'month' ? '月' : view === 'week' ? '周' : '天' }}</button>
          <button class="btn btn-secondary" type="button" @click="cursor = today()">今天</button>
        </div>
      </template>
    </div>

    <section v-if="activeRecord" class="card record-editor-panel" aria-labelledby="record-editor-title">
      <div class="section-title-row">
        <div>
          <h2 id="record-editor-title">编辑记录</h2>
          <p class="section-hint">保存会写入原有 records 字段；关联待办会同步重建 todoAppData 镜像。</p>
        </div>
        <button class="btn btn-secondary" type="button" @click="closeEditor">关闭</button>
      </div>
      <p v-if="editorNotice" class="notice success" role="status">{{ editorNotice }}</p>
      <div class="record-editor-grid">
        <form class="record-edit-form" @submit.prevent="saveEditor">
          <div class="form-row">
            <label class="form-group"><span>标题</span><input v-model="editForm.title" required /></label>
            <label class="form-group"><span>类型</span><input v-model="editForm.type" /></label>
            <label class="form-group"><span>开始日期</span><input v-model="editForm.startDate" type="date" /></label>
            <label class="form-group"><span>结束日期</span><input v-model="editForm.endDate" type="date" /></label>
            <label class="form-group"><span>开始时间</span><input v-model="editForm.recordTime" type="time" /></label>
            <label class="form-group"><span>结束时间</span><input v-model="editForm.recordEndTime" type="time" /></label>
          </div>
          <label class="form-group"><span>内容</span><textarea v-model="editForm.content" rows="8" /></label>
          <div class="record-link-tools">
            <label class="form-group"><span>关联已有待办</span><select v-model="editForm.linkedTodoId"><option value="">选择待办</option><option v-for="todo in openTodos" :key="todo.id" :value="todo.id">{{ todo.text }}</option></select></label>
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
                <span>{{ todo.text }}</span>
                <em>{{ todo.isExclusive ? '专属' : '通用' }}</em>
                <button class="link-button danger-text" type="button" @click="unlinkTodo(todo)">{{ todo.isExclusive ? '删除' : '取消关联' }}</button>
              </div>
            </div>
            <p v-else class="empty-state">还没有关联待办。</p>
          </div>
          <div class="form-actions"><button class="btn btn-primary" type="submit">保存修改</button></div>
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
        </aside>
      </div>
    </section>

    <div id="all-records">
      <template v-if="view === 'list'">
        <div v-if="listRecords.length">
          <article v-for="record in listRecords" :key="String(record.id)" class="record-row">
            <div class="record-time">{{ String(record.recordTime || record.startDate || '').slice(0, 10) }}</div>
            <div class="timeline-item">
              <button class="record-open-button" type="button" @click="openEditor(record)">
                <span class="item-type">{{ record.type || '记录' }}</span>
                <span class="item-title">{{ record.title || '无标题' }}</span>
                <div v-if="record.ideaStatus" class="item-meta"><span>{{ record.ideaStatus }}</span><span v-for="tag in Array.isArray(record.ideaTags) ? record.ideaTags : []" :key="String(tag)">{{ tag }}</span></div>
                <p v-if="record.content" class="item-preview">{{ record.content }}</p>
                <div v-if="recordTodoIds(record).length" class="item-meta"><span>关联待办 {{ recordTodoIds(record).length }}</span></div>
              </button>
              <div class="record-row-actions">
                <button class="btn btn-secondary" type="button" @click="openEditor(record)">编辑/预览</button>
                <button class="btn btn-danger" type="button" @click="removeRecord(String(record.id))">删除</button>
              </div>
            </div>
          </article>
        </div>
        <div v-else class="empty-state">暂无匹配记录。</div>
      </template>
      <CalendarViews v-else :mode="view" :cursor="cursor" :items="calendarItems" />
    </div>
  </section>
</template>

<style scoped>
.record-editor-panel { margin-bottom: 18px; }
.record-editor-grid { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(280px, .9fr); gap: 18px; align-items: start; }
.record-edit-form { display: grid; gap: 13px; }
.record-link-tools { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: end; }
.record-linked-list { display: grid; gap: 8px; }
.linked-todo-list { display: grid; gap: 6px; }
.record-open-button { display: block; width: 100%; border: 0; background: transparent; padding: 0; text-align: left; color: inherit; cursor: pointer; }
.record-row-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
.record-preview-text { white-space: pre-wrap; }
.record-preview-todo-item { gap: 8px; }
.record-preview-todo-item em { margin-left: auto; color: var(--faint); font-style: normal; font-size: 12px; }
.link-button { border: 0; background: transparent; color: #316c4a; cursor: pointer; padding: 3px; }
.danger-text { color: #b84f45; }
@media (max-width: 900px) {
  .record-editor-grid,
  .record-link-tools { grid-template-columns: 1fr; }
}
</style>
