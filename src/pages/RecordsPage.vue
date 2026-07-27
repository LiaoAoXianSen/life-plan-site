<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import CalendarViews from '../components/CalendarViews.vue';
import { buildScheduleItems, addDays, getMonthStart, getWeekStart, type ScheduleItem } from '../utils/schedule';
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
  templateId?: string;
  todoIds?: string[];
  ideaStatus?: string;
  ideaTags?: string[];
  ideaNextAction?: string;
  ideaTodoId?: string;
  ideaConclusion?: string;
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
  templateId: '',
  todoIds: [] as string[],
  ideaStatus: '待整理',
  ideaTagsInput: '',
  ideaNextAction: '',
  ideaTodoId: '',
  ideaConclusion: '',
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
const selectedTemplateKey = ref('');
const templateValues = reactive<Record<string, string>>({});
const showTemplateManager = ref(false);
const templateEditorRef = ref<HTMLElement | null>(null);

const typeOptions = computed(() => [...new Set(lifePlan.data.records.map(record => String(record.type || '')).filter(Boolean))]);
const activeRecord = computed(() => lifePlan.data.records.find(record => record.id === activeRecordId.value) as RecordEntity | undefined);
const openTodos = computed(() => lifePlan.data.todos
  .filter(todo => !todo.done || editForm.todoIds.includes(todo.id))
  .slice()
  .sort(records.services.todos.compareTodosForFocus));
const linkedTodos = computed(() => lifePlan.data.todos.filter(todo => editForm.todoIds.includes(todo.id)));
const ideaTodoOptions = computed(() => lifePlan.data.todos
  .filter(todo => !todo.done || todo.id === editForm.ideaTodoId)
  .slice()
  .sort(records.services.todos.compareTodosForFocus));
const ideaLinkedTodo = computed(() => editForm.ideaTodoId
  ? lifePlan.data.todos.find(todo => todo.id === editForm.ideaTodoId)
  : undefined);
const builtInTemplates = computed(() => records.services.records.getBuiltInTemplates(editForm.type));
const customTemplates = computed(() => lifePlan.data.templates.filter(template => template.type === editForm.type));
const activeBuiltInTemplate = computed(() => editForm.templateId
  ? records.services.records.getBuiltInTemplate(editForm.templateId)
  : null);
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

function selectCalendarItem(item: ScheduleItem) {
  if (item.sourceType === 'record') {
    const record = lifePlan.data.records.find(candidate => candidate.id === item.id);
    if (record) openEditor(record);
    return;
  }
  if (item.sourceType.startsWith('todo-')) {
    void router.push({ path: '/todos', query: { todo: item.id } });
  }
}

function addRecord() {
  if (!form.title.trim()) return;
  records.addRecord({ ...form, title: form.title.trim(), endDate: form.startDate });
  Object.assign(form, { title: '', content: '', type: '记录', startDate: today(), recordTime: '', recordEndTime: '' });
}

function recordTodoIds(record: DataEntity): string[] {
  return Array.isArray(record.todoIds) ? record.todoIds.map(String).filter(Boolean) : [];
}

function setTemplateValues(values: Record<string, string> = {}) {
  Object.keys(templateValues).forEach(key => delete templateValues[key]);
  Object.assign(templateValues, values);
}

function updateStructuredContent() {
  if (!activeBuiltInTemplate.value) return;
  editForm.content = records.services.records.composeTemplateContent(activeBuiltInTemplate.value, templateValues);
}

