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

async function expectHashRoute(page, path, query = {}) {
    await expect.poll(() => page.evaluate(() => {
        const [hashPath, rawQuery = ''] = location.hash.replace(/^#/, '').split('?');
        return { path: hashPath, query: Object.fromEntries(new URLSearchParams(rawQuery)) };
    })).toEqual({ path, query });
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

test('dashboard command center periods and recent timeline stay read-only', async ({ page }) => {
    const dateAt = amount => {
        const date = new Date();
        date.setDate(date.getDate() + amount);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };
    const today = dateAt(0);
    const yesterday = dateAt(-1);
    const tomorrow = dateAt(1);
    const source = emptyData({
        records: [
            { id: 'record-dashboard-period', type: '周计划', title: '本周计划入口', content: '周期内容', startDate: yesterday, endDate: tomorrow, todoIds: ['todo-dashboard-done', 'todo-dashboard-session'], createdAt: `${yesterday}T08:00:00`, updatedAt: `${yesterday}T08:00:00` },
            { id: 'record-dashboard-day', type: '日记', title: 'Dashboard 日记记录', content: '记录正文', startDate: today, endDate: today, recordTime: '09:00', recordEndTime: '09:30', todoIds: [], createdAt: `${today}T09:00:00`, updatedAt: `${today}T09:00:00` },
            { id: 'idea-dashboard-unprocessed', type: '灵感碎片', title: '未处理 Dashboard 灵感', content: '灵感内容', startDate: today, endDate: today, ideaStatus: '待整理', ideaTags: ['dashboard'], ideaNextAction: '', ideaConclusion: '', todoIds: [] },
            { id: 'idea-dashboard-conclusion', type: '灵感碎片', title: '待结论 Dashboard 灵感', content: '实验内容', startDate: today, endDate: today, ideaStatus: '实践中', ideaTags: ['dashboard'], ideaNextAction: '', ideaConclusion: '', todoIds: [] },
        ],
        todos: [
            todoFixture('todo-dashboard-overdue', '超期高压待办', { dueDate: yesterday, urgency: 'high', group: '工作' }),
            todoFixture('todo-dashboard-done', '已完成今日待办', { dueDate: today, done: true, completedAt: `${today}T08:30:00` }),
            todoFixture('todo-dashboard-plan-due', '计划截止不进首页时间轴', { dueDate: today, planStartDate: today, planEndDate: today, urgency: 'medium' }),
            todoFixture('todo-dashboard-session', '执行入口待办', { sessions: [{ id: 'session-dashboard', date: today, startTime: '10:00', endTime: '10:45', note: '首页执行记录', createdAt: `${today}T10:00:00` }] }),
            todoFixture('todo-dashboard-floating', '无截止池入口待办', { urgency: 'low' }),
        ],
        habits: [{ id: 'habit-dashboard', name: 'Dashboard 习惯', tag: '健康', rule: 'daily', timesPerDay: 1, startDate: yesterday }],
        checkins: [{ id: 'checkin-dashboard', habitId: 'habit-dashboard', date: today, time: '07:00', checkinAt: `${today}T07:00:00`, note: '首页习惯记录' }],
        goals: [
            { id: 'goal-dashboard', name: 'Dashboard 目标', status: '进行中', progress: 66, createdAt: `${yesterday}T08:00:00`, updatedAt: `${today}T08:00:00` },
            { id: 'goal-paused', name: '暂停目标', status: '暂停', progress: 20 },
        ],
        materials: [{ id: 'material-dashboard', type: '摘抄', content: 'Dashboard 素材内容', tags: ['dashboard'], source: '测试', note: '首页入口', createdAt: `${today}T08:00:00`, updatedAt: `${today}T08:00:00` }],
    });
    const original = JSON.stringify(source);
    await page.addInitScript(value => localStorage.setItem('lifePlanData', value), original);

    await page.goto('/#/dashboard');
    await expect(page.locator('.summary-card').filter({ hasText: '今日待办' })).toContainText('1/4');
    await expect(page.locator('.summary-card').filter({ hasText: '今日习惯' })).toContainText('1/1');
    await expect(page.locator('.summary-card').filter({ hasText: '进行目标' })).toContainText('1');
    const commandMetrics = page.locator('.command-metric');
    await expect(commandMetrics.filter({ hasText: '未处理灵感' })).toContainText('1');
    await expect(commandMetrics.filter({ hasText: '待写结论' })).toContainText('1');
    await expect(commandMetrics.filter({ hasText: '高压待办' })).toContainText('1');
    await expect(page.locator('.dashboard-timeline')).toContainText('Dashboard 日记记录');
    await expect(page.locator('.dashboard-timeline')).toContainText('执行：执行入口待办');
    await expect(page.locator('.dashboard-timeline')).toContainText('Dashboard 习惯');
    await expect(page.locator('.dashboard-timeline')).not.toContainText('计划：计划截止不进首页时间轴');
    await expect(page.locator('.dashboard-timeline')).not.toContainText('截止：计划截止不进首页时间轴');

    await page.locator('.command-row').filter({ hasText: '超期高压待办' }).click();
    await expectHashRoute(page, '/todos', { todo: 'todo-dashboard-overdue' });

    await page.goto('/#/dashboard');
    await page.getByRole('button', { name: /Dashboard 素材内容/ }).click();
    await expectHashRoute(page, '/materials', { material: 'material-dashboard' });

    await page.goto('/#/dashboard');
    await page.locator('.period-item').filter({ hasText: '本周计划入口' }).click();
    await expectHashRoute(page, '/records', { record: 'record-dashboard-period' });

    await page.goto('/#/dashboard');
    await page.getByRole('button', { name: /执行：执行入口待办/ }).click();
    await expectHashRoute(page, '/todos', { todo: 'todo-dashboard-session' });

    await page.goto('/#/dashboard');
    await page.getByRole('button', { name: /Dashboard 习惯/ }).click();
    await expectHashRoute(page, '/habits', { habit: 'habit-dashboard' });

    await page.goto('/#/dashboard');
    await page.getByRole('button', { name: /Dashboard 目标/ }).click();
    await expectHashRoute(page, '/goals', { goal: 'goal-dashboard' });

    const persisted = await page.evaluate(() => ({ data: localStorage.getItem('lifePlanData'), mirror: localStorage.getItem('todoAppData') }));
    expect(persisted.data).toBe(original);
    expect(persisted.mirror).toBeNull();
});

test('goals detail route save and delete preserve the legacy contract', async ({ page }) => {
    const today = (() => {
        const date = new Date();
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    })();
    const source = emptyData({
        goals: [{ id: 'goal-existing', name: '旧目标', period: '年度', target: '旧描述', status: '进行中', progress: 35, createDate: '2026-01-01' }],
    });
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), source);

    await page.goto('/#/goals?goal=goal-existing');
    const dialog = page.getByRole('dialog', { name: '编辑目标' });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('目标', { exact: true }).fill('更新后的目标');
    await dialog.getByLabel('周期').selectOption('长期');
    await dialog.getByLabel('目标描述').fill('新的目标描述');
    await dialog.getByLabel('状态').selectOption('已完成');
    await dialog.getByRole('slider').fill('70');
    await dialog.getByRole('button', { name: '保存' }).click();
    await expect(page.getByRole('button', { name: /更新后的目标/ })).toContainText('70%');

    let persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    let existing = persisted.goals.find(goal => goal.id === 'goal-existing');
    expect(existing).toMatchObject({ id: 'goal-existing', name: '更新后的目标', period: '长期', target: '新的目标描述', status: '已完成', progress: 70, createDate: '2026-01-01' });
    expect(existing.updatedAt).toBeUndefined();
    expect(existing.createdAt).toBeUndefined();

    await page.getByRole('button', { name: '新建目标' }).click();
    const createDialog = page.getByRole('dialog', { name: '新建目标' });
    await createDialog.getByLabel('目标', { exact: true }).fill('新增季度目标');
    await createDialog.getByLabel('目标描述').fill('季度描述');
    await createDialog.getByLabel('状态').selectOption('暂停');
    await createDialog.getByRole('slider').fill('20');
    await createDialog.getByRole('button', { name: '保存' }).click();

    persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    const created = persisted.goals.find(goal => goal.name === '新增季度目标');
    expect(created).toMatchObject({ period: '', target: '季度描述', status: '暂停', progress: 20, createDate: today });
    expect(created.createdAt).toBeUndefined();
    expect(created.updatedAt).toBeUndefined();

    await page.goto('/#/goals?goal=goal-existing');
    page.once('dialog', dialogEvent => dialogEvent.accept());
    await page.getByRole('dialog', { name: '编辑目标' }).getByRole('button', { name: '删除' }).click();

    persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(persisted.goals.some(goal => goal.id === 'goal-existing')).toBe(false);
    expect(persisted.deletedItems).toEqual(expect.arrayContaining([
        expect.objectContaining({ collection: 'goals', id: 'goal-existing', reason: 'manual-delete', name: '更新后的目标' }),
    ]));
    const mirror = await page.evaluate(() => JSON.parse(localStorage.getItem('todoAppData')));
    expect(mirror.authority).toBe('lifePlanData.todos');
    expect(mirror.todos).toEqual([]);
});

