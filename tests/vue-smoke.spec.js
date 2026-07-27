const { test, expect } = require('@playwright/test');

function emptyData(overrides = {}) {
    return {
        records: [], todos: [], habits: [], checkins: [], habitPointLedger: [], habitRewards: [], habitCurrencies: [], templates: [], goals: [], deletedItems: [], materials: [], bodyMetrics: [], fitnessPlans: [], fitnessWorkouts: [], exerciseLibrary: [], wheels: [], wheelTags: [], wheelLibraryItems: [], wheelHistory: [], ...overrides
    };
}

function todoFixture(id, text, overrides = {}) {
    return {
        id, text, note: '', done: false, dueDate: '', planStartDate: '', planEndDate: '', urgency: 'medium', group: '其他',
        subTodos: [], sessions: [], completedAt: '', sourceType: 'manual', sourceRecordId: '', sourceMatchKey: text,
        createdAt: '2026-07-27T08:00:00', updatedAt: '2026-07-27T08:00:00', ...overrides,
    };
}

function todoRemoteSnapshot(todos, deletedItems = []) {
    return { schemaVersion: 1, generatedAt: '2026-07-27T09:00:00.000Z', todos, deletedItems };
}

test('Vue shell navigates through migrated pages without browser errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), emptyData());
    await page.goto('/');
    await expect(page.locator('#page-dashboard')).toBeVisible();
    for (const [label, title] of [['所有记录', '所有记录'], ['灵感池', '灵感池'], ['素材库', '素材库'], ['标签中心', '标签中心'], ['全局搜索', '全局搜索'], ['待办总览', '待办总览'], ['习惯打卡', '习惯打卡'], ['运动健身', '运动健身'], ['目标管理', '目标管理'], ['工具转盘', '工具转盘'], ['AI 助手', 'AI 助手'], ['云同步', '云同步']]) {
        await page.getByRole('link', { name: label }).click();
        await expect(page.locator('.page-title')).toHaveText(title);
    }
    expect(errors).toEqual([]);
});

test('todo writes main data and the compatible todo mirror', async ({ page }) => {
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), emptyData());
    await page.goto('/#/todos');
    await page.locator('#page-todos input[required]').fill('Vue 待办');
    await page.getByRole('button', { name: '保存待办' }).click();
    await expect(page.locator('.todo-table')).toContainText('Vue 待办');
    const stored = await page.evaluate(() => ({ data: JSON.parse(localStorage.getItem('lifePlanData')), mirror: JSON.parse(localStorage.getItem('todoAppData')) }));
    expect(stored.data.todos).toHaveLength(1);
    expect(stored.data.todos[0].text).toBe('Vue 待办');
    expect(stored.mirror.authority).toBe('lifePlanData.todos');
    expect(stored.mirror.todos[0].text).toBe('Vue 待办');
});

test('todo detail preserves subtasks sessions relationships tombstones and mirror contracts', async ({ page }) => {
    const source = emptyData({
        records: [
            { id: 'record-linked', type: '日记', title: '关联日记', content: '', startDate: '2026-07-26', endDate: '2026-07-26', todoIds: ['todo-detail'], updatedAt: '2026-07-26T08:00:00' },
            { id: 'idea-linked', type: '灵感碎片', title: '来源灵感', content: '', startDate: '2026-07-26', endDate: '2026-07-26', todoIds: [], ideaTodoId: 'todo-detail', updatedAt: '2026-07-26T09:00:00' },
        ],
        todos: [{
            id: 'todo-detail', text: '旧待办标题', note: '旧备注', done: false,
            dueDate: '2026-07-30', planStartDate: '2026-07-26', planEndDate: '2026-07-30',
            urgency: 'medium', group: '其他', subTodos: [{ text: '旧步骤', done: false }], sessions: [],
            completedAt: '', sourceType: 'manual', sourceRecordId: '', sourceMatchKey: '旧待办标题',
            createdAt: '2026-07-26T07:00:00', updatedAt: '2026-07-26T07:00:00',
        }],
    });
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), source);
    await page.goto('/#/todos');

    await page.getByRole('button', { name: /旧待办标题/ }).first().click();
    const detail = page.locator('.todo-detail-panel');
    await expect(detail).toContainText('关联日记');
    await expect(detail).toContainText('来源灵感');
    await detail.getByRole('button', { name: '编辑待办' }).click();
    await detail.getByLabel('任务', { exact: true }).fill('更新后的待办');
    await detail.getByLabel('备注').fill('更新后的备注');
    await detail.getByLabel('计划开始').fill('2026-07-27');
    await detail.getByLabel('计划结束').fill('2026-07-29');
    await detail.getByLabel('截止日期').fill('2026-07-31');
    await detail.getByLabel('紧急度').selectOption('high');
    await detail.getByLabel('分组').fill('工作');
    await detail.getByLabel('新子任务').fill('新增步骤');
    await detail.getByRole('button', { name: '添加', exact: true }).click();
    await detail.getByRole('button', { name: '保存修改' }).click();
    await expect(detail.getByRole('heading', { name: '更新后的待办' })).toBeVisible();

    await detail.getByRole('checkbox', { name: '旧步骤' }).check();
    await detail.getByRole('checkbox', { name: '新增步骤' }).check();
    await expect(detail.getByRole('button', { name: '恢复未完成' })).toBeVisible();
    await detail.getByLabel('执行日期').fill('2026-07-27');
    await detail.getByLabel('开始时间').fill('10:00');
    await detail.getByLabel('结束时间').fill('10:45');
    await detail.getByLabel('执行备注').fill('完成契约测试');
    await detail.getByRole('button', { name: '记录执行' }).click();
    await expect(detail).toContainText('完成契约测试');

    const saved = await page.evaluate(() => ({
        data: JSON.parse(localStorage.getItem('lifePlanData')),
        mirror: JSON.parse(localStorage.getItem('todoAppData')),
    }));
    expect(saved.data.todos[0]).toMatchObject({
        id: 'todo-detail', text: '更新后的待办', note: '更新后的备注', done: true,
        dueDate: '2026-07-31', planStartDate: '2026-07-27', planEndDate: '2026-07-29',
        urgency: 'high', group: '工作', completedAt: expect.any(String),
        subTodos: [{ text: '旧步骤', done: true }, { text: '新增步骤', done: true }],
        sessions: [expect.objectContaining({ date: '2026-07-27', startTime: '10:00', endTime: '10:45', note: '完成契约测试' })],
    });
    expect(saved.mirror.authority).toBe('lifePlanData.todos');
    expect(saved.mirror.todos[0]).toMatchObject({ id: 'todo-detail', text: '更新后的待办', done: true });

    page.once('dialog', dialog => dialog.accept());
    await detail.getByRole('button', { name: '删除待办' }).click();
    await expect(page.locator('.todo-detail-panel')).toHaveCount(0);
    const removed = await page.evaluate(() => ({
        data: JSON.parse(localStorage.getItem('lifePlanData')),
        mirror: JSON.parse(localStorage.getItem('todoAppData')),
    }));
    expect(removed.data.todos).toHaveLength(0);
    expect(removed.data.deletedItems).toEqual(expect.arrayContaining([
        expect.objectContaining({ collection: 'todos', id: 'todo-detail', reason: 'vue-delete-todo', text: '更新后的待办' }),
    ]));
    expect(removed.data.records.find(item => item.id === 'record-linked').todoIds).toEqual([]);
    expect(removed.data.records.find(item => item.id === 'idea-linked').ideaTodoId).toBe('');
    expect(removed.data.records.find(item => item.id === 'idea-linked').updatedAt).not.toBe('2026-07-26T09:00:00');
    expect(removed.mirror.todos).toHaveLength(0);
    expect(removed.mirror.deletedItems).toEqual(expect.arrayContaining([
        expect.objectContaining({ collection: 'todos', id: 'todo-detail' }),
    ]));
});