function applySelectedTemplate() {
  const key = selectedTemplateKey.value;
  if (!key) {
    editForm.templateId = '';
    setTemplateValues();
    editorNotice.value = '已切换为空白编辑';
    return;
  }
  const template = key.startsWith('builtin:')
    ? records.services.records.getBuiltInTemplate(key.slice('builtin:'.length))
    : lifePlan.data.templates.find(item => item.id === key);
  if (!template) return;
  const templateTodos = Array.isArray(template.todos) ? template.todos as DataEntity[] : [];
  if (templateTodos.length && linkedTodos.value.length && !window.confirm('应用模板会替换当前记录的待办关联，继续吗？')) return;

  if (template.builtIn && Array.isArray(template.fields)) {
    editForm.templateId = String(template.id);
    setTemplateValues();
    editForm.content = records.services.records.composeTemplateContent(template, templateValues);
  } else {
    editForm.templateId = '';
    setTemplateValues();
    editForm.content = String(template.content || '');
  }

  if (templateTodos.length) {
    editForm.todoIds = records.replaceRecordTodosFromTemplate(editForm.id, templateTodos);
  }
  editorNotice.value = `已应用模板：${String(template.name || '')}`;
}

function clearStructuredFields() {
  if (!activeBuiltInTemplate.value || !window.confirm('清空当前模板里已填写的内容吗？')) return;
  setTemplateValues();
  updateStructuredContent();
}

function toggleTemplateFields(open: boolean) {
  templateEditorRef.value?.querySelectorAll('details').forEach(item => { item.open = open; });
}

function saveAsTemplate() {
  const name = window.prompt('请输入模板名称：');
  if (!name?.trim()) return;
  const template = records.addTemplate({
    name,
    type: editForm.type || '记录',
    content: editForm.content,
    todos: linkedTodos.value,
  });
  if (!template) return;
  selectedTemplateKey.value = String(template.id);
  showTemplateManager.value = true;
  editorNotice.value = '模板已保存';
}

function deleteTemplate(id: string) {
  if (!window.confirm('确定删除这个模板吗？')) return;
  records.deleteTemplate(id);
  if (selectedTemplateKey.value === id) selectedTemplateKey.value = '';
  editorNotice.value = '模板已删除';
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
    templateId: item.templateId || '',
    todoIds: recordTodoIds(item),
    ideaStatus: records.services.records.getIdeaStatus(item),
    ideaTagsInput: records.services.records.getIdeaTags(item).join(', '),
    ideaNextAction: item.ideaNextAction || '',
    ideaTodoId: item.ideaTodoId && lifePlan.data.todos.some(todo => todo.id === item.ideaTodoId) ? item.ideaTodoId : '',
    ideaConclusion: item.ideaConclusion || '',
    linkedTodoId: '',
    newTodoText: '',
  });
  const template = item.templateId ? records.services.records.getBuiltInTemplate(item.templateId) : null;
  selectedTemplateKey.value = template ? `builtin:${template.id}` : '';
  setTemplateValues(template ? records.services.records.parseTemplateContent(template, item.content || '') : {});
  showTemplateManager.value = false;
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
  const ideaFields = editForm.type === '灵感碎片'
    ? {
        ideaStatus: editForm.ideaStatus || '待整理',
        ideaTags: records.services.records.getIdeaTags({ ideaTags: editForm.ideaTagsInput }),
        ideaNextAction: editForm.ideaNextAction.trim(),
        ideaTodoId: editForm.ideaTodoId,
        ideaConclusion: editForm.ideaConclusion.trim(),
      }
    : { ideaStatus: '', ideaTags: [], ideaNextAction: '', ideaTodoId: '', ideaConclusion: '' };
  records.updateRecord(editForm.id, {
    title: editForm.title.trim(),
    content: editForm.content,
    type: editForm.type || '记录',
    startDate: editForm.startDate,
    endDate: editForm.endDate || editForm.startDate,
    recordTime: editForm.recordTime,
    recordEndTime: editForm.recordEndTime,
    templateId: editForm.templateId,
    todoIds: editForm.todoIds,
    ...ideaFields,
  });
  editorNotice.value = '记录已保存';
}