test('search and tag center restore legacy read-only index navigation', async ({ page }) => {
    const source = emptyData({
        records: [
            { id: 'record-search', type: '日记', title: '搜索日记入口', content: '路线记录正文', startDate: '2026-07-28', endDate: '2026-07-28', todoIds: [] },
            { id: 'idea-search', type: '灵感碎片', title: '标签灵感入口', content: '共享标签灵感', startDate: '2026-07-28', endDate: '2026-07-28', ideaStatus: '待整理', ideaTags: ['共享标签'], todoIds: [] },
        ],
        todos: [todoFixture('todo-search', '搜索待办入口', { note: '路线待办备注', group: '路线组' })],
        goals: [{ id: 'goal-search', name: '搜索目标 OKR', period: '年度', target: '路线目标', status: '进行中', progress: 42, createDate: '2026-01-01' }],
        materials: [{ id: 'material-search', type: '摘抄', content: '共享标签素材内容', tags: ['共享标签'], source: '路线素材', note: '素材备注', createdAt: '2026-07-28T08:00:00', updatedAt: '2026-07-28T08:00:00' }],
        templates: [{ id: 'template-search', name: '搜索模板入口', type: '工作记录', content: '模板路线内容', todos: [{ text: '模板下一步' }] }],
        wheelTags: [{ id: 'wheel-tag-search', name: '共享标签', color: '#216e4e', weight: 1, enabled: true }],
        wheelLibraryItems: [{ id: 'wheel-library-search', name: '搜索转盘公共项', note: '路线转盘备注', tagIds: ['wheel-tag-search'], weight: 3, enabled: true }],
    });
    const original = JSON.stringify(source);
    await page.addInitScript(value => localStorage.setItem('lifePlanData', value), original);

    await page.goto('/#/search?q=路线');
    await expect(page.locator('.search-group-title').filter({ hasText: '记录' })).toContainText('1');
    await expect(page.locator('.search-group-title').filter({ hasText: '待办' })).toContainText('1');
    await expect(page.locator('.search-group-title').filter({ hasText: '目标' })).toContainText('1');
    await expect(page.locator('.search-group-title').filter({ hasText: '素材库' })).toContainText('1');
    await expect(page.locator('.search-group-title').filter({ hasText: '模板' })).toContainText('1');
    await expect(page.locator('.search-group-title').filter({ hasText: '转盘公共项' })).toContainText('1');

    await page.locator('.search-result-item').filter({ hasText: '搜索目标 OKR' }).click();
    await expectHashRoute(page, '/goals', { goal: 'goal-search' });
    await expect(page.getByRole('dialog', { name: '编辑目标' })).toBeVisible();

    await page.goto('/#/search?q=模板下一步&scope=templates');
    await expect(page.locator('.search-result-item')).toHaveCount(1);
    await page.locator('.search-result-item').filter({ hasText: '搜索模板入口' }).click();
    await expectHashRoute(page, '/records', { template: 'template-search' });

    await page.goto('/#/search?q=路线转盘&scope=wheel');
    await page.locator('.search-result-item').filter({ hasText: '搜索转盘公共项' }).click();
    await expectHashRoute(page, '/wheel', { library: 'wheel-library-search' });
    await expect(page.getByPlaceholder('公共项名称')).toHaveValue('搜索转盘公共项');

    await page.goto('/#/tags');
    await expect(page.locator('.mini-summary-card').filter({ hasText: '全部标签' })).toContainText('1');
    const sharedCard = page.locator('.tag-center-card').filter({ hasText: '共享标签' });
    await expect(sharedCard).toContainText('标签灵感入口');
    await expect(sharedCard).toContainText('共享标签素材内容');
    await expect(sharedCard).toContainText('搜索转盘公共项');

    await sharedCard.getByRole('button').filter({ hasText: '灵感' }).click();
    await expectHashRoute(page, '/ideas', { tag: '共享标签' });
    await expect(page.locator('.idea-card')).toContainText('标签灵感入口');

    await page.goto('/#/tags');
    await page.locator('.tag-center-card').filter({ hasText: '共享标签' }).getByRole('button').filter({ hasText: '素材' }).click();
    await expectHashRoute(page, '/materials', { tag: '共享标签' });

    await page.goto('/#/tags');
    await page.locator('.tag-center-card').filter({ hasText: '共享标签' }).getByRole('button').filter({ hasText: '转盘项' }).click();
    await expectHashRoute(page, '/wheel', { tag: 'wheel-tag-search' });
    await expect(page.getByPlaceholder('标签名称')).toHaveValue('共享标签');

    const persisted = await page.evaluate(() => ({ data: localStorage.getItem('lifePlanData'), mirror: localStorage.getItem('todoAppData') }));
    expect(persisted.data).toBe(original);
    expect(persisted.mirror).toBeNull();
});