test('todo legacy filters and linked record navigation stay read-only', async ({ page }) => {
    const todo = (id, text, overrides = {}) => ({
        id, text, note: '', done: false, dueDate: '', planStartDate: '', planEndDate: '', urgency: 'medium', group: '其他',
        subTodos: [], sessions: [], completedAt: '', sourceType: 'manual', sourceRecordId: '', sourceMatchKey: text,
        createdAt: '2026-07-27T08:00:00', updatedAt: '2026-07-27T08:00:00', ...overrides,
    });
    const source = emptyData({
        records: [{ id: 'record-filter', type: '日记', title: '筛选关联记录', content: '只读导航目标', startDate: '2026-07-27', endDate: '2026-07-27', todoIds: ['todo-exclusive'] }],
        todos: [
            todo('todo-exclusive', '专属工作待办', { dueDate: '2026-07-27', planStartDate: '2026-07-26', planEndDate: '2026-07-28', urgency: 'high', group: '工作', isExclusive: true, sourceRecordId: 'record-filter' }),
            todo('todo-life', '下周生活待办', { dueDate: '2026-08-03', planStartDate: '2026-08-01', planEndDate: '2026-08-03', urgency: 'low', group: '生活' }),
            todo('todo-done', '已完成学习待办', { done: true, dueDate: '2026-07-27', planStartDate: '2026-07-27', planEndDate: '2026-07-27', group: '学习', completedAt: '2026-07-27T09:00:00' }),
        ],
    });
    const original = JSON.stringify(source);
    await page.addInitScript(value => localStorage.setItem('lifePlanData', value), original);
    await page.goto('/#/todos');
    const rows = page.locator('.todo-table tbody tr');

    await page.getByLabel('筛选开始日期').fill('2026-07-27');
    await page.getByLabel('筛选结束日期').fill('2026-07-27');
    await expect(rows).toHaveCount(2);
    await expect(page.locator('.todo-table')).toContainText('专属工作待办');
    await expect(page.locator('.todo-table')).toContainText('已完成学习待办');

    await page.getByLabel('待办状态').selectOption('open');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('专属工作待办');

    await page.getByLabel('筛选开始日期').fill('');
    await page.getByLabel('筛选结束日期').fill('');
    await page.getByLabel('待办状态').selectOption('all');
    await page.getByLabel('待办分组').selectOption('生活');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('下周生活待办');

    await page.getByLabel('待办分组').selectOption('all');
    await page.getByLabel('待办类型').selectOption('exclusive');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('专属');
    await page.getByRole('button', { name: /专属工作待办/ }).click();
    await page.getByRole('button', { name: /筛选关联记录/ }).click();

    await expect(page).toHaveURL(/#\/records\?record=record-filter$/);
    const editor = page.locator('.record-editor-panel');
    await expect(editor).toBeVisible();
    await expect(editor.getByLabel('标题')).toHaveValue('筛选关联记录');
    const persisted = await page.evaluate(() => ({ data: localStorage.getItem('lifePlanData'), mirror: localStorage.getItem('todoAppData') }));
    expect(persisted.data).toBe(original);
    expect(persisted.mirror).toBeNull();
});

test('todo dashboard route presets and calendar entries preserve one read-only detail target', async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(`${today}T12:00:00`);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().slice(0, 10);
    const source = emptyData({
        todos: [{
            id: 'todo-cross-entry', text: '跨入口待办', note: '保持只读导航', done: false,
            dueDate: today, planStartDate: today, planEndDate: today, urgency: 'high', group: '工作',
            subTodos: [], sessions: [{ id: 'session-cross-entry', date: today, startTime: '10:00', endTime: '10:30', note: '日历执行项' }],
            completedAt: '', sourceType: 'manual', sourceRecordId: '', sourceMatchKey: '跨入口待办',
            createdAt: `${today}T08:00:00`, updatedAt: `${today}T08:00:00`,
        }],
    });
    const original = JSON.stringify(source);
    await page.addInitScript(value => localStorage.setItem('lifePlanData', value), original);

    await page.goto('/');
    await page.getByRole('button', { name: '跨入口待办', exact: true }).click();
    await expect(page).toHaveURL(/#\/todos\?todo=todo-cross-entry$/);
    await expect(page.locator('.todo-detail-panel').getByRole('heading', { name: '跨入口待办' })).toBeVisible();
    await page.getByRole('button', { name: '关闭待办详情' }).click();
    await expect(page).toHaveURL(/#\/todos$/);

    await page.goto('/#/todos?todo=todo-cross-entry');
    const detail = page.locator('.todo-detail-panel');
    await expect(detail.getByRole('heading', { name: '跨入口待办' })).toBeVisible();
    await detail.getByRole('button', { name: '编辑待办' }).click();
    await detail.getByRole('button', { name: '明天', exact: true }).click();
    await expect(detail.getByLabel('计划开始')).toHaveValue(tomorrowDate);
    await expect(detail.getByLabel('计划结束')).toHaveValue(tomorrowDate);
    await expect(detail.getByLabel('截止日期')).toHaveValue(tomorrowDate);
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(original);
    expect(await page.evaluate(() => localStorage.getItem('todoAppData'))).toBeNull();
    await detail.getByRole('button', { name: '取消', exact: true }).click();

    const openCalendarEntry = async (selector, name) => {
        await page.goto('/#/records');
        await page.getByRole('button', { name: '日', exact: true }).click();
        const entry = page.locator(selector).filter({ hasText: name });
        await expect(entry).toBeVisible();
        await entry.click();
        await expect(page).toHaveURL(/#\/todos\?todo=todo-cross-entry$/);
        await expect(page.locator('.todo-detail-panel').getByRole('heading', { name: '跨入口待办' })).toBeVisible();
    };

    await openCalendarEntry('.agenda-all-day-item', '计划：跨入口待办');
    await openCalendarEntry('.agenda-all-day-item', '截止：跨入口待办');
    await openCalendarEntry('.agenda-event-block', '执行：跨入口待办');

    const persisted = await page.evaluate(() => ({ data: localStorage.getItem('lifePlanData'), mirror: localStorage.getItem('todoAppData') }));
    expect(persisted.data).toBe(original);
    expect(persisted.mirror).toBeNull();
});

test('todo detail edits record-owned relationships and protects an exclusive source', async ({ page }) => {
    const source = emptyData({
        records: [
            { id: 'record-linked', type: '日记', title: '已有关联记录', content: '', startDate: '2026-07-27', endDate: '2026-07-27', todoIds: ['todo-relations'], updatedAt: '2026-07-27T08:00:00' },
            { id: 'record-available', type: '工作记录', title: '待关联记录', content: '', startDate: '2026-07-27', endDate: '2026-07-27', todoIds: [], updatedAt: '2026-07-27T08:00:00' },
            { id: 'idea-source', type: '灵感碎片', title: '灵感来源记录', content: '', startDate: '2026-07-27', endDate: '2026-07-27', todoIds: [], ideaTodoId: 'todo-relations', updatedAt: '2026-07-27T08:00:00' },
            { id: 'exclusive-source', type: '日记', title: '专属来源记录', content: '', startDate: '2026-07-27', endDate: '2026-07-27', todoIds: ['todo-exclusive-source'], updatedAt: '2026-07-27T08:00:00' },
        ],
        todos: [
            { id: 'todo-relations', text: '关系编辑待办', note: '', done: false, dueDate: '', planStartDate: '', planEndDate: '', urgency: 'medium', group: '其他', subTodos: [], sessions: [], completedAt: '', sourceType: 'manual', sourceRecordId: '', sourceMatchKey: '关系编辑待办', createdAt: '2026-07-27T08:00:00', updatedAt: '2026-07-27T08:00:00' },
            { id: 'todo-exclusive-source', text: '专属来源待办', note: '', done: false, dueDate: '2026-07-27', planStartDate: '2026-07-27', planEndDate: '2026-07-27', urgency: 'medium', group: '记录', subTodos: [], sessions: [], isExclusive: true, completedAt: '', sourceType: 'record', sourceRecordId: 'exclusive-source', sourceMatchKey: '专属来源待办', createdAt: '2026-07-27T08:00:00', updatedAt: '2026-07-27T08:00:00' },
        ],
    });
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), source);
    await page.goto('/#/todos?todo=todo-relations');
    const detail = page.locator('.todo-detail-panel');

    await detail.getByLabel('选择要关联的记录').selectOption('record-available');
    await detail.getByRole('button', { name: '关联', exact: true }).click();
    await expect(detail).toContainText('待关联记录');
    await expect(detail.getByRole('status')).toHaveText('记录已关联');

    page.once('dialog', dialog => dialog.accept());
    await detail.getByRole('button', { name: '解除关联 已有关联记录' }).click();
    await expect(detail.getByRole('button', { name: '解除关联 已有关联记录' })).toHaveCount(0);
    page.once('dialog', dialog => dialog.accept());
    await detail.getByRole('button', { name: '解除关联 灵感来源记录' }).click();
    await expect(detail.getByRole('button', { name: '解除关联 灵感来源记录' })).toHaveCount(0);

    const stored = await page.evaluate(() => ({
        data: JSON.parse(localStorage.getItem('lifePlanData')),
        mirror: JSON.parse(localStorage.getItem('todoAppData')),
    }));
    expect(stored.data.records.find(item => item.id === 'record-available').todoIds).toEqual(['todo-relations']);
    expect(stored.data.records.find(item => item.id === 'record-linked').todoIds).toEqual([]);
    expect(stored.data.records.find(item => item.id === 'idea-source').ideaTodoId).toBe('');
    for (const id of ['record-available', 'record-linked', 'idea-source']) {
        expect(stored.data.records.find(item => item.id === id).updatedAt).not.toBe('2026-07-27T08:00:00');
    }
    expect(stored.mirror.authority).toBe('lifePlanData.todos');
    expect(stored.mirror.todos.map(item => item.id)).toEqual(expect.arrayContaining(['todo-relations', 'todo-exclusive-source']));

    await page.goto('/#/todos?todo=todo-exclusive-source');
    await expect(detail).toContainText('专属来源记录');
    await expect(detail).toContainText('专属来源');
    await expect(detail.getByRole('button', { name: '解除关联 专属来源记录' })).toHaveCount(0);
});

test('habit quick check-in writes the legacy fields and rebuilds its local mirror', async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10);
    await page.addInitScript(({ data, date }) => localStorage.setItem('lifePlanData', JSON.stringify({
        ...data,
        habits: [{ id: 'habit-1', name: '阅读', rule: 'daily', timesPerDay: '1', startDate: date, rewardPoints: 2, rewardCurrency: '金币' }],
    })), { data: emptyData(), date: today });
    await page.goto('/#/habits');
    await page.getByRole('button', { name: '打卡' }).click();
    await expect(page.locator('#page-habits')).toContainText('1/1 次');
    const stored = await page.evaluate(() => ({ data: JSON.parse(localStorage.getItem('lifePlanData')), mirror: JSON.parse(localStorage.getItem('habitAppData')) }));
    expect(stored.data.checkins).toHaveLength(1);
    expect(stored.data.checkins[0]).toMatchObject({ habitId: 'habit-1', date: today, note: '' });
    expect(stored.mirror.localMirror).toBe(true);
    expect(stored.mirror.remoteUploadEnabled).toBe(false);
});

