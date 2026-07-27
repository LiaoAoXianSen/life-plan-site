<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import TodoTable from '../components/TodoTable.vue';
import { getTodayStr } from '../services/legacyServices';
import { useLifePlanStore } from '../stores/lifePlanStore';
import { useTodosStore } from '../stores/todosStore';
import type { Todo, TodoSubTodo } from '../types/lifePlan';

const router = useRouter();
const lifePlan = useLifePlanStore();
const todosStore = useTodosStore();
const query = ref('');
const startDate = ref('');
const endDate = ref('');
const status = ref<'all' | 'open' | 'done'>('all');
const urgency = ref('all');
const group = ref('all');
const mode = ref<'all' | 'exclusive' | 'shared'>('all');
const selectedId = ref('');
const editing = ref(false);
const detailError = ref('');
const detailStatus = ref('');
const newSubTodo = ref('');
const form = reactive({ text: '', note: '', dueDate: '', planStartDate: '', planEndDate: '', urgency: 'medium' as Todo['urgency'], group: '其他' });
const detailForm = reactive({ text: '', note: '', dueDate: '', planStartDate: '', planEndDate: '', urgency: 'medium' as Todo['urgency'], group: '其他', subTodos: [] as TodoSubTodo[] });
const sessionForm = reactive({ date: getTodayStr(), startTime: new Date().toTimeString().slice(0, 5), endTime: '', note: '' });

const groupOptions = computed(() => [...new Set(todosStore.todos.map(todo => todo.group || '其他'))].sort((left, right) => left.localeCompare(right, 'zh-CN')));
const filteredTodos = computed(() => todosStore.todos
  .filter(todo => (!startDate.value && !endDate.value) || todosStore.services.todos.isTodoInDateRange(todo, startDate.value, endDate.value))
  .filter(todo => status.value === 'all' || (status.value === 'done' ? todo.done : !todo.done))
  .filter(todo => urgency.value === 'all' || todo.urgency === urgency.value)
  .filter(todo => group.value === 'all' || todo.group === group.value)
  .filter(todo => mode.value === 'all' || (mode.value === 'exclusive' ? !!todo.isExclusive : !todo.isExclusive))
  .filter(todo => [todo.text, todo.note, todo.group].join(' ').toLowerCase().includes(query.value.trim().toLowerCase()))
  .slice().sort(todosStore.services.todos.compareTodosForFocus));
const selectedTodo = computed(() => todosStore.todos.find(todo => todo.id === selectedId.value) ?? null);
const linkedRecords = computed(() => selectedTodo.value
  ? lifePlan.data.records.filter(record => {
      const todoIds = Array.isArray(record.todoIds) ? record.todoIds.map(String) : [];
      return todoIds.includes(selectedTodo.value!.id) || record.ideaTodoId === selectedTodo.value!.id;
    })
  : []);
const sortedSessions = computed(() => [...(selectedTodo.value?.sessions ?? [])].sort((left, right) =>
  `${right.date}T${right.startTime || '00:00'}`.localeCompare(`${left.date}T${left.startTime || '00:00'}`)));

function submit() {
  if (!form.text.trim()) return;
  const todo = todosStore.create({ ...form, text: form.text.trim() });
  Object.assign(form, { text: '', note: '', dueDate: '', planStartDate: '', planEndDate: '', urgency: 'medium', group: '其他' });
  selectTodo(todo.id);
}

function loadDetailForm(todo: Todo) {
  Object.assign(detailForm, {
    text: todo.text,
    note: todo.note,
    dueDate: todo.dueDate,
    planStartDate: todo.planStartDate,
    planEndDate: todo.planEndDate,
    urgency: todo.urgency,
    group: todo.group,
    subTodos: todo.subTodos.map(item => ({ ...item })),
  });
}

function selectTodo(id: string) {
  const todo = todosStore.todos.find(item => item.id === id);
  if (!todo) return;
  selectedId.value = id;
  editing.value = false;
  detailError.value = '';
  detailStatus.value = '';
  loadDetailForm(todo);
}

function startEditing() {
  if (!selectedTodo.value) return;
  loadDetailForm(selectedTodo.value);
  editing.value = true;
  detailError.value = '';
  detailStatus.value = '';
}