test('main import export keeps snapshots tombstones mirrors and dirty state compatible', async ({ page }) => {
    const local = emptyData({
        records: [
            { id: 'record-local', type: '日记', title: '本机保留记录', content: '本机正文', startDate: '2026-07-28', endDate: '2026-07-28', updatedAt: '2026-07-28T10:00:00' },
        ],
        deletedItems: [
            { collection: 'records', id: 'record-deleted', deletedAt: '2026-07-28T11:00:00', reason: 'manual-delete' },
        ],
    });
    const imported = emptyData({
        records: [
            { id: 'record-deleted', type: '日记', title: '不应复活记录', content: '旧备份正文', startDate: '2026-07-27', endDate: '2026-07-27', updatedAt: '2026-07-27T08:00:00' },
            { id: 'record-imported', type: '工作记录', title: '导入记录', content: '导入正文', startDate: '2026-07-28', endDate: '2026-07-28', updatedAt: '2026-07-28T12:00:00' },
        ],
        todos: [todoFixture('todo-imported', '导入待办', { note: '导入备注', updatedAt: '2026-07-28T12:00:00' })],
        habits: [{ id: 'habit-imported', name: '导入习惯', rule: 'daily', startDate: '2026-07-01', timesPerDay: 1, reward: 2, rewardCurrency: '金币', createdAt: '2026-07-01T08:00:00', updatedAt: '2026-07-28T12:00:00' }],
        checkins: [{ id: 'checkin-imported', habitId: 'habit-imported', date: '2026-07-28', time: '08:00', checkinAt: '2026-07-28T08:00:00', amount: 2, currency: '金币' }],
        habitPointLedger: [{ id: 'ledger-imported', habitId: 'habit-imported', sourceId: 'checkin-imported', date: '2026-07-28', amount: 2, currency: '金币', type: 'reward', createdAt: '2026-07-28T08:00:00' }],
        materials: [{ id: 'material-imported', type: '摘抄', content: '导入素材', tags: ['导入'], source: '备份', note: '', createdAt: '2026-07-28T09:00:00', updatedAt: '2026-07-28T09:00:00' }],
    });
    await page.addInitScript(({ localData }) => {
        localStorage.setItem('lifePlanData', JSON.stringify(localData));
        localStorage.setItem('lifePlanSyncState', JSON.stringify({ dirty: false, lastRemoteHash: 'remote-before' }));
        localStorage.setItem('habitAppData', JSON.stringify({ localMirror: true, habits: [], mirror: { reason: 'stale' } }));
    }, { localData: local });

    await page.goto('/#/sync');
    await page.locator('input[type="file"]').setInputFiles({
        name: 'import-contract.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(imported), 'utf8'),
    });
    await expect(page.locator('.sync-status')).toContainText('导入已按合并规则完成');

    const state = await page.evaluate(() => ({
        data: JSON.parse(localStorage.getItem('lifePlanData')),
        todoMirror: JSON.parse(localStorage.getItem('todoAppData')),
        habitMirror: JSON.parse(localStorage.getItem('habitAppData')),
        syncState: JSON.parse(localStorage.getItem('lifePlanSyncState')),
        snapshots: JSON.parse(localStorage.getItem('lifePlanSnapshots') || '[]'),
    }));
    expect(state.data.records.some(record => record.id === 'record-deleted')).toBe(false);
    expect(state.data.records.some(record => record.id === 'record-local')).toBe(true);
    expect(state.data.records.some(record => record.id === 'record-imported')).toBe(true);
    expect(state.data.todos.find(todo => todo.id === 'todo-imported').text).toBe('导入待办');
    expect(state.data.habits.find(habit => habit.id === 'habit-imported').name).toBe('导入习惯');
    expect(state.data.deletedItems).toEqual(expect.arrayContaining([
        expect.objectContaining({ collection: 'records', id: 'record-deleted', reason: 'manual-delete' }),
    ]));
    expect(state.todoMirror.authority).toBe('lifePlanData.todos');
    expect(state.todoMirror.remoteUploadEnabled).toBe(false);
    expect(state.todoMirror.todos).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'todo-imported', text: '导入待办' })]));
    expect(state.habitMirror.localMirror).toBe(true);
    expect(state.habitMirror.remoteUploadEnabled).toBe(false);
    expect(state.habitMirror.habits).toEqual(expect.arrayContaining([expect.objectContaining({ id: expect.stringContaining('habit-imported') })]));
    expect(state.habitMirror.habitRecords.length).toBeGreaterThan(0);
    expect(state.habitMirror.mirror.reason).toBe('import-merge');
    expect(state.syncState.dirty).toBe(true);
    expect(state.syncState.lastLocalHash).toBeTruthy();
    expect(state.snapshots.map(snapshot => snapshot.reason)).toEqual(expect.arrayContaining(['导入前自动备份', '导入合并结果']));

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '导出备份' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^life-plan-backup-.*\.json$/);
    const afterExport = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanSnapshots') || '[]'));
    expect(afterExport.map(snapshot => snapshot.reason)).toContain('手动导出备份');
});

test('fitness plans support multiple exercises and explicit plan writeback', async ({ page }) => {
    const source = emptyData({
        exerciseLibrary: [
            { id: 'ex-squat', name: '杠铃深蹲', muscle: 'leg', defaultSets: 2, defaultReps: '5', defaultWeight: 80, restSec: 150, createdAt: '2026-07-28T07:00:00', updatedAt: '2026-07-28T07:00:00' },
            { id: 'ex-bench', name: '杠铃卧推', muscle: 'chest', defaultSets: 2, defaultReps: '6', defaultWeight: 60, restSec: 120, createdAt: '2026-07-28T07:10:00', updatedAt: '2026-07-28T07:10:00' },
        ],
    });
    await page.addInitScript(data => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        localStorage.setItem('lifePlanSyncState', JSON.stringify({ dirty: false, lastRemoteHash: 'fitness-remote-before' }));
    }, source);

    await page.goto('/#/fitness');
    const planForm = page.locator('form.card').filter({ hasText: '创建训练计划' });
    await planForm.locator('.form-group').filter({ hasText: '计划名称' }).locator('input').fill('力量计划');
    await planForm.locator('.form-group').filter({ hasText: '目标' }).locator('select').selectOption('strength');
    await planForm.locator('.form-group').filter({ hasText: '状态' }).locator('select').selectOption('active');
    await planForm.locator(':scope > .form-group input').fill('保留多动作处方');

    let planCards = planForm.locator('.fitness-plan-exercise-card');
    await planCards.nth(0).locator('.fitness-plan-exercise-card-head input').fill('杠铃深蹲');
    await planCards.nth(0).locator('.fitness-plan-set-row').nth(0).locator('input').nth(0).fill('80');
    await planCards.nth(0).locator('.fitness-plan-set-row').nth(0).locator('input').nth(1).fill('5');
    await planCards.nth(0).locator('.fitness-plan-set-row').nth(1).locator('input').nth(0).fill('82.5');
    await planCards.nth(0).locator('.fitness-plan-set-row').nth(1).locator('input').nth(1).fill('5');
    await planForm.getByRole('button', { name: '添加动作' }).click();
    planCards = planForm.locator('.fitness-plan-exercise-card');
    await planCards.nth(1).locator('.fitness-plan-exercise-card-head input').fill('杠铃卧推');
    await planCards.nth(1).locator('.fitness-plan-set-row').nth(0).locator('input').nth(0).fill('60');
    await planCards.nth(1).locator('.fitness-plan-set-row').nth(0).locator('input').nth(1).fill('6');
    await planCards.nth(1).locator('.fitness-plan-set-row').nth(1).locator('input').nth(0).fill('62.5');
    await planCards.nth(1).locator('.fitness-plan-set-row').nth(1).locator('input').nth(1).fill('6');
    await planForm.getByRole('button', { name: '创建计划' }).click();
    await expect(page.locator('.notice.success')).toContainText('训练计划已创建');

    let stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.fitnessPlans).toHaveLength(1);
    expect(stored.fitnessPlans[0].exercises.map(exercise => exercise.name)).toEqual(['杠铃深蹲', '杠铃卧推']);
    expect(stored.fitnessPlans[0].days[0].exercises).toHaveLength(2);
    expect(stored.fitnessPlans[0].exercises[0].sets.map(set => set.weight)).toEqual([80, 82.5]);

    await page.locator('.fitness-metric-row').filter({ hasText: '力量计划' }).getByRole('button', { name: '按计划开练' }).click();
    await expect(page.getByText('正在训练：力量计划')).toBeVisible();
    let active = page.locator('#page-fitness > article.card').first();
    let activeRows = active.locator('.fitness-metric-row');
    await activeRows.nth(0).locator('input').nth(0).fill('85');
    await activeRows.nth(0).locator('input').nth(0).dispatchEvent('change');
    await activeRows.nth(0).locator('input').nth(1).fill('5');
    await activeRows.nth(0).locator('input').nth(1).dispatchEvent('change');
    await activeRows.nth(0).getByRole('button', { name: '完成本组' }).click();
    await activeRows.nth(2).locator('input').nth(0).fill('65');
    await activeRows.nth(2).locator('input').nth(0).dispatchEvent('change');
    await activeRows.nth(2).locator('input').nth(1).fill('6');
    await activeRows.nth(2).locator('input').nth(1).dispatchEvent('change');
    await activeRows.nth(2).getByRole('button', { name: '完成本组' }).click();
    await expect(page.getByLabel(/结束时回写到计划/)).toBeVisible();
    await page.getByRole('button', { name: '结束训练' }).click();

    stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.fitnessWorkouts[0].status).toBe('done');
    expect(stored.fitnessWorkouts[0].planId).toBe(stored.fitnessPlans[0].id);
    expect(stored.fitnessWorkouts[0].exercises).toHaveLength(2);
    expect(stored.fitnessWorkouts[0].exercises[0].plannedSets[0].weight).toBe(80);
    expect(stored.fitnessPlans[0].exercises[0].sets[0].weight).toBe(80);

    await page.locator('.fitness-metric-row').filter({ hasText: '力量计划' }).getByRole('button', { name: '按计划开练' }).click();
    active = page.locator('#page-fitness > article.card').first();
    activeRows = active.locator('.fitness-metric-row');
    await activeRows.nth(0).locator('input').nth(0).fill('87.5');
    await activeRows.nth(0).locator('input').nth(0).dispatchEvent('change');
    await activeRows.nth(0).locator('input').nth(1).fill('4');
    await activeRows.nth(0).locator('input').nth(1).dispatchEvent('change');
    await activeRows.nth(0).getByRole('button', { name: '完成本组' }).click();
    await page.getByLabel(/结束时回写到计划/).check();
    await page.getByRole('button', { name: '结束训练' }).click();

    stored = await page.evaluate(() => ({
        data: JSON.parse(localStorage.getItem('lifePlanData')),
        syncState: JSON.parse(localStorage.getItem('lifePlanSyncState')),
    }));
    expect(stored.data.fitnessPlans[0].exercises[0].sets[0]).toEqual(expect.objectContaining({ weight: 87.5, reps: 4 }));
    expect(stored.data.fitnessPlans[0].exercises[1].sets[0]).toEqual(expect.objectContaining({ weight: 60, reps: 6 }));
    expect(stored.data.fitnessWorkouts).toHaveLength(2);
    expect(stored.syncState.dirty).toBe(true);

    await page.locator('article.card').filter({ hasText: '开始计划训练' }).locator('.fitness-metric-row').filter({ hasText: '力量计划' }).getByRole('button', { name: '删除' }).click();
    const afterDelete = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(afterDelete.fitnessPlans).toHaveLength(0);
    expect(afterDelete.deletedItems).toEqual(expect.arrayContaining([
        expect.objectContaining({ collection: 'fitnessPlans', id: stored.data.fitnessPlans[0].id, reason: 'manual-delete' }),
    ]));
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