test('records day view maintains a fixed-width timed event with a complete hover title', async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10);
    await page.addInitScript(({ data, date }) => localStorage.setItem('lifePlanData', JSON.stringify({ ...data, records: [{ id: 'record-1', type: '日记', title: '这是一个完整的日程标题', content: '', startDate: date, endDate: date, recordTime: '09:00', recordEndTime: '10:00' }] })), { data: emptyData(), date: today });
    await page.goto('/#/records');
    await page.getByRole('button', { name: '日', exact: true }).click();
    const event = page.locator('.agenda-day-column .agenda-event-block').first();
    await expect(event).toHaveAttribute('title', /09:00 - 10:00 这是一个完整的日程标题/);
    await expect(event).toHaveCSS('width', '160px');
});

test('record editor persists linked and exclusive todos through the main data contract', async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10);
    await page.addInitScript(({ data, date }) => localStorage.setItem('lifePlanData', JSON.stringify({
        ...data,
        records: [{ id: 'record-1', type: '日记', title: '旧记录', content: '# 小结\n旧内容', startDate: date, endDate: date, recordTime: '08:00', recordEndTime: '09:00', todoIds: [] }],
        todos: [{ id: 'todo-1', text: '已有待办', note: '', done: false, dueDate: date, planStartDate: date, planEndDate: date, urgency: 'medium', group: '其他', subTodos: [], sessions: [], completedAt: '', sourceType: 'manual', sourceRecordId: '', sourceMatchKey: '已有待办' }],
    })), { data: emptyData(), date: today });
    await page.goto('/#/records');
    await page.getByRole('button', { name: /旧记录/ }).click();
    const editor = page.locator('.record-editor-panel');
    await editor.getByLabel('标题').fill('更新后的记录');
    await editor.getByLabel('内容').fill('# 小结\n更新后的内容');
    await editor.getByLabel('关联已有待办').selectOption('todo-1');
    await editor.getByRole('button', { name: '关联待办' }).click();
    await editor.getByLabel('新建专属待办').fill('记录专属下一步');
    await editor.getByRole('button', { name: '添加专属待办' }).click();
    await editor.getByRole('button', { name: '保存修改' }).click();
    await expect(editor).toContainText('记录已保存');

    const stored = await page.evaluate(() => ({
        data: JSON.parse(localStorage.getItem('lifePlanData')),
        mirror: JSON.parse(localStorage.getItem('todoAppData')),
    }));
    const record = stored.data.records.find(item => item.id === 'record-1');
    expect(record.title).toBe('更新后的记录');
    expect(record.content).toContain('更新后的内容');
    expect(record.todoIds).toContain('todo-1');
    const exclusive = stored.data.todos.find(item => item.text === '记录专属下一步');
    expect(exclusive).toMatchObject({ isExclusive: true, sourceType: 'record', sourceRecordId: 'record-1' });
    expect(record.todoIds).toContain(exclusive.id);
    expect(stored.mirror.authority).toBe('lifePlanData.todos');
    expect(stored.mirror.todos.map(item => item.id)).toEqual(expect.arrayContaining(['todo-1', exclusive.id]));
});

