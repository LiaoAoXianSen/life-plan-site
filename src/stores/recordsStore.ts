import { computed } from 'vue';
import { defineStore } from 'pinia';
import { createLegacyServices, genId, getNowLocal, getTodayStr } from '../services/legacyServices';
import type { DataEntity, Todo } from '../types/lifePlan';
import { useLifePlanStore } from './lifePlanStore';

const services = createLegacyServices();
const materialTypes = new Set(['金句', '提示词', '摘抄', '观点', '方法']);
type RecordUpdateInput = Partial<{
  title: string;
  content: string;
  type: string;
  startDate: string;
  endDate: string;
  recordTime: string;
  recordEndTime: string;
  templateId: string;
  todoIds: string[];
  ideaStatus: string;
  ideaTags: string[];
  ideaNextAction: string;
  ideaTodoId: string;
  ideaConclusion: string;
}>;

type RecordDraftInput = {
  title: string;
  content: string;
  type: string;
  startDate: string;
  endDate: string;
  recordTime: string;
  recordEndTime: string;
  templateId: string;
  todoIds: string[];
  ideaStatus: string;
  ideaTags: string[];
  ideaNextAction: string;
  ideaTodoId: string;
  ideaConclusion: string;
};

type DiaryAiSectionKey = 'oneLine' | 'review' | 'tomorrow' | 'improve' | 'thinking' | 'smallJoy';
type DiaryAiTodoInput = Partial<Todo> & Pick<Todo, 'text'>;
type AiCaptureApplyResult = { id: string; type: string; created: boolean };
type MaterialInput = {
  title: string;
  type: string;
  content: string;
  tags: string[];
  source: string;
  note: string;
};