test('records legacy filters and operation events stay read-only', async ({ page }) => {
    const dateAt = amount => {
        const date = new Date();
        date.setDate(date.getDate() + amount);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };
    const today = dateAt(0);
    const rangeBoundary = dateAt(-29);
    const historyDate = dateAt(-31);
    const futureDate = dateAt(1);
    const source = emptyData({
        records: [
            { id: 'record-all-day', type: '日记', title: '今日全天记录', content: '普通内容', startDate: today, endDate: today, recordTime: '', recordEndTime: '', createdAt: `${today}T08:00:00`, todoIds: [] },
            { id: 'record-all-day-late', type: '日记', title: '较晚创建的全天记录', content: '普通内容', startDate: today, endDate: today, recordTime: '', recordEndTime: '', createdAt: `${today}T20:00:00`, todoIds: [] },
            { id: 'record-early', type: '工作记录', title: '早间记录', content: '普通内容', startDate: today, endDate: today, recordTime: '08:00', recordEndTime: '08:30', todoIds: [] },
            { id: 'record-late', type: '工作记录', title: '晚间记录', content: '普通内容', startDate: today, endDate: today, recordTime: '18:00', recordEndTime: '18:30', todoIds: [] },
            { id: 'record-boundary', type: '周复盘', title: '三十天边界记录', content: '边界内容', startDate: rangeBoundary, endDate: rangeBoundary, todoIds: [] },
            { id: 'record-history', type: '月复盘', title: '历史范围外记录', content: '旧内容', startDate: historyDate, endDate: historyDate, todoIds: [] },
            { id: 'record-future', type: '日计划', title: '未来范围外记录', content: '未来内容', startDate: futureDate, endDate: futureDate, todoIds: [] },
            { id: 'record-undated', type: '工作记录', title: '未设置日期记录', content: '兼容旧数据', startDate: '', endDate: '', todoIds: [] },
            { id: 'idea-unprocessed', type: '灵感碎片', title: '待处理迁移灵感', content: '灵感内容', startDate: today, endDate: futureDate, ideaStatus: '待整理', ideaTags: ['ProjectAlpha'], ideaNextAction: 'NEXT-ACTION-MARKER', ideaConclusion: '', todoIds: [] },
            { id: 'idea-conclusion', type: '灵感碎片', title: '等待结论灵感', content: '实验完成', startDate: today, endDate: today, ideaStatus: '实践中', ideaTags: ['ProjectBeta'], ideaNextAction: '', ideaConclusion: '', todoIds: [] },
            { id: 'idea-verified', type: '灵感碎片', title: '已有结论灵感', content: '实验完成', startDate: today, endDate: today, ideaStatus: '已验证', ideaTags: ['ProjectAlpha'], ideaNextAction: '', ideaConclusion: 'CONCLUSION-MARKER', todoIds: [] },
            { id: 'habit-record-shadow', type: '习惯记录', title: '旧习惯影子记录', content: '', startDate: today, endDate: today, isHabitRecord: true, todoIds: [] },
        ],
        todos: [
            todoFixture('todo-session-filter', '迁移执行事项', { dueDate: today, planStartDate: today, planEndDate: futureDate, sessions: [{ id: 'session-filter', date: today, startTime: '10:00', endTime: '10:45', note: 'SESSION-NOTE-MARKER', createdAt: `${today}T10:00:00` }] }),
            todoFixture('todo-plan-only', '只应出现在待办日程', { dueDate: today, planStartDate: today, planEndDate: today, sessions: [] }),
        ],
        habits: [
            { id: 'habit-filter', name: '聚合阅读习惯', rule: 'daily', timesPerDay: '2', startDate: historyDate, tag: '学习' },
        ],
        checkins: [
            { id: 'checkin-early', habitId: 'habit-filter', date: today, time: '07:00', checkinAt: `${today}T07:00:00`, note: '第一轮' },
            { id: 'checkin-late', habitId: 'habit-filter', date: today, time: '09:00', checkinAt: `${today}T09:00:00`, note: '第二轮' },
        ],
    });
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), source);
    await page.goto('/#/records');
    const recordsPage = page.locator('#page-records');
    const results = page.locator('#all-records');
    const storedBefore = await page.evaluate(() => localStorage.getItem('lifePlanData'));

    await expect(recordsPage.getByLabel('记录日期范围')).toHaveValue('30');
    await expect(results).toContainText('三十天边界记录');
    await expect(results).not.toContainText('历史范围外记录');
    await expect(results).not.toContainText('未来范围外记录');
    await expect(results).not.toContainText('未设置日期记录');
    await expect(results).not.toContainText('旧习惯影子记录');
    await expect(results).toContainText('执行：迁移执行事项');
    await expect(results).not.toContainText('计划：只应出现在待办日程');
    await expect(results).not.toContainText('截止：只应出现在待办日程');
    await expect(results.getByText('聚合阅读习惯', { exact: true })).toHaveCount(1);
    await expect(results).toContainText('已打卡 2/2');

    const typeValues = await recordsPage.getByLabel('记录类型筛选').locator('option').evaluateAll(options => options.map(option => option.value));
    expect(typeValues).toEqual(['all', '日记', '日计划', '工作记录', '灵感碎片', '周复盘', '月复盘', '年复盘', '周计划', '月计划', '年度计划', '3年计划', '终身愿景', '待办', '习惯']);

    const todayGroup = results.locator('.timeline-group').filter({ hasText: '早间记录' });
    let titles = await todayGroup.locator('.item-title').allTextContents();
    expect(titles.indexOf('较晚创建的全天记录')).toBeLessThan(titles.indexOf('今日全天记录'));
    expect(titles.indexOf('晚间记录')).toBeLessThan(titles.indexOf('早间记录'));
    await recordsPage.getByLabel('当日顺序').selectOption('asc');
    titles = await todayGroup.locator('.item-title').allTextContents();
    expect(titles.indexOf('今日全天记录')).toBeLessThan(titles.indexOf('较晚创建的全天记录'));
    expect(titles.indexOf('早间记录')).toBeLessThan(titles.indexOf('晚间记录'));

    const search = recordsPage.getByLabel('搜索记录');
    await search.fill(futureDate);
    await expect(results).toContainText('待处理迁移灵感');
    await expect(results).not.toContainText('早间记录');
    await search.fill('NEXT-ACTION-MARKER');
    await expect(results).toContainText('待处理迁移灵感');
    await search.fill('CONCLUSION-MARKER');
    await expect(results).toContainText('已有结论灵感');
    await search.fill('');

    await recordsPage.getByLabel('记录灵感状态筛选').selectOption('unprocessed');
    await recordsPage.getByLabel('记录灵感标签筛选').fill('projectalpha');
    await expect(results).toContainText('待处理迁移灵感');
    await expect(results).not.toContainText('等待结论灵感');
    await expect(results).not.toContainText('执行：迁移执行事项');
    await expect(results).not.toContainText('聚合阅读习惯');
    await recordsPage.getByLabel('记录灵感状态筛选').selectOption('needsConclusion');
    await recordsPage.getByLabel('记录灵感标签筛选').fill('projectbeta');
    await expect(results).toContainText('等待结论灵感');
    await expect(results).not.toContainText('已有结论灵感');

    await recordsPage.getByLabel('记录灵感状态筛选').selectOption('all');
    await recordsPage.getByLabel('记录灵感标签筛选').fill('');
    await recordsPage.getByLabel('记录类型筛选').selectOption('待办');
    await expect(results).toContainText('执行：迁移执行事项');
    await expect(results).not.toContainText('只应出现在待办日程');
    await recordsPage.getByLabel('记录类型筛选').selectOption('all');
    await results.getByRole('button', { name: /聚合阅读习惯/ }).click();
    await expect(page).toHaveURL(/#\/habits\?habit=habit-filter$/);
    await expect(page.locator('.habit-quick-card.is-target')).toContainText('聚合阅读习惯');
    await page.goto('/#/records');
    await recordsPage.getByLabel('记录日期范围').selectOption('all');
    await expect(results).toContainText('历史范围外记录');
    await expect(results).toContainText('未来范围外记录');
    await expect(results).toContainText('未设置日期记录');

    await recordsPage.getByRole('button', { name: '日', exact: true }).click();
    await expect(recordsPage.getByLabel('记录日期范围')).toHaveCount(0);
    await expect(results).toContainText('执行：迁移执行事项');
    await expect(results).toContainText('聚合阅读习惯');
    await recordsPage.getByLabel('记录类型筛选').selectOption('待办');
    await expect(results).toContainText('计划：迁移执行事项');
    await expect(results).toContainText('截止：迁移执行事项');
    await expect(results).toContainText('执行：迁移执行事项');

    const storageAfter = await page.evaluate(() => ({
        lifePlanData: localStorage.getItem('lifePlanData'),
        todoMirror: localStorage.getItem('todoAppData'),
        habitMirror: localStorage.getItem('habitAppData'),
    }));
    expect(storageAfter.lifePlanData).toBe(storedBefore);
    expect(storageAfter.todoMirror).toBeNull();
    expect(storageAfter.habitMirror).toBeNull();
});