test('record built-in structured template preserves legacy markdown and template id', async ({ page }) => {
    const date = '2026-07-27';
    const source = emptyData({
        records: [{
            id: 'record-diary-template', type: '日记', title: '模板日记',
            content: '# 正文\n旧正文\n\n# 今日一句话\n旧一句话\n',
            templateId: 'builtin-diary-daily-review', templateFields: { body: '不应保留' },
            startDate: date, endDate: date, recordTime: '', recordEndTime: '', todoIds: [],
        }],
    });
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), source);
    await page.goto('/#/records');
    await page.getByRole('button', { name: /模板日记/ }).first().click();
    const editor = page.locator('.record-editor-panel');
    await expect(editor.getByLabel('记录模板')).toHaveValue('builtin:builtin-diary-daily-review');
    await expect(editor.getByLabel('内容')).toHaveAttribute('readonly', '');
    await editor.locator('summary').filter({ hasText: /^正文$/ }).click();
    await editor.getByLabel('正文').fill('新的正文');
    await editor.locator('summary').filter({ hasText: /^明日重点$/ }).click();
    await editor.getByLabel('明日重点').fill('先写迁移测试');
    await editor.getByRole('button', { name: '保存修改' }).click();

    const record = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')).records.find(item => item.id === 'record-diary-template'));
    expect(record.templateId).toBe('builtin-diary-daily-review');
    expect(record.templateFields).toBeUndefined();
    const expectedFields = [
        ['正文', '新的正文'], ['今日一句话', '旧一句话'], ['高兴', ''], ['思考', ''],
        ['小确幸', ''], ['待改进', ''], ['复盘', ''], ['明日重点', '先写迁移测试'],
    ];
    expect(record.content).toBe(expectedFields.map(([label, value]) => `# ${label}\n${value}`).join('\n\n') + '\n');
});