function openIdeaTodo() {
  if (!editForm.ideaTodoId) return;
  void router.push({ path: '/todos', query: { todo: editForm.ideaTodoId } });
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

watch(() => editForm.type, type => {
  const selected = selectedTemplateKey.value;
  if (!selected) return;
  const template = selected.startsWith('builtin:')
    ? records.services.records.getBuiltInTemplate(selected.slice('builtin:'.length))
    : lifePlan.data.templates.find(item => item.id === selected);
  if (template?.type === type) return;
  selectedTemplateKey.value = '';
  editForm.templateId = '';
  setTemplateValues();
});
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
          <div class="record-template-toolbar">
            <label class="form-group"><span>记录模板</span><select v-model="selectedTemplateKey"><option value="">空白</option><optgroup v-if="builtInTemplates.length" label="内置模板"><option v-for="template in builtInTemplates" :key="template.id" :value="`builtin:${template.id}`">{{ template.name }}</option></optgroup><optgroup v-if="customTemplates.length" label="我的模板"><option v-for="template in customTemplates" :key="String(template.id)" :value="String(template.id)">{{ template.name }}</option></optgroup></select></label>
            <div class="record-template-actions">
              <button class="btn btn-secondary" type="button" :disabled="!selectedTemplateKey" @click="applySelectedTemplate">应用模板</button>
              <button class="btn btn-secondary" type="button" @click="saveAsTemplate">保存为模板</button>
              <button class="btn btn-secondary" type="button" :aria-expanded="showTemplateManager" @click="showTemplateManager = !showTemplateManager">管理模板</button>
            </div>
          </div>
          <section v-if="showTemplateManager" class="record-template-manager" aria-label="自定义模板管理">
            <div v-if="lifePlan.data.templates.length" class="record-template-list">
              <div v-for="template in lifePlan.data.templates" :key="String(template.id)" class="record-template-row">
                <span><strong>{{ template.name }}</strong><small>{{ template.type }}</small></span>
                <button class="link-button danger-text" type="button" :aria-label="`删除模板 ${template.name}`" @click="deleteTemplate(String(template.id))">删除</button>
              </div>
            </div>
            <p v-else class="empty-state">暂无自定义模板。</p>
          </section>
          <section v-if="activeBuiltInTemplate" ref="templateEditorRef" class="record-template-editor" :aria-label="`${activeBuiltInTemplate.name}结构化字段`">
            <div class="record-template-editor-head">
              <div><strong>{{ activeBuiltInTemplate.name }}</strong><p>{{ activeBuiltInTemplate.description }}</p></div>
              <div class="record-template-actions"><button class="link-button" type="button" @click="toggleTemplateFields(true)">全部展开</button><button class="link-button" type="button" @click="toggleTemplateFields(false)">全部收起</button><button class="link-button danger-text" type="button" @click="clearStructuredFields">清空</button></div>
            </div>
            <details v-for="field in activeBuiltInTemplate.fields" :key="field.id" class="record-template-field">
              <summary>{{ field.label }}</summary>
              <textarea v-model="templateValues[field.id]" :aria-label="field.label" :placeholder="field.placeholder" :rows="field.rows || 3" @input="updateStructuredContent" />
            </details>
          </section>
          <label class="form-group"><span>内容</span><textarea v-model="editForm.content" rows="8" :readonly="Boolean(activeBuiltInTemplate)" :class="{ 'is-preview': activeBuiltInTemplate }" /></label>
          <section v-if="editForm.type === '灵感碎片'" class="record-idea-fields" aria-labelledby="record-idea-fields-title">
            <div class="record-preview-heading" id="record-idea-fields-title">灵感推进</div>
            <div class="form-row">
              <label class="form-group"><span>状态</span><select v-model="editForm.ideaStatus"><option v-for="item in ['待整理','待实践','实践中','已验证','已放弃']" :key="item" :value="item">{{ item }}</option></select></label>
              <label class="form-group"><span>标签</span><input v-model="editForm.ideaTagsInput" placeholder="例如：写作, 产品, 实验" /></label>
            </div>
            <label class="form-group"><span>下一步</span><textarea v-model="editForm.ideaNextAction" rows="3" /></label>
            <label class="form-group"><span>关联待办</span><select v-model="editForm.ideaTodoId"><option value="">不关联</option><option v-for="todo in ideaTodoOptions" :key="todo.id" :value="todo.id">{{ todo.text }}</option></select></label>
            <label class="form-group"><span>结果结论</span><textarea v-model="editForm.ideaConclusion" rows="4" /></label>
          </section>
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
          <div v-if="editForm.type === '灵感碎片'" class="record-preview-content">
            <div class="record-preview-heading">灵感推进</div>
            <div class="record-idea-badges"><span>{{ editForm.ideaStatus || '待整理' }}</span><span v-for="tag in records.services.records.getIdeaTags({ ideaTags: editForm.ideaTagsInput })" :key="tag">{{ tag }}</span></div>
            <div class="record-idea-preview-grid">
              <div><strong>下一步</strong><span>{{ editForm.ideaNextAction || '未设置' }}</span></div>
              <div><strong>关联待办</strong><button v-if="ideaLinkedTodo" class="link-button" type="button" @click="openIdeaTodo">{{ ideaLinkedTodo.text }}</button><span v-else>未关联</span></div>
              <div><strong>结果结论</strong><span>{{ editForm.ideaConclusion || '还没有结论' }}</span></div>
            </div>
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
      <CalendarViews v-else :mode="view" :cursor="cursor" :items="calendarItems" @select="selectCalendarItem" />
    </div>
  </section>
</template>

<style scoped>
.record-editor-panel { margin-bottom: 18px; }
#page-records .filter-bar { grid-template-columns: minmax(0, 1fr) minmax(128px, .45fr) minmax(128px, .45fr); }
.record-editor-grid { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(280px, .9fr); gap: 18px; align-items: start; }
.record-edit-form { display: grid; gap: 13px; }
.record-template-toolbar { display: grid; grid-template-columns: minmax(220px, 1fr) auto; gap: 10px; align-items: end; }
.record-template-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.record-template-manager,
.record-template-editor { border-block: 1px solid rgba(42, 75, 56, .13); padding-block: 12px; }
.record-template-list { display: grid; }
.record-template-row { display: flex; justify-content: space-between; gap: 12px; align-items: center; padding: 8px 0; border-bottom: 1px solid rgba(42, 75, 56, .09); }
.record-template-row:last-child { border-bottom: 0; }
.record-template-row span { display: grid; gap: 2px; }
.record-template-row small,
.record-template-editor-head p { color: var(--faint); font-size: 12px; margin: 0; }
.record-template-editor { display: grid; gap: 8px; }
.record-template-editor-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
.record-template-field { border: 1px solid rgba(42, 75, 56, .13); border-radius: 6px; padding: 9px 11px; }
.record-template-field summary { cursor: pointer; font-weight: 650; }
.record-template-field textarea { margin-top: 9px; }
.is-preview { background: #f7f9f7; color: var(--muted); }
.record-idea-fields { display: grid; gap: 10px; padding-block: 12px; border-block: 1px solid rgba(42, 75, 56, .13); }
.record-idea-badges { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.record-idea-badges span { padding: 3px 7px; border-radius: 999px; background: var(--surface-soft); color: var(--muted); font-size: 12px; font-weight: 700; }
.record-idea-preview-grid { display: grid; gap: 10px; }
.record-idea-preview-grid > div { display: grid; gap: 3px; }
.record-idea-preview-grid strong { font-size: 12px; }
.record-idea-preview-grid span,
.record-idea-preview-grid button { overflow-wrap: anywhere; white-space: pre-wrap; }
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
  .record-link-tools,
  .record-template-toolbar { grid-template-columns: 1fr; }
  .record-template-editor-head { flex-direction: column; }
}
@media (max-width: 640px) {
  #page-records .filter-bar { grid-template-columns: minmax(0, 1fr); }
}
</style>