test('materials create edit filter and delete preserve the legacy data contract', async ({ page }) => {
    const source = emptyData({
        materials: [
            { id: 'material-old', type: '摘抄', content: '较早素材', tags: ['阅读'], source: '旧书', note: '旧备注', createdAt: '2026-07-25T08:00:00', updatedAt: '2026-07-25T08:00:00' },
            { id: 'material-newer', type: '方法', content: '较新方法素材', tags: ['工作'], source: '实践', note: '新备注', createdAt: '2026-07-26T08:00:00', updatedAt: '2026-07-26T08:00:00' },
            { type: '旧分类', content: '旧格式素材', tags: '旧标签, AI，迁移', source: '旧数据源', note: '等待规范化' },
        ],
    });
    const original = JSON.stringify(source);
    await page.addInitScript(value => localStorage.setItem('lifePlanData', value), original);
    await page.goto('/#/materials');
    const materialsPage = page.locator('#page-materials');
    const list = materialsPage.locator('.material-list');
    let contents = await list.locator('.material-content').allTextContents();
    expect(contents.indexOf('较新方法素材')).toBeLessThan(contents.indexOf('较早素材'));

    await materialsPage.getByRole('button', { name: '新增素材' }).click();
    const editor = materialsPage.getByRole('dialog', { name: '新增素材' });
    await expect(editor.getByLabel('标题')).toHaveCount(0);
    await editor.getByLabel('内容').fill('   ');
    await editor.getByRole('button', { name: '保存' }).click();
    await expect(editor.getByRole('alert')).toHaveText('请输入素材内容');
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(original);

    await editor.getByLabel('类型').selectOption('金句');
    await editor.getByLabel('内容').fill('真正的素材正文');
    await editor.getByLabel('标签').fill('AI, 工作 AI，迁移');
    await editor.getByLabel('来源').fill('迁移手册');
    await editor.getByLabel('备注').fill('用于验证旧字段');
    await editor.getByRole('button', { name: '保存' }).click();
    await expect(list).toContainText('真正的素材正文');

    let stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    const created = stored.materials.find(item => item.content === '真正的素材正文');
    expect(created).toMatchObject({ type: '金句', tags: ['AI', '工作', '迁移'], source: '迁移手册', note: '用于验证旧字段', createdAt: expect.any(String), updatedAt: expect.any(String) });
    expect(created).not.toHaveProperty('title');
    const createdAt = created.createdAt;
    const normalizedLegacy = stored.materials.find(item => item.content === '旧格式素材');
    expect(normalizedLegacy).toMatchObject({
        type: '摘抄',
        tags: ['旧标签', 'AI', '迁移'],
        source: '旧数据源',
        note: '等待规范化',
        id: expect.any(String),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
    });
    expect(normalizedLegacy.id).not.toBe('');
    expect(normalizedLegacy.createdAt).not.toBe('');
    expect(normalizedLegacy.updatedAt).not.toBe('');

    await list.getByRole('button', { name: '编辑素材 真正的素材正文' }).click();
    const editDialog = materialsPage.getByRole('dialog', { name: '编辑素材' });
    await expectHashRoute(page, '/materials', { material: created.id });
    await expect(editDialog.getByLabel('内容')).toHaveValue('真正的素材正文');
    await editDialog.getByLabel('类型').selectOption('观点');
    await editDialog.getByLabel('内容').fill('更新后的观点正文');
    await editDialog.getByLabel('标签').fill('AI, 复盘');
    await editDialog.getByLabel('来源').fill('更新来源');
    await editDialog.getByLabel('备注').fill('更新备注');
    await editDialog.getByRole('button', { name: '保存' }).click();

    stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    const updated = stored.materials.find(item => item.id === created.id);
    expect(updated).toMatchObject({ type: '观点', content: '更新后的观点正文', tags: ['AI', '复盘'], source: '更新来源', note: '更新备注', createdAt });
    expect(updated.updatedAt).toEqual(expect.any(String));

    await materialsPage.getByLabel('素材类型筛选').selectOption('观点');
    await materialsPage.getByLabel('素材标签筛选').fill('复');
    await materialsPage.getByLabel('搜索素材').fill('更新来源');
    await expect(list).toContainText('更新后的观点正文');
    await expect(list).not.toContainText('较新方法素材');
    await materialsPage.getByLabel('搜索素材').fill('不存在');
    await expect(list).toContainText('暂无匹配素材');
    await materialsPage.getByLabel('搜索素材').fill('');

    await list.getByRole('button', { name: '编辑素材 更新后的观点正文' }).click();
    page.once('dialog', dialog => dialog.accept());
    await materialsPage.getByRole('dialog', { name: '编辑素材' }).getByRole('button', { name: '删除' }).click();
    stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.materials.find(item => item.id === created.id)).toBeUndefined();
    expect(stored.deletedItems).toEqual(expect.arrayContaining([
        expect.objectContaining({ collection: 'materials', id: created.id, reason: 'manual-delete' }),
    ]));
    expect(stored.materials.find(item => item.id === 'material-old').content).toBe('较早素材');
});