test('custom record templates clone todos and delete with a template tombstone', async ({ page }) => {
    const date = '2026-07-27';
    const source = emptyData({
        records: [
            { id: 'record-template-source', type: '工作记录', title: '模板来源', content: '# 今日完成\n完成旧任务', startDate: date, endDate: date, todoIds: ['todo-template-source'] },
            { id: 'record-template-target', type: '工作记录', title: '模板目标', content: '', startDate: date, endDate: date, todoIds: [] },
        ],
        todos: [todoFixture('todo-template-source', '模板里的下一步', { group: '工作', isExclusive: true, sourceType: 'record', sourceRecordId: 'record-template-source' })],
    });
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), source);
    await page.goto('/#/records');
    await page.getByRole('button', { name: /模板来源/ }).first().click();
    page.once('dialog', dialog => dialog.accept('工作推进模板'));
    await page.locator('.record-editor-panel').getByRole('button', { name: '保存为模板' }).click();
    const templateId = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')).templates[0].id);

    await page.locator('.record-editor-panel').getByRole('button', { name: '关闭' }).click();
    await page.getByRole('button', { name: /模板目标/ }).first().click();
    const editor = page.locator('.record-editor-panel');
    await editor.getByLabel('记录模板').selectOption(templateId);
    await editor.getByRole('button', { name: '应用模板' }).click();
    await editor.getByRole('button', { name: '保存修改' }).click();

    const applied = await page.evaluate(id => {
        const data = JSON.parse(localStorage.getItem('lifePlanData'));
        return { data, template: data.templates.find(item => item.id === id), target: data.records.find(item => item.id === 'record-template-target') };
    }, templateId);
    expect(applied.template).toMatchObject({ name: '工作推进模板', type: '工作记录', content: '# 今日完成\n完成旧任务' });
    expect(applied.template.todos[0]).toMatchObject({ text: '模板里的下一步', group: '工作', isExclusive: true });
    expect(applied.target.content).toBe('# 今日完成\n完成旧任务');
    expect(applied.target.templateId).toBe('');
    const clonedTodo = applied.data.todos.find(item => applied.target.todoIds.includes(item.id));
    expect(clonedTodo.id).not.toBe('todo-template-source');
    expect(clonedTodo).toMatchObject({ text: '模板里的下一步', sourceType: 'record', sourceRecordId: 'record-template-target' });

    await editor.getByRole('button', { name: '管理模板' }).click();
    page.once('dialog', dialog => dialog.accept());
    await editor.getByRole('button', { name: '删除模板 工作推进模板' }).click();
    const deleted = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(deleted.templates).toEqual([]);
    expect(deleted.deletedItems).toEqual(expect.arrayContaining([
        expect.objectContaining({ collection: 'templates', id: templateId, reason: 'manual-delete', name: '工作推进模板' }),
    ]));
});