function cancelEditing() {
  if (selectedTodo.value) loadDetailForm(selectedTodo.value);
  editing.value = false;
  detailError.value = '';
}

function saveDetail() {
  if (!selectedTodo.value) return;
  try {
    todosStore.update(selectedTodo.value.id, detailForm);
    editing.value = false;
    detailError.value = '';
    detailStatus.value = '待办已保存';
  } catch (error) {
    detailError.value = error instanceof Error ? error.message : String(error);
  }
}

function addSubTodo() {
  const text = newSubTodo.value.trim();
  if (!text) return;
  detailForm.subTodos.push({ text, done: false });
  newSubTodo.value = '';
}

function toggleSubTodo(index: number, done: boolean) {
  if (!selectedTodo.value) return;
  const subTodos = selectedTodo.value.subTodos.map((item, itemIndex) => itemIndex === index ? { ...item, done } : { ...item });
  todosStore.update(selectedTodo.value.id, { ...selectedTodo.value, subTodos });
  detailStatus.value = '子任务状态已保存';
}

function addSession() {
  if (!selectedTodo.value) return;
  try {
    todosStore.addSession(selectedTodo.value.id, sessionForm);
    Object.assign(sessionForm, { date: getTodayStr(), startTime: new Date().toTimeString().slice(0, 5), endTime: '', note: '' });
    detailError.value = '';
    detailStatus.value = '执行记录已保存';
  } catch (error) {
    detailError.value = error instanceof Error ? error.message : String(error);
  }
}

function deleteSession(sessionId: string) {
  if (!selectedTodo.value || !window.confirm('只删除这一次执行记录吗？待办本身会保留。')) return;
  todosStore.removeSession(selectedTodo.value.id, sessionId);
  detailStatus.value = '执行记录已删除';
}

function toggleSelectedTodo() {
  if (!selectedTodo.value) return;
  todosStore.toggle(selectedTodo.value.id);
  detailStatus.value = selectedTodo.value.done ? '待办已完成' : '待办已恢复为未完成';
}

function deleteSelectedTodo() {
  if (!selectedTodo.value || !window.confirm('确定删除这个待办吗？关联记录会保留，但会移除待办引用。')) return;
  todosStore.remove(selectedTodo.value.id);
  selectedId.value = '';
  editing.value = false;
}

function openLinkedRecord(recordId: string) {
  void router.push({ path: '/records', query: { record: recordId } });
}
</script>