test('materials deep links filters and random review remain read-only', async ({ page }) => {
    const source = emptyData({
        materials: [
            { id: 'material-alpha', type: '金句', content: 'Alpha 内容', tags: ['Alpha'], source: '作者甲', note: '', createdAt: '2026-07-21T08:00:00', updatedAt: '2026-07-21T08:00:00' },
            { id: 'material-beta', type: '提示词', content: 'Beta 主素材', tags: ['Beta'], source: '作者乙', note: 'Beta 备注', createdAt: '2026-07-22T08:00:00', updatedAt: '2026-07-22T08:00:00' },
            { id: 'material-beta-two', type: '方法', content: 'Beta 次素材', tags: ['Beta', 'Gamma'], source: '', note: '', createdAt: '2026-07-23T08:00:00', updatedAt: '2026-07-23T08:00:00' },
            { id: 'material-gamma', type: '摘抄', content: 'Gamma 内容', tags: ['Gamma'], source: '', note: '', createdAt: '2026-07-24T08:00:00', updatedAt: '2026-07-24T08:00:00' },
        ],
    });
    const original = JSON.stringify(source);
    await page.addInitScript(value => localStorage.setItem('lifePlanData', value), original);
    await page.goto('/#/materials?material=material-beta&tag=beta');
    const materialsPage = page.locator('#page-materials');
    const list = materialsPage.locator('.material-list');
    const editor = materialsPage.getByRole('dialog', { name: '编辑素材' });
    await expect(editor.getByLabel('内容')).toHaveValue('Beta 主素材');
    await expect(materialsPage.getByLabel('素材标签筛选')).toHaveValue('beta');
    await expect(list).toContainText('Beta 主素材');
    await expect(list).toContainText('Beta 次素材');
    await expect(list).not.toContainText('Alpha 内容');
    await editor.getByRole('button', { name: '关闭素材编辑' }).click();
    await expect(page).toHaveURL(/#\/materials\?tag=beta$/);

    const randomPicker = materialsPage.getByRole('group', { name: '随机展示标签' });
    for (const checkbox of await randomPicker.getByRole('checkbox').all()) await checkbox.uncheck();
    const randomList = materialsPage.locator('.material-random-list');
    await expect(randomList.locator('.material-card')).toHaveCount(3);
    await randomPicker.getByRole('checkbox', { name: 'Beta' }).check();
    await expect(randomList.locator('.material-card')).toHaveCount(2);
    await expect(randomList).toContainText('Beta 主素材');
    await expect(randomList).toContainText('Beta 次素材');
    await materialsPage.getByRole('button', { name: '换一批' }).click();

    await page.goto('/#/tags');
    const betaTagCard = page.locator('.tag-center-card').filter({ has: page.locator('.tag-pill', { hasText: /^Beta$/ }) });
    await expect(betaTagCard).toContainText('Beta 主素材');
    await betaTagCard.getByRole('button').filter({ hasText: '素材' }).click();
    await expectHashRoute(page, '/materials', { tag: 'Beta' });
    await expect(materialsPage.getByLabel('素材标签筛选')).toHaveValue('Beta');
    await expect(list).toContainText('Beta 主素材');
    await expect(list).toContainText('Beta 次素材');
    await page.reload();
    await expectHashRoute(page, '/materials', { tag: 'Beta' });
    await expect(materialsPage.getByLabel('素材标签筛选')).toHaveValue('Beta');
    await page.goBack();
    await expectHashRoute(page, '/tags');
    await expect(page.locator('.tag-center-card').filter({ has: page.locator('.tag-pill', { hasText: /^Beta$/ }) })).toBeVisible();

    await page.goto('/#/search');
    const searchInput = page.locator('.global-search-panel input[type="search"]');
    await searchInput.fill('Beta 主素材');
    await page.getByRole('button', { name: '搜索', exact: true }).click();
    await expectHashRoute(page, '/search', { q: 'Beta 主素材' });
    await page.locator('.search-result-item').filter({ hasText: 'Beta 主素材' }).click();
    await expectHashRoute(page, '/materials', { material: 'material-beta' });
    await expect(editor.getByLabel('内容')).toHaveValue('Beta 主素材');
    await page.reload();
    await expectHashRoute(page, '/materials', { material: 'material-beta' });
    await expect(editor.getByLabel('内容')).toHaveValue('Beta 主素材');
    await page.goBack();
    await expectHashRoute(page, '/search', { q: 'Beta 主素材' });
    await expect(searchInput).toHaveValue('Beta 主素材');
    await expect(page.locator('.search-result-item').filter({ hasText: 'Beta 主素材' })).toBeVisible();

    const persisted = await page.evaluate(() => ({ data: localStorage.getItem('lifePlanData'), mirror: localStorage.getItem('todoAppData') }));
    expect(persisted.data).toBe(original);
    expect(persisted.mirror).toBeNull();
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

test('idea filters deep-link to one Records editor and persist all legacy idea fields', async ({ page }) => {
    const source = emptyData({
        records: [
            { id: 'idea-unprocessed', type: '灵感碎片', title: '待整理想法', content: '先收集', startDate: '2026-07-27', endDate: '2026-07-27', todoIds: [], ideaStatus: '待整理', ideaTags: ['收集'], ideaNextAction: '', ideaTodoId: '', ideaConclusion: '', updatedAt: '2026-07-27T08:00:00' },
            { id: 'idea-needs-conclusion', type: '灵感碎片', title: '需要结论的实践', content: '已经试过一次', startDate: '2026-07-27', endDate: '2026-07-27', todoIds: [], ideaStatus: '实践中', ideaTags: ['ProjectX'], ideaNextAction: '旧下一步', ideaTodoId: 'todo-linked-complete', ideaConclusion: '', updatedAt: '2026-07-27T09:00:00' },
            { id: 'idea-verified', type: '灵感碎片', title: '已有结论', content: '完成', startDate: '2026-07-27', endDate: '2026-07-27', todoIds: [], ideaStatus: '已验证', ideaTags: ['ProjectX'], ideaNextAction: '', ideaTodoId: '', ideaConclusion: '有效', updatedAt: '2026-07-27T10:00:00' },
        ],
        todos: [
            todoFixture('todo-linked-complete', '已完成的关联待办', { done: true, completedAt: '2026-07-27T10:00:00' }),
            todoFixture('todo-open-idea', '可选待办'),
        ],
    });
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), source);
    await page.goto('/#/ideas');

    await page.getByLabel('灵感状态筛选').selectOption('unprocessed');
    await expect(page.getByRole('heading', { name: '待整理想法' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '需要结论的实践' })).toHaveCount(0);
    await page.getByLabel('灵感状态筛选').selectOption('needsConclusion');
    await page.getByLabel('灵感标签筛选').fill('project');
    await expect(page.getByRole('heading', { name: '需要结论的实践' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '已有结论' })).toHaveCount(0);

    const ideaCard = page.locator('.idea-card').filter({ hasText: '需要结论的实践' });
    await ideaCard.getByRole('button', { name: '编辑推进' }).click();
    await expect(page).toHaveURL(/#\/records\?record=idea-needs-conclusion$/);
    const editor = page.locator('.record-editor-panel');
    const ideaFields = editor.getByRole('region', { name: '灵感推进' });
    await expect(editor.getByLabel('状态')).toHaveValue('实践中');
    await expect(editor.getByLabel('标签')).toHaveValue('ProjectX');
    await expect(ideaFields.getByRole('combobox', { name: '关联待办' })).toHaveValue('todo-linked-complete');
    await editor.getByLabel('状态').selectOption('已验证');
    await editor.getByLabel('标签').fill('ProjectX, 迁移 ProjectX');
    await editor.getByLabel('下一步').fill('整理实验数据');
    await ideaFields.getByRole('combobox', { name: '关联待办' }).selectOption('todo-open-idea');
    await editor.getByLabel('结果结论').fill('新版路径可用');
    await editor.getByRole('button', { name: '保存修改' }).click();

    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')).records.find(item => item.id === 'idea-needs-conclusion'));
    expect(saved).toMatchObject({
        ideaStatus: '已验证',
        ideaTags: ['ProjectX', '迁移'],
        ideaNextAction: '整理实验数据',
        ideaTodoId: 'todo-open-idea',
        ideaConclusion: '新版路径可用',
    });
    await editor.getByRole('button', { name: '可选待办' }).click();
    await expect(page).toHaveURL(/#\/todos\?todo=todo-open-idea$/);
    await expect(page.locator('.todo-detail-panel')).toContainText('可选待办');

    await page.goto('/#/records?record=idea-needs-conclusion');
    await editor.getByLabel('类型').fill('日记');
    await editor.getByRole('button', { name: '保存修改' }).click();
    const converted = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')).records.find(item => item.id === 'idea-needs-conclusion'));
    expect(converted).toMatchObject({
        type: '日记', ideaStatus: '', ideaTags: [], ideaNextAction: '', ideaTodoId: '', ideaConclusion: '',
    });
});

test('idea conversion updates status and next action while rebuilding the Todo mirror', async ({ page }) => {
    const source = emptyData({
        records: [{
            id: 'idea-convert', type: '灵感碎片', title: '把灵感变成行动', content: '记录转换背景',
            startDate: '2026-07-27', endDate: '2026-07-27', todoIds: [], ideaStatus: '待整理',
            ideaTags: ['行动'], ideaNextAction: '', ideaTodoId: 'missing-todo', ideaConclusion: '', updatedAt: '2026-07-27T08:00:00',
        }],
    });
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), source);
    await page.goto('/#/ideas');
    await page.locator('.idea-card').filter({ hasText: '把灵感变成行动' }).getByRole('button', { name: '转成待办' }).click();
    await expect(page).toHaveURL(/#\/todos\?todo=/);
    await expect(page.locator('.todo-detail-panel')).toContainText('把灵感变成行动');

    const stored = await page.evaluate(() => ({
        data: JSON.parse(localStorage.getItem('lifePlanData')),
        mirror: JSON.parse(localStorage.getItem('todoAppData')),
    }));
    const idea = stored.data.records.find(item => item.id === 'idea-convert');
    const todo = stored.data.todos.find(item => item.id === idea.ideaTodoId);
    expect(idea).toMatchObject({ ideaStatus: '待实践', ideaNextAction: '把灵感变成行动' });
    expect(idea.ideaTodoId).not.toBe('missing-todo');
    expect(todo).toMatchObject({ text: '把灵感变成行动', group: '学习' });
    expect(todo.note).toContain('来源灵感：把灵感变成行动');
    expect(todo.note).toContain('记录转换背景');
    expect(stored.mirror.authority).toBe('lifePlanData.todos');
    expect(stored.mirror.todos.map(item => item.id)).toContain(todo.id);
});

test('record editor autosaves after three seconds and flushes before close switch and navigation', async ({ page }) => {
    const source = emptyData({
        records: [
            { id: 'record-autosave', type: '工作记录', title: '自动保存记录', content: '旧内容', startDate: '2026-07-27', endDate: '2026-07-27', recordTime: '', recordEndTime: '', todoIds: [], updatedAt: '2026-07-27T08:00:00' },
            { id: 'record-switch', type: '工作记录', title: '切换目标记录', content: '切换旧内容', startDate: '2026-07-27', endDate: '2026-07-27', recordTime: '', recordEndTime: '', todoIds: [], updatedAt: '2026-07-27T08:00:00' },
        ],
    });
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), source);
    await page.goto('/#/records');
    await page.getByRole('button', { name: /自动保存记录/ }).first().click();
    const editor = page.locator('.record-editor-panel');
    await editor.getByLabel('内容').fill('三秒后保存的内容');
    await expect(editor.getByRole('status')).toHaveText('有未保存修改');
    await page.getByRole('button', { name: /自动保存记录/ }).first().click();
    await expect(editor.getByLabel('内容')).toHaveValue('三秒后保存的内容');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')).records.find(item => item.id === 'record-autosave').content)).toBe('旧内容');
    await expect(editor.getByRole('status')).toContainText('已自动保存于', { timeout: 5000 });
    let stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.records.find(item => item.id === 'record-autosave')).toMatchObject({ content: '三秒后保存的内容' });
    expect(stored.records.find(item => item.id === 'record-autosave').updatedAt).not.toBe('2026-07-27T08:00:00');

    await editor.getByLabel('标题').fill('关闭前刷新记录');
    await editor.getByRole('button', { name: '关闭' }).click();
    stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.records.find(item => item.id === 'record-autosave').title).toBe('关闭前刷新记录');

    await page.getByRole('button', { name: /关闭前刷新记录/ }).first().click();
    await editor.getByLabel('内容').fill('切换记录前刷新');
    await page.getByRole('button', { name: /切换目标记录/ }).first().click();
    stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.records.find(item => item.id === 'record-autosave').content).toBe('切换记录前刷新');

    await editor.getByLabel('内容').fill('离开页面前刷新');
    await page.getByRole('link', { name: '灵感池' }).click();
    stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.records.find(item => item.id === 'record-switch').content).toBe('离开页面前刷新');
});