test('todo remote preview stays GET-only and apply rechecks then persists the merged contract', async ({ page }) => {
    const local = emptyData({ todos: [todoFixture('todo-local-sync', '本机独立待办')] });
    const remote = todoRemoteSnapshot([todoFixture('todo-remote-sync', '云端独立待办', { updatedAt: '2026-07-27T09:00:00' })]);
    const original = JSON.stringify(local);
    await page.addInitScript(({ localData, remoteData }) => {
        localStorage.setItem('lifePlanData', JSON.stringify(localData));
        localStorage.setItem('lifePlanSyncConfig', JSON.stringify({ webdavUrl: 'https://sync.example.test', remotePath: '/life-plan.json', autoSync: true }));
        localStorage.setItem('lifePlanSyncState', JSON.stringify({ dirty: false }));
        window.__todoSyncRequests = [];
        window.fetch = async (url, options = {}) => {
            const method = options.method || 'GET';
            window.__todoSyncRequests.push({ url: String(url), method, headers: options.headers || {}, body: options.body || '' });
            if (method === 'GET') return new Response(JSON.stringify(remoteData), { status: 200, headers: { ETag: '"todo-v1"', 'Content-Type': 'application/json' } });
            return new Response('', { status: 200 });
        };
    }, { localData: local, remoteData: remote });

    await page.goto('/#/sync');
    const panel = page.locator('.todo-sync-card');
    await panel.getByRole('button', { name: '检查 Todo 云端' }).click();
    await expect(panel.getByRole('status')).toContainText('已生成');
    await expect(panel).toContainText('本机');
    await expect(panel).toContainText('云端');
    const previewed = await page.evaluate(() => ({
        data: localStorage.getItem('lifePlanData'),
        methods: window.__todoSyncRequests.map(item => item.method),
        config: JSON.parse(localStorage.getItem('todoAppSyncConfig')),
        state: JSON.parse(localStorage.getItem('todoAppSyncState')),
    }));
    expect(previewed.data).toBe(original);
    expect(previewed.methods).toEqual(['GET']);
    expect(previewed.config).toMatchObject({ remotePath: '/apps/todo-app/data.json', autoSync: false, remoteUploadEnabled: false });
    expect(previewed.state.lastRemoteEtag).toBe('"todo-v1"');

    page.once('dialog', dialog => dialog.accept());
    await panel.getByRole('button', { name: '应用合并到本机' }).click();
    await expect(panel.getByRole('status')).toContainText('已应用');
    const applied = await page.evaluate(() => ({
        methods: window.__todoSyncRequests.map(item => item.method),
        data: JSON.parse(localStorage.getItem('lifePlanData')),
        mirror: JSON.parse(localStorage.getItem('todoAppData')),
        state: JSON.parse(localStorage.getItem('todoAppSyncState')),
        mainState: JSON.parse(localStorage.getItem('lifePlanSyncState')),
        snapshots: JSON.parse(localStorage.getItem('lifePlanSnapshots') || '[]'),
    }));
    expect(applied.methods).toEqual(['GET', 'GET']);
    expect(applied.data.todos.map(item => item.id)).toEqual(expect.arrayContaining(['todo-local-sync', 'todo-remote-sync']));
    expect(applied.mirror.todos.map(item => item.id)).toEqual(expect.arrayContaining(['todo-local-sync', 'todo-remote-sync']));
    expect(applied.mirror.authority).toBe('lifePlanData.todos');
    expect(applied.state.dirty).toBe(true);
    expect(applied.mainState.dirty).toBe(true);
    expect(applied.snapshots.some(item => item.reason === '应用 Todo 云端合并结果前')).toBe(true);
});

test('todo existing remote upload uses If-Match and verifies the written mirror', async ({ page }) => {
    const local = emptyData({ todos: [todoFixture('todo-existing-sync', '本机新版待办', { updatedAt: '2026-07-27T10:00:00' })] });
    const remote = todoRemoteSnapshot([todoFixture('todo-existing-sync', '云端旧版待办', { updatedAt: '2026-07-27T08:00:00' })]);
    await page.addInitScript(({ localData, remoteData }) => {
        localStorage.setItem('lifePlanData', JSON.stringify(localData));
        localStorage.setItem('lifePlanSyncConfig', JSON.stringify({ webdavUrl: 'https://sync.example.test', remotePath: '/life-plan.json' }));
        localStorage.setItem('todoAppSyncConfig', JSON.stringify({ remotePath: '/unsafe-old-path.json', autoSync: true, remoteUploadEnabled: true }));
        window.__todoSyncRequests = [];
        window.__todoUploaded = null;
        window.fetch = async (url, options = {}) => {
            const method = options.method || 'GET';
            window.__todoSyncRequests.push({ url: String(url), method, headers: options.headers || {}, body: options.body || '' });
            if (method === 'PUT') {
                window.__todoUploaded = JSON.parse(options.body);
                return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ETag: '"todo-v2"' } });
            }
            if (method === 'GET') {
                const fileGets = window.__todoSyncRequests.filter(item => item.method === 'GET').length;
                const body = fileGets >= 3 && window.__todoUploaded ? window.__todoUploaded : remoteData;
                return new Response(JSON.stringify(body), { status: 200, headers: { ETag: fileGets >= 3 ? '"todo-v2"' : '"todo-v1"', 'Content-Type': 'application/json' } });
            }
            return new Response('', { status: 200 });
        };
    }, { localData: local, remoteData: remote });

    await page.goto('/#/sync');
    const panel = page.locator('.todo-sync-card');
    await panel.getByRole('button', { name: '检查 Todo 云端' }).click();
    page.once('dialog', dialog => dialog.accept());
    await panel.getByRole('button', { name: '受保护上传' }).click();
    await expect(panel.getByRole('status')).toContainText('回读核验一致');

    const result = await page.evaluate(() => ({
        requests: window.__todoSyncRequests,
        uploaded: window.__todoUploaded,
        state: JSON.parse(localStorage.getItem('todoAppSyncState')),
        config: JSON.parse(localStorage.getItem('todoAppSyncConfig')),
    }));
    const fileRequests = result.requests.filter(item => item.url.includes('/apps/todo-app/data.json'));
    expect(fileRequests.map(item => item.method)).toEqual(['GET', 'GET', 'PUT', 'GET']);
    const put = fileRequests.find(item => item.method === 'PUT');
    expect(put.headers['If-Match'] || put.headers['if-match']).toBe('"todo-v1"');
    expect(result.uploaded.todos[0].text).toBe('本机新版待办');
    expect(result.state).toMatchObject({ dirty: false, lastRemoteEtag: '"todo-v2"' });
    expect(result.config).toMatchObject({ autoSync: false, remoteUploadEnabled: false });
});