<template>
  <section class="page active" id="page-todos">
    <header class="page-header">
      <div>
        <div class="page-title">待办总览</div>
        <p class="todo-page-summary">{{ todosStore.todos.filter(todo => !todo.done).length }} 项待推进，{{ todosStore.todos.filter(todo => todo.done).length }} 项已完成</p>
      </div>
    </header>

    <form class="card todo-create-form" @submit.prevent="submit">
      <div class="card-title">新建待办</div>
      <div class="form-row">
        <div class="form-group"><label for="todo-create-text">任务</label><input id="todo-create-text" v-model="form.text" required placeholder="下一步要推进什么？" /></div>
        <div class="form-group"><label for="todo-create-group">分组</label><input id="todo-create-group" v-model="form.group" /></div>
        <div class="form-group"><label for="todo-create-date">截止日期</label><input id="todo-create-date" v-model="form.dueDate" type="date" /></div>
        <div class="form-group"><label for="todo-create-urgency">紧急度</label><select id="todo-create-urgency" v-model="form.urgency"><option value="urgent">紧急</option><option value="high">高</option><option value="medium">中</option><option value="low">低</option></select></div>
      </div>
      <div class="form-group"><label for="todo-create-note">备注</label><input id="todo-create-note" v-model="form.note" placeholder="可选备注" /></div>
      <button class="btn btn-primary" type="submit">保存待办</button>
    </form>

    <div class="filter-bar">
      <input v-model="query" class="todo-filter-query" type="search" aria-label="搜索待办" placeholder="搜索待办" />
      <label class="todo-filter-date"><span>开始</span><input v-model="startDate" type="date" aria-label="筛选开始日期" /></label>
      <label class="todo-filter-date"><span>结束</span><input v-model="endDate" type="date" aria-label="筛选结束日期" /></label>
      <select v-model="status" aria-label="待办状态"><option value="all">全部状态</option><option value="open">未完成</option><option value="done">已完成</option></select>
      <select v-model="urgency" aria-label="待办紧急度"><option value="all">全部紧急度</option><option value="urgent">紧急</option><option value="high">高</option><option value="medium">中</option><option value="low">低</option></select>
      <select v-model="group" aria-label="待办分组"><option value="all">全部分组</option><option v-for="item in groupOptions" :key="item" :value="item">{{ item }}</option></select>
      <select v-model="mode" aria-label="待办类型"><option value="all">全部类型</option><option value="exclusive">专属待办</option><option value="shared">通用待办</option></select>
    </div>

    <div class="todo-workspace" :class="{ 'has-detail': selectedTodo }">
      <div class="todo-list-pane">
        <TodoTable :todos="filteredTodos" :selected-id="selectedId" @toggle="todosStore.toggle" @select="selectTodo" />
      </div>

      <aside v-if="selectedTodo" class="todo-detail-panel" aria-labelledby="todo-detail-heading">
        <div class="todo-detail-header">
          <div>
            <span :class="`todo-urgency todo-urgency-${selectedTodo.urgency}`">{{ todosStore.services.todos.getTodoUrgencyMeta(selectedTodo.urgency).label }}</span>
            <h2 id="todo-detail-heading">{{ editing ? '编辑待办' : selectedTodo.text }}</h2>
          </div>
          <button class="close-btn" type="button" aria-label="关闭待办详情" title="关闭" @click="selectedId = ''">×</button>
        </div>

        <form v-if="editing" class="todo-detail-form" @submit.prevent="saveDetail">
          <div class="form-group"><label for="todo-detail-text">任务</label><input id="todo-detail-text" v-model="detailForm.text" required /></div>
          <div class="form-group"><label for="todo-detail-note">备注</label><textarea id="todo-detail-note" v-model="detailForm.note" /></div>
          <div class="form-row">
            <div class="form-group"><label for="todo-detail-plan-start">计划开始</label><input id="todo-detail-plan-start" v-model="detailForm.planStartDate" type="date" /></div>
            <div class="form-group"><label for="todo-detail-plan-end">计划结束</label><input id="todo-detail-plan-end" v-model="detailForm.planEndDate" type="date" /></div>
            <div class="form-group"><label for="todo-detail-due">截止日期</label><input id="todo-detail-due" v-model="detailForm.dueDate" type="date" /></div>
            <div class="form-group"><label for="todo-detail-urgency">紧急度</label><select id="todo-detail-urgency" v-model="detailForm.urgency"><option value="urgent">紧急</option><option value="high">高</option><option value="medium">中</option><option value="low">低</option></select></div>
          </div>
          <div class="form-group"><label for="todo-detail-group">分组</label><input id="todo-detail-group" v-model="detailForm.group" /></div>

          <section class="todo-detail-section" aria-labelledby="todo-edit-subtasks">
            <h3 id="todo-edit-subtasks">子任务</h3>
            <div v-for="(subTodo, index) in detailForm.subTodos" :key="`${index}-${subTodo.text}`" class="todo-detail-row">
              <input v-model="subTodo.done" type="checkbox" :aria-label="`完成子任务 ${subTodo.text}`" />
              <input v-model="subTodo.text" :aria-label="`子任务 ${index + 1}`" />
              <button class="link-button danger-text" type="button" @click="detailForm.subTodos.splice(index, 1)">删除</button>
            </div>
            <div class="todo-inline-add"><input v-model="newSubTodo" aria-label="新子任务" placeholder="添加一个可执行步骤" @keyup.enter.prevent="addSubTodo" /><button class="btn btn-secondary" type="button" @click="addSubTodo">添加</button></div>
          </section>

          <p v-if="detailError" class="form-error" role="alert">{{ detailError }}</p>
          <div class="todo-detail-actions"><button class="btn btn-primary" type="submit">保存修改</button><button class="btn btn-secondary" type="button" @click="cancelEditing">取消</button></div>
        </form>

        <template v-else>
          <div class="todo-detail-meta-list">
            <span>{{ selectedTodo.done ? '已完成' : '未完成' }}</span><span>{{ selectedTodo.group || '其他' }}</span><span>截止 {{ selectedTodo.dueDate || '未设置' }}</span><span>计划 {{ selectedTodo.planStartDate || '未设置' }}{{ selectedTodo.planEndDate ? ` 至 ${selectedTodo.planEndDate}` : '' }}</span>
          </div>
          <p v-if="selectedTodo.note" class="todo-detail-copy">{{ selectedTodo.note }}</p>
          <div class="todo-detail-actions"><button class="btn btn-primary" type="button" @click="startEditing">编辑待办</button><button class="btn btn-secondary" type="button" @click="toggleSelectedTodo">{{ selectedTodo.done ? '恢复未完成' : '标记完成' }}</button><button class="btn btn-danger" type="button" @click="deleteSelectedTodo">删除待办</button></div>

          <section class="todo-detail-section" aria-labelledby="todo-view-subtasks">
            <div class="todo-section-heading"><h3 id="todo-view-subtasks">子任务</h3><span>{{ selectedTodo.subTodos.filter(item => item.done).length }}/{{ selectedTodo.subTodos.length }}</span></div>
            <label v-for="(subTodo, index) in selectedTodo.subTodos" :key="`${index}-${subTodo.text}`" class="todo-check-row" :class="{ done: subTodo.done }"><input :checked="subTodo.done" type="checkbox" @change="toggleSubTodo(index, ($event.target as HTMLInputElement).checked)" /><span>{{ subTodo.text }}</span></label>
            <p v-if="!selectedTodo.subTodos.length" class="todo-detail-empty">暂无子任务。</p>
          </section>

          <section class="todo-detail-section" aria-labelledby="todo-sessions-heading">
            <div class="todo-section-heading"><h3 id="todo-sessions-heading">执行记录</h3><span>{{ selectedTodo.sessions.length }} 次</span></div>
            <form class="todo-session-form" @submit.prevent="addSession"><input v-model="sessionForm.date" type="date" aria-label="执行日期" required /><input v-model="sessionForm.startTime" type="time" aria-label="开始时间" required /><input v-model="sessionForm.endTime" type="time" aria-label="结束时间" /><input v-model="sessionForm.note" aria-label="执行备注" placeholder="这次推进了什么" /><button class="btn btn-secondary" type="submit">记录执行</button></form>
            <div v-for="session in sortedSessions" :key="session.id" class="todo-session-row"><div><strong>{{ session.date }} {{ session.startTime }}{{ session.endTime ? ` - ${session.endTime}` : '' }}</strong><span>{{ session.note || '执行了一次' }}</span></div><button class="link-button danger-text" type="button" @click="deleteSession(session.id)">删除</button></div>
            <p v-if="!sortedSessions.length" class="todo-detail-empty">还没有执行记录。</p>
          </section>

          <section class="todo-detail-section" aria-labelledby="todo-records-heading">
            <div class="todo-section-heading"><h3 id="todo-records-heading">关联记录</h3><span>{{ linkedRecords.length }} 条</span></div>
            <button v-for="record in linkedRecords" :key="String(record.id)" class="todo-record-link" type="button" @click="openLinkedRecord(String(record.id))"><span>{{ record.title || record.type || '未命名记录' }}</span><small>{{ record.type }}{{ record.ideaTodoId === selectedTodo.id ? ' · 灵感来源' : '' }}</small></button>
            <p v-if="!linkedRecords.length" class="todo-detail-empty">暂无关联记录。</p>
          </section>

          <p v-if="detailError" class="form-error" role="alert">{{ detailError }}</p>
          <p v-if="detailStatus" class="todo-save-status" role="status">{{ detailStatus }}</p>
        </template>
      </aside>
      <aside v-else class="todo-detail-placeholder"><strong>选择一项待办</strong><span>查看和编辑子任务、执行记录与关联记录。</span></aside>
    </div>
  </section>
</template>