test('new record modal keeps blank initialization read-only then autosaves and reuses the scoped diary', async ({ page }) => {
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), emptyData());
    await page.goto('/#/records');

    await page.getByRole('button', { name: '新建记录' }).click();
    let modal = page.getByRole('dialog');
    await modal.getByRole('button', { name: '日记', exact: true }).click();
    await expect(modal.getByLabel('标题')).toHaveValue(/^\d{4}年\d{1,2}月\d{1,2}日 星期[一二三四五六日]$/);
    await expect(modal.getByLabel('记录模板')).toHaveValue('builtin:builtin-diary-daily-review');
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')).records)).toEqual([]);

    await page.getByRole('button', { name: '新建记录' }).click();
    modal = page.getByRole('dialog');
    await modal.getByRole('button', { name: '日记', exact: true }).click();
    await modal.locator('summary').filter({ hasText: /^正文$/ }).click();
    await modal.getByLabel('新记录正文').fill('新记录自动保存正文');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')).records)).toEqual([]);
    await expect(modal.getByRole('status')).toContainText('已自动保存于', { timeout: 5000 });

    let stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.records).toHaveLength(1);
    const diaryId = stored.records[0].id;
    expect(stored.records[0]).toMatchObject({
        type: '日记', templateId: 'builtin-diary-daily-review', startDate: expect.any(String), endDate: expect.any(String), todoIds: [],
    });
    expect(stored.records[0].content).toContain('# 正文\n新记录自动保存正文');

    await modal.locator('summary').filter({ hasText: /^明日重点$/ }).click();
    await modal.getByLabel('新记录明日重点').fill('关闭前立即保存的新重点');
    await modal.getByRole('button', { name: '关闭', exact: true }).click();
    stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.records).toHaveLength(1);
    expect(stored.records[0].id).toBe(diaryId);
    expect(stored.records[0].content).toContain('# 明日重点\n关闭前立即保存的新重点');

    await page.getByRole('button', { name: '新建记录' }).click();
    modal = page.getByRole('dialog');
    await modal.getByRole('button', { name: '日记', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const editor = page.locator('.record-editor-panel');
    await expect(editor).toBeVisible();
    await expect(editor.getByRole('status')).toContainText('这个周期已经有一条了');
    await expect(editor.getByLabel('内容')).toHaveValue(/关闭前立即保存的新重点/);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')).records)).toHaveLength(1);
});