test('todo existing upload stops before PUT when the remote changed after preview', async ({ page }) => {
    const local = emptyData({ todos: [todoFixture('todo-race-local', '竞态本机待办', { updatedAt: '2026-07-27T10:00:00' })] });
    const remoteBefore = todoRemoteSnapshot([todoFixture('todo-race-remote', '预览云端待办')]);
    const remoteAfter = todoRemoteSnapshot([
        ...remoteBefore.todos,
        todoFixture('todo-race-new', '另一设备新增待办', { updatedAt: '2026-07-27T11:00:00' }),
    ]);
    await page.addInitScript(({ localData, firstRemote, secondRemote }) => {
        localStorage.setItem('lifePlanData', JSON.stringify(localData));
        localStorage.setItem('lifePlanSyncConfig', JSON.stringify({ webdavUrl: 'https://sync.example.test', remotePath: '/life-plan.json' }));
        window.__todoSyncRequests = [];
        window.fetch = async (url, options = {}) => {
            const method = options.method || 'GET';
            window.__todoSyncRequests.push({ url: String(url), method, headers: options.headers || {} });
            if (method === 'GET') {
                const count = window.__todoSyncRequests.filter(item => item.method === 'GET').length;
                return new Response(JSON.stringify(count === 1 ? firstRemote : secondRemote), {
                    status: 200,
                    headers: { ETag: count === 1 ? '"todo-v1"' : '"todo-v2"', 'Content-Type': 'application/json' },
                });
            }
            return new Response('', { status: 200 });
        };
    }, { localData: local, firstRemote: remoteBefore, secondRemote: remoteAfter });

    await page.goto('/#/sync');
    const panel = page.locator('.todo-sync-card');
    await panel.getByRole('button', { name: '检查 Todo 云端' }).click();
    await panel.getByRole('button', { name: '受保护上传' }).click();
    await expect(panel.getByRole('status')).toContainText('云端自上次检查后已变化');
    const result = await page.evaluate(() => ({
        methods: window.__todoSyncRequests.map(item => item.method),
        state: JSON.parse(localStorage.getItem('todoAppSyncState')),
    }));
    expect(result.methods).toEqual(['GET', 'GET']);
    expect(result.state.lastConflictAt).toBeTruthy();
});

test('todo first remote creation requires session arm and uses If-None-Match', async ({ page }) => {
    const local = emptyData({ todos: [todoFixture('todo-first-sync', '首次云端待办')] });
    await page.addInitScript(localData => {
        localStorage.setItem('lifePlanData', JSON.stringify(localData));
        localStorage.setItem('lifePlanSyncConfig', JSON.stringify({ webdavUrl: 'https://sync.example.test', remotePath: '/life-plan.json' }));
        localStorage.setItem('todoAppSyncConfig', JSON.stringify({ remotePath: '/unsafe-old-path.json', autoSync: true, remoteUploadEnabled: true }));
        window.__todoSyncRequests = [];
        window.__todoUploaded = null;
        window.fetch = async (url, options = {}) => {
            const method = options.method || 'GET';
            window.__todoSyncRequests.push({ url: String(url), method, headers: options.headers || {}, body: options.body || '' });
            if (method === 'PUT') {
                window.__todoUploaded = JSON.parse(options.body);
                return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ETag: '"todo-created"' } });
            }
            if (method === 'GET') {
                if (!window.__todoUploaded) return new Response('missing', { status: 404 });
                return new Response(JSON.stringify(window.__todoUploaded), { status: 200, headers: { ETag: '"todo-created"', 'Content-Type': 'application/json' } });
            }
            return new Response('', { status: 200 });
        };
    }, local);

    await page.goto('/#/sync');
    const panel = page.locator('.todo-sync-card');
    await panel.getByRole('button', { name: '检查 Todo 云端' }).click();
    await expect(panel.getByRole('status')).toContainText('不存在');
    await expect(panel.getByRole('checkbox', { name: '本次会话允许首次创建' })).not.toBeChecked();
    expect(await page.evaluate(() => window.__todoSyncRequests.filter(item => item.method === 'PUT').length)).toBe(0);
    await panel.getByRole('checkbox', { name: '本次会话允许首次创建' }).check();
    page.once('dialog', dialog => dialog.accept());
    await panel.getByRole('button', { name: '首次创建' }).click();
    await expect(panel.getByRole('status')).toContainText('回读核验一致');

    const result = await page.evaluate(() => ({
        requests: window.__todoSyncRequests,
        state: JSON.parse(localStorage.getItem('todoAppSyncState')),
        config: JSON.parse(localStorage.getItem('todoAppSyncConfig')),
    }));
    const fileRequests = result.requests.filter(item => item.url.includes('/apps/todo-app/data.json'));
    expect(fileRequests.map(item => item.method)).toEqual(['GET', 'GET', 'PUT', 'GET']);
    const put = fileRequests.find(item => item.method === 'PUT');
    expect(put.headers['If-None-Match'] || put.headers['if-none-match']).toBe('*');
    expect(result.state).toMatchObject({ dirty: false, lastRemoteEtag: '"todo-created"' });
    expect(result.config).toMatchObject({ autoSync: false, remoteUploadEnabled: false });
});