export const useRecordsStore = defineStore('records', () => {
  const lifePlan = useLifePlanStore();
  const ideas = computed(() => lifePlan.data.records.filter(record => record.type === '灵感碎片'));
  const materials = computed(() => lifePlan.data.materials);
  const uniqueScopedRecordTypes = new Set(['日记', '日计划', '工作记录', '周复盘', '周计划', '月复盘', '月计划', '年复盘', '年度计划', '3年计划', '终身愿景']);

  function findExistingScopedRecord(type: string, startDate: string, endDate: string, excludeId = '') {
    if (!uniqueScopedRecordTypes.has(type)) return null;
    return lifePlan.data.records.find(record => {
      if (record.id === excludeId || record.type !== type) return false;
      if (type === '终身愿景') return true;
      return String(record.startDate || '') === startDate && String(record.endDate || '') === endDate;
    }) || null;
  }

  function addRecord(input: { title: string; content?: string; type?: string; startDate?: string; endDate?: string; recordTime?: string; recordEndTime?: string }) {
    const now = getNowLocal();
    const date = input.startDate || getTodayStr();
    lifePlan.mutate('create-record', data => data.records.unshift({
      id: genId(), title: input.title.trim(), content: input.content?.trim() || '', type: input.type || '记录',
      startDate: date, endDate: input.endDate || date, recordTime: input.recordTime || '', recordEndTime: input.recordEndTime || '',
      todoIds: [], createdAt: now, updatedAt: now,
    }));
  }

  function updateRecord(id: string, input: RecordUpdateInput) {
    lifePlan.mutate('update-record', data => {
      const record = data.records.find(item => item.id === id);
      if (!record) return;
      const next = { ...input };
      if (Array.isArray(next.todoIds)) next.todoIds = Array.from(new Set(next.todoIds.map(String).filter(Boolean)));
      Object.assign(record, next, { updatedAt: getNowLocal() });
      delete record.templateFields;
    });
  }

  function saveRecordDraft(id: string, input: RecordDraftInput) {
    const saved: { value: { id: string; created: boolean } | null } = { value: null };
    lifePlan.mutate(id ? 'update-record-draft' : 'create-record-draft', data => {
      const now = getNowLocal();
      const existing = id ? data.records.find(item => item.id === id) : null;
      const next = {
        ...input,
        title: input.title.trim(),
        todoIds: Array.from(new Set(input.todoIds.map(String).filter(Boolean))),
        ideaTags: Array.from(new Set(input.ideaTags.map(String).filter(Boolean))),
      };
      if (existing) {
        Object.assign(existing, next, { updatedAt: now });
        delete existing.templateFields;
        delete existing.isDraft;
        saved.value = { id: String(existing.id), created: false };
        return;
      }
      const recordId = genId();
      data.records.push({ id: recordId, ...next, createdAt: now, updatedAt: now });
      saved.value = { id: recordId, created: true };
    });
    return saved.value;
  }

  function addTemplate(input: { name: string; type: string; content: string; todos?: DataEntity[] }) {
    const name = input.name.trim();
    if (!name) return null;
    const template = {
      id: genId(),
      name,
      type: input.type || '记录',
      content: input.content || '',
      todos: JSON.parse(JSON.stringify(input.todos || [])),
    };
    lifePlan.mutate('create-record-template', data => data.templates.push(template));
    return template;
  }

  function deleteTemplate(id: string) {
    const template = lifePlan.data.templates.find(item => item.id === id);
    if (!template) return;
    lifePlan.mutate('delete-record-template', data => {
      services.sync.markDeletedItem(data, 'templates', id, { reason: 'manual-delete', name: String(template.name || '') });
      data.templates = data.templates.filter(item => item.id !== id);
    });
  }

  function replaceRecordTodosFromTemplate(recordId: string, templateTodos: DataEntity[] = []) {
    let todoIds: string[] = [];
    lifePlan.mutate('apply-record-template-todos', data => {
      const record = data.records.find(item => item.id === recordId);
      if (!record) return;
      const previousIds = Array.isArray(record.todoIds) ? record.todoIds.map(String) : [];
      data.todos
        .filter(todo => previousIds.includes(todo.id) && todo.isExclusive)
        .forEach(todo => services.sync.markDeletedItem(data, 'todos', todo.id, {
          text: todo.text,
          reason: 'record-template-replace',
          recordId,
        }));
      data.todos = data.todos.filter(todo => !previousIds.includes(todo.id) || !todo.isExclusive);

      const now = getNowLocal();
      const dueDate = String(record.endDate || record.startDate || getTodayStr());
      const created = templateTodos.map(source => {
        const cloned = JSON.parse(JSON.stringify(source || {}));
        const todo = Object.assign(services.todos.createTodoFromAiItem({
          text: String(cloned.text || '模板待办'),
          note: String(cloned.note || ''),
          group: String(cloned.group || '记录'),
          urgency: cloned.urgency || 'medium',
          sourceType: 'record',
          sourceRecordId: recordId,
          planStartDate: String(record.startDate || dueDate),
          planEndDate: dueDate,
          dueDate,
        }), cloned, {
          id: genId(),
          dueDate,
          createdAt: now,
          updatedAt: now,
        }) as Todo;
        todo.text = String(todo.text || '模板待办');
        todo.subTodos = Array.isArray(todo.subTodos) ? todo.subTodos.map(item => ({ ...item })) : [];
        todo.sessions = Array.isArray(todo.sessions) ? todo.sessions.map(item => ({ ...item })) : [];
        if (todo.isExclusive) {
          todo.sourceType = 'record';
          todo.sourceRecordId = recordId;
        }
        return todo;
      });
      data.todos.push(...created);
      todoIds = created.map(todo => todo.id);
      record.todoIds = todoIds;
      record.updatedAt = now;
    });
    return todoIds;
  }

  function linkExistingTodo(recordId: string, todoId: string) {
    lifePlan.mutate('link-record-todo', data => {
      const record = data.records.find(item => item.id === recordId);
      const todo = data.todos.find(item => item.id === todoId);
      if (!record || !todo) return;
      const todoIds = Array.isArray(record.todoIds) ? record.todoIds.map(String) : [];
      if (!todoIds.includes(todo.id)) record.todoIds = [...todoIds, todo.id];
      record.updatedAt = getNowLocal();
    });
  }

  function createExclusiveTodo(recordId: string, text: string): Todo | null {
    const cleanText = text.trim();
    if (!cleanText) return null;
    let created: Todo | null = null;
    lifePlan.mutate('create-record-exclusive-todo', data => {
      const record = data.records.find(item => item.id === recordId);
      if (!record) return;
      const endDate = String(record.endDate || record.startDate || getTodayStr());
      const todo = services.todos.createTodoFromAiItem({
        text: cleanText,
        note: record.title ? `来源记录：${record.title}` : '来源记录',
        group: '记录',
        urgency: 'medium',
        sourceType: 'record',
        sourceRecordId: recordId,
        planStartDate: String(record.startDate || endDate),
        planEndDate: endDate,
        dueDate: endDate,
      }) as Todo;
      todo.isExclusive = true;
      data.todos.unshift(todo);
      const todoIds = Array.isArray(record.todoIds) ? record.todoIds.map(String) : [];
      record.todoIds = [...todoIds, todo.id];
      record.updatedAt = getNowLocal();
      created = todo;
    });
    return created;
  }

  function removeLinkedTodo(recordId: string, todoId: string) {
    lifePlan.mutate('unlink-record-todo', data => {
      const record = data.records.find(item => item.id === recordId);
      if (!record) return;
      record.todoIds = (Array.isArray(record.todoIds) ? record.todoIds.map(String) : []).filter(id => id !== todoId);
      const todo = data.todos.find(item => item.id === todoId);
      if (todo?.isExclusive && todo.sourceRecordId === recordId) {
        services.sync.markDeletedItem(data, 'todos', todoId, { text: todo.text, reason: 'record-unlink-exclusive', recordId });
        data.todos = data.todos.filter(item => item.id !== todoId);
      }
      record.updatedAt = getNowLocal();
    });
  }

  function applyDiaryAiSections(recordId: string, sections: Partial<Record<DiaryAiSectionKey, string>>) {
    const template = services.records.getBuiltInTemplate('builtin-diary-daily-review');
    if (!template) return null;
    const allowedKeys = new Set(template.fields.map((field: { id: string }) => field.id));
    const applied: { value: { content: string; templateId: string; values: Record<string, string> } | null } = { value: null };
    lifePlan.mutate('apply-diary-ai-sections', data => {
      const record = data.records.find(item => item.id === recordId && item.type === '日记');
      if (!record) return;
      const values = services.records.parseTemplateContent(template, String(record.content || '')) as Record<string, string>;
      Object.entries(sections).forEach(([key, value]) => {
        const cleanValue = String(value || '').trim();
        if (allowedKeys.has(key) && cleanValue) values[key] = cleanValue;
      });
      const content = services.records.composeTemplateContent(template, values);
      record.templateId = template.id;
      record.content = content;
      record.updatedAt = getNowLocal();
      applied.value = { content, templateId: template.id, values };
    });
    return applied.value;
  }

  function createDiaryAiTodos(recordId: string, inputs: DiaryAiTodoInput[]) {
    const createdIds: string[] = [];
    lifePlan.mutate('create-diary-ai-todos', data => {
      const record = data.records.find(item => item.id === recordId && item.type === '日记');
      if (!record) return;
      const sourceLabel = String(record.title || record.startDate || '未命名日记');
      const created = inputs.map(input => {
        const todo = services.todos.createTodoFromAiItem(input, {
          sourceType: 'diary-ai',
          sourceRecordId: recordId,
          sourceMatchKey: input.sourceMatchKey || input.text,
        }) as Todo;
        todo.note = [todo.note, `来源日记：${sourceLabel}`].filter(Boolean).join('\n\n');
        return todo;
      });
      data.todos.push(...created);
      const todoIds = Array.isArray(record.todoIds) ? record.todoIds.map(String) : [];
      created.forEach(todo => {
        createdIds.push(todo.id);
        if (!todoIds.includes(todo.id)) todoIds.push(todo.id);
      });
      record.todoIds = todoIds;
      record.updatedAt = getNowLocal();
    });
    return createdIds;
  }

  function getAiCaptureRecordTitle(type: string, content: string) {
    const firstLine = String(content || '').split('\n').map(line => line.trim()).find(Boolean) || '';
    const clean = firstLine.replace(/^#+\s*/, '').slice(0, 28);
    if (clean) return clean;
    return type === '灵感碎片' ? 'AI 整理的灵感' : `AI 整理的${type}`;
  }

  function appendAiCaptureSection(record: DataEntity, content: string) {
    const section = `# AI 对话整理\n${content}`;
    record.content = [record.content || '', section].filter(part => String(part).trim()).join('\n\n');
    record.updatedAt = getNowLocal();
  }

  function buildAiCaptureRecord(type: string, content: string) {
    const range = services.records.getSuggestedRangeForType(type);
    const now = getNowLocal();
    const diaryTemplate = type === '日记' ? services.records.getBuiltInTemplate('builtin-diary-daily-review') : null;
    const initialContent = diaryTemplate
      ? services.records.composeTemplateContent(diaryTemplate, { body: `AI 对话整理\n${content}` })
      : content;
    const record: DataEntity = {
      id: genId(),
      type,
      title: getAiCaptureRecordTitle(type, content),
      startDate: range.start,
      endDate: range.end,
      recordTime: new Date().toTimeString().slice(0, 5),
      recordEndTime: '',
      content: initialContent,
      templateId: diaryTemplate?.id || '',
      todoIds: [],
      ideaStatus: '',
      ideaTags: [],
      ideaNextAction: '',
      ideaTodoId: '',
      ideaConclusion: '',
      createdAt: now,
      updatedAt: now,
    };
    if (type === '灵感碎片') {
      record.ideaStatus = '待整理';
      record.ideaTags = ['AI整理'];
      record.templateId = '';
    }
    return record;
  }

  function applyAiCaptureToDiary(content: string): AiCaptureApplyResult | null {
    const clean = content.trim();
    if (!clean) return null;
    let result: AiCaptureApplyResult | null = null;
    lifePlan.mutate('ai-capture-diary', data => {
      const today = getTodayStr();
      const existing = data.records.find(record => record.type === '日记' && record.startDate === today);
      if (existing) {
        if (!existing.title) existing.title = `${services.records.getRecordDateRangeLabel(existing)} 日记`;
        appendAiCaptureSection(existing, clean);
        result = { id: String(existing.id), type: '日记', created: false };
        return;
      }
      const record = buildAiCaptureRecord('日记', clean);
      data.records.push(record);
      result = { id: String(record.id), type: '日记', created: true };
    });
    return result;
  }

  function applyAiCaptureRecord(type: '工作记录' | '日计划' | '灵感碎片', content: string): AiCaptureApplyResult | null {
    const clean = content.trim();
    if (!clean) return null;
    let result: AiCaptureApplyResult | null = null;
    lifePlan.mutate(`ai-capture-${type}`, data => {
      if (type === '日计划') {
        const range = services.records.getSuggestedRangeForType('日计划');
        const existing = data.records.find(record => record.type === '日计划' && record.startDate === range.start && record.endDate === range.end);
        if (existing) {
          appendAiCaptureSection(existing, clean);
          result = { id: String(existing.id), type, created: false };
          return;
        }
      }
      const record = buildAiCaptureRecord(type, clean);
      data.records.push(record);
      result = { id: String(record.id), type, created: true };
    });
    return result;
  }

  function addIdea(title: string, content = '') {
    const now = getNowLocal();
    lifePlan.data.records.unshift({ id: genId(), type: '灵感碎片', title, content, startDate: getTodayStr(), endDate: getTodayStr(), recordTime: '', recordEndTime: '', todoIds: [], ideaStatus: '待整理', ideaTags: [], ideaNextAction: '', ideaTodoId: '', ideaConclusion: '', createdAt: now, updatedAt: now });
    lifePlan.commit('create-idea');
  }
  function setIdeaStatus(id: string, status: string) { const idea = lifePlan.data.records.find(record => record.id === id); if (!idea) return; idea.ideaStatus = status; idea.updatedAt = getNowLocal(); lifePlan.commit('update-idea-status'); }
  function applyIdeaNextAction(id: string, nextAction: string) {
    const clean = nextAction.trim();
    if (!clean) return false;
    let applied = false;
    lifePlan.mutate('apply-idea-next-action', data => {
      const idea = data.records.find(record => record.id === id && record.type === '灵感碎片');
      if (!idea) return;
      idea.ideaNextAction = clean;
      if (services.records.getIdeaStatus(idea) === '待整理') idea.ideaStatus = '待实践';
      idea.updatedAt = getNowLocal();
      applied = true;
    });
    return applied;
  }

  function applyIdeaAiActions(
    id: string,
    items: Array<Record<string, unknown>>,
    options: { replaceNextAction?: boolean } = {},
  ) {
    const selected = items
      .map(item => ({
        text: String(item.text || '').trim(),
        note: String(item.note || item.reason || '').trim(),
        dueDate: String(item.dueDate || ''),
        planStartDate: String(item.planStartDate || ''),
        planEndDate: String(item.planEndDate || ''),
        urgency: String(item.urgency || 'medium'),
        group: String(item.group || '学习'),
        subTodos: Array.isArray(item.subTodos) ? item.subTodos : [],
      }))
      .filter(item => item.text);
    if (!selected.length) return [] as string[];

    const createdIds: string[] = [];
    lifePlan.mutate('apply-idea-ai-actions', data => {
      const idea = data.records.find(record => record.id === id && record.type === '灵感碎片');
      if (!idea) return;
      const created = selected.map(item => {
        const todo = services.todos.createTodoFromAiItem({
          ...item,
          dueDate: item.dueDate || getTodayStr(),
          sourceType: 'idea-ai',
          sourceRecordId: id,
        });
        data.todos.unshift(todo);
        createdIds.push(todo.id);
        return todo;
      });
      const todoIds = Array.isArray(idea.todoIds) ? idea.todoIds.map(String) : [];
      created.forEach(todo => {
        if (!todoIds.includes(todo.id)) todoIds.push(todo.id);
      });
      idea.todoIds = todoIds;
      idea.ideaTodoId = created[0].id;
      idea.ideaStatus = '待实践';
      const nextLines = selected.map(item => item.text);
      idea.ideaNextAction = options.replaceNextAction === false
        ? [String(idea.ideaNextAction || ''), ...nextLines].filter(Boolean).join('\n')
        : nextLines.join('\n');
      idea.updatedAt = getNowLocal();
    });
    return createdIds;
  }
  function linkIdeaTodo(id: string, todoId: string) {
    lifePlan.mutate('link-idea-todo', data => {
      const idea = data.records.find(record => record.id === id && record.type === '灵感碎片');
      const todo = data.todos.find(item => item.id === todoId);
      if (!idea || !todo) return;
      idea.ideaTodoId = todoId;
      if (!String(idea.ideaNextAction || '').trim()) idea.ideaNextAction = todo.text;
      if (services.records.getIdeaStatus(idea) === '待整理') idea.ideaStatus = '待实践';
      idea.updatedAt = getNowLocal();
    });
  }
  function saveMaterial(id: string, input: MaterialInput) {
    const content = input.content.trim();
    if (!content) throw new Error('请输入素材内容');
    let savedId = id;
    lifePlan.mutate(id ? 'update-material' : 'create-material', data => {
      const now = getNowLocal();
      const next = {
        title: input.title.trim() || content.replace(/\s+/g, ' ').trim().slice(0, 42),
        type: materialTypes.has(input.type) ? input.type : '摘抄',
        content,
        tags: services.records.getIdeaTags({ ideaTags: input.tags }),
        source: input.source.trim(),
        note: input.note.trim(),
        updatedAt: now,
      };
      const existing = id ? data.materials.find(item => item.id === id) : null;
      if (existing) {
        Object.assign(existing, next);
        return;
      }
      savedId = genId();
      data.materials.unshift({ id: savedId, ...next, createdAt: now });
    });
    return savedId;
  }

  function addMaterial(input: MaterialInput) {
    return saveMaterial('', input);
  }

  function deleteMaterial(id: string) {
    const material = lifePlan.data.materials.find(item => item.id === id);
    if (!material) return false;
    lifePlan.mutate('delete-material', data => {
      services.sync.markDeletedItem(data, 'materials', id, { reason: 'manual-delete' });
      data.materials = data.materials.filter(item => item.id !== id);
    });
    return true;
  }
  function remove(collection: 'records' | 'materials', id: string) {
    const item = lifePlan.data[collection].find(entity => entity.id === id);
    if (!item) return;
    lifePlan.mutate(`delete-${collection}`, data => {
      if (collection === 'records') {
        const todoIds = Array.isArray(item.todoIds) ? item.todoIds.map(String) : [];
        data.todos
          .filter(todo => todoIds.includes(todo.id) && todo.isExclusive)
          .forEach(todo => services.sync.markDeletedItem(data, 'todos', todo.id, { text: todo.text, reason: 'record-delete', recordId: id }));
        data.todos = data.todos.filter(todo => !todoIds.includes(todo.id) || !todo.isExclusive);
      }
      services.sync.markDeletedItem(data, collection, id, { reason: `vue-delete-${collection}` });
      data[collection] = data[collection].filter(entity => entity.id !== id) as never;
    });
  }
  return { ideas, materials, findExistingScopedRecord, addRecord, updateRecord, saveRecordDraft, addTemplate, deleteTemplate, replaceRecordTodosFromTemplate, linkExistingTodo, createExclusiveTodo, removeLinkedTodo, applyDiaryAiSections, createDiaryAiTodos, applyAiCaptureToDiary, applyAiCaptureRecord, addIdea, setIdeaStatus, applyIdeaNextAction, applyIdeaAiActions, linkIdeaTodo, addMaterial, saveMaterial, deleteMaterial, remove, services };
});