test('new idea record flushes its structured and idea fields when the route leaves', async ({ page }) => {
    const source = emptyData({ todos: [todoFixture('idea-draft-todo', '草稿关联待办')] });
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), source);
    await page.goto('/#/records');
    await page.getByRole('button', { name: '新建记录' }).click();
    const modal = page.getByRole('dialog');
    await modal.getByRole('button', { name: '灵感碎片', exact: true }).click();
    await modal.getByLabel('标题').fill('路由离开前的灵感草稿');
    await modal.locator('summary').filter({ hasText: /^想法本身$/ }).click();
    await modal.getByLabel('新记录想法本身').fill('把新记录 modal 做成可靠草稿入口');
    const ideaFields = modal.getByRole('region', { name: '新记录灵感推进' });
    await ideaFields.getByLabel('状态').selectOption('待实践');
    await ideaFields.getByLabel('标签').fill('记录, Migration 记录');
    await ideaFields.getByLabel('下一步').fill('验证离开页面时同步落库');
    await ideaFields.getByLabel('关联待办').selectOption('idea-draft-todo');
    await ideaFields.getByLabel('结果结论').fill('等待验证');

    await page.evaluate(() => { location.hash = '#/ideas'; });
    await expect(page).toHaveURL(/#\/ideas$/);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')).records.find(item => item.title === '路由离开前的灵感草稿'));
    expect(saved).toMatchObject({
        type: '灵感碎片', templateId: 'builtin-idea-capture', ideaStatus: '待实践',
        ideaTags: ['记录', 'Migration'], ideaNextAction: '验证离开页面时同步落库', ideaTodoId: 'idea-draft-todo', ideaConclusion: '等待验证',
    });
    expect(saved.content).toContain('# 想法本身\n把新记录 modal 做成可靠草稿入口');
});

test('diary AI keeps remote drafts read-only until confirmed writeback and Todo creation', async ({ page }) => {
    const originalContent = [
        '# 正文',
        '今天先把日记 AI 的确认链路做稳。',
        '',
        '# 今日一句话',
        '先确认，再写入',
        '',
        '# 高兴',
        '',
        '',
        '# 思考',
        '',
        '',
        '# 小确幸',
        '',
        '',
        '# 待改进',
        '',
        '',
        '# 复盘',
        '旧复盘不能静默覆盖。',
        '',
        '# 明日重点',
        '旧明日重点要保留。',
        '',
    ].join('\n');
    const source = emptyData({
        records: [{
            id: 'diary-ai-vue', type: '日记', title: 'Vue 日记 AI', content: originalContent,
            startDate: '2026-07-27', endDate: '2026-07-27', recordTime: '21:00', recordEndTime: '',
            templateId: 'builtin-diary-daily-review', todoIds: [], updatedAt: '2026-07-27T21:00:00',
        }],
    });
    const requests = [];
    await page.route('https://ai.example.test/v1/chat/completions', async route => {
        requests.push(route.request().postDataJSON());
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                choices: [{
                    message: {
                        content: JSON.stringify({
                            title: '日记分析：Vue 日记 AI',
                            summary: '先确认复盘，再决定是否创建行动项。',
                            review: 'AI 原始复盘草稿',
                            tomorrowFocus: 'AI 明日重点草稿',
                            items: [{
                                text: '验证日记 AI 写回', note: '先检查持久化契约', group: '工作', urgency: 'high',
                                planStartDate: '2026-07-28', planEndDate: '2026-07-29', dueDate: '2026-07-29',
                            }],
                        }),
                    },
                }],
            }),
        });
    });
    await page.addInitScript(data => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        localStorage.setItem('lifePlanAiConfig', JSON.stringify({
            endpointUrl: 'https://ai.example.test/v1', apiKey: 'test-key', model: 'test-model', remoteEnabled: true, userStyle: '短句',
        }));
    }, source);

    await page.goto('/#/records');
    await page.getByRole('button', { name: /Vue 日记 AI/ }).first().click();
    const editor = page.locator('.record-editor-panel');
    const aiPanel = editor.locator('.record-diary-ai');
    await aiPanel.getByLabel('分析偏好').fill('只写一条明确复盘');
    await aiPanel.getByRole('button', { name: '生成分析' }).click();
    await expect(aiPanel.getByRole('status')).toContainText('AI 草稿已生成');
    await expect(aiPanel.getByLabel('AI 复盘草稿')).toHaveValue('AI 原始复盘草稿');
    await expect(aiPanel.getByLabel('AI 明日重点草稿')).toHaveValue('AI 明日重点草稿');

    expect(requests).toHaveLength(1);
    const userPayload = JSON.parse(requests[0].messages.find(message => message.role === 'user').content);
    expect(userPayload).toMatchObject({
        mode: 'diaryReview',
        userInput: '只写一条明确复盘',
        userStyle: '短句',
        context: { selectedDiary: { id: 'diary-ai-vue', title: 'Vue 日记 AI', content: originalContent, templateId: 'builtin-diary-daily-review' } },
    });
    let stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.records[0].content).toBe(originalContent);
    expect(stored.todos).toHaveLength(0);

    await aiPanel.getByLabel('AI 复盘草稿').fill('编辑后的复盘：确认后才写入。');
    const tomorrowSection = aiPanel.locator('.record-diary-ai-section').nth(1);
    await tomorrowSection.getByRole('checkbox').uncheck();
    page.once('dialog', dialog => dialog.dismiss());
    await aiPanel.getByRole('button', { name: '写入所选内容' }).click();
    stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.records[0].content).toBe(originalContent);

    page.once('dialog', dialog => dialog.accept());
    await aiPanel.getByRole('button', { name: '写入所选内容' }).click();
    stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.records[0]).toMatchObject({ templateId: 'builtin-diary-daily-review' });
    expect(stored.records[0].content).toContain('# 复盘\n编辑后的复盘：确认后才写入。');
    expect(stored.records[0].content).toContain('# 明日重点\n旧明日重点要保留。');
    expect(stored.todos).toHaveLength(0);

    await aiPanel.getByLabel('AI 待办 1 标题').fill('编辑后的待办：核对日记写回');
    await aiPanel.getByLabel('AI 待办 1 备注').fill('草稿可编辑，创建动作独立');
    await aiPanel.getByRole('button', { name: '创建所选待办' }).click();
    const saved = await page.evaluate(() => ({
        data: JSON.parse(localStorage.getItem('lifePlanData')),
        mirror: JSON.parse(localStorage.getItem('todoAppData')),
    }));
    const todo = saved.data.todos[0];
    expect(todo).toMatchObject({
        text: '编辑后的待办：核对日记写回', note: expect.stringContaining('草稿可编辑，创建动作独立'),
        group: '工作', urgency: 'high', planStartDate: '2026-07-28', planEndDate: '2026-07-29', dueDate: '2026-07-29',
        sourceType: 'diary-ai', sourceRecordId: 'diary-ai-vue',
    });
    expect(todo.note).toContain('来源日记：Vue 日记 AI');
    expect(saved.data.records[0].todoIds).toContain(todo.id);
    expect(saved.mirror).toMatchObject({ authority: 'lifePlanData.todos' });
    expect(saved.mirror.todos.map(item => item.id)).toContain(todo.id);
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