test('main sync upload uses If-Match and merges after a 412 conflict', async ({ page }) => {
    const localData = emptyData({
        records: [
            { id: 'local-record', type: '日记', title: '本机记录', content: '', startDate: '2026-07-27', endDate: '2026-07-27', todoIds: [], updatedAt: '2026-07-27T10:00:00' },
        ],
        deletedItems: [
            { collection: 'records', id: 'deleted-record', deletedAt: '2026-07-27T10:30:00', reason: 'local-delete' },
        ],
    });
    const remoteBase = emptyData({
        records: [
            { id: 'remote-base', type: '日记', title: '云端基线', content: '', startDate: '2026-07-26', endDate: '2026-07-26', todoIds: [], updatedAt: '2026-07-26T12:00:00' },
            { id: 'deleted-record', type: '日记', title: '不应复活', content: '', startDate: '2026-07-25', endDate: '2026-07-25', todoIds: [], updatedAt: '2026-07-25T12:00:00' },
        ],
    });
    const remoteConflict = emptyData({
        records: [
            ...remoteBase.records,
            { id: 'remote-conflict', type: '日记', title: '另一设备记录', content: '', startDate: '2026-07-27', endDate: '2026-07-27', todoIds: [], updatedAt: '2026-07-27T10:45:00' },
        ],
    });

    await page.addInitScript(({ local, firstRemote, secondRemote }) => {
        localStorage.setItem('lifePlanData', JSON.stringify(local));
        localStorage.setItem('lifePlanSyncConfig', JSON.stringify({ webdavUrl: 'https://sync.example.test', remotePath: '/life-plan.json', autoSync: true }));
        localStorage.setItem('lifePlanSyncState', JSON.stringify({ dirty: true, lastRemoteHash: '', lastRemoteEtag: '' }));
        window.__syncRequests = [];
        window.fetch = async (url, options = {}) => {
            const method = options.method || 'GET';
            const headers = options.headers || {};
            window.__syncRequests.push({ url: String(url), method, headers, body: options.body || '' });
            const jsonResponse = (body, etag, status = 200) => new Response(JSON.stringify(body), { status, headers: { ETag: etag, 'Content-Type': 'application/json' } });
            if (method === 'GET') {
                const getCount = window.__syncRequests.filter(item => item.method === 'GET').length;
                return jsonResponse(getCount === 1 ? firstRemote : secondRemote, getCount === 1 ? '"v1"' : '"v2"');
            }
            if (method === 'PUT') {
                const putCount = window.__syncRequests.filter(item => item.method === 'PUT').length;
                if (putCount === 1) return new Response('conflict', { status: 412, headers: { ETag: '"stale"' } });
                return jsonResponse({ ok: true, etag: '"v3"' }, '"v3"');
            }
            return new Response('', { status: 200 });
        };
    }, { local: localData, firstRemote: remoteBase, secondRemote: remoteConflict });

    await page.goto('/#/sync');
    await page.getByRole('button', { name: '上传主数据' }).click();
    await expect(page.locator('.sync-status')).toContainText('云端版本变化');

    const result = await page.evaluate(() => ({
        requests: window.__syncRequests,
        data: JSON.parse(localStorage.getItem('lifePlanData')),
        state: JSON.parse(localStorage.getItem('lifePlanSyncState')),
        snapshots: JSON.parse(localStorage.getItem('lifePlanSnapshots') || '[]'),
    }));
    const putRequests = result.requests.filter(item => item.method === 'PUT');
    const getRequests = result.requests.filter(item => item.method === 'GET');
    expect(getRequests).toHaveLength(2);
    expect(putRequests).toHaveLength(2);
    expect(putRequests.map(item => item.headers['If-Match'] || item.headers['if-match'])).toEqual(['"v1"', '"v2"']);
    expect(result.data.records.map(item => item.id)).toEqual(expect.arrayContaining(['local-record', 'remote-base', 'remote-conflict']));
    expect(result.data.records.map(item => item.id)).not.toContain('deleted-record');
    expect(result.data.deletedItems).toEqual(expect.arrayContaining([expect.objectContaining({ collection: 'records', id: 'deleted-record' })]));
    expect(result.state.dirty).toBe(false);
    expect(result.state.lastRemoteEtag).toBe('"v3"');
    expect(result.state.lastConflictAt).toBeTruthy();
    expect(result.snapshots.some(item => item.reason === '条件写入冲突合并前')).toBe(true);
    expect(result.snapshots.some(item => item.reason === '条件写入冲突合并结果')).toBe(true);
});
